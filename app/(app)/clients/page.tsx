'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClientsScreen } from '@/src/components/clients/ClientsScreen';

/** Remounts the screen when a sidebar saved filter (?filter=) is chosen, so it starts fresh. */
function ClientsRoute() {
  const filter = useSearchParams().get('filter') ?? 'default';
  return <ClientsScreen key={filter} />;
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsRoute />
    </Suspense>
  );
}
