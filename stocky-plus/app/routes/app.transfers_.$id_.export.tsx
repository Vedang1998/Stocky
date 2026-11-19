import type { LoaderFunctionArgs } from "react-router";
import { csvDownloadResponse, toCsv, type CsvCell } from "../lib/csv.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { readFormId } from "../services/inventory-writes/form-values";
import { listSyncedLocations } from "../services/inventory-writes/locations.server";
import {
  getTransfer,
  listTransferLinesForExport,
} from "../services/transfers/transfer-read.server";
import {
  transferReference,
  transferStatusBadge,
} from "../services/transfers/transfer-display";
import { transferTotals } from "../services/transfers/transfer-quantities";

const HEADERS = [
  "Transfer",
  "From",
  "To",
  "Status",
  "Created at (UTC)",
  "Shipped at (UTC)",
  "Received or closed at (UTC)",
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
] as const;

/**
 * The transfer report: one row per item on the transfer, with where each of
 * its units stands.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request, params });
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

  const [lines, locations] = await Promise.all([
    listTransferLinesForExport(db, transfer),
    listSyncedLocations(db),
  ]);
  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name ?? id;
  const reference = transferReference(transfer.id);
  const source = locationName(transfer.sourceLocationId);
  const destination = locationName(transfer.destinationLocationId);
  const status = transferStatusBadge(
    transfer.status,
    transferTotals(transfer.status, lines),
  ).label;

  const rows: CsvCell[][] = lines.map((line) => [
    reference,
    source,
    destination,
    status,
    transfer.createdAt,
    transfer.shippedAt,
    transfer.receivedAt,
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
  ]);

  const day = transfer.createdAt.toISOString().slice(0, 10);
  return csvDownloadResponse(
    toCsv(HEADERS, rows),
    `transfer-${reference}-${day}.csv`,
  );
};
