import { RenderBlock } from '../../store/useTimelineStore';
import { checkAndCalculateOverflow } from './transformers/timeMath';

export const getFilteredBlocks = (
  tasks: any[],
  selectedDate: string
): RenderBlock[] => {
  const renderBlocks: RenderBlock[] = [];

  tasks.forEach((task) => {
    // Calcular overflow dinámicamente basado en past12
    const overflowResult = task.past12
      ? checkAndCalculateOverflow(task.slotInicio, task.duracionSlots, task.date)
      : { past12: false, overflowDate: undefined, overflowSlots: undefined, adjustedDuration: task.duracionSlots };

    // Caso 1: Tarea principal coincide con la fecha seleccionada
    if (task.date === selectedDate) {
      renderBlocks.push({
        id: task.id,
        blockId: task.blockId,
        slotInicio: task.slotInicio,
        duracionSlots: task.past12 ? overflowResult.adjustedDuration : task.duracionSlots,
        slotFin: task.past12 ? 288 : task.slotFin,
        pilarTipo: task.pilarTipo,
        status: task.status,
        past12: task.past12,
        isOverflow: false,
      });
    }
    // Caso 2: Tarea con overflow que coincide con la fecha seleccionada (día siguiente)
    else if (overflowResult.overflowDate === selectedDate && task.past12) {
      renderBlocks.push({
        id: task.id,
        blockId: task.blockId,
        slotInicio: 0, // Overflow siempre empieza en 00:00
        duracionSlots: overflowResult.overflowSlots || 0,
        slotFin: overflowResult.overflowSlots || 0,
        pilarTipo: task.pilarTipo,
        status: task.status,
        past12: task.past12,
        isOverflow: true,
        overflowSlots: overflowResult.overflowSlots,
      });
    }
  });

  return renderBlocks;
};
