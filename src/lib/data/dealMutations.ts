// Deal card actions: bank applications, documents, commission rate, disbursement.
// Pure functions over the full dataset; the store commits the result and Undo restores the input.

import { COMMISSION_PCT_RANGE, type ApplicationStatus, type Bank } from '../constants';
import { addDays } from '../dates';
import { formatMoney } from '../format';
import { canChangeStatus, validateApproval, type ApprovalTerms } from '../rules/applications';
import { autoTasksFor, withoutDuplicates, type AutoTaskEvent } from '../rules/autoTasks';
import { isClosedStage } from '../rules/stages';
import type { BankApplication, Deal, Id, Interaction, NewTask, Task } from '../types';
import type { Dataset } from './dataset';
import { moveDeal, nextId } from './mutations';

/** Renewed documents (e.g. a tax clearance certificate) are tracked for another 30 days. */
const RENEWED_VALIDITY_DAYS = 30;

export type ActionResult =
  { ok: true; data: Dataset; tasks: Task[]; message: string } | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function withTasks(data: Dataset, candidates: NewTask[]): { data: Dataset; tasks: Task[] } {
  const ids = data.tasks.map((t) => t.id);
  const tasks = withoutDuplicates(candidates, data.tasks).map((t) => {
    const id = nextId('t', ids);
    ids.push(id);
    return { ...t, id };
  });
  return { data: { ...data, tasks: [...tasks, ...data.tasks] }, tasks };
}

function logEntry(data: Dataset, deal: Deal, summary: string, now: Date): Dataset {
  const entry: Interaction = {
    id: nextId(
      'i',
      data.interactions.map((i) => i.id),
    ),
    clientId: deal.clientId,
    dealId: deal.id,
    type: 'document',
    date: now.toISOString(),
    authorId: null,
    summary,
    auto: true,
  };
  return { ...data, interactions: [entry, ...data.interactions] };
}

const tasksNote = (tasks: Task[]) =>
  tasks.length ? ` · ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} created` : '';

// ── Applications ─────────────────────────────────────────────

/** New application in "Preparation". One application per bank per deal. */
export function addApplication(
  data: Dataset,
  dealId: Id,
  bank: Bank,
  amount: number,
  now: Date,
): ActionResult {
  const deal = data.deals.find((d) => d.id === dealId);
  if (!deal) return fail('Deal not found');
  if (isClosedStage(deal.stage)) return fail('The deal is closed');
  if (data.applications.some((a) => a.dealId === dealId && a.bank === bank)) {
    return fail(`${bank} already has an application for this deal`);
  }
  if (!(amount > 0)) return fail('Enter the amount');
  const application: BankApplication = {
    id: nextId(
      `${dealId}-a`,
      data.applications.filter((a) => a.dealId === dealId).map((a) => a.id),
    ),
    dealId,
    bank,
    status: 'prep',
    amount,
    rate: null,
    termMonths: null,
    submittedAt: null,
    decidedAt: null,
    rejectionReason: null,
  };
  const next = logEntry(
    { ...data, applications: [...data.applications, application] },
    deal,
    `Application to ${bank} prepared: ${formatMoney(amount)}`,
    now,
  );
  return {
    ok: true,
    data: next,
    tasks: [],
    message: `Application to ${bank} added as “Preparation”`,
  };
}

export interface ApplicationChange {
  to: ApplicationStatus;
  /** Required when a bank approves. */
  terms?: ApprovalTerms;
  /** Required when a bank rejects. */
  reason?: string;
}

/**
 * Changes an application's status along the bank process, records dates and the timeline entry,
 * and creates the matching auto tasks (submitted → status check in 3 working days; extra documents
 * → urgent task; rejection → analyze the reason and name banks not tried yet).
 */
