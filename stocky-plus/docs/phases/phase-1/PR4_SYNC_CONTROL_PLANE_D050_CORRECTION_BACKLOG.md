# Phase 1 PR 4 — D-050 Correction Backlog

**Decision:** D-050 — Phase 1 PR 4 split claim/reconcile snapshots + statement-level readiness  
**Authorized starting reviewed head (D-049 implementation):** `2b177152ed06c01a36025fbfc4f6a1f1eaa30969`  
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Immutable D-049 review:** `30955f844967e79523d543d245a4b58b70cbdc66` → incorporated blob `aa713ad37147e8b9ca1eadfdc60c1c0f50a7ec8f`  
**Review verdict:** `CORRECTIONS REQUIRED`  
**Status after Cursor work:** `D-050 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Do **not** mark any finding closed on Cursor evidence. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains **BLOCKED**. Inventory-write flags remain **OFF**. Q-003 and F-PR4-18 remain **OPEN**. R-119…R-124 remain **OPEN**. R-121 continues to record that the false-negative risk **materialized**.

## Accidental post-review metadata incident

After D-049 review of `2b17715…`, five transparent commits (`b725435`…`1c49081`) added only root file `__nonexistent__` (3 lines). Verified:

`git diff --name-status 2b17715…1c49081` → `A __nonexistent__` only.

Cleanup commit deleted that file without history rewrite. Zero application/runtime delta. Recorded as repository-control metadata incident.

## Approved findings in scope

| ID | Severity | Summary | Required direction |
|---|---|---|---|
| F-CLAUDE-D049-01 | P1 | Claim/reconcile same-statement snapshot permanently deletes readiness | Split scheduler / candidates / lease / fresh-snapshot reconcile |
| F-CLAUDE-D049-02 | P1 | Single-shop GUC breaks cross-shop expired-lease recovery | Remove GUC; statement-level multi-shop maintain; bounded recovery |
| F-CLAUDE-D049-03 | P2 | Custom GUC is convention, not enforceable | No user-settable GUC correctness boundary |
| F-CLAUDE-D049-04 | P2 | "rows examined ≤ shopCap" false under SKIP LOCKED | Truthful returned/locked ≤ shopCap; examined may be lockedPrefix+shopCap |
| F-CLAUDE-D049-05 | P3 | 1s hidden-work gate mirrors implementation | Independent contract for approved 1s anti-reset max |
| F-CLAUDE-D049-06 | P3 | Healthy starvation bound overstated with stale rows | Degraded repair+service bound; preserve healthy F-PR4-13 |

## Architecture (required)

1. Production scheduler lock statement (no reconcile).
2. Production job-candidate statement for locked shops (VALUES ordinals).
3. Lease CAS.
4. Fresh-snapshot readiness reconciliation (only non-monotonic correction).
5. Statement-level transition-table triggers; shopId ASC; advisory xact lock serialization.
6. Bounded expired-lease recovery with FOR UPDATE SKIP LOCKED.
7. New additive migration `20260811190000_sync_control_plane_d050_split_claim_statement_triggers`.

## Risks

- **R-119…R-124** remain OPEN.
- **R-121** OPEN — MATERIALIZED false-negative risk; D-050 addresses claim/reconcile race pending independent verification.
- New risks for D-049 P1 regressions tracked as **R-125** (claim/reconcile snapshot FN) and **R-126** (expired-lease / GUC platform abort) until independently verified closed.

## Non-goals

- Do not begin PR 5.
- Do not edit immutable review reports.
- Do not enable inventory writes or run production migrations.
- Do not start Claude review from this Cursor turn.
