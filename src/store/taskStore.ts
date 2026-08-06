import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Tasks, Reminder } from '../types';
import { supabase } from '../core/supabase';
import { localSyncGate } from '../core/localSyncGate';
import { PilarType } from '../types';
import { checkAndCalculateOverflow, getLocalDateString } from '../features/timeline/transformers/timeMath';
import { getFilteredTasks as getFilteredTasksSelector, getFilteredReminders as getFilteredRemindersSelector } from '../features/tasks/selectors';
import { storage } from '../storage/mmkv';
import { syncTaskNotifications, cancelAllTaskNotifications } from '../features/background/notifications';

const LOCAL_STORAGE_KEY = 'chronos-task-storage';

const mmkvStorage: StateStorage = {
  getItem: (key) => {
    const value = storage.getString(key);
    return value ?? null;
  },
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

// --- INCREMENTAL INDEX HELPERS ---
function addToIndex(
  index: Record<string, string[]>,
  date: string,
  id: string
): Record<string, string[]> {
  if (!date || !id) return index
  const current = index[date] ?? []
  if (current.includes(id)) return index
  return { ...index, [date]: [...current, id] }
}

function removeFromIndex(
  index: Record<string, string[]>,
  date: string,
  id: string
): Record<string, string[]> {
  if (!index[date]) return index
  const cleaned = index[date].filter(i => i !== id)
  if (cleaned.length === 0) {
    const next = { ...index }
    delete next[date]
    return next
  }
  return { ...index, [date]: cleaned }
}

function migrateInIndex(
  index: Record<string, string[]>,
  id: string,
  oldDate: string,
  newDate: string
): Record<string, string[]> {
  const afterRemove = removeFromIndex(index, oldDate, id)
  return addToIndex(afterRemove, newDate, id)
}

// --- FULL INDEX REBUILD (STANDALONE UTILITY) ---
const buildDayIndex = (tasks: Tasks[], reminders: Reminder[]): Record<string, string[]> => {
  const index: Record<string, string[]> = {};

  tasks.forEach((task) => {
    if (task.id) {
      // Indexar por fecha principal
      addToIndex(index, task.date, task.id);
      
      // Indexar por fecha de overflow si existe
      if (task.overflowDate) {
        addToIndex(index, task.overflowDate, task.id);
      }
    }
  });

  reminders.forEach((reminder) => {
    if (reminder.id) {
      addToIndex(index, reminder.date, reminder.id);
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

  // Notification permissions
  notifGranted: boolean;
  alarmSupported: boolean;

  // Actions
  setSelectedDate: (date: string) => void;
  fetchData: (silent?: boolean) => Promise<void>;
  saveTask: (task: Tasks, editingEventId: string | null) => Promise<boolean>;
  saveReminder: (reminder: Reminder, editingEventId: string | null) => Promise<void>;
  deleteEvent: (id: string, type: 'task' | 'reminder') => Promise<void>;
  clearData: () => void;
  rebuildDayIndex: () => void;
  ensureIndexConsistency: () => void;
  validateIndexConsistency: () => boolean;
  getIdsForDay: (date: string) => string[];
  getTasksForDay: (date?: string) => Tasks[];

  // Notification permissions action
  setNotifPermissions: (granted: boolean, alarmSupported: boolean) => void;

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
      selectedDate: getLocalDateString(), // Today's date in YYYY-MM-DD format

      // Notification permissions state
      notifGranted: false,
      alarmSupported: false,

      setSelectedDate: (date) => set({ selectedDate: date }),

      setNotifPermissions: (granted, alarmSupported) =>
        set({ notifGranted: granted, alarmSupported }),

      // --- OBTENER DATOS (MODO OFFLINE) ---
      fetchData: async (silent = false) => {
        // MODO OFFLINE: No cargar de Supabase, solo usar datos locales persistidos
        if (!silent) set({ isLoading: false });

        // Ensure index consistency on first load
        const { validateIndexConsistency, ensureIndexConsistency } = get();
        if (!validateIndexConsistency()) {
          if (__DEV__) console.warn('[dayIndex] inconsistency detected on load');
          ensureIndexConsistency();
        }
      },

      // --- GUARDADO LOCAL DE TAREAS ---
      saveTask: async (task: Tasks, editingEventId: string | null) => {
        const { tasks, dayIndex } = get();

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
          overflowDate: overflowResult.past12 
            ? overflowResult.overflowDate 
            : undefined,         // ← explicit cleanup
          overflowSlots: overflowResult.past12 
            ? overflowResult.overflowSlots 
            : undefined,         // ← explicit cleanup
        };

        // --- SYNC NOTIFICATIONS (before set) ---
        const { alarmSupported } = get();
        const taskWithNotifs = await syncTaskNotifications(taskWithOverflow, alarmSupported);

        // --- ACTUALIZACIÓN OPTIMISTA ---
        const optimisticId = editingEventId || taskWithNotifs.id;
        const optimisticTask: Tasks = {
          ...taskWithNotifs,
          id: optimisticId,
          blockId: optimisticId,
        };

        // Detect operation type
        const existingTask = editingEventId ? tasks.find(t => (t.id || t.blockId) === editingEventId) : undefined;
        
        if (!editingEventId || !existingTask) {
          // INSERT: new task
          set(() => {
            const newTasks = [...tasks, optimisticTask];
            const newIndex = addToIndex(dayIndex, optimisticTask.date, optimisticTask.id);
            const finalIndex = optimisticTask.overflowDate
              ? addToIndex(newIndex, optimisticTask.overflowDate, optimisticTask.id)
              : newIndex;
            return { tasks: newTasks, dayIndex: finalIndex };
          });
        } else if (existingTask.date === optimisticTask.date) {
          // UPDATE: same day edit
          set(() => {
            const newTasks = tasks.map(t => 
              (t.id || t.blockId) === editingEventId ? optimisticTask : t
            );
            // dayIndex does NOT change on same-day edit
            return { tasks: newTasks };
          });
        } else {
          // MIGRATE: date changed
          set(() => {
            const newTasks = tasks.map(t => 
              (t.id || t.blockId) === editingEventId ? optimisticTask : t
            );
            let newIndex = migrateInIndex(
              dayIndex, editingEventId, existingTask.date, optimisticTask.date
            );
            // Handle overflow changes
            if (existingTask.overflowDate) {
              newIndex = removeFromIndex(newIndex, existingTask.overflowDate, editingEventId);
            }
            if (optimisticTask.overflowDate) {
              newIndex = addToIndex(newIndex, optimisticTask.overflowDate, editingEventId);
            }
            return { tasks: newTasks, dayIndex: newIndex };
          });
        }

        // MODO OFFLINE: Solo guardado local, sin sincronización remota
        return true;
      },

      // --- GUARDADO LOCAL DE RECORDATORIOS ---
      saveReminder: async (reminder: Reminder, editingEventId: string | null) => {
        const { reminders, dayIndex } = get();

        // --- ACTUALIZACIÓN OPTIMISTA ---
        const optimisticId = editingEventId || reminder.id;
        const optimisticReminder: Reminder = {
          ...reminder,
          id: optimisticId,
        };

        let newReminders = [...reminders];
        let nextDayIndex = dayIndex;

        if (editingEventId) {
          // Find existing reminder to get old date
          const existingReminder = reminders.find(r => r.id === editingEventId);
          
          // Remove from old date
          if (existingReminder && existingReminder.id) {
            nextDayIndex = removeFromIndex(nextDayIndex, existingReminder.date, existingReminder.id);
          }

          // Update reminder
          newReminders = newReminders.map(r => r.id === editingEventId ? optimisticReminder : r);

          // Add to new date
          if (optimisticReminder.id) {
            nextDayIndex = addToIndex(nextDayIndex, optimisticReminder.date, optimisticReminder.id);
          }
        } else {
          // New reminder - just add it
          newReminders.push(optimisticReminder);

          // Add to index
          if (optimisticReminder.id) {
            nextDayIndex = addToIndex(nextDayIndex, optimisticReminder.date, optimisticReminder.id);
          }
        }

        set({ reminders: newReminders, dayIndex: nextDayIndex });

        // MODO OFFLINE: Solo guardado local, sin sincronización remota
      },

      // --- ELIMINAR (DELETE en cascada por FK) ---
      deleteEvent: async (id, type) => {
        if (type === 'task') {
          // Cancel all notifications for this task BEFORE the atomic set()
          const { tasks } = get();
          const target = tasks.find(t => t.id === id);
          if (target) {
            await cancelAllTaskNotifications(target);
          }

          set((state) => {
            const found = state.tasks.find(t => t.id === id);
            if (!found) {
              if (__DEV__) {
                console.warn(`[deleteEvent] target not found for id: ${id}`);
              }
              return state;
            }
            let newIndex = removeFromIndex(state.dayIndex, found.date, id);
            if (found.overflowDate) {
              newIndex = removeFromIndex(newIndex, found.overflowDate, id);
            }
            return {
              tasks: state.tasks.filter(t => t.id !== id),
              dayIndex: newIndex
            };
          });
        } else {
          set((state) => {
            const target = state.reminders.find(r => r.id === id);
            if (!target) {
              if (__DEV__) {
                console.warn(`[deleteEvent] target not found for id: ${id}`);
              }
              return state;
            }
            const newIndex = removeFromIndex(state.dayIndex, target.date, id);
            return {
              reminders: state.reminders.filter(r => r.id !== id),
              dayIndex: newIndex
            };
          });
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

      // --- CONSISTENCY CHECK FOR INDEX ---
      ensureIndexConsistency: () => {
        const { tasks, reminders } = get();
        const correctIndex = buildDayIndex(tasks, reminders);
        set({ dayIndex: correctIndex });
        if (__DEV__) {
          console.log('[dayIndex] rebuilt from source of truth');
        }
      },

      validateIndexConsistency: () => {
        const { tasks, reminders, dayIndex } = get();
        const allIds = new Set([
          ...tasks.map(t => t.id).filter(Boolean),
          ...reminders.map(r => r.id).filter(Boolean)
        ]);
        for (const ids of Object.values(dayIndex)) {
          for (const id of ids) {
            if (!allIds.has(id)) return false;
          }
        }
        return true;
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

      getTasksForDay: (date?: string) => {
        const { tasks, dayIndex, selectedDate } = get();
        const targetDate = date ?? selectedDate;
        const ids = dayIndex[targetDate] ?? [];
        const idSet = new Set(ids);
        return tasks.filter(t => idSet.has(t.id));
      },
    }),
    {
      name: LOCAL_STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // v1 → v2: rebuild index from tasks/reminders
          // because v1 index may not have overflow entries
          const { tasks = [], reminders = [] } = persistedState;
          persistedState.dayIndex = buildDayIndex(tasks, reminders);
        }
        return persistedState;
      },
      partialize: (state) => ({
        tasks: state.tasks,
        reminders: state.reminders,
        dayIndex: state.dayIndex,
        selectedDate: state.selectedDate,
      }),
    }
  )
);
