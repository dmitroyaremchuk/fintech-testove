'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ListPlus, Mail, NotebookPen, Phone, Plus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Menu,
  MenuItem,
  MenuLabel,
  Popover,
  useToast,
} from '@/src/components/ui';
import { CLIENT_STATUSES } from '@/src/lib/constants';
import { canReassign, findUser, useDataStore, type Dataset, type Session } from '@/src/lib/data';
import { clientLtv, nextStep, openDealsOf, openTasksOf } from '@/src/lib/data/clientCard';
import {
  addInteraction,
  addTask,
  createDeal,
  reassignClient,
  setTaskStatus,
  updateClient,
} from '@/src/lib/data/mutations';
import { formatDue, formatRegion } from '@/src/lib/format';
import { useNow } from '@/src/lib/hooks/useNow';
import { validateClientField, type EditableClientField } from '@/src/lib/rules/clients';
import { codeLabel } from '@/src/lib/rules/duplicates';
import { dueFromPreset } from '@/src/lib/rules/tasks';
import type { Client, User } from '@/src/lib/types';
import { NewDealModal } from './NewDealModal';
import { ScheduleTask, type ScheduleTaskInput } from './ScheduleTask';
import {
  ContactsCard,
  DetailsCard,
  LtvCard,
  NextStepCard,
  OpenDealsCard,
  OpenTasksCard,
} from './SideCards';
import { Timeline } from './Timeline';

const FIELD_LABEL: Record<EditableClientField, string> = {
  code: 'EDRPOU',
  industry: 'Industry',
  region: 'Region',
  annualTurnover: 'Annual turnover',
  businessAgeYears: 'Business age',
  leadSource: 'Lead source',
};

export interface ClientCardProps {
  client: Client;
  /** Full dataset: mutations apply to it. */
  data: Dataset;
  /** Role-scoped dataset: everything shown comes from it. */
  scoped: Dataset;
  session: Session;
}

