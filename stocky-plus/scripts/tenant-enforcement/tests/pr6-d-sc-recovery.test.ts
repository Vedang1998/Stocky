/**
 * PR6-D SC-02 recovery: no positional skip across a newly staged source;
 * reconstruct via content-bound C receipts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { runOrderFactsImportStep } from "../../../app/lib/order-facts/sync/import";
import { runOrderFactsSyncJob } from "../../../app/jobs/workers/order-facts/sync-jobs";
import { processOrderFactsWebhookJob } from "../../../app/lib/order-facts/sync";
import {
  getControlPlanePrisma,
  resetControlPlanePrismaForTests,
} from "../../../app/sync/control-plane-db.server";
import {
  SHOP_A_DOMAIN,
  agreementNode,
  bulkALine,
  bulkARoot,
  countForShop,
  createOrderFactsAdmin,
  inWindowHeader,
  insertSyncApplicationReceipt,
  jsonlLines,
  saleNode,
  setupPr6DDatabase,
  standardStore,
  webhookWork,
  withTxnHost,
} from "./pr6-d-pg-harness";
import {
  moneyBag,
  refundLineNode,
  refundNode,
} from "../../../app/lib/order-facts/admin-read/__tests__/fixtures";
import { nominatedReceipt } from "../../../app/lib/order-facts/sync/apply-nominated";
import { ORDER_FACTS_SYNC_JOB_TYPE } from "../../../app/lib/order-facts/sync/constants";
import { operationNameOf } from "../../../app/lib/order-facts/admin-read/__tests__/mock-admin";

const checkpointGate = vi.hoisted(() => ({ failNextAck: false }));

vi.mock("../../../app/lib/catalog-facts/ingest/checkpoint", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../app/lib/catalog-facts/ingest/checkpoint")
    >();
  return {
    ...actual,
    acknowledgeJsonlBatch: async (
      input: Parameters<typeof actual.acknowledgeJsonlBatch>[0],
    ) => {
      if (checkpointGate.failNextAck) {
        checkpointGate.failNextAck = false;
        throw new Error("injected_checkpoint_loss");
      }
      return actual.acknowledgeJsonlBatch(input);
    },
  };
});

const IMPORT_SOURCE = readFileSync(
  fileURLToPath(new URL("../../../app/lib/order-facts/sync/import.ts", import.meta.url)),
  "utf8",
);

describe("PR6-D SC-02 source-bound recovery guards", () => {
  it("does not initialize skipThroughOrdinal from a persisted checkpoint", () => {
    expect(IMPORT_SOURCE).not.toMatch(
      /jsonlCommittedLineOrdinal \?\? 0\)\s*;\s*let contiguousCommitted = skipThroughOrdinal/,
    );
    expect(IMPORT_SOURCE).toMatch(/contiguous:\s*0/);
    expect(IMPORT_SOURCE).toMatch(/nominatedImportReceipt/);
    expect(IMPORT_SOURCE).toMatch(/import_legacy_receipt_fresh_run_required/);
  });
});

describe("PR6-D SC-02 reordered recovery and mutation rejection", () => {
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

  it("recovers BOTH facts after a positive checkpoint, scratch loss, and B-then-A reorder", async () => {
    const gidA = "gid://shopify/Order/sc02-a";
    const gidB = "gid://shopify/Order/sc02-b";
    const stores = {
      [gidA]: standardStore(gidA),
      [gidB]: standardStore(gidB),
    };
    const admin = createOrderFactsAdmin({
      stores,
      bulk: {
        id: "gid://shopify/BulkOperation/sc02",
        status: "COMPLETED",
        objectCount: "2",
        rootObjectCount: "2",
        url: "https://example.invalid/sc02.jsonl",
      },
    });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-reorder",
        correlationId: "import-sc02-reorder",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(gidA, { currentSubtotalLineItemsQuantity: 0 }),
            ((root) => {
              const copy = { ...root };
              delete copy.confirmed;
              return copy;
            })(bulkARoot(gidB, { currentSubtotalLineItemsQuantity: 0 })),
          ]),
      }),
    );
    expect(first.status).toBe("PARTIAL_FAILURE");
    expect(await factCount(gidA)).toBe(1);
    expect(await factCount(gidB)).toBe(0);
    const run = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-sc02-reorder" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.jsonlCommittedLineOrdinal).toBeGreaterThan(0);
    const resumed = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-reorder",
        correlationId: "import-sc02-reorder",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(gidB, { currentSubtotalLineItemsQuantity: 0 }),
            bulkARoot(gidA, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
      }),
    );
    expect(resumed.status, JSON.stringify(resumed)).toBe("SUCCEEDED");
    expect(await factCount(gidA)).toBe(1);
    expect(await factCount(gidB)).toBe(1);
    if (resumed.status === "SUCCEEDED") {
      expect(resumed.verifiedReplayApplies).toBe(1);
      expect(
        resumed.bulkDirectApplies +
          resumed.followUpReads +
          resumed.verifiedReplayApplies,
      ).toBe(2);
    }
  });

  it("recovers the same reorder through the durable worker wrapper", async () => {
    const gidA = "gid://shopify/Order/sc02-worker-a";
    const gidB = "gid://shopify/Order/sc02-worker-b";
    const stores = {
      [gidA]: standardStore(gidA),
      [gidB]: standardStore(gidB),
    };
    const admin = createOrderFactsAdmin({ stores });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsSyncJob({
        authority: {
          shopId: shopAId,
          myshopifyDomain: SHOP_A_DOMAIN,
          source: "verified_job",
          correlationId: "import-sc02-worker",
        },
        admin,
        db,
        durableJobId: "import-sc02-worker",
        correlationId: "import-sc02-worker",
        jsonlSource: jsonlLines([
          bulkARoot(gidA, { currentSubtotalLineItemsQuantity: 0 }),
          ((root) => {
            const copy = { ...root };
            delete copy.confirmed;
            return copy;
          })(bulkARoot(gidB, { currentSubtotalLineItemsQuantity: 0 })),
        ]),
        payload: {
          expectedObjectCount: "2",
          expectedRootObjectCount: "2",
        },
      }),
    );
    expect(first.status).toBe("PARTIAL_FAILURE");
    const resumed = await withTxnHost(shopAId, (db) =>
      runOrderFactsSyncJob({
        authority: {
          shopId: shopAId,
          myshopifyDomain: SHOP_A_DOMAIN,
          source: "verified_job",
          correlationId: "import-sc02-worker",
        },
        admin,
        db,
        durableJobId: "import-sc02-worker",
        correlationId: "import-sc02-worker",
        jsonlSource: jsonlLines([
          bulkARoot(gidB, { currentSubtotalLineItemsQuantity: 0 }),
          bulkARoot(gidA, { currentSubtotalLineItemsQuantity: 0 }),
        ]),
        payload: {
          expectedObjectCount: "2",
          expectedRootObjectCount: "2",
        },
      }),
    );
    expect(resumed.status, JSON.stringify(resumed)).toBe("SUCCEEDED");
    expect(await factCount(gidA)).toBe(1);
    expect(await factCount(gidB)).toBe(1);
  });

  it("does not duplicate identical re-downloads or whitespace/framing changes", async () => {
    const gid = "gid://shopify/Order/sc02-ident";
    const admin = createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-ident",
        correlationId: "import-sc02-ident",
        jsonlSource: jsonlLines([
          bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      }),
    );
    expect(first.status).toBe("SUCCEEDED");
    const second = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-ident",
        correlationId: "import-sc02-ident-2",
        jsonlSource: (async function* () {
          yield "\n";
          yield `${JSON.stringify(bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }))}\n`;
          yield "\n";
        })(),
        pollBulkOperation: false,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      }),
    );
    expect(second.status, JSON.stringify(second)).toBe("SUCCEEDED");
    expect(await factCount(gid)).toBe(1);
  });

  it("fails closed on mutated already-receipted parent content", async () => {
    const gid = "gid://shopify/Order/sc02-mut";
    const admin = createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-mut",
        correlationId: "import-sc02-mut",
        jsonlSource: jsonlLines([
          bulkALine(gid),
          bulkARoot(gid),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "2",
        expectedRootObjectCount: "1",
      }),
    );
    expect(first.status).toBe("SUCCEEDED");
    const mutated = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-mut",
        correlationId: "import-sc02-mut",
        jsonlSource: jsonlLines([
          bulkALine(gid, 1, { quantity: 99 }),
          bulkARoot(gid),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "2",
        expectedRootObjectCount: "1",
      }),
    );
    expect(mutated.status).toBe("PARTIAL_FAILURE");
    if (mutated.status === "PARTIAL_FAILURE") {
      expect(mutated.reason).toBe(
        "import_receipt_content_conflict_fresh_run_required",
      );
    }
    expect(await factCount(gid)).toBe(1);
  });

  it("does not treat identity-only legacy receipts as content-bound proof", async () => {
    const gid = "gid://shopify/Order/sc02-legacy";
    const legacy = nominatedReceipt({
      durableJobId: "import-sc02-legacy",
      shopifyGid: gid,
      sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
      fenceGeneration: 1n,
    });
    await insertSyncApplicationReceipt({
      shopId: shopAId,
      applicationKey: legacy.applicationKey,
      sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
      rootDurableJobId: "import-sc02-legacy",
      firstApplyingDurableJobId: "import-sc02-legacy",
      payloadDigest: legacy.payloadDigest,
    });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin: createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } }),
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-legacy",
        correlationId: "import-sc02-legacy",
        jsonlSource: jsonlLines([
          bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      }),
    );
    expect(result.status).toBe("PARTIAL_FAILURE");
    if (result.status === "PARTIAL_FAILURE") {
      expect(result.reason).toBe("import_legacy_receipt_fresh_run_required");
    }
    expect(await factCount(gid)).toBe(0);
  });

  it("reconstructs after commit-before-checkpoint crash without duplicating the fact", async () => {
    const gid = "gid://shopify/Order/sc02-ckpt-loss";
    const admin = createOrderFactsAdmin({
      stores: { [gid]: standardStore(gid) },
      bulk: {
        id: "gid://shopify/BulkOperation/sc02-ckpt-loss",
        status: "COMPLETED",
        objectCount: "1",
        rootObjectCount: "1",
        url: "https://example.invalid/sc02-ckpt-loss.jsonl",
      },
    });
    checkpointGate.failNextAck = true;
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-ckpt-loss",
        correlationId: "import-sc02-ckpt-loss",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
      }),
    );
    expect(first.status).toBe("PARTIAL_FAILURE");
    expect(await factCount(gid)).toBe(1);
    const run = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-sc02-ckpt-loss" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.jsonlCommittedLineOrdinal ?? 0).toBe(0);
    const resumed = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-ckpt-loss",
        correlationId: "import-sc02-ckpt-loss",
        pollBulkOperation: true,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
      }),
    );
    expect(resumed.status, JSON.stringify(resumed)).toBe("SUCCEEDED");
    expect(await factCount(gid)).toBe(1);
  });

  it("recovers after deleting the interrupted attempt scratch directory", async () => {
    const gidA = "gid://shopify/Order/sc02-scratch-a";
    const gidB = "gid://shopify/Order/sc02-scratch-b";
    const scratch = mkdtempSync(path.join(os.tmpdir(), "pr6-d-sc02-"));
    mkdirSync(scratch, { recursive: true });
    const stores = {
      [gidA]: standardStore(gidA),
      [gidB]: standardStore(gidB),
    };
    const admin = createOrderFactsAdmin({
      stores,
      bulk: {
        id: "gid://shopify/BulkOperation/sc02-scratch",
        status: "COMPLETED",
        objectCount: "2",
        rootObjectCount: "2",
        url: "https://example.invalid/sc02-scratch.jsonl",
      },
    });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-scratch",
        correlationId: "import-sc02-scratch",
        pollBulkOperation: true,
        scratchRoot: scratch,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(gidA, { currentSubtotalLineItemsQuantity: 0 }),
            ((root) => {
              const copy = { ...root };
              delete copy.confirmed;
              return copy;
            })(bulkARoot(gidB, { currentSubtotalLineItemsQuantity: 0 })),
          ]),
      }),
    );
    expect(first.status).toBe("PARTIAL_FAILURE");
    expect(await factCount(gidA)).toBe(1);
    rmSync(scratch, { recursive: true, force: true });
    mkdirSync(scratch, { recursive: true });
    const resumed = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-scratch",
        correlationId: "import-sc02-scratch",
        pollBulkOperation: true,
        scratchRoot: scratch,
        fetchJsonl: async () =>
          jsonlLines([
            bulkARoot(gidB, { currentSubtotalLineItemsQuantity: 0 }),
            bulkARoot(gidA, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
      }),
    );
    expect(resumed.status, JSON.stringify(resumed)).toBe("SUCCEEDED");
    expect(await factCount(gidA)).toBe(1);
    expect(await factCount(gidB)).toBe(1);
    rmSync(scratch, { recursive: true, force: true });
  });

  it("does not duplicate when two overlapping imports share a durable job", async () => {
    const gid = "gid://shopify/Order/sc02-overlap";
    const admin = createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } });
    const runOnce = () =>
      withTxnHost(shopAId, (db) =>
        runOrderFactsImportStep({
          db,
          admin,
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          shopId: shopAId,
          durableJobId: "import-sc02-overlap",
          correlationId: "import-sc02-overlap",
          jsonlSource: jsonlLines([
            bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
          pollBulkOperation: false,
          expectedObjectCount: "1",
          expectedRootObjectCount: "1",
        }),
      );
    const [left, right] = await Promise.all([runOnce(), runOnce()]);
    expect([left.status, right.status].sort()).toContain("SUCCEEDED");
    expect(await factCount(gid)).toBe(1);
  });

  it("keeps import receipts exactly-once across overlapping webhook activity", async () => {
    const gid = "gid://shopify/Order/sc02-wh";
    const store = standardStore(gid, {
      header: inWindowHeader({
        id: gid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      }),
    });
    const admin = createOrderFactsAdmin({ stores: { [gid]: store } });
    const [imported, webhook] = await Promise.all([
      withTxnHost(shopAId, (db) =>
        runOrderFactsImportStep({
          db,
          admin,
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          shopId: shopAId,
          durableJobId: "import-sc02-wh",
          correlationId: "import-sc02-wh",
          jsonlSource: jsonlLines([
            bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
          ]),
          pollBulkOperation: false,
          expectedObjectCount: "1",
          expectedRootObjectCount: "1",
        }),
      ),
      withTxnHost(shopAId, (db) =>
        processOrderFactsWebhookJob({
          db,
          admin,
          shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
          work: webhookWork({
            shopId: shopAId,
            topic: "orders/edited",
            projection: { order_edit: { id: 1, order_id: "sc02-wh" } },
            receivedAt: new Date(),
          }),
        }),
      ).catch((error) => ({
        status: "threw" as const,
        reason: error instanceof Error ? error.message : String(error),
      })),
    ]);
    expect(imported.status).toBe("SUCCEEDED");
    expect(webhook.status === "applied" || webhook.status === "threw" || webhook.status === "already_applied" || webhook.status === "incomplete" || webhook.status === "first_confirmation_pending" || webhook.status === "blocked" || webhook.status === "noop").toBe(true);
    expect(await factCount(gid)).toBe(1);
  });

  it("fails closed when a newer attempt is already the live sync run and a stale prefix cannot skip the new stage", async () => {
    const gid = "gid://shopify/Order/sc02-stale";
    const admin = createOrderFactsAdmin({ stores: { [gid]: standardStore(gid) } });
    const first = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-stale",
        correlationId: "import-sc02-stale",
        jsonlSource: jsonlLines([
          bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      }),
    );
    expect(first.status).toBe("SUCCEEDED");
    await getControlPlanePrisma().syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "order_facts",
        source: "order-facts-sync",
        status: "RUNNING",
        correlationId: "import-sc02-stale",
        jsonlCommittedLineOrdinal: 99,
        startedAt: new Date(),
      },
    });
    const stale = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc02-stale",
        correlationId: "import-sc02-stale",
        jsonlSource: jsonlLines([
          bulkARoot(gid, { currentSubtotalLineItemsQuantity: 0 }),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
      }),
    );
    expect(stale.status, JSON.stringify(stale)).toBe("SUCCEEDED");
    expect(await factCount(gid)).toBe(1);
    const latest = await getControlPlanePrisma().syncRun.findFirst({
      where: { shopId: shopAId, correlationId: "import-sc02-stale" },
      orderBy: { createdAt: "desc" },
    });
    expect(latest?.jsonlCommittedLineOrdinal).toBe(99);
    expect(latest?.status).toBe("SUCCEEDED");
  });

  it("completes genuine multi-page agreement, sale, and refund parents", async () => {
    const agrGid = "gid://shopify/Order/sc-mp-agr";
    const saleGid = "gid://shopify/Order/sc-mp-sale";
    const refundGid = "gid://shopify/Order/sc-mp-refund";
    const agrLine = `${agrGid}/LineItem/1`;
    const saleLine = `${saleGid}/LineItem/1`;
    const refundLine = `${refundGid}/LineItem/1`;
    const pagedRefund = {
      ...refundNode(
        23001,
        Array.from({ length: 101 }, (_, index) =>
          refundLineNode(23001 + index, { lineItem: { id: refundLine } }),
        ),
      ),
      order: { id: refundGid },
    };
    const admin = createOrderFactsAdmin({
      stores: {
        [agrGid]: standardStore(agrGid, {
          agreements: Array.from({ length: 101 }, (_, index) =>
            agreementNode(17100 + index, [
              saleNode(17100 + index, { lineItem: { id: agrLine } }),
            ]),
          ),
        }),
        [saleGid]: standardStore(saleGid, {
          agreements: [
            agreementNode(
              19100,
              Array.from({ length: 101 }, (_, index) =>
                saleNode(19100 + index, { lineItem: { id: saleLine } }),
              ),
            ),
          ],
        }),
        [refundGid]: standardStore(refundGid, { refunds: [pagedRefund] }),
      },
    });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc-multipage",
        correlationId: "import-sc-multipage",
        jsonlSource: jsonlLines([
          bulkALine(agrGid, 1),
          bulkARoot(agrGid),
          bulkALine(saleGid, 1),
          bulkARoot(saleGid),
          bulkALine(refundGid, 1),
          bulkARoot(refundGid),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "6",
        expectedRootObjectCount: "3",
      }),
    );
    expect(result.status, JSON.stringify(result)).toBe("SUCCEEDED");
    expect(await factCount(agrGid)).toBe(1);
    expect(await factCount(saleGid)).toBe(1);
    expect(await factCount(refundGid)).toBe(1);
    expect(
      admin.calls.some((call) => call.name === "OrderAgreementSalesPage"),
    ).toBe(true);
    expect(
      admin.calls.filter((call) => call.name === "OrderFactsImportLedger")
        .length,
    ).toBeGreaterThanOrEqual(7);
    if (result.status === "SUCCEEDED") {
      expect(result.ledgerCounts.recheck).toBe(3);
      expect(result.ledgerCounts.sale).toBeGreaterThanOrEqual(1);
      expect(result.ledgerCounts.agreement).toBeGreaterThanOrEqual(1);
      expect(result.ledgerCounts.refund).toBeGreaterThanOrEqual(2);
    }
  });

  it("counts actual Admin transport independently of ledgerCounters on a refunded parent", async () => {
    const gid = "gid://shopify/Order/sc03-independent";
    const lineId = String(bulkALine(gid).id);
    const admin = createOrderFactsAdmin({
      stores: {
        [gid]: standardStore(gid, {
          refunds: [
            {
              ...refundNode(44, [refundLineNode(44, { lineItem: { id: lineId } })]),
              totalRefundedSet: moneyBag("0.00"),
              order: { id: gid },
            },
          ],
        }),
      },
    });
    const result = await withTxnHost(shopAId, (db) =>
      runOrderFactsImportStep({
        db,
        admin,
        shop: { id: shopAId, myshopifyDomain: SHOP_A_DOMAIN },
        shopId: shopAId,
        durableJobId: "import-sc03-independent",
        correlationId: "import-sc03-independent",
        jsonlSource: jsonlLines([
          bulkALine(gid),
          bulkARoot(gid, { totalRefundedSet: moneyBag("0.00") }),
        ]),
        pollBulkOperation: false,
        expectedObjectCount: "2",
        expectedRootObjectCount: "1",
      }),
    );
    expect(result.status).toBe("SUCCEEDED");
    const ledgerCalls = admin.calls.filter(
      (call) => call.name === "OrderFactsImportLedger",
    );
    const refundCalls = admin.calls.filter(
      (call) => call.name === "RefundFactById",
    );
    expect(ledgerCalls).toHaveLength(2);
    expect(refundCalls).toHaveLength(1);
    expect(admin.graphqlCount()).toBeGreaterThanOrEqual(
      ledgerCalls.length + refundCalls.length,
    );
    if (result.status === "SUCCEEDED") {
      expect(result.ledgerCounts.recheck).toBe(1);
      expect(result.ledgerCounts.refund).toBe(1);
    }
    expect(operationNameOf(ledgerCalls[0]?.query ?? "")).toBe(
      "OrderFactsImportLedger",
    );
  });
});
