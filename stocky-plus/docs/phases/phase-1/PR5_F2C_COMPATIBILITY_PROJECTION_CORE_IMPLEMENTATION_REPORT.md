# Phase 1 PR5-F2C — Compatibility Projection Core Implementation Report

**Slice:** PR5-F2C compatibility-projection CORE
**Branch:** `cursor/pr5-f2c-compat-projection-core-7c2d`
**Authority:** D-054 **EFFECTIVE**; PR5-F1 **FROZEN**
**Status:** Correction implemented — pending independent verification
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
| Lane-isolation revert commit | `4a7ca8a78ce33cae9a501cfa472f8fd4cf19196d` |
| Semantic-contract runtime/tests commit | `4acebccdd904ca53906109036b4577f60f9ab330` |

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
- `canonicalHealthDecision: "deferred_to_integration"`

This core does **not** expose `recommendedCanonicalProjectionState` or any other HEALTHY/DEGRADED recommendation. `status: "SUCCEEDED"` means only that this invocation's requested work completed. It is not merchant-global health, not proof a partial page is globally current, and not certification of shop-rebuild convergence.

---

## 3. Projection mappings

Canonical truth always wins. The projection is a rebuildable derived read model, not a second source of authority.

### 3.1 `ShopifyVariantCache` (matches current `ingestBulkVariantCache`)

| Legacy field | Canonical source |
|---|---|
| `shop` / `shopId` | TenantDb authority injection (`myshopifyDomain` / `shopId`) |
| `shopifyVariantId` | `ShopifyVariantFact.shopifyGid` |
| `shopifyProductId` | `ShopifyVariantFact.shopifyProductGid` |
| `title` | `Product.title — Variant.title` from the LIVE product relation. A LIVE variant whose product is missing or not LIVE fails closed (`canonical_product_not_live`, retryable) and does not overwrite an existing cache row. That graph is a brief-authorized delete-flow lag, not poisonHalt |
| `sku` | `ShopifyVariantFact.sku` |
| `barcode` | `ShopifyVariantFact.barcode` |
| `imageUrl` | `ShopifyProductFact.featuredMediaUrl` from the LIVE product relation; same `canonical_product_not_live` fail-closed path — F2C does not synthesize title/image or read legacy cache as authority |
| `inventoryItemId` | exactly one LIVE `ShopifyInventoryItemFact.shopifyInventoryItemGid` linked to the variant. Zero LIVE items preserve `inventoryItemId: null`. More than one LIVE item fails closed (`canonical_multiple_live_inventory_items`) without selecting either GID |
| `weight` | that item's `weightValue`, quantized to 4 decimal places; fail-closed if `abs >= 1000000` (`DECIMAL(10, 4)`) |
| `weightUnit` | that item's `weightUnit` |

`ABSENT` variant → **delete** the cache row and neutralize **today's** `InventorySnapshot.quantityAvailable` to `0` for every location that already has a snapshot for that variant. This keeps forecast `findFirst orderBy snapshotDate desc` from treating yesterday as live on-hand.

A tombstoned or missing product does **not** supply live title or image for a still-`LIVE` variant. That path now fails closed (`canonical_product_not_live`) rather than writing a degraded cache row.

### 3.2 `InventorySnapshot` (today only; matches current inventory webhook)

| Legacy field | Canonical source |
|---|---|
| `shopifyVariantId` | `ShopifyInventoryItemFact.shopifyVariantGid` |
| `locationId` | `ShopifyInventoryLevelFact.locationGid` (GID form, same as the webhook writer) |
| `snapshotDate` | process-local start of calendar day (`setHours(0,0,0,0)`), matching `webhook-processor` |
| `quantityAvailable` | canonical `availableQuantity` copied exactly when the level, location, item, **and** variant are all known `LIVE` |

Mapping first resolves the legacy variant GID with the accepted `requireKnownVariantGid` contract (`canonical_variant_link_missing`, retryable). It does not invent a variant relationship from SKU/barcode/title/legacy cache.

Quantity then distinguishes **explicit non-live evidence** from **unknown canonical state**:

- Explicit `ABSENT` on the InventoryLevel, linked InventoryItem, linked Location, or linked ProductVariant may project today's snapshot as `0`.
- A LIVE InventoryLevel with `availableQuantity === null` **fails closed** (`canonical_available_quantity_missing`, retryable). Null/unknown is not Shopify zero.
- A LIVE InventoryLevel whose Location relation/state is missing/unknown rather than explicitly `ABSENT` **fails closed** (`canonical_location_state_missing`, retryable).
- A LIVE InventoryLevel whose ProductVariant existence is missing/unknown rather than explicitly `ABSENT` **fails closed** (`canonical_variant_state_missing`, retryable).
- Canonical `availableQuantity = 0` is authoritative zero and projects `0`.
- Negative canonical `availableQuantity` is copied exactly. Canonical `Int?`, Shopify Admin GraphQL `InventoryQuantity.quantity` (`Int!`, 2026-07), and legacy `InventorySnapshot.quantityAvailable Int` all permit signed integers; F2C does not clamp to zero.

Failed unknown-inventory projection leaves the stale legacy `InventorySnapshot` unchanged, does not fabricate zero or variant identity, does not write canonical facts or `compatibilityProjectionState`, and does not recommend HEALTHY/DEGRADED. Retry after authoritative canonical data becomes available repairs the derived snapshot. The stale snapshot is never used as authority.

Historical snapshot rows are not rewritten except for the today-zero neutralization on variant tombstone.

The prior unsafe `availableQuantity ?? 0` collapse is recorded in §12. It is no longer current mapping behavior.

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
| `SUCCEEDED` | this invocation's requested identities/page completed; `hasMore` / `cursor` / `remainingIdentities` describe continuation only | `false` for the completed page |
| `FAILED` | explicit `failure.code` / `failure.message`; remaining work is in the result | Only an explicit reviewed reason: missing canonical identity / unknown LIVE inventory (`canonical_variant_missing`, `canonical_inventory_level_missing`, `canonical_variant_link_missing`, `canonical_available_quantity_missing`, `canonical_location_state_missing`, `canonical_variant_state_missing`), brief-authorized parent-ABSENT / variant-LIVE lag (`canonical_product_not_live`), and reviewed Prisma transients (`P1001`/`P1002`/`P1008`/`P1017`/`P2024`/`P2034` → `projection_transient_write_failed`). Invalid limit, malformed cursor, weight overflow, multiple LIVE inventory items, malformed weight, Prisma validation/permanent request defects, and unclassified errors are `false`. Unknown errors do **not** default retryable |
| `DENIED_PROCESSING_DISABLED` | `processingEnabled !== true`; no TenantDb open; no merchant writes | `false` |

