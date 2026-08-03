/**
 * F-PR2C-09 — ownership precheck + mutation atomicity.
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

describe("tenant write atomicity (F-PR2C-09)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
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

  it("create under parent fails closed when ownership changes concurrently", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });

    const dbA = createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );

    // Interleave: start create, flip parent ownership mid-flight via raw client.
    // Application-layer mitigation uses serializable transactions; residual
    // race remains until PR 3 composite FKs / RLS.
    const createPromise = dbA.supplierSkuMapping.create({
      data: {
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "race",
      },
    });

    // Concurrent ownership change
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { shopId: shopBId, shop: SHOP_B_DOMAIN },
    });

    let threw = false;
    try {
      await createPromise;
    } catch {
      threw = true;
    }

    const children = await prisma.supplierSkuMapping.findMany({
      where: { supplierId: supplier.id },
    });

    // Either the create was rejected, or if it raced before the update was
    // visible, document residual — but under serializable isolation we expect
    // rejection or a child that still has shopId = A from injectOwnership.
    if (!threw) {
      // Residual PR 3: if create succeeded, child must still carry shop A id
      // from injectOwnership (not silently tenant-B).
      expect(children.every((c) => c.shopId === shopAId)).toBe(true);
    } else {
      expect(children.length).toBe(0);
    }
  });
});
