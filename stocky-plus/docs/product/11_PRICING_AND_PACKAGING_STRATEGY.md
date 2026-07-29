# Pricing and Packaging Strategy

**Status:** Approved pricing architecture; launch prices remain hypotheses until pilot validation.

## 1. Commercial objective

The pricing system must:

1. Convert merchants replacing Stocky without making the entry plan feel incomplete.
2. Let every paid merchant complete the essential inventory workflow.
3. Create clear reasons to upgrade as operational complexity and value increase.
4. Preserve healthy gross margin as catalog size, locations, support, storage and AI usage grow.
5. Keep billing predictable and understandable.
6. Avoid charging merchants primarily based on revenue.
7. Avoid unlimited AI usage.

The product should be priced as a serious Shopify inventory operating system, not as a single-purpose purchase-order utility and not as a heavyweight ERP.

## 2. Packaging principles

### 2.1 Core Stocky replacement features belong in every paid plan

Every paid plan includes the complete essential operating loop:

- Shopify catalog and inventory synchronization;
- Shopify vendor support;
- supplier records and supplier SKUs;
- Stocky-parity replenishment methods;
- ABC/U analysis;
- low-stock reports;
- purchase-order creation;
- PDF, email and CSV purchase-order output;
- full and partial receiving;
- basic rejected and extra quantity handling;
- basic barcode scanning;
- basic barcode labels;
- basic inventory adjustments;
- basic stocktakes;
- transfers;
- basic average-unit-cost tracking;
- core inventory and purchasing reports;
- data export;
- sync-health visibility;
- audit history for merchant-facing writes.

A lower plan must not be intentionally broken so that a merchant cannot complete a normal purchasing and receiving workflow.

### 2.2 Upgrades are driven by scale and operational sophistication

Plans should expand through:

- locations;
- active variants;
- users and roles;
- monthly PO allowance;
- sales-history depth;
- POS extension workflows;
- advanced receiving and correction;
- landed-cost complexity;
- approval workflows;
- automation and Shopify Flow;
- advanced reporting;
- Smart Forecasting and AI;
- integrations and API access;
- onboarding and support.

### 2.3 Revenue is not the primary billing metric

Merchant revenue is weakly connected to infrastructure cost and inventory complexity. A low-revenue merchant with many locations, variants and transfers can create more processing and support work than a higher-revenue single-location merchant.

Revenue may be used internally for segmentation and willingness-to-pay research, but it should not normally determine the public plan.

### 2.4 Visible limits must be understandable

Merchant-facing plan limits should focus on:

- active variants;
- locations;
- users;
- monthly POs on the entry plan;
- included AI actions.

Internal metering can additionally track:

- monthly order lines processed;
- webhook and background-job volume;
- export volume;
- database and file storage;
- support burden;
- AI cost.

Do not expose technical token counts or API-call counts to merchants.

## 3. Recommended launch plan architecture

Prices below are working hypotheses. They must be tested with Buffalo House and pilot merchants before public launch.

### Essentials — $29/month

**Positioning:** Complete Stocky essentials for one retail location.

Limits:

- 1 location;
- up to 2,500 active variants;
- up to 3 users;
- up to 50 created POs per billing month;
- up to 24 months of available app reporting history;
- 100 included AI credits per month.

Included:

- all core Stocky replacement features;
- all six Stocky-parity forecast methods;
- ABC/U;
- low-stock vendor, product and variant views;
- suppliers and supplier SKUs;
- PO creation, PDF, email and CSV;
- full and partial receiving;
- basic reject and extra handling;
- desktop and basic mobile barcode workflows;
- standard labels;
- adjustments;
- basic stocktakes and transfers;
- basic average-unit-cost ledger;
- core reports;
- standard email support.

Upgrade reasons:

- additional locations;
- higher PO volume;
- POS floor workflows;
- advanced roles and approvals;
- landed-cost allocation;
- advanced receiving corrections;
- automation;
- Smart Forecasting.

### Growth — $79/month

