/**
 * F-PR2R2-04 — connectOrCreate must merge with sibling connect/create.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { appendNestedOperation } from "../selectors";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant connectOrCreate merge tests (F-PR2R2-04)", () => {
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

  it("appendNestedOperation preserves order and scalar/array forms", () => {
    expect(appendNestedOperation(undefined, [{ id: "a" }])).toEqual({ id: "a" });
    expect(appendNestedOperation({ id: "a" }, [{ id: "b" }])).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
    expect(appendNestedOperation([{ id: "a" }], [{ id: "b" }, { id: "c" }])).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });

  it("sibling create + connectOrCreate→create keeps both creates", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const po1 = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });
    const po2Key = `po-coc-${Date.now()}`;

    await dbA().supplier.update({
      where: { id: supplier.id },
      data: {
        leadTimeSnapshots: {
          create: {
            purchaseOrderId: po1.id,
            leadTimeDays: 10,
          },
          connectOrCreate: {
            where: { purchaseOrderId: po2Key },
            create: {
              purchaseOrderId: (
                await prisma.purchaseOrder.create({
                  data: {
                    shop: SHOP_A_DOMAIN,
                    shopId: shopAId,
                    supplierId: supplier.id,
                    locationId: "loc2",
                  },
                })
              ).id,
              leadTimeDays: 20,
            },
          },
        },
      },
    });

    const snaps = await prisma.leadTimeSnapshot.findMany({
      where: { supplierId: supplier.id },
      orderBy: { leadTimeDays: "asc" },
    });
    expect(snaps.map((s) => s.leadTimeDays)).toEqual([10, 20]);
  });

  it("sibling connect + connectOrCreate→connect keeps both connects", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const po1 = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc1",
      },
    });
    const po2 = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc2",
      },
    });
    const snap1 = await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        purchaseOrderId: po1.id,
        leadTimeDays: 1,
      },
    });
    const snap2 = await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        purchaseOrderId: po2.id,
        leadTimeDays: 2,
      },
    });

    // Detach by moving to a temporary supplier then reconnect via merge path.
    const other = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "other" },
    });
    await prisma.leadTimeSnapshot.update({
      where: { id: snap1.id },
      data: { supplierId: other.id },
    });
    await prisma.leadTimeSnapshot.update({
      where: { id: snap2.id },
      data: { supplierId: other.id },
    });

    await dbA().supplier.update({
      where: { id: supplier.id },
      data: {
        leadTimeSnapshots: {
          connect: { id: snap1.id },
          connectOrCreate: {
            where: { id: snap2.id },
            create: {
              purchaseOrderId: po2.id,
              leadTimeDays: 99,
            },
          },
        },
      },
    });

    const snaps = await prisma.leadTimeSnapshot.findMany({
      where: { supplierId: supplier.id },
      orderBy: { leadTimeDays: "asc" },
    });
    expect(snaps.map((s) => s.id).sort()).toEqual([snap1.id, snap2.id].sort());
    expect(snaps.every((s) => s.leadTimeDays !== 99)).toBe(true);
  });

  it("foreign element after valid elements rolls back with no partial mutation", async () => {
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
    const snapB = await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopBId,
        supplierId: supplierB.id,
        purchaseOrderId: poB.id,
        leadTimeDays: 7,
      },
    });

    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          leadTimeSnapshots: {
            create: {
              purchaseOrderId: (
                await prisma.purchaseOrder.create({
                  data: {
                    shop: SHOP_A_DOMAIN,
                    shopId: shopAId,
                    supplierId: supplierA.id,
                    locationId: "loc-a",
                  },
                })
              ).id,
              leadTimeDays: 3,
            },
            connectOrCreate: {
              where: { id: snapB.id },
              create: {
                purchaseOrderId: poB.id,
                leadTimeDays: 1,
              },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });

    expect(
      await prisma.leadTimeSnapshot.count({ where: { supplierId: supplierA.id } }),
    ).toBe(0);
    expect(
      (await prisma.leadTimeSnapshot.findUnique({ where: { id: snapB.id } }))
        ?.supplierId,
    ).toBe(supplierB.id);
  });
});
