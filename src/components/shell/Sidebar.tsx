'use client';

import { useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChevronsUpDown,
  CircleCheckBig,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  SquareKanban,
  Users,
} from 'lucide-react';
import {
  Avatar,
  CountBadge,
  Menu,
  MenuItem,
  MenuLabel,
  Popover,
  Skeleton,
  useToast,
} from '@/src/components/ui';
import {
  findUser,
  navCounts,
  repeatClients,
  staleClients,
  stuckDeals,
  useDataStore,
  useScopedData,
  type NavCounts,
} from '@/src/lib/data';
import { useNow } from '@/src/lib/hooks/useNow';
import { cn } from '@/src/lib/cn';
import { SECTION_HREF, sectionFor, type Section } from './routes';

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

const NAV: { section: Section; label: string; icon: Icon; count?: keyof NavCounts }[] = [
  { section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'clients', label: 'Clients', icon: Building2, count: 'clients' },
  { section: 'pipeline', label: 'Pipeline', icon: SquareKanban, count: 'pipeline' },
  { section: 'tasks', label: 'Tasks', icon: CircleCheckBig, count: 'tasks' },
];
const TEAM = { section: 'team' as const, label: 'Team', icon: Users };

export function Sidebar() {
  const pathname = usePathname();
  const active = sectionFor(pathname);
  const data = useScopedData();
  const role = useDataStore((s) => s.session.role);
  const hydrated = useDataStore((s) => s.hydrated);
  const now = useNow();
  const counts = data ? navCounts(data, now) : null;
  const items = hydrated && role === 'head' ? [...NAV, TEAM] : NAV;

  const saved = data
    ? [
        {
          label: 'Deals over SLA',
          href: '/pipeline?filter=over-sla',
          dot: 'bg-danger-dot',
          n: stuckDeals(data, now).length,
        },
        {
          label: 'No contact 14+ days',
          href: '/clients?filter=stale',
          dot: 'bg-stage-docs',
          n: staleClients(data, now).length,
        },
        {
          label: 'Repeat clients',
          href: '/clients?filter=repeat',
          dot: 'bg-stage-decision',
          n: repeatClients(data).length,
        },
      ]
    : [];

  return (
    <aside className="relative flex min-h-0 flex-col border-r border-border bg-surface-subtle">
      <div className="flex items-center gap-2.25 px-4 pt-3.5 pb-2.5">
        <span className="flex size-6 items-center justify-center rounded-control bg-text text-sm font-semibold text-white">
          F
        </span>
        <span className="text-logo font-semibold tracking-[-0.01em]">FundPath</span>
        <span className="ml-auto font-mono text-caption text-text-faint">CRM</span>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-px px-2 py-1.5">
        {items.map(({ section, label, icon: Icon, ...rest }) => {
          const isActive = section === active;
          const count = 'count' in rest && rest.count && counts ? counts[rest.count] : 0;
          return (
            <Link
              key={section}
              href={SECTION_HREF[section]}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-control px-2.5 transition-colors',
                'focus-visible:outline-none focus-visible:shadow-focus',
                isActive
                  ? 'bg-surface-active-nav font-semibold text-text'
                  : 'text-text-secondary hover:bg-surface-hover-nav',
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <CountBadge tone={section === 'tasks' ? 'red' : 'gray'}>{count}</CountBadge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-4.5 pt-3.5 pb-1.5 text-caption font-medium tracking-overline text-text-faint uppercase">
        Saved filters
      </div>
      <div className="flex flex-col gap-px px-2">
        {saved.map((f) => (
          <Link
            key={f.label}
            href={f.href}
            className={cn(
              'flex h-7 items-center gap-2.5 rounded-control px-2.5 text-control text-text-secondary transition-colors',
              'hover:bg-surface-hover-nav focus-visible:outline-none focus-visible:shadow-focus',
            )}
          >
            <span className={cn('size-1.75 shrink-0 rounded-bar', f.dot)} />
            <span className="flex-1 truncate">{f.label}</span>
            <span className="text-caption text-text-faint tabular-nums">{f.n}</span>
          </Link>
        ))}
        {!data && [0, 1, 2].map((i) => <Skeleton key={i} className="mx-2.5 my-2 h-3" />)}
      </div>

      <ProfileMenu />
    </aside>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const data = useDataStore((s) => s.data);
  const session = useDataStore((s) => s.session);
  const reset = useDataStore((s) => s.reset);
  const commit = useDataStore((s) => s.commit);
  const hydrated = useDataStore((s) => s.hydrated);
  const user = data ? findUser(data, session.userId) : undefined;
  const roleLabel = session.role === 'head' ? 'Head of department' : 'Credit manager';

  const onReset = () => {
    setOpen(false);
    const previous = reset();
    toast.show({
      message: 'Demo data reset to initial state',
      onUndo: previous ? () => commit(previous) : undefined,
    });
  };

  const onLogOut = () => {
    setOpen(false);
    toast.show({ message: 'Demo mode: switch users with “Log in as” in the top bar' });
  };

  return (
    <div className="mt-auto border-t border-border-sidebar-footer p-2.5">
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        side="top"
        wrapperClassName="w-full"
        className="right-0"
        anchor={
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex w-full items-center gap-2.25 rounded-control p-1.5 text-left transition-colors',
              'hover:bg-surface-hover-nav focus-visible:outline-none focus-visible:shadow-focus',
            )}
          >
            {user && hydrated ? (
              <Avatar name={user.name} size="lg" tone="accent" />
            ) : (
              <Skeleton className="size-7 rounded-full" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-control font-medium">
                {user && hydrated ? user.name : ' '}
              </span>
              <span className="text-caption text-text-muted">{hydrated ? roleLabel : ' '}</span>
            </span>
            <ChevronsUpDown size={16} strokeWidth={1.75} className="text-text-faint" />
          </button>
        }
      >
        <Menu label="Profile">
          <MenuLabel>
            {user?.name ?? 'Demo user'} · {roleLabel}
          </MenuLabel>
          <MenuItem icon={RotateCcw} onSelect={onReset}>
            Reset demo data
          </MenuItem>
          <MenuItem icon={LogOut} onSelect={onLogOut}>
            Log out
          </MenuItem>
        </Menu>
      </Popover>
    </div>
  );
}
