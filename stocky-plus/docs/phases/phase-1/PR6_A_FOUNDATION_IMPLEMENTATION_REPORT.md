# Phase 1 PR6-A — Order / refund fact foundation implementation report

Status: **PR6-A CORRECTIONS IMPLEMENTED / INDEPENDENT RE-REVIEW PENDING**.
ChatGPT accepted the independent review’s **CORRECTIONS REQUIRED** verdict
(P0=0 / P1=0 / P2=1 / P3=3) and authorized this focused correction package.
This report does not claim independent re-review, ChatGPT acceptance, or merge
authorization. Exact-head `pull_request` CI on the correction head is recorded
in the PR body after the push; this file does not invent that run ID.

## 1. Authority and base

| Item | Value |
| --- | --- |
| Role | Cursor — PR6-A implementation owner |
| Authority | ChatGPT Phase 1 PR6-A foundation implementation only. Do **not** create D-055. Recorded as D-054 item 23. |
| Required / current main | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| PR #34 | CLOSED / MERGED `2026-09-07T00:53:25Z` (squash) |
| Post-merge PR #34 CI | Run `34071226302` — `push` — SUCCESS. Classify `101588830168` SUCCESS. Heavy `101588852919` SKIPPED. CI Gate `101588852489` SUCCESS. |
| Final independent planning verdict | `APPROVE PR6 CURRENT-MAIN PLANNING` |
| Final review blob | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` |
| Branch | `phase-1/pr6-a-order-refund-fact-foundation` |
| Authority/control commit | `ea5830b159709e207827bc6f03ae55eafa49943b` |
| Draft PR | Opened from this branch after the implementation commit. GitHub assigns the number; this file does not invent the PR number or this commit’s own SHA. |
| D-055 | **Not created** |

This lane does **not** authorize PR6-B, PR6-C, PR6-D, production, merchant
production data, Shopify writes, inventory writes, deployment, feature-flag
enablement, `read_all_orders`, or `write_orders`.

## 2. Schema / models added

DIRECT merchant models added:

- `ShopifyOrderFact`
- `ShopifyOrderLineFact`
- `ShopifyOrderRefundFact`
- `OrderFactObservationInFlight`

CHILD merchant models added:

- `ShopifyOrderRefundLineFact`
- `ShopifyOrderAdjustmentFact`
- `ShopifyOrderAgreementFact`
- `ShopifyOrderAgreementSaleFact`
- `ShopifyOrderRefundTransactionFact`

`ShopifyOrderShippingLineFact` was **not** added. Refund shipping money is
persisted as columns on `ShopifyOrderRefundFact` per approved plan §5.3.1.

Shop columns added (nullable-first, no fake defaults):

- `Shop.ianaTimezone`
- `Shop.currencyCode`

DIRECT / CHILD counts:

| Inventory | Pre-PR6-A | PR6-A delta | Post-PR6-A |
| --- | --- | --- | --- |
| DIRECT | 20 | +4 | **24** |
| CHILD | 6 | +5 | **11** |
| Merchant-owned total | 26 | +9 | **35** |

## 3. Migration identity and safety

Folder:

`prisma/migrations/20260907010000_pr6_a_order_refund_fact_foundation/`

Safety:

- Additive SQL only. Existing migrations were not edited.
- No destructive drops, no production DML, no production connection.
- `Shop` column adds use `lock_timeout = 5s` and `statement_timeout = 15s`.
- New tables are empty, so ordinary transactional indexes are used.
- No second observation-generation sequence. Reuses
  `stocky_catalog_observation_gen_seq`.
- Rollback is drop new tables/enums/functions then drop the two nullable Shop
  columns. Shop column drop is a later maintenance window; no data backfill
  exists in this lane.

## 4. Tenant / RLS / roles

Registered additively in:

- `app/tenant/models.ts`
- `app/tenant/tenant-db.server.ts`
- `app/tenant/relations.ts`
- `app/tenant/selectors.ts`
- `app/tenant/legacy-scope.ts`
- `scripts/tenant-enforcement/manifest.ts`
- `scripts/tenant-enforcement/roles.ts`
- `scripts/tenant-access/allowlist.ts`

Classification: `merchant_domain`, `rlsRequired: true`, FORCE RLS through
existing enforcement.

Runtime table privileges follow the existing SELECT/INSERT/UPDATE/DELETE
pattern. `stocky_runtime` still has no BYPASSRLS, no table ownership, and no
`DataIssue` DML. Sequence privilege remains USAGE-only. PUBLIC remains denied.

Control-plane Shop grants remain column-level (F-PR4-06). Lifecycle columns
stay SELECT+UPDATE. `ianaTimezone` and `currencyCode` are **SELECT-only** so
Prisma `UPDATE … RETURNING *` on uninstall/reinstall does not fail, and
control-plane cannot write those Shopify facts.

Composite tenant FKs added:

- `ShopifyOrderLineFact (shopId, shopifyOrderGid) → ShopifyOrderFact`
- `ShopifyOrderRefundLineFact (shopId, shopifyRefundGid) → ShopifyOrderRefundFact`
- `ShopifyOrderAdjustmentFact (shopId, shopifyRefundGid) → ShopifyOrderRefundFact`
- `ShopifyOrderAgreementFact (shopId, shopifyOrderGid) → ShopifyOrderFact`
- `ShopifyOrderAgreementSaleFact (shopId, shopifyAgreementGid) → ShopifyOrderAgreementFact`
- `ShopifyOrderRefundTransactionFact (shopId, shopifyRefundGid) → ShopifyOrderRefundFact`

No Refund → Order FK. No historical order-line → `ShopifyVariantFact` FK.

## 5. Observation-in-flight contract

`OrderFactObservationInFlight` is a separate order-domain table. It does not
reuse `CatalogObservationInFlight`.

Lifecycle:

- ACTIVE ⇒ `responseGen IS NULL`
- COMPLETED ⇒ `responseGen IS NOT NULL`
- durable failure / incomplete-snapshot evidence columns exist
- request/response generation lineage uses
  `stocky_catalog_observation_gen_seq`
- tenant owned; later B/C/D may use it for pagination/fetch failures

Lease SET uses `clock_timestamp()`. No generation counter was added to `Shop`.

## 6. Lock contract

Version: `stocky-pr6-canonical-lock-v1`

Resource kinds: `Order`, `OrderLine`, `Refund`, `RefundLine`

Encoding: length-prefixed UTF-8 components, SHA-256, signed int32 `key1`/`key2`
from digest bytes 0..7. No JS Number 64-bit lock key.

PR5 catalog lock known-answer vectors remain unchanged.

## 7. Types contract

File: `app/lib/order-facts/types.ts`

Types/interfaces only. No Prisma import, no GraphQL-generated import, no
network I/O, no database I/O, no applicator behavior. `app/types/**` was not
added.

## 8. Local validation

Environment: disposable local PostgreSQL 16 + Redis. No production connection.
Inventory-write flags remain false.

| Check | Result |
| --- | --- |
| `npx prisma validate` | pass |
| `npx prisma generate` | pass (Prisma Client 6.19.3) |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npx vitest run app/lib/order-facts` | 17 passed |
| `npx vitest run app/lib/catalog-facts/lock-key.test.ts` | 5 passed |
| `npm test` | 385 passed; 5 failed on gitignored `app/types/admin-2026-07.schema.json` absence (PO-11 carry-forward; CI generates this file first) |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts` | 18 passed (after SELECT-only Shop grant correction) |
| `npm run test:sync-uninstall` | 8 passed |
| `npx vitest run --config vitest.sync-integration.config.ts app/sync/__tests__/sync-control-plane.integration.test.ts` | 17 passed |
| `npm run test:sync-role-isolation` | 9 passed |
| sequence-privilege tests | 2 passed |
| tenant-db + unique-selector tests | 24 passed |
| db-isolation `isolation.test.ts` | 14 passed |
| tenant:access:audit | 0 violations; 35 models covered |
| tenant:enforcement:preflight | merchantTableCount 35; compositeFkCount 19 |
| tenant-expansion.migration.test.ts | 7 passed |
| definition-drift + exact-privilege-complete-matrix | 38 passed |
| schema-drift.migration.test.ts | 3 passed |
| architecture-audit.test.ts | 25 passed |
| `npm run build` | pass |
| `git diff --check` | pass |

Exact-head GitHub Actions `pull_request` CI is the authoritative automatic
evidence after this branch is pushed. This file does not invent a CI run ID
or this commit’s own SHA. Independent review must use the live PR head and
exact-head Classify / Heavy / CI Gate jobs.

First exact-head run `34074356984` on `368e46454331e3cea3130e9d532aea8e347b4cb3`
failed Heavy step “Sync control-plane integration tests” (8 failures): Prisma
`tx.shop.update()` in `app/sync/uninstall.server.ts` returned PostgreSQL
`42501 permission denied for table Shop`. Cause: F-PR4-06 column-level Shop
grants did not yet SELECT the new PR6-A columns, so `UPDATE … RETURNING *`
failed. Correction: SELECT-only grants for `ianaTimezone` / `currencyCode`;
UPDATE remains denied. Control-plane lifecycle UPDATE columns are unchanged.

Second exact-head run `34075969689` on `0f482f66acc3e7a6c9a8941723c45891fe3b72e2`
failed Heavy step “Tenant enforcement preflight”
(`tenant:access:inventory:check_failed_exit_1`) because the SELECT-only grant
edit shifted scanner line anchors in `scripts/sync-control-plane/roles.ts`.
`PR2_TENANT_ACCESS_INVENTORY.md` was regenerated (`npm run tenant:access:inventory`);
findings remain 1734, violations remain 0. No later push is intended after the
corrected exact-head run is green.

## 8a. Files in the implementation commit

Runtime / schema / enforcement:

- `stocky-plus/prisma/schema.prisma`
- `stocky-plus/prisma/migrations/20260907010000_pr6_a_order_refund_fact_foundation/migration.sql`
- `stocky-plus/app/lib/order-facts/constants.ts`
- `stocky-plus/app/lib/order-facts/lock-key.ts`
- `stocky-plus/app/lib/order-facts/advisory-lock.ts`
- `stocky-plus/app/lib/order-facts/types.ts`
- `stocky-plus/app/lib/order-facts/lock-key.test.ts`
- `stocky-plus/app/lib/order-facts/types.test.ts`
- `stocky-plus/app/lib/order-facts/foundation-safety.test.ts`
- `stocky-plus/scripts/tenant-enforcement/manifest.ts`
- `stocky-plus/scripts/tenant-enforcement/roles.ts`
- `stocky-plus/scripts/sync-control-plane/roles.ts`
- `stocky-plus/scripts/sync-control-plane/tests/sync-role-isolation.test.ts`
- `stocky-plus/scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts`
- `stocky-plus/scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`
- `stocky-plus/app/tenant/models.ts`
- `stocky-plus/app/tenant/selectors.ts`
- `stocky-plus/app/tenant/relations.ts`
- `stocky-plus/app/tenant/legacy-scope.ts`
- `stocky-plus/app/tenant/tenant-db.server.ts`
- `stocky-plus/app/tenant/__tests__/tenant-db.test.ts`
- `stocky-plus/app/tenant/__tests__/db-isolation/isolation.test.ts`
- `stocky-plus/app/tenant/__tests__/top-level-unique-selectors.test.ts`
- `stocky-plus/scripts/tenant-access/allowlist.ts`
- `stocky-plus/scripts/tenant-access/architecture-audit.test.ts`
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`
- `stocky-plus/docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md`

Navigation / this report:

- `stocky-plus/docs/README.md`
- `stocky-plus/docs/phases/phase-1/README.md`
- `stocky-plus/docs/phases/phase-1/PR6_A_FOUNDATION_IMPLEMENTATION_REPORT.md`

Authority/control records (`PROJECT_STATUS.md`, `DECISIONS.md`, `RISK_REGISTER.md`,
and the PR6-A authorization rows in `phases/phase-1/README.md`) live in the
separate first commit `ea5830b159709e207827bc6f03ae55eafa49943b`.

## 9. Risks addressed by PR6-A

Opened as R-166…R-185 from approved plan §21.1. PR6-A addresses foundation
portions of R-166, R-167, R-168, R-169, R-171, R-172, R-173, R-174, R-176,
R-177, R-179, R-181, R-182, R-183, and R-184. Those rows remain OPEN until
independent review and later lanes close them with evidence.

PR6-A does **not** close R-170 (webhook/import), R-175 (C apply races),
R-178 (B Admin reads), R-180 (C money apply), or R-185 (B/C/D review).

## 10. Accepted planning P3s carried forward

- Final planning P3: potential refund-money reconciliation diagnostic noise on
  unsettled/failed transactions — later money/applicator work.
- PO-11 gitignored-codegen provenance note.

Neither required a PR6-A architecture change.

## 11. Explicit non-authorizations

Not implemented and not authorized:

- PR6-B Admin GraphQL / `app/types/**` / webhook/import runtime
- PR6-C canonical applicator
- PR6-D
- GraphQL production documents
- `shopify.app.toml` scope changes
- `read_all_orders` / `write_orders`
- Shopify Admin reads or writes
- inventory writes
- forecasting / ABC/U / buying / replenishment / PO / receiving
- production, deployment, feature-flag enablement

## 12. Correction package — F-CLAUDE-PR6A-01 through F-CLAUDE-PR6A-04

Authority: ChatGPT PR6-A foundation **correction** on existing PR [#37](https://github.com/Vedang1998/Stocky/pull/37). Not PR6-B/C/D. No D-055.

| Item | Value |
| --- | --- |
| Reviewed implementation head | `5f8b2e764ce947d6e15edb7f85496bdcc5567161` |
| Required main / merge base | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` |
| Independent review source branch | `claude/pr37-order-refund-review-6vbcw3` |
| Review integration commit | `fcf4b5c08eef3c3984acddccaee7e804daa6d2c4` (fast-forward only; one parent = reviewed head) |
| Immutable review artifact | `PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md` |
| Required / observed review blob | `198e55548a2ca09942843798a9ebd3e03a30d0fa` |
| Independent verdict (immutable) | **CORRECTIONS REQUIRED** — P0=0 / P1=0 / P2=1 / P3=3 |
| Correction implementation commit | `917080a3df47eb932e10b865bb4a7b018a5e7482` |
| Successor migration | `prisma/migrations/20260907020000_pr6_a_order_refund_existence_coherence/` |
| Historical exact-head CI on reviewed head | run `34076176876` SUCCESS — Classify `101602624958`, Heavy `101602650259`, CI Gate `101611637464`. Becomes historical after the correction push. |

Planning-review blobs preserved (never edited):

| Artifact | Blob |
| --- | --- |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md` | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` |
| `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` | `fca2b260d03e3105782ed216f7773c53e6aef2a7` |
| `PR6_CURRENT_MAIN_FINAL_INDEPENDENT_REVIEW.md` | `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` |

### 12.1 Finding dispositions

Reported severities are unchanged. Candidate issues the review independently cleared are not reopened.

| Finding | Severity | Disposition |
| --- | --- | --- |
| F-CLAUDE-PR6A-01 | P2 | **Corrected** — eight-table existence-coherence CHECKs in successor migration `20260907020000_pr6_a_order_refund_existence_coherence`. Pending independent confirmation of the PR6-A representability half of R-176. |
| F-CLAUDE-PR6A-02 | P3 | **Corrected** — `ORDER_REQUIRED_MONEY_BAGS` matches plan §6.3 literally; refund-shipping sides use `MoneyBagSides`. |
| F-CLAUDE-PR6A-03 | P3 | **Corrected** — unit / history-access / existence diagnostic constants match approved §8; `INACCESSIBLE_HISTORY_WINDOW` remains an existenceKind. |
| F-CLAUDE-PR6A-04 | P3 | **Corrected** — `evaluateShopColumnCoverage` in control-plane verifier; unclassified Shop columns fail closed. No auto-grant. |

### 12.2 Order-domain state / kind / evidence matrix (F-CLAUDE-PR6A-01)

Baseline: PR5 `ShopifyProductFact_existence_evidence_coherence_check`, adapted to PR6 history-window and unverified-delete kinds. Constraint suffix is `_existence_coherence_check` because PR5’s `_existence_evidence_coherence_check` exceeds PostgreSQL `NAMEDATALEN=63` on several order tables.

Any represented request/response interval is a coherent pair: both gens NULL **or** both NOT NULL and `requestGen < responseGen`. Predicates use `IS NULL` / `IS NOT NULL` / `IS NOT DISTINCT FROM` so SQL UNKNOWN cannot pass an intended rejection.

| existenceKind | existenceState | gens | deletedAt | deletionSource |
| --- | --- | --- | --- | --- |
| `LIVE_FULL_SYNC_PRESENT` | LIVE | NULL / NULL | NULL | NULL. Full-sync fence evidence stays on `SyncRun`; no fabricated direct refetch interval. |
| `LIVE_REFETCH` | LIVE | both non-null, request < response | NULL | NULL |
| `ABSENT_CONFIRMED_QUERY` | ABSENT | both non-null, request < response | NOT NULL | `CONFIRMED_QUERY` |
| `INACCESSIBLE_HISTORY_WINDOW` | LIVE or ABSENT (prior state preserved) | NULL/NULL or a coherent pair | NULL | NULL. Must not introduce a tombstone from loss of access. |
| `ABSENT_SIGNALLED_DELETE_UNVERIFIED` | ABSENT | NULL/NULL or a coherent pair | NOT NULL | `WEBHOOK` (accepted encoding of `DELETE_WEBHOOK` sourceKind lineage). Does not require a confirmation interval. |

`OrderFactObservationInFlight` is not a canonical fact table; its lifecycle/lease checks are unchanged.

**Preservation clarification (application-layer, not proven by CHECK):** an inaccessible later observation must not erase a prior confirmed tombstone or reclassify it as ordinary reversible window uncertainty. Retain the existing confirmed/unverified-delete kind, deletion lineage, and supporting evidence; record new access uncertainty on existing diagnostic/observation fields (`existenceDiagnosticState`, `historyWindowState`). Do not “fix” an incompatible row by clearing evidence. This implements plan §8’s preservation rule without adding columns or implementing PR6-C.

CHECK boundaries: a row CHECK protects representability, not the entire transition. It cannot prove a previous state, Shopify query completion, historical scope continuity, or the two-confirmation revival protocol. Those remain PR6-C/D obligations. No wall-clock or external-table lookups.

Parent-versioned children remain representable under complete accepted parent-snapshot evidence (child `LIVE_FULL_SYNC_PRESENT` with NULL/NULL gens beside a parent `LIVE_REFETCH`).

### 12.3 Eight-table constraint identity (live disposable PostgreSQL after successor)

All eight constraints exist and `convalidated=true`:

- `ShopifyOrderFact_existence_coherence_check`
- `ShopifyOrderLineFact_existence_coherence_check`
- `ShopifyOrderRefundFact_existence_coherence_check`
- `ShopifyOrderRefundLineFact_existence_coherence_check`
- `ShopifyOrderAdjustmentFact_existence_coherence_check`
- `ShopifyOrderAgreementFact_existence_coherence_check`
- `ShopifyOrderAgreementSaleFact_existence_coherence_check`
- `ShopifyOrderRefundTransactionFact_existence_coherence_check`

Migration safety: `lock_timeout='5s'`, `statement_timeout='30s'`; `ADD CHECK … NOT VALID` then `VALIDATE CONSTRAINT` in deterministic table order. Not claimed lock-free.

### 12.4 Fixture repair

`pr6-a-order-fact-foundation.test.ts` seeded `'LIVE', 'LIVE_REFETCH'` **without** generation columns. That combination is newly unrepresentable. `LINEAGE_VALUES` now seeds `'LIVE', 'LIVE_FULL_SYNC_PRESENT', NULL, NULL, 'FULL_SYNC'`. Tests were not deleted; expected failures were not weakened.

### 12.5 Local correction validation

Environment: disposable local PostgreSQL 16 + Redis. No production connection. Inventory-write flags remain false. `productionDataInspected=false`.

| Check | Result |
| --- | --- |
| `npx prisma validate` | exit 0 — schema valid |
| `npx prisma generate` | exit 0 — Prisma Client v6.19.3 |
| `npx vitest run app/lib/order-facts/{types,lock-key,foundation-safety}.test.ts app/lib/catalog-facts/lock-key.test.ts` | **24 passed** / 4 files. PR5 lock known-answers unchanged. |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run graphql-codegen` | exit 0 |
| `npm test -- --passWithNoTests false` | **392 passed** / 42 files (codegen materialized first; not the known missing-codegen failure set) |
| `npm run build` | exit 0 |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts` | **22 passed** |
| Coherence INSERT rejects | **192** = 8 tables × 12 invalid scenarios × 2 roles (owner + tenant runtime). SQLSTATE `23514`, named `_existence_coherence_check`. |
| Coherence UPDATE rejects | **192** (same matrix) |
| Coherence positive inserts | **128** = 8 tables × 8 legitimate kinds × 2 roles, including full-sync NULL/NULL |
| Retained-history / parent-versioned child | LIVE→inaccessible without tombstone; confirmed ABSENT keeps `ABSENT_CONFIRMED_QUERY` + gens + `CONFIRMED_QUERY` while diagnostics change; out-of-window unverified delete retained; child `LIVE_FULL_SYNC_PRESENT` NULL gens under parent `LIVE_REFETCH` |
| Shop unclassified-column guard | disposable `ALTER TABLE Shop ADD COLUMN "pr6aUnclassifiedGuardCol"` → `shop_column_unclassified:pr6aUnclassifiedGuardCol` → `ROLLBACK`; privileges remain SELECT on 11 columns, UPDATE on 9 lifecycle columns only |
| `tenant-expansion.migration.test.ts` | **9 passed**. Valid seeded `LIVE_FULL_SYNC_PRESENT` row survives successor unchanged. Invalid `LIVE_REFETCH` without gens fails `VALIDATE` naming `ShopifyOrderFact_existence_coherence_check`; row not deleted or coerced; after delete, successor deploys. |
| `sequence-privilege.test.ts` | **2 passed** |
| `exact-privilege-allowlist.test.ts` | **2 passed** |
| `exact-privilege-complete-matrix.test.ts` | **27 passed** |
| `definition-drift.test.ts` | **11 passed** |
| `scripts/tenant-indexes/tests/schema-drift.migration.test.ts` | **3 passed** |
| `test:sync-role-isolation` | **10 passed** |
| `test:sync-uninstall` | **8 passed** |
| `sync-control-plane.integration.test.ts` | **17 passed** |
| `isolation.test.ts` | **14 passed** |
| `tenant-db.test.ts` | **17 passed** |
| `top-level-unique-selectors.test.ts` | **7 passed** |
| `architecture-audit.test.ts` | **25 passed** |
| Fresh `prisma migrate deploy` after `DROP SCHEMA public CASCADE` | **22** migrations applied, including `20260907010000_pr6_a_order_refund_fact_foundation` then `20260907020000_pr6_a_order_refund_existence_coherence`. exit 0 |
| `tenant:indexes:apply` / `verify` | exit 0 |
| `tenant:schema:drift` on migrated+indexed (pre-enforcement) DB | `tenant_prisma_schema_drift_ok`, exit 0 |
| `tenant:enforcement:preflight` | ok; `merchantTableCount` **35**; `productionDataInspected` false |
| `tenant:enforcement:apply -- --apply` | ok; 290/290 steps completed |
| `tenant:roles:verify` / `tenant:rls:verify` / `tenant:immutability:verify` / `tenant:enforcement:verify` / `tenant:enforcement:drift` | each `ok:true`, issues `[]`, exit 0 |
| `sync:roles:provision -- --apply` / `sync:roles:verify` | exit 0; verifier `errors: []` |
| `tenant:access:audit` | `tenant_access_audit_ok`; 0 violations |
| `tenant:access:inventory` | 1741 findings, 0 violations (was 1734; `roles.ts` line-anchor shift) |
| `tenant:access:inventory:check` | `tenant_access_inventory_fresh` |
| `tenant:enforcement:inventory:check` | fresh (PR3 inventory unchanged) |
| `sync:inventory:check` | ok surfaces=48 |
| `git diff --check` | exit 0 |

Note: `tenant:schema:drift` was first executed against a database left drifted by `schema-drift.migration.test.ts` and failed as unexpected drift. After a disposable `DROP SCHEMA public CASCADE` + migrate + indexes, the same command passed. Do not treat the first drifted-DB failure as schema/migration defect.

### 12.6 Remaining C/D obligations and risks

R-176 remains **OPEN** at P0. This package implements PR6-A **representability** (kinds + CHECK matrix) pending independent confirmation. It does **not** close PR6-C/D window-apply, two-confirmation revival, webhook/import, or reconcile obligations.

Other R-166…R-185 statuses and severities are unchanged.

PR6-B / PR6-C / PR6-D remain **NOT AUTHORIZED**. Production, Shopify calls, inventory writes, feature-flag enablement, `read_all_orders`, and `write_orders` remain unauthorized.
