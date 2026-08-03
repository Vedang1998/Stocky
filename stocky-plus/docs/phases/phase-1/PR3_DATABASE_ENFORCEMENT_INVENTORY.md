# PR 3 — Database Enforcement Inventory

**Phase:** 1
**Work unit:** PR 3 — Database enforcement
**Branch:** `phase-1/tenant-enforcement`
**Generator:** `scripts/tenant-enforcement/inventory.ts` (deterministic)
**Content digest:** `bf054868d2d7f3ea`
**Merchant-owned tables:** 18
**Bootstrap tables:** 2
**Control/maintenance tables:** 4
**Composite parent keys:** 18
**Composite foreign keys:** 8

> This file is mechanically generated. Do not edit by hand.
> Regenerate with `npm run tenant:enforcement:inventory`.
> CI verifies freshness via `npm run tenant:enforcement:inventory:check`.

## Classification rules

| Class | RLS | Runtime DML | Notes |
|---|---|---|---|
| merchant_domain | ENABLE + FORCE | SELECT/INSERT/UPDATE/DELETE under tenant context | Default-deny without context |
| bootstrap | No merchant RLS | Narrow Session/Shop grants | Must not become general bypass |
| control_maintenance | No | None (migration/maintenance only) | Backfill + ownership quarantine |

## Bootstrap tables

| Prisma model | SQL table | Legacy shop | Bootstrap exemption | Expected runtime privileges | Notes |
|---|---|---|---|---|---|
| Session | `Session` | yes | yes | SELECT/INSERT/UPDATE/DELETE | Shopify Prisma session-storage adapter; no shopId; no merchant RLS |
| Shop | `Shop` | no | yes | SELECT/INSERT/UPDATE | Canonical tenant identity; bootstrap lookup/upsert; not merchant-domain RLS |

## Control / maintenance tables

| Prisma model | SQL table | Runtime privileges | Notes |
|---|---|---|---|
| TenantBackfillRun | `TenantBackfillRun` | none | PR 1 backfill journal — migration/maintenance only |
| TenantBackfillCheckpoint | `TenantBackfillCheckpoint` | none | PR 1 backfill checkpoints — migration/maintenance only |
| TenantOwnershipIssue | `TenantOwnershipIssue` | none | Ownership quarantine — migration/maintenance only |
| TenantOwnershipIssueDetection | `TenantOwnershipIssueDetection` | none | Immutable detection history — migration/maintenance only |

## Merchant-owned tables

