// Read-only views over a dataset. Pass the output of scopeDataset() so every number and list
// already respects the role; nothing here filters by owner or role.

import { isStaleContact } from '../rules/clients';
import { isClosedStage, isStuck } from '../rules/stages';
import { isOverdue, taskGroup } from '../rules/tasks';
import type { Client, Deal, Id, Task, User } from '../types';
import type { Dataset } from './dataset';

export function findUser(data: Pick<Dataset, 'users'>, id: Id): User | undefined {
  return data.users.find((u) => u.id === id);
}

export function openDeals(data: Pick<Dataset, 'deals'>): Deal[] {
  return data.deals.filter((d) => !isClosedStage(d.stage));
}

export function stuckDeals(data: Pick<Dataset, 'deals'>, now: Date): Deal[] {
  return openDeals(data).filter((d) => isStuck(d, now));
}

export function overdueTasks(data: Pick<Dataset, 'tasks'>, now: Date): Task[] {
  return data.tasks.filter((t) => isOverdue(t, now));
}

export function dueTodayTasks(data: Pick<Dataset, 'tasks'>, now: Date): Task[] {
  return data.tasks.filter((t) => t.status === 'open' && taskGroup(t, now) === 'today');
}

/** Bell badge: overdue + due today. */
export function reminderCount(data: Pick<Dataset, 'tasks'>, now: Date): number {
  return overdueTasks(data, now).length + dueTodayTasks(data, now).length;
}

/** Latest interaction per client. Clients never contacted are absent. */
export function lastContactByClient(data: Pick<Dataset, 'interactions'>): Map<Id, Date> {
  const last = new Map<Id, Date>();
  for (const i of data.interactions) {
    const at = new Date(i.date);
    const prev = last.get(i.clientId);
    if (!prev || at > prev) last.set(i.clientId, at);
  }
  return last;
}

/** "No contact 14+ days": last interaction at least 14 days ago, or none at all. */
export function staleClients(data: Pick<Dataset, 'clients' | 'interactions'>, now: Date): Client[] {
  const last = lastContactByClient(data);
  return data.clients.filter((c) => isStaleContact(last.get(c.id), now));
}

/** Clients who already got financing through us (at least one Won deal). */
export function repeatClients(data: Pick<Dataset, 'clients' | 'deals'>): Client[] {
  const won = new Set(data.deals.filter((d) => d.stage === 'won').map((d) => d.clientId));
  return data.clients.filter((c) => won.has(c.id));
}

export interface NavCounts {
  clients: number;
  pipeline: number;
  tasks: number;
}

/** Sidebar counters: clients, open deals, overdue tasks (shown in red). */
export function navCounts(data: Dataset, now: Date): NavCounts {
  return {
    clients: data.clients.length,
    pipeline: openDeals(data).length,
    tasks: overdueTasks(data, now).length,
  };
}

export interface SearchResults {
  clients: Client[];
  deals: Deal[];
}

const MIN_DIGITS = 3;

/**
 * Client matches a free-text query: name, contact name, EDRPOU / tax ID or phone
 * (3+ digits, spaces ignored). Shared by the top-bar search and the Clients list.
 */
export function clientMatchesQuery(c: Client, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (
    c.name.toLowerCase().includes(q) ||
    c.contacts.some((k) => k.name.toLowerCase().includes(q)) ||
    (digits.length >= MIN_DIGITS &&
      (c.code.includes(digits) ||
        c.contacts.some((k) => k.phone.replace(/\D/g, '').includes(digits))))
  );
}

/**
 * Global search (top bar). Matches clients by name, EDRPOU / tax ID, contact name or phone
 * (3+ digits, spaces ignored), and open deals by client name or purpose.
 */
export function search(
  data: Pick<Dataset, 'clients' | 'deals'>,
  query: string,
  limits = { clients: 6, deals: 4 },
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { clients: [], deals: [] };
  const clients = data.clients.filter((c) => clientMatchesQuery(c, q));
  const names = new Map(data.clients.map((c) => [c.id, c.name.toLowerCase()]));
  const deals = openDeals(data).filter(
    (d) => (names.get(d.clientId) ?? '').includes(q) || d.purpose.toLowerCase().includes(q),
  );
  return { clients: clients.slice(0, limits.clients), deals: deals.slice(0, limits.deals) };
}
