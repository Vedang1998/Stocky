# Shopify-Native Technical Architecture and Built for Shopify Plan

## 1. Architecture decision

Keep the current Shopify React Router foundation, PostgreSQL, Prisma and BullMQ/Redis. The full-platform scope justifies a durable queue. Do not rewrite to a different framework merely because the first implementation is wrong.

### Recommended production stack

- Node.js 22 LTS;
- TypeScript strict;
- Shopify React Router template;
- latest supported App Bridge;
- Polaris web components;
- stable Admin GraphQL API pinned and upgraded on schedule;
- PostgreSQL;
- Prisma;
- Redis + BullMQ;
- object storage compatible with S3;
- email provider such as Postmark or Resend;
- Sentry plus structured logs and metrics;
- Vitest and Playwright;
- GitHub Actions;
- managed staging and production infrastructure.

A practical initial hosting setup is a managed web service, worker service, PostgreSQL and Redis. Render is reasonable for pilots; AWS/GCP can be adopted later if operational requirements justify the extra complexity.

## 2. Service boundaries

A modular monolith is the correct initial architecture.

Logical modules:

- identity/tenant;
- Shopify sync;
- catalog;
- suppliers;
- sales facts;
- inventory facts;
- forecasting;
- purchase orders;
- receipts;
- costs;
- adjustments;
- stocktakes;
- transfers;
- labels/documents;
- reports;
- notifications;
- billing;
- audit;
- AI.

Do not create microservices at this scale. Use transactional module boundaries, queues and outbox patterns.

## 3. Core ledgers

### Sales ledger

Store order and line facts with original snapshots and current net quantities. Do not store unnecessary customer PII.

### Inventory event ledger

Record app-initiated receipts, adjustments, stocktake results, reversals and transfer effects with Shopify mutation references.

### Purchasing ledger

PO header, versions, lines, approvals, communications, shipments, receipts, invoices, charges and statuses.

### Cost ledger

Cost layers/events, allocation, average-cost changes, sync attempts and reversals.

### Audit ledger

Actor, shop, location, entity, action, before/after, timestamp and correlation.

Daily aggregates are derived, not the only truth.

## 4. Multi-tenant requirements

- authenticated shop from server session;
- `shopId` on every merchant-owned table;
- tenant-scoped unique constraints;
- server authorization;
- shop-aware queue jobs, cache and storage paths;
- no user-provided shop IDs as authority;
- uninstall disables jobs immediately;
- redaction/deletion policy;
- cross-shop tests.

## 5. Shopify authority map

| Domain | Authority |
|---|---|
| Products/variants | Shopify |
| Sellable inventory states | Shopify |
| Orders/refunds | Shopify |
| Product vendor | Shopify |
| Supplier master | App |
| Advanced PO ledger | App until stable native API supports parity |
| Receipts/dispositions | App, synchronized to Shopify inventory |
| Average/landed cost ledger | App, optional explicit Shopify cost sync |
| Stocktakes | App count ledger; Shopify inventory after approved completion |
| Transfers | Shopify native transfer when API/workflow supports it; app mirrors/augments |
| Reports/forecasts | App derived facts |
| Roles | Shopify identity + app authorization |

Never let two ledgers both pretend to be authoritative without reconciliation.

## 6. Webhooks and jobs

Webhook handler:

1. authenticate;
2. capture minimal envelope;
3. deduplicate;
4. enqueue;
5. acknowledge quickly;
6. refetch authoritative data;
7. transactionally upsert;
8. update watermarks;
9. invalidate aggregates;
10. expose failure.

Required domains include installation/uninstallation, scope changes, products/variants, orders/edits/cancellations/refunds, inventory levels and relevant location changes. Validate current topic and scope names against official documentation at implementation time.

Use:

- retry with bounded exponential backoff;
- dead-letter workflow;
- idempotency keys;
- outbox for writes;
- per-shop concurrency controls;
- rate-limit awareness;
- full reconciliation jobs.

## 7. Inventory-write safety

Every receiving/count/adjustment write requires:

