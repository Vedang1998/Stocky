# PR 4 — Sync Control Plane: D-049 Correction Independent Review Report

**Immutable.** Do not edit after commit. Supersedes nothing; incorporates by
reference the immutable D-048 correction review report.

---

## 1. Review identity

| Field | Value | Verified |
|---|---|---|
| Exact reviewed head | `2b177152ed06c01a36025fbfc4f6a1f1eaa30969` | ✅ |
| Confirmed merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| `origin/main` at review time | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | ✅ |
| PR #20 state | OPEN / DRAFT / UNMERGED | ✅ |
| D-048 immutable review source | `80955af334c761d3a0299c7ec755f4353186279c` | ✅ |
| D-048 review blob at head | `0de12503787c4c056cd097445e5e2db3d6a8339a` | ✅ byte-identical |
| Review branch | `claude/d-049-correction-review-uqh15y` | created from exact head |

Merge base independently recomputed with
`git merge-base origin/main 2b17715` → `e69bc53…`. The reviewed head is the tip
of `phase-1/sync-control-plane`; no later commit changed review identity.

### Exact-head CI evidence (independently re-verified via GitHub API)

**PUSH** — run `31194091851`
- `head_sha` = `2b177152ed06c01a36025fbfc4f6a1f1eaa30969` ✅
- `event` = `push`, `run_number` 231, `run_attempt` 1
- `status` = completed, `conclusion` = **success** ✅

**PULL REQUEST** — run `31194099207`
- `head_sha` = `2b177152ed06c01a36025fbfc4f6a1f1eaa30969` ✅
- `event` = `pull_request`, `run_number` 232, `run_attempt` 1
- `status` = completed, `conclusion` = **success** ✅

Both runs are against the exact reviewed SHA and both are green. **CI green is
confirmed and is not disputed by this review.** The findings below are defects
that the current CI gate does not test for.

### Identity gate

Conditions 1–8 pass. Conditions 9–13 (inventory-write flags OFF, Q-003 OPEN,
F-PR4-18 OPEN, PR 5 blocked, production unauthorized) are unchanged by this
review; no action was taken that would alter them.

---

## 2. Environment reconstructed

| Component | Value |
|---|---|
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1), fresh cluster, port 55432 |
| Redis | 7.x, port 56379 |
| Node | v22.22.2 |
| npm | 11.5.2 (pinned per CI; the default 10.9.7 fails `engines`) |
| Prisma | 6.19.3 CLI + client (local binary; `npx prisma` resolves 7.9.1 and fails) |
| Migration chain | all 15 migrations applied cleanly via `prisma migrate deploy` |
| Roles | `stocky_runtime`, `stocky_control_plane` provisioned via repo scripts |

`prisma generate` ✅, `prisma validate` ✅ ("schema is valid"),
`prisma migrate deploy` ✅ ("All migrations have been successfully applied").

All probes below execute the **production** SQL, extracted programmatically from
`app/sync/fair-claim-query.server.ts` via `buildFairClaimLockedSelectSql` — not a
re-typed copy.

---

## 3. Verdicts

