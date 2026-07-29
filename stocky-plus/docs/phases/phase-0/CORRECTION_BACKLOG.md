# Phase 0 Correction Backlog

**Status:** FOLLOW-UP IN PROGRESS on `phase-0/correction-gate-followup` (Claude blocked PR #6; gate not closed)  
**Purpose:** Required corrections after Claude's independent review and before Phase 1 foundation begins.

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
| C-007 | P2 | Add CI for install, lint, typecheck, tests, Prisma validate, build, and GraphQL validation | `.github/workflows/ci.yml` added | Done on main via PR #6; npm pin required (F-006) |
| C-008 | P2 | Add initial cross-shop denial tests for high-risk actions | `cross-shop-denial.test.ts` | Partial on PR #6; parent/mapping gaps remain (F-005) |

## Claude BLOCKED findings (follow-up — F-001 / F-004 / F-005 / F-006)

Stored in `CORRECTION_REVIEW_REPORT.md`. Implementation evidence: `CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`.

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| F-001 | P0 | Repair lockfile: add missing `@emnapi/core@2.0.0-alpha.3`, `@emnapi/runtime@2.0.0-alpha.3`, `@emnapi/wasi-threads@2.0.1` (minimal diff) | Linux-compatible `npm ci` exit 0; exactly 3 added lock entries | **IN PROGRESS** |
| F-006 | P1 | Pin npm via `packageManager` + CI install of the same version used for lockfile repair | CI and local use identical Node/npm | **IN PROGRESS** |
| F-004 | P0 | Transfer receive must reject before local receipt mutation when Shopify complete is unsupported (with or without `shopifyTransferId`) | Tests prove no local RECEIVED / receivedQty / receivedAt; clear unsupported error | **IN PROGRESS** |
| F-005 | P1 | Add stocktake parent, transfer parent, and Buying Table mapping cross-shop denial tests | Record-level denial cases counted separately from flag checks | **IN PROGRESS** |

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

Phase 1 may begin only after the correction gate is closed: follow-up PR green in GitHub Actions, Claude returns `READY FOR PHASE 1 FOUNDATION`, review stored, and ChatGPT authorizes merge and the Phase 1 brief — unless ChatGPT records an explicit product-owner decision changing that gate.

**Current:** Gate **blocked**. Follow-up in progress. Do not mark closed before independent re-review.
