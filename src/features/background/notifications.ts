//Inicio del notification service
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { Tasks, Config, Notification, Reminder } from '../../types'
import { localDateStringToMidnight, slotsToMinutes } from '../timeline/transformers/timeMath'

// Configure notification handler (must be called before any notification operations)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

//Permisos
export async function bootNotificationService() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return { granted: false, alarmSupported: false }

  let alarmSupported = true

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chronos-push', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    })
    await Notifications.setNotificationChannelAsync('chronos-alarm', {
      name: 'Chronos — alarmas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      sound: 'default',
      bypassDnd: true,   // requiere SCHEDULE_EXACT_ALARM en app.json
    })
    // canScheduleExactNotifications is not available in v56
    // Exact alarm support is determined by SCHEDULE_EXACT_ALARM permission in app.json
  }

  return { granted: true, alarmSupported }
}

// ─── STEP 3: calcularTrigger ─────────────────────────────────────────────────
function calcularTrigger(task: Tasks, config: Config): Date {
  // Build local midnight for the task date
  const base = localDateStringToMidnight(task.date)

  // Add slotInicio in minutes (each slot = 5 minutes)
  const startMs = slotsToMinutes(task.slotInicio ?? 0) * 60 * 1000
  const taskStart = new Date(base.getTime() + startMs)

  if (config.momento === 'inicio') {
    // Exact start time — offsetNotif is ignored
    return taskStart
  }

  if (config.momento === 'antes') {
    // offsetNotif minutes before start
    const offsetMs = (config.offsetNotif ?? 0) * 60 * 1000
    return new Date(taskStart.getTime() - offsetMs)
  }

  if (config.momento === 'fin') {
    // End time = start + duration
    const durationMs = slotsToMinutes(task.duracionSlots ?? 0) * 60 * 1000
    return new Date(taskStart.getTime() + durationMs)
  }

  // Fallback — should never reach here if types are correct
  return taskStart
}

function calcularTriggerReminder(reminder: { date: string; slot: number }, config: Config): Date {
  const base = localDateStringToMidnight(reminder.date)
  const reminderMs = slotsToMinutes(reminder.slot ?? 0) * 60 * 1000
  const reminderAt = new Date(base.getTime() + reminderMs)

  if (config.momento === 'inicio') {
    return reminderAt
  }

  if (config.momento === 'antes') {
    const offsetMs = (config.offsetNotif ?? 0) * 60 * 1000
    return new Date(reminderAt.getTime() - offsetMs)
  }

  // Recordatorios no tienen duración, así que el momento 'fin' cae en la propia hora del recordatorio.
  return reminderAt
}

// ─── STEP 4: buildNotifBody ───────────────────────────────────────────────────
function buildNotifBody(config: Config, task: Tasks): string {
  if (config.momento === 'antes') {
    return `Empieza en ${config.offsetNotif} min`
  }
  if (config.momento === 'inicio') {
    return 'Es hora de empezar'
  }
  if (config.momento === 'fin') {
    return 'Tu bloque terminó'
  }
  return task.title ?? ''
}

function buildReminderNotifBody(config: Config, reminder: { descripcion?: string }): string {
  if (config.momento === 'antes') {
    return `Recordatorio en ${config.offsetNotif} min`
  }
  if (config.momento === 'inicio') {
    return reminder.descripcion || 'Recordatorio'
  }
  if (config.momento === 'fin') {
    return reminder.descripcion || 'Recordatorio'
  }
  return reminder.descripcion || 'Recordatorio'
}

