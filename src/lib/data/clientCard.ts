// Client card view model. Input is a role-scoped dataset.

import type { InteractionType } from '../constants';
import { atTime } from '../dates';
import { commissionBase, expectedCommission } from '../rules/commission';
import { isClosedStage, stageOrder } from '../rules/stages';
import { isOverdue } from '../rules/tasks';
import type { Deal, Id, Interaction, Task, User } from '../types';
import type { Dataset } from './dataset';

// ── Timeline ─────────────────────────────────────────────────

export type TimelineSource = 'all' | 'manual' | 'auto';

export interface TimelineFilter {
  source: TimelineSource;
  /** null = every type. */
  type: InteractionType | null;
}

export interface TimelineItem {
  interaction: Interaction;
  author: User | undefined;
  deal: Deal | undefined;
}

export interface TimelineGroup {
  /** Local midnight of the day. */
  day: Date;
  items: TimelineItem[];
}

/** Newest first, grouped by local calendar day. */
export function timelineGroups(
  data: Dataset,
  clientId: Id,
  filter: TimelineFilter,
): TimelineGroup[] {
  const users = new Map(data.users.map((u) => [u.id, u]));
  const deals = new Map(data.deals.map((d) => [d.id, d]));
  const items = data.interactions
    .filter((i) => i.clientId === clientId)
    .filter((i) => filter.source === 'all' || (filter.source === 'auto') === i.auto)
    .filter((i) => !filter.type || i.type === filter.type)
    .sort((a, b) => b.date.localeCompare(a.date));

  const groups: TimelineGroup[] = [];
  for (const interaction of items) {
    const day = atTime(new Date(interaction.date), 0);
    let group = groups.at(-1);
    if (!group || group.day.getTime() !== day.getTime()) {
      group = { day, items: [] };
      groups.push(group);
    }
    group.items.push({
      interaction,
      author: interaction.authorId ? users.get(interaction.authorId) : undefined,
      deal: interaction.dealId ? deals.get(interaction.dealId) : undefined,
    });
  }
  return groups;
}

/** Types that actually occur for this client, for the type filter. */
export function timelineTypes(data: Dataset, clientId: Id): InteractionType[] {
  return [...new Set(data.interactions.filter((i) => i.clientId === clientId).map((i) => i.type))];
}

// ── Right column ─────────────────────────────────────────────

export function openDealsOf(data: Dataset, clientId: Id): Deal[] {
  return data.deals
    .filter((d) => d.clientId === clientId && !isClosedStage(d.stage))
    .sort((a, b) => stageOrder(b.stage) - stageOrder(a.stage));
}

/** Open tasks, soonest first; undated last. */
export function openTasksOf(data: Dataset, clientId: Id): Task[] {
  const due = (t: Task) => (t.dueAt ? new Date(t.dueAt).getTime() : Infinity);
  return data.tasks
    .filter((t) => t.clientId === clientId && t.status === 'open')
    .sort((a, b) => due(a) - due(b));
}

export type NextStep =
  | { kind: 'task'; task: Task; deal: Deal | undefined; overdue: boolean }
  | { kind: 'none'; undatedTasks: number };

/**
 * The earliest dated open task. Overdue tasks come first: they are the next thing to do.
 * No dated task → nothing planned, and the client may go cold.
 */
export function nextStep(data: Dataset, clientId: Id, now: Date): NextStep {
  const open = openTasksOf(data, clientId);
  const task = open.find((t) => t.dueAt);
  if (!task) return { kind: 'none', undatedTasks: open.length };
  return {
    kind: 'task',
    task,
    deal: task.dealId ? data.deals.find((d) => d.id === task.dealId) : undefined,
    overdue: isOverdue(task, now),
  };
}

export interface LtvRow {
  deal: Deal;
  /** Year the money was paid out. */
  year: number;
  amount: number;
  fee: number;
}

export interface ClientLtv {
  rows: LtvRow[];
  /** Commission earned so far. */
  total: number;
  /** Commission if every open deal closes (unweighted). */
  potential: number;
}

export function clientLtv(data: Dataset, clientId: Id): ClientLtv {
  const appsOf = (dealId: Id) => data.applications.filter((a) => a.dealId === dealId);
  const rows = data.deals
    .filter((d) => d.clientId === clientId && d.stage === 'won')
    .map((deal) => {
      const apps = appsOf(deal.id);
      return {
        deal,
        year: new Date(deal.stageEnteredAt).getFullYear(),
        amount: commissionBase(deal, apps),
        fee: expectedCommission(deal, apps),
      };
    })
    .sort((a, b) => b.deal.stageEnteredAt.localeCompare(a.deal.stageEnteredAt));
  const potential = openDealsOf(data, clientId).reduce(
    (sum, d) => sum + expectedCommission(d, appsOf(d.id)),
    0,
  );
  return { rows, total: rows.reduce((sum, r) => sum + r.fee, 0), potential };
}
