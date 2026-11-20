import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type {
  HistoricalStockLevel,
  StockDayTotals,
  StockSnapshotDay,
} from "../analytics/stock-history.server";
import type { LocalDate } from "../analytics/shop-calendar";
import type { ReportViewRequest } from "./params";
import { exportTable, tablePage } from "./present";
import {
  buildStockHistoryReport,
  buildStockOnDateReport,
  type StockOnDateInput,
} from "./stock-history-reports";
import {
  catalogVariant,
  cellsByColumn,
  locationGid,
  variantGid,
} from "./test-fixtures";
import { buildVariantDirectory } from "./variant-directory";

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};
const TIME_ZONE = "America/New_York";

function snapshot(
  localDate: LocalDate,
  levelCount: number,
  overrides: Partial<StockSnapshotDay> = {},
): StockSnapshotDay {
  return {
    localDate,
    timeZone: TIME_ZONE,
    capturedAt: new Date(`${localDate}T06:00:00Z`),
    levelCount,
    ...overrides,
  };
}

describe("buildStockHistoryReport", () => {
  const input = {
    start: "2026-11-04",
    end: "2026-11-08",
    snapshots: [snapshot("2026-11-04", 2), snapshot("2026-11-06", 0)],
    totals: [
      { localDate: "2026-11-04", onHand: 10, unreportedLevels: 1 },
    ] as StockDayTotals[],
    firstCapturedDate: "2026-11-04",
    timeZone: TIME_ZONE,
  } as const;

  it("has one row for every day in the range, captured or not", () => {
    const report = buildStockHistoryReport(input);
    const rows = report.rows.map((row) => cellsByColumn(report, row));

    expect(rows.map((row) => row.date)).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(rows.map((row) => row.status)).toEqual([
      "Captured",
      "Not captured",
      "Captured",
      "Not captured",
      "Not captured",
    ]);
  });

  it("leaves a day that was not captured blank and never zero", () => {
    const report = buildStockHistoryReport(input);
    const missing = cellsByColumn(report, report.rows[1]!);

    expect(missing).toMatchObject({
      onHand: null,
      levelCount: null,
      unreported: null,
      capturedAt: null,
    });
    const file = exportTable(report, VIEW, "USD");
    const onHand = file.headers.indexOf("Units on hand");
    expect(
      file.rows.find((row) => row[0] === "2026-11-05")?.[onHand],
    ).toBeNull();
  });

  it("counts a captured day with no tracked stock as zero units", () => {
    const report = buildStockHistoryReport(input);

    expect(cellsByColumn(report, report.rows[2]!)).toMatchObject({
      status: "Captured",
      onHand: 0,
      levelCount: 0,
    });
  });

  it("sums the quantities Shopify reported and counts the ones it did not", () => {
    const report = buildStockHistoryReport(input);

    expect(cellsByColumn(report, report.rows[0]!)).toMatchObject({
      onHand: 10,
      levelCount: 2,
      unreported: 1,
    });
    expect(report.notices.map((n) => n.heading)).toContain(
      "1 saved stock level has no quantity",
    );
  });

  it("says how many days were not captured and where history starts", () => {
    const report = buildStockHistoryReport({ ...input, start: "2026-11-01" });
    const notice = report.notices.find((n) =>
      n.heading.includes("not captured"),
    );

    expect(notice).toMatchObject({
      tone: "warning",
      heading: "6 days were not captured",
    });
    expect(notice?.body).toContain("The first saved day is 2026-11-04");
  });

  it("explains an empty history instead of listing a range of zeros", () => {
    const report = buildStockHistoryReport({
      ...input,
      snapshots: [],
      totals: [],
      firstCapturedDate: null,
    });

    expect(report.notices.map((n) => n.heading)).toEqual([
      "No stock history has been saved yet",
    ]);
    expect(report.rows.every((row) => !row.captured)).toBe(true);
    expect(report.dataAsOf).toBeNull();
  });

  it("summarizes the days on screen and ends with the latest captured day", () => {
    const report = buildStockHistoryReport(input);
    const tiles = Object.fromEntries(
      tablePage(report, VIEW, "USD").tiles.map((t) => [t.label, t.value]),
    );

    expect(tiles).toMatchObject({
      "Days shown": "5",
      "Days captured": "2",
      "Days not captured": "3",
      "Units on hand, latest day": "0",
    });
    expect(report.dataAsOf).toEqual(new Date("2026-11-06T06:00:00Z"));
  });
});

function level(
  n: number,
  onHand: number | null,
  overrides: Partial<HistoricalStockLevel> = {},
): HistoricalStockLevel {
  return {
    variantGid: variantGid(n),
    locationGid: locationGid(1),
    available: onHand,
    onHand,
    unitCost: new Decimal("4.00"),
    unitCostCurrencyCode: "USD",
    price: new Decimal("10.00"),
    priceCurrencyCode: "USD",
    ...overrides,
  };
}

