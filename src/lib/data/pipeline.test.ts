import { describe, expect, it } from 'vitest';
import { moveDeal } from './mutations';
import {
  closedDeals,
  filterCards,
  NO_FILTERS,
  pipelineCards,
  pipelineColumns,
  pipelineSummary,
} from './pipeline';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena = scopeDataset(all, { role: 'manager', userId: 'u1' });
const cards = pipelineCards(olena, NOW);
const byId = (id: string) => cards.find((c) => c.deal.id === id)!;

describe('pipelineCards', () => {
  it('a manager sees only her 18 open deals', () => {
    expect(cards).toHaveLength(18);
    expect(cards.every((c) => c.deal.ownerId === 'u1')).toBe(true);
  });

  it('stuck deal: Translogistic, 4 days in "Applications submitted" (SLA 3)', () => {
    expect(byId('d5')).toMatchObject({ stuck: true, daysInStage: 4, slaDays: 3, applications: 2 });
  });

  it('coffee shop gets the expiring-document badge', () => {
    expect(byId('d2').docAlert).toEqual({
      kind: 'expiring',
      text: 'Tax clearance certificate expires in 4 days',
    });
    expect(byId('d1').docAlert).toBeNull();
  });

  it('no seeded deal has a pending stage suggestion', () => {
    expect(cards.filter((c) => c.suggestion)).toEqual([]);
  });
});

describe('filters and columns', () => {
  it('only stuck', () => {
    expect(
      filterCards(cards, { ...NO_FILTERS, onlyStuck: true })
        .map((c) => c.deal.id)
        .sort(),
    ).toEqual(['d10', 'd24', 'd5']);
  });

  it('product and amount range', () => {
    const leasing = filterCards(cards, { ...NO_FILTERS, product: 'Leasing' });
    expect(leasing.every((c) => c.deal.product === 'Leasing')).toBe(true);
    const big = filterCards(cards, { ...NO_FILTERS, amount: '5to10' });
    expect(big.every((c) => c.deal.requestedAmount >= 5e6 && c.deal.requestedAmount < 10e6)).toBe(
      true,
    );
    expect(big.map((c) => c.deal.id)).toContain('d1');
  });

  it('owner filter (head)', () => {
    const head = pipelineCards(all, NOW);
    expect(
      filterCards(head, { ...NO_FILTERS, ownerId: 'u3' }).every((c) => c.deal.ownerId === 'u3'),
    ).toBe(true);
  });

  it('seven columns in funnel order, stuck deals first, with sums', () => {
    const columns = pipelineColumns(cards);
    expect(columns.map((c) => c.stage)).toEqual([
      'new',
      'qual',
      'docs',
      'banks',
      'submitted',
      'decision',
      'signing',
    ]);
    const qual = columns.find((c) => c.stage === 'qual')!;
    expect(qual.cards[0]?.deal.id).toBe('d10'); // stuck first
    expect(qual.sum).toBe(qual.cards.reduce((s, c) => s + c.deal.requestedAmount, 0));
  });

  it('summary: count, amount and weighted commission', () => {
    const s = pipelineSummary(cards);
    expect(s.count).toBe(18);
    expect(s.weighted).toBeGreaterThan(0);
    expect(s.weighted).toBeLessThan(s.amount * 0.02);
  });

  it('closed deals, newest first', () => {
    const { won, lost } = closedDeals(olena, NO_FILTERS);
    expect(won.map((c) => c.deal.id)).toEqual(['d31', 'd28', 'd29']);
    expect(lost.map((c) => c.deal.id)).toEqual(['d30']);
  });
});

describe('moveDeal', () => {
  it('blocked: no applications → cannot enter "Applications submitted"; nothing changes', () => {
    const r = moveDeal(all, 'd17', 'submitted', NOW);
    expect(r.check).toMatchObject({ allowed: false, code: 'no_applications' });
    expect(r.data).toBe(all);
  });

  it('blocked: Won without a payout', () => {
    expect(moveDeal(all, 'd1', 'won', NOW).check).toMatchObject({
      allowed: false,
      code: 'not_disbursed',
    });
  });

  it('blocked: Lost without a reason', () => {
    expect(moveDeal(all, 'd4', 'lost', NOW).check).toMatchObject({
      allowed: false,
      code: 'reason_required',
    });
  });

  it('entering Document collection generates the checklist and one task per missing document + a reminder', () => {
    const r = moveDeal(all, 'd4', 'docs', NOW); // Poltava Mill (LLC, loan): no checklist yet
    expect(r.check.allowed).toBe(true);
    const docs = r.data.documents.filter((d) => d.dealId === 'd4');
    expect(docs).toHaveLength(7);
    expect(docs.every((d) => d.status === 'not_requested')).toBe(true);
    expect(r.tasks).toHaveLength(8);
    expect(r.tasks[0]?.title).toBe('Get state register extract');
    expect(r.tasks.at(-1)?.title).toBe('Remind client about documents');
    const moved = r.data.deals.find((d) => d.id === 'd4')!;
    expect(moved).toMatchObject({ stage: 'docs', stageEnteredAt: NOW.toISOString() });
    expect(r.data.interactions[0]).toMatchObject({
      type: 'stage_change',
      auto: true,
      dealId: 'd4',
    });
    expect(new Set(r.data.tasks.map((t) => t.id)).size).toBe(r.data.tasks.length);
  });

  it('moving back into Document collection does not duplicate open tasks', () => {
    const first = moveDeal(all, 'd4', 'docs', NOW);
    const back = moveDeal(first.data, 'd4', 'qual', NOW);
    const again = moveDeal(back.data, 'd4', 'docs', NOW);
    expect(again.tasks).toEqual([]);
  });

  it('Lost with a reason records it; other moves create no tasks', () => {
    const r = moveDeal(all, 'd25', 'lost', NOW, 'Went to competitor');
    expect(r.data.deals.find((d) => d.id === 'd25')).toMatchObject({
      stage: 'lost',
      lostReason: 'Went to competitor',
    });
    expect(r.tasks).toEqual([]);
    expect(r.data.interactions[0]?.summary).toBe('Deal marked as lost: Went to competitor');
  });

  it('Won after disbursement creates the commission invoice task', () => {
    const paid = {
      ...all,
      applications: all.applications.map((a) =>
        a.id === 'd1-a3' ? { ...a, status: 'disbursed' as const } : a,
      ),
    };
    const r = moveDeal(paid, 'd1', 'won', NOW);
    expect(r.check.allowed).toBe(true);
    expect(r.tasks.map((t) => t.title)).toEqual(['Issue commission invoice']);
  });
});
