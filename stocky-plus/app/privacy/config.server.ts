/** Shopify requires a compliance request to be completed within 30 days. */
export const PRIVACY_REQUEST_DUE_DAYS = 30;

/**
 * Shopify's API Terms (section 6.2.3) require all copies of a merchant's data
 * to be deleted within 30 days of uninstall. The window stops two days short
 * of that so the erasure, and its retries after a failure, finish in time.
 */
const MAX_RETENTION_DAYS = 28;
const MIN_RETENTION_DAYS = 1;

/**
 * Days (28 unless shortened) an uninstalled shop's data is kept before it is erased even if
 * Shopify's shop/redact webhook never arrives. Set with
 * PRIVACY_UNINSTALLED_RETENTION_DAYS to shorten it; a value outside 1 to 28
 * is a startup error, never a silent fallback.
 */
export function resolveUninstalledRetentionDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.PRIVACY_UNINSTALLED_RETENTION_DAYS?.trim();
  if (!raw) return MAX_RETENTION_DAYS;
  const days = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!isAllowedRetentionDays(days)) {
    throw new Error(
      `PRIVACY_UNINSTALLED_RETENTION_DAYS must be a whole number from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}, got "${raw}"`,
    );
  }
  return days;
}

function isAllowedRetentionDays(days: number): boolean {
  return (
    Number.isSafeInteger(days) &&
    days >= MIN_RETENTION_DAYS &&
    days <= MAX_RETENTION_DAYS
  );
}

/**
 * The same limit for callers that pass the window directly, so no path can
 * keep an uninstalled shop's data past Shopify's 30 days.
 */
export function assertRetentionDays(days: number): void {
  if (!isAllowedRetentionDays(days)) {
    throw new RangeError(
      `Retention must be a whole number of days from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}, got ${days}`,
    );
  }
}

/** How often the worker looks for privacy work. 0 turns the loop off. */
export function resolvePrivacyIntervalMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.STOCKY_PRIVACY_INTERVAL_MS?.trim();
  if (!raw) return 60_000;
  const ms = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(ms)) {
    throw new Error(
      `STOCKY_PRIVACY_INTERVAL_MS must be a whole number of milliseconds, got "${raw}"`,
    );
  }
  return ms;
}
