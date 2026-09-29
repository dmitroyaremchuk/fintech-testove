'use client';

import { useParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/src/components/ui';
import { ClientCard } from '@/src/components/client/ClientCard';
import { AccessDenied } from '@/src/components/shell/AccessDenied';
import { canViewClient, findUser, useDataStore, useScopedData } from '@/src/lib/data';

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const data = useDataStore((s) => s.data);
  const scoped = useScopedData();
  const session = useDataStore((s) => s.session);
  const client = data?.clients.find((c) => c.id === id);

  if (!data || !scoped) return null;
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
  return <ClientCard client={client} data={data} scoped={scoped} session={session} />;
}
