# Phase 1 PR 4 — Synchronization Control Plane Final Correction Backlog

**Authority:** ChatGPT (product / architecture)  
**Implementation owner:** Cursor  
**Independent final-correction reviewer:** Claude Code  
**Technical acceptance authority:** ChatGPT  
**Merge authority:** User only after ChatGPT acceptance  

```text
D-045 — PHASE 1 PR 4 FINAL CORRECTIONS REQUIRED.
NEW-PR4-SC01 IS THE BLOCKING P2 DEFECT.
NEW-PR4-SC02 THROUGH NEW-PR4-SC08 ARE INCLUDED IN THE FINAL-CORRECTION SCOPE.
THE ORIGINAL REVIEW, FIRST CORRECTION-REVIEW, AND SECOND-CORRECTION
REVIEW REPORTS MUST REMAIN UNCHANGED.
PR 5 REMAINS BLOCKED.
PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.
```

**Source second-correction review:** `PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_REVIEW_REPORT.md` (preserved verbatim — **do not edit**)  
**Prior immutable reports:** `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`, `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`  
**Decision:** D-045 — Phase 1 PR 4 final corrections required  

## Finding-count reconciliation

| Source | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Second-correction review new findings | 0 | 0 | 1 | 7 | 8 |
| **Final-correction scope (D-045)** | **0** | **0** | **1** | **7** | **8** |

NEW-PR4-SC01 is **blocking**. NEW-PR4-SC02 through NEW-PR4-SC08 are included in this cycle.

**Status legend:** every finding below uses

```text
IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

or, for Cursor’s overall work status after green exact-head CI:

```text
FINAL CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

Do **not** mark any finding or risk closed on Cursor evidence alone. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains blocked. Production execution and inventory writes remain unauthorized. All inventory-write flags remain default OFF. Keep **Q-003** and **F-PR4-18** open.

---

## Identity chain of custody

| Commit | Role |
|---|---|
| `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | Unchanged `origin/main` / authorized base |
| `b73a22f67afd9aa29995486afdfc52147c90fb9f` | Reviewed runtime/test implementation head (D-044 tip) |
| `9d43ec9fce7a37b3b336972bbb41a4b0f34e83cd` | Independent second-correction review-report commit; D-045 starting head |
| `59f14feac8b5758f08e13ce63750737019d2ed9d` | D-045 SC01 runtime/test correction |
| `10a9154ee368674b68836065f9c164be5dbb0b19` | D-045 SC02–SC06 / SC08 runtime/test + CI gates |
| Documentation / status commit | Recorded in `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_IMPLEMENTATION_REPORT.md` after push |
| Live final PR tip / exact-head CI | Authoritative only in GitHub PR #20 body after green CI |

Do not amend, rebase, squash, reset away, replace, or force-push the independent review commits. Do not edit:

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_REVIEW_REPORT.md`

Do not edit any existing migration. Use an additive migration only if a schema or database-enforced transition change is genuinely required (none required for this cycle).

---

## P2 — blocking

### NEW-PR4-SC01 · P2 · Worker finalizes SUCCEEDED on APPLICATION_ALREADY_APPLIED without verifying the receipt

| Field | Value |
|---|---|
| Severity | P2 (blocking for this cycle) |
| Object | `application-receipt.server.ts`; `application-finalize.server.ts`; `webhook-processor.ts` (v2 + v3); `tenant-db.server.ts` |
| Required correction | Shared post-rollback receipt verification at supported isolation (`RepeatableRead`); matching digest → `already_applied_verified_after_rollback`; missing/verify-fail → `application_outcome_uncertain` DEAD_LETTERED; digest mismatch → `application_digest_conflict` DEAD_LETTERED; conflict with no readable winner → `APPLICATION_OUTCOME_UNCERTAIN` (not ALREADY_APPLIED); v2/v3 share finalization |
| Acceptance tests | `test:sync-exactly-once` NEW-PR4-SC01:*; CI gates for matching / missing / digest / v2-v3 alignment |
| Affected risks | R-109; R-031 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P3 — included

