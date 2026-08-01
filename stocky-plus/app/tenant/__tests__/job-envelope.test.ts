import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import {
  createTenantJobEnvelope,
  parseTenantJobEnvelope,
  requireTenantJobEnvelopeSecret,
  resetTenantJobEnvelopeSecretCache,
  resolveTenantJobContext,
  signTenantJobEnvelope,
  TENANT_JOB_ENVELOPE_VERSION,
  type TenantJobEnvelopeV1,
} from "../job-envelope.server";
import { TenantAuthorityError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant job envelope v1 integrity (PR 2 C-03)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    resetTenantJobEnvelopeSecretCache();
    requireTenantJobEnvelopeSecret();
    prisma = createPrisma();
    await resetPublicSchema(prisma);
  });

  beforeEach(async () => {
    await prisma.supplier.deleteMany();
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function authA() {
    return issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
      correlationId: "corr-a",
      causationId: "cause-a",
    });
  }

  function signedA(
    overrides: Partial<TenantJobEnvelopeV1> = {},
  ): TenantJobEnvelopeV1 {
    const base = createTenantJobEnvelope(authA(), "catalog_sync");
    const merged = { ...base, ...overrides };
    if (
      overrides.shopId ||
      overrides.myshopifyDomain ||
      overrides.source ||
      overrides.correlationId ||
      overrides.causationId ||
      overrides.issuedAt ||
      overrides.schemaVersion
    ) {
      // Re-sign only when caller wants a structurally valid alternate envelope.
      if (overrides.signature === undefined) {
        const unsigned = { ...merged };
        delete (unsigned as { signature?: string }).signature;
        return {
          ...unsigned,
          signature: signTenantJobEnvelope(unsigned),
        } as TenantJobEnvelopeV1;
      }
    }
    return merged;
  }

  function tamper(
    field: keyof TenantJobEnvelopeV1,
    value: string,
  ): Record<string, unknown> {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    return { ...env, [field]: value };
  }

  it("valid signed envelope resolves", async () => {
    const ctx = await resolveTenantJobContext(signedA(), {
      expectedJobNameOrTopic: "catalog-sync",
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
    const row = await ctx.db.supplier.create({ data: { name: "FromJob" } });
    expect(row.shopId).toBe(shopAId);
  });

  it("changed shopId is denied", async () => {
    await expect(
      resolveTenantJobContext(tamper("shopId", shopBId)),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("changed domain is denied", async () => {
    await expect(
      resolveTenantJobContext(tamper("myshopifyDomain", SHOP_B_DOMAIN)),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("changed source is denied", async () => {
    await expect(
      resolveTenantJobContext(tamper("source", "abc_analysis")),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("changed correlation ID is denied", async () => {
    await expect(
      resolveTenantJobContext(tamper("correlationId", "other")),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("changed causation ID is denied", async () => {
    await expect(
      resolveTenantJobContext(tamper("causationId", "other-cause")),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("changed issuedAt is denied", async () => {
    await expect(
      resolveTenantJobContext(
        tamper("issuedAt", new Date(Date.now() - 1000).toISOString()),
      ),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("invalid date is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    const unsigned = { ...env };
    delete (unsigned as { signature?: string }).signature;
    const bad = {
      ...unsigned,
      issuedAt: "not-a-date",
      signature: signTenantJobEnvelope({
        ...unsigned,
        issuedAt: "not-a-date",
      }),
    };
    await expect(resolveTenantJobContext(bad)).rejects.toMatchObject({
      code: "envelope_issued_at_invalid",
    });
  });

  it("future timestamp beyond skew is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    const unsigned = { ...env };
    delete (unsigned as { signature?: string }).signature;
    const issuedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const bad = {
      ...unsigned,
      issuedAt,
      signature: signTenantJobEnvelope({ ...unsigned, issuedAt }),
    };
    await expect(resolveTenantJobContext(bad)).rejects.toMatchObject({
      code: "envelope_issued_at_future",
    });
  });

  it("expired envelope is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    const unsigned = { ...env };
    delete (unsigned as { signature?: string }).signature;
    const issuedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const bad = {
      ...unsigned,
      issuedAt,
      signature: signTenantJobEnvelope({ ...unsigned, issuedAt }),
    };
    await expect(resolveTenantJobContext(bad)).rejects.toMatchObject({
      code: "envelope_expired",
    });
  });

  it("added unsigned field is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    await expect(
      resolveTenantJobContext({ ...env, extra: "nope" }),
    ).rejects.toMatchObject({ code: "envelope_unexpected_field" });
  });

  it("removed signed field is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    const rest = { ...env };
    delete (rest as { correlationId?: string }).correlationId;
    await expect(resolveTenantJobContext(rest)).rejects.toMatchObject({
      code: "missing_envelope_correlation",
    });
  });

  it("missing signature is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    const rest = { ...env };
    delete (rest as { signature?: string }).signature;
    await expect(resolveTenantJobContext(rest)).rejects.toMatchObject({
      code: "missing_envelope_signature",
    });
  });

  it("invalid signature is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    await expect(
      resolveTenantJobContext({
        ...env,
        signature: "a".repeat(env.signature.length),
      }),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("signature wrong length is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    await expect(
      resolveTenantJobContext({ ...env, signature: "short" }),
    ).rejects.toMatchObject({ code: "envelope_signature_invalid" });
  });

  it("unknown schema version is denied", async () => {
    await expect(
      resolveTenantJobContext(tamper("schemaVersion", "v0")),
    ).rejects.toMatchObject({ code: "unknown_envelope_version" });
  });

  it("raw shop-only payload is denied", async () => {
    await expect(
      resolveTenantJobContext({ shop: SHOP_A_DOMAIN }),
    ).rejects.toMatchObject({ code: "unknown_envelope_version" });
  });

  it("unapproved source is denied", async () => {
    await expect(() =>
      createTenantJobEnvelope(authA(), "anything" as never),
    ).toThrow(TenantAuthorityError);
  });

  it("source/job-name mismatch is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    await expect(
      resolveTenantJobContext(env, {
        expectedJobNameOrTopic: "abc-analysis-shop",
      }),
    ).rejects.toMatchObject({ code: "envelope_source_job_mismatch" });
  });

  it("webhook-topic/source mismatch is denied", async () => {
    const env = createTenantJobEnvelope(authA(), "webhook:orders/create");
    await expect(
      resolveTenantJobContext(env, {
        expectedJobNameOrTopic: "orders/cancelled",
      }),
    ).rejects.toMatchObject({ code: "envelope_source_job_mismatch" });
  });

  it("shopId+domain knowledge without signature cannot establish authority", async () => {
    await expect(
      resolveTenantJobContext({
        schemaVersion: TENANT_JOB_ENVELOPE_VERSION,
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "catalog_sync",
        correlationId: "x",
        issuedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: "missing_envelope_signature" });
  });

  it("no merchant query before complete validation", async () => {
    await expect(resolveTenantJobContext(null)).rejects.toBeInstanceOf(
      TenantAuthorityError,
    );
    expect(await prisma.supplier.count()).toBe(0);
  });

  it("retry of the same still-valid envelope preserves tenant identity", async () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    const first = await resolveTenantJobContext(env, {
      expectedJobNameOrTopic: "catalog-sync",
    });
    const second = await resolveTenantJobContext(env, {
      expectedJobNameOrTopic: "catalog-sync",
    });
    expect(second.tenant.shopId).toBe(first.tenant.shopId);
  });

  it("concurrent valid jobs for two shops remain isolated", async () => {
    const tenantB = issueTenantAuthority({
      shopId: shopBId,
      myshopifyDomain: SHOP_B_DOMAIN,
      source: "verified_job",
    });
    const envB = createTenantJobEnvelope(tenantB, "catalog_sync");
    const [a, b] = await Promise.all([
      resolveTenantJobContext(createTenantJobEnvelope(authA(), "catalog_sync")),
      resolveTenantJobContext(envB),
    ]);
    await Promise.all([
      a.db.supplier.create({ data: { name: "JA" } }),
      b.db.supplier.create({ data: { name: "JB" } }),
    ]);
    expect(
      (await a.db.supplier.findMany({})).map((s: { name: string }) => s.name),
    ).toEqual(["JA"]);
    expect(
      (await b.db.supplier.findMany({})).map((s: { name: string }) => s.name),
    ).toEqual(["JB"]);
  });

  it("parseTenantJobEnvelope verifies signature before returning", () => {
    const env = createTenantJobEnvelope(authA(), "catalog_sync");
    expect(parseTenantJobEnvelope(env).signature).toBe(env.signature);
    expect(() =>
      parseTenantJobEnvelope({ ...env, shopId: shopBId }),
    ).toThrow(TenantAuthorityError);
  });
});
