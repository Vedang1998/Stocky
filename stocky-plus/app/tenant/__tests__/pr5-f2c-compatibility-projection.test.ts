import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import {
  CANONICAL_HEALTH_DECISION,
  CANONICAL_PROJECTION_STATE_WRITE,
  createTenantDbLegacyWriter,
  projectCompatibilityFromCanonicalFacts,
  type CompatibilityProjectionResult,
  type LegacyCompatibilityWriter,
} from "../../lib/catalog-facts/compatibility-projection";
import { legacySnapshotDate } from "../../lib/catalog-facts/compatibility-projection/snapshot-date";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const NOW = new Date("2026-08-17T15:30:00.000Z");
const TODAY = legacySnapshotDate(NOW);

function assertNoMerchantHealthAuthorization(
  result: CompatibilityProjectionResult,
) {
  expect(result).not.toHaveProperty("recommendedCanonicalProjectionState");
  expect(result.canonicalHealthDecision).toBe(CANONICAL_HEALTH_DECISION);
  expect(result.canonicalHealthDecision).toBe("deferred_to_integration");
  expect(result.canonicalCompatibilityProjectionStateWrite).toBe(
    CANONICAL_PROJECTION_STATE_WRITE,
  );
  const json = JSON.stringify(result);
  expect(json).not.toMatch(/"HEALTHY"/);
  expect(json).not.toMatch(/recommendedCanonicalProjectionState/);
}

