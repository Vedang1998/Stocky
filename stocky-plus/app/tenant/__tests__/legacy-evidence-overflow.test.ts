/**
 * F-PR2R3-01 — bound distinct null-ownership legacy evidence.
 * Fail closed with legacy_evidence_overflow; never hit PostgreSQL bind cliff.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { TenantAccessError } from "../errors";
import {
  MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT,
  LEGACY_EVIDENCE_VERSION,
} from "../legacy-scope";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const LIMIT = MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT;

describe("tenant legacy-evidence overflow (F-PR2R3-01)", () => {
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
        correlationId: "corr-overflow-a",
      }),
    );
  }

  async function seedDistinctLegacyForms(n: number) {
    await prisma.$executeRawUnsafe(`TRUNCATE "Supplier" CASCADE`);
    if (n === 0) return;
    // Distinct leading-space counts — all normalize to SHOP_A_DOMAIN.
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Supplier" (id, shop, "shopId", name)
      SELECT
        md5(random()::text || clock_timestamp()::text || g::text),
        repeat(' ', g) || $1,
        NULL,
        'legacy-' || g
      FROM generate_series(1, $2) AS g
      `,
      SHOP_A_DOMAIN,
      n,
    );
  }

  async function seedCanonicalRow() {
    return prisma.supplier.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        name: "canonical-owned",
      },
    });
  }

  it("exports phase1-legacy-evidence-v1 far below PostgreSQL bind ceiling", () => {
    expect(LEGACY_EVIDENCE_VERSION).toBe("phase1-legacy-evidence-v1");
    expect(LIMIT).toBeGreaterThan(0);
    expect(LIMIT).toBeLessThanOrEqual(4096);
    expect(LIMIT).toBeLessThan(32_000);
  });

  for (const n of [0, 1, LIMIT - 1, LIMIT] as const) {
    it(`succeeds at distinct legacy form count ${n}`, async () => {
      await seedDistinctLegacyForms(n);
      const canonical = await seedCanonicalRow();
      const count = await dbA().supplier.count({});
      expect(count).toBe(n + 1);
      const found = await dbA().supplier.findMany({ take: 5 });
      expect(found.some((r: { id: string }) => r.id === canonical.id)).toBe(
        true,
      );
      expect(await dbA().supplier.aggregate({ _count: { _all: true } })).toEqual(
        { _count: { _all: n + 1 } },
      );
      const groups = await dbA().supplier.groupBy({
        by: ["shopId"],
        _count: { _all: true },
      });
      const total = groups.reduce(
        (sum: number, g: { _count: { _all: number } }) => sum + g._count._all,
        0,
      );
      expect(total).toBe(n + 1);
    }, 180_000);
  }

  for (const n of [LIMIT + 1, 32_000, 32_765, 40_000] as const) {
    it(`fails closed at distinct legacy form count ${n} without PG bind error`, async () => {
      await seedDistinctLegacyForms(n);
      const canonical = await seedCanonicalRow();
      const before = await prisma.supplier.findUnique({
        where: { id: canonical.id },
      });

      let caught: unknown;
      try {
        await dbA().supplier.count({});
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TenantAccessError);
      const err = caught as TenantAccessError;
      expect(err.code).toBe("legacy_evidence_overflow");
      expect(err.message).toContain(`limit=${LIMIT}`);
      expect(err.message).toContain("observedCount=");
      expect(err.message).toContain("model=Supplier");
      expect(err.message).toContain(`shopId=${shopAId}`);
      expect(err.message).toContain("correlationId=corr-overflow-a");
      // No raw legacy values in diagnostics.
      expect(err.message).not.toContain(SHOP_A_DOMAIN);
      expect(err.message).not.toMatch(/ {2,}/);
      // Not a PostgreSQL / Prisma bind failure.
      expect((caught as { name?: string }).name).toBe("TenantAccessError");
      expect(String(caught)).not.toMatch(/PrismaClientKnownRequestError/);
      expect(String(caught)).not.toMatch(/too many|bind|3276/i);

      // No mutation; canonical row unchanged; no silent partial result.
      const after = await prisma.supplier.findUnique({
        where: { id: canonical.id },
      });
      expect(after).toEqual(before);

      await expect(dbA().supplier.findMany({})).rejects.toMatchObject({
        code: "legacy_evidence_overflow",
      });
      await expect(
        dbA().supplier.updateMany({ data: { name: "TOUCHED" } }),
      ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });
      await expect(dbA().supplier.deleteMany({})).rejects.toMatchObject({
        code: "legacy_evidence_overflow",
      });

      expect(
        (await prisma.supplier.findUnique({ where: { id: canonical.id } }))
          ?.name,
      ).toBe("canonical-owned");
    }, 300_000);
  }

  it("create remains unaffected by excessive legacy evidence", async () => {
    await seedDistinctLegacyForms(LIMIT + 1);
    const created = await dbA().supplier.create({
      data: { name: "create-ok" },
    });
    expect(created.shopId).toBe(shopAId);
    expect(created.name).toBe("create-ok");
  }, 180_000);

  it("foreign canonical selector rejects without requiring full legacy collection", async () => {
    await seedDistinctLegacyForms(LIMIT + 1);
    const own = await seedCanonicalRow();
    const foreign = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "foreign" },
    });

    await expect(
      dbA().supplier.findUnique({
        where: { shopId_id: { shopId: shopBId, id: foreign.id } },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    // Own canonical ID still resolves via shopId path without needing the
    // overflowing null-ownership set.
    const found = await dbA().supplier.findUnique({ where: { id: own.id } });
    expect(found?.id).toBe(own.id);
  }, 180_000);

  it("to-many include and _count fail closed on overflow (no partial parents)", async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE "PurchaseOrder" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE "Supplier" CASCADE`);
    await seedDistinctLegacyForms(LIMIT + 1);
    const parent = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "parent" },
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
        include: { purchaseOrders: true, _count: { select: { purchaseOrders: true } } },
      }),
    ).rejects.toMatchObject({ code: "legacy_evidence_overflow" });
  }, 180_000);
});
