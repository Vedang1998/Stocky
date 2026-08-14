# Phase 1 PR 4 — Accepted Nonblocking Residual Backlog

**Status:** `ACCEPTED NONBLOCKING RESIDUALS — NOT PRODUCTION-ROLLOUT CLOSED`

**Authority:** ChatGPT technical acceptance D-052
**Source review:** `PR4_SYNC_CONTROL_PLANE_CUMULATIVE_ACCEPTANCE_REVIEW_REPORT.md` at commit `ca7998486e2bfff6c03e75a18a7e81d6ab19bfd0`, blob `c9fca9b2effba5de3418e4523185beb3d92bc79e`
**Accepted implementation head:** `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3`
**Merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`
**Independent verdict:** `READY FOR CHATGPT PR 4 ACCEPTANCE` — P0 0 / P1 0 / P2 0 / P3 4

These residuals were carried into D-052 acceptance. They do **not** reopen PR 4 repository-implementation acceptance. None authorizes runtime, test, schema, migration, package, Shopify configuration, feature-flag, or CI workflow edits in this documentation-only synchronization. None authorizes merge.

| ID | Severity | Disposition | Summary | Gate |
|---|---|---|---|---|
| R-122 | P3 | ACCEPTED NONBLOCKING RESIDUAL | Fair-claim `shopId >= x AND shopId <= x` range-pair is load-bearing for plan shape; equality-regression CI gate exists and ordered-plan assertions fail closed on planner drift. Caught performance regression only; cannot corrupt inventory, tenancy, or correctness. | Keep equality-regression / ordered-plan gates; optional later index redesign |
| R-123 | P2 residual, nonblocking | ACCEPTED NONBLOCKING RESIDUAL | Current correctness basis is the audited runtime **transaction-shape invariant**. `stocky.ready_lock_max_shop` is **defense-in-depth only**. **F-CLAUDE-D051-01** remains an accepted P3 characterization. **F-CLAUDE-D051-02 / F-CLAUDE-PR4ACC-03** remains future-maintenance risk. **No static writer-shape guard is implemented in this task.** | Future-maintenance static writer-shape guard only; not this PR |
| F-CLAUDE-D051-01 | P3 | Accepted characterization on R-123 | `stocky.ready_lock_max_shop` is bypassable/clearable by `stocky_control_plane`; not enforcement | Preserve architectural wording |
| F-CLAUDE-D051-02 / F-CLAUDE-PR4ACC-03 | P3 | ACCEPTED NONBLOCKING under R-123 | No static guard binds future readiness writers to the transaction-shape invariant | Future maintenance; do not implement in this PR |
| F-CLAUDE-D051-03 / F-CLAUDE-PR4ACC-04 | P3 | ACCEPTED NONBLOCKING OUT-OF-SCOPE TOOLING DEBT | F-F03 index-overlap harness load sensitivity (PR 1 / PR 3 tooling). Do **not** reopen R-124. No PR 4 runtime correction. | PR 1 / PR 3 tooling maintenance |
| F-CLAUDE-PR4ACC-01 | P3 | REQUIRED MERGE-HYGIENE ACTION | Stale PR #20 description. Do not create a runtime correction cycle. The PR body must be current before merge. | Refresh PR body before merge |
| F-CLAUDE-PR4ACC-02 | P3 | ACCEPTED NONBLOCKING FUTURE MAINTENANCE | `2025-10` inbound adapter will outlive its Shopify supported window. Do **not** remove it in this PR. Record removal/re-evaluation no later than that retirement window. | Re-evaluate by the `2025-10` Shopify retirement window |

## Closed for PR 4 repository implementation (not residuals)

R-031, R-032, R-033, R-039, R-099 through R-121, R-125, R-126.

R-127 **CLOSED — no regression**. R-128 **CLOSED — no regression**. R-124 remains **CLOSED** and is **not** reopened.

Q-003 and F-PR4-18 are **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION**. Closure does **not** imply production deployment approval, Partner Dashboard validation, production API-health validation, or production-write authorization.

## Explicitly still open production / release gates

- **R-028** — operational tenant backfill
- **R-029** — unresolved ownership quarantine / enforcement-transition
- **R-095 through R-098** — accepted PR 3 rehearsal / rollout-evidence residuals
- **Q-002** — Partner Dashboard / environment-separation evidence
- **Q-008** — legal privacy-policy review
- All other production/release gates not actually satisfied

Disposable-environment evidence does **not** close production operational gates.

## Explicit non-authorization

- None of these residuals authorizes application, test, schema, executable migration SQL, CI, package, Shopify configuration, or feature-flag edits in this documentation-only synchronization.
- None reopens PR 4 repository-implementation acceptance (D-052).
- None authorizes merge, marking PR #20 ready, starting PR 5, production activation, production backfill, ownership repair, deployment, or inventory writes.
- Inventory-write flags remain **DEFAULT OFF**.
- No static readiness-writer guard, F-F03 harness repair, or API adapter retirement is implemented here.
