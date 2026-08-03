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
  CHILD_MODEL_SET,
  DIRECT_MODEL_SET,
  MERCHANT_DELEGATE_NAMES,
  MERCHANT_MODEL_SET,
  type DirectMerchantModel,
  type MerchantOwnedModel,
} from "./models";
import {
  resolveMatchingRawLegacyShops,
  rowOwnershipOk,
  tenantScopeWhere,
  type TenantScopeMemo,
} from "./legacy-scope";
import { normalizeShopDomain } from "./shop-domain";

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
    if (value == null) {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Scalar selector ${targetModel}.${key} has invalid value`,
      );
    }
    // Primary keys and string unique fields must be strings — reject numbers
    // that would otherwise surface as PrismaClientValidationError.
    if (key === "id" || key.endsWith("Id") || key === "shop") {
      if (typeof value !== "string") {
        throw new TenantAccessError(
          "unsupported_relation_selector",
          `Scalar selector ${targetModel}.${key} has invalid value`,
        );
      }
    } else if (typeof value !== "string" && typeof value !== "number") {
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
 * Inspect every tenant-bearing field in a unique selector before flatten,
 * coerce, or scoped lookup (F-PR2R3-02).
 *
 * - shopId equal to authenticated shopId → acceptable
 * - shopId different non-empty → foreign_selector_tenant
 * - shopId malformed/empty → unsupported_relation_selector
 * - shop normalizing to authenticated domain → acceptable
 * - shop normalizing to another domain → foreign_selector_tenant
 * - shop malformed → unsupported_relation_selector
 *
 * Never overwrite a supplied foreign tenant value with current authority.
 */
export function assertSelectorTenantIntent(
  targetModel: MerchantOwnedModel,
  selector: unknown,
  authority: TenantAuthority,
): void {
  // Validate shape first (throws unsupported_relation_selector on malformed).
  const predicate = flattenUniqueSelectorPredicate(targetModel, selector);

  if ("shopId" in predicate) {
    const value = predicate.shopId;
    if (value == null || value === "") {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Selector for ${targetModel} has invalid shopId`,
      );
    }
    if (typeof value !== "string") {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Selector for ${targetModel} has invalid shopId`,
      );
    }
    if (value !== authority.shopId) {
      throw new TenantAccessError(
        "foreign_selector_tenant",
        `Selector for ${targetModel} references a foreign shopId`,
      );
    }
  }

  if ("shop" in predicate) {
    const value = predicate.shop;
    if (value == null || value === "") {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Selector for ${targetModel} has invalid shop`,
      );
    }
    if (typeof value !== "string") {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Selector for ${targetModel} has invalid shop`,
      );
    }
    const normalized = normalizeShopDomain(value);
    if (!normalized.ok) {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Selector for ${targetModel} has malformed shop domain`,
      );
    }
    if (normalized.normalized !== authority.myshopifyDomain) {
      throw new TenantAccessError(
        "foreign_selector_tenant",
        `Selector for ${targetModel} references a foreign shop domain`,
      );
    }
  }
}

/**
 * @deprecated Do not coerce shop selectors to a single canonical literal.
 * Null-owned legacy rows store raw shop values; use set-valued ownership
 * predicates via resolveOwnedUniqueRow (F-PR2R4-01).
 */
export function canonicalizeOwnShopInPredicate(
  predicate: Record<string, unknown>,
  authority: TenantAuthority,
): Record<string, unknown> {
  if ("shop" in predicate && typeof predicate.shop === "string") {
    return { ...predicate, shop: authority.myshopifyDomain };
  }
  return predicate;
}

/** Non-tenant business-key components of a flattened unique predicate. */
function businessKeyPredicate(
  predicate: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(predicate)) {
    if (key === "shop" || key === "shopId") continue;
    out[key] = value;
  }
  return out;
}

