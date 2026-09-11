export const USD = "USD";

export function moneyBag(
  shopAmount: string,
  currency = USD,
  presentmentAmount = shopAmount,
  presentmentCurrency = currency,
) {
  return {
    shopMoney: { amount: shopAmount, currencyCode: currency },
    presentmentMoney: {
      amount: presentmentAmount,
      currencyCode: presentmentCurrency,
    },
  };
}

export function lineNode(
  index: number,
  overrides?: Record<string, unknown>,
) {
  return {
    id: `gid://shopify/LineItem/${index}`,
    sku: `SKU-${index}`,
    title: `Line ${index}`,
    variantTitle: "Default",
    vendor: "Vendor",
    name: `Line ${index}`,
    isGiftCard: false,
    quantity: 1,
    currentQuantity: 1,
    refundableQuantity: 1,
    unfulfilledQuantity: 0,
    nonFulfillableQuantity: 0,
    originalTotalSet: moneyBag("10.00"),
    originalUnitPriceSet: moneyBag("10.00"),
    discountedTotalSetWithCodeDiscounts: moneyBag("9.00"),
    discountedTotalSetWithoutCodeDiscounts: moneyBag("9.50"),
    totalDiscountSet: moneyBag("1.00"),
    discountedUnitPriceAfterAllDiscountsSet: moneyBag("9.00"),
    variant: {
      id: `gid://shopify/ProductVariant/${index}`,
      legacyResourceId: String(index),
      sku: `SKU-${index}`,
      title: "Default",
    },
    product: {
      id: `gid://shopify/Product/${index}`,
      legacyResourceId: String(index),
      title: `Product ${index}`,
      handle: `product-${index}`,
    },
    ...overrides,
  };
}

export function saleNode(
  index: number,
  overrides?: Record<string, unknown>,
) {
  return {
    __typename: "ProductSale",
    id: `gid://shopify/Sale/${index}`,
    quantity: 1,
    lineType: "PRODUCT",
    actionType: "ORDER",
    totalAmount: moneyBag("10.00"),
    lineItem: { id: `gid://shopify/LineItem/${index}` },
    ...overrides,
  };
}

export function agreementNode(
  index: number,
  sales: ReturnType<typeof saleNode>[],
) {
  return {
    __typename: "OrderAgreement",
    id: `gid://shopify/OrderAgreement/${index}`,
    happenedAt: "2026-01-01T00:00:00Z",
    reason: "ORDER",
    refund: null,
    sales,
  };
}

export function refundLineNode(
  index: number,
  overrides?: Record<string, unknown>,
) {
  return {
    id: `gid://shopify/RefundLineItem/${index}`,
    quantity: 1,
    restockType: "CANCEL",
    lineItem: { id: `gid://shopify/LineItem/${index}` },
    subtotalSet: moneyBag("1.00"),
    totalTaxSet: moneyBag("0.00"),
    priceSet: moneyBag("1.00"),
    ...overrides,
  };
}

export function refundNode(
  index: number,
  lines: ReturnType<typeof refundLineNode>[],
) {
  return {
    id: `gid://shopify/Refund/${index}`,
    legacyResourceId: String(index),
    createdAt: "2026-01-02T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    processedAt: "2026-01-02T00:00:00Z",
    order: { id: "gid://shopify/Order/1" },
    totalRefundedSet: moneyBag("1.00"),
    refundLineItems: lines,
    orderAdjustments: [] as unknown[],
    refundShippingLines: [] as unknown[],
    transactions: [
      {
        id: `gid://shopify/OrderTransaction/${index}`,
        status: "SUCCESS",
        kind: "REFUND",
        createdAt: "2026-01-02T00:00:00Z",
        processedAt: "2026-01-02T00:00:00Z",
        amountSet: moneyBag("1.00"),
      },
    ],
  };
}

export function orderHeader(overrides?: Record<string, unknown>) {
  return {
    id: "gid://shopify/Order/1",
    legacyResourceId: "1",
    name: "#1001",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    processedAt: "2026-01-01T00:00:00Z",
    cancelledAt: null,
    cancelReason: null,
    closed: false,
    closedAt: null,
    edited: false,
    test: false,
    confirmed: true,
    currencyCode: USD,
    presentmentCurrencyCode: USD,
    taxesIncluded: false,
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "UNFULFILLED",
    sourceName: "web",
    currentSubtotalLineItemsQuantity: 1,
    subtotalLineItemsQuantity: 1,
    retailLocation: { id: "gid://shopify/Location/1" },
    originalTotalPriceSet: moneyBag("10.00"),
    currentTotalPriceSet: moneyBag("10.00"),
    currentSubtotalPriceSet: moneyBag("10.00"),
    currentTotalDiscountsSet: moneyBag("0.00"),
    currentShippingPriceSet: moneyBag("0.00"),
    currentTotalTaxSet: moneyBag("0.00"),
    netPaymentSet: moneyBag("10.00"),
    totalRefundedSet: moneyBag("0.00"),
    refundDiscrepancySet: moneyBag("0.00"),
    cartDiscountAmountSet: null,
    currentCartDiscountAmountSet: moneyBag("0.00"),
    ...overrides,
  };
}

export const TRUSTED_SHOP = {
  id: "shop-internal-a",
  myshopifyDomain: "alpha.myshopify.com",
};

export function emptyConnection() {
  return {
    pageInfo: { hasNextPage: false, endCursor: null },
    edges: [] as Array<{ cursor: string; node: unknown }>,
  };
}

export function paginate<T extends { id?: string | null }>(
  items: T[],
  first: unknown,
  after: unknown,
  cursorOf: (item: T, index: number) => string = (item, index) =>
    typeof item.id === "string" && item.id !== ""
      ? item.id
      : `cursor-${index}`,
) {
  const size = typeof first === "number" ? first : items.length;
  let start = 0;
  if (typeof after === "string" && after !== "") {
    const afterIndex = items.findIndex(
      (item, index) => cursorOf(item, index) === after,
    );
    start = afterIndex >= 0 ? afterIndex + 1 : items.length;
  }
  const slice = items.slice(start, start + size);
  const end = start + slice.length;
  const last = slice[slice.length - 1];
  const lastIndex = start + slice.length - 1;
  return {
    pageInfo: {
      hasNextPage: end < items.length,
      endCursor:
        last == null ? null : cursorOf(last, lastIndex),
    },
    edges: slice.map((node, offset) => ({
      cursor: cursorOf(node, start + offset),
      node,
    })),
  };
}

export function connectionOfRefundChildren(
  refund: ReturnType<typeof refundNode>,
  first: unknown,
  after: unknown,
  key: "refundLineItems" | "orderAdjustments" | "refundShippingLines" | "transactions",
) {
  const items = refund[key] as Array<{ id?: string | null }>;
  return paginate(items, first, after);
}
