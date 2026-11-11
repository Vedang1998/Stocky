import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type {
  StocktakeLine,
  TransferLine,
} from "../analytics/stock-documents.server";
import type { StockLocation } from "../analytics/stock-levels.server";
import type { ReportViewRequest } from "./params";
import { tablePage } from "./present";
import {
  buildStocktakeVarianceReport,
  buildTransfersReport,
} from "./stock-document-reports";
import {
  catalogVariant,
  cellsByColumn,
  locationGid,
  variantGid,
} from "./test-fixtures";
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

const LOCATIONS: StockLocation[] = [
  { locationGid: locationGid(1), name: "Main warehouse", isActive: true },
  { locationGid: locationGid(2), name: "Downtown store", isActive: true },
];

const VARIANTS = [
  catalogVariant(1, { productTitle: "Trail Shoe", variantTitle: "Size 9" }),
  catalogVariant(2, {
    productTitle: "Laces",
    unitCost: null,
    unitCostCurrencyCode: null,
    unitCostAccess: "ABSENT",
  }),
  catalogVariant(3, {
    productTitle: "Insole",
    unitCost: new Decimal("2.50"),
  }),
];
const CATALOG = new Map(
  VARIANTS.map((variant) => [variant.variantGid, variant]),
);
const DIRECTORY = buildVariantDirectory(CATALOG);

function tiles<Row>(
  data: ReportData<Row>,
  view: Partial<ReportViewRequest> = {},
) {
  return Object.fromEntries(
    tablePage(data, { ...VIEW, ...view }, "USD").tiles.map((tile) => [
      tile.label,
      tile.value,
    ]),
  );
}

function rowsByKey<Row>(data: ReportData<Row>) {
  return new Map(
    data.rows.map((row) => [data.rowKey(row), cellsByColumn(data, row)]),
  );
}

function transferLine(
  lineId: string,
  overrides: Partial<TransferLine> = {},
): TransferLine {
  return {
    lineId,
    transferId: "transfer-1",
    status: "DRAFT",
    sourceLocationGid: locationGid(1),
    destinationLocationGid: locationGid(2),
    createdAt: new Date("2026-11-03T15:00:00Z"),
    shippedAt: null,
    receivedAt: null,
    variantGid: variantGid(1),
    quantity: 10,
    pickedQty: 0,
    receivedQty: 0,
    ...overrides,
  };
}

describe("buildTransfersReport", () => {
  function report(lines: TransferLine[]) {
    return buildTransfersReport({
      lines,
      directory: DIRECTORY,
      locations: LOCATIONS,
      timeZone: TIME_ZONE,
    });
  }

  it("names the route, the status and the variant of each line", () => {
    const rows = rowsByKey(report([transferLine("a")]));

    expect(rows.get("a")).toMatchObject({
      created: "2026-11-03",
      from: "Main warehouse",
      to: "Downtown store",
      status: "Draft",
      product: "Trail Shoe",
      variant: "Size 9",
      requested: 10,
    });
  });

  it("leaves shipped and received blank on a draft", () => {
    const rows = rowsByKey(report([transferLine("a", { pickedQty: 4 })]));

    expect(rows.get("a")).toMatchObject({
      shipped: null,
      received: null,
      inTransit: 0,
      shippedDate: null,
      receivedDate: null,
    });
  });

  it("counts the picked quantity as shipped and in transit until received", () => {
    const rows = rowsByKey(
      report([
        transferLine("a", {
          status: "IN_TRANSIT",
          pickedQty: 8,
          shippedAt: new Date("2026-11-04T16:00:00Z"),
        }),
      ]),
    );

    expect(rows.get("a")).toMatchObject({
      status: "In transit",
      shipped: 8,
      received: null,
      inTransit: 8,
      shippedDate: "2026-11-04",
    });
  });

  it("ships the whole requested quantity when nothing was picked", () => {
    const [row] = report([transferLine("a", { status: "IN_TRANSIT" })]).rows;

    expect(row.shippedUnits).toBe(10);
  });

  it("moves received units out of transit", () => {
    const rows = rowsByKey(
      report([
        transferLine("a", {
          status: "RECEIVED",
          pickedQty: 8,
          receivedQty: 8,
          shippedAt: new Date("2026-11-04T16:00:00Z"),
          receivedAt: new Date("2026-11-06T16:00:00Z"),
        }),
      ]),
    );

    expect(rows.get("a")).toMatchObject({
      status: "Received",
      shipped: 8,
      received: 8,
      inTransit: 0,
      receivedDate: "2026-11-06",
    });
  });

  it("dates a transfer by the shop's day, not the UTC day", () => {
    // 03:30 UTC on the 4th is still the evening of the 3rd in New York.
    const [row] = report([
      transferLine("a", { createdAt: new Date("2026-11-04T03:30:00Z") }),
    ]).rows;

    expect(row.createdDate).toBe("2026-11-03");
  });

  it("totals units by stage and counts each transfer once", () => {
    const data = report([
      transferLine("a", { status: "RECEIVED", pickedQty: 8, receivedQty: 8 }),
      transferLine("b", {
        status: "RECEIVED",
        variantGid: variantGid(2),
        quantity: 5,
        receivedQty: 5,
      }),
      transferLine("c", {
        transferId: "transfer-2",
        status: "IN_TRANSIT",
        quantity: 6,
      }),
      transferLine("d", {
        transferId: "transfer-3",
        status: "CANCELLED",
        quantity: 3,
      }),
    ]);

    expect(tiles(data)).toEqual({
      Transfers: "3",
      "Units requested": "24",
      "Units shipped": "19",
      "Units received": "13",
      "Units in transit": "6",
    });
    expect(tiles(data, { facets: { status: "In transit" } })).toMatchObject({
      Transfers: "1",
      "Units in transit": "6",
    });
  });

  it("still lists a line whose location or variant is gone", () => {
    const [row] = report([
      transferLine("a", {
        sourceLocationGid: locationGid(9),
        variantGid: variantGid(404),
      }),
    ]).rows;

    expect(row.from).toBe("Unknown location");
    expect(row.info.product).toBe("Deleted variant 404");
  });
});

