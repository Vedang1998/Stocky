# Phase 1 PR 5 Brief — Catalog, Location, and Inventory Facts

**Status:** `PR 5 PLANNING IN PROGRESS — IMPLEMENTATION NOT AUTHORIZED`
**Product owner:** ChatGPT
**Planning decision:** D-053 — Phase 1 PR 5 planning authorization
**Implementation owner (when later authorized):** Cursor
**Independent reviewer (when requested):** Claude Code
**Planning base:** `origin/main` `de1bb193a43ef87cf59acafeac4c5748e62d423d`
**Dependency:** Phase 1 PR 4 FORMALLY CLOSED (PR #23 squash merge is the planning base)
**Shopify Admin API target:** `2026-07` (`ApiVersion.July26`) — do not change
**Production execution:** NOT AUTHORIZED
**Inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF

This document is the implementation-grade product-owner planning packet for Phase 1 PR 5. It authorizes **planning and documentation only**. It does **not** authorize runtime implementation, schema/migration work, Shopify configuration changes, GraphQL document changes, feature-flag changes, production access, or PR 6.

Historical `stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md` is **not** implementation authority. This brief does **not** import that plan’s deferred receipt, cost-ledger, entitlement, billing, AI, or app-initiated inventory-event-ledger scope.

Official Shopify facts below were read from `shopify.dev` Admin GraphQL / REST `2026-07` documents and the bulk-operations guide on **2026-08-14**. Community posts are not API authority.

---

## 1. Status / authority

| Field | Value |
|---|---|
| Product owner | ChatGPT |
| Planning decision | **D-053 — Phase 1 PR 5 planning authorization** |
| D-053 scope | Planning / documentation unit only |
| Implementation | **NOT AUTHORIZED** |
| Planning base SHA | `de1bb193a43ef87cf59acafeac4c5748e62d423d` |
| PR #23 | CLOSED / MERGED; squash merge equals the planning base SHA |
| Post-merge main CI at that SHA | run `31802835318`, job `94774629793`, conclusion `success` |
| PR 4 technical authority | **D-052 remains** — PR 4 repository implementation accepted and formally closed |
| D-053 vs D-052 | D-053 is **not** a PR 4 correction, acceptance, or closure decision |
| Phase 1 | **IN PROGRESS** |
| PR 5 runtime | **NOT STARTED** |
| Proposed future implementation branch (not created) | `phase-1/catalog-location-inventory-facts` |
| Production execution | Unauthorized |
| Production backfill / ownership repair / deployment | Unauthorized |
| Shopify mutation | None in PR 5 |
| Inventory-write flags | `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` remain **DEFAULT OFF** |

PR 5 runtime implementation remains **NOT STARTED** and **NOT AUTHORIZED** until all of the following are true:

1. this planning PR is reviewed;
2. independent plan review is completed if requested by ChatGPT;
3. ChatGPT accepts the final PR 5 brief;
4. this planning PR is merged;
5. ChatGPT separately authorizes implementation.

Repository acceptance of a later PR 5 implementation PR will **not** mean Phase 1 is complete. PR 6 cannot begin until PR 5 implementation is independently reviewed, accepted, merged, and closure-synchronized.

---

## 2. Objective

Replace the thin legacy catalog/inventory cache (`ShopifyVariantCache`, `InventorySnapshot`) with tenant-safe, Shopify-authoritative, deletion-aware, scalable **canonical read facts** for:

- products;
- variants;
- inventory items;
- locations;
- inventory levels / current inventory-state quantities.

Integrate the new fact-application layer with the **accepted PR 4 durable synchronization control plane**. Do not redesign dispatcher, job-envelope, replay, fair-dispatch, or readiness architecture.

**No Shopify mutation.** PR 5 is read-only with respect to Shopify.

---

## 3. In scope

- Canonical Product read facts.
- Canonical Variant read facts.
- Canonical InventoryItem read facts.
- Canonical Location read facts.
- Canonical InventoryLevel / current inventory-state facts.
- Source timestamps, lineage, and freshness.
- Tombstone / deletion state.
- Initial synchronization through the PR 4 control plane.
- Incremental refetch from webhook signals.
- Complete pagination (no silent `first: 50` / `first: 250` caps).
- Bulk-operation integration using the persisted Shopify BulkOperation GID.
- Streaming JSONL ingestion, line by line, bounded memory, batched persistence.
- Idempotent / restart-safe application.
- Deletion and recreation identity behavior (Shopify GID is identity).
- Sync watermarks / cursors through existing PR 4 `SyncRun` / `SyncCursor` records.
- Focused reconciliation / refetch because not every inventory state is a complete webhook payload.
- Tenant enforcement for every new merchant-domain table (PR 1–3 accepted architecture).
- Temporary legacy compatibility projections that do **not** become a second authority.
- Isolation of canonical fact application from Phase 2 forecast / ABC / low-stock side effects.

---

## 4. Explicit out of scope

- Phase 2 forecasting formulas or Smart Forecasting.
- ABC/U redesign.
- Buying Table / replenishment redesign.
- Low-stock product/vendor report behavior.
- Supplier workflow expansion.
- PO redesign.
- Receiving / receipt ledgers.
- Adjustments, stocktakes, transfers.
- Inventory mutation of any kind.
- Cost ledger / landed cost.
- Shopify cost **writes**.
- Billing / entitlements / AI.
- POS, labels, Flow.
- Order / refund fact redesign (PR 6).
- Audit / role / privacy completion (PR 7).
- Phase 1 exit / performance certification (PR 8).
- Production deployment, production backfill, ownership repair.
- Q-004 incoming-inventory forecast policy (Phase 2).
- App-initiated inventory event ledger (later inventory-write phases).
- Enabling any feature flag.
- Changing the approved `2026-07` API target.

Existing gated mutation helpers in `app/services/shopify-sync.server.ts` (`adjustShopifyInventory`, transfer helpers) may remain **untouched and gated**. PR 5 must not extend or activate them.

---

## 5. Canonical authority rules

1. **Shopify is authoritative** for shops, locations, products, variants, inventory items, and sellable inventory states.
2. **Shopify GIDs are identity.** Persist `gid://shopify/Product/…`, `ProductVariant`, `InventoryItem`, `Location`, and `InventoryLevel` GIDs exactly.
3. **SKU, barcode, title, handle, and vendor are attributes, not identity.**
4. **Recreated products/variants/inventory items are new identities** (new GIDs). Never silently merge history by SKU, barcode, or title.
5. **Deletion must tombstone.** Preserve enough historical identity that later GIDs with the same SKU/barcode/title cannot be mistaken for the deleted row.
6. **Webhooks are signals, not authoritative fact payloads.** They may duplicate, delay, reorder, miss, or truncate nested records (official product webhooks include full variant payloads only for the first 100 variants).
7. **Authoritative refetch is required** wherever the resource remains queryable.
8. **Delete topics** apply tombstones from verified identity in the sanitized projection; they must not invent a replacement row.
9. **No sync run is successful** until extraction, database application, watermarks, and incompleteness/failure status are recorded.
10. **Partial bulk results are not a successful full synchronization.**

The application stores synchronized facts, snapshots, lineage, and control-plane evidence. It does not become a second commerce/inventory authority.

---

## 6. Data-model requirements

Logical names below are planning names. Implementation may use equivalent Prisma model names if they remain tenant-safe and are registered in enforcement manifests. Additive migrations only.

All new merchant-domain models:

- non-null `shopId`;
- `@@unique([shopId, id])`;
- tenant-leading unique identity `@@unique([shopId, shopifyGid])` (or the resource-specific GID column);
- child composite FKs including `shopId`;
- forced RLS + shopId immutability + restricted runtime role (PR 3 contract);
- `createdAt` / `updatedAt` app timestamps distinct from Shopify source timestamps.

Shared lineage columns (every canonical fact):

| Field | Purpose |
|---|---|
| `shopifyCreatedAt` / `shopifyUpdatedAt` | Shopify source timestamps where exposed |
| `lastSeenAt` | Last time this GID was observed as present |
| `lastRefreshedAt` | Last authoritative refetch/apply |
| `lastSyncRunId` | PR 4 `SyncRun.id` that last applied this row |
| `lastDurableJobId` | Applying durable job |
| `sourceKind` | `FULL_SYNC` \| `INCREMENTAL_REFETCH` \| `DELETE_WEBHOOK` \| `RECONCILE` |
| `deletedAt` | Tombstone timestamp; null if live |
| `deletionSource` | `WEBHOOK` \| `FULL_SYNC_ABSENCE` \| `DISCONNECT` \| null |
| `shopifyLegacyResourceId` | REST numeric id when needed to join webhook payloads |

### 6.A Product — `ShopifyProductFact`

| Field | Requirement |
|---|---|
| `shopId` | Direct ownership |
| `shopifyGid` | Product GID (identity) |
| `title` | Shopify `Product.title` |
| `handle` | Attribute only; useful for filters; not identity |
| `vendor` | Shopify product vendor (PRD 3.2 / F-016) |
| `productType` | Filter field |
| `tags` | Persist as ordered text array from Shopify `[String!]!` |
| `status` | `ACTIVE` \| `ARCHIVED` \| `DRAFT` \| `UNLISTED` (`ProductStatus` on 2026-07) |
| `featuredMediaUrl` | Image reference needed by approved catalog scope; do **not** use deprecated `Product.images` as the primary write |
| `shopifyCreatedAt` / `shopifyUpdatedAt` | Exposed on Product |
| tombstone + lineage | Required |

**Collections for filters:** persist a child membership table `ShopifyProductCollectionMembership` (`shopId`, product GID, collection GID, collection title snapshot). Do **not** build a full Collection domain or collection-rule engine in PR 5. Membership GIDs are attributes of the product, not a merge key.

Do not persist product HTML body or SEO as operational catalog facts.

### 6.B Variant — `ShopifyVariantFact`

| Field | Requirement |
|---|---|
| `shopId` | Direct ownership |
| `shopifyGid` | Variant GID (identity) |
| `shopifyProductGid` | Parent product GID |
| `title` | Variant title |
| `displayName` | Shopify `displayName` when selected |
| `selectedOptions` | JSON array of `{ name, value }` from `selectedOptions` |
| `sku` | Attribute; nullable; **not unique** |
| `barcode` | Attribute; nullable; **not unique** |
| `priceAmount` | Exact decimal from `ProductVariant.price` (`Money` scalar = string) |
| `compareAtPriceAmount` | Exact decimal from `compareAtPrice` (`Money` scalar; nullable) |
| `currencyCode` | Shop default currency at apply time (`Shop.currencyCode` / shop query); `Money` has no currency on the field |
| `mediaUrl` | Variant image/reference from **non-deprecated** `media` (or product featured media fallback). Do **not** generate new GraphQL against deprecated `ProductVariant.image` |
| `position` | Optional ordering attribute |
| `shopifyCreatedAt` / `shopifyUpdatedAt` | Required |
| tombstone + lineage | Required |
| composite FK | `(shopId, shopifyProductGid)` → product fact, including tombstoned parents |

**Money rule:** never `Number` / `parseFloat` / JS float arithmetic for `price` or `compareAtPrice`. Persist `NUMERIC`/`Decimal` from the exact source string. Do not silently round to 2 places.

No unique index on `(shopId, sku)` or `(shopId, barcode)`.

### 6.C Inventory item — `ShopifyInventoryItemFact`

| Field | Requirement |
|---|---|
| `shopId` | Direct ownership |
| `shopifyGid` | InventoryItem GID (identity) |
| `shopifyVariantGid` | Related variant GID when known |
| `sku` | Shopify `InventoryItem.sku` when supplied (attribute) |
| `tracked` | Required |
| `requiresShipping` | Persist for future operational truth; unused by PR 5 workflows |
| `weightValue` / `weightUnit` | From `measurement.weight`. Official `Weight.value` is GraphQL `Float`; persist as decimal text/`NUMERIC` from the JSON token without claiming money-safety. Not a monetary field |
| `unitCostAmount` | `InventoryItem.unitCost.amount` (`Decimal` serialized as string) |
| `unitCostCurrencyCode` | `unitCost.currencyCode` |
| `unitCostAccess` | `PRESENT` \| `NULL` \| `OMITTED_NO_PERMISSION` \| `QUERY_ERROR_ISOLATED` |
| `shopifyCreatedAt` / `shopifyUpdatedAt` | Required |
| tombstone + lineage | Required |

**Unit-cost permission rule (official 2026-07):** `unitCost` requires `read_inventory` or `read_products`, **and** “the user must have ‘View product costs’ permission granted in order to access this field once product granular permissions are enabled.”

Missing permission **must not fail the entire catalog sync**:

1. Request `unitCost` in the bulk/read query.
2. If the field is `null`, persist `unitCostAccess=NULL` and continue.
3. If Shopify returns a field-level access error, retry/continue **without** `unitCost` for that shop/run, persist `OMITTED_NO_PERMISSION` / `QUERY_ERROR_ISOLATED`, open a `DataIssue`, and complete other facts.
4. Never write Shopify cost. `FEATURE_COST_SYNC` stays DEFAULT OFF.

### 6.D Location — `ShopifyLocationFact`

| Field | Requirement |
|---|---|
| `shopId` | Direct ownership |
| `shopifyGid` | Location GID (identity) |
| `name` | Required |
| `isActive` | Shopify `isActive` |
| `deactivatedAt` | Shopify `deactivatedAt` when present |
| `fulfillsOnlineOrders` | Operational identity |
| `shipsInventory` | Operational identity |
| `isFulfillmentService` | Operational identity |
| `hasActiveInventory` | Operational identity |
| `address1`, `city`, `provinceCode`, `countryCode`, `zip` | Useful address without unnecessary sensitive data |
| **Do not persist** | `phone`, lat/long, suggested addresses |
| `shopifyCreatedAt` / `shopifyUpdatedAt` | Exposed on Location |
| tombstone + lineage | Required |

Replace `fetchLocations` `locations(first: 50)` with **complete cursor pagination** (loop `pageInfo.hasNextPage`). Bulk query of `locations` is an acceptable complete alternative, but the acceptance test is **>50 locations with no silent cap**, not “used bulk so pagination was skipped.”

### 6.E Inventory level / current state — `ShopifyInventoryLevelFact`

Official 2026-07 quantity names (`inventoryProperties.quantityNames` / inventory-states guide):

| Name | Persist separately | Notes |
|---|---|---|
| `available` | **Required** | Sellable; **not** physical on-hand |
| `on_hand` | **Required** | Physical stocked units; official sum of available + committed + reserved + damaged + safety_stock + quality_control. **Store Shopify’s reported value; do not recompute as authority** |
| `incoming` | **Required** | Shopify incoming only. **Not** app PO incoming. Q-004 remains Phase 2 |
| `committed` | **Required** | Order allocations; not writable via Admin adjust/move |
| `reserved` | **Required** | Persist even when `isInUse=false` for a shop |
| `damaged` | **Required** | |
| `safety_stock` | **Required** | Shopify quantity name; unrelated to app forecast safety-stock policy |
| `quality_control` | **Required** | |

Do **not** equate `available` with `on_hand`.

Also persist:

- inventory-level GID (identity);
- inventory-item GID;
- location GID;
- `isActive` / connectivity;
- `shopifyCreatedAt` / `shopifyUpdatedAt`;
- per-name `updatedAt` when Shopify returns `InventoryQuantity.updatedAt`;
- observed/refreshed timestamps and source lineage.

**Connect:** upsert live relationship, `isActive=true`, `deletedAt=null`.
**Disconnect:** `isActive=false` and/or `deletionSource=DISCONNECT`; do not reuse the row for a different item/location pair.
**Do not** invent an app-initiated inventory event ledger.

Unknown future quantity names: ignore for first-class columns; record a `DataIssue` if Shopify returns an unexpected name. Do not silently drop the eight named states.

---

## 7. Legacy model migration / compatibility

### Current legacy models (main)

`ShopifyVariantCache`: shop-string unique on variant GID; title, sku, barcode, imageUrl, inventoryItemId, weight. Missing vendor, prices, status, tags, product fields, tombstones, lineage, tenant-canonical uniqueness.

`InventorySnapshot`: daily `quantityAvailable` only, keyed by shop + variant + location + `snapshotDate`. Not current multi-state inventory truth. Not on_hand/incoming/committed.

### Chosen strategy

**New canonical models plus temporary compatibility projections.**

Justification:

- In-place expansion of `InventorySnapshot.quantityAvailable` would silently change meaning for existing consumers (forecast `onHand`, stocktake freeze, analytics).
- `ShopifyVariantCache` cannot represent product-level facts, tombstones, or money-safe prices without a breaking reinterpretation.
- Additive new tables keep PR 1–3 tenant rows intact and avoid destructive drops.

### Canonical after PR 5

| Concern | Canonical | Compatibility only |
|---|---|---|
| Product / variant / item / location / current quantities | New `*Fact` tables | — |
| Buying Table / barcode lookup / legacy jobs | — | `ShopifyVariantCache` projection |
| Daily available snapshot used by legacy forecast | — | `InventorySnapshot.quantityAvailable` for **today** copied from canonical `available` |

Projection rules:

- Projection runs **after** canonical apply succeeds, in a separate step that **cannot fail the canonical apply**.
- Projection must not call forecast, ABC, or low-stock logic.
- Do not drop legacy tables or `shop` columns in PR 5.
- Do not add unique SKU constraints to legacy tables.

### Later cleanup

Legacy duplicate authority must not become permanent. Cleanup is **not** PR 5. Earliest candidate: a later focused PR after Phase 2 (or remaining Phase 1 consumers) read canonical facts. Record as residual **R-142**.

---

## 8. Initial sync design

Use the existing PR 4 `catalog-sync` durable job (`enqueueCatalogSync` / `enqueueAfterAuthCatalogSync`). Do not redesign dispatcher, envelope v3, application receipts, attempt lifecycle, dead letters, replay, disabled-shop denial, or fair dispatch.

### 8.1 Control-plane mapping

| Concern | Design |
|---|---|
| Durable job | Existing `catalog-sync`; execution strategy remains `REBUILDABLE_IDEMPOTENT` |
| Payload schema | New `catalog-sync-v2` (smallest compatible extension). v1 remains the historical thin-cache rebuild and must not be the PR 5 applicator |
| Envelope | `tenant-job-envelope-v3`; source `catalog_sync` / `after_auth_catalog_sync` unchanged |
| Sync domains | `locations`, `catalog`, `inventory_levels` — three `SyncRun` rows under one logical catalog-sync job |
| BulkOperation ID | Persist the exact GID returned by `bulkOperationRunQuery` on the `SyncRun` (dedicated column **or** `cursorAfter` / `resultMetadata` — implementation chooses the smallest additive schema change). Lookup **only** via `bulkOperation(id:)` or `node(id:)` |
| **Forbidden** | `currentBulkOperation` in any PR 5 document or helper |

Official 2026-07: `currentBulkOperation` is **Deprecated**; “Use `bulkOperations` with status filter instead.” Direct lookup: `bulkOperation(id: ID!)`. Guide for 2026-01+: poll `bulkOperation(id:)`. `url` and `partialDataUrl` expire **7 days**.

Also subscribe to `bulk_operations/finish` as a **signal** (recommended by the official bulk guide). The webhook payload is not the JSONL. After the signal, refetch `bulkOperation(id:)` using the **persisted** GID, not “the current” operation. Webhook delivery is not guaranteed; polling the persisted ID remains required. One shop may run up to **five** bulk query operations simultaneously on 2026-07; still bind each `SyncRun` to its own GID so concurrent ops cannot be confused.

### 8.2 Bulk queries (read-only)

Respect official restrictions: one top-level connection; max **five** connections; max **two** nested connection levels; connections must implement `Node`; no top-level `node`/`nodes`; `first`/`cursor`/`pageInfo` are optional and ignored. `groupObjects` must remain **false** (official: grouping slows operations and increases timeouts).

**Catalog bulk (proposed):** `products { variants { inventoryItem { … unitCost } } collections { id title } }`. Keep connection count ≤ 5 and nesting ≤ 2. Variant media: prefer a non-connection field or a nesting-safe selection; if `media` would exceed depth, persist product `featuredMedia` in PR 5 and leave extra media to a later PR.

**Inventory-level bulk (proposed):** `inventoryItems { inventoryLevels(includeInactive: true) { id isActive createdAt updatedAt location { id } quantities(names: [all eight]) { name quantity updatedAt } } }`.

**Locations:** complete GraphQL cursor pagination in the worker (validated complete mechanism). Not `first: 50` with discarded `pageInfo`.

Do **not** nest `products → variants → inventoryLevels` if that exceeds bulk depth; use the split above.

### 8.3 JSONL application

Official JSONL: each line is a node; nested connections are flattened; `__parentId` is added automatically and **cannot be queried**. Parents appear before children.

Required implementation properties:

- Stream the result URL incrementally (HTTP stream + line reader).
- **No** `response.text()` + `split('\n')` of the full body.
- **No** full `variants[]` materialization.
- **No** one GraphQL call per row.
- **No** one database transaction per row as the steady-state pattern.
- Bounded memory: O(batch size), not O(catalog).
- Batch upserts (planning ceiling: see tests; start at ≤500 rows / transaction, configurable).
- Idempotent upsert on `(shopId, shopifyGid)`.
- Checkpoint JSONL byte/line offset + last applied GID on the `SyncRun`.
- Restart: if the same BulkOperation is still `COMPLETED` and `url` unexpired, resume from checkpoint; if expired, start a **new** bulk operation and do not mark the previous run `SUCCEEDED`.

### 8.4 Failed bulk / `partialDataUrl` — chosen rule

**Chosen: (a) discarded from canonical completion and retained only for diagnostics.**

- Do **not** apply `partialDataUrl` JSONL to canonical fact tables.
- Record `SyncRun` `FAILED` or `PARTIAL_FAILURE` with `partialFailure=true`.
- Persist BulkOperation GID, `status`, `errorCode`, `objectCount`, `rootObjectCount`, and `partialDataUrl` **metadata** (not merchant-domain facts) for diagnostics until expiry.
- Open a `DataIssue`.
- **Never** advance a full-sync success watermark (`SyncCursor` / `HEALTHY` successor) from partial or failed data.
- Do **not** tombstone-by-absence using a partial set (that would delete live GIDs that simply were not in the incomplete file).

Rationale vs (b): staging incomplete rows as live canonical facts would make deletion/recreation and completeness proofs false. Control-plane incomplete evidence is already expressible as `PARTIAL_FAILURE` + `DataIssue` without applying rows.

### 8.5 Success watermark

A domain watermark advances to “full sync succeeded” only when:

1. BulkOperation `status=COMPLETED` (or locations pagination exhausted with no errors);
2. JSONL/pages fully applied;
3. checkpoints complete;
4. absence-tombstones for that domain ran against the **complete** observed GID set;
5. `SyncRun.status=SUCCEEDED`.

Locations, catalog, and inventory_levels watermarks are independent. Catalog-sync job success requires all three domain runs succeeded; otherwise the durable job retries/rebuilds per `REBUILDABLE_IDEMPOTENT` without claiming HEALTHY for failed domains.

### 8.6 Shop currency

Once per catalog-sync (not per row), read `shop { currencyCode }` and apply that code to variant `Money` fields. Persist the code with the amounts.

---

## 9. Location sync

Current defect: `fetchLocations` uses `locations(first: 50)` and returns the first page only (`app/services/shopify-gql.server.ts`).

PR 5 must:

- page with cursors until `hasNextPage` is false (or a validated complete bulk locations query);
- persist every location GID for the shop;
- tombstone locations present in canonical facts but absent from a **complete** location sync;
- treat `locations/deactivate` as inactive, not necessarily deleted;
- treat `locations/delete` as tombstone.

Acceptance: a fixture/shop with **>50 locations** must persist all of them. A test that uses `first: 50` internally and never asserts page 2 is a fail.

---

## 10. Incremental sync / webhook plan

### 10.1 Official 2026-07 topics (REST webhook resource allowlist + GraphQL `WebhookSubscriptionTopic`)

Verified present on Admin REST 2026-07 webhook allowlist:

| Resource | Topics | Scope |
|---|---|---|
| Product | `products/create`, `products/update`, `products/delete` | `read_products` |
| Inventory item | `inventory_items/create`, `inventory_items/update`, `inventory_items/delete` | `read_inventory` / products |
| Inventory level | `inventory_levels/connect`, `inventory_levels/update`, `inventory_levels/disconnect` | `read_inventory` |
| Location | `locations/create`, `locations/update`, `locations/delete`, `locations/activate`, `locations/deactivate` | `read_locations` |
| Bulk | `bulk_operations/finish` | signal for catalog-sync |

Official product webhook caveat: full variants payload only for the **first 100** variants; higher records expose `variant_gids` only. This **alone** forbids treating the webhook body as catalog truth.

Official `products/delete` sample payload is `{ "id": … }` only — tombstone from REST id / GID when present; do not refetch a deleted product as a live fact.

Current toml only registers `inventory_levels/update` among these. PR 5 implementation (when authorized) must add the topics above. That is **not** authorized by this planning PR.

### 10.2 Application rule

```text
HMAC webhook
  → PR4 durable intake (sanitizer + digest + WebhookDelivery)
  → DurableJob PENDING
  → dispatcher / envelope v3
  → worker: processingEnabled check
  → identity assertions
  → authoritative GraphQL refetch OR tombstone if unqueryable
  → tenant transaction: canonical upsert/tombstone
  → application receipt / lifecycle completion
  → optional legacy projection (non-blocking for canonical success)
```

Sanitizers persist **identity + signal metadata only** (topic, REST ids, GIDs, `updated_at` if present). Do not persist full product HTML or treat `available` from `inventory_levels/update` as the complete quantity vector.

New envelope sources are the **smallest allowlist extension** (`TENANT_JOB_SOURCES` / `JOB_SOURCE_BY_NAME`). Execution strategy: `ATOMIC_APPLICATION_RECEIPT` for resource webhooks (same as current inventory_levels/update). `bulk_operations/finish`: `CONTROL_ONLY` or a documented continuation of the existing `catalog-sync` run keyed by persisted BulkOperation GID — not a second competing applicator.

### 10.3 Resource rules

| Signal | Action |
|---|---|
| products create/update | Refetch product + variants + inventory item by GID; upsert; do not merge by SKU |
| products delete | Tombstone product and, after refetch-or-absence, variants still keyed to that product if Shopify no longer returns them |
| inventory_items create/update | Refetch item (+ linked variant if returned) |
| inventory_items delete | Tombstone item; do not remap SKU onto another item |
| inventory_levels connect | Upsert level relationship; refetch quantities |
| inventory_levels update | **Refetch all eight quantity names**; ignore webhook `available` as complete truth |
| inventory_levels disconnect | Deactivate canonical relationship. Official 2026-07 sample payload is `{ inventory_item_id, location_id }` only — no GID. Map identity from shop + inventory-item GID/REST id + location GID/REST id; do not invent a new level GID |
| locations create/update/activate/deactivate | Refetch location |
| locations delete | Tombstone |

Variant deletion/recreation: a `products/update` or missing variant GID after refetch tombstones the old variant GID. A later variant with the same SKU is a **new** `ShopifyVariantFact` row.

### 10.4 Inventory states that webhooks do not fully cover

Official `inventory_levels/update` payload is an inventory-level **notification** whose documented sample fields are `inventory_item_id`, `location_id`, `available`, timestamps, and GID — **not** the GraphQL `quantities` array (`incoming`, `on_hand`, `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control`).

Therefore:

- Incremental update **must refetch** `quantities(names: [all eight])`.
- Periodic/reconcile refetch is required so shops cannot remain permanently stale on states that did not appear in the webhook body, and for missed/duplicated webhooks (Phase 1 brief rule).

**Reconcile job (in PR 5 scope, not PR 8 exit):** `inventory-state-reconcile`, `REBUILDABLE_IDEMPOTENT`, tenant envelope, existing dispatcher. Default cadence: not faster than every 5 minutes per shop and not slower than every 60 minutes while `processingEnabled`. Implementation may coalesce with inventory webhooks (debounce) but must still run when no webhook arrived.

This is **not** Phase 1 reconciliation/performance exit. PR 8 remains the final R-034 / cross-domain exit unit.

---

## 11. Legacy forecast / ABC side-effect boundary

Current `handleInventoryUpdate` (`app/jobs/workers/webhook-processor.ts`):

1. upserts `InventorySnapshot.quantityAvailable` from webhook `available`;
2. calls `computeForecast`;
3. may `lowStockAlert.create` for ABC class A.

**PR 5 decision:** canonical fact ingestion **must not** depend on or invoke Phase 2 forecasting, ABC, replenishment, or low-stock logic.

Isolation:

- Canonical applicator lives in a new read-fact module and **must not import** `app/services/forecasting.server.ts`.
- Canonical apply success/failure is independent of legacy projection and of forecast/ABC.
- Remove forecast/ABC/low-stock calls from the inventory webhook **canonical** path. Justification: they are unauthorized coupling of a Phase 1 fact pipeline to known-wrong Phase 2 behavior (R-004). This is **not** a Phase 2 feature change; characterization tests keep current forecast defaults when `computeForecast` is invoked directly.
- Weekly/`abc-analysis-shop` jobs remain as they are; PR 5 does not redesign them.
- If a test today expects a low-stock row from `inventory_levels/update`, replace that expectation with: canonical quantities applied **and** no `LowStockAlert` / `VariantAbcClass` write from the canonical applicator.

---

## 12. Read-only / write safety

PR 5 is read-only vs Shopify.

Forbidden in PR 5 code paths:

- `inventoryAdjustQuantities`, `inventorySetQuantities`, `inventoryMoveQuantities`, `inventoryActivate` (write), `inventoryItemUpdate`, product/variant mutations, transfer mutations, cost writes.

Required boundary:

- New `admin-read` helper module used by catalog/location/inventory fact sync.
- Catalog fact modules must not import write helpers in `shopify-sync.server.ts`.
- Add an automated scanner/test: PR 5 fact files contain none of the write mutation names.
- Do not enable any feature flag. All inventory-write flags remain DEFAULT OFF.
- Existing gated helpers stay untouched.

---

## 13. Tenancy

Every new merchant-domain table must comply with accepted PR 1–3 architecture:

- direct `shopId`;
- tenant-composite uniques and FKs;
- ENABLE+FORCE RLS with `USING`/`WITH CHECK`;
- immutable `shopId` trigger;
- restricted runtime role; no `BYPASSRLS`;
- tenant-bound access only (`TenantDb`);
- real PostgreSQL cross-shop denial tests;
- enforcement manifests/verifiers updated (`scripts/tenant-enforcement/manifest.ts`, tenant model lists, selectors, index manifests as required).

**Do not weaken RLS to simplify bulk ingest.** Batched writes still run inside transaction-local tenant context. Control-plane `SyncRun` rows remain platform_control_plane as in PR 4; fact tables are merchant_domain.

New tables should be Prisma-non-null `shopId` (no legacy `shop` column required). They still need `(shopId, id)` uniqueness and enforcement inventory entries.

---

## 14. PR 4 control-plane compatibility

Preserve:

- durable jobs, v3 envelope authority, application receipts, attempt lifecycle, dead letters/replay;
- disabled-shop denial;
- dispatch identity assertions;
- accepted **R-122 / R-123** residual posture (no fair-dispatch/readiness redesign; no static writer-shape guard in PR 5);
- D-051 transaction-shape invariant (do not introduce multi-shop readiness locks in a dangerous order).

Smallest compatible extensions (implementation, when authorized):

| Extension | Why |
|---|---|
| `catalog-sync-v2` payload schema | v1 applicator is the unsafe full-JSONL cache rebuild |
| New webhook sources + sanitizers | Required topics are not on the PR 4 allowlist |
| Optional `SyncRun` field for BulkOperation GID | Avoid polling deprecated `currentBulkOperation` |
| `inventory-state-reconcile` job type | Missed-state refetch without redesigning cron architecture |
| `REBUILDABLE_IDEMPOTENT` reuse | Catalog rebuild and inventory reconcile |

Do not add a new envelope major version unless v3 cannot bind the new sources (it can: allowlist update only).

---

## 15. Money safety

PR 6 remains the formal Phase 1 order/refund **R-014** gate. PR 5 must still not introduce lossy monetary facts for:

- variant `price` (`Money` string);
- variant `compareAtPrice` (`Money` string);
- inventory-item `unitCost.amount` (`Decimal` string) + `currencyCode`.

Rules:

- No JavaScript `Number`, `parseFloat`, or float arithmetic on these values.
- Persist exact source strings into PostgreSQL `NUMERIC`/`Decimal`.
- Persist currency with the amount (`Money` → shop `currencyCode`; `MoneyV2` → field currency).
- Tests must include values that are not binary-float-safe (for example `"0.1"`, `"19.99"`, high-precision Decimal strings) and assert round-trip equality with the source string.

Weight is officially `Float` and is **not** a monetary fact; do not use weight code paths for prices.

---

## 16. Test / acceptance plan

Implementation (when authorized) must add **positive, negative, bypass, and partial-failure** tests. Focused CI steps must run nonzero tests and fail if none are collected. Mocked PostgreSQL RLS is not evidence.

### A. Schema / tenancy

- Fresh-db migrations pass.
- Tenant enforcement apply / verify / drift pass.
- Every new merchant table appears in enforcement verification.
- Cross-shop reads/writes denied in real PostgreSQL.
- `shopId` mutation denied (trigger).
- Missing tenant context default-deny.
- Bypass: raw SQL / wrong-shop `shopId` insert denied.

### B. GraphQL

- Codegen against approved **2026-07** succeeds.
- Deliberately invalid document falsification probe fails.
- **No** `currentBulkOperation` in PR 5 implementation (search gate).
- Chosen webhook topics validated against current official API / toml after implementation.
- Bulk query documents violate neither connection-count nor nesting-depth rules (codegen + documented query review).

### C. Scale / completeness

- **>50 locations** persist completely (proves no location cap).
- **>250 variants** persist completely (proves no catalog cap).
- Bounded-memory large JSONL streaming test (fail if heap exceeds an explicit ceiling; planning ceiling: 256MB for a multi-hundred-thousand-line fixture).
- Explicit DB query/write-count ceiling for batched ingest (fail on N+1; planning: writes = O(rows/batch size), Shopify reads for full sync = O(1 bulk ops + location pages), not O(rows)).
- No N+1 Shopify reads on incremental refetch of a single resource (one refetch query per signal, not per quantity name).

Full R-034 certification (50k variants / 15 locations / 750k states, p95) remains **PR 8**. PR 5 must not knowingly introduce an architecture that cannot scale toward that envelope (no full-buffer JSONL, no per-row GraphQL, no per-row transactions as the design).

### D. Idempotency / recovery

- Replay of the same full sync converges (no duplicate GIDs; tombstones stable).
- Interrupted batch resumes/retries safely from checkpoint.
- Duplicate / out-of-order incremental signals converge to the refetch result (last authoritative apply wins; webhook `available` cannot override a newer refetch).
- Failed bulk + `partialDataUrl` does **not** advance a success watermark (partial-failure test).
- Expired result URL starts a new bulk op and does not fake success.

### E. Identity / deletion

- Product delete tombstones the product GID.
- Variant deletion/recreation: two GIDs, same SKU/barcode/title, both retained; history not merged.
- Inventory-item delete tombstoned.
- Location delete vs deactivate distinguished.
- Inventory-level connect / update / disconnect handled.

### F. Inventory-state truth

- `available` and `on_hand` remain distinct in persistence and tests.
- `incoming` and `committed` remain distinct.
- `reserved`, `damaged`, `safety_stock`, `quality_control` persisted.
- Missed-webhook-state scenario: change only a non-`available` quantity with **no** `inventory_levels/update` (or with a payload that omits that name); reconcile/refetch corrects canonical facts.

### G. Control-plane regression

- PR 4 sync-control-plane suites stay green.
- R-122 / R-123 posture does not regress (equality-regression / ordered-plan gates; no readiness redesign).
- Uninstall / disabled-shop jobs remain fail-closed.
- Replay / attempt / application-receipt guarantees remain intact.
- New webhooks still HMAC → durable intake → envelope v3.

### H. General

- lint, typecheck, unit tests, migration tests, build;
- Prisma validate/generate;
- GraphQL codegen;
- `git diff --check`.

### Characterization / bypass

- Canonical ingest does not call `computeForecast` / ABC / low-stock create (negative).
- Direct `computeForecast` characterization tests still document known-wrong Phase 2 defaults (not a silent formula change).
- Write-mutation scanner: catalog fact module cannot call inventory/product write mutations (bypass attempt).
- unitCost omission does not fail catalog sync (partial-failure / permission).

---

## 17. Non-goals / release boundary

- PR 5 repository acceptance will **not** mean Phase 1 complete.
- PR 6 cannot begin until PR 5 **implementation** is independently reviewed, accepted, merged, and closure-synchronized.
- No production deployment is authorized.
- **Q-002** remains OPEN (Partner Dashboard / environment separation).
- **R-028 / R-029** remain OPEN (operational backfill / quarantine).
- **R-095..R-098** remain OPEN (PR 3 rehearsal residuals).
- Production inventory writes remain **UNAPPROVED**.
- Every inventory-write flag remains **DEFAULT OFF**.
- Q-004 remains OPEN; PR 5 stores Shopify `incoming` only.
- R-014 remains the Phase 1 order/refund money gate (PR 6); PR 5 still must not add lossy price/cost facts.

---

## 18. Current-main defects this PR is planned to replace

Observed on planning base `de1bb193…` (read-only inspection; not changed by this planning PR):

| Defect | Evidence |
|---|---|
| Location cap | `fetchLocations` `locations(first: 50)` |
| Bulk poll via deprecated API | `pollBulkOperation` queries `currentBulkOperation` |
| Full JSONL in memory | `ingestBulkVariantCache` `response.text()` + `split` |
| Per-row DB upsert | loop `shopifyVariantCache.upsert` |
| Thin cache | no vendor/price/status/tags/tombstone/multi-state quantities |
| Webhook `available` as truth | `handleInventoryUpdate` writes `quantityAvailable` from payload |
| Forecast coupling | same handler calls `computeForecast` / `lowStockAlert` |
| Write helpers colocated | `adjustShopifyInventory` in the same module as bulk ingest |

---

## 19. Official Shopify 2026-07 sources (accessed 2026-08-14)

| Topic | Source |
|---|---|
| Product fields / status | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Product ; https://shopify.dev/docs/api/admin-graphql/2026-07/enums/ProductStatus |
| ProductVariant / Money | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/ProductVariant ; https://shopify.dev/docs/api/admin-graphql/2026-07/scalars/Money |
| InventoryItem / unitCost permission | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem |
| Location / address | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Location ; https://shopify.dev/docs/api/admin-graphql/2026-07/objects/LocationAddress |
| InventoryLevel / quantities | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryLevel ; https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryQuantity ; https://shopify.dev/docs/api/admin-graphql/2026-07/queries/inventoryProperties |
| Inventory states / on_hand definition | https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states |
| MoneyV2 / Decimal | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MoneyV2 ; https://shopify.dev/docs/api/admin-graphql/2026-07/scalars/Decimal |
| BulkOperation / partialDataUrl / 7-day expiry | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/BulkOperation |
| `bulkOperation(id:)` | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/bulkOperation |
| `currentBulkOperation` deprecated | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/currentBulkOperation |
| Bulk query restrictions / JSONL / `__parentId` / poll-by-id | https://shopify.dev/docs/api/usage/bulk-operations/queries |
| Webhook topics allowlist | https://shopify.dev/docs/api/admin-rest/2026-07/resources/webhook |
| Product webhook 100-variant caveat | same REST webhook resource, `products/create` and `products/update` |

API target remains **2026-07**. This planning task does not bump versions.

---

## 20. Implementation authorization (explicitly withheld)

When ChatGPT later authorizes implementation, the approved unit is a **new** branch from then-current `main`, proposed name `phase-1/catalog-location-inventory-facts`, covering only this brief.

Until then:

- do not create the implementation branch;
- do not modify `app/`, Prisma schema/migrations, scripts, tests, package manifests, CI, Shopify config, GraphQL documents, or feature flags as part of D-053;
- do not merge this planning PR without explicit user authorization after ChatGPT acceptance.

**PR 5 PLANNING IN PROGRESS — IMPLEMENTATION NOT AUTHORIZED.**
