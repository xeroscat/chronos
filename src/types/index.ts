// src/types/index.ts

// ════════════════════════════════════════════════════════════════════════════
// 1. PILARES Y CONFIGURACIÓN BASE
// ════════════════════════════════════════════════════════════════════════════

export type PilarType = 'cuerpo' | 'mente' | 'productividad' | 'personal';

export type Pilar = {
  id: string; // UUID de Supabase
  tipo: PilarType;
  colorHex: string;
};

// ════════════════════════════════════════════════════════════════════════════
// 2. MOTOR DE NOTIFICACIONES Y ALERTAS
// ════════════════════════════════════════════════════════════════════════════


export type TipoAlerta = 'push' | 'alarma';

export type NotificationConfig = {
  activo: boolean;
  tipoAlerta: TipoAlerta;
  minutosAntes: number;     // 0 = a la hora exacta, 15 = 15 min antes
  notificacionId?: string;  // ID del OS (Expo) para cancelar/reprogramar
};

// ════════════════════════════════════════════════════════════════════════════
// 3. RECURSOS ADJUNTOS (Uniones Discriminadas)
// ════════════════════════════════════════════════════════════════════════════

export type RecursoBase = {
  id: string;
  nombre: string;
  taskId: string;
};

export type RecursoChecklist = RecursoBase & {
  tipo: 'checklist';
  checklistItems: { id: string; texto: string; completado: boolean }[];
};

export type RecursoArchivo = RecursoBase & {
  tipo: 'archivo' | 'link';
  url: string;
};

export type RecursoNota = RecursoBase & {
  tipo: 'nota';
  texto: string;
};

export type Recurso = RecursoChecklist | RecursoArchivo | RecursoNota;

// ════════════════════════════════════════════════════════════════════════════
// 4. ESTADO DE EJECUCIÓN Y TELEMETRÍA (Para la IA)
// ════════════════════════════════════════════════════════════════════════════

export type ExecutionStatus = 
  | 'planned'     // En el futuro
  | 'active'      // El usuario le dio "Empezar"
  | 'completed'   // Terminado con éxito
  | 'skipped'     // El usuario decidió no hacerlo (Swipe left)
  | 'unverified'; // El tiempo pasó y el usuario no interactuó (Línea de tiempo lo cruzó)

// ════════════════════════════════════════════════════════════════════════════
// 7. ESTRUCTURAS DE LA IA (Fase 2 - Preparación)
// ════════════════════════════════════════════════════════════════════════════

export type DailyMetricDTO = {
  id: string;
  userId: string;
  date: string;               
  minutesPlannedPerPilar: Record<PilarType, number>;
  minutesCompletedPerPilar: Record<PilarType, number>;
  adherenceScore: number;     // 0.0 a 1.0
  missedTasksIds: string[];   
};

export type AISuggestionBlock = {
  id: string;
  suggestedSlotInicio: number;
  suggestedDuracionSlots: number;
  pilarSugerido: PilarType;
  motivo: string; 
  estado: 'pending' | 'accepted' | 'rejected';
};

// ════════════════════════════════════════════════════════════════════════════
// 8. TIPOS MAESTROS DE RENDERIZADO (Uniones para las Vistas)
// ════════════════════════════════════════════════════════════════════════════

// Para el Timeline 24h (M1) - Solo geometría, colores y estados visuales
export type TimelineElement =
  | ({ tipoElemento: 'task' } & Tasks)
  | ({ tipoElemento: 'reminderPoint' } & Reminder)
  | ({ tipoElemento: 'aiSuggestion' } & AISuggestionBlock);

// Para la lista inferior (M2) - Textos, checkboxes y configuraciones
export type ManagerItem =
  | ({ tipoItem: 'task' } & Tasks)
  | ({ tipoItem: 'staticReminder' } & Reminder);

// Para el Modal de Edición (Cuando tocas un elemento en la gráfica)
export type TaskUI = Tasks;

// ════════════════════════════════════════════════════════════════════════════
// 9. TIPO COMPUESTO PARA EL STORE (Tasks)
// ════════════════════════════════════════════════════════════════════════════

// Tipo completo consolidado
export type Tasks = {
  // General
  id: string;
  blockId: string; // legacy fallback
  date: string; // ISO date string (YYYY-MM-DD)

  // View
  slotInicio: number; // 0–287 (0 = 00:00, 287 = 23:55)
  duracionSlots: number;
  slotFin?: number; // slotInicio + duracionSlots (calculado)
  pilarTipo: PilarType;
  status: string|null; // Motor de seguimiento
  past12: boolean|null; // Division de tareas

  // Overflow Date
  overflowDate?: string  // '2025-07-13' — solo si endTime > 1440
  overflowSlots?: number

  // Details
  title: string;
  description: string;
  reminderBefore?: string;
  resources: string[]|null; // Motor de recursos externos
  projectId: string | null;
  tags: string[]|null; // Motor proximo a añadir
  priority: string; // Motor de seguimiento
  isCompleted: boolean; // Motor de seguimiento

  //Supabase
  startTime: string| null; //ISO
  endTime: string|null; //ISO
  version: string|null;
  deleted: boolean|null;
  syncPending: boolean|null;

  // Telemetría de Realidad (Para entrenar a la IA)
  actualStartTime?: string | null; 
  actualEndTime?: string | null;   
  rescheduleCount: number|null;  // Cuántas veces se pospuso
};

//Recordatorio unificado

export type Reminder = {
  id: string;
  slot: number;
  descripcion: string;
  pilarTipo: PilarType;
  recordatorio?: NotificationConfig;
  //SP
  date: string; // ISO date string (YYYY-MM-DD) for filtering
  version: string|null;
  deleted: boolean|null;
  syncPending: boolean|null;
};