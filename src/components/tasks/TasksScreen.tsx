'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BellRing, CircleCheckBig, Inbox, Phone } from 'lucide-react';
import { Button, Card, EmptyState, SegmentedControl, useToast } from '@/src/components/ui';
import {
  canReassign,
  useDataStore,
  useScopedData,
  type Dataset,
  type Session,
} from '@/src/lib/data';
import { addTask, reassignTask, setTaskStatus, snoozeTask } from '@/src/lib/data/mutations';
import {
  contactNudges,
  reminderSummary,
  reminderText,
  taskGroups,
  type TasksMode,
} from '@/src/lib/data/tasks';
import { formatDate, formatDue, formatRelativeDay } from '@/src/lib/format';
import { useNow } from '@/src/lib/hooks/useNow';
import { STALE_CONTACT_DAYS } from '@/src/lib/constants';
import type { ParsedQuickTask } from '@/src/lib/rules/quickTask';
import { dueFromPreset } from '@/src/lib/rules/tasks';
import type { Task } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';
import { clientHref } from '../shell/routes';
import { QuickAdd } from './QuickAdd';
import { taskColumns, TaskRowView } from './TaskRowView';

/** How long the "done" state shows before the row leaves (skipped with reduced motion). */
const COMPLETE_ANIMATION_MS = 450;

export function TasksScreen() {
  const data = useDataStore((s) => s.data);
  const scoped = useScopedData();
  const session = useDataStore((s) => s.session);
  if (!data || !scoped) return null; // the shell shows loading / error
  return <TasksView data={data} scoped={scoped} session={session} />;
}

