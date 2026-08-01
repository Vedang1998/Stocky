/**
 * F-PR2C-04 — normalization-aware legacy shop ownership.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import { acceptedLegacyShopVariants } from "../legacy-scope";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant legacy normalization compatibility (F-PR2C-04)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
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

  it("visible matrix: canonical / uppercase / whitespace with and without shopId", async () => {
    const variants = acceptedLegacyShopVariants(SHOP_A_DOMAIN);
    const seeded: string[] = [];

    for (const shop of variants) {
      const withId = await prisma.supplier.create({
        data: { shop, shopId: shopAId, name: `id:${shop}` },
      });
      const nullId = await prisma.supplier.create({
        data: { shop, shopId: null, name: `null:${shop}` },
      });
      seeded.push(withId.id, nullId.id);
    }

    // Case 10: canonical shopId with empty legacy shop
    const emptyLegacy = await prisma.supplier.create({
      data: { shop: "", shopId: shopAId, name: "empty-legacy" },
    });
    seeded.push(emptyLegacy.id);

    // Foreign controls
    await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "foreign-b" },
    });
    await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: null, name: "foreign-null-b" },
    });
    await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopBId,
        name: "conflict-foreign-id",
      },
    });
    await prisma.supplier.create({
      data: { shop: "not-a-shop", shopId: null, name: "malformed" },
    });

    const rows = await dbA().supplier.findMany({});
    const ids = new Set(rows.map((r: { id: string }) => r.id));
    for (const id of seeded) {
      expect(ids.has(id)).toBe(true);
    }
    expect(rows.every((r: { name: string }) => !r.name.startsWith("foreign"))).toBe(
      true,
    );
    expect(rows.every((r: { name: string }) => r.name !== "malformed")).toBe(
      true,
    );
    expect(
      rows.every((r: { name: string }) => r.name !== "conflict-foreign-id"),
    ).toBe(true);
  });

  it("unique read, count, update, updateMany, delete, deleteMany respect normalization", async () => {
    const upper = SHOP_A_DOMAIN.toUpperCase();
    const padded = `  ${SHOP_A_DOMAIN}  `;

    const rowUpperNull = await prisma.supplier.create({
      data: { shop: upper, shopId: null, name: "upper-null" },
    });
    const rowPadId = await prisma.supplier.create({
      data: { shop: padded, shopId: shopAId, name: "pad-id" },
    });
    const foreign = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "foreign" },
    });

    expect(
      await dbA().supplier.findUnique({ where: { id: rowUpperNull.id } }),
    ).not.toBeNull();
    expect(
      await dbA().supplier.findUnique({ where: { id: foreign.id } }),
    ).toBeNull();

    expect(await dbA().supplier.count({})).toBeGreaterThanOrEqual(2);

    await dbA().supplier.update({
      where: { id: rowUpperNull.id },
      data: { name: "upper-null-updated" },
    });
    expect(
      (await prisma.supplier.findUnique({ where: { id: rowUpperNull.id } }))
        ?.name,
    ).toBe("upper-null-updated");

    await dbA().supplier.updateMany({
      data: { contactName: "touched" },
    });
    expect(
      (await prisma.supplier.findUnique({ where: { id: rowPadId.id } }))
        ?.contactName,
    ).toBe("touched");
    expect(
      (await prisma.supplier.findUnique({ where: { id: foreign.id } }))
        ?.contactName,
    ).toBeNull();

    await dbA().supplier.delete({ where: { id: rowUpperNull.id } });
    expect(
      await prisma.supplier.findUnique({ where: { id: rowUpperNull.id } }),
    ).toBeNull();

    await dbA().supplier.deleteMany({ where: { name: "pad-id" } });
    expect(
      await prisma.supplier.findUnique({ where: { id: rowPadId.id } }),
    ).toBeNull();
    expect(
      await prisma.supplier.findUnique({ where: { id: foreign.id } }),
    ).not.toBeNull();
  });

  it("relation include and _count use normalization-aware scope", async () => {
    const supplier = await prisma.supplier.create({
      data: {
        shop: ` ${SHOP_A_DOMAIN.toUpperCase()} `,
        shopId: shopAId,
        name: "rel-parent",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplier.id,
        locationId: "loc",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: supplier.id,
        locationId: "loc-b",
      },
    });

    const row = await dbA().supplier.findUnique({
      where: { id: supplier.id },
      include: {
        purchaseOrders: true,
        _count: { select: { purchaseOrders: true } },
      },
    });
    expect(row).not.toBeNull();
    expect(row.purchaseOrders).toHaveLength(1);
    expect(row._count.purchaseOrders).toBe(1);
  });
});
