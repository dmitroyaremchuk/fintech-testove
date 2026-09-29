import { describe, expect, it } from 'vitest';
import {
  chipLabel,
  clientRows,
  filterClientRows,
  sortClientRows,
  type ClientRow,
  type SavedView,
} from './clients';
import { duplicatesByClient, existingWithCode } from './duplicates';
import { createClient, createLead, mergeClients, nextId, type NewClientInput } from './mutations';
import { scopeDataset, type Session } from './scope';
import { createSeed } from './seed/build';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena: Session = { role: 'manager', userId: 'u1' };
const head: Session = { role: 'head', userId: 'h1' };
const rows = clientRows(scopeDataset(all, olena), NOW);
const ids = (list: ClientRow[]) => list.map((r) => r.client.id);

describe('clientRows', () => {
  it('Agro-Skhid: last contact today, one open deal of 8.5M, repeat client', () => {
    const r = rows.find((x) => x.client.id === 'c1')!;
    expect(r.daysSinceContact).toBe(0);
    expect(r.stale).toBe(false);
    expect(r.openDeals).toBe(1);
    expect(r.openAmount).toBe(8_500_000);
    expect(r.repeat).toBe(true);
    expect(r.owner?.name).toBe('Olena Koval');
  });

  it('the inactive car-service client has not been contacted in over 14 days → red', () => {
    const r = rows.find((x) => x.client.id === 'c15')!;
    expect(r.daysSinceContact).toBeGreaterThanOrEqual(14);
    expect(r.stale).toBe(true);
  });
});

describe('filterClientRows', () => {
  const base = { query: '', chips: [], view: 'all' as const };

  it('search matches name, EDRPOU, contact and phone instantly', () => {
    expect(ids(filterClientRows(rows, { ...base, query: 'agro' }))).toEqual(['c1']);
    expect(ids(filterClientRows(rows, { ...base, query: '40218763' }))).toEqual(['c1']);
    expect(ids(filterClientRows(rows, { ...base, query: 'Tetiana Rudenko' }))).toEqual(['c1']);
    expect(ids(filterClientRows(rows, { ...base, query: '050 318 22' }))).toEqual(['c1']);
  });

  it('chips on one field are OR-ed, different fields AND-ed', () => {
    const sp = filterClientRows(rows, {
      ...base,
      chips: [{ field: 'legalForm', value: 'Sole prop.' }],
    });
    const spKyiv = filterClientRows(rows, {
      ...base,
      chips: [
        { field: 'legalForm', value: 'Sole prop.' },
        { field: 'region', value: 'Kyiv' },
      ],
    });
    const activeOrNew = filterClientRows(rows, {
      ...base,
      chips: [
        { field: 'status', value: 'Active' },
        { field: 'status', value: 'New' },
      ],
    });
    expect(sp.every((r) => r.client.legalForm === 'Sole prop.')).toBe(true);
    expect(spKyiv.every((r) => r.client.region === 'Kyiv')).toBe(true);
    expect(spKyiv.length).toBeLessThan(sp.length);
    expect(activeOrNew.some((r) => r.client.status === 'New')).toBe(true);
    expect(activeOrNew.some((r) => r.client.status === 'Inactive')).toBe(false);
  });

  it('built-in views: Agro, Repeat, No contact 14+ days', () => {
    expect(
      filterClientRows(rows, { ...base, view: 'agro' }).every((r) =>
        r.client.tags.includes('Agro'),
      ),
    ).toBe(true);
    expect(ids(filterClientRows(rows, { ...base, view: 'repeat' }))).toEqual(
      expect.arrayContaining(['c1', 'c6']),
    );
    expect(ids(filterClientRows(rows, { ...base, view: 'stale' }))).toContain('c15');
  });

  it('a saved view applies its own query and chips, and the toolbar narrows it further', () => {
    const view: SavedView = {
      id: 'v1',
      label: 'Kyiv',
      query: '',
      chips: [{ field: 'region', value: 'Kyiv' }],
    };
    const kyiv = filterClientRows(rows, { ...base, view });
    expect(kyiv.length).toBeGreaterThan(0);
    expect(kyiv.every((r) => r.client.region === 'Kyiv')).toBe(true);
    expect(ids(filterClientRows(rows, { ...base, view, query: 'smart' }))).toEqual(['c14']);
  });

  it('head can filter by owner', () => {
    const headRows = clientRows(all, NOW);
    const mariia = filterClientRows(headRows, {
      ...base,
      chips: [{ field: 'owner', value: 'u3' }],
    });
    expect(mariia.length).toBeGreaterThan(0);
    expect(mariia.every((r) => r.client.ownerId === 'u3')).toBe(true);
    expect(chipLabel({ field: 'owner', value: 'u3' }, all.users)).toBe('Owner: Mariia Tkachenko');
  });
});

