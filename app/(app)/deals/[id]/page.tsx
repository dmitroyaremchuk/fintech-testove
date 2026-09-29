'use client';

import { useParams, useRouter } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Button, EmptyState } from '@/src/components/ui';
import { DealScreen } from '@/src/components/deal/DealScreen';
import { AccessDenied } from '@/src/components/shell/AccessDenied';
import { canViewDeal, findUser, useDataStore, useScopedData } from '@/src/lib/data';

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const data = useDataStore((s) => s.data);
  const scoped = useScopedData();
  const session = useDataStore((s) => s.session);
  const deal = data?.deals.find((d) => d.id === id);
  const client = deal && data?.clients.find((c) => c.id === deal.clientId);

  if (!data || !scoped) return null;
  if (!deal || !client) {
    // Copy from the design's deal empty state.
    return (
      <EmptyState
        icon={<SearchX size={22} strokeWidth={1.75} />}
        title="Deal not found"
        description="It may have been deleted or handed to another manager."
        actions={
          <Button variant="primary" onClick={() => router.push('/pipeline')}>
            To pipeline
          </Button>
        }
      />
    );
  }
  if (!canViewDeal(session, deal)) {
    return (
      <AccessDenied
        title={`${client.name} · ${deal.product}`}
        ownerName={findUser(data, deal.ownerId)?.name ?? 'another manager'}
        backHref="/pipeline"
        backLabel="Back to my pipeline"
      />
    );
  }
  return <DealScreen dealId={deal.id} data={data} scoped={scoped} session={session} />;
}
