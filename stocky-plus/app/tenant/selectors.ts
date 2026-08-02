/**
 * Model-aware Prisma unique selector metadata and resolver (F-PR2C-01 / F-PR2C-02).
 *
 * Do not pass arbitrary WhereUniqueInput through. Unknown shapes fail closed.
 * Owned targets are rewritten to canonical `{ id }` before Prisma mutation.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import type { TenantAuthority } from "./authority.server";
import { TenantAccessError } from "./errors";
import {
  MERCHANT_DELEGATE_NAMES,
  MERCHANT_MODEL_SET,
  type MerchantOwnedModel,
} from "./models";
import {
  tenantScopeWhere,
  type TenantScopeMemo,
} from "./legacy-scope";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export type SelectorField =
  | { kind: "scalar"; name: string }
  | { kind: "compound"; name: string; fields: readonly string[] };

export type ModelSelectorMeta = {
  model: MerchantOwnedModel;
  /** Explicit unique selectors accepted for nested relation ops. */
  selectors: readonly SelectorField[];
};

/**
 * Enumerated from the current Prisma schema. Keep in sync with schema.prisma.
 * Every nested relation target uses this list — no generic WhereUniqueInput.
 */
export const MODEL_UNIQUE_SELECTORS: Record<
  MerchantOwnedModel,
  ModelSelectorMeta
