import { create } from 'zustand';

interface UIState {
  // UI States
  isFormOpen: boolean;
  activeTab: 'tareas' | 'recordatorios';
  isEditMode: boolean;
  expandedBlockId: string | null;
  editingEventId: string | null;

  // Actions
  setFormOpen: (open: boolean) => void;
  setActiveTab: (tab: 'tareas' | 'recordatorios') => void;
  setEditMode: (editMode: boolean) => void;
  setExpandedBlockId: (id: string | null) => void;
  setEditingEventId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isFormOpen: false,
  activeTab: 'tareas',
  isEditMode: false,
  expandedBlockId: null,
  editingEventId: null,

  setFormOpen: (open) => set((state) => ({ isFormOpen: open, editingEventId: open ? state.editingEventId : null })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setEditMode: (editMode) => set({ isEditMode: editMode }),
  setExpandedBlockId: (id) => set({ expandedBlockId: id }),
  setEditingEventId: (id) => set({ editingEventId: id }),
}));
