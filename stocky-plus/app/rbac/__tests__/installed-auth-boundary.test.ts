import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Session } from "@shopify/shopify-api";
import { beforeEach, describe, expect, it } from "vitest";
import { gateAdminRequestIdentity } from "../admin-auth-boundary.server";
import { requirePlatformActor, verifiedActorFromExactSub } from "../actor.server";
import { ActorBoundaryError } from "../errors.server";
import {
  proveShopOwner,
  withProvenOwnerAccessToken,
} from "../owner-proof.server";
import {
  authxCalls,
  authxExchanges,
  authxGraphql,
  BOT_UA,
  offlineTokenSha256,
  onlineTokenSha256,
  resetAuthxMock,
  SAFE_SUB,
  setAuthxGraphqlCapture,
  setOnlineAssociatedUser,
  SHOP_A,
  SHOP_B,
  sha256Utf8,
  WIDE_ROUNDED,
  WIDE_SUB,
} from "./authx-mock";
import {
  adminRequest,
  caughtResponse,
  createTestShopifyApp,
  embeddedIdTokenUrl,
  installAuthxFetch,
  MemorySessionStorage,
  signIdToken,
  testVerifier,
} from "./harness";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

beforeEach(() => {
  installAuthxFetch();
  resetAuthxMock();
});

describe("configured shopify.server online-token pin", () => {
  it("does not set useOnlineTokens (PREP-A-05 / AUTH-X-34)", () => {
    const src = readFileSync(path.join(APP_ROOT, "app/shopify.server.ts"), "utf8");
    expect(src).not.toMatch(/useOnlineTokens/);
    expect(src).toMatch(/expiringOfflineAccessTokens:\s*true/);
  });
});

