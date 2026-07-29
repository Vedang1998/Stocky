# Full Stocky-Parity Product Requirements Document

## 1. Product scope

The application is a public Shopify App Store product for retail merchants operating inventory across Shopify Admin and Shopify POS. It owns advanced purchasing, operational receiving, cost, counting, alerts and analytics while using Shopify as the commerce and sellable-inventory system of record.

The application must reproduce every documented Stocky workflow that remains commercially valuable and improve the bottlenecks identified by merchants.

## 2. Product information architecture

### Primary App Bridge navigation

- Home
- Replenishment
- Purchase orders
- Receiving
- Inventory
- Stocktakes
- Transfers
- Suppliers
- Labels
- Reports
- Alerts
- Settings

Avoid a second in-app sidebar. Use `s-app-nav` and concise names.

### Contextual surfaces

- Shopify POS smart-grid tiles and modals
- product/variant admin extensions where useful
- Shopify Flow triggers/actions
- contextual bulk actions
- background exports and notifications

## 3. Module specifications

### 3.1 Home and onboarding

**Purpose:** prove the application is connected, current and operational.

**Home metrics**

- sync health and last refresh;
- inventory value and quantity;
- A/B/C/U distribution;
- low-stock value and expected lost revenue;
- open/late POs;
- receipts waiting;
- count variance;
- overdue transfers;
- forecast accuracy;
- data-quality exceptions.

**Onboarding**

1. Confirm locations.
2. Explain requested scopes.
3. Choose vendor/supplier setup.
4. Select historical import window.
5. Import Stocky exports when available.
6. Configure cost authority.
7. Configure default parity forecast.
8. Set up labels/scanners.
9. Install POS extensions.
10. Invite/assign team roles.
11. Run reconciliation checklist.

### 3.2 Catalog and inventory data

The catalog cache must include:

- product and variant GIDs;
- inventory item GID;
- product/variant titles and options;
- SKU and barcode;
- product vendor;
- product type, tags, status and collections needed for filters;
- selling price and compare-at price;
- Shopify cost;
- image;
- tracked flag;
- inventory quantity states by location;
- source update timestamps.

Order-line facts preserve original snapshots even after deletion. Recreated variants are new identities. The system may suggest lineage, but never merges history automatically without an explicit policy and audit.

### 3.3 Vendors and suppliers

**Vendor:** synchronized from Shopify's product vendor field.

**Supplier:** app-owned purchasing entity.

Supplier profile:

- name and status;
- contacts and addresses;
- payment and shipping terms;
- account number;
- currency and tax defaults;
- default lead/restock times;
- minimum order value;
- notes and attachments;
- preferred communication;
- supplier performance.

Variant-supplier record:

- supplier SKU;
- preferred supplier flag;
- effective cost and history;
- pack size;
- optional MOQ;
- optional min/max/shelf levels;
- variant lead-time override;
- tax;
- order unit;
- active dates.

Rules are optional. The app must support merchants who order individual units.

### 3.4 Replenishment and forecasting

#### Parity methods

1. **Last X days**

```text
daily_velocity = net_units_sold / sample_calendar_days
forecast_demand = daily_velocity × suggest_days
base_need = forecast_demand - available - incoming
suggested = ceil(max(0, base_need))
```

2. **Custom date range**

Use average units per calendar day in the selected inclusive range, scaled to the suggest period.

3. **Same period last year**

Use net units sold in the equivalent prior-year range. An optional growth adjustment belongs to Smart mode only.

4. **Fill shelves**

```text
suggested = max(0, shelf_limit - available - incoming)
```

5. **Fill shelves if below minimum**

```text
if available + incoming < minimum:
    suggested = max(0, shelf_limit - available - incoming)
else:
    suggested = 0
```

6. **Target stock level**

```text
suggested = max(0, target - available - incoming)
```

#### Worksheet columns

- ABC/U;
- image;
- product;
- variant/options;
- SKU;
- barcode;
- supplier SKU;
- shelf/aisle/bin;
- selling price;
- Shopify cost;
- PO cost;
- landed/average cost;
- margin and markup;
- available, committed, on hand and incoming;
- net units, distinct orders, revenue;
- units/day and revenue/day;
- days to depletion;
- lead time and reorder point;
- forecast demand;
- rule adjustment trace;
- suggested quantity;
- final quantity;
- pack quantity;
- warnings.

