/**
 * Request-bound owner-proof adapter — D-PR7-02 / D-PR7-04.
 *
 * Isolated from the configured shopifyApp session store (offline default,
 * useOnlineTokens unset). Existing unsafe online cache entries are never
 * adopted. The online access token is not usable until associated_user
 * binding is validated. Failed human permissions do not fall back to the
 * offline token.
 */

import {
  HttpResponseError,
  InvalidJwtError,
  RequestedTokenType,
  type Session,
} from "@shopify/shopify-api";
import type { VerifiedActor } from "./actor.server";
import { ActorBoundaryError } from "./errors.server";
import type { ShopifyVerifier } from "./shopify-verifier.server";

const OWNER_PROOF_MEMO = new WeakMap<Request, Promise<OwnerProofResult>>();

const ACCESS_TOKEN = Symbol("pr7OwnerOnlineAccessToken");

export type OwnerProofSuccess = {
  readonly status: "owner";
  readonly actor: VerifiedActor;
  readonly associatedUserId: string;
  readonly expiresAt: Date;
  readonly [ACCESS_TOKEN]: string;
};

export type OwnerProofResult =
  | OwnerProofSuccess
  | {
      readonly status: "not_owner";
      readonly actor: VerifiedActor;
      readonly code: "OWNER_PROOF_NOT_OWNER";
    }
  | {
      readonly status: "unsupported";
      readonly code: "OWNER_PROOF_UNSUPPORTED";
      readonly reason:
        | "UNSAFE_ASSOCIATED_USER_ID"
        | "ASSOCIATED_USER_MISMATCH"
        | "MISSING_ASSOCIATED_USER"
        | "MISSING_ACCESS_TOKEN";
    }
  | {
      readonly status: "denied";
      readonly code: "OWNER_PROOF_DENIED";
      readonly reason: "HTTP_401" | "HTTP_403" | "EXCHANGE_FAILED" | "EXPIRED";
    };

export type OwnerProofInput = {
  request: Request;
  verifier: ShopifyVerifier;
  actor: VerifiedActor;
  idToken: string;
  /**
   * Optional untrusted client body/session flag. Ignored for grants.
   */
  clientAccountOwner?: unknown;
  now?: Date;
  /**
   * Test-only: skip WeakMap memoization so retries are observable.
   */
  fresh?: boolean;
};

export function associatedUserIdCorroboration(
  associatedUserId: unknown,
  actorSub: string,
): "match" | "mismatch" | "unsafe" {
  if (typeof associatedUserId === "number") {
    if (!Number.isSafeInteger(associatedUserId)) return "unsafe";
    return String(associatedUserId) === actorSub ? "match" : "mismatch";
  }
  if (typeof associatedUserId === "string" && /^[0-9]+$/.test(associatedUserId)) {
    const asNumber = Number(associatedUserId);
    if (!Number.isSafeInteger(asNumber) || String(asNumber) !== associatedUserId) {
      return "unsafe";
    }
    return associatedUserId === actorSub ? "match" : "mismatch";
  }
  return "unsafe";
}

function unsupported(
  reason: Extract<OwnerProofResult, { status: "unsupported" }>["reason"],
): OwnerProofResult {
  return { status: "unsupported", code: "OWNER_PROOF_UNSUPPORTED", reason };
}

function denied(
  reason: Extract<OwnerProofResult, { status: "denied" }>["reason"],
): OwnerProofResult {
  return { status: "denied", code: "OWNER_PROOF_DENIED", reason };
}

function readAssociatedUser(session: Session): {
  id: unknown;
  account_owner: unknown;
  collaborator: unknown;
} | null {
  if (!session.isOnline) return null;
  const user = session.onlineAccessInfo?.associated_user;
  if (user == null || typeof user !== "object") return null;
  return {
    id: user.id,
    account_owner: user.account_owner,
    collaborator: user.collaborator,
  };
}

async function exchangeOnlineAndBind(
  input: OwnerProofInput,
): Promise<OwnerProofResult> {
  // Client-supplied account_owner is sighted so tests can prove it is ignored.
  void input.clientAccountOwner;

  let session;
  try {
    const exchanged = await input.verifier.api.auth.tokenExchange({
      shop: input.actor.destShop,
      sessionToken: input.idToken,
      requestedTokenType: RequestedTokenType.OnlineAccessToken,
      expiring: false,
    });
    session = exchanged.session;
  } catch (error) {
    if (error instanceof InvalidJwtError) {
      return denied("EXCHANGE_FAILED");
    }
    if (error instanceof HttpResponseError) {
      if (error.response.code === 401) return denied("HTTP_401");
      if (error.response.code === 403) return denied("HTTP_403");
      return denied("EXCHANGE_FAILED");
    }
    return denied("EXCHANGE_FAILED");
  }

  const accessToken = session.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return unsupported("MISSING_ACCESS_TOKEN");
  }

  const associatedUser = readAssociatedUser(session);
  if (!associatedUser) {
    return unsupported("MISSING_ASSOCIATED_USER");
  }

  const corroboration = associatedUserIdCorroboration(
    associatedUser.id,
    input.actor.shopifyUserId,
  );
  if (corroboration === "unsafe") {
    return unsupported("UNSAFE_ASSOCIATED_USER_ID");
  }
  if (corroboration === "mismatch") {
    return unsupported("ASSOCIATED_USER_MISMATCH");
  }

  const now = input.now ?? new Date();
  if (session.expires && session.expires.getTime() <= now.getTime()) {
    return denied("EXPIRED");
  }

  const accountOwner = associatedUser.account_owner === true;
  const collaborator = associatedUser.collaborator === true;
  if (!accountOwner || collaborator) {
    return {
      status: "not_owner",
      actor: input.actor,
      code: "OWNER_PROOF_NOT_OWNER",
    };
  }

  const expiresAt =
    session.expires ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const result: OwnerProofSuccess = {
    status: "owner",
    actor: input.actor,
    associatedUserId: String(associatedUser.id),
    expiresAt,
    [ACCESS_TOKEN]: accessToken,
  };
  return result;
}

/**
 * Prove shop ownership for this request. Never reads the app session cache.
 * Offline sessions are not consulted. The returned access token is
 * non-enumerable and must not be logged.
 */
export function proveShopOwner(input: OwnerProofInput): Promise<OwnerProofResult> {
  if (!input.fresh) {
    const existing = OWNER_PROOF_MEMO.get(input.request);
    if (existing) return existing;
  }

  const pending = exchangeOnlineAndBind(input);
  if (!input.fresh) {
    OWNER_PROOF_MEMO.set(input.request, pending);
  }
  return pending;
}

/**
 * Use a proven owner credential for a single outbound call. Binding has
 * already been checked. Callers must not log `accessToken`.
 */
export function withProvenOwnerAccessToken<T>(
  proof: OwnerProofResult,
  apply: (accessToken: string) => T,
): T {
  if (proof.status !== "owner") {
    throw new ActorBoundaryError(
      "OWNER_PROOF_UNSUPPORTED",
      "No proven owner credential is available",
      403,
    );
  }
  return apply(proof[ACCESS_TOKEN]);
}

export function ownerProofAccessTokenPresent(proof: OwnerProofResult): boolean {
  return proof.status === "owner" && typeof proof[ACCESS_TOKEN] === "string";
}
