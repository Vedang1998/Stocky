# Phase 0 Correction Backlog

**Status:** FOLLOW-UP FINAL CORRECTIONS (F-010 / F-011) on `phase-0/correction-gate-followup` — gate not closed  
**Purpose:** Required corrections after Claude's independent reviews and before Phase 1 foundation begins.

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

## Claude BLOCKED findings (PR #6) — follow-up resolved on PR #7

Stored in `CORRECTION_REVIEW_REPORT.md`. Implementation evidence: `CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`.

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| F-001 | P0 | Repair lockfile: add missing `@emnapi/*` entries (minimal diff) | Linux-compatible `npm ci` exit 0; exactly 3 added lock entries | **RESOLVED** (Claude second review) |
| F-006 | P1 | Pin npm via `packageManager` + CI install of the same version | CI and local use identical Node/npm | **RESOLVED** |
| F-004 | P0 | Transfer receive must reject before local receipt mutation | Tests prove no local RECEIVED / receivedQty / receivedAt | **RESOLVED** |
| F-005 | P1 | Add stocktake parent, transfer parent, and Buying Table mapping denial tests | Record-level denial cases counted separately from flag checks | **SUBSTANTIVELY RESOLVED**; F-011 refines PO parent |

## Claude NOT READY findings (PR #7 second review)

Stored in `CORRECTION_FOLLOWUP_REVIEW_REPORT.md`. Reviewed head: `33aaac32303b6757e1f9b4a3efd5a4f48874c95e`.

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| F-010 | P2 | Stop hardcoding live PR tip / CI into docs (self-invalidating SHA chase) | Stable historical vs verify-on-GitHub wording in `PROJECT_STATUS.md` | **DONE** (this correction) |
| F-011 | P2 | Standalone PO-parent denial test + accurate classification | 9 record-level + 1 client-authority + 1 flag; suite **46** | **DONE** (this correction) |
| F-012 | P3 | Exact npm engine pin usability | Future maintenance | Deferred |
| F-013 | P3 | GitHub Action major-version maintenance | Future maintenance | Deferred |
| F-014 | P3 | `shamefully-hoist` cleanup | Future maintenance | Deferred |
| F-015 | P3 | Transfer sentinel TODO | Future maintenance | Deferred |
| F-016 | P2 | Database-enforced tenancy | Phase 1 brief requirement | Deferred to Phase 1 — see `OPEN_QUESTIONS.md` Q-011 / `RISK_REGISTER.md` R-022 |

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

Phase 1 may begin only after the correction gate is closed: follow-up PR green in GitHub Actions, Claude returns READY, review stored, and ChatGPT authorizes merge and the Phase 1 brief — unless ChatGPT records an explicit product-owner decision changing that gate.

**Current:** Gate **open**. Claude second review **`NOT READY`** (F-010 / F-011). Do not mark closed before final Claude re-check and ChatGPT approval.
