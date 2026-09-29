import { describe, expect, it } from 'vitest';
import {
  bankPerformance,
  conversion,
  funnel,
  leadToPayout,
  lossReasons,
  openPipeline,
  periodRange,
  stuckSummary,
  targetProgress,
  teamWorkload,
  weightedForecast,
} from './metrics';
import { moveDeal } from './mutations';
import { weightedCommission } from '../rules/commission';
import { makeDeal } from '../rules/test-fixtures';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena = scopeDataset(all, { role: 'manager', userId: 'u1' });
const month = periodRange('month', NOW);
const year = periodRange('12m', NOW);

describe('periodRange', () => {
  it('month, 30 days, quarter, 12 months', () => {
    expect(month).toMatchObject({ from: new Date(2026, 8, 1), months: 1, title: 'September 2026' });
    expect(periodRange('quarter', NOW)).toMatchObject({
      from: new Date(2026, 6, 1),
      months: 3,
      title: 'Q3 2026',
    });
    expect(periodRange('30d', NOW).from).toEqual(new Date(NOW.getTime() - 30 * 864e5));
    expect(year).toMatchObject({ from: new Date(2025, 8, 29), months: 12 });
  });
});

describe('funnel', () => {
  const f = funnel(olena, NOW);
  it('seven stages, counts add up to the open deals', () => {
    expect(f.map((s) => s.stage)).toEqual([
      'new',
      'qual',
      'docs',
      'banks',
      'submitted',
      'decision',
      'signing',
    ]);
    expect(f.reduce((s, x) => s + x.count, 0)).toBe(18);
  });

  it('over-SLA count and the "slow stage" flag', () => {
    const qual = f.find((s) => s.stage === 'qual')!;
    expect(qual.overSla).toBe(1); // Melnychuk, 5 d of 3
    const head = funnel(all, NOW).find((s) => s.stage === 'decision')!;
    expect(head.avgDays).toBeGreaterThan(0);
    expect(head.slow).toBe((head.avgDays ?? 0) > head.slaDays);
  });

  it('empty stage → no average', () => {
    const empty = funnel({ deals: [] }, NOW);
    expect(empty.every((s) => s.count === 0 && s.avgDays === null && !s.slow)).toBe(true);
  });
});

describe('conversion', () => {
  it('reached counts never grow along the funnel', () => {
    const c = conversion(all, year);
    const reached = c.stages.map((s) => s.reached);
    expect(reached).toEqual([...reached].sort((a, b) => b - a));
    expect(c.stages[0]?.reached).toBe(c.total);
  });

  it('win rate = won ÷ (won + lost) among deals closed in the period', () => {
    const c = conversion(all, year);
    expect(c.closedWon).toBe(8);
    expect(c.closedLost).toBe(7);
    expect(c.winRate).toBeCloseTo(8 / 15);
    expect(conversion(olena, month)).toMatchObject({ closedWon: 1, closedLost: 0, winRate: 1 });
  });

  it('a Lost deal counts up to the stage it was lost in', () => {
    const deals = [
      makeDeal({ id: 'a', stage: 'lost', lostAtStage: 'docs', createdAt: NOW.toISOString() }),
      makeDeal({ id: 'b', stage: 'won', createdAt: NOW.toISOString() }),
    ];
    const c = conversion({ deals }, month);
    expect(c.stages.map((s) => s.reached)).toEqual([2, 2, 2, 1, 1, 1, 1]);
    expect(c.stages[2]?.toNext).toBe(0.5);
    expect(c.stages[6]?.toNext).toBe(1); // signing → won
  });

  it('moving a deal to Lost records the stage it was in', () => {
    const r = moveDeal(all, 'd4', 'lost', NOW, 'Unresponsive');
    expect(r.data.deals.find((d) => d.id === 'd4')?.lostAtStage).toBe('qual');
  });

  it('no deals in the period → null rates', () => {
    const c = conversion({ deals: [] }, month);
    expect(c.winRate).toBeNull();
    expect(c.stages[0]?.toNext).toBeNull();
  });
});

