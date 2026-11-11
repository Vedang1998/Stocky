import { describe, expect, it } from "vitest";
import { Decimal } from "../analytics/money";
import type { ReportViewRequest } from "./params";
import {
  FACET_NONE,
  REPORT_PAGE_SIZE,
  exportCell,
  exportHeader,
  exportTable,
  facetChoices,
  filterRows,
  formatCell,
  formatShopInstant,
  resolveSort,
  sortRows,
  tablePage,
} from "./present";
import type { ReportData } from "./types";

type Row = {
  id: string;
  name: string;
  vendor: string | null;
  units: number | null;
  revenue: Decimal | null;
  day: string | null;
};

function row(id: string, values: Partial<Row> = {}): Row {
  return {
    id,
    name: id,
    vendor: "Northwind",
    units: 1,
    revenue: new Decimal(1),
    day: null,
    ...values,
  };
}

function report(rows: Row[]): ReportData<Row> {
  return {
    columns: [
      { key: "name", label: "Name", kind: "text", value: (r) => r.name },
      { key: "vendor", label: "Vendor", kind: "text", value: (r) => r.vendor },
      { key: "units", label: "Units", kind: "integer", value: (r) => r.units },
      {
        key: "revenue",
        label: "Revenue",
        kind: "money",
        value: (r) => r.revenue,
      },
      { key: "day", label: "Day", kind: "date", value: (r) => r.day },
    ],
    rows,
    rowKey: (r) => r.id,
    defaultSort: { key: "units", direction: "desc" },
    facets: [{ key: "vendor", label: "Vendor", value: (r) => r.vendor }],
    searchKeys: ["name", "vendor"],
    summarize: (shown) => [
      {
        label: "Units",
        value: String(shown.reduce((n, r) => n + (r.units ?? 0), 0)),
      },
    ],
    notices: [],
    methodNotes: [],
    dataAsOf: null,
  };
}

const VIEW: ReportViewRequest = {
  search: "",
  facets: {},
  sortKey: null,
  sortDirection: null,
  page: 1,
};

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("sortRows", () => {
  const data = report([]);

  it("sorts numbers by value and keeps blanks last in both directions", () => {
    const rows = [
      row("a", { units: 5 }),
      row("b", { units: null }),
      row("c", { units: 12 }),
      row("d", { units: -3 }),
    ];
    expect(
      ids(sortRows(data, rows, { key: "units", direction: "asc" })),
    ).toEqual(["d", "a", "c", "b"]);
    expect(
      ids(sortRows(data, rows, { key: "units", direction: "desc" })),
    ).toEqual(["c", "a", "d", "b"]);
  });

  it("compares money as decimals, not strings or floats", () => {
    const rows = [
      row("a", { revenue: new Decimal("9.99") }),
      row("b", { revenue: new Decimal("100.00") }),
      row("c", { revenue: new Decimal("0.1").plus("0.2") }),
      row("d", { revenue: new Decimal("0.3") }),
    ];
    expect(
      ids(sortRows(data, rows, { key: "revenue", direction: "desc" })),
    ).toEqual(["b", "a", "c", "d"]);
  });

  it("sorts text naturally and without regard to case", () => {
    const rows = [
      row("a", { name: "Size 10" }),
      row("b", { name: "size 9" }),
      row("c", { name: "Size 2" }),
    ];
    expect(
      ids(sortRows(data, rows, { key: "name", direction: "asc" })),
    ).toEqual(["c", "b", "a"]);
  });

  it("breaks ties by row key so paging is stable", () => {
    const rows = [row("c"), row("a"), row("b")];
    expect(
      ids(sortRows(data, rows, { key: "units", direction: "desc" })),
    ).toEqual(["a", "b", "c"]);
    expect(
      ids(sortRows(data, rows, { key: "units", direction: "asc" })),
    ).toEqual(["a", "b", "c"]);
  });

  it("leaves the order alone for an unknown column and never mutates its input", () => {
    const rows = [row("b"), row("a")];
    expect(
      ids(sortRows(data, rows, { key: "nope", direction: "asc" })),
    ).toEqual(["b", "a"]);
    sortRows(data, rows, { key: "name", direction: "asc" });
    expect(ids(rows)).toEqual(["b", "a"]);
  });
});

