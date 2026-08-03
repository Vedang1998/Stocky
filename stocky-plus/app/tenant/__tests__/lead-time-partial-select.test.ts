/**
 * F-PR2R2-06 — LeadTimeSnapshot purchaseOrderId proof injection/stripping.
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
} from "./helpers";

describe("tenant LeadTimeSnapshot projection tests (F-PR2R2-06)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.leadTimeSnapshot.deleteMany();
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

  it("partial select returns only leadTimeDays with no proof leakage", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const po = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });
    await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        leadTimeDays: 5,
      },
    });

    const row = await dbA().leadTimeSnapshot.findFirst({
      select: { leadTimeDays: true },
    });
    expect(row).toEqual({ leadTimeDays: 5 });
    expect(Object.keys(row!)).toEqual(["leadTimeDays"]);
  });

  it("nested partial select strips proof fields", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const po = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });
    await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        purchaseOrderId: po.id,
        leadTimeDays: 8,
      },
    });

    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      select: {
        name: true,
        leadTimeSnapshots: { select: { leadTimeDays: true } },
      },
    });
    expect(row.leadTimeSnapshots).toHaveLength(1);
    expect(Object.keys(row.leadTimeSnapshots[0])).toEqual(["leadTimeDays"]);
  });

  it("foreign purchase-order lineage is denied / filtered", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const supplierB = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
    });
    const poB = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: supplierB.id,
        locationId: "loc",
      },
    });
    // Inconsistent: child shopId=A but PO lineage is foreign.
    await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        purchaseOrderId: poB.id,
        leadTimeDays: 3,
      },
    });

    await expect(
      dbA().leadTimeSnapshot.findFirst({
        select: { leadTimeDays: true },
      }),
    ).rejects.toMatchObject({ code: "foreign_parent" });

    const nested = await dbA().supplier.findUnique({
      where: { id: supplierA.id },
      include: { leadTimeSnapshots: true },
    });
    expect(nested.leadTimeSnapshots).toEqual([]);
  });
});
