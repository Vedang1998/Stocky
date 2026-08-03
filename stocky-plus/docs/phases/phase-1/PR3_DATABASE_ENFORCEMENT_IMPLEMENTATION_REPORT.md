# PR 3 — Database Enforcement Implementation Report

**Phase:** 1  
**Work unit:** PR 3 — Database enforcement  
**Branch:** `phase-1/tenant-enforcement`  
**Starting main SHA:** `00fb925721ad374b3ff976652ec99dbf655ebb11`  
**Status:** Implementation complete — pending independent verification  
**Production execution:** NOT AUTHORIZED  
**Inventory writes:** UNAPPROVED / flags DEFAULT OFF

## Identity

| Field | Value |
|---|---|
| Starting main | `00fb925721ad374b3ff976652ec99dbf655ebb11` |
| Branch | `phase-1/tenant-enforcement` |
| Decision | D-036 |
| PR state | Draft PR [#15](https://github.com/Vedang1998/Stocky/pull/15) — OPEN, unmerged |
| Merge state | Unmerged |
| Current main | `00fb925721ad374b3ff976652ec99dbf655ebb11` |
| Prior handoff head (failed CI) | `1467483455f4cd4726fb5cfd65ee2b6d247903bc` |
| Runtime/test implementation head | `aeeecc264e9203641aa07dcd6d814c5a1aba2aab` |
| Empty CI retrigger | `6ffa2d31045d9eb6480a5ae72c4dd3dc484897ee` |
| Implementation tip with first green CI | `0ee3ae027d746b9696c990dfbc59976f4ef56ae7` (run `30785527274`) |
| Documentation tip with green CI | `af964c0a8f59b39403973a5dac7ea0dea573b760` (run `30786147408`) |
| Final exact PR head | `9c2c98cbfe51fb57ba5f79c6c9d975048893d4e2` |

Commits (implementation → exact-head handoff): `0d4ba3c` → `5808838` → `ffdd55c` → `4035f6e` → `aeeecc2` → `1467483` → `a254178` → `27234f6` → `d4dd43f` → `6ffa2d3` → `bc6734d` → `0ee3ae0` → `5652ff1` → `af964c0` → `9c2c98c`.

## Exact-head CI evidence

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30786796167` |
| Job ID | `91601769081` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| Actual `head_sha` | `9c2c98cbfe51fb57ba5f79c6c9d975048893d4e2` |
| Conclusion | **success** |
| Skipped material steps | **none** |
| Prior green tips | `0ee3ae0` / `30785527274`; `af964c0` / `30786147408` |

### Enforcement-specific steps (all success on final tip `9c2c98c`)

| Step | Command / suite | Outcome |
|---|---|---|
| Tenant enforcement inventory freshness | `npm run tenant:enforcement:inventory:check` | success |
| Tenant enforcement preflight | `npm run tenant:enforcement:preflight` | success (`ok:true`, 18 tables, `globalFailures:[]`, `productionDataInspected:false`) |
| Tenant database role verification | `npm run tenant:roles:verify` | success (`ok:true`, `failures:[]`, runtime NOSUPERUSER / NOBYPASSRLS) |
| Tenant RLS policy verification | `npm run tenant:rls:verify` | success (`ok:true`, `issues:[]`) |
| Tenant immutability verification | `npm run tenant:immutability:verify` | success (`ok:true`, `issues:[]`) |
| Tenant composite constraint verification | `npm run tenant:enforcement:verify` | success (`ok:true`, `issues:[]`) |
| Tenant pooled-connection isolation tests | `test:db-isolation` → `isolation.test.ts` | success — **14 passed** |
| Tenant database isolation full suite | `npm run test:db-isolation` | success — **23 passed** (2 files) |
| Tenant low-lock enforcement migration tests | `enforcement.migration.test.ts` | success — **4 passed** |
| Tenant enforcement drift verification | `npm run tenant:enforcement:drift` | success (`ok:true`, `issues:[]`) |

### Required existing steps (all success)

Prisma generate / validate / migrate deploy; Tenant compatibility index apply + verify; Tenant schema drift; Tenant access architecture audit; Tenant access inventory freshness; Tenant-access PostgreSQL and Redis suites; Migration/backfill tests; Subject-memory tests; Lint; Typecheck; Unit tests; Build; GraphQL codegen.

### Observed test counts (exact-head CI on `0ee3ae0`; reconfirmed green on `af964c0`)

| Suite | Count |
|---|---|
| Role verification | CLI `tenant:roles:verify` → `ok:true`, `failures:[]` (nonzero privilege/attribute checks; covered further in isolation suite) |
| RLS policy verification | CLI `tenant:rls:verify` → `ok:true`, `issues:[]` |
| Immutability | CLI `tenant:immutability:verify` → `ok:true`, `issues:[]` |
| Composite constraints | CLI `tenant:enforcement:verify` → `ok:true`, `issues:[]` |
| Pool leakage (pooled-connection step) | **14 passed** |
| Full database isolation | **23 passed** |
| Low-lock migration | **4 passed** |
| Existing tenant-access (aggregate step) | **291 passed** (34 files); first PG gate **31 passed** |
| Migrations / tenant-backfill | **110 passed** (25 files) |
| Units | **56 passed** (6 files) |

### Superseded failed runs (same PR branch)

| Head | Run ID | Job ID | Failed step |
|---|---|---|---|
| `1467483` | `30781828372` | `91587882345` | Tenant enforcement preflight (stale PR2 access inventory) |
| `a254178` | `30783051009` | `91591312057` | Tenant access PostgreSQL (runtime grants wiped by schema reset) |
| `27234f6` | `30783403916` | `91592283513` | Lint (unused imports) |
| `d4dd43f` | `30783921950` | `91593751576` | Initialize containers (Docker Hub pull timeout) |
| `6ffa2d3` | `30784345386` | `91594956244` | Typecheck (pragma commented out `const u`) |
| `bc6734d` | `30784928634` | `91596572488` | Unit tests (Prisma mocks missing `$executeRaw` / context APIs) |

Cancelled prior run on runtime head `aeeecc2`: run `30781820588`.

## Inventory

| Item | Count |
|---|---|
| Merchant-owned tables (RLS) | 18 |
| Bootstrap tables | 2 (`Session`, `Shop`) |
| Control/maintenance tables | 4 |
| Composite parent keys `(shopId,id)` | 18 |
| Composite foreign keys | 8 |
| Immutability triggers | 18 |
| RLS policies (4 × 18) | 72 |
| Helper functions | 3 |

## Architecture summary

- Migration owner vs restricted runtime role (`DATABASE_MIGRATION_URL` / `DATABASE_RUNTIME_URL`)
- Transaction-local context `phase1-db-tenant-context-v1` via `set_config(..., true)`
- FORCE RLS + explicit SELECT/INSERT/UPDATE/DELETE policies
- `stocky_prevent_shop_id_mutation` BEFORE UPDATE OF shopId
- Low-lock NOT NULL / composite FK rollout with advisory lock
- Narrow Session/Shop bootstrap grants; no runtime access to backfill control tables
- `TenantDb` establishes context before every merchant-domain operation

## Preflight evidence (disposable fixture / CI)

- Fixture type: empty current-schema disposable PostgreSQL 16 (no production/merchant data)
- Null shopId counts: 0 on all 18 tables
- Open quarantine: 0
- Cross-domain mismatch: 0
- No guessed ownership
- **Production data was not inspected**

## Migration / lock evidence (empty disposable / CI fixture)

- CI apply `maxObservedLockHoldMs`: **44**
- Local empty fixture earlier observed ~**14 ms**
- Operations: concurrent indexes, NOT VALID checks/FKs, VALIDATE, SET NOT NULL, ENABLE/FORCE RLS
- Interrupted/resume: idempotent re-apply verified in migration suite
- Timeout: finite lock/statement timeouts configured; unlimited timeouts rejected
- Does **not** claim zero locking

## Safety confirmation

- No production or merchant data accessed
- No production deployment or backfill
- No guessed ownership
- No legacy `shop` column removal
- No PR 4 work
- No inventory mutation
- All inventory-write flags DEFAULT OFF
- No real secrets committed
- PR remains draft and unmerged

## Next action

Return to ChatGPT for exact-head verification and the independent PR 3 database-enforcement review prompt.
