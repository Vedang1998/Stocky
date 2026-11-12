import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import type { PrismaClient } from "@prisma/client";
import { resetControlPlanePrismaForTests } from "../../sync/control-plane-db.server";
import { readCatalogSyncStatus } from "../../sync/sync-status.server";
import { issueTenantAuthority } from "../authority.server";
import { TenantAuthorityError } from "../errors";
import {
  clearCatalogFacts,
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  wipeSyncControlPlaneTables,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const { sessionShop } = vi.hoisted(() => ({ sessionShop: { domain: "" } }));

// Home authenticates through app/shopify.server. Stand in for Shopify's
// session check only; tenant resolution and every query are real.
vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: async () => ({ admin: {}, session: { shop: sessionShop.domain } }),
  },
}));

const { loader: homeLoader } = await import("../../routes/app._index");

function authority(shopId: string, myshopifyDomain: string) {
  return issueTenantAuthority({
    shopId,
    myshopifyDomain,
    source: "verified_admin_request",
  });
}

describe("catalog sync status reader", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    prisma = createPrisma();
    await resetPublicSchema(prisma);
    await resetControlPlanePrismaForTests();
  });

  beforeEach(async () => {
    await wipeSyncControlPlaneTables(prisma);
    // Home creates a settings row per shop domain; the shops are re-created
    // with new IDs for every test.
    await prisma.shopSettings.deleteMany({});
    await clearCatalogFacts(prisma);
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  async function seedRun(
    shopId: string,
    syncDomain: string,
    status: "SUCCEEDED" | "FAILED" | "RUNNING",
    at: string,
  ) {
    const when = new Date(at);
    await prisma.syncRun.create({
      data: {
        shopId,
        syncDomain,
        source: "catalog_sync",
        status,
        correlationId: `corr-${shopId}-${syncDomain}-${at}`,
        startedAt: when,
        completedAt: status === "SUCCEEDED" ? when : null,
        createdAt: when,
      },
    });
  }

  async function seedJob(shopId: string, jobType: string, at: string) {
    return prisma.durableJob.create({
      data: {
        shopId,
        jobType,
        source: "catalog_sync",
        queueName: "cron",
        payloadSchemaVersion: "test",
        sanitizedPayload: {},
        payloadDigest: "test-digest",
        idempotencyKey: `${jobType}:${shopId}:${at}`,
        correlationId: `corr-${shopId}-${jobType}-${at}`,
        authorityVersion: "v1",
        state: "PENDING",
        createdAt: new Date(at),
      },
    });
  }

  it("reports every catalog domain as not started for a shop with no history", async () => {
    expect(await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN))).toEqual([
      {
        domain: "locations",
        state: "NEVER_STARTED",
        detailCode: null,
        lastSucceededAt: null,
        syncing: false,
      },
      {
        domain: "catalog",
        state: "NEVER_STARTED",
        detailCode: null,
        lastSucceededAt: null,
        syncing: false,
      },
      {
        domain: "inventory_levels",
        state: "NEVER_STARTED",
        detailCode: null,
        lastSucceededAt: null,
        syncing: false,
      },
    ]);
  });

  it("returns only the authorised shop's health and run times", async () => {
    await prisma.syncHealth.createMany({
      data: [
        {
          shopId: shopAId,
          syncDomain: "catalog",
          state: "FAILED",
          detailCode: "open_dead_letter",
          detailSummary: "Unresolved dead letter dl_shop_a",
        },
        { shopId: shopBId, syncDomain: "catalog", state: "HEALTHY", detailCode: "latest_succeeded" },
        { shopId: shopBId, syncDomain: "locations", state: "RUNNING", detailCode: "active_work" },
      ],
    });
    await seedRun(shopAId, "catalog", "SUCCEEDED", "2026-11-09T10:00:00Z");
    await seedRun(shopBId, "catalog", "SUCCEEDED", "2026-11-11T08:00:00Z");

    const a = await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN));
    const b = await readCatalogSyncStatus(authority(shopBId, SHOP_B_DOMAIN));

    expect(a.find((row) => row.domain === "catalog")).toEqual({
      domain: "catalog",
      state: "FAILED",
      detailCode: "open_dead_letter",
      lastSucceededAt: new Date("2026-11-09T10:00:00Z"),
      syncing: false,
    });
    expect(a.find((row) => row.domain === "locations")?.state).toBe("NEVER_STARTED");
    expect(b.find((row) => row.domain === "catalog")).toEqual({
      domain: "catalog",
      state: "HEALTHY",
      detailCode: "latest_succeeded",
      lastSucceededAt: new Date("2026-11-11T08:00:00Z"),
      syncing: false,
    });
    expect(b.find((row) => row.domain === "locations")?.state).toBe("RUNNING");
  });

  it("reports the domains a queued or running catalog sync has not finished yet", async () => {
    await seedJob(shopAId, "catalog-sync", "2026-11-11T09:00:00Z");
    await seedRun(shopAId, "locations", "SUCCEEDED", "2026-11-11T09:00:05Z");
    await seedRun(shopAId, "catalog", "SUCCEEDED", "2026-11-10T09:00:00Z");
    await seedRun(shopAId, "catalog", "RUNNING", "2026-11-11T09:00:06Z");

    const rows = await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN));
    expect(rows.map((row) => [row.domain, row.syncing])).toEqual([
      ["locations", false],
      ["catalog", true],
      ["inventory_levels", true],
    ]);
  });

  it("does not report a sync for another shop's job, a finished job or another kind of job", async () => {
    await seedJob(shopBId, "catalog-sync", "2026-11-11T09:00:00Z");
    await seedJob(shopAId, "inventory-state-reconcile", "2026-11-11T09:00:00Z");
    const finished = await seedJob(shopAId, "catalog-sync", "2026-11-11T08:00:00Z");
    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
      WHERE id = ${finished.id}
    `;

    const a = await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN));
    const b = await readCatalogSyncStatus(authority(shopBId, SHOP_B_DOMAIN));
    expect(a.map((row) => row.syncing)).toEqual([false, false, false]);
    expect(b.map((row) => row.syncing)).toEqual([true, true, true]);
  });

  it("takes the most recent successful run and ignores runs that did not succeed", async () => {
    await seedRun(shopAId, "inventory_levels", "SUCCEEDED", "2026-11-08T10:00:00Z");
    await seedRun(shopAId, "inventory_levels", "SUCCEEDED", "2026-11-10T10:00:00Z");
    await seedRun(shopAId, "inventory_levels", "FAILED", "2026-11-11T07:00:00Z");
    await seedRun(shopAId, "inventory_levels", "RUNNING", "2026-11-11T09:00:00Z");

    const rows = await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN));
    expect(rows.find((row) => row.domain === "inventory_levels")?.lastSucceededAt).toEqual(
      new Date("2026-11-10T10:00:00Z"),
    );
  });

  it("leaves out domains that are not part of the catalog sync", async () => {
    await prisma.syncHealth.create({
      data: { shopId: shopAId, syncDomain: "dispatch_queue_presence", state: "FAILED" },
    });
    const rows = await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN));
    expect(rows.map((row) => row.domain)).toEqual(["locations", "catalog", "inventory_levels"]);
    expect(rows.every((row) => row.state === "NEVER_STARTED")).toBe(true);
  });

  it("does not return the control plane's internal failure summary", async () => {
    await prisma.syncHealth.create({
      data: {
        shopId: shopAId,
        syncDomain: "catalog",
        state: "FAILED",
        detailCode: "failed_sync_run",
        detailSummary: "Failed sync run run_internal_123 without successful successor",
      },
    });
    const rows = await readCatalogSyncStatus(authority(shopAId, SHOP_A_DOMAIN));
    expect(JSON.stringify(rows)).not.toContain("run_internal_123");
  });

  it("refuses an authority that was not issued by a resolver", async () => {
    await prisma.syncHealth.create({
      data: { shopId: shopBId, syncDomain: "catalog", state: "HEALTHY" },
    });
    const forged = {
      shopId: shopBId,
      myshopifyDomain: SHOP_B_DOMAIN,
      source: "verified_admin_request",
      correlationId: "forged",
    } as const;
    await expect(readCatalogSyncStatus(forged)).rejects.toBeInstanceOf(TenantAuthorityError);
  });

  async function homeAs(domain: string) {
    sessionShop.domain = domain;
    const request = new Request("https://app.example.com/app");
    return homeLoader({ request, params: {}, context: {} } as LoaderFunctionArgs);
  }

  it("shows each shop its own sync status on Home", async () => {
    await prisma.syncHealth.createMany({
      data: [
        { shopId: shopAId, syncDomain: "catalog", state: "FAILED", detailCode: "open_dead_letter" },
        { shopId: shopBId, syncDomain: "catalog", state: "HEALTHY", detailCode: "latest_succeeded" },
      ],
    });
    await seedRun(shopBId, "catalog", "SUCCEEDED", "2026-11-11T08:00:00Z");

    const a = await homeAs(SHOP_A_DOMAIN);
    expect(a.syncStatus.attention?.tone).toBe("critical");
    expect(a.syncStatus.rows.find((row) => row.domain === "catalog")).toMatchObject({
      label: "Products",
      badge: { text: "Failed" },
      lastSucceededAt: null,
    });

    const b = await homeAs(SHOP_B_DOMAIN);
    expect(b.syncStatus.attention).toBeNull();
    expect(b.syncStatus.rows.find((row) => row.domain === "catalog")).toMatchObject({
      badge: { text: "Up to date" },
      lastSucceededAt: "2026-11-11T08:00:00.000Z",
    });
  });

  // Store-test finding on PR #96: the first sync left Home on "Not synced
  // yet" until a reload, then showed "Needs attention" for a sync that had
  // succeeded.
  it("shows the first sync as in progress on Home, then as up to date", async () => {
    await seedJob(shopAId, "catalog-sync", "2026-11-11T09:00:00Z");

    const during = await homeAs(SHOP_A_DOMAIN);
    expect(during.syncStatus.inProgress).toBe(true);
    expect(during.syncStatus.rows.map((row) => row.badge.text)).toEqual([
      "Syncing",
      "Syncing",
      "Syncing",
    ]);
    expect((await homeAs(SHOP_B_DOMAIN)).syncStatus.inProgress).toBe(false);

    await prisma.$executeRaw`
      UPDATE "DurableJob" SET state = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW()
      WHERE "shopId" = ${shopAId}
    `;
    for (const syncDomain of ["locations", "catalog", "inventory_levels"]) {
      await seedRun(shopAId, syncDomain, "SUCCEEDED", "2026-11-11T09:01:00Z");
      // What the engine records after a successful sync while removal of
      // products missing from Shopify is held.
      await prisma.syncHealth.create({
        data: {
          shopId: shopAId,
          syncDomain,
          state: "DEGRADED",
          detailCode: "absence_reconciliation_uncertain",
        },
      });
    }

    const after = await homeAs(SHOP_A_DOMAIN);
    expect(after.syncStatus.inProgress).toBe(false);
    expect(after.syncStatus.attention).toBeNull();
    expect(after.syncStatus.rows.map((row) => row.badge.text)).toEqual([
      "Up to date",
      "Up to date",
      "Up to date",
    ]);
  });
});
