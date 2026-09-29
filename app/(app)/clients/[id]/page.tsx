'use client';

import { useParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/src/components/ui';
import { AccessDenied } from '@/src/components/shell/AccessDenied';
import { ScreenPlaceholder } from '@/src/components/shell/ScreenPlaceholder';
import { canViewClient, findUser, useDataStore } from '@/src/lib/data';

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const data = useDataStore((s) => s.data);
  const session = useDataStore((s) => s.session);
  const client = data?.clients.find((c) => c.id === id);

  if (!data) return null;
  if (!client) {
    return (
      <EmptyState
        icon={<SearchX size={22} strokeWidth={1.75} />}
        title="Client not found"
        description="It may have been merged with another record or removed."
      />
    );
  }
  if (!canViewClient(session, client)) {
    return (
      <AccessDenied
        title={client.name}
        ownerName={findUser(data, client.ownerId)?.name ?? 'another manager'}
        backHref="/clients"
        backLabel="Back to my clients"
      />
    );
  }
  return <ScreenPlaceholder screen="client" title={client.name} phase="Phase 3" />;
}
