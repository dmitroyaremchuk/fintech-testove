'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Avatar, Badge, Kbd, Popover, TextInput } from '@/src/components/ui';
import { search, useDataStore, useScopedData } from '@/src/lib/data';
import { formatMoneyCompact } from '@/src/lib/format';
import { getStage } from '@/src/lib/rules/stages';
import { cn } from '@/src/lib/cn';
import { clientHref, dealHref } from './routes';

interface Option {
  id: string;
  href: string;
  kind: 'client' | 'deal';
}

const noSubscribe = () => () => undefined;

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. The server render assumes "⌘K". */
function useShortcutLabel(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'),
    () => '⌘K',
  );
}

/** Top-bar search over clients and open deals the current role can see. ⌘K / Ctrl+K focuses it. */
export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useScopedData();
  const ready = useDataStore((s) => s.status === 'ready');
  const shortcut = useShortcutLabel();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => (data ? search(data, query) : { clients: [], deals: [] }),
    [data, query],
  );
  const clientName = useMemo(() => new Map(data?.clients.map((c) => [c.id, c.name]) ?? []), [data]);
  const options: Option[] = [
    ...results.clients.map((c) => ({ id: c.id, href: clientHref(c.id), kind: 'client' as const })),
    ...results.deals.map((d) => ({ id: d.id, href: dealHref(d.id), kind: 'deal' as const })),
  ];

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setActive(0);
  };

  const go = (option: Option | undefined) => {
    if (!option) return;
    router.push(option.href);
    setQuery('');
    close();
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (options.length ? (i + step + options.length) % options.length : 0));
    } else if (e.key === 'Enter') {
      go(options[active]);
    } else if (e.key === 'Escape') {
      close();
      inputRef.current?.blur();
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;
  const showPanel = open && query.trim().length > 0;

  return (
    <Popover
      open={showPanel}
      onClose={close}
      align="right"
      className="w-90"
      anchor={
        <TextInput
          ref={inputRef}
          variant="subtle"
          className="w-65"
          role="combobox"
          aria-label="Search clients and deals"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && options.length ? optionId(active) : undefined}
          placeholder="Client, EDRPOU, phone…"
          disabled={!ready}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          leading={<Search size={16} strokeWidth={1.75} />}
          trailing={<Kbd>{shortcut}</Kbd>}
        />
      }
    >
      <div id={listId} role="listbox" aria-label="Search results" className="flex flex-col">
        {options.length === 0 && (
          <div className="px-2.5 py-3 text-control">
            <div className="font-medium">Nothing found for “{query.trim()}”</div>
            <div className="mt-0.5 text-sm text-text-muted">
              Search by name, EDRPOU, contact or phone number
            </div>
          </div>
        )}
        {results.clients.length > 0 && <GroupLabel>Clients</GroupLabel>}
        {results.clients.map((c, i) => (
          <ResultRow
            key={c.id}
            id={optionId(i)}
            active={active === i}
            onHover={() => setActive(i)}
            onSelect={() => go(options[i])}
          >
            <Avatar name={c.name} shape="square" size="md" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{c.name}</span>
              <span className="truncate text-meta text-text-tertiary">
                <span className="font-mono">{c.code}</span> · {c.industry}
              </span>
            </span>
          </ResultRow>
        ))}
        {results.deals.length > 0 && <GroupLabel>Deals</GroupLabel>}
        {results.deals.map((d, j) => {
          const i = results.clients.length + j;
          const stage = getStage(d.stage);
          return (
            <ResultRow
              key={d.id}
              id={optionId(i)}
              active={active === i}
              onHover={() => setActive(i)}
              onSelect={() => go(options[i])}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {clientName.get(d.clientId)} · {d.product}
                </span>
                <span className="truncate text-meta text-text-tertiary">
                  {d.purpose} · {formatMoneyCompact(d.requestedAmount)}
                </span>
              </span>
              <Badge tone={stage.tone} size="sm">
                {stage.label}
              </Badge>
            </ResultRow>
          );
        })}
      </div>
    </Popover>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-caption font-medium tracking-overline text-text-faint uppercase">
      {children}
    </div>
  );
}

function ResultRow({
  id,
  active,
  onHover,
  onSelect,
  children,
}: {
  id: string;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-control-sm px-2.5 py-1.5 text-control',
        active && 'bg-surface-hover-menu',
      )}
    >
      {children}
    </div>
  );
}
