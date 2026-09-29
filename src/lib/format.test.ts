import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateWeekday,
  formatDateInContext,
  formatDayHeader,
  formatDue,
  formatDueShort,
  formatLongDate,
  formatMoney,
  formatMoneyCompact,
  formatNumericDateTime,
  formatRelativeDay,
  formatTime,
  formatWeekdayDateTime,
} from './format';

// Tests compare against plain spaces for readability.
const plain = (s: string) => s.replace(/ /g, ' ');

// Design "today": Tuesday, September 29, 2026, 10:14 local time.
const NOW = new Date(2026, 8, 29, 10, 14);

describe('formatMoney', () => {
  it('groups thousands with spaces and appends ₴', () => {
    expect(plain(formatMoney(1_250_000))).toBe('1 250 000 ₴');
    expect(plain(formatMoney(8_500_000))).toBe('8 500 000 ₴');
    expect(plain(formatMoney(96_000))).toBe('96 000 ₴');
    expect(plain(formatMoney(950))).toBe('950 ₴');
    expect(plain(formatMoney(0))).toBe('0 ₴');
  });

  it('rounds to whole hryvnias', () => {
    expect(plain(formatMoney(399_006.4))).toBe('399 006 ₴');
    expect(plain(formatMoney(258_749.5))).toBe('258 750 ₴');
  });

  it('formats negatives with a minus sign', () => {
    expect(plain(formatMoney(-1_500))).toBe('−1 500 ₴');
  });

  it('uses non-breaking spaces so amounts never wrap', () => {
    expect(formatMoney(1_250_000)).not.toContain(' ');
  });
});

describe('formatMoneyCompact', () => {
  it('uses M with one decimal for millions', () => {
    expect(plain(formatMoneyCompact(23_200_000))).toBe('23.2M ₴');
    expect(plain(formatMoneyCompact(12_000_000))).toBe('12M ₴');
    expect(plain(formatMoneyCompact(139_240_000))).toBe('139.2M ₴');
  });

  it('uses K for thousands', () => {
    expect(plain(formatMoneyCompact(450_000))).toBe('450K ₴');
    expect(plain(formatMoneyCompact(900_000))).toBe('900K ₴');
  });

  it('falls back to the full format below 1 000', () => {
    expect(plain(formatMoneyCompact(750))).toBe('750 ₴');
  });
});

describe('date formatters', () => {
  it('formatDate → "Sep 18"', () => {
    expect(formatDate(new Date(2026, 8, 18))).toBe('Sep 18');
    expect(formatDate(new Date(2026, 9, 1))).toBe('Oct 1');
  });

  it('formatTime → 24h "09:40"', () => {
    expect(formatTime(new Date(2026, 8, 29, 9, 40))).toBe('09:40');
    expect(formatTime(new Date(2026, 8, 29, 16, 5))).toBe('16:05');
  });

  it('formatDateWeekday → "Sep 28, Mon"', () => {
    expect(formatDateWeekday(new Date(2026, 8, 28))).toBe('Sep 28, Mon');
  });

  it('formatWeekdayDateTime → "Thu, Oct 1 · 11:00"', () => {
    expect(formatWeekdayDateTime(new Date(2026, 9, 1, 11, 0))).toBe('Thu, Oct 1 · 11:00');
  });

  it('formatNumericDateTime → "29.09 10:14"', () => {
    expect(formatNumericDateTime(NOW)).toBe('29.09 10:14');
    expect(formatNumericDateTime(new Date(2026, 0, 5, 7, 3))).toBe('05.01 07:03');
  });

  it('formatLongDate → "Tuesday, September 29"', () => {
    expect(formatLongDate(NOW)).toBe('Tuesday, September 29');
  });
});

describe('relative days', () => {
  it('formatRelativeDay', () => {
    expect(formatRelativeDay(new Date(2026, 8, 29, 8, 0), NOW)).toBe('today');
    expect(formatRelativeDay(new Date(2026, 8, 28), NOW)).toBe('yesterday');
    expect(formatRelativeDay(new Date(2026, 8, 30), NOW)).toBe('tomorrow');
    expect(formatRelativeDay(new Date(2026, 8, 23), NOW)).toBe('6 days ago');
    expect(formatRelativeDay(new Date(2026, 7, 18), NOW)).toBe('42 days ago');
    expect(formatRelativeDay(new Date(2026, 9, 3), NOW)).toBe('in 4 days');
  });

  it('crosses month boundaries', () => {
    expect(formatRelativeDay(new Date(2026, 9, 1), NOW)).toBe('in 2 days');
  });

  it('formatDayHeader → "Today" or "Sep 28, Mon"', () => {
    expect(formatDayHeader(new Date(2026, 8, 29, 9, 52), NOW)).toBe('Today');
    expect(formatDayHeader(new Date(2026, 8, 28, 16, 5), NOW)).toBe('Sep 28, Mon');
  });
});

describe('formatDue', () => {
  it('overdue, today, tomorrow, later', () => {
    expect(formatDue(new Date(2026, 8, 28, 10), NOW)).toBe('yesterday');
    expect(formatDue(new Date(2026, 8, 26, 10), NOW)).toBe('3 days ago');
    expect(formatDue(new Date(2026, 8, 29, 11), NOW)).toBe('Today · 11:00');
    expect(formatDue(new Date(2026, 8, 30, 10), NOW)).toBe('Tomorrow · 10:00');
    expect(formatDue(new Date(2026, 9, 1, 11), NOW)).toBe('Thu, Oct 1 · 11:00');
  });
});

describe('formatDateInContext', () => {
  it('adds the year only for other years', () => {
    expect(formatDateInContext(new Date(2026, 8, 11), NOW)).toBe('Sep 11');
    expect(formatDateInContext(new Date(2025, 8, 22), NOW)).toBe('Sep 22, 2025');
  });
});

describe('formatDueShort', () => {
  it('short labels inside task groups', () => {
    expect(formatDueShort(new Date(2026, 8, 27, 10), NOW)).toBe('2 days ago');
    expect(formatDueShort(new Date(2026, 8, 29, 11), NOW)).toBe('11:00');
    expect(formatDueShort(new Date(2026, 8, 29, 18), NOW)).toBe('by 18:00');
    expect(formatDueShort(new Date(2026, 8, 30, 15), NOW)).toBe('15:00');
    expect(formatDueShort(new Date(2026, 9, 1, 11), NOW)).toBe('Thu, Oct 1 · 11:00');
    expect(formatDueShort(new Date(2026, 9, 14, 10), NOW)).toBe('Oct 14');
  });
});
