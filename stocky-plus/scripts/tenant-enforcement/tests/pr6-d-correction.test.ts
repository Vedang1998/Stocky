/**
 * PR6-D correction: completeness, poll budget, checkpoint ordinals, Bulk A vs follow-up.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { runOrderFactsImportStep } from "../../../app/lib/order-facts/sync/import";
import {
  getControlPlanePrisma,
  resetControlPlanePrismaForTests,
} from "../../../app/sync/control-plane-db.server";
import {
  SHOP_A_DOMAIN,
  bulkALine,
  bulkARoot,
  countForShop,
  createOrderFactsAdmin,
  jsonlLines,
  setupPr6DDatabase,
  standardStore,
  withTxnHost,
} from "./pr6-d-pg-harness";
import { moneyBag } from "../../../app/lib/order-facts/admin-read/__tests__/fixtures";

describe("PR6-D import completeness, poll, checkpoint, and Bulk A mapping", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    ({ prisma, shopAId } = await setupPr6DDatabase());
  }, 600_000);

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  async function factCount(gid: string): Promise<number> {
    return countForShop(
      shopAId,
      `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
      [gid],
    );
  }

  it("applies 40 completable Bulk A parents without refetching unedited zero-refund orders", async () => {
    const roots = Array.from({ length: 40 }, (_, i) => {
      const gid = `gid://shopify/Order/d-bulk-${i + 1}`;
      return { gid, objects: [bulkALine(gid), bulkARoot(gid)] };
    });
    const stores = Object.fromEntries(
      roots.map((row) => [row.gid, standardStore(row.gid)]),
    );
    const admin = createOrderFactsAdmin({ stores });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-40-bulk",
        correlationId: "import-40-bulk",
        jsonlSource: jsonlLines(roots.flatMap((row) => row.objects)),
        pollBulkOperation: false,
        expectedObjectCount: "80",
        expectedRootObjectCount: "40",
      }),
    );
    expect(result.status, JSON.stringify(result)).toBe("SUCCEEDED");
    if (result.status === "SUCCEEDED") {
      expect(result.examined).toBe(40);
      expect(result.applied).toBe(40);
      expect(result.bulkDirectApplies).toBe(40);
      expect(result.followUpReads).toBe(0);
    }
    const orderFactQueries = admin.calls.filter(
      (call) => call.name === "OrderFactById",
    );
    expect(orderFactQueries).toHaveLength(0);
    expect(await factCount("gid://shopify/Order/d-bulk-1")).toBe(1);
    expect(await factCount("gid://shopify/Order/d-bulk-40")).toBe(1);
  });

  it("counts B follow-ups only for edited or refund-bearing roots", async () => {
    const baseline = "gid://shopify/Order/d-follow-base";
    const edited = "gid://shopify/Order/d-follow-edit";
    const refunded = "gid://shopify/Order/d-follow-refund";
    const admin = createOrderFactsAdmin({
      stores: {
        [baseline]: standardStore(baseline),
        [edited]: standardStore(edited),
        [refunded]: standardStore(refunded),
      },
    });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-follow-up",
        correlationId: "import-follow-up",
        jsonlSource: jsonlLines([
          bulkALine(baseline),
          bulkARoot(baseline),
          bulkALine(edited),
          bulkARoot(edited, { edited: true }),
          bulkALine(refunded),
          bulkARoot(refunded, { totalRefundedSet: moneyBag("1.00") }),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "6",
        expectedRootObjectCount: "3",
      }),
    );
    expect(result.status).toBe("SUCCEEDED");
    if (result.status === "SUCCEEDED") {
      expect(result.bulkDirectApplies).toBe(1);
      expect(result.followUpReads).toBe(2);
    }
    expect(
      admin.calls.filter((call) => call.name === "OrderFactById"),
    ).toHaveLength(2);
  });

  it("does not persist coverage when expected counts do not match streamed bytes", async () => {
    const gid = "gid://shopify/Order/d-count-miss";
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-count-miss",
        correlationId: "import-count-miss",
        jsonlSource: jsonlLines([bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 })]),
        pollBulkOperation: false,
        expectedObjectCount: "2",
        expectedRootObjectCount: "1",
      }),
    );
    expect(result.status).toBe("PARTIAL_FAILURE");
    const run = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-count-miss" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.status).not.toBe("SUCCEEDED");
    expect(run?.partialFailure).toBe(true);
  });

  it("accepts a completed zero-count export without a download URL", async () => {
    const admin = createOrderFactsAdmin({
      stores: {},
      bulk: {
        id: "gid://shopify/BulkOperation/d-empty",
        status: "COMPLETED",
        url: null,
        objectCount: "0",
        rootObjectCount: "0",
      },
    });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-empty-zero",
        correlationId: "import-empty-zero",
        pollBulkOperation: true,
      }),
    );
    expect(result.status).toBe("SUCCEEDED");
  });

  it("fails an empty download of a nonempty export", async () => {
    const admin = createOrderFactsAdmin({
      stores: {},
      bulk: {
        id: "gid://shopify/BulkOperation/d-empty-nonempty",
        status: "COMPLETED",
        url: null,
        objectCount: "4",
        rootObjectCount: "2",
      },
    });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-empty-nonempty",
        correlationId: "import-empty-nonempty",
        pollBulkOperation: true,
      }),
    );
    expect(result.status).toBe("PARTIAL_FAILURE");
    if (result.status === "PARTIAL_FAILURE") {
      expect(result.reason).toBe("empty_download_of_nonempty_export");
    }
  });

  it("exhausts the cumulative poll budget across durable continuations", async () => {
    const admin = createOrderFactsAdmin({
      stores: {},
      bulk: {
        id: "gid://shopify/BulkOperation/d-poll",
        status: "RUNNING",
        pollStatus: "RUNNING",
        objectCount: "1",
        rootObjectCount: "1",
      },
    });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-poll-budget",
        correlationId: "import-poll-budget",
        pollBulkOperation: true,
      }),
    );
    expect(first.status).toBe("CONTINUE");
    const afterFirst = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-poll-budget" },
      orderBy: { createdAt: "desc" },
    });
    expect(afterFirst?.examinedCount).toBe(1);
    await getControlPlanePrisma().syncRun.updateMany({
      where: { shopId: shopAId, correlationId: "import-poll-budget" },
      data: { examinedCount: 120 },
    });
    const exhausted = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-poll-budget",
        correlationId: "import-poll-budget",
        pollBulkOperation: true,
      }),
    );
    expect(exhausted.status).toBe("PARTIAL_FAILURE");
    if (exhausted.status === "PARTIAL_FAILURE") {
      expect(exhausted.reason).toBe("bulk_poll_budget_exhausted");
    }
  });

  it("resumes from the physical JSONL ordinal and does not duplicate applied facts", async () => {
    const firstGid = "gid://shopify/Order/d-ckpt-1";
    const secondGid = "gid://shopify/Order/d-ckpt-2";
    const objects = [
      bulkARoot(firstGid, { currentSubtotalLineItemsQuantity: 0 }),
      bulkALine(secondGid),
      bulkARoot(secondGid),
    ];
    const stores = {
      [firstGid]: standardStore(firstGid),
      [secondGid]: standardStore(secondGid),
    };
    const admin = createOrderFactsAdmin({
      stores,
      bulk: {
        id: "gid://shopify/BulkOperation/d-ckpt",
        status: "COMPLETED",
        objectCount: "3",
        rootObjectCount: "2",
        url: "https://example.invalid/ckpt.jsonl",
      },
    });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-ckpt",
        correlationId: "import-ckpt",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(firstGid, { currentSubtotalLineItemsQuantity: 0 }),
            '{"id":"gid://shopify/Order/trunc"',
          ]),
      }),
    );
    expect(first.status).toBe("PARTIAL_FAILURE");
    expect(await factCount(firstGid)).toBe(1);
    const run = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-ckpt" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.jsonlCommittedLineOrdinal).toBe(1);
    const resumed = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-ckpt",
        correlationId: "import-ckpt",
        pollBulkOperation: true,
        fetchJsonl: async () => jsonlLines(objects),
      }),
    );
    expect(resumed.status).toBe("SUCCEEDED");
    expect(await factCount(firstGid)).toBe(1);
    expect(await factCount(secondGid)).toBe(1);
  });

  it("does not advance a physical checkpoint across an uncommitted gap", async () => {
    const laterGid = "gid://shopify/Order/d-gap-later";
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({
          stores: { [laterGid]: standardStore(laterGid) },
          bulk: {
            id: "gid://shopify/BulkOperation/d-gap",
            status: "COMPLETED",
            objectCount: "2",
            rootObjectCount: "1",
            url: "https://example.invalid/gap.jsonl",
          },
        }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-gap",
        correlationId: "import-gap",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([
            {
              id: "gid://shopify/LineItem/d-gap-missing",
              __parentId: "gid://shopify/Order/d-gap-missing",
            },
            bulkARoot(laterGid, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
      }),
    );
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(await factCount(laterGid)).toBe(1);
    const run = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-gap" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.jsonlCommittedLineOrdinal ?? 0).toBe(0);
  });
});