describe("installed authenticate.admin boundary (PR49 AUTH-X regressions)", () => {
  it("offline embedded returns sessionToken.sub and uses offline GraphQL (AUTH-X-01 / PR7-ACT-004)", async () => {
    const { app } = createTestShopifyApp();
    const token = await signIdToken({ sub: SAFE_SUB });
    setAuthxGraphqlCapture(true);
    const auth = await app.authenticate.admin(adminRequest({ token }));
    expect(String(auth.sessionToken?.sub)).toBe(SAFE_SUB);
    expect(auth.session.id).toBe(`offline_${SHOP_A}`);
    expect(auth.session.isOnline).toBe(false);
    await auth.admin.graphql("{ shop { name } }");
    const graphql = authxGraphql();
    expect(graphql).toHaveLength(1);
    expect(graphql[0]?.hostname).toBe(SHOP_A);
    expect(graphql[0]?.accessTokenSha256).toBe(offlineTokenSha256(SHOP_A));
    expect(graphql[0]?.accessTokenSha256).not.toBe(sha256Utf8(token));
    expect(requirePlatformActor((await gateAdminRequestIdentity({
      request: adminRequest({ token }),
      verifier: testVerifier(),
    })).actor).shopifyUserId).toBe(SAFE_SUB);
  });

  it("id_token query authenticates without Bearer (AUTH-X-31)", async () => {
    const { app } = createTestShopifyApp();
    const token = await signIdToken({ sub: SAFE_SUB });
    const request = adminRequest({ url: embeddedIdTokenUrl({ token }) });
    expect(request.headers.get("authorization")).toBeNull();
    const gate = await gateAdminRequestIdentity({
      request,
      verifier: testVerifier(),
    });
    expect(gate.actor.status).toBe("verified");
    expect(requirePlatformActor(gate.actor).shopifyUserId).toBe(SAFE_SUB);

    setAuthxGraphqlCapture(true);
    const auth = await app.authenticate.admin(request);
    await auth.admin.graphql("{ shop { name } }");
    expect(authxGraphql()[0]?.accessTokenSha256).toBe(offlineTokenSha256(SHOP_A));
  });

  it("adapter rejects iss/dest mismatch with zero exchanges (AUTH-X-14 / PR7-ACT-016/025)", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_A}`,
      iss: `https://${SHOP_B}/admin`,
    });
    await expect(
      gateAdminRequestIdentity({
        request: adminRequest({ token }),
        verifier: testVerifier(),
      }),
    ).rejects.toMatchObject({ code: "ID_TOKEN_ISS_DEST_MISMATCH" });
    expect(authxCalls()).toEqual([]);

    const { app } = createTestShopifyApp();
    await app.authenticate.admin(adminRequest({ token }));
    expect(authxExchanges().length).toBeGreaterThan(0);
  });

  it("library mixedToken sequential wide ids is a defect; adapter does not adopt it (AUTH-X-06)", async () => {
    const storage = new MemorySessionStorage();
    const { app } = createTestShopifyApp({
      useOnlineTokens: true,
      sessionStorage: storage,
    });
    setAuthxGraphqlCapture(true);
    const tokenB = await signIdToken({ sub: WIDE_SUB });
    const tokenA = await signIdToken({ sub: WIDE_ROUNDED });

    const first = await app.authenticate.admin(adminRequest({ token: tokenB }));
    await first.admin.graphql("{ shop { name } }");
    const hashB = authxGraphql().at(-1)?.accessTokenSha256;

    const second = await app.authenticate.admin(adminRequest({ token: tokenA }));
    await second.admin.graphql("{ shop { name } }");
    const hashA = authxGraphql().at(-1)?.accessTokenSha256;
    expect(hashA).toBe(hashB);
    const sessionIds = [...storage.store.keys()].sort();
    expect(sessionIds).toContain(`offline_${SHOP_A}`);
    const onlineIds = sessionIds.filter((id) => !id.startsWith("offline_"));
    expect(onlineIds).toEqual([`${SHOP_A}_${WIDE_ROUNDED}`]);
    expect(onlineIds).not.toContain(`${SHOP_A}_${WIDE_SUB}`);

    resetAuthxMock();
    const verifier = testVerifier();
    const actorB = verifiedActorFromExactSub(WIDE_SUB, SHOP_A);
    const actorA = verifiedActorFromExactSub(WIDE_ROUNDED, SHOP_A);
    const proofB = await proveShopOwner({
      request: adminRequest({ token: tokenB }),
      verifier,
      actor: actorB,
      idToken: tokenB,
      fresh: true,
    });
    const proofA = await proveShopOwner({
      request: adminRequest({ token: tokenA }),
      verifier,
      actor: actorA,
      idToken: tokenA,
      fresh: true,
    });
    expect(proofB.status).toBe("unsupported");
    expect(proofA.status).toBe("unsupported");
    expect(authxGraphql()).toHaveLength(0);
    expect(() =>
      withProvenOwnerAccessToken(proofA, () => "used"),
    ).toThrow(ActorBoundaryError);
  });

  it("concurrent colliding wide ids do not share a proven owner credential (AUTH-X-07)", async () => {
    const tokenB = await signIdToken({ sub: WIDE_SUB });
    const tokenA = await signIdToken({ sub: WIDE_ROUNDED });
    const verifier = testVerifier();
    const [proofB, proofA] = await Promise.all([
      proveShopOwner({
        request: adminRequest({ token: tokenB }),
        verifier,
        actor: verifiedActorFromExactSub(WIDE_SUB, SHOP_A),
        idToken: tokenB,
        fresh: true,
      }),
      proveShopOwner({
        request: adminRequest({ token: tokenA }),
        verifier,
        actor: verifiedActorFromExactSub(WIDE_ROUNDED, SHOP_A),
        idToken: tokenA,
        fresh: true,
      }),
    ]);
    expect(proofB.status).toBe("unsupported");
    expect(proofA.status).toBe("unsupported");
    expect(authxGraphql()).toHaveLength(0);
  });

  it("does not adopt a stale online cache entry (AUTH-X-09)", async () => {
    const storage = new MemorySessionStorage();
    const { app } = createTestShopifyApp({
      useOnlineTokens: true,
      sessionStorage: storage,
    });
    const staleAccess = `shpat_stale_${SHOP_A}_111`;
    await storage.storeSession(
      new Session({
        id: `${SHOP_A}_${SAFE_SUB}`,
        shop: SHOP_A,
        state: "",
        isOnline: true,
        accessToken: staleAccess,
        scope: "read_products",
        expires: new Date(Date.now() + 60 * 60 * 1000),
        onlineAccessInfo: {
          expires_in: 3600,
          associated_user_scope: "read_products",
          associated_user: {
            id: 111,
            first_name: "Stale",
            last_name: "User",
            email: "stale@example.com",
            email_verified: true,
            account_owner: true,
            locale: "en",
            collaborator: false,
          },
        },
      }),
    );
    setAuthxGraphqlCapture(true);
    const current = await signIdToken({ sub: SAFE_SUB });
    const auth = await app.authenticate.admin(adminRequest({ token: current }));
    await auth.admin.graphql("{ shop { name } }");
    expect(authxExchanges()).toHaveLength(0);
    expect(authxGraphql()[0]?.accessTokenSha256).toBe(sha256Utf8(staleAccess));

    resetAuthxMock();
    setOnlineAssociatedUser((payload) => ({
      id: Number(payload.sub),
      first_name: "Ada",
      last_name: "Admin",
      email: "ada@example.com",
      email_verified: true,
      account_owner: true,
      locale: "en",
      collaborator: false,
    }));
    const proof = await proveShopOwner({
      request: adminRequest({ token: current }),
      verifier: testVerifier(),
      actor: verifiedActorFromExactSub(SAFE_SUB, SHOP_A),
      idToken: current,
      fresh: true,
    });
    expect(proof.status).toBe("owner");
    expect(authxExchanges().length).toBeGreaterThan(0);
    await withProvenOwnerAccessToken(proof, async (accessToken) => {
      setAuthxGraphqlCapture(true);
      await fetch(`https://${SHOP_A}/admin/api/2026-07/graphql.json`, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": accessToken },
        body: "{}",
      });
    });
    expect(authxGraphql()[0]?.accessTokenSha256).toBe(
      onlineTokenSha256(SHOP_A, SAFE_SUB),
    );
    expect(authxGraphql()[0]?.accessTokenSha256).not.toBe(
      onlineTokenSha256(SHOP_A, "111"),
    );
  });

  it("same sub on two shops does not cross GraphQL dest (AUTH-X-08)", async () => {
    const { app } = createTestShopifyApp();
    setAuthxGraphqlCapture(true);
    const tokenA = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_A}`,
    });
    const tokenB = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_B}`,
    });
    const authA = await app.authenticate.admin(adminRequest({ token: tokenA }));
    await authA.admin.graphql("{ shop { name } }");
    const authB = await app.authenticate.admin(adminRequest({ token: tokenB }));
    await authB.admin.graphql("{ shop { name } }");
    const graphql = authxGraphql();
    expect(graphql.map((call) => call.hostname).sort()).toEqual(
      [SHOP_A, SHOP_B].sort(),
    );
    expect(graphql[0]?.accessTokenSha256).not.toBe(graphql[1]?.accessTokenSha256);
  });

  it("expired JWT is 401 with zero exchange (AUTH-X-10)", async () => {
    const { app } = createTestShopifyApp();
    const token = await signIdToken({
      sub: SAFE_SUB,
      exp: Math.floor(Date.now() / 1000) - 120,
      nbf: Math.floor(Date.now() / 1000) - 240,
    });
    const response = await caughtResponse(() =>
      app.authenticate.admin(adminRequest({ token })),
    );
    expect(response.status).toBe(401);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("bot UA is not an owner proof (AUTH-X-32)", async () => {
    const { app } = createTestShopifyApp();
    const token = await signIdToken({ sub: SAFE_SUB });
    const response = await caughtResponse(() =>
      app.authenticate.admin(adminRequest({ token, ua: BOT_UA })),
    );
    expect(response.status).toBe(410);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("numeric JWT sub does not become a platform actor (AUTH-X-05)", async () => {
    const token = await signIdToken({ sub: Number(WIDE_SUB) });
    const gate = await gateAdminRequestIdentity({
      request: adminRequest({ token }),
      verifier: testVerifier(),
    });
    expect(gate.actor.status).toBe("unsupported");
    expect(() => requirePlatformActor(gate.actor)).toThrow(ActorBoundaryError);
    expect(authxCalls()).toHaveLength(0);
  });
});
