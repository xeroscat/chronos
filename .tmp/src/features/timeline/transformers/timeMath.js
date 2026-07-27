"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCollision = exports.getSlotsIntervals = exports.findFirstFreeSpace = exports.slotToTimeParts = exports.durationToSlots = exports.timeToSlot = void 0;
// 1. Convierte horas del formulario a Slot (0-287)
const timeToSlot = (hourStr, minStr, ampm) => {
    let h = parseInt(hourStr, 10);
    const m = parseInt(minStr, 10);
    if (ampm === 'PM' && h !== 12)
        h += 12;
    if (ampm === 'AM' && h === 12)
        h = 0;
    const totalMinutes = (h * 60) + m;
    return Math.floor(totalMinutes / 5);
};
exports.timeToSlot = timeToSlot;
// 2. Convierte duración del formulario a cantidad de Slots
const durationToSlots = (durHourStr, durMinStr) => {
    const h = parseInt(durHourStr.replace('h', ''), 10) || 0;
    const m = parseInt(durMinStr.replace('m', ''), 10) || 0;
    const totalMinutes = (h * 60) + m;
    return Math.floor(totalMinutes / 5);
};
exports.durationToSlots = durationToSlots;
// 3. Convierte un Slot (0-287) de vuelta a formato de formulario
const slotToTimeParts = (slot) => {
    const totalMinutes = slot * 5;
    let h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12)
        h -= 12;
    if (h === 0)
        h = 12;
    return {
        h: h.toString().padStart(2, '0'),
        m: m.toString().padStart(2, '0'),
        ampm
    };
};
exports.slotToTimeParts = slotToTimeParts;
// 4. Algoritmo Smart Default: Encuentra el primer hueco libre
const findFirstFreeSpace = (existingBlocks, requiredSlots, startSearchSlot = 96 // Por defecto empieza a buscar a las 08:00 AM
) => {
    // Ordenar bloques existentes por hora de inicio
    const sortedBlocks = [...existingBlocks].sort((a, b) => a.slotInicio - b.slotInicio);
    let currentAttempt = startSearchSlot;
    for (const block of sortedBlocks) {
        const blockEnd = block.slotInicio + block.duracionSlots;
        // Si el bloque actual termina antes de nuestro intento, lo ignoramos
        if (blockEnd <= currentAttempt)
            continue;
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
exports.findFirstFreeSpace = findFirstFreeSpace;
// 5. Desglosa intervalos de slots (maneja bloques que cruzan la medianoche)
const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd;
};
const getSlotsIntervals = (start, duration) => {
    if (duration <= 0)
        return [];
    const end = start + duration;
    if (end <= 288) {
        return [{ start, end }];
    }
    return [
        { start, end: 288 },
        { start: 0, end: end - 288 }
    ];
};
exports.getSlotsIntervals = getSlotsIntervals;
// 6. Algoritmo de Colisión: Detecta si un nuevo bloque choca con bloques existentes
const checkCollision = (newStart, newDuration, existingBlocks) => {
    const newIntervals = (0, exports.getSlotsIntervals)(newStart, newDuration);
    for (const block of existingBlocks) {
        const blockIntervals = (0, exports.getSlotsIntervals)(block.slotInicio, block.duracionSlots);
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
exports.checkCollision = checkCollision;
