/**
 * Versioned, HMAC-authenticated tenant job envelope (transport integrity).
 *
 * Schema: tenant-job-envelope-v1
 *
 * PR 2 provides cryptographic transport authentication and integrity.
 * Database-backed persistence, replay ledger, dead-letter, and durable
 * idempotency remain PR 4 work (R-039 not fully closed for persistence).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
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

/** Maximum future clock skew accepted for issuedAt. */
export const ENVELOPE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** Maximum transport age for a signed envelope. */
export const ENVELOPE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Minimum secret material length after normalization. */
export const ENVELOPE_SECRET_MIN_BYTES = 32;

export const TENANT_JOB_SOURCES = [
  "catalog_sync",
  "abc_analysis",
  "after_auth_catalog_sync",
  "weekly_abc_analysis",
  "webhook:orders/create",
  "webhook:orders/cancelled",
  "webhook:refunds/create",
  "webhook:inventory_levels/update",
  "webhook:app/uninstalled",
] as const;

export type TenantJobSource = (typeof TENANT_JOB_SOURCES)[number];

const SOURCE_SET = new Set<string>(TENANT_JOB_SOURCES);

/** Job-name / webhook-topic → approved envelope source. */
export const JOB_SOURCE_BY_NAME: Record<string, TenantJobSource> = {
  "catalog-sync": "catalog_sync",
  "abc-analysis-shop": "abc_analysis",
  "abc-analysis": "weekly_abc_analysis",
  "orders/create": "webhook:orders/create",
  "orders/cancelled": "webhook:orders/cancelled",
  "refunds/create": "webhook:refunds/create",
  "inventory_levels/update": "webhook:inventory_levels/update",
  "app/uninstalled": "webhook:app/uninstalled",
};

export type TenantJobEnvelopeV1 = Readonly<{
  schemaVersion: typeof TENANT_JOB_ENVELOPE_VERSION;
  shopId: string;
  myshopifyDomain: string;
  source: TenantJobSource;
  correlationId: string;
  causationId?: string;
  issuedAt: string;
  signature: string;
}>;

export type TenantJobContext = {
  envelope: TenantJobEnvelopeV1;
  tenant: TenantAuthority;
  db: TenantDb;
};

type UnsignedEnvelope = Omit<TenantJobEnvelopeV1, "signature">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSecretMaterial(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    const buf = Buffer.from(trimmed, "hex");
    if (buf.length >= ENVELOPE_SECRET_MIN_BYTES) return buf;
  }
  return Buffer.from(trimmed, "utf8");
}

let cachedSecret: Buffer | null = null;

/**
 * Resolve and validate TENANT_JOB_ENVELOPE_SECRET.
 * Fails closed when absent or weaker than 32 bytes.
 */
export function requireTenantJobEnvelopeSecret(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  if (cachedSecret) return cachedSecret;
  const raw = env.TENANT_JOB_ENVELOPE_SECRET;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new TenantAuthorityError(
      "envelope_secret_missing",
      "TENANT_JOB_ENVELOPE_SECRET is required for tenant job envelopes",
    );
  }
  const secret = normalizeSecretMaterial(raw);
  if (secret.length < ENVELOPE_SECRET_MIN_BYTES) {
    throw new TenantAuthorityError(
      "envelope_secret_weak",
      `TENANT_JOB_ENVELOPE_SECRET must provide at least ${ENVELOPE_SECRET_MIN_BYTES} bytes`,
    );
  }
  cachedSecret = secret;
  return secret;
}

/** Test helper — clear cached secret between cases. */
export function resetTenantJobEnvelopeSecretCache(): void {
  cachedSecret = null;
}

export function assertTenantJobSource(
  source: string,
): asserts source is TenantJobSource {
  if (!SOURCE_SET.has(source)) {
    throw new TenantAuthorityError(
      "envelope_source_unapproved",
      `Job envelope source is not approved: ${source}`,
    );
  }
}

/** Deterministic serialization of every unsigned envelope field. */
export function serializeUnsignedEnvelope(unsigned: UnsignedEnvelope): string {
  return JSON.stringify({
    causationId: unsigned.causationId ?? null,
    correlationId: unsigned.correlationId,
    issuedAt: unsigned.issuedAt,
    myshopifyDomain: unsigned.myshopifyDomain,
    schemaVersion: unsigned.schemaVersion,
    shopId: unsigned.shopId,
    source: unsigned.source,
  });
}

export function signTenantJobEnvelope(
  unsigned: UnsignedEnvelope,
  secret: Buffer = requireTenantJobEnvelopeSecret(),
): string {
  return createHmac("sha256", secret)
    .update(serializeUnsignedEnvelope(unsigned))
    .digest("base64url");
}

function verifySignature(
  unsigned: UnsignedEnvelope,
  signature: string,
  secret: Buffer,
): void {
  const expected = signTenantJobEnvelope(unsigned, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TenantAuthorityError(
      "envelope_signature_invalid",
      "Job envelope signature verification failed",
    );
  }
}

function assertIssuedAtPolicy(
  issuedAt: string,
  nowMs: number = Date.now(),
): void {
  const ts = Date.parse(issuedAt);
  if (!Number.isFinite(ts)) {
    throw new TenantAuthorityError(
      "envelope_issued_at_invalid",
      "Job envelope issuedAt is not a valid timestamp",
    );
  }
  if (ts - nowMs > ENVELOPE_MAX_FUTURE_SKEW_MS) {
    throw new TenantAuthorityError(
      "envelope_issued_at_future",
      "Job envelope issuedAt is too far in the future",
    );
  }
  if (nowMs - ts > ENVELOPE_MAX_AGE_MS) {
    throw new TenantAuthorityError(
      "envelope_expired",
      "Job envelope is older than the PR 2 transport window",
    );
  }
}

