import { beforeEach, describe, expect, it } from "vitest";
import { verifiedActorFromExactSub } from "../actor.server";
import {
  associatedUserIdCorroboration,
  ownerProofAccessTokenPresent,
  proveShopOwner,
  withProvenOwnerAccessToken,
} from "../owner-proof.server";
import {
  authxExchanges,
  authxGraphql,
  offlineTokenSha256,
  onlineTokenSha256,
  resetAuthxMock,
  SAFE_SUB,
  setAuthxGraphqlCapture,
  setExchangeOverride,
  setOnlineAssociatedUser,
  SHOP_A,
  sha256Utf8,
  WIDE_SUB,
} from "./authx-mock";
import {
  adminRequest,
  installAuthxFetch,
  signIdToken,
  testVerifier,
} from "./harness";

beforeEach(() => {
  installAuthxFetch();
  resetAuthxMock();
});

function ownerUser(id: unknown, extras?: Record<string, unknown>) {
  return {
    id,
    first_name: "Owner",
    last_name: "User",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
    ...extras,
  };
}

describe("owner-proof adapter (D-PR7-02/04)", () => {
  const verifier = testVerifier();

  it("grants owner only for safe-integer matching associated_user (PR7-ACT-020)", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof.status).toBe("owner");
    expect(proof.status === "owner" && proof.associatedUserId).toBe(SAFE_SUB);
    expect(JSON.stringify(proof)).not.toContain("shpat_");
    expect(authxExchanges()).toHaveLength(1);
    expect(authxGraphql()).toHaveLength(0);
  });

  it("does not grant owner from sub or offline token (PR7-ACT-015)", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009, { account_owner: false }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof).toMatchObject({
      status: "not_owner",
      code: "OWNER_PROOF_NOT_OWNER",
    });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
  });

  it("ignores client body account_owner (AUTH-X-20 / PR7-ACT-019)", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009, { account_owner: false }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      clientAccountOwner: true,
      fresh: true,
    });
    expect(proof.status).toBe("not_owner");
  });

  it("treats collaborator as not owner (AUTH-X-19)", async () => {
    setOnlineAssociatedUser(() =>
      ownerUser(548380009, { account_owner: true, collaborator: true }),
    );
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof.status).toBe("not_owner");
  });

  it("returns OWNER_PROOF_UNSUPPORTED for wide associated_user.id (PR7-ACT-021)", async () => {
    expect(associatedUserIdCorroboration(Number(WIDE_SUB), WIDE_SUB)).toBe(
      "unsafe",
    );
    setOnlineAssociatedUser(() => ownerUser(Number(WIDE_SUB)));
    const token = await signIdToken({ sub: WIDE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(WIDE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof).toMatchObject({
      status: "unsupported",
      code: "OWNER_PROOF_UNSUPPORTED",
      reason: "UNSAFE_ASSOCIATED_USER_ID",
    });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
    expect(authxGraphql()).toHaveLength(0);
  });

  it("returns unsupported on associated_user mismatch (AUTH-X-21 / PR7-ACT-023)", async () => {
    setOnlineAssociatedUser(() => ownerUser(999999));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof).toMatchObject({
      status: "unsupported",
      reason: "ASSOCIATED_USER_MISMATCH",
    });
    expect(() =>
      withProvenOwnerAccessToken(proof, () => {
        throw new Error("must not use token");
      }),
    ).toThrow(/No proven owner credential/);
  });

  it("returns unsupported when associated_user is omitted (AUTH-X-27)", async () => {
    setOnlineAssociatedUser(() => null);
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof).toMatchObject({
      status: "unsupported",
      reason: "MISSING_ASSOCIATED_USER",
    });
  });

  it("denies on 401 without offline fallback", async () => {
    setExchangeOverride(() => ({
      status: 401,
      body: { error: "unauthorized" },
    }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof).toMatchObject({
      status: "denied",
      reason: "HTTP_401",
    });
    expect(offlineTokenSha256(SHOP_A)).toBe(
      sha256Utf8(`shpat_offline_${SHOP_A}`),
    );
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
  });

  it("denies on 403 without using an access token", async () => {
    setExchangeOverride(() => ({
      status: 403,
      body: { error: "access_denied" },
    }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    expect(proof).toMatchObject({ reason: "HTTP_403" });
  });

  it("retry after 401 still denies and does not GraphQL", async () => {
    setExchangeOverride(() => ({
      status: 401,
      body: { error: "unauthorized" },
    }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const first = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
      fresh: true,
    });
    const second = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
      fresh: true,
    });
    expect(first.status).toBe("denied");
    expect(second.status).toBe("denied");
    expect(authxExchanges().length).toBe(2);
    expect(authxGraphql()).toHaveLength(0);
  });

  it("does not use an expired online token (AUTH-X-13)", async () => {
    setExchangeOverride(() => ({
      status: 200,
      body: {
        access_token: `shpat_online_${SHOP_A}_${SAFE_SUB}`,
        scope: "read_products",
        expires_in: 0,
        associated_user_scope: "read_products",
        associated_user: ownerUser(548380009),
      },
    }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      now: new Date(Date.now() + 1000),
      fresh: true,
    });
    expect(proof).toMatchObject({ status: "denied", reason: "EXPIRED" });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
  });

  it("changed user on a later request exchanges again and binds the new sub", async () => {
    const switched = "548380010";
    setOnlineAssociatedUser((payload) =>
      ownerUser(Number(payload.sub), { account_owner: true }),
    );
    const token1 = await signIdToken({ sub: SAFE_SUB });
    const token2 = await signIdToken({ sub: switched });
    const first = await proveShopOwner({
      request: adminRequest({ token: token1 }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token1,
      fresh: true,
    });
    const second = await proveShopOwner({
      request: adminRequest({ token: token2 }),
      verifier,
      actor: verifiedActorFromExactSub(switched, SHOP_A),
      idToken: token2,
      fresh: true,
    });
    expect(first).toMatchObject({ status: "owner", associatedUserId: SAFE_SUB });
    expect(second).toMatchObject({
      status: "owner",
      associatedUserId: switched,
    });
    expect(authxExchanges()).toHaveLength(2);
    const used: string[] = [];
    await withProvenOwnerAccessToken(first, (accessToken) => {
      used.push(sha256Utf8(accessToken));
    });
    await withProvenOwnerAccessToken(second, (accessToken) => {
      used.push(sha256Utf8(accessToken));
    });
    expect(used).toEqual([
      onlineTokenSha256(SHOP_A, SAFE_SUB),
      onlineTokenSha256(SHOP_A, switched),
    ]);
    expect(used[0]).not.toBe(used[1]);
  });

  it("allows GraphQL only with the bound owner token after proof", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setAuthxGraphqlCapture(true);
    const token = await signIdToken({ sub: SAFE_SUB });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
      fresh: true,
    });
    await withProvenOwnerAccessToken(proof, async (accessToken) => {
      await fetch(`https://${SHOP_A}/admin/api/2026-07/graphql.json`, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({ query: "{ shop { name } }" }),
      });
    });
    const graphql = authxGraphql();
    expect(graphql).toHaveLength(1);
    expect(graphql[0]?.accessTokenSha256).toBe(onlineTokenSha256(SHOP_A, SAFE_SUB));
    expect(graphql[0]?.accessTokenSha256).not.toBe(sha256Utf8(token));
  });
});
