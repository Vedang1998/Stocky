import { describe, expect, it } from "vitest";
import { classifyIndex } from "../classify";
import type { InspectedIndex } from "../inspect";
import { normalizeIndexDef } from "../manifest";

describe("classifyIndex", () => {
  const entry = {
    name: "Supplier_shopId_idx",
    table: "Supplier",
    unique: false,
    columns: ["shopId"],
    purpose: "direct_ownership" as const,
    expectedDefNormalized: normalizeIndexDef(
      'CREATE INDEX "Supplier_shopId_idx" ON public."Supplier" USING btree ("shopId")',
    ),
  };

  const basePresent = (): Extract<InspectedIndex, { status: "present" }> => ({
    status: "present",
    valid: true,
    ready: true,
    unique: false,
    table: "Supplier",
    columns: ["shopId"],
    definition:
      'CREATE INDEX "Supplier_shopId_idx" ON public."Supplier" USING btree ("shopId")',
    definitionNormalized: entry.expectedDefNormalized,
    indisvalid: true,
    indisready: true,
  });

  it("classifies missing", () => {
    expect(classifyIndex(entry, { status: "missing" })).toBe("missing");
  });

  it("classifies valid exact", () => {
    expect(classifyIndex(entry, basePresent())).toBe("valid_exact");
  });

  it("classifies invalid", () => {
    expect(
      classifyIndex(entry, {
        ...basePresent(),
        indisvalid: false,
        valid: false,
      }),
    ).toBe("invalid");
  });

  it("classifies wrong_table", () => {
    expect(
      classifyIndex(entry, { ...basePresent(), table: "ShopSettings" }),
    ).toBe("wrong_table");
  });

  it("classifies wrong_uniqueness", () => {
    expect(classifyIndex(entry, { ...basePresent(), unique: true })).toBe(
      "wrong_uniqueness",
    );
  });

  it("classifies wrong ordered columns as wrong_definition", () => {
    expect(
      classifyIndex(entry, {
        ...basePresent(),
        columns: ["name"],
        definitionNormalized: normalizeIndexDef(
          'CREATE INDEX "Supplier_shopId_idx" ON public."Supplier" USING btree ("name")',
        ),
      }),
    ).toBe("wrong_definition");
  });

  it("classifies same name with wrong definition", () => {
    expect(
      classifyIndex(entry, {
        ...basePresent(),
        definitionNormalized: "create index totally_wrong",
      }),
    ).toBe("wrong_definition");
  });
});
