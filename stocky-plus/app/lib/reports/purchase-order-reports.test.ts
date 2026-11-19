import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type {
  PurchaseOrderFact,
  PurchaseOrderLineFact,
} from "../analytics/purchase-orders.server";
import type { LocalDate } from "../analytics/shop-calendar";
import type { ReportViewRequest } from "./params";
import { tablePage } from "./present";
import {
  buildPurchaseOrderItemsReport,
  buildPurchaseOrdersReport,
} from "./purchase-order-reports";
import { catalogVariant, cellsByColumn, variantGid } from "./test-fixtures";
import type { ReportData } from "./types";
import { buildVariantDirectory } from "./variant-directory";

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};
const TIME_ZONE = "America/New_York";
const TODAY = "2026-11-19" as LocalDate;
const DIRECTORY = buildVariantDirectory(
  new Map([
    [
      variantGid(1),
      catalogVariant(1, { productTitle: "Trail Shoe", variantTitle: "Size 9" }),
    ],
  ]),
);

function line(
  lineId: string,
  overrides: Partial<PurchaseOrderLineFact> = {},
): PurchaseOrderLineFact {
  return {
    lineId,
    variantGid: variantGid(1),
    productTitle: "Old title",
    variantTitle: null,
    sku: null,
    orderedQty: 10,
    cancelledQty: 0,
    receivedQty: 4,
    remainingQty: 6,
    unitCost: new Decimal("5.00"),
    netAmount: new Decimal("50.00"),
    taxAmount: new Decimal("0.00"),
    landedUnitCost: new Decimal("5.50"),
    ...overrides,
  };
}

function order(
  id: string,
  overrides: Partial<PurchaseOrderFact> = {},
): PurchaseOrderFact {
  return {
    id,
    poNumber: `PO-${id}`,
    status: "ORDERED",
    archived: false,
    supplierId: "s1",
    supplierName: "Acme",
    currency: "USD",
    exchangeRate: null,
    createdAt: new Date("2026-11-03T15:00:00Z"),
    expectedOn: new Date("2026-11-10T00:00:00Z"),
    fullyReceivedAt: null,
    orderedUnits: 10,
    receivedUnits: 4,
    remainingUnits: 6,
    merchandiseAmount: new Decimal("50.00"),
    taxAmount: new Decimal("0.00"),
    chargesAmount: new Decimal("5.00"),
    totalAmount: new Decimal("55.00"),
    lines: [line(`${id}-l1`)],
    ...overrides,
  };
}

function tiles<Row>(data: ReportData<Row>) {
  return Object.fromEntries(
    tablePage(data, VIEW, "USD").tiles.map((t) => [t.label, t]),
  );
}

function rowsByKey<Row>(data: ReportData<Row>) {
  return new Map(
    data.rows.map((row) => [data.rowKey(row), cellsByColumn(data, row)]),
  );
}

function report(orders: PurchaseOrderFact[]) {
  return buildPurchaseOrdersReport({
    orders,
    timeZone: TIME_ZONE,
    currencyCode: "USD",
    today: TODAY,
  });
}

