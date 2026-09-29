import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CircleHelp } from 'lucide-react';
import { Card, Select } from '@/src/components/ui';
import { PERIODS, type Period } from '@/src/lib/data/metrics';
import { cn } from '@/src/lib/cn';

export interface KpiCardProps {
  label: string;
  value: string;
  /** Red when the number is bad (overdue, over SLA). */
  alert?: boolean;
  sub: ReactNode;
  /** 0–1: progress bar under the value. */
  progress?: number;
  /** "Which decision this helps make" — required on every card. */
  decision: string;
  /** Filtered list the metric opens. */
  href: string;
}

/** Clickable metric: value, context line, progress, and the decision it supports. */
export function KpiCard({ label, value, alert, sub, progress, decision, href }: KpiCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-w-0 flex-col gap-1.75 rounded-card border border-border bg-surface p-3.5 transition-colors',
        'hover:border-border-hover focus-visible:shadow-focus focus-visible:outline-none',
      )}
    >
      <span className="flex items-center justify-between text-sm text-text-tertiary">
        {label}
        <ArrowUpRight
          size={15}
          strokeWidth={1.75}
          className="text-text-disabled transition-colors group-hover:text-accent"
        />
      </span>
      <span
        className={cn(
          'text-kpi font-semibold whitespace-nowrap tabular-nums',
          alert ? 'text-danger' : 'text-text',
        )}
      >
        {value}
      </span>
      {progress !== undefined && (
        <span className="h-1 overflow-hidden rounded-bar bg-surface-muted" aria-hidden>
          <span
            className="block h-full rounded-bar bg-accent"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </span>
      )}
      <span className="text-sm text-text-tertiary tabular-nums">{sub}</span>
      <Decision>{decision}</Decision>
    </Link>
  );
}

export function Decision({ children, dashed = true }: { children: ReactNode; dashed?: boolean }) {
  return (
    <span
      className={cn(
        'mt-auto flex gap-1.5 text-meta text-text-muted',
        dashed && 'border-t border-dashed border-border pt-2',
      )}
    >
      <CircleHelp size={14} strokeWidth={1.75} className="mt-px shrink-0 text-text-disabled" />
      <span className="text-pretty">{children}</span>
    </span>
  );
}

/** Card with a title, the "Helps decide" caption and an optional right-side slot. */
export function DashCard({
  title,
  decision,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  decision: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-3.5 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">{title}</h2>
          <p className="mt-0.5 text-meta text-text-muted">Helps decide: {decision}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </Card>
  );
}

export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <Select
      size="md"
      aria-label="Period"
      value={value}
      onChange={(e) => onChange(e.target.value as Period)}
    >
      {PERIODS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </Select>
  );
}

/** "62%" or "—" when there is nothing to divide by. */
export function pct(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}
