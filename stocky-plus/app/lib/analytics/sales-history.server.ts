/**
 * Tenant-scoped loader for dated variant unit events over a shop-local range.
 *
 * Reads only canonical PR6 order facts through `TenantDb` and hands them to
 * `deriveUnitEvents`. Two sources can produce events inside the range:
 *
 * 1. Orders processed inside the range: every eligible sale, with refunds and
 *    removals restated to the order's date (so they always land in range) and
 *    later additions dated by their agreement (kept only if inside the range).
 * 2. Orders processed before or after the range whose later edit/exchange
 *    agreements happened inside it: only their ADDED units can land in range.
 *
 * Only `LIVE` facts are read at every level. Both scans page by keyset over an
 * indexed timestamp, so a page costs the same however long the range is.
 *
 * Shop-wide grain only: Shopify exposes no stable per-line sale location (Q-014).
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { toDecimalOrNull, type Decimal } from "./money";
import {
  CANCELLED_ORDERS_POLICY,
  NET_REVENUE_POLICY,
  NET_UNITS_POLICY,
  aggregateDaily,
  deriveUnitEvents,
  emptyNetUnitsDiagnostics,
  mergeNetUnitsDiagnostics,
  type NetUnitsDiagnostics,
  type SalesAgreementInput,
  type SalesLineInput,
  type SalesOrderInput,
  type SalesSaleInput,
  type UnitEvent,
  type UnitEventKind,
  type VariantDailySales,
} from "./net-units";
import { ORDER_HISTORY_WINDOW_DAYS } from "../order-facts/apply/constants";
import {
  addLocalDays,
  isWithinLocalRange,
  localDateOf,
  localRangeToUtc,
  requireShopTimeZone,
  type LocalDate,
} from "./shop-calendar";

/** Orders per child-fact query; keeps `IN (...)` lists bounded. */
export const SALES_HISTORY_ORDER_BATCH = 500;

export type SalesHistoryInput = {
  startLocalDate: LocalDate;
  /** Inclusive. */
  endLocalDate: LocalDate;
  timeZone: string | null;
  /** Shop currency (`Shop.currencyCode`); null reports units without revenue. */
  reportCurrency: string | null;
  /** Restrict events to these variants. */
  variantGids?: readonly string[];
  /** First install (`Shop.createdAt`); widens coverage by the import window. */
  installedAt?: Date | null;
  /** Orders per page; defaults to `SALES_HISTORY_ORDER_BATCH`. */
  orderBatchSize?: number;
};

export type SalesHistoryCoverage = {
  /** Earliest non-test stored order, as a shop-local date. */
  earliestOrderLocalDate: LocalDate | null;
  latestOrderLocalDate: LocalDate | null;
  /**
   * First shop-local date the stored facts can speak for: the earlier of the
   * first stored order and the start of Shopify's default order-history window
   * at install (`ORDER_HISTORY_WINDOW_DAYS` before first install). Null when no
   * order facts are stored yet.
   */
  historyStartLocalDate: LocalDate | null;
  /**
   * True when the requested range starts before `historyStartLocalDate`, so
   * missing history must not be read as zero sales.
   */
  startsBeforeCoverage: boolean;
  /** Most recent Shopify-side order change the stored facts reflect. */
  latestOrderChangeAt: Date | null;
};

/** The order behind a unit event, for order-level reports. */
export type SalesOrderSummary = {
  orderGid: string;
  /** Shopify order name, such as `#1001`. */
  name: string;
  processedAt: Date;
  localDate: LocalDate;
};

/** What a line was sold as, which can differ from today's catalog. */
export type SaleLineDescriptor = {
  lineGid: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  vendor: string | null;
};

export type SalesHistory = {
  policies: {
    netUnits: typeof NET_UNITS_POLICY;
    cancelledOrders: typeof CANCELLED_ORDERS_POLICY;
    revenue: typeof NET_REVENUE_POLICY;
  };
  startLocalDate: LocalDate;
  endLocalDate: LocalDate;
  timeZone: string;
  reportCurrency: string | null;
  events: UnitEvent[];
  daily: VariantDailySales[];
  /** Every order with at least one returned event, by order GID. */
  orders: Map<string, SalesOrderSummary>;
  /** Every line with at least one returned event, by line GID. */
  lines: Map<string, SaleLineDescriptor>;
  diagnostics: NetUnitsDiagnostics;
  coverage: SalesHistoryCoverage;
};

const LIVE = "LIVE";
const ADDED_ONLY: ReadonlySet<UnitEventKind> = new Set(["ADDED"]);
/** Sale rows per page when looking for later additions. */
const LATE_SALE_PAGE = 5000;

