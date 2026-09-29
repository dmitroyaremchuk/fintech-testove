import { useState } from 'react';
import {
  Circle,
  CircleAlert,
  CircleCheck,
  Clock,
  FileText,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, Slider } from '@/src/components/ui';
import {
  COMMISSION_PCT_RANGE,
  DOCUMENT_STATUSES,
  INTERACTION_TYPES,
  type DocumentDisplayStatus,
  type Tone,
} from '@/src/lib/constants';
import type { DealDocument, DealView } from '@/src/lib/data/dealCard';
import type { DocumentAction } from '@/src/lib/data/dealMutations';
import { calendarDaysBetween } from '@/src/lib/dates';
import { formatDateInContext, formatDayHeader, formatMoney, formatTime } from '@/src/lib/format';
import type { Offer } from '@/src/lib/rules/offers';
import { cn } from '@/src/lib/cn';
import { INTERACTION_ICON } from '../client/interactionIcons';

// ── Offers comparison ───────────────────────────────────────

export function OffersCard({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;
  return (
    <Card>
      <div className="border-b border-border-subtle px-3.5 py-3">
        <span className="font-semibold">Approved offers comparison</span>
        <span className="ml-2 text-text-muted">{offers.length}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5 p-3.5">
        {offers.map(({ application: a, monthly, totalInterest, best, chosen }) => (
          <div
            key={a.id}
            className={cn(
              'flex flex-col gap-2 rounded-card border p-3',
              best ? 'border-success bg-success-softer' : 'border-border bg-surface',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="flex-1 font-semibold">{a.bank}</span>
              {best && (
                <Badge tone="green" size="sm">
                  Lowest rate
                </Badge>
              )}
              {chosen && (
                <Badge tone="teal" size="sm">
                  {a.status === 'disbursed' ? 'Paid out' : 'Chosen by client'}
                </Badge>
              )}
            </div>
            <div className="text-display font-semibold tabular-nums">
              {a.rate}%
              <span className="ml-1.5 text-control font-normal text-text-tertiary">
                p.a. · {a.termMonths} mo.
              </span>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.75 text-sm tabular-nums">
              <dt className="text-text-muted">Amount</dt>
              <dd>{formatMoney(a.amount)}</dd>
              <dt className="text-text-muted">Payment / mo.</dt>
              <dd>{formatMoney(monthly)}</dd>
              <dt className="text-text-muted">Total interest</dt>
              <dd>{formatMoney(totalInterest)}</dd>
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Documents ────────────────────────────────────────────────

// Static class names so Tailwind can see them.
const TONE_TEXT: Record<Tone, string> = {
  gray: 'text-tone-gray-fg',
  blue: 'text-tone-blue-fg',
  amber: 'text-tone-amber-fg',
  green: 'text-tone-green-fg',
  red: 'text-tone-red-fg',
  violet: 'text-tone-violet-fg',
  teal: 'text-tone-teal-fg',
};

const DOC_ICON: Record<DocumentDisplayStatus, LucideIcon> = {
  received: CircleCheck,
  requested: Clock,
  not_requested: Circle,
  expired: CircleAlert,
  expiring: TriangleAlert,
};

function expiryText({ doc, status }: DealDocument, now: Date): string {
  if (!doc.validUntil) return '';
  const until = new Date(doc.validUntil);
  const date = formatDateInContext(until, now);
  if (status === 'expired') return `expired ${date}`;
  if (status === 'expiring') {
    const days = calendarDaysBetween(now, until);
    return `expires ${date} · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`;
  }
  return `valid to ${date}`;
}

export function DocumentsCard({
  view,
  now,
  onAction,
}: {
  view: DealView;
  now: Date;
  onAction: (docId: string, action: DocumentAction) => void;
}) {
  const { documents, docsReceived, closed } = view;
  const pct = documents.length ? Math.round((docsReceived / documents.length) * 100) : 0;
  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-border-subtle px-3.5 py-3">
        <h2 className="font-semibold">Documents</h2>
        {documents.length > 0 && (
          <>
            <span
              role="progressbar"
              aria-label="Documents received"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.25 max-w-55 flex-1 overflow-hidden rounded-track bg-surface-muted"
            >
              <span className="block h-full bg-success" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-sm text-text-tertiary tabular-nums">
              {docsReceived} of {documents.length} received
            </span>
          </>
        )}
      </div>
      {documents.map((d) => {
        const meta = DOCUMENT_STATUSES[d.status];
        const Icon = DOC_ICON[d.status];
        return (
          <div
            key={d.doc.id}
            className="flex min-h-row-doc items-center gap-2.5 border-b border-border-row px-3.5 last:border-b-0"
          >
            <Icon size={17} strokeWidth={1.75} className={cn('shrink-0', TONE_TEXT[meta.tone])} />
            <span className="min-w-0 flex-1 truncate" title={d.doc.type}>
              {d.doc.type}
            </span>
            <span
              className={cn(
                'text-meta whitespace-nowrap',
                d.status === 'expired' ? 'text-danger' : 'text-text-muted',
              )}
            >
              {expiryText(d, now)}
            </span>
            <Badge tone={meta.tone} size="sm">
              {meta.label}
            </Badge>
            {!closed && d.status === 'not_requested' && (
              <Button size="xs" onClick={() => onAction(d.doc.id, 'request')}>
                Request
              </Button>
            )}
            {!closed && d.status === 'requested' && (
              <Button size="xs" onClick={() => onAction(d.doc.id, 'receive')}>
                Mark received
              </Button>
            )}
            {!closed && (d.status === 'expiring' || d.status === 'expired') && (
              <Button size="xs" variant="warning" onClick={() => onAction(d.doc.id, 'renew')}>
                Renew
              </Button>
            )}
          </div>
        );
      })}
      {documents.length === 0 && (
        <div className="flex items-center gap-2 px-3.5 py-4 text-control text-text-muted">
          <FileText size={16} strokeWidth={1.75} className="shrink-0" />
          The checklist is generated automatically at “Document collection” — based on product and
          legal form.
        </div>
      )}
    </Card>
  );
}

// ── Commission ───────────────────────────────────────────────

export function CommissionCard({
  view,
  onRate,
}: {
  view: DealView;
  onRate: (rate: number) => void;
}) {
  const c = view.commission;
  const [pct, setPct] = useState(c.rate * 100);
  // Follow the saved rate (e.g. after Undo) without remounting, so keyboard focus stays on the slider.
  const [savedRate, setSavedRate] = useState(c.rate);
  if (savedRate !== c.rate) {
    setSavedRate(c.rate);
    setPct(c.rate * 100);
  }
  const locked = view.deal.stage === 'lost';
  const note =
    c.baseSource.kind === 'disbursed'
      ? `amount disbursed by ${c.baseSource.bank}`
      : c.baseSource.kind === 'accepted'
        ? `offer accepted from ${c.baseSource.bank}`
        : 'requested amount — until a bank approves';
  return (
    <Card className="flex flex-col gap-2.5 px-3.5 py-3">
      <h2 className="font-semibold">Commission</h2>
      <div className="flex justify-between text-control">
        <span className="text-text-muted">Base</span>
        <span className="tabular-nums">{formatMoney(c.base)}</span>
      </div>
      <div className="-mt-1.5 text-meta text-text-faint">{note}</div>
      <div className="flex items-center gap-2.5">
        <Slider
          aria-label="Commission rate"
          min={COMMISSION_PCT_RANGE.min}
          max={COMMISSION_PCT_RANGE.max}
          step={COMMISSION_PCT_RANGE.step}
          value={pct}
          disabled={locked}
          onChange={(e) => setPct(Number(e.target.value))}
          onPointerUp={() => onRate(pct / 100)}
          onKeyUp={() => onRate(pct / 100)}
        />
        <span className="w-11 text-right font-semibold tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-surface-muted pt-2.5">
        <span className="text-text-tertiary">Expected on disbursement</span>
        <span className="text-amount font-semibold tabular-nums">
          {formatMoney(c.base * (pct / 100))}
        </span>
      </div>
      <div className="flex justify-between text-sm text-text-tertiary">
        <span>Weighted · probability {Math.round(c.probability * 100)}%</span>
        <span className="tabular-nums">{formatMoney(c.base * (pct / 100) * c.probability)}</span>
      </div>
      <div
        className={cn(
          'flex justify-between rounded-control px-2 py-1.5 text-sm',
          c.actual !== null
            ? 'bg-success-soft text-success-fg'
            : 'bg-surface-subtle text-text-muted',
        )}
      >
        <span>Actual, after payout</span>
        <span className="font-medium tabular-nums">
          {c.actual !== null ? formatMoney(c.base * (pct / 100)) : 'after disbursement'}
        </span>
      </div>
    </Card>
  );
}

// ── Timeline ─────────────────────────────────────────────────

const TIMELINE_PREVIEW = 8;

export function DealTimelineCard({ view, now }: { view: DealView; now: Date }) {
  const [all, setAll] = useState(false);
  const items = all ? view.timeline : view.timeline.slice(0, TIMELINE_PREVIEW);
  return (
    <Card>
      <CardHeader compact title="Deal timeline" />
      <ol className="flex flex-col gap-2 px-3.5 pt-2 pb-3">
        {items.map((e) => {
          const Icon = INTERACTION_ICON[e.type];
          const at = new Date(e.date);
          return (
            <li key={e.id} className="flex gap-2 text-sm">
              <Icon
                size={14}
                strokeWidth={1.75}
                aria-label={INTERACTION_TYPES[e.type].label}
                className={cn('mt-0.5 shrink-0', e.auto ? 'text-text-faint' : 'text-accent')}
              />
              <div className="min-w-0 flex-1">
                <div className="text-pretty text-text">{e.summary}</div>
                <div className="text-caption text-text-faint">
                  {formatDayHeader(at, now)} · {formatTime(at)}
                </div>
              </div>
            </li>
          );
        })}
        {view.timeline.length === 0 && (
          <li className="text-control text-text-muted">No history yet</li>
        )}
      </ol>
      {view.timeline.length > TIMELINE_PREVIEW && (
        <div className="border-t border-border-row px-3.5 py-2">
          <Button variant="link" onClick={() => setAll((v) => !v)}>
            {all ? 'Show less' : `Show all ${view.timeline.length}`}
          </Button>
        </div>
      )}
    </Card>
  );
}
