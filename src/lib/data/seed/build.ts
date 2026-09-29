// Turns the specs in people.ts / deals.ts into a full, internally consistent dataset.
// Everything is relative to `now`, and randomness is seeded, so the result is deterministic
// for a given date and the stories always read the same ("expires in 4 days", "20 days in stage").

import {
  CLOSED_STAGES,
  OVERLOAD_OVERDUE_TASKS,
  STAGES,
  type Bank,
  type OpenStageKey,
  type Product,
  type StageKey,
} from '../../constants';
import { addDays, addHours, atTime } from '../../dates';
import { formatDate, formatMoney, formatMoneyCompact } from '../../format';
import { DECIDED, POSITIVE } from '../../rules/applications';
import { documentChecklist } from '../../rules/documents';
import { autoTasksFor, withoutDuplicates } from '../../rules/autoTasks';
import { getStage, isStuck, stageOrder } from '../../rules/stages';
import { isOverdue } from '../../rules/tasks';
import type {
  BankApplication,
  Client,
  Deal,
  DocumentItem,
  Interaction,
  NewTask,
  Task,
} from '../../types';
import type { Dataset } from '../dataset';
import { DEALS, type DealSpec } from './deals';
import { CLIENTS, HEAD_ID, USERS } from './people';
import { createRandom, type Random } from './random';

const SEED = 20_260_929;
/** Interactions older than this are not generated (AGENTS.md: ~200 over 3 months). */
const HISTORY_DAYS = 92;
const HOUR_MS = 60 * 60 * 1000;

const BASE_RATE: Record<Bank, number> = {
  'Universal Capital': 17.8,
  Dniprobank: 18.9,
  FinTrust: 19.2,
  Karpatskyi: 19.6,
  Sitibud: 20.4,
};

const TERMS: Record<Product, number[]> = {
  Loan: [12, 18, 24, 36],
  Leasing: [36, 48, 60],
  Overdraft: [12],
  Factoring: [6, 12],
};

const REJECTIONS = [
  'Insufficient collateral',
  'Debt load above bank limits',
  'Unconfirmed income in bank statements',
  'Industry outside the bank’s risk appetite',
];

interface Ctx {
  now: Date;
  rng: Random;
  clients: Map<string, Client>;
  deals: Deal[];
  applications: BankApplication[];
  documents: DocumentItem[];
  interactions: Interaction[];
  tasks: NewTask[];
}

export function createSeed(now: Date): Dataset {
  const ctx: Ctx = {
    now,
    rng: createRandom(SEED),
    clients: new Map(CLIENTS.map((c) => [c.id, c])),
    deals: [],
    applications: [],
    documents: [],
    interactions: [],
    tasks: [],
  };

  for (const spec of DEALS) buildDeal(ctx, spec);
  addStoryDetails(ctx);
  addOlenaTasks(ctx);
  addHeadTasks(ctx);

  capOverdue(ctx);
  const tasks: Task[] = withoutDuplicates(ctx.tasks, []).map((t, i) => ({ ...t, id: `t${i + 1}` }));
  const interactions = ctx.interactions
    .filter((i) => new Date(i.date) >= addDays(now, -HISTORY_DAYS) && new Date(i.date) <= now)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((i, n) => ({ ...i, id: `i${n + 1}` }));

  return {
    users: USERS.map((u) => ({ ...u })),
    clients: CLIENTS.map((c) => ({
      ...c,
      contacts: c.contacts.map((k) => ({ ...k })),
      tags: [...c.tags],
    })),
    deals: ctx.deals,
    applications: ctx.applications,
    documents: ctx.documents,
    interactions,
    tasks,
  };
}

/**
 * Story 5 says Olena is THE overloaded manager. Generated tasks could push another manager over
 * the overload threshold by chance, so everyone else keeps at most MAX_OTHER_OVERDUE overdue tasks
 * (the oldest extras count as done).
 */
const MAX_OTHER_OVERDUE = OVERLOAD_OVERDUE_TASKS - 2;
function capOverdue(ctx: Ctx) {
  const byUser = new Map<string, NewTask[]>();
  for (const t of ctx.tasks) {
    if (t.assigneeId === 'u1' || t.assigneeId === HEAD_ID || !isOverdue(t, ctx.now)) continue;
    byUser.set(t.assigneeId, [...(byUser.get(t.assigneeId) ?? []), t]);
  }
  for (const list of byUser.values()) {
    const oldestFirst = [...list].sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
    for (const t of oldestFirst.slice(0, Math.max(0, list.length - MAX_OTHER_OVERDUE)))
      t.status = 'done';
  }
}

