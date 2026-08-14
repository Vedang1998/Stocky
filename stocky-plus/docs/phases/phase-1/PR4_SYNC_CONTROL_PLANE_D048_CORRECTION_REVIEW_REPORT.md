# Phase 1 PR 4 — D-048 Correction Independent Review Report

**Reviewer:** Claude Code (independent principal engineer / architecture + release-risk review)
**Decision under review:** D-048 — `DispatchReadyShop` readiness/fairness control plane and D-047 correction closure
**Scope:** P2-D047-R01…R04, P3-D047-R05…R13, plus the new `DispatchReadyShop` readiness architecture, lock ordering, merchant-scale boundedness, safe index rollout, plan gates, documentation/risk identity, and the contradictory exact-head CI evidence
**Verdict:** **CORRECTIONS REQUIRED**

This report is immutable. Do not edit it.

---

## 1. Review identity

| Field | Value | Verified how |
|---|---|---|
| Exact reviewed head | `8866a8d67df63bccd23cccef71cd256433a86c7b` | GitHub PR API `head.sha`; `git rev-parse` on fetched `origin/phase-1/sync-control-plane` |
| Confirmed merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | `git merge-base origin/main origin/phase-1/sync-control-plane` |
| `origin/main` tip | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | `git rev-parse origin/main` (unchanged) |
| PR #20 state | **OPEN**, **DRAFT (`draft: true`)**, **UNMERGED (`merged: false`)** | GitHub PR API (`mergeable_state: blocked`) |
| Review branch | `claude/d048-correction-review-7es6kn`, created from the exact head | `git checkout -B … 8866a8d…` |

### Identity gate — all twelve conditions pass

1. PR #20 OPEN — confirmed.
2. PR #20 DRAFT — confirmed (`draft: true`).
3. PR #20 UNMERGED — confirmed (`merged: false`).
4. Head is exactly `8866a8d67df63bccd23cccef71cd256433a86c7b` — confirmed.
5. Merge base is exactly `e69bc53d91db75472b0d0998bf1b74ee6246adb1` — confirmed.
6. PR CI run `31143574559` is exact-head and successful — confirmed.
7. No later commit changed identity — the remote branch resolves to the reviewed SHA.
8. Inventory-write flags remain OFF — `.github/workflows/ci.yml` sets `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES`, `ALLOW_DEV_SUBSCRIPTION_ACTIVATE` all `"false"`.
9. Q-003 remains OPEN — `docs/OPEN_QUESTIONS.md:7`.
10. F-PR4-18 remains OPEN — `PR4_SYNC_CONTROL_PLANE_CORRECTION_BACKLOG.md:228`.
11. PR 5 remains blocked — no PR 5 work performed or started.
12. Production activity remains unauthorized — no production access was used or attempted.

### Immutable D-047 report verification

`git log 5683001..8866a8d -- .../PR4_SYNC_CONTROL_PLANE_D047_CORRECTION_REVIEW_REPORT.md` returns **empty**, and
`git diff --name-only 5683001..8866a8d | grep REVIEW_REPORT` returns **no matches**.
The D-047 immutable review report is byte-identical to its incorporation state. **PASS.**

---

## 2. Exact-head CI evidence

**Pull-request run `31143574559` / job `92758341149`** — conclusion **success**, head `8866a8d…`, no workflow steps skipped. Independently confirmed via the GitHub API.

**Push run `31143571560` / job `92758332115`** — conclusion **failure** on the same SHA, failing step
`npm run test:migrations -- scripts/tenant-enforcement/tests/deadlock-timeout-recovery.test.ts`.
Job logs show the deliberate cancellation the test itself induces:

```
03:20:47.305 UTC [854] ERROR:  canceling statement due to user request
03:20:47.305 UTC [854] STATEMENT:  SELECT pg_sleep(10)
```

Classification is given in §12.

---

## 3. Environment reconstructed

All evidence below was produced locally on a disposable, freshly reconstructed CI-equivalent environment. No production or merchant data was touched.

| Component | Value |
|---|---|
| PostgreSQL | 16.13 (`initdb` under the unprivileged `postgres` user; `max_connections=400`, `shared_buffers=1GB`, `work_mem=16MB`) |
| Redis | 7 (`redis-server`, port 6379) |
| Node / npm | v22.22.2 / 11.5.2 (pinned to match `engines` + CI `Pin npm` step) |
| Env | `.github/workflows/ci.yml` `validate` job env reproduced verbatim, including all inventory-write flags `false` |
| Migration chain | `npx prisma migrate deploy` — **all migrations applied**, ending at `20260807010000_sync_control_plane_d048_dispatch_ready_shop` |
| CI DB provisioning | All twelve `tenant:indexes:*` / `tenant:roles:*` / `tenant:enforcement:*` / `tenant:rls:verify` / `tenant:immutability:verify` steps ran with **exit 0** |

---

## 4. Commands executed — results and exit codes