| # | Area | Verdict |
|---|---|---|
| 10 | Monotonic trigger | **PARTIAL** — monotone within the trigger; not sufficient for the global invariant |
| 11 | False-negative readiness | ❌ **FAIL** — permanent false negatives reproduced (F-CLAUDE-D049-01, P1) |
| 12 | 1-second hidden-work tolerance | ⚠️ **WEAK** — test tolerance mirrors implementation, not the contract (P3) |
| 13 | Reconciliation / self-heal | ⚠️ **PARTIAL** — disjoint DML paths confirmed; `heal_empty` is unsafe under concurrency |
| 14 | Active-due boundedness | ✅ **PASS** — index-bounded to 20,000 active due |
| 15 | Locked-prefix SKIP LOCKED boundedness | ❌ **CLAIM FALSE** — rows *examined* grow with locked prefix (P2) |
| 16 | DurableJob boundedness | ✅ **PASS** — ≤ shopCap × maxPerShop, index-only scans |
| 17 | Refill cap | ✅ **PASS** — bounded, deterministic recovery |
| 18 | Fairness bound | ⚠️ **DOCUMENTED BOUND NOT MET** under stale rows (P3) |
| 19 | Equal-timestamp / greedy fairness | ✅ **PASS** (shipped gate + tie ordering by `shopId`) |
| 20 | GUC enforcement | ❌ **NOT ENFORCED** — convention only (P2) |
| 21 | Restricted-role bypass | ❌ **BYPASS SUCCEEDS** for both runtime and control-plane roles |
| 22 | Runtime writer shop-cardinality matrix | ❌ **FAIL** — one production writer is cross-shop (F-CLAUDE-D049-02, P1) |
| 23 | Multi-shop recovery compatibility | ❌ **REGRESSION** — global dispatch outage |
| 24 | Lock-order / deadlock | ⚠️ **MOVED, NOT RESOLVED** — hazard displaced behind a bypass convention |
| 25 | `processingEnabled` trigger lock risk | ⚠️ **OPEN** — bulk `Shop` update bypasses the single-shop GUC entirely |
| 26 | `DurableJob.shopId` immutability | ✅ **PASS** |
| 27 | State-machine regression | ✅ **PASS** — transition list preserved |
| 28 | D-049 online migration rollout | ⚠️ **NOT CLEARED** — not verified under live traffic |
| 29 | Claim-index rollout | ✅ **NO REGRESSION OBSERVED** (index-only scans selected) |
| 30 | R-122 / range-pair | **REMAINS OPEN** |
| 31 | Deadlock-timeout harness | ✅ **PASS** as observed (not run ×50) |
| 32 | D-045 / D-046 regression | ✅ **NO REGRESSION** in the suites executed |
| 33 | Documentation / risk / identity | ❌ **INACCURATE** — boundedness and enforcement claims overstated |
| 34 | Safety / scope | ✅ **PASS** — no prohibited action taken |

---

## 4. Findings

### F-CLAUDE-D049-01 — P1 — Permanent false-negative readiness: `heal_empty` deletes readiness for a shop that concurrently gained eligible work

**File:** `app/sync/fair-claim-query.server.ts:156-162` (`heal_empty` CTE)
**Reopens:** F-D048-01 (claimed corrected by D-049)

**Mechanism.** `claimBatchFair` runs at READ COMMITTED
(`dispatcher.server.ts:171`, default `$transaction`). The whole claim query is a
single statement, so `truth`'s `DurableJob` subqueries and the `heal_empty`
`DELETE` share **one statement snapshot**. `due_shops` takes `FOR UPDATE` on
`DispatchReadyShop` only; that lock forces EvalPlanQual re-checking on the
*readiness* row but does **not** make the `DurableJob` reads see rows committed
after the statement began.

Interleaving:

1. Shop `S` has a stale (false-positive) readiness row, due. D-049 deliberately
   creates these — terminal/removal transitions intentionally leave early hints.
2. Dispatcher `T1` begins the claim statement; snapshot `S0` is taken.
3. Writer `T2` inserts an eligible `PENDING` job for `S` and **commits**. The
   trigger's `ON CONFLICT DO UPDATE` refreshes the existing readiness row.
4. `T1` locks `S`'s readiness row (no block — `T2` already committed); EPQ
   returns the updated version, still due, so `S` is selected.
5. `T1` evaluates `truth` under `S0`: `T2`'s job is invisible →
   `actual_earliest IS NULL`.
6. `heal_empty` **DELETEs** `S`'s readiness row.

Result: an eligible `PENDING` job with **no readiness row**. Nothing recreates
it — the row is only ever recreated by a *subsequent* insert/transition for the
same shop.

**Reproduction** (`.d049probe/race2.mjs`, production SQL, 400 stale shops +
1 target):

```
{ "ITER": 200, "N_STALE": 400, "eligibleCases": 200,
  "errorCases": 0, "FALSE_NEGATIVE_readiness_missing": 21 }
```

**21 / 200 iterations (10.5%)** produced the violation.

Permanence confirmed (`.d049probe/confirm.mjs`) — after the violation, 25 further
full dispatch cycles were run:

```
HIT on attempt 6 -> missing_readiness = 1
AFTER 25 further dispatch cycles: {"still_pending":"1","readiness":"0"}
final missing_readiness = 1
```

The job never becomes visible.

