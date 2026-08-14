/**
 * F-PR4-03 — uninstall cancels DISPATCH_LEASED / RUNNING and always disables.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { processUninstall } from "../uninstall.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import {
  CANCELLABLE_DURABLE_JOB_STATES,
  assertCancellableTransitionCoverage,
  isLegalTransition,
} from "../state-machine.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { forceCancellableStateForTests } from "./test-state-helpers";

const SHOP = "pr4-uninstall.myshopify.com";

describe("test:sync-uninstall", () => {
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
        "DurableJob", "DispatchReadyShop", "SyncApplicationReceipt", "Session"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    await resetControlPlanePrismaForTests();
  });

  it("every cancellable state has a legal → CANCELLED edge", () => {
    assertCancellableTransitionCoverage();
    for (const state of CANCELLABLE_DURABLE_JOB_STATES) {
      expect(isLegalTransition(state, "CANCELLED")).toBe(true);
    }
  });

  for (const state of [
    "PENDING",
    "DISPATCH_LEASED",
    "ENQUEUED",
    "RUNNING",
    "RETRY_WAIT",
  ] as const) {
    it(`uninstall cancels ${state} and disables processing (F-PR4-03)`, async () => {
      const ingested = await ingestAuthenticatedWebhook({
        verifiedShop: SHOP,
        topic: "orders/create",
        webhookId: `wh-un-${state}`,
        apiVersion: "2026-07",
        payload: {
          id: 1,
          line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
        },
      });
      await forceCancellableStateForTests(prisma, {
        durableJobId: ingested.job!.id,
        shopId: ingested.job!.shopId,
        target: state,
      });

      const result = await processUninstall({
        verifiedShop: SHOP,
        webhookId: `uninstall-${state}`,
        apiVersion: "2026-07",
        payload: { myshopify_domain: SHOP },
      });

      expect(result.cancelledJobs).toBeGreaterThanOrEqual(1);
      const shop = await prisma.shop.findUniqueOrThrow({
        where: { myshopifyDomain: SHOP },
      });
      expect(shop.processingEnabled).toBe(false);
      expect(shop.processingDisabledReason).toBe("UNINSTALLED");

      const job = await prisma.durableJob.findUniqueOrThrow({
        where: { id: ingested.job!.id },
      });
      expect(job.state).toBe("CANCELLED");
    });
  }

  it("duplicate uninstall is idempotent and keeps processing disabled", async () => {
    await processUninstall({
      verifiedShop: SHOP,
      webhookId: "uninstall-dup",
      apiVersion: "2026-07",
    });
    const second = await processUninstall({
      verifiedShop: SHOP,
      webhookId: "uninstall-dup",
      apiVersion: "2026-07",
    });
    expect(second.duplicate).toBe(true);
    const shop = await prisma.shop.findUniqueOrThrow({
      where: { myshopifyDomain: SHOP },
    });
    expect(shop.processingEnabled).toBe(false);
  });

  it("mixed states cancel in one uninstall transaction", async () => {
    for (const [i, state] of (
      ["PENDING", "DISPATCH_LEASED", "ENQUEUED", "RETRY_WAIT"] as const
    ).entries()) {
      const r = await ingestAuthenticatedWebhook({
        verifiedShop: SHOP,
        topic: "orders/create",
        webhookId: `wh-mix-${i}`,
        apiVersion: "2026-07",
        payload: {
          id: i,
          line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
        },
      });
      await forceCancellableStateForTests(prisma, {
        durableJobId: r.job!.id,
        shopId: r.job!.shopId,
        target: state,
      });
    }
    const result = await processUninstall({
      verifiedShop: SHOP,
      webhookId: "uninstall-mix",
      apiVersion: "2026-07",
    });
    expect(result.cancelledJobs).toBe(4);
    const remaining = await prisma.durableJob.count({
      where: {
        shopId: result.shopId,
        state: { in: [...CANCELLABLE_DURABLE_JOB_STATES] },
      },
    });
    expect(remaining).toBe(0);
  });
});
