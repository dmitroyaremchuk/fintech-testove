import { describe, expect, it } from 'vitest';
import type { LossReason, StageKey } from '../constants';
import { canMoveToStage, suggestStage, type MoveCheck } from './transitions';
import { makeApp, makeDeal } from './test-fixtures';

const blockedCode = (check: MoveCheck) => (check.allowed ? null : check.code);
const message = (check: MoveCheck) => (check.allowed ? '' : check.message);

describe('canMoveToStage — deal with no applications', () => {
  const deal = makeDeal({ stage: 'banks' });
  const ctx = { applications: [] };

  it.each<StageKey>(['submitted', 'decision', 'signing'])('blocks %s with a reason', (target) => {
    const check = canMoveToStage(deal, target, ctx);
    expect(blockedCode(check)).toBe('no_applications');
    expect(message(check)).toMatch(/the deal has no bank applications/);
  });

  it('names the target stage in the message', () => {
    expect(message(canMoveToStage(deal, 'submitted', ctx))).toBe(
      'Can’t move to “Applications submitted”: the deal has no bank applications.',
    );
  });

  it.each<StageKey>(['new', 'qual', 'docs'])('allows earlier stage %s', (target) => {
    expect(canMoveToStage(deal, target, ctx).allowed).toBe(true);
  });

  it('cannot be Won', () => {
    expect(blockedCode(canMoveToStage(deal, 'won', ctx))).toBe('not_disbursed');
  });

  it('can be Lost with a reason', () => {
    expect(canMoveToStage(deal, 'lost', { ...ctx, lostReason: 'Unresponsive' }).allowed).toBe(true);
  });
});

describe('canMoveToStage — applications exist but none were sent', () => {
  it('blocks "Applications submitted" while everything is in Preparation', () => {
    const check = canMoveToStage(makeDeal({ stage: 'banks' }), 'submitted', {
      applications: [makeApp('prep'), makeApp('prep', 'FinTrust')],
    });
    expect(blockedCode(check)).toBe('applications_not_sent');
  });
});

describe('canMoveToStage — all applications rejected', () => {
  const deal = makeDeal({ stage: 'decision' });
  const ctx = { applications: [makeApp('rejected'), makeApp('rejected', 'Karpatskyi')] };

  it('blocks Signing & disbursement and says why', () => {
    const check = canMoveToStage(deal, 'signing', ctx);
    expect(blockedCode(check)).toBe('no_approval');
    expect(message(check)).toBe('Can’t move to “Signing & disbursement”: all banks declined.');
  });

  it('allows going back to Bank selection to try other banks', () => {
    expect(canMoveToStage(deal, 'banks', ctx).allowed).toBe(true);
  });

  it('allows Lost with "All banks declined"', () => {
    expect(canMoveToStage(deal, 'lost', { ...ctx, lostReason: 'All banks declined' }).allowed).toBe(
      true,
    );
  });

  it('cannot be Won', () => {
    expect(blockedCode(canMoveToStage(deal, 'won', ctx))).toBe('not_disbursed');
  });
});

describe('canMoveToStage — Signing needs an approval', () => {
  it('blocks while banks are still reviewing', () => {
    const check = canMoveToStage(makeDeal({ stage: 'decision' }), 'signing', {
      applications: [makeApp('review'), makeApp('rejected', 'Karpatskyi')],
    });
    expect(message(check)).toBe(
      'Can’t move to “Signing & disbursement”: no bank has approved the deal yet.',
    );
  });

  it('allows once one bank approved', () => {
    const check = canMoveToStage(makeDeal({ stage: 'decision' }), 'signing', {
      applications: [makeApp('approved'), makeApp('rejected', 'Karpatskyi')],
    });
    expect(check.allowed).toBe(true);
  });
});

describe('canMoveToStage — Won only after money is paid out', () => {
  const deal = makeDeal({ stage: 'signing' });

  it('blocks Won when the client accepted but nothing was disbursed', () => {
    const check = canMoveToStage(deal, 'won', {
      applications: [makeApp('accepted'), makeApp('approved', 'FinTrust')],
    });
    expect(check).toEqual({
      allowed: false,
      code: 'not_disbursed',
      message:
        'Can’t mark as Won: no application is Disbursed. A deal is won only after the money is paid out.',
    });
  });

  it('allows Won once any application is Disbursed', () => {
    const apps = [makeApp('disbursed'), makeApp('rejected', 'Karpatskyi')];
    expect(canMoveToStage(deal, 'won', { applications: apps }).allowed).toBe(true);
  });

  it('a disbursed deal can be closed as Won from an earlier stage too', () => {
    const check = canMoveToStage(makeDeal({ stage: 'decision' }), 'won', {
      applications: [makeApp('disbursed')],
    });
    expect(check.allowed).toBe(true);
  });
});

describe('canMoveToStage — Lost needs a valid reason', () => {
  const deal = makeDeal({ stage: 'qual' });

  it('blocks without a reason', () => {
    expect(blockedCode(canMoveToStage(deal, 'lost', { applications: [] }))).toBe('reason_required');
    expect(blockedCode(canMoveToStage(deal, 'lost', { applications: [], lostReason: null }))).toBe(
      'reason_required',
    );
  });

  it('blocks a reason that is not in the list', () => {
    const check = canMoveToStage(deal, 'lost', {
      applications: [],
      lostReason: 'Price too high' as LossReason,
    });
    expect(blockedCode(check)).toBe('reason_required');
  });
});

