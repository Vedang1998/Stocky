import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { requireAdminTenant } from "../require-admin-tenant.server";
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

describe("client shop-hint conflict detection (C-06)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function expectConflict(request: Request, params?: Record<string, string>) {
    await expect(
      requireAdminTenant({
        request,
        params,
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  }

  it("denies first query value shop=B", async () => {
    await expectConflict(
      new Request(`https://example.com/app?shop=${SHOP_B_DOMAIN}`),
    );
  });

  it("denies duplicate query value shop=A&shop=B", async () => {
    await expectConflict(
      new Request(
        `https://example.com/app?shop=${SHOP_A_DOMAIN}&shop=${SHOP_B_DOMAIN}`,
      ),
    );
  });

  it("denies recognized header", async () => {
    await expectConflict(
      new Request("https://example.com/app", {
        headers: { "x-shopify-shop-domain": SHOP_B_DOMAIN },
      }),
    );
  });

  it("denies top-level JSON", async () => {
    await expectConflict(
      new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shop: SHOP_B_DOMAIN }),
      }),
    );
  });

  it("denies nested JSON", async () => {
    await expectConflict(
      new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meta: { shopId: shopBId } }),
      }),
    );
  });

  it("denies JSON array", async () => {
    await expectConflict(
      new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([{ shop: SHOP_B_DOMAIN }]),
      }),
    );
  });

  it("denies top-level form field", async () => {
    await expectConflict(
      new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `shop=${encodeURIComponent(SHOP_B_DOMAIN)}`,
      }),
    );
  });

  it("denies nested form-style key", async () => {
    await expectConflict(
      new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `filter[shop]=${encodeURIComponent(SHOP_B_DOMAIN)}`,
      }),
    );
  });

  it("denies multipart form shop field", async () => {
    const body = [
      "--boundary",
      'Content-Disposition: form-data; name="shop"',
      "",
      SHOP_B_DOMAIN,
      "--boundary--",
      "",
    ].join("\r\n");
    await expectConflict(
      new Request("https://example.com/app", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=boundary",
        },
        body,
      }),
    );
  });

  it("denies route parameter shop", async () => {
    await expectConflict(new Request("https://example.com/app"), {
      shop: SHOP_B_DOMAIN,
    });
  });

  it("matching hints are ignored and never create authority", async () => {
    const ctx = await requireAdminTenant({
      request: new Request(
        `https://example.com/app?shop=${SHOP_A_DOMAIN}&shopId=${shopAId}`,
      ),
      authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
    expect(ctx.tenant.source).toBe("verified_admin_request");
  });

  describe("NUL characters (SEC-17)", () => {
    async function refusedStatus(request: Request): Promise<number | null> {
      const thrown: unknown = await requireAdminTenant({
        request,
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      }).then(
        () => null,
        (reason: unknown) => reason,
      );
      return thrown instanceof Response ? thrown.status : null;
    }

    it("answers 400 for a NUL in the query or in a route id", async () => {
      expect(
        await refusedStatus(new Request("https://example.com/app/suppliers?q=a%00b")),
      ).toBe(400);
      expect(
        await refusedStatus(new Request("https://example.com/app/suppliers/sup_1%00")),
      ).toBe(400);
    });

    it("answers 400 for a NUL in a form field", async () => {
      expect(
        await refusedStatus(
          new Request("https://example.com/app/suppliers/new", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "name=Acme%00&currency=USD",
          }),
        ),
      ).toBe(400);
    });

    it("still issues authority for ordinary text", async () => {
      const ctx = await requireAdminTenant({
        request: new Request("https://example.com/app/suppliers/new", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "name=Caf%C3%A9+100%2500&currency=USD",
        }),
        authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
      });
      expect(ctx.tenant.shopId).toBe(shopAId);
    });
  });
});
