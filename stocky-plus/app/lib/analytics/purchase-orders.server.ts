/**
 * Purchase orders as the app recorded them, read for reporting.
 *
 * Totals come from the purchasing module's own arithmetic (`totalsFor`), so a
 * report can never show a figure the purchase order screen or its PDF would
 * not. Amounts stay in the purchase order's currency here; the report converts
 * them with the exchange rate frozen on each order.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  PURCHASE_ORDER_INCLUDE,
  remainingQuantity,
  totalsFor,
  type PurchaseOrderRecord,
} from "../../services/purchasing/purchase-order-records.server";
import type { PurchaseOrderStatus } from "../purchasing/status";
import type { Decimal } from "./money";
import type { UtcRange } from "./shop-calendar";

const PAGE_SIZE = 200;

export type PurchaseOrderLineFact = {
  lineId: string;
  variantGid: string;
  /** What the line called the product when it was added. */
  productTitle: string | null;
  variantTitle: string | null;
  sku: string | null;
  orderedQty: number;
  cancelledQty: number;
  receivedQty: number;
  remainingQty: number;
  unitCost: Decimal;
  /** Line amount after its discount, before tax. */
  netAmount: Decimal;
  taxAmount: Decimal;
  /** Cost per unit with the allocated charges, before tax. */
  landedUnitCost: Decimal;
};

export type PurchaseOrderFact = {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  archived: boolean;
  supplierId: string;
  supplierName: string;
  currency: string;
  /** Shop-currency units per one unit of `currency`; null when not set. */
  exchangeRate: Decimal | null;
  createdAt: Date;
  /** Calendar date the supplier is expected to deliver, if set. */
  expectedOn: Date | null;
  fullyReceivedAt: Date | null;
  /** Units ordered, less those cancelled. */
  orderedUnits: number;
  receivedUnits: number;
  remainingUnits: number;
  merchandiseAmount: Decimal;
  taxAmount: Decimal;
  chargesAmount: Decimal;
  totalAmount: Decimal;
  lines: PurchaseOrderLineFact[];
};

export function toPurchaseOrderFact(
  po: PurchaseOrderRecord,
): PurchaseOrderFact {
  const totals = totalsFor(po);
  const costs = new Map(totals.lines.map((line) => [line.id, line]));
  return {
    id: po.id,
    poNumber: po.poNumber ?? po.id,
    status: po.status,
    archived: po.archivedAt !== null,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    currency: po.currency,
    exchangeRate: po.exchangeRate,
    createdAt: po.createdAt,
    expectedOn: po.expectedOn,
    fullyReceivedAt: po.fullyReceivedAt,
    orderedUnits: totals.units,
    receivedUnits: po.lineItems.reduce(
      (sum, line) => sum + line.receivedQty,
      0,
    ),
    remainingUnits: po.lineItems.reduce(
      (sum, line) => sum + remainingQuantity(line),
      0,
    ),
    merchandiseAmount: totals.merchandiseAmount,
    taxAmount: totals.taxAmount,
    chargesAmount: totals.chargesAmount,
    totalAmount: totals.totalAmount,
    lines: po.lineItems.map((line) => {
      const cost = costs.get(line.id)!;
      return {
        lineId: line.id,
        variantGid: line.shopifyVariantId,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        orderedQty: line.orderedQty,
        cancelledQty: line.cancelledQty,
        receivedQty: line.receivedQty,
        remainingQty: remainingQuantity(line),
        unitCost: line.unitCost,
        netAmount: cost.netAmount,
        taxAmount: cost.taxAmount,
        landedUnitCost: cost.landedUnitCost,
      };
    }),
  };
}

/** Every purchase order created in the range, oldest first. */
export async function loadPurchaseOrders(
  db: TenantDb,
  range: UtcRange,
): Promise<PurchaseOrderFact[]> {
  const facts: PurchaseOrderFact[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page: PurchaseOrderRecord[] = await db.purchaseOrder.findMany({
      where: {
        createdAt: { gte: range.startUtc, lt: range.endUtcExclusive },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      include: PURCHASE_ORDER_INCLUDE,
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    for (const po of page) facts.push(toPurchaseOrderFact(po));
    if (page.length < PAGE_SIZE) return facts;
    afterId = page[page.length - 1]!.id;
  }
}
