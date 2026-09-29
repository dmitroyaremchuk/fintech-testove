import { describe, expect, it } from 'vitest';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';
import {
  navCounts,
  reminderCount,
  repeatClients,
  search,
  staleClients,
  stuckDeals,
} from './selectors';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena = scopeDataset(all, { role: 'manager', userId: 'u1' });

describe('navCounts', () => {
  it('Olena: her clients, 18 open deals, 9 overdue tasks', () => {
    const counts = navCounts(olena, NOW);
    expect(counts.clients).toBe(all.clients.filter((c) => c.ownerId === 'u1').length);
    expect(counts.pipeline).toBe(18);
    expect(counts.tasks).toBe(9);
  });

  it('head: the whole team', () => {
    expect(navCounts(all, NOW).pipeline).toBe(43);
    expect(navCounts(all, NOW).clients).toBe(40);
  });
});

describe('sidebar saved filters', () => {
  it('deals over SLA are counted within the scope', () => {
    expect(stuckDeals(olena, NOW).map((d) => d.id)).toEqual(['d5', 'd10', 'd24']);
    expect(stuckDeals(all, NOW)).toHaveLength(7);
  });

  it('no contact 14+ days includes the inactive car-service client', () => {
    expect(staleClients(olena, NOW).map((c) => c.id)).toContain('c15');
  });

  it('repeat clients are those with a Won deal', () => {
    const ids = repeatClients(olena).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['c1', 'c6']));
  });
});

describe('reminderCount', () => {
  it('is overdue + due today', () => {
    expect(reminderCount(olena, NOW)).toBeGreaterThan(9);
  });
});

describe('search', () => {
  it('matches client names case-insensitively', () => {
    expect(search(olena, 'agro').clients.map((c) => c.id)).toContain('c1');
  });

  it('matches EDRPOU and phone digits, ignoring spaces', () => {
    expect(search(olena, '40218763').clients.map((c) => c.id)).toEqual(['c1']);
    expect(search(olena, '412 58').clients.map((c) => c.id)).toEqual(['c1']);
  });

  it('ignores short digit fragments to avoid noise', () => {
    expect(search(olena, '41').clients).toEqual([]);
  });

  it('matches contacts and open deals by purpose', () => {
    expect(search(olena, 'lytvynenko').clients.map((c) => c.id)).toEqual(['c1']);
    expect(search(olena, 'winter sowing').deals.map((d) => d.id)).toEqual(['d1']);
  });

  it('respects the role scope: a manager does not find other managers’ clients', () => {
    expect(search(olena, 'Budmontazh').clients).toEqual([]);
    expect(search(all, 'Budmontazh').clients.map((c) => c.id)).toEqual(['c3']);
  });

  it('empty query → nothing', () => {
    expect(search(all, '   ')).toEqual({ clients: [], deals: [] });
  });
});
