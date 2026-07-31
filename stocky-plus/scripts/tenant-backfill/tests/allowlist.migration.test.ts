import { describe, expect, it } from "vitest";
import { assertApprovedTable } from "../tables";

describe("tenant backfill SQL allowlist", () => {
  it("assertApprovedTable rejects unknown tables before SQL", () => {
    expect(() => assertApprovedTable("Evil")).toThrow(
      /Table not approved for tenant backfill SQL: Evil/,
    );
  });
});
