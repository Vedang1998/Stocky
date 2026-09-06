import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApp(rel: string): string {
  return readFileSync(path.join(APP_ROOT, rel), "utf8");
}

describe("legacy consumer characterization (PR5-F2C)", () => {
  it("Buying Table reads ShopifyVariantCache title, imageUrl, and inventoryItemId", () => {
    const source = readApp("routes/app.buying-table.tsx");
    expect(source).toMatch(/shopifyVariantCache\.findUnique/);
    expect(source).toMatch(/cache\?\.title/);
    expect(source).toMatch(/cache\?\.imageUrl/);
    expect(source).toMatch(/cache\?\.inventoryItemId/);
  });

  it("warehouse barcode lookup reads ShopifyVariantCache barcode and title", () => {
    const source = readApp("routes/app.warehouse.tsx");
    expect(source).toMatch(/shopifyVariantCache\.findFirst/);
    expect(source).toMatch(/where:\s*\{\s*barcode\s*\}/);
    expect(source).toMatch(/variant\.title/);
    expect(source).toMatch(/variant\.shopifyVariantId/);
  });

  it("stocktake completion reads ShopifyVariantCache inventoryItemId and title", () => {
    const source = readApp("routes/app.stocktakes.tsx");
    expect(source).toMatch(/shopifyVariantCache\.findUnique/);
    expect(source).toMatch(/cache\?\.inventoryItemId/);
    expect(source).toMatch(/cache\.title/);
  });

  it("forecast onHand reads InventorySnapshot.quantityAvailable", () => {
    const source = readApp("services/forecasting.server.ts");
    expect(source).toMatch(/inventorySnapshot\.findFirst/);
    expect(source).toMatch(/orderBy:\s*\{\s*snapshotDate:\s*"desc"\s*\}/);
    expect(source).toMatch(/onHand\?\.quantityAvailable\s*\?\?\s*0/);
    expect(source).toMatch(/shopifyVariantCache\.findUnique/);
    expect(source).toMatch(/cache\?\.title/);
  });

  it("F3 cutover removes competing catalog ShopifyVariantCache writers from shopify-sync", () => {
    const source = readApp("services/shopify-sync.server.ts");
    expect(source).not.toMatch(/shopifyVariantCache\.upsert/);
    expect(source).not.toMatch(/startCatalogSync/);
    expect(source).not.toMatch(/ingestBulkVariantCache/);
  });

  it("F3/R-165 inventory webhook no longer coerces unknown available to zero", () => {
    const source = readApp("jobs/workers/webhook-processor.ts");
    expect(source).not.toMatch(/quantityAvailable:\s*inv\.available\s*\?\?\s*0/);
    expect(source).not.toMatch(/inventorySnapshot\.upsert/);
    expect(source).not.toMatch(/computeForecast/);
    expect(source).not.toMatch(/lowStockAlert\.create/);
    expect(source).toContain("LEGACY_CATALOG_SYNC_V1_DISABLED");
  });
});
