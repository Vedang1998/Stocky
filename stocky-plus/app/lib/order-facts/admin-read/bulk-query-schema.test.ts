import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse, specifiedRules, validate } from "graphql";
import {
  ORDER_FACTS_BULK_A_ORDERS_LINES,
  ORDER_FACTS_BULK_B_REFUNDS_CANDIDATE,
  ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
  ORDER_FACTS_BULK_QUERY_DOCUMENTS,
} from "./bulk-query-documents";
import {
  ADMIN_2026_07_SCHEMA_PATH,
  assertQuerySchemaValid,
  bulkQueryValidationRules,
  loadGeneratedAdmin202607Schema,
  validateQueryAgainstAdminSchema,
} from "./bulk-query-schema";
import { evaluateBulkOperationRules } from "./bulk-operation-rules";
import { BULK_B_PRODUCTION_ENABLED, costBulkBFallback } from "./bulk-b-fallback";
import { CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS } from "./documents";
import { assertCanonicalReadDocument } from "./safety/graphql-ast";
import { ORDER_LINE_IMPORT_ENVELOPE } from "./constants";

const INVALID_SALE_LINEITEM_ON_INTERFACE = `
query InvalidSaleLineItemOnInterface {
  order(id: "gid://shopify/Order/1") {
    agreements(first: 1) {
      edges {
        node {
          sales(first: 1) {
            edges {
              node {
                id
                lineItem { id }
              }
            }
          }
        }
      }
    }
  }
}
`;

describe("PR6-B bulk schema and bulk-rule gates", () => {
  it("fails closed when the generated local schema artifact is absent", () => {
    const missingPath = "/tmp/pr6-b-absent-admin-2026-07.schema.json";
    expect(() => loadGeneratedAdmin202607Schema(missingPath)).toThrow(
      /does not fetch shopify\.dev/,
    );
    const loaderSource = readFileSync(
      fileURLToPath(new URL("./bulk-query-schema.ts", import.meta.url)),
      "utf8",
    );
    expect(loaderSource).not.toMatch(/\bfetch\s*\(/);
    expect(loaderSource).not.toMatch(/https:\/\/shopify\.dev/);
  });

  it("uses stock specifiedRules rather than a pagination-argument relaxation", () => {
    expect(bulkQueryValidationRules).toBe(specifiedRules);
  });

  it("schema-validates tagged queries and Bulk A against the local Admin 2026-07 schema", () => {
    const loaded = loadGeneratedAdmin202607Schema();
    expect(loaded.path).toBe(ADMIN_2026_07_SCHEMA_PATH);
    for (const document of CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS) {
      assertCanonicalReadDocument(document);
      assertQuerySchemaValid(loaded.schema, document, "tagged query");
    }
    assertCanonicalReadDocument(ORDER_FACTS_BULK_A_ORDERS_LINES);
    assertQuerySchemaValid(
      loaded.schema,
      ORDER_FACTS_BULK_A_ORDERS_LINES,
      "Bulk A",
    );
    expect(ORDER_FACTS_BULK_A_ORDERS_LINES).not.toMatch(/\bcancellation\b/);
    expect(ORDER_FACTS_BULK_A_ORDERS_LINES).not.toMatch(
      /priceAfterAllDiscountsBeforeTaxesSet/,
    );
  });

  it("T52: Sale.lineItem without inline fragments fails schema validation", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const errors = validateQueryAgainstAdminSchema(
      schema,
      INVALID_SALE_LINEITEM_ON_INTERFACE,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.map((error) => error.message).join("\n"),
    ).toMatch(/lineItem/);
  });

  it("T53: Bulk C may be GraphQL-valid but is rejected by the bulk-rule validator", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const schemaErrors = validate(
      schema,
      parse(ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL),
      specifiedRules,
    );
    expect(schemaErrors, "Bulk C specifiedRules").toEqual([]);
    const bulk = evaluateBulkOperationRules(
      schema,
      ORDER_FACTS_BULK_C_AGREEMENTS_SALES_ILLEGAL,
    );
    expect(bulk.eligible).toBe(false);
    expect(bulk.maxDepth).toBeGreaterThan(2);
    expect(bulk.reasons.join("\n")).toMatch(/depth|Node/i);
  });

  it("Bulk A is schema-legal and bulk-eligible (two Node connections)", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const bulk = evaluateBulkOperationRules(schema, ORDER_FACTS_BULK_A_ORDERS_LINES);
    expect(bulk.eligible).toBe(true);
    expect(bulk.connections.length).toBe(2);
    expect(bulk.maxDepth).toBe(2);
    expect(bulk.connections.every((item) => item.nodeImplementsNode)).toBe(true);
  });

  it("Bulk B is schema-valid, bulk-ineligible or unverified, and production-disabled", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    assertQuerySchemaValid(
      schema,
      ORDER_FACTS_BULK_B_REFUNDS_CANDIDATE,
      "Bulk B",
    );
    const bulk = evaluateBulkOperationRules(
      schema,
      ORDER_FACTS_BULK_B_REFUNDS_CANDIDATE,
    );
    expect(BULK_B_PRODUCTION_ENABLED).toBe(false);
    expect(bulk.eligible).toBe(false);
    expect(bulk.reasons.join("\n")).toMatch(/Node|RefundLineItem/i);
    const cost = costBulkBFallback({
      refundBearingOrderCount: 20_000,
      truncatedRefundContinuationCount: 2_000,
    });
    expect(cost.productionEnabled).toBe(false);
    expect(cost.additionalAdminRequests).toBe(22_000);
    expect(cost.lineImportEnvelope).toBe(ORDER_LINE_IMPORT_ENVELOPE);
    expect(cost.requestsPerEnvelopeLine).toBeCloseTo(0.022);
  });

  it("rejects a bulk document that uses top-level node", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    const result = evaluateBulkOperationRules(
      schema,
      `{ node(id: "gid://shopify/Order/1") { id } }`,
    );
    expect(result.eligible).toBe(false);
    expect(result.hasTopLevelNodeOrNodes).toBe(true);
  });

  it("enumerates the three candidate bulk documents", () => {
    expect(ORDER_FACTS_BULK_QUERY_DOCUMENTS).toHaveLength(3);
  });
});
