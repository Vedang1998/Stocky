# Code-to-Requirement Gap Map — Phase 0

**Branch:** `phase-0-product-alignment-v2`  
**Product SoT:** `docs/product/`  
**Verified against live code on main base `f1923ace` + Phase 0 safety patches.**

Disposition legend: **Keep** · **Refactor** · **Rewrite** · **Remove** · **Defer** · **Freeze**

| Area | Code | Feature IDs | Disposition | Data authority | Permissions / scopes | Tests | P0/P1 risks | Next owner |
|---|---|---|---|---|---|---|---|---|
| App shell | `app.tsx` | F-001 | Keep | Session | Embedded | None | P1 nav incomplete vs PRD | Cursor Phase 1–2 |
| Branding | dashboard / billing / README | F-131 | Refactor | — | — | None | P0 public Stocky++ remnants in README/SETUP/workers log | Product for public name |
| Catalog cache | `shopify-sync.server.ts` ingest | F-005, F-012, F-016 | Rewrite fields | Shopify | read_products | None | P0 missing vendor/price/cost/location qty | Cursor Phase 1 |
| Sales facts | `SalesDailyAggregate` only | F-006 | Rewrite | Shopify→app facts | read_orders | None | P0 insufficient for refunds/edits/deletes | Cursor Phase 1 |
| Forecast Last X | `forecasting.server.ts` | F-026 | Rewrite | App derived | — | Characterization (KNOWN-WRONG) | P0 OOS/LT/safety/30/14 formula | Cursor Phase 2 |
| Forecast other methods | — | F-027–F-031 | Missing | — | — | — | P0 | Cursor Phase 2–3 |
| ABC/U | `runAbcAnalysis` | F-040 | Rewrite | App derived | — | Characterization (KNOWN-WRONG) | P0 90-day, no U, boundary bug | Cursor Phase 2 |
| Buying Table | `app.buying-table.tsx` | F-039+ | Rebuild | Mixed | Premature Boolean | Char MOQ | P0 caps/N+1/MOQ/pack/gate | Cursor Phase 2 |
| Suppliers | routes + schema | F-017–F-024 | Refactor | App | — | None | P1 child shop columns | Cursor Phase 2 |
| PO lifecycle | `app.purchase-orders.tsx` | F-046–F-056 | Refactor→rewrite ledger | App | — | Char display | P0 money Number; incomplete lifecycle | Cursor Phase 3 |
| Receiving | PO + warehouse + landed-cost | F-057–F-064 | Freeze + rewrite | App→Shopify | write_inventory (unused) | Char receive fn | P0 no Shopify sync / dispositions | Cursor Phase 4 |
| Stocktakes | `app.stocktakes.tsx` | F-074–F-080 | Freeze | App→Shopify | write_inventory gated | Char safety | P0 available snapshot; incomplete contract | Cursor Phase 5 |
| Transfers | `app.transfers.tsx` + sync | F-081–F-082 | Freeze | Shopify+app | write_inventory gated | None | P0 invalid `inventoryTransferComplete` on 2025-10 | Cursor Phase 5 |
| Cost sync | — | F-067 | Missing | App→Shopify | write_products present | None | P0 scope without workflow | Cursor Phase 4 |
| Audit | — | F-008 | Missing | App | — | None | P0 | Cursor Phase 1 |
| Roles | — | F-107–F-108 | Missing | Shopify+app | — | None | P0 | Cursor Phase 1–3 |
| Billing | `app.billing.tsx` | F-127 | Rewrite | Shopify App Pricing | — | None | P1 Boolean + hardcoded prices | Cursor Phase 6 design in Phase 1 plan |
| AI | — | F-115–F-126 | Defer | — | — | None | P1 no credits/budgets; do not advertise unlimited AI | Phase 7 |
| Compliance webhooks | `webhooks.compliance.tsx` + toml | F-129 | Keep stub | App | — | None | P0 full redaction pending | Cursor Phase 1 |
| MMFO scopes | removed from toml/.env.example | — | Removed | — | — | — | Was unjustified | Done Phase 0 |
| POS extensions | `extensions/` scaffold | F-061, F-112 | Missing | — | — | None | P0 for floor workflows | Cursor Phase 4 |

## Required findings verification (Cursor master prompt)

| Claim | Verified? | Evidence |
|---|---|---|
| Default forecast 30/14 with LT/safety/OOS | **Yes** | `forecasting.server.ts` defaults; schema `ShopSettings`; `.env.example` |
| ABC 90 days + boundary/U issues | **Yes** | `runAbcAnalysis` −90 days; post-add cumulative; enum A/B/C only |
| Buying Table caps + N+1 | **Yes** | `take: 50`; per-mapping `fetchInventoryLevels` |
| Product sync missing fields | **Yes** | ingest sets title/sku/barcode/image/weight/inventoryItemId only |
| Stocktake complete despite failed writes | **Was true; fixed Phase 0** | Route now leaves `IN_PROGRESS` on failures; writes kill-switched |
| Schema lacks sales/receipt/audit facts | **Yes** | `prisma/schema.prisma` |
| Premature subscription gate | **Yes** | Buying Table Boolean; `devActivate` now env-guarded |
| Public name/branding review | **Yes** | README/SETUP still Stocky++; UI heading softened |

## Pricing / AI gap (Phase 0 audit)

| Topic | Current | Required |
|---|---|---|
| Plans | Hardcoded Essentials/Growth $29/$79 in route | Central entitlement service + versioned plan defs |
| Shopify billing | `appSubscriptionCreate` path present | Adapter mapping to entitlement versions |
| Gating | UI Boolean on Buying Table only | Server checks on routes/workers/exports/AI |
| Trial / downgrade / cancel | Not modeled | Explicit behaviors |
| AI credits / provider cost / global budget | Absent | Pre-call authorization + ledger |
| Unlimited AI | Not implemented (good) | Must never advertise |
| LLM in forecast/ABC | Absent (good) | Keep deterministic |