describe("PR5-F2C compatibility projection TenantDb core", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.lowStockAlert.deleteMany();
    await prisma.forecastOverride.deleteMany();
    await prisma.variantAbcClass.deleteMany();
    await prisma.inventorySnapshot.deleteMany();
    await prisma.shopifyVariantCache.deleteMany();
    await prisma.catalogObservationInFlight.deleteMany();
    await prisma.shopifyProductCollectionMembership.deleteMany();
    await prisma.shopifyInventoryLevelFact.deleteMany();
    await prisma.shopifyInventoryItemFact.deleteMany();
    await prisma.shopifyVariantFact.deleteMany();
    await prisma.shopifyProductFact.deleteMany();
    await prisma.shopifyLocationFact.deleteMany();
    await prisma.shop.deleteMany();

    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authorityA() {
    return issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
    });
  }

  function authorityB() {
    return issueTenantAuthority({
      shopId: shopBId,
      myshopifyDomain: SHOP_B_DOMAIN,
      source: "verified_job",
    });
  }

  it("projects a live canonical variant onto ShopifyVariantCache", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "v1");
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.canonicalFactsUnchanged).toBe(true);
    assertNoMerchantHealthAuthorization(result);
    expect(result.processedVariantCount).toBe(1);

    const cache = await prisma.shopifyVariantCache.findFirst({
      where: { shopId: shopAId, shopifyVariantId: seeded.variantGid },
    });
    expect(cache).toMatchObject({
      shop: SHOP_A_DOMAIN,
      shopifyProductId: seeded.productGid,
      title: "Widget — Blue",
      sku: "SKU-v1",
      barcode: "BAR-v1",
      imageUrl: "https://cdn.example/widget.jpg",
      inventoryItemId: seeded.itemGid,
      weightUnit: "GRAMS",
    });
    expect(cache?.weight && new Prisma.Decimal(cache.weight).equals("1.25")).toBe(
      true,
    );
  });

  it("projects canonical available quantity onto today's InventorySnapshot", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "snap");
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [
        {
          kind: "InventoryLevel",
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      ],
    });

    expect(result.status).toBe("SUCCEEDED");
    expect(result.processedInventoryLevelCount).toBe(1);
    const snap = await prisma.inventorySnapshot.findFirst({
      where: {
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        locationId: seeded.locationGid,
        snapshotDate: TODAY,
      },
    });
    expect(snap?.quantityAvailable).toBe(17);
  });

  it("is idempotent when the same identities are projected twice", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "idemp");
    const identities = [
      { kind: "ProductVariant" as const, shopifyGid: seeded.variantGid },
      {
        kind: "InventoryLevel" as const,
        inventoryItemGid: seeded.itemGid,
        locationGid: seeded.locationGid,
      },
    ];
    const first = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities,
    });
    const second = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities,
    });
    expect(first.status).toBe("SUCCEEDED");
    expect(second.status).toBe("SUCCEEDED");
    expect(await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } })).toBe(1);
    expect(await prisma.inventorySnapshot.count({ where: { shopId: shopAId } })).toBe(1);
    const snap = await prisma.inventorySnapshot.findFirst({
      where: { shopId: shopAId },
    });
    expect(snap?.quantityAvailable).toBe(17);
  });

  it("lets a newer canonical value replace a stale legacy projection", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "newer");
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        title: "STALE TITLE",
        sku: "OLD",
      },
    });
    await prisma.inventorySnapshot.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        locationId: seeded.locationGid,
        snapshotDate: TODAY,
        quantityAvailable: 1,
      },
    });

    await prisma.shopifyVariantFact.update({
      where: { shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.variantGid } },
      data: { title: "Red", sku: "SKU-NEW" },
    });
    await prisma.shopifyInventoryLevelFact.update({
      where: {
        shopId_inventoryItemGid_locationGid: {
          shopId: shopAId,
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      },
      data: { availableQuantity: 99 },
    });

    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [
        { kind: "ProductVariant", shopifyGid: seeded.variantGid },
        {
          kind: "InventoryLevel",
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      ],
    });
    expect(result.status).toBe("SUCCEEDED");
    const cache = await prisma.shopifyVariantCache.findFirst({
      where: { shopId: shopAId },
    });
    expect(cache?.title).toBe("Widget — Red");
    expect(cache?.sku).toBe("SKU-NEW");
    const snap = await prisma.inventorySnapshot.findFirst({
      where: { shopId: shopAId, snapshotDate: TODAY },
    });
    expect(snap?.quantityAvailable).toBe(99);
  });

  it("does not let a tombstoned canonical variant masquerade as live cache truth", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "tomb");
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        title: "Still showing in Buying Table",
        barcode: "BAR-tomb",
      },
    });
    await prisma.inventorySnapshot.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        locationId: seeded.locationGid,
        snapshotDate: TODAY,
        quantityAvailable: 44,
      },
    });
    await tombstoneVariant(prisma, shopAId, seeded.variantGid);

    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.skippedTombstoneCount).toBe(1);
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: seeded.variantGid },
      }),
    ).toBeNull();
    const snap = await prisma.inventorySnapshot.findFirst({
      where: { shopId: shopAId, snapshotDate: TODAY },
    });
    expect(snap?.quantityAvailable).toBe(0);
  });

  it("does not present a disconnected inventory level as live available quantity", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "disc");
    await prisma.inventorySnapshot.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        locationId: seeded.locationGid,
        snapshotDate: TODAY,
        quantityAvailable: 12,
      },
    });
    await tombstoneLevel(prisma, shopAId, seeded.itemGid, seeded.locationGid);

    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [
        {
          kind: "InventoryLevel",
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      ],
    });
    expect(result.status).toBe("SUCCEEDED");
    const snap = await prisma.inventorySnapshot.findFirst({
      where: { shopId: shopAId, snapshotDate: TODAY },
    });
    expect(snap?.quantityAvailable).toBe(0);
    expect(
      await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } }),
    ).toBe(0);
  });

  it("leaves canonical facts untouched when projection writes fail", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "fail");
    const before = await canonicalFingerprint(prisma, seeded);

    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
      writer: throwingWriter("injected projection failure"),
    });

    expect(result.status).toBe("FAILED");
    expect(result.retryable).toBe(true);
    assertNoMerchantHealthAuthorization(result);
    expect(result.canonicalFactsUnchanged).toBe(true);
    expect(result.failure?.code).toBe("projection_write_failed");
    expect(await canonicalFingerprint(prisma, seeded)).toEqual(before);
    expect(await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } })).toBe(0);
  });

  it("repairs stale legacy rows on retry after a failed projection", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "retry");
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        title: "STALE",
      },
    });
    const before = await canonicalFingerprint(prisma, seeded);

    const failed = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
      writer: throwingWriter("first attempt fails"),
    });
    expect(failed.status).toBe("FAILED");
    expect(
      (await prisma.shopifyVariantCache.findFirst({ where: { shopId: shopAId } }))
        ?.title,
    ).toBe("STALE");

    const repaired = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
    });
    expect(repaired.status).toBe("SUCCEEDED");
    expect(
      (await prisma.shopifyVariantCache.findFirst({ where: { shopId: shopAId } }))
        ?.title,
    ).toBe("Widget — Blue");
    expect(await canonicalFingerprint(prisma, seeded)).toEqual(before);
  });

  it("rebuilds a shop catalog in bounded pages", async () => {
    const one = await seedLiveGraph(prisma, shopAId, "b1");
    const two = await seedLiveGraph(prisma, shopAId, "b2");
    const three = await seedLiveGraph(prisma, shopAId, "b3");

    const page1 = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      limit: 2,
      mode: "shop_rebuild",
    });
    expect(page1.status).toBe("SUCCEEDED");
    expect(page1.hasMore).toBe(true);
    expect(page1.processedVariantCount).toBe(2);
    expect(page1.cursor?.phase).toBe("variants");
    assertNoMerchantHealthAuthorization(page1);

    const page2 = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      limit: 2,
      mode: "shop_rebuild",
      cursor: page1.cursor,
    });
    expect(page2.status).toBe("SUCCEEDED");
    expect(page2.processedVariantCount + page2.processedInventoryLevelCount).toBe(2);

    let cursor = page2.cursor;
    let hasMore = page2.hasMore;
    let lastPage = page2;
    let guard = 0;
    while (hasMore && guard < 10) {
      const page = await projectCompatibilityFromCanonicalFacts({
        authority: authorityA(),
        processingEnabled: true,
        now: NOW,
        limit: 2,
        mode: "shop_rebuild",
        cursor,
      });
      expect(page.status).toBe("SUCCEEDED");
      lastPage = page;
      cursor = page.cursor;
      hasMore = page.hasMore;
      guard += 1;
    }
    expect(hasMore).toBe(false);
    expect(lastPage.hasMore).toBe(false);
    assertNoMerchantHealthAuthorization(lastPage);
    expect(await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } })).toBe(3);
    expect(
      await prisma.inventorySnapshot.count({
        where: { shopId: shopAId, snapshotDate: TODAY },
      }),
    ).toBe(3);
    const gids = [one.variantGid, two.variantGid, three.variantGid];
    for (const gid of gids) {
      expect(
        await prisma.shopifyVariantCache.findFirst({
          where: { shopId: shopAId, shopifyVariantId: gid },
        }),
      ).not.toBeNull();
    }
  });

  it("isolates projection writes to the authenticated shop", async () => {
    const seededA = await seedLiveGraph(prisma, shopAId, "iso-a");
    const seededB = await seedLiveGraph(prisma, shopBId, "iso-b");

    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "shop_rebuild",
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(
      await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } }),
    ).toBe(1);
    expect(
      await prisma.shopifyVariantCache.count({ where: { shopId: shopBId } }),
    ).toBe(0);
    expect(
      await prisma.inventorySnapshot.count({ where: { shopId: shopBId } }),
    ).toBe(0);
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopifyVariantId: seededB.variantGid },
      }),
    ).toBeNull();
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopifyVariantId: seededA.variantGid },
      }),
    ).not.toBeNull();

    const crossed = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seededB.variantGid }],
    });
    expect(crossed.status).toBe("FAILED");
    expect(crossed.failure?.code).toBe("canonical_variant_missing");
    expect(
      await prisma.shopifyVariantCache.count({ where: { shopId: shopBId } }),
    ).toBe(0);

    const shopB = await projectCompatibilityFromCanonicalFacts({
      authority: authorityB(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seededB.variantGid }],
    });
    expect(shopB.status).toBe("SUCCEEDED");
    expect(
      await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } }),
    ).toBe(1);
    expect(
      await prisma.shopifyVariantCache.count({ where: { shopId: shopBId } }),
    ).toBe(1);

    const factB = await prisma.shopifyVariantFact.findUnique({
      where: {
        shopId_shopifyGid: { shopId: shopBId, shopifyGid: seededB.variantGid },
      },
    });
    expect(factB?.title).toBe("Blue");
    expect(factB?.compatibilityProjectionState).toBe("HEALTHY");
  });

  it("does not write forecast, ABC, or LowStockAlert rows", async () => {
    await seedLiveGraph(prisma, shopAId, "side");
    await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "shop_rebuild",
    });
    expect(await prisma.variantAbcClass.count()).toBe(0);
    expect(await prisma.forecastOverride.count()).toBe(0);
    expect(await prisma.lowStockAlert.count()).toBe(0);
  });

  it("does not write canonical compatibilityProjectionState", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "state");
    await prisma.shopifyVariantFact.update({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.variantGid },
      },
      data: { compatibilityProjectionState: "HEALTHY" },
    });
    await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
    });
    const fact = await prisma.shopifyVariantFact.findUnique({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.variantGid },
      },
    });
    expect(fact?.compatibilityProjectionState).toBe("HEALTHY");
    const failed = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
      writer: throwingWriter("no state write"),
    });
    expect(failed.status).toBe("FAILED");
    const afterFail = await prisma.shopifyVariantFact.findUnique({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.variantGid },
      },
    });
    expect(afterFail?.compatibilityProjectionState).toBe("HEALTHY");
  });

  it("refuses merchant writes when processingEnabled is not true", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "deny");
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: false,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
    });
    expect(result.status).toBe("DENIED_PROCESSING_DISABLED");
    expect(result.retryable).toBe(false);
    assertNoMerchantHealthAuthorization(result);
    expect(await prisma.shopifyVariantCache.count({ where: { shopId: shopAId } })).toBe(0);
  });

  it("uses TenantDb for legacy writes (default writer path)", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "tdb");
    const writer = createTenantDbLegacyWriter(createTenantDb(authorityA()));
    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [{ kind: "ProductVariant", shopifyGid: seeded.variantGid }],
      writer,
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId },
      }),
    ).not.toBeNull();
  });

  it("does not authorize merchant health when a bounded shop_rebuild page has hasMore=true", async () => {
    await seedLiveGraph(prisma, shopAId, "h1");
    await seedLiveGraph(prisma, shopAId, "h2");

    const page = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      limit: 1,
      mode: "shop_rebuild",
    });
    expect(page.status).toBe("SUCCEEDED");
    expect(page.hasMore).toBe(true);
    expect(page.cursor).not.toBeNull();
    assertNoMerchantHealthAuthorization(page);
    expect(page.canonicalFactsUnchanged).toBe(true);
  });

  it("fails closed when a live inventory level has no known shopifyVariantGid and leaves stale snapshots unrepaired until retry", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "link");
    const unrelatedVariantGid = "gid://shopify/ProductVariant/unrelated-legacy";
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: unrelatedVariantGid,
        title: "UNRELATED",
        sku: "DO-NOT-USE-AS-IDENTITY",
      },
    });
    await prisma.inventorySnapshot.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        locationId: seeded.locationGid,
        snapshotDate: TODAY,
        quantityAvailable: 99,
      },
    });
    await prisma.shopifyInventoryItemFact.update({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.itemGid },
      },
      data: {
        shopifyVariantGid: null,
        sku: "FABRICATE-ME",
      },
    });
    const before = await canonicalFingerprint(prisma, seeded);

    const failed = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [
        {
          kind: "InventoryLevel",
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      ],
    });

    expect(failed.status).toBe("FAILED");
    expect(failed.retryable).toBe(true);
    expect(failed.failure?.code).toBe("canonical_variant_link_missing");
    expect(failed.failure?.retryable).toBe(true);
    expect(failed.failure?.identity).toEqual({
      kind: "InventoryLevel",
      inventoryItemGid: seeded.itemGid,
      locationGid: seeded.locationGid,
    });
    expect(failed.processedInventoryLevelCount).toBe(0);
    assertNoMerchantHealthAuthorization(failed);
    expect(await canonicalFingerprint(prisma, seeded)).toEqual(before);
    expect(
      (
        await prisma.inventorySnapshot.findFirst({
          where: {
            shopId: shopAId,
            shopifyVariantId: seeded.variantGid,
            locationId: seeded.locationGid,
            snapshotDate: TODAY,
          },
        })
      )?.quantityAvailable,
    ).toBe(99);
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: unrelatedVariantGid },
      }),
    ).toMatchObject({ title: "UNRELATED" });
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: "FABRICATE-ME" },
      }),
    ).toBeNull();
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: "SKU-link" },
      }),
    ).toBeNull();
    expect(
      await prisma.inventorySnapshot.findFirst({
        where: { shopId: shopAId, shopifyVariantId: "FABRICATE-ME" },
      }),
    ).toBeNull();

    await prisma.shopifyInventoryItemFact.update({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.itemGid },
      },
      data: { shopifyVariantGid: seeded.variantGid },
    });
    const afterLink = await canonicalFingerprint(prisma, seeded);

    const repaired = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [
        {
          kind: "InventoryLevel",
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      ],
    });
    expect(repaired.status).toBe("SUCCEEDED");
    expect(repaired.processedInventoryLevelCount).toBe(1);
    assertNoMerchantHealthAuthorization(repaired);
    expect(await canonicalFingerprint(prisma, seeded)).toEqual(afterLink);
    expect(
      (
        await prisma.inventorySnapshot.findFirst({
          where: {
            shopId: shopAId,
            shopifyVariantId: seeded.variantGid,
            locationId: seeded.locationGid,
            snapshotDate: TODAY,
          },
        })
      )?.quantityAvailable,
    ).toBe(17);
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: unrelatedVariantGid },
      }),
    ).toMatchObject({ title: "UNRELATED" });
  });

  it("preserves already committed canonical facts and resumes from the failed identity", async () => {
    const seeded = await seedLiveGraph(prisma, shopAId, "mid");
    await prisma.inventorySnapshot.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: seeded.variantGid,
        locationId: seeded.locationGid,
        snapshotDate: TODAY,
        quantityAvailable: 41,
      },
    });
    await prisma.shopifyInventoryItemFact.update({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.itemGid },
      },
      data: { shopifyVariantGid: null },
    });
    const before = await canonicalFingerprint(prisma, seeded);

    const failed = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: [
        { kind: "ProductVariant", shopifyGid: seeded.variantGid },
        {
          kind: "InventoryLevel",
          inventoryItemGid: seeded.itemGid,
          locationGid: seeded.locationGid,
        },
      ],
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.retryable).toBe(true);
    expect(failed.processedVariantCount).toBe(1);
    expect(failed.processedInventoryLevelCount).toBe(0);
    expect(failed.remainingIdentities[0]).toEqual({
      kind: "InventoryLevel",
      inventoryItemGid: seeded.itemGid,
      locationGid: seeded.locationGid,
    });
    expect(failed.failure?.code).toBe("canonical_variant_link_missing");
    expect(failed.failure?.identity).toEqual(failed.remainingIdentities[0]);
    assertNoMerchantHealthAuthorization(failed);
    expect(await canonicalFingerprint(prisma, seeded)).toEqual(before);
    expect(
      (
        await prisma.shopifyVariantCache.findFirst({
          where: { shopId: shopAId, shopifyVariantId: seeded.variantGid },
        })
      )?.title,
    ).toBe("Widget — Blue");
    expect(
      (
        await prisma.inventorySnapshot.findFirst({
          where: { shopId: shopAId, snapshotDate: TODAY },
        })
      )?.quantityAvailable,
    ).toBe(41);

    await prisma.shopifyInventoryItemFact.update({
      where: {
        shopId_shopifyGid: { shopId: shopAId, shopifyGid: seeded.itemGid },
      },
      data: { shopifyVariantGid: seeded.variantGid },
    });

    const repaired = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "identities",
      identities: failed.remainingIdentities,
    });
    expect(repaired.status).toBe("SUCCEEDED");
    expect(repaired.hasMore).toBe(false);
    assertNoMerchantHealthAuthorization(repaired);
    expect(
      (
        await prisma.inventorySnapshot.findFirst({
          where: { shopId: shopAId, snapshotDate: TODAY },
        })
      )?.quantityAvailable,
    ).toBe(17);
  });

  it("does not treat an orphan legacy row as canonical authority or delete it during shop_rebuild", async () => {
    const orphanVariantGid = "gid://shopify/ProductVariant/orphan-legacy";
    const orphanLocationGid = "gid://shopify/Location/orphan-legacy";
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: orphanVariantGid,
        title: "ORPHAN CACHE",
        sku: "ORPHAN-SKU",
      },
    });
    await prisma.inventorySnapshot.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: orphanVariantGid,
        locationId: orphanLocationGid,
        snapshotDate: TODAY,
        quantityAvailable: 77,
      },
    });
    const live = await seedLiveGraph(prisma, shopAId, "canon");

    const result = await projectCompatibilityFromCanonicalFacts({
      authority: authorityA(),
      processingEnabled: true,
      now: NOW,
      mode: "shop_rebuild",
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.hasMore).toBe(false);
    assertNoMerchantHealthAuthorization(result);
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: orphanVariantGid },
      }),
    ).toMatchObject({ title: "ORPHAN CACHE", sku: "ORPHAN-SKU" });
    expect(
      (
        await prisma.inventorySnapshot.findFirst({
          where: {
            shopId: shopAId,
            shopifyVariantId: orphanVariantGid,
            locationId: orphanLocationGid,
            snapshotDate: TODAY,
          },
        })
      )?.quantityAvailable,
    ).toBe(77);
    expect(
      await prisma.shopifyVariantCache.findFirst({
        where: { shopId: shopAId, shopifyVariantId: live.variantGid },
      }),
    ).not.toBeNull();
    expect(
      await prisma.shopifyVariantFact.findFirst({
        where: { shopId: shopAId, shopifyGid: orphanVariantGid },
      }),
    ).toBeNull();
  });
});

