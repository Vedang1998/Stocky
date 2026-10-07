import { timingSafeEqual } from "node:crypto";

export function replayRequestDigestAgrees(
  storedDigest: string,
  computedDigest: string,
): boolean {
  const stored = Buffer.from(storedDigest, "utf8");
  const computed = Buffer.from(computedDigest, "utf8");
  return (
    stored.length === computed.length && timingSafeEqual(stored, computed)
  );
}
