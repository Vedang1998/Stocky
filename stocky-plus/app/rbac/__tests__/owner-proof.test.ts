import { inspect } from "node:util";
import { beforeEach, describe, expect, it } from "vitest";
import { verifiedActorFromExactSub } from "../actor.server";
import { ActorBoundaryError } from "../errors.server";
import {
  __ownerProofExpiresAtMsForTests,
  __setOwnerProofNowMsForTests,
  assertAuthenticOwnerProof,
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
  setExchangeDelayMs,
  setExchangeOverride,
  setOnlineAssociatedUser,
  SHOP_A,
  SHOP_B,
  sha256Utf8,
  TEST_API_KEY,
  WIDE_SUB,
} from "./authx-mock";
import { createShopifyVerifier } from "../shopify-verifier.server";
import {
  adminRequest,
  installAuthxFetch,
  signIdToken,
  testVerifier,
} from "./harness";

beforeEach(() => {
  installAuthxFetch();
  resetAuthxMock();
  __setOwnerProofNowMsForTests(null);
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
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
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
    });
    expect(proof).toMatchObject({
      status: "not_owner",
      code: "OWNER_PROOF_NOT_OWNER",
    });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
  });

  it("ignores client JSON body account_owner (AUTH-X-20 / PR7-ACT-019)", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009, { account_owner: false }));
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = new Request(`https://example.com/app?shop=${SHOP_A}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ account_owner: true, role: "shop_owner" }),
    });
    const proof = await proveShopOwner({
      request,
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
    });
    expect(proof.status).toBe("not_owner");
  });

  it("rejects forged JWT account_owner at the exchange associated_user boundary", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009, { account_owner: false }));
    const token = await signIdToken({
      sub: SAFE_SUB,
      extra: { account_owner: true, role: "shop_owner" },
    });
    const proof = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: token,
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
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(proof).toMatchObject({
      status: "unsupported",
      reason: "ASSOCIATED_USER_MISMATCH",
    });
    expect(() =>
      withProvenOwnerAccessToken(proof, { request, actor }, () => {
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
    });
    expect(proof).toMatchObject({ reason: "HTTP_403" });
  });

  it("cached denied 401 coalesces on the same request; a new request exchanges again", async () => {
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
    });
    const second = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(first.status).toBe("denied");
    expect(second.status).toBe("denied");
    expect(authxExchanges()).toHaveLength(1);
    const third = await proveShopOwner({
      request: adminRequest({ token }),
      verifier,
      actor,
      idToken: token,
    });
    expect(third.status).toBe("denied");
    expect(authxExchanges()).toHaveLength(2);
    expect(authxGraphql()).toHaveLength(0);
  });

  it("does not use an expired online token (AUTH-X-13)", async () => {
    setExchangeOverride(() => ({
      status: 200,
      body: {
        access_token: `shpat_online_${SHOP_A}_${SAFE_SUB}`,
        scope: "read_products",
        expires_in: -1,
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
    });
    expect(proof).toMatchObject({ status: "denied", reason: "EXPIRED" });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
  });

  it("returns unsupported when provider expiry is missing", async () => {
    setExchangeOverride(() => ({
      status: 200,
      body: {
        access_token: `shpat_online_${SHOP_A}_${SAFE_SUB}`,
        scope: "read_products",
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
    });
    expect(proof).toMatchObject({
      status: "unsupported",
      reason: "MISSING_EXPIRY",
    });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
  });

  it("returns unsupported when provider expiry is malformed", async () => {
    setExchangeOverride(() => ({
      status: 200,
      body: {
        access_token: `shpat_online_${SHOP_A}_${SAFE_SUB}`,
        scope: "read_products",
        expires_in: "not-a-number",
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
    });
    expect(proof).toMatchObject({
      status: "unsupported",
      reason: "MISSING_EXPIRY",
    });
  });

  it("changed user on a later request exchanges again and binds the new sub", async () => {
    const switched = "548380010";
    setOnlineAssociatedUser((payload) =>
      ownerUser(Number(payload.sub), { account_owner: true }),
    );
    const token1 = await signIdToken({ sub: SAFE_SUB });
    const token2 = await signIdToken({ sub: switched });
    const request1 = adminRequest({ token: token1 });
    const request2 = adminRequest({ token: token2 });
    const actor1 = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const actor2 = verifiedActorFromExactSub(switched, SHOP_A);
    const first = await proveShopOwner({
      request: request1,
      verifier,
      actor: actor1,
      idToken: token1,
    });
    const second = await proveShopOwner({
      request: request2,
      verifier,
      actor: actor2,
      idToken: token2,
    });
    expect(first).toMatchObject({ status: "owner", associatedUserId: SAFE_SUB });
    expect(second).toMatchObject({
      status: "owner",
      associatedUserId: switched,
    });
    expect(authxExchanges()).toHaveLength(2);
    const used: string[] = [];
    await withProvenOwnerAccessToken(first, { request: request1, actor: actor1 }, (accessToken) => {
      used.push(sha256Utf8(accessToken));
    });
    await withProvenOwnerAccessToken(second, { request: request2, actor: actor2 }, (accessToken) => {
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
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    await withProvenOwnerAccessToken(proof, { request, actor }, async (accessToken) => {
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

  it("same-Request changed actor/token/shop/verifier fail closed without a cached owner or extra exchange", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const first = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(first.status).toBe("owner");
    expect(authxExchanges()).toHaveLength(1);

    const otherToken = await signIdToken({ sub: "548380010" });
    const otherActor = verifiedActorFromExactSub("548380010", SHOP_A);
    const otherVerifier = createShopifyVerifier({
      apiKey: `${TEST_API_KEY}-other`,
      apiSecretKey: "pr7-a-test-api-secret",
    });

    const changedActor = await proveShopOwner({
      request,
      verifier,
      actor: otherActor,
      idToken: token,
    });
    const changedToken = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: otherToken,
    });
    const changedShop = await proveShopOwner({
      request,
      verifier,
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_B),
      idToken: token,
    });
    const changedVerifier = await proveShopOwner({
      request,
      verifier: otherVerifier,
      actor,
      idToken: token,
    });
    expect(changedActor).toMatchObject({
      status: "denied",
      reason: "BINDING_CONFLICT",
    });
    expect(changedToken).toMatchObject({ reason: "BINDING_CONFLICT" });
    expect(changedShop).toMatchObject({ reason: "BINDING_CONFLICT" });
    expect(changedVerifier).toMatchObject({ reason: "BINDING_CONFLICT" });
    expect(authxExchanges()).toHaveLength(1);
    expect(ownerProofAccessTokenPresent(changedActor)).toBe(false);
  });

  it("identical concurrent calls coalesce to one exchange", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setExchangeDelayMs(40);
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const input = { request, verifier, actor, idToken: token };
    const [a, b] = await Promise.all([
      proveShopOwner(input),
      proveShopOwner(input),
    ]);
    expect(a.status).toBe("owner");
    expect(b.status).toBe("owner");
    expect(a).toBe(b);
    expect(authxExchanges()).toHaveLength(1);
  });

  it("conflicting concurrent calls never coalesce to the other actor", async () => {
    setOnlineAssociatedUser((payload) =>
      ownerUser(Number(payload.sub), { account_owner: true }),
    );
    setExchangeDelayMs(40);
    const token1 = await signIdToken({ sub: SAFE_SUB });
    const token2 = await signIdToken({ sub: "548380010" });
    const request = adminRequest({ token: token1 });
    const [first, second] = await Promise.all([
      proveShopOwner({
        request,
        verifier,
        actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
        idToken: token1,
      }),
      proveShopOwner({
        request,
        verifier,
        actor: verifiedActorFromExactSub("548380010", SHOP_A),
        idToken: token2,
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual(["denied", "owner"]);
    const owner = first.status === "owner" ? first : second;
    const deniedProof = first.status === "denied" ? first : second;
    expect(owner.status === "owner" && owner.associatedUserId).toBe(SAFE_SUB);
    expect(deniedProof).toMatchObject({ reason: "BINDING_CONFLICT" });
    expect(authxExchanges()).toHaveLength(1);
  });

  it("freezes inputs before exchange so caller mutation cannot change the binding", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setExchangeDelayMs(40);
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const input = {
      request,
      verifier,
      actor,
      idToken: token,
    };
    const pending = proveShopOwner(input);
    input.idToken = "garbage-not-a-jwt";
    input.actor = verifiedActorFromExactSub("999999999", SHOP_B);
    const proof = await pending;
    expect(proof.status).toBe("owner");
    expect(proof.status === "owner" && proof.associatedUserId).toBe(SAFE_SUB);
    expect(authxExchanges()).toHaveLength(1);
    await withProvenOwnerAccessToken(
      proof,
      { request, actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A) },
      (accessToken) => {
        expect(sha256Utf8(accessToken)).toBe(onlineTokenSha256(SHOP_A, SAFE_SUB));
      },
    );
  });

  it("spread, clone, and forged handles cannot use the credential", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
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
    const spread = { ...proof };
    const forged = {
      status: "owner" as const,
      actor,
      associatedUserId: SAFE_SUB,
    };
    expect(() =>
      withProvenOwnerAccessToken(spread, { request, actor }, () => "used"),
    ).toThrow(ActorBoundaryError);
    expect(() =>
      withProvenOwnerAccessToken(forged, { request, actor }, () => "used"),
    ).toThrow(ActorBoundaryError);
    expect(() => structuredClone(proof)).not.toThrow();
    const cloned = structuredClone(proof);
    expect(() =>
      withProvenOwnerAccessToken(cloned, { request, actor }, () => "used"),
    ).toThrow(ActorBoundaryError);
  });

  it("inspect, JSON, and symbol reflection do not reveal the credential", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    const shown = inspect(proof, { showHidden: true, depth: 8, getters: true });
    expect(shown).not.toMatch(/shpat_/);
    expect(shown).toMatch(/redacted/);
    expect(JSON.stringify(proof)).not.toMatch(/shpat_/);
    const symbols = Object.getOwnPropertySymbols(proof);
    for (const symbol of symbols) {
      const value = (proof as Record<symbol, unknown>)[symbol];
      expect(String(value)).not.toMatch(/shpat_/);
    }
    expect(Object.getOwnPropertyNames(proof).join(",")).not.toMatch(/shpat_/);
  });

  it("valid use before expiry; exact expiry boundary and after deny with zero effect", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
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
    const expiresAtMs = __ownerProofExpiresAtMsForTests(proof);
    expect(expiresAtMs).toBeGreaterThan(Date.now());
    __setOwnerProofNowMsForTests(expiresAtMs! - 1);
    let used = 0;
    withProvenOwnerAccessToken(proof, { request, actor }, () => {
      used += 1;
    });
    expect(used).toBe(1);
    __setOwnerProofNowMsForTests(expiresAtMs!);
    expect(() =>
      withProvenOwnerAccessToken(proof, { request, actor }, () => {
        used += 1;
      }),
    ).toThrow(ActorBoundaryError);
    __setOwnerProofNowMsForTests(expiresAtMs! + 1);
    expect(() =>
      withProvenOwnerAccessToken(proof, { request, actor }, () => {
        used += 1;
      }),
    ).toThrow(ActorBoundaryError);
    expect(used).toBe(1);
    expect(authxGraphql()).toHaveLength(0);
  });

  it("expiry during exchange await denies and does not issue a usable handle", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setExchangeDelayMs(30);
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const pending = proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    __setOwnerProofNowMsForTests(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const proof = await pending;
    expect(proof).toMatchObject({ status: "denied", reason: "EXPIRED" });
    expect(ownerProofAccessTokenPresent(proof)).toBe(false);
    expect(() =>
      withProvenOwnerAccessToken(proof, { request, actor }, () => "used"),
    ).toThrow(ActorBoundaryError);
  });

  it("same-apiKey different-secret verifier cannot reuse the memoized proof", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const first = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(first.status).toBe("owner");
    expect(authxExchanges()).toHaveLength(1);

    const sameKeyDifferentSecret = createShopifyVerifier({
      apiKey: TEST_API_KEY,
      apiSecretKey: "pr7-a-other-api-secret",
    });
    expect(sameKeyDifferentSecret.apiKey).toBe(verifier.apiKey);
    expect(sameKeyDifferentSecret.identity).not.toBe(verifier.identity);

    const conflicted = await proveShopOwner({
      request,
      verifier: sameKeyDifferentSecret,
      actor,
      idToken: token,
    });
    expect(conflicted).toMatchObject({
      status: "denied",
      reason: "BINDING_CONFLICT",
    });
    expect(ownerProofAccessTokenPresent(conflicted)).toBe(false);
    expect(authxExchanges()).toHaveLength(1);
  });

  it("concurrent same-apiKey different-secret calls never coalesce to the other verifier", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setExchangeDelayMs(40);
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const otherVerifier = createShopifyVerifier({
      apiKey: TEST_API_KEY,
      apiSecretKey: "pr7-a-other-api-secret",
    });
    const [first, second] = await Promise.all([
      proveShopOwner({
        request,
        verifier,
        actor,
        idToken: token,
      }),
      proveShopOwner({
        request,
        verifier: otherVerifier,
        actor,
        idToken: token,
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual(["denied", "owner"]);
    const owner = first.status === "owner" ? first : second;
    const deniedProof = first.status === "denied" ? first : second;
    expect(owner.status === "owner" && owner.associatedUserId).toBe(SAFE_SUB);
    expect(deniedProof).toMatchObject({ reason: "BINDING_CONFLICT" });
    expect(authxExchanges()).toHaveLength(1);
  });

  it("production-mode clock override cannot revive an expired proof", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setExchangeOverride(() => ({
      status: 200,
      body: {
        access_token: `shpat_online_${SHOP_A}_${SAFE_SUB}`,
        scope: "read_products",
        expires_in: 1,
        associated_user_scope: "read_products",
        associated_user: ownerUser(548380009),
      },
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
    expect(proof.status).toBe("owner");
    const expiresAtMs = __ownerProofExpiresAtMsForTests(proof);
    expect(expiresAtMs).toBeGreaterThan(0);
    const waitMs = Math.max(0, expiresAtMs! - Date.now()) + 50;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    expect(() =>
      withProvenOwnerAccessToken(proof, { request, actor }, () => "used"),
    ).toThrow(ActorBoundaryError);

    const previousNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      __setOwnerProofNowMsForTests(expiresAtMs! - 60_000);
      expect(() =>
        withProvenOwnerAccessToken(proof, { request, actor }, () => "revived"),
      ).toThrow(ActorBoundaryError);
      expect(authxGraphql()).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      __setOwnerProofNowMsForTests(null);
    }
  });

  it("changed actor at use is denied with zero outbound effect", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
    setAuthxGraphqlCapture(true);
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const proof = await proveShopOwner({
      request,
      verifier,
      actor,
      idToken: token,
    });
    expect(() =>
      withProvenOwnerAccessToken(
        proof,
        { request, actor: verifiedActorFromExactSub("548380010", SHOP_A) },
        () => "used",
      ),
    ).toThrow(ActorBoundaryError);
    expect(() =>
      withProvenOwnerAccessToken(
        proof,
        { request: adminRequest({ token }), actor },
        () => "used",
      ),
    ).toThrow(ActorBoundaryError);
    expect(authxGraphql()).toHaveLength(0);
  });

  it("assertAuthenticOwnerProof rejects a forged owner handle (B0-01)", async () => {
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ token });
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    const forged = {
      status: "owner" as const,
      actor,
      associatedUserId: SAFE_SUB,
    };
    expect(() =>
      assertAuthenticOwnerProof(forged, {
        request,
        actor,
        expectedDestShop: SHOP_A,
      }),
    ).toThrow(ActorBoundaryError);
  });

  it("assertAuthenticOwnerProof accepts a live handle and denies dest mismatch (B0-01)", async () => {
    setOnlineAssociatedUser(() => ownerUser(548380009));
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
    assertAuthenticOwnerProof(proof, {
      request,
      actor,
      expectedDestShop: SHOP_A,
    });
    expect(() =>
      assertAuthenticOwnerProof(proof, {
        request,
        actor,
        expectedDestShop: SHOP_B,
      }),
    ).toThrow(/shop mismatch/);
  });
});