This core does **not** read `Shop` / control-plane. Caller-supplied `processingEnabled` is acceptable **only** for this isolated core (F2C-12 deferred). Later F2B/worker integration **must** read the LIVE authoritative control-plane `Shop.processingEnabled` immediately before projection work; a cached caller boolean is not sufficient for production. Missing canonical identity remains `retryable: true` so a later retry can wait for the applicator.

Non-retryable projection failures during merchant work return `poisonHalt` (`halt_on_poison`). Retryable failures, including `canonical_product_not_live`, do **not** produce `poisonHalt` or quarantine-resume authority. `cursor` / `remainingIdentities` still point at the failed identity so retry cannot falsely claim progress. `resumeAfterQuarantineCursor` is a **separate** field and is not safe to use until a later worker durably quarantines or repairs that identity. Validation failures before TenantDb (bad limit / malformed cursor) are non-retryable **without** `poisonHalt`.

`shop_rebuild` in this isolated core is a **bounded replay/projection FROM canonical rows** (variants by GID, then inventory levels by item+location). It is **not**:

- proof of complete merchant compatibility convergence;
- authority to delete a legacy row merely because no canonical counterpart was found;
- authority to mark `compatibilityProjectionState` HEALTHY.

Shop rebuild cursor:

1. `phase: "variants"` ordered by `shopifyGid`
2. `phase: "inventory_levels"` ordered by `(inventoryItemGid, locationGid)`

---

## 4. Files changed

Runtime / tests / tenant-access registration (commit `4c346fc418e1fea7f4113e1e9b2337dd7a371aa9`):

- `stocky-plus/app/lib/catalog-facts/compatibility-projection/**` (new isolated module + unit tests)
- `stocky-plus/app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts` (`issueTenantAuthority` is restricted to `app/tenant/`)
- `stocky-plus/scripts/tenant-access/allowlist.ts` (append-only new EX-TEST path; see §10)
- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (regenerated; 0 violations)

Lane-isolation revert (commit `4a7ca8a78ce33cae9a501cfa472f8fd4cf19196d`) restored these shared files to authorized base `5129707ee684e66cadcf96b976e16eb57385a7cb`:

- `.github/workflows/ci.yml`
- `stocky-plus/package.json`
- `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts`

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
| No HEALTHY recommendation, including `hasMore=true` | unit request contract + DB `does not authorize merchant health when a bounded shop_rebuild page has hasMore=true` |
| Missing `shopifyVariantGid` fail-closed | unit mapping throw `canonical_variant_link_missing`; DB stale snapshot + repair-on-retry |
| Unknown LIVE `availableQuantity` is not zero | unit `canonical_available_quantity_missing`; DB stale `99` preserved, retry after `17` repairs |
| True zero vs unknown | unit + DB `availableQuantity = 0` succeeds with snapshot `0` |
| Negative available copied exactly | unit + DB `availableQuantity = -2` succeeds with snapshot `-2` |
| Unknown location/variant state fail-closed | unit `canonical_location_state_missing` / `canonical_variant_state_missing`; explicit ABSENT still zeros |
| Failed middle identity preserves canonical facts | DB `preserves already committed canonical facts and resumes from the failed identity` |
| Orphan legacy row is not canonical evidence | DB `does not treat an orphan legacy row as canonical authority or delete it during shop_rebuild` |
| Completed bounded page still does not persist/authorize durable health | DB final `shop_rebuild` page `hasMore=false` still `deferred_to_integration` |

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

The `test:pr5-f2c-projection*` package scripts were later removed in the lane-isolation correction. Post-correction commands and results are in §10. A command is evidence only for the exact code and environment on which it ran.

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
   - owns the durable `compatibilityProjectionState` transition and must **not** mark HEALTHY until it has sufficient evidence that the projection matches canonical facts under the accepted synchronization/fence contract;
   - must not treat F2C `status: "SUCCEEDED"` (including `hasMore=true` or a final bounded page) as permission to set HEALTHY;
   - must not fold projection into the canonical transaction.
2. Caller-supplied live `processingEnabled` from the worker/uninstall control plane.
3. R-145 / R-156 diagnostic reconciler (`DataIssue` `COMPATIBILITY_PROJECTION_FAILED`, dual SyncHealth).
4. R-142 later cleanup of duplicate legacy authority; not PR 5. **Mandatory downstream gate:** before PR5 compatibility projection can be accepted as complete, the integration lane must reconcile orphan legacy projection rows only after canonical-domain completeness is proven from an accepted full-sync/fence contract. This core does not close R-142 and does not delete orphans.
5. Consumer migration off `ShopifyVariantCache` / `InventorySnapshot`; not this lane.
6. No PR 6, no production, no inventory-write enablement.

---

## 8. Explicit non-claims

- PR 5 is **not** complete.
- Phase 1 is **not** complete.
- Compatibility projection is **not** wired to catalog-sync, webhooks, or F2B.
- Buying Table / barcode / forecast surfaces are **not** claimed healthy in production.
- R-142 / R-145 / R-156 / R-165 are **not** closed.
- Independent Claude review has **not** run at the time this file was first written.

---

## 9. Handoff

Lane-isolation correction is recorded in §10 and remains accepted. Semantic-contract correction is recorded in §11 and remains accepted. The final pre-independent-review inventory-integrity correction is recorded in §12. Independent Claude review of implementation head `4bdb1dac97323f079554590d7ac15962b8227283` is recorded as immutable commit `2d8fd47844dec2abf5e0543260f1552272612384` (blob `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7`). The first post-independent-review correction package is recorded in §13. The second correction package (F2CC-01 + malformed `inventoryItems`) is recorded in §14.

