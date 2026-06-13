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
// 5. MODELOS DE BASE DE DATOS (DTOs - Lo que viaja a Supabase)
// ════════════════════════════════════════════════════════════════════════════

export type TaskDTO = {
  id: string;
  pilarId: string;
  titulo: string;
  descripcion: string | null;
  startTime: string | null; // ISO 8601 (ej. "2026-06-08T10:00:00Z")
  endTime: string | null;   // ISO 8601
  status: ExecutionStatus;  // Reemplaza al antiguo 'completada'
  recursos: Recurso[];
  projectId?: string | null;      // Siempre un array, vacío por defecto
  recordatorio?: NotificationConfig; 
  
  // Telemetría de Realidad (Para entrenar a la IA)
  actualStartTime?: string | null; 
  actualEndTime?: string | null;   
  rescheduleCount: number;  // Cuántas veces se pospuso
};

export type StaticReminderDTO = {
  id: string;
  time: string;             // ISO 8601
  descripcion: string;
  recordatorio?: NotificationConfig; 
};

// ════════════════════════════════════════════════════════════════════════════
// 6. VIEW MODELS (Lo que usa el Motor Gráfico M1 y la UI)
// ════════════════════════════════════════════════════════════════════════════

export type TaskBlock = {
  id: string;                // Mismo ID que TaskDTO
  parentId: string | null;   // null = original, "id" = fragmento post-medianoche
  slotInicio: number;        // 0–287 (0 = 00:00, 287 = 23:55)
  duracionSlots: number;     
  slotFin: number;           // slotInicio + duracionSlots
  pilarTipo: PilarType;      // Para mapear el color rápido en UI
  status: ExecutionStatus;   // Para cambiar el color si está 'unverified'
  fechaLocal: string;        // "YYYY-MM-DD" para agrupar en la UI
  continuaManiana: boolean;  
};

export type ReminderPoint = {
  id: string;
  slot: number;              // 0-287 (Punto exacto, sin duración)
  descripcion: string;
};

export type TaskDetail = {
  id: string;
  titulo: string;
  descripcion: string | null;
  recursos: Recurso[];
  recordatorio?: NotificationConfig;
  projectId?: string | null;
};

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
  | ({ tipoElemento: 'taskBlock' } & TaskBlock)
  | ({ tipoElemento: 'reminderPoint' } & ReminderPoint)
  | ({ tipoElemento: 'aiSuggestion' } & AISuggestionBlock);

// Para la lista inferior (M2) - Textos, checkboxes y configuraciones
export type ManagerItem = 
  | ({ tipoItem: 'task' } & TaskDetail)
  | ({ tipoItem: 'staticReminder' } & StaticReminderDTO);

// Para el Modal de Edición (Cuando tocas un elemento en la gráfica)
export type TaskUI = {
  block: TaskBlock;
  detail: TaskDetail;
};