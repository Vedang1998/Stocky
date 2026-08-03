/**
 * Prisma mock helpers for unit tests that exercise TenantDb after PR 3.
 * TenantDb opens a transaction and calls $executeRaw / $queryRawUnsafe to set
 * and assert transaction-local tenant context before merchant-domain work.
 *
 * Intentionally does NOT install $queryRaw — legacy-scope treats a missing
 * $queryRaw as a mocked client and uses acceptedLegacyShopVariants().
 */
import { vi } from "vitest";
import {
  GUC_CORRELATION_ID,
  GUC_CONTEXT_VERSION,
  GUC_SHOP_ID,
} from "../tenant/db-context.server";

type TenantContextPrismaMock = {
  $executeRaw: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
};

/**
 * Attach $executeRaw / $queryRawUnsafe / $transaction behavior so TenantDb can
 * establish and verify phase1-db-tenant-context-v1 against the mock client.
 */
export function attachTenantDbContextMocks<T extends TenantContextPrismaMock>(
  prismaMock: T,
): T {
  let shopId: string | null = null;
  let ctxVer: string | null = null;
  let corr: string | null = null;

  prismaMock.$executeRaw = vi.fn(
    async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = values[0];
      const value = values[1] == null ? null : String(values[1]);
      if (key === GUC_SHOP_ID) shopId = value;
      if (key === GUC_CONTEXT_VERSION) ctxVer = value;
      if (key === GUC_CORRELATION_ID) corr = value;
      return 0;
    },
  );
  prismaMock.$executeRawUnsafe = vi.fn(async () => 0);
  prismaMock.$queryRawUnsafe = vi.fn(async () => [
    { shop_id: shopId, ctx_ver: ctxVer, corr },
  ]);
  prismaMock.$transaction = vi.fn(async (fn: (tx: T) => unknown) =>
    fn(prismaMock),
  );

  // Ensure legacy-scope mock-client fallback remains available.
  delete (prismaMock as { $queryRaw?: unknown }).$queryRaw;

  return prismaMock;
}
