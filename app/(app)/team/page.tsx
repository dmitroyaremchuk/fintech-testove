'use client';

import { AccessDenied } from '@/src/components/shell/AccessDenied';
import { TeamScreen } from '@/src/components/team/TeamScreen';
import { canViewTeam, useDataStore } from '@/src/lib/data';

export default function TeamPage() {
  const session = useDataStore((s) => s.session);
  const data = useDataStore((s) => s.data);
  const hydrated = useDataStore((s) => s.hydrated);

  if (!hydrated || !data) return null;
  if (!canViewTeam(session)) {
    const head = data.users.find((u) => u.role === 'head');
    return (
      <AccessDenied
        title="Team"
        description="Team workload and reassignment are available to the head of department only."
        requestTo={head?.name}
        backHref="/"
        backLabel="Back to my dashboard"
      />
    );
  }
  return <TeamScreen data={data} />;
}
