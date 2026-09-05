/**
 * Production-module safety scan for the canonical fact/read boundary.
 *
 * GraphQL documents are extracted from TypeScript via the compiler API, then
 * inspected with graphql-js AST (R-138 / R-110 precedent). Nested production
 * modules are enumerated recursively (R-163).
 *
 * Import denial is rule-derived (deny-by-default): `@shopify/*` packages and
 * Shopify write-capable application service areas are forbidden unless an
 * exact reviewed exception exists. This is not a two-name substring list.
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parse } from "graphql";
import {
  assertCanonicalCatalogDocumentForModule,
  CanonicalReadForbiddenFieldError,
  CanonicalReadGraphQLSyntaxError,
  CanonicalReadMutationRejectedError,
} from "./graphql-ast";
import {
  listProductionTypeScriptModulesRecursive,
  toPosixRelative,
} from "./production-modules";

export type CatalogFactSafetyFinding = {
  file: string;
  kind:
    | "mutation_rejected"
    | "forbidden_field"
    | "forbidden_import"
    | "unreviewable_graphql"
    | "syntax";
  detail: string;
};

export type CatalogFactSafetyScanResult = {
  files: string[];
  relativeFiles: string[];
  graphqlDocumentCount: number;
  findings: CatalogFactSafetyFinding[];
};

export type CanonicalReadImportException = {
  id: string;
  specifier: string;
  reason: string;
};

export type CatalogFactScanPolicy = "library" | "worker";

/**
 * Exact reviewed exceptions to the deny-by-default import boundary.
 * Empty: this lane has no approved `@shopify/*` or application-service imports.
 */
export const CANONICAL_READ_IMPORT_EXCEPTIONS: readonly CanonicalReadImportException[] =
  [];

const CANONICAL_READ_IMPORT_EXCEPTION_SPECIFIERS = new Set(
  CANONICAL_READ_IMPORT_EXCEPTIONS.map((entry) => entry.specifier),
);

function isWorkerShopifyServerSpecifier(
  specifier: string,
  fromFile: string,
): boolean {
  const normalized = specifier.replace(/\\/g, "/");
  const resolved = specifier.startsWith(".")
    ? path
        .normalize(path.join(path.dirname(fromFile), specifier))
        .replace(/\\/g, "/")
    : normalized;
  return (
    normalized === "~/shopify.server" ||
    normalized === "app/shopify.server" ||
    /\/app\/shopify\.server$/.test(resolved)
  );
}

function stripLeadingGraphQLCommentAndTagLines(text: string): string {
  const lines = text.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (trimmed === "") {
      index += 1;
      continue;
    }
    if (trimmed.startsWith("#")) {
      index += 1;
      continue;
    }
    break;
  }
  return lines.slice(index).join("\n").trim();
}

