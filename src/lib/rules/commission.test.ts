import { describe, expect, it } from 'vitest';
import { commissionBase, expectedCommission, weightedCommission } from './commission';
import { makeApp, makeDeal } from './test-fixtures';

describe('commission', () => {
  it('uses requested amount × 2% × stage probability by default', () => {
    const deal = makeDeal({ stage: 'docs', requestedAmount: 600_000 });
    expect(expectedCommission(deal, [])).toBe(12_000);
    expect(weightedCommission(deal, [])).toBeCloseTo(3_000); // × 0.25
  });

  it('uses the per-deal rate when set', () => {
    const deal = makeDeal({ stage: 'decision', requestedAmount: 1_000_000, commissionRate: 0.03 });
    expect(expectedCommission(deal, [])).toBe(30_000);
  });

  it('story 1: Agro-Skhid — base is the offer the client accepted, not the request', () => {
    const deal = makeDeal({ stage: 'signing', requestedAmount: 8_500_000 });
    const apps = [
      makeApp('rejected', 'Dniprobank'),
      makeApp('rejected', 'Karpatskyi'),
      makeApp('accepted', 'Universal Capital', { amount: 8_000_000 }),
      makeApp('approved', 'FinTrust', { amount: 8_500_000 }),
    ];
    expect(commissionBase(deal, apps)).toBe(8_000_000);
    expect(expectedCommission(deal, apps)).toBe(160_000);
    expect(weightedCommission(deal, apps)).toBeCloseTo(136_000); // × 0.85, as in the design
  });

  it('no applications: estimates from the requested amount', () => {
    expect(commissionBase(makeDeal({ stage: 'banks' }), [])).toBe(8_500_000);
  });

  it('all applications rejected: still an estimate from the request until the deal moves', () => {
    const deal = makeDeal({ stage: 'decision' });
    const apps = [makeApp('rejected'), makeApp('rejected', 'Karpatskyi')];
    expect(commissionBase(deal, apps)).toBe(8_500_000);
  });

  it('Won: commission on the amount actually disbursed, at full weight', () => {
    const deal = makeDeal({ stage: 'won', requestedAmount: 8_500_000 });
    const apps = [
      makeApp('disbursed', 'Universal Capital', { amount: 8_000_000 }),
      makeApp('approved', 'FinTrust'),
    ];
    expect(expectedCommission(deal, apps)).toBe(160_000);
    expect(weightedCommission(deal, apps)).toBe(160_000);
  });

  it('Won with nothing disbursed (invalid data) earns nothing rather than inventing revenue', () => {
    const deal = makeDeal({ stage: 'won' });
    expect(expectedCommission(deal, [makeApp('accepted')])).toBe(0);
  });

  it('Lost earns nothing, even with an approved offer', () => {
    const deal = makeDeal({ stage: 'lost', lostReason: 'Went to competitor' });
    expect(expectedCommission(deal, [makeApp('approved')])).toBe(0);
    expect(weightedCommission(deal, [makeApp('approved')])).toBe(0);
  });
});
