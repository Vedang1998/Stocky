/**
 * Normalization-aware legacy ownership adapter (F-PR2C-04).
 *
 * Single authority: phase1-shop-domain-v1 via normalizeShopDomain.
 *
 * Direct-row contract (independent review matrix + option b):
 *   non-null shopId equal to tenant → authorized (legacy shop not required
 *     to match exactly; conflicting normalizable-to-foreign shop fails closed
 *     on post-load validation when proof fields are present)
 *   null shopId → normalized legacy shop must equal current domain
 *
 * Database prefilter for null-shopId uses lower(btrim(shop)) via trusted
 * raw SQL ID resolution so whitespace/case variants are neither excluded
 * nor left as foreign false-positives in counts/bulk mutations.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import type { TenantAuthority } from "./authority.server";
import { TenantAccessError } from "./errors";
import {
  CHILD_MODEL_SET,
  DIRECT_MERCHANT_MODELS,
  DIRECT_MODEL_SET,
  MERCHANT_DELEGATE_NAMES,
  PARENT_OWNERSHIP_RULES,
  type DirectMerchantModel,
  type MerchantOwnedModel,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a stored legacy shop string authorizes for the current tenant under
 * phase1-shop-domain-v1. Malformed values never authorize on the null-shopId
 * branch; they also never authorize when used as sole evidence.
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
 * Post-load / mutation ownership proof for a direct or child row.
 *
 * Direct:
 *   shopId === tenant → OK unless legacy shop normalizes to a *foreign* domain
 *   shopId == null → legacy shop must normalize to tenant domain
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
      // Canonical shopId authorizes. Fail closed only when legacy shop is
      // present and normalizes to a different tenant (conflict).
      if (typeof shop === "string" && shop.length > 0) {
        const normalized = normalizeShopDomain(shop);
        if (normalized.ok && normalized.normalized !== authority.myshopifyDomain) {
          return false;
        }
        // Malformed / empty-with-shopId: still authorized via shopId (case 10).
      }
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
 * Sync Prisma where used when ID-list resolution is unavailable.
 * Prefer resolveDirectTenantScopeWhere for correctness on whitespace variants.
 */
export function directTenantScopeWhereSync(
  authority: TenantAuthority,
): Record<string, unknown> {
  return {
    OR: [
      { shopId: authority.shopId },
      {
        AND: [
          { shopId: null },
          {
            shop: {
              equals: authority.myshopifyDomain,
              mode: "insensitive",
            },
          },
        ],
      },
    ],
  };
}

/**
 * Resolve direct-model ownership to an ID-list where using trusted raw SQL
 * so lower(btrim(shop)) semantics stay correct for counts and bulk writes.
 */
export async function resolveDirectTenantScopeWhere(
  client: PrismaLike,
  model: DirectMerchantModel,
  authority: TenantAuthority,
): Promise<Record<string, unknown>> {
  const table = DIRECT_TABLE[model];
  if (!table) {
    throw new TenantAccessError(
      "unknown_merchant_model",
      `No table mapping for direct model ${model}`,
    );
  }

  // Trusted tenant-access module only — never exposed to callers.
  const rows = await (client as PrismaClient).$queryRaw<{ id: string }[]>`
    SELECT id FROM ${Prisma.raw(`"${table}"`)}
    WHERE "shopId" = ${authority.shopId}
       OR (
         "shopId" IS NULL
         AND "shop" IS NOT NULL
         AND lower(btrim("shop")) = ${authority.myshopifyDomain}
       )
  `;

  if (rows.length === 0) {
    return { id: { in: [] as string[] } };
  }
  return { id: { in: rows.map((r) => r.id) } };
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

  // Parent nested filter uses sync scope; parent IDs with whitespace legacy
  // shop are still matched when parent has non-null shopId (option b).
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
 * Async tenant scope — uses ID-list resolution for direct models so
 * normalization-equivalent legacy shops are neither excluded nor over-included.
 */
export async function tenantScopeWhere(
  client: PrismaLike,
  model: string,
  authority: TenantAuthority,
): Promise<Record<string, unknown>> {
  if (DIRECT_MODEL_SET.has(model)) {
    return resolveDirectTenantScopeWhere(
      client,
      model as DirectMerchantModel,
      authority,
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

    // Resolve parent IDs with full normalization semantics, then scope children.
    let parentScope: Record<string, unknown>;
    if (DIRECT_MODEL_SET.has(rule.parentModel)) {
      parentScope = await resolveDirectTenantScopeWhere(
        client,
        rule.parentModel as DirectMerchantModel,
        authority,
      );
    } else {
      parentScope = await tenantScopeWhere(client, rule.parentModel, authority);
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
}

/** Sync fallback for nested include where injection (no await at build time). */
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
 * Prisma ScalarWhereInput rejects relation filters, and the parent nested
 * write already constrains the child collection to the parent row.
 */
export function nestedBulkScalarScopeWhere(
  model: string,
  authority: TenantAuthority,
): Record<string, unknown> {
  if (DIRECT_MODEL_SET.has(model)) {
    // Direct children in a nested collection still carry shopId/shop.
    return {
      OR: [
        { shopId: authority.shopId },
        {
          AND: [
            { shopId: null },
            {
              shop: {
                equals: authority.myshopifyDomain,
                mode: "insensitive",
              },
            },
          ],
        },
      ],
    };
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

export function mergeWhere(
  existing: unknown,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || (isPlainObject(existing) && Object.keys(existing).length === 0)) {
    return { ...scope };
  }
  return { AND: [existing, scope] };
}

/**
 * Accepted normalization variants for regression tests — derived from the
 * actual phase1-shop-domain-v1 rules (trim + lowercase only; no URL forms).
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

export { DIRECT_TABLE };
