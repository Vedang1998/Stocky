import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import { TenantAccessError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  SHARED_EXTERNAL_ID,
} from "./helpers";

describe("nested write ownership validation (C-05)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.shopifyInventoryLevelFact.deleteMany();
    await prisma.shopifyInventoryItemFact.deleteMany();
    await prisma.shopifyVariantFact.deleteMany();
    await prisma.shopifyProductCollectionMembership.deleteMany();
    await prisma.shopifyProductFact.deleteMany();
    await prisma.shopifyLocationFact.deleteMany();
    await prisma.catalogObservationInFlight.deleteMany();
    await prisma.pOLineItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplierSkuMapping.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function dbA() {
    return createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
  }

  it("parent create connecting foreign child is denied", async () => {
    const foreignChild = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        // Need a supplier for FK — create foreign supplier first
        supplier: {
          create: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
        },
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "f",
      },
    });
    await expect(
      dbA().supplier.create({
        data: {
          name: "A",
          skuMappings: { connect: { id: foreignChild.id } },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("parent update connecting foreign child is denied", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const foreignChild = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplier: {
          create: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
        },
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "f",
      },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: { skuMappings: { connect: { id: foreignChild.id } } },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("connectOrCreate.where selecting foreign child is denied", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const foreignChild = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplier: {
          create: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
        },
        shopifyVariantId: "gid://foreign",
        vendorSku: "f",
      },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            connectOrCreate: {
              where: { id: foreignChild.id },
              create: {
                shopifyVariantId: "gid://new",
                vendorSku: "n",
              },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("set containing mixed Shop A and Shop B IDs is denied", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const childA = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://a",
        vendorSku: "a",
      },
    });
    const childB = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplier: {
          create: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
        },
        shopifyVariantId: "gid://b",
        vendorSku: "b",
      },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            set: [{ id: childA.id }, { id: childB.id }],
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("nested update of foreign child is denied", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const foreignChild = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplierA.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "f",
      },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            update: {
              where: { id: foreignChild.id },
              data: { vendorSku: "hacked" },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("nested delete of foreign child is denied", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const foreignChild = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplierA.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "f",
      },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            delete: { id: foreignChild.id },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("valid same-tenant nested create succeeds", async () => {
    const row = await dbA().supplier.create({
      data: {
        name: "A",
        skuMappings: {
          create: {
            shopifyVariantId: SHARED_EXTERNAL_ID,
            vendorSku: "ok",
          },
        },
      },
      include: { skuMappings: true },
    });
    expect(row.skuMappings).toHaveLength(1);
    expect(row.skuMappings[0].shopId).toBe(shopAId);
  });

  it("PR5 Variant -> Product foreign connect is denied (F-CLAUDE-PR5F1-10)", async () => {
    const productB = await prisma.shopifyProductFact.create({
      data: {
        shopId: shopBId,
        shopifyGid: "gid://shopify/Product/pr5-nested-b",
        title: "B",
        handle: "pr5-nested-b",
        tags: [],
        status: "ACTIVE",
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date(),
        sourceKind: "FULL_SYNC",
      },
    });
    await expect(
      dbA().shopifyVariantFact.create({
        data: {
          shopifyGid: "gid://shopify/ProductVariant/pr5-nested-cross",
          shopifyProductGid: productB.shopifyGid,
          title: "cross",
          selectedOptions: [],
          priceAmount: "1",
          currencyCode: "USD",
          existenceState: "LIVE",
          existenceKind: "LIVE_FULL_SYNC_PRESENT",
          existenceObservedAt: new Date(),
          sourceKind: "FULL_SYNC",
          product: {
            connect: { id: productB.id },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("PR5 InventoryLevel -> Location foreign connect is denied (F-CLAUDE-PR5F1-10)", async () => {
    const productA = await prisma.shopifyProductFact.create({
      data: {
        shopId: shopAId,
        shopifyGid: "gid://shopify/Product/pr5-level-a",
        title: "A",
        handle: "pr5-level-a",
        tags: [],
        status: "ACTIVE",
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date(),
        sourceKind: "FULL_SYNC",
      },
    });
    const variantA = await prisma.shopifyVariantFact.create({
      data: {
        shopId: shopAId,
        shopifyGid: "gid://shopify/ProductVariant/pr5-level-a",
        shopifyProductGid: productA.shopifyGid,
        title: "A",
        selectedOptions: {},
        priceAmount: "1",
        currencyCode: "USD",
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date(),
        sourceKind: "FULL_SYNC",
      },
    });
    const itemA = await prisma.shopifyInventoryItemFact.create({
      data: {
        shopId: shopAId,
        shopifyGid: "gid://shopify/InventoryItem/pr5-level-a",
        shopifyVariantGid: variantA.shopifyGid,
        tracked: true,
        requiresShipping: true,
        unitCostAccess: "NULL",
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date(),
        sourceKind: "FULL_SYNC",
      },
    });
    const locationB = await prisma.shopifyLocationFact.create({
      data: {
        shopId: shopBId,
        shopifyGid: "gid://shopify/Location/pr5-level-b",
        name: "B-loc",
        isActive: true,
        fulfillsOnlineOrders: true,
        shipsInventory: true,
        isFulfillmentService: false,
        hasActiveInventory: true,
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date(),
        sourceKind: "FULL_SYNC",
      },
    });
    await expect(
      dbA().shopifyInventoryLevelFact.create({
        data: {
          inventoryItemGid: itemA.shopifyGid,
          locationGid: locationB.shopifyGid,
          existenceState: "LIVE",
          existenceKind: "LIVE_FULL_SYNC_PRESENT",
          existenceObservedAt: new Date(),
          sourceKind: "FULL_SYNC",
          location: {
            connect: { id: locationB.id },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });

  it("unknown nested relation operation fails closed", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            notARealOp: true,
          } as never,
        },
      }),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });
});
