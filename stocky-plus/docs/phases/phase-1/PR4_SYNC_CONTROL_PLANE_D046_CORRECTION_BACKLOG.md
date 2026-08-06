# Phase 1 PR 4 — D-046 Correction Backlog

**Decision:** D-046 — PHASE 1 PR 4 REVIEW CORRECTIONS REQUIRED  
**Status (during implementation):** `PR 4 D-046 CORRECTIONS IN PROGRESS`  
**Branch:** `phase-1/sync-control-plane`  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Starting head (immutable review-report tip):** `ef452bb9e6c9e4dd48ce7d6dfbe9e9cf0e7738f2`  
**Reviewed implementation:** `c1c855494cefdca16d6d6571ebe8210a0cb94faf`  
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`

Immutable D-045 review report (do not edit):

`PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_REVIEW_REPORT.md`

## Scope

All four NEW-CLAUDE-D045 findings are in scope. Do not begin PR 5. Do not merge or mark PR #20 ready.

| ID | Sev | Defect | Required correction |
|---|:---:|---|---|
| NEW-CLAUDE-D045-01 | P2 | Production-reachable `__setQueueStateClassificationSeamForTests` / `testStateClassificationSeam` | Remove seam; pure `classifyQueueState`; test-local `Job.getState` spy only where needed; export/source guards |
| NEW-CLAUDE-D045-02 | P2 | SC01 “v2/v3” gate never executes `processWebhookJob`; shim may discard isolation options | Real v2/v3 worker catch-path matrix; RepeatableRead observation; truthful CI gates |
| NEW-CLAUDE-D045-03 | P3 | Stale “Final runtime/test head = 10a9154…” | Distinguish primary / receipt-hook / DL-hook / review-report identities |
| NEW-CLAUDE-D045-04 | P3 | `nextAttemptCount` not persisted on dead-letter paths | Persist on `ENQUEUED → FAILED` inside `terminalizeStrandedEnqueuedJob` |

## Hard constraints

- Keep Q-003 OPEN; F-PR4-18 OPEN; PR 5 BLOCKED; production unauthorized; inventory-write flags OFF.
- Do not edit immutable independent review reports.
- Do not amend, rebase, squash, or force-push; do not recreate the review-report commit.
- No production migration, queue execution, webhook replay, merchant data, or inventory mutation.
- No new production test bypass.

## Acceptance (Cursor side)

After implementation + exact-head CI:

`PR 4 D-046 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Return evidence package to ChatGPT for exact-head verification and focused D-046 independent review authorization. Do not hand off directly to Claude Code.
