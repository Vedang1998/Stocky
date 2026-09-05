import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse, visit } from "graphql";
import { extractGraphQLDocumentsFromTypeScript } from "../app/lib/catalog-facts/admin-read/safety/scan";

export type F3SafetyFinding = {
  file: string;
  rule:
    | "unknown_available_to_zero"
    | "deprecated_current_bulk_operation"
    | "full_body_text_ingestion"
    | "session_advisory_lock"
    | "blind_on_conflict_update"
    | "canonical_physical_delete";
  detail: string;
};

function productionFiles(root: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const absolute = path.join(root, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (entry === "types") continue;
      output.push(...productionFiles(absolute));
    } else if (
      /\.(?:ts|tsx)$/.test(entry) &&
      !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry) &&
      !absolute.includes(`${path.sep}__tests__${path.sep}`)
    ) {
      output.push(absolute);
    }
  }
  return output;
}

function sourceFindings(source: string, file: string): F3SafetyFinding[] {
  const findings: F3SafetyFinding[] = [];
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const add = (rule: F3SafetyFinding["rule"], detail: string): void => {
    findings.push({ file, rule, detail });
  };
  const inspectText = (text: string): void => {
    if (/\bpg_(?:try_)?advisory_lock(?:_shared)?\s*\(/.test(text)) {
      add("session_advisory_lock", "Session-scoped advisory lock call");
    }
    if (/\bON\s+CONFLICT\b[\s\S]*\bDO\s+UPDATE\b/i.test(text)) {
      add("blind_on_conflict_update", "Blind ON CONFLICT DO UPDATE");
    }
    if (
      /\bDELETE\s+FROM\s+"?Shopify(?:Product|Variant|InventoryItem|Location|InventoryLevel)Fact"?/i.test(
        text,
      )
    ) {
      add("canonical_physical_delete", "Physical canonical fact DELETE");
    }
  };

  function walk(node: ts.Node): void {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      ts.isNumericLiteral(node.right) &&
      node.right.text === "0" &&
      /(?:^|[.?\]])available$/.test(node.left.getText(sf))
    ) {
      add(
        "unknown_available_to_zero",
        "Authoritative availability is coerced through ?? 0",
      );
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "text" &&
      node.arguments.length === 0
    ) {
      add(
        "full_body_text_ingestion",
        "Full-body .text() ingestion is forbidden",
      );
    }
    if (
      ts.isStringLiteralLike(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      inspectText(node.text);
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);

  const extracted = extractGraphQLDocumentsFromTypeScript(source, file);
  for (const document of extracted.documents) {
    const ast = parse(document);
    visit(ast, {
      Field(node) {
        if (node.name.value === "currentBulkOperation") {
          add(
            "deprecated_current_bulk_operation",
            "GraphQL currentBulkOperation is forbidden",
          );
        }
      },
    });
  }
  return findings;
}

export function scanF3ApplicationSafety(appRoot: string): {
  filesScanned: number;
  findings: F3SafetyFinding[];
} {
  const files = productionFiles(appRoot);
  return {
    filesScanned: files.length,
    findings: files.flatMap((file) =>
      sourceFindings(readFileSync(file, "utf8"), file),
    ),
  };
}

const invoked = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (invoked) {
  const appRoot = path.resolve(process.cwd(), "app");
  const result = scanF3ApplicationSafety(appRoot);
  console.log(JSON.stringify(result, null, 2));
  if (result.findings.length > 0) process.exitCode = 1;
}
