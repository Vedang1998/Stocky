/**
 * Per-variant planning levels: minimum, shelf limit, manual reorder point,
 * safety stock and lead time. All optional; a variant with no rule uses
 * none of them.
 *
 * Levels belong to a stock scope. "SHOP" levels apply when planning stock
 * across all locations; a location's levels apply only when planning that
 * location. Quantities never fall back from one scope to another because a
 * shelf limit for one store says nothing about the whole shop. Lead time is
 * the exception: a location without its own lead time uses the shop-wide one.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { isUniqueViolation } from "./db-errors.server";
import { MAX_LEAD_TIME_DAYS, parseWholeNumber, type FieldErrors } from "./form";
import { MAX_QUANTITY } from "./types";

export const SHOP_SCOPE = "SHOP";

// Shopify ids are 64-bit integers, so at most 20 digits.
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d{1,20}$/;
const LOCATION_GID = /^gid:\/\/shopify\/Location\/\d{1,20}$/;

/** Largest IN list sent in one query. */
const QUERY_CHUNK = 1000;

export type VariantRuleValues = {
  minimumQuantity: number | null;
  shelfLimitQuantity: number | null;
  reorderPointQuantity: number | null;
  safetyStockQuantity: number | null;
  leadTimeDays: number | null;
};

export const EMPTY_RULE: VariantRuleValues = {
  minimumQuantity: null,
  shelfLimitQuantity: null,
  reorderPointQuantity: null,
  safetyStockQuantity: null,
  leadTimeDays: null,
};

const RULE_SELECT = {
  variantGid: true,
  scopeKey: true,
  minimumQuantity: true,
  shelfLimitQuantity: true,
  reorderPointQuantity: true,
  safetyStockQuantity: true,
  leadTimeDays: true,
} as const;

const RULE_FIELDS = [
  "minimumQuantity",
  "shelfLimitQuantity",
  "reorderPointQuantity",
  "safetyStockQuantity",
  "leadTimeDays",
] as const satisfies readonly (keyof VariantRuleValues)[];

export type EffectiveRule = VariantRuleValues & {
  /** True when the lead time came from the shop-wide rule. */
  leadTimeFromShopScope: boolean;
};

export class ReplenishmentRuleError extends Error {
  constructor(
    readonly code:
      | "invalid_variant"
      | "invalid_scope"
      | "variant_not_found"
      | "location_not_found",
    message: string,
  ) {
    super(message);
    this.name = "ReplenishmentRuleError";
  }
}

export function isVariantGid(value: unknown): value is string {
  return typeof value === "string" && VARIANT_GID.test(value);
}

export function isScopeKey(value: unknown): value is string {
  return (
    value === SHOP_SCOPE ||
    (typeof value === "string" && LOCATION_GID.test(value))
  );
}

function isEmptyRule(values: VariantRuleValues): boolean {
  return RULE_FIELDS.every((field) => values[field] == null);
}

function pickValues(row: Record<string, unknown>): VariantRuleValues {
  return {
    minimumQuantity: row.minimumQuantity as number | null,
    shelfLimitQuantity: row.shelfLimitQuantity as number | null,
    reorderPointQuantity: row.reorderPointQuantity as number | null,
    safetyStockQuantity: row.safetyStockQuantity as number | null,
    leadTimeDays: row.leadTimeDays as number | null,
  };
}

/**
 * Rules for the given variants in the planning scope, with the shop-wide
 * lead time filled in where a location has none. Variants with nothing that
 * applies in this scope are absent from the map.
 */
export async function loadEffectiveRules(
  db: TenantDb,
  variantGids: readonly string[],
  scopeKey: string,
): Promise<Map<string, EffectiveRule>> {
  if (!isScopeKey(scopeKey)) {
    throw new ReplenishmentRuleError("invalid_scope", "Unknown stock scope");
  }
  const scopes =
    scopeKey === SHOP_SCOPE ? [SHOP_SCOPE] : [scopeKey, SHOP_SCOPE];
  const byVariant = new Map<
    string,
    { own?: VariantRuleValues; shop?: VariantRuleValues }
  >();

  const unique = [...new Set(variantGids)];
  for (let i = 0; i < unique.length; i += QUERY_CHUNK) {
    const rows = (await db.replenishmentVariantRule.findMany({
      where: {
        variantGid: { in: unique.slice(i, i + QUERY_CHUNK) },
        scopeKey: { in: scopes },
      },
      select: RULE_SELECT,
    })) as Array<
      Record<string, unknown> & { variantGid: string; scopeKey: string }
    >;
    for (const row of rows) {
      const entry = byVariant.get(row.variantGid) ?? {};
      if (row.scopeKey === scopeKey) entry.own = pickValues(row);
      else entry.shop = pickValues(row);
      byVariant.set(row.variantGid, entry);
    }
  }

  const result = new Map<string, EffectiveRule>();
  for (const [variantGid, { own, shop }] of byVariant) {
    const shopLeadTime = shop?.leadTimeDays ?? null;
    if (own) {
      const inherit = own.leadTimeDays == null && shopLeadTime != null;
      result.set(variantGid, {
        ...own,
        leadTimeDays: inherit ? shopLeadTime : own.leadTimeDays,
        leadTimeFromShopScope: inherit,
      });
    } else if (shopLeadTime != null) {
      result.set(variantGid, {
        ...EMPTY_RULE,
        leadTimeDays: shopLeadTime,
        leadTimeFromShopScope: true,
      });
    }
  }
  return result;
}

