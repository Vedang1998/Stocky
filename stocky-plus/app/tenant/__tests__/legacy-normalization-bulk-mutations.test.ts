/**
 * F-PR2R3-04 — legacy normalization bulk-mutation consistency.
 * Top-level updateMany / deleteMany and nested bulk ops honor D-030.
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

describe("tenant legacy normalization bulk-mutation consistency (F-PR2R3-04)", () => {
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

  it("top-level updateMany/deleteMany include tab/newline null-owned rows and exclude foreign", async () => {
    const owned = [
      await prisma.supplier.create({
        data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "canonical" },
      }),
      await prisma.supplier.create({
        data: { shop: `\t${SHOP_A_DOMAIN}`, shopId: null, name: "tab" },
      }),
      await prisma.supplier.create({
        data: { shop: `\n${SHOP_A_DOMAIN}`, shopId: null, name: "lf" },
      }),
      await prisma.supplier.create({
        data: {
          shop: ` ${SHOP_A_DOMAIN.toUpperCase()} `,
          shopId: null,
          name: "ws-upper",
        },
      }),
    ];
    const foreign = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "foreign" },
    });
    const foreignNull = await prisma.supplier.create({
      data: { shop: `\t${SHOP_B_DOMAIN}`, shopId: null, name: "foreign-null" },
    });

    const updated = await dbA().supplier.updateMany({
      data: { name: "TOUCHED" },
    });
    expect(updated.count).toBe(owned.length);

    for (const row of owned) {
      expect(
        (await prisma.supplier.findUnique({ where: { id: row.id } }))?.name,
      ).toBe("TOUCHED");
    }
    expect(
      (await prisma.supplier.findUnique({ where: { id: foreign.id } }))?.name,
    ).toBe("foreign");
    expect(
      (await prisma.supplier.findUnique({ where: { id: foreignNull.id } }))
        ?.name,
    ).toBe("foreign-null");

    const deleted = await dbA().supplier.deleteMany({});
    expect(deleted.count).toBe(owned.length);
    expect(await prisma.supplier.count({})).toBe(2);
  });

  it("nested updateMany/deleteMany honor D-030 on parent and child", async () => {
    const parent = await prisma.supplier.create({
      data: { shop: `\t${SHOP_A_DOMAIN}`, shopId: null, name: "parent" },
    });
    const childOwned = await prisma.purchaseOrder.create({
      data: {
        shop: `\n${SHOP_A_DOMAIN}`,
        shopId: null,
        supplierId: parent.id,
        locationId: "loc",
        notes: "before",
      },
    });
    const childForeign = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: parent.id,
        locationId: "loc-b",
        notes: "foreign-before",
      },
    });

    await dbA().supplier.update({
      where: { id: parent.id },
      data: {
        purchaseOrders: {
          updateMany: {
            where: {},
            data: { notes: "NESTED-TOUCHED" },
          },
        },
      },
    });

    expect(
      (await prisma.purchaseOrder.findUnique({ where: { id: childOwned.id } }))
        ?.notes,
    ).toBe("NESTED-TOUCHED");
    expect(
      (
        await prisma.purchaseOrder.findUnique({
          where: { id: childForeign.id },
        })
      )?.notes,
    ).toBe("foreign-before");

    await dbA().supplier.update({
      where: { id: parent.id },
      data: {
        purchaseOrders: {
          deleteMany: { notes: "NESTED-TOUCHED" },
        },
      },
    });

    expect(
      await prisma.purchaseOrder.findUnique({ where: { id: childOwned.id } }),
    ).toBeNull();
    expect(
      await prisma.purchaseOrder.findUnique({ where: { id: childForeign.id } }),
    ).not.toBeNull();
  });
});
