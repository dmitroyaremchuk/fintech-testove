import { describe, expect, it } from 'vitest';
import { isOverdue, taskGroup } from './tasks';
import { NOW, local } from './test-fixtures';

// NOW is Tuesday, Sep 29 2026, 10:14.
const open = (dueAt: string | null) => ({ status: 'open' as const, dueAt });

describe('isOverdue', () => {
  it('earlier calendar day and still open → overdue', () => {
    expect(isOverdue(open(local(2026, 9, 28, 18)), NOW)).toBe(true);
  });

  it('earlier today is "Today", not overdue', () => {
    expect(isOverdue(open(local(2026, 9, 29, 9)), NOW)).toBe(false);
  });

  it('done tasks and tasks without a date are never overdue', () => {
    expect(isOverdue({ status: 'done', dueAt: local(2026, 9, 1) }, NOW)).toBe(false);
    expect(isOverdue(open(null), NOW)).toBe(false);
  });
});

describe('taskGroup', () => {
  it.each([
    [local(2026, 9, 25), 'overdue'],
    [local(2026, 9, 29, 18), 'today'],
    [local(2026, 9, 30, 10), 'tomorrow'],
    [local(2026, 10, 1, 11), 'week'], // Thursday
    [local(2026, 10, 4, 11), 'week'], // Sunday closes the week
    [local(2026, 10, 5, 9), 'later'], // next Monday
    [null, 'none'],
  ])('%s → %s', (dueAt, group) => {
    expect(taskGroup({ dueAt }, NOW)).toBe(group);
  });

  it('on Sunday, Monday is "Tomorrow" and nothing else fits "This week"', () => {
    const sunday = new Date(2026, 9, 4, 12);
    expect(taskGroup({ dueAt: local(2026, 10, 5, 9) }, sunday)).toBe('tomorrow');
    expect(taskGroup({ dueAt: local(2026, 10, 6, 9) }, sunday)).toBe('later');
  });
});
