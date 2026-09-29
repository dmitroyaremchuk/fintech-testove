// Dashboard metrics. Every number on both dashboards comes from here — nothing is hardcoded.
// Pure functions over a role-scoped dataset (the head passes the whole team, a manager their own).

import { LOSS_REASONS, STAGES, type LossReason, type OpenStageKey } from '../constants';
import { calendarDaysBetween } from '../dates';
import { expectedCommission, weightedCommission } from '../rules/commission';
import { calcDaysInStage, isClosedStage, isStuck, stageOrder } from '../rules/stages';
import { isOverloaded } from '../rules/reassign';
import { isOverdue } from '../rules/tasks';
import type { BankApplication, Deal, Id, User } from '../types';
import { bankStats, type BankStat } from './banks';
import type { Dataset } from './dataset';

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Period filter ────────────────────────────────────────────

export type Period = 'month' | '30d' | 'quarter' | '12m';

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'quarter', label: 'This quarter' },
  { id: '12m', label: 'Last 12 months' },
];

export interface PeriodRange {
  from: Date;
  to: Date;
  /** Monthly targets are multiplied by this. */
  months: number;
  /** "September 2026", "Q3 2026", "Last 30 days", "Last 12 months". */
  title: string;
}

export function periodRange(period: Period, now: Date): PeriodRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'month':
      return {
        from: new Date(y, m, 1),
        to: now,
        months: 1,
        title: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now),
      };
    case '30d':
      return {
        from: new Date(now.getTime() - 30 * DAY_MS),
        to: now,
        months: 1,
        title: 'Last 30 days',
      };
    case 'quarter': {
      const q = Math.floor(m / 3);
      return { from: new Date(y, q * 3, 1), to: now, months: 3, title: `Q${q + 1} ${y}` };
    }
    case '12m':
      return {
        from: new Date(y - 1, m, now.getDate()),
        to: now,
        months: 12,
        title: 'Last 12 months',
      };
  }
}

