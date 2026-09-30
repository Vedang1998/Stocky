import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { gateAdminRequestIdentity } from "../admin-auth-boundary.server";
import { requirePlatformActor } from "../actor.server";
import { ActorBoundaryError } from "../errors.server";
import { authxCalls, resetAuthxMock, SAFE_SUB, TEST_API_SECRET } from "./authx-mock";
import {
  adminRequest,
  installAuthxFetch,
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

describe("merchandising compatibility (D-PR7-07)", () => {
  it("absent ID token leaves merchandising ungated and denies platform powers", async () => {
    const gate = await gateAdminRequestIdentity({
      request: adminRequest({}),
      verifier: testVerifier(),
    });
    expect(gate.blocksAuthentication).toBe(false);
    expect(gate.actor.status).toBe("absent");
    expect(authxCalls()).toEqual([]);
    expect(() => requirePlatformActor(gate.actor)).toThrow(ActorBoundaryError);
  });

  it("verified actor is available without enabling online tokens", async () => {
    const token = await signIdToken({ sub: SAFE_SUB });
    const gate = await gateAdminRequestIdentity({
      request: adminRequest({ token }),
      verifier: testVerifier(),
    });
    expect(gate.actor.status).toBe("verified");
    expect(gate.blocksAuthentication).toBe(false);
    expect(authxCalls()).toEqual([]);
    expect(requirePlatformActor(gate.actor).shopifyUserId).toBe(SAFE_SUB);
  });

  it("requireAdminTenant gates identity before authenticate.admin and does not consume owner proof", () => {
    const src = readFileSync(
      path.join(APP_ROOT, "app/tenant/require-admin-tenant.server.ts"),
      "utf8",
    );
    const gateAt = src.indexOf("gateAdminRequestIdentity");
    const authAt = src.indexOf("authenticate(request)");
    expect(gateAt).toBeGreaterThan(-1);
    expect(authAt).toBeGreaterThan(gateAt);
    expect(src).not.toMatch(/proveShopOwner/);
    expect(src).not.toMatch(/withProvenOwnerAccessToken/);
  });

  it("forged ID token denies before any outbound credential use", async () => {
    const token = await signIdToken({
      sub: SAFE_SUB,
      secret: `${TEST_API_SECRET}-forged`,
    });
    await expect(
      gateAdminRequestIdentity({
        request: adminRequest({ token }),
        verifier: testVerifier(),
      }),
    ).rejects.toMatchObject({ code: "ID_TOKEN_INVALID" });
    expect(authxCalls()).toEqual([]);
  });
});
