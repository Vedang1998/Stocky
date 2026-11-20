/**
 * The stored plan snapshot under full enforcement, when a shop's plan has
 * just changed and several of its requests record the new plan at once.
 * Every page that resolves entitlements stores the snapshot, so a burst of
 * requests after an upgrade or a cancellation all write the same row.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { persistEntitlementSnapshot } from "../../../billing/entitlements.server";
import type { EntitlementSnapshot } from "../../../billing/entitlements";
import { issueTenantAuthority } from "../../authority.server";
import { createTenantDb } from "../../tenant-db.server";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedActivePlans,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const REQUESTS_AT_ONCE = 12;

describe("stored plan snapshot under concurrent requests", () => {
  let migrationPrisma: PrismaClient;
  let runtimePrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  function tenantDb(shopId: string, myshopifyDomain: string) {
    requireRuntimeUrl();
    return createTenantDb(
      issueTenantAuthority({
        shopId,
        myshopifyDomain,
        source: "verified_admin_request",
      }),
    );
  }
  const dbA = () => tenantDb(shopAId, SHOP_A_DOMAIN);
  const dbB = () => tenantDb(shopBId, SHOP_B_DOMAIN);

  async function stored(
    db: ReturnType<typeof tenantDb>,
  ): Promise<EntitlementSnapshot | null> {
    return db.shopSettings.findUnique({
      where: { shop: db.authority.myshopifyDomain },
      select: { subscriptionActive: true, subscriptionPlan: true },
    });
  }

  function rejections(results: PromiseSettledResult<void>[]): unknown[] {
    return results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
  }

  beforeAll(async () => {
    ({ migrationPrisma, runtimePrisma } = await resetAndEnforce());
    const { shopA, shopB } = await seedTwoShops(migrationPrisma);
    shopAId = shopA.id;
    shopBId = shopB.id;
    // Both shops start on Growth; each test changes shop A's plan.
    await seedActivePlans(migrationPrisma, [shopA, shopB]);
  }, 120_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
    await runtimePrisma?.$disconnect();
  });

  it("records an upgrade once for every request that arrives with it", async () => {
    const upgraded = { subscriptionActive: true, subscriptionPlan: "pro" };

    const results = await Promise.allSettled(
      Array.from({ length: REQUESTS_AT_ONCE }, () =>
        persistEntitlementSnapshot(dbA(), upgraded),
      ),
    );

    expect(rejections(results)).toEqual([]);
    expect(await stored(dbA())).toEqual(upgraded);
  });

  it("records a cancellation the same way", async () => {
    const cancelled = { subscriptionActive: false, subscriptionPlan: null };

    const results = await Promise.allSettled(
      Array.from({ length: REQUESTS_AT_ONCE }, () =>
        persistEntitlementSnapshot(dbA(), cancelled),
      ),
    );

    expect(rejections(results)).toEqual([]);
    expect(await stored(dbA())).toEqual(cancelled);
  });

  it("leaves the other shop's plan as it was", async () => {
    expect(await stored(dbB())).toEqual({
      subscriptionActive: true,
      subscriptionPlan: "growth",
    });
  });
});
