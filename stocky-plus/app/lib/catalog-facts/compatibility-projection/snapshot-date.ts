/**
 * Legacy snapshot-date boundary.
 *
 * Current webhook/forecast consumers key `InventorySnapshot.snapshotDate` with
 * the process-local start of the calendar day (`setHours(0, 0, 0, 0)`), not a
 * merchant-timezone conversion. This core reproduces that exact consumer
 * contract so today's projection lands on the same unique key.
 */

export function legacySnapshotDate(now: Date): Date {
  const d = new Date(now.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}
