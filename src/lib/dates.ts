// Calendar math in local time. Pure: every function takes its reference dates as arguments.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from `from` to `to`: negative = past, 0 = same day. DST-safe. */
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/** Same calendar day as `date`, at hh:mm local time. */
export function atTime(date: Date, hours: number, minutes = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

/** Adds calendar days, keeping the local time of day. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Adds Mon–Fri days (public holidays are not modelled). Starting on a weekend counts from Monday. */
export function addWorkingDays(date: Date, days: number): Date {
  let d = new Date(date);
  let left = days;
  while (left > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) left -= 1;
  }
  return d;
}
