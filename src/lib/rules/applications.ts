import { BANKS, type ApplicationStatus, type Bank } from '../constants';
import type { BankApplication } from '../types';

/** Not yet sent to the bank. */
export const PREPARING: ReadonlySet<ApplicationStatus> = new Set(['prep']);
/** Sent, waiting for the bank. */
export const PENDING: ReadonlySet<ApplicationStatus> = new Set(['submitted', 'review', 'extra']);
/** The bank said yes (and possibly the client accepted / money was paid). */
export const POSITIVE: ReadonlySet<ApplicationStatus> = new Set([
  'approved',
  'accepted',
  'disbursed',
]);
/** The bank has made a decision, either way. */
export const DECIDED: ReadonlySet<ApplicationStatus> = new Set([...POSITIVE, 'rejected']);

export function isSent(app: Pick<BankApplication, 'status'>): boolean {
  return !PREPARING.has(app.status);
}

export function hasDisbursed(apps: readonly Pick<BankApplication, 'status'>[]): boolean {
  return apps.some((a) => a.status === 'disbursed');
}

/** Banks from the partner list with no application on this deal yet (any status). */
export function untriedBanks(apps: readonly Pick<BankApplication, 'bank'>[]): Bank[] {
  const tried = new Set(apps.map((a) => a.bank));
  return BANKS.filter((b) => !tried.has(b));
}

export interface ApplicationSummary {
  total: number;
  preparing: number;
  pending: number;
  approved: number;
  accepted: number;
  disbursed: number;
  rejected: number;
  /** Sent and every sent application has a decision. */
  allDecided: boolean;
  /** At least one sent, and every sent application was rejected. */
  allRejected: boolean;
}

export function summarizeApplications(
  apps: readonly Pick<BankApplication, 'status'>[],
): ApplicationSummary {
  const count = (pred: (s: ApplicationStatus) => boolean) =>
    apps.filter((a) => pred(a.status)).length;
  const preparing = count((s) => PREPARING.has(s));
  const pending = count((s) => PENDING.has(s));
  const rejected = count((s) => s === 'rejected');
  const sent = apps.length - preparing;
  return {
    total: apps.length,
    preparing,
    pending,
    approved: count((s) => s === 'approved'),
    accepted: count((s) => s === 'accepted'),
    disbursed: count((s) => s === 'disbursed'),
    rejected,
    allDecided: sent > 0 && pending === 0,
    allRejected: sent > 0 && rejected === sent,
  };
}

// ── Status changes ───────────────────────────────────────────

/**
 * Allowed status changes. A bank decides once (approved / rejected are final for the bank);
 * the client can change their mind between approved offers (accepted → approved).
 */
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  prep: ['submitted'],
  submitted: ['review', 'extra', 'approved', 'rejected'],
  review: ['extra', 'approved', 'rejected'],
  extra: ['review', 'approved', 'rejected'],
  approved: ['accepted'],
  accepted: ['disbursed', 'approved'],
  rejected: [],
  disbursed: [],
};

export function canChangeStatus(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

export interface ApprovalTerms {
  amount: number;
  /** Annual rate, percent. */
  rate: number;
  termMonths: number;
}

const MIN_RATE = 1;
const MAX_RATE = 60;
const MAX_TERM_MONTHS = 120;

/** Checks the terms a bank approved. null = valid. */
export function validateApproval(terms: ApprovalTerms): string | null {
  if (!(terms.amount > 0)) return 'Enter the approved amount';
  if (!(terms.rate >= MIN_RATE && terms.rate <= MAX_RATE))
    return `Rate must be between ${MIN_RATE}% and ${MAX_RATE}%`;
  if (
    !Number.isInteger(terms.termMonths) ||
    terms.termMonths < 1 ||
    terms.termMonths > MAX_TERM_MONTHS
  ) {
    return `Term must be 1–${MAX_TERM_MONTHS} months`;
  }
  return null;
}
