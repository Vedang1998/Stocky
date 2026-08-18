# Phase 1 PR5-F2B — Canonical Fact Applicator Implementation Report

**Slice:** PR5-F2B canonical merchant-fact applicator
**Branch:** `cursor/pr5-f2b-canonical-applicator-055c`
**Authority:** D-054 **EFFECTIVE**; PR5-F1 foundation **FROZEN**
**Status:** Second pre-independent-review correction package complete — pending ChatGPT correction review. Do not ask Claude from this lane.
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**Shopify network I/O in this lane:** NONE

This report records the PR5-F2B applicator implementation. It does **not** claim PR 5 is complete. It does **not** start webhook, bulk/JSONL, compatibility-projection, or PR 6 work. ChatGPT has not accepted this slice.

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
