// Auto-task rules (AGENTS.md → Auto-task rules). Pure: each event maps to the tasks to create.
// The store assigns ids, persists, and shows the "N tasks created" toast with Undo.

import {
  DOCUMENT_REMINDER_DAYS,
  END_OF_DAY_HOUR,
  EXTRA_DOCS_DUE_HOURS,
  FIRST_CALL_HOUR,
  STATUS_CHECK_WORKING_DAYS,
} from '../constants';
import { addDays, addHours, addWorkingDays, atTime } from '../dates';
import { formatDate } from '../format';
import type { BankApplication, Deal, DocumentItem, Id, NewTask, Task } from '../types';
import { untriedBanks } from './applications';
import { isMissing } from './documents';
import { calcDaysInStage, getStage, isStuck } from './stages';

type DealRef = Pick<Deal, 'id' | 'clientId' | 'ownerId' | 'stage' | 'stageEnteredAt'>;
type AppRef = Pick<BankApplication, 'id' | 'bank'>;
type DocRef = Pick<DocumentItem, 'id' | 'type' | 'status' | 'validUntil'>;

export type AutoTaskEvent =
  | { type: 'lead_created'; deal: DealRef }
  | { type: 'stage_entered'; deal: DealRef; documents: readonly DocRef[] }
  | { type: 'application_submitted'; deal: DealRef; application: AppRef }
  | { type: 'extra_docs_requested'; deal: DealRef; application: AppRef }
  | { type: 'document_expiring'; deal: DealRef; document: DocRef }
  | { type: 'sla_exceeded'; deal: DealRef; headId: Id }
  | {
      type: 'application_rejected';
      deal: DealRef;
      application: AppRef;
      /** All applications of the deal, to find banks not tried yet. */
      applications: readonly Pick<BankApplication, 'bank'>[];
    }
  | { type: 'disbursed'; deal: DealRef; application: AppRef }
  /** A document was requested from the client: remind them in 3 days (one reminder per deal). */
  | { type: 'document_requested'; deal: DealRef };

function task(
  deal: DealRef,
  fields: Pick<NewTask, 'title' | 'type' | 'priority' | 'autoKey'> & { dueAt: Date },
  assigneeId: Id = deal.ownerId,
): NewTask {
  return {
    ...fields,
    dueAt: fields.dueAt.toISOString(),
    clientId: deal.clientId,
    dealId: deal.id,
    assigneeId,
    status: 'open',
    source: 'auto',
  };
}

/** Today 18:00, or tomorrow 18:00 if the working day is already over. */
function endOfWorkingDay(now: Date): Date {
  const today = atTime(now, END_OF_DAY_HOUR);
  return now < today ? today : atTime(addDays(now, 1), END_OF_DAY_HOUR);
}

