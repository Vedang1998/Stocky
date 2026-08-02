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
 * Scalable tenant scope (F-PR2R2-02 / F-PR2R3-01):
 *   Never materialize owned row IDs into `{ id: { in: [...] } }`.
 *   Canonical branch: `{ shopId: authority.shopId }`
 *   Null compatibility: distinct raw legacy `shop` strings that normalize
 *   to the authenticated domain, bounded by phase1-legacy-evidence-v1.
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
import {
  normalizeShopDomain,
  shopDomainTrimCharacters,
} from "./shop-domain";

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

/**
 * Versioned bound on distinct null-ownership legacy representations
 * (F-PR2R3-01). Far below PostgreSQL’s ~32,765 bind-parameter ceiling.
 */
export const LEGACY_EVIDENCE_VERSION = "phase1-legacy-evidence-v1" as const;

/** Default distinct-form limit per model × tenant. */
export const DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS = 1024;

/**
 * Absolute ceiling that configuration may never exceed. Remains far below
 * PostgreSQL’s parameter limit so overflow is always an application signal.
 */
export const ABSOLUTE_MAX_DISTINCT_LEGACY_SHOP_FORMS = 4096;

function resolveLegacyEvidenceLimit(): number {
  const raw = process.env.TENANT_MAX_DISTINCT_LEGACY_SHOP_FORMS;
  if (raw == null || raw === "") {
    return DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_DISTINCT_LEGACY_SHOP_FORMS;
  }
  return Math.min(parsed, ABSOLUTE_MAX_DISTINCT_LEGACY_SHOP_FORMS);
}

export const MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT =
  resolveLegacyEvidenceLimit();

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
 * fallback — derived from phase1-shop-domain-v1 (ECMAScript trim + lowercase).
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
    `\t${canonicalDomain}`,
    `${canonicalDomain}\n`,
    `\r${canonicalDomain}\r`,
    `\u00A0${canonicalDomain}`,
    `\uFEFF${canonicalDomain}`,
  ];
}

/**
 * Build the direct-model Prisma where from distinct raw legacy representations.
 * Parameter count depends on distinct historical representations, not row count.
 * Caller must ensure `matchingRawLegacyRepresentations.length` is within
 * `MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT`.
 */
export function buildDirectTenantScopeWhere(
  authority: TenantAuthority,
  matchingRawLegacyRepresentations: string[],
): Record<string, unknown> {
  if (
    matchingRawLegacyRepresentations.length >
    MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT
  ) {
    throw new TenantAccessError(
      "legacy_evidence_overflow",
      safeLegacyOverflowMessage({
        model: "(build)",
        shopId: authority.shopId,
        limit: MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT,
        observedCount: matchingRawLegacyRepresentations.length,
        correlationId: authority.correlationId,
      }),
    );
  }

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

function safeLegacyOverflowMessage(args: {
  model: string;
  shopId: string;
  limit: number;
  observedCount: number;
  correlationId?: string;
}): string {
  // Structured diagnostics only — never include raw legacy values.
  return [
    `legacy_evidence_overflow version=${LEGACY_EVIDENCE_VERSION}`,
    `model=${args.model}`,
    `shopId=${args.shopId}`,
    `limit=${args.limit}`,
    `observedCount=${args.observedCount}`,
    `correlationId=${args.correlationId ?? "none"}`,
  ].join(" ");
}

/**
 * Query distinct raw legacy shop strings for null-shopId rows that normalize
 * to the authenticated domain.
 *
 * SQL candidate discovery uses `lower(btrim(shop, <exact ECMAScript trim set>))`
 * matching phase1-shop-domain-v1. SQL is never final authority — every raw
 * value must still pass `normalizeShopDomain` before inclusion (F-PR2R3-03).
 *
 * Collection is hard-bounded by phase1-legacy-evidence-v1 (F-PR2R3-01).
 * Overflow throws `legacy_evidence_overflow` without building an `in` list
 * and without sending a near-limit query to PostgreSQL.
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

    const limit = MAX_DISTINCT_LEGACY_SHOP_FORMS_PER_MODEL_TENANT;
    const raw = (client as PrismaClient).$queryRaw;
    if (typeof raw !== "function") {
      // Mocked clients (unit tests): use accepted variants only.
      const variants = acceptedLegacyShopVariants(authority.myshopifyDomain);
      if (variants.length > limit) {
        throw new TenantAccessError(
          "legacy_evidence_overflow",
          safeLegacyOverflowMessage({
            model,
            shopId: authority.shopId,
            limit,
            observedCount: variants.length,
            correlationId: authority.correlationId,
          }),
        );
      }
      return variants;
    }

    const trimChars = shopDomainTrimCharacters();
    // Fetch at most limit+1 so we can detect overflow without materializing
    // tens of thousands of bind parameters into a Prisma `in` list.
    const fetchCap = limit + 1;
    const rows = (await raw.call(
      client,
      Prisma.sql`
        SELECT DISTINCT "shop" AS shop
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE "shopId" IS NULL
          AND "shop" IS NOT NULL
          AND lower(btrim("shop", ${trimChars})) = ${authority.myshopifyDomain}
        LIMIT ${fetchCap}
      `,
    )) as Array<{ shop: string }>;

    if (rows.length > limit) {
      throw new TenantAccessError(
        "legacy_evidence_overflow",
        safeLegacyOverflowMessage({
          model,
          shopId: authority.shopId,
          limit,
          observedCount: rows.length,
          correlationId: authority.correlationId,
        }),
      );
    }

    // Final authority: JavaScript normalizer (SQL is candidate discovery only).
    const accepted: string[] = [];
    for (const row of rows) {
      if (legacyShopMatchesTenant(row.shop, authority)) {
        accepted.push(row.shop);
      }
    }

    if (accepted.length > limit) {
      throw new TenantAccessError(
        "legacy_evidence_overflow",
        safeLegacyOverflowMessage({
          model,
          shopId: authority.shopId,
          limit,
          observedCount: accepted.length,
          correlationId: authority.correlationId,
        }),
      );
    }

    return accepted;
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
