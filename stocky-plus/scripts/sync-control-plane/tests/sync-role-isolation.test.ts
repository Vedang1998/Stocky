/**
 * F-PR4-06 focused role isolation gate (npm run test:sync-role-isolation).
 */
import { describe, expect, it } from "vitest";
import { DURABLE_JOB_TRANSITION_PAIRS } from "../../../app/sync/state-machine.server";
import { CONTROL_PLANE_SHOP_COLUMNS } from "../roles";

describe("test:sync-role-isolation", () => {
  it("application transition graph includes uninstall cancel edges", () => {
    const pairs = new Set(
      DURABLE_JOB_TRANSITION_PAIRS.map((p) => `${p.from}->${p.to}`),
    );
    expect(pairs.has("DISPATCH_LEASED->CANCELLED")).toBe(true);
    expect(pairs.has("RUNNING->CANCELLED")).toBe(true);
  });

  it("application transition graph includes ENQUEUED→RETRY_WAIT stranded recovery", () => {
    const pairs = new Set(
      DURABLE_JOB_TRANSITION_PAIRS.map((p) => `${p.from}->${p.to}`),
    );
    expect(pairs.has("ENQUEUED->RETRY_WAIT")).toBe(true);
  });

  it("application transition graph includes ENQUEUED→FAILED stranded terminalization", () => {
    const pairs = new Set(
      DURABLE_JOB_TRANSITION_PAIRS.map((p) => `${p.from}->${p.to}`),
    );
    expect(pairs.has("ENQUEUED->FAILED")).toBe(true);
    expect(pairs.has("FAILED->DEAD_LETTERED")).toBe(true);
  });

  it("control-plane Shop column allowlist excludes Session and tokens", () => {
    expect(CONTROL_PLANE_SHOP_COLUMNS).toContain("processingEnabled");
    expect(CONTROL_PLANE_SHOP_COLUMNS).not.toContain("accessToken");
    expect(CONTROL_PLANE_SHOP_COLUMNS).not.toContain("session");
  });

  it("control-plane RLS is enabled+forced on all 11 control-plane tables", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          relname: string;
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }>
      >`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN (
            'DurableJob','WebhookDelivery','JobAttempt','JobDispatch',
            'DeadLetter','JobReplay','SyncRun','SyncCursor',
            'ReconciliationRun','DataIssue','SyncHealth'
          )
      `;
      expect(rows.length).toBe(11);
      for (const r of rows) {
        expect(r.relrowsecurity).toBe(true);
        expect(r.relforcerowsecurity).toBe(true);
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("SyncApplicationReceipt has ENABLE+FORCE RLS as merchant table", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          relrowsecurity: boolean;
          relforcerowsecurity: boolean;
        }>
      >`
        SELECT c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'SyncApplicationReceipt'
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].relrowsecurity).toBe(true);
      expect(rows[0].relforcerowsecurity).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("transition trigger rejects illegal DurableJob state change", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const shop = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-role-${Date.now()}.myshopify.com` },
      });
      const job = await prisma.durableJob.create({
        data: {
          shopId: shop.id,
          jobType: "webhook:orders/create",
          source: "webhook:orders/create",
          queueName: "stocky-webhooks",
          payloadSchemaVersion: "v1",
          sanitizedPayload: {},
          payloadDigest: "e".repeat(64),
          idempotencyKey: `idem-${Date.now()}`,
          correlationId: "c",
          authorityVersion: "tenant-job-envelope-v3",
          state: "PENDING",
        },
      });
      await expect(
        prisma.$executeRaw`
          UPDATE "DurableJob" SET state = 'SUCCEEDED' WHERE id = ${job.id}
        `,
      ).rejects.toThrow(/illegal_job_transition/);
      await prisma.durableJob.delete({ where: { id: job.id } });
      await prisma.shop.delete({ where: { id: shop.id } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("partial unique rejects two unfinished JobAttempts", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const shop = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-attempt-uniq-${Date.now()}.myshopify.com` },
      });
      const job = await prisma.durableJob.create({
        data: {
          shopId: shop.id,
          jobType: "webhook:orders/create",
          source: "webhook:orders/create",
          queueName: "stocky-webhooks",
          payloadSchemaVersion: "v1",
          sanitizedPayload: {},
          payloadDigest: "f".repeat(64),
          idempotencyKey: `idem-uniq-${Date.now()}`,
          correlationId: "c",
          authorityVersion: "tenant-job-envelope-v3",
          state: "RUNNING",
        },
      });
      await prisma.jobAttempt.create({
        data: {
          shopId: shop.id,
          durableJobId: job.id,
          attemptNumber: 1,
          workerId: "w1",
        },
      });
      await expect(
        prisma.jobAttempt.create({
          data: {
            shopId: shop.id,
            durableJobId: job.id,
            attemptNumber: 2,
            workerId: "w2",
          },
        }),
      ).rejects.toThrow();
      await prisma.jobAttempt.deleteMany({ where: { durableJobId: job.id } });
      await prisma.durableJob.delete({ where: { id: job.id } });
      await prisma.shop.delete({ where: { id: shop.id } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("NEW-PR4-C08: stocky_has_application_receipt owner is restricted non-superuser probe role", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { Client } = await import("pg");
    const {
      DEFAULT_RECEIPT_PROBE_OWNER_ROLE,
      defaultReceiptProbeOwnerRoleName,
      provisionReceiptProbeOwner,
      defaultControlPlaneRoleName,
      defaultRuntimeRoleName,
    } = await import("../roles");

    const prisma = new PrismaClient();
    try {
      const fn = await prisma.$queryRaw<Array<{ owner: string }>>`
        SELECT r.rolname AS owner
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_roles r ON r.oid = p.proowner
        WHERE n.nspname = 'public'
          AND p.proname = 'stocky_has_application_receipt'
          AND oidvectortypes(p.proargtypes) = 'text, text'
      `;
      expect(fn.length).toBe(1);

      const expected = defaultReceiptProbeOwnerRoleName();
      expect(expected).toBe(DEFAULT_RECEIPT_PROBE_OWNER_ROLE);

      const url =
        process.env.DATABASE_MIGRATION_URL ||
        process.env.TENANT_MAINTENANCE_DATABASE_URL ||
        process.env.DATABASE_URL;
      expect(url).toBeTruthy();

      const client = new Client({ connectionString: url! });
      await client.connect();
      try {
        await provisionReceiptProbeOwner(client, {
          apply: true,
          controlPlaneRole: defaultControlPlaneRoleName(),
          runtimeRole: defaultRuntimeRoleName(),
          probeOwnerRole: expected,
        });
      } finally {
        await client.end();
      }

      const after = await prisma.$queryRaw<
        Array<{
          owner: string;
          rolsuper: boolean;
          rolbypassrls: boolean;
          rolcanlogin: boolean;
        }>
      >`
        SELECT r.rolname AS owner, r.rolsuper, r.rolbypassrls, r.rolcanlogin
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_roles r ON r.oid = p.proowner
        WHERE n.nspname = 'public'
          AND p.proname = 'stocky_has_application_receipt'
          AND oidvectortypes(p.proargtypes) = 'text, text'
      `;
      expect(after[0]?.owner).toBe(expected);
      expect(after[0]?.rolsuper).toBe(false);
      expect(after[0]?.rolbypassrls).toBe(false);
      expect(after[0]?.rolcanlogin).toBe(false);

      // Runtime must not EXECUTE; control-plane may EXECUTE after provision.
      const grants = await prisma.$queryRaw<
        Array<{ runtime_exec: boolean; public_exec: boolean }>
      >`
        SELECT
          has_function_privilege(
            ${defaultRuntimeRoleName()},
            'stocky_has_application_receipt(text,text)',
            'EXECUTE'
          ) AS runtime_exec,
          has_function_privilege(
            'public',
            'stocky_has_application_receipt(text,text)',
            'EXECUTE'
          ) AS public_exec
      `;
      expect(grants[0]?.runtime_exec).toBe(false);
      expect(grants[0]?.public_exec).toBe(false);
    } finally {
      await prisma.$disconnect();
    }
  });
});