export function ClientCard({ client, data, scoped, session }: ClientCardProps) {
  const toast = useToast();
  const commit = useDataStore((s) => s.commit);
  const now = useNow();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [newDeal, setNewDeal] = useState(false);

  const deals = useMemo(() => openDealsOf(scoped, client.id), [scoped, client.id]);
  const tasks = useMemo(() => openTasksOf(scoped, client.id), [scoped, client.id]);
  const step = useMemo(() => nextStep(scoped, client.id, now), [scoped, client.id, now]);
  const ltv = useMemo(() => clientLtv(scoped, client.id), [scoped, client.id]);
  const contact = client.contacts[0];
  const firstName = contact?.name.split(' ')[0] ?? client.name;

  /** Commit a change and offer Undo back to the dataset before it. */
  const commitWithUndo = (next: Dataset, message: string) => {
    const previous = data;
    commit(next);
    toast.show({ message, onUndo: () => commit(previous) });
  };

  const onAddNote = (text: string) => {
    const { data: next } = addInteraction(
      data,
      { clientId: client.id, dealId: null, type: 'note', summary: text, authorId: session.userId },
      now,
    );
    commit(next);
  };

  const onCall = () => {
    if (!contact) return;
    const { data: next } = addInteraction(
      data,
      {
        clientId: client.id,
        dealId: deals[0]?.id ?? null,
        type: 'call',
        summary: `Outgoing call: ${contact.name}, ${contact.phone}. Add a note with the outcome.`,
        authorId: session.userId,
      },
      now,
    );
    commitWithUndo(next, 'Call logged to history');
    noteRef.current?.focus();
  };

  const onSchedule = (input: ScheduleTaskInput) => {
    const due = dueFromPreset(input.preset, now);
    const { data: next } = addTask(data, {
      title: input.title,
      type: /call/i.test(input.title) ? 'call' : 'other',
      clientId: client.id,
      dealId: input.dealId,
      assigneeId: client.ownerId,
      dueAt: due,
      priority: 'med',
    });
    commitWithUndo(next, `Task scheduled · ${formatDue(due, now)}`);
  };

  const onSaveField = (field: EditableClientField, raw: string) => {
    const result = validateClientField(field, raw, client, data.clients);
    if (result.ok) {
      const label = field === 'code' ? codeLabel(client.legalForm) : FIELD_LABEL[field];
      commitWithUndo(updateClient(data, client.id, result.patch), `${label} updated`);
    }
    return result;
  };

  const schedule = (label: string, align: 'left' | 'right') => (
    <ScheduleTask
      suggestedTitle={`Call ${firstName}`}
      deals={deals}
      onCreate={onSchedule}
      align={align}
      anchor={(open, toggle) => (
        <Button
          size={label === 'Task' ? 'lg' : 'sm'}
          variant={label === 'Task' ? 'secondary' : 'accent-outline'}
          icon={label === 'Task' ? ListPlus : undefined}
          aria-expanded={open}
          onClick={toggle}
        >
          {label}
        </Button>
      )}
    />
  );

  return (
    <div className="flex max-w-content flex-col gap-3.5 px-6 pt-4 pb-8">
      <Card className="flex items-center gap-3.5 p-4">
        <Avatar name={client.name} shape="square" size="2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.25">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-title font-semibold" title={client.name}>
              {client.name}
            </h1>
            <Badge tone="gray">{client.legalForm}</Badge>
            <Badge tone={CLIENT_STATUSES[client.status].tone}>
              {CLIENT_STATUSES[client.status].label}
            </Badge>
            {client.tags.map((tag) => (
              <Badge key={tag} tone={tag === 'Repeat' ? 'teal' : 'violet'}>
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2.5 text-control text-text-tertiary">
            <span className="truncate">
              {codeLabel(client.legalForm)} <span className="font-mono">{client.code}</span> ·{' '}
              {client.industry} · {formatRegion(client.region)}
            </span>
            <OwnerControl
              client={client}
              data={data}
              session={session}
              onChange={(ownerId) => {
                const { data: next, moved } = reassignClient(data, client.id, ownerId, now);
                const name = findUser(data, ownerId)?.name;
                const extra = moved.deals
                  ? ` · ${moved.deals} open ${moved.deals === 1 ? 'deal' : 'deals'} moved`
                  : '';
                commitWithUndo(next, `Owner changed to ${name}${extra}`);
              }}
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            icon={Phone}
            onClick={onCall}
            disabled={!contact}
            title={contact ? `Log a call to ${contact.name}` : undefined}
          >
            Call
          </Button>
          <Button
            icon={Mail}
            disabled={!contact?.email}
            title={contact?.email ? `Write to ${contact.email}` : 'No email for this contact'}
            onClick={() => {
              if (contact?.email) window.location.href = `mailto:${contact.email}`;
            }}
          >
            Email
          </Button>
          <Button icon={NotebookPen} onClick={() => noteRef.current?.focus()}>
            Note
          </Button>
          {schedule('Task', 'right')}
          <Button variant="primary" icon={Plus} onClick={() => setNewDeal(true)}>
            New deal
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_var(--fp-aside-width)] items-start gap-3.5">
        <Timeline data={scoped} client={client} now={now} noteRef={noteRef} onAddNote={onAddNote} />
        <div className="flex flex-col gap-3">
          <NextStepCard step={step} now={now} schedule={schedule('Schedule', 'right')} />
          <DetailsCard client={client} onSave={onSaveField} />
          <ContactsCard client={client} />
          <OpenDealsCard deals={deals} onNewDeal={() => setNewDeal(true)} />
          <OpenTasksCard
            tasks={tasks}
            now={now}
            onToggle={(task) =>
              commitWithUndo(setTaskStatus(data, task.id, 'done'), 'Task completed')
            }
          />
          <LtvCard ltv={ltv} />
        </div>
      </div>

      {newDeal && (
        <NewDealModal
          clientName={client.name}
          onCancel={() => setNewDeal(false)}
          onCreate={(lead) => {
            const { data: next } = createDeal(data, client.id, lead, now);
            setNewDeal(false);
            commitWithUndo(
              next,
              'Deal created in “New lead” · task “Call tomorrow at 10:00” added',
            );
          }}
        />
      )}
    </div>
  );
}

/** Owner in the header. The head can change it; managers just see it. */
function OwnerControl({
  client,
  data,
  session,
  onChange,
}: {
  client: Client;
  data: Dataset;
  session: Session;
  onChange: (ownerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const owner = findUser(data, client.ownerId);
  const label = (u: User | undefined) => (
    <>
      {u && <Avatar name={u.name} size="xs" tone="accent" />}
      {u?.name ?? 'No owner'}
    </>
  );
  if (!canReassign(session)) {
    return <span className="flex shrink-0 items-center gap-1.5">{label(owner)}</span>;
  }
  const managers = data.users.filter((u) => u.role === 'manager');
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="w-56"
      anchor={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          title="Change owner"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-control-sm px-1 py-0.5 text-text-tertiary transition-colors hover:bg-surface-hover-menu hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
        >
          {label(owner)}
          <ChevronDown size={14} strokeWidth={1.75} />
        </button>
      }
    >
      <Menu label="Change owner">
        <MenuLabel>Owner · deals and open tasks move too</MenuLabel>
        {managers.map((m) => (
          <MenuItem
            key={m.id}
            onSelect={() => {
              setOpen(false);
              onChange(m.id);
            }}
            hint={m.id === client.ownerId ? <Check size={14} strokeWidth={2} /> : undefined}
          >
            {m.name}
          </MenuItem>
        ))}
      </Menu>
    </Popover>
  );
}
