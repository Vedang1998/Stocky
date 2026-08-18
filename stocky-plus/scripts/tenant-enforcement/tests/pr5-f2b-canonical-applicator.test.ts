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
  CanonicalApplyIncompleteFirstLiveError,
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
  attrs: {
    title?: string;
    updatedAt?: Date | null;
    priceAmount?: string;
    compareAtPriceAmount?: string | null;
    currencyCode?: string;
    selectedOptions?: unknown;
  } = {},
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
      selectedOptions: attrs.selectedOptions ?? {},
      priceAmount: attrs.priceAmount ?? "10.000000",
      compareAtPriceAmount: attrs.compareAtPriceAmount,
      currencyCode: attrs.currencyCode ?? "USD",
    },
  };
}

function itemLive(
  shopId: string,
  token: string,
  gid: string,
  variantGid: string | null,
  requestGen: bigint,
  responseGen: bigint,
  attrs: {
    updatedAt?: Date | null;
    unitCostAmount?: string | null;
    weightValue?: string | null;
    tracked?: boolean;
    requiresShipping?: boolean;
    unitCostAccess?: "PRESENT" | "NULL" | "OMITTED_NO_PERMISSION" | "QUERY_ERROR_ISOLATED";
  } = {},
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
      tracked: attrs.tracked ?? true,
      requiresShipping: attrs.requiresShipping ?? true,
      unitCostAccess: attrs.unitCostAccess ?? "NULL",
      unitCostAmount: attrs.unitCostAmount,
      weightValue: attrs.weightValue,
    },
  };
}

function locationLive(
  shopId: string,
  token: string,
  gid: string,
  requestGen: bigint,
  responseGen: bigint,
  attrs: {
    name?: string;
    isActive?: boolean;
    fulfillsOnlineOrders?: boolean;
    shipsInventory?: boolean;
    isFulfillmentService?: boolean;
    hasActiveInventory?: boolean;
  } = {},
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: { shopId, resourceKind: "Location", shopifyGid: gid },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
    attributes: {
      name: attrs.name ?? "L",
      isActive: attrs.isActive ?? true,
      fulfillsOnlineOrders: attrs.fulfillsOnlineOrders ?? true,
      shipsInventory: attrs.shipsInventory ?? true,
      isFulfillmentService: attrs.isFulfillmentService ?? false,
      hasActiveInventory: attrs.hasActiveInventory ?? true,
    },
  };
}

