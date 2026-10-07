/**
 * Bounded owner-only data-request fulfillment. Authorization at use, expiry,
 * minimal diagnostics. Q008 retention remains a production decision; fixture
 * TTLs are synthetic.
 */
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { emitAuditEvent } from "../audit/emit.server";
import type { TenantAuthority } from "../tenant/authority.server";
import { createTenantDb } from "../tenant/tenant-db.server";
import {
  assertAuthenticOwnerProof,
  type OwnerProofSuccess,
} from "../rbac/owner-proof.server";
import {
  decryptPrivacyArtifact,
  encryptPrivacyArtifact,
} from "./artifact-crypto.server";
import { PrivacyBoundaryError } from "./errors.server";

const SYNTHETIC_TTL_MS = 24 * 60 * 60 * 1000;

export type FulfillmentShopBinding = {
  shopId: string;
  canonicalDomain: string;
};

export function privacyRequestVisibleToShop(
  request:
    | {
        targetShopId: string;
        canonicalDomain: string;
        topic: string;
      }
    | null
    | undefined,
  binding: FulfillmentShopBinding,
): boolean {
  if (!request || request.topic !== "customers/data_request") return false;
  return (
    request.targetShopId === binding.shopId &&
    request.canonicalDomain === binding.canonicalDomain
  );
}

async function auditFulfillment(
  tenant: TenantAuthority,
  input: {
    actorId: string;
    outcome: "succeeded" | "failed";
    decision?: string;
    resourceId: string;
  },
): Promise<void> {
  try {
    const db = createTenantDb(tenant);
    await emitAuditEvent(db, {
      actorKind: "human",
      actorId: input.actorId,
      action: "privacy.data_request.download",
      outcome: input.outcome,
      decision: input.decision ?? input.outcome,
      resourceType: "PrivacyDataRequestArtifact",
      resourceId: input.resourceId,
    });
  } catch {
    // Do not mask the fulfillment error if audit insert fails.
  }
}

async function denyMissing(
  tenant: TenantAuthority,
  actorId: string,
  requestId: string,
): Promise<never> {
  await auditFulfillment(tenant, {
    actorId,
    outcome: "failed",
    decision: "data_request_missing",
    resourceId: requestId,
  });
  throw new PrivacyBoundaryError(
    "data_request_missing",
    "No data_request for this identifier",
  );
}

export async function materializeDataRequestArtifact(input: {
  requestId: string;
  owner: OwnerProofSuccess;
  shopId: string;
  canonicalDomain: string;
  tenant: TenantAuthority;
  request: Request;
}): Promise<{ artifactId: string; expiresAt: Date }> {
  assertAuthenticOwnerProof(input.owner, {
    request: input.request,
    actor: input.owner.actor,
    expectedDestShop: input.canonicalDomain,
  });
  const binding = {
    shopId: input.shopId,
    canonicalDomain: input.canonicalDomain,
  };
  if (
    input.shopId !== input.tenant.shopId ||
    input.canonicalDomain !== input.tenant.myshopifyDomain
  ) {
    return denyMissing(
      input.tenant,
      input.owner.actor.shopifyUserId,
      input.requestId,
    );
  }
  const prisma = getControlPlanePrisma();
  const found = await prisma.privacyRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!found || !privacyRequestVisibleToShop(found, binding)) {
    return denyMissing(
      input.tenant,
      input.owner.actor.shopifyUserId,
      input.requestId,
    );
  }
  const request = found;
  if (request.state !== "FULFILLING" && request.state !== "COMPLETED") {
    await auditFulfillment(input.tenant, {
      actorId: input.owner.actor.shopifyUserId,
      outcome: "failed",
      decision: "data_request_not_ready",
      resourceId: input.requestId,
    });
    throw new PrivacyBoundaryError(
      "data_request_not_ready",
      `Request state ${request.state} is not downloadable`,
    );
  }
  const existing = await prisma.privacyDataRequestArtifact.findUnique({
    where: { privacyRequestId: request.id },
  });
  if (existing && existing.expiresAt > new Date()) {
    return { artifactId: existing.id, expiresAt: existing.expiresAt };
  }
  const keys = await prisma.privacyTargetKey.findMany({
    where: { requestId: request.id },
    select: { surface: true, rowId: true },
  });
  const plaintext = JSON.stringify({
    topic: request.topic,
    shop: request.canonicalDomain,
    actor: input.owner.actor.shopifyUserId,
    keys,
  });
  const ciphertext = new Uint8Array(
    encryptPrivacyArtifact(plaintext, {
      shopId: request.targetShopId,
      canonicalDomain: request.canonicalDomain,
      requestId: request.id,
    }),
  );
  const expiresAt = new Date(Date.now() + SYNTHETIC_TTL_MS);
  const row = await prisma.privacyDataRequestArtifact.upsert({
    where: { privacyRequestId: request.id },
    create: {
      privacyRequestId: request.id,
      ciphertext,
      expiresAt,
    },
    update: { ciphertext, expiresAt, downloadedAt: null },
  });
  return { artifactId: row.id, expiresAt: row.expiresAt };
}

export async function downloadDataRequestArtifact(input: {
  requestId: string;
  owner: OwnerProofSuccess;
  shopId: string;
  canonicalDomain: string;
  tenant: TenantAuthority;
  request: Request;
}): Promise<{ body: Buffer; expiresAt: Date }> {
  const { artifactId } = await materializeDataRequestArtifact(input);
  const prisma = getControlPlanePrisma();
  const row = await prisma.privacyDataRequestArtifact.findUnique({
    where: { id: artifactId },
  });
  if (!row || row.expiresAt <= new Date()) {
    await auditFulfillment(input.tenant, {
      actorId: input.owner.actor.shopifyUserId,
      outcome: "failed",
      decision: "artifact_expired",
      resourceId: input.requestId,
    });
    throw new PrivacyBoundaryError("artifact_expired", "Download expired");
  }
  const body = decryptPrivacyArtifact(Buffer.from(row.ciphertext), {
    shopId: input.shopId,
    canonicalDomain: input.canonicalDomain,
    requestId: input.requestId,
  });
  await prisma.privacyDataRequestArtifact.update({
    where: { id: row.id },
    data: { downloadedAt: new Date() },
  });
  await auditFulfillment(input.tenant, {
    actorId: input.owner.actor.shopifyUserId,
    outcome: "succeeded",
    resourceId: input.requestId,
  });
  return { body, expiresAt: row.expiresAt };
}
