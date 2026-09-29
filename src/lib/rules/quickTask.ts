// Quick-add parser for the Tasks screen: "Call Agro-Skhid tomorrow 15:00" → a task.
// Pure: everything it needs (now, clients) is passed in.

import { END_OF_DAY_HOUR, FIRST_CALL_HOUR, type TaskPriority } from '../constants';
import { addDays, atTime } from '../dates';
import type { Client, TaskType } from '../types';

export interface QuickTaskContext {
  now: Date;
  /** Clients the user may see (role-scoped). */
  clients: readonly Pick<Client, 'id' | 'name'>[];
}

export interface ParsedQuickTask {
  /** Input without the date, time and priority words. */
  title: string;
  type: TaskType;
  clientId: string | null;
  due: Date | null;
  priority: TaskPriority;
  /** What the parser understood, for the preview chips. */
  recognized: { date: boolean; time: boolean; client: boolean };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

interface Match {
  start: number;
  end: number;
}

/** Finds the first match and remembers where it was so it can be cut from the title. */
function take(text: string, re: RegExp, cut: Match[]): RegExpExecArray | null {
  const m = re.exec(text);
  if (m) cut.push({ start: m.index, end: m.index + m[0].length });
  return m;
}

function parseTime(text: string, cut: Match[]): { h: number; m: number } | null {
  const hhmm = take(text, /\b(?:at\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/i, cut);
  if (hhmm) return { h: Number(hhmm[1]), m: Number(hhmm[2]) };
  const ampm = take(text, /\b(?:at\s+)?(1[0-2]|0?[1-9])\s*(am|pm)\b/i, cut);
  if (ampm) {
    const h = Number(ampm[1]) % 12;
    return { h: ampm[2]!.toLowerCase() === 'pm' ? h + 12 : h, m: 0 };
  }
  const at = take(text, /\bat\s+([01]?\d|2[0-3])\b/i, cut);
  if (at) return { h: Number(at[1]), m: 0 };
  return null;
}

function parseDate(text: string, now: Date, cut: Match[]): Date | null {
  if (take(text, /\btoday\b/i, cut)) return now;
  if (take(text, /\btomorrow\b/i, cut)) return addDays(now, 1);
  const inDays = take(text, /\bin\s+(\d{1,2})\s+days?\b/i, cut);
  if (inDays) return addDays(now, Number(inDays[1]));
  if (take(text, /\bnext\s+week\b/i, cut)) {
    const toMonday = (8 - now.getDay()) % 7 || 7;
    return addDays(now, toMonday);
  }
  const weekday = take(
    text,
    /\b(?:on\s+|next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?\b/i,
    cut,
  );
  if (weekday) {
    const target = WEEKDAYS.findIndex((d) => d.startsWith(weekday[1]!.toLowerCase().slice(0, 3)));
    const diff = (target - now.getDay() + 7) % 7 || 7; // the next one, never today
    return addDays(now, diff);
  }
  // "Oct 3", "October 3", "3 Oct": scan every candidate, keep the first real month.
  const candidates = [
    ...text.matchAll(/\b(?:on\s+)?([a-z]{3})[a-z]*\.?\s+(\d{1,2})\b/gi),
    ...text.matchAll(/\b(?:on\s+)?(\d{1,2})\s+([a-z]{3})[a-z]*\b/gi),
  ].sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
  for (const m of candidates) {
    const [a, b] = [m[1]!, m[2]!];
    const monthName = /\d/.test(a) ? b : a;
    const day = Number(/\d/.test(a) ? a : b);
    const month = MONTHS.indexOf(monthName.toLowerCase());
    if (month < 0 || day < 1 || day > 31) continue;
    cut.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
    const date = new Date(now.getFullYear(), month, day);
    return date < atTime(now, 0) ? new Date(now.getFullYear() + 1, month, day) : date;
  }
  return null;
}

function parsePriority(text: string, cut: Match[]): TaskPriority {
  if (take(text, /\b(?:urgent|urgently|asap|important)\b|(?:^|\s)!+(?=\s|$)/i, cut)) return 'high';
  if (take(text, /\blow\s+priority\b/i, cut)) return 'low';
  return 'med';
}

function parseType(text: string): TaskType {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (/^(call|phone|ring|dial)/.test(first)) return 'call';
  if (/^(meet|meeting|visit)/.test(first)) return 'meeting';
  if (/^(email|e-mail|mail|send|write)/.test(first)) return 'email';
  return 'other';
}

/** Names a user might type for a client: full name, without "LLC" / "(sole prop.)", first word. */
function clientKeys(name: string): string[] {
  const n = name.toLowerCase().replace(/[“”"«»]/g, '');
  const bare = n
    .replace(/\s*\(sole prop\.\)\s*/g, ' ')
    .replace(/\s+llc\b/g, '')
    .trim();
  const first = bare.split(/\s+/)[0] ?? '';
  return [...new Set([n, bare, first.length >= 5 ? first : ''])].filter(Boolean);
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The client whose name appears in the text; the longest match wins. Ambiguous ties → none. */
function parseClient(text: string, clients: QuickTaskContext['clients']): string | null {
  const lower = text.toLowerCase();
  let best: { id: string; len: number; tie: boolean } | null = null;
  for (const c of clients) {
    for (const key of clientKeys(c.name)) {
      if (!new RegExp(`(^|[^a-z0-9])${escape(key)}($|[^a-z0-9])`).test(lower)) continue;
      if (!best || key.length > best.len) best = { id: c.id, len: key.length, tie: false };
      else if (key.length === best.len && best.id !== c.id) best.tie = true;
    }
  }
  return best && !best.tie ? best.id : null;
}

function cleanTitle(text: string, cut: Match[]): string {
  let out = text;
  for (const m of [...cut].sort((a, b) => b.start - a.start))
    out = out.slice(0, m.start) + ' ' + out.slice(m.end);
  out = out
    .replace(/\b(on|at|by)\s*$/i, '')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[,;]$/, '');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function parseQuickTask(input: string, ctx: QuickTaskContext): ParsedQuickTask {
  const text = input.trim();
  const cut: Match[] = [];
  const time = parseTime(text, cut);
  const date = parseDate(text, ctx.now, cut);
  const priority = parsePriority(text, cut);

  let due: Date | null = null;
  if (date && time) due = atTime(date, time.h, time.m);
  else if (date) {
    const isToday = date.toDateString() === ctx.now.toDateString();
    due = atTime(date, isToday ? END_OF_DAY_HOUR : FIRST_CALL_HOUR);
  } else if (time) {
    const today = atTime(ctx.now, time.h, time.m);
    due = today > ctx.now ? today : addDays(today, 1); // "15:00" after 15:00 means tomorrow
  }

  const title = cleanTitle(text, cut) || text;
  const clientId = parseClient(text, ctx.clients);
  return {
    title,
    type: parseType(title),
    clientId,
    due,
    priority,
    recognized: { date: Boolean(date), time: Boolean(time), client: clientId !== null },
  };
}
