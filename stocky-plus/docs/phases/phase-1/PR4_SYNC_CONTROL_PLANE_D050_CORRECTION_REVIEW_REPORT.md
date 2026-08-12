# PR 4 — Sync Control Plane · D-050 Correction · Independent Review Report

**Reviewer:** Claude Code (independent principal engineer / architecture, security and release-risk review)
**Review type:** Focused independent D-050 correction review (not a full PR 4 re-review)
**Status:** IMMUTABLE — this report must never be edited after commit.

---

## 1. Review identity

| Field | Value | Verified |
|---|---|---|
| Reviewed implementation SHA | `62f4cff0ec2c0ec9542959fb65be29b26997e603` | ✅ independently confirmed as PR #20 head |
| Authorized main / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ `git merge-base origin/main origin/phase-1/sync-control-plane` |
| PR | #20 — **OPEN**, **DRAFT**, **UNMERGED** | ✅ `state=open`, `draft=true`, `merged=false` |
| D-049 independent review commit | `30955f844967e79523d543d245a4b58b70cbdc66` | ⚠️ object not present in this repository (cherry-picked from another clone); blob identity verified instead |
| Incorporated D-049 review blob | `aa713ad37147e8b9ca1eadfdc60c1c0f50a7ec8f` | ✅ `git rev-parse 62f4cff:…D049_CORRECTION_REVIEW_REPORT.md` |
| D-049 review SHA256 | `5fd063181dde9e87b32f39f621813045827df905806309e61c393bc96e446bd0` | ✅ `git show … \| sha256sum` matches exactly |
| Delta `50dcac90…` → `62f4cff…` | 1 file, +6/−3, documentation only | ✅ `git diff --stat` |

### Exact-head CI (independently confirmed via GitHub API, not from Cursor's return packet)

