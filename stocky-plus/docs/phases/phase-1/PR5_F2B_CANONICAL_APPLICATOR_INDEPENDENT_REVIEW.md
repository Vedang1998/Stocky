# PR5-F2B Canonical Fact Applicator — Independent Review (Claude, Tier-A)

**Status:** IMMUTABLE. Do not edit this artifact after commit.

**Review type:** First full independent Tier-A adversarial review of the cumulative
PR5-F2B canonical fact applicator, including all three ChatGPT-directed
pre-independent-review correction packages.

**Reviewer:** Claude Code, acting as independent principal engineer / architecture,
security and release-risk reviewer under `CLAUDE.md` and `AGENTS.md`.

**Review date:** 2026-08-19

**Scope of authority:** Review only. No corrections implemented. No merge. No
readiness change. No RISK_REGISTER edit.

---

## 1. Exact repository identity (verified before review began)

| Item | Expected | Observed | Verdict |
|---|---|---|---|
| Authorized base / `origin/main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `5129707ee684e66cadcf96b976e16eb57385a7cb` | MATCH |
| Reviewed PR head | `2abda4b13577355036683b6d92be852740530311` | `2abda4b13577355036683b6d92be852740530311` | MATCH |
| Merge base | base is ancestor of head | `5129707ee684e66cadcf96b976e16eb57385a7cb` | MATCH |
| PR | #31 | #31 | MATCH |
| PR state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false` | MATCH |
| PR base ref | `main @ 5129707e…` | `main @ 5129707ee684e66cadcf96b976e16eb57385a7cb` | MATCH |
| PR head ref | `cursor/pr5-f2b-canonical-applicator-055c` | same | MATCH |
| `mergeable_state` | — | `clean` | observed |
| Commits in range | 16 | 16 | MATCH |
| Changed files | 21 | 21 | MATCH |
| Additions / deletions | 9797 / 15 | 9797 / 15 | MATCH |

The merge base equals the authorized base exactly. No rebase, no drift, no
unauthorized ancestry. No stop condition triggered.

### 1.1 Exact-head CI identity (independently re-read from GitHub Actions)

| Item | Observed |
|---|---|
| Run | `32139362330` |
| Event | `pull_request` |
| `head_sha` | `2abda4b13577355036683b6d92be852740530311` |
| `head_branch` | `cursor/pr5-f2b-canonical-applicator-055c` |
| Job — Classify change set | **SUCCESS** |
| Job — Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | **SUCCESS** |
| Job — CI Gate | **SUCCESS** |
| Run attempt | 1 |

Heavy step 130 (`Migration and tenant-backfill tests` → unfiltered
`npm run test:migrations`) is the step that executes
`scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` via the
`scripts/tenant-enforcement/tests/**/*.test.ts` include glob in
`vitest.migrations.config.ts`. That step is SUCCESS on the exact head. The
applicator race suite is therefore genuinely covered by the authoritative
exact-head CI, not merely present in the tree.

---

## 2. Cumulative changed-file scope (21 paths)

Runtime (12):

```
stocky-plus/app/lib/catalog-facts/index.ts                       (barrel re-export only)
stocky-plus/app/lib/catalog-facts/lock-capacity.ts               (R-162 fail-closed guard)
stocky-plus/app/lib/catalog-facts/apply/clocks.ts
stocky-plus/app/lib/catalog-facts/apply/errors.ts
stocky-plus/app/lib/catalog-facts/apply/existence.ts
stocky-plus/app/lib/catalog-facts/apply/fencing.ts
stocky-plus/app/lib/catalog-facts/apply/first-live.ts
stocky-plus/app/lib/catalog-facts/apply/index.ts
stocky-plus/app/lib/catalog-facts/apply/money.ts
stocky-plus/app/lib/catalog-facts/apply/observation-evidence.ts
stocky-plus/app/lib/catalog-facts/apply/sql.ts
stocky-plus/app/lib/catalog-facts/apply/types.ts
stocky-plus/app/lib/catalog-facts/apply/writers.ts
```

Tests (7):

```
stocky-plus/app/lib/catalog-facts/lock-capacity.test.ts
stocky-plus/app/lib/catalog-facts/apply/apply-clocks.test.ts
stocky-plus/app/lib/catalog-facts/apply/apply-safety.test.ts
stocky-plus/app/lib/catalog-facts/apply/first-live.test.ts
stocky-plus/app/lib/catalog-facts/apply/observation-evidence.test.ts
stocky-plus/scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts
```

Docs (2):

```
stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md
stocky-plus/docs/phases/phase-1/PR5_F2B_CANONICAL_APPLICATOR_IMPLEMENTATION_REPORT.md
```

---

## 3. Scope verdict — no Shopify, no network, no schema

| Prohibition | Verdict | Evidence |
|---|---|---|
| Shopify HTTP / network I/O | **ABSENT** | No `fetch`, `axios`, `undici`, `node-fetch`, URL literal, or HTTP client in any added runtime line |
| GraphQL operation | **ABSENT** | No `gql`, `graphql`, or `.graphql` artifact in the diff |
| Webhook integration | **ABSENT** | `DELETE_WEBHOOK` / `DISCONNECT_WEBHOOK` occur only as `CatalogSourceKind` string-union members in `types.ts` and as test fixture data. No webhook route, handler, or registration |
| JSONL worker | **ABSENT** | No bulk-operation reader, no JSONL parsing |
| F2A implementation | **ABSENT** | The applicator consumes already-authoritative observations; it issues none |
| F2C compatibility projection | **ABSENT** | No projection or compatibility-cache writer |
| Schema / migration change | **ABSENT** | `git diff --name-only base..head` matches zero `prisma/**`, `migration*`, or `*.sql` paths |
| Forecast / ABC work | **ABSENT** | No forecasting module touched |
| Shopify mutation | **ABSENT** | No mutation surface |
| Inventory-write flag enablement | **ABSENT** | All `FEATURE_*_WRITES` remain unchanged and `false` |
| Production access | **ABSENT** | All evidence produced against a disposable local PostgreSQL 16 cluster |

`foundation-safety.test.ts` byte-identity: `git diff base..head -- '**/foundation-safety.test.ts'` returns **zero lines**. The F1 foundation-safety guard is untouched. **VERIFIED IDENTICAL.**

`git diff --check 5129707..2abda4b` → exit 0, no output. Clean.

---

## 4. Independent execution environment

All evidence below was produced by me, in this session, against a disposable
PostgreSQL cluster I initialised for this review. No merchant data, no production
database, no Shopify call.

| Item | Value |
|---|---|
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), local cluster, port 55432 |
| `max_locks_per_transaction` | 64 |
| `max_connections` | 100 |
| `max_prepared_transactions` | 0 |
| Node | v22.22.2 |
| Commit under test | `2abda4b13577355036683b6d92be852740530311` (detached worktree) |
| DB preparation | `prisma migrate deploy` → `tenant:indexes:apply --apply` → `tenant:roles:provision --apply` → `tenant:enforcement:apply --apply` (`"ok":true`) |

Deviation from CI worth recording: CI pins npm `11.5.2`; this environment has npm
`10.9.7`, which cannot satisfy `npm ci` against the committed lockfile
(`EBADENGINE`, then `EUSAGE` — three `@emnapi/*` optional entries resolve
differently). I installed with `npm install --engine-strict=false` and reverted the
resulting `package-lock.json` drift before committing. This affects only my local
dependency resolution, not the reviewed source, and the exact-head CI installed via
`npm ci` under the pinned npm successfully.

---

