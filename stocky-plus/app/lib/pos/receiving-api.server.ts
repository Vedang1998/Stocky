/**
 * What the POS receiving screens read and write. Receiving itself is the
 * purchasing service's job; this module checks that the order belongs to the
 * POS location, shapes the data for a small screen and maps service errors to
 * POS API errors. The same receipt rules as the admin screen apply, including
 * the staff requirement and the receiving switch.
 */
import { isInventoryWriteEnabled } from "../feature-flags.server";
import { RECEIVING_OFF_MESSAGE } from "../po-display";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { PosTenantContext } from "../../tenant/require-pos-tenant.server";
import { InventoryOperationValidationError } from "../../services/inventory-writes/errors";
import type { ExecuteInventoryOperationOptions } from "../../services/inventory-writes/execute.server";
import { STAFF_REQUIRED_MESSAGE } from "../../services/inventory-writes/actor.server";
import { PurchasingError } from "../../services/purchasing/errors";
import { listPurchaseOrders } from "../../services/purchasing/purchase-order-list.server";
import { loadPurchaseOrder } from "../../services/purchasing/purchase-order-records.server";
import {
  getReceivingWorksheet,
  postPurchaseOrderReceipt,
  type ReceivableLine,
} from "../../services/purchasing/receiving.server";
import type { AdminGraphQLClient } from "../../services/shopify-gql.server";
import { requirePosPlan } from "./pos-plan.server";
import { PosApiError } from "./pos-api.server";
import { parseReceiptBody } from "./receiving-body";

export type PosReceivableOrder = {
  id: string;
  poNumber: string;
  supplierName: string;
  status: string;
  /** YYYY-MM-DD, or null when no date is set. */
  expectedOn: string | null;
  orderedUnits: number;
  receivedUnits: number;
  remainingUnits: number;
};

export type PosReceivingList = {
  receivingEnabled: boolean;
  orders: PosReceivableOrder[];
  hasMore: boolean;
};

export type PosReceivingLine = Pick<
  ReceivableLine,
  | "lineItemId"
  | "name"
  | "sku"
  | "barcode"
  | "orderedQty"
  | "receivedQty"
  | "pendingQty"
  | "rejectedQty"
  | "openQty"
> & { variantGid: string };

export type PosReceivingSheet = {
  receivingEnabled: boolean;
  order: { id: string; poNumber: string; supplierName: string };
  /** Why nothing can be received right now, or null when receiving is open. */
  denial: string | null;
  lines: PosReceivingLine[];
};

export type PosReceiptResponse = {
  /** True when every accepted unit is in Shopify and counted. */
  complete: boolean;
  /** What to tell the person who pressed the button. */
  message: string;
  receiptNumber: number | null;
  /**
   * Where the receipt stands, so the screen knows what to do next:
   * `posted` is finished; `pending` was saved but Shopify has not confirmed
   * it, so the same request is retried; `settled` ended without all of it
   * received (refused or partly refused), so the next delivery starts fresh;
   * `not_recorded` means nothing was saved (receiving is switched off).
   */
  outcome: "posted" | "pending" | "settled" | "not_recorded";
  /**
   * The order as it stands now. Null when it could not be read after the
   * receipt was recorded: the receipt is still reported, and the screen
   * reloads the order itself.
   */
  sheet: PosReceivingSheet | null;
};

export type ReceivingDeps = {
  adminFor: (shopDomain: string) => Promise<AdminGraphQLClient>;
  stock?: ExecuteInventoryOperationOptions;
  receivingEnabled?: () => boolean;
};

const receivingSwitchedOn = () => isInventoryWriteEnabled("receiptWrites");

function receivingIsOn(deps: Pick<ReceivingDeps, "receivingEnabled">): boolean {
  return (deps.receivingEnabled ?? receivingSwitchedOn)();
}

function receiptOutcome(
  receipt: { status: string } | null,
): PosReceiptResponse["outcome"] {
  if (receipt === null) return "not_recorded";
  if (receipt.status === "POSTED") return "posted";
  if (receipt.status === "PENDING") return "pending";
  return "settled";
}

/** Like `toApiError`, but a reused key with other quantities gets its own code. */
function toReceiptError(error: unknown): never {
  if (error instanceof PurchasingError && error.code === "conflict") {
    throw new PosApiError(409, "different_counts", error.message);
  }
  return toApiError(error);
}

function toApiError(error: unknown): never {
  if (error instanceof PosApiError) throw error;
  if (error instanceof PurchasingError) {
    const fieldErrors = Object.keys(error.fieldErrors).length
      ? error.fieldErrors
      : undefined;
    switch (error.code) {
      case "not_found":
        throw new PosApiError(404, "not_found", error.message);
      case "invalid_input":
        throw new PosApiError(400, "bad_request", error.message, fieldErrors);
      case "invalid_state":
      case "conflict":
        throw new PosApiError(409, "conflict", error.message, fieldErrors);
    }
  }
  if (error instanceof InventoryOperationValidationError) {
    throw new PosApiError(400, "bad_request", error.message);
  }
  throw error;
}

