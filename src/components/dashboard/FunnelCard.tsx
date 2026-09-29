import Link from 'next/link';
import { Timer } from 'lucide-react';
import type { Conversion, FunnelStage, LeadToPayout } from '@/src/lib/data/metrics';
import { formatMoneyCompact } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import { cn } from '@/src/lib/cn';
import { DashCard, pct } from './parts';

export interface FunnelCardProps {
  title: string;
  decision: string;
  stages: FunnelStage[];
  conversion: Conversion;
  payout: LeadToPayout;
  /** Manager: "N over SLA"; head: average days in stage vs SLA. */
  variant: 'manager' | 'team';
}

/** Open deals by stage; each row opens that stage in the pipeline table. */
export function FunnelCard({
  title,
  decision,
  stages,
  conversion,
  payout,
  variant,
}: FunnelCardProps) {
  const max = Math.max(1, ...stages.map((s) => (variant === 'team' ? s.count : s.amount)));
  const toNext = new Map(conversion.stages.map((s) => [s.stage, s.toNext]));
  return (
    <DashCard
      title={title}
      decision={decision}
      aside={
        <div className="text-right text-meta text-text-muted tabular-nums">
          <div title="Won ÷ (won + lost) among deals closed in the period">
            Win rate <b className="font-semibold text-text">{pct(conversion.winRate)}</b> of{' '}
            {conversion.closedWon + conversion.closedLost} closed
          </div>
          <div>
            Lead → payout{' '}
            <b className="font-semibold text-text">
              {payout.avgDays === null ? '—' : `${Math.round(payout.avgDays)} d`}
            </b>{' '}
            on average
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-0.5 px-2 pt-2 pb-2.5">
        <div className="grid grid-cols-[150px_minmax(0,1fr)_32px_76px_104px_64px] gap-3 px-1.5 pb-1 text-caption text-text-muted">
          <span>Stage</span>
          <span />
          <span className="text-right">Deals</span>
          <span className="text-right">Amount</span>
          <span className="text-right">{variant === 'team' ? 'Avg in stage' : 'Over SLA'}</span>
          <span className="text-right" title="Share of deals that reached this stage and moved on">
            → next
          </span>
        </div>
        {stages.map((s) => {
          const stage = getStage(s.stage);
          const width = ((variant === 'team' ? s.count : s.amount) / max) * 100;
          return (
            <Link
              key={s.stage}
              href={`/pipeline?view=table&stage=${s.stage}`}
              className="grid h-7 grid-cols-[150px_minmax(0,1fr)_32px_76px_104px_64px] items-center gap-3 rounded-control-sm px-1.5 hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none"
            >
              <span className="flex min-w-0 items-center gap-1.75 text-text-secondary">
                <span
                  className="size-1.75 shrink-0 rounded-bar"
                  style={{ background: stage.color }}
                />
                <span className="truncate">{stage.label}</span>
              </span>
              <span className="h-2.5 overflow-hidden rounded-track bg-surface-track">
                <span
                  className="block h-full rounded-track opacity-85"
                  style={{ width: `${s.count ? Math.max(width, 3) : 0}%`, background: stage.color }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{s.count}</span>
              <span className="text-right text-sm text-text-tertiary tabular-nums">
                {s.amount ? formatMoneyCompact(s.amount) : '—'}
              </span>
              <span
                className={cn(
                  'text-right text-meta whitespace-nowrap tabular-nums',
                  variant === 'team'
                    ? s.slow
                      ? 'font-semibold text-danger'
                      : 'text-text-tertiary'
                    : 'text-danger',
                )}
              >
                {variant === 'team' ? (
                  s.avgDays === null ? (
                    '—'
                  ) : (
                    `${s.avgDays.toFixed(1)} d · SLA ${s.slaDays}`
                  )
                ) : s.overSla ? (
                  <span className="inline-flex items-center gap-1">
                    <Timer size={12} strokeWidth={2} />
                    {s.overSla} over
                  </span>
                ) : (
                  ''
                )}
              </span>
              <span className="text-right text-meta text-text-tertiary tabular-nums">
                {pct(toNext.get(s.stage) ?? null)}
              </span>
            </Link>
          );
        })}
      </div>
    </DashCard>
  );
}
