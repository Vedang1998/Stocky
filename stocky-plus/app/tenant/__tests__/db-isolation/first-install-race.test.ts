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
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import { persistEntitlementSnapshot } from "../../../billing/entitlements.server";
import { resetAndEnforce } from "./helpers";

const ROUNDS = 10;
const CONCURRENCY = 6;

/**
 * Counts `shopSettings.findUnique` calls, which `ensureShopSettings` makes
 * only after losing the create to another request (its P2002 branch).
 */
function countingReadBacks(db: TenantDb, counter: { readBacks: number }) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== "shopSettings") return value;
      return new Proxy(value, {
        get(delegate, method, delegateReceiver) {
          const fn = Reflect.get(delegate, method, delegateReceiver);
          if (method !== "findUnique") return fn;
          return (...args: unknown[]) => {
            counter.readBacks += 1;
            return fn.apply(delegate, args);
          };
        },
      });
    },
  });
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

  it("afterAuth bootstrap and other ShopSettings creators never reject when they overlap", async () => {
    const rejections: unknown[] = [];
    const counter = { readBacks: 0 };
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
          ensureShopSettings(
            countingReadBacks(createTenantDb(tenant), counter),
          ),
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
    // The race really happened: some creator lost and took the read-back path.
    expect(counter.readBacks).toBeGreaterThan(0);
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

  it("never takes over a settings row that belongs to another shop, and logs the refusal without the token", async () => {
    const domain = "first-install-race-foreign.myshopify.com";
    const shop = await migrationPrisma.shop.create({
      data: { myshopifyDomain: domain },
    });
    const other = await migrationPrisma.shop.create({
      data: { myshopifyDomain: "first-install-race-owner.myshopify.com" },
    });
    // A row keyed by this domain but owned by another shop, which this
    // tenant cannot see: the create loses on the unique key and the
    // read-back through the tenant client finds nothing.
    await migrationPrisma.shopSettings.create({
      data: { shop: domain, shopId: other.id },
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runAfterAuthTenantBootstrap({
        shop: domain,
        accessToken: "shpat_must_never_be_logged",
      } as never),
    ).rejects.toMatchObject({ code: "P2002" });

    const row = await migrationPrisma.shopSettings.findUniqueOrThrow({
      where: { shop: domain },
    });
    expect(row.shopId).toBe(other.id);
    expect(row.shopId).not.toBe(shop.id);
    const lines = logged.mock.calls.map((call) => call.map(String).join(" "));
    expect(
      lines.some((l) => l.includes("afterAuth tenant bootstrap failed")),
    ).toBe(true);
    expect(lines.join("\n")).not.toContain("shpat_must_never_be_logged");
  });
});
