import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  issueTenantAuthority,
  isTenantAuthority,
  rejectRawAuthorityConstruction,
} from "../authority.server";
import { requireAdminTenant } from "../require-admin-tenant.server";
import { TenantAuthorityError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

function adminAuth(shop: string) {
  return async () =>
    ({
      admin: {} as never,
      session: { shop } as never,
    }) as never;
}

describe("tenant authority (PR 2)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.shopSettings.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    await prisma.shopSettings.createMany({
      data: [
        { shop: SHOP_A_DOMAIN, shopId: shopAId },
        { shop: SHOP_B_DOMAIN, shopId: shopBId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("verified Shop A resolves to Shop A authority", async () => {
    const ctx = await requireAdminTenant({
      request: new Request("https://example.com/app"),
      authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
    expect(ctx.tenant.myshopifyDomain).toBe(SHOP_A_DOMAIN);
    expect(ctx.tenant.source).toBe("verified_admin_request");
    expect(isTenantAuthority(ctx.tenant)).toBe(true);
  });

  it("malformed authenticated domain fails closed", async () => {
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app"),
        authenticateAdmin: adminAuth("https://evil.myshopify.com"),
      }),
    ).rejects.toBeInstanceOf(TenantAuthorityError);
  });

  it("authenticated domain with no canonical Shop fails closed", async () => {
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app"),
        authenticateAdmin: adminAuth("missing-shop.myshopify.com"),
      }),
    ).rejects.toMatchObject({ code: "canonical_shop_missing" });
  });

  it("denies client query shop=ShopB", async () => {
    await expect(
      requireAdminTenant({
        request: new Request(`https://example.com/app?shop=${SHOP_B_DOMAIN}`),
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("denies client header shop=ShopB", async () => {
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app", {
          headers: { shop: SHOP_B_DOMAIN },
        }),
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("denies JSON shopId=ShopB", async () => {
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shopId: shopBId }),
        }),
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("denies form shop=ShopB", async () => {
    await expect(
      requireAdminTenant({
        request: new Request("https://example.com/app", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `shop=${encodeURIComponent(SHOP_B_DOMAIN)}`,
        }),
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("matching client domain does not establish authority by itself", async () => {
    const ctx = await requireAdminTenant({
      request: new Request(`https://example.com/app?shop=${SHOP_A_DOMAIN}`),
      authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
    expect(isTenantAuthority({ shopId: shopAId } as never)).toBe(false);
  });

  it("raw domain string cannot construct branded authority", () => {
    expect(() => rejectRawAuthorityConstruction(SHOP_A_DOMAIN)).toThrow(
      TenantAuthorityError,
    );
    expect(isTenantAuthority({ shopId: "x", myshopifyDomain: SHOP_A_DOMAIN })).toBe(
      false,
    );
  });

  it("raw shopId cannot construct branded authority", () => {
    expect(() => rejectRawAuthorityConstruction(shopAId)).toThrow(
      TenantAuthorityError,
    );
    expect(
      isTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
        correlationId: "x",
      }),
    ).toBe(false);
  });

  it("issueTenantAuthority brands only via approved issuer", () => {
    const a = issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_admin_request",
    });
    expect(isTenantAuthority(a)).toBe(true);
    expect(isTenantAuthority({ ...a })).toBe(false);
  });
});
