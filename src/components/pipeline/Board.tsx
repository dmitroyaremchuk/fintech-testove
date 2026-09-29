import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { Ban, ChevronLeft, ChevronRight, CircleCheck, CircleX } from 'lucide-react';
import { STAGES, type StageKey } from '@/src/lib/constants';
import type { Dataset } from '@/src/lib/data';
import type { ClosedDeal, DealCard, PipelineColumn } from '@/src/lib/data/pipeline';
import { formatDateInContext, formatMoneyCompact } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import { canMoveToStage, type MoveCheck } from '@/src/lib/rules/transitions';
import { cn } from '@/src/lib/cn';
import { dealHref } from '../shell/routes';
import { DealCardBody, DraggableDealCard } from './DealCardView';

export interface BoardProps {
  columns: PipelineColumn[];
  closed: { won: ClosedDeal[]; lost: ClosedDeal[] };
  /** Full dataset, to preview whether a drop would be allowed. */
  data: Dataset;
  onOpen: (dealId: string) => void;
  onMove: (dealId: string, target: StageKey) => void;
}

/** Target stage → rule check for the card being dragged ("Lost" is allowed here; the reason comes next). */
function previewChecks(data: Dataset, card: DealCard): Map<StageKey, MoveCheck> {
  const applications = data.applications.filter((a) => a.dealId === card.deal.id);
  const targets: StageKey[] = [...STAGES.map((s) => s.key), 'won', 'lost'];
  return new Map(
    targets.map((t) => [
      t,
      t === 'lost' ? ({ allowed: true } as const) : canMoveToStage(card.deal, t, { applications }),
    ]),
  );
}

