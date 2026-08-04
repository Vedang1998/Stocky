/**
 * tenant-job-envelope-v2 — binds durableJobId + payloadDigest at dispatch.
 * Preserves PR 2 secret strength and source allowlist; adds durable bindings.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  issueTenantAuthority,
  type TenantAuthority,
} from "../tenant/authority.server";
import {
  ENVELOPE_MAX_AGE_MS,
  ENVELOPE_MAX_FUTURE_SKEW_MS,
  assertTenantJobSource,
  requireTenantJobEnvelopeSecret,
  type TenantJobSource,
} from "../tenant/job-envelope.server";
import { requireCanonicalShopMatch } from "../tenant/bootstrap.server";
import { TenantAuthorityError } from "../tenant/errors";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { createTenantDb, type TenantDb } from "../tenant/tenant-db.server";

export const TENANT_JOB_ENVELOPE_V2_VERSION = "tenant-job-envelope-v2" as const;

export type TenantJobEnvelopeV2 = Readonly<{
  schemaVersion: typeof TENANT_JOB_ENVELOPE_V2_VERSION;
  durableJobId: string;
  shopId: string;
  myshopifyDomain: string;
  source: TenantJobSource;
  correlationId: string;
  causationId?: string;
  payloadDigest: string;
  issuedAt: string;
  signature: string;
}>;

export type TenantJobContextV2 = {
  envelope: TenantJobEnvelopeV2;
  tenant: TenantAuthority;
  db: TenantDb;
};

type UnsignedV2 = Omit<TenantJobEnvelopeV2, "signature">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function serializeUnsignedEnvelopeV2(unsigned: UnsignedV2): string {
  return JSON.stringify({
    causationId: unsigned.causationId ?? null,
    correlationId: unsigned.correlationId,
    durableJobId: unsigned.durableJobId,
    issuedAt: unsigned.issuedAt,
    myshopifyDomain: unsigned.myshopifyDomain,
    payloadDigest: unsigned.payloadDigest,
    schemaVersion: unsigned.schemaVersion,
    shopId: unsigned.shopId,
    source: unsigned.source,
  });
}

export function signTenantJobEnvelopeV2(
  unsigned: UnsignedV2,
  secret: Buffer = requireTenantJobEnvelopeSecret(),
): string {
  return createHmac("sha256", secret)
    .update(serializeUnsignedEnvelopeV2(unsigned))
    .digest("base64url");
}

function verifySignatureV2(
  unsigned: UnsignedV2,
  signature: string,
  secret: Buffer,
): void {
  const expected = signTenantJobEnvelopeV2(unsigned, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TenantAuthorityError(
      "envelope_signature_invalid",
      "Job envelope v2 signature verification failed",
    );
  }
}

function assertIssuedAtPolicy(issuedAt: string, nowMs: number = Date.now()): void {
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
      "Job envelope is older than the transport window",
    );
  }
}

export function createTenantJobEnvelopeV2(input: {
  tenant: TenantAuthority;
  source: TenantJobSource;
  durableJobId: string;
  payloadDigest: string;
}): TenantJobEnvelopeV2 {
  assertTenantJobSource(input.source);
  if (!input.durableJobId) {
    throw new TenantAuthorityError(
      "missing_envelope_durable_job_id",
      "Envelope v2 requires durableJobId",
    );
  }
  if (!input.payloadDigest || input.payloadDigest.length !== 64) {
    throw new TenantAuthorityError(
      "missing_envelope_payload_digest",
      "Envelope v2 requires a 64-char hex payloadDigest",
    );
  }

  const secret = requireTenantJobEnvelopeSecret();
  const unsigned: UnsignedV2 = {
    schemaVersion: TENANT_JOB_ENVELOPE_V2_VERSION,
    durableJobId: input.durableJobId,
    shopId: input.tenant.shopId,
    myshopifyDomain: input.tenant.myshopifyDomain,
    source: input.source,
    correlationId: input.tenant.correlationId,
    ...(input.tenant.causationId
      ? { causationId: input.tenant.causationId }
      : {}),
    payloadDigest: input.payloadDigest,
    issuedAt: new Date().toISOString(),
  };
  return {
    ...unsigned,
    signature: signTenantJobEnvelopeV2(unsigned, secret),
  };
}

export function parseTenantJobEnvelopeV2(
  raw: unknown,
  options?: { nowMs?: number; secret?: Buffer },
): TenantJobEnvelopeV2 {
  if (!isRecord(raw)) {
    throw new TenantAuthorityError(
      "missing_envelope",
      "Job tenant envelope is missing",
    );
  }

  if (raw.schemaVersion !== TENANT_JOB_ENVELOPE_V2_VERSION) {
    throw new TenantAuthorityError(
      "unknown_envelope_version",
      `Unsupported tenant job envelope version: ${String(raw.schemaVersion)}`,
    );
  }

  const allowedKeys = new Set([
    "schemaVersion",
    "durableJobId",
    "shopId",
    "myshopifyDomain",
    "source",
    "correlationId",
    "causationId",
    "payloadDigest",
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

  if (typeof raw.durableJobId !== "string" || raw.durableJobId.length === 0) {
    throw new TenantAuthorityError(
      "missing_envelope_durable_job_id",
      "Job envelope missing durableJobId",
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
  if (typeof raw.payloadDigest !== "string" || raw.payloadDigest.length !== 64) {
    throw new TenantAuthorityError(
      "missing_envelope_payload_digest",
      "Job envelope missing valid payloadDigest",
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

  const unsigned: UnsignedV2 = {
    schemaVersion: TENANT_JOB_ENVELOPE_V2_VERSION,
    durableJobId: raw.durableJobId,
    shopId: raw.shopId,
    myshopifyDomain: domain.normalized,
    source: raw.source,
    correlationId: raw.correlationId,
    ...(typeof raw.causationId === "string"
      ? { causationId: raw.causationId }
      : {}),
    payloadDigest: raw.payloadDigest,
    issuedAt: raw.issuedAt,
  };

  const secret = options?.secret ?? requireTenantJobEnvelopeSecret();
  verifySignatureV2(unsigned, raw.signature, secret);

  return { ...unsigned, signature: raw.signature };
}

export async function resolveTenantJobContextV2(
  rawEnvelope: unknown,
  options?: {
    payloadShop?: string | null;
    expectedJobNameOrTopic?: string;
    expectedDurableJobId?: string;
    expectedPayloadDigest?: string;
    nowMs?: number;
  },
): Promise<TenantJobContextV2> {
  const { assertSourceMatchesJob } = await import("../tenant/job-envelope.server");
  const envelope = parseTenantJobEnvelopeV2(rawEnvelope, {
    nowMs: options?.nowMs,
  });

  if (options?.expectedJobNameOrTopic) {
    assertSourceMatchesJob(
      { source: envelope.source },
      options.expectedJobNameOrTopic,
    );
  }

  if (
    options?.expectedDurableJobId &&
    options.expectedDurableJobId !== envelope.durableJobId
  ) {
    throw new TenantAuthorityError(
      "envelope_durable_job_mismatch",
      "Envelope durableJobId does not match durable job",
    );
  }

  if (
    options?.expectedPayloadDigest &&
    options.expectedPayloadDigest !== envelope.payloadDigest
  ) {
    throw new TenantAuthorityError(
      "payload_digest_mismatch",
      "Envelope payloadDigest does not match durable job",
    );
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

  return { envelope, tenant, db: createTenantDb(tenant) };
}
