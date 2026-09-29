import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, FileWarning, ListPlus, Plus, Timer, Zap } from 'lucide-react';
import { Badge, Button, Checkbox, CountBadge, Truncate, useToast } from '@/src/components/ui';
import { useDataStore, type Dataset, type Session } from '@/src/lib/data';
import {
  conversion,
  funnel,
  leadToPayout,
  periodRange,
  stuckSummary,
  targetProgress,
  weightedForecast,
  openPipeline,
  type Period,
} from '@/src/lib/data/metrics';
import { setTaskStatus } from '@/src/lib/data/mutations';
import { pipelineCards } from '@/src/lib/data/pipeline';
import { reminderSummary, taskGroups } from '@/src/lib/data/tasks';
import { formatDueShort, formatLongDate, formatMoney, formatMoneyCompact } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import { cn } from '@/src/lib/cn';
import { clientHref, dealHref } from '../shell/routes';
import { FunnelCard } from './FunnelCard';
import { DashCard, KpiCard, PeriodSelect } from './parts';

const TODAY_LIST = 7;
const MORNING_END = 12;
const AFTERNOON_END = 18;

function greeting(now: Date): string {
  const h = now.getHours();
  return h < MORNING_END ? 'Good morning' : h < AFTERNOON_END ? 'Good afternoon' : 'Good evening';
}

