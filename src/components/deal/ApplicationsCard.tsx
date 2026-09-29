import { useState } from 'react';
import { CornerDownRight, Landmark, MoreHorizontal, Plus, Route } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Menu,
  MenuItem,
  MenuLabel,
  Modal,
  Popover,
  TextInput,
  Textarea,
  TokenChip,
  Truncate,
} from '@/src/components/ui';
import {
  APPLICATION_STATUSES,
  REJECTION_REASON_PRESETS,
  type ApplicationStatus,
  type Bank,
} from '@/src/lib/constants';
import type { BankStat } from '@/src/lib/data/banks';
import type { DealView } from '@/src/lib/data/dealCard';
import type { ApplicationChange } from '@/src/lib/data/dealMutations';
import { formatDate, formatMoney } from '@/src/lib/format';
import { APPLICATION_TRANSITIONS, validateApproval } from '@/src/lib/rules/applications';
import type { BankApplication } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';

// Rate+term and the two dates share columns so the table fits the 1280px layout.
const COLUMNS = 'grid-cols-[minmax(110px,1.3fr)_124px_104px_104px_108px_24px]';

/** "approves 57% · decides in 4.1 d" */
export function statLine(s: BankStat | undefined): string {
  if (!s || s.approvalRate === null) return 'no decisions yet';
  const days = s.avgDecisionDays === null ? '' : ` · decides in ${s.avgDecisionDays.toFixed(1)} d`;
  return `approves ${Math.round(s.approvalRate * 100)}%${days}`;
}

export interface ApplicationsCardProps {
  view: DealView;
  onAdd: (bank: Bank, amount: number) => void;
  onChange: (app: BankApplication, change: ApplicationChange) => void;
}

