/**
 * Dated variant unit events from canonical order facts.
 *
 * Implements `net-units-order-date-v1` (PR6 plan §7.1–7.2, PO-03/04/05/08/10):
 * the sole unit-event ledger is `ShopifyOrderAgreementSaleFact`; only
 * variant-unit-eligible `ProductSale`s count; `UPDATE` contributes nothing;
 * `UNKNOWN` actions and null quantities never become units; refunds and edit
 * removals restate the original order's shop-local date while later additions
 * are dated by their agreement. Test orders, gift cards and custom (no-variant)
 * lines are excluded from variant demand.
 *
 * Two provisional report policies are layered on top and named so every
 * consumer and export can cite them:
 * - `cancelled-orders-excluded-v1` (Q-015): a cancelled order contributes no
 *   units or revenue.
 * - `net-revenue-unit-price-v1` (Q-012/Q-013): event units × the line's unit
 *   price after all discounts in shop money, so refunds and removals reverse at
 *   the price the units sold for. Lines priced in a currency other than the
 *   report currency keep their units but contribute no revenue.
 *
 * An order whose eligible sales contain any action/sign contradiction is
 * excluded as a whole: its derived magnitudes are not trustworthy (PO-10).
 */
import { isExcludedFromVariantDemand, isVariantUnitEligibleSale } from "../order-facts/apply/units";
import { DIAGNOSTIC } from "../order-facts/apply/types";
import { Decimal, ZERO } from "./money";
import { localDateOf, type LocalDate } from "./shop-calendar";

export const NET_UNITS_POLICY = "net-units-order-date-v1";
export const CANCELLED_ORDERS_POLICY = "cancelled-orders-excluded-v1";
export const NET_REVENUE_POLICY = "net-revenue-unit-price-v1";

export type SalesOrderInput = {
  orderGid: string;
  processedAt: Date | null;
  test: boolean;
  cancelledAt: Date | null;
  unitDiagnosticState: string | null;
};

export type SalesLineInput = {
  lineGid: string;
  orderGid: string;
  variantGidAtSale: string | null;
  productGidAtSale: string | null;
  isGiftCard: boolean;
  orderShopCurrencyCode: string;
  /** `discountedUnitPriceAfterAllDiscountsSet.shopMoney`. */
  unitPriceAfterDiscounts: Decimal | null;
  unitPriceCurrencyCode: string | null;
  unitDiagnosticState: string | null;
};

export type SalesAgreementInput = {
  agreementGid: string;
  orderGid: string;
  reason: string | null;
  happenedAt: Date;
};

export type SalesSaleInput = {
  saleGid: string;
  agreementGid: string;
  orderGid: string;
  lineItemGid: string | null;
  lineType: string | null;
  actionType: string | null;
  saleTypename: string;
  quantity: number | null;
};

export type UnitEventKind =
  /** Original units on the order's own agreement. */
  | "ORDERED"
  /** Units added later by an edit or exchange. */
  | "ADDED"
  /** Units returned through a refund or return. */
  | "REFUNDED"
  /** Units removed by an order edit. */
  | "REMOVED"
  /** Returned units on an agreement whose reason is unknown. */
  | "RETURNED_UNCLASSIFIED";

export type UnitEvent = {
  variantGid: string;
  productGid: string | null;
  orderGid: string;
  lineGid: string;
  saleGid: string;
  localDate: LocalDate;
  kind: UnitEventKind;
  /** Signed: positive for ORDERED/ADDED, negative otherwise. */
  units: number;
  /** Signed shop-currency revenue, or null when the line has no usable price. */
  revenue: Decimal | null;
};

export type NetUnitsDiagnostics = {
  ordersEvaluated: number;
  ordersExcludedTest: number;
  ordersExcludedCancelled: number;
  ordersExcludedSignInconsistent: number;
  ordersWithoutProcessedAt: number;
  /** Orders with no stored agreement facts: no unit events can be derived. */
  ordersWithoutLedger: number;
  salesSkippedNullQuantity: number;
  salesSkippedUnknownAction: number;
  salesWithoutLine: number;
  salesWithoutAgreement: number;
  /** Eligible sales on gift-card, custom or otherwise non-variant lines. */
  salesExcludedNonVariant: number;
  eventsWithoutRevenue: number;
};

