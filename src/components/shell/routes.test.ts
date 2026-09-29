import { describe, expect, it } from 'vitest';
import { crumbsFor, sectionFor } from './routes';

describe('sectionFor', () => {
  it.each([
    ['/', 'dashboard'],
    ['/clients', 'clients'],
    ['/clients/c1', 'clients'],
    ['/pipeline', 'pipeline'],
    ['/deals/d1', 'pipeline'],
    ['/tasks', 'tasks'],
    ['/team', 'team'],
  ])('%s → %s', (path, section) => {
    expect(sectionFor(path)).toBe(section);
  });
});

describe('crumbsFor', () => {
  it('uses role-specific titles like the design', () => {
    expect(crumbsFor('/', 'manager').current).toBe('My dashboard');
    expect(crumbsFor('/', 'head').current).toBe('Team dashboard');
    expect(crumbsFor('/clients', 'head').current).toBe('All clients');
    expect(crumbsFor('/tasks', 'manager').current).toBe('My tasks');
  });

  it('detail pages link back to their list and show the entity name', () => {
    expect(crumbsFor('/clients/c1', 'manager', 'Agro-Skhid LLC')).toEqual({
      parent: { label: 'Clients', href: '/clients' },
      current: 'Agro-Skhid LLC',
    });
    expect(crumbsFor('/deals/d1', 'manager', 'Agro-Skhid LLC · Loan').parent.href).toBe(
      '/pipeline',
    );
  });
});
