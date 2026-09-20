import { describe, expect, it } from "vitest";
import {
  BULK_B_PRODUCTION_ENABLED,
  ORDER_FACTS_BULK_A_ORDERS_LINES,
  ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
} from "../admin-read";
import { ORDER_FACTS_D_BULK_A_ORDERS_LINES } from "./bulk-a-query";
import { assertBulkCRejected, evaluateOrderFactsBulkAGates } from "./bulk";
import { OrderFactsBulkDisabledError } from "./errors";
import { ORDER_FACTS_BULK_SUBMITTER_MODULE } from "./constants";
import { fingerprintBulkQuery } from "../../catalog-facts/ingest/bulk-operation-recovery";

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

  it("defaults Bulk A transport to the D-owned projection with confirmed and with-code discounts", () => {
    const gates = evaluateOrderFactsBulkAGates(ORDER_FACTS_D_BULK_A_ORDERS_LINES);
    expect(gates.schemaGatePassed).toBe(true);
    expect(gates.bulkRuleGatePassed).toBe(true);
    expect(ORDER_FACTS_D_BULK_A_ORDERS_LINES).toMatch(/\bconfirmed\b/);
    expect(ORDER_FACTS_D_BULK_A_ORDERS_LINES).toMatch(/withCodeDiscounts:\s*true/);
    expect(ORDER_FACTS_D_BULK_A_ORDERS_LINES).not.toMatch(/\bagreements\b/);
    expect(ORDER_FACTS_D_BULK_A_ORDERS_LINES).not.toMatch(/\bcancellation\b/);
  });

  it("fingerprints the D Bulk A document separately from frozen B", () => {
    const shopId = "shop-fingerprint";
    expect(
      fingerprintBulkQuery({
        query: ORDER_FACTS_D_BULK_A_ORDERS_LINES,
        shopId,
      }),
    ).not.toBe(
      fingerprintBulkQuery({
        query: ORDER_FACTS_BULK_A_ORDERS_LINES,
        shopId,
      }),
    );
  });
});