> = {
  Supplier: {
    model: "Supplier",
    selectors: [
      { kind: "scalar", name: "id" },
      { kind: "compound", name: "shopId_id", fields: ["shopId", "id"] },
    ],
  },
  PurchaseOrder: {
    model: "PurchaseOrder",
    selectors: [
      { kind: "scalar", name: "id" },
      { kind: "compound", name: "shopId_id", fields: ["shopId", "id"] },
    ],
  },
  ShopifyVariantCache: {
    model: "ShopifyVariantCache",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "shop_shopifyVariantId",
        fields: ["shop", "shopifyVariantId"],
      },
    ],
  },
  InventorySnapshot: {
    model: "InventorySnapshot",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "shop_shopifyVariantId_locationId_snapshotDate",
        fields: ["shop", "shopifyVariantId", "locationId", "snapshotDate"],
      },
    ],
  },
  VariantAbcClass: {
    model: "VariantAbcClass",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "shop_shopifyVariantId_locationId_metric",
        fields: ["shop", "shopifyVariantId", "locationId", "metric"],
      },
    ],
  },
  ForecastOverride: {
    model: "ForecastOverride",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "shop_variantId_locationId",
        fields: ["shop", "variantId", "locationId"],
      },
    ],
  },
  SalesDailyAggregate: {
    model: "SalesDailyAggregate",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "shop_shopifyVariantId_locationId_date",
        fields: ["shop", "shopifyVariantId", "locationId", "date"],
      },
    ],
  },
  ShopSettings: {
    model: "ShopSettings",
    selectors: [
      { kind: "scalar", name: "id" },
      { kind: "scalar", name: "shop" },
    ],
  },
  TransferOrder: {
    model: "TransferOrder",
    selectors: [
      { kind: "scalar", name: "id" },
      { kind: "compound", name: "shopId_id", fields: ["shopId", "id"] },
    ],
  },
  Stocktake: {
    model: "Stocktake",
    selectors: [
      { kind: "scalar", name: "id" },
      { kind: "compound", name: "shopId_id", fields: ["shopId", "id"] },
    ],
  },
  BomComponent: {
    model: "BomComponent",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "shop_bundleVariantId_componentVariantId",
        fields: ["shop", "bundleVariantId", "componentVariantId"],
      },
    ],
  },
  LowStockAlert: {
    model: "LowStockAlert",
    selectors: [{ kind: "scalar", name: "id" }],
  },
  SupplierSkuMapping: {
    model: "SupplierSkuMapping",
    selectors: [
      { kind: "scalar", name: "id" },
      {
        kind: "compound",
        name: "supplierId_shopifyVariantId",
        fields: ["supplierId", "shopifyVariantId"],
      },
    ],
  },
  VolumePriceTier: {
    model: "VolumePriceTier",
    selectors: [{ kind: "scalar", name: "id" }],
  },
  LeadTimeSnapshot: {
    model: "LeadTimeSnapshot",
    selectors: [
      { kind: "scalar", name: "id" },
      { kind: "scalar", name: "purchaseOrderId" },
    ],
  },
  POLineItem: {
    model: "POLineItem",
    selectors: [{ kind: "scalar", name: "id" }],
  },
  TransferLineItem: {
    model: "TransferLineItem",
    selectors: [{ kind: "scalar", name: "id" }],
  },
  StocktakeLineItem: {
    model: "StocktakeLineItem",
    selectors: [{ kind: "scalar", name: "id" }],
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDelegate(client: PrismaLike, model: MerchantOwnedModel) {
  const name = MERCHANT_DELEGATE_NAMES[model];
  return (
    client as unknown as Record<
      string,
      { [op: string]: (args?: unknown) => Promise<unknown> }
    >
  )[name];
}

/**
 * Validate selector against explicit metadata and convert to a candidate
 * predicate suitable for findFirst / findMany (not trusted alone for auth).
 */
export function parseOwnedRelationSelector(
  targetModel: MerchantOwnedModel,
  selector: unknown,
): Record<string, unknown> {
  if (selector == null || selector === true || selector === false) {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Empty or boolean selector is not permitted for ${targetModel}`,
    );
  }
  if (typeof selector === "string") {
    // Prisma sometimes accepts bare id strings for connect — treat as { id }.
    return { id: selector };
  }
  if (!isPlainObject(selector)) {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Malformed selector for ${targetModel}`,
    );
  }

  const keys = Object.keys(selector);
  if (keys.length === 0) {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Empty selector object for ${targetModel}`,
    );
  }

  const meta = MODEL_UNIQUE_SELECTORS[targetModel];
  if (!meta) {
    throw new TenantAccessError(
      "unknown_merchant_model",
      `No selector metadata for ${targetModel}`,
    );
  }

  // Exactly one top-level unique selector key (Prisma WhereUniqueInput shape).
  if (keys.length !== 1) {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Selector for ${targetModel} must use exactly one unique key; got [${keys.join(", ")}]`,
    );
  }

  const key = keys[0]!;
  const value = selector[key];
  const match = meta.selectors.find((s) =>
    s.kind === "scalar" ? s.name === key : s.name === key,
  );

  if (!match) {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Unsupported unique selector '${key}' for ${targetModel}`,
    );
  }

  if (match.kind === "scalar") {
    if (value == null || (typeof value !== "string" && typeof value !== "number")) {
      // Dates for unique fields are objects — allow Date for date fields.
      if (!(value instanceof Date)) {
        throw new TenantAccessError(
          "unsupported_relation_selector",
          `Scalar selector ${targetModel}.${key} has invalid value`,
        );
      }
    }
    return { [key]: value };
  }

  // Compound: { shopId_id: { shopId, id } }
  if (!isPlainObject(value)) {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Compound selector ${targetModel}.${key} must be an object`,
    );
  }
  const compoundKeys = Object.keys(value);
  for (const field of match.fields) {
    if (!(field in value)) {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Compound selector ${targetModel}.${key} missing field '${field}'`,
      );
    }
  }
  for (const ck of compoundKeys) {
    if (!match.fields.includes(ck)) {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Compound selector ${targetModel}.${key} has unexpected field '${ck}'`,
      );
    }
  }

  // Flatten compound wrapper into a normal candidate predicate.
  return { ...value };
}

/**
 * Flatten a validated unique selector into scalar WhereInput equality
 * predicates (compound wrappers expanded). Shared by nested and top-level.
 */
export function flattenUniqueSelectorPredicate(
  targetModel: MerchantOwnedModel,
  selector: unknown,
): Record<string, unknown> {
  return parseOwnedRelationSelector(targetModel, selector);
}

/**
 * Resolve a unique selector to at most one owned row id under tenant scope.
 * Returns null for foreign/missing (caller maps to not_found / foreign).
 * Never passes compound WhereUniqueInput wrapper keys into findFirst.
 */
