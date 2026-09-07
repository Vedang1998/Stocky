/**
 * Transaction-scoped order-domain advisory identity anchor (PR6-A).
 *
 * Uses pg_advisory_xact_lock(key1, key2) only. Session-level pg_advisory_lock
 * is forbidden. No Shopify I/O. Lock-before-first-insert is mandatory for C.
 *
 * Reuses the existing PR5 lock-capacity evaluator unchanged. Do not invent a
 * competing capacity formula in this module.
 */
import { PR6_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS } from "./constants";
import {
  deriveOrderLockKey,
  type OrderLockIdentity,
  type OrderLockKey,
} from "./lock-key";

export {
  CanonicalLockCapacityInsufficientError,
  evaluateCanonicalLockCapacity,
  readPostgresLockCapacitySettings,
} from "../catalog-facts/lock-capacity";

export class OrderAdvisoryLockTimeoutError extends Error {
  readonly code = "order_advisory_lock_timeout";
  readonly timeoutMs: number;
  readonly identity: OrderLockIdentity;

  constructor(timeoutMs: number, identity: OrderLockIdentity) {
    super(
      `Order advisory lock timed out after ${timeoutMs}ms (pg_advisory_xact_lock)`,
    );
    this.name = "OrderAdvisoryLockTimeoutError";
    this.timeoutMs = timeoutMs;
    this.identity = identity;
  }
}

export class OrderAdvisoryLockTenantError extends Error {
  readonly code = "order_advisory_lock_tenant_mismatch";

  constructor(message: string) {
    super(message);
    this.name = "OrderAdvisoryLockTenantError";
  }
}

/** Tagged-template query surface exposed by in-transaction TenantDb. */
export type OrderLockQueryRaw = {
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
  db: OrderLockQueryRaw,
  shopId: string,
): Promise<void> {
  const rows = (await db.$queryRaw`
    SELECT NULLIF(current_setting('stocky.current_shop_id', true), '') AS shop_id
  `) as Array<{ shop_id: string | null }>;
  const current = rows[0]?.shop_id ?? null;
  if (!current) {
    throw new OrderAdvisoryLockTenantError(
      "Order advisory lock requires an established tenant transaction",
    );
  }
  if (current !== shopId) {
    throw new OrderAdvisoryLockTenantError(
      "Order advisory lock shopId does not match transaction tenant context",
    );
  }
}

async function readTransactionLockTimeout(
  db: OrderLockQueryRaw,
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
 * Acquire the order-domain identity advisory lock inside an already-open tenant
 * transaction. Applies a temporary transaction-local lock_timeout, then
 * pg_advisory_xact_lock, then restores the prior lock_timeout on success.
 *
 * C must acquire this lock before the first insert of a canonical identity.
 */
export async function acquireOrderIdentityAdvisoryLock(
  db: OrderLockQueryRaw,
  identity: OrderLockIdentity,
  options?: { timeoutMs?: number },
): Promise<OrderLockKey> {
  const timeoutMs =
    options?.timeoutMs ?? PR6_CANONICAL_ADVISORY_LOCK_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Order advisory lock timeoutMs must be an integer >= 1");
  }

  await requireMatchingTenantContext(db, identity.shopId);
  const key = deriveOrderLockKey(identity);
  const priorLockTimeout = await readTransactionLockTimeout(db);

  await db.$queryRaw`SELECT set_config('lock_timeout', ${`${timeoutMs}ms`}, true)`;
  try {
    await db.$queryRaw`
      WITH _order_identity_lock AS (
        SELECT pg_advisory_xact_lock(CAST(${key.key1} AS INTEGER), CAST(${key.key2} AS INTEGER))
      )
      SELECT 1 AS acquired FROM _order_identity_lock
    `;
  } catch (error) {
    if (isPostgresLockTimeoutError(error)) {
      throw new OrderAdvisoryLockTimeoutError(timeoutMs, identity);
    }
    throw error;
  }

  await db.$queryRaw`SELECT set_config('lock_timeout', ${priorLockTimeout}, true)`;
  return key;
}
