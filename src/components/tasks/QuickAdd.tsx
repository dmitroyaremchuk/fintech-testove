import { useMemo, useState, type RefObject } from 'react';
import { Building2, CalendarDays, CirclePlus, Flag, Tag, User } from 'lucide-react';
import { Button, TokenChip } from '@/src/components/ui';
import { TASK_PRIORITIES } from '@/src/lib/constants';
import { formatDue } from '@/src/lib/format';
import { parseQuickTask, type ParsedQuickTask } from '@/src/lib/rules/quickTask';
import type { Client } from '@/src/lib/types';
import { cn } from '@/src/lib/cn';

const TYPE_LABEL = {
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
  document: 'Document',
  follow_up: 'Follow-up',
  invoice: 'Invoice',
  other: 'Task',
} as const;

export interface QuickAddProps {
  inputRef: RefObject<HTMLInputElement | null>;
  clients: Client[];
  now: Date;
  /** Who the task will go to, for the preview. */
  assigneeFor: (clientId: string | null) => string;
  onAdd: (parsed: ParsedQuickTask) => void;
}

/** "Call Agro-Skhid tomorrow 15:00" → preview of what was understood → Enter creates the task. */
export function QuickAdd({ inputRef, clients, now, assigneeFor, onAdd }: QuickAddProps) {
  const [text, setText] = useState('');
  const parsed = useMemo(
    () => (text.trim() ? parseQuickTask(text, { now, clients }) : null),
    [text, now, clients],
  );
  const client = parsed?.clientId ? clients.find((c) => c.id === parsed.clientId) : undefined;

  const add = () => {
    if (!parsed) return;
    onAdd(parsed);
    setText('');
  };

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border-strong bg-surface px-2.5 py-2 transition-colors focus-within:border-accent">
      <div className="flex items-center gap-2">
        <CirclePlus size={18} strokeWidth={1.75} className="shrink-0 text-accent" />
        <input
          ref={inputRef}
          aria-label="Quick task"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
            if (e.key === 'Escape') setText('');
          }}
          placeholder="Quick task: “Call Agro-Skhid tomorrow 15:00”"
          className="h-control-md min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-faint"
        />
        <Button size="md" variant="primary" disabled={!parsed} onClick={add}>
          Add
        </Button>
      </div>
      {parsed && (
        <div className="flex flex-wrap gap-1.5 pl-6.5" aria-live="polite">
          <TokenChip icon={<Tag size={13} />}>{TYPE_LABEL[parsed.type]}</TokenChip>
          <TokenChip icon={<CalendarDays size={13} />} muted={!parsed.due}>
            {parsed.due ? formatDue(parsed.due, now) : 'No date'}
          </TokenChip>
          <TokenChip icon={<Building2 size={13} />} muted={!client}>
            {client?.name ?? 'Client not recognized'}
          </TokenChip>
          <TokenChip icon={<User size={13} />}>{assigneeFor(parsed.clientId)}</TokenChip>
          {parsed.priority !== 'med' && (
            <TokenChip icon={<Flag size={13} />}>
              <span className={cn(parsed.priority === 'high' && 'text-danger')}>
                {TASK_PRIORITIES[parsed.priority].label}
              </span>
            </TokenChip>
          )}
        </div>
      )}
    </div>
  );
}
