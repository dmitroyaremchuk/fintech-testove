'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PipelineScreen } from '@/src/components/pipeline/PipelineScreen';

/** Remounts when a sidebar filter or a dashboard owner link changes the query. */
function PipelineRoute() {
  const params = useSearchParams();
  const key = ['filter', 'owner', 'view', 'stage'].map((k) => params.get(k)).join(':');
  return <PipelineScreen key={key} />;
}

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineRoute />
    </Suspense>
  );
}
