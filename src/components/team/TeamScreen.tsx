'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Timer, Users } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@/src/components/ui';
import { OVERLOAD_OPEN_DEALS, OVERLOAD_OVERDUE_TASKS } from '@/src/lib/constants';
import { findUser, useDataStore, type Dataset } from '@/src/lib/data';
import { periodRange, teamWorkload, type ManagerLoad, type Period } from '@/src/lib/data/metrics';
import { reassignDeals } from '@/src/lib/data/mutations';
import { formatMoney, formatMoneyCompact } from '@/src/lib/format';
import { useNow } from '@/src/lib/hooks/useNow';
import { cn } from '@/src/lib/cn';
import { DashCard, PeriodSelect, pct } from '../dashboard/parts';
import { ReassignModal } from './ReassignModal';

const COLUMNS = 'minmax(0,1.4fr) 76px 88px 68px 92px minmax(268px,1.5fr) 96px';

export function TeamScreen({ data }: { data: Dataset }) {
  const toast = useToast();
  const commit = useDataStore((s) => s.commit);
  const now = useNow();
  const [period, setPeriod] = useState<Period>('month');
  const [fromId, setFromId] = useState<string | null>(null);
  const range = periodRange(period, now);
  const loads = teamWorkload(data, now, range);
  const from = loads.find((l) => l.user.id === fromId);

  if (loads.length === 0) {
    return (
      <EmptyState
        icon={<Users size={22} strokeWidth={1.75} />}
        title="No managers yet"
        description="Add managers to see their workload and hand over deals."
      />
    );
  }

  const total = {
    openDeals: sum(loads, (l) => l.openDeals),
    pipeline: sum(loads, (l) => l.pipeline),
    overSla: sum(loads, (l) => l.overSla),
    overdueTasks: sum(loads, (l) => l.overdueTasks),
    earned: sum(loads, (l) => l.progress.earned),
    target: sum(loads, (l) => l.progress.target),
  };
  const overloaded = loads.filter((l) => l.overloaded).length;

  const confirm = (dealIds: string[], toId: string, reason: string) => {
    const previous = data;
    const { data: next, moved } = reassignDeals(data, dealIds, toId, now, reason);
    commit(next);
    setFromId(null);
    const tasks = moved.tasks
      ? ` · ${moved.tasks} open ${moved.tasks === 1 ? 'task' : 'tasks'} moved`
      : '';
    toast.show({
      message: `${moved.deals} ${moved.deals === 1 ? 'deal' : 'deals'} reassigned to ${findUser(data, toId)?.name}${tasks}`,
      onUndo: () => commit(previous),
    });
  };

  return (
    <div className="flex max-w-content flex-col gap-3.5 px-6 pt-5 pb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">Team</h1>
          <p className="mt-0.75 text-text-muted tabular-nums">
            {loads.length} managers · {total.openDeals} open deals ·{' '}
            <span className={cn(overloaded > 0 && 'text-danger')}>{overloaded} overloaded</span>
          </p>
        </div>
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

      <DashCard
        title="Managers"
        decision="who to take deals from and who has room for more. Paid out is counted for the selected period"
        aside={
          <span className="text-meta text-text-muted">
            Overloaded: {OVERLOAD_OPEN_DEALS}+ open deals or {OVERLOAD_OVERDUE_TASKS}+ overdue tasks
          </span>
        }
      >
        <Table columns={COLUMNS} label="Managers">
          <TableHeader>
            <TableHead>Manager</TableHead>
            <TableHead align="right">Open deals</TableHead>
            <TableHead align="right">Pipeline</TableHead>
            <TableHead align="right">Over SLA</TableHead>
            <TableHead align="right">Overdue tasks</TableHead>
            <TableHead>Paid out vs target · {range.title}</TableHead>
            <TableHead />
          </TableHeader>
          <TableBody>
            {loads.map((l) => (
              <ManagerRow key={l.user.id} load={l} onReassign={() => setFromId(l.user.id)} />
            ))}
            <TableRow className="border-b-0 bg-surface-subtle font-semibold">
              <TableCell>Team total</TableCell>
              <TableCell align="right">{total.openDeals}</TableCell>
              <TableCell align="right">{formatMoneyCompact(total.pipeline)}</TableCell>
              <TableCell align="right">{total.overSla}</TableCell>
              <TableCell align="right">{total.overdueTasks}</TableCell>
              <TableCell>
                <Paid earned={total.earned} target={total.target} />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </DashCard>

      {from && (
        <ReassignModal
          data={data}
          now={now}
          from={from}
          loads={loads}
          onClose={() => setFromId(null)}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

function ManagerRow({ load, onReassign }: { load: ManagerLoad; onReassign: () => void }) {
  const pipelineHref = `/pipeline?owner=${load.user.id}`;
  return (
    <TableRow flagged={load.overloaded}>
      <TableCell className="flex items-center gap-2">
        <Avatar name={load.user.name} size="md" />
        <Link
          href={pipelineHref}
          className="truncate font-medium hover:text-accent hover:underline focus-visible:shadow-focus focus-visible:outline-none"
        >
          {load.user.name}
        </Link>
        {load.overloaded && (
          <Badge tone="red" size="sm">
            Overloaded
          </Badge>
        )}
      </TableCell>
      <TableCell
        align="right"
        className={cn('font-medium', load.openDeals >= OVERLOAD_OPEN_DEALS && 'text-danger')}
      >
        {load.openDeals}
      </TableCell>
      <TableCell align="right" muted>
        {formatMoneyCompact(load.pipeline)}
      </TableCell>
      <TableCell align="right">
        {load.overSla ? (
          <Link
            href={`${pipelineHref}&filter=over-sla`}
            className="inline-flex items-center gap-1 text-danger hover:underline"
          >
            <Timer size={13} strokeWidth={2} />
            {load.overSla}
          </Link>
        ) : (
          <span className="text-text-disabled">0</span>
        )}
      </TableCell>
      <TableCell
        align="right"
        className={cn('font-medium', load.overdueTasks >= OVERLOAD_OVERDUE_TASKS && 'text-danger')}
      >
        {load.overdueTasks}
      </TableCell>
      <TableCell>
        <Paid earned={load.progress.earned} target={load.progress.target} />
      </TableCell>
      <TableCell align="right">
        <Button
          size="xs"
          icon={ArrowRightLeft}
          onClick={onReassign}
          disabled={load.openDeals === 0}
          title={load.openDeals === 0 ? 'No open deals to hand over' : undefined}
        >
          Reassign
        </Button>
      </TableCell>
    </TableRow>
  );
}

function Paid({ earned, target }: { earned: number; target: number }) {
  const ratio = target ? earned / target : null;
  return (
    <span className="flex items-center gap-2.5">
      <span className="h-1.5 w-14 shrink-0 overflow-hidden rounded-track bg-surface-muted">
        <span
          className="block h-full bg-accent"
          style={{ width: `${Math.min(100, (ratio ?? 0) * 100)}%` }}
        />
      </span>
      <span className="min-w-0 truncate text-sm">
        {formatMoney(earned)}{' '}
        <span className="font-normal text-text-muted">/ {formatMoney(target)}</span>
      </span>
      <span className="ml-auto text-sm text-text-tertiary">{pct(ratio)}</span>
    </span>
  );
}

function sum<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((s, i) => s + pick(i), 0);
}
