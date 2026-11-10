const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Quantities Shopify has not reported are shown as a dash, never as 0. */
export function formatQuantity(value: number | null): string {
  return value === null ? "–" : String(value);
}

/** "Updated just now", "Updated 12 min ago", "Updated 3 h ago", "Updated 4 d ago". */
export function formatObservedAt(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const observed = Date.parse(iso);
  if (Number.isNaN(observed)) return null;
  const age = Math.max(0, now - observed);
  if (age < MINUTE) return "Updated just now";
  if (age < HOUR) return `Updated ${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `Updated ${Math.floor(age / HOUR)} h ago`;
  return `Updated ${Math.floor(age / DAY)} d ago`;
}

/** Quantity is older than this when the screen should say so. */
export const STALE_AFTER_MS = 6 * HOUR;

export function isStale(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const observed = Date.parse(iso);
  return !Number.isNaN(observed) && now - observed > STALE_AFTER_MS;
}
