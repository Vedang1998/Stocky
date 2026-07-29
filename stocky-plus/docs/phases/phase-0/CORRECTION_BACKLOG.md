# Phase 0 Correction Backlog

**Status:** IMPLEMENTED IN `phase-0/correction-gate` (pending Claude verification)  
**Purpose:** Required corrections after Claude's independent review and before Phase 1 foundation begins.

## Documentation corrections in this tracking PR

| ID | Correction | Status |
|---|---|---|
| C-001 | Correct lockfile and nested-Git claims in `CURRENT_COMMAND_BASELINE.md` | Addressed in docs tracking PR |
| C-002 | Clarify adjustment and cost-sync flags are placeholders with no implemented write path | Addressed in docs tracking PR |
| C-003 | Update `PROJECT_STATUS.md` to show Phase 0 accepted, compliance acknowledge-only, and entitlement gaps | Addressed in docs tracking PR |

## Engineering corrections requiring Cursor

| ID | Priority | Correction | Exit evidence | Status |
|---|---|---|---|---|
| C-004 | P2 | Select npm as package manager, commit `package-lock.json`, and remove `package-lock.json` from `.gitignore` | Clean `npm ci` from committed lockfile (exit 0) | **DONE** — see `CORRECTION_IMPLEMENTATION_REPORT.md` |
| C-005 | P1 | Fix `inventoryLevel` and transfer GraphQL operations against Admin API `2025-10` | `npm run graphql-codegen` passes (exit 0); invalid `inventoryTransferComplete` removed | **DONE** |
| C-006 | P2 | Replace the billing message claiming all premium features are unlocked | Factual subscription copy only | **DONE** |
| C-007 | P2 | Add CI for install, lint, typecheck, tests, Prisma validate, build, and GraphQL validation | `.github/workflows/ci.yml` added | **DONE** |
| C-008 | P2 | Add initial cross-shop denial tests for high-risk actions | `cross-shop-denial.test.ts` (7 cases); suite 38 passing | **DONE** |

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

Phase 1 may begin only after C-004 through C-008 are implemented, reviewed, and recorded as complete, unless ChatGPT records an explicit product-owner decision changing that gate.

**Current:** Implementation complete on `phase-0/correction-gate`. Claude verification still required before Phase 1 brief authorization.