function throwingWriter(message: string): LegacyCompatibilityWriter {
  return {
    async applyVariantPlan(): Promise<void> {
      throw new Error(message);
    },
    async applySnapshotPlan(): Promise<void> {
      throw new Error(message);
    },
  };
}

async function seedLiveGraph(
  prisma: PrismaClient,
  shopId: string,
  suffix: string,
) {
  const productGid = `gid://shopify/Product/${suffix}`;
  const variantGid = `gid://shopify/ProductVariant/${suffix}`;
  const itemGid = `gid://shopify/InventoryItem/${suffix}`;
  const locationGid = `gid://shopify/Location/${suffix}`;
  const observedAt = new Date("2026-08-17T12:00:00.000Z");

  await prisma.shopifyProductFact.create({
    data: {
      shopId,
      shopifyGid: productGid,
      title: "Widget",
      handle: `widget-${suffix}`,
      tags: [],
      status: "ACTIVE",
      featuredMediaUrl: "https://cdn.example/widget.jpg",
      existenceState: "LIVE",
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      existenceObservedAt: observedAt,
      sourceKind: "FULL_SYNC",
    },
  });
  await prisma.shopifyVariantFact.create({
    data: {
      shopId,
      shopifyGid: variantGid,
      shopifyProductGid: productGid,
      title: "Blue",
      selectedOptions: [],
      sku: `SKU-${suffix}`,
      barcode: `BAR-${suffix}`,
      priceAmount: "12.50",
      currencyCode: "USD",
      existenceState: "LIVE",
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      existenceObservedAt: observedAt,
      sourceKind: "FULL_SYNC",
    },
  });
  await prisma.shopifyInventoryItemFact.create({
    data: {
      shopId,
      shopifyGid: itemGid,
      shopifyVariantGid: variantGid,
      tracked: true,
      requiresShipping: true,
      weightValue: new Prisma.Decimal("1.250000"),
      weightUnit: "GRAMS",
      unitCostAccess: "NULL",
      existenceState: "LIVE",
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      existenceObservedAt: observedAt,
      sourceKind: "FULL_SYNC",
    },
  });
  await prisma.shopifyLocationFact.create({
    data: {
      shopId,
      shopifyGid: locationGid,
      name: `Loc ${suffix}`,
      isActive: true,
      fulfillsOnlineOrders: true,
      shipsInventory: true,
      isFulfillmentService: false,
      hasActiveInventory: true,
      existenceState: "LIVE",
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      existenceObservedAt: observedAt,
      sourceKind: "FULL_SYNC",
    },
  });
  await prisma.shopifyInventoryLevelFact.create({
    data: {
      shopId,
      inventoryItemGid: itemGid,
      locationGid,
      availableQuantity: 17,
      existenceState: "LIVE",
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      existenceObservedAt: observedAt,
      sourceKind: "FULL_SYNC",
    },
  });

  return { productGid, variantGid, itemGid, locationGid };
}