export function ManagerDashboard({
  scoped,
  session,
  now,
  period,
  onPeriod,
}: {
  scoped: Dataset;
  session: Session;
  now: Date;
  period: Period;
  onPeriod: (p: Period) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const update = useDataStore((s) => s.update);
  const me = scoped.users.find((u) => u.id === session.userId);
  const range = periodRange(period, now);

  const target = targetProgress(scoped, [session.userId], range);
  const forecast = weightedForecast(scoped);
  const pipeline = openPipeline(scoped);
  const reminders = reminderSummary(scoped, now);
  const stuck = stuckSummary(scoped, now);
  const stages = funnel(scoped, now);
  const conv = conversion(scoped, range);
  const payout = leadToPayout(scoped, range);
  const risks = useMemo(
    () => pipelineCards(scoped, now).filter((c) => c.stuck || c.docAlert),
    [scoped, now],
  );
  const today = taskGroups(scoped, now, 'all', session.userId)
    .filter((g) => g.key === 'overdue' || g.key === 'today')
    .flatMap((g) => g.rows)
    .slice(0, TODAY_LIST);

  const complete = (taskId: string, title: string) => {
    update((d) => setTaskStatus(d, taskId, 'done'));
    toast.show({
      message: `Task completed · “${title}”`,
      onUndo: () => update((d) => setTaskStatus(d, taskId, 'open')),
    });
  };

  return (
    <div className="flex max-w-content flex-col gap-3.5 px-6 pt-5 pb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">
            {greeting(now)}, {me?.name.split(' ')[0]}
          </h1>
          <p className="mt-0.75 text-text-muted">
            {formatLongDate(now)} · {reminders.overdue} overdue{' '}
            {reminders.overdue === 1 ? 'task' : 'tasks'} · {stuck.count}{' '}
            {stuck.count === 1 ? 'deal' : 'deals'} over SLA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelect value={period} onChange={onPeriod} />
          <Button icon={ListPlus} onClick={() => router.push('/tasks?new=task')}>
            Task
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => router.push('/clients?new=lead')}>
            New lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label={`Commission target · ${range.title}`}
          value={formatMoney(target.earned)}
          progress={target.ratio}
          sub={`${Math.round(target.ratio * 100)}% of ${formatMoney(target.target)} · ${formatMoney(target.inFinalStages)} in final stages`}
          decision="Are there enough late-stage deals to hit the target?"
          href="/pipeline?view=table"
        />
        <KpiCard
          label="Weighted commission forecast"
          value={formatMoney(forecast)}
          sub={`${pipeline.count} deals in progress · ${formatMoneyCompact(pipeline.amount)}`}
          decision="Which stages to spend time on to grow the forecast"
          href="/pipeline?view=table"
        />
        <KpiCard
          label="Overdue tasks"
          value={String(reminders.overdue)}
          alert={reminders.overdue > 0}
          sub={`+ ${reminders.today} due today`}
          decision="Where to start the day and what to reschedule"
          href="/tasks"
        />
        <KpiCard
          label="Deals over SLA"
          value={String(stuck.count)}
          alert={stuck.count > 0}
          sub={`${formatMoneyCompact(stuck.amount)} at risk`}
          decision="Which deals to step into today"
          href="/pipeline?filter=over-sla"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start gap-3">
        <DashCard
          title={
            <>
              Deals at risk <CountBadge tone="red">{risks.length}</CountBadge>
            </>
          }
          decision="which deals to step into today before they breach SLA"
          aside={
            <Link
              href="/pipeline?filter=over-sla"
              className="text-sm whitespace-nowrap text-accent hover:underline"
            >
              Full pipeline →
            </Link>
          }
        >
          {risks.map((c) => {
            const stage = getStage(c.deal.stage);
            return (
              <Link
                key={c.deal.id}
                href={dealHref(c.deal.id)}
                className="grid grid-cols-[minmax(0,1fr)_150px_110px_16px] items-center gap-3 border-b border-border-row-alt px-3.5 py-2.5 last:border-b-0 hover:bg-surface-hover focus-visible:shadow-focus-inset focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <Truncate className="font-medium">{c.client?.name ?? '—'}</Truncate>
                  <span
                    className={cn(
                      'mt-0.5 flex items-center gap-1.25 text-sm',
                      c.stuck ? 'text-danger' : 'text-warning',
                    )}
                  >
                    {c.stuck ? (
                      <Timer size={14} strokeWidth={1.75} />
                    ) : (
                      <FileWarning size={14} strokeWidth={1.75} />
                    )}
                    {c.stuck
                      ? `${c.daysInStage} d in stage · SLA ${c.slaDays} d`
                      : c.docAlert?.text}
                  </span>
                </span>
                <span>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                </span>
                <span className="text-right font-medium whitespace-nowrap tabular-nums">
                  {formatMoney(c.deal.requestedAmount)}
                </span>
                <ChevronRight size={16} className="text-text-disabled" />
              </Link>
            );
          })}
          {risks.length === 0 && (
            <div className="p-7 text-center text-text-muted">
              All deals within SLA. Documents are up to date.
            </div>
          )}
        </DashCard>

        <DashCard
          title="Today’s tasks"
          decision="where to start the day"
          aside={
            <Link href="/tasks" className="text-sm whitespace-nowrap text-accent hover:underline">
              All tasks →
            </Link>
          }
        >
          {today.map((r) => (
            <div
              key={r.task.id}
              className="flex items-center gap-2.5 border-b border-border-row-alt px-3.5 py-2 last:border-b-0"
            >
              <Checkbox
                checked={false}
                label={`Mark “${r.task.title}” as done`}
                onChange={() => complete(r.task.id, r.task.title)}
              />
              <div className="min-w-0 flex-1">
                <Truncate>{r.task.title}</Truncate>
                {r.client && (
                  <Link
                    href={clientHref(r.client.id)}
                    className="block truncate text-meta text-text-muted hover:text-accent"
                  >
                    {r.client.name}
                  </Link>
                )}
              </div>
              {r.task.source === 'auto' && (
                <span title="Created automatically" className="text-text-faint">
                  <Zap size={14} strokeWidth={1.75} />
                </span>
              )}
              <span
                className={cn(
                  'text-sm whitespace-nowrap tabular-nums',
                  r.overdue ? 'text-danger' : 'text-text-tertiary',
                )}
              >
                {r.task.dueAt ? formatDueShort(new Date(r.task.dueAt), now) : '—'}
              </span>
            </div>
          ))}
          {today.length === 0 && (
            <div className="p-7 text-center text-text-muted">Nothing due today.</div>
          )}
        </DashCard>
      </div>

      <FunnelCard
        title="My pipeline"
        decision="where deals are piling up and what to push this week"
        stages={stages}
        conversion={conv}
        payout={payout}
        variant="manager"
      />
    </div>
  );
}