| Prisma model | SQL table | shopId nullability | Legacy shop | Parents | Children | Cross-domain | Existing (shopId,id) | Required composite key | Required composite FKs | Ownership diagnostics | RLS | Immutability trigger | Bootstrap exemption | Runtime privileges | Enforcement step | Rollback/forward recovery | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Supplier | `Supplier` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | SupplierSkuMapping, VolumePriceTier, LeadTimeSnapshot, PurchaseOrder | — | `Supplier_shopId_id_key` (PR1) | `Supplier_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_Supplier_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| PurchaseOrder | `PurchaseOrder` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | Supplier | POLineItem, LeadTimeSnapshot | Supplier | `PurchaseOrder_shopId_id_key` (PR1) | `PurchaseOrder_shopId_id_key` | `PurchaseOrder_shopId_supplierId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_PurchaseOrder_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| ShopifyVariantCache | `ShopifyVariantCache` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `ShopifyVariantCache_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_ShopifyVariantCache_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| InventorySnapshot | `InventorySnapshot` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `InventorySnapshot_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_InventorySnapshot_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| VariantAbcClass | `VariantAbcClass` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `VariantAbcClass_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_VariantAbcClass_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| ForecastOverride | `ForecastOverride` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `ForecastOverride_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_ForecastOverride_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| SalesDailyAggregate | `SalesDailyAggregate` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `SalesDailyAggregate_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_SalesDailyAggregate_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| ShopSettings | `ShopSettings` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `ShopSettings_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_ShopSettings_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| TransferOrder | `TransferOrder` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | TransferLineItem | — | `TransferOrder_shopId_id_key` (PR1) | `TransferOrder_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_TransferOrder_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| Stocktake | `Stocktake` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | StocktakeLineItem | — | `Stocktake_shopId_id_key` (PR1) | `Stocktake_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_Stocktake_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| BomComponent | `BomComponent` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `BomComponent_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_BomComponent_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| LowStockAlert | `LowStockAlert` | nullable in Prisma (DB NOT NULL after enforcement) | `shop` | — | — | — | compatibility shopId idx only | `LowStockAlert_shopId_id_key` | — | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_LowStockAlert_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| SupplierSkuMapping | `SupplierSkuMapping` | nullable in Prisma (DB NOT NULL after enforcement) | — | Supplier | — | — | compatibility shopId idx only | `SupplierSkuMapping_shopId_id_key` | `SupplierSkuMapping_shopId_supplierId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_SupplierSkuMapping_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| VolumePriceTier | `VolumePriceTier` | nullable in Prisma (DB NOT NULL after enforcement) | — | Supplier | — | — | compatibility shopId idx only | `VolumePriceTier_shopId_id_key` | `VolumePriceTier_shopId_supplierId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_VolumePriceTier_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| LeadTimeSnapshot | `LeadTimeSnapshot` | nullable in Prisma (DB NOT NULL after enforcement) | — | Supplier | — | PurchaseOrder | compatibility shopId idx only | `LeadTimeSnapshot_shopId_id_key` | `LeadTimeSnapshot_shopId_supplierId_fkey`, `LeadTimeSnapshot_shopId_purchaseOrderId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_LeadTimeSnapshot_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| POLineItem | `POLineItem` | nullable in Prisma (DB NOT NULL after enforcement) | — | PurchaseOrder | — | — | compatibility shopId idx only | `POLineItem_shopId_id_key` | `POLineItem_shopId_purchaseOrderId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_POLineItem_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| TransferLineItem | `TransferLineItem` | nullable in Prisma (DB NOT NULL after enforcement) | — | TransferOrder | — | — | compatibility shopId idx only | `TransferLineItem_shopId_id_key` | `TransferLineItem_shopId_transferOrderId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_TransferLineItem_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |
| StocktakeLineItem | `StocktakeLineItem` | nullable in Prisma (DB NOT NULL after enforcement) | — | Stocktake | — | — | compatibility shopId idx only | `StocktakeLineItem_shopId_id_key` | `StocktakeLineItem_shopId_stocktakeId_fkey` | zero-null + zero OPEN quarantine + parent/cross-domain match | yes (FORCE) | `trg_StocktakeLineItem_shopId_immutable` | no | SELECT/INSERT/UPDATE/DELETE | non-null → composite key → composite FK → RLS → trigger | reverse RLS/policies only with incident auth; constraints forward-recover | db-isolation + RLS matrix |

## Composite parent keys (`shopId`, `id`)

| Name | Table | Columns |
|---|---|---|
| `Supplier_shopId_id_key` | `Supplier` | (shopId, id) |
| `PurchaseOrder_shopId_id_key` | `PurchaseOrder` | (shopId, id) |
| `ShopifyVariantCache_shopId_id_key` | `ShopifyVariantCache` | (shopId, id) |
| `InventorySnapshot_shopId_id_key` | `InventorySnapshot` | (shopId, id) |
| `VariantAbcClass_shopId_id_key` | `VariantAbcClass` | (shopId, id) |
| `ForecastOverride_shopId_id_key` | `ForecastOverride` | (shopId, id) |
| `SalesDailyAggregate_shopId_id_key` | `SalesDailyAggregate` | (shopId, id) |
| `ShopSettings_shopId_id_key` | `ShopSettings` | (shopId, id) |
| `TransferOrder_shopId_id_key` | `TransferOrder` | (shopId, id) |
| `Stocktake_shopId_id_key` | `Stocktake` | (shopId, id) |
| `BomComponent_shopId_id_key` | `BomComponent` | (shopId, id) |
| `LowStockAlert_shopId_id_key` | `LowStockAlert` | (shopId, id) |
| `SupplierSkuMapping_shopId_id_key` | `SupplierSkuMapping` | (shopId, id) |
| `VolumePriceTier_shopId_id_key` | `VolumePriceTier` | (shopId, id) |
| `LeadTimeSnapshot_shopId_id_key` | `LeadTimeSnapshot` | (shopId, id) |
| `POLineItem_shopId_id_key` | `POLineItem` | (shopId, id) |
| `TransferLineItem_shopId_id_key` | `TransferLineItem` | (shopId, id) |
| `StocktakeLineItem_shopId_id_key` | `StocktakeLineItem` | (shopId, id) |

## Composite tenant foreign keys

