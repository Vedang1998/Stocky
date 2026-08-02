/**
 * Normalization-aware legacy ownership adapter (F-PR2R2-02 / F-PR2R2-05 / D-030).
 *
 * Single authority: phase1-shop-domain-v1 via normalizeShopDomain.
 *
 * Direct-row contract (D-030 — supersedes prior conflict rule):
 *   non-null shopId equal to tenant → owned (legacy shop is non-authoritative)
 *   non-null shopId equal to another tenant → denied
 *   null shopId → normalized legacy shop must equal current domain
 *
 * Scalable tenant scope (F-PR2R2-02):
 *   Never materialize owned row IDs into `{ id: { in: [...] } }`.
 *   Canonical branch: `{ shopId: authority.shopId }`
 *   Null compatibility: distinct raw legacy `shop` strings that normalize
 *   to the authenticated domain via lower(btrim(shop)) equivalence.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import type { TenantAuthority } from "./authority.server";
import { TenantAccessError } from "./errors";
import {
  CHILD_MODEL_SET,
  DIRECT_MODEL_SET,
  PARENT_OWNERSHIP_RULES,
  type DirectMerchantModel,
} from "./models";
import { parentRelationFieldName } from "./relations";
import { normalizeShopDomain } from "./shop-domain";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/** Prisma @@map table names match model names for these merchant models. */
const DIRECT_TABLE: Record<DirectMerchantModel, string> = {
  Supplier: "Supplier",
  PurchaseOrder: "PurchaseOrder",
  ShopifyVariantCache: "ShopifyVariantCache",
  InventorySnapshot: "InventorySnapshot",
  VariantAbcClass: "VariantAbcClass",
  ForecastOverride: "ForecastOverride",
  SalesDailyAggregate: "SalesDailyAggregate",
  ShopSettings: "ShopSettings",
  TransferOrder: "TransferOrder",
  Stocktake: "Stocktake",
  BomComponent: "BomComponent",
  LowStockAlert: "LowStockAlert",
};

/** Per-operation memo for distinct raw legacy shop representations. */
export type TenantScopeMemo = {
  legacyRawByModel: Map<string, Promise<string[]>>;
  scopeByModel: Map<string, Promise<Record<string, unknown>>>;
};

