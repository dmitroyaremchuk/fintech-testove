'use client';

import type { ReactNode } from 'react';
import { Construction, Inbox } from 'lucide-react';
import { Button, Card, EmptyState } from '@/src/components/ui';
import { useDataStore } from '@/src/lib/data';
import type { Section } from './routes';

// Empty-state copy from the design (?state=empty).
const EMPTY: Record<Section | 'client' | 'deal', [title: string, text: string, cta: string]> = {
  dashboard: [
    'No dashboard data yet',
    'Metrics appear once you add your first client and deal.',
    'Add client',
  ],
  clients: [
    'No clients yet',
    'Create a client manually or import from Excel. EDRPOU duplicates are checked automatically.',
    'New client',
  ],
  client: [
    'No interactions yet',
    'Add a note or log a call — history will appear here.',
    'Add note',
  ],
  pipeline: [
    'Pipeline is empty',
    'Deals are created from the client card. New leads land here automatically.',
    'New deal',
  ],
  deal: ['Deal not found', 'It may have been deleted or handed to another manager.', 'To pipeline'],
  tasks: [
    'All done',
    'No new tasks. The system creates them automatically on stage changes and bank decisions.',
    'Create task',
  ],
  team: ['Team is empty', 'Add managers to see workload.', 'Invite'],
};

export interface ScreenPlaceholderProps {
  screen: keyof typeof EMPTY;
  title: string;
  /** Plan phase that builds this screen, e.g. "Phase 3". */
  phase: string;
  children?: ReactNode;
}

/** Temporary page body until the real screen is built. Honors ?state=empty with the design copy. */
export function ScreenPlaceholder({ screen, title, phase, children }: ScreenPlaceholderProps) {
  const screenState = useDataStore((s) => s.screenState);
  if (screenState === 'empty') {
    const [emptyTitle, text, cta] = EMPTY[screen];
    return (
      <EmptyState
        icon={<Inbox size={22} strokeWidth={1.75} />}
        title={emptyTitle}
        description={text}
        actions={<Button variant="primary">{cta}</Button>}
      />
    );
  }
  return (
    <div className="flex max-w-content flex-col gap-3.5 px-6 pt-5 pb-8">
      <h1 className="text-title font-semibold">{title}</h1>
      {children}
      <Card>
        <EmptyState
          variant="inline"
          icon={<Construction size={24} strokeWidth={1.75} />}
          title={`${title} screen comes next`}
          description={`Placeholder — built in ${phase} of docs/PLAN.md.`}
        />
      </Card>
    </div>
  );
}
