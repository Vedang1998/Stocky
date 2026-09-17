/**
 * PR6-D 1,000,000-line streaming/import envelope.
 *
 * Uses the corrected D JSONL stream, production Bulk A mapping, C/PostgreSQL
 * apply, and durable import orchestration. Skipped unless PR6_D_SCALE_1E6=1
 * and not running on GitHub Actions. Default CI never executes this envelope.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { runOrderFactsImportStep } from "../../../app/lib/order-facts/sync/import";
import { processOrderFactsWebhookJob } from "../../../app/lib/order-facts/sync";
import {
  getControlPlanePrisma,
  resetControlPlanePrismaForTests,
} from "../../../app/sync/control-plane-db.server";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  bulkALine,
  bulkARoot,
  countForShop,
  createOrderFactsAdmin,
  inWindowHeader,
  standardStore,
  webhookWork,
  withTxnHost,
} from "./pr6-d-pg-harness";
import {
  agreementNode,
  moneyBag,
  refundLineNode,
  refundNode,
  saleNode,
} from "../../../app/lib/order-facts/admin-read/__tests__/fixtures";
import { operationNameOf } from "../../../app/lib/order-facts/admin-read/__tests__/mock-admin";
import { inspectDScratchNamespace } from "../../../app/lib/order-facts/sync/source-stage";

export const PR6_D_LINE_ENVELOPE = 1_000_000;
const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(THIS_FILE), "../../../..");
const CI_WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/ci.yml");

const runEnvelope =
  process.env.PR6_D_SCALE_1E6 === "1" &&
  process.env.GITHUB_ACTIONS !== "true";

function parseValidateJobTimeoutMinutes(yaml: string): number {
  const jobsOffset = yaml.search(/^jobs:\s*$/m);
  if (jobsOffset < 0) {
    throw new Error("ci.yml missing jobs:");
  }
  const jobs = yaml.slice(jobsOffset);
  const validateMatch = jobs.match(
    /\n {2}validate:\n([\s\S]*?)(?=\n {2}[A-Za-z0-9_-]+:|\n*$)/,
  );
  if (!validateMatch) {
    throw new Error("ci.yml missing validate job");
  }
  const timeout = validateMatch[1].match(/^\s+timeout-minutes:\s*(\d+)\s*$/m);
  if (!timeout) {
    throw new Error("validate job missing timeout-minutes");
  }
  return Number(timeout[1]);
}

function scaleEnvelopeSource(): string {
  return readFileSync(THIS_FILE, "utf8");
}

function envelopeRegion(source: string): string {
  const marker = 'describe("PR6-D 1,000,000-line D-specific streaming envelope"';
  const start = source.lastIndexOf(marker);
  return start >= 0 ? source.slice(start) : source;
}

function assertSkippedEnvelopeDoesNotAttemptDatabaseSetup(source: string): void {
  const region = envelopeRegion(source);
  if (/describe\.skipIf\(/.test(region)) {
    throw new Error(
      "envelope uses describe.skipIf; skipped-it is the skip contract",
    );
  }
  const skipIdx = region.search(/it\.skipIf\(\s*!runEnvelope\s*\)/);
  if (skipIdx < 0) {
    throw new Error("missing it.skipIf(!runEnvelope)");
  }
  const resetMatches = [
    ...region.matchAll(/resetSchemaAndApplyEnforcement\s*\(/g),
  ];
  if (resetMatches.length !== 1) {
    throw new Error(
      `expected exactly one resetSchemaAndApplyEnforcement call, found ${resetMatches.length}`,
    );
  }
  const resetIdx = region.indexOf("resetSchemaAndApplyEnforcement(");
  if (resetIdx < skipIdx) {
    throw new Error(
      "resetSchemaAndApplyEnforcement is not inside the skipped envelope it",
    );
  }
  if (/beforeAll\s*\([\s\S]{0,800}resetSchemaAndApplyEnforcement/.test(region)) {
    throw new Error("beforeAll still calls resetSchemaAndApplyEnforcement");
  }
  if (/beforeAll\s*\(/.test(region)) {
    throw new Error("envelope describe still has beforeAll");
  }
}

function childCountFor(rootIndex: number, remainingLines: number): number {
  if (remainingLines <= 0) return 0;
  if (rootIndex % 51 === 0) return 0;
  const pack = rootIndex % 23 === 0 ? 400 : rootIndex % 9 === 0 ? 80 : 200;
  return Math.min(remainingLines, pack);
}

function planScale(lineTarget: number): {
  roots: number;
  objects: number;
  lines: number;
} {
  let lines = 0;
  let roots = 0;
  let objects = 0;
  while (lines < lineTarget) {
    roots += 1;
    const children = childCountFor(roots, lineTarget - lines);
    lines += children;
    objects += 1 + children;
  }
  return { roots, objects, lines };
}

function lineOverrides(child: number): Record<string, unknown> {
  const multi = child % 2 === 0;
  const zeroCurrent = child % 5 === 0;
  const quantity = multi ? 2 : 1;
  const currentQuantity = zeroCurrent ? 0 : quantity;
  return {
    quantity,
    currentQuantity,
    refundableQuantity: currentQuantity,
  };
}

function unitSumFor(children: number): number {
  let sum = 0;
  for (let child = 1; child <= children; child += 1) {
    sum += Number(lineOverrides(child).currentQuantity);
  }
  return sum;
}

function originalQtySum(children: number): number {
  let sum = 0;
  for (let child = 1; child <= children; child += 1) {
    sum += Number(lineOverrides(child).quantity);
  }
  return sum;
}

async function* scaleJsonl(lineTarget: number): AsyncGenerator<string> {
  let emittedLines = 0;
  let root = 0;
  while (emittedLines < lineTarget) {
    root += 1;
    const children = childCountFor(root, lineTarget - emittedLines);
    const gid = `gid://shopify/Order/d-scale-${root}`;
    const rootObj = bulkARoot(gid, {
      currentSubtotalLineItemsQuantity: unitSumFor(children),
      subtotalLineItemsQuantity: originalQtySum(children),
      edited: root % 37 === 0,
    });
    const childObjs = Array.from({ length: children }, (_, i) =>
      bulkALine(gid, i + 1, lineOverrides(i + 1)),
    );
    if (root % 3 === 0) {
      for (const child of childObjs) yield `${JSON.stringify(child)}\n`;
      yield `${JSON.stringify(rootObj)}\n`;
    } else {
      yield `${JSON.stringify(rootObj)}\n`;
      for (const child of childObjs) yield `${JSON.stringify(child)}\n`;
    }
    emittedLines += children;
  }
}

describe("PR6-D scale envelope contract", () => {
  it("keeps the GitHub validate job timeout unchanged in this file", () => {
    const yaml = readFileSync(CI_WORKFLOW_PATH, "utf8");
    expect(parseValidateJobTimeoutMinutes(yaml)).toBe(120);
    expect(envelopeRegion(scaleEnvelopeSource())).not.toMatch(
      /timeout-minutes:/,
    );
  });

  it("uses skipped-it rather than describe.skipIf and does not reset in beforeAll", () => {
    assertSkippedEnvelopeDoesNotAttemptDatabaseSetup(scaleEnvelopeSource());
  });

  it("does not enable the million-line envelope on GitHub Actions", () => {
    if (process.env.GITHUB_ACTIONS === "true") {
      expect(runEnvelope).toBe(false);
    }
  });
});

function measureTreeBytesSync(dir: string): number {
  if (!existsSync(dir)) return 0;
  const st = lstatSync(dir);
  if (st.isSymbolicLink()) return 0;
  if (st.isFile()) return st.size;
  if (!st.isDirectory()) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    total += measureTreeBytesSync(path.join(dir, name));
  }
  return total;
}

function startDiskSampler(dir: string, sampleMs: number) {
  const samples: number[] = [];
  const sampler = setInterval(() => {
    samples.push(measureTreeBytesSync(dir));
  }, sampleMs);
  sampler.unref?.();
  return {
    sampleMs,
    stop() {
      clearInterval(sampler);
      samples.push(measureTreeBytesSync(dir));
      return {
        peakScratchBytes: Math.max(0, ...samples),
        scratchSamples: samples.length,
      };
    },
  };
}

function installSqlCounters() {
  let merchantSqlCalls = 0;
  let controlPlaneEngineRequests = 0;
  const origQuery = Client.prototype.query;
  Client.prototype.query = function (
    this: Client,
    ...args: unknown[]
  ) {
    merchantSqlCalls += 1;
    return (origQuery as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof Client.prototype.query;
  const proto = PrismaClient.prototype as unknown as {
    _request: (...args: unknown[]) => unknown;
  };
  const origRequest = proto._request;
  proto._request = function (this: unknown, ...args: unknown[]) {
    controlPlaneEngineRequests += 1;
    return origRequest.apply(this, args);
  };
  return {
    snapshot() {
      return { merchantSqlCalls, controlPlaneEngineRequests };
    },
    restore() {
      Client.prototype.query = origQuery;
      proto._request = origRequest;
    },
  };
}

function classifyAdminCalls(
  calls: Array<{ name: string | null; query: string; variables?: Record<string, unknown> }>,
) {
  const classified = {
    initial: 0,
    recheck: 0,
    agreement: 0,
    sale: 0,
    refund: 0,
    fallback: 0,
    poll: 0,
    scope: 0,
    shop: 0,
    other: 0,
  };
  for (const call of calls) {
    const name = call.name ?? operationNameOf(call.query);
    const agrAfter = call.variables?.agrAfter;
    const agrFirst = call.variables?.agrFirst;
    if (name === "OrderFactsImportLedger") {
      if (agrAfter) classified.agreement += 1;
      else if (agrFirst === 1) classified.recheck += 1;
      else classified.initial += 1;
    } else if (name === "OrderAgreementSalesPage") classified.sale += 1;
    else if (name === "RefundFactById") classified.refund += 1;
    else if (name === "OrderFactById") classified.fallback += 1;
    else if (name === "CatalogFactBulkOperation" || name === "CatalogFactBulkOperationRunQuery") {
      classified.poll += 1;
    } else if (name === "CurrentAppInstallationAccessScopes") classified.scope += 1;
    else if (name === "ShopTimezoneCurrency") classified.shop += 1;
    else classified.other += 1;
  }
  return classified;
}

function specialScaleStores(): Record<string, ReturnType<typeof standardStore>> {
  const stores: Record<string, ReturnType<typeof standardStore>> = {};
  const agreementGid = "gid://shopify/Order/d-scale-17";
  const saleGid = "gid://shopify/Order/d-scale-19";
  const refundPageGid = "gid://shopify/Order/d-scale-23";
  const zeroMoneyGid = "gid://shopify/Order/d-scale-29";
  const fullRefundGid = "gid://shopify/Order/d-scale-31";
  stores[agreementGid] = standardStore(agreementGid, {
    agreements: Array.from({ length: 101 }, (_, index) =>
      agreementNode(17000 + index, [
        saleNode(17000 + index, {
          lineItem: { id: `${agreementGid}/LineItem/1` },
        }),
      ]),
    ),
  });
  stores[saleGid] = standardStore(saleGid, {
    agreements: [
      agreementNode(
        19000,
        Array.from({ length: 101 }, (_, index) =>
          saleNode(19000 + index, {
            lineItem: { id: `${saleGid}/LineItem/1` },
          }),
        ),
      ),
    ],
  });
  const pagedRefund = {
    ...refundNode(
      23000,
      Array.from({ length: 101 }, (_, index) =>
        refundLineNode(23000 + index, {
          lineItem: { id: `${refundPageGid}/LineItem/1` },
        }),
      ),
    ),
    order: { id: refundPageGid },
  };
  stores[refundPageGid] = standardStore(refundPageGid, { refunds: [pagedRefund] });
  const zeroRefund = {
    ...refundNode(29000, [
      refundLineNode(29000, { lineItem: { id: `${zeroMoneyGid}/LineItem/1` } }),
    ]),
    totalRefundedSet: moneyBag("0.00"),
    order: { id: zeroMoneyGid },
  };
  stores[zeroMoneyGid] = standardStore(zeroMoneyGid, { refunds: [zeroRefund] });
  const fullRefund = {
    ...refundNode(31000, [
      refundLineNode(31000, { lineItem: { id: `${fullRefundGid}/LineItem/1` } }),
    ]),
    totalRefundedSet: moneyBag("10.00"),
    order: { id: fullRefundGid },
  };
  stores[fullRefundGid] = standardStore(fullRefundGid, { refunds: [fullRefund] });
  return stores;
}

function wrapAdminThrowAfterLedgers(
  admin: ReturnType<typeof createOrderFactsAdmin>,
  afterLedgers: number,
) {
  let ledgers = 0;
  const original = admin.graphql.bind(admin);
  admin.graphql = async (query, options) => {
    const result = await original(query, options);
    if (operationNameOf(query) === "OrderFactsImportLedger") {
      ledgers += 1;
      if (ledgers >= afterLedgers) {
        throw new Error("injected_positive_checkpoint_interrupt");
      }
    }
    return result;
  };
  return admin;
}

function startSampler(sampleMs: number) {
  const rssSamples: number[] = [];
  const heapSamples: number[] = [];
  const sampler = setInterval(() => {
    const mem = process.memoryUsage();
    rssSamples.push(mem.rss);
    heapSamples.push(mem.heapUsed);
  }, sampleMs);
  sampler.unref?.();
  return {
    sampleMs,
    stop() {
      clearInterval(sampler);
      return {
        peakRssBytes: Math.max(0, ...rssSamples),
        peakHeapBytes: Math.max(0, ...heapSamples),
        rssSamples: rssSamples.length,
        heapSamples: heapSamples.length,
      };
    },
  };
}

describe("PR6-D 1,000,000-line D-specific streaming envelope", () => {
  it.skipIf(!runEnvelope)(
    "streams 1,000,000 canonical order-line facts through D import, C apply, and recovery",
    async () => {
      const { prisma } = await resetSchemaAndApplyEnforcement();
      try {
        const shopWarm = await prisma.shop.create({
          data: { myshopifyDomain: "pr6-d-scale-warm.myshopify.com" },
        });
        const shopA = await prisma.shop.create({
          data: { myshopifyDomain: "pr6-d-scale-a.myshopify.com" },
        });
        const shopB = await prisma.shop.create({
          data: { myshopifyDomain: "pr6-d-scale-b.myshopify.com" },
        });
        const warmupTarget = 1_000;
        const warmupPlan = planScale(warmupTarget);
        const crashTarget = 2_000;
        const crashPlan = planScale(crashTarget);
        const plan = planScale(PR6_D_LINE_ENVELOPE);
        const childBuckets = { zero: 0, small: 0, eight: 0, forty: 0 };
        let remainingProbe = PR6_D_LINE_ENVELOPE;
        for (let root = 1; remainingProbe > 0; root += 1) {
          const children = childCountFor(root, remainingProbe);
          remainingProbe -= children;
          if (children === 0) childBuckets.zero += 1;
          else if (children === 80) childBuckets.eight += 1;
          else if (children === 400) childBuckets.forty += 1;
          else childBuckets.small += 1;
        }
        const specialStores = specialScaleStores();
        const recentIso = new Date().toISOString();
        // Root 51 is a zero-child parent (index % 51 === 0). Overlapping a
        // 200-line root replaces those lines with the webhook B snapshot and
        // drops canonical line facts below the 1e6 envelope.
        const overlapGid = "gid://shopify/Order/d-scale-51";
        specialStores[overlapGid] = standardStore(overlapGid, {
          header: inWindowHeader({
            id: overlapGid,
            createdAt: recentIso,
            updatedAt: recentIso,
            processedAt: recentIso,
          }),
          lines: [],
        });
        const scratchRoot = mkdtempSync(
          path.join(os.tmpdir(), "pr6-d-scale-scratch-"),
        );
        mkdirSync(scratchRoot, { recursive: true });
        const adminWarm = createOrderFactsAdmin({ stores: {} });
        const adminCrash = wrapAdminThrowAfterLedgers(
          createOrderFactsAdmin({
            stores: specialStores,
            bulk: {
              id: "gid://shopify/BulkOperation/d-scale-a",
              status: "COMPLETED",
              objectCount: String(crashPlan.objects),
              rootObjectCount: String(crashPlan.roots),
              url: "https://example.invalid/d-scale-a.jsonl",
            },
          }),
          3,
        );
        const adminA = createOrderFactsAdmin({
          stores: specialStores,
          bulk: {
            id: "gid://shopify/BulkOperation/d-scale-a",
            status: "COMPLETED",
            objectCount: String(plan.objects),
            rootObjectCount: String(plan.roots),
            url: "https://example.invalid/d-scale-a.jsonl",
          },
        });
        const adminB = createOrderFactsAdmin({
          stores: {
            ["gid://shopify/Order/d-scale-b-1"]: standardStore(
              "gid://shopify/Order/d-scale-b-1",
            ),
          },
        });
        const sql = installSqlCounters();
        try {
        const warmupSampler = startSampler(50);
        const warmupStarted = Date.now();
        const warmup = await withTxnHost(shopWarm.id, (db) =>
          runOrderFactsImportStep({
            db,
            admin: adminWarm,
            shop: {
              id: shopWarm.id,
              myshopifyDomain: "pr6-d-scale-warm.myshopify.com",
            },
            shopId: shopWarm.id,
            durableJobId: "d-scale-warm",
            correlationId: "d-scale-warm",
            jsonlSource: scaleJsonl(warmupTarget),
            pollBulkOperation: false,
            expectedObjectCount: String(warmupPlan.objects),
            expectedRootObjectCount: String(warmupPlan.roots),
          }),
        );
        const warmupMem = warmupSampler.stop();
        const warmupElapsedMs = Date.now() - warmupStarted;
        expect(warmup.status).toBe("SUCCEEDED");

        let fetches = 0;
        const crashDisk = startDiskSampler(scratchRoot, 50);
        const crash = await withTxnHost(shopA.id, (db) =>
          runOrderFactsImportStep({
            db,
            admin: adminCrash,
            shop: {
              id: shopA.id,
              myshopifyDomain: "pr6-d-scale-a.myshopify.com",
            },
            shopId: shopA.id,
            durableJobId: "d-scale-a",
            correlationId: "d-scale-a",
            pollBulkOperation: true,
            scratchRoot,
            fetchJsonl: async () => {
              fetches += 1;
              return scaleJsonl(crashTarget);
            },
          }),
        );
        const crashDiskPeak = crashDisk.stop();
        expect(crash.status).toBe("PARTIAL_FAILURE");
        const crashRun = await getControlPlanePrisma().syncRun.findFirst({
          where: { shopId: shopA.id, correlationId: "d-scale-a" },
          orderBy: { createdAt: "desc" },
        });
        expect(crashRun?.jsonlCommittedLineOrdinal ?? 0).toBeGreaterThan(0);
        const leftoverBeforeLoss = await inspectDScratchNamespace(scratchRoot);
        rmSync(scratchRoot, { recursive: true, force: true });
        mkdirSync(scratchRoot, { recursive: true });

        const sampleMs = 250;
        const sampler = startSampler(sampleMs);
        const diskSampler = startDiskSampler(scratchRoot, sampleMs);
        const started = Date.now();
        const [resultA, resultB, webhookOverlap] = await Promise.all([
          withTxnHost(shopA.id, (db) =>
            runOrderFactsImportStep({
              db,
              admin: adminA,
              shop: {
                id: shopA.id,
                myshopifyDomain: "pr6-d-scale-a.myshopify.com",
              },
              shopId: shopA.id,
              durableJobId: "d-scale-a",
              correlationId: "d-scale-a",
              pollBulkOperation: true,
              scratchRoot,
              fetchJsonl: async () => {
                fetches += 1;
                return scaleJsonl(PR6_D_LINE_ENVELOPE);
              },
            }),
          ),
          withTxnHost(shopB.id, (db) =>
            runOrderFactsImportStep({
              db,
              admin: adminB,
              shop: {
                id: shopB.id,
                myshopifyDomain: "pr6-d-scale-b.myshopify.com",
              },
              shopId: shopB.id,
              durableJobId: "d-scale-b",
              correlationId: "d-scale-b",
              jsonlSource: (async function* () {
                yield `${JSON.stringify(
                  bulkARoot("gid://shopify/Order/d-scale-b-1", {
                    currentSubtotalLineItemsQuantity: 0,
                  }),
                )}\n`;
              })(),
              pollBulkOperation: false,
              expectedObjectCount: "1",
              expectedRootObjectCount: "1",
            }),
          ),
          withTxnHost(shopA.id, (db) =>
            processOrderFactsWebhookJob({
              db,
              admin: createOrderFactsAdmin({
                stores: { [overlapGid]: specialStores[overlapGid] },
              }),
              shop: {
                id: shopA.id,
                myshopifyDomain: "pr6-d-scale-a.myshopify.com",
              },
              work: webhookWork({
                shopId: shopA.id,
                topic: "orders/edited",
                projection: { order_edit: { id: 1, order_id: "d-scale-51" } },
                receivedAt: new Date(),
              }),
            }),
          ).catch((error) => ({
            status: "threw" as const,
            reason: error instanceof Error ? error.message : String(error),
            apply: undefined,
            orderGid: overlapGid,
            refundGid: null,
          })),
        ]);
        const fullMem = sampler.stop();
        const fullDisk = diskSampler.stop();
        const elapsedMs = Date.now() - started;
        const sqlSnapshot = sql.snapshot();
        if (resultA.status !== "SUCCEEDED") {
          throw new Error(
            `shopA import ${resultA.status}: ${"reason" in resultA ? resultA.reason : ""}`,
          );
        }
        if (resultB.status !== "SUCCEEDED") {
          throw new Error(
            `shopB import ${resultB.status}: ${"reason" in resultB ? resultB.reason : ""}`,
          );
        }
        const orderFactsA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderFact"`,
        );
        const orderFactsB = await countForShop(
          shopB.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderFact"`,
        );
        const orderFactsWarm = await countForShop(
          shopWarm.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderFact"`,
        );
        const lineFactsA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact"`,
        );
        const liveLineFactsA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact" WHERE "existenceState" = 'LIVE'`,
        );
        const absentLineFactsA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact" WHERE "existenceState" = 'ABSENT'`,
        );
        const zeroCurrentLineFactsA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderLineFact" WHERE "currentQuantity" = 0`,
        );
        const agreementCountA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderAgreementFact"`,
        );
        const refundCountA = await countForShop(
          shopA.id,
          `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact"`,
        );
        expect(orderFactsA).toBe(plan.roots);
        expect(lineFactsA).toBe(plan.lines);
        expect(lineFactsA).toBeGreaterThanOrEqual(PR6_D_LINE_ENVELOPE);
        expect(orderFactsB).toBe(1);
        expect(orderFactsWarm).toBe(warmupPlan.roots);
        const adminClassified = classifyAdminCalls(adminA.calls);
        const resumed = await getControlPlanePrisma().syncRun.findFirst({
          where: { shopId: shopA.id, correlationId: "d-scale-a" },
          orderBy: { createdAt: "desc" },
        });
        const envelope = {
            pr6dScaleEnvelope: {
              lineFactTarget: PR6_D_LINE_ENVELOPE,
              plannedRoots: plan.roots,
              plannedObjects: plan.objects,
              plannedLineFacts: plan.lines,
              childBuckets,
              warmup: {
                lineTarget: warmupTarget,
                roots: warmupPlan.roots,
                elapsedMs: warmupElapsedMs,
                ...warmupMem,
              },
              crashPrefixLines: crashTarget,
              crashPrefixRoots: crashPlan.roots,
              crashCheckpointOrdinal: crashRun?.jsonlCommittedLineOrdinal ?? null,
              crashScratchPeakBytes: crashDiskPeak.peakScratchBytes,
              leftoverAttemptCountBeforeLoss: leftoverBeforeLoss.leftoverAttemptCount,
              leftoverBytesBeforeLoss: leftoverBeforeLoss.leftoverBytes,
              interruptKind:
                "injected Admin throw after the first committed parent on a complete crash-prefix source, then test-operator deletion of that attempt scratch; not the historical truncated-prefix null-checkpoint case",
              webhookOverlapStatus: webhookOverlap.status,
              applied: resultA.applied,
              examined: resultA.examined,
              followUpReads: resultA.followUpReads,
              bulkDirectApplies: resultA.bulkDirectApplies,
              verifiedReplayApplies: resultA.verifiedReplayApplies,
              ledgerCounts: resultA.ledgerCounts,
              shopBFacts: orderFactsB,
              lineFactsA,
              liveLineFactsA,
              absentLineFactsA,
              zeroCurrentLineFactsA,
              agreementCountA,
              refundCountA,
              graphqlCalls: adminA.graphqlCount(),
              adminClassified,
              jsonlFetches: fetches,
              merchantSqlCalls: sqlSnapshot.merchantSqlCalls,
              controlPlaneEngineRequests: sqlSnapshot.controlPlaneEngineRequests,
              sqlInstrumentation:
                "merchant: pg.Client.prototype.query (includes BEGIN/COMMIT/set_config and C $queryRaw). control-plane: PrismaClient.prototype._request (one engine request per Prisma operation; not a pg wire-message count). countForShop probes after the import are included if they use pg.Client.",
              elapsedMs,
              sampleMs,
              ...fullMem,
              ...fullDisk,
              peakScratchBytes: Math.max(
                crashDiskPeak.peakScratchBytes,
                fullDisk.peakScratchBytes,
              ),
              method:
                "RSS/heap from process.memoryUsage on the stated interval; scratch bytes from synchronous directory walk on the same interval. Peaks are observed high-water values, not mathematical bounds. Short-lived files between ticks can be missed.",
              environment: {
                node: process.version,
                platform: process.platform,
                cpus: os.cpus().length,
                totalmem: os.totalmem(),
                pid: process.pid,
              },
              historicalHeapDelta53336:
                "2026-09-15 quarantine PG heap delta 53336 bytes is a dated measurement only; retracted as a peak bound. Claude independently measured 10999720 bytes under different conditions.",
              prior1e04ddcEnvelope:
                "Historical 1e04ddc run (5192 initial, 0 rechecks, null crash checkpoint) is not evidence for this repair.",
            },
        };
        console.log(JSON.stringify(envelope));
        expect(resultA.examined).toBe(plan.roots);
        expect(resultA.applied).toBe(plan.roots);
        expect(
          resultA.bulkDirectApplies +
            resultA.followUpReads +
            resultA.verifiedReplayApplies,
        ).toBe(plan.roots);
        expect(resultA.verifiedReplayApplies).toBeGreaterThanOrEqual(1);
        expect(resultA.ledgerCounts.recheck).toBe(resultA.bulkDirectApplies);
        expect(fetches).toBeGreaterThanOrEqual(2);
        expect(adminA.graphqlCount()).toBeGreaterThanOrEqual(
          adminClassified.initial + adminClassified.recheck,
        );
        expect(adminClassified.initial + adminClassified.recheck + adminClassified.agreement + adminClassified.sale + adminClassified.refund + adminClassified.fallback + adminClassified.poll + adminClassified.scope + adminClassified.shop + adminClassified.other).toBe(adminA.graphqlCount());
        expect(resumed?.status).toBe("SUCCEEDED");
        expect(resumed?.jsonlCommittedLineOrdinal).toBe(plan.objects);
        } finally {
          sql.restore();
          rmSync(scratchRoot, { recursive: true, force: true });
        }
      } finally {
        await resetControlPlanePrismaForTests();
        await prisma.$disconnect();
      }
    },
    7_200_000,
  );
});
