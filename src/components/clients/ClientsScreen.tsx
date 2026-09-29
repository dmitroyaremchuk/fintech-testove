'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Inbox, Plus, Upload } from 'lucide-react';
import { Button, Card, EmptyState, Kbd, useToast } from '@/src/components/ui';
import { useDataStore, useScopedData, type Dataset } from '@/src/lib/data';
import {
  BUILT_IN_VIEWS,
  clientRows,
  filterClientRows,
  isBuiltInView,
  sortClientRows,
  type BuiltInViewId,
  type ClientRow,
  type ClientSort,
  type FilterChip,
} from '@/src/lib/data/clients';
import { duplicatesByClient, type DuplicateMatch } from '@/src/lib/data/duplicates';
import {
  createClient,
  createLead,
  mergeClients,
  type NewClientInput,
  type NewLeadInput,
} from '@/src/lib/data/mutations';
import { useMediaQuery } from '@/src/lib/hooks/useMediaQuery';
import { useNow } from '@/src/lib/hooks/useNow';
import { clientHref } from '../shell/routes';
import { ClientsTable, rowDomId } from './ClientsTable';
import { ClientsToolbar, ViewTabs, type FilterPreset, type TabItem } from './ClientsToolbar';
import { MergeModal } from './MergeModal';
import { NewClientModal } from './NewClientModal';
import { useSavedViews } from './useSavedViews';

/** Default toolbar chip, as in the design. Links from the sidebar start without it. */
const DEFAULT_CHIPS: FilterChip[] = [{ field: 'status', value: 'Active' }];
const TOP_REGIONS = 3;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function ClientsScreen() {
  const data = useDataStore((s) => s.data);
  const scoped = useScopedData();
  if (!data || !scoped) return null; // the shell renders loading/error until data is ready
  return <ClientsView data={data} scoped={scoped} />;
}

