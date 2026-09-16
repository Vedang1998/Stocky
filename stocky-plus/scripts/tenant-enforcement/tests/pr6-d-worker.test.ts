/**
 * PR6-D real processWebhookJob / frozen-v1 legacy / two-confirmation evidence.
 * Mocks only Shopify Admin transport.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { processWebhookJob } from "../../../app/jobs/workers/webhook-processor";
import { processOrderFactsWebhookJob } from "../../../app/lib/order-facts/sync";
import { ingestAuthenticatedWebhook } from "../../../app/sync/intake.server";
import { resetControlPlanePrismaForTests } from "../../../app/sync/control-plane-db.server";
import {
  claimAttempt,
  recoverExpiredRunningAttempts,
} from "../../../app/sync/lifecycle.server";
import { resolveApplicationKey } from "../../../app/sync/execution-strategy.server";
import {
  createTenantJobEnvelopeV2,
  TENANT_JOB_ENVELOPE_V2_VERSION,
} from "../../../app/sync/envelope-v2.server";
import {
  createTenantJobEnvelopeV3,
  resolveTenantJobContextV3,
  TENANT_JOB_ENVELOPE_V3_VERSION,
} from "../../../app/sync/envelope-v3.server";
import { issueSyncDispatchAuthority } from "../../../app/tenant/sync-dispatch-authority.server";
import { formatQueueJobId } from "../../../app/sync/dispatcher.server";
import type { WebhookJobData } from "../../../app/jobs/queue.server";
import {
  transitionRetryWaitToEnqueuedForTests,
  transitionToEnqueuedForTests,
} from "../../../app/sync/__tests__/test-state-helpers";
import {
  JOB_SOURCE_BY_NAME,
  resetTenantJobEnvelopeSecretCache,
} from "../../../app/tenant/job-envelope.server";
import type { OrderStore } from "../../../app/lib/order-facts/admin-read/__tests__/order-store-admin";
import {
  SHOP_A_DOMAIN,
  countForShop,
  countSalesDailyAggregate,
  countSyncApplicationReceipts,
  createOrderFactsAdmin,
  inWindowHeader,
  setupPr6DDatabase,
  standardStore,
} from "./pr6-d-pg-harness";
import {
  moneyBag,
  refundNode,
} from "../../../app/lib/order-facts/admin-read/__tests__/fixtures";

const adminState = vi.hoisted(() => ({
  stores: {} as Record<string, OrderStore>,
  nullOrderGids: new Set<string>(),
  blockedOrderReads: new Map<string, Promise<void>>(),
  orderReadWaiting: new Set<string>(),
}));

vi.mock("../../../app/shopify.server", () => ({
  unauthenticated: {
    admin: async () => ({
      admin: {
        graphql: async (
          query: string,
          options?: { variables?: Record<string, unknown> },
        ) => {
          const requested =
            typeof options?.variables?.id === "string"
              ? options.variables.id
              : null;
          if (requested && adminState.blockedOrderReads.has(requested)) {
            adminState.orderReadWaiting.add(requested);
            try {
              await adminState.blockedOrderReads.get(requested);
            } finally {
              adminState.orderReadWaiting.delete(requested);
            }
          }
          if (requested && adminState.nullOrderGids.has(requested)) {
            return {
              json: async () => ({
                data: { order: null },
                extensions: { cost: { requestedQueryCost: 1 } },
              }),
            };
          }
          return createOrderFactsAdmin({
            stores: adminState.stores,
          }).graphql(query, options);
        },
      },
    }),
  },
}));

function fakeJob(data: WebhookJobData, id: string): Job<WebhookJobData> {
  return { id, name: data.topic, data } as unknown as Job<WebhookJobData>;
}

describe("PR6-D real processWebhookJob frozen topics", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    process.env.STOCKY_DISPATCHER_PROCESS_COUNT =
      process.env.STOCKY_DISPATCHER_PROCESS_COUNT ?? "1";
    process.env.SHOPIFY_APP_URL =
      process.env.SHOPIFY_APP_URL ?? "https://example.com";
    resetTenantJobEnvelopeSecretCache();
    ({ prisma, shopAId } = await setupPr6DDatabase());
  }, 600_000);

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    adminState.stores = {};
    adminState.nullOrderGids.clear();
    adminState.blockedOrderReads.clear();
    adminState.orderReadWaiting.clear();
  });

  async function factCount(gid: string): Promise<number> {
    return countForShop(
      shopAId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
  }

  async function ingestAndRun(input: {
    topic: "orders/create" | "orders/cancelled" | "refunds/create" | "orders/edited" | "orders/delete";
    webhookId: string;
    payload: Record<string, unknown>;
    dispatchSequence?: number;
    durableJobId?: string;
    maxAttempts?: number;
  }) {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: input.topic,
      webhookId: input.webhookId,
      apiVersion: "2026-07",
      payload: input.payload,
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(
      prisma,
      job.id,
      input.maxAttempts != null ? { maxAttempts: input.maxAttempts } : undefined,
    );
    const sequence = input.dispatchSequence ?? 1;
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: sequence,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, sequence),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: sequence },
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: `webhook:${input.topic}`,
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_V3_VERSION);
    await processWebhookJob(
      fakeJob(
        {
          topic: input.topic,
          payloadShop: SHOP_A_DOMAIN,
          payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
          tenant: envelope,
          durableJobId: job.id,
          dispatchId: dispatch.id,
          dispatchSequence: dispatch.dispatchSequence,
          queueJobId: dispatch.queueJobId,
        },
        dispatch.queueJobId,
      ),
    );
    return job;
  }

  async function continueDurableJob(
    jobId: string,
    topic: "orders/create" | "orders/cancelled" | "refunds/create" | "orders/edited" | "orders/delete",
  ) {
    await transitionRetryWaitToEnqueuedForTests(prisma, jobId);
    const job = await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } });
    const sequence = (job.activeDispatchSequence ?? 1) + 1;
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: sequence,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, sequence),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: sequence },
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: JOB_SOURCE_BY_NAME[topic],
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    await processWebhookJob(
      fakeJob(
        {
          topic,
          payloadShop: SHOP_A_DOMAIN,
          payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
          tenant: envelope,
          durableJobId: job.id,
          dispatchId: dispatch.id,
          dispatchSequence: dispatch.dispatchSequence,
          queueJobId: dispatch.queueJobId,
        },
        dispatch.queueJobId,
      ),
    );
  }

  it("applies orders/create through real v3 processWebhookJob and real legacy upsert", async () => {
    const gid = "gid://shopify/Order/d-w-create";
    adminState.stores = { [gid]: standardStore(gid) };
    const job = await ingestAndRun({
      topic: "orders/create",
      webhookId: "wh-d-w-create",
      payload: {
        id: 9101,
        admin_graphql_api_id: gid,
        line_items: [{ variant_id: 91, quantity: 2, price: "4.00" }],
      },
    });
    expect(await factCount(gid)).toBe(1);
    expect(await countSalesDailyAggregate(shopAId)).toBeGreaterThan(0);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(1);
    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("SUCCEEDED");
  });

  it("applies orders/create through the supported v2 recovery envelope", async () => {
    const gid = "gid://shopify/Order/d-w-create-v2";
    adminState.stores = { [gid]: standardStore(gid) };
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/create",
      webhookId: "wh-d-w-create-v2",
      apiVersion: "2026-07",
      payload: {
        id: 9111,
        admin_graphql_api_id: gid,
        line_items: [{ variant_id: 191, quantity: 1, price: "3.00" }],
      },
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV2({
      tenant,
      source: "webhook:orders/create",
      durableJobId: job.id,
      payloadDigest: job.payloadDigest,
    });
    expect(envelope.schemaVersion).toBe(TENANT_JOB_ENVELOPE_V2_VERSION);
    await processWebhookJob(
      fakeJob(
        {
          topic: "orders/create",
          payloadShop: SHOP_A_DOMAIN,
          payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
          tenant: envelope,
          durableJobId: job.id,
        },
        `v2-${job.id}`,
      ),
    );
    expect(await factCount(gid)).toBe(1);
    expect(await countSalesDailyAggregate(shopAId)).toBeGreaterThan(0);
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
        .state,
    ).toBe("SUCCEEDED");
  });

  it("does not persist facts or legacy aggregates when C rejects a currency mismatch", async () => {
    const gid = "gid://shopify/Order/d-w-currency";
    const aggregatesBefore = await countSalesDailyAggregate(shopAId);
    adminState.stores = {
      [gid]: standardStore(gid, {
        header: inWindowHeader({
          id: gid,
          currencyCode: "USD",
          originalTotalPriceSet: moneyBag("10.00", "EUR"),
          currentTotalPriceSet: moneyBag("10.00", "EUR"),
        }),
      }),
    };
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/create",
      webhookId: "wh-d-w-currency",
      apiVersion: "2026-07",
      payload: {
        id: 9112,
        admin_graphql_api_id: gid,
        line_items: [{ variant_id: 192, quantity: 1, price: "3.00" }],
      },
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const sequence = 1;
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: sequence,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, sequence),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: sequence },
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: "webhook:orders/create",
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    await processWebhookJob(
      fakeJob(
        {
          topic: "orders/create",
          payloadShop: SHOP_A_DOMAIN,
          payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
          tenant: envelope,
          durableJobId: job.id,
          dispatchId: dispatch.id,
          dispatchSequence: dispatch.dispatchSequence,
          queueJobId: dispatch.queueJobId,
        },
        dispatch.queueJobId,
      ),
    );
    expect(await factCount(gid)).toBe(0);
    expect(await countSalesDailyAggregate(shopAId)).toBe(aggregatesBefore);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(0);
  });

  it("never repeats legacy effects on concurrent same-key deliveries", async () => {
    const gid = "gid://shopify/Order/d-w-concurrent";
    adminState.stores = { [gid]: standardStore(gid) };
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/create",
      webhookId: "wh-d-w-concurrent",
      apiVersion: "2026-07",
      payload: {
        id: 9113,
        admin_graphql_api_id: gid,
        line_items: [{ variant_id: 193, quantity: 1, price: "8.00" }],
      },
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id);
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: 1,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, 1),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: 1 },
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: "webhook:orders/create",
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: 1,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    const bull = fakeJob(
      {
        topic: "orders/create",
        payloadShop: SHOP_A_DOMAIN,
        payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
        tenant: envelope,
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: 1,
        queueJobId: dispatch.queueJobId,
      },
      dispatch.queueJobId,
    );
    const settled = await Promise.allSettled([
      processWebhookJob(bull),
      processWebhookJob(bull),
    ]);
    expect(settled.some((result) => result.status === "fulfilled")).toBe(true);
    expect(await factCount(gid)).toBe(1);
    const units = await countForShop(
      shopAId,
      `SELECT COALESCE(sum("unitsSold"),0)::int AS n FROM "SalesDailyAggregate"
        WHERE "shopifyVariantId" = $1`,
      ["gid://shopify/ProductVariant/193"],
    );
    expect(units).toBe(1);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(1);
  });

  it("applies orders/cancelled through the real legacy decrement", async () => {
    const gid = "gid://shopify/Order/d-w-cancel";
    adminState.stores = { [gid]: standardStore(gid) };
    await ingestAndRun({
      topic: "orders/create",
      webhookId: "wh-d-w-cancel-create",
      payload: {
        id: 9102,
        admin_graphql_api_id: gid,
        line_items: [{ variant_id: 92, quantity: 3, price: "5.00" }],
      },
    });
    const before = await countForShop(
      shopAId,
      `SELECT COALESCE(sum("unitsSold"),0)::int AS n FROM "SalesDailyAggregate"
        WHERE "shopifyVariantId" = $1`,
      ["gid://shopify/ProductVariant/92"],
    );
    await ingestAndRun({
      topic: "orders/cancelled",
      webhookId: "wh-d-w-cancel",
      payload: {
        id: 9102,
        admin_graphql_api_id: gid,
        cancelled_at: "2026-01-20T12:00:00Z",
        line_items: [{ variant_id: 92, quantity: 1, price: "5.00" }],
      },
    });
    const after = await countForShop(
      shopAId,
      `SELECT COALESCE(sum("unitsSold"),0)::int AS n FROM "SalesDailyAggregate"
        WHERE "shopifyVariantId" = $1`,
      ["gid://shopify/ProductVariant/92"],
    );
    expect(after).toBe(before - 1);
    expect(await factCount(gid)).toBe(1);
  });

  it("applies refunds/create through the real legacy handler on a seeded refundable order", async () => {
    const orderGid = "gid://shopify/Order/d-w-refund-parent";
    const refundGid = "gid://shopify/Refund/d-w-refund";
    adminState.stores = {
      [orderGid]: {
        ...standardStore(orderGid),
        refunds: [
          {
            ...refundNode(1, []),
            id: refundGid,
            processedAt: "2026-01-12T00:00:00Z",
            updatedAt: "2026-01-12T00:00:00Z",
            createdAt: "2026-01-12T00:00:00Z",
            order: { id: orderGid },
            refundLineItems: [
              {
                id: `${refundGid}/Line/1`,
                quantity: 1,
                restockType: "NO_RESTOCK",
                restocked: false,
                location: { id: "gid://shopify/Location/1" },
                lineItem: { id: `${orderGid}/LineItem/1` },
                subtotalSet: moneyBag("1.00"),
                totalTaxSet: moneyBag("0.00"),
                priceSet: moneyBag("1.00"),
              },
            ],
          },
        ],
      },
    };
    await ingestAndRun({
      topic: "orders/create",
      webhookId: "wh-d-w-refund-parent",
      payload: {
        id: 9103,
        admin_graphql_api_id: orderGid,
        line_items: [{ variant_id: 93, quantity: 2, price: "6.00" }],
      },
    });
    const before = await countForShop(
      shopAId,
      `SELECT COALESCE(sum("unitsSold"),0)::int AS n FROM "SalesDailyAggregate"
        WHERE "shopifyVariantId" = $1`,
      ["gid://shopify/ProductVariant/93"],
    );
    await ingestAndRun({
      topic: "refunds/create",
      webhookId: "wh-d-w-refund",
      payload: {
        id: "d-w-refund",
        admin_graphql_api_id: refundGid,
        order_id: "d-w-refund-parent",
        refund_line_items: [
          {
            id: 1,
            quantity: 1,
            line_item: { variant_id: 93, quantity: 1, price: "6.00" },
          },
        ],
      },
    });
    const after = await countForShop(
      shopAId,
      `SELECT COALESCE(sum("unitsSold"),0)::int AS n FROM "SalesDailyAggregate"
        WHERE "shopifyVariantId" = $1`,
      ["gid://shopify/ProductVariant/93"],
    );
    expect(after).toBe(before - 1);
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        [refundGid],
      ),
    ).toBe(1);
  });

  it("does not repeat legacy effects on duplicate v3 redelivery", async () => {
    const gid = "gid://shopify/Order/d-w-dup";
    adminState.stores = { [gid]: standardStore(gid) };
    const payload = {
      id: 9104,
      admin_graphql_api_id: gid,
      line_items: [{ variant_id: 94, quantity: 1, price: "2.00" }],
    };
    const job = await ingestAndRun({
      topic: "orders/create",
      webhookId: "wh-d-w-dup",
      payload,
    });
    const aggregates = await countSalesDailyAggregate(shopAId);
    const receipts = await countSyncApplicationReceipts(
      shopAId,
      job.webhookDeliveryId ?? "",
    );
    const duplicate = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/create",
      webhookId: "wh-d-w-dup",
      apiVersion: "2026-07",
      payload,
    });
    expect(duplicate.duplicate).toBe(true);
    expect(await factCount(gid)).toBe(1);
    expect(await countSalesDailyAggregate(shopAId)).toBe(aggregates);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(receipts);
  });

  it("keeps first LIVE confirmation pending and completes on durable retry", async () => {
    const gid = "gid://shopify/Order/d-w-revive";
    const iso = new Date().toISOString();
    const recent = (): ReturnType<typeof standardStore> =>
      standardStore(gid, {
        header: inWindowHeader({
          id: gid,
          createdAt: iso,
          updatedAt: iso,
          processedAt: iso,
        }),
      });
    adminState.stores = { [gid]: recent() };
    await ingestAndRun({
      topic: "orders/create",
      webhookId: "wh-d-w-revive-create",
      payload: { id: 9105, admin_graphql_api_id: gid },
    });
    adminState.stores = { [gid]: { ...recent(), nullOrder: true } };
    adminState.nullOrderGids.add(gid);
    await ingestAndRun({
      topic: "orders/edited",
      webhookId: "wh-d-w-revive-tombstone",
      payload: { order_edit: { id: 1, order_id: "d-w-revive" } },
    });
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'ABSENT'`,
        [gid],
      ),
    ).toBe(1);
    adminState.nullOrderGids.delete(gid);
    adminState.stores = { [gid]: recent() };
    const firstLive = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/edited",
      webhookId: "wh-d-w-revive-live",
      apiVersion: "2026-07",
      payload: { order_edit: { id: 2, order_id: "d-w-revive" } },
    });
    const job = firstLive.job!;
    await transitionToEnqueuedForTests(prisma, job.id, { maxAttempts: 8 });
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: 1,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, 1),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: 1 },
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: "webhook:orders/edited",
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: 1,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    await processWebhookJob(
      fakeJob(
        {
          topic: "orders/edited",
          payloadShop: SHOP_A_DOMAIN,
          payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
          tenant: envelope,
          durableJobId: job.id,
          dispatchId: dispatch.id,
          dispatchSequence: 1,
          queueJobId: dispatch.queueJobId,
        },
        dispatch.queueJobId,
      ),
    );
    const afterFirst = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(afterFirst.state).toBe("RETRY_WAIT");
    expect(afterFirst.failureCode).toBe("order_facts_first_confirmation_pending");
    const existence = await countForShop(
      shopAId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
        WHERE "shopifyGid" = $1 AND "existenceState" = 'ABSENT'`,
      [gid],
    );
    expect(existence).toBe(1);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(0);
    await continueDurableJob(job.id, "orders/edited");
    const afterSecond = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(afterSecond.state).toBe("SUCCEEDED");
    const live = await countForShop(
      shopAId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
        WHERE "shopifyGid" = $1 AND "existenceState" = 'LIVE'`,
      [gid],
    );
    expect(live).toBe(1);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(1);
  });

  function recentStore(gid: string, iso: string) {
    return standardStore(gid, {
      header: inWindowHeader({
        id: gid,
        createdAt: iso,
        updatedAt: iso,
        processedAt: iso,
      }),
    });
  }

  async function seedConfirmedTombstone(gid: string, key: string) {
    const iso = new Date().toISOString();
    adminState.stores = { [gid]: recentStore(gid, iso) };
    await ingestAndRun({
      topic: "orders/create",
      webhookId: `wh-${key}-create`,
      payload: {
        id: Math.abs(
          Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
        ) + 20_000,
        admin_graphql_api_id: gid,
      },
    });
    adminState.stores = { [gid]: { ...recentStore(gid, iso), nullOrder: true } };
    adminState.nullOrderGids.add(gid);
    await ingestAndRun({
      topic: "orders/edited",
      webhookId: `wh-${key}-tombstone`,
      payload: { order_edit: { id: 1, order_id: key } },
    });
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'ABSENT'`,
        [gid],
      ),
    ).toBe(1);
    adminState.nullOrderGids.delete(gid);
    adminState.stores = { [gid]: recentStore(gid, iso) };
    return iso;
  }

  it("does not repeat revival on duplicate first-confirmation continuation delivery", async () => {
    const key = "d-w-dup-cont";
    const gid = `gid://shopify/Order/${key}`;
    await seedConfirmedTombstone(gid, key);
    const firstLive = await ingestAndRun({
      topic: "orders/edited",
      webhookId: `wh-${key}-live`,
      payload: { order_edit: { id: 2, order_id: key } },
      maxAttempts: 8,
    });
    const afterFirst = await prisma.durableJob.findUniqueOrThrow({
      where: { id: firstLive.id },
    });
    expect(afterFirst.state).toBe("RETRY_WAIT");
    expect(
      await countSyncApplicationReceipts(
        shopAId,
        firstLive.webhookDeliveryId ?? "",
      ),
    ).toBe(0);
    await transitionRetryWaitToEnqueuedForTests(prisma, firstLive.id);
    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { id: firstLive.id },
    });
    const sequence = (job.activeDispatchSequence ?? 1) + 1;
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: sequence,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, sequence),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: sequence },
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: JOB_SOURCE_BY_NAME["orders/edited"],
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    const continuation = fakeJob(
      {
        topic: "orders/edited",
        payloadShop: SHOP_A_DOMAIN,
        payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
        tenant: envelope,
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
      },
      dispatch.queueJobId,
    );
    const settled = await Promise.allSettled([
      processWebhookJob(continuation),
      processWebhookJob(continuation),
    ]);
    expect(settled.some((result) => result.status === "fulfilled")).toBe(true);
    const after = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(after.state).toBe("SUCCEEDED");
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'LIVE'`,
        [gid],
      ),
    ).toBe(1);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(1);
  });

  it("recovers first-confirmation work after the worker dies before retry scheduling", async () => {
    const key = "d-w-interrupt";
    const gid = `gid://shopify/Order/${key}`;
    await seedConfirmedTombstone(gid, key);
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP_A_DOMAIN,
      topic: "orders/edited",
      webhookId: `wh-${key}-live`,
      apiVersion: "2026-07",
      payload: { order_edit: { id: 2, order_id: key } },
    });
    const job = ingested.job!;
    await transitionToEnqueuedForTests(prisma, job.id, { maxAttempts: 8 });
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: 1,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, 1),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: 1 },
    });
    const claimed = await claimAttempt({
      durableJobId: job.id,
      shopId: job.shopId,
      workerId: "d-w-interrupt-worker",
      jobDispatchId: dispatch.id,
      leaseMs: 60_000,
    });
    const tenant = issueSyncDispatchAuthority({
      shopId: job.shopId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_scheduler",
      correlationId: job.correlationId,
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant,
      source: "webhook:orders/edited",
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: 1,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    const ctx = await resolveTenantJobContextV3(envelope, {
      payloadShop: SHOP_A_DOMAIN,
      expectedJobNameOrTopic: "orders/edited",
      expectedDurableJobId: job.id,
      expectedPayloadDigest: job.payloadDigest,
      expectedDispatchId: dispatch.id,
      expectedDispatchSequence: 1,
    });
    const observed = await processOrderFactsWebhookJob({
      db: ctx.db,
      admin: createOrderFactsAdmin({ stores: adminState.stores }),
      shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
      work: {
        shopId: job.shopId,
        topic: "orders/edited",
        payloadSchemaVersion: job.payloadSchemaVersion,
        projection: (job.sanitizedPayload as Record<string, unknown>) ?? {},
        applicationKey: resolveApplicationKey({
          jobType: job.jobType,
          webhookDeliveryId: job.webhookDeliveryId,
          idempotencyKey: job.idempotencyKey,
        }),
        payloadDigest: job.payloadDigest,
        sourceJobType: job.jobType,
        rootDurableJobId: job.causationId ?? job.id,
        applyingDurableJobId: job.id,
        durableJobId: job.id,
        jobAttemptId: claimed.attempt.id,
        correlationId: job.correlationId,
        receivedAt: job.createdAt,
        leaseDurationMs: 60_000,
      },
    });
    expect(observed.status).toBe("first_confirmation_pending");
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(0);
    const expired = new Date(Date.now() - 1_000);
    await prisma.jobAttempt.update({
      where: { id: claimed.attempt.id },
      data: { leaseExpiresAt: expired },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { leaseExpiresAt: expired },
    });
    const recovery = await recoverExpiredRunningAttempts({ now: new Date() });
    expect(recovery.finalized).toBe(0);
    expect(recovery.recovered).toBeGreaterThanOrEqual(1);
    const afterDeath = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(afterDeath.state).toBe("RETRY_WAIT");
    expect(afterDeath.failureCode).toBe("lease_expired");
    await continueDurableJob(job.id, "orders/edited");
    const afterSecond = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(afterSecond.state).toBe("SUCCEEDED");
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'LIVE'`,
        [gid],
      ),
    ).toBe(1);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(1);
  });

  it("dead-letters first-confirmation continuation when the attempt budget is exhausted", async () => {
    const key = "d-w-exhaust";
    const gid = `gid://shopify/Order/${key}`;
    await seedConfirmedTombstone(gid, key);
    const job = await ingestAndRun({
      topic: "orders/edited",
      webhookId: `wh-${key}-live`,
      payload: { order_edit: { id: 2, order_id: key } },
      maxAttempts: 1,
    });
    const durable = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(durable.state).toBe("DEAD_LETTERED");
    expect(durable.failureCode).toBe("order_facts_first_confirmation_pending");
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'ABSENT'`,
        [gid],
      ),
    ).toBe(1);
    expect(
      await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
    ).toBe(0);
  });

  it("does not revive on an overlapping second confirmation", async () => {
    const key = "d-w-overlap";
    const gid = `gid://shopify/Order/${key}`;
    await seedConfirmedTombstone(gid, key);
    let releaseFirstRead: () => void = () => undefined;
    const firstReadHold = new Promise<void>((resolve) => {
      releaseFirstRead = resolve;
    });
    adminState.blockedOrderReads.set(gid, firstReadHold);
    const first = ingestAndRun({
      topic: "orders/edited",
      webhookId: `wh-${key}-live-a`,
      payload: { order_edit: { id: 2, order_id: key } },
      maxAttempts: 8,
    });
    await vi.waitFor(() => {
      expect(adminState.orderReadWaiting.has(gid)).toBe(true);
    });
    const second = ingestAndRun({
      topic: "orders/edited",
      webhookId: `wh-${key}-live-b`,
      payload: { order_edit: { id: 3, order_id: key } },
      maxAttempts: 8,
    });
    await vi.waitFor(async () => {
      expect(
        await countForShop(
          shopAId,
          `SELECT count(*)::int AS n FROM "OrderFactObservationInFlight"
            WHERE "shopifyGid" = $1 AND "lifecycleState" = 'ACTIVE'`,
          [gid],
        ),
      ).toBeGreaterThanOrEqual(2);
    });
    releaseFirstRead();
    await Promise.allSettled([first, second]);
    adminState.blockedOrderReads.delete(gid);
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'LIVE'`,
        [gid],
      ),
    ).toBe(0);
    expect(
      await countForShop(
        shopAId,
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact"
          WHERE "shopifyGid" = $1 AND "existenceState" = 'ABSENT'`,
        [gid],
      ),
    ).toBe(1);
    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        shopId: shopAId,
        shopifyWebhookId: {
          in: [`wh-${key}-live-a`, `wh-${key}-live-b`],
        },
      },
    });
    expect(deliveries).toHaveLength(2);
    const jobs = await prisma.durableJob.findMany({
      where: {
        id: {
          in: deliveries
            .map((delivery) => delivery.durableJobId)
            .filter((id): id is string => typeof id === "string"),
        },
      },
    });
    expect(jobs).toHaveLength(2);
    for (const job of jobs) {
      expect(job.state).not.toBe("SUCCEEDED");
      expect(
        await countSyncApplicationReceipts(shopAId, job.webhookDeliveryId ?? ""),
      ).toBe(0);
    }
  });
});
