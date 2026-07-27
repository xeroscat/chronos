import { Tasks, Reminder } from '../../types';
import { checkAndCalculateOverflow } from '../timeline/transformers/timeMath';

export const getFilteredTasks = (
  tasks: Tasks[],
  selectedDate: string
): Tasks[] => {
  return tasks.filter(task => task.date === selectedDate || task.overflowDate === selectedDate);
};

export const getFilteredTasksWithAdjustedValues = (
  tasks: Tasks[],
  selectedDate: string
): (Tasks & { effectiveSlotInicio: number; effectiveDuracionSlots: number; isOverflow: boolean | null })[] => {
  return tasks
    .filter(task => task.date === selectedDate || task.overflowDate === selectedDate)
    .map(task => {
      const overflowResult = task.past12
        ? checkAndCalculateOverflow(task.slotInicio, task.duracionSlots, task.date)
        : { past12: false, overflowDate: undefined, overflowSlots: undefined, adjustedDuration: task.duracionSlots };

      const isOverflow = task.overflowDate === selectedDate && task.past12;
      const isOriginalDay = task.date === selectedDate;
      
      return {
        ...task,
        effectiveSlotInicio: isOverflow ? 0 : task.slotInicio,
        effectiveDuracionSlots: isOverflow 
          ? (task.overflowSlots || 0) 
          : (isOriginalDay && task.past12 ? overflowResult.adjustedDuration : task.duracionSlots),
        isOverflow,
      };
    });
};

export const getFilteredReminders = (
  reminders: Reminder[],
  selectedDate: string
): Reminder[] => {
  return reminders.filter(reminder => reminder.date === selectedDate);
};