// ── Dates ──────────────────────────────────────────────────

/** Never later than now (items "today at 16:00" seeded at 10:00 move to just before now). */
function notFuture(ctx: Ctx, date: Date): Date {
  return date > ctx.now ? new Date(ctx.now.getTime() - 20 * 60 * 1000) : date;
}

/** Moves a manual entry into office hours (09–18) on the same day, keeping it after `after` and not in the future. */
function workingHours(ctx: Ctx, date: Date, after: Date): Date {
  const moved = atTime(date, ctx.rng.int(9, 17), ctx.rng.int(0, 59));
  return notFuture(ctx, moved > after ? moved : date);
}

function daysAgo(ctx: Ctx, days: number, hours: number, minutes = 0): Date {
  return notFuture(ctx, atTime(addDays(ctx.now, -days), hours, minutes));
}

function between(ctx: Ctx, from: Date, to: Date): Date {
  const lo = from.getTime();
  const hi = to.getTime();
  return new Date(hi > lo ? lo + ctx.rng.next() * (hi - lo) : lo);
}

const iso = (d: Date) => d.toISOString();

// ── Stage history ──────────────────────────────────────────

function stagePath(spec: DealSpec): StageKey[] {
  const last: OpenStageKey =
    spec.stage === 'won' || spec.stage === 'lost' ? (spec.closedFrom ?? 'signing') : spec.stage;
  const idx = STAGES.findIndex((s) => s.key === last);
  const open = STAGES.slice(0, idx + 1).map((s) => s.key);
  return spec.stage === 'won' || spec.stage === 'lost' ? [...open, spec.stage] : open;
}

/**
 * Entry time of every stage on the path. The current stage is pinned by `spec.days`; earlier
 * stages get a duration of 30–100% of their SLA. If applications have fixed submission dates,
 * "Applications submitted" is anchored to the earliest one.
 */
function stageEntries(ctx: Ctx, spec: DealSpec, path: StageKey[]): Date[] {
  const { rng } = ctx;
  const entries: Date[] = new Array<Date>(path.length);
  const lastIdx = path.length - 1;
  entries[lastIdx] = daysAgo(ctx, spec.days, rng.int(9, 17), rng.int(0, 59));

  const stepBack = (from: Date, stage: StageKey): Date => {
    const days = Math.round(getStage(stage).slaDays * (0.3 + 0.7 * rng.next()));
    return days === 0
      ? addHours(from, -rng.int(2, 6))
      : atTime(addDays(from, -days), rng.int(9, 17), rng.int(0, 59));
  };
  const fillBackFrom = (idx: number) => {
    for (let i = idx - 1; i >= 0; i -= 1) entries[i] = stepBack(entries[i + 1]!, path[i]!);
  };
  fillBackFrom(lastIdx);

  const anchors = (spec.apps ?? [])
    .map((a) => a.submittedDaysAgo)
    .filter((d): d is number => d !== undefined);
  const subIdx = path.indexOf('submitted');
  if (anchors.length > 0 && subIdx >= 0) {
    entries[subIdx] = daysAgo(ctx, Math.max(...anchors), 9, 30);
    fillBackFrom(subIdx);
    for (let i = subIdx + 1; i < lastIdx; i += 1) {
      if (entries[i]! <= entries[i - 1]!) entries[i] = addHours(entries[i - 1]!, 3);
    }
  }
  return entries;
}

// ── Deals ──────────────────────────────────────────────────

