# Cursor Master Prompt — Align and Build the Full Shopify Inventory Platform

You are the implementation engineer for a public Shopify App Store product intended to deliver complete documented Stocky functional parity plus carefully governed improvements.

Do not treat the current repository as finished merely because pages exist. Do not delete useful foundations blindly.

## Source of truth

Read these documents before code changes:

- `stocky-plus/docs/product/01_EXECUTIVE_PRODUCT_DIRECTION.md`
- `stocky-plus/docs/product/02_FULL_STOCKY_PARITY_PRD.md`
- `stocky-plus/docs/product/03_COMMUNITY_PAIN_POINTS_AND_OPPORTUNITIES.md`
- `stocky-plus/docs/product/04_ARCHITECTURE_AND_BFS_PLAN.md`
- `stocky-plus/docs/product/05_CURRENT_REPOSITORY_GAP_AUDIT.md`
- `stocky-plus/docs/product/06_ROADMAP_AND_RELEASE_GATES.md`
- `stocky-plus/docs/product/09_FEATURE_MATRIX.md`
- `stocky-plus/docs/product/feature_matrix.csv`
- `stocky-plus/docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md`
- `stocky-plus/docs/DECISIONS.md`
- `stocky-plus/docs/PROJECT_STATUS.md`

When code conflicts with approved requirements, the requirements win unless a technical impossibility is documented and approved.

## Product correction

The application is a full inventory management platform, not only a replenishment report.

Retain and refactor the existing supplier, PO, receiving, landed-cost, stocktake, transfer, labels, BOM, analytics and worker foundations.

However:

- Stocky parity logic must be exact and separately testable.
- Smart forecasting must be optional and separately labeled.
- Do not force MOQ, pack rounding, safety stock or lead time into the simple Last X parity forecast.
- No module is complete merely because it has a route and form.
- Do not copy Stocky branding or impersonate Shopify.
- Do not enable unsafe live inventory writes.

## First assignment: Phase 0 only

### 1. Audit

Inspect repository, Git history, app linkage/configs, scopes, API version, routes, schema, migrations, jobs, webhooks, GraphQL, tests, CI, deployments and secrets handling.

Run actual repository commands:

- dependency install;
- lint;
- typecheck;
- unit tests;
- build;
- Prisma validate;
- Shopify app config validate;
- GraphQL validation/code generation where configured.

Record exact results. Do not claim skipped checks passed.

### 2. Verify the product documents and create operating records

The approved product documents are already in `stocky-plus/docs/product/`. Do not duplicate or relocate them. Read and verify them, then create:

- `DECISIONS.md`
- `PROJECT_STATUS.md`
- `OPEN_QUESTIONS.md`
- `RISK_REGISTER.md`
- `CURRENT_COMMAND_BASELINE.md`
- `CURRENT_ROUTE_AND_FEATURE_INVENTORY.md`
- `DATA_AUTHORITY_MAP.md`

### 3. Produce a code-to-requirement gap map

For every existing route/service/model:

- purpose;
- related feature IDs;
- keep/refactor/remove/defer;
- data authority;
- permissions/scopes;
- test status;
- P0/P1 risks;
- next owner.

### 4. Correct immediate configuration risks only

Do not perform a broad rewrite yet.

- confirm public-distribution app strategy;
- confirm dev versus production app records;
- remove scopes with no approved feature need, especially merchant-managed fulfillment scopes;
- update the selected stable API version only after validating all operations;
- ensure expiring offline token support from the official template;
- add missing mandatory compliance webhook configuration as appropriate;
- do not deploy to production.

### 5. Freeze unsafe features

Add feature flags/kill switches for:

- stocktake inventory writes;
- adjustment writes;
- receipt writes;
- cost sync;
- transfer writes.

Default disabled outside explicit development testing until their release gates pass.

### 6. Characterization tests

Before rewriting, add tests that capture current forecast, ABC, PO and stocktake behavior. These tests are evidence, not endorsement. Mark tests that intentionally describe wrong behavior.

### 7. Phase-1 technical plan

Provide additive migration plan for:

- Shop and location ownership;
- full product/variant cache;
- order/order-line facts;
- inventory facts/events;
- sync runs/jobs;
- audit;
- roles;
- saved views;
- receipt/cost foundations.

