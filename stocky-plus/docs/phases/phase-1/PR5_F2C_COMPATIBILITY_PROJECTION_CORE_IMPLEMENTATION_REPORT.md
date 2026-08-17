# Phase 1 PR5-F2C — Compatibility Projection Core Implementation Report

**Slice:** PR5-F2C compatibility-projection CORE
**Branch:** `cursor/pr5-f2c-compat-projection-core-7c2d`
**Authority:** D-054 **EFFECTIVE**; PR5-F1 **FROZEN**
**Status:** Implementation complete — pending independent verification
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**PR 5 overall:** IN PROGRESS (this lane does **not** complete PR 5)
**Integration with F2B:** NOT STARTED / FORBIDDEN in this lane

This report records the isolated compatibility-projection core. It does **not** claim PR 5 is complete, does **not** close R-142 / R-145 / R-156, does **not** start F2B integration, and does **not** migrate legacy consumers.

Exact-head GitHub Actions CI is recorded from the live `pull_request` workflow after push. This file does not embed an unknown future commit SHA.

---

## 1. Verified main / authorized base

| Field | Value |
|---|---|
| Authorized starting SHA | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| `origin/main` at branch creation | `5129707ee684e66cadcf96b976e16eb57385a7cb` |
| Branch created from that SHA | `cursor/pr5-f2c-compat-projection-core-7c2d` |
| Runtime / test implementation commit | `4c346fc418e1fea7f4113e1e9b2337dd7a371aa9` |

Working tree was clean on the authorized SHA before implementation. No schema or migration files changed.

---

## 2. Scope implemented

Isolated module: `stocky-plus/app/lib/catalog-facts/compatibility-projection/**`

Public entry: `projectCompatibilityFromCanonicalFacts`.

The F1 barrel `app/lib/catalog-facts/index.ts` is **not** modified. This core is not re-exported from the frozen foundation barrel.

### 2.1 What this core does

- Reads canonical `ShopifyProductFact` / `ShopifyVariantFact` / `ShopifyInventoryItemFact` / `ShopifyLocationFact` / `ShopifyInventoryLevelFact` through `createTenantDb(authority)`.
- Maps those facts onto the exact legacy fields consumed today by Buying Table, warehouse barcode lookup, stocktake completion, forecast `onHand`, catalog ingest, and the inventory webhook snapshot writer.
- Writes `ShopifyVariantCache` and today's `InventorySnapshot` through TenantDb (default writer) or an injected test writer.
- Supports `mode: "identities"` and bounded `mode: "shop_rebuild"` with an explicit cursor.
- Returns a structured result/status for a later F2B integration lane. That later lane — **not this one** — must persist `compatibilityProjectionState` using F2B's accepted canonical writer contract.

### 2.2 What this core deliberately does not do

- Does **not** update canonical `compatibilityProjectionState`.
- Does **not** invent a canonical writer transaction helper.
- Does **not** join a caller's canonical transaction. It always opens its own TenantDb from the supplied authority so a projection failure cannot `ROLLBACK` canonical facts.
- Does **not** integrate into a canonical applicator.
- Does **not** migrate routes/UI consumers.
- Does **not** call forecast, ABC, or `LowStockAlert` logic.
- Does **not** perform GraphQL, Shopify network I/O, webhook handling, JSONL ingest, worker/scheduler wiring, schema/migration, production access, or inventory-write flag changes.

Result contract always includes:

- `canonicalFactsUnchanged: true`
- `canonicalCompatibilityProjectionStateWrite: "omitted_by_f2c_lane"`
- `recommendedCanonicalProjectionState: "HEALTHY" | "DEGRADED"` for the later integration lane

---

## 3. Projection mappings

Canonical truth always wins. The projection is a rebuildable derived read model, not a second source of authority.

### 3.1 `ShopifyVariantCache` (matches current `ingestBulkVariantCache`)

| Legacy field | Canonical source |
|---|---|
| `shop` / `shopId` | TenantDb authority injection (`myshopifyDomain` / `shopId`) |
| `shopifyVariantId` | `ShopifyVariantFact.shopifyGid` |
| `shopifyProductId` | `ShopifyVariantFact.shopifyProductGid` |
| `title` | `Product.title — Variant.title` when the product is `LIVE`; otherwise variant title only |
| `sku` | `ShopifyVariantFact.sku` |
| `barcode` | `ShopifyVariantFact.barcode` |
| `imageUrl` | `ShopifyProductFact.featuredMediaUrl` only when the product is `LIVE` |
| `inventoryItemId` | lexicographically first `LIVE` inventory item GID |
| `weight` | that item's `weightValue`, quantized to 4 decimal places; fail-closed if `abs >= 1000000` (`DECIMAL(10, 4)`) |
| `weightUnit` | that item's `weightUnit` |

