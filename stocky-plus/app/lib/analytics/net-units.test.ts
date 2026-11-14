import { describe, expect, it } from "vitest";
import { Decimal } from "./money";
import {
  aggregateDaily,
  aggregateVariantWindow,
  deriveUnitEvents,
  type SalesAgreementInput,
  type SalesLineInput,
  type SalesOrderInput,
  type SalesSaleInput,
  type UnitEventKind,
} from "./net-units";

const TZ = "America/New_York";
const VARIANT_A = "gid://shopify/ProductVariant/1";
const VARIANT_B = "gid://shopify/ProductVariant/2";
const PRODUCT = "gid://shopify/Product/10";

type Fixture = {
  orders: SalesOrderInput[];
  lines: SalesLineInput[];
  agreements: SalesAgreementInput[];
  sales: SalesSaleInput[];
};

function emptyFixture(): Fixture {
  return { orders: [], lines: [], agreements: [], sales: [] };
}

function addOrder(
  f: Fixture,
  orderGid: string,
  processedAt: string,
  overrides: Partial<SalesOrderInput> = {},
) {
  f.orders.push({
    orderGid,
    processedAt: new Date(processedAt),
    test: false,
    cancelledAt: null,
    unitDiagnosticState: null,
    ...overrides,
  });
}

function addLine(
  f: Fixture,
  lineGid: string,
  orderGid: string,
  overrides: Partial<SalesLineInput> = {},
) {
  f.lines.push({
    lineGid,
    orderGid,
    variantGidAtSale: VARIANT_A,
    productGidAtSale: PRODUCT,
    isGiftCard: false,
    orderShopCurrencyCode: "USD",
    unitPriceAfterDiscounts: new Decimal("10.00"),
    unitPriceCurrencyCode: "USD",
    unitDiagnosticState: null,
    ...overrides,
  });
}

function addAgreement(
  f: Fixture,
  agreementGid: string,
  orderGid: string,
  reason: string | null,
  happenedAt: string,
) {
  f.agreements.push({ agreementGid, orderGid, reason, happenedAt: new Date(happenedAt) });
}

let saleSeq = 0;
function addSale(
  f: Fixture,
  agreementGid: string,
  orderGid: string,
  lineItemGid: string | null,
  actionType: string | null,
  quantity: number | null,
  overrides: Partial<SalesSaleInput> = {},
) {
  saleSeq += 1;
  f.sales.push({
    saleGid: `gid://shopify/Sale/${saleSeq}`,
    agreementGid,
    orderGid,
    lineItemGid,
    lineType: "PRODUCT",
    actionType,
    saleTypename: "ProductSale",
    quantity,
    ...overrides,
  });
}

function derive(f: Fixture, extra: Partial<Parameters<typeof deriveUnitEvents>[0]> = {}) {
  return deriveUnitEvents({ timeZone: TZ, reportCurrency: "USD", ...f, ...extra });
}

function summary(events: ReturnType<typeof derive>["events"]) {
  return events.map((e) => [e.kind, e.units, e.localDate, e.revenue?.toFixed(2) ?? null]);
}

/** A simple order: 3 units of VARIANT_A at 10.00 on the order's own agreement. */
function simpleOrder(f: Fixture, orderGid = "gid://shopify/Order/1") {
  addOrder(f, orderGid, "2026-03-01T04:30:00Z"); // 2026-02-28 in New York
  addLine(f, `${orderGid}/line/1`, orderGid);
  addAgreement(f, `${orderGid}/agr/order`, orderGid, "ORDER", "2026-03-01T04:30:00Z");
  addSale(f, `${orderGid}/agr/order`, orderGid, `${orderGid}/line/1`, "ORDER", 3);
}

