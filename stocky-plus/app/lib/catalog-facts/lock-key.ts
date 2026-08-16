/**
 * Single canonical PR5 lock-key derivation (F-CLAUDE-PR5C8-02 / F-CLAUDE-PR5IE-01).
 *
 * Call sites MUST use this module. Do not hand-roll the encoding.
 */
import { createHash } from "node:crypto";
import {
  CANONICAL_LOCK_VERSION,
  type CatalogResourceKind,
} from "./constants";

export type CanonicalGidLockIdentity = {
  shopId: string;
  resourceKind: Exclude<CatalogResourceKind, "InventoryLevel">;
  shopifyGid: string;
};

export type CanonicalInventoryLevelLockIdentity = {
  shopId: string;
  resourceKind: "InventoryLevel";
  inventoryItemGid: string;
  locationGid: string;
};

export type CanonicalLockIdentity =
  | CanonicalGidLockIdentity
  | CanonicalInventoryLevelLockIdentity;

export type CanonicalLockKey = {
  key1: number;
  key2: number;
  digestHex: string;
  preimage: Buffer;
};

function utf8Bytes(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

/** Encode one component as `<decimal UTF-8 byte length>:<UTF-8 bytes>`. */
export function encodeCanonicalLockComponent(value: string): Buffer {
  const bytes = utf8Bytes(value);
  const prefix = utf8Bytes(`${bytes.length}:`);
  return Buffer.concat([prefix, bytes]);
}

export function canonicalLockPreimage(components: readonly string[]): Buffer {
  return Buffer.concat(components.map(encodeCanonicalLockComponent));
}

export function lockIdentityComponents(
  identity: CanonicalLockIdentity,
): string[] {
  if (identity.resourceKind === "InventoryLevel") {
    return [
      CANONICAL_LOCK_VERSION,
      identity.shopId,
      "InventoryLevel",
      identity.inventoryItemGid,
      identity.locationGid,
    ];
  }
  return [
    CANONICAL_LOCK_VERSION,
    identity.shopId,
    identity.resourceKind,
    identity.shopifyGid,
  ];
}

/**
 * Derive signed int32 advisory keys from SHA-256 digest bytes 0..7.
 * Never converts the first eight bytes into a JavaScript Number / 64-bit key.
 */
export function deriveCanonicalLockKey(
  identity: CanonicalLockIdentity,
): CanonicalLockKey {
  const preimage = canonicalLockPreimage(lockIdentityComponents(identity));
  const digest = createHash("sha256").update(preimage).digest();
  return {
    key1: digest.readInt32BE(0),
    key2: digest.readInt32BE(4),
    digestHex: digest.toString("hex"),
    preimage,
  };
}

export function compareCanonicalLockKeys(
  a: CanonicalLockKey,
  b: CanonicalLockKey,
): number {
  if (a.key1 !== b.key1) return a.key1 < b.key1 ? -1 : 1;
  if (a.key2 !== b.key2) return a.key2 < b.key2 ? -1 : 1;
  return 0;
}

export function sortCanonicalLockKeysAscending(
  keys: readonly CanonicalLockKey[],
): CanonicalLockKey[] {
  return [...keys].sort(compareCanonicalLockKeys);
}

export function dedupeCanonicalLockKeys(
  keys: readonly CanonicalLockKey[],
): CanonicalLockKey[] {
  const seen = new Set<string>();
  const out: CanonicalLockKey[] = [];
  for (const key of keys) {
    const id = `${key.key1}:${key.key2}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
}

/** Deterministic multi-identity acquisition order: dedupe, then ascending (key1, key2). */
export function orderCanonicalLockKeysForAcquisition(
  keys: readonly CanonicalLockKey[],
): CanonicalLockKey[] {
  return sortCanonicalLockKeysAscending(dedupeCanonicalLockKeys(keys));
}