- immutable operation ID;
- idempotency key;
- expected source state where supported;
- explicit location;
- actor;
- line-level result;
- retry classification;
- reconciliation;
- partial-failure state;
- no “completed” status until confirmed.

The current repository's serial stocktake loop and completion despite failed lines is not acceptable.

## 8. Current native PO limitation

The current public stable Admin API does not offer the full Inventory Purchase Order API; the documented object remains unstable/feature-preview. The application therefore needs an app-owned PO ledger for commercial Stocky parity. It may export/import or reconcile native data when possible, but cannot promise native Shopify PO identity or incoming behavior that the stable API does not expose. [S22]

## 9. POS architecture

POS extension surfaces:

- Inventory Operations tile;
- Receive purchase order;
- Count inventory;
- Receive transfer;
- Product stock lookup;
- Print/reprint label;
- Adjustment shortcut where authorized.

Use current Scanner API for hardware/camera scanning. The POS extension calls the app backend for operational state and performs Shopify writes through authorized server operations.

## 10. Reporting architecture

- detailed facts;
- incremental daily aggregates;
- materialized report tables for heavy views;
- report-run metadata;
- data freshness;
- deterministic metric definitions;
- saved view JSON with versioning;
- asynchronous exports;
- query limits and indexes;
- no row-by-row Shopify calls.

## 11. AI architecture

AI cannot query arbitrary raw production tables directly.

Use:

- governed metric service;
- approved retrieval endpoints;
- redaction;
- prompt/version logging;
- model evaluation;
- confidence and evidence;
- human confirmation for actions;
- tenant-specific rate limits;
- cost controls.

Forecasting models should be conventional statistical models first. An LLM is useful for explanation, anomaly summaries and workflow assistance—not as the numerical demand engine.

## 12. Built for Shopify checklist

### Prerequisites

- App Store approved;
- Partner in good standing;
- 50 net installs on active paid shops;
- five reviews;
- current rating threshold.

### Performance

At p75 and minimum measurement volume:

- LCP <= 2.5 seconds;
- CLS <= 0.1;
- INP <= 200 milliseconds.

### Integration

- embedded with latest App Bridge;
- session token authentication;
- primary workflows inside Shopify;
- no second sign-up;
- useful Admin homepage;
- settings inside app;
- clean uninstall.

### Design

- Shopify-like cards, spacing, typography and buttons;
- responsive;
- concise app name;
- App Bridge navigation;
- contextual save bar;
- appropriate modals;
- clear onboarding;
- helpful persistent errors;
- logical action hierarchy;
- live previews for labels/templates;
- no Shopify impersonation.

### Operational BFS work

- capture Web Vitals from pilot;
- performance budgets in CI;
- test mobile widths;
- test app navigation state;
- audit all forms for contextual save bar;
- audit error copy;
- remove loading flicker/layout shifts;
- listing and admin name remain concise;
- do not show review-pressure prompts.

## 13. Security and privacy

- least-privilege scopes by feature;
- separate optional scope activation for cost/inventory writes where architecture permits;
- secret manager;
- encrypted sensitive supplier contact details;
- no customer PII for forecasting;
- HMAC/webhook tests;
- CSRF/session protections from official template;
- dependency scanning;
- rate limiting;
- export authorization;
- signed temporary file links;
- deletion/retention policy;
- incident response.

## 14. Environment strategy

- local development store;
- shared staging development store;
- production public app;
- separate Shopify configurations and credentials;
- separate DB/Redis/storage;
- migration gating;
- feature flags;
- seeded demo shop;
- inventory-write kill switch;
- rollback runbook.

## 15. Testing pyramid

### Unit

Formulas, ABC boundaries, costs, allocations, status transitions, permissions, CSV and date logic.

### Integration

GraphQL operations, webhooks, jobs, database transactions, inventory writes, receipt reconciliation, billing and privacy handlers.

### End to end

Onboarding, sync, forecast, PO, send, receive, reject/extra, label, cost, stocktake, transfer, reports, mobile/POS.

### Reconciliation

Compare outputs to exported Stocky and Shopify records across representative variants and edge cases.

### Nonfunctional

Load, multi-tenant isolation, accessibility, Web Vitals, failover, queue recovery and security.