`ABSENT` variant → **delete** the cache row and neutralize **today's** `InventorySnapshot.quantityAvailable` to `0` for every location that already has a snapshot for that variant. This keeps forecast `findFirst orderBy snapshotDate desc` from treating yesterday as live on-hand.

A tombstoned product does **not** supply live title or image for a still-`LIVE` variant.

### 3.2 `InventorySnapshot` (today only; matches current inventory webhook)

| Legacy field | Canonical source |
|---|---|
| `shopifyVariantId` | `ShopifyInventoryItemFact.shopifyVariantGid` |
| `locationId` | `ShopifyInventoryLevelFact.locationGid` (GID form, same as the webhook writer) |
| `snapshotDate` | process-local start of calendar day (`setHours(0,0,0,0)`), matching `webhook-processor` |
| `quantityAvailable` | canonical `availableQuantity ?? 0` only when the level, location, item, **and** variant are all `LIVE` |

Otherwise today's snapshot is written as `0`. A tombstone, disconnect, or non-live parent must not masquerade as live available quantity.

If the inventory item has no `shopifyVariantGid`, snapshot mapping is skipped (the current webhook also cannot resolve a variant and returns early).

Historical snapshot rows are not rewritten except for the today-zero neutralization on variant tombstone.

### 3.3 Request / result contract

```ts
projectCompatibilityFromCanonicalFacts({
  authority,                 // TenantAuthority; shop is derived server-side
  processingEnabled: true,   // caller-supplied uninstall/disable gate
  now?,
  limit?,                    // default 32, max 100
  writer?,                   // test seam only
  mode: "identities" | "shop_rebuild",
  identities? / cursor?,
})
```

| Status | Meaning | Retryable |
|---|---|---|
| `SUCCEEDED` | processed identities/page; `hasMore` / `cursor` / `remainingIdentities` describe continuation | `false` for the completed page |
| `FAILED` | explicit `failure.code` / `failure.message`; remaining work is in the result | DB/write failures `true`; invalid limit / malformed cursor / weight overflow `false` |
| `DENIED_PROCESSING_DISABLED` | `processingEnabled !== true`; no TenantDb open; no merchant writes | `false` |

This core does **not** read `Shop` / control-plane. The future F2B/worker caller must pass the live `processingEnabled` flag. Missing canonical identity is `retryable: true` (`canonical_variant_missing` / `canonical_inventory_level_missing`) so a later retry can wait for the applicator.

Shop rebuild cursor:

1. `phase: "variants"` ordered by `shopifyGid`
2. `phase: "inventory_levels"` ordered by `(inventoryItemGid, locationGid)`

---

## 4. Files changed

Runtime / tests / CI / tenant-access registration (commit `4c346fc418e1fea7f4113e1e9b2337dd7a371aa9`):

- `stocky-plus/app/lib/catalog-facts/compatibility-projection/**` (new isolated module + unit tests)
- `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` (recursive module scan so nested F2C files are included; does **not** close R-163)
- `stocky-plus/app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts` (`issueTenantAuthority` is restricted to `app/tenant/`)
- `stocky-plus/scripts/tenant-access/allowlist.ts` (append-only new EX-TEST path)
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (regenerated; 0 violations)
- `stocky-plus/package.json` (`test:pr5-f2c-projection`, `test:pr5-f2c-projection-db`, both `--passWithNoTests=false`)
- `.github/workflows/ci.yml` (focused TenantDb step before other tenant tests; focused unit step before aggregate `npm test`)

This documentation file is a subsequent commit and is not part of the runtime implementation SHA above.

No Prisma schema, migration, GraphQL document, Shopify TOML, feature-flag, route, or UI file changed.

---

## 5. Tests

Required scenarios and where they live:

