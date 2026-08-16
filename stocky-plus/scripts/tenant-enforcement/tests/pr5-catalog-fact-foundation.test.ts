/**
 * PR5-F1 canonical fact foundation — disposable PostgreSQL 16 tests.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  acquireCanonicalIdentityAdvisoryLock,
  CanonicalAdvisoryLockTimeoutError,
  type CanonicalLockQueryRaw,
} from "../../../app/lib/catalog-facts/advisory-lock";
import {
  CATALOG_OBSERVATION_GEN_SEQ,
  CATALOG_OBSERVATION_MAX_LEASE_DURATION_MS,
} from "../../../app/lib/catalog-facts/constants";
import { deriveCanonicalLockKey } from "../../../app/lib/catalog-facts/lock-key";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getMigrationClient, getRuntimeClient } from "../connection";
import {
  CATALOG_OBSERVATION_GEN_SEQ as MANIFEST_SEQ,
  ENFORCEMENT_CONTEXT_VERSION,
  MERCHANT_SQL_TABLES,
} from "../manifest";
import { verifyRoles } from "../roles";
import { verifyControlPlaneRole } from "../../sync-control-plane/roles";
import { verifyEnforcement, verifyImmutabilityOnly, verifyRlsOnly } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

const NEW_FACT_TABLES = [
  "ShopifyProductFact",
  "ShopifyProductCollectionMembership",
  "ShopifyVariantFact",
  "ShopifyInventoryItemFact",
  "ShopifyLocationFact",
  "ShopifyInventoryLevelFact",
  "CatalogObservationInFlight",
] as const;

function asQueryRaw(client: Client): CanonicalLockQueryRaw {
  return {
    async $queryRaw(strings, ...values) {
      let text = "";
      const params: unknown[] = [];
      strings.forEach((part, i) => {
        text += part;
        if (i < values.length) {
          params.push(values[i]);
          text += `$${params.length}`;
        }
      });
      const result = await client.query(text, params);
      return result.rows;
    },
  };
}

async function setTenant(client: Client, shopId: string): Promise<void> {
  await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
    shopId,
  ]);
  await client.query(
    `SELECT set_config('stocky.tenant_context_version', $1, true)`,
    [ENFORCEMENT_CONTEXT_VERSION],
  );
}

async function controlPlaneClient(): Promise<Client> {
  const url = process.env.DATABASE_CONTROL_PLANE_URL;
  if (!url) {
    throw new Error("DATABASE_CONTROL_PLANE_URL is required");
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

describe.sequential("PR5-F1 catalog fact foundation", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr5-f1-a.myshopify.com" },
    });
    const shopB = await prisma.shop.create({
      data: { myshopifyDomain: "pr5-f1-b.myshopify.com" },
    });
    shopAId = shopA.id;
    shopBId = shopB.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("registers new merchant tables and identities in schema + manifest", async () => {
    expect(MANIFEST_SEQ).toBe(CATALOG_OBSERVATION_GEN_SEQ);
    for (const table of NEW_FACT_TABLES) {
      expect(MERCHANT_SQL_TABLES).toContain(table);
    }
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const uniques = await client.query<{
        table_name: string;
        indexdef: string;
      }>(
        `SELECT tablename AS table_name, indexdef
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = ANY($1::text[])`,
        [NEW_FACT_TABLES],
      );
      const defs = uniques.rows.map((r) => r.indexdef);
      expect(
        defs.some((d) =>
          d.includes("ShopifyProductFact") &&
          d.includes("shopId") &&
          d.includes("shopifyGid") &&
          d.toUpperCase().includes("UNIQUE"),
        ),
      ).toBe(true);
      expect(
        defs.some((d) =>
          d.includes("ShopifyInventoryLevelFact") &&
          d.includes("inventoryItemGid") &&
          d.includes("locationGid") &&
          d.toUpperCase().includes("UNIQUE"),
        ),
      ).toBe(true);
      expect(
        defs.every(
          (d) =>
            !d.includes("ShopifyInventoryLevelFact") ||
            !d.includes("shopifyInventoryLevelGid") ||
            !d.toUpperCase().includes("UNIQUE"),
        ),
      ).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("enforcement / RLS / immutability / role inventory succeed", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      expect((await verifyRlsOnly(client)).ok).toBe(true);
      expect((await verifyImmutabilityOnly(client)).ok).toBe(true);
      expect((await verifyEnforcement(client)).ok).toBe(true);
      const roles = await verifyRoles(client);
      expect(roles.ok).toBe(true);
      expect((await verifyControlPlaneRole(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("denies cross-shop SELECT/INSERT/UPDATE and shopId mutation on new tables", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await runtime.query(
        `INSERT INTO "CatalogObservationInFlight" (
           id, "shopId", "resourceKind", "shopifyGid",
           "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
           "lifecycleState", "createdAt", "updatedAt"
         ) VALUES (
           'obs-a', $1, 'Product', 'gid://shopify/Product/1',
           1, 1000, TIMESTAMPTZ '1970-01-01',
           'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
         )`,
        [shopAId],
      );
      await runtime.query("COMMIT");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopBId);
      const select = await runtime.query(
        `SELECT id FROM "CatalogObservationInFlight" WHERE id = 'obs-a'`,
      );
      expect(select.rowCount).toBe(0);
      await expect(
        runtime.query(
          `INSERT INTO "CatalogObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-cross', $1, 'Product', 'gid://shopify/Product/2',
             2, 1000, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const updated = await runtime.query(
        `UPDATE "CatalogObservationInFlight"
         SET "correlationId" = 'x'
         WHERE id = 'obs-a' AND "shopId" = $1`,
        [shopBId],
      );
      expect(updated.rowCount).toBe(0);
      await expect(
        runtime.query(
          `UPDATE "CatalogObservationInFlight" SET "shopId" = $1 WHERE id = 'obs-a'`,
          [shopBId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });

  it("stocky_control_plane cannot DML new merchant tables", async () => {
    const cp = await controlPlaneClient();
    try {
      await expect(
        cp.query(`SELECT id FROM "ShopifyProductFact"`),
      ).rejects.toThrow();
      await expect(
        cp.query(
          `INSERT INTO "CatalogObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-cp', $1, 'Product', 'gid://shopify/Product/9',
             9, 1000, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
    } finally {
      await cp.end();
    }
  });

  it("rejects ACTIVE+responseGen and COMPLETED+null; allows multiple ACTIVE rows", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await expect(
        runtime.query(
          `INSERT INTO "CatalogObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "observationResponseGen",
             "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-active-bad', $1, 'Product', 'gid://shopify/Product/10',
             10, 11, 1000, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await expect(
        runtime.query(
          `INSERT INTO "CatalogObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen",
             "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-completed-bad', $1, 'Product', 'gid://shopify/Product/11',
             12, 1000, TIMESTAMPTZ '1970-01-01',
             'COMPLETED', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await runtime.query(
        `INSERT INTO "CatalogObservationInFlight" (
           id, "shopId", "resourceKind", "shopifyGid",
           "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
           "lifecycleState", "createdAt", "updatedAt"
         ) VALUES
           ('obs-multi-1', $1, 'Product', 'gid://shopify/Product/12',
            20, 1000, TIMESTAMPTZ '1970-01-01', 'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()),
           ('obs-multi-2', $1, 'Product', 'gid://shopify/Product/12',
            21, 1000, TIMESTAMPTZ '1970-01-01', 'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP())`,
        [shopAId],
      );
      const rows = await runtime.query(
        `SELECT id FROM "CatalogObservationInFlight"
         WHERE "shopifyGid" = 'gid://shopify/Product/12' AND "lifecycleState" = 'ACTIVE'`,
      );
      expect(rows.rowCount).toBe(2);
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("computes leaseExpiresAt in PostgreSQL and forbids ABANDONED→ACTIVE", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const inserted = await runtime.query<{
        leaseExpiresAt: Date;
        leaseDurationMs: number;
      }>(
        `INSERT INTO "CatalogObservationInFlight" (
           id, "shopId", "resourceKind", "shopifyGid",
           "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
           "lifecycleState", "createdAt", "updatedAt"
         ) VALUES (
           'obs-lease', $1, 'Product', 'gid://shopify/Product/13',
           30, 2000, TIMESTAMPTZ '1970-01-01',
           'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
         )
         RETURNING "leaseExpiresAt", "leaseDurationMs"`,
        [shopAId],
      );
      const lease = inserted.rows[0];
      expect(lease.leaseDurationMs).toBe(2000);
      expect(lease.leaseExpiresAt.getTime()).toBeGreaterThan(Date.now() - 5_000);
      expect(lease.leaseExpiresAt.getTime()).toBeLessThan(Date.now() + 10_000);

      await runtime.query(
        `UPDATE "CatalogObservationInFlight"
         SET "lifecycleState" = 'ABANDONED'
         WHERE id = 'obs-lease'`,
      );
      await expect(
        runtime.query(
          `UPDATE "CatalogObservationInFlight"
           SET "lifecycleState" = 'ACTIVE'
           WHERE id = 'obs-lease'`,
        ),
      ).rejects.toThrow(/catalog_observation_abandoned_reactivation_forbidden/);
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });

  it("serializes first-insert Product advisory lock when no fact row exists", async () => {
    const identity = {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: "gid://shopify/Product/first-insert",
    };
    const holder = await getRuntimeClient();
    const waiter = await getRuntimeClient();
    try {
      await holder.query("BEGIN");
      await setTenant(holder, shopAId);
      const held = await acquireCanonicalIdentityAdvisoryLock(
        asQueryRaw(holder),
        identity,
        { timeoutMs: 800 },
      );
      expect(held.key1).toBe(deriveCanonicalLockKey(identity).key1);

      const facts = await holder.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [identity.shopifyGid],
      );
      expect(facts.rowCount).toBe(0);

      await waiter.query("BEGIN");
      await setTenant(waiter, shopAId);
      const started = Date.now();
      await expect(
        acquireCanonicalIdentityAdvisoryLock(asQueryRaw(waiter), identity, {
          timeoutMs: 800,
        }),
      ).rejects.toBeInstanceOf(CanonicalAdvisoryLockTimeoutError);
      expect(Date.now() - started).toBeLessThan(4_000);
      await waiter.query("ROLLBACK");

      const afterTimeout = await waiter.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [identity.shopifyGid],
      );
      expect(afterTimeout.rowCount).toBe(0);

      await holder.query("ROLLBACK");

      await waiter.query("BEGIN");
      await setTenant(waiter, shopAId);
      const retry = await acquireCanonicalIdentityAdvisoryLock(
        asQueryRaw(waiter),
        identity,
        { timeoutMs: 800 },
      );
      expect(retry.key1).toBe(held.key1);
      expect(retry.key2).toBe(held.key2);
      await waiter.query("COMMIT");
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await waiter.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await waiter.end();
    }
  });

  it("InventoryLevel pair lock key is stable and independent of Shopify level GID", async () => {
    const identity = {
      shopId: shopAId,
      resourceKind: "InventoryLevel" as const,
      inventoryItemGid: "gid://shopify/InventoryItem/pair-1",
      locationGid: "gid://shopify/Location/pair-1",
    };
    const a = deriveCanonicalLockKey(identity);
    const b = deriveCanonicalLockKey({ ...identity });
    expect(a.key1).toBe(b.key1);
    expect(a.key2).toBe(b.key2);
  });

  it("platform sequence is NO CYCLE, allows gaps, and denies setval/reset", async () => {
    const runtime = await getRuntimeClient();
    const cp = await controlPlaneClient();
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const cycle = await migration.query<{ cycle: boolean }>(
        `SELECT cycle FROM pg_sequences
         WHERE schemaname = 'public' AND sequencename = $1`,
        [CATALOG_OBSERVATION_GEN_SEQ],
      );
      expect(cycle.rows[0]?.cycle).toBe(false);

      const g1 = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      const burned = await allocateCatalogObservationGeneration(
        asQueryRaw(runtime),
      );
      const g3 = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      expect(typeof g1).toBe("bigint");
      expect(g3).toBeGreaterThan(g1);
      expect(g3 - g1).toBeGreaterThanOrEqual(2n);
      expect(burned).toBeGreaterThan(g1);

      const cpGen = await allocateCatalogObservationGeneration(asQueryRaw(cp));
      expect(typeof cpGen).toBe("bigint");

      await expect(
        runtime.query(`SELECT setval($1::regclass, 1, false)`, [
          CATALOG_OBSERVATION_GEN_SEQ,
        ]),
      ).rejects.toThrow();
      await expect(
        cp.query(`SELECT setval($1::regclass, 1, false)`, [
          CATALOG_OBSERVATION_GEN_SEQ,
        ]),
      ).rejects.toThrow();
      await expect(
        runtime.query(
          `ALTER SEQUENCE ${CATALOG_OBSERVATION_GEN_SEQ} RESTART WITH 1`,
        ),
      ).rejects.toThrow();
    } finally {
      await runtime.end();
      await cp.end();
      await migration.end();
    }
  });

  it("SyncRun.fenceGeneration stores sequence values beyond MAX_SAFE_INTEGER", async () => {
    const huge = 9007199254740993n;
    const run = await prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "catalog",
        source: "pr5-f1-test",
        correlationId: "pr5-f1-fence",
        fenceGeneration: huge,
        fenceAt: new Date(),
      },
      select: { id: true, fenceGeneration: true },
    });
    expect(typeof run.fenceGeneration).toBe("bigint");
    expect(run.fenceGeneration).toBe(huge);
    expect(run.fenceGeneration! > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("rejects invalid observation lease durations", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await expect(
        runtime.query(
          `INSERT INTO "CatalogObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-lease-bad', $1, 'Product', 'gid://shopify/Product/99',
             99, $2, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
          [shopAId, CATALOG_OBSERVATION_MAX_LEASE_DURATION_MS + 1],
        ),
      ).rejects.toThrow();
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });
});
