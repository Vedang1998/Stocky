/**
 * What the POS transfer-receiving screens read and write. Receiving itself is
 * the transfer service's job; this module checks that the transfer is bound
 * for the POS location and in transit, shapes data for a small screen, and
 * requires a signed-in staff member so every receipt names who posted it.
 * The same rules as the admin screen apply, including the transfer switch.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { PosTenantContext } from "../../tenant/require-pos-tenant.server";
import { STAFF_REQUIRED_MESSAGE } from "../../services/inventory-writes/actor.server";
import type { ExecuteInventoryOperationOptions } from "../../services/inventory-writes/execute.server";
import type { AdminGraphQLClient } from "../../services/shopify-gql.server";
import {
  isSwitchedOn,
  NOT_IN_TRANSIT_MESSAGE,
  SHOPIFY_MANAGED_MESSAGE,
  SWITCHED_OFF_MESSAGE,
} from "../../services/transfers/transfer-core.server";
import {
  getTransferLines,
  TRANSFER_LINE_PAGE_SIZE,
  type TransferHeader,
} from "../../services/transfers/transfer-read.server";
import {
  postTransferReceipt,
  recordTransferReceiptScan,
  setTransferReceiveQuantity,
} from "../../services/transfers/transfer-receiving.server";
import { transferTotals } from "../../services/transfers/transfer-quantities";
import { PosApiError } from "./pos-api.server";
import { requirePosPlan } from "./pos-plan.server";
import { parseTransferReceiveBody } from "./transfer-receiving-body";

export const POS_TRANSFER_LIST_SIZE = 20;

/** The POS location as a Shopify GID, required to receive a transfer. */
export function requireTransferLocation(location: string | null): string {
  if (location === null) {
    throw new PosApiError(
      400,
      "bad_request",
      "Choose a location in POS before receiving a transfer.",
    );
  }
  return location;
}

export type PosReceivableTransfer = {
  id: string;
  /** ISO time the transfer left the source, or null. */
  shippedAt: string | null;
  shippedUnits: number;
  outstandingUnits: number;
  countedInUnits: number;
};

export type PosTransferList = {
  receivingEnabled: boolean;
  transfers: PosReceivableTransfer[];
  hasMore: boolean;
};

export type PosTransferLine = {
  lineId: string;
  variantGid: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  shippedQty: number;
  receivedQty: number;
  rejectedQty: number;
  /** Units counted in for the next receipt. */
  countedInQty: number;
  /** Shipped units nobody has accounted for yet. */
  outstandingQty: number;
};

export type PosTransferSheet = {
  receivingEnabled: boolean;
  transfer: {
    id: string;
    shippedUnits: number;
    receivedUnits: number;
    countedInUnits: number;
    outstandingUnits: number;
  };
  /** Lines with units still to account for or counted in, one page. */
  lines: PosTransferLine[];
  hasMoreLines: boolean;
};

export type PosTransferReceiveResponse =
  | {
      ok: true;
      /** The scanned item, for a scan. */
      scanned: { title: string; countedIn: number; outstanding: number } | null;
      /** Set for a posted receipt. */
      posted: { receivedUnits: number; completed: boolean; alreadyDone: boolean } | null;
      /** Null when it could not be read back; the screen reloads it itself. */
      sheet: PosTransferSheet | null;
    }
  | { ok: false; message: string; sheet: PosTransferSheet | null };

export type TransferReceivingDeps = {
  adminFor: (shopDomain: string) => Promise<AdminGraphQLClient>;
  stock?: ExecuteInventoryOperationOptions;
};

const switchedOn = (deps: Pick<TransferReceivingDeps, "stock">) =>
  isSwitchedOn(deps.stock ?? {});

/** The transfer, provided it is bound for the POS location and in transit. */
async function openTransfer(
  db: TenantDb,
  transferId: string,
  locationGid: string,
): Promise<TransferHeader> {
  const transfer = (await db.transferOrder.findFirst({
    where: { id: transferId },
    select: {
      id: true,
      destinationLocationId: true,
      status: true,
      shopifyTransferId: true,
      shippedAt: true,
    },
  })) as Pick<
    TransferHeader,
    "id" | "destinationLocationId" | "status" | "shopifyTransferId" | "shippedAt"
  > | null;
  if (!transfer) {
    throw new PosApiError(404, "not_found", "This transfer wasn’t found.");
  }
  if (transfer.destinationLocationId !== locationGid) {
    throw new PosApiError(
      409,
      "conflict",
      "This transfer is going to a different location. Receive it there.",
    );
  }
  if (transfer.status !== "IN_TRANSIT") {
    throw new PosApiError(409, "conflict", NOT_IN_TRANSIT_MESSAGE);
  }
  if (transfer.shopifyTransferId) {
    throw new PosApiError(409, "conflict", SHOPIFY_MANAGED_MESSAGE);
  }
  return transfer as TransferHeader;
}

