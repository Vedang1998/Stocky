import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import type { PrismaClient } from "@prisma/client";
import {
  MAX_SEARCH_RESULTS,
  searchLiveVariants,
} from "../../services/barcode-lookup.server";
import { loadSetupGuide } from "../../services/setup-guide.server";
import { issueTenantAuthority } from "../authority.server";
import { createTenantDb } from "../tenant-db.server";
import {
  clearCatalogFacts,
  createPrisma,
  resetPublicSchema,
  seedCatalogVariant,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const { sessionShop } = vi.hoisted(() => ({ sessionShop: { domain: "" } }));

// The Inventory route authenticates through app/shopify.server. Stand in for
// Shopify's session check only; tenant resolution and queries are real.
vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: async () => ({ admin: {}, session: { shop: sessionShop.domain } }),
  },
}));

const { loader } = await import("../../routes/app.inventory");

async function lookupAs(shopDomain: string, search: string) {
  sessionShop.domain = shopDomain;
  const request = new Request(`https://app.example.com/app/inventory${search}`);
  const data = await loader({ request, params: {}, context: {} } as LoaderFunctionArgs);
  return data.lookup;
}

function tenantDb(shopId: string, myshopifyDomain: string) {
  return createTenantDb(
    issueTenantAuthority({ shopId, myshopifyDomain, source: "verified_admin_request" }),
  );
}

