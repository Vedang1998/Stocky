/**
 * F-PR2R3-04 — legacy normalization relation consistency.
 * to-one / to-many include and _count honor D-030 whitespace normalization.
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

describe("tenant legacy normalization relation consistency (F-PR2R3-04)", () => {
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

  it("to-one include returns tab-padded null-owned supplier; foreign stays null", async () => {
    const ownedSupplier = await prisma.supplier.create({
      data: { shop: `\t${SHOP_A_DOMAIN}`, shopId: null, name: "tab-sup" },
    });
    const foreignSupplier = await prisma.supplier.create({
      data: { shop: `\t${SHOP_B_DOMAIN}`, shopId: null, name: "foreign-tab" },
    });

    const poOwned = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: ownedSupplier.id,
        locationId: "loc",
      },
    });
    const poForeign = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: foreignSupplier.id,
        locationId: "loc-2",
      },
    });

    const rows = await dbA().purchaseOrder.findMany({
      include: { supplier: true },
      orderBy: { locationId: "asc" },
    });
    expect(rows).toHaveLength(2);
    const byId = new Map(rows.map((r: { id: string; supplier: { id: string } | null }) => [r.id, r]));
    expect(byId.get(poOwned.id)?.supplier?.id).toBe(ownedSupplier.id);
    expect(byId.get(poForeign.id)?.supplier).toBeNull();
  });

  it("to-many include and _count include tab/newline children and exclude foreign", async () => {
    const parent = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "parent" },
    });
    const childTab = await prisma.purchaseOrder.create({
      data: {
        shop: `\t${SHOP_A_DOMAIN}`,
        shopId: null,
        supplierId: parent.id,
        locationId: "tab",
      },
    });
    const childLf = await prisma.purchaseOrder.create({
      data: {
        shop: `\n${SHOP_A_DOMAIN}`,
        shopId: null,
        supplierId: parent.id,
        locationId: "lf",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: parent.id,
        locationId: "foreign",
      },
    });

    const row = await dbA().supplier.findUnique({
      where: { id: parent.id },
      include: {
        purchaseOrders: true,
        _count: { select: { purchaseOrders: true } },
      },
    });

    expect(row).not.toBeNull();
    const ids = new Set(
      (row!.purchaseOrders as Array<{ id: string }>).map((c) => c.id),
    );
    expect(ids.has(childTab.id)).toBe(true);
    expect(ids.has(childLf.id)).toBe(true);
    expect(ids.size).toBe(2);
    expect(row!._count.purchaseOrders).toBe(2);
  });
});
