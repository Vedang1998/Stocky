import { describe, expect, it } from "vitest";
import { classifyAbcParity } from "../analytics/abc-parity";
import type { AbcParityRun } from "../analytics/abc-parity.server";
import { Decimal } from "../analytics/money";
import {
  CANCELLED_ORDERS_POLICY,
  NET_REVENUE_POLICY,
  NET_UNITS_POLICY,
  emptyNetUnitsDiagnostics,
} from "../analytics/net-units";
import type { SalesHistoryCoverage } from "../analytics/sales-history.server";
import { buildAbcReport } from "./abc-report";
import { tablePage } from "./present";
import {
  catalogVariant,
  cellsByColumn,
  coverage,
  variantGid,
} from "./test-fixtures";

const AS_OF = "2026-11-09";

function run(
  overrides: {
    coverage?: Partial<SalesHistoryCoverage>;
    revenueOutsideCatalog?: string;
  } = {},
): AbcParityRun {
  const variants = [
    catalogVariant(1, { productTitle: "Trail Shoe" }),
    catalogVariant(2, { productTitle: "Laces", vendor: "Contoso" }),
    catalogVariant(3, { productTitle: "Insole" }),
    catalogVariant(4, {
      productTitle: "New Sock",
      createdLocalDate: "2026-11-01",
    }),
  ];
  const history = coverage(overrides.coverage);
  const sold: Array<[string, number]> = [
    ["850.00", 17],
    ["100.00", 20],
    ["50.00", 5],
    ["75.00", 3],
  ];
  return {
    ...classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: history.historyStartLocalDate,
      candidates: variants.map((variant, index) => ({
        variantGid: variant.variantGid,
        createdLocalDate: variant.createdLocalDate,
        revenue: new Decimal(sold[index][0]),
        netUnits: sold[index][1],
      })),
    }),
    asOfLocalDate: AS_OF,
    timeZone: "America/New_York",
    currencyCode: "USD",
    computedAt: new Date("2026-11-10T17:00:00Z"),
    policies: {
      netUnits: NET_UNITS_POLICY,
      cancelledOrders: CANCELLED_ORDERS_POLICY,
      revenue: NET_REVENUE_POLICY,
    },
    catalog: new Map(variants.map((variant) => [variant.variantGid, variant])),
    revenueOutsideCatalog: new Decimal(overrides.revenueOutsideCatalog ?? "0"),
    salesDiagnostics: emptyNetUnitsDiagnostics(),
    coverage: history,
  };
}

const VIEW = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};

describe("buildAbcReport", () => {
  it("lists graded variants in rank order with their shares, then the ungraded", () => {
    const data = buildAbcReport(run());
    const rows = data.rows.map((row) => cellsByColumn(data, row));

    expect(
      rows.map((r) => [
        r.product,
        r.grade,
        r.rank,
        r.revenueShare,
        r.cumulativeShare,
      ]),
    ).toEqual([
      ["Trail Shoe", "A", 1, "0.85", "0.85"],
      ["Laces", "B", 2, "0.10", "0.95"],
      ["Insole", "C", 3, "0.05", "1.00"],
      ["New Sock", "U", null, null, null],
    ]);
    expect(rows[3].ungradedReason).toBe("Created less than 56 days ago");
    expect(rows[0].ungradedReason).toBeNull();
    expect(data.notices).toEqual([]);
    expect(data.methodNotes[0]).toContain("2026-09-15 to 2026-11-09");
  });

  it("counts variants and revenue per grade for the rows on screen", () => {
    const data = buildAbcReport(run());
    const all = tablePage(data, VIEW, "USD").tiles;
    expect(all.map((tile) => [tile.label, tile.value, tile.detail])).toEqual([
      ["Grade A", "1 variant", "$850.00 net revenue"],
      ["Grade B", "1 variant", "$100.00 net revenue"],
      ["Grade C", "1 variant", "$50.00 net revenue"],
      ["Ungraded (U)", "1 variant", "$75.00 net revenue"],
    ]);
    const contoso = tablePage(
      data,
      { ...VIEW, facets: { vendor: "Contoso" } },
      "USD",
    );
    expect(contoso.tiles.map((tile) => tile.value)).toEqual([
      "0 variants",
      "1 variant",
      "0 variants",
      "0 variants",
    ]);
  });

  it("explains a catalog that cannot be graded yet", () => {
    const data = buildAbcReport(
      run({
        coverage: {
          historyStartLocalDate: "2026-10-20",
          startsBeforeCoverage: true,
        },
      }),
    );
    expect(data.rows.every((row) => row.abc.abcClass === "U")).toBe(true);
    expect(data.notices.map((notice) => notice.heading)).toEqual([
      "Not enough order history to grade your catalog yet",
    ]);
    expect(data.notices[0].body).toContain("2026-10-20");
  });

  it("tells an unsynced shop apart and reports revenue from deleted variants", () => {
    const unsynced = buildAbcReport(
      run({
        coverage: { historyStartLocalDate: null, startsBeforeCoverage: true },
      }),
    );
    expect(unsynced.notices[0].heading).toBe("No orders have been synced yet");

    const deleted = buildAbcReport(run({ revenueOutsideCatalog: "12.5" }));
    expect(deleted.notices.map((notice) => notice.body)).toEqual([
      expect.stringContaining("$12.50 of net revenue"),
    ]);
    expect(
      deleted.rows.some((row) => row.info.variantGid === variantGid(9)),
    ).toBe(false);
  });
});
