import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../authority.server";
import {
  createTenantJobEnvelope,
  resolveTenantJobContext,
  TENANT_JOB_ENVELOPE_VERSION,
} from "../job-envelope.server";
import { TenantAuthorityError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant job envelope v1 (PR 2)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
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

  function envelopeA(overrides: Record<string, unknown> = {}) {
    const tenant = issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
      correlationId: "corr-a",
    });
    return { ...createTenantJobEnvelope(tenant, "test"), ...overrides };
  }

  it("valid envelope resolves to tenant-bound access", async () => {
    const ctx = await resolveTenantJobContext(envelopeA());
    expect(ctx.tenant.shopId).toBe(shopAId);
    const row = await ctx.db.supplier.create({ data: { name: "FromJob" } });
    expect(row.shopId).toBe(shopAId);
  });

  it("missing envelope is denied", async () => {
    await expect(resolveTenantJobContext(undefined)).rejects.toMatchObject({
      code: "missing_envelope",
    });
  });

  it("wrong schema version is denied", async () => {
    await expect(
      resolveTenantJobContext(envelopeA({ schemaVersion: "v0" })),
    ).rejects.toMatchObject({ code: "unknown_envelope_version" });
  });

  it("missing shop ID is denied", async () => {
    await expect(
      resolveTenantJobContext(envelopeA({ shopId: "" })),
    ).rejects.toMatchObject({ code: "missing_envelope_shop_id" });
  });

  it("malformed domain is denied", async () => {
    await expect(
      resolveTenantJobContext(
        envelopeA({ myshopifyDomain: "https://a.myshopify.com" }),
      ),
    ).rejects.toMatchObject({ code: "malformed_envelope_domain" });
  });

  it("nonexistent canonical Shop is denied", async () => {
    await expect(
      resolveTenantJobContext(
        envelopeA({ shopId: "missing-id", myshopifyDomain: SHOP_A_DOMAIN }),
      ),
    ).rejects.toMatchObject({ code: "canonical_shop_missing" });
  });

  it("Shop ID/domain mismatch is denied", async () => {
    await expect(
      resolveTenantJobContext(
        envelopeA({ shopId: shopAId, myshopifyDomain: SHOP_B_DOMAIN }),
      ),
    ).rejects.toMatchObject({ code: "canonical_shop_mismatch" });
  });

  it("payload shop mismatch is denied", async () => {
    await expect(
      resolveTenantJobContext(envelopeA(), { payloadShop: SHOP_B_DOMAIN }),
    ).rejects.toMatchObject({ code: "payload_envelope_mismatch" });
  });

  it("worker cannot access merchant data before envelope validation", async () => {
    await expect(resolveTenantJobContext(null)).rejects.toBeInstanceOf(
      TenantAuthorityError,
    );
  });

  it("replaying the same valid transport envelope preserves tenant identity", async () => {
    const env = envelopeA();
    const first = await resolveTenantJobContext(env);
    const second = await resolveTenantJobContext(env);
    expect(second.tenant.shopId).toBe(first.tenant.shopId);
    expect(second.tenant.myshopifyDomain).toBe(first.tenant.myshopifyDomain);
    expect(env.schemaVersion).toBe(TENANT_JOB_ENVELOPE_VERSION);
  });

  it("concurrent jobs for two Shops remain isolated", async () => {
    const tenantB = issueTenantAuthority({
      shopId: shopBId,
      myshopifyDomain: SHOP_B_DOMAIN,
      source: "verified_job",
    });
    const envB = createTenantJobEnvelope(tenantB, "test-b");
    const [a, b] = await Promise.all([
      resolveTenantJobContext(envelopeA()),
      resolveTenantJobContext(envB),
    ]);
    await Promise.all([
      a.db.supplier.create({ data: { name: "JA" } }),
      b.db.supplier.create({ data: { name: "JB" } }),
    ]);
    expect((await a.db.supplier.findMany({})).map((s: { name: string }) => s.name)).toEqual([
      "JA",
    ]);
    expect((await b.db.supplier.findMany({})).map((s: { name: string }) => s.name)).toEqual([
      "JB",
    ]);
  });
});
