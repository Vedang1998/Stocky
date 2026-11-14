/**
 * The purchase-order page's read model: one order with its lines priced,
 * charges allocated, totals, and what the lifecycle rules allow next. Money is
 * returned as exact decimal strings, so nothing downstream does arithmetic.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import {
  toFixed,
  toFixedOrNull,
  toInputString,
  UNIT_COST_SCALE,
} from "../../lib/purchasing/decimal";
import {
  formatCalendarDate,
  parseCalendarDate,
} from "../../lib/purchasing/form-input";
import {
  canEditCommercialTerms,
  canEditHeader,
  canEditLines,
  canPerform,
  isIncoming,
  receivingDenial,
  type PurchaseOrderAction,
  type PurchaseOrderStatus,
} from "../../lib/purchasing/status";
import {
  projectedMarginPercent,
  toShopCurrency,
  type AllocationMethod,
  type ChargeKind,
} from "../../lib/purchasing/totals";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import { listLocations, type DestinationLocation } from "./locations.server";
import {
  effectiveCharges,
  lifecycleStateOf,
  loadPurchaseOrder,
  remainingQuantity,
  totalsFor,
} from "./purchase-order-records.server";
import { variantDisplayName } from "./variants.server";

const LIFECYCLE_ACTIONS: readonly PurchaseOrderAction[] = [
  "markSent",
  "markOrdered",
  "cancel",
  "close",
  "archive",
  "unarchive",
  "delete",
];

export type PurchaseOrderLineView = {
  id: string;
  variantGid: string;
  name: string;
  sku: string | null;
  vendorSku: string | null;
  barcode: string | null;
  packSize: number | null;
  orderUnit: string | null;
  orderedQty: number;
  receivedQty: number;
  cancelledQty: number;
  remainingQty: number;
  unitCost: string;
  /** The unit cost without padding zeros, for the edit field. */
  unitCostInput: string;
  /** True when someone typed the cost; false when it came from supplier terms. */
  manualCost: boolean;
  /** No cost is on file, so the line is priced at zero. */
  missingCost: boolean;
  discountPercentInput: string;
  taxRatePercentInput: string;
  note: string | null;
  netAmount: string;
  taxAmount: string;
  landedUnitCost: string;
  /** Projected margin over landed cost, in percent; null when it cannot be worked out. */
  marginPercent: string | null;
  /** Retail price in shop currency when the line was added; null when unknown. */
  retailPrice: string | null;
};

export type PurchaseOrderChargeView = {
  kind: ChargeKind;
  description: string | null;
  amount: string;
  allocate: boolean;
};

export type PurchaseOrderView = {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  archived: boolean;
  version: number;
  /** The document version the supplier was last sent; null when never sent. */
  sentVersion: number | null;
  sentAt: Date | null;
  supplier: {
    id: string;
    name: string;
    archived: boolean;
    contactEmail: string | null;
  };
  locationGid: string;
  /** Null when the destination is no longer a location of the shop. */
  location: DestinationLocation | null;
  /** Active locations the destination can be changed to. */
  locationOptions: DestinationLocation[];
  currency: string;
  exchangeRateInput: string;
  /** Still incoming with an expected date before the merchant's today. */
  overdue: boolean;
  header: {
    supplierOrderNumber: string | null;
    invoiceNumber: string | null;
    issuedOn: string | null;
    expectedOn: string | null;
    shipOn: string | null;
    cancelOn: string | null;
    invoiceOn: string | null;
    paymentDueOn: string | null;
    paymentTerms: string | null;
    shippingTerms: string | null;
    shipToAddress: string | null;
    billToAddress: string | null;
    buyerName: string | null;
    notes: string | null;
    supplierNotes: string | null;
  };
  lines: PurchaseOrderLineView[];
  charges: PurchaseOrderChargeView[];
  landedCostMethod: AllocationMethod;
  totals: {
    units: number;
    receivedUnits: number;
    remainingUnits: number;
    merchandiseAmount: string;
    lineDiscountAmount: string;
    taxAmount: string;
    chargesAmount: string;
    totalAmount: string;
    /** The order total in shop currency; null when the currencies match or no rate is set. */
    totalInShopCurrency: string | null;
    /** How allocated charges were actually spread; null when there was nothing to spread. */
    allocationApplied: AllocationMethod | null;
    unallocatedAmount: string;
  };
  permissions: {
    editHeader: boolean;
    editTerms: boolean;
    editLines: boolean;
    actions: PurchaseOrderAction[];
    /** Why a delivery cannot be received right now; null when it can. */
    receivingDenial: string | null;
  };
};