Cursor's next action after exact-head full CI is green is to STOP. Do not ask Claude. Do not merge. Do not mark ready. Do not integrate with F2B.

This isolated core is not merchant-safe until F2B integration, `compatibilityProjectionState` HEALTHY/DEGRADED, and the later worker/scheduler exist. Later worker integration MUST durably quarantine or repair a poison identity before using any resume-after-poison mechanism. `resumeAfterQuarantineCursor` remains unusable until that durable quarantine/repair exists.

---

## 10. Lane-isolation / merge-hygiene correction

**Why:** Accelerated Safe Delivery requires non-overlapping lane ownership. The original F2C implementation also changed shared files that F2A / CI baseline own.

**Starting identity for this correction:** live PR head `16594e55843b270c5ddd9bc70af729d44029b540` (exact-head CI run `32079925288` SUCCESS). That run is **superseded** as live-head evidence after this correction.

### 10.1 Shared files reverted

Restored byte-identical to `5129707ee684e66cadcf96b976e16eb57385a7cb` (blob hashes match):

| File | Base blob | After revert |
|---|---|---|
| `.github/workflows/ci.yml` | `16ab27b20b27a2747e84ce819b7726f78b983b0f` | identical |
| `stocky-plus/package.json` | `a68e16ba94dcd7f4d16b6d5238c5a85f4d2ab945` | identical |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | `62690c1231a73bc86c71074bfb61ed6796492973` | identical |

No lane-specific permanent CI steps remain. No F2C npm script names remain. F2A retains global recursive/semantic PR5 read-boundary safety work (R-163). F2C safety stays in `app/lib/catalog-facts/compatibility-projection/safety.test.ts`.

### 10.2 Allowlist entry disposition

**Kept** the one TEST_FILES line:

`app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`

This is **not** a production/runtime allowlist widening. The entry is category `migration_tests`, `productionRuntime: "no"`, append-only as `EX-TEST-035` (existing EX-TEST ids are not shifted).

Evidence it is technically necessary:

- The focused TenantDb file uses fixture `prisma.*` merchant-delegate calls (cleanup, seed, assertion reads). The scanner treats `receiver === "prisma"` as unrestricted access unless that exact path is a TEST_FILES exception.
- Temporary removal of the line: `npm run tenant:access:audit` → **65 violations**, all in `app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`, first `prisma.lowStockAlert.deleteMany` at line 35 (`MUST use TenantDb`).
- Restoring the line: `npm run tenant:access:audit` → **0 violations**, `EX-TEST-035` used.

No other allowlist category was broadened.

### 10.3 PR2 inventory regeneration

After the final file set (shared-file reverts + retained TEST_FILES line):

| Command | Result |
|---|---|
| `npm run tenant:access:inventory` | findings **1485**, violations **0** |
| `npm run tenant:access:inventory:check` | inventory fresh |

The generated markdown had **no content diff** versus the previous F2C inventory commit (scanner truth already matched). File kept as required by current scanner truth.

### 10.4 Focused tests after cleanup (no package scripts)

Commands run directly:

```
npx vitest run --passWithNoTests=false \
  app/lib/catalog-facts/compatibility-projection
```

4 files, **23** tests passed.

```
npx vitest run --passWithNoTests=false \
  --config vitest.tenant-access.config.ts \
  app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts
```

1 file, **14** tests passed.

Also executed on the reverted worktree:

| Command | Result |
|---|---|
| `npx vitest run app/lib/catalog-facts/foundation-safety.test.ts` | 1 file, **3** tests passed (base non-recursive scan) |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 13 files, **94** tests passed |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

Projection behavior was not redesigned. Canonical facts remain untouched; `compatibilityProjectionState` is still not written; F2B is still not integrated.

Exact-head corrected CI is recorded from the live `pull_request` workflow after this documentation commit is pushed. This paragraph does not invent a future SHA.

---

## 11. Semantic-contract correction

**Why:** A successful processing batch is not proof that the complete compatibility projection matches canonical facts. This isolated core also cannot prove a multi-page rebuild observed one stable canonical snapshot. Silently skipping an InventoryLevel whose InventoryItem has `shopifyVariantGid = null` can leave a stale legacy snapshot in place while returning `SUCCEEDED`.

**Starting identity for this correction:** live PR head `115733879add7bbab33a7776d8e2a90c782fed04` (exact-head CI run `32092407749` SUCCESS; Heavy `95577094611`; CI Gate `95586900048`). That run is **superseded** as live-head evidence after this correction. Lane-isolation remains accepted and was not revisited.

### 11.1 Correction A — core must not decide merchant health

Removed `recommendedCanonicalProjectionState` from the public result contract. It is not replaced with another HEALTHY/DEGRADED recommendation.

Added `canonicalHealthDecision` whose only value is `"deferred_to_integration"`. Durable write remains `"omitted_by_f2c_lane"`.

`status: "SUCCEEDED"` means only that the requested work for **this invocation** completed successfully.

Mandatory falsification: bounded `shop_rebuild` with `hasMore=true` contains no HEALTHY recommendation and no health-transition authorization.

### 11.2 Correction B — unknown variant link must not silently succeed

`mapInventoryLevelToLegacySnapshot` now throws `CompatibilityProjectionError` `canonical_variant_link_missing` (retryable) identifying the InventoryLevel `{ inventoryItemGid, locationGid }`.

The caller no longer counts an unprojectable level as processed. Canonical facts are unchanged. Unrelated legacy rows are not modified. SKU/barcode/title/legacy cache are not used as identity.

PostgreSQL sequence: LIVE level + LIVE InventoryItem with `shopifyVariantGid = null` + today's stale `InventorySnapshot` → `FAILED` / retryable / level identity / fingerprint unchanged / snapshot still stale / no fabricated variant GID. Establishing the canonical variant relationship and retrying repairs today's snapshot to the canonical quantity.

### 11.3 Correction C — limit of `shop_rebuild`

