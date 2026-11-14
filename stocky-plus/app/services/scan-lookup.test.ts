import { describe, expect, it } from "vitest";
import type { TenantDb } from "../tenant/tenant-db.server";
import {
  MAX_SCAN_CANDIDATES,
  findLiveVariant,
  resolveScannedCode,
} from "./barcode-lookup.server";
import { getVariantStock } from "./stock-lookup.server";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (
      condition !== null &&
      typeof condition === "object" &&
      "in" in (condition as Row)
    ) {
      return ((condition as { in: unknown[] }).in).includes(row[field]);
    }
    return (row[field] ?? null) === condition;
  });
}

function project(row: Row, select?: Record<string, boolean>): Row {
  if (!select) return row;
  return Object.fromEntries(
    Object.keys(select).map((field) => [field, row[field] ?? null]),
  );
}

/** In-memory stand-in for the TenantDb delegates these services use. */
function fakeDb(tables: Record<string, Row[]>): TenantDb {
  const delegate = (rows: Row[]) => ({
    async findMany(args: {
      where?: Where;
      select?: Record<string, boolean>;
      orderBy?: Record<string, "asc" | "desc">;
      take?: number;
    }) {
      let result = rows.filter((row) => matches(row, args.where ?? {}));
      const order = args.orderBy && Object.entries(args.orderBy)[0];
      if (order) {
        const [field, direction] = order;
        result = [...result].sort(
          (a, b) =>
            String(a[field]).localeCompare(String(b[field])) *
            (direction === "asc" ? 1 : -1),
        );
      }
      if (args.take !== undefined) result = result.slice(0, args.take);
      return result.map((row) => project(row, args.select));
    },
    async findFirst(args: { where?: Where; select?: Record<string, boolean> }) {
      const row = rows.find((r) => matches(r, args.where ?? {}));
      return row ? project(row, args.select) : null;
    },
  });
  return {
    shopifyProductFact: delegate(tables.products ?? []),
    shopifyVariantFact: delegate(tables.variants ?? []),
    shopifyInventoryItemFact: delegate(tables.items ?? []),
    shopifyInventoryLevelFact: delegate(tables.levels ?? []),
    shopifyLocationFact: delegate(tables.locations ?? []),
  } as unknown as TenantDb;
}

const live = { existenceState: "LIVE", deletedAt: null };

function product(id: string, title: string, image: string | null = null): Row {
  return {
    ...live,
    shopifyGid: `gid://shopify/Product/${id}`,
    title,
    featuredMediaUrl: image,
  };
}

function variant(
  id: string,
  productId: string,
  fields: Partial<{ title: string; displayName: string | null; sku: string | null; barcode: string | null }>,
): Row {
  return {
    ...live,
    shopifyGid: `gid://shopify/ProductVariant/${id}`,
    shopifyProductGid: `gid://shopify/Product/${productId}`,
    title: "Default Title",
    displayName: null,
    sku: null,
    barcode: null,
    ...fields,
  };
}

describe("resolveScannedCode", () => {
  it("rejects input that normalizes to nothing", async () => {
    expect(await resolveScannedCode(fakeDb({}), "\r\n")).toEqual({
      status: "invalid",
      reason: "empty",
    });
  });

  it("matches a stored UPC-A from a scanned GTIN-14", async () => {
    const db = fakeDb({
      products: [product("1", "Cold Brew", "https://cdn.example/cb.jpg")],
      variants: [variant("11", "1", { title: "12 oz", barcode: "036000291452", sku: "CB-12" })],
    });
    expect(await resolveScannedCode(db, "]E000036000291452\r")).toEqual({
      status: "matched",
      code: "00036000291452",
      matchedOn: "barcode",
      variant: {
        variantGid: "gid://shopify/ProductVariant/11",
        productGid: "gid://shopify/Product/1",
        displayName: "Cold Brew - 12 oz",
        productTitle: "Cold Brew",
        variantTitle: "12 oz",
        sku: "CB-12",
        barcode: "036000291452",
        imageUrl: "https://cdn.example/cb.jpg",
      },
    });
  });

  it("uses the product title alone for a default variant and prefers Shopify's display name", async () => {
    const db = fakeDb({
      products: [product("1", "Tote"), product("2", "Mug")],
      variants: [
        variant("11", "1", { barcode: "A1" }),
        variant("21", "2", { barcode: "B1", title: "Red", displayName: "Mug - Red (Large)" }),
      ],
    });
    const tote = await resolveScannedCode(db, "A1");
    const mug = await resolveScannedCode(db, "B1");
    expect(tote.status === "matched" && tote.variant.displayName).toBe("Tote");
    expect(mug.status === "matched" && mug.variant.displayName).toBe("Mug - Red (Large)");
  });

  it("falls back to an exact SKU when no barcode matches", async () => {
    const db = fakeDb({
      products: [product("1", "Tote")],
      variants: [variant("11", "1", { sku: "TOTE-BLK", barcode: "999" })],
    });
    expect(await resolveScannedCode(db, "TOTE-BLK")).toMatchObject({
      status: "matched",
      matchedOn: "sku",
      variant: { variantGid: "gid://shopify/ProductVariant/11" },
    });
    expect(await resolveScannedCode(db, "tote-blk")).toEqual({
      status: "unknown",
      code: "tote-blk",
    });
  });

  it("prefers a barcode hit over a SKU hit for the same code", async () => {
    const db = fakeDb({
      products: [product("1", "A"), product("2", "B")],
      variants: [
        variant("11", "1", { barcode: "4242" }),
        variant("21", "2", { sku: "4242" }),
      ],
    });
    expect(await resolveScannedCode(db, "4242")).toMatchObject({
      status: "matched",
      matchedOn: "barcode",
      variant: { variantGid: "gid://shopify/ProductVariant/11" },
    });
  });

  it("returns every candidate, exact spelling first, when a barcode is shared", async () => {
    const db = fakeDb({
      products: [product("1", "Shirt")],
      variants: [
        variant("12", "1", { title: "M", barcode: "0036000291452" }),
        variant("11", "1", { title: "S", barcode: "036000291452" }),
      ],
    });
    const result = await resolveScannedCode(db, "036000291452");
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.truncated).toBe(false);
    expect(result.candidates.map((c) => c.variantTitle)).toEqual(["S", "M"]);
  });

  it("caps candidates and reports truncation", async () => {
    const variants = Array.from({ length: MAX_SCAN_CANDIDATES + 3 }, (_, i) =>
      variant(String(100 + i), "1", { barcode: "DUP" }),
    );
    const db = fakeDb({ products: [product("1", "Bulk")], variants });
    const result = await resolveScannedCode(db, "DUP");
    expect(result).toMatchObject({ status: "ambiguous", truncated: true });
    if (result.status === "ambiguous") {
      expect(result.candidates).toHaveLength(MAX_SCAN_CANDIDATES);
    }
  });

  it("ignores deleted variants", async () => {
    const db = fakeDb({
      products: [product("1", "Gone")],
      variants: [
        {
          ...variant("11", "1", { barcode: "OLD" }),
          existenceState: "ABSENT",
          deletedAt: new Date(),
        },
      ],
    });
    expect(await resolveScannedCode(db, "OLD")).toEqual({
      status: "unknown",
      code: "OLD",
    });
    expect(await findLiveVariant(db, "gid://shopify/ProductVariant/11")).toBeNull();
  });
});

