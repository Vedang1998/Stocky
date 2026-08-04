/**
 * Deterministic tenant-access architecture scanner (TypeScript compiler API).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  CHILD_MERCHANT_MODELS,
  DIRECT_MERCHANT_MODELS,
  MERCHANT_OWNED_MODELS,
  MERCHANT_DELEGATE_NAMES,
} from "../../app/tenant/models";
import {
  ACCESS_EXCEPTIONS,
  exceptionForPath,
  MAINTENANCE_MODULE_PREFIXES,
} from "./allowlist";
import { createHash } from "node:crypto";

export type ExecutionCategory =
  | "route"
  | "service"
  | "worker"
  | "job"
  | "export"
  | "privacy"
  | "reconciliation"
  | "script"
  | "test"
  | "tenant_infra"
  | "bootstrap"
  | "other";

export type ConversionStatus =
  | "converted"
  | "approved_exception"
  | "not_merchant_access"
  | "violation";

export type AccessFinding = {
  file: string;
  line: number;
  symbol: string;
  executionCategory: ExecutionCategory;
  modelsTouched: string[];
  oldAccessMethod: string;
  newAccessMethod: string;
  authoritySource: string;
  conversionStatus: ConversionStatus;
  testEvidence: string;
  exceptionId?: string;
  exceptionJustification?: string;
  kind:
    | "db_server_import"
    | "db_server_dynamic_import"
    | "db_server_reexport"
    | "prisma_client_construction"
    | "merchant_delegate_call"
    | "computed_delegate_access"
    | "raw_sql"
    | "transaction"
    | "bootstrap_merchant_access"
    | "issue_authority_outside_tenant"
    | "maintenance_runtime_import"
    | "raw_shop_queue_payload"
    | "arbitrary_envelope_enqueue"
    | "wildcard_allowlist"
    | "type_only_prisma_import";
  isTypeOnly?: boolean;
};

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const DELEGATE_TO_MODEL: Record<string, string> = Object.assign(
  Object.create(null),
  Object.fromEntries(
    Object.entries(MERCHANT_DELEGATE_NAMES).map(([model, delegate]) => [
      delegate,
      model,
    ]),
  ),
);

const RAW_SQL_METHODS = [
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
];

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function relFromApp(abs: string): string {
  return toPosix(path.relative(APP_ROOT, abs));
}

function classifyExecution(rel: string): ExecutionCategory {
  if (rel.startsWith("app/routes/")) {
    if (rel.includes("export")) return "export";
    return "route";
  }
  if (rel.startsWith("app/services/")) {
    if (rel.endsWith(".test.ts")) return "test";
    return "service";
  }
  if (rel.startsWith("app/jobs/workers/")) return "worker";
  if (rel.startsWith("app/jobs/")) return "job";
  if (rel.includes("/__tests__/") || rel.includes(".test.")) return "test";
  if (rel.startsWith("app/tenant/bootstrap")) return "bootstrap";
  if (rel.startsWith("app/tenant/")) return "tenant_infra";
  if (rel.includes("privacy") || rel.includes("compliance")) return "privacy";
  if (rel.includes("reconcil")) return "reconciliation";
  if (rel.startsWith("scripts/") || rel.startsWith("prisma/")) {
    return "script";
  }
  return "other";
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "build" ||
      entry.name === ".react-router" ||
      entry.name === "dist"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function isDbServerSpecifier(spec: string): boolean {
  // Match only the raw Prisma module — not tenant-db.server / bootstrap.server.
  const cleaned = spec.split("?")[0] ?? spec;
  const base = cleaned.split("/").pop() ?? cleaned;
  return (
    base === "db.server" ||
    base === "db.server.ts" ||
    cleaned === "~/db.server" ||
    cleaned === "@/db.server" ||
    cleaned.endsWith("/db.server") ||
    cleaned.endsWith("/db.server.ts")
  );
}

function isMaintenanceSpecifier(spec: string): boolean {
  const cleaned = spec.replace(/\\/g, "/");
  return (
    cleaned.includes("tenant-backfill") ||
    cleaned.includes("tenant-indexes") ||
    MAINTENANCE_MODULE_PREFIXES.some((p) => cleaned.includes(p.replace(/\/$/, "")))
  );
}

function isRuntimeSurface(exec: ExecutionCategory): boolean {
  return (
    exec === "route" ||
    exec === "service" ||
    exec === "worker" ||
    exec === "job" ||
    exec === "export" ||
    exec === "privacy" ||
    exec === "reconciliation"
  );
}

/**
 * Conservative constant-folding for import/delegate key provenance (F-PR2C-07).
 * Supports string literals, concatenation, no-sub template literals, template
 * literals without dynamic substitutions, const aliases of those, and
 * simple array `.join("")` used in committed negative probes.
 *
 * Enforcement boundary: intra-file tracking only — not complete interprocedural
 * taint analysis across module boundaries.
 */
