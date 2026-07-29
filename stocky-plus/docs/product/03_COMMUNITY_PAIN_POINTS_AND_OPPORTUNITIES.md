# Community Research: Stocky Bottlenecks and Product Opportunities

## Research caution

Reviews and community posts are anecdotal. They identify recurring failure modes and product hypotheses; they do not prove how common each issue is across all merchants. Official Shopify documentation is used for feature parity, while reviews and discussions shape improvements.

## Repeated pain-point themes

### 1. Desktop and scanner limitations

Stocky reviews describe workflows that did not open properly in POS, required Safari/desktop, or had barcode-scanner friction. Official Stocky documentation says barcode stocktakes require a desktop and do not support a device camera or Shopify POS. [S7, S23]

**Product response**

- first-class POS receiving, count and transfer tiles;
- hardware scanner plus camera support through current POS APIs;
- keyboard-wedge support in Admin;
- resumable scan sessions;
- visible unknown/duplicate scan feedback;
- tested large-count performance.

### 2. Incoming inventory has two sources of truth

Community posts report Shopify-native POs appearing as incoming in Shopify while Stocky remained unaware, making Stocky's low-stock report inaccurate. [S26]

**Product response**

- define and display incoming source explicitly;
- app-owned PO incoming ledger;
- native transfer mirroring;
- native PO reconciliation/import where technically possible;
- duplicate-incoming detection;
- source badges and reconciliation report;
- never claim native Admin incoming integration while the stable API cannot support it.

### 3. Deleted and recreated variants break continuity

Stocky and Shopify community posts show that deleting/recreating variants creates new IDs and does not relink historical orders. [S27, S28]

**Product response**

- preserve line-item identity snapshots forever;
- prevent silent SKU-based merging;
- data-quality warning before destructive catalog workflows where possible;
- optional human-approved lineage feature;
- catalog backup/change history as a later differentiator.

### 4. Purchase-order tables are operationally rigid

Reviews ask for better product descriptions, flexible columns/order/width, correct partial-receipt totals, understandable backorders, due reports, multi-invoice handling and mass import/export. [S23, S30]

**Product response**

- spreadsheet-like keyboard workflow;
- configurable views;
- separate quantity dispositions;
- due/exception dashboard;
- versioned PO documents;
- multi-invoice ledger;
- CSV import/export;
- contextual save bar;
- full audit.

### 5. Mobile PO communication and payment tracking

A review requests sending POs on the go and invoice/payment integration. Community posts about the Stocky sunset specifically object to losing direct PO emailing and tracked send history. [S23, S30]

**Product response**

- responsive PO detail;
- send from Admin mobile;
- delivery/sent timeline;
- deposits, invoices, credits and payments;
- later accounting connectors.

### 6. Stocktake risk and performance

Official documentation warns that Stocky ignores unfulfilled committed items and has irreversible zero actions. Reviews also mention scanner failures and large catalog problems. [S7, S23]

**Product response**

- show on-hand, committed and available distinctly;
- movement conflict handling;
- partial/cycle counts;
- safer zero workflow with impact preview and approval;
- persisted count history;
- POS/camera scanning;
- batch inventory writes with reconciliation.

### 7. Reliability and support

Low reviews reference slow/buggy behavior, missing products, 504-like failures and support agents unfamiliar with Stocky. [S23]

**Product response**

- sync-health page;
- per-job status and retries;
- no hard-coded 50/250 item limits;
- diagnostic bundle;
- error IDs;
- operational runbooks and support tooling;
- merchant-visible data freshness;
- SLOs and alerting.

### 8. Forecasting is too simplistic for seasonal/new products

Official ABC documentation warns that its eight-week view may not represent seasonal products. Merchants discussing replacements want forecasts but not enterprise ERP complexity. [S11, S29, S31]

**Product response**

- preserve parity baseline;
- separate Smart mode;
- same-period-last-year;
- seasonal/trend/intermittent models;
- comparable-event ranges;
- backtesting and confidence;
- new-item/U lifecycle rules;
- manual override remains central.

### 9. Price versus complexity

Replacement-app reviews praise simple Stocky-like workflows but criticize expensive tiers when basic purchase orders are locked behind the highest plan. [S24]

**Product response**

- do not force a merchant who only needs POs into an enterprise tier;
- capability tiers aligned with location/volume/advanced analytics;
- transparent limits;
- no guilt, timers or review incentives;
- core export and data access on all paid tiers.

## Positive Stocky qualities to preserve

Not every Stocky trait is a flaw. Positive reviews and replacement reviews consistently value:

- quick PO generation;
- barcode receiving;
- label printing;
- partial receiving;
- simple replenishment;
- supplier workflows;
- cost visibility;
- not being a full ERP;
- usable sales velocity.

The product should improve these workflows without burying them under dashboards or automation.

## Opportunity ranking

### P0: must solve before market launch

- reliable data sync and freshness;
- complete variant-level facts;
- parity replenishment;
- flexible PO grid;
- partial/reject/extra receiving;
- POS/mobile scanning;
- inventory-write reconciliation;
- average/landed cost;
- stocktake safety;
- incoming source transparency;
- exports and migration.

### P1: strong commercial advantage

- PO approvals and due reports;
- unreceive/reversal;
- multi-invoice/payment tracking;
- supplier performance;
- Flow alerts;
- forecast backtesting;
- responsive support diagnostics;
- original mobile-first label workflow.

### P2: later differentiation

- seasonal/intermittent model selection;
- transfer optimization;
- accounting integrations;
- natural-language analytics;
- catalog change recovery;
- budget/MOV optimization;
- advanced BOM demand.