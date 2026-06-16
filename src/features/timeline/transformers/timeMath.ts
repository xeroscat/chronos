import { TaskBlock } from '../../../types';

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

// 5. Desglosa intervalos de slots (maneja bloques que cruzan la medianoche)
export const getSlotsIntervals = (start: number, duration: number): { start: number, end: number }[] => {
  const end = start + duration;
  if (end <= 288) {
    return [{ start, end }];
  } else {
    return [
      { start, end: 288 },
      { start: 0, end: end - 288 }
    ];
  }
};

// 6. Algoritmo de Colisión: Detecta si un nuevo bloque choca con bloques existentes
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
        // Si el bloque nuevo inicia antes de que el existente termine, Y el existente inicia antes de que el nuevo termine
        if (newInt.start < blockInt.end && blockInt.start < newInt.end) {
          return true;
        }
      }
    }
  }
  return false;
};
