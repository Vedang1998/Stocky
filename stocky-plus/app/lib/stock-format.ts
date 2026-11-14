const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Quantities Shopify has not reported are shown as a dash, never as 0. */
export function formatQuantity(value: number | null): string {
  return value === null ? "–" : String(value);
}

/** "just now", "12 min ago", "3 h ago", "4 d ago"; null without a valid time. */
export function formatAge(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const age = Math.max(0, now - then);
  if (age < MINUTE) return "just now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  return `${Math.floor(age / DAY)} d ago`;
}
