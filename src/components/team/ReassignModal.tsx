import { useMemo, useState } from 'react';
import { AlertTriangle, Timer } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Modal,
  Select,
  Textarea,
  Truncate,
} from '@/src/components/ui';
import type { Dataset } from '@/src/lib/data';
import type { ManagerLoad } from '@/src/lib/data/metrics';
import { reassignDeals } from '@/src/lib/data/mutations';
import { reassignCandidates } from '@/src/lib/data/team';
import { formatMoney } from '@/src/lib/format';
import { isOverloaded, reassignGroup, suggestAssignee } from '@/src/lib/rules/reassign';
import { getStage } from '@/src/lib/rules/stages';
import { cn } from '@/src/lib/cn';

export interface ReassignModalProps {
  data: Dataset;
  now: Date;
  from: ManagerLoad;
  loads: readonly ManagerLoad[];
  onClose: () => void;
  onConfirm: (dealIds: string[], toId: string, reason: string) => void;
}

export function ReassignModal({ data, now, from, loads, onClose, onConfirm }: ReassignModalProps) {
  const candidates = useMemo(
    () => reassignCandidates(data, from.user.id, now),
    [data, from.user.id, now],
  );
  const deals = candidates.map((c) => c.deal);
  const others = loads.filter((l) => l.user.id !== from.user.id);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [toId, setToId] = useState(
    () =>
      suggestAssignee(
        loads.map((l) => ({ ...l, userId: l.user.id })),
        from.user.id,
        1,
      ) ?? '',
  );
  const [reason, setReason] = useState('');

  const to = loads.find((l) => l.user.id === toId);
  const preview = useMemo(
    () => (selected.size && toId ? reassignDeals(data, [...selected], toId, now).moved : null),
    [data, selected, toId, now],
  );
  const count = preview?.deals ?? 0;
  const stuckIds = candidates.filter((c) => c.stuck).map((c) => c.deal.id);
  const siblings = (clientId: string) => deals.filter((d) => d.clientId === clientId).length - 1;
  const overloadsTarget =
    to !== undefined &&
    count > 0 &&
    isOverloaded({ openDeals: to.openDeals + count, overdueTasks: to.overdueTasks });

  const toggle = (dealId: string) => {
    const group = reassignGroup(deals, [dealId]);
    const next = new Set(selected);
    const on = !group.every((id) => next.has(id));
    for (const id of group) {
      if (on) next.add(id);
      else next.delete(id);
    }
    setSelected(next);
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Reassign deals"
      subtitle={`From ${from.user.name} · ${from.openDeals} open ${from.openDeals === 1 ? 'deal' : 'deals'}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={count === 0 || !to}
            onClick={() => onConfirm([...selected], toId, reason)}
          >
            {count ? `Reassign ${count} ${count === 1 ? 'deal' : 'deals'}` : 'Reassign'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="To">
          {({ id }) => (
            <Select id={id} value={toId} onChange={(e) => setToId(e.target.value)}>
              {others.map((l) => (
                <option key={l.user.id} value={l.user.id}>
                  {l.user.name} — {l.openDeals} deals · {l.overdueTasks} overdue
                  {l.overloaded ? ' · overloaded' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span>
              Deals · <span className="tabular-nums">{selected.size}</span> selected
            </span>
            <span className="flex gap-3">
              {stuckIds.length > 0 && (
                <Button
                  variant="link"
                  onClick={() => setSelected(new Set(reassignGroup(deals, stuckIds)))}
                >
                  Select over SLA ({stuckIds.length})
                </Button>
              )}
              {selected.size > 0 && (
                <Button variant="link-muted" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              )}
            </span>
          </div>
          <div
            role="group"
            aria-label="Deals to reassign"
            className="max-h-72 overflow-y-auto rounded-input border border-border"
          >
            {candidates.map((c) => {
              const stage = getStage(c.deal.stage);
              const more = siblings(c.deal.clientId);
              return (
                <div
                  key={c.deal.id}
                  className={cn(
                    'grid grid-cols-[16px_minmax(0,1fr)_auto_104px] items-center gap-2.5 border-b border-border-row px-3 py-2 last:border-b-0',
                    selected.has(c.deal.id) && 'bg-accent-softer',
                  )}
                >
                  <Checkbox
                    checked={selected.has(c.deal.id)}
                    onChange={() => toggle(c.deal.id)}
                    label={`Reassign ${c.client?.name ?? c.deal.id}`}
                  />
                  <span className="min-w-0">
                    <Truncate className="block font-medium">{c.client?.name ?? '—'}</Truncate>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-meta',
                        c.stuck ? 'text-danger' : 'text-text-muted',
                      )}
                    >
                      {c.stuck && <Timer size={12} strokeWidth={2} />}
                      {c.daysInStage} d in stage · SLA {c.slaDays} d
                      {more > 0 && (
                        <span className="text-text-muted">
                          {' '}
                          · moves with {more} more {more === 1 ? 'deal' : 'deals'} of this client
                        </span>
                      )}
                    </span>
                  </span>
                  <Badge tone={stage.tone} size="sm">
                    {stage.label}
                  </Badge>
                  <span className="text-right font-medium tabular-nums">
                    {formatMoney(c.deal.requestedAmount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Field label="Reason (optional)" hint="Added to the note in each deal’s timeline">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`e.g. ${from.user.name.split(' ')[0]} is overloaded`}
            />
          )}
        </Field>

        {preview && to && count > 0 && (
          <div className="flex flex-col gap-1 rounded-input bg-surface-subtle px-3 py-2.5 text-sm text-text-secondary tabular-nums">
            <span>
              {from.user.name} {from.openDeals} → {from.openDeals - count} deals · {to.user.name}{' '}
              {to.openDeals} → {to.openDeals + count} deals
            </span>
            <span className="text-text-muted">
              {preview.clients} {preview.clients === 1 ? 'client' : 'clients'} and {preview.tasks}{' '}
              open {preview.tasks === 1 ? 'task' : 'tasks'} move too. Each deal gets a note in its
              timeline.
            </span>
            {overloadsTarget && (
              <span className="flex items-center gap-1.5 text-warning-text">
                <AlertTriangle size={14} strokeWidth={1.75} />
                {to.user.name}{' '}
                {to.overloaded ? 'is already overloaded' : 'will be overloaded after this move'}
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