export async function listReceivableTransfers(
  db: TenantDb,
  locationGid: string,
  deps: Pick<TransferReceivingDeps, "stock"> = {},
): Promise<PosTransferList> {
  await requirePosPlan(db);
  const rows = (await db.transferOrder.findMany({
    where: {
      status: "IN_TRANSIT",
      shopifyTransferId: null,
      destinationLocationId: locationGid,
    },
    select: {
      id: true,
      shippedAt: true,
      lineItems: {
        select: {
          quantity: true,
          pickedQty: true,
          receivedQty: true,
          pendingReceiveQty: true,
          rejectedQty: true,
          returnedQty: true,
        },
      },
    },
    orderBy: [{ shippedAt: "desc" }, { id: "desc" }],
    take: POS_TRANSFER_LIST_SIZE + 1,
  })) as Array<{
    id: string;
    shippedAt: Date | null;
    lineItems: Parameters<typeof transferTotals>[1];
  }>;
  return {
    receivingEnabled: switchedOn(deps),
    hasMore: rows.length > POS_TRANSFER_LIST_SIZE,
    transfers: rows.slice(0, POS_TRANSFER_LIST_SIZE).map((row) => {
      const totals = transferTotals("IN_TRANSIT", row.lineItems);
      return {
        id: row.id,
        shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
        shippedUnits: totals.shipUnits,
        outstandingUnits: totals.outstandingUnits,
        countedInUnits: totals.countedInUnits,
      };
    }),
  };
}

async function buildSheet(
  db: TenantDb,
  transfer: Pick<TransferHeader, "id" | "status">,
  deps: Pick<TransferReceivingDeps, "stock">,
): Promise<PosTransferSheet> {
  const page = await getTransferLines(db, {
    transfer,
    filter: "open",
    page: 1,
  });
  return {
    receivingEnabled: switchedOn(deps),
    transfer: {
      id: transfer.id,
      shippedUnits: page.totals.shipUnits,
      receivedUnits: page.totals.receivedUnits,
      countedInUnits: page.totals.countedInUnits,
      outstandingUnits: page.totals.outstandingUnits,
    },
    lines: page.lines.map((line) => ({
      lineId: line.id,
      variantGid: line.shopifyVariantId,
      name: line.title,
      sku: line.sku,
      barcode: line.barcode,
      shippedQty: line.shipQty,
      receivedQty: line.receivedQty,
      rejectedQty: line.rejectedQty,
      countedInQty: line.pendingReceiveQty,
      outstandingQty: line.outstandingQty,
    })),
    hasMoreLines: page.total > TRANSFER_LINE_PAGE_SIZE,
  };
}

export async function getTransferReceiveSheet(
  db: TenantDb,
  transferId: string,
  locationGid: string,
  deps: Pick<TransferReceivingDeps, "stock"> = {},
): Promise<PosTransferSheet> {
  await requirePosPlan(db);
  const transfer = await openTransfer(db, transferId, locationGid);
  return buildSheet(db, transfer, deps);
}

/** The sheet after a change; a failure reading it must not undo the answer. */
async function sheetAfter(
  db: TenantDb,
  transferId: string,
  deps: Pick<TransferReceivingDeps, "stock">,
): Promise<PosTransferSheet | null> {
  try {
    // Posting the last units finishes the transfer, so it is read as it now is.
    const transfer = (await db.transferOrder.findFirst({
      where: { id: transferId },
      select: { id: true, status: true },
    })) as Pick<TransferHeader, "id" | "status"> | null;
    return transfer ? await buildSheet(db, transfer, deps) : null;
  } catch (error) {
    console.error("POS transfer receiving could not reload the transfer", {
      transferId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Count units in, set a line's count, or post what is counted in. A request
 * the transfer rules refuse comes back as `ok: false` with the reason to
 * show, not as an HTTP error. Scans are not idempotent (each adds units);
 * setting a count and posting are safe to repeat.
 */
export async function receiveTransferAtPos(
  context: PosTenantContext,
  transferId: string,
  locationGid: string,
  body: unknown,
  deps: TransferReceivingDeps,
): Promise<PosTransferReceiveResponse> {
  const { db, actor } = context;
  await requirePosPlan(db);
  if (!actor.shopifyUserId) {
    throw new PosApiError(403, "forbidden", STAFF_REQUIRED_MESSAGE);
  }
  const request = parseTransferReceiveBody(body);
  await openTransfer(db, transferId, locationGid);

  const refuse = async (message: string): Promise<PosTransferReceiveResponse> => ({
    ok: false,
    message,
    sheet: await sheetAfter(db, transferId, deps),
  });
  if (!switchedOn(deps)) return refuse(SWITCHED_OFF_MESSAGE);

  if (request.intent === "scan") {
    const result = await recordTransferReceiptScan(db, {
      transferId,
      code: request.code,
      quantity: request.quantity,
    });
    if (!result.ok) return refuse(result.error);
    return {
      ok: true,
      scanned: {
        title: result.title,
        countedIn: result.countedIn,
        outstanding: result.outstanding,
      },
      posted: null,
      sheet: await sheetAfter(db, transferId, deps),
    };
  }

  if (request.intent === "set") {
    const result = await setTransferReceiveQuantity(db, {
      lineId: request.lineId,
      quantity: request.quantity,
      transferId,
    });
    if (!result.ok) return refuse(result.error);
    return {
      ok: true,
      scanned: null,
      posted: null,
      sheet: await sheetAfter(db, transferId, deps),
    };
  }

  const admin = await deps.adminFor(context.shop.myshopifyDomain);
  const result = await postTransferReceipt(
    db,
    admin,
    actor,
    transferId,
    deps.stock ?? {},
  );
  if (!result.ok) {
    const detail = result.problems.length
      ? ` ${result.problems.map((problem) => problem.message).join(" ")}`
      : "";
    return refuse(`${result.error}${detail}`);
  }
  return {
    ok: true,
    scanned: null,
    posted: {
      receivedUnits: result.receivedUnits,
      completed: result.completed,
      alreadyDone: result.alreadyDone,
    },
    sheet: await sheetAfter(db, transferId, deps),
  };
}
