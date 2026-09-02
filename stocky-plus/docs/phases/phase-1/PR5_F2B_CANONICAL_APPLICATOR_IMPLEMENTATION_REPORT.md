# Phase 1 PR5-F2B — Canonical Fact Applicator Implementation Report

**Slice:** PR5-F2B canonical merchant-fact applicator
**Branch:** `cursor/pr5-f2b-canonical-applicator-055c`
**Authority:** D-054 **EFFECTIVE**; PR5-F1 foundation **FROZEN**
**Status:** First independent-review correction package technically accepted. F2A-main merge preparation appended in §17. Pending exact-head full CI, then ChatGPT merge authorization. Do not ask Claude from this lane.
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**Shopify network I/O in this lane:** NONE

This report records the PR5-F2B applicator implementation. It does **not** claim PR 5 is complete. It does **not** start webhook, bulk/JSONL, compatibility-projection, F2C, or PR 6 work. ChatGPT technically accepted the correction package; merge is **not** authorized in this refresh.

---

## 1. Verified main / exact base SHA

`origin/main` = `5129707ee684e66cadcf96b976e16eb57385a7cb`

Authorized exact base for this lane: `5129707ee684e66cadcf96b976e16eb57385a7cb`.

## 2. Starting branch SHA

Branch `cursor/pr5-f2b-canonical-applicator-055c` was created from that exact base. Pre-edit worktree was clean on that SHA.

## 3. Runtime / test implementation head

Original applicator runtime: `19a97af201aaa4a7a0459cc1302485cb2371a33a`

Correction runtime: `0e39349c09c83c1c690a931fb8c97d4cb01f1eea` — bind request generation, unique-conflict fresh-transaction retry, relationship equality, unseen-ABSENT preserve-no-row, foundation-safety revert.

Correction tests after PostgreSQL alignment: `1b847b90ea631655e5bce02d0086156f3088e527`

Last runtime/test implementation commit before this documentation update: `bf399edc106742758031a7fd366871d265057f26` — unique-conflict test `$queryRaw` tagged-template forwarding.

A later documentation commit on the same branch may exist; it must not be treated as a runtime change. This report does not embed its own commit SHA.

## 4. Files changed

Allowed-path implementation:

- `stocky-plus/app/lib/catalog-facts/apply/**` (new apply module)
- `stocky-plus/app/lib/catalog-facts/index.ts` (exports)
- `stocky-plus/app/lib/catalog-facts/lock-capacity.ts` (R-162 safe-integer fail-closed)
- `stocky-plus/app/lib/catalog-facts/lock-capacity.test.ts`
- `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` — **reverted to authorized base** `5129707ee684e66cadcf96b976e16eb57385a7cb` (F2A owns recursive / semantic PR5 read-boundary safety; F2B lane-local apply safety remains in `apply/apply-safety.test.ts`)
- `stocky-plus/scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts`
- `stocky-plus/docs/phases/phase-1/PR5_F2B_CANONICAL_APPLICATOR_IMPLEMENTATION_REPORT.md` (this report)

