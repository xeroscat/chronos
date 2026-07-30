//Inicio del notification service
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

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
      name: 'Chronos — recordatorios',
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