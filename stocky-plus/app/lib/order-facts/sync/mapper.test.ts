import { describe, expect, it } from "vitest";
import { readOrderFact } from "../admin-read";
import { createOrderStoreAdmin } from "../admin-read/__tests__/order-store-admin";
import {
  agreementNode,
  lineNode,
  orderHeader,
  saleNode,
} from "../admin-read/__tests__/fixtures";
import { isRetryableMappedReadIssue, mapBOrderReadResult } from "./mapper";
import type { MapContext } from "./types";

describe("PR6-D production B→C mapper", () => {
  it("preserves money strings, GIDs, and at-sale identity from merged B", async () => {
    const orderGid = "gid://shopify/Order/mapper-1";
    const admin = createOrderStoreAdmin({
      header: orderHeader({ id: orderGid }),
      lines: [
        lineNode(1, {
          id: `${orderGid}/LineItem/1`,
          sku: "KEEP-SKU",
        }),
      ],
      agreements: [agreementNode(1, [saleNode(1)])],
      refunds: [],
    });
    const read = await readOrderFact(
      {
        admin,
        shop: { id: "shop-mapper", myshopifyDomain: "mapper.myshopify.com" },
      },
      orderGid,
    );
    expect(read.status).toBe("complete");
    if (read.status !== "complete") {
      throw new Error(`expected complete B read, got ${read.status}`);
    }
    const ctx: MapContext = {
      shopId: "shop-mapper",
      observationToken: "token-mapper",
      observationRequestGen: 1n,
      observationResponseGen: 2n,
      existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
      accessScopeSnapshot: ["read_orders"],
      sourceKind: "INCREMENTAL_REFETCH",
    };
    const mapped = mapBOrderReadResult(read, ctx);
    expect(mapped.status).toBe("mapped");
    if (mapped.status !== "mapped") return;
    expect(mapped.observation.order?.shopifyGid).toBe(orderGid);
    expect(mapped.observation.order?.lines[0]?.originalTotalSet.shopAmount).toBe(
      "10.00",
    );
    expect(mapped.observation.order?.lines[0]?.variantGidAtSale).toBe(
      "gid://shopify/ProductVariant/1",
    );
    expect(mapped.observation.order?.lines[0]?.sku).toBe("KEEP-SKU");
    expect(mapped.observation.order?.agreements[0]?.sales[0]?.shopifyGid).toBe(
      "gid://shopify/Sale/1",
    );
  });

  it("treats B walk failure for missing with-code discount as non-retryable", async () => {
    const orderGid = "gid://shopify/Order/mapper-discount";
    const admin = createOrderStoreAdmin({
      header: orderHeader({ id: orderGid }),
      lines: [
        lineNode(1, {
          id: `${orderGid}/LineItem/1`,
          discountedTotalSetWithCodeDiscounts: null,
        }),
      ],
      agreements: [],
      refunds: [],
    });
    const read = await readOrderFact(
      {
        admin,
        shop: { id: "shop-mapper", myshopifyDomain: "mapper.myshopify.com" },
      },
      orderGid,
    );
    expect(read.status).toBe("failure");
    if (read.status === "failure") {
      expect(read.reason).toBe("MALFORMED_MONEY");
    }
    const mapped = mapBOrderReadResult(read, {
      shopId: "shop-mapper",
      observationToken: "token",
      observationRequestGen: 1n,
      observationResponseGen: 2n,
      existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
      accessScopeSnapshot: ["read_orders"],
      sourceKind: "INCREMENTAL_REFETCH",
    });
    expect(mapped.status).toBe("failure");
    if (mapped.status === "failure") {
      expect(isRetryableMappedReadIssue(mapped)).toBe(false);
    }
  });

  it("blocks a complete snapshot that omitted with-code discount authority", async () => {
    const orderGid = "gid://shopify/Order/mapper-discount-complete";
    const admin = createOrderStoreAdmin({
      header: orderHeader({ id: orderGid }),
      lines: [lineNode(1, { id: `${orderGid}/LineItem/1` })],
      agreements: [],
      refunds: [],
    });
    const read = await readOrderFact(
      {
        admin,
        shop: { id: "shop-mapper", myshopifyDomain: "mapper.myshopify.com" },
      },
      orderGid,
    );
    expect(read.status).toBe("complete");
    if (read.status !== "complete") {
      throw new Error(`expected complete B read, got ${read.status}`);
    }
    const punched = {
      ...read,
      value: {
        ...read.value,
        lineItems: read.value.lineItems.map((line) => ({
          ...line,
          discountedTotalSetWithCodeDiscounts: null,
        })),
      },
    };
    const mapped = mapBOrderReadResult(punched as unknown as typeof read, {
      shopId: "shop-mapper",
      observationToken: "token",
      observationRequestGen: 1n,
      observationResponseGen: 2n,
      existenceObservedAt: new Date("2026-09-01T00:00:00.000Z"),
      accessScopeSnapshot: ["read_orders"],
      sourceKind: "INCREMENTAL_REFETCH",
    });
    expect(mapped.status).toBe("blocked");
    if (mapped.status === "blocked") {
      expect(mapped.code).toBe("missing_with_code_discount_authority");
    }
  });

  it("retries transport failures and not malformed money", () => {
    expect(
      isRetryableMappedReadIssue({
        status: "incomplete",
        reason: "SNAPSHOT_PAGINATION_INCOMPLETE",
        phase: "lineItems",
        requestedGid: "gid://shopify/Order/1",
        resourceKind: "Order",
      }),
    ).toBe(true);
    expect(
      isRetryableMappedReadIssue({
        status: "failure",
        reason: "ADMIN_READ_ERROR",
        phase: "initial",
        requestedGid: "gid://shopify/Order/1",
        resourceKind: "Order",
      }),
    ).toBe(true);
    expect(
      isRetryableMappedReadIssue({
        status: "failure",
        reason: "MONEY_CURRENCY_MISMATCH",
        phase: "initial",
        requestedGid: "gid://shopify/Order/1",
        resourceKind: "Order",
      }),
    ).toBe(false);
  });
});
