/**
 * PR 3 — worker/job envelope, export/privacy/reconciliation context tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  createTenantJobEnvelope,
  parseTenantJobEnvelope,
  resolveTenantJobContext,
} from "../../job-envelope.server";
import { issueTenantAuthority } from "../../authority.server";
import { createTenantDb } from "../../tenant-db.server";
import { TenantAccessError, TenantAuthorityError } from "../../errors";
import {
  resetAndEnforce,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  withRuntimePg,
} from "./helpers";
import { TENANT_DB_CONTEXT_VERSION } from "../../db-context.server";

describe("PR3 worker/job + export/privacy/reconciliation isolation", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    if (!process.env.TENANT_JOB_ENVELOPE_SECRET) {
      // Test-only fixture (≥32 bytes). Never a production secret.
      process.env.TENANT_JOB_ENVELOPE_SECRET =
        "test-only-tenant-job-envelope-secret-32b!!"; // pragma: allowlist secret
    }
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    await migrationPrisma.supplier.createMany({
      data: [
        { id: "job-a", shop: SHOP_A_DOMAIN, shopId: shopAId, name: "A" },
        { id: "job-b", shop: SHOP_B_DOMAIN, shopId: shopBId, name: "B" },
      ],
    });
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("validated Shop A envelope establishes Shop A TenantDb context only", async () => {
    const authority = issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
    });
    const envelope = createTenantJobEnvelope(authority, "catalog_sync");
    const parsed = parseTenantJobEnvelope(envelope);
    expect(parsed.shopId).toBe(shopAId);

    const ctx = await resolveTenantJobContext(envelope);
    const rows = await ctx.db.supplier.findMany();
    expect(rows.map((r: { id: string }) => r.id)).toEqual(["job-a"]);
  });

  it("tampered envelope denied before merchant query", async () => {
    const authority = issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
    });
    const envelope = createTenantJobEnvelope(authority, "catalog_sync");
    const tampered = {
      ...envelope,
      shopId: shopBId,
    };
    expect(() => parseTenantJobEnvelope(tampered)).toThrow();
  });

  it("missing envelope / unbranded authority denied", async () => {
    expect(() =>
      createTenantDb({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_job",
        correlationId: "x",
      } as never),
    ).toThrow(TenantAuthorityError);
  });

  it("worker for Shop A cannot read Shop B via TenantDb", async () => {
    const dbA = createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_job",
      }),
    );
    const dbB = createTenantDb(
      issueTenantAuthority({
        shopId: shopBId,
        myshopifyDomain: SHOP_B_DOMAIN,
        source: "verified_job",
      }),
    );
    expect((await dbA.supplier.findMany()).map((r: { id: string }) => r.id)).toEqual([
      "job-a",
    ]);
    expect((await dbB.supplier.findMany()).map((r: { id: string }) => r.id)).toEqual([
      "job-b",
    ]);
  });

  // F-PR3-16: export/privacy/reconciliation/replay_repair code paths do not
  // yet exist in the repo (deferred to later Phase 1 PRs). Keep a single
  // explicit deferred-surface isolation check for verified_job / scheduler
  // envelope sources only — do not imply nonexistent module coverage.
  it("verified_job and verified_scheduler envelopes isolate TenantDb; pool context clears (export/privacy/reconciliation/replay deferred)", async () => {
    for (const source of ["verified_job", "verified_scheduler"] as const) {
      const authority = issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source,
        correlationId: `${source}-corr`,
      });
      const db = createTenantDb(authority);
      const rows = await db.supplier.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("job-a");

      await withRuntimePg(async (client) => {
        await client.query("BEGIN");
        await client.query(
          `SELECT set_config('stocky.current_shop_id', $1, true)`,
          [shopAId],
        );
        await client.query(
          `SELECT set_config('stocky.tenant_context_version', $1, true)`,
          [TENANT_DB_CONTEXT_VERSION],
        );
        const visible = await client.query(`SELECT id FROM "Supplier"`);
        expect(visible.rows.map((r) => r.id)).toEqual(["job-a"]);
        await client.query("COMMIT");

        const bare = await client.query(`SELECT id FROM "Supplier"`);
        expect(bare.rows).toHaveLength(0);
      });

      await withRuntimePg(async (client) => {
        const bare = await client.query(
          `SELECT id FROM "Supplier" WHERE id = 'job-b'`,
        );
        expect(bare.rows).toHaveLength(0);
      });
    }
    void TenantAccessError;
  });
});
