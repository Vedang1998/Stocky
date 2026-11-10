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
 * ("Handling response") and the afterAuth catalog sync was never enqueued.
 *
 * Runs on the enforced schema (indexes, roles, RLS) because the conflict
 * surfaces differently on the bare test schema.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { runAfterAuthTenantBootstrap } from "../../after-auth.server";
import { requireAdminTenant } from "../../require-admin-tenant.server";
import { ensureShopSettings } from "../../shop-settings.server";
import { createTenantDb } from "../../tenant-db.server";
import { resetAndEnforce } from "./helpers";

const NEW_SHOP_DOMAIN = "first-install-race.myshopify.com";
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

  beforeEach(async () => {
    await migrationPrisma.shopSettings.deleteMany();
    await migrationPrisma.shop.deleteMany();
  });

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("afterAuth bootstrap and dashboard ShopSettings creation never reject when they overlap", async () => {
    const rejections: unknown[] = [];
    for (let round = 0; round < ROUNDS; round++) {
      await migrationPrisma.shopSettings.deleteMany();
      await migrationPrisma.shop.deleteMany();
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

      const results = await Promise.allSettled([
        runAfterAuthTenantBootstrap({ shop: domain } as never),
        ...Array.from({ length: CONCURRENCY }, () =>
          ensureShopSettings(createTenantDb(tenant), tenant),
        ),
      ]);
      for (const r of results) {
        if (r.status === "rejected") rejections.push(r.reason);
      }
      expect(
        await migrationPrisma.shopSettings.count({ where: { shopId: shop.id } }),
      ).toBe(1);
    }

    expect(rejections).toEqual([]);
  });

  it("requireAdminTenant waits briefly for an in-flight afterAuth to create the Shop", async () => {
    const pending = requireAdminTenant({
      request: new Request("https://example.com/app"),
      authenticateAdmin: adminAuth(NEW_SHOP_DOMAIN),
    });
    // Observe the outcome without an unhandled rejection while we wait.
    const settled = pending.then(
      (ctx) => ({ ok: true as const, ctx }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const shop = await migrationPrisma.shop.create({
      data: { myshopifyDomain: NEW_SHOP_DOMAIN },
    });

    const outcome = await settled;
    expect(outcome).toMatchObject({ ok: true });
    if (outcome.ok) expect(outcome.ctx.tenant.shopId).toBe(shop.id);
  });

  it("requireAdminTenant still fails closed, without creating a Shop, when the Shop never appears", async () => {
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app"),
        authenticateAdmin: adminAuth(NEW_SHOP_DOMAIN),
      }),
    ).rejects.toMatchObject({ code: "canonical_shop_missing" });
    expect(await migrationPrisma.shop.count()).toBe(0);
  });
});
