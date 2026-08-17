/**
 * Transaction-scoped canonical advisory identity anchor (PR5-F1).
 *
 * Uses pg_advisory_xact_lock(key1, key2) only. Session-level pg_advisory_lock
 * is forbidden.
 *
 * lock_timeout is SET LOCAL only around the advisory acquisition, then the
 * caller's prior transaction-local value is restored on success. The 5000 ms
 * default exists solely to bound canonical advisory-anchor acquisition. It
 * must not silently become the timeout for later FOR UPDATE / observation /
 * candidate row locks in the same transaction (F-CLAUDE-PR5F1-03).
 *
 * Aborted-transaction contract (F-CLAUDE-PR5F1-04):
 * A lock timeout aborts the PostgreSQL transaction (SQLSTATE 55P03, then
 * 25P02 on any later statement). The caller MUST ROLLBACK the entire
 * transaction and retry at the transaction boundary. Do not issue further
 * statements on the aborted transaction. Do not attempt to restore
 * lock_timeout after the timeout — SET LOCAL unwinds on rollback.
 *
 * Callers MUST already be inside the correct tenant transaction. This module
 * does not perform Shopify I/O and must not be held across Shopify I/O.
 */
import { PR5_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS } from "./constants";
import {
  deriveCanonicalLockKey,
  type CanonicalLockIdentity,
  type CanonicalLockKey,
} from "./lock-key";

export class CanonicalAdvisoryLockTimeoutError extends Error {
  readonly code = "canonical_advisory_lock_timeout";
  readonly timeoutMs: number;
  readonly identity: CanonicalLockIdentity;

  constructor(timeoutMs: number, identity: CanonicalLockIdentity) {
    super(
      `Canonical advisory lock timed out after ${timeoutMs}ms (pg_advisory_xact_lock)`,
    );
    this.name = "CanonicalAdvisoryLockTimeoutError";
    this.timeoutMs = timeoutMs;
    this.identity = identity;
  }
}

export class CanonicalAdvisoryLockTenantError extends Error {
  readonly code = "canonical_advisory_lock_tenant_mismatch";

  constructor(message: string) {
    super(message);
    this.name = "CanonicalAdvisoryLockTenantError";
  }
}

/** Tagged-template query surface exposed by in-transaction TenantDb. */
export type CanonicalLockQueryRaw = {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

function isPostgresLockTimeoutError(error: unknown): boolean {
  const err = error as {
    code?: string;
    message?: string;
    meta?: { code?: string; message?: string };
  };
  const code = err.code ?? err.meta?.code;
  const message = `${err.message ?? ""} ${err.meta?.message ?? ""}`;
  return (
    code === "55P03" ||
    /canceling statement due to lock timeout/i.test(message)
  );
}

async function requireMatchingTenantContext(
  db: CanonicalLockQueryRaw,
  shopId: string,
): Promise<void> {
  const rows = (await db.$queryRaw`
    SELECT NULLIF(current_setting('stocky.current_shop_id', true), '') AS shop_id
  `) as Array<{ shop_id: string | null }>;
  const current = rows[0]?.shop_id ?? null;
  if (!current) {
    throw new CanonicalAdvisoryLockTenantError(
      "Canonical advisory lock requires an established tenant transaction",
    );
  }
  if (current !== shopId) {
    throw new CanonicalAdvisoryLockTenantError(
      "Canonical advisory lock shopId does not match transaction tenant context",
    );
  }
}

async function readTransactionLockTimeout(
  db: CanonicalLockQueryRaw,
): Promise<string> {
  const rows = (await db.$queryRaw`
    SELECT current_setting('lock_timeout') AS lock_timeout
  `) as Array<{ lock_timeout: string | null }>;
  const value = rows[0]?.lock_timeout;
  if (value == null) {
    throw new Error("current_setting('lock_timeout') returned no value");
  }
  return value;
}

/**
 * Acquire the canonical identity advisory lock inside an already-open tenant
 * transaction. Applies a temporary transaction-local lock_timeout, then
 * pg_advisory_xact_lock, then restores the prior lock_timeout on success.
 */
export async function acquireCanonicalIdentityAdvisoryLock(
  db: CanonicalLockQueryRaw,
  identity: CanonicalLockIdentity,
  options?: { timeoutMs?: number },
): Promise<CanonicalLockKey> {
  const timeoutMs =
    options?.timeoutMs ?? PR5_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Canonical advisory lock timeoutMs must be an integer >= 1");
  }

  await requireMatchingTenantContext(db, identity.shopId);
  const key = deriveCanonicalLockKey(identity);
  const priorLockTimeout = await readTransactionLockTimeout(db);

  await db.$queryRaw`SELECT set_config('lock_timeout', ${`${timeoutMs}ms`}, true)`;
  try {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(${key.key1}, ${key.key2})`;
  } catch (error) {
    if (isPostgresLockTimeoutError(error)) {
      // Transaction is aborted. Do not restore. Caller must ROLLBACK.
      throw new CanonicalAdvisoryLockTimeoutError(timeoutMs, identity);
    }
    throw error;
  }

  await db.$queryRaw`SELECT set_config('lock_timeout', ${priorLockTimeout}, true)`;
  return key;
}
