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
import { readPostgresLockCapacitySettings } from "../../../app/lib/catalog-facts/lock-capacity";
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

const EXISTENCE_FACT_TABLES = [
  "ShopifyProductFact",
  "ShopifyVariantFact",
  "ShopifyInventoryItemFact",
  "ShopifyLocationFact",
  "ShopifyInventoryLevelFact",
] as const;

async function insertFullSyncProduct(
  client: Client,
  shopId: string,
  id: string,
  gid: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyProductFact" (
       id, "shopId", "shopifyGid", title, handle, tags, status,
       "existenceState", "existenceKind", "existenceObservedAt",
       "sourceKind", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, 'title', 'handle', ARRAY[]::text[], 'ACTIVE',
       'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
       'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [id, shopId, gid],
  );
}

async function insertFullSyncVariant(
  client: Client,
  shopId: string,
  id: string,
  gid: string,
  productGid: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyVariantFact" (
       id, "shopId", "shopifyGid", "shopifyProductGid", title,
       "selectedOptions", "priceAmount", "currencyCode",
       "existenceState", "existenceKind", "existenceObservedAt",
       "sourceKind", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, 'variant', '{}'::jsonb, 1.00, 'USD',
       'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
       'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [id, shopId, gid, productGid],
  );
}

async function insertFullSyncInventoryItem(
  client: Client,
  shopId: string,
  id: string,
  gid: string,
  variantGid: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyInventoryItemFact" (
       id, "shopId", "shopifyGid", "shopifyVariantGid", tracked,
       "requiresShipping", "unitCostAccess",
       "existenceState", "existenceKind", "existenceObservedAt",
       "sourceKind", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4, true, true, 'NULL',
       'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
       'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [id, shopId, gid, variantGid],
  );
}

async function insertFullSyncLocation(
  client: Client,
  shopId: string,
  id: string,
  gid: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyLocationFact" (
       id, "shopId", "shopifyGid", name, "isActive",
       "fulfillsOnlineOrders", "shipsInventory", "isFulfillmentService",
       "hasActiveInventory",
       "existenceState", "existenceKind", "existenceObservedAt",
       "sourceKind", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, 'loc', true, true, true, false, true,
       'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
       'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [id, shopId, gid],
  );
}

