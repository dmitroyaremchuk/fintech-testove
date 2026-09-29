// Tasks screen and reminders. Input is a role-scoped dataset.

import {
  NUDGE_MIN_DAYS,
  TASK_GROUPS,
  TASK_PRIORITIES,
  type TaskGroupKey,
  type TaskPriority,
} from '../constants';
import { calendarDaysBetween } from '../dates';
import { isClosedStage } from '../rules/stages';
import { isOverdue, taskGroup } from '../rules/tasks';
import type { Client, Deal, Id, Task, User } from '../types';
import type { Dataset } from './dataset';
import { lastContactByClient } from './selectors';

export type TasksMode = 'mine' | 'all';

export interface TaskRow {
  task: Task;
  client: Client | undefined;
  deal: Deal | undefined;
  assignee: User | undefined;
  overdue: boolean;
}

export interface TaskGroupView {
  key: TaskGroupKey;
  label: string;
  /** Group header date for Today / Tomorrow ("Sep 29"). */
  date: Date | null;
  rows: TaskRow[];
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, med: 1, low: 2 };
const priorityIndex = (p: TaskPriority) => PRIORITY_ORDER[p] ?? Object.keys(TASK_PRIORITIES).length;

/**
 * Open tasks grouped Overdue / Today / Tomorrow / This week / Later / No date, soonest first
 * and high priority first within the same time. `mine` narrows the head's view to their own tasks.
 */
export function taskGroups(data: Dataset, now: Date, mode: TasksMode, userId: Id): TaskGroupView[] {
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  const deals = new Map(data.deals.map((d) => [d.id, d]));
  const users = new Map(data.users.map((u) => [u.id, u]));
  const open = data.tasks.filter(
    (t) => t.status === 'open' && (mode === 'all' || t.assigneeId === userId),
  );
  const time = (t: Task) => (t.dueAt ? new Date(t.dueAt).getTime() : Infinity);

  return TASK_GROUPS.map((g) => {
    const rows = open
      .filter((t) => taskGroup(t, now) === g.key)
      .sort((a, b) => time(a) - time(b) || priorityIndex(a.priority) - priorityIndex(b.priority))
      .map((task) => ({
        task,
        client: task.clientId ? clients.get(task.clientId) : undefined,
        deal: task.dealId ? deals.get(task.dealId) : undefined,
        assignee: users.get(task.assigneeId),
        overdue: isOverdue(task, now),
      }));
    const date =
      g.key === 'today' ? now : g.key === 'tomorrow' ? new Date(now.getTime() + 864e5) : null;
    return { key: g.key, label: g.label, date: g.showDate ? date : null, rows };
  }).filter((g) => g.rows.length > 0);
}

export interface ReminderSummary {
  today: number;
  overdue: number;
  /** Days the oldest overdue task has waited (0 if none). */
  oldestOverdueDays: number;
}

/** Shared by the Tasks banner and the top-bar bell. */
export function reminderSummary(data: Pick<Dataset, 'tasks'>, now: Date): ReminderSummary {
  const open = data.tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => isOverdue(t, now));
  return {
    today: open.filter((t) => taskGroup(t, now) === 'today').length,
    overdue: overdue.length,
    oldestOverdueDays: Math.max(
      0,
      ...overdue.map((t) => calendarDaysBetween(new Date(t.dueAt!), now)),
    ),
  };
}

/** "3 tasks today, 2 overdue" · "1 task today" · "2 overdue" · "Nothing due today". */
export function reminderText(s: ReminderSummary): string {
  const parts = [
    s.today ? `${s.today} ${s.today === 1 ? 'task' : 'tasks'} today` : '',
    s.overdue ? `${s.overdue} overdue` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Nothing due today';
}

export interface ContactNudge {
  client: Client;
  lastContact: Date | null;
  days: number | null;
  /** Most advanced open deal, if any. */
  deal: Deal | undefined;
}

/**
 * When nothing is left for today: clients silent for a week or more (never contacted first),
 * longest wait first. Empty when everyone was contacted recently.
 */
export function contactNudges(data: Dataset, now: Date, limit = 3): ContactNudge[] {
  const last = lastContactByClient(data);
  const openDeal = (id: Id) => data.deals.find((d) => d.clientId === id && !isClosedStage(d.stage));
  return data.clients
    .map((client) => {
      const at = last.get(client.id) ?? null;
      return {
        client,
        lastContact: at,
        days: at ? calendarDaysBetween(at, now) : null,
        deal: openDeal(client.id),
      };
    })
    .filter((n) => n.days === null || n.days >= NUDGE_MIN_DAYS)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
    .slice(0, limit);
}

/** Personal reminders (the bell): tasks assigned to this user. For a manager it equals the scoped summary. */
export function reminderSummaryFor(
  data: Pick<Dataset, 'tasks'>,
  userId: Id,
  now: Date,
): ReminderSummary {
  return reminderSummary({ tasks: data.tasks.filter((t) => t.assigneeId === userId) }, now);
}
