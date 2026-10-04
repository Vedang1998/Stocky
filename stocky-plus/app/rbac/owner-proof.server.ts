/**
 * Request-bound owner-proof adapter — D-PR7-02 / D-PR7-04.
 *
 * Isolated from the configured shopifyApp session store (offline default,
 * useOnlineTokens unset). Existing unsafe online cache entries are never
 * adopted. The online access token is not usable until associated_user
 * binding is validated. Failed human permissions do not fall back to the
 * offline token.
 *
 * Credentials live in a module-private WeakMap keyed by an authentic issued
 * handle. They are not an own property (enumerable or not). Spread, clone, or
 * forged status/shape cannot become usable. This does not prevent a trusted
 * callback that already received the token string from logging it.
 *
 * Expiry is private immutable milliseconds, rechecked at last protected use.
 * Missing/non-finite provider expiry is unsupported. This is not live Shopify
 * revocation; synthetic 401/403 cover exchange rejection. Real-provider
 * revocation remains unexecuted launch evidence.
 */

import { inspect } from "node:util";
import {
  HttpResponseError,
  InvalidJwtError,
  RequestedTokenType,
  type Session,
} from "@shopify/shopify-api";
import type { VerifiedActor } from "./actor.server";
import { ActorBoundaryError } from "./errors.server";
import type { ShopifyVerifier } from "./shopify-verifier.server";

type FrozenOwnerBinding = {
  readonly request: Request;
  readonly idToken: string;
  readonly actorSub: string;
  readonly destShop: string;
  readonly verifierIdentity: string;
};

type OwnerProofMemoSlot = {
  readonly binding: FrozenOwnerBinding;
  readonly pending: Promise<OwnerProofResult>;
};

type StoredOwnerCredential = {
  readonly token: string;
  readonly binding: FrozenOwnerBinding;
  readonly expiresAtMs: number;
};

const OWNER_PROOF_MEMO = new WeakMap<Request, OwnerProofMemoSlot>();
const OWNER_CREDENTIALS = new WeakMap<object, StoredOwnerCredential>();

let nowMsForTests: number | null = null;

function testClockEnabled(): boolean {
  return process.env.VITEST === "true" && process.env.NODE_ENV !== "production";
}

/**
 * Test-only validation clock. No-op when `NODE_ENV=production` or when not
 * running under Vitest. Production callers cannot rewind expiry.
 */
export function __setOwnerProofNowMsForTests(ms: number | null): void {
  if (!testClockEnabled()) {
    return;
  }
  nowMsForTests = ms;
}

export function __ownerProofExpiresAtMsForTests(
  proof: OwnerProofResult,
): number | null {
  const stored = OWNER_CREDENTIALS.get(proof);
  return stored ? stored.expiresAtMs : null;
}

function currentTimeMs(): number {
  if (!testClockEnabled() || nowMsForTests == null) {
    return Date.now();
  }
  return nowMsForTests;
}

export type OwnerProofSuccess = {
  readonly status: "owner";
  readonly actor: VerifiedActor;
  readonly associatedUserId: string;
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
        | "MISSING_ACCESS_TOKEN"
        | "MISSING_EXPIRY";
    }
  | {
      readonly status: "denied";
      readonly code: "OWNER_PROOF_DENIED";
      readonly reason:
        | "HTTP_401"
        | "HTTP_403"
        | "EXCHANGE_FAILED"
        | "EXPIRED"
        | "BINDING_CONFLICT";
    };

export type OwnerProofInput = {
  request: Request;
  verifier: ShopifyVerifier;
  actor: VerifiedActor;
  idToken: string;
};