describe("deriveUnitEvents — net-units-order-date-v1", () => {
  it("dates original units by order processedAt in the shop zone", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const { events, diagnostics } = derive(f);
    expect(summary(events)).toEqual([["ORDERED", 3, "2026-02-28", "30.00"]]);
    expect(events[0]).toMatchObject({ variantGid: VARIANT_A, productGid: PRODUCT });
    expect(diagnostics.ordersEvaluated).toBe(1);
  });

  it("T47: a refund of one of three units restates the order date as -1, not -2", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addAgreement(f, "agr/refund", order, "REFUND", "2026-04-15T12:00:00Z");
    addSale(f, "agr/refund", order, `${order}/line/1`, "RETURN", -1);
    const { events } = derive(f);
    expect(summary(events)).toEqual([
      ["ORDERED", 3, "2026-02-28", "30.00"],
      ["REFUNDED", -1, "2026-02-28", "-10.00"],
    ]);
    const [window] = aggregateVariantWindow(events);
    expect(window).toMatchObject({
      netUnits: 2,
      orderedUnits: 3,
      refundedUnits: 1,
      removedUnits: 0,
      distinctOrders: 1,
    });
    expect(window.revenue.toFixed(2)).toBe("20.00");
  });

  it("dates edit additions by agreement happenedAt and restates edit removals", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addLine(f, `${order}/line/2`, order, { variantGidAtSale: VARIANT_B });
    addAgreement(f, "agr/edit", order, "ORDER_EDIT", "2026-03-05T15:00:00Z");
    addSale(f, "agr/edit", order, `${order}/line/1`, "RETURN", -1);
    addSale(f, "agr/edit", order, `${order}/line/2`, "ORDER", 2);
    expect(summary(derive(f).events)).toEqual([
      ["ORDERED", 3, "2026-02-28", "30.00"],
      ["REMOVED", -1, "2026-02-28", "-10.00"],
      ["ADDED", 2, "2026-03-05", "20.00"],
    ]);
  });

  it("T58: a mixed exchange agreement is not sign-inconsistent", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addLine(f, `${order}/line/2`, order, { variantGidAtSale: VARIANT_B });
    addAgreement(f, "agr/return", order, "RETURN", "2026-03-10T15:00:00Z");
    addSale(f, "agr/return", order, `${order}/line/1`, "RETURN", -1);
    addSale(f, "agr/return", order, `${order}/line/2`, "ORDER", 1);
    const { events, diagnostics } = derive(f);
    expect(diagnostics.ordersExcludedSignInconsistent).toBe(0);
    expect(events.map((e) => e.kind)).toEqual(["ORDERED", "REFUNDED", "ADDED"]);
  });

  it("ignores UPDATE sales and non-product sales, and counts unusable sales", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    const agr = `${order}/agr/order`;
    addSale(f, agr, order, `${order}/line/1`, "UPDATE", 0);
    addSale(f, agr, order, null, "ORDER", 1, { lineType: "SHIPPING", saleTypename: "ShippingLineSale" });
    addSale(f, agr, order, `${order}/line/1`, "ORDER", 1, { lineType: "TIP", saleTypename: "TipSale" });
    addSale(f, agr, order, `${order}/line/1`, "UNKNOWN", 4);
    addSale(f, agr, order, `${order}/line/1`, "ORDER", null);
    addSale(f, agr, order, "gid://shopify/LineItem/missing", "ORDER", 1);
    const { events, diagnostics } = derive(f);
    expect(summary(events)).toEqual([["ORDERED", 3, "2026-02-28", "30.00"]]);
    expect(diagnostics).toMatchObject({
      salesSkippedUnknownAction: 1,
      salesSkippedNullQuantity: 1,
      salesWithoutLine: 1,
    });
  });

  it("classifies returns on an unknown agreement reason without dropping them", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addAgreement(f, "agr/unknown", order, "UNKNOWN", "2026-03-20T15:00:00Z");
    addSale(f, "agr/unknown", order, `${order}/line/1`, "RETURN", -2);
    const [window] = aggregateVariantWindow(derive(f).events);
    expect(window).toMatchObject({ netUnits: 1, returnedUnclassifiedUnits: 2 });
  });

  it("excludes the whole order on any action/sign contradiction", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addAgreement(f, "agr/refund", order, "REFUND", "2026-03-20T15:00:00Z");
    addSale(f, "agr/refund", order, `${order}/line/1`, "RETURN", 1);
    const { events, diagnostics } = derive(f);
    expect(events).toEqual([]);
    expect(diagnostics.ordersExcludedSignInconsistent).toBe(1);
  });

  it("excludes the whole order on an action outside Shopify's known set", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addSale(f, `${order}/agr/order`, order, `${order}/line/1`, "EXCHANGE_V2", 1);
    const { events, diagnostics } = derive(f);
    expect(events).toEqual([]);
    expect(diagnostics).toMatchObject({
      ordersExcludedSignInconsistent: 1,
      salesSkippedUnknownAction: 0,
    });
  });

  it("honours a stored UNIT_SALE_SIGN_INCONSISTENT diagnostic on the order or a line", () => {
    const onOrder = emptyFixture();
    simpleOrder(onOrder);
    onOrder.orders[0].unitDiagnosticState = "UNIT_SALE_SIGN_INCONSISTENT";
    expect(derive(onOrder).diagnostics.ordersExcludedSignInconsistent).toBe(1);

    const onLine = emptyFixture();
    simpleOrder(onLine);
    onLine.lines[0].unitDiagnosticState = "UNIT_SALE_SIGN_INCONSISTENT";
    expect(derive(onLine).events).toEqual([]);

    const identityOnly = emptyFixture();
    simpleOrder(identityOnly);
    identityOnly.orders[0].unitDiagnosticState = "LINE_UNIT_IDENTITY_INCONSISTENT";
    expect(derive(identityOnly).events).toHaveLength(1);
  });

  it("excludes test orders, cancelled orders and orders without a ledger", () => {
    const f = emptyFixture();
    simpleOrder(f, "gid://shopify/Order/test");
    f.orders[0].test = true;
    simpleOrder(f, "gid://shopify/Order/cancelled");
    f.orders[1].cancelledAt = new Date("2026-03-02T00:00:00Z");
    addOrder(f, "gid://shopify/Order/no-ledger", "2026-03-01T12:00:00Z");
    addOrder(f, "gid://shopify/Order/no-date", "2026-03-01T12:00:00Z", { processedAt: null });
    const { events, diagnostics } = derive(f);
    expect(events).toEqual([]);
    expect(diagnostics).toMatchObject({
      ordersEvaluated: 4,
      ordersExcludedTest: 1,
      ordersExcludedCancelled: 1,
      ordersWithoutLedger: 1,
      ordersWithoutProcessedAt: 1,
    });
  });

  it("excludes gift-card and custom lines from variant demand", () => {
    const f = emptyFixture();
    const order = "gid://shopify/Order/2";
    addOrder(f, order, "2026-03-01T12:00:00Z");
    addLine(f, "line/gift", order, { isGiftCard: true });
    addLine(f, "line/custom", order, { variantGidAtSale: null });
    addAgreement(f, "agr", order, "ORDER", "2026-03-01T12:00:00Z");
    addSale(f, "agr", order, "line/gift", "ORDER", 1);
    addSale(f, "agr", order, "line/custom", "ORDER", 1);
    const { events, diagnostics } = derive(f);
    expect(events).toEqual([]);
    expect(diagnostics.salesExcludedNonVariant).toBe(2);
  });

  it("keeps units but drops revenue for foreign-currency, unpriced or currency-less runs", () => {
    const f = emptyFixture();
    simpleOrder(f);
    f.lines[0].orderShopCurrencyCode = "CAD";
    expect(derive(f).events[0].revenue).toBeNull();

    const unpriced = emptyFixture();
    simpleOrder(unpriced);
    unpriced.lines[0].unitPriceAfterDiscounts = null;
    const result = derive(unpriced);
    expect(result.events[0].units).toBe(3);
    expect(result.events[0].revenue).toBeNull();
    expect(result.diagnostics.eventsWithoutRevenue).toBe(1);

    const noCurrency = emptyFixture();
    simpleOrder(noCurrency);
    expect(derive(noCurrency, { reportCurrency: null }).events[0].revenue).toBeNull();
  });

  it("multiplies prices as decimals without float drift", () => {
    const f = emptyFixture();
    simpleOrder(f);
    f.lines[0].unitPriceAfterDiscounts = new Decimal("0.1");
    f.sales[0].quantity = 3;
    expect(derive(f).events[0].revenue?.toString()).toBe("0.3");
  });

  it("filters by date after restating, and by kind for out-of-range orders", () => {
    const f = emptyFixture();
    simpleOrder(f);
    const order = "gid://shopify/Order/1";
    addAgreement(f, "agr/refund", order, "REFUND", "2026-06-01T12:00:00Z");
    addSale(f, "agr/refund", order, `${order}/line/1`, "RETURN", -1);
    addAgreement(f, "agr/edit", order, "ORDER_EDIT", "2026-03-05T15:00:00Z");
    addSale(f, "agr/edit", order, `${order}/line/1`, "ORDER", 1);

    const february = derive(f, { includeDate: (d) => d <= "2026-02-28" });
    expect(february.events.map((e) => e.kind)).toEqual(["ORDERED", "REFUNDED"]);

    const addedOnly: ReadonlySet<UnitEventKind> = new Set(["ADDED"]);
    const march = derive(f, {
      includeDate: (d) => d >= "2026-03-01",
      includeKinds: addedOnly,
    });
    expect(summary(march.events)).toEqual([["ADDED", 1, "2026-03-05", "10.00"]]);
  });
});

