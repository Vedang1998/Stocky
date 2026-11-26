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
  getTransfer,
  listTransferLinesForExport,
} from "../services/transfers/transfer-read.server";
import {
  transferReference,
  transferStatusBadge,
} from "../services/transfers/transfer-display";
import { transferTotals } from "../services/transfers/transfer-quantities";

/** The times are on the shop's clock when its time zone is known; the headings say which clock. */
const headers = (timeZone: string | null) => [
  "Transfer",
  "From",
  "To",
  "Status",
  timeColumn("Created at", timeZone),
  timeColumn("Shipped at", timeZone),
  timeColumn("Received or closed at", timeZone),
  "Item",
  "SKU",
  "Barcode",
  "Requested",
  "Shipped",
  "Received",
  "Counted in, not posted",
  "Rejected",
  "Reject reason",
  "Returned to source",
  "Written off",
  "Still to account for",
  // Added last, so the columns before it keep their places.
  "Not shipped yet",
];

/**
 * The transfer report: one row per item on the transfer, with where each of
 * its units stands.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { db, tenant } = await requireAdminTenant({ request, params });
  const transferId = readFormId(params.id);
  const transfer = transferId ? await getTransfer(db, transferId) : null;
  if (!transfer) {
    return new Response("Transfer not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const [lines, locations, timeZone] = await Promise.all([
    listTransferLinesForExport(db, transfer),
    listSyncedLocations(db),
    readShopTimeZone(tenant),
  ]);
  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name ?? id;
  const reference = transferReference(transfer.id);
  const source = locationName(transfer.sourceLocationId);
  const destination = locationName(transfer.destinationLocationId);
  const status = transferStatusBadge(
    transfer.status,
    transferTotals(transfer.status, lines, transfer.shipsInParts),
  ).label;

  const rows: CsvCell[][] = lines.map((line) => [
    reference,
    source,
    destination,
    status,
    shopTimeCell(transfer.createdAt, timeZone),
    shopTimeCell(transfer.shippedAt, timeZone),
    shopTimeCell(transfer.receivedAt, timeZone),
    line.title,
    line.sku,
    line.barcode,
    line.quantity,
    line.shipQty,
    line.receivedQty,
    line.pendingReceiveQty,
    line.rejectedQty,
    line.rejectNote,
    line.returnedQty,
    line.writtenOffQty,
    line.outstandingQty,
    line.toShipQty,
  ]);

  const day = shopDay(transfer.createdAt, timeZone);
  return csvDownloadResponse(
    toCsv(headers(timeZone), rows),
    `transfer-${reference}-${day}.csv`,
  );
};
