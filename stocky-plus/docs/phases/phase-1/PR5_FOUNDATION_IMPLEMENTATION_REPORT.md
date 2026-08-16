# Phase 1 PR5-F1 — Foundation Implementation Report

**Slice:** PR5-F1 shared canonical fact foundation
**Branch:** `phase-1/catalog-location-inventory-facts`
**Draft PR:** [#27](https://github.com/Vedang1998/Stocky/pull/27)
**Authority:** D-054 **EFFECTIVE**
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF

This report records the foundation-only implementation. It does **not** claim PR 5 is complete. No later PR5 runtime lane started.

---

## 1. Verified main / base SHA

`origin/main` = `ae1b428039152efc6b4a46107e1bcca5eb17586a`

## 2. Starting branch SHA

`phase-1/catalog-location-inventory-facts` initially equaled `ae1b428039152efc6b4a46107e1bcca5eb17586a`.

## 3. Worktree baseline

Before edits: clean worktree on the authorized branch. `npm ci` had already populated `node_modules`. Baseline Prisma:

- `npx prisma generate` — executed, Prisma Client 6.19.3
- `npx prisma validate` — executed, schema valid

Disposable PostgreSQL **16.14** and Redis were running. Inventory-write flags observed `false`.

## 4. D-054 effective evidence

| Item | Value |
|---|---|
| PR #26 | CLOSED / MERGED |
| Accepted review-record head | `7171c2cbbdff15ae0d92aa6850a1ae12804db3f4` |
| Squash merge | `ae1b428039152efc6b4a46107e1bcca5eb17586a` |
| Post-merge main CI | run `31966584542`, event `push`, head `ae1b4280…`, **SUCCESS** |
| Classify | `95212558793` SUCCESS |
| CI Gate | `95212578956` SUCCESS |
| Heavy | `95212579347` SKIPPED (PR26 docs-only) |

Condition 9 is satisfied. D-054 is **EFFECTIVE**. No D-055 created.

## 5. Exact files changed

Runtime / schema / enforcement:

- `stocky-plus/prisma/schema.prisma`
- `stocky-plus/prisma/migrations/20260816193000_pr5_catalog_fact_foundation/migration.sql`
- `stocky-plus/app/lib/catalog-facts/**`
- `stocky-plus/scripts/tenant-enforcement/manifest.ts`
- `stocky-plus/scripts/tenant-enforcement/roles.ts`
- `stocky-plus/scripts/tenant-enforcement/inventory.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr5-catalog-fact-foundation.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/sequence-privilege.test.ts`
- `stocky-plus/scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts` (required: this existing CI fixture hardcodes the post-init parking list and a historical “zero composite FKs” assertion; the new foundation migration must be parked during init-only deploy, and the five approved PR5 composite identity FKs must be the exact remaining set)

Mechanical TenantDb / inventory registration (required so new merchant-domain models participate in the existing PR2/PR3 architecture; not a TenantDb redesign):

- `stocky-plus/app/tenant/models.ts`
- `stocky-plus/app/tenant/selectors.ts`
- `stocky-plus/app/tenant/legacy-scope.ts`
- `stocky-plus/app/tenant/tenant-db.server.ts`
- `stocky-plus/app/tenant/__tests__/tenant-db.test.ts`
- `stocky-plus/app/tenant/__tests__/db-isolation/isolation.test.ts`
- `stocky-plus/app/tenant/__tests__/top-level-unique-selectors.test.ts`
- `stocky-plus/scripts/tenant-access/allowlist.ts`
- `stocky-plus/scripts/tenant-access/architecture-audit.test.ts`
- `stocky-plus/scripts/tenant-access/inventory.ts`
- `stocky-plus/scripts/sync-control-plane/roles.ts`
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`
- `stocky-plus/docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md`

Live control records / this report:

- `stocky-plus/docs/PROJECT_STATUS.md`
- `stocky-plus/docs/DECISIONS.md`
- `stocky-plus/docs/RISK_REGISTER.md`
- `stocky-plus/docs/phases/phase-1/README.md`
- `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` (live status/evidence only)
- `stocky-plus/docs/phases/phase-1/PR5_FOUNDATION_IMPLEMENTATION_REPORT.md`

No Shopify TOML, GraphQL document, package, or feature-flag file changed.

## 6. Migration name

`20260816193000_pr5_catalog_fact_foundation`

Additive only. Recovery: leave new objects unused; later apply/ingest lanes are not wired. Emergency rollback may DROP the new tables/enums/sequence/fence columns after confirming no production writer exists (production is not authorized).

## 7. New canonical models

- `ShopifyProductFact`
- `ShopifyProductCollectionMembership`
- `ShopifyVariantFact`
- `ShopifyInventoryItemFact`
- `ShopifyLocationFact`
- `ShopifyInventoryLevelFact`
- `CatalogObservationInFlight`

## 8. Identity constraints per model

Every new merchant-domain model: non-null `shopId`, `@@unique([shopId, id])`, direct `Shop` ownership (`onDelete: Restrict`, `onUpdate: NoAction`), `createdAt` / `updatedAt`, no legacy `shop` string authority, no nullable-shopId expand.

| Model | Tenant-leading identity |
|---|---|
| `ShopifyProductFact` | `(shopId, shopifyGid)` |
| `ShopifyProductCollectionMembership` | `(shopId, shopifyProductGid, shopifyCollectionGid)` |
| `ShopifyVariantFact` | `(shopId, shopifyGid)` |
| `ShopifyInventoryItemFact` | `(shopId, shopifyGid)` |
| `ShopifyLocationFact` | `(shopId, shopifyGid)` |
| `ShopifyInventoryLevelFact` | `(shopId, inventoryItemGid, locationGid)` |
| `CatalogObservationInFlight` | own observation token `id` plus `@@unique([shopId, id])` — not unique per canonical identity |

SKU / barcode / title / handle / vendor remain attributes.

## 9. InventoryLevel pair identity proof

Unique index `ShopifyInventoryLevelFact_shopId_inventoryItemGid_locationG_key` on `(shopId, inventoryItemGid, locationGid)`. `shopifyInventoryLevelGid` is lineage/reference only and is **not** unique. Disposable-PostgreSQL foundation tests asserted the pair unique index exists and that no unique index includes `shopifyInventoryLevelGid`. Lock-key vector 3 and the pair-stability test produce the same `(key1, key2)` for the same pair.

## 10. SyncRun fence fields

Brief §8.1 / §14 fence contract only:

- `fenceGeneration BigInt?` — PostgreSQL `BIGINT`; never a JavaScript `Number`
- `fenceAt DateTime?`
- `@@index([shopId, fenceGeneration])`

No Shopify I/O. Later extraction allocates one generation, persists these fields, commits, then may perform network I/O.

## 11. CatalogObservationInFlight schema

Merchant-domain evidence. Own observation token. Multiple concurrent rows per canonical identity are allowed. Fields include `observationRequestGen`, nullable `observationResponseGen`, `leaseDurationMs` (application supplies validated duration only), `leaseExpiresAt` (PostgreSQL `clock_timestamp()` overwrite on INSERT), `lifecycleState`, Product / ProductVariant / InventoryItem / Location GID identity **or** InventoryLevel pair identity, and opaque `durableJobId` / `jobAttemptId` / `correlationId` strings with **no FK** to DurableJob, JobAttempt, SyncRun, DataIssue, or other control-plane tables.

## 12. ACTIVE / COMPLETED DB constraint proof

CHECK `CatalogObservationInFlight_lifecycle_response_gen_check`:

- `ACTIVE` ⇒ `observationResponseGen IS NULL`
- `COMPLETED` ⇒ `observationResponseGen IS NOT NULL`
- `ABANDONED` may have null or non-null `responseGen`

Trigger `stocky_catalog_observation_lifecycle_guard` forbids `ABANDONED → ACTIVE`. Foundation tests rejected ACTIVE+responseGen and COMPLETED+null, allowed two ACTIVE rows for the same Product GID, and rejected abandoned reactivation.

## 13. Platform sequence definition

```sql
CREATE SEQUENCE public.stocky_catalog_observation_gen_seq
  AS bigint INCREMENT BY 1 MINVALUE 1 NO MAXVALUE
  START WITH 1 CACHE 1 NO CYCLE;
REVOKE ALL ON SEQUENCE public.stocky_catalog_observation_gen_seq FROM PUBLIC;
```

Never stored on Shop. No reset/reuse/`setval` correctness path. Gaps allowed. Request/response generations may burn.

## 14. Sequence privilege proof

Migration grants no USAGE and no UPDATE. Role provisioning grants **USAGE only** to `stocky_runtime` and `stocky_control_plane`. Drift checks fail on SELECT, UPDATE, ownership, PUBLIC, or missing USAGE. Foundation + `sequence-privilege` tests: `setval` and `ALTER SEQUENCE … RESTART` denied for application roles; `cycle = false`; burned generations create gaps.

## 15. Tenant manifest additions

`scripts/tenant-enforcement/manifest.ts` registers all seven new tables as `merchant_domain`, `kind: direct`, `shopIdNullableInPrisma: false`, `legacyShopField: false`, `existingShopIdIdUnique: true`. `assertMerchantTableCount` is **26**. Composite FKs added for collection membership, variant→product, inventory-level pair parents, and optional inventory-item→variant.

## 16. RLS / immutability / role proof

After migrate deploy on disposable `stocky_plus_ci` plus enforcement apply:

- `tenant:roles:provision -- --apply` ok
- `tenant:enforcement:preflight` ok (`merchantTableCount: 26`)
- `tenant:enforcement:apply -- --apply` ok
- `tenant:roles:verify` ok
- `tenant:rls:verify` ok
- `tenant:immutability:verify` ok
- `tenant:enforcement:verify` ok
- `tenant:enforcement:drift` ok

Foundation tests: cross-shop SELECT/INSERT/UPDATE denied; `shopId` mutation denied; `stocky_control_plane` cannot DML new merchant tables.

## 17. Canonical lock module path

`stocky-plus/app/lib/catalog-facts/lock-key.ts` is the only derivation implementation. Version `stocky-pr5-canonical-lock-v1`. Encoding `<decimal UTF-8 byte length>:<UTF-8 bytes>`. No trim / lowercase / Unicode normalization. SHA-256 digest bytes 0..3 / 4..7 = signed big-endian int32 `key1` / `key2`.

## 18–21. Known-answer vectors

Executed and passed in `app/lib/catalog-facts/lock-key.test.ts` (5 tests).

| Vector | key1 | key2 | SHA-256 |
|---|---|---|---|
| 1 Product | `-2026931606` | `-1244424496` | `872f7a6ab5d396d0738736ef15c37065e2bf6fba6f7480dd8f517fe487d799c1` |
| 2 ProductVariant | `1954698247` | `-283901703` | `74825407ef1400f9b02bf51b778b04cf20c765605c541131e4a6a84701d92e7e` |
| 3 InventoryLevel pair | `1015729171` | `17679052` | `3c8acc13010dc2cc5e30275b4c581f156acb07eb914e3f59e8bf5e80a9cb0713` |
| 4 UTF-8 `tést-shop` | `-1422460006` | `-1025379571` | `ab36fb9ac2e1f30d0cbf8f4666281b576d4e0c3dc73a51a351800ad8b41b7ecb` |

Vector 4 proves UTF-8 **byte** length 10 for `tést-shop` (JavaScript string length 9). Preimage: `28:stocky-pr5-canonical-lock-v110:tést-shop7:Product24:gid://shopify/Product/42`. Closes **F-CLAUDE-PR5IE-01**.

## 22. Advisory acquisition primitive

`stocky-plus/app/lib/catalog-facts/advisory-lock.ts` — `acquireCanonicalIdentityAdvisoryLock`. Requires an already-open matching tenant transaction (`stocky.current_shop_id`). Uses `pg_advisory_xact_lock(key1, key2)` only. Session-level `pg_advisory_lock` is forbidden.

## 23. Finite timeout implementation

Transaction-local `set_config('lock_timeout', '<n>ms', true)` in the same transaction, default **5000 ms**. Does not modify `postgresql.conf`. Does not set a session-level timeout that leaks. Proven on PostgreSQL 16.14: `SET LOCAL` / `set_config(..., true)` **does** bound `pg_advisory_xact_lock` (`canceling statement due to lock timeout`). Closes **F-CLAUDE-PR5IE-02**.

## 24. Stalled-holder integration-test result

Foundation test `serializes first-insert Product advisory lock when no fact row exists`: holder acquires with no `ShopifyProductFact` row; waiter times out within 4s at 800 ms bound; waiter writes no canonical state and rolls back; after holder rollback a later acquire succeeds. Test duration for that case: **825 ms**. Executed and passed.

## 25. Capacity evaluator path

`stocky-plus/app/lib/catalog-facts/lock-capacity.ts`

## 26. 64 / 63 boundary result

Executed and passed (`lock-capacity.test.ts`):

- `mlpt=64`, requested 32 → accepted by condition A, effective **32**
- `mlpt=63`, requested 32 → condition A cap 31, reduced, effective **31**

Closes **F-CLAUDE-PR5IE-03**.

## 27. Implementation-entry capacity example results

Requested batch 32, concurrency 4:

| mlpt / connections / prepared | effective batch |
|---|---|
| 64 / 100 / 0 | **32** |
| 32 / 100 / 0 | **16** |
| 16 / 100 / 0 | **8** |
| 64 / 5 / 0 | **20** |

Arithmetic alone does **not** prove production safety.

## 28. First-insert / no-row lock serialization test

Executed and passed against disposable PostgreSQL 16 (see item 24).

## 29. No-Shopify-network proof

`git diff` against `ae1b4280…` contains no GraphQL documents, no Shopify TOML, and no `@shopify` / `bulkOperationRunQuery` imports in `app/lib/catalog-facts/*`. Foundation safety test asserts the same. No Admin API network call was made.

## 30. No-Shopify-write proof

No inventory mutation helper, no `inventoryAdjustQuantities`, no write-flag enablement, no Shopify write path added. Safety test asserts flags remain false.

## 31. No feature-flag delta

`git diff --name-only ae1b4280…` shows no feature-flag file change. Observed env: all `FEATURE_*` write flags `false`. Runtime checks in `foundation-safety.test.ts` passed.

## 32. Legacy caches unchanged

`ShopifyVariantCache` and `InventorySnapshot` were not removed, repurposed, or made to read the new fact tables. Existing forecasting / PO / receiving code was not redirected.

## 33. Local validation commands / results

Environment: disposable PostgreSQL 16.14, Redis PONG, Node v22.14.0. Local `DATABASE_URL` initially targeted `stocky_plus` while maintenance/runtime URLs targeted `stocky_plus_ci`; migrate deploy and tenant-access were therefore executed against `stocky_plus_ci` to match CI.

| Command | Result |
|---|---|
| `npx prisma generate` | executed, passed |
| `npx prisma validate` | executed, passed |
| `npx prisma migrate deploy` (ci DB) | executed, applied `20260816193000_pr5_catalog_fact_foundation`, 18 migrations up to date |
| `npm run tenant:enforcement:inventory:check` | exit 0 |
| `npm run tenant:roles:provision -- --apply` | exit 0 |
| `npm run tenant:enforcement:preflight` | exit 0, 26 merchant tables |
| `npm run tenant:enforcement:apply -- --apply` | exit 0 |
| `npm run tenant:roles:verify` | exit 0 |
| `npm run tenant:rls:verify` | exit 0 |
| `npm run tenant:immutability:verify` | exit 0 |
| `npm run tenant:enforcement:verify` | exit 0 |
| `npm run tenant:enforcement:drift` | exit 0 |
| `npx vitest run app/lib/catalog-facts/*.test.ts` | 3 files, **12** tests passed |
| `npx vitest run --config vitest.migrations.config.ts` PR5 foundation + sequence-privilege | 2 files, **13** tests passed |
| `npm run test:enforcement-definition-drift` | 1 file, **11** tests passed |
| `npm run test:db-isolation` | 2 files, **19** tests passed |
| `npm run test:tenant-access` | 34 files, **288** tests passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

## 34. Exact implementation head SHA

Runtime/test implementation commit: `a04fa51eb94fb6ac6337a4e1e76c18480c65b33a`.
Documentation commit that first included this report: `f958ce5c47796b3862c8e8220edf979a575551fb`.
Prisma relation / drift correction: `e15d2de002ccb2fd0fe7e6d1412d77bf7c196f3b`.
Live PR head after the tenant-expansion parking/composite-FK fixture correction is the commit that includes this paragraph; do not treat that SHA as known before the commit exists.

## 35. Draft PR number / URL

[#27](https://github.com/Vedang1998/Stocky/pull/27) — draft, targeting `main`. Not marked ready. Not merged.

## 36–39. Exact-head CI

Superseded failed / cancelled exact-head runs (do not treat as current-head evidence):

| Run | Head | Event | Result |
|---|---|---|---|
| `31968046370` | `a04fa51eb94fb6ac6337a4e1e76c18480c65b33a` | `pull_request` | Classify SUCCESS; Heavy `95216111747` FAILURE at `tenant:schema:drift` (optional InventoryItem→Variant FK existed in SQL without a Prisma relation; existing control-plane Shop FKs were also rewritten to `onUpdate: NoAction`); CI Gate FAILURE |
| `31968529979` | `f958ce5c47796b3862c8e8220edf979a575551fb` | `pull_request` | Classify `95217270790` FAILURE (`git diff --check` trailing whitespace in this report); Heavy SKIPPED; CI Gate FAILURE. Classification before the whitespace gate: `docs_only=false`, `full_ci=true` |
| `31968565003` | `7644a183c776da01545dfacc666ec7fececa3278` | `pull_request` | Classify SUCCESS; Heavy cancelled when the drift correction was pushed |
| `31968723550` | `e15d2de002ccb2fd0fe7e6d1412d77bf7c196f3b` | `pull_request` | Classify `95217750470` SUCCESS (`docs_only=false`, `full_ci=true`); Heavy `95217772251` FAILURE at `npm run test:migrations` — 5 failures in `tenant-expansion.migration.test.ts` because the unparked PR5 migration ran during init-only deploy (`relation "SyncRun" does not exist`) and the historical “zero composite FKs” assertion saw the five approved PR5 identity FKs; CI Gate `95224284974` FAILURE |

Correction now in the tenant-expansion fixture: `ALL_MIGRATION_NAMES` / init-only parking include `20260816193000_pr5_catalog_fact_foundation`; the composite-FK assertion expects exactly the five approved PR5 canonical identity FKs and no others.

A later exact-head `pull_request` run on the parking-fixture correction head is required. Expected classification remains `docs_only=false`, `full_ci=true`. Heavy must run. CI Gate must succeed only after full validation.

## 40–44. Risk status

| Risk | Status |
|---|---|
| R-157 | **OPEN** — sequence/privilege primitive exists; not closed |
| R-158 | **OPEN** — apply/conflict engine not in this slice |
| R-159 | **OPEN** — observation schema/constraints exist; writers/reapers not in this slice |
| R-160 | **OPEN** until full implementation/review proves all writer paths use one canonical derivation/anchor |
| R-161 | **OPEN** until capacity/concurrency/deployment evidence. Evaluator arithmetic is not production proof. |

## 45. Implementation report path

`stocky-plus/docs/phases/phase-1/PR5_FOUNDATION_IMPLEMENTATION_REPORT.md`

## 46. Remaining blockers

- Exact-head full CI on the live PR head (Heavy + CI Gate) must be recorded before ChatGPT/Claude foundation review of that head.
- Independent Claude Code exhaustive foundation review after exact-head CI is green.
- ChatGPT technical acceptance of PR5-F1.
- User merge authorization. Do not mark ready. Do not merge.

Out of scope and not started: Shopify extraction, GraphQL, bulk JSONL, webhook fact application, reconciliation, compatibility projection, UI, later PR5 lanes.

## 47. Confirmation that no later PR5 runtime lane started

Confirmed. This slice freezes schema, tenancy, identity, observation lifecycle, advisory-lock, generation, and capacity primitives only.
