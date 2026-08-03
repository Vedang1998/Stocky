import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  deleteSessionsForShop,
  enumerateCanonicalShopsForScheduler,
  getMerchantDelegate,
  resolveCanonicalShopByDomain,
  shopifySessionStorage,
  upsertCanonicalShop,
} from "../bootstrap.server";
import { TenantAccessError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("bootstrap boundary (PR 2)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.shop.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("can upsert and resolve canonical Shop", async () => {
    const created = await upsertCanonicalShop(SHOP_A_DOMAIN);
    expect(created.myshopifyDomain).toBe(SHOP_A_DOMAIN);
    const resolved = await resolveCanonicalShopByDomain(SHOP_A_DOMAIN);
    expect(resolved?.id).toBe(created.id);
  });

  it("can access Session via bootstrap helpers / session storage object", async () => {
    expect(shopifySessionStorage).toBeTruthy();
    await prisma.session.create({
      data: {
        id: "offline_shop_a",
        shop: SHOP_A_DOMAIN,
        state: "x",
        isOnline: false,
        accessToken: "token",
      },
    });
    const count = await deleteSessionsForShop(SHOP_A_DOMAIN);
    expect(count).toBe(1);
  });

  it("enumerates canonical Shops for scheduler without merchant data", async () => {
    await upsertCanonicalShop(SHOP_A_DOMAIN);
    await upsertCanonicalShop(SHOP_B_DOMAIN);
    const shops = await enumerateCanonicalShopsForScheduler();
    expect(shops.map((s) => s.myshopifyDomain).sort()).toEqual([
      SHOP_A_DOMAIN,
      SHOP_B_DOMAIN,
    ]);
  });

  it("cannot expose merchant delegates", () => {
    expect(() => getMerchantDelegate()).toThrow(TenantAccessError);
  });
});
