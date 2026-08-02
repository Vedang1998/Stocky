/**
 * F-PR2C-01 / F-PR2C-02 / F-PR2C-03 — nested selector authorization,
 * connectOrCreate foreign-match fail-closed, and array-form nested mutations.
 */

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
} from "./helpers";

describe("tenant nested selector authorization (F-PR2C-01/02/03)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.leadTimeSnapshot.deleteMany();
    await prisma.stocktakeLineItem.deleteMany();
    await prisma.transferLineItem.deleteMany();
    await prisma.pOLineItem.deleteMany();
    await prisma.supplierSkuMapping.deleteMany();
    await prisma.volumePriceTier.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.transferOrder.deleteMany();
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

  async function seedForeignGraph() {
    const supplierB = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B-sup" },
    });
    const mappingB = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplierB.id,
        shopifyVariantId: "gid://v/777",
        vendorSku: "b-sku",
      },
    });
    const poB = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: supplierB.id,
        locationId: "loc-b",
      },
    });
    const snapshotB = await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopBId,
        supplierId: supplierB.id,
        purchaseOrderId: poB.id,
        leadTimeDays: 9,
      },
    });
    const transferB = await prisma.transferOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        sourceLocationId: "s",
        destinationLocationId: "d",
      },
    });
    const stocktakeB = await prisma.stocktake.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        locationId: "loc-b",
        name: "B-count",
      },
    });
    return {
      supplierB,
      mappingB,
      poB,
      snapshotB,
      transferB,
      stocktakeB,
    };
  }

  it("blocks stealing foreign SKU mapping via supplierId_shopifyVariantId", async () => {
    const { mappingB, supplierB } = await seedForeignGraph();
    await expect(
      dbA().supplier.create({
        data: {
          name: "A-new",
          skuMappings: {
            connect: {
              supplierId_shopifyVariantId: {
                supplierId: supplierB.id,
                shopifyVariantId: "gid://v/777",
              },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });

    const victim = await prisma.supplierSkuMapping.findUnique({
      where: { id: mappingB.id },
    });
    expect(victim?.supplierId).toBe(supplierB.id);
    expect(victim?.shopId).toBe(shopBId);
  });

  it("blocks attaching Shop A PO to Shop B supplier via shopId_id", async () => {
    const { supplierB } = await seedForeignGraph();
    await expect(
      dbA().purchaseOrder.create({
        data: {
          locationId: "loc-1",
          supplier: {
            connect: {
              shopId_id: { shopId: shopBId, id: supplierB.id },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    const stillB = await prisma.supplier.findUnique({
      where: { id: supplierB.id },
    });
    expect(stillB?.shopId).toBe(shopBId);
  });

  it("blocks injecting a line into Shop B transfer via shopId_id", async () => {
    const { transferB } = await seedForeignGraph();
    await expect(
      dbA().transferLineItem.create({
        data: {
          shopifyVariantId: "gid://v/1",
          quantity: 5,
          transferOrder: {
            connect: {
              shopId_id: { shopId: shopBId, id: transferB.id },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    const lines = await prisma.transferLineItem.count({
      where: { transferOrderId: transferB.id },
    });
    expect(lines).toBe(0);
  });

  it("blocks injecting a line into Shop B stocktake via shopId_id", async () => {
    const { stocktakeB } = await seedForeignGraph();
    await expect(
      dbA().stocktakeLineItem.create({
        data: {
          shopifyVariantId: "gid://v/1",
          expectedQty: 3,
          stocktake: {
            connect: {
              shopId_id: { shopId: shopBId, id: stocktakeB.id },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_selector_tenant" });

    const lines = await prisma.stocktakeLineItem.count({
      where: { stocktakeId: stocktakeB.id },
    });
    expect(lines).toBe(0);
  });

  it("allows own target by id and by shopId_id", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const mapping = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://own",
        vendorSku: "o",
      },
    });

    const byId = await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        skuMappings: { connect: { id: mapping.id } },
      },
      include: { skuMappings: true },
    });
    expect(byId.skuMappings.some((m: { id: string }) => m.id === mapping.id)).toBe(
      true,
    );

    const supplierA2 = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A2" },
    });
    const po = await dbA().purchaseOrder.create({
      data: {
        locationId: "loc-1",
        supplier: {
          connect: { shopId_id: { shopId: shopAId, id: supplierA2.id } },
        },
      },
    });
    expect(po.supplierId).toBe(supplierA2.id);
    expect(po.shopId).toBe(shopAId);
  });

  it("rejects empty, malformed, and unsupported selectors", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: { skuMappings: { connect: {} } },
      }),
    ).rejects.toBeInstanceOf(TenantAccessError);

    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            connect: { notARealUnique: "x" } as never,
          },
        },
      }),
    ).rejects.toMatchObject({ code: "unsupported_relation_selector" });
  });

  it("blocks LeadTimeSnapshot.purchaseOrderId connectOrCreate foreign match", async () => {
    const { poB, snapshotB, supplierB } = await seedForeignGraph();
    const beforeSupplierId = snapshotB.supplierId;

    await expect(
      dbA().supplier.create({
        data: {
          name: "A-coc",
          leadTimeSnapshots: {
            connectOrCreate: {
              where: { purchaseOrderId: poB.id },
              create: {
                purchaseOrderId: (
                  await prisma.purchaseOrder.create({
                    data: {
                      shop: SHOP_A_DOMAIN,
                      shopId: shopAId,
                      supplierId: (
                        await prisma.supplier.create({
                          data: {
                            shop: SHOP_A_DOMAIN,
                            shopId: shopAId,
                            name: "A-for-po",
                          },
                        })
                      ).id,
                      locationId: "loc-a",
                    },
                  })
                ).id,
                leadTimeDays: 1,
              },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });

    const victim = await prisma.leadTimeSnapshot.findUnique({
      where: { id: snapshotB.id },
    });
    expect(victim?.supplierId).toBe(beforeSupplierId);
    expect(victim?.supplierId).toBe(supplierB.id);
  });

  it("connectOrCreate creates when no global row exists", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const poA = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplierA.id,
        locationId: "loc-a",
      },
    });

    const row = await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        leadTimeSnapshots: {
          connectOrCreate: {
            where: { purchaseOrderId: poA.id },
            create: {
              purchaseOrderId: poA.id,
              leadTimeDays: 4,
            },
          },
        },
      },
      include: { leadTimeSnapshots: true },
    });
    expect(row.leadTimeSnapshots).toHaveLength(1);
    expect(row.leadTimeSnapshots[0].shopId).toBe(shopAId);
    expect(row.leadTimeSnapshots[0].purchaseOrderId).toBe(poA.id);
  });

  it("connectOrCreate connects when own row exists", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const poA = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_A_DOMAIN,
        shopId: shopAId,
        supplierId: supplierA.id,
        locationId: "loc-a",
      },
    });
    const snap = await prisma.leadTimeSnapshot.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        purchaseOrderId: poA.id,
        leadTimeDays: 2,
      },
    });

    const row = await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        leadTimeSnapshots: {
          connectOrCreate: {
            where: { purchaseOrderId: poA.id },
            create: {
              purchaseOrderId: poA.id,
              leadTimeDays: 99,
            },
          },
        },
      },
      include: { leadTimeSnapshots: true },
    });
    expect(row.leadTimeSnapshots).toHaveLength(1);
    expect(row.leadTimeSnapshots[0].id).toBe(snap.id);
    expect(row.leadTimeSnapshots[0].leadTimeDays).toBe(2);
  });

  it("array-form updateMany scopes and rejects shopId mutation", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const childA = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://a1",
        vendorSku: "a1",
      },
    });
    const childB = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplier: {
          create: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
        },
        shopifyVariantId: "gid://b1",
        vendorSku: "b1",
      },
    });

    await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        skuMappings: {
          updateMany: [
            {
              where: { vendorSku: "a1" },
              data: { vendorSku: "a1-updated" },
            },
          ],
        },
      },
    });
    const updatedA = await prisma.supplierSkuMapping.findUnique({
      where: { id: childA.id },
    });
    expect(updatedA?.vendorSku).toBe("a1-updated");

    const foreignBefore = await prisma.supplierSkuMapping.findUnique({
      where: { id: childB.id },
    });
    await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        skuMappings: {
          updateMany: [
            {
              where: { id: childB.id },
              data: { vendorSku: "hacked" },
            },
          ],
        },
      },
    });
    const foreignAfter = await prisma.supplierSkuMapping.findUnique({
      where: { id: childB.id },
    });
    expect(foreignAfter?.vendorSku).toBe(foreignBefore?.vendorSku);

    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            updateMany: [
              {
                where: { vendorSku: "a1-updated" },
                data: { shopId: shopBId },
              },
            ],
          },
        },
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof TenantAccessError &&
        (err.code === "shop_id_immutable" || err.code === "foreign_shop_id"),
    );
  });

  it("array-form deleteMany scopes foreign rows out", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const childA = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://del-a",
        vendorSku: "da",
      },
    });
    // Foreign child incorrectly parented under A (adversarial seed)
    const childForeign = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopBId,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://del-b",
        vendorSku: "db",
      },
    });

    await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        skuMappings: {
          deleteMany: [{ where: { vendorSku: { in: ["da", "db"] } } }],
        },
      },
    });

    expect(
      await prisma.supplierSkuMapping.findUnique({ where: { id: childA.id } }),
    ).toBeNull();
    expect(
      await prisma.supplierSkuMapping.findUnique({
        where: { id: childForeign.id },
      }),
    ).not.toBeNull();
  });

  it("mixed own/foreign connect array fails closed with no partial mutation", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const own = await prisma.supplierSkuMapping.create({
      data: {
        shopId: shopAId,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://mix-a",
        vendorSku: "ma",
      },
    });
    const { mappingB, supplierB } = await seedForeignGraph();

    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            set: [
              { id: own.id },
              {
                supplierId_shopifyVariantId: {
                  supplierId: supplierB.id,
                  shopifyVariantId: "gid://v/777",
                },
              },
            ],
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });

    const victim = await prisma.supplierSkuMapping.findUnique({
      where: { id: mappingB.id },
    });
    expect(victim?.supplierId).toBe(supplierB.id);
  });

  it("null-owned same-tenant child can be targeted; foreign lineage cannot", async () => {
    const supplierA = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
    });
    const nullOwned = await prisma.supplierSkuMapping.create({
      data: {
        shopId: null,
        supplierId: supplierA.id,
        shopifyVariantId: "gid://null-a",
        vendorSku: "na",
      },
    });
    const supplierB = await prisma.supplier.create({
      data: { shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
    });
    const nullForeign = await prisma.supplierSkuMapping.create({
      data: {
        shopId: null,
        supplierId: supplierB.id,
        shopifyVariantId: "gid://null-b",
        vendorSku: "nb",
      },
    });

    await dbA().supplier.update({
      where: { id: supplierA.id },
      data: {
        skuMappings: {
          update: {
            where: { id: nullOwned.id },
            data: { vendorSku: "na2" },
          },
        },
      },
    });
    expect(
      (await prisma.supplierSkuMapping.findUnique({ where: { id: nullOwned.id } }))
        ?.vendorSku,
    ).toBe("na2");

    await expect(
      dbA().supplier.update({
        where: { id: supplierA.id },
        data: {
          skuMappings: {
            connect: { id: nullForeign.id },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "foreign_relation_target" });
  });
});
