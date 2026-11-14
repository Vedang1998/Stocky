import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type { ReportViewRequest } from "./params";
import { tablePage } from "./present";
import { buildProfitReport } from "./profit-report";
import {
  catalogVariant,
  cellsByColumn,
  salesHistory,
  salesInput,
  unitEvent,
  variantGid,
} from "./test-fixtures";

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};

function tiles(
  data: ReturnType<typeof buildProfitReport>,
  view: Partial<ReportViewRequest> = {},
) {
  return Object.fromEntries(
    tablePage(data, { ...VIEW, ...view }, "USD").tiles.map((tile) => [
      tile.label,
      tile,
    ]),
  );
}

function rowsByKey(data: ReturnType<typeof buildProfitReport>) {
  return new Map(
    data.rows.map((row) => [data.rowKey(row), cellsByColumn(data, row)]),
  );
}

/**
 * - variant 1: 5 ordered and 1 refunded at $10, cost $8
 * - variant 2: 2 at $40, no cost in Shopify
 * - variant 3: 3 at $20, cost $25, so it sells at a loss
 */
function scenario() {
  const history = salesHistory({
    events: [
      unitEvent({ variant: 1, order: 1, localDate: "2026-11-01", units: 5 }),
      unitEvent({
        variant: 1,
        order: 1,
        localDate: "2026-11-01",
        kind: "REFUNDED",
        units: -1,
      }),
      unitEvent({
        variant: 2,
        order: 2,
        localDate: "2026-11-02",
        units: 2,
        unitPrice: "40.00",
      }),
      unitEvent({
        variant: 3,
        order: 3,
        localDate: "2026-11-02",
        units: 3,
        unitPrice: "20.00",
      }),
    ],
  });
  return salesInput(history, [
    catalogVariant(1, { vendor: "Northwind" }),
    catalogVariant(2, {
      vendor: "Northwind",
      unitCost: null,
      unitCostCurrencyCode: null,
      unitCostAccess: "ABSENT",
    }),
    catalogVariant(3, { vendor: "Contoso", unitCost: new Decimal("25.00") }),
  ]);
}

describe("buildProfitReport", () => {
  it("subtracts today's cost of the net units from net revenue", () => {
    const rows = rowsByKey(buildProfitReport(scenario()));

    expect(rows.get(variantGid(1))).toMatchObject({
      netUnits: 4,
      revenue: "40.00",
      unitCost: "8.00",
      cost: "32.00",
      profit: "8.00",
      margin: "0.20",
    });
  });

  it("shows a loss as a negative profit and margin", () => {
    const rows = rowsByKey(buildProfitReport(scenario()));

    expect(rows.get(variantGid(3))).toMatchObject({
      revenue: "60.00",
      cost: "75.00",
      profit: "-15.00",
      margin: "-0.25",
    });
  });

  it("leaves cost and profit blank for a variant without a cost and says so", () => {
    const data = buildProfitReport(scenario());

    expect(rowsByKey(data).get(variantGid(2))).toMatchObject({
      revenue: "80.00",
      unitCost: null,
      cost: null,
      profit: null,
      margin: null,
    });
    expect(data.notices.map((notice) => notice.heading)).toEqual([
      "1 variant sold has no cost",
    ]);
  });

  it("totals profit and margin over the variants that have a cost", () => {
    const totals = tiles(buildProfitReport(scenario()));

    expect(totals["Net revenue"].value).toBe("$180.00");
    expect(totals["Estimated cost of goods"].value).toBe("$107.00");
    // Variants 1 and 3 only: (40 + 60) revenue, (8 − 15) profit.
    expect(totals["Estimated gross profit"]).toMatchObject({
      value: "-$7.00",
      detail: "From 2 variants of 3",
    });
    expect(totals["Margin"]).toMatchObject({
      value: "-7.00%",
      detail: "From 2 variants of 3",
    });
  });

  it("drops the partial-coverage note when every row on screen has a cost", () => {
    const totals = tiles(buildProfitReport(scenario()), {
      facets: { vendor: "Contoso" },
    });

    expect(totals["Estimated gross profit"]).toEqual({
      label: "Estimated gross profit",
      value: "-$15.00",
      detail: undefined,
    });
    expect(totals["Margin"].value).toBe("-25.00%");
  });

  it("ignores a cost recorded in another currency", () => {
    const input = salesInput(
      salesHistory({
        events: [
          unitEvent({
            variant: 1,
            order: 1,
            localDate: "2026-11-01",
            units: 1,
          }),
        ],
      }),
      [catalogVariant(1, { unitCostCurrencyCode: "EUR" })],
    );

    const [row] = buildProfitReport(input).rows;
    expect(row.unitCost).toBeNull();
    expect(row.profit).toBeNull();
  });

  it("has no cost for a variant that is no longer in the catalog", () => {
    const input = salesInput(
      salesHistory({
        events: [
          unitEvent({
            variant: 9,
            order: 1,
            localDate: "2026-11-01",
            units: 1,
          }),
        ],
      }),
      [],
    );

    const [row] = buildProfitReport(input).rows;
    expect(row.info.inCatalog).toBe(false);
    expect(row.cost).toBeNull();
  });

  it("keeps the cost but not the profit when a sale has no price", () => {
    const input = salesInput(
      salesHistory({
        events: [
          unitEvent({
            variant: 1,
            order: 1,
            localDate: "2026-11-01",
            units: 1,
          }),
          unitEvent({
            variant: 1,
            order: 2,
            localDate: "2026-11-01",
            units: 1,
            unitPrice: null,
          }),
        ],
      }),
      [catalogVariant(1)],
    );

    const [row] = buildProfitReport(input).rows;
    expect(row.cost?.toFixed(2)).toBe("16.00");
    expect(row.profit).toBeNull();
    expect(row.margin).toBeNull();
  });

  it("shows a dash for the margin when nothing on screen has revenue", () => {
    const input = salesInput(salesHistory({ events: [] }), []);

    expect(tiles(buildProfitReport(input))["Margin"].value).toBe("—");
  });
});
