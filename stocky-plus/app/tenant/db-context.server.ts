/**
 * Transaction-local tenant database context (D-017 / PR 3).
 *
 * Contract version: phase1-db-tenant-context-v1
 *
 * Trust boundary (honest):
 * - PostgreSQL GUCs do NOT authenticate Shopify identity.
 * - Application TenantAuthority validation remains required before setting context.
 * - set_config(..., is_local=true) is transaction-local and does not survive commit/rollback
 *   or pooled connection reuse without a new transaction.
 * - RLS enforces row filters after context is established; runtime role cannot BYPASSRLS.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { assertTenantAuthority, type TenantAuthority } from "./authority.server";
import { TenantAccessError } from "./errors";

export const TENANT_DB_CONTEXT_VERSION = "phase1-db-tenant-context-v1";
export const GUC_SHOP_ID = "stocky.current_shop_id";
export const GUC_CONTEXT_VERSION = "stocky.tenant_context_version";
export const GUC_CORRELATION_ID = "stocky.correlation_id";

type TxClient = Prisma.TransactionClient;

export type TenantDbContextSnapshot = {
  shopId: string | null;
  contextVersion: string | null;
  correlationId: string | null;
};

/**
 * Establish transaction-local tenant context. Must run before any merchant-domain query.
 */
export async function setTransactionLocalTenantContext(
  tx: TxClient,
  authority: TenantAuthority,
): Promise<void> {
  assertTenantAuthority(authority);

  // is_local=true → transaction-scoped; cleared on commit/rollback.
  await tx.$executeRaw`SELECT set_config(${GUC_SHOP_ID}, ${authority.shopId}, true)`;
  await tx.$executeRaw`SELECT set_config(${GUC_CONTEXT_VERSION}, ${TENANT_DB_CONTEXT_VERSION}, true)`;
  await tx.$executeRaw`SELECT set_config(${GUC_CORRELATION_ID}, ${authority.correlationId}, true)`;
}

export async function readTransactionLocalTenantContext(
  tx: TxClient,
): Promise<TenantDbContextSnapshot> {
  // Prefer tagged/bound $queryRaw (production safety). Unit-test mocks must
  // model the production API — do not reshape production for mock convenience
  // (F-PR3-29(b)).
  const rows = await tx.$queryRaw<
    { shop_id: string | null; ctx_ver: string | null; corr: string | null }[]
  >`
    SELECT
      NULLIF(current_setting(${GUC_SHOP_ID}, true), '') AS shop_id,
      NULLIF(current_setting(${GUC_CONTEXT_VERSION}, true), '') AS ctx_ver,
      NULLIF(current_setting(${GUC_CORRELATION_ID}, true), '') AS corr
  `;
  const row = rows[0];
  return {
    shopId: row?.shop_id ?? null,
    contextVersion: row?.ctx_ver ?? null,
    correlationId: row?.corr ?? null,
  };
}

export async function assertTransactionLocalTenantContext(
  tx: TxClient,
  authority: TenantAuthority,
): Promise<void> {
  assertTenantAuthority(authority);
  const snap = await readTransactionLocalTenantContext(tx);
  if (!snap.shopId || !snap.contextVersion) {
    throw new TenantAccessError(
      "tenant_context_missing",
      "Transaction-local tenant context is missing",
    );
  }
  if (snap.contextVersion !== TENANT_DB_CONTEXT_VERSION) {
    throw new TenantAccessError(
      "tenant_context_version_mismatch",
      "Transaction-local tenant context version mismatch",
    );
  }
  if (snap.shopId !== authority.shopId) {
    throw new TenantAccessError(
      "tenant_context_mismatch",
      "Transaction-local tenant context does not match TenantAuthority",
    );
  }
}

/**
 * Begin a Prisma interactive transaction, set tenant context, verify, then run fn.
 */
export async function withTenantBoundTransaction<T>(
  prisma: PrismaClient,
  authority: TenantAuthority,
  fn: (tx: TxClient) => Promise<T>,
  options?: {
    isolationLevel?: Prisma.TransactionIsolationLevel;
    maxWait?: number;
    timeout?: number;
  },
): Promise<T> {
  assertTenantAuthority(authority);
  return prisma.$transaction(
    async (tx) => {
      await setTransactionLocalTenantContext(tx, authority);
      await assertTransactionLocalTenantContext(tx, authority);
      return fn(tx);
    },
    {
      isolationLevel: options?.isolationLevel,
      maxWait: options?.maxWait ?? 5_000,
      timeout: options?.timeout ?? 15_000,
    },
  );
}