#### Behavior

- one row per current variant;
- product grouping is presentation only;
- sticky identity columns;
- keyboard numeric editing;
- configurable/saved columns;
- merchant can regenerate;
- manual edits survive sort/filter;
- row detail drawer supports a temporary period override;
- ABC does not change from a row-only override;
- every quantity has an explanation trace.

#### Smart mode

Smart mode uses rolling-origin backtesting. Candidate models may include parity average, seasonal naïve, trend blend, Croston/SBA and censored-demand adjustment. Select a model only when it has adequate history and improves the configured accuracy metric without unacceptable bias.

### 3.5 ABC and lifecycle classifications

#### Stocky parity

- variant level;
- last eight weeks;
- calculated daily;
- A items cumulatively drive the first 80% of revenue;
- B items drive the next 15%;
- C items drive the remainder;
- U indicates less than eight weeks of eligible data.

The item crossing a boundary stays in the earlier class. Sorting uses deterministic tie breakers.

#### Enhanced classifications

- configurable net sales, gross profit, units or margin contribution;
- XYZ demand variability;
- new, seasonal, discontinued and no-sales lifecycle flags;
- separate labels so merchants do not confuse these with Stocky parity.

### 3.6 Low stock and alerts

Reports:

- variant;
- product;
- vendor/supplier.

Fields:

- available/on hand/committed/incoming;
- sales velocity and sample;
- depletion date;
- automatic/manual ROP;
- lead time and source;
- need;
- lost revenue/day;
- open PO coverage;
- recommended action.

Alerts can deliver by email, Slack-compatible webhook and Shopify Flow, to multiple recipients, in merchant timezone. Support digest and real-time exception modes.

### 3.7 Purchase orders

#### Lifecycle

Draft → approval required/approved → sent → ordered → partially received → received/closed, with cancelled and archived states.

#### PO header

- supplier/vendor;
- destination;
- currency and frozen exchange rate;
- payment/shipping terms;
- billing/shipping address;
- PO number;
- supplier order number;
- invoice references;
- PO, invoice, expected, ship and cancellation dates;
- buyer/owner;
- notes and attachments;
- custom fields.

#### PO lines

- variant and supplier identity;
- ordered unit and pack;
- ordered/received/rejected/cancelled/backordered/remaining;
- base and effective cost;
- discounts;
- tax;
- allocated additional costs;
- landed cost;
- retail price and projected margin;
- shelf/aisle/bin;
- status and warnings.

#### Documents and communication

- versioned PDF;
- CSV;
- plain text;
- label export;
- email from app;
- delivery/sent history;
- revision and resend.

#### Commercial improvements

- multi-invoice and credit tracking;
- approval thresholds;
- duplicate-order detection;
- due and exception reports;
- bulk import;
- API/export ledger;
- supplier communication timeline.

### 3.8 Receiving

Receiving is event-based, not editable totals.

A receipt session records:

- PO;
- location;
- actor;
- start/completion;
- each scan/manual entry;
- accepted, rejected, extra and backordered quantities;
- reason and notes;
- inventory mutation IDs/results;
- labels printed;
- cost effects.

Support:

- receive selected;
- receive all;
- partial receipt;
- reject/damage;
- overage/extra;
- save/resume;
- unreceive through reversal;
- multiple shipments;
- desktop scanner;
- POS hardware scanner;
- device camera when supported;
- unknown barcode resolution.

A PO cannot appear fully received if Shopify inventory writes failed. It enters a visible reconciliation state.

### 3.9 Average and landed cost

#### Average unit cost

```text
new_average =
((current_average × current_stock_qty)
 + (received_landed_cost × received_qty))
/
(current_stock_qty + received_qty)
```

Implement Stocky's documented negative-stock exceptions and configurable synchronization to Shopify. Cost events are immutable.

#### Landed cost

Default parity allocation follows Stocky's landed margin concept. Additional supported allocations may use cost, quantity, weight or volume, but each method must reconcile exactly to the total charge with deterministic rounding.

Cost capabilities:

- initial import;
- supplier cost history;
- PO cost;
- landed cost;
- average cost;
- Shopify cost synchronization;
- cost corrections/reversals;
- profit reporting;
- data-completeness score.