async function tombstoneVariant(
  prisma: PrismaClient,
  shopId: string,
  variantGid: string,
) {
  await prisma.shopifyVariantFact.update({
    where: { shopId_shopifyGid: { shopId, shopifyGid: variantGid } },
    data: {
      existenceState: "ABSENT",
      existenceKind: "ABSENT_CONFIRMED_QUERY",
      existenceRequestGen: 10n,
      existenceResponseGen: 11n,
      deletedAt: new Date("2026-08-17T14:00:00.000Z"),
      deletionSource: "CONFIRMED_QUERY",
    },
  });
}

async function tombstoneLevel(
  prisma: PrismaClient,
  shopId: string,
  inventoryItemGid: string,
  locationGid: string,
) {
  await prisma.shopifyInventoryLevelFact.update({
    where: {
      shopId_inventoryItemGid_locationGid: {
        shopId,
        inventoryItemGid,
        locationGid,
      },
    },
    data: {
      existenceState: "ABSENT",
      existenceKind: "ABSENT_CONFIRMED_QUERY",
      existenceRequestGen: 20n,
      existenceResponseGen: 21n,
      deletedAt: new Date("2026-08-17T14:00:00.000Z"),
      deletionSource: "DISCONNECT",
    },
  });
}

async function canonicalFingerprint(
  prisma: PrismaClient,
  seeded: { variantGid: string; itemGid: string; locationGid: string; productGid: string },
) {
  const variant = await prisma.shopifyVariantFact.findFirst({
    where: { shopifyGid: seeded.variantGid },
  });
  const product = await prisma.shopifyProductFact.findFirst({
    where: { shopifyGid: seeded.productGid },
  });
  const item = await prisma.shopifyInventoryItemFact.findFirst({
    where: { shopifyGid: seeded.itemGid },
  });
  const level = await prisma.shopifyInventoryLevelFact.findFirst({
    where: {
      inventoryItemGid: seeded.itemGid,
      locationGid: seeded.locationGid,
    },
  });
  return {
    variant: {
      title: variant?.title,
      sku: variant?.sku,
      updatedAt: variant?.updatedAt.toISOString(),
      compatibilityProjectionState: variant?.compatibilityProjectionState,
      existenceState: variant?.existenceState,
    },
    product: {
      title: product?.title,
      updatedAt: product?.updatedAt.toISOString(),
      compatibilityProjectionState: product?.compatibilityProjectionState,
    },
    item: {
      shopifyVariantGid: item?.shopifyVariantGid ?? null,
      updatedAt: item?.updatedAt.toISOString(),
      compatibilityProjectionState: item?.compatibilityProjectionState,
    },
    level: {
      availableQuantity: level?.availableQuantity,
      updatedAt: level?.updatedAt.toISOString(),
      compatibilityProjectionState: level?.compatibilityProjectionState,
      existenceState: level?.existenceState,
    },
  };
}