describe("resolveSort", () => {
  const data = report([]);

  it("uses the report default unless the requested column exists", () => {
    expect(resolveSort(data, { sortKey: null, sortDirection: "asc" })).toEqual(
      data.defaultSort,
    );
    expect(
      resolveSort(data, { sortKey: "constructor", sortDirection: "asc" }),
    ).toEqual(data.defaultSort);
    expect(
      resolveSort(data, { sortKey: "name", sortDirection: "asc" }),
    ).toEqual({
      key: "name",
      direction: "asc",
    });
    expect(resolveSort(data, { sortKey: "name", sortDirection: null })).toEqual(
      {
        key: "name",
        direction: "desc",
      },
    );
  });
});

describe("filterRows and facetChoices", () => {
  const rows = [
    row("a", { name: "Trail Shoe", vendor: "Northwind" }),
    row("b", { name: "Road Shoe", vendor: "Contoso" }),
    row("c", { name: "Laces", vendor: null }),
    row("d", { name: "Insole", vendor: "" }),
  ];
  const data = report(rows);

  it("filters by an exact facet value", () => {
    expect(
      ids(
        filterRows(data, rows, { search: "", facets: { vendor: "Contoso" } }),
      ),
    ).toEqual(["b"]);
    expect(
      filterRows(data, rows, { search: "", facets: { vendor: "contoso" } }),
    ).toEqual([]);
  });

  it("offers and applies a choice for rows with no value", () => {
    expect(facetChoices(data.facets[0], rows)).toEqual([
      { value: "Contoso", label: "Contoso" },
      { value: "Northwind", label: "Northwind" },
      { value: FACET_NONE, label: "None" },
    ]);
    expect(
      ids(
        filterRows(data, rows, { search: "", facets: { vendor: FACET_NONE } }),
      ),
    ).toEqual(["c", "d"]);
  });

  it("searches the report's search columns without regard to case", () => {
    expect(ids(filterRows(data, rows, { search: "SHOE", facets: {} }))).toEqual(
      ["a", "b"],
    );
    expect(
      ids(filterRows(data, rows, { search: "north", facets: {} })),
    ).toEqual(["a"]);
    // Units are not a search column.
    expect(filterRows(data, rows, { search: "1", facets: {} })).toEqual([]);
  });

  it("combines facets and search", () => {
    expect(
      ids(
        filterRows(data, rows, {
          search: "shoe",
          facets: { vendor: "Northwind" },
        }),
      ),
    ).toEqual(["a"]);
  });
});

describe("formatCell and exportCell", () => {
  it("formats each kind for the screen", () => {
    expect(formatCell("integer", 12345, "USD")).toBe("12,345");
    expect(formatCell("integer", -3, "USD")).toBe("-3");
    expect(formatCell("money", new Decimal("1234.5"), "USD")).toBe("$1,234.50");
    expect(formatCell("money", new Decimal("1234.5"), "JPY")).toBe("¥1,235");
    expect(formatCell("percent", new Decimal("0.12345"), "USD")).toBe("12.35%");
    expect(formatCell("date", "2026-11-09", "USD")).toBe("2026-11-09");
    expect(formatCell("text", "Trail Shoe", "USD")).toBe("Trail Shoe");
  });

  it("shows a dash for a missing value, never zero", () => {
    expect(formatCell("money", null, "USD")).toBe("—");
    expect(formatCell("integer", null, "USD")).toBe("—");
    expect(formatCell("text", "", "USD")).toBe("—");
    expect(formatCell("integer", 0, "USD")).toBe("0");
  });

  it("exports plain values a spreadsheet reads as numbers", () => {
    expect(exportCell("integer", 12345, "USD")).toBe(12345);
    expect(exportCell("money", new Decimal("1234.5"), "USD")).toBe("1234.50");
    expect(exportCell("money", new Decimal("-0.005"), "USD")).toBe("-0.01");
    expect(exportCell("percent", new Decimal("0.12345"), "USD")).toBe("12.35");
    expect(exportCell("text", "Trail Shoe", "USD")).toBe("Trail Shoe");
    expect(exportCell("money", null, "USD")).toBeNull();
    expect(exportCell("text", "", "USD")).toBeNull();
  });

  it("names the unit in the export header", () => {
    expect(exportHeader({ label: "Revenue", kind: "money" }, "USD")).toBe(
      "Revenue (USD)",
    );
    expect(exportHeader({ label: "Share", kind: "percent" }, "USD")).toBe(
      "Share (%)",
    );
    expect(exportHeader({ label: "Units", kind: "integer" }, "USD")).toBe(
      "Units",
    );
  });
});