type Cursor = { at: Date; id: string };

/**
 * Keyset predicate over `(timestamp, id)` for `[startUtc, endUtcExclusive)`:
 * everything strictly after `cursor` in that order.
 */
function afterCursor(
  field: "processedAt" | "happenedAt",
  startUtc: Date,
  endUtcExclusive: Date,
  cursor: Cursor | null,
): Record<string, unknown> {
  if (!cursor) return { [field]: { gte: startUtc, lt: endUtcExclusive } };
  return {
    [field]: { gte: cursor.at, lt: endUtcExclusive },
    NOT: { [field]: cursor.at, id: { lte: cursor.id } },
  };
}

type OrderRow = {
  id: string;
  shopifyGid: string;
  name: string;
  processedAt: Date | null;
  test: boolean;
  cancelledAt: Date | null;
  unitDiagnosticState: string | null;
};

const ORDER_SELECT = {
  id: true,
  shopifyGid: true,
  name: true,
  processedAt: true,
  test: true,
  cancelledAt: true,
  unitDiagnosticState: true,
} as const;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toOrderInput(row: OrderRow): SalesOrderInput {
  return {
    orderGid: row.shopifyGid,
    processedAt: row.processedAt,
    test: row.test,
    cancelledAt: row.cancelledAt,
    unitDiagnosticState: row.unitDiagnosticState,
  };
}

type LineRow = {
  shopifyGid: string;
  shopifyOrderGid: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  vendor: string | null;
  variantGidAtSale: string | null;
  productGidAtSale: string | null;
  isGiftCard: boolean;
  orderShopCurrencyCode: string;
  discountedUnitPriceAfterAllDiscountsShopAmount: Decimal | null;
  discountedUnitPriceAfterAllDiscountsShopCurrencyCode: string | null;
  unitDiagnosticState: string | null;
};

type AgreementRow = {
  shopifyGid: string;
  shopifyOrderGid: string;
  reason: string | null;
  happenedAt: Date;
};

type SaleRow = {
  shopifyGid: string;
  shopifyAgreementGid: string;
  shopifyOrderGid: string;
  shopifyLineItemGid: string | null;
  lineType: string | null;
  actionType: string | null;
  saleTypename: string;
  quantity: number | null;
};

async function loadOrderChildren(
  db: TenantDb,
  orderGids: readonly string[],
): Promise<{
  lines: SalesLineInput[];
  agreements: SalesAgreementInput[];
  sales: SalesSaleInput[];
  descriptors: SaleLineDescriptor[];
}> {
  const where = { existenceState: LIVE, shopifyOrderGid: { in: [...orderGids] } };
  const [lineRows, agreementRows, saleRows]: [LineRow[], AgreementRow[], SaleRow[]] =
    await Promise.all([
      db.shopifyOrderLineFact.findMany({
        where,
        select: {
          shopifyGid: true,
          shopifyOrderGid: true,
          title: true,
          variantTitle: true,
          sku: true,
          vendor: true,
          variantGidAtSale: true,
          productGidAtSale: true,
          isGiftCard: true,
          orderShopCurrencyCode: true,
          discountedUnitPriceAfterAllDiscountsShopAmount: true,
          discountedUnitPriceAfterAllDiscountsShopCurrencyCode: true,
          unitDiagnosticState: true,
        },
      }),
      db.shopifyOrderAgreementFact.findMany({
        where,
        select: {
          shopifyGid: true,
          shopifyOrderGid: true,
          reason: true,
          happenedAt: true,
        },
      }),
      db.shopifyOrderAgreementSaleFact.findMany({
        where,
        select: {
          shopifyGid: true,
          shopifyAgreementGid: true,
          shopifyOrderGid: true,
          shopifyLineItemGid: true,
          lineType: true,
          actionType: true,
          saleTypename: true,
          quantity: true,
        },
      }),
    ]);

  return {
    lines: lineRows.map((row) => ({
      lineGid: row.shopifyGid,
      orderGid: row.shopifyOrderGid,
      variantGidAtSale: row.variantGidAtSale,
      productGidAtSale: row.productGidAtSale,
      isGiftCard: row.isGiftCard,
      orderShopCurrencyCode: row.orderShopCurrencyCode,
      unitPriceAfterDiscounts: toDecimalOrNull(
        row.discountedUnitPriceAfterAllDiscountsShopAmount,
      ),
      unitPriceCurrencyCode:
        row.discountedUnitPriceAfterAllDiscountsShopCurrencyCode,
      unitDiagnosticState: row.unitDiagnosticState,
    })),
    agreements: agreementRows.map((row) => ({
      agreementGid: row.shopifyGid,
      orderGid: row.shopifyOrderGid,
      reason: row.reason,
      happenedAt: row.happenedAt,
    })),
    sales: saleRows.map((row) => ({
      saleGid: row.shopifyGid,
      agreementGid: row.shopifyAgreementGid,
      orderGid: row.shopifyOrderGid,
      lineItemGid: row.shopifyLineItemGid,
      lineType: row.lineType,
      actionType: row.actionType,
      saleTypename: row.saleTypename,
      quantity: row.quantity,
    })),
    descriptors: lineRows.map((row) => ({
      lineGid: row.shopifyGid,
      title: row.title,
      variantTitle: row.variantTitle,
      sku: row.sku,
      vendor: row.vendor,
    })),
  };
}

