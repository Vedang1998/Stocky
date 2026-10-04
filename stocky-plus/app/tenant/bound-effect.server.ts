/**
 * Bound customer-effect host. Computes pr7-effect-v1 from the frozen snapshot,
 * revalidates work identity as a locator, then writes that snapshot only.
 */
import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { withTenantBoundTransaction } from "./db-context.server";
import type { TenantAuthority } from "./authority.server";

export type BoundCustomerEffectInput = {
  kind: string;
  value: string;
  operation: string;
  body: string;
  workId: string;
  effectId?: string;
};

export type FrozenCustomerEffect = {
  readonly domain: string;
  readonly shopId: string;
  readonly kind: string;
  readonly value: string;
  readonly operation: string;
  readonly body: string;
  readonly workId: string;
  readonly effectId: string;
  readonly effectCommitment: string;
};

function freezeEffect(
  authority: TenantAuthority,
  input: BoundCustomerEffectInput,
): FrozenCustomerEffect {
  const effectId = input.effectId ?? randomUUID();
  const domain = authority.myshopifyDomain;
  const payload = [
    "pr7-effect-v1",
    domain,
    authority.shopId,
    input.kind,
    input.value,
    effectId,
  ].join("\n");
  const effectCommitment = createHash("sha256").update(payload).digest("hex");
  return Object.freeze({
    domain,
    shopId: authority.shopId,
    kind: input.kind,
    value: input.value,
    operation: input.operation,
    body: input.body,
    workId: input.workId,
    effectId,
    effectCommitment,
  });
}

export async function applyBoundCustomerEffect<T>(
  prisma: PrismaClient,
  authority: TenantAuthority,
  input: BoundCustomerEffectInput,
  write: (tx: Parameters<Parameters<typeof withTenantBoundTransaction>[2]>[0], frozen: FrozenCustomerEffect) => Promise<T>,
): Promise<T> {
  const frozen = freezeEffect(authority, input);
  return withTenantBoundTransaction(prisma, authority, async (tx) => {
    await tx.$executeRaw`SELECT stocky_bind_execution_context(${frozen.workId})`;
    await tx.$executeRaw`
      SELECT stocky_apply_bound_customer_effect(
        ${frozen.domain},
        ${frozen.shopId},
        ${frozen.kind},
        ${frozen.value},
        ${frozen.effectId},
        ${frozen.workId},
        ${frozen.operation},
        ${frozen.body}
      )
    `;
    return write(tx, frozen);
  });
}
