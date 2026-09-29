import { describe, expect, it } from 'vitest';
import { reassignTask, setTaskStatus, snoozeTask } from './mutations';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';
import { reminderCount } from './selectors';
import { contactNudges, reminderSummary, reminderText, taskGroups } from './tasks';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena = scopeDataset(all, { role: 'manager', userId: 'u1' });

describe('taskGroups', () => {
  const groups = taskGroups(olena, NOW, 'all', 'u1');

  it('groups in the design order, only non-empty ones', () => {
    expect(groups.map((g) => g.key)).toEqual([
      'overdue',
      'today',
      'tomorrow',
      'week',
      'later',
      'none',
    ]);
    expect(groups[0]?.rows).toHaveLength(9);
  });

  it('Today and Tomorrow carry their date for the header', () => {
    expect(groups.find((g) => g.key === 'today')?.date?.getDate()).toBe(29);
    expect(groups.find((g) => g.key === 'tomorrow')?.date?.getDate()).toBe(30);
    expect(groups.find((g) => g.key === 'overdue')?.date).toBeNull();
  });

  it('rows link client and deal; overdue sorted oldest first', () => {
    const overdue = groups[0]!.rows;
    const dues = overdue.map((r) => new Date(r.task.dueAt!).getTime());
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
    const r = overdue.find((x) => x.task.title === 'Check application status with FinTrust')!;
    expect(r.client?.name).toBe('Smart Pack Ukraine LLC');
    expect(r.deal?.product).toBe('Factoring');
    expect(r.overdue).toBe(true);
  });

  it('head: all vs mine', () => {
    const allHead = taskGroups(all, NOW, 'all', 'h1').flatMap((g) => g.rows);
    const mine = taskGroups(all, NOW, 'mine', 'h1').flatMap((g) => g.rows);
    expect(allHead.length).toBeGreaterThan(mine.length);
    expect(mine.every((r) => r.task.assigneeId === 'h1')).toBe(true);
  });

  it('completed tasks disappear from the groups', () => {
    const first = groups[0]!.rows[0]!.task;
    const after = taskGroups(setTaskStatus(olena, first.id, 'done'), NOW, 'all', 'u1');
    expect(after[0]!.rows.map((r) => r.task.id)).not.toContain(first.id);
  });
});

describe('reminders (banner and bell share this)', () => {
  it('Olena: today and overdue counts, oldest overdue age', () => {
    const s = reminderSummary(olena, NOW);
    expect(s.overdue).toBe(9);
    expect(s.today).toBeGreaterThan(0);
    expect(s.oldestOverdueDays).toBe(6);
    expect(reminderCount(olena, NOW)).toBe(s.today + s.overdue);
  });

  it('text', () => {
    expect(reminderText({ today: 3, overdue: 2, oldestOverdueDays: 4 })).toBe(
      '3 tasks today, 2 overdue',
    );
    expect(reminderText({ today: 1, overdue: 0, oldestOverdueDays: 0 })).toBe('1 task today');
    expect(reminderText({ today: 0, overdue: 2, oldestOverdueDays: 1 })).toBe('2 overdue');
    expect(reminderText({ today: 0, overdue: 0, oldestOverdueDays: 0 })).toBe('Nothing due today');
  });
});

describe('snooze and reassign', () => {
  const task = olena.tasks.find((t) => t.title === 'Update accounting contacts')!;

  it('snooze moves the task out of Overdue', () => {
    const next = snoozeTask(olena, task.id, new Date(2026, 8, 30, 10));
    const groups = taskGroups(next, NOW, 'all', 'u1');
    expect(groups.find((g) => g.key === 'tomorrow')?.rows.map((r) => r.task.id)).toContain(task.id);
    expect(reminderSummary(next, NOW).overdue).toBe(8);
  });

  it('reassign to another manager; unknown users are refused', () => {
    expect(reassignTask(all, task.id, 'u2').tasks.find((t) => t.id === task.id)?.assigneeId).toBe(
      'u2',
    );
    expect(() => reassignTask(all, task.id, 'nobody')).toThrow();
  });
});

describe('contactNudges', () => {
  it('clients silent for a week or more, longest wait first', () => {
    const nudges = contactNudges(olena, NOW);
    expect(nudges.length).toBeGreaterThan(0);
    expect(nudges[0]?.client.id).toBe('c15'); // Boiko, 42 days
    expect(nudges.every((n) => n.days === null || n.days >= 7)).toBe(true);
    const days = nudges.map((n) => n.days ?? Infinity);
    expect(days).toEqual([...days].sort((a, b) => b - a));
  });

  it('nobody to nudge when every client was contacted this week', () => {
    const fresh = {
      ...olena,
      interactions: olena.clients.map((c, i) => ({
        id: `x${i}`,
        clientId: c.id,
        dealId: null,
        type: 'call' as const,
        date: NOW.toISOString(),
        authorId: 'u1',
        summary: 'Call',
        auto: false,
      })),
    };
    expect(contactNudges(fresh, NOW)).toEqual([]);
  });
});
