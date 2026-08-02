/**
 * F-PR2R2-03 — one unprovable to-one relation must not fail the parent query.
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

describe("tenant mixed relation ownership tests (F-PR2R2-03)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
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

  it("10 owned POs with 1 unprovable supplier: list succeeds, relation nulled", async () => {
    const suppliers = [];
    for (let i = 0; i < 9; i++) {
      suppliers.push(
        await prisma.supplier.create({
          data: {
            shop: SHOP_A_DOMAIN,
            shopId: shopAId,
            name: `canonical-${i}`,
          },
        }),
      );
    }
    // Unprovable: null shopId + empty legacy shop
    const unprovable = await prisma.supplier.create({
      data: { shop: "", shopId: null, name: "SECRET-UNPROVABLE" },
    });
    suppliers.push(unprovable);

    const poIds: string[] = [];
    for (const supplier of suppliers) {
      const po = await prisma.purchaseOrder.create({
        data: {
          shop: SHOP_A_DOMAIN,
          shopId: shopAId,
          supplierId: supplier.id,
          locationId: "loc",
        },
      });
      poIds.push(po.id);
    }

    const rows = await dbA().purchaseOrder.findMany({
      include: { supplier: true },
      orderBy: { id: "asc" },
    });
    expect(rows).toHaveLength(10);
    const nulled = rows.filter((r: { supplier: unknown }) => r.supplier == null);
    expect(nulled).toHaveLength(1);
    for (const row of rows) {
      if (row.supplier) {
        expect(row.supplier.name).not.toBe("SECRET-UNPROVABLE");
        expect(Object.keys(row.supplier)).not.toContain("shopId");
      }
    }
  });

  it("canonical shopId supplier with malformed/foreign legacy shop is returned (D-030)", async () => {
    const malformed = await prisma.supplier.create({
      data: {
        shop: "https://shop-a.myshopify.com",
        shopId: shopAId,
        name: "malformed-legacy",
      },
    });
    const foreignLegacy = await prisma.supplier.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopAId,
        name: "foreign-legacy-string",
      },
    });
    for (const supplier of [malformed, foreignLegacy]) {
      await prisma.purchaseOrder.create({
        data: {
          shop: SHOP_A_DOMAIN,
          shopId: shopAId,
          supplierId: supplier.id,
          locationId: "loc",
        },
      });
    }

    const rows = await dbA().purchaseOrder.findMany({
      include: { supplier: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r: { supplier: { name: string } | null }) => r.supplier != null)).toBe(
      true,
    );
    expect(rows.map((r: { supplier: { name: string } }) => r.supplier.name).sort()).toEqual([
      "foreign-legacy-string",
      "malformed-legacy",
    ]);
  });

  it("null shopId matching legacy is returned; malformed null-owned is nulled", async () => {
    const matching = await prisma.supplier.create({
      data: {
        shop: ` ${SHOP_A_DOMAIN.toUpperCase()} `,
        shopId: null,
        name: "null-match",
      },
    });
    const bad = await prisma.supplier.create({
      data: { shop: "not-a-domain", shopId: null, name: "SECRET-BAD" },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: matching.id,
        locationId: "loc",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: bad.id,
        locationId: "loc",
      },
    });

    const rows = await dbA().purchaseOrder.findMany({
      include: { supplier: true },
    });
    expect(rows).toHaveLength(2);
    const names = rows.map((r: { supplier: { name: string } | null }) =>
      r.supplier?.name ?? null,
    );
    expect(names).toContain("null-match");
    expect(names).toContain(null);
    expect(names).not.toContain("SECRET-BAD");
  });

  it("to-many filters foreign child and keeps null-owned same-parent child", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "parent" },
    });
    const ownedPo = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
        notes: "owned",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: supplier.id,
        locationId: "loc-b",
        notes: "SECRET-FOREIGN",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: null,
        supplierId: supplier.id,
        locationId: "loc-null",
        notes: "null-owned",
      },
    });

    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: {
        purchaseOrders: true,
        _count: { select: { purchaseOrders: true } },
      },
    });
    expect(row.purchaseOrders.map((p: { notes: string | null }) => p.notes).sort()).toEqual([
      "null-owned",
      "owned",
    ]);
    expect(row._count.purchaseOrders).toBe(2);
    expect(row.purchaseOrders.some((p: { id: string }) => p.id === ownedPo.id)).toBe(
      true,
    );
  });

  it("nested relation within another relation and partial select", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "nest" },
    });
    const po = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });
    await prisma.pOLineItem.create({
      data: {
        shopId: shopAId,
        purchaseOrderId: po.id,
        shopifyVariantId: "v1",
        orderedQty: 2,
        unitCost: 1,
      },
    });
    await prisma.pOLineItem.create({
      data: {
        shopId: shopBId,
        purchaseOrderId: po.id,
        shopifyVariantId: "v-foreign",
        orderedQty: 9,
        unitCost: 1,
      },
    });

    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      select: {
        name: true,
        purchaseOrders: {
          select: {
            locationId: true,
            lineItems: { select: { orderedQty: true } },
          },
        },
      },
    });
    expect(row.name).toBe("nest");
    expect(row.purchaseOrders).toHaveLength(1);
    expect(row.purchaseOrders[0].lineItems).toHaveLength(1);
    expect(row.purchaseOrders[0].lineItems[0].orderedQty).toBe(2);
    expect(Object.keys(row.purchaseOrders[0].lineItems[0])).toEqual([
      "orderedQty",
    ]);
  });
});
