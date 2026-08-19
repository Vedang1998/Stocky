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

  it("current catalog ingest writes the same ShopifyVariantCache field set", () => {
    const source = readApp("services/shopify-sync.server.ts");
    expect(source).toMatch(/shopifyVariantCache\.upsert/);
    expect(source).toMatch(/shopifyProductId:/);
    expect(source).toMatch(/inventoryItemId:/);
    expect(source).toMatch(/imageUrl:/);
    expect(source).toMatch(/weight:/);
    expect(source).toMatch(/weightUnit:/);
    expect(source).toMatch(/ — /);
  });

  it("current inventory webhook writes today's InventorySnapshot.quantityAvailable", () => {
    const source = readApp("jobs/workers/webhook-processor.ts");
    expect(source).toMatch(/inventorySnapshot\.upsert/);
    expect(source).toMatch(/quantityAvailable:\s*inv\.available\s*\?\?\s*0/);
    expect(source).toMatch(/computeForecast/);
    expect(source).toMatch(/lowStockAlert\.create/);
  });
});