function buildDeal(ctx: Ctx, spec: DealSpec) {
  const client = ctx.clients.get(spec.clientId);
  if (!client) throw new Error(`Seed: unknown client ${spec.clientId}`);
  const path = stagePath(spec);
  const entries = stageEntries(ctx, spec, path);
  const entryOf = (k: StageKey) => {
    const i = path.indexOf(k);
    return i >= 0 ? entries[i] : undefined;
  };
  const created = entries[0]!;
  const current = entries[entries.length - 1]!;

  const deal: Deal = {
    id: spec.id,
    clientId: client.id,
    product: spec.product,
    requestedAmount: spec.amount,
    purpose: spec.purpose,
    stage: spec.stage,
    ownerId: client.ownerId,
    createdAt: iso(created),
    stageEnteredAt: iso(current),
    commissionRate: null,
    lostReason: spec.lostReason ?? null,
    lostAtStage: spec.stage === 'lost' ? (spec.closedFrom ?? null) : null,
  };
  ctx.deals.push(deal);

  const apps = buildApplications(ctx, spec, deal, entryOf);
  const docs = buildDocuments(ctx, deal, client, path);
  addDealInteractions(ctx, deal, client, path, entries, apps);
  if (deal.ownerId !== 'u1') addGeneratedTasks(ctx, deal, apps, docs);
}

function buildApplications(
  ctx: Ctx,
  spec: DealSpec,
  deal: Deal,
  entryOf: (k: StageKey) => Date | undefined,
): BankApplication[] {
  const { rng } = ctx;
  const closed = deal.stage === 'won' || deal.stage === 'lost';
  const apps = (spec.apps ?? []).map((a, n): BankApplication => {
    const sent = a.status !== 'prep';
    const subEntry = entryOf('submitted');
    let submittedAt: Date | null = null;
    if (sent) {
      submittedAt =
        a.submittedDaysAgo !== undefined
          ? daysAgo(ctx, a.submittedDaysAgo, rng.int(9, 12), rng.int(0, 59))
          : notFuture(ctx, addHours(subEntry ?? ctx.now, rng.int(0, 5)));
    }
    let decidedAt: Date | null = null;
    if (DECIDED.has(a.status) && submittedAt) {
      if (a.decidedDaysAgo !== undefined) {
        decidedAt = daysAgo(ctx, a.decidedDaysAgo, rng.int(10, 17), rng.int(0, 59));
      } else {
        // Decisions land before signing starts, or before the deal closed, or before now.
        const upper = entryOf('signing') ?? (closed ? new Date(deal.stageEnteredAt) : ctx.now);
        decidedAt = between(ctx, addDays(submittedAt, 1), new Date(upper.getTime() - HOUR_MS));
        if (decidedAt < submittedAt) decidedAt = addHours(submittedAt, 2);
      }
    }
    const positive = POSITIVE.has(a.status);
    return {
      id: `${deal.id}-a${n + 1}`,
      dealId: deal.id,
      bank: a.bank,
      status: a.status,
      amount: a.amount ?? deal.requestedAmount,
      rate: positive
        ? (a.rate ?? Math.round((BASE_RATE[a.bank] + rng.next() * 1.2 - 0.5) * 10) / 10)
        : null,
      termMonths: positive ? (a.termMonths ?? rng.pick(TERMS[deal.product])) : null,
      submittedAt: submittedAt ? iso(submittedAt) : null,
      decidedAt: decidedAt ? iso(decidedAt) : null,
      rejectionReason: a.status === 'rejected' ? (a.rejectionReason ?? rng.pick(REJECTIONS)) : null,
    };
  });
  ctx.applications.push(...apps);
  return apps;
}

// ── Documents ──────────────────────────────────────────────

function buildDocuments(ctx: Ctx, deal: Deal, client: Client, path: StageKey[]): DocumentItem[] {
  if (!path.includes('docs')) return [];
  const { rng, now } = ctx;
  const names = documentChecklist(client.legalForm, deal.product, now.getFullYear());
  const open = deal.stage !== 'won' && deal.stage !== 'lost';
  const collecting = deal.stage === 'docs' || (deal.stage === 'lost' && path.at(-2) === 'docs');
  const receivedCount = collecting
    ? rng.int(Math.floor(names.length * 0.4), Math.ceil(names.length * 0.7))
    : names.length;

  const docs = names.map((type, n): DocumentItem => {
    const received = n < receivedCount;
    const status = received ? 'received' : rng.chance(0.6) ? 'requested' : 'not_requested';
    // Only open deals track certificate validity; closed deals keep documents as history.
    const certificate = type === 'Tax clearance certificate' && received && open;
    return {
      id: `${deal.id}-doc${n + 1}`,
      dealId: deal.id,
      type,
      status,
      validUntil: certificate ? iso(atTime(addDays(now, rng.int(14, 75)), 23, 59)) : null,
    };
  });
  ctx.documents.push(...docs);
  return docs;
}

