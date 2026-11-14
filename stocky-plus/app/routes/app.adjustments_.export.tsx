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
import { fetchLocations } from "../services/shopify-gql.server";

const HEADERS = [
  "Recorded at (UTC)",
  "Type",
  "Status",
  "Reason",
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
] as const;

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
  const { admin, db } = await requireAdminTenant({ request });
  const query = readAdjustmentHistoryQuery(new URL(request.url).searchParams);

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
        entry.createdAt,
        entry.kind === "REVERSAL" ? "Reversal" : "Adjustment",
        STATUS_TEXT[entry.status],
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
      : new Date().toISOString().slice(0, 10);
  return csvDownloadResponse(toCsv(HEADERS, rows), `adjustments-${period}.csv`);
};