async function insertFullSyncInventoryLevel(
  client: Client,
  shopId: string,
  id: string,
  itemGid: string,
  locationGid: string,
): Promise<void> {
  await client.query(
    `INSERT INTO "ShopifyInventoryLevelFact" (
       id, "shopId", "inventoryItemGid", "locationGid",
       "existenceState", "existenceKind", "existenceObservedAt",
       "sourceKind", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, $4,
       'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
       'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [id, shopId, itemGid, locationGid],
  );
}

async function expectQueryRejected(
  client: Client,
  sql: string,
  params: unknown[] = [],
  message?: string,
): Promise<void> {
  await client.query("SAVEPOINT expect_reject");
  try {
    await expect(client.query(sql, params), message).rejects.toThrow();
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expect_reject");
  }
}

async function insertObservation(
  client: Client,
  shopId: string,
  id: string,
  lifecycleState: "ACTIVE" | "COMPLETED" | "ABANDONED",
  responseGen: number | null,
): Promise<void> {
  await client.query(
    `INSERT INTO "CatalogObservationInFlight" (
       id, "shopId", "resourceKind", "shopifyGid",
       "observationRequestGen", "observationResponseGen",
       "leaseDurationMs", "leaseExpiresAt",
       "lifecycleState", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, 'Product', $3, 1, $4, 1000, TIMESTAMPTZ '1970-01-01',
       $5, CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [id, shopId, `gid://shopify/Product/${id}`, responseGen, lifecycleState],
  );
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
      ).rejects.toThrow(/catalog_observation_terminal_transition_forbidden/);
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

  it("represents full-sync-only first create and later direct LIVE/ABSENT (F-CLAUDE-PR5F1-01)", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);

      await insertFullSyncProduct(
        runtime,
        shopAId,
        "prod-full-1",
        "gid://shopify/Product/full-1",
      );
      await insertFullSyncVariant(
        runtime,
        shopAId,
        "var-full-1",
        "gid://shopify/ProductVariant/full-1",
        "gid://shopify/Product/full-1",
      );
      await insertFullSyncInventoryItem(
        runtime,
        shopAId,
        "item-full-1",
        "gid://shopify/InventoryItem/full-1",
        "gid://shopify/ProductVariant/full-1",
      );
      await insertFullSyncLocation(
        runtime,
        shopAId,
        "loc-full-1",
        "gid://shopify/Location/full-1",
      );
      await insertFullSyncInventoryLevel(
        runtime,
        shopAId,
        "lvl-full-1",
        "gid://shopify/InventoryItem/full-1",
        "gid://shopify/Location/full-1",
      );

      const nullIntervals = await runtime.query<{ table_name: string }>(
        `SELECT 'ShopifyProductFact' AS table_name FROM "ShopifyProductFact"
           WHERE id = 'prod-full-1' AND "existenceRequestGen" IS NULL AND "existenceResponseGen" IS NULL
         UNION ALL
         SELECT 'ShopifyVariantFact' FROM "ShopifyVariantFact"
           WHERE id = 'var-full-1' AND "existenceRequestGen" IS NULL AND "existenceResponseGen" IS NULL
         UNION ALL
         SELECT 'ShopifyInventoryItemFact' FROM "ShopifyInventoryItemFact"
           WHERE id = 'item-full-1' AND "existenceRequestGen" IS NULL AND "existenceResponseGen" IS NULL
         UNION ALL
         SELECT 'ShopifyLocationFact' FROM "ShopifyLocationFact"
           WHERE id = 'loc-full-1' AND "existenceRequestGen" IS NULL AND "existenceResponseGen" IS NULL
         UNION ALL
         SELECT 'ShopifyInventoryLevelFact' FROM "ShopifyInventoryLevelFact"
           WHERE id = 'lvl-full-1' AND "existenceRequestGen" IS NULL AND "existenceResponseGen" IS NULL`,
      );
      expect(nullIntervals.rowCount).toBe(5);

      await expectQueryRejected(
        runtime,
        `INSERT INTO "ShopifyProductFact" (
             id, "shopId", "shopifyGid", title, handle, tags, status,
             "existenceState", "existenceKind", "existenceObservedAt",
             "existenceRequestGen", "existenceResponseGen",
             "sourceKind", "createdAt", "updatedAt"
           ) VALUES (
             'prod-fake-interval', $1, 'gid://shopify/Product/fake-interval',
             't', 'h', ARRAY[]::text[], 'ACTIVE',
             'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
             50, 50, 'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        [shopAId],
        "LIVE_FULL_SYNC_PRESENT must reject a fabricated [50,50] interval",
      );

      await runtime.query(
        `UPDATE "ShopifyProductFact"
         SET "existenceKind" = 'LIVE_REFETCH',
             "existenceRequestGen" = 10,
             "existenceResponseGen" = 11,
             "sourceKind" = 'INCREMENTAL_REFETCH'
         WHERE id = 'prod-full-1'`,
      );
      const live = await runtime.query<{
        existenceKind: string;
        existenceRequestGen: string;
      }>(
        `SELECT "existenceKind", "existenceRequestGen"::text
         FROM "ShopifyProductFact" WHERE id = 'prod-full-1'`,
      );
      expect(live.rows[0]?.existenceKind).toBe("LIVE_REFETCH");
      expect(live.rows[0]?.existenceRequestGen).toBe("10");

      await runtime.query(
        `UPDATE "ShopifyProductFact"
         SET "existenceState" = 'ABSENT',
             "existenceKind" = 'ABSENT_CONFIRMED_QUERY',
             "existenceRequestGen" = 20,
             "existenceResponseGen" = 21,
             "deletedAt" = CLOCK_TIMESTAMP(),
             "deletionSource" = 'CONFIRMED_QUERY',
             "sourceKind" = 'RECONCILE'
         WHERE id = 'prod-full-1'`,
      );
      const absent = await runtime.query<{ existenceState: string }>(
        `SELECT "existenceState" FROM "ShopifyProductFact" WHERE id = 'prod-full-1'`,
      );
      expect(absent.rows[0]?.existenceState).toBe("ABSENT");

      const nominated = await runtime.query(
        `SELECT id FROM "ShopifyVariantFact"
         WHERE "existenceRequestGen" IS NULL
            OR "existenceRequestGen" <= 50`,
      );
      expect(nominated.rows.map((row) => row.id)).toContain("var-full-1");

      await runtime.query(
        `INSERT INTO "ShopifyProductFact" (
           id, "shopId", "shopifyGid", title, handle, tags, status,
           "existenceState", "existenceKind", "existenceObservedAt",
           "existenceRequestGen", "existenceResponseGen",
           "sourceKind", "createdAt", "updatedAt"
         ) VALUES (
           'prod-post-fence', $1, 'gid://shopify/Product/post-fence',
           't', 'h', ARRAY[]::text[], 'ACTIVE',
           'LIVE', 'LIVE_REFETCH', CLOCK_TIMESTAMP(),
           80, 81, 'INCREMENTAL_REFETCH', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
         )`,
        [shopAId],
      );
      const protectedRows = await runtime.query(
        `SELECT id FROM "ShopifyProductFact"
         WHERE "existenceRequestGen" > 50`,
      );
      expect(protectedRows.rows.map((row) => row.id)).toContain(
        "prod-post-fence",
      );
      const nominatedProducts = await runtime.query(
        `SELECT id FROM "ShopifyProductFact"
         WHERE "existenceRequestGen" IS NULL
            OR "existenceRequestGen" <= 50`,
      );
      expect(nominatedProducts.rows.map((row) => row.id)).not.toContain(
        "prod-post-fence",
      );

      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("enforces existence-evidence coherence on all five fact tables (F-CLAUDE-PR5F1-06)", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertFullSyncProduct(
        runtime,
        shopAId,
        "prod-coh",
        "gid://shopify/Product/coh",
      );
      await insertFullSyncVariant(
        runtime,
        shopAId,
        "var-coh",
        "gid://shopify/ProductVariant/coh",
        "gid://shopify/Product/coh",
      );
      await insertFullSyncInventoryItem(
        runtime,
        shopAId,
        "item-coh",
        "gid://shopify/InventoryItem/coh",
        null,
      );
      await insertFullSyncLocation(
        runtime,
        shopAId,
        "loc-coh",
        "gid://shopify/Location/coh",
      );
      await insertFullSyncInventoryLevel(
        runtime,
        shopAId,
        "lvl-coh",
        "gid://shopify/InventoryItem/coh",
        "gid://shopify/Location/coh",
      );

      const illegalUpdates = [
        `SET "existenceRequestGen" = 1, "existenceResponseGen" = 2`,
        `SET "existenceState" = 'ABSENT'`,
        `SET "existenceKind" = 'LIVE_REFETCH'`,
        `SET "existenceKind" = 'ABSENT_CONFIRMED_QUERY', "existenceState" = 'ABSENT', "existenceRequestGen" = 1, "existenceResponseGen" = 2, "deletedAt" = CLOCK_TIMESTAMP()`,
        `SET "existenceKind" = 'LIVE_REFETCH', "existenceRequestGen" = 5, "existenceResponseGen" = 5`,
        `SET "existenceKind" = 'LIVE_REFETCH', "existenceRequestGen" = 9, "existenceResponseGen" = 1`,
        `SET "existenceKind" = 'LIVE_REFETCH', "existenceRequestGen" = 1, "existenceResponseGen" = 2, "deletedAt" = CLOCK_TIMESTAMP()`,
        `SET "existenceKind" = 'ABSENT_CONFIRMED_QUERY', "existenceState" = 'ABSENT', "existenceRequestGen" = 9, "existenceResponseGen" = 1, "deletedAt" = CLOCK_TIMESTAMP(), "deletionSource" = 'CONFIRMED_QUERY'`,
        `SET "existenceKind" = 'ABSENT_CONFIRMED_QUERY', "existenceState" = 'ABSENT', "existenceRequestGen" = 1, "existenceResponseGen" = 2, "deletionSource" = 'CONFIRMED_QUERY'`,
        `SET "existenceKind" = 'ABSENT_CONFIRMED_QUERY', "existenceState" = 'LIVE', "existenceRequestGen" = 1, "existenceResponseGen" = 2, "deletedAt" = CLOCK_TIMESTAMP(), "deletionSource" = 'CONFIRMED_QUERY'`,
        `SET "deletedAt" = CLOCK_TIMESTAMP()`,
      ];

      for (const table of EXISTENCE_FACT_TABLES) {
        const id =
          table === "ShopifyProductFact"
            ? "prod-coh"
            : table === "ShopifyVariantFact"
              ? "var-coh"
              : table === "ShopifyInventoryItemFact"
                ? "item-coh"
                : table === "ShopifyLocationFact"
                  ? "loc-coh"
                  : "lvl-coh";
        for (const assignment of illegalUpdates) {
          await expectQueryRejected(
            runtime,
            `UPDATE "${table}" ${assignment} WHERE id = $1`,
            [id],
            `${table} ${assignment}`,
          );
        }
      }
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });

  it("forbids every terminal observation lifecycle transition (F-CLAUDE-PR5F1-02)", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertObservation(runtime, shopAId, "obs-term-active", "ACTIVE", null);
      await runtime.query(
        `UPDATE "CatalogObservationInFlight"
         SET "lifecycleState" = 'COMPLETED', "observationResponseGen" = 7
         WHERE id = 'obs-term-active'`,
      );
      const completed = await runtime.query<{ lifecycleState: string }>(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-term-active'`,
      );
      expect(completed.rows[0]?.lifecycleState).toBe("COMPLETED");

      await insertObservation(runtime, shopAId, "obs-term-c", "COMPLETED", 99);
      await insertObservation(runtime, shopAId, "obs-term-a", "ABANDONED", null);

      const forbiddenTransitions = [
        {
          id: "obs-term-c",
          sql: `UPDATE "CatalogObservationInFlight"
           SET "lifecycleState" = 'ACTIVE', "observationResponseGen" = NULL
           WHERE id = 'obs-term-c'`,
        },
        {
          id: "obs-term-c",
          sql: `UPDATE "CatalogObservationInFlight"
           SET "lifecycleState" = 'ABANDONED'
           WHERE id = 'obs-term-c'`,
        },
        {
          id: "obs-term-a",
          sql: `UPDATE "CatalogObservationInFlight"
           SET "lifecycleState" = 'ACTIVE'
           WHERE id = 'obs-term-a'`,
        },
        {
          id: "obs-term-a",
          sql: `UPDATE "CatalogObservationInFlight"
           SET "lifecycleState" = 'COMPLETED', "observationResponseGen" = 2
           WHERE id = 'obs-term-a'`,
        },
      ];
      for (const attempt of forbiddenTransitions) {
        await runtime.query("SAVEPOINT expect_reject");
        try {
          await expect(runtime.query(attempt.sql), attempt.sql).rejects.toThrow(
            /catalog_observation_terminal_transition_forbidden/,
          );
        } finally {
          await runtime.query("ROLLBACK TO SAVEPOINT expect_reject");
        }
      }

      await runtime.query(
        `UPDATE "CatalogObservationInFlight"
         SET "correlationId" = 'safe'
         WHERE id = 'obs-term-c'`,
      );
      const kept = await runtime.query<{ lifecycleState: string }>(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-term-c'`,
      );
      expect(kept.rows[0]?.lifecycleState).toBe("COMPLETED");
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });

  it("restores caller lock_timeout after successful advisory acquisition (F-CLAUDE-PR5F1-03)", async () => {
    const identity = {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: "gid://shopify/Product/lock-restore",
    };
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await runtime.query(`SELECT set_config('lock_timeout', '30s', true)`);
      await acquireCanonicalIdentityAdvisoryLock(asQueryRaw(runtime), identity, {
        timeoutMs: 800,
      });
      const afterThirty = await runtime.query<{ lock_timeout: string }>(
        `SHOW lock_timeout`,
      );
      expect(afterThirty.rows[0]?.lock_timeout).toBe("30s");
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await runtime.query(`SELECT set_config('lock_timeout', '0', true)`);
      await acquireCanonicalIdentityAdvisoryLock(asQueryRaw(runtime), identity, {
        timeoutMs: 800,
      });
      const afterZero = await runtime.query<{ lock_timeout: string }>(
        `SHOW lock_timeout`,
      );
      expect(afterZero.rows[0]?.lock_timeout).toBe("0");
      await runtime.query("COMMIT");
    } finally {
      await runtime.end();
    }
  });

  it("aborts the transaction on advisory timeout and does not leak lock_timeout (F-CLAUDE-PR5F1-03/04)", async () => {
    const identity = {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: "gid://shopify/Product/lock-abort",
    };
    const holder = await getRuntimeClient();
    const waiter = await getRuntimeClient();
    try {
      await holder.query("BEGIN");
      await setTenant(holder, shopAId);
      await acquireCanonicalIdentityAdvisoryLock(asQueryRaw(holder), identity, {
        timeoutMs: 800,
      });

      await waiter.query("BEGIN");
      await setTenant(waiter, shopAId);
      await waiter.query(`SELECT set_config('lock_timeout', '30s', true)`);
      await expect(
        acquireCanonicalIdentityAdvisoryLock(asQueryRaw(waiter), identity, {
          timeoutMs: 800,
        }),
      ).rejects.toBeInstanceOf(CanonicalAdvisoryLockTimeoutError);

      await expect(waiter.query(`SELECT 1`)).rejects.toThrow(
        /current transaction is aborted|25P02/i,
      );
      await waiter.query("ROLLBACK");

      const leaked = await waiter.query<{ lock_timeout: string }>(
        `SHOW lock_timeout`,
      );
      expect(leaked.rows[0]?.lock_timeout).toBe("0");

      await waiter.query("BEGIN");
      await setTenant(waiter, shopAId);
      await holder.query("ROLLBACK");
      const retry = await acquireCanonicalIdentityAdvisoryLock(
        asQueryRaw(waiter),
        identity,
        { timeoutMs: 800 },
      );
      expect(retry.key1).toBe(deriveCanonicalLockKey(identity).key1);
      await waiter.query("COMMIT");
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await waiter.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await waiter.end();
    }
  });

  it("does not bound later row locks to the advisory acquisition timeout (F-CLAUDE-PR5F1-03)", async () => {
    const identity = {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: "gid://shopify/Product/row-lock-bound",
    };
    const applier = await getRuntimeClient();
    const holder = await getRuntimeClient();
    try {
      await applier.query("BEGIN");
      await setTenant(applier, shopAId);
      await insertFullSyncProduct(
        applier,
        shopAId,
        "prod-row-lock",
        identity.shopifyGid,
      );
      await applier.query("COMMIT");

      await holder.query("BEGIN");
      await setTenant(holder, shopAId);
      await holder.query(
        `SELECT id FROM "ShopifyProductFact" WHERE id = 'prod-row-lock' FOR UPDATE`,
      );

      await applier.query("BEGIN");
      await setTenant(applier, shopAId);
      await applier.query(`SELECT set_config('lock_timeout', '30s', true)`);
      await acquireCanonicalIdentityAdvisoryLock(asQueryRaw(applier), identity, {
        timeoutMs: 800,
      });
      const restored = await applier.query<{ lock_timeout: string }>(
        `SHOW lock_timeout`,
      );
      expect(restored.rows[0]?.lock_timeout).toBe("30s");

      const rowLock = applier.query(
        `SELECT id FROM "ShopifyProductFact" WHERE id = 'prod-row-lock' FOR UPDATE`,
      );
      let settled = false;
      void rowLock.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 1200));
      expect(settled).toBe(false);

      await holder.query("ROLLBACK");
      await expect(rowLock).resolves.toMatchObject({ rowCount: 1 });
      await applier.query("ROLLBACK");
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await applier.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await applier.end();
    }
  });

  it("reads PostgreSQL lock capacity settings as safe integers (F-CLAUDE-PR5F1-09)", async () => {
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const settings = await readPostgresLockCapacitySettings({
        query: async (sql) => {
          const result = await migration.query(sql);
          return { rows: result.rows as Array<Record<string, string>> };
        },
      });
      expect(Number.isSafeInteger(settings.maxLocksPerTransaction)).toBe(true);
      expect(Number.isSafeInteger(settings.maxConnections)).toBe(true);
      expect(Number.isSafeInteger(settings.maxPreparedTransactions)).toBe(true);
      expect(settings.maxLocksPerTransaction).toBeGreaterThanOrEqual(1);
      expect(settings.maxConnections).toBeGreaterThanOrEqual(1);
      expect(settings.maxPreparedTransactions).toBeGreaterThanOrEqual(0);
    } finally {
      await migration.end();
    }
  });

  it("denies cross-shop writes on every new fact table and nested relations (F-CLAUDE-PR5F1-10)", async () => {
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await insertFullSyncProduct(
        runtime,
        shopAId,
        "prod-a-x",
        "gid://shopify/Product/a-x",
      );
      await insertFullSyncVariant(
        runtime,
        shopAId,
        "var-a-x",
        "gid://shopify/ProductVariant/a-x",
        "gid://shopify/Product/a-x",
      );
      await insertFullSyncInventoryItem(
        runtime,
        shopAId,
        "item-a-x",
        "gid://shopify/InventoryItem/a-x",
        "gid://shopify/ProductVariant/a-x",
      );
      await insertFullSyncLocation(
        runtime,
        shopAId,
        "loc-a-x",
        "gid://shopify/Location/a-x",
      );
      await insertFullSyncInventoryLevel(
        runtime,
        shopAId,
        "lvl-a-x",
        "gid://shopify/InventoryItem/a-x",
        "gid://shopify/Location/a-x",
      );
      await runtime.query(
        `INSERT INTO "ShopifyProductCollectionMembership" (
           id, "shopId", "shopifyProductGid", "shopifyCollectionGid",
           "collectionTitleSnapshot", "createdAt", "updatedAt"
         ) VALUES (
           'mem-a-x', $1, 'gid://shopify/Product/a-x',
           'gid://shopify/Collection/a-x', 'c', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
         )`,
        [shopAId],
      );
      await insertObservation(runtime, shopAId, "obs-a-x", "ACTIVE", null);
      await runtime.query("COMMIT");

      const tables = [
        "ShopifyProductFact",
        "ShopifyProductCollectionMembership",
        "ShopifyVariantFact",
        "ShopifyInventoryItemFact",
        "ShopifyLocationFact",
        "ShopifyInventoryLevelFact",
        "CatalogObservationInFlight",
      ] as const;

      await runtime.query("BEGIN");
      await setTenant(runtime, shopBId);
      for (const table of tables) {
        const selected = await runtime.query(`SELECT id FROM "${table}"`);
        expect(selected.rowCount, table).toBe(0);
      }
      const crossShopInserts: Array<{ table: string; sql: string }> = [
        {
          table: "ShopifyProductFact",
          sql: `INSERT INTO "ShopifyProductFact" (
             id, "shopId", "shopifyGid", title, handle, tags, status,
             "existenceState", "existenceKind", "existenceObservedAt",
             "sourceKind", "createdAt", "updatedAt"
           ) VALUES (
             'prod-cross', $1, 'gid://shopify/Product/cross',
             't', 'h', ARRAY[]::text[], 'ACTIVE',
             'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
             'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
        {
          table: "ShopifyProductCollectionMembership",
          sql: `INSERT INTO "ShopifyProductCollectionMembership" (
             id, "shopId", "shopifyProductGid", "shopifyCollectionGid",
             "collectionTitleSnapshot", "createdAt", "updatedAt"
           ) VALUES (
             'mem-cross', $1, 'gid://shopify/Product/a-x',
             'gid://shopify/Collection/cross', 'c', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
        {
          table: "ShopifyVariantFact",
          sql: `INSERT INTO "ShopifyVariantFact" (
             id, "shopId", "shopifyGid", "shopifyProductGid", title,
             "selectedOptions", "priceAmount", "currencyCode",
             "existenceState", "existenceKind", "existenceObservedAt",
             "sourceKind", "createdAt", "updatedAt"
           ) VALUES (
             'var-cross', $1, 'gid://shopify/ProductVariant/cross',
             'gid://shopify/Product/a-x', 'v', '{}'::jsonb, 1.00, 'USD',
             'LIVE', 'LIVE_FULL_SYNC_PRESENT', CLOCK_TIMESTAMP(),
             'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
        {
          table: "ShopifyInventoryItemFact",
          sql: `INSERT INTO "ShopifyInventoryItemFact" (
             id, "shopId", "shopifyGid", tracked, "requiresShipping",
             "unitCostAccess", "existenceState", "existenceKind",
             "existenceObservedAt", "sourceKind", "createdAt", "updatedAt"
           ) VALUES (
             'item-cross', $1, 'gid://shopify/InventoryItem/cross',
             true, true, 'NULL', 'LIVE', 'LIVE_FULL_SYNC_PRESENT',
             CLOCK_TIMESTAMP(), 'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
        {
          table: "ShopifyLocationFact",
          sql: `INSERT INTO "ShopifyLocationFact" (
             id, "shopId", "shopifyGid", name, "isActive",
             "fulfillsOnlineOrders", "shipsInventory", "isFulfillmentService",
             "hasActiveInventory", "existenceState", "existenceKind",
             "existenceObservedAt", "sourceKind", "createdAt", "updatedAt"
           ) VALUES (
             'loc-cross', $1, 'gid://shopify/Location/cross', 'loc', true,
             true, true, false, true, 'LIVE', 'LIVE_FULL_SYNC_PRESENT',
             CLOCK_TIMESTAMP(), 'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
        {
          table: "ShopifyInventoryLevelFact",
          sql: `INSERT INTO "ShopifyInventoryLevelFact" (
             id, "shopId", "inventoryItemGid", "locationGid",
             "existenceState", "existenceKind", "existenceObservedAt",
             "sourceKind", "createdAt", "updatedAt"
           ) VALUES (
             'lvl-cross', $1, 'gid://shopify/InventoryItem/a-x',
             'gid://shopify/Location/a-x', 'LIVE', 'LIVE_FULL_SYNC_PRESENT',
             CLOCK_TIMESTAMP(), 'FULL_SYNC', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
        {
          table: "CatalogObservationInFlight",
          sql: `INSERT INTO "CatalogObservationInFlight" (
             id, "shopId", "resourceKind", "shopifyGid",
             "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
             "lifecycleState", "createdAt", "updatedAt"
           ) VALUES (
             'obs-cross-f10', $1, 'Product', 'gid://shopify/Product/cross-obs',
             1, 1000, TIMESTAMPTZ '1970-01-01',
             'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
           )`,
        },
      ];
      for (const attempt of crossShopInserts) {
        await expectQueryRejected(
          runtime,
          attempt.sql,
          [shopAId],
          attempt.table,
        );
      }
      await runtime.query("ROLLBACK");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      for (const table of tables) {
        const updated = await runtime.query(
          `UPDATE "${table}" SET "updatedAt" = CLOCK_TIMESTAMP() WHERE "shopId" = $1`,
          [shopBId],
        );
        expect(updated.rowCount, table).toBe(0);
      }
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });
});
