import { describe, expect, it } from "vitest";
import {
  isOrderFactsMerchantHost,
  type OrderFactsTxnClient,
} from "./types";

describe("PR6-D merchant host typing", () => {
  it("rejects a query-only apply view as the frozen v1 legacy host", () => {
    const queryOnly: OrderFactsTxnClient = {
      $queryRaw: (async () => []) as OrderFactsTxnClient["$queryRaw"],
    };
    expect(isOrderFactsMerchantHost(queryOnly)).toBe(false);
  });

  it("accepts a host with authority and merchant delegates", () => {
    const host = {
      authority: { shopId: "s", myshopifyDomain: "x.myshopify.com" },
      salesDailyAggregate: { upsert: async () => null, findUnique: async () => null, update: async () => null },
      bomComponent: { findMany: async () => [] },
    };
    expect(isOrderFactsMerchantHost(host)).toBe(true);
  });
});
