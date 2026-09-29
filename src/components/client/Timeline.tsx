import { useMemo, useState, type RefObject } from 'react';
import Link from 'next/link';
import { AutoTag, Button, Card, SegmentedControl, Select, Textarea } from '@/src/components/ui';
import { INTERACTION_TYPES, type InteractionType } from '@/src/lib/constants';
import type { Dataset } from '@/src/lib/data';
import {
  timelineGroups,
  timelineTypes,
  type TimelineItem,
  type TimelineSource,
} from '@/src/lib/data/clientCard';
import { formatDayHeader, formatMoneyCompact, formatTime } from '@/src/lib/format';
import type { Client } from '@/src/lib/types';
import { dealHref } from '../shell/routes';
import { INTERACTION_ICON } from './interactionIcons';

export interface TimelineProps {
  data: Dataset;
  client: Client;
  now: Date;
  noteRef: RefObject<HTMLTextAreaElement | null>;
  onAddNote: (text: string) => void;
}

/** Interaction history: quick note on top, then entries grouped by day, newest first. */
export function Timeline({ data, client, now, noteRef, onAddNote }: TimelineProps) {
  const [source, setSource] = useState<TimelineSource>('all');
  const [type, setType] = useState<InteractionType | null>(null);
  const [note, setNote] = useState('');

  const groups = useMemo(
    () => timelineGroups(data, client.id, { source, type }),
    [data, client.id, source, type],
  );
  const types = useMemo(() => timelineTypes(data, client.id), [data, client.id]);
  const filtered = source !== 'all' || type !== null;

  const save = () => {
    if (!note.trim()) return;
    onAddNote(note);
    setNote('');
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-3">
        <h2 className="font-semibold">Interaction history</h2>
        <div className="flex items-center gap-2">
          <Select
            size="sm"
            aria-label="Entry type"
            value={type ?? ''}
            onChange={(e) => setType((e.target.value || null) as InteractionType | null)}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {INTERACTION_TYPES[t].label}
              </option>
            ))}
          </Select>
          <SegmentedControl
            label="Show entries"
            size="sm"
            value={source}
            onChange={setSource}
            options={[
              { value: 'all', label: 'All' },
              { value: 'manual', label: 'Manual' },
              { value: 'auto', label: 'Automatic' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-border-subtle px-3.5 py-3">
        <Textarea
          ref={noteRef}
          rows={2}
          aria-label="Add a note"
          placeholder="Add a note about the call, agreements, next step…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              save();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-meta text-text-faint">Enter — save · Shift + Enter — new line</span>
          <Button size="sm" variant="primary" disabled={!note.trim()} onClick={save}>
            Save note
          </Button>
        </div>
      </div>

      <div className="px-3.5 pt-1 pb-3.5">
        {groups.map((group) => (
          <section key={group.day.getTime()} aria-label={formatDayHeader(group.day, now)}>
            <h3 className="flex items-center gap-2.5 pt-3 pb-1.5 text-meta font-semibold tracking-overline text-text-tertiary uppercase">
              {formatDayHeader(group.day, now)}
              <span className="h-px flex-1 bg-border-subtle" />
            </h3>
            <ol className="flex flex-col">
              {group.items.map((item) => (
                <li key={item.interaction.id}>
                  {item.interaction.auto ? <AutoEntry item={item} /> : <ManualEntry item={item} />}
                </li>
              ))}
            </ol>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="py-8 text-center text-text-muted">
            {filtered ? (
              <>
                No entries match this filter.{' '}
                <Button
                  variant="link"
                  onClick={() => {
                    setSource('all');
                    setType(null);
                  }}
                >
                  Show all
                </Button>
              </>
            ) : (
              'No interactions yet. Add a note or log a call.'
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function DealLink({ item }: { item: TimelineItem }) {
  if (!item.deal) return null;
  return (
    <Link
      href={dealHref(item.deal.id)}
      className="truncate text-text-faint transition-colors hover:text-accent focus-visible:outline-none focus-visible:shadow-focus"
    >
      {item.deal.product} · {formatMoneyCompact(item.deal.requestedAmount)}
    </Link>
  );
}

/** Written by a person: icon in an accent circle and a bordered bubble. */
function ManualEntry({ item }: { item: TimelineItem }) {
  const { interaction } = item;
  const Icon = INTERACTION_ICON[interaction.type];
  return (
    <div className="flex gap-2.5 py-1.5">
      <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 rounded-card border border-border-timeline px-2.5 py-2">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{INTERACTION_TYPES[interaction.type].label}</span>
          <span className="text-text-muted">{item.author?.name}</span>
          <span className="ml-auto flex min-w-0 items-baseline gap-2">
            <DealLink item={item} />
            <span className="text-text-faint tabular-nums">
              {formatTime(new Date(interaction.date))}
            </span>
          </span>
        </div>
        <div className="mt-0.75 text-pretty whitespace-pre-wrap">{interaction.summary}</div>
      </div>
    </div>
  );
}

/** Created by the system: compact grey line with a dashed icon ring and the `auto` tag. */
function AutoEntry({ item }: { item: TimelineItem }) {
  const { interaction } = item;
  const Icon = INTERACTION_ICON[interaction.type];
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="flex h-5.5 w-6.5 shrink-0 items-center justify-center">
        <span className="flex size-4.5 items-center justify-center rounded-full border border-dashed border-text-separator text-text-faint">
          <Icon size={11} strokeWidth={2} />
        </span>
      </span>
      <div className="min-w-0 flex-1 pt-0.5 text-sm text-pretty text-text-tertiary">
        <span className="mr-1.5">
          <AutoTag variant="mono" />
        </span>
        {interaction.summary}
      </div>
      <span className="shrink-0 pt-0.5 text-meta text-text-disabled tabular-nums">
        {formatTime(new Date(interaction.date))}
      </span>
    </div>
  );
}
