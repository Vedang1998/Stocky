# Current Route and Feature Inventory — Phase 0

**Branch:** `phase-0-product-alignment-v2`  
**Base main SHA:** `f1923acef0c44b1e80d0b5aae44a517aedf56aef`  
**Inspected:** 2026-07-29

## Admin routes

| Route | Purpose | Related feature IDs | Disposition | Notes |
|---|---|---|---|---|
| `app.tsx` | Embedded shell + nav | F-001 | Keep | Missing Home modules from PRD IA (Receiving, Inventory, Labels, Reports, Alerts, Settings as first-class) |
| `app._index.tsx` | Dashboard | F-004, F-007 | Refactor | Working title heading; sync CTA; subscription display |
| `app.suppliers.tsx` | Supplier list | F-017 | Keep/refactor | Shop-scoped |
| `app.suppliers_.$id.tsx` | Supplier detail, mappings, tiers | F-017–F-024 | Keep/refactor | Child deletes now scoped via parent supplier |
| `app.purchase-orders.tsx` | PO list/create/lines/receive | F-046–F-059 | Refactor | Shop checks added Phase 0; money still JS number; receive gated |
| `app.purchase-orders_.$id.receiver.tsx` | Receiver PDF | F-052 | Keep/refactor | Shop-scoped loader |
| `app.buying-table.tsx` | Replenishment worksheet | F-026–F-040, F-039 | Rebuild later | Caps 50 mappings; N+1 live inventory; forced MOQ/pack; wrong forecast; premature Boolean gate |
| `app.warehouse.tsx` | Barcode receiving UI | F-057, F-062 | Refactor | Receipt writes gated; no Shopify inventory sync |
| `app.warehouse_.labels.tsx` | ZPL labels | F-084, F-085 | Keep/refactor | Partial |
| `app.transfers.tsx` | Custom transfer lifecycle | F-081, F-082 | Refactor | Shopify transfer mutations gated; tenant fixes on addLine/pick |
| `app.stocktakes.tsx` | Cycle counts | F-074–F-080 | Unsafe → freeze | Writes gated; no longer completes on Shopify failures |
| `app.bundles.tsx` | BOM / kits | — | Defer | Directional foundation |
| `app.analytics.tsx` | Ad hoc analytics | F-086–F-101 | Rebuild | N+1 risk in valuation/dead-stock |
| `app.analytics_.export.tsx` | CSV export | F-110 | Keep/refactor | |
| `app.billing.tsx` | Shopify app subscription | F-127 | Rebuild | Boolean + hardcoded plan handles; temporary Essentials/Growth labels |

## Auth / webhook routes

| Route | Purpose | Disposition |
|---|---|---|
| `auth.$.tsx`, `auth.login/*`, `_index` | OAuth / login | Keep |
| `webhooks.app.uninstalled.tsx` | Session cleanup | Keep; expand Phase 1 (disable jobs, retention) |
| `webhooks.app.scopes_update.tsx` | Scope change | Keep |
| `webhooks.orders.create.tsx` / `.cancelled.tsx` | Order enqueue | Keep; needs order-line facts |
| `webhooks.refunds.create.tsx` | Refund enqueue | Keep |
| `webhooks.inventory_levels.update.tsx` | Inventory enqueue | Keep |
| `webhooks.compliance.tsx` | GDPR topics (new Phase 0) | Keep stub; full redaction Phase 1 |

## Services / jobs

| Module | Purpose | Disposition |
|---|---|---|
| `forecasting.server.ts` | Velocity, ROP, ABC, alerts | Rewrite (Phase 2) — characterization locked |
| `landed-cost.server.ts` | Allocation, receivePartialPO | Refactor — shop-blind internals remain risk |
| `shopify-gql.server.ts` | Throttled GraphQL helper | Keep concept; validate ops |
| `shopify-sync.server.ts` | Bulk sync, inventory adjust, transfers, billing mutation | Keep; write paths gated at routes |
| `jobs/queue.server.ts` + workers | BullMQ webhooks, ABC cron, catalog sync | Keep; need dead-letter / sync-run tables |
| `lib/feature-flags.server.ts` | Inventory write kill switches | Keep |
| `lib/po-display.ts` | Display helpers | Keep (Number money — Phase 1 decimal) |

## Hard caps observed

- Buying Table mappings: `take: 50`
- Stocktake / PO / transfer variant pickers: `take: 250`
- PO list: `take: 50`
- Transfer list: `take: 50`

## POS / Flow / extensions

- `extensions/` present as scaffold only — no POS UI extension implementing receiving/count/transfer (F-061, F-112 missing).
