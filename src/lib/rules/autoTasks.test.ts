import { describe, expect, it } from 'vitest';
import type { NewTask } from '../types';
import { autoTasksFor, withoutDuplicates } from './autoTasks';
import { NOW, local, makeApp, makeDeal, makeDoc } from './test-fixtures';

const due = (t: NewTask | undefined) => (t?.dueAt ? new Date(t.dueAt) : null);
const titles = (tasks: NewTask[]) => tasks.map((t) => t.title);

describe('autoTasksFor — common fields', () => {
  it('links the task to the deal and client, assigns the owner, marks it auto and open', () => {
    const [t] = autoTasksFor({ type: 'lead_created', deal: makeDeal({ stage: 'new' }) }, NOW);
    expect(t).toMatchObject({
      dealId: 'd1',
      clientId: 'c1',
      assigneeId: 'u1',
      source: 'auto',
      status: 'open',
      autoKey: 'lead:d1',
    });
  });
});

describe('New lead', () => {
  it('call tomorrow at 10:00', () => {
    const [t] = autoTasksFor({ type: 'lead_created', deal: makeDeal({ stage: 'new' }) }, NOW);
    expect(t?.title).toBe('Call — first contact with lead');
    expect(t?.type).toBe('call');
    expect(due(t)).toEqual(new Date(2026, 8, 30, 10, 0));
  });
});

describe('Enter "Document collection"', () => {
  const deal = makeDeal({ stage: 'docs' });

  it('one task per missing document + a client reminder in 3 days', () => {
    const documents = [
      makeDoc({ id: 'x1', type: 'State register extract' }),
      makeDoc({ id: 'x2', type: 'Land lease agreements', status: 'requested' }),
      makeDoc({ id: 'x3', type: 'Premises lease agreement', status: 'not_requested' }),
      makeDoc({ id: 'x4', type: 'Tax clearance certificate', validUntil: local(2026, 9, 20) }),
    ];
    const tasks = autoTasksFor({ type: 'stage_entered', deal, documents }, NOW);
    expect(titles(tasks)).toEqual([
      'Get land lease agreements',
      'Get premises lease agreement',
      'Get tax clearance certificate', // received but expired by date
      'Remind client about documents',
    ]);
    expect(due(tasks[0])).toEqual(new Date(2026, 8, 29, 18, 0));
    expect(due(tasks[3])).toEqual(new Date(2026, 9, 2, 10, 0));
  });

  it('an expiring (still valid) document is not re-requested here', () => {
    const documents = [makeDoc({ validUntil: local(2026, 10, 3) })];
    expect(autoTasksFor({ type: 'stage_entered', deal, documents }, NOW)).toEqual([]);
  });

  it('everything already received → no tasks, no reminder', () => {
    const documents = [makeDoc({ id: 'a' }), makeDoc({ id: 'b', type: 'Bank statements, 12 mo.' })];
    expect(autoTasksFor({ type: 'stage_entered', deal, documents }, NOW)).toEqual([]);
  });

  it('empty checklist → one "Request document package" task + reminder', () => {
    const tasks = autoTasksFor({ type: 'stage_entered', deal, documents: [] }, NOW);
    expect(titles(tasks)).toEqual(['Request document package', 'Remind client about documents']);
  });

  it('keeps acronyms at the start of a document name', () => {
    const documents = [makeDoc({ type: 'EDRPOU extract', status: 'requested' })];
    expect(autoTasksFor({ type: 'stage_entered', deal, documents }, NOW)[0]?.title).toBe(
      'Get EDRPOU extract',
    );
  });

  it('entering any other stage creates nothing', () => {
    const documents = [makeDoc({ status: 'not_requested' })];
    const other = makeDeal({ stage: 'banks' });
    expect(autoTasksFor({ type: 'stage_entered', deal: other, documents }, NOW)).toEqual([]);
  });
});

describe('Application submitted', () => {
  it('check status in 3 working days (Tue → Fri 10:00)', () => {
    const [t] = autoTasksFor(
      {
        type: 'application_submitted',
        deal: makeDeal(),
        application: makeApp('submitted', 'FinTrust'),
      },
      NOW,
    );
    expect(t?.title).toBe('Check application status with FinTrust');
    expect(due(t)).toEqual(new Date(2026, 9, 2, 10, 0));
  });

  it('skips the weekend (Fri → Wed)', () => {
    const friday = new Date(2026, 9, 2, 15, 0);
    const [t] = autoTasksFor(
      { type: 'application_submitted', deal: makeDeal(), application: makeApp('submitted') },
      friday,
    );
    expect(due(t)).toEqual(new Date(2026, 9, 7, 10, 0));
  });
});

