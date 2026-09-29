import { OVERLOAD_OPEN_DEALS, OVERLOAD_OVERDUE_TASKS } from '../constants';
import type { Deal, Id } from '../types';
import { isClosedStage } from './stages';

export function reassignGroup(
  deals: readonly Pick<Deal, 'id' | 'clientId' | 'stage'>[],
  selectedIds: readonly Id[],
): Id[] {
  const selected = new Set(selectedIds);
  const clientIds = new Set(
    deals.filter((d) => selected.has(d.id) && !isClosedStage(d.stage)).map((d) => d.clientId),
  );
  return deals.filter((d) => clientIds.has(d.clientId) && !isClosedStage(d.stage)).map((d) => d.id);
}

export interface AssigneeLoad {
  userId: Id;
  openDeals: number;
  overdueTasks: number;
}

export function isOverloaded(load: Pick<AssigneeLoad, 'openDeals' | 'overdueTasks'>): boolean {
  return load.openDeals >= OVERLOAD_OPEN_DEALS || load.overdueTasks >= OVERLOAD_OVERDUE_TASKS;
}

export function suggestAssignee(
  loads: readonly AssigneeLoad[],
  fromId: Id,
  incoming: number,
): Id | null {
  const candidates = loads
    .filter((l) => l.userId !== fromId)
    .sort((a, b) => a.openDeals - b.openDeals || a.overdueTasks - b.overdueTasks);
  const fits = candidates.find((l) => !isOverloaded({ ...l, openDeals: l.openDeals + incoming }));
  return (fits ?? candidates[0])?.userId ?? null;
}
