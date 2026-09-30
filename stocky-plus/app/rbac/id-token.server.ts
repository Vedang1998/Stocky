/**
 * Embedded ID-token extraction and claim checks for PR7 checkpoint A.
 *
 * Cryptographic verification uses installed `api.session.decodeSessionToken`
 * (jose HS256, audience, exp/nbf). Issuer/destination hostname agreement is
 * enforced here because the installed library does not (AUTH-X-14).
 */

import type { JwtPayload } from "@shopify/shopify-api";
import { InvalidJwtError } from "@shopify/shopify-api";
import { ActorBoundaryError } from "./errors.server";
import type { ShopifyVerifier } from "./shopify-verifier.server";

export const ACTOR_SUB_PATTERN = /^[0-9]+$/;

export type ExtractedIdToken = {
  readonly token: string;
  readonly source: "authorization" | "id_token";
};

export type VerifiedIdToken = {
  readonly payload: JwtPayload;
  readonly destHost: string;
  readonly issHost: string;
  readonly actorSub: string;
};

export function extractIdTokenFromRequest(
  request: Request,
): ExtractedIdToken | null {
  const header = request.headers.get("authorization");
  if (header) {
    const match = header.match(/^Bearer\s+(\S+)\s*$/i);
    if (!match) {
      throw new ActorBoundaryError(
        "ID_TOKEN_MALFORMED",
        "Authorization header is not a Bearer token",
        401,
      );
    }
    return { token: match[1], source: "authorization" };
  }

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("id_token");
  if (fromQuery && fromQuery.length > 0) {
    return { token: fromQuery, source: "id_token" };
  }

  return null;
}

export function hostnameOf(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.includes("://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}

export function issuerDestinationHostsAgree(
  iss: unknown,
  dest: unknown,
): boolean {
  if (typeof iss !== "string" || typeof dest !== "string") return false;
  const issHost = hostnameOf(iss);
  const destHost = hostnameOf(dest);
  return issHost != null && destHost != null && issHost === destHost;
}

export function canonicalActorSub(sub: unknown): string | null {
  if (typeof sub !== "string") return null;
  if (!ACTOR_SUB_PATTERN.test(sub)) return null;
  return sub;
}

export async function verifyEmbeddedIdToken(
  verifier: ShopifyVerifier,
  token: string,
): Promise<VerifiedIdToken> {
  let payload: JwtPayload;
  try {
    payload = await verifier.api.session.decodeSessionToken(token, {
      checkAudience: true,
    });
  } catch (error) {
    if (error instanceof InvalidJwtError) {
      throw new ActorBoundaryError(
        "ID_TOKEN_INVALID",
        "Embedded ID token failed cryptographic or audience verification",
        401,
      );
    }
    throw error;
  }

  if (!issuerDestinationHostsAgree(payload.iss, payload.dest)) {
    throw new ActorBoundaryError(
      "ID_TOKEN_ISS_DEST_MISMATCH",
      "Embedded ID token issuer and destination hostnames do not agree",
      401,
    );
  }

  const destHost = hostnameOf(String(payload.dest));
  const issHost = hostnameOf(String(payload.iss));
  if (!destHost || !issHost) {
    throw new ActorBoundaryError(
      "ID_TOKEN_ISS_DEST_MISMATCH",
      "Embedded ID token issuer or destination host is unusable",
      401,
    );
  }

  const actorSub = canonicalActorSub(payload.sub);
  if (!actorSub) {
    throw new ActorBoundaryError(
      "ACTOR_SUB_UNSUPPORTED",
      "Embedded ID token sub is not an exact digit string",
      401,
    );
  }

  return { payload, destHost, issHost, actorSub };
}

/**
 * Verify claims that must hold even when merchandising continues.
 * Numeric/unsupported `sub` does not throw here — it is classified by the
 * actor resolver so shop authentication can still proceed (D-PR7-07).
 */
export async function decodeIdTokenAllowingUnsupportedSub(
  verifier: ShopifyVerifier,
  token: string,
): Promise<{
  payload: JwtPayload;
  destHost: string;
  issHost: string;
  actorSub: string | null;
  subUnsupported: boolean;
}> {
  let payload: JwtPayload;
  try {
    payload = await verifier.api.session.decodeSessionToken(token, {
      checkAudience: true,
    });
  } catch (error) {
    if (error instanceof InvalidJwtError) {
      throw new ActorBoundaryError(
        "ID_TOKEN_INVALID",
        "Embedded ID token failed cryptographic or audience verification",
        401,
      );
    }
    throw error;
  }

  if (!issuerDestinationHostsAgree(payload.iss, payload.dest)) {
    throw new ActorBoundaryError(
      "ID_TOKEN_ISS_DEST_MISMATCH",
      "Embedded ID token issuer and destination hostnames do not agree",
      401,
    );
  }

  const destHost = hostnameOf(String(payload.dest));
  const issHost = hostnameOf(String(payload.iss));
  if (!destHost || !issHost) {
    throw new ActorBoundaryError(
      "ID_TOKEN_ISS_DEST_MISMATCH",
      "Embedded ID token issuer or destination host is unusable",
      401,
    );
  }

  const actorSub = canonicalActorSub(payload.sub);
  return {
    payload,
    destHost,
    issHost,
    actorSub,
    subUnsupported: actorSub == null,
  };
}