function onDate(overrides: Partial<StockOnDateInput> = {}): StockOnDateInput {
  return {
    date: "2026-11-06",
    today: "2026-11-10",
    snapshot: snapshot("2026-11-06", 3),
    firstCapturedDate: "2026-11-04",
    levels: [level(1, 7), level(2, 0), level(3, null)],
    directory: buildVariantDirectory(
      new Map([
        [variantGid(1), catalogVariant(1, { productTitle: "Trail Shoe" })],
        [variantGid(3), catalogVariant(3, { productTitle: "Boot" })],
      ]),
    ),
    locations: [{ locationGid: locationGid(1), name: "Main", isActive: true }],
    currencyCode: "USD",
    timeZone: TIME_ZONE,
    ...overrides,
  };
}

describe("buildStockOnDateReport", () => {
  it("values the day's stock at the cost and price saved that day", () => {
    const report = buildStockOnDateReport(
      onDate({
        // Today's catalog cost is $8.00; the day's was $4.00.
        levels: [level(1, 7)],
      }),
    );

    expect(cellsByColumn(report, report.rows[0]!)).toMatchObject({
      product: "Trail Shoe",
      location: "Main",
      onHand: 7,
      unitCost: "4.00",
      costValue: "28.00",
      retailValue: "70.00",
    });
  });

  it("leaves out rows at exactly zero and keeps rows with no quantity blank", () => {
    const report = buildStockOnDateReport(onDate());
    const rows = report.rows.map((row) => cellsByColumn(report, row));

    expect(rows.map((row) => row.product)).toEqual(["Trail Shoe", "Boot"]);
    expect(rows[1]).toMatchObject({ onHand: null, costValue: null });
    expect(report.notices.map((n) => n.heading)).toContain(
      "1 stock level had no quantity",
    );
  });

  it("does not value a cost or price in another currency", () => {
    const report = buildStockOnDateReport(
      onDate({
        levels: [
          level(1, 5, {
            unitCostCurrencyCode: "EUR",
            priceCurrencyCode: "EUR",
          }),
        ],
      }),
    );

    expect(cellsByColumn(report, report.rows[0]!)).toMatchObject({
      unitCost: null,
      costValue: null,
      price: null,
      retailValue: null,
    });
    expect(report.notices.map((n) => n.heading)).toContain(
      "1 variant with stock has no cost",
    );
  });

  it("shows a deleted variant by its ID rather than hiding the day's stock", () => {
    const report = buildStockOnDateReport(onDate({ levels: [level(9, 3)] }));

    expect(cellsByColumn(report, report.rows[0]!).product).toBe(
      "Deleted variant 9",
    );
  });

  it("totals the rows on screen", () => {
    const report = buildStockOnDateReport(
      onDate({ levels: [level(1, 7), level(3, 3)] }),
    );
    const tiles = Object.fromEntries(
      tablePage(report, VIEW, "USD").tiles.map((t) => [t.label, t.value]),
    );

    expect(tiles).toMatchObject({
      "Units on hand": "10",
      "Cost value": "$40.00",
      "Retail value": "$100.00",
      Variants: "2",
    });
  });

  it("shows no rows and says so when the day was not captured", () => {
    const report = buildStockOnDateReport(
      onDate({ snapshot: null, levels: [] }),
    );

    expect(report.rows).toEqual([]);
    expect(report.notices).toEqual([
      expect.objectContaining({
        tone: "warning",
        heading: "Stock was not captured on 2026-11-06",
      }),
    ]);
    expect(report.dataAsOf).toBeNull();
  });

  it("does not substitute another day when the day is before the first saved one", () => {
    const report = buildStockOnDateReport(
      onDate({ date: "2026-11-01", snapshot: null, levels: [] }),
    );

    expect(report.notices[0]?.body).toContain(
      "The first saved day is 2026-11-04",
    );
  });

  it("says a day that has not ended cannot be shown yet", () => {
    const report = buildStockOnDateReport(
      onDate({ date: "2026-11-10", snapshot: null, levels: [] }),
    );

    expect(report.notices[0]).toMatchObject({
      tone: "info",
      heading: "2026-11-10 has not ended yet",
    });
  });

  it("says a day with no tracked stock was saved and is empty", () => {
    const report = buildStockOnDateReport(
      onDate({ snapshot: snapshot("2026-11-06", 0), levels: [] }),
    );

    expect(report.rows).toEqual([]);
    expect(report.notices.map((n) => n.heading)).toEqual([
      "No tracked stock on 2026-11-06",
    ]);
  });

  it("notes that the shop's time zone has changed since the day was saved", () => {
    const report = buildStockOnDateReport(
      onDate({
        snapshot: snapshot("2026-11-06", 3, { timeZone: "Europe/London" }),
      }),
    );

    expect(report.notices.map((n) => n.heading)).toContain(
      "Time zone changed since this day was saved",
    );
  });

  it("exports the rows as plain values", () => {
    const file = exportTable(
      buildStockOnDateReport(onDate({ levels: [level(1, 7)] })),
      VIEW,
      "USD",
    );
    const column = (name: string) => file.headers.indexOf(name);

    expect(file.rows[0]?.[column("On hand")]).toBe(7);
    expect(file.rows[0]?.[column("Cost value (USD)")]).toBe("28.00");
  });
});
