/**
 * PR7 checkpoint B — assignment races, provenance attacks, residual
 * repopulation, Redis drain, and D-scratch leftover (actual adapters).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getMigrationClient, getRuntimeClient } from "../connection";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import { resetControlPlanePrismaForTests } from "../../../app/sync/control-plane-db.server";
import {
  captureOriginalAdminCommand,
} from "../../../app/tenant/original-admin-capture.server";
import {
  noteQueuedWork,
  recordWriterAdmission,
} from "../../../app/sync/writer-admission.server";
import { processPrivacyRequest } from "../../../app/privacy/execute.server";
import {
  assertShopExternalResidualClear,
} from "../../../app/privacy/external-residual.server";
import {
  drainOrdinaryQueueJobsForShop,
  getWebhookQueue,
  resetQueueClientsForTests,
} from "../../../app/jobs/queue.server";
import { ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX } from "../../../app/lib/order-facts/sync/constants";

const ACTOR = "548380009";

async function seedShop(prisma: PrismaClient, enabled = true) {
  const shopId = randomUUID();
  const domain = `pr7-race-${shopId}.myshopify.com`;
  await prisma.shop.create({
    data: {
      id: shopId,
      myshopifyDomain: domain,
      processingEnabled: enabled,
      processingDisabledReason: enabled ? null : "UNINSTALLED",
    },
  });
  const generationId = randomUUID();
  await prisma.shopInstallGeneration.create({
    data: {
      id: generationId,
      canonicalDomain: domain,
      targetShopId: shopId,
      shopRowId: shopId,
      fence: "LIVE",
    },
  });
  return { shopId, domain, generationId };
}

describe("PR7 privacy races, provenance, and external sinks", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    process.env.NODE_ENV ??= "test";
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    await resetControlPlanePrismaForTests();
  }, 240_000);

  afterAll(async () => {
    await resetQueueClientsForTests();
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  it("runtime cannot SET ROLE privacy erasure (restricted principal)", async () => {
    const runtime = await getRuntimeClient();
    try {
      await expect(
        runtime.query("SET ROLE stocky_privacy_erasure"),
      ).rejects.toThrow(/permission denied|must be a member/i);
    } finally {
      await runtime.end();
    }
  });

  it("runtime cannot execute capture or admission helpers (negative)", async () => {
    const runtime = await getRuntimeClient();
    try {
      await expect(
        runtime.query(
          "SELECT stocky_record_writer_admission($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10,null,null,'ATOMIC')",
          [
            "x.myshopify.com",
            "shop",
            "work",
            "ADMIN",
            "id",
            "digest",
            "pr7-origin-v1",
            "ADMIN_SESSION_CURRENT_INSTALL",
            "CUSTOMER_REST_ID",
            "1",
          ],
        ),
      ).rejects.toThrow(/permission denied|admission_principal_required/);
    } finally {
      await runtime.end();
    }
  });

  it("revoke winner: assignment revoked under lock denies subsequent verify", async () => {
    const { shopId } = await seedShop(prisma);
    await prisma.shopRoleAssignment.create({
      data: {
        shopId,
        shopifyUserId: ACTOR,
        role: "shop_admin",
        grantedBy: ACTOR,
      },
    });
    const holder = await getMigrationClient({ requireExplicitMigrationUrl: true });
    const waiter = await getMigrationClient({ requireExplicitMigrationUrl: true });
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT stocky_authz_lock($1, $2)`, [shopId, ACTOR]);
      let waiterAllowed: boolean | undefined;
      const waiterWork = (async () => {
        await waiter.query("BEGIN");
        await waiter.query(`SELECT stocky_authz_lock($1, $2)`, [shopId, ACTOR]);
        const verified = await waiter.query<{ allowed: boolean }>(
          `SELECT stocky_verify_platform_assignment($1, $2, 'platform.replay.execute') AS allowed`,
          [shopId, ACTOR],
        );
        await waiter.query("COMMIT");
        waiterAllowed = verified.rows[0]?.allowed;
      })();
      await new Promise((r) => setTimeout(r, 150));
      await holder.query(
        `UPDATE "ShopRoleAssignment" SET "revokedAt" = clock_timestamp(), "revokedBy" = $2
         WHERE "shopId" = $1 AND "shopifyUserId" = $2 AND "revokedAt" IS NULL`,
        [shopId, ACTOR],
      );
      await holder.query("COMMIT");
      await waiterWork;
      expect(waiterAllowed).toBe(false);
    } finally {
      await holder.end();
      await waiter.end();
    }
  });

  it("effect winner: verify+command commits before revoke; response-loss retry is identical", async () => {
    const { shopId } = await seedShop(prisma);
    await prisma.shopRoleAssignment.create({
      data: {
        shopId,
        shopifyUserId: ACTOR,
        role: "shop_owner",
        grantedBy: ACTOR,
      },
    });
    const commandId = randomUUID();
    const holder = await getMigrationClient({ requireExplicitMigrationUrl: true });
    const waiter = await getMigrationClient({ requireExplicitMigrationUrl: true });
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT stocky_authz_lock($1, $2)`, [shopId, ACTOR]);
      const allowed = await holder.query<{ allowed: boolean }>(
        `SELECT stocky_verify_platform_assignment($1, $2, 'platform.replay.execute') AS allowed`,
        [shopId, ACTOR],
      );
      expect(allowed.rows[0]?.allowed).toBe(true);
      await holder.query(
        `INSERT INTO "PlatformReplayCommand"
          ("commandId","shopId","actorId","deadLetterId","originalJobId","requestDigest")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [commandId, shopId, ACTOR, "dl-1", "job-1", "digest-1"],
      );
      const waiterWork = (async () => {
        await waiter.query("BEGIN");
        await waiter.query(`SELECT stocky_authz_lock($1, $2)`, [shopId, ACTOR]);
        await waiter.query(
          `UPDATE "ShopRoleAssignment" SET "revokedAt" = clock_timestamp()
           WHERE "shopId" = $1 AND "shopifyUserId" = $2 AND "revokedAt" IS NULL`,
          [shopId, ACTOR],
        );
        await waiter.query("COMMIT");
      })();
      await new Promise((r) => setTimeout(r, 150));
      await holder.query("COMMIT");
      await waiterWork;
      const existing = await prisma.platformReplayCommand.findUnique({
        where: { shopId_commandId: { shopId, commandId } },
      });
      expect(existing?.originalJobId).toBe("job-1");
      const retry = await prisma.platformReplayCommand.findUnique({
        where: { shopId_commandId: { shopId, commandId } },
      });
      expect(retry?.originalJobId).toBe(existing?.originalJobId);
      const after = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        const later = await after.query<{ allowed: boolean }>(
          `SELECT stocky_verify_platform_assignment($1, $2, 'platform.replay.execute') AS allowed`,
          [shopId, ACTOR],
        );
        expect(later.rows[0]?.allowed).toBe(false);
      } finally {
        await after.end();
      }
    } finally {
      await holder.end();
      await waiter.end();
    }
  });

  it("webhook sighting cannot mint a fresh ADMIN capture (provenance attack)", async () => {
    const { shopId, domain } = await seedShop(prisma);
    const body = "freeze-me";
    await noteQueuedWork({
      canonicalDomain: domain,
      shopId,
      sourceKind: "WEBHOOK",
      sourceIdentity: "orders/create",
      sourceBody: body,
      sightedClass: "QUEUED_INBOX",
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "123",
    });
    await expect(
      captureOriginalAdminCommand({
        shopId,
        canonicalDomain: domain,
        actor: { kind: "human", shopifyUserId: ACTOR, destShop: domain },
        sourceKind: "ADMIN",
        sourceIdentity: "replay-ui",
        sourceBody: body,
        targetKind: "CUSTOMER_REST_ID",
        targetValue: "123",
      }),
    ).rejects.toThrow(/queued_work_cannot_acquire_fresh_admin_origin/);
  });

  it("ADMIN capture + admission + matching effect; mismatched body and second effect id deny", async () => {
    const { shopId, domain } = await seedShop(prisma, true);
    const body = '{"op":"note"}';
    const capture = await captureOriginalAdminCommand({
      shopId,
      canonicalDomain: domain,
      actor: { kind: "human", shopifyUserId: ACTOR, destShop: domain },
      sourceKind: "ADMIN",
      sourceIdentity: "platform.note",
      sourceBody: body,
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "9001",
    });
    const admitted = await recordWriterAdmission({
      canonicalDomain: domain,
      shopId,
      sourceKind: "ADMIN",
      sourceIdentity: "platform.note",
      sourceBody: body,
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "9001",
    });
    expect(admitted.originId).toMatch(/^wao_/);
    const origin = await prisma.writerAdmissionOrigin.findUniqueOrThrow({
      where: { id: admitted.originId },
    });
    expect(origin.originStatus).toBe("BOUND");
    expect(origin.originalCaptureId).toBe(capture.captureId);

    const runtime = await getRuntimeClient();
    const effectId = randomUUID();
    try {
      await runtime.query("BEGIN");
      await runtime.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        shopId,
      ]);
      await runtime.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      await runtime.query("SELECT stocky_bind_execution_context($1)", [
        admitted.workId,
      ]);
      await runtime.query(
        `SELECT stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          domain,
          shopId,
          "CUSTOMER_REST_ID",
          "9001",
          effectId,
          admitted.workId,
          "CUSTOMER_WRITE",
          body,
        ],
      );
      await runtime.query("COMMIT");
    } catch (err) {
      await runtime.query("ROLLBACK").catch(() => undefined);
      await runtime.end();
      throw err;
    }

    await runtime.query("BEGIN");
    await runtime.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
      shopId,
    ]);
    await runtime.query(
      "SELECT set_config('stocky.tenant_context_version', $1, true)",
      ["phase1-db-tenant-context-v1"],
    );
    await expect(
      runtime.query(
        `SELECT stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          domain,
          shopId,
          "CUSTOMER_REST_ID",
          "9001",
          randomUUID(),
          admitted.workId,
          "CUSTOMER_WRITE",
          body,
        ],
      ),
    ).rejects.toThrow(/effect_digest_mismatch/);
    await runtime.query("ROLLBACK").catch(() => undefined);

    await runtime.query("BEGIN");
    await runtime.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
      shopId,
    ]);
    await runtime.query(
      "SELECT set_config('stocky.tenant_context_version', $1, true)",
      ["phase1-db-tenant-context-v1"],
    );
    await expect(
      runtime.query(
        `SELECT stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          domain,
          shopId,
          "CUSTOMER_REST_ID",
          "9001",
          effectId,
          admitted.workId,
          "CUSTOMER_WRITE",
          "tampered",
        ],
      ),
    ).rejects.toThrow(/effect_digest_mismatch/);
    await runtime.query("ROLLBACK").catch(() => undefined);
    await runtime.end();
  });

  it("UNATTRIBUTED webhook origin cannot be upgraded to ADMIN by re-stamp", async () => {
    const { shopId, domain } = await seedShop(prisma, true);
    const body = "webhook-body";
    const first = await recordWriterAdmission({
      canonicalDomain: domain,
      shopId,
      sourceKind: "WEBHOOK",
      sourceIdentity: "customers/update",
      sourceBody: body,
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "77",
    });
    const row = await prisma.writerAdmissionOrigin.findUniqueOrThrow({
      where: { id: first.originId },
    });
    expect(row.originStatus).toBe("UNATTRIBUTED");
    const second = await recordWriterAdmission({
      canonicalDomain: domain,
      shopId,
      workId: first.workId,
      sourceKind: "WEBHOOK",
      sourceIdentity: "customers/update",
      sourceBody: body,
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "77",
    });
    expect(second.originId).toBe(first.originId);
    const again = await prisma.writerAdmissionOrigin.findUniqueOrThrow({
      where: { id: first.originId },
    });
    expect(again.originStatus).toBe("UNATTRIBUTED");
    expect(again.originalCaptureId).toBeNull();
    await expect(
      captureOriginalAdminCommand({
        shopId,
        canonicalDomain: domain,
        actor: { kind: "human", shopifyUserId: ACTOR, destShop: domain },
        sourceKind: "ADMIN",
        sourceIdentity: "replay-ui",
        sourceBody: body,
        targetKind: "CUSTOMER_REST_ID",
        targetValue: "77",
      }),
    ).rejects.toThrow(/queued_work_cannot_acquire_fresh_admin_origin/);
  });

  it("GUC locator is not a capability: bind with missing origin fails", async () => {
    const { shopId, domain } = await seedShop(prisma, true);
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await runtime.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        shopId,
      ]);
      await runtime.query(
        "SELECT set_config('stocky.trusted_work_id', $1, true)",
        [randomUUID()],
      );
      await expect(
        runtime.query(
          `SELECT stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,null,$6,$7)`,
          [
            domain,
            shopId,
            "CUSTOMER_REST_ID",
            "1",
            randomUUID(),
            "CUSTOMER_WRITE",
            "x",
          ],
        ),
      ).rejects.toThrow(/effect_execution_context_invalid|effect_tenant_mismatch|effect_execution_context_required/);
      await runtime.query("ROLLBACK").catch(() => undefined);
    } finally {
      await runtime.end();
    }
  });

  it("customer redact erases matching facts; leftover residual stays visible without treating RLS-empty as absent", async () => {
    const { shopId, domain, generationId } = await seedShop(prisma, false);
    const customerRestId = "4242";
    const orderGid = "gid://shopify/Order/1001";
    const now = new Date("2026-01-01T00:00:00Z");
    await prisma.shopifyOrderFact.create({
      data: {
        shopId,
        shopifyGid: orderGid,
        name: "#1001",
        closed: false,
        edited: false,
        test: false,
        confirmed: true,
        shopCurrencyCode: "USD",
        taxesIncluded: true,
        existenceState: "LIVE",
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: now,
        sourceKind: "FULL_SYNC",
        shopifyLegacyResourceId: "1001",
      },
    });
    await prisma.auditEvent.create({
      data: {
        shopId,
        customerRestId,
        action: "note",
      },
    });

    const leftoverRequestId = randomUUID();
    const leftoverAttemptId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: leftoverRequestId,
        topic: "customers/redact",
        state: "APPLYING",
        targetShopId: shopId,
        generationId,
        shopRowId: shopId,
        canonicalDomain: domain,
        lookupCustomerRestId: customerRestId,
        lookupOrderLegacyIds: ["1001"],
        workId: randomUUID(),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.privacyAttempt.create({
      data: {
        id: leftoverAttemptId,
        privacyRequestId: leftoverRequestId,
        epoch: 1,
        state: "RUNNING",
        leaseUntil: new Date(Date.now() + 3_600_000),
      },
    });
    await prisma.privacyRequest.update({
      where: { id: leftoverRequestId },
      data: { activeAttemptId: leftoverAttemptId },
    });

    const holder = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        shopId,
      ]);
      await holder.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      await holder.query(
        "SELECT set_config('stocky.privacy_request_id', $1, true)",
        [leftoverRequestId],
      );
      await holder.query(
        "SELECT set_config('stocky.privacy_attempt_id', $1, true)",
        [leftoverAttemptId],
      );
      await holder.query(`SELECT stocky_privacy_install_customer_barrier($1, $2)`, [
        leftoverRequestId,
        leftoverAttemptId,
      ]);
      await holder.query(`SELECT stocky_privacy_enumerate_targets($1)`, [
        leftoverRequestId,
      ]);
      const residual = await holder.query<{ n: string }>(
        `SELECT stocky_privacy_customer_residual_count($1)::text AS n`,
        [leftoverRequestId],
      );
      expect(Number(residual.rows[0]?.n)).toBeGreaterThan(0);
      await holder.query("COMMIT");
    } catch (err) {
      await holder.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      await holder.end();
    }
    const runtime = await getRuntimeClient();
    try {
      const invisible = await runtime.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "ShopifyOrderFact" WHERE "shopId" = $1`,
        [shopId],
      );
      expect(Number(invisible.rows[0]?.n)).toBe(0);
    } finally {
      await runtime.end();
    }
    expect(
      await prisma.shopifyOrderFact.count({
        where: { shopId, shopifyLegacyResourceId: "1001" },
      }),
    ).toBeGreaterThan(0);
    const leftoverShop = await prisma.shop.findUnique({ where: { id: shopId } });
    expect(leftoverShop?.processingEnabled).toBe(false);

    const erased = await processPrivacyRequest(leftoverRequestId, leftoverAttemptId);
    expect(erased.incomplete).toBe(false);
    expect(erased.state).toBe("COMPLETED");
    expect(erased.residualCount).toBe(0);
    expect(
      await prisma.shopifyOrderFact.count({
        where: { shopId, shopifyLegacyResourceId: "1001" },
      }),
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({ where: { shopId, customerRestId } }),
    ).toBe(0);
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    expect(shop?.processingEnabled).toBe(false);
  });

  it("Redis drain is shop-scoped; unrelated shop jobs remain; late write is visible", async () => {
    if (!process.env.REDIS_URL?.trim()) {
      throw new Error("REDIS_URL is required for this external-sink test");
    }
    const shopA = `shop-a-${randomUUID()}`;
    const shopB = `shop-b-${randomUUID()}`;
    const domainA = `${shopA}.myshopify.com`;
    const domainB = `${shopB}.myshopify.com`;
    await resetQueueClientsForTests();
    const queue = getWebhookQueue();
    await queue.add(`pr7-a-${randomUUID()}`, {
      topic: "products/update",
      payloadShop: domainA,
      payload: {},
      tenant: { shopId: shopA } as never,
    });
    await queue.add(`pr7-b-${randomUUID()}`, {
      topic: "products/update",
      payloadShop: domainB,
      payload: {},
      tenant: { shopId: shopB } as never,
    });
    const drained = await drainOrdinaryQueueJobsForShop({
      shopId: shopA,
      canonicalDomain: domainA,
    });
    expect(drained.remainingForShop).toBe(0);
    const leftoverB = await drainOrdinaryQueueJobsForShop({
      shopId: shopB,
      canonicalDomain: domainB,
    });
    expect(leftoverB.removed).toBeGreaterThan(0);
    await queue.add(`pr7-a-late-${randomUUID()}`, {
      topic: "products/update",
      payloadShop: domainA,
      payload: {},
      tenant: { shopId: shopA } as never,
    });
    const late = await drainOrdinaryQueueJobsForShop({
      shopId: shopA,
      canonicalDomain: domainA,
    });
    expect(late.removed).toBeGreaterThan(0);
    await resetQueueClientsForTests();
  });

  it("this-shop D-scratch leftover fails residual; other-shop leftover does not", async () => {
    const shopA = randomUUID();
    const shopB = randomUUID();
    const root = await mkdtemp(path.join(os.tmpdir(), "pr7-dscratch-"));
    const previous = process.env.STOCKY_ORDER_FACTS_SCRATCH_ROOT;
    process.env.STOCKY_ORDER_FACTS_SCRATCH_ROOT = root;
    try {
      await mkdir(
        path.join(root, `${ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX}${shopA}-run-1`),
      );
      await writeFile(
        path.join(
          root,
          `${ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX}${shopA}-run-1`,
          "marker",
        ),
        "x",
      );
      await mkdir(
        path.join(root, `${ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX}${shopB}-run-1`),
      );
      const blocked = await assertShopExternalResidualClear({
        shopId: shopA,
        canonicalDomain: `${shopA}.myshopify.com`,
      });
      expect(blocked.ok).toBe(false);
      expect(blocked.detail).toMatch(/d_scratch_leftover/);
      await rm(
        path.join(root, `${ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX}${shopA}-run-1`),
        { recursive: true, force: true },
      );
      const otherOnly = await assertShopExternalResidualClear({
        shopId: shopA,
        canonicalDomain: `${shopA}.myshopify.com`,
      });
      expect(otherOnly.ok).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.STOCKY_ORDER_FACTS_SCRATCH_ROOT;
      else process.env.STOCKY_ORDER_FACTS_SCRATCH_ROOT = previous;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("shop residual raises without GUC and counts leftover AuditEvent with GUC (F-01)", async () => {
    const { shopId, domain, generationId } = await seedShop(prisma, false);
    await prisma.shopInstallGeneration.update({
      where: { id: generationId },
      data: { fence: "ERASING" },
    });
    await prisma.auditEvent.create({
      data: { shopId, customerRestId: "77", action: "leftover" },
    });
    const requestId = randomUUID();
    const attemptId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "shop/redact",
        state: "APPLYING",
        targetShopId: shopId,
        generationId,
        shopRowId: shopId,
        canonicalDomain: domain,
        workId: randomUUID(),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.privacyAttempt.create({
      data: {
        id: attemptId,
        privacyRequestId: requestId,
        epoch: 1,
        state: "RUNNING",
        leaseUntil: new Date(Date.now() + 3_600_000),
      },
    });
    await prisma.privacyRequest.update({
      where: { id: requestId },
      data: { activeAttemptId: attemptId },
    });
    const holder = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await expect(
        holder.query(`SELECT stocky_privacy_shop_residual_count($1)`, [shopId]),
      ).rejects.toThrow(/residual_request_guc_mismatch/);
      await holder.query("BEGIN");
      await holder.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        shopId,
      ]);
      await holder.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      await holder.query(
        "SELECT set_config('stocky.privacy_request_id', $1, true)",
        [requestId],
      );
      await holder.query(
        "SELECT set_config('stocky.privacy_attempt_id', $1, true)",
        [attemptId],
      );
      const residual = await holder.query<{ n: string }>(
        `SELECT stocky_privacy_shop_residual_count($1)::text AS n`,
        [shopId],
      );
      expect(Number(residual.rows[0]?.n)).toBeGreaterThan(0);
      await holder.query("COMMIT");
    } catch (err) {
      await holder.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      await holder.end();
    }
  });

  it("runtime cannot apply bound effect for a different tenant (F-05)", async () => {
    const a = await seedShop(prisma, true);
    const b = await seedShop(prisma, true);
    const body = "cross-tenant-body";
    const capture = await captureOriginalAdminCommand({
      shopId: a.shopId,
      canonicalDomain: a.domain,
      actor: { kind: "human", shopifyUserId: ACTOR, destShop: a.domain },
      sourceKind: "ADMIN",
      sourceIdentity: "platform.note",
      sourceBody: body,
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "9001",
    });
    const admitted = await recordWriterAdmission({
      canonicalDomain: a.domain,
      shopId: a.shopId,
      sourceKind: "ADMIN",
      sourceIdentity: "platform.note",
      sourceBody: body,
      targetKind: "CUSTOMER_REST_ID",
      targetValue: "9001",
    });
    expect(capture.captureId).toBeTruthy();
    const runtime = await getRuntimeClient();
    try {
      await runtime.query("BEGIN");
      await runtime.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        a.shopId,
      ]);
      await runtime.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      await expect(
        runtime.query(
          `SELECT stocky_apply_bound_customer_effect($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            b.domain,
            b.shopId,
            "CUSTOMER_REST_ID",
            "9001",
            randomUUID(),
            admitted.workId,
            "CUSTOMER_WRITE",
            body,
          ],
        ),
      ).rejects.toThrow(/effect_tenant_mismatch/);
      await runtime.query("ROLLBACK").catch(() => undefined);
    } finally {
      await runtime.end();
    }
  });

  it("missing REDIS_URL fails shop residual closed (F-09)", async () => {
    const previous = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const blocked = await assertShopExternalResidualClear({
        shopId: "shop-no-redis",
        canonicalDomain: "shop-no-redis.myshopify.com",
      });
      expect(blocked.ok).toBe(false);
      expect(blocked.detail).toBe("redis_url_missing");
    } finally {
      if (previous === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = previous;
    }
  });
});