## 5. Finding-by-finding verification against the review mandate

### A. Universal canonical serialization — **PASS**

Every ordinary apply path passes through `applyCanonicalFacts`, which performs, in
order: `requireTenant` (matching `stocky.current_shop_id`) → capacity evaluation →
`acquireOrderedLocks` → per-identity `applyOneObservation`.

`acquireOrderedLocks` calls the frozen F1 primitive
`acquireCanonicalIdentityAdvisoryLock`, which issues
`pg_advisory_xact_lock(key1, key2)` only. Grep across the whole
`app/lib/catalog-facts/` tree for `pg_advisory_lock(` / `pg_advisory_unlock` returns
**no matches** — there is no session-level lock and no unanchored fallback anywhere
in the lane.

The anchor is taken before any row is read, so it covers all eight required cases
uniformly: existing row, nonexistent row / first insert, tombstone, terminal revival,
InventoryLevel pair, full-sync presence, expired-blocker takeover, and multi-identity
batch. The lock is acquired for every identity in the batch *before* any observation
is applied, so identity coverage does not depend on the per-observation code path.

No Shopify or network work is performed anywhere in the lane, so nothing can be held
across network I/O.

### B. Deterministic lock order — **PASS, with one documented-order deviation (P3)**

Multi-identity keys are deduplicated (`dedupeCanonicalLockKeys`) and acquired in
ascending `(key1, key2)` order (`orderCanonicalLockKeysForAcquisition`).
`acquireOrderedLocks` additionally re-dedupes by `key1:key2`.

Hash-collision behaviour is correct: two distinct identities colliding on
`(key1, key2)` resolve to a single acquisition, so both are serialized under one
lock. That is **over-serialization only** — never under-serialization. Confirmed by
reading `acquireOrderedLocks`, where `keys.find` returns the first identity matching
the key and the `seen` set suppresses the duplicate acquisition.

Deviation (**NEW-CLAUDE-PR5F2B-10**, P3): the mandated order is
`tenant → advisory → canonical row → observation rows → decisions → writes`. The
implementation is `tenant → advisory → observation rows (lockObservationRows) →
fence → observation rows again → canonical row (lockAndReadFact) → decisions →
writes`. The canonical row lock is taken **after** the observation-row locks, not
before. This is not a live deadlock today — the exclusive advisory anchor per
identity is taken first and in deterministic order, so no two canonical transactions
can interleave on the same identity's rows — but it is a deviation from the frozen
written order that a future writer outside this lane could turn into a real lock
inversion. Recorded for ChatGPT's decision: correct the code or amend the documented
order.

### C. R-162 / lock capacity — **PASS (R-162 satisfied for this lane); R-161 remains OPEN**

`requireIntAtLeast` is replaced by `requireSafeIntAtLeast` (`Number.isSafeInteger`
plus type and minimum guard), and derived budgets are guarded by
`multiplySafeIntegers` and an explicit `Number.isSafeInteger` check on
`conditionBBudget`.

I falsified the direct/configured evaluator inputs myself rather than relying on the
committed test:

```
2^53                 THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected 9007199254740992)
2^53+2               THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected 9007199254740994)
Number.MAX_VALUE     THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected 1.797...e+308)
zero                 THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected 0)
negative             THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected -64)
NaN                  THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected NaN)
Infinity             THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected Infinity)
float 64.5           THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected 64.5)
string "64"          THROW maxLocksPerTransaction must be a safe integer >= 1 (rejected 64)
MAX_SAFE_INTEGER*3   THROW sharedLockObjectBudget exceeds the safe integer range
batch MAX_VALUE      THROW requestedCanonicalIdentitiesPerTransaction must be a safe integer >= 1
```

Every rejection occurs **before** any arithmetic that could emit a precision-loss or
`Infinity` diagnostic. Fail-closed confirmed.

Malformed PostgreSQL settings falsified on **both** reader paths:

```
F1 readPostgresLockCapacitySettings:
  "abc"              THROW max_locks_per_transaction is not a numeric integer: abc
  ""                 THROW max_locks_per_transaction was missing from PostgreSQL settings
  "64.5"             THROW max_locks_per_transaction is not a numeric integer: 64.5
  "1e400"            THROW max_locks_per_transaction is not a numeric integer: 1e400
  "9007199254740993" THROW max_locks_per_transaction is not a finite safe integer
  null               THROW max_locks_per_transaction was missing from PostgreSQL settings

Applicator readCapacitySettings (via applyCanonicalFacts):
  "abc"              THROW canonical_apply_capacity_settings_invalid
  ""                 THROW canonical_apply_capacity_settings_invalid
  "64.5"             THROW canonical_apply_capacity_settings_invalid
  "9007199254740993" THROW canonical_apply_capacity_settings_unsafe
```

Condition A / Condition B with the CI-equivalent settings (64 / 100 / 0):

```
conditionACap = floor(64/2)            = 32
sharedLockObjectBudget = 64*(100+0)    = 6400
conditionBCap = floor(6400*0.25 / 4)   = 400
effectiveCanonicalIdentitiesPerTransaction = 32
```

The 32-identity default is the binding constraint via Condition A, as designed.

**R-161 is NOT closed by this review.** The evaluator arithmetic is correct and
fail-closed, but deployment/concurrency shared-lock-table evidence remains an
operational gate outside this isolated applicator lane. I make no claim about it.

### D. Direct observation fencing / R-159 — **PASS**

Durable request-generation binding is implemented in `fenceDirectObservation`: the
persisted `observationRequestGen` must equal the caller's `expectedRequestGen`, or
`CanonicalApplyRequestGenerationMismatchError` is thrown.

Independently reproduced (PROBE-C1): a valid ACTIVE token applied with
`observationRequestGen = 601` against a durable row holding `600`:

- throws the typed `CanonicalApplyRequestGenerationMismatchError`;
- the observation row remains `lifecycleState = ACTIVE` with `observationResponseGen = NULL` — the legitimate observation is **not** abandoned;
- zero canonical rows exist for the identity — no fact mutation;
- the token is **not** completed.

Critically, the mismatch error is thrown from inside `fenceDirectObservation` and is
**not** caught by the `CanonicalApplyLeaseInvalidError` handler in
`applyOneObservation`, so `abandonOwnExpiredObservation` never runs on a
requestGen mismatch. Verified by reading the catch clause and confirmed by the
persisted `ACTIVE` state above.

Lease decisions use PostgreSQL `clock_timestamp()` exclusively; no application-node
clock appears anywhere in the lane. Boundary semantics are consistent and correct:

- validity: `clock_timestamp() < "leaseExpiresAt"` (fence, blocker predicates, `completeObservation`);
- expiry: `clock_timestamp() >= "leaseExpiresAt"` (`abandonExpiredResultlessRow`).

Equality at `leaseExpiresAt` is therefore **expired** on every path.

Lifecycle invariants:

- `ACTIVE` + persisted `responseGen` is rejected by the fence
  (`"ACTIVE observation must remain resultless"` → `CanonicalApplyLeaseInvalidError`);
- `completeObservation` sets `COMPLETED` and `observationResponseGen` in one
  statement guarded by `lifecycleState='ACTIVE' AND "observationResponseGen" IS NULL
  AND "observationRequestGen" = expected AND responseGen > requestGen AND
  clock_timestamp() < "leaseExpiresAt"`, and requires `rows.length === 1` — so
  `COMPLETED` always carries a `responseGen`;
- `ABANDONED` short-circuits to `CanonicalApplyAbandonedTokenError` before any lease
  evaluation, so an abandoned token can never return to ACTIVE.

