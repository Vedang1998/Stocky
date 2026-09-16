import { describe, expect, it } from "vitest";
import {
  BULK_B_PRODUCTION_ENABLED,
  ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
} from "../admin-read";
import { assertBulkCRejected } from "./bulk";
import { OrderFactsBulkDisabledError } from "./errors";
import { ORDER_FACTS_BULK_SUBMITTER_MODULE } from "./constants";

describe("PR6-D bulk A/B/C policy", () => {
  it("keeps Bulk B production disabled", () => {
    expect(BULK_B_PRODUCTION_ENABLED).toBe(false);
  });

  it("rejects the illegal Bulk C inner document without submitting", () => {
    expect(() =>
      assertBulkCRejected(ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL),
    ).toThrow(OrderFactsBulkDisabledError);
  });

  it("records the catalog submitter as the only bulkOperationRunQuery transport", () => {
    expect(ORDER_FACTS_BULK_SUBMITTER_MODULE).toBe(
      "app/lib/catalog-facts/ingest/bulk-operation-submitter.ts",
    );
  });
});
