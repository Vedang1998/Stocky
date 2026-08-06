# Phase 1 PR 4 — D-046 Correction Backlog

**Decision:** D-046 — PHASE 1 PR 4 REVIEW CORRECTIONS REQUIRED  
**Status (during implementation):** `PR 4 D-046 FOLLOW-UP CORRECTIONS IN PROGRESS`  
**Branch:** `phase-1/sync-control-plane`  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Starting head (immutable review-report tip):** `ef452bb9e6c9e4dd48ce7d6dfbe9e9cf0e7738f2`  
**Reviewed implementation:** `c1c855494cefdca16d6d6571ebe8210a0cb94faf`  
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`

Immutable D-045 review report (do not edit):

`PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_REVIEW_REPORT.md`

Immutable D-046 review report (do not edit):

`PR4_SYNC_CONTROL_PLANE_D046_CORRECTION_REVIEW_REPORT.md` at `3a5ae17b18d6e482df8e355f6f18e77f8681a3fe`

## Scope

All four NEW-CLAUDE-D045 findings are **independently verified** and must not be reopened.

| ID | Sev | Defect | Required correction | Status |
|---|:---:|---|---|---|
| NEW-CLAUDE-D045-01 | P2 | Production-reachable `__setQueueStateClassificationSeamForTests` / `testStateClassificationSeam` | Remove seam; pure `classifyQueueState`; test-local `Job.getState` spy only where needed; export/source guards | **VERIFIED — do not reopen** |
| NEW-CLAUDE-D045-02 | P2 | SC01 “v2/v3” gate never executes `processWebhookJob`; shim may discard isolation options | Real v2/v3 worker catch-path matrix; RepeatableRead observation; truthful CI gates | **VERIFIED — do not reopen** |
| NEW-CLAUDE-D045-03 | P3 | Stale “Final runtime/test head = 10a9154…” | Distinguish primary / receipt-hook / DL-hook / review-report identities | **VERIFIED — do not reopen** |
| NEW-CLAUDE-D045-04 | P3 | `nextAttemptCount` not persisted on dead-letter paths | Persist on `ENQUEUED → FAILED` inside `terminalizeStrandedEnqueuedJob` | **VERIFIED — do not reopen** |

## Follow-up scope (D-046 review at `f8673b06…` / report `3a5ae17…`)

| ID | Sev | Defect | Required correction |
|---|:---:|---|---|
| P2-D046-01 | P2 | F-PR4-11 harness bulk-inserts without `ANALYZE`; widened regex accepts shop-leading / sorted plans | `ANALYZE "DurableJob"` after seed; assert `DurableJob_eligible_pending_idx` Index/Index Only Scan with **no Sort**; fixture regression rejecting shop/state sorted plans |
| P3-D046-01 | P3 | CI `-t` filters exit 0 when zero tests match | Narrow sync-integration Vitest reporter: fail when `testNamePattern` yields zero passes |
| P3-D046-02 | P3 | Restoration commit-message quality | **Non-blocking — do not change** |
| P3-D046-03 | P3 | Worker-finalize tenant DB substitution | **Non-blocking — do not change** |

## Hard constraints

- Keep Q-003 OPEN; F-PR4-18 OPEN; PR 5 BLOCKED; production unauthorized; inventory-write flags OFF.
- Do not edit immutable independent review reports.
- Do not amend, rebase, squash, or force-push; do not recreate the review-report commit.
- No production migration, queue execution, webhook replay, merchant data, or inventory mutation.
- No new production test bypass.
- Do not reopen NEW-CLAUDE-D045-01…04.
- Do not modify dispatcher runtime unless independent evidence shows runtime is wrong.

## Acceptance (Cursor side)

After follow-up implementation + exact-head CI:

`PR 4 D-046 FOLLOW-UP CORRECTIONS IMPLEMENTED — PENDING FOCUSED INDEPENDENT VERIFICATION`

Return evidence package to ChatGPT. Next Claude review is limited to P2-D046-01 and the P3-D046-01 zero-test guard — not a full D-046 re-review.
