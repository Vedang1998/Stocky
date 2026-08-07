/**
 * F-PR2R2-01 — top-level unique-selector normalization for every
 * MODEL_UNIQUE_SELECTORS entry and live compound call-site shapes.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { TenantAccessError } from "../errors";
import { MODEL_UNIQUE_SELECTORS } from "../selectors";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  SHARED_EXTERNAL_ID,
} from "./helpers";

describe("tenant top-level unique-selector tests (F-PR2R2-01)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.leadTimeSnapshot.deleteMany();
    await prisma.supplierSkuMapping.deleteMany();
    await prisma.volumePriceTier.deleteMany();
    await prisma.pOLineItem.deleteMany();
    await prisma.transferLineItem.deleteMany();
    await prisma.stocktakeLineItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.transferOrder.deleteMany();
    await prisma.stocktake.deleteMany();
    await prisma.bomComponent.deleteMany();
    await prisma.forecastOverride.deleteMany();
    await prisma.variantAbcClass.deleteMany();
    await prisma.salesDailyAggregate.deleteMany();
    await prisma.inventorySnapshot.deleteMany();
    await prisma.shopifyVariantCache.deleteMany();
    await prisma.lowStockAlert.deleteMany();
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

  it("MODEL_UNIQUE_SELECTORS enumerates every merchant model", () => {
    expect(Object.keys(MODEL_UNIQUE_SELECTORS).sort()).toEqual(
      [
        "BomComponent",
        "ForecastOverride",
        "InventorySnapshot",
        "LeadTimeSnapshot",
        "LowStockAlert",
        "POLineItem",
        "PurchaseOrder",
        "SalesDailyAggregate",
        "ShopSettings",
        "ShopifyVariantCache",
        "Stocktake",
        "StocktakeLineItem",
        "Supplier",
        "SupplierSkuMapping",
        "SyncApplicationReceipt",
        "TransferLineItem",
        "TransferOrder",
        "VariantAbcClass",
        "VolumePriceTier",
      ].sort(),
    );
  });

  it("shopifyVariantCache compound shop_shopifyVariantId findUnique/update/delete", async () => {
    const owned = await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        title: "A",
      },
    });
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        shopifyVariantId: "gid://shopify/ProductVariant/only-b",
        title: "B",
      },
    });

    const found = await dbA().shopifyVariantCache.findUnique({
      where: {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
    });
    expect(found?.id).toBe(owned.id);

    // Foreign shop in a unique selector is rejected (F-PR2R3-02) — never
    // coerced onto the authenticated tenant.
    await expect(
      dbA().shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop: SHOP_B_DOMAIN,
            shopifyVariantId: "gid://shopify/ProductVariant/only-b",
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    const updated = await dbA().shopifyVariantCache.update({
      where: {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
      data: { title: "A2" },
    });
    expect(updated.title).toBe("A2");

    await dbA().shopifyVariantCache.delete({
      where: {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
    });
    expect(
      await prisma.shopifyVariantCache.findUnique({ where: { id: owned.id } }),
    ).toBeNull();
  });

  it("transfer/stocktake/supplier shopId_id and supplierSkuMapping compound", async () => {
    const transfer = await prisma.transferOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        sourceLocationId: "a",
        destinationLocationId: "b",
      },
    });
    const stocktake = await prisma.stocktake.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        locationId: "loc",
        name: "Count",
      },
    });
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "Sup" },
    });
    const mapping = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplier.id,
        shopifyVariantId: SHARED_EXTERNAL_ID,
        vendorSku: "SKU-1",
      },
    });

    expect(
      (
        await dbA().transferOrder.findUnique({
          where: { shopId_id: { shopId: shopAId, id: transfer.id } },
        })
      )?.id,
    ).toBe(transfer.id);

    expect(
      (
        await dbA().stocktake.findUnique({
          where: { shopId_id: { shopId: shopAId, id: stocktake.id } },
        })
      )?.id,
    ).toBe(stocktake.id);

    const mapRow = await dbA().supplierSkuMapping.findUnique({
      where: {
        supplierId_shopifyVariantId: {
          supplierId: supplier.id,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
    });
    expect(mapRow?.id).toBe(mapping.id);

    await dbA().supplierSkuMapping.update({
      where: {
        supplierId_shopifyVariantId: {
          supplierId: supplier.id,
          shopifyVariantId: SHARED_EXTERNAL_ID,
        },
      },
      data: { vendorSku: "SKU-2" },
    });
    expect(
      (await prisma.supplierSkuMapping.findUnique({ where: { id: mapping.id } }))
        ?.vendorSku,
    ).toBe("SKU-2");
  });

  it("forecast/abc/sales/bom compound selectors resolve owned rows", async () => {
    const day = new Date("2026-01-15T00:00:00.000Z");
    const forecast = await prisma.forecastOverride.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        variantId: "v1",
        locationId: "loc",
        lookbackStart: day,
        lookbackEnd: day,
      },
    });
    const abc = await prisma.variantAbcClass.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: "v1",
        locationId: "loc",
        metric: "REVENUE",
        abcClass: "A",
      },
    });
    const sales = await prisma.salesDailyAggregate.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        shopifyVariantId: "v1",
        locationId: "loc",
        date: day,
        unitsSold: 2,
      },
    });
    const bom = await prisma.bomComponent.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        bundleVariantId: "bundle",
        componentVariantId: "comp",
        quantity: 2,
      },
    });

    expect(
      (
        await dbA().forecastOverride.findUnique({
          where: {
            shop_variantId_locationId: {
              shop: SHOP_A_DOMAIN,
              variantId: "v1",
              locationId: "loc",
            },
          },
        })
      )?.id,
    ).toBe(forecast.id);

    expect(
      (
        await dbA().variantAbcClass.findUnique({
          where: {
            shop_shopifyVariantId_locationId_metric: {
              shop: SHOP_A_DOMAIN,
              shopifyVariantId: "v1",
              locationId: "loc",
              metric: "REVENUE",
            },
          },
        })
      )?.id,
    ).toBe(abc.id);

    expect(
      (
        await dbA().salesDailyAggregate.findUnique({
          where: {
            shop_shopifyVariantId_locationId_date: {
              shop: SHOP_A_DOMAIN,
              shopifyVariantId: "v1",
              locationId: "loc",
              date: day,
            },
          },
        })
      )?.id,
    ).toBe(sales.id);

    expect(
      (
        await dbA().bomComponent.findUnique({
          where: {
            shop_bundleVariantId_componentVariantId: {
              shop: SHOP_A_DOMAIN,
              bundleVariantId: "bundle",
              componentVariantId: "comp",
            },
          },
        })
      )?.id,
    ).toBe(bom.id);
  });

  it("rejects malformed / unsupported / extra / missing compound fields", async () => {
    await expect(
      dbA().supplier.findUnique({ where: { id: 123 as never } }),
    ).rejects.toBeInstanceOf(TenantAccessError);

    await expect(
      dbA().supplier.findUnique({
        where: { shopId_id: { shopId: shopAId } as never },
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });

    await expect(
      dbA().supplier.findUnique({
        where: {
          shopId_id: { shopId: shopAId, id: "x", extra: "y" } as never,
        },
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });

    await expect(
      dbA().supplier.findUnique({
        where: { notASelector: "x" } as never,
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });

    await expect(
      dbA().supplier.findUnique({
        where: { id: "a", shopId: shopAId } as never,
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });
  });

  it("null-owned same-tenant compound row remains resolvable by id", async () => {
    const supplier = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: null, name: "null-owned" },
    });
    const found = await dbA().supplier.findUnique({
      where: { id: supplier.id },
    });
    expect(found?.name).toBe("null-owned");
  });

  it("upsert with compound tenant-bearing selector still works", async () => {
    const row = await dbA().shopifyVariantCache.upsert({
      where: {
        shop_shopifyVariantId: {
          shop: SHOP_A_DOMAIN,
          shopifyVariantId: "gid://v/upsert",
        },
      },
      create: {
        shopifyVariantId: "gid://v/upsert",
        title: "created",
      },
      update: { title: "updated" },
    });
    expect(row.title).toBe("created");
    expect(row.shopId).toBe(shopAId);
  });
});
