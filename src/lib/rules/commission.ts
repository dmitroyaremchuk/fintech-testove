import { COMMISSION_RATE } from '../constants';
import type { BankApplication, Deal } from '../types';
import { stageProbability } from './stages';

type DealForCommission = Pick<Deal, 'stage' | 'requestedAmount' | 'commissionRate'>;
type AppForCommission = Pick<BankApplication, 'status' | 'amount'>;

/**
 * The amount commission is charged on. Revenue is earned on money actually paid out, so:
 * 1. Won / any disbursed → sum of disbursed amounts;
 * 2. an offer the client accepted → its amount;
 * 3. otherwise → the requested amount (best available estimate).
 * Lost deals earn nothing.
 */
export function commissionBase(deal: DealForCommission, apps: readonly AppForCommission[]): number {
  if (deal.stage === 'lost') return 0;
  const disbursed = apps.filter((a) => a.status === 'disbursed');
  if (disbursed.length > 0) return disbursed.reduce((sum, a) => sum + a.amount, 0);
  if (deal.stage === 'won') return 0; // Won without a disbursed application is invalid data.
  const accepted = apps.find((a) => a.status === 'accepted');
  return accepted ? accepted.amount : deal.requestedAmount;
}

/** Full commission if the deal closes: base × rate. */
export function expectedCommission(
  deal: DealForCommission,
  apps: readonly AppForCommission[],
): number {
  return commissionBase(deal, apps) * (deal.commissionRate ?? COMMISSION_RATE);
}

/** Commission weighted by stage probability — what dashboards and forecasts sum up. */
export function weightedCommission(
  deal: DealForCommission,
  apps: readonly AppForCommission[],
): number {
  return expectedCommission(deal, apps) * stageProbability(deal.stage);
}
