// Duplicate detection across ALL clients. This is the one deliberate cross-scope read:
// a manager must learn that an EDRPOU already exists even when another manager owns it.
// It exposes only what the design shows: the other record's name, owner and lead source.

import { duplicateGroups, findDuplicates, normalizeCode } from '../rules/duplicates';
import type { Client, Id } from '../types';
import type { Dataset } from './dataset';
import { canViewClient, type Session } from './scope';
import { findUser } from './selectors';

export interface DuplicateMatch {
  id: Id;
  name: string;
  code: string;
  ownerId: Id;
  ownerName: string;
  leadSource: string;
  /** Whether the session may open this record. */
  canView: boolean;
}

function toMatch(data: Dataset, session: Session, c: Client): DuplicateMatch {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    ownerId: c.ownerId,
    ownerName: findUser(data, c.ownerId)?.name ?? 'another manager',
    leadSource: c.leadSource,
    canView: canViewClient(session, c),
  };
}

/** For each client the session can see: the other records sharing its code. */
export function duplicatesByClient(data: Dataset, session: Session): Map<Id, DuplicateMatch[]> {
  const result = new Map<Id, DuplicateMatch[]>();
  for (const group of duplicateGroups(data.clients).values()) {
    for (const client of group) {
      if (!canViewClient(session, client)) continue;
      result.set(
        client.id,
        group.filter((c) => c.id !== client.id).map((c) => toMatch(data, session, c)),
      );
    }
  }
  return result;
}

/** Existing clients with this code — for the New client form, before saving. */
export function existingWithCode(data: Dataset, session: Session, code: string): DuplicateMatch[] {
  if (!normalizeCode(code)) return [];
  return findDuplicates(data.clients, code).map((c) => toMatch(data, session, c));
}
