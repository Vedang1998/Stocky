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

  it("classifies missing", () => {
    expect(classifyIndex(entry, { status: "missing" })).toBe("missing");
  });

  it("classifies valid exact", () => {
    const inspected: InspectedIndex = {
      status: "present",
      valid: true,
      ready: true,
      unique: false,
      table: "Supplier",
      columns: ["shopId"],
      definition: 'CREATE INDEX "Supplier_shopId_idx" ON public."Supplier" USING btree ("shopId")',
      definitionNormalized: entry.expectedDefNormalized,
      indisvalid: true,
      indisready: true,
    };
    expect(classifyIndex(entry, inspected)).toBe("valid_exact");
  });
});