export function Board({ columns, closed, data, onOpen, onMove }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);
  // A small drag threshold keeps plain clicks working as "open the deal".
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);
  const active = activeId ? cards.find((c) => c.deal.id === activeId) : undefined;
  const checks = useMemo(() => (active ? previewChecks(data, active) : null), [active, data]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over) onMove(String(e.active.id), e.over.id as StageKey);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Stage columns scroll sideways; the Closed block stays pinned on the right so Won/Lost are always reachable. */}
      <div className="flex min-h-0 flex-1 gap-2.5 px-6 pb-4">
        <div className="flex min-h-0 min-w-0 flex-1 gap-2.5 overflow-x-auto">
          {columns.map((col) => (
            <Column
              key={col.stage}
              column={col}
              dragging={active}
              check={checks?.get(col.stage)}
              onOpen={onOpen}
              onMove={onMove}
            />
          ))}
        </div>
        <ClosedPanel
          open={closedOpen}
          onToggle={() => setClosedOpen((v) => !v)}
          closed={closed}
          dragging={Boolean(active)}
          checks={checks}
        />
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <DealCardBody card={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  column,
  dragging,
  check,
  onOpen,
  onMove,
}: {
  column: PipelineColumn;
  dragging: DealCard | undefined;
  check: MoveCheck | undefined;
  onOpen: (dealId: string) => void;
  onMove: (dealId: string, target: StageKey) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage });
  const stage = getStage(column.stage);
  const own = dragging?.deal.stage === column.stage;
  const blocked = Boolean(dragging) && !own && check && !check.allowed ? check : null;

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.label}: ${column.cards.length} deals`}
      className={cn(
        'flex min-h-0 min-w-kanban-col shrink-0 grow basis-kanban-col flex-col rounded-card border border-dashed transition-colors',
        isOver && !own && !blocked && 'border-accent bg-accent-soft',
        isOver && blocked && 'border-danger bg-danger-drop',
        !isOver && 'border-transparent bg-surface-sunken',
        dragging && blocked && !isOver && 'opacity-60',
      )}
    >
      <div className="flex flex-col gap-0.5 px-2.5 pt-2.5 pb-2">
        <div className="flex items-center gap-1.75">
          <span className="size-2 shrink-0 rounded-bar" style={{ background: stage.color }} />
          <h2 className="truncate text-control font-semibold">{stage.label}</h2>
          <span className="text-meta text-text-muted tabular-nums">{column.cards.length}</span>
        </div>
        {isOver && blocked && !blocked.allowed ? (
          <div className="flex items-start gap-1 text-meta text-danger" role="status">
            <Ban size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
            {blocked.message.replace(/^Can’t move to “[^”]+”: /, '')}
          </div>
        ) : (
          <div className="flex justify-between text-meta text-text-muted tabular-nums">
            <span>{column.sum ? formatMoneyCompact(column.sum) : '—'}</span>
            <span>SLA {stage.slaDays} d</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-2">
        {column.cards.map((card) => (
          <DraggableDealCard
            key={card.deal.id}
            card={card}
            onOpen={() => onOpen(card.deal.id)}
            onMove={(target) => onMove(card.deal.id, target)}
          />
        ))}
        {column.cards.length === 0 && (
          <div className="rounded-input border border-dashed border-border-dashed px-2 py-4 text-center text-meta text-text-disabled">
            No deals
          </div>
        )}
      </div>
    </section>
  );
}

function ClosedPanel({
  open,
  onToggle,
  closed,
  dragging,
  checks,
}: {
  open: boolean;
  onToggle: () => void;
  closed: { won: ClosedDeal[]; lost: ClosedDeal[] };
  dragging: boolean;
  checks: Map<StageKey, MoveCheck> | null;
}) {
  return (
    <aside
      aria-label="Closed deals"
      className={cn(
        'flex min-h-0 shrink-0 flex-col gap-2 rounded-card bg-surface-sunken p-2 transition-[width]',
        open ? 'w-65' : 'w-45',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center justify-between rounded-control-sm px-1 py-0.5 text-control font-semibold hover:bg-surface-hover-nav focus-visible:shadow-focus focus-visible:outline-none"
      >
        Closed
        <span className="flex items-center gap-1 text-meta font-normal text-text-muted">
          {open ? 'Hide' : 'Show'}
          {open ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </span>
      </button>
      <ClosedZone
        kind="won"
        deals={closed.won}
        open={open}
        dragging={dragging}
        check={checks?.get('won')}
      />
      <ClosedZone
        kind="lost"
        deals={closed.lost}
        open={open}
        dragging={dragging}
        check={checks?.get('lost')}
      />
    </aside>
  );
}

const ZONE = {
  won: {
    label: 'Won',
    hint: 'only after disbursement',
    Icon: CircleCheck,
    text: 'text-success',
    over: 'border-success bg-success-drop',
  },
  lost: {
    label: 'Lost',
    hint: 'reason required',
    Icon: CircleX,
    text: 'text-danger',
    over: 'border-danger bg-danger-drop',
  },
} as const;

function ClosedZone({
  kind,
  deals,
  open,
  dragging,
  check,
}: {
  kind: Extract<StageKey, 'won' | 'lost'>;
  deals: ClosedDeal[];
  open: boolean;
  dragging: boolean;
  check: MoveCheck | undefined;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kind });
  const z = ZONE[kind];
  const blocked = dragging && check && !check.allowed ? check : null;
  const sum = deals.reduce((s, d) => s + d.deal.requestedAmount, 0);
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`${z.label}: ${deals.length} deals, drop a deal here (${z.hint})`}
      className={cn('flex min-h-0 flex-col', open && 'flex-1')}
    >
      <div
        className={cn(
          'flex flex-col gap-0.5 rounded-input border border-dashed bg-surface px-2.5 py-2 transition-colors',
          isOver && !blocked && z.over,
          isOver && blocked && 'border-danger bg-danger-drop',
          !isOver && 'border-border-dashed',
        )}
      >
        <div className={cn('flex items-center gap-1.5 font-semibold', z.text)}>
          <z.Icon size={16} strokeWidth={1.75} />
          {z.label}
          <span className="ml-auto text-meta font-normal text-text-muted tabular-nums">
            {deals.length}
          </span>
        </div>
        <div className="text-meta text-text-muted">
          {isOver && blocked ? (
            <span className="text-danger">No application is disbursed yet</span>
          ) : kind === 'won' && sum > 0 ? (
            `${formatMoneyCompact(sum)} · ${z.hint}`
          ) : (
            z.hint
          )}
        </div>
      </div>
      {open && (
        <ul className="mt-1.5 flex min-h-0 flex-col gap-1 overflow-y-auto">
          {deals.map(({ deal, client }) => (
            <li key={deal.id}>
              <Link
                href={dealHref(deal.id)}
                className="flex flex-col rounded-control-sm px-2 py-1.5 hover:bg-surface-hover-nav focus-visible:shadow-focus focus-visible:outline-none"
              >
                <span className="truncate text-sm font-medium">{client?.name}</span>
                <span className="truncate text-meta text-text-muted">
                  {kind === 'lost' ? deal.lostReason : formatMoneyCompact(deal.requestedAmount)} ·{' '}
                  {formatDateInContext(new Date(deal.stageEnteredAt), new Date())}
                </span>
              </Link>
            </li>
          ))}
          {deals.length === 0 && (
            <li className="px-2 py-1 text-meta text-text-disabled">None yet</li>
          )}
        </ul>
      )}
    </div>
  );
}
