import type { Role } from '@/src/lib/types';

export type Section = 'dashboard' | 'clients' | 'pipeline' | 'tasks' | 'team';

export const SECTION_HREF: Record<Section, string> = {
  dashboard: '/',
  clients: '/clients',
  pipeline: '/pipeline',
  tasks: '/tasks',
  team: '/team',
};

export const clientHref = (id: string) => `/clients/${id}`;
export const dealHref = (id: string) => `/deals/${id}`;

/** Sidebar section for a path; detail pages highlight their list (client → Clients, deal → Pipeline). */
export function sectionFor(pathname: string): Section {
  if (pathname.startsWith('/clients')) return 'clients';
  if (pathname.startsWith('/pipeline') || pathname.startsWith('/deals')) return 'pipeline';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/team')) return 'team';
  return 'dashboard';
}

export interface Crumbs {
  parent: { label: string; href: string };
  current: string;
}

/** Breadcrumbs as in the design. `entityName` is the client or deal title for detail pages. */
export function crumbsFor(pathname: string, role: Role, entityName?: string): Crumbs {
  const head = role === 'head';
  if (/^\/clients\/[^/]+/.test(pathname)) {
    return { parent: { label: 'Clients', href: '/clients' }, current: entityName ?? 'Client' };
  }
  if (/^\/deals\/[^/]+/.test(pathname)) {
    return { parent: { label: 'Pipeline', href: '/pipeline' }, current: entityName ?? 'Deal' };
  }
  switch (sectionFor(pathname)) {
    case 'clients':
      return {
        parent: { label: 'Clients', href: '/clients' },
        current: head ? 'All clients' : 'My clients',
      };
    case 'pipeline':
      return { parent: { label: 'Deals', href: '/pipeline' }, current: 'Pipeline' };
    case 'tasks':
      return {
        parent: { label: 'Tasks', href: '/tasks' },
        current: head ? 'All tasks' : 'My tasks',
      };
    case 'team':
      return { parent: { label: 'Team', href: '/team' }, current: 'Workload' };
    case 'dashboard':
      return {
        parent: { label: 'FundPath', href: '/' },
        current: head ? 'Team dashboard' : 'My dashboard',
      };
  }
}
