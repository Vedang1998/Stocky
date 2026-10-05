/**
 * B1: owner-proof grant/revoke, last-owner deny, truthful audit, shop-bound
 * data-request download. Requires enforced catalog (authz lock + FORCE RLS).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { resetPrismaSingletonForTests } from "../../../db.server";
import { resetControlPlanePrismaForTests } from "../../../sync/control-plane-db.server";
import { grantShopRole, revokeShopRole } from "../../../rbac/assignment.server";
import { ActorBoundaryError } from "../../../rbac/errors.server";
import { verifiedActorFromExactSub } from "../../../rbac/actor.server";
import { proveShopOwner, type OwnerProofSuccess } from "../../../rbac/owner-proof.server";
import { downloadDataRequestArtifact } from "../../../privacy/fulfillment.server";
import {
  resetAuthxMock,
  SAFE_SUB,
  setOnlineAssociatedUser,
} from "../../../rbac/__tests__/authx-mock";
import {
  adminRequest,
  installAuthxFetch,
  signIdToken,
  testVerifier,
} from "../../../rbac/__tests__/harness";
import { resetAndEnforce } from "./helpers";

const ARTIFACT_KEY =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_SUB = "548380010";

function ownerUser(id: number) {
  return {
    id,
    first_name: "Owner",
    last_name: "User",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
}

async function mintOwnerProof(domain: string): Promise<{
  proof: OwnerProofSuccess;
  request: Request;
}> {
  setOnlineAssociatedUser(() => ownerUser(Number(SAFE_SUB)));
  const token = await signIdToken({
    sub: SAFE_SUB,
    dest: `https://${domain}`,
  });
  const request = adminRequest({ token, shop: domain });
  const actor = verifiedActorFromExactSub(SAFE_SUB, domain);
  const proof = await proveShopOwner({
    request,
    verifier: testVerifier(),
    actor,
    idToken: token,
  });
  if (proof.status !== "owner") {
    throw new Error(`expected owner proof, received ${proof.status}`);
  }
  return { proof, request };
}

async function seedShop(prisma: PrismaClient) {
  const domain = `pr7-b1-${randomUUID()}.myshopify.com`;
  const shop = await prisma.shop.create({
    data: { myshopifyDomain: domain },
  });
  return { shop, domain };
}

describe("PR7 B1 platform authorization", () => {
  let migrationPrisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    process.env.STOCKY_PRIVACY_ARTIFACT_KEY = ARTIFACT_KEY;
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    await resetPrismaSingletonForTests();
    await resetControlPlanePrismaForTests();
  }, 180_000);

  beforeEach(() => {
    installAuthxFetch();
    resetAuthxMock();
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await resetPrismaSingletonForTests();
    await migrationPrisma?.$disconnect();
  });

  it("owner grant writes assignment and succeeded audit (positive, B0-01/04)", async () => {
    const { shop, domain } = await seedShop(migrationPrisma);
    const tenant = issueTenantAuthority({
      shopId: shop.id,
      myshopifyDomain: domain,
      source: "verified_admin_request",
    });
    const { proof, request } = await mintOwnerProof(domain);
    await grantShopRole({
      tenant,
      targetShopifyUserId: OTHER_SUB,
      role: "shop_admin",
      owner: proof,
      request,
    });
    const row = await migrationPrisma.shopRoleAssignment.findFirst({
      where: {
        shopId: shop.id,
        shopifyUserId: OTHER_SUB,
        role: "shop_admin",
        revokedAt: null,
      },
    });
    expect(row?.grantedBy).toBe(SAFE_SUB);
    const audits = await migrationPrisma.auditEvent.findMany({
      where: { shopId: shop.id, action: "role.grant", resourceId: OTHER_SUB },
    });
    expect(audits.some((event) => event.outcome === "succeeded")).toBe(true);
  });

  it("last shop_owner cannot be revoked (negative, B0-01)", async () => {
    const { shop, domain } = await seedShop(migrationPrisma);
    const tenant = issueTenantAuthority({
      shopId: shop.id,
      myshopifyDomain: domain,
      source: "verified_admin_request",
    });
    const { proof, request } = await mintOwnerProof(domain);
    await grantShopRole({
      tenant,
      targetShopifyUserId: SAFE_SUB,
      role: "shop_owner",
      owner: proof,
      request,
    });
    await expect(
      revokeShopRole({
        tenant,
        targetShopifyUserId: SAFE_SUB,
        role: "shop_owner",
        owner: proof,
        request,
      }),
    ).rejects.toMatchObject({ code: "LAST_OWNER_REVOKE_DENIED" });
    const still = await migrationPrisma.shopRoleAssignment.findFirst({
      where: {
        shopId: shop.id,
        shopifyUserId: SAFE_SUB,
        role: "shop_owner",
        revokedAt: null,
      },
    });
    expect(still).not.toBeNull();
    const failed = await migrationPrisma.auditEvent.findMany({
      where: {
        shopId: shop.id,
        action: "role.revoke",
        outcome: "failed",
        decision: "LAST_OWNER_REVOKE_DENIED",
      },
    });
    expect(failed.length).toBeGreaterThan(0);
  });

  it("revoke of a missing assignment audits failed and does not claim success (drift)", async () => {
    const { shop, domain } = await seedShop(migrationPrisma);
    const tenant = issueTenantAuthority({
      shopId: shop.id,
      myshopifyDomain: domain,
      source: "verified_admin_request",
    });
    const { proof, request } = await mintOwnerProof(domain);
    await expect(
      revokeShopRole({
        tenant,
        targetShopifyUserId: "548380099",
        role: "shop_admin",
        owner: proof,
        request,
      }),
    ).rejects.toBeInstanceOf(ActorBoundaryError);
    const succeeded = await migrationPrisma.auditEvent.count({
      where: {
        shopId: shop.id,
        action: "role.revoke",
        outcome: "succeeded",
        resourceId: "548380099",
      },
    });
    expect(succeeded).toBe(0);
    const failed = await migrationPrisma.auditEvent.count({
      where: {
        shopId: shop.id,
        action: "role.revoke",
        outcome: "failed",
        decision: "ASSIGNMENT_NOT_FOUND",
      },
    });
    expect(failed).toBeGreaterThan(0);
  });

  it("second owner can be granted and first owner then revoked (positive last-owner counterpart)", async () => {
    const { shop, domain } = await seedShop(migrationPrisma);
    const tenant = issueTenantAuthority({
      shopId: shop.id,
      myshopifyDomain: domain,
      source: "verified_admin_request",
    });
    const { proof, request } = await mintOwnerProof(domain);
    await grantShopRole({
      tenant,
      targetShopifyUserId: SAFE_SUB,
      role: "shop_owner",
      owner: proof,
      request,
    });
    await grantShopRole({
      tenant,
      targetShopifyUserId: OTHER_SUB,
      role: "shop_owner",
      owner: proof,
      request,
    });
    await revokeShopRole({
      tenant,
      targetShopifyUserId: SAFE_SUB,
      role: "shop_owner",
      owner: proof,
      request,
    });
    const remaining = await migrationPrisma.shopRoleAssignment.findMany({
      where: { shopId: shop.id, role: "shop_owner", revokedAt: null },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.shopifyUserId).toBe(OTHER_SUB);
  });

  it("owner of shop A cannot download shop B data-request (cross-tenant, B0-02)", async () => {
    const shopA = await seedShop(migrationPrisma);
    const shopB = await seedShop(migrationPrisma);
    const tenantA = issueTenantAuthority({
      shopId: shopA.shop.id,
      myshopifyDomain: shopA.domain,
      source: "verified_admin_request",
    });
    const requestId = randomUUID();
    await migrationPrisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "customers/data_request",
        state: "FULFILLING",
        targetShopId: shopB.shop.id,
        generationId: randomUUID(),
        shopRowId: shopB.shop.id,
        canonicalDomain: shopB.domain,
        workId: randomUUID(),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    const { proof, request } = await mintOwnerProof(shopA.domain);
    await expect(
      downloadDataRequestArtifact({
        requestId,
        owner: proof,
        shopId: shopA.shop.id,
        canonicalDomain: shopA.domain,
        tenant: tenantA,
        request,
      }),
    ).rejects.toMatchObject({ code: "data_request_missing" });
    const artifacts = await migrationPrisma.privacyDataRequestArtifact.count({
      where: { privacyRequestId: requestId },
    });
    expect(artifacts).toBe(0);
  });

  it("owner of shop A can download the matching request and ciphertext is not plaintext (B0-02/03)", async () => {
    const shopA = await seedShop(migrationPrisma);
    const tenantA = issueTenantAuthority({
      shopId: shopA.shop.id,
      myshopifyDomain: shopA.domain,
      source: "verified_admin_request",
    });
    const requestId = randomUUID();
    await migrationPrisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "customers/data_request",
        state: "FULFILLING",
        targetShopId: shopA.shop.id,
        generationId: randomUUID(),
        shopRowId: shopA.shop.id,
        canonicalDomain: shopA.domain,
        workId: randomUUID(),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    const { proof, request } = await mintOwnerProof(shopA.domain);
    const downloaded = await downloadDataRequestArtifact({
      requestId,
      owner: proof,
      shopId: shopA.shop.id,
      canonicalDomain: shopA.domain,
      tenant: tenantA,
      request,
    });
    const payload = downloaded.body.toString("utf8");
    expect(payload).toContain(shopA.domain);
    const stored = await migrationPrisma.privacyDataRequestArtifact.findFirst({
      where: { privacyRequestId: requestId },
    });
    expect(stored).not.toBeNull();
    const blob = Buffer.from(stored!.ciphertext);
    expect(blob[0]).toBe(1);
    expect(blob.includes(Buffer.from(shopA.domain, "utf8"))).toBe(false);
  });
});
