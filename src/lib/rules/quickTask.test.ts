import { describe, expect, it } from 'vitest';
import { parseQuickTask } from './quickTask';

// Tuesday, Sep 29 2026, 10:14
const NOW = new Date(2026, 8, 29, 10, 14);
const clients = [
  { id: 'c1', name: 'Agro-Skhid LLC' },
  { id: 'c2', name: 'Hnatiuk Oksana P. (sole prop.)' },
  { id: 'c4', name: 'Poltava Mill LLC' },
  { id: 'c14', name: 'Smart Pack Ukraine LLC' },
  { id: 'c16', name: 'Lvivkholod LLC' },
];
const parse = (text: string, now = NOW) => parseQuickTask(text, { now, clients });

describe('parseQuickTask — the design example', () => {
  it('"Call Agro-Skhid tomorrow 15:00"', () => {
    expect(parse('Call Agro-Skhid tomorrow 15:00')).toEqual({
      title: 'Call Agro-Skhid',
      type: 'call',
      clientId: 'c1',
      due: new Date(2026, 8, 30, 15, 0),
      priority: 'med',
      recognized: { date: true, time: true, client: true },
    });
  });
});

describe('dates', () => {
  it.each([
    ['Send offer today', new Date(2026, 8, 29, 18, 0)], // today without time → by end of day
    ['Send offer tomorrow', new Date(2026, 8, 30, 10, 0)], // other days → 10:00
    ['Send offer in 3 days', new Date(2026, 9, 2, 10, 0)],
    ['Send offer next week', new Date(2026, 9, 5, 10, 0)], // next Monday
    ['Send offer on Friday', new Date(2026, 9, 2, 10, 0)],
    ['Send offer fri 11:30', new Date(2026, 9, 2, 11, 30)],
    ['Send offer Oct 14', new Date(2026, 9, 14, 10, 0)],
    ['Send offer 3 October at 9am', new Date(2026, 9, 3, 9, 0)],
  ])('%s', (text, due) => {
    expect(parse(text).due).toEqual(due);
  });

  it('a weekday means the next one, never today', () => {
    expect(parse('Call on Tuesday').due).toEqual(new Date(2026, 9, 6, 10, 0));
  });

  it('a date already past this year means next year', () => {
    expect(parse('Renew licence Jan 10').due).toEqual(new Date(2027, 0, 10, 10, 0));
  });

  it('a client name next to a number is not mistaken for a date', () => {
    const r = parse('Call Poltava Mill 3 Oct');
    expect(r.due).toEqual(new Date(2026, 9, 3, 10, 0));
    expect(r.clientId).toBe('c4');
    expect(r.title).toBe('Call Poltava Mill');
  });
});

describe('times', () => {
  it.each([
    ['Call Smart Pack at 16:30', new Date(2026, 8, 29, 16, 30)],
    ['Call Smart Pack 16.30', new Date(2026, 8, 29, 16, 30)],
    ['Call Smart Pack at 4pm', new Date(2026, 8, 29, 16, 0)],
    ['Call Smart Pack at 17', new Date(2026, 8, 29, 17, 0)],
  ])('%s → today', (text, due) => {
    expect(parse(text).due).toEqual(due);
  });

  it('a time already past today means tomorrow', () => {
    expect(parse('Call Smart Pack 9:00').due).toEqual(new Date(2026, 8, 30, 9, 0));
  });

  it('no date and no time → no date', () => {
    const r = parse('Update contacts for Lvivkholod');
    expect(r.due).toBeNull();
    expect(r.recognized).toEqual({ date: false, time: false, client: true });
  });
});

describe('type, priority, client, title', () => {
  it.each([
    ['Call Hnatiuk', 'call'],
    ['Phone the accountant', 'call'],
    ['Meeting at client’s office', 'meeting'],
    ['Email the offer comparison', 'email'],
    ['Send leasing offer', 'email'],
    ['Prepare signing documents', 'other'],
  ])('%s → %s', (text, type) => {
    expect(parse(text).type).toBe(type);
  });

  it('urgent / ! → high priority and removed from the title', () => {
    expect(parse('Call Agro-Skhid urgent')).toMatchObject({
      priority: 'high',
      title: 'Call Agro-Skhid',
    });
    expect(parse('Call Agro-Skhid tomorrow !')).toMatchObject({
      priority: 'high',
      title: 'Call Agro-Skhid',
    });
    expect(parse('Check statements low priority').priority).toBe('low');
  });

  it('finds clients by short name, surname or brand, case-insensitive', () => {
    expect(parse('call hnatiuk about the lease').clientId).toBe('c2');
    expect(parse('Visit smart pack').clientId).toBe('c14');
    expect(parse('Call agro-skhid').clientId).toBe('c1');
  });

  it('does not match a client inside another word', () => {
    expect(parse('Call Agro-Skhidnyi Terminal').clientId).toBeNull();
  });

  it('the longest name wins; an exact tie between two clients is left unresolved', () => {
    const dupes = [
      { id: 'c4', name: 'Poltava Mill LLC' },
      { id: 'c5', name: 'Poltava MILL LLC' },
    ];
    expect(parseQuickTask('Call Poltava Mill', { now: NOW, clients: dupes }).clientId).toBeNull();
  });

  it('dangling "at"/"on" words are cleaned from the title; empty input stays as typed', () => {
    expect(parse('Call Smart Pack on Friday at 11:00').title).toBe('Call Smart Pack');
    expect(parse('tomorrow').title).toBe('tomorrow');
  });
});
