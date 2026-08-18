/**
 * PR5-F2B canonical applicator — disposable PostgreSQL races, fencing, RLS.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  applyCanonicalFacts,
  applyCanonicalFactsWithRetry,
  CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS,
  denyCanonicalFactPhysicalDelete,
} from "../../../app/lib/catalog-facts/apply";
import {
  CanonicalApplyBatchExceedsCapacityError,
  CanonicalApplyError,
  CanonicalApplyMissingTokenError,
  CanonicalApplyPhysicalDeleteError,
  CanonicalApplyRequestGenerationMismatchError,
  CanonicalApplyUniqueConflictError,
} from "../../../app/lib/catalog-facts/apply/errors";
import type { CanonicalApplyDb } from "../../../app/lib/catalog-facts/apply/sql";
import { completeObservation } from "../../../app/lib/catalog-facts/apply/fencing";
import { acquireCanonicalIdentityAdvisoryLock } from "../../../app/lib/catalog-facts/advisory-lock";
import { deriveCanonicalLockKey } from "../../../app/lib/catalog-facts/lock-key";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import type {
  CanonicalObservation,
  DirectCanonicalObservation,
  FullSyncCanonicalObservation,
} from "../../../app/lib/catalog-facts/apply/types";

function asQueryRaw(client: Client): CanonicalApplyDb {
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

function forwardQueryRaw(
  inner: CanonicalApplyDb,
): CanonicalApplyDb["$queryRaw"] {
  return inner.$queryRaw.bind(inner);
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

async function insertObservation(
  client: Client,
  args: {
    id: string;
    shopId: string;
    resourceKind: string;
    shopifyGid?: string | null;
    inventoryItemGid?: string | null;
    locationGid?: string | null;
    requestGen: bigint;
    leaseMs: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "CatalogObservationInFlight" (
       id, "shopId", "resourceKind", "shopifyGid", "inventoryItemGid", "locationGid",
       "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
       "lifecycleState", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3::"CatalogResourceKind", $4, $5, $6,
       $7, $8, TIMESTAMPTZ '1970-01-01',
       'ACTIVE', CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [
      args.id,
      args.shopId,
      args.resourceKind,
      args.shopifyGid ?? null,
      args.inventoryItemGid ?? null,
      args.locationGid ?? null,
      args.requestGen.toString(),
      args.leaseMs,
    ],
  );
}

function productLive(
  shopId: string,
  token: string,
  gid: string,
  requestGen: bigint,
  responseGen: bigint,
  attrs: { title: string; handle: string; updatedAt?: Date | null },
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: { shopId, resourceKind: "Product", shopifyGid: gid },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    shopifyCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    shopifyUpdatedAt: attrs.updatedAt === undefined
      ? new Date("2026-08-01T00:00:00.000Z")
      : attrs.updatedAt,
    sourceKind: "INCREMENTAL_REFETCH",
    attributes: {
      title: attrs.title,
      handle: attrs.handle,
      status: "ACTIVE",
      tags: [],
    },
  };
}

function productAbsent(
  shopId: string,
  token: string,
  gid: string,
  requestGen: bigint,
  responseGen: bigint,
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: { shopId, resourceKind: "Product", shopifyGid: gid },
    existenceKind: "ABSENT_CONFIRMED_QUERY",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
  };
}

function variantLive(
  shopId: string,
  token: string,
  gid: string,
  productGid: string,
  requestGen: bigint,
  responseGen: bigint,
  attrs: { title?: string; updatedAt?: Date | null } = {},
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: { shopId, resourceKind: "ProductVariant", shopifyGid: gid },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    shopifyUpdatedAt:
      attrs.updatedAt === undefined ? new Date("2026-08-01T00:00:00.000Z") : attrs.updatedAt,
    sourceKind: "INCREMENTAL_REFETCH",
    attributes: {
      shopifyProductGid: productGid,
      title: attrs.title ?? "V",
      selectedOptions: {},
      priceAmount: "10.000000",
      currencyCode: "USD",
    },
  };
}

function itemLive(
  shopId: string,
  token: string,
  gid: string,
  variantGid: string,
  requestGen: bigint,
  responseGen: bigint,
  attrs: { updatedAt?: Date | null } = {},
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: { shopId, resourceKind: "InventoryItem", shopifyGid: gid },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    shopifyUpdatedAt:
      attrs.updatedAt === undefined ? new Date("2026-08-01T00:00:00.000Z") : attrs.updatedAt,
    sourceKind: "INCREMENTAL_REFETCH",
    attributes: {
      shopifyVariantGid: variantGid,
      tracked: true,
      requiresShipping: true,
      unitCostAccess: "NULL",
    },
  };
}

function resourceAbsent(
  shopId: string,
  token: string,
  identity: DirectCanonicalObservation["identity"],
  requestGen: bigint,
  responseGen: bigint,
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity,
    existenceKind: "ABSENT_CONFIRMED_QUERY",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
  };
}

describe("PR5-F2B canonical applicator PostgreSQL races", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr5-f2b-a.myshopify.com" },
    });
    const shopB = await prisma.shop.create({
      data: { myshopifyDomain: "pr5-f2b-b.myshopify.com" },
    });
    shopAId = shopA.id;
    shopBId = shopB.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function withTenant<T>(
    fn: (client: Client, db: CanonicalApplyDb) => Promise<T>,
    shopId = shopAId,
  ): Promise<T> {
    const client = await getRuntimeClient();
    try {
      await client.query("BEGIN");
      await setTenant(client, shopId);
      const result = await fn(client, asQueryRaw(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  }

  it("first-inserts a Product under the advisory identity lock", async () => {
    const gid = "gid://shopify/Product/first-insert";
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const req = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      await insertObservation(runtime, {
        id: "obs-first",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      await runtime.query("COMMIT");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const resp = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      const db = asQueryRaw(runtime);
      const identity = {
        shopId: shopAId,
        resourceKind: "Product" as const,
        shopifyGid: gid,
      };
      const key = deriveCanonicalLockKey(identity);
      const result = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productLive(shopAId, "obs-first", gid, req, resp, {
          title: "First",
          handle: "first",
        })],
      });
      const locks = await runtime.query(
        `SELECT 1 FROM pg_locks
         WHERE locktype = 'advisory' AND classid = $1 AND objid = $2
           AND pid = pg_backend_pid()`,
        [key.key1, key.key2],
      );
      expect(locks.rowCount).toBeGreaterThan(0);
      expect(result.results[0]?.outcome).toBe("applied");
      expect(result.results[0]?.existenceMutated).toBe(true);
      await runtime.query("COMMIT");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const rows = await runtime.query(
        `SELECT title, "existenceState", "existenceKind" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].title).toBe("First");
      expect(rows.rows[0].existenceState).toBe("LIVE");
      expect(rows.rows[0].existenceKind).toBe("LIVE_REFETCH");
      await runtime.query("COMMIT");
    } finally {
      await runtime.query("ROLLBACK").catch(() => undefined);
      await runtime.end();
    }
  });

  it("overlapping agreeing observations converge without degrading evidence", async () => {
    const gid = "gid://shopify/Product/ov-agree";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      const reqB = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-agree-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-agree-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respA = await allocateCatalogObservationGeneration(db);
      const first = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-agree-a", gid, reqA, respA, {
            title: "Agree",
            handle: "agree",
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      const respB = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-agree-b", gid, reqB, respB, {
            title: "Agree",
            handle: "agree",
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      expect(first.results[0]?.outcome).toBe("applied");
      expect(second.results[0]?.existenceMutated).toBe(false);
      const row = await client.query(
        `SELECT title, "attributeFreshnessState", "existenceDiagnosticState"
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].title).toBe("Agree");
      expect(row.rows[0].attributeFreshnessState).toBe("ORDERED");
      expect(row.rows[0].existenceDiagnosticState).toBeNull();
    });
  });

  it("overlapping conflicting observations preserve last unambiguous truth and set DEGRADED", async () => {
    const gid = "gid://shopify/Product/ov-conflict";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      const reqB = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-conf-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-conf-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respA = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-conf-a", gid, reqA, respA, {
            title: "From A",
            handle: "from-a",
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      const respB = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-conf-b", gid, reqB, respB, {
            title: "From B",
            handle: "from-b",
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(false);
      const row = await client.query(
        `SELECT title, handle, "attributeFreshnessState", "existenceDiagnosticState"
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].title).toBe("From A");
      expect(row.rows[0].handle).toBe("from-a");
      expect(row.rows[0].attributeFreshnessState).toBe("DEGRADED");
      expect(String(row.rows[0].existenceDiagnosticState)).toContain("EQUAL_VERSION_CONFLICT");
    });
  });

  it("overlapping LIVE vs ABSENT preserves last unambiguous existence", async () => {
    const gid = "gid://shopify/Product/ov-exist";
    await withTenant(async (client, db) => {
      const reqLive = await allocateCatalogObservationGeneration(db);
      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ex-live",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqLive,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-ex-abs",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqAbs,
        leaseMs: 60_000,
      });
      const respLive = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-ex-live", gid, reqLive, respLive, {
            title: "Live",
            handle: "live",
          }),
        ],
      });
      const respAbs = await allocateCatalogObservationGeneration(db);
      const absent: DirectCanonicalObservation = {
        ...productLive(shopAId, "obs-ex-abs", gid, reqAbs, respAbs, {
          title: "Gone",
          handle: "gone",
        }),
        existenceKind: "ABSENT_CONFIRMED_QUERY",
      };
      await applyCanonicalFacts(db, { shopId: shopAId, observations: [absent] });
      const row = await client.query(
        `SELECT "existenceState", "existenceDiagnosticState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(String(row.rows[0].existenceDiagnosticState)).toContain(
        "CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT",
      );
    });
  });

  it("serializes concurrent first insert of a nonexistent identity", async () => {
    const gid = "gid://shopify/Product/concurrent-first";
    const a = await getRuntimeClient();
    const b = await getRuntimeClient();
    try {
      await a.query("BEGIN");
      await setTenant(a, shopAId);
      const reqA = await allocateCatalogObservationGeneration(asQueryRaw(a));
      const reqB = await allocateCatalogObservationGeneration(asQueryRaw(a));
      await insertObservation(a, {
        id: "obs-c1",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(a, {
        id: "obs-c2",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      await a.query("COMMIT");

      const respA = await withTenant(async (client, db) =>
        allocateCatalogObservationGeneration(db),
      );
      const respB = await withTenant(async (client, db) =>
        allocateCatalogObservationGeneration(db),
      );

      const runA = (async () => {
        await a.query("BEGIN");
        await setTenant(a, shopAId);
        const result = await applyCanonicalFacts(asQueryRaw(a), {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-c1", gid, reqA, respA, {
              title: "A",
              handle: "a",
            }),
          ],
        });
        await a.query("COMMIT");
        return result;
      })();
      const runB = (async () => {
        await b.query("BEGIN");
        await setTenant(b, shopAId);
        const result = await applyCanonicalFacts(asQueryRaw(b), {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-c2", gid, reqB, respB, {
              title: "B",
              handle: "b",
            }),
          ],
        });
        await b.query("COMMIT");
        return result;
      })();
      await Promise.all([runA, runB]);

      await a.query("BEGIN");
      await setTenant(a, shopAId);
      const rows = await a.query(
        `SELECT title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(1);
      await a.query("COMMIT");
    } finally {
      await a.query("ROLLBACK").catch(() => undefined);
      await b.query("ROLLBACK").catch(() => undefined);
      await a.end();
      await b.end();
    }
  });

  it("keeps newer direct attributes and still advances full-sync presence (Race A/K)", async () => {
    const gid = "gid://shopify/Product/stale-bulk";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-newer",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-newer", gid, req, resp, {
            title: "New",
            handle: "new",
            updatedAt: new Date("2026-08-10T00:00:00.000Z"),
          }),
        ],
      });
    });

    await withTenant(async (client, db) => {
      const bulk: FullSyncCanonicalObservation = {
        observationKind: "full_sync",
        fenceGeneration: 1n,
        epochId: "epoch-k",
        identity: { shopId: shopAId, resourceKind: "Product", shopifyGid: gid },
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
        shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
        sourceKind: "FULL_SYNC",
        attributes: { title: "Old", handle: "old", status: "ACTIVE", tags: [] },
      };
      await applyCanonicalFacts(db, { shopId: shopAId, observations: [bulk] });
    });

    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT title, "lastSeenFullSyncRunId", "shopifyUpdatedAt"
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rows[0].title).toBe("New");
      expect(rows.rows[0].lastSeenFullSyncRunId).toBe("epoch-k");
    });
  });

  it("fails closed on a missing observation token", async () => {
    await expect(
      withTenant(async (client, db) =>
        applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "", "gid://shopify/Product/missing", 1n, 2n, {
              title: "x",
              handle: "x",
            }),
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(CanonicalApplyMissingTokenError);
  });

  it("does not apply after lease expiry and durably abandons for a successor", async () => {
    const gid = "gid://shopify/Product/expiry";
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const reqA = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      await insertObservation(runtime, {
        id: "obs-exp-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 1,
      });
      await runtime.query("COMMIT");
      await runtime.query("SELECT pg_sleep(0.05)");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const respA = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      const expired = await applyCanonicalFacts(asQueryRaw(runtime), {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-exp-a", gid, reqA, respA, {
            title: "Late",
            handle: "late",
          }),
        ],
      });
      expect(expired.results[0]?.outcome).toBe("lease_invalid");
      expect(expired.results[0]?.existenceMutated).toBe(false);
      await runtime.query("COMMIT");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const state = await runtime.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-exp-a'`,
      );
      expect(state.rows[0].lifecycleState).toBe("ABANDONED");
      const reqB = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      await insertObservation(runtime, {
        id: "obs-exp-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respB = await allocateCatalogObservationGeneration(asQueryRaw(runtime));
      const applied = await applyCanonicalFacts(asQueryRaw(runtime), {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-exp-b", gid, reqB, respB, {
            title: "Fresh",
            handle: "fresh",
          }),
        ],
      });
      expect(applied.abandonedBlockerTokens.includes("obs-exp-a") || applied.results[0]?.outcome === "applied").toBe(true);
      await runtime.query("COMMIT");
    } finally {
      await runtime.query("ROLLBACK").catch(() => undefined);
      await runtime.end();
    }
  });

  it("keeps an ABANDONED token invalid even if the lease would later look valid (Race AS)", async () => {
    const gid = "gid://shopify/Product/abandoned-rollback";
    const durableReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-as",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 1,
      });
      return req;
    });
    await withTenant(async (client) => {
      await client.query("SELECT pg_sleep(0.05)");
      await client.query(
        `UPDATE "CatalogObservationInFlight"
         SET "lifecycleState" = 'ABANDONED'
         WHERE id = 'obs-as'`,
      );
    });
    await expect(
      withTenant(async (client, db) => {
        const resp = await allocateCatalogObservationGeneration(db);
        return applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-as", gid, durableReq, resp, {
              title: "nope",
              handle: "nope",
            }),
          ],
        });
      }),
    ).rejects.toThrow();
    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("multiple unexpired blockers keep existence mutation blocked (Race AQ)", async () => {
    const gid = "gid://shopify/Product/multi-block";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      const reqB = await allocateCatalogObservationGeneration(db);
      const reqC = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-aq-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-aq-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-aq-c",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqC,
        leaseMs: 60_000,
      });
      const respC = await allocateCatalogObservationGeneration(db);
      const result = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-aq-c", gid, reqC, respC, {
            title: "C",
            handle: "c",
          }),
        ],
      });
      expect(result.results[0]?.existenceMutated).toBe(false);
      expect(result.results[0]?.outcome).toBe("blocked");
      const facts = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(facts.rowCount).toBe(0);
    });
  });

  it("terminal revival requires two non-overlapping LIVE confirmations", async () => {
    const gid = "gid://shopify/Product/revival";
    await withTenant(async (client, db) => {
      const reqLive = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-live",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqLive,
        leaseMs: 60_000,
      });
      const respLive = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rev-live", gid, reqLive, respLive, {
            title: "Original",
            handle: "original",
          }),
        ],
      });
      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-abs",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqAbs,
        leaseMs: 60_000,
      });
      const respAbs = await allocateCatalogObservationGeneration(db);
      const absent: DirectCanonicalObservation = {
        ...productLive(shopAId, "obs-rev-abs", gid, reqAbs, respAbs, {
          title: "Gone",
          handle: "gone",
        }),
        existenceKind: "ABSENT_CONFIRMED_QUERY",
      };
      await applyCanonicalFacts(db, { shopId: shopAId, observations: [absent] });
      const tombstoned = await client.query(
        `SELECT "existenceState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(tombstoned.rows[0].existenceState).toBe("ABSENT");
    });

    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const reqOverlap = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-1",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req1,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-rev-overlap",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqOverlap,
        leaseMs: 60_000,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      expect(reqOverlap < resp1).toBe(true);
      const first = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rev-1", gid, req1, resp1, {
            title: "Back",
            handle: "back",
          }),
        ],
      });
      expect(first.results[0]?.existenceMutated).toBe(false);
      const row = await client.query(
        `SELECT "existenceState", "existenceDiagnosticState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(String(row.rows[0].existenceDiagnosticState)).toContain(
        "TERMINAL_IDENTITY_REVIVAL_CONFLICT",
      );

      const respOverlap = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rev-overlap", gid, reqOverlap, respOverlap, {
            title: "Overlap",
            handle: "overlap",
          }),
        ],
      });
      const still = await client.query(
        `SELECT "existenceState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(still.rows[0].existenceState).toBe("ABSENT");
    });

    await withTenant(async (client, db) => {
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rev-2",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rev-2", gid, req2, resp2, {
            title: "Restored",
            handle: "restored",
          }),
        ],
      });
      const row = await client.query(
        `SELECT "existenceState", title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(second.results[0]?.existenceMutated).toBe(true);
    });
  });

  it("reconnects an InventoryLevel pair without terminal revival", async () => {
    const productGid = "gid://shopify/Product/lvl-p";
    const variantGid = "gid://shopify/ProductVariant/lvl-v";
    const itemGid = "gid://shopify/InventoryItem/lvl-i";
    const locGid = "gid://shopify/Location/lvl-l";
    await withTenant(async (client, db) => {
      for (const [token, kind, gid] of [
        ["obs-lvl-p", "Product", productGid],
        ["obs-lvl-v", "ProductVariant", variantGid],
        ["obs-lvl-i", "InventoryItem", itemGid],
        ["obs-lvl-l", "Location", locGid],
      ] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: kind,
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        const observation: CanonicalObservation =
          kind === "Product"
            ? productLive(shopAId, token, gid, req, resp, { title: "P", handle: "p" })
            : kind === "ProductVariant"
              ? {
                  observationKind: "direct",
                  observationToken: token,
                  observationRequestGen: req,
                  observationResponseGen: resp,
                  identity: { shopId: shopAId, resourceKind: "ProductVariant", shopifyGid: gid },
                  existenceKind: "LIVE_REFETCH",
                  existenceObservedAt: new Date(),
                  sourceKind: "INCREMENTAL_REFETCH",
                  attributes: {
                    shopifyProductGid: productGid,
                    title: "V",
                    selectedOptions: {},
                    priceAmount: "10.000000",
                    currencyCode: "USD",
                  },
                }
              : kind === "InventoryItem"
                ? {
                    observationKind: "direct",
                    observationToken: token,
                    observationRequestGen: req,
                    observationResponseGen: resp,
                    identity: { shopId: shopAId, resourceKind: "InventoryItem", shopifyGid: gid },
                    existenceKind: "LIVE_REFETCH",
                    existenceObservedAt: new Date(),
                    sourceKind: "INCREMENTAL_REFETCH",
                    attributes: {
                      shopifyVariantGid: variantGid,
                      tracked: true,
                      requiresShipping: true,
                      unitCostAccess: "NULL",
                    },
                  }
                : {
                    observationKind: "direct",
                    observationToken: token,
                    observationRequestGen: req,
                    observationResponseGen: resp,
                    identity: { shopId: shopAId, resourceKind: "Location", shopifyGid: gid },
                    existenceKind: "LIVE_REFETCH",
                    existenceObservedAt: new Date(),
                    sourceKind: "INCREMENTAL_REFETCH",
                    attributes: {
                      name: "L",
                      isActive: true,
                      fulfillsOnlineOrders: true,
                      shipsInventory: true,
                      isFulfillmentService: false,
                      hasActiveInventory: true,
                    },
                  };
        await applyCanonicalFacts(db, { shopId: shopAId, observations: [observation] });
      }

      const reqLive0 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-lvl-live-0",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: reqLive0,
        leaseMs: 60_000,
      });
      const respLive0 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-lvl-live-0",
            observationRequestGen: reqLive0,
            observationResponseGen: respLive0,
            identity: {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date(),
            sourceKind: "INCREMENTAL_REFETCH",
            attributes: {
              isActive: true,
              quantities: [
                { name: "available", quantity: 3, shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z") },
              ],
            },
          },
        ],
      });
      const seeded = await client.query(
        `SELECT "existenceState" FROM "ShopifyInventoryLevelFact"
         WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
        [itemGid, locGid],
      );
      expect(seeded.rows[0].existenceState).toBe("LIVE");

      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-lvl-abs",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: reqAbs,
        leaseMs: 60_000,
      });
      const respAbs = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-lvl-abs",
            observationRequestGen: reqAbs,
            observationResponseGen: respAbs,
            identity: {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            existenceKind: "ABSENT_CONFIRMED_QUERY",
            existenceObservedAt: new Date(),
            sourceKind: "DISCONNECT_WEBHOOK",
            attributes: { isActive: false, quantities: [] },
          },
        ],
      });
      const absent = await client.query(
        `SELECT "existenceState" FROM "ShopifyInventoryLevelFact"
         WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
        [itemGid, locGid],
      );
      expect(absent.rows[0].existenceState).toBe("ABSENT");

      const reqLive = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-lvl-live",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: reqLive,
        leaseMs: 60_000,
      });
      const respLive = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-lvl-live",
            observationRequestGen: reqLive,
            observationResponseGen: respLive,
            identity: {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date(),
            sourceKind: "INCREMENTAL_REFETCH",
            attributes: {
              isActive: true,
              quantities: [
                { name: "available", quantity: 5, shopifyUpdatedAt: new Date("2026-08-02T00:00:00.000Z") },
                { name: "committed", quantity: 1, shopifyUpdatedAt: new Date("2026-08-03T00:00:00.000Z") },
              ],
            },
          },
        ],
      });
      const live = await client.query(
        `SELECT "existenceState", "availableQuantity", "committedQuantity"
         FROM "ShopifyInventoryLevelFact"
         WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
        [itemGid, locGid],
      );
      expect(live.rowCount).toBe(1);
      expect(live.rows[0].existenceState).toBe("LIVE");
      expect(live.rows[0].availableQuantity).toBe(5);
      expect(live.rows[0].committedQuantity).toBe(1);
    });
  });

  it("applies quantity names independently so a stale reconcile cannot rewind a newer name", async () => {
    const productGid = "gid://shopify/Product/qty-p";
    const variantGid = "gid://shopify/ProductVariant/qty-v";
    const itemGid = "gid://shopify/InventoryItem/qty-i";
    const locGid = "gid://shopify/Location/qty-l";
    await withTenant(async (client, db) => {
      const seed = async (
        token: string,
        kind: "Product" | "ProductVariant" | "InventoryItem" | "Location",
        gid: string,
        observation: CanonicalObservation,
      ) => {
        const req = observation.observationKind === "direct" ? observation.observationRequestGen : 0n;
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: kind,
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        await applyCanonicalFacts(db, { shopId: shopAId, observations: [observation] });
      };
      const reqP = await allocateCatalogObservationGeneration(db);
      const respP = await allocateCatalogObservationGeneration(db);
      await seed("obs-qty-p", "Product", productGid, productLive(shopAId, "obs-qty-p", productGid, reqP, respP, { title: "Q", handle: "q" }));
      const reqV = await allocateCatalogObservationGeneration(db);
      const respV = await allocateCatalogObservationGeneration(db);
      await seed("obs-qty-v", "ProductVariant", variantGid, {
        observationKind: "direct",
        observationToken: "obs-qty-v",
        observationRequestGen: reqV,
        observationResponseGen: respV,
        identity: { shopId: shopAId, resourceKind: "ProductVariant", shopifyGid: variantGid },
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: new Date(),
        sourceKind: "INCREMENTAL_REFETCH",
        attributes: {
          shopifyProductGid: productGid,
          title: "V",
          selectedOptions: {},
          priceAmount: "19.990000",
          currencyCode: "USD",
        },
      });
      const reqI = await allocateCatalogObservationGeneration(db);
      const respI = await allocateCatalogObservationGeneration(db);
      await seed("obs-qty-i", "InventoryItem", itemGid, {
        observationKind: "direct",
        observationToken: "obs-qty-i",
        observationRequestGen: reqI,
        observationResponseGen: respI,
        identity: { shopId: shopAId, resourceKind: "InventoryItem", shopifyGid: itemGid },
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: new Date(),
        sourceKind: "INCREMENTAL_REFETCH",
        attributes: {
          shopifyVariantGid: variantGid,
          tracked: true,
          requiresShipping: true,
          unitCostAmount: "3.250000",
          unitCostAccess: "PRESENT",
          unitCostCurrencyCode: "USD",
        },
      });
      const reqL = await allocateCatalogObservationGeneration(db);
      const respL = await allocateCatalogObservationGeneration(db);
      await seed("obs-qty-l", "Location", locGid, {
        observationKind: "direct",
        observationToken: "obs-qty-l",
        observationRequestGen: reqL,
        observationResponseGen: respL,
        identity: { shopId: shopAId, resourceKind: "Location", shopifyGid: locGid },
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: new Date(),
        sourceKind: "INCREMENTAL_REFETCH",
        attributes: {
          name: "WH",
          isActive: true,
          fulfillsOnlineOrders: true,
          shipsInventory: true,
          isFulfillmentService: false,
          hasActiveInventory: true,
        },
      });

      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-qty-1",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: req1,
        leaseMs: 60_000,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-qty-1",
            observationRequestGen: req1,
            observationResponseGen: resp1,
            identity: {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date(),
            sourceKind: "RECONCILE",
            attributes: {
              quantities: [
                { name: "available", quantity: 9, shopifyUpdatedAt: new Date("2026-08-01T00:00:00.000Z") },
                { name: "committed", quantity: 4, shopifyUpdatedAt: new Date("2026-08-05T00:00:00.000Z") },
              ],
            },
          },
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-qty-2",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-qty-2",
            observationRequestGen: req2,
            observationResponseGen: resp2,
            identity: {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date(),
            sourceKind: "RECONCILE",
            attributes: {
              quantities: [
                { name: "available", quantity: 11, shopifyUpdatedAt: new Date("2026-08-04T00:00:00.000Z") },
                { name: "committed", quantity: 1, shopifyUpdatedAt: new Date("2026-08-02T00:00:00.000Z") },
              ],
            },
          },
        ],
      });
      const row = await client.query(
        `SELECT "availableQuantity", "committedQuantity", "priceAmount", "unitCostAmount"
         FROM "ShopifyInventoryLevelFact" lvl
         JOIN "ShopifyInventoryItemFact" item ON item."shopifyGid" = lvl."inventoryItemGid"
         JOIN "ShopifyVariantFact" v ON v."shopifyGid" = item."shopifyVariantGid"
         WHERE lvl."inventoryItemGid" = $1`,
        [itemGid],
      );
      expect(row.rows[0].availableQuantity).toBe(11);
      expect(row.rows[0].committedQuantity).toBe(4);
      expect(String(row.rows[0].priceAmount)).toMatch(/^19\.99/);
      expect(String(row.rows[0].unitCostAmount)).toMatch(/^3\.25/);
    });
  });

  it("applies a later non-overlapping null updatedAt observation (Race L)", async () => {
    const gid = "gid://shopify/Product/null-version";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-null-1",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req1,
        leaseMs: 60_000,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-null-1", gid, req1, resp1, {
            title: "One",
            handle: "one",
            updatedAt: null,
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-null-2",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-null-2", gid, req2, resp2, {
            title: "Two",
            handle: "two",
            updatedAt: null,
          }),
        ],
      });
      const row = await client.query(
        `SELECT title, "attributeFreshnessState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rows[0].title).toBe("Two");
      expect(row.rows[0].attributeFreshnessState).toBe("DEGRADED");
    });
  });

  it("fails closed when a batch exceeds the effective lock-capacity cap (Race AW)", async () => {
    const observations: CanonicalObservation[] = [];
    await withTenant(async (client, db) => {
      for (let i = 0; i < 40; i += 1) {
        const gid = `gid://shopify/Product/cap-${i}`;
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: `obs-cap-${i}`,
          shopId: shopAId,
          resourceKind: "Product",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        observations.push(
          productLive(shopAId, `obs-cap-${i}`, gid, req, resp, {
            title: `C${i}`,
            handle: `c${i}`,
          }),
        );
      }
    });
    await expect(
      withTenant(async (client, db) =>
        applyCanonicalFacts(db, { shopId: shopAId, observations }),
      ),
    ).rejects.toBeInstanceOf(CanonicalApplyBatchExceedsCapacityError);
    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyProductFact" WHERE "shopifyGid" LIKE 'gid://shopify/Product/cap-%'`,
      );
      expect(rows.rows[0].n).toBe(0);
    });
  });

  it("rolls back canonical writes when the tenant transaction aborts", async () => {
    const gid = "gid://shopify/Product/rollback";
    const client = await getRuntimeClient();
    try {
      await client.query("BEGIN");
      await setTenant(client, shopAId);
      const db = asQueryRaw(client);
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rb",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rb", gid, req, resp, { title: "RB", handle: "rb" }),
        ],
      });
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
    await withTenant(async (c) => {
      const rows = await c.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("denies cross-shop apply and physical delete on the ordinary apply surface", async () => {
    expect(CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS).toEqual([]);
    expect(() => denyCanonicalFactPhysicalDelete()).toThrow(
      CanonicalApplyPhysicalDeleteError,
    );
    await expect(
      withTenant(async (client, db) => {
        const req = await allocateCatalogObservationGeneration(db);
        return applyCanonicalFacts(db, {
          shopId: shopBId,
          observations: [
            productLive(shopBId, "obs-cross", "gid://shopify/Product/x", req, req + 1n, {
              title: "x",
              handle: "x",
            }),
          ],
        });
      }, shopAId),
    ).rejects.toThrow(/tenant/);
  });

  it("acquires multi-identity advisory locks in deterministic ascending order without deadlock", async () => {
    const gidX = "gid://shopify/Product/lock-x";
    const gidY = "gid://shopify/Product/lock-y";
    const a = await getRuntimeClient();
    const b = await getRuntimeClient();
    try {
      await a.query("BEGIN");
      await setTenant(a, shopAId);
      const reqX = await allocateCatalogObservationGeneration(asQueryRaw(a));
      const reqY = await allocateCatalogObservationGeneration(asQueryRaw(a));
      await insertObservation(a, {
        id: "obs-x",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gidX,
        requestGen: reqX,
        leaseMs: 60_000,
      });
      await insertObservation(a, {
        id: "obs-y",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gidY,
        requestGen: reqY,
        leaseMs: 60_000,
      });
      await a.query("COMMIT");
      const respX = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
      const respY = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
      const obsX = productLive(shopAId, "obs-x", gidX, reqX, respX, { title: "X", handle: "x" });
      const obsY = productLive(shopAId, "obs-y", gidY, reqY, respY, { title: "Y", handle: "y" });
      const left = (async () => {
        await a.query("BEGIN");
        await setTenant(a, shopAId);
        const result = await applyCanonicalFacts(asQueryRaw(a), {
          shopId: shopAId,
          observations: [obsX, obsY],
        });
        await a.query("COMMIT");
        return result;
      })();
      const right = (async () => {
        await b.query("BEGIN");
        await setTenant(b, shopAId);
        const result = await applyCanonicalFacts(asQueryRaw(b), {
          shopId: shopAId,
          observations: [obsY, obsX],
        });
        await b.query("COMMIT");
        return result;
      })();
      await Promise.all([left, right]);
      await a.query("BEGIN");
      await setTenant(a, shopAId);
      const rows = await a.query(
        `SELECT "shopifyGid" FROM "ShopifyProductFact"
         WHERE "shopifyGid" IN ($1, $2) ORDER BY "shopifyGid"`,
        [gidX, gidY],
      );
      expect(rows.rowCount).toBe(2);
      await a.query("COMMIT");
    } finally {
      await a.query("ROLLBACK").catch(() => undefined);
      await b.query("ROLLBACK").catch(() => undefined);
      await a.end();
      await b.end();
    }
  });

  it("waiter apply uses the same advisory identity lock as a holder", async () => {
    const gid = "gid://shopify/Product/lock-wait";
    const holder = await getRuntimeClient();
    const waiter = await getRuntimeClient();
    try {
      await holder.query("BEGIN");
      await setTenant(holder, shopAId);
      await acquireCanonicalIdentityAdvisoryLock(asQueryRaw(holder), {
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
      });
      await waiter.query("BEGIN");
      await setTenant(waiter, shopAId);
      const req = await allocateCatalogObservationGeneration(asQueryRaw(waiter));
      await insertObservation(waiter, {
        id: "obs-wait",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(asQueryRaw(waiter));
      const started = Date.now();
      await expect(
        applyCanonicalFacts(asQueryRaw(waiter), {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-wait", gid, req, resp, { title: "W", handle: "w" }),
          ],
        }),
      ).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(15_000);
      await waiter.query("ROLLBACK");
      await holder.query("ROLLBACK");
    } finally {
      await holder.query("ROLLBACK").catch(() => undefined);
      await waiter.query("ROLLBACK").catch(() => undefined);
      await holder.end();
      await waiter.end();
    }
  });

  it("denies a valid ACTIVE token when the caller requestGen does not match the durable row", async () => {
    const gid = "gid://shopify/Product/req-mismatch";
    const durableReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-req-mismatch",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    const wrongReq = durableReq + 1n;
    const resp = await withTenant(async (_c, db) => {
      let generated = await allocateCatalogObservationGeneration(db);
      while (generated <= wrongReq) {
        generated = await allocateCatalogObservationGeneration(db);
      }
      return generated;
    });
    await expect(
      withTenant(async (_c, db) =>
        applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-req-mismatch", gid, wrongReq, resp, {
              title: "Mismatch",
              handle: "mismatch",
            }),
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(CanonicalApplyRequestGenerationMismatchError);
    await withTenant(async (client) => {
      const fact = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fact.rowCount).toBe(0);
      const obs = await client.query(
        `SELECT "lifecycleState", "observationRequestGen", "observationResponseGen"
         FROM "CatalogObservationInFlight" WHERE id = 'obs-req-mismatch'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("ACTIVE");
      expect(obs.rows[0].observationRequestGen).toBe(String(durableReq));
      expect(obs.rows[0].observationResponseGen).toBeNull();
    });
  });

  it("does not let a fabricated earlier requestGen rewrite overlap ordering", async () => {
    const gid = "gid://shopify/Product/req-earlier";
    const liveReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-req-earlier-live",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-req-earlier-live", gid, req, resp, {
            title: "Live",
            handle: "req-earlier",
          }),
        ],
      });
      return req;
    });
    const durableReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-req-earlier",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    expect(durableReq).toBeGreaterThan(liveReq);
    const fabricatedEarlier = liveReq;
    const resp = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
    await expect(
      withTenant(async (_c, db) =>
        applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productAbsent(shopAId, "obs-req-earlier", gid, fabricatedEarlier, resp),
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(CanonicalApplyRequestGenerationMismatchError);
    await withTenant(async (client) => {
      const fact = await client.query(
        `SELECT "existenceState", title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fact.rows[0].existenceState).toBe("LIVE");
      expect(fact.rows[0].title).toBe("Live");
      const obs = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-req-earlier'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("ACTIVE");
    });
  });

  it("does not let a fabricated later requestGen bypass blocker semantics", async () => {
    const gid = "gid://shopify/Product/req-later";
    const liveReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-req-later-live",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-req-later-live", gid, req, resp, {
            title: "Live",
            handle: "req-later",
          }),
        ],
      });
      return req;
    });
    const durableReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-req-later",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    expect(durableReq).toBeGreaterThan(liveReq);
    const fabricatedLater = durableReq + 50n;
    const resp = await withTenant(async (_c, db) => {
      let generated = await allocateCatalogObservationGeneration(db);
      while (generated <= fabricatedLater) {
        generated = await allocateCatalogObservationGeneration(db);
      }
      return generated;
    });
    await expect(
      withTenant(async (_c, db) =>
        applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productAbsent(shopAId, "obs-req-later", gid, fabricatedLater, resp),
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(CanonicalApplyRequestGenerationMismatchError);
    await withTenant(async (client) => {
      const fact = await client.query(
        `SELECT "existenceState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fact.rows[0].existenceState).toBe("LIVE");
      const obs = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-req-later'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("ACTIVE");
    });
  });

  it("fails completion when the expected requestGen does not match the durable row", async () => {
    const gid = "gid://shopify/Product/complete-wrong-req";
    const durableReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-complete-wrong-req",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    const resp = await withTenant(async (_c, db) => {
      const wrongReq = durableReq + 1n;
      let generated = await allocateCatalogObservationGeneration(db);
      while (generated <= wrongReq) {
        generated = await allocateCatalogObservationGeneration(db);
      }
      return generated;
    });
    await expect(
      withTenant(async (_c, db) =>
        completeObservation(
          db,
          shopAId,
          "obs-complete-wrong-req",
          durableReq + 1n,
          resp,
        ),
      ),
    ).rejects.toThrow(/completion fence failed/);
    await withTenant(async (client) => {
      const obs = await client.query(
        `SELECT "lifecycleState", "observationResponseGen"
         FROM "CatalogObservationInFlight" WHERE id = 'obs-complete-wrong-req'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("ACTIVE");
      expect(obs.rows[0].observationResponseGen).toBeNull();
    });
  });

  it("fails completion when responseGen is not strictly greater than the durable requestGen", async () => {
    const gid = "gid://shopify/Product/complete-resp";
    const durableReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-complete-resp",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    await expect(
      withTenant(async (_c, db) =>
        completeObservation(
          db,
          shopAId,
          "obs-complete-resp",
          durableReq,
          durableReq,
        ),
      ),
    ).rejects.toBeInstanceOf(CanonicalApplyError);
    await withTenant(async (client) => {
      const obs = await client.query(
        `SELECT "lifecycleState", "observationResponseGen"
         FROM "CatalogObservationInFlight" WHERE id = 'obs-complete-resp'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("ACTIVE");
      expect(obs.rows[0].observationResponseGen).toBeNull();
    });
  });

  it("applies the ordinary matched-token happy path", async () => {
    const gid = "gid://shopify/Product/happy";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-happy",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const result = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-happy", gid, req, resp, { title: "Happy", handle: "happy" }),
        ],
      });
      expect(result.results[0]?.outcome).toBe("applied");
    });
    await withTenant(async (client) => {
      const fact = await client.query(
        `SELECT title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fact.rows[0].title).toBe("Happy");
      const obs = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-happy'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("COMPLETED");
    });
  });

  it("does not retry a unique violation inside the aborted transaction and does not mask 25P02", async () => {
    const gid = "gid://shopify/Product/uc-same-txn";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-uc-seed",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-uc-seed", gid, req, resp, {
            title: "Original",
            handle: "uc-same",
          }),
        ],
      });
    });
    const applyReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-uc-same",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    const applyResp = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
    const client = await getRuntimeClient();
    let statementsAfterConflict = 0;
    try {
      await client.query("BEGIN");
      await setTenant(client, shopAId);
      const inner = asQueryRaw(client);
      let hideProductFactSelect = true;
      const db: CanonicalApplyDb = {
        $queryRaw: async (strings, ...values) => {
          const sql = Array.from(strings).join(" ");
          if (
            hideProductFactSelect &&
            sql.includes("ShopifyProductFact") &&
            sql.includes("FOR UPDATE")
          ) {
            hideProductFactSelect = false;
            return [];
          }
          return forwardQueryRaw(inner)(strings, ...values);
        },
      };
      await expect(
        applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-uc-same", gid, applyReq, applyResp, {
              title: "Conflict",
              handle: "uc-same",
            }),
          ],
        }),
      ).rejects.toBeInstanceOf(CanonicalApplyUniqueConflictError);
      try {
        statementsAfterConflict += 1;
        await client.query("SELECT 1");
        throw new Error("expected aborted-transaction 25P02 after unique conflict");
      } catch (error) {
        expect((error as { code?: string }).code).toBe("25P02");
      }
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
    expect(statementsAfterConflict).toBe(1);
    await withTenant(async (c) => {
      const fact = await c.query(
        `SELECT title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fact.rows[0].title).toBe("Original");
      const obs = await c.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-uc-same'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("ACTIVE");
    });
  });

  it("retries unique conflict in a fresh transaction after full rollback", async () => {
    const gid = "gid://shopify/Product/uc-retry";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-uc-retry-seed",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-uc-retry-seed", gid, req, resp, {
            title: "Original",
            handle: "uc-retry",
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        ],
      });
    });
    const applyReq = await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-uc-retry",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      return req;
    });
    const applyResp = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
    let beginCount = 0;
    let hideProductFactSelect = true;
    const begin = async <T>(work: (db: CanonicalApplyDb) => Promise<T>): Promise<T> => {
      beginCount += 1;
      const client = await getRuntimeClient();
      try {
        await client.query("BEGIN");
        await setTenant(client, shopAId);
        const inner = asQueryRaw(client);
        const db: CanonicalApplyDb = {
          $queryRaw: async (strings, ...values) => {
            const sql = Array.from(strings).join(" ");
            if (
              hideProductFactSelect &&
              sql.includes("ShopifyProductFact") &&
              sql.includes("FOR UPDATE")
            ) {
              return [];
            }
            return forwardQueryRaw(inner)(strings, ...values);
          },
        };
        try {
          const result = await work(db);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          hideProductFactSelect = false;
          throw error;
        }
      } finally {
        await client.end();
      }
    };
    const result = await applyCanonicalFactsWithRetry(begin, {
      shopId: shopAId,
      observations: [
        productLive(shopAId, "obs-uc-retry", gid, applyReq, applyResp, {
          title: "Retry",
          handle: "uc-retry",
          updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
      ],
    });
    expect(beginCount).toBe(2);
    expect(result.results[0]?.outcome).toBe("applied");
    await withTenant(async (client) => {
      const fact = await client.query(
        `SELECT title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(fact.rows[0].title).toBe("Retry");
      const obs = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-uc-retry'`,
      );
      expect(obs.rows[0].lifecycleState).toBe("COMPLETED");
    });
  });

  it("preserves ProductVariant shopifyProductGid on equal Shopify updatedAt", async () => {
    const productA = "gid://shopify/Product/rel-va";
    const productB = "gid://shopify/Product/rel-vb";
    const variantGid = "gid://shopify/ProductVariant/rel-v";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-va",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: productA,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      const respA = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rel-va", productA, reqA, respA, {
            title: "PA",
            handle: "rel-va",
          }),
        ],
      });
      const reqB = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-vb",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: productB,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respB = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rel-vb", productB, reqB, respB, {
            title: "PB",
            handle: "rel-vb",
          }),
        ],
      });
      const reqV = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-v1",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: reqV,
        leaseMs: 60_000,
      });
      const respV = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-rel-v1", variantGid, productA, reqV, respV, {
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-v2",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-rel-v2", variantGid, productB, req2, resp2, {
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(false);
      expect(String(second.results[0]?.diagnosticState)).toContain("EQUAL_VERSION_CONFLICT");
      const row = await client.query(
        `SELECT "shopifyProductGid", "existenceDiagnosticState" FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(row.rows[0].shopifyProductGid).toBe(productA);
      expect(String(row.rows[0].existenceDiagnosticState)).toContain("EQUAL_VERSION_CONFLICT");
    });
  });

  it("applies a newer ProductVariant shopifyProductGid through tenant composite FK", async () => {
    const productA = "gid://shopify/Product/rel-va2";
    const productB = "gid://shopify/Product/rel-vb2";
    const variantGid = "gid://shopify/ProductVariant/rel-v2";
    await withTenant(async (client, db) => {
      for (const [token, gid, handle] of [
        ["obs-rel-va2", productA, "rel-va2"],
        ["obs-rel-vb2", productB, "rel-vb2"],
      ] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "Product",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productLive(shopAId, token, gid, req, resp, { title: handle, handle }),
          ],
        });
      }
      const reqV = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-v2a",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: reqV,
        leaseMs: 60_000,
      });
      const respV = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-rel-v2a", variantGid, productA, reqV, respV, {
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-v2b",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-rel-v2b", variantGid, productB, req2, resp2, {
            updatedAt: new Date("2026-08-02T00:00:00.000Z"),
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(true);
      const row = await client.query(
        `SELECT "shopifyProductGid" FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(row.rows[0].shopifyProductGid).toBe(productB);
    });
  });

  it("records concurrent attribute conflict for overlapping null-version ProductVariant parent GIDs", async () => {
    const productA = "gid://shopify/Product/rel-va3";
    const productB = "gid://shopify/Product/rel-vb3";
    const variantGid = "gid://shopify/ProductVariant/rel-v3";
    await withTenant(async (client, db) => {
      for (const [token, gid, handle] of [
        ["obs-rel-va3", productA, "rel-va3"],
        ["obs-rel-vb3", productB, "rel-vb3"],
      ] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "Product",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [
            productLive(shopAId, token, gid, req, resp, { title: handle, handle }),
          ],
        });
      }
      const req1 = await allocateCatalogObservationGeneration(db);
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-v3a",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: req1,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-rel-v3b",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-rel-v3a", variantGid, productA, req1, resp1, {
            updatedAt: null,
          }),
        ],
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-rel-v3b", variantGid, productB, req2, resp2, {
            updatedAt: null,
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(false);
      expect(String(second.results[0]?.diagnosticState)).toContain(
        "CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT",
      );
      const row = await client.query(
        `SELECT "shopifyProductGid", "existenceDiagnosticState" FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(row.rows[0].shopifyProductGid).toBe(productA);
      expect(String(row.rows[0].existenceDiagnosticState)).toContain(
        "CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT",
      );
    });
  });

  it("preserves InventoryItem shopifyVariantGid on equal Shopify updatedAt", async () => {
    const productGid = "gid://shopify/Product/rel-ia";
    const variantA = "gid://shopify/ProductVariant/rel-ia";
    const variantB = "gid://shopify/ProductVariant/rel-ib";
    const itemGid = "gid://shopify/InventoryItem/rel-i";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-ia-p",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: productGid,
        requestGen: reqP,
        leaseMs: 60_000,
      });
      const respP = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rel-ia-p", productGid, reqP, respP, {
            title: "IA",
            handle: "rel-ia",
          }),
        ],
      });
      for (const [token, gid] of [
        ["obs-rel-ia-va", variantA],
        ["obs-rel-ia-vb", variantB],
      ] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "ProductVariant",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [variantLive(shopAId, token, gid, productGid, req, resp)],
        });
      }
      const reqI = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-i1",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: reqI,
        leaseMs: 60_000,
      });
      const respI = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-rel-i1", itemGid, variantA, reqI, respI, {
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-i2",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-rel-i2", itemGid, variantB, req2, resp2, {
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(false);
      expect(String(second.results[0]?.diagnosticState)).toContain("EQUAL_VERSION_CONFLICT");
      const row = await client.query(
        `SELECT "shopifyVariantGid", "existenceDiagnosticState" FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
        [itemGid],
      );
      expect(row.rows[0].shopifyVariantGid).toBe(variantA);
    });
  });

  it("applies a newer InventoryItem shopifyVariantGid through tenant composite FK", async () => {
    const productGid = "gid://shopify/Product/rel-ia2";
    const variantA = "gid://shopify/ProductVariant/rel-ia2";
    const variantB = "gid://shopify/ProductVariant/rel-ib2";
    const itemGid = "gid://shopify/InventoryItem/rel-i2";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-ia2-p",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: productGid,
        requestGen: reqP,
        leaseMs: 60_000,
      });
      const respP = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rel-ia2-p", productGid, reqP, respP, {
            title: "IA2",
            handle: "rel-ia2",
          }),
        ],
      });
      for (const [token, gid] of [
        ["obs-rel-ia2-va", variantA],
        ["obs-rel-ia2-vb", variantB],
      ] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "ProductVariant",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [variantLive(shopAId, token, gid, productGid, req, resp)],
        });
      }
      const reqI = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-i2a",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: reqI,
        leaseMs: 60_000,
      });
      const respI = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-rel-i2a", itemGid, variantA, reqI, respI, {
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-i2b",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-rel-i2b", itemGid, variantB, req2, resp2, {
            updatedAt: new Date("2026-08-02T00:00:00.000Z"),
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(true);
      const row = await client.query(
        `SELECT "shopifyVariantGid" FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
        [itemGid],
      );
      expect(row.rows[0].shopifyVariantGid).toBe(variantB);
    });
  });

  it("records concurrent attribute conflict for overlapping null-version InventoryItem variant GIDs", async () => {
    const productGid = "gid://shopify/Product/rel-ia3";
    const variantA = "gid://shopify/ProductVariant/rel-ia3";
    const variantB = "gid://shopify/ProductVariant/rel-ib3";
    const itemGid = "gid://shopify/InventoryItem/rel-i3";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-ia3-p",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: productGid,
        requestGen: reqP,
        leaseMs: 60_000,
      });
      const respP = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-rel-ia3-p", productGid, reqP, respP, {
            title: "IA3",
            handle: "rel-ia3",
          }),
        ],
      });
      for (const [token, gid] of [
        ["obs-rel-ia3-va", variantA],
        ["obs-rel-ia3-vb", variantB],
      ] as const) {
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: token,
          shopId: shopAId,
          resourceKind: "ProductVariant",
          shopifyGid: gid,
          requestGen: req,
          leaseMs: 60_000,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [variantLive(shopAId, token, gid, productGid, req, resp)],
        });
      }
      const req1 = await allocateCatalogObservationGeneration(db);
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-rel-i3a",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: req1,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-rel-i3b",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp1 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-rel-i3a", itemGid, variantA, req1, resp1, {
            updatedAt: null,
          }),
        ],
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const second = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-rel-i3b", itemGid, variantB, req2, resp2, {
            updatedAt: null,
          }),
        ],
      });
      expect(second.results[0]?.attributesApplied).toBe(false);
      expect(String(second.results[0]?.diagnosticState)).toContain(
        "CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT",
      );
      const row = await client.query(
        `SELECT "shopifyVariantGid" FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
        [itemGid],
      );
      expect(row.rows[0].shopifyVariantGid).toBe(variantA);
    });
  });

  it("preserves no canonical row for unseen ABSENT on every resource kind", async () => {
    const productGid = "gid://shopify/Product/unseen-abs";
    const variantGid = "gid://shopify/ProductVariant/unseen-abs";
    const itemGid = "gid://shopify/InventoryItem/unseen-abs";
    const locationGid = "gid://shopify/Location/unseen-abs";
    const levelItemGid = "gid://shopify/InventoryItem/unseen-abs-lvl";
    const levelLocationGid = "gid://shopify/Location/unseen-abs-lvl";
    await withTenant(async (client, db) => {
      const cases: Array<{
        token: string;
        kind: string;
        observation: DirectCanonicalObservation;
        sql: string;
        params: string[];
      }> = [
        {
          token: "obs-unseen-abs-p",
          kind: "Product",
          observation: resourceAbsent(
            shopAId,
            "obs-unseen-abs-p",
            { shopId: shopAId, resourceKind: "Product", shopifyGid: productGid },
            0n,
            1n,
          ),
          sql: `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
          params: [productGid],
        },
        {
          token: "obs-unseen-abs-v",
          kind: "ProductVariant",
          observation: resourceAbsent(
            shopAId,
            "obs-unseen-abs-v",
            { shopId: shopAId, resourceKind: "ProductVariant", shopifyGid: variantGid },
            0n,
            1n,
          ),
          sql: `SELECT 1 FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
          params: [variantGid],
        },
        {
          token: "obs-unseen-abs-i",
          kind: "InventoryItem",
          observation: resourceAbsent(
            shopAId,
            "obs-unseen-abs-i",
            { shopId: shopAId, resourceKind: "InventoryItem", shopifyGid: itemGid },
            0n,
            1n,
          ),
          sql: `SELECT 1 FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
          params: [itemGid],
        },
        {
          token: "obs-unseen-abs-l",
          kind: "Location",
          observation: resourceAbsent(
            shopAId,
            "obs-unseen-abs-l",
            { shopId: shopAId, resourceKind: "Location", shopifyGid: locationGid },
            0n,
            1n,
          ),
          sql: `SELECT 1 FROM "ShopifyLocationFact" WHERE "shopifyGid" = $1`,
          params: [locationGid],
        },
        {
          token: "obs-unseen-abs-lvl",
          kind: "InventoryLevel",
          observation: resourceAbsent(
            shopAId,
            "obs-unseen-abs-lvl",
            {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: levelItemGid,
              locationGid: levelLocationGid,
            },
            0n,
            1n,
          ),
          sql: `SELECT 1 FROM "ShopifyInventoryLevelFact" WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
          params: [levelItemGid, levelLocationGid],
        },
      ];
      for (const testCase of cases) {
        const req = await allocateCatalogObservationGeneration(db);
        const resp = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: testCase.token,
          shopId: shopAId,
          resourceKind: testCase.kind,
          shopifyGid:
            testCase.observation.identity.resourceKind === "InventoryLevel"
              ? undefined
              : testCase.observation.identity.shopifyGid,
          inventoryItemGid:
            testCase.observation.identity.resourceKind === "InventoryLevel"
              ? testCase.observation.identity.inventoryItemGid
              : undefined,
          locationGid:
            testCase.observation.identity.resourceKind === "InventoryLevel"
              ? testCase.observation.identity.locationGid
              : undefined,
          requestGen: req,
          leaseMs: 60_000,
        });
        const observation: DirectCanonicalObservation = {
          ...testCase.observation,
          observationRequestGen: req,
          observationResponseGen: resp,
        };
        const result = await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [observation],
        });
        expect(result.results[0]?.outcome, testCase.kind).toBe("noop");
        expect(result.results[0]?.existenceMutated, testCase.kind).toBe(false);
        const rows = await client.query(testCase.sql, testCase.params);
        expect(rows.rowCount, testCase.kind).toBe(0);
        const obs = await client.query(
          `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = $1`,
          [testCase.token],
        );
        expect(obs.rows[0].lifecycleState, testCase.kind).toBe("COMPLETED");
      }
    });
  });
});