| Name | Child | Columns | Parent | Parent columns | ON DELETE | Purpose |
|---|---|---|---|---|---|---|
| `SupplierSkuMapping_shopId_supplierId_fkey` | `SupplierSkuMapping` | (shopId, supplierId) | `Supplier` | (shopId, id) | CASCADE | child_parent |
| `VolumePriceTier_shopId_supplierId_fkey` | `VolumePriceTier` | (shopId, supplierId) | `Supplier` | (shopId, id) | CASCADE | child_parent |
| `LeadTimeSnapshot_shopId_supplierId_fkey` | `LeadTimeSnapshot` | (shopId, supplierId) | `Supplier` | (shopId, id) | CASCADE | child_parent |
| `POLineItem_shopId_purchaseOrderId_fkey` | `POLineItem` | (shopId, purchaseOrderId) | `PurchaseOrder` | (shopId, id) | CASCADE | child_parent |
| `TransferLineItem_shopId_transferOrderId_fkey` | `TransferLineItem` | (shopId, transferOrderId) | `TransferOrder` | (shopId, id) | CASCADE | child_parent |
| `StocktakeLineItem_shopId_stocktakeId_fkey` | `StocktakeLineItem` | (shopId, stocktakeId) | `Stocktake` | (shopId, id) | CASCADE | child_parent |
| `PurchaseOrder_shopId_supplierId_fkey` | `PurchaseOrder` | (shopId, supplierId) | `Supplier` | (shopId, id) | NO ACTION | cross_domain |
| `LeadTimeSnapshot_shopId_purchaseOrderId_fkey` | `LeadTimeSnapshot` | (shopId, purchaseOrderId) | `PurchaseOrder` | (shopId, id) | NO ACTION | secondary_lineage |

## Per-table enforcement artifacts

