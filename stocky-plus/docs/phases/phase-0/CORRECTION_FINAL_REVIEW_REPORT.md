# Phase 0 Correction Gate — Final Independent Claude Review

## Executive verdict

**READY FOR PHASE 1 FOUNDATION.**

F-010 and F-011 are both resolved. The delta since the previously reviewed head is narrow and contains exactly one runtime-free test addition plus governance records. CI is green on the exact expected head, verified by direct run/head association rather than by report claim. Test classification and totals are accurate against my own independent count. No P0 or P1 findings remain open. Two new P3 findings are recorded and do not block.

PR #7 is technically ready to merge. Do not merge yet — ChatGPT approval, owner branch-protection confirmation, and explicit user merge authorization remain outstanding.

## Review identity

| Field | Value |
|---|---|
| Reviewer | Claude, independent review |
| Review type | Narrow final re-check of F-010 and F-011 |
| Date | 2026-07-29 |
| Prior verdict re-checked | NOT READY at head `33aaac3…` |
| Checkout | Fresh anonymous clone to `/tmp/Stocky` |
| Operating system | Linux, Ubuntu 24 container |
| Code modified | None |
| Documentation modified | None |
| Commits pushed | None |
| PR opened, merged, or marked ready | None |
| Phase 1 started | No |

## Repository and exact head reviewed

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Base branch | `main` |
| Base SHA | `9844aec437cc4cdae5c678dc4a8c6c1aeec6befb` |
| Head branch | `phase-0/correction-gate-followup` |
| Actual head SHA reviewed | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |
| Head matches expected SHA | Yes — no SHA drift |
| Working-tree status | Clean |
| Commit count on PR | 6 |
| Changed files on PR | 15 |
| Delta files since prior reviewed head | 7 |

Delta `33aaac3...f9b12da`:

- Modified `stocky-plus/app/services/cross-shop-denial.test.ts`
- Modified `stocky-plus/docs/OPEN_QUESTIONS.md`
- Modified `stocky-plus/docs/PROJECT_STATUS.md`
- Modified `stocky-plus/docs/RISK_REGISTER.md`
- Modified `stocky-plus/docs/phases/phase-0/CORRECTION_BACKLOG.md`
- Modified `stocky-plus/docs/phases/phase-0/CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`
- Added `stocky-plus/docs/phases/phase-0/CORRECTION_FOLLOWUP_REVIEW_REPORT.md`

The only non-documentation file in the delta was the cross-shop denial test.

## PR and CI status

PR state read directly from the API:

| Field | Value |
|---|---|
| PR | #7 |
| State | Open |
| Draft | True |
| Merged | False |
| Head SHA | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |

