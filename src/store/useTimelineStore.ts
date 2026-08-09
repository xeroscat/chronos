import { create } from 'zustand';
import { PilarType, Tasks, Reminder } from '../types';
import { slotToTimeParts, findFirstFreeSpace, slotsToHours, slotsToMinutes } from '../features/timeline/transformers/timeMath';
import { useUIStore } from './useUIStore';
import { useTaskStore } from './taskStore';
import { getFilteredBlocks as getFilteredBlocksSelector } from '../features/timeline/selectors';

// Tipo para bloques de renderizado (solo datos necesarios)
export type RenderBlock = {
  id: string;
  blockId: string;
  slotInicio: number;
  duracionSlots: number;
  slotFin?: number;
  pilarTipo: PilarType;
  status: string | null;
  past12: boolean;
  isOverflow?: boolean; // Flag para identificar si este bloque es renderizado como overflow
  overflowSlots?: number; // Solo si isOverflow es true
};

export type TimelineEvent =
  | ({ type: 'task' } & Tasks)
  | ({ type: 'reminder' } & Reminder);

interface TimelineState {
  // Form States (Tasks)
  taskTitle: string;
  selectedPilar: PilarType;
  isPilarSelectorOpen: boolean;
  startTime: string;
  duration: string;
  reminderBefore: string;
  description: string;
  
  // Form States (Reminders)
  reminderTime: string;
  reminderDesc: string;
  
  // Overlays
  isEditingDesc: boolean;
  isEditingTime: boolean;
  isEditingDuration: boolean;
  isEditingAlert: boolean;
  isEditingAlertReminder: boolean;
  
  // Pickers
  pickerHour: string;
  pickerMinute: string;
  pickerAmPm: 'AM' | 'PM';
  pickerDurationHour: string;
  pickerDurationMin: string;

  // Actions
  setPilarSelectorOpen: (open: boolean) => void;
  setSelectedPilar: (pilar: PilarType) => void;
  setTaskTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setReminderDesc: (desc: string) => void;
  
  setEditingDesc: (open: boolean) => void;
  setEditingTime: (open: boolean) => void;
  setEditingDuration: (open: boolean) => void;
  setEditingAlert: (open: boolean) => void;
  setEditingAlertReminder: (open: boolean) => void;
  
  setPickerAmPm: (ampm: 'AM' | 'PM') => void;
  setPickerHour: (hour: string) => void;
  setPickerMinute: (min: string) => void;
  setPickerDurationHour: (hour: string) => void;
  setPickerDurationMin: (min: string) => void;
  setStartTime: (time: string) => void;
  setDuration: (duration: string) => void;
  setReminderTime: (time: string) => void;
  setReminderBefore: (alert: string) => void;

  // Form Actions
  openFormForNewTask: () => void;
  openFormForEdit: (event: TimelineEvent) => void;

  // Data filtering
  blocks: RenderBlock[];
  reminders: Reminder[];
  getFilteredBlocks: () => RenderBlock[];
  getFilteredReminders: () => Reminder[];
}