export function createTenantJobEnvelope(
  tenant: TenantAuthority,
  source: TenantJobSource,
): TenantJobEnvelopeV1 {
  assertTenantJobSource(source);
  const secret = requireTenantJobEnvelopeSecret();
  const unsigned: UnsignedEnvelope = {
    schemaVersion: TENANT_JOB_ENVELOPE_VERSION,
    shopId: tenant.shopId,
    myshopifyDomain: tenant.myshopifyDomain,
    source,
    correlationId: tenant.correlationId,
    ...(tenant.causationId ? { causationId: tenant.causationId } : {}),
    issuedAt: new Date().toISOString(),
  };
  return {
    ...unsigned,
    signature: signTenantJobEnvelope(unsigned, secret),
  };
}

/**
 * Parse and cryptographically verify an envelope.
 * Order: shape → version → fields → domain → source → timestamp → age → signature.
 * Canonical Shop lookup happens in resolveTenantJobContext after this.
 *
 * New dispatches use tenant-job-envelope-v3 (see app/sync/envelope-v3.server.ts).
 * This function remains v1-only; use parseTenantJobEnvelopeAny for workers that
 * must accept both during the compatibility window.
 */
export function parseTenantJobEnvelope(
  raw: unknown,
  options?: { nowMs?: number; secret?: Buffer },
): TenantJobEnvelopeV1 {
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

  const allowedKeys = new Set([
    "schemaVersion",
    "shopId",
    "myshopifyDomain",
    "source",
    "correlationId",
    "causationId",
    "issuedAt",
    "signature",
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      throw new TenantAuthorityError(
        "envelope_unexpected_field",
        `Job envelope contains unexpected field: ${key}`,
      );
    }
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
  assertTenantJobSource(raw.source);

  if (typeof raw.correlationId !== "string" || raw.correlationId.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_correlation",
      "Job envelope missing correlationId",
    );
  }

  if (raw.causationId !== undefined && typeof raw.causationId !== "string") {
    throw new TenantAuthorityError(
      "envelope_causation_invalid",
      "Job envelope causationId must be a string when present",
    );
  }
  if (typeof raw.causationId === "string" && raw.causationId.length === 0) {
    throw new TenantAuthorityError(
      "envelope_causation_invalid",
      "Job envelope causationId must be non-empty when present",
    );
  }

  if (typeof raw.issuedAt !== "string" || raw.issuedAt.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_issued_at",
      "Job envelope missing issuedAt",
    );
  }
  assertIssuedAtPolicy(raw.issuedAt, options?.nowMs);

  if (typeof raw.signature !== "string" || raw.signature.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_signature",
      "Job envelope missing signature",
    );
  }

  const unsigned: UnsignedEnvelope = {
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

  const secret = options?.secret ?? requireTenantJobEnvelopeSecret();
  verifySignature(unsigned, raw.signature, secret);

  return { ...unsigned, signature: raw.signature };
}

export function assertSourceMatchesJob(
  envelope: { source: TenantJobSource },
  jobNameOrTopic: string,
): void {
  const expected = JOB_SOURCE_BY_NAME[jobNameOrTopic];
  if (!expected) {
    throw new TenantAuthorityError(
      "envelope_source_job_mismatch",
      `No approved source mapping for job/topic ${jobNameOrTopic}`,
    );
  }
  // after_auth_catalog_sync may be processed by catalog-sync worker
  if (jobNameOrTopic === "catalog-sync") {
    if (
      envelope.source !== "catalog_sync" &&
      envelope.source !== "after_auth_catalog_sync"
    ) {
      throw new TenantAuthorityError(
        "envelope_source_job_mismatch",
        "Envelope source is incompatible with catalog-sync job",
      );
    }
    return;
  }
  if (envelope.source !== expected) {
    throw new TenantAuthorityError(
      "envelope_source_job_mismatch",
      `Envelope source ${envelope.source} incompatible with ${jobNameOrTopic}`,
    );
  }
}

/**
 * Validate envelope (including signature), resolve canonical Shop, issue
 * worker authority, and create tenant-bound DB access.
 * No merchant query may occur before signature + Shop match succeed.
 */
export async function resolveTenantJobContext(
  rawEnvelope: unknown,
  options?: {
    payloadShop?: string | null;
    expectedJobNameOrTopic?: string;
    nowMs?: number;
  },
): Promise<TenantJobContext> {
  const envelope = parseTenantJobEnvelope(rawEnvelope, {
    nowMs: options?.nowMs,
  });

  if (options?.expectedJobNameOrTopic) {
    assertSourceMatchesJob(envelope, options.expectedJobNameOrTopic);
  }

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

/** Build signed envelope from verified webhook/scheduler identity (producer). */
export async function issueJobEnvelopeForVerifiedDomain(input: {
  verifiedDomain: string;
  source: TenantJobSource;
  correlationId?: string;
  causationId?: string;
  createShopIfMissing?: boolean;
}): Promise<{ envelope: TenantJobEnvelopeV1; tenant: TenantAuthority }> {
  assertTenantJobSource(input.source);
  const { resolveAuthorityAfterVerifiedAuth } = await import(
    "./bootstrap.server"
  );
  const { tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: input.verifiedDomain,
    source:
      input.source.startsWith("webhook:")
        ? "verified_webhook"
        : "verified_scheduler",
    correlationId: input.correlationId,
    causationId: input.causationId,
    createIfMissing: input.createShopIfMissing ?? false,
  });

  normalizeVerifiedShopifyDomain(tenant.myshopifyDomain);

  return {
    tenant,
    envelope: createTenantJobEnvelope(tenant, input.source),
  };
}
