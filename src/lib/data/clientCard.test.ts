import { describe, expect, it } from 'vitest';
import { validateClientField } from '../rules/clients';
import { dueFromPreset } from '../rules/tasks';
import { formatRegion } from '../format';
import { clientLtv, nextStep, openDealsOf, openTasksOf, timelineGroups } from './clientCard';
import {
  addInteraction,
  addTask,
  createDeal,
  reassignClient,
  setTaskStatus,
  updateClient,
} from './mutations';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena = scopeDataset(all, { role: 'manager', userId: 'u1' });

describe('timelineGroups', () => {
  const groups = timelineGroups(olena, 'c1', { source: 'all', type: null });

  it('groups by day, newest first', () => {
    const days = groups.map((g) => g.day.getTime());
    expect(days).toEqual([...days].sort((a, b) => b - a));
    expect(new Set(days).size).toBe(days.length);
    expect(groups[0]!.day).toEqual(new Date(2026, 8, 29));
  });

  it('manual / automatic filter', () => {
    const manual = timelineGroups(olena, 'c1', { source: 'manual', type: null }).flatMap(
      (g) => g.items,
    );
    const auto = timelineGroups(olena, 'c1', { source: 'auto', type: null }).flatMap(
      (g) => g.items,
    );
    expect(manual.length).toBeGreaterThan(0);
    expect(manual.every((i) => !i.interaction.auto && i.author)).toBe(true);
    expect(auto.every((i) => i.interaction.auto && !i.author)).toBe(true);
    expect(manual.length + auto.length).toBe(groups.flatMap((g) => g.items).length);
  });

  it('type filter', () => {
    const calls = timelineGroups(olena, 'c1', { source: 'all', type: 'call' }).flatMap(
      (g) => g.items,
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((i) => i.interaction.type === 'call')).toBe(true);
  });

  it('a note added now appears at the top right away', () => {
    const { data } = addInteraction(
      olena,
      {
        clientId: 'c1',
        dealId: null,
        type: 'note',
        summary: '  Asked for the Q3 statements  ',
        authorId: 'u1',
      },
      NOW,
    );
    const first = timelineGroups(data, 'c1', { source: 'all', type: null })[0]!.items[0]!;
    expect(first.interaction).toMatchObject({
      type: 'note',
      summary: 'Asked for the Q3 statements',
      auto: false,
    });
    expect(first.author?.name).toBe('Olena Koval');
  });
});

describe('nextStep', () => {
  it('Agro-Skhid: the earliest dated open task', () => {
    const step = nextStep(olena, 'c1', NOW);
    expect(step.kind).toBe('task');
    if (step.kind === 'task') {
      expect(step.task.title).toBe('Confirm disbursement date with Universal Capital');
      expect(step.overdue).toBe(false);
      expect(step.deal?.id).toBe('d1');
    }
  });

  it('an overdue task is the next step, flagged as overdue', () => {
    const step = nextStep(olena, 'c11', NOW);
    expect(step.kind === 'task' && step.overdue).toBe(true);
  });

  it('nothing dated → none (the card warns and offers to schedule)', () => {
    const noTasks = { ...olena, tasks: olena.tasks.filter((t) => t.clientId !== 'c16') };
    expect(nextStep(noTasks, 'c16', NOW)).toEqual({ kind: 'none', undatedTasks: 0 });
  });

  it('completing the only task leaves nothing planned', () => {
    const only = openTasksOf(olena, 'c38');
    const done = only.reduce((d, t) => setTaskStatus(d, t.id, 'done'), olena);
    expect(nextStep(done, 'c38', NOW).kind).toBe('none');
  });
});

describe('clientLtv', () => {
  it('Agro-Skhid: 2% of the 4.8M loan paid out earlier, plus the open 8M deal as potential', () => {
    const ltv = clientLtv(olena, 'c1');
    expect(ltv.rows).toHaveLength(1);
    expect(ltv.rows[0]).toMatchObject({ amount: 4_800_000, fee: 96_000 });
    expect(ltv.total).toBe(96_000);
    expect(ltv.potential).toBe(160_000); // accepted offer 8M × 2%
  });

  it('first deal with a client → no history, only potential', () => {
    const ltv = clientLtv(olena, 'c2');
    expect(ltv.rows).toEqual([]);
    expect(ltv.potential).toBe(12_000);
  });
});

describe('open deals and tasks', () => {
  it('Smart Pack has two open deals, most advanced first', () => {
    expect(openDealsOf(olena, 'c14').map((d) => d.id)).toEqual(['d13', 'd17']);
  });
});

