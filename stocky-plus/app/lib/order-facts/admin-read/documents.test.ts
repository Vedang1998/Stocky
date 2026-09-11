import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS,
  ORDER_FACT_BY_ID_QUERY,
  REFUND_FACT_BY_ID_QUERY,
} from "../documents";
import { ORDER_FACTS_BULK_QUERY_DOCUMENTS } from "../bulk-query-documents";
import { assertCanonicalReadDocument } from "../safety/graphql-ast";
import { loadGeneratedAdmin202607Schema } from "../bulk-query-schema";
import {
  assertNoForbiddenListPagination,
  findForbiddenListPagination,
} from "../list-pagination";
import { FORBIDDEN_LIST_PAGINATION_FIELDS } from "../constants";

const PLANTED_LIST_FIRST = `
query PlantedRefundsFirst {
  order(id: "gid://shopify/Order/1") {
    id
    refunds(first: 1) { id }
    transactions(first: 1) { id }
  }
}
`;

const PLANTED_REFUND_TXN_CONNECTION = `
query PlantedRefundTransactions {
  refund(id: "gid://shopify/Refund/1") {
    id
    transactions(first: 1) {
      pageInfo { hasNextPage endCursor }
      edges { cursor node { id } }
    }
  }
}
`;

describe("PR6-B GraphQL documents", () => {
  it("accepts every tagged Admin read document as a QUERY", () => {
    expect(CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS.length).toBe(5);
    for (const document of CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS) {
      expect(() => assertCanonicalReadDocument(document)).not.toThrow();
    }
  });

  it("T20 forbids first on named non-connection LIST fields and allows Refund.transactions", () => {
    const { schema } = loadGeneratedAdmin202607Schema();
    for (const document of CANONICAL_ORDER_ADMIN_READ_QUERY_DOCUMENTS) {
      assertNoForbiddenListPagination(schema, document, "production query");
    }
    for (const document of ORDER_FACTS_BULK_QUERY_DOCUMENTS) {
      assertNoForbiddenListPagination(schema, document, "bulk candidate");
    }

    const planted = findForbiddenListPagination(schema, PLANTED_LIST_FIRST);
    const names = planted.map((item) => `${item.parentTypeName}.${item.fieldName}`);
    expect(names).toContain("Order.refunds");
    expect(names).toContain("Order.transactions");

    const refundTxn = findForbiddenListPagination(
      schema,
      PLANTED_REFUND_TXN_CONNECTION,
    );
    expect(refundTxn).toEqual([]);

    expect(FORBIDDEN_LIST_PAGINATION_FIELDS).toEqual(
      expect.arrayContaining([
        "refunds",
        "transactions",
        "taxLines",
        "discountAllocations",
        "duties",
      ]),
    );
    expect(ORDER_FACT_BY_ID_QUERY).not.toMatch(/refunds\s*\(\s*first/);
    expect(ORDER_FACT_BY_ID_QUERY).toMatch(/transactions\s*\(\s*first:\s*\$txnFirst/);
    expect(REFUND_FACT_BY_ID_QUERY).toMatch(/transactions\s*\(\s*first:\s*\$txnFirst/);
  });

  it("does not share nested after variables on OrderFactById", () => {
    expect(ORDER_FACT_BY_ID_QUERY).not.toMatch(/\$saleAfter/);
    expect(ORDER_FACT_BY_ID_QUERY).not.toMatch(/\$refundLineAfter/);
    expect(ORDER_FACT_BY_ID_QUERY).not.toMatch(/\$adjAfter/);
    expect(ORDER_FACT_BY_ID_QUERY).not.toMatch(/\$shipRefundAfter/);
    expect(ORDER_FACT_BY_ID_QUERY).not.toMatch(/\$txnAfter/);
  });

  it("does not interpolate GraphQL documents", () => {
    const documentsPath = fileURLToPath(new URL("../documents.ts", import.meta.url));
    const source = readFileSync(documentsPath, "utf8");
    expect(source).not.toMatch(/\$\{/);
  });
});