// ─── STEP 5: scheduleAlerta ───────────────────────────────────────────────────
async function scheduleAlerta(
  task: Tasks,
  config: Config,
  alarmSupported: boolean
): Promise<string> {
  const trigger = calcularTrigger(task, config)

  // Do not schedule if trigger is in the past
  if (trigger <= new Date()) return 'PAST'

  // Degrade to push if alarm not supported on this device
  const channelId =
    config.tipoAlerta === 'alarma' && alarmSupported
      ? 'chronos-alarm'
      : 'chronos-push'

  const isAlarm = config.tipoAlerta === 'alarma' && alarmSupported

  const osId = await Notifications.scheduleNotificationAsync({
    content: {
      title: isAlarm 
        ? `⏰ ${task.title ?? 'Chronos'}`
        : task.title ?? 'Chronos',
      body: buildNotifBody(config, task),
      data: { taskId: task.id, configId: config.id },
      sound: isAlarm ? 'default' : true,
      color: isAlarm ? '#E24B4A' : '#378ADD',
      sticky: isAlarm ? false : undefined,
      autoDismiss: isAlarm ? false : undefined,
      priority: isAlarm
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: alarmSupported && config.tipoAlerta === 'alarma'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
          channelId: 'chronos-alarm',
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
          channelId: 'chronos-push',
        },
  })

  return osId
}

async function scheduleReminderAlerta(
  reminder: Reminder,
  config: Config,
  alarmSupported: boolean
): Promise<string> {
  const trigger = calcularTriggerReminder(reminder, config)

  if (trigger <= new Date()) return 'PAST'

  const channelId =
    config.tipoAlerta === 'alarma' && alarmSupported
      ? 'chronos-alarm'
      : 'chronos-push'

  const isAlarm = config.tipoAlerta === 'alarma' && alarmSupported

  const osId = await Notifications.scheduleNotificationAsync({
    content: {
      title: isAlarm ? '⏰ Recordatorio' : 'Recordatorio',
      body: buildReminderNotifBody(config, reminder),
      data: { reminderId: reminder.id, configId: config.id },
      sound: true,
      color: isAlarm ? '#E24B4A' : '#378ADD',
      sticky: isAlarm ? false : undefined,
      autoDismiss: isAlarm ? false : undefined,
      priority: isAlarm
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: alarmSupported && config.tipoAlerta === 'alarma'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
          channelId: 'chronos-alarm',
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
          channelId: 'chronos-push',
        },
  })

  return osId
}

// ─── STEP 6: cancelAlerta ────────────────────────────────────────────────────
async function cancelAlerta(osID: string | null): Promise<void> {
  if (!osID || osID === 'PAST') return
  await Notifications.cancelScheduledNotificationAsync(osID)
}

// ─── STEP 7: syncTaskNotifications ───────────────────────────────────────────
export async function syncTaskNotifications(
  task: Tasks,
  alarmSupported: boolean
): Promise<Tasks> {
  const configs: Notification = task.recordatorio ?? []
  const updated: Config[] = []

  for (const config of configs) {
    // Cancel previous OS notification if it existed
    await cancelAlerta(config.osID)

    // Schedule new one only if active
    let newOsID: string | null = null
    if (config.activo) {
      newOsID = await scheduleAlerta(task, config, alarmSupported)
    }

    updated.push({ ...config, osID: newOsID })
  }

  return { ...task, recordatorio: updated }
}

export async function syncReminderNotifications(
  reminder: Reminder,
  alarmSupported: boolean
): Promise<Reminder> {
  const configs: Notification = reminder.recordatorio ?? []
  const updated: Config[] = []

  for (const config of configs) {
    await cancelAlerta(config.osID)

    let newOsID: string | null = null
    if (config.activo) {
      newOsID = await scheduleReminderAlerta(reminder, config, alarmSupported)
    }

    updated.push({ ...config, osID: newOsID })
  }

  return { ...reminder, recordatorio: updated }
}

// ─── STEP 8: cancelAllTaskNotifications ──────────────────────────────────────
export async function cancelAllTaskNotifications(
  task: Tasks
): Promise<void> {
  const configs: Notification = task.recordatorio ?? []
  for (const config of configs) {
    await cancelAlerta(config.osID)
  }
}

export async function cancelAllReminderNotifications(
  reminder: Reminder
): Promise<void> {
  const configs: Notification = reminder.recordatorio ?? []
  for (const config of configs) {
    await cancelAlerta(config.osID)
  }
}
