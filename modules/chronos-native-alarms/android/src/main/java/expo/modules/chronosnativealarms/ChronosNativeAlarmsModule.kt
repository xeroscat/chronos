package expo.modules.chronosnativealarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.Field

// 1. Definición del Record (Mapeo de tu objeto de TypeScript)
class AlarmOptions : Record {
    @Field var id: String = ""
    @Field var timestamp: Double = 0.0
    @Field var title: String = ""
    @Field var body: String = ""
    @Field var color: String = "#000000"
    @Field var isReminder: Boolean = false
    @Field var vibrationPattern: List<Long> = listOf()
    @Field var allowSnooze: Boolean = true
    @Field var snoozeInterval: Int = 5
}

class ChronosNativeAlarmsModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ChronosNativeAlarms")

        // 2. Función para programar la alarma
        AsyncFunction("scheduleAlarm") { options: AlarmOptions ->
            Log.d("ChronosNativeAlarms", "🔵 SCHEDULE_ALARM - ID: ${options.id}, Timestamp: ${options.timestamp}, Title: ${options.title}")
            
            // Obtenemos el contexto de React Native
            val context = appContext.reactContext ?: throw Exception("React context not available")
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            Log.d("ChronosNativeAlarms", "📱 Context obtained, AlarmManager ready")

            // Creamos un Intent dirigido a nuestro BroadcastReceiver (que crearemos después)
            val intent = Intent(context, ChronosAlarmReceiver::class.java).apply {
                // Pasamos toda la configuración como extras para que el Receiver sepa qué mostrar
                putExtra("ALARM_ID", options.id)
                putExtra("TITLE", options.title)
                putExtra("BODY", options.body)
                putExtra("COLOR", options.color)
                putExtra("IS_REMINDER", options.isReminder)
                putExtra("VIBRATION_PATTERN", options.vibrationPattern.toLongArray())
                putExtra("ALLOW_SNOOZE", options.allowSnooze)
                putExtra("SNOOZE_INTERVAL", options.snoozeInterval)
            }

            Log.d("ChronosNativeAlarms", "📦 Intent created with extras")

            // El PendingIntent envuelve nuestro Intent. 
            // Usamos id.hashCode() como RequestCode para que cada alarma sea única en el sistema.
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                options.id.hashCode(), 
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            Log.d("ChronosNativeAlarms", "🔔 PendingIntent created with requestCode: ${options.id.hashCode()} and FLAG_MUTABLE")

            // Configuramos la alarma tipo "Reloj Despertador" (comportamiento de alarma real)
            val alarmTime = options.timestamp.toLong()
            val alarmClockInfo = AlarmManager.AlarmClockInfo(alarmTime, pendingIntent)
            
            Log.d("ChronosNativeAlarms", "⏰ AlarmClockInfo created - Trigger time: $alarmTime, using setAlarmClock")
            
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

            Log.d("ChronosNativeAlarms", "✅ ALARM SCHEDULED SUCCESSFULLY - ID: ${options.id}")
            return@AsyncFunction true
        }

        // 3. Función para cancelar una alarma (vital para cuando editas o eliminas tareas)
        AsyncFunction("cancelAlarm") { id: String ->
            Log.d("ChronosNativeAlarms", "🔴 CANCEL_ALARM - ID: $id")
            
            val context = appContext.reactContext
            if (context == null) {
                Log.e("ChronosNativeAlarms", "❌ Context not available for cancel")
                return@AsyncFunction false
            }
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            Log.d("ChronosNativeAlarms", "📱 Context obtained, AlarmManager ready for cancel")

            // Recreamos el mismo Intent exacto
            val intent = Intent(context, ChronosAlarmReceiver::class.java)
            
            Log.d("ChronosNativeAlarms", "📦 Intent recreated for cancel")
            
            // Recreamos el PendingIntent usando el mismo hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            Log.d("ChronosNativeAlarms", "🔔 PendingIntent recreated with requestCode: ${id.hashCode()}")

            // Lo cancelamos en el sistema
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            Log.d("ChronosNativeAlarms", "✅ ALARM CANCELLED SUCCESSFULLY - ID: $id")
            return@AsyncFunction true
        }
    }
}