function levelLive(
  shopId: string,
  token: string,
  itemGid: string,
  locationGid: string,
  requestGen: bigint,
  responseGen: bigint,
  attrs: { isActive?: boolean } = {},
): DirectCanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: {
      shopId,
      resourceKind: "InventoryLevel",
      inventoryItemGid: itemGid,
      locationGid,
    },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
    attributes: {
      isActive: attrs.isActive ?? true,
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

function productFullSync(
  shopId: string,
  gid: string,
  fenceGeneration: bigint,
  epochId: string,
  attrs: { title: string; handle: string; updatedAt?: Date | null },
): FullSyncCanonicalObservation {
  return {
    observationKind: "full_sync",
    fenceGeneration,
    epochId,
    identity: { shopId, resourceKind: "Product", shopifyGid: gid },
    existenceKind: "LIVE_FULL_SYNC_PRESENT",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    shopifyUpdatedAt:
      attrs.updatedAt === undefined ? new Date("2026-08-01T00:00:00.000Z") : attrs.updatedAt,
    sourceKind: "FULL_SYNC",
    attributes: {
      title: attrs.title,
      handle: attrs.handle,
      status: "ACTIVE",
      tags: [],
    },
  };
}

function levelFullSync(
  shopId: string,
  itemGid: string,
  locationGid: string,
  fenceGeneration: bigint,
  epochId: string,
  attrs: {
    isActive?: boolean;
    quantities?: Array<{
      name: "available" | "committed";
      quantity: number | null;
      shopifyUpdatedAt: Date | null;
    }>;
  } = {},
): FullSyncCanonicalObservation {
  return {
    observationKind: "full_sync",
    fenceGeneration,
    epochId,
    identity: {
      shopId,
      resourceKind: "InventoryLevel",
      inventoryItemGid: itemGid,
      locationGid,
    },
    existenceKind: "LIVE_FULL_SYNC_PRESENT",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "FULL_SYNC",
    attributes: {
      isActive: attrs.isActive ?? true,
      quantities: attrs.quantities,
    },
  };
}

async function seedCatalogParents(
  client: Client,
  db: CanonicalApplyDb,
  shopId: string,
  ids: {
    prefix: string;
    productGid: string;
    variantGid: string;
    itemGid: string;
    locGid: string;
  },
): Promise<void> {
  const seed = async (
    token: string,
    kind: "Product" | "ProductVariant" | "InventoryItem" | "Location",
    gid: string,
    observation: CanonicalObservation,
  ) => {
    const req =
      observation.observationKind === "direct" ? observation.observationRequestGen : 0n;
    await insertObservation(client, {
      id: token,
      shopId,
      resourceKind: kind,
      shopifyGid: gid,
      requestGen: req,
      leaseMs: 60_000,
    });
    await applyCanonicalFacts(db, { shopId, observations: [observation] });
  };
  const reqP = await allocateCatalogObservationGeneration(db);
  const respP = await allocateCatalogObservationGeneration(db);
  await seed(
    `${ids.prefix}-p`,
    "Product",
    ids.productGid,
    productLive(shopId, `${ids.prefix}-p`, ids.productGid, reqP, respP, {
      title: "P",
      handle: "p",
    }),
  );
  const reqV = await allocateCatalogObservationGeneration(db);
  const respV = await allocateCatalogObservationGeneration(db);
  await seed(
    `${ids.prefix}-v`,
    "ProductVariant",
    ids.variantGid,
    variantLive(shopId, `${ids.prefix}-v`, ids.variantGid, ids.productGid, reqV, respV),
  );
  const reqI = await allocateCatalogObservationGeneration(db);
  const respI = await allocateCatalogObservationGeneration(db);
  await seed(
    `${ids.prefix}-i`,
    "InventoryItem",
    ids.itemGid,
    itemLive(shopId, `${ids.prefix}-i`, ids.itemGid, ids.variantGid, reqI, respI),
  );
  const reqL = await allocateCatalogObservationGeneration(db);
  const respL = await allocateCatalogObservationGeneration(db);
  await seed(
    `${ids.prefix}-l`,
    "Location",
    ids.locGid,
    locationLive(shopId, `${ids.prefix}-l`, ids.locGid, reqL, respL),
  );
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
        `SELECT title, "existenceState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBeLessThanOrEqual(1);
      if (rows.rowCount === 1) {
        expect(rows.rows[0].existenceState).toBe("LIVE");
        expect(["A", "B"]).toContain(rows.rows[0].title);
      }
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
              isActive: true,
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

  it("fails closed on overlapping LIVE after unseen ABSENT left no row", async () => {
    const gid = "gid://shopify/Product/overlap-absent-live";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      const reqB = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ov-abs-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-ov-abs-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respA = await allocateCatalogObservationGeneration(db);
      const absent = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productAbsent(shopAId, "obs-ov-abs-a", gid, reqA, respA)],
      });
      expect(absent.results[0]?.outcome).toBe("noop");
      const respB = await allocateCatalogObservationGeneration(db);
      const live = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-ov-abs-b", gid, reqB, respB, {
            title: "ShouldNotInsert",
            handle: "nope",
          }),
        ],
      });
      expect(live.results[0]?.outcome).toBe("conflict");
      expect(live.results[0]?.existenceMutated).toBe(false);
      expect(String(live.results[0]?.diagnosticState)).toContain(
        "CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT",
      );
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
      const obsB = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = $1`,
        ["obs-ov-abs-b"],
      );
      expect(obsB.rows[0].lifecycleState).toBe("COMPLETED");
    });
  });

  it("allows a later non-overlapping LIVE to first-insert after overlapping ABSENT/LIVE settle", async () => {
    const gid = "gid://shopify/Product/overlap-fresh-live";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      const reqB = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fresh-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-fresh-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respA = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productAbsent(shopAId, "obs-fresh-a", gid, reqA, respA)],
      });
      const respB = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-fresh-b", gid, reqB, respB, {
            title: "Blocked",
            handle: "blocked",
          }),
        ],
      });
      const reqC = await allocateCatalogObservationGeneration(db);
      expect(reqC > respA && reqC > respB).toBe(true);
      await insertObservation(client, {
        id: "obs-fresh-c",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqC,
        leaseMs: 60_000,
      });
      const respC = await allocateCatalogObservationGeneration(db);
      const later = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-fresh-c", gid, reqC, respC, {
            title: "Recovered",
            handle: "recovered",
          }),
        ],
      });
      expect(later.results[0]?.outcome).toBe("applied");
      expect(later.results[0]?.existenceMutated).toBe(true);
      const rows = await client.query(
        `SELECT title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].title).toBe("Recovered");
    });
  });

  it("does not assume a prior completed no-row interval agreed with incoming LIVE", async () => {
    const gid = "gid://shopify/Product/overlap-incomplete-then-live";
    await withTenant(async (client, db) => {
      const reqA = await allocateCatalogObservationGeneration(db);
      const reqB = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-inc-a",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqA,
        leaseMs: 60_000,
      });
      await insertObservation(client, {
        id: "obs-inc-b",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqB,
        leaseMs: 60_000,
      });
      const respA = await allocateCatalogObservationGeneration(db);
      const incomplete: DirectCanonicalObservation = {
        ...productLive(shopAId, "obs-inc-a", gid, reqA, respA, {
          title: "Ignored",
          handle: "ignored",
        }),
        attributes: { handle: "ignored", tags: [], status: "ACTIVE" } as DirectCanonicalObservation["attributes"],
      };
      const rejected = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [incomplete],
      });
      expect(rejected.results[0]?.outcome).toBe("rejected");
      const respB = await allocateCatalogObservationGeneration(db);
      const live = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productLive(shopAId, "obs-inc-b", gid, reqB, respB, {
            title: "StillNo",
            handle: "still-no",
          }),
        ],
      });
      expect(live.results[0]?.outcome).toBe("conflict");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("serializes concurrent overlapping LIVE vs ABSENT first insert to zero or one row", async () => {
    const gid = "gid://shopify/Product/concurrent-live-absent";
    const a = await getRuntimeClient();
    const b = await getRuntimeClient();
    try {
      await a.query("BEGIN");
      await setTenant(a, shopAId);
      const reqLive = await allocateCatalogObservationGeneration(asQueryRaw(a));
      const reqAbs = await allocateCatalogObservationGeneration(asQueryRaw(a));
      await insertObservation(a, {
        id: "obs-cla-live",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqLive,
        leaseMs: 60_000,
      });
      await insertObservation(a, {
        id: "obs-cla-abs",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: reqAbs,
        leaseMs: 60_000,
      });
      await a.query("COMMIT");
      const respLive = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
      const respAbs = await withTenant(async (_c, db) => allocateCatalogObservationGeneration(db));
      const runLive = (async () => {
        await a.query("BEGIN");
        await setTenant(a, shopAId);
        const result = await applyCanonicalFacts(asQueryRaw(a), {
          shopId: shopAId,
          observations: [
            productLive(shopAId, "obs-cla-live", gid, reqLive, respLive, {
              title: "LiveRace",
              handle: "live-race",
            }),
          ],
        });
        await a.query("COMMIT");
        return result;
      })();
      const runAbs = (async () => {
        await b.query("BEGIN");
        await setTenant(b, shopAId);
        const result = await applyCanonicalFacts(asQueryRaw(b), {
          shopId: shopAId,
          observations: [productAbsent(shopAId, "obs-cla-abs", gid, reqAbs, respAbs)],
        });
        await b.query("COMMIT");
        return result;
      })();
      await Promise.all([runLive, runAbs]);
      await a.query("BEGIN");
      await setTenant(a, shopAId);
      const rows = await a.query(
        `SELECT title, "existenceState" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBeLessThanOrEqual(1);
      if (rows.rowCount === 1) {
        expect(rows.rows[0].existenceState).toBe("LIVE");
        expect(rows.rows[0].title).toBe("LiveRace");
      }
      await a.query("COMMIT");
    } finally {
      await a.query("ROLLBACK").catch(() => undefined);
      await b.query("ROLLBACK").catch(() => undefined);
      await a.end();
      await b.end();
    }
  });

  it("treats PostgreSQL scale-expanded price as equal_match not EQUAL_VERSION_CONFLICT", async () => {
    const productGid = "gid://shopify/Product/num-p";
    const variantGid = "gid://shopify/ProductVariant/num-v";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-num-p",
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
          productLive(shopAId, "obs-num-p", productGid, reqP, respP, {
            title: "Num",
            handle: "num",
          }),
        ],
      });
      const reqV = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-num-v1",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: reqV,
        leaseMs: 60_000,
      });
      const respV = await allocateCatalogObservationGeneration(db);
      const stamp = new Date("2026-08-01T00:00:00.000Z");
      const first = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-num-v1", variantGid, productGid, reqV, respV, {
            updatedAt: stamp,
            priceAmount: "19.99",
            compareAtPriceAmount: "0.1",
          }),
        ],
      });
      expect(first.results[0]?.outcome).toBe("applied");
      const stored = await client.query(
        `SELECT "priceAmount"::text AS price, "compareAtPriceAmount"::text AS compare, "existenceDiagnosticState"
         FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(stored.rowCount).toBe(1);
      expect(String(stored.rows[0].price)).toMatch(/19\.99/);
      expect(stored.rows[0].existenceDiagnosticState).toBeNull();
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-num-v2",
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
          variantLive(shopAId, "obs-num-v2", variantGid, productGid, req2, resp2, {
            updatedAt: stamp,
            priceAmount: "19.99",
            compareAtPriceAmount: "0.1",
          }),
        ],
      });
      expect(second.results[0]?.outcome).not.toBe("conflict");
      expect(String(second.results[0]?.diagnosticState ?? "")).not.toContain("EQUAL_VERSION_CONFLICT");
      const after = await client.query(
        `SELECT "existenceDiagnosticState" FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(after.rows[0].existenceDiagnosticState).toBeNull();
    });
  });

  it("records EQUAL_VERSION_CONFLICT on a true numeric price difference at equal updatedAt", async () => {
    const productGid = "gid://shopify/Product/num-diff-p";
    const variantGid = "gid://shopify/ProductVariant/num-diff-v";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-nd-p",
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
          productLive(shopAId, "obs-nd-p", productGid, reqP, respP, {
            title: "Diff",
            handle: "diff",
          }),
        ],
      });
      const stamp = new Date("2026-08-01T00:00:00.000Z");
      const reqV = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-nd-v1",
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
          variantLive(shopAId, "obs-nd-v1", variantGid, productGid, reqV, respV, {
            updatedAt: stamp,
            priceAmount: "19.99",
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-nd-v2",
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
          variantLive(shopAId, "obs-nd-v2", variantGid, productGid, req2, resp2, {
            updatedAt: stamp,
            priceAmount: "19.98",
          }),
        ],
      });
      expect(String(second.results[0]?.diagnosticState)).toContain("EQUAL_VERSION_CONFLICT");
      const row = await client.query(
        `SELECT "priceAmount"::text AS price FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(String(row.rows[0].price)).toMatch(/19\.99/);
    });
  });

  it("round-trips scale-equivalent unitCost and weight without EQUAL_VERSION_CONFLICT", async () => {
    const productGid = "gid://shopify/Product/num-item-p";
    const variantGid = "gid://shopify/ProductVariant/num-item-v";
    const itemGid = "gid://shopify/InventoryItem/num-item-i";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ni-p",
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
          productLive(shopAId, "obs-ni-p", productGid, reqP, respP, { title: "I", handle: "i" }),
        ],
      });
      const reqV = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ni-v",
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
          variantLive(shopAId, "obs-ni-v", variantGid, productGid, reqV, respV),
        ],
      });
      const stamp = new Date("2026-08-01T00:00:00.000Z");
      const reqI = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ni-i1",
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
          itemLive(shopAId, "obs-ni-i1", itemGid, variantGid, reqI, respI, {
            updatedAt: stamp,
            unitCostAmount: "3.5",
            weightValue: "1.25",
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ni-i2",
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
          itemLive(shopAId, "obs-ni-i2", itemGid, variantGid, req2, resp2, {
            updatedAt: stamp,
            unitCostAmount: "3.500000",
            weightValue: "1.250000",
          }),
        ],
      });
      expect(String(second.results[0]?.diagnosticState ?? "")).not.toContain("EQUAL_VERSION_CONFLICT");
      const row = await client.query(
        `SELECT "unitCostAmount"::text AS cost, "weightValue"::text AS weight, "existenceDiagnosticState"
         FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
        [itemGid],
      );
      expect(row.rows[0].existenceDiagnosticState).toBeNull();
      expect(String(row.rows[0].cost)).toMatch(/3\.5/);
      expect(String(row.rows[0].weight)).toMatch(/1\.25/);
    });
  });

  it("fail-closes significant price precision beyond DECIMAL(20,6) without writing a rounded fact", async () => {
    const productGid = "gid://shopify/Product/num-ovf-p";
    const variantGid = "gid://shopify/ProductVariant/num-ovf-v";
    await withTenant(async (client, db) => {
      const reqP = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ovf-p",
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
          productLive(shopAId, "obs-ovf-p", productGid, reqP, respP, {
            title: "Ovf",
            handle: "ovf",
          }),
        ],
      });
      const reqV = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-ovf-v",
        shopId: shopAId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
        requestGen: reqV,
        leaseMs: 60_000,
      });
      const respV = await allocateCatalogObservationGeneration(db);
      const result = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          variantLive(shopAId, "obs-ovf-v", variantGid, productGid, reqV, respV, {
            priceAmount: "19.9900001",
          }),
        ],
      });
      expect(result.results[0]?.outcome).toBe("rejected");
      expect(String(result.results[0]?.diagnosticState)).toContain(
        "CANONICAL_NUMERIC_SCALE_UNREPRESENTABLE",
      );
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
        [variantGid],
      );
      expect(rows.rowCount).toBe(0);
      const obs = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = $1`,
        ["obs-ovf-v"],
      );
      expect(obs.rows[0].lifecycleState).toBe("COMPLETED");
    });
  });

  it("rejects incomplete first-LIVE payloads for every resource kind and completes the direct observation", async () => {
    await withTenant(async (client, db) => {
      const cases: Array<{
        token: string;
        kind: string;
        observation: DirectCanonicalObservation;
        sql: string;
        params: string[];
      }> = [
        {
          token: "obs-inc-p",
          kind: "Product",
          observation: {
            ...productLive(
              shopAId,
              "obs-inc-p",
              "gid://shopify/Product/inc-p",
              0n,
              1n,
              { title: "X", handle: "x" },
            ),
            attributes: { handle: "x", tags: [], status: "ACTIVE" } as DirectCanonicalObservation["attributes"],
          },
          sql: `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
          params: ["gid://shopify/Product/inc-p"],
        },
        {
          token: "obs-inc-v",
          kind: "ProductVariant",
          observation: variantLive(
            shopAId,
            "obs-inc-v",
            "gid://shopify/ProductVariant/inc-v",
            "gid://shopify/Product/inc-p",
            0n,
            1n,
            { currencyCode: "" },
          ),
          sql: `SELECT 1 FROM "ShopifyVariantFact" WHERE "shopifyGid" = $1`,
          params: ["gid://shopify/ProductVariant/inc-v"],
        },
        {
          token: "obs-inc-i",
          kind: "InventoryItem",
          observation: {
            ...itemLive(
              shopAId,
              "obs-inc-i",
              "gid://shopify/InventoryItem/inc-i",
              null,
              0n,
              1n,
            ),
            attributes: { requiresShipping: true, unitCostAccess: "NULL" } as DirectCanonicalObservation["attributes"],
          },
          sql: `SELECT 1 FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
          params: ["gid://shopify/InventoryItem/inc-i"],
        },
        {
          token: "obs-inc-l",
          kind: "Location",
          observation: {
            ...locationLive(shopAId, "obs-inc-l", "gid://shopify/Location/inc-l", 0n, 1n),
            attributes: {
              name: "L",
              fulfillsOnlineOrders: true,
              shipsInventory: true,
              isFulfillmentService: false,
              hasActiveInventory: true,
            } as DirectCanonicalObservation["attributes"],
          },
          sql: `SELECT 1 FROM "ShopifyLocationFact" WHERE "shopifyGid" = $1`,
          params: ["gid://shopify/Location/inc-l"],
        },
        {
          token: "obs-inc-lvl",
          kind: "InventoryLevel",
          observation: {
            ...levelLive(
              shopAId,
              "obs-inc-lvl",
              "gid://shopify/InventoryItem/inc-lvl-i",
              "gid://shopify/Location/inc-lvl-l",
              0n,
              1n,
            ),
            attributes: {},
          },
          sql: `SELECT 1 FROM "ShopifyInventoryLevelFact" WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
          params: [
            "gid://shopify/InventoryItem/inc-lvl-i",
            "gid://shopify/Location/inc-lvl-l",
          ],
        },
      ];
      for (const testCase of cases) {
        const req = await allocateCatalogObservationGeneration(db);
        const resp = await allocateCatalogObservationGeneration(db);
        await insertObservation(client, {
          id: "obs-inc-kind-" + testCase.kind,
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
          observationToken: "obs-inc-kind-" + testCase.kind,
          observationRequestGen: req,
          observationResponseGen: resp,
        };
        const result = await applyCanonicalFacts(db, {
          shopId: shopAId,
          observations: [observation],
        });
        expect(result.results[0]?.outcome, testCase.kind).toBe("rejected");
        expect(result.results[0]?.existenceMutated, testCase.kind).toBe(false);
        expect(String(result.results[0]?.diagnosticState), testCase.kind).toContain(
          "INCOMPLETE_FIRST_LIVE_ATTRIBUTES",
        );
        const rows = await client.query(testCase.sql, testCase.params);
        expect(rows.rowCount, testCase.kind).toBe(0);
        const obs = await client.query(
          `SELECT "lifecycleState", "observationResponseGen" FROM "CatalogObservationInFlight" WHERE id = $1`,
          ["obs-inc-kind-" + testCase.kind],
        );
        expect(obs.rows[0].lifecycleState, testCase.kind).toBe("COMPLETED");
        expect(obs.rows[0].observationResponseGen).not.toBeNull();
      }
    });
  });

  it("inserts complete first-LIVE Location and InventoryItem payloads including explicit false booleans", async () => {
    await withTenant(async (client, db) => {
      const locGid = "gid://shopify/Location/complete-l";
      const reqL = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-complete-l",
        shopId: shopAId,
        resourceKind: "Location",
        shopifyGid: locGid,
        requestGen: reqL,
        leaseMs: 60_000,
      });
      const respL = await allocateCatalogObservationGeneration(db);
      const loc = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          locationLive(shopAId, "obs-complete-l", locGid, reqL, respL, {
            name: "Inactive",
            isActive: false,
            fulfillsOnlineOrders: false,
            shipsInventory: false,
            isFulfillmentService: true,
            hasActiveInventory: false,
          }),
        ],
      });
      expect(loc.results[0]?.outcome).toBe("applied");
      const locRow = await client.query(
        `SELECT name, "isActive", "isFulfillmentService" FROM "ShopifyLocationFact" WHERE "shopifyGid" = $1`,
        [locGid],
      );
      expect(locRow.rows[0].isActive).toBe(false);
      expect(locRow.rows[0].isFulfillmentService).toBe(true);

      const itemGid = "gid://shopify/InventoryItem/complete-i";
      const reqI = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-complete-i",
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: itemGid,
        requestGen: reqI,
        leaseMs: 60_000,
      });
      const respI = await allocateCatalogObservationGeneration(db);
      const item = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          itemLive(shopAId, "obs-complete-i", itemGid, null, reqI, respI, {
            tracked: false,
            requiresShipping: false,
            unitCostAccess: "OMITTED_NO_PERMISSION",
          }),
        ],
      });
      expect(item.results[0]?.outcome).toBe("applied");
      const itemRow = await client.query(
        `SELECT tracked, "requiresShipping", "unitCostAccess" FROM "ShopifyInventoryItemFact" WHERE "shopifyGid" = $1`,
        [itemGid],
      );
      expect(itemRow.rows[0].tracked).toBe(false);
      expect(itemRow.rows[0].requiresShipping).toBe(false);
      expect(itemRow.rows[0].unitCostAccess).toBe("OMITTED_NO_PERMISSION");
    });
  });

  it("keeps existence-only LIVE valid on an existing Product row", async () => {
    const gid = "gid://shopify/Product/exist-only";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-eo-1",
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
          productLive(shopAId, "obs-eo-1", gid, req1, resp1, { title: "Keep", handle: "keep" }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-eo-2",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      const existenceOnly: DirectCanonicalObservation = {
        observationKind: "direct",
        observationToken: "obs-eo-2",
        observationRequestGen: req2,
        observationResponseGen: resp2,
        identity: { shopId: shopAId, resourceKind: "Product", shopifyGid: gid },
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
        sourceKind: "INCREMENTAL_REFETCH",
      };
      const result = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [existenceOnly],
      });
      expect(result.results[0]?.outcome).toBe("noop");
      const row = await client.query(
        `SELECT title FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(row.rowCount).toBe(1);
      expect(row.rows[0].title).toBe("Keep");
    });
  });

  it("fails a full-sync first-LIVE unit with incomplete attributes and inserts nothing", async () => {
    const gid = "gid://shopify/Product/fs-incomplete";
    await expect(
      withTenant(async (_client, db) => {
        const bulk: FullSyncCanonicalObservation = {
          observationKind: "full_sync",
          fenceGeneration: 9n,
          epochId: "epoch-incomplete",
          identity: { shopId: shopAId, resourceKind: "Product", shopifyGid: gid },
          existenceKind: "LIVE_FULL_SYNC_PRESENT",
          existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
          sourceKind: "FULL_SYNC",
          attributes: { handle: "fs", tags: [], status: "ACTIVE" } as FullSyncCanonicalObservation["attributes"],
        };
        await applyCanonicalFacts(db, { shopId: shopAId, observations: [bulk] });
      }),
    ).rejects.toBeInstanceOf(CanonicalApplyIncompleteFirstLiveError);
    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("persists full-sync first insert as LIVE_FULL_SYNC_PRESENT with NULL/NULL existence gens", async () => {
    const gid = "gid://shopify/Product/fs-null-null";
    await withTenant(async (_client, db) => {
      const result = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, 4n, "epoch-null-null", {
            title: "BulkLive",
            handle: "bulk-live",
          }),
        ],
      });
      expect(result.results[0]?.outcome).toBe("applied");
      expect(result.results[0]?.existenceMutated).toBe(true);
    });
    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT "existenceKind", "existenceState", "existenceRequestGen", "existenceResponseGen",
                "lastSeenFullSyncRunId", "attributeRequestGen", "attributeResponseGen"
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].existenceKind).toBe("LIVE_FULL_SYNC_PRESENT");
      expect(rows.rows[0].existenceState).toBe("LIVE");
      expect(rows.rows[0].existenceRequestGen).toBeNull();
      expect(rows.rows[0].existenceResponseGen).toBeNull();
      expect(rows.rows[0].lastSeenFullSyncRunId).toBe("epoch-null-null");
      expect(String(rows.rows[0].attributeRequestGen)).toBe("4");
      expect(String(rows.rows[0].attributeResponseGen)).toBe("4");
    });
  });

  it("Race AT-3: later completed direct ABSENT blocks older full-sync first insert", async () => {
    const gid = "gid://shopify/Product/at3-later-absent";
    const fence = await withTenant(async (_client, db) => allocateCatalogObservationGeneration(db));
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      expect(req > fence).toBe(true);
      await insertObservation(client, {
        id: "obs-at3-abs",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      const absent = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productAbsent(shopAId, "obs-at3-abs", gid, req, resp)],
      });
      expect(absent.results[0]?.outcome).toBe("noop");
    });
    await withTenant(async (client, db) => {
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, fence, "epoch-at3", {
            title: "LateBulk",
            handle: "late-bulk",
          }),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.outcome).toBe("conflict");
      expect(bulk.results[0]?.diagnosticState).toBe("CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("does not first-insert full-sync LIVE when a completed direct spans the fence", async () => {
    const gid = "gid://shopify/Product/fs-span";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-span",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productAbsent(shopAId, "obs-fs-span", gid, req, resp)],
      });
      const fence = req + 1n;
      expect(fence < resp).toBe(true);
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, fence, "epoch-span", {
            title: "SpanBulk",
            handle: "span-bulk",
          }),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.outcome).toBe("conflict");
      const rows = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  it("allows full-sync first insert when the only completed direct is safely earlier than F", async () => {
    const gid = "gid://shopify/Product/fs-earlier";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-earlier",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productAbsent(shopAId, "obs-fs-earlier", gid, req, resp)],
      });
      const fence = resp + 1n;
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, fence, "epoch-earlier", {
            title: "LaterBulk",
            handle: "later-bulk",
          }),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(true);
      expect(bulk.results[0]?.outcome).toBe("applied");
      const rows = await client.query(
        `SELECT "existenceKind", "existenceRequestGen", "existenceResponseGen", title
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].existenceKind).toBe("LIVE_FULL_SYNC_PRESENT");
      expect(rows.rows[0].existenceRequestGen).toBeNull();
      expect(rows.rows[0].existenceResponseGen).toBeNull();
      expect(rows.rows[0].title).toBe("LaterBulk");
    });
  });

  it("blocks full-sync first insert while an ACTIVE later direct remains unexpired", async () => {
    const gid = "gid://shopify/Product/fs-active-later";
    const fence = await withTenant(async (_client, db) => allocateCatalogObservationGeneration(db));
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      expect(req > fence).toBe(true);
      await insertObservation(client, {
        id: "obs-fs-active-later",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, fence, "epoch-active-later", {
            title: "BlockedBulk",
            handle: "blocked-bulk",
          }),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.outcome).toBe("blocked");
      const facts = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(facts.rowCount).toBe(0);
      const inflight = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-fs-active-later'`,
      );
      expect(inflight.rows[0].lifecycleState).toBe("ACTIVE");
    });
  });

  it("blocks full-sync first insert while an ACTIVE earlier direct remains unexpired", async () => {
    const gid = "gid://shopify/Product/fs-active-earlier";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-active-earlier",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const fence = req + 10n;
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, fence, "epoch-active-earlier", {
            title: "BlockedEarlier",
            handle: "blocked-earlier",
          }),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.outcome).toBe("blocked");
      const facts = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(facts.rowCount).toBe(0);
      const inflight = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-fs-active-earlier'`,
      );
      expect(inflight.rows[0].lifecycleState).toBe("ACTIVE");
    });
  });

  it("durably abandons an expired ACTIVE direct in the same full-sync transaction and rolls back with it", async () => {
    const gid = "gid://shopify/Product/fs-expired-abandon";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-expired",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req,
        leaseMs: 1,
      });
    });
    await withTenant(async (client) => {
      await client.query("SELECT pg_sleep(0.05)");
    });

    await withTenant(async (client, db) => {
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, 3n, "epoch-expired", {
            title: "AfterExpiry",
            handle: "after-expiry",
          }),
        ],
      });
      expect(bulk.abandonedBlockerTokens).toContain("obs-fs-expired");
      expect(bulk.results[0]?.existenceMutated).toBe(true);
      const inflight = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-fs-expired'`,
      );
      expect(inflight.rows[0].lifecycleState).toBe("ABANDONED");
    });

    const gidRb = "gid://shopify/Product/fs-expired-rollback";
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      const db = asQueryRaw(runtime);
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(runtime, {
        id: "obs-fs-expired-rb",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gidRb,
        requestGen: req,
        leaseMs: 1,
      });
      await runtime.query("COMMIT");
      await runtime.query("SELECT pg_sleep(0.05)");

      await runtime.query("BEGIN");
      await setTenant(runtime, shopAId);
      await applyCanonicalFacts(asQueryRaw(runtime), {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gidRb, 3n, "epoch-expired-rb", {
            title: "ShouldRollBack",
            handle: "should-rollback",
          }),
        ],
      });
      const mid = await runtime.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-fs-expired-rb'`,
      );
      expect(mid.rows[0].lifecycleState).toBe("ABANDONED");
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.query("ROLLBACK").catch(() => undefined);
      await runtime.end();
    }

    await withTenant(async (client) => {
      const inflight = await client.query(
        `SELECT "lifecycleState" FROM "CatalogObservationInFlight" WHERE id = 'obs-fs-expired-rb'`,
      );
      expect(inflight.rows[0].lifecycleState).toBe("ACTIVE");
      const facts = await client.query(
        `SELECT 1 FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gidRb],
      );
      expect(facts.rowCount).toBe(0);
    });
  });

  it("advances lastSeenFullSyncRunId on existing LIVE without letting stale bulk attributes win", async () => {
    const gid = "gid://shopify/Product/fs-keep-live";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-keep-live",
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
          productLive(shopAId, "obs-fs-keep-live", gid, req, resp, {
            title: "DirectNew",
            handle: "direct-new",
            updatedAt: new Date("2026-08-10T00:00:00.000Z"),
          }),
        ],
      });
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, 1n, "epoch-keep-live", {
            title: "StaleBulk",
            handle: "stale-bulk",
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          }),
        ],
      });
      expect(bulk.results[0]?.presenceUpdated).toBe(true);
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.attributesApplied).toBe(false);
      const rows = await client.query(
        `SELECT title, "existenceKind", "existenceRequestGen", "existenceResponseGen", "lastSeenFullSyncRunId"
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rows[0].title).toBe("DirectNew");
      expect(rows.rows[0].existenceKind).toBe("LIVE_REFETCH");
      expect(String(rows.rows[0].existenceRequestGen)).toBe(req.toString());
      expect(String(rows.rows[0].existenceResponseGen)).toBe(resp.toString());
      expect(rows.rows[0].lastSeenFullSyncRunId).toBe("epoch-keep-live");
    });
  });

  it("records terminal revival conflict for full-sync presence after a Product tombstone", async () => {
    const gid = "gid://shopify/Product/fs-terminal";
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-term-live",
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
          productLive(shopAId, "obs-fs-term-live", gid, req1, resp1, {
            title: "Doomed",
            handle: "doomed",
          }),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-term-abs",
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: gid,
        requestGen: req2,
        leaseMs: 60_000,
      });
      const resp2 = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [productAbsent(shopAId, "obs-fs-term-abs", gid, req2, resp2)],
      });
      const fence = resp2 + 5n;
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, fence, "epoch-terminal", {
            title: "ReviveBulk",
            handle: "revive-bulk",
          }),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.outcome).toBe("conflict");
      expect(bulk.results[0]?.diagnosticState).toBe("TERMINAL_IDENTITY_REVIVAL_CONFLICT");
      const rows = await client.query(
        `SELECT "existenceState", "existenceKind" FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rows[0].existenceState).toBe("ABSENT");
      expect(rows.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
    });
  });

  it("does not let an older full-sync null-version title overwrite a newer direct interval", async () => {
    const gid = "gid://shopify/Product/fs-null-attr";
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-null-attr",
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
          productLive(shopAId, "obs-fs-null-attr", gid, req, resp, {
            title: "DirectNull",
            handle: "direct-null",
            updatedAt: null,
          }),
        ],
      });
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          productFullSync(shopAId, gid, 1n, "epoch-null-attr", {
            title: "BulkNull",
            handle: "bulk-null",
            updatedAt: null,
          }),
        ],
      });
      expect(bulk.results[0]?.presenceUpdated).toBe(true);
      expect(bulk.results[0]?.attributesApplied).toBe(false);
      const rows = await client.query(
        `SELECT title, "attributeFreshnessState", "lastSeenFullSyncRunId"
         FROM "ShopifyProductFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      expect(rows.rows[0].title).toBe("DirectNull");
      expect(rows.rows[0].lastSeenFullSyncRunId).toBe("epoch-null-attr");
    });
  });

  it("blocks older full-sync InventoryLevel reconnect when newer direct evidence exists", async () => {
    const productGid = "gid://shopify/Product/fs-rc-block-p";
    const variantGid = "gid://shopify/ProductVariant/fs-rc-block-v";
    const itemGid = "gid://shopify/InventoryItem/fs-rc-block-i";
    const locGid = "gid://shopify/Location/fs-rc-block-l";
    await withTenant(async (client, db) => {
      await seedCatalogParents(client, db, shopAId, {
        prefix: "obs-fs-rc-block",
        productGid,
        variantGid,
        itemGid,
        locGid,
      });
      const reqLive = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-rc-block-live",
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
            ...levelLive(shopAId, "obs-fs-rc-block-live", itemGid, locGid, reqLive, respLive),
            attributes: { isActive: true },
          },
        ],
      });
      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-rc-block-abs",
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
          resourceAbsent(
            shopAId,
            "obs-fs-rc-block-abs",
            {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            reqAbs,
            respAbs,
          ),
        ],
      });
      const fence = await allocateCatalogObservationGeneration(db);
      expect(fence > respAbs).toBe(true);
      const reqLater = await allocateCatalogObservationGeneration(db);
      expect(reqLater > fence).toBe(true);
      await insertObservation(client, {
        id: "obs-fs-rc-block-later",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: reqLater,
        leaseMs: 60_000,
      });
      const respLater = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          resourceAbsent(
            shopAId,
            "obs-fs-rc-block-later",
            {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            reqLater,
            respLater,
          ),
        ],
      });
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          levelFullSync(shopAId, itemGid, locGid, fence, "epoch-rc-block"),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(false);
      expect(bulk.results[0]?.outcome).toBe("conflict");
      const rows = await client.query(
        `SELECT "existenceState" FROM "ShopifyInventoryLevelFact"
         WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
        [itemGid, locGid],
      );
      expect(rows.rows[0].existenceState).toBe("ABSENT");
    });
  });

  it("reconnects InventoryLevel from a later full-sync fence when directs are safely earlier", async () => {
    const productGid = "gid://shopify/Product/fs-rc-ok-p";
    const variantGid = "gid://shopify/ProductVariant/fs-rc-ok-v";
    const itemGid = "gid://shopify/InventoryItem/fs-rc-ok-i";
    const locGid = "gid://shopify/Location/fs-rc-ok-l";
    await withTenant(async (client, db) => {
      await seedCatalogParents(client, db, shopAId, {
        prefix: "obs-fs-rc-ok",
        productGid,
        variantGid,
        itemGid,
        locGid,
      });
      const reqLive = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-rc-ok-live",
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
            ...levelLive(shopAId, "obs-fs-rc-ok-live", itemGid, locGid, reqLive, respLive),
            attributes: { isActive: true },
          },
        ],
      });
      const reqAbs = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-rc-ok-abs",
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
          resourceAbsent(
            shopAId,
            "obs-fs-rc-ok-abs",
            {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            reqAbs,
            respAbs,
          ),
        ],
      });
      const fence = respAbs + 5n;
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          levelFullSync(shopAId, itemGid, locGid, fence, "epoch-rc-ok"),
        ],
      });
      expect(bulk.results[0]?.existenceMutated).toBe(true);
      const rows = await client.query(
        `SELECT "existenceState", "existenceKind", "existenceRequestGen", "existenceResponseGen"
         FROM "ShopifyInventoryLevelFact"
         WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
        [itemGid, locGid],
      );
      expect(rows.rows[0].existenceState).toBe("LIVE");
      expect(rows.rows[0].existenceKind).toBe("LIVE_FULL_SYNC_PRESENT");
      expect(rows.rows[0].existenceRequestGen).toBeNull();
      expect(rows.rows[0].existenceResponseGen).toBeNull();
    });
  });

  it("does not let an older full-sync null-version quantity overwrite a newer direct interval", async () => {
    const productGid = "gid://shopify/Product/fs-null-qty-p";
    const variantGid = "gid://shopify/ProductVariant/fs-null-qty-v";
    const itemGid = "gid://shopify/InventoryItem/fs-null-qty-i";
    const locGid = "gid://shopify/Location/fs-null-qty-l";
    await withTenant(async (client, db) => {
      await seedCatalogParents(client, db, shopAId, {
        prefix: "obs-fs-null-qty",
        productGid,
        variantGid,
        itemGid,
        locGid,
      });
      const req = await allocateCatalogObservationGeneration(db);
      await insertObservation(client, {
        id: "obs-fs-null-qty-live",
        shopId: shopAId,
        resourceKind: "InventoryLevel",
        inventoryItemGid: itemGid,
        locationGid: locGid,
        requestGen: req,
        leaseMs: 60_000,
      });
      const resp = await allocateCatalogObservationGeneration(db);
      await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "direct",
            observationToken: "obs-fs-null-qty-live",
            observationRequestGen: req,
            observationResponseGen: resp,
            identity: {
              shopId: shopAId,
              resourceKind: "InventoryLevel",
              inventoryItemGid: itemGid,
              locationGid: locGid,
            },
            existenceKind: "LIVE_REFETCH",
            existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
            sourceKind: "INCREMENTAL_REFETCH",
            attributes: {
              isActive: true,
              quantities: [{ name: "available", quantity: 9, shopifyUpdatedAt: null }],
            },
          },
        ],
      });
      const bulk = await applyCanonicalFacts(db, {
        shopId: shopAId,
        observations: [
          levelFullSync(shopAId, itemGid, locGid, 1n, "epoch-null-qty", {
            quantities: [{ name: "available", quantity: 1, shopifyUpdatedAt: null }],
          }),
        ],
      });
      expect(bulk.results[0]?.presenceUpdated).toBe(true);
      expect(bulk.results[0]?.attributesApplied).toBe(false);
      const rows = await client.query(
        `SELECT "availableQuantity", "lastSeenFullSyncRunId"
         FROM "ShopifyInventoryLevelFact"
         WHERE "inventoryItemGid" = $1 AND "locationGid" = $2`,
        [itemGid, locGid],
      );
      expect(rows.rows[0].availableQuantity).toBe(9);
      expect(rows.rows[0].lastSeenFullSyncRunId).toBe("epoch-null-qty");
    });
  });
});
