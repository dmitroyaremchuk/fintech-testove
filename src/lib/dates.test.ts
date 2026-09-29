import { describe, expect, it } from 'vitest';
import { addWorkingDays, atTime, calendarDaysBetween } from './dates';

const TUE = new Date(2026, 8, 29, 10, 14);

describe('calendarDaysBetween', () => {
  it('counts calendar days, not 24h periods', () => {
    expect(calendarDaysBetween(TUE, new Date(2026, 8, 28, 23, 59))).toBe(-1);
    expect(calendarDaysBetween(TUE, new Date(2026, 8, 29, 0, 1))).toBe(0);
    expect(calendarDaysBetween(new Date(2026, 8, 9), TUE)).toBe(20);
  });

  it('crosses month boundaries', () => {
    expect(calendarDaysBetween(TUE, new Date(2026, 9, 3))).toBe(4);
  });
});

describe('addWorkingDays', () => {
  it('skips weekends', () => {
    expect(addWorkingDays(TUE, 3)).toEqual(new Date(2026, 9, 2, 10, 14)); // Fri
    expect(addWorkingDays(new Date(2026, 9, 2, 9), 3)).toEqual(new Date(2026, 9, 7, 9)); // Fri → Wed
  });

  it('counts from Monday when starting on a weekend', () => {
    expect(addWorkingDays(new Date(2026, 9, 3, 9), 1)).toEqual(new Date(2026, 9, 5, 9)); // Sat → Mon
  });

  it('returns the same moment for 0 days', () => {
    expect(addWorkingDays(TUE, 0)).toEqual(TUE);
  });
});

describe('atTime', () => {
  it('keeps the day, sets the local time', () => {
    expect(atTime(TUE, 18)).toEqual(new Date(2026, 8, 29, 18, 0));
  });
});
