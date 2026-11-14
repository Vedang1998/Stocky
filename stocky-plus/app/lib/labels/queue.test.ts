import { describe, expect, it } from "vitest";
import type { LabelProduct } from "../../services/labels/label-products.server";
import { MAX_LABEL_VARIANTS, MAX_LABELS_PER_REQUEST } from "./limits";
import {
  addToQueue,
  labelContent,
  removeFromQueue,
  setQueueCount,
  totalLabels,
  wholeCount,
  type LabelQueueItem,
} from "./queue";

function product(id: number, overrides: Partial<LabelProduct> = {}): LabelProduct {
  return {
    variantGid: `gid://shopify/ProductVariant/${id}`,
    displayName: `Product ${id}`,
    productTitle: `Product ${id}`,
    variantTitle: null,
    sku: `SKU-${id}`,
    barcode: null,
    price: "$1.00",
    compareAtPrice: null,
    vendor: "Vendor",
    ...overrides,
  };
}

function items(change: ReturnType<typeof addToQueue>): LabelQueueItem[] {
  if (!change.ok) throw new Error(change.reason);
  return change.items;
}

describe("wholeCount", () => {
  it.each([
    [3, 3],
    ["4", 4],
    [2.9, 2],
    [0, 1],
    [-5, 1],
    ["abc", 1],
    [Number.NaN, 1],
    [Infinity, 1],
    [999_999, MAX_LABELS_PER_REQUEST],
    [undefined, 1],
  ])("reads %j as %j", (input, expected) => {
    expect(wholeCount(input)).toBe(expected);
  });
});

describe("addToQueue", () => {
  it("appends a new product and merges repeats", () => {
    let queue = items(addToQueue([], product(1)));
    queue = items(addToQueue(queue, product(2), 4));
    queue = items(addToQueue(queue, product(1), 2));
    expect(queue.map((item) => [item.product.variantGid.slice(-1), item.count])).toEqual([
      ["1", 3],
      ["2", 4],
    ]);
    expect(totalLabels(queue)).toBe(7);
  });

  it("does not change the queue it was given", () => {
    const queue = items(addToQueue([], product(1)));
    addToQueue(queue, product(1), 5);
    expect(queue[0].count).toBe(1);
  });

  it("refuses a product beyond the product limit but still merges an existing one", () => {
    const full = Array.from({ length: MAX_LABEL_VARIANTS }, (_, i) => ({
      product: product(i + 1),
      count: 1,
    }));
    expect(addToQueue(full, product(9999))).toEqual({ ok: false, reason: "too_many_products" });
    expect(addToQueue(full, product(1)).ok).toBe(true);
  });

  it("refuses labels beyond the total limit", () => {
    const queue = items(addToQueue([], product(1), MAX_LABELS_PER_REQUEST));
    expect(addToQueue(queue, product(2))).toEqual({ ok: false, reason: "too_many_labels" });
    expect(addToQueue(queue, product(1))).toEqual({ ok: false, reason: "too_many_labels" });
  });
});

describe("setQueueCount", () => {
  it("sets one entry's count", () => {
    const queue = items(addToQueue(items(addToQueue([], product(1))), product(2)));
    const changed = setQueueCount(queue, product(2).variantGid, "12");
    expect(changed.ok && changed.items.map((item) => item.count)).toEqual([1, 12]);
  });

  it("treats a blank or invalid count as one label", () => {
    const queue = items(addToQueue([], product(1), 5));
    const changed = setQueueCount(queue, product(1).variantGid, "");
    expect(changed.ok && changed.items[0].count).toBe(1);
  });

  it("refuses a count that takes the total over the limit", () => {
    const queue = items(addToQueue(items(addToQueue([], product(1), 100)), product(2)));
    expect(setQueueCount(queue, product(2).variantGid, MAX_LABELS_PER_REQUEST)).toEqual({
      ok: false,
      reason: "too_many_labels",
    });
  });
});

describe("removeFromQueue", () => {
  it("removes only the named product", () => {
    const queue = items(addToQueue(items(addToQueue([], product(1))), product(2)));
    expect(removeFromQueue(queue, product(1).variantGid).map((i) => i.product.displayName)).toEqual([
      "Product 2",
    ]);
  });
});

describe("labelContent", () => {
  it("maps a product and a location to label content, with the vendor as supplier", () => {
    expect(labelContent(product(1, { vendor: "Wax Co" }), "Main St")).toEqual({
      productTitle: "Product 1",
      variantTitle: null,
      sku: "SKU-1",
      barcode: null,
      price: "$1.00",
      compareAtPrice: null,
      supplier: "Wax Co",
      location: "Main St",
    });
  });
});
