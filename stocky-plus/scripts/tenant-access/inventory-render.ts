/**
 * Markdown for PR2_TENANT_ACCESS_INVENTORY.md.
 *
 * The file is committed and CI fails when it is stale, so it has to change
 * only when tenant access changes. Line numbers, totals and the content
 * digest moved with every unrelated edit and made any two open pull requests
 * conflict in it. They are left out, and identical access sites in a file are
 * recorded as one row with a site count. `npm run tenant:access:audit` prints
 * the totals and the digest for the current tree.
 */
import { ACCESS_EXCEPTIONS } from "./allowlist";
import type { AccessFinding, ScanResult } from "./scan";
import { MERCHANT_OWNED_MODELS } from "../../app/tenant/models";

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

function cell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

/** Every column of an inventory row except the site count. */
function rowCells(f: AccessFinding): string[] {
  return [
    `\`${f.file}\``,
    `\`${cell(f.symbol)}\``,
    f.executionCategory,
    f.modelsTouched.join(", ") || "—",
    cell(f.oldAccessMethod),
    cell(f.newAccessMethod),
    cell(f.authoritySource),
    statusLabel(f.conversionStatus),
    cell(f.testEvidence),
    f.exceptionId ?? "—",
    cell(f.exceptionJustification ?? "—"),
  ];
}

export type InventoryRow = { cells: string[]; sites: number };

/**
 * One row per distinct access-site description in a file; `sites` counts how
 * many places in that file match it. Rows are ordered by their own text,
 * never by line number, so moving code inside a file does not reorder them.
 */
export function inventoryRows(findings: readonly AccessFinding[]): InventoryRow[] {
  const byText = new Map<string, InventoryRow>();
  for (const f of findings) {
    if (f.kind === "type_only_prisma_import") continue;
    const cells = rowCells(f);
    const key = cells.join("\u0000");
    const row = byText.get(key);
    if (row) row.sites += 1;
    else byText.set(key, { cells, sites: 1 });
  }
  return [...byText.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => row);
}

export function renderTenantAccessInventory(result: ScanResult): string {
  const categoriesInUse = new Set<string>();
  const modelsWithFindings = new Set<string>();
  for (const f of result.findings) {
    categoriesInUse.add(f.executionCategory);
    for (const m of f.modelsTouched) modelsWithFindings.add(m);
  }
  const rows = inventoryRows(result.findings);

  return `# PR 2 — Tenant Access Inventory

**Phase:** 1
**Work unit:** PR 2 — Tenant-bound access conversion
**Branch:** \`phase-1/tenant-access\`
**Generator:** \`scripts/tenant-access/inventory.ts\` (deterministic scanner)
**Violations:** ${result.violations.length}

> This file is mechanically generated. Do not edit by hand.
> Regenerate with \`npm run tenant:access:inventory\`.
> CI verifies freshness via \`npm run tenant:access:inventory:check\`.
> Line numbers, totals and the content digest are not recorded here because
> they change with unrelated edits; \`npm run tenant:access:audit\` prints them.

## Merchant model coverage

All ${MERCHANT_OWNED_MODELS.length} approved merchant-owned models must be covered below.

| Model | Covered |
|---|---|
${MERCHANT_OWNED_MODELS.map(
  (m) => `| ${m} | ${modelsWithFindings.has(m) ? "yes" : "NO"} |`,
).join("\n")}

## Execution categories in use

${[...categoriesInUse]
  .sort()
  .map((category) => `- ${category}`)
  .join("\n")}

## Approved exceptions

| ID | Path | Category | Production/runtime | Owner | Removal/review condition |
|---|---|---|---|---|---|
${ACCESS_EXCEPTIONS.map(
  (e) =>
    `| ${e.id} | \`${e.path}\` | ${e.category} | ${e.productionRuntime} | ${e.owner} | ${e.expirationPhaseOrRemovalCondition} |`,
).join("\n")}

## Access path inventory

| File | Symbol | Sites | Execution category | Models touched | Old access method | New access method | Authority source | Conversion status | Test evidence | Exception ID | Exception justification |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows
  .map(({ cells, sites }) => {
    const [file, symbol, ...rest] = cells;
    return `| ${[file, symbol, String(sites), ...rest].join(" | ")} |`;
  })
  .join("\n")}

## Scanner metadata

\`\`\`json
${JSON.stringify(
  {
    violations: result.violations.length,
    exceptionsUsed: result.exceptionsUsed,
    modelsCovered: result.modelsCovered,
  },
  null,
  2,
)}
\`\`\`
`;
}
