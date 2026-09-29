import { describe, expect, it } from 'vitest';
import { calcDaysInStage, daysOverSla, isStuck, stageOrder, stageProbability } from './stages';
import { NOW, local, makeDeal } from './test-fixtures';

describe('calcDaysInStage', () => {
  it('is 0 on the day the deal entered the stage', () => {
    expect(calcDaysInStage(makeDeal({ stageEnteredAt: local(2026, 9, 29, 8) }), NOW)).toBe(0);
  });

  it('counts calendar days: entered 23:50 yesterday = 1 day', () => {
    expect(calcDaysInStage(makeDeal({ stageEnteredAt: local(2026, 9, 28, 23, 50) }), NOW)).toBe(1);
  });

  it('never goes negative if stageEnteredAt is in the future (clock skew, bad data)', () => {
    expect(calcDaysInStage(makeDeal({ stageEnteredAt: local(2026, 10, 5) }), NOW)).toBe(0);
  });
});

describe('isStuck', () => {
  it('is not stuck exactly at the SLA ("7 of 7 d")', () => {
    const deal = makeDeal({ stage: 'docs', stageEnteredAt: local(2026, 9, 22) });
    expect(calcDaysInStage(deal, NOW)).toBe(7);
    expect(isStuck(deal, NOW)).toBe(false);
  });

  it('is stuck one day over the SLA', () => {
    expect(isStuck(makeDeal({ stage: 'docs', stageEnteredAt: local(2026, 9, 21) }), NOW)).toBe(
      true,
    );
  });

  it('story 3: construction company, 20 days in "Bank decisions" (SLA 10)', () => {
    const deal = makeDeal({ stage: 'decision', stageEnteredAt: local(2026, 9, 9) });
    expect(isStuck(deal, NOW)).toBe(true);
    expect(daysOverSla(deal, NOW)).toBe(10);
  });

  it('New lead is stuck after 2 days (SLA 1)', () => {
    expect(isStuck(makeDeal({ stage: 'new', stageEnteredAt: local(2026, 9, 27) }), NOW)).toBe(true);
  });

  it('Won and Lost deals are never stuck, however old', () => {
    const old = local(2026, 1, 1);
    expect(isStuck(makeDeal({ stage: 'won', stageEnteredAt: old }), NOW)).toBe(false);
    expect(isStuck(makeDeal({ stage: 'lost', stageEnteredAt: old }), NOW)).toBe(false);
    expect(daysOverSla(makeDeal({ stage: 'lost', stageEnteredAt: old }), NOW)).toBe(0);
  });
});

describe('stageProbability / stageOrder', () => {
  it('uses stage probabilities, 1 for Won, 0 for Lost', () => {
    expect(stageProbability('new')).toBe(0.05);
    expect(stageProbability('signing')).toBe(0.85);
    expect(stageProbability('won')).toBe(1);
    expect(stageProbability('lost')).toBe(0);
  });

  it('orders the funnel with Won last and Lost outside it', () => {
    expect(stageOrder('new')).toBe(0);
    expect(stageOrder('signing')).toBe(6);
    expect(stageOrder('won')).toBe(7);
    expect(stageOrder('lost')).toBe(-1);
  });
});
