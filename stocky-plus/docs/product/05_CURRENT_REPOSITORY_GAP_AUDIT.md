# Current Repository Gap Audit

Repository reviewed: `Vedang1998/Stocky`, current application under `stocky-plus`.

This is a connector-backed source review. Commands such as `npm test`, `npm run typecheck` and `npm run build` have not been executed in this environment. Cursor and Claude Code must run them locally.

## What is directionally useful

- current Shopify React Router template;
- TypeScript/React;
- Prisma/PostgreSQL;
- BullMQ/Redis worker structure;
- supplier and supplier-SKU concepts;
- PO and line-item concepts;
- landed-cost concept;
- stocktake, transfer, warehouse, labels and BOM modules;
- GraphQL throttling helper;
- basic catalog sync;
- current app already linked through Shopify development tooling.

## Critical gaps

### P0 — scope and authority

1. The requested scopes include product and inventory writes plus merchant-managed fulfillment scopes without a documented feature-to-scope justification.
2. The app owns POs, incoming, receiving, transfers and inventory mutations without an authority/reconciliation specification.
3. Detailed order and line-item facts are missing; `SalesDailyAggregate` is insufficient for audits, refunds, edits and variant deletion.
4. There is no complete immutable receipt/inventory event ledger.
5. There is no robust average-cost ledger.
6. Roles and permissions are not implemented.
7. Required privacy/compliance and complete webhook coverage are not demonstrated.

### P0 — forecasting and ABC

The current forecast:

- defaults to 30 days;
- targets 14 days;
- includes lead time and safety stock;
- excludes out-of-stock days;
- uses custom open POs as incoming;
- is not the documented Stocky Last X formula.

The current ABC:

- is fixed to 90 days;
- optionally grades volume;
- lacks U;
- classifies from the post-add cumulative percentage, so the item crossing 80% can incorrectly become B and the item crossing 95% can become C;
- does not implement deterministic ties or reproducible runs.

These must be replaced by a tested parity engine, with enhanced models isolated in Smart mode.

### P0 — purchasing and receiving

- Buying Table requires manual supplier mappings instead of supporting Shopify vendor immediately.
- It caps mappings at 50.
- It executes multiple database/API operations per row.
- It forces MOQ and pack rounding.
- It creates custom POs directly from this wrong suggestion logic.
- Required Stocky columns and controls are missing.
- PO records and child lookups need a complete tenant/authorization audit.
- Currency and cost parsing use JavaScript numbers in request handlers.
- PO documents, communication, approvals, invoices, backorders and receipt events are incomplete.
- Receiving lacks rejected/extra/reversal and line-level write reconciliation.

### P0 — stocktake safety

The current implementation:

- freezes from the latest `quantityAvailable` snapshot rather than a properly defined physical on-hand basis;
- can use stale daily snapshots;
- writes line-by-line serially;
- skips null counts;
- marks the stocktake complete even if some mutations fail;
- has no movement conflict handling;
- lacks scanner/POS flows, scope filters, missed list, safer zero actions, CSV backup and approvals.

Do not enable this against a production store.

### P1 — sync and data

- Product bulk sync omits vendor, price, Shopify cost and location inventory states required by the product.
- Nested product variants in a bulk query need validation and scale testing.
- GraphQL operations are manually typed and need current-schema validation/code generation.
- Webhook coverage omits important product/order-edit/location and compliance workflows.
- The worker logs basic success/failure but has no merchant-visible dead-letter/reconciliation system.
- Hard limits of 50 POs, 50 mappings and 250 variants will hide real data.

### P1 — UX

- Current Buying Table is not a Stocky-equivalent worksheet.
- It is prematurely gated by a subscription flag.
- It lacks configurable columns, selling price, PO cost, margin, markup, net units, orders, revenue/day, depletion, global method controls, quantity explanation and robust manual edits.
- Most modules are long page forms rather than mature workflows.
- POS extensions are absent.
- Responsive/mobile behavior is unproven.

### P1 — performance

- Buying Table contains an N+1 loop across mappings and live Shopify inventory reads.
- dead-stock and valuation services also query inside loops.
- reports are based on ad hoc functions rather than a report/aggregate architecture.
- no Web Vitals/performance budgets are evident.

## File-level observations

### `shopify.app.toml`

- API version is older than the current development target.
- scopes are broader than explained.
- webhook set is incomplete for a public inventory app.

### `prisma/schema.prisma`

Useful domain seeds exist, but the schema lacks:

- Shop entity and explicit tenant relations;
- detailed product/variant fields;
- order/line facts;
- receipt/shipment/invoice ledgers;
- cost events;
- audit events;
- jobs/sync runs;
- role/permissions;
- saved views/reports;
- notifications;
- import/export jobs;
- data-quality and lineage records.

### `app/services/forecasting.server.ts`

Requires rewrite, not patching.

### `app/routes/app.buying-table.tsx`

Requires product redesign and data-access rewrite.

### `app/routes/app.purchase-orders.tsx`

Can inform a prototype, but lifecycle, money, authorization and receipt logic require redesign.

### `app/routes/app.stocktakes.tsx`

Unsafe for live inventory until rebuilt.

### `app/services/shopify-gql.server.ts`

Retain the rate-limit concept; replace hand-maintained types/operations with validated current GraphQL operations and complete catalog/inventory fields.

## Recommended repository strategy

1. Freeze feature additions.
2. Create a product-alignment branch.
3. Add the approved PRD, architecture, formulas, authority map and acceptance tests.
4. Run existing lint/typecheck/test/build and record results.
5. Add characterization tests around current behavior.
6. Build the new fact and audit foundation through additive migrations.
7. replace forecasting/ABC first.
8. rebuild the replenishment worksheet.
9. rebuild PO/receipt ledger.
10. then inventory writes, counts, transfers and cost sync.
11. remove obsolete paths only after migration and replacement tests.
12. use PRs and Claude independent review for each phase.