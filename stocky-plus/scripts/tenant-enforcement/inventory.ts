#!/usr/bin/env tsx
/**
 * Mechanically generate PR3_DATABASE_ENFORCEMENT_INVENTORY.md
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  BOOTSTRAP_TABLES,
  COMPOSITE_FOREIGN_KEYS,
  COMPOSITE_PARENT_KEYS,
  CONTROL_TABLES,
  MERCHANT_TABLES,
  assertMerchantTableCount,
  compositeKeyName,
  immutabilityTriggerName,
  rlsPolicyName,
  shopIdFkToShopName,
  shopIdNotNullCheckName,
} from "./manifest";

assertMerchantTableCount();

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const STDOUT_ONLY = process.argv.includes("--stdout");
const OUT = STDOUT_ONLY
  ? null
  : path.join(
      APP_ROOT,
      "docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md",
    );

const digest = createHash("sha256")
  .update(
    JSON.stringify({
      merchant: MERCHANT_TABLES,
      bootstrap: BOOTSTRAP_TABLES,
      control: CONTROL_TABLES,
      keys: COMPOSITE_PARENT_KEYS,
      fks: COMPOSITE_FOREIGN_KEYS,
    }),
  )
  .digest("hex")
  .slice(0, 16);

function merchantRows(): string {
  return MERCHANT_TABLES.map((t) => {
    const shopIdNullability = t.shopIdNullableInPrisma
      ? "nullable in Prisma (DB NOT NULL after enforcement)"
      : "non-null in Prisma (no expand/backfill)";
    return `| ${t.prismaModel} | \`${t.sqlTable}\` | ${shopIdNullability} | ${t.legacyShopField ? "`shop`" : "—"} | ${t.parentRelationships.join(", ") || "—"} | ${t.childRelationships.join(", ") || "—"} | ${t.crossDomainRelationships.join(", ") || "—"} | ${t.existingShopIdIdUnique ? `\`${compositeKeyName(t.sqlTable)}\` (PR1)` : "compatibility shopId idx only"} | \`${compositeKeyName(t.sqlTable)}\` | ${COMPOSITE_FOREIGN_KEYS.filter((f) => f.childTable === t.sqlTable)
      .map((f) => `\`${f.name}\``)
      .join(", ") || "—"} | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | \`${immutabilityTriggerName(t.sqlTable)}\` | no | ${t.expectedRuntimePrivileges.join("/")} | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |`;
  }).join("\n");
}

const md = `# PR 3 — Database Enforcement Inventory

**Phase:** 1
**Work unit:** PR 3 — Database enforcement
**Branch:** \`phase-1/tenant-enforcement\`
**Generator:** \`scripts/tenant-enforcement/inventory.ts\` (deterministic)
**Content digest:** \`${digest}\`
**Merchant-owned tables:** ${MERCHANT_TABLES.length}
**Bootstrap tables:** ${BOOTSTRAP_TABLES.length}
**Control/maintenance tables:** ${CONTROL_TABLES.length}
**Composite parent keys:** ${COMPOSITE_PARENT_KEYS.length}
**Composite foreign keys:** ${COMPOSITE_FOREIGN_KEYS.length}

> This file is mechanically generated. Do not edit by hand.
> Regenerate with \`npm run tenant:enforcement:inventory\`.
> CI verifies freshness via \`npm run tenant:enforcement:inventory:check\`.

## Classification rules

| Class | RLS | Runtime DML | Notes |
|---|---|---|---|
| merchant_domain | ENABLE + FORCE | SELECT/INSERT/UPDATE/DELETE under tenant context | Default-deny without context |
| bootstrap | No merchant RLS | Narrow Session/Shop grants | Must not become general bypass |
| control_maintenance | No | None (migration/maintenance only) | Backfill + ownership quarantine |

## Bootstrap tables

| Prisma model | SQL table | Legacy shop | Bootstrap exemption | Expected runtime privileges | Notes |
|---|---|---|---|---|---|
${BOOTSTRAP_TABLES.map(
  (t) =>
    `| ${t.prismaModel} | \`${t.sqlTable}\` | ${t.legacyShopField ? "yes" : "no"} | yes | ${t.expectedRuntimePrivileges.join("/") || "none"} | ${t.notes} |`,
).join("\n")}

## Control / maintenance tables

| Prisma model | SQL table | Runtime privileges | Notes |
|---|---|---|---|
${CONTROL_TABLES.map(
  (t) =>
    `| ${t.prismaModel} | \`${t.sqlTable}\` | none | ${t.notes} |`,
).join("\n")}

## Merchant-owned tables

| Prisma model | SQL table | shopId nullability | Legacy shop | Parents | Children | Cross-domain | Existing (shopId,id) | Required composite key | Required composite FKs | Ownership diagnostics | RLS | Immutability trigger | Bootstrap exemption | Runtime privileges | Enforcement step | Rollback/forward recovery | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${merchantRows()}

## Composite parent keys (\`shopId\`, \`id\`)

| Name | Table | Columns |
|---|---|---|
${COMPOSITE_PARENT_KEYS.map((k) => `| \`${k.name}\` | \`${k.table}\` | (${k.columns.join(", ")}) |`).join("\n")}

## Composite tenant foreign keys

| Name | Child | Columns | Parent | Parent columns | ON DELETE | Purpose |
|---|---|---|---|---|---|---|
${COMPOSITE_FOREIGN_KEYS.map(
  (f) =>
    `| \`${f.name}\` | \`${f.childTable}\` | (${f.childColumns.join(", ")}) | \`${f.parentTable}\` | (${f.parentColumns.join(", ")}) | ${f.onDelete} | ${f.purpose} |`,
).join("\n")}

## Per-table enforcement artifacts

| Table | NOT NULL check | Shop FK | Composite key | RLS policies | Immutability trigger |
|---|---|---|---|---|---|
${MERCHANT_TABLES.map(
  (t) =>
    `| \`${t.sqlTable}\` | \`${shopIdNotNullCheckName(t.sqlTable)}\` | \`${shopIdFkToShopName(t.sqlTable)}\` | \`${compositeKeyName(t.sqlTable)}\` | ${["select", "insert", "update", "delete"].map((c) => `\`${rlsPolicyName(t.sqlTable, c as "select")}\``).join(", ")} | \`${immutabilityTriggerName(t.sqlTable)}\` |`,
).join("\n")}

## Schema verification note

Merchant coverage was compared to \`app/tenant/models.ts\` and \`prisma/schema.prisma\` on the PR 3 starting main. Count = **${MERCHANT_TABLES.length}**. Session, Shop, and the four tenant-backfill control tables are classified above and are **not** merchant-domain RLS targets.
`;

if (OUT) {
  fs.writeFileSync(OUT, md, "utf8");
  console.log(
    JSON.stringify({
      event: "tenant_enforcement_inventory_written",
      path: "docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md",
      digest,
      merchantTables: MERCHANT_TABLES.length,
    }),
  );
} else {
  process.stdout.write(md);
}
