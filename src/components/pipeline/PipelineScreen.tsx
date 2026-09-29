'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Inbox, Timer } from 'lucide-react';
import { Button, Chip, EmptyState, SegmentedControl, Select, useToast } from '@/src/components/ui';
import {
  PRODUCTS,
  STAGES,
  type LossReason,
  type OpenStageKey,
  type Product,
  type StageKey,
} from '@/src/lib/constants';
import { useDataStore, useScopedData, type Dataset, type Session } from '@/src/lib/data';
import { moveDeal } from '@/src/lib/data/mutations';
import {
  AMOUNT_RANGES,
  closedDeals,
  filterCards,
  isFiltered,
  NO_FILTERS,
  pipelineCards,
  pipelineColumns,
  pipelineSummary,
  type AmountRange,
  type PipelineFilters,
} from '@/src/lib/data/pipeline';
import { formatMoney, formatMoneyCompact } from '@/src/lib/format';
import { useNow } from '@/src/lib/hooks/useNow';
import { getStage } from '@/src/lib/rules/stages';
import { suggestStage } from '@/src/lib/rules/transitions';
import type { Deal } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';
import { LostDealModal } from '../deals/LostDealModal';
import { dealHref } from '../shell/routes';
import { Board } from './Board';
import { PipelineTable } from './PipelineTable';

export function PipelineScreen() {
  const data = useDataStore((s) => s.data);
  const scoped = useScopedData();
  const session = useDataStore((s) => s.session);
  if (!data || !scoped) return null; // the shell shows loading / error
  return <PipelineView data={data} scoped={scoped} session={session} />;
}

