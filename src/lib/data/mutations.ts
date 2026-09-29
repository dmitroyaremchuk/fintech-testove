// Pure dataset updates. Each returns a new Dataset; the store commits it, and the previous
// Dataset is what Undo restores.

import type { LegalForm, LossReason, Product, StageKey } from '../constants';
import { formatMoney } from '../format';
import { autoTasksFor, withoutDuplicates } from '../rules/autoTasks';
import { documentChecklist } from '../rules/documents';
import { normalizeCode } from '../rules/duplicates';
import { getStage } from '../rules/stages';
import { canMoveToStage, type MoveCheck } from '../rules/transitions';
import type { Client, Contact, Deal, Id, Interaction, NewTask, Task } from '../types';
import type { Dataset } from './dataset';

/** Next id in a prefix sequence: c40 → c41. Deterministic, readable, collision-free. */
export function nextId(prefix: string, ids: readonly string[]): string {
  const max = ids.reduce((m, id) => {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    return Number.isInteger(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${max + 1}`;
}

export interface NewClientInput {
  name: string;
  code: string;
  legalForm: LegalForm;
  industry: string;
  region: string;
  annualTurnover: number;
  businessAgeYears: number;
  leadSource: string;
  ownerId: Id;
  contact: Contact;
}

export interface NewLeadInput {
  product: Product;
  requestedAmount: number;
  purpose: string;
}

function autoNote(
  clientId: Id,
  dealId: Id | null,
  date: Date,
  summary: string,
  id: string,
): Interaction {
  return {
    id,
    clientId,
    dealId,
    type: 'note',
    date: date.toISOString(),
    authorId: null,
    summary,
    auto: true,
  };
}

function buildClient(data: Dataset, input: NewClientInput): Client {
  return {
    id: nextId(
      'c',
      data.clients.map((c) => c.id),
    ),
    name: input.name.trim(),
    code: normalizeCode(input.code),
    legalForm: input.legalForm,
    industry: input.industry.trim(),
    region: input.region.trim(),
    annualTurnover: input.annualTurnover,
    businessAgeYears: input.businessAgeYears,
    contacts: [input.contact],
    leadSource: input.leadSource,
    ownerId: input.ownerId,
    tags: [],
    status: 'New',
  };
}

/** New client without a deal. The "created" entry starts its history, so it is not flagged as stale. */
export function createClient(data: Dataset, input: NewClientInput, now: Date) {
  const client = buildClient(data, input);
  const note = autoNote(
    client.id,
    null,
    now,
    `Client created · source: ${client.leadSource}`,
    nextId(
      'i',
      data.interactions.map((i) => i.id),
    ),
  );
  return {
    client,
    data: {
      ...data,
      clients: [...data.clients, client],
      interactions: [note, ...data.interactions],
    },
  };
}

/**
 * New deal for an existing client, starting at "New lead", plus the auto task
 * "Call tomorrow 10:00" (AGENTS.md auto-task rules). The deal goes to the client's owner.
 */
export function createDeal(data: Dataset, clientId: Id, lead: NewLeadInput, now: Date) {
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) throw new Error(`createDeal: unknown client ${clientId}`);
  const deal: Deal = {
    id: nextId(
      'd',
      data.deals.map((d) => d.id),
    ),
    clientId,
    product: lead.product,
    requestedAmount: lead.requestedAmount,
    purpose: lead.purpose.trim(),
    stage: 'new',
    ownerId: client.ownerId,
    createdAt: now.toISOString(),
    stageEnteredAt: now.toISOString(),
    commissionRate: null,
    lostReason: null,
  };
  const newTasks = withoutDuplicates(autoTasksFor({ type: 'lead_created', deal }, now), data.tasks);
  const taskIds = data.tasks.map((t) => t.id);
  const tasks: Task[] = newTasks.map((t) => {
    const id = nextId('t', taskIds);
    taskIds.push(id);
    return { ...t, id };
  });
  const note = autoNote(
    clientId,
    deal.id,
    now,
    `Lead created: ${deal.product} · ${formatMoney(deal.requestedAmount)}`,
    nextId(
      'i',
      data.interactions.map((i) => i.id),
    ),
  );
  return {
    deal,
    tasks,
    data: {
      ...data,
      deals: [...data.deals, deal],
      tasks: [...tasks, ...data.tasks],
      interactions: [note, ...data.interactions],
    },
  };
}

/** New lead = new client + a deal in "New lead" + the auto task "Call tomorrow 10:00". */
export function createLead(data: Dataset, input: NewClientInput, lead: NewLeadInput, now: Date) {
  const { client, data: withClient } = createClient(data, input, now);
  return { client, ...createDeal(withClient, client.id, lead, now) };
}

export interface NewInteractionInput {
  clientId: Id;
  dealId: Id | null;
  type: Interaction['type'];
  summary: string;
  /** null = system entry (auto). */
  authorId: Id | null;
}

/** Adds an entry to the client's history; it shows at the top of the timeline immediately. */
export function addInteraction(data: Dataset, input: NewInteractionInput, now: Date) {
  const interaction: Interaction = {
    id: nextId(
      'i',
      data.interactions.map((i) => i.id),
    ),
    ...input,
    summary: input.summary.trim(),
    date: now.toISOString(),
    auto: input.authorId === null,
  };
  return { interaction, data: { ...data, interactions: [interaction, ...data.interactions] } };
}

export function updateClient(data: Dataset, clientId: Id, patch: Partial<Client>): Dataset {
  return {
    ...data,
    clients: data.clients.map((c) => (c.id === clientId ? { ...c, ...patch, id: c.id } : c)),
  };
}

export function setTaskStatus(data: Dataset, taskId: Id, status: Task['status']): Dataset {
  return { ...data, tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) };
}

export interface NewTaskInput {
  title: string;
  type: Task['type'];
  clientId: Id | null;
  dealId: Id | null;
  assigneeId: Id;
  dueAt: Date | null;
  priority: Task['priority'];
}

export function addTask(data: Dataset, input: NewTaskInput) {
  const task: Task = {
    id: nextId(
      't',
      data.tasks.map((t) => t.id),
    ),
    ...input,
    title: input.title.trim(),
    dueAt: input.dueAt ? input.dueAt.toISOString() : null,
    status: 'open',
    source: 'manual',
    autoKey: null,
  };
  return { task, data: { ...data, tasks: [task, ...data.tasks] } };
}

/**
 * Head changes the client's owner. Open deals follow the client (deal owner = client owner),
 * and open tasks the previous owner had on this client move too. Closed deals keep their
 * owner, so past commission stays attributed to whoever earned it.
 */
export function reassignClient(data: Dataset, clientId: Id, ownerId: Id, now: Date) {
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) throw new Error(`reassignClient: unknown client ${clientId}`);
  const from = client.ownerId;
  if (from === ownerId) return { data, moved: { deals: 0, tasks: 0 } };
  const name = (id: Id) => data.users.find((u) => u.id === id)?.name ?? id;

  let deals = 0;
  let tasks = 0;
  const next: Dataset = {
    ...data,
    clients: data.clients.map((c) => (c.id === clientId ? { ...c, ownerId } : c)),
    deals: data.deals.map((d) => {
      if (d.clientId !== clientId || d.stage === 'won' || d.stage === 'lost') return d;
      deals += 1;
      return { ...d, ownerId };
    }),
    tasks: data.tasks.map((t) => {
      if (t.clientId !== clientId || t.status !== 'open' || t.assigneeId !== from) return t;
      tasks += 1;
      return { ...t, assigneeId: ownerId };
    }),
  };
  const note = autoNote(
    clientId,
    null,
    now,
    `Owner changed: ${name(from)} → ${name(ownerId)}`,
    nextId(
      'i',
      data.interactions.map((i) => i.id),
    ),
  );
  return { data: { ...next, interactions: [note, ...next.interactions] }, moved: { deals, tasks } };
}

const phoneKey = (c: Contact) => c.phone.replace(/\D/g, '');

/**
 * Merge a duplicate into the record we keep. Deals, history and tasks move to `keepId`;
 * moved deals (and their owner's tasks) go to the kept record's owner so ownership stays
 * consistent. Contacts are combined without repeating the same phone.
 */
export function mergeClients(data: Dataset, keepId: Id, removeId: Id, now: Date) {
  const keep = data.clients.find((c) => c.id === keepId);
  const remove = data.clients.find((c) => c.id === removeId);
  if (!keep || !remove || keep.id === remove.id) throw new Error('mergeClients: invalid pair');

  const movedDeals = new Set(data.deals.filter((d) => d.clientId === removeId).map((d) => d.id));
  const knownPhones = new Set(keep.contacts.map(phoneKey));
  const merged: Client = {
    ...keep,
    contacts: [...keep.contacts, ...remove.contacts.filter((c) => !knownPhones.has(phoneKey(c)))],
    tags: [...new Set([...keep.tags, ...remove.tags])],
  };

  const movedInteractions = data.interactions.filter((i) => i.clientId === removeId).length;
  const movedTasks = data.tasks.filter((t) => t.clientId === removeId).length;
  const note = autoNote(
    keepId,
    null,
    now,
    `Merged with duplicate “${remove.name}” (source: ${remove.leadSource.toLowerCase()})`,
    nextId(
      'i',
      data.interactions.map((i) => i.id),
    ),
  );

  return {
    moved: { deals: movedDeals.size, interactions: movedInteractions, tasks: movedTasks },
    data: {
      ...data,
      clients: data.clients
        .filter((c) => c.id !== removeId)
        .map((c) => (c.id === keepId ? merged : c)),
      deals: data.deals.map((d) =>
        movedDeals.has(d.id) ? { ...d, clientId: keepId, ownerId: keep.ownerId } : d,
      ),
      interactions: [
        note,
        ...data.interactions.map((i) => (i.clientId === removeId ? { ...i, clientId: keepId } : i)),
      ],
      tasks: data.tasks.map((t) => {
        if (t.clientId !== removeId) return t;
        const reassign = t.assigneeId === remove.ownerId;
        return { ...t, clientId: keepId, assigneeId: reassign ? keep.ownerId : t.assigneeId };
      }),
    },
  };
}

export interface MoveResult {
  check: MoveCheck;
  data: Dataset;
  /** Auto tasks created by entering the new stage (for the "N tasks created" toast). */
  tasks: Task[];
}

/**
 * Moves a deal to another stage through the stage rules (canMoveToStage). A blocked move returns
 * the reason and the untouched dataset. An allowed move resets the stage timer, logs the change
 * in the timeline and creates the auto tasks for the new stage:
 * Document collection → one per missing document + client reminder; Won → commission invoice.
 */
export function moveDeal(
  data: Dataset,
  dealId: Id,
  target: StageKey,
  now: Date,
  lostReason: LossReason | null = null,
): MoveResult {
  const deal = data.deals.find((d) => d.id === dealId);
  if (!deal) throw new Error(`moveDeal: unknown deal ${dealId}`);
  const applications = data.applications.filter((a) => a.dealId === dealId);
  const check = canMoveToStage(deal, target, { applications, lostReason });
  if (!check.allowed) return { check, data, tasks: [] };

  const moved: Deal = {
    ...deal,
    stage: target,
    stageEnteredAt: now.toISOString(),
    lostReason: target === 'lost' ? lostReason : null,
  };

  let candidates: NewTask[] = [];
  let documents = data.documents;
  if (target === 'docs') {
    let dealDocs = data.documents.filter((d) => d.dealId === dealId);
    // First time in Document collection: generate the checklist for this legal form and product.
    const client = data.clients.find((c) => c.id === deal.clientId);
    if (dealDocs.length === 0 && client) {
      dealDocs = documentChecklist(client.legalForm, deal.product, now.getFullYear()).map(
        (type, n) => ({
          id: `${dealId}-doc${n + 1}`,
          dealId,
          type,
          status: 'not_requested' as const,
          validUntil: null,
        }),
      );
      documents = [...data.documents, ...dealDocs];
    }
    candidates = autoTasksFor({ type: 'stage_entered', deal: moved, documents: dealDocs }, now);
  } else if (target === 'won') {
    const paid = applications.find((a) => a.status === 'disbursed');
    if (paid) candidates = autoTasksFor({ type: 'disbursed', deal: moved, application: paid }, now);
  }
  const taskIds = data.tasks.map((t) => t.id);
  const tasks: Task[] = withoutDuplicates(candidates, data.tasks).map((t) => {
    const id = nextId('t', taskIds);
    taskIds.push(id);
    return { ...t, id };
  });

  const from = getStage(deal.stage).label;
  const to = getStage(target).label;
  const summary =
    target === 'won'
      ? 'Deal marked as won · funds disbursed'
      : target === 'lost'
        ? `Deal marked as lost: ${lostReason ?? ''}`
        : `Deal stage: “${from}” → “${to}”`;
  const note: Interaction = {
    ...autoNote(
      deal.clientId,
      dealId,
      now,
      summary,
      nextId(
        'i',
        data.interactions.map((i) => i.id),
      ),
    ),
    type: 'stage_change',
  };

  return {
    check,
    tasks,
    data: {
      ...data,
      deals: data.deals.map((d) => (d.id === dealId ? moved : d)),
      documents,
      tasks: [...tasks, ...data.tasks],
      interactions: [note, ...data.interactions],
    },
  };
}