describe('validateClientField', () => {
  const c1 = all.clients.find((c) => c.id === 'c1')!;
  it('EDRPOU: format and duplicates', () => {
    expect(validateClientField('code', '123', c1, all.clients)).toEqual({
      ok: false,
      error: 'EDRPOU must be exactly 8 digits',
    });
    expect(validateClientField('code', '41876320', c1, all.clients)).toEqual({
      ok: false,
      error: 'Already used by “Smart Pack Ukraine LLC”',
    });
    expect(validateClientField('code', '40218763', c1, all.clients)).toEqual({
      ok: true,
      patch: { code: '40218763' },
    });
  });

  it('text, amount and years', () => {
    expect(validateClientField('industry', '  ', c1, all.clients).ok).toBe(false);
    expect(validateClientField('industry', ' Grain and oilseeds ', c1, all.clients)).toEqual({
      ok: true,
      patch: { industry: 'Grain and oilseeds' },
    });
    expect(validateClientField('annualTurnover', '90 000 000', c1, all.clients)).toEqual({
      ok: true,
      patch: { annualTurnover: 90_000_000 },
    });
    expect(validateClientField('annualTurnover', '90M', c1, all.clients).ok).toBe(false);
    expect(validateClientField('businessAgeYears', '9.5', c1, all.clients).ok).toBe(false);
  });

  it('formatRegion', () => {
    expect(formatRegion('Kharkiv')).toBe('Kharkiv Oblast');
    expect(formatRegion('Kyiv')).toBe('Kyiv City');
    expect(formatRegion('Poltava Oblast')).toBe('Poltava Oblast');
  });
});

describe('mutations used by the card', () => {
  it('updateClient patches one client only', () => {
    const next = updateClient(all, 'c1', { industry: 'Grain and oilseeds' });
    expect(next.clients.find((c) => c.id === 'c1')?.industry).toBe('Grain and oilseeds');
    expect(next.clients.find((c) => c.id === 'c2')).toBe(all.clients.find((c) => c.id === 'c2'));
  });

  it('addTask creates an open manual task for the next step', () => {
    const due = dueFromPreset('tomorrow', NOW);
    const { task } = addTask(all, {
      title: 'Call Serhii',
      type: 'call',
      clientId: 'c1',
      dealId: null,
      assigneeId: 'u1',
      dueAt: due,
      priority: 'med',
    });
    expect(task).toMatchObject({
      status: 'open',
      source: 'manual',
      autoKey: null,
      dueAt: new Date(2026, 8, 30, 10).toISOString(),
    });
  });

  it('createDeal adds a deal in New lead with the call task, owned by the client’s owner', () => {
    const { deal, tasks } = createDeal(
      all,
      'c3',
      { product: 'Leasing', requestedAmount: 2_000_000, purpose: 'Tower crane' },
      NOW,
    );
    expect(deal).toMatchObject({ clientId: 'c3', ownerId: 'u3', stage: 'new' });
    expect(tasks[0]?.assigneeId).toBe('u3');
  });

  it('reassignClient moves open deals and the old owner’s open tasks; closed deals stay', () => {
    const { data, moved } = reassignClient(all, 'c1', 'u2', NOW);
    expect(data.clients.find((c) => c.id === 'c1')?.ownerId).toBe('u2');
    expect(data.deals.find((d) => d.id === 'd1')?.ownerId).toBe('u2');
    expect(data.deals.find((d) => d.id === 'd29')?.ownerId).toBe('u1'); // won earlier
    expect(moved.deals).toBe(1);
    expect(
      data.tasks
        .filter((t) => t.clientId === 'c1' && t.status === 'open')
        .every((t) => t.assigneeId === 'u2'),
    ).toBe(true);
    expect(data.interactions[0]?.summary).toBe('Owner changed: Olena Koval → Ihor Bondar');
  });

  it('reassigning to the same owner is a no-op', () => {
    expect(reassignClient(all, 'c1', 'u1', NOW).data).toBe(all);
  });
});

describe('dueFromPreset', () => {
  it('presets from Tuesday 10:14', () => {
    expect(dueFromPreset('today', NOW)).toEqual(new Date(2026, 8, 29, 18));
    expect(dueFromPreset('in3', NOW)).toEqual(new Date(2026, 9, 2, 10));
    expect(dueFromPreset('nextWeek', NOW)).toEqual(new Date(2026, 9, 5, 10));
  });

  it('"today" late in the evening is an hour from now, never the past', () => {
    const late = new Date(2026, 8, 29, 20, 30);
    expect(dueFromPreset('today', late)).toEqual(new Date(2026, 8, 29, 21, 30));
  });

  it('"next Monday" on a Monday means the following week', () => {
    expect(dueFromPreset('nextWeek', new Date(2026, 9, 5, 9))).toEqual(new Date(2026, 9, 12, 10));
  });
});
