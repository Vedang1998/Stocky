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

  it("receiving matches scans against the purchase order's line snapshots, not ShopifyVariantCache", () => {
    const warehouse = readApp("routes/app.warehouse.tsx");
    expect(warehouse).not.toMatch(/shopifyVariantCache/);

    const worksheet = readApp("services/purchasing/receiving.server.ts");
    expect(worksheet).toMatch(/barcode:\s*line\.barcode/);
    expect(worksheet).toMatch(/sku:\s*line\.sku/);

    const scan = readApp("lib/purchasing/receiving-scan.ts");
    expect(scan).toMatch(/sameCode\(line\.barcode, code\)/);
    expect(scan).not.toMatch(/shopifyVariantCache/);
  });

  it("stocktake completion reads ShopifyVariantCache inventoryItemId and title", () => {
    const service = readApp("services/stocktakes/stocktake.server.ts");
    expect(service).toMatch(/findVariantsById\(/);
    expect(service).toMatch(/\?\.inventoryItemId/);

    const reader = readApp("services/inventory-writes/variant-items.server.ts");
    expect(reader).toMatch(/shopifyVariantCache\.findMany/);
    expect(reader).toMatch(
      /const CATALOG_SELECT = \{\s*shopifyVariantId:\s*true,\s*title:\s*true,\s*sku:\s*true,\s*barcode:\s*true,\s*inventoryItemId:\s*true,?\s*\} as const/,
    );
    const byId = reader.slice(
      reader.indexOf("export async function findVariantsById("),
      reader.indexOf("export async function findVariantsByInventoryItem("),
    );
    expect(byId).toMatch(
      /shopifyVariantCache\.findMany\(\{\s*where:\s*\{\s*shopifyVariantId:\s*\{\s*in:\s*part\s*\}\s*\},\s*select:\s*CATALOG_SELECT,?\s*\}\)/,
    );
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
