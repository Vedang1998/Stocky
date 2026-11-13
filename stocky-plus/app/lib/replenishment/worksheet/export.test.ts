import { describe, expect, it } from "vitest";
import { toCsv } from "../../csv.server";
import { WORKSHEET_CSV_HEADERS, worksheetCsvRow } from "./export";
import type { WorksheetLine } from "./store.server";

function line(overrides: Partial<WorksheetLine> = {}): WorksheetLine {
  return {
    id: "line_1",
    variantGid: "gid://shopify/ProductVariant/201",
    productGid: "gid://shopify/Product/101",
    productTitle: "Merlot",
    variantTitle: "750 ml",
    sku: "MER-750",
    barcode: "00201",
    vendor: "Acme",
    productType: "Wine",
    imageUrl: null,
    priceAmount: "20",
    priceCurrencyCode: "USD",
    unitCostAmount: "9.25",
    unitCostCurrencyCode: "USD",
    supplierCostAmount: "8.5",
    supplierCostCurrencyCode: "USD",
    supplierId: "sup_acme",
    supplierName: "Acme Wines",
    vendorSku: "ACME-MER-750",
    minimumOrderQuantity: 24,
    packSize: 12,
    supplierCount: 2,
    tracked: true,
    availableQuantity: 10,
    onHandQuantity: 12,
    committedQuantity: 2,
    incomingQuantity: 3,
    netUnits: 30,
    distinctOrders: 2,
    revenueAmount: "600",
    unitsPerDay: "1.00",
    abcClass: "B",
    stockStatus: "LOW",
    daysOfStock: "10.0",
    depletionDate: "2026-11-20",
    leadTimeDays: 7,
    leadTimeSource: "SUPPLIER_DEFAULT",
    reorderPoint: 7,
    reorderPointSource: "AUTOMATIC",
    forecastDemand: "30.00",
    parityQuantity: 17,
    suggestedQuantity: 24,
    finalQuantity: 36,
    orderQuantity: 36,
    warningCodes: ["HISTORY_PARTIAL", "NEGATIVE_AVAILABLE"],
    detail: {
      trace: [],
      healthTrace: [],
      warnings: [],
      adjustments: [],
      lowStockReasons: [],
      baseNeed: "17.0000",
      levels: {
        minimumQuantity: 6,
        shelfLimitQuantity: 48,
        safetyStockQuantity: null,
        reorderPointQuantity: null,
      },
      suppliers: [],
    },
    purchaseOrderId: "po_1",
    purchaseOrderNumber: "PO-1001",
    ...overrides,
  };
}

describe("worksheetCsvRow", () => {
  it("has a value for every column, in column order", () => {
    const row = worksheetCsvRow(line(), 30);
    expect(row).toHaveLength(WORKSHEET_CSV_HEADERS.length);
    expect(Object.fromEntries(WORKSHEET_CSV_HEADERS.map((header, i) => [header, row[i]]))).toEqual({
      Product: "Merlot",
      Variant: "750 ml",
      SKU: "MER-750",
      Barcode: "00201",
      Vendor: "Acme",
      "Product type": "Wine",
      Supplier: "Acme Wines",
      "Supplier SKU": "ACME-MER-750",
      Available: 10,
      "On hand": 12,
      Committed: 2,
      Incoming: 3,
      "Net units sold": 30,
      Orders: 2,
      "Net sales": "600",
      "Net sales per day": "20.00",
      "Units per day": "1.00",
      "ABC class": "B",
      "Days of stock": "10.0",
      "Runs out around": "2026-11-20",
      "Stock status": "Low",
      "Lead time (days)": 7,
      "Reorder point": 7,
      Minimum: 6,
      "Shelf limit": 48,
      "Supplier minimum order": 24,
      "Pack size": 12,
      "Quantity before supplier rules": 17,
      "Suggested quantity": 24,
      "Order quantity": 36,
      Edited: "Yes",
      Price: "20",
      "Price currency": "USD",
      "Shopify unit cost": "9.25",
      "Shopify unit cost currency": "USD",
      "Supplier cost": "8.5",
      "Supplier cost currency": "USD",
      Warnings: "Partial sales history; Oversold",
      "Purchase order": "PO-1001",
    });
  });

  it("leaves unknown figures empty instead of writing zero", () => {
    const csv = toCsv(WORKSHEET_CSV_HEADERS, [
      worksheetCsvRow(
        line({
          variantTitle: "Default Title",
          availableQuantity: null,
          netUnits: null,
          revenueAmount: null,
          abcClass: null,
          suggestedQuantity: null,
          parityQuantity: null,
          finalQuantity: null,
          orderQuantity: 0,
          warningCodes: [],
          purchaseOrderNumber: null,
        }),
        30,
      ),
    ]);
    const [header, row] = csv.trimEnd().split("\r\n");
    const cells = Object.fromEntries(header.split(",").map((name, i) => [name, row.split(",")[i]]));
    expect(cells).toMatchObject({
      Variant: "",
      Available: "",
      "Net units sold": "",
      "Net sales": "",
      "Net sales per day": "",
      "ABC class": "",
      "Suggested quantity": "",
      "Order quantity": "0",
      Edited: "No",
      Warnings: "",
      "Purchase order": "",
    });
  });

  it("stops a product title from being read as a spreadsheet formula", () => {
    const csv = toCsv(WORKSHEET_CSV_HEADERS, [
      worksheetCsvRow(
        line({ productTitle: '=HYPERLINK("https://example.test")', sku: "+SKU" }),
        30,
      ),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`);
    expect(csv).toContain("'+SKU");
  });
});
