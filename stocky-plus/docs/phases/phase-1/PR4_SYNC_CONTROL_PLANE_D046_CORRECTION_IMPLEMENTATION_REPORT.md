# Phase 1 PR 4 — D-046 Correction Implementation Report

**Decision:** D-046 — PHASE 1 PR 4 REVIEW CORRECTIONS REQUIRED  
**Status after Cursor work:** `PR 4 D-046 FOLLOW-UP CORRECTIONS IMPLEMENTED — PENDING FOCUSED INDEPENDENT VERIFICATION`  
**Branch:** `phase-1/sync-control-plane`  
**PR:** #20 — OPEN, DRAFT, UNMERGED

## Identity chain (no self-referential tip)

| Identity | SHA / value |
|---|---|
| Unchanged `origin/main` / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Reviewed D-045 implementation | `c1c855494cefdca16d6d6571ebe8210a0cb94faf` |
| Immutable D-045 review-report / D-046 starting head | `ef452bb9e6c9e4dd48ce7d6dfbe9e9cf0e7738f2` |
| D-046 decision/backlog commit | `0adff84ef332e0732a1bb9c3c65f255677223da4` |
| D-046 runtime/test correction commit | `24b3891842902a306a63f5069dd163ccb615fc22` |
| Failed exact-head CI tip (perf gate) | `cc89d3854d1be305486a9574ec3a5656f9e7db63` — run `31098541431`, job `92606271330` |
| Prior F-PR4-11 regex-only harness tip | `f8673b062eee59a6db2a053b2c20aca7ce756a0b` (Claude reviewed) |
| Immutable D-046 review-report tip | `3a5ae17b18d6e482df8e355f6f18e77f8681a3fe` |
| P2-D046-01 / P3-D046-01 follow-up | see Git history after review tip (not a self-referential tip) |
| Live final PR tip / exact-head CI | Authoritative only from GitHub after green exact-head CI |

