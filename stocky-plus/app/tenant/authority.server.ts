/**
 * Branded, non-forgeable server-side tenant authority.
 *
 * Only approved resolvers in app/tenant/ may call issueTenantAuthority.
 * Ordinary callers cannot construct a valid authority from client input.
 */

import { randomUUID } from "node:crypto";
import { TenantAuthorityError } from "./errors";

const issuedAuthorities = new WeakSet<object>();

export type TenantAuthoritySource =
  | "verified_admin_request"
  | "verified_webhook"
  | "verified_job"
  | "verified_scheduler";

export type TenantAuthority = {
  readonly shopId: string;
  readonly myshopifyDomain: string;
  readonly source: TenantAuthoritySource;
  readonly correlationId: string;
  readonly causationId?: string;
};

export type IssueTenantAuthorityInput = {
  shopId: string;
  myshopifyDomain: string;
  source: TenantAuthoritySource;
  correlationId?: string;
  causationId?: string;
};

/**
 * Issue branded tenant authority. Importable only by approved tenant resolvers;
 * architecture audit rejects calls outside app/tenant/.
 */
export function issueTenantAuthority(
  input: IssueTenantAuthorityInput,
): TenantAuthority {
  if (!input.shopId || typeof input.shopId !== "string") {
    throw new TenantAuthorityError(
      "invalid_shop_id",
      "Tenant authority requires a canonical shopId",
    );
  }
  if (!input.myshopifyDomain || typeof input.myshopifyDomain !== "string") {
    throw new TenantAuthorityError(
      "invalid_domain",
      "Tenant authority requires a canonical myshopifyDomain",
    );
  }

  const authority: TenantAuthority = Object.freeze({
    shopId: input.shopId,
    myshopifyDomain: input.myshopifyDomain,
    source: input.source,
    correlationId: input.correlationId ?? randomUUID(),
    ...(input.causationId ? { causationId: input.causationId } : {}),
  });

  issuedAuthorities.add(authority);
  return authority;
}

export function isTenantAuthority(value: unknown): value is TenantAuthority {
  return (
    typeof value === "object" &&
    value !== null &&
    issuedAuthorities.has(value as object)
  );
}

export function assertTenantAuthority(
  value: unknown,
): asserts value is TenantAuthority {
  if (!isTenantAuthority(value)) {
    throw new TenantAuthorityError(
      "unbranded_authority",
      "Missing or forged tenant authority — value was not issued by an approved resolver",
    );
  }
}

/** Explicitly reject attempts to build authority from raw client-controlled values. */
export function rejectRawAuthorityConstruction(
  _shopOrShopId: string,
): never {
  throw new TenantAuthorityError(
    "raw_authority_forbidden",
    "Raw shop domain or shopId cannot construct tenant authority",
  );
}