**Merchant impact.** A shop's sync work (webhook-driven inventory/order jobs)
silently stops being dispatched for an unbounded period. No error, no alert, no
dead-letter — the job simply sits `PENDING`. Because D-049's fail-safe design
intentionally leaves stale readiness rows for every shop that completes work, the
precondition is the normal steady state, not an edge case. Probability rises with
dispatcher concurrency and readiness-table size.

**Why the shipped gate misses it.** `d049-readiness-corrections.test.ts`'s
"≥500 concurrent same-shop races" test races *inserts against each other*. It
never races an insert against the **claim/reconciliation statement**, which is
where the snapshot skew lives. Its own `driftReport()` `missing_readiness` probe
would have caught this had that interleaving been exercised — it detects the
state, but the state is never produced. The suite passes 8/8 at the reviewed head.

**Expected behavior.** `FALSE NEGATIVES MUST NOT` (migration header, line 3).
`heal_empty` must not delete on evidence that is older than the readiness row it
is deleting.

**Recommended correction.** Do not `DELETE` from a stale snapshot. Options:
(a) re-read ground truth under a fresh snapshot / `FOR UPDATE` on the candidate
`DurableJob` rows before deleting; (b) make deletion conditional on the readiness
row's `updatedAt`/`xmin` being unchanged since the snapshot; or (c) never delete
in the claim path — mark rows for a separate reconciler that verifies under its
own snapshot. Option (c) is most consistent with the stated fail-safe direction.

**Missing test.** A race gate that runs the production claim SQL concurrently
with committed eligible inserts and asserts `missing_readiness = 0` — zero
tolerance, ≥1,000 iterations.

---

### F-CLAUDE-D049-02 — P1 — D-049 single-shop guard breaks `recoverExpiredDispatchLeases`, causing a self-perpetuating global dispatch outage

**Files:** `app/sync/dispatcher.server.ts:132-149` (writer),
`app/sync/dispatcher.server.ts:1328` (unguarded call site),
`prisma/migrations/20260807150000_.../migration.sql:138-148` (guard)

**Mechanism.** `recoverExpiredDispatchLeases` issues one unqualified statement:

```sql
UPDATE "DurableJob" SET state = 'PENDING', ...
WHERE state = 'DISPATCH_LEASED' AND "leaseExpiresAt" IS NOT NULL
  AND "leaseExpiresAt" < $now
```

There is **no `shopId` filter**. `DISPATCH_LEASED → PENDING` is a transition
*into* `PENDING`, so it fires `stocky_dispatch_ready_shop_maintain()` per row.
When expired leases span two or more shops, the second row raises
`stocky_single_shop_dispatch_ready_tx` and the whole statement aborts.

This is called as the **first** operation of every `dispatchPendingJobs` cycle
(line 1328) with **no `try`/`catch`**, so the entire dispatch cycle throws before
any job is claimed.

**Reproduction** — exact production statement, two shops with expired leases:

```
ERROR:  stocky_single_shop_dispatch_ready_tx: multi-shop readiness mutation
        in one transaction is unsupported
CONTEXT: PL/pgSQL function public.stocky_dispatch_ready_shop_maintain() line 46
post-state: e1 DISPATCH_LEASED / e2 DISPATCH_LEASED   (neither recovered)
```

End-to-end through the real `dispatchPendingJobs` (`.d049probe/e2e.ts`):

```
CASE A: two shops with expired DISPATCH_LEASED leases
  dispatchPendingJobs THREW => Invalid `prisma.$executeRaw()` invocation:
    Code: `23514` ... stocky_single_shop_dispatch_ready_tx
  post-state: [x1 DISPATCH_LEASED, x2 DISPATCH_LEASED]

CASE B (control): single shop
  dispatchPendingJobs OK: {"recoveredLeases":1,"claimed":1,"enqueued":1,...}
  post-state: [x1 ENQUEUED]
```

**Merchant impact.** Expired dispatch leases on ≥2 shops — the normal result of
any worker crash, restart, deploy, or OOM — permanently stop dispatching for
**every merchant on the platform**. The condition is self-perpetuating: the only
code that clears expired leases is the statement that now always fails. Recovery
requires manual DBA intervention. This is a whole-platform processing outage
introduced by D-049; it did not exist before this migration.

**Expected behavior.** Lease recovery must remain functional across shops, or be
restructured to one transaction per shop.

