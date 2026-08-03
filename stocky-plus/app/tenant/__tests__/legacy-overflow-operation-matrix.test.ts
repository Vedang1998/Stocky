/**
 * F-PR2R4-05 — overflow operation matrix and narrowed blast radius.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { getMaxDistinctLegacyShopFormsPerModelTenant } from "../legacy-scope";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const LIMIT = getMaxDistinctLegacyShopFormsPerModelTenant();

describe("tenant legacy overflow operation-matrix (F-PR2R4-05)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function dbA() {
    return createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
        correlationId: "corr-overflow-matrix",
      }),
    );
  }

  async function seedOverflowLegacyForms(n: number) {
    await prisma.$executeRawUnsafe(`TRUNCATE "Supplier" CASCADE`);
    if (n === 0) return;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Supplier" (id, shop, "shopId", name, currency, "createdAt", "updatedAt")
      SELECT
        md5(random()::text || clock_timestamp()::text || g::text),
        (
          SELECT string_agg(ch, '' ORDER BY ord DESC)
          FROM (
            SELECT
              pos AS ord,
              (ARRAY[
                chr(32),
                chr(9),
                chr(10),
                chr(13),
                chr(11),
                chr(12)
              ])[1 + ((((g - 1) / power(6, pos)::int) % 6))::int] AS ch
            FROM generate_series(0, 5) AS pos
          ) s
        ) || $1,
        NULL,
        'legacy-' || g,
        'USD',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM generate_series(1, $2) AS g
      `,
      SHOP_A_DOMAIN,
      n,
    );
  }

  it("operation matrix under excessive null legacy forms", async () => {
    await seedOverflowLegacyForms(LIMIT + 50);
    const canonical = await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "canonical-owned",
      },
    });
    const foreign = await prisma.supplier.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        name: "foreign",
      },
    });
    const nullOwned = await prisma.supplier.create({
      data: {
        shop: `\t${SHOP_A_DOMAIN}`,
        shopId: null,
        name: "null-owned-extra",
      },
    });

    const db = dbA();

    // Must not require legacy discovery
    const created = await db.supplier.create({ data: { name: "create-ok" } });
    expect(created.shopId).toBe(shopAId);

    const byId = await db.supplier.findUnique({ where: { id: canonical.id } });
    expect(byId?.id).toBe(canonical.id);

    const updated = await db.supplier.update({
      where: { id: canonical.id },
      data: { name: "canonical-updated" },
    });
    expect(updated.name).toBe("canonical-updated");

    const byShopIdId = await db.supplier.findUnique({
      where: { shopId_id: { shopId: shopAId, id: canonical.id } },
    });
    expect(byShopIdId?.id).toBe(canonical.id);

    await expect(
      db.supplier.findUnique({
        where: { shopId_id: { shopId: shopBId, id: foreign.id } },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    // May require legacy discovery — fail closed, no partial results
    await expect(db.supplier.findMany({})).rejects.toMatchObject({
      code: "legacy_evidence_overflow",
    });
    await expect(db.supplier.count({})).rejects.toMatchObject({
      code: "legacy_evidence_overflow",
    });
    await expect(
      db.supplier.aggregate({ _count: { _all: true } }),
    ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });
    await expect(
      db.supplier.groupBy({ by: ["shopId"], _count: { _all: true } }),
    ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });
    await expect(
      db.supplier.updateMany({ data: { name: "x" } }),
    ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });
    await expect(db.supplier.deleteMany({})).rejects.toMatchObject({
      code: "legacy_evidence_overflow",
    });

    // Null-owned ID lookup requires legacy proof → overflow
    await expect(
      db.supplier.findUnique({ where: { id: nullOwned.id } }),
    ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });

    // Canonical row unchanged by denied broad ops; create/update succeeded.
    const after = await prisma.supplier.findUnique({
      where: { id: canonical.id },
    });
    expect(after?.name).toBe("canonical-updated");
    expect(
      (await prisma.supplier.findUnique({ where: { id: foreign.id } }))?.name,
    ).toBe("foreign");
  }, 300_000);

  it("delete by canonical id succeeds under overflow", async () => {
    await seedOverflowLegacyForms(LIMIT + 10);
    const canonical = await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "to-delete",
      },
    });
    await dbA().supplier.delete({ where: { id: canonical.id } });
    expect(
      await prisma.supplier.findUnique({ where: { id: canonical.id } }),
    ).toBeNull();
  }, 180_000);

  it("relation include/_count fail closed on overflow with no partial parents", async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "PurchaseOrder" CASCADE`);
    await seedOverflowLegacyForms(LIMIT + 10);
    const parent = await prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "parent",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: parent.id,
        locationId: "loc",
      },
    });

    await expect(
      dbA().supplier.findMany({
        include: {
          purchaseOrders: true,
          _count: { select: { purchaseOrders: true } },
        },
      }),
    ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });

    // Parent still intact; no silent partial list.
    expect(
      (await prisma.supplier.findUnique({ where: { id: parent.id } }))?.name,
    ).toBe("parent");
  }, 180_000);
});
