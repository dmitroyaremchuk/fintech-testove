'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PipelineScreen } from '@/src/components/pipeline/PipelineScreen';

/** Remounts when a sidebar filter or a dashboard owner link changes the query. */
function PipelineRoute() {
  const params = useSearchParams();
  return <PipelineScreen key={`${params.get('filter')}:${params.get('owner')}`} />;
}

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineRoute />
    </Suspense>
  );
}
