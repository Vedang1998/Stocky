/**
 * Issue #73: a first install must survive afterAuth's ShopSettings bootstrap
 * overlapping another request that creates the same row.
 *
 * Observed on the dev test store (2026-11-10, enforced schema): two
 * ShopSettings creations raced, Postgres rejected one with
 * `ShopSettings_shop_key` (23505, not a retryable serialization failure),
 * afterAuth threw, the Shopify library turned that into an empty 500 with no
 * log line, and the afterAuth catalog sync was never enqueued.
 *
 * Runs on the enforced schema (indexes, roles, RLS) because the conflict
 * surfaces differently on the bare test schema. Each round uses its own shop
 * domain, and merchant rows are only read through the tenant-scoped client.
 *
 * Ported from #82 (afterAuth part only).
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
import { ensureShopSettings } from "../../shop-settings.server";
import { createTenantDb } from "../../tenant-db.server";
import { persistEntitlementSnapshot } from "../../../billing/entitlements.server";
import { resetAndEnforce } from "./helpers";

const ROUNDS = 10;
const CONCURRENCY = 6;

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

  it("afterAuth bootstrap and other ShopSettings creators never reject when they overlap", async () => {
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
        // The Billing and Home loaders store an entitlement snapshot.
        persistEntitlementSnapshot(createTenantDb(tenant), {
          subscriptionActive: false,
          subscriptionPlan: null,
        }),
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
