/**
 * F-PR2R3-02 — preserve tenant intent on unique selectors.
 * Foreign shop / shopId must never coerce onto the authenticated tenant.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
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

async function snapshotRow(
  prisma: PrismaClient,
  model:
    | "shopifyVariantCache"
    | "forecastOverride"
    | "variantAbcClass"
    | "salesDailyAggregate"
    | "bomComponent"
    | "inventorySnapshot"
    | "shopSettings"
    | "supplier"
    | "purchaseOrder"
    | "transferOrder"
    | "stocktake",
  id: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model].findUnique({ where: { id } });
}

describe("tenant-bearing unique selectors (F-PR2R3-02)", () => {
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
    await prisma.pOLineItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.transferLineItem.deleteMany();
    await prisma.transferOrder.deleteMany();
    await prisma.stocktakeLineItem.deleteMany();
    await prisma.stocktake.deleteMany();
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

  it("shop_shopifyVariantId: current-tenant succeeds; foreign with identical key denied; rows unchanged", async () => {
    const own = await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        sku: "OWN",
        title: "A",
      },
    });
    const foreign = await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        sku: "FOREIGN",
        title: "B",
      },
    });
    const ownBefore = await snapshotRow(prisma, "shopifyVariantCache", own.id);
    const foreignBefore = await snapshotRow(
      prisma,
      "shopifyVariantCache",
      foreign.id,
    );

    const found = await dbA().shopifyVariantCache.findUnique({
      where: {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
    });
    expect(found?.id).toBe(own.id);

    await expect(
      dbA().shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: SHARED_EXTERNAL_ID,
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    await expect(
      dbA().shopifyVariantCache.update({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: SHARED_EXTERNAL_ID,
          },
        },
        data: { sku: "MUTATED" },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    await expect(
      dbA().shopifyVariantCache.delete({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: SHARED_EXTERNAL_ID,
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    await expect(
      dbA().shopifyVariantCache.upsert({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: SHARED_EXTERNAL_ID,
          },
        },
        create: {
          shopifyVariantId: SHARED_EXTERNAL_ID,
          sku: "NEW",
          title: "X",
        },
        update: { sku: "UPSERT" },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    expect(
      await snapshotRow(prisma, "shopifyVariantCache", own.id),
    ).toEqual(ownBefore);
    expect(
      await snapshotRow(prisma, "shopifyVariantCache", foreign.id),
    ).toEqual(foreignBefore);
  });

  it("foreign shop selector with no own equivalent is still denied", async () => {
    const foreign = await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        shopifyVariantId: "gid://only-b",
        sku: "B-ONLY",
        title: "B-only",
      },
    });
    const before = await snapshotRow(prisma, "shopifyVariantCache", foreign.id);

    await expect(
      dbA().shopifyVariantCache.update({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: "gid://only-b",
          },
        },
        data: { sku: "NOPE" },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    expect(
      await snapshotRow(prisma, "shopifyVariantCache", foreign.id),
    ).toEqual(before);
  });

  it("matching normalized legacy domain works; foreign normalized domain denied", async () => {
    const own = await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: "gid://norm",
        sku: "N",
        title: "Norm",
      },
    });

    const found = await dbA().shopifyVariantCache.findUnique({
      where: {
        shop_shopifyVariantId: {
          shop: ` ${SHOP_A_DOMAIN.toUpperCase()} `,
          shopifyVariantId: "gid://norm",
        },
      },
    });
    expect(found?.id).toBe(own.id);

    await expect(
      dbA().shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop: ` ${SHOP_B_DOMAIN.toUpperCase()} `,
            shopifyVariantId: "gid://norm",
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });
  });

  it("malformed tenant component yields stable invalid-selector error", async () => {
    await expect(
      dbA().shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop: "not-a-shop",
            shopifyVariantId: SHARED_EXTERNAL_ID,
          },
        },
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });

    await expect(
      dbA().shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop: "",
            shopifyVariantId: SHARED_EXTERNAL_ID,
          },
        },
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });
  });

  it("shopId_id foreign shopId is rejected; own and foreign rows unchanged", async () => {
    const own = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const foreign = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
    });
    const ownBefore = await snapshotRow(prisma, "supplier", own.id);
    const foreignBefore = await snapshotRow(prisma, "supplier", foreign.id);

    expect(
      (
        await dbA().supplier.findUnique({
          where: { shopId_id: { shopId: shopAId, id: own.id } },
        })
      )?.id,
    ).toBe(own.id);

    await expect(
      dbA().supplier.update({
        where: { shopId_id: { shopId: shopBId, id: foreign.id } },
        data: { name: "MUTATED" },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    await expect(
      dbA().supplier.delete({
        where: { shopId_id: { shopId: shopBId, id: own.id } },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    expect(await snapshotRow(prisma, "supplier", own.id)).toEqual(ownBefore);
    expect(await snapshotRow(prisma, "supplier", foreign.id)).toEqual(
      foreignBefore,
    );
  });

  it("every shop-bearing compound selector rejects foreign tenant", async () => {
    const day = new Date("2026-01-15T00:00:00.000Z");
    const cases: Array<{
      label: string;
      seedOwn: () => Promise<{ id: string }>;
      seedForeign: () => Promise<{ id: string }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      foreignWhere: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delegate: (db: ReturnType<typeof dbA>) => any;
      model:
        | "forecastOverride"
        | "variantAbcClass"
        | "salesDailyAggregate"
        | "bomComponent"
        | "inventorySnapshot"
        | "shopSettings";
    }> = [
      {
        label: "forecastOverride",
        model: "forecastOverride",
        seedOwn: () =>
          prisma.forecastOverride.create({
            data: {
              shop: SHOP_A_DOMAIN,
              shopId: shopAId,
              variantId: "v1",
              locationId: "loc",
              lookbackStart: day,
              lookbackEnd: day,
            },
          }),
        seedForeign: () =>
          prisma.forecastOverride.create({
            data: {
              shop: SHOP_B_DOMAIN,
              shopId: shopBId,
              variantId: "v1",
              locationId: "loc",
              lookbackStart: day,
              lookbackEnd: day,
            },
          }),
        foreignWhere: {
          shop_variantId_locationId: {
            shop: SHOP_B_DOMAIN,
            variantId: "v1",
            locationId: "loc",
          },
        },
        delegate: (db) => db.forecastOverride,
      },
      {
        label: "variantAbcClass",
        model: "variantAbcClass",
        seedOwn: () =>
          prisma.variantAbcClass.create({
            data: {
              shop: SHOP_A_DOMAIN,
              shopId: shopAId,
              shopifyVariantId: "v1",
              locationId: "loc",
              metric: "REVENUE",
              abcClass: "A",
            },
          }),
        seedForeign: () =>
          prisma.variantAbcClass.create({
            data: {
              shop: SHOP_B_DOMAIN,
              shopId: shopBId,
              shopifyVariantId: "v1",
              locationId: "loc",
              metric: "REVENUE",
              abcClass: "B",
            },
          }),
        foreignWhere: {
          shop_shopifyVariantId_locationId_metric: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: "v1",
            locationId: "loc",
            metric: "REVENUE",
          },
        },
        delegate: (db) => db.variantAbcClass,
      },
      {
        label: "salesDailyAggregate",
        model: "salesDailyAggregate",
        seedOwn: () =>
          prisma.salesDailyAggregate.create({
            data: {
              shop: SHOP_A_DOMAIN,
              shopId: shopAId,
              shopifyVariantId: "v1",
              locationId: "loc",
              date: day,
              unitsSold: 1,
            },
          }),
        seedForeign: () =>
          prisma.salesDailyAggregate.create({
            data: {
              shop: SHOP_B_DOMAIN,
              shopId: shopBId,
              shopifyVariantId: "v1",
              locationId: "loc",
              date: day,
              unitsSold: 9,
            },
          }),
        foreignWhere: {
          shop_shopifyVariantId_locationId_date: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: "v1",
            locationId: "loc",
            date: day,
          },
        },
        delegate: (db) => db.salesDailyAggregate,
      },
      {
        label: "bomComponent",
        model: "bomComponent",
        seedOwn: () =>
          prisma.bomComponent.create({
            data: {
              shop: SHOP_A_DOMAIN,
              shopId: shopAId,
              bundleVariantId: "bundle",
              componentVariantId: "comp",
              quantity: 1,
            },
          }),
        seedForeign: () =>
          prisma.bomComponent.create({
            data: {
              shop: SHOP_B_DOMAIN,
              shopId: shopBId,
              bundleVariantId: "bundle",
              componentVariantId: "comp",
              quantity: 9,
            },
          }),
        foreignWhere: {
          shop_bundleVariantId_componentVariantId: {
            shop: SHOP_B_DOMAIN,
            bundleVariantId: "bundle",
            componentVariantId: "comp",
          },
        },
        delegate: (db) => db.bomComponent,
      },
      {
        label: "inventorySnapshot",
        model: "inventorySnapshot",
        seedOwn: () =>
          prisma.inventorySnapshot.create({
            data: {
              shop: SHOP_A_DOMAIN,
              shopId: shopAId,
              shopifyVariantId: "v1",
              locationId: "loc",
              snapshotDate: day,
              quantityAvailable: 1,
            },
          }),
        seedForeign: () =>
          prisma.inventorySnapshot.create({
            data: {
              shop: SHOP_B_DOMAIN,
              shopId: shopBId,
              shopifyVariantId: "v1",
              locationId: "loc",
              snapshotDate: day,
              quantityAvailable: 9,
            },
          }),
        foreignWhere: {
          shop_shopifyVariantId_locationId_snapshotDate: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: "v1",
            locationId: "loc",
            snapshotDate: day,
          },
        },
        delegate: (db) => db.inventorySnapshot,
      },
      {
        label: "shopSettings",
        model: "shopSettings",
        seedOwn: () =>
          prisma.shopSettings.create({
            data: { shop: SHOP_A_DOMAIN, shopId: shopAId },
          }),
        seedForeign: () =>
          prisma.shopSettings.create({
            data: { shop: SHOP_B_DOMAIN, shopId: shopBId },
          }),
        foreignWhere: { shop: SHOP_B_DOMAIN },
        delegate: (db) => db.shopSettings,
      },
    ];

    for (const c of cases) {
      const own = await c.seedOwn();
      const foreign = await c.seedForeign();
      const ownBefore = await snapshotRow(prisma, c.model, own.id);
      const foreignBefore = await snapshotRow(prisma, c.model, foreign.id);

      await expect(
        c.delegate(dbA()).findUnique({ where: c.foreignWhere }),
      ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

      await expect(
        c.delegate(dbA()).update({
          where: c.foreignWhere,
          data: {},
        }),
      ).rejects.toBeInstanceOf(TenantAccessError);

      expect(await snapshotRow(prisma, c.model, own.id)).toEqual(ownBefore);
      expect(await snapshotRow(prisma, c.model, foreign.id)).toEqual(
        foreignBefore,
      );
    }
  });
});