export function changeApplication(
  data: Dataset,
  appId: Id,
  change: ApplicationChange,
  now: Date,
): ActionResult {
  const app = data.applications.find((a) => a.id === appId);
  const deal = app && data.deals.find((d) => d.id === app.dealId);
  if (!app || !deal) return fail('Application not found');
  if (isClosedStage(deal.stage)) return fail('The deal is closed');
  if (!canChangeStatus(app.status, change.to))
    return fail(`Can’t change this application to “${change.to}”`);

  const iso = now.toISOString();
  let updated: BankApplication = { ...app, status: change.to };
  let summary = '';
  const events: AutoTaskEvent[] = [];

  switch (change.to) {
    case 'submitted':
      updated = { ...updated, submittedAt: iso };
      summary = `Application sent to ${app.bank}`;
      events.push({ type: 'application_submitted', deal, application: updated });
      break;
    case 'review':
      summary = `${app.bank} is reviewing the application`;
      break;
    case 'extra':
      summary = `${app.bank} requested additional documents`;
      events.push({ type: 'extra_docs_requested', deal, application: updated });
      break;
    case 'approved': {
      if (app.status === 'accepted') {
        summary = `Client withdrew acceptance of the ${app.bank} offer`;
        break;
      }
      const terms = change.terms;
      const error = terms ? validateApproval(terms) : 'Enter the approved terms';
      if (error || !terms) return fail(error ?? 'Enter the approved terms');
      updated = {
        ...updated,
        amount: terms.amount,
        rate: terms.rate,
        termMonths: terms.termMonths,
        decidedAt: iso,
      };
      summary = `${app.bank} approved: ${formatMoney(terms.amount)} · ${terms.rate}% · ${terms.termMonths} mo.`;
      break;
    }
    case 'rejected': {
      const reason = change.reason?.trim();
      if (!reason) return fail('Enter the rejection reason');
      updated = { ...updated, rejectionReason: reason, decidedAt: iso };
      summary = `${app.bank} rejected: ${reason}`;
      break;
    }
    case 'accepted':
      summary = `Client accepted the ${app.bank} offer`;
      break;
    case 'disbursed':
      summary = `Funds disbursed by ${app.bank}: ${formatMoney(app.amount)}`;
      break;
    case 'prep':
      return fail('An application can’t go back to Preparation');
  }

  // Only one accepted offer per deal: accepting another puts the previous one back to approved.
  const applications = data.applications.map((a) => {
    if (a.id === appId) return updated;
    if (change.to === 'accepted' && a.dealId === deal.id && a.status === 'accepted')
      return { ...a, status: 'approved' as const };
    return a;
  });
  if (change.to === 'rejected') {
    events.push({
      type: 'application_rejected',
      deal,
      application: updated,
      applications: applications.filter((a) => a.dealId === deal.id),
    });
  }

  const logged = logEntry({ ...data, applications }, deal, summary, now);
  const { data: next, tasks } = withTasks(
    logged,
    events.flatMap((e) => autoTasksFor(e, now)),
  );
  return { ok: true, data: next, tasks, message: `${summary}${tasksNote(tasks)}` };
}

/**
 * The client got the money: the accepted application becomes Disbursed and the deal moves to Won
 * through the normal stage rules (which create the commission-invoice task).
 */
export function confirmDisbursement(data: Dataset, dealId: Id, now: Date): ActionResult {
  const accepted = data.applications.find((a) => a.dealId === dealId && a.status === 'accepted');
  if (!accepted) return fail('No accepted offer to disburse');
  const paid = changeApplication(data, accepted.id, { to: 'disbursed' }, now);
  if (!paid.ok) return paid;
  const won = moveDeal(paid.data, dealId, 'won', now);
  if (!won.check.allowed) return fail(won.check.message);
  const tasks = [...paid.tasks, ...won.tasks];
  return {
    ok: true,
    data: won.data,
    tasks,
    message: `Funds disbursed by ${accepted.bank} · deal won${tasksNote(tasks)}`,
  };
}

// ── Documents ────────────────────────────────────────────────

export type DocumentAction = 'request' | 'receive' | 'renew';

/**
 * request: ask the client (plus one "remind client" task per deal, in 3 days);
 * receive: mark received and close the auto tasks for that document;
 * renew: an expiring or expired document is requested again.
 */
export function updateDocument(
  data: Dataset,
  docId: Id,
  action: DocumentAction,
  now: Date,
): ActionResult {
  const doc = data.documents.find((d) => d.id === docId);
  const deal = doc && data.deals.find((d) => d.id === doc.dealId);
  if (!doc || !deal) return fail('Document not found');

  const patch =
    action === 'receive'
      ? {
          status: 'received' as const,
          validUntil: doc.validUntil ? addDays(now, RENEWED_VALIDITY_DAYS).toISOString() : null,
        }
      : { status: 'requested' as const, validUntil: action === 'renew' ? null : doc.validUntil };
  let next: Dataset = {
    ...data,
    documents: data.documents.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
  };
  if (action === 'receive') {
    const keys = new Set([`doc-request:${docId}`, `renew:${docId}`]);
    next = {
      ...next,
      tasks: next.tasks.map((t) =>
        t.status === 'open' && t.autoKey && keys.has(t.autoKey) ? { ...t, status: 'done' } : t,
      ),
    };
  }
  const verb = {
    request: 'Requested from client',
    receive: 'Received',
    renew: 'Renewal requested',
  }[action];
  next = logEntry(next, deal, `${verb}: ${doc.type}`, now);

  if (action === 'receive')
    return { ok: true, data: next, tasks: [], message: `“${doc.type}” received` };
  const { data: withReminder, tasks } = withTasks(
    next,
    autoTasksFor({ type: 'document_requested', deal }, now),
  );
  return {
    ok: true,
    data: withReminder,
    tasks,
    message: `${verb}: “${doc.type}”${tasks.length ? ' · reminder in 3 days' : ''}`,
  };
}

// ── Commission ───────────────────────────────────────────────

/** Commission rate for this deal, as a fraction, clamped to the 1–3% range. */
export function setCommissionRate(data: Dataset, dealId: Id, rate: number): Dataset {
  const min = COMMISSION_PCT_RANGE.min / 100;
  const max = COMMISSION_PCT_RANGE.max / 100;
  const clamped = Math.round(Math.min(max, Math.max(min, rate)) * 1000) / 1000;
  return {
    ...data,
    deals: data.deals.map((d) => (d.id === dealId ? { ...d, commissionRate: clamped } : d)),
  };
}
