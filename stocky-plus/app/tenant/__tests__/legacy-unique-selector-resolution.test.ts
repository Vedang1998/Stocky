/**
 * F-PR2R4-01 — legacy-normalized unique selectors resolve without duplicates.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { runAfterAuthTenantBootstrap } from "../after-auth.server";
import { TenantAccessError } from "../errors";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  SHARED_EXTERNAL_ID,
} from "./helpers";

const RAW_VARIANTS: Array<{ id: string; raw: (d: string) => string }> = [
  { id: "canonical", raw: (d) => d },
  { id: "uppercase", raw: (d) => d.toUpperCase() },
  { id: "leading_space", raw: (d) => ` ${d}` },
  { id: "trailing_space", raw: (d) => `${d} ` },
  { id: "tab", raw: (d) => `\t${d}` },
  { id: "newline", raw: (d) => `\n${d}` },
  { id: "carriage_return", raw: (d) => `\r${d}` },
  { id: "nbsp", raw: (d) => `\u00A0${d}` },
  { id: "bom", raw: (d) => `\uFEFF${d}` },
  { id: "mixed_whitespace", raw: (d) => ` \t${d.toUpperCase()}\n` },
];

describe("tenant legacy unique-selector resolution (F-PR2R4-01)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.bomComponent.deleteMany();
    await prisma.forecastOverride.deleteMany();
    await prisma.variantAbcClass.deleteMany();
    await prisma.salesDailyAggregate.deleteMany();
    await prisma.inventorySnapshot.deleteMany();
    await prisma.shopifyVariantCache.deleteMany();
    await prisma.shopSettings.deleteMany();
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

  for (const variant of RAW_VARIANTS) {
    describe(`ShopSettings raw=${variant.id}`, () => {
      it("findUnique/update/delete/upsert resolve existing null-owned row", async () => {
        const rawShop = variant.raw(SHOP_A_DOMAIN);
        const seeded = await prisma.shopSettings.create({
          data: {
            shop: rawShop,
            shopId: null,
            defaultSafetyStock: 42,
            defaultLookbackDays: 77,
            targetDaysOfStock: 21,
            subscriptionPlan: "legacy-plan",
          },
        });

        const found = await dbA().shopSettings.findUnique({
          where: { shop: SHOP_A_DOMAIN },
        });
        expect(found?.id).toBe(seeded.id);
        expect(found?.defaultSafetyStock).toBe(42);

        const updated = await dbA().shopSettings.update({
          where: { shop: SHOP_A_DOMAIN },
          data: { defaultSafetyStock: 43 },
        });
        expect(updated.id).toBe(seeded.id);
        expect(updated.defaultSafetyStock).toBe(43);

        const beforeUpsert = await prisma.shopSettings.count();
        const upserted = await dbA().shopSettings.upsert({
          where: { shop: SHOP_A_DOMAIN },
          create: {
            shop: SHOP_A_DOMAIN,
            shopId: shopAId,
            defaultSafetyStock: 0,
          },
          update: { targetDaysOfStock: 22 },
        });
        expect(upserted.id).toBe(seeded.id);
        expect(upserted.targetDaysOfStock).toBe(22);
        expect(await prisma.shopSettings.count()).toBe(beforeUpsert);

        await dbA().shopSettings.delete({ where: { shop: SHOP_A_DOMAIN } });
        expect(await prisma.shopSettings.count()).toBe(0);
      });
    });
  }

  for (const variant of RAW_VARIANTS) {
    it(`ShopifyVariantCache compound resolves raw=${variant.id}`, async () => {
      const rawShop = variant.raw(SHOP_A_DOMAIN);
      const seeded = await prisma.shopifyVariantCache.create({
        data: {
          shop: rawShop,
          shopId: null,
          shopifyVariantId: SHARED_EXTERNAL_ID,
          title: "legacy-title",
        },
      });

      const where = {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      };

      const found = await dbA().shopifyVariantCache.findUnique({ where });
      expect(found?.id).toBe(seeded.id);

      const updated = await dbA().shopifyVariantCache.update({
        where,
        data: { title: "updated" },
      });
      expect(updated.id).toBe(seeded.id);
      expect(updated.title).toBe("updated");

      const before = await prisma.shopifyVariantCache.count();
      const upserted = await dbA().shopifyVariantCache.upsert({
        where,
        create: {
          shop: SHOP_A_DOMAIN,
          shopId: shopAId,
          shopifyVariantId: SHARED_EXTERNAL_ID,
          title: "created",
        },
        update: { title: "upserted" },
      });
      expect(upserted.id).toBe(seeded.id);
      expect(upserted.title).toBe("upserted");
      expect(await prisma.shopifyVariantCache.count()).toBe(before);

      await dbA().shopifyVariantCache.delete({ where });
      expect(await prisma.shopifyVariantCache.count()).toBe(0);
    });
  }

  const compoundModels: Array<{
    name: string;
    seed: (rawShop: string) => Promise<{ id: string }>;
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
    delegate: () => {
      findUnique: (a: unknown) => Promise<{ id: string } | null>;
      findUniqueOrThrow: (a: unknown) => Promise<{ id: string }>;
      update: (a: unknown) => Promise<{ id: string }>;
      delete: (a: unknown) => Promise<unknown>;
      upsert: (a: unknown) => Promise<{ id: string }>;
      count: () => Promise<number>;
    };
    rawCount: () => Promise<number>;
  }> = [
    {
      name: "InventorySnapshot",
      seed: (rawShop) =>
        prisma.inventorySnapshot.create({
          data: {
            shop: rawShop,
            shopId: null,
            shopifyVariantId: SHARED_EXTERNAL_ID,
            locationId: "loc-1",
            quantityAvailable: 9,
            snapshotDate: new Date("2026-01-01"),
          },
        }),
      where: {
        shop_shopifyVariantId_locationId_snapshotDate: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
          locationId: "loc-1",
          snapshotDate: new Date("2026-01-01"),
        },
      },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        locationId: "loc-1",
        quantityAvailable: 0,
        snapshotDate: new Date("2026-01-01"),
      },
      update: { quantityAvailable: 10 },
      delegate: () => dbA().inventorySnapshot,
      rawCount: () => prisma.inventorySnapshot.count(),
    },
    {
      name: "SalesDailyAggregate",
      seed: (rawShop) =>
        prisma.salesDailyAggregate.create({
          data: {
            shop: rawShop,
            shopId: null,
            shopifyVariantId: SHARED_EXTERNAL_ID,
            locationId: "loc-1",
            date: new Date("2026-01-02"),
            unitsSold: 5,
          },
        }),
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
          locationId: "loc-1",
          date: new Date("2026-01-02"),
        },
      },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        locationId: "loc-1",
        date: new Date("2026-01-02"),
        unitsSold: 0,
      },
      update: { unitsSold: 6 },
      delegate: () => dbA().salesDailyAggregate,
      rawCount: () => prisma.salesDailyAggregate.count(),
    },
    {
      name: "VariantAbcClass",
      seed: (rawShop) =>
        prisma.variantAbcClass.create({
          data: {
            shop: rawShop,
            shopId: null,
            shopifyVariantId: SHARED_EXTERNAL_ID,
            locationId: "all",
            metric: "REVENUE",
            abcClass: "A",
          },
        }),
      where: {
        shop_shopifyVariantId_locationId_metric: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
          locationId: "all",
          metric: "REVENUE",
        },
      },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        locationId: "all",
        metric: "REVENUE",
        abcClass: "B",
      },
      update: { abcClass: "C" },
      delegate: () => dbA().variantAbcClass,
      rawCount: () => prisma.variantAbcClass.count(),
    },
    {
      name: "BomComponent",
      seed: (rawShop) =>
        prisma.bomComponent.create({
          data: {
            shop: rawShop,
            shopId: null,
            bundleVariantId: "bundle-1",
            componentVariantId: "comp-1",
            quantity: 2,
          },
        }),
      where: {
        shop_bundleVariantId_componentVariantId: {
          shop: SHOP_A_DOMAIN,
          bundleVariantId: "bundle-1",
          componentVariantId: "comp-1",
        },
      },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        bundleVariantId: "bundle-1",
        componentVariantId: "comp-1",
        quantity: 1,
      },
      update: { quantity: 3 },
      delegate: () => dbA().bomComponent,
      rawCount: () => prisma.bomComponent.count(),
    },
    {
      name: "ForecastOverride",
      seed: (rawShop) =>
        prisma.forecastOverride.create({
          data: {
            shop: rawShop,
            shopId: null,
            variantId: SHARED_EXTERNAL_ID,
            locationId: "loc-1",
            lookbackStart: new Date("2026-01-01"),
            lookbackEnd: new Date("2026-01-31"),
          },
        }),
      where: {
        shop_variantId_locationId: {
          shop: SHOP_A_DOMAIN,
          variantId: SHARED_EXTERNAL_ID,
          locationId: "loc-1",
        },
      },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        variantId: SHARED_EXTERNAL_ID,
        locationId: "loc-1",
        lookbackStart: new Date("2026-02-01"),
        lookbackEnd: new Date("2026-02-28"),
      },
      update: { lookbackEnd: new Date("2026-03-01") },
      delegate: () => dbA().forecastOverride,
      rawCount: () => prisma.forecastOverride.count(),
    },
  ];

  for (const model of compoundModels) {
    it(`${model.name} tab-padded null-owned row resolves without duplicate`, async () => {
      const seeded = await model.seed(`\t${SHOP_A_DOMAIN}`);
      const d = model.delegate();

      const found = await d.findUnique({ where: model.where });
      expect(found?.id).toBe(seeded.id);

      await d.findUniqueOrThrow({ where: model.where });

      const updated = await d.update({
        where: model.where,
        data: model.update,
      });
      expect(updated.id).toBe(seeded.id);

      const before = await model.rawCount();
      const upserted = await d.upsert({
        where: model.where,
        create: { ...model.create, shopId: shopAId },
        update: model.update,
      });
      expect(upserted.id).toBe(seeded.id);
      expect(await model.rawCount()).toBe(before);

      await d.delete({ where: model.where });
      expect(await model.rawCount()).toBe(0);
    });
  }

  it("ambiguous null-owned normalized duplicates fail closed", async () => {
    await prisma.shopSettings.create({
      data: {
        shop: `\t${SHOP_A_DOMAIN}`,
        shopId: null,
        defaultSafetyStock: 1,
      },
    });
    await prisma.shopSettings.create({
      data: {
        shop: ` ${SHOP_A_DOMAIN}`,
        shopId: null,
        defaultSafetyStock: 2,
      },
    });
    const before = await prisma.shopSettings.findMany({
      orderBy: { id: "asc" },
    });

    await expect(
      dbA().shopSettings.findUnique({ where: { shop: SHOP_A_DOMAIN } }),
    ).rejects.toMatchObject({ code: "ambiguous_legacy_unique_selector" });

    await expect(
      dbA().shopSettings.update({
        where: { shop: SHOP_A_DOMAIN },
        data: { defaultSafetyStock: 99 },
      }),
    ).rejects.toMatchObject({ code: "ambiguous_legacy_unique_selector" });

    await expect(
      dbA().shopSettings.delete({ where: { shop: SHOP_A_DOMAIN } }),
    ).rejects.toMatchObject({ code: "ambiguous_legacy_unique_selector" });

    await expect(
      dbA().shopSettings.upsert({
        where: { shop: SHOP_A_DOMAIN },
        create: { shop: SHOP_A_DOMAIN, shopId: shopAId },
        update: { defaultSafetyStock: 99 },
      }),
    ).rejects.toMatchObject({ code: "ambiguous_legacy_unique_selector" });

    const after = await prisma.shopSettings.findMany({ orderBy: { id: "asc" } });
    expect(after).toEqual(before);
  });

  it("after-auth ShopSettings preserves legacy null-owned settings singleton", async () => {
    await prisma.shopSettings.create({
      data: {
        shop: `\t${SHOP_A_DOMAIN.toUpperCase()} `,
        shopId: null,
        defaultSafetyStock: 42,
        defaultLookbackDays: 60,
        targetDaysOfStock: 18,
        subscriptionPlan: "pilot",
        subscriptionActive: true,
      },
    });

    // Minimal Session-shaped object for after-auth bootstrap.
    const result = await runAfterAuthTenantBootstrap({
      shop: SHOP_A_DOMAIN,
    } as never);

    expect(result.myshopifyDomain).toBe(SHOP_A_DOMAIN);
    const rows = await prisma.shopSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.defaultSafetyStock).toBe(42);
    expect(rows[0]!.defaultLookbackDays).toBe(60);
    expect(rows[0]!.targetDaysOfStock).toBe(18);
    expect(rows[0]!.subscriptionPlan).toBe("pilot");
    expect(rows[0]!.subscriptionActive).toBe(true);

    const visible = await dbA().shopSettings.findUnique({
      where: { shop: SHOP_A_DOMAIN },
    });
    expect(visible?.id).toBe(rows[0]!.id);
    expect(visible?.defaultSafetyStock).toBe(42);

    // Foreign shop settings untouched.
    void shopBId;
  });

  it("upsert create branch only when no owned compatible row exists", async () => {
    const created = await dbA().shopSettings.upsert({
      where: { shop: SHOP_A_DOMAIN },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        defaultSafetyStock: 7,
      },
      update: { defaultSafetyStock: 8 },
    });
    expect(created.defaultSafetyStock).toBe(7);
    expect(await prisma.shopSettings.count()).toBe(1);

    const again = await dbA().shopSettings.upsert({
      where: { shop: SHOP_A_DOMAIN },
      create: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        defaultSafetyStock: 0,
      },
      update: { defaultSafetyStock: 9 },
    });
    expect(again.id).toBe(created.id);
    expect(again.defaultSafetyStock).toBe(9);
    expect(await prisma.shopSettings.count()).toBe(1);
  });

  it("foreign shop selector still rejected", async () => {
    await prisma.shopSettings.create({
      data: { shop: `\t${SHOP_B_DOMAIN}`, shopId: null, defaultSafetyStock: 1 },
    });
    await expect(
      dbA().shopSettings.findUnique({ where: { shop: SHOP_B_DOMAIN } }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });
    expect(await prisma.shopSettings.count()).toBe(1);
  });
});