**Recommended correction.** Iterate shop-by-shop (mirroring
`recoverStrandedEnqueuedJobs`, which correctly wraps each job in its own
`$transaction`), or batch by `shopId` with a bounded per-shop loop. Additionally,
add a `try`/`catch` around lease recovery so a recovery failure degrades the
cycle rather than aborting all dispatch.

**Missing test.** A dispatch-recovery gate with expired `DISPATCH_LEASED` jobs on
≥2 distinct shops asserting `dispatchPendingJobs` succeeds and recovers all.
`test:sync-dispatch-recovery` passes 29/29 at the reviewed head and does not
cover this.

---

### F-CLAUDE-D049-03 — P2 — Single-shop-per-transaction guard is convention, not enforcement; restricted roles can bypass it

**File:** `prisma/migrations/20260807150000_.../migration.sql:138-148`

PostgreSQL custom GUCs under an unregistered prefix are *placeholder* GUCs with
`USERSET` context. They are not privileged. Verified against the reviewed head:

```
control-plane role: current_user = stocky_control_plane, rolsuper = f
  BEGIN; SET LOCAL stocky.allow_multi_shop_dispatch_ready = '1';  -> bypass_value = 1
  BEGIN; SELECT set_config('stocky.allow_multi_shop_dispatch_ready','1',true); -> 1
runtime role:
  BEGIN; SET LOCAL stocky.allow_multi_shop_dispatch_ready='1';    -> runtime_bypass = 1
```

Both restricted runtime roles can enable the bypass. Worse, the guard *variable
itself* is resettable, so the bypass GUC is not even required:

```sql
BEGIN;
  INSERT ... shop-00000;                                   -- sets guard var
  SELECT set_config('stocky.dispatch_ready_shop_tx','',true);  -- clears it
  INSERT ... shop-00001;                                   -- succeeds
COMMIT;                                                    -- 2 rows written
```