describe("getVariantStock", () => {
  const variantGid = "gid://shopify/ProductVariant/11";
  const itemGid = "gid://shopify/InventoryItem/11";
  const t1 = new Date("2026-11-01T10:00:00.000Z");
  const t2 = new Date("2026-11-02T10:00:00.000Z");

  function location(id: string, name: string, isActive = true): Row {
    return { ...live, shopifyGid: `gid://shopify/Location/${id}`, name, isActive };
  }

  function level(locationId: string, quantities: Row): Row {
    return {
      ...live,
      isActive: true,
      inventoryItemGid: itemGid,
      locationGid: `gid://shopify/Location/${locationId}`,
      availableQuantity: null,
      onHandQuantity: null,
      committedQuantity: null,
      incomingQuantity: null,
      availableQuantityUpdatedAt: null,
      onHandQuantityUpdatedAt: null,
      committedQuantityUpdatedAt: null,
      incomingQuantityUpdatedAt: null,
      ...quantities,
    };
  }

  const baseTables = {
    variants: [variant("11", "1", {})],
    items: [{ ...live, shopifyGid: itemGid, shopifyVariantGid: variantGid, tracked: true }],
  };

  it("returns null for a variant outside the live catalog", async () => {
    expect(await getVariantStock(fakeDb({}), variantGid)).toBeNull();
  });

  it("reports no locations when Shopify has no inventory item yet", async () => {
    const stock = await getVariantStock(
      fakeDb({ variants: baseTables.variants }),
      variantGid,
    );
    expect(stock).toEqual({
      variantGid,
      inventoryItemGid: null,
      tracked: null,
      locations: [],
      totals: { available: null, onHand: null, committed: null, incoming: null },
    });
  });

  it("lists active locations, preferred first, and keeps unknown quantities null", async () => {
    const db = fakeDb({
      ...baseTables,
      locations: [
        location("1", "Warehouse"),
        location("2", "Downtown"),
        location("3", "Closed store", false),
        location("4", "Airport"),
      ],
      levels: [
        level("1", { availableQuantity: 40, onHandQuantity: 45, committedQuantity: 5, availableQuantityUpdatedAt: t1, onHandQuantityUpdatedAt: t2 }),
        level("2", { availableQuantity: -2, onHandQuantity: 0, committedQuantity: 2 }),
        level("3", { availableQuantity: 500 }),
        level("4", { availableQuantity: 7, incomingQuantity: 12 }),
        { ...level("5", { availableQuantity: 900 }), isActive: false },
      ],
    });

    const stock = await getVariantStock(db, variantGid, {
      preferredLocationGid: "gid://shopify/Location/2",
    });

    expect(stock?.tracked).toBe(true);
    expect(stock?.locations.map((l) => l.locationName)).toEqual([
      "Downtown",
      "Airport",
      "Warehouse",
    ]);
    expect(stock?.locations[2]).toEqual({
      locationGid: "gid://shopify/Location/1",
      locationName: "Warehouse",
      available: 40,
      onHand: 45,
      committed: 5,
      incoming: null,
      observedAt: t2.toISOString(),
    });
    expect(stock?.locations[0].observedAt).toBeNull();
    expect(stock?.totals).toEqual({
      available: 45,
      onHand: 45,
      committed: 7,
      incoming: 12,
    });
  });

  it("passes through Shopify's untracked flag", async () => {
    const db = fakeDb({
      ...baseTables,
      items: [{ ...baseTables.items[0], tracked: false }],
    });
    const stock = await getVariantStock(db, variantGid);
    expect(stock?.tracked).toBe(false);
    expect(stock?.locations).toEqual([]);
  });
});
