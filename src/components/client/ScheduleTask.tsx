import { useState, type ReactNode } from 'react';
import { Button, Field, Popover, Select, TextInput } from '@/src/components/ui';
import { DUE_PRESETS, type DuePreset } from '@/src/lib/rules/tasks';
import type { Deal } from '@/src/lib/types';

export interface ScheduleTaskInput {
  title: string;
  preset: DuePreset;
  dealId: string | null;
}

export interface ScheduleTaskProps {
  /** The trigger; receives `open` and `toggle`. */
  anchor: (open: boolean, toggle: () => void) => ReactNode;
  suggestedTitle: string;
  deals: Deal[];
  onCreate: (input: ScheduleTaskInput) => void;
  align?: 'left' | 'right';
}

/** Small inline form to plan the next step without leaving the card. */
export function ScheduleTask({
  anchor,
  suggestedTitle,
  deals,
  onCreate,
  align = 'right',
}: ScheduleTaskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState<DuePreset>('tomorrow');
  const [dealId, setDealId] = useState<string>(deals[0]?.id ?? '');

  const submit = () => {
    onCreate({ title: title.trim() || suggestedTitle, preset, dealId: dealId || null });
    setOpen(false);
    setTitle('');
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align={align}
      className="w-76 p-3"
      anchor={anchor(open, () => setOpen((v) => !v))}
    >
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Task">
          {({ id }) => (
            <TextInput
              id={id}
              autoFocus
              placeholder={suggestedTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label="Due">
          {({ id }) => (
            <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value as DuePreset)}>
              {DUE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {deals.length > 0 && (
          <Field label="Deal">
            {({ id }) => (
              <Select id={id} value={dealId} onChange={(e) => setDealId(e.target.value)}>
                <option value="">No deal</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.product} · {d.purpose}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button size="md" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="md" variant="primary" type="submit">
            Create task
          </Button>
        </div>
      </form>
    </Popover>
  );
}