CI association was verified by reading the workflow run’s own `head_sha`:

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30489949665` |
| Run head SHA | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |
| Event | pull_request |
| Run status | completed |
| Run conclusion | success |
| Job ID | `90705038375` |
| Job head SHA | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |
| Job conclusion | success |

All required steps concluded successfully:

- Set up job
- Initialize containers
- Checkout
- Setup Node.js
- Pin npm
- Verify Node and npm versions
- Install dependencies
- Generate Prisma client
- Validate Prisma schema
- Apply migrations to ephemeral PostgreSQL
- Lint
- Typecheck
- Unit tests
- Build
- GraphQL codegen and schema validation
- Cleanup steps

Workflow safety verification:

- `continue-on-error` was absent.
- Required steps had no conditional guards that could silently skip them.
- PostgreSQL was an ephemeral `postgres:16-alpine` service using `stocky_plus_ci`.
- Shopify credentials were test-only placeholders.
- All five inventory-write flags were set to false.
- `ALLOW_DEV_SUBSCRIPTION_ACTIVATE` was false.

## F-010 verdict

**RESOLVED.**

`stocky-plus/docs/PROJECT_STATUS.md` no longer presents a previous head or CI run as the live state.

The document separates:

### Live state

- Active PR #7
- Active branch `phase-0/correction-gate-followup`
- PR draft, open, and unmerged
- Current head and CI must be verified directly on GitHub
- Phase 1 not started
- Correction gate remains open
- Production inventory writes unapproved
- Inventory-write flags default OFF

### Immutable historical evidence

Historical reviewed values are under a dedicated heading and explicitly state they are not a claim that they remain the current PR head.

The recorded historical evidence was independently verified:

- reviewed head `33aaac32303b6757e1f9b4a3efd5a4f48874c95e`
- run `30485002939`
- conclusion success
- verdict NOT READY

Other changed Phase 0 documents use the same discipline. No document requires another commit solely to chase its own SHA.

## F-011 verdict

**RESOLVED.**

`stocky-plus/app/services/cross-shop-denial.test.ts` added the standalone test:

`denies Shop B cancelling Shop A purchase order`

It:

- invokes the real production route action;
- authenticates as Shop B through the server-side session;
- attempts to cancel Shop A’s PO;
- verifies the update query is scoped to Shop B;
- returns purchase order not found;
- prevents unscoped PO mutation;
- prevents child mutations;
- prevents Shopify mutations;
- contains no source-code-regex assertion;
- exercises real route behavior.

The client-authority test remains separate:

`rejects client-supplied Shop A as authority on PO cancel (session shop wins)`

It proves a client-supplied Shop A form value cannot override the authenticated Shop B session.

The feature-flag test also remains separate.

## Test classification

Independent count:

- `cross-shop-denial.test.ts`: 11 tests
  - 9 record-level denial tests
  - 1 client-authority control
  - 1 feature-flag control
- `characterization.test.ts`: 13 tests
- `forecasting.test.ts`: 16 tests
- `transfer-receive-guard.test.ts`: 4 tests
- `unsupported-transfer.test.ts`: 2 tests

Total:

**46 tests across 5 files**

All nine required standalone record-level areas are covered:

1. Purchase-order parent
2. Purchase-order child line
3. Stocktake parent
4. Stocktake child line
5. Transfer parent
6. Transfer child line
7. Supplier child or mapping
8. Buying Table supplier validation
9. Buying Table mapping validation

Documentation counts are accurate. No overstatement remains.

## Execution classification

| Check | Classification | Evidence |
|---|---|---|
| `git status --short` | Independently executed and passed | Clean tree |
| `npm ci` | Independently executed and passed with environment deviation | Required `--engine-strict=false` because sandbox npm differed |
| `npm run lint` | Independently executed and passed | Exit 0 |
| `npm test` | Environment blocked, partial | 15 tests passed; Prisma-dependent files could not collect |
| `npx prisma generate` | Environment blocked | Prisma binary download blocked |
| `npm run typecheck` | Environment blocked | Errors downstream of absent generated Prisma client |
| Prisma, tests, build, GraphQL codegen | GitHub Actions passed | Exact reviewed head |
| Branch protection | Not executed | Settings endpoint returned 403 |

The environment-blocked checks passed in CI on the exact reviewed head.

## Narrow regression check

The final delta did not:

- change runtime product behavior beyond the approved standalone test;
- change transfer logic;
- change the lockfile;
- change dependencies;
- change Node or npm pinning;
- add migrations;
- start Phase 1;
- change forecasting or ABC formulas;
- implement entitlements;
- change pricing;
- enable inventory writes;
- add unsupported Shopify mutations;
- change approved product documents;
- add secrets, credentials, merchant data, production data, or environment files.

All five inventory-write flags remained default OFF.

## Remaining findings

No P0 findings.

No P1 findings.

### F-017 — Stale test title on PO child-line denial

- **Severity:** P3
- **Related:** F-011
- **File:** `stocky-plus/app/services/cross-shop-denial.test.ts`
- **Evidence:** The child-line test title says it denies mutation of the purchase order and line, although it exercises the child `addLine` path. A separate parent test now exists.
- **Impact:** No merchant impact. Minor reviewer and counting ambiguity.
- **Expected:** Test titles identify one record level.
- **Required correction:** Rename during later test-hygiene maintenance.
- **Missing test:** None.
- **Conflicts with Cursor claim:** No.

### F-018 — F-016 severity inconsistent across governance records

- **Severity:** P3
- **Related:** F-016
- **Files:** `CORRECTION_BACKLOG.md` and `RISK_REGISTER.md`
- **Evidence:** The backlog records F-016 as P2 while the risk register records the same issue as P1.
- **Impact:** Governance inconsistency could allow a tenancy requirement to be incorrectly triaged.
- **Expected:** One consistent severity.
- **Required correction:** Reconcile when the Phase 1 brief is authored.
- **Missing test:** Not applicable.
- **Conflicts with Cursor claim:** No.

Neither finding blocks READY.

## Non-blocking carried-forward risks

### F-012 — npm engine pin usability

Open and not worsened.

Exact npm pinning can cause contributor friction, but CI pins correctly.

### F-013 — GitHub Actions major-version maintenance

Open and not worsened.

### F-014 — `shamefully-hoist` warning

Open and not worsened.

### F-015 — Transfer sentinel maintenance risk

Open and not worsened.

### F-016 — Database-enforced tenancy

Correctly deferred but mandatory for Phase 1.

F-016 must be included as a gating requirement in the Phase 1 brief. Application-layer shop filters are necessary but insufficient. Phase 1 must add database-enforced tenant isolation through approved composite shop constraints, tenant ownership, or another approved mechanism.

### F-007 — Live Shopify schema dependency

Open and not worsened.

### F-009 — npm audit advisories

Open and not worsened.

F-009 remains separate, non-blocking risk work.

Production inventory writes remain unapproved.

## Branch-protection owner action

**OWNER CONFIRMATION REQUIRED.**

The reviewer attempted to inspect branch protection and received HTTP 403.

Desired controls:

- pull request required before merge;
- required CI status check;
- draft PRs cannot merge.

The inability to inspect settings was not treated as a technical defect in PR #7.

## Phase 0 correction-gate status

**OPEN — not closed at the time of review.**

At review time, remaining steps were:

1. ChatGPT approves the report.
2. Owner confirms main branch protection.
3. User explicitly authorizes merge.
4. PR #7 is merged.
5. `PROJECT_STATUS.md` is updated post-merge.

## Phase 1 readiness

Phase 1 had not started and could not begin immediately.

A separate ChatGPT-approved `PHASE_BRIEF.md` is required.

The Phase 1 brief must include F-016 as a gating requirement.

The READY verdict describes the technical state of PR #7. It is not authorization to begin Phase 1.

## Inventory-write safety statement

All five inventory-write kill switches remained default OFF:

- `FEATURE_STOCKTAKE_INVENTORY_WRITES`
- `FEATURE_ADJUSTMENT_WRITES`
- `FEATURE_RECEIPT_WRITES`
- `FEATURE_COST_SYNC`
- `FEATURE_TRANSFER_WRITES`

`ALLOW_DEV_SUBSCRIPTION_ACTIVATE` remained false in CI.

Production inventory writes remain unapproved.

The inventory-write release gates for idempotency, audit, reconciliation, and reversal remain incomplete.

## Merge recommendation

PR #7 was technically ready to merge.

The reviewer did not merge, push, mark the PR ready, or modify files.

At review time, merge still required:

- ChatGPT approval;
- owner branch-protection confirmation;
- explicit user authorization.

## Final explicit answers

| Question | Answer |
|---|---|
| Exact PR head reviewed | `f9b12dac0c5e5b4844d6aaa8a79a638eb84f47cb` |
| CI green for exact head | Yes |
| F-010 resolved | Yes |
| F-011 resolved | Yes |
| Exactly 9 standalone record-level denial tests | Yes |
| Two control tests classified separately | Yes |
| Full suite 46 tests | Yes, in GitHub Actions |
| PR #7 technically ready to merge | Yes |
| Phase 0 gate already formally closed at review time | No |
| Phase 1 could begin immediately | No |
| Production inventory writes approved | No |
| All inventory-write flags OFF | Yes |
| Owner branch-protection confirmation required | Yes |
| Open P0 or P1 findings | No |

## Final verdict

# READY FOR PHASE 1 FOUNDATION
