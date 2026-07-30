# Phase 1 Planning Correction Implementation Report

**Status:** Documentation-only corrections applied; awaiting independent Claude re-review
**Product owner acceptance of findings:** ChatGPT accepts Claude’s three P1 findings and the relevant P2 findings
**Brief status after corrections:** `DRAFT — IMPLEMENTATION NOT AUTHORIZED`
**Implementation authorized:** No

## Previous review

| Field | Value |
|---|---|
| Previous reviewed head | `eae8cfdf215e78226f35ba9a2046bddd93590c2c` |
| Initial verdict | `NOT READY` |
| Preserved verbatim report | `PLANNING_REVIEW_REPORT.md` |
| Claude accepted corrections | **Not claimed** — re-review required |

## Correction mapping C-1 through C-11

| ID | Disposition | Exact changed document and section | Reason | Remaining implementation dependency |
|---|---|---|---|---|
| C-1 | Applied | `PHASE_BRIEF.md` — `### Lock-conscious constraint rollout`; PR 3 scope; Migration tests | P1-01 blocking DDL / ACCESS EXCLUSIVE risk | Implementation PR 3 must execute low-lock rollout with measured lock evidence |
| C-2 | Applied | `PHASE_BRIEF.md` — `#### Decimal-safe Phase 1 money facts`; PR 6 scope; Money precision tests; `RISK_REGISTER.md` R-014 raised to P1 for Phase 1 fact surface | P1-02 monetary facts must not inherit float money | Implementation PR 6 must use exact decimal types and pass money tests |
| C-3 | Applied | `PHASE_BRIEF.md` — Database enforcement + `### Tenant immutability`; Database isolation tests; `DECISIONS.md` D-014 | P1-03 shopId must be immutable | Implementation PR 3 must enforce DB-level immutability and name the mechanism |
| C-4 | Applied (authenticated verification recorded) | `PROJECT_STATUS.md` — C-4 historical CI association; this report | P2-04 Claude could not call GitHub API | Corrected-head CI must be re-verified against the new run’s `head_sha` |
| C-5 | Applied | `PHASE_BRIEF.md` — Database isolation tests for web, workers, jobs, exports, privacy, reconciliation, replay/repair, scheduled sync, concurrent shops | P2-05 non-request isolation gaps | Implementation must add and pass each distinct path’s isolation suite |
| C-6 | Applied | `PHASE_BRIEF.md` — `### Tenant authority derivation`; PR 2 / PR 4; Database isolation client/job tests; `DECISIONS.md` D-017 | P2-06 client/unvalidated envelope authority | Implementation PR 2–4 must deny client authority and validate envelopes |
| C-7 | Applied | `PHASE_BRIEF.md` — Synchronization tests (duplicate after queue-retention expiry; durable retention; distinct-event; auditable replay) | P2-07 durable idempotency proof | Implementation PR 4+ must pass durable duplicate tests |
| C-8 | Applied | `PHASE_BRIEF.md` — `### Ownership quarantine resolution`; PR 1 quarantine report; PR 3 entry gate; `RISK_REGISTER.md` R-029 | P2-08 non-empty quarantine path | Implementation PR 1 must produce quarantine reports; PR 3 blocked until zero unresolved |
| C-9 | Applied | `PROJECT_STATUS.md` — R-015 cross-reference | P3-09 live dashboard pointer | None for planning; keep R-015 as evidence home |
| C-10 | Applied via product-owner resolution | `PHASE_BRIEF.md` — `### Exit verdict definition — READY FOR PHASE 2 PLANNING` | P3-10 undefined exit verdict string | Reusable `docs/agents/` wording may be evaluated later; not required to approve this planning brief; **no agent-instruction change in this PR** |
| C-11 | Applied | `PHASE_BRIEF.md` — PR 2 inventory + automated no-unconverted-access check requirements | P3-11 PR 2 reviewability | Implementation PR 2 must ship mechanical inventory and CI-enforced check |

### Confirmation

* C-1 through C-9 and C-11 were applied to planning documents.
* C-4 historical association for head `eae8cfdf…` / run `30557753268` was verified by Cursor via authenticated GitHub API and recorded in `PROJECT_STATUS.md` (attribution: Cursor, not Claude).
* C-10 product-owner resolution: no change under `stocky-plus/docs/agents/`; exit verdict defined in the Phase 1 brief; reusable permanent-agent wording deferred until the exit-review process is designed.

## Exact changed files (this correction)

* `stocky-plus/docs/phases/phase-1/PLANNING_REVIEW_REPORT.md` (created; Claude report preserved verbatim)
* `stocky-plus/docs/phases/phase-1/PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md` (created)
* `stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md` (updated; remains `DRAFT — IMPLEMENTATION NOT AUTHORIZED`)
* `stocky-plus/docs/phases/phase-1/README.md` (updated)
* `stocky-plus/docs/PROJECT_STATUS.md` (updated)
* `stocky-plus/docs/DECISIONS.md` (D-014, D-017 expanded; still **PROPOSED**)
* `stocky-plus/docs/OPEN_QUESTIONS.md` (Q-011 proposed decision expanded; still open / not implemented)
* `stocky-plus/docs/RISK_REGISTER.md` (R-014 → P1 for Phase 1 fact surface; R-029 expanded; R-036–R-039 added; R-022 remains P1)

## Non-change confirmations

* No runtime implementation occurred.
* No Prisma schema or migration changed.
* No test, package, lockfile, Shopify configuration, GraphQL operation, CI workflow, feature-flag, approved product-document, or permanent agent-instruction file changed.
* Production inventory writes remain **UNAPPROVED**.
* All inventory-write flags remain **DEFAULT OFF**.
* No Phase 1 implementation branch was created.
* The brief remains draft; implementation remains unauthorized.
* Claude has **not** accepted these corrections; re-review is required.

## Commit and CI evidence

| Field | Value |
|---|---|
| Previous reviewed head | `eae8cfdf215e78226f35ba9a2046bddd93590c2c` |
| Correction commit / new PR head | _filled after commit; verify live on GitHub PR #9_ |
| New CI run ID | _recorded in PR #9 description after CI completes_ |
| New CI job ID | _recorded in PR #9 description after CI completes_ |
| Workflow run actual `head_sha` | _recorded in PR #9 description after CI completes_ |
| CI conclusion | _recorded in PR #9 description after CI completes_ |

Authoritative corrected-head CI association is recorded in the PR #9 description after CI completes, without a self-referential documentation commit that only chases that commit’s own SHA.

## Unresolved evidence

* Claude re-review of the corrected head has not occurred.
* ChatGPT has not approved the Phase 1 brief.
* Q-002 Partner Dashboard evidence still required.
* Q-008 legal review still required before production privacy policy.
* Q-011 / F-016 / R-022 remain open implementation gates.
* R-014 Phase 1 money rules are proposed, not implemented.
* No production migration or deployment is authorized.

## Exact next action

Independent Claude re-review of the corrected head and its CI association (`head_sha` must match the workflow run), then ChatGPT decides whether the brief may be approved.