Frozen as a bounded replay FROM canonical rows. It does not prove every pre-existing legacy `ShopifyVariantCache` / `InventorySnapshot` has a canonical counterpart. This core does not delete orphans (no proven complete canonical full-sync epoch).

Regression: an orphan cache/snapshot with no canonical counterpart survives `shop_rebuild`, is not treated as canonical authority, and does not authorize global health.

R-142 remains **OPEN**. Downstream integration must reconcile orphan legacy projection rows only after canonical-domain completeness is proven from an accepted full-sync/fence contract.

### 11.4 Correction D — concurrency / health boundary

No F2B advisory locks, no shared canonical/applicator transaction, no canonical writes, no `compatibilityProjectionState` writes were added.

F2C output is a projection execution result only. Later F2B/worker integration owns the durable health transition and must not mark HEALTHY until it has sufficient evidence that the projection matches canonical facts under the accepted synchronization/fence contract. That avoids falsely certifying a multi-page rebuild that raced a newer canonical commit.

### 11.5 Additional falsification executed

1. `hasMore=true` cannot authorize health.
2. Failed middle identity preserves already committed canonical facts; `remainingIdentities[0]` is the failed identity.
3. Retry starts from the failed/unprocessed identity and repairs the snapshot after the variant link is established.
4. Missing variant relationship never fabricates identity from SKU/barcode/title.
5. Canonical tombstone still zeros today's known legacy snapshots (existing DB test retained).
6. Cross-shop isolation remains intact (existing DB test retained).
7. A stale orphan legacy row does not become canonical evidence and is not deleted.
8. Successful final bounded page still does not persist or authorize merchant durable health.

Multiple-LIVE-InventoryItem selection was **not** redesigned in this semantic-contract correction. Lexicographically first LIVE GID remained at that time. The first post-independent-review package (§13 / F2C-01) replaced that behavior with fail-closed `canonical_multiple_live_inventory_items`.

### 11.6 Files in this correction

Runtime / tests (commit `4acebccdd904ca53906109036b4577f60f9ab330`):

- `stocky-plus/app/lib/catalog-facts/compatibility-projection/**`
- `stocky-plus/app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`

Scanner-truth inventory regeneration (this documentation commit; still **0** violations):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (findings **1508**; approved exception findings **1046**; extra `prisma.*` lines from the expanded EX-TEST-035 file plus `project.ts` line-number drift)

This report file is included in the same documentation commit and does not embed that commit's unknown future SHA.

Allowlist was **not** broadened. Shared files remain byte-identical to authorized base `5129707ee684e66cadcf96b976e16eb57385a7cb`:

| File | Blob |
|---|---|
| `.github/workflows/ci.yml` | `16ab27b20b27a2747e84ce819b7726f78b983b0f` |
| `stocky-plus/package.json` | `a68e16ba94dcd7f4d16b6d5238c5a85f4d2ab945` |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | `62690c1231a73bc86c71074bfb61ed6796492973` |

### 11.7 Local evidence on `4acebccdd904ca53906109036b4577f60f9ab330`

Environment: disposable PostgreSQL 16.14 + Redis PONG; Node v22.14.0; `STOCKY_RUNTIME_ROLE=stocky_runtime`; inventory-write flags unset (default off).

```
npx vitest run --passWithNoTests=false \
  app/lib/catalog-facts/compatibility-projection
```

4 files, **24** tests passed.

```
npx vitest run --passWithNoTests=false \
  --config vitest.tenant-access.config.ts \
  app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts
```

1 file, **18** tests passed.

| Command | Result |
|---|---|
| `npx vitest run app/lib/catalog-facts/foundation-safety.test.ts` | 1 file, **3** tests passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 13 files, **95** tests passed |
| `npm run build` | exit 0 |
| `npm run tenant:access:inventory` | findings **1508**, violations **0** |
| `npm run tenant:access:inventory:check` | inventory fresh |
| `git diff --check` | clean |

Exact-head `pull_request` CI for the live head after this documentation commit is the authoritative automatic evidence. This paragraph does not invent a future SHA.

---

## 12. Final pre-independent-review inventory-integrity correction

**Why:** The accepted semantic-contract correction stopped silent skip of a missing variant GID. It did **not** stop the mapper from treating unknown canonical inventory quantity as Shopify zero.

**Prior unsafe behavior (on live head `f47d8d19382a00e36714f5eb33773fbd5b40aa3f`):**

```
if level/item/location/variant are all LIVE:
    return level.availableQuantity ?? 0
otherwise:
    return 0
```

That collapsed two materially different states:

- **A.** explicit canonical evidence that the relationship/resource is non-LIVE (`existenceState === ABSENT`);
- **B.** missing/unknown canonical evidence (`availableQuantity === null`, missing Location relation/state, missing ProductVariant existence).

Only A may safely project zero. B must fail closed. Null/unknown canonical data is not Shopify zero. Shopify remains authoritative. The stale legacy `InventorySnapshot` is not authority.

**Starting identity for this correction:** live PR head `f47d8d19382a00e36714f5eb33773fbd5b40aa3f` (exact-head CI run `32098232803` SUCCESS; Heavy `95593674653`; CI Gate `95603192955`). That run is **superseded** as live-head evidence after this correction. Lane-isolation (§10) and semantic-contract (§11) remain accepted and were not reopened.

### 12.1 Corrected distinction

1. Resolve the target legacy variant GID with `requireKnownVariantGid` (unchanged). Missing GID remains `canonical_variant_link_missing` / retryable / InventoryLevel pair identity. SKU/barcode/title/legacy-cache inference remains forbidden.
2. If authoritative canonical evidence is explicitly `ABSENT` for the level, linked item, linked location, or linked variant, project today's snapshot as `0`.
3. If the InventoryLevel is LIVE but `availableQuantity` is not a known integer, throw `canonical_available_quantity_missing` (retryable).
4. If the InventoryLevel is LIVE and Location existence is missing/unknown rather than explicitly `ABSENT`, throw `canonical_location_state_missing` (retryable).
5. If the InventoryLevel is LIVE and ProductVariant existence is missing/unknown rather than explicitly `ABSENT`, throw `canonical_variant_state_missing` (retryable).
6. If the LIVE graph is fully known, copy `availableQuantity` exactly, including `0` and negatives. Do not clamp.