function stocktakeLine(
  lineId: string,
  overrides: Partial<StocktakeLine> = {},
): StocktakeLine {
  return {
    lineId,
    stocktakeId: "count-1",
    stocktakeName: "November count",
    locationGid: locationGid(1),
    completedAt: new Date("2026-11-05T21:00:00Z"),
    variantGid: variantGid(1),
    expectedQty: 10,
    countedQty: 10,
    ...overrides,
  };
}

describe("buildStocktakeVarianceReport", () => {
  function report(lines: StocktakeLine[], view = "variances") {
    return buildStocktakeVarianceReport({
      lines,
      catalog: CATALOG,
      directory: DIRECTORY,
      locations: LOCATIONS,
      timeZone: TIME_ZONE,
      currencyCode: "USD",
      view,
    });
  }

  it("values a shortage at today's cost as a negative amount", () => {
    const rows = rowsByKey(report([stocktakeLine("a", { countedQty: 7 })]));

    expect(rows.get("a")).toMatchObject({
      completed: "2026-11-05",
      stocktake: "November count",
      location: "Main warehouse",
      product: "Trail Shoe",
      expected: 10,
      counted: 7,
      variance: -3,
      unitCost: "8.00",
      varianceValue: "-24.00",
    });
  });

  it("values a surplus as a positive amount", () => {
    const [row] = report([
      stocktakeLine("a", { variantGid: variantGid(3), countedQty: 14 }),
    ]).rows;

    expect(row.variance).toBe(4);
    expect(row.varianceValue?.toFixed(2)).toBe("10.00");
  });

  it("hides lines that matched unless every counted line is asked for", () => {
    const lines = [
      stocktakeLine("match"),
      stocktakeLine("short", { variantGid: variantGid(3), countedQty: 9 }),
    ];

    expect(report(lines).rows.map((row) => row.line.lineId)).toEqual(["short"]);
    expect(report(lines, "all").rows.map((row) => row.line.lineId)).toEqual([
      "match",
      "short",
    ]);
  });

  it("treats a count of zero as a count, not as a missing one", () => {
    const data = report([stocktakeLine("a", { countedQty: 0 })]);

    expect(data.rows[0].variance).toBe(-10);
    expect(data.notices).toEqual([]);
  });

  it("leaves out lines that were never counted and says how many", () => {
    const data = report(
      [
        stocktakeLine("a", { countedQty: null }),
        stocktakeLine("b", { variantGid: variantGid(3), countedQty: null }),
        stocktakeLine("c", { countedQty: 12 }),
      ],
      "all",
    );

    expect(data.rows.map((row) => row.line.lineId)).toEqual(["c"]);
    expect(data.notices.map((notice) => notice.heading)).toEqual([
      "2 lines were never counted",
    ]);
  });

  it("leaves the value blank for a variant without a cost and warns once per variant", () => {
    const data = report([
      stocktakeLine("a", { variantGid: variantGid(2), countedQty: 8 }),
      stocktakeLine("b", {
        stocktakeId: "count-2",
        variantGid: variantGid(2),
        countedQty: 12,
      }),
    ]);

    expect(data.rows.map((row) => row.varianceValue)).toEqual([null, null]);
    expect(data.notices.map((notice) => notice.heading)).toEqual([
      "1 variant with a variance has no cost",
    ]);
  });

  it("totals overs and shorts separately and nets their value", () => {
    const data = report([
      stocktakeLine("a", { countedQty: 7 }),
      stocktakeLine("b", { variantGid: variantGid(3), countedQty: 14 }),
      stocktakeLine("c", {
        stocktakeId: "count-2",
        stocktakeName: "Spot check",
        locationGid: locationGid(2),
        variantGid: variantGid(2),
        countedQty: 11,
      }),
    ]);

    expect(tiles(data)).toEqual({
      Stocktakes: "2",
      "Units over": "5",
      "Units short": "3",
      "Net variance value": "-$14.00",
    });
    expect(tiles(data, { facets: { location: "Downtown store" } })).toEqual({
      Stocktakes: "1",
      "Units over": "1",
      "Units short": "0",
      "Net variance value": "$0.00",
    });
  });
});