| Command | Result |
|---|---|
| `npx prisma generate` | exit 0 |
| `npx prisma validate` | exit 0 — schema valid |
| `npx prisma migrate deploy` | exit 0 — full chain applied |
| `npm run tenant:indexes:apply/verify`, `tenant:schema:drift` | exit 0 |
| `npm run tenant:roles:provision/verify`, `tenant:rls:verify`, `tenant:immutability:verify` | exit 0 |
| `npm run tenant:enforcement:preflight/apply/verify/drift`, `…:inventory:check` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npm run graphql-codegen` | exit 0 |
| `npm run sync:inventory:check` | exit 0 |
| `npm run tenant:access:inventory:check` | exit 0 |
| `git diff --check` | exit 0 |
| `npm run test:sync-integration` | **17 files / 206 tests passed**, exit 0 |
| `npm run test:sync-dispatch-recovery` | exit 0 (29 tests) |
| `npm run test:sync-performance` | 3 files / **29 tests passed** |
| `npm run test:migrations` (full) | **49 files / 226 tests passed**, exit 0, **zero skip/todo pollution** |
| `npm run test:migrations -- …/claim-indexes.migration.test.ts` | 3 tests passed |
| `npm run test:vitest-reporters` | 4 tests passed |
| `npm run test:migrations-name-filter-probes` | probes isolated (1 skipped / 1 todo) — no pollution of the main suite |
| `npm run sync:claim-indexes:plan` / `:verify` | `valid_exact` ×2 / `{"ok":true,"indexes":2}` |
| Exact push-failure command ×20 (12 unloaded + 8 under 3× CPU oversubscription) | **20/20 passed** — not reproduced locally |

One transient `test:sync-integration` failure was observed and **discarded as reviewer-induced**: an independent probe of mine truncated shared tables concurrently. Re-run in isolation, the suite is fully green (206/206). This is recorded for honesty; it is not a finding against D-048.

---

## 5. `DispatchReadyShop` schema verdict — **ACCEPTABLE**

Model, migration, index, FK (`ON DELETE RESTRICT`), RLS (`ENABLE` + `FORCE`), control-plane policy and grants, and manifest/roles registration are all present and coherent. `stocky_dispatch_ready_shop_maintain()` and `stocky_dispatch_ready_shop_sync_enabled()` are `SET search_path = pg_catalog, pg_temp`, `REVOKE ALL … FROM PUBLIC`, and are registered in the `APPROVED_APPLICATION_FUNCTIONS` allowlist. `DurableJob.nextEligibleAt` is `NOT NULL` with `@default(now())`, so the `MIN(...) IS NULL ⇒ DELETE` branch cannot be reached by a NULL-valued eligible job.

---

## 6. Readiness lifecycle correctness verdict — **CORRECTIONS REQUIRED**

A 20-case adversarial lifecycle matrix was executed directly against the migrated database, comparing the readiness row to the ground truth `MIN(nextEligibleAt) WHERE state IN ('PENDING','RETRY_WAIT')` after each transition.

**18 of 20 cases PASS**, including: new PENDING; RETRY_WAIT via the legal path; future PENDING; future RETRY_WAIT; `nextEligibleAt` earlier; `nextEligibleAt` later; PENDING→DISPATCH_LEASED; RETRY_WAIT→DISPATCH_LEASED; failed claim/rollback; lease recovery→PENDING; RUNNING→RETRY_WAIT; replay-created work; cancellation; dead-lettering/terminal FAILED; deletion; uninstall disable; reinstall enable; earliest-of-many leaves.

**Two cases fail** — see F-D048-01 and F-D048-02 in §17.

---

## 7. False-negative readiness verdict — **FALSE NEGATIVES ARE POSSIBLE (P1)**

This is the central finding. Concurrent `DurableJob` inserts for the same shop lose updates on the readiness row, and the row can end up pointing **later** than the true earliest eligible job — hiding due work from the dispatcher.

Mechanism: the trigger performs a read-modify-write (`SELECT MIN(...)` then `INSERT … ON CONFLICT DO UPDATE SET "earliestEligibleAt" = EXCLUDED."earliestEligibleAt"`). Under READ COMMITTED, two concurrent transactions each compute a MIN that does not see the other's uncommitted row; the last committer overwrites unconditionally. There is no `LEAST(...)`, no row lock taken before the MIN, and no reconciliation sweep that recomputes a too-late `earliestEligibleAt`.

Measured, 40 trials, concurrent insert of one urgent `PENDING` (due now) and one `RETRY_WAIT` scheduled one hour out on the same shop:

```
urgent job HIDDEN from the dispatcher in 15/40 trials (37.5%)
worst observed hide duration = 60.0 minutes
```

The hidden job becomes visible only when some later job event for that shop happens to fire the trigger again. `heal_empty` cannot correct it (see §9), because that CTE only deletes rows for shops with **no** eligible work.

This materialises **R-121** exactly as the risk register anticipated. Recorded as **F-D048-01 (P1)**.

Sustained soak evidence (25 s, 4 dispatchers + 3 intake + 3 worker connections, ~40 k operations, one-job-per-transaction shape) showed **zero** readiness drift on the aggregate invariants (`missing_rows=0`, `late_readiness=0`, `stale_rows=0`). The defect requires genuine same-shop insert concurrency, which the soak's shop-sharded intake did not consistently produce. It is real but load-shape dependent — not universal.

---

## 8. `shopId` mutation / old-shop readiness verdict — **NOT DB-ENFORCED; TRIGGER EDGE MISHANDLED (P3)**

`DurableJob.shopId` is **not** database-enforced immutable. There is no `CHECK`, no rule, and the `stocky_durable_job_transition_guard_trg` trigger is `BEFORE UPDATE OF state` only — it does not guard `shopId`. A direct `UPDATE "DurableJob" SET "shopId" = …` succeeds.

Executing that update produced:

- NEW shop (`lc-2`) — readiness row correctly **created**;
- OLD shop (`lc-1`) — readiness row **left stale and present**, never recomputed.

The trigger selects a single `target_shop` from `NEW` on updates, so the OLD shop is never recomputed. No cross-shop attachment occurred. No current application writer mutates `shopId`, so this is latent rather than active — recorded as **F-D048-04 (P3)**. Either add DB-enforced immutability and cite it, or handle `OLD."shopId"` in the trigger; the present state does neither.

---

## 9. `heal_empty` self-healing verdict — **NON-FUNCTIONAL (P2)**

The production claim SQL's `heal_empty` CTE is **dead code**. It can never delete a readiness row, because `served` (an `UPDATE`) modifies the very rows `heal_empty` (a `DELETE`) targets, within the same statement. PostgreSQL's documented rule is that a row already modified by one data-modifying CTE cannot be modified again by another in the same statement.

Verified against the **actual production builder** `buildFairClaimLockedSelectSql`, with a planted stale readiness row for a shop having **zero** eligible jobs:

```
before: readinessRows = 1   eligible jobs = 0
cycle 1: claimSqlReturned=0  readinessRowsRemaining=1  lastServedAt=SET
cycle 2: claimSqlReturned=0  readinessRowsRemaining=1  lastServedAt=SET
cycle 3: claimSqlReturned=0  readinessRowsRemaining=1  lastServedAt=SET
>>> heal_empty effective? NO — stale row survives every cycle
```

Consequently the migration comment "False-positive readiness is allowed and **self-heals on the next claim cycle**" and the module docblock's equivalent claim are **false as implemented**. Each stale row permanently consumes one of the `shopCap` fairness slots every cycle; accumulating `shopCap` such rows would starve dispatch entirely. Recorded as **F-D048-02 (P2)** — severity is held at P2 because the per-row trigger deletes rows transactionally on the normal path, so accumulation requires the narrow paths in §8 or out-of-band writes.

---

## 10. Boundedness verdicts

### 10.1 Total-shop boundedness — **PASS**

With active-due held at 10 and total shops scaled 1 000 → 5 000 → 20 000 with a ≥50 000 `DurableJob` backlog: no `Seq Scan on "Shop"`, readiness rows examined remain 10, shared-hit buffers stay under the 5 000 bound, and growth is far below 5×. The D-047 O(total-merchants) discovery regression is genuinely fixed.

### 10.2 Active-due-shop boundedness — **FAIL (P2)**

This is the property §C of the review brief required and the shipped evidence does not establish. Independent `EXPLAIN (ANALYZE, BUFFERS)` grid on PostgreSQL 16, ≥50 000 `DurableJob` backlog, `batchSize=10`, `maxPerShop=2`:

| Case | Total shops | Active due | `DispatchReadyShop` scan | Readiness rows scanned | Fairness sort input | Exec time |
|---|---|---|---|---|---|---|
| A | 1 000 | 10 | Bitmap Heap Scan | 10 | quicksort 25 kB | ~0.8 ms |
| B | 5 000 | 10 | Bitmap Heap Scan | 10 | quicksort 25 kB | ~0.8 ms |
| C | 20 000 | 10 | Bitmap Heap Scan | 10 | quicksort 25 kB | 0.82 ms |
| D | 20 000 | 100 | Bitmap Heap Scan (index scan touched 34 686 entries) | 100 | quicksort 29 kB | 2.35 ms |
| E | 20 000 | 1 000 | **Seq Scan** | 1 000 | quicksort 71 kB | 1.63 ms |
| F | 20 000 | 5 000 | **Seq Scan** | 5 000 | quicksort 427 kB | 5.10 ms |
| G | 20 000 | 20 000 | **Seq Scan** | 20 000 | **quicksort 1 706 kB** | **20.99 ms** |

Scheduling work is **O(active due merchants)** per dispatch cycle — a full scan plus a full sort of the due set — not `≤ shopCap`. Execution time grows ~25× from case C to case G.

Root cause is structural: the index is `(processingEnabled, earliestEligibleAt, lastServedAt, shopId)`, but the query applies a **range** predicate on `earliestEligibleAt` while ordering by `lastServedAt, shopId`. A range predicate on a leading-equality-then-range index cannot deliver the ordering of a subsequent column, so PostgreSQL must materialise and sort the entire due set. This is a planner certainty, not a tuning accident; no `ANALYZE` or cost nudge will fix it. An index such as `(processingEnabled, lastServedAt, shopId) WHERE …` with the due filter applied as a residual, or an explicit sharding/bucketing scheme, would be required.

Accordingly the module docblock's claim — *"Scheduling rows examined ≤ shopCap (SQL LIMIT on DispatchReadyShop) … Independent of total Shop count and total DurableJob backlog"* — is **accurate for total Shop count and backlog but false for rows examined**. Recorded as **F-D048-03 (P2)**, with the documentation overstatement as part of the same finding.

### 10.3 `DurableJob` boundedness — **PASS**

Candidate `DurableJob` rows remain SQL-capped at `shopCap × maxPerShop` in every case. No `Seq Scan on "DurableJob"`, no Bitmap walk of `DurableJob`, and per-shop LATERAL access uses `DurableJob_shop_claim_{pending,retry_wait}_idx` throughout.

---

## 11. Plan / index-order, gate robustness, ordering, and range-pair verdicts

### 11.1 Plan-gate robustness — **PARTIALLY EFFECTIVE; CI COVERAGE GAP (part of F-D048-03)**

To the gate's credit, `assertEligibleClaimPlanShape` **does** detect the §10.2 regression when it is actually shown the plan:

```
activeDue=10    | ReadyShopSeqScan=false | GATE => passed
activeDue=1000  | ReadyShopSeqScan=true  | GATE => THREW: prohibited DispatchReadyShop scan examining 1000 rows (cap ~10)
activeDue=5000  | ReadyShopSeqScan=true  | GATE => THREW: prohibited DispatchReadyShop scan examining 5000 rows (cap ~10)
activeDue=20000 | ReadyShopSeqScan=true  | GATE => THREW: prohibited DispatchReadyShop scan examining 20000 rows (cap ~10)
```

The defect is therefore **not** a blind gate — it is that **CI never exercises the regime**. The shipped `Shop scaling` test pins `active = 10` and scales only empty shops (`sync-performance.test.ts:245`), and the "100+ active / 20k total" probe runs `batchSize = 50`, making the effective cap `50 × 4 = 200` against only 110 due rows — it passes by calibration, not by boundedness.

Two genuine gate weaknesses were also found: there is **no** `Seq Scan on "DispatchReadyShop"` prohibition (only `Shop` and `DurableJob`), and the Sort ceiling reads a Sort node's **output** rows, which `LIMIT`/`LockRows` short-circuits to 10 — the true 20 000-row input is visible only in `Sort Method: … Memory: 1706kB`, which the parser never inspects. The large fairness Sort is caught today only incidentally, via the readiness-rows rule.

Planted-bypass probes against `assertDispatcherUsesProductionFairClaimSql` behave as documented for inline `$queryRaw` claim SQL and `$queryRawUnsafe`. It is a source-text regex scanner and cannot catch an imported alternate helper or claim SQL split across functions; the code comments describe it accurately as a source-boundary guard and do not overstate it.

### 11.2 Runtime / EXPLAIN identity — **PASS**

Runtime `claimBatchFair` (`dispatcher.server.ts:164-166`) and the EXPLAIN harness both consume `buildFairClaimLockedSelectSql`; `buildFairClaimLockedExplainSql` wraps that identical `Prisma.Sql`. Exactly one production-owned claim statement exists. Confirmed by reading both call sites, not by a self-referential assertion.

### 11.3 Ordering — **PASS**

The production statement carries an explicit terminal `ORDER BY shop_slot, claim_next_eligible_at, claim_created_at, id`, with `id` as a total tie-breaker, and the readiness window orders by `lastServedAt ASC NULLS FIRST, shopId ASC`. Ordering is deterministic in the SQL itself, not imposed by test-side sorting. Tie cases on `lastServedAt`, `nextEligibleAt` and `createdAt` resolve stably on `shopId` / `id`.

### 11.4 Range-pair residual / R-122 — **CONFIRMED, CORRECTLY DOCUMENTED**

The equality-vs-range-pair difference reproduces on PostgreSQL 16: bare `"shopId" = $1` regresses to `DurableJob_eligible_*_idx` with a `shopId` Filter, while `"shopId" >= $1 AND "shopId" <= $1` retains the shop-claim Index Scan. The two forms are semantically equivalent. The shipped equality-regression gate exists and passes. The code comment explicitly states this is *"not a PostgreSQL contract"* — an accurate characterisation. **R-122 correctly remains OPEN.**

D-048 did introduce a clean opportunity to retire the competing legacy `DurableJob_eligible_*` indexes rather than preserve the workaround, and that opportunity was not taken. I am **not** authorising destructive index deletion — it is not independently proved safe here, since other query paths may depend on those indexes. It is recorded as a design observation only.

---

## 12. Lock ordering, trigger write amplification, and deadlock verdict

### 12.1 Lock order map

| Transaction | Order |
|---|---|
| Dispatcher claim | `DispatchReadyShop` (FOR UPDATE SKIP LOCKED) → `DurableJob` (FOR UPDATE SKIP LOCKED) |
| Uninstall / cancel | `Shop` → `DispatchReadyShop` (via sync-enabled trigger) → `DurableJob` (FOR UPDATE) |
| New intake | `DurableJob` (INSERT) → `DispatchReadyShop` (via maintain trigger) |
| Worker completion / retry | `DurableJob` (UPDATE) → `DispatchReadyShop` (via maintain trigger) |
| Attempt reaper / lease recovery | `DurableJob` (single job) → `DispatchReadyShop` (via maintain trigger) |
| Replay | `DurableJob` (INSERT) → `DispatchReadyShop` (via maintain trigger) |

Uninstall and the dispatcher share the same readiness-before-`DurableJob` order, so they cannot form a cycle. Worker/intake/replay take the opposite order, which is a textbook ABBA hazard against the dispatcher — but the dispatcher's `FOR UPDATE … SKIP LOCKED` on `DurableJob` means it **skips** rather than waits, breaking the cycle. This is a genuinely sound property of the design.

### 12.2 Empirical results (PostgreSQL lock evidence, `deadlock_timeout=200ms`)

| Probe | Outcome |
|---|---|
| Dispatcher holds readiness; worker leases same-shop job | Worker **blocks** for the dispatcher's transaction duration |
| Worker-first lease, then dispatcher | Dispatcher **not blocked** — SKIP LOCKED skips the shop; self-heals next cycle |
| New intake INSERT vs dispatcher-held readiness | Intake **blocks** for the dispatcher's transaction duration |
| Rollback after readiness locking | **Correct** — `lastServedAt` reverted, second dispatcher immediately reclaims |
| Realistic soak: 4 dispatchers + 3 intake + 3 workers, one job/transaction, 25 s, ~40 k ops | **Zero deadlocks, zero errors, zero readiness drift** |
| Same soak with workers batching 3 jobs across shops per transaction | **21 deadlocks (40P01)** in 25 s |

The multi-job soak produced a genuine 3-way cycle among three ordinary worker transactions, all deadlocking **inside the D-048 readiness trigger**:

```
DETAIL:  Process 17720 waits for ShareLock on transaction 43910; blocked by process 17721.
         Process 17721 waits for ShareLock on transaction 43920; blocked by process 17719.
         Process 17719 waits for ShareLock on transaction 43911; blocked by process 17720.
