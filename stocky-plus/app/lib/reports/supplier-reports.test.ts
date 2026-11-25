import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type { PurchaseOrderFact } from "../analytics/purchase-orders.server";
import type { LocalDate } from "../analytics/shop-calendar";
import type { ReportViewRequest } from "./params";
import { tablePage } from "./present";
import { buildSuppliersReport } from "./supplier-reports";
import { cellsByColumn } from "./test-fixtures";
import type { ReportData } from "./types";

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};
const TODAY = "2026-11-19" as LocalDate;

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
    receivedUnits: 0,
    remainingUnits: 10,
    merchandiseAmount: new Decimal("100.00"),
    taxAmount: new Decimal("0.00"),
    chargesAmount: new Decimal("0.00"),
    totalAmount: new Decimal("100.00"),
    lines: [],
    ...overrides,
  };
}

function received(id: string, receivedAt: string, expectedOn: string | null) {
  return order(id, {
    status: "RECEIVED",
    receivedUnits: 10,
    remainingUnits: 0,
    fullyReceivedAt: new Date(receivedAt),
    expectedOn: expectedOn ? new Date(expectedOn) : null,
  });
}

function build(orders: PurchaseOrderFact[]) {
  return buildSuppliersReport({
    orders,
    timeZone: "America/New_York",
    currencyCode: "USD",
    today: TODAY,
  });
}

function bySupplier<Row>(data: ReportData<Row>) {
  return new Map(
    data.rows.map((row) => [data.rowKey(row), cellsByColumn(data, row)]),
  );
}

describe("buildSuppliersReport", () => {
  it("rolls orders up per supplier", () => {
    const rows = bySupplier(
      build([
        order("a", { receivedUnits: 4, remainingUnits: 6 }),
        order("b"),
        order("c", { supplierId: "s2", supplierName: "Beta" }),
      ]),
    );
    expect(rows.get("s1")).toMatchObject({
      supplier: "Acme",
      orders: 2,
      unitsOrdered: 20,
      unitsReceived: 4,
      spend: "200.00",
      overdue: 2,
    });
    expect(rows.get("s1")?.fillRate).toBe("0.20");
    expect(rows.get("s2")).toMatchObject({ orders: 1, spend: "100.00" });
  });

  it("leaves drafts and cancelled orders out, and drops a supplier with only those", () => {
    const rows = bySupplier(
      build([
        order("a"),
        order("d", { status: "DRAFT" }),
        order("x", {
          supplierId: "s2",
          supplierName: "Beta",
          status: "CANCELLED",
        }),
      ]),
    );
    expect([...rows.keys()]).toEqual(["s1"]);
    expect(rows.get("s1")?.orders).toBe(1);
  });

  it("measures days to receive and on-time delivery in the shop time zone", () => {
    const rows = bySupplier(
      build([
        // created Nov 3 (NY), received Nov 8: 5 days, expected Nov 10: on time
        received("a", "2026-11-08T15:00:00Z", "2026-11-10T00:00:00Z"),
        // received Nov 14: 11 days, expected Nov 10: late
        received("b", "2026-11-14T15:00:00Z", "2026-11-10T00:00:00Z"),
        // no expected date: counts for days, not for on time
        received("c", "2026-11-05T15:00:00Z", null),
      ]),
    );
    const row = rows.get("s1");
    expect(row?.receivedOrders).toBe(3);
    expect(row?.daysToReceive).toBe(6);
    expect(row?.onTime).toBe("0.50");
  });

  it("counts a delivery on the expected day as on time", () => {
    const rows = bySupplier(
      build([received("a", "2026-11-10T20:00:00Z", "2026-11-10T00:00:00Z")]),
    );
    expect(rows.get("s1")?.onTime).toBe("1.00");
  });

  it("leaves delivery figures blank until an order is fully received", () => {
    const row = bySupplier(build([order("a")])).get("s1");
    expect(row).toMatchObject({ daysToReceive: null, onTime: null });
  });

  it("blanks spend and warns when an order cannot be converted", () => {
    const data = build([
      order("a"),
      order("b", { currency: "EUR", exchangeRate: null }),
      order("c", { supplierId: "s2", supplierName: "Beta" }),
    ]);
    const rows = bySupplier(data);
    expect(rows.get("s1")?.spend).toBeNull();
    expect(rows.get("s2")?.spend).toBe("100.00");
    expect(data.notices).toHaveLength(1);
    const tiles = tablePage(data, VIEW, "USD").tiles;
    expect(tiles.find((t) => t.label === "Spend")?.detail).toBe(
      "Without 1 supplier that cannot be converted",
    );
  });

  it("converts a foreign order at its saved rate", () => {
    const rows = bySupplier(
      build([
        order("a", { currency: "EUR", exchangeRate: new Decimal("1.2") }),
      ]),
    );
    expect(rows.get("s1")?.spend).toBe("120.00");
  });
});
