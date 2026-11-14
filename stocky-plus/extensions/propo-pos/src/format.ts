const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Quantities Shopify has not reported are shown as a dash, never as 0. */
export function formatQuantity(value: number | null): string {
  return value === null ? "–" : String(value);
}

/**
 * When Shopify last changed a quantity: "Changed just now", "Changed 12 min
 * ago", "Changed 3 h ago", "Changed 4 d ago". A quantity that has not moved
 * for months is still correct, so an old time is not a warning.
 */
export function formatLastChange(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const changed = Date.parse(iso);
  if (Number.isNaN(changed)) return null;
  const age = Math.max(0, now - changed);
  if (age < MINUTE) return "Changed just now";
  if (age < HOUR) return `Changed ${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `Changed ${Math.floor(age / HOUR)} h ago`;
  return `Changed ${Math.floor(age / DAY)} d ago`;
}
