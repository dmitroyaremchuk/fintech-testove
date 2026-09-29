'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button, useToast } from '@/src/components/ui';

export interface AccessDeniedProps {
  /** Record title, e.g. the client's name. */
  title: string;
  ownerName: string;
  backHref: string;
  backLabel: string;
}

/** A manager opened someone else's record (AGENTS.md → Roles and access). */
export function AccessDenied({ title, ownerName, backHref, backLabel }: AccessDeniedProps) {
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="mx-auto mt-24 flex max-w-105 flex-col items-center gap-2.5 rounded-modal border border-border bg-surface p-7 text-center">
      <span className="flex size-11 items-center justify-center rounded-modal bg-surface-muted text-text-secondary">
        <Lock size={22} strokeWidth={1.75} />
      </span>
      <div className="text-heading font-semibold">{title}</div>
      <div className="text-text-tertiary">
        Owned by: <b className="font-medium text-text">{ownerName}</b>
      </div>
      <div className="text-pretty text-sm text-text-muted">
        Managers only see their own clients. Ask the owner or the head of department for access.
      </div>
      <div className="mt-1.5 flex gap-2">
        <Button onClick={() => router.push(backHref)}>{backLabel}</Button>
        <Button
          variant="primary"
          onClick={() => toast.show({ message: `Access request sent to ${ownerName}` })}
        >
          Request access
        </Button>
      </div>
    </div>
  );
}
