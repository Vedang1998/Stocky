import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import { ROUTE_RELATION_SHAPES } from "../relations";
import { TenantAccessError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  SHARED_EXTERNAL_ID,
} from "./helpers";

describe("recursive relation isolation (C-02)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.stocktakeLineItem.deleteMany();
    await prisma.transferLineItem.deleteMany();
    await prisma.pOLineItem.deleteMany();
    await prisma.leadTimeSnapshot.deleteMany();
    await prisma.volumePriceTier.deleteMany();
    await prisma.supplierSkuMapping.deleteMany();
    await prisma.stocktake.deleteMany();
    await prisma.transferOrder.deleteMany();
    await prisma.purchaseOrder.deleteMany();
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

  it("documents every route/service relation shape", () => {
    expect(ROUTE_RELATION_SHAPES.length).toBeGreaterThanOrEqual(10);
  });

  it("Shop A parent with Shop A child is returned", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "ok",
      },
    });
    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: { skuMappings: true },
    });
    expect(row.skuMappings).toHaveLength(1);
  });

  it("Shop A parent with foreign Shop B child is not returned", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "foreign",
      },
    });
    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: { skuMappings: true },
    });
    expect(row.skuMappings).toEqual([]);
  });

  it("Shop A parent with null-ownership child is returned via lineage", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: null,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "null-child",
      },
    });
    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: { skuMappings: true },
    });
    expect(row.skuMappings).toHaveLength(1);
  });

  it("nested select scopes children", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplier.id,
        shopifyVariantId: "gid://x/1",
        vendorSku: "b",
      },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: "gid://x/2",
        vendorSku: "a",
      },
    });
    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      select: { id: true, skuMappings: { select: { vendorSku: true } } },
    });
    expect(row.skuMappings.map((m: { vendorSku: string }) => m.vendorSku)).toEqual([
      "a",
    ]);
  });

  it("_count excludes foreign children", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: "gid://x/1",
        vendorSku: "a",
      },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplier.id,
        shopifyVariantId: "gid://x/2",
        vendorSku: "b",
      },
    });
    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: { _count: { select: { skuMappings: true, purchaseOrders: true } } },
    });
    expect(row._count.skuMappings).toBe(1);
    expect(row._count.purchaseOrders).toBe(0);
  });

  it("nested include inside another include scopes PO lines", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const po = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
        status: "DRAFT",
      },
    });
    await prisma.pOLineItem.create({
      data: {
        shopId: shopAId,
        purchaseOrderId: po.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        orderedQty: 1,
        unitCost: 1,
      },
    });
    await prisma.pOLineItem.create({
      data: {
        shopId: shopBId,
        purchaseOrderId: po.id,
        shopifyVariantId: "gid://other",
        orderedQty: 9,
        unitCost: 1,
      },
    });
    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: {
        purchaseOrders: {
          include: { lineItems: true },
        },
      },
    });
    expect(row.purchaseOrders).toHaveLength(1);
    expect(row.purchaseOrders[0].lineItems).toHaveLength(1);
  });

  it("to-one supplier on PO fails closed when foreign", async () => {
    const foreignSupplier = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
    });
    // Inconsistent PO: tenant A shop fields but foreign supplier FK
    const po = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: foreignSupplier.id,
        locationId: "loc",
        status: "DRAFT",
      },
    });
    await expect(
      dbA().purchaseOrder.findUnique({
        where: { id: po.id },
        include: { supplier: true },
      }),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });

  it("transfer and stocktake line includes are scoped", async () => {
    const transfer = await prisma.transferOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        sourceLocationId: "a",
        destinationLocationId: "b",
      },
    });
    await prisma.transferLineItem.create({
      data: {
        shopId: shopBId,
        transferOrderId: transfer.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        quantity: 1,
      },
    });
    const t = await dbA().transferOrder.findUnique({
      where: { id: transfer.id },
      include: { lineItems: true },
    });
    expect(t.lineItems).toEqual([]);

    const stocktake = await prisma.stocktake.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        locationId: "a",
        name: "Count A",
      },
    });
    await prisma.stocktakeLineItem.create({
      data: {
        shopId: shopBId,
        stocktakeId: stocktake.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        expectedQty: 1,
        countedQty: 1,
      },
    });
    const s = await dbA().stocktake.findUnique({
      where: { id: stocktake.id },
      include: { lineItems: true },
    });
    expect(s.lineItems).toEqual([]);
  });

  it("unknown relation shape fails closed", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await expect(
      dbA().supplier.findUnique({
        where: { id: supplier.id },
        include: { notARealRelation: true } as never,
      }),
    ).rejects.toMatchObject({ code: "unknown_relation_shape" });
  });
});
