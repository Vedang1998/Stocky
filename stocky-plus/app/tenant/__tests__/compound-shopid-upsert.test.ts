/**
 * Upsert through a registered shopId-bearing compound unique selector.
 *
 * Regression: catalog sync against a live dev store failed with
 * `unsafe_upsert` ("Upsert on ShopifyProductCollectionMembership requires a
 * tenant-bearing unique selector") because the upsert guard only accepted
 * `{ shopId, id }`, `shopId_id`, or legacy `shop` compounds — never the
 * registered `shopId_shopifyProductGid_shopifyCollectionGid` selector used by
 * `replaceProductCollectionMemberships`.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import { replaceProductCollectionMemberships } from "../../lib/catalog-facts/ingest/collection-memberships";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
} from "./helpers";

const PRODUCT_GID = "gid://shopify/Product/compound-upsert-1";
const COLLECTION_1 = "gid://shopify/Collection/compound-upsert-1";
const COLLECTION_2 = "gid://shopify/Collection/compound-upsert-2";

describe("upsert via shopId-bearing compound unique selector", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.shopifyProductCollectionMembership.deleteMany();
    await prisma.shopifyProductFact.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    for (const shopId of [shopAId, shopBId]) {
      await prisma.shopifyProductFact.create({
        data: {
          shopId,
          shopifyGid: PRODUCT_GID,
          title: "Product",
          handle: "compound-upsert-1",
          tags: [],
          status: "ACTIVE",
          existenceState: "LIVE",
          existenceKind: "LIVE_FULL_SYNC_PRESENT",
          existenceObservedAt: new Date(),
          sourceKind: "FULL_SYNC",
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authorityA() {
    return issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_admin_request",
    });
  }

  function membershipSelector(shopId: string, collectionGid: string) {
    return {
      shopId_shopifyProductGid_shopifyCollectionGid: {
        shopId,
        shopifyProductGid: PRODUCT_GID,
        shopifyCollectionGid: collectionGid,
      },
    };
  }

  it("creates then updates the same own-tenant row", async () => {
    const db = createTenantDb(authorityA());
    const created = await db.shopifyProductCollectionMembership.upsert({
      where: membershipSelector(shopAId, COLLECTION_1),
      create: {
        shopifyProductGid: PRODUCT_GID,
        shopifyCollectionGid: COLLECTION_1,
        collectionTitleSnapshot: "First",
      },
      update: { collectionTitleSnapshot: "First" },
    });
    expect(created.shopId).toBe(shopAId);

    const updated = await db.shopifyProductCollectionMembership.upsert({
      where: membershipSelector(shopAId, COLLECTION_1),
      create: {
        shopifyProductGid: PRODUCT_GID,
        shopifyCollectionGid: COLLECTION_1,
        collectionTitleSnapshot: "Renamed",
      },
      update: { collectionTitleSnapshot: "Renamed" },
    });
    expect(updated.id).toBe(created.id);
    expect(updated.collectionTitleSnapshot).toBe("Renamed");
    expect(
      await prisma.shopifyProductCollectionMembership.count({
        where: { shopId: shopAId },
      }),
    ).toBe(1);
  });

  it("rejects a foreign shopId in the compound selector and leaves the foreign row untouched", async () => {
    const foreign = await prisma.shopifyProductCollectionMembership.create({
      data: {
        shopId: shopBId,
        shopifyProductGid: PRODUCT_GID,
        shopifyCollectionGid: COLLECTION_1,
        collectionTitleSnapshot: "Foreign",
      },
    });

    await expect(
      createTenantDb(authorityA()).shopifyProductCollectionMembership.upsert({
        where: membershipSelector(shopBId, COLLECTION_1),
        create: {
          shopifyProductGid: PRODUCT_GID,
          shopifyCollectionGid: COLLECTION_1,
          collectionTitleSnapshot: "Hijack",
        },
        update: { collectionTitleSnapshot: "Hijack" },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    const after = await prisma.shopifyProductCollectionMembership.findUnique({
      where: { id: foreign.id },
    });
    expect(after?.collectionTitleSnapshot).toBe("Foreign");
    expect(
      await prisma.shopifyProductCollectionMembership.count({
        where: { shopId: shopAId },
      }),
    ).toBe(0);
  });

  it("still rejects a compound selector that omits shopId", async () => {
    await expect(
      createTenantDb(authorityA()).shopifyProductCollectionMembership.upsert({
        where: {
          shopId_shopifyProductGid_shopifyCollectionGid: {
            shopifyProductGid: PRODUCT_GID,
            shopifyCollectionGid: COLLECTION_1,
          },
        } as never,
        create: {
          shopifyProductGid: PRODUCT_GID,
          shopifyCollectionGid: COLLECTION_1,
          collectionTitleSnapshot: "NoShop",
        },
        update: { collectionTitleSnapshot: "NoShop" },
      }),
    ).rejects.toBeTruthy();
    expect(await prisma.shopifyProductCollectionMembership.count()).toBe(0);
  });

  it("replaceProductCollectionMemberships writes, renames and prunes a product's set", async () => {
    await replaceProductCollectionMemberships(authorityA(), {
      productGid: PRODUCT_GID,
      memberships: [
        { collectionGid: COLLECTION_1, title: "One" },
        { collectionGid: COLLECTION_2, title: "Two" },
      ],
    });
    await replaceProductCollectionMemberships(authorityA(), {
      productGid: PRODUCT_GID,
      memberships: [{ collectionGid: COLLECTION_1, title: "One renamed" }],
    });

    const rows = await prisma.shopifyProductCollectionMembership.findMany({
      where: { shopId: shopAId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].shopifyCollectionGid).toBe(COLLECTION_1);
    expect(rows[0].collectionTitleSnapshot).toBe("One renamed");
  });
});
