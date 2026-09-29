// Partner bank statistics across ALL applications. Aggregates only (counts, rates, averages),
// no client data, so every role may see them — they help pick the next bank to try.

import { BANKS, type Bank } from '../constants';
import { POSITIVE } from '../rules/applications';
import type { Dataset } from './dataset';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BankStat {
  bank: Bank;
  applications: number;
  decided: number;
  /** Share of decided applications the bank approved; null until it decided anything. */
  approvalRate: number | null;
  /** Average days from submission to decision; null without decisions. */
  avgDecisionDays: number | null;
}

export function bankStats(data: Pick<Dataset, 'applications'>): Map<Bank, BankStat> {
  return new Map(
    BANKS.map((bank) => {
      const apps = data.applications.filter((a) => a.bank === bank);
      const decided = apps.filter((a) => a.decidedAt && a.submittedAt);
      const approved = decided.filter((a) => POSITIVE.has(a.status)).length;
      const days = decided.map(
        (a) => (new Date(a.decidedAt!).getTime() - new Date(a.submittedAt!).getTime()) / DAY_MS,
      );
      return [
        bank,
        {
          bank,
          applications: apps.length,
          decided: decided.length,
          approvalRate: decided.length ? approved / decided.length : null,
          avgDecisionDays: days.length ? days.reduce((s, d) => s + d, 0) / days.length : null,
        },
      ];
    }),
  );
}

/** Banks sorted by approval rate, best first (banks without decisions last). */
export function banksByApproval(
  stats: Map<Bank, BankStat>,
  banks: readonly Bank[] = BANKS,
): BankStat[] {
  return banks
    .map((b) => stats.get(b)!)
    .sort((a, b) => (b.approvalRate ?? -1) - (a.approvalRate ?? -1));
}
