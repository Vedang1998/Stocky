/**
 * Canonical human actor identity — D-PR7-01.
 *
 * The verified JWT `sub` exact digit string is the only persistence key.
 * Number(), parseInt, String(associated_user.id), Session.userId, and
 * TypeScript `as bigint` are forbidden identity sources.
 */

import { ActorBoundaryError } from "./errors.server";

export type VerifiedActor = {
  readonly kind: "human";
  readonly shopifyUserId: string;
  readonly destShop: string;
};

export type ActorResolution =
  | { readonly status: "verified"; readonly actor: VerifiedActor }
  | { readonly status: "absent"; readonly reason: "NO_ID_TOKEN" }
  | {
      readonly status: "unsupported";
      readonly reason:
        | "NUMERIC_SUB"
        | "NON_DIGIT_SUB"
        | "MISSING_SUB"
        | "UNSAFE_WIDTH";
      readonly code: "ACTOR_SUB_UNSUPPORTED";
    }
  | {
      readonly status: "denied";
      readonly reason: string;
      readonly code: string;
    };

export function verifiedActorFromExactSub(
  sub: string,
  destShop: string,
): VerifiedActor {
  return {
    kind: "human",
    shopifyUserId: sub,
    destShop,
  };
}

export function classifyUnsupportedSub(sub: unknown): ActorResolution {
  if (typeof sub === "number") {
    return {
      status: "unsupported",
      reason: "NUMERIC_SUB",
      code: "ACTOR_SUB_UNSUPPORTED",
    };
  }
  if (sub == null || sub === "") {
    return {
      status: "unsupported",
      reason: "MISSING_SUB",
      code: "ACTOR_SUB_UNSUPPORTED",
    };
  }
  return {
    status: "unsupported",
    reason: "NON_DIGIT_SUB",
    code: "ACTOR_SUB_UNSUPPORTED",
  };
}

/**
 * Platform actions require a verified digit-string actor from the same
 * authenticate.admin request. Absence/unsupported must deny new platform
 * powers — they do not invent an owner or a system actor.
 */
export function requirePlatformActor(
  resolution: ActorResolution,
): VerifiedActor {
  if (resolution.status === "verified") {
    return resolution.actor;
  }
  throw new ActorBoundaryError(
    "AUTH_PLATFORM_DENIED",
    "Platform action requires a verified exact-string actor",
    403,
  );
}