export async function resolveOwnedUniqueRow(args: {
  client: PrismaLike;
  targetModel: MerchantOwnedModel;
  selector: unknown;
  authority: TenantAuthority;
  memo?: TenantScopeMemo;
}): Promise<{ id: string } | null> {
  const { client, targetModel, selector, authority, memo } = args;

  if (!MERCHANT_MODEL_SET.has(targetModel)) {
    throw new TenantAccessError(
      "unknown_merchant_model",
      `Model ${targetModel} is not merchant-owned`,
    );
  }

  let predicate = flattenUniqueSelectorPredicate(targetModel, selector);
  // Coerce legacy shop equality in selectors to the authenticated domain so
  // case/whitespace caller variants still resolve owned rows (tenant scope
  // separately authorizes null-owned rows via distinct raw representations).
  if ("shop" in predicate && typeof predicate.shop === "string") {
    predicate = { ...predicate, shop: authority.myshopifyDomain };
  }
  const scope = await tenantScopeWhere(client, targetModel, authority, memo);
  const delegate = getDelegate(client, targetModel);

  const found = (await delegate.findMany({
    where: { AND: [predicate, scope] },
    select: { id: true },
    take: 2,
  })) as Array<{ id: string }>;

  if (found.length === 0) return null;
  if (found.length > 1) {
    throw new TenantAccessError(
      "foreign_relation_target",
      `${targetModel} unique selector matched multiple owned rows`,
    );
  }
  return { id: found[0]!.id };
}

/**
 * Resolve a relation-target selector to a canonical owned `{ id }`.
 * Performs tenant-scoped lookup; requires exactly one owned row.
 */
export async function resolveOwnedRelationSelector(args: {
  client: PrismaLike;
  targetModel: MerchantOwnedModel;
  selector: unknown;
  authority: TenantAuthority;
  memo?: TenantScopeMemo;
}): Promise<{ id: string }> {
  const found = await resolveOwnedUniqueRow(args);
  if (!found) {
    throw new TenantAccessError(
      "foreign_relation_target",
      `${args.targetModel} relation target is missing or foreign to the tenant`,
    );
  }
  return found;
}

/**
 * Resolve many selectors (array form) to canonical `{ id }` list.
 * Empty array is allowed (e.g. set: []).
 */
export async function resolveOwnedRelationSelectors(args: {
  client: PrismaLike;
  targetModel: MerchantOwnedModel;
  selectors: unknown;
  authority: TenantAuthority;
  memo?: TenantScopeMemo;
}): Promise<Array<{ id: string }>> {
  const { client, targetModel, selectors, authority, memo } = args;
  const items = normalizeToArray(selectors);
  const out: Array<{ id: string }> = [];
  for (const item of items) {
    out.push(
      await resolveOwnedRelationSelector({
        client,
        targetModel,
        selector: item,
        authority,
        memo,
      }),
    );
  }
  return out;
}

/**
 * Merge rewritten nested connect/create elements into existing sibling ops
 * without discarding caller intent (F-PR2R2-04).
 */
export function appendNestedOperation(
  existing: unknown,
  additions: unknown[],
): unknown {
  if (additions.length === 0) return existing;
  const existingItems =
    existing === undefined ? [] : normalizeToArray(existing);
  const merged = [...existingItems, ...additions];
  if (merged.length === 1) return merged[0];
  return merged;
}

export function normalizeToArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * After a tenant-scoped miss on connectOrCreate.where, prove no global row
 * exists for the exact validated unique selector (F-PR2C-02).
 */
export async function globalUniqueSelectorExists(args: {
  client: PrismaLike;
  targetModel: MerchantOwnedModel;
  selector: unknown;
}): Promise<boolean> {
  const { client, targetModel, selector } = args;
  // Re-validate shape; use the original unique-key form for Prisma findUnique.
  if (!isPlainObject(selector) && typeof selector !== "string") {
    throw new TenantAccessError(
      "unsupported_relation_selector",
      `Malformed connectOrCreate.where for ${targetModel}`,
    );
  }

  // Build Prisma WhereUniqueInput from metadata (preserve compound wrappers).
  let whereUnique: Record<string, unknown>;
  if (typeof selector === "string") {
    whereUnique = { id: selector };
  } else {
    const keys = Object.keys(selector as Record<string, unknown>);
    if (keys.length !== 1) {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `connectOrCreate.where for ${targetModel} must use exactly one unique key`,
      );
    }
    // Validate via parse (throws on unsupported), then keep original shape.
    parseOwnedRelationSelector(targetModel, selector);
    whereUnique = { ...(selector as Record<string, unknown>) };
  }

  const delegate = getDelegate(client, targetModel);
  // Narrow unscoped existence check inside the trusted tenant-access module.
  // Use findUnique with the original WhereUniqueInput shape (compound wrappers
  // are valid here). Fall back to flattened findFirst if needed.
  try {
    const row = await delegate.findUnique({
      where: whereUnique,
      select: { id: true },
    });
    return row != null;
  } catch {
    const predicate = parseOwnedRelationSelector(targetModel, selector);
    const row = await delegate.findFirst({
      where: predicate,
      select: { id: true },
    });
    return row != null;
  }
}
