import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, TriangleAlert, Zap } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Checkbox, TextInput } from '@/src/components/ui';
import { COMMISSION_RATE, LEAD_SOURCES } from '@/src/lib/constants';
import type { ClientLtv, NextStep } from '@/src/lib/data/clientCard';
import { formatDue, formatMoney, formatRegion } from '@/src/lib/format';
import type { EditableClientField, FieldResult } from '@/src/lib/rules/clients';
import { codeLabel } from '@/src/lib/rules/duplicates';
import { getStage } from '@/src/lib/rules/stages';
import { isOverdue } from '@/src/lib/rules/tasks';
import type { Client, Deal, Task } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';
import { dealHref } from '../shell/routes';

// ── Next step ────────────────────────────────────────────────

export function NextStepCard({
  step,
  now,
  schedule,
}: {
  step: NextStep;
  now: Date;
  /** "Schedule" trigger (opens the quick task form). */
  schedule: ReactNode;
}) {
  if (step.kind === 'none') {
    return (
      <section
        aria-label="Next step"
        className="flex flex-col gap-1.5 rounded-card border border-warning-border bg-warning-soft px-3.5 py-3"
      >
        <div className="text-caption font-semibold tracking-overline text-warning uppercase">
          Next step
        </div>
        <div className="flex gap-2 text-control text-warning-text">
          <TriangleAlert
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-warning-icon"
          />
          <span className="text-pretty">
            No next step planned — the client may go cold.
            {step.undatedTasks > 0 &&
              ` ${step.undatedTasks} open ${step.undatedTasks === 1 ? 'task has' : 'tasks have'} no date.`}
          </span>
        </div>
        <div className="mt-1">{schedule}</div>
      </section>
    );
  }
  const { task, deal, overdue } = step;
  return (
    <NextStepPlanned task={task} deal={deal} overdue={overdue} now={now} schedule={schedule} />
  );
}

function NextStepPlanned({
  task,
  deal,
  overdue,
  now,
  schedule,
}: {
  task: Task;
  deal: Deal | undefined;
  overdue: boolean;
  now: Date;
  schedule: ReactNode;
}) {
  const router = useRouter();
  return (
    <section
      aria-label="Next step"
      className="flex flex-col gap-1.5 rounded-card border border-accent-border-soft bg-accent-soft px-3.5 py-3"
    >
      <div className="text-caption font-semibold tracking-overline text-accent-strong uppercase">
        Next step
      </div>
      <div className="font-semibold">{task.title}</div>
      <div
        className={cn(
          'flex items-center gap-1.5 text-control',
          overdue ? 'text-danger' : 'text-accent-strong',
        )}
      >
        <CalendarClock size={14} strokeWidth={1.75} />
        {overdue ? 'Overdue · ' : ''}
        {task.dueAt && formatDue(new Date(task.dueAt), now)}
      </div>
      <div className="text-sm text-text-secondary">
        {deal ? `${deal.product} · ${deal.purpose}` : 'Not linked to a deal'} · task created{' '}
        {task.source === 'auto' ? 'automatically' : 'manually'}
      </div>
      <div className="mt-1 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => router.push(deal ? dealHref(deal.id) : '/tasks')}
        >
          {deal ? 'Open deal' : 'Go to tasks'}
        </Button>
        {schedule}
      </div>
    </section>
  );
}

// ── Details (requisites, editable in place) ─────────────────

interface DetailRow {
  field: EditableClientField;
  label: string;
  display: string;
  raw: string;
  mono?: boolean;
  inputMode?: 'numeric';
  suggestions?: readonly string[];
}