export function createTenantScopeMemo(): TenantScopeMemo {
  return {
    legacyRawByModel: new Map(),
    scopeByModel: new Map(),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a stored legacy shop string authorizes for the current tenant under
 * phase1-shop-domain-v1. Malformed values never authorize on the null-shopId
 * branch.
 */
export function legacyShopMatchesTenant(
  rawShop: unknown,
  authority: TenantAuthority,
): boolean {
  if (typeof rawShop !== "string") return false;
  const result = normalizeShopDomain(rawShop);
  if (!result.ok) return false;
  return result.normalized === authority.myshopifyDomain;
}

/**
 * Post-load / mutation ownership proof for a direct or child row (D-030).
 *
 * Direct:
 *   shopId === tenant → OK (legacy shop ignored)
 *   shopId == null → legacy shop must normalize to tenant domain
 *   shopId === foreign → denied
 * Child:
 *   shopId === tenant or null (lineage enforced separately via parent scope)
 */
export function rowOwnershipOk(
  model: string,
  row: Record<string, unknown>,
  authority: TenantAuthority,
): boolean {
  if (DIRECT_MODEL_SET.has(model)) {
    const shopId = row.shopId;
    const shop = row.shop;

    if (shopId != null && shopId !== authority.shopId) {
      return false;
    }

    if (shopId === authority.shopId) {
      // D-030: canonical shopId is authoritative; legacy shop is non-authoritative.
      return true;
    }

    // null shopId — require normalized legacy match.
    if (shopId == null) {
      return legacyShopMatchesTenant(shop, authority);
    }
    return false;
  }

  if (CHILD_MODEL_SET.has(model)) {
    const shopId = row.shopId;
    if (shopId != null && shopId !== authority.shopId) return false;
    return shopId === authority.shopId || shopId == null;
  }

  return false;
}

/**
 * Accepted normalization variants for regression tests and mocked-client
 * fallback — derived from phase1-shop-domain-v1 (trim + lowercase only).
 */
export function acceptedLegacyShopVariants(canonicalDomain: string): string[] {
  const upper = canonicalDomain.toUpperCase();
  return [
    canonicalDomain,
    upper,
    ` ${canonicalDomain}`,
    `${canonicalDomain} `,
    `  ${canonicalDomain}  `,
    ` ${upper} `,
  ];
}

/**
 * Build the direct-model Prisma where from distinct raw legacy representations.
 * Parameter count depends on distinct historical representations, not row count.
 */
export function buildDirectTenantScopeWhere(
  authority: TenantAuthority,
  matchingRawLegacyRepresentations: string[],
): Record<string, unknown> {
  const nullBranch: Record<string, unknown> = {
    AND: [
      { shopId: null },
      {
        shop: {
          in:
            matchingRawLegacyRepresentations.length > 0
              ? matchingRawLegacyRepresentations
              : ([] as string[]),
        },
      },
    ],
  };
  return {
    OR: [{ shopId: authority.shopId }, nullBranch],
  };
}

/**
 * Query distinct raw legacy shop strings for null-shopId rows that normalize
 * to the authenticated domain. SQL lower(btrim(shop)) is proven equivalent to
 * the null-branch of phase1-shop-domain-v1 for values that survive normalize
 * (trim + lowercase; URL/path/scheme forms never equal the domain after btrim).
 */
export async function resolveMatchingRawLegacyShops(
  client: PrismaLike,
  model: DirectMerchantModel,
  authority: TenantAuthority,
  memo?: TenantScopeMemo,
): Promise<string[]> {
  const cacheKey = model;
  if (memo?.legacyRawByModel.has(cacheKey)) {
    return memo.legacyRawByModel.get(cacheKey)!;
  }

  const promise = (async () => {
    const table = DIRECT_TABLE[model];
    if (!table) {
      throw new TenantAccessError(
        "unknown_merchant_model",
        `No table mapping for direct model ${model}`,
      );
    }

    const raw = (client as PrismaClient).$queryRaw;
    if (typeof raw !== "function") {
      // Mocked clients (unit tests): use accepted variants only.
      return acceptedLegacyShopVariants(authority.myshopifyDomain);
    }

    const rows = (await raw.call(
      client,
      Prisma.sql`
        SELECT DISTINCT "shop" AS shop
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE "shopId" IS NULL
          AND "shop" IS NOT NULL
          AND lower(btrim("shop")) = ${authority.myshopifyDomain}
      `,
    )) as Array<{ shop: string }>;

    return rows.map((r) => r.shop);
  })();

  if (memo) memo.legacyRawByModel.set(cacheKey, promise);
  return promise;
}

/**
 * Resolve scalable direct-model tenant scope (no owned-row ID materialization).
 */
export async function resolveDirectTenantScopeWhere(
  client: PrismaLike,
  model: DirectMerchantModel,
  authority: TenantAuthority,
  memo?: TenantScopeMemo,
): Promise<Record<string, unknown>> {
  const matching = await resolveMatchingRawLegacyShops(
    client,
    model,
    authority,
    memo,
  );
  return buildDirectTenantScopeWhere(authority, matching);
}

/**
 * Sync Prisma where used only as a last-resort fallback when async resolution
 * is unavailable. Prefer resolveDirectTenantScopeWhere / tenantScopeWhere.
 * Uses accepted variants so whitespace/case null-owned rows remain visible
 * under the same D-030 null-branch rule.
 */
export function directTenantScopeWhereSync(
  authority: TenantAuthority,
): Record<string, unknown> {
  return buildDirectTenantScopeWhere(
    authority,
    acceptedLegacyShopVariants(authority.myshopifyDomain),
  );
}

export function childTenantScopeWhereSync(
  model: string,
  authority: TenantAuthority,
): Record<string, unknown> {
  const rule = PARENT_OWNERSHIP_RULES[model];
  if (!rule) {
    throw new TenantAccessError(
      "missing_parent_lineage",
      `Child model ${model} has no parent ownership rule`,
    );
  }
  const parentField = parentRelationFieldName(model);
  if (!parentField) {
    throw new TenantAccessError(
      "missing_parent_lineage",
      `Child model ${model} parent relation is ambiguous`,
    );
  }

  const parentScope = DIRECT_MODEL_SET.has(rule.parentModel)
    ? directTenantScopeWhereSync(authority)
    : childTenantScopeWhereSync(rule.parentModel, authority);

  return {
    AND: [
      {
        OR: [{ shopId: authority.shopId }, { shopId: null }],
      },
      {
        [parentField]: parentScope,
      },
    ],
  };
}

/**
 * Async tenant scope — scalable predicates for direct models; nested parent
 * predicates for children. Memoized per operation/transaction when provided.
 */
export async function tenantScopeWhere(
  client: PrismaLike,
  model: string,
  authority: TenantAuthority,
  memo?: TenantScopeMemo,
): Promise<Record<string, unknown>> {
  if (memo?.scopeByModel.has(model)) {
    return memo.scopeByModel.get(model)!;
  }

  const promise = (async (): Promise<Record<string, unknown>> => {
    if (DIRECT_MODEL_SET.has(model)) {
      return resolveDirectTenantScopeWhere(
        client,
        model as DirectMerchantModel,
        authority,
        memo,
      );
    }
    if (CHILD_MODEL_SET.has(model)) {
      const rule = PARENT_OWNERSHIP_RULES[model];
      if (!rule) {
        throw new TenantAccessError(
          "missing_parent_lineage",
          `Child model ${model} has no parent ownership rule`,
        );
      }
      const parentField = parentRelationFieldName(model);
      if (!parentField) {
        throw new TenantAccessError(
          "missing_parent_lineage",
          `Child model ${model} parent relation is ambiguous`,
        );
      }

      let parentScope: Record<string, unknown>;
      if (DIRECT_MODEL_SET.has(rule.parentModel)) {
        parentScope = await resolveDirectTenantScopeWhere(
          client,
          rule.parentModel as DirectMerchantModel,
          authority,
          memo,
        );
      } else {
        parentScope = await tenantScopeWhere(
          client,
          rule.parentModel,
          authority,
          memo,
        );
      }

      return {
        AND: [
          {
            OR: [{ shopId: authority.shopId }, { shopId: null }],
          },
          {
            [parentField]: parentScope,
          },
        ],
      };
    }
    throw new TenantAccessError(
      "unknown_merchant_model",
      `Model ${model} is not an approved merchant-owned model`,
    );
  })();

  if (memo) memo.scopeByModel.set(model, promise);
  return promise;
}

/** Sync fallback for rare paths that cannot await (prefer async). */
export function tenantScopeWhereSync(
  model: string,
  authority: TenantAuthority,
): Record<string, unknown> {
  if (DIRECT_MODEL_SET.has(model)) {
    return directTenantScopeWhereSync(authority);
  }
  if (CHILD_MODEL_SET.has(model)) {
    return childTenantScopeWhereSync(model, authority);
  }
  throw new TenantAccessError(
    "unknown_merchant_model",
    `Model ${model} is not an approved merchant-owned model`,
  );
}

/**
 * Scalar-only tenant predicate for nested updateMany / deleteMany.
 * Same D-030 ownership rule; uses distinct raw legacy representations when
 * provided (async caller supplies them). Never uses owned-row ID lists.
 */
export function nestedBulkScalarScopeWhere(
  model: string,
  authority: TenantAuthority,
  matchingRawLegacyRepresentations?: string[],
): Record<string, unknown> {
  if (DIRECT_MODEL_SET.has(model)) {
    return buildDirectTenantScopeWhere(
      authority,
      matchingRawLegacyRepresentations ??
        acceptedLegacyShopVariants(authority.myshopifyDomain),
    );
  }
  if (CHILD_MODEL_SET.has(model)) {
    return {
      OR: [{ shopId: authority.shopId }, { shopId: null }],
    };
  }
  throw new TenantAccessError(
    "unknown_merchant_model",
    `Model ${model} is not an approved merchant-owned model`,
  );
}

export async function nestedBulkScalarScopeWhereAsync(
  client: PrismaLike,
  model: string,
  authority: TenantAuthority,
  memo?: TenantScopeMemo,
): Promise<Record<string, unknown>> {
  if (DIRECT_MODEL_SET.has(model)) {
    const matching = await resolveMatchingRawLegacyShops(
      client,
      model as DirectMerchantModel,
      authority,
      memo,
    );
    return nestedBulkScalarScopeWhere(model, authority, matching);
  }
  return nestedBulkScalarScopeWhere(model, authority);
}

export function mergeWhere(
  existing: unknown,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || (isPlainObject(existing) && Object.keys(existing).length === 0)) {
    return { ...scope };
  }
  return { AND: [existing, scope] };
}

export { DIRECT_TABLE };
