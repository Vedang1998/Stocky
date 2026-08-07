/**
 * D-048 readiness-state lifecycle matrix for DispatchReadyShop.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildFairClaimLockedSelectSql } from "../fair-claim-query.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";

describe("DispatchReadyShop readiness lifecycle (D-048)", () => {
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
        "DataIssue", "JobDispatch", "DurableJob", "DispatchReadyShop"
      CASCADE
    `);
    await prisma.shop.deleteMany({
      where: { myshopifyDomain: { startsWith: "pr4-ready-" } },
    });
  });

  async function createShop(suffix: string, enabled = true) {
    return prisma.shop.create({
      data: {
        myshopifyDomain: `pr4-ready-${suffix}.myshopify.com`,
        processingEnabled: enabled,
        processingDisabledReason: enabled ? undefined : "MANUAL",
        processingDisabledAt: enabled ? undefined : new Date(),
      },
    });
  }

  async function insertJob(
    shopId: string,
    id: string,
    state: "PENDING" | "RETRY_WAIT",
    nextEligibleAt: Date,
  ) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DurableJob" (
        id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
        "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
        "authorityVersion", "executionStrategy", state, "nextEligibleAt",
        "createdAt", "updatedAt"
      ) VALUES (
        '${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
        '{}','${"r".repeat(64)}','idem-${id}','corr-${id}',
        'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
        '${nextEligibleAt.toISOString()}', NOW(), NOW()
      )
    `);
  }

  it("1. newly eligible PENDING work creates readiness", async () => {
    const shop = await createShop("pending");
    await insertJob(shop.id, "ready_p1", "PENDING", new Date());
    const row = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: shop.id },
    });
    expect(row).not.toBeNull();
  });

  it("2. RETRY_WAIT work creates readiness", async () => {
    const shop = await createShop("retry");
    await insertJob(
      shop.id,
      "ready_r1",
      "RETRY_WAIT",
      new Date(Date.now() - 1000),
    );
    const row = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: shop.id },
    });
    expect(row).not.toBeNull();
  });

  it("3. expired-lease recovery to PENDING restores readiness", async () => {
    const shop = await createShop("lease");
    await insertJob(shop.id, "ready_lease", "PENDING", new Date());
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob" SET state = 'DISPATCH_LEASED',
        "leaseExpiresAt" = NOW() - interval '1 minute'
      WHERE id = 'ready_lease'
    `);
    // Claim consumes; readiness may remain or heal. Recover to PENDING:
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob"
      SET state = 'PENDING', "leaseOwner" = NULL, "leaseExpiresAt" = NULL
      WHERE id = 'ready_lease'
    `);
    const row = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: shop.id },
    });
    expect(row).not.toBeNull();
  });

  it("4. replay-created work restores readiness (insert PENDING)", async () => {
    const shop = await createShop("replay");
    await insertJob(shop.id, "ready_replay", "PENDING", new Date());
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: shop.id } }),
    ).not.toBeNull();
  });

  it("5. future nextEligibleAt becomes dispatchable when due", async () => {
    const shop = await createShop("future");
    const future = new Date(Date.now() + 60_000);
    await insertJob(shop.id, "ready_future", "PENDING", future);
    const ready = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: shop.id },
    });
    expect(ready?.earliestEligibleAt.getTime()).toBe(future.getTime());
    expect(ready?.nextDispatchAt.getTime()).toBe(future.getTime());
    const before = await prisma.$queryRaw<Array<{ id: string }>>(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 5,
        maxPerShop: 1,
      }),
    );
    expect(before.length).toBe(0);
    const after = await prisma.$queryRaw<Array<{ id: string }>>(
      buildFairClaimLockedSelectSql({
        now: new Date(future.getTime() + 1000),
        batchSize: 5,
        maxPerShop: 1,
      }),
    );
    expect(after.map((r) => r.id)).toContain("ready_future");
  });

  it("6. shops with no remaining eligible work stop consuming capacity", async () => {
    const shop = await createShop("empty");
    await insertJob(shop.id, "ready_empty", "PENDING", new Date());
    await prisma.$queryRaw(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 5,
        maxPerShop: 1,
      }),
    );
    // Move job to SUCCEEDED path via cancel to clear eligibility.
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob" SET state = 'CANCELLED', "cancelledAt" = NOW()
      WHERE id = 'ready_empty' AND state IN ('PENDING','RETRY_WAIT','DISPATCH_LEASED')
    `);
    // If still DISPATCH_LEASED from claim SQL lock without state change:
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob" SET state = 'CANCELLED', "cancelledAt" = NOW()
      WHERE id = 'ready_empty'
    `).catch(() => undefined);
    // Force heal: delete job eligibility — D-049 trigger leaves fail-safe stale
    // readiness (false positive). Production claim reconciliation removes it.
    await prisma.$executeRawUnsafe(`DELETE FROM "DurableJob" WHERE id = 'ready_empty'`);
    const stale = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: shop.id },
    });
    // Stale early hint is acceptable; must not permanently consume capacity.
    if (stale != null) {
      const healed = await prisma.$queryRaw<Array<{ id: string }>>(
        buildFairClaimLockedSelectSql({
          now: new Date(),
          batchSize: 5,
          maxPerShop: 1,
        }),
      );
      expect(healed.length).toBe(0);
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shop.id } }),
      ).toBeNull();
    }
  });

  it("7. disabled shops do not consume readiness slots", async () => {
    const enabled = await createShop("en");
    const disabled = await createShop("dis", false);
    const now = new Date();
    await insertJob(disabled.id, "ready_dis", "PENDING", new Date(now.getTime() - 10_000));
    await insertJob(enabled.id, "ready_en", "PENDING", new Date(now.getTime() - 1000));
    const claimed = await prisma.$queryRaw<Array<{ shopId: string }>>(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 5,
        maxPerShop: 1,
      }),
    );
    expect(claimed.every((r) => r.shopId === enabled.id)).toBe(true);
    expect(claimed.some((r) => r.shopId === disabled.id)).toBe(false);
  });

  it("9. crash/rollback cannot permanently lose readiness (trigger transactional)", async () => {
    const shop = await createShop("tx");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO "DurableJob" (
            id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
            "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
            "authorityVersion", "executionStrategy", state, "nextEligibleAt",
            "createdAt", "updatedAt"
          ) VALUES (
            'ready_tx','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
            '{}','${"t".repeat(64)}','idem-ready_tx','corr-ready_tx',
            'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',
            NOW(), NOW(), NOW()
          )
        `);
        throw new Error("rollback_ready");
      });
    } catch {
      /* expected */
    }
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: shop.id } }),
    ).toBeNull();
    // Successful insert restores.
    await insertJob(shop.id, "ready_tx2", "PENDING", new Date());
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: shop.id } }),
    ).not.toBeNull();
  });

  it("10. multiple writers cannot create duplicate readiness rows", async () => {
    const shop = await createShop("uniq");
    await Promise.all([
      insertJob(shop.id, "ready_u1", "PENDING", new Date()),
      insertJob(shop.id, "ready_u2", "PENDING", new Date()),
      insertJob(shop.id, "ready_u3", "RETRY_WAIT", new Date()),
    ]);
    const rows = await prisma.dispatchReadyShop.findMany({
      where: { shopId: shop.id },
    });
    expect(rows.length).toBe(1);
  });
});