function ClientsView({ data, scoped }: { data: Dataset; scoped: Dataset }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const session = useDataStore((s) => s.session);
  const lastManagerId = useDataStore((s) => s.lastManagerId);
  const commit = useDataStore((s) => s.commit);
  const isHead = session.role === 'head';
  const searchRef = useRef<HTMLInputElement>(null);
  // The head's extra Owner column needs room; below 1440px the Contact column gives way.
  const wide = useMediaQuery('(min-width: 1440px)');

  const filterParam = params.get('filter');
  const newParam = params.get('new');
  const startView: BuiltInViewId =
    filterParam === 'stale' || filterParam === 'repeat' ? filterParam : 'all';

  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<FilterChip[]>(filterParam ? [] : DEFAULT_CHIPS);
  const [viewId, setViewId] = useState<string>(startView);
  const [sort, setSort] = useState<ClientSort>('last');
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState<'client' | 'lead' | null>(null);
  const [merging, setMerging] = useState<[ClientRow, ClientRow] | null>(null);
  const saved = useSavedViews();

  // "+ New" in the top bar links here with ?new=client|lead.
  const createMode = creating ?? (newParam === 'lead' || newParam === 'client' ? newParam : null);

  const rows = useMemo(() => clientRows(scoped, now), [scoped, now]);
  const view = isBuiltInView(viewId) ? viewId : (saved.views.find((v) => v.id === viewId) ?? 'all');
  const visible = useMemo(
    () => sortClientRows(filterClientRows(rows, { query, chips, view }), sort),
    [rows, query, chips, view, sort],
  );
  const duplicates = useMemo(() => duplicatesByClient(data, session), [data, session]);
  const active = Math.min(cursor, Math.max(0, visible.length - 1));

  // Counts respect the current search and chips, so a tab's number matches what it will show.
  const tabs: TabItem[] = [
    ...BUILT_IN_VIEWS.map((v) => ({
      id: v.id,
      label: v.label,
      count: filterClientRows(rows, { query, chips, view: v.id }).length,
      custom: false,
    })),
    ...saved.views.map((v) => ({
      id: v.id,
      label: v.label,
      count: filterClientRows(rows, { query, chips, view: v }).length,
      custom: true,
    })),
  ];

  const presets = useMemo<FilterPreset[]>(() => {
    const regionCounts = new Map<string, number>();
    for (const r of rows)
      regionCounts.set(r.client.region, (regionCounts.get(r.client.region) ?? 0) + 1);
    const topRegions = [...regionCounts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_REGIONS)
      .map(([r]) => r);
    return [
      ...(['Active', 'New', 'Inactive'] as const).map((value) => ({
        group: 'Status',
        chip: { field: 'status' as const, value },
      })),
      ...(['LLC', 'Sole prop.'] as const).map((value) => ({
        group: 'Form',
        chip: { field: 'legalForm' as const, value },
      })),
      ...topRegions.map((value) => ({
        group: 'Region',
        chip: { field: 'region' as const, value },
      })),
      ...(isHead
        ? data.users
            .filter((u) => u.role === 'manager')
            .map((u) => ({ group: 'Owner', chip: { field: 'owner' as const, value: u.id } }))
        : []),
    ];
  }, [rows, isHead, data.users]);

  const open = (row: ClientRow | undefined) => row && router.push(clientHref(row.client.id));
  const clearAll = () => {
    setQuery('');
    setChips([]);
    setViewId('all');
    setCursor(0);
  };

  // Keyboard: "/" focuses search; ↑ ↓ move the highlighted row; Enter opens it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const inSearch = e.target === searchRef.current;
      if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (
        (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        (inSearch || !isTyping(e.target))
      ) {
        e.preventDefault();
        const next = Math.max(
          0,
          Math.min(visible.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)),
        );
        setCursor(next);
        const row = visible[next];
        if (row)
          document.getElementById(rowDomId(row.client.id))?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && (inSearch || e.target === document.body)) {
        e.preventDefault();
        open(visible[active]);
      } else if (e.key === 'Escape' && inSearch) {
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const closeCreate = () => {
    setCreating(null);
    if (newParam) router.replace('/clients');
  };

  const onCreate = (input: NewClientInput, lead: NewLeadInput | null) => {
    const previous = data;
    const result = lead ? createLead(data, input, lead, now) : createClient(data, input, now);
    commit(result.data);
    closeCreate();
    // Show the new record: it is "New" and would be hidden by the default "Status: Active" chip.
    clearAll();
    toast.show({
      message: lead
        ? `Lead created · task “Call tomorrow at 10:00” added`
        : `Client “${result.client.name}” created`,
      onUndo: () => commit(previous),
    });
  };

  const onMerge = (row: ClientRow, other: DuplicateMatch) => {
    const otherRow = rows.find((r) => r.client.id === other.id);
    if (otherRow) setMerging([row, otherRow]);
  };

  const onConfirmMerge = (keepId: string, removeId: string) => {
    const previous = data;
    const { data: next, moved } = mergeClients(data, keepId, removeId, now);
    const kept = next.clients.find((c) => c.id === keepId);
    commit(next);
    setMerging(null);
    const deals = moved.deals === 1 ? '1 deal' : `${moved.deals} deals`;
    toast.show({
      message: `Records merged · ${deals} and history moved to “${kept?.name}”`,
      onUndo: () => commit(previous),
    });
  };

  const headName = data.users.find((u) => u.role === 'head')?.name ?? 'the head of department';
  const onRequestMerge = () => toast.show({ message: `Merge request sent to ${headName}` });

  // First duplicate pair the session can see, for the banner above the list.
  const bannerEntry = [...duplicates].find(([, list]) => list.length > 0);
  const bannerRow = bannerEntry && rows.find((r) => r.client.id === bannerEntry[0]);
  const bannerOther = bannerEntry?.[1][0];

  if (scoped.clients.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Inbox size={22} strokeWidth={1.75} />}
          title="No clients yet"
          description="Create a client manually or import from Excel. EDRPOU duplicates are checked automatically."
          actions={
            <Button variant="primary" onClick={() => setCreating('client')}>
              New client
            </Button>
          }
        />
        {createMode && (
          <NewClientModal
            mode={createMode}
            data={data}
            session={session}
            defaultOwnerId={lastManagerId}
            onCancel={closeCreate}
            onCreate={onCreate}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-6 pt-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-title font-semibold">Clients</h1>
          <span className="text-text-muted tabular-nums">
            {visible.length} of {rows.length}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            icon={Upload}
            onClick={() => toast.show({ message: 'Import from Excel is not part of the demo' })}
          >
            Import
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setCreating('client')}>
            New client
          </Button>
        </div>
      </div>

      {bannerRow && bannerOther && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-card border border-warning-border bg-warning-soft px-3 py-2.25 text-warning-text"
        >
          <Copy size={18} strokeWidth={1.75} className="shrink-0 text-warning-icon" />
          <span className="flex-1 text-pretty">
            {isHead
              ? `Possible duplicate: “${bannerRow.client.name}” and “${bannerOther.name}” share EDRPOU ${bannerRow.client.code}. Sources: ${bannerRow.client.leadSource.toLowerCase()} and ${bannerOther.leadSource.toLowerCase()}.`
              : `EDRPOU ${bannerRow.client.code} already exists: “${bannerOther.name}”, owner — ${bannerOther.ownerName}. Only the head can merge records.`}
          </span>
          <Button
            size="sm"
            variant="warning-outline"
            onClick={() => router.push(clientHref(bannerOther.id))}
          >
            {isHead ? 'Compare' : 'View'}
          </Button>
          <Button
            size="sm"
            variant="warning"
            onClick={() => (isHead ? onMerge(bannerRow, bannerOther) : onRequestMerge())}
          >
            {isHead ? 'Merge records' : 'Request merge'}
          </Button>
        </div>
      )}

      <ViewTabs
        tabs={tabs}
        active={viewId}
        onSelect={(id) => {
          setViewId(id);
          setCursor(0);
        }}
        onRemove={(id) => {
          const before = saved.views;
          const removed = before.find((v) => v.id === id);
          saved.remove(id);
          if (viewId === id) setViewId('all');
          toast.show({
            message: `Saved filter “${removed?.label}” deleted`,
            onUndo: () => saved.restore(before),
          });
        }}
        sort={sort}
        onSort={setSort}
      />

      <ClientsToolbar
        searchRef={searchRef}
        query={query}
        onQuery={(q) => {
          setQuery(q);
          setCursor(0);
        }}
        chips={chips}
        onChips={(next) => {
          setChips(next);
          setCursor(0);
        }}
        presets={presets}
        users={data.users}
        onSave={(label) => {
          const view = saved.add({ label, query: query.trim(), chips });
          setViewId(view.id);
          setQuery('');
          setChips([]);
          toast.show({ message: `Filter “${label}” saved` });
        }}
        onReset={clearAll}
      />

      <Card className="overflow-hidden">
        <ClientsTable
          rows={visible}
          now={now}
          cursor={active}
          onCursor={setCursor}
          onOpen={open}
          duplicates={duplicates}
          canMerge={isHead}
          showOwner={isHead}
          showContact={!isHead || wide}
          onMerge={onMerge}
          onRequestMerge={onRequestMerge}
          query={query}
          onClear={clearAll}
        />
      </Card>

      <div className="flex gap-3.5 text-meta text-text-faint">
        <span>
          <Kbd>/</Kbd> search
        </span>
        <span>
          <Kbd>↑ ↓</Kbd> navigate
        </span>
        <span>
          <Kbd>Enter</Kbd> open card
        </span>
        {!isHead && <span className="ml-auto">Showing your clients only</span>}
      </div>

      {createMode && (
        <NewClientModal
          mode={createMode}
          data={data}
          session={session}
          defaultOwnerId={lastManagerId}
          onCancel={closeCreate}
          onCreate={onCreate}
        />
      )}
      {merging && (
        <MergeModal
          pair={merging}
          now={now}
          onCancel={() => setMerging(null)}
          onConfirm={onConfirmMerge}
        />
      )}
    </div>
  );
}
