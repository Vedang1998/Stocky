# Data Authority Map — Phase 0

**Branch:** `phase-0-product-alignment-v2`  
**Aligned to:** `docs/product/04_ARCHITECTURE_AND_BFS_PLAN.md` §5

| Domain | Authority (approved) | Current repository behavior | Gap |
|---|---|---|---|
| Products / variants | Shopify | Partial `ShopifyVariantCache` (title, sku, barcode, image, inventoryItemId, weight) | Missing vendor, price, Shopify cost, tracked flag, tags, status, location quantities |
| Sellable inventory states | Shopify | Live GraphQL reads + `InventorySnapshot` (available only) | GraphQL `inventoryLevel` query args invalid on Admin API 2025-10 (codegen failure); no on-hand/committed distinction in stocktake freeze |
| Orders / refunds | Shopify | Legacy webhooks enqueue → `SalesDailyAggregate` only (not PR6 source of record). PR6-A schema/security and PR6-B Admin READ plus PR6-C canonical applicator are **merged** at squash **V** (`a3ff480f…`). Intended unit-event ledger is `ShopifyOrderAgreementSaleFact`. **PR6-D complete webhook/import/reconcile integration is ADMITTED** on `phase-1/pr6-d-order-webhook-import` (not production, not live store calls, not live subscription registration). | Production order/line/refund fact runtime still absent until D lands and is independently reviewed, accepted, and merge-authorized. Refunds remain incomplete for production audits. |
| Product vendor | Shopify | Not synced into cache | F-016 gap |
| Supplier master | App | `Supplier` + mappings + tiers | Child tables lack denormalized `shop`; OK if parent always checked |
| Advanced PO ledger | App | `PurchaseOrder` / `POLineItem` | No versions, approvals, invoices, communication timeline |
| Incoming inventory | App (custom POs) until stable native API | Forecast incoming from open app POs only | No native PO reconciliation; dual-source risk undocumented in UI |
| Receipts / dispositions | App → sync to Shopify inventory | `receivePartialPO` updates app qty only | No Shopify write; no reject/extra/unreceive ledger; gated by `FEATURE_RECEIPT_WRITES` |
| Average / landed cost | App (+ optional Shopify cost sync) | Landed allocation on PO lines | No average-cost ledger; no cost sync mutation; `FEATURE_COST_SYNC` off |
| Stocktakes | App count ledger; Shopify after approved completion | App stocktake + gated `inventoryAdjustQuantities` | Uses available snapshot; no audit/idempotency; writes default OFF |
| Transfers | Prefer Shopify native when API supports; app mirrors | Custom `TransferOrder` + Shopify create/ready-to-ship; complete mutation **invalid** on 2025-10 schema | `FEATURE_TRANSFER_WRITES` off; GraphQL validation error on `inventoryTransferComplete` |
| Reports / forecasts | App derived facts | Aggregates + wrong parity formulas | Need fact foundation first |
| Roles | Shopify identity + app authorization | None | F-107 / F-108 missing |
| Billing / entitlements | Shopify App Pricing + app entitlement service | `subscriptionActive` Boolean + hardcoded plan handles | Insufficient; no AI credits/budgets |
| Compliance data | App retention policy | Compliance webhook stub acknowledges only | Full redact/export Phase 1 |

## Shopify write surfaces (current)

| Operation | Code path | Kill switch | Status |
|---|---|---|---|
| `inventoryAdjustQuantities` | Stocktake complete | `FEATURE_STOCKTAKE_INVENTORY_WRITES` | Default OFF; complete-on-failure fixed |
| `inventoryTransferCreate` / `ReadyToShip` | Transfer ship | `FEATURE_TRANSFER_WRITES` | Default OFF |
| `inventoryTransferComplete` | Transfer receive | `FEATURE_TRANSFER_WRITES` | Default OFF; **schema-invalid** on 2025-10 |
| Inventory item cost update | — | `FEATURE_COST_SYNC` | Not implemented |
| Receipt → inventory adjust | — | `FEATURE_RECEIPT_WRITES` | Not implemented (DB-only receive gated) |
