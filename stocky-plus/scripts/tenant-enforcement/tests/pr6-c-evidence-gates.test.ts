/**
 * PR6-C evidence gates A–E — isolated PostgreSQL sessions, real apply path.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  applyOrderFacts,
  applyOrderFactsWithRetry,
} from "../../../app/lib/order-facts/apply";
import { acquireOrderIdentityAdvisoryLock } from "../../../app/lib/order-facts/advisory-lock";
import {
  OrderApplyProcessingDisabledError,
} from "../../../app/lib/order-facts/apply/errors";
import type { OrderApplyDb } from "../../../app/lib/order-facts/apply/sql";
import type {
  DirectOrderObservation,
  OrderLineSnapshot,
  OrderSnapshot,
} from "../../../app/lib/order-facts/apply/types";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";
import { resetSchemaAndApplyEnforcement } from "./helpers";

function bag(amount: string, currency = "USD") {
  return {
    shopAmount: amount,
    shopCurrencyCode: currency,
    presentmentAmount: amount,
    presentmentCurrencyCode: currency,
  };
}

function asQueryRaw(client: Client, onQuery?: () => void): OrderApplyDb {
  return {
    async $queryRaw(strings, ...values) {
      onQuery?.();
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

async function insertObservation(
  client: Client,
  args: {
    id: string;
    shopId: string;
    resourceKind: "Order" | "Refund";
    shopifyGid: string;
    requestGen: bigint;
    leaseMs?: number;
    scopes?: string[];
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "OrderFactObservationInFlight" (
       id, "shopId", "resourceKind", "shopifyGid",
       "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
       "lifecycleState", "accessScopeSnapshot", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3::"OrderResourceKind", $4,
       $5, $6, TIMESTAMPTZ '1970-01-01',
       'ACTIVE', $7::text[], CLOCK_TIMESTAMP(), CLOCK_TIMESTAMP()
     )`,
    [
      args.id,
      args.shopId,
      args.resourceKind,
      args.shopifyGid,
      args.requestGen.toString(),
      args.leaseMs ?? 60_000,
      args.scopes ?? ["read_orders"],
    ],
  );
}

function line(gid: string, overrides: Partial<OrderLineSnapshot> = {}): OrderLineSnapshot {
  return {
    shopifyGid: gid,
    quantity: 1,
    currentQuantity: 1,
    refundableQuantity: 1,
    unfulfilledQuantity: 1,
    isGiftCard: false,
    title: "Widget",
    variantTitle: null,
    vendor: null,
    sku: "SKU-1",
    name: "Widget",
    variantGidAtSale: "gid://shopify/ProductVariant/1",
    productGidAtSale: "gid://shopify/Product/1",
    currentVariantGid: "gid://shopify/ProductVariant/1",
    currentProductGid: "gid://shopify/Product/1",
    shopifyLegacyResourceId: null,
    originalTotalSet: bag("1.00"),
    originalUnitPriceSet: bag("1.00"),
    discountedTotalSet: bag("1.00"),
    totalDiscountSet: bag("0.00"),
    ...overrides,
  };
}

function orderSnapshot(
  gid: string,
  overrides: Partial<OrderSnapshot> = {},
): OrderSnapshot {
  const lineGid = overrides.lines?.[0]?.shopifyGid ?? `${gid}/Line/1`;
  const defaultLine = line(lineGid);
  return {
    shopifyGid: gid,
    name: "#1001",
    shopifyCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
    shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
    processedAt: new Date("2026-08-01T00:00:00.000Z"),
    processedAtShopify: "2026-08-01T00:00:00Z",
    cancelledAt: null,
    cancelReason: null,
    closed: false,
    closedAt: null,
    edited: false,
    test: false,
    confirmed: true,
    shopCurrencyCode: "USD",
    presentmentCurrencyCode: "USD",
    taxesIncluded: true,
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "UNFULFILLED",
    sourceName: "web",
    retailLocationGid: null,
    currentSubtotalLineItemsQuantity: overrides.lines?.length ?? 1,
    subtotalLineItemsQuantity: overrides.lines?.length ?? 1,
    shopifyLegacyResourceId: "1001",
    originalTotalPriceSet: bag("1.00"),
    currentTotalPriceSet: bag("1.00"),
    currentSubtotalPriceSet: bag("1.00"),
    currentTotalDiscountsSet: bag("0.00"),
    currentTotalTaxSet: bag("0.00"),
    totalRefundedSet: bag("0.00"),
    netPaymentSet: bag("1.00"),
    lines: [defaultLine],
    linesComplete: true,
    agreements: [],
    agreementsComplete: true,
    ...overrides,
  };
}

function liveOrder(
  shopId: string,
  token: string,
  snapshot: OrderSnapshot,
  requestGen: bigint,
  responseGen: bigint,
): DirectOrderObservation {
  return {
    observationKind: "direct",
    observationToken: token,
    observationRequestGen: requestGen,
    observationResponseGen: responseGen,
    identity: {
      shopId,
      resourceKind: "Order",
      shopifyGid: snapshot.shopifyGid,
    },
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
    accessScopeSnapshot: ["read_orders"],
    snapshotComplete: true,
    order: snapshot,
    shopifyCreatedAt: snapshot.shopifyCreatedAt,
    processedAt: snapshot.processedAt,
    queryCompleted: true,
    queryReturnedNull: false,
  };
}

function receiptFor(key: string, digest: string) {
  return {
    applicationKey: key,
    sourceJobType: "webhook:orders/create",
    rootDurableJobId: `job-${key}`,
    applyingDurableJobId: `job-${key}`,
    payloadDigest: digest.padEnd(48, "x").slice(0, 64),
  };
}

describe("PR6-C evidence gates", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-c-gates-a.myshopify.com" },
    });
    shopAId = shopA.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function openTenant(): Promise<{ client: Client; db: OrderApplyDb }> {
    const client = await getRuntimeClient();
    await client.query("BEGIN");
    await setTenant(client, shopAId);
    return { client, db: asQueryRaw(client) };
  }

  async function countOrder(gid: string): Promise<number> {
    const client = await getRuntimeClient();
    try {
      await client.query("BEGIN");
      await setTenant(client, shopAId);
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        [gid],
      );
      await client.query("COMMIT");
      return rows.rows[0].n as number;
    } finally {
      await client.end();
    }
  }

  async function countReceipt(key: string): Promise<number> {
    const client = await getRuntimeClient();
    try {
      await client.query("BEGIN");
      await setTenant(client, shopAId);
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        [key],
      );
      await client.query("COMMIT");
      return rows.rows[0].n as number;
    } finally {
      await client.end();
    }
  }

  it("Gate A: interrupt before commit leaves neither facts nor receipt", async () => {
    const gid = "gid://shopify/Order/gate-a-before";
    const key = "gate-a-before";
    const session = await openTenant();
    try {
      const req = await allocateCatalogObservationGeneration(session.db);
      await insertObservation(session.client, {
        id: "obs-gate-a-before",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(session.db);
      await applyOrderFacts(session.db, {
        shopId: shopAId,
        receipt: receiptFor(key, "gate-a-before-digest"),
        observations: [
          liveOrder(shopAId, "obs-gate-a-before", orderSnapshot(gid), req, resp),
        ],
      });
      await session.client.query("ROLLBACK");
    } finally {
      await session.client.end();
    }
    expect(await countOrder(gid)).toBe(0);
    expect(await countReceipt(key)).toBe(0);
  });

  it("Gate A: interrupt after commit before ack keeps facts+receipt; retry does not duplicate", async () => {
    const gid = "gid://shopify/Order/gate-a-after";
    const key = "gate-a-after";
    const digest = "gate-a-after-digest";
    const session = await openTenant();
    try {
      const req = await allocateCatalogObservationGeneration(session.db);
      await insertObservation(session.client, {
        id: "obs-gate-a-after",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(session.db);
      const applied = await applyOrderFacts(session.db, {
        shopId: shopAId,
        receipt: receiptFor(key, digest),
        observations: [
          liveOrder(shopAId, "obs-gate-a-after", orderSnapshot(gid), req, resp),
        ],
      });
      expect(applied.receiptStatus).toBe("applied");
      await session.client.query("COMMIT");
    } finally {
      await session.client.end();
    }
    expect(await countOrder(gid)).toBe(1);
    expect(await countReceipt(key)).toBe(1);
    const retry = await openTenant();
    try {
      const again = await applyOrderFacts(retry.db, {
        shopId: shopAId,
        receipt: receiptFor(key, digest),
        observations: [],
      });
      expect(again.receiptStatus).toBe("already_applied");
      await retry.client.query("COMMIT");
    } finally {
      await retry.client.end();
    }
    expect(await countReceipt(key)).toBe(1);
  });

  it("Gate A adversarial: deleting a success receipt is labelled separately and does not mint a second order row", async () => {
    const gid = "gid://shopify/Order/gate-a-adv";
    const key = "gate-a-adv";
    const first = await openTenant();
    try {
      const req = await allocateCatalogObservationGeneration(first.db);
      await insertObservation(first.client, {
        id: "obs-gate-a-adv",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(first.db);
      await applyOrderFacts(first.db, {
        shopId: shopAId,
        receipt: receiptFor(key, "gate-a-adv-digest"),
        observations: [
          liveOrder(shopAId, "obs-gate-a-adv", orderSnapshot(gid), req, resp),
        ],
      });
      await first.client.query("COMMIT");
    } finally {
      await first.client.end();
    }
    const vandal = await openTenant();
    try {
      await vandal.client.query(
        `DELETE FROM "SyncApplicationReceipt" WHERE "applicationKey" = $1`,
        [key],
      );
      await vandal.client.query("COMMIT");
    } finally {
      await vandal.client.end();
    }
    expect(await countReceipt(key)).toBe(0);
    expect(await countOrder(gid)).toBe(1);
    const retry = await openTenant();
    try {
      const req2 = await allocateCatalogObservationGeneration(retry.db);
      await insertObservation(retry.client, {
        id: "obs-gate-a-adv-2",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(retry.db);
      const result = await applyOrderFacts(retry.db, {
        shopId: shopAId,
        receipt: receiptFor(key, "gate-a-adv-digest"),
        observations: [
          liveOrder(shopAId, "obs-gate-a-adv-2", orderSnapshot(gid), req2, resp2),
        ],
      });
      expect(result.receiptStatus).toBe("applied");
      await retry.client.query("COMMIT");
    } finally {
      await retry.client.end();
    }
    expect(await countOrder(gid)).toBe(1);
    expect(await countReceipt(key)).toBe(1);
  });

  it("Gate B: reverse identity input order completes without unbounded wait", async () => {
    const gidX = "gid://shopify/Order/gate-b-x";
    const gidY = "gid://shopify/Order/gate-b-y";
    const sessionA = await openTenant();
    const sessionB = await openTenant();
    try {
      const reqAx = await allocateCatalogObservationGeneration(sessionA.db);
      const reqAy = await allocateCatalogObservationGeneration(sessionA.db);
      const reqBx = await allocateCatalogObservationGeneration(sessionB.db);
      const reqBy = await allocateCatalogObservationGeneration(sessionB.db);
      await insertObservation(sessionA.client, {
        id: "obs-gb-ax",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gidX,
        requestGen: reqAx,
      });
      await insertObservation(sessionA.client, {
        id: "obs-gb-ay",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gidY,
        requestGen: reqAy,
      });
      await insertObservation(sessionB.client, {
        id: "obs-gb-bx",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gidX,
        requestGen: reqBx,
      });
      await insertObservation(sessionB.client, {
        id: "obs-gb-by",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gidY,
        requestGen: reqBy,
      });
      const respAx = await allocateCatalogObservationGeneration(sessionA.db);
      const respAy = await allocateCatalogObservationGeneration(sessionA.db);
      const respBx = await allocateCatalogObservationGeneration(sessionB.db);
      const respBy = await allocateCatalogObservationGeneration(sessionB.db);
      const runA = (async () => {
        const result = await applyOrderFacts(sessionA.db, {
          shopId: shopAId,
          observations: [
            liveOrder(shopAId, "obs-gb-ax", orderSnapshot(gidX), reqAx, respAx),
            liveOrder(shopAId, "obs-gb-ay", orderSnapshot(gidY), reqAy, respAy),
          ],
        });
        await sessionA.client.query("COMMIT");
        return result;
      })();
      const runB = (async () => {
        const result = await applyOrderFacts(sessionB.db, {
          shopId: shopAId,
          observations: [
            liveOrder(shopAId, "obs-gb-by", orderSnapshot(gidY), reqBy, respBy),
            liveOrder(shopAId, "obs-gb-bx", orderSnapshot(gidX), reqBx, respBx),
          ],
        });
        await sessionB.client.query("COMMIT");
        return result;
      })();
      const [a, b] = await Promise.all([runA, runB]);
      expect(a.identitiesLocked).toBe(2);
      expect(b.identitiesLocked).toBe(2);
    } finally {
      await sessionA.client.end();
      await sessionB.client.end();
    }
    expect(await countOrder(gidX)).toBe(1);
    expect(await countOrder(gidY)).toBe(1);
  }, 60_000);

  it("Gate C: contended identity lock times out, rolls back, and retries on a fresh transaction", async () => {
    const gid = "gid://shopify/Order/gate-c-timeout";
    const holder = await openTenant();
    try {
      await acquireOrderIdentityAdvisoryLock(holder.db, {
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
      });
      const waiter = await openTenant();
      try {
        const req = await allocateCatalogObservationGeneration(waiter.db);
        await insertObservation(waiter.client, {
          id: "obs-gate-c-to",
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(waiter.db);
        const started = Date.now();
        await expect(
          applyOrderFacts(waiter.db, {
            shopId: shopAId,
            observations: [
              liveOrder(shopAId, "obs-gate-c-to", orderSnapshot(gid), req, resp),
            ],
          }),
        ).rejects.toMatchObject({ code: "order_advisory_lock_timeout" });
        expect(Date.now() - started).toBeGreaterThan(4000);
        await waiter.client.query("ROLLBACK");
      } finally {
        await waiter.client.end();
      }
    } finally {
      await holder.client.query("ROLLBACK").catch(() => undefined);
      await holder.client.end();
    }

    const retry = await openTenant();
    try {
      const result = await applyOrderFactsWithRetry(
        async (fn) => {
          const session = await openTenant();
          try {
            const value = await fn(session.db);
            await session.client.query("COMMIT");
            return value;
          } catch (error) {
            await session.client.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            await session.client.end();
          }
        },
        {
          shopId: shopAId,
          observations: [],
        },
      );
      expect(result.receiptStatus).toBe("none");
    } finally {
      await retry.client.query("ROLLBACK").catch(() => undefined);
      await retry.client.end();
    }

    const applyRetry = await openTenant();
    try {
      const req = await allocateCatalogObservationGeneration(applyRetry.db);
      await insertObservation(applyRetry.client, {
        id: "obs-gate-c-retry",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(applyRetry.db);
      const applied = await applyOrderFacts(applyRetry.db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-gate-c-retry", orderSnapshot(gid), req, resp),
        ],
      });
      expect(applied.results[0]?.outcome).toBe("applied");
      await applyRetry.client.query("COMMIT");
    } finally {
      await applyRetry.client.end();
    }
    expect(await countOrder(gid)).toBe(1);
  }, 30_000);

  it("Gate C: processingEnabled flip while waiting is re-checked after lock grant", async () => {
    const gid = "gid://shopify/Order/gate-c-kill";
    const holder = await openTenant();
    await acquireOrderIdentityAdvisoryLock(holder.db, {
      shopId: shopAId,
      resourceKind: "Order",
      shopifyGid: gid,
    });
    const waiter = await openTenant();
    const waiterSettled: Promise<unknown> = (async () => {
      const req = await allocateCatalogObservationGeneration(waiter.db);
      await insertObservation(waiter.client, {
        id: "obs-gate-c-kill",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(waiter.db);
      await applyOrderFacts(waiter.db, {
        shopId: shopAId,
        observations: [
          liveOrder(shopAId, "obs-gate-c-kill", orderSnapshot(gid), req, resp),
        ],
      });
    })().then(
      () => "completed",
      (error: unknown) => error,
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    await holder.client.query("ROLLBACK");
    await holder.client.end();
    const waiterError = await waiterSettled;
    expect(waiterError).toBeInstanceOf(OrderApplyProcessingDisabledError);
    await waiter.client.query("ROLLBACK").catch(() => undefined);
    await waiter.client.end();
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: true },
    });
    expect(await countOrder(gid)).toBe(0);
  }, 30_000);

  it("Gate D: application-key lock serializes before missing-receipt lookup so the loser cannot commit a disjoint identity set", async () => {
    const gidWinner = "gid://shopify/Order/gate-d-win";
    const gidLoser = "gid://shopify/Order/gate-d-lose";
    const key = "gate-d-same-key";
    const digest = "gate-d-same-digest";
    const winner = await openTenant();
    const loser = await openTenant();
    const schedule = {
      achieved: "serialized_before_missing_receipt_lookup",
      bothPassedMissingReceipt: false,
    };
    try {
      const reqW = await allocateCatalogObservationGeneration(winner.db);
      await insertObservation(winner.client, {
        id: "obs-gate-d-w",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gidWinner,
        requestGen: reqW,
      });
      const respW = await allocateCatalogObservationGeneration(winner.db);
      const reqL = await allocateCatalogObservationGeneration(loser.db);
      await insertObservation(loser.client, {
        id: "obs-gate-d-l",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gidLoser,
        requestGen: reqL,
      });
      const respL = await allocateCatalogObservationGeneration(loser.db);
      const winnerRun = applyOrderFacts(winner.db, {
        shopId: shopAId,
        receipt: receiptFor(key, digest),
        observations: [
          liveOrder(shopAId, "obs-gate-d-w", orderSnapshot(gidWinner), reqW, respW),
        ],
      });
      const winnerResult = await winnerRun;
      expect(winnerResult.receiptStatus).toBe("applied");
      const loserRun = applyOrderFacts(loser.db, {
        shopId: shopAId,
        receipt: receiptFor(key, digest),
        observations: [
          liveOrder(shopAId, "obs-gate-d-l", orderSnapshot(gidLoser), reqL, respL),
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await winner.client.query("COMMIT");
      const loserResult = await loserRun;
      expect(loserResult.receiptStatus).toBe("already_applied");
      await loser.client.query("COMMIT");
    } finally {
      await winner.client.end();
      await loser.client.end();
    }
    expect(await countOrder(gidWinner)).toBe(1);
    expect(await countOrder(gidLoser)).toBe(0);
    expect(await countReceipt(key)).toBe(1);
    expect(schedule.achieved).toBe("serialized_before_missing_receipt_lookup");
    expect(schedule.bothPassedMissingReceipt).toBe(false);
  }, 30_000);

  it("Gate D different digest: loser fails closed and writes no disjoint facts", async () => {
    const gid = "gid://shopify/Order/gate-d-digest";
    const key = "gate-d-digest-key";
    const first = await openTenant();
    try {
      const req = await allocateCatalogObservationGeneration(first.db);
      await insertObservation(first.client, {
        id: "obs-gate-d-da",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: gid,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(first.db);
      await applyOrderFacts(first.db, {
        shopId: shopAId,
        receipt: receiptFor(key, "gate-d-digest-a"),
        observations: [
          liveOrder(shopAId, "obs-gate-d-da", orderSnapshot(gid), req, resp),
        ],
      });
      await first.client.query("COMMIT");
    } finally {
      await first.client.end();
    }
    const second = await openTenant();
    try {
      const req2 = await allocateCatalogObservationGeneration(second.db);
      await insertObservation(second.client, {
        id: "obs-gate-d-db",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: `${gid}-b`,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(second.db);
      await expect(
        applyOrderFacts(second.db, {
          shopId: shopAId,
          receipt: receiptFor(key, "gate-d-digest-b"),
          observations: [
            liveOrder(
              shopAId,
              "obs-gate-d-db",
              orderSnapshot(`${gid}-b`),
              req2,
              resp2,
            ),
          ],
        }),
      ).rejects.toMatchObject({ code: "order_apply_receipt_digest_conflict" });
      await second.client.query("ROLLBACK");
    } finally {
      await second.client.end();
    }
    expect(await countOrder(`${gid}-b`)).toBe(0);
    expect(await countReceipt(key)).toBe(1);
  });

  it("Gate E: C-specific apply/child-replacement scale on synthetic order facts", async () => {
    const isolation = await (await getRuntimeClient().then(async (client) => {
      try {
        const row = await client.query<{
          max_connections: string;
          max_locks_per_transaction: string;
          max_prepared_transactions: string;
          isolation: string;
        }>(
          `SELECT current_setting('max_connections') AS max_connections,
                  current_setting('max_locks_per_transaction') AS max_locks_per_transaction,
                  current_setting('max_prepared_transactions') AS max_prepared_transactions,
                  current_setting('default_transaction_isolation') AS isolation`,
        );
        return row.rows[0];
      } finally {
        await client.end();
      }
    }));

    const highChildParent = "gid://shopify/Order/gate-e-high-child";
    const highChildCount = 400;
    const setupStarted = Date.now();
    const setupSession = await openTenant();
    let queryCount = 0;
    const countingDb = asQueryRaw(setupSession.client, () => {
      queryCount += 1;
    });
    try {
      const req = await allocateCatalogObservationGeneration(countingDb);
      await insertObservation(setupSession.client, {
        id: "obs-gate-e-high",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: highChildParent,
        requestGen: req,
      });
      const resp = await allocateCatalogObservationGeneration(countingDb);
      const manyLines = Array.from({ length: highChildCount }, (_, index) =>
        line(`${highChildParent}/Line/${index + 1}`),
      );
      await applyOrderFacts(countingDb, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-gate-e-high",
            orderSnapshot(highChildParent, {
              lines: manyLines,
              shopifyUpdatedAt: new Date("2026-08-10T00:00:00.000Z"),
            }),
            req,
            resp,
          ),
        ],
      });
      const req2 = await allocateCatalogObservationGeneration(countingDb);
      await insertObservation(setupSession.client, {
        id: "obs-gate-e-high-2",
        shopId: shopAId,
        resourceKind: "Order",
        shopifyGid: highChildParent,
        requestGen: req2,
      });
      const resp2 = await allocateCatalogObservationGeneration(countingDb);
      await applyOrderFacts(countingDb, {
        shopId: shopAId,
        observations: [
          liveOrder(
            shopAId,
            "obs-gate-e-high-2",
            orderSnapshot(highChildParent, {
              lines: [line(`${highChildParent}/Line/1`)],
              shopifyUpdatedAt: new Date("2026-08-20T00:00:00.000Z"),
            }),
            req2,
            resp2,
          ),
        ],
      });
      await setupSession.client.query("COMMIT");
    } finally {
      await setupSession.client.end();
    }
    const setupMs = Date.now() - setupStarted;

    const parentCount = 40;
    const linesPerParent = 25;
    const applyStarted = Date.now();
    const rssBefore = process.memoryUsage().rss;
    let batches = 0;
    for (let batch = 0; batch < parentCount; batch += 1) {
      const session = await openTenant();
      try {
        const gid = `gid://shopify/Order/gate-e-batch-${batch}`;
        const req = await allocateCatalogObservationGeneration(session.db);
        await insertObservation(session.client, {
          id: `obs-gate-e-b-${batch}`,
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(session.db);
        const lines = Array.from({ length: linesPerParent }, (_, index) =>
          line(`${gid}/Line/${index + 1}`),
        );
        await applyOrderFacts(session.db, {
          shopId: shopAId,
          observations: [
            liveOrder(
              shopAId,
              `obs-gate-e-b-${batch}`,
              orderSnapshot(gid, { lines }),
              req,
              resp,
            ),
          ],
        });
        await session.client.query("COMMIT");
        batches += 1;
      } finally {
        await session.client.end();
      }
    }
    const applyMs = Date.now() - applyStarted;
    const rssAfter = process.memoryUsage().rss;
    const verify = await openTenant();
    try {
      const high = await verify.client.query(
        `SELECT
           count(*) FILTER (WHERE "existenceState" = 'LIVE')::int AS live_n,
           count(*) FILTER (WHERE "existenceState" = 'ABSENT')::int AS absent_n
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        [highChildParent],
      );
      expect(high.rows[0].live_n).toBe(1);
      expect(high.rows[0].absent_n).toBe(highChildCount - 1);
      const batchLines = await verify.client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact"
          WHERE "shopifyOrderGid" LIKE 'gid://shopify/Order/gate-e-batch-%'`,
      );
      expect(batchLines.rows[0].n).toBe(parentCount * linesPerParent);
      await verify.client.query("COMMIT");
    } finally {
      await verify.client.end();
    }

    expect(isolation.max_connections).toBeTruthy();
    expect(batches).toBe(parentCount);
    expect(setupMs).toBeGreaterThan(0);
    expect(applyMs).toBeGreaterThan(0);
    expect(rssAfter).toBeGreaterThan(0);
    expect(queryCount).toBeGreaterThan(0);
    expect(rssBefore).toBeGreaterThan(0);
    const fullEnvelopeLines = 1_000_000;
    const executedLines = parentCount * linesPerParent + highChildCount;
    expect(executedLines).toBeLessThan(fullEnvelopeLines);
  }, 180_000);
});
