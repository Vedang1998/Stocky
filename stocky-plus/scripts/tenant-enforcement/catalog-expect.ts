/**
 * Deterministic expected catalog definitions for enforcement verification.
 * Compare against live PostgreSQL catalog expressions — not names alone.
 */
import {
  ENFORCEMENT_CONTEXT_VERSION,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
} from "./manifest";

// Re-export shared URL identity helpers so tooling does not diverge from the
// application runtime module (F-PR3C-01).
export {
  databaseUrlsSemanticallyEqual,
  normalizeDatabaseUrlIdentity,
} from "../../app/db/runtime-identity.server";

/** Canonical tenant predicate used by all merchant RLS policies. */
export function expectedTenantPredicateSql(): string {
  return `(${quoteBare("shopId")} IS NOT NULL) AND (${quoteBare("shopId")} = ${TENANT_CONTEXT_HELPER_FN}()) AND (${TENANT_CONTEXT_VERSION_FN}() = '${ENFORCEMENT_CONTEXT_VERSION}') AND (stocky_shop_processing_enabled(${quoteBare("shopId")}))`;
}

function quoteBare(ident: string): string {
  return `"${ident}"`;
}

/**
 * Normalize pg_get_expr / policy text for deterministic comparison.
 * Strips ::text casts PostgreSQL may inject; collapses whitespace; lowercases;
 * unwraps a single redundant outer parenthesis pair PostgreSQL often adds.
 */
export function normalizeCatalogExpr(expr: string | null | undefined): string | null {
  if (expr == null) return null;
  let out = expr
    .replace(/::text\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
    .toLowerCase();

  // Unwrap balanced outer parentheses while the whole expression is wrapped.
  while (out.startsWith("(") && out.endsWith(")")) {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        depth -= 1;
        if (depth === 0 && i < out.length - 1) {
          wrapsAll = false;
          break;
        }
      }
    }
    if (!wrapsAll || depth !== 0) break;
    out = out.slice(1, -1).trim();
  }
  return out;
}

export function expectedNormalizedTenantPredicate(): string {
  return normalizeCatalogExpr(expectedTenantPredicateSql())!;
}

/** PostgreSQL confdeltype / confupdtype letter → action name. */
export const FK_ACTION_CODES: Record<string, string> = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
};

export function fkActionCode(action: string): string {
  const upper = action.toUpperCase().replace(/_/g, " ");
  for (const [code, name] of Object.entries(FK_ACTION_CODES)) {
    if (name === upper) return code;
  }
  throw new Error(`unknown_fk_action:${action}`);
}
