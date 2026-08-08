import { Tasks, Reminder, PilarType, Notification, Config, TipoAlerta, MomentoAlerta } from '../../../types';
import { timeToSlot, durationToSlots, checkAndCalculateOverflow, getLocalDateString, localDateStringToMidnight, slotToTimeParts } from '../../timeline/transformers/timeMath';

export function normalizeNotifications(configs: Config[]): {
  isNotificationEnabled: boolean
  notificationType: TipoAlerta
  notificationToggles: Record<string, boolean>
} {
  const defaults = {
    isNotificationEnabled: false,
    notificationType: 'push' as TipoAlerta,
    notificationToggles: {
      inicio: false,
      fin: false,
      antes5: false,
      antes10: false,
      antes15: false,
      antes30: false,
    },
  }

  if (!configs || configs.length === 0) return defaults

  const activeConfigs = configs.filter(c => c.activo)
  const isEnabled = activeConfigs.length > 0
  const notificationType = configs[0].tipoAlerta ?? 'push'

  const toggles = { ...defaults.notificationToggles }
  for (const config of configs) {
    if (config.momento === 'inicio') {
      toggles.inicio = config.activo
    }
    if (config.momento === 'fin') {
      toggles.fin = config.activo
    }
    if (config.momento === 'antes') {
      const key = `antes${config.offsetNotif}` as keyof typeof toggles
      if (key in toggles) {
        toggles[key] = config.activo
      }
    }
  }

  return {
    isNotificationEnabled: isEnabled,
    notificationType,
    notificationToggles: toggles,
  }
}

export function normalizeToggleKeys(
  toggles: Record<string, boolean>
): Record<string, boolean> {
  const normalized = {
    inicio: false,
    fin: false,
    antes5: false,
    antes10: false,
    antes15: false,
    antes30: false,
  }

  for (const [key, value] of Object.entries(toggles ?? {})) {
    if (key === 'inicio' || key === 'Al iniciar') normalized.inicio = Boolean(value)
    if (key === 'fin' || key === 'Al terminar') normalized.fin = Boolean(value)
    if (key === 'antes5' || key === '5m antes') normalized.antes5 = Boolean(value)
    if (key === 'antes10' || key === '10m antes') normalized.antes10 = Boolean(value)
    if (key === 'antes15' || key === '15m antes') normalized.antes15 = Boolean(value)
    if (key === 'antes30' || key === '30m antes') normalized.antes30 = Boolean(value)
  }

  return normalized
}

export function buildNotifPillLabel(
  enabled: boolean,
  configs: Config[]
): string {
  if (!enabled || configs.length === 0) return 'Sin alertas'

  const parts: string[] = []
  for (const c of configs) {
    if (!c.activo) continue
    if (c.momento === 'inicio') parts.push('Al iniciar')
    if (c.momento === 'fin') parts.push('Al terminar')
    if (c.momento === 'antes') parts.push(`${c.offsetNotif}m antes`)
  }

  if (parts.length === 0) return 'Sin alertas'
  if (parts.length === 1) return parts[0]
  return `${parts.length} alertas`
}

/**
 * Convierte un slot (0-287) a timestamp ISO 8601
 * Compatible con Google Calendar y terceros
 * Incluye offset de zona horaria explícito (GMT/UTC)
 */
const slotToISO = (slot: number, date: string): string => {
  const { h, m, ampm } = slotToTimeParts(slot);
  let hours = parseInt(h, 10);
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  const minutes = parseInt(m, 10);
  
  const dateObj = localDateStringToMidnight(date);
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

export type RawTaskForm = {
  pickerHour: string;
  pickerMinute: string;
  pickerAmPm: 'AM' | 'PM';
  pickerDurationHour: string;
  pickerDurationMin: string;
  selectedPilar: PilarType;
  taskTitle: string;
  description: string | null;
  editingEventId?: string | null; // optional, present when editing
  parentId?: string | null;
  fechaLocal?: string | null;
  existingConfigs?: Config[];
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
  existingConfigs?: Config[];
  // Notification fields
  isNotificationEnabled: boolean;
  notificationType: TipoAlerta;
  notificationToggles: Record<string, boolean>;
};

/**
 * Convierte el estado de notificaciones del formulario a un array de configuraciones independientes.
 * Cada pastilla activa genera un Config distinto.
 * @param enabled - Si el slider de notificaciones está activado
 * @param tipoAlerta - Tipo de alerta ('push' | 'alarma')
 * @param toggles - Estado de las pastillas de notificación
 * @returns Array de Config o array vacío si notificaciones están desactivadas
 */
export const formToNotification = (
  enabled: boolean,
  tipoAlerta: TipoAlerta,
  toggles: Record<string, boolean>,
  existingConfigs?: Config[]
): Notification => {
  if (!enabled) return []

  const normalizedToggles = normalizeToggleKeys(toggles)
  const configs: Config[] = []

  const existingMap = new Map<string, string | null>()
  if (existingConfigs) {
    for (const c of existingConfigs) {
      const key = c.momento === 'antes'
        ? `antes_${c.offsetNotif}`
        : c.momento
      existingMap.set(key, c.osID)
    }
  }

  const addConfig = (momento: MomentoAlerta, offsetNotif: number) => {
    const key = momento === 'antes' ? `antes_${offsetNotif}` : momento
    configs.push({
      id: null,
      activo: true,
      tipoAlerta,
      momento,
      offsetNotif: momento === 'antes' ? offsetNotif : 0,
      osID: existingMap.get(key) ?? null,
    })
  }

  if (normalizedToggles.inicio) addConfig('inicio', 0)
  if (normalizedToggles.fin) addConfig('fin', 0)
  if (normalizedToggles.antes5) addConfig('antes', 5)
  if (normalizedToggles.antes10) addConfig('antes', 10)
  if (normalizedToggles.antes15) addConfig('antes', 15)
  if (normalizedToggles.antes30) addConfig('antes', 30)

  return configs
};

export const formToTask = (form: RawTaskForm): Tasks => {
  const slotInicio = timeToSlot(form.pickerHour, form.pickerMinute, form.pickerAmPm);
  const duracionSlots = durationToSlots(form.pickerDurationHour, form.pickerDurationMin);
  const date = form.fechaLocal ?? getLocalDateString();

  const id = form.editingEventId || `temp-${Date.now()}`;

  // Verificar si la tarea cruza medianoche (solo past12, sin guardar overflow)
  const overflowResult = checkAndCalculateOverflow(slotInicio, duracionSlots, date);

  // Convertir notificaciones del formulario a Notification[]
  const recordatorio = formToNotification(
    form.isNotificationEnabled,
    form.notificationType,
    form.notificationToggles,
    form.existingConfigs
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

    // Overflow Date - Explicitly clean up overflow fields when overflow is false
    overflowDate: overflowResult.past12 ? overflowResult.overflowDate : undefined,
    overflowSlots: overflowResult.past12 ? overflowResult.overflowSlots : undefined,

    // Details
    title: form.taskTitle,
    description: form.description ?? '',
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
    form.notificationToggles,
    form.existingConfigs
  );

  return {
    id,
    slot,
    descripcion: form.reminderDesc,
    pilarTipo: form.selectedPilar,
    date: form.fechaLocal ?? getLocalDateString(),
    recordatorio,
    // Sync - Campos para control de sincronización
    version: null,
    deleted: null,
    syncPending: null,
  };
};
