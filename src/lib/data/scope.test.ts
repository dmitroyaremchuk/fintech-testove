import { describe, expect, it } from 'vitest';
import { canReassign, canViewClient, canViewTeam, scopeDataset, type Session } from './scope';
import { createSeed } from './seed/build';

const data = createSeed(new Date(2026, 8, 29, 10, 14));
const head: Session = { role: 'head', userId: 'h1' };
const olena: Session = { role: 'manager', userId: 'u1' };
const dmytro: Session = { role: 'manager', userId: 'u4' };

describe('scopeDataset', () => {
  it('head sees everything', () => {
    expect(scopeDataset(data, head)).toBe(data);
  });

  it('a manager sees only own clients, deals and tasks', () => {
    const mine = scopeDataset(data, olena);
    expect(mine.clients.every((c) => c.ownerId === 'u1')).toBe(true);
    expect(mine.deals.every((d) => d.ownerId === 'u1')).toBe(true);
    expect(mine.tasks.every((t) => t.assigneeId === 'u1')).toBe(true);
    expect(mine.clients.length).toBeLessThan(data.clients.length);
  });

  it('nothing leaks through related records', () => {
    const mine = scopeDataset(data, olena);
    const dealIds = new Set(mine.deals.map((d) => d.id));
    const clientIds = new Set(mine.clients.map((c) => c.id));
    expect(mine.applications.every((a) => dealIds.has(a.dealId))).toBe(true);
    expect(mine.documents.every((d) => dealIds.has(d.dealId))).toBe(true);
    expect(mine.interactions.every((i) => clientIds.has(i.clientId))).toBe(true);
  });

  it('keeps every related record the manager is entitled to', () => {
    const mine = scopeDataset(data, olena);
    const dealIds = new Set(mine.deals.map((d) => d.id));
    expect(mine.applications).toHaveLength(
      data.applications.filter((a) => dealIds.has(a.dealId)).length,
    );
  });

  it('users stay visible to everyone (names on "Owned by: …")', () => {
    expect(scopeDataset(data, olena).users).toHaveLength(6);
  });

  it('the duplicate client is split: each manager sees only their own record', () => {
    const olenaCodes = scopeDataset(data, olena).clients.filter((c) => c.code === '38451290');
    const dmytroCodes = scopeDataset(data, dmytro).clients.filter((c) => c.code === '38451290');
    expect(olenaCodes.map((c) => c.id)).toEqual(['c4']);
    expect(dmytroCodes.map((c) => c.id)).toEqual(['c5']);
  });

  it('escalations addressed to the head are not shown to managers', () => {
    const escalations = scopeDataset(data, olena).tasks.filter((t) =>
      t.title.startsWith('Escalation'),
    );
    expect(escalations).toEqual([]);
    expect(scopeDataset(data, head).tasks.some((t) => t.title.startsWith('Escalation'))).toBe(true);
  });
});

describe('permissions', () => {
  it('manager opening someone else’s client is denied; head is allowed', () => {
    const budmontazh = data.clients.find((c) => c.id === 'c3')!;
    expect(canViewClient(olena, budmontazh)).toBe(false);
    expect(canViewClient(head, budmontazh)).toBe(true);
  });

  it('only the head can reassign', () => {
    expect(canReassign(head)).toBe(true);
    expect(canReassign(olena)).toBe(false);
    expect(canViewTeam(head)).toBe(true);
    expect(canViewTeam(olena)).toBe(false);
  });
});
