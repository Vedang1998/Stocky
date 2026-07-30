# Project Status

**Updated:** 2026-07-30
**Current stage:** Phase 1 planning corrections awaiting re-review
**Current main SHA:** `8e4f757c4717baba0ece74135b062324ff429ee6`
**Phase 0 status:** CLOSED
**Phase 0 closure merge:** `8e4f757c4717baba0ece74135b062324ff429ee6` (`Close Phase 0 correction gate and record final review (#8)`)
**Phase 1 status:** PLANNING ONLY — IMPLEMENTATION NOT STARTED
**Initial planning review:** `NOT READY` (preserved in `phases/phase-1/PLANNING_REVIEW_REPORT.md` for reviewed head `eae8cfdf215e78226f35ba9a2046bddd93590c2c`)
**Planning corrections:** applied on `docs/phase-1-planning`, awaiting independent Claude re-review
**Active branch:** `docs/phase-1-planning`
**Active PR:** [#9](https://github.com/Vedang1998/Stocky/pull/9) — open and draft; verify live head and CI on GitHub; do not treat a branch-tip SHA in this file as immutable evidence
**Brief:** `DRAFT — IMPLEMENTATION NOT AUTHORIZED`
**F-016 / R-022:** mandatory Phase 1 P1 database-isolation gate — not implemented
**Production inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF

## Current truth

- Phase 0 remains **CLOSED** on `main` at squash/merge evidence `8e4f757c4717baba0ece74135b062324ff429ee6`.
- Phase 1 remains **PLANNING ONLY — IMPLEMENTATION NOT STARTED**. No Phase 1 implementation branch exists.
- Claude’s initial planning review of head `eae8cfdf215e78226f35ba9a2046bddd93590c2c` returned **`NOT READY`**.
- Documentation-only planning corrections C-1 through C-11 have been applied; they do **not** authorize implementation.
- The Phase 1 brief remains **`DRAFT — IMPLEMENTATION NOT AUTHORIZED`**.
- **F-016 / R-022** remains a mandatory Phase 1 **P1** database-isolation gate. Application-layer shop filters alone are insufficient.
- No production inventory writes are approved.
- All inventory-write flags remain default **OFF** in application defaults and CI.
- Branch protection / no-bypass evidence is preserved in `RISK_REGISTER.md` → **R-015** (API-verified ruleset `Protect main` id `20012314`, including empty `bypass_actors`).

## Phase 0 closure evidence (immutable)

| Field | Value |
|---|---|
| Closure merge | `8e4f757c4717baba0ece74135b062324ff429ee6` |
| PR | [#8](https://github.com/Vedang1998/Stocky/pull/8) — merged |
| Prior correction-gate squash merge | `6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb` (PR [#7](https://github.com/Vedang1998/Stocky/pull/7)) |
| Claude final Phase 0 correction verdict | **`READY FOR PHASE 1 FOUNDATION`** |
| ChatGPT decision | Accepted final verdict; authorized Phase 0 closure |
| User authorization | Explicit merge authorization given |

## C-4 historical CI association (authenticated verification)

Verified by Cursor via authenticated GitHub API during the planning-correction task (not by Claude’s rate-limited review environment):

| Field | Value |
|---|---|
| Open PRs from `docs/phase-1-planning` | Exactly one: [#9](https://github.com/Vedang1998/Stocky/pull/9) |
| Title | Plan Phase 1 tenant-safe Shopify fact foundation |
| Draft / state at verification | draft, OPEN |
| Historical run | `30557753268` |
| Job | `90922508937` |
| Actual `head_sha` | `eae8cfdf215e78226f35ba9a2046bddd93590c2c` |
| Conclusion | success |
| Skipped required steps | none observed |

This verifies Claude finding P2-04 / C-4 for the **previous** reviewed head only. Corrected-head CI must be verified separately against the new run’s actual `head_sha`.

## Important deferred work

- Compliance webhooks currently authenticate and acknowledge only; they do not yet perform data export or redaction (Phase 1 brief scope after approval).
- `subscriptionActive` is not a complete entitlement system (billing/entitlements remain out of Phase 1 implementation scope).
- Adjustment and cost-sync flags are placeholders; no implemented write paths currently use them.
- Forecast and ABC parity remain future work (not Phase 1).
- Inventory-write idempotency, audit, reconciliation, and reversal are not complete.
- Partner distribution remains unconfirmed (**Q-002** evidence still required).
- npm audit advisories remain for a separate remediation decision.
- F-012–F-015, F-017: future maintenance / risk (not Phase 0 blockers).
- **F-016 / R-022 (P1):** mandatory Phase 1 database-enforced tenant isolation gate — planned in draft brief; not implemented.
- **R-014 (P1)** for Phase 1 monetary facts — proposed; not implemented.

## Next action

1. Claude independently re-reviews the exact corrected head of PR #9 and its associated CI (`head_sha` must match the workflow run).
2. ChatGPT decides whether the Phase 1 brief may be approved.
3. PR #9 must remain draft and unmerged until successful re-review and ChatGPT approval.
4. After brief approval, independent review, and merge of the planning PR into `main`, Cursor may start the first separately approved Phase 1 implementation PR from updated `main`.
5. Production inventory writes remain unapproved.
6. All inventory-write flags remain default OFF.

## Where to look

- Phase workflow: `phases/README.md`
- Phase 0 record: `phases/phase-0/`
- Phase 1 record: `phases/phase-1/`
- Permanent product rules: `product/`
- Permanent agent instructions: `agents/`
- Historical Phase 1 planning proposal: `PHASE_1_TECHNICAL_PLAN.md` (not implementation authority)
- Branch protection evidence: `RISK_REGISTER.md` → R-015
- Risks: `RISK_REGISTER.md`
- Decisions: `DECISIONS.md`
- Open questions: `OPEN_QUESTIONS.md`