Immutable reports (do not edit):

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_D046_CORRECTION_REVIEW_REPORT.md`

## Finding disposition (Cursor side only)

| ID | Sev | Exact correction | Primary files | Tests / gates |
|---|:---:|---|---|---|
| NEW-CLAUDE-D045-01 | P2 | Removed `testStateClassificationSeam` + `__setQueueStateClassificationSeamForTests`. Added pure `classifyQueueState`. `classifyExistingQueueJob` calls real `getState` → errors→`QUEUE_UNAVAILABLE` → pure classifier. Reaper/dispatcher unknown-state coverage uses test-local `Job.prototype.getState` spies restored in `finally`. | `queue-presence.server.ts`; dispatch-recovery + final-correction tests | export/source guards; pure classifier; Redis integration retained |
| NEW-CLAUDE-D045-02 | P2 | Added `sync-d046-worker-finalize.test.ts` driving real `processWebhookJob` for v2 and v3 through catch/finalization. Outcome matrix: verified-after-rollback / digest-conflict / uncertain for both versions. Observes `Prisma.TransactionIsolationLevel.RepeatableRead` on the real verification transaction. Envelope owner shim now forwards transaction options. CI gates renamed to truthful worker/isolation names. | `sync-d046-worker-finalize.test.ts`; `ci.yml`; `package.json` | NEW-CLAUDE-D045-02 gates |
| NEW-CLAUDE-D045-03 | P3 | Corrected D-045 implementation report identity table to distinguish `10a9154…` / `7b908e0…` / `c1c8554…` / `ef452bb…`. | `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_IMPLEMENTATION_REPORT.md` | documentation |
| NEW-CLAUDE-D045-04 | P3 | `terminalizeStrandedEnqueuedJob` persists `"attemptCount" = nextAttemptCount` on `ENQUEUED → FAILED` for NO_AUTOMATIC_RETRY, budget-exhausted, no-active-dispatch, and terminal/missing-dispatch paths. Architecture + reports updated. | `dispatcher.server.ts`; architecture; tests | NO_AUTOMATIC_RETRY N→N+1; budget maxAttempts-1→maxAttempts; forced-fail rollback; concurrent reaper |

**Independent verification (Claude at `f8673b06…`):** NEW-CLAUDE-D045-01…04 **VERIFIED**. Do not reopen.

## Follow-up disposition (P2-D046-01 / P3-D046-01)

| ID | Sev | Exact correction | Primary files | Tests / gates |
|---|:---:|---|---|---|
| P2-D046-01 | P2 | After 50k seed, `ANALYZE "DurableJob"`. Assert Index/Index Only Scan on `DurableJob_eligible_pending_idx` with **no Sort / Incremental Sort / external sort / Seq Scan**; reject shop-leading eligible index. Pure fixture regressions for CI shop plan + local Incremental Sort plan. **No** runtime dispatcher change; **no** threshold weakening; **no** retries/skips/`enable_*` planner forcing. | `eligible-claim-plan.ts`; `sync-performance.test.ts`; `eligible-claim-plan.test.ts` | `test:sync-performance` (7 tests: 1 integration + 6 shape) |
| P3-D046-01 | P3 | Sync-integration Vitest reporter fails when `testNamePattern` matches zero passing tests (`process.exitCode=1`). | `scripts/vitest/fail-on-zero-passed-name-filter.ts`; `vitest.sync-integration.config.ts` | `-t zzz-no-such` → exit 1; matching `-t` still passes |

### Planner variance evidence (reviewed-head reproduction)

Indexes (migration `20260804210000_sync_control_plane_correction`):

- `DurableJob_eligible_pending_idx` — `("nextEligibleAt","createdAt",id) WHERE state='PENDING'` (**intended ordered claim path**)
- `DurableJob_shop_eligible_pending_idx` — `("shopId","nextEligibleAt","createdAt") WHERE state='PENDING'` (shop-leading; requires re-sort for global ORDER BY)

Observed after 50k bulk insert **without** `ANALYZE` (this environment):  
`Incremental Sort` + `Index Scan using "DurableJob_state_nextEligibleAt_createdAt_idx"` (~50k rows scanned, ~2k buffers).  
CI failure tip previously chose `Index Scan using "DurableJob_shop_eligible_pending_idx"` + top-N heapsort.

Observed **after** `ANALYZE "DurableJob"`:  
`Limit → Index Only Scan using "DurableJob_eligible_pending_idx"` — **no Sort**, ~50 rows from index, ~4–17 shared buffers, sub-millisecond execution.

### P3-D046-02 / P3-D046-03

Non-blocking — untouched.

## Queue-seam replacement architecture

```text
inspectQueueDispatchPresence / classifyAfterQueueAdd
  → classifyExistingQueueJob(job)
       1. queueState = await job.getState()   // errors → QUEUE_UNAVAILABLE
       2. return classifyQueueState(queueState)  // pure; no mutable override
