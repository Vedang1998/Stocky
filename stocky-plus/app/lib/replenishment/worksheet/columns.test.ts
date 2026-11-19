import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSHEET_COLUMNS,
  readWorksheetColumns,
  WORKSHEET_COLUMNS,
  WORKSHEET_COLUMN_LABELS,
} from "./columns";

describe("readWorksheetColumns", () => {
  it("keeps known columns once each, in table order", () => {
    expect(readWorksheetColumns(["daysOfStock", "sku", "sku", "abc"])).toEqual([
      "sku",
      "abc",
      "daysOfStock",
    ]);
  });

  it("drops names it does not know and values that are not names", () => {
    expect(readWorksheetColumns(["sku", "price", 3, null, "SKU"])).toEqual(["sku"]);
  });

  it("reads an empty choice as no optional columns", () => {
    expect(readWorksheetColumns([])).toEqual([]);
  });
});

describe("worksheet columns", () => {
  it("labels every column", () => {
    for (const column of WORKSHEET_COLUMNS) {
      expect(WORKSHEET_COLUMN_LABELS[column]).toBeTruthy();
    }
  });

  it("defaults to known columns in table order", () => {
    expect(readWorksheetColumns(DEFAULT_WORKSHEET_COLUMNS)).toEqual(DEFAULT_WORKSHEET_COLUMNS);
  });

  it("uses the same default in the database as in the app", () => {
    const schema = readFileSync(new URL("../../../../prisma/schema.prisma", import.meta.url), "utf8");
    const match = /worksheetColumns\s+String\[\]\s+@default\(\[([^\]]*)\]\)/.exec(schema);
    expect(match).not.toBeNull();
    const stored = (match?.[1] ?? "").split(",").map((name) => name.trim().replace(/"/g, ""));
    expect(stored).toEqual(DEFAULT_WORKSHEET_COLUMNS);
  });
});
