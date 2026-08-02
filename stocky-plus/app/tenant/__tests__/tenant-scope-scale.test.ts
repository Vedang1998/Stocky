/**
 * F-PR2R2-02 — scalable tenant scope must not materialize owned-row IDs.
 * Real PostgreSQL 16; seed via generate_series.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const SCALE_SIZES = [30_000, 32_766, 32_767, 32_768, 40_000] as const;

describe("tenant scope scale tests (F-PR2R2-02)", () => {
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
      }),
    );
  }

  async function seedInventorySnapshots(n: number, mode: "canonical" | "null" | "mixed" | "multi-raw") {
    await prisma.$executeRawUnsafe(`TRUNCATE "InventorySnapshot" CASCADE`);

    if (mode === "canonical") {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "InventorySnapshot" (id, shop, "shopId", "shopifyVariantId", "locationId", "snapshotDate", "quantityAvailable")
        SELECT
          md5(random()::text || clock_timestamp()::text || g::text),
          $1,
          $2::text,
          'gid://v/' || g,
          'loc',
          DATE '2026-01-01',
          1
        FROM generate_series(1, $3) AS g
        `,
        SHOP_A_DOMAIN,
        shopAId,
        n,
      );
    } else if (mode === "null") {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "InventorySnapshot" (id, shop, "shopId", "shopifyVariantId", "locationId", "snapshotDate", "quantityAvailable")
        SELECT
          md5(random()::text || clock_timestamp()::text || g::text),
          $1,
          NULL,
          'gid://v/' || g,
          'loc',
          DATE '2026-01-01',
          1
        FROM generate_series(1, $2) AS g
        `,
        SHOP_A_DOMAIN,
        n,
      );
    } else if (mode === "multi-raw") {
      // Several accepted raw representations that normalize to the domain.
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "InventorySnapshot" (id, shop, "shopId", "shopifyVariantId", "locationId", "snapshotDate", "quantityAvailable")
        SELECT
          md5(random()::text || clock_timestamp()::text || g::text),
          CASE (g % 4)
            WHEN 0 THEN $1
            WHEN 1 THEN upper($1)
            WHEN 2 THEN ' ' || $1
            ELSE $1 || ' '
          END,
          NULL,
          'gid://v/' || g,
          'loc',
          DATE '2026-01-01',
          1
        FROM generate_series(1, $2) AS g
        `,
        SHOP_A_DOMAIN,
        n,
      );
    } else {
      const half = Math.floor(n / 2);
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "InventorySnapshot" (id, shop, "shopId", "shopifyVariantId", "locationId", "snapshotDate", "quantityAvailable")
        SELECT
          md5(random()::text || clock_timestamp()::text || g::text),
          $1,
          $2::text,
          'gid://v/' || g,
          'loc',
          DATE '2026-01-01',
          1
        FROM generate_series(1, $3) AS g
        `,
        SHOP_A_DOMAIN,
        shopAId,
        half,
      );
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "InventorySnapshot" (id, shop, "shopId", "shopifyVariantId", "locationId", "snapshotDate", "quantityAvailable")
        SELECT
          md5(random()::text || clock_timestamp()::text || g::text),
          $1,
          NULL,
          'gid://vn/' || g,
          'loc',
          DATE '2026-01-01',
          1
        FROM generate_series(1, $2) AS g
        `,
        SHOP_A_DOMAIN,
        n - half,
      );
    }

    // Foreign control rows must never appear.
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "InventorySnapshot" (id, shop, "shopId", "shopifyVariantId", "locationId", "snapshotDate", "quantityAvailable")
      VALUES
        (md5(random()::text || 'f1'), $1, $2::text, 'gid://foreign/1', 'loc', DATE '2026-01-01', 9),
        (md5(random()::text || 'f2'), $1, NULL, 'gid://foreign/2', 'loc', DATE '2026-01-01', 9)
      `,
      SHOP_B_DOMAIN,
      shopBId,
    );
  }

  for (const n of SCALE_SIZES) {
    it(`canonical non-null rows n=${n}: findMany/count/aggregate/groupBy/updateMany/deleteMany/create`, async () => {
      await seedInventorySnapshots(n, "canonical");
      const db = dbA();

      const t0 = Date.now();
      const page = await db.inventorySnapshot.findMany({ take: 1 });
      const findManyMs = Date.now() - t0;
      expect(page).toHaveLength(1);

      const t1 = Date.now();
      const count = await db.inventorySnapshot.count({});
      const countMs = Date.now() - t1;
      expect(count).toBe(n);

      const filtered = await db.inventorySnapshot.findMany({
        where: { locationId: "loc" },
        take: 5,
        orderBy: { shopifyVariantId: "asc" },
      });
      expect(filtered.length).toBeGreaterThan(0);

      const agg = await db.inventorySnapshot.aggregate({
        _sum: { quantityAvailable: true },
      });
      expect(agg._sum.quantityAvailable).toBe(n);

      const groups = await db.inventorySnapshot.groupBy({
        by: ["locationId"],
        _count: { _all: true },
      });
      expect(groups.some((g: { locationId: string; _count: { _all: number } }) => g.locationId === "loc" && g._count._all === n)).toBe(true);

      const updated = await db.inventorySnapshot.updateMany({
        where: { shopifyVariantId: "gid://v/1" },
        data: { quantityAvailable: 42 },
      });
      expect(updated.count).toBe(1);

      const deleted = await db.inventorySnapshot.deleteMany({
        where: { shopifyVariantId: "gid://v/2" },
      });
      expect(deleted.count).toBe(1);

      const created = await db.inventorySnapshot.create({
        data: {
          shopifyVariantId: "gid://v/new",
          locationId: "loc",
          snapshotDate: new Date("2026-02-01T00:00:00.000Z"),
          quantityAvailable: 1,
        },
      });
      expect(created.shopId).toBe(shopAId);

      // Evidence only — not a performance gate.
      expect(findManyMs).toBeGreaterThanOrEqual(0);
      expect(countMs).toBeGreaterThanOrEqual(0);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          n,
          mode: "canonical",
          findManyMs,
          countMs,
        }),
      );
    }, 180_000);
  }

  it("mixed canonical + null-owned + multi-raw at 32768 rows", async () => {
    await seedInventorySnapshots(32_768, "mixed");
    const db = dbA();
    expect(await db.inventorySnapshot.count({})).toBe(32_768);
    expect(
      (await db.inventorySnapshot.findMany({ take: 1 })).length,
    ).toBe(1);

    await seedInventorySnapshots(32_768, "multi-raw");
    expect(await db.inventorySnapshot.count({})).toBe(32_768);
  }, 180_000);
});
