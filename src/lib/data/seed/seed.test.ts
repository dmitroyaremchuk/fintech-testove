import { describe, expect, it } from 'vitest';
import { calendarDaysBetween } from '../../dates';
import { summarizeApplications } from '../../rules/applications';
import { documentDisplayStatus, expiringDocuments } from '../../rules/documents';
import { calcDaysInStage, isClosedStage, isStuck } from '../../rules/stages';
import { isOverdue } from '../../rules/tasks';
import { canMoveToStage, suggestStage } from '../../rules/transitions';
import type { BankApplication, Deal } from '../../types';
import { scopeDataset } from '../scope';
import { staleClients } from '../selectors';
import { createSeed } from './build';

/**
 * Does the deal's stage agree with its applications?
 * This is the seed's definition of "consistent"; it is stricter than canMoveToStage because
 * seed data should describe a deal that got to its stage the normal way.
 */
function stageProblem(deal: Deal, apps: BankApplication[]): string | null {
  const s = summarizeApplications(apps);
  const sent = s.total - s.preparing;
  const positive = s.approved + s.accepted + s.disbursed;
  switch (deal.stage) {
    case 'new':
    case 'qual':
    case 'docs':
      return s.total === 0 ? null : 'has applications before Bank selection';
    case 'banks':
      return sent === 0 || s.allRejected ? null : 'sent applications while in Bank selection';
    case 'submitted':
      return sent > 0 && apps.every((a) => a.status === 'submitted' || a.status === 'prep')
        ? null
        : 'expected only freshly submitted applications';
    case 'decision': {
      const engaged = apps.some((a) => a.status !== 'submitted' && a.status !== 'prep');
      return s.pending > 0 && engaged && s.accepted + s.disbursed === 0
        ? null
        : 'expected banks still deciding';
    }
    case 'signing':
      return positive > 0 && s.disbursed === 0 ? null : 'expected an approval and no payout';
    case 'won':
      return s.disbursed > 0 ? null : 'won without a disbursed application';
    case 'lost':
      if (!deal.lostReason) return 'lost without a reason';
      if (deal.lostReason === 'All banks declined' && !s.allRejected)
        return 'not all banks declined';
      return null;
  }
}

const MOMENTS: [string, Date][] = [
  ['design day (Tue Sep 29 2026, 10:14)', new Date(2026, 8, 29, 10, 14)],
  ['Saturday noon', new Date(2026, 9, 3, 12, 0)],
  ['Monday 07:30, before the working day', new Date(2026, 9, 5, 7, 30)],
  ['late evening', new Date(2026, 8, 29, 22, 45)],
  ['New Year’s Day', new Date(2027, 0, 1, 9, 0)],
  ['the real clock', new Date()],
];

