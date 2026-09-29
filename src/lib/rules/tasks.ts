import {
  END_OF_DAY_HOUR,
  FIRST_CALL_HOUR,
  STATUS_CHECK_WORKING_DAYS,
  type TaskGroupKey,
} from '../constants';
import { addDays, addHours, addWorkingDays, atTime, calendarDaysBetween } from '../dates';
import type { Task } from '../types';

type TaskRef = Pick<Task, 'status' | 'dueAt'>;

/**
 * Overdue = open and due on an earlier calendar day. A task due at 09:00 today is "Today",
 * not overdue, matching the Tasks screen groups in the design.
 */
export function isOverdue(task: TaskRef, now: Date): boolean {
  if (task.status !== 'open' || !task.dueAt) return false;
  return calendarDaysBetween(now, new Date(task.dueAt)) < 0;
}

/** Days until the end of the current week (Sunday). Monday → 6, Sunday → 0. */
function daysLeftInWeek(now: Date): number {
  return (7 - now.getDay()) % 7;
}

/** Group on the Tasks screen: Overdue / Today / Tomorrow / This week / Later / No date. */
export function taskGroup(task: Pick<Task, 'dueAt'>, now: Date): TaskGroupKey {
  if (!task.dueAt) return 'none';
  const diff = calendarDaysBetween(now, new Date(task.dueAt));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= daysLeftInWeek(now)) return 'week';
  return 'later';
}

// ── Quick scheduling ("Next step", "Task" on the client card) ─

export type DuePreset = 'today' | 'tomorrow' | 'in3' | 'nextWeek';

export const DUE_PRESETS: { id: DuePreset; label: string }[] = [
  { id: 'today', label: 'Today, by 18:00' },
  { id: 'tomorrow', label: 'Tomorrow, 10:00' },
  { id: 'in3', label: 'In 3 working days' },
  { id: 'nextWeek', label: 'Next Monday, 10:00' },
];

/** Due date for a preset. "Today" late in the evening becomes an hour from now, never the past. */
export function dueFromPreset(preset: DuePreset, now: Date): Date {
  switch (preset) {
    case 'today': {
      const eod = atTime(now, END_OF_DAY_HOUR);
      return eod > now ? eod : addHours(now, 1);
    }
    case 'tomorrow':
      return atTime(addDays(now, 1), FIRST_CALL_HOUR);
    case 'in3':
      return atTime(addWorkingDays(now, STATUS_CHECK_WORKING_DAYS), FIRST_CALL_HOUR);
    case 'nextWeek': {
      const daysToMonday = (8 - now.getDay()) % 7 || 7;
      return atTime(addDays(now, daysToMonday), FIRST_CALL_HOUR);
    }
  }
}