/** The numeric POS location ID as a Shopify GID, required to receive. */
export function requireReceivingLocation(
  location: string | null,
  action: "receiving" | "counting" = "receiving",
): string {
  if (location === null) {
    throw new PosApiError(
      400,
      "bad_request",
      `Choose a location in POS before ${action}.`,
    );
  }
  return location;
}

async function loadOrderAtLocation(
  db: TenantDb,
  purchaseOrderId: string,
  locationGid: string,
) {
  const po = await loadPurchaseOrder(db, purchaseOrderId).catch(toApiError);
  if (po.locationId !== locationGid) {
    throw new PosApiError(
      409,
      "conflict",
      "This order is being delivered to a different location. Receive it at that location.",
    );
  }
  return po;
}

function toLine(line: ReceivableLine): PosReceivingLine {
  return {
    lineItemId: line.lineItemId,
    variantGid: line.shopifyVariantId,
    name: line.name,
    sku: line.sku,
    barcode: line.barcode,
    orderedQty: line.orderedQty,
    receivedQty: line.receivedQty,
    pendingQty: line.pendingQty,
    rejectedQty: line.rejectedQty,
    openQty: line.openQty,
  };
}

export async function listReceivableOrders(
  db: TenantDb,
  locationGid: string,
  search: string | null,
  deps: Pick<ReceivingDeps, "receivingEnabled"> = {},
): Promise<PosReceivingList> {
  await requirePosPlan(db);
  const list = await listPurchaseOrders(db, {
    view: "incoming",
    locationGid,
    search,
  });
  return {
    receivingEnabled: receivingIsOn(deps),
    hasMore: list.hasNextPage,
    orders: list.items.map((item) => ({
      id: item.id,
      poNumber: item.poNumber,
      supplierName: item.supplierName,
      status: item.status,
      expectedOn: item.expectedOn,
      orderedUnits: item.orderedUnits,
      receivedUnits: item.receivedUnits,
      remainingUnits: item.remainingUnits,
    })),
  };
}

export async function getReceivingSheet(
  db: TenantDb,
  purchaseOrderId: string,
  locationGid: string,
  deps: Pick<ReceivingDeps, "receivingEnabled"> = {},
): Promise<PosReceivingSheet> {
  await requirePosPlan(db);
  const po = await loadOrderAtLocation(db, purchaseOrderId, locationGid);
  return buildSheet(db, po, deps);
}

/** The sheet for an order already loaded and checked against the POS location. */
async function buildSheet(
  db: TenantDb,
  po: Awaited<ReturnType<typeof loadOrderAtLocation>>,
  deps: Pick<ReceivingDeps, "receivingEnabled">,
): Promise<PosReceivingSheet> {
  const worksheet = await getReceivingWorksheet(db, po.id).catch(toApiError);
  return {
    receivingEnabled: receivingIsOn(deps),
    order: {
      id: po.id,
      poNumber: po.poNumber ?? po.id,
      supplierName: po.supplier.name,
    },
    denial: worksheet.denial,
    lines: worksheet.lines.map(toLine),
  };
}

export async function receiveAtPos(
  context: PosTenantContext,
  purchaseOrderId: string,
  locationGid: string,
  body: unknown,
  deps: ReceivingDeps,
): Promise<PosReceiptResponse> {
  const { db, actor } = context;
  await requirePosPlan(db);
  if (!actor.shopifyUserId) {
    throw new PosApiError(403, "forbidden", STAFF_REQUIRED_MESSAGE);
  }
  const input = parseReceiptBody(body, purchaseOrderId);
  const po = await loadOrderAtLocation(db, purchaseOrderId, locationGid);

  const admin = await deps.adminFor(context.shop.myshopifyDomain);
  const result = await postPurchaseOrderReceipt(
    db,
    admin,
    actor,
    input,
    deps.stock ?? {},
  ).catch(toReceiptError);

  return {
    complete: result.complete,
    message: result.receipt === null ? RECEIVING_OFF_MESSAGE : result.message,
    receiptNumber: result.receipt?.receiptNumber ?? null,
    outcome: receiptOutcome(result.receipt),
    // The receipt is recorded by now: a failure reading the order back must
    // not turn it into an error answer.
    sheet: await buildSheet(db, po, deps).catch((error: unknown) => {
      console.error("POS receiving could not reload the order after a receipt", {
        purchaseOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
  };
}