describe('canMoveToStage — closed deals and no-ops', () => {
  it.each<StageKey>(['won', 'lost'])('a %s deal cannot be moved anywhere', (stage) => {
    const check = canMoveToStage(makeDeal({ stage }), 'signing', {
      applications: [makeApp('disbursed')],
    });
    expect(blockedCode(check)).toBe('deal_closed');
  });

  it('moving to the current stage is reported, not silently accepted', () => {
    expect(
      blockedCode(canMoveToStage(makeDeal({ stage: 'docs' }), 'docs', { applications: [] })),
    ).toBe('same_stage');
  });

  it('backward moves between open stages are allowed', () => {
    const check = canMoveToStage(makeDeal({ stage: 'decision' }), 'docs', {
      applications: [makeApp('extra')],
    });
    expect(check.allowed).toBe(true);
  });
});

describe('suggestStage', () => {
  it('suggests nothing without applications', () => {
    expect(suggestStage(makeDeal({ stage: 'banks' }), [])).toBeNull();
  });

  it('suggests nothing while applications are only being prepared', () => {
    expect(suggestStage(makeDeal({ stage: 'banks' }), [makeApp('prep')])).toBeNull();
  });

  it('Applications submitted once they are sent', () => {
    const s = suggestStage(makeDeal({ stage: 'banks' }), [
      makeApp('submitted'),
      makeApp('prep', 'FinTrust'),
    ]);
    expect(s?.stage).toBe('submitted');
  });

  it('Bank decisions once a bank starts reviewing', () => {
    const s = suggestStage(makeDeal({ stage: 'submitted' }), [
      makeApp('review'),
      makeApp('submitted', 'FinTrust'),
    ]);
    expect(s?.stage).toBe('decision');
  });

  it('no suggestion when the deal is already where the applications point', () => {
    expect(suggestStage(makeDeal({ stage: 'decision' }), [makeApp('review')])).toBeNull();
  });

  it('never pulls a deal backwards on its own (except when all banks declined)', () => {
    expect(suggestStage(makeDeal({ stage: 'signing' }), [makeApp('review')])).toBeNull();
  });

  it('while some banks are pending, a rejection does not trigger anything', () => {
    const apps = [
      makeApp('rejected'),
      makeApp('rejected', 'Karpatskyi'),
      makeApp('review', 'FinTrust'),
    ];
    expect(suggestStage(makeDeal({ stage: 'decision' }), apps)).toBeNull();
  });

  it('all decisions in and one approved → Signing & disbursement', () => {
    const apps = [makeApp('approved'), makeApp('rejected', 'Karpatskyi')];
    const s = suggestStage(makeDeal({ stage: 'decision' }), apps);
    expect(s).toEqual({
      stage: 'signing',
      reason: '1 of 2 banks approved. The client can choose an offer.',
    });
  });

  it('client accepted an offer → Signing & disbursement even if others are pending', () => {
    const apps = [makeApp('accepted'), makeApp('review', 'FinTrust')];
    expect(suggestStage(makeDeal({ stage: 'decision' }), apps)?.stage).toBe('signing');
  });

  it('funds disbursed → Won', () => {
    const apps = [makeApp('disbursed'), makeApp('approved', 'FinTrust')];
    expect(suggestStage(makeDeal({ stage: 'signing' }), apps)?.stage).toBe('won');
  });

  it('all rejected with banks left → back to Bank selection, listing untried banks', () => {
    const apps = [makeApp('rejected', 'Dniprobank'), makeApp('rejected', 'Karpatskyi')];
    expect(suggestStage(makeDeal({ stage: 'decision' }), apps)).toEqual({
      stage: 'banks',
      reason: 'All 2 banks declined. Not tried yet: Universal Capital, FinTrust, Sitibud.',
    });
  });

  it('all rejected and every partner bank tried → Lost with "All banks declined"', () => {
    const apps = (
      ['Dniprobank', 'Karpatskyi', 'Universal Capital', 'FinTrust', 'Sitibud'] as const
    ).map((bank) => makeApp('rejected', bank));
    expect(suggestStage(makeDeal({ stage: 'decision' }), apps)).toEqual({
      stage: 'lost',
      reason: 'All partner banks declined.',
      lostReason: 'All banks declined',
    });
  });

  it('all sent rejected but a backup is being prepared → Bank selection, never Lost', () => {
    const apps = [
      makeApp('rejected'),
      makeApp('rejected', 'Karpatskyi'),
      makeApp('prep', 'Sitibud'),
    ];
    expect(suggestStage(makeDeal({ stage: 'decision' }), apps)?.stage).toBe('banks');
  });

  it('all rejected and the deal is already in Bank selection → nothing to suggest', () => {
    expect(suggestStage(makeDeal({ stage: 'banks' }), [makeApp('rejected')])).toBeNull();
  });

  it.each<StageKey>(['won', 'lost'])('never suggests anything for a %s deal', (stage) => {
    expect(suggestStage(makeDeal({ stage }), [makeApp('disbursed')])).toBeNull();
  });
});
