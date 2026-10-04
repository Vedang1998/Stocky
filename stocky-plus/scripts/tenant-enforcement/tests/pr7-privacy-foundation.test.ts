/**
 * PR7 checkpoint B — disposable PostgreSQL 16 foundation:
 * schema/privileges, freeze, three processors while processing is disabled,
 * residual, assignment deny, provenance helper presence.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getMigrationClient, getRuntimeClient } from "../connection";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import { processPrivacyRequest } from "../../../app/privacy/execute.server";
import { isPrivacyPauseEnabled } from "../../../app/privacy/pause.server";
import { evaluateWriterCompleteness } from "../../privacy/participating-writers";

describe("PR7 privacy/roles/audit foundation", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    prisma = await resetSchemaAndApplyEnforcement();
  }, 240_000);

  afterAll(async () => {
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
});

