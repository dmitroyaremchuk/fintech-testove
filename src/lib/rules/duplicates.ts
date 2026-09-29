// Duplicate clients are detected by EDRPOU / tax ID (AGENTS.md rule 4).

import type { LegalForm } from '../constants';
import type { Client } from '../types';

/** Digits only: "40 218 763" and "40218763" are the same code. */
export function normalizeCode(code: string): string {
  return code.replace(/\D/g, '');
}

const CODE_LENGTH: Record<LegalForm, { digits: number; name: string }> = {
  LLC: { digits: 8, name: 'EDRPOU' },
  'Sole prop.': { digits: 10, name: 'Tax ID' },
};

/** "EDRPOU" for companies, "Tax ID" (IPN) for sole proprietors. */
export function codeLabel(form: LegalForm): string {
  return CODE_LENGTH[form].name;
}

/** Format check: 8 digits for an LLC (EDRPOU), 10 for a sole proprietor (IPN). null = valid. */
export function validateCode(code: string, form: LegalForm): string | null {
  const digits = normalizeCode(code);
  const { digits: expected, name } = CODE_LENGTH[form];
  if (!digits) return `Enter the ${name}`;
  if (digits.length !== expected || digits !== code.trim()) {
    return `${name} must be exactly ${expected} digits`;
  }
  return null;
}

/** Other clients with the same code. */
export function findDuplicates<T extends Pick<Client, 'id' | 'code'>>(
  clients: readonly T[],
  code: string,
  excludeId?: string,
): T[] {
  const key = normalizeCode(code);
  if (!key) return [];
  return clients.filter((c) => c.id !== excludeId && normalizeCode(c.code) === key);
}

/** Codes shared by two or more clients → those clients. */
export function duplicateGroups<T extends Pick<Client, 'id' | 'code'>>(
  clients: readonly T[],
): Map<string, T[]> {
  const byCode = new Map<string, T[]>();
  for (const c of clients) {
    const key = normalizeCode(c.code);
    byCode.set(key, [...(byCode.get(key) ?? []), c]);
  }
  return new Map([...byCode].filter(([, list]) => list.length > 1));
}
