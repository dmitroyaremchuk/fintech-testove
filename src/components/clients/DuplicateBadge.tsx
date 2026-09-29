import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Popover, toneClasses } from '@/src/components/ui';
import type { DuplicateMatch } from '@/src/lib/data/duplicates';
import { cn } from '@/src/lib/cn';
import { clientHref } from '../shell/routes';

export interface DuplicateBadgeProps {
  code: string;
  matches: DuplicateMatch[];
  /** Head merges; managers can only ask the head to. */
  canMerge: boolean;
  onMerge: (other: DuplicateMatch) => void;
  onRequestMerge: (other: DuplicateMatch) => void;
}

/** "Duplicate" flag in a client row. Opens the matching records with the Merge action. */
export function DuplicateBadge({
  code,
  matches,
  canMerge,
  onMerge,
  onRequestMerge,
}: DuplicateBadgeProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <span onClick={stop} onKeyDown={stop} className="shrink-0">
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        className="w-76 p-3"
        anchor={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            title="Same EDRPOU as another record"
            className={cn(
              'rounded-badge px-1.5 py-px text-micro font-medium',
              'focus-visible:outline-none focus-visible:shadow-focus hover:brightness-95',
              toneClasses.amber,
            )}
          >
            Duplicate
          </button>
        }
      >
        <div className="flex flex-col gap-2.5 text-control">
          <div className="text-meta text-text-muted">
            EDRPOU <span className="font-mono">{code}</span> is also used by:
          </div>
          {matches.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-input border border-border p-2.5"
            >
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-meta text-text-tertiary">
                  Owner: {m.ownerName} · source: {m.leadSource.toLowerCase()}
                </div>
              </div>
              <div className="flex gap-1.5">
                {canMerge ? (
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => {
                      setOpen(false);
                      onMerge(m);
                    }}
                  >
                    Merge records
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => {
                      setOpen(false);
                      onRequestMerge(m);
                    }}
                  >
                    Request merge
                  </Button>
                )}
                {m.canView && (
                  <Button size="sm" onClick={() => router.push(clientHref(m.id))}>
                    Open
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!canMerge && (
            <div className="text-meta text-text-faint">
              Only the head of department can merge records.
            </div>
          )}
        </div>
      </Popover>
    </span>
  );
}
