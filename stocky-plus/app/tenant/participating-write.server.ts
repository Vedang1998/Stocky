/**
 * Lifecycle shared participating-write guard (PR7 §7.9).
 *
 * Required, not optional, at tenant and control-plane transaction hosts.
 * processingEnabled is admission, not a drain of an already-open writer.
 * Customer-target fencing is a separate guard used by bound-effect hosts.
 */
import { Prisma } from "@prisma/client";

type RawClient = {
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

export async function assertParticipatingWriteGuard(
  tx: RawClient,
  canonicalDomain: string,
): Promise<void> {
  if (!canonicalDomain) {
    throw new Error("participating_write_domain_missing");
  }
  await tx.$executeRaw`SELECT stocky_participating_write_guard(${canonicalDomain})`;
}

export async function assertParticipatingWriteGuardForShop(
  tx: RawClient,
  shopId: string,
  declaredDomain?: string | null,
): Promise<string> {
  if (!shopId) {
    throw new Error("participating_write_shop_missing");
  }
  const declared = declaredDomain ?? null;
  const rows = await tx.$queryRaw<Array<{ domain: string }>>`
    SELECT stocky_shop_canonical_domain(${shopId}, ${declared}) AS domain
  `;
  const domain = rows[0]?.domain;
  if (!domain) {
    throw new Error("participating_write_domain_unresolved");
  }
  await assertParticipatingWriteGuard(tx, domain);
  return domain;
}
