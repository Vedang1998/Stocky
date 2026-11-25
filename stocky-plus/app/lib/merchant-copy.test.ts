/**
 * Issue #80: merchant screens must not show developer or internal wording.
 * Reads every text node and string literal in the embedded app's routes,
 * components and services, plus the lib and billing modules that hold
 * merchant wording, and refuses wording that only makes sense to the people
 * building ProPo.
 * Server log lines are skipped.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  listProductionTypeScriptModulesRecursive as sourceFiles,
  toPosixRelative,
} from "./order-facts/admin-read/safety/production-modules";

const ROOT = join(__dirname, "..", "..");
const app = (dir: string) => sourceFiles(join(ROOT, "app", dir));

const FILES = [
  ...app("routes").filter((path) => /[/\\]app[._][^/\\]*\.tsx$/.test(path)),
  ...app("components"),
  ...app("services"),
  // Lib and billing also hold server and developer code (environment
  // variable names, status keys), so only their merchant-facing modules.
  ...[
    "app/lib/po-display.ts",
    "app/lib/route-error.ts",
    "app/lib/setup-guide.ts",
    "app/lib/sync-copy.ts",
    "app/lib/sync-status.ts",
    "app/billing/plan-display.ts",
  ].map((path) => join(ROOT, path)),
];

interface Text {
  where: string;
  text: string;
}

function textsOf(path: string): Text[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Text[] = [];
  const visit = (node: ts.Node) => {
    // Server log lines are read by operators, not merchants.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "console"
    ) {
      return;
    }
    let text: string | null = null;
    if (ts.isJsxText(node)) text = node.text;
    else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      text = node.text;
    } else if (ts.isTemplateExpression(node)) {
      text = [
        node.head.text,
        ...node.templateSpans.map((s) => s.literal.text),
      ].join(" ");
    }
    if (text && text.trim()) {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      found.push({
        where: `${toPosixRelative(ROOT, path)}:${line}`,
        text: text.replace(/\s+/g, " ").trim(),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Wording a merchant should never read, with the reason. */
const REFUSED: Array<[RegExp, string]> = [
  [/\bnpm (run|start)\b|\bnpx\b/, "a developer command"],
  [/\bfrom the dashboard\b/i, "there is no dashboard; the page is Home"],
  [/\bfree tier\b/i, "ProPo has no free tier"],
  [/\bhypothes[ie]s\b/i, "internal planning wording"],
  [/\bmarketing must\b/i, "an internal rule"],
  [/\b(STOCKY|ALLOW_DEV|SHOPIFY|FEATURE)_[A-Z_]+/, "an environment variable"],
  [/\bincremented\b/i, "developer wording"],
  [/\bcapability "/i, "an internal capability key"],
];

describe("merchant-facing copy (#80)", () => {
  const texts = FILES.flatMap(textsOf);

  it("reads the app's screens", () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(texts.some((t) => t.text.includes("Sync catalog"))).toBe(true);
  });

  it.each(REFUSED)("does not show %s", (pattern, reason) => {
    const hits = texts
      .filter((t) => pattern.test(t.text))
      .map((t) => `${t.where} (${reason}): ${t.text}`);
    expect(hits).toEqual([]);
  });
});
