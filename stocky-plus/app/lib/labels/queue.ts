import type { LabelProduct } from "../../services/labels/label-products.server";
import type { LabelContent } from "./layout";
import { MAX_LABEL_VARIANTS, MAX_LABELS_PER_REQUEST } from "./limits";

export type LabelQueueItem = { product: LabelProduct; count: number };

export type QueueChange =
  | { ok: true; items: LabelQueueItem[] }
  | { ok: false; reason: "too_many_products" | "too_many_labels" };

export function totalLabels(items: readonly LabelQueueItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

/** A whole number of labels from 1 to the per-request maximum; anything else is 1. */
export function wholeCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.min(MAX_LABELS_PER_REQUEST, Math.max(1, Math.floor(count)));
}

/** Adds labels for a product, merging with an entry it already has. */
export function addToQueue(
  items: readonly LabelQueueItem[],
  product: LabelProduct,
  count = 1,
): QueueChange {
  const existing = items.find((item) => item.product.variantGid === product.variantGid);
  if (!existing && items.length >= MAX_LABEL_VARIANTS) {
    return { ok: false, reason: "too_many_products" };
  }
  const added = wholeCount(count);
  if (totalLabels(items) + added > MAX_LABELS_PER_REQUEST) {
    return { ok: false, reason: "too_many_labels" };
  }
  return {
    ok: true,
    items: existing
      ? items.map((item) =>
          item === existing ? { ...item, count: item.count + added } : item,
        )
      : [...items, { product, count: added }],
  };
}

/** Sets one entry's count, keeping the total within the limit. */
export function setQueueCount(
  items: readonly LabelQueueItem[],
  variantGid: string,
  count: unknown,
): QueueChange {
  const next = wholeCount(count);
  const others = totalLabels(items.filter((item) => item.product.variantGid !== variantGid));
  if (others + next > MAX_LABELS_PER_REQUEST) {
    return { ok: false, reason: "too_many_labels" };
  }
  return {
    ok: true,
    items: items.map((item) =>
      item.product.variantGid === variantGid ? { ...item, count: next } : item,
    ),
  };
}

export function removeFromQueue(
  items: readonly LabelQueueItem[],
  variantGid: string,
): LabelQueueItem[] {
  return items.filter((item) => item.product.variantGid !== variantGid);
}

export function queueProblem(reason: "too_many_products" | "too_many_labels"): string {
  return reason === "too_many_products"
    ? `A print run can hold at most ${MAX_LABEL_VARIANTS} different products. Print this run first, then start another.`
    : `A print run can hold at most ${MAX_LABELS_PER_REQUEST} labels. Print this run first, then start another.`;
}

/** What goes on a label for a queued product, once the location is chosen. */
export function labelContent(product: LabelProduct, location: string | null): LabelContent {
  return {
    productTitle: product.productTitle,
    variantTitle: product.variantTitle,
    sku: product.sku,
    barcode: product.barcode,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    supplier: product.vendor,
    location,
  };
}
