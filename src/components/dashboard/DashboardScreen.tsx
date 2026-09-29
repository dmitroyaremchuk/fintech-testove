'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { Button, EmptyState } from '@/src/components/ui';
import { useDataStore, useScopedData } from '@/src/lib/data';
import type { Period } from '@/src/lib/data/metrics';
import { useNow } from '@/src/lib/hooks/useNow';
import { HeadDashboard } from './HeadDashboard';
import { ManagerDashboard } from './ManagerDashboard';

/** Role-specific dashboard. Every number is computed in src/lib/data/metrics.ts. */
export function DashboardScreen() {
  const router = useRouter();
  const scoped = useScopedData();
  const session = useDataStore((s) => s.session);
  const hydrated = useDataStore((s) => s.hydrated);
  const now = useNow();
  const [period, setPeriod] = useState<Period>('month');

  if (!scoped || !hydrated) return null; // the shell shows loading / error
  if (scoped.deals.length === 0 && scoped.clients.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} strokeWidth={1.75} />}
        title="No dashboard data yet"
        description="Metrics appear once you add your first client and deal."
        actions={
          <Button variant="primary" onClick={() => router.push('/clients?new=client')}>
            Add client
          </Button>
        }
      />
    );
  }
  return session.role === 'head' ? (
    <HeadDashboard data={scoped} now={now} period={period} onPeriod={setPeriod} />
  ) : (
    <ManagerDashboard
      scoped={scoped}
      session={session}
      now={now}
      period={period}
      onPeriod={setPeriod}
    />
  );
}
