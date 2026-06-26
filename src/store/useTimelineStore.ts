import { create } from 'zustand';
import { PilarType } from '../types';
import { timeToSlot, durationToSlots, slotToTimeParts, findFirstFreeSpace, checkCollision } from '../features/timeline/transformers/timeMath';

export interface BlockItem {
  blockId: string;
  slotInicio: number;
  duracionSlots: number;
  pilarTipo: PilarType;
  title: string;
  description: string;
  reminderBefore?: string;
}

export interface ReminderItem {
  id: string;
  slot: number;
  descripcion: string;
  pilarTipo: PilarType;
  timeLabel: string;
}

interface TimelineState {
  // --- Listas de datos ---
  blocks: BlockItem[];
  reminders: ReminderItem[];
  
  // --- Estados de la UI ---
  isFormOpen: boolean;
  activeTab: 'tareas' | 'recordatorios';
  isEditMode: boolean;
  expandedBlockId: string | null;
  editingEventId: string | null;
  
  // --- Estados del Formulario (Tarea) ---
  taskTitle: string;
  selectedPilar: PilarType;
  isPilarSelectorOpen: boolean;
  startTime: string;
  duration: string;
  reminderBefore: string;
  description: string;
  
  // --- Estados del Formulario (Recordatorio) ---
  reminderTime: string;
  reminderDesc: string;
  
  // --- Editores internos ---
  isEditingDesc: boolean;
  isEditingTime: boolean;
  isEditingDuration: boolean;
  isEditingAlert: boolean;
  
  // --- Ruedas de Selección (Pickers) ---
  pickerHour: string;
  pickerMinute: string;
  pickerAmPm: 'AM' | 'PM';
  pickerDurationHour: string;
  pickerDurationMin: string;

  // --- Acciones de la UI ---
  setFormOpen: (open: boolean) => void;
  setActiveTab: (tab: 'tareas' | 'recordatorios') => void;
  setEditMode: (editMode: boolean) => void;
  setExpandedBlockId: (id: string | null) => void;
  setPilarSelectorOpen: (open: boolean) => void;
  setSelectedPilar: (pilar: PilarType) => void;
  setTaskTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setReminderDesc: (desc: string) => void;
  
  // --- Controladores de overlays ---
  setEditingDesc: (open: boolean) => void;
  setEditingTime: (open: boolean) => void;
  setEditingDuration: (open: boolean) => void;
  setEditingAlert: (open: boolean) => void;
  
  // --- Controladores de Ruedas ---
  setPickerAmPm: (ampm: 'AM' | 'PM') => void;
  setPickerHour: (hour: string) => void;
  setPickerMinute: (min: string) => void;
  setPickerDurationHour: (hour: string) => void;
  setPickerDurationMin: (min: string) => void;
  setStartTime: (time: string) => void;
  setDuration: (duration: string) => void;
  setReminderTime: (time: string) => void;
  setReminderBefore: (alert: string) => void;

  // --- Operaciones de Negocio (CRUD) ---
  openFormForNewTask: () => void;
  openFormForEdit: (event: any) => void;
  saveTask: () => boolean; // Devuelve false si hay colisión
  saveReminder: () => void;
  deleteEvent: (id: string, type: 'task' | 'reminder') => void;
}

const mockBlocks: BlockItem[] = [
  { blockId: '1', slotInicio: 84, duracionSlots: 18, pilarTipo: 'cuerpo', title: 'Cuerpo y flojera', description: 'Ejercicio cardiovascular y estiramientos' },
  { blockId: '2', slotInicio: 108, duracionSlots: 30, pilarTipo: 'productividad', title: 'Laburar', description: 'Sesión de trabajo sin interrupciones' },
  { blockId: '3', slotInicio: 252, duracionSlots: 24, pilarTipo: 'personal', title: 'Bloque vida personal', description: 'Tiempo de lectura y reflexión' },
];