| Table | NOT NULL check | Shop FK | Composite key | RLS policies | Immutability trigger |
|---|---|---|---|---|---|
| `Supplier` | `Supplier_shopId_not_null` | `Supplier_shopId_fkey_shop` | `Supplier_shopId_id_key` | `Supplier_tenant_select`, `Supplier_tenant_insert`, `Supplier_tenant_update`, `Supplier_tenant_delete` | `trg_Supplier_shopId_immutable` |
| `PurchaseOrder` | `PurchaseOrder_shopId_not_null` | `PurchaseOrder_shopId_fkey_shop` | `PurchaseOrder_shopId_id_key` | `PurchaseOrder_tenant_select`, `PurchaseOrder_tenant_insert`, `PurchaseOrder_tenant_update`, `PurchaseOrder_tenant_delete` | `trg_PurchaseOrder_shopId_immutable` |
| `ShopifyVariantCache` | `ShopifyVariantCache_shopId_not_null` | `ShopifyVariantCache_shopId_fkey_shop` | `ShopifyVariantCache_shopId_id_key` | `ShopifyVariantCache_tenant_select`, `ShopifyVariantCache_tenant_insert`, `ShopifyVariantCache_tenant_update`, `ShopifyVariantCache_tenant_delete` | `trg_ShopifyVariantCache_shopId_immutable` |
| `InventorySnapshot` | `InventorySnapshot_shopId_not_null` | `InventorySnapshot_shopId_fkey_shop` | `InventorySnapshot_shopId_id_key` | `InventorySnapshot_tenant_select`, `InventorySnapshot_tenant_insert`, `InventorySnapshot_tenant_update`, `InventorySnapshot_tenant_delete` | `trg_InventorySnapshot_shopId_immutable` |
| `VariantAbcClass` | `VariantAbcClass_shopId_not_null` | `VariantAbcClass_shopId_fkey_shop` | `VariantAbcClass_shopId_id_key` | `VariantAbcClass_tenant_select`, `VariantAbcClass_tenant_insert`, `VariantAbcClass_tenant_update`, `VariantAbcClass_tenant_delete` | `trg_VariantAbcClass_shopId_immutable` |
| `ForecastOverride` | `ForecastOverride_shopId_not_null` | `ForecastOverride_shopId_fkey_shop` | `ForecastOverride_shopId_id_key` | `ForecastOverride_tenant_select`, `ForecastOverride_tenant_insert`, `ForecastOverride_tenant_update`, `ForecastOverride_tenant_delete` | `trg_ForecastOverride_shopId_immutable` |
| `SalesDailyAggregate` | `SalesDailyAggregate_shopId_not_null` | `SalesDailyAggregate_shopId_fkey_shop` | `SalesDailyAggregate_shopId_id_key` | `SalesDailyAggregate_tenant_select`, `SalesDailyAggregate_tenant_insert`, `SalesDailyAggregate_tenant_update`, `SalesDailyAggregate_tenant_delete` | `trg_SalesDailyAggregate_shopId_immutable` |
| `ShopSettings` | `ShopSettings_shopId_not_null` | `ShopSettings_shopId_fkey_shop` | `ShopSettings_shopId_id_key` | `ShopSettings_tenant_select`, `ShopSettings_tenant_insert`, `ShopSettings_tenant_update`, `ShopSettings_tenant_delete` | `trg_ShopSettings_shopId_immutable` |
| `TransferOrder` | `TransferOrder_shopId_not_null` | `TransferOrder_shopId_fkey_shop` | `TransferOrder_shopId_id_key` | `TransferOrder_tenant_select`, `TransferOrder_tenant_insert`, `TransferOrder_tenant_update`, `TransferOrder_tenant_delete` | `trg_TransferOrder_shopId_immutable` |
| `Stocktake` | `Stocktake_shopId_not_null` | `Stocktake_shopId_fkey_shop` | `Stocktake_shopId_id_key` | `Stocktake_tenant_select`, `Stocktake_tenant_insert`, `Stocktake_tenant_update`, `Stocktake_tenant_delete` | `trg_Stocktake_shopId_immutable` |
| `BomComponent` | `BomComponent_shopId_not_null` | `BomComponent_shopId_fkey_shop` | `BomComponent_shopId_id_key` | `BomComponent_tenant_select`, `BomComponent_tenant_insert`, `BomComponent_tenant_update`, `BomComponent_tenant_delete` | `trg_BomComponent_shopId_immutable` |
| `LowStockAlert` | `LowStockAlert_shopId_not_null` | `LowStockAlert_shopId_fkey_shop` | `LowStockAlert_shopId_id_key` | `LowStockAlert_tenant_select`, `LowStockAlert_tenant_insert`, `LowStockAlert_tenant_update`, `LowStockAlert_tenant_delete` | `trg_LowStockAlert_shopId_immutable` |
| `SupplierSkuMapping` | `SupplierSkuMapping_shopId_not_null` | `SupplierSkuMapping_shopId_fkey_shop` | `SupplierSkuMapping_shopId_id_key` | `SupplierSkuMapping_tenant_select`, `SupplierSkuMapping_tenant_insert`, `SupplierSkuMapping_tenant_update`, `SupplierSkuMapping_tenant_delete` | `trg_SupplierSkuMapping_shopId_immutable` |
| `VolumePriceTier` | `VolumePriceTier_shopId_not_null` | `VolumePriceTier_shopId_fkey_shop` | `VolumePriceTier_shopId_id_key` | `VolumePriceTier_tenant_select`, `VolumePriceTier_tenant_insert`, `VolumePriceTier_tenant_update`, `VolumePriceTier_tenant_delete` | `trg_VolumePriceTier_shopId_immutable` |
| `LeadTimeSnapshot` | `LeadTimeSnapshot_shopId_not_null` | `LeadTimeSnapshot_shopId_fkey_shop` | `LeadTimeSnapshot_shopId_id_key` | `LeadTimeSnapshot_tenant_select`, `LeadTimeSnapshot_tenant_insert`, `LeadTimeSnapshot_tenant_update`, `LeadTimeSnapshot_tenant_delete` | `trg_LeadTimeSnapshot_shopId_immutable` |
| `POLineItem` | `POLineItem_shopId_not_null` | `POLineItem_shopId_fkey_shop` | `POLineItem_shopId_id_key` | `POLineItem_tenant_select`, `POLineItem_tenant_insert`, `POLineItem_tenant_update`, `POLineItem_tenant_delete` | `trg_POLineItem_shopId_immutable` |
| `TransferLineItem` | `TransferLineItem_shopId_not_null` | `TransferLineItem_shopId_fkey_shop` | `TransferLineItem_shopId_id_key` | `TransferLineItem_tenant_select`, `TransferLineItem_tenant_insert`, `TransferLineItem_tenant_update`, `TransferLineItem_tenant_delete` | `trg_TransferLineItem_shopId_immutable` |
| `StocktakeLineItem` | `StocktakeLineItem_shopId_not_null` | `StocktakeLineItem_shopId_fkey_shop` | `StocktakeLineItem_shopId_id_key` | `StocktakeLineItem_tenant_select`, `StocktakeLineItem_tenant_insert`, `StocktakeLineItem_tenant_update`, `StocktakeLineItem_tenant_delete` | `trg_StocktakeLineItem_shopId_immutable` |

## Schema verification note

Merchant coverage was compared to `app/tenant/models.ts` and `prisma/schema.prisma` on the PR 3 starting main. Count = **18**. Session, Shop, and the four tenant-backfill control tables are classified above and are **not** merchant-domain RLS targets.
