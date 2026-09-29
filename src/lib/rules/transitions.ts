import { LOSS_REASONS, type LossReason, type StageKey } from '../constants';
import type { BankApplication, Deal } from '../types';
import { hasDisbursed, summarizeApplications, untriedBanks } from './applications';
import { getStage, isClosedStage, stageOrder } from './stages';

export type MoveBlockCode =
  | 'same_stage'
  | 'deal_closed'
  | 'reason_required'
  | 'not_disbursed'
  | 'no_applications'
  | 'applications_not_sent'
  | 'no_approval';

export type MoveCheck =
  { allowed: true } | { allowed: false; code: MoveBlockCode; message: string };

export interface MoveContext {
  applications: readonly Pick<BankApplication, 'status'>[];
  /** Needed only when moving to Lost. */
  lostReason?: LossReason | null;
}

const ALLOWED: MoveCheck = { allowed: true };
const SUBMITTED_ORDER = stageOrder('submitted');

function blocked(code: MoveBlockCode, message: string): MoveCheck {
  return { allowed: false, code, message };
}

/**
 * Whether a deal may move to `target`, and if not, a user-facing reason.
 * Moves backwards between open stages are allowed (e.g. back to Bank selection after rejections).
 */
export function canMoveToStage(
  deal: Pick<Deal, 'stage'>,
  target: StageKey,
  { applications, lostReason }: MoveContext,
): MoveCheck {
  const to = getStage(target).label;

  if (isClosedStage(deal.stage)) {
    return blocked(
      'deal_closed',
      `The deal is already “${getStage(deal.stage).label}”. Closed deals can’t be moved.`,
    );
  }
  if (deal.stage === target) return blocked('same_stage', `The deal is already in “${to}”.`);

  if (target === 'lost') {
    if (!lostReason || !LOSS_REASONS.includes(lostReason)) {
      return blocked(
        'reason_required',
        'Choose a reason to mark the deal as lost. It feeds the “Loss reasons” report.',
      );
    }
    return ALLOWED;
  }

  if (target === 'won') {
    if (!hasDisbursed(applications)) {
      return blocked(
        'not_disbursed',
        'Can’t mark as Won: no application is Disbursed. A deal is won only after the money is paid out.',
      );
    }
    return ALLOWED;
  }

  if (stageOrder(target) >= SUBMITTED_ORDER) {
    const summary = summarizeApplications(applications);
    if (summary.total === 0) {
      return blocked(
        'no_applications',
        `Can’t move to “${to}”: the deal has no bank applications.`,
      );
    }
    if (summary.preparing === summary.total) {
      return blocked(
        'applications_not_sent',
        `Can’t move to “${to}”: no application has been sent to a bank yet.`,
      );
    }
    if (target === 'signing' && summary.approved + summary.accepted + summary.disbursed === 0) {
      return blocked(
        'no_approval',
        summary.allRejected
          ? `Can’t move to “${to}”: all banks declined.`
          : `Can’t move to “${to}”: no bank has approved the deal yet.`,
      );
    }
  }

  return ALLOWED;
}

export interface StageSuggestion {
  stage: StageKey;
  /** Why the system proposes this move; shown in the confirmation prompt. */
  reason: string;
  /** Set when the suggestion is Lost. */
  lostReason?: LossReason;
}

function derivedStage(
  apps: readonly Pick<BankApplication, 'status' | 'bank'>[],
): StageSuggestion | null {
  const s = summarizeApplications(apps);
  if (s.disbursed > 0) return { stage: 'won', reason: 'Funds were disbursed.' };
  if (s.accepted > 0) return { stage: 'signing', reason: 'The client accepted a bank offer.' };
  if (s.total - s.preparing === 0) return null;

  if (s.allRejected) {
    const untried = untriedBanks(apps);
    if (s.preparing > 0) {
      return {
        stage: 'banks',
        reason: 'All sent applications were declined; a new application is being prepared.',
      };
    }
    if (untried.length > 0) {
      return {
        stage: 'banks',
        reason: `All ${s.rejected} banks declined. Not tried yet: ${untried.join(', ')}.`,
      };
    }
    return {
      stage: 'lost',
      reason: 'All partner banks declined.',
      lostReason: 'All banks declined',
    };
  }

  if (s.allDecided) {
    return {
      stage: 'signing',
      reason: `${s.approved} of ${s.total - s.preparing} banks approved. The client can choose an offer.`,
    };
  }
  const bankEngaged = apps.some((a) => a.status !== 'submitted' && a.status !== 'prep');
  return bankEngaged
    ? { stage: 'decision', reason: 'Banks have started reviewing the applications.' }
    : { stage: 'submitted', reason: 'Applications were sent to banks.' };
}

/**
 * The stage the bank applications point to, when it differs from the current one.
 * The UI proposes it and asks the user to confirm (AGENTS.md rule 1); nothing moves automatically.
 *
 * Only forward moves are suggested, except when every bank declined: then the deal goes back to
 * Bank selection (untried banks left) or to Lost with "All banks declined" (none left).
 */
export function suggestStage(
  deal: Pick<Deal, 'stage'>,
  apps: readonly Pick<BankApplication, 'status' | 'bank'>[],
): StageSuggestion | null {
  if (isClosedStage(deal.stage)) return null;
  const suggestion = derivedStage(apps);
  if (!suggestion || suggestion.stage === deal.stage) return null;

  const allRejectedCase = suggestion.stage === 'banks' || suggestion.stage === 'lost';
  if (!allRejectedCase && stageOrder(suggestion.stage) <= stageOrder(deal.stage)) return null;

  const check = canMoveToStage(deal, suggestion.stage, {
    applications: apps,
    lostReason: suggestion.lostReason ?? null,
  });
  return check.allowed ? suggestion : null;
}