function PipelineView({
  data,
  scoped,
  session,
}: {
  data: Dataset;
  scoped: Dataset;
  session: Session;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const commit = useDataStore((s) => s.commit);
  const now = useNow();
  const isHead = session.role === 'head';

  const [view, setView] = useState<'kanban' | 'table'>(
    params.get('view') === 'table' ? 'table' : 'kanban',
  );
  const [filters, setFilters] = useState<PipelineFilters>(() => ({
    ...NO_FILTERS,
    onlyStuck: params.get('filter') === 'over-sla',
    ownerId: params.get('owner'),
    stage:
      (STAGES.find((s) => s.key === params.get('stage'))?.key as OpenStageKey | undefined) ?? null,
  }));
  const [lostFor, setLostFor] = useState<{ deal: Deal; reason?: LossReason } | null>(null);

  // The owner filter is a head-only control; for managers the scope already limits the deals.
  const effective = useMemo(
    () => (isHead ? filters : { ...filters, ownerId: null }),
    [filters, isHead],
  );
  const cards = useMemo(() => pipelineCards(scoped, now), [scoped, now]);
  const visible = useMemo(() => filterCards(cards, effective), [cards, effective]);
  const columns = useMemo(() => pipelineColumns(visible), [visible]);
  const closed = useMemo(() => closedDeals(scoped, effective), [scoped, effective]);
  const summary = pipelineSummary(visible);
  const managers = data.users.filter((u) => u.role === 'manager');
  const set = (patch: Partial<PipelineFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const apply = (deal: Deal, target: StageKey, reason: LossReason | null) => {
    const previous = data;
    const result = moveDeal(data, deal.id, target, now, reason);
    const client = data.clients.find((c) => c.id === deal.clientId);
    if (!result.check.allowed) {
      if (result.check.code !== 'same_stage')
        toast.show({ kind: 'blocked', message: result.check.message });
      return;
    }
    commit(result.data);
    const n = result.tasks.length;
    const tasks = n ? ` · ${n} ${n === 1 ? 'task' : 'tasks'} created` : '';
    toast.show({
      message: `“${client?.name ?? 'Deal'}” → “${getStage(target).label}”${tasks}`,
      onUndo: () => commit(previous),
    });
  };

  const onMove = (dealId: string, target: StageKey) => {
    const deal = data.deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === target) return;
    if (target === 'lost') {
      const apps = data.applications.filter((a) => a.dealId === dealId);
      const suggested = suggestStage(deal, apps);
      setLostFor({ deal, reason: suggested?.stage === 'lost' ? suggested.lostReason : undefined });
      return;
    }
    apply(deal, target, null);
  };

  if (scoped.deals.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} strokeWidth={1.75} />}
        title="Pipeline is empty"
        description="Deals are created from the client card. New leads land here automatically."
        actions={
          <Button variant="primary" onClick={() => router.push('/clients')}>
            Go to clients
          </Button>
        }
      />
    );
  }

  const lostClient = lostFor && data.clients.find((c) => c.id === lostFor.deal.clientId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 pt-4 pb-3">
        <div className="flex flex-col">
          <h1 className="text-title font-semibold">Deal pipeline</h1>
          <span className="mt-0.5 text-text-muted tabular-nums">
            {summary.count} {summary.count === 1 ? 'deal' : 'deals'} ·{' '}
            {formatMoneyCompact(summary.amount)} · weighted commission{' '}
            {formatMoney(summary.weighted)}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isHead && (
            <Select
              size="md"
              aria-label="Owner"
              value={filters.ownerId ?? ''}
              onChange={(e) => set({ ownerId: e.target.value || null })}
            >
              <option value="">All managers</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            size="md"
            aria-label="Product"
            value={filters.product ?? ''}
            onChange={(e) => set({ product: (e.target.value || null) as Product | null })}
          >
            <option value="">All products</option>
            {PRODUCTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select
            size="md"
            aria-label="Amount"
            value={filters.amount}
            onChange={(e) => set({ amount: e.target.value as AmountRange })}
          >
            {AMOUNT_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-pressed={filters.onlyStuck}
            onClick={() => set({ onlyStuck: !filters.onlyStuck })}
            className={cn(
              'flex h-control-md items-center gap-1.25 rounded-control border px-2.5 text-control transition-colors',
              'focus-visible:shadow-focus focus-visible:outline-none',
              filters.onlyStuck
                ? 'border-danger-border-toggle bg-danger-bg text-danger'
                : 'border-border-strong bg-surface text-text-secondary hover:bg-bg',
            )}
          >
            <Timer size={15} strokeWidth={1.75} />
            Over SLA only
          </button>
          {filters.stage && (
            <Chip size="lg" onRemove={() => set({ stage: null })} removeLabel="Show all stages">
              Stage: {getStage(filters.stage).label}
            </Chip>
          )}
          {isFiltered(effective) && (
            <Button variant="link-muted" onClick={() => setFilters(NO_FILTERS)}>
              Reset
            </Button>
          )}
          <SegmentedControl
            label="View"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'kanban', label: 'Kanban' },
              { value: 'table', label: 'Table' },
            ]}
          />
        </div>
      </div>

      {view === 'kanban' && isFiltered(effective) && visible.length === 0 && (
        <div className="mx-6 mb-3 flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 text-control text-text-tertiary">
          No open deals match the filters.
          <Button variant="link" onClick={() => setFilters(NO_FILTERS)}>
            Reset filters
          </Button>
        </div>
      )}

      {view === 'kanban' ? (
        <Board
          columns={columns}
          closed={closed}
          data={data}
          onOpen={(id) => router.push(dealHref(id))}
          onMove={onMove}
        />
      ) : (
        <PipelineTable
          cards={visible}
          showOwner={isHead}
          onOpen={(id) => router.push(dealHref(id))}
          onReset={() => setFilters(NO_FILTERS)}
        />
      )}

      {lostFor && (
        <LostDealModal
          subtitle={`${lostClient?.name ?? ''} · ${lostFor.deal.product} · ${formatMoney(lostFor.deal.requestedAmount)}`}
          initialReason={lostFor.reason}
          onCancel={() => setLostFor(null)}
          onConfirm={(reason) => {
            const deal = lostFor.deal;
            setLostFor(null);
            apply(deal, 'lost', reason);
          }}
        />
      )}
    </div>
  );
}