CONTEXT: while inserting index tuple (51,176) in relation "DispatchReadyShop"
         SQL statement "INSERT INTO public."DispatchReadyShop" … ON CONFLICT ("shopId") DO UPDATE SET
         PL/pgSQL function public.stocky_dispatch_ready_shop_maintain()"
```

### 12.3 Verdicts

**Write amplification — ACCEPTED WITH RESERVATION.** Every `DurableJob` INSERT, DELETE, and `state`/`nextEligibleAt`/`shopId` UPDATE now performs an aggregate `MIN` over the shop's jobs plus a readiness UPSERT. The readiness row becomes a **per-shop serialization point** that all writes for that shop must lock — a coupling that did not exist before D-048. Webhook intake latency for a shop is now bounded below by the dispatcher's claim-transaction duration for that shop. The claim transaction is short (milliseconds), so this is acceptable today, but it is an unmeasured and undocumented new coupling.

**Deadlock — LATENT HAZARD, NOT CURRENTLY REACHABLE (P2).** Every production writer today is single-shop-per-transaction (`recoverExpiredRunningAttempts` and `recoverStrandedEnqueuedJobs` both open one transaction per job; `ackEnqueued` is single-job; uninstall is single-shop), and `claimBatchFair` — the one genuinely multi-shop transaction — acquires all its readiness locks up front in `lastServedAt, shopId` order before touching any job. Nothing enforces, documents, or tests that invariant. The first writer that updates jobs for several shops in one transaction will reintroduce the deadlock above. Recorded as **F-D048-05 (P2)**.

---

## 13. Fairness / starvation verdict — **PASS**

Repeated-cycle measurement against the documented bound `ceil(activeEligibleShops / shopCap)`, `shopCap = batchSize`:

| Active shops | batchSize | Documented bound | Measured worst cycle-to-first-service | All served |
|---|---|---|---|---|
| 11 | 10 | 2 | **2** | yes |
| 25 | 10 | 3 | **3** | yes |
| 300 | 10 | 30 | **30** | yes |
| 2 000 | 20 | 100 | **100** | yes |

The bound holds **exactly**, including at 2 000 active shops. A permanently greedy shop receiving a fresh job every cycle did not starve the other 29 (all served within 3 cycles, bound 3). `RETRY_WAIT`-only, mixed `PENDING`/`RETRY_WAIT`, disabled-shop exclusion, and newly-enabled/reinstalled shops all behave correctly. Readiness completeness at 2 000 shops was exact (2 000 rows, no false negatives).

### `lastServedAt` semantic point — **SEMANTICALLY DEFENSIBLE, DOCUMENTATION INCOMPLETE**

`lastServedAt` is advanced in the `served` CTE when a shop enters the due window, **before** `DurableJob` locking completes. Confirmed empirically that a shop is marked served with zero jobs returned when (a) readiness is a false positive, and (b) every candidate is `SKIP LOCKED` by another dispatcher.

This does **not** invalidate the starvation bound as documented, because the bound is over *service opportunities* and rotation advances uniformly across the window — no shop is skipped in rotation. It does mean the bound guarantees **opportunity**, not **throughput**: a shop can be counted as served without any work progressing. For case (b) that is correct (another dispatcher is working those jobs). For case (a) it is not, and combined with the dead `heal_empty` (§9) a false-positive row consumes a fairness slot indefinitely. Transaction rollback correctly reverts `lastServedAt`. The documentation should state the opportunity-vs-throughput distinction explicitly.

---

## 14. Concurrency and capacity refill verdict — **PASS**

2-way and 4-way dispatcher contention, repeated, on fixtures with sufficient eligible unlocked work: readiness windows are disjoint (`FOR UPDATE OF r SKIP LOCKED` on the readiness rows); no duplicate `DurableJob` claims; no duplicate `JobDispatch`; no illegal state transitions (the DB `stocky_durable_job_transition_guard_trg` independently rejected every illegal edge attempted in my probes with SQLSTATE 23514); aggregate fill approaches `min(eligible work, N × batchSize)` where per-shop and fairness constraints permit; a dispatcher does not return zero merely because another took the first window; rotation remains correct after concurrent commits; rollback releases both readiness and `DurableJob` capacity; and no starvation was observed across repeated concurrent cycles. Verified both same-shop and many-shop contention.

---

## 15. Safe claim-index rollout and D-048 migration verdict — **PASS**

`scripts/sync-control-plane/claim-indexes.ts` builds with **`CREATE INDEX CONCURRENTLY`** (line 160), detects invalid/partial builds via `indisvalid`/`indisready` (line 128), and recovers with `DROP INDEX CONCURRENTLY IF EXISTS` (line 147). `plan` reports `valid_exact` for both indexes and `verify` returns `{"ok":true,"indexes":2}` on a populated database. `claim-indexes.migration.test.ts` explicitly proves *"subsequent prisma migrate deploy is a no-op for claim indexes"*, so the historical D-047 migration does not take the blocking build path after concurrent pre-creation. Fresh-database `prisma migrate deploy` also succeeds (§3).

The D-048 migration itself is additive and safe in shape: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, idempotent FK via exception-guarded `DO` block, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, and a `GROUP BY` backfill with `ON CONFLICT DO UPDATE`.

One rollout caveat worth stating plainly: the backfill aggregates over the **entire** `DurableJob` table in a single statement inside the migration transaction, and `CREATE TRIGGER` on `DurableJob` takes an `ACCESS EXCLUSIVE` lock. On a large populated table this is a blocking window. It is correct, and production rollout is unauthorised, but the eventual rollout contract should document the expected lock duration rather than leave it implicit.

---

## 16. Name-filter / reporter verdict — **PASS**

Full `test:migrations` runs **49 files / 226 tests, exit 0, with zero skip/todo pollution** (`grep -cE "skipped|todo"` on the full output returns `0`). The skip/todo probes are correctly isolated into `vitest.migrations-name-filter-probes.config.ts`. The reporter unit tests (`test:vitest-reporters`, 4 tests) drive `failOnZeroPassedNameFilter` with synthetic Vitest task trees and assert `process.exitCode === 1` on a zero-pass name filter — they would genuinely detect a Vitest reporter API/contract reshape. Normal Vitest failures remain visible (independently observed when my probe raced the integration suite: the run failed loudly with a full stack trace). No fail-open focused migration gate remains.

---

## 17. Contradictory exact-head CI evidence — classification

**Disposition: (A) PRE-EXISTING TEST/HARNESS RACE — NON-BLOCKING KNOWN HARNESS FLAKE, WITH TRACKING REQUIRED.**

Evidence for this classification:

1. **D-048 did not touch the test or its mechanism.** `scripts/tenant-enforcement/tests/deadlock-timeout-recovery.test.ts` is absent from `git diff --name-only 5683001..8866a8d`.
2. **D-048's shared-infrastructure changes do not reach this step.** D-048 did modify `scripts/tenant-enforcement/manifest.ts` (added a `DispatchReadyShop` spec entry), `scripts/tenant-enforcement/roles.ts` (allowlisted the two new functions), and `vitest.migrations.config.ts`. I checked the last one specifically because it is the config the failing step uses: the only changes are to the `include` array (probes removed, claim-index tests added) and comments. The failing step is a **path-filtered single-file run** of a file matched by the unchanged `scripts/tenant-enforcement/tests/**` glob, and the `reporters:` line predates D-048. Suite composition and reporter semantics for that step are unchanged.
3. **The mechanism is a pre-existing late-attached rejection handler.** At `deadlock-timeout-recovery.test.ts:195` the test issues `const sleeping = sleeper.query("SELECT pg_sleep(10)")` with **no rejection handler attached**, then awaits a 100 ms timer and a `pg_cancel_backend` round trip before reaching `await sleeping` at line 207. If the cancellation rejection lands while that gap is open and the microtask queue drains, Node reports an unhandled rejection; the later `await` then produces `PromiseRejectionHandledWarning`. This matches the reported CI symptom precisely — all six assertions pass, then Vitest fails the run on a late unhandled rejection. The CI log confirms the deliberate cancellation (`ERROR: canceling statement due to user request / STATEMENT: SELECT pg_sleep(10)`).
4. **The gap is timing-sensitive and widens on a loaded runner** — consistent with the PR workflow passing and the concurrent push workflow failing on the same SHA, and with the two runs having raced for the same runner resources.

**Honest limitation:** I could **not** reproduce the failure locally in 20 attempts (12 unloaded, 8 under 3× CPU oversubscription). The classification therefore rests on code-level mechanism plus commit-range evidence, not on a local reproduction. I did not change any code to fix it, per scope.

This is **not harmless** and must not be waved through as noise: it makes a release-evidence gate non-deterministic, and a genuine future failure in that test could be mistaken for the same flake. The correct fix is one line — attach the handler at creation (`const sleeping = sleeper.query(...); sleeping.catch(() => {});`) — and it should be tracked as its own CI-reliability item rather than absorbed into D-048.

---

## 18. Findings

### P0

None. No cross-tenant exposure, no destructive inventory or financial corruption, no broken authentication, no unrecoverable data loss, no production-secret exposure. Tenant isolation, RLS, role separation, and the `DurableJob` transition guard all held under every adversarial probe.

### P1

**F-D048-01 · P1 · Concurrent same-shop job inserts lose the readiness update and hide due work**

- **File / line:** `prisma/migrations/20260807010000_sync_control_plane_d048_dispatch_ready_shop/migration.sql`, `stocky_dispatch_ready_shop_maintain()` — the `SELECT MIN(...)` at the function head combined with `ON CONFLICT ("shopId") DO UPDATE SET "earliestEligibleAt" = EXCLUDED."earliestEligibleAt"`.
- **Evidence:** 40-trial concurrent-insert probe — an urgent `PENDING` job due now was hidden from the dispatcher in **15/40 trials (37.5%)**, worst observed hide duration **60.0 minutes**. Lifecycle matrix case 19 independently shows `readiness row = 11:36:06` against ground truth `MIN = 11:35:06`.
- **Merchant impact:** Webhook-driven sync work for a merchant is silently delayed by up to the concurrently-scheduled retry backoff. No alert, no `DataIssue`, no reconciliation. Inventory and order data go stale for that merchant while the system reports healthy.
- **Reproduction:** Open two connections. Concurrently `INSERT` into `DurableJob` for the same `shopId`: one `PENDING` with `nextEligibleAt = now()`, one `RETRY_WAIT`-equivalent with `nextEligibleAt = now() + 1 hour`. Inspect `DispatchReadyShop."earliestEligibleAt"` — it is frequently the later value. The shop is then absent from `WHERE "earliestEligibleAt" <= now()`.
- **Expected behavior:** The readiness row must never be later than `MIN(nextEligibleAt)` over the shop's `PENDING`/`RETRY_WAIT` jobs, under any interleaving.
- **Recommended correction:** Serialize the read-modify-write — take the readiness row lock **before** computing the MIN (e.g. an `INSERT … ON CONFLICT DO UPDATE` that establishes the row and locks it, or `pg_advisory_xact_lock(hashtext(shopId))` at the top of the trigger), then recompute. A bare `LEAST(EXCLUDED…, existing…)` is **not** sufficient on its own, because it would break the legitimate "nextEligibleAt moves later" case (matrix case 6).
- **Missing test:** A concurrent same-shop insert/update race asserting the readiness invariant, and a periodic drift-reconciliation assertion. Note that the drift query I used (`missing_rows` / `late_readiness` / `stale_rows`) is exactly the shape such a test needs.

### P2

**F-D048-02 · P2 · `heal_empty` is dead code; documented self-healing does not occur**

- **File / line:** `app/sync/fair-claim-query.server.ts`, `heal_empty` CTE; and the migration comment "False-positive readiness is allowed and self-heals on the next claim cycle."
- **Evidence:** §9 — a planted stale row survives three consecutive cycles of the real production statement. PostgreSQL forbids a second modification of a row already modified by `served` in the same statement.
- **Merchant impact:** Stale readiness rows permanently consume fairness slots; accumulating `shopCap` of them starves dispatch entirely for all merchants.
- **Reproduction:** Insert a `DispatchReadyShop` row for a shop with no eligible jobs; run `buildFairClaimLockedSelectSql` repeatedly; the row persists.
- **Expected behavior:** Stale readiness rows are removed, as documented.
- **Recommended correction:** Move the heal to a separate statement after the claim transaction, or exclude healed shops from `served`. Correct the migration comment and module docblock either way.
- **Missing test:** A stale-row self-heal assertion driven through the production builder — the shipped `dispatch-ready-shop.test.ts` does not cover it.

**F-D048-03 · P2 · Scheduling is O(active due merchants) per cycle; boundedness claim overstated and CI never exercises the regime**

- **File / line:** `app/sync/fair-claim-query.server.ts` `due_shops` CTE and its "Boundedness" docblock; `prisma/schema.prisma:88` index definition; `app/sync/__tests__/sync-performance.test.ts:245` and `:336-364`.
- **Evidence:** §10.2 grid — `Seq Scan on "DispatchReadyShop"` from 1 000 active due shops upward; 20 000 rows scanned and a 1 706 kB fairness sort at 20 000 active; 20.99 ms vs 0.82 ms at 10 active. §11.1 — the gate detects it but CI pins `active = 10`, and the 110-active probe passes only because `batchSize = 50` raises the cap to 200.
- **Merchant impact:** At scale, every dispatch cycle scans and sorts every active merchant. Dispatch throughput degrades as the merchant base grows — the precise class of regression D-047/D-048 set out to eliminate.
- **Reproduction:** Seed 20 000 shops each with an eligible job; `EXPLAIN (ANALYZE, BUFFERS)` the production statement.
- **Expected behavior:** Scheduling work bounded by `shopCap`, independent of the active-due merchant count.
- **Recommended correction:** Redesign the readiness index/ordering so the fairness order is index-satisfiable under the due predicate (e.g. `(processingEnabled, lastServedAt, shopId)` with the due filter as a residual, or time-bucketing `earliestEligibleAt`). Correct the docblock's "rows examined ≤ shopCap" claim. Add `Seq Scan on "DispatchReadyShop"` to the gate's prohibitions and make the Sort rule read `Sort Method … Memory`, not output rows.
- **Missing test:** An **active-due** scaling gate at 1 k / 5 k / 20 k with `maxReadyShopRows` tied to the real `shopCap`.

**F-D048-05 · P2 · Latent multi-shop lock-ordering hazard in the readiness trigger**

- **File / line:** `stocky_dispatch_ready_shop_maintain()` readiness UPSERT.
- **Evidence:** §12.2 — 21 deadlocks (SQLSTATE 40P01) in 25 s when workers batch three jobs across shops per transaction, with the PostgreSQL `CONTEXT` naming the trigger's `ON CONFLICT` as the blocking site. Zero deadlocks at the current one-job-per-transaction shape across ~40 k operations.
- **Merchant impact:** None today. Any future writer that touches several shops' jobs in one transaction will abort at a nonzero rate, and could corrupt attempt accounting if 40P01 is treated as a job failure rather than a retryable abort.
- **Reproduction:** Run concurrent transactions each updating `state` on 3 `DurableJob` rows belonging to different shops in differing orders.
- **Expected behavior:** A documented, enforced lock-ordering discipline, or ordering imposed inside the trigger.
- **Recommended correction:** Document the single-shop-per-transaction invariant explicitly and add a guard or lint; alternatively acquire readiness locks in a canonical `shopId` order.
- **Missing test:** A multi-shop-transaction deadlock regression test asserting the invariant.

### P3

**F-D048-04 · P3 · `DurableJob.shopId` is not DB-enforced immutable and the trigger leaves a stale OLD-shop readiness row**

- **File / line:** `prisma/schema.prisma:739`; `stocky_dispatch_ready_shop_maintain()` `target_shop := NEW."shopId"`; trigger declared `UPDATE OF … "shopId"`.
- **Evidence:** §8 — a direct `UPDATE "DurableJob" SET "shopId" = …` succeeds; NEW shop readiness created, OLD shop readiness left stale.
- **Merchant impact:** None today (no writer mutates `shopId`); a stale row would consume a fairness slot permanently given F-D048-02.
- **Expected behavior:** Either DB-enforced immutability with the enforcement cited, making the trigger edge unreachable, or correct handling of `OLD."shopId"`.
- **Recommended correction:** Extend `stocky_durable_job_transition_guard` to reject `shopId` changes, and cite it in the trigger comment.
- **Missing test:** A `shopId`-immutability assertion.

**F-D048-06 · P3 · Deadlock-timeout recovery test attaches its rejection handler late, making CI non-deterministic**

- **File / line:** `scripts/tenant-enforcement/tests/deadlock-timeout-recovery.test.ts:195` vs `:207`.
- **Evidence:** §17. Pre-existing; not introduced by D-048; not reproduced locally in 20 attempts.
- **Recommended correction:** `const sleeping = sleeper.query(...); sleeping.catch(() => {});` at creation. Track as a CI-reliability item, not a D-048 finding.

---

## 19. Documentation / risk / identity verdict — **MOSTLY ACCURATE, TWO OVERSTATEMENTS**

Accurate and correctly maintained: R-119, R-120, R-121, R-122 all remain **OPEN** with faithful descriptions — R-121 in particular names precisely the failure mode that F-D048-01 shows materialising, which is to the authors' credit. Q-003 and F-PR4-18 remain **OPEN**. The PR body matches live identity, states the draft/unmerged posture correctly, and — notably — **surfaces the contradictory CI evidence itself and explicitly asks for independent classification rather than dismissing it**. Prior immutable review reports are unchanged.

Two overstatements require correction (folded into F-D048-02 and F-D048-03): the "self-heals on the next claim cycle" claim, and the "scheduling rows examined ≤ shopCap" claim.

## 20. D-045 / D-046 regression verdict — **NO REGRESSION**

No concrete regression evidence was found against previously accepted D-045/D-046 findings. Exactly-once semantics, worker finalize, envelope fail-closed, attempt recovery, dispatch recovery, uninstall, intake corrections, and role isolation are all green (206/206 in `test:sync-integration`). No accepted finding is reopened.

## 21. Safety / scope verdict — **COMPLIANT**

PR #20 was not merged, not marked ready, and not modified. Nothing was committed to `phase-1/sync-control-plane`. No findings were fixed. PR 5 was not started. No inventory-write flag was enabled. No production migration, merchant/production data access, production queue execution, or webhook replay occurred. No history was rewritten, amended, rebased, squashed, or force-pushed. All work ran against a disposable local PostgreSQL 16 / Redis 7 instance. Temporary probe scripts were deleted; `git diff --check` is clean and only this report is added.

---

## 22. Verdict

**CORRECTIONS REQUIRED**

D-048 is a substantial and largely well-executed architectural correction. The D-047 O(total-merchants) discovery regression is genuinely fixed; the fairness bound `ceil(A / shopCap)` holds exactly, measured up to 2 000 active shops; 2-way and 4-way concurrency, refill, rollback, and ordering are correct; the runtime/EXPLAIN single-statement identity holds; the safe concurrent index rollout is sound; and the plan gate is honest — it detects the boundedness regression when shown it. The authors also disclosed the contradictory CI evidence rather than burying it.

Closure cannot be approved because:

1. **F-D048-01 (P1)** — concurrent same-shop inserts lose the readiness update and hide due work for up to the retry backoff (measured: 37.5% of trials, worst 60 minutes), with no reconciliation path. This is R-121 materialising, and it is exactly the "false-negative readiness can permanently hide work" risk the review scope singled out.
2. **F-D048-02 (P2)** — the `heal_empty` safety net that the design relies on to make false-positive readiness self-correcting is dead code, so F-D048-01 has no compensating sweep and stale rows are permanent.
3. **F-D048-03 (P2)** — scheduling remains O(active due merchants) per cycle, the docblock's boundedness claim is stronger than what the implementation delivers, and CI is calibrated such that the regression cannot fire.
4. **F-D048-05 (P2)** — a latent multi-shop lock-ordering hazard sits behind an undocumented, unenforced invariant.

The exact-head push CI failure is classified as a **pre-existing harness flake (F-D048-06, P3)** — non-blocking for D-048, but requiring its own tracked CI-reliability correction. That classification rests on mechanism and commit-range evidence; it was not reproduced locally in 20 attempts, and that limitation is stated rather than papered over.

R-119, R-120, R-121, R-122 must remain **OPEN**. Q-003 and F-PR4-18 must remain **OPEN**. PR 5 remains blocked. Inventory writes remain disabled. Production activity remains unauthorized.
