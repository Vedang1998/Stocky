#!/usr/bin/env tsx
/**
 * Mechanically generate PR2_TENANT_ACCESS_INVENTORY.md from the scanner.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACCESS_EXCEPTIONS } from "./allowlist";
import { scanRepository, type AccessFinding } from "./scan";
import { MERCHANT_OWNED_MODELS } from "../../app/tenant/models";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const STDOUT_ONLY = process.argv.includes("--stdout");
const OUT = STDOUT_ONLY
  ? null
  : path.join(
      APP_ROOT,
      "docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md",
    );

const result = scanRepository();

function statusLabel(s: AccessFinding["conversionStatus"]): string {
  switch (s) {
    case "converted":
      return "converted";
    case "approved_exception":
      return "approved exception";
    case "not_merchant_access":
      return "not merchant access";
    case "violation":
      return "VIOLATION";
  }
}

const byCategory: Record<string, number> = {};
const byModel: Record<string, number> = {};
for (const f of result.findings) {
  byCategory[f.executionCategory] = (byCategory[f.executionCategory] ?? 0) + 1;
  for (const m of f.modelsTouched) {
    byModel[m] = (byModel[m] ?? 0) + 1;
  }
}

const converted = result.findings.filter(
  (f) => f.conversionStatus === "converted",
).length;
const exceptions = result.findings.filter(
  (f) => f.conversionStatus === "approved_exception",
).length;

const rows = result.findings
  .filter((f) => f.kind !== "type_only_prisma_import")
  .sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );

const md = `# PR 2 — Tenant Access Inventory

**Phase:** 1
**Work unit:** PR 2 — Tenant-bound access conversion
**Branch:** \`phase-1/tenant-access\`
**Generator:** \`scripts/tenant-access/inventory.ts\` (deterministic scanner)
**Content digest:** \`${result.contentDigest}\`
**Scanned files:** ${result.scannedFiles.length}
**Findings:** ${rows.length}
**Converted paths:** ${converted}
**Approved exception findings:** ${exceptions}
**Violations:** ${result.violations.length}

> This file is mechanically generated. Do not edit by hand.
> Regenerate with \`npm run tenant:access:inventory\`.
> CI verifies freshness via \`npm run tenant:access:inventory:check\`.

## Merchant model coverage

All 19 approved merchant-owned models must appear below.

| Model | Finding count |
|---|---|
${MERCHANT_OWNED_MODELS.map(
  (m) => `| ${m} | ${byModel[m] ?? 0} |`,
).join("\n")}

## Counts by execution category

| Category | Count |
|---|---|
${Object.entries(byCategory)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `| ${k} | ${v} |`)
  .join("\n")}

## Approved exceptions

| ID | Path | Category | Production/runtime | Owner | Removal/review condition |
|---|---|---|---|---|---|
${ACCESS_EXCEPTIONS.map(
  (e) =>
    `| ${e.id} | \`${e.path}\` | ${e.category} | ${e.productionRuntime} | ${e.owner} | ${e.expirationPhaseOrRemovalCondition} |`,
).join("\n")}

## Access path inventory

| File | Line or symbol | Execution category | Models touched | Old access method | New access method | Authority source | Conversion status | Test evidence | Exception ID | Exception justification |
|---|---|---|---|---|---|---|---|---|---|---|
${rows
  .map((f) => {
    const cells = [
      `\`${f.file}\``,
      `${f.line} / \`${f.symbol.replace(/\|/g, "\\|")}\``,
      f.executionCategory,
      f.modelsTouched.join(", ") || "—",
      f.oldAccessMethod.replace(/\|/g, "\\|"),
      f.newAccessMethod.replace(/\|/g, "\\|"),
      f.authoritySource.replace(/\|/g, "\\|"),
      statusLabel(f.conversionStatus),
      f.testEvidence.replace(/\|/g, "\\|"),
      f.exceptionId ?? "—",
      (f.exceptionJustification ?? "—").replace(/\|/g, "\\|"),
    ];
    return `| ${cells.join(" | ")} |`;
  })
  .join("\n")}

## Scanner metadata

\`\`\`json
${JSON.stringify(
  {
    scannedFiles: result.scannedFiles.length,
    findings: result.findings.length,
    violations: result.violations.length,
    exceptionsUsed: result.exceptionsUsed,
    modelsCovered: result.modelsCovered,
    contentDigest: result.contentDigest,
  },
  null,
  2,
)}
\`\`\`
`;

if (OUT) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(
    JSON.stringify({
      event: "tenant_access_inventory_written",
      path: path.relative(APP_ROOT, OUT),
      findings: rows.length,
      violations: result.violations.length,
    }),
  );
  if (result.violations.length > 0) {
    console.error(
      `Refusing to treat inventory as clean: ${result.violations.length} violation(s)`,
    );
    process.exit(1);
  }
} else {
  process.stdout.write(md);
}
