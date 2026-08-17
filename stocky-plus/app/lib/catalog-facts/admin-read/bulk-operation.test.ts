import { describe, expect, it } from "vitest";
import { CATALOG_FACT_BULK_OPERATION_QUERY } from "./documents";
import {
  BulkOperationGidError,
  classifyBulkOperationSnapshot,
  consumeBulkOperationGid,
  parseBulkOperationGid,
  persistBulkOperationGid,
  readBulkOperationById,
} from "./bulk-operation";
import { assertCanonicalReadDocument } from "./safety/graphql-ast";
import { createMockAdmin } from "./__tests__/mock-admin";

describe("PR5-F2A bulkOperation(id:) contract", () => {
  it("persists and consumes an explicit BulkOperation GID", () => {
    const contract = persistBulkOperationGid(
      "gid://shopify/BulkOperation/720918",
    );
    expect(consumeBulkOperationGid(contract)).toBe(
      "gid://shopify/BulkOperation/720918",
    );
    expect(() => parseBulkOperationGid("gid://shopify/Product/1")).toThrow(
      BulkOperationGidError,
    );
  });

  it("polls bulkOperation(id:) and does not treat partialDataUrl as canonical success", async () => {
    const admin = createMockAdmin((_query, variables) => {
      expect(variables?.id).toBe("gid://shopify/BulkOperation/720918");
      return {
        data: {
          bulkOperation: {
            id: "gid://shopify/BulkOperation/720918",
            status: "COMPLETED",
            errorCode: null,
            objectCount: "12",
            rootObjectCount: "3",
            url: "https://example.invalid/complete.jsonl",
            partialDataUrl: null,
            createdAt: "2026-08-17T00:00:00Z",
            completedAt: "2026-08-17T00:01:00Z",
          },
        },
      };
    });
    const result = await readBulkOperationById(
      admin,
      "gid://shopify/BulkOperation/720918",
    );
    expect(result?.canonicalSuccessEligible).toBe(true);
    expect(result?.partialDataUrlIsNotCanonicalSuccess).toBe(true);
    expect(admin.calls[0]?.query).toBe(CATALOG_FACT_BULK_OPERATION_QUERY);
    expect(admin.calls[0]?.query).toContain("bulkOperation(id:");
    expect(admin.calls[0]?.query).not.toContain("currentBulkOperation");
    assertCanonicalReadDocument(admin.calls[0]!.query);
  });

  it("classifies COMPLETED with only partialDataUrl as not canonical success", () => {
    const classified = classifyBulkOperationSnapshot({
      id: parseBulkOperationGid("gid://shopify/BulkOperation/1"),
      status: "COMPLETED",
      errorCode: null,
      objectCount: "4",
      rootObjectCount: "1",
      url: null,
      partialDataUrl: "https://example.invalid/partial.jsonl",
      createdAt: null,
      completedAt: null,
    });
    expect(classified.canonicalSuccessEligible).toBe(false);
    expect(classified.partialDataUrlIsNotCanonicalSuccess).toBe(true);
  });

  it("classifies FAILED partialDataUrl as not canonical success", () => {
    const classified = classifyBulkOperationSnapshot({
      id: parseBulkOperationGid("gid://shopify/BulkOperation/2"),
      status: "FAILED",
      errorCode: "INTERNAL_SERVER_ERROR",
      objectCount: "1",
      rootObjectCount: "1",
      url: null,
      partialDataUrl: "https://example.invalid/partial.jsonl",
      createdAt: null,
      completedAt: null,
    });
    expect(classified.canonicalSuccessEligible).toBe(false);
  });
});