// ── Interactions ───────────────────────────────────────────

function interaction(
  deal: Deal,
  date: Date,
  type: Interaction['type'],
  summary: string,
  authorId: string | null,
): Interaction {
  return {
    id: '',
    clientId: deal.clientId,
    dealId: deal.id,
    type,
    date: iso(date),
    authorId,
    summary,
    auto: authorId === null,
  };
}

function stageLabel(k: StageKey): string {
  return (STAGES.find((s) => s.key === k) ?? CLOSED_STAGES.find((s) => s.key === k))?.label ?? k;
}

function manualNote(deal: Deal, client: Client, stage: StageKey, apps: BankApplication[]) {
  const contact = client.contacts[0];
  const who = contact?.name ?? 'the client';
  const first = who.split(' ')[0] ?? who;
  const pendingBank = apps.find((a) => a.status === 'review' || a.status === 'extra')?.bank;
  const notes: Partial<Record<StageKey, [Interaction['type'], string]>> = {
    new: [
      'call',
      `Inbound request: ${deal.purpose.toLowerCase()}, ${formatMoney(deal.requestedAmount)}. Agreed on a qualification call.`,
    ],
    qual: [
      'call',
      `Qualification call with ${who}: ${client.businessAgeYears} years in business, turnover ${formatMoneyCompact(client.annualTurnover)}. Discussed collateral and term.`,
    ],
    docs: ['email', `Sent ${who} the document checklist for the ${deal.product.toLowerCase()}.`],
    banks: ['meeting', `Met ${who} to agree on banks and the target rate.`],
    submitted: [
      'messenger',
      `Viber: ${first} asked when banks will respond. Explained it usually takes 3–5 working days.`,
    ],
    decision: pendingBank
      ? ['call', `Called the ${pendingBank} credit officer: the application is with the risk team.`]
      : ['note', 'Waiting for the remaining bank decisions.'],
    signing: ['email', 'Sent the client an offer comparison and payment schedules.'],
  };
  return notes[stage] ?? null;
}

function addDealInteractions(
  ctx: Ctx,
  deal: Deal,
  client: Client,
  path: StageKey[],
  entries: Date[],
  apps: BankApplication[],
) {
  const { rng, now } = ctx;
  const out: Interaction[] = [];
  const owner = deal.ownerId;
  const scripted = deal.id === 'd1'; // manual history comes from the design, see addStoryDetails
  const sentTo = apps
    .filter((a) => a.submittedAt)
    .map((a) => a.bank)
    .join(', ');

  path.forEach((stage, i) => {
    const at = entries[i]!;
    // Early-funnel moves (up to Bank selection) are not logged: the timeline becomes useful once
    // banks are involved, and it keeps the history near the ~200 entries AGENTS.md asks for.
    const logged =
      stage === 'won' || stage === 'lost' || stageOrder(stage) >= stageOrder('submitted');
    if (i > 0 && logged) {
      const text =
        stage === 'won'
          ? 'Funds disbursed · deal won'
          : stage === 'lost'
            ? `Deal marked as lost: ${deal.lostReason ?? ''}`
            : `Deal stage: “${stageLabel(path[i - 1]!)}” → “${stageLabel(stage)}”${stage === 'submitted' && sentTo ? ` · sent to ${sentTo}` : ''}`;
      out.push(interaction(deal, at, 'stage_change', text, null));
    }
    const isCurrent = i === path.length - 1;
    const note = scripted ? null : manualNote(deal, client, stage, apps);
    if (note && (i === 0 || (isCurrent && rng.chance(0.7)) || rng.chance(0.1))) {
      const next = entries[i + 1] ?? now;
      out.push(
        interaction(
          deal,
          workingHours(ctx, between(ctx, addHours(at, 1), next), at),
          note[0],
          note[1],
          owner,
        ),
      );
    }
  });

  for (const a of apps) {
    if (!a.decidedAt) continue;
    const at = new Date(a.decidedAt);
    const text =
      a.status === 'rejected'
        ? `${a.bank} rejected: ${a.rejectionReason ?? ''}`
        : `${a.bank} approved: ${formatMoney(a.amount)} · ${a.rate}% · ${a.termMonths} mo.`;
    out.push(interaction(deal, at, 'document', text, null));
    if (a.status === 'accepted' && !scripted) {
      out.push(
        interaction(
          deal,
          notFuture(ctx, addHours(at, rng.int(2, 20))),
          'messenger',
          `Viber: client chose the ${a.bank} offer — ${a.rate}%, ${a.termMonths} mo.`,
          owner,
        ),
      );
    }
  }
  ctx.interactions.push(...out);
}

