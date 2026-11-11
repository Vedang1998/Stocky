import { describe, expect, it } from "vitest";
import { parseWorksheetView, worksheetViewSearch, type WorksheetView } from "./view";

const DEFAULT_VIEW: WorksheetView = {
  show: "ALL",
  query: "",
  sort: { key: "product", direction: "asc" },
  page: 1,
  pageSize: 50,
};

describe("parseWorksheetView", () => {
  it("gives the default view for an empty URL", () => {
    expect(parseWorksheetView(new URLSearchParams())).toEqual(DEFAULT_VIEW);
  });

  it("reads every part of a view", () => {
    const search = new URLSearchParams(
      "show=TO_ORDER&q=+merlot+&sort=daysOfStock&dir=desc&page=3&perPage=100",
    );
    expect(parseWorksheetView(search)).toEqual({
      show: "TO_ORDER",
      query: "merlot",
      sort: { key: "daysOfStock", direction: "desc" },
      page: 3,
      pageSize: 100,
    });
  });

  it("falls back to the default for anything it does not recognise", () => {
    const search = new URLSearchParams(
      "show=NOPE&sort=price;drop&dir=sideways&page=-2&perPage=5000",
    );
    expect(parseWorksheetView(search)).toEqual(DEFAULT_VIEW);
  });

  it("sorts quantities largest first unless told otherwise", () => {
    expect(parseWorksheetView(new URLSearchParams("sort=order")).sort).toEqual({
      key: "order",
      direction: "desc",
    });
    expect(parseWorksheetView(new URLSearchParams("sort=order&dir=asc")).sort).toEqual({
      key: "order",
      direction: "asc",
    });
  });

  it("caps the search text", () => {
    const view = parseWorksheetView(new URLSearchParams({ q: "x".repeat(500) }));
    expect(view.query).toHaveLength(100);
  });

  it.each(["1.5", "abc", "0", "1e3", "-2", "9007199254740993"])(
    "treats page %s as the first page",
    (page) => {
      expect(parseWorksheetView(new URLSearchParams({ page })).page).toBe(1);
    },
  );
});

describe("worksheetViewSearch", () => {
  const view: WorksheetView = {
    show: "LOW_STOCK",
    query: "merlot",
    sort: { key: "available", direction: "asc" },
    page: 4,
    pageSize: 25,
  };

  it("round-trips a view", () => {
    expect(parseWorksheetView(worksheetViewSearch(view))).toEqual(view);
  });

  it("writes nothing for the default view", () => {
    expect(worksheetViewSearch(DEFAULT_VIEW).toString()).toBe("");
  });

  it("moves to another page without touching the rest", () => {
    expect(parseWorksheetView(worksheetViewSearch(view, { page: 5 }))).toEqual({
      ...view,
      page: 5,
    });
  });

  it.each([
    ["the filter", { show: "ALL" as const }],
    ["the search", { query: "" }],
    ["the page size", { pageSize: 100 }],
    ["the sort", { sortKey: "sku" as const }],
  ])("returns to page 1 when %s changes", (_name, changes) => {
    expect(parseWorksheetView(worksheetViewSearch(view, changes)).page).toBe(1);
  });

  it("reverses the direction when the current column is chosen again", () => {
    const search = worksheetViewSearch(view, { sortKey: "available" });
    expect(parseWorksheetView(search).sort).toEqual({ key: "available", direction: "desc" });
  });

  it("starts a newly chosen column in its natural direction", () => {
    const search = worksheetViewSearch(view, { sortKey: "suggested" });
    expect(parseWorksheetView(search).sort).toEqual({ key: "suggested", direction: "desc" });
  });
});
