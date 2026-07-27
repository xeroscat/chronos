export type LocalSyncEntityType = 'task' | 'reminder' | 'delete';

export interface LocalSyncSnapshot {
  tasks: Array<unknown>;
  reminders: Array<unknown>;
}

export interface LocalSyncChange {
  id: string;
  entityType: LocalSyncEntityType;
  entityId: string;
  changeType: 'create' | 'update' | 'delete';
  createdAt: number;
  payload?: Record<string, unknown>;
}

interface LocalSyncState {
  pendingChanges: LocalSyncChange[];
  lastSyncedSignature: string | null;
  lastKnownSignature: string | null;
}

const createSignature = (snapshot: LocalSyncSnapshot): string => {
  return JSON.stringify({
    tasks: snapshot.tasks,
    reminders: snapshot.reminders,
  });
};

const syncState: LocalSyncState = {
  pendingChanges: [],
  lastSyncedSignature: null,
  lastKnownSignature: null,
};

export const localSyncGate = {
  // Este es el punto de entrada local para cualquier cambio reciente.
  // La idea es que cada mutación de la store llegue aquí primero, para que
  // luego podamos decidir si hay diferencias que enviar cuando la sincronización
  // remota esté disponible.
  registerLocalChange: (
    change: Omit<LocalSyncChange, 'id' | 'createdAt'>,
    snapshot: LocalSyncSnapshot,
  ) => {
    const signature = createSignature(snapshot);
    const nextChange: LocalSyncChange = {
      ...change,
      id: `${change.entityType}:${change.entityId}:${Date.now()}`,
      createdAt: Date.now(),
    };

    // Mantener un único cambio pendiente por entidad para evitar duplicados.
    const pendingWithoutSameEntity = syncState.pendingChanges.filter(
      (item) => !(item.entityType === change.entityType && item.entityId === change.entityId),
    );

    syncState.pendingChanges = [...pendingWithoutSameEntity, nextChange];
    syncState.lastKnownSignature = signature;

    return {
      pendingChanges: [...syncState.pendingChanges],
      hasPendingChanges: syncState.pendingChanges.length > 0,
      needsSync: syncState.lastSyncedSignature !== signature,
    };
  },

  // Compara el estado local actual contra la última copia que se consideró sincronizada.
  // Si son distintos, significa que hay trabajo pendiente por enviar.
  compareWithLastSynced: (snapshot: LocalSyncSnapshot) => {
    const signature = createSignature(snapshot);
    const needsSync = syncState.lastSyncedSignature !== signature;

    syncState.lastKnownSignature = signature;

    return {
      needsSync,
      signature,
      lastSyncedSignature: syncState.lastSyncedSignature,
      pendingChanges: [...syncState.pendingChanges],
    };
  },

  // Marca el estado actual como sincronizado y limpia la cola de cambios pendientes.
  // Se invoca cuando la sincronización remota haya terminado con éxito.
  markSynced: (snapshot: LocalSyncSnapshot) => {
    const signature = createSignature(snapshot);
    syncState.lastSyncedSignature = signature;
    syncState.lastKnownSignature = signature;
    syncState.pendingChanges = [];

    return { synced: true, signature };
  },

  getPendingChanges: () => {
    return [...syncState.pendingChanges];
  },

  hasPendingChanges: () => {
    return syncState.pendingChanges.length > 0;
  },

  reset: () => {
    syncState.pendingChanges = [];
    syncState.lastSyncedSignature = null;
    syncState.lastKnownSignature = null;
  },
};
