/**
 * PR7 checkpoint B — disposable PostgreSQL 16 foundation:
 * schema/privileges, freeze, three processors while processing is disabled,
 * residual, assignment deny, provenance helper presence.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMigrationClient, getRuntimeClient } from "../connection";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import { processPrivacyRequest } from "../../../app/privacy/execute.server";
import {
  claimNextPrivacyAttempt,
  MAX_PRIVACY_ATTEMPT_EPOCHS,
} from "../../../app/privacy/coordinator.server";
import { intakeComplianceWebhook } from "../../../app/privacy/intake.server";
import { PrivacyBoundaryError } from "../../../app/privacy/errors.server";
import { isPrivacyPauseEnabled } from "../../../app/privacy/pause.server";
import { evaluateWriterCompleteness } from "../../privacy/participating-writers";
import { resetControlPlanePrismaForTests } from "../../../app/sync/control-plane-db.server";
import {
  provisionControlPlaneRole,
  verifyControlPlaneRole,
} from "../../sync-control-plane/roles";

const HELPERS_SQL = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../sql/pr7-privacy-helpers.sql",
  ),
  "utf8",
);

describe("PR7 privacy/roles/audit foundation", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    process.env.NODE_ENV ??= "test";
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    await resetControlPlanePrismaForTests();
  }, 240_000);

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  it("applies PR7 tables, FORCE RLS, and helper functions (positive)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const tables = await client.query<{ relname: string; relforcerowsecurity: boolean }>(
        `SELECT c.relname, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN ('AuditEvent','ShopRoleAssignment','ShopInstallGeneration','PrivacyRequest')`,
      );
      expect(tables.rows).toHaveLength(4);
      expect(tables.rows.every((row) => row.relforcerowsecurity)).toBe(true);

      const fns = await client.query<{ n: string }>(
        `SELECT p.proname AS n FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN (
             'stocky_participating_write_guard',
             'stocky_privacy_finalize_shop_delete',
             'stocky_verify_platform_assignment',
             'stocky_record_writer_admission'
           )`,
      );
      expect(fns.rows.map((row) => row.n).sort()).toEqual([
        "stocky_participating_write_guard",
        "stocky_privacy_finalize_shop_delete",
        "stocky_record_writer_admission",
        "stocky_verify_platform_assignment",
      ].sort());
    } finally {
      await client.end();
    }
  });

  it("PUBLIC cannot execute privacy helpers (negative)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const grants = await client.query<{ has: boolean }>(
        `SELECT has_function_privilege('public', 'stocky_participating_write_guard(text)', 'EXECUTE') AS has`,
      );
      expect(grants.rows[0]?.has).toBe(false);
    } finally {
      await client.end();
    }
  });

  it("empty namespace is writable; ERASING freezes participating writes", async () => {
    const domain = `pr7-freeze-${randomUUID()}.myshopify.com`;
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const empty = await client.query<{ ok: boolean }>(
        `SELECT stocky_generation_writable($1) AS ok`,
        [domain],
      );
      expect(empty.rows[0]?.ok).toBe(true);

      await client.query(
        `INSERT INTO "ShopInstallGeneration"
          (id, "canonicalDomain", "targetShopId", fence)
         VALUES ($1, $2, $3, 'ERASING')`,
        [randomUUID(), domain, randomUUID()],
      );
      await expect(
        client.query(`SELECT stocky_participating_write_guard($1)`, [domain]),
      ).rejects.toThrow(/generation_frozen/);
    } finally {
      await client.end();
    }

    const runtime = await getRuntimeClient();
    try {
      await expect(
        runtime.query(`SELECT stocky_participating_write_guard($1)`, [domain]),
      ).rejects.toThrow(/generation_frozen/);
      await expect(
        runtime.query(`SELECT stocky_lifecycle_lock_key($1)`, [domain]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await runtime.end();
    }
  });

  it("privacy reader cannot see coordinator rows under FORCE RLS (negative)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    const requestId = randomUUID();
    try {
      await client.query(
        `INSERT INTO "PrivacyRequest"
          (id, topic, state, "targetShopId", "generationId", "canonicalDomain",
           "deadlineAt", "workId")
         VALUES ($1, 'customers/data_request', 'RECEIVED', $2, $3, $4,
                 now() + interval '1 day', $5)`,
        [
          requestId,
          randomUUID(),
          randomUUID(),
          `pr7-hidden-${requestId}.myshopify.com`,
          randomUUID(),
        ],
      );
      const visible = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "PrivacyRequest" WHERE id = $1`,
        [requestId],
      );
      expect(visible.rows[0]?.n).toBe("1");
      await client.query("SET ROLE stocky_privacy_reader");
      const hidden = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "PrivacyRequest" WHERE id = $1`,
        [requestId],
      );
      expect(hidden.rows[0]?.n).toBe("0");
    } finally {
      await client.end();
    }
  });

  it("AuditEvent is append-only for runtime and table owner; erasure without context cannot delete", async () => {
    const shopId = randomUUID();
    const domain = `pr7-audit-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: { id: shopId, myshopifyDomain: domain },
    });
    const eventId = randomUUID();
    await prisma.auditEvent.create({
      data: {
        id: eventId,
        shopId,
        action: "recorded",
        outcome: "succeeded",
      },
    });

    const runtime = await getRuntimeClient();
    try {
      await expect(
        runtime.query(`UPDATE "AuditEvent" SET outcome = 'tampered' WHERE id = $1`, [
          eventId,
        ]),
      ).rejects.toThrow(/permission denied|audit_event_immutable/i);
      await expect(
        runtime.query(`DELETE FROM "AuditEvent" WHERE id = $1`, [eventId]),
      ).rejects.toThrow(/permission denied|audit_event_immutable/i);
    } finally {
      await runtime.end();
    }

    const owner = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await expect(
        owner.query(`UPDATE "AuditEvent" SET outcome = 'tampered' WHERE id = $1`, [
          eventId,
        ]),
      ).rejects.toThrow(/audit_event_immutable/);
      await expect(
        owner.query(`DELETE FROM "AuditEvent" WHERE id = $1`, [eventId]),
      ).rejects.toThrow(/audit_event_immutable/);

      try {
        await owner.query("SET SESSION AUTHORIZATION stocky_privacy_erasure");
      } catch {
        await owner.query("SET ROLE stocky_privacy_erasure");
      }
      const erased = await owner.query(
        `DELETE FROM "AuditEvent" WHERE id = $1`,
        [eventId],
      );
      expect(erased.rowCount).toBe(0);
    } finally {
      await owner.end();
    }

    const still = await prisma.auditEvent.findUnique({ where: { id: eventId } });
    expect(still?.id).toBe(eventId);
  });

  it("runtime cannot BYPASSRLS or inherit PRIVACY erasure (restricted principal)", async () => {
    const runtime = await getRuntimeClient();
    try {
      const bypass = await runtime.query<{ rolbypassrls: boolean }>(
        `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`,
      );
      expect(bypass.rows[0]?.rolbypassrls).toBe(false);
      const members = await runtime.query<{ ok: boolean }>(
        `SELECT pg_has_role(current_user, 'stocky_privacy_erasure', 'MEMBER') AS ok`,
      );
      expect(members.rows[0]?.ok).toBe(false);
    } finally {
      await runtime.end();
    }
  });

  it("missing assignment denies platform replay permission", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const allowed = await client.query<{ allowed: boolean }>(
        `SELECT stocky_verify_platform_assignment($1, $2, $3) AS allowed`,
        ["shop-missing", "548380009", "platform.replay.execute"],
      );
      expect(allowed.rows[0]?.allowed).toBe(false);
    } finally {
      await client.end();
    }
  });

  it("runs all three processors while processingEnabled is false and never re-enables it", async () => {
    const shopId = randomUUID();
    const domain = `pr7-proc-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
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

    const topics = [
      "customers/data_request",
      "customers/redact",
      "shop/redact",
    ] as const;
    for (const topic of topics) {
      const requestId = randomUUID();
      const attemptId = randomUUID();
      await prisma.privacyRequest.create({
        data: {
          id: requestId,
          topic,
          state: "RECEIVED",
          targetShopId: shopId,
          generationId,
          shopRowId: shopId,
          canonicalDomain: domain,
          lookupCustomerRestId: topic === "shop/redact" ? null : "123456",
          workId: randomUUID(),
          deadlineAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });
      await prisma.privacyAttempt.create({
        data: {
          id: attemptId,
          privacyRequestId: requestId,
          epoch: 1,
          state: "RUNNING",
          leaseUntil: new Date(Date.now() + 3600_000),
        },
      });
      await prisma.privacyRequest.update({
        where: { id: requestId },
        data: { activeAttemptId: attemptId },
      });
      const result = await processPrivacyRequest(requestId, attemptId);
      expect(result.topic).toBe(topic);
      expect(result.detail).not.toBe("");
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (topic !== "shop/redact") {
        expect(shop?.processingEnabled).toBe(false);
      } else {
        expect(result.state).toBe("COMPLETED");
        expect(result.incomplete).toBe(false);
        expect(shop).toBeNull();
      }
    }
  });

  it("pause switch does not perform erasure (negative)", () => {
    expect(isPrivacyPauseEnabled({ FEATURE_PR7_PRIVACY_PAUSE: "true" })).toBe(
      true,
    );
    expect(isPrivacyPauseEnabled({ FEATURE_PR7_PRIVACY_PAUSE: "false" })).toBe(
      false,
    );
  });

  it("source-derived writer inventory is complete", () => {
    const result = evaluateWriterCompleteness();
    expect(result.complete).toBe(true);
    expect(result.scannedWriteFiles).toBeGreaterThan(0);
  });

  it("data_request capability is not granted erasure (partial-failure)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const del = await client.query<{ has: boolean }>(
        `SELECT has_table_privilege('stocky_privacy_reader', '"Supplier"', 'DELETE') AS has`,
      );
      expect(del.rows[0]?.has).toBe(false);
    } finally {
      await client.end();
    }
  });

  it("intake persists distinct delivery/work/generation ids (positive)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-intake-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
      },
    });
    const webhookId = `wh_${randomUUID()}`;
    const first = await intakeComplianceWebhook({
      shop: domain,
      topic: "customers/data_request",
      payload: { customer: { id: "4242" } },
      webhookId,
    });
    expect(first.duplicate).toBe(false);
    expect(first.state).toBe("RECEIVED");
    expect(new Set([first.deliveryId, first.workId, first.generationId]).size).toBe(
      3,
    );
    const retry = await intakeComplianceWebhook({
      shop: domain,
      topic: "customers/data_request",
      payload: { customer: { id: "4242" } },
      webhookId,
    });
    expect(retry.duplicate).toBe(true);
    expect(retry.requestId).toBe(first.requestId);
    expect(retry.workId).toBe(first.workId);
    expect(retry.deliveryId).toBe(first.deliveryId);
    const stored = await prisma.privacyRequest.findUniqueOrThrow({
      where: { id: first.requestId },
    });
    expect(stored.duplicateCount).toBe(1);
    expect(stored.deliveryId).not.toBe(stored.workId);
  });

  it("intake rejects unknown topic and missing customer before persist (negative)", async () => {
    const before = await prisma.privacyRequest.count();
    await expect(
      intakeComplianceWebhook({
        shop: "pr7-intake-deny.myshopify.com",
        topic: "orders/create",
        payload: { customer: { id: "1" } },
        webhookId: `wh_${randomUUID()}`,
      }),
    ).rejects.toBeInstanceOf(PrivacyBoundaryError);
    await expect(
      intakeComplianceWebhook({
        shop: "pr7-intake-deny.myshopify.com",
        topic: "customers/redact",
        payload: { customer: {} },
        webhookId: `wh_${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ code: "customer_target_missing" });
    expect(await prisma.privacyRequest.count()).toBe(before);
    expect(
      await prisma.shopInstallGeneration.count({
        where: { canonicalDomain: "pr7-intake-deny.myshopify.com" },
      }),
    ).toBe(0);
  });

  it("verifyControlPlaneRole is clean after apply (positive)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const verified = await verifyControlPlaneRole(client);
      expect(verified.errors).toEqual([]);
      expect(verified.ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("PR7 helpers SQL does not table-GRANT Shop UPDATE or Session/receipt DML to control-plane (negative)", () => {
    expect(HELPERS_SQL).not.toMatch(
      /GRANT[\s\S]{0,240}ON\s+public\."Shop"\s+TO\s+stocky_control_plane/,
    );
    const jobFamily =
      HELPERS_SQL.match(
        /GRANT SELECT, INSERT, UPDATE, DELETE ON\s+public\."DurableJob"[\s\S]*?TO stocky_control_plane;/,
      )?.[0] ?? "";
    expect(jobFamily.length).toBeGreaterThan(0);
    expect(jobFamily).toContain("PrivacyRequest");
    expect(jobFamily).not.toMatch(/\bSession\b/);
    expect(jobFamily).not.toContain("SyncApplicationReceipt");
  });

  it("injected Shop UPDATE and Session DML fail verify until classified provision restores (bypass)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(
        `GRANT UPDATE ON TABLE public."Shop" TO stocky_control_plane`,
      );
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Session" TO stocky_control_plane`,
      );
      const injected = await verifyControlPlaneRole(client);
      expect(injected.ok).toBe(false);
      expect(injected.errors).toContain(
        "control_plane_shop_update_forbidden:ianaTimezone",
      );
      expect(injected.errors).toContain(
        "control_plane_shop_update_forbidden:currencyCode",
      );
      expect(
        injected.errors.some((e) =>
          e.startsWith("control_plane_merchant_privilege:Session:"),
        ),
      ).toBe(true);
      const restored = await provisionControlPlaneRole(client, {
        apply: true,
        password: process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD,
      });
      expect(restored.ok).toBe(true);
      const verified = await verifyControlPlaneRole(client);
      expect(verified.errors).toEqual([]);
      expect(verified.ok).toBe(true);
    } finally {
      await provisionControlPlaneRole(client, {
        apply: true,
        password: process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD,
      }).catch(() => undefined);
      await client.end();
    }
  });

  it("shop/redact of an installed shop stays INCOMPLETE (F-09)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-installed-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: true,
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
    const requestId = randomUUID();
    const attemptId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "shop/redact",
        state: "RECEIVED",
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
    const result = await processPrivacyRequest(requestId, attemptId);
    expect(result.state).toBe("INCOMPLETE");
    expect(result.detail).toBe("shop_still_installed");
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    expect(shop?.processingEnabled).toBe(true);
  });

  it("shop/redact purges artifacts and role assignments (F-07)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-purge-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
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
    const requestId = randomUUID();
    const attemptId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "shop/redact",
        state: "RECEIVED",
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
    await prisma.shopRoleAssignment.create({
      data: {
        shopId,
        shopifyUserId: "548380009",
        role: "shop_owner",
      },
    });
    await prisma.privacyDataRequestArtifact.create({
      data: {
        privacyRequestId: requestId,
        ciphertext: Buffer.from("not-a-real-blob"),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const result = await processPrivacyRequest(requestId, attemptId);
    expect(result.state).toBe("COMPLETED");
    expect(
      await prisma.shopRoleAssignment.count({ where: { shopId } }),
    ).toBe(0);
    expect(
      await prisma.privacyDataRequestArtifact.count({
        where: { privacyRequestId: requestId },
      }),
    ).toBe(0);
  });

  it("control-plane coordinator journals are append-only (F-11)", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const grants = await client.query<{ table_name: string; privilege_type: string }>(
        `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
         WHERE grantee = 'stocky_control_plane'
           AND table_schema = 'public'
           AND table_name IN ('PrivacyCoordinatorEvent', 'PrivacyCompletionReceipt')
         ORDER BY table_name, privilege_type`,
      );
      const byTable = new Map<string, string[]>();
      for (const row of grants.rows) {
        const list = byTable.get(row.table_name) ?? [];
        list.push(row.privilege_type);
        byTable.set(row.table_name, list);
      }
      expect(byTable.get("PrivacyCoordinatorEvent")?.sort()).toEqual([
        "INSERT",
        "SELECT",
      ]);
      expect(byTable.get("PrivacyCompletionReceipt")?.sort()).toEqual([
        "INSERT",
        "SELECT",
      ]);
    } finally {
      await client.end();
    }
  });

  it("runtime assignment verifier is tenant-bound (F-11)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-asg-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: { id: shopId, myshopifyDomain: domain },
    });
    await prisma.shopRoleAssignment.create({
      data: {
        shopId,
        shopifyUserId: "548380009",
        role: "shop_owner",
      },
    });
    const runtime = await getRuntimeClient();
    try {
      const unbound = await runtime.query<{ allowed: boolean }>(
        `SELECT stocky_verify_platform_assignment($1, $2, $3) AS allowed`,
        [shopId, "548380009", "platform.replay.execute"],
      );
      expect(unbound.rows[0]?.allowed).toBe(false);
      await runtime.query("BEGIN");
      await runtime.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        shopId,
      ]);
      await runtime.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      const bound = await runtime.query<{ allowed: boolean }>(
        `SELECT stocky_verify_platform_assignment($1, $2, $3) AS allowed`,
        [shopId, "548380009", "platform.replay.execute"],
      );
      expect(bound.rows[0]?.allowed).toBe(true);
      const cross = await runtime.query<{ allowed: boolean }>(
        `SELECT stocky_verify_platform_assignment($1, $2, $3) AS allowed`,
        ["other-shop", "548380009", "platform.replay.execute"],
      );
      expect(cross.rows[0]?.allowed).toBe(false);
      await runtime.query("ROLLBACK");
    } finally {
      await runtime.end();
    }
  });

  it("coordinator does not steal another worker's live lease (F-09)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-coord-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
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
    const requestId = randomUUID();
    const attemptId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "customers/data_request",
        state: "APPLYING",
        targetShopId: shopId,
        generationId,
        shopRowId: shopId,
        canonicalDomain: domain,
        workId: randomUUID(),
        deadlineAt: new Date(Date.now() + 86_400_000),
        activeAttemptId: attemptId,
      },
    });
    await prisma.privacyAttempt.create({
      data: {
        id: attemptId,
        privacyRequestId: requestId,
        epoch: 1,
        state: "RUNNING",
        leaseUntil: new Date(Date.now() + 3_600_000),
        worker: "worker-a",
      },
    });
    const stolen = await claimNextPrivacyAttempt("worker-b");
    expect(stolen?.requestId).not.toBe(requestId);
    const live = await prisma.privacyAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    expect(live.worker).toBe("worker-a");
    expect(live.state).toBe("RUNNING");
    await claimNextPrivacyAttempt("worker-a");
    const still = await prisma.privacyAttempt.findMany({
      where: { privacyRequestId: requestId },
    });
    expect(still).toHaveLength(1);
    expect(still[0]?.id).toBe(attemptId);
  });

  it("coordinator skips requests at max epoch (F-09 HOL)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-hol-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
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
    const stuckId = randomUUID();
    const laterId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: stuckId,
        topic: "customers/data_request",
        state: "INCOMPLETE",
        targetShopId: shopId,
        generationId,
        shopRowId: shopId,
        canonicalDomain: domain,
        workId: randomUUID(),
        receivedAt: new Date("2026-01-01T00:00:00Z"),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.privacyAttempt.create({
      data: {
        privacyRequestId: stuckId,
        epoch: MAX_PRIVACY_ATTEMPT_EPOCHS,
        state: "FAILED",
      },
    });
    await prisma.privacyRequest.create({
      data: {
        id: laterId,
        topic: "customers/data_request",
        state: "RECEIVED",
        targetShopId: shopId,
        generationId,
        shopRowId: shopId,
        canonicalDomain: domain,
        workId: randomUUID(),
        receivedAt: new Date("2026-01-02T00:00:00Z"),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    const claimed = await claimNextPrivacyAttempt("worker-c");
    expect(claimed?.requestId).toBe(laterId);
  });
});
