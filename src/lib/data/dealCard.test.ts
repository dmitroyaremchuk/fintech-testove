import { describe, expect, it } from 'vitest';
import { bankStats } from './banks';
import { dealView, stepperSteps } from './dealCard';
import {
  addApplication,
  changeApplication,
  confirmDisbursement,
  setCommissionRate,
  updateDocument,
  type ActionResult,
} from './dealMutations';
import { moveDeal } from './mutations';
import { scopeDataset } from './scope';
import { createSeed } from './seed/build';
import type { Dataset } from './dataset';

const NOW = new Date(2026, 8, 29, 10, 14);
const all = createSeed(NOW);
const olena = scopeDataset(all, { role: 'manager', userId: 'u1' });
const view = (data: Dataset, id: string) => dealView(data, data, id, NOW)!;
const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('dealView — Agro-Skhid (story 1)', () => {
  const v = dealView(olena, all, 'd1', NOW)!;

  it('applications: paid/accepted first, rejections last; offers compared', () => {
    expect(v.applications.map((a) => a.status)).toEqual([
      'accepted',
      'approved',
      'rejected',
      'rejected',
    ]);
    expect(v.offers.map((o) => [o.application.bank, o.best, o.chosen])).toEqual([
      ['Universal Capital', true, true],
      ['FinTrust', false, false],
    ]);
  });

  it('awaiting disbursement of the accepted offer; nothing to suggest', () => {
    expect(v.awaitingDisbursement?.bank).toBe('Universal Capital');
    expect(v.suggestion).toBeNull();
  });

  it('commission: expected on the accepted 8M, weighted by 85%, nothing earned yet', () => {
    expect(v.commission).toMatchObject({
      base: 8_000_000,
      baseSource: { kind: 'accepted', bank: 'Universal Capital' },
      expected: 160_000,
      probability: 0.85,
      actual: null,
    });
  });

  it('two rejections, and the only bank not tried yet is Sitibud', () => {
    expect(v.rejectedCount).toBe(2);
    expect(v.untried.map((b) => b.bank)).toEqual(['Sitibud']);
  });

  it('documents: 7 of 8 received', () => {
    expect(v.docsReceived).toBe(7);
    expect(v.documents).toHaveLength(8);
  });

  it('stepper: six stages done, Signing current', () => {
    expect(stepperSteps(v.deal, v.daysInStage).map((s) => s.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
      'done',
      'current',
    ]);
  });

  it('a manager cannot load someone else’s deal', () => {
    expect(dealView(olena, all, 'd3', NOW)).toBeNull();
  });
});

describe('bank statistics', () => {
  it('approval rate and decision time come from the data', () => {
    const s = bankStats(all).get('Universal Capital')!;
    expect(s.decided).toBeGreaterThan(0);
    expect(s.approvalRate).toBeGreaterThan(0);
    expect(s.approvalRate).toBeLessThanOrEqual(1);
    expect(s.avgDecisionDays).toBeGreaterThan(0);
  });
});

describe('applications flow', () => {
  it('add → submit creates the "check status in 3 working days" task', () => {
    const added = ok(addApplication(all, 'd1', 'Sitibud', 8_000_000, NOW));
    const app = added.data.applications.find((a) => a.dealId === 'd1' && a.bank === 'Sitibud')!;
    expect(app).toMatchObject({ id: 'd1-a5', status: 'prep' });
    const sent = ok(changeApplication(added.data, app.id, { to: 'submitted' }, NOW));
    expect(sent.tasks.map((t) => t.title)).toEqual(['Check application status with Sitibud']);
    expect(sent.data.applications.find((a) => a.id === app.id)?.submittedAt).toBe(
      NOW.toISOString(),
    );
  });

  it('one application per bank per deal', () => {
    expect(addApplication(all, 'd1', 'FinTrust', 1, NOW)).toEqual({
      ok: false,
      error: 'FinTrust already has an application for this deal',
    });
  });

  it('rejection needs a reason and suggests a task naming the banks not tried yet', () => {
    // d13 (Smart Pack factoring): FinTrust under review, Universal Capital submitted, Sitibud rejected.
    expect(changeApplication(all, 'd13-a1', { to: 'rejected' }, NOW)).toEqual({
      ok: false,
      error: 'Enter the rejection reason',
    });
    const r = ok(
      changeApplication(
        all,
        'd13-a1',
        { to: 'rejected', reason: 'Receivables too concentrated' },
        NOW,
      ),
    );
    expect(r.tasks.map((t) => t.title)).toEqual([
      'Analyze rejection reason: FinTrust · not tried yet: Dniprobank, Karpatskyi',
    ]);
    expect(r.data.interactions[0]?.summary).toBe('FinTrust rejected: Receivables too concentrated');
    expect(
      view(r.data, 'd13')
        .untried.map((b) => b.bank)
        .sort(),
    ).toEqual(['Dniprobank', 'Karpatskyi']);
  });

  it('approval needs valid terms', () => {
    expect(changeApplication(all, 'd13-a1', { to: 'approved' }, NOW).ok).toBe(false);
    expect(
      changeApplication(
        all,
        'd13-a1',
        { to: 'approved', terms: { amount: 1_700_000, rate: 0, termMonths: 12 } },
        NOW,
      ).ok,
    ).toBe(false);
  });

  it('when every application has a decision, the card suggests the next stage', () => {
    let data = ok(
      changeApplication(
        all,
        'd13-a1',
        { to: 'approved', terms: { amount: 1_700_000, rate: 19.2, termMonths: 12 } },
        NOW,
      ),
    ).data;
    expect(view(data, 'd13').suggestion).toBeNull(); // Universal Capital still pending
    data = ok(
      changeApplication(
        data,
        'd13-a2',
        { to: 'rejected', reason: 'Industry outside risk appetite' },
        NOW,
      ),
    ).data;
    expect(view(data, 'd13').suggestion).toEqual({
      stage: 'signing',
      reason: '1 of 3 banks approved. The client can choose an offer.',
    });
    // Nothing moved on its own:
    expect(data.deals.find((d) => d.id === 'd13')?.stage).toBe('decision');
  });

  it('all rejected → suggests going back to Bank selection with untried banks', () => {
    let data = ok(changeApplication(all, 'd13-a1', { to: 'rejected', reason: 'A' }, NOW)).data;
    data = ok(changeApplication(data, 'd13-a2', { to: 'rejected', reason: 'B' }, NOW)).data;
    expect(view(data, 'd13').suggestion?.stage).toBe('banks');
  });

  it('accepting another offer puts the previous one back to approved', () => {
    const r = ok(changeApplication(all, 'd1-a4', { to: 'accepted' }, NOW));
    const apps = r.data.applications.filter((a) => a.dealId === 'd1');
    expect(apps.filter((a) => a.status === 'accepted').map((a) => a.bank)).toEqual(['FinTrust']);
    expect(apps.find((a) => a.bank === 'Universal Capital')?.status).toBe('approved');
  });

  it('status changes follow the process; closed deals are read-only', () => {
    expect(changeApplication(all, 'd1-a4', { to: 'disbursed' }, NOW).ok).toBe(false); // not accepted
    expect(changeApplication(all, 'd28-a1', { to: 'approved' }, NOW)).toEqual({
      ok: false,
      error: 'The deal is closed',
    });
  });
});

