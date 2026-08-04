/**
 * F-PR4-08 / F-PR4-18 / F-PR4-20 / F-PR4-12 / F-PR4-15 / F-PR4-14 intake & misc.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { sanitizeWebhookPayload, PROJECTION_BOUNDS } from "../sanitize.server";
import { replayDeadLetter } from "../replay.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { SyncControlPlaneError } from "../errors";
import { requireRedisUrl } from "../../jobs/queue.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";

const SHOP = "pr4-intake-misc.myshopify.com";

describe("sync intake corrections (F-PR4-08/12/18/19/20)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    await resetControlPlanePrismaForTests();
  });

  it("divergent payload for same webhook ID records conflict (F-PR4-08)", async () => {
    const first = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-conflict",
      apiVersion: "2026-07",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 2, price: "10.00" }],
      },
    });
    expect(first.job).toBeTruthy();

    const second = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-conflict",
      apiVersion: "2026-07",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 999, price: "99.00" }],
      },
    });
    expect(second.conflict).toBe(true);
    expect(second.job?.id).toBe(first.job?.id);
    expect(second.delivery.payloadDigest).toBe(first.delivery.payloadDigest);
    expect(second.delivery.payloadDigestMismatchCount).toBeGreaterThanOrEqual(1);
    expect(second.delivery.lastConflictingDigest).toBeTruthy();

    const issues = await prisma.dataIssue.findMany({
      where: { shopId: first.job!.shopId, reasonCode: "webhook_payload_digest_conflict" },
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);

    const jobs = await prisma.durableJob.count({
      where: { shopId: first.job!.shopId },
    });
    expect(jobs).toBe(1);
  });

  it("missing webhook ID quarantines without job (F-PR4-20)", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: null,
      apiVersion: "2026-07",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect(r.quarantined).toBe(true);
    expect(r.job).toBeNull();
    expect(r.delivery.shopifyWebhookId).toBeNull();
    expect(r.delivery.quarantineReason).toBe("missing_shopify_webhook_id");
    expect(await prisma.durableJob.count()).toBe(0);
  });

  it("2025-10 adapter version is accepted for processing", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-2025-10",
      apiVersion: "2025-10",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect(r.quarantined).toBe(false);
    expect(r.job).toBeTruthy();
    expect(r.delivery.apiVersionReceived).toBe("2025-10");
  });

  it("unsupported API version quarantines durably (F-PR4-18)", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-bad-ver",
      apiVersion: "2024-01",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    expect(r.quarantined).toBe(true);
    expect(r.job).toBeNull();
    expect(r.delivery.state).toBe("QUARANTINED");
    expect(await prisma.durableJob.count()).toBe(0);
  });

  it("oversized line_items fail closed (F-PR4-12)", () => {
    const lines = Array.from({ length: PROJECTION_BOUNDS.maxLineItems + 1 }, (_, i) => ({
      variant_id: i,
      quantity: 1,
      price: "1.00",
    }));
    expect(() =>
      sanitizeWebhookPayload("orders/create", { id: 1, line_items: lines }),
    ).toThrow(SyncControlPlaneError);
  });

  it("object at scalar id field fails closed (F-PR4-12)", () => {
    expect(() =>
      sanitizeWebhookPayload("orders/create", {
        id: { nested: true },
        line_items: [],
      }),
    ).toThrow(SyncControlPlaneError);
  });

  it("REDIS_URL unset fails with descriptive error (F-PR4-19)", () => {
    const prev = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      expect(() => requireRedisUrl({})).toThrow(/redis_url_not_configured/);
      expect(() => requireRedisUrl({ REDIS_URL: "[REDACTED]" })).toThrow(
        /redis_url_invalid/,
      );
    } finally {
      if (prev != null) process.env.REDIS_URL = prev;
    }
  });

  it("replay requires DEAD_LETTERED original (F-PR4-15)", async () => {
    const r = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: "orders/create",
      webhookId: "wh-replay",
      apiVersion: "2026-07",
      payload: {
        id: 1,
        line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
      },
    });
    const dl = await prisma.deadLetter.create({
      data: {
        shopId: r.job!.shopId,
        durableJobId: r.job!.id,
        terminalReason: "test",
        resolutionState: "OPEN",
      },
    });
    // Original still PENDING — must fail.
    await expect(
      replayDeadLetter({
        deadLetterId: dl.id,
        shopId: r.job!.shopId,
        reason: "test replay",
      }),
    ).rejects.toThrow(/DEAD_LETTERED/);
  });
});
