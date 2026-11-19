/** Shopify requires a compliance request to be completed within 30 days. */
export const PRIVACY_REQUEST_DUE_DAYS = 30;

export const DEFAULT_UNINSTALLED_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;

/**
 * Days an uninstalled shop's data is kept before it is erased even if
 * Shopify's shop/redact webhook never arrives. Set with
 * PRIVACY_UNINSTALLED_RETENTION_DAYS; an invalid value is a startup error,
 * never a silent fallback.
 */
export function resolveUninstalledRetentionDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.PRIVACY_UNINSTALLED_RETENTION_DAYS?.trim();
  if (!raw) return DEFAULT_UNINSTALLED_RETENTION_DAYS;
  const days = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (
    !Number.isSafeInteger(days) ||
    days < MIN_RETENTION_DAYS ||
    days > MAX_RETENTION_DAYS
  ) {
    throw new Error(
      `PRIVACY_UNINSTALLED_RETENTION_DAYS must be a whole number from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}, got "${raw}"`,
    );
  }
  return days;
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
