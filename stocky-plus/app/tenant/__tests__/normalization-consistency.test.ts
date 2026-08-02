/**
 * F-PR2R2-05 / D-030 — one ownership decision across every operation family.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import { rowOwnershipOk } from "../legacy-scope";
import { createTenantDb } from "../tenant-db.server";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

type Shape = {
  label: string;
  shopId: string | null;
  shop: string;
  /** Under D-030: owned by tenant A? */
  owned: boolean;
};

describe("tenant normalization consistency tests (F-PR2R2-05 / D-030)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let authority: ReturnType<typeof issueTenantAuthority>;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.pOLineItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    authority = issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_admin_request",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function dbA() {
    return createTenantDb(authority);
  }

  function shapes(): Shape[] {
    return [
      { label: "canonical", shopId: shopAId, shop: SHOP_A_DOMAIN, owned: true },
      {
        label: "uppercase",
        shopId: shopAId,
        shop: SHOP_A_DOMAIN.toUpperCase(),
        owned: true,
      },
      {
        label: "leading-ws",
        shopId: shopAId,
        shop: ` ${SHOP_A_DOMAIN}`,
        owned: true,
      },
      {
        label: "trailing-ws",
        shopId: shopAId,
        shop: `${SHOP_A_DOMAIN} `,
        owned: true,
      },
      {
        label: "surrounding-ws",
        shopId: shopAId,
        shop: `  ${SHOP_A_DOMAIN}  `,
        owned: true,
      },
      {
        label: "foreign-valid-domain",
        shopId: shopAId,
        shop: SHOP_B_DOMAIN,
        owned: true, // D-030: canonical shopId authoritative
      },
      { label: "malformed", shopId: shopAId, shop: "not-a-shop", owned: true },
      { label: "empty", shopId: shopAId, shop: "", owned: true },
      {
        label: "url-form",
        shopId: shopAId,
        shop: `https://${SHOP_A_DOMAIN}`,
        owned: true,
      },
      {
        label: "path-form",
        shopId: shopAId,
        shop: `${SHOP_A_DOMAIN}/admin`,
        owned: true,
      },
      {
        label: "non-shopify-host",
        shopId: shopAId,
        shop: "example.com",
        owned: true,
      },
      {
        label: "substring",
        shopId: shopAId,
        shop: `prefix-${SHOP_A_DOMAIN}`,
        owned: true,
      },
      {
        label: "subdomain-like",
        shopId: shopAId,
        shop: `evil.${SHOP_A_DOMAIN}`,
        owned: true,
      },
      {
        label: "hyphen-boundary",
        shopId: shopAId,
        shop: "-evil.myshopify.com",
        owned: true,
      },
      {
        label: "null-canonical",
        shopId: null,
        shop: SHOP_A_DOMAIN,
        owned: true,
      },
      {
        label: "null-uppercase",
        shopId: null,
        shop: SHOP_A_DOMAIN.toUpperCase(),
        owned: true,
      },
      {
        label: "null-ws",
        shopId: null,
        shop: ` ${SHOP_A_DOMAIN} `,
        owned: true,
      },
      {
        label: "null-foreign",
        shopId: null,
        shop: SHOP_B_DOMAIN,
        owned: false,
      },
      { label: "null-malformed", shopId: null, shop: "nope", owned: false },
      { label: "null-empty", shopId: null, shop: "", owned: false },
      {
        label: "null-url",
        shopId: null,
        shop: `https://${SHOP_A_DOMAIN}`,
        owned: false,
      },
      {
        label: "null-path",
        shopId: null,
        shop: `${SHOP_A_DOMAIN}/admin`,
        owned: false,
      },
      {
        label: "foreign-shopId",
        shopId: shopBId,
        shop: SHOP_A_DOMAIN,
        owned: false,
      },
    ];
  }

  it("rowOwnershipOk matches D-030 for every legacy shape", () => {
    for (const shape of shapes()) {
      const ok = rowOwnershipOk(
        "Supplier",
        { id: "x", shopId: shape.shopId, shop: shape.shop },
        authority,
      );
      expect({ label: shape.label, ok }).toEqual({
        label: shape.label,
        ok: shape.owned,
      });
    }
  });

  it("top-level findMany/findUnique/count/updateMany/deleteMany agree with ownership", async () => {
    const seeded: Array<Shape & { id: string }> = [];
    for (const shape of shapes()) {
      const row = await prisma.supplier.create({
        data: {
          shop: shape.shop,
          shopId: shape.shopId,
          name: shape.label,
        },
      });
      seeded.push({ ...shape, id: row.id });
    }

    const visible = await dbA().supplier.findMany({});
    const visibleIds = new Set(visible.map((r: { id: string }) => r.id));
    const visibleNames = new Set(visible.map((r: { name: string }) => r.name));

    for (const row of seeded) {
      const unique = await dbA().supplier.findUnique({ where: { id: row.id } });
      expect({
        label: row.label,
        findMany: visibleIds.has(row.id),
        findUnique: unique != null,
        owned: row.owned,
      }).toEqual({
        label: row.label,
        findMany: row.owned,
        findUnique: row.owned,
        owned: row.owned,
      });
      if (row.owned) expect(visibleNames.has(row.label)).toBe(true);
      else expect(visibleNames.has(row.label)).toBe(false);
    }

    expect(await dbA().supplier.count({})).toBe(
      seeded.filter((s) => s.owned).length,
    );

    // Nested bulk via owned parent must not mutate unowned conflicting rows
    // that are invisible at top level — and must mutate owned ones.
    const parent = await prisma.supplier.create({
      data: { shop: SHOP_A_DOMAIN, shopId: shopAId, name: "bulk-parent" },
    });
    const childOwned = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN, // foreign legacy string
        shopId: shopAId, // D-030 owned
        supplierId: parent.id,
        locationId: "loc",
        notes: "before",
      },
    });
    const childHidden = await prisma.purchaseOrder.create({
      data: {
        shop: SHOP_B_DOMAIN,
        shopId: shopBId,
        supplierId: parent.id,
        locationId: "loc-b",
        notes: "foreign-before",
      },
    });

    await dbA().supplier.update({
      where: { id: parent.id },
      data: {
        purchaseOrders: {
          updateMany: {
            where: {},
            data: { notes: "BULK-TOUCHED" },
          },
        },
      },
    });

    expect(
      (await prisma.purchaseOrder.findUnique({ where: { id: childOwned.id } }))
        ?.notes,
    ).toBe("BULK-TOUCHED");
    expect(
      (await prisma.purchaseOrder.findUnique({ where: { id: childHidden.id } }))
        ?.notes,
    ).toBe("foreign-before");
  });
});
