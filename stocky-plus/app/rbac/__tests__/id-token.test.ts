import { beforeEach, describe, expect, it } from "vitest";
import { ActorBoundaryError } from "../errors.server";
import {
  canonicalActorSub,
  decodeIdTokenAllowingUnsupportedSub,
  extractIdTokenFromRequest,
  issuerDestinationHostsAgree,
  verifyEmbeddedIdToken,
} from "../id-token.server";
import {
  authxCalls,
  resetAuthxMock,
  SAFE_SUB,
  SHOP_A,
  SHOP_B,
  TEST_API_SECRET,
  WIDE_SUB,
} from "./authx-mock";
import { adminRequest, installAuthxFetch, signIdToken, testVerifier } from "./harness";

beforeEach(() => {
  installAuthxFetch();
  resetAuthxMock();
});

describe("id-token claim gate (D-PR7-01 / AUTH-X-10..15)", () => {
  const verifier = testVerifier();

  it("extracts Bearer then id_token query", async () => {
    const token = await signIdToken({ sub: SAFE_SUB });
    const bearer = extractIdTokenFromRequest(adminRequest({ token }));
    expect(bearer?.source).toBe("authorization");
    const query = extractIdTokenFromRequest(
      adminRequest({
        url: `https://example.com/app?id_token=${encodeURIComponent(token)}`,
      }),
    );
    expect(query?.source).toBe("id_token");
    expect(extractIdTokenFromRequest(adminRequest({}))).toBeNull();
  });

  it("rejects malformed Authorization without exchange (AUTH-X-11)", () => {
    expect(() =>
      extractIdTokenFromRequest(
        adminRequest({ headers: { Authorization: "Token abc" } }),
      ),
    ).toThrow(ActorBoundaryError);
    expect(authxCalls()).toEqual([]);
  });

  it("verifies HS256/aud/time and exact string sub (AUTH-X-01)", async () => {
    const token = await signIdToken({ sub: SAFE_SUB });
    const verified = await verifyEmbeddedIdToken(verifier, token);
    expect(verified.actorSub).toBe(SAFE_SUB);
    expect(verified.destHost).toBe(SHOP_A);
    expect(verified.issHost).toBe(SHOP_A);
    expect(authxCalls()).toEqual([]);
  });

  it("rejects expired JWT before exchange (AUTH-X-10)", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      exp: Math.floor(Date.now() / 1000) - 120,
      nbf: Math.floor(Date.now() / 1000) - 240,
    });
    await expect(verifyEmbeddedIdToken(verifier, token)).rejects.toMatchObject({
      code: "ID_TOKEN_INVALID",
    });
    expect(authxCalls()).toEqual([]);
  });

  it("rejects forged signature before exchange (AUTH-X-12)", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      secret: `${TEST_API_SECRET}-forged`,
    });
    await expect(verifyEmbeddedIdToken(verifier, token)).rejects.toMatchObject({
      code: "ID_TOKEN_INVALID",
    });
    expect(authxCalls()).toEqual([]);
  });

  it("rejects wrong audience before exchange (AUTH-X-15)", async () => {
    const token = await signIdToken({ sub: SAFE_SUB, aud: "other-app" });
    await expect(verifyEmbeddedIdToken(verifier, token)).rejects.toMatchObject({
      code: "ID_TOKEN_INVALID",
    });
    expect(authxCalls()).toEqual([]);
  });

  it("rejects non-HS256 algorithm before exchange", async () => {
    const token = await signIdToken({ sub: SAFE_SUB, alg: "HS384" });
    await expect(verifyEmbeddedIdToken(verifier, token)).rejects.toMatchObject({
      code: "ID_TOKEN_INVALID",
    });
    expect(authxCalls()).toEqual([]);
  });

  it("rejects iss/dest hostname mismatch before exchange (AUTH-X-14)", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      dest: `https://${SHOP_A}`,
      iss: `https://${SHOP_B}/admin`,
    });
    expect(issuerDestinationHostsAgree(`https://${SHOP_B}/admin`, `https://${SHOP_A}`)).toBe(
      false,
    );
    await expect(verifyEmbeddedIdToken(verifier, token)).rejects.toMatchObject({
      code: "ID_TOKEN_ISS_DEST_MISMATCH",
    });
    expect(authxCalls()).toEqual([]);
  });

  it("preserves wide string sub and does not Number() it", async () => {
    const token = await signIdToken({ sub: WIDE_SUB });
    const verified = await verifyEmbeddedIdToken(verifier, token);
    expect(verified.actorSub).toBe(WIDE_SUB);
    expect(verified.actorSub).not.toBe(String(Number(WIDE_SUB)));
    expect(canonicalActorSub(WIDE_SUB)).toBe(WIDE_SUB);
    expect(canonicalActorSub(Number(WIDE_SUB))).toBeNull();
  });

  it("classifies numeric JWT sub as unsupported without exchange (AUTH-X-03/05)", async () => {
    const token = await signIdToken({ sub: 548380009 });
    const decoded = await decodeIdTokenAllowingUnsupportedSub(verifier, token);
    expect(decoded.subUnsupported).toBe(true);
    expect(decoded.actorSub).toBeNull();
    expect(authxCalls()).toEqual([]);
  });
});
