import { useState } from 'react';
import Link from 'next/link';
import { AlarmClock } from 'lucide-react';
import {
  AutoTag,
  Button,
  Checkbox,
  Menu,
  MenuItem,
  MenuLabel,
  Popover,
  Select,
  TextInput,
  Tooltip,
  Truncate,
} from '@/src/components/ui';
import { TASK_PRIORITIES } from '@/src/lib/constants';
import type { TaskRow } from '@/src/lib/data/tasks';
import { formatDueShort, formatMoneyCompact } from '@/src/lib/format';
import { dueFromPreset } from '@/src/lib/rules/tasks';
import type { User } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';
import { clientHref, dealHref } from '../shell/routes';

export function taskColumns(showAssignee: boolean): string {
  return showAssignee
    ? 'grid-cols-[18px_8px_minmax(0,1fr)_140px_140px_150px_110px_96px]'
    : 'grid-cols-[18px_8px_minmax(0,1fr)_150px_150px_120px_96px]';
}

export interface TaskRowViewProps {
  row: TaskRow;
  now: Date;
  /** Head: assignee select for reassigning. */
  assignees: User[] | null;
  completing: boolean;
  onComplete: () => void;
  onSnooze: (due: Date) => void;
  onReassign: (userId: string) => void;
}

export function TaskRowView({
  row,
  now,
  assignees,
  completing,
  onComplete,
  onSnooze,
  onReassign,
}: TaskRowViewProps) {
  const { task, client, deal, overdue } = row;
  const priority = TASK_PRIORITIES[task.priority];
  return (
    <div
      role="row"
      className={cn(
        'grid min-h-row-task items-center gap-2.5 border-b border-border-row px-3.5 transition-[opacity,background-color] duration-300 last:border-b-0',
        'hover:bg-surface-hover-task',
        taskColumns(Boolean(assignees)),
        completing && 'bg-success-softer opacity-50',
      )}
    >
      <span role="cell">
        <Checkbox
          checked={completing}
          label={`Mark “${task.title}” as done`}
          onChange={onComplete}
        />
      </span>
      <span role="cell">
        <Tooltip content={priority.label}>
          <span className="block size-1.75 rounded-full" style={{ background: priority.color }} />
          <span className="sr-only">{priority.label}</span>
        </Tooltip>
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-2">
        <Truncate className={cn('transition-colors', completing && 'text-text-faint line-through')}>
          {task.title}
        </Truncate>
        {task.source === 'auto' && <AutoTag />}
      </span>
      <span role="cell" className="min-w-0 text-control">
        {client ? (
          <Link
            href={clientHref(client.id)}
            className="block truncate text-text-secondary hover:text-accent"
            title={client.name}
          >
            {client.name}
          </Link>
        ) : (
          <span className="text-text-disabled">—</span>
        )}
      </span>
      <span role="cell" className="min-w-0 text-sm">
        {deal ? (
          <Link
            href={dealHref(deal.id)}
            className="block truncate text-text-muted tabular-nums hover:text-accent"
            title={deal.purpose}
          >
            {deal.product} · {formatMoneyCompact(deal.requestedAmount)}
          </Link>
        ) : (
          <span className="text-text-disabled">—</span>
        )}
      </span>
      {assignees && (
        <span role="cell">
          <Select
            size="sm"
            aria-label={`Assignee of “${task.title}”`}
            value={task.assigneeId}
            onChange={(e) => onReassign(e.target.value)}
            className="w-full"
          >
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </span>
      )}
      <span
        role="cell"
        className={cn(
          'text-sm whitespace-nowrap tabular-nums',
          overdue ? 'text-danger' : 'text-text-tertiary',
        )}
      >
        {task.dueAt ? formatDueShort(new Date(task.dueAt), now) : '—'}
      </span>
      <span role="cell" className="flex justify-end">
        <SnoozeMenu now={now} onSnooze={onSnooze} />
      </span>
    </div>
  );
}

function SnoozeMenu({ now, onSnooze }: { now: Date; onSnooze: (due: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [value, setValue] = useState('');
  const close = () => {
    setOpen(false);
    setCustom(false);
    setValue('');
  };
  const pick = (due: Date) => {
    close();
    onSnooze(due);
  };
  return (
    <Popover
      portal
      open={open}
      onClose={close}
      align="right"
      className="w-60"
      anchor={
        <Button
          size="xs"
          icon={AlarmClock}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          Snooze
        </Button>
      }
    >
      {custom ? (
        <form
          className="flex flex-col gap-2 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const due = new Date(value);
            if (!Number.isNaN(due.getTime()) && due > now) pick(due);
          }}
        >
          <label className="text-meta text-text-muted" htmlFor="snooze-custom">
            New date and time
          </label>
          <TextInput
            id="snooze-custom"
            size="sm"
            type="datetime-local"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => setCustom(false)}>
              Back
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={!value || new Date(value) <= now}
            >
              Snooze
            </Button>
          </div>
        </form>
      ) : (
        <Menu label="Snooze until">
          <MenuLabel>Snooze until</MenuLabel>
          <MenuItem onSelect={() => pick(dueFromPreset('tomorrow', now))} hint="10:00">
            Tomorrow
          </MenuItem>
          <MenuItem onSelect={() => pick(dueFromPreset('nextWeek', now))} hint="Mon 10:00">
            Next week
          </MenuItem>
          <MenuItem onSelect={() => setCustom(true)}>Custom date…</MenuItem>
        </Menu>
      )}
    </Popover>
  );
}
