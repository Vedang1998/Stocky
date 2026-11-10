/**
 * Issue #73 — first install must survive the parallel `app.tsx` + `app._index`
 * loaders.
 *
 * On a fresh install both loaders call `authenticate.admin` at once. One runs
 * `afterAuth` (Shop + ShopSettings bootstrap); the other skips it (the Shopify
 * library dedupes afterAuth per session token without waiting for it) and goes
 * straight to `requireAdminTenant` and its own ShopSettings creation.
 *
 * Observed on the dev test store (2026-11-10, enforced schema): the two
 * ShopSettings creations raced, Postgres rejected one with
 * `ShopSettings_shop_key` (23505, not a retryable serialization failure),
 * afterAuth threw, the library turned that into an empty 500
 * ("Handling response") with no log line, and the afterAuth catalog sync was
 * never enqueued.
 *
 * Runs on the enforced schema (indexes, roles, RLS) because the conflict
 * surfaces differently on the bare test schema. Each case uses its own shop
 * domain, and merchant rows are only read through the tenant-scoped client.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { runAfterAuthTenantBootstrap } from "../../after-auth.server";
import { requireAdminTenant } from "../../require-admin-tenant.server";
import { ensureShopSettings } from "../../shop-settings.server";
import { createTenantDb } from "../../tenant-db.server";
import { resetAndEnforce } from "./helpers";

const ROUNDS = 10;
const CONCURRENCY = 6;

function adminAuth(shop: string) {
  return async () =>
    ({
      admin: {} as never,
      session: { shop } as never,
    }) as never;
}

describe("first install race (issue #73)", () => {
  let migrationPrisma: PrismaClient;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
  }, 180_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("afterAuth bootstrap and dashboard ShopSettings creation never reject when they overlap", async () => {
    const rejections: unknown[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      const domain = `first-install-race-${round}.myshopify.com`;
      // Shop exists (afterAuth's first step is done); ShopSettings does not.
      const shop = await migrationPrisma.shop.create({
        data: { myshopifyDomain: domain },
      });
      const tenant = issueTenantAuthority({
        shopId: shop.id,
        myshopifyDomain: domain,
        source: "verified_admin_request",
      });
      const db = createTenantDb(tenant);

      const results = await Promise.allSettled([
        runAfterAuthTenantBootstrap({ shop: domain } as never),
        ...Array.from({ length: CONCURRENCY }, () =>
          ensureShopSettings(createTenantDb(tenant), tenant),
        ),
      ]);
      for (const r of results) {
        if (r.status === "rejected") rejections.push(r.reason);
      }

      const rows = await db.shopSettings.findMany({ where: {} });
      expect(rows).toHaveLength(1);
      expect(rows[0].shopId).toBe(shop.id);
    }

    expect(rejections).toEqual([]);
  });

  it("requireAdminTenant waits briefly for an in-flight afterAuth to create the Shop", async () => {
    const domain = "first-install-late-shop.myshopify.com";
    const pending = requireAdminTenant({
      request: new Request("https://example.com/app"),
      authenticateAdmin: adminAuth(domain),
    });
    // Observe the outcome without an unhandled rejection while we wait.
    const settled = pending.then(
      (ctx) => ({ ok: true as const, ctx }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const shop = await migrationPrisma.shop.create({
      data: { myshopifyDomain: domain },
    });

    const outcome = await settled;
    expect(outcome).toMatchObject({ ok: true });
    if (outcome.ok) expect(outcome.ctx.tenant.shopId).toBe(shop.id);
  });

  it("requireAdminTenant still fails closed, without creating a Shop, when the Shop never appears", async () => {
    const domain = "first-install-never-created.myshopify.com";
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app"),
        authenticateAdmin: adminAuth(domain),
      }),
    ).rejects.toMatchObject({ code: "canonical_shop_missing" });
    expect(
      await migrationPrisma.shop.findUnique({
        where: { myshopifyDomain: domain },
      }),
    ).toBeNull();
  });

  it("a failed afterAuth bootstrap is logged without session secrets before it is rethrown", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runAfterAuthTenantBootstrap({
        shop: "https://not-a-shop-domain.example",
        accessToken: "shpat_must_never_be_logged",
      } as never),
    ).rejects.toMatchObject({ name: "TenantAuthorityError" });

    expect(logged).toHaveBeenCalledTimes(1);
    const line = logged.mock.calls[0].map(String).join(" ");
    expect(line).toContain("afterAuth tenant bootstrap failed");
    expect(line).toContain("TenantAuthorityError");
    expect(line).not.toContain("shpat_must_never_be_logged");
  });
});
