import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FROZEN_ORDER_NUMERIC_PRECISION,
  FROZEN_ORDER_NUMERIC_SCALE,
  ORDER_EXISTENCE_KINDS,
  ORDER_LOCK_BEFORE_FIRST_INSERT,
  ORDER_REQUIRED_MONEY_BAGS,
  type ExactMoneyText,
  type RefundShippingLineSnapshot,
} from "./types";

const DIR = path.dirname(fileURLToPath(import.meta.url));

describe("PR6-A order-facts types contract", () => {
  it("is types-only: no Prisma, GraphQL, network, or database I/O", () => {
    const text = readFileSync(path.join(DIR, "types.ts"), "utf8");
    expect(text).not.toMatch(/from ["']@prisma\/client["']/);
    expect(text).not.toMatch(/from ["']\.prisma["']/);
    expect(text).not.toMatch(/graphql-codegen|@shopify\/api-codegen/);
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/\$queryRaw|PrismaClient|pg\./);
  });

  it("freezes exact money as strings and Decimal(20,6) shape", () => {
    const sample: ExactMoneyText = "1.234567";
    expect(typeof sample).toBe("string");
    expect(FROZEN_ORDER_NUMERIC_PRECISION).toBe(20);
    expect(FROZEN_ORDER_NUMERIC_SCALE).toBe(6);
    expect(ORDER_REQUIRED_MONEY_BAGS.refundLine).toContain("priceSet");
  });

  it("includes window/unverified existence kinds and lock-before-first-insert", () => {
    expect(ORDER_EXISTENCE_KINDS).toContain("INACCESSIBLE_HISTORY_WINDOW");
    expect(ORDER_EXISTENCE_KINDS).toContain(
      "ABSENT_SIGNALLED_DELETE_UNVERIFIED",
    );
    expect(ORDER_LOCK_BEFORE_FIRST_INSERT).toBe(true);
  });

  it("exposes refund-shipping snapshot types without a merchant model", () => {
    const snapshot: RefundShippingLineSnapshot = {
      shopifyGid: null,
      subtotal: {
        shopAmount: "1.00",
        shopCurrencyCode: "USD",
        presentmentAmount: "1.00",
        presentmentCurrencyCode: "USD",
      },
      tax: {
        shopAmount: null,
        shopCurrencyCode: null,
        presentmentAmount: null,
        presentmentCurrencyCode: null,
      },
    };
    expect(snapshot.shopifyGid).toBeNull();
    const typesText = readFileSync(path.join(DIR, "types.ts"), "utf8");
    expect(typesText).toMatch(/RefundShippingLineSnapshot/);
    const schema = readFileSync(
      path.join(DIR, "../../../prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).not.toMatch(/model ShopifyOrderShippingLineFact/);
  });
});
