/**
 * Versioned tenant job envelope — transport authority for workers.
 *
 * Schema: tenant-job-envelope-v1
 *
 * PR 2 validates envelopes in-process before merchant access.
 * Database-backed persistence, replay ledger, dead-letter, and durable
 * idempotency remain PR 4 / PR 7 work (R-039 not fully closed).
 */

import {
  issueTenantAuthority,
  type TenantAuthority,
} from "./authority.server";
import {
  normalizeVerifiedShopifyDomain,
  requireCanonicalShopMatch,
} from "./bootstrap.server";
import { TenantAuthorityError } from "./errors";
import { createTenantDb, type TenantDb } from "./tenant-db.server";
import { normalizeShopDomain } from "./shop-domain";

export const TENANT_JOB_ENVELOPE_VERSION = "tenant-job-envelope-v1" as const;

export type TenantJobEnvelopeV1 = {
  schemaVersion: typeof TENANT_JOB_ENVELOPE_VERSION;
  shopId: string;
  myshopifyDomain: string;
  source: string;
  correlationId: string;
  causationId?: string;
  issuedAt: string;
};

export type TenantJobContext = {
  envelope: TenantJobEnvelopeV1;
  tenant: TenantAuthority;
  db: TenantDb;
};

export function createTenantJobEnvelope(
  tenant: TenantAuthority,
  source: string,
): TenantJobEnvelopeV1 {
  return {
    schemaVersion: TENANT_JOB_ENVELOPE_VERSION,
    shopId: tenant.shopId,
    myshopifyDomain: tenant.myshopifyDomain,
    source,
    correlationId: tenant.correlationId,
    ...(tenant.causationId ? { causationId: tenant.causationId } : {}),
    issuedAt: new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTenantJobEnvelope(raw: unknown): TenantJobEnvelopeV1 {
  if (!isRecord(raw)) {
    throw new TenantAuthorityError(
      "missing_envelope",
      "Job tenant envelope is missing",
    );
  }

  if (raw.schemaVersion !== TENANT_JOB_ENVELOPE_VERSION) {
    throw new TenantAuthorityError(
      "unknown_envelope_version",
      `Unsupported tenant job envelope version: ${String(raw.schemaVersion)}`,
    );
  }

  if (typeof raw.shopId !== "string" || raw.shopId.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_shop_id",
      "Job envelope missing shopId",
    );
  }

  if (typeof raw.myshopifyDomain !== "string" || raw.myshopifyDomain.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_domain",
      "Job envelope missing myshopifyDomain",
    );
  }

  const domain = normalizeShopDomain(raw.myshopifyDomain);
  if (!domain.ok) {
    throw new TenantAuthorityError(
      "malformed_envelope_domain",
      `Job envelope domain failed normalization: ${domain.reason}`,
    );
  }

  if (typeof raw.source !== "string" || raw.source.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_source",
      "Job envelope missing source",
    );
  }

  if (typeof raw.correlationId !== "string" || raw.correlationId.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_correlation",
      "Job envelope missing correlationId",
    );
  }

  if (typeof raw.issuedAt !== "string" || raw.issuedAt.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_issued_at",
      "Job envelope missing issuedAt",
    );
  }

  return {
    schemaVersion: TENANT_JOB_ENVELOPE_VERSION,
    shopId: raw.shopId,
    myshopifyDomain: domain.normalized,
    source: raw.source,
    correlationId: raw.correlationId,
    ...(typeof raw.causationId === "string"
      ? { causationId: raw.causationId }
      : {}),
    issuedAt: raw.issuedAt,
  };
}

/**
 * Validate envelope, resolve canonical Shop, issue worker authority, and
 * create tenant-bound DB access. Must run before any merchant-owned access.
 */
export async function resolveTenantJobContext(
  rawEnvelope: unknown,
  options?: {
    /** Optional payload shop/domain that must not conflict with the envelope. */
    payloadShop?: string | null;
  },
): Promise<TenantJobContext> {
  const envelope = parseTenantJobEnvelope(rawEnvelope);

  if (options?.payloadShop != null && options.payloadShop !== "") {
    const payloadNorm = normalizeShopDomain(options.payloadShop);
    if (!payloadNorm.ok || payloadNorm.normalized !== envelope.myshopifyDomain) {
      throw new TenantAuthorityError(
        "payload_envelope_mismatch",
        "Payload shop does not match tenant job envelope",
      );
    }
  }

  const shop = await requireCanonicalShopMatch({
    shopId: envelope.shopId,
    myshopifyDomain: envelope.myshopifyDomain,
  });

  const tenant = issueTenantAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: "verified_job",
    correlationId: envelope.correlationId,
    causationId: envelope.causationId,
  });

  const db = createTenantDb(tenant);
  return { envelope, tenant, db };
}

/** Build envelope from verified webhook/scheduler identity (producer side). */
export async function issueJobEnvelopeForVerifiedDomain(input: {
  verifiedDomain: string;
  source: string;
  correlationId?: string;
  causationId?: string;
  createShopIfMissing?: boolean;
}): Promise<{ envelope: TenantJobEnvelopeV1; tenant: TenantAuthority }> {
  const { resolveAuthorityAfterVerifiedAuth } = await import(
    "./bootstrap.server"
  );
  const { tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: input.verifiedDomain,
    source:
      input.source.startsWith("webhook")
        ? "verified_webhook"
        : "verified_scheduler",
    correlationId: input.correlationId,
    causationId: input.causationId,
    createIfMissing: input.createShopIfMissing ?? false,
  });

  // Ensure domain on envelope is normalized canonical form.
  normalizeVerifiedShopifyDomain(tenant.myshopifyDomain);

  return {
    tenant,
    envelope: createTenantJobEnvelope(tenant, input.source),
  };
}