/** "Tax clearance certificate" → "tax clearance certificate"; keeps acronyms like "EDRPOU". */
function inSentence(name: string): string {
  const first = name.split(' ')[0] ?? '';
  return first === first.toUpperCase() ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

export function autoTasksFor(event: AutoTaskEvent, now: Date): NewTask[] {
  const { deal } = event;
  switch (event.type) {
    case 'lead_created':
      return [
        task(deal, {
          title: 'Call — first contact with lead',
          type: 'call',
          priority: 'med',
          dueAt: atTime(addDays(now, 1), FIRST_CALL_HOUR),
          autoKey: `lead:${deal.id}`,
        }),
      ];

    case 'stage_entered': {
      if (deal.stage !== 'docs') return [];
      const missing = event.documents.filter((d) => isMissing(d, now));
      const allReceived = event.documents.length > 0 && missing.length === 0;
      if (allReceived) return [];
      // Checklist not generated yet: one generic request instead of per-document tasks.
      const requests =
        event.documents.length === 0
          ? [
              task(deal, {
                title: 'Request document package',
                type: 'document',
                priority: 'med',
                dueAt: endOfWorkingDay(now),
                autoKey: `doc-request:${deal.id}:package`,
              }),
            ]
          : missing.map((doc) =>
              task(deal, {
                title: `Get ${inSentence(doc.type)}`,
                type: 'document',
                priority: 'med',
                dueAt: endOfWorkingDay(now),
                autoKey: `doc-request:${doc.id}`,
              }),
            );
      const reminder = task(deal, {
        title: 'Remind client about documents',
        type: 'call',
        priority: 'med',
        dueAt: atTime(addDays(now, DOCUMENT_REMINDER_DAYS), FIRST_CALL_HOUR),
        autoKey: `doc-reminder:${deal.id}`,
      });
      return [...requests, reminder];
    }

    case 'application_submitted':
      return [
        task(deal, {
          title: `Check application status with ${event.application.bank}`,
          type: 'follow_up',
          priority: 'med',
          dueAt: atTime(addWorkingDays(now, STATUS_CHECK_WORKING_DAYS), FIRST_CALL_HOUR),
          autoKey: `status-check:${event.application.id}`,
        }),
      ];

    case 'extra_docs_requested':
      return [
        task(deal, {
          title: `Send additional documents to ${event.application.bank}`,
          type: 'document',
          priority: 'high',
          dueAt: addHours(now, EXTRA_DOCS_DUE_HOURS),
          autoKey: `extra-docs:${event.application.id}`,
        }),
      ];

    case 'document_expiring': {
      const { document } = event;
      const expires = document.validUntil
        ? ` (expires ${formatDate(new Date(document.validUntil))})`
        : '';
      return [
        task(deal, {
          title: `Renew ${inSentence(document.type)}${expires}`,
          type: 'document',
          priority: 'high',
          dueAt: endOfWorkingDay(now),
          autoKey: `renew:${document.id}`,
        }),
      ];
    }

    case 'sla_exceeded': {
      if (!isStuck(deal, now)) return [];
      const stage = getStage(deal.stage);
      return [
        task(
          deal,
          {
            title: `Escalation: ${calcDaysInStage(deal, now)} days in “${stage.label}” (SLA ${stage.slaDays})`,
            type: 'follow_up',
            priority: 'high',
            dueAt: endOfWorkingDay(now),
            autoKey: `sla:${deal.id}:${deal.stage}`,
          },
          event.headId,
        ),
      ];
    }

    case 'application_rejected': {
      const untried = untriedBanks(event.applications);
      const hint =
        untried.length > 0 ? `not tried yet: ${untried.join(', ')}` : 'all partner banks tried';
      return [
        task(deal, {
          title: `Analyze rejection reason: ${event.application.bank} · ${hint}`,
          type: 'follow_up',
          priority: 'high',
          dueAt: endOfWorkingDay(now),
          autoKey: `rejection:${event.application.id}`,
        }),
      ];
    }

    case 'document_requested':
      return [
        task(deal, {
          title: 'Remind client about documents',
          type: 'call',
          priority: 'med',
          dueAt: atTime(addDays(now, DOCUMENT_REMINDER_DAYS), FIRST_CALL_HOUR),
          autoKey: `doc-reminder:${deal.id}`,
        }),
      ];

    case 'disbursed':
      return [
        task(deal, {
          title: 'Issue commission invoice',
          type: 'invoice',
          priority: 'high',
          dueAt: endOfWorkingDay(now),
          autoKey: `invoice:${deal.id}`,
        }),
      ];
  }
}

/**
 * Drops new tasks whose rule already produced an open task (same autoKey), and duplicates
 * within the batch. A completed task does not block a new one: if the bank asks for extra
 * documents twice, the second request gets its own task.
 */
export function withoutDuplicates(
  newTasks: readonly NewTask[],
  existing: readonly Pick<Task, 'autoKey' | 'status'>[],
): NewTask[] {
  const seen = new Set(
    existing.filter((t) => t.status === 'open' && t.autoKey).map((t) => t.autoKey),
  );
  return newTasks.filter((t) => {
    if (!t.autoKey) return true;
    if (seen.has(t.autoKey)) return false;
    seen.add(t.autoKey);
    return true;
  });
}