Missing token → `CanonicalApplyMissingTokenError` (fail closed; reproduced as
PROBE-C2). More than one matching row → the same typed error
(`"Observation token matched more than one row; fail closed"`), read at
`fencing.ts:120-124`.

Expired original worker cannot apply: the fence rejects it and
`abandonOwnExpiredObservation` durably transitions its own row out of ACTIVE.

Successor relying on expiry: `abandonExpiredBlockers` /
`abandonExpiredFullSyncBlockers` perform `ACTIVE → ABANDONED` via a guarded UPDATE in
the **same** tenant/identity transaction as the successor's canonical mutation, so
rollback undoes both. The committed suite proves the rollback case
(`durably abandons an expired ACTIVE direct in the same full-sync transaction and
rolls back with it`), which I re-ran and observed passing.

Backward-clock safety: because `ABANDONED` is written durably and
`fenceDirectObservation` checks `lifecycleState === "ABANDONED"` **before** any
`clock_timestamp()` comparison, a later backward move of PostgreSQL wall time cannot
revalidate an abandoned token. The committed Race AS test asserts exactly this and
passes.

### E. Unique-conflict transaction safety — **PASS**

`throwIfUniqueViolation` maps SQLSTATE `23505` / Prisma `P2002` to the typed
`CanonicalApplyUniqueConflictError` and rethrows everything else unchanged.

There is **no** `ON CONFLICT DO UPDATE` anywhere in `writers.ts` (grep confirms), no
`SAVEPOINT`, and no blind overwrite path. `applyCanonicalFactsWithRetry` retries only
by invoking `begin` again, and its contract comment states that `begin` MUST open a
fresh PostgreSQL transaction; it never issues a statement on the aborted one.

The committed suite covers both halves —
`does not retry a unique violation inside the aborted transaction and does not mask 25P02`
and `retries unique conflict in a fresh transaction after full rollback` — and both
passed in my independent run against real PostgreSQL. On retry the whole
`applyCanonicalFacts` body re-runs, so the advisory anchor, fence, and
`clock_timestamp()` decision are all re-evaluated from scratch.

### F. Full-sync fence vs direct Clock-B — **PASS (third correction is correct)**

This was the primary review target. The separation is real at every layer, not just
in naming.

Type layer: `FullSyncFenceGeneration` and `FullSyncAttributeMarker` are distinct
branded types from `GenerationInterval`.
`nullableFallbackIntervalFromFullSyncMarker` is the only function that converts a
marker into a point interval, and its doc comment restricts it to the nullable
attribute/quantity fallback.

Orchestration layer (`applyOneObservation`): `directInterval` is `null` for every
full-sync observation, and `decideExistence` receives `incomingInterval: directInterval`.
A full-sync observation therefore **cannot** reach the direct-interval overlap
arithmetic — `decideExistence` routes `LIVE_FULL_SYNC_PRESENT` to
`decideFullSyncExistence` before the `incomingInterval == null` guard.

Write layer: `existenceGens()` returns `{ req: null, resp: null }` for
`kind === "LIVE_FULL_SYNC_PRESENT"` unconditionally, and the `ExistenceWrite`
constructed in `applyOneObservation` sets
`interval: observation.existenceKind === "LIVE_FULL_SYNC_PRESENT" ? null : directInterval`.

I reproduced all of the mandated adversarial cases myself with fresh fixtures
(PROBE-E1..E6), not by re-running the committed assertions:

| # | Scenario | Observed | Verdict |
|---|---|---|---|
| 1 | Full-sync first insert at F=100 | `existenceRequestGen=NULL`, `existenceResponseGen=NULL`, `existenceKind=LIVE_FULL_SYNC_PRESENT`, `attributeRequestGen=100`, `attributeResponseGen=100` | PASS |
| 2 | Fence F=200; completed direct ABSENT `[210,220]` (requestGen > F); no canonical row; late bulk LIVE at F | `existenceMutated=false`, diagnostic `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`, **zero rows** | PASS |
| 3 | Completed direct `[290,310]` spanning F=300 | `existenceMutated=false`, **zero rows** | PASS |
| 4 | Completed direct `[400,410]` safely earlier than F=411 (`responseGen < F`) | `existenceMutated=true` — bulk first insert allowed | PASS |
| 5 | ACTIVE unexpired direct started **after** F (requestGen 510, F=500) | `outcome=blocked`, `existenceMutated=false` | PASS |
| 6 | ACTIVE unexpired direct started **before** F (requestGen 490, F=500) | `outcome=blocked`, `existenceMutated=false` | PASS |

Cases 7–11 verified by code reading plus the committed suite (all re-run and green
in my environment):

- 7 — expired ACTIVE resultless direct is durably abandoned only under the approved
  DB-clock transaction rules (`abandonExpiredResultlessRow` guards on
  `lifecycleState='ACTIVE' AND "observationResponseGen" IS NULL AND
  clock_timestamp() >= "leaseExpiresAt"`), and rollback restores it;
- 8 — existing LIVE returns `presence_keep_live` (`mutate:false`) while
  `updatePresenceMarker` still advances `lastSeenFullSyncRunId`; stale bulk
  attributes are separately barred by Clock A;
- 9 — reconnectable ABSENT InventoryLevel with newer/unresolved direct evidence is
  blocked (`full_sync_reconnect_direct_conflict` when a completed direct is not
  safely earlier; `active_blocker` when an ACTIVE unexpired direct exists);
- 10 — reconnect requires `fenceGeneration > stored.existenceResponseGen`
  (`fenceAfterAbsence`), and fails closed when the stored absence carries a NULL
  response generation;
- 11 — terminal tombstone + bulk presence yields `terminal_bulk_revival_conflict`
  with the `TERMINAL_IDENTITY_REVIVAL_CONFLICT` diagnostic; bulk never revives a
  terminal identity.

The specific escape hatches I hunted for are **not** present:

- a completed direct with `responseGen >= F` is never ignored —
  `loadCompletedDirectsNotSafelyEarlierThanFence` selects exactly
  `lifecycleState='COMPLETED' AND "observationResponseGen" >= F`, which is the exact
  complement of "safely earlier";
- no-row state is never read as agreement — the `!stored` branch of
  `decideFullSyncExistence` blocks whenever `notSafelyEarlier.length > 0`, and the
  direct `!stored` branch carries an explicit comment refusing to infer agreement
  from a missing row;
- the presence marker never becomes existence authority — `updatePresenceMarker`
  writes only `lastSeenFullSyncRunId`;
- batch order cannot let an older bulk line escape the fence, because the fence
  predicate is re-evaluated from durable observation rows inside each identity's
  own advisory-locked apply, not from batch position.

### G. First insert / Race AT — **PASS**

Unseen `ABSENT_CONFIRMED_QUERY` returns `first_insert_absent_preserve_no_row`
(`mutate:false`). Reproduced (PROBE-F1): zero canonical rows, and the observation
still transitions correctly to `COMPLETED` with `observationResponseGen=810`. No
required live column is fabricated — the code comment explicitly refuses to
fabricate parent FKs or business columns to make a never-seen tombstone insertable.

Overlapping completed evidence with no canonical row fails closed for **both**
incoming LIVE and incoming ABSENT (`first_insert_overlapping_completed` +
`CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`). A later genuinely non-overlapping LIVE
may first-insert.

