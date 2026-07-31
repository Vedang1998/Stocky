/**
 * Finite, validated timeouts for tenant index maintenance sessions.
 * Production values remain subject to a later deployment plan.
 */

/** Documented default for disposable / staging validation (30 minutes). */
export const DEFAULT_TENANT_INDEX_STATEMENT_TIMEOUT_MS = 1_800_000;

/** Hard upper bound for Phase 1 tooling (2 hours). */
export const MAX_TENANT_INDEX_STATEMENT_TIMEOUT_MS = 7_200_000;

/** Documented default lock_timeout (5 seconds). */
export const DEFAULT_TENANT_INDEX_LOCK_TIMEOUT_MS = 5_000;

/** Hard upper bound for lock_timeout (60 seconds). */
export const MAX_TENANT_INDEX_LOCK_TIMEOUT_MS = 60_000;

export function parsePositiveBoundedTimeoutMs(
  raw: string | undefined,
  envName: string,
  defaultMs: number,
  maxMs: number,
): number {
  if (raw === undefined || raw.trim() === "") {
    return defaultMs;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `${envName} must be a positive integer milliseconds value (got ${JSON.stringify(raw)})`,
    );
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `${envName} must be a positive integer; zero and negative values are rejected`,
    );
  }
  if (value > maxMs) {
    throw new Error(
      `${envName}=${value} exceeds maximum allowed ${maxMs}ms for Phase 1 index tooling`,
    );
  }
  return value;
}

export function resolveStatementTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveBoundedTimeoutMs(
    env.TENANT_INDEX_STATEMENT_TIMEOUT_MS,
    "TENANT_INDEX_STATEMENT_TIMEOUT_MS",
    DEFAULT_TENANT_INDEX_STATEMENT_TIMEOUT_MS,
    MAX_TENANT_INDEX_STATEMENT_TIMEOUT_MS,
  );
}

export function resolveLockTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveBoundedTimeoutMs(
    env.TENANT_INDEX_LOCK_TIMEOUT_MS,
    "TENANT_INDEX_LOCK_TIMEOUT_MS",
    DEFAULT_TENANT_INDEX_LOCK_TIMEOUT_MS,
    MAX_TENANT_INDEX_LOCK_TIMEOUT_MS,
  );
}

/** PostgreSQL accepts an integer-ms literal via SET … = 'Nms'. */
export function formatPostgresTimeoutMs(ms: number): string {
  if (!Number.isSafeInteger(ms) || ms <= 0) {
    throw new Error(`Invalid PostgreSQL timeout ms: ${ms}`);
  }
  return `${ms}ms`;
}
