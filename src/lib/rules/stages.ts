import { CLOSED_STAGES, STAGES, type Stage, type StageKey } from '../constants';
import { calendarDaysBetween } from '../dates';
import type { Deal } from '../types';

export function getStage(key: StageKey): Stage {
  const stage = STAGES.find((s) => s.key === key) ?? CLOSED_STAGES.find((s) => s.key === key);
  if (!stage) throw new Error(`Unknown stage: ${key}`);
  return stage;
}

export function isClosedStage(key: StageKey): boolean {
  return key === 'won' || key === 'lost';
}

/** Position in the funnel: 0 = New lead … 6 = Signing & disbursement, 7 = Won. Lost = -1. */
export function stageOrder(key: StageKey): number {
  if (key === 'won') return STAGES.length;
  if (key === 'lost') return -1;
  return STAGES.findIndex((s) => s.key === key);
}

/** Calendar days since the deal entered its current stage. Never negative. */
export function calcDaysInStage(deal: Pick<Deal, 'stageEnteredAt'>, now: Date): number {
  return Math.max(0, calendarDaysBetween(new Date(deal.stageEnteredAt), now));
}

/** Days over the stage SLA (0 when within SLA, closed, or the stage has no SLA). */
export function daysOverSla(deal: Pick<Deal, 'stage' | 'stageEnteredAt'>, now: Date): number {
  if (isClosedStage(deal.stage)) return 0;
  const { slaDays } = getStage(deal.stage);
  if (slaDays <= 0) return 0;
  return Math.max(0, calcDaysInStage(deal, now) - slaDays);
}

/**
 * Stuck = days in stage strictly exceed the stage SLA ("7 of 7 d" is still on time).
 * Won and Lost deals are never stuck.
 */
export function isStuck(deal: Pick<Deal, 'stage' | 'stageEnteredAt'>, now: Date): boolean {
  return daysOverSla(deal, now) > 0;
}

/** Probability used to weight commission: stage probability, 1 for Won, 0 for Lost. */
export function stageProbability(key: StageKey): number {
  return getStage(key).probability;
}