export type OwnerProofUseContext = {
  request: Request;
  actor: VerifiedActor;
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

function freezeOwnerBinding(input: OwnerProofInput): FrozenOwnerBinding {
  return {
    request: input.request,
    idToken: String(input.idToken),
    actorSub: String(input.actor.shopifyUserId),
    destShop: String(input.actor.destShop),
    verifierIdentity: String(input.verifier.identity),
  };
}

function ownerBindingsEqual(
  left: FrozenOwnerBinding,
  right: FrozenOwnerBinding,
): boolean {
  return (
    left.request === right.request &&
    left.idToken === right.idToken &&
    left.actorSub === right.actorSub &&
    left.destShop === right.destShop &&
    left.verifierIdentity === right.verifierIdentity
  );
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

function expiryMsFromSession(session: Session): number | null {
  const expires = session.expires;
  if (!(expires instanceof Date)) return null;
  const ms = expires.getTime();
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function issueOwnerHandle(
  binding: FrozenOwnerBinding,
  associatedUserId: string,
  accessToken: string,
  expiresAtMs: number,
): OwnerProofSuccess {
  const actor: VerifiedActor = Object.freeze({
    kind: "human",
    shopifyUserId: binding.actorSub,
    destShop: binding.destShop,
  });
  const handle: OwnerProofSuccess = {
    status: "owner",
    actor,
    associatedUserId,
  };
  Object.defineProperties(handle, {
    toJSON: {
      enumerable: false,
      value: () => ({
        status: "owner",
        associatedUserId,
        actor,
      }),
    },
    [inspect.custom]: {
      enumerable: false,
      value: () =>
        `OwnerProof { status: 'owner', associatedUserId: '${associatedUserId}', credential: '[redacted]' }`,
    },
  });
  Object.freeze(handle);
  Object.freeze(actor);
  OWNER_CREDENTIALS.set(handle, {
    token: accessToken,
    binding,
    expiresAtMs,
  });
  return handle;
}

type TokenExchange = ShopifyVerifier["api"]["auth"]["tokenExchange"];

async function exchangeOnlineAndBind(
  binding: FrozenOwnerBinding,
  tokenExchange: TokenExchange,
): Promise<OwnerProofResult> {
  let session: Session;
  try {
    const exchanged = await tokenExchange({
      shop: binding.destShop,
      sessionToken: binding.idToken,
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
    binding.actorSub,
  );
  if (corroboration === "unsafe") {
    return unsupported("UNSAFE_ASSOCIATED_USER_ID");
  }
  if (corroboration === "mismatch") {
    return unsupported("ASSOCIATED_USER_MISMATCH");
  }

  const expiresAtMs = expiryMsFromSession(session);
  if (expiresAtMs == null) {
    return unsupported("MISSING_EXPIRY");
  }
  if (expiresAtMs <= currentTimeMs()) {
    return denied("EXPIRED");
  }

  const accountOwner = associatedUser.account_owner === true;
  const collaborator = associatedUser.collaborator === true;
  if (!accountOwner || collaborator) {
    return {
      status: "not_owner",
      actor: Object.freeze({
        kind: "human",
        shopifyUserId: binding.actorSub,
        destShop: binding.destShop,
      }),
      code: "OWNER_PROOF_NOT_OWNER",
    };
  }

  return issueOwnerHandle(
    binding,
    String(associatedUser.id),
    accessToken,
    expiresAtMs,
  );
}

/**
 * Prove shop ownership for this request. Never reads the app session cache.
 * Offline sessions are not consulted. Raw credentials are not placed on the
 * returned object.
 *
 * Memoization is bound to request + token + actor + dest shop + verifier
 * identity (digest of apiKey, secret, and host — not apiKey alone). Identical
 * concurrent calls coalesce. Changed inputs on the same Request fail closed
 * without a cached owner result and without a second exchange.
 */
export function proveShopOwner(input: OwnerProofInput): Promise<OwnerProofResult> {
  const tokenExchange = input.verifier.api.auth.tokenExchange.bind(
    input.verifier.api.auth,
  );
  const frozen = freezeOwnerBinding(input);

  const existing = OWNER_PROOF_MEMO.get(frozen.request);
  if (existing) {
    if (!ownerBindingsEqual(existing.binding, frozen)) {
      return Promise.resolve(denied("BINDING_CONFLICT"));
    }
    return existing.pending;
  }

  const pending = exchangeOnlineAndBind(frozen, tokenExchange);
  OWNER_PROOF_MEMO.set(frozen.request, { binding: frozen, pending });
  return pending;
}

/**
 * Use a proven owner credential for a single outbound call. Rechecks handle
 * identity, request/actor/shop binding, and private expiry immediately before
 * invoking `apply`. Callers must not log `accessToken`.
 */
export function withProvenOwnerAccessToken<T>(
  proof: OwnerProofResult,
  context: OwnerProofUseContext,
  apply: (accessToken: string) => T,
): T {
  if (proof.status !== "owner") {
    throw new ActorBoundaryError(
      "OWNER_PROOF_UNSUPPORTED",
      "No proven owner credential is available",
      403,
    );
  }
  const stored = OWNER_CREDENTIALS.get(proof);
  if (!stored) {
    throw new ActorBoundaryError(
      "OWNER_PROOF_UNSUPPORTED",
      "Owner credential is not bound to this handle",
      403,
    );
  }
  if (stored.binding.request !== context.request) {
    throw new ActorBoundaryError(
      "OWNER_PROOF_DENIED",
      "Owner proof request binding mismatch",
      403,
    );
  }
  if (
    stored.binding.actorSub !== context.actor.shopifyUserId ||
    stored.binding.destShop !== context.actor.destShop
  ) {
    throw new ActorBoundaryError(
      "OWNER_PROOF_DENIED",
      "Owner proof actor binding mismatch",
      403,
    );
  }
  if (
    !Number.isFinite(stored.expiresAtMs) ||
    stored.expiresAtMs <= currentTimeMs()
  ) {
    throw new ActorBoundaryError(
      "OWNER_PROOF_DENIED",
      "Owner credential is expired or unusable",
      403,
    );
  }
  return apply(stored.token);
}

export function ownerProofAccessTokenPresent(proof: OwnerProofResult): boolean {
  return proof.status === "owner" && OWNER_CREDENTIALS.has(proof);
}
