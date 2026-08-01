/**
 * F-PR2C-05 / F-PR2C-06 — partial selection proof fields and safe update projections.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  SHARED_EXTERNAL_ID,
} from "./helpers";

describe("tenant partial-selection and update projections (F-PR2C-05/06)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.supplierSkuMapping.deleteMany();
    await prisma.pOLineItem.deleteMany();
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

  it("owned to-one partial select without id/shopId remains functional", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A-sup" },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });

    const rows = await dbA().purchaseOrder.findMany({
      select: { id: true, supplier: { select: { name: true } } },
    });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0].supplier).sort()).toEqual(["name"]);
    expect(rows[0].supplier.name).toBe("A-sup");
  });

  it("owned to-many partial select without shop/shopId remains functional", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });

    const rows = await dbA().supplier.findMany({
      select: { id: true, purchaseOrders: { select: { id: true } } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].purchaseOrders).toHaveLength(1);
    expect(Object.keys(rows[0].purchaseOrders[0]).sort()).toEqual(["id"]);
  });

  it("select with _count preserves exact response keys", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "v",
      },
    });

    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      select: {
        name: true,
        _count: { select: { skuMappings: true } },
      },
    });
    expect(Object.keys(row).sort()).toEqual(["_count", "name"]);
    expect(row._count.skuMappings).toBe(1);
  });

  it("update supports nested create and include projection", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });

    const updated = await dbA().supplier.update({
      where: { id: supplier.id },
      data: {
        name: "A2",
        skuMappings: {
          create: {
            shopifyVariantId: SHARED_EXTERNAL_ID,
            vendorSku: "new",
          },
        },
      },
      include: { skuMappings: true },
    });
    expect(updated.name).toBe("A2");
    expect(updated.skuMappings).toHaveLength(1);
    expect(updated.skuMappings[0].shopId).toBe(shopAId);
  });

  it("update supports select projection and nested connect", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const mapping = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: "gid://c",
        vendorSku: "c",
      },
    });

    const updated = await dbA().supplier.update({
      where: { id: supplier.id },
      data: {
        skuMappings: { connect: { id: mapping.id } },
      },
      select: {
        name: true,
        skuMappings: { select: { vendorSku: true } },
      },
    });
    expect(Object.keys(updated).sort()).toEqual(["name", "skuMappings"]);
    expect(updated.skuMappings[0].vendorSku).toBe("c");
    expect(Object.keys(updated.skuMappings[0]).sort()).toEqual(["vendorSku"]);
  });

  it("update rejects foreign nested target and rolls back", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const foreign = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplier: {
          create: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
        },
        shopifyVariantId: "gid://f",
        vendorSku: "f",
      },
    });

    await expect(
      dbA().supplier.update({
        where: { id: supplier.id },
        data: {
          name: "should-not-stick",
          skuMappings: { connect: { id: foreign.id } },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });

    const still = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    expect(still?.name).toBe("A");
    const victim = await prisma.supplierSkuMapping.findUnique({
      where: { id: foreign.id },
    });
    expect(victim?.shopId).toBe(shopBId);
  });
});
