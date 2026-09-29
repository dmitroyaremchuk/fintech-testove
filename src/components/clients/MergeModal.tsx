import { useState } from 'react';
import { Button, Modal } from '@/src/components/ui';
import type { ClientRow } from '@/src/lib/data/clients';
import { formatRelativeDay } from '@/src/lib/format';
import { cn } from '@/src/lib/cn';

export interface MergeModalProps {
  /** The two records; the one with more open deals is kept by default. */
  pair: [ClientRow, ClientRow];
  now: Date;
  onCancel: () => void;
  onConfirm: (keepId: string, removeId: string) => void;
}

export function MergeModal({ pair, now, onCancel, onConfirm }: MergeModalProps) {
  const [a, b] = pair;
  const [keepId, setKeepId] = useState(a.openDeals >= b.openDeals ? a.client.id : b.client.id);
  const remove = keepId === a.client.id ? b : a;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Merge duplicate records"
      subtitle={`Both use EDRPOU ${a.client.code}`}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(keepId, remove.client.id)}>
            Merge records
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Record to keep" className="flex flex-col gap-1.5">
        <div className="mb-0.5 text-sm text-text-tertiary">Choose the record to keep.</div>
        {pair.map((row) => {
          const checked = row.client.id === keepId;
          return (
            <label
              key={row.client.id}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-input border px-2.5 py-2 transition-colors',
                'has-[:focus-visible]:shadow-focus',
                checked
                  ? 'border-accent bg-accent-softer'
                  : 'border-border-strong hover:bg-surface-hover',
              )}
            >
              <input
                type="radio"
                name="keep"
                value={row.client.id}
                checked={checked}
                onChange={() => setKeepId(row.client.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px]',
                  checked ? 'border-accent' : 'border-border-checkbox',
                )}
              >
                {checked && <span className="size-1.5 rounded-full bg-accent" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{row.client.name}</span>
                <span className="text-meta text-text-tertiary">
                  {row.owner?.name} · source: {row.client.leadSource.toLowerCase()} ·{' '}
                  {row.openDeals} open {row.openDeals === 1 ? 'deal' : 'deals'} · last contact{' '}
                  {row.lastContact ? formatRelativeDay(row.lastContact, now) : 'never'}
                </span>
              </span>
            </label>
          );
        })}
        <div className="mt-1.5 text-sm text-pretty text-text-tertiary">
          Deals, interaction history and tasks of “{remove.client.name}” move to the record you
          keep. Moved deals go to its owner. You can undo right after merging.
        </div>
      </div>
    </Modal>
  );
}
