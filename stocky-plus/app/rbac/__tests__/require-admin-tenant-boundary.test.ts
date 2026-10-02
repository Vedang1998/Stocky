import { beforeEach, describe, expect, it } from "vitest";
import { requireAdminTenant } from "../../tenant/require-admin-tenant.server";
import { gateAdminRequestIdentity } from "../admin-auth-boundary.server";
import { ActorBoundaryError } from "../errors.server";
import {
  authxCalls,
  authxExchanges,
  resetAuthxMock,
  SAFE_SUB,
  SHOP_A,
  SHOP_B,
  TEST_API_SECRET,
} from "./authx-mock";
import {
  adminRequest,
  assertBounceSessionTokenResponse,
  assertRetryInvalidSessionResponse,
  caughtResponse,
  createTestShopifyApp,
  embeddedIdTokenUrl,
  installAuthxFetch,
  signIdToken,
  testVerifier,
} from "./harness";

beforeEach(() => {
  installAuthxFetch();
  resetAuthxMock();
});

async function wrapperCall(request: Request) {
  const { app } = createTestShopifyApp();
  return requireAdminTenant({
    request,
    authenticateAdmin: app.authenticate.admin,
    identityVerifier: testVerifier(),
  });
}

describe("requireAdminTenant executed installed-auth boundary (F-01/F-02)", () => {
  it("expired Bearer is 401 + retry header, not ActorBoundaryError, with zero exchange", async () => {
    const { app } = createTestShopifyApp();
    const token = await signIdToken({
      sub: SAFE_SUB,
      exp: Math.floor(Date.now() / 1000) - 120,
      nbf: Math.floor(Date.now() / 1000) - 240,
    });
    const request = adminRequest({ token });
    const inner = await gateAdminRequestIdentity({
      request,
      verifier: testVerifier(),
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(inner).toBeInstanceOf(ActorBoundaryError);
    expect((inner as ActorBoundaryError).code).toBe("ID_TOKEN_INVALID");
    expect(inner instanceof Response).toBe(false);

    const response = await caughtResponse(() =>
      requireAdminTenant({
        request,
        authenticateAdmin: app.authenticate.admin,
        identityVerifier: testVerifier(),
      }),
    );
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
    expect(authxCalls()).toEqual([]);
  });

  it("malformed Authorization is 401 + retry with zero exchange", async () => {
    const request = adminRequest({
      headers: { Authorization: "Token abc" },
    });
    const response = await caughtResponse(() => wrapperCall(request));
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("forged signature is 401 + retry with zero exchange", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      secret: `${TEST_API_SECRET}-forged`,
    });
    const response = await caughtResponse(() =>
      wrapperCall(adminRequest({ token })),
    );
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("invalid algorithm is 401 + retry with zero exchange", async () => {
    const token = await signIdToken({ sub: SAFE_SUB, alg: "HS384" });
    const response = await caughtResponse(() =>
      wrapperCall(adminRequest({ token })),
    );
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("invalid audience is 401 + retry with zero exchange", async () => {
    const token = await signIdToken({ sub: SAFE_SUB, aud: "other-app" });
    const response = await caughtResponse(() =>
      wrapperCall(adminRequest({ token })),
    );
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("future nbf is 401 + retry with zero exchange", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      nbf: Math.floor(Date.now() / 1000) + 3600,
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    const response = await caughtResponse(() =>
      wrapperCall(adminRequest({ token })),
    );
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("iss/dest mismatch is 401 + retry with zero exchange (not sent through authenticate)", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_A}`,
      iss: `https://${SHOP_B}/admin`,
    });
    const response = await caughtResponse(() =>
      wrapperCall(adminRequest({ token })),
    );
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("header wins over a conflicting query token; invalid header does not fall through", async () => {
    const valid = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_B}`,
    });
    const forged = await signIdToken({
      sub: SAFE_SUB,
      secret: `${TEST_API_SECRET}-forged`,
    });
    const request = adminRequest({
      token: forged,
      url: `https://example.com/app?shop=${SHOP_A}&id_token=${encodeURIComponent(valid)}`,
    });
    const response = await caughtResponse(() => wrapperCall(request));
    assertRetryInvalidSessionResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("query-only invalid document token bounces without retry header or exchange", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      exp: Math.floor(Date.now() / 1000) - 120,
      nbf: Math.floor(Date.now() / 1000) - 240,
    });
    const request = adminRequest({
      url: embeddedIdTokenUrl({ token }),
    });
    expect(request.headers.get("authorization")).toBeNull();
    const response = await caughtResponse(() => wrapperCall(request));
    assertBounceSessionTokenResponse(response);
    expect(response.headers.get("x-shopify-retry-invalid-session-request")).toBeNull();
    expect(authxExchanges()).toHaveLength(0);
  });

  it("missing token on an embedded document retains the library bounce contract", async () => {
    const { app } = createTestShopifyApp();
    const request = adminRequest({
      url: `https://example.com/app?embedded=1&shop=${SHOP_A}&host=${encodeURIComponent(
        Buffer.from(`${SHOP_A}/admin`).toString("base64"),
      )}`,
    });
    const response = await caughtResponse(() =>
      requireAdminTenant({
        request,
        authenticateAdmin: app.authenticate.admin,
        identityVerifier: testVerifier(),
      }),
    );
    assertBounceSessionTokenResponse(response);
    expect(authxExchanges()).toHaveLength(0);
  });

  it("numeric sub is not converted to a refresh 401; authenticate still runs", async () => {
    const token = await signIdToken({ sub: Number(SAFE_SUB) });
    const request = adminRequest({ token });
    const gate = await gateAdminRequestIdentity({
      request,
      verifier: testVerifier(),
    });
    expect(gate.actor.status).toBe("unsupported");
    let authenticateCalls = 0;
    const response = await caughtResponse(() =>
      requireAdminTenant({
        request,
        identityVerifier: testVerifier(),
        authenticateAdmin: async () => {
          authenticateCalls += 1;
          return {
            admin: {} as never,
            session: { shop: SHOP_B } as never,
          };
        },
      }),
    );
    expect(authenticateCalls).toBe(1);
    expect(response.status).toBe(401);
    expect(response.headers.get("x-shopify-retry-invalid-session-request")).toBeNull();
    expect(authxExchanges()).toHaveLength(0);
  });

  it("compares verified dest with session.shop after auth and does not return authority on mismatch", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_A}`,
    });
    const request = adminRequest({ token });
    let authenticateCalls = 0;
    await expect(
      requireAdminTenant({
        request,
        identityVerifier: testVerifier(),
        authenticateAdmin: async () => {
          authenticateCalls += 1;
          return {
            admin: {} as never,
            session: { shop: SHOP_B } as never,
          };
        },
      }),
    ).rejects.toBeInstanceOf(Response);
    const response = await caughtResponse(() =>
      requireAdminTenant({
        request,
        identityVerifier: testVerifier(),
        authenticateAdmin: async () => ({
          admin: {} as never,
          session: { shop: SHOP_B } as never,
        }),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("x-shopify-retry-invalid-session-request")).toBeNull();
    expect(authenticateCalls).toBe(1);
    expect(authxExchanges()).toHaveLength(0);
  });
});
