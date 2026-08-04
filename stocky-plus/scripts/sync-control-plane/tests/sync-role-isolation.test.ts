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
});