```

Unsupported future BullMQ strings classify as `UNKNOWN_STATE` without any module-global seam.

## Production-seam audit (D-046 delta)

Searched runtime/test delta for `__set`, `ForTests`, `test seam`, `force`, `NODE_ENV`, `STOCKY_TEST`, mutable module globals, caller-controlled overrides.

| Symbol / pattern | Result |
|---|---|
| `__setForceMissingWinnerAfterConflictForTests` | **Absent** from runtime |
| `testForceMissingWinnerAfterConflict` | **Absent** from runtime |
| `testForceSkipInitialReceiptRead` | **Absent** from runtime |
| `__setForceDeadLetterTransitionFailForTests` | **Absent** from runtime |
| `forceDeadLetterTransitionFailForTests` | **Absent** from runtime |
| `__setQueueStateClassificationSeamForTests` | **Removed** (D-046) — negative export/source guards remain |
| `testStateClassificationSeam` | **Removed** (D-046) |
| `resolveTestRedisFastFailMs` / `STOCKY_TEST_REDIS_FAST_FAIL(_MS)` | Retained — `NODE_ENV === "test"` gated, timeout-only, acceptable |
| `resetQueueClientsForTests` / `resetControlPlanePrismaForTests` / lifecycle `ForTests` helpers | Lifecycle reset only — do not alter business classification decisions |
| Worker `applyWithApplicationReceipt` mock | **Test-file only** (`vi.mock` in `sync-d046-worker-finalize.test.ts`) — not a production export |

No new production test bypass was added.

## Open gates (unchanged)

- Q-003 OPEN
- F-PR4-18 OPEN
- PR 5 BLOCKED
- Production unauthorized
- Every inventory-write flag OFF

## Local evidence (disposable — not acceptance)

| Command / gate | Observed |
|---|---|
| `test:sync-exactly-once` | **42** passed (35 + 7 worker) |
| `test:sync-final-correction` | **21** passed |
| `test:sync-dispatch-recovery` | **29** passed |
| `test:sync-attempt-recovery` | **16** passed |
| `test:sync-envelope-fail-closed` | **6** passed |
| `test:sync-uninstall` | **8** passed |
| `test:sync-integration` | **175** passed |
| `test:sync-role-isolation` | **9** passed |
| `test:sync-inventory-audit` | **5** passed |
| `test:sync-performance` | **1** passed |
| `test:db-isolation` | **19** passed |
| `test:tenant-access` | **288** passed |
| `test:migrations` | **219** passed |
| NEW-CLAUDE-D045-02: v3 worker verified-after-rollback | **1** passed |
| NEW-CLAUDE-D045-02: v2 worker verified-after-rollback | **1** passed |
| NEW-CLAUDE-D045-02: worker digest-conflict dead-letter | **2** passed |
| NEW-CLAUDE-D045-02: worker uncertain-outcome dead-letter | **2** passed |
| NEW-CLAUDE-D045-02: RepeatableRead transaction option | **1** passed |
| NEW-CLAUDE-D045-01: queue classification seam absent | **1** passed |
| lint / typecheck / build / graphql-codegen | executed (typecheck + build green after worker typing fix) |
| tenant:access:audit / inventory checks / sync:inventory:check / enforcement inventory | ok after EX-SYNC-TEST-013 + inventory refresh |

Exact-head CI `head_sha`, run ID, and job ID are authoritative only from GitHub after the final tip is green. Do not treat local green as acceptance.

## Exact-head CI failure — F-PR4-11/13 plan-name assertion (post D-046)

| Field | Evidence |
|---|---|
| Failed tip | `cc89d3854d1be305486a9574ec3a5656f9e7db63` |
| Failed run / job | `31098541431` / `92606271330` |
| Failing step / command | Sync dispatch performance/fairness (F-PR4-11/13) / `SYNC_PERF_JOB_COUNT=50000 npm run test:sync-performance` |
| Failing test | `eligible claim plan uses index at scale (no Seq Scan + external sort)` |
| Assertion | `/DurableJob_eligible_pending\|DurableJob_.*nextEligibleAt/i` |
| Measured plan | `Index Scan using "DurableJob_shop_eligible_pending_idx"`; in-memory `top-N heapsort`; **no** `Seq Scan on "DurableJob"`; **no** `Sort Method: external` |
| Classification | **Deterministic test/harness defect** (with environment-sensitive planner index choice among valid F-PR4-11 indexes). Not a production dispatcher regression; not a weakened threshold; not a flake excused by a single green rerun. |
| Same-job oscillation | Broader sync suite earlier in job `92606271330` passed the same test (~4587 ms) when the planner picked a regex-matching index; dedicated gate later failed on `shop_eligible_pending_idx`. |
| Correction | Extend allowed index-name regex to include `DurableJob_shop_eligible_pending_idx` (committed in migration `20260804210000_sync_control_plane_correction`). Retain Index Scan requirement and Seq Scan / external-sort bans. Refresh `PR2_TENANT_ACCESS_INVENTORY.md` line anchors after the harness edit (required by `tenant:access:inventory:check`). |
| Local stability | `SYNC_PERF_JOB_COUNT=50000 npm run test:sync-performance` ×5 → **1/1 passed** each; CI plan snippet: old regex false / new regex true; `test:sync-integration` **175** passed; lint / typecheck / build exit 0. |

Do **not** request independent Claude review until fresh exact-head CI on the correction tip succeeds with zero failures and zero material skips.

## Safety

- No production migration
- No production role or privilege change committed as product behavior
- No production queue execution / webhook replay / merchant data
- No ownership repair / inventory mutation
- No PR 5 work
- No secrets
- No amend / rebase / squash / force-push
- PR #20 remains OPEN, DRAFT, UNMERGED
