/**
 * F-PR4-03 — uninstall cancels DISPATCH_LEASED / RUNNING and always disables.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { processUninstall } from "../uninstall.server";
import { reactivateShopAfterVerifiedReinstall } from "../reinstall.server";
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

  async function shopRow() {
    return prisma.shop.findUniqueOrThrow({ where: { myshopifyDomain: SHOP } });
  }

  // Attack round 8 (SEC-23): Shopify can deliver app/uninstalled late, or
  // again, after the merchant has installed the app again. Either used to
  // switch the running shop off, cancel its jobs and delete its sessions; a
  // shop nobody opened for the retention window was then erased.
  describe("an uninstall that reaches us after a reinstall", () => {
    async function queuedJob(webhookId: string) {
      const ingested = await ingestAuthenticatedWebhook({
        verifiedShop: SHOP,
        topic: "orders/create",
        webhookId,
        apiVersion: "2026-07",
        payload: {
          id: 7,
          line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
        },
      });
      return ingested.job!;
    }

    async function storedSession() {
      await prisma.session.create({
        data: {
          id: `offline_${SHOP}`,
          shop: SHOP,
          state: "state",
          accessToken: "fixture-access-token",
        },
      });
    }

    it("the same delivery again leaves the reinstalled shop running", async () => {
      await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-then-reinstall",
        apiVersion: "2026-07",
      });
      await reactivateShopAfterVerifiedReinstall({ verifiedDomain: SHOP });
      const job = await queuedJob("wh-after-reinstall-1");
      await storedSession();

      const again = await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-then-reinstall",
        apiVersion: "2026-07",
      });

      expect(again.duplicate).toBe(true);
      expect(again.ignored).toBe(true);
      expect(again.cancelledJobs).toBe(0);
      expect(again.sessionsDeleted).toBe(0);
      const shop = await shopRow();
      expect(shop.processingEnabled).toBe(true);
      expect(shop.processingDisabledReason).toBeNull();
      expect(
        (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
          .state,
      ).not.toBe("CANCELLED");
      expect(await prisma.session.count({ where: { shop: SHOP } })).toBe(1);
    });

    it("a first delivery that Shopify triggered before the reinstall is recorded and ignored", async () => {
      const uninstalledAt = new Date(Date.now() - 60_000);
      await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-first",
        apiVersion: "2026-07",
      });
      await reactivateShopAfterVerifiedReinstall({ verifiedDomain: SHOP });
      const job = await queuedJob("wh-after-reinstall-2");
      await storedSession();

      const late = await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-late-copy",
        apiVersion: "2026-07",
        triggeredAt: uninstalledAt.toISOString(),
      });

      expect(late.duplicate).toBe(false);
      expect(late.ignored).toBe(true);
      const shop = await shopRow();
      expect(shop.processingEnabled).toBe(true);
      expect(
        (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
          .state,
      ).not.toBe("CANCELLED");
      expect(await prisma.session.count({ where: { shop: SHOP } })).toBe(1);
      const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
        where: { id: late.deliveryId },
      });
      expect(delivery.quarantineReason).toBe("uninstall_before_current_install");
    });

    it("an uninstall triggered after the reinstall still switches the shop off", async () => {
      await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-first",
        apiVersion: "2026-07",
      });
      await reactivateShopAfterVerifiedReinstall({ verifiedDomain: SHOP });
      await storedSession();

      const second = await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-second",
        apiVersion: "2026-07",
        triggeredAt: new Date(Date.now() + 1_000).toISOString(),
      });

      expect(second.ignored).toBe(false);
      const shop = await shopRow();
      expect(shop.processingEnabled).toBe(false);
      expect(shop.processingDisabledReason).toBe("UNINSTALLED");
      expect(await prisma.session.count({ where: { shop: SHOP } })).toBe(0);
    });

    it.each([undefined, null, "", "not-a-date"])(
      "an uninstall with no usable trigger time (%s) switches the shop off",
      async (triggeredAt) => {
        await processUninstall({
          verifiedShop: SHOP,
          webhookId: "uninstall-first",
          apiVersion: "2026-07",
        });
        await reactivateShopAfterVerifiedReinstall({ verifiedDomain: SHOP });

        const second = await processUninstall({
          verifiedShop: SHOP,
          webhookId: "uninstall-no-time",
          apiVersion: "2026-07",
          triggeredAt,
        });

        expect(second.ignored).toBe(false);
        expect((await shopRow()).processingEnabled).toBe(false);
      },
    );

    // The row's creation time is not proof of an install (a webhook for a
    // shop that never opened the app can create the row), so only a verified
    // reinstall makes an older uninstall out of date.
    it("with no reinstall on record, an old trigger time still switches the shop off", async () => {
      const result = await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-old-trigger",
        apiVersion: "2026-07",
        triggeredAt: new Date(Date.now() - 3_600_000).toISOString(),
      });

      expect(result.ignored).toBe(false);
      expect((await shopRow()).processingEnabled).toBe(false);
    });
  });

  // An uninstall used to overwrite whatever had switched the shop off.
  describe("an uninstall for a shop that is already switched off", () => {
    it.each(["MANUAL", "REDACTED"] as const)(
      "keeps a %s shop as it is",
      async (reason) => {
        const disabledAt = new Date(Date.now() - 86_400_000);
        await prisma.shop.update({
          where: { myshopifyDomain: SHOP },
          data: {
            processingEnabled: false,
            processingDisabledReason: reason,
            processingDisabledAt: disabledAt,
          },
        });

        const result = await processUninstall({
          verifiedShop: SHOP,
          webhookId: `uninstall-on-${reason}`,
          apiVersion: "2026-07",
        });

        expect(result.ignored).toBe(false);
        const shop = await shopRow();
        expect(shop.processingEnabled).toBe(false);
        expect(shop.processingDisabledReason).toBe(reason);
        expect(shop.processingDisabledAt?.getTime()).toBe(disabledAt.getTime());
        await expect(
          reactivateShopAfterVerifiedReinstall({ verifiedDomain: SHOP }),
        ).rejects.toMatchObject({ code: "reinstall_denied" });
      },
    );

    it("does not move the uninstall time of a shop already uninstalled", async () => {
      await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-first",
        apiVersion: "2026-07",
      });
      const first = await shopRow();

      await new Promise((resolve) => setTimeout(resolve, 20));
      await processUninstall({
        verifiedShop: SHOP,
        webhookId: "uninstall-other-id",
        apiVersion: "2026-07",
      });

      const second = await shopRow();
      expect(second.processingDisabledReason).toBe("UNINSTALLED");
      expect(second.uninstalledAt?.getTime()).toBe(first.uninstalledAt?.getTime());
    });
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
