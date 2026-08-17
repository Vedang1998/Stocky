/**
 * Production-module safety scan for the canonical fact/read boundary.
 *
 * GraphQL documents are extracted from TypeScript via the compiler API, then
 * inspected with graphql-js AST (R-138 / R-110 precedent). Nested production
 * modules are enumerated recursively (R-163).
 */

import { readFileSync } from "node:fs";
import ts from "typescript";
import { parse } from "graphql";
import {
  assertCanonicalReadDocument,
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
    | "shopify_sync_import"
    | "syntax";
  detail: string;
};

export type CatalogFactSafetyScanResult = {
  files: string[];
  relativeFiles: string[];
  graphqlDocumentCount: number;
  findings: CatalogFactSafetyFinding[];
};

function looksLikeGraphQLDocument(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes("#graphql")) return true;
  if (/^(query|mutation|subscription|fragment)\b/.test(trimmed)) return true;
  return trimmed.startsWith("{");
}

export function extractGraphQLDocumentsFromTypeScript(
  source: string,
  fileName = "module.ts",
): string[] {
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

  function consider(text: string): void {
    if (!looksLikeGraphQLDocument(text)) return;
    try {
      parse(text);
    } catch {
      return;
    }
    documents.push(text);
  }

  function visit(node: ts.Node): void {
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
      consider(node.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return documents;
}

function shopifySyncImportSpecifiers(source: string, fileName: string): string[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specs: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const spec = node.moduleSpecifier.text;
      if (
        spec.includes("shopify-sync.server") ||
        spec.includes("shopify-gql.server")
      ) {
        specs.push(spec);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return specs;
}

export function scanCatalogFactsProductionModules(
  rootDir: string,
): CatalogFactSafetyScanResult {
  const files = listProductionTypeScriptModulesRecursive(rootDir);
  const findings: CatalogFactSafetyFinding[] = [];
  let graphqlDocumentCount = 0;

  for (const file of files) {
    const relative = toPosixRelative(rootDir, file);
    const source = readFileSync(file, "utf8");
    const documents = extractGraphQLDocumentsFromTypeScript(source, relative);
    graphqlDocumentCount += documents.length;

    for (const document of documents) {
      try {
        assertCanonicalReadDocument(document);
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

    for (const spec of shopifySyncImportSpecifiers(source, relative)) {
      findings.push({
        file: relative,
        kind: "shopify_sync_import",
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