describe('sortClientRows', () => {
  it('last interaction: most recent first', () => {
    const sorted = sortClientRows(rows, 'last');
    const times = sorted.map((r) => r.lastContact?.getTime() ?? -Infinity);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('turnover: largest first; name: A–Z', () => {
    const byTurnover = sortClientRows(rows, 'turnover').map((r) => r.client.annualTurnover);
    expect(byTurnover).toEqual([...byTurnover].sort((a, b) => b - a));
    const names = sortClientRows(rows, 'name').map((r) => r.client.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('duplicates', () => {
  it('Olena sees that her Poltava Mill shares its EDRPOU with Dmytro’s record, which she cannot open', () => {
    const dupes = duplicatesByClient(all, olena);
    expect([...dupes.keys()]).toEqual(['c4']);
    expect(dupes.get('c4')).toEqual([
      expect.objectContaining({
        id: 'c5',
        ownerName: 'Dmytro Savchuk',
        leadSource: 'Cold call',
        canView: false,
      }),
    ]);
  });

  it('head sees both sides and can open both', () => {
    const dupes = duplicatesByClient(all, head);
    expect([...dupes.keys()].sort()).toEqual(['c4', 'c5']);
    expect(dupes.get('c5')?.[0]?.canView).toBe(true);
  });

  it('the New client form finds an existing EDRPOU owned by someone else', () => {
    const found = existingWithCode(all, { role: 'manager', userId: 'u2' }, '40218763');
    expect(found).toEqual([
      expect.objectContaining({ name: 'Agro-Skhid LLC', ownerName: 'Olena Koval', canView: false }),
    ]);
    expect(existingWithCode(all, olena, '11112222')).toEqual([]);
  });
});

const input: NewClientInput = {
  name: 'Zhytomyr Dairy LLC',
  code: '43990011',
  legalForm: 'LLC',
  industry: 'Dairy processing',
  region: 'Zhytomyr',
  annualTurnover: 18e6,
  businessAgeYears: 5,
  leadSource: 'Website',
  ownerId: 'u1',
  contact: {
    name: 'Oksana Hrytsenko',
    position: 'Director',
    phone: '+380 67 555 12 34',
    email: null,
  },
};

describe('mutations', () => {
  it('nextId continues the sequence', () => {
    expect(nextId('c', ['c1', 'c40', 'c9'])).toBe('c41');
    expect(nextId('t', [])).toBe('t1');
  });

  it('createClient adds a New client with a first history entry, so it is not flagged as stale', () => {
    const { data, client } = createClient(all, input, NOW);
    expect(client).toMatchObject({ id: 'c41', status: 'New', ownerId: 'u1', code: '43990011' });
    expect(data.clients).toHaveLength(41);
    const row = clientRows(data, NOW).find((r) => r.client.id === client.id)!;
    expect(row.stale).toBe(false);
    expect(all.clients).toHaveLength(40); // input untouched
  });

  it('createLead adds the client, a deal in New lead and the "call tomorrow 10:00" task', () => {
    const { data, deal, tasks } = createLead(
      all,
      input,
      { product: 'Loan', requestedAmount: 900_000, purpose: 'Milk tank' },
      NOW,
    );
    expect(deal).toMatchObject({ stage: 'new', ownerId: 'u1', requestedAmount: 900_000 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: 'Call — first contact with lead',
      assigneeId: 'u1',
      source: 'auto',
    });
    expect(new Date(tasks[0]!.dueAt!)).toEqual(new Date(2026, 8, 30, 10, 0));
    expect(data.deals).toHaveLength(61);
    expect(new Set(data.tasks.map((t) => t.id)).size).toBe(data.tasks.length);
  });

  it('mergeClients moves deals, history and tasks to the kept record and its owner', () => {
    const { data, moved } = mergeClients(all, 'c4', 'c5', NOW);
    expect(data.clients.find((c) => c.id === 'c5')).toBeUndefined();
    expect(moved.deals).toBe(1);
    const d14 = data.deals.find((d) => d.id === 'd14')!;
    expect(d14).toMatchObject({ clientId: 'c4', ownerId: 'u1' });
    expect(data.interactions.some((i) => i.clientId === 'c5')).toBe(false);
    expect(data.tasks.filter((t) => t.dealId === 'd14').every((t) => t.assigneeId === 'u1')).toBe(
      true,
    );
    // Same phone on both records → the contact is not duplicated.
    expect(data.clients.find((c) => c.id === 'c4')!.contacts).toHaveLength(1);
    expect(duplicatesByClient(data, head).size).toBe(0);
  });

  it('refuses to merge a client with itself', () => {
    expect(() => mergeClients(all, 'c4', 'c4', NOW)).toThrow();
  });
});