| Event | Run | Job | `head_sha` | Conclusion |
|---|---|---|---|---|
| PUSH | `31542495663` (run #273) | `93947852307` | `62f4cff0ec2c0ec9542959fb65be29b26997e603` ✅ | **success** ✅ |
| PULL REQUEST | `31542499135` (run #274) | `93947862976` | `62f4cff0ec2c0ec9542959fb65be29b26997e603` ✅ | **success** ✅ |

### Identity-gate conditions

| # | Condition | Result |
|---|---|---|
| 1–3 | PR #20 OPEN / DRAFT / UNMERGED | ✅ |
| 4 | Head is exactly `62f4cff…` | ✅ |
| 5 | Merge base is exactly `e69bc53…` | ✅ |
| 6 | Push CI on exact SHA, success | ✅ |
| 7 | PR CI on exact SHA, success | ✅ |
| 8 | No later commit changed review identity | ✅ (head unchanged throughout review) |
| 9 | Inventory-write flags OFF | ✅ all five `FEATURE_*` flags `false` |
| 10 | Q-003 OPEN | ✅ |
| 11 | F-PR4-18 OPEN | ✅ |
| 12 | PR 5 blocked | ✅ `PROJECT_STATUS.md` — BLOCKED |
| 13 | Production activity unauthorized | ✅ none performed |

**Identity gate: PASSED.**

---

## 2. Environment reconstructed

Fully independent environment; no production, no merchant data, no queue execution, no webhook replay.

| Component | Value |
|---|---|
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), fresh cluster, port 55432 |
| Redis | 7.x, fresh instance, port 56379 |
| Node / npm | 22.22.2 / 11.5.2 (pinned per CI) |
| Repository state | detached worktree at `62f4cff…` |
| Migration chains applied | 3 independent fresh chains (`stocky_plus_ci`, `fresh2`, and a D-049-state chain for the migration test) |
| Roles/enforcement | `tenant:indexes:apply`, `tenant:roles:provision`, `tenant:enforcement:apply`, `sync:roles:provision` all applied and verified |

Independent probe harness (written for this review, transcribing the production SQL builders verbatim rather than importing them where independence mattered) lives outside the repository and is not committed.

---

## 3. Commands executed and results

All commands below were executed directly by this reviewer in the environment above.

| Command / probe | Result |
|---|---|
| `npx prisma generate` / `validate` | exit 0 / schema valid |
| `npx prisma migrate deploy` (chain 1, fresh DB) | exit 0 — all migrations applied |
| `npx prisma migrate deploy` (chain 2, second fresh DB) | exit 0 |
| D-049-state chain (D-050 folder removed) | exit 0 — row-level `stocky_dispatch_ready_shop_maintain_trg` present, statement triggers absent |
| `npm run test:sync-performance` (clean run 1) | exit 0 — **53/53 passed** |
| `npm run test:sync-performance` (clean run 2) | exit 0 — **53/53 passed** |
| `npm run test:sync-integration` | exit 0 — **230/230 passed** (19 files) |
| `npm run test:sync-dispatch-recovery` | exit 0 — **29/29 passed** |
| `npm run test:sync-exactly-once` | exit 0 |
| `npm run test:migrations` | **1 failed / 225 passed** — failure caused by this reviewer's leftover databases (see §14); re-verified clean in isolation |
| `npm run test:migrations-name-filter-probes` | exit 0 |
| `npm run test:vitest-reporters` | exit 0 — 4/4 |
| deadlock-timeout harness ×50 | **50/50 consecutive passes, 0 failures** (6 tests each, 300 test executions) |
| `npm run lint` / `typecheck` / `build` / `graphql-codegen` | exit 0 / 0 / 0 / 0 |
| `sync:inventory:check`, `tenant:access:inventory:check`, `tenant:access:audit`, `tenant:enforcement:inventory:check` | exit 0 (all) |
| `sync:claim-indexes:plan` / `apply --apply` / `verify` | exit 0 / 0 / 0 |
| `git diff --check` | exit 0 — clean |
| Independent probe: 1,000 claim-vs-writer races | 1000 runs, **0 violations** |
| Independent probe: advisory-lock throughput 1/2/4/10/25/50/100 × 4 workloads | 0 deadlocks; convoy measured (see §9) |
| Independent probe: head-of-line blocking | unrelated intake stalls for full holder duration |
| Independent probe: expired-lease recovery matrix | all cases correct, 0 duplicates |
| Independent probe: D-050 migration under live traffic | 27 ms apply, 5,537 writes, **0 errors**, **0 drift** |
| Independent probe: active-due EXPLAIN 10/100/1k/5k/20k | bounded, index-driven |
| Independent probe: locked-prefix 0/10/100/1k/5k + 2-way/4-way | returned ≤ shopCap; examined = prefix + shopCap |
| Independent probe: fairness (healthy through 2,000 shops; stale matrix) | within independently-derived bounds |
| Independent probe: admission delay 0…5,000 ms | max delay exactly 1,000 ms |
| Independent probe: statement-trigger + writer-cardinality matrix | all cardinalities and writers correct (see §7) |

> **Note on a transient false alarm.** An early `test:sync-performance` run showed 5 D-050 failures. Root cause was this reviewer's own debug scripts truncating `DurableJob` / `DispatchReadyShop` mid-suite. Two subsequent runs with an undisturbed database passed 53/53. This was reviewer interference, **not** an implementation defect, and is recorded here for evidentiary honesty.

---

## 4. Split READ COMMITTED protocol (Section A)

Verified by source inspection (`app/sync/fair-claim-query.server.ts`, `app/sync/dispatcher.server.ts:163-249`) **and** by observing transaction behaviour, not comments.

| Requirement | Verdict | Evidence |
|---|---|---|
| Scheduler locks readiness rows only | ✅ | `buildFairClaimSchedulerLockSql` — `FOR UPDATE OF r SKIP LOCKED LIMIT shopCap` inside a MATERIALIZED CTE; contains no `DELETE`, no reschedule, no MIN recomputation, no readiness mutation of any kind |
| Job candidates locked for scheduler-selected shops | ✅ | `buildFairClaimJobCandidateSql` receives a parameterized `VALUES (shopId, ordinal)` relation built from the scheduler result — no independent shop rediscovery |
| Lease CAS transitions the selected jobs | ✅ | dispatcher `UPDATE … WHERE id = … AND state = <observed>` |
| Reconciliation is a genuinely later statement | ✅ | separate `tx.$queryRaw` after the CAS loop; PostgreSQL gives each statement a fresh READ COMMITTED snapshot. Directly demonstrated: a writer committing between statement A and statement D **is** seen by D (probe scenario `writer_commits_before_scheduler_lock` and the repo's own fresh-snapshot test) |
| All four steps in one READ COMMITTED transaction | ✅ | single `prisma.$transaction` |
| Readiness locks held until transaction completion | ✅ | demonstrated: a concurrent writer touching the same readiness row blocks until dispatcher COMMIT (probe scenario `writer_blocks_behind_scheduler_lock`) |

**Scheduler-lock statement verdict: PASS. Job-candidate statement verdict: PASS. Fresh-snapshot reconciliation verdict: PASS.**

---

## 5. F-CLAUDE-D049-01 — false-negative readiness (Section B)

Highest-priority gate. Independent harness, production SQL transcribed verbatim, **1,000 races** across all ten required interleavings (100 each).

| Interleaving | Runs | Transient anomalies | Permanent false negatives |
|---|---|---|---|
| stale due readiness + committed new PENDING | 100 | 0 | **0** |
| stale due readiness + committed RETRY_WAIT | 100 | 0 | **0** |
| stale readiness + earlier job | 100 | 0 | **0** |
| stale readiness + future job | 100 | 0 | **0** |
| claim/reconcile racing cancellation | 100 | 0 | **0** |
| claim/reconcile racing deletion | 100 | 0 | **0** |
| writer commits before scheduler readiness lock | 100 | 0 | **0** |
| writer blocks behind scheduler readiness lock | 100 | 0 | **0** |
| writer rolls back after trigger work | 100 | 0 | **0** |
| processingEnabled changes concurrently | 100 | 0 | **0** |
| **Total** | **1,000** | **0** | **0** |

After every committed race the harness evaluated DurableJob ground truth and required: eligible work ⇒ readiness row exists; readiness hint not later than actual earliest eligible work (plus the approved 1 s anti-reset budget); readiness enabled; and — the permanence test — that a subsequent dispatch cycle could actually discover and claim the work.

**Writer-behind-lock proof.** With the dispatcher holding readiness locks from statement A, the blocked writer's `INSERT … ON CONFLICT` waits. Reconciliation may then `DELETE` or reschedule on its fresh snapshot. On dispatcher COMMIT the writer resumes; PostgreSQL re-attempts the speculative insertion, so a deleted row is recreated and a future-rescheduled row is pulled earlier by the monotonic `CASE` branch. Correct readiness is restored **before the writer commits** in all 100 trials.

**False-negative readiness verdict: PASS — zero permanent missing-readiness outcomes in 1,000 races.**

---

## 6. Reconciliation correctness (Section C)

`buildFairClaimReadinessReconcileSql` computes `truth` per locked shop from a fresh snapshot, then routes each shop to exactly one of three mutually exclusive CTEs:

- `heal_empty` — `actual_earliest IS NULL` → DELETE
- `reschedule_future` — `actual_earliest > now` → UPDATE to the true future time
- `served` — `actual_earliest <= now` → advance to `GREATEST(actual_earliest, now + 1 ms)`

The three predicates partition the domain (`NULL`, `> now`, `<= now`), so no readiness row can be both UPDATEd and DELETEd ambiguously in one statement. The shop set is exactly the scheduler-locked list passed from statement A. Planted-state probes (empty stale readiness, future-only work, hint older than truth, stale rows ahead of legitimate work, concurrent arrival during reconciliation) behaved correctly in every case, and the single-statement stale-snapshot race of D-049 could not be reproduced.

**Verdict: PASS.**

---

## 7. Statement-level trigger semantics (Section D)

Triggers verified installed at the reviewed SHA: `stocky_dispatch_ready_shop_maintain_insert_stmt_trg` (AFTER INSERT, NEW TABLE), `stocky_dispatch_ready_shop_maintain_update_stmt_trg` (AFTER UPDATE, OLD+NEW TABLE), `stocky_dispatch_ready_shop_sync_enabled_stmt_trg` (Shop, AFTER UPDATE), plus the retained `stocky_durable_job_transition_guard_trg`. The obsolete row-level `stocky_dispatch_ready_shop_maintain` and the custom-GUC boundary are gone.

Multi-row statement matrix (1 / 2 / 3 / 50 / 100 shops, 1–5 rows per shop, PENDING, RETRY_WAIT, mixed, and readiness-irrelevant transitions): every case produced exactly one readiness row per affected shop and no extras —
1 shop × 1 row → 1; 2 × 1 → 2; **100 × 1 → 100**; 3 × 5 (repeated rows per shop) → 3; 2 × 3 RETRY_WAIT → 2; 50 × 2 RETRY_WAIT → 50.
A single mixed statement carrying PENDING, RETRY_WAIT, ENQUEUED and SUCCEEDED rows for four different shops created readiness for **only the two eligible shops**.
A multi-shop terminal `UPDATE … SET state='CANCELLED'` across 5 shops caused **no readiness movement at all** (5 rows before, 5 after).
Bulk `Shop.processingEnabled` disable then re-enable across 100 shops propagated to **100/100** readiness rows in both directions.

The UPDATE trigger's filter admits only become-eligible, earlier-scheduled, and PENDING↔RETRY_WAIT transitions. Terminal, later and removal transitions produce no readiness movement — fail-safe in the correct direction (false positives acceptable, false negatives not). Shops are deduplicated by `GROUP BY "shopId"` and processed in `ORDER BY "shopId" ASC`.

**Statement-level trigger verdict: PASS. Runtime writer shop-cardinality verdict: PASS** — no legitimate runtime writer is broken; the D-049 single-shop boundary that aborted multi-shop statements is removed. I reproduced the original D-049 defect directly for contrast: on a D-049-state database, a multi-shop `DurableJob` insert fails with `stocky_single_shop_dispatch_ready_tx: multi-shop readiness mutation in one transaction is unsupported`. The same statement succeeds at D-050.

---

## 8. Expired dispatch-lease recovery (Section F)

Production `recoverExpiredDispatchLeases` runs `buildExpiredDispatchLeaseRecoverySql` on its own autocommit statement before the claim transaction (`dispatcher.server.ts:138-150`, called at line 1347) — deterministic `ORDER BY leaseExpiresAt, id`, `FOR UPDATE SKIP LOCKED`, `LIMIT` (default 100).

| Case | Result |
|---|---|
| 1 shop / 1 expired lease | 1 recovered, readiness recreated |
| 1 shop / 25 leases | 25 recovered, 1 readiness row |
| 2 shops | 10 recovered, 2 readiness rows |
| **100 shops** | **100 recovered, 100 readiness rows** |
| 300 leases, limit 100 | drained in 4 bounded calls, all 300 recovered |
| 2 concurrent callers | 200 total, **0 duplicates** |
| 4 concurrent callers | 200 total, **0 duplicates** |
| racing normal dispatch | no error, 100 recovered |
| rollback then retry | atomic — 0 recovered after rollback, 25 on retry |
| real `dispatchPendingJobs` entrypoint, multi-shop | repository suite `expired lease recovery: 1 shop, multi lease, ≥2 shops, 100 shops, concurrent` passed in both clean runs |

The D-049 global-outage fixture (single-shop GUC aborting an unqualified cross-shop recovery and thereby halting the entire dispatch loop) **no longer reproduces**.

**Expired-lease recovery verdict: PASS.**

---

## 9. Global advisory lock (Section E) — FINDING

`stocky_dispatch_ready_shop_maintain_insert_stmt()`, `…_update_stmt()` and `…_sync_enabled_stmt()` each take

```sql
PERFORM pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain', 0));
```

a **single global key**, held to COMMIT, for every readiness-maintaining write across every merchant. Zero deadlocks is not sufficient evidence; I measured throughput and latency.

Workloads write to **distinct shops only** — there is no logical contention. `control_no_readiness` performs identical write volume with an `ENQUEUED` insert, which does no readiness work and therefore takes no advisory lock.

| Concurrency | control tps | intake tps | retry tps | lease-recovery tps |
|---|---|---|---|---|
| 1 | 530 | 859 | 559 | 373 |
| 2 | 1,258 | 1,689 | 1,132 | 476 |
| 4 | 1,933 | 1,627 | 1,488 | 409 |
| 10 | 2,279 | 1,402 | 1,348 | 386 |
| 25 | 2,437 | 1,295 | 1,238 | 296 |
| 50 | 2,596 | 1,275 | 1,144 | 239 |
| 100 | **3,258** | **1,229** | **1,146** | **320** |

| Concurrency | control p50 / p99 (ms) | intake p50 / p99 | lease-recovery p50 / p99 / max |
|---|---|---|---|
| 1 | 1.15 / 8.46 | 1.02 / 3.45 | 2.52 / 5.33 / 5.33 |
| 10 | 3.02 / 12.16 | 6.83 / 12.82 | 25.54 / 34.94 / 35.35 |
| 25 | 7.70 / 35.43 | 18.52 / 33.10 | 75.98 / 172.02 / 172.91 |
| 50 | 14.15 / 62.36 | 37.23 / 65.83 | 181.52 / 480.24 / 504.21 |
| 100 | 25.26 / 71.30 | 77.53 / 138.74 | **261.36 / 864.88 / 1,008.11** |

Deadlocks: **0** in every cell. Errors: **0**.

Interpretation: the control workload scales **6.1×** (530 → 3,258 tps) from 1 → 100 concurrent writers. Every readiness-changing workload **stops scaling at ~2 concurrent writers** and then declines, with latency growing linearly in concurrency — the signature of a serialized critical section. Expired-lease recovery does not scale at all (373 → 320 tps).

**Head-of-line blocking**, measured directly (one 100-shop recovery transaction held open, one unrelated merchant doing ordinary webhook intake):

| Holder open for | Unrelated merchant intake p50 | p95 | **max** |
|---|---|---|---|
| baseline (no holder) | 2.92 ms | 4.29 ms | 22.6 ms |
| 200 ms | 2.78 ms | 5.13 ms | **207.7 ms** |
| 1,000 ms | 2.36 ms | 3.19 ms | **1,012.9 ms** |
| 3,000 ms | 2.71 ms | 4.06 ms | **3,007.0 ms** |

An unrelated merchant's intake stalls for **the full lifetime** of any open readiness-maintaining transaction. Distinct merchants are coupled through a lock that protects nothing they share.

Mitigating facts established by inspection: current readiness-writing transactions are DB-only (webhook intake performs no network I/O inside `prisma.$transaction`; Redis presence checks are outside), recovery is a single autocommit statement, and the absolute ceiling (~1,200 eligible-job writes/s) is plausibly adequate at expected merchant scale. There is no correctness impact and the design is fail-safe.

**Global advisory-lock throughput/serialization verdict: FINDING — P2 (F-CLAUDE-D050-01).** The D-049 deadlock class has been converted into a platform-wide write convoy. Not release-blocking on current evidence, but it must not be recorded as "no cost".

---

## 10. Lock ordering / deadlock stress (Section G)

Lock acquisition order is uniform: `DurableJob` row locks → advisory → `DispatchReadyShop`. The dispatcher takes readiness rows first but **never waits** on a `DurableJob` row lock (statement B uses `SKIP LOCKED`; the CAS only touches rows it already holds; reconciliation reads `DurableJob` without locking), which closes the otherwise-available ABBA cycle. This is a genuine property of the design, not an accident.

| Source | Result |
|---|---|
| Repository `multi-shop deadlock stress: zero 40P01 under statement triggers` (25.1 s) | passed, both clean runs |
| Repository `adversarial multi-writer multi-shop stress` (D-049 file, 8.1 s) | passed |
| Repository `processingEnabled bulk update + dispatch: zero deadlocks` | passed, both clean runs |
| Independent advisory probe: 4 workloads × 7 concurrency levels (to 100 writers) | **0 × 40P01**, 0 errors |
| Independent migration-under-traffic probe (13 writers, mixed) | **0 × 40P01** |

**Multi-shop lock/deadlock verdict: PASS (zero deadlocks). processingEnabled bulk-write verdict: PASS.** Advisory-lock convoying is reported separately in §9 as required.

---

## 11. Active-due boundedness (Section H) and SKIP LOCKED locked prefix (Section I)

PostgreSQL 16, ≥50,000 `DurableJob` rows, fixed `batchSize = 10`, warm cache, `EXPLAIN (ANALYZE, BUFFERS)` on the production scheduler statement.

| Active due | Plan | Index-scan rows | Sort input | Seq Scan (ReadyShop / Shop / DurableJob) | Bitmap | Buffers | Exec |
|---|---|---|---|---|---|---|---|
| 10 | Seq Scan (10-row table) | — | 10 | yes¹ / no / no | no | hit=22 | 0.113 ms |
| 100 | Seq Scan (100-row table) | — | 10 | yes¹ / no / no | no | hit=13 | 0.120 ms |
| 1,000 | `DispatchReadyShop_dispatch_schedule_idx` | 10 | 10 | no / no / no | no | hit=13 | 0.137 ms |
| 5,000 | schedule index | 10 | 10 | no / no / no | no | hit=25 | 0.084 ms |
| 20,000 | schedule index | 10 | 10 | no / no / no | no | hit=86 | 0.278 ms |

¹ At 10 and 100 active-due rows the planner correctly prefers a sequential scan of a 1–2 page table. This is bounded by definition and is normal planner behaviour, not the unbounded-walk failure mode F-D048-03 guards against. Recorded as an observation, not a finding.

Representative plan at 20,000 active due: `Limit → LockRows (rows=10) → Index Scan using DispatchReadyShop_dispatch_schedule_idx (rows=10, buffers hit=4)`, with the only `Sort` operating on the 10-row CTE output. No full active-population sort, no bitmap walk, candidate work bounded by selected shops × maxPerShop.

**Locked-prefix truth**, batchSize = 10, 20,000-row active-due population:

| Locked prefix | Rows returned/locked | Index tuples examined | Truthful bound (prefix + shopCap) | Buffers | Exec |
|---|---|---|---|---|---|
| 0 | 10 | 10 | 10 | hit=24 | 0.090 ms |
| 10 | 10 | 20 | 20 | hit=45 | 0.089 ms |
| 100 | 10 | 110 | 110 | hit=228 | 0.206 ms |
| 1,000 | 10 | 1,010 | 1,010 | hit=2,059 | 1.317 ms |
| 5,000 | 10 | 5,010 | 5,010 | hit=10,197 | 6.506 ms |

Measured examined-rows equals `lockedPrefix + shopCap` **exactly** at every level. The D-050 documentation change is therefore truthful, and the former "rows examined ≤ shopCap" claim is confirmed false. Competing dispatchers: 2-way returned 20 rows and 4-way returned 40 rows with **zero shop overlap** and max latency 2.22 / 2.91 ms.

Operationally: the locked prefix equals roughly `(concurrentDispatchers − 1) × shopCap`, i.e. ~10–30 rows at supported 2–4-way concurrency, costing well under a millisecond. The 5,000-row prefix cost (6.5 ms) would require on the order of 500 concurrent dispatchers.

**Active-due boundedness verdict: PASS. Locked-prefix SKIP LOCKED verdict: PASS (truthful and operationally acceptable). Supported contention-envelope verdict: PASS at 2–4-way dispatch concurrency.**

---

## 12. Refill and fairness (Section J), admission delay (Section K)

`FAIR_CLAIM_MAX_REFILL_ROUNDS = 8` confirmed in source and mirrored in the probe.

**Healthy state** — independently derived expectation `ceil(activeEligibleShops / shopCap)`, measured with a faithful mirror of `claimBatchFair`:

| Shops | batchSize | Cycles to serve every shop | Independent bound | Within bound |
|---|---|---|---|---|
| 20 | 5 | 4 | 4 | ✅ |
| 50 | 10 | 5 | 5 | ✅ |
| 200 | 10 | 20 | 20 | ✅ |
| **2,000** | 10 | **200** | 200 | ✅ |

F-PR4-13 holds exactly, with no slack, through 2,000 active shops.

**Degraded stale-contaminated state** — independent expectation `ceil(stale / (8 × shopCap)) + ceil(real / shopCap)`, shopCap 5, stale rows placed ahead of legitimate work:

| Stale rows | Independent bound | Worst first-service cycle | All real shops served | Within bound |
|---|---|---|---|---|
| 0 | 1 | 1 | ✅ | ✅ |
| 5 (= shopCap) | 2 | 1 | ✅ | ✅ |
| 35 (= 7 × shopCap) | 2 | 1 | ✅ | ✅ |
| 40 (= 8 × shopCap) | 2 | 2 | ✅ | ✅ |
| 43 (> 8 × shopCap) | 3 | 2 | ✅ | ✅ |

One invocation performs only bounded repair, subsequent invocations make deterministic progress, and no legitimate shop is starved. The documented degraded formula matches measured behaviour and does not weaken the healthy F-PR4-13 bound.

**Admission delay** — readiness in the post-service shape (`earliestEligibleAt` past, `nextDispatchAt` pushed ahead), urgent due arrival inserted:

| `nextDispatchAt` ahead by | Resulting delay | Pulled earlier |
|---|---|---|
| 0 ms | 0 ms | ✅ |
| 100 / 500 / 900 / 999 ms | 99 / 500 / 899 / 999 ms | no (within approved budget) |
| 1,000 ms | **1,000 ms** | no |
| 1,001 ms | **1,000 ms** | no |
| 5,000 ms | 0 ms | ✅ |

Maximum observed admission delay is **exactly 1,000 ms** and never exceeds it; the fairness floor after service is `+1 ms` (`FAIRNESS_FLOOR_OFFSET_MS = 1`, applied as `GREATEST(actual_earliest, now + 1 ms)`). Greedy arrivals cannot repeatedly reset themselves ahead of waiting merchants, because the pull-earlier branches require either a future `earliestEligibleAt` or a `nextDispatchAt` more than 1 s out.

**Healthy fairness-bound verdict: PASS. Stale-state fairness/repair verdict: PASS. 1-second admission-delay verdict: PASS** — and the 1,000 ms maximum is documented truthfully as a deliberate fairness/admission tradeoff.

---

## 13. D-050 migration under representative live traffic (Section L)

Mandatory because D-049's online migration path was never independently cleared.

Method: a separate database was built to **D-049 state** (full chain with the D-050 folder removed — row-level trigger present, statement triggers absent), populated with 200 shops and 20,000 `DurableJob` rows in mixed states, then subjected to 13 concurrent writers (6 intake inserts, 4 legal `ENQUEUED → RETRY_WAIT` transitions, 2 expired-lease recovery loops, 1 `Shop.processingEnabled` toggle loop) while the D-050 migration was applied on a separate connection with Prisma's transactional semantics, plus a 50 ms `pg_locks` / `pg_stat_activity` observer.

| Measure | Result |
|---|---|
| Migration wall time | **27 ms** |
| Migration error | **none** |
| Writes completed (steady state → post-migration) | 3,627 → **5,537** |
| **Write errors, before and after** | **0 / 0** |
| Write latency during window (insert / transition / recovery / toggle, p95) | 13.0 / 13.4 / 13.8 / 13.5 ms |
| Max write latency observed | 53.6 ms |
| Observed lock modes | AccessShare, RowShare, RowExclusive, Exclusive (advisory) |
| Max concurrent lock waiters | 10 (brief) |
| Post-migration missing readiness | **0** |
| Post-migration stale readiness | **0** |
| Post-migration late `nextDispatchAt` hint | **0** |
| Readiness rows / jobs after | 200 / 25,107 |

The migration replaces row-level triggers with statement-level triggers inside a single transaction, so the `DROP TRIGGER` / `CREATE TRIGGER` pair is atomic with respect to concurrent writers: a writer either commits under the old trigger or blocks briefly and commits under the new one. **There is no window in which a valid write commits without readiness maintenance** — confirmed empirically by zero missing readiness across 5,537 concurrent writes spanning the switchover. The migration's step-5 fail-safe repair additionally reconciles any pre-existing gap.

**D-050 online migration / live-traffic verdict: PASS.**

---

## 14. Remaining sections

**DurableJob shopId / state machine (Section M).** `DurableJob.shopId` mutation is rejected at the database by `stocky_durable_job_shop_id_immutable`; an illegal `PENDING → SUCCEEDED` transition is rejected by the transition guard (`illegal_job_transition`); and readiness was **unchanged after both rejected mutations** — no side effects leak from a failed write. The accepted immutability correction is not reopened.

**Claim-index rollout / R-122 (Section N).** `sync:claim-indexes:plan`, `apply --apply` and `verify` all exit 0 against the populated database; safe concurrent populated rollout remains intact. The repository gate `equality shopId predicate regresses to eligible_* filter; range-pair retains shop-claim` passed in both clean runs, reproducing the planner behaviour that makes the `shopId >= x AND shopId <= x` range pair load-bearing. No legacy indexes were removed during review. **R-122 remains OPEN** — the dependence on undocumented planner behaviour is demonstrated, not eliminated.

**Deadlock-timeout harness (Section O).** The previously flaky deadlock-timeout-cancellation command was re-run **50 consecutive times: 50 passes, 0 failures** (6 tests per run, including `observes a real two-transaction deadlock and retries boundedly`, `classifies lock_timeout and retries boundedly`, and `classifies statement_timeout and retries boundedly`). The harness asserts the expected cancellation SQLSTATE `57014` and attaches its rejection observer at promise creation; no unhandled rejection, arbitrary retry, sleep or skip was observed, and unexpected failures still fail the suite. Both exact-tip GitHub workflows were independently verified in §1.

**D-045 / D-046 regression (Section P).** `test:sync-integration` 230/230 (covering exactly-once, final correction, worker/finalize, envelope fail-closed, role isolation, full sync integration), `test:sync-dispatch-recovery` 29/29, `test:sync-exactly-once` exit 0. No regression evidence found; no prior finding reopened.

**`test:migrations` note.** The single failure (`tenant-expansion.migration.test.ts` — `role "stocky_control_plane" cannot be dropped because some objects depend on it … 24 objects in database fresh2 / 24 objects in database d050_mig`) is caused by *this reviewer's* additional databases sharing the cluster-wide role. CI uses one database. Re-run in isolation after dropping the extra databases: **7/7 passed, exit 0**. The full `test:migrations` suite is otherwise 225/226 passing, with the single failure fully explained and cleared.

---

## 15. Documentation, risk and identity (Section Q)

| Item | Finding |
|---|---|
| `PR4_SYNC_CONTROL_PLANE_D050_CORRECTION_IMPLEMENTATION_REPORT.md` | Records tip `50dcac90a3e5ea14070be544bb489204c5fe9b76` and CI runs `31538650458` / `31538654788`. The actual reviewed tip is `62f4cff…` with CI `31542495663` / `31542499135`. **Stale — P3 (F-CLAUDE-D050-02).** The `50dcac…` → `62f4cff…` delta is documentation-only (1 file, +6/−3), so no runtime evidence is affected. Not edited during this review, as instructed. |
| PR #20 body | Accurate; correctly records current head, both exact-head CI runs, and discloses the stale report row itself |
| D-050 correction backlog | Accurately scopes F-CLAUDE-D049-01…06 |
| `PROJECT_STATUS.md`, phase-1 README, `DECISIONS.md` | Consistent with the reviewed state; PR 5 BLOCKED |
| `RISK_REGISTER.md` | R-119, R-120, R-121 (MATERIALIZED), R-122, R-123, R-124, R-125, R-126 — **all verified OPEN** pending this review's disposition |
| Inventories / manifests | `sync:inventory:check`, `tenant:access:inventory:check`, `tenant:enforcement:inventory:check` all pass |

**Documentation / risk / identity verdict: ACCURATE except the known stale implementation-report identity row (P3).**

---

## 16. Safety and scope

No production migration, production queue execution, merchant-data access, webhook replay, ownership repair, or inventory write was performed. All work ran against disposable local databases. PR #20 was not merged, not marked ready, and not modified. No commit was made to `phase-1/sync-control-plane`. No implementation code, test, migration, configuration, status/risk document, PR body, or earlier immutable review was changed. No finding was fixed during review. History was not amended, rebased, squashed or force-pushed.

**Safety / scope verdict: COMPLIANT.**

---

## 17. Findings

### P0
None.

### P1
None.

### P2

#### F-CLAUDE-D050-01 · P2 · Global readiness advisory lock serializes unrelated merchants' writes

- **File / line:** `prisma/migrations/20260811190000_sync_control_plane_d050_split_claim_statement_triggers/migration.sql:43-45`, `:141-143`, `:232-234`
- **Evidence:** §9. Control workload scales 6.1× (530 → 3,258 tps) from 1 → 100 concurrent writers against distinct shops; readiness-changing intake plateaus at ~2 writers and declines (1,689 → 1,229 tps) with p50 latency growing linearly to 77.5 ms and p99 to 138.7 ms; expired-lease recovery does not scale at all (373 → 320 tps, p99 864.9 ms, max 1,008 ms). Head-of-line blocking measured exactly: unrelated-merchant intake max latency 207.7 / 1,012.9 / 3,007.0 ms for 200 / 1,000 / 3,000 ms holder durations, against a 22.6 ms baseline.
- **Merchant impact:** All merchants' eligible-job writes share one serialization point. One slow readiness-maintaining transaction — a large recovery batch, a database stall, or any future code path that keeps such a transaction open — delays every other merchant's webhook intake for its full duration. Platform write throughput for readiness-changing work is effectively single-threaded regardless of hardware.
- **Reproduction:** Run N concurrent transactions inserting one PENDING `DurableJob` each, every one to a *different* shop, for N ∈ {1, 2, 4, 10, 25, 50, 100}; compare tps and latency against the same volume of `ENQUEUED` inserts (no readiness work). Separately, hold a 100-shop recovery transaction open for T ms and sample an unrelated shop's intake latency.
- **Expected behaviour:** Writes to disjoint shops should not serialize against each other. Deadlock freedom should come from deterministic ordering, not from a global mutex.
- **Recommended correction:** Replace the single global key with a **per-shop advisory key** (e.g. `pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain', 0), hashtextextended(shop_id, 0))` or a two-argument form) acquired inside the existing `ORDER BY "shopId" ASC` loop. Deterministic shopId-ascending acquisition preserves the deadlock guarantee the global lock currently provides — including against the `Shop.processingEnabled` trigger, which already iterates in the same order — while removing cross-merchant coupling. If a global lock is retained deliberately, record it as an accepted architectural limit with a documented write-throughput ceiling and an alert on readiness-transaction duration.
- **Missing test:** A cross-shop write-scalability regression test asserting that N concurrent single-shop readiness writes achieve materially better than serialized throughput (e.g. tps at concurrency 10 ≥ k × tps at concurrency 1), and a head-of-line test asserting that an unrelated shop's intake latency is not bounded below by a concurrent readiness transaction's duration.

### P3

#### F-CLAUDE-D050-02 · P3 · D-050 implementation report records a stale tip and stale CI runs

- **File / line:** `stocky-plus/docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_D050_CORRECTION_IMPLEMENTATION_REPORT.md:113-115`
- **Evidence:** Report states tip `50dcac90…`, PUSH `31538650458`, PR `31538654788`. Reviewed tip is `62f4cff…` with PUSH `31542495663` / PR `31542499135`, both independently confirmed successful on the exact head.
- **Merchant impact:** None. Governance/traceability only.
- **Expected behaviour:** The implementation report's identity block names the current tip and its exact-head CI evidence.
- **Recommended correction:** Update the identity rows to `62f4cff…` and the two current run IDs after review disposition. Not edited during this review, as instructed.
- **Missing test:** An identity-freshness check comparing the implementation report's recorded tip against `git rev-parse HEAD` in CI.

#### F-CLAUDE-D050-03 · P3 · Two D-050 contract tests cannot detect the drift they exist to catch

- **File / line:** `app/sync/__tests__/d050-corrections.test.ts` — stale-fairness test (`const bound = fairClaimDegradedStaleRepairBoundCycles(...)`) and anti-reset test (the `interval '500 milliseconds'` UPDATE)
- **Evidence:** The stale-state fairness test derives its expected bound by calling the very implementation function under test, so an incorrect bound formula would still pass. In the anti-reset test the 500 ms `nextDispatchAt` UPDATE is immediately overwritten by a 2 s UPDATE before any arrival is inserted, so the sub-1 s "must not pull earlier" side of the contract is never exercised; only the > 1 s pull-earlier side is. (The constants themselves *are* asserted against independent literals, which is correct.)
- **Merchant impact:** None observed — §12 confirms independently that both behaviours are actually correct. Risk is future undetected drift.
- **Expected behaviour:** Contract tests assert against independently written expectations.
- **Recommended correction:** Assert the degraded bound against a literal or locally computed formula, and replace the dead 500 ms statement with a real sub-1 s case asserting the arrival is *not* pulled earlier and the delay stays ≤ 1,000 ms.
- **Missing test:** As described above.

---

## 18. Verdicts summary

| # | Area | Verdict |
|---|---|---|
| 10 | Scheduler-lock statement | **PASS** |
| 11 | Job-candidate statement | **PASS** |
| 12 | Fresh-snapshot reconciliation | **PASS** |
| 13 | False-negative readiness | **PASS** — 0/1,000 |
| 15 | Statement-level triggers | **PASS** |
| 16 | Runtime writer shop cardinality | **PASS** |
| 17 | Global advisory-lock throughput | **FINDING — P2** |
| 18 | Expired-lease recovery | **PASS** |
| 19 | Multi-shop lock / deadlock | **PASS** — zero 40P01 |
| 20 | processingEnabled bulk write | **PASS** |
| 21 | Active-due boundedness | **PASS** |
| 22 | Locked-prefix SKIP LOCKED | **PASS** |
| 23 | Supported contention envelope | **PASS** (2–4-way) |
| 24 | Healthy fairness bound | **PASS** through 2,000 shops |
| 25 | Stale-state fairness / repair | **PASS** |
| 26 | 1-second admission delay | **PASS** — max exactly 1,000 ms |
| 27 | Online migration under live traffic | **PASS** |
| 28 | DurableJob shopId / state machine | **PASS** |
| 29 | Claim-index rollout | **PASS** |
| 30 | R-122 / range pair | **REMAINS OPEN** |
| 31 | Deadlock-timeout harness | **PASS** — 50/50 |
| 32 | D-045 / D-046 regression | **PASS** |
| 33 | Documentation / risk / identity | **ACCURATE except P3 stale report row** |
| 34 | Safety / scope | **COMPLIANT** |

---

## 19. Final verdict

### `APPROVE D-050 CORRECTION CLOSURE`

D-050 closes the two P1 defects it was raised to fix, and I could not reproduce either one:

- **F-CLAUDE-D049-01** (claim/reconcile same-statement snapshot permanently deleting readiness) — 1,000 independent claim-vs-writer races across all ten required interleavings produced **zero** permanent false-negative readiness outcomes. The split A/B/C/D protocol, the later-statement fresh snapshot, and the monotonic statement-level triggers behave as specified under both commit orders, including the writer-blocked-behind-the-readiness-lock case.
- **F-CLAUDE-D049-02** (single-shop GUC aborting cross-shop expired-lease recovery) — the custom-GUC boundary is gone, a 100-shop recovery succeeds and recreates readiness for all 100 shops, concurrent recovery produces zero duplicates, and no single merchant can halt the dispatch loop. I reproduced the original D-049 failure directly on a D-049-state database for contrast.

The remaining approved findings are also satisfied: the SKIP LOCKED contract is now truthful and measured exactly (`lockedPrefix + shopCap`), the healthy F-PR4-13 bound holds exactly through 2,000 shops with a separate and accurate degraded bound, and the 1-second anti-reset maximum is real, measured at exactly 1,000 ms and never exceeded. The online migration — never previously cleared independently — applied in 27 ms under 13 concurrent writers with zero write errors and zero readiness drift, with no window in which a valid write commits without readiness maintenance.

Closure is approved **with one open P2 and two P3s carried forward, not closed**:

- **F-CLAUDE-D050-01 (P2)** — the global readiness advisory lock serializes unrelated merchants' readiness-changing writes and produces measurable head-of-line blocking. This is a real architectural cost that must be recorded as such rather than treated as free. It is not release-blocking at this stage: there is no correctness impact, zero deadlocks, no unbounded lock hold in current code paths, and the measured ceiling is plausibly adequate at expected merchant scale. It must be resolved or formally accepted with a documented throughput ceiling before production load, and a per-shop advisory key in the existing shopId-ascending order appears to preserve the deadlock guarantee without the convoy.
- **F-CLAUDE-D050-02 (P3)** — stale identity rows in the D-050 implementation report.
- **F-CLAUDE-D050-03 (P3)** — two contract tests that cannot detect the drift they exist to catch.

**Risk disposition.** R-125 and R-126 are, on this evidence, substantively remediated and may be closed by the decision owner. R-121 remains **MATERIALIZED but no longer reproducible** on the reviewed protocol. R-122 **remains OPEN** — the range-pair planner dependence is demonstrated and gated, not eliminated. R-119, R-120, R-123 and R-124 have supporting evidence for closure at the owner's discretion; R-123 in particular should be re-scoped to reflect that deadlock freedom is now purchased with global serialization (F-CLAUDE-D050-01). No risk is closed by this reviewer.

This verdict approves **D-050 correction closure only**. It is not a PR 4 readiness verdict, not an approval to merge PR #20, not an approval to mark it ready, and not authorization to begin PR 5, enable inventory writes, or perform any production activity. Q-003 and F-PR4-18 remain OPEN and PR 5 remains BLOCKED.

---

*Independent review performed by Claude Code. No finding is closed on Cursor evidence. This report is immutable.*