describe('Won only after a payout', () => {
  it('moving to Won without a disbursed application is blocked', () => {
    expect(moveDeal(all, 'd1', 'won', NOW).check.allowed).toBe(false);
  });

  it('confirming disbursement pays out the accepted offer, wins the deal and creates the invoice task', () => {
    const r = ok(confirmDisbursement(all, 'd1', NOW));
    expect(r.data.applications.find((a) => a.id === 'd1-a3')?.status).toBe('disbursed');
    expect(r.data.deals.find((d) => d.id === 'd1')?.stage).toBe('won');
    expect(r.tasks.map((t) => t.title)).toEqual(['Issue commission invoice']);
    expect(r.message).toBe('Funds disbursed by Universal Capital · deal won · 1 task created');
    const v = view(r.data, 'd1');
    expect(v.commission.actual).toBe(160_000);
    expect(v.commission.baseSource).toEqual({ kind: 'disbursed', bank: 'Universal Capital' });
  });

  it('no accepted offer → nothing to disburse', () => {
    expect(confirmDisbursement(all, 'd13', NOW)).toEqual({
      ok: false,
      error: 'No accepted offer to disburse',
    });
  });
});

describe('documents', () => {
  it('request adds one reminder per deal; receive closes the document’s auto task', () => {
    const r1 = ok(updateDocument(all, 'd2-doc6', 'request', NOW));
    expect(r1.tasks.map((t) => t.title)).toEqual([]); // the seeded reminder for d2 is still open
    const r2 = ok(updateDocument(r1.data, 'd2-doc6', 'receive', NOW));
    const task = r2.data.tasks.find((t) => t.autoKey === 'doc-request:d2-doc6');
    expect(task?.status).toBe('done');
    expect(r2.data.documents.find((d) => d.id === 'd2-doc6')?.status).toBe('received');
  });

  it('renewing the expiring certificate requests it again', () => {
    const r = ok(updateDocument(all, 'd2-doc4', 'renew', NOW));
    expect(r.data.documents.find((d) => d.id === 'd2-doc4')).toMatchObject({
      status: 'requested',
      validUntil: null,
    });
  });

  it('receiving a renewed certificate tracks its validity again', () => {
    const renewed = ok(updateDocument(all, 'd2-doc4', 'renew', NOW)).data;
    const withDate = {
      ...renewed,
      documents: renewed.documents.map((d) => (d.id === 'd2-doc4' ? { ...d, validUntil: 'x' } : d)),
    };
    const r = ok(updateDocument(withDate, 'd2-doc4', 'receive', NOW));
    expect(r.data.documents.find((d) => d.id === 'd2-doc4')?.validUntil).not.toBeNull();
  });
});

describe('commission rate', () => {
  it('is saved on the deal and clamped to 1–3%', () => {
    expect(
      setCommissionRate(all, 'd1', 0.025).deals.find((d) => d.id === 'd1')?.commissionRate,
    ).toBe(0.025);
    expect(
      setCommissionRate(all, 'd1', 0.08).deals.find((d) => d.id === 'd1')?.commissionRate,
    ).toBe(0.03);
    const v = view(setCommissionRate(all, 'd1', 0.03), 'd1');
    expect(v.commission.expected).toBe(240_000);
  });
});
