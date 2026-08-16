import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CANONICAL_LOCK_VERSION } from "./constants";
import {
  canonicalLockPreimage,
  deriveCanonicalLockKey,
  encodeCanonicalLockComponent,
  orderCanonicalLockKeysForAcquisition,
} from "./lock-key";

describe("PR5 canonical lock-key derivation", () => {
  it("vector 1 Product known-answer", () => {
    const key = deriveCanonicalLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Product",
      shopifyGid: "gid://shopify/Product/1234567890",
    });
    const preimage = canonicalLockPreimage([
      CANONICAL_LOCK_VERSION,
      "cm1234567890abcdefghijk",
      "Product",
      "gid://shopify/Product/1234567890",
    ]);
    expect(preimage.toString("utf8")).toBe(
      "28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk7:Product32:gid://shopify/Product/1234567890",
    );
    expect(key.digestHex).toBe(
      "872f7a6ab5d396d0738736ef15c37065e2bf6fba6f7480dd8f517fe487d799c1",
    );
    expect(key.key1).toBe(-2026931606);
    expect(key.key2).toBe(-1244424496);
  });

  it("vector 2 ProductVariant known-answer", () => {
    const key = deriveCanonicalLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "ProductVariant",
      shopifyGid: "gid://shopify/ProductVariant/9876543210",
    });
    expect(key.preimage.toString("utf8")).toBe(
      "28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk14:ProductVariant39:gid://shopify/ProductVariant/9876543210",
    );
    expect(key.digestHex).toBe(
      "74825407ef1400f9b02bf51b778b04cf20c765605c541131e4a6a84701d92e7e",
    );
    expect(key.key1).toBe(1954698247);
    expect(key.key2).toBe(-283901703);
  });

  it("vector 3 InventoryLevel pair known-answer and stable pair identity", () => {
    const identity = {
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "InventoryLevel" as const,
      inventoryItemGid: "gid://shopify/InventoryItem/1111111111",
      locationGid: "gid://shopify/Location/2222222222",
    };
    const a = deriveCanonicalLockKey(identity);
    const b = deriveCanonicalLockKey({ ...identity });
    expect(a.preimage.toString("utf8")).toBe(
      "28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk14:InventoryLevel38:gid://shopify/InventoryItem/111111111133:gid://shopify/Location/2222222222",
    );
    expect(a.digestHex).toBe(
      "3c8acc13010dc2cc5e30275b4c581f156acb07eb914e3f59e8bf5e80a9cb0713",
    );
    expect(a.key1).toBe(1015729171);
    expect(a.key2).toBe(17679052);
    expect(a.key1).toBe(b.key1);
    expect(a.key2).toBe(b.key2);
    expect(a.digestHex).toBe(b.digestHex);
  });

  it("vector 4 UTF-8 byte-length hardening (F-CLAUDE-PR5IE-01)", () => {
    const shopId = "tést-shop";
    expect(shopId.length).toBe(9);
    expect(Buffer.byteLength(shopId, "utf8")).toBe(10);
    const encodedShop = encodeCanonicalLockComponent(shopId);
    expect(encodedShop.toString("utf8")).toBe("10:tést-shop");
    expect(encodedShop.length).toBe(3 + 10);

    const key = deriveCanonicalLockKey({
      shopId,
      resourceKind: "Product",
      shopifyGid: "gid://shopify/Product/42",
    });
    expect(key.preimage.toString("utf8")).toBe(
      "28:stocky-pr5-canonical-lock-v110:tést-shop7:Product24:gid://shopify/Product/42",
    );
    expect(key.digestHex).toBe(
      "ab36fb9ac2e1f30d0cbf8f4666281b576d4e0c3dc73a51a351800ad8b41b7ecb",
    );
    expect(createHash("sha256").update(key.preimage).digest("hex")).toBe(
      key.digestHex,
    );
    expect(key.key1).toBe(-1422460006);
    expect(key.key2).toBe(-1025379571);
  });

  it("orders multi-key acquisition ascending and dedupes collisions", () => {
    const a = deriveCanonicalLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "Product",
      shopifyGid: "gid://shopify/Product/1234567890",
    });
    const b = deriveCanonicalLockKey({
      shopId: "cm1234567890abcdefghijk",
      resourceKind: "ProductVariant",
      shopifyGid: "gid://shopify/ProductVariant/9876543210",
    });
    const ordered = orderCanonicalLockKeysForAcquisition([b, a, a]);
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
