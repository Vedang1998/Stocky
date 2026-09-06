/**
 * Legacy snapshot-date boundary.
 *
 * Current webhook/forecast consumers key `InventorySnapshot.snapshotDate` with
 * the process-local start of the calendar day (`setHours(0, 0, 0, 0)`), not a
 * merchant-timezone conversion. This core reproduces that exact consumer
 * contract so today's projection lands on the same unique key.
 *
 * Local-midnight into `@db.Date` is pre-existing deferred compatibility debt
 * shared with the live webhook. F2C does not solve the timezone/calendar-day
 * problem; diverging from the legacy consumer would break the compatibility
 * contract this module exists to honor.
 */

export function legacySnapshotDate(now: Date): Date {
  const d = new Date(now.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}
