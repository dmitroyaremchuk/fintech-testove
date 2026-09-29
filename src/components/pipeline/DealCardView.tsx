import { useState, type CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ArrowRight, FileWarning, Landmark, MoreHorizontal, Timer } from 'lucide-react';
import { Avatar, Menu, MenuItem, MenuLabel, Popover, Tooltip, Truncate } from '@/src/components/ui';
import { CLOSED_STAGES, STAGES, type StageKey } from '@/src/lib/constants';
import type { DealCard } from '@/src/lib/data/pipeline';
import { formatMoney } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import { cn } from '@/src/lib/cn';

export interface DealCardViewProps {
  card: DealCard;
  onOpen: () => void;
  onMove: (target: StageKey) => void;
}

/** Draggable kanban card. Click or Enter opens the deal; "…" offers the same moves without dragging. */
export function DraggableDealCard({ card, onOpen, onMove }: DealCardViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.deal.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${card.client?.name ?? 'Deal'} · ${card.deal.product} · ${formatMoney(card.deal.requestedAmount)}. Drag to move, Enter to open.`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      className={cn(
        'rounded-input focus-visible:outline-none focus-visible:shadow-focus',
        isDragging && 'opacity-40',
      )}
    >
      <DealCardBody card={card} onMove={onMove} />
    </div>
  );
}

/** Visual card, also used in the drag overlay (without the menu). */
export function DealCardBody({
  card,
  onMove,
  overlay,
}: {
  card: DealCard;
  onMove?: (target: StageKey) => void;
  overlay?: boolean;
}) {
  const { deal, client, owner, stuck, daysInStage, slaDays, applications, docAlert, suggestion } =
    card;
  const style: CSSProperties | undefined = overlay ? { cursor: 'grabbing' } : undefined;
  return (
    <div
      style={style}
      className={cn(
        'group relative flex cursor-grab flex-col gap-1.5 rounded-input border px-2.5 py-2.25 shadow-card transition-shadow',
        'hover:shadow-card-hover',
        stuck ? 'border-danger-border-stuck bg-danger-softer' : 'border-border bg-surface',
        overlay && 'rotate-1 shadow-menu',
      )}
    >
      <div className="flex items-start gap-1.5 pr-5">
        <Truncate className="font-medium">{client?.name ?? '—'}</Truncate>
      </div>
      {onMove && <CardMenu stage={deal.stage} onMove={onMove} />}
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="truncate text-sm text-text-tertiary" title={deal.purpose}>
          {deal.product}
        </span>
        <span className="text-control font-semibold whitespace-nowrap tabular-nums">
          {formatMoney(deal.requestedAmount)}
        </span>
      </div>
      {docAlert && (
        <div
          className={cn(
            'flex items-start gap-1 self-start rounded-badge px-1.5 py-0.5 text-caption font-medium',
            docAlert.kind === 'expired'
              ? 'bg-tone-red-bg text-tone-red-fg'
              : 'bg-tone-amber-bg text-tone-amber-fg',
          )}
        >
          <FileWarning size={13} strokeWidth={1.75} className="mt-px shrink-0" />
          {docAlert.text}
        </div>
      )}
      {suggestion && onMove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMove(suggestion.stage);
          }}
          title={suggestion.reason}
          className="flex items-center gap-1 self-start text-meta text-accent hover:text-accent-hover hover:underline focus-visible:outline-none focus-visible:shadow-focus"
        >
          Suggested: {getStage(suggestion.stage).label}
          <ArrowRight size={12} strokeWidth={2} />
        </button>
      )}
      <div
        className={cn(
          'flex items-center gap-2 text-meta tabular-nums',
          stuck ? 'text-danger' : 'text-text-muted',
        )}
      >
        <span className={cn('flex items-center gap-0.75', stuck && 'font-semibold')}>
          <Timer size={13} strokeWidth={stuck ? 2.25 : 1.75} />
          {stuck ? `${daysInStage} d · SLA ${slaDays}` : `${daysInStage} of ${slaDays} d`}
        </span>
        {applications > 0 && (
          <span className="flex items-center gap-0.75 text-text-muted">
            <Landmark size={13} strokeWidth={1.75} />
            {applications} {applications === 1 ? 'bank' : 'banks'}
          </span>
        )}
        {owner && (
          <span className="ml-auto">
            <Tooltip content={owner.name}>
              <Avatar name={owner.name} size="sm" tone="accent" />
            </Tooltip>
          </span>
        )}
      </div>
    </div>
  );
}

const MOVE_TARGETS = [...STAGES, ...CLOSED_STAGES];

function CardMenu({ stage, onMove }: { stage: StageKey; onMove: (target: StageKey) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        'absolute top-1.5 right-1.5 transition-opacity',
        open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Popover
        portal
        open={open}
        onClose={() => setOpen(false)}
        align="right"
        className="w-56"
        anchor={
          <button
            type="button"
            aria-label="Move deal"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-5 items-center justify-center rounded-control-sm text-text-muted hover:bg-surface-hover-menu hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
          >
            <MoreHorizontal size={15} strokeWidth={1.75} />
          </button>
        }
      >
        <Menu label="Move deal">
          <MenuLabel>Move to</MenuLabel>
          {MOVE_TARGETS.filter((s) => s.key !== stage).map((s) => (
            <MenuItem
              key={s.key}
              onSelect={() => {
                setOpen(false);
                onMove(s.key);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-bar" style={{ background: s.color }} />
                {s.key === 'lost' ? 'Lost…' : s.label}
              </span>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </div>
  );
}