describe("admin inventory lookup", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await clearCatalogFacts(prisma);
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("shows only the signed-in shop's stock for a barcode both shops use", async () => {
    const a = await seedCatalogVariant(prisma, shopAId, "1001", "036000291452", {
      available: 3,
    });
    await seedCatalogVariant(prisma, shopBId, "2001", "036000291452", {
      available: 99,
    });

    const lookup = await lookupAs(SHOP_A_DOMAIN, "?q=036000291452");

    expect(lookup).toMatchObject({
      kind: "stock",
      variant: { variantGid: a.variantGid },
      stock: { totals: { available: 3 } },
    });
  });

  it("does not find another shop's products by name, SKU or variant ID", async () => {
    const b = await seedCatalogVariant(prisma, shopBId, "2001", "B-BARCODE", {
      productTitle: "Reserve Bourbon",
      sku: "BOURBON-750",
    });
    await seedCatalogVariant(prisma, shopAId, "1001", "A-BARCODE", {
      productTitle: "House Red",
    });

    expect(await lookupAs(SHOP_A_DOMAIN, "?q=bourbon")).toMatchObject({
      kind: "not_found",
      catalogSynced: true,
    });
    expect(await lookupAs(SHOP_A_DOMAIN, "?q=BOURBON-750")).toMatchObject({
      kind: "not_found",
    });
    expect(
      await lookupAs(
        SHOP_A_DOMAIN,
        `?q=bourbon&variant=${encodeURIComponent(b.variantGid)}`,
      ),
    ).toEqual({ kind: "variant_missing" });

    expect(await lookupAs(SHOP_B_DOMAIN, "?q=bourbon")).toMatchObject({
      kind: "stock",
      variant: { variantGid: b.variantGid },
    });
  });

  it("asks which product is meant when two share a barcode", async () => {
    await seedCatalogVariant(prisma, shopAId, "1001", "0123456789012");
    await seedCatalogVariant(prisma, shopAId, "1002", "0123456789012");

    const lookup = await lookupAs(SHOP_A_DOMAIN, "?q=0123456789012");

    expect(lookup).toMatchObject({
      kind: "choose",
      query: "0123456789012",
      matchedOn: "barcode",
      truncated: false,
    });
    if (lookup.kind !== "choose") throw new Error("expected candidates");
    expect(lookup.candidates.map((c) => c.variantGid)).toEqual([
      "gid://shopify/ProductVariant/1001",
      "gid://shopify/ProductVariant/1002",
    ]);
  });

  it("searches names without regard to case and lists several matches", async () => {
    await seedCatalogVariant(prisma, shopAId, "1001", "A-1", {
      productTitle: "Estate Pinot Noir",
    });
    await seedCatalogVariant(prisma, shopAId, "1002", "A-2", {
      productTitle: "Pinot Grigio",
    });
    await seedCatalogVariant(prisma, shopAId, "1003", "A-3", {
      productTitle: "Dry Riesling",
    });

    const lookup = await lookupAs(SHOP_A_DOMAIN, "?q=PINOT");

    expect(lookup).toMatchObject({ kind: "choose", matchedOn: "text", truncated: false });
    if (lookup.kind !== "choose") throw new Error("expected candidates");
    expect(lookup.candidates.map((c) => c.displayName)).toEqual([
      "Estate Pinot Noir",
      "Pinot Grigio",
    ]);
  });

  it("matches % and _ in a search literally", async () => {
    await seedCatalogVariant(prisma, shopAId, "1001", "A-1", {
      productTitle: "100% Agave Tequila",
    });
    await seedCatalogVariant(prisma, shopAId, "1002", "A-2", {
      productTitle: "1000 Stories Zinfandel",
      sku: "ZIN_1000",
    });
    const db = tenantDb(shopAId, SHOP_A_DOMAIN);

    const percent = await searchLiveVariants(db, "100%");
    expect(percent.variants.map((v) => v.displayName)).toEqual([
      "100% Agave Tequila",
    ]);

    const underscore = await searchLiveVariants(db, "ZIN_");
    expect(underscore.variants.map((v) => v.sku)).toEqual(["ZIN_1000"]);
    expect((await searchLiveVariants(db, "Z_N")).variants).toEqual([]);
    expect((await searchLiveVariants(db, "%%")).variants).toEqual([]);
  });

  it("searches text that carries control characters instead of failing", async () => {
    await seedCatalogVariant(prisma, shopAId, "1001", "A-1", {
      productTitle: "Agave Tequila",
    });

    // PostgreSQL refuses a NUL byte in a text parameter; the raw query used
    // to reach the name search and fail the page.
    expect(await lookupAs(SHOP_A_DOMAIN, "?q=aga%00ve")).toMatchObject({
      kind: "stock",
      variant: { displayName: "Agave Tequila" },
    });
    expect(await lookupAs(SHOP_A_DOMAIN, "?q=tequ%09ila%0D%0A")).toMatchObject({
      kind: "stock",
      variant: { displayName: "Agave Tequila" },
    });
    expect(await lookupAs(SHOP_A_DOMAIN, "?q=%00%00")).toMatchObject({
      kind: "not_found",
    });
  });

  it("caps a broad search and reports that more exist", async () => {
    for (let i = 0; i < MAX_SEARCH_RESULTS + 2; i += 1) {
      await seedCatalogVariant(prisma, shopAId, String(3000 + i), `CAP-${i}`, {
        productTitle: `Lager ${String(i).padStart(2, "0")}`,
      });
    }
    const result = await searchLiveVariants(tenantDb(shopAId, SHOP_A_DOMAIN), "lager");
    expect(result.variants).toHaveLength(MAX_SEARCH_RESULTS);
    expect(result.truncated).toBe(true);
  });

  it("leaves deleted variants out of search and direct links", async () => {
    const gone = await seedCatalogVariant(prisma, shopAId, "1001", "A-1", {
      productTitle: "Discontinued Gin",
      absent: true,
    });

    expect(await lookupAs(SHOP_A_DOMAIN, "?q=discontinued")).toMatchObject({
      kind: "not_found",
    });
    expect(
      await lookupAs(SHOP_A_DOMAIN, `?variant=${encodeURIComponent(gone.variantGid)}`),
    ).toEqual({ kind: "variant_missing" });
  });

  it("rejects malformed variant IDs and oversized input without a lookup", async () => {
    await seedCatalogVariant(prisma, shopAId, "1001", "A-1");

    expect(await lookupAs(SHOP_A_DOMAIN, "?variant=1001")).toEqual({
      kind: "variant_missing",
    });
    expect(await lookupAs(SHOP_A_DOMAIN, `?q=${"9".repeat(1025)}`)).toEqual({
      kind: "too_long",
    });
    expect(await lookupAs(SHOP_A_DOMAIN, `?q=${"9".repeat(200)}`)).toEqual({
      kind: "too_long",
    });
  });

  it("tells an unsynced shop apart from a missing product", async () => {
    await seedCatalogVariant(prisma, shopBId, "2001", "B-1");

    expect(await lookupAs(SHOP_A_DOMAIN, "")).toEqual({
      kind: "idle",
      catalogSynced: false,
    });
    expect(await lookupAs(SHOP_A_DOMAIN, "?q=anything")).toEqual({
      kind: "not_found",
      query: "anything",
      catalogSynced: false,
    });
    expect(await lookupAs(SHOP_B_DOMAIN, "")).toEqual({
      kind: "idle",
      catalogSynced: true,
    });
  });

  it("builds the setup guide from the signed-in shop's data only", async () => {
    await seedCatalogVariant(prisma, shopBId, "2001", "B-1");

    const a = await loadSetupGuide(tenantDb(shopAId, SHOP_A_DOMAIN));
    const b = await loadSetupGuide(tenantDb(shopBId, SHOP_B_DOMAIN));

    expect(a.doneCount).toBe(0);
    expect(b.steps.filter((s) => s.done).map((s) => s.id)).toEqual([
      "catalog",
      "locations",
    ]);
    expect(b.steps.find((s) => s.id === "locations")?.detail).toBe(
      "1 active location: Store 2001.",
    );
  });
});
