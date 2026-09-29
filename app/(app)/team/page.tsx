'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenPlaceholder } from '@/src/components/shell/ScreenPlaceholder';
import { useDataStore } from '@/src/lib/data';

/** Head only. Managers are sent to the dashboard (the nav item is hidden for them anyway). */
export default function TeamPage() {
  const router = useRouter();
  const role = useDataStore((s) => s.session.role);
  const hydrated = useDataStore((s) => s.hydrated);
  const isHead = hydrated && role === 'head';

  useEffect(() => {
    if (hydrated && role !== 'head') router.replace('/');
  }, [hydrated, role, router]);

  if (!isHead) return null;
  return <ScreenPlaceholder screen="team" title="Team" phase="Phase 6" />;
}
