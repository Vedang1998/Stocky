import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { TenantAccessError, TenantAuthorityError } from "../errors";
import {
  CHILD_MERCHANT_MODELS,
  DIRECT_MERCHANT_MODELS,
  MERCHANT_OWNED_MODELS,
} from "../models";
import {
  createTenantDb,
  tenantDbExposesRawClient,
  type TenantDb,
} from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHARED_EXTERNAL_ID,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant-bound database contract (PR 2)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let dbA: TenantDb;
  let dbB: TenantDb;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    // Clean merchant tables
    await prisma.stocktakeLineItem.deleteMany();
    await prisma.transferLineItem.deleteMany();
    await prisma.pOLineItem.deleteMany();
    await prisma.leadTimeSnapshot.deleteMany();
    await prisma.volumePriceTier.deleteMany();
    await prisma.supplierSkuMapping.deleteMany();
    await prisma.lowStockAlert.deleteMany();
    await prisma.bomComponent.deleteMany();
    await prisma.stocktake.deleteMany();
    await prisma.transferOrder.deleteMany();
    await prisma.shopSettings.deleteMany();
    await prisma.salesDailyAggregate.deleteMany();
    await prisma.forecastOverride.deleteMany();
    await prisma.variantAbcClass.deleteMany();
    await prisma.inventorySnapshot.deleteMany();
    await prisma.shopifyVariantCache.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();

    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;

    dbA = createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
    dbB = createTenantDb(
      issueTenantAuthority({
        shopId: shopBId,
        myshopifyDomain: SHOP_B_DOMAIN,
        source: "verified_admin_request",
      }),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers all 18 merchant models", () => {
    expect(MERCHANT_OWNED_MODELS).toHaveLength(18);
    expect(DIRECT_MERCHANT_MODELS).toHaveLength(12);
    expect(CHILD_MERCHANT_MODELS).toHaveLength(6);
  });

  it("Shop A reads only Shop A rows; Shop B only Shop B; overlapping external IDs isolated", async () => {
    await dbA.shopifyVariantCache.create({
      data: {
        shopifyVariantId: SHARED_EXTERNAL_ID,
        title: "A variant",
      },
    });
    await dbB.shopifyVariantCache.create({
      data: {
        shopifyVariantId: SHARED_EXTERNAL_ID,
        title: "B variant",
      },
    });

    const aRows = await dbA.shopifyVariantCache.findMany({
      where: { shopifyVariantId: SHARED_EXTERNAL_ID },
    });
    const bRows = await dbB.shopifyVariantCache.findMany({
      where: { shopifyVariantId: SHARED_EXTERNAL_ID },
    });
    expect(aRows).toHaveLength(1);
    expect(aRows[0].title).toBe("A variant");
    expect(bRows).toHaveLength(1);
    expect(bRows[0].title).toBe("B variant");
  });

  it("rejects explicit foreign shopId on create", async () => {
    await expect(
      dbA.supplier.create({
        data: { name: "Evil", shopId: shopBId },
      }),
    ).rejects.toMatchObject({ code: "foreign_shop_id" });
  });

  it("missing tenant authority cannot create a tenant database client", () => {
    expect(() =>
      createTenantDb({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
        correlationId: "forged",
      } as never),
    ).toThrow(TenantAuthorityError);
  });

  it("direct-model create injects shopId and canonical legacy shop", async () => {
    const row = await dbA.supplier.create({ data: { name: "Acme" } });
    expect(row.shopId).toBe(shopAId);
    expect(row.shop).toBe(SHOP_A_DOMAIN);
  });

  it("child-model create injects shopId and validates parent", async () => {
    const supplier = await dbA.supplier.create({ data: { name: "Acme" } });
    const mapping = await dbA.supplierSkuMapping.create({
      data: {
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "SKU-1",
      },
    });
    expect(mapping.shopId).toBe(shopAId);

    const foreign = await dbB.supplier.create({ data: { name: "Other" } });
    await expect(
      dbA.supplierSkuMapping.create({
        data: {
          supplierId: foreign.id,
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          vendorSku: "X",
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_parent" });
  });

  it("update cannot assign a different shopId", async () => {
    const row = await dbA.supplier.create({ data: { name: "Acme" } });
    await expect(
      dbA.supplier.update({
        where: { id: row.id },
        data: { shopId: shopBId },
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(shop_id_immutable|foreign_shop_id)$/),
    });
  });

  it("upsert cannot match another tenant's row", async () => {
    await dbB.shopifyVariantCache.create({
      data: {
        shopifyVariantId: SHARED_EXTERNAL_ID,
        title: "B",
      },
    });

    // Upsert with Shop A authority using shared external id — creates A row, not B.
    const upserted = await dbA.shopifyVariantCache.upsert({
      where: {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
      create: {
        shopifyVariantId: SHARED_EXTERNAL_ID,
        title: "A",
      },
      update: { title: "A-updated" },
    });
    expect(upserted.shopId).toBe(shopAId);
    expect(upserted.title).toBe("A");

    const b = await dbB.shopifyVariantCache.findMany({
      where: { shopifyVariantId: SHARED_EXTERNAL_ID },
    });
    expect(b[0].title).toBe("B");
  });

  it("delete cannot delete another tenant's row", async () => {
    const b = await dbB.supplier.create({ data: { name: "B only" } });
    await expect(
      dbA.supplier.delete({ where: { id: b.id } }),
    ).rejects.toMatchObject({ code: "not_found" });
    const still = await prisma.supplier.findUnique({ where: { id: b.id } });
    expect(still).not.toBeNull();
  });

  it("PurchaseOrder.supplierId must be same-tenant; nested child create gets ownership", async () => {
    const supplierA = await dbA.supplier.create({ data: { name: "A" } });
    const supplierB = await dbB.supplier.create({ data: { name: "B" } });

    await expect(
      dbA.purchaseOrder.create({
        data: {
          supplierId: supplierB.id,
          locationId: "gid://shopify/Location/1",
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_parent" });

    const po = await dbA.purchaseOrder.create({
      data: {
        supplierId: supplierA.id,
        locationId: "gid://shopify/Location/1",
        lineItems: {
          create: {
            shopifyVariantId: SHARED_EXTERNAL_ID,
            orderedQty: 2,
            unitCost: 1.5,
          },
        },
      },
      include: { lineItems: true },
    });
    expect(po.shopId).toBe(shopAId);
    expect(po.lineItems[0].shopId).toBe(shopAId);
  });

  it("parameterized create/read isolation across all direct models", async () => {
    const cases: Array<{
      model: string;
      createA: (db: TenantDb) => Promise<{ id: string }>;
      read: (db: TenantDb, id: string) => Promise<unknown>;
    }> = [
      {
        model: "Supplier",
        createA: (db) => db.supplier.create({ data: { name: "S" } }),
        read: (db, id) => db.supplier.findFirst({ where: { id } }),
      },
      {
        model: "ShopSettings",
        createA: (db) =>
          db.shopSettings.create({
            data: { shop: db.authority.myshopifyDomain },
          }),
        read: (db, id) => db.shopSettings.findFirst({ where: { id } }),
      },
      {
        model: "ShopifyVariantCache",
        createA: (db) =>
          db.shopifyVariantCache.create({
            data: { shopifyVariantId: SHARED_EXTERNAL_ID, title: "t" },
          }),
        read: (db, id) => db.shopifyVariantCache.findFirst({ where: { id } }),
      },
      {
        model: "InventorySnapshot",
        createA: (db) =>
          db.inventorySnapshot.create({
            data: {
              shopifyVariantId: SHARED_EXTERNAL_ID,
              locationId: "loc",
              quantityAvailable: 1,
              snapshotDate: new Date("2026-01-01"),
            },
          }),
        read: (db, id) => db.inventorySnapshot.findFirst({ where: { id } }),
      },
      {
        model: "VariantAbcClass",
        createA: (db) =>
          db.variantAbcClass.create({
            data: {
              shopifyVariantId: SHARED_EXTERNAL_ID,
              abcClass: "A",
              metric: "REVENUE",
            },
          }),
        read: (db, id) => db.variantAbcClass.findFirst({ where: { id } }),
      },
      {
        model: "ForecastOverride",
        createA: (db) =>
          db.forecastOverride.create({
            data: {
              variantId: SHARED_EXTERNAL_ID,
              locationId: "loc",
              lookbackStart: new Date("2026-01-01"),
              lookbackEnd: new Date("2026-01-31"),
            },
          }),
        read: (db, id) => db.forecastOverride.findFirst({ where: { id } }),
      },
      {
        model: "SalesDailyAggregate",
        createA: (db) =>
          db.salesDailyAggregate.create({
            data: {
              shopifyVariantId: SHARED_EXTERNAL_ID,
              locationId: "loc",
              date: new Date("2026-01-01"),
              unitsSold: 1,
            },
          }),
        read: (db, id) => db.salesDailyAggregate.findFirst({ where: { id } }),
      },
      {
        model: "TransferOrder",
        createA: (db) =>
          db.transferOrder.create({
            data: {
              sourceLocationId: "a",
              destinationLocationId: "b",
            },
          }),
        read: (db, id) => db.transferOrder.findFirst({ where: { id } }),
      },
      {
        model: "Stocktake",
        createA: (db) =>
          db.stocktake.create({
            data: { locationId: "loc", name: "Count" },
          }),
        read: (db, id) => db.stocktake.findFirst({ where: { id } }),
      },
      {
        model: "BomComponent",
        createA: (db) =>
          db.bomComponent.create({
            data: {
              bundleVariantId: "bundle",
              componentVariantId: "comp",
              quantity: 1,
            },
          }),
        read: (db, id) => db.bomComponent.findFirst({ where: { id } }),
      },
      {
        model: "LowStockAlert",
        createA: (db) =>
          db.lowStockAlert.create({
            data: {
              shopifyVariantId: SHARED_EXTERNAL_ID,
              locationId: "loc",
              reorderPoint: 5,
              currentStock: 1,
            },
          }),
        read: (db, id) => db.lowStockAlert.findFirst({ where: { id } }),
      },
    ];

    for (const c of cases) {
      const row = await c.createA(dbA);
      expect(await c.read(dbA, row.id), c.model).toBeTruthy();
      expect(await c.read(dbB, row.id), `${c.model} cross-tenant`).toBeNull();
    }

    // PurchaseOrder needs supplier
    const supplier = await dbA.supplier.create({ data: { name: "S" } });
    const po = await dbA.purchaseOrder.create({
      data: { supplierId: supplier.id, locationId: "loc" },
    });
    expect(await dbA.purchaseOrder.findFirst({ where: { id: po.id } })).toBeTruthy();
    expect(await dbB.purchaseOrder.findFirst({ where: { id: po.id } })).toBeNull();
  });

  it("child models parameterized: create injects shopId; foreign parent denied; same-tenant ok", async () => {
    const supplierA = await dbA.supplier.create({ data: { name: "A" } });
    const supplierB = await dbB.supplier.create({ data: { name: "B" } });
    const poA = await dbA.purchaseOrder.create({
      data: { supplierId: supplierA.id, locationId: "loc" },
    });
    const transferA = await dbA.transferOrder.create({
      data: { sourceLocationId: "a", destinationLocationId: "b" },
    });
    const stocktakeA = await dbA.stocktake.create({
      data: { locationId: "loc", name: "C" },
    });

    const childCreates: Array<() => Promise<{ shopId: string | null }>> = [
      () =>
        dbA.supplierSkuMapping.create({
          data: {
            supplierId: supplierA.id,
            shopifyVariantId: "v1",
            vendorSku: "s",
          },
        }),
      () =>
        dbA.volumePriceTier.create({
          data: {
            supplierId: supplierA.id,
            variantId: "v1",
            minQty: 1,
            unitCost: 1,
          },
        }),
      () =>
        dbA.pOLineItem.create({
          data: {
            purchaseOrderId: poA.id,
            shopifyVariantId: "v1",
            orderedQty: 1,
            unitCost: 1,
          },
        }),
      () =>
        dbA.transferLineItem.create({
          data: {
            transferOrderId: transferA.id,
            shopifyVariantId: "v1",
            quantity: 1,
          },
        }),
      () =>
        dbA.stocktakeLineItem.create({
          data: {
            stocktakeId: stocktakeA.id,
            shopifyVariantId: "v1",
            expectedQty: 1,
          },
        }),
    ];

    for (const create of childCreates) {
      const row = await create();
      expect(row.shopId).toBe(shopAId);
    }

    await expect(
      dbA.volumePriceTier.create({
        data: {
          supplierId: supplierB.id,
          variantId: "v2",
          minQty: 1,
          unitCost: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_parent" });

    // LeadTimeSnapshot — unique purchaseOrderId
    const poForLead = await dbA.purchaseOrder.create({
      data: { supplierId: supplierA.id, locationId: "loc" },
    });
    const lead = await dbA.leadTimeSnapshot.create({
      data: {
        supplierId: supplierA.id,
        purchaseOrderId: poForLead.id,
        leadTimeDays: 3,
      },
    });
    expect(lead.shopId).toBe(shopAId);
  });

  it("concurrent Shop A and Shop B operations remain isolated", async () => {
    await Promise.all([
      dbA.supplier.create({ data: { name: "A1" } }),
      dbB.supplier.create({ data: { name: "B1" } }),
      dbA.supplier.create({ data: { name: "A2" } }),
      dbB.supplier.create({ data: { name: "B2" } }),
    ]);
    const a = await dbA.supplier.findMany({});
    const b = await dbB.supplier.findMany({});
    expect(a.map((r: { name: string }) => r.name).sort()).toEqual(["A1", "A2"]);
    expect(b.map((r: { name: string }) => r.name).sort()).toEqual(["B1", "B2"]);
  });

  it("reused Prisma pool connections do not cause application-context crossover", async () => {
    await dbA.lowStockAlert.create({
      data: {
        shopifyVariantId: "v",
        locationId: "l",
        reorderPoint: 1,
        currentStock: 0,
      },
    });
    // Interleave operations on the shared pool
    for (let i = 0; i < 10; i++) {
      const [aCount, bCount] = await Promise.all([
        dbA.lowStockAlert.count({}),
        dbB.lowStockAlert.count({}),
      ]);
      expect(aCount).toBe(1);
      expect(bCount).toBe(0);
    }
  });

  it("no raw Prisma client escapes the tenant module", () => {
    expect(tenantDbExposesRawClient(dbA)).toBe(false);
    expect(() => (dbA as unknown as { $queryRaw: unknown }).$queryRaw).toThrow(
      TenantAccessError,
    );
  });
});
