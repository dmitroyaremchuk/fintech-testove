import { describe, expect, it } from 'vitest';
import { canChangeStatus, validateApproval } from './applications';
import { compareOffers, monthlyPayment } from './offers';
import { makeApp } from './test-fixtures';

describe('monthlyPayment', () => {
  it('matches the design: 8M at 17.9% for 24 months ≈ 399 006 ₴', () => {
    expect(Math.round(monthlyPayment(8_000_000, 17.9, 24))).toBe(399_006);
  });
  it('0% splits evenly; no term → 0', () => {
    expect(monthlyPayment(1_200_000, 0, 12)).toBe(100_000);
    expect(monthlyPayment(1_200_000, 18, 0)).toBe(0);
  });
});

describe('compareOffers', () => {
  const apps = [
    makeApp('rejected', 'Dniprobank'),
    makeApp('approved', 'FinTrust', { amount: 8_500_000, rate: 19.4, termMonths: 18 }),
    makeApp('accepted', 'Universal Capital', { amount: 8_000_000, rate: 17.9, termMonths: 24 }),
    makeApp('review', 'Sitibud'),
  ];
  const offers = compareOffers(apps);

  it('only approved offers, lowest rate first, best and chosen flagged', () => {
    expect(offers.map((o) => o.application.bank)).toEqual(['Universal Capital', 'FinTrust']);
    expect(offers[0]).toMatchObject({ best: true, chosen: true });
    expect(offers[1]).toMatchObject({ best: false, chosen: false });
    expect(Math.round(offers[0]!.totalInterest)).toBe(1_576_153);
  });

  it('no offers → empty', () => {
    expect(compareOffers([makeApp('review')])).toEqual([]);
  });
});

describe('application status changes', () => {
  it('follows the bank process', () => {
    expect(canChangeStatus('prep', 'submitted')).toBe(true);
    expect(canChangeStatus('prep', 'approved')).toBe(false);
    expect(canChangeStatus('review', 'rejected')).toBe(true);
    expect(canChangeStatus('approved', 'accepted')).toBe(true);
    expect(canChangeStatus('approved', 'disbursed')).toBe(false); // client must accept first
    expect(canChangeStatus('accepted', 'disbursed')).toBe(true);
    expect(canChangeStatus('rejected', 'review')).toBe(false);
    expect(canChangeStatus('disbursed', 'accepted')).toBe(false);
  });

  it('validates approval terms', () => {
    expect(validateApproval({ amount: 8e6, rate: 17.9, termMonths: 24 })).toBeNull();
    expect(validateApproval({ amount: 0, rate: 17.9, termMonths: 24 })).toBe(
      'Enter the approved amount',
    );
    expect(validateApproval({ amount: 8e6, rate: 0.5, termMonths: 24 })).toMatch(/Rate/);
    expect(validateApproval({ amount: 8e6, rate: 18, termMonths: 2.5 })).toMatch(/Term/);
  });
});