describe('leadToPayout', () => {
  it('average days from lead to payout for deals won in the period', () => {
    const r = leadToPayout(all, year);
    expect(r.deals).toBe(8); // 10 won; the 372- and 540-day-old payouts are outside the last 12 months
    expect(r.avgDays).toBeGreaterThan(0);
    expect(leadToPayout({ deals: [] }, year)).toEqual({ deals: 0, avgDays: null });
  });
});

describe('bankPerformance', () => {
  it('approval rate per bank from applications decided in the period', () => {
    const r = bankPerformance(all, year);
    expect(r.banks).toHaveLength(5);
    for (const b of r.banks) {
      if (b.approvalRate !== null) {
        expect(b.approvalRate).toBeGreaterThanOrEqual(0);
        expect(b.approvalRate).toBeLessThanOrEqual(1);
      }
    }
    expect(r.applications).toBeLessThanOrEqual(all.applications.length);
    expect(r.banks.reduce((s, b) => s + b.applications, 0)).toBe(r.applications);
  });

  it('payouts count by when the money moved, not when the bank approved', () => {
    const r = bankPerformance(all, month);
    // September payouts: Smart Pack (FinTrust) and Desna Textile (Sitibud).
    expect(r.banks.reduce((s, b) => s + b.disbursed, 0)).toBe(2);
  });
});

describe('commission', () => {
  it('weighted forecast = sum of weighted commission over open deals', () => {
    const expected = olena.deals
      .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
      .reduce(
        (s, d) =>
          s +
          weightedCommission(
            d,
            olena.applications.filter((a) => a.dealId === d.id),
          ),
        0,
      );
    expect(weightedForecast(olena)).toBeCloseTo(expected);
  });

  it('target progress: commission on money paid out this month vs the monthly target', () => {
    const p = targetProgress(olena, ['u1'], month);
    expect(p.target).toBe(180_000);
    expect(p.earned).toBe(48_000); // Smart Pack loan, 2.4M paid out Sep 11 × 2%
    expect(p.ratio).toBeCloseTo(48_000 / 180_000);
    expect(p.inFinalStages).toBeGreaterThan(0);
  });

  it('the target scales with the period; the team target is the sum of managers', () => {
    expect(targetProgress(all, ['u1'], periodRange('quarter', NOW)).target).toBe(540_000);
    const managers = all.users.filter((u) => u.role === 'manager').map((u) => u.id);
    expect(targetProgress(all, managers, month).target).toBe(720_000);
  });
});

describe('teamWorkload', () => {
  const load = teamWorkload(all, NOW, month);
  it('Olena is the busiest and flagged overloaded (story 5)', () => {
    expect(load[0]).toMatchObject({ openDeals: 18, overdueTasks: 9, overloaded: true });
    expect(load[0]?.user.name).toBe('Olena Koval');
    expect(load.filter((m) => m.overloaded)).toHaveLength(1);
  });
  it('over-SLA counts add up to the team total', () => {
    expect(load.reduce((s, m) => s + m.overSla, 0)).toBe(stuckSummary(all, NOW).count);
  });
  it('pipeline sums match open deals', () => {
    expect(load.reduce((s, m) => s + m.pipeline, 0)).toBe(openPipeline(all).amount);
  });
});

describe('lossReasons', () => {
  it('lost deals in the period by reason, most frequent first', () => {
    const r = lossReasons(all, year);
    expect(r.total).toBe(7);
    expect(r.reasons[0]).toMatchObject({ reason: 'All banks declined', count: 2 });
    expect(r.reasons).toHaveLength(6);
    expect(r.reasons.reduce((s, x) => s + x.count, 0)).toBe(7);
  });
});

describe('snapshot counters', () => {
  it('stuck deals: count, amount at risk, managers involved', () => {
    expect(stuckSummary(olena, NOW)).toMatchObject({ count: 3, owners: 1 });
    expect(stuckSummary(all, NOW)).toMatchObject({ count: 7, owners: 3 });
  });
});
