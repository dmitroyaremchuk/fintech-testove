'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ErrorState, LoadingState, useToast } from '@/src/components/ui';
import { useDataStore } from '@/src/lib/data';
import { formatNumericDateTime } from '@/src/lib/format';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Sidebar + top bar + scrolling main area. Loads the data once and handles load status for every page. */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useDataStore((s) => s.status);
  const load = useDataStore((s) => s.load);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  // The main area scrolls, not the window, so reset it on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="grid h-screen min-w-app grid-cols-[var(--fp-sidebar-width)_minmax(0,1fr)]">
      <Sidebar />
      <div className="grid min-h-0 min-w-0 grid-rows-[var(--fp-topbar-height)_minmax(0,1fr)]">
        <TopBar />
        <main ref={mainRef} className="relative min-h-0 min-w-0 overflow-auto">
          <MainContent>{children}</MainContent>
        </main>
      </div>
    </div>
  );
}

function MainContent({ children }: { children: ReactNode }) {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const load = useDataStore((s) => s.load);
  const toast = useToast();

  if (status === 'ready') return children;
  if (status === 'error') {
    return (
      <ErrorState
        onRetry={() => {
          toast.show({ message: 'Reloading…' });
          void load();
        }}
        onReport={() => toast.show({ message: 'Problem report sent. Thank you!' })}
        code={error ? `code: ${error.code} · ${formatNumericDateTime(error.at)}` : undefined}
      />
    );
  }
  return (
    <div className="px-6 pt-5 pb-8">
      <LoadingState />
    </div>
  );
}
