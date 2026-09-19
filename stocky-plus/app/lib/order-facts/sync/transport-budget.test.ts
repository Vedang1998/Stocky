import { describe, expect, it } from "vitest";
import { createMockAdmin } from "../admin-read/__tests__/mock-admin";
import {
  connectionOfRefundChildren,
  paginate,
  refundLineNode,
  refundNode,
} from "../admin-read/__tests__/fixtures";
import {
  ORDER_FACTS_IMPORT_LEDGER_QUERY,
  readOrderFactsImportLedger,
} from "./supplemental-ledger";
import type { OrderAdminReadClient } from "../admin-read/types";
import {
  consumeDTransportAttempt,
  createDTransportBudget,
  wrapAdminWithDTransportBudget,
  type DTransportBudget,
} from "./transport-budget";

function wrapAdminCountingOnly(
  admin: OrderAdminReadClient,
  budget: DTransportBudget,
): OrderAdminReadClient {
  return {
    graphql: async (query, options) => {
      budget.used += 1;
      if (budget.lastCallThrottled) budget.classified.retry += 1;
      else budget.classified[budget.phase] += 1;
      const response = await admin.graphql(query, options);
      return {
        json: async () => {
          const json = await response.json();
          return json;
        },
      };
    },
  };
}

const GID = "gid://shopify/Order/1";
const UPDATED = "2026-01-18T00:00:00Z";
const SHOP = { id: "shop", myshopifyDomain: "ledger.myshopify.com" };

function ledgerEnvelope(refunds: Array<{ id: string }>) {
  return {
    data: {
      order: {
        id: GID,
        updatedAt: UPDATED,
        currencyCode: "USD",
        confirmed: true,
        refunds,
        agreements: paginate([], 100, null),
      },
    },
    extensions: { cost: { requestedQueryCost: 4 } },
  };
}

describe("PR6-D transport hard-stop and parent isolation", () => {
  it("keeps two parent budgets from sharing mutable used/phase state", () => {
    const left = createDTransportBudget(4);
    const right = createDTransportBudget(4);
    left.phase = "refund";
    consumeDTransportAttempt(left);
    expect(left.used).toBe(1);
    expect(right.used).toBe(0);
    expect(right.phase).toBe("initial");
    expect(left.phase).toBe("refund");
  });

  it("refuses nested B graphql beyond the shared wrapper allowance", async () => {
    const refund = refundNode(1, [refundLineNode(1), refundLineNode(2)]);
    let refundPages = 0;
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) {
        refundPages += 1;
        return {
          data: {
            refund: {
              ...refund,
              order: { id: GID },
              refundLineItems: connectionOfRefundChildren(
                refund,
                1,
                refundPages === 1 ? null : refund.refundLineItems[0]?.id,
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
      return ledgerEnvelope([{ id: String(refund.id) }]);
    });
    const budget = createDTransportBudget(3);
    const wrapped = wrapAdminWithDTransportBudget(admin, budget, {
      resourceKind: "Order",
      requestedGid: GID,
      phase: "initial",
    });
    const result = await readOrderFactsImportLedger({
      context: { admin: wrapped, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      pageSize: 1,
      maxRequests: 250,
      transportBudget: budget,
    });
    expect(result.status).toBe("incomplete");
    expect(admin.calls.length).toBeLessThanOrEqual(3);
    expect(budget.used).toBeLessThanOrEqual(3);
    expect(admin.calls.length).toBe(budget.used);
  });

  it("nested B exceeds the wrapper allowance when only the hard-stop throw is disabled", async () => {
    const refund = refundNode(1, [refundLineNode(1), refundLineNode(2)]);
    let refundPages = 0;
    const admin = createMockAdmin((query) => {
      if (query.includes("RefundFactById")) {
        refundPages += 1;
        return {
          data: {
            refund: {
              ...refund,
              order: { id: GID },
              refundLineItems: connectionOfRefundChildren(
                refund,
                1,
                refundPages === 1 ? null : refund.refundLineItems[0]?.id,
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
      return ledgerEnvelope([{ id: String(refund.id) }]);
    });
    const budget = createDTransportBudget(3);
    const wrapped = wrapAdminCountingOnly(admin, budget);
    await readOrderFactsImportLedger({
      context: { admin: wrapped, shop: SHOP },
      orderGid: GID,
      bulkUpdatedAt: UPDATED,
      bulkCurrencyCode: "USD",
      pageSize: 1,
      maxRequests: 250,
      transportBudget: budget,
    });
    expect(admin.calls.length).toBeGreaterThan(3);
    expect(budget.used).toBeGreaterThan(3);
  });

  it("counts throttled retries and thrown transport errors at the wrapper", async () => {
    let calls = 0;
    const admin = createMockAdmin(() => {
      calls += 1;
      if (calls === 1) {
        return {
          errors: [{ message: "Throttled" }],
          extensions: { cost: { requestedQueryCost: 1 } },
        };
      }
      if (calls === 2) {
        throw new Error("transport_reset");
      }
      return ledgerEnvelope([]);
    });
    const budget = createDTransportBudget(8);
    const wrapped = wrapAdminWithDTransportBudget(admin, budget, {
      resourceKind: "Order",
      requestedGid: GID,
      phase: "initial",
    });
    await wrapped.graphql("query First { order { id } }").then((row) => row.json());
    await expect(
      wrapped.graphql("query Second { order { id } }").then((row) => row.json()),
    ).rejects.toThrow(/transport_reset/);
    await wrapped.graphql("query Third { order { id } }").then((row) => row.json());
    expect(admin.calls.length).toBe(3);
    expect(budget.used).toBe(3);
    expect(budget.classified.retry).toBe(2);
    expect(budget.classified.initial).toBe(1);
  });

  it("does not export a production hard-stop bypass", async () => {
    const mod = await import("./transport-budget");
    expect(Object.keys(mod)).not.toContain("dTransportHardStop");
    const budget = createDTransportBudget(1);
    consumeDTransportAttempt(budget);
    expect(() => consumeDTransportAttempt(budget)).toThrow(/budget exhausted/);
    expect(budget.used).toBe(1);
  });
});

void ORDER_FACTS_IMPORT_LEDGER_QUERY;
