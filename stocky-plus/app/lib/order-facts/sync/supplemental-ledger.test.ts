import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertCanonicalReadDocument } from "../admin-read/safety/graphql-ast";
import { createMockAdmin } from "../admin-read/__tests__/mock-admin";
import {
  agreementNode,
  connectionOfRefundChildren,
  paginate,
  refundLineNode,
  refundNode,
  saleNode,
} from "../admin-read/__tests__/fixtures";
import {
  ORDER_FACTS_IMPORT_LEDGER_QUERY,
  readOrderFactsImportLedger,
} from "./supplemental-ledger";

const LEDGER_SOURCE = readFileSync(
  fileURLToPath(new URL("./supplemental-ledger.ts", import.meta.url)),
  "utf8",
);

const GID = "gid://shopify/Order/1";
const UPDATED = "2026-01-18T00:00:00Z";
const SHOP = { id: "shop", myshopifyDomain: "ledger.myshopify.com" };

function agreementConnection(salesCount = 1, agrHasNext = false) {
  const sales = Array.from({ length: salesCount }, (_, index) => saleNode(index + 1));
  return paginate(
    [
      {
        ...agreementNode(1, sales),
        sales: paginate(sales, 100, null),
      },
    ],
    agrHasNext ? 1 : 100,
    null,
  );
}

function ledgerEnvelope(input?: {
  refunds?: Array<{ id: string }>;
  agrHasNext?: boolean;
  updatedAt?: string;
  currencyCode?: string;
  rawRefunds?: unknown;
}) {
  return {
    data: {
      order: {
        id: GID,
        updatedAt: input?.updatedAt ?? UPDATED,
        currencyCode: input?.currencyCode ?? "USD",
        confirmed: true,
        refunds:
          "rawRefunds" in (input ?? {})
            ? input?.rawRefunds
            : (input?.refunds ?? []),
        agreements: agreementConnection(1, input?.agrHasNext),
      },
    },
    extensions: { cost: { requestedQueryCost: 4 } },
  };
}

function refundEnvelope(refund: ReturnType<typeof refundNode>) {
  return {
    data: {
      refund: {
        ...refund,
        order: { id: GID },
        refundLineItems: connectionOfRefundChildren(
          refund,
          100,
          null,
          "refundLineItems",
        ),
        orderAdjustments: connectionOfRefundChildren(
          refund,
          100,
          null,
          "orderAdjustments",
        ),
        refundShippingLines: connectionOfRefundChildren(
          refund,
          100,
          null,
          "refundShippingLines",
        ),
        transactions: connectionOfRefundChildren(
          refund,
          100,
          null,
          "transactions",
        ),
      },
    },
    extensions: { cost: { requestedQueryCost: 3 } },
  };
}

describe("PR6-D import ledger document", () => {
  it("is a canonical QUERY that lists refund identities without re-reading lines", () => {
    expect(() =>
      assertCanonicalReadDocument(ORDER_FACTS_IMPORT_LEDGER_QUERY),
    ).not.toThrow();
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).toMatch(/query OrderFactsImportLedger/);
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).toMatch(/refunds\s*\{/);
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).not.toMatch(/lineItems/);
    expect(ORDER_FACTS_IMPORT_LEDGER_QUERY).not.toMatch(/\bcancellation\b/);
  });

  it("does not restore the remaining<=0?1 escape or continuation-gated recheck", () => {
    expect(LEDGER_SOURCE).not.toMatch(/remaining\s*>\s*0\s*\?\s*remaining\s*:\s*1/);
    expect(LEDGER_SOURCE).not.toMatch(/usedContinuation/);
    expect(LEDGER_SOURCE).toMatch(/ledger_refund_membership_drift/);
    expect(LEDGER_SOURCE).toMatch(/wrapAdminWithDTransportBudget/);
  });
});

