/**
 * Platform assignment grant/revoke. Advisory authz lock then fresh SELECT-only
 * verify on the same effect transaction. Missing/deleted assignments deny.
 * Grant/revoke require an authentic owner proof bound to the tenant shop.
 */
import type { Prisma } from "@prisma/client";
import rawPrisma from "../db.server";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import {
  emitAuditEvent,
  emitAuditEventInTransaction,
} from "../audit/emit.server";
import type { TenantAuthority } from "../tenant/authority.server";
import { withTenantBoundTransaction } from "../tenant/db-context.server";
import {
  requireAdminTenant,
  type AdminTenantContext,
  type RequireAdminTenantInput,
} from "../tenant/require-admin-tenant.server";
import {
  gateAdminRequestIdentity,
  verifierFromEnv,
} from "./admin-auth-boundary.server";
import { ActorBoundaryError } from "./errors.server";
import {
  assertAuthenticOwnerProof,
  proveShopOwner,
  type OwnerProofSuccess,
} from "./owner-proof.server";

export const PLATFORM_PERMISSIONS = ["platform.replay.execute"] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

const ASSIGNABLE_ROLES = ["shop_owner", "shop_admin"] as const;
export type AssignableShopRole = (typeof ASSIGNABLE_ROLES)[number];

type RoleMutationOutcome =
  | { status: "ok" }
  | { status: "denied"; code: string; message: string };

