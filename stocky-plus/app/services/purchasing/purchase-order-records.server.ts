/**
 * Loading a purchase order with everything its arithmetic needs, and the
 * helpers every command and view shares: effective charges, totals, lifecycle
 * state and the optimistic-lock claim.
 */
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { ZERO } from "../../lib/purchasing/decimal";
import type { LifecycleState } from "../../lib/purchasing/status";
import {
  computePurchaseOrderTotals,
  type ChargeKind,
  type PurchaseOrderTotals,
} from "../../lib/purchasing/totals";
import { notFound, PurchasingError } from "./errors";

export const PURCHASE_ORDER_INCLUDE = {
  supplier: true,
  lineItems: { orderBy: [{ position: "asc" }, { id: "asc" }] },
  charges: { orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_INCLUDE;
}>;

export type PurchaseOrderLineRecord = PurchaseOrderRecord["lineItems"][number];

export type ChargeView = {
  /** Null for a legacy freight or customs amount not yet stored as a charge row. */
  id: string | null;
  kind: ChargeKind;
  description: string | null;
  amount: Prisma.Decimal;
  allocate: boolean;
};

export const STALE_VERSION_MESSAGE =
  "This purchase order was changed by someone else. Reload the page to see the latest version, then try again.";

export async function loadPurchaseOrder(
  db: TenantDb,
  purchaseOrderId: string,
): Promise<PurchaseOrderRecord> {
  const po: PurchaseOrderRecord | null = await db.purchaseOrder.findFirst({
    where: { id: purchaseOrderId },
    include: PURCHASE_ORDER_INCLUDE,
  });
  if (!po) throw notFound("Purchase order");
  return po;
}

/**
 * Take the row lock for the rest of the transaction and fail if the caller
 * was looking at an older version. Commands that change the supplier-facing
 * document increment `version` themselves once they know something changed.
 */
export async function claimPurchaseOrder(
  tx: TenantDb,
  purchaseOrderId: string,
  expectedVersion: number,
): Promise<PurchaseOrderRecord> {
  const claimed: { count: number } = await tx.purchaseOrder.updateMany({
    where: { id: purchaseOrderId, version: expectedVersion },
    data: { updatedAt: new Date() },
  });
  if (claimed.count === 0) {
    const exists: { id: string } | null = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId },
      select: { id: true },
    });
    if (!exists) throw notFound("Purchase order");
    throw new PurchasingError("conflict", STALE_VERSION_MESSAGE);
  }
  return loadPurchaseOrder(tx, purchaseOrderId);
}

/**
 * Take the row lock for the rest of the transaction without a version check.
 * Receiving uses it: a delivery is valid whichever version of the supplier
 * document the receiver was looking at, but two deliveries must not be
 * measured against the same open quantity at once.
 */
export async function lockPurchaseOrder(
  tx: TenantDb,
  purchaseOrderId: string,
): Promise<PurchaseOrderRecord> {
  const locked: { count: number } = await tx.purchaseOrder.updateMany({
    where: { id: purchaseOrderId },
    data: { updatedAt: new Date() },
  });
  if (locked.count === 0) throw notFound("Purchase order");
  return loadPurchaseOrder(tx, purchaseOrderId);
}

export function lifecycleStateOf(
  po: Pick<PurchaseOrderRecord, "status" | "archivedAt" | "lineItems">,
): LifecycleState {
  return {
    status: po.status,
    archived: po.archivedAt !== null,
    hasReceipts: po.lineItems.some((line) => line.receivedQty > 0),
  };
}

/**
 * Charge rows, or the legacy freight and customs columns presented as charges
 * for a purchase order whose charges have never been edited.
 */
export function effectiveCharges(
  po: Pick<PurchaseOrderRecord, "charges" | "freightCost" | "customsCost">,
): ChargeView[] {
  if (po.charges.length > 0) {
    return po.charges.map((charge) => ({
      id: charge.id,
      kind: charge.kind,
      description: charge.description,
      amount: charge.amount,
      allocate: charge.allocate,
    }));
  }
  const legacy: ChargeView[] = [];
  if (po.freightCost !== null && !po.freightCost.isZero()) {
    legacy.push({
      id: null,
      kind: "SHIPPING",
      description: "Freight",
      amount: po.freightCost,
      allocate: true,
    });
  }
  if (po.customsCost !== null && !po.customsCost.isZero()) {
    legacy.push({
      id: null,
      kind: "DUTY",
      description: "Customs",
      amount: po.customsCost,
      allocate: true,
    });
  }
  return legacy;
}

export function totalsFor(po: PurchaseOrderRecord): PurchaseOrderTotals {
  return computePurchaseOrderTotals(
    po.lineItems.map((line) => ({
      id: line.id,
      position: line.position,
      orderedQty: line.orderedQty,
      cancelledQty: line.cancelledQty,
      unitCost: line.unitCost,
      discountPercent: line.discountPercent,
      taxRatePercent: line.taxRatePercent,
      weightGrams: line.weight,
      volume: line.volume,
    })),
    effectiveCharges(po),
    po.landedCostMethod,
  );
}

/** Units still expected on a line: ordered less received less cancelled. */
export function remainingQuantity(
  line: Pick<PurchaseOrderLineRecord, "orderedQty" | "receivedQty" | "cancelledQty">,
): number {
  return Math.max(0, line.orderedQty - line.receivedQty - line.cancelledQty);
}

/**
 * Store each line's share of the allocated charges so receiving, reports and
 * exports read the same figures the purchase order shows. Returns the totals
 * that were persisted.
 */
export async function persistAllocation(
  tx: TenantDb,
  purchaseOrderId: string,
): Promise<{ po: PurchaseOrderRecord; totals: PurchaseOrderTotals }> {
  const po = await loadPurchaseOrder(tx, purchaseOrderId);
  const totals = totalsFor(po);
  const linesById = new Map(po.lineItems.map((line) => [line.id, line]));
  let changed = false;
  for (const result of totals.lines) {
    const line = linesById.get(result.id)!;
    const sameTotal = (line.allocatedChargesTotal ?? ZERO).equals(result.allocatedCharges);
    const samePerUnit = (line.allocatedLandedCost ?? ZERO).equals(result.allocatedPerUnit);
    if (
      sameTotal &&
      samePerUnit &&
      line.allocatedChargesTotal !== null &&
      line.allocatedLandedCost !== null
    ) {
      continue;
    }
    await tx.pOLineItem.update({
      where: { id: line.id },
      data: {
        allocatedChargesTotal: result.allocatedCharges,
        allocatedLandedCost: result.allocatedPerUnit,
      },
    });
    changed = true;
  }
  return { po: changed ? await loadPurchaseOrder(tx, purchaseOrderId) : po, totals };
}

export const RECEIPT_IN_FLIGHT_MESSAGE =
  "A delivery on this purchase order is still waiting for Shopify to confirm the stock change. Finish or retry it under Receipts, then try again.";

/**
 * Refuse a change that would be wrong if an unconfirmed receipt or reversal
 * lands afterwards: cancelling or closing the order, or lowering what a line
 * still expects. Call it after claimPurchaseOrder, so no receipt can be
 * recorded in between.
 */
export async function assertNoReceiptInFlight(
  tx: TenantDb,
  purchaseOrderId: string,
): Promise<void> {
  const inFlight: number = await tx.purchaseOrderReceipt.count({
    where: { purchaseOrderId, status: { in: ["PENDING", "REVERSING"] } },
  });
  if (inFlight > 0) {
    throw new PurchasingError("invalid_state", RECEIPT_IN_FLIGHT_MESSAGE);
  }
}
