/**
 * Admin-request identity gate — runs BEFORE authenticate.admin side effects.
 *
 * Invalid signature / algorithm / audience / time / iss-dest mismatch deny
 * with zero outbound fetches. Unsupported `sub` representation does not block
 * merchandising shop authentication (D-PR7-07); it only withholds the actor.
 */

import type { ActorResolution, VerifiedActor } from "./actor.server";
import { classifyUnsupportedSub, verifiedActorFromExactSub } from "./actor.server";
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
      idToken: extracted.token,
      actor: classifyUnsupportedSub(decoded.payload.sub),
      verifiedActor: null,
      destHost: decoded.destHost,
    };
  }

  const actor = verifiedActorFromExactSub(decoded.actorSub!, decoded.destHost);
  return {
    idToken: extracted.token,
    actor: { status: "verified", actor },
    verifiedActor: actor,
    destHost: decoded.destHost,
  };
}

export type { ShopifyVerifier } from "./shopify-verifier.server";
export { createShopifyVerifier, verifierFromEnv };