Concurrent first insert: the committed suite proves at most one coherent row
(`serializes concurrent first insert of a nonexistent identity`,
`serializes concurrent overlapping LIVE vs ABSENT first insert to zero or one row`,
`waiter apply uses the same advisory identity lock as a holder` — the last taking
5.03 s, which is the waiter genuinely blocking on the advisory lock rather than
racing past it). All passed in my run. The advisory lock is the actual serialization
boundary; the unique constraint is a backstop that produces a typed error and a
fresh-transaction retry, never a blind overwrite.

### H. Existence / tombstone / revival — **PASS**

Direct Clock-B is decided independently of Clock A. Existing LIVE + later confirmed
ABSENT tombstones only when
`isNonOverlappingLater(incomingInterval, storedInterval)` holds; otherwise
`absent_not_later` + `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`. The only accepted
absence kind is `ABSENT_CONFIRMED_QUERY`; `ABSENT_FULL_SYNC_SWEEP` is rejected at
input validation by `CanonicalApplyExistenceKindError`, so no full-sync omission can
tombstone. No webhook signal can tombstone in this lane — there is no webhook input
path at all.

Terminal revival for Product / ProductVariant / InventoryItem / Location:

1. `createdAtMatches` must hold (null on either side is treated as "match where
   available", per the frozen rule);
2. first later LIVE confirmation keeps the tombstone and persists
   `TERMINAL_IDENTITY_REVIVAL_CONFLICT:<req>:<resp>` as the diagnostic
   (`terminal_first_confirmation`, `mutate:false`);
3. the second LIVE must satisfy `incomingInterval.requestGen > first.responseGen`;
   an overlapping second confirmation returns `terminal_overlapping_confirmations`
   and — correctly — re-persists the **first** interval rather than sliding the
   window forward;
4. only then is controlled LIVE restoration performed.

`preserveRevivalDiagnostic` prevents an unrelated clock no-op from clobbering an open
revival confirmation.

InventoryLevel is exempt (`isTerminalResource` returns false only for
`InventoryLevel`) and reconnects through `level_reconnect` / `level_reconnect_full_sync`
subject to the same non-overlapping-later rule. Confirmed by the committed
reconnect tests.

### I. Clock A / null-version fallback — **PASS**

`decideAttributeClock` implements the full matrix correctly: newer applies; older is
a silent no-op (`freshness:null, diagnostic:null` → `persistClockNoop` returns early,
so a stale observation writes nothing at all); equal + equal attributes is
idempotent; equal + different attributes yields `EQUAL_VERSION_CONFLICT` with
DEGRADED and no write; incoming-versioned over stored-null applies; incoming-null
over stored-versioned does not overwrite.

Both-null fallback: no stored interval → apply DEGRADED (infinite no-op is
correctly forbidden); overlapping + identical → converge; overlapping + different →
preserve old value with `CONCURRENT_ATTRIBUTE_OBSERVATION_CONFLICT` and DEGRADED;
non-overlapping later → apply; non-overlapping not-later → no-op.

The full-sync null-version path uses the `[F, F]` point marker conservatively and
correctly: a direct interval `[r,s]` with `s < F` is non-overlapping-later so bulk
may win; a direct spanning F overlaps and yields a conflict; a direct entirely later
than F is neither overlapping nor later, so bulk cannot overwrite it. The committed
tests `does not let an older full-sync null-version title overwrite a newer direct
interval` and the quantity equivalent assert exactly this and pass.

There is no `appliedAt` / commit-time last-writer-wins anywhere — `appliedAt` is
written but never read for ordering (grep confirms it appears only in `SET` clauses).

Relationship equality is included in the equality predicates:
`variantAttributesEqual` compares `shopifyProductGid`; `inventoryItemAttributesEqual`
compares `shopifyVariantGid`. Both are exercised at equal and overlapping versions by
committed tests 28–33, which pass. Composite FKs are genuinely enforced at the
database — my own probes were rejected by
`ShopifyInventoryItemFact_shopId_shopifyVariantGid_fkey` and
`ShopifyInventoryLevelFact_shopId_inventoryItemGid_fkey` until I seeded the full
parent chain, which is direct evidence that relationship writes cannot dangle.

### J. Exact numeric / first-LIVE attributes — **PASS**

`money.ts` rejects `number` inputs outright (`CanonicalApplyMoneyError`), and there is
no `parseFloat` / `Number(` coercion on any DECIMAL path. `priceAmount`,
`compareAtPriceAmount`, `unitCostAmount`, and `weightValue` are all handled as exact
decimal text and bound as `::decimal(20,6)`.

`canonicalizeExactDecimalText` + `Prisma.Decimal.eq` give true NUMERIC semantics:
`19.99 == 19.990000`, `0.1 == 0.100000`, `-0 == 0` (the canonicaliser maps `-0` and
`-0.000000` to `"0"`), and a real difference is a genuine conflict.
`isExactlyRepresentableAsDecimal20_6` rejects more than 6 *significant* fractional
digits and more than 14 integer digits, so significant precision beyond DECIMAL(20,6)
fails closed while a trailing zero beyond scale that is exactly representable
(`19.9900000`) is still accepted — matching the frozen rule.

Committed tests 39–42 assert all four behaviours and pass, including
`fail-closes significant price precision beyond DECIMAL(20,6) without writing a rounded fact`.
My PROBE-M1 independently confirms the "no rounded fact" half: after a rejected
`10.1234567`, the stored `priceAmount` remained exactly `10.000000` and the title was
not advanced.

First-LIVE creation: `validateFirstLiveAttributes` requires the complete
authoritative attribute set per resource kind before any INSERT, and `insertFact`
re-validates. The applicator itself synthesises nothing — I found no `?? ""`,
`?? "ACTIVE"`, `?? "USD"`, or `?? true` default on any NOT NULL column in the insert
path. A direct incomplete usable response is atomically rejected
(`rejectUsableObservation` → observation `COMPLETED`, no fabricated fact); a
full-sync incomplete first LIVE throws and fails the apply unit with nothing
inserted, which committed test 46 asserts.

### K. Inventory quantities — **PASS**

All eight names — `available`, `onHand`, `incoming`, `committed`, `reserved`,
`damaged`, `safetyStock`, `qualityControl` — have four dedicated columns each
(`<name>Quantity`, `<name>QuantityUpdatedAt`, `<name>QuantityRequestGen`,
`<name>QuantityResponseGen`) in `QUANTITY_COLUMN_SPECS`, and `updateQuantity` writes
each name's own four columns in its own `switch` arm with an exhaustiveness `never`
guard. There is no `available`/`on_hand` alias and no borrowed clock: `applyQuantities`
reads `stored = fact.quantities[spec.name]` and builds `storedInterval` from that
name's own generations only.

Nullable `updatedAt` uses the identical `decideAttributeClock` fallback, so a stale
bulk `available` cannot overwrite a newer direct `available` — committed test 59
(`does not let an older full-sync null-version quantity overwrite a newer direct
interval`) and test 13 (`applies quantity names independently so a stale reconcile
cannot rewind a newer name`) both assert this and pass. The full-sync quantity marker
is the same `[F,F]` attribute marker and never reaches an existence API.

### L. R-164 physical delete — **PASS for the applicator lane; broader risk stays OPEN**

I proved the reachable ordinary writer surface rather than trusting the constant.

1. Grep for `delete` / `deleteMany` / `DROP` / `TRUNCATE` across the entire
   `app/lib/catalog-facts/` tree (production files, tests excluded) returns **three
   matches, all of them comments or an error message**: the `index.ts` R-164 comment,
   the `writers.ts` header comment, and the `errors.ts` refusal message. There is no
   executable delete.
2. Structurally stronger: `CanonicalApplyDb = CanonicalLockQueryRaw = { $queryRaw }`.
   The applicator's database handle is narrowed to a single tagged-template method.
   It has **no** Prisma model accessor at all, so `db.shopifyProductFact.delete(...)`
   is not merely unused — it is not expressible on the type the whole lane operates
   against.
3. Every SQL statement issued by the lane is `SELECT`, `INSERT`, or `UPDATE`. I read
   all of them. Tombstoning is an `UPDATE` that sets
   `existenceState='ABSENT'`, `deletedAt`, and `deletionSource` — an existence-state
   transition, never a row removal.
4. Barrel exports (`app/lib/catalog-facts/index.ts`) re-export only
   `applyCanonicalFacts`, `applyCanonicalFactsWithRetry`, the empty
   `CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS`, `denyCanonicalFactPhysicalDelete`,
   the typed errors, and types. No delete helper is exported.

The R-164 **acceptance gate for the applicator lane is met**. The risk itself is not
closed by this PR, and I confirmed why against the live database: `stocky_runtime`
still holds `DELETE` on all six canonical tables —

```
CatalogObservationInFlight  DELETE,INSERT,SELECT,UPDATE
ShopifyInventoryItemFact    DELETE,INSERT,SELECT,UPDATE
ShopifyInventoryLevelFact   DELETE,INSERT,SELECT,UPDATE
ShopifyLocationFact         DELETE,INSERT,SELECT,UPDATE
ShopifyProductFact          DELETE,INSERT,SELECT,UPDATE
ShopifyVariantFact          DELETE,INSERT,SELECT,UPDATE
```

— and the generic `TenantDb` model registry still lists these models. That is
inherited F1/PR2 state, unchanged by this PR and outside this lane's ownership. I did
**not** infer applicator-lane compliance from that generic capability, and I do not
treat the generic capability as the "explicitly bounded, separately authorized"
maintenance path R-164 requires.

### M. Tenancy / RLS — **PASS**

`requireTenant` reads `current_setting('stocky.current_shop_id', true)` and fails
closed with `canonical_apply_tenant_mismatch` when it is unset or different; the F1
advisory primitive independently re-checks the same setting before deriving the key.
Every batch observation must carry `identity.shopId === input.shopId`.

Reproduced against real PostgreSQL under the restricted `stocky_runtime` role
(PROBE-L1): with a Product fact committed under shop A, a shop-B tenant transaction
observed `0` rows for that `shopifyGid`, and a shop-B `UPDATE ... SET title='HACK'`
affected `rowCount = 0`. Cross-shop read and write are both denied by RLS.

Pair identities remain tenant-qualified — the `InventoryLevel` predicate is
`"shopId" = $ AND "inventoryItemGid" = $ AND "locationGid" = $` on every query, and
the lock preimage includes `shopId` between the version and the resource kind.
Relationship changes respect composite FKs (demonstrated in §5.I). The advisory key
uses the exact stored `Shop.id` cuid bytes via the frozen
`encodeCanonicalLockComponent` length-prefixed encoding — no trimming, lowercasing,
or normalisation. No control-plane merchant-fact DML is introduced; the lane runs
entirely on the runtime role.

### N. Result / transaction atomicity — **PASS on the five mandated falsifications, with one auditability defect**

I tried to falsify each of the five stated properties:

- *canonical write commits while observation remains ACTIVE* — not reachable.
  `completeObservation` runs at the end of `applyOneObservation` and throws
  `CanonicalApplyLeaseInvalidError` if it does not update exactly one row; the error
  propagates out of `applyCanonicalFacts` uncaught, so the caller's transaction
  rolls back and the canonical write goes with it.
- *observation COMPLETED while canonical decision rolls back* — not reachable; both
  live in the caller's single transaction.
- *abandoned blocker commits while successor mutation rolls back* — not reachable;
  the abandonment UPDATE is in the same transaction, proven by the committed
  rollback test.
- *numeric rejection after an existence insert leaving partial truth* — **partially
  reachable; see NEW-CLAUDE-PR5F2B-04.** The *insert* path is safe, because
  `assertFrozenNumericColumn` is evaluated during template construction, before the
  INSERT is sent — so no partial row is ever created. The *update-existence* path is
  not: existence can be mutated and then the observation rejected on numerics.
- *batch failure leaves earlier identities partially committed contrary to the
  caller's contract* — not reachable. `applyCanonicalFacts` never commits; the
  caller owns COMMIT/ROLLBACK and any thrown canonical error aborts the whole batch.

Caller-owned transaction semantics are correctly documented and honoured: the module
opens no transaction and issues no COMMIT.

---

## 6. New findings

### NEW-CLAUDE-PR5F2B-01 — **P2** — Attribute writers coerce omitted optional attributes to NULL / empty array, silently destroying stored merchant data

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/writers.ts:729-756` (`updateProductAttributes`), and the same pattern in `updateVariantAttributes` (756-785), `updateInventoryItemAttributes` (786-814), `updateLocationAttributes` (815-846).
- **Evidence:** every attribute writer is a full-row replacement that binds
  `${attrs.vendor ?? null}`, `${attrs.productType ?? null}`,
  `${attrs.featuredMediaUrl ?? null}`, `${attrs.sku ?? null}`, `${attrs.barcode ?? null}`,
  `${attrs.weightUnit ?? null}`, `${attrs.unitCostCurrencyCode ?? null}`, the address
  columns, and `tags = ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(attrs.tags ?? [])}::jsonb))`.
  In `types.ts` these fields are declared **optional** (`vendor?`, `tags?`, `sku?`, …).
  The lane therefore cannot distinguish "Shopify reports this as null" from "this
  observation did not carry the field", and resolves the ambiguity as deletion.
  This directly contradicts the lane's own stated contract in
  `first-live.ts:4` — *"Existence-only / partial updates remain valid for an EXISTING row."*
- **Reproduction (mine, real PostgreSQL 16, PROBE-N1):** apply a direct LIVE
  `[1000,1010]` with `tags:["alpha","beta"], vendor:"ACME"`; verify stored
  `tags=["alpha","beta"], vendor="ACME"`; then apply a strictly newer direct LIVE
  `[1020,1030]` (`shopifyUpdatedAt` 2026-08-05 > 2026-08-01) that omits `tags` and
  `vendor`. Observed stored row: `{"title":"T2","tags":[],"vendor":null}`.
- **Merchant impact:** product tags, vendor, product type, featured media, SKU,
  barcode, weight unit, unit-cost currency, and location address fields can be
  silently erased by any downstream producer that sends a partial payload — exactly
  what an incremental webhook refetch is most likely to do. Tags in particular drive
  collection membership, reporting segmentation, and ABC/U classification downstream.
  The loss is silent: `outcome` is `applied`, `attributeFreshnessState` becomes
  `ORDERED`, and no diagnostic is written, so neither reconciliation nor support can
  detect it from the canonical row.
- **Expected behaviour:** either (a) require a complete authoritative attribute set on
  every attribute-bearing apply, as first-LIVE already does, and reject incomplete
  payloads with `INCOMPLETE_ATTRIBUTES`; or (b) make "omitted" explicitly distinct
  from "null" in the observation contract and emit column-wise `COALESCE`-style
  preservation for omitted fields. Silent coercion of absent → null must not remain.
- **Recommended correction:** extend the `validateFirstLiveAttributes` completeness
  contract to all attribute applies for an existing row (option a is the smaller,
  safer change and is consistent with "already-authoritative observations").
- **Missing test:** an existing-row apply whose payload omits an optional attribute
  must not change that column.

### NEW-CLAUDE-PR5F2B-02 — **P2** — `InventoryItem → ProductVariant` relationship is silently severed by a payload that omits `shopifyVariantGid`

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/writers.ts:806` — `"shopifyVariantGid" = ${attrs.shopifyVariantGid ?? null}`.
- **Evidence:** same root cause as -01 but a materially different blast radius, and it
  defeats the composite FK that otherwise protects this relationship: the FK forbids
  pointing at a *wrong* variant, but permits NULL, so the omission path is the one
  way to break the link. `inventoryItemAttributesEqual` compares
  `(stored.shopifyVariantGid ?? null) === (attrs.shopifyVariantGid ?? null)`, so an
  omitting payload also reads as a genuine difference and is applied.