describe("buildPurchaseOrdersReport", () => {
  it("shows one row per order with its status, dates and amounts", () => {
    const rows = rowsByKey(report([order("a")]));
    expect(rows.get("a")).toMatchObject({
      created: "2026-11-03",
      po: "PO-a",
      supplier: "Acme",
      status: "Ordered",
      expected: "2026-11-10",
      ordered: 10,
      receivedUnits: 4,
      remaining: 6,
      merchandise: "50.00",
      total: "55.00",
    });
  });

  it("marks an incoming order past its expected date as overdue", () => {
    const rows = rowsByKey(
      report([
        order("late"),
        order("today", { expectedOn: new Date("2026-11-19T00:00:00Z") }),
        order("received", { status: "RECEIVED" }),
        order("archived", { archived: true }),
        order("none", { expectedOn: null }),
      ]),
    );
    expect(rows.get("late")?.overdue).toBe("Yes");
    expect(rows.get("today")?.overdue).toBe("No");
    expect(rows.get("received")?.overdue).toBe("No");
    expect(rows.get("archived")?.overdue).toBe("No");
    expect(rows.get("none")?.overdue).toBe("No");
  });

  it("converts a foreign-currency order with its saved exchange rate", () => {
    const rows = rowsByKey(
      report([
        order("eur", { currency: "EUR", exchangeRate: new Decimal("1.1") }),
      ]),
    );
    expect(rows.get("eur")).toMatchObject({
      merchandise: "55.00",
      total: "60.50",
    });
  });

  it("leaves an unconvertible order blank, says so, and flags the tile", () => {
    const data = report([
      order("a"),
      order("eur", { currency: "EUR", exchangeRate: null }),
    ]);
    expect(rowsByKey(data).get("eur")).toMatchObject({
      merchandise: null,
      total: null,
    });
    expect(data.notices).toHaveLength(1);
    expect(data.notices[0]?.tone).toBe("warning");
    expect(tiles(data)["Value ordered"]?.detail).toBe("From 1 of 2 orders");
  });

  it("counts drafts and cancelled orders in neither value nor units", () => {
    const data = report([
      order("a"),
      order("draft", { status: "DRAFT" }),
      order("cancelled", { status: "CANCELLED" }),
    ]);
    const t = tiles(data);
    expect(t["Purchase orders"]?.value).toBe("3");
    expect(t["Units ordered"]?.value).toBe("10");
    expect(t["Units outstanding"]?.value).toBe("6");
    expect(t["Value ordered"]?.value).toContain("55.00");
    expect(t["Value ordered"]?.detail).toBeUndefined();
  });

  it("leaves archived orders out of units outstanding", () => {
    const t = tiles(report([order("a"), order("old", { archived: true })]));
    expect(t["Units outstanding"]?.value).toBe("6");
  });

  it("is live data", () => {
    expect(report([]).dataAsOf).toBe("live");
  });
});

describe("buildPurchaseOrderItemsReport", () => {
  function items(orders: PurchaseOrderFact[]) {
    return buildPurchaseOrderItemsReport({
      orders,
      directory: DIRECTORY,
      timeZone: TIME_ZONE,
      currencyCode: "USD",
      today: TODAY,
    });
  }

  it("shows one row per line with today's catalog name and costs", () => {
    const rows = rowsByKey(items([order("a")]));
    expect(rows.get("a-l1")).toMatchObject({
      po: "PO-a",
      product: "Trail Shoe",
      variant: "Size 9",
      ordered: 10,
      cancelled: 0,
      receivedUnits: 4,
      remaining: 6,
      unitCost: "5.00",
      landedUnitCost: "5.50",
      netAmount: "50.00",
    });
  });

  it("falls back to the title saved on the line when the variant is gone", () => {
    const gone = line("l2", {
      variantGid: variantGid(99),
      productTitle: "Old Boot",
      variantTitle: "Default Title",
      sku: "BOOT-1",
    });
    const rows = rowsByKey(items([order("b", { lines: [gone] })]));
    expect(rows.get("l2")).toMatchObject({ product: "Old Boot", variant: "" });
  });

  it("subtracts cancelled units from ordered", () => {
    const cancelled = line("l3", {
      orderedQty: 10,
      cancelledQty: 3,
      receivedQty: 0,
      remainingQty: 7,
    });
    const rows = rowsByKey(items([order("c", { lines: [cancelled] })]));
    expect(rows.get("l3")).toMatchObject({
      ordered: 7,
      cancelled: 3,
      remaining: 7,
    });
  });

  it("converts line costs and blanks them when there is no rate", () => {
    const rows = rowsByKey(
      items([
        order("eur", { currency: "EUR", exchangeRate: new Decimal("2") }),
        order("nor", { currency: "EUR", exchangeRate: null }),
      ]),
    );
    expect(rows.get("eur-l1")).toMatchObject({
      unitCost: "10.00",
      netAmount: "100.00",
    });
    expect(rows.get("nor-l1")).toMatchObject({
      unitCost: null,
      netAmount: null,
    });
  });
});