export function ApplicationsCard({ view, onAdd, onChange }: ApplicationsCardProps) {
  const [approving, setApproving] = useState<BankApplication | null>(null);
  const [rejecting, setRejecting] = useState<BankApplication | null>(null);
  const { applications, closed } = view;

  const onPick = (app: BankApplication, to: ApplicationStatus) => {
    if (to === 'approved' && app.status !== 'accepted') setApproving(app);
    else if (to === 'rejected') setRejecting(app);
    else onChange(app, { to });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-3">
        <h2 className="font-semibold">Bank applications</h2>
        {!closed && <AddApplication view={view} onAdd={onAdd} />}
      </div>

      {applications.length > 0 ? (
        <div role="table" aria-label="Bank applications">
          <div
            role="row"
            className={cn(
              'grid h-8 items-center gap-2 border-b border-border-row-alt bg-surface-subtle px-3.5 text-meta text-text-muted',
              COLUMNS,
            )}
          >
            <span role="columnheader">Bank</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className="text-right">
              Amount
            </span>
            <span role="columnheader" className="text-right">
              Rate · term
            </span>
            <span role="columnheader" className="text-right">
              Sent → decided
            </span>
            <span role="columnheader" className="sr-only">
              Actions
            </span>
          </div>
          {applications.map((app) => {
            const status = APPLICATION_STATUSES[app.status];
            const next = APPLICATION_TRANSITIONS[app.status];
            return (
              <div
                key={app.id}
                role="row"
                className={cn(
                  'flex flex-col gap-1 border-b border-border-row px-3.5 py-2.25 last:border-b-0',
                  app.status === 'rejected' && 'opacity-80',
                )}
              >
                <div className={cn('grid items-center gap-2 tabular-nums', COLUMNS)}>
                  <span role="cell" className="flex min-w-0 items-center gap-2">
                    <Avatar name={app.bank} shape="square" size="sm" />
                    <Truncate className="font-medium">{app.bank}</Truncate>
                  </span>
                  <span role="cell">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </span>
                  <span role="cell" className="text-right whitespace-nowrap">
                    {formatMoney(app.amount)}
                  </span>
                  <span role="cell" className="text-right whitespace-nowrap">
                    {app.rate !== null ? (
                      <>
                        {app.rate}%
                        <span className="text-text-tertiary"> · {app.termMonths} mo.</span>
                      </>
                    ) : (
                      <span className="text-text-disabled">—</span>
                    )}
                  </span>
                  <span role="cell" className="text-right whitespace-nowrap text-text-tertiary">
                    {app.submittedAt ? formatDate(new Date(app.submittedAt)) : '—'}
                    {app.decidedAt && ` → ${formatDate(new Date(app.decidedAt))}`}
                  </span>
                  <span role="cell" className="flex justify-end">
                    {!closed && next.length > 0 && (
                      <StatusMenu app={app} next={next} onPick={(to) => onPick(app, to)} />
                    )}
                  </span>
                </div>
                {app.rejectionReason && (
                  <div className="ml-7.5 flex gap-1.25 text-sm text-danger">
                    <CornerDownRight size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    {app.rejectionReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 px-3.5 py-6 text-center">
          <Landmark size={22} strokeWidth={1.75} className="text-text-disabled" />
          <div className="font-medium">No applications yet</div>
          {view.recommended.length > 0 && (
            <div className="text-sm text-text-muted">
              Approve most often:{' '}
              {view.recommended
                .map((b) => `${b.bank} (${Math.round((b.approvalRate ?? 0) * 100)}%)`)
                .join(', ')}
            </div>
          )}
        </div>
      )}

      {approving && (
        <ApprovalModal
          app={approving}
          onCancel={() => setApproving(null)}
          onSave={(terms) => {
            setApproving(null);
            onChange(approving, { to: 'approved', terms });
          }}
        />
      )}
      {rejecting && (
        <RejectionModal
          app={rejecting}
          onCancel={() => setRejecting(null)}
          onSave={(reason) => {
            setRejecting(null);
            onChange(rejecting, { to: 'rejected', reason });
          }}
        />
      )}
    </Card>
  );
}

function statusActionLabel(from: ApplicationStatus, to: ApplicationStatus): string {
  if (to === 'approved' && from === 'accepted') return 'Client withdrew acceptance';
  return {
    prep: 'Back to preparation',
    submitted: 'Mark as sent to bank',
    review: 'Bank is reviewing',
    extra: 'Bank requested documents',
    approved: 'Record approval…',
    rejected: 'Record rejection…',
    accepted: 'Client accepted this offer',
    disbursed: 'Funds disbursed',
  }[to];
}

function StatusMenu({
  app,
  next,
  onPick,
}: {
  app: BankApplication;
  next: readonly ApplicationStatus[];
  onPick: (to: ApplicationStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      portal
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      className="w-60"
      anchor={
        <button
          type="button"
          aria-label={`Update ${app.bank} application`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex size-6 items-center justify-center rounded-control-sm text-text-muted hover:bg-surface-hover-menu hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
        >
          <MoreHorizontal size={16} strokeWidth={1.75} />
        </button>
      }
    >
      <Menu label={`Update ${app.bank} application`}>
        <MenuLabel>{app.bank}</MenuLabel>
        {next.map((to) => (
          <MenuItem
            key={to}
            onSelect={() => {
              setOpen(false);
              onPick(to);
            }}
          >
            {statusActionLabel(app.status, to)}
          </MenuItem>
        ))}
      </Menu>
    </Popover>
  );
}

function AddApplication({
  view,
  onAdd,
}: {
  view: DealView;
  onAdd: (bank: Bank, amount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(view.deal.requestedAmount));
  const value = Number(amount.replace(/\D/g, '')) || 0;
  return (
    <Popover
      portal
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      className="w-80 p-2"
      anchor={
        <Button size="sm" icon={Plus} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          Application
        </Button>
      }
    >
      {view.untried.length === 0 ? (
        <div className="px-2 py-2 text-control text-text-muted">
          All partner banks already have an application.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="px-1">
            <Field label="Amount, ₴">
              {({ id }) => (
                <TextInput
                  id={id}
                  size="sm"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Menu label="Choose a bank">
            <MenuLabel>Banks not tried yet · best approval first</MenuLabel>
            {view.untried.map((s) => (
              <MenuItem
                key={s.bank}
                onSelect={() => {
                  if (value <= 0) return;
                  setOpen(false);
                  onAdd(s.bank, value);
                }}
                hint={statLine(s)}
              >
                {s.bank}
              </MenuItem>
            ))}
          </Menu>
        </div>
      )}
    </Popover>
  );
}

/** After a rejection: which partner banks we haven't tried, with their track record. */
export function BackupBanksCard({
  view,
  onAdd,
}: {
  view: DealView;
  onAdd: (bank: Bank, amount: number) => void;
}) {
  if (view.closed || view.rejectedCount === 0 || view.untried.length === 0) return null;
  const n = view.rejectedCount;
  const amount = view.awaitingDisbursement?.amount ?? view.deal.requestedAmount;
  return (
    <Card className="flex gap-3 px-3.5 py-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-input bg-warning-bg text-warning">
        <Route size={17} strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <div className="font-semibold">
            {view.awaitingDisbursement
              ? 'Backup bank in case disbursement falls through'
              : `${n} ${n === 1 ? 'bank' : 'banks'} declined — banks not tried yet`}
          </div>
          <div className="text-control text-text-secondary">
            A task to analyze the rejection was created. Try a bank that has not seen this deal:
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {view.untried.map((s) => (
            <li key={s.bank} className="flex items-center gap-2.5">
              <span className="w-32 shrink-0 font-medium">{s.bank}</span>
              <span className="flex-1 text-sm text-text-tertiary">{statLine(s)}</span>
              <Button size="md" onClick={() => onAdd(s.bank, amount)}>
                Create application
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function ApprovalModal({
  app,
  onCancel,
  onSave,
}: {
  app: BankApplication;
  onCancel: () => void;
  onSave: (terms: { amount: number; rate: number; termMonths: number }) => void;
}) {
  const [amount, setAmount] = useState(String(app.amount));
  const [rate, setRate] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const terms = {
      amount: Number(amount.replace(/\D/g, '')),
      rate: Number(rate.replace(',', '.')),
      termMonths: Number(term),
    };
    const problem = validateApproval(terms);
    if (problem) setError(problem);
    else onSave(terms);
  };
  return (
    <Modal
      open
      onClose={onCancel}
      title="Record approval"
      subtitle={`${app.bank} · the offer appears in the comparison`}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Save approval
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-3 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Approved amount, ₴">
          {({ id }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <Field label="Rate, % a year">
          {({ id }) => (
            <TextInput
              id={id}
              inputMode="decimal"
              placeholder="18.5"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          )}
        </Field>
        <Field label="Term, months">
          {({ id }) => (
            <TextInput
              id={id}
              inputMode="numeric"
              placeholder="24"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          )}
        </Field>
        {error && (
          <p role="alert" className="col-span-3 text-meta text-danger">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function RejectionModal({
  app,
  onCancel,
  onSave,
}: {
  app: BankApplication;
  onCancel: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={onCancel}
      title="Record rejection"
      subtitle={`${app.bank} · a task to analyze the reason will be created`}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" disabled={!reason.trim()} onClick={() => onSave(reason)}>
            Record rejection
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <Field label="Reason from the bank">
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              placeholder="e.g. Insufficient collateral: machinery covers 96%"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {REJECTION_REASON_PRESETS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full focus-visible:shadow-focus focus-visible:outline-none"
            >
              <TokenChip muted={reason !== r}>{r}</TokenChip>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