| Requirement | Evidence |
|---|---|
| Canonical variant → legacy cache | unit `mapping.test.ts`; DB `projects a live canonical variant onto ShopifyVariantCache` |
| Inventory quantities → legacy snapshot | unit + DB `projects canonical available quantity onto today's InventorySnapshot` |
| Idempotent repeat | DB `is idempotent when the same identities are projected twice` |
| Canonical newer value replaces old projection | DB `lets a newer canonical value replace a stale legacy projection` |
| Tombstoned canonical resource does not masquerade as live legacy truth | unit + DB tombstone/disconnect cases |
| Projection failure leaves canonical facts untouched | DB fingerprint of product/variant/item/level including `updatedAt` and `compatibilityProjectionState` |
| Retry repairs legacy data | DB `repairs stale legacy rows on retry after a failed projection` |
| Bounded rebuild | DB `rebuilds a shop catalog in bounded pages` (`limit: 2`) |
| Cross-shop isolation | DB shop A rebuild cannot see/write shop B; shop A identity for B's GID fails `canonical_variant_missing`; shop B authority then writes only B |
| No forecast / ABC / LowStockAlert writes | DB counts remain 0; source scan forbids those identifiers |
| No Shopify network / mutation | source scan forbids `fetch(`, GraphQL clients, `inventoryAdjustQuantities`, bulk ops |
| No `compatibilityProjectionState` write | source scan + DB assertion that the column is unchanged on success and failure |
| `processingEnabled=false` fail-closed | unit (no TenantDb) + DB (no cache rows) |
| Invalid batch limit | unit `invalid_batch_limit`, non-retryable |
| Legacy consumer field characterization | `legacy-consumer-characterization.test.ts` (does **not** migrate consumers) |

Focused commands executed on the implementation worktree (disposable PostgreSQL 16.14 + Redis; inventory-write flags false; `STOCKY_RUNTIME_ROLE=stocky_runtime`):

| Command | Result |
|---|---|
| `npm run test:pr5-f2c-projection` | 4 files, **23** tests passed |
| `npm run test:pr5-f2c-projection-db` | 1 file, **14** tests passed |
| `npx vitest run app/lib/catalog-facts/foundation-safety.test.ts` | 1 file, **3** tests passed |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run tenant:access:inventory` then `:check` | findings **1485**, violations **0**, inventory fresh |
| `git diff --check` | clean |

Full `npm run typecheck`, `npm test`, `npm run build`, and exact-head PR CI are recorded after this documentation commit is pushed. A command is evidence only for the exact code and environment on which it ran.

---

## 6. Safety / parallel-lane restrictions

- Projection never assigns `compatibilityProjectionState`.
- Projection never calls `shopify*Fact.create/update/upsert/delete`.
- Projection never imports `advisory-lock`, observation-generation, or a canonical identity lock helper.
- `createTenantDbLegacyWriter` writes only `shopifyVariantCache` and `inventorySnapshot`.
- Injected `writer` is a test seam so failure/retry can be proven without rolling back canonical rows.
- F2C does not race F2B over canonical writer semantics.

R-142, R-145, and R-156 remain **OPEN**. This core supplies the rebuildable projection and an explicit failure result. Merchant-durable `compatibilityProjectionState`, the diagnostic reconciler / `DataIssue` / `SyncHealth`, and later cleanup of duplicate legacy authority are other lanes.

---

## 7. Open dependencies

1. F2B accepted canonical writer contract, then a **separate** integration lane that:
   - runs this core after canonical apply commits;
   - persists `recommendedCanonicalProjectionState` onto canonical facts;
   - must not fold projection into the canonical transaction.
2. Caller-supplied live `processingEnabled` from the worker/uninstall control plane.
3. R-145 / R-156 diagnostic reconciler (`DataIssue` `COMPATIBILITY_PROJECTION_FAILED`, dual SyncHealth).
4. R-142 later cleanup of duplicate legacy authority; not PR 5.
5. Consumer migration off `ShopifyVariantCache` / `InventorySnapshot`; not this lane.
6. No PR 6, no production, no inventory-write enablement.

---

## 8. Explicit non-claims

- PR 5 is **not** complete.
- Phase 1 is **not** complete.
- Compatibility projection is **not** wired to catalog-sync, webhooks, or F2B.
- Buying Table / barcode / forecast surfaces are **not** claimed healthy in production.
- R-142 / R-145 / R-156 are **not** closed.
- Independent Claude review has **not** run at the time this file was first written.

---

## 9. Handoff

READY FOR CHATGPT PR5-F2C REVIEW after exact-head PR CI is green on the live draft PR head.

Do not merge. Do not mark ready. Do not integrate with F2B.