/** The stored rule for exactly this variant and scope, for editing. */
export async function getVariantRule(
  db: TenantDb,
  variantGid: string,
  scopeKey: string,
): Promise<VariantRuleValues> {
  if (!isVariantGid(variantGid)) {
    throw new ReplenishmentRuleError("invalid_variant", "Unknown variant");
  }
  if (!isScopeKey(scopeKey)) {
    throw new ReplenishmentRuleError("invalid_scope", "Unknown stock scope");
  }
  const row = (await db.replenishmentVariantRule.findFirst({
    where: { variantGid, scopeKey },
  })) as Record<string, unknown> | null;
  return row ? pickValues(row) : { ...EMPTY_RULE };
}

/**
 * Saves the rule for one variant and scope. Clearing every value deletes the
 * rule, which is allowed even after the variant or location has gone from
 * Shopify. Saving values requires both to exist in this shop's synced data.
 */
export async function saveVariantRule(
  db: TenantDb,
  input: { variantGid: string; scopeKey: string; values: VariantRuleValues },
): Promise<"saved" | "cleared"> {
  const { variantGid, scopeKey, values } = input;
  if (!isVariantGid(variantGid)) {
    throw new ReplenishmentRuleError("invalid_variant", "Unknown variant");
  }
  if (!isScopeKey(scopeKey)) {
    throw new ReplenishmentRuleError("invalid_scope", "Unknown stock scope");
  }

  if (isEmptyRule(values)) {
    await db.replenishmentVariantRule.deleteMany({
      where: { variantGid, scopeKey },
    });
    return "cleared";
  }

  const write = () =>
    db.$transaction(async (tx) => {
      const variant = await tx.shopifyVariantFact.findFirst({
        where: { shopifyGid: variantGid, existenceState: "LIVE" },
        select: { id: true },
      });
      if (!variant) {
        throw new ReplenishmentRuleError(
          "variant_not_found",
          "This variant isn't in your synced catalog.",
        );
      }
      if (scopeKey !== SHOP_SCOPE) {
        const location = await tx.shopifyLocationFact.findFirst({
          where: { shopifyGid: scopeKey, existenceState: "LIVE" },
          select: { id: true },
        });
        if (!location) {
          throw new ReplenishmentRuleError(
            "location_not_found",
            "This location isn't in your synced locations.",
          );
        }
      }

      await tx.replenishmentVariantRule.upsert({
        where: {
          shopId_variantGid_scopeKey: {
            shopId: tx.authority.shopId,
            variantGid,
            scopeKey,
          },
        },
        create: { variantGid, scopeKey, ...values },
        update: values,
      });
    });

  try {
    await write();
  } catch (error) {
    // Two first saves of the same rule raced; the other created the row.
    if (!isUniqueViolation(error)) throw error;
    await write();
  }
  return "saved";
}

export function parseVariantRuleForm(form: FormData):
  | {
      ok: true;
      variantGid: string;
      scopeKey: string;
      values: VariantRuleValues;
    }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const variantGid = form.get("variantGid");
  const scopeKey = form.get("scopeKey");
  if (!isVariantGid(variantGid)) errors.variantGid = "Unknown variant.";
  if (!isScopeKey(scopeKey)) errors.scopeKey = "Unknown stock scope.";

  const quantity = { min: 0, max: MAX_QUANTITY };
  const optional = { optional: true };
  const values: VariantRuleValues = {
    minimumQuantity: parseWholeNumber(
      form.get("minimumQuantity"),
      "minimumQuantity",
      "Minimum",
      quantity,
      errors,
      optional,
    ),
    shelfLimitQuantity: parseWholeNumber(
      form.get("shelfLimitQuantity"),
      "shelfLimitQuantity",
      "Shelf limit",
      quantity,
      errors,
      optional,
    ),
    reorderPointQuantity: parseWholeNumber(
      form.get("reorderPointQuantity"),
      "reorderPointQuantity",
      "Reorder point",
      quantity,
      errors,
      optional,
    ),
    safetyStockQuantity: parseWholeNumber(
      form.get("safetyStockQuantity"),
      "safetyStockQuantity",
      "Safety stock",
      quantity,
      errors,
      optional,
    ),
    leadTimeDays: parseWholeNumber(
      form.get("leadTimeDays"),
      "leadTimeDays",
      "Lead time",
      { min: 0, max: MAX_LEAD_TIME_DAYS },
      errors,
      optional,
    ),
  };

  if (
    Object.keys(errors).length > 0 ||
    !isVariantGid(variantGid) ||
    !isScopeKey(scopeKey)
  ) {
    return { ok: false, errors };
  }
  return { ok: true, variantGid, scopeKey, values };
}