**Positioning:** Multi-location inventory operations for established retailers.

Limits:

- up to 5 locations;
- up to 15,000 active variants;
- up to 10 users;
- unlimited standard POs subject to fair-use and platform protections;
- up to 36 months of available app reporting history;
- 500 included AI credits per month.

Includes everything in Essentials, plus:

- Shopify POS receiving, transfer and stocktake extensions;
- advanced barcode and camera-assisted workflows where supported;
- saved views and advanced table customization;
- advanced receiving dispositions;
- receipt reversal/unreceive workflow;
- landed-cost allocation;
- enhanced average-cost controls;
- role templates and granular permissions;
- PO approvals;
- expected-date, due and exception reporting;
- scheduled reports and multi-recipient alerts;
- Shopify Flow triggers and actions;
- supplier performance;
- forecast-accuracy reporting;
- Stocky migration assistance tools;
- priority email support.

This should be the recommended and visually highlighted plan.

### Pro — $149/month

**Positioning:** Advanced planning, automation and financial control.

Limits:

- up to 15 locations;
- up to 50,000 active variants;
- unlimited users;
- unlimited standard POs subject to fair-use and platform protections;
- up to 60 months of available app reporting history;
- 1,500 included AI credits per month.

Includes everything in Growth, plus:

- Smart Forecasting model selection;
- seasonal, trend and intermittent-demand models;
- forecast backtesting, confidence and bias;
- advanced PO optimization;
- supplier lead-time prediction;
- transfer and stock-rebalancing recommendations;
- multi-invoice, credit and payment tracking;
- advanced approval policies;
- advanced audit exports;
- advanced inventory aging, GMROI and service-level reporting;
- accounting export and supported accounting integrations;
- enhanced anomaly and discrepancy detection;
- natural-language analytics;
- higher automation limits;
- priority onboarding and support.

### Enterprise — custom, starting around $299/month

**Positioning:** High-volume and complex retail organizations.

Possible inclusions:

- more than 15 locations;
- more than 50,000 active variants;
- negotiated data retention and processing volumes;
- custom roles and governance;
- API and outbound webhooks;
- custom integrations;
- SSO when commercially justified;
- migration services;
- dedicated onboarding;
- contractual support;
- negotiated AI allowance;
- custom data residency or retention where available.

Enterprise contracts require an individual cost and margin model.

## 4. Annual pricing

Recommended annual offer:

- two months free, approximately 16.7% below monthly billing;
- Essentials: $290/year;
- Growth: $790/year;
- Pro: $1,490/year.

Do not offer lifetime discounts.

A founding-merchant program may offer a temporary discount for the first 12 months or include migration/onboarding value. It should not permanently reduce the price for the life of the account.

## 5. Trial and conversion strategy

### Recommended launch conversion flow

1. Offer a 14-day trial.
2. Default the trial to Growth capabilities.
3. Require plan selection through Shopify's billing flow.
4. Recommend Growth as “Best for most retailers.”
5. Keep Essentials visibly complete rather than describing it as a crippled plan.
6. Use Pro as the value anchor for advanced planning and automation.
7. Show plan usage and limits inside Settings before the merchant reaches a limit.
8. Provide a clear downgrade impact preview.
9. Preserve merchant data during a reasonable grace period after downgrade or cancellation.
10. Never threaten data deletion as a conversion tactic.

### No permanent free plan at initial launch

A free plan is not recommended initially because:

- inventory applications have meaningful onboarding and support costs;
- free merchants can still produce substantial synchronization and storage work;
- low-intent installs can damage support quality;
- Built for Shopify merchant-utility thresholds focus on active paid shops;
- a 14-day trial provides a lower-risk evaluation path.

A future free read-only inventory health report can be tested as a lead-generation product, but it should not include operational inventory writes.

## 6. Plan-entitlement rules

Create one centralized entitlement service. Application routes and background workers must not hardcode plan names or prices.

Each capability has a stable entitlement key, for example:

- `core.replenishment`
- `core.purchase_orders`
- `core.receiving`
- `core.stocktakes`
- `core.transfers`
- `pos.receiving`
- `cost.landed`
- `workflow.approvals`
- `automation.flow`
- `forecast.smart`
- `analytics.natural_language`
- `integration.accounting`
- `platform.api_access`

Each plan defines:

- enabled capabilities;
- numeric limits;
- AI allowance;
- support level;
- retention period.

Server-side entitlement checks are mandatory. Hiding a button is not authorization.

Downgrades must define:

- which features become read-only;
- whether existing records remain viewable;
- which scheduled jobs stop;
- how excess locations or variants are selected;
- how long exports remain available;
- how the merchant can resolve over-limit status.

## 7. AI commercial strategy

### 7.1 AI is not the numerical forecasting engine

The app must use deterministic formulas and conventional statistical models for:

- Stocky-parity forecasts;
- ABC/U;
- reorder-point calculations;
- cost calculations;
- average-unit-cost calculations;
- landed-cost allocation;
- forecast accuracy metrics;
- anomaly scoring where a statistical rule is sufficient.

LLMs are used for:

- explanations;
- natural-language report questions;
- summarizing anomalies;
- supplier-risk narratives;
- support diagnostics;
- translating operational findings into actions.

This avoids paying model costs for calculations that code can perform more accurately and cheaply.

### 7.2 No unlimited AI

Every plan has a monthly AI allowance. The application must stop, degrade gracefully or request an upgrade before exceeding the merchant's included allowance or internal cost budget.

Do not advertise “unlimited AI.”

### 7.3 AI credits

AI credits are a merchant-friendly abstraction. Merchants should never need to understand tokens.

Suggested weight examples:

- forecast explanation: 1 credit;
- anomaly explanation: 1 credit;
- supplier or receipt summary: 2 credits;
- natural-language report question: 2 credits;
- multi-location optimization analysis: 5 credits;
- portfolio-level PO optimization: 10 credits.

Weights may change based on measured cost, but changes must be versioned and clearly disclosed.

### 7.4 AI cost budgets

Target economics:

- total variable platform COGS should generally remain below 20% of subscription revenue;
- AI COGS target should remain below 6% of subscription revenue;
- AI COGS warning threshold: 8%;
- AI COGS hard maximum without explicit commercial approval: 10%.

Initial internal monthly AI cost budgets per shop:

- Essentials: $1.75;
- Growth: $5.00;
- Pro: $12.00;
- Enterprise: contract-specific.

The system enforces both:

1. credit allowance;
2. actual provider-cost budget.

Whichever limit is reached first controls access.

The budgets are internal operating controls, not customer-facing promises.

### 7.5 Model routing

Use the least expensive model that passes quality requirements.

Recommended routing:

1. deterministic code or statistical model;
2. cached templates and precomputed narrative;
3. cost-efficient model for routine explanations;
4. stronger model only for explicitly complex Pro or Enterprise actions;
5. human-readable fallback when AI is unavailable.

Model selection is configuration-driven and must not be hardcoded throughout the application.

### 7.6 Required cost controls

Every AI request must record:

- shop;
- feature;
- plan;
- provider;
- model;
- prompt version;
- input tokens;
- cached input tokens;
- output and reasoning tokens where reported;
- provider cost;
- internal credit cost;
- latency;
- success/failure;
- fallback used;
- user feedback when available.

Controls:

- pre-request budget authorization;
- per-action maximum input size;
- per-action maximum output;
- compact structured facts rather than raw order history;
- prompt caching;
- response caching where safe;
- daily and monthly per-shop limits;
- global organization spending limit;
- model-level kill switches;
- feature-level kill switches;
- abnormal-spend alerts;
- cost dashboards;
- retry limits;
- no repeated AI call during page rerenders;
- no AI call for background polling;
- batch processing for eligible non-urgent workloads;
- deduplication of identical requests;
- pre-aggregated data instead of sending full datasets.