describe.each(MOMENTS)('seed generated on %s', (_label, now) => {
  const data = createSeed(now);
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((x) => [x.id, x]));
  const users = byId(data.users);
  const clients = byId(data.clients);
  const deals = byId(data.deals);
  const appsOf = (dealId: string) => data.applications.filter((a) => a.dealId === dealId);
  const open = data.deals.filter((d) => !isClosedStage(d.stage));

  describe('volumes (AGENTS.md → Seed data)', () => {
    it('6 users: 5 managers + 1 head', () => {
      expect(data.users.filter((u) => u.role === 'manager')).toHaveLength(5);
      expect(data.users.filter((u) => u.role === 'head')).toHaveLength(1);
    });

    it('40 clients, 60 deals, ~90 applications, ~200 interactions, ~60 tasks', () => {
      expect(data.clients).toHaveLength(40);
      expect(data.deals).toHaveLength(60);
      expect(data.applications.length).toBeGreaterThanOrEqual(80);
      expect(data.applications.length).toBeLessThanOrEqual(100);
      expect(data.interactions.length).toBeGreaterThanOrEqual(170);
      expect(data.interactions.length).toBeLessThanOrEqual(260);
      expect(data.tasks.length).toBeGreaterThanOrEqual(50);
      expect(data.tasks.length).toBeLessThanOrEqual(75);
    });

    it('some tasks are overdue', () => {
      expect(data.tasks.filter((t) => isOverdue(t, now)).length).toBeGreaterThan(9);
    });

    it('uses only the five partner banks', () => {
      const banks = new Set(data.applications.map((a) => a.bank));
      expect([...banks].sort()).toEqual(
        ['Dniprobank', 'FinTrust', 'Karpatskyi', 'Sitibud', 'Universal Capital'].sort(),
      );
    });
  });

  describe('referential integrity', () => {
    it('ids are unique in every collection', () => {
      for (const list of Object.values(data)) {
        const ids = (list as { id: string }[]).map((x) => x.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('every reference points to an existing record', () => {
      for (const c of data.clients) expect(users.get(c.ownerId)?.role).toBe('manager');
      for (const d of data.deals) {
        expect(clients.has(d.clientId)).toBe(true);
        expect(d.ownerId).toBe(clients.get(d.clientId)?.ownerId);
      }
      for (const a of data.applications) expect(deals.has(a.dealId)).toBe(true);
      for (const doc of data.documents) expect(deals.has(doc.dealId)).toBe(true);
      for (const i of data.interactions) {
        expect(clients.has(i.clientId)).toBe(true);
        if (i.dealId) expect(deals.get(i.dealId)?.clientId).toBe(i.clientId);
        if (i.authorId) expect(users.has(i.authorId)).toBe(true);
        expect(i.auto).toBe(i.authorId === null);
      }
      for (const t of data.tasks) {
        expect(users.has(t.assigneeId)).toBe(true);
        if (t.clientId) expect(clients.has(t.clientId)).toBe(true);
        if (t.dealId) {
          const deal = deals.get(t.dealId);
          expect(deal?.clientId).toBe(t.clientId);
          expect([deal?.ownerId, 'h1']).toContain(t.assigneeId);
        }
      }
    });
  });

  describe('every deal’s stage matches its applications', () => {
    it.each(data.deals.map((d) => [d.id, d] as const))('%s', (_id, deal) => {
      const apps = appsOf(deal.id);
      expect(stageProblem(deal, apps)).toBeNull();
      if (!isClosedStage(deal.stage)) expect(suggestStage(deal, apps)).toBeNull();
    });
  });

  describe('dates and amounts are believable', () => {
    it('deals: created ≤ entered current stage ≤ now', () => {
      for (const d of data.deals) {
        expect(new Date(d.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(d.stageEnteredAt).getTime(),
        );
        expect(new Date(d.stageEnteredAt).getTime()).toBeLessThanOrEqual(now.getTime());
      }
    });

    it('applications: sent after the deal was created, decided after being sent, nothing in the future', () => {
      for (const a of data.applications) {
        const deal = deals.get(a.dealId)!;
        if (a.status === 'prep') {
          expect(a.submittedAt).toBeNull();
          continue;
        }
        const sub = new Date(a.submittedAt!).getTime();
        expect(sub).toBeGreaterThanOrEqual(new Date(deal.createdAt).getTime());
        expect(sub).toBeLessThanOrEqual(now.getTime());
        const decided = ['approved', 'rejected', 'accepted', 'disbursed'].includes(a.status);
        expect(a.decidedAt !== null).toBe(decided);
        if (a.decidedAt) {
          expect(new Date(a.decidedAt).getTime()).toBeGreaterThanOrEqual(sub);
          expect(new Date(a.decidedAt).getTime()).toBeLessThanOrEqual(now.getTime());
        }
      }
    });

    it('applications: offers have rate and term, rejections have a reason', () => {
      for (const a of data.applications) {
        const offer = ['approved', 'accepted', 'disbursed'].includes(a.status);
        expect(a.rate !== null && a.termMonths !== null).toBe(offer);
        if (a.rate !== null) {
          expect(a.rate).toBeGreaterThanOrEqual(16);
          expect(a.rate).toBeLessThanOrEqual(22);
        }
        expect(a.rejectionReason !== null).toBe(a.status === 'rejected');
      }
    });

    it('requested amounts fit the client (≤ 50% of annual turnover); offers never exceed the request', () => {
      for (const d of data.deals) {
        expect(d.requestedAmount).toBeGreaterThan(0);
        expect(d.requestedAmount).toBeLessThanOrEqual(
          clients.get(d.clientId)!.annualTurnover * 0.5,
        );
      }
      for (const a of data.applications) {
        expect(a.amount).toBeLessThanOrEqual(deals.get(a.dealId)!.requestedAmount);
      }
    });

    it('interactions cover the last 3 months and none is in the future', () => {
      for (const i of data.interactions) {
        const days = calendarDaysBetween(new Date(i.date), now);
        expect(days).toBeGreaterThanOrEqual(0);
        expect(days).toBeLessThanOrEqual(92);
      }
    });

    it('a client whose deal started in the last 14 days is never flagged as "no contact 14+ days"', () => {
      const stale = new Set(staleClients(data, now).map((c) => c.id));
      const recent = data.deals.filter((d) => calendarDaysBetween(new Date(d.createdAt), now) < 14);
      for (const d of recent) expect(stale.has(d.clientId)).toBe(false);
    });

    it('checklists exist only once a deal reached Document collection', () => {
      const early = new Set(
        data.deals.filter((d) => d.stage === 'new' || d.stage === 'qual').map((d) => d.id),
      );
      expect(data.documents.filter((d) => early.has(d.dealId))).toEqual([]);
    });

    it('no open auto task is duplicated', () => {
      const keys = data.tasks.filter((t) => t.status === 'open' && t.autoKey).map((t) => t.autoKey);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('auto tasks carry the rule key, manual ones do not', () => {
      for (const t of data.tasks) expect(t.autoKey !== null).toBe(t.source === 'auto');
    });

    it('generates the same data for the same moment', () => {
      expect(createSeed(now)).toEqual(data);
    });
  });

  describe('story records', () => {
    it('1. Agro-Skhid: rejected by two banks, third approved and accepted, awaiting disbursement', () => {
      const client = data.clients.find((c) => c.name === 'Agro-Skhid LLC')!;
      const deal = data.deals.find((d) => d.clientId === client.id && d.stage === 'signing')!;
      const apps = appsOf(deal.id);
      expect(apps.filter((a) => a.status === 'rejected').map((a) => a.bank)).toEqual([
        'Dniprobank',
        'Karpatskyi',
      ]);
      expect(apps.find((a) => a.status === 'accepted')?.bank).toBe('Universal Capital');
      expect(apps.some((a) => a.status === 'disbursed')).toBe(false);
      const won = canMoveToStage(deal, 'won', { applications: apps });
      expect(won.allowed).toBe(false);
    });

    it('2. Coffee-shop sole proprietor: tax certificate expires in 4 days', () => {
      const client = data.clients.find((c) => c.industry.startsWith('Coffee shop'))!;
      expect(client.legalForm).toBe('Sole prop.');
      const deal = data.deals.find((d) => d.clientId === client.id)!;
      const cert = data.documents.find(
        (d) => d.dealId === deal.id && d.type === 'Tax clearance certificate',
      )!;
      expect(documentDisplayStatus(cert, now)).toBe('expiring');
      expect(calendarDaysBetween(now, new Date(cert.validUntil!))).toBe(4);
    });

    it('   …and it is the only expiring document, so "Deals at risk" stays focused', () => {
      const openIds = new Set(open.map((d) => d.id));
      const expiring = expiringDocuments(
        data.documents.filter((d) => openIds.has(d.dealId)),
        now,
      );
      expect(expiring.map((d) => d.dealId)).toEqual(['d2']);
    });

    it('3. Construction company, 12M ₴, 20 days in "Bank decisions" (stuck)', () => {
      const client = data.clients.find((c) => c.industry === 'Construction')!;
      const deal = data.deals.find((d) => d.clientId === client.id)!;
      expect(deal.requestedAmount).toBe(12_000_000);
      expect(deal.stage).toBe('decision');
      expect(calcDaysInStage(deal, now)).toBe(20);
      expect(isStuck(deal, now)).toBe(true);
    });

    it('4. Duplicate client: two records, same EDRPOU, different sources and owners', () => {
      const byCode = new Map<string, typeof data.clients>();
      for (const c of data.clients) byCode.set(c.code, [...(byCode.get(c.code) ?? []), c]);
      const dupes = [...byCode.values()].filter((list) => list.length > 1);
      expect(dupes).toHaveLength(1);
      const [a, b] = dupes[0]!;
      expect(a!.leadSource).not.toBe(b!.leadSource);
      expect(a!.ownerId).not.toBe(b!.ownerId);
    });

    it('5. Olena: 18 open deals and 9 overdue tasks — as she sees them', () => {
      const olena = data.users.find((u) => u.name === 'Olena Koval')!;
      const mine = scopeDataset(data, { role: 'manager', userId: olena.id });
      expect(mine.deals.filter((d) => !isClosedStage(d.stage))).toHaveLength(18);
      expect(mine.tasks.filter((t) => isOverdue(t, now))).toHaveLength(9);
    });

    it('   …and she is the most loaded manager', () => {
      const openCount = (id: string) => open.filter((d) => d.ownerId === id).length;
      const others = data.users.filter((u) => u.role === 'manager' && u.id !== 'u1');
      for (const u of others) expect(openCount(u.id)).toBeLessThan(openCount('u1'));
    });

    it('6. Repeat client: loan a year ago, now leasing', () => {
      const client = data.clients.find((c) => c.name === 'Translogistic West LLC')!;
      const clientDeals = data.deals.filter((d) => d.clientId === client.id);
      const past = clientDeals.find((d) => d.stage === 'won' && d.product === 'Loan')!;
      const daysAgo = calendarDaysBetween(new Date(past.stageEnteredAt), now);
      expect(daysAgo).toBeGreaterThanOrEqual(330);
      expect(daysAgo).toBeLessThanOrEqual(400);
      expect(appsOf(past.id).some((a) => a.status === 'disbursed')).toBe(true);
      expect(clientDeals.some((d) => d.product === 'Leasing' && !isClosedStage(d.stage))).toBe(
        true,
      );
    });
  });
});