describe('Bank requests extra documents', () => {
  it('urgent task due in 24 hours', () => {
    const [t] = autoTasksFor(
      { type: 'extra_docs_requested', deal: makeDeal(), application: makeApp('extra', 'Sitibud') },
      NOW,
    );
    expect(t?.priority).toBe('high');
    expect(t?.title).toBe('Send additional documents to Sitibud');
    expect(due(t)).toEqual(new Date(2026, 8, 30, 10, 14));
  });
});

describe('Document expires in 5 days', () => {
  it('story 2: renew the tax certificate, high priority, today', () => {
    const document = makeDoc({ validUntil: local(2026, 10, 3) });
    const [t] = autoTasksFor({ type: 'document_expiring', deal: makeDeal(), document }, NOW);
    expect(t?.title).toBe('Renew tax clearance certificate (expires Oct 3)');
    expect(t?.priority).toBe('high');
    expect(due(t)).toEqual(new Date(2026, 8, 29, 18, 0));
  });

  it('after 18:00 the deadline moves to tomorrow evening instead of being born overdue', () => {
    const late = new Date(2026, 8, 29, 19, 30);
    const document = makeDoc({ validUntil: local(2026, 10, 3) });
    const [t] = autoTasksFor({ type: 'document_expiring', deal: makeDeal(), document }, late);
    expect(due(t)).toEqual(new Date(2026, 8, 30, 18, 0));
  });
});

describe('Deal exceeds stage SLA', () => {
  it('story 3: escalation task for the head of department', () => {
    const deal = makeDeal({ stage: 'decision', stageEnteredAt: local(2026, 9, 9), ownerId: 'u3' });
    const [t] = autoTasksFor({ type: 'sla_exceeded', deal, headId: 'h1' }, NOW);
    expect(t?.assigneeId).toBe('h1');
    expect(t?.title).toBe('Escalation: 20 days in “Bank decisions” (SLA 10)');
    expect(t?.autoKey).toBe('sla:d1:decision');
  });

  it('does nothing if the deal is not actually over SLA', () => {
    const deal = makeDeal({ stage: 'decision', stageEnteredAt: local(2026, 9, 25) });
    expect(autoTasksFor({ type: 'sla_exceeded', deal, headId: 'h1' }, NOW)).toEqual([]);
  });
});

describe('Bank rejection', () => {
  it('analyze the reason and name banks not tried yet', () => {
    const rejected = makeApp('rejected', 'Karpatskyi');
    const applications = [
      makeApp('rejected', 'Dniprobank'),
      rejected,
      makeApp('review', 'FinTrust'),
    ];
    const [t] = autoTasksFor(
      { type: 'application_rejected', deal: makeDeal(), application: rejected, applications },
      NOW,
    );
    expect(t?.title).toBe(
      'Analyze rejection reason: Karpatskyi · not tried yet: Universal Capital, Sitibud',
    );
  });

  it('says so when every partner bank was already tried', () => {
    const applications = (
      ['Dniprobank', 'Karpatskyi', 'Universal Capital', 'FinTrust', 'Sitibud'] as const
    ).map((bank) => makeApp('rejected', bank));
    const [t] = autoTasksFor(
      {
        type: 'application_rejected',
        deal: makeDeal(),
        application: applications[4]!,
        applications,
      },
      NOW,
    );
    expect(t?.title).toBe('Analyze rejection reason: Sitibud · all partner banks tried');
  });
});

describe('Disbursement', () => {
  it('issue the commission invoice', () => {
    const [t] = autoTasksFor(
      { type: 'disbursed', deal: makeDeal({ stage: 'won' }), application: makeApp('disbursed') },
      NOW,
    );
    expect(t).toMatchObject({
      title: 'Issue commission invoice',
      type: 'invoice',
      priority: 'high',
    });
  });
});

describe('withoutDuplicates', () => {
  const [lead] = autoTasksFor({ type: 'lead_created', deal: makeDeal({ stage: 'new' }) }, NOW);
  if (!lead) throw new Error('fixture');

  it('skips a task whose rule already has an open task', () => {
    expect(withoutDuplicates([lead], [{ autoKey: 'lead:d1', status: 'open' }])).toEqual([]);
  });

  it('creates it again if the earlier one is done', () => {
    expect(withoutDuplicates([lead], [{ autoKey: 'lead:d1', status: 'done' }])).toEqual([lead]);
  });

  it('removes duplicates inside the same batch and ignores manual tasks', () => {
    const manual = { autoKey: null, status: 'open' as const };
    expect(withoutDuplicates([lead, lead], [manual])).toEqual([lead]);
  });
});
