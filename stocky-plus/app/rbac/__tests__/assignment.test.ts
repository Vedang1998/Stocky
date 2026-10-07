import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { verifiedActorFromExactSub } from "../actor.server";
import { ActorBoundaryError } from "../errors.server";
import { grantShopRole, revokeShopRole } from "../assignment.server";
import type { OwnerProofSuccess } from "../owner-proof.server";
import {
  proveShopOwner,
} from "../owner-proof.server";
import type { TenantAuthority } from "../../tenant/authority.server";
import {
  resetAuthxMock,
  SAFE_SUB,
  setOnlineAssociatedUser,
  SHOP_A,
  SHOP_B,
} from "./authx-mock";
import { adminRequest, installAuthxFetch, signIdToken, testVerifier } from "./harness";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function ownerUser() {
  return {
    id: 548380009,
    first_name: "Owner",
    last_name: "User",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
}

function unverifiedTenant(domain: string): TenantAuthority {
  return {
    shopId: "shop-not-issued",
    myshopifyDomain: domain,
    source: "verified_admin_request",
    correlationId: "corr-test",
  } as TenantAuthority;
}

describe("platform role assignment (B0-01/B0-04)", () => {
  const verifier = testVerifier();

  beforeEach(() => {
    installAuthxFetch();
    resetAuthxMock();
  });

  it("roles route source requires requirePlatformOwner and does not take grantedBy", () => {
    const text = readFileSync(
      path.join(ROOT, "app/routes/app.platform.roles.tsx"),
      "utf8",
    );
    expect(text).toMatch(/requirePlatformOwner/);
    expect(text).toMatch(/grantShopRole/);
    expect(text).toMatch(/revokeShopRole/);
    expect(text).not.toMatch(/grantedBy:/);
    expect(text).not.toMatch(/revokedBy:/);
  });

  it("forged owner handle cannot grant (negative)", async () => {
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const forged: OwnerProofSuccess = {
      status: "owner",
      actor,
      associatedUserId: SAFE_SUB,
    };
    await expect(
      grantShopRole({
        tenant: unverifiedTenant(SHOP_A),
        targetShopifyUserId: SAFE_SUB,
        role: "shop_owner",
        owner: forged,
        request,
      }),
    ).rejects.toBeInstanceOf(ActorBoundaryError);
  });

  it("staff not_owner cannot self-escalate (bypass)", async () => {
    setOnlineAssociatedUser(() => ({
      ...ownerUser(),
      account_owner: false,
    }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(proof.status).toBe("not_owner");
    await expect(
      grantShopRole({
        tenant: unverifiedTenant(SHOP_A),
        targetShopifyUserId: SAFE_SUB,
        role: "shop_owner",
        owner: proof as OwnerProofSuccess,
        request,
      }),
    ).rejects.toMatchObject({ code: "OWNER_PROOF_UNSUPPORTED" });
  });

  it("authentic owner proof for shop A cannot grant on shop B (negative)", async () => {
    setOnlineAssociatedUser(() => ownerUser());
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(proof.status).toBe("owner");
    await expect(
      grantShopRole({
        tenant: unverifiedTenant(SHOP_B),
        targetShopifyUserId: "548380010",
        role: "shop_admin",
        owner: proof as OwnerProofSuccess,
        request,
      }),
    ).rejects.toMatchObject({ code: "OWNER_PROOF_DENIED" });
  });

  it("revoke also requires an authentic owner proof (negative)", async () => {
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    await expect(
      revokeShopRole({
        tenant: unverifiedTenant(SHOP_A),
        targetShopifyUserId: SAFE_SUB,
        role: "shop_owner",
        owner: {
          status: "owner",
          actor,
          associatedUserId: SAFE_SUB,
        },
        request,
      }),
    ).rejects.toBeInstanceOf(ActorBoundaryError);
  });
});