export function emptyNetUnitsDiagnostics(): NetUnitsDiagnostics {
  return {
    ordersEvaluated: 0,
    ordersExcludedTest: 0,
    ordersExcludedCancelled: 0,
    ordersExcludedSignInconsistent: 0,
    ordersWithoutProcessedAt: 0,
    ordersWithoutLedger: 0,
    salesSkippedNullQuantity: 0,
    salesSkippedUnknownAction: 0,
    salesWithoutLine: 0,
    salesWithoutAgreement: 0,
    salesExcludedNonVariant: 0,
    eventsWithoutRevenue: 0,
  };
}

export function mergeNetUnitsDiagnostics(
  into: NetUnitsDiagnostics,
  from: NetUnitsDiagnostics,
): NetUnitsDiagnostics {
  for (const key of Object.keys(into) as Array<keyof NetUnitsDiagnostics>) {
    into[key] += from[key];
  }
  return into;
}

export type DeriveUnitEventsInput = {
  timeZone: string;
  /** Shop currency; null disables revenue (every event reports null). */
  reportCurrency: string | null;
  orders: readonly SalesOrderInput[];
  lines: readonly SalesLineInput[];
  agreements: readonly SalesAgreementInput[];
  sales: readonly SalesSaleInput[];
  /**
   * Keep only events whose local date passes. Applied after dating, so a
   * refund outside the range still counts when its order is inside it.
   */
  includeDate?: (localDate: LocalDate) => boolean;
  /**
   * Keep only these event kinds. Used for orders outside the requested range,
   * where only later additions can land inside it.
   */
  includeKinds?: ReadonlySet<UnitEventKind>;
};

export type DeriveUnitEventsResult = {
  events: UnitEvent[];
  diagnostics: NetUnitsDiagnostics;
};

const ACTION_ORDER = "ORDER";
const ACTION_RETURN = "RETURN";
const ACTION_UPDATE = "UPDATE";
const ACTION_UNKNOWN = "UNKNOWN";

const REASON_ORDER = "ORDER";
const REASON_ORDER_EDIT = "ORDER_EDIT";
const RETURN_REASONS = new Set(["REFUND", "RETURN"]);

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

type ClassifiedSale = {
  sale: SalesSaleInput;
  line: SalesLineInput;
  agreement: SalesAgreementInput;
  action: typeof ACTION_ORDER | typeof ACTION_RETURN;
  quantity: number;
};

function signIsValid(action: string, quantity: number): boolean {
  if (action === ACTION_ORDER) return quantity > 0;
  if (action === ACTION_RETURN) return quantity < 0;
  return false;
}

function eventKind(
  action: typeof ACTION_ORDER | typeof ACTION_RETURN,
  reason: string | null,
): UnitEventKind {
  if (action === ACTION_ORDER) {
    return reason === REASON_ORDER ? "ORDERED" : "ADDED";
  }
  if (reason === REASON_ORDER_EDIT) return "REMOVED";
  if (reason != null && RETURN_REASONS.has(reason)) return "REFUNDED";
  return "RETURNED_UNCLASSIFIED";
}

function lineRevenue(
  line: SalesLineInput,
  units: number,
  reportCurrency: string | null,
): Decimal | null {
  if (reportCurrency == null) return null;
  if (line.unitPriceAfterDiscounts == null) return null;
  if (line.orderShopCurrencyCode !== reportCurrency) return null;
  if (
    line.unitPriceCurrencyCode != null &&
    line.unitPriceCurrencyCode !== reportCurrency
  ) {
    return null;
  }
  return line.unitPriceAfterDiscounts.times(units);
}

