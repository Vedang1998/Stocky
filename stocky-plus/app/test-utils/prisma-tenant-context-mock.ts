/**
 * Prisma mock helpers for unit tests that exercise TenantDb after PR 3.
 * TenantDb opens a transaction and calls $executeRaw / $queryRaw to set
 * and assert transaction-local tenant context before merchant-domain work.
 *
 * Mocks model the production API ($queryRaw tagged templates). Legacy-scope
 * detects unit mocks via the explicit __stockyUnitMock marker — not by
 * omitting $queryRaw (F-PR3-29(b)).
 */
import { vi } from "vitest";
import {
  GUC_CORRELATION_ID,
  GUC_CONTEXT_VERSION,
  GUC_SHOP_ID,
} from "../tenant/db-context.server";

export const STOCKY_UNIT_PRISMA_MOCK = "__stockyUnitMock" as const;

type TenantContextPrismaMock = {
  $executeRaw: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
  [STOCKY_UNIT_PRISMA_MOCK]?: true;
  [key: string]: unknown;
};

/**
 * Attach $executeRaw / $queryRaw / $transaction behavior so TenantDb can
 * establish and verify phase1-db-tenant-context-v1 against the mock client.
 */
export function attachTenantDbContextMocks<T extends TenantContextPrismaMock>(
  prismaMock: T,
): T {
  let shopId: string | null = null;
  let ctxVer: string | null = null;
  let corr: string | null = null;

  prismaMock[STOCKY_UNIT_PRISMA_MOCK] = true;

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
  prismaMock.$queryRaw = vi.fn(async () => [
    { shop_id: shopId, ctx_ver: ctxVer, corr },
  ]);
  prismaMock.$queryRawUnsafe = vi.fn(async () => [
    { shop_id: shopId, ctx_ver: ctxVer, corr },
  ]);
  prismaMock.$transaction = vi.fn(async (fn: (tx: T) => unknown) =>
    fn(prismaMock),
  );

  return prismaMock;
}
