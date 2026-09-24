// Define your exported module types here.
export type NativeAlarmOptions = {
  id: string;              // osID para cancelar o actualizar
  timestamp: number;       // Fecha exacta en milisegundos
  title: string;           // Título de la tarea
  body: string;            // Descripción o subtítulo
  color: string;           // Color del pilar (ej. "#FF5733")
  isReminder: boolean;     // Para diferenciar la UI nativa si es necesario
  vibrationPattern: number[]; // Ej: [0, 500, 200, 500]
  allowSnooze: boolean;    // true por defecto
  snoozeInterval: number;  // 5 por defecto (minutos)
};

// Y tu función asíncrona se vería así:
// export async function scheduleNativeAlarm(options: NativeAlarmOptions): Promise<boolean> { ... }