describe("PR6-D aggregate ledger budget and final recheck", () => {
  it("requires and executes a final Order check on a one-page ordinary order", async () => {
    const admin = createMockAdmin(() => ledgerEnvelope());
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
    });
    expect(result.status).toBe("complete");
    expect(result.counts.recheck).toBe(1);
    expect(admin.calls).toHaveLength(2);
    expect(result.transport.used).toBe(2);
    expect(result.transport.used).toBeLessThanOrEqual(result.transport.maxRequests);
    expect(result.transport.recheck).toBe(1);
    expect(result.transport.initial).toBe(1);
  });

  it("treats maxRequests 1 with a refund as incomplete, not complete", async () => {
    const refund = refundNode(1, [refundLineNode(1)]);
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) return refundEnvelope(refund);
      return ledgerEnvelope({ refunds: [{ id: String(refund.id) }] });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 1,
    });
    expect(result.status).toBe("incomplete");
    expect(result.transport.used).toBeLessThanOrEqual(1);
    expect(admin.calls.length).toBeLessThanOrEqual(1);
    expect(result.counts.refund).toBe(0);
  });

  it("succeeds on the exact boundary of initial + refund + recheck", async () => {
    const refund = refundNode(1, [refundLineNode(1)]);
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) return refundEnvelope(refund);
      return ledgerEnvelope({ refunds: [{ id: String(refund.id) }] });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 3,
    });
    expect(result.status, JSON.stringify(result)).toBe("complete");
    expect(result.transport.used).toBe(3);
    expect(result.transport.used).toBeLessThanOrEqual(3);
    expect(admin.calls).toHaveLength(3);
    expect(result.counts.recheck).toBe(1);
    expect(result.counts.refund).toBe(1);
  });

  it("fails one request short of the final recheck rather than skipping it", async () => {
    const refund = refundNode(1, [refundLineNode(1)]);
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) return refundEnvelope(refund);
      return ledgerEnvelope({ refunds: [{ id: String(refund.id) }] });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 2,
    });
    expect(result.status).toBe("incomplete");
    expect(result.counts.recheck).toBe(0);
    expect(admin.calls).toHaveLength(2);
    expect(result.transport.used).toBeLessThanOrEqual(2);
  });

  it("rejects zero and invalid maxRequests before I/O", async () => {
    const admin = createMockAdmin(() => ledgerEnvelope());
    const zero = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 0,
    });
    expect(zero.status).toBe("failure");
    expect(admin.calls).toHaveLength(0);
    const invalid = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 1.5,
    });
    expect(invalid.status).toBe("failure");
    expect(admin.calls).toHaveLength(0);
  });

  it("counts nested refund pages and multiple refunds against one budget", async () => {
    const refundA = refundNode(1, [refundLineNode(1), refundLineNode(2)]);
    const refundB = refundNode(2, [refundLineNode(3)]);
    let refundAPages = 0;
    const admin = createMockAdmin((query, variables) => {
      if (query.includes("RefundFactById")) {
        const id = variables?.id;
        if (id === refundA.id) {
          refundAPages += 1;
          const page = connectionOfRefundChildren(
            refundA,
            1,
            refundAPages === 1 ? null : refundA.refundLineItems[0]?.id,
            "refundLineItems",
          );
          return {
            data: {
              refund: {
                ...refundA,
                order: { id: GID },
                refundLineItems: page,
                orderAdjustments: connectionOfRefundChildren(
                  refundA,
                  100,
                  null,
                  "orderAdjustments",
                ),
                refundShippingLines: connectionOfRefundChildren(
                  refundA,
                  100,
                  null,
                  "refundShippingLines",
                ),
                transactions: connectionOfRefundChildren(
                  refundA,
                  100,
                  null,
                  "transactions",
                ),
              },
            },
            extensions: { cost: { requestedQueryCost: 3 } },
          };
        }
        return refundEnvelope(refundB);
      }
      return ledgerEnvelope({
        refunds: [{ id: String(refundA.id) }, { id: String(refundB.id) }],
      });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      pageSize: 1,
      maxRequests: 8,
    });
    expect(result.status, JSON.stringify(result)).toBe("complete");
    expect(result.transport.used).toBe(admin.calls.length);
    expect(result.transport.used).toBeLessThanOrEqual(8);
    expect(result.transport.used).toBeGreaterThan(3);
    expect(result.counts.refund).toBeGreaterThan(1);
  });

  it("discards a mixed candidate when a refund appears without a parent timestamp bump", async () => {
    const refund = refundNode(1, [refundLineNode(1)]);
    let ledgerCalls = 0;
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) return refundEnvelope(refund);
      ledgerCalls += 1;
      if (ledgerCalls === 1) {
        return ledgerEnvelope({ refunds: [] });
      }
      return ledgerEnvelope({ refunds: [{ id: String(refund.id) }] });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
    });
    expect(result.status).toBe("drift");
    if (result.status === "drift") {
      expect(result.reason).toBe("ledger_refund_membership_drift");
    }
    expect(result.counts.recheck).toBe(1);
  });

  it("catches membership changes only during the last Refund read", async () => {
    const refundA = refundNode(1, [refundLineNode(1)]);
    const refundB = refundNode(2, [refundLineNode(2)]);
    let ledgerCalls = 0;
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) return refundEnvelope(refundA);
      ledgerCalls += 1;
      if (ledgerCalls === 1) {
        return ledgerEnvelope({ refunds: [{ id: String(refundA.id) }] });
      }
      return ledgerEnvelope({
        refunds: [{ id: String(refundB.id) }],
      });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 4,
    });
    expect(result.status).toBe("drift");
    if (result.status === "drift") {
      expect(result.reason).toBe("ledger_refund_membership_drift");
    }
  });

  it("accepts the same refund members reordered and rejects duplicates", async () => {
    const refundA = refundNode(1, [refundLineNode(1)]);
    const refundB = refundNode(2, [refundLineNode(2)]);
    let ledgerCalls = 0;
    const admin = createMockAdmin((query, variables) => {
      if (query.includes("RefundFactById")) {
        return variables?.id === refundB.id
          ? refundEnvelope(refundB)
          : refundEnvelope(refundA);
      }
      ledgerCalls += 1;
      if (ledgerCalls === 1) {
        return ledgerEnvelope({
          refunds: [{ id: String(refundA.id) }, { id: String(refundB.id) }],
        });
      }
      return ledgerEnvelope({
        refunds: [{ id: String(refundB.id) }, { id: String(refundA.id) }],
      });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 8,
    });
    expect(result.status, JSON.stringify(result)).toBe("complete");

    let dupCalls = 0;
    const dupAdmin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) return refundEnvelope(refundA);
      dupCalls += 1;
      if (dupCalls === 1) {
        return ledgerEnvelope({ refunds: [{ id: String(refundA.id) }] });
      }
      return ledgerEnvelope({
        refunds: [{ id: String(refundA.id) }, { id: String(refundA.id) }],
      });
    });
    const duplicated = await readOrderFactsImportLedger({
      context: { admin: dupAdmin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 4,
    });
    expect(duplicated.status).not.toBe("complete");
  });

  it("rejects malformed final refund lists instead of treating them as empty", async () => {
    let calls = 0;
    const admin = createMockAdmin(() => {
      calls += 1;
      if (calls === 1) return ledgerEnvelope({ refunds: [] });
      return ledgerEnvelope({ rawRefunds: null });
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
    });
    expect(result.status).not.toBe("complete");
  });

  it("counts a late Admin error toward the aggregate budget and does not complete", async () => {
    let calls = 0;
    const admin = createMockAdmin(() => {
      calls += 1;
      if (calls === 2) throw new Error("late_admin_error");
      return ledgerEnvelope();
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 8,
    });
    expect(result.status).not.toBe("complete");
    expect(admin.calls).toHaveLength(2);
    expect(result.transport.used).toBe(2);
    expect(result.transport.used).toBeLessThanOrEqual(8);
  });

  it("counts throttled retries toward the hard budget", async () => {
    let attempts = 0;
    const admin = createMockAdmin(() => {
      attempts += 1;
      if (attempts === 1) {
        return {
          errors: [{ message: "Throttled" }],
          extensions: {
            cost: {
              requestedQueryCost: 4,
              throttleStatus: { currentlyAvailable: 100, restoreRate: 100 },
            },
          },
        };
      }
      return ledgerEnvelope();
    });
    const result = await readOrderFactsImportLedger({
      context: { admin, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      maxRequests: 3,
    });
    expect(result.status, JSON.stringify(result)).toBe("complete");
    expect(result.transport.used).toBe(admin.calls.length);
    expect(result.transport.retry).toBeGreaterThanOrEqual(1);
    expect(result.transport.used).toBeLessThanOrEqual(3);
  });
});
