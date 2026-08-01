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

describe("nullable ownership compatibility matrix (C-01)", () => {
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

  async function seedDirectCases() {
    const canonical = await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "canonical-match",
      },
    });
    const nullOwned = await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: null,
        name: "null-shopId-match",
      },
    });
    const foreignId = await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopBId,
        name: "foreign-shopId-match-legacy",
      },
    });
    const conflict = await prisma.supplier.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopAId,
        name: "canonical-conflict-legacy",
      },
    });
    return { canonical, nullOwned, foreignId, conflict };
  }

  it("1 direct canonical shopId+shop: read/update/delete allowed", async () => {
    const { canonical } = await seedDirectCases();
    const db = dbA();
    const found = await db.supplier.findMany({});
    expect(found.map((s: { name: string }) => s.name).sort()).toEqual([
      "canonical-match",
      "null-shopId-match",
    ]);
    const one = await db.supplier.findUnique({ where: { id: canonical.id } });
    expect(one?.name).toBe("canonical-match");
    const updated = await db.supplier.update({
      where: { id: canonical.id },
      data: { name: "canonical-updated" },
    });
    expect(updated.name).toBe("canonical-updated");
    await db.supplier.delete({ where: { id: canonical.id } });
    expect(
      await prisma.supplier.findUnique({ where: { id: canonical.id } }),
    ).toBeNull();
  });

  it("2 direct null shopId matching legacy shop: read/update/delete allowed", async () => {
    const { nullOwned } = await seedDirectCases();
    const db = dbA();
    const one = await db.supplier.findFirst({
      where: { id: nullOwned.id },
    });
    expect(one?.name).toBe("null-shopId-match");
    // Must not silently repair shopId on update
    await expect(
      db.supplier.update({
        where: { id: nullOwned.id },
        data: { shopId: shopAId },
      }),
    ).rejects.toMatchObject({ code: "shop_id_immutable" });
    const updated = await db.supplier.update({
      where: { id: nullOwned.id },
      data: { name: "null-updated" },
    });
    expect(updated.name).toBe("null-updated");
    const raw = await prisma.supplier.findUnique({
      where: { id: nullOwned.id },
    });
    expect(raw?.shopId).toBeNull();
    await db.supplier.delete({ where: { id: nullOwned.id } });
  });

  it("3 direct foreign non-null shopId with matching legacy shop: denied", async () => {
    const { foreignId } = await seedDirectCases();
    const db = dbA();
    expect(
      await db.supplier.findFirst({ where: { id: foreignId.id } }),
    ).toBeNull();
    await expect(
      db.supplier.update({
        where: { id: foreignId.id },
        data: { name: "nope" },
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      db.supplier.delete({ where: { id: foreignId.id } }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(
      await prisma.supplier.findUnique({ where: { id: foreignId.id } }),
    ).not.toBeNull();
  });

  it("4 direct canonical shopId with conflicting legacy shop: denied", async () => {
    const { conflict } = await seedDirectCases();
    const db = dbA();
    expect(
      await db.supplier.findFirst({ where: { id: conflict.id } }),
    ).toBeNull();
    await expect(
      db.supplier.update({
        where: { id: conflict.id },
        data: { name: "nope" },
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("5 child canonical shopId same-tenant parent: allowed", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const child = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "A",
      },
    });
    const db = dbA();
    expect(
      (await db.supplierSkuMapping.findMany({})).map((c: { id: string }) => c.id),
    ).toEqual([child.id]);
    await db.supplierSkuMapping.update({
      where: { id: child.id },
      data: { vendorSku: "A2" },
    });
    await db.supplierSkuMapping.delete({ where: { id: child.id } });
  });

  it("6 child null shopId same-tenant parent: allowed", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const child = await prisma.supplierSkuMapping.create({
      data: {
        shopId: null,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "N",
      },
    });
    const db = dbA();
    expect(
      await db.supplierSkuMapping.findFirst({ where: { id: child.id } }),
    ).not.toBeNull();
    await db.supplierSkuMapping.update({
      where: { id: child.id },
      data: { vendorSku: "N2" },
    });
    await db.supplierSkuMapping.delete({ where: { id: child.id } });
  });

  it("7 child foreign shopId same-tenant parent: denied", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "S" },
    });
    const child = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "F",
      },
    });
    const db = dbA();
    expect(
      await db.supplierSkuMapping.findFirst({ where: { id: child.id } }),
    ).toBeNull();
  });

  it("8 child canonical shopId foreign parent: denied", async () => {
    const foreignSupplier = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "SB" },
    });
    const child = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: foreignSupplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "X",
      },
    });
    const db = dbA();
    expect(
      await db.supplierSkuMapping.findFirst({ where: { id: child.id } }),
    ).toBeNull();
  });

  it("9 child null shopId missing/ambiguous lineage: denied", async () => {
    // Parent missing entirely — FK normally prevents this; simulate orphan via
    // parent that does not satisfy tenant scope (null parent shop mismatch).
    const ambiguousParent = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: null, name: "ambiguous" },
    });
    const child = await prisma.supplierSkuMapping.create({
      data: {
        shopId: null,
        supplierId: ambiguousParent.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "orphan",
      },
    });
    const db = dbA();
    expect(
      await db.supplierSkuMapping.findFirst({ where: { id: child.id } }),
    ).toBeNull();
  });

  it("10 global ID from Shop B supplied through Shop A: denied", async () => {
    const bSupplier = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
    });
    const db = dbA();
    expect(
      await db.supplier.findUnique({ where: { id: bSupplier.id } }),
    ).toBeNull();
    await expect(
      db.supplier.update({
        where: { id: bSupplier.id },
        data: { name: "hack" },
      }),
    ).rejects.toBeInstanceOf(TenantAccessError);
  });

  it("creates still inject canonical ownership", async () => {
    const db = dbA();
    const row = await db.supplier.create({ data: { name: "new" } });
    expect(row.shopId).toBe(shopAId);
    expect(row.shop).toBe(SHOP_A_DOMAIN);
  });

  it("covers findMany/count/updateMany/deleteMany families on null rows", async () => {
    await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: null, name: "N1" },
    });
    const db = dbA();
    expect(await db.supplier.count({})).toBe(1);
    await db.supplier.updateMany({
      where: { name: "N1" },
      data: { name: "N1b" },
    });
    expect((await db.supplier.findMany({}))[0].name).toBe("N1b");
    await db.supplier.deleteMany({ where: { name: "N1b" } });
    expect(await db.supplier.count({})).toBe(0);
  });
});
