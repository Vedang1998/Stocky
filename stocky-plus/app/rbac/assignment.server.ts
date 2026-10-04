/**
 * Platform assignment grant/revoke. Advisory authz lock then fresh SELECT-only
 * verify on the same effect transaction. Missing/deleted assignments deny.
 */
import rawPrisma from "../db.server";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { emitAuditEvent } from "../audit/emit.server";
import type { TenantAuthority } from "../tenant/authority.server";
import { withTenantBoundTransaction } from "../tenant/db-context.server";
import { createTenantDb } from "../tenant/tenant-db.server";
import { ActorBoundaryError } from "./errors.server";

export const PLATFORM_PERMISSIONS = ["platform.replay.execute"] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

const ASSIGNABLE_ROLES = ["shop_owner", "shop_admin"] as const;

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

export async function grantShopRole(input: {
  tenant: TenantAuthority;
  targetShopifyUserId: string;
  role: (typeof ASSIGNABLE_ROLES)[number];
  grantedBy: string;
}): Promise<void> {
  if (!/^[0-9]+$/.test(input.targetShopifyUserId)) {
    throw new ActorBoundaryError(
      "ACTOR_SUB_UNSUPPORTED",
      "Target actor id is not an exact digit string",
    );
  }
  await withTenantBoundTransaction(rawPrisma, input.tenant, async (tx) => {
    await tx.$executeRaw`SELECT stocky_authz_lock_pair(${input.tenant.shopId}, ${input.grantedBy}, ${input.targetShopifyUserId})`;
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
        grantedBy: input.grantedBy,
      },
      update: {
        revokedAt: null,
        revokedBy: null,
        grantedBy: input.grantedBy,
        grantedAt: new Date(),
        rowVersion: { increment: 1 },
      },
    });
  });
  const db = createTenantDb(input.tenant);
  await emitAuditEvent(db, {
    actorKind: "human",
    actorId: input.grantedBy,
    action: "role.grant",
    outcome: "succeeded",
    resourceType: "ShopRoleAssignment",
    resourceId: input.targetShopifyUserId,
  });
}

export async function revokeShopRole(input: {
  tenant: TenantAuthority;
  targetShopifyUserId: string;
  role: (typeof ASSIGNABLE_ROLES)[number];
  revokedBy: string;
}): Promise<void> {
  await withTenantBoundTransaction(rawPrisma, input.tenant, async (tx) => {
    await tx.$executeRaw`SELECT stocky_authz_lock_pair(${input.tenant.shopId}, ${input.revokedBy}, ${input.targetShopifyUserId})`;
    await tx.shopRoleAssignment.updateMany({
      where: {
        shopId: input.tenant.shopId,
        shopifyUserId: input.targetShopifyUserId,
        role: input.role,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedBy: input.revokedBy,
        rowVersion: { increment: 1 },
      },
    });
  });
  const db = createTenantDb(input.tenant);
  await emitAuditEvent(db, {
    actorKind: "human",
    actorId: input.revokedBy,
    action: "role.revoke",
    outcome: "succeeded",
    resourceType: "ShopRoleAssignment",
    resourceId: input.targetShopifyUserId,
  });
}
