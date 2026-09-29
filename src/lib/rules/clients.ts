import { STALE_CONTACT_DAYS } from '../constants';
import { calendarDaysBetween } from '../dates';
import type { Client } from '../types';
import { findDuplicates, normalizeCode, validateCode } from './duplicates';

/** Days since the last interaction, or null if the client was never contacted. */
export function daysSinceContact(lastContact: Date | null | undefined, now: Date): number | null {
  return lastContact ? Math.max(0, calendarDaysBetween(lastContact, now)) : null;
}

/** "No contact 14+ days": last contact at least 14 days ago, or never. Shown in red. */
export function isStaleContact(lastContact: Date | null | undefined, now: Date): boolean {
  const days = daysSinceContact(lastContact, now);
  return days === null || days >= STALE_CONTACT_DAYS;
}

// ── Inline edits on the client card ──────────────────────────

export type EditableClientField =
  'code' | 'industry' | 'region' | 'annualTurnover' | 'businessAgeYears' | 'leadSource';

export type FieldResult = { ok: true; patch: Partial<Client> } | { ok: false; error: string };

const MAX_TEXT = 80;
const MAX_AGE_YEARS = 150;

function text(raw: string, what: string): FieldResult | string {
  const value = raw.trim();
  if (!value) return { ok: false, error: `Enter the ${what}` };
  if (value.length > MAX_TEXT) return { ok: false, error: `Keep it under ${MAX_TEXT} characters` };
  return value;
}

/**
 * Validates one requisite edited in place and returns the patch to apply.
 * EDRPOU / tax ID is checked for format and for duplicates among all clients.
 */
export function validateClientField(
  field: EditableClientField,
  raw: string,
  client: Client,
  allClients: readonly Client[],
): FieldResult {
  switch (field) {
    case 'code': {
      const error = validateCode(raw.trim(), client.legalForm);
      if (error) return { ok: false, error };
      const other = findDuplicates(allClients, raw, client.id)[0];
      if (other) return { ok: false, error: `Already used by “${other.name}”` };
      return { ok: true, patch: { code: normalizeCode(raw) } };
    }
    case 'industry':
    case 'region':
    case 'leadSource': {
      const what = { industry: 'industry', region: 'region', leadSource: 'lead source' }[field];
      const value = text(raw, what);
      return typeof value === 'string' ? { ok: true, patch: { [field]: value } } : value;
    }
    case 'annualTurnover': {
      if (!/^[\d\s]+$/.test(raw.trim()))
        return { ok: false, error: 'Enter the amount in ₴, digits only' };
      return { ok: true, patch: { annualTurnover: Number(raw.replace(/\D/g, '')) } };
    }
    case 'businessAgeYears': {
      const years = Number(raw.trim());
      if (!Number.isInteger(years) || years < 0 || years > MAX_AGE_YEARS) {
        return { ok: false, error: 'Enter whole years' };
      }
      return { ok: true, patch: { businessAgeYears: years } };
    }
  }
}