- **Reproduction (mine, PROBE-N3):** seed Product → Variant → InventoryItem with
  `shopifyVariantGid = gid://shopify/ProductVariant/N3`; verify stored. Apply a
  strictly newer direct LIVE `[1260,1265]` (`shopifyUpdatedAt` 2026-08-09) whose
  attributes carry only `{tracked, requiresShipping, unitCostAccess}`. Observed
  stored `shopifyVariantGid`: **`null`**.
- **Merchant impact:** variant-level identity is a stated non-negotiable product
  principle (`AGENTS.md` §7). A severed item→variant link orphans inventory from the
  variant it belongs to, which breaks cost attribution, replenishment, ABC/U, and
  every downstream report that joins through it — silently, with no diagnostic and
  `attributeFreshnessState = ORDERED`.
- **Expected behaviour:** an observation that does not carry the relationship must not
  clear it. Clearing must require an explicit authoritative null.
- **Recommended correction:** as -01; additionally treat the two relationship columns
  (`ShopifyVariantFact.shopifyProductGid`, `ShopifyInventoryItemFact.shopifyVariantGid`)
  as required on every attribute apply, not merely on first LIVE.
- **Missing test:** an existing-row InventoryItem apply omitting `shopifyVariantGid`
  must preserve the stored relationship.