export function deriveUnitEvents(
  input: DeriveUnitEventsInput,
): DeriveUnitEventsResult {
  const diagnostics = emptyNetUnitsDiagnostics();
  const events: UnitEvent[] = [];

  const linesByGid = new Map(input.lines.map((line) => [line.lineGid, line]));
  const agreementsByGid = new Map(
    input.agreements.map((agreement) => [agreement.agreementGid, agreement]),
  );
  const agreementsByOrder = groupBy(input.agreements, (a) => a.orderGid);
  const salesByOrder = groupBy(input.sales, (s) => s.orderGid);
  const linesByOrder = groupBy(input.lines, (l) => l.orderGid);

  for (const order of input.orders) {
    diagnostics.ordersEvaluated += 1;
    if (order.test) {
      diagnostics.ordersExcludedTest += 1;
      continue;
    }
    if (order.cancelledAt != null) {
      diagnostics.ordersExcludedCancelled += 1;
      continue;
    }
    if (order.processedAt == null) {
      diagnostics.ordersWithoutProcessedAt += 1;
      continue;
    }
    const lineSignInconsistent = (linesByOrder.get(order.orderGid) ?? []).some(
      (line) => line.unitDiagnosticState === DIAGNOSTIC.SALE_SIGN,
    );
    if (order.unitDiagnosticState === DIAGNOSTIC.SALE_SIGN || lineSignInconsistent) {
      diagnostics.ordersExcludedSignInconsistent += 1;
      continue;
    }
    if ((agreementsByOrder.get(order.orderGid) ?? []).length === 0) {
      diagnostics.ordersWithoutLedger += 1;
      continue;
    }

    const orderDiagnostics = emptyNetUnitsDiagnostics();
    const classified: ClassifiedSale[] = [];
    let signInconsistent = false;

    for (const sale of salesByOrder.get(order.orderGid) ?? []) {
      if (!isVariantUnitEligibleSale(sale)) continue;
      if (sale.quantity == null) {
        orderDiagnostics.salesSkippedNullQuantity += 1;
        continue;
      }
      const action = (sale.actionType ?? ACTION_UNKNOWN).toUpperCase();
      if (action === ACTION_UPDATE) continue;
      if (action === ACTION_UNKNOWN) {
        orderDiagnostics.salesSkippedUnknownAction += 1;
        continue;
      }
      // An action outside Shopify's known set is treated like a sign
      // contradiction, exactly as the applicator's unit evaluation does.
      if (
        (action !== ACTION_ORDER && action !== ACTION_RETURN) ||
        !signIsValid(action, sale.quantity)
      ) {
        signInconsistent = true;
        break;
      }
      const agreement = agreementsByGid.get(sale.agreementGid);
      if (!agreement) {
        orderDiagnostics.salesWithoutAgreement += 1;
        continue;
      }
      const line = sale.lineItemGid ? linesByGid.get(sale.lineItemGid) : undefined;
      if (!line || line.orderGid !== order.orderGid) {
        orderDiagnostics.salesWithoutLine += 1;
        continue;
      }
      if (
        isExcludedFromVariantDemand({
          orderTest: order.test,
          isGiftCard: line.isGiftCard,
          variantGidAtSale: line.variantGidAtSale,
          lineType: sale.lineType,
        })
      ) {
        orderDiagnostics.salesExcludedNonVariant += 1;
        continue;
      }
      classified.push({ sale, line, agreement, action, quantity: sale.quantity });
    }

    if (signInconsistent) {
      diagnostics.ordersExcludedSignInconsistent += 1;
      continue;
    }
    mergeNetUnitsDiagnostics(diagnostics, orderDiagnostics);

    const orderDate = localDateOf(order.processedAt, input.timeZone);
    for (const { sale, line, agreement, action, quantity } of classified) {
      const kind = eventKind(action, agreement.reason);
      if (input.includeKinds && !input.includeKinds.has(kind)) continue;
      const localDate =
        kind === "ADDED"
          ? localDateOf(agreement.happenedAt, input.timeZone)
          : orderDate;
      if (input.includeDate && !input.includeDate(localDate)) continue;
      const revenue = lineRevenue(line, quantity, input.reportCurrency);
      if (revenue == null) diagnostics.eventsWithoutRevenue += 1;
      events.push({
        // isExcludedFromVariantDemand guarantees a variant identity here.
        variantGid: line.variantGidAtSale as string,
        productGid: line.productGidAtSale,
        orderGid: order.orderGid,
        lineGid: line.lineGid,
        saleGid: sale.saleGid,
        localDate,
        kind,
        units: quantity,
        revenue,
      });
    }
  }

  return { events, diagnostics };
}

export type UnitBreakdown = {
  netUnits: number;
  orderedUnits: number;
  addedUnits: number;
  refundedUnits: number;
  removedUnits: number;
  returnedUnclassifiedUnits: number;
  /** Sum of events that carry revenue. */
  revenue: Decimal;
  /** Events in the bucket with no usable revenue. */
  eventsWithoutRevenue: number;
};