### 3.10 Adjustments

- single/bulk;
- location;
- positive/negative;
- reason code;
- employee;
- note/attachment;
- approval where configured;
- Shopify mutation result;
- complete report and reversal policy.

### 3.11 Stocktakes and cycle counts

#### Setup

- name;
- full or partial;
- location;
- vendor/supplier;
- product type/tag/collection;
- ABC/U;
- zone/bin;
- inventory manager;
- variant limit;
- blind count;
- count method.

#### Count

- manual;
- desktop scanner;
- POS scanner/camera;
- save/resume;
- scan quantity modes;
- expected/on-hand/committed/available display based on role;
- missed list;
- unknown barcode;
- duplicate scan feedback;
- recount and verification.

#### Completion

- movement conflict review;
- discrepancy value;
- reason;
- second approval;
- export backup;
- safe zero-selected/all flow;
- idempotent Shopify adjustment;
- partial-failure recovery;
- immutable history.

### 3.12 Transfers

Use Shopify-native transfer objects as authority where the stable API supports required workflows. Mirror locally for analytics and recommendations.

Support:

- draft;
- approval;
- pick;
- multiple shipments;
- in transit;
- partial receipt;
- rejected/damaged;
- close/cancel;
- POS scanning;
- transfer labels/documents;
- replenishment and balancing suggestions.

### 3.13 Labels

- product, PO, receipt, transfer and stocktake sources;
- visual template editor;
- real-time preview;
- standard retail label sizes;
- barcode, SKU, product/variant, price, compare-at, supplier and location fields;
- role-based cost fields;
- PDF/browser/ZPL adapter strategy;
- exact quantity;
- reprint history.

### 3.14 Reports and analytics

Required Stocky parity reports:

- ABC;
- best sellers;
- low stock vendor/product/variant;
- orders;
- products;
- purchase orders;
- sale items;
- SKU/variant;
- statistics;
- current stock on hand;
- historical stock on hand;
- adjustments;
- transfers;
- profit;
- supplier report builder.

Additional reports:

- forecast accuracy and bias;
- supplier performance;
- lead-time reliability;
- PO due/exceptions;
- receipt variance;
- cost variance;
- inventory aging/dead stock;
- turns and sell-through;
- GMROI;
- stockout and service level;
- shrink/count accuracy;
- data quality;
- sync health.

Every report supports filters, columns, saved views, export, drilldown, freshness and metric definitions.

### 3.15 Settings, roles and audit

Settings domains:

- locations;
- supplier behavior;
- forecast;
- ABC;
- low stock;
- PO;
- receiving;
- cost;
- inventory adjustments;
- stocktakes;
- transfers;
- labels;
- notifications;
- imports/exports;
- integrations;
- billing;
- privacy and retention.

Use Shopify identity and app roles rather than a second login. Enforce permissions server-side.

Role templates:

- owner/admin;
- buyer;
- approver;
- receiver;
- inventory manager;
- counter;
- analyst;
- auditor.

### 3.16 Integrations

- Shopify Admin GraphQL;
- Shopify POS UI extensions and Scanner API;
- Shopify Flow;
- Shopify App Pricing;
- email provider;
- object storage;
- accounting exports and later connectors;
- merchant API/webhooks later.

The native Inventory Purchase Order API remains unstable/preview-only, so the public app must not make production parity depend on it.

### 3.17 AI governance

AI is a decision-support layer.

Required controls:

- evidence links;
- confidence;
- method/model name;
- history sufficiency;
- human approval before writes;
- audit;
- fallback;
- outcome/backtest measurement;
- no customer PII in prompts unless separately justified;
- no guaranteed outcome language.

## 4. Definition of Stocky parity

A module is not “parity complete” merely because a similarly named page exists. It must pass:

1. workflow acceptance tests;
2. calculation reconciliation;
3. data-integrity tests;
4. mobile/POS tests where applicable;
5. permission tests;
6. export/recovery tests;
7. performance targets;
8. support diagnostics;
9. documented difference review.

## 5. Out-of-scope until core parity is stable

- general ERP accounting;
- manufacturing MRP beyond simple BOM demand;
- warehouse robotics;
- supplier marketplace;
- automatic autonomous purchasing;
- storefront features unrelated to inventory;
- wholesale order management unless separately validated.