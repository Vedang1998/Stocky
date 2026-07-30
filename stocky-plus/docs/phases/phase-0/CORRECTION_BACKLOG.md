# Phase 0 Correction Backlog

**Status:** CLOSED  
**Purpose:** Required corrections after Claude's independent reviews and before Phase 1 foundation begins.

## Gate closure summary

| Field | Value |
|---|---|
| Final Claude verdict | **`READY FOR PHASE 1 FOUNDATION`** |
| PR #7 | **Merged** (squash) |
| PR #7 merge SHA | `6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb` |
| Reviewed PR #7 head | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |
| PR #7 CI | run `30489949665` / job `90705038375` / **success** |
| F-010 | **RESOLVED** and independently verified |
| F-011 | **RESOLVED** and independently verified |
| Phase 0 correction gate | **CLOSED** after the documentation-only closure PR merges |

## Documentation corrections in the original tracking PR

| ID | Correction | Status |
|---|---|---|
| C-001 | Correct lockfile and nested-Git claims in `CURRENT_COMMAND_BASELINE.md` | Addressed in docs tracking PR |
| C-002 | Clarify adjustment and cost-sync flags are placeholders with no implemented write path | Addressed in docs tracking PR |
| C-003 | Update `PROJECT_STATUS.md` to show Phase 0 accepted, compliance acknowledge-only, and entitlement gaps | Addressed in docs tracking PR |

## Engineering corrections (C-004–C-008) — PR #6 history

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| C-004 | P2 | Select npm as package manager, commit `package-lock.json`, and remove `package-lock.json` from `.gitignore` | Clean `npm ci` from committed lockfile (exit 0) | **SUPERSEDED** — PR #6 Linux CI failed; see F-001 follow-up |
| C-005 | P1 | Fix `inventoryLevel` and transfer GraphQL operations against Admin API `2025-10` | `npm run graphql-codegen` passes (exit 0); invalid `inventoryTransferComplete` removed | Done on main via PR #6; transfer receive still needed F-004 follow-up |
| C-006 | P2 | Replace the billing message claiming all premium features are unlocked | Factual subscription copy only | Done on main via PR #6 |
| C-007 | P2 | Add CI for install, lint, typecheck, tests, Prisma validate, build, and GraphQL validation | `.github/workflows/ci.yml` added | Resolved on follow-up (green Actions) |
| C-008 | P2 | Add initial cross-shop denial tests for high-risk actions | `cross-shop-denial.test.ts` | Substantively resolved; F-011 adds standalone PO parent |

## Claude BLOCKED findings (PR #6) — resolved on PR #7

Stored in `CORRECTION_REVIEW_REPORT.md`. Implementation evidence: `CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`.

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| F-001 | P0 | Repair lockfile: add missing `@emnapi/*` entries (minimal diff) | Linux-compatible `npm ci` exit 0; exactly 3 added lock entries | **RESOLVED** |
| F-006 | P1 | Pin npm via `packageManager` + CI install of the same version | CI and local use identical Node/npm | **RESOLVED** |
| F-004 | P0 | Transfer receive must reject before local receipt mutation | Tests prove no local RECEIVED / receivedQty / receivedAt | **RESOLVED** |
| F-005 | P1 | Add stocktake parent, transfer parent, and Buying Table mapping denial tests | Record-level denial cases counted separately from flag checks | **RESOLVED** (with F-011 refinement) |

## Claude NOT READY findings (PR #7) — resolved and independently verified

Stored in `CORRECTION_FOLLOWUP_REVIEW_REPORT.md`. Final verification: `CORRECTION_FINAL_REVIEW_REPORT.md`.

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| F-010 | P2 | Stop hardcoding live PR tip / CI into docs (self-invalidating SHA chase) | Stable historical vs verify-on-GitHub wording | **RESOLVED** and independently verified |
| F-011 | P2 | Standalone PO-parent denial test + accurate classification | 9 record-level + 1 client-authority + 1 flag; suite **46** | **RESOLVED** and independently verified |

## Deferred / non-blocking (not Phase 0 closure blockers)

| ID | Priority | Correction | Disposition |
|---|---|---|---|
| F-012 | P3 | Exact npm engine pin usability | Future maintenance |
| F-013 | P3 | GitHub Action major-version maintenance | Future maintenance |
| F-014 | P3 | `shamefully-hoist` cleanup | Future maintenance |
| F-015 | P3 | Transfer sentinel TODO | Future maintenance |
| F-016 | **P1** | Database-enforced tenancy | Deferred to Phase 1 — **mandatory Phase 1 foundation gate**; see `OPEN_QUESTIONS.md` Q-011 / `RISK_REGISTER.md` R-022. Not implemented. |
| F-017 | P3 | Stale PO child-test title | Deferred test-hygiene cleanup |
| F-018 | P3 | F-016 severity inconsistency (backlog P2 vs risk P1) | **Resolved in this closure PR** by consistently recording F-016 / R-022 as **P1** |

F-016 priority is **P1** because the live risk register already treats the absence of database-enforced tenant isolation as P1, and ChatGPT’s product-owner decision is that F-016 is a mandatory Phase 1 foundation gate.

## Required before any inventory-write flag is enabled

These are not required merely to start schema/foundation work, but they are mandatory before a real merchant's inventory can be changed:

- per-line idempotency and applied-result persistence;
- live-quantity reconciliation for stocktake completion;
- immutable inventory adjustment events;
- partial-failure and retry safety;
- reversal or recovery workflow;
- merchant-visible failure and reconciliation status;
- verified GraphQL operations;
- tests proving retries cannot double-adjust inventory.

## Completion rule

Phase 0 correction gate requirements were satisfied:

- PR #7 was green in GitHub Actions;
- Claude independently reviewed and returned **`READY FOR PHASE 1 FOUNDATION`**;
- ChatGPT accepted the verdict;
- the user explicitly authorized squash merge;
- PR #7 was merged;
- this documentation-only closure PR records formal closure.

Phase 1 still requires a separate ChatGPT-approved `PHASE_BRIEF.md` before implementation may start.

Inventory-write enablement has separate unresolved gates (see section above). Production inventory writes remain unapproved. All inventory-write flags remain default OFF.
