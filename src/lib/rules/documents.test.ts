import { describe, expect, it } from 'vitest';
import { documentDisplayStatus, expiringDocuments, isMissing } from './documents';
import { NOW, local, makeDoc } from './test-fixtures';

describe('documentDisplayStatus', () => {
  it('received without an expiry date stays received', () => {
    expect(documentDisplayStatus(makeDoc(), NOW)).toBe('received');
  });

  it('story 2: tax certificate valid 4 more days is expiring', () => {
    expect(documentDisplayStatus(makeDoc({ validUntil: local(2026, 10, 3) }), NOW)).toBe(
      'expiring',
    );
  });

  it('boundaries: 5 days left is expiring, 6 is not, expiring today still counts', () => {
    expect(documentDisplayStatus(makeDoc({ validUntil: local(2026, 10, 4) }), NOW)).toBe(
      'expiring',
    );
    expect(documentDisplayStatus(makeDoc({ validUntil: local(2026, 10, 5) }), NOW)).toBe(
      'received',
    );
    expect(documentDisplayStatus(makeDoc({ validUntil: local(2026, 9, 29, 23) }), NOW)).toBe(
      'expiring',
    );
  });

  it('received but past validUntil is expired, even if the status was never updated', () => {
    expect(documentDisplayStatus(makeDoc({ validUntil: local(2026, 9, 28) }), NOW)).toBe('expired');
  });

  it('not-received statuses are passed through', () => {
    expect(documentDisplayStatus(makeDoc({ status: 'requested' }), NOW)).toBe('requested');
  });
});

describe('isMissing / expiringDocuments', () => {
  const docs = [
    makeDoc({ id: 'ok', validUntil: local(2026, 10, 18) }),
    makeDoc({ id: 'soon', validUntil: local(2026, 10, 3) }),
    makeDoc({ id: 'old', validUntil: local(2026, 9, 1) }),
    makeDoc({ id: 'asked', status: 'requested' }),
    makeDoc({ id: 'none', status: 'not_requested' }),
  ];

  it('missing = not requested, requested, or expired; expiring is still valid', () => {
    expect(docs.filter((d) => isMissing(d, NOW)).map((d) => d.id)).toEqual([
      'old',
      'asked',
      'none',
    ]);
  });

  it('lists only expiring ones', () => {
    expect(expiringDocuments(docs, NOW).map((d) => d.id)).toEqual(['soon']);
  });
});