### NEW-PR4-SC02 · P3 · Production-reachable Redis test timeout

| Field | Value |
|---|---|
| Object | `queue-presence.server.ts`; `queue.server.ts` |
| Required correction | Honor `STOCKY_TEST_REDIS_FAST_FAIL_MS` only when `NODE_ENV === "test"`; bound positive integer; clear timer; absorb late rejection; gate `STOCKY_TEST_REDIS_FAST_FAIL` to test |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-SC03 · P3 · Unbounded indeterminate DataIssue rows

| Field | Value |
|---|---|
| Object | `dispatcher.server.ts` (`recordIndeterminateDispatchEvidence`) |
| Required correction | Explicit cooldown (`INDETERMINATE_DATA_ISSUE_COOLDOWN_MS` = 15 min); SyncHealth always updated; DataIssue only on first observation / after cooldown / different reason or dispatch sequence; advisory lock for concurrent reapers |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-SC04 · P3 · Nullable selector filter omission

| Field | Value |
|---|---|
| Object | `dispatcher.server.ts`; `lifecycle.server.ts` (`renewAttemptHeartbeat`) |
| Required correction | Null `activeDispatchSequence` → fail closed (evidence + indeterminate, no mutation); heartbeat resolves exact unfinished attempt before durable-job update |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-SC05 · P3 · Unchecked FAILED → DEAD_LETTERED transition

| Field | Value |
|---|---|
| Object | `dispatcher.server.ts` (`terminalizeStrandedEnqueuedJob`) |
| Required correction | `UPDATE … WHERE state='FAILED' RETURNING id`; require exactly one row or throw and roll back entire transaction |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-SC06 · P3 · Runnable allowlist includes unreachable `paused`

| Field | Value |
|---|---|
| Object | `queue-presence.server.ts` |
| Required correction | Allowlist = `waiting`, `delayed`, `active`, `prioritized`, `waiting-children` for pinned BullMQ 5.81.2; document upgrade revalidation |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-SC07 · P3 · Chain-of-custody / status documentation inaccuracies

| Field | Value |
|---|---|
| Object | Second-correction implementation report; PROJECT_STATUS; phase-1 README; D-045 records |
| Required correction | Label `71bb576…` as documentation + test-fixture synchronization; `b73a22f…` reviewed runtime/test tip; `9d43ec9…` review-report tip; CI `31029829525` / `92387401357` no longer pending; no self-referential “final tip” commits |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### NEW-PR4-SC08 · P3 · Stranded recovery attempt budget unbounded; v2/v3 already-applied divergence

| Field | Value |
|---|---|
| Object | `dispatcher.server.ts`; architecture / implementation docs; SC01 shared finalize |
| Required correction | Confirmed stranded recovery: `nextAttemptCount = attemptCount + 1`; DL if `>= maxAttempts`; else `ENQUEUED → RETRY_WAIT` with atomic increment; no increment for indeterminate/runnable/noop/unavailable; v2/v3 alignment via SC01 |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

### F-PR4-18 / Q-003 — remain open

F-PR4-18 (API-version transition / live `2026-07` schema validation) and **Q-003** remain **OPEN**. This final-correction cycle does not claim live Shopify schema closure.

---

## Required CI gates

```text
NEW-PR4-SC01: matching receipt verified after rollback
NEW-PR4-SC01: missing receipt dead-letters uncertain
NEW-PR4-SC01: digest mismatch dead-letters conflict
NEW-PR4-SC01: v2 and v3 already-applied alignment
NEW-PR4-SC02: production ignores Redis test timeout
NEW-PR4-SC03: indeterminate evidence deduplicates
NEW-PR4-SC04: nullable selectors fail closed
NEW-PR4-SC05: terminal transition result required
NEW-PR4-SC06: BullMQ runnable-state compatibility
NEW-PR4-SC08: stranded recovery budget is bounded
```

Each focused command must select at least one test. No material `continue-on-error`. No material skips.

## Next action

```text
Return to ChatGPT for exact-head verification and a focused
independent Claude Code D-045 correction review.
```
