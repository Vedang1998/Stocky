import { describe, expect, it, vi } from "vitest";
import type { CatalogAdminReadClient } from "../admin-read";
import {
  fingerprintBulkQuery,
  recoverOrphanBulkOperation,
} from "./bulk-operation-recovery";
import { submitCatalogFactBulkOperation } from "./bulk-operation-submitter";

function mockAdmin(result: unknown): {
  admin: CatalogAdminReadClient;
  graphql: ReturnType<typeof vi.fn>;
} {
  const graphql = vi.fn(async () => ({
    json: async () => result,
  }));
  return { admin: { graphql }, graphql };
}

describe("F3 BulkOperation submit and orphan recovery", () => {
  it("submits only bulkOperationRunQuery with groupObjects false", async () => {
    const { admin, graphql } = mockAdmin({
      data: {
        bulkOperationRunQuery: {
          bulkOperation: {
            id: "gid://shopify/BulkOperation/1",
            status: "CREATED",
          },
          userErrors: [],
        },
      },
    });
    await expect(
      submitCatalogFactBulkOperation(admin, "{ products { nodes { id } } }"),
    ).resolves.toEqual({
      id: "gid://shopify/BulkOperation/1",
      status: "CREATED",
    });
    expect(graphql.mock.calls[0]?.[1]).toEqual({
      variables: {
        query: "{ products { nodes { id } } }",
        groupObjects: false,
      },
    });
  });

  it("fails closed on mutation userErrors", async () => {
    const { admin } = mockAdmin({
      data: {
        bulkOperationRunQuery: {
          bulkOperation: null,
          userErrors: [{ message: "invalid bulk" }],
        },
      },
    });
    await expect(
      submitCatalogFactBulkOperation(admin, "{ products { nodes { id } } }"),
    ).rejects.toThrow("invalid bulk");
  });

  it("fails closed on a non-BulkOperation returned GID", async () => {
    const { admin } = mockAdmin({
      data: {
        bulkOperationRunQuery: {
          bulkOperation: {
            id: "gid://shopify/Product/1",
            status: "CREATED",
          },
          userErrors: [],
        },
      },
    });
    await expect(
      submitCatalogFactBulkOperation(admin, "{ products { nodes { id } } }"),
    ).rejects.toThrow("Expected BulkOperation GID");
  });

  it("FX-BULK-014 adopts exactly one fingerprint/time-window match", async () => {
    const query = "{ products { nodes { id } } }";
    const intentAt = new Date("2026-09-05T12:00:00Z");
    const { admin } = mockAdmin({
      data: {
        bulkOperations: {
          nodes: [
            {
              id: "gid://shopify/BulkOperation/1",
              status: "RUNNING",
              query,
              createdAt: "2026-09-05T12:00:30Z",
            },
          ],
        },
      },
    });
    await expect(
      recoverOrphanBulkOperation(admin, {
        shopId: "shop-a",
        bulkSubmitIntentAt: intentAt,
        bulkQueryFingerprint: fingerprintBulkQuery({
          query,
          shopId: "shop-a",
        }),
      }),
    ).resolves.toEqual({
      status: "ADOPTED",
      bulkOperationGid: "gid://shopify/BulkOperation/1",
    });
  });

  it("waits without double-submit when no operation matches", async () => {
    const { admin } = mockAdmin({
      data: { bulkOperations: { nodes: [] } },
    });
    await expect(
      recoverOrphanBulkOperation(admin, {
        shopId: "shop-a",
        bulkSubmitIntentAt: new Date(),
        bulkQueryFingerprint: "a".repeat(64),
      }),
    ).resolves.toEqual({ status: "WAIT", reason: "no_unique_match" });
  });

  it("fails closed instead of guessing among two matches", async () => {
    const query = "{ products { nodes { id } } }";
    const createdAt = "2026-09-05T12:00:30Z";
    const { admin } = mockAdmin({
      data: {
        bulkOperations: {
          nodes: [1, 2].map((id) => ({
            id: `gid://shopify/BulkOperation/${id}`,
            status: "COMPLETED",
            query,
            createdAt,
          })),
        },
      },
    });
    await expect(
      recoverOrphanBulkOperation(admin, {
        shopId: "shop-a",
        bulkSubmitIntentAt: new Date("2026-09-05T12:00:00Z"),
        bulkQueryFingerprint: fingerprintBulkQuery({
          query,
          shopId: "shop-a",
        }),
      }),
    ).resolves.toEqual({
      status: "FAILED_CLOSED",
      reason: "ambiguous_match",
    });
  });

  it("does not adopt a matching query outside the intent window", async () => {
    const query = "{ products { nodes { id } } }";
    const { admin } = mockAdmin({
      data: {
        bulkOperations: {
          nodes: [
            {
              id: "gid://shopify/BulkOperation/1",
              status: "COMPLETED",
              query,
              createdAt: "2026-09-05T12:10:00Z",
            },
          ],
        },
      },
    });
    await expect(
      recoverOrphanBulkOperation(admin, {
        shopId: "shop-a",
        bulkSubmitIntentAt: new Date("2026-09-05T12:00:00Z"),
        bulkQueryFingerprint: fingerprintBulkQuery({
          query,
          shopId: "shop-a",
        }),
      }),
    ).resolves.toMatchObject({ status: "WAIT" });
  });

  it("fingerprint binds exact query, groupObjects false, and shop", () => {
    const query = "{ products { nodes { id } } }";
    expect(fingerprintBulkQuery({ query, shopId: "shop-a" })).not.toBe(
      fingerprintBulkQuery({ query, shopId: "shop-b" }),
    );
    expect(fingerprintBulkQuery({ query, shopId: "shop-a" })).not.toBe(
      fingerprintBulkQuery({ query: `${query} `, shopId: "shop-a" }),
    );
  });
});