### NEW-CLAUDE-PR5F2B-03 — **P2** — InventoryLevel non-quantity attributes are write-once and never refreshed

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/index.ts:301-403` (`applyAttributes`) — branches exist for `Product`, `ProductVariant`, `InventoryItem`, and `Location`, then the function falls through to `return { applied: false, diagnostic: null }`. There is **no** `InventoryLevel` branch and no `updateInventoryLevelAttributes` writer in `writers.ts`.
- **Evidence:** `InventoryLevelAttributes` carries `isActive` and
  `shopifyInventoryLevelGid`. `insertFact` writes both at first insert. Afterwards
  `applyQuantities` handles only the eight quantity columns; nothing ever updates
  `isActive` or `shopifyInventoryLevelGid` again.
- **Reproduction (mine, PROBE-N2):** first-insert an InventoryLevel with
  `isActive: true` (`[1150,1155]`, updatedAt 2026-08-01), then apply a strictly newer
  direct LIVE `[1160,1165]` (updatedAt 2026-08-09) carrying `isActive: false`.
  Observed result:
  `{"outcome":"noop","existenceMutated":false,"attributesApplied":false,"presenceUpdated":false,"diagnosticState":null}`
  and the stored `isActive` remained **`true`**.
- **Merchant impact:** when a merchant deactivates stocking at a location, the
  canonical fact keeps reporting the level as active indefinitely. Downstream
  replenishment and availability logic would treat a deactivated location as
  stockable. The failure is a silent `noop` with a null diagnostic, so reconciliation
  cannot distinguish "nothing changed" from "the applicator has no writer for this".
- **Expected behaviour:** either implement the InventoryLevel attribute writer under
  the same Clock-A rules as the other four kinds, or — if this is a deliberate scope
  boundary for F2B — fail closed with an explicit diagnostic rather than reporting
  `noop`, and record the boundary in the implementation report and brief.
- **Recommended correction:** add `updateInventoryLevelAttributes` and the matching
  `applyAttributes` branch plus an `inventoryLevelAttributesEqual` predicate.
- **Missing test:** a newer InventoryLevel observation carrying a changed `isActive`
  must either apply or be explicitly diagnosed.

### NEW-CLAUDE-PR5F2B-04 — **P2** — A rejected usable observation leaves no durable trace after a committed existence mutation

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/index.ts:246-276` (`rejectUsableObservation`) and `index.ts:682-692` (the `allowAttributes` numeric gate).
- **Evidence:** `rejectUsableObservation` calls `completeObservation` and returns a
  result carrying `diagnosticState`, but it never calls `updateDiagnostic` or
  `updateFreshnessAndDiagnostic` on the canonical fact. When the existence decision
  already mutated the row earlier in the same call, that mutation stays; the
  rejection does not.
- **Reproduction (mine, PROBE-M1):** bulk-create a variant so stored
  `existenceKind = LIVE_FULL_SYNC_PRESENT`. Apply a direct `LIVE_REFETCH`
  `[1310,1315]` (a legitimate `upgrade_to_live_refetch`, so existence mutates) whose
  `priceAmount` is `10.1234567` (7 significant fractional digits → rejected).
  Observed:
  - returned result: `{"outcome":"rejected","existenceMutated":true,"attributesApplied":false,"diagnosticState":"CANONICAL_NUMERIC_SCALE_UNREPRESENTABLE"}`;
  - stored row: `{"existenceKind":"LIVE_REFETCH","priceAmount":"10.000000","title":"V","existenceDiagnosticState":null,"attributeFreshnessState":"ORDERED"}`;
  - observation row: `COMPLETED`.
- **Merchant impact:** the canonical row now advertises `LIVE_REFETCH` provenance and
  `ORDERED` freshness — i.e. "recently, directly, authoritatively refetched" — while
  the response that produced that upgrade was in fact discarded and its price never
  applied. The variant's price silently stops tracking Shopify with no DEGRADED
  marker and no diagnostic on the fact. Reconciliation and support read the row as
  fresh. The in-memory `diagnosticState` is the only record, and the applicator is
  the component that owns fact persistence.
- **Expected behaviour:** a rejection must be durable on the fact —
  `existenceDiagnosticState` set to the rejection diagnostic and
  `attributeFreshnessState` set to `DEGRADED` — or the existence mutation must be
  withheld until the observation has been validated end to end.
- **Recommended correction:** validate numerics and first-LIVE completeness **before**
  the existence write, or have `rejectUsableObservation` persist the diagnostic and
  DEGRADED freshness when `extras.factId` is non-null.
- **Missing test:** after a numeric rejection on an existing row, the fact must carry
  the rejection diagnostic and non-ORDERED freshness.