export function DetailsCard({
  client,
  onSave,
}: {
  client: Client;
  /** Validates and saves; returns the validation result so the field can show an error. */
  onSave: (field: EditableClientField, raw: string) => FieldResult;
}) {
  const rows: DetailRow[] = [
    {
      field: 'code',
      label: codeLabel(client.legalForm),
      display: client.code,
      raw: client.code,
      mono: true,
      inputMode: 'numeric',
    },
    { field: 'industry', label: 'Industry', display: client.industry, raw: client.industry },
    { field: 'region', label: 'Region', display: formatRegion(client.region), raw: client.region },
    {
      field: 'annualTurnover',
      label: 'Annual turnover',
      display: formatMoney(client.annualTurnover),
      raw: String(client.annualTurnover),
      inputMode: 'numeric',
    },
    {
      field: 'businessAgeYears',
      label: 'Business age',
      display: `${client.businessAgeYears} ${client.businessAgeYears === 1 ? 'year' : 'years'}`,
      raw: String(client.businessAgeYears),
      inputMode: 'numeric',
    },
    {
      field: 'leadSource',
      label: 'Lead source',
      display: client.leadSource,
      raw: client.leadSource,
      suggestions: LEAD_SOURCES,
    },
  ];
  return (
    <Card>
      <CardHeader
        compact
        title="Details"
        action={<span className="text-meta text-text-faint">click to edit</span>}
      />
      <dl className="py-1">
        {rows.map((row) => (
          <div
            key={row.field}
            className="grid min-h-8 grid-cols-[110px_minmax(0,1fr)] items-center gap-2.5 px-3.5"
          >
            <dt className="text-sm text-text-muted">{row.label}</dt>
            <dd className="min-w-0">
              <EditableValue
                key={`${client.id}:${row.raw}`}
                row={row}
                onSave={(raw) => onSave(row.field, raw)}
              />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Click to edit; Enter or leaving the field saves, Esc cancels. Invalid input keeps the old value. */
function EditableValue({ row, onSave }: { row: DetailRow; onSave: (raw: string) => FieldResult }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.raw);
  const [error, setError] = useState<string | null>(null);
  const listId = `suggest-${row.field}`;

  const cancel = () => {
    setEditing(false);
    setDraft(row.raw);
    setError(null);
  };
  const commit = (closeOnError: boolean) => {
    if (draft.trim() === row.raw) return cancel();
    const result = onSave(draft);
    if (result.ok) {
      setEditing(false);
      setError(null);
    } else if (closeOnError) {
      cancel();
    } else {
      setError(result.error);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        title={`${row.display} — click to edit`}
        onClick={() => setEditing(true)}
        className={cn(
          '-ml-1.75 block max-w-full cursor-text truncate rounded-control-sm border border-transparent px-1.5 py-0.75 text-left text-control',
          'hover:border-border-strong hover:bg-surface-subtle focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none',
          row.mono && 'font-mono',
        )}
      >
        {row.display}
      </button>
    );
  }
  return (
    <div className="-ml-1.75 flex flex-col gap-0.5 py-0.5">
      <TextInput
        size="sm"
        autoFocus
        aria-label={row.label}
        invalid={Boolean(error)}
        inputMode={row.inputMode}
        list={row.suggestions ? listId : undefined}
        className={cn(row.mono && 'font-mono')}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onBlur={() => commit(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(false);
          if (e.key === 'Escape') {
            e.stopPropagation();
            cancel();
          }
        }}
      />
      {row.suggestions && (
        <datalist id={listId}>
          {row.suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {error && <span className="text-meta text-danger">{error}</span>}
    </div>
  );
}

// ── Contacts, deals, tasks, LTV ──────────────────────────────

export function ContactsCard({ client }: { client: Client }) {
  return (
    <Card>
      <CardHeader compact title="Contacts" />
      {client.contacts.map((k) => (
        <div
          key={`${k.name}-${k.phone}`}
          className="flex flex-col gap-0.5 border-b border-border-row px-3.5 py-2.25 last:border-b-0"
        >
          <div className="flex justify-between gap-2">
            <span className="font-medium">{k.name}</span>
            <span className="text-meta text-text-muted">{k.position}</span>
          </div>
          <a
            href={`tel:${k.phone.replace(/\s/g, '')}`}
            className="w-fit text-sm text-text-secondary tabular-nums hover:text-accent"
          >
            {k.phone}
          </a>
          {k.email && (
            <a
              href={`mailto:${k.email}`}
              className="w-fit text-sm text-accent hover:text-accent-hover hover:underline"
            >
              {k.email}
            </a>
          )}
        </div>
      ))}
    </Card>
  );
}

export function OpenDealsCard({ deals, onNewDeal }: { deals: Deal[]; onNewDeal: () => void }) {
  return (
    <Card>
      <CardHeader compact title="Open deals" />
      {deals.map((d) => {
        const stage = getStage(d.stage);
        return (
          <Link
            key={d.id}
            href={dealHref(d.id)}
            className="flex flex-col gap-1 border-b border-border-row px-3.5 py-2.25 transition-colors last:border-b-0 hover:bg-surface-hover focus-visible:shadow-focus-inset focus-visible:outline-none"
          >
            <span className="flex justify-between gap-2">
              <span className="font-medium">{d.product}</span>
              <span className="font-medium tabular-nums">{formatMoney(d.requestedAmount)}</span>
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-text-muted">{d.purpose}</span>
              <Badge tone={stage.tone} size="sm">
                {stage.label}
              </Badge>
            </span>
          </Link>
        );
      })}
      {deals.length === 0 && (
        <div className="flex items-center justify-between px-3.5 py-3.5 text-control text-text-muted">
          No open deals
          <Button variant="link" onClick={onNewDeal}>
            Create deal
          </Button>
        </div>
      )}
    </Card>
  );
}

export function OpenTasksCard({
  tasks,
  now,
  onToggle,
  title = 'Open tasks',
  action,
}: {
  tasks: Task[];
  now: Date;
  onToggle: (task: Task) => void;
  title?: string;
  /** Header slot, e.g. "+ Task". */
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader compact title={title} action={action} />
      {tasks.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-2.25 border-b border-border-row px-3.5 py-2 last:border-b-0"
        >
          <span className="mt-0.5">
            <Checkbox
              size="sm"
              checked={false}
              label={`Mark “${t.title}” as done`}
              onChange={() => onToggle(t)}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-control text-pretty">{t.title}</div>
            <div
              className={cn('text-meta', isOverdue(t, now) ? 'text-danger' : 'text-text-tertiary')}
            >
              {t.dueAt ? formatDue(new Date(t.dueAt), now) : 'No date'}
            </div>
          </div>
          {t.source === 'auto' && (
            <span title="Created automatically" className="mt-0.5 text-text-faint">
              <Zap size={14} strokeWidth={1.75} />
            </span>
          )}
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="px-3.5 py-3.5 text-control text-text-muted">No tasks</div>
      )}
    </Card>
  );
}

export function LtvCard({ ltv }: { ltv: ClientLtv }) {
  return (
    <Card className="flex flex-col gap-2 px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Client LTV</span>
        <span className="text-stat font-semibold tabular-nums">{formatMoney(ltv.total)}</span>
      </div>
      {ltv.rows.map((r) => (
        <div key={r.deal.id} className="flex justify-between gap-2 text-sm text-text-secondary">
          <span className="min-w-0 truncate" title={`${r.deal.product} · ${r.deal.purpose}`}>
            {r.year} · {r.deal.purpose} · {formatMoney(r.amount)}
          </span>
          <span className="shrink-0 tabular-nums">+{formatMoney(r.fee)}</span>
        </div>
      ))}
      {ltv.rows.length === 0 && (
        <div className="text-sm text-text-muted">First deal with this client</div>
      )}
      <div className="flex justify-between border-t border-dashed border-border pt-2 text-sm text-text-muted">
        <span>Open deals potential ({Math.round(COMMISSION_RATE * 100)}%)</span>
        <span className="tabular-nums">{formatMoney(ltv.potential)}</span>
      </div>
    </Card>
  );
}
