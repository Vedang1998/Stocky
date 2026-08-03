# PR 3 — Database Enforcement Architecture

**Phase:** 1  
**Work unit:** PR 3 — Database enforcement  
**Branch:** `phase-1/tenant-enforcement`  
**Starting main:** `00fb925721ad374b3ff976652ec99dbf655ebb11`  
**Status:** Correction implemented — pending independent verification (D-037)  
**Original independently reviewed head:** `57016ed4b685c8958ad49d821f4afd9ea9894a9b` (`NOT READY`)  
**Actual prior runtime/test head:** `0ee3ae027d746b9696c990dfbc59976f4ef56ae7`  
**Production execution:** NOT AUTHORIZED

## Purpose

PR 2’s application-layer `TenantDb` contract is necessary but insufficient. PR 3 makes PostgreSQL independently enforce tenant isolation so an omitted application filter cannot expose or mutate another tenant’s merchant-domain row.

## Role separation (D-015 / D-016)

| Role | Env | Responsibilities |
|---|---|---|
| Migration owner | `DATABASE_MIGRATION_URL` / `TENANT_MAINTENANCE_DATABASE_URL` | Owns schema objects; runs migrations; provisions grants; never used by web/workers |
| Restricted runtime | `DATABASE_RUNTIME_URL` | Ordinary SELECT/INSERT/UPDATE/DELETE subject to FORCE RLS; no BYPASSRLS; no ownership; no DDL |

Configurable names: `STOCKY_MIGRATION_ROLE` (default `stocky_migration`), `STOCKY_RUNTIME_ROLE` (default `stocky_runtime`).

Production-like runtime (`NODE_ENV=production` or `STOCKY_REQUIRE_RUNTIME_DB_URL=1`) **fails closed** if `DATABASE_RUNTIME_URL` is missing or equals the migration URL.

## Transaction-local tenant context (D-017)

- Contract version: `phase1-db-tenant-context-v1`
- GUCs: `stocky.current_shop_id`, `stocky.tenant_context_version`, `stocky.correlation_id`
- Set via `set_config(..., is_local=true)` inside a Prisma interactive transaction
- Cleared on commit/rollback; absent on newly checked-out pooled connections
- Module: `app/tenant/db-context.server.ts`
- Integrated into every `TenantDb` merchant-domain operation

**Trust boundary (honest):** PostgreSQL GUCs do not authenticate Shopify identity. Application `TenantAuthority` validation remains required before setting context. RLS prevents omitted-filter access after context is established. Runtime role cannot bypass RLS.

## RLS (D-014)

On every approved merchant-domain table (18):

- `ENABLE ROW LEVEL SECURITY`
- `FORCE ROW LEVEL SECURITY`
- Explicit policies for SELECT / INSERT / UPDATE / DELETE targeting the runtime role
- Predicate: `"shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1'`
- Missing/malformed context → no authorized rows (fail closed)

## Tenant-key immutability

- Function: `stocky_prevent_shop_id_mutation()` (fixed `search_path`)
- Trigger per merchant table: `BEFORE UPDATE OF "shopId"`
- Rejects reassignment and nulling; non-tenant field updates succeed
- Runtime role cannot replace or disable triggers

## Non-null ownership + composite constraints

Low-lock rollout via `tenant:enforcement:apply` (security-preserving order):

1. Helper functions
2. `roles_prepared` — restricted role attributes; **revoke** merchant DML (no unrestricted grants)
3. Supporting indexes (`CREATE INDEX CONCURRENTLY` where needed)
4. Unique `(shopId, id)` on all 18 merchant tables
5. `CHECK ("shopId" IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL`
6. `shopId → Shop(id)` FK NOT VALID → VALIDATE
7. Composite tenant FKs NOT VALID → VALIDATE (child/cross-domain/LeadTimeSnapshot PO lineage)
8. Per-table ENABLE/FORCE RLS + exact policies + immutability triggers
9. `definitions_verified` — catalog definition verify must pass
10. `runtime_grants_applied` — merchant DML **only after** step 9
11. `final_verified`

Invariant: runtime merchant DML is never active without exact verified RLS.

Verification compares actual PostgreSQL catalog definitions (policy expressions, FK columns/actions, trigger enablement/function digest, recursive role membership, exact privilege allowlist) — not names/counts alone.

Prisma schema keeps `shopId` optional for expand/migrate compatibility; the live DB is NOT NULL after apply. Prisma schema drift is required **before** enforcement; after enforcement the DB intentionally diverges on nullability/FKs/RLS (expected-divergence path for ops tooling).

## Bootstrap (D-018)

- `Session` and `Shop` are **not** merchant-domain RLS targets
- Runtime receives narrow DML grants on Session/Shop
- Control/maintenance tables (`TenantBackfill*`, ownership issues) — **no** runtime privileges
- Bootstrap module remains application-layer restricted; DB grants do not create a general bypass

## Maintenance tooling

| Command | Purpose |
|---|---|
| `tenant:enforcement:inventory` / `:check` | Mechanical inventory freshness |
| `tenant:enforcement:preflight` | Zero-unresolved gate (non-mutating) |
| `tenant:roles:provision` / `:verify` | Runtime role + grants |
| `tenant:enforcement:plan` / `:apply` / `:verify` / `:drift` | Low-lock rollout |
| `tenant:rls:verify` / `tenant:immutability:verify` | Policy/trigger drift |
| `test:db-isolation` | Real PostgreSQL isolation suite |

Apply requires `--apply`, explicit migration/maintenance URL, rejects pooler URL patterns, uses advisory lock `0x53544b33`, finite `lock_timeout` / `statement_timeout`, checkpointed steps, idempotent rerun.

## Out of scope (confirmed absent)

Production deployment/backfill; guessed ownership; legacy `shop` column removal; PR 4; inventory writes; inventory-write flags remain DEFAULT OFF.
