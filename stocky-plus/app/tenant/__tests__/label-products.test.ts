import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  listLabelLocations,
  loadLabelProducts,
  lookupLabelProducts,
} from "../../services/labels/label-products.server";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import {
  clearCatalogFacts,
  createPrisma,
  resetPublicSchema,
  seedCatalogVariant,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

function tenantDb(shopId: string, myshopifyDomain: string) {
  return createTenantDb(
    issueTenantAuthority({ shopId, myshopifyDomain, source: "verified_admin_request" }),
  );
}

describe("label products", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await clearCatalogFacts(prisma);
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("describes a variant the way it is printed on a label", async () => {
    const seeded = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452", {
      productTitle: "Ski Wax",
      sku: "WAX-1",
    });
    await prisma.shopifyProductFact.updateMany({
      where: { shopId: shopAId },
      data: { vendor: "Wax Co" },
    });
    await prisma.shopifyVariantFact.updateMany({
      where: { shopId: shopAId },
      data: { priceAmount: "24.95", compareAtPriceAmount: "29.95" },
    });

    const result = await loadLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), [seeded.variantGid]);

    expect(result).toEqual({
      products: [
        {
          variantGid: seeded.variantGid,
          displayName: "Ski Wax",
          productTitle: "Ski Wax",
          variantTitle: null,
          sku: "WAX-1",
          barcode: "036000291452",
          price: "$24.95",
          compareAtPrice: "$29.95",
          vendor: "Wax Co",
        },
      ],
      missing: [],
    });
  });

  it("leaves out a compare-at price that is not higher than the price", async () => {
    const seeded = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452");
    await prisma.shopifyVariantFact.updateMany({
      where: { shopId: shopAId },
      data: { priceAmount: "10.00", compareAtPriceAmount: "10.00" },
    });
    const { products } = await loadLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), [
      seeded.variantGid,
    ]);
    expect(products[0].compareAtPrice).toBeNull();
  });

  it("names a variant of a product with options", async () => {
    const seeded = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452", {
      productTitle: "Snowboard",
    });
    await prisma.shopifyVariantFact.updateMany({
      where: { shopId: shopAId },
      data: { title: "Large / Blue", displayName: null },
    });
    const { products } = await loadLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), [
      seeded.variantGid,
    ]);
    expect(products[0]).toMatchObject({
      displayName: "Snowboard - Large / Blue",
      productTitle: "Snowboard",
      variantTitle: "Large / Blue",
    });
  });

  it("reports unknown, malformed, deleted and other shops' variants as missing, in the order asked", async () => {
    const a = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452");
    const gone = await seedCatalogVariant(prisma, shopAId, "1002", "5901234123457", {
      absent: true,
    });
    const b = await seedCatalogVariant(prisma, shopBId, "2001", "4006381333931");

    const result = await loadLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), [
      b.variantGid,
      "not-a-gid",
      a.variantGid,
      gone.variantGid,
      "gid://shopify/ProductVariant/424242",
      a.variantGid,
    ]);

    expect(result.products.map((p) => p.variantGid)).toEqual([a.variantGid]);
    expect(result.missing).toEqual([
      b.variantGid,
      "not-a-gid",
      gone.variantGid,
      "gid://shopify/ProductVariant/424242",
    ]);
  });

  it("returns nothing for an empty request", async () => {
    expect(await loadLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), [])).toEqual({
      products: [],
      missing: [],
    });
  });

  it("lists only the shop's own active locations", async () => {
    await seedCatalogVariant(prisma, shopAId, "1001", "036000291452");
    await seedCatalogVariant(prisma, shopBId, "2001", "4006381333931");
    await prisma.shopifyLocationFact.create({
      data: {
        shopId: shopAId,
        shopifyGid: "gid://shopify/Location/9",
        name: "Closed store",
        isActive: false,
        fulfillsOnlineOrders: false,
        shipsInventory: false,
        isFulfillmentService: false,
        hasActiveInventory: false,
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date("2026-11-10T12:00:00Z"),
        sourceKind: "FULL_SYNC",
      },
    });

    expect(await listLabelLocations(tenantDb(shopAId, SHOP_A_DOMAIN))).toEqual([
      { locationGid: "gid://shopify/Location/1001", name: "Store 1001" },
    ]);
    expect(await listLabelLocations(tenantDb(shopBId, SHOP_B_DOMAIN))).toEqual([
      { locationGid: "gid://shopify/Location/2001", name: "Store 2001" },
    ]);
  });

  describe("lookup", () => {
    it("adds the one product a scanned barcode names, using only this shop's catalog", async () => {
      const a = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452");
      await seedCatalogVariant(prisma, shopBId, "2001", "036000291452");
      const result = await lookupLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), "036000291452");
      expect(result).toMatchObject({ kind: "match", product: { variantGid: a.variantGid } });
    });

    it("finds a product by its SKU", async () => {
      const a = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452", {
        sku: "WAX-1",
      });
      const result = await lookupLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), "WAX-1");
      expect(result).toMatchObject({ kind: "match", product: { variantGid: a.variantGid } });
    });

    it("asks which product when a code is shared", async () => {
      await seedCatalogVariant(prisma, shopAId, "1001", "036000291452");
      await seedCatalogVariant(prisma, shopAId, "1002", "036000291452");
      const result = await lookupLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), "036000291452");
      expect(result.kind).toBe("choose");
      if (result.kind === "choose") expect(result.products).toHaveLength(2);
    });

    it("searches names when the text is not a whole code", async () => {
      await seedCatalogVariant(prisma, shopAId, "1001", "036000291452", {
        productTitle: "Ski Wax",
      });
      await seedCatalogVariant(prisma, shopAId, "1002", "5901234123457", {
        productTitle: "Ski Boots",
      });
      const db = tenantDb(shopAId, SHOP_A_DOMAIN);
      expect((await lookupLabelProducts(db, "ski")).kind).toBe("choose");
      expect(await lookupLabelProducts(db, "wax")).toMatchObject({
        kind: "match",
        product: { productTitle: "Ski Wax" },
      });
    });

    it("does not show another shop's product for a name", async () => {
      await seedCatalogVariant(prisma, shopBId, "2001", "4006381333931", {
        productTitle: "Secret Product",
      });
      expect(await lookupLabelProducts(tenantDb(shopAId, SHOP_A_DOMAIN), "secret")).toEqual({
        kind: "not_found",
        query: "secret",
      });
    });

    it("reports empty, oversized and unknown input", async () => {
      const db = tenantDb(shopAId, SHOP_A_DOMAIN);
      expect(await lookupLabelProducts(db, "   ")).toEqual({ kind: "empty" });
      expect(await lookupLabelProducts(db, "9".repeat(2000))).toEqual({ kind: "too_long" });
      expect(await lookupLabelProducts(db, "NOPE-404")).toEqual({
        kind: "not_found",
        query: "NOPE-404",
      });
    });
  });
});