Shared-file mechanical exception (required for `tenant:access:inventory:check`):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` — new `app/lib/catalog-facts/apply/**` and focused test files raised `scannedFiles` from 258 to 270. Findings stayed 1408, violations stayed 0, content digest unchanged (`4670755fc5d481b42efd04705d4e26fc60b2cf20a06197ebb5cb2e24979e2ba5`).

**Not changed:** Prisma schema, foundation migration, feature flags, webhook handlers, GraphQL, JSONL, SyncRun checkpoints, compatibility projection, legacy caches, forecast/ABC, inventory-write flags. `allowlist.ts` was not modified.

## 5. What the applicator does

`applyCanonicalFacts(db, input)` applies already-authoritative observations inside an open tenant transaction. The caller owns COMMIT/ROLLBACK. There is no Shopify network I/O.

Supported identities: Product, ProductVariant, InventoryItem, Location, InventoryLevel.

Universal serialization: every writer acquires `pg_advisory_xact_lock(key1, key2)` via the frozen `acquireCanonicalIdentityAdvisoryLock` primitive, in deterministic ascending `(key1, key2)` order, before first insert, update, tombstone, revival, InventoryLevel pair writes, diagnostic writes, or batch apply. `SELECT FOR UPDATE` is secondary when the row exists. Unique conflict despite the anchor retries the full apply algorithm (no `ON CONFLICT DO UPDATE` correctness shortcut).

## 6. Primary gates

| Gate | Implementation |
|---|---|
| R-157 | Applicator does not call `setval`. Direct observations persist caller-allocated `nextval` generations. Apply-module source scan forbids `setval(`. |
| R-158 | Clock B uses closed observation intervals, not response-gen LWW. Overlapping LIVE vs ABSENT preserves last unambiguous existence and records `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`. |
| R-159 | Direct apply requires a token. Final fence uses PostgreSQL `clock_timestamp()`. Expired observations cannot apply and are durably `ACTIVE → ABANDONED` in the same tenant transaction. `ABANDONED` never returns to `ACTIVE`. Missing token fails closed. Earlier-or-equal ACTIVE resultless rows block existence mutation. |
| R-160 | Advisory identity lock is acquired for every identity in the batch before any fact write, including first insert. |
| R-161 | Batch size is capped by `evaluateCanonicalLockCapacity` against live PostgreSQL settings. Default envelope remains 32; this lane does not raise PostgreSQL settings. Deployment/concurrency capacity evidence remains OPEN. |
| R-162 | **Resolved in this lane.** Direct evaluator inputs require `Number.isSafeInteger`. Derived `sharedLockObjectBudget` fail-closes if the product is not a safe integer. |
| R-164 | **Mandatory lane gate.** Ordinary apply APIs export no physical-delete operation. Writers are INSERT/UPDATE only. Source scan forbids `deleteMany` and `DELETE FROM` canonical fact tables. RLS is unchanged. |

## 7. Clock / existence / money

- Clock A: Shopify `updatedAt` wins when both sides are versioned.
- Nullable-version fallback implements §6.F.9 interval overlap / non-overlapping-later rules. No arrival-order last-writer-wins.
- Existence kinds: `LIVE_FULL_SYNC_PRESENT`, `LIVE_REFETCH`, `ABSENT_CONFIRMED_QUERY`. `ABSENT_FULL_SYNC_SWEEP` is rejected. Full-sync presence may advance `lastSeenFullSyncRunId` when attributes no-op. `LIVE_FULL_SYNC_PRESENT` stores NULL/NULL existence gens.
- Tombstones require `ABSENT_CONFIRMED_QUERY`. No physical delete of canonical facts.
- Terminal Product / ProductVariant / InventoryItem / Location revival requires two independent non-overlapping LIVE confirmations (`second.requestGen > first.responseGen`) and matching `createdAt` when both are present. InventoryLevel is reconnectable (exemption).
- Eight inventory quantity names apply independently with per-name `updatedAt` / null-version generation fallback.
- `priceAmount`, `compareAtPriceAmount`, `unitCostAmount` stay exact decimal text / Decimal-like. `Number` / `parseFloat` are rejected.

## 8. Local validation (executed)

Environment: disposable PostgreSQL **16.14** (`stocky` / `stocky_plus` on localhost:5432), Redis 7, Node for this agent. Inventory-write flags were not changed.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | executed and passed |
| `npx eslint --ignore-path .gitignore app/lib/catalog-facts scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | executed and passed |
| `git diff --check` | 0 | executed and passed |
| `npm test -- app/lib/catalog-facts` | 0 | **34** passed / 5 files |
| `npm test` | 0 | **90** passed / 11 files |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **19** passed / 1 file |
| Post-scanner-fix `npm run tenant:access:audit` | 0 | `scannedFiles: 270`, `findings: 1408`, `violations: 0` |
| Post-scanner-fix `npx vitest run scripts/tenant-access/architecture-audit.test.ts --config vitest.tenant-access.config.ts` | 0 | **25** passed / 1 file |
| Post-scanner-fix `npm test -- app/lib/catalog-facts` | 0 | **34** passed / 5 files |
| Post-scanner-fix focused PG tests (`first-inserts a Product` / `fails closed on a missing observation token`) | 0 | **2** passed / 17 skipped |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| Full `npm run test:migrations` (entire tenant-enforcement corpus) | — | **not executed locally**; required on exact-head full CI |
| `npm run lint` (repo-wide) | — | **not executed**; focused eslint on changed paths passed |
| `npm run typecheck` (`react-router typegen && tsc`) | — | `tsc --noEmit` executed and passed; typegen **not executed** locally |

### PostgreSQL applicator races executed (19)

first insert; overlapping agreeing; overlapping conflicting attributes; overlapping LIVE vs ABSENT existence; concurrent first insert; stale bulk vs newer direct + presence; missing token; lease expiry + durable abandonment; ABANDONED token after clock-rollback-class (Race AS); multiple blockers (Race AQ); terminal revival one / overlapping / valid second; InventoryLevel reconnect; per-name quantity ordering + money text; null `updatedAt`; capacity fail-closed (Race AW); rollback; cross-shop tenant mismatch + R-164 surface; deterministic multi-lock order; waiter vs holder advisory lock.

## 9. Risk status after this slice

| Risk | Status |
|---|---|
| R-157 | **OPEN** — applicator does not reset the sequence; remain OPEN until ChatGPT closes the PR5 allocation-path set |
| R-158 | **OPEN** — engine implemented; remain OPEN until independent review / ChatGPT close |
| R-159 | **OPEN** — fencing implemented; remain OPEN until independent review / ChatGPT close |
| R-160 | **OPEN** — every writer in this lane uses the advisory anchor; remain OPEN until independent review / ChatGPT close |
| R-161 | **OPEN** — evaluator consumed; PostgreSQL settings not increased; deployment capacity evidence still required |
| R-162 | **Implemented in this lane** — pending independent verification / ChatGPT close |
| R-164 | **Implemented in this lane as a mandatory acceptance gate** — pending independent verification / ChatGPT close |

## 10. Explicit non-authorization

- Production remains **NOT AUTHORIZED**.
- Merchant production data remains **NOT AUTHORIZED**.
- Shopify inventory mutations remain **NOT AUTHORIZED**.
- Every inventory-write flag remains **DEFAULT OFF**.
- No D-055.
- No PR 6.
- No webhook / bulk JSONL / compatibility-projection lane started.

## 11. Exact-head CI

Pre-correction exact-head `pull_request` run [`32081388735`](https://github.com/Vedang1998/Stocky/actions/runs/32081388735) SUCCESS on `f976eae3eec19eb910690a4fa03b884b7a004088` is **superseded** by this correction package.

Corrected exact-head CI is recorded after this documentation commit is pushed. This report does not embed an unknown future SHA or run id.

## 12. Next action

Return to ChatGPT for PR5-F2B **second correction** review after exact-head full CI is green. Do **not** merge. Do **not** mark the PR ready. Do **not** ask Claude. Do **not** start webhook or bulk integration.

## 13. Pre-independent-review correction package

Correction starting identity: PR head `f976eae3eec19eb910690a4fa03b884b7a004088` on `cursor/pr5-f2b-canonical-applicator-055c` (PR #31 DRAFT). Authorized base remained `5129707ee684e66cadcf96b976e16eb57385a7cb`. No schema or F1 migration changes.

### Correction A — durable token / request-generation binding

`fenceDirectObservation` loads the `CatalogObservationInFlight` row by shopId + token + canonical identity, then fail-closes with `CanonicalApplyRequestGenerationMismatchError` (`canonical_apply_request_generation_mismatch`) when persisted `observationRequestGen` ≠ caller `observationRequestGen`. Mismatch is **not** `CanonicalApplyLeaseInvalidError`, so the own-abandonment path does not rewrite a legitimate ACTIVE row.

Required fence before fact application:

- exact shopId, identity, token
- persisted `observationRequestGen` == expected
- ACTIVE, `observationResponseGen IS NULL`
- `clock_timestamp() < leaseExpiresAt`

`completeObservation` requires `responseGen > expectedRequestGen` and conditions the UPDATE on the exact expected request generation, `responseGen > observationRequestGen`, ACTIVE, resultless, and a valid lease. `abandonOwnExpiredObservation` also conditions on the exact expected request generation and does not throw on zero rows.

Disposable PostgreSQL proofs (all executed, exit 0):

1. valid ACTIVE token + wrong caller requestGen → `CanonicalApplyRequestGenerationMismatchError`; no canonical insert; durable row stays ACTIVE / resultless
2. fabricated earlier requestGen cannot rewrite overlap ordering (LIVE title preserved; token stays ACTIVE)
3. fabricated later requestGen cannot bypass blocker / tombstone semantics (stays LIVE; token stays ACTIVE)
4. `completeObservation` with wrong expected requestGen → completion fence failed; stays ACTIVE
5. `responseGen <= durable requestGen` → `CanonicalApplyError` `canonical_apply_interval_invalid`; stays ACTIVE
6. matched-token happy path still applies and completes

### Correction B — PostgreSQL unique-conflict retry boundary

`insertFact` still converts `23505` to `CanonicalApplyUniqueConflictError`. `applyOneObservation` no longer catches that error to `continue` inside the same transaction. The typed error escapes; the caller rolls back; `applyCanonicalFactsWithRetry` invokes `begin` again, which **must** start a fresh transaction. No `ON CONFLICT DO UPDATE`. No savepoint.

Disposable PostgreSQL proofs:

- Forced unique conflict (seeded LIVE row + first `SELECT … FOR UPDATE` hidden) throws `CanonicalApplyUniqueConflictError`; the next `SELECT 1` on the same client is SQLSTATE `25P02`; ROLLBACK leaves title `Original` and the token ACTIVE. No SQL retry in the aborted transaction.
- `applyCanonicalFactsWithRetry` with a `begin` that increments a counter: `beginCount === 2`; second attempt sees the row, re-runs lock/decisions, applies newer `updatedAt` title `Retry`, and completes the token.

### Correction C — relationship identity in attribute equality

`variantAttributesEqual` compares `shopifyProductGid`. `inventoryItemAttributesEqual` compares `shopifyVariantGid`. `mapSnapshot` already projected both columns. Composite FK / RLS unchanged.

Disposable PostgreSQL proofs for ProductVariant / InventoryItem:

- same Shopify `updatedAt` + different parent GID → not equal; old parent preserved; `EQUAL_VERSION_CONFLICT`
- newer Shopify `updatedAt` + changed parent GID applies through tenant composite FK
- overlapping null-version observations with differing parent GID → `CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT`; old parent preserved

### Correction D — parallel-lane ownership

`stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` matches authorized base `5129707ee684e66cadcf96b976e16eb57385a7cb` (git diff empty). F2A owns recursive / semantic PR5 read-boundary safety. F2B keep lane-local apply safety in `apply/apply-safety.test.ts`. F2A implementation was not copied.

`PR2_TENANT_ACCESS_INVENTORY.md` did not need regeneration after the tagged-template forwarding fix (`scannedFiles` 270, findings 1408, violations 0).

### first_insert_absent disposition (all five resource kinds)

Brief §6.F.2.2 first-insert may **preserve no canonical row**. Frozen schema requires NOT NULL live columns and/or parent composite FKs:

| Kind | Why unseen ABSENT cannot insert without fabricating values |
|---|---|
| Product | `title`, `handle`, `status` NOT NULL |
| ProductVariant | `shopifyProductGid` NOT NULL + composite FK to product fact; also `title`, `selectedOptions`, `priceAmount`, `currencyCode` |
| InventoryItem | `tracked`, `requiresShipping`, `unitCostAccess` NOT NULL |
| Location | `name` and several NOT NULL booleans |
| InventoryLevel | composite FKs to item + location facts |

Approved applicator behavior: unseen `ABSENT_CONFIRMED_QUERY` returns `{ mutate: false, reason: "first_insert_absent_preserve_no_row" }`. Tombstone remains an **UPDATE** of an already-inserted fact. Later LIVE of a never-seen GID is first-insert LIVE, not terminal revival. Unit tests cover all five kinds; disposable PostgreSQL test applies ABSENT with **no** fabricated attributes and proves zero fact rows plus COMPLETED observations (`noop`). Schema/F1 migration were not changed.

### Correction local validation (executed)

Environment: disposable PostgreSQL **16.14**, Redis 7, Node for this agent. Inventory-write flags were not changed.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | executed and passed |
| `npm run typecheck` | 0 | executed and passed |
| `npx eslint --ignore-path .gitignore app/lib/catalog-facts scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | executed and passed |
| `npm run lint` | 0 | executed and passed |
| `git diff --check` | 0 | executed and passed |
| `npm test -- app/lib/catalog-facts` | 0 | **39** passed / 5 files |
| `npm test` | 0 | **95** passed / 11 files |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **34** passed / 1 file |
| Unique-conflict name filter after tagged-template fix | 0 | **2** passed / 32 skipped |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 270`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory:check` | 0 | fresh |
| `npx vitest run scripts/tenant-access/architecture-audit.test.ts --config vitest.tenant-access.config.ts` | 0 | **25** passed / 1 file |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| Full `npm run test:migrations` (entire tenant-enforcement corpus) | — | **not executed locally**; required on exact-head full CI |

No Prisma schema, foundation migration, Shopify network, GraphQL, webhooks, JSONL, feature flags, or inventory-write enablement in this correction.

## 14. Second pre-independent-review correction package

This package does **not** reopen the accepted first correction package in §13. It addresses three newly discovered P1 defects only.

Second-correction starting identity: PR head `06d6feb87a9c5444557d3c8e086ea807a86549b0` on `cursor/pr5-f2b-canonical-applicator-055c` (PR #31 OPEN / DRAFT / unmerged). Authorized base remained `5129707ee684e66cadcf96b976e16eb57385a7cb`. No schema or F1 migration changes.

### 14.1 Distinction from the accepted first package

| Package | Head recorded here | Scope |
|---|---|---|
| First (accepted) | runtime/test `bf399edc106742758031a7fd366871d265057f26`; docs `06d6feb87a9c5444557d3c8e086ea807a86549b0` | Request-generation binding; unique-conflict fresh `begin()`; relationship GID equality; unseen-ABSENT preserve-no-row; foundation-safety revert; R-162; R-164 |
| Second (this pass) | runtime/test `65530433e7250ae5f8dca12d4d82f95dff4dec70`; inventory `7201adcc99614628655829af6b4dba0c16e84a81` | First-insert overlap fail-closed; exact DECIMAL(20,6) equality; first-LIVE attribute contract |

A later documentation commit on the same branch may exist after this section is written. This report does not embed that commit’s own SHA.

Preserved first-package behavior (regression-tested on disposable PostgreSQL in this pass):

- durable token + exact persisted request generation; mismatch fails closed without abandoning the valid ACTIVE row
- unique conflict escapes the aborted transaction; fresh `begin()`; no `ON CONFLICT DO UPDATE`; no 25P02 masking
- ProductVariant `shopifyProductGid` and InventoryItem `shopifyVariantGid` participate in equality
- unseen ABSENT preserves no canonical row
- R-162 `Number.isSafeInteger` fail-closed (unit)
- R-164 ordinary apply APIs still export no physical-delete operation
- `foundation-safety.test.ts` remains byte-identical to `5129707ee684e66cadcf96b976e16eb57385a7cb`

### 14.2 Correction A — first-insert overlap fail-closed

`decideExistence()` no longer first-inserts LIVE when `overlappingCompleted` is non-empty. With no stored canonical row, any overlapping completed authoritative direct interval returns `{ mutate: false, reason: "first_insert_overlapping_completed", diagnostic: CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT }` for both incoming LIVE and ABSENT. No-row is not treated as proof that the completed observation agreed with the incoming result.

A later non-overlapping LIVE (`incoming.requestGen > prior.responseGen`, so the completed interval is not overlapping) may first-insert. This is not a permanent identity freeze.

Race AT concurrent first insert of a nonexistent identity is serialized by the advisory identity lock and results in **zero or one** coherent LIVE row, never a blind overwrite. Zero rows is an allowed overlap fail-closed outcome; a later non-overlapping LIVE refetch may insert.

### 14.3 Correction B — exact NUMERIC / Decimal equality

`exactNumericEqual()` is the single applicator helper. It rejects JavaScript `Number`, canonicalizes exact decimal text (trailing zeros insignificant; `-0` equals `0` per PostgreSQL NUMERIC), then compares with `Prisma.Decimal.eq`. Used for ProductVariant `priceAmount` / `compareAtPriceAmount` and InventoryItem `unitCostAmount` / `weightValue`.

Frozen F1 columns remain `DECIMAL(20,6)`. `assertFrozenNumericColumn()` fail-closes before write when significant fractional digits exceed scale 6 or integer digits exceed 14. Trailing zeros beyond scale 6 are accepted only when the numeric value remains exactly representable (`"19.9900000"`). `"19.9900001"` is rejected. No schema change.

### 14.4 Correction C — no fabricated first-LIVE attributes

`validateFirstLiveAttributes()` runs **before INSERT**. Missing required LIVE fields produce typed `CanonicalApplyIncompleteFirstLiveError` (`canonical_apply_incomplete_first_live`) / diagnostic `INCOMPLETE_FIRST_LIVE_ATTRIBUTES`. Direct observations with a usable but incomplete payload are completed out of ACTIVE (`completeObservation`) with outcome `rejected` — no poison ACTIVE row and no placeholder canonical truth. Full-sync incomplete first-LIVE throws and does not count as a successful applied fact.

`insertFact()` no longer supplies `""`, `[]`, `{}`, `ACTIVE`, `USD`, `true`, or `NULL` unit-cost-access defaults. Existing-row existence-only / partial quantity updates remain allowed.

Required first-LIVE fields:

- Product: title, handle, tags array, valid status
- ProductVariant: shopifyProductGid, title, selectedOptions JSON, exact priceAmount, currencyCode
- InventoryItem: tracked, requiresShipping, valid unitCostAccess (shopifyVariantGid may be null)
- Location: name plus explicit isActive, fulfillsOnlineOrders, shipsInventory, isFulfillmentService, hasActiveInventory
- InventoryLevel: explicit isActive / connectivity; quantities remain independently partial; identity already supplies item+location GIDs

### 14.5 Second-correction local validation (executed)

Environment: disposable PostgreSQL **16.14**, Redis 7, Node v22.14.0 for this agent. Inventory-write flags were not changed. Commands below ran on implementation head `65530433e7250ae5f8dca12d4d82f95dff4dec70` except the inventory regeneration, which produced `7201adcc99614628655829af6b4dba0c16e84a81`.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | executed and passed |
| `npm run typecheck` | 0 | executed and passed |
| `npm run lint` | 0 | executed and passed |
| `git diff --check` | 0 | executed and passed |
| `npm test -- app/lib/catalog-facts` | 0 | **45** passed / 6 files |
| `npm test` | 0 | **101** passed / 12 files |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **46** passed / 1 file |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 272`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory` / `:check` | 0 | mechanical regen; content digest unchanged `4670755fc5d481b42efd04705d4e26fc60b2cf20a06197ebb5cb2e24979e2ba5` |
| `npx vitest run scripts/tenant-access/architecture-audit.test.ts --config vitest.tenant-access.config.ts` | 0 | **25** passed / 1 file |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| `git diff 5129707ee684e66cadcf96b976e16eb57385a7cb -- app/lib/catalog-facts/foundation-safety.test.ts` | 0 | empty (byte-identical to authorized base) |
| Full `npm run test:migrations` (entire tenant-enforcement corpus) | — | **not executed locally**; required on exact-head full CI |

### 14.6 PostgreSQL proofs in this pass (46)

First-package regressions remained green, including: request-generation mismatch; unique-conflict 25P02 + fresh begin; ProductVariant/InventoryItem relationship equality; unseen ABSENT preserve-no-row; overlapping stored-row LIVE vs ABSENT (Race AJ); concurrent first insert 0-or-1 (Race AT); R-164 surface.

New proofs:

1. Unseen ABSENT then overlapping LIVE → conflict, zero Product rows, LIVE token COMPLETED
2. Later non-overlapping LIVE (`reqC > max prior responseGen`) → exactly one LIVE row
3. Incomplete first-LIVE COMPLETED interval then overlapping complete LIVE → conflict, zero rows
4. Concurrent overlapping LIVE vs ABSENT first insert → 0 or 1 coherent LIVE row
5. Variant price `"19.99"` / compareAt `"0.1"` PostgreSQL scale-expanded readback → no `EQUAL_VERSION_CONFLICT`
6. True price difference `"19.98"` at equal `updatedAt` → `EQUAL_VERSION_CONFLICT`; stored 19.99 preserved
7. InventoryItem unitCost `"3.5"` / weight `"1.25"` scale-equivalent second observation → no `EQUAL_VERSION_CONFLICT`
8. Price `"19.9900001"` → rejected, zero variant rows, observation COMPLETED
9. Incomplete first-LIVE Product / ProductVariant / InventoryItem / Location / InventoryLevel → rejected, zero facts, observation not left ACTIVE
10. Complete Location/InventoryItem first-LIVE with explicit `false` booleans persists those values
11. Existence-only LIVE on an existing Product remains valid
12. Full-sync incomplete first-LIVE throws `CanonicalApplyIncompleteFirstLiveError`; zero rows

### 14.7 Risk status after this second package

Do **not** close risks from this lane.

| Risk | Status |
|---|---|
| R-157 | **OPEN** |
| R-158 | **OPEN** pending independent review |
| R-159 | **OPEN** pending independent review |
| R-160 | **OPEN** pending independent review |
| R-161 | **OPEN** — production/deployment capacity evidence still outstanding |
| R-162 | **Implemented** — pending independent review |
| R-164 | **Implemented** — pending independent review |

Exact-head `pull_request` CI for this second package is recorded after this documentation commit is pushed. This report does not embed an unknown future SHA or run id.

---

## 15. Third pre-independent-review correction package

This package does **not** reopen the accepted first or second correction packages. It fixes one P1 defect: full-sync fence-vs-direct-observation ordering.

Third-correction starting identity: PR head `0c7af8168d7a52c29c3fc03f8ede74c2d3cc9eb8` on `cursor/pr5-f2b-canonical-applicator-055c` (PR #31 OPEN / DRAFT / unmerged). Authorized base remained `5129707ee684e66cadcf96b976e16eb57385a7cb`. No schema or F1 migration changes.

### 15.1 Distinction from the accepted prior packages

| Package | Head recorded here | Scope |
|---|---|---|
| First (accepted) | runtime/test `bf399edc106742758031a7fd366871d265057f26`; docs `06d6feb87a9c5444557d3c8e086ea807a86549b0` | Request-generation binding; unique-conflict fresh `begin()`; relationship GID equality; unseen-ABSENT preserve-no-row; foundation-safety revert; R-162; R-164 |
| Second (accepted for this lane) | runtime/test `65530433e7250ae5f8dca12d4d82f95dff4dec70`; inventory `7201adcc99614628655829af6b4dba0c16e84a81`; docs `0c7af8168d7a52c29c3fc03f8ede74c2d3cc9eb8` | First-insert overlap fail-closed; exact DECIMAL(20,6) equality; first-LIVE attribute contract |
| Third (this pass) | runtime `acf073adb9521aab107af8851c45f915a26fab28`; tests `f6ddf00ce7351b45e0755b91ab52d0235f07b42f` plus spanning-test / inventory / this report on the same CI-producing head | Full-sync fence marker vs direct Clock-B interval |

A later documentation-only commit on the same branch must not be treated as this correction’s runtime head. This report does not embed its own commit SHA.

Preserved first- and second-package behavior (regression-tested on disposable PostgreSQL in this pass):

- durable token + exact persisted request generation
- unique conflict escapes the aborted transaction; fresh `begin()`; no `ON CONFLICT DO UPDATE`
- ProductVariant `shopifyProductGid` and InventoryItem `shopifyVariantGid` participate in equality
- unseen ABSENT preserves no canonical row
- first-insert overlapping completed evidence fail-closed
- exact DECIMAL equality and significant > DECIMAL(20,6) fail-closed
- complete first-LIVE attributes; no synthetic business defaults
- R-162 `Number.isSafeInteger` fail-closed (unit)
- R-164 ordinary apply APIs still export no physical-delete operation
- `foundation-safety.test.ts` remains byte-identical to `5129707ee684e66cadcf96b976e16eb57385a7cb`

### 15.2 Direct interval vs full-sync fence separation

Deleted `observationInterval()`. New named helpers:

- `directObservationInterval()` — Clock B `[observationRequestGen, observationResponseGen]`
- `fullSyncFenceGeneration()` — `{ kind: "full_sync_fence", fenceGeneration }`
- `fullSyncAttributeMarker()` — `{ kind: "full_sync_attribute_marker", fenceGeneration }`
- `nullableFallbackIntervalFromFullSyncMarker()` — point representation used **only** by nullable Clock A / per-name quantity fallback

Existence/fencing APIs no longer receive a synthetic `[F,F]` as if it were a direct request interval.

`LIVE_FULL_SYNC_PRESENT` still persists `existenceRequestGen = NULL` and `existenceResponseGen = NULL`. Fence evidence remains `SyncRun.fenceGeneration` / `lastSeenFullSyncRunId`.

Completed direct vs fence F:

- safely earlier only when `direct.observationResponseGen < F`
- `requestGen > F` is later
- `requestGen <= F` and `responseGen >= F` spans/overlaps F
- any completed direct with `responseGen >= F` is not safely earlier

When no canonical row exists, not-safely-earlier completed evidence fail-closes (conflict / refetch-required). Absence of a fact row is not agreement.

ACTIVE, unexpired, resultless directs for that identity block full-sync existence mutation whether they started before, around, or after F. Unexpired later directs are not abandoned to let older bulk proceed. Expired ACTIVE resultless rows may be durably `ACTIVE → ABANDONED` in the same tenant transaction using PostgreSQL `clock_timestamp()`; rollback restores them. Lease time is never compared to `fenceGeneration`.

Existing LIVE: full-sync may still advance `lastSeenFullSyncRunId` when existence/attributes cannot mutate.

Reconnectable ABSENT InventoryLevel: still requires `F >` stored absence `existenceResponseGen`, **and** no unresolved or newer/conflicting direct evidence.

Terminal GIDs: full-sync presence after tombstone remains `TERMINAL_IDENTITY_REVIVAL_CONFLICT`. Two-confirmation revival is unchanged.

### 15.3 Third-correction local validation (executed)

Environment: disposable PostgreSQL **16.14** (`stocky` / `stocky_plus` on localhost:5432), Redis 7, Node v22.14.0 for this agent. Inventory-write flags were not changed. Shopify network I/O was not performed.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | executed and passed |
| `npm run typecheck` | 0 | executed and passed |
| `npm run lint` | 0 | executed and passed |
| `git diff --check` | 0 | executed and passed |
| `npm test -- app/lib/catalog-facts` | 0 | **51** passed / 7 files |
| `npm test` | 0 | **107** passed / 13 files |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **59** passed / 1 file |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 274`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory` / `:check` | 0 | mechanical regen; content digest unchanged `4670755fc5d481b42efd04705d4e26fc60b2cf20a06197ebb5cb2e24979e2ba5` |
| `npx vitest run scripts/tenant-access/architecture-audit.test.ts --config vitest.tenant-access.config.ts` | 0 | **25** passed / 1 file |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| `git diff 5129707ee684e66cadcf96b976e16eb57385a7cb -- app/lib/catalog-facts/foundation-safety.test.ts` | 0 | empty (byte-identical to authorized base) |
| Full `npm run test:migrations` (entire tenant-enforcement corpus) | — | **not executed locally**; required on exact-head full CI |

### 15.4 PostgreSQL proofs in this pass (59)

Prior-package regressions remained green, including: request-generation mismatch; unique-conflict 25P02 + fresh begin; relationship equality; unseen ABSENT preserve-no-row; overlapping first-insert fail-closed; DECIMAL equality / scale fail-closed; first-LIVE validation; Race AT concurrent first insert 0-or-1; R-164 surface.

New / fence-correction proofs:

1. Full-sync first insert persists `LIVE_FULL_SYNC_PRESENT` with `existenceRequestGen=NULL`, `existenceResponseGen=NULL` (F1 coherence). Attribute fallback stores fence as the named bulk epoch marker only.
2. Race AT-3: fence F; later completed direct ABSENT leaves zero rows; late bulk LIVE at F does not first-insert; conflict / `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`.
3. Completed direct spanning F: no first insert; conflict.
4. Completed direct entirely earlier (`responseGen < F`): later full-sync LIVE with complete attributes first-inserts NULL/NULL.
5. ACTIVE unexpired direct started after F: no first insert; observation remains ACTIVE.
6. ACTIVE unexpired direct started before F: same blocked existence mutation.
7. Expired ACTIVE: same-transaction durable `ABANDONED` and first-insert proceeds; ROLLBACK restores `ACTIVE` and zero fact rows.
8. Existing LIVE + newer direct: `lastSeenFullSyncRunId` advances; stale bulk attributes do not win; existence gens remain the direct interval.
9. Reconnectable ABSENT InventoryLevel: newer completed direct blocks older full-sync reconnect; stays ABSENT.
10. Same InventoryLevel with only safely-earlier directs: later valid fence reconnects when `F >` absence `existenceResponseGen`; existence gens become NULL/NULL.
11. Terminal Product tombstone: bulk remains `TERMINAL_IDENTITY_REVIVAL_CONFLICT`; row stays ABSENT.
12. Nullable-version attributes: older full-sync fence marker does not overwrite a newer direct null-`updatedAt` title; presence still advances.
13. Nullable quantity: older full-sync fence marker does not overwrite a newer direct null-`updatedAt` available quantity; presence still advances.

### 15.5 Risk status after this third package

Do **not** close risks from this lane.

| Risk | Status |
|---|---|
| R-157 | **OPEN** |
| R-158 | **OPEN** pending independent review |
| R-159 | **OPEN** pending independent review |
| R-160 | **OPEN** pending independent review |
| R-161 | **OPEN** — production/deployment capacity evidence still outstanding |
| R-162 | **Implemented** — pending independent review |
| R-164 | **Implemented** — pending independent review |

Exact-head `pull_request` CI for this third package is recorded after this CI-producing head is pushed. This report does not embed an unknown future SHA or run id.

Run [`32100216617`](https://github.com/Vedang1998/Stocky/actions/runs/32100216617) SUCCESS on `0c7af8168d7a52c29c3fc03f8ede74c2d3cc9eb8` is **superseded**. Run [`32138453022`](https://github.com/Vedang1998/Stocky/actions/runs/32138453022) on pre-final `f6ddf00…` is **superseded** by the CI-producing head that includes this section.

## 16. First independent-review correction package (NEW-CLAUDE-PR5F2B-01..11)

Reviewed implementation head: `2abda4b13577355036683b6d92be852740530311`.

First independent-review correction runtime: `3148e46b7df706551ba907609fe486c61d93d449`.

First independent-review correction tests: `8674fd84fe06e6032e82213e0d75438f1a2628cf`.

A later documentation commit on the same branch may exist; it must not be treated as a runtime change. This report does not embed its own commit SHA.

Immutable Claude review artifact cherry-pick:

- Source commit: `7407cdc327ed89b6a13c101e65675a5be3191c13` (`claude/pr5-f2b-applicator-tier-a-review-rk327c`)
- Integrated commit: `35296cb00588da4965cf51bc40292b3f5136cd3a`
- Path: `stocky-plus/docs/phases/phase-1/PR5_F2B_CANONICAL_APPLICATOR_INDEPENDENT_REVIEW.md`
- Blob: `e3fe412180ddb6d5b79d9fa8c6d566e68433918a` (must remain byte-identical)

That cherry-pick added only the review artifact. This package does not edit it.

### 16.1 P2-01 / P2-02 — authoritative attribute completeness

Omission is not a patch. When a Product, ProductVariant, InventoryItem, or Location observation supplies resource `attributes`, the payload must be a complete authoritative snapshot of every canonical field this lane owns, including nullable properties present as explicit `null`.

- Missing property ≠ explicit null.
- Incomplete snapshots do not mutate any resource attributes.
- Direct observation on an **existing** fact: existence may still apply under Clock B; the attribute portion is rejected; the observation leaves `ACTIVE` (`COMPLETED`); the fact records `attributeFreshnessState = DEGRADED` and `INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`. Attribute clocks (`shopifyUpdatedAt`, `attributeRequestGen`, `attributeResponseGen`) do not advance.
- Full-sync incomplete canonical resource line: the merchant apply unit / transaction fails (`CanonicalApplyIncompleteAuthoritativeAttributesError` for existing rows; `CanonicalApplyIncompleteFirstLiveError` for first LIVE).
- Existence-only observations (`attributes` absent) remain valid on existing rows.
- InventoryLevel quantity-only payloads remain valid without pretending omitted resource attributes were observed.
- `InventoryItem.shopifyVariantGid` omission cannot clear the stored relationship. Explicit `null` keeps the approved nullable schema semantics. No schema migration.

Shared field-shape validator: `collectMissingAuthoritativeFields` / `validateResourceSnapshot` used by both first-LIVE (`INCOMPLETE_FIRST_LIVE_ATTRIBUTES`) and existing-row (`INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`) paths.

### 16.2 P2-03 — InventoryLevel Clock-A resource attributes

`shopifyInventoryLevelGid` and `isActive` now follow the same Clock-A / nullable-fallback rules as other resource attributes via `inventoryLevelAttributesEqual`, `updateInventoryLevelAttributes`, and an InventoryLevel branch in `applyAttributes`. Quantities remain independent per-name clocks. Quantity-only observations skip resource Clock-A. A resource-level InventoryLevel attribute object is completeness-checked when `isActive` or `shopifyInventoryLevelGid` is present.

PostgreSQL proofs: first LIVE `isActive=true`; newer `isActive=false` applies; stale does not rewind; equal-version same value is idempotent; equal-version different value conflicts; null-version vs stored versioned does not apply and records `CATALOG_NULL_VERSION_OBSERVATION` + `DEGRADED` without advancing the attribute interval; quantity-only does not null the stored GID.

### 16.3 P2-04 — durable rejection evidence

Existence and attributes are separate authority domains. A valid existence decision is not rolled back because resource attributes or numeric/quantity values are unusable.

Claude's scenario is proven in PostgreSQL: existing `LIVE_FULL_SYNC_PRESENT` variant → direct `LIVE_REFETCH` + unrepresentable price scale → existence becomes `LIVE_REFETCH`; old price and `[50,50]` attribute interval remain; fact is `DEGRADED` with `CANONICAL_NUMERIC_SCALE_UNREPRESENTABLE`; observation `COMPLETED`. Incomplete authoritative attributes on an existing Product follow the same durable-rejection shape.

`rejectUsableObservation` uses `preserveRevivalDiagnostic` so a terminal-revival diagnostic is not replaced incorrectly. Full-sync still fails the apply unit.

### 16.4 P3-05 — empty batch

After shop mismatch checks and tenant validation (`stocky.current_shop_id`), `observations: []` returns `{ results: [], identitiesLocked: 0, abandonedBlockerTokens: [] }` with no lock-capacity evaluation and no advisory lock acquisition.

### 16.5 P3-06 — null-version freshness (intentional DEGRADED)

Approved brief §6.F.9: incoming null-version against a stored versioned fact does not apply. Freshness becomes/remains `DEGRADED` and `CATALOG_NULL_VERSION_OBSERVATION` is persisted because absolute freshness cannot be established. Stored values and attribute clocks do not advance. This is conservative and intentional — not a silent no-op.

### 16.6 P3-07 — semantic equality

- `Product.tags`: sorted multiset compare; order does not create `EQUAL_VERSION_CONFLICT`; multiplicity is preserved (duplicates are not silently dropped).
- `ProductVariant.selectedOptions`: array order remains meaningful; `{name,value}` object key order inside each element does not. Equality does not use `JSON.stringify` key order.

### 16.7 P3-08 — first-LIVE semantic completeness

Non-empty where identity/display semantics require it: `Product.title`, `Product.handle`, `ProductVariant.title`, `Location.name`, `currencyCode`, required relationship GIDs. `selectedOptions` must be a non-empty array of `{name,value}` items (`name` non-empty string, `value` string). `Product.tags = []` is legitimate. Empty placeholders are rejected; legitimate empty arrays are not globally forbidden.

### 16.8 P3-09 — quantity domain

`null` remains allowed. Otherwise the value must be a JavaScript safe exact integer in PostgreSQL / GraphQL Int (`-2147483648..2147483647`). Fractional, NaN, Infinity, and out-of-int32 values are rejected with `CanonicalApplyQuantityDomainError` / `CANONICAL_QUANTITY_DOMAIN_UNREPRESENTABLE` before the quantity UPDATE. Direct existing-row rejects get P2-04 `DEGRADED` / diagnostic behavior without advancing that quantity clock.

### 16.9 P3-10 — frozen lock order

Corrected in `applyOneObservation`:

tenant / RLS → canonical advisory identity lock → canonical fact `SELECT ... FOR UPDATE` when the row exists (and the same `FOR UPDATE` read when missing, which is the missing-row probe) → observation rows in deterministic order → blocker / lease / clock decisions → fact writes → terminal observation completion → commit.

The advisory lock remains the primary missing-row anchor. Source-order and PostgreSQL statement-order proofs exist.

### 16.10 P3-11 — reliance-scoped abandonment

Durable `ACTIVE → ABANDONED` runs only when the successor existence mutation would proceed **only because** those exact rows are expired under PostgreSQL `clock_timestamp()`.

- Expired rows are logically ineligible to block.
- If mutation relies on that expiry, those exact rows are abandoned in the same transaction, blockers are re-read, then the canonical mutation proceeds.
- Rollback undoes both abandonment and successor mutation.
- Full-sync noop / presence-marker work that did not rely on expiry does not abandon an expired row for cleanup.
- An unexpired blocker still prevents mutation; the expired sibling stays `ACTIVE`.
- No background reaper.

### 16.11 Previous high-risk contracts preserved

Request-generation binding; PostgreSQL clock lease authority; `ACTIVE =>` persisted `responseGen` NULL; durable `ABANDONED` irreversibility; fresh-transaction retry after unique conflict; no `ON CONFLICT DO UPDATE`; full-sync fence ≠ Clock-B interval; `LIVE_FULL_SYNC_PRESENT` existence gens NULL/NULL; Race AT first-insert serialization; unseen ABSENT preserve-no-row; terminal two-confirmation revival; InventoryLevel reconnect; exact `DECIMAL(20,6)`; eight independent quantity clocks; R-162 safe-integer evaluator; ordinary canonical no-physical-delete surface; cross-shop RLS; no network under advisory lock.

`foundation-safety.test.ts` remains byte-identical to authorized `origin/main` `5129707ee684e66cadcf96b976e16eb57385a7cb`.

### 16.12 First-correction local validation (executed)

Environment: disposable PostgreSQL **16.14** (`stocky` / `stocky_plus` on localhost:5432), Redis 7, Node v22.22.2 for this agent. Inventory-write flags were not changed. Shopify network I/O was not performed.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run app/lib/catalog-facts` | 0 | **59** passed / 7 files |
| `npm test` | 0 | **115** passed / 13 files |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **72** passed / 1 file |
| `npm run test:migrations -- …/pr5-f2b-canonical-applicator.test.ts …/pr5-catalog-fact-foundation.test.ts` | 0 | **91** passed / 2 files (F2B 72 + F1 19) |
| `npm run lint` | 0 | executed and passed |
| `npm run typecheck` | 0 | executed and passed |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| `git diff --check` | 0 | executed and passed |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 274`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory:check` | 0 | fresh; no mechanical regen required |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npx vitest run scripts/tenant-access/architecture-audit.test.ts --config vitest.tenant-access.config.ts` | 0 | **25** passed / 1 file |
| independent review artifact blob | 0 | `e3fe412180ddb6d5b79d9fa8c6d566e68433918a` |
| Full `npm run test:migrations` | 0 | **318** passed / 51 files |

An earlier full-suite attempt in this agent was **316 passed / 2 failed** only because `DATABASE_CONTROL_PLANE_URL` was unset. Those two F1 tests then passed 19/19 with the URL; the complete corpus with that URL is 318/318.

### 16.13 Risk status after this correction

Do **not** close risks from this correction.

| Risk | Status |
|---|---|
| R-157 | **OPEN** |
| R-158 | **OPEN**, materially advanced |
| R-159 | **OPEN**, materially advanced |
| R-160 | **OPEN**, materially advanced |
| R-161 | **OPEN** |
| R-162 | technically satisfied by independent review; formal closure deferred to lane acceptance / merge synchronization |
| R-163 | **OPEN** pending F2A independent acceptance / merge |
| R-164 | **OPEN** even though the F2B ordinary-applicator gate passed |

### 16.14 Next action

After exact-head full CI is green: return to ChatGPT for PR5-F2B independent-review **correction** review. Do **not** merge. Do **not** mark the PR ready. Do **not** ask Claude. Do **not** start JSONL, webhook integration, F2C integration, or PR 6.

Exact-head `pull_request` CI for this correction head is recorded after the single push. This report does not embed an unknown future SHA or run id.

## 17. F2A-main merge preparation (emergency refresh)

**Status:** Merge preparation only. ChatGPT technically accepted PR5-F2B. Merge is **not** yet authorized.

This section is appended after ChatGPT technical acceptance of the F2B correction package and after F2A merged to `main`. It does **not** rewrite the history above. It does **not** edit any Claude review artifact. It does **not** change F2B runtime, F2B tests, schema, migrations, or package files beyond the F2A merge. It does **not** edit `PROJECT_STATUS.md`, `DECISIONS.md`, or `RISK_REGISTER.md`. Those live-control records are updated **after** merge.

### 17.1 Identities

| Field | Value |
|---|---|
| ChatGPT technical acceptance | **ACCEPT PR5-F2B CANONICAL APPLICATOR** (correction package) |
| Accepted F2B implementation head | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` |
| Authorized `origin/main` at refresh start | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (F2A squash merge) |
| F2A post-merge main CI | run `32362021387`, event `push`, head `f65ab4b…`, **SUCCESS** (Classify / Heavy / CI Gate SUCCESS) |
| Previous PR #31 merge base | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| Sync strategy | non-destructive `git merge origin/main` (no rebase, no force-push, no amend of reviewed commits) |
| Merge commit | `3b01fb88b9c6ee699936c71c8a4297ae6da1427d` (parents `dba3b24…` + `f65ab4b…`) |
| Immutable first review | `PR5_F2B_CANONICAL_APPLICATOR_INDEPENDENT_REVIEW.md` blob `e3fe412180ddb6d5b79d9fa8c6d566e68433918a` (**not edited**) |
| Final independent correction review branch | `claude/pr5-f2b-applicator-review-io7c16` |
| Final independent correction review commit | `d0e5f2fb8e0439b6e7010699f171651f299b4d26` |
| Review commit cherry-picked | `d0e5f2fb8e0439b6e7010699f171651f299b4d26` → branch commit `dba3b24d29fe257584c1f1d9d1ad6a8139114f69` |
| Final correction-review artifact blob | `b01569fd77455566438bcedbe869647beb24eda7` (byte-identical after cherry-pick) |
| Independent verdict | `APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION` |
| Final independent finding posture | P0 0 / P1 0 / P2 0 |
| PR #31 | remains OPEN / DRAFT / UNMERGED. Merge is **not** performed in this package. |

Lineage after merge: `HEAD` contains accepted F2B head `1b72a4c…` **and** current main `f65ab4b…`. Last F2B runtime/test implementation commit remains `1b72a4c…`. Cherry-pick and merge commits are documentation / synchronization only.

A later documentation commit on the same branch may exist; it must not be treated as a runtime change. This report does not embed its own commit SHA or an unknown future CI run id.

### 17.2 Conflicts encountered and exact resolutions

Only one conflict:

`stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`

Both sides changed the mechanically generated `scannedFiles` count:

- F2B HEAD: `274`
- F2A `origin/main`: `285`
- content digest, findings (1408), converted paths (450), approved exceptions (958), and violations (0) were identical

Resolution: after the combined tree was present, regenerate with `npm run tenant:access:inventory`. Do not hand-edit. Result:

- `scannedFiles`: **301** (258 foundation + 16 F2B apply modules + 27 F2A admin-read modules)
- findings: 1408
- violations: 0
- content digest unchanged: `4670755fc5d481b42efd04705d4e26fc60b2cf20a06197ebb5cb2e24979e2ba5`

`PR3_DATABASE_ENFORCEMENT_INVENTORY.md` was **not** regenerated (`tenant:enforcement:inventory:check` reported fresh).

F2A `foundation-safety.test.ts` was taken from merged main (F2A ownership). F2B `app/lib/catalog-facts/apply/**`, `lock-capacity.ts`, `catalog-facts/index.ts` apply exports, and `pr5-f2b-canonical-applicator.test.ts` are byte-identical to `1b72a4c…`.

`catalog-facts/index.ts` still does **not** re-export admin-read (F2A contract). F2B apply re-exports remain.

### 17.3 Changed files introduced by this refresh only

Relative to accepted head `1b72a4c…`:

- cherry-picked immutable Claude correction-review artifact
- F2A merge: `admin-read/**`, F2A review/implementation docs, `package.json` / `package-lock.json` (`graphql` `^16.14.2`), `.github/workflows/ci.yml` (GraphQL codegen before unit tests), `foundation-safety.test.ts`
- mechanical tenant-access inventory `scannedFiles` 274 → 301
- this merge-preparation section

No Prisma schema change. No migration. No F2B applicator runtime redesign. No Shopify mutation. Inventory-write flags remain **DEFAULT OFF**. F2C was not started.

### 17.4 Local validation after refresh (executed)

Environment: disposable PostgreSQL **16.15** (`stocky` / `stocky_plus` on localhost:5432), Redis 7 PONG, Node v22.14.0, npm 11.5.2. Inventory-write flags were not changed. No production access. `npm run graphql-codegen` was executed so the gitignored Admin 2026-07 schema artifact existed for merged F2A `npm test` gates (R-016 remains OPEN).

| Command | Exit | Result |
|---|---|---|
| `npx vitest run app/lib/catalog-facts/apply app/lib/catalog-facts/lock-capacity.test.ts` | 0 | **51** passed / 5 files (focused F2B unit) |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **72** passed / 1 file (F2B PostgreSQL race suite) |
| `npm run test:migrations -- …/pr5-f2b-canonical-applicator.test.ts …/pr5-catalog-fact-foundation.test.ts` | 0 | **91** passed / 2 files (F2B 72 + F1 19) |
| `npm test` | 0 | **210** passed / 23 files (includes merged F2A + F2B + F1 catalog-facts unit) |
| `npm run lint` | 0 | executed and passed |
| `npm run typecheck` | 0 | executed and passed |
| `npm run build` | 0 | executed and passed (`react-router build`) |
| `git diff --check` | 0 | executed and passed |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 301`, `findings: 1408`, `violations: 0` |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm run tenant:enforcement:inventory:check` | 0 | `tenant_enforcement_inventory_fresh` |
| original review artifact blob | 0 | `e3fe412180ddb6d5b79d9fa8c6d566e68433918a` |
| correction-review artifact blob | 0 | `b01569fd77455566438bcedbe869647beb24eda7` |

`assertCatalogFactsReadBoundarySafe` / F2A mutation-safety scan passed against the combined `catalog-facts` tree, including F2B `apply/` production modules.

Full `npm run test:migrations` (entire tenant-enforcement corpus) was **not** re-executed locally in this refresh; required on exact-head full CI.

### 17.5 Accepted P3 residuals preserved

Not implemented in this refresh. Carried forward from the immutable correction re-review:

- **NEW-CLAUDE-PR5F2BC-01** P3 — rejection diagnostic never cleared on recovery
- **NEW-CLAUDE-PR5F2BC-02** P3 — stale unusable payload can still degrade a fresher fact; duplicate `lockObservationRows`
- **NEW-CLAUDE-PR5F2BC-03** P3 — `selectedOptions` compares only `name`/`value`
- **NEW-CLAUDE-PR5F2BC-04** P3 — `DEGRADED` on an ignored observation vs brief column definition

Plus earlier accepted nonblocking P3 residuals recorded in the original F2B independent review. None are closed here.

### 17.6 Risk posture during merge preparation

Do **not** close risks from this refresh. `RISK_REGISTER.md` was not edited.

| Risk | Merge-prep posture |
|---|---|
| R-157 | **OPEN** — do not close |
| R-158 | **OPEN** |
| R-159 | **OPEN** |
| R-160 | **OPEN** |
| R-161 | **OPEN** — do not close |
| R-162 | technically satisfied (independent review + applicator is a real direct-input consumer). Formal closure belongs to ChatGPT / live-control synchronization. **Not closed here.** |
| R-163 | **OPEN** — F2A is now merged; formal closure still belongs to ChatGPT |
| R-164 | **OPEN** — do not close |

### 17.7 Next action

Push this refresh **once**. Require exact-head automatic `pull_request` CI with `full_ci=true`, Classify SUCCESS, Heavy SUCCESS, CI Gate SUCCESS. Keep PR #31 OPEN / DRAFT / UNMERGED.

Then return to ChatGPT for the emergency F2B **merge decision**. Do **not** merge. Do **not** mark ready. Do **not** start F2C runtime. Do **not** start JSONL, webhook integration, or PR 6.

Exact-head `pull_request` CI for the final refresh head is recorded after the single push. This report does not embed an unknown future SHA or run id.

Production remains **unauthorized**. Inventory-write flags remain **DEFAULT OFF**. PR 5 remains **incomplete**. PR 6 remains **not started**.

**MERGE NOT YET AUTHORIZED — awaiting explicit ChatGPT / user authorization.**
