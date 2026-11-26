import type { LoaderFunctionArgs } from "react-router";
import { csvDownloadResponse, toCsv, type CsvCell } from "../lib/csv.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { adjustmentReasonLabel } from "../services/adjustments/adjustment-input";
import { readAdjustmentHistoryQuery } from "../services/adjustments/adjustment-history-query";
import {
  ADJUSTMENT_EXPORT_LIMIT,
  listAdjustmentsForExport,
} from "../services/adjustments/adjustment.server";
import type {
  InventoryOperationLineStatus,
  InventoryOperationStatus,
} from "../services/inventory-writes/types";
import { readShopTimeZone } from "../services/inventory-writes/shop-clock.server";
import {
  shopDay,
  shopTimeCell,
  timeColumn,
} from "../services/inventory-writes/shop-time";
import { fetchLocations } from "../services/shopify-gql.server";

/** The time is on the shop's clock when its time zone is known; the heading says which clock. */
const headers = (timeZone: string | null) => [
  timeColumn("Recorded at", timeZone),
  "Type",
  "Status",
  "Reason",
  "Shopify reason",
  "Location",
  "Staff ID",
  "Item",
  "SKU",
  "Change",
  "Available after",
  "Line result",
  "Shopify message",
  "Note",
  "Adjustment ID",
  "Reverses adjustment ID",
];

const STATUS_TEXT: Record<InventoryOperationStatus, string> = {
  APPLIED: "Applied",
  PARTIALLY_APPLIED: "Partly applied",
  FAILED: "Not applied",
  BLOCKED: "Switched off",
  PENDING: "Not finished",
  APPLYING: "Not finished",
  RETRY_PENDING: "Not finished",
};

const LINE_TEXT: Record<InventoryOperationLineStatus, string> = {
  APPLIED: "Applied",
  FAILED: "Refused by Shopify",
  CONFLICT: "Quantity changed in Shopify first",
  PENDING: "Not sent",
  IN_FLIGHT: "Waiting for Shopify",
};

/** The adjustment report: one row per item of every adjustment and reversal in the period. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db, tenant } = await requireAdminTenant({ request });
  // The period's days are days on the shop's clock, as on the page.
  const timeZone = await readShopTimeZone(tenant);
  const query = readAdjustmentHistoryQuery(
    new URL(request.url).searchParams,
    timeZone,
  );

  const [{ entries, truncated }, locations] = await Promise.all([
    listAdjustmentsForExport(db, { from: query.from, to: query.to }),
    fetchLocations(admin),
  ]);
  if (truncated) {
    // A file that silently stops part-way would be read as the whole period.
    return new Response(
      `This period holds more than ${ADJUSTMENT_EXPORT_LIMIT.toLocaleString("en-US")} adjustments. Choose a shorter period on the Adjustments page and download again.`,
      {
        status: 422,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  const locationNames = new Map(locations.map((l) => [l.id, l.name]));
  const rows: CsvCell[][] = [];
  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        shopTimeCell(entry.createdAt, timeZone),
        entry.kind === "REVERSAL" ? "Reversal" : "Adjustment",
        STATUS_TEXT[entry.status],
        entry.reasonLabel ?? adjustmentReasonLabel(entry.reason),
        adjustmentReasonLabel(entry.reason),
        entry.locationId
          ? (locationNames.get(entry.locationId) ?? entry.locationId)
          : "",
        entry.staffId,
        line.title,
        line.sku,
        line.delta,
        line.quantityAfterChange,
        LINE_TEXT[line.status],
        line.errorMessage,
        entry.note,
        entry.operationId,
        entry.reversesOperationId,
      ]);
    }
  }

  const period =
    query.fromDay || query.toDay
      ? `${query.fromDay || "start"}-to-${query.toDay || "today"}`
      : shopDay(new Date(), timeZone);
  return csvDownloadResponse(
    toCsv(headers(timeZone), rows),
    `adjustments-${period}.csv`,
  );
};
