# Executive Product Direction

## Decision

Build a complete Shopify-native retail inventory and purchasing platform that reaches **documented Stocky functional parity**, fixes Stocky's most repeated operational failures, and then adds explainable forecasting and automation.

Do **not** build a literal visual or branded clone. Shopify's Built for Shopify requirements prohibit apps from impersonating Shopify or a first-party Shopify product. The correct target is:

> Stocky-equivalent workflows, original product identity, current Shopify-native UX.

## What changed from the earlier plan

The supplier, purchase-order, receiving, stocktake, transfer, landed-cost, label and BOM concepts in the current repository are directionally valid. They should not all be deleted.

The current code still requires a controlled reset because it built broad modules before defining:

- exact Stocky parity behavior;
- authority between Shopify and the app;
- auditable sales, inventory and cost facts;
- safe inventory-write semantics;
- responsive Admin and POS workflows;
- App Store and Built for Shopify requirements;
- commercial-scale performance and tenant isolation.

## Product promise

The product should let a merchant run the inventory operating cycle without leaving Shopify:

1. Understand inventory risk.
2. Plan replenishment.
3. Create, approve and send purchase orders.
4. Track incoming quantities and expected dates.
5. Receive, reject, over-receive, backorder and correct receipts.
6. Print labels.
7. update Shopify inventory safely.
8. Calculate average and landed cost.
9. Count and adjust stock.
10. Transfer inventory across locations.
11. Audit every movement and financial effect.
12. Measure forecast quality and supplier performance.

## Strategic product modes

### Stocky Parity mode

This is the trust layer. It reproduces documented Stocky logic:

- Last X days;
- custom date range;
- same period last year;
- fill shelves;
- fill shelves if below minimum;
- target stock level;
- Stocky ABC using the last eight weeks and U grade;
- Stocky low-stock/reorder-point concepts;
- Stocky purchase-order, receiving, cost, counting, transfer and report workflows.

### Smart mode

This is optional and separately labeled:

- seasonal/trend/intermittent-demand models;
- backtested model selection;
- stockout-censored demand;
- forecast confidence and bias;
- supplier lead-time prediction;
- PO optimization;
- anomaly and discrepancy detection.

Smart mode must never silently replace parity logic. Every recommendation requires an explanation and measurable backtest evidence.

## Market wedge

The app should not compete as a heavyweight ERP. Community feedback points to a narrower need:

- fast, editable PO creation;
- accurate variant-level ordering;
- strong supplier and incoming-stock visibility;
- barcode and camera workflows that work on the sales floor;
- partial receiving, rejecting, extras and unreceiving;
- flexible tables and exports;
- average/landed cost;
- stocktakes and transfers;
- responsive support and transparent sync health.

## Built for Shopify reality

Design for Built for Shopify from day one, but do not market the badge as an immediate launch outcome. Current requirements include App Store compliance, good Partner standing, at least 50 net installs from active paid shops, five reviews, a recent rating threshold, Web Vitals targets, current App Bridge, embedded workflows, responsive design and Shopify-native UX. [S19]

## Recommended retention decision for the current repository

### Retain and refactor

- React Router Shopify scaffold;
- TypeScript;
- Prisma/PostgreSQL;
- Redis/BullMQ, now justified by the full platform scope;
- supplier domain;
- app-owned PO ledger;
- landed-cost service concept;
- stocktake, transfer, warehouse, label and BOM concepts;
- background workers and GraphQL helper concepts.

### Rebuild or substantially rewrite

- sales and inventory fact model;
- forecasting and ABC;
- incoming-inventory authority;
- buying table;
- PO lifecycle and receiving ledger;
- average-cost ledger;
- stocktake completion safety;
- transfers authority;
- reports;
- permission model;
- POS extensions;
- sync health, audit and support diagnostics.

### Remove or defer

- forced MOQ/pack rounding;
- hardcoded 30/14 forecast defaults;
- lead time and safety stock inside every default forecast;
- `AI-driven` marketing before backtesting;
- premature subscription gate;
- irrelevant merchant-managed fulfillment scopes;
- unsupported claims that custom app POs automatically equal Shopify-native incoming inventory.

## Non-negotiable product principles

1. One authoritative ledger per workflow.
2. Every inventory write is idempotent, auditable and recoverable.
3. Every forecast is explainable.
4. Variant-level identity is preserved.
5. No customer PII unless essential.
6. Mobile/POS is a first-class surface, not a desktop afterthought.
7. Merchants can export their data.
8. No hidden formula changes.
9. No app-wide mandatory MOQ, case, safety-stock or lead-time assumptions.
10. No production rollout without reconciliation against Shopify and Stocky exports.