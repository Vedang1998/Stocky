import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { executeAdminReadQuery } from "../execute";
import {
  assertCanonicalReadDocument,
  CanonicalReadForbiddenFieldError,
  CanonicalReadGraphQLSyntaxError,
  CanonicalReadMutationRejectedError,
} from "../safety/graphql-ast";
import { assertOrderFactsReadBoundarySafe } from "../safety/scan";
import { createMockAdmin } from "./mock-admin";

const PLANTED_MUTATION = `#graphql
  mutation PlantedOrderWrite {
    orderCancel(orderId: "gid://shopify/Order/1", reason: OTHER, refund: false, restock: false) {
      job { id }
      orderCancelUserErrors { message }
    }
  }
`;

describe("PR6-B T02 mutation and forbidden-field AST safety", () => {
  it("rejects a mutation document before any Admin network call", async () => {
    const admin = createMockAdmin(() => {
      throw new Error("Admin client must not be called for mutations");
    });
    expect(() => assertCanonicalReadDocument(PLANTED_MUTATION)).toThrow(
      CanonicalReadMutationRejectedError,
    );
    await expect(
      executeAdminReadQuery(admin, PLANTED_MUTATION),
    ).rejects.toBeInstanceOf(CanonicalReadMutationRejectedError);
    expect(admin.calls).toEqual([]);
  });

  it("rejects currentBulkOperation via GraphQL field AST", () => {
    const document = `#graphql
      query ForbiddenCurrentBulk {
        currentBulkOperation { id }
      }
    `;
    expect(() => assertCanonicalReadDocument(document)).toThrow(
      CanonicalReadForbiddenFieldError,
    );
  });

  it("rejects Order.cancellation and customer PII fields", () => {
    expect(() =>
      assertCanonicalReadDocument(`#graphql
        query ForbiddenCancellation {
          order(id: "gid://shopify/Order/1") { id cancellation { staffNote } }
        }
      `),
    ).toThrow(/cancellation/);
    expect(() =>
      assertCanonicalReadDocument(`#graphql
        query ForbiddenCustomer {
          order(id: "gid://shopify/Order/1") { id customer { id } }
        }
      `),
    ).toThrow(/customer/);
    expect(() =>
      assertCanonicalReadDocument(`#graphql
        query ForbiddenPricePath {
          order(id: "gid://shopify/Order/1") {
            lineItems(first: 1) {
              edges { node { priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount } } } }
            }
          }
        }
      `),
    ).toThrow(/priceAfterAllDiscountsBeforeTaxesSet/);
  });

  it("fails on a deliberately invalid GraphQL document", () => {
    expect(() => assertCanonicalReadDocument("query {")).toThrow(
      CanonicalReadGraphQLSyntaxError,
    );
  });

  it("production admin-read modules pass the recursive boundary scan", () => {
    const root = path.dirname(
      fileURLToPath(new URL("../documents.ts", import.meta.url)),
    );
    expect(() => assertOrderFactsReadBoundarySafe(root)).not.toThrow();
  });

  it("fails closed on interpolated GraphQL in a production module", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pr6-b-scan-"));
    writeFileSync(
      path.join(root, "planted.ts"),
      "export const doc = `#graphql\n  query X { order(id: \"${id}\") { id } }\n`;\n",
    );
    try {
      expect(() => assertOrderFactsReadBoundarySafe(root)).toThrow(
        /unreviewable_graphql/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