describe("tablePage", () => {
  const rows = Array.from({ length: 120 }, (_, i) =>
    row(`r${String(i).padStart(3, "0")}`, {
      units: i,
      vendor: i % 2 === 0 ? "Even" : "Odd",
    }),
  );
  const data = report(rows);

  it("returns one formatted page in the default order", () => {
    const page = tablePage(data, VIEW, "USD");
    expect(page).toMatchObject({
      totalRows: 120,
      filteredRows: 120,
      page: 1,
      pageCount: 3,
      pageSize: REPORT_PAGE_SIZE,
      sort: { key: "units", direction: "desc" },
    });
    expect(page.rows).toHaveLength(50);
    expect(page.rows[0]).toEqual({
      key: "r119",
      cells: ["r119", "Odd", "119", "$1.00", "—"],
    });
  });

  it("clamps a page past the end to the last page", () => {
    const page = tablePage(data, { ...VIEW, page: 99 }, "USD");
    expect(page.page).toBe(3);
    expect(page.rows).toHaveLength(20);
    expect(page.rows.at(-1)?.key).toBe("r000");
  });

  it("summarizes every filtered row, not just the page on screen", () => {
    const page = tablePage(
      data,
      { ...VIEW, facets: { vendor: "Even" } },
      "USD",
    );
    expect(page.filteredRows).toBe(60);
    expect(page.pageCount).toBe(2);
    // 0 + 2 + ... + 118
    expect(page.tiles).toEqual([{ label: "Units", value: "3540" }]);
  });

  it("reports an empty result as a single empty page", () => {
    expect(
      tablePage(data, { ...VIEW, search: "nothing" }, "USD"),
    ).toMatchObject({
      rows: [],
      filteredRows: 0,
      page: 1,
      pageCount: 1,
    });
  });
});

describe("exportTable", () => {
  const rows = [
    row("a", { units: 2, revenue: new Decimal("19.999"), vendor: "Northwind" }),
    row("b", { units: 7, revenue: null, vendor: "Contoso" }),
    row("c", { units: 5, revenue: new Decimal("5"), vendor: "Northwind" }),
  ];
  const data = report(rows);

  it("exports every filtered row in the on-screen order", () => {
    expect(
      exportTable(
        data,
        {
          ...VIEW,
          facets: { vendor: "Northwind" },
          sortKey: "units",
          sortDirection: "desc",
        },
        "USD",
      ),
    ).toEqual({
      headers: ["Name", "Vendor", "Units", "Revenue (USD)", "Day"],
      rows: [
        ["c", "Northwind", 5, "5.00", null],
        ["a", "Northwind", 2, "20.00", null],
      ],
      truncated: false,
    });
  });

  it("flags an export cut short by the row limit", () => {
    const cut = exportTable(data, VIEW, "USD", 2);
    expect(cut.rows.map((r) => r[0])).toEqual(["b", "c"]);
    expect(cut.truncated).toBe(true);
    expect(exportTable(data, VIEW, "USD", 3).truncated).toBe(false);
  });
});

describe("formatShopInstant", () => {
  it("shows the shop's wall-clock time with its zone", () => {
    const instant = new Date("2026-11-09T02:30:00Z");
    expect(formatShopInstant(instant, "America/New_York")).toBe(
      "Nov 8, 2026, 9:30 PM EST",
    );
    expect(formatShopInstant(instant, "Asia/Tokyo")).toBe(
      "Nov 9, 2026, 11:30 AM GMT+9",
    );
  });
});