describe("aggregations", () => {
  function twoOrders() {
    const f = emptyFixture();
    simpleOrder(f, "gid://shopify/Order/1");
    simpleOrder(f, "gid://shopify/Order/2");
    f.orders[1].processedAt = new Date("2026-03-02T15:00:00Z");
    // Order 2 is fully refunded.
    addAgreement(f, "agr/refund", "gid://shopify/Order/2", "REFUND", "2026-03-03T15:00:00Z");
    addSale(
      f,
      "agr/refund",
      "gid://shopify/Order/2",
      "gid://shopify/Order/2/line/1",
      "RETURN",
      -3,
    );
    return derive(f).events;
  }

  it("aggregates per variant per shop-local day", () => {
    const daily = aggregateDaily(twoOrders());
    expect(
      daily.map((d) => [d.localDate, d.netUnits, d.orderedUnits, d.refundedUnits, d.revenue.toFixed(2)]),
    ).toEqual([
      ["2026-02-28", 3, 3, 0, "30.00"],
      ["2026-03-02", 0, 3, 3, "0.00"],
    ]);
  });

  it("counts distinct orders with positive net units, not daily sums", () => {
    const [window] = aggregateVariantWindow(twoOrders());
    expect(window).toMatchObject({
      netUnits: 3,
      distinctOrders: 1,
      firstSaleDate: "2026-02-28",
      lastSaleDate: "2026-03-02",
    });
  });

  it("restricts to an inclusive local window", () => {
    const rows = aggregateVariantWindow(twoOrders(), {
      startLocalDate: "2026-03-01",
      endLocalDate: "2026-03-31",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ netUnits: 0, distinctOrders: 0, orderedUnits: 3 });
  });
});
