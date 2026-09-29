// Clients list: row view model, filters, saved views and sorting.
// Input is an already role-scoped dataset (scopeDataset), so nothing here checks roles.

import { daysSinceContact, isStaleContact } from '../rules/clients';
import { isClosedStage } from '../rules/stages';
import type { Client, Id, User } from '../types';
import type { Dataset } from './dataset';
import { clientMatchesQuery, lastContactByClient } from './selectors';

export interface ClientRow {
  client: Client;
  owner: User | undefined;
  lastContact: Date | null;
  daysSinceContact: number | null;
  /** No contact 14+ days (or never): shown in red. */
  stale: boolean;
  openDeals: number;
  openAmount: number;
  /** Already financed through us (has a Won deal). */
  repeat: boolean;
}

export function clientRows(data: Dataset, now: Date): ClientRow[] {
  const last = lastContactByClient(data);
  const users = new Map(data.users.map((u) => [u.id, u]));
  const open = new Map<Id, { n: number; sum: number }>();
  const won = new Set<Id>();
  for (const d of data.deals) {
    if (d.stage === 'won') won.add(d.clientId);
    if (isClosedStage(d.stage)) continue;
    const agg = open.get(d.clientId) ?? { n: 0, sum: 0 };
    open.set(d.clientId, { n: agg.n + 1, sum: agg.sum + d.requestedAmount });
  }
  return data.clients.map((client) => {
    const lastContact = last.get(client.id) ?? null;
    return {
      client,
      owner: users.get(client.ownerId),
      lastContact,
      daysSinceContact: daysSinceContact(lastContact, now),
      stale: isStaleContact(lastContact, now),
      openDeals: open.get(client.id)?.n ?? 0,
      openAmount: open.get(client.id)?.sum ?? 0,
      repeat: won.has(client.id),
    };
  });
}

// ── Filter chips ─────────────────────────────────────────────

export type ChipField = 'status' | 'legalForm' | 'region' | 'owner';

export interface FilterChip {
  field: ChipField;
  /** For `owner` this is the user id. */
  value: string;
}

const FIELD_LABEL: Record<ChipField, string> = {
  status: 'Status',
  legalForm: 'Form',
  region: 'Region',
  owner: 'Owner',
};

export function chipLabel(chip: FilterChip, users: readonly User[]): string {
  const value =
    chip.field === 'owner'
      ? (users.find((u) => u.id === chip.value)?.name ?? chip.value)
      : chip.value;
  return `${FIELD_LABEL[chip.field]}: ${value}`;
}

export function sameChip(a: FilterChip, b: FilterChip): boolean {
  return a.field === b.field && a.value === b.value;
}

function chipValue(row: ClientRow, field: ChipField): string {
  switch (field) {
    case 'status':
      return row.client.status;
    case 'legalForm':
      return row.client.legalForm;
    case 'region':
      return row.client.region;
    case 'owner':
      return row.client.ownerId;
  }
}

/** Chips on the same field are OR-ed ("Status: Active" or "Status: New"); different fields are AND-ed. */
function matchesChips(row: ClientRow, chips: readonly FilterChip[]): boolean {
  const byField = new Map<ChipField, string[]>();
  for (const c of chips) byField.set(c.field, [...(byField.get(c.field) ?? []), c.value]);
  return [...byField].every(([field, values]) => values.includes(chipValue(row, field)));
}

// ── Saved views (tabs) ───────────────────────────────────────

export type BuiltInViewId = 'all' | 'agro' | 'repeat' | 'stale';

export const BUILT_IN_VIEWS: { id: BuiltInViewId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'agro', label: 'Agro' },
  { id: 'repeat', label: 'Repeat' },
  { id: 'stale', label: 'No contact 14+ days' },
];

/** A filter the user saved: search text + chips under a name. */
export interface SavedView {
  id: string;
  label: string;
  query: string;
  chips: FilterChip[];
}

export function isBuiltInView(id: string): id is BuiltInViewId {
  return BUILT_IN_VIEWS.some((v) => v.id === id);
}

export function matchesBuiltInView(row: ClientRow, view: BuiltInViewId): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'agro':
      return row.client.tags.includes('Agro');
    case 'repeat':
      return row.repeat;
    case 'stale':
      return row.stale;
  }
}

export interface ClientFilterState {
  query: string;
  chips: readonly FilterChip[];
  view: BuiltInViewId | SavedView;
}

export function filterClientRows(
  rows: readonly ClientRow[],
  state: ClientFilterState,
): ClientRow[] {
  const { view } = state;
  const viewQuery = typeof view === 'string' ? '' : view.query;
  const viewChips = typeof view === 'string' ? [] : view.chips;
  return rows.filter(
    (row) =>
      (typeof view !== 'string' || matchesBuiltInView(row, view)) &&
      clientMatchesQuery(row.client, viewQuery) &&
      matchesChips(row, viewChips) &&
      clientMatchesQuery(row.client, state.query) &&
      matchesChips(row, state.chips),
  );
}

// ── Sorting ──────────────────────────────────────────────────

export type ClientSort = 'last' | 'turnover' | 'name';

export const CLIENT_SORTS: { id: ClientSort; label: string }[] = [
  { id: 'last', label: 'Last interaction' },
  { id: 'turnover', label: 'Turnover' },
  { id: 'name', label: 'Name' },
];

/** Last interaction: most recent first, never-contacted last. Turnover: largest first. Name: A–Z. */
export function sortClientRows(rows: readonly ClientRow[], sort: ClientSort): ClientRow[] {
  const byName = (a: ClientRow, b: ClientRow) => a.client.name.localeCompare(b.client.name, 'en');
  const compare: Record<ClientSort, (a: ClientRow, b: ClientRow) => number> = {
    last: (a, b) =>
      (b.lastContact?.getTime() ?? -Infinity) - (a.lastContact?.getTime() ?? -Infinity) ||
      byName(a, b),
    turnover: (a, b) => b.client.annualTurnover - a.client.annualTurnover || byName(a, b),
    name: byName,
  };
  return [...rows].sort(compare[sort]);
}