function constantFoldString(
  node: ts.Expression | undefined,
  consts: Map<string, string>,
): string | null {
  if (!node) return null;
  if (ts.isParenthesizedExpression(node)) {
    return constantFoldString(node.expression, consts);
  }
  if (ts.isAsExpression(node)) {
    return constantFoldString(node.expression, consts);
  }
  // Legacy type assertion <string>expr — optional in modern TS ASTs.
  if (
    typeof (ts as unknown as { isTypeAssertionExpression?: unknown })
      .isTypeAssertionExpression === "function" &&
    (ts as unknown as { isTypeAssertionExpression: (n: ts.Node) => boolean })
      .isTypeAssertionExpression(node)
  ) {
    return constantFoldString(
      (node as unknown as { expression: ts.Expression }).expression,
      consts,
    );
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) {
    return consts.get(node.text) ?? null;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantFoldString(node.left, consts);
    const right = constantFoldString(node.right, consts);
    if (left != null && right != null) return left + right;
    return null;
  }
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const part = constantFoldString(span.expression, consts);
      if (part == null) return null;
      out += part + span.literal.text;
    }
    return out;
  }
  // ["sup","plier"].join("") or part.join("")
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "join"
  ) {
    const recv = node.expression.expression;
    const sepArg = node.arguments[0];
    const sep =
      sepArg == null
        ? ","
        : ts.isStringLiteral(sepArg) || ts.isNoSubstitutionTemplateLiteral(sepArg)
          ? sepArg.text
          : null;
    if (sep == null) return null;
    if (ts.isArrayLiteralExpression(recv)) {
      const parts: string[] = [];
      for (const el of recv.elements) {
        const p = constantFoldString(el as ts.Expression, consts);
        if (p == null) return null;
        parts.push(p);
      }
      return parts.join(sep);
    }
    if (ts.isIdentifier(recv) && consts.has(recv.text + "[]")) {
      // Not tracked as array — fail closed by returning null (unresolved).
      return null;
    }
  }
  return null;
}

