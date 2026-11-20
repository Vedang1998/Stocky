/**
 * Issue #80: merchant screens must not show developer or internal wording.
 * Reads every text node and string literal in the embedded app's routes,
 * components and services, and
 * refuses wording that only makes sense to the people building ProPo.
 * Server log lines are skipped.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isSource = (path: string) =>
  /\.tsx?$/.test(path) &&
  !/\.test\.tsx?$/.test(path) &&
  !path.includes("__tests__");

const FILES = [
  ...walk(join(ROOT, "app/routes")).filter((path) =>
    /[/\\]app[._][^/\\]*\.tsx$/.test(path),
  ),
  ...walk(join(ROOT, "app/components")).filter(isSource),
  ...walk(join(ROOT, "app/services")).filter(isSource),
  ...[
    "app/lib/po-display.ts",
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
    true,
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
        source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push({
        where: `${relative(ROOT, path)}:${line}`,
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
  [
    /\b(STOCKY|ALLOW_DEV|SHOPIFY|FEATURE)_[A-Z_]+/,
    "an environment variable",
  ],
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
