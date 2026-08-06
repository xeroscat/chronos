// 0. Date Utilities - Always use these for date string handling
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function localDateStringToMidnight(dateStr: string): Date {
  // Parses 'YYYY-MM-DD' as LOCAL midnight, not UTC midnight
  // new Date('YYYY-MM-DD') is UTC — this fixes that
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

// 1. Convierte horas del formulario a Slot (0-287)
export const timeToSlot = (hourStr: string, minStr: string, ampm: 'AM' | 'PM'): number => {
  let h = parseInt(hourStr, 10);
  const m = parseInt(minStr, 10);
  
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  
  const totalMinutes = (h * 60) + m;
  return Math.floor(totalMinutes / 5);
};

// 2. Convierte duración del formulario a cantidad de Slots
export const durationToSlots = (durHourStr: string, durMinStr: string): number => {
  const h = parseInt(durHourStr.replace('h', ''), 10) || 0;
  const m = parseInt(durMinStr.replace('m', ''), 10) || 0;
  const totalMinutes = (h * 60) + m;
  return Math.floor(totalMinutes / 5);
};

// 3. Convierte un Slot (0-287) de vuelta a formato de formulario
export const slotToTimeParts = (slot: number): { h: string, m: string, ampm: 'AM' | 'PM' } => {
  const totalMinutes = slot * 5;
  let h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  
  return {
    h: h.toString().padStart(2, '0'),
    m: m.toString().padStart(2, '0'),
    ampm
  };
};

// 4. Algoritmo Smart Default: Encuentra el primer hueco libre
export const findFirstFreeSpace = (
  existingBlocks: { slotInicio: number, duracionSlots: number }[], 
  requiredSlots: number,
  startSearchSlot: number = 96 // Por defecto empieza a buscar a las 08:00 AM
): number => {
  // Ordenar bloques existentes por hora de inicio
  const sortedBlocks = [...existingBlocks].sort((a, b) => a.slotInicio - b.slotInicio);
  
  let currentAttempt = startSearchSlot;

  for (const block of sortedBlocks) {
    const blockEnd = block.slotInicio + block.duracionSlots;
    
    // Si el bloque actual termina antes de nuestro intento, lo ignoramos
    if (blockEnd <= currentAttempt) continue;

    // Si nuestro intento choca con este bloque
    if (currentAttempt + requiredSlots > block.slotInicio) {
      // Movemos nuestro intento al final de este bloque
      currentAttempt = blockEnd;
    }
  }

  // Si nos pasamos de la medianoche (288 slots), lo limitamos (Edge case que manejaremos después)
  if (currentAttempt + requiredSlots > 288) {
    return 288 - requiredSlots; 
  }

  return currentAttempt;
};

// 5. Verificador de Overflow: Detecta si una tarea cruza medianoche y calcula los valores de overflow
export interface OverflowResult {
  past12: boolean;
  overflowSlots?: number;
  overflowDate?: string;
  adjustedDuration: number; // duración ajustada para el día actual (sin overflow)
}

export const checkAndCalculateOverflow = (
  slotInicio: number,
  duracionSlots: number,
  currentDate: string
): OverflowResult => {
  const slotFin = slotInicio + duracionSlots;
  
  // Si la tarea termina antes o exactamente en medianoche (slot 288)
  if (slotFin <= 288) {
    return {
      past12: false,
      overflowSlots: undefined,
      overflowDate: undefined,
      adjustedDuration: duracionSlots,
    };
  }
  
  // La tarea cruza medianoche
  const slotsInCurrentDay = 288 - slotInicio;
  const overflowSlotsCount = duracionSlots - slotsInCurrentDay;
  
  // Calcular fecha del día siguiente using local midnight
  const d = localDateStringToMidnight(currentDate);
  d.setDate(d.getDate() + 1);
  const overflowDate = getLocalDateString(d);
  
  return {
    past12: true,
    overflowSlots: overflowSlotsCount,
    overflowDate: overflowDate,
    adjustedDuration: slotsInCurrentDay,
  };
};

// 6. Algoritmo de Colisión: Detecta si un nuevo bloque choca con bloques existentes
const intervalsOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean => {
  return aStart < bEnd && bStart < aEnd;
};

// Función auxiliar para obtener intervalos considerando overflow
export const getSlotsIntervals = (start: number, duration: number) => {
  const end = start + duration;
  if (end <= 288) {
    return [{ start, end }];
  }
  return [
    { start, end: 288 },
    { start: 0, end: end - 288 }
  ];
};

export const checkCollision = (
  newStart: number,
  newDuration: number,
  existingBlocks: { slotInicio: number, duracionSlots: number }[]
): boolean => {
  const newIntervals = getSlotsIntervals(newStart, newDuration);

  for (const block of existingBlocks) {
    const blockIntervals = getSlotsIntervals(block.slotInicio, block.duracionSlots);

    for (const newInt of newIntervals) {
      for (const blockInt of blockIntervals) {
        if (intervalsOverlap(newInt.start, newInt.end, blockInt.start, blockInt.end)) {
          return true;
        }
      }
    }
  }

  return false;
};
