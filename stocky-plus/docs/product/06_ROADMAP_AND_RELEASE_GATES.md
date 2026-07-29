# Delivery Roadmap and Definition of Done

## Phase 0 — Product and repository reset

**Outcome:** one verified source of truth before more feature coding.

- freeze direct work on `main`;
- create product-alignment branch;
- add PRD, architecture, authority map, formulas and feature matrix;
- run full repository audit and command baseline;
- verify public distribution strategy and app linkage;
- define app name and remove public `Stocky++` branding;
- remove irrelevant scopes;
- create architecture decision records;
- create risk register.

**Exit:** Claude Code accepts repository state as safe for foundation work.

## Phase 1 — Platform, tenancy and facts

- Shop/location/catalog schema;
- order and line facts;
- inventory states/snapshots/events;
- sync runs/jobs/dead letters;
- audit;
- roles;
- privacy/compliance;
- current GraphQL operations;
- initial and webhook sync;
- data health;
- performance instrumentation.

**Exit:** facts reconcile to Shopify and cross-tenant tests pass.

## Phase 2 — Stocky planning parity

- vendor zero-setup;
- suppliers and price lists;
- all six parity forecast methods;
- exact ABC/U;
- low stock variant/product/vendor;
- dense replenishment worksheet;
- row detail and overrides;
- saved views;
- explanation traces;
- reconciliation to Stocky exports.

**Exit:** representative merchant variants reconcile or differences are documented.

## Phase 3 — Purchase orders

- full PO ledger and statuses;
- header/line fields;
- configurable grid;
- documents/email;
- discounts/tax/charges;
- approvals;
- expected/due reports;
- imports/exports;
- supplier communication;
- no inventory writes yet except controlled test environment.

**Exit:** merchant can create, approve, send and track POs with full audit.

## Phase 4 — Receiving, costs, labels and POS

- receipt event ledger;
- partial/reject/extra/backorder;
- reversal/unreceive;
- inventory write safety;
- landed and average cost;
- explicit Shopify cost sync;
- Admin and POS receiving;
- scanning/camera;
- labels;
- reconciliation and failure recovery.

**Exit:** end-to-end PO receipt passes destructive-workflow review.

## Phase 5 — Inventory control

- adjustments;
- manual/barcode/POS stocktakes;
- count scopes and movement conflicts;
- safer zero workflows;
- stocktake history;
- native transfer integration/mirroring;
- transfer receiving and recommendations.

**Exit:** live pilot count and transfer reconciliations pass.

## Phase 6 — Reports, automation and commercial readiness

- full Stocky report suite;
- supplier and operational reports;
- Flow triggers/actions;
- alerts;
- billing;
- migration toolkit;
- support diagnostics;
- docs/privacy/terms;
- staging/production operations;
- listing assets;
- App Store review submission.

## Phase 7 — Smart forecasting and AI

- forecast backtesting;
- seasonal/trend/intermittent models;
- model selection;
- anomalies;
- lead-time prediction;
- PO optimization;
- cost/receipt/count assistants;
- governed natural-language analytics.

AI is not a launch blocker for Stocky parity.

## Phase 8 — Built for Shopify

The app can pursue the badge only after current merchant-utility thresholds and performance data exist.

- 50 net active paid-shop installs;
- five reviews;
- rating threshold;
- 28-day Web Vitals volume;
- BFS audit;
- fix findings;
- apply.

## Release gates

### Inventory write gate

No write capability is enabled until:

- idempotency;
- audit;
- permission;
- partial failure;
- reconciliation;
- rollback/reversal policy;
- staging tests;
- kill switch.

### Financial report gate

No profit/COGS claim until:

- cost completeness measured;
- refund/discount definitions tested;
- historical approximation labeled;
- values reconcile to test fixtures.

### AI gate

No “smart” recommendation until:

- baseline comparison;
- backtest;
- confidence;
- explanation;
- human control;
- outcome logging.

## Agent operating model

### ChatGPT — product/R&D authority

- requirements;
- research;
- business logic;
- UX;
- scope and decisions;
- acceptance criteria.

### Cursor — implementation

- code;
- migrations;
- tests;
- docs;
- deployment;
- PRs.

### Claude Code — independent senior reviewer

- run commands;
- validate claims;
- inspect security/data integrity;
- review Shopify compliance;
- reproduce defects;
- approve release gates.

No agent changes business logic without an architecture/decision record.