export async function lockAndVerifyPlatformAssignment(input: {
  shopId: string;
  actorId: string;
  permission: PlatformPermission;
}): Promise<boolean> {
  const prisma = getControlPlanePrisma();
  await prisma.$executeRaw`SELECT stocky_authz_lock(${input.shopId}, ${input.actorId})`;
  const verified = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
    SELECT stocky_verify_platform_assignment(${input.shopId}, ${input.actorId}, ${input.permission}) AS allowed
  `;
  return verified[0]?.allowed === true;
}

export async function requirePlatformOwner(
  input: RequireAdminTenantInput & { auditAction: string },
): Promise<{ ctx: AdminTenantContext; proof: OwnerProofSuccess }> {
  const ctx = await requireAdminTenant(input);
  if (ctx.actor.status !== "verified") {
    throw new Response("platform_denied", { status: 403 });
  }
  const identity = await gateAdminRequestIdentity({
    request: input.request,
    verifier: input.identityVerifier,
  });
  if (!identity.idToken || !identity.verifiedActor) {
    await emitFailedPlatformAudit(ctx, input.auditAction, "owner_proof_required");
    throw new Response("owner_proof_required", { status: 403 });
  }
  const proof = await proveShopOwner({
    request: input.request,
    verifier: input.identityVerifier ?? verifierFromEnv(),
    actor: identity.verifiedActor,
    idToken: identity.idToken,
  });
  if (proof.status !== "owner") {
    await emitFailedPlatformAudit(ctx, input.auditAction, proof.code);
    throw new Response(proof.code, { status: 403 });
  }
  try {
    assertAuthenticOwnerProof(proof, {
      request: input.request,
      actor: proof.actor,
      expectedDestShop: ctx.shop.myshopifyDomain,
    });
  } catch (error) {
    if (error instanceof ActorBoundaryError) {
      await emitFailedPlatformAudit(ctx, input.auditAction, error.code);
      throw new Response(error.code, { status: 403 });
    }
    throw error;
  }
  return { ctx, proof };
}

async function emitFailedPlatformAudit(
  ctx: AdminTenantContext,
  action: string,
  decision: string,
): Promise<void> {
  try {
    await emitAuditEvent(ctx.db, {
      actorKind: "human",
      actorId:
        ctx.actor.status === "verified" ? ctx.actor.actor.shopifyUserId : null,
      action,
      decision,
      outcome: "failed",
      resourceType: "ShopRoleAssignment",
    });
  } catch {
    // Do not mask the authorization denial if audit insert fails.
  }
}

function assertOwnerBoundToTenant(
  owner: OwnerProofSuccess,
  tenant: TenantAuthority,
  request: Request,
): void {
  assertAuthenticOwnerProof(owner, {
    request,
    actor: owner.actor,
    expectedDestShop: tenant.myshopifyDomain,
  });
}

async function emitRoleAudit(
  tx: Prisma.TransactionClient,
  shopId: string,
  input: {
    actorId: string;
    action: "role.grant" | "role.revoke";
    outcome: "succeeded" | "failed";
    decision?: string;
    resourceId: string;
    detail?: string | null;
  },
): Promise<void> {
  await emitAuditEventInTransaction(tx, shopId, {
    actorKind: "human",
    actorId: input.actorId,
    action: input.action,
    outcome: input.outcome,
    decision: input.decision ?? input.outcome,
    resourceType: "ShopRoleAssignment",
    resourceId: input.resourceId,
    detail: input.detail ?? null,
  });
}

export async function grantShopRole(input: {
  tenant: TenantAuthority;
  targetShopifyUserId: string;
  role: AssignableShopRole;
  owner: OwnerProofSuccess;
  request: Request;
}): Promise<void> {
  assertOwnerBoundToTenant(input.owner, input.tenant, input.request);
  const grantedBy = input.owner.actor.shopifyUserId;
  if (!/^[0-9]+$/.test(input.targetShopifyUserId)) {
    const result = await withTenantBoundTransaction(
      rawPrisma,
      input.tenant,
      async (tx) => {
        await emitRoleAudit(tx, input.tenant.shopId, {
          actorId: grantedBy,
          action: "role.grant",
          outcome: "failed",
          decision: "ACTOR_SUB_UNSUPPORTED",
          resourceId: input.targetShopifyUserId,
        });
        return {
          status: "denied",
          code: "ACTOR_SUB_UNSUPPORTED",
          message: "Target actor id is not an exact digit string",
        } satisfies RoleMutationOutcome;
      },
    );
    throw new ActorBoundaryError(result.code, result.message, 403);
  }
  await withTenantBoundTransaction(rawPrisma, input.tenant, async (tx) => {
    await tx.$executeRaw`SELECT stocky_authz_lock_pair(${input.tenant.shopId}, ${grantedBy}, ${input.targetShopifyUserId})`;
    await tx.shopRoleAssignment.upsert({
      where: {
        shopId_shopifyUserId_role: {
          shopId: input.tenant.shopId,
          shopifyUserId: input.targetShopifyUserId,
          role: input.role,
        },
      },
      create: {
        shopId: input.tenant.shopId,
        shopifyUserId: input.targetShopifyUserId,
        role: input.role,
        grantedBy,
      },
      update: {
        revokedAt: null,
        revokedBy: null,
        grantedBy,
        grantedAt: new Date(),
        rowVersion: { increment: 1 },
      },
    });
    await emitRoleAudit(tx, input.tenant.shopId, {
      actorId: grantedBy,
      action: "role.grant",
      outcome: "succeeded",
      resourceId: input.targetShopifyUserId,
      detail: input.role,
    });
  });
}

export async function revokeShopRole(input: {
  tenant: TenantAuthority;
  targetShopifyUserId: string;
  role: AssignableShopRole;
  owner: OwnerProofSuccess;
  request: Request;
}): Promise<void> {
  assertOwnerBoundToTenant(input.owner, input.tenant, input.request);
  const revokedBy = input.owner.actor.shopifyUserId;
  const result = await withTenantBoundTransaction(
    rawPrisma,
    input.tenant,
    async (tx) => {
      await tx.$executeRaw`SELECT stocky_authz_lock_pair(${input.tenant.shopId}, ${revokedBy}, ${input.targetShopifyUserId})`;
      if (input.role === "shop_owner") {
        const targetActive = await tx.shopRoleAssignment.findFirst({
          where: {
            shopId: input.tenant.shopId,
            shopifyUserId: input.targetShopifyUserId,
            role: "shop_owner",
            revokedAt: null,
          },
          select: { id: true },
        });
        if (targetActive) {
          const otherOwners = await tx.shopRoleAssignment.count({
            where: {
              shopId: input.tenant.shopId,
              role: "shop_owner",
              revokedAt: null,
              shopifyUserId: { not: input.targetShopifyUserId },
            },
          });
          if (otherOwners === 0) {
            await emitRoleAudit(tx, input.tenant.shopId, {
              actorId: revokedBy,
              action: "role.revoke",
              outcome: "failed",
              decision: "LAST_OWNER_REVOKE_DENIED",
              resourceId: input.targetShopifyUserId,
            });
            return {
              status: "denied",
              code: "LAST_OWNER_REVOKE_DENIED",
              message: "Refusing to revoke the last shop_owner",
            } satisfies RoleMutationOutcome;
          }
        }
      }
      const updated = await tx.shopRoleAssignment.updateMany({
        where: {
          shopId: input.tenant.shopId,
          shopifyUserId: input.targetShopifyUserId,
          role: input.role,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedBy,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        await emitRoleAudit(tx, input.tenant.shopId, {
          actorId: revokedBy,
          action: "role.revoke",
          outcome: "failed",
          decision: "ASSIGNMENT_NOT_FOUND",
          resourceId: input.targetShopifyUserId,
        });
        return {
          status: "denied",
          code: "ASSIGNMENT_NOT_FOUND",
          message: "No active assignment to revoke",
        } satisfies RoleMutationOutcome;
      }
      await emitRoleAudit(tx, input.tenant.shopId, {
        actorId: revokedBy,
        action: "role.revoke",
        outcome: "succeeded",
        resourceId: input.targetShopifyUserId,
        detail: input.role,
      });
      return { status: "ok" } satisfies RoleMutationOutcome;
    },
  );
  if (result.status === "denied") {
    throw new ActorBoundaryError(result.code, result.message, 403);
  }
}
