// Comparing approved bank offers: monthly payment and total interest of an annuity loan.

import type { BankApplication } from '../types';
import { POSITIVE } from './applications';

/** Annuity payment for `amount` at `ratePct` a year over `months`. 0% → straight split. */
export function monthlyPayment(amount: number, ratePct: number, months: number): number {
  if (months <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return amount / months;
  return (amount * r) / (1 - Math.pow(1 + r, -months));
}

export interface Offer {
  application: BankApplication;
  monthly: number;
  totalInterest: number;
  /** Lowest rate among the offers (ties: all of them). */
  best: boolean;
  /** The client accepted this one (or it was already paid out). */
  chosen: boolean;
}

/** Approved offers (approved / accepted / disbursed with rate and term), lowest rate first. */
export function compareOffers(apps: readonly BankApplication[]): Offer[] {
  const offers = apps.filter(
    (a) => POSITIVE.has(a.status) && a.rate !== null && a.termMonths !== null,
  );
  const best = Math.min(...offers.map((a) => a.rate ?? Infinity));
  return offers
    .map((application) => {
      const monthly = monthlyPayment(
        application.amount,
        application.rate!,
        application.termMonths!,
      );
      return {
        application,
        monthly,
        totalInterest: monthly * application.termMonths! - application.amount,
        best: application.rate === best,
        chosen: application.status === 'accepted' || application.status === 'disbursed',
      };
    })
    .sort((a, b) => a.application.rate! - b.application.rate!);
}