/**
 * Resolve a unique selector to at most one owned row id under tenant scope.
 * Returns null for foreign/missing (caller maps to not_found / foreign).
 * Never passes compound WhereUniqueInput wrapper keys into findFirst.
 *
 * Tenant-bearing components are validated before any legacy-evidence
 * collection (F-PR2R3-01 / F-PR2R3-02 / F-PR2R4-01 / F-PR2R4-05).
 *
 * Shop-bearing selectors use set-valued null-compatibility ownership —
 * never raw equality against one canonical shop literal.
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

  // Reject foreign tenant-bearing selectors before legacy evidence collection.
  assertSelectorTenantIntent(targetModel, selector, authority);

  const predicate = flattenUniqueSelectorPredicate(targetModel, selector);
  const delegate = getDelegate(client, targetModel);
  const keys = Object.keys(predicate);

  // Two-stage canonical ID lookup (F-PR2R4-05): avoid legacy discovery when
  // the fetched row already has non-null current-tenant shopId.
  if (keys.length === 1 && keys[0] === "id" && typeof predicate.id === "string") {
    const selectFields = DIRECT_MODEL_SET.has(targetModel)
      ? { id: true, shopId: true, shop: true }
      : { id: true, shopId: true };
    const byId = (await delegate.findMany({
      where: { id: predicate.id },
      select: selectFields,
      take: 1,
    })) as Array<{ id: string; shopId: string | null; shop?: string | null }>;

    if (byId.length === 0) return null;
    const row = byId[0]!;
    if (row.shopId === authority.shopId) {
      return { id: row.id };
    }
    if (row.shopId != null && row.shopId !== authority.shopId) {
      return null;
    }
    // null shopId — bounded legacy / parent-lineage proof only.
    if (DIRECT_MODEL_SET.has(targetModel)) {
      const matching = await resolveMatchingRawLegacyShops(
        client,
        targetModel as DirectMerchantModel,
        authority,
        memo,
      );
      if (
        typeof row.shop === "string" &&
        matching.includes(row.shop) &&
        rowOwnershipOk(targetModel, row as Record<string, unknown>, authority)
      ) {
        return { id: row.id };
      }
      return null;
    }
    if (CHILD_MODEL_SET.has(targetModel)) {
      const scope = await tenantScopeWhere(client, targetModel, authority, memo);
      const owned = (await delegate.findMany({
        where: { AND: [{ id: predicate.id }, scope] },
        select: { id: true },
        take: 1,
      })) as Array<{ id: string }>;
      return owned.length === 1 ? { id: owned[0]!.id } : null;
    }
    return null;
  }

  // Canonical shopId_id (and flat shopId+id) — no null-legacy collection.
  if (
    typeof predicate.shopId === "string" &&
    predicate.shopId === authority.shopId &&
    typeof predicate.id === "string" &&
    !("shop" in predicate)
  ) {
    const canonical = (await delegate.findMany({
      where: { id: predicate.id, shopId: authority.shopId },
      select: { id: true },
      take: 1,
    })) as Array<{ id: string }>;
    if (canonical.length === 1) return { id: canonical[0]!.id };
    return null;
  }

  // Shop-bearing unique selectors: ownership OR of canonical shopId and
  // null-compatible accepted raw representations (F-PR2R4-01).
  if ("shop" in predicate && typeof predicate.shop === "string") {
    if (!DIRECT_MODEL_SET.has(targetModel)) {
      throw new TenantAccessError(
        "unsupported_relation_selector",
        `Shop selector is not valid for ${targetModel}`,
      );
    }

    const matching = await resolveMatchingRawLegacyShops(
      client,
      targetModel as DirectMerchantModel,
      authority,
      memo,
    );

    const ownership: Record<string, unknown> = {
      OR: [
        { shopId: authority.shopId },
        {
          AND: [
            { shopId: null },
            {
              shop: {
                in: matching.length > 0 ? matching : ([] as string[]),
              },
            },
          ],
        },
      ],
    };

    const business = businessKeyPredicate(predicate);
    const where: Record<string, unknown> =
      Object.keys(business).length === 0
        ? ownership
        : { AND: [business, ownership] };

    const found = (await delegate.findMany({
      where,
      select: { id: true },
      take: 2,
    })) as Array<{ id: string }>;

    if (found.length === 0) return null;
    if (found.length > 1) {
      throw new TenantAccessError(
        "ambiguous_legacy_unique_selector",
        `${targetModel} unique selector matched multiple owned rows under normalized legacy shop`,
      );
    }
    return { id: found[0]!.id };
  }

  // Remaining selectors (e.g. LeadTimeSnapshot.purchaseOrderId): scoped lookup
  // without inventing shop predicates. Prefer canonical shopId when present.
  const business = businessKeyPredicate(predicate);
  if (typeof predicate.shopId === "string") {
    // Foreign shopId already rejected by assertSelectorTenantIntent.
    const found = (await delegate.findMany({
      where: { AND: [business, { shopId: authority.shopId }] },
      select: { id: true },
      take: 2,
    })) as Array<{ id: string }>;
    if (found.length === 0) return null;
    if (found.length > 1) {
      throw new TenantAccessError(
        "ambiguous_legacy_unique_selector",
        `${targetModel} unique selector matched multiple owned rows`,
      );
    }
    return { id: found[0]!.id };
  }

  const scope = await tenantScopeWhere(client, targetModel, authority, memo);
  const found = (await delegate.findMany({
    where: { AND: [business, scope] },
    select: { id: true },
    take: 2,
  })) as Array<{ id: string }>;

  if (found.length === 0) return null;
  if (found.length > 1) {
    throw new TenantAccessError(
      "ambiguous_legacy_unique_selector",
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