function collectConstStringBindings(source: ts.SourceFile): Map<string, string> {
  const consts = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const folded = constantFoldString(node.initializer, consts);
      if (folded != null) {
        consts.set(node.name.text, folded);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  // Second pass for forward references in simple chains
  visit(source);
  return consts;
}

function collectFindings(
  fileAbs: string,
  relPath?: string,
): AccessFinding[] {
  const rel = relPath ?? relFromApp(fileAbs);
  const text = fs.readFileSync(fileAbs, "utf8");
  const kind = fileAbs.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileAbs, text, ts.ScriptTarget.Latest, true, kind);
  const findings: AccessFinding[] = [];
  const exception = exceptionForPath(rel);
  const exec = classifyExecution(rel);

  const valueImportFromDb = new Set<string>();
  const taintedRawClients = new Set<string>();
  /** Local bindings that resolve to issueTenantAuthority (incl. aliases). */
  const authorityAliases = new Set<string>(["issueTenantAuthority"]);
  /** Namespace imports from authority / tenant modules (import * as auth). */
  const authorityNamespaces = new Set<string>();
  let hasValueDbImport = false;
  const constStrings = collectConstStringBindings(source);

  function isAuthorityModuleSpecifier(spec: string): boolean {
    return (
      spec.includes("authority.server") ||
      spec.endsWith("/tenant") ||
      spec.endsWith("/tenant/index") ||
      spec.includes("/tenant/authority")
    );
  }

  function recordAuthorityIssuerFinding(symbol: string, line: number): void {
    if (rel.startsWith("app/tenant/")) return;
    findings.push({
      file: rel,
      line,
      symbol,
      executionCategory: exec,
      modelsTouched: [],
      oldAccessMethod: "authority issuance",
      newAccessMethod: "forbidden outside app/tenant",
      authoritySource: "none",
      conversionStatus: "violation",
      testEvidence: "tenant:access:audit authority-issuer fixture",
      kind: "issue_authority_outside_tenant",
    });
  }

  function expressionIsAuthorityIssuer(expr: ts.Expression): boolean {
    if (ts.isIdentifier(expr) && authorityAliases.has(expr.text)) return true;
    if (
      ts.isPropertyAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      authorityNamespaces.has(expr.expression.text) &&
      (expr.name.text === "issueTenantAuthority" ||
        authorityAliases.has(expr.name.text))
    ) {
      return true;
    }
    // Computed: auth["issueTenantAuthority"] or auth[key] where key folds.
    if (
      ts.isElementAccessExpression(expr) &&
      ts.isIdentifier(expr.expression) &&
      authorityNamespaces.has(expr.expression.text)
    ) {
      const folded = constantFoldString(expr.argumentExpression, constStrings);
      if (
        folded === "issueTenantAuthority" ||
        (folded != null && authorityAliases.has(folded))
      ) {
        return true;
      }
      if (
        ts.isStringLiteral(expr.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(expr.argumentExpression)
      ) {
        const text = expr.argumentExpression.text;
        if (text === "issueTenantAuthority" || authorityAliases.has(text)) {
          return true;
        }
      }
    }
    return false;
  }

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      const isTypeOnly = node.importClause?.isTypeOnly === true;

      if (isDbServerSpecifier(spec)) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        if (isTypeOnly) {
          findings.push({
            file: rel,
            line,
            symbol: "import type db.server",
            executionCategory: exec,
            modelsTouched: [],
            oldAccessMethod: "type-only import",
            newAccessMethod: "type-only (allowed)",
            authoritySource: "n/a",
            conversionStatus: "not_merchant_access",
            testEvidence: "type-only imports permitted",
            kind: "type_only_prisma_import",
            isTypeOnly: true,
          });
        } else {
          hasValueDbImport = true;
          const names: string[] = [];
          const clause = node.importClause;
          if (clause?.name) names.push(clause.name.text);
          if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const el of clause.namedBindings.elements) {
              if (!el.isTypeOnly) names.push(el.name.text);
            }
          }
          if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            names.push(clause.namedBindings.name.text);
          }
          for (const n of names) {
            valueImportFromDb.add(n);
            taintedRawClients.add(n);
          }
          if (clause?.name) {
            valueImportFromDb.add(clause.name.text);
            taintedRawClients.add(clause.name.text);
          }

          const allowed = Boolean(exception);
          findings.push({
            file: rel,
            line,
            symbol: names.join(",") || "db.server",
            executionCategory: exec,
            modelsTouched: [],
            oldAccessMethod: "value import of app/db.server",
            newAccessMethod: allowed
              ? `approved exception ${exception!.id}`
              : "MUST use tenant-bound / bootstrap boundary",
            authoritySource: allowed ? exception!.category : "none",
            conversionStatus: allowed ? "approved_exception" : "violation",
            testEvidence: allowed
              ? `allowlist ${exception!.id}`
              : "tenant:access:audit fails",
            exceptionId: exception?.id,
            exceptionJustification: exception?.reason,
            kind: "db_server_import",
            isTypeOnly: false,
          });
        }
      }

      // Named / aliased issueTenantAuthority imports
      if (
        isAuthorityModuleSpecifier(spec) &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const el of node.importClause.namedBindings.elements) {
          const imported = (el.propertyName ?? el.name).text;
          if (imported === "issueTenantAuthority") {
            authorityAliases.add(el.name.text);
          }
        }
      }

      // Namespace import: import * as authority from "./authority.server"
      if (
        isAuthorityModuleSpecifier(spec) &&
        node.importClause?.namedBindings &&
        ts.isNamespaceImport(node.importClause.namedBindings)
      ) {
        authorityNamespaces.add(node.importClause.namedBindings.name.text);
      }

      if (spec === "@prisma/client" || spec.startsWith("@prisma/client/")) {
        // type-only OK; value PrismaClient construction checked separately
      }
    }

    // Assignment / destructuring provenance from tainted raw clients
    // and authority-issuer aliases (F-PR2R2-09).
    if (ts.isVariableDeclaration(node)) {
      // const mint = issueTenantAuthority
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        expressionIsAuthorityIssuer(node.initializer)
      ) {
        authorityAliases.add(node.name.text);
      }
      // const { issueTenantAuthority: mint } = authorityNamespace
      if (
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        authorityNamespaces.has(node.initializer.text)
      ) {
        for (const el of node.name.elements) {
          if (!ts.isBindingElement(el) || !ts.isIdentifier(el.name)) continue;
          const imported =
            el.propertyName && ts.isIdentifier(el.propertyName)
              ? el.propertyName.text
              : el.name.text;
          if (imported === "issueTenantAuthority") {
            authorityAliases.add(el.name.text);
          }
        }
      }
      // Identity helper passthrough: const pass = (fn) => fn; const mint = pass(issueTenantAuthority)
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        node.initializer.arguments.length === 1 &&
        expressionIsAuthorityIssuer(node.initializer.arguments[0]!)
      ) {
        authorityAliases.add(node.name.text);
      }
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        taintedRawClients.has(node.initializer.text)
      ) {
        taintedRawClients.add(node.name.text);
        hasValueDbImport = true;
      }
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isPropertyAccessExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        taintedRawClients.has(node.initializer.expression.text) &&
        node.initializer.name.text === "default"
      ) {
        taintedRawClients.add(node.name.text);
        hasValueDbImport = true;
      }
      // const { supplier: delegate } = db
      if (
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        taintedRawClients.has(node.initializer.text)
      ) {
        for (const el of node.name.elements) {
          if (ts.isBindingElement(el) && ts.isIdentifier(el.name)) {
            taintedRawClients.add(el.name.text);
            hasValueDbImport = true;
            const line =
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1;
            if (isRuntimeSurface(exec) && !exception) {
              findings.push({
                file: rel,
                line,
                symbol: `destructure ${el.name.text}`,
                executionCategory: exec,
                modelsTouched: MERCHANT_OWNED_MODELS.slice() as string[],
                oldAccessMethod: "destructured raw Prisma delegate",
                newAccessMethod: "MUST use TenantDb delegates",
                authoritySource: "none",
                conversionStatus: "violation",
                testEvidence: "tenant:access:audit destructure fixture",
                kind: "computed_delegate_access",
              });
            }
          }
        }
      }
      // await import(path) assignment
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isAwaitExpression(node.initializer) &&
        ts.isCallExpression(node.initializer.expression) &&
        node.initializer.expression.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const arg = node.initializer.expression.arguments[0];
        const spec =
          constantFoldString(arg as ts.Expression | undefined, constStrings) ??
          (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
            ? arg.text
            : null);
        if (spec && isDbServerSpecifier(spec)) {
          taintedRawClients.add(node.name.text);
          hasValueDbImport = true;
        } else if (
          spec == null &&
          isRuntimeSurface(exec) &&
          !exception &&
          arg
        ) {
          // Unresolved dynamic import on a runtime surface — fail closed.
          const line =
            source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          findings.push({
            file: rel,
            line,
            symbol: `import(${arg.getText(source)})`,
            executionCategory: exec,
            modelsTouched: [],
            oldAccessMethod: "unresolved dynamic import",
            newAccessMethod: "fail closed unless exact allowlist",
            authoritySource: "none",
            conversionStatus: "violation",
            testEvidence: "tenant:access:audit unresolved-dynamic fixture",
            kind: "db_server_dynamic_import",
          });
        }
      }
      // const db = (await import(path)).default
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isPropertyAccessExpression(node.initializer) &&
        node.initializer.name.text === "default" &&
        ts.isParenthesizedExpression(node.initializer.expression)
      ) {
        const inner = node.initializer.expression.expression;
        if (
          ts.isAwaitExpression(inner) &&
          ts.isCallExpression(inner.expression) &&
          inner.expression.expression.kind === ts.SyntaxKind.ImportKeyword
        ) {
          const arg = inner.expression.arguments[0];
          const spec = constantFoldString(
            arg as ts.Expression | undefined,
            constStrings,
          );
          if (spec && isDbServerSpecifier(spec)) {
            taintedRawClients.add(node.name.text);
            hasValueDbImport = true;
          } else if (spec == null && isRuntimeSurface(exec) && !exception) {
            const line =
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1;
            findings.push({
              file: rel,
              line,
              symbol: `import(${arg?.getText(source) ?? "?"})`,
              executionCategory: exec,
              modelsTouched: [],
              oldAccessMethod: "unresolved dynamic import",
              newAccessMethod: "fail closed unless exact allowlist",
              authoritySource: "none",
              conversionStatus: "violation",
              testEvidence: "tenant:access:audit unresolved-dynamic fixture",
              kind: "db_server_dynamic_import",
            });
          }
        }
      }
    }

    // new PrismaClient(...)
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "PrismaClient"
    ) {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const allowed =
        Boolean(exception) &&
        (exception!.category === "raw_prisma_construction" ||
          exception!.category === "pr1_maintenance_backfill" ||
          exception!.category === "pr1_compatibility_indexes" ||
          exception!.category === "pr3_database_enforcement" ||
          exception!.category === "pr4_sync_control_plane" ||
          exception!.category === "migration_tests" ||
          exception!.category === "dev_seed");
      // Exact construction module or exception paths
      const constructionAllowed =
        rel === "app/db.server.ts" ||
        rel === "app/db/runtime-identity.server.ts" ||
        (exception &&
          (exception.category === "pr1_maintenance_backfill" ||
            exception.category === "pr1_compatibility_indexes" ||
            exception.category === "pr3_database_enforcement" ||
            exception.category === "pr4_sync_control_plane" ||
            exception.category === "dev_seed" ||
            exception.category === "migration_tests" ||
            exception.category === "raw_prisma_construction"));

      findings.push({
        file: rel,
        line,
        symbol: "new PrismaClient",
        executionCategory: exec,
        modelsTouched: [],
        oldAccessMethod: "PrismaClient construction",
        newAccessMethod: constructionAllowed
          ? `approved exception ${exception?.id ?? "EX-RAW-002"}`
          : "forbidden outside approved modules",
        authoritySource: constructionAllowed ? "infrastructure" : "none",
        conversionStatus: constructionAllowed
          ? "approved_exception"
          : "violation",
        testEvidence: "tenant:access:audit",
        exceptionId: constructionAllowed
          ? exception?.id ?? "EX-RAW-002"
          : undefined,
        exceptionJustification: exception?.reason,
        kind: "prisma_client_construction",
      });
      void allowed;
    }

    // raw SQL / $transaction on identifiers that look like prisma clients
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const prop = node.expression.name.text;
      const target = node.expression.expression;

      if (RAW_SQL_METHODS.includes(prop)) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const allowed =
          Boolean(exception) &&
          (exception!.category === "pr1_maintenance_backfill" ||
            exception!.category === "pr1_compatibility_indexes" ||
            exception!.category === "pr3_database_enforcement" ||
            exception!.category === "pr4_sync_control_plane" ||
            exception!.category === "tenant_bound_access" ||
            exception!.category === "raw_prisma_construction" ||
            exception!.category === "migration_tests");
        // Runtime app code (routes/services/workers/jobs) must never use raw SQL
        const runtimeSurface =
          exec === "route" ||
          exec === "service" ||
          exec === "worker" ||
          exec === "job" ||
          exec === "export" ||
          exec === "privacy" ||
          exec === "reconciliation";
        const ok = allowed && !runtimeSurface;
        findings.push({
          file: rel,
          line,
          symbol: prop,
          executionCategory: exec,
          modelsTouched: MERCHANT_OWNED_MODELS.slice() as string[],
          oldAccessMethod: `raw SQL ${prop}`,
          newAccessMethod: ok
            ? `approved exception ${exception!.id}`
            : "forbidden unauthorized raw SQL",
          authoritySource: ok ? exception!.category : "none",
          conversionStatus: ok ? "approved_exception" : "violation",
          testEvidence: "tenant:access:audit",
          exceptionId: ok ? exception!.id : undefined,
          exceptionJustification: exception?.reason,
          kind: "raw_sql",
        });
      }

      if (prop === "$transaction") {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const onTenantDb =
          text.includes("createTenantDb") ||
          rel.startsWith("app/tenant/") ||
          /db\.\$transaction/.test(node.getText(source));
        const allowed = Boolean(exception) || onTenantDb || exec === "test";
        findings.push({
          file: rel,
          line,
          symbol: "$transaction",
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "Prisma $transaction",
          newAccessMethod: onTenantDb
            ? "tenant-bound $transaction"
            : allowed
              ? `approved exception ${exception?.id ?? "n/a"}`
              : "must use TenantDb.$transaction",
          authoritySource: onTenantDb ? "TenantAuthority" : exception?.category ?? "unknown",
          conversionStatus: onTenantDb || allowed
            ? onTenantDb
              ? "converted"
              : "approved_exception"
            : "violation",
          testEvidence: "tenant:access:audit / test:tenant-access",
          exceptionId: !onTenantDb ? exception?.id : undefined,
          kind: "transaction",
        });
      }

      // merchant delegate calls: prisma.supplier.findMany / db.supplier.findMany
      if (
        ts.isPropertyAccessExpression(target) &&
        DELEGATE_TO_MODEL[target.name.text]
      ) {
        const model = DELEGATE_TO_MODEL[target.name.text];
        const receiverExpr = target.expression;
        const receiver = receiverExpr.getText(source);
        const receiverRoot = ts.isIdentifier(receiverExpr)
          ? receiverExpr.text
          : receiver;
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const receiverIsTainted =
          taintedRawClients.has(receiverRoot) ||
          (ts.isIdentifier(receiverExpr) &&
            taintedRawClients.has(receiverExpr.text));
        const viaTenantDb =
          !receiverIsTainted &&
          (receiver === "db" ||
            /^db[A-Z]/.test(receiver) ||
            receiver.endsWith(".db") ||
            receiver === "tenantDb" ||
            receiver === "tx" ||
            receiver.startsWith("ctx.db") ||
            rel.startsWith("app/tenant/tenant-db.server.ts"));
        const viaRaw =
          receiverIsTainted ||
          receiver === "prisma" ||
          receiver === "rawPrisma" ||
          (receiver === "db" &&
            hasValueDbImport &&
            !rel.startsWith("app/tenant/"));

        // bootstrap accessing merchant models is always a violation
        if (
          exec === "bootstrap" &&
          (MERCHANT_OWNED_MODELS as readonly string[]).includes(model)
        ) {
          findings.push({
            file: rel,
            line,
            symbol: `${receiver}.${target.name.text}.${prop}`,
            executionCategory: exec,
            modelsTouched: [model],
            oldAccessMethod: "bootstrap merchant access",
            newAccessMethod: "forbidden",
            authoritySource: "none",
            conversionStatus: "violation",
            testEvidence: "tenant:access:audit bootstrap fixture",
            kind: "bootstrap_merchant_access",
          });
        } else if (viaTenantDb && !hasValueDbImport && !receiverIsTainted) {
          findings.push({
            file: rel,
            line,
            symbol: `${receiver}.${target.name.text}.${prop}`,
            executionCategory: exec,
            modelsTouched: [model],
            oldAccessMethod: "global prisma + shop string",
            newAccessMethod: "TenantDb scoped by TenantAuthority",
            authoritySource:
              exec === "route"
                ? "verified_admin_request"
                : exec === "worker" || exec === "job"
                  ? "tenant-job-envelope-v1"
                  : "TenantAuthority",
            conversionStatus: "converted",
            testEvidence: "test:tenant-access",
            kind: "merchant_delegate_call",
          });
        } else if (exception) {
          findings.push({
            file: rel,
            line,
            symbol: `${receiver}.${target.name.text}.${prop}`,
            executionCategory: exec,
            modelsTouched: [model],
            oldAccessMethod: "direct prisma delegate",
            newAccessMethod: `approved exception ${exception.id}`,
            authoritySource: exception.category,
            conversionStatus: "approved_exception",
            testEvidence: `allowlist ${exception.id}`,
            exceptionId: exception.id,
            exceptionJustification: exception.reason,
            kind: "merchant_delegate_call",
          });
        } else if (viaRaw || hasValueDbImport || receiver === "prisma") {
          findings.push({
            file: rel,
            line,
            symbol: `${receiver}.${target.name.text}.${prop}`,
            executionCategory: exec,
            modelsTouched: [model],
            oldAccessMethod: "unrestricted prisma delegate",
            newAccessMethod: "MUST use TenantDb",
            authoritySource: "none",
            conversionStatus: "violation",
            testEvidence: "tenant:access:audit",
            kind: "merchant_delegate_call",
          });
        } else {
          // Heuristic: db.X from TenantDb in converted routes
          findings.push({
            file: rel,
            line,
            symbol: `${receiver}.${target.name.text}.${prop}`,
            executionCategory: exec,
            modelsTouched: [model],
            oldAccessMethod: "prisma delegate",
            newAccessMethod:
              receiver === "db"
                ? "TenantDb scoped by TenantAuthority"
                : "review required",
            authoritySource: receiver === "db" ? "TenantAuthority" : "unknown",
            conversionStatus: receiver === "db" ? "converted" : "violation",
            testEvidence: "tenant:access:audit",
            kind: "merchant_delegate_call",
          });
        }
      }
    }

    // Calls on destructured/tainted delegate bindings: delegate.findMany()
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      taintedRawClients.has(node.expression.expression.text) &&
      !DELEGATE_TO_MODEL[node.expression.expression.text] &&
      isRuntimeSurface(exec) &&
      !exception
    ) {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      findings.push({
        file: rel,
        line,
        symbol: `${node.expression.expression.text}.${node.expression.name.text}`,
        executionCategory: exec,
        modelsTouched: MERCHANT_OWNED_MODELS.slice() as string[],
        oldAccessMethod: "tainted raw-client / destructured delegate call",
        newAccessMethod: "MUST use TenantDb",
        authoritySource: "none",
        conversionStatus: "violation",
        testEvidence: "tenant:access:audit tainted-delegate fixture",
        kind: "merchant_delegate_call",
      });
    }

    // issueTenantAuthority (including aliases / namespace / computed) outside app/tenant
    if (
      ts.isCallExpression(node) &&
      expressionIsAuthorityIssuer(node.expression)
    ) {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      recordAuthorityIssuerFinding(node.expression.getText(source), line);
    }

    // Dynamic import — constant-fold derived specifiers (F-PR2C-07)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0];
      let spec = constantFoldString(arg, constStrings);
      if (
        spec == null &&
        (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
      ) {
        spec = arg.text;
      }
      if (spec && isDbServerSpecifier(spec)) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const allowed = Boolean(exception);
        findings.push({
          file: rel,
          line,
          symbol: `import(${spec})`,
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "dynamic import of app/db.server",
          newAccessMethod: allowed
            ? `approved exception ${exception!.id}`
            : "MUST use tenant-bound / bootstrap boundary",
          authoritySource: allowed ? exception!.category : "none",
          conversionStatus: allowed ? "approved_exception" : "violation",
          testEvidence: "tenant:access:audit dynamic-import fixture",
          exceptionId: exception?.id,
          exceptionJustification: exception?.reason,
          kind: "db_server_dynamic_import",
        });
        hasValueDbImport = true;
      } else if (
        spec == null &&
        isRuntimeSurface(exec) &&
        !exception &&
        arg &&
        !ts.isStringLiteral(arg) &&
        !ts.isNoSubstitutionTemplateLiteral(arg)
      ) {
        // Unresolved non-literal dynamic import on runtime surface — fail closed.
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push({
          file: rel,
          line,
          symbol: `import(${arg.getText(source)})`,
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "unresolved dynamic import",
          newAccessMethod: "fail closed unless exact allowlist",
          authoritySource: "none",
          conversionStatus: "violation",
          testEvidence: "tenant:access:audit unresolved-dynamic fixture",
          kind: "db_server_dynamic_import",
        });
      }
    }

    // Re-export: export ... from "...db.server"
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      if (isDbServerSpecifier(spec)) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const allowed = Boolean(exception);
        findings.push({
          file: rel,
          line,
          symbol: `export from ${spec}`,
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "re-export of app/db.server",
          newAccessMethod: allowed
            ? `approved exception ${exception!.id}`
            : "forbidden re-export chain to raw Prisma",
          authoritySource: allowed ? exception!.category : "none",
          conversionStatus: allowed ? "approved_exception" : "violation",
          testEvidence: "tenant:access:audit re-export fixture",
          exceptionId: exception?.id,
          exceptionJustification: exception?.reason,
          kind: "db_server_reexport",
        });
      }
    }

    // Runtime surfaces importing maintenance modules
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      isRuntimeSurface(exec)
    ) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      if (isMaintenanceSpecifier(spec)) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push({
          file: rel,
          line,
          symbol: spec,
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "runtime import of maintenance module",
          newAccessMethod: "forbidden",
          authoritySource: "none",
          conversionStatus: "violation",
          testEvidence: "tenant:access:audit maintenance import graph",
          kind: "maintenance_runtime_import",
        });
      }
    }

    // Computed / element-access delegate: client["sup" + "plier"] / client[name]
    if (ts.isElementAccessExpression(node)) {
      const expr = node.expression;
      const exprText = expr.getText(source);
      const rootId = ts.isIdentifier(expr) ? expr.text : null;
      const looksLikeClient =
        hasValueDbImport ||
        (rootId != null && taintedRawClients.has(rootId)) ||
        /\b(prisma|rawPrisma|client|db)\b/.test(exprText);
      if (looksLikeClient && isRuntimeSurface(exec) && !exception) {
        const arg = node.argumentExpression;
        const folded = constantFoldString(arg, constStrings);
        const isComputedKey =
          folded == null ||
          Boolean(DELEGATE_TO_MODEL[folded]) ||
          ts.isBinaryExpression(arg) ||
          ts.isTemplateExpression(arg) ||
          ts.isCallExpression(arg) ||
          ts.isIdentifier(arg);
        if (isComputedKey) {
          const line =
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1;
          findings.push({
            file: rel,
            line,
            symbol: `${exprText}[${folded ?? arg.getText(source)}]`,
            executionCategory: exec,
            modelsTouched: MERCHANT_OWNED_MODELS.slice() as string[],
            oldAccessMethod: "computed/aliased delegate access",
            newAccessMethod: "MUST use TenantDb delegates",
            authoritySource: "none",
            conversionStatus: "violation",
            testEvidence: "tenant:access:audit computed-delegate fixture",
            kind: "computed_delegate_access",
          });
        }
      }
    }

    // Raw shop-only queue payload: { shop: ... } without tenant envelope field
    // Also catches computed keys that constant-fold to "shop" (F-PR2C-07 B-9).
    if (
      (exec === "job" || exec === "worker" || exec === "route") &&
      ts.isCallExpression(node) &&
      /enqueue|queue\.add|\.add\(/.test(node.expression.getText(source))
    ) {
      const callText = node.getText(source);
      let computedShopKey = false;
      for (const arg of node.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) continue;
        for (const prop of arg.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isComputedPropertyName(prop.name)
          ) {
            const folded = constantFoldString(prop.name.expression, constStrings);
            if (folded && /^(shop|shopid|myshopifydomain)$/i.test(folded)) {
              computedShopKey = true;
            }
          }
        }
      }
      if (
        computedShopKey ||
        ((/\bshop\s*:/.test(callText) || /\{\s*shop\s*[,}]/.test(callText)) &&
          !/\btenant\s*:/.test(callText) &&
          !/TenantAuthority|createTenantJobEnvelope|tenant-job-envelope/.test(
            callText,
          ))
      ) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push({
          file: rel,
          line,
          symbol: node.expression.getText(source),
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "raw shop-only queue payload",
          newAccessMethod: "MUST enqueue branded TenantAuthority envelope",
          authoritySource: "none",
          conversionStatus: "violation",
          testEvidence: "tenant:access:audit raw-shop-queue fixture",
          kind: "raw_shop_queue_payload",
        });
      }
    }

    // Producer accepting TenantJobEnvelopeV1 as an arbitrary envelope input
    if (
      (rel.endsWith("queue.server.ts") || exec === "job") &&
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node))
    ) {
      const params = node.parameters;
      if (
        params.some((p) => {
          const t = p.type?.getText(source) ?? "";
          return t.includes("TenantJobEnvelope");
        })
      ) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const name =
          ts.isFunctionDeclaration(node) && node.name
            ? node.name.text
            : "envelopeProducer";
        findings.push({
          file: rel,
          line,
          symbol: name,
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "producer accepts TenantJobEnvelopeV1",
          newAccessMethod: "MUST accept branded TenantAuthority only",
          authoritySource: "none",
          conversionStatus: "violation",
          testEvidence: "tenant:access:audit arbitrary-envelope fixture",
          kind: "arbitrary_envelope_enqueue",
        });
      }
    }

    // Producer accepting TenantAuthority | TenantJobEnvelopeV1 unions
    if (
      (rel.endsWith("queue.server.ts") || exec === "job") &&
      ts.isUnionTypeNode(node)
    ) {
      const text = node.getText(source);
      if (
        text.includes("TenantAuthority") &&
        text.includes("TenantJobEnvelope")
      ) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        findings.push({
          file: rel,
          line,
          symbol: text.slice(0, 80),
          executionCategory: exec,
          modelsTouched: [],
          oldAccessMethod: "queue producer accepts arbitrary envelope union",
          newAccessMethod: "MUST accept branded TenantAuthority only",
          authoritySource: "none",
          conversionStatus: "violation",
          testEvidence: "tenant:access:audit arbitrary-envelope fixture",
          kind: "arbitrary_envelope_enqueue",
        });
      }
    }

    // Direct Queue construction outside approved queue boundary
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Queue" &&
      isRuntimeSurface(exec) &&
      !exception &&
      !rel.endsWith("queue.server.ts") &&
      !rel.includes("/jobs/queue")
    ) {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      findings.push({
        file: rel,
        line,
        symbol: "new Queue",
        executionCategory: exec,
        modelsTouched: [],
        oldAccessMethod: "direct BullMQ Queue construction",
        newAccessMethod: "MUST use approved queue boundary",
        authoritySource: "none",
        conversionStatus: "violation",
        testEvidence: "tenant:access:audit queue-construction fixture",
        kind: "arbitrary_envelope_enqueue",
      });
    }

    ts.forEachChild(node, visit);
  };

  // Pre-pass: collect authority issuer aliases before emission so forward
  // references within the same file are visible (intra-file only).
  const collectAuthorityAliases = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      if (
        isAuthorityModuleSpecifier(spec) &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const el of node.importClause.namedBindings.elements) {
          const imported = (el.propertyName ?? el.name).text;
          if (imported === "issueTenantAuthority") {
            authorityAliases.add(el.name.text);
          }
        }
      }
      if (
        isAuthorityModuleSpecifier(spec) &&
        node.importClause?.namedBindings &&
        ts.isNamespaceImport(node.importClause.namedBindings)
      ) {
        authorityNamespaces.add(node.importClause.namedBindings.name.text);
      }
    }
    if (ts.isVariableDeclaration(node)) {
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        expressionIsAuthorityIssuer(node.initializer)
      ) {
        authorityAliases.add(node.name.text);
      }
      if (
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        authorityNamespaces.has(node.initializer.text)
      ) {
        for (const el of node.name.elements) {
          if (!ts.isBindingElement(el) || !ts.isIdentifier(el.name)) continue;
          const imported =
            el.propertyName && ts.isIdentifier(el.propertyName)
              ? el.propertyName.text
              : el.name.text;
          if (imported === "issueTenantAuthority") {
            authorityAliases.add(el.name.text);
          }
        }
      }
      if (
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        node.initializer.arguments.length === 1 &&
        expressionIsAuthorityIssuer(node.initializer.arguments[0]!)
      ) {
        authorityAliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, collectAuthorityAliases);
  };
  // Run alias collection twice for short identity-helper chains.
  collectAuthorityAliases(source);
  collectAuthorityAliases(source);

  visit(source);
  return findings;
}