// ── Stories that need hand-written details ────────────────

function addStoryDetails(ctx: Ctx) {
  const { now } = ctx;
  const d1 = ctx.deals.find((d) => d.id === 'd1');
  const d2 = ctx.deals.find((d) => d.id === 'd2');
  if (!d1 || !d2) throw new Error('Seed: story deals missing');

  // Story 1, Agro-Skhid: manual history as in the design.
  const signingDay = atTime(addDays(now, 2), 11);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(signingDay);
  ctx.interactions.push(
    interaction(
      d1,
      daysAgo(ctx, 0, 9, 52),
      'task',
      'Task “Confirm disbursement date with Universal Capital” created',
      null,
    ),
    interaction(
      d1,
      daysAgo(ctx, 0, 9, 40),
      'call',
      `Director confirmed signing on ${weekday}, ${formatDate(signingDay)}. Land lease agreements are missing — the accountant will send them tomorrow.`,
      'u1',
    ),
    interaction(
      d1,
      daysAgo(ctx, 1, 15, 48),
      'messenger',
      'Viber: client chose the Universal Capital offer — 17.9%, 24 mo. Keeping FinTrust as backup.',
      'u1',
    ),
    interaction(
      d1,
      daysAgo(ctx, 4, 17, 30),
      'email',
      'Sent the client an offer comparison and payment schedules.',
      'u1',
    ),
    interaction(
      d1,
      daysAgo(ctx, 6, 10, 30),
      'meeting',
      'Meeting at the elevator: inspected collateral machinery, agreed to apply to Universal Capital and FinTrust.',
      'u1',
    ),
  );

  // Story 1: document checklist from the design (land lease agreements still requested).
  ctx.documents = ctx.documents.filter((d) => d.dealId !== 'd1');
  const d1Docs: [string, DocumentItem['status'], Date | null][] = [
    ['State register extract', 'received', null],
    [`Financial statements F1, F2 for ${now.getFullYear() - 1}`, 'received', null],
    [`Financial statements H1 ${now.getFullYear()}`, 'received', null],
    ['Tax clearance certificate', 'received', atTime(addDays(now, 19), 23, 59)],
    ['Bank statements, 12 mo.', 'received', null],
    ['Collateral machinery documents', 'received', null],
    ['Director’s passport and tax ID', 'received', null],
    ['Land lease agreements', 'requested', null],
  ];
  ctx.documents.push(
    ...d1Docs.map(([type, status, until], n) => ({
      id: `d1-doc${n + 1}`,
      dealId: 'd1',
      type,
      status,
      validUntil: until ? iso(until) : null,
    })),
  );

  // Story 2, coffee shop: checklist from the design; tax certificate expires in 4 days.
  ctx.documents = ctx.documents.filter((d) => d.dealId !== 'd2');
  const d2Docs: [string, DocumentItem['status'], Date | null][] = [
    ['Passport and tax ID', 'received', null],
    ['Single tax payer register extract', 'received', null],
    [`Sole prop. tax return ${now.getFullYear() - 1}`, 'received', null],
    ['Tax clearance certificate', 'received', atTime(addDays(now, 4), 23, 59)],
    ['Sole prop. bank statement, 6 mo.', 'requested', null],
    ['Premises lease agreement', 'not_requested', null],
  ];
  ctx.documents.push(
    ...d2Docs.map(([type, status, until], n) => ({
      id: `d2-doc${n + 1}`,
      dealId: 'd2',
      type,
      status,
      validUntil: until ? iso(until) : null,
    })),
  );

  // Inactive client: last contact 42 days ago, as in the design.
  const boiko = ctx.deals.find((d) => d.id === 'd30');
  if (boiko) {
    ctx.interactions.push(
      interaction(
        boiko,
        daysAgo(ctx, 42, 11, 20),
        'call',
        'Called the owner about the tow truck lease: no answer, left a voicemail.',
        'u1',
      ),
    );
  }
}

