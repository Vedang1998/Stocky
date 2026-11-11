/**
 * Compliance webhooks and shop data erasure against PostgreSQL with the real
 * database roles, and against Redis for the queue purge.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { defaultPrivacyErasureOwnerRoleName } from "../../../scripts/sync-control-plane/privacy-erasure";
import {
  defaultControlPlaneRoleName,
  defaultRuntimeRoleName,
} from "../../../scripts/sync-control-plane/roles";
import {
  getWebhookQueue,
  resetQueueClientsForTests,
} from "../../jobs/queue.server";
import { recordPrivacyRequest } from "../../privacy/intake.server";
import { runPrivacyMaintenance } from "../../privacy/maintenance.server";
import { purgeQueuedJobsForShop } from "../../privacy/queue-purge.server";
import { deleteSessionsForShop } from "../../tenant/bootstrap.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import {
  getControlPlanePrisma,
  resetControlPlanePrismaForTests,
} from "../control-plane-db.server";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { reactivateShopAfterVerifiedReinstall } from "../reinstall.server";
import { processUninstall } from "../uninstall.server";

const SHOP_A = "privacy-erase-a.myshopify.com";
const SHOP_B = "privacy-erase-b.myshopify.com";
const SHOPS = [SHOP_A, SHOP_B];
const DAY_MS = 24 * 60 * 60 * 1000;

const realDeps = {
  deleteSessions: deleteSessionsForShop,
  purgeQueuedJobs: purgeQueuedJobsForShop,
};

describe("privacy compliance", () => {
  let prisma: PrismaClient;

  /** Rows per table that carry this shop id, for every shop-keyed table. */
  async function rowsByTable(shopId: string): Promise<Record<string, number>> {
    const tables = await prisma.$queryRaw<{ table: string }[]>`
      SELECT c.relname AS "table"
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND a.attname = 'shopId' AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY c.relname
    `;
    const counts: Record<string, number> = {};
    for (const { table } of tables) {
      const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "shopId" = $1`,
        shopId,
      );
      if (rows[0].n > 0) counts[table] = rows[0].n;
    }
    return counts;
  }

  /** An installed shop with merchant rows, sync history and sessions. */
  async function seedShop(domain: string): Promise<string> {
    const shop = await prisma.shop.create({
      data: { myshopifyDomain: domain },
    });
    await prisma.shopSettings.create({
      data: { shop: domain, shopId: shop.id },
    });
    for (const name of ["North Mill", "Quay Traders", "Lowland Supply"]) {
      await prisma.supplier.create({
        data: { shop: domain, shopId: shop.id, name },
      });
    }
    for (const delivery of ["one", "two"]) {
      await ingestAuthenticatedWebhook({
        verifiedShop: domain,
        topic: "orders/create",
        webhookId: `${domain}-${delivery}`,
        apiVersion: "2026-07",
        payload: {
          id: 1,
          line_items: [{ variant_id: 1, quantity: 1, price: "1.00" }],
        },
      });
    }
    // A ledger line holds its operation with a RESTRICT key, so the erasure
    // has to take the line before the operation.
    const operation = await prisma.inventoryOperation.create({
      data: {
        shopId: shop.id,
        idempotencyKey: `${domain}-adjustment`,
        payloadDigest: "0".repeat(64),
        kind: "ADJUSTMENT",
        writeCapability: "inventory_adjustments",
        sourceType: "adjustment",
        sourceId: "adjustment-1",
        reason: "correction",
        quantityName: "available",
        actorChannel: "ADMIN",
        actorDisplayName: "Sam Keeper",
        lineCount: 1,
      },
    });
    await prisma.inventoryOperationLine.create({
      data: {
        shopId: shop.id,
        operationId: operation.id,
        lineNumber: 1,
        inventoryItemGid: "gid://shopify/InventoryItem/1",
        locationGid: "gid://shopify/Location/1",
        delta: 2,
      },
    });
    await prisma.session.create({
      data: {
        id: `offline_${domain}`,
        shop: domain,
        state: "state",
        accessToken: "token-for-tests",
      },
    });
    return shop.id;
  }

  async function uninstall(domain: string): Promise<void> {
    await processUninstall({
      verifiedShop: domain,
      webhookId: `${domain}-uninstalled`,
      apiVersion: "2026-07",
    });
  }

  function shopRedact(domain: string, webhookId: string) {
    return recordPrivacyRequest({
      topic: "shop/redact",
      verifiedShop: domain,
      webhookId,
      payload: { shop_id: 954889, shop_domain: domain },
    });
  }

  /** Runs statements as another database role; rolls back afterwards. */
  async function asRole<T>(
    role: string,
    work: (tx: {
      $queryRawUnsafe: PrismaClient["$queryRawUnsafe"];
    }) => Promise<T>,
  ): Promise<T> {
    let result!: T;
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
        result = await work(tx);
        throw new Error("rollback");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== "rollback") {
          throw error;
        }
      });
    return result;
  }

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
    await getWebhookQueue().obliterate({ force: true });
    await resetQueueClientsForTests();
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "DispatchReadyShop", "SyncApplicationReceipt", "Session",
        "PrivacyRequest"
      CASCADE
    `);
    for (const domain of SHOPS) {
      await prisma.supplier.deleteMany({ where: { shop: domain } });
      await prisma.shopSettings.deleteMany({ where: { shop: domain } });
      await prisma.shop.deleteMany({ where: { myshopifyDomain: domain } });
    }
    await getWebhookQueue().obliterate({ force: true });
    await resetControlPlanePrismaForTests();
  });

  it("answers customer requests at intake without storing customer details", async () => {
    await seedShop(SHOP_A);

    const redact = await recordPrivacyRequest({
      topic: "customers/redact",
      verifiedShop: SHOP_A,
      webhookId: "customers-redact-1",
      payload: {
        shop_id: 954889,
        shop_domain: SHOP_A,
        customer: { id: 191167, email: "john@example.com", phone: "555-625-1199" },
        orders_to_redact: [299938, 280263, 220458],
      },
    });
    const dataRequest = await recordPrivacyRequest({
      topic: "customers/data_request",
      verifiedShop: SHOP_A,
      webhookId: "customers-data-request-1",
      payload: {
        shop_id: 954889,
        shop_domain: SHOP_A,
        orders_requested: [299938, 280263],
        customer: { id: 191167, email: "john@example.com", phone: "555-625-1199" },
        data_request: { id: 9999 },
      },
    });

    expect(redact).toMatchObject({
      duplicate: false,
      resolution: "NO_CUSTOMER_DATA_HELD",
    });
    expect(dataRequest.resolution).toBe("NO_CUSTOMER_DATA_HELD");

    const rows = await prisma.privacyRequest.findMany({
      orderBy: { shopifyWebhookId: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      topic: "CUSTOMERS_DATA_REQUEST",
      dataRequestId: "9999",
      ordersListed: 2,
      shopifyShopId: "954889",
    });
    expect(rows[1]).toMatchObject({
      topic: "CUSTOMERS_REDACT",
      dataRequestId: null,
      ordersListed: 3,
    });
    for (const row of rows) {
      expect(row.resolvedAt).not.toBeNull();
      expect(row.dueAt.getTime() - row.receivedAt.getTime()).toBe(30 * DAY_MS);
    }
    const stored = JSON.stringify(rows, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    for (const detail of ["john@example.com", "555-625-1199", "191167", "299938"]) {
      expect(stored).not.toContain(detail);
    }
  });

  it("records a redelivered webhook once", async () => {
    await seedShop(SHOP_A);
    await uninstall(SHOP_A);

    const first = await shopRedact(SHOP_A, "shop-redact-dup");
    const [second, third] = await Promise.all([
      shopRedact(SHOP_A, "shop-redact-dup"),
      shopRedact(SHOP_A, "shop-redact-dup"),
    ]);

    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ ...first, duplicate: true });
    expect(third).toEqual({ ...first, duplicate: true });
    expect(await prisma.privacyRequest.count()).toBe(1);
  });

  it("erases an uninstalled shop completely and leaves other shops alone", async () => {
    const shopA = await seedShop(SHOP_A);
    const shopB = await seedShop(SHOP_B);
    const otherShopBefore = await rowsByTable(shopB);
    expect(Object.keys(await rowsByTable(shopA)).length).toBeGreaterThan(3);

    await uninstall(SHOP_A);
    // Sessions and queued jobs can outlive a missed or partial uninstall.
    await prisma.session.create({
      data: {
        id: `online_${SHOP_A}`,
        shop: SHOP_A,
        state: "state",
        accessToken: "token-for-tests",
        email: "staff@example.com",
      },
    });
    const queue = getWebhookQueue();
    await queue.add("webhook", { tenant: { shopId: shopA } } as never, {
      delay: 60_000,
    });
    await queue.add("webhook", { tenant: { shopId: shopB } } as never, {
      delay: 60_000,
    });

    const recorded = await shopRedact(SHOP_A, "shop-redact-a");
    expect(recorded.resolution).toBeNull();
    const summary = await runPrivacyMaintenance({
      retentionDays: 30,
      deps: realDeps,
    });

    expect(summary).toMatchObject({ resolved: 1, failed: 0, continuing: 0 });
    expect(await rowsByTable(shopA)).toEqual({});
    expect(await prisma.shop.findUnique({ where: { id: shopA } })).toBeNull();
    expect(await prisma.session.count({ where: { shop: SHOP_A } })).toBe(0);

    expect(await rowsByTable(shopB)).toEqual(otherShopBefore);
    expect(await prisma.session.count({ where: { shop: SHOP_B } })).toBe(1);
    const otherShop = await prisma.shop.findUniqueOrThrow({
      where: { id: shopB },
    });
    expect(otherShop.processingEnabled).toBe(true);

    const queued = await queue.getJobs(["delayed"]);
    expect(queued.map((job) => job.data.tenant)).toEqual([{ shopId: shopB }]);

    const request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(request.resolution).toBe("SHOP_DATA_ERASED");
    expect(request.resolvedAt).not.toBeNull();
    expect(request.shopRecordId).toBe(shopA);
    expect(Number(request.erasedRows)).toBeGreaterThan(5);
  });

  it("holds a later request for a shop that has installed again and leaves the new install alone", async () => {
    await seedShop(SHOP_A);
    await uninstall(SHOP_A);
    await shopRedact(SHOP_A, "shop-redact-first");
    await runPrivacyMaintenance({ retentionDays: 30, deps: realDeps });

    // Same domain installed again: a new shop row with new data.
    const reinstalled = await seedShop(SHOP_A);
    const before = await rowsByTable(reinstalled);
    const late = await shopRedact(SHOP_A, "shop-redact-late");
    await runPrivacyMaintenance({ retentionDays: 30, deps: realDeps });

    const request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: late.requestId },
    });
    expect(request.resolution).toBeNull();
    expect(request.lastErrorCode).toBe("shop_not_uninstalled");
    expect(await rowsByTable(reinstalled)).toEqual(before);
    expect(await prisma.session.count({ where: { shop: SHOP_A } })).toBe(1);
  });

  it("resolves a request for a shop it never stored and removes stray sessions", async () => {
    await prisma.session.create({
      data: {
        id: `offline_${SHOP_A}`,
        shop: SHOP_A,
        state: "state",
        accessToken: "token-for-tests",
      },
    });

    const recorded = await shopRedact(SHOP_A, "shop-redact-unknown");
    await runPrivacyMaintenance({ retentionDays: 30, deps: realDeps });

    const request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(request.resolution).toBe("NO_SHOP_RECORD");
    expect(request.shopRecordId).toBeNull();
    expect(await prisma.session.count({ where: { shop: SHOP_A } })).toBe(0);
  });

  it("does not erase an installed shop: the request waits, then closes at the deadline", async () => {
    const shopA = await seedShop(SHOP_A);
    const before = await rowsByTable(shopA);
    const now = new Date();

    const recorded = await shopRedact(SHOP_A, "shop-redact-installed");
    const first = await runPrivacyMaintenance({
      retentionDays: 30,
      deps: realDeps,
      now,
    });

    expect(first).toMatchObject({ waiting: 1, resolved: 0, failed: 0 });
    const waiting = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(waiting.resolution).toBeNull();
    expect(waiting.lastErrorCode).toBe("shop_not_uninstalled");
    expect(waiting.nextAttemptAt.getTime()).toBe(now.getTime() + 6 * 60 * 60_000);
    expect(await rowsByTable(shopA)).toEqual(before);

    const atDeadline = await runPrivacyMaintenance({
      retentionDays: 30,
      deps: realDeps,
      now: waiting.dueAt,
    });

    expect(atDeadline).toMatchObject({ resolved: 1, waiting: 0, overdue: 0 });
    const closed = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(closed.resolution).toBe("SHOP_ACTIVE");
    expect(await rowsByTable(shopA)).toEqual(before);
    expect(await prisma.session.count({ where: { shop: SHOP_A } })).toBe(1);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopA } });
    expect(shop.processingEnabled).toBe(true);
  });

  it("erases a shop whose uninstall is processed after its shop/redact arrived", async () => {
    const shopA = await seedShop(SHOP_A);
    const now = new Date();

    // app/uninstalled was missed, so shop/redact finds the shop installed.
    const recorded = await shopRedact(SHOP_A, "shop-redact-before-uninstall");
    await runPrivacyMaintenance({ retentionDays: 30, deps: realDeps, now });
    expect(Object.keys(await rowsByTable(shopA)).length).toBeGreaterThan(3);

    await uninstall(SHOP_A);
    const later = new Date(now.getTime() + 6 * 60 * 60_000);
    const summary = await runPrivacyMaintenance({
      retentionDays: 30,
      deps: realDeps,
      now: later,
    });

    expect(summary).toMatchObject({ resolved: 1, waiting: 0, failed: 0 });
    expect(await rowsByTable(shopA)).toEqual({});
    expect(await prisma.shop.findUnique({ where: { id: shopA } })).toBeNull();
    const request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(request.resolution).toBe("SHOP_DATA_ERASED");
  });

  it("does not erase a shop an operator has put on hold", async () => {
    const shopA = await seedShop(SHOP_A);
    await prisma.shop.update({
      where: { id: shopA },
      data: { processingEnabled: false, processingDisabledReason: "MANUAL" },
    });
    const before = await rowsByTable(shopA);

    const recorded = await shopRedact(SHOP_A, "shop-redact-on-hold");
    const summary = await runPrivacyMaintenance({
      retentionDays: 30,
      deps: realDeps,
    });

    expect(summary).toMatchObject({ waiting: 1, resolved: 0, failed: 0 });
    expect(await rowsByTable(shopA)).toEqual(before);
    expect(await prisma.session.count({ where: { shop: SHOP_A } })).toBe(1);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopA } });
    expect(shop.processingDisabledReason).toBe("MANUAL");
    const request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(request.resolution).toBeNull();
  });

  it("keeps the session of a merchant who installs again just as the erasure finishes", async () => {
    const shopA = await seedShop(SHOP_A);
    await uninstall(SHOP_A);
    await shopRedact(SHOP_A, "shop-redact-then-reinstall");

    // The second purge runs after the old shop row is gone. Installing again
    // at that moment creates a new row and a new offline session.
    let purges = 0;
    const summary = await runPrivacyMaintenance({
      retentionDays: 30,
      deps: {
        deleteSessions: deleteSessionsForShop,
        purgeQueuedJobs: async (shopId) => {
          purges += 1;
          if (purges === 2) {
            await prisma.shop.create({ data: { myshopifyDomain: SHOP_A } });
            await prisma.session.create({
              data: {
                id: `offline_${SHOP_A}`,
                shop: SHOP_A,
                state: "state",
                accessToken: "token-of-the-new-install",
              },
            });
          }
          return purgeQueuedJobsForShop(shopId);
        },
      },
    });

    expect(summary).toMatchObject({ resolved: 1, failed: 0 });
    expect(await prisma.shop.findUnique({ where: { id: shopA } })).toBeNull();
    const sessions = await prisma.session.findMany({ where: { shop: SHOP_A } });
    expect(sessions.map((session) => session.accessToken)).toEqual([
      "token-of-the-new-install",
    ]);
  });

  it("keeps a failed erasure open, refuses reinstall meanwhile and finishes on retry", async () => {
    const shopA = await seedShop(SHOP_A);
    await uninstall(SHOP_A);
    const recorded = await shopRedact(SHOP_A, "shop-redact-retry");
    const now = new Date();

    const failed = await runPrivacyMaintenance({
      retentionDays: 30,
      now,
      deps: {
        ...realDeps,
        purgeQueuedJobs: async () => {
          throw new Error("redis unavailable");
        },
      },
    });

    expect(failed).toMatchObject({ resolved: 0, failed: 1 });
    let request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(request.resolution).toBeNull();
    expect(request.lastErrorCode).toBe("unexpected_error");
    expect(request.attempts).toBe(1);
    expect(request.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);
    expect(Object.keys(await rowsByTable(shopA)).length).toBeGreaterThan(0);

    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopA } });
    expect(shop.processingDisabledReason).toBe("REDACTED");
    await expect(
      reactivateShopAfterVerifiedReinstall({ verifiedDomain: SHOP_A }),
    ).rejects.toMatchObject({ code: "reinstall_denied" });

    // Not due yet: nothing is claimed.
    const early = await runPrivacyMaintenance({
      retentionDays: 30,
      now: new Date(now.getTime() + 30_000),
      deps: realDeps,
    });
    expect(early).toMatchObject({ resolved: 0, failed: 0 });

    const retried = await runPrivacyMaintenance({
      retentionDays: 30,
      now: new Date(now.getTime() + 61_000),
      deps: realDeps,
    });
    expect(retried).toMatchObject({ resolved: 1, failed: 0 });
    request = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: recorded.requestId },
    });
    expect(request.resolution).toBe("SHOP_DATA_ERASED");
    expect(request.lastErrorCode).toBeNull();
    expect(await prisma.shop.findUnique({ where: { id: shopA } })).toBeNull();
  });

  it("reactivates an uninstalled shop on reinstall and then leaves it alone", async () => {
    const shopA = await seedShop(SHOP_A);
    await uninstall(SHOP_A);

    const result = await reactivateShopAfterVerifiedReinstall({
      verifiedDomain: SHOP_A,
    });
    expect(result.reactivated).toBe(true);
    expect(result.shop).toMatchObject({
      id: shopA,
      processingEnabled: true,
      processingDisabledReason: null,
    });

    const again = await reactivateShopAfterVerifiedReinstall({
      verifiedDomain: SHOP_A,
    });
    expect(again.reactivated).toBe(false);
  });

  it("erases shops that stayed uninstalled past the retention window", async () => {
    const expired = await seedShop(SHOP_A);
    const recent = await seedShop(SHOP_B);
    await uninstall(SHOP_A);
    await uninstall(SHOP_B);
    const now = new Date();
    await prisma.shop.update({
      where: { id: expired },
      data: { uninstalledAt: new Date(now.getTime() - 31 * DAY_MS) },
    });
    await prisma.shop.update({
      where: { id: recent },
      data: { uninstalledAt: new Date(now.getTime() - 29 * DAY_MS) },
    });
    const recentBefore = await rowsByTable(recent);

    const summary = await runPrivacyMaintenance({
      retentionDays: 30,
      now,
      deps: realDeps,
    });

    expect(summary).toMatchObject({ retentionRequestsOpened: 1, resolved: 1 });
    expect(await prisma.shop.findUnique({ where: { id: expired } })).toBeNull();
    expect(await rowsByTable(expired)).toEqual({});
    const request = await prisma.privacyRequest.findFirstOrThrow({
      where: { shopRecordId: expired },
    });
    expect(request).toMatchObject({
      origin: "RETENTION_SWEEP",
      topic: "SHOP_REDACT",
      resolution: "SHOP_DATA_ERASED",
      shopifyWebhookId: null,
    });

    const kept = await prisma.shop.findUniqueOrThrow({ where: { id: recent } });
    expect(kept.processingDisabledReason).toBe("UNINSTALLED");
    expect(await rowsByTable(recent)).toEqual(recentBefore);
    expect(await prisma.privacyRequest.count()).toBe(1);
  });

  it("reports open requests that are past the deadline", async () => {
    await seedShop(SHOP_A);
    await uninstall(SHOP_A);
    await shopRedact(SHOP_A, "shop-redact-overdue");
    const later = new Date(Date.now() + 31 * DAY_MS);

    const summary = await runPrivacyMaintenance({
      retentionDays: 30,
      now: later,
      deps: {
        ...realDeps,
        deleteSessions: async () => {
          throw new Error("database unavailable");
        },
      },
    });

    expect(summary).toMatchObject({ failed: 1, overdue: 1 });
  });

  describe("erasure function", () => {
    const erase = (shopId: string, maxRows: number) =>
      getControlPlanePrisma().$queryRaw<{ deleted: bigint }[]>`
        SELECT stocky_privacy_erase_shop_batch(${shopId}, ${maxRows}::integer) AS deleted
      `;

    it("refuses a shop that is installed or only uninstalled", async () => {
      const shopA = await seedShop(SHOP_A);
      const before = await rowsByTable(shopA);

      await expect(erase(shopA, 1000)).rejects.toThrow(
        /stocky_privacy_erasure_refused/,
      );
      await uninstall(SHOP_A);
      const uninstalled = await rowsByTable(shopA);
      await expect(erase(shopA, 1000)).rejects.toThrow(
        /stocky_privacy_erasure_refused/,
      );

      expect(Object.keys(before).length).toBeGreaterThan(3);
      expect(await rowsByTable(shopA)).toEqual(uninstalled);
      expect(
        await prisma.shop.findUnique({ where: { id: shopA } }),
      ).not.toBeNull();
    });

    it("rejects batch sizes outside 1 to 100000 and reports 0 for an unknown shop", async () => {
      for (const size of [0, -1, 100001]) {
        await expect(erase("missing-shop", size)).rejects.toThrow(
          /stocky_privacy_erasure_invalid_batch/,
        );
      }
      expect((await erase("missing-shop", 10))[0].deleted).toBe(0n);
    });

    it("deletes in bounded batches until nothing is left", async () => {
      const shopA = await seedShop(SHOP_A);
      const shopB = await seedShop(SHOP_B);
      const otherShopBefore = await rowsByTable(shopB);
      await uninstall(SHOP_A);
      await prisma.shop.update({
        where: { id: shopA },
        data: { processingDisabledReason: "REDACTED" },
      });

      const batches: bigint[] = [];
      for (let call = 0; call < 100; call += 1) {
        const deleted = (await erase(shopA, 2))[0].deleted;
        if (deleted === 0n) break;
        batches.push(deleted);
      }

      expect(batches.length).toBeGreaterThan(3);
      expect(batches.every((deleted) => deleted <= 2n)).toBe(true);
      expect(await rowsByTable(shopA)).toEqual({});
      expect(await prisma.shop.findUnique({ where: { id: shopA } })).toBeNull();
      expect(await rowsByTable(shopB)).toEqual(otherShopBefore);
    });

    it("cannot be executed by the runtime role", async () => {
      const shopA = await seedShop(SHOP_A);
      await expect(
        asRole(defaultRuntimeRoleName(), (tx) =>
          tx.$queryRawUnsafe(
            `SELECT stocky_privacy_erase_shop_batch($1, 10)`,
            shopA,
          ),
        ),
      ).rejects.toThrow(/permission denied for function/);
    });

    it("is the control plane's only way to delete merchant data", async () => {
      await seedShop(SHOP_A);
      const controlPlane = getControlPlanePrisma();
      const connectedAs = await controlPlane.$queryRaw<{ role: string }[]>`
        SELECT current_user::text AS role
      `;
      expect(connectedAs[0].role).toBe(defaultControlPlaneRoleName());

      await expect(
        controlPlane.$executeRawUnsafe(`DELETE FROM "Supplier"`),
      ).rejects.toThrow(/permission denied for table/);
      await expect(
        controlPlane.$executeRawUnsafe(`DELETE FROM "Shop"`),
      ).rejects.toThrow(/permission denied for table/);
      await expect(
        controlPlane.$transaction((tx) =>
          tx.$executeRawUnsafe(
            `SET LOCAL ROLE "${defaultPrivacyErasureOwnerRoleName()}"`,
          ),
        ),
      ).rejects.toThrow(/permission denied to set role/);
    });

    it("confines its owner role to the shop being erased", async () => {
      const shopA = await seedShop(SHOP_A);
      const shopB = await seedShop(SHOP_B);
      const owner = defaultPrivacyErasureOwnerRoleName();
      const count = `SELECT count(*)::int AS n FROM "Supplier"`;

      const unset = await asRole(owner, (tx) =>
        tx.$queryRawUnsafe<{ n: number }[]>(count),
      );
      expect(unset[0].n).toBe(0);

      const scoped = await asRole(owner, async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT set_config('stocky.privacy_erasure_shop_id', $1, true)`,
          shopA,
        );
        const visible = await tx.$queryRawUnsafe<{ n: number }[]>(count);
        const otherShop = await tx.$queryRawUnsafe<{ id: string }[]>(
          `DELETE FROM "Supplier" WHERE "shopId" = $1 RETURNING "id"`,
          shopB,
        );
        return { visible: visible[0].n, otherShopDeleted: otherShop.length };
      });
      expect(scoped).toEqual({ visible: 3, otherShopDeleted: 0 });

      await expect(
        asRole(owner, (tx) =>
          tx.$queryRawUnsafe(`SELECT "accessToken" FROM "Session"`),
        ),
      ).rejects.toThrow(/permission denied for table/);
      await expect(
        asRole(owner, (tx) =>
          tx.$queryRawUnsafe(`SELECT "myshopifyDomain" FROM "Shop"`),
        ),
      ).rejects.toThrow(/permission denied for table/);
      await expect(
        asRole(owner, (tx) =>
          tx.$queryRawUnsafe(
            `INSERT INTO "Supplier" ("id", "shop", "shopId", "name", "updatedAt")
             VALUES ('x', 'x', $1, 'x', now())`,
            shopA,
          ),
        ),
      ).rejects.toThrow(/permission denied for table/);
    });
  });
});