### NEW-CLAUDE-PR5F2B-05 — **P3** — An empty observation batch throws an untyped error instead of returning an empty result

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/index.ts:475-483`; `lock-capacity.ts` `requireSafeIntAtLeast`.
- **Evidence:** with `observations: []`, `identities.length` is `0`, which is passed as
  `requestedCanonicalIdentitiesPerTransaction`, and the evaluator's minimum is 1.
- **Reproduction (mine):** `applyCanonicalFacts(db, { shopId: "S1", observations: [] })`
  throws a plain `Error` — `requestedCanonicalIdentitiesPerTransaction must be a safe
  integer >= 1 (rejected 0)` — with **no** `code` property, so it is not one of the
  typed `CanonicalApplyError`s callers are instructed to handle.
- **Merchant impact:** none today (no producer wired). Latent: a JSONL or webhook
  batch that legitimately filters down to zero applicable observations would abort its
  whole tenant transaction with an unclassifiable error.
- **Expected behaviour:** return an empty `CanonicalApplyBatchResult`, or raise a typed
  canonical error.
- **Missing test:** empty-batch behaviour.

### NEW-CLAUDE-PR5F2B-06 — **P3** — A null-version observation downgrades stored freshness to DEGRADED without applying anything (confirm intent)

- **File / line:** `stocky-plus/app/lib/catalog-facts/apply/index.ts:277-289` (`persistClockNoop`), `clocks.ts:104-111`.
- **Evidence:** for `incoming_null_stored_versioned` the decision is
  `{apply:false, freshness:null, diagnostic:"CATALOG_NULL_VERSION_OBSERVATION"}`.
  `persistClockNoop` does not early-return (diagnostic is non-null) and writes
  `decision.freshness ?? "DEGRADED"`, so a stored `ORDERED` row becomes `DEGRADED`
  even though the observation was correctly ignored.
- **Assessment:** this may be intentional — an unversioned observation genuinely
  reduces confidence that the stored value is the newest. I did **not** prove it
  wrong. It is flagged because it is undocumented and untested, and because a
  repeated null-version producer would pin every row to DEGRADED.
- **Expected behaviour:** confirm and document the intent, or preserve the prior
  freshness while still recording the diagnostic.
- **Missing test:** freshness transition on an ignored null-version observation.

### NEW-CLAUDE-PR5F2B-07 — **P3** — Order-sensitive `JSON.stringify` equality can raise false `EQUAL_VERSION_CONFLICT`

- **File / line:** `writers.ts:945` (`JSON.stringify(stored.tags ?? []) === JSON.stringify(attrs.tags ?? [])`) and `writers.ts:958-959` (`selectedOptions`).
- **Evidence:** array element order and object key order are significant under
  `JSON.stringify`. PostgreSQL `text[]` preserves insertion order, and `jsonb`
  normalises key order on storage but not necessarily to the producer's JS key order.
  Two semantically identical payloads that differ only in tag ordering, or in
  `{name,value}` key ordering inside `selectedOptions`, compare unequal.
- **Merchant impact:** at equal `shopifyUpdatedAt` this produces a spurious
  `EQUAL_VERSION_CONFLICT` and a DEGRADED freshness downgrade on an identical
  observation; at a newer version it produces an unnecessary write. No data loss.
- **Expected behaviour:** order-insensitive comparison for `tags` (sorted multiset)
  and a canonical key ordering for `selectedOptions`.
- **Missing test:** reordered-tags idempotency at equal `shopifyUpdatedAt`.

### NEW-CLAUDE-PR5F2B-08 — **P3** — First-LIVE completeness accepts semantically empty values

- **File / line:** `first-live.ts:48-74` — `isPresentString` accepts `""`;
  `isStringArray` accepts `[]`; `isApprovedSelectedOptions` returns `true` for any
  non-array object including `{}`, and `[].every(...)` makes `[]` pass too.
- **Evidence:** `title`, `handle`, `name` may be `""`; `tags` may be `[]`;
  `selectedOptions` may be `{}` or `[]`.
- **Assessment:** the applicator does **not** fabricate these values — the frozen
  "no synthetic `""` / `ACTIVE` / `USD` / `true` / `[]` / `{}`" rule is not violated by
  this lane, because every value comes from the caller. But the completeness gate is
  weaker than "complete authoritative attributes": a degenerate payload creates a
  first-LIVE fact that satisfies NOT NULL while carrying no information.
- **Expected behaviour:** require non-empty `title` / `handle` / `name` and a
  non-empty `selectedOptions` for `ProductVariant`, matching what a real Shopify
  resource always provides.
- **Missing test:** degenerate first-LIVE payload (`""`, `{}`) must fail closed.

### NEW-CLAUDE-PR5F2B-09 — **P3** — Quantity writes have no application-level integer-domain validation

- **File / line:** `writers.ts:847-935` (`updateQuantity`), `first-live.ts:189-211` (`validateObservationNumericColumns` covers only ProductVariant and InventoryItem DECIMAL columns).
- **Evidence:** the quantity columns are PostgreSQL `integer` (verified:
  `availableQuantity | integer`). `QuantityObservation.quantity` is typed
  `number | null` with no runtime range or integrality check. A value outside int4 or
  a non-integer float is caught only by PostgreSQL.
- **Merchant impact:** it does fail closed (the raw PG error aborts the transaction),
  but as an **untyped** error that aborts the entire batch rather than a typed
  per-observation rejection with a diagnostic — inconsistent with how the DECIMAL
  columns are handled, and harder to support.
- **Expected behaviour:** validate integrality and int4 range up front and reject the
  observation with a typed canonical error and a diagnostic.
- **Missing test:** out-of-range and non-integer quantity handling.

### NEW-CLAUDE-PR5F2B-10 — **P3** — Lock acquisition order deviates from the frozen documented order

See §5.B. Advisory → observation rows → canonical row, versus the mandated
advisory → canonical row → observation rows. Not a live deadlock under this lane's
exclusive per-identity anchor; recorded so the deviation is a decision rather than an
accident.

### NEW-CLAUDE-PR5F2B-11 — **P3** — Full-sync abandonment of expired blockers is unconditional rather than reliance-scoped

- **File / line:** `fencing.ts:201-214` (`abandonExpiredFullSyncBlockers`), called unconditionally at `index.ts:517-520` **before** `decideExistence`.
- **Evidence:** every expired ACTIVE resultless direct on the identity is
  irreversibly transitioned to `ABANDONED`, whether or not the full-sync then relies
  on that expiry — including when the full-sync ends as a `noop` or a
  presence-marker-only update. R-159 Correction 7 scopes durable abandonment to
  *"when expiry is relied upon to unblock a successor canonical mutation."*
- **Assessment:** fail-safe, not fail-open — an expired observation is already denied
  by the lease rule, so making the irreversible state match the logical state loses
  no legitimate evidence. Flagged only because it widens irreversible state changes
  beyond the frozen wording, and the widening is undocumented.
- **Expected behaviour:** confirm and document the widening, or scope the abandonment
  to the reliance case.
- **Missing test:** a full-sync that ends as `noop` must not (or must, explicitly)
  abandon unrelated expired directs.

### Findings summary

| ID | Severity | Area | Reproduced |
|---|---|---|---|
| NEW-CLAUDE-PR5F2B-01 | P2 | Omitted attributes coerced to NULL/`[]` | Yes — PostgreSQL 16 |
| NEW-CLAUDE-PR5F2B-02 | P2 | Item→Variant relationship severed | Yes — PostgreSQL 16 |
| NEW-CLAUDE-PR5F2B-03 | P2 | InventoryLevel attributes never refreshed | Yes — PostgreSQL 16 |
| NEW-CLAUDE-PR5F2B-04 | P2 | Rejection leaves no durable trace | Yes — PostgreSQL 16 |
| NEW-CLAUDE-PR5F2B-05 | P3 | Empty batch throws untyped error | Yes |
| NEW-CLAUDE-PR5F2B-06 | P3 | Null-version freshness downgrade | Code reading (intent query) |
| NEW-CLAUDE-PR5F2B-07 | P3 | Order-sensitive JSON equality | Code reading |
| NEW-CLAUDE-PR5F2B-08 | P3 | Degenerate first-LIVE accepted | Code reading |
| NEW-CLAUDE-PR5F2B-09 | P3 | No quantity domain validation | Code reading + schema |
| NEW-CLAUDE-PR5F2B-10 | P3 | Lock-order deviation | Code reading |
| NEW-CLAUDE-PR5F2B-11 | P3 | Unconditional full-sync abandonment | Code reading |

**No P0 and no P1 finding.** No cross-tenant exposure, no destructive inventory or
financial corruption, no broken authentication, no unrecoverable data loss, no
production-secret exposure. The four P2s are correctness/auditability defects in the
attribute-application layer; none of them affects existence, fencing, serialization,
tenancy, or numeric safety, and none is reachable in production today because no
producer is wired to this lane and all write flags remain OFF.

---

## 7. Independent evidence — commands, exit status, results

All run by me at commit `2abda4b13577355036683b6d92be852740530311`.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run app/lib/catalog-facts` | 0 | 7 files, **51 tests passed** |
| `npm run test` (full unit) | 0 | 13 files, **107 tests passed** |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | 1 file, **59 tests passed**, 12.70 s |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm run build` | 0 | built |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm run tenant:enforcement:inventory:check` | 0 | `tenant_enforcement_inventory_fresh` |
| `git diff --check 5129707..2abda4b` | 0 | no whitespace/conflict damage |