// ── Tasks ──────────────────────────────────────────────────

function manualTask(
  deal: Pick<Deal, 'id' | 'clientId'> | null,
  clientId: string | null,
  assigneeId: string,
  title: string,
  dueAt: Date | null,
  priority: NewTask['priority'],
  type: NewTask['type'] = 'other',
): NewTask {
  return {
    title,
    type,
    clientId,
    dealId: deal?.id ?? null,
    assigneeId,
    dueAt: dueAt ? iso(dueAt) : null,
    status: 'open',
    priority,
    source: 'manual',
    autoKey: null,
  };
}

/** Rule-generated tasks for deals of managers other than Olena (her list is hand-written). */
function addGeneratedTasks(ctx: Ctx, deal: Deal, apps: BankApplication[], docs: DocumentItem[]) {
  const { now, rng } = ctx;
  const entered = new Date(deal.stageEnteredAt);
  const out: NewTask[] = [];
  const at = (d: Date, days: number, h: number) => atTime(addDays(d, days), h);

  switch (deal.stage) {
    case 'new':
      out.push(...autoTasksFor({ type: 'lead_created', deal }, new Date(deal.createdAt)));
      break;
    case 'qual':
      out.push(
        manualTask(
          deal,
          deal.clientId,
          deal.ownerId,
          'Confirm turnover and collateral',
          at(entered, 2, 12),
          'med',
          'call',
        ),
      );
      break;
    case 'docs':
      out.push(...autoTasksFor({ type: 'stage_entered', deal, documents: docs }, entered));
      break;
    case 'banks':
      out.push(
        manualTask(
          deal,
          deal.clientId,
          deal.ownerId,
          'Pick banks and prepare applications',
          at(entered, 1, 16),
          'med',
        ),
      );
      break;
    case 'submitted':
      for (const application of apps.filter((a) => a.submittedAt)) {
        out.push(
          ...autoTasksFor(
            { type: 'application_submitted', deal, application },
            new Date(application.submittedAt!),
          ),
        );
      }
      break;
    case 'decision':
      for (const application of apps) {
        if (application.status === 'rejected' && application.decidedAt) {
          out.push(
            ...autoTasksFor(
              { type: 'application_rejected', deal, application, applications: apps },
              addHours(new Date(application.decidedAt), 1),
            ),
          );
        }
        if (application.status === 'extra') {
          out.push(
            ...autoTasksFor(
              { type: 'extra_docs_requested', deal, application },
              addHours(now, -rng.int(4, 20)),
            ),
          );
        }
      }
      break;
    case 'signing': {
      const offer =
        apps.find((a) => a.status === 'accepted') ?? apps.find((a) => a.status === 'approved');
      if (offer)
        out.push(
          manualTask(
            deal,
            deal.clientId,
            deal.ownerId,
            `Agree on the signing date with ${offer.bank}`,
            at(now, 1, 11),
            'high',
            'meeting',
          ),
        );
      break;
    }
    case 'won': {
      const paid = apps.find((a) => a.status === 'disbursed');
      if (paid && entered > addDays(now, -30)) {
        out.push(
          ...autoTasksFor({ type: 'disbursed', deal, application: paid }, entered).map((t) => ({
            ...t,
            status: 'done' as const,
          })),
        );
      }
      break;
    }
    case 'lost':
      break;
  }

  // Older generated tasks: about half were completed and archived, so they are left out;
  // the rest stay open and show up as overdue.
  const yesterday = addDays(now, -1);
  ctx.tasks.push(
    ...out.filter((t) => !(t.dueAt && new Date(t.dueAt) < yesterday && rng.chance(0.5))),
  );
}

