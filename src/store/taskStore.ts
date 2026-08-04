import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Tasks, Reminder } from '../types';
import { supabase } from '../core/supabase';
import { localSyncGate } from '../core/localSyncGate';
import { PilarType } from '../types';
import { checkAndCalculateOverflow } from '../features/timeline/transformers/timeMath';
import { getFilteredTasks as getFilteredTasksSelector, getFilteredReminders as getFilteredRemindersSelector } from '../features/tasks/selectors';
import { storage } from '../storage/mmkv';

const LOCAL_STORAGE_KEY = 'chronos-task-storage';

const mmkvStorage: StateStorage = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.remove(key),
};

// --- HELPERS DEL ÍNDICE POR DÍA ---
const buildDayIndex = (tasks: Tasks[], reminders: Reminder[]): Record<string, string[]> => {
  const index: Record<string, string[]> = {};

  const addToIndex = (date: string, id: string) => {
    if (!date || !id) return;

    const current = index[date] ?? [];
    if (!current.includes(id)) {
      index[date] = [...current, id];
    }
  };

  tasks.forEach((task) => {
    // Indexar por fecha principal
    addToIndex(task.date, task.id);
    
    // Indexar por fecha de overflow si existe
    if (task.overflowDate) {
      addToIndex(task.overflowDate, task.id);
    }
  });

  reminders.forEach((reminder) => {
    if (reminder.id) {
      addToIndex(reminder.date, reminder.id);
    }
  });

  return index;
};

interface TaskState {
  tasks: Tasks[];
  reminders: Reminder[];
  dayIndex: Record<string, string[]>;
  isLoading: boolean;
  selectedDate: string; // ISO date string (YYYY-MM-DD) for filtering

  // Actions
  setSelectedDate: (date: string) => void;
  fetchData: (silent?: boolean) => Promise<void>;
  saveTask: (task: Tasks, editingEventId: string | null) => Promise<boolean>;
  saveReminder: (reminder: Reminder, editingEventId: string | null) => Promise<void>;
  deleteEvent: (id: string, type: 'task' | 'reminder') => Promise<void>;
  clearData: () => void;
  rebuildDayIndex: () => void;
  getIdsForDay: (date: string) => string[];

  // Date filtering
  getFilteredTasks: () => Tasks[];
  getFilteredReminders: () => Reminder[];
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      reminders: [],
      dayIndex: {},
      isLoading: false,
      selectedDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format

      setSelectedDate: (date) => set({ selectedDate: date }),

      // --- OBTENER DATOS (MODO OFFLINE) ---
      fetchData: async (silent = false) => {
        // MODO OFFLINE: No cargar de Supabase, solo usar datos locales persistidos
        if (!silent) set({ isLoading: false });
      },

      // --- GUARDADO LOCAL DE TAREAS ---
      saveTask: async (task: Tasks, editingEventId: string | null) => {
        const { tasks, reminders } = get();

        // --- VERIFICACIÓN DE OVERFLOW ---
        const overflowResult = checkAndCalculateOverflow(
          task.slotInicio,
          task.duracionSlots,
          task.date
        );

        // Guardamos past12 y los campos de overflow
        const taskWithOverflow: Tasks = {
          ...task,
          past12: overflowResult.past12,
          overflowDate: overflowResult.overflowDate,
          overflowSlots: overflowResult.overflowSlots,
        };

        // --- ACTUALIZACIÓN OPTIMISTA ---
        const optimisticId = editingEventId || taskWithOverflow.id;
        const optimisticTask: Tasks = {
          ...taskWithOverflow,
          id: optimisticId,
          blockId: optimisticId,
        };

        let newTasks = [...tasks];
        if (editingEventId) {
          newTasks = newTasks.map(t => ((t.id || t.blockId) === editingEventId ? optimisticTask : t));
        } else {
          newTasks.push(optimisticTask);
        }

        const nextDayIndex = buildDayIndex(newTasks, reminders);
        set({ tasks: newTasks, dayIndex: nextDayIndex });

        // MODO OFFLINE: Solo guardado local, sin sincronización remota
        return true;
      },

      // --- GUARDADO LOCAL DE RECORDATORIOS ---
      saveReminder: async (reminder: Reminder, editingEventId: string | null) => {
        const { reminders, tasks } = get();

        // --- ACTUALIZACIÓN OPTIMISTA ---
        const optimisticId = editingEventId || reminder.id;
        const optimisticReminder: Reminder = {
          ...reminder,
          id: optimisticId,
        };

        let newReminders = [...reminders];
        if (editingEventId) {
          newReminders = newReminders.map(r => r.id === editingEventId ? optimisticReminder : r);
        } else {
          newReminders.push(optimisticReminder);
        }

        const nextDayIndex = buildDayIndex(tasks, newReminders);
        set({ reminders: newReminders, dayIndex: nextDayIndex });

        // MODO OFFLINE: Solo guardado local, sin sincronización remota
      },

      // --- ELIMINAR (DELETE en cascada por FK) ---
      deleteEvent: async (id, type) => {
        const { tasks, reminders } = get();

        // --- ACTUALIZACIÓN OPTIMISTA ---
        if (type === 'task') {
          const nextTasks = tasks.filter(t => (t.id || t.blockId) !== id);
          const nextDayIndex = buildDayIndex(nextTasks, reminders);
          set({ tasks: nextTasks, dayIndex: nextDayIndex });
        } else {
          const nextReminders = reminders.filter(r => r.id !== id);
          const nextDayIndex = buildDayIndex(tasks, nextReminders);
          set({ reminders: nextReminders, dayIndex: nextDayIndex });
        }

        // MODO OFFLINE: Solo eliminación local, sin sincronización remota
      },

      // --- LIMPIEZA DEL ESTADO LOCAL ---
      clearData: () => set({
        tasks: [],
        reminders: [],
        dayIndex: {},
      }),

      // --- RECONSTRUCCIÓN DEL ÍNDICE POR DÍA ---
      rebuildDayIndex: () => {
        const { tasks, reminders } = get();
        set({ dayIndex: buildDayIndex(tasks, reminders) });
      },

      // --- CONSULTA DEL ÍNDICE POR DÍA ---
      getIdsForDay: (date) => {
        const { dayIndex } = get();
        return dayIndex[date] ?? [];
      },

      // --- FILTRADO POR FECHA (incluye overflow) ---
      getFilteredTasks: () => {
        const { tasks, selectedDate } = get();
        return getFilteredTasksSelector(tasks, selectedDate);
      },

      getFilteredReminders: () => {
        const { reminders, selectedDate } = get();
        return getFilteredRemindersSelector(reminders, selectedDate);
      },
    }),
    {
      name: LOCAL_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      partialize: (state) => ({
        tasks: state.tasks,
        reminders: state.reminders,
        dayIndex: state.dayIndex,
        selectedDate: state.selectedDate,
      }),
    }
  )
);