/**
 * How far back the stored order facts reach, judged against `startLocalDate`.
 * `timeZone` must already be validated.
 */
export async function loadSalesCoverage(
  db: TenantDb,
  timeZone: string,
  startLocalDate: LocalDate,
  installedAt: Date | null,
): Promise<SalesHistoryCoverage> {
  const [bounds, freshness] = await Promise.all([
    db.shopifyOrderFact.aggregate({
      where: { test: false, existenceState: LIVE, processedAt: { not: null } },
      _min: { processedAt: true },
      _max: { processedAt: true },
    }),
    db.shopifyOrderFact.aggregate({
      where: { existenceState: LIVE },
      _max: { shopifyUpdatedAt: true },
    }),
  ]);
  const earliest: Date | null = bounds._min.processedAt ?? null;
  const latest: Date | null = bounds._max.processedAt ?? null;
  const earliestOrderLocalDate = earliest ? localDateOf(earliest, timeZone) : null;
  let historyStartLocalDate = earliestOrderLocalDate;
  if (earliestOrderLocalDate != null && installedAt != null) {
    const importWindowStart = addLocalDays(
      localDateOf(installedAt, timeZone),
      -ORDER_HISTORY_WINDOW_DAYS,
    );
    if (importWindowStart < earliestOrderLocalDate) {
      historyStartLocalDate = importWindowStart;
    }
  }
  return {
    earliestOrderLocalDate,
    latestOrderLocalDate: latest ? localDateOf(latest, timeZone) : null,
    historyStartLocalDate,
    startsBeforeCoverage:
      historyStartLocalDate == null || startLocalDate < historyStartLocalDate,
    latestOrderChangeAt: freshness._max.shopifyUpdatedAt ?? null,
  };
}

/**
 * Load unit events and daily rows for `[startLocalDate, endLocalDate]`.
 * Throws `AnalyticsPrerequisiteError` when the shop time zone is unknown and
 * `ShopCalendarError` when the range is invalid; never substitutes UTC.
 */
