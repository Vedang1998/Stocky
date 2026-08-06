# Phase 1 PR 4 — D-046 Correction Implementation Report

**Decision:** D-046 — PHASE 1 PR 4 REVIEW CORRECTIONS REQUIRED  
**Status after Cursor work:** `PR 4 D-046 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
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
| Documentation / status commit | recorded after this report lands (see Git history; not a self-referential tip) |
| Live final PR tip / exact-head CI | Authoritative only in GitHub PR #20 body after green CI |

Immutable reports (unchanged):

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_REVIEW_REPORT.md`

## Finding disposition (Cursor side only)

| ID | Sev | Exact correction | Primary files | Tests / gates |
|---|:---:|---|---|---|
| NEW-CLAUDE-D045-01 | P2 | Removed `testStateClassificationSeam` + `__setQueueStateClassificationSeamForTests`. Added pure `classifyQueueState`. `classifyExistingQueueJob` calls real `getState` → errors→`QUEUE_UNAVAILABLE` → pure classifier. Reaper/dispatcher unknown-state coverage uses test-local `Job.prototype.getState` spies restored in `finally`. | `queue-presence.server.ts`; dispatch-recovery + final-correction tests | export/source guards; pure classifier; Redis integration retained |
| NEW-CLAUDE-D045-02 | P2 | Added `sync-d046-worker-finalize.test.ts` driving real `processWebhookJob` for v2 and v3 through catch/finalization. Outcome matrix: verified-after-rollback / digest-conflict / uncertain for both versions. Observes `Prisma.TransactionIsolationLevel.RepeatableRead` on the real verification transaction. Envelope owner shim now forwards transaction options. CI gates renamed to truthful worker/isolation names. | `sync-d046-worker-finalize.test.ts`; `ci.yml`; `package.json` | NEW-CLAUDE-D045-02 gates |
| NEW-CLAUDE-D045-03 | P3 | Corrected D-045 implementation report identity table to distinguish `10a9154…` / `7b908e0…` / `c1c8554…` / `ef452bb…`. | `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_IMPLEMENTATION_REPORT.md` | documentation |
| NEW-CLAUDE-D045-04 | P3 | `terminalizeStrandedEnqueuedJob` persists `"attemptCount" = nextAttemptCount` on `ENQUEUED → FAILED` for NO_AUTOMATIC_RETRY, budget-exhausted, no-active-dispatch, and terminal/missing-dispatch paths. Architecture + reports updated. | `dispatcher.server.ts`; architecture; tests | NO_AUTOMATIC_RETRY N→N+1; budget maxAttempts-1→maxAttempts; forced-fail rollback; concurrent reaper |

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

## Safety

- No production migration
- No production role or privilege change committed as product behavior
- No production queue execution / webhook replay / merchant data
- No ownership repair / inventory mutation
- No PR 5 work
- No secrets
- No amend / rebase / squash / force-push
- PR #20 remains OPEN, DRAFT, UNMERGED
