/**
 * PR6-A order-domain lock-key derivation (`stocky-pr6-canonical-lock-v1`).
 *
 * Encoding matches PR5: length-prefixed UTF-8 components, SHA-256, signed
 * int32 key1/key2 from digest bytes 0..7. Never a JavaScript Number 64-bit key.
 * Do not widen CatalogResourceKind. RefundLine identity is the ordinal composite.
 */
import { createHash } from "node:crypto";
import {
  ORDER_CANONICAL_LOCK_VERSION,
  type OrderResourceKind,
} from "./constants";

export type OrderGidLockIdentity = {
  shopId: string;
  resourceKind: Exclude<OrderResourceKind, "RefundLine">;
  shopifyGid: string;
};

export type OrderRefundLineLockIdentity = {
  shopId: string;
  resourceKind: "RefundLine";
  shopifyRefundGid: string;
  shopifyLineItemGid: string;
  refundLineOrdinal: number;
};

export type OrderLockIdentity =
  | OrderGidLockIdentity
  | OrderRefundLineLockIdentity;

export type OrderLockKey = {
  key1: number;
  key2: number;
  digestHex: string;
  preimage: Buffer;
};

function utf8Bytes(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

/** Encode one component as `<decimal UTF-8 byte length>:<UTF-8 bytes>`. */
export function encodeOrderLockComponent(value: string): Buffer {
  const bytes = utf8Bytes(value);
  const prefix = utf8Bytes(`${bytes.length}:`);
  return Buffer.concat([prefix, bytes]);
}

export function orderLockPreimage(components: readonly string[]): Buffer {
  return Buffer.concat(components.map(encodeOrderLockComponent));
}

export function orderLockIdentityComponents(
  identity: OrderLockIdentity,
): string[] {
  if (identity.resourceKind === "RefundLine") {
    if (
      !Number.isInteger(identity.refundLineOrdinal) ||
      identity.refundLineOrdinal < 0
    ) {
      throw new Error(
        "RefundLine lock identity refundLineOrdinal must be an integer >= 0",
      );
    }
    return [
      ORDER_CANONICAL_LOCK_VERSION,
      identity.shopId,
      "RefundLine",
      identity.shopifyRefundGid,
      identity.shopifyLineItemGid,
      String(identity.refundLineOrdinal),
    ];
  }
  return [
    ORDER_CANONICAL_LOCK_VERSION,
    identity.shopId,
    identity.resourceKind,
    identity.shopifyGid,
  ];
}

/**
 * Derive signed int32 advisory keys from SHA-256 digest bytes 0..7.
 * Never converts the first eight bytes into a JavaScript Number / 64-bit key.
 */
export function deriveOrderLockKey(identity: OrderLockIdentity): OrderLockKey {
  const preimage = orderLockPreimage(orderLockIdentityComponents(identity));
  const digest = createHash("sha256").update(preimage).digest();
  return {
    key1: digest.readInt32BE(0),
    key2: digest.readInt32BE(4),
    digestHex: digest.toString("hex"),
    preimage,
  };
}

export function compareOrderLockKeys(a: OrderLockKey, b: OrderLockKey): number {
  if (a.key1 !== b.key1) return a.key1 < b.key1 ? -1 : 1;
  if (a.key2 !== b.key2) return a.key2 < b.key2 ? -1 : 1;
  return 0;
}

export function sortOrderLockKeysAscending(
  keys: readonly OrderLockKey[],
): OrderLockKey[] {
  return [...keys].sort(compareOrderLockKeys);
}

export function dedupeOrderLockKeys(
  keys: readonly OrderLockKey[],
): OrderLockKey[] {
  const seen = new Set<string>();
  const out: OrderLockKey[] = [];
  for (const key of keys) {
    const id = `${key.key1}:${key.key2}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
}

/** Deterministic multi-identity acquisition order: dedupe, then ascending (key1, key2). */
export function orderOrderLockKeysForAcquisition(
  keys: readonly OrderLockKey[],
): OrderLockKey[] {
  return sortOrderLockKeysAscending(dedupeOrderLockKeys(keys));
}
