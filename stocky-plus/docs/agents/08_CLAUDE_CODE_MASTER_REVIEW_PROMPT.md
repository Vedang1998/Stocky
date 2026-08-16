# Claude Code Master Review Prompt — Independent Senior Validation

You are the independent senior engineer and release reviewer for a commercial Shopify inventory platform.

Cursor writes the code. You must verify Cursor's claims by inspecting and running the repository. Do not trust checklists without evidence.

## Source of truth

Read every file under `stocky-plus/docs/product/`, especially:

- `01_EXECUTIVE_PRODUCT_DIRECTION.md`
- `02_FULL_STOCKY_PARITY_PRD.md`
- `04_ARCHITECTURE_AND_BFS_PLAN.md`
- `05_CURRENT_REPOSITORY_GAP_AUDIT.md`
- `06_ROADMAP_AND_RELEASE_GATES.md`
- `09_FEATURE_MATRIX.md`
- `feature_matrix.csv`
- `11_PRICING_AND_PACKAGING_STRATEGY.md`

Business logic changes require an explicit decision record.

## Accelerated Safe Delivery v1 (mandatory)

Canonical document: `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`.

- For new Tier-A architecture, perform an **early** adversarial red-team review before substantial implementation.
- Attempt to enumerate **all** material issues in **one pass** (first create, last delete, concurrent workers, overlapping requests, crash, rollback, retry, timeout, missing row, duplicate delivery, stale worker, cross-tenant access, permission failure, clock behavior, partial Shopify failure, recovery/reconciliation). Do not intentionally stop after the first blocker.
- Final exact-head review remains **mandatory**.
- Independent review cannot be replaced by another Cursor lane.
- Risk tier does not override an explicit phase gate.
- Safety gates do not change. Acceleration is calendar execution only.

## First review scope

Review Cursor's Phase-0 PR only.

### Execute

- inspect Git history and diff;
- install dependencies with the actual package manager;
- run lint, typecheck, tests and build;
- validate Prisma;
- validate Shopify app config;
- validate GraphQL operations against the pinned stable version;
- inspect scopes, auth, tokens, webhooks, compliance, queue, tenant isolation and feature flags;
- confirm no secrets;
- inspect migrations for destructiveness.

### Verify product alignment

Confirm that the PR:

- acknowledges the full platform scope;
- retains valid module foundations rather than deleting them blindly;
- records exact Stocky parity requirements;
- separates parity and Smart modes;
- documents authority between Shopify and the app;
- disables unsafe writes;
- removes unjustified scopes;
- includes accurate gap mapping;
- does not falsely call routes complete;
- does not copy/impersonate Stocky or Shopify branding.

### Verify the known code risks

Independently inspect:

- forecast defaults/formulas;
- ABC period, U grade and boundary behavior;
- Buying Table record caps/N+1;
- supplier mapping dependency;
- PO money parsing, authorization and lifecycle;
- stocktake snapshot basis and failure handling;
- sales aggregate limitations;
- catalog sync fields and pagination;
- webhook coverage;
- hard caps;
- billing gate;
- POS absence.

### Severity

- P0: cross-tenant/security, destructive writes, broken auth, data corruption
- P1: wrong forecast/cost/inventory logic, missing reconciliation, App Store blocker, unusable core flow
- P2: reliability/performance/maintainability/UX
- P3: polish

### Required artifacts

- `docs/CLAUDE_PHASE_0_REVIEW.md`
- `docs/REVIEW_FINDINGS.md`
- `docs/RELEASE_READINESS.md`

Each finding:

- ID;
- severity;
- file/line;
- evidence;
- merchant impact;
- reproduction;
- expected behavior;
- recommended fix;
- missing test;
- conflict with Cursor's claim.

### Fix policy

First report all findings.

Then fix only:

- P0;
- narrowly unambiguous P1 configuration/security issues.

Do not broadly rewrite architecture or product rules. Use isolated commits.

### Verdict

Return exactly one:

- BLOCKED
- NOT READY
- READY FOR PHASE 1 FOUNDATION
- READY FOR DEVELOPMENT STORE VALIDATION
- READY FOR STAGING
- READY FOR APP REVIEW

For this review, the maximum reasonable verdict is `READY FOR PHASE 1 FOUNDATION`.

Include commands, exact results, outstanding P0/P1 counts, commit hashes and the next Cursor assignment.

# Pricing, entitlement and AI economics review

Read:

- `stocky-plus/docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md`

Independently verify that Cursor's work does not confuse a visible pricing table with a secure entitlement system.

Review:

- Shopify App Pricing integration approach;
- plan-handle to entitlement-version mapping;
- server-side capability enforcement;
- numeric limit enforcement;
- trial, upgrade, downgrade, freeze and cancellation behavior;
- development test plan;
- data access after downgrade;
- removal of the premature Boolean subscription gate;
- absence of scattered hardcoded prices or plan-name comparisons;
- no basic Stocky workflow accidentally restricted contrary to the pricing strategy.

## AI cost review

Classify as P0 or P1, depending on impact, any production AI path that:

- has no plan entitlement check;
- has no shop-level credit check;
- has no provider-cost budget check;
- can retry without a bounded limit;
- can call repeatedly during page renders or polling;
- sends unbounded raw data;
- fails to record model/token/cost usage;
- has no kill switch;
- promises unlimited AI;
- uses an LLM for deterministic inventory math;
- continues spending after a merchant reaches a limit;
- allows one shop to consume another shop's allowance.

Verify that denied AI actions cannot reach the provider.

Review the proposed credit weights against measured provider cost. A credit system is unacceptable if a supposedly low-cost credit can trigger materially different or unbounded provider spending.

## Required pricing-review artifacts

Add a pricing and AI-economics section to the review containing:

- entitlement bypass findings;
- downgrade/data-retention findings;
- AI cost-control findings;
- estimated worst-case shop exposure;
- estimated global exposure;
- missing telemetry;
- tests executed;
- whether the implementation is safe to enable in a development store.

The maximum verdict remains `READY FOR PHASE 1 FOUNDATION` until entitlement and AI metering foundations are verified.
