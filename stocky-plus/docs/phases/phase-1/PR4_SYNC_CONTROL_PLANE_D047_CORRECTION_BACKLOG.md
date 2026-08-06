# Phase 1 PR 4 — D-047 Correction Backlog

**Decision:** D-047 — PHASE 1 PR 4 FOCUSED OPERATIONAL CLAIM / MIGRATIONS GUARD CORRECTIONS  
**Status (during implementation):** `PR 4 D-047 CORRECTIONS IN PROGRESS`  
**Branch:** `phase-1/sync-control-plane`  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Required starting PR head:** `b76fa2b63cb18cf2717a9269b7740decf0576bea`  
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Independent focused review commit:** `8050e278ec8396345b842a653c5559243454432b`  
**Independent review branch:** `claude/p2-d046-01-harness-review-tmdtof`

Immutable focused review report (do not edit):

`PR4_SYNC_CONTROL_PLANE_D046_FOLLOWUP_CORRECTION_REVIEW_REPORT.md`

## Prior scope (do not reopen)

The four original D-046 findings (NEW-CLAUDE-D045-01…04) remain **independently verified**.

P2-D046-01 / P3-D046-01 harness/guard work was independently reviewed at head `b76fa2b…` with verdict **CORRECTIONS REQUIRED** for new findings below — not a reopen of D-046 originals.

## D-047 scope

| ID | Sev | Defect | Required correction | Status |
|---|:---:|---|---|---|
| P2-NEW-D047-01 | P2 | F-PR4-11 performance gate EXPLAINs a synthetic PENDING-only query; operational `claimBatchFair` Seq-Scans + sorts the full eligible set | Shared production SQL; bounded fair-claim algorithm; operational EXPLAIN at ≥50k; additive shop-claim indexes | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| P3-NEW-D047-01 | P3 | `test:migrations` `-t` gates fail open when zero tests match | Wire zero-pass name-filter reporter into `vitest.migrations.config.ts`; prove three CI gates + negatives | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| P3-NEW-D047-02 | P3 | Stale PR #20 body identity | Update PR body to live head / CI (ChatGPT or Cursor permissions) | OUT OF REPO — track separately |

## Hard constraints

- Keep Q-003 OPEN; F-PR4-18 OPEN; PR 5 BLOCKED; production unauthorized; inventory-write flags OFF.
- Do not edit immutable independent review reports.
- Do not amend, rebase, squash, or force-push.
- Do not reopen NEW-CLAUDE-D045-01…04 or redesign D-046 corrections without regression evidence.
- No production migration, queue execution, webhook replay, merchant data, or inventory mutation.
- No planner forcing (`enable_seqscan=off`), retries, sleeps, skips, env exemptions, or inflated `work_mem` to conceal plans.

## Acceptance (Cursor side)

After implementation + exact-head CI:

`PR 4 D-047 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Return evidence package to ChatGPT. Do not ask Claude to review.