Required FK `ShopifyInventoryLevelFact.location` (`onDelete: Restrict`) prevents a persisted InventoryLevel row with no Location row, so unknown-location PostgreSQL evidence is not representable under current schema. Mapper-level `location: null` covers that unknown state. Explicit Location `ABSENT` is representable and projects zero.

Required/nullable FK `ShopifyInventoryItemFact.variant` prevents a persisted known `shopifyVariantGid` that does not reference a variant row. Mapper-level `variantExistenceState: null` with a known item GID covers unknown variant existence. Explicit Variant `ABSENT` is representable and projects zero.

No extra persisted state was created.

### 12.2 Preserved accepted contracts

- No `recommendedCanonicalProjectionState`.
- No HEALTHY/DEGRADED recommendation.
- `canonicalHealthDecision` remains only `deferred_to_integration`.
- `status: "SUCCEEDED"` means invocation completion only.
- `shop_rebuild` remains bounded replay FROM canonical rows; orphan legacy rows are not deleted and are not canonical evidence.
- Canonical facts remain authoritative and are not written by this lane.
- `compatibilityProjectionState` is not written by this lane.
- Lexicographically-first LIVE InventoryItem selection, legacy weight scale/rounding, orphan cleanup, and multi-page synchronization/fence contract were **not** redesigned in this inventory-integrity correction. F2C-01 / F2C-09 later changed product-owner resolution and weight rounding; see §13.

### 12.3 Files in this correction

Runtime / tests (commit `2159614bda106bb36e343ff50cda9297f6fb5704`):

- `stocky-plus/app/lib/catalog-facts/compatibility-projection/**`
- `stocky-plus/app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`

Scanner-truth inventory regeneration (this documentation commit; still **0** violations):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (findings **1526**; approved exception findings **1064**; extra `prisma.*` lines from the expanded EX-TEST-035 file)

This report file is included in the same documentation commit and does not embed that commit's unknown future SHA.

Allowlist was **not** broadened. Shared files remain byte-identical to authorized base `5129707ee684e66cadcf96b976e16eb57385a7cb`:

| File | Blob |
|---|---|
| `.github/workflows/ci.yml` | `16ab27b20b27a2747e84ce819b7726f78b983b0f` |
| `stocky-plus/package.json` | `a68e16ba94dcd7f4d16b6d5238c5a85f4d2ab945` |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | `62690c1231a73bc86c71074bfb61ed6796492973` |

### 12.4 Local evidence on `2159614bda106bb36e343ff50cda9297f6fb5704`

Environment: disposable PostgreSQL 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1) + Redis PONG; Node v22.14.0; `STOCKY_RUNTIME_ROLE=stocky_runtime`; inventory-write flags `false` (default off).

```
npx vitest run --passWithNoTests=false \
  app/lib/catalog-facts/compatibility-projection
```

4 files, **36** tests passed.

```
npx vitest run --passWithNoTests=false \
  --config vitest.tenant-access.config.ts \
  app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts
```

1 file, **24** tests passed.

| Command | Result |
|---|---|
| `npx vitest run app/lib/catalog-facts/foundation-safety.test.ts` | 1 file, **3** tests passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 13 files, **107** tests passed |
| `npm run build` | exit 0 |
| `npm run tenant:access:inventory` | findings **1526**, violations **0** |
| `npm run tenant:access:inventory:check` | inventory fresh |
| `git diff --check` | clean |

PostgreSQL proofs on that runtime SHA:

- LIVE + `availableQuantity = null` + today's snapshot `99` → `FAILED` / `canonical_available_quantity_missing` / retryable / level-pair identity / snapshot stays `99` / fingerprint unchanged / no health recommendation. Setting canonical available to `17` and retrying → `SUCCEEDED` / snapshot `17` / fingerprint otherwise unchanged.
- LIVE + `availableQuantity = 0` → `SUCCEEDED` / snapshot `0`.
- LIVE + `availableQuantity = -2` → `SUCCEEDED` / snapshot `-2` (not clamped).
- Explicit Location / Variant / Item `ABSENT` still project snapshot `0`. Existing level-ABSENT disconnect test remains.
- `canonical_variant_link_missing` sequence remains: stale snapshot unrepaired until the canonical variant link is established.

Mapper-level proofs (same SHA): missing Location relation and unknown `variantExistenceState` fail retryably rather than writing zero; explicit `ABSENT` still zeros.

Exact-head `pull_request` CI for the live head after this documentation commit is the authoritative automatic evidence. This paragraph does not invent a future SHA.

---

## 13. First post-independent-review correction package

**Status:** Correction implemented — pending independent verification.

Independent review artifact (immutable; never edited):

| Field | Value |
|---|---|
| Reviewed implementation head | `4bdb1dac97323f079554590d7ac15962b8227283` |
| Independent review commit (retained on branch) | `2d8fd47844dec2abf5e0543260f1552272612384` |
| Artifact path | `stocky-plus/docs/phases/phase-1/PR5_F2C_COMPATIBILITY_PROJECTION_INDEPENDENT_REVIEW.md` |
| Artifact blob | `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7` |
| Claude verdict | CORRECTIONS REQUIRED — P0 0 / P1 1 / P2 6 / P3 6 |

This section does not embed this documentation commit's SHA. Runtime/test and risk-register SHAs already on the branch:

| Commit | Role |
|---|---|
| `9247be5e0b6448d1b7061c7c5a90306ea1f67263` | Runtime + unit/PostgreSQL tests for F2C-01..05, F2C-08..11, F2C-03/04, F2C-12/13 comments |
| `cdc9b86ac5b42ad13d01b790c7951d956f4ab7b5` | F2C-06 / F2C-07 risk-register disposition (`R-165` added; `R-145` extended; `R-142` / `R-156` remain OPEN) |
| `e620f08889af8006f619f90911c260753c76a06f` | Product-ABSENT PostgreSQL fixture existence-coherence fix |

The branch was **not** reset to `4bdb1da`. Review commit `2d8fd47` remains an ancestor.

### 13.1 F2C-01 — P1 product-owner resolution