export const useTimelineStore = create<TimelineState>((set, get) => ({
  blocks: mockBlocks,
  reminders: [],
  isFormOpen: false,
  activeTab: 'tareas',
  isEditMode: false,
  expandedBlockId: null,
  editingEventId: null,
  
  taskTitle: 'Nueva Tarea',
  selectedPilar: 'productividad',
  isPilarSelectorOpen: false,
  startTime: '08:30',
  duration: '1h 30m',
  reminderBefore: '5m',
  description: '',
  
  reminderTime: '15:15',
  reminderDesc: '',
  
  isEditingDesc: false,
  isEditingTime: false,
  isEditingDuration: false,
  isEditingAlert: false,
  
  pickerHour: '08',
  pickerMinute: '30',
  pickerAmPm: 'AM',
  pickerDurationHour: '1h',
  pickerDurationMin: '30m',

  setFormOpen: (open) => set({ isFormOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setEditMode: (editMode) => set({ isEditMode: editMode }),
  setExpandedBlockId: (id) => set({ expandedBlockId: id }),
  setPilarSelectorOpen: (open) => set({ isPilarSelectorOpen: open }),
  setSelectedPilar: (pilar) => set({ selectedPilar: pilar }),
  setTaskTitle: (title) => set({ taskTitle: title }),
  setDescription: (desc) => set({ description: desc }),
  setReminderDesc: (desc) => set({ reminderDesc: desc }),
  
  setEditingDesc: (open) => set({ isEditingDesc: open }),
  setEditingTime: (open) => set({ isEditingTime: open }),
  setEditingDuration: (open) => set({ isEditingDuration: open }),
  setEditingAlert: (open) => set({ isEditingAlert: open }),
  
  setPickerAmPm: (ampm) => set({ pickerAmPm: ampm }),
  setPickerHour: (hour) => set({ pickerHour: hour }),
  setPickerMinute: (min) => set({ pickerMinute: min }),
  setPickerDurationHour: (hour) => set({ pickerDurationHour: hour }),
  setPickerDurationMin: (min) => set({ pickerDurationMin: min }),
  setStartTime: (time) => set({ startTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setReminderTime: (time) => set({ reminderTime: time }),
  setReminderBefore: (alert) => set({ reminderBefore: alert }),

  openFormForNewTask: () => {
    const { blocks } = get();
    const defaultDurationSlots = 12; // 1 hora
    const freeSlot = findFirstFreeSpace(blocks, defaultDurationSlots, 96); // Empezando a las 08:00 AM
    const timeParts = slotToTimeParts(freeSlot);
    
    set({
      pickerHour: timeParts.h,
      pickerMinute: timeParts.m,
      pickerAmPm: timeParts.ampm,
      startTime: `${timeParts.h}:${timeParts.m} ${timeParts.ampm}`,
      pickerDurationHour: '1h',
      pickerDurationMin: '00m',
      duration: '1h 00m',
      editingEventId: null,
      taskTitle: 'Nueva Tarea',
      description: '',
      isFormOpen: true,
    });
  },

  openFormForEdit: (event) => {
    set({
      editingEventId: event.type === 'task' ? event.blockId : event.id,
      activeTab: event.type === 'task' ? 'tareas' : 'recordatorios',
      selectedPilar: event.pilarTipo,
      isEditMode: false,
    });

    if (event.type === 'task') {
      const timeParts = slotToTimeParts(event.slotInicio);
      const durH = Math.floor((event.duracionSlots * 5) / 60);
      const durM = (event.duracionSlots * 5) % 60;

      set({
        taskTitle: event.title || 'Nueva Tarea',
        description: event.description || '',
        reminderBefore: event.reminderBefore || '5m',
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
    set({ isFormOpen: true });
  },

  saveTask: () => {
    const { pickerHour, pickerMinute, pickerAmPm, pickerDurationHour, pickerDurationMin, selectedPilar, taskTitle, description, reminderBefore, editingEventId, blocks } = get();
    
    const liveSlotInicio = timeToSlot(pickerHour, pickerMinute, pickerAmPm);
    const liveDuracionSlots = durationToSlots(pickerDurationHour, pickerDurationMin);
    
    const activeBlocksForCollision = blocks.filter(b => b.blockId !== editingEventId);
    const isColliding = checkCollision(liveSlotInicio, liveDuracionSlots, activeBlocksForCollision);

    if (isColliding) {
      return false; // Retornar falso para que la UI dispare la alerta
    }

    const newBlock: BlockItem = {
      blockId: editingEventId || Date.now().toString(),
      slotInicio: liveSlotInicio,
      duracionSlots: liveDuracionSlots,
      pilarTipo: selectedPilar,
      title: taskTitle,
      description: description,
      reminderBefore: reminderBefore,
    };

    if (editingEventId) {
      set({ blocks: blocks.map(b => b.blockId === editingEventId ? newBlock : b), isFormOpen: false, editingEventId: null });
    } else {
      set({ blocks: [...blocks, newBlock], isFormOpen: false, editingEventId: null });
    }
    return true;
  },

  saveReminder: () => {
    const { pickerHour, pickerMinute, pickerAmPm, reminderDesc, selectedPilar, editingEventId, reminders } = get();
    
    const newReminder: ReminderItem = {
      id: editingEventId || Date.now().toString(),
      slot: timeToSlot(pickerHour, pickerMinute, pickerAmPm),
      descripcion: reminderDesc,
      pilarTipo: selectedPilar,
      timeLabel: `${pickerHour}:${pickerMinute} ${pickerAmPm}`,
    };

    if (editingEventId) {
      set({ reminders: reminders.map(r => r.id === editingEventId ? newReminder : r), isFormOpen: false, editingEventId: null });
    } else {
      set({ reminders: [...reminders, newReminder], isFormOpen: false, editingEventId: null });
    }
  },

  deleteEvent: (id, type) => {
    const { blocks, reminders } = get();
    if (type === 'task') {
      set({ blocks: blocks.filter(b => b.blockId !== id) });
    } else {
      set({ reminders: reminders.filter(r => r.id !== id) });
    }
  }
}));