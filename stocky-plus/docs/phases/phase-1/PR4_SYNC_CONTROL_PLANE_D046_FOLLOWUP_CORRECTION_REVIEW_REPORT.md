# Phase 1 PR 4 — D-046 Follow-Up Correction Review Report (P2-D046-01 / P3-D046-01)

**Immutable review record. Do not edit.**

**Reviewer:** Claude Code (independent principal engineer / architecture + release-risk review)
**Scope:** Focused re-review of P2-D046-01 (eligible-claim performance harness) and P3-D046-01
(sync-integration zero-test name-filter guard), plus directly associated documentation, identity,
and workflow-trigger changes. **Not** a full D-046 re-review.

## 1. Identity

| Field | Value |
|---|---|
| Reviewed head SHA | `b76fa2b63cb18cf2717a9269b7740decf0576bea` |
| Confirmed merge base / authorized main | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Verified merge base (`git merge-base`) | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` — matches |
| Branch | `phase-1/sync-control-plane` |
| PR | #20 — **OPEN, DRAFT, UNMERGED** (`state=open`, `draft=true`, `merged=false`, `mergeable_state=clean`) |
| Prior immutable D-046 review report tip | `3a5ae17b18d6e482df8e355f6f18e77f8681a3fe` — **unmodified** |
| Focused correction commit | `9bbd8c7` (`fix(test): determinize F-PR4-11 claim plan gate (P2-D046-01)`) |

## 2. Exact-head CI evidence

| Field | Value | Verified |
|---|---|---|
| Workflow | CI | ✅ |
| Run number | 198 | ✅ |
| Run ID | 31126856745 | ✅ |
| Job ID | 92700945607 | ✅ |
| Event | `pull_request` | ✅ |
| Head SHA | `b76fa2b63cb18cf2717a9269b7740decf0576bea` | ✅ exact match |
| Status / conclusion | completed / success | ✅ |

- All **135** job steps report `conclusion: success`. **No step skipped, cancelled, or neutral.**
- Step 91 `Sync dispatch performance/fairness (F-PR4-11/13)` — success.
- All focused D-046 / D-045 gates (steps 57–89) — success, including
  `NEW-CLAUDE-D045-01: queue classification seam absent`,
  `NEW-CLAUDE-D045-02: v3/v2 worker verified-after-rollback`,
  `NEW-CLAUDE-D045-02: RepeatableRead transaction option`.
- `workflow_dispatch` addition (`d44b6cf`) is **purely additive** — three lines
  (comment + `workflow_dispatch:`). `push: branches: [main, "phase-1/**"]` and bare
  `pull_request:` are byte-identical to the pre-change file. No trigger weakened, no
  `paths`/`paths-ignore` filter, no `if:` guard, no permission widening
  (`permissions: contents: read` unchanged).
- Reopen/close sequence altered **no code identity**: commits after the fix
  (`dd5c61e`, `c262710`, `50754d7`, `d44b6cf`, `b76fa2b`) touch only Markdown plus the
  three-line `ci.yml` trigger addition.

## 3. Commands executed (independent local reproduction)

Environment: PostgreSQL 16 + Redis 7 provisioned locally to the CI matrix
(`prisma migrate deploy`, `tenant:indexes:apply`, `tenant:roles:provision`,
`tenant:enforcement:apply`), Node v22.22.2, npm 11.5.2 (pinned to match CI).

| # | Command | Exit | Result |
|---|---|:--:|---|
| 1 | `vitest run --config vitest.sync-integration.config.ts eligible-claim-plan.test.ts -t "zzz-no-such-test-name-xyz"` | **1** | 6 skipped; `[ci-guard]` emitted |
| 2 | `… -t "rejects external sort"` | **0** | 1 passed / 5 skipped |
| 3 | `… eligible-claim-plan.test.ts` (no filter) | **0** | 6 passed |
| 4 | probe `-t` matching a `.skip` test only | **1** | 3 skipped; guard fired |
| 5 | probe `-t` matching an `it.todo` only | **1** | 2 skipped / 1 todo; guard fired |
| 6 | probe `-t` matching a passing test | **0** | 1 passed / 2 skipped |
| 7 | `vitest run --config vitest.config.ts -t "zzz-nonexistent-name"` (default config) | **0** | 56 skipped — guard correctly **not** applied |
| 8 | `npm run test:sync-performance` ×3 | **0, 0, 0** | 7 passed each (1 integration + 6 shape); 8332 / 6971 / 5865 ms |
| 9 | `npm run test:sync-integration` | **0** | **15 files, 181 tests passed** |
| 10 | `test:sync-dispatch-recovery -t "stranded ENQUEUED recovery"` | **0** | 1 passed / 28 skipped |
| 11 | `test:sync-exactly-once -t "NEW-CLAUDE-D045-02: v3 worker verified-after-rollback"` | **0** | 1 passed / 41 skipped |
| 12 | `test:sync-exactly-once -t "NEW-CLAUDE-D045-02: v2 worker verified-after-rollback"` | **0** | 1 passed / 41 skipped |
| 13 | `test:sync-exactly-once -t "NEW-CLAUDE-D045-02: RepeatableRead transaction option"` | **0** | 1 passed / 41 skipped |
| 14 | `test:sync-exactly-once -t "digest mismatch dead-letters conflict"` | **0** | 1 passed / 41 skipped |
| 15 | `test:sync-final-correction -t "production queue-presence exports no classification seam"` | **0** | 1 passed / 20 skipped |
| 16 | `test:sync-final-correction -t "terminal transition result required"` | **0** | 1 passed / 20 skipped |
| 17 | `test:sync-attempt-recovery -t "completeAttemptFail always dead-letters"` | **0** | 1 passed / 15 skipped |
| 18 | `test:sync-dispatch-recovery -t "stranded ENQUEUED recovery THAT-NO-LONGER-EXISTS"` (drift negative) | **1** | 29 skipped; guard fired — **fails closed** |
| 19 | `npm run lint` | **0** | clean |
| 20 | `npm run typecheck` | **0** | clean |
| 21 | `npm run build` | **0** | built |
| 22 | `npm run tenant:access:inventory:check` | **0** | `tenant_access_inventory_fresh` |

## 4. P2-D046-01 — performance-harness verification

Index definitions inspected at
`prisma/migrations/20260804210000_sync_control_plane_correction/migration.sql:82-96` and
`20260804180000_sync_control_plane/migration.sql:256`:

- `DurableJob_eligible_pending_idx` — `("nextEligibleAt" ASC,"createdAt" ASC,"id") WHERE "state"='PENDING'`
- `DurableJob_shop_eligible_pending_idx` — `("shopId","nextEligibleAt" ASC,"createdAt" ASC) WHERE "state"='PENDING'`
- `DurableJob_state_nextEligibleAt_createdAt_idx` — `("state","nextEligibleAt","createdAt")` (non-partial; still relevant — it is the index the planner selects under stale statistics)

Checklist against the harness at `app/sync/__tests__/sync-performance.test.ts` and
`app/sync/__tests__/eligible-claim-plan.ts`:

| Requirement | Verdict | Evidence |
|---|:--:|---|
| Bulk-inserts representative 50,000-row dataset | ✅ | `SCALE = 50000`, 500-row batches, 5 shops |
| Explicitly runs `ANALYZE` after bulk insert | ✅ | `ANALYZE "DurableJob"` before `EXPLAIN` |
| Updates planner statistics before `EXPLAIN` | ✅ | **Load-bearing, proven**: with `pg_statistic` cleared the same query plans `Bitmap Index Scan on DurableJob_state_nextEligibleAt_createdAt_idx` + `Sort Method: top-N heapsort` (1899 buffers, 31.4 ms) → assertion **fails**. After `ANALYZE`: `Limit → Index Only Scan using "DurableJob_eligible_pending_idx"` (16 buffers, 0.077 ms) → passes |
| Requires `DurableJob_eligible_pending_idx` | ✅ | regex `Index (?:Only )?Scan using "DurableJob_eligible_pending_idx"` |
| Rejects `DurableJob_shop_eligible_pending_idx` | ✅ | explicit rejection clause |
| Rejects sequential scans | ✅ | `Seq Scan on "DurableJob"` rejected |
| Rejects `Sort` and `Incremental Sort` | ✅ | `Incremental Sort` / `Sort Method:` / `-> Sort` rejected |
| Preserves timing / buffer / row-count / external-sort / fairness thresholds | ✅ | `Sort Method: external` retained; `claimed > 0`, `groupBy(shopId).length > 1`, `elapsed < 30_000`, `maxPerShop: 2`, `batchSize: 20`, 180 s timeout — all unchanged |
| No retries, sleeps, skips, env exemptions, planner forcing | ✅ | no `enable_*`, no `SET LOCAL` planner GUC, no `retry`, no `it.skip`, no `process.env` gate. Only `SET work_mem='64MB'` — pre-existing, `RESET` in `finally` |
| No runtime-code change | ✅ | diff `3a5ae17..b76fa2b` over `app/`, `scripts/`, `prisma/` touches **only** three test files and the reporter — zero production runtime lines |
| Proves Limit → Index Only Scan after `ANALYZE` | ✅ | reproduced independently (above) |
| Stable across repeated executions | ✅ | 3/3 runs green, 7 passed each |

**Assertion vs the operational claim query — FAILS.** See finding **P2-NEW-D047-01** below.

## 5. P3-D046-01 — zero-test guard verification

`scripts/vitest/fail-on-zero-passed-name-filter.ts`, wired only in
`vitest.sync-integration.config.ts`.

| Requirement | Verdict | Evidence |
|---|:--:|---|
| Detects `testNamePattern` with zero passed tests | ✅ | cmd 1, 18 |
| Exits non-zero for nonexistent `-t` | ✅ | exit 1 |
| Does not fail normal runs without `testNamePattern` | ✅ | cmd 3 (6 passed), cmd 9 (181 passed) |
| Does not fail matching name-filter runs | ✅ | cmds 2, 6, 10–17 |
| Does not treat skipped/todo as successful matches | ✅ | cmds 4, 5 — only `result?.state === "pass"` counts; `skip`/`todo` correctly excluded |
| Scoped to sync-integration focused gates | ✅ | cmd 7 — default config unaffected |
| 27 focused CI gates no longer fail open on name drift | ✅ | cmd 18 — a drifted name on a real gate now exits 1 |

Recursion over `task.type === "suite"` correctly reaches nested `describe` blocks;
`process.exitCode = 1` in `onFinished` reliably produced exit 1 in every probe.

## 6. Findings

### P0 — none

### P1 — none

### P2

---

**Finding ID:** `P2-NEW-D047-01`
**Severity:** P2
**Title:** F-PR4-11 performance gate asserts a synthetic query, not the operational claim path

**File / line:** `stocky-plus/app/sync/__tests__/sync-performance.test.ts:99-104`
(EXPLAIN subject); `stocky-plus/app/sync/dispatcher.server.ts:162-188`
(`claimBatchFair`, the real claim query).

**Evidence.** The gate EXPLAINs a query composed inline by the test:

```sql
SELECT id FROM "DurableJob"
WHERE state = 'PENDING' AND "nextEligibleAt" <= NOW()
ORDER BY "nextEligibleAt", "createdAt", id
LIMIT 50
```

No production code path issues this statement. The operational claim executed by
`dispatchPendingJobs` → `claimBatchFair` differs in two decisive ways: it filters
`state IN ('PENDING','RETRY_WAIT')` (not `state = 'PENDING'`), and it wraps the scan in a
`ROW_NUMBER() OVER (PARTITION BY "shopId" …)` window for per-shop fairness.

Reproduced on the reviewed head, same 50,000-row dataset, immediately after `ANALYZE`,
`work_mem = 64MB`:

```
########## HARNESS QUERY (what the gate asserts) ##########
Limit  (actual time=0.033..0.054 rows=50 loops=1)
  Buffers: shared hit=16
  ->  Index Only Scan using "DurableJob_eligible_pending_idx" on "DurableJob"
Execution Time: 0.077 ms

########## OPERATIONAL claimBatchFair QUERY ##########
Limit  (actual time=169.943..169.947 rows=10 loops=1)
  Buffers: shared hit=1852
  ->  Sort  (Sort Key: eligible."nextEligibleAt", …  Sort Method: quicksort)
        ->  WindowAgg  (Run Condition: row_number() OVER (?) <= 2)
              ->  Sort  (Sort Key: "shopId","nextEligibleAt","createdAt",id  quicksort  Memory: 5442kB)
                    ->  Seq Scan on "DurableJob"  (rows=50000)
                          Filter: state = ANY ('{PENDING,RETRY_WAIT}') AND "nextEligibleAt" <= now()
Execution Time: 170.076 ms
```

The real claim path exhibits **precisely the three plan shapes the gate declares
prohibited** — a `Seq Scan on "DurableJob"`, two `Sort` nodes, and a full 50,000-row scan
(1852 buffers, 170 ms versus 16 buffers, 0.077 ms). `DurableJob_eligible_pending_idx` — the
index the corrected assertion now mandates — is **not used by the claim path at all**,
because a partial index `WHERE state = 'PENDING'` cannot serve an `IN ('PENDING','RETRY_WAIT')`
predicate, and the `PARTITION BY "shopId"` window forces a re-sort regardless.

The implementation report at
`PR4_SYNC_CONTROL_PLANE_D046_CORRECTION_IMPLEMENTATION_REPORT.md` labels
`DurableJob_eligible_pending_idx` the "**intended ordered claim path**". On this head that
label is not supported by the dispatcher.

Note also that the correction now *rejects* `DurableJob_shop_eligible_pending_idx` — the
shop-leading index whose column order (`shopId`, `nextEligibleAt`, `createdAt`) is the one
that matches the operational query's `PARTITION BY "shopId" ORDER BY "nextEligibleAt", "createdAt"`.
The gate is tightened away from the index most likely to serve the real claim.

**Merchant impact.** F-PR4-11 is the gate that is supposed to guarantee dispatch claim
latency does not degrade as the durable-job backlog grows. It currently proves a property of
a query no worker runs. A genuine regression in `claimBatchFair` — an added predicate that
defeats indexing, a widened state set, a fairness-window change — would leave this gate
green. At 50k eligible jobs the real claim already costs ~170 ms and a full table scan per
dispatch tick; at 500k it degrades super-linearly (sort of the full eligible set), and
nothing in CI would surface that. The risk is delayed webhook application and growing sync
lag for large merchants, with no early warning.

**Reproduction.** Seed 50,000 `PENDING` `DurableJob` rows across 5 shops, `ANALYZE "DurableJob"`,
`SET work_mem='64MB'`, then `EXPLAIN (ANALYZE, BUFFERS)` both statements above and compare.

**Expected behavior.** The plan-shape gate should EXPLAIN the query the dispatcher actually
executes — the `claimBatchFair` CTE, with the same `state IN (…)` predicate, the same
`ROW_NUMBER() OVER (PARTITION BY "shopId" …)`, and the same `maxPerShop` / `batchSize`
bindings — and assert a plan shape that is achievable and required for that query.

**Recommended correction.** Either (a) extract the claim SQL into a single shared,
exported statement builder used by both `claimBatchFair` and the harness, so the gate
EXPLAINs the identical text and cannot drift; or (b) if the current claim plan (Seq Scan +
two sorts) is an accepted characteristic of the fair-claim design at this stage, keep the
harness query as an index-availability smoke check but **relabel it truthfully** — it is not
an "operational claim path" assertion — and open a separate, honestly-scoped risk covering
`claimBatchFair` scan cost at backlog scale. Do not leave the current labelling, which
asserts a guarantee the code does not provide. Option (a) is the correct end state.

**Missing test.** A plan-shape assertion over the real `claimBatchFair` statement at 50k
rows, plus an upper bound on rows scanned / buffers touched by the claim as backlog grows —
so the fairness window's full-scan cost is bounded and visible.

---

### P3

**Finding ID:** `P3-NEW-D047-01`
**Severity:** P3
**Title:** Zero-pass name-filter guard does not cover the `test:migrations` `-t` gates

**File / line:** `stocky-plus/vitest.sync-integration.config.ts:14`;
`.github/workflows/ci.yml:218`, `:618`, `:621`.

**Evidence.** The reporter is registered only in `vitest.sync-integration.config.ts`.
Confirmed empirically (cmd 7): under `vitest.config.ts` a nonexistent `-t` still exits 0 with
56 tests skipped. Three CI gates outside the sync-integration config use `-t` filters and
therefore still fail open on test-name drift:

- `:218` `test:migrations … partial-apply-recovery.test.ts -t "interrupt after|resume preflight"`
- `:618` `test:migrations … tenant-expansion.migration.test.ts -t "NEW-PR4-C07 role-present"`
- `:621` `test:migrations … tenant-expansion.migration.test.ts -t "NEW-PR4-C07 role-absent"`

**Merchant impact.** Indirect. Renaming a tenant-enforcement interruption/resume or
migration role-fixture test would silently convert those gates into no-ops, removing
migration-safety coverage without any CI signal.

**Reproduction.** `npm run test:migrations -- <file> -t "name-that-does-not-exist"` → exit 0.

**Expected behavior.** Every `-t`-filtered CI gate fails closed on zero passes.

**Recommended correction.** Register the same reporter in the migrations (and tenant-access)
Vitest configs. The reporter is config-agnostic; this is a one-line addition per config. The
P3-D046-01 scope as written ("sync-integration focused gates") was met — this is the
residual gap, not a scope violation.

**Missing test.** A reporter-level unit or smoke gate asserting non-zero exit for a
nonexistent `-t` under each config that CI invokes with `-t`.

---

**Finding ID:** `P3-NEW-D047-02`
**Severity:** P3
**Title:** PR #20 description describes a superseded head and the opposite correction

**File / line:** GitHub PR #20 body (not a repository file).

**Evidence.** The PR body still states "Performance harness correction tip / current PR head
= `f8673b062eee59a6db2a053b2c20aca7ce756a0b`", cites exact-head CI run `31110954422` /
job `92648314553`, and describes the correction as: "The correction **accepts** the committed
`DurableJob_shop_eligible_pending_idx` in the plan-index allow pattern." The reviewed head
`b76fa2b6` does the **opposite** — it explicitly rejects that index. The body also reports
"`test:sync-integration`: 175 passed"; the reviewed head has 181.

The in-repository documents are accurate: the backlog, the implementation report, R-119, and
`PROJECT_STATUS.md` all correctly describe the current approach and identity. Only the
GitHub-side body is stale.

**Merchant impact.** None directly; it is a chain-of-custody/reviewability defect. A reviewer
reading the PR description would verify against the wrong head and the wrong correction —
the same class of identity drift already recorded as NEW-CLAUDE-D045-03 and R-117.

**Expected behavior.** PR body identity table and CI evidence match the live head.

**Recommended correction.** Update the PR #20 body identity table to head `b76fa2b6`,
run 198 / `31126856745` / job `92700945607`, and replace the superseded
"accepts `DurableJob_shop_eligible_pending_idx`" paragraph with the current
ANALYZE-plus-strict-assertion description. (Not performed by this review — the review does
not modify PR state.)

## 7. Verdicts

| Item | Verdict |
|---|---|
| **P2-D046-01 (performance harness)** | **PARTIALLY CORRECT — CORRECTIONS REQUIRED.** The stated mechanism is real and independently proven: the `ANALYZE` step is load-bearing, the strict assertion is honest about Sort/Seq Scan/index name, thresholds are preserved, and no retries, sleeps, skips, environment exemptions, planner forcing, or runtime changes were introduced. Stability confirmed 3/3. However the assertion does **not** reflect the operational claim query (`P2-NEW-D047-01`); the gate proves a synthetic statement while the real `claimBatchFair` plan exhibits every prohibited shape. |
| **P3-D046-01 (zero-test guard)** | **CORRECT — ACCEPTED.** All seven required behaviors independently verified, including correct skip/todo handling and correct scoping. Residual coverage gap outside the declared scope recorded as `P3-NEW-D047-01`. |
| **Workflow-trigger change** | **ACCEPTED.** `workflow_dispatch` is purely additive; `push` and `pull_request` triggers and `permissions` are unchanged. Push and pull-request CI were not weakened. |
| **Documentation and identity** | **ACCEPTED IN-REPO, ONE DEFECT OFF-REPO.** Backlog, implementation report, `PROJECT_STATUS.md`, R-119, tenant-access inventory anchors, and `ci.yml` are accurate and internally consistent; R-119 is correctly opened at P2 and correctly left OPEN; the prior immutable D-046 review report at `3a5ae17…` is byte-unchanged. The one overclaim is the report's "intended ordered claim path" label (folded into `P2-NEW-D047-01`); the stale PR body is `P3-NEW-D047-02`. |
| **Original D-046 findings** | **INTACT — NOT DISTURBED.** `git diff 24b3891..b76fa2b` over `queue-presence.server.ts`, `dispatcher.server.ts`, `webhook-processor.ts`, `lifecycle.server.ts` is empty. All NEW-CLAUDE-D045-01…04 gates pass locally (cmds 11–15, 17) and in exact-head CI (steps 68–73). Not reopened. |
| **Safety and scope** | **CLEAN.** The focused change set touches only three test files and one Vitest reporter — zero production runtime lines. No migration executed against production, no queue execution, webhook replay, merchant data, ownership repair, or inventory mutation. All inventory-write feature flags remain `false`. No secrets introduced. No amend, rebase, squash, or force-push. PR #20 remains OPEN, DRAFT, UNMERGED; PR 5 not started. |

## 8. Final verdict

**CORRECTIONS REQUIRED**

The P2-D046-01 determinization is a genuine improvement, correctly implemented, and the
P3-D046-01 guard is correct and effective. But F-PR4-11's stated purpose — proving the
eligible-claim path is index-supported at scale — is still not met: the gate asserts a query
the dispatcher does not run, while the query it does run performs a full sequential scan and
two sorts over the entire eligible set. Resolve `P2-NEW-D047-01` (and the two P3 items)
before this correction is treated as closed.

Do not merge, mark ready, begin PR 5, enable inventory writes, or perform production activity.