Frozen F1 schema was **not** modified. No migration and no partial unique index were added.

`selectLiveInventoryItem`:

- 0 LIVE InventoryItems → preserve `inventoryItemId: null`
- 1 LIVE InventoryItem → use it
- more than one LIVE InventoryItem → throw `canonical_multiple_live_inventory_items` (non-retryable), identifying the ProductVariant, selecting neither GID, mutating neither `ShopifyVariantCache` nor `InventorySnapshot` nor canonical facts

The previous lexicographically-first-wins test was replaced. PostgreSQL proof: an existing correct legacy cache row (`inventoryItemId` = the original LIVE item, title/image/weight unchanged, `updatedAt` unchanged) remains unchanged when a second LIVE InventoryItem is linked. No Shopify write target is produced from the ambiguity. Ambiguity is non-retryable by this invocation unless the canonical graph is separately repaired.

### 13.2 F2C-02 — P2 poison-row contract

This isolated core remains halt-on-poison. That is now an explicit mechanical contract, not an accidental loop.

Non-retryable failures during projection work return:

```
poisonHalt: {
  contract: "halt_on_poison",
  durableQuarantineRequired: true,
  resumeAfterQuarantineCursor,
  remainingIdentitiesAfterQuarantine,
}
```

- Result status is `FAILED` / non-retryable.
- Exact failure identity and code are returned whenever identity can be established.
- `cursor` / `remainingIdentities` still point at the poison identity; retrying the same cursor does not claim progress.
- `resumeAfterQuarantineCursor` is a **separate named field**. It is **not** the shop_rebuild retry cursor and is **not** safe to use until a later worker/integration durably records (quarantines or repairs) the poison identity.
- If identity cannot be safely established from a malformed canonical row, fail closed without inventing one (`resumeAfterQuarantineCursor: null`).
- F2C itself never silently advances past corruption.
- Validation failures before TenantDb (bad limit / malformed cursor) stay non-retryable **without** `poisonHalt`.

**Mandatory later worker/integration gate:** the integration MUST durably quarantine or repair the poison identity before using any resume-after-poison mechanism. This lane did **not** build the worker or DataIssue reconciler.

### 13.3 F2C-03 / F2C-04 — cursor + error classification

`normalizeRebuildCursor` validates every field:

- Variants: `phase` exactly `"variants"`; `afterGid` absent or a non-empty string; no number/object/array coercion; extra keys invalid.
- Inventory levels: `phase` exactly `"inventory_levels"`; `afterItemGid` and `afterLocationGid` both absent or both non-empty strings; a partial composite is invalid.
- Malformed cursor → `invalid_rebuild_cursor`, `retryable=false`.
- The previous partial-location fallback `?? ""` is gone. Cursor is validated before `createTenantDb`.

`classifyProjectionFailure`:

- `CompatibilityProjectionError` keeps its explicit retryable flag (constructor default **false**).
- Prisma validation / permanent known-request (including `P2002`) → `projection_permanent_request_failed`, non-retryable.
- Reviewed transients `P1001`/`P1002`/`P1008`/`P1017`/`P2024`/`P2034` → `projection_transient_write_failed`, retryable.
- Unknown / programming errors → `projection_unclassified_failure`, non-retryable.
- Unknown errors do **not** automatically become retryable.

### 13.4 F2C-05 — product evidence

A LIVE ProductVariant whose canonical product relation is missing or not LIVE fails closed with `canonical_product_not_live` (non-retryable). An existing good `ShopifyVariantCache` title/image is preserved (`updatedAt` unchanged). Legacy cache is not read as canonical authority. Title/image are not synthesized. Canonical facts remain unchanged. This remains part of the later merchant DEGRADED obligation.

### 13.5 F2C-06 / F2C-07 — risk / integration disposition

Webhook processor and forecasting engine were **not** modified (outside this lane). Findings are recorded in `RISK_REGISTER.md` (authorized shared-doc exception).

**F2C-06 → R-165 (P2, OPEN):** legacy `inventory_levels/update` uses `available ?? 0` and can overwrite the same `InventorySnapshot` unique key that F2C leaves unchanged when availability is unknown. Required mitigation before end-to-end PR5 null-vs-zero integrity is claimed: remove/fence the legacy null→zero behavior; canonical truth wins; inventory health must not claim current when availability is unknown. **Not fixed in this lane.**

**F2C-07 → R-145 extended (P1, remains OPEN):** no duplicate risk was created. Evidence now includes: preserved stale `InventorySnapshot` may be consumed by forecasting as current (`findFirst orderBy snapshotDate desc`, no freshness bound, `onHand?.quantityAvailable ?? 0`). F2C must not be wired as merchant-safe until `compatibilityProjectionState` DEGRADED/HEALTHY integration exists. Preserved stale is safer than fabricated zero, but must be visibly unhealthy.

**R-142 and R-156 remain OPEN.** This package does not claim they are resolved.

### 13.6 F2C-08 — bounded tombstone legacy writer

Tombstone path no longer reads every historical snapshot row into application memory and no longer holds one transaction across an unbounded serial upsert loop.

Architecture:

- Distinct `locationId` values are selected in the database (`groupBy` + keyset `gt`, page size 32).
- Bounded write chunks (32) each run in their own `$transaction`.
- Today's zero is still written for every historical location associated with the tombstoned variant.
- No hidden silent cap that drops locations. Stuck cursor / empty `locationId` / page overflow fail closed explicitly.
- Idempotent retry remains safe. TenantDb tenant scoping remains intact.
- No merchant-visible product limit was invented.

Adversarial PostgreSQL proof: 40 distinct locations × 25 historical dates (1000 rows) plus cross-shop rows. Read cardinality equals distinct locations (40), not all historical rows. Write chunks ≤ 32. Every distinct historical location receives today's zero. Old snapshots remain untouched. Cross-shop rows remain untouched.

### 13.7 F2C-09 / F2C-10 / F2C-11 — weight rounding and coerce

