# Phase 1 Technical Plan — Additive Foundation

**Status:** Plan only — **not implemented** in Phase 0.  
**Prerequisite:** Claude Code accepts Phase 0 PR.

## Goals

Establish tenant-safe facts, sync observability, audit, roles scaffold, and entitlement/AI ledger foundations without enabling unsafe inventory writes.

## Additive Prisma migrations (proposed order)

1. **Shop** entity (`id`, `shopDomain`, `installedAt`, `uninstalledAt`, `scopes`, `timezone`, `currency`, billing pointers). Migrate string `shop` columns to `shopId` via backfill; keep domain unique.
2. **LocationCache** — Shopify locations with shop FK.
3. **Catalog expansion** on `ShopifyVariantCache` / new ProductCache — vendor, type, tags, status, price, compare-at, Shopify cost, tracked, option values, image, timestamps.
4. **InventoryState** / **InventoryFactEvent** — quantities by location + app-initiated write events (empty writers until gates pass).
5. **OrderFact** / **OrderLineFact** — snapshots (no unnecessary PII); refund/edit netting fields.
6. **SyncRun** / **JobDeadLetter** — topic, shopId, status, attempts, lastError, correlationId.
7. **AuditEvent** — actor, shopId, entity, action, before/after JSON, correlationId.
8. **RoleAssignment** / **PermissionGrant** — capability keys; enforce server-side later.
9. **SavedView** — module, JSON config, version.
10. **Receipt** / **ReceiptLine** / **ReceiptDisposition** foundations (no production writers).
11. **CostEvent** foundations (ordered/received/landed/average layers).
12. **EntitlementSnapshot** / **PlanVersion** / **UsageCounter** / **AiUsageEvent** — capability keys, limits, credits, provider cost; no unlimited AI.

All migrations: additive, reversible notes, tenant backfill strategy, no destructive drops of operational history.

## GraphQL / sync work

- Fix `inventoryLevel` query to current Admin API 2025-10 shape (or replace with validated alternative).
- Replace/remove `inventoryTransferComplete` until a supported mutation is documented and tested.
- Expand bulk product query fields; validate nested pagination assumptions.
- Codegen must pass in CI before claiming GraphQL readiness.
- Keep `expiringOfflineAccessTokens: true`.

## Entitlement architecture (design → partial scaffold)

Central server module (e.g. `entitlements.server.ts`):

- stable capability keys;
- plan versions (prices only in adapter/config, not scattered in business logic);
- numeric limits + usage;
- trial / freeze / cancel behaviors;
- AI allowance + provider-cost budget + global ceiling hooks;
- development test-plan handling via explicit config (not open UI bypass).

Wire checks into high-risk actions progressively; do not rely on UI hiding.

## Compliance

- Implement `customers/data_request`, `customers/redact`, `shop/redact` processors with HMAC already handled by `authenticate.webhook`.
- Uninstall: disable queues for shop immediately; schedule retention per Q-008.

## Tests required before claiming Phase 1 exit

- Cross-shop isolation for PO/stocktake/transfer/supplier children.
- Sync reconciliation fixture against Shopify payloads.
- Entitlement denial paths (route + worker).
- Characterization suite still green (or explicitly updated with decision record when behavior intentionally changes).
- GraphQL codegen green.

## Non-goals for Phase 1

- Buying Table formula rewrite (Phase 2).
- Enabling stocktake/receipt/transfer/cost writes in production.
- Smart forecasting / LLM features.
- Broad ERP modules unrelated to facts/sync/audit.

## Exact next step after Phase 0 merge

Open `phase-1-shop-facts-foundation` from updated `main`, land migration 1–6 + GraphQL inventoryLevel fix behind feature flags, with cross-shop tests — still leaving inventory write flags **OFF**.
