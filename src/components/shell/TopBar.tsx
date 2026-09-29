'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Building2, ChevronDown, ListPlus, Plus, UserPlus } from 'lucide-react';
import {
  Button,
  Menu,
  MenuItem,
  Popover,
  SegmentedControl,
  Select,
  Skeleton,
} from '@/src/components/ui';
import { findUser, useDataStore, useScopedData } from '@/src/lib/data';
import { reminderSummaryFor, reminderText } from '@/src/lib/data/tasks';
import { useNow } from '@/src/lib/hooks/useNow';
import { cn } from '@/src/lib/cn';
import type { Role } from '@/src/lib/types';
import { GlobalSearch } from './GlobalSearch';
import { crumbsFor } from './routes';

export function TopBar() {
  return (
    <header className="flex min-w-0 items-center gap-3 border-b border-border bg-surface px-5">
      <Breadcrumbs />
      <GlobalSearch />
      <RoleSwitcher />
      <QuickAction />
      <NotificationBell />
    </header>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const role = useDataStore((s) => s.session.role);
  const data = useDataStore((s) => s.data);
  // Detail titles come from the full dataset: a manager without access still sees whose record it is.
  const id = pathname.split('/')[2];
  let entity: string | undefined;
  if (data && id && pathname.startsWith('/clients/')) {
    entity = data.clients.find((c) => c.id === id)?.name;
  } else if (data && id && pathname.startsWith('/deals/')) {
    const deal = data.deals.find((d) => d.id === id);
    const client = deal && data.clients.find((c) => c.id === deal.clientId);
    if (deal && client) entity = `${client.name} · ${deal.product}`;
  }
  const crumbs = crumbsFor(pathname, role, entity);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
      <Link
        href={crumbs.parent.href}
        className="whitespace-nowrap text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:shadow-focus"
      >
        {crumbs.parent.label}
      </Link>
      <span aria-hidden className="text-text-separator">
        /
      </span>
      <span aria-current="page" title={crumbs.current} className="truncate font-medium">
        {crumbs.current}
      </span>
    </nav>
  );
}

function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useDataStore((s) => s.session);
  const lastManagerId = useDataStore((s) => s.lastManagerId);
  const setSession = useDataStore((s) => s.setSession);
  const data = useDataStore((s) => s.data);
  const hydrated = useDataStore((s) => s.hydrated);
  const users = data?.users ?? [];
  const managers = users.filter((u) => u.role === 'manager');
  const headId = users.find((u) => u.role === 'head')?.id;

  const onRole = (role: Role) => {
    if (role === 'head' && headId) setSession({ role, userId: headId });
    if (role === 'manager') setSession({ role, userId: lastManagerId });
    // Team is head-only: leaving the role leaves the page, as in the design.
    if (role === 'manager' && pathname.startsWith('/team')) router.replace('/');
  };

  return (
    <div className={cn('flex items-center gap-3', !hydrated && 'invisible')}>
      <SegmentedControl
        label="Role"
        emphasis
        value={session.role}
        onChange={onRole}
        options={[
          { value: 'manager', label: 'Manager', attrs: { 'data-role-option': 'manager' } },
          { value: 'head', label: 'Head', attrs: { 'data-role-option': 'head' } },
        ]}
      />
      {session.role === 'manager' && (
        <label className="flex items-center gap-1.5 text-sm text-text-muted">
          Log in as
          {managers.length === 0 ? (
            <Skeleton className="h-control w-38 rounded-control" />
          ) : (
            <Select
              value={session.userId}
              onChange={(e) => setSession({ role: 'manager', userId: e.target.value })}
              className="w-38"
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          )}
        </label>
      )}
    </div>
  );
}

function QuickAction() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      className="w-48"
      anchor={
        <Button
          variant="primary"
          icon={Plus}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          New
          <ChevronDown size={14} strokeWidth={2} className="-mr-1 opacity-80" />
        </Button>
      }
    >
      <Menu label="Create">
        <MenuItem icon={UserPlus} onSelect={() => go('/clients?new=lead')}>
          New lead
        </MenuItem>
        <MenuItem icon={Building2} onSelect={() => go('/clients?new=client')}>
          New client
        </MenuItem>
        <MenuItem icon={ListPlus} onSelect={() => go('/tasks?new=task')}>
          New task
        </MenuItem>
      </Menu>
    </Popover>
  );
}

function NotificationBell() {
  const data = useScopedData();
  const session = useDataStore((s) => s.session);
  const now = useNow();
  // Same numbers and wording as the reminder banner on the Tasks screen, for the signed-in user.
  const summary = data ? reminderSummaryFor(data, session.userId, now) : null;
  const count = summary ? summary.today + summary.overdue : 0;
  const who = data ? findUser(data, session.userId)?.name : undefined;
  const label = summary ? `Reminders: ${reminderText(summary)}` : 'Reminders';
  return (
    <Link
      href="/tasks"
      aria-label={label}
      title={who ? `${label} · ${who}` : label}
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-text-secondary transition-colors',
        'hover:bg-bg focus-visible:outline-none focus-visible:shadow-focus',
      )}
    >
      <Bell size={18} strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -top-1.25 -right-1.25 flex h-4.25 min-w-4.25 items-center justify-center rounded-full border-2 border-surface bg-danger-dot px-1 text-tiny font-semibold text-white tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}
