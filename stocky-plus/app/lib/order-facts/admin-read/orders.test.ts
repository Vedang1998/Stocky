import { describe, expect, it } from "vitest";
import { readOrderFact } from "./orders";
import { readRefundFact } from "./refunds";
import { readShopTimezoneCurrency } from "./shop";
import { readCurrentAppInstallationAccessScopes } from "./access-scopes";
import {
  agreementNode,
  lineNode,
  moneyBag,
  orderHeader,
  refundLineNode,
  refundNode,
  saleNode,
  TRUSTED_SHOP,
} from "./__tests__/fixtures";
import { createOrderStoreAdmin } from "./__tests__/order-store-admin";
import { createMockAdmin } from "./__tests__/mock-admin";

function context(admin: ReturnType<typeof createOrderStoreAdmin>, request?: Request) {
  return { admin, shop: TRUSTED_SHOP, request };
}

describe("PR6-B order snapshot walk", () => {
  it("T17/T18 preserves test orders and gift-card/tip lines from the same snapshot", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        test: true,
        currentSubtotalLineItemsQuantity: 3,
        subtotalLineItemsQuantity: 3,
      }),
      lines: [
        lineNode(1),
        lineNode(2, { isGiftCard: true, sku: null, variant: null }),
        lineNode(3, {
          title: "Tip",
          name: "Tip",
          variant: null,
          product: null,
        }),
      ],
      agreements: [
        agreementNode(1, [
          saleNode(1),
          saleNode(2, { __typename: "GiftCardSale", lineType: "GIFT_CARD" }),
          saleNode(3, { __typename: "TipSale", lineType: "TIP" }),
        ]),
      ],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.test).toBe(true);
    expect(result.value.lineItems).toHaveLength(3);
    expect(result.value.lineItems[0]?.quantity).toBe(1);
    expect(result.value.lineItems[1]?.isGiftCard).toBe(true);
    expect(result.value.agreements[0]?.sales.map((sale) => sale.typename)).toEqual(
      ["ProductSale", "GiftCardSale", "TipSale"],
    );
  });

  it("T19 paginates 300 lines with page size 100 and no silent 250 cap", async () => {
    const lines = Array.from({ length: 300 }, (_, index) => lineNode(index + 1));
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        currentSubtotalLineItemsQuantity: 300,
        subtotalLineItemsQuantity: 300,
      }),
      lines,
      agreements: [agreementNode(1, [saleNode(1)])],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.lineItems).toHaveLength(300);
    expect(result.value.lineItems[0]?.id).toBe("gid://shopify/LineItem/1");
    expect(result.value.lineItems[299]?.id).toBe("gid://shopify/LineItem/300");
    expect(new Set(result.value.lineItems.map((line) => line.id)).size).toBe(300);
    const orderCalls = admin.calls.filter((call) =>
      call.query.includes("query OrderFactById"),
    );
    expect(orderCalls.length).toBe(4);
    expect(orderCalls[0]?.variables?.lineAfter == null).toBe(true);
    expect(orderCalls[1]?.variables?.lineAfter).toBe("gid://shopify/LineItem/100");
    expect(orderCalls[2]?.variables?.lineAfter).toBe("gid://shopify/LineItem/200");
    expect(orderCalls[3]?.variables?.lineAfter == null).toBe(true);
    expect(orderCalls[3]?.variables?.lineFirst).toBe(1);
  });

  it("T39 includes the boundary extra page (101 lines, page size 100)", async () => {
    const lines = Array.from({ length: 101 }, (_, index) => lineNode(index + 1));
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        currentSubtotalLineItemsQuantity: 101,
        subtotalLineItemsQuantity: 101,
      }),
      lines,
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.lineItems).toHaveLength(101);
  });

  it("T41 aged-out order(id:) explicit null is neutral null_observed, not an existence kind", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
      nullOrder: true,
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("null_observed");
    if (result.status !== "null_observed") return;
    expect(result.resourceKind).toBe("Order");
    expect(result.requestedGid).toBe("gid://shopify/Order/1");
    expect(result.queryCompleted).toBe(true);
    expect(result.nodeReturned).toBeNull();
    expect(result.phase).toBe("initial");
    expect(result).not.toHaveProperty("kind");
    expect(JSON.stringify(result)).not.toMatch(/INACCESSIBLE_HISTORY_WINDOW/);
    expect(JSON.stringify(result)).not.toMatch(/tombstone/i);
  });

  it("T48 rejects the whole snapshot when one required MoneyBag is invalid", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        originalTotalPriceSet: {
          shopMoney: { amount: 19.99, currencyCode: "USD" },
          presentmentMoney: { amount: "19.99", currencyCode: "USD" },
        },
      }),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_MONEY");
  });

  it("T56 completes two refunds that each exceed one child page and never keeps truncated embeds", async () => {
    const refundA = refundNode(
      10,
      Array.from({ length: 150 }, (_, index) => refundLineNode(1000 + index)),
    );
    const refundB = refundNode(
      11,
      Array.from({ length: 150 }, (_, index) => refundLineNode(2000 + index)),
    );
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        totalRefundedSet: moneyBag("2.00"),
      }),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refundA, refundB],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.refunds).toHaveLength(2);
    expect(result.value.refunds[0]?.childrenComplete).toBe(true);
    expect(result.value.refunds[1]?.childrenComplete).toBe(true);
    expect(result.value.refunds[0]?.refundLineItems).toHaveLength(150);
    expect(result.value.refunds[1]?.refundLineItems).toHaveLength(150);
    const refundCalls = admin.calls.filter((call) =>
      call.query.includes("query RefundFactById"),
    );
    expect(refundCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("T57 request-budget exhaustion is SNAPSHOT_PAGINATION_INCOMPLETE, never a truncated complete snapshot", async () => {
    const lines = Array.from({ length: 300 }, (_, index) => lineNode(index + 1));
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        currentSubtotalLineItemsQuantity: 300,
        subtotalLineItemsQuantity: 300,
      }),
      lines,
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
      maxRequests: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.outcome).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.phase).toBe("lineItems");
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.resourceKind).toBe("Order");
  });

  it("fails closed on GID mismatch", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader({ id: "gid://shopify/Order/999" }),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("IDENTITY_MISMATCH");
  });

  it("pages agreement sales via OrderAgreementSalesPage using the preceding cursor", async () => {
    const sales = Array.from({ length: 150 }, (_, index) => saleNode(index + 1));
    const admin = createOrderStoreAdmin({
      header: orderHeader({ edited: true }),
      lines: [lineNode(1)],
      agreements: [agreementNode(1, sales)],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.agreements[0]?.sales).toHaveLength(150);
    expect(result.value.agreements[0]?.salesComplete).toBe(true);
    const continuation = admin.calls.filter((call) =>
      call.query.includes("query OrderAgreementSalesPage"),
    );
    expect(continuation.length).toBeGreaterThanOrEqual(1);
    expect(continuation[0]?.variables?.agreementAfter == null).toBe(true);
  });

  it("does not fabricate an order when Admin returns null during nested paging", async () => {
    let calls = 0;
    const admin = createMockAdmin((query, variables) => {
      calls += 1;
      if (calls === 1) {
        return {
          data: {
            order: {
              ...orderHeader(),
              lineItems: {
                pageInfo: { hasNextPage: true, endCursor: "gid://shopify/LineItem/1" },
                edges: [{ cursor: "gid://shopify/LineItem/1", node: lineNode(1) }],
              },
              agreements: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [],
              },
              refunds: [],
            },
          },
        };
      }
      void query;
      void variables;
      return { data: { order: null } };
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.outcome).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.resourceKind).toBe("Order");
    expect(result.requestedGid).toBe("gid://shopify/Order/1");
    expect(result.phase).toBe("lineItems");
    expect("kind" in result).toBe(false);
  });
});

