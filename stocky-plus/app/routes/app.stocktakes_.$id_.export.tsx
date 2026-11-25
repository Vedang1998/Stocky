import type { LoaderFunctionArgs } from "react-router";
import { csvDownloadResponse, toCsv, type CsvCell } from "../lib/csv.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { readFormId } from "../services/inventory-writes/form-values";
import { listSyncedLocations } from "../services/inventory-writes/locations.server";
import { readShopTimeZone } from "../services/inventory-writes/shop-clock.server";
import {
  shopDay,
  shopTimeCell,
  timeColumn,
} from "../services/inventory-writes/shop-time";
import {
  getStocktake,
  listStocktakeLinesForExport,
} from "../services/stocktakes/stocktake-read.server";
import {
  COUNT_SOURCE_LABEL,
  STOCKTAKE_STATUS_BADGE,
} from "../services/stocktakes/stocktake-display";
import { listStocktakeLineValues } from "../services/stocktakes/stocktake-value.server";

/** The time is on the shop's clock when its time zone is known; the heading says which clock. */
const headers = (timeZone: string | null) => [
  "Count",
  "Location",
  "Status",
  "Item",
  "SKU",
  "Barcode",
  "Expected",
  "Counted",
  "Difference",
  "How counted",
  timeColumn("Counted at", timeZone),
  "Counted by staff ID",
  "Stock moved during count",
  "Measured from",
  "Unit cost",
  "Difference value",
  "Currency",
  "Recount",
];

/**
 * The count sheet: one row per item on the count. While a blind count is
 * still being counted the expected quantities and differences are left empty,
 * as they are on the page.
 *
 * A line with a difference carries Shopify's unit cost and the difference at
 * that cost: the cost as last synced while the count is open, the cost kept
 * at completion once it is completed. The value is exact, not rounded to the
 * currency, so the column adds up to the figure on the page.
 *
 * The last column says when a line waits to be counted again, or was counted
 * again and what it was first counted as.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { db, tenant } = await requireAdminTenant({ request, params });
  const stocktakeId = readFormId(params.id);
  const stocktake = stocktakeId ? await getStocktake(db, stocktakeId) : null;
  if (!stocktake) {
    return new Response("Stocktake not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const expectedHidden = stocktake.blind && stocktake.status === "IN_PROGRESS";
  const [lines, locations, timeZone, values] = await Promise.all([
    listStocktakeLinesForExport(db, stocktake.id),
    listSyncedLocations(db),
    readShopTimeZone(tenant),
    expectedHidden ? null : listStocktakeLineValues(db, stocktake),
  ]);
  const locationName =
    locations.find((location) => location.id === stocktake.locationId)?.name ??
    stocktake.locationId;
  const status = STOCKTAKE_STATUS_BADGE[stocktake.status].label;

  const rows: CsvCell[][] = lines.map((line) => {
    const moved = line.movementDetectedQty !== null;
    const valued = values?.get(line.id);
    return [
      stocktake.name,
      locationName,
      status,
      line.title,
      line.sku,
      line.barcode,
      expectedHidden ? null : line.expectedQty,
      line.countedQty,
      expectedHidden ? null : line.delta,
      line.countSource ? COUNT_SOURCE_LABEL[line.countSource] : null,
      shopTimeCell(line.countedAt, timeZone),
      line.countedByUserId,
      expectedHidden || !moved
        ? null
        : line.movementReviewedAt
          ? "Yes, reviewed"
          : "Yes, not reviewed",
      expectedHidden || !moved || !line.movementReviewedAt
        ? null
        : (line.movementBaselineQty ?? line.expectedQty),
      valued?.unitCost.amount.toFixed(),
      valued?.value,
      valued?.unitCost.currencyCode,
      line.recountRequestedAt
        ? "Asked for"
        : line.recountFromQty === null
          ? null
          : `Counted again, first counted as ${line.recountFromQty}`,
    ];
  });

  const day = shopDay(stocktake.startedAt ?? stocktake.createdAt, timeZone);
  return csvDownloadResponse(
    toCsv(headers(timeZone), rows),
    `stocktake-${day}.csv`,
  );
};
