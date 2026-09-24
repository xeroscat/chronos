package expo.modules.chronosnativealarms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class ChronosAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("ChronosAlarm", "=== onReceive FIRED ===")
        android.util.Log.d("ChronosAlarm", "ALARM_ID: ${intent.getStringExtra("ALARM_ID")}")
        android.util.Log.d("ChronosAlarm", "TITLE: ${intent.getStringExtra("TITLE")}")
        android.util.Log.d("ChronosAlarm", "BODY: ${intent.getStringExtra("BODY")}")
        android.util.Log.d("ChronosAlarm", "COLOR: ${intent.getStringExtra("COLOR")}")
        android.util.Log.d("ChronosAlarm", "IS_REMINDER: ${intent.getBooleanExtra("IS_REMINDER", false)}")
        
        // Log all extras for debugging
        android.util.Log.d("ChronosAlarm", "All extras: ${intent.extras}")
        
        Log.d("ChronosNativeAlarms", "🔔 ALARM TRIGGERED - BroadcastReceiver activated")
        
        // Adquirir WakeLock para asegurar que el dispositivo se despierte
        val wakeLock = (context.getSystemService(Context.POWER_SERVICE) as PowerManager).apply {
            newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Chronos:AlarmWakeLock").acquire(10000L)
        }
        Log.d("ChronosNativeAlarms", "🔋 WakeLock acquired for 10 seconds")
        
        // 1. Extraemos el payload que enviamos desde TypeScript
        val alarmId = intent.getStringExtra("ALARM_ID")
        if (alarmId == null) {
            Log.e("ChronosNativeAlarms", "❌ ALARM_ID is null, cannot proceed")
            return
        }
        val title = intent.getStringExtra("TITLE") ?: "⏰ Alarma"
        val body = intent.getStringExtra("BODY") ?: "Es hora de tu tarea"
        val vibrationArray = intent.getLongArrayExtra("VIBRATION_PATTERN") ?: longArrayOf(0, 500, 200, 500)
        val isReminder = intent.getBooleanExtra("IS_REMINDER", false)
        
        Log.d("ChronosNativeAlarms", "📋 Alarm details - ID: $alarmId, Title: $title, IsReminder: $isReminder")

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "chronos_alarms_channel_v2" // Cambiado para forzar recreación con IMPORTANCE_MAX

        Log.d("ChronosNativeAlarms", "📱 NotificationManager obtained, Channel: $channelId")

        // 2. Creamos un canal ultra-agresivo (Requerido en Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Log.d("ChronosNativeAlarms", "🔧 Creating notification channel (Android 8+)")
            
            // Verificar si el canal ya existe
            val existingChannel = notificationManager.getNotificationChannel(channelId)
            if (existingChannel != null) {
                Log.d("ChronosNativeAlarms", "⚠️ Channel already exists with importance: ${existingChannel.importance}")
                notificationManager.deleteNotificationChannel(channelId)
                Log.d("ChronosNativeAlarms", "🗑️ Deleted existing channel to recreate")
            }
            
            // Usar sonidodefault de alarma del sistema
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            Log.d("ChronosNativeAlarms", "🔊 Using alarm sound: $alarmSound")
            
            val channel = NotificationChannel(
                channelId,
                "Chronos Alarmas Reales",
                NotificationManager.IMPORTANCE_MAX // IMPORTANCE_MAX para comportamiento de alarma
            ).apply {
                description = "Canal para alarmas exactas de Chronos IA"
                enableVibration(true)
                vibrationPattern = vibrationArray
                setSound(alarmSound, null) // Sonido de alarma explícito
                enableLights(true)
                lightColor = android.graphics.Color.RED
                setBypassDnd(true) // Bypass Do Not Disturb
                setShowBadge(false) // No mostrar badge
            }
            notificationManager.createNotificationChannel(channel)
            
            // Verificar que se creó correctamente
            val createdChannel = notificationManager.getNotificationChannel(channelId)
            Log.d("ChronosNativeAlarms", "✅ Notification channel created with IMPORTANCE_MAX and bypassDnd")
            Log.d("ChronosNativeAlarms", "📊 Created channel importance: ${createdChannel?.importance}")
        }

        // 3. Creamos el Intent para abrir tu App (MainActivity)
        // Usamos la forma genérica de obtener la clase principal para no depender del package name exacto
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            // Podemos pasarle el ID de vuelta a la app para que React Native sepa qué alarma sonó
            putExtra("TRIGGERED_ALARM_ID", alarmId ?: "") 
        }

        Log.d("ChronosNativeAlarms", "🚀 LaunchIntent created with TRIGGERED_ALARM_ID: $alarmId")

        val pendingLaunchIntent = PendingIntent.getActivity(
            context,
            alarmId.hashCode(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        Log.d("ChronosNativeAlarms", "🔔 PendingLaunchIntent created with requestCode: ${alarmId.hashCode()}")

        // 4. Construimos la notificación que rompe el bloqueo
        Log.d("ChronosNativeAlarms", "🔨 Building notification...")
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(context.applicationInfo.icon) // Usa el icono por defecto de tu app
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true) // Se borra al tocarla
            .setVibrate(vibrationArray)
            .setOngoing(false)
            .setContentIntent(pendingLaunchIntent) // Qué pasa si tocan la notificación
            .setFullScreenIntent(pendingLaunchIntent, true) // Reactivado - INTENTO DE PANTALLA COMPLETA
            .setDefaults(NotificationCompat.DEFAULT_ALL) // Habilita sonido, vibración y luces por defecto
            .build()

        Log.d("ChronosNativeAlarms", "✅ Notification built with PRIORITY_MAX, CATEGORY_ALARM and fullScreenIntent")

        // 5. ¡Disparamos!
        notificationManager.notify(alarmId.hashCode(), notification)
        Log.d("ChronosNativeAlarms", "🔔 NOTIFICATION DISPLAYED - ID: $alarmId, NotificationID: ${alarmId.hashCode()}")
    }
}