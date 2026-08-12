# Phase 1 PR 4 — D-051 Correction Backlog

**Decision:** D-051 — Phase 1 PR 4 per-shop readiness lock scope (close global convoy)
**Authorized starting reviewed D-050 head:** `62f4cff0ec2c0ec9542959fb65be29b26997e603`
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`
**Immutable D-050 review:** `2e1fc3995614baf28d3fba1be59163d0be95096c` → incorporated blob `8247d8aea868818b8e904d196fee1a80fad283f5`
**Review verdict:** `APPROVE D-050 CORRECTION CLOSURE` (not PR 4 acceptance)
**Status after Cursor work:** `D-051 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Do **not** mark any finding closed on Cursor evidence. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains **BLOCKED**. Inventory-write flags remain **OFF**. Q-003 and F-PR4-18 remain **OPEN**.

D-050 correction closure is **APPROVED** for the two P1 defects it was created to repair. That approval is not PR 4 acceptance. D-051 is required because the D-050 global advisory lock creates measurable platform-wide cross-merchant serialization. Do not characterize that lock as an acceptable production throughput ceiling.

## Approved findings in scope

| ID | Severity | Summary | Required direction |
|---|---|---|---|
| F-CLAUDE-D050-01 | P2 | Global readiness advisory lock serializes unrelated merchants | Per-shop advisory after transaction-shape audit; no global mutex; no GUC revert; no silent multi-shop ban |
| F-CLAUDE-D050-02 | P3 | Stale D-050 implementation-report identity/CI | Record reviewed head `62f4cff…` and exact-head PUSH/PR CI; do not pretend those runs cover D-051 |
| F-CLAUDE-D050-03A | P3 | Stale fairness bound derived from helper under test | Independent expected formula/literal |
| F-CLAUDE-D050-03B | P3 | Anti-reset 500 ms setup overwritten before exercise | Distinct +500 ms / >1,000 ms / ~1,000 ms cases; independent 1000 ms and 1 ms literals |

## Architecture (required)

1. Additive migration `20260812230000_sync_control_plane_d051_readiness_lock_scope` replacing only trigger-function lock architecture.
2. Per-shop `pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0))` in shopId ASC.
3. Transaction-wide invariant: no supported runtime writer issues readiness-changing statements for different shops in separate statements. Opposite-order multi-statement acquisition fails closed (`stocky_dispatch_ready_lock_order`) rather than waiting into 40P01.
4. Preserve D-050 A/B/C/D protocol, 1,000 ms anti-reset, +1 ms fairness floor, zero permanent false-negative readiness, legitimate single-statement multi-shop writers.

## Transaction-shape audit (runtime)

See D-051 implementation report. Summary: every production readiness writer is either single-shop or a single multi-shop SQL statement processed shopId ASC. `claimBatchFair` is multi-shop multi-statement but does **not** take the readiness advisory lock.

## Risks

- **R-119, R-120, R-121, R-124, R-125, R-126:** CLOSED on D-050 independent evidence; regression gates remain mandatory during D-051.
- **R-122, R-123:** remain OPEN.
- **R-127:** OPEN — F-CLAUDE-D050-01 global convoy (D-051 addresses; pending independent verification).
- **R-128:** OPEN — F-CLAUDE-D050-03 non-independent contract tests (D-051 addresses; pending independent verification).
- F-CLAUDE-D050-02 tracked here; no new risk.

## Non-goals

- Do not begin PR 5.
- Do not edit the immutable D-050 (or earlier) review reports.
- Do not edit the reviewed D-050 migration.
- Do not redesign scheduler fairness or A/B/C/D reconciliation.
- Do not enable inventory writes or run production migrations.
- Do not start Claude review from this Cursor turn.
