/**
 * Finite timeouts for tenant enforcement maintenance sessions.
 */
export const DEFAULT_ENFORCEMENT_STATEMENT_TIMEOUT_MS = 1_800_000;
export const MAX_ENFORCEMENT_STATEMENT_TIMEOUT_MS = 7_200_000;
export const DEFAULT_ENFORCEMENT_LOCK_TIMEOUT_MS = 5_000;
export const MAX_ENFORCEMENT_LOCK_TIMEOUT_MS = 60_000;

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
      `${envName}=${value} exceeds maximum allowed ${maxMs}ms for Phase 1 enforcement tooling`,
    );
  }
  return value;
}

export function resolveEnforcementStatementTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveBoundedTimeoutMs(
    env.TENANT_ENFORCEMENT_STATEMENT_TIMEOUT_MS,
    "TENANT_ENFORCEMENT_STATEMENT_TIMEOUT_MS",
    DEFAULT_ENFORCEMENT_STATEMENT_TIMEOUT_MS,
    MAX_ENFORCEMENT_STATEMENT_TIMEOUT_MS,
  );
}

export function resolveEnforcementLockTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveBoundedTimeoutMs(
    env.TENANT_ENFORCEMENT_LOCK_TIMEOUT_MS,
    "TENANT_ENFORCEMENT_LOCK_TIMEOUT_MS",
    DEFAULT_ENFORCEMENT_LOCK_TIMEOUT_MS,
    MAX_ENFORCEMENT_LOCK_TIMEOUT_MS,
  );
}

export function formatPostgresTimeoutMs(ms: number): string {
  if (!Number.isSafeInteger(ms) || ms <= 0) {
    throw new Error(`Invalid PostgreSQL timeout ms: ${ms}`);
  }
  return `${ms}ms`;
}