function emptyBreakdown(): UnitBreakdown {
  return {
    netUnits: 0,
    orderedUnits: 0,
    addedUnits: 0,
    refundedUnits: 0,
    removedUnits: 0,
    returnedUnclassifiedUnits: 0,
    revenue: ZERO,
    eventsWithoutRevenue: 0,
  };
}

function addEvent(target: UnitBreakdown, event: UnitEvent): void {
  target.netUnits += event.units;
  switch (event.kind) {
    case "ORDERED":
      target.orderedUnits += event.units;
      break;
    case "ADDED":
      target.addedUnits += event.units;
      break;
    case "REFUNDED":
      target.refundedUnits += -event.units;
      break;
    case "REMOVED":
      target.removedUnits += -event.units;
      break;
    case "RETURNED_UNCLASSIFIED":
      target.returnedUnclassifiedUnits += -event.units;
      break;
  }
  if (event.revenue == null) target.eventsWithoutRevenue += 1;
  else target.revenue = target.revenue.plus(event.revenue);
}

export type VariantDailySales = UnitBreakdown & {
  variantGid: string;
  localDate: LocalDate;
};

/** Per variant per shop-local day, sorted by variant then date. */
export function aggregateDaily(events: readonly UnitEvent[]): VariantDailySales[] {
  const buckets = new Map<string, VariantDailySales>();
  for (const event of events) {
    const key = `${event.variantGid}\u0000${event.localDate}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        variantGid: event.variantGid,
        localDate: event.localDate,
        ...emptyBreakdown(),
      };
      buckets.set(key, bucket);
    }
    addEvent(bucket, event);
  }
  return [...buckets.values()].sort((a, b) =>
    a.variantGid === b.variantGid
      ? a.localDate.localeCompare(b.localDate)
      : a.variantGid < b.variantGid
        ? -1
        : 1,
  );
}

export type VariantWindowSales = UnitBreakdown & {
  variantGid: string;
  /** Product of the variant; a variant GID never moves between products. */
  productGid: string | null;
  /** Orders in which the variant's net units are positive within the window. */
  distinctOrders: number;
  firstSaleDate: LocalDate | null;
  lastSaleDate: LocalDate | null;
};

export type LocalWindow = { startLocalDate: LocalDate; endLocalDate: LocalDate };

/**
 * Per-variant totals over `[startLocalDate, endLocalDate]` (inclusive), or over
 * every event when no window is given. Distinct orders are counted from order
 * identities, never by summing daily counts.
 */
export function aggregateVariantWindow(
  events: readonly UnitEvent[],
  window?: LocalWindow,
): VariantWindowSales[] {
  const totals = new Map<string, VariantWindowSales>();
  const orderUnits = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (
      window &&
      (event.localDate < window.startLocalDate || event.localDate > window.endLocalDate)
    ) {
      continue;
    }
    let total = totals.get(event.variantGid);
    if (!total) {
      total = {
        variantGid: event.variantGid,
        productGid: event.productGid,
        distinctOrders: 0,
        firstSaleDate: null,
        lastSaleDate: null,
        ...emptyBreakdown(),
      };
      totals.set(event.variantGid, total);
      orderUnits.set(event.variantGid, new Map());
    }
    addEvent(total, event);
    if (total.productGid == null) total.productGid = event.productGid;
    if (event.kind === "ORDERED" || event.kind === "ADDED") {
      if (total.firstSaleDate == null || event.localDate < total.firstSaleDate) {
        total.firstSaleDate = event.localDate;
      }
      if (total.lastSaleDate == null || event.localDate > total.lastSaleDate) {
        total.lastSaleDate = event.localDate;
      }
    }
    const perOrder = orderUnits.get(event.variantGid) as Map<string, number>;
    perOrder.set(event.orderGid, (perOrder.get(event.orderGid) ?? 0) + event.units);
  }
  for (const [variantGid, perOrder] of orderUnits) {
    let count = 0;
    for (const units of perOrder.values()) if (units > 0) count += 1;
    (totals.get(variantGid) as VariantWindowSales).distinctOrders = count;
  }
  return [...totals.values()].sort((a, b) =>
    a.variantGid < b.variantGid ? -1 : a.variantGid > b.variantGid ? 1 : 0,
  );
}