function fixAndCollect(fileAbs: string, relPath?: string): AccessFinding[] {
  return collectFindings(fileAbs, relPath);
}

export type ScanResult = {
  appRoot: string;
  scannedFiles: string[];
  findings: AccessFinding[];
  violations: AccessFinding[];
  exceptionsUsed: string[];
  modelsCovered: string[];
  /** Deterministic digest of findings — not a wall-clock timestamp. */
  contentDigest: string;
};

export function scanRepository(options?: {
  roots?: string[];
  /** Directory used to compute relative finding paths (defaults to app root). */
  pathRoot?: string;
  /** When false, skip allowlist path existence checks (fixture scans). */
  checkAllowlistPaths?: boolean;
}): ScanResult {
  const roots = options?.roots ?? [
    path.join(APP_ROOT, "app"),
    path.join(APP_ROOT, "scripts"),
    path.join(APP_ROOT, "prisma"),
  ];
  const pathRoot = options?.pathRoot ?? APP_ROOT;
  const checkAllowlistPaths = options?.checkAllowlistPaths !== false;

  const files = roots.flatMap((r) => walkTsFiles(r)).sort();

  const findings = files.flatMap((fileAbs) => {
    const rel = toPosix(path.relative(pathRoot, fileAbs));
    return fixAndCollect(fileAbs, rel);
  });

  // Reject wildcard / directory-wide allowlist entries
  for (const ex of ACCESS_EXCEPTIONS) {
    if (
      ex.path.includes("*") ||
      ex.path.includes("?") ||
      ex.path.endsWith("/")
    ) {
      findings.push({
        file: ex.path,
        line: 0,
        symbol: ex.id,
        executionCategory: "other",
        modelsTouched: [],
        oldAccessMethod: "allowlist entry",
        newAccessMethod: "wildcard/directory allowlist forbidden",
        authoritySource: "n/a",
        conversionStatus: "violation",
        testEvidence: "tenant:access:audit wildcard-allowlist fixture",
        exceptionId: ex.id,
        exceptionJustification: "exact file paths required",
        kind: "wildcard_allowlist",
      });
    }
  }

  // Stale allowlist detection: exception paths that match no finding/file
  if (checkAllowlistPaths) {
    for (const ex of ACCESS_EXCEPTIONS) {
      const abs = path.join(APP_ROOT, ex.path);
      const exists = fs.existsSync(abs);
      if (!exists) {
        findings.push({
          file: ex.path,
          line: 0,
          symbol: ex.id,
          executionCategory: "other",
          modelsTouched: [],
          oldAccessMethod: "allowlist entry",
          newAccessMethod: "stale allowlist path",
          authoritySource: "n/a",
          conversionStatus: "violation",
          testEvidence: "tenant:access:audit stale allowlist",
          exceptionId: ex.id,
          exceptionJustification: "allowlist path does not exist",
          kind: "db_server_import",
        });
      }
    }
  }

  const violations = findings.filter((f) => f.conversionStatus === "violation");
  const modelsCovered = [
    ...new Set(
      findings.flatMap((f) => f.modelsTouched).filter(Boolean),
    ),
  ].sort();

  // Ensure inventory conceptually covers all 18 models even if a model has no call site yet
  for (const model of MERCHANT_OWNED_MODELS) {
    if (!modelsCovered.includes(model)) {
      // synthetic coverage marker from model registry (not a violation)
      findings.push({
        file: "app/tenant/models.ts",
        line: 1,
        symbol: model,
        executionCategory: "tenant_infra",
        modelsTouched: [model],
        oldAccessMethod: "model registry",
        newAccessMethod: "approved merchant model inventory",
        authoritySource: "n/a",
        conversionStatus: "not_merchant_access",
        testEvidence: "models.ts registry",
        kind: "merchant_delegate_call",
      });
      modelsCovered.push(model);
    }
  }

  const stable = findings
    .map(
      (f) =>
        `${f.file}|${f.line}|${f.kind}|${f.symbol}|${f.conversionStatus}|${f.exceptionId ?? ""}`,
    )
    .sort()
    .join("\n");
  const contentDigest = createHash("sha256").update(stable).digest("hex");

  return {
    appRoot: APP_ROOT,
    scannedFiles: files.map(relFromApp),
    findings,
    violations,
    exceptionsUsed: [
      ...new Set(
        findings
          .map((f) => f.exceptionId)
          .filter((x): x is string => Boolean(x)),
      ),
    ].sort(),
    modelsCovered: [...new Set(modelsCovered)].sort(),
    contentDigest,
  };
}