export async function getPurchaseOrderView(
  db: TenantDb,
  purchaseOrderId: string,
  options: {
    admin?: AdminGraphQLClient;
    /** The merchant's calendar date as YYYY-MM-DD. */
    today?: string | null;
    shopCurrency?: string | null;
  } = {},
): Promise<PurchaseOrderView> {
  const [po, locations] = await Promise.all([
    loadPurchaseOrder(db, purchaseOrderId),
    listLocations(db, options.admin),
  ]);
  const state = lifecycleStateOf(po);
  const totals = totalsFor(po);
  const costs = new Map(totals.lines.map((line) => [line.id, line]));
  const today = options.today ? parseCalendarDate(options.today) : null;
  const sameCurrency =
    !options.shopCurrency || options.shopCurrency === po.currency;

  const lines = po.lineItems.map((line): PurchaseOrderLineView => {
    const cost = costs.get(line.id)!;
    const margin = projectedMarginPercent(
      line.retailPrice,
      toShopCurrency(cost.landedUnitCost, po.exchangeRate, sameCurrency),
    );
    return {
      id: line.id,
      variantGid: line.shopifyVariantId,
      name: variantDisplayName(line),
      sku: line.sku,
      vendorSku: line.vendorSku,
      barcode: line.barcode,
      packSize: line.packSize,
      orderUnit: line.orderUnit,
      orderedQty: line.orderedQty,
      receivedQty: line.receivedQty,
      cancelledQty: line.cancelledQty,
      remainingQty: remainingQuantity(line),
      unitCost: toFixed(line.unitCost, UNIT_COST_SCALE),
      unitCostInput: toInputString(line.unitCost),
      manualCost: line.manualCostOverride,
      missingCost: !line.manualCostOverride && line.unitCost.isZero(),
      discountPercentInput: toInputString(line.discountPercent),
      taxRatePercentInput: toInputString(line.taxRatePercent),
      note: line.note,
      netAmount: toFixed(cost.netAmount),
      taxAmount: toFixed(cost.taxAmount),
      landedUnitCost: toFixed(cost.landedUnitCost, UNIT_COST_SCALE),
      marginPercent: toFixedOrNull(margin, 1),
      retailPrice: toFixedOrNull(line.retailPrice),
    };
  });

  const totalInShopCurrency = sameCurrency
    ? null
    : toShopCurrency(totals.totalAmount, po.exchangeRate, false);

  return {
    id: po.id,
    poNumber: po.poNumber ?? po.id,
    status: po.status,
    archived: state.archived,
    version: po.version,
    sentVersion: po.sentVersion,
    sentAt: po.sentAt,
    supplier: {
      id: po.supplier.id,
      name: po.supplier.name,
      archived: po.supplier.status !== "ACTIVE",
      contactEmail: po.supplier.contactEmail,
    },
    locationGid: po.locationId,
    location: locations.find((l) => l.gid === po.locationId) ?? null,
    locationOptions: locations.filter((l) => l.isActive),
    currency: po.currency,
    exchangeRateInput: toInputString(po.exchangeRate),
    overdue:
      today !== null &&
      !state.archived &&
      isIncoming(po.status) &&
      po.expectedOn !== null &&
      po.expectedOn.getTime() < today.getTime(),
    header: {
      supplierOrderNumber: po.supplierOrderNumber,
      invoiceNumber: po.invoiceNumber,
      issuedOn: formatCalendarDate(po.issuedOn),
      expectedOn: formatCalendarDate(po.expectedOn),
      shipOn: formatCalendarDate(po.shipOn),
      cancelOn: formatCalendarDate(po.cancelOn),
      invoiceOn: formatCalendarDate(po.invoiceOn),
      paymentDueOn: formatCalendarDate(po.paymentDueOn),
      paymentTerms: po.paymentTerms,
      shippingTerms: po.shippingTerms,
      shipToAddress: po.shipToAddress,
      billToAddress: po.billToAddress,
      buyerName: po.buyerName,
      notes: po.notes,
      supplierNotes: po.supplierNotes,
    },
    lines,
    charges: effectiveCharges(po).map((charge) => ({
      kind: charge.kind,
      description: charge.description,
      amount: toFixed(charge.amount),
      allocate: charge.allocate,
    })),
    landedCostMethod: po.landedCostMethod,
    totals: {
      units: totals.units,
      receivedUnits: po.lineItems.reduce((sum, l) => sum + l.receivedQty, 0),
      remainingUnits: po.lineItems.reduce(
        (sum, l) => sum + remainingQuantity(l),
        0,
      ),
      merchandiseAmount: toFixed(totals.merchandiseAmount),
      lineDiscountAmount: toFixed(totals.lineDiscountAmount),
      taxAmount: toFixed(totals.taxAmount),
      chargesAmount: toFixed(totals.chargesAmount),
      totalAmount: toFixed(totals.totalAmount),
      totalInShopCurrency: toFixedOrNull(totalInShopCurrency),
      allocationApplied: totals.allocation.applied,
      unallocatedAmount: toFixed(totals.allocation.unallocatedAmount),
    },
    permissions: {
      editHeader: canEditHeader(state),
      editTerms: canEditCommercialTerms(state),
      editLines: canEditLines(state),
      actions: LIFECYCLE_ACTIONS.filter((action) => canPerform(state, action)),
      receivingDenial: receivingDenial(state),
    },
  };
}