/** Story 5: Olena has exactly 9 overdue tasks. Titles follow the design. */
function addOlenaTasks(ctx: Ctx) {
  const { now } = ctx;
  const deal = (id: string) => {
    const d = ctx.deals.find((x) => x.id === id);
    if (!d) throw new Error(`Seed: unknown deal ${id}`);
    return d;
  };
  const due = (days: number, h: number, m = 0) => atTime(addDays(now, days), h, m);
  const auto = (t: NewTask, autoKey: string): NewTask => ({ ...t, source: 'auto', autoKey });
  const u1 = 'u1';

  const d2Cert = ctx.documents.find(
    (d) => d.dealId === 'd2' && d.type === 'Tax clearance certificate',
  );
  const d7 = deal('d7');
  const d22 = deal('d22');

  ctx.tasks.push(
    // Overdue (9)
    auto(
      manualTask(
        deal('d2'),
        'c2',
        u1,
        'Remind client about bank statement',
        due(-1, 12),
        'high',
        'call',
      ),
      'doc-reminder:d2',
    ),
    auto(
      manualTask(
        deal('d13'),
        'c14',
        u1,
        'Check application status with FinTrust',
        due(-2, 10),
        'med',
        'follow_up',
      ),
      'status-check:d13-a1',
    ),
    manualTask(
      deal('d10'),
      'c11',
      u1,
      `Confirm actual ${now.getFullYear() - 1} turnover`,
      due(-3, 12),
      'med',
      'call',
    ),
    manualTask(deal('d4'), 'c4', u1, 'Request 9-month financials', due(-2, 18), 'med', 'document'),
    manualTask(deal('d5'), 'c6', u1, 'Send leasing offer comparison', due(-4, 17), 'high', 'email'),
    auto(
      manualTask(
        deal('d5'),
        'c6',
        u1,
        'Check application status with Karpatskyi',
        due(-1, 10),
        'high',
        'follow_up',
      ),
      'status-check:d5-a2',
    ),
    auto(
      manualTask(
        deal('d2'),
        'c2',
        u1,
        'Get premises lease agreement',
        due(-5, 18),
        'low',
        'document',
      ),
      'doc-request:d2-doc6',
    ),
    manualTask(
      deal('d17'),
      'c14',
      u1,
      'Schedule a meeting with the CFO',
      due(-1, 15),
      'med',
      'meeting',
    ),
    manualTask(null, 'c15', u1, 'Update accounting contacts', due(-6, 12), 'low'),
    // Today and later
    auto(
      manualTask(
        deal('d1'),
        'c1',
        u1,
        'Confirm disbursement date with Universal Capital',
        due(0, 11),
        'high',
        'call',
      ),
      'disbursement-date:d1',
    ),
    ...autoTasksFor({ type: 'lead_created', deal: d7 }, new Date(d7.createdAt)),
    ...autoTasksFor({ type: 'lead_created', deal: d22 }, new Date(d22.createdAt)),
    ...(d2Cert
      ? autoTasksFor({ type: 'document_expiring', deal: deal('d2'), document: d2Cert }, now)
      : []),
    manualTask(deal('d17'), 'c14', u1, 'Meeting at client’s office', due(1, 15), 'med', 'meeting'),
    auto(
      manualTask(deal('d1'), 'c1', u1, 'Get land lease agreements', due(1, 10), 'high', 'document'),
      'doc-request:d1-doc8',
    ),
    manualTask(deal('d1'), 'c1', u1, 'Loan agreement signing', due(2, 11), 'high', 'meeting'),
    manualTask(null, 'c15', u1, 'Re-offer car leasing', due(15, 10), 'low', 'call'),
    manualTask(deal('d1'), 'c1', u1, 'Collect feedback after disbursement', null, 'low', 'call'),
    // Done
    {
      ...manualTask(
        deal('d18'),
        'c16',
        u1,
        'Send the document checklist',
        due(-3, 16),
        'med',
        'email',
      ),
      status: 'done',
    },
    {
      ...manualTask(
        deal('d26'),
        'c40',
        u1,
        'Prepare the offer comparison',
        due(-1, 17),
        'high',
        'email',
      ),
      status: 'done',
    },
  );
}

/** Head: an escalation for every deal over SLA (fired the day it went over) + one manual task. */
function addHeadTasks(ctx: Ctx) {
  const { now } = ctx;
  for (const deal of ctx.deals) {
    if (!isStuck(deal, now)) continue;
    const overSince = atTime(
      addDays(new Date(deal.stageEnteredAt), getStage(deal.stage).slaDays + 1),
      9,
    );
    ctx.tasks.push(
      ...autoTasksFor({ type: 'sla_exceeded', deal, headId: HEAD_ID }, notFuture(ctx, overSince)),
    );
  }
  ctx.tasks.push(
    manualTask(
      null,
      null,
      HEAD_ID,
      'Review Olena Koval’s workload and reassign deals',
      atTime(addDays(now, 1), 12),
      'med',
    ),
  );
}
