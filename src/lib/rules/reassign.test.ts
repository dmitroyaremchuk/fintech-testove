import { describe, expect, it } from 'vitest';
import { OVERLOAD_OPEN_DEALS, OVERLOAD_OVERDUE_TASKS } from '../constants';
import { isOverloaded, reassignGroup, suggestAssignee } from './reassign';
import { makeDeal } from './test-fixtures';

describe('reassignGroup', () => {
  const deals = [
    makeDeal({ id: 'd1', clientId: 'c1', stage: 'qual' }),
    makeDeal({ id: 'd2', clientId: 'c1', stage: 'docs' }),
    makeDeal({ id: 'd3', clientId: 'c1', stage: 'won' }),
    makeDeal({ id: 'd4', clientId: 'c2', stage: 'new' }),
  ];

  it('pulls in the other open deals of the same client', () => {
    expect(reassignGroup(deals, ['d1'])).toEqual(['d1', 'd2']);
  });
  it('never moves closed deals', () => {
    expect(reassignGroup(deals, ['d3'])).toEqual([]);
    expect(reassignGroup(deals, ['d2', 'd4'])).toEqual(['d1', 'd2', 'd4']);
  });
  it('empty selection moves nothing', () => {
    expect(reassignGroup(deals, [])).toEqual([]);
  });
});

describe('isOverloaded', () => {
  it('uses the open-deal and overdue-task thresholds', () => {
    expect(isOverloaded({ openDeals: OVERLOAD_OPEN_DEALS, overdueTasks: 0 })).toBe(true);
    expect(isOverloaded({ openDeals: 0, overdueTasks: OVERLOAD_OVERDUE_TASKS })).toBe(true);
    expect(
      isOverloaded({
        openDeals: OVERLOAD_OPEN_DEALS - 1,
        overdueTasks: OVERLOAD_OVERDUE_TASKS - 1,
      }),
    ).toBe(false);
  });
});

describe('suggestAssignee', () => {
  const loads = [
    { userId: 'u1', openDeals: 18, overdueTasks: 9 },
    { userId: 'u2', openDeals: 7, overdueTasks: 3 },
    { userId: 'u3', openDeals: 7, overdueTasks: 1 },
    { userId: 'u4', openDeals: 12, overdueTasks: 0 },
  ];

  it('picks the least loaded manager other than the source', () => {
    expect(suggestAssignee(loads, 'u3', 1)).toBe('u2');
    expect(suggestAssignee(loads, 'u1', 2)).toBe('u3');
  });
  it('skips managers the move would overload', () => {
    const tight = [
      { userId: 'u1', openDeals: 18, overdueTasks: 0 },
      { userId: 'u2', openDeals: 13, overdueTasks: 0 },
      { userId: 'u3', openDeals: 14, overdueTasks: 4 },
    ];
    expect(suggestAssignee(tight, 'u1', 1)).toBe('u2');
    expect(suggestAssignee(tight, 'u1', 3)).toBe('u2');
  });
  it('returns null when there is nobody else', () => {
    expect(suggestAssignee([loads[0]!], 'u1', 1)).toBeNull();
  });
});