describe("PR6-B shop and granted-scope readers", () => {
  it("reads shop timezone/currency without persisting", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [],
      agreements: [],
      refunds: [],
    });
    const result = await readShopTimezoneCurrency(context(admin));
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.ianaTimezone).toBe("America/New_York");
    expect(result.value.currencyCode).toBe("USD");
    expect(result.cost.requests).toBe(1);
  });

  it("reads currentAppInstallation accessScopes.handle (addendum -10)", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [],
      agreements: [],
      refunds: [],
    });
    const result = await readCurrentAppInstallationAccessScopes(context(admin));
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.handles).toEqual(["read_orders", "read_products"]);
    expect(result.cost.requests).toBe(1);
  });
});

describe("PR6-B refund reader", () => {
  it("returns a complete refund snapshot with nullable refund-line ids", async () => {
    const refund = refundNode(5, [
      refundLineNode(1, { id: null, lineItem: { id: "gid://shopify/LineItem/9" } }),
    ]);
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [],
      agreements: [],
      refunds: [refund],
    });
    const result = await readRefundFact(context(admin), refund.id, {
      orderCurrencyCode: "USD",
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.refundLineItems[0]?.id).toBeNull();
    expect(result.value.refundLineItems[0]?.lineItemId).toBe(
      "gid://shopify/LineItem/9",
    );
    expect(result.value.refundLineItems[0]?.refundLineOrdinal).toBe(0);
    expect(result.value.refundLineItems[0]?.restocked).toBe(false);
    expect(result.value.refundLineItems[0]?.restockLocationId).toBe(
      "gid://shopify/Location/1",
    );
    expect(result.value.childrenComplete).toBe(true);
  });
});