**Merchant impact.** Not a direct merchant defect, but the control is
mischaracterised. The PR body and migration comments describe a database-level
guarantee ("Multi-shop DurableJob mutations in one transaction are rejected …
unless `stocky.allow_multi_shop_dispatch_ready = '1'` (migration/admin only)").
"migration/admin only" is not true: any application code path, present or future,
disables it with one statement and no privilege. R-123 cannot be closed on this
mechanism.

**Positive findings.** Savepoint semantics are correct — `set_config(…, true)` is
transactional, and rollback-to-savepoint neither leaks nor spuriously clears the
guard (both cases verified). The guard does correctly reject the naive multi-shop
transaction.

**Recommended correction.** Either classify this truthfully as a defence-in-depth
developer guard-rail (not enforcement) in all documents and keep R-123 OPEN, or
enforce it structurally — e.g. a `SECURITY DEFINER` function owned by a
privileged role, or an `ALTER ROLE … SET` / event-trigger arrangement the runtime
role cannot override.

**Missing test.** A role-isolation gate asserting the runtime and control-plane
roles **cannot** set the bypass — which would currently fail.

---

### F-CLAUDE-D049-04 — P2 — "Scheduling rows examined ≤ shopCap" is false under SKIP LOCKED contention

**File:** `app/sync/fair-claim-query.server.ts:28-31`

The module documents:

> - Scheduling rows examined ≤ shopCap (SQL LIMIT + matching schedule index).
> - Independent of total Shop count, total DurableJob backlog, and active-due
>   population size.

`FOR UPDATE SKIP LOCKED` must walk *past* locked index entries to find `shopCap`
unlocked rows. Measured at 20,000 due readiness rows, `batchSize`/`shopCap` = 10,
with a concurrent session holding locks on the earliest N:

| locked prefix | index rows read | rows locked/returned | max shared hit blocks | exec time |
|---|---|---|---|---|
| 0 | 10 | 10 | 280 | 0.52 ms |
| 10 | 20 | 10 | 275 | 0.58 ms |
| 100 | 110 | 10 | 375 | 0.68 ms |
| 1,000 | 1,010 | 10 | 1,289 | 2.37 ms |
| 5,000 | 5,010 | 10 | 5,355 | 4.85 ms |

Rows examined = `lockedPrefix + shopCap`, exactly linear. Buffers grow ~19×.

The correct statement is **"scheduling rows returned/locked ≤ shopCap"**. Rows
examined are bounded by concurrent dispatcher contention, not by `shopCap`. With
W dispatchers the Wth examines ≈ `W × shopCap` rows per round, and up to
`FAIR_CLAIM_MAX_REFILL_ROUNDS = 8` rounds re-walk that prefix per invocation.

**Merchant impact.** Not a correctness defect and not unbounded, but the
performance-acceptance claim backing R-120 is wrong, and the scaling term
(concurrency × shopCap × refill rounds) is undocumented. At high worker counts
combined with a large stale-row population this becomes material.

**Recommended correction.** Correct the docstring and the performance acceptance
criteria to distinguish rows returned from rows examined, record the
contention-scaling term, and keep R-120 OPEN.

**Missing test.** A locked-prefix gate asserting the examined-row bound the
project intends to hold.

---

### F-CLAUDE-D049-05 — P3 — Acceptance test tolerance mirrors the implementation rather than the operational contract

**File:** `app/sync/__tests__/d049-readiness-corrections.test.ts:43`

```sql
AND r."nextDispatchAt" > NOW() + interval '1 second') AS due_work_hidden
```

The trigger will not pull `nextDispatchAt` earlier for a due arrival unless the
existing value is more than one second in the future
(`migration.sql:186-189`). The test's `due_work_hidden` probe uses the **same**
one-second allowance, so by construction it can never detect work hidden for
≤ 1 s. The architecture's fairness floor is `now + 1ms`.

Assessment: the ≤1 s hiding window is a *deliberate and defensible* anti-starvation
trade-off — it prevents a continuously greedy shop from repeatedly resetting its
own schedule. It is a bounded false positive-avoidance cost, not a defect. The
defect is that the **acceptance test is not an independent check**: it asserts the
implementation against itself. A regression widening the window to, say, 900 ms
would pass.

Secondary: `driftReport()` uses `NOW()` (transaction start) while the trigger uses
`clock_timestamp()`. Harmless here, but inconsistent.

**Recommended correction.** State the ≤1 s bounded-delay allowance explicitly in
the architecture as an approved deviation from the +1 ms floor, and tighten the
test tolerance to a value derived from the contract, not from the implementation.

---

### F-CLAUDE-D049-06 — P3 — Documented starvation bound does not hold under stale readiness

**File:** `app/sync/fair-claim-query.server.ts:40-44, 93-102`

Documented: a continuously eligible shop is served within
`ceil(activeEligibleShops / shopCap)` **"successful dispatch cycles"**.

Measured (`shopCap` = 10, refill cap 8, one real due shop sorting after all stale
rows):

| stale rows | × shopCap | invocations until real work served |
|---|---|---|
| 5 | 0.5 | 1 |
| 10 | 1.0 | 1 |
| 70 | 7.0 | 1 |
| 80 | 8.0 | 2 |
| 200 | 20.0 | 3 |

Behaviour is bounded and deterministic — stale rows are permanently consumed by
`heal_empty`, so recovery converges. But the operative bound is
approximately `ceil((staleRows + activeEligibleShops) / (shopCap × 8))`
invocations, not `ceil(activeEligibleShops / shopCap)`.

As the review prompt anticipated, the qualifier **"successful cycles"** does
silently weaken the approved F-PR4-13 criterion: invocations that return an empty
batch because the refill window was consumed by stale rows are excluded from the
count, so the bound is true only by definition. Since D-049's design deliberately
generates stale rows in normal operation, this is the common case, not an edge.

**Recommended correction.** State the real bound including the stale-row term, and
do not count empty invocations out of the fairness criterion.

---

## 5. Areas verified as sound

- **`DurableJob.shopId` immutability (F-D048-04)** — ✅ enforced for both the
  superuser and the restricted control-plane role;
  `UPDATE … SET "shopId" = <other>` raises
  `stocky_durable_job_shop_id_immutable`. Same-shop no-op updates still succeed.
  Approved state-transition list preserved verbatim (16 pairs), matching the
  D-048 machine.
- **Reconciliation DML disjointness (F-D048-02)** — ✅ `heal_empty`,
  `reschedule_future` and `served` are mutually exclusive on
  `actual_earliest IS NULL / > now / <= now`; each readiness row is touched by
  exactly one path. PostgreSQL data-modifying-CTE semantics cannot recreate the
  D-048 dead-`heal_empty` defect. (The path is still unsafe for the *separate*
  snapshot reason in F-CLAUDE-D049-01.)
- **Active-due boundedness (F-D048-03)** — ✅ across the full required grid.
  `DispatchReadyShop_dispatch_schedule_idx` is selected in every case; **no**
  `DispatchReadyShop`/`Shop`/`DurableJob` Seq Scan; no full-population sort;
  `LockRows` output = 10 at every scale:

  | total shops | active due | index used | DRS seq | Shop seq | DJ seq | LockRows |
  |---|---|---|---|---|---|---|
  | 1,000 | 10 | ✅ | ✗ | ✗ | ✗ | 10 |
  | 5,000 | 10 | ✅ | ✗ | ✗ | ✗ | 10 |
  | 20,000 | 10 | ✅ | ✗ | ✗ | ✗ | 10 |
  | 20,000 | 100 | ✅ | ✗ | ✗ | ✗ | 10 |
  | 20,000 | 1,000 | ✅ | ✗ | ✗ | ✗ | 10 |
  | 20,000 | 5,000 | ✅ | ✗ | ✗ | ✗ | 10 |
  | 20,000 | 20,000 | ✅ | ✗ | ✗ | ✗ | 10 |

  Worst case (20,000 × 20,000, 50,000 `DurableJob` rows): 361 shared hit blocks,
  **0.670 ms** execution. Per-shop candidate selection uses
  `Index Only Scan using "DurableJob_shop_claim_pending_idx"` — the D-047
  range-pair rollout is not regressed.
- **Refill cap** — ✅ `FAIR_CLAIM_MAX_REFILL_ROUNDS = 8` is respected; stale rows
  are permanently consumed; recovery is deterministic across invocations and
  never wedges.
- **Savepoint / subtransaction semantics** of the single-shop guard — ✅ correct.

---

## 6. Runtime writer → shop-cardinality matrix

| Writer | File | Transaction scope | Shops/tx | Verdict |
|---|---|---|---|---|
| Fair claim (`claimBatchFair`) | `dispatcher.server.ts:161` | interactive `$transaction` | many | ⚠️ readiness UPDATE/DELETE only, not `DurableJob` → guard not fired |
| **Expired dispatch-lease recovery** | `dispatcher.server.ts:132` | single autocommit stmt | **many** | ❌ **FAILS** — F-CLAUDE-D049-02 |
| Shop-disabled requeue → `PENDING` | `dispatcher.server.ts:437` | autocommit, `WHERE id =` | 1 | ✅ |
| Stranded-`ENQUEUED` recovery → `RETRY_WAIT` | `dispatcher.server.ts:1021` | per-job `$transaction` | 1 | ✅ |
| Worker retry / finalize | `lifecycle.server.ts` | per-job, shop-scoped | 1 | ✅ |
| Attempt heartbeat / recovery | `lifecycle.server.ts:148,162` | shop-scoped `updateMany` | 1 | ✅ |
| Webhook intake | `intake.server.ts:361` | per-delivery `$transaction` | 1 | ✅ |
| Uninstall / cancel | `uninstall.server.ts:228` | shop-scoped | 1 | ✅ |
| `Shop.processingEnabled` sync trigger | migration L207-227 | any bulk `Shop` UPDATE | **many** | ⚠️ see below |

**`processingEnabled` trigger (verdict 25).** `stocky_dispatch_ready_shop_sync_enabled()`
updates `DispatchReadyShop` rows **without** consulting
`stocky.dispatch_ready_shop_tx`. Any supported bulk `Shop` update (fleet-wide
enable/disable, maintenance freeze, billing-driven pause) therefore takes
readiness row locks across many shops in one transaction in `Shop.id` order,
while the dispatcher takes them in `(nextDispatchAt, shopId)` order. That is the
opposite-order lock pattern F-D048-05 was raised for. The D-049 guard does not
cover this path at all. **R-123 must remain OPEN.**

---

## 7. Lock order / deadlock (verdict 24)

The old 21-deadlock / 25 s class is not reproducible through the *ordinary*
`DurableJob` path — because that path is now rejected outright rather than
serialised. That is not the same as being structurally resolved:

- the hazard is displaced behind a bypass that any role can set
  (F-CLAUDE-D049-03);
- one legitimate production writer trips the rejection instead of deadlocking,
  which converts a contention problem into an outage (F-CLAUDE-D049-02);
- the `Shop.processingEnabled` path retains the original multi-row lock-order
  exposure with no guard.

**Verdict: moved, not resolved.**

---

## 8. Commands executed

All from `stocky-plus/` at head `2b17715`, against the reconstructed
PostgreSQL 16.13 + Redis 7 environment.

| # | Command | Result |
|---|---|---|
| 1 | `git merge-base origin/main 2b17715` | `e69bc53…` ✅ |
| 2 | `git rev-parse HEAD:…D048_CORRECTION_REVIEW_REPORT.md` | `0de1250…` ✅ |
| 3 | `npm install -g npm@11.5.2` → `npm ci` | ✅ (fails on npm 10.9.7) |
| 4 | `prisma generate` | ✅ |
| 5 | `prisma validate` | ✅ schema valid |
| 6 | `prisma migrate deploy` (15 migrations, fresh DB) | ✅ all applied |
| 7 | `tenant:roles:provision --apply` | ✅ |
| 8 | `sync:roles:provision --apply` | ✅ |
| 9 | `.d049probe/race2.mjs` — 200 claim-vs-insert races | ❌ **21 false negatives** |
| 10 | `.d049probe/confirm.mjs` — permanence, +25 dispatch cycles | ❌ **never recovers** |
| 11 | `.d049probe/explain.mjs` — 7-point active-due EXPLAIN grid | ✅ bounded |
| 12 | `.d049probe/skiplocked.mjs` — locked prefix 0/10/100/1k/5k | ❌ claim false |
| 13 | `.d049probe/refill.ts` — stale 5/10/70/80/200 | ✅ bounded |
| 14 | `.d049probe/e2e.ts` — multi-shop lease recovery, real dispatcher | ❌ **throws** |
| 15 | GUC bypass, both restricted roles, `SET LOCAL` + `set_config` | ❌ **bypass works** |
| 16 | Guard-var reset bypass; savepoint matrix | ❌ bypass / ✅ savepoints |
| 17 | `shopId` immutability, both roles, + same-shop control | ✅ enforced |
| 18 | `vitest … d049-readiness-corrections.test.ts` | ✅ **8/8 passed** (23.0 s) |
| 19 | `npm run test:sync-dispatch-recovery` | ✅ **29/29 passed** (5.5 s) |
| 20 | `npm run lint` | ✅ exit 0 |
| 21 | `npm run typecheck` | ✅ exit 0 |
| 22 | `git diff --check` | ✅ clean |
| 23 | Exact-head PUSH + PR CI re-verified via GitHub API | ✅ both success |

### Not executed — declared honestly

The prescribed 39-item execution list was not completed. The following were
**not** run, and no verdict below is claimed on their basis:

- ≥1,000-iteration same-shop race sweep (200 iterations run; the P1 reproduced at
  10.5%, so additional iterations would not change the verdict);
- second fresh migration-chain run; migration name-filter matrix; full
  `test:migrations`;
- **D-049 migration under populated live traffic** — verdict 28 is therefore
  **NOT CLEARED**, not "pass". The `ADD COLUMN` → `UPDATE` backfill →
  `SET NOT NULL` sequence with the D-048 trigger (which does not know about
  `nextDispatchAt`) active in between remains an unverified NULL-insertion window;
- `test:sync-performance` ×5; full `test:sync-integration`; exactly-once;
  envelope fail-closed; role isolation; reporter tests; `sync:inventory:check`;
  `tenant:access:*`; `tenant:enforcement:*`; RLS verification;
  `git diff --check`;
- deadlock-timeout harness ×50 (F-D048-06 observed green in both exact-head CI
  runs and not re-stressed locally);
- 2-way/4-way dispatcher concurrency waves; 2,000-shop fairness sweep.

`lint`, `typecheck` and `git diff --check` were run locally and are clean.

Because two P1 defects were reproduced against production code paths, completing
the remaining items could not change the verdict from CORRECTIONS REQUIRED.

---

## 9. Documentation / risk verdict

- `fair-claim-query.server.ts:28-31` boundedness claim — **inaccurate**
  (F-CLAUDE-D049-04).
- `fair-claim-query.server.ts:40-44` fairness bound — **inaccurate under stale
  rows** (F-CLAUDE-D049-06).
- Migration comment "unless `stocky.allow_multi_shop_dispatch_ready = '1'`
  (migration/admin only)" — **inaccurate**; any role may set it
  (F-CLAUDE-D049-03).
- PR #20 body "database rejection of `DurableJob.shopId` mutation" — **accurate**.
- PR #20 body "single-shop-per-transaction readiness guard with an explicit
  maintenance bypass mechanism" — **misleading**; the bypass is not restricted and
  the guard breaks a production writer.
- D-048 immutable review blob — **byte-identical** ✅.

**R-119, R-120, R-121, R-122, R-123, R-124 all remain OPEN.** R-121 (materialised
as F-D048-01) is **not** closed — it is reopened by F-CLAUDE-D049-01. R-123 is
reinforced by F-CLAUDE-D049-02/03 and the `processingEnabled` trigger gap.

Inventory-write flags remain OFF. Q-003 and F-PR4-18 remain OPEN. PR 5 remains
blocked. Production remains unauthorized.

---

## 10. Safety / scope statement

No prohibited action was taken. PR #20 was not merged, not marked ready, and not
modified. No commit was made to `phase-1/sync-control-plane`. No runtime code,
test, migration, config, implementation report, status document, risk document,
PR body, or prior immutable review was modified. No finding was fixed during
review. PR 5 was not begun. No inventory write was enabled. No production
migration, queue execution, webhook replay, or merchant/production data access
occurred — all work ran against a locally created, disposable PostgreSQL cluster
seeded with synthetic fixtures. No history was amended, rebased, squashed, or
force-pushed.

Probe scripts were written under `stocky-plus/.d049probe/` for execution only and
are **not** committed; the only committed artifact is this report.

---

## 11. Findings summary

**P0:** none.

**P1:**
1. **F-CLAUDE-D049-01** — permanent false-negative readiness; `heal_empty`
   deletes on a stale snapshot. Reopens F-D048-01.
2. **F-CLAUDE-D049-02** — D-049 guard breaks `recoverExpiredDispatchLeases`;
   self-perpetuating global dispatch outage. New regression introduced by D-049.

**P2:**
3. **F-CLAUDE-D049-03** — single-shop guard is convention, not enforcement;
   restricted roles bypass it.
4. **F-CLAUDE-D049-04** — "scheduling rows examined ≤ shopCap" is false under
   SKIP LOCKED contention.

**P3:**
5. **F-CLAUDE-D049-05** — acceptance-test tolerance mirrors the implementation.
6. **F-CLAUDE-D049-06** — documented starvation bound does not hold under stale
   readiness.

---

## 12. Final verdict

# CORRECTIONS REQUIRED

D-049 correction closure is **not approved**.

Two of the six D-048 findings it claims to close are not closed:

- **F-D048-01** (P1, concurrent same-shop false-negative readiness) is reopened —
  the same class of permanent false negative reproduces at 10.5% against the
  production claim SQL through an interleaving the new gate does not exercise.
- **F-D048-05** (P2, multi-shop lock/deadlock hazard) is displaced rather than
  resolved, and its mitigation introduces a **new P1 platform-wide dispatch
  outage** that did not exist before D-049.

Genuinely closed: **F-D048-04** (`shopId` immutability), **F-D048-02**
(`heal_empty` disjointness — as a DML-path defect), **F-D048-03** (active-due
boundedness, verified to 20,000 active due at 0.67 ms). **F-D048-06** is green in
both exact-head CI runs.

Both exact-head CI runs are legitimately green. That is not evidence of
correctness here — it is evidence that the acceptance suite does not test the
failure modes above. `d049-readiness-corrections.test.ts` passes 8/8 and
`test:sync-dispatch-recovery` passes 29/29 at the reviewed head while both P1
defects are present and reproducible.

Recommended sequencing: fix F-CLAUDE-D049-02 first (largest blast radius,
smallest change), then F-CLAUDE-D049-01 (requires a design decision on where
deletion is safe), then reclassify or enforce F-CLAUDE-D049-03, then correct the
documentation findings. Add the three missing gates before requesting re-review.

Do not merge. Do not mark ready. Do not begin PR 5. Production remains
unauthorized.

---

*Independent review performed by Claude Code at exact head*
`2b177152ed06c01a36025fbfc4f6a1f1eaa30969`*. Return to ChatGPT.*