Do not apply destructive production migrations.

## Required findings to verify

- current default forecast is 30/14 with lead time/safety stock and OOS exclusion;
- current ABC is 90 days and has boundary/U issues;
- current Buying Table caps records and performs N+1 work;
- current product sync lacks required fields;
- current stocktake can complete despite failed writes;
- current schema lacks detailed sales/receipt/audit facts;
- current subscription gate is premature;
- current public name/branding needs review.

Do not assume these findings are correct—verify and cite files/lines.

## Engineering rules

- TypeScript strict;
- Decimal money;
- IDs as strings;
- UTC storage and merchant timezone boundaries;
- authenticated tenant derivation;
- server authorization;
- idempotency;
- immutable operational events;
- no unnecessary customer PII;
- validated current GraphQL;
- no REST for new work;
- no N+1 Shopify calls;
- no hard row limits without pagination;
- migrations and rollback plan;
- focused commits and PRs.

## Required final report

1. Repository and app configuration state
2. Distribution status/risk
3. Command results
4. Scope/API/webhook findings
5. Route/model/service gap map
6. Files changed
7. Tests added
8. Unsafe features disabled
9. Additive migration plan
10. P0 blockers
11. Decisions needing product approval
12. Commit hashes
13. Exact Phase-1 next step

Stop after Phase 0 and open a PR. Do not begin feature expansion in the same pass.

# Pricing, entitlements and AI cost-control requirements

Before changing billing or feature gates, read:

- `stocky-plus/docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md`

Treat it as approved architecture. Dollar prices and numerical limits are hypotheses, but the packaging principles and AI margin controls are requirements.

## Phase-0 pricing audit

Inspect the current billing route, subscription flags and any feature gating.

Document:

- current plans and prices;
- current use of Shopify billing;
- hardcoded subscription checks;
- routes or workers gated only in the UI;
- downgrade behavior;
- trial behavior;
- entitlement gaps;
- whether current billing uses the recommended Shopify App Pricing path;
- any claim of unlimited or “AI-driven” functionality;
- whether AI usage and provider costs are currently measured.

The current `subscriptionActive` Boolean and development activation bypass are not a sufficient commercial entitlement architecture.

## Entitlement architecture plan

Design—but do not fully implement beyond the authorized phase—a centralized server-side entitlement service containing:

- stable capability keys;
- plan versions;
- numeric limits;
- current usage;
- AI allowance;
- support and retention metadata;
- upgrade/downgrade transitions;
- trial and development test-plan handling.

No route, worker or component should hardcode dollar prices or compare raw plan-name strings.

Feature hiding is not authorization. All protected actions require server-side checks.

## AI usage ledger and budget authorization

Before any production AI feature can be called, the architecture must support:

- shop and plan;
- AI feature/action;
- provider/model;
- prompt version;
- input/cached/output/reasoning token usage;
- calculated provider cost;
- internal credit weight;
- monthly shop usage;
- monthly shop cost;
- global cost;
- success/failure and fallback;
- model and feature kill switches.

Every AI request requires a pre-call authorization check against:

1. plan entitlement;
2. remaining AI credits;
3. internal monthly provider-cost budget;
4. per-action maximum cost;
5. global spending limit.

Do not implement unlimited AI. Do not put an LLM inside deterministic forecast, ABC, cost or inventory calculations.

## Launch billing constraint

Initial launch uses fixed recurring monthly/yearly plans and included AI allowances. Do not implement automatic AI overage billing in the first release.

Keep Shopify App Pricing integration behind a clean adapter so plan handles and subscription events map to internal entitlement versions.

## Required tests

Add plan/entitlement tests for:

- route and action authorization;
- worker authorization;
- trial;
- upgrade;
- downgrade;
- cancellation/freeze;
- over-limit locations/variants;
- AI credit exhaustion;
- AI internal cost-budget exhaustion;
- global AI kill switch;
- no AI provider call after denial;
- deterministic fallback;
- cross-shop isolation;
- development test plan;
- prices absent from application business logic.

Include pricing and AI cost controls in the Phase-0 gap analysis and Phase-1 technical plan.
