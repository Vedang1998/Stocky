/**
 * Deterministic expected catalog definitions for enforcement verification.
 * Compare against live PostgreSQL catalog expressions — not names alone.
 */
import {
  ENFORCEMENT_CONTEXT_VERSION,
  TENANT_CONTEXT_HELPER_FN,
  TENANT_CONTEXT_VERSION_FN,
} from "./manifest";

/** Canonical tenant predicate used by all merchant RLS policies. */
export function expectedTenantPredicateSql(): string {
  return `(${quoteBare("shopId")} IS NOT NULL) AND (${quoteBare("shopId")} = ${TENANT_CONTEXT_HELPER_FN}()) AND (${TENANT_CONTEXT_VERSION_FN}() = '${ENFORCEMENT_CONTEXT_VERSION}')`;
}

function quoteBare(ident: string): string {
  return `"${ident}"`;
}

/**
 * Normalize pg_get_expr / policy text for deterministic comparison.
 * Strips ::text casts PostgreSQL may inject; collapses whitespace; lowercases.
 */
export function normalizeCatalogExpr(expr: string | null | undefined): string | null {
  if (expr == null) return null;
  return expr
    .replace(/::text\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
    .toLowerCase();
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

/**
 * Normalize a database URL for early semantic comparison.
 * Does not replace post-connect identity verification.
 */
export function normalizeDatabaseUrlIdentity(raw: string): {
  scheme: string;
  user: string;
  host: string;
  port: number;
  database: string;
} {
  let input = raw.trim();
  if (!input) {
    throw new Error("empty_database_url");
  }
  // Accept postgres:// alias
  if (input.startsWith("postgres://")) {
    input = `postgresql://${input.slice("postgres://".length)}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`malformed_database_url`);
  }
  if (parsed.protocol !== "postgresql:") {
    throw new Error(`unsupported_database_url_scheme:${parsed.protocol}`);
  }
  const hostRaw = parsed.hostname.toLowerCase();
  const host =
    hostRaw === "127.0.0.1" || hostRaw === "::1" ? "localhost" : hostRaw;
  const port = parsed.port ? Number(parsed.port) : 5432;
  // pathname may be "/db" or "/db/" — strip trailing slash
  let database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  database = database.replace(/\/+$/, "");
  if (!database) {
    throw new Error("database_url_missing_database");
  }
  const user = decodeURIComponent(parsed.username || "");
  if (!user) {
    throw new Error("database_url_missing_user");
  }
  return { scheme: "postgresql", user, host, port, database };
}

export function databaseUrlsSemanticallyEqual(a: string, b: string): boolean {
  try {
    const left = normalizeDatabaseUrlIdentity(a);
    const right = normalizeDatabaseUrlIdentity(b);
    return (
      left.user === right.user &&
      left.host === right.host &&
      left.port === right.port &&
      left.database === right.database
    );
  } catch {
    return false;
  }
}