- Rounding is explicit `toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)` and does not depend on Decimal global rounding state.
- Tests pin: `1.00004` rounds down; `1.00005` rounds half-up; exact four decimals; negative; null; boundary `999999.99995` overflows `DECIMAL(10,4)`; global `ROUND_DOWN` does not change the result.
- `coerceCanonicalInventoryItem` requires `Prisma.Decimal.isDecimal` plus finite; a string/number/NaN weight raises `invalid_canonical_inventory_item` (non-retryable) **before** any legacy DB write.

### 13.8 F2C-12 / F2C-13 — accepted deferred (not "fixed")

**F2C-12:** Caller-supplied `processingEnabled` remains acceptable **only** for this isolated core. Mandatory later F2B/worker integration gate: the integration must read the LIVE authoritative control-plane `Shop.processingEnabled` immediately before projection work. A cached caller boolean is not sufficient for production. This core did **not** add control-plane reads.

**F2C-13:** `snapshotDate` local-midnight behavior is intentionally legacy-compatible with the live webhook/forecast unique key. The timezone/calendar-day problem is pre-existing deferred compatibility debt. F2C does **not** claim it is solved.

### 13.9 Files in this correction

Runtime / tests (`9247be5e0b6448d1b7061c7c5a90306ea1f67263`, plus fixture fix `e620f08889af8006f619f90911c260753c76a06f`):

- `stocky-plus/app/lib/catalog-facts/compatibility-projection/**`
- `stocky-plus/app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`

Risk register (`cdc9b86ac5b42ad13d01b790c7951d956f4ab7b5`):

- `stocky-plus/docs/RISK_REGISTER.md`

Scanner-truth inventory regeneration (this documentation commit; still **0** violations):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (findings **1546**; scanned files **275**; approved exception findings **1084**; extra `prisma.*` lines from the expanded EX-TEST-035 file)

This report file is included in the same documentation commit and does not embed that commit's unknown future SHA.

Allowlist was **not** broadened. `EX-TEST-035` remains test-only / `productionRuntime: "no"`. Shared files remain byte-identical to authorized base `5129707ee684e66cadcf96b976e16eb57385a7cb`:

| File | Blob |
|---|---|
| `.github/workflows/ci.yml` | `16ab27b20b27a2747e84ce819b7726f78b983b0f` |
| `stocky-plus/package.json` | `a68e16ba94dcd7f4d16b6d5238c5a85f4d2ab945` |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | `62690c1231a73bc86c71074bfb61ed6796492973` |

Prisma schema and all F1 migrations remain base-identical. No F2B integration. No webhook/forecasting runtime correction. No `compatibilityProjectionState` writes. No canonical writes.

### 13.10 Local evidence on `e620f08889af8006f619f90911c260753c76a06f`

Environment: disposable PostgreSQL 16.14 + Redis PONG; Node v22.14.0; `STOCKY_RUNTIME_ROLE=stocky_runtime`; inventory-write flags `false` (default off).

```
npx vitest run --passWithNoTests=false \
  app/lib/catalog-facts/compatibility-projection
```

7 files, **67** tests passed.

```
npx vitest run --passWithNoTests=false \
  --config vitest.tenant-access.config.ts \
  app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts
```

1 file, **28** tests passed.

| Command | Result |
|---|---|
| `npx vitest run app/lib/catalog-facts/foundation-safety.test.ts` | 1 file, **3** tests passed |
| `npx vitest run --config vitest.tenant-access.config.ts app/tenant/__tests__/relation-isolation.test.ts` | 1 file, **10** tests passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 16 files, **138** tests passed |
| `npm run build` | exit 0 |
| `npm run tenant:access:audit` | violations **0**, scannedFiles **275**, findings **1546**, `EX-TEST-035` still used |
| `npm run tenant:access:inventory` | findings **1546**, violations **0** |
| `npm run tenant:access:inventory:check` | inventory fresh |
| `git diff --check` | clean |
| Review artifact blob | still `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7` |

Preserved contracts on that SHA:

- UNKNOWN `availableQuantity` fails closed; canonical zero stays zero; negatives preserved; explicit ABSENT may zero.
- Missing variant link fails closed; no SKU/barcode/title/cache inference.
- `canonicalHealthDecision` always `deferred_to_integration`; no recommended HEALTHY/DEGRADED; no `compatibilityProjectionState` writes; no canonical writes.
- Canonical facts unchanged on projection failure.
- Bounded page traversal; orphan rows not deleted from absence in traversal.
- `processingEnabled=false` denial before TenantDb merchant work.

Exact-head `pull_request` CI for the live head after this documentation commit is the authoritative automatic evidence. This paragraph does not invent a future SHA. After that CI is green: STOP. Do not ask Claude. Do not merge. Do not mark ready.

---

## 14. Second post-independent-review correction package

**Status:** Correction implemented — pending independent verification.

Correction re-review artifact (immutable; never edited):

| Field | Value |
|---|---|
| Reviewed correction head | `0f8193ef85bf7eda2b9e6d9b9da5ed7734f69a89` |
| Re-review commit (cherry-picked; retained on branch) | `13ad54baf8df195989da5e177bdeced5664ffda5` (source `fafbae79c52950eb6084603227ca9b663527d06b`) |
| Artifact path | `stocky-plus/docs/phases/phase-1/PR5_F2C_COMPATIBILITY_PROJECTION_CORRECTION_INDEPENDENT_REVIEW.md` |
| Artifact blob | `816dc7fb46cc84c394d8914ac0198c9f110a1825` |
| Claude verdict | CORRECTIONS REQUIRED — 1 new P2, 4 new P3; no new P0/P1 |

This section does not embed this documentation commit's SHA. Runtime/test SHA already on the branch:

| Commit | Role |
|---|---|
| `b9dc8211ca6628a081b76db40067cdd2b0d27741` | F2CC-01 retryable `canonical_product_not_live` + malformed `inventoryItems` fail-closed |

### 14.1 F2CC-01 — P2 parent-ABSENT / variant-LIVE is retryable lag, not poison

Approved PR5 brief §10.3 product-delete: after confirmed product absence, variants are refetched or independently confirmed absent. The transitional parent-ABSENT / variant-LIVE graph is therefore possible.

`canonical_product_not_live` still:

- fails closed;
- preserves the existing `ShopifyVariantCache` row;
- never fabricates degraded title/image;
- does not advance the rebuild cursor past the failed variant;
- does not write canonical facts or `compatibilityProjectionState`;
- does not recommend HEALTHY/DEGRADED.

Classification change: **`retryable=true`**. The result does **not** include `poisonHalt` or quarantine-resume authority. The same cursor is safely retryable after canonical convergence.

If the inconsistency persists forever, later worker bounded retry + DEGRADED health owns liveness. F2C does not misclassify this as permanent data poison.

PostgreSQL `shop_rebuild` sequence on `b9dc8211ca6628a081b76db40067cdd2b0d27741`:

1. product canonical ABSENT; linked variant still LIVE; healthy later variant exists;
2. rebuild reaches the first variant → `FAILED` / `canonical_product_not_live` / `retryable=true` / no `poisonHalt`;
3. cursor remains `{ phase: "variants" }` (not past the failed variant);
4. healthy later variant is not processed; existing cache for the failed variant is preserved; canonical fingerprints unchanged;
5. the stuck variant is then tombstoned (proper ABSENT convergence);
6. retry of the same cursor `SUCCEEDED`; the later healthy variant projects; no HEALTHY recommendation.

### 14.2 Malformed `inventoryItems` fail-closed (cheap P3)

`coerceVariant` no longer treats a non-array `inventoryItems` as `[]`. A missing/null/object/string/number value raises `invalid_canonical_variant` (non-retryable) identifying the ProductVariant. An empty array remains the legitimate zero-LIVE-item Prisma include. Unit tests prove coerce throws before `mapVariantToLegacyCache` / any legacy write. Prisma include always returns an array, so a real PostgreSQL row cannot represent this malformed shape; the unit/fake-read path is the practical regression.

### 14.3 Accepted P3 residuals — not redesigned

- **Bounded tombstone write chunks:** the re-review independently proved mid-chunk failure is `FAILED`, recoverable, idempotent, bounded, and does not change canonical facts. Acceptable for rebuildable legacy projection. F2C does **not** force all tombstone location writes into one giant transaction.
- **`resumeAfterQuarantineCursor`:** remains a separate named field and remains unusable until later worker/integration provides durable quarantine/repair. Mandatory worker-integration gate. Not redesigned in this core now.
- **processing-disabled cursor echo:** the core still performs no merchant write when `processingEnabled` is false. The reviewer P3 is integration/request-hygiene debt. Not redesigned in this package.

### 14.4 Preserved contracts

- multiple LIVE InventoryItems fail closed (`canonical_multiple_live_inventory_items`, non-retryable);
- UNKNOWN available ≠ zero; true zero; negatives copied; `canonical_variant_link_missing`;
- no SKU/barcode/title/cache inference;
- bounded tombstone paging; `ROUND_HALF_UP`;
- canonical facts unchanged on projection failure; `compatibilityProjectionState` untouched;
- `canonicalHealthDecision=deferred_to_integration` only; no HEALTHY recommendation;
- orphan rows not deleted merely from traversal absence;
- `processingEnabled=false` write denial; tenant isolation;
- `EX-TEST-035` test-only / `productionRuntime: no`;
- R-142 / R-145 / R-156 / R-165 remain **OPEN**;
- no F2B, worker, webhook, forecasting, schema, or migration change.

### 14.5 Files in this correction

Runtime / tests (`b9dc8211ca6628a081b76db40067cdd2b0d27741`):

- `stocky-plus/app/lib/catalog-facts/compatibility-projection/**`
- `stocky-plus/app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`

Scanner-truth inventory regeneration (this documentation commit; still **0** violations):

- `stocky-plus/docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md` (findings **1553**; scanned files **275**; approved exception findings **1091**; extra `prisma.*` lines from the expanded EX-TEST-035 file)

This report file is included in the same documentation commit and does not embed that commit's unknown future SHA.

Allowlist was **not** broadened. Shared files remain byte-identical to authorized base `5129707ee684e66cadcf96b976e16eb57385a7cb`:

| File | Blob |
|---|---|
| `.github/workflows/ci.yml` | `16ab27b20b27a2747e84ce819b7726f78b983b0f` |
| `stocky-plus/package.json` | `a68e16ba94dcd7f4d16b6d5238c5a85f4d2ab945` |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | `62690c1231a73bc86c71074bfb61ed6796492973` |

Correction-review artifact blob remains `816dc7fb46cc84c394d8914ac0198c9f110a1825`. First-review artifact blob remains `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7`.

### 14.6 Local evidence on `b9dc8211ca6628a081b76db40067cdd2b0d27741`

Environment: disposable PostgreSQL + Redis PONG; Node v22.14.0; `STOCKY_RUNTIME_ROLE=stocky_runtime`; inventory-write flags unset (default off).

```
npx vitest run --passWithNoTests=false \
  app/lib/catalog-facts/compatibility-projection
```

7 files, **70** tests passed.

```
npx vitest run --passWithNoTests=false \
  --config vitest.tenant-access.config.ts \
  app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts
```

1 file, **29** tests passed.

| Command | Result |
|---|---|
| `npx vitest run app/lib/catalog-facts/foundation-safety.test.ts` | 1 file, **3** tests passed |
| `npx vitest run --config vitest.tenant-access.config.ts app/tenant/__tests__/relation-isolation.test.ts` | 1 file, **10** tests passed |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 16 files, **141** tests passed |
| `npm run build` | exit 0 |
| `npm run tenant:access:audit` | violations **0**, scannedFiles **275**, findings **1553**, `EX-TEST-035` still used |
| `npm run tenant:access:inventory` | findings **1553**, violations **0** |
| `npm run tenant:access:inventory:check` | inventory fresh |
| `git diff --check` | clean |
| Correction-review artifact blob | still `816dc7fb46cc84c394d8914ac0198c9f110a1825` |

Exact-head `pull_request` CI for the live head after this documentation commit is the authoritative automatic evidence. This paragraph does not invent a future SHA. After that CI is green: STOP. Do not ask Claude. Do not merge. Do not mark ready. Do not start F2B or PR 6.