export function looksLikeGraphQLDocument(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const normalized = stripLeadingGraphQLCommentAndTagLines(trimmed);
  if (!normalized) return false;
  if (/^(query|mutation|subscription|fragment)\b/.test(normalized)) {
    return normalized.includes("{");
  }
  if (normalized.startsWith("{")) {
    return /\{[\s\S]*\S/.test(normalized);
  }
  return false;
}

export type ExtractedGraphQLLiterals = {
  documents: string[];
  unreviewable: Array<{ preview: string; detail: string }>;
  syntaxFailures: Array<{ preview: string; detail: string }>;
};

function templateExpressionStaticText(node: ts.TemplateExpression): string {
  return (
    node.head.text +
    node.templateSpans.map((span) => span.literal.text).join("")
  );
}

export function extractGraphQLDocumentsFromTypeScript(
  source: string,
  fileName = "module.ts",
): ExtractedGraphQLLiterals {
  const scriptKind = fileName.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const documents: string[] = [];
  const unreviewable: ExtractedGraphQLLiterals["unreviewable"] = [];
  const syntaxFailures: ExtractedGraphQLLiterals["syntaxFailures"] = [];

  function considerStatic(text: string): void {
    if (!looksLikeGraphQLDocument(text)) return;
    try {
      parse(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      syntaxFailures.push({
        preview: text.trim().slice(0, 160),
        detail: `GraphQL-shaped literal failed to parse: ${detail}`,
      });
      return;
    }
    documents.push(text);
  }

  function visit(node: ts.Node): void {
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
      considerStatic(node.text);
    } else if (ts.isTemplateExpression(node)) {
      const staticText = templateExpressionStaticText(node);
      if (looksLikeGraphQLDocument(staticText)) {
        unreviewable.push({
          preview: staticText.trim().slice(0, 160),
          detail:
            "Interpolated GraphQL document is not statically reviewable; fail closed",
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return { documents, unreviewable, syntaxFailures };
}

export function isForbiddenCanonicalReadImport(
  specifier: string,
  fromFile: string,
  policy: CatalogFactScanPolicy = "library",
): boolean {
  if (CANONICAL_READ_IMPORT_EXCEPTION_SPECIFIERS.has(specifier)) {
    return false;
  }
  const normalized = specifier.replace(/\\/g, "/");
  if (normalized.startsWith("@shopify/")) return true;
  const resolved = specifier.startsWith(".")
    ? path
        .normalize(path.join(path.dirname(fromFile), specifier))
        .replace(/\\/g, "/")
    : normalized;
  const isWorkerShopifyServer =
    policy === "worker" && isWorkerShopifyServerSpecifier(specifier, fromFile);
  if (isWorkerShopifyServer) return false;
  if (
    normalized.includes("shopify-sync.server") ||
    normalized.includes("shopify-gql.server") ||
    /(^|[./])shopify\.server$/.test(normalized)
  ) {
    return true;
  }
  if (
    normalized.includes("/services/") ||
    normalized.startsWith("app/services/") ||
    normalized.startsWith("~/services/") ||
    normalized.startsWith("services/")
  ) {
    return true;
  }
  if (specifier.startsWith(".")) {
    if (resolved.includes("/services/")) return true;
  }
  return false;
}

function staticModuleSpecifier(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function forbiddenImportSpecifiers(
  source: string,
  fileName: string,
  policy: CatalogFactScanPolicy,
): string[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specs: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const spec = staticModuleSpecifier(node.moduleSpecifier);
      if (
        spec !== null &&
        policy === "worker" &&
        isWorkerShopifyServerSpecifier(spec, fileName)
      ) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const valid =
          clause?.name == null &&
          named != null &&
          ts.isNamedImports(named) &&
          named.elements.length === 1 &&
          (named.elements[0]?.propertyName?.text ??
            named.elements[0]?.name.text) === "unauthenticated" &&
          named.elements[0]?.name.text === "unauthenticated";
        if (!valid) {
          specs.push(`${spec} (worker may import only unauthenticated)`);
        }
      } else if (
        spec !== null &&
        isForbiddenCanonicalReadImport(spec, fileName, policy)
      ) {
        specs.push(spec);
      }
    } else if (ts.isExportDeclaration(node)) {
      const spec = staticModuleSpecifier(node.moduleSpecifier);
      if (
        spec !== null &&
        (isWorkerShopifyServerSpecifier(spec, fileName) ||
          isForbiddenCanonicalReadImport(spec, fileName, policy))
      ) {
        specs.push(spec);
      }
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) {
        const spec = staticModuleSpecifier(node.arguments[0]);
        if (
          spec !== null &&
          (isWorkerShopifyServerSpecifier(spec, fileName) ||
            isForbiddenCanonicalReadImport(spec, fileName, policy))
        ) {
          specs.push(spec);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return specs;
}

export function scanCatalogFactsProductionModules(
  rootDir: string,
  options: { policy?: CatalogFactScanPolicy } = {},
): CatalogFactSafetyScanResult {
  const policy = options.policy ?? "library";
  const files = listProductionTypeScriptModulesRecursive(rootDir);
  const findings: CatalogFactSafetyFinding[] = [];
  let graphqlDocumentCount = 0;

  for (const file of files) {
    const relative = toPosixRelative(rootDir, file);
    const source = readFileSync(file, "utf8");
    const extracted = extractGraphQLDocumentsFromTypeScript(source, relative);
    graphqlDocumentCount += extracted.documents.length;

    for (const item of extracted.unreviewable) {
      findings.push({
        file: relative,
        kind: "unreviewable_graphql",
        detail: `${item.detail}: ${item.preview}`,
      });
    }

    for (const item of extracted.syntaxFailures) {
      findings.push({
        file: relative,
        kind: "syntax",
        detail: `${item.detail}: ${item.preview}`,
      });
    }

    for (const document of extracted.documents) {
      try {
        assertCanonicalCatalogDocumentForModule(document, relative);
      } catch (error) {
        if (error instanceof CanonicalReadMutationRejectedError) {
          findings.push({
            file: relative,
            kind: "mutation_rejected",
            detail: error.message,
          });
          continue;
        }
        if (error instanceof CanonicalReadForbiddenFieldError) {
          findings.push({
            file: relative,
            kind: "forbidden_field",
            detail: error.message,
          });
          continue;
        }
        if (error instanceof CanonicalReadGraphQLSyntaxError) {
          findings.push({
            file: relative,
            kind: "syntax",
            detail: error.message,
          });
        }
      }
    }

    for (const spec of forbiddenImportSpecifiers(source, file, policy)) {
      findings.push({
        file: relative,
        kind: "forbidden_import",
        detail: `Canonical read boundary must not import ${spec}`,
      });
    }
  }

  return {
    files,
    relativeFiles: files.map((file) => toPosixRelative(rootDir, file)),
    graphqlDocumentCount,
    findings,
  };
}

export function assertCatalogFactsReadBoundarySafe(rootDir: string): void {
  const result = scanCatalogFactsProductionModules(rootDir);
  if (result.findings.length === 0) return;
  const details = result.findings
    .map((finding) => `${finding.file}: ${finding.kind}: ${finding.detail}`)
    .join("\n");
  throw new Error(
    `Canonical catalog-facts read boundary safety scan failed:\n${details}`,
  );
}

export function assertCatalogFactsWorkerBoundarySafe(rootDir: string): void {
  const result = scanCatalogFactsProductionModules(rootDir, {
    policy: "worker",
  });
  if (result.findings.length === 0) return;
  const details = result.findings
    .map((finding) => `${finding.file}: ${finding.kind}: ${finding.detail}`)
    .join("\n");
  throw new Error(
    `Canonical catalog-facts worker safety scan failed:\n${details}`,
  );
}