Temporary falsification fixtures: I added a probe suite
(`scripts/tenant-enforcement/tests/zz-claude-probe.test.ts`) plus two throwaway
`tsx` scripts to produce the evidence in §5.C, §5.D, §5.F, §5.G, §5.M and §6. All were
**deleted before this artifact was committed**; the reviewed worktree carries no
tracked modification. No runtime file and no committed test was modified as part of
this review.

Probe outcomes: 9 of 12 passed (confirming spec conformance); the 3 designed to
falsify suspected defects failed as predicted and are written up as
NEW-CLAUDE-PR5F2B-01/-02/-03, with -04 added from a fourth probe.

---

## 8. Risk posture recommendation (advisory only — RISK_REGISTER not edited)

| Risk | Recommended posture after this review | Reason |
|---|---|---|
| **R-157** | **OPEN** | Sequence privilege/allocation regressions are an F1/allocation-path concern; nothing in this lane closes it. Unchanged by this PR. |
| **R-158** | **OPEN, materially advanced** | The canonical apply engine now exists and implements app-issued interval ordering, overlap conflict preservation, and `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT` exactly as the mitigation prescribes. Closure should still wait for the producer lanes (F2A / JSONL / webhook) that actually allocate the generations. |
| **R-159** | **OPEN, materially advanced** | Durable requestGen binding, DB-clock lease boundary, `ACTIVE ⇒ responseGen NULL`, irreversible `ABANDONED`, same-transaction successor abandonment, and fail-closed missing/duplicate token are all implemented and independently reproduced. Corrections 6/7/8 are satisfied in this lane. Keep OPEN until the issuing lanes land. |
| **R-160** | **Applicator-lane gate MET; keep OPEN** | Every canonical writer in this lane is under the frozen `pg_advisory_xact_lock` anchor with deterministic dedup/ordering, no session lock, no unanchored fallback, no `ON CONFLICT DO UPDATE`. R-160's own wording requires proving *every* canonical writer uses it — future lanes must re-prove. |
| **R-161** | **OPEN** | Explicitly not closed. Deployment/concurrency shared-lock-table evidence remains an operational gate outside this lane. |
| **R-162** | **Recommend CLOSED** | The fail-closed guard is implemented on both the direct evaluator inputs and the settings readers, and I independently falsified unsafe integers, `2^53` family, `MAX_VALUE`, zero, negative, NaN, Infinity, floats, strings, and malformed PostgreSQL settings. Every case rejects before arithmetic. This is the downstream consumer R-162 was waiting for. |
| **R-163** | **OPEN** | Untouched. `foundation-safety.test.ts` is byte-identical to base and remains non-recursive; this PR adds an `apply/` subdirectory under `catalog-facts/`, which is exactly the nesting R-163 warned would go unscanned. The defence-in-depth gap is now live, though the substantive no-Shopify/no-delete properties are independently verified above. Recommend the admin-read/query-boundary lane prioritise it. |
| **R-164** | **Applicator-lane acceptance gate MET; keep OPEN** | Proven by narrowed `CanonicalApplyDb` type, exhaustive statement reading, and grep — not by the declarative constant. `stocky_runtime` still holds `DELETE` on all six canonical tables and the generic `TenantDb` still exposes the models, so the risk itself is not closed. |

**No RISK_REGISTER edit was made.** These are recommendations for ChatGPT.

---

## 9. Verdict

The three correction packages do what they claim. The third correction in particular —
separating the full-sync fence from direct Clock-B existence intervals — is correct at
the type, orchestration, and persistence layers, and I reproduced all six of the
mandated adversarial fence orderings independently rather than re-running the
committed assertions. Serialization, fencing, lease/lifecycle, unique-conflict
handling, existence/tombstone/revival, exact-decimal arithmetic, the eight independent
quantity clocks, tenancy/RLS, and transaction atomicity are all sound under adversarial
probing against real PostgreSQL 16.

The four P2 findings are real, reproduced, and merchant-affecting once a producer is
wired, but they are confined to the attribute-application layer. They do not undermine
the Tier-A concurrency, identity, existence, tenancy, or money guarantees this lane
exists to establish, and none is reachable today: no producer lane is wired to the
applicator, PR #31 is DRAFT, and all inventory-write flags remain OFF.

Under the standard that a module is not complete merely because a route or model
exists, and that approval must not exceed the evidence: the concurrency and identity
core is approvable; the attribute-write contract is not yet correct. Because
`NEW-CLAUDE-PR5F2B-01`, `-02`, and `-03` cause **silent** loss or staleness of
authoritative merchant facts — including variant-level identity, which `AGENTS.md`
protects as a non-negotiable product principle — and `-04` removes the audit trail
that would let reconciliation detect it, these must be corrected before this lane is
consumed by any producer.

### FINAL VERDICT

**CORRECTIONS REQUIRED**

Required before approval: `NEW-CLAUDE-PR5F2B-01`, `-02`, `-03`, `-04`.

Recommended in the same package: `-05` through `-11` (all P3; `-06`, `-10`, `-11` may
be resolved by confirming and documenting intent rather than by code change).

This verdict does **not**: close PR #31; merge PR #31; mark PR #31 ready; reopen or
retarget PR #31; authorize production; authorize any Shopify write; enable any
inventory-write flag; close R-157, R-158, R-159, R-160, R-161, R-163, or R-164;
authorize F2C, the JSONL worker, webhook integration, or PR6.

R-157 and R-161 remain OPEN on their own merits; their remaining allocation and
deployment evidence lies outside this isolated applicator lane and is not a blocker
for this lane's correction package.

---

## 10. Artifact and branch disposition

My environment branch directive mandates development on
`claude/pr5-f2b-applicator-tier-a-review-rk327c` and forbids pushing to any other
branch without explicit permission. I therefore did **not** push to
`cursor/pr5-f2b-canonical-applicator-055c`.

- This artifact is committed **only** to `claude/pr5-f2b-applicator-tier-a-review-rk327c`,
  whose parent commit is exactly the reviewed head
  `2abda4b13577355036683b6d92be852740530311`.
- No prior immutable review was modified.
- No runtime file, no committed test, and no `RISK_REGISTER.md` entry was modified.
- PR #31 was not closed, reopened, retargeted, merged, or marked ready.
- **Post-review PR CI has not been produced**, because the artifact was not pushed to
  the PR branch. ChatGPT coordinates artifact integration; exact-head PR CI on a
  review-artifact head must be produced after that integration.
