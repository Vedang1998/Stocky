/**
 * A job that meets another job's still-open observation of the same order
 * waits and comes back. The import leaves that order for a later pass and
 * imports the rest of the file; a webhook job is retried. Neither records
 * the wait as a failure.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { runOrderFactsSyncJob } from "../../../app/jobs/workers/order-facts/sync-jobs";
import { asApplyDb } from "../../../app/lib/order-facts/sync/apply-composition";
import {
  ORDER_FACTS_HEALTH_DOMAIN,
  ORDER_FACTS_OBSERVATION_WAIT_REASON,
  ORDER_FACTS_OBSERVATION_WAIT_RETRY_MS,
} from "../../../app/lib/order-facts/sync/constants";
import { processOrderFactsWebhookJob } from "../../../app/lib/order-facts/sync";
import { runOrderFactsImportStep } from "../../../app/lib/order-facts/sync/import";
import {
  abandonActiveObservation,
  beginDirectOrderObservation,
  type DirectOrderObservationHandle,
} from "../../../app/lib/order-facts/sync/observations";
import {
  getControlPlanePrisma,
  resetControlPlanePrismaForTests,
} from "../../../app/sync/control-plane-db.server";
import {
  SHOP_A_DOMAIN,
  bulkARoot,
  countForShop,
  createOrderFactsAdmin,
  inWindowHeader,
  jsonlLines,
  setupPr6DDatabase,
  standardStore,
  webhookWork,
  withTxnHost,
} from "./pr6-d-pg-harness";

describe("order jobs that meet another job's open read of the same order", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    ({ prisma, shopAId } = await setupPr6DDatabase());
  }, 600_000);

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  function factCount(gid: string): Promise<number> {
    return countForShop(
      shopAId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
  }

  function activeObservationCount(gid: string): Promise<number> {
    return countForShop(
      shopAId,
      `SELECT count(*)::int AS n FROM "OrderFactObservationInFlight"
       WHERE "shopifyGid" = $1 AND "lifecycleState" = 'ACTIVE'`,
      [gid],
    );
  }

  /** Opens the observation row a webhook job opens before it reads Shopify. */
  function openWebhookObservation(
    gid: string,
  ): Promise<DirectOrderObservationHandle> {
    return withTxnHost(shopAId, (db) =>
      db.$transaction((tx) =>
        beginDirectOrderObservation(asApplyDb(tx), {
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
        }),
      ),
    );
  }

  function endWebhookObservation(
    handle: DirectOrderObservationHandle,
  ): Promise<void> {
    return withTxnHost(shopAId, (db) =>
      db.$transaction((tx) =>
        abandonActiveObservation(asApplyDb(tx), {
          shopId: shopAId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode: "test_webhook_finished",
        }),
      ),
    );
  }

  function runImport(input: {
    key: string;
    admin: ReturnType<typeof createOrderFactsAdmin>;
    roots: Record<string, unknown>[];
    parentTransportMaxRequests?: number;
  }) {
    return withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: input.admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: input.key,
        correlationId: input.key,
        jsonlSource: jsonlLines(input.roots),
        pollBulkOperation: false,
        expectedObjectCount: String(input.roots.length),
        expectedRootObjectCount: String(input.roots.length),
        parentTransportMaxRequests: input.parentTransportMaxRequests,
      }),
    );
  }

  function latestIssue() {
    return getControlPlanePrisma().dataIssue.findFirst({
      where: { shopId: shopAId },
      orderBy: { createdAt: "desc" },
    });
  }

  function latestRun(key: string) {
    return getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: key },
      orderBy: { createdAt: "desc" },
    });
  }

  function issueCount(): Promise<number> {
    return getControlPlanePrisma().dataIssue.count({
      where: { shopId: shopAId },
    });
  }

  function orderHealth() {
    return getControlPlanePrisma().syncHealth.findUnique({
      where: {
        shopId_syncDomain: {
          shopId: shopAId,
          syncDomain: ORDER_FACTS_HEALTH_DOMAIN,
        },
      },
    });
  }

  it("imports the other orders, records no failure, and finishes on the next pass", async () => {
    const key = "import-wait-two-orders";
    const busyGid = "gid://shopify/Order/wait-busy";
    const quietGid = "gid://shopify/Order/wait-quiet";
    const admin = createOrderFactsAdmin({
      stores: {
        [busyGid]: standardStore(busyGid),
        [quietGid]: standardStore(quietGid),
      },
    });
    const roots = [
      bulkARoot(busyGid, { currentSubtotalLineItemsQuantity: 0 }),
      bulkARoot(quietGid, { currentSubtotalLineItemsQuantity: 0 }),
    ];
    const issuesBefore = await issueCount();
    const webhook = await openWebhookObservation(busyGid);

    const waiting = await runImport({ key, admin, roots });

    expect(waiting, JSON.stringify(waiting)).toEqual({
      status: "CONTINUE",
      backoffMs: ORDER_FACTS_OBSERVATION_WAIT_RETRY_MS,
      reason: ORDER_FACTS_OBSERVATION_WAIT_REASON,
    });
    expect(await factCount(busyGid)).toBe(0);
    expect(await factCount(quietGid)).toBe(1);
    expect(await issueCount()).toBe(issuesBefore);
    const runWhileWaiting = await latestRun(key);
    expect(runWhileWaiting?.status).not.toBe("PARTIAL_FAILURE");
    expect(runWhileWaiting?.errorCode).toBeNull();
    expect(runWhileWaiting?.completedAt).toBeNull();
    expect((await orderHealth())?.state).not.toBe("DEGRADED");

    await endWebhookObservation(webhook);
    const finished = await runImport({ key, admin, roots });

    expect(finished.status, JSON.stringify(finished)).toBe("SUCCEEDED");
    if (finished.status !== "SUCCEEDED") return;
    expect(finished.verifiedReplayApplies).toBe(1);
    expect(finished.bulkDirectApplies).toBe(1);
    expect(await factCount(busyGid)).toBe(1);
    expect(await factCount(quietGid)).toBe(1);
    expect(await issueCount()).toBe(issuesBefore);
    const runAfter = await latestRun(key);
    expect(runAfter?.id).toBe(runWhileWaiting?.id);
    expect(runAfter?.status).toBe("SUCCEEDED");
    expect((await orderHealth())?.state).toBe("HEALTHY");
  });

  it("waits the same way when the import re-reads a changed order itself", async () => {
    const key = "import-wait-fallback";
    const gid = "gid://shopify/Order/wait-fallback";
    const admin = createOrderFactsAdmin({
      stores: { [gid]: standardStore(gid) },
    });
    // An export line older than the order in Shopify sends the import to its
    // own direct read of the order.
    const roots = [
      bulkARoot(gid, {
        currentSubtotalLineItemsQuantity: 0,
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    ];
    const issuesBefore = await issueCount();
    const webhook = await openWebhookObservation(gid);

    const waiting = await runImport({ key, admin, roots });

    expect(waiting, JSON.stringify(waiting)).toEqual({
      status: "CONTINUE",
      backoffMs: ORDER_FACTS_OBSERVATION_WAIT_RETRY_MS,
      reason: ORDER_FACTS_OBSERVATION_WAIT_REASON,
    });
    expect(
      admin.calls.some((call) => call.name === "OrderFactById"),
    ).toBe(true);
    expect(await factCount(gid)).toBe(0);
    expect(await issueCount()).toBe(issuesBefore);
    // Only the webhook job's observation is still open; the import closed its own.
    expect(await activeObservationCount(gid)).toBe(1);

    await endWebhookObservation(webhook);
    const finished = await runImport({ key, admin, roots });

    expect(finished.status, JSON.stringify(finished)).toBe("SUCCEEDED");
    if (finished.status !== "SUCCEEDED") return;
    expect(finished.fallbackOrders).toBe(1);
    expect(await factCount(gid)).toBe(1);
    expect(await activeObservationCount(gid)).toBe(0);
    expect(await issueCount()).toBe(issuesBefore);
  });

  it("still reports a partial failure when another order in the pass is really incomplete", async () => {
    const key = "import-wait-with-incomplete";
    const busyGid = "gid://shopify/Order/wait-mixed-busy";
    const changedGid = "gid://shopify/Order/wait-mixed-changed";
    const admin = createOrderFactsAdmin({
      stores: {
        [busyGid]: standardStore(busyGid),
        [changedGid]: standardStore(changedGid),
      },
    });
    const roots = [
      bulkARoot(busyGid, { currentSubtotalLineItemsQuantity: 0 }),
      // Changed since the export, and one Shopify request per order leaves
      // nothing for the re-read: this order is incomplete, not waiting.
      bulkARoot(changedGid, {
        currentSubtotalLineItemsQuantity: 0,
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    ];
    const issuesBefore = await issueCount();
    const webhook = await openWebhookObservation(busyGid);

    const result = await runImport({
      key,
      admin,
      roots,
      parentTransportMaxRequests: 1,
    });

    expect(result, JSON.stringify(result)).toEqual({
      status: "PARTIAL_FAILURE",
      reason: "import_incomplete",
    });
    expect(await factCount(busyGid)).toBe(0);
    expect(await factCount(changedGid)).toBe(0);
    expect(await issueCount()).toBe(issuesBefore + 1);
    expect((await latestIssue())?.reasonCode).toBe("ORDER_FACTS_IMPORT_PARTIAL");
    expect((await latestRun(key))?.status).toBe("PARTIAL_FAILURE");
    await endWebhookObservation(webhook);
  });

  it("still stops the pass and records the failure when an order cannot be applied for another reason", async () => {
    const key = "import-wait-with-error";
    const busyGid = "gid://shopify/Order/wait-error-busy";
    const brokenGid = "gid://shopify/Order/wait-error-broken";
    const admin = createOrderFactsAdmin({
      stores: {
        [busyGid]: standardStore(busyGid),
        [brokenGid]: standardStore(brokenGid),
      },
    });
    const brokenRoot = bulkARoot(brokenGid, {
      currentSubtotalLineItemsQuantity: 0,
    });
    delete brokenRoot.confirmed;
    const roots = [
      bulkARoot(busyGid, { currentSubtotalLineItemsQuantity: 0 }),
      brokenRoot,
    ];
    const issuesBefore = await issueCount();
    const webhook = await openWebhookObservation(busyGid);

    const result = await runImport({ key, admin, roots });

    expect(result, JSON.stringify(result)).toEqual({
      status: "PARTIAL_FAILURE",
      reason: "confirmed omitted from selected Bulk A projection",
    });
    expect(await issueCount()).toBe(issuesBefore + 1);
    expect((await latestRun(key))?.status).toBe("PARTIAL_FAILURE");
    await endWebhookObservation(webhook);
  });

  it("hands the wait to the worker as a continuation, not a partial failure", async () => {
    const key = "import-wait-worker";
    const gid = "gid://shopify/Order/wait-worker";
    const admin = createOrderFactsAdmin({
      stores: { [gid]: standardStore(gid) },
    });
    const runJob = () =>
      withTxnHost(shopAId, (db) =>
        runOrderFactsSyncJob({
          authority: {
            shopId: shopAId,
            myshopifyDomain: SHOP_A_DOMAIN,
            source: "verified_job",
            correlationId: key,
          },
          admin,
          db,
          durableJobId: key,
          correlationId: key,
          payload: {
            pollBulkOperation: false,
            expectedObjectCount: "1",
            expectedRootObjectCount: "1",
          },
          jsonlSource: jsonlLines([
            bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
        }),
      );
    const webhook = await openWebhookObservation(gid);

    expect(await runJob()).toEqual({
      status: "CONTINUE",
      backoffMs: ORDER_FACTS_OBSERVATION_WAIT_RETRY_MS,
      reason: ORDER_FACTS_OBSERVATION_WAIT_REASON,
    });

    await endWebhookObservation(webhook);
    expect(await runJob()).toEqual({ status: "SUCCEEDED" });
    expect(await factCount(gid)).toBe(1);
  });

  it("asks for a retry of a webhook job that meets another job's open read, and closes its own", async () => {
    const gid = "gid://shopify/Order/wait-webhook-held";
    const now = new Date().toISOString();
    const admin = createOrderFactsAdmin({
      stores: {
        [gid]: standardStore(gid, {
          header: inWindowHeader({
            id: gid,
            createdAt: now,
            updatedAt: now,
            processedAt: now,
          }),
        }),
      },
    });
    const work = webhookWork({
      shopId: shopAId,
      topic: "orders/edited",
      projection: { order_edit: { id: 1, order_id: "wait-webhook-held" } },
      receivedAt: new Date(),
    });
    const runWebhook = () =>
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin,
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work,
        }),
      );
    const earlier = await openWebhookObservation(gid);

    const held = await runWebhook();

    expect(held).toEqual({
      status: "incomplete",
      reason: ORDER_FACTS_OBSERVATION_WAIT_REASON,
      orderGid: gid,
      refundGid: null,
    });
    expect(await factCount(gid)).toBe(0);
    expect(await activeObservationCount(gid)).toBe(1);

    await endWebhookObservation(earlier);
    const retried = await runWebhook();

    expect(retried.status, JSON.stringify(retried)).toBe("applied");
    expect(await factCount(gid)).toBe(1);
    expect(await activeObservationCount(gid)).toBe(0);
  });

  it("stores an order exactly once when a webhook job writes it before the import returns to it", async () => {
    const key = "import-wait-webhook-wins";
    const gid = "gid://shopify/Order/wait-webhook-wins";
    const now = new Date().toISOString();
    const admin = createOrderFactsAdmin({
      stores: {
        [gid]: standardStore(gid, {
          header: inWindowHeader({
            id: gid,
            createdAt: now,
            updatedAt: now,
            processedAt: now,
          }),
        }),
      },
    });
    const roots = [
      bulkARoot(gid, {
        currentSubtotalLineItemsQuantity: 0,
        createdAt: now,
        updatedAt: now,
        processedAt: now,
      }),
    ];
    const webhook = await openWebhookObservation(gid);
    const waiting = await runImport({ key, admin, roots });
    expect(waiting.status, JSON.stringify(waiting)).toBe("CONTINUE");
    expect(await factCount(gid)).toBe(0);
    await endWebhookObservation(webhook);

    const edited = await withTxnHost(shopAId, (db) =>
      processOrderFactsWebhookJob({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        work: webhookWork({
          shopId: shopAId,
          topic: "orders/edited",
          projection: {
            order_edit: { id: 1, order_id: "wait-webhook-wins" },
          },
          receivedAt: new Date(),
        }),
      }),
    );
    expect(edited.status, JSON.stringify(edited)).toBe("applied");
    expect(await factCount(gid)).toBe(1);

    const finished = await runImport({ key, admin, roots });

    expect(finished.status, JSON.stringify(finished)).toBe("SUCCEEDED");
    expect(await factCount(gid)).toBe(1);
  });
});
