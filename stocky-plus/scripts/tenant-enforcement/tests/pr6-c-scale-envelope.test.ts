/**
 * PR6-C Gate E 1,000,000-line envelope.
 *
 * Uses C's real apply/child-replacement path on disposable PostgreSQL.
 * Skipped unless PR6_C_SCALE_1E6=1 and not running on GitHub Actions.
 * Default CI never executes this envelope.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyOrderFacts } from "../../../app/lib/order-facts/apply";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getRuntimeClient } from "../connection";
import type { RefundSnapshot } from "../../../app/lib/order-facts/apply/types";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  asQueryRaw,
  bag,
  insertObservation,
  line,
  liveOrder,
  openTenant,
  orderSnapshot,
  setTenant,
} from "./pr6-c-pg-harness";

export const PR6_C_LINE_ENVELOPE = 1_000_000;
const GATE_E_SMOKE_LINES = 1_400;

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(THIS_FILE), "../../../..");
const CI_WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/ci.yml");

const runEnvelope =
  process.env.PR6_C_SCALE_1E6 === "1" &&
  process.env.GITHUB_ACTIONS !== "true";

function parseValidateJobTimeoutMinutes(yaml: string): number {
  const jobsOffset = yaml.search(/^jobs:\s*$/m);
  if (jobsOffset < 0) {
    throw new Error("ci.yml missing jobs:");
  }
  const jobs = yaml.slice(jobsOffset);
  const validateMatch = jobs.match(
    /\n  validate:\n([\s\S]*?)(?=\n  [A-Za-z0-9_-]+:|\n*$)/,
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
  const marker = 'describe("PR6-C 1,000,000-line C-specific apply envelope"';
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

type PgSettings = {
  max_connections: string;
  max_locks_per_transaction: string;
  max_prepared_transactions: string;
  isolation: string;
};

async function readPgSettings(): Promise<PgSettings> {
  const client = await getRuntimeClient();
  try {
    const row = await client.query<PgSettings>(
      `SELECT current_setting('max_connections') AS max_connections,
              current_setting('max_locks_per_transaction') AS max_locks_per_transaction,
              current_setting('max_prepared_transactions') AS max_prepared_transactions,
              current_setting('default_transaction_isolation') AS isolation`,
    );
    return row.rows[0];
  } finally {
    await client.end();
  }
}

describe("PR6-C 1e6 envelope policy", () => {
  it("does not treat the 1,400-line Gate E smoke as the 1,000,000-line envelope", () => {
    expect(GATE_E_SMOKE_LINES).toBeLessThan(PR6_C_LINE_ENVELOPE);
  });

  it("reads the live validate-job timeout-minutes from the workflow file", () => {
    const yaml = readFileSync(CI_WORKFLOW_PATH, "utf8");
    const minutes = parseValidateJobTimeoutMinutes(yaml);
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBe(120);
    expect(minutes).not.toBe(10);
    expect(minutes).not.toBe(5);
    const classifyTimeout = yaml.match(
      /\n  classify:\n[\s\S]*?timeout-minutes:\s*(\d+)/,
    );
    expect(Number(classifyTimeout?.[1])).toBe(10);
    expect(minutes).not.toBe(Number(classifyTimeout?.[1]));
    const source = scaleEnvelopeSource();
    expect(source).not.toMatch(/const HEAVY_TIMEOUT_MINUTES = 70/);
    expect(source).not.toMatch(/const HEAVY_TIMEOUT_MINUTES = 90/);
  });

  it("parses validate timeout independently of a self-confirming constant", () => {
    const fixture = `
name: CI
jobs:
  classify:
    timeout-minutes: 10
  validate:
    name: heavy
    timeout-minutes: 120
  gate:
    timeout-minutes: 5
`;
    expect(parseValidateJobTimeoutMinutes(fixture)).toBe(120);
    expect(parseValidateJobTimeoutMinutes(fixture.replace("120", "45"))).toBe(45);
    expect(
      parseValidateJobTimeoutMinutes(fixture.replace("120", "90")),
    ).not.toBe(120);
  });

  it("keeps schema reset only inside it.skipIf(!runEnvelope)", () => {
    const source = scaleEnvelopeSource();
    assertSkippedEnvelopeDoesNotAttemptDatabaseSetup(source);
    expect(source).toMatch(
      /const runEnvelope =\s*process\.env\.PR6_C_SCALE_1E6 === "1" &&\s*process\.env\.GITHUB_ACTIONS !== "true"/,
    );
  });

  it("rejects a beforeAll reset and a describe.skipIf reset as skipped-setup leaks", () => {
    const ok = `
describe("fixture envelope", () => {
  it.skipIf(!runEnvelope)("applies", async () => {
    const { prisma } = await resetSchemaAndApplyEnforcement();
  });
});
`;
    assertSkippedEnvelopeDoesNotAttemptDatabaseSetup(ok);
    const withBeforeAll = `
describe("fixture envelope", () => {
  beforeAll(async () => {
    await resetSchemaAndApplyEnforcement();
  });
  it.skipIf(!runEnvelope)("applies", async () => {});
});
`;
    expect(() =>
      assertSkippedEnvelopeDoesNotAttemptDatabaseSetup(withBeforeAll),
    ).toThrow(/beforeAll/);
    const withDescribeSkip = `
describe.skipIf(!runEnvelope)("fixture envelope", () => {
  it("applies", async () => {
    await resetSchemaAndApplyEnforcement();
  });
});
`;
    expect(() =>
      assertSkippedEnvelopeDoesNotAttemptDatabaseSetup(withDescribeSkip),
    ).toThrow(/describe\.skipIf/);
  });

  it("does not enable the million-line envelope on GitHub Actions", () => {
    if (process.env.GITHUB_ACTIONS === "true") {
      expect(runEnvelope).toBe(false);
    }
  });
});

describe("PR6-C 1,000,000-line C-specific apply envelope", () => {
  it.skipIf(!runEnvelope)(
    "applies 1,000,000 line facts through real C apply and child replacement",
    async () => {
    const { prisma } = await resetSchemaAndApplyEnforcement();
    try {
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: "pr6-c-scale-1e6.myshopify.com" },
    });
    const shopAId = shopA.id;
    const settings = await readPgSettings();
    const highChildParents = 2;
    const highChildLines = 500;
    const refundParents = 20;
    const refundLinesEach = 50;
    const remaining =
      PR6_C_LINE_ENVELOPE -
      highChildParents * highChildLines -
      refundParents * refundLinesEach;
    const broadLinesEach = 50;
    expect(remaining % broadLinesEach).toBe(0);
    const broadParents = remaining / broadLinesEach;
    const parentsPerTxn = 20;

    const session = await openTenant(shopAId);
    let queryCount = 0;
    let observationSeq = 0;
    const db = asQueryRaw(session.client, () => {
      queryCount += 1;
    });
    const rssBefore = process.memoryUsage().rss;
    const setupStarted = Date.now();

    const refundFor = (orderGid: string): RefundSnapshot => {
      return {
        shopifyGid: `${orderGid}/Refund/1`,
        shopifyOrderGid: orderGid,
        shopifyCreatedAt: new Date("2026-08-12T00:00:00.000Z"),
        shopifyUpdatedAt: new Date("2026-08-12T00:00:00.000Z"),
        processedAt: new Date("2026-08-12T00:00:00.000Z"),
        processedAtShopify: "2026-08-12T00:00:00Z",
        shopifyLegacyResourceId: null,
        totalRefundedSet: bag("1.00"),
        shippingLines: [],
        lines: [
          {
            shopifyGid: `${orderGid}/RefundLine/1`,
            shopifyLineItemGid: `${orderGid}/Line/1`,
            refundLineOrdinal: 0,
            quantity: 1,
            restockType: null,
            restocked: null,
            restockLocationGid: null,
            subtotalSet: bag("1.00"),
            totalTaxSet: bag("0.00"),
            priceSet: bag("1.00"),
          },
        ],
        linesComplete: true,
        adjustments: [],
        adjustmentsComplete: true,
        transactions: [
          {
            shopifyGid: `${orderGid}/Txn/1`,
            status: "SUCCESS",
            kind: "REFUND",
            shopifyCreatedAt: new Date("2026-08-12T00:00:00.000Z"),
            processedAt: new Date("2026-08-12T00:00:00.000Z"),
            amountSet: bag("1.00"),
          },
        ],
        transactionsComplete: true,
      };
    };

    const applyParentBatch = async (
      parentIds: string[],
      linesEach: number,
      updatedAt: Date,
      withRefund = false,
    ): Promise<void> => {
      const observations = [];
      for (const gid of parentIds) {
        observationSeq += 1;
        const token = `obs-e1e6-${observationSeq}`;
        const req = await allocateCatalogObservationGeneration(db);
        await insertObservation(session.client, {
          id: token,
          shopId: shopAId,
          resourceKind: "Order",
          shopifyGid: gid,
          requestGen: req,
        });
        const resp = await allocateCatalogObservationGeneration(db);
        const lines = Array.from({ length: linesEach }, (_, index) =>
          line(`${gid}/Line/${index + 1}`),
        );
        observations.push(
          liveOrder(
            shopAId,
            token,
            orderSnapshot(gid, {
              lines,
              shopifyUpdatedAt: updatedAt,
              currentSubtotalLineItemsQuantity: linesEach,
              subtotalLineItemsQuantity: linesEach,
            }),
            req,
            resp,
            withRefund ? { nestedRefunds: [refundFor(gid)] } : {},
          ),
        );
      }
      await applyOrderFacts(db, {
        shopId: shopAId,
        observations,
      });
      await session.client.query("COMMIT");
      await session.client.query("BEGIN");
      await setTenant(session.client, shopAId);
    };

    for (let parent = 0; parent < highChildParents; parent += 1) {
      const gid = `gid://shopify/Order/e1e6-high-${parent}`;
      await applyParentBatch(
        [gid],
        highChildLines,
        new Date("2026-08-10T00:00:00.000Z"),
      );
    }
    const setupMs = Date.now() - setupStarted;

    const applyStarted = Date.now();
    let batches = 0;
    for (let start = 0; start < broadParents; start += parentsPerTxn) {
      const count = Math.min(parentsPerTxn, broadParents - start);
      const gids = Array.from(
        { length: count },
        (_, index) => `gid://shopify/Order/e1e6-broad-${start + index}`,
      );
      await applyParentBatch(
        gids,
        broadLinesEach,
        new Date("2026-08-11T00:00:00.000Z"),
      );
      batches += 1;
    }
    const refundGids = Array.from(
      { length: refundParents },
      (_, index) => `gid://shopify/Order/e1e6-refund-${index}`,
    );
    for (let start = 0; start < refundGids.length; start += 10) {
      await applyParentBatch(
        refundGids.slice(start, start + 10),
        refundLinesEach,
        new Date("2026-08-12T00:00:00.000Z"),
        true,
      );
      batches += 1;
    }

    const replacementStarted = Date.now();
    for (let parent = 0; parent < highChildParents; parent += 1) {
      const gid = `gid://shopify/Order/e1e6-high-${parent}`;
      await applyParentBatch(
        [gid],
        1,
        new Date("2026-08-20T00:00:00.000Z"),
      );
    }
    const replacementMs = Date.now() - replacementStarted;
    const applyMs = Date.now() - applyStarted;
    const rssAfter = process.memoryUsage().rss;
    await session.client.query("COMMIT").catch(() => undefined);
    await session.client.end();

    const verify = await openTenant(shopAId);
    try {
      const totals = await verify.client.query<{
        n: number;
        live_n: number;
        absent_n: number;
      }>(
        `SELECT count(*)::int AS n,
                count(*) FILTER (WHERE "existenceState" = 'LIVE')::int AS live_n,
                count(*) FILTER (WHERE "existenceState" = 'ABSENT')::int AS absent_n
           FROM "ShopifyOrderLineFact"`,
      );
      expect(totals.rows[0].n).toBe(PR6_C_LINE_ENVELOPE);
      expect(totals.rows[0].n).not.toBe(GATE_E_SMOKE_LINES);
      expect(totals.rows[0].absent_n).toBe(
        highChildParents * (highChildLines - 1),
      );
      expect(totals.rows[0].live_n).toBe(
        PR6_C_LINE_ENVELOPE - highChildParents * (highChildLines - 1),
      );
      const high = await verify.client.query<{ live_n: number; absent_n: number }>(
        `SELECT
           count(*) FILTER (WHERE "existenceState" = 'LIVE')::int AS live_n,
           count(*) FILTER (WHERE "existenceState" = 'ABSENT')::int AS absent_n
           FROM "ShopifyOrderLineFact"
          WHERE "shopifyOrderGid" = $1`,
        ["gid://shopify/Order/e1e6-high-0"],
      );
      expect(high.rows[0].live_n).toBe(1);
      expect(high.rows[0].absent_n).toBe(highChildLines - 1);
      await verify.client.query("COMMIT");
    } finally {
      await verify.client.end();
    }

    const linesPerSecond = PR6_C_LINE_ENVELOPE / Math.max(applyMs, 1) * 1000;
    // PHASE_BRIEF list p95 < 500ms and webhook enqueue p95 < 1s are not this
    // apply-envelope SLA. Record C apply throughput against the 1e6 line fact
    // envelope on this disposable PG16 instance.
    expect(settings.max_connections).toBeTruthy();
    expect(settings.max_locks_per_transaction).toBeTruthy();
    expect(settings.isolation.toLowerCase()).toContain("read committed");
    expect(batches).toBeGreaterThan(0);
    expect(queryCount).toBeGreaterThan(PR6_C_LINE_ENVELOPE);
    expect(rssAfter).toBeGreaterThan(0);
    expect(rssBefore).toBeGreaterThan(0);
    expect(setupMs).toBeGreaterThan(0);
    expect(applyMs).toBeGreaterThan(0);
    expect(replacementMs).toBeGreaterThan(0);
    expect(linesPerSecond).toBeGreaterThan(0);
    console.info(
      JSON.stringify({
        gate: "PR6-C-1e6",
        lineFacts: PR6_C_LINE_ENVELOPE,
        highChildParents,
        highChildLines,
        broadParents,
        broadLinesEach,
        refundParents,
        refundLinesEach,
        batches,
        setupMs,
        applyMs,
        replacementMs,
        queryCount,
        rssBefore,
        rssAfter,
        linesPerSecond,
        pg: settings,
      }),
    );
    } finally {
      await prisma.$disconnect();
    }
  },
    7_200_000,
  );
});
