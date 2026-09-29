// Money and date formatters. Output strings match docs/design/handoff (dates) and
// AGENTS.md (money: space-grouped digits). Every date helper takes `now` explicitly
// so results are deterministic in tests and consistent across a single render.

import { calendarDaysBetween } from './dates';

/** Non-breaking space: keeps "1 250 000 ₴" on one line. */
const NBSP = ' ';
const CURRENCY = '₴';

function groupDigits(n: number): string {
  return String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 1250000 → "1 250 000 ₴" (rounded to whole hryvnias). */
export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '−' : '';
  return `${sign}${groupDigits(rounded)}${NBSP}${CURRENCY}`;
}

/** Dense widgets (kanban totals, funnel): 23200000 → "23.2M ₴", 450000 → "450K ₴". */
export function formatMoneyCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (abs >= 1_000_000) {
    const millions = Math.round((abs / 1_000_000) * 10) / 10;
    return `${sign}${millions}M${NBSP}${CURRENCY}`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K${NBSP}${CURRENCY}`;
  return formatMoney(amount);
}

const LOCALE = 'en-US';
const shortDate = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' });
const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const longDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const time = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "Sep 18" */
export function formatDate(date: Date): string {
  return shortDate.format(date);
}

/** "09:40" */
export function formatTime(date: Date): string {
  return time.format(date);
}

/** "Sep 28, Mon" (timeline day header) */
export function formatDateWeekday(date: Date): string {
  return `${shortDate.format(date)}, ${weekdayShort.format(date)}`;
}

/** "Thu, Oct 1 · 11:00" (due date with time) */
export function formatWeekdayDateTime(date: Date): string {
  return `${weekdayShort.format(date)}, ${shortDate.format(date)} · ${time.format(date)}`;
}

/** "Tuesday, September 29" (dashboard subtitle) */
export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

/** "today", "yesterday", "tomorrow", "3 days ago", "in 4 days" */
export function formatRelativeDay(date: Date, now: Date): string {
  const diff = calendarDaysBetween(now, date);
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
}

/** Timeline group header: "Today", otherwise "Sep 28, Mon". */
export function formatDayHeader(date: Date, now: Date): string {
  return calendarDaysBetween(now, date) === 0 ? 'Today' : formatDateWeekday(date);
}

/** "29.09 10:14" (error codes, technical timestamps) */
export function formatNumericDateTime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm} ${formatTime(date)}`;
}

/** Region as shown on the client card: "Kharkiv" → "Kharkiv Oblast", "Kyiv" → "Kyiv City". */
export function formatRegion(region: string): string {
  const r = region.trim();
  if (!r || /\b(Oblast|City)$/.test(r)) return r;
  return r === 'Kyiv' ? 'Kyiv City' : `${r} Oblast`;
}

/**
 * Task due label: "yesterday", "3 days ago" when overdue; "Today · 11:00", "Tomorrow · 10:00";
 * later dates as "Thu, Oct 1 · 11:00".
 */
export function formatDue(due: Date, now: Date): string {
  const diff = calendarDaysBetween(now, due);
  if (diff < 0) return formatRelativeDay(due, now);
  if (diff === 0) return `Today · ${formatTime(due)}`;
  if (diff === 1) return `Tomorrow · ${formatTime(due)}`;
  return formatWeekdayDateTime(due);
}

/** "Sep 11" this year, "Sep 22, 2025" otherwise — for history lists that span years. */
export function formatDateInContext(date: Date, now: Date): string {
  return date.getFullYear() === now.getFullYear()
    ? formatDate(date)
    : `${formatDate(date)}, ${date.getFullYear()}`;
}

/**
 * Due date inside a task group (the group already says "Today", "Tomorrow"…):
 * overdue → "yesterday" / "3 days ago"; today & tomorrow → "11:00" ("by 18:00" for end of day);
 * this week → "Thu, Oct 1 · 11:00"; later → "Oct 14".
 */
export function formatDueShort(due: Date, now: Date): string {
  const diff = calendarDaysBetween(now, due);
  if (diff < 0) return formatRelativeDay(due, now);
  const time = formatTime(due);
  const clock = time === '18:00' ? 'by 18:00' : time;
  if (diff <= 1) return clock;
  if (diff < 7) return formatWeekdayDateTime(due);
  return formatDate(due);
}
