import { describe, expect, it } from "vitest";
import {
  canonicalizeImportJson,
  importParentContentDigest,
  importReceiptApplicationKey,
  importReceiptMatchesV1Digest,
  legacyImportReceiptApplicationKey,
  nominatedImportReceipt,
  v1ImportReceiptPayloadDigest,
} from "./import-receipt-binding";
import {
  ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION,
  ORDER_FACTS_IMPORT_RECEIPT_DIGEST_VERSION,
} from "./constants";

describe("PR6-D import receipt binding", () => {
  it("canonicalizes representation without inventing nulls or flipping signs", () => {
    const left = canonicalizeImportJson({
      b: "-1.50",
      a: { z: 1, y: 2 },
    });
    const right = canonicalizeImportJson({
      a: { y: 2, z: 1 },
      b: "-1.50",
    });
    expect(left).toBe(right);
    expect(left).toContain("-1.50");
    expect(left).not.toContain("null");
  });

  it("ignores child physical order for identical parent/child content", () => {
    const parent = { id: "gid://shopify/Order/1", currentSubtotalLineItemsQuantity: 2 };
    const a = { id: "gid://shopify/LineItem/a", __parentId: parent.id, quantity: 1 };
    const b = { id: "gid://shopify/LineItem/b", __parentId: parent.id, quantity: 2 };
    expect(
      importParentContentDigest({ parent, children: [a, b] }),
    ).toBe(importParentContentDigest({ parent, children: [b, a] }));
  });

  it("changes the digest when already-receipted child values mutate", () => {
    const parent = { id: "gid://shopify/Order/1" };
    const child = { id: "gid://shopify/LineItem/a", quantity: 1 };
    const mutated = { id: "gid://shopify/LineItem/a", quantity: 9 };
    expect(
      importParentContentDigest({ parent, children: [child] }),
    ).not.toBe(importParentContentDigest({ parent, children: [mutated] }));
  });

  it("versions the application key away from identity-only legacy receipts", () => {
    const modern = importReceiptApplicationKey({
      durableJobId: "job",
      shopifyGid: "gid://shopify/Order/1",
      fenceGeneration: 4n,
    });
    const legacy = legacyImportReceiptApplicationKey({
      durableJobId: "job",
      shopifyGid: "gid://shopify/Order/1",
    });
    expect(modern).toContain(ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION);
    expect(modern).not.toBe(legacy);
    expect(legacy).toBe("order-facts-sync:job:gid://shopify/Order/1");
    expect(
      importReceiptApplicationKey({
        durableJobId: "job",
        shopifyGid: "gid://shopify/Order/1",
        fenceGeneration: 1n,
      }),
    ).toBe(
      importReceiptApplicationKey({
        durableJobId: "job",
        shopifyGid: "gid://shopify/Order/1",
        fenceGeneration: 9n,
      }),
    );
  });

  it("does not put scratch paths or ordinals in the receipt digest", () => {
    const receipt = nominatedImportReceipt({
      durableJobId: "job",
      shopifyGid: "gid://shopify/Order/1",
      shopId: "shop",
      syncRunId: "run-1",
      bulkOperationGid: "gid://shopify/BulkOperation/1",
      queryFingerprint: "abc",
      fenceGeneration: 1n,
      parent: { id: "gid://shopify/Order/1" },
      children: [],
    });
    expect(receipt.payloadDigest).not.toMatch(/tmp|att-|scratch|ordinal/i);
    expect(receipt.applicationKey).not.toMatch(/tmp|att-/);
  });

  it("changes the digest when fence, run, Bulk, query, shop, or content change", () => {
    const base = {
      durableJobId: "job",
      shopifyGid: "gid://shopify/Order/1",
      shopId: "shop",
      syncRunId: "run-1",
      bulkOperationGid: "gid://shopify/BulkOperation/1",
      queryFingerprint: "abc",
      apiVersion: "2026-07",
      fenceGeneration: 1n,
      parent: { id: "gid://shopify/Order/1" },
      children: [{ id: "gid://shopify/LineItem/a", quantity: 1 }],
    };
    const digest = nominatedImportReceipt(base).payloadDigest;
    const key = nominatedImportReceipt(base).applicationKey;
    expect(nominatedImportReceipt({ ...base, fenceGeneration: 999n }).payloadDigest).not.toBe(
      digest,
    );
    expect(nominatedImportReceipt({ ...base, fenceGeneration: 999n }).applicationKey).toBe(
      key,
    );
    expect(nominatedImportReceipt({ ...base, syncRunId: "run-2" }).payloadDigest).not.toBe(
      digest,
    );
    expect(
      nominatedImportReceipt({
        ...base,
        bulkOperationGid: "gid://shopify/BulkOperation/2",
      }).payloadDigest,
    ).not.toBe(digest);
    expect(
      nominatedImportReceipt({ ...base, queryFingerprint: "zzz" }).payloadDigest,
    ).not.toBe(digest);
    expect(nominatedImportReceipt({ ...base, shopId: "other" }).payloadDigest).not.toBe(
      digest,
    );
    expect(nominatedImportReceipt({ ...base, apiVersion: "2026-04" }).payloadDigest).not.toBe(
      digest,
    );
    expect(key).toContain(ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION);
    expect(digest).not.toContain(ORDER_FACTS_IMPORT_RECEIPT_DIGEST_VERSION);
  });

  it("rejects missing epoch fields before certifying facts", () => {
    expect(() =>
      nominatedImportReceipt({
        durableJobId: "job",
        shopifyGid: "gid://shopify/Order/1",
        shopId: "shop",
        queryFingerprint: "abc",
        fenceGeneration: 1n,
        parent: { id: "gid://shopify/Order/1" },
        children: [],
      } as never),
    ).toThrow(/syncRunId|epoch/i);
    expect(() =>
      nominatedImportReceipt({
        durableJobId: "job",
        shopifyGid: "gid://shopify/Order/1",
        shopId: "shop",
        syncRunId: "run-1",
        bulkOperationGid: "not-a-bulk",
        queryFingerprint: "abc",
        fenceGeneration: 1n,
        parent: { id: "gid://shopify/Order/1" },
        children: [],
      }),
    ).toThrow(/BulkOperation/);
    expect(() =>
      nominatedImportReceipt({
        durableJobId: "job",
        shopifyGid: "gid://shopify/Order/1",
        shopId: "shop",
        syncRunId: "run-1",
        bulkOperationGid: "gid://shopify/BulkOperation/1",
        queryFingerprint: "abc",
        fenceGeneration: null,
        parent: { id: "gid://shopify/Order/1" },
        children: [],
      }),
    ).toThrow(/fenceGeneration/);
  });

  it("detects stored v1 digests without silently upgrading them", () => {
    const parent = { id: "gid://shopify/Order/1" };
    const children = [{ id: "gid://shopify/LineItem/a" }];
    const v1 = v1ImportReceiptPayloadDigest({
      shopId: "shop",
      sourceJobType: "order-facts-sync",
      durableJobId: "job",
      shopifyGid: parent.id,
      queryFingerprint: "abc",
      apiVersion: "2026-07",
      contentDigest: importParentContentDigest({ parent, children }),
    });
    expect(
      importReceiptMatchesV1Digest({
        storedDigest: v1,
        shopId: "shop",
        sourceJobType: "order-facts-sync",
        durableJobId: "job",
        shopifyGid: parent.id,
        queryFingerprint: "abc",
        apiVersion: "2026-07",
        parent,
        children,
      }),
    ).toBe(true);
    const v2 = nominatedImportReceipt({
      durableJobId: "job",
      shopifyGid: parent.id,
      shopId: "shop",
      syncRunId: "run-1",
      bulkOperationGid: "gid://shopify/BulkOperation/1",
      queryFingerprint: "abc",
      fenceGeneration: 1n,
      parent,
      children,
    }).payloadDigest;
    expect(v2).not.toBe(v1);
  });
});