### 7.7 AI margin gate

Before enabling an AI feature for production, measure:

- average provider cost per action;
- p95 provider cost per action;
- actions per active shop;
- cost as percentage of plan revenue;
- feature adoption;
- merchant retention or conversion impact;
- quality and error rate.

An AI feature does not launch merely because it works technically. It must demonstrate acceptable quality and unit economics.

### 7.8 Overage policy

Do not launch with automatic AI overage billing.

Shopify App Pricing supports combined recurring and usage-based pricing, but its current usage-based system does not provide native usage caps. A predictable fixed subscription with app-enforced AI limits is safer for launch.

When enough production data exists, test one of:

- upgrade to the next plan;
- fixed monthly AI add-on;
- explicitly opt-in usage billing with an app-enforced spending ceiling.

No merchant should receive surprise AI charges.

## 8. Infrastructure and support cost controls

Plan economics must track more than AI:

- database storage;
- Redis and queue use;
- object storage and downloads;
- email delivery;
- monitoring;
- GraphQL and background processing;
- support time;
- onboarding and migration labor.

Migration assistance must distinguish:

- self-service tools included in plans;
- standard guided migration;
- paid white-glove migration.

Do not promise unlimited custom integrations or onboarding labor inside a low-cost recurring plan.

## 9. Metrics required before final pricing

Collect during Buffalo House and pilot testing:

- active variants;
- locations;
- users;
- monthly order lines;
- POs and PO lines;
- receipt lines and scans;
- stocktake lines;
- transfer lines;
- report runs;
- exports;
- database/storage growth;
- webhook/jobs volume;
- AI actions and actual cost;
- support minutes;
- migration hours;
- time saved;
- forecast accuracy;
- willingness to pay;
- upgrade triggers.

Final prices require at least:

- Buffalo House operating data;
- 5–10 pilot merchants;
- actual support burden;
- actual infrastructure cost;
- AI cost distribution;
- merchant interviews;
- pricing-page conversion tests.

## 10. Pricing experiments

Test:

- $29 / $79 / $149;
- a higher-value structure such as $39 / $99 / $199;
- 14 versus 30-day trial;
- Growth default versus merchant-selected trial;
- feature-led versus scale-led pricing-page copy;
- migration credit versus temporary discount;
- annual discount between 15% and 20%.

Do not change prices frequently for active merchants. Version plans and honor agreed billing terms.

## 11. Market reference

Current Shopify inventory and purchasing apps span from inexpensive single-purpose utilities to several hundred dollars per month for multi-location operations. Comparable Stocky-replacement products commonly use locations, variants, PO volume, transaction volume and advanced functionality as plan boundaries.

The proposed architecture intentionally places:

- a complete entry workflow at $29;
- the main multi-location product at $79;
- advanced AI, automation and financial control at $149;
- high-volume custom requirements in Enterprise.

## 12. Shopify billing implementation

Use Shopify App Pricing for the public application.

Initial recommendation:

- fixed monthly and annual recurring plans;
- 14-day trial;
- no automatic usage charges at launch;
- private $0 test plan for development;
- Partner API subscription verification;
- app events and billing events recorded for audit;
- plan handles mapped centrally to internal entitlement versions.

The billing page must show:

- current plan;
- renewal date;
- included limits;
- current usage;
- AI usage;
- projected limit date where useful;
- upgrade/downgrade effects;
- annual savings;
- support level.

## 13. Decision status

Approved now:

- four-tier architecture;
- all essential Stocky workflows in every paid plan;
- Growth as recommended plan;
- scale plus feature packaging;
- no revenue-based pricing;
- no unlimited AI;
- no automatic AI overage at launch;
- internal AI cost budgets and margin gates;
- centralized entitlement service;
- 14-day trial;
- Shopify App Pricing.

Still provisional:

- final dollar prices;
- exact variant/location/user limits;
- exact AI credit allowances;
- annual discount;
- founding merchant offer;
- Enterprise starting price.

These are finalized after pilot evidence.
