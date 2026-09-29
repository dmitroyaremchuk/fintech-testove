import { describe, expect, it } from 'vitest';
import { isStaleContact } from './clients';
import { duplicateGroups, findDuplicates, normalizeCode, validateCode } from './duplicates';

const clients = [
  { id: 'c4', code: '38451290' },
  { id: 'c5', code: '38451290' },
  { id: 'c1', code: '40218763' },
];

describe('validateCode', () => {
  it('LLC needs an 8-digit EDRPOU', () => {
    expect(validateCode('40218763', 'LLC')).toBeNull();
    expect(validateCode('4021876', 'LLC')).toBe('EDRPOU must be exactly 8 digits');
    expect(validateCode('', 'LLC')).toBe('Enter the EDRPOU');
  });

  it('sole proprietor needs a 10-digit tax ID', () => {
    expect(validateCode('3124509876', 'Sole prop.')).toBeNull();
    expect(validateCode('40218763', 'Sole prop.')).toBe('Tax ID must be exactly 10 digits');
  });

  it('rejects letters and spaces rather than silently dropping them', () => {
    expect(validateCode('4021 8763', 'LLC')).not.toBeNull();
    expect(validateCode('40218763a', 'LLC')).not.toBeNull();
  });
});

describe('duplicates', () => {
  it('finds other clients with the same code, ignoring spaces', () => {
    expect(findDuplicates(clients, '384 512 90').map((c) => c.id)).toEqual(['c4', 'c5']);
    expect(findDuplicates(clients, '38451290', 'c4').map((c) => c.id)).toEqual(['c5']);
  });

  it('a new code has no duplicates; an empty code never matches', () => {
    expect(findDuplicates(clients, '11112222')).toEqual([]);
    expect(findDuplicates(clients, '')).toEqual([]);
  });

  it('groups only codes that appear more than once', () => {
    expect([...duplicateGroups(clients).keys()]).toEqual(['38451290']);
    expect(normalizeCode(' 38-45-12-90 ')).toBe('38451290');
  });
});

describe('isStaleContact', () => {
  const now = new Date(2026, 8, 29, 10);
  it('14+ days or never contacted is stale; 13 days is not', () => {
    expect(isStaleContact(new Date(2026, 8, 15), now)).toBe(true);
    expect(isStaleContact(new Date(2026, 8, 16), now)).toBe(false);
    expect(isStaleContact(null, now)).toBe(true);
  });
});
