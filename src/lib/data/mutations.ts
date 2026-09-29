// Pure dataset updates. Each returns a new Dataset; the store commits it, and the previous
// Dataset is what Undo restores.

import type { LegalForm, Product } from '../constants';
import { formatMoney } from '../format';
import { autoTasksFor, withoutDuplicates } from '../rules/autoTasks';
import { normalizeCode } from '../rules/duplicates';
import type { Client, Contact, Deal, Id, Interaction, Task } from '../types';
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

/** New lead = new client + a deal in "New lead" + the auto task "Call tomorrow 10:00". */
export function createLead(data: Dataset, input: NewClientInput, lead: NewLeadInput, now: Date) {
  const { client, data: withClient } = createClient(data, input, now);
  const deal: Deal = {
    id: nextId(
      'd',
      data.deals.map((d) => d.id),
    ),
    clientId: client.id,
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
  const newTasks = withoutDuplicates(
    autoTasksFor({ type: 'lead_created', deal }, now),
    withClient.tasks,
  );
  const taskIds = withClient.tasks.map((t) => t.id);
  const tasks: Task[] = newTasks.map((t) => {
    const id = nextId('t', taskIds);
    taskIds.push(id);
    return { ...t, id };
  });
  const note = autoNote(
    client.id,
    deal.id,
    now,
    `Lead created: ${deal.product} · ${formatMoney(deal.requestedAmount)}`,
    nextId(
      'i',
      withClient.interactions.map((i) => i.id),
    ),
  );
  return {
    client,
    deal,
    tasks,
    data: {
      ...withClient,
      deals: [...withClient.deals, deal],
      tasks: [...tasks, ...withClient.tasks],
      interactions: [note, ...withClient.interactions],
    },
  };
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