function TasksView({
  data,
  scoped,
  session,
}: {
  data: Dataset;
  scoped: Dataset;
  session: Session;
}) {
  const toast = useToast();
  const update = useDataStore((s) => s.update);
  const now = useNow();
  const params = useSearchParams();
  const quickRef = useRef<HTMLInputElement>(null);
  const head = canReassign(session);
  const [mode, setMode] = useState<TasksMode>('all');
  const [completing, setCompleting] = useState<ReadonlySet<string>>(new Set());
  const [bannerHidden, setBannerHidden] = useState(false);

  // "+ New → New task" in the top bar lands here with ?new=task.
  useEffect(() => {
    if (params.get('new') === 'task') quickRef.current?.focus();
  }, [params]);

  const view = head ? mode : 'all';
  const groups = useMemo(
    () => taskGroups(scoped, now, view, session.userId),
    [scoped, now, view, session.userId],
  );
  const rows = groups.flatMap((g) => g.rows);
  const inView = { tasks: rows.map((r) => r.task) };
  const summary = reminderSummary(inView, now);
  const assignees = head ? data.users : null;
  const userName = (id: string) => data.users.find((u) => u.id === id)?.name ?? '—';
  const ownerOf = (clientId: string | null) =>
    (clientId && scoped.clients.find((c) => c.id === clientId)?.ownerId) || session.userId;

  const change = (
    apply: (d: Dataset) => Dataset,
    undo: (d: Dataset) => Dataset,
    message: string,
  ) => {
    update(apply);
    toast.show({ message, onUndo: () => update(undo) });
  };

  const complete = (task: Task) => {
    setCompleting((s) => new Set(s).add(task.id));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(
      () => {
        change(
          (d) => setTaskStatus(d, task.id, 'done'),
          (d) => setTaskStatus(d, task.id, 'open'),
          `Task completed · “${task.title}”`,
        );
        setCompleting((s) => {
          const next = new Set(s);
          next.delete(task.id);
          return next;
        });
      },
      reduced ? 0 : COMPLETE_ANIMATION_MS,
    );
  };

  const snooze = (task: Task, due: Date) => {
    const before = task.dueAt;
    change(
      (d) => snoozeTask(d, task.id, due),
      (d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, dueAt: before } : t)),
      }),
      `Snoozed to ${formatDue(due, now)}`,
    );
  };

  const reassign = (task: Task, userId: string) => {
    const before = task.assigneeId;
    change(
      (d) => reassignTask(d, task.id, userId),
      (d) => reassignTask(d, task.id, before),
      `Task reassigned to ${userName(userId)}`,
    );
  };

  const addParsed = (p: ParsedQuickTask) => {
    const clientDeal = p.clientId
      ? scoped.deals.find(
          (d) => d.clientId === p.clientId && d.stage !== 'won' && d.stage !== 'lost',
        )
      : undefined;
    let createdId = '';
    change(
      (d) => {
        const { data: next, task } = addTask(d, {
          title: p.title,
          type: p.type,
          clientId: p.clientId,
          dealId: clientDeal?.id ?? null,
          assigneeId: ownerOf(p.clientId),
          dueAt: p.due,
          priority: p.priority,
        });
        createdId = task.id;
        return next;
      },
      (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== createdId) }),
      `Task created · ${p.due ? formatDue(p.due, now) : 'no date'}`,
    );
  };

  const planCall = (clientId: string, name: string) =>
    addParsed({
      title: `Call ${name}`,
      type: 'call',
      clientId,
      due: dueFromPreset('tomorrow', now),
      priority: 'med',
      recognized: { date: true, time: true, client: true },
    });

  const autoCount = rows.filter((r) => r.task.source === 'auto').length;
  const nothingToday = summary.today === 0 && summary.overdue === 0;
  const nudges = nothingToday ? contactNudges(scoped, now) : [];

  if (scoped.clients.length === 0 && scoped.tasks.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} strokeWidth={1.75} />}
        title="All done"
        description="No new tasks. The system creates them automatically on stage changes and bank decisions."
        actions={
          <Button variant="primary" onClick={() => quickRef.current?.focus()}>
            Create task
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex max-w-[1280px] flex-col gap-3 px-6 pt-5 pb-8">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-title font-semibold">Tasks</h1>
          <span className="text-text-muted tabular-nums">
            {rows.length} open · {autoCount} created automatically
          </span>
        </div>
        {head && (
          <div className="ml-auto">
            <SegmentedControl
              label="Whose tasks"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'all', label: 'All tasks' },
                { value: 'mine', label: 'Mine' },
              ]}
            />
          </div>
        )}
      </div>

      {!nothingToday && !bannerHidden && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2.5 rounded-card border px-3 py-2.25',
            summary.overdue
              ? 'border-danger-border bg-danger-soft text-danger-text'
              : 'border-accent-border-soft bg-accent-soft text-accent-strong',
          )}
        >
          <BellRing size={18} strokeWidth={1.75} className="shrink-0" />
          <span className="flex-1">
            <b className="font-semibold">{reminderText(summary)}.</b>{' '}
            {summary.overdue
              ? `The oldest has waited ${summary.oldestOverdueDays} ${summary.oldestOverdueDays === 1 ? 'day' : 'days'}. Start with high priority.`
              : 'You are on track.'}
          </span>
          <Button
            size="sm"
            variant={summary.overdue ? 'danger-outline' : 'secondary'}
            onClick={() => setBannerHidden(true)}
          >
            Remind me later
          </Button>
        </div>
      )}

      <QuickAdd
        inputRef={quickRef}
        clients={scoped.clients}
        now={now}
        assigneeFor={(clientId) => userName(ownerOf(clientId))}
        onAdd={addParsed}
      />

      {nothingToday && (
        <Card className="flex flex-col gap-2.5 px-3.5 py-3">
          <div className="flex items-center gap-2 font-semibold text-success-fg">
            <CircleCheckBig size={18} strokeWidth={1.75} />
            Nothing left for today
          </div>
          {nudges.length === 0 && (
            <div className="text-control text-text-secondary">
              Every client was contacted in the last week. A good moment to review the pipeline.
            </div>
          )}
          {nudges.length > 0 && (
            <div className="text-control text-text-secondary">
              These clients haven’t heard from you in a while:
            </div>
          )}
          <ul className="flex flex-col">
            {nudges.map((n) => (
              <li
                key={n.client.id}
                className="flex items-center gap-3 border-t border-border-row py-2"
              >
                <Link
                  href={clientHref(n.client.id)}
                  className="min-w-0 flex-1 truncate font-medium hover:text-accent"
                >
                  {n.client.name}
                </Link>
                <span
                  className={cn(
                    'text-sm',
                    (n.days ?? Infinity) >= STALE_CONTACT_DAYS
                      ? 'text-danger'
                      : 'text-text-tertiary',
                  )}
                >
                  {n.lastContact
                    ? `last contact ${formatRelativeDay(n.lastContact, now)}`
                    : 'never contacted'}
                </span>
                <Button size="sm" icon={Phone} onClick={() => planCall(n.client.id, n.client.name)}>
                  Plan a call
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {groups.map((g) => {
        const open = g.rows.length;
        return (
          <Card key={g.key} className="overflow-hidden">
            <div className="flex h-group-header items-center gap-2 border-b border-border-subtle bg-surface-subtle px-3.5">
              <h2
                className={cn('font-semibold', g.key === 'overdue' ? 'text-danger' : 'text-text')}
              >
                {g.label}
                {g.date && ` · ${formatDate(g.date)}`}
              </h2>
              <span className="text-meta text-text-muted tabular-nums">{open}</span>
            </div>
            <div role="table" aria-label={g.label}>
              <div role="row" className={cn('sr-only grid', taskColumns(Boolean(assignees)))}>
                <span role="columnheader">Done</span>
                <span role="columnheader">Priority</span>
                <span role="columnheader">Task</span>
                <span role="columnheader">Client</span>
                <span role="columnheader">Deal</span>
                {assignees && <span role="columnheader">Assignee</span>}
                <span role="columnheader">Due</span>
                <span role="columnheader">Snooze</span>
              </div>
              {g.rows.map((row) => (
                <TaskRowView
                  key={row.task.id}
                  row={row}
                  now={now}
                  assignees={assignees}
                  completing={completing.has(row.task.id)}
                  onComplete={() => complete(row.task)}
                  onSnooze={(due) => snooze(row.task, due)}
                  onReassign={(userId) => reassign(row.task, userId)}
                />
              ))}
            </div>
          </Card>
        );
      })}

      {groups.length === 0 && (
        <div className="py-10 text-center text-text-muted">
          All done. New tasks will appear automatically.
        </div>
      )}
    </div>
  );
}
