import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ORDER_CANONICAL_LOCK_VERSION } from "./constants";
import {
  deriveOrderLockKey,
  encodeOrderLockComponent,
  orderLockPreimage,
  orderOrderLockKeysForAcquisition,
} from "./lock-key";

describe("PR6-A order-domain lock-key derivation", () => {
  it("vector 1 Order known-answer", () => {
    const key = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Order",
      shopifyGid: "gid://shopify/Order/1234567890",
    });
    const preimage = orderLockPreimage([
      ORDER_CANONICAL_LOCK_VERSION,
      "cm1234567890abcdefghijk",
      "Order",
      "gid://shopify/Order/1234567890",
    ]);
    expect(preimage.toString("utf8")).toBe(
      "28:stocky-pr6-canonical-lock-v123:cm1234567890abcdefghijk5:Order30:gid://shopify/Order/1234567890",
    );
    expect(key.digestHex).toBe(
      "e88c774553f1bdab0a1c92993355d809ba6eceb139161907386de9204fbbf006",
    );
    expect(key.key1).toBe(-393447611);
    expect(key.key2).toBe(1408351659);
    expect(Number.isInteger(key.key1)).toBe(true);
    expect(Number.isInteger(key.key2)).toBe(true);
    expect(key.key1).toBeGreaterThanOrEqual(-2147483648);
    expect(key.key1).toBeLessThanOrEqual(2147483647);
  });

  it("vector 2 OrderLine known-answer", () => {
    const key = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "OrderLine",
      shopifyGid: "gid://shopify/LineItem/2222222222",
    });
    expect(key.preimage.toString("utf8")).toBe(
      "28:stocky-pr6-canonical-lock-v123:cm1234567890abcdefghijk9:OrderLine33:gid://shopify/LineItem/2222222222",
    );
    expect(key.digestHex).toBe(
      "582dfba38e5662df7aa5aefe128b2b580cebdd4a12f1c7e73e55d43aee5ae2af",
    );
    expect(key.key1).toBe(1479408547);
    expect(key.key2).toBe(-1906941217);
  });

  it("vector 3 Refund known-answer", () => {
    const key = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Refund",
      shopifyGid: "gid://shopify/Refund/3333333333",
    });
    expect(key.preimage.toString("utf8")).toBe(
      "28:stocky-pr6-canonical-lock-v123:cm1234567890abcdefghijk6:Refund31:gid://shopify/Refund/3333333333",
    );
    expect(key.digestHex).toBe(
      "4e1890e2a617de10b96f3134811bb6f4e7002b61af4fde452857a0c9f2549696",
    );
    expect(key.key1).toBe(1310232802);
    expect(key.key2).toBe(-1508385264);
  });

  it("vector 4 RefundLine ordinal composite known-answer", () => {
    const identity = {
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "RefundLine" as const,
      shopifyRefundGid: "gid://shopify/Refund/3333333333",
      shopifyLineItemGid: "gid://shopify/LineItem/2222222222",
      refundLineOrdinal: 0,
    };
    const a = deriveOrderLockKey(identity);
    const b = deriveOrderLockKey({ ...identity });
    expect(a.preimage.toString("utf8")).toBe(
      "28:stocky-pr6-canonical-lock-v123:cm1234567890abcdefghijk10:RefundLine31:gid://shopify/Refund/333333333333:gid://shopify/LineItem/22222222221:0",
    );
    expect(a.digestHex).toBe(
      "915af19e6b895660fde8d54d4220534aee157cf26ea36c27d52cbf51414474bd",
    );
    expect(a.key1).toBe(-1856310882);
    expect(a.key2).toBe(1804162656);
    expect(a.key1).toBe(b.key1);
    expect(a.key2).toBe(b.key2);
    expect(a.digestHex).toBe(b.digestHex);
  });

  it("same input produces the same key", () => {
    const identity = {
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Order" as const,
      shopifyGid: "gid://shopify/Order/1234567890",
    };
    const a = deriveOrderLockKey(identity);
    const b = deriveOrderLockKey({ ...identity });
    expect(a.digestHex).toBe(b.digestHex);
    expect(a.key1).toBe(b.key1);
    expect(a.key2).toBe(b.key2);
  });

  it("different resource kind changes the key", () => {
    const order = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Order",
      shopifyGid: "gid://shopify/Order/1",
    });
    const refund = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Refund",
      shopifyGid: "gid://shopify/Order/1",
    });
    expect(order.digestHex).not.toBe(refund.digestHex);
  });

  it("UTF-8 byte-length hardening is deterministic", () => {
    const shopId = "tést-shop";
    expect(shopId.length).toBe(9);
    expect(Buffer.byteLength(shopId, "utf8")).toBe(10);
    const encodedShop = encodeOrderLockComponent(shopId);
    expect(encodedShop.toString("utf8")).toBe("10:tést-shop");
    const key = deriveOrderLockKey({
      shopId,
      resourceKind: "Order",
      shopifyGid: "gid://shopify/Order/42",
    });
    expect(key.preimage.toString("utf8")).toBe(
      "28:stocky-pr6-canonical-lock-v110:tést-shop5:Order22:gid://shopify/Order/42",
    );
    expect(key.digestHex).toBe(
      "eee3f1d1edf7247649806f3945246049ee16eaecd2526fba91c1d7742f6ecf9e",
    );
    expect(createHash("sha256").update(key.preimage).digest("hex")).toBe(
      key.digestHex,
    );
    expect(key.key1).toBe(-287051311);
    expect(key.key2).toBe(-302570378);
  });

  it("never represents the lock as a 64-bit JavaScript Number", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const name of ["lock-key.ts", "advisory-lock.ts"]) {
      const text = readFileSync(path.join(dir, name), "utf8");
      expect(text).not.toMatch(/readBigInt64|readBigUInt64|BigInt64/);
      expect(text).toMatch(/readInt32BE\(0\)|CAST\(\$\{key\.key1\} AS INTEGER\)/);
    }
    const lockKey = readFileSync(path.join(dir, "lock-key.ts"), "utf8");
    expect(lockKey).toMatch(/readInt32BE\(0\)/);
    expect(lockKey).toMatch(/readInt32BE\(4\)/);
  });

  it("orders multi-key acquisition ascending and dedupes collisions", () => {
    const a = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Order",
      shopifyGid: "gid://shopify/Order/1234567890",
    });
    const b = deriveOrderLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Refund",
      shopifyGid: "gid://shopify/Refund/3333333333",
    });
    const ordered = orderOrderLockKeysForAcquisition([b, a, a]);
    expect(ordered).toHaveLength(2);
    expect(
      ordered[0].key1 < ordered[1].key1 ||
        (ordered[0].key1 === ordered[1].key1 &&
          ordered[0].key2 <= ordered[1].key2),
    ).toBe(true);
    expect(new Set(ordered.map((k) => `${k.key1}:${k.key2}`))).toEqual(
      new Set([`${a.key1}:${a.key2}`, `${b.key1}:${b.key2}`]),
    );
  });
});
