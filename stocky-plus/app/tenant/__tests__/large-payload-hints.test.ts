/**
 * F-PR2C-08 — large ordinary payloads must not be denied by hint inspection.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { requireAdminTenant } from "../require-admin-tenant.server";
import {
  CLIENT_HINT_MAX_BODY_BYTES,
  CLIENT_HINT_MAX_DEPTH,
  CLIENT_HINT_MAX_NODES,
  denyConflictingClientShop,
} from "../client-shop.server";
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

describe("tenant large-payload client-hint tests (F-PR2C-08)", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("documents product-justified limits", () => {
    expect(CLIENT_HINT_MAX_NODES).toBeGreaterThanOrEqual(5000);
    expect(CLIENT_HINT_MAX_BODY_BYTES).toBe(1_048_576);
    expect(CLIENT_HINT_MAX_DEPTH).toBeGreaterThanOrEqual(6);
  });

  async function postJson(body: unknown) {
    return requireAdminTenant({
      request: new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
    });
  }

  it("allows 201 unrelated nodes with no shop key", async () => {
    const lines = Array.from({ length: 201 }, (_, i) => ({
      variantId: `gid://v/${i}`,
      qty: 1,
      unitCost: "1.00",
    }));
    await expect(postJson({ intent: "create", lines })).resolves.toBeTruthy();
  });

  it("allows 1000 unrelated nodes", async () => {
    const lines = Array.from({ length: 1000 }, (_, i) => ({
      variantId: `gid://v/${i}`,
      qty: 1,
    }));
    await expect(postJson({ intent: "stocktake", lines })).resolves.toBeTruthy();
  });

  it("allows 5000 unrelated nodes within byte limit", async () => {
    const lines = Array.from({ length: 5000 }, (_, i) => ({
      i,
      q: 1,
    }));
    const body = { intent: "bulk", lines };
    expect(JSON.stringify(body).length).toBeLessThan(CLIENT_HINT_MAX_BODY_BYTES);
    await expect(postJson(body)).resolves.toBeTruthy();
  });

  it("denies conflicting hint at the final node of a large body", async () => {
    const lines = Array.from({ length: 400 }, (_, i) => ({
      variantId: `gid://v/${i}`,
      qty: 1,
    }));
    await expect(
      postJson({
        intent: "create",
        lines,
        shop: SHOP_B_DOMAIN,
      }),
    ).rejects.toMatchObject({ code: "client_shop_conflict" });
  });

  it("allows matching hint at the final node of a large body", async () => {
    const lines = Array.from({ length: 400 }, (_, i) => ({
      variantId: `gid://v/${i}`,
      qty: 1,
    }));
    await expect(
      postJson({
        intent: "create",
        lines,
        shop: SHOP_A_DOMAIN,
      }),
    ).resolves.toBeTruthy();
  });

  it("allows recognized shop key with nested business object when no conflicting string", async () => {
    await expect(
      postJson({
        shop: { name: "My Store", plan: "basic" },
        lines: [{ variantId: "gid://v/1", qty: 1 }],
      }),
    ).resolves.toBeTruthy();
  });

  it("denies depth boundary plus one", async () => {
    let nested: Record<string, unknown> = { shop: SHOP_B_DOMAIN };
    for (let i = 0; i < CLIENT_HINT_MAX_DEPTH + 2; i++) {
      nested = { wrap: nested };
    }
    await expect(postJson(nested)).rejects.toMatchObject({
      code: "client_shop_hint_limit",
    });
  });

  it("denies body byte boundary plus one", async () => {
    const padding = "x".repeat(CLIENT_HINT_MAX_BODY_BYTES + 10);
    const request = new Request("https://example.com/app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"pad":"${padding}"}`,
    });
    await expect(
      denyConflictingClientShop(request, {
        id: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
      }),
    ).rejects.toMatchObject({ code: "client_shop_hint_limit" });
  });

  it("ignores malformed JSON without affecting authority", async () => {
    const ctx = await requireAdminTenant({
      request: new Request("https://example.com/app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
      authenticateAdmin: adminAuth(SHOP_A_DOMAIN),
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
  });
});
