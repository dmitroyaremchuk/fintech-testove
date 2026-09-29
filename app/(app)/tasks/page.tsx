'use client';

import { Suspense } from 'react';
import { TasksScreen } from '@/src/components/tasks/TasksScreen';

export default function TasksPage() {
  return (
    <Suspense>
      <TasksScreen />
    </Suspense>
  );
}
