import { Tasks, Reminder, PilarType, Notification, Config, TipoAlerta, MomentoAlerta } from '../../../types';
import { timeToSlot, durationToSlots, checkAndCalculateOverflow } from '../../timeline/transformers/timeMath';

/**
 * Convierte un slot (0-287) a timestamp ISO 8601
 * Compatible con Google Calendar y terceros
 * Incluye offset de zona horaria explícito (GMT/UTC)
 */
const slotToISO = (slot: number, date: string): string => {
  const totalMinutes = slot * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const dateObj = new Date(date);
  dateObj.setHours(hours, minutes, 0, 0);
  
  // Obtener offset de zona horaria en formato ±HH:MM
  const offsetMinutes = dateObj.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
  const offsetMins = Math.abs(offsetMinutes % 60);
  const offsetSign = offsetMinutes <= 0 ? '+' : '-';
  const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMins.toString().padStart(2, '0')}`;
  
  // Construir ISO con offset explícito
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  const hour = dateObj.getHours().toString().padStart(2, '0');
  const min = dateObj.getMinutes().toString().padStart(2, '0');
  const sec = dateObj.getSeconds().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${min}:${sec}${offsetString}`;
};

const createTaskId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export type RawTaskForm = {
  pickerHour: string;
  pickerMinute: string;
  pickerAmPm: 'AM' | 'PM';
  pickerDurationHour: string;
  pickerDurationMin: string;
  selectedPilar: PilarType;
  taskTitle: string;
  description: string | null;
  reminderBefore: string;
  editingEventId?: string | null; // optional, present when editing
  parentId?: string | null;
  fechaLocal?: string | null;
  // Notification fields
  isNotificationEnabled: boolean;
  notificationType: TipoAlerta;
  notificationToggles: Record<string, boolean>;
};

export type RawReminderForm = {
  pickerHour: string;
  pickerMinute: string;
  pickerAmPm: 'AM' | 'PM';
  selectedPilar: PilarType;
  reminderDesc: string;
  editingEventId?: string | null;
  fechaLocal?: string | null;
  // Notification fields
  isNotificationEnabled: boolean;
  notificationType: TipoAlerta;
  notificationToggles: Record<string, boolean>;
};

/**
 * Convierte el estado de notificaciones del formulario a Notification[]
 * @param enabled - Si el slider de notificaciones está activado
 * @param tipoAlerta - Tipo de alerta ('push' | 'alarma')
 * @param toggles - Estado de las pastillas de notificación
 * @returns Array de Config o array vacío si notificaciones están desactivadas
 */
export const formToNotification = (
  enabled: boolean,
  tipoAlerta: TipoAlerta,
  toggles: Record<string, boolean>
): Notification => {
  if (!enabled) {
    return [];
  }

  const configs: Config[] = [];

  // Mapeo de pastillas a configuración
  const toggleMapping: Record<string, { momento: MomentoAlerta; offsetNotif: number }> = {
    'Al iniciar': { momento: 'inicio', offsetNotif: 0 },
    'Al terminar': { momento: 'fin', offsetNotif: 0 },
    '5m antes': { momento: 'antes', offsetNotif: 5 },
    '10m antes': { momento: 'antes', offsetNotif: 10 },
    '15m antes': { momento: 'antes', offsetNotif: 15 },
    '30m antes': { momento: 'antes', offsetNotif: 30 },
  };

  // Crear Config para cada pastilla activa
  for (const [toggleKey, isActive] of Object.entries(toggles)) {
    if (isActive && toggleMapping[toggleKey]) {
      const { momento, offsetNotif } = toggleMapping[toggleKey];
      configs.push({
        id: null,
        activo: true,
        tipoAlerta,
        momento,
        offsetNotif,
        osID: null,
      });
    }
  }

  return configs;
};

export const formToTask = (form: RawTaskForm): Tasks => {
  const slotInicio = timeToSlot(form.pickerHour, form.pickerMinute, form.pickerAmPm);
  const duracionSlots = durationToSlots(form.pickerDurationHour, form.pickerDurationMin);
  const date = form.fechaLocal ?? new Date().toISOString().slice(0, 10);

  const id = form.editingEventId || `temp-${Date.now()}`;

  // Verificar si la tarea cruza medianoche (solo past12, sin guardar overflow)
  const overflowResult = checkAndCalculateOverflow(slotInicio, duracionSlots, date);

  // Convertir notificaciones del formulario a Notification[]
  const recordatorio = formToNotification(
    form.isNotificationEnabled,
    form.notificationType,
    form.notificationToggles
  );

  return {
    // General
    id,
    blockId: id,
    date,

    // View
    slotInicio,
    duracionSlots,
    slotFin: slotInicio + duracionSlots,
    pilarTipo: form.selectedPilar,
    status: 'planned',
    past12: overflowResult.past12,

    // Overflow Date - No guardamos overflowDate/overflowSlots, se calculan en renderizado
    overflowDate: undefined,
    overflowSlots: undefined,

    // Details
    title: form.taskTitle,
    description: form.description ?? '',
    reminderBefore: form.reminderBefore,
    resources: null,
    projectId: null,
    tags: null,
    priority: 'medium',
    isCompleted: false,

    recordatorio,

    // Supabase - Calculados con formato ISO compatible con Google Calendar
    startTime: slotToISO(slotInicio, date),
    endTime: slotToISO(slotInicio + duracionSlots, date),

    // Sync - Campos para control de sincronización
    version: null,
    deleted: null,
    syncPending: null,

    // Telemetría de Realidad - Valores default para evitar errores
    actualStartTime: null,
    actualEndTime: null,
    rescheduleCount: null,
  };
};

export const formToReminder = (form: RawReminderForm): Reminder => {
  const slot = timeToSlot(form.pickerHour, form.pickerMinute, form.pickerAmPm);
  const id = form.editingEventId || `temp-${Date.now()}`;

  // Convertir notificaciones del formulario a Notification[]
  const recordatorio = formToNotification(
    form.isNotificationEnabled,
    form.notificationType,
    form.notificationToggles
  );

  return {
    id,
    slot,
    descripcion: form.reminderDesc,
    pilarTipo: form.selectedPilar,
    date: form.fechaLocal ?? new Date().toISOString().slice(0, 10),
    recordatorio,
    // Sync - Campos para control de sincronización
    version: null,
    deleted: null,
    syncPending: null,
  };
};
