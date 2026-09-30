/**
 * Admin-request identity gate — runs BEFORE authenticate.admin side effects.
 *
 * Invalid signature / algorithm / audience / time / iss-dest mismatch deny
 * with zero outbound fetches. Unsupported `sub` representation does not block
 * merchandising shop authentication (D-PR7-07); it only withholds the actor.
 */

import type { ActorResolution, VerifiedActor } from "./actor.server";
import { classifyUnsupportedSub, verifiedActorFromExactSub } from "./actor.server";
import { ActorBoundaryError } from "./errors.server";
import {
  decodeIdTokenAllowingUnsupportedSub,
  extractIdTokenFromRequest,
} from "./id-token.server";
import {
  createShopifyVerifier,
  verifierFromEnv,
  type ShopifyVerifier,
} from "./shopify-verifier.server";

export type AdminIdentityGate = {
  readonly blocksAuthentication: boolean;
  readonly idToken: string | null;
  readonly actor: ActorResolution;
  readonly verifiedActor: VerifiedActor | null;
  readonly destHost: string | null;
};

export type GateAdminIdentityInput = {
  request: Request;
  verifier?: ShopifyVerifier;
};

export async function gateAdminRequestIdentity(
  input: GateAdminIdentityInput,
): Promise<AdminIdentityGate> {
  const extracted = extractIdTokenFromRequest(input.request);
  if (!extracted) {
    return {
      blocksAuthentication: false,
      idToken: null,
      actor: { status: "absent", reason: "NO_ID_TOKEN" },
      verifiedActor: null,
      destHost: null,
    };
  }

  const verifier = input.verifier ?? verifierFromEnv();
  const decoded = await decodeIdTokenAllowingUnsupportedSub(
    verifier,
    extracted.token,
  );

  if (decoded.subUnsupported) {
    return {
      blocksAuthentication: false,
      idToken: extracted.token,
      actor: classifyUnsupportedSub(decoded.payload.sub),
      verifiedActor: null,
      destHost: decoded.destHost,
    };
  }

  const actor = verifiedActorFromExactSub(decoded.actorSub!, decoded.destHost);
  return {
    blocksAuthentication: false,
    idToken: extracted.token,
    actor: { status: "verified", actor },
    verifiedActor: actor,
    destHost: decoded.destHost,
  };
}

/**
 * Convert identity denials into thrown boundary errors. Callers that want
 * merchandising to continue on unsupported sub should use the gate result
 * without this helper.
 */
export function assertIdentityDoesNotBlock(gate: AdminIdentityGate): void {
  if (gate.blocksAuthentication) {
    throw new ActorBoundaryError(
      "AUTH_PLATFORM_DENIED",
      "Admin identity gate blocked authentication",
      401,
    );
  }
}

export type { ShopifyVerifier } from "./shopify-verifier.server";
export { createShopifyVerifier, verifierFromEnv };
