import type { TaskGroupKey } from '../constants';
import { calendarDaysBetween } from '../dates';
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
