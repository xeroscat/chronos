import { create } from 'zustand';
import { PilarType } from '../types';
import { supabase } from '../core/supabase';
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
  blocks: BlockItem[];
  reminders: ReminderItem[];
  isLoading: boolean;
  
  // UI States
  isFormOpen: boolean;
  activeTab: 'tareas' | 'recordatorios';
  isEditMode: boolean;
  expandedBlockId: string | null;
  editingEventId: string | null;
  
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
  
  // Pickers
  pickerHour: string;
  pickerMinute: string;
  pickerAmPm: 'AM' | 'PM';
  pickerDurationHour: string;
  pickerDurationMin: string;

  // Actions
  setFormOpen: (open: boolean) => void;
  setActiveTab: (tab: 'tareas' | 'recordatorios') => void;
  setEditMode: (editMode: boolean) => void;
  setExpandedBlockId: (id: string | null) => void;
  setPilarSelectorOpen: (open: boolean) => void;
  setSelectedPilar: (pilar: PilarType) => void;
  setTaskTitle: (title: string) => void;
  setDescription: (desc: string) => void;
  setReminderDesc: (desc: string) => void;
  
  setEditingDesc: (open: boolean) => void;
  setEditingTime: (open: boolean) => void;
  setEditingDuration: (open: boolean) => void;
  setEditingAlert: (open: boolean) => void;
  
  setPickerAmPm: (ampm: 'AM' | 'PM') => void;
  setPickerHour: (hour: string) => void;
  setPickerMinute: (min: string) => void;
  setPickerDurationHour: (hour: string) => void;
  setPickerDurationMin: (min: string) => void;
  setStartTime: (time: string) => void;
  setDuration: (duration: string) => void;
  setReminderTime: (time: string) => void;
  setReminderBefore: (alert: string) => void;

  // Supabase CRUD Operations
  fetchData: (silent?: boolean) => Promise<void>;
  openFormForNewTask: () => void;
  openFormForEdit: (event: any) => void;
  saveTask: () => Promise<boolean>; // Devuelve false si hay colisión o error
  saveReminder: () => Promise<void>;
  deleteEvent: (id: string, type: 'task' | 'reminder') => Promise<void>;
  clearData: () => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  blocks: [],
  reminders: [],
  isLoading: false,
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
  reminderBefore: '5m antes',
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

  // --- OBTENER DATOS (READ con JOIN Relacional) ---
  fetchData: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Obtener bloques de tiempo enlazados a tareas y pilares
      const { data: rawBlocks, error: blocksError } = await supabase
        .from('time_blocks')
        .select(`
          id,
          slot_inicio,
          duracion_slots,
          pillars (tipo),
          tasks (id, title, description, reminder_before)
        `)
        .eq('user_id', user.id);

      if (blocksError) throw blocksError;

      const mappedBlocks: BlockItem[] = (rawBlocks || []).map((item: any) => ({
        blockId: item.id,
        slotInicio: item.slot_inicio,
        duracionSlots: item.duracion_slots,
        pilarTipo: item.pillars?.tipo as PilarType,
        title: item.tasks?.title || 'Sin Título',
        description: item.tasks?.description || '',
        reminderBefore: item.tasks?.reminder_before || '5m antes',
      }));

      // 2. Obtener Recordatorios Estáticos
      const { data: rawReminders, error: remindersError } = await supabase
        .from('static_reminders')
        .select(`
          id,
          slot,
          description,
          time_label,
          pillars (tipo)
        `)
        .eq('user_id', user.id);

      if (remindersError) throw remindersError;

      const mappedReminders: ReminderItem[] = (rawReminders || []).map((item: any) => ({
        id: item.id,
        slot: item.slot,
        descripcion: item.description,
        pilarTipo: item.pillars?.tipo as PilarType,
        timeLabel: item.time_label,
      }));

      set({ blocks: mappedBlocks, reminders: mappedReminders });
    } catch (error) {
      console.error(' [CHRONOS DB] Error al obtener datos:', error);
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  openFormForNewTask: () => {
    const { blocks } = get();
    const defaultDurationSlots = 12;
    const freeSlot = findFirstFreeSpace(blocks, defaultDurationSlots, 96);
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
        reminderBefore: event.reminderBefore || '5m antes',
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

  // --- GUARDAR TAREA (CREATE & UPDATE transaccional) ---
  saveTask: async () => {
    const { pickerHour, pickerMinute, pickerAmPm, pickerDurationHour, pickerDurationMin, selectedPilar, taskTitle, description, reminderBefore, editingEventId, blocks } = get();
    
    const liveSlotInicio = timeToSlot(pickerHour, pickerMinute, pickerAmPm);
    const liveDuracionSlots = durationToSlots(pickerDurationHour, pickerDurationMin);
    
    const activeBlocksForCollision = blocks.filter(b => b.blockId !== editingEventId);
    const isColliding = checkCollision(liveSlotInicio, liveDuracionSlots, activeBlocksForCollision);

    if (isColliding) return false;

    // --- ACTUALIZACIÓN OPTIMISTA ---
    const optimisticId = editingEventId || `temp-${Date.now()}`;
    const optimisticBlock: BlockItem = {
      blockId: optimisticId,
      slotInicio: liveSlotInicio,
      duracionSlots: liveDuracionSlots,
      pilarTipo: selectedPilar,
      title: taskTitle,
      description: description,
      reminderBefore: reminderBefore
    };

    let newBlocks = [...blocks];
    if (editingEventId) {
      newBlocks = newBlocks.map(b => b.blockId === editingEventId ? optimisticBlock : b);
    } else {
      newBlocks.push(optimisticBlock);
    }

    // Actualizar estado local e inmediatamente cerrar el modal
    set({ blocks: newBlocks, isFormOpen: false, editingEventId: null });

    // --- GUARDADO EN SEGUNDO PLANO ---
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Obtener el id del pilar correspondiente para este usuario
        const { data: pillarData, error: pillarError } = await supabase
          .from('pillars')
          .select('id')
          .eq('user_id', user.id)
          .eq('tipo', selectedPilar)
          .single();

        if (pillarError) throw pillarError;
        const pilarId = pillarData.id;

        if (editingEventId) {
          // --- MODO EDICIÓN ---
          // Obtener el block de tiempo actual para saber cuál es su task_id
          const { data: currentBlock, error: cbError } = await supabase
            .from('time_blocks')
            .select('task_id')
            .eq('id', editingEventId)
            .single();

          if (cbError) throw cbError;

          // Actualizar la metadata en public.tasks
          if (currentBlock.task_id) {
            const { error: tError } = await supabase
              .from('tasks')
              .update({
                title: taskTitle,
                description: description,
                pilar_id: pilarId,
                reminder_before: reminderBefore
              })
              .eq('id', currentBlock.task_id);
            if (tError) throw tError;
          }

          // Actualizar la geometría en public.time_blocks
          const { error: tbError } = await supabase
            .from('time_blocks')
            .update({
              slot_inicio: liveSlotInicio,
              duracion_slots: liveDuracionSlots,
              pilar_id: pilarId
            })
            .eq('id', editingEventId);
          if (tbError) throw tbError;

        } else {
          // --- MODO REGISTRO NUEVO ---
          // Insertar en public.tasks para obtener el id
          const { data: newTask, error: tError } = await supabase
            .from('tasks')
            .insert({
              user_id: user.id,
              pilar_id: pilarId,
              title: taskTitle,
              description: description,
              reminder_before: reminderBefore
            })
            .select('id')
            .single();

          if (tError) throw tError;

          // Insertar en public.time_blocks
          const { error: tbError } = await supabase
            .from('time_blocks')
            .insert({
              user_id: user.id,
              task_id: newTask.id,
              pilar_id: pilarId,
              slot_inicio: liveSlotInicio,
              duracion_slots: liveDuracionSlots
            });

          if (tbError) throw tbError;
        }

        // Volver a sincronizar el frontend de forma limpia
        await get().fetchData(true);
      } catch (error) {
        console.error(' [CHRONOS DB] Error al guardar tarea en background:', error);
        // Si falla el background, revertimos recargando desde DB
        await get().fetchData(true);
      }
    })();

    return true;
  },

  // --- GUARDAR RECORDATORIO (CREATE & UPDATE) ---
  saveReminder: async () => {
    const { pickerHour, pickerMinute, pickerAmPm, reminderDesc, selectedPilar, editingEventId, reminders } = get();
    
    const slotVal = timeToSlot(pickerHour, pickerMinute, pickerAmPm);
    const timeLabelVal = `${pickerHour}:${pickerMinute} ${pickerAmPm}`;

    // --- ACTUALIZACIÓN OPTIMISTA ---
    const optimisticId = editingEventId || `temp-rem-${Date.now()}`;
    const optimisticReminder: ReminderItem = {
      id: optimisticId,
      slot: slotVal,
      descripcion: reminderDesc,
      pilarTipo: selectedPilar,
      timeLabel: timeLabelVal
    };

    let newReminders = [...reminders];
    if (editingEventId) {
      newReminders = newReminders.map(r => r.id === editingEventId ? optimisticReminder : r);
    } else {
      newReminders.push(optimisticReminder);
    }

    set({ reminders: newReminders, isFormOpen: false, editingEventId: null });

    // --- GUARDADO EN SEGUNDO PLANO ---
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: pillarData, error: pillarError } = await supabase
          .from('pillars')
          .select('id')
          .eq('user_id', user.id)
          .eq('tipo', selectedPilar)
          .single();

        if (pillarError) throw pillarError;

        if (editingEventId) {
          const { error } = await supabase
            .from('static_reminders')
            .update({
              slot: slotVal,
              description: reminderDesc,
              pilar_id: pillarData.id,
              time_label: timeLabelVal
            })
            .eq('id', editingEventId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('static_reminders')
            .insert({
              user_id: user.id,
              pilar_id: pillarData.id,
              slot: slotVal,
              description: reminderDesc,
              time_label: timeLabelVal
            });
          if (error) throw error;
        }

        await get().fetchData(true);
      } catch (error) {
        console.error('❌ [CHRONOS DB] Error al guardar recordatorio en background:', error);
        await get().fetchData(true);
      }
    })();
  },

  // --- ELIMINAR (DELETE en cascada por FK) ---
  deleteEvent: async (id, type) => {
    const { blocks, reminders } = get();

    // --- ACTUALIZACIÓN OPTIMISTA ---
    if (type === 'task') {
      set({ blocks: blocks.filter(b => b.blockId !== id) });
    } else {
      set({ reminders: reminders.filter(r => r.id !== id) });
    }

    // --- ELIMINACIÓN EN SEGUNDO PLANO ---
    (async () => {
      try {
        if (type === 'task') {
          // Obtenemos el block para saber cuál es su task_id
          const { data: block, error: bError } = await supabase
            .from('time_blocks')
            .select('task_id')
            .eq('id', id)
            .single();

          if (bError) throw bError;

          // Borrar la tarea principal (por 'on delete cascade', se eliminará automáticamente el time_block)
          if (block.task_id) {
            const { error: tError } = await supabase
              .from('tasks')
              .delete()
              .eq('id', block.task_id);
            if (tError) throw tError;
          }
        } else {
          const { error } = await supabase
            .from('static_reminders')
            .delete()
            .eq('id', id);
          if (error) throw error;
        }

        // Refrescar estado local
        await get().fetchData(true);
      } catch (error) {
        console.error(' [CHRONOS DB] Error al eliminar evento en background:', error);
        await get().fetchData(true);
      }
    })();
  },

  clearData: () => set({ 
    blocks: [], 
    reminders: [], 
    expandedBlockId: null, 
    editingEventId: null, 
    isEditMode: false, 
    isFormOpen: false 
  })
}));
