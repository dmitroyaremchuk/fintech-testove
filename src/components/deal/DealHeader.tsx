import Link from 'next/link';
import { Check, Timer } from 'lucide-react';
import { Avatar, Badge, Button, Card } from '@/src/components/ui';
import type { OpenStageKey } from '@/src/lib/constants';
import { stepperSteps, type DealView } from '@/src/lib/data/dealCard';
import { formatDateInContext, formatMoney } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import { cn } from '@/src/lib/cn';
import { clientHref } from '../shell/routes';

export interface DealHeaderProps {
  view: DealView;
  now: Date;
  onStep: (stage: OpenStageKey) => void;
  onLost: () => void;
}

/** Client, title, stage and the stage stepper. Clicking a step moves the deal through the rules. */
export function DealHeader({ view, now, onStep, onLost }: DealHeaderProps) {
  const { deal, client, owner, closed, stuck, daysInStage } = view;
  const stage = getStage(deal.stage);
  const steps = stepperSteps(deal, daysInStage);

  return (
    <Card>
      <div className="flex items-start gap-3.5 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {client && (
            <Link
              href={clientHref(client.id)}
              className="max-w-full self-start truncate text-control text-accent hover:text-accent-hover hover:underline focus-visible:shadow-focus focus-visible:outline-none"
            >
              {client.name}
            </Link>
          )}
          <div className="flex min-w-0 items-center gap-2.5">
            <h1
              className="truncate text-title font-semibold"
              title={`${deal.product} · ${deal.purpose}`}
            >
              {deal.product} · {deal.purpose}
            </h1>
            <Badge tone={stage.tone}>{stage.label}</Badge>
            {stuck && (
              <Badge tone="red" icon={<Timer size={12} strokeWidth={2} />}>
                {daysInStage} d in stage · SLA {stage.slaDays}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3.5 text-control text-text-tertiary">
            <span>
              Requested:{' '}
              <b className="font-semibold text-text tabular-nums">
                {formatMoney(deal.requestedAmount)}
              </b>
            </span>
            <span>Created {formatDateInContext(new Date(deal.createdAt), now)}</span>
            {owner && (
              <span className="flex items-center gap-1.5">
                <Avatar name={owner.name} size="xs" tone="accent" />
                {owner.name}
              </span>
            )}
          </div>
        </div>
        {!closed && (
          <Button variant="secondary-danger" onClick={onLost}>
            Mark as lost
          </Button>
        )}
      </div>

      <ol aria-label="Deal stages" className="grid grid-cols-7 px-4 pb-4">
        {steps.map((step, i) => {
          const current = step.state === 'current';
          const done = step.state === 'done';
          const last = i === steps.length - 1;
          return (
            <li key={step.stage.key} className="min-w-0">
              <button
                type="button"
                disabled={closed || current}
                aria-current={current ? 'step' : undefined}
                title={closed || current ? undefined : `Move to “${step.stage.label}”`}
                onClick={() => onStep(step.stage.key as OpenStageKey)}
                className={cn(
                  'group flex w-full flex-col gap-1.5 rounded-control-sm pb-1 text-left',
                  'focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-default',
                  !closed && !current && 'cursor-pointer',
                )}
              >
                <span className="flex items-center">
                  <span
                    className={cn(
                      'flex size-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-caption font-semibold transition-colors',
                      done && 'border-success bg-success text-white',
                      current && 'border-accent bg-accent text-white',
                      step.state === 'todo' && 'border-border-step bg-surface text-text-faint',
                      !closed && !current && 'group-hover:border-accent group-hover:shadow-focus',
                    )}
                  >
                    {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                  </span>
                  {!last && (
                    <span
                      className={cn(
                        'mx-1.5 h-0.5 flex-1 rounded-full',
                        done ? 'bg-success' : 'bg-border-strong',
                      )}
                    />
                  )}
                </span>
                <span
                  title={step.stage.label}
                  className={cn(
                    'truncate pr-2 text-sm',
                    current && 'font-semibold text-text',
                    done && 'text-text-secondary',
                    step.state === 'todo' && 'text-text-faint',
                    !closed && !current && 'group-hover:text-accent',
                  )}
                >
                  {step.stage.label}
                </span>
                <span
                  className={cn(
                    '-mt-1 text-caption tabular-nums',
                    current && stuck ? 'font-medium text-danger' : 'text-text-muted',
                  )}
                >
                  {current
                    ? `${daysInStage} of ${step.sla} d`
                    : step.state === 'todo'
                      ? `SLA ${step.sla} d`
                      : ' '}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
