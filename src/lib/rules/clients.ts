import { STALE_CONTACT_DAYS } from '../constants';
import { calendarDaysBetween } from '../dates';

/** Days since the last interaction, or null if the client was never contacted. */
export function daysSinceContact(lastContact: Date | null | undefined, now: Date): number | null {
  return lastContact ? Math.max(0, calendarDaysBetween(lastContact, now)) : null;
}

/** "No contact 14+ days": last contact at least 14 days ago, or never. Shown in red. */
export function isStaleContact(lastContact: Date | null | undefined, now: Date): boolean {
  const days = daysSinceContact(lastContact, now);
  return days === null || days >= STALE_CONTACT_DAYS;
}
