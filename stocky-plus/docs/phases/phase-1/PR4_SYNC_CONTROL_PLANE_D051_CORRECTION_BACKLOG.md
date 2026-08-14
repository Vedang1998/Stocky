# Phase 1 PR 4 — D-051 Correction Backlog

**Decision:** D-051 — Phase 1 PR 4 per-shop readiness lock scope (close global convoy)
**Authorized starting reviewed D-050 head:** `62f4cff0ec2c0ec9542959fb65be29b26997e603`
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`
**Immutable D-050 review:** `2e1fc3995614baf28d3fba1be59163d0be95096c` → incorporated blob `8247d8aea868818b8e904d196fee1a80fad283f5`
**Independently reviewed D-051 head:** `938e9981dc5f4e551e0cebd37250ae7a40507575`
**D-051 runtime/test implementation head:** `05bcb88c213be8823e840c8233b98d46236ff644`
**Immutable D-051 review:** `3ad2dfbfe64b84addd3fcff14f62b424ea10eea0` then `c44b3c57db1aafeb4a5e21e4e451cc5e72d02abd` → incorporated as `768a1d2994ea38a3c49e2ea20c44e63228f6f58c` then `dd0f9e7626680e463978c192ff148d455e422fab` → blob `d17df5900b26740a32e4408618166abce2495f3a`
**Review verdict:** `APPROVE D-051 CORRECTION CLOSURE` (not PR 4 acceptance)
**Status after independent review / ChatGPT disposition:** `D-051 CORRECTION CLOSURE — APPROVED`. **Not PR 4 acceptance.** Subsequent **D-052:** PR 4 repository implementation **ACCEPTED** at `eb757119…` (merge not authorized).

PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains **BLOCKED**. Inventory-write flags remain **OFF**. Q-003 and F-PR4-18 are **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** under D-052. R-123 is an **ACCEPTED NONBLOCKING RESIDUAL** under D-052. This D-051 record does **not** implement F-CLAUDE-D051-02. D-052 does **not** create a runtime correction cycle and does **not** implement a static writer-shape guard.

D-050 correction closure remains **APPROVED** for the two P1 defects it was created to repair. D-051 closed the D-050 global-convoy P2 and the two D-050 P3 contract-test findings on independent evidence.

## Approved findings in scope (D-051)

| ID | Severity | Summary | Disposition |
|---|---|---|---|
| F-CLAUDE-D050-01 | P2 | Global readiness advisory lock serializes unrelated merchants | **CLOSED** on D-051 independent evidence (R-127 CLOSED) |
| F-CLAUDE-D050-02 | P3 | Stale D-050 implementation-report identity/CI | **CLOSED** on D-051 independent evidence |
| F-CLAUDE-D050-03A | P3 | Stale fairness bound derived from helper under test | **CLOSED** on D-051 independent evidence (R-128 CLOSED) |
| F-CLAUDE-D050-03B | P3 | Anti-reset 500 ms setup overwritten before exercise | **CLOSED** on D-051 independent evidence (R-128 CLOSED) |

## Architecture (required / as independently reviewed)

1. Additive migration `20260812230000_sync_control_plane_d051_readiness_lock_scope` replacing only trigger-function lock architecture.
2. Per-shop `pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0))` in shopId ASC.
3. **Correctness basis:** the currently audited runtime transaction-shape invariant prevents a supported runtime transaction from taking readiness advisory locks for different shops in separate statements in a dangerous order. Multi-shop writers are single-statement; multi-statement readiness writers are single-shop. Dispatcher claim does not take the maintain advisory lock.
4. **Defense-in-depth:** `stocky.ready_lock_max_shop` can fail closed for ordinary descending acquisition (`stocky_dispatch_ready_lock_order` / P0001) but is bypassable/clearable by `stocky_control_plane`. It is **not** a security or correctness enforcement boundary (F-CLAUDE-D051-01).
5. Preserve D-050 A/B/C/D protocol, 1,000 ms anti-reset, +1 ms fairness floor, zero permanent false-negative readiness, legitimate single-statement multi-shop writers.

## Transaction-shape audit (runtime)

See D-051 implementation report and the immutable D-051 review report. Summary: every production readiness writer is either single-shop or a single multi-shop SQL statement processed shopId ASC. `claimBatchFair` is multi-shop multi-statement but does **not** take the readiness advisory lock. Independent review verified this matrix at head `938e998…`.

## Residuals after D-051 closure (non-blocking; not a new correction cycle)

| ID | Severity | Tracking | Disposition |
|---|---|---|---|
| F-CLAUDE-D051-01 | P3 | R-123 | `stocky.ready_lock_max_shop` is bypassable by the control-plane role and must be described as **defense-in-depth**, not enforcement. Architectural wording corrected in this synchronization. |
| F-CLAUDE-D051-02 | P3 | R-123 | Current correctness relies on the independently verified transaction-shape invariant; there is not yet a static guard preventing future multi-shop / multi-statement readiness writers. **Do not implement now.** Deferred to the subsequent PR 4 acceptance decision / future writer gate. |
| F-CLAUDE-D051-03 | P3 | accepted residual | Pre-existing F-F03 overlap/harness flake. **Do not reopen R-124.** |

## Risks

- **R-119, R-120, R-121, R-124, R-125, R-126:** CLOSED on D-050 independent evidence; D-052 confirms PR 4 repository-implementation closure (R-124 remains CLOSED, not reopened).
- **R-127:** CLOSED — no regression (D-052; previously CLOSED on D-051 independent evidence for F-CLAUDE-D050-01).
- **R-128:** CLOSED — no regression (D-052; previously CLOSED on D-051 independent evidence for F-CLAUDE-D050-03).
- **R-122, R-123:** ACCEPTED NONBLOCKING RESIDUALS (D-052). R-123 tracks F-CLAUDE-D051-01/02 and F-CLAUDE-PR4ACC-03.

## Non-goals

- Do not begin PR 5.
- Do not edit the immutable D-050 or D-051 review reports.
- Do not edit the reviewed D-050 migration.
- Do not change D-051 executable migration SQL, trigger behavior, or runtime semantics.
- Do not redesign scheduler fairness or A/B/C/D reconciliation.
- Do not add a static/runtime writer-shape guard for F-CLAUDE-D051-02 in this cycle.
- Do not enable inventory writes or run production migrations.
- Do not start Claude review from this Cursor turn.
- Do not claim this D-051 record itself is PR 4 acceptance (acceptance is D-052).
