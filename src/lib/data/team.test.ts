import { describe, expect, it } from 'vitest';
import { isClosedStage } from '../rules/stages';
import { reassignDeals } from './mutations';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';
import { reassignCandidates } from './team';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);

describe('reassignCandidates', () => {
  const list = reassignCandidates(all, 'u1', NOW);
  it("lists the manager's open deals, over-SLA first", () => {
    expect(list).toHaveLength(18);
    expect(list.every((c) => c.deal.ownerId === 'u1' && !isClosedStage(c.deal.stage))).toBe(true);
    const firstCalm = list.findIndex((c) => !c.stuck);
    expect(list.slice(firstCalm).some((c) => c.stuck)).toBe(false);
  });
});

describe('reassignDeals', () => {
  const deal = reassignCandidates(all, 'u1', NOW)[0]!.deal;
  const clientDeals = all.deals.filter((d) => d.clientId === deal.clientId);
  const { data, moved } = reassignDeals(all, [deal.id], 'u3', NOW, 'Workload');

  it('moves the deal, its client and the client’s other open deals', () => {
    for (const d of clientDeals) {
      const after = data.deals.find((x) => x.id === d.id)!;
      expect(after.ownerId).toBe(isClosedStage(d.stage) ? d.ownerId : 'u3');
    }
    expect(data.clients.find((c) => c.id === deal.clientId)?.ownerId).toBe('u3');
    expect(moved.clients).toBe(1);
    expect(moved.deals).toBe(clientDeals.filter((d) => !isClosedStage(d.stage)).length);
  });

  it('hands over open tasks the previous owner had on that client', () => {
    const before = all.tasks.filter(
      (t) => t.clientId === deal.clientId && t.status === 'open' && t.assigneeId === 'u1',
    );
    expect(moved.tasks).toBe(before.length);
    for (const t of before) expect(data.tasks.find((x) => x.id === t.id)?.assigneeId).toBe('u3');
  });

  it('leaves an auto note in each moved deal’s timeline, with the reason', () => {
    const note = data.interactions.find((i) => i.dealId === deal.id && i.auto);
    expect(note).toMatchObject({
      clientId: deal.clientId,
      type: 'note',
      summary: 'Deal reassigned: Olena Koval → Mariia Tkachenko · Workload',
      date: NOW.toISOString(),
    });
    expect(data.interactions).toHaveLength(all.interactions.length + moved.deals);
    expect(new Set(data.interactions.map((i) => i.id)).size).toBe(data.interactions.length);
  });

  it('the new owner sees everything; the old one no longer does', () => {
    const mariia = scopeDataset(data, { role: 'manager', userId: 'u3' });
    expect(mariia.deals.some((d) => d.id === deal.id)).toBe(true);
    expect(mariia.clients.some((c) => c.id === deal.clientId)).toBe(true);
    const olena = scopeDataset(data, { role: 'manager', userId: 'u1' });
    expect(olena.deals.some((d) => d.id === deal.id)).toBe(false);
  });

  it('keeps deal owner equal to client owner for open deals', () => {
    const owner = new Map(data.clients.map((c) => [c.id, c.ownerId]));
    for (const d of data.deals.filter((x) => !isClosedStage(x.stage)))
      expect(d.ownerId).toBe(owner.get(d.clientId));
  });

  it('is a no-op for deals the target already owns, and rejects non-managers', () => {
    expect(reassignDeals(all, [deal.id], 'u1', NOW).moved).toEqual({
      deals: 0,
      clients: 0,
      tasks: 0,
    });
    expect(() => reassignDeals(all, [deal.id], 'h1', NOW)).toThrow();
  });
});
