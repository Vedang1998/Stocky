# PR 1 — Tenant Ownership Inventory

**Phase:** 1  
**Work unit:** PR 1 — Tenant expansion and backfill  
**Branch:** `phase-1/tenant-expand`  
**Normalization:** `phase1-shop-domain-v1`  
**Status:** Implemented (nullable ownership only; no enforcement)

## Session (bootstrap exception — not migrated)

| Field | Value |
|---|---|
| Model | `Session` |
| Ownership source | Legacy `shop` string (Shopify session storage) |
| Direct / child | N/A — restricted bootstrap / session-storage adapter |
| Legacy `shop` | Present (required by Shopify Prisma session-storage adapter) |
| Nullable `shopId` | **Not added** in PR 1 |
| Index plan | Unchanged |
| Backfill order | Not backfilled; may be read as domain evidence during diagnostics only |
| Cross-domain checks | Distinct `Session.shop` values feed Shop discovery after normalization |
| Issue reason codes | `INVALID_SHOP_DOMAIN` when Session.shop fails normalization |
| Future PR 3 constraint | Remains bootstrap exception; not an RLS merchant-domain table in the same sense |
| RLS candidate | No (bootstrap path; PR 2/3 define restricted access) |
| Unresolved design | Session must stay schema-compatible with `@shopify/shopify-app-session-storage-prisma` |

## Merchant-owned models

| Model | Ownership source | Direct/child | Parent | Legacy `shop` | Nullable `shopId` | Index plan | Backfill order | Cross-domain checks | Issue codes | Future PR 3 target | RLS candidate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Supplier | Own legacy `shop` | Direct | — | Yes | Yes | `shopId`; unique `(shopId,id)` | 1 | — | INVALID_SHOP_DOMAIN, EXISTING_SHOP_ID_MISMATCH, CONFLICTING_NORMALIZED_DOMAIN | NOT NULL + composite FK target | Yes |
| PurchaseOrder | Own legacy `shop` | Direct | — | Yes | Yes | `shopId`; unique `(shopId,id)` | 2 | vs Supplier.shop | + PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH | NOT NULL + composite FK target | Yes |
| ShopifyVariantCache | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 3 | — | INVALID_*, EXISTING_*, CONFLICTING_* | NOT NULL + tenant uniques | Yes |
| InventorySnapshot | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 4 | — | same | NOT NULL + tenant uniques | Yes |
| VariantAbcClass | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 5 | — | same | NOT NULL + tenant uniques | Yes |
| ForecastOverride | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 6 | — | same | NOT NULL + tenant uniques | Yes |
| SalesDailyAggregate | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 7 | — | same | NOT NULL + tenant uniques | Yes |
| ShopSettings | Own legacy `shop` | Direct | — | Yes (unique) | Yes | `shopId` | 8 | duplicate normalized tenants | + DUPLICATE_SHOP_SETTINGS_TENANT | NOT NULL + unique shopId | Yes |
| TransferOrder | Own legacy `shop` | Direct | — | Yes | Yes | `shopId`; unique `(shopId,id)` | 9 | — | INVALID_*, EXISTING_*, CONFLICTING_* | NOT NULL + composite FK target | Yes |
| Stocktake | Own legacy `shop` | Direct | — | Yes | Yes | `shopId`; unique `(shopId,id)` | 10 | — | same | NOT NULL + composite FK target | Yes |
| BomComponent | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 11 | — | same | NOT NULL + tenant uniques | Yes |
| LowStockAlert | Own legacy `shop` | Direct | — | Yes | Yes | `shopId` | 12 | — | same | NOT NULL + tenant indexes | Yes |
| SupplierSkuMapping | Verified parent only | Child | Supplier | No | Yes | `shopId`; `(shopId,supplierId)` | 13 | parent shopId match | MISSING_PARENT, PARENT_SHOP_UNRESOLVED, PARENT_CHILD_SHOP_MISMATCH | composite FK `(shopId,supplierId)` | Yes |
| VolumePriceTier | Verified parent only | Child | Supplier | No | Yes | `shopId`; `(shopId,supplierId)` | 14 | same | same | composite FK | Yes |
| LeadTimeSnapshot | Verified parent Supplier; also PO checks | Child | Supplier | No | Yes | `shopId`; `(shopId,supplierId)` | 15 | supplier vs PO | + LEAD_TIME_PURCHASE_ORDER_MISSING, LEAD_TIME_PURCHASE_ORDER_SHOP_MISMATCH | composite FK; optional PO tenant check | Yes |
| POLineItem | Verified parent only | Child | PurchaseOrder | No | Yes | `shopId`; `(shopId,purchaseOrderId)` | 16 | parent shopId match | MISSING_PARENT, PARENT_SHOP_UNRESOLVED, PARENT_CHILD_SHOP_MISMATCH | composite FK | Yes |
| TransferLineItem | Verified parent only | Child | TransferOrder | No | Yes | `shopId`; `(shopId,transferOrderId)` | 17 | same | same | composite FK | Yes |
| StocktakeLineItem | Verified parent only | Child | Stocktake | No | Yes | `shopId`; `(shopId,stocktakeId)` | 18 | same | same | composite FK | Yes |

## Control models (not merchant-facing)

| Model | Purpose |
|---|---|
| Shop | Canonical tenant identity (`id`, `myshopifyDomain`) |
| TenantBackfillRun | Durable backfill run journal |
| TenantBackfillCheckpoint | Per-run/table cursor + counts |
| TenantOwnershipIssue | Quarantine / diagnostic issues |

## Schema comparison note

Before implementation, the approved 18-model list was compared to `prisma/schema.prisma` on `main@8ccc8d29`. Every merchant-owned model matched. No additional merchant-owned models were found. `Session` is intentionally excluded.
