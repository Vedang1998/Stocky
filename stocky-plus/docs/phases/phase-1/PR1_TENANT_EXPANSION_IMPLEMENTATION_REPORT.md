# Phase 1 Implementation Report — PR 1 Tenant Expansion and Backfill

**Status:** IN REVIEW
**Implementer:** Cursor
**Independent reviewer:** Claude Code (required next)

## Identity

| Item | Value |
|---|---|
| Base main SHA | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Branch | `phase-1/tenant-expand` |
| Starting SHA | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Primary implementation commit | `854a3d5e12d7d61d420241f992fe08369bd0223b` |
| Status/evidence commit | `0d836e1b71b0fd213781d08228b13c8df8e9c1ad` |
| Claude-reviewed PR head | `7aabb095806716697bfea2783379351b15e1cda2` |
| Claude-reviewed-head CI | run `30578683952` / job `90993206934` / success |
| Claude verdict | `NOT READY` — see `PR1_TENANT_EXPANSION_REVIEW_REPORT.md` |
| Correction commits | See `PR1_TENANT_EXPANSION_CORRECTION_IMPLEMENTATION_REPORT.md` |
| Pull request | [#11](https://github.com/Vedang1998/Stocky/pull/11) (draft) |
| Environment | Local disposable PostgreSQL 16; Node 22; npm 11.5.2; GitHub Actions PostgreSQL 16 |

> Historical note (F-PR1-12): This report originally named intermediate SHAs as “final” before the report-finalization commit existed. The Claude-reviewed head and exact-head CI above are authoritative for the pre-correction review. Corrected-head evidence lives in the correction implementation report.


## Summary

PR 1 adds the additive tenant-ownership expansion foundation only: canonical `Shop`, nullable `shopId` on every approved merchant-owned model, backfill control records, compatibility indexes, resumable/idempotent/batched backfill tooling with quarantine diagnostics, real PostgreSQL migration tests, and runbooks. Legacy `shop` columns and runtime behavior are preserved. No RLS, no runtime access conversion, no non-null enforcement, no composite child FKs, no inventory writes.

**PR 1 does not resolve F-016 / R-022.**
**Q-011 remains open.**
**R-028 and R-029 remain open** pending independent review, merge, and later zero-unresolved enforcement evidence.
**PR 2 and PR 3 have not started.**

## Requirements completed

| Brief / prompt requirement | Status |
|---|---|
| Canonical Shop | Done |
| Nullable shopId on 18 merchant-owned models | Done |
| Preserve legacy shop + runtime behavior | Done |
| Resumable idempotent batched backfill | Done |
| Durable run/checkpoint/issue records | Done |
| Consistency diagnostics + reason codes | Done |
| Compatibility indexes | Done (see CONCURRENTLY deviation) |
| Real disposable PostgreSQL tests | Done |
| No enforcement / no RLS / no runtime conversion | Done |
| Inventory-write flags default OFF | Verified unchanged |
| Docs: inventory, runbook, implementation report | Done |

## Exact Shop schema

```prisma
model Shop {
  id              String   @id @default(cuid())
  myshopifyDomain String   @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## Models receiving nullable `shopId`

Supplier, SupplierSkuMapping, VolumePriceTier, LeadTimeSnapshot, PurchaseOrder, POLineItem, ShopifyVariantCache, InventorySnapshot, VariantAbcClass, ForecastOverride, SalesDailyAggregate, ShopSettings, TransferOrder, TransferLineItem, Stocktake, StocktakeLineItem, BomComponent, LowStockAlert.

## Intentionally excluded

| Table | Why |
|---|---|
| Session | Shopify Prisma session-storage adapter compatibility; bootstrap exception; diagnostics may read `Session.shop` only |
| Shop / backfill control tables | Infrastructure, not backfilled merchant children |

## Normalization

`phase1-shop-domain-v1` in `app/lib/shop-domain.ts` — unit tested.

## Migration structure

1. `20260730160000_tenant_expansion`
2. `20260730160100_tenant_compatibility_indexes`

No `shopId → Shop.id` FK (safer default; quarantine must remain possible). No composite child FKs. No NOT NULL. No RLS.

## Index structure

* `shopId` btree on every merchant-owned model
* Unique `(shopId, id)` on Supplier, PurchaseOrder, TransferOrder, Stocktake
* Child `(shopId, parentId)` indexes as specified in the prompt

## Backfill order / mapping

Direct owners first (legacy `shop` → Shop), then children from verified parents. See inventory doc.

## Issue reason codes

INVALID_SHOP_DOMAIN, CONFLICTING_NORMALIZED_DOMAIN, EXISTING_SHOP_ID_MISMATCH, MISSING_PARENT, PARENT_SHOP_UNRESOLVED, PARENT_CHILD_SHOP_MISMATCH, PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH, LEAD_TIME_PURCHASE_ORDER_MISSING, LEAD_TIME_PURCHASE_ORDER_SHOP_MISMATCH, DUPLICATE_SHOP_SETTINGS_TENANT.

## Resumability / concurrency / transactions / checksums

* Checkpoints per `(runId, tableName)` with `lastProcessedId`
* Batches transactional; checkpoint written with batch result
* Apply uses `pg_try_advisory_lock(0x53544b31)`
* SHA-256 over canonical sorted `{id, shopId}` JSON

## Commands executed

### Baseline (pre-implementation, base SHA `8ccc8d29…`)

| Command | Exit | Status | Notes |
|---|---:|---|---|
| `npm ci` | 0 | passed | stocky-plus |
| `npx prisma generate` | 0 | passed | against init schema |
| `npx prisma validate` | 0 | passed | |
| `npx prisma migrate deploy` | 0 | passed | disposable `stocky_plus_baseline`; init only |
| `npm run lint` | 0 | passed | |
| `npm run typecheck` | 0 | passed | |
| `npm test` | 0 | passed | 46 tests |
| `npm run build` | 0 | passed | |
| `npm run graphql-codegen` | 0 | passed | |

### Post-implementation (disposable `stocky_plus_migrations`)

| Command | Exit | Status | Notes |
|---|---:|---|---|
| `npx prisma generate` | 0 | passed | |
| `npx prisma validate` | 0 | passed | |
| `npx prisma migrate deploy` | 0 | passed | empty DB → all 3 migrations |
| `npm run test:migrations` | 0 | passed | 4 tests |
| `CREATE INDEX CONCURRENTLY` via migrate deploy | 1 | **failed (expected)** | P3018 / SQLSTATE 25001 — recorded deviation |
| Final validation suite | 0 | passed | `git diff --check`, `npm ci`, prisma generate/validate/migrate deploy, `test:migrations`, lint, typecheck, test (53), build, graphql-codegen |
| Exact-head CI (implementation commit `854a3d5…`) | 0 | passed | Run `30578113974` / job `90991338324`; `head_sha` matched; required check success |
| Exact-head CI (final PR head `0d836e1…`) | 0 | passed | Run `30578403947` / job `90992281417`; `head_sha` matched; required check success |

## Tests added

| Test | Risk covered |
|---|---|
| `app/lib/shop-domain.test.ts` | Normalization accept/reject matrix |
| Migration empty DB | migrate deploy from empty |
| Migration on init-only | migrate deploy on current-main schema |
| Schema inspection | legacy shop retained; nullable shopId; Session unchanged; indexes; no RLS; no composite FKs; flags OFF |
| Backfill fixture suite | direct/child ownership; quarantine reasons; idempotency; resume; concurrent deny; legacy shop byte-stable; no token leakage |

## Fixture / quarantine evidence (integration test)

Representative disposable fixtures include valid A/B shops, case/whitespace equivalents, invalid scheme domain, preexisting matching shopId, conflicting shopId, domain-conflicting shopId, unresolved parent → child null, PO–supplier mismatch, lead-time missing PO, lead-time shop mismatch, duplicate ShopSettings. Open issue reasons asserted: INVALID_SHOP_DOMAIN, EXISTING_SHOP_ID_MISMATCH, CONFLICTING_NORMALIZED_DOMAIN, PARENT_SHOP_UNRESOLVED, PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH, LEAD_TIME_PURCHASE_ORDER_MISSING, LEAD_TIME_PURCHASE_ORDER_SHOP_MISMATCH, DUPLICATE_SHOP_SETTINGS_TENANT.

## Files changed (by class)

### Schema
* `prisma/schema.prisma`

### Migrations
* `prisma/migrations/20260730160000_tenant_expansion/migration.sql`
* `prisma/migrations/20260730160100_tenant_compatibility_indexes/migration.sql`

### Tooling
* `app/lib/shop-domain.ts`
* `scripts/tenant-backfill/*`
* `prisma/seed.ts`
* `package.json` scripts
* `vitest.migrations.config.ts`
* `.gitignore`

### Tests
* `app/lib/shop-domain.test.ts`
* `scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`

### CI
* `.github/workflows/ci.yml` — adds `npm run test:migrations`; retains required check name; flags remain false

### Documentation
* `docs/phases/phase-1/PR1_TENANT_OWNERSHIP_INVENTORY.md`
* `docs/phases/phase-1/PR1_TENANT_EXPANSION_MIGRATION_RUNBOOK.md`
* `docs/phases/phase-1/PR1_TENANT_EXPANSION_IMPLEMENTATION_REPORT.md`
* `docs/phases/phase-1/README.md`
* `docs/PROJECT_STATUS.md`
* `docs/OPEN_QUESTIONS.md`
* `docs/RISK_REGISTER.md`

## Deviations from the prompt

1. **CREATE INDEX CONCURRENTLY not used inside Prisma Migrate.** Prisma Migrate 6.19 wraps migrations in a transaction; CONCURRENTLY fails with SQLSTATE 25001 / P3018 on disposable PostgreSQL. Compatibility indexes use non-concurrent `CREATE INDEX IF NOT EXISTS` with lock/statement timeouts. Production large-table CONCURRENTLY procedure is documented in the runbook. This is a tooling constraint deviation, not an enforcement change.
2. **No `shopId → Shop.id` foreign key** — matches the prompt’s safer default (not a product deviation).
3. **MISSING_PARENT for FK-protected children:** `SupplierSkuMapping` retains a DB FK to Supplier, so true orphans cannot be inserted; the integration test covers `PARENT_SHOP_UNRESOLVED` instead. `LEAD_TIME_PURCHASE_ORDER_MISSING` covers missing PO (no FK).

## Known failures and unresolved findings

* F-016 / R-022 remain **OPEN P1** — not resolved by PR 1.
* Q-011 remains **OPEN**.
* R-028 / R-029 remain **OPEN** until review + later zero-unresolved enforcement.
* R-024–R-027, R-035–R-039 remain open (later PRs).
* Production migration not executed (correct).

## Decisions needed

* Accept CONCURRENTLY-via-Migrate tooling deviation and runbook production path (ChatGPT).
* No other product-rule changes proposed.

## Statements

* No production or merchant data was accessed.
* No production migration or deployment occurred.
* No RLS was activated.
* Runtime access was not converted.
* PR 2 and PR 3 were not started.
* Production inventory writes remain UNAPPROVED.
* Every inventory-write flag remains default OFF.

## Claude review handoff

Verify the exact PR head against this report: schema/migrations vs prompt exclusions, normalization version, backfill semantics, quarantine reason coverage, migration test evidence on real PostgreSQL, CI head_sha match, flag/OFF posture, and that F-016/R-022/Q-011 remain open.

## Explicit stop statement

Work outside Phase 1 PR 1 was not started. Stop after draft PR + exact-head CI + this report. Next action: **Claude independently reviews PR 1 at the exact final head.**