function within(iso: string | null, range: PeriodRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

const appsOf = (data: Pick<Dataset, 'applications'>, dealId: Id) =>
  data.applications.filter((a) => a.dealId === dealId);

// ── Funnel (snapshot of open deals) ─────────────────────────

export interface FunnelStage {
  stage: OpenStageKey;
  count: number;
  amount: number;
  /** Average days the open deals have spent in this stage so far. */
  avgDays: number | null;
  slaDays: number;
  overSla: number;
  /** Average exceeds the SLA: the process slows down here. */
  slow: boolean;
}

export function funnel(data: Pick<Dataset, 'deals'>, now: Date): FunnelStage[] {
  return STAGES.map((s) => {
    const deals = data.deals.filter((d) => d.stage === s.key);
    const days = deals.map((d) => calcDaysInStage(d, now));
    const avgDays = days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
    return {
      stage: s.key as OpenStageKey,
      count: deals.length,
      amount: deals.reduce((sum, d) => sum + d.requestedAmount, 0),
      avgDays,
      slaDays: s.slaDays,
      overSla: deals.filter((d) => isStuck(d, now)).length,
      slow: avgDays !== null && avgDays > s.slaDays,
    };
  });
}

// ── Conversion ───────────────────────────────────────────────

/** Furthest open stage a deal reached: its current stage, the last stage for Won, lostAtStage for Lost. */
function reachedOrder(deal: Deal): number {
  if (deal.stage === 'won') return STAGES.length - 1;
  if (deal.stage === 'lost') return deal.lostAtStage ? stageOrder(deal.lostAtStage) : 0;
  return stageOrder(deal.stage);
}

export interface Conversion {
  /** Deals created in the period. */
  total: number;
  /** Per stage: how many reached it, and the share that went on to the next one. */
  stages: { stage: OpenStageKey; reached: number; toNext: number | null }[];
  /** Deals closed in the period (by close date, whenever they were created). */
  closedWon: number;
  closedLost: number;
  /** Won ÷ (won + lost) among deals closed in the period; null when nothing closed. */
  winRate: number | null;
}

export function conversion(data: Pick<Dataset, 'deals'>, range: PeriodRange): Conversion {
  const deals = data.deals.filter((d) => within(d.createdAt, range));
  const reached = STAGES.map((_, i) => deals.filter((d) => reachedOrder(d) >= i).length);
  const won = deals.filter((d) => d.stage === 'won').length;
  const closed = data.deals.filter(
    (d) => isClosedStage(d.stage) && within(d.stageEnteredAt, range),
  );
  const closedWon = closed.filter((d) => d.stage === 'won').length;
  return {
    total: deals.length,
    stages: STAGES.map((s, i) => {
      const next = i + 1 < STAGES.length ? reached[i + 1]! : won;
      return {
        stage: s.key as OpenStageKey,
        reached: reached[i]!,
        toNext: reached[i] ? next / reached[i]! : null,
      };
    }),
    closedWon,
    closedLost: closed.length - closedWon,
    winRate: closed.length ? closedWon / closed.length : null,
  };
}

// ── Lead to payout ───────────────────────────────────────────

export interface LeadToPayout {
  deals: number;
  /** Average calendar days from lead created to money paid out; null without payouts. */
  avgDays: number | null;
}

export function leadToPayout(data: Pick<Dataset, 'deals'>, range: PeriodRange): LeadToPayout {
  const won = data.deals.filter((d) => d.stage === 'won' && within(d.stageEnteredAt, range));
  const days = won.map((d) =>
    calendarDaysBetween(new Date(d.createdAt), new Date(d.stageEnteredAt)),
  );
  return {
    deals: won.length,
    avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
  };
}

// ── Banks ────────────────────────────────────────────────────

/** Bank performance for applications decided in the period (approval rate, speed, rate, payouts). */
export function bankPerformance(
  data: Pick<Dataset, 'applications' | 'deals'>,
  range: PeriodRange,
): {
  banks: BankStat[];
  applications: number;
} {
  const apps: BankApplication[] = data.applications.filter(
    (a) => within(a.decidedAt, range) || (!a.decidedAt && within(a.submittedAt, range)),
  );
  // Payouts count when the money moved (the deal was won in the period), not when the bank approved.
  const paidInPeriod = new Set(
    data.deals.filter((d) => d.stage === 'won' && within(d.stageEnteredAt, range)).map((d) => d.id),
  );
  const paid = data.applications.filter(
    (a) => a.status === 'disbursed' && paidInPeriod.has(a.dealId),
  );
  const stats = [...bankStats({ applications: apps }).values()].map((b) => ({
    ...b,
    disbursed: paid.filter((a) => a.bank === b.bank).length,
  }));
  return {
    banks: stats.sort((a, b) => b.applications - a.applications),
    applications: apps.length,
  };
}

// ── Commission ───────────────────────────────────────────────

/** Sum of commission weighted by stage probability over open deals — the forecast. */
export function weightedForecast(data: Pick<Dataset, 'deals' | 'applications'>): number {
  return data.deals
    .filter((d) => !isClosedStage(d.stage))
    .reduce((sum, d) => sum + weightedCommission(d, appsOf(data, d.id)), 0);
}

const FINAL_STAGES: ReadonlySet<string> = new Set(['decision', 'signing']);

export interface TargetProgress {
  target: number;
  /** Commission on money paid out in the period. */
  earned: number;
  /** earned ÷ target (0 when there is no target). */
  ratio: number;
  /** Weighted commission sitting in Bank decisions and Signing — what can still land soon. */
  inFinalStages: number;
}

/** Progress of these users to their monthly targets (scaled to the period). */
export function targetProgress(
  data: Pick<Dataset, 'deals' | 'applications' | 'users'>,
  userIds: readonly Id[],
  range: PeriodRange,
): TargetProgress {
  const ids = new Set(userIds);
  const target =
    data.users.filter((u) => ids.has(u.id)).reduce((s, u) => s + u.monthlyTarget, 0) * range.months;
  const mine = data.deals.filter((d) => ids.has(d.ownerId));
  const earned = mine
    .filter((d) => d.stage === 'won' && within(d.stageEnteredAt, range))
    .reduce((s, d) => s + expectedCommission(d, appsOf(data, d.id)), 0);
  const inFinalStages = mine
    .filter((d) => FINAL_STAGES.has(d.stage))
    .reduce((s, d) => s + weightedCommission(d, appsOf(data, d.id)), 0);
  return { target, earned, ratio: target ? earned / target : 0, inFinalStages };
}

// ── Team ─────────────────────────────────────────────────────

export interface ManagerLoad {
  user: User;
  openDeals: number;
  overdueTasks: number;
  pipeline: number;
  overSla: number;
  progress: TargetProgress;
  overloaded: boolean;
}

/** Workload per manager, busiest first. */
export function teamWorkload(data: Dataset, now: Date, range: PeriodRange): ManagerLoad[] {
  return data.users
    .filter((u) => u.role === 'manager')
    .map((user) => {
      const open = data.deals.filter((d) => d.ownerId === user.id && !isClosedStage(d.stage));
      const overdue = data.tasks.filter(
        (t) => t.assigneeId === user.id && isOverdue(t, now),
      ).length;
      return {
        user,
        openDeals: open.length,
        overdueTasks: overdue,
        pipeline: open.reduce((s, d) => s + d.requestedAmount, 0),
        overSla: open.filter((d) => isStuck(d, now)).length,
        progress: targetProgress(data, [user.id], range),
        overloaded: isOverloaded({ openDeals: open.length, overdueTasks: overdue }),
      };
    })
    .sort((a, b) => b.openDeals - a.openDeals || b.overdueTasks - a.overdueTasks);
}

// ── Loss reasons ─────────────────────────────────────────────

export interface LossReasonShare {
  reason: LossReason;
  count: number;
  share: number;
}

/** Deals lost in the period, by reason, most frequent first (every reason listed, zeros last). */
export function lossReasons(
  data: Pick<Dataset, 'deals'>,
  range: PeriodRange,
): { total: number; reasons: LossReasonShare[] } {
  const lost = data.deals.filter((d) => d.stage === 'lost' && within(d.stageEnteredAt, range));
  const reasons = LOSS_REASONS.map((reason) => {
    const count = lost.filter((d) => d.lostReason === reason).length;
    return { reason, count, share: lost.length ? count / lost.length : 0 };
  }).sort((a, b) => b.count - a.count);
  return { total: lost.length, reasons };
}

// ── Snapshot counters ────────────────────────────────────────

export function stuckSummary(data: Pick<Dataset, 'deals'>, now: Date) {
  const stuck = data.deals.filter((d) => !isClosedStage(d.stage) && isStuck(d, now));
  return {
    count: stuck.length,
    amount: stuck.reduce((s, d) => s + d.requestedAmount, 0),
    owners: new Set(stuck.map((d) => d.ownerId)).size,
  };
}

export function openPipeline(data: Pick<Dataset, 'deals'>) {
  const open = data.deals.filter((d) => !isClosedStage(d.stage));
  return { count: open.length, amount: open.reduce((s, d) => s + d.requestedAmount, 0) };
}