export const useTimelineStore = create<TimelineState>()((set, get) => ({
  taskTitle: 'Nueva Tarea',
  selectedPilar: 'productividad',
  isPilarSelectorOpen: false,
  startTime: '08:30 AM',
  duration: '1h 30m',
  reminderBefore: '5m antes',
  description: '',
  
  reminderTime: '03:15 PM',
  reminderDesc: '',

  isEditingDesc: false,
  isEditingTime: false,
  isEditingDuration: false,
  isEditingAlert: false,
  isEditingAlertReminder: false,
  pickerHour: '08',
  pickerMinute: '30',
  pickerAmPm: 'AM',
  pickerDurationHour: '1h',
  pickerDurationMin: '30m',

  blocks: [],
  reminders: [],

  setPilarSelectorOpen: (open) => set({ isPilarSelectorOpen: open }),
  setSelectedPilar: (pilar) => set({ selectedPilar: pilar }),
  setTaskTitle: (title) => set({ taskTitle: title }),
  setDescription: (desc) => set({ description: desc }),
  setReminderDesc: (desc) => set({ reminderDesc: desc }),
  
  setEditingDesc: (open) => set({ isEditingDesc: open }),
  setEditingTime: (open) => set({ isEditingTime: open }),
  setEditingDuration: (open) => set({ isEditingDuration: open }),
  setEditingAlert: (open) => set({ isEditingAlert: open }),
  setEditingAlertReminder: (open) => set({ isEditingAlertReminder: open }),
  setPickerAmPm: (ampm) => set({ pickerAmPm: ampm }),
  setPickerHour: (hour) => set({ pickerHour: hour }),
  setPickerMinute: (min) => set({ pickerMinute: min }),
  setPickerDurationHour: (hour) => set({ pickerDurationHour: hour }),
  setPickerDurationMin: (min) => set({ pickerDurationMin: min }),
  setStartTime: (time) => set({ startTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setReminderTime: (time) => set({ reminderTime: time }),
  setReminderBefore: (alert) => set({ reminderBefore: alert }),

  // --- FILTRADO DE DATOS PARA RENDERIZADO ---
  getFilteredBlocks: () => {
    const { tasks, selectedDate } = useTaskStore.getState();
    return getFilteredBlocksSelector(tasks, selectedDate);
  },

  getFilteredReminders: () => {
    const { reminders, selectedDate } = useTaskStore.getState();
    return reminders.filter((reminder) => reminder.date === selectedDate);
  },


  openFormForNewTask: () => {
    const { tasks } = useTaskStore.getState();
    const defaultDurationSlots = 12;
    const freeSlot = findFirstFreeSpace(tasks, defaultDurationSlots, 96);
    const timeParts = slotToTimeParts(freeSlot);

    set({
      pickerHour: timeParts.h,
      pickerMinute: timeParts.m,
      pickerAmPm: timeParts.ampm,
      startTime: `${timeParts.h}:${timeParts.m} ${timeParts.ampm}`,
      pickerDurationHour: '1h',
      pickerDurationMin: '00m',
      duration: '1h 00m',
      taskTitle: 'Nueva Tarea',
      description: '',
    });

    // UI state is now in useUIStore
    useUIStore.getState().setEditingEventId(null);
    useUIStore.getState().setFormOpen(true);
  },

  openFormForEdit: (event) => {
    // UI state is now in useUIStore
    // This function only sets form data
    set({
      selectedPilar: event.pilarTipo,
    });

    const editingEventId = event.type === 'task' ? (event.id || event.blockId) : event.id;
    const activeTab = event.type === 'task' ? 'tareas' : 'recordatorios';

    // Set UI state in useUIStore
    useUIStore.getState().setEditingEventId(editingEventId ?? null);
    useUIStore.getState().setActiveTab(activeTab);
    useUIStore.getState().setFormOpen(true);

    if (event.type === 'task') {
      const timeParts = slotToTimeParts(event.slotInicio);
      const durH = slotsToHours(event.duracionSlots);
      const durM = slotsToMinutes(event.duracionSlots) % 60;

      set({
        taskTitle: event.title || 'Nueva Tarea',
        description: event.description || '',
        reminderBefore: '5m antes',
        pickerHour: timeParts.h,
        pickerMinute: timeParts.m,
        pickerAmPm: timeParts.ampm,
        startTime: `${timeParts.h}:${timeParts.m} ${timeParts.ampm}`,
        pickerDurationHour: `${durH}h`,
        pickerDurationMin: `${durM.toString().padStart(2, '0')}m`,
        duration: `${durH}h ${durM.toString().padStart(2, '0')}m`,
      });
    } else {
      const timeParts = slotToTimeParts(event.slot);
      set({
        reminderDesc: event.descripcion || '',
        pickerHour: timeParts.h,
        pickerMinute: timeParts.m,
        pickerAmPm: timeParts.ampm,
        reminderTime: `${timeParts.h}:${timeParts.m} ${timeParts.ampm}`,
      });
    }
  },



}));
