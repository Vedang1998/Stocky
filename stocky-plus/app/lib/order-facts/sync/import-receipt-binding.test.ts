import { describe, expect, it } from "vitest";
import {
  canonicalizeImportJson,
  importParentContentDigest,
  importReceiptApplicationKey,
  legacyImportReceiptApplicationKey,
  nominatedImportReceipt,
} from "./import-receipt-binding";
import { ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION } from "./constants";

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
      queryFingerprint: "abc",
      fenceGeneration: 1n,
      parent: { id: "gid://shopify/Order/1" },
      children: [],
    });
    expect(receipt.payloadDigest).not.toMatch(/tmp|att-|scratch|ordinal/i);
    expect(receipt.applicationKey).not.toMatch(/tmp|att-/);
  });
});
