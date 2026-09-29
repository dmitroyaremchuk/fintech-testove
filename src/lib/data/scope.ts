// Role-based access. The ONLY place that decides who sees what (AGENTS.md → Roles and access).
// Screens read from scopeDataset(); they never filter by owner or role themselves.

import type { Client, Deal, Id, Role, Task } from '../types';
import type { Dataset } from './dataset';

export interface Session {
  role: Role;
  /** The logged-in user: a manager, or the head. */
  userId: Id;
}

export function canViewClient(session: Session, client: Pick<Client, 'ownerId'>): boolean {
  return session.role === 'head' || client.ownerId === session.userId;
}

export function canViewDeal(session: Session, deal: Pick<Deal, 'ownerId'>): boolean {
  return session.role === 'head' || deal.ownerId === session.userId;
}

export function canViewTask(session: Session, task: Pick<Task, 'assigneeId'>): boolean {
  return session.role === 'head' || task.assigneeId === session.userId;
}

export function canViewTeam(session: Session): boolean {
  return session.role === 'head';
}

/** Only the head reassigns owners and tasks. */
export function canReassign(session: Session): boolean {
  return session.role === 'head';
}

/**
 * What the session may see. Head: everything. Manager: own clients, own deals and their
 * applications/documents, interactions of own clients, tasks assigned to them.
 * Users are always visible (names, avatars, "Owned by: …").
 */
export function scopeDataset(data: Dataset, session: Session): Dataset {
  if (session.role === 'head') return data;
  const clients = data.clients.filter((c) => canViewClient(session, c));
  const deals = data.deals.filter((d) => canViewDeal(session, d));
  const clientIds = new Set(clients.map((c) => c.id));
  const dealIds = new Set(deals.map((d) => d.id));
  return {
    users: data.users,
    clients,
    deals,
    applications: data.applications.filter((a) => dealIds.has(a.dealId)),
    documents: data.documents.filter((d) => dealIds.has(d.dealId)),
    interactions: data.interactions.filter((i) => clientIds.has(i.clientId)),
    tasks: data.tasks.filter((t) => canViewTask(session, t)),
  };
}