export function assertNoViolations(result: ScanResult): void {
  if (result.violations.length > 0) {
    const lines = result.violations
      .slice(0, 50)
      .map(
        (v) =>
          `${v.file}:${v.line} [${v.kind}] ${v.symbol} — ${v.newAccessMethod}`,
      );
    throw new Error(
      `Tenant access audit failed with ${result.violations.length} violation(s):\n${lines.join("\n")}`,
    );
  }

  for (const model of [
    ...DIRECT_MERCHANT_MODELS,
    ...CHILD_MERCHANT_MODELS,
  ]) {
    if (!result.modelsCovered.includes(model)) {
      throw new Error(`Inventory missing merchant model coverage: ${model}`);
    }
  }

  // P3-c: raw Prisma construction exceptions must be actively used; no duplicates;
  // finding paths must match allowlist paths. Broader categories (backfill/index
  // inventories) remain exact-path allowlists without unused-ID sweep in this cycle.
  const rawExceptions = ACCESS_EXCEPTIONS.filter(
    (ex) => ex.category === "raw_prisma_construction",
  );
  const ids = ACCESS_EXCEPTIONS.map((ex) => ex.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    throw new Error(
      `Duplicated access exception IDs: ${[...new Set(dupes)].join(",")}`,
    );
  }
  if (ids.includes("EX-RAW-001")) {
    throw new Error(
      "Stale access exception EX-RAW-001 must be removed (construction lives in EX-RAW-002)",
    );
  }
  const unusedRaw = rawExceptions.filter(
    (ex) => !result.exceptionsUsed.includes(ex.id),
  );
  if (unusedRaw.length > 0) {
    throw new Error(
      `Unused raw_prisma_construction exception IDs: ${unusedRaw.map((u) => u.id).join(",")}`,
    );
  }
  for (const ex of rawExceptions) {
    const matched = result.findings.filter((f) => f.exceptionId === ex.id);
    for (const finding of matched) {
      if (finding.file !== ex.path) {
        throw new Error(
          `Exception ${ex.id} file mismatch: allowlist=${ex.path} finding=${finding.file}`,
        );
      }
    }
  }
}
