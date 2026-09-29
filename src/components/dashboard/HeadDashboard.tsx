import Link from 'next/link';
import { Avatar, Badge } from '@/src/components/ui';
import { OVERLOAD_OPEN_DEALS, OVERLOAD_OVERDUE_TASKS } from '@/src/lib/constants';
import type { Dataset } from '@/src/lib/data';
import {
  bankPerformance,
  conversion,
  funnel,
  leadToPayout,
  lossReasons,
  openPipeline,
  periodRange,
  stuckSummary,
  targetProgress,
  teamWorkload,
  weightedForecast,
  type Period,
} from '@/src/lib/data/metrics';
import { formatMoney, formatMoneyCompact } from '@/src/lib/format';
import { cn } from '@/src/lib/cn';
import { FunnelCard } from './FunnelCard';
import { DashCard, KpiCard, PeriodSelect, pct } from './parts';

export function HeadDashboard({
  data,
  now,
  period,
  onPeriod,
}: {
  data: Dataset;
  now: Date;
  period: Period;
  onPeriod: (p: Period) => void;
}) {
  const range = periodRange(period, now);
  const managers = data.users.filter((u) => u.role === 'manager');
  const pipeline = openPipeline(data);
  const forecast = weightedForecast(data);
  const target = targetProgress(
    data,
    managers.map((m) => m.id),
    range,
  );
  const stuck = stuckSummary(data, now);
  const stages = funnel(data, now);
  const conv = conversion(data, range);
  const payout = leadToPayout(data, range);
  const banks = bankPerformance(data, range);
  const bestApproval = Math.max(0, ...banks.banks.map((b) => b.approvalRate ?? 0));
  const workload = teamWorkload(data, now, range);
  const losses = lossReasons(data, range);
  const maxLoss = Math.max(1, ...losses.reasons.map((r) => r.count));

  return (
    <div className="flex max-w-content flex-col gap-3.5 px-6 pt-5 pb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">Team · {range.title}</h1>
          <p className="mt-0.75 text-text-muted tabular-nums">
            {managers.length} managers · {pipeline.count} deals ·{' '}
            {formatMoneyCompact(pipeline.amount)}
          </p>
        </div>
        <PeriodSelect value={period} onChange={onPeriod} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Team pipeline"
          value={formatMoneyCompact(pipeline.amount)}
          sub={`${pipeline.count} open deals`}
          decision="Are there enough deals to hit next month’s target?"
          href="/pipeline"
        />
        <KpiCard
          label="Weighted commission"
          value={formatMoney(forecast)}
          sub="weighted by stage probability"
          decision="Which revenue forecast to budget for"
          href="/pipeline?view=table"
        />
        <KpiCard
          label={`Team target · ${range.title}`}
          value={formatMoney(target.earned)}
          progress={target.ratio}
          sub={`${Math.round(target.ratio * 100)}% of ${formatMoney(target.target)}`}
          decision="Should focus be redistributed before month end?"
          href="/team"
        />
        <KpiCard
          label="Deals over SLA"
          value={String(stuck.count)}
          alert={stuck.count > 0}
          sub={`${formatMoneyCompact(stuck.amount)} · across ${stuck.owners} ${stuck.owners === 1 ? 'manager' : 'managers'}`}
          decision="Where escalation or manager help is needed"
          href="/pipeline?filter=over-sla"
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <FunnelCard
          title="Team pipeline"
          decision="where the process slows down — red stages exceed SLA on average"
          stages={stages}
          conversion={conv}
          payout={payout}
          variant="team"
        />

        <DashCard
          title={`Partner banks · ${banks.applications} applications`}
          decision="where to submit next and whose terms to renegotiate"
        >
          <div role="table" aria-label="Partner banks">
            <div
              role="row"
              className="grid grid-cols-[minmax(0,1.2fr)_52px_minmax(0,1.3fr)_64px_56px_60px] gap-2.5 border-b border-border-row-alt px-3.5 py-2 text-caption text-text-muted"
            >
              <span role="columnheader">Bank</span>
              <span role="columnheader" className="text-right">
                Apps
              </span>
              <span role="columnheader">Approval</span>
              <span role="columnheader" className="text-right">
                Decision
              </span>
              <span role="columnheader" className="text-right">
                Rate
              </span>
              <span role="columnheader" className="text-right">
                Paid out
              </span>
            </div>
            {banks.banks.map((b) => {
              const best = b.approvalRate !== null && b.approvalRate === bestApproval;
              return (
                <div
                  key={b.bank}
                  role="row"
                  className="grid grid-cols-[minmax(0,1.2fr)_52px_minmax(0,1.3fr)_64px_56px_60px] items-center gap-2.5 border-b border-border-row-faint px-3.5 py-2.25 tabular-nums last:border-b-0"
                >
                  <span role="cell" className="truncate font-medium">
                    {b.bank}
                  </span>
                  <span role="cell" className="text-right text-text-tertiary">
                    {b.applications}
                  </span>
                  <span role="cell" className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-track bg-surface-muted">
                      <span
                        className={cn('block h-full', best ? 'bg-success' : 'bg-accent-bar-muted')}
                        style={{ width: `${(b.approvalRate ?? 0) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 text-right">{pct(b.approvalRate)}</span>
                  </span>
                  <span role="cell" className="text-right text-text-tertiary">
                    {b.avgDecisionDays === null ? '—' : `${b.avgDecisionDays.toFixed(1)} d`}
                  </span>
                  <span role="cell" className="text-right">
                    {b.avgRate === null ? '—' : `${b.avgRate.toFixed(1)}%`}
                  </span>
                  <span role="cell" className="text-right text-text-tertiary">
                    {b.disbursed}
                  </span>
                </div>
              );
            })}
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-3">
        <DashCard
          title="Manager workload"
          decision="who to reassign deals to. Click a manager to open their pipeline"
        >
          <div role="table" aria-label="Manager workload">
            <div
              role="row"
              className="grid grid-cols-[minmax(0,1.4fr)_64px_92px_88px_minmax(0,1fr)] gap-2.5 border-b border-border-row-alt px-3.5 py-2 text-caption text-text-muted"
            >
              <span role="columnheader">Manager</span>
              <span role="columnheader" className="text-right">
                Deals
              </span>
              <span role="columnheader" className="text-right">
                Overdue tasks
              </span>
              <span role="columnheader" className="text-right">
                Pipeline
              </span>
              <span role="columnheader">Target · {range.title}</span>
            </div>
            {workload.map((m) => (
              <Link
                key={m.user.id}
                role="row"
                href={`/pipeline?owner=${m.user.id}`}
                className={cn(
                  'grid grid-cols-[minmax(0,1.4fr)_64px_92px_88px_minmax(0,1fr)] items-center gap-2.5 border-b border-border-row-faint px-3.5 py-2.25 tabular-nums last:border-b-0 hover:bg-surface-hover focus-visible:shadow-focus-inset focus-visible:outline-none',
                  m.overloaded && 'bg-danger-row',
                )}
              >
                <span role="cell" className="flex min-w-0 items-center gap-2">
                  <Avatar name={m.user.name} size="md" />
                  <span className="truncate font-medium">{m.user.name}</span>
                  {m.overloaded && (
                    <Badge tone="red" size="sm">
                      Overloaded
                    </Badge>
                  )}
                </span>
                <span
                  role="cell"
                  className={cn(
                    'text-right font-medium',
                    m.openDeals >= OVERLOAD_OPEN_DEALS && 'text-danger',
                  )}
                >
                  {m.openDeals}
                </span>
                <span
                  role="cell"
                  className={cn(
                    'text-right font-medium',
                    m.overdueTasks >= OVERLOAD_OVERDUE_TASKS && 'text-danger',
                  )}
                >
                  {m.overdueTasks}
                </span>
                <span role="cell" className="text-right text-text-tertiary">
                  {formatMoneyCompact(m.pipeline)}
                </span>
                <span role="cell" className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-track bg-surface-muted">
                    <span
                      className="block h-full bg-accent"
                      style={{ width: `${Math.min(100, m.progress.ratio * 100)}%` }}
                    />
                  </span>
                  <span className="w-9 text-right text-sm">
                    {Math.round(m.progress.ratio * 100)}%
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </DashCard>

        <DashCard
          title="Loss reasons"
          decision={`what to change in qualification and document collection · ${losses.total} ${losses.total === 1 ? 'deal' : 'deals'} lost (${range.title})`}
        >
          <div className="flex flex-col gap-2 px-3.5 pt-2.5 pb-3.5">
            {losses.reasons.map((r) => (
              <div key={r.reason} className="flex flex-col gap-1">
                <div className="flex justify-between text-control">
                  <span>{r.reason}</span>
                  <span className="text-text-tertiary tabular-nums">
                    {r.count} · {pct(losses.total ? r.share : null)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-track bg-surface-track">
                  <div
                    className="h-full rounded-track bg-danger-bar"
                    style={{ width: `${(r.count / maxLoss) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {losses.total === 0 && (
              <div className="py-2 text-center text-text-muted">No deals lost in this period.</div>
            )}
          </div>
        </DashCard>
      </div>
    </div>
  );
}