export async function loadSalesHistory(
  db: TenantDb,
  input: SalesHistoryInput,
): Promise<SalesHistory> {
  const timeZone = requireShopTimeZone(input.timeZone);
  const { startLocalDate, endLocalDate } = input;
  const { startUtc, endUtcExclusive } = localRangeToUtc(
    startLocalDate,
    endLocalDate,
    timeZone,
  );
  const batchSize = input.orderBatchSize ?? SALES_HISTORY_ORDER_BATCH;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError("orderBatchSize must be a positive integer");
  }
  const variantFilter = input.variantGids ? new Set(input.variantGids) : null;
  const inRange = (localDate: LocalDate) =>
    isWithinLocalRange(localDate, startLocalDate, endLocalDate);

  const events: UnitEvent[] = [];
  const orders = new Map<string, SalesOrderSummary>();
  const lines = new Map<string, SaleLineDescriptor>();
  const diagnostics = emptyNetUnitsDiagnostics();
  const keep = (
    batch: UnitEvent[],
    orderRows: readonly OrderRow[],
    descriptors: readonly SaleLineDescriptor[],
  ) => {
    const orderByGid = new Map(orderRows.map((row) => [row.shopifyGid, row]));
    const descriptorByGid = new Map(descriptors.map((d) => [d.lineGid, d]));
    for (const event of batch) {
      if (variantFilter && !variantFilter.has(event.variantGid)) continue;
      events.push(event);
      const order = orderByGid.get(event.orderGid);
      // An event is only derived from an order that has a processedAt.
      if (order?.processedAt && !orders.has(order.shopifyGid)) {
        orders.set(order.shopifyGid, {
          orderGid: order.shopifyGid,
          name: order.name,
          processedAt: order.processedAt,
          localDate: localDateOf(order.processedAt, timeZone),
        });
      }
      const descriptor = descriptorByGid.get(event.lineGid);
      if (descriptor && !lines.has(descriptor.lineGid)) {
        lines.set(descriptor.lineGid, descriptor);
      }
    }
  };

  // 1. Orders processed inside the range.
  const inRangeOrderGids = new Set<string>();
  let orderCursor: Cursor | null = null;
  for (;;) {
    const rows: OrderRow[] = await db.shopifyOrderFact.findMany({
      where: {
        existenceState: LIVE,
        ...afterCursor("processedAt", startUtc, endUtcExclusive, orderCursor),
      },
      select: ORDER_SELECT,
      orderBy: [{ processedAt: "asc" }, { id: "asc" }],
      take: batchSize,
    });
    if (rows.length === 0) break;
    const last = rows[rows.length - 1];
    // The range filter guarantees a processedAt on every row.
    orderCursor = { at: last.processedAt as Date, id: last.id };
    for (const row of rows) inRangeOrderGids.add(row.shopifyGid);

    const { descriptors, ...children } = await loadOrderChildren(
      db,
      rows.map((row) => row.shopifyGid),
    );
    const derived = deriveUnitEvents({
      timeZone,
      reportCurrency: input.reportCurrency,
      orders: rows.map(toOrderInput),
      ...children,
      includeDate: inRange,
    });
    keep(derived.events, rows, descriptors);
    mergeNetUnitsDiagnostics(diagnostics, derived.diagnostics);
    if (rows.length < batchSize) break;
  }

  // 2. Later additions inside the range on orders processed outside it. A
  // sale fact carries its agreement's happenedAt, so ORDER-action sales that
  // happened in range and belong to no in-range order are the candidates.
  const outsideOrderGids = new Set<string>();
  let saleCursor: Cursor | null = null;
  for (;;) {
    const rows: Array<{ id: string; happenedAt: Date; shopifyOrderGid: string }> =
      await db.shopifyOrderAgreementSaleFact.findMany({
        where: {
          existenceState: LIVE,
          actionType: { equals: "ORDER", mode: "insensitive" },
          ...afterCursor("happenedAt", startUtc, endUtcExclusive, saleCursor),
        },
        select: { id: true, happenedAt: true, shopifyOrderGid: true },
        orderBy: [{ happenedAt: "asc" }, { id: "asc" }],
        take: LATE_SALE_PAGE,
      });
    if (rows.length === 0) break;
    const last = rows[rows.length - 1];
    saleCursor = { at: last.happenedAt, id: last.id };
    for (const row of rows) {
      if (!inRangeOrderGids.has(row.shopifyOrderGid)) {
        outsideOrderGids.add(row.shopifyOrderGid);
      }
    }
    if (rows.length < LATE_SALE_PAGE) break;
  }

  for (const batch of chunk([...outsideOrderGids], batchSize)) {
    const rows: OrderRow[] = await db.shopifyOrderFact.findMany({
      where: { existenceState: LIVE, shopifyGid: { in: batch } },
      select: ORDER_SELECT,
    });
    if (rows.length === 0) continue;
    const { descriptors, ...children } = await loadOrderChildren(
      db,
      rows.map((row) => row.shopifyGid),
    );
    const derived = deriveUnitEvents({
      timeZone,
      reportCurrency: input.reportCurrency,
      orders: rows.map(toOrderInput),
      ...children,
      includeDate: inRange,
      includeKinds: ADDED_ONLY,
    });
    keep(derived.events, rows, descriptors);
    // Order-level counters describe the in-range population only; keep the
    // sale/event counters for late additions.
    mergeNetUnitsDiagnostics(diagnostics, {
      ...derived.diagnostics,
      ordersEvaluated: 0,
      ordersExcludedTest: 0,
      ordersExcludedCancelled: 0,
      ordersExcludedSignInconsistent: 0,
      ordersWithoutProcessedAt: 0,
      ordersWithoutLedger: 0,
    });
  }

  events.sort((a, b) =>
    a.localDate === b.localDate
      ? a.saleGid < b.saleGid
        ? -1
        : a.saleGid > b.saleGid
          ? 1
          : 0
      : a.localDate < b.localDate
        ? -1
        : 1,
  );

  return {
    policies: {
      netUnits: NET_UNITS_POLICY,
      cancelledOrders: CANCELLED_ORDERS_POLICY,
      revenue: NET_REVENUE_POLICY,
    },
    startLocalDate,
    endLocalDate,
    timeZone,
    reportCurrency: input.reportCurrency,
    events,
    daily: aggregateDaily(events),
    orders,
    lines,
    diagnostics,
    coverage: await loadSalesCoverage(
      db,
      timeZone,
      startLocalDate,
      input.installedAt ?? null,
    ),
  };
}
