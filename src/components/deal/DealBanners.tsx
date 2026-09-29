import { useState } from 'react';
import { BadgeCheck, Banknote, CircleX, Lightbulb } from 'lucide-react';
import { Button } from '@/src/components/ui';
import type { DealView } from '@/src/lib/data/dealCard';
import { formatDateInContext, formatMoney } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import type { StageSuggestion } from '@/src/lib/rules/transitions';

/**
 * "When every application has a decision, suggest moving the stage and ask to confirm"
 * (AGENTS.md rule 1). Nothing moves until the user clicks.
 */
export function SuggestionBanner({
  suggestion,
  onAccept,
}: {
  suggestion: StageSuggestion;
  onAccept: (s: StageSuggestion) => void;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = `${suggestion.stage}:${suggestion.reason}`;
  if (dismissed === key) return null;
  const label = getStage(suggestion.stage).label;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-card border border-accent-border-soft bg-accent-soft px-3.5 py-2.75"
    >
      <Lightbulb size={20} strokeWidth={1.75} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {suggestion.stage === 'lost' ? 'Close the deal as lost?' : `Move the deal to “${label}”?`}
        </div>
        <div className="text-control text-text-secondary text-pretty">{suggestion.reason}</div>
      </div>
      <Button size="md" variant="link-muted" onClick={() => setDismissed(key)}>
        Not now
      </Button>
      <Button
        size="lg"
        variant={suggestion.stage === 'lost' ? 'danger' : 'primary'}
        onClick={() => onAccept(suggestion)}
      >
        {suggestion.stage === 'lost' ? 'Mark as lost…' : `Move to “${label}”`}
      </Button>
    </div>
  );
}

/** The client accepted an offer: once the money arrives, this closes the deal as Won. */
export function DisbursementBanner({ view, onConfirm }: { view: DealView; onConfirm: () => void }) {
  const app = view.awaitingDisbursement;
  if (!app || view.closed) return null;
  return (
    <div className="flex items-center gap-3 rounded-card border border-success-border bg-success-soft px-3.5 py-2.75">
      <Banknote size={20} strokeWidth={1.75} className="shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Awaiting disbursement</div>
        <div className="text-control text-text-secondary">
          {app.bank} approved {formatMoney(app.amount)} and the client accepted. Confirm when the
          money arrives — the deal becomes Won and the commission invoice task is created.
        </div>
      </div>
      <Button variant="success" onClick={onConfirm}>
        Confirm disbursement
      </Button>
    </div>
  );
}

export function ClosedBanner({ view, now }: { view: DealView; now: Date }) {
  const { deal } = view;
  const when = formatDateInContext(new Date(deal.stageEnteredAt), now);
  if (deal.stage === 'won') {
    const paid = view.applications.find((a) => a.status === 'disbursed');
    return (
      <div className="flex items-center gap-2.5 rounded-card border border-success-border bg-success-soft px-3.5 py-2.75 text-success-fg">
        <BadgeCheck size={20} strokeWidth={1.75} className="shrink-0" />
        <b className="font-semibold">Deal won · funds disbursed {when}.</b>
        {paid && (
          <span className="text-text-secondary">
            {paid.bank} paid out {formatMoney(paid.amount)}.
          </span>
        )}
      </div>
    );
  }
  if (deal.stage === 'lost') {
    return (
      <div className="flex items-center gap-2.5 rounded-card border border-danger-border bg-danger-soft px-3.5 py-2.75 text-danger-text">
        <CircleX size={20} strokeWidth={1.75} className="shrink-0" />
        <b className="font-semibold">Deal lost · {deal.lostReason}.</b>
        <span className="text-text-secondary">Closed {when}. Closed deals are read-only.</span>
      </div>
    );
  }
  return null;
}
