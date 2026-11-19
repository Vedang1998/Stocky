/**
 * Low and out-of-stock variants as the shop's latest replenishment worksheet
 * recorded them.
 *
 * The worksheet is where stock status, reorder point, days of stock and the
 * suggested quantity are worked out. Reading its stored lines, rather than
 * working the figures out again here, means this report can never disagree
 * with the worksheet the merchant orders from.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { SHOP_SCOPE } from "../replenishment/scope";
import {
  readWorksheetSettings,
  type WorksheetSelection,
} from "../replenishment/worksheet/settings";
import type { Decimal } from "./money";

const PAGE_SIZE = 500;

export type LowStockWorksheet = {
  id: string;
  generatedAt: Date;
  /** Location name at the time, or null when the worksheet counted every location. */
  locationName: string | null;
  allLocations: boolean;
  /** Null when the stored settings could not be read. */
  selection: WorksheetSelection | null;
};

export type LowStockLine = {
  variantGid: string;
  productGid: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  vendor: string | null;
  supplierName: string | null;
  status: "LOW" | "OUT_OF_STOCK";
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
  unitsPerDay: Decimal | null;
  daysOfStock: Decimal | null;
  depletionDate: string | null;
  leadTimeDays: number | null;
  reorderPoint: number | null;
  price: Decimal | null;
  priceCurrencyCode: string | null;
  suggestedQuantity: number | null;
  /** Quantity on the purchase order made from the worksheet, 0 when none. */
  orderQuantity: number;
  purchaseOrderNumber: string | null;
};

export type LowStock = {
  worksheet: LowStockWorksheet | null;
  lines: LowStockLine[];
};

/** Low and out-of-stock lines of the shop's most recently generated worksheet. */
export async function loadLowStock(db: TenantDb): Promise<LowStock> {
  const sheet = await db.replenishmentWorksheet.findFirst({
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      generatedAt: true,
      scopeKey: true,
      scopeName: true,
      settings: true,
    },
  });
  if (!sheet) return { worksheet: null, lines: [] };

  const settings = readWorksheetSettings(sheet.settings);
  const allLocations = settings
    ? settings.scopeKey === SHOP_SCOPE
    : sheet.scopeName === null;
  const worksheet: LowStockWorksheet = {
    id: sheet.id,
    generatedAt: sheet.generatedAt,
    locationName: allLocations ? null : sheet.scopeName,
    allLocations,
    selection: settings?.selection ?? null,
  };

  const lines: LowStockLine[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: Awaited<
      ReturnType<typeof db.replenishmentWorksheetLine.findMany>
    > = await db.replenishmentWorksheetLine.findMany({
      where: {
        worksheetId: sheet.id,
        stockStatus: { in: ["LOW", "OUT_OF_STOCK"] },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    for (const line of page) {
      lines.push({
        variantGid: line.variantGid,
        productGid: line.productGid,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        vendor: line.vendor,
        supplierName: line.supplierName,
        status: line.stockStatus === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "LOW",
        available: line.availableQuantity,
        onHand: line.onHandQuantity,
        committed: line.committedQuantity,
        incoming: line.incomingQuantity,
        unitsPerDay: line.unitsPerDay,
        daysOfStock: line.daysOfStock,
        depletionDate: line.depletionDate,
        leadTimeDays: line.leadTimeDays,
        reorderPoint: line.reorderPoint,
        price: line.priceAmount,
        priceCurrencyCode: line.priceCurrencyCode,
        suggestedQuantity: line.suggestedQuantity,
        orderQuantity: line.orderQuantity,
        purchaseOrderNumber: line.purchaseOrderNumber,
      });
    }
    if (page.length < PAGE_SIZE) return { worksheet, lines };
    afterId = page[page.length - 1]!.id;
  }
}
