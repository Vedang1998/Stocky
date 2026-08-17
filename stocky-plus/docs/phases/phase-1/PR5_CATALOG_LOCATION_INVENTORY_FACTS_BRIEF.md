# Phase 1 PR 5 Brief — Catalog, Location, and Inventory Facts

**Status:** `PR 5 IMPLEMENTATION STARTED — PR5-F1 FOUNDATION CORRECTIONS IN PROGRESS`
**Product owner:** ChatGPT
**Planning decision:** D-053 — Phase 1 PR 5 planning authorization (**ACCEPTED AND MERGED**)
**Implementation-entry decision:** D-054 — Phase 1 PR 5 implementation authorization under Accelerated Safe Delivery v1 (**EFFECTIVE**)
**Implementation owner:** Cursor
**Independent reviewer (when requested):** Claude Code
**Planning merge:** `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e`
**Planning review head before squash:** `1691933ec126eed44de81162e8492fb7f0bfae0c`
**Final immutable planning review blob:** `0d322db701f5f27b89bc4069e6fb1f3d751d15a3`
**PR #26:** CLOSED / MERGED
**PR26 accepted review-record head:** `7171c2cbbdff15ae0d92aa6850a1ae12804db3f4`
**PR26 squash merge / current `origin/main`:** `ae1b428039152efc6b4a46107e1bcca5eb17586a`
**PR26 post-merge main CI:** run `31966584542` SUCCESS
**Dependency:** Phase 1 PR 4 FORMALLY CLOSED; PR #24 / D-053 planning CLOSED / MERGED; PR #26 / D-054 implementation-entry CLOSED / MERGED
**Implementation branch:** `phase-1/catalog-location-inventory-facts`
**Shopify Admin API target:** `2026-07` (`ApiVersion.July26`) — do not change
**Production execution:** NOT AUTHORIZED
**Inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF

This document is the implementation-grade product-owner planning packet for Phase 1 PR 5, now amended by the **implementation-entry contract** that closes **F-CLAUDE-PR5C8-01** and **F-CLAUDE-PR5C8-02**. D-053 planning is **ACCEPTED AND MERGED**. D-054 is **EFFECTIVE** after PR #26 squash-merge and successful post-merge main CI (condition 9). Live implementation status is **STARTED — PR5-F1 FOUNDATION CORRECTIONS IN PROGRESS**. This document does **not** authorize production, merchant production data, inventory-write flags, Shopify inventory mutations, later PR5 runtime lanes from this foundation slice, or PR 6. Product rules in later sections are unchanged.

Historical `stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md` is **not** implementation authority. This brief does **not** import that plan’s deferred receipt, cost-ledger, entitlement, billing, AI, or app-initiated inventory-event-ledger scope.

Official Shopify facts below were read from `shopify.dev` Admin GraphQL / REST `2026-07` documents and the bulk-operations guide on **2026-08-14**. Community posts are not API authority.

---

## 1. Status / authority

| Field | Value |
|---|---|
| Product owner | ChatGPT |
| Planning decision | **D-053 — Phase 1 PR 5 planning authorization** — **ACCEPTED AND MERGED** |
| Implementation-entry decision | **D-054 — Phase 1 PR 5 implementation authorization under Accelerated Safe Delivery v1** — **EFFECTIVE** |
| D-053 scope | Planning / documentation unit — now merged |
| Implementation | **STARTED — PR5-F1 FOUNDATION IN PROGRESS** |
| Planning historical base SHA | `de1bb193a43ef87cf59acafeac4c5748e62d423d` (PR #23) |
| PR #23 | CLOSED / MERGED; historical planning base |
| PR #24 | **CLOSED / MERGED** |
| PR #24 squash merge | `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e` |
| PR #26 | **CLOSED / MERGED** |
| PR26 accepted review-record head | `7171c2cbbdff15ae0d92aa6850a1ae12804db3f4` |
| PR26 squash merge / current `origin/main` | `ae1b428039152efc6b4a46107e1bcca5eb17586a` |
| PR26 post-merge main CI | run `31966584542`, event `push`, **SUCCESS** (Classify `95212558793` SUCCESS; CI Gate `95212578956` SUCCESS; Heavy `95212579347` SKIPPED) |
| Planning review head before squash | `1691933ec126eed44de81162e8492fb7f0bfae0c` |
| Final immutable planning review | `PR5_PLANNING_CORRECTION_8_INDEPENDENT_REVIEW.md` blob `0d322db701f5f27b89bc4069e6fb1f3d751d15a3` |
| Independent planning verdict | `APPROVE PR5 PLANNING` |
| Post-merge main CI at `edabd8de…` | run `31959761072`, event `push`, **SUCCESS** (Classify `95195836526` SUCCESS; CI Gate `95195850559` SUCCESS; Heavy `95195850790` SKIPPED) |
| PR 4 technical authority | **D-052 remains** — PR 4 repository implementation accepted and formally closed |
| D-053 vs D-052 | D-053 is **not** a PR 4 correction, acceptance, or closure decision |
| Phase 1 | **IN PROGRESS** |
| PR 5 planning | **ACCEPTED AND MERGED** |
| PR 5 runtime | **STARTED — PR5-F1 FOUNDATION IN PROGRESS** |
| Implementation branch | `phase-1/catalog-location-inventory-facts` |
| Production execution | Unauthorized |
| Production backfill / ownership repair / deployment | Unauthorized |
| Shopify mutation | None in PR 5 |
| Inventory-write flags | `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` remain **DEFAULT OFF** |

PR 5 runtime implementation is **AUTHORIZED** because **D-054** is **EFFECTIVE**. The nine activation conditions below are the historical gate; condition 9 is now satisfied. Current slice: **PR5-F1 foundation only**. Do **not** state PR 5 is complete.

D-054 became EFFECTIVE only after **all** of the following were true:

1. PR #24 / D-053 planning is merged.
2. Post-merge main CI at `edabd8de1f1b25cc5f5f1026e34ddf69aa104f7e` is successful.
3. F-CLAUDE-PR5C8-01 is resolved in this implementation-entry contract.
4. F-CLAUDE-PR5C8-02 is resolved in this implementation-entry contract.
5. Accelerated Safe Delivery v1 governance is durably recorded.
6. Claude independently reviews the exact implementation-entry PR head and returns the required approval verdict with no blocking P0/P1/P2.
7. ChatGPT explicitly authorizes merge.
8. This implementation-entry PR is squash-merged to `main`.
9. Post-merge main CI succeeds.

Condition 9 is satisfied. `phase-1/catalog-location-inventory-facts` exists and PR5-F1 foundation implementation is in progress.

D-054 does **not** authorize production, merchant production data, enabling inventory-write flags, Shopify inventory mutations, Phase 2 runtime, or PR 6 runtime before its own authority.

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
- Distinct Shopify attribute-version (clock A), authoritative existence-observation (clock B), and webhook signal-observation (clock C) so older observations cannot overwrite newer canonical facts and clocks are never compared across domains.
- Bounded-memory full-sync epoch **presence** markers that advance even when attributes no-op, and absence **candidates** that require direct confirmation (not Shopify `updatedAt` vs fence, and not bulk omission alone) before tombstone.
- Visible, rebuildable legacy compatibility-projection recovery that cannot roll back canonical facts.
- JSONL application checkpoints that do **not** assume HTTP Range on Shopify result URLs.
- Focused reconciliation / refetch because official Shopify docs state that several inventory states do not trigger webhooks.
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
2. **Shopify GIDs are identity for Product, ProductVariant, InventoryItem, and Location.** Persist those GIDs exactly. **Canonical InventoryLevel identity is the item+location pair** `(shopId, inventoryItemGid, locationGid)` (`@@unique([shopId, inventoryItemGid, locationGid])`). The Shopify InventoryLevel GID is persisted when Shopify supplies it as **lineage/reference only**; it is **not** the uniqueness key and is **never required** to process disconnect.
3. **SKU, barcode, title, handle, and vendor are attributes, not identity.**
4. **Recreated products/variants/inventory items are new identities** (new GIDs). Never silently merge history by SKU, barcode, or title.
5. **Deletion must tombstone.** Preserve enough historical identity that later GIDs with the same SKU/barcode/title cannot be mistaken for the deleted row.
6. **Webhooks are signals, not authoritative fact payloads.** Official webhook docs (accessed 2026-08-14): Shopify does **not** guarantee ordering within a topic or across topics for the same resource; delivery is **not** always guaranteed; apps must implement reconciliation. Product webhooks include full variant payloads only for the first 100 variants.
7. **Authoritative refetch is required** wherever the resource remains queryable. Delete/disconnect **signals** still require an authoritative existence check when technically possible (§6.F). A delayed delete signal must not tombstone a GID Shopify currently returns as live.
8. **Delete topics** map canonical identity from the sanitized projection, then follow §6.F. They must not invent a replacement row. They must not treat webhook arrival time as a Shopify mutation timestamp.
9. **No sync run is successful** until extraction, database application, watermarks, and incompleteness/failure status are recorded.
10. **Partial bulk results are not a successful full synchronization.**

The application stores synchronized facts, snapshots, lineage, and control-plane evidence. It does not become a second commerce/inventory authority.

---

## 6. Data-model requirements

Logical names below are planning names. Implementation may use equivalent Prisma model names if they remain tenant-safe and are registered in enforcement manifests. Additive migrations only.

All new merchant-domain models:

- non-null `shopId`;
- `@@unique([shopId, id])`;
- tenant-leading unique identity `@@unique([shopId, shopifyGid])` for Product / Variant / InventoryItem / Location; InventoryLevel uses `@@unique([shopId, inventoryItemGid, locationGid])` instead of level-GID uniqueness;
- child composite FKs including `shopId`;
- forced RLS + shopId immutability + restricted runtime role (PR 3 contract);
- `createdAt` / `updatedAt` app timestamps distinct from Shopify source timestamps.

Shared lineage columns (every canonical fact). **Do not collapse these into one `sourceVersionAt`.** Shopify timestamps, app existence observations, and webhook arrival times are **different clocks** and must never be compared to each other as one sequence.

| Field | Clock domain | Purpose |
|---|---|---|
| `shopifyCreatedAt` / `shopifyUpdatedAt` | **A — Shopify attribute version** | Shopify resource timestamps where exposed. Order **attributes only** against other Shopify `updatedAt` values. Never compare to webhook `receivedAt` or `fenceAt`. |
| `existenceState` | **B — authoritative existence** | `LIVE` \| `ABSENT`. Canonical existence, not a Shopify timestamp. |
| `existenceKind` | B | How existence was last confirmed: `LIVE_REFETCH` \| `LIVE_FULL_SYNC_PRESENT` \| `ABSENT_CONFIRMED_QUERY`. `ABSENT_FULL_SYNC_SWEEP` is **not** approved. |
| `existenceObservedAt` | B (app clock) | When **this app finished** an authoritative Shopify existence check (response in hand). Observation-completion time, **not** commit time. Same clock domain as `SyncRun.fenceAt` (app time) but **not** the apply-decision key. **Not** webhook arrival time. **Not** Shopify `updatedAt`. |
| `existenceRequestGen` | B (app-issued monotonic, interval start) | From platform sequence `stocky_catalog_observation_gen_seq` (not `Shop`). Allocated with `SELECT nextval('stocky_catalog_observation_gen_seq')` **before** issuing the direct Shopify network request that produced the last **unambiguous** existence observation. Together with `existenceResponseGen` this is `[observationRequestGen, observationResponseGen]`. These generations order **app request lifecycle only**. They do **not** claim Shopify mutation order or snapshot time. Full-sync presence / null-version bulk attributes use **`SyncRun.fenceGeneration`** (one value allocated and committed before `bulkOperationRunQuery`), not a new gen per JSONL line. |
| `existenceResponseGen` | B (app-issued monotonic, interval end) | Allocated with `SELECT nextval('stocky_catalog_observation_gen_seq')` **after** that direct request completed with an authoritative usable response and **before** entering the tenant fact transaction / identity lock. Persist that value on the in-flight row **only atomically** when the observation leaves `ACTIVE` (§6.F.2.3). Do **not** use `existenceResponseGen` alone to order concurrent overlapping observations. |
| `signalReceivedAt` | **C — signal observation** | Webhook/control arrival time at this app. Lineage / causation / diagnostics only. **Not** proof the signalled state is still current. **Not** a Shopify mutation timestamp. |
| `lastSignalTopic` / `lastSignalDeliveryId` | C | Optional signal lineage. Official `X-Shopify-Webhook-Id` may be stored as delivery id. |
| `lastSignalTriggeredAt` | C | Optional copy of official `X-Shopify-Triggered-At` (Shopify webhook publication time). Still clock C — **not** resource `updatedAt`, **not** existence confirmation, **not** comparable to clock A as one sequence. |
| `lastSeenFullSyncRunId` | Epoch presence | Full-sync `SyncRun.id` that **observed this GID as present** in that epoch’s extraction. Advances **even when attributes no-op**. Distinct from `lastSyncRunId`. |
| `attributeRequestGen` / `attributeResponseGen` | Fallback only | Same platform sequence as existence gens (`stocky_catalog_observation_gen_seq`). Used **only when Shopify `updatedAt` is null**. Direct refetch uses the same `[observationRequestGen, observationResponseGen]` interval — not `attributeResponseGen` alone as Shopify freshness. Full-sync null-version rows may use committed `fenceGeneration` as the conservative bulk epoch marker and **must not** override a newer direct observation under the existing fence rules. Never unrestricted last-writer-wins. |
| `attributeFreshnessState` | Merchant-durable honesty | `ORDERED` when a non-null Shopify `updatedAt` is stored for the applied attributes; `DEGRADED` when the applied attributes rest on the null-version fallback. Source of truth for degraded-attribute visibility; `DataIssue` is derived. |
| `compatibilityProjectionState` | Merchant-durable honesty | Compatibility projection health (`HEALTHY` / `DEGRADED`) on the merchant side. `SyncHealth` / `DataIssue` are derived projections. |
| `existenceDiagnosticState` | Merchant-durable honesty | Stale-signal, existence-check-failed, terminal-revival-conflict, concurrent-existence-observation-conflict (`CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`), and related diagnostics that must survive a crash before control-plane `DataIssue` write. |
| `absenceNominationState` | Merchant-durable nomination | `NONE` \| `CANDIDATE` \| `CIRCUIT_BREAKER_HELD`. Candidates are **not** tombstones. |
| `absenceCandidateEpochId` / `absenceCandidateGeneration` | Candidate evidence | Durable epoch/generation that nominated the row. Confirmation still required. |
| `ingestBatchId` | Two-phase checkpoint | Merchant-durable batch evidence committed with facts. Control-plane `jsonlCommittedLineOrdinal` acknowledges **after** this commit. |
| `lastSeenAt` / `lastRefreshedAt` / `appliedAt` | Observability | Application time. **Not** an ordering key. |
| `lastSyncRunId` / `lastDurableJobId` | Lineage | Last applying SyncRun / job. |
| `sourceKind` | Lineage | `FULL_SYNC` \| `INCREMENTAL_REFETCH` \| `DELETE_WEBHOOK` \| `DISCONNECT_WEBHOOK` \| `RECONCILE` |
| `deletedAt` | Observability | When the row was tombstoned in this database. **Not** Shopify ordering. Null if `existenceState=LIVE`. |
| `deletionSource` | Lineage | `WEBHOOK` \| `CONFIRMED_QUERY` \| `DISCONNECT` \| null. Full-sync omission is **not** a deletion source. |
| `shopifyLegacyResourceId` | Identity join | REST numeric id when needed to join webhook payloads |

Inventory quantity states additionally persist **per-name** `quantity` + nullable `InventoryQuantity.updatedAt` + per-name `quantityRequestGen` / `quantityResponseGen` fallback interval. An older `available` must not overwrite a newer `available`; other names are independent. Overlapping null-version quantity conflicts must not last-writer-wins.

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
| `mediaUrl` | **Not a mandatory PR 5 acceptance field.** Product **featured media** is the PR 5 canonical media support (`ShopifyProductFact.featuredMediaUrl`). Variant-level `media` is a connection; `products → variants → media` violates official bulk nesting (max two nested connection levels) and is **deferred**. Do **not** generate new GraphQL against deprecated `ProductVariant.image`. Do **not** fail PR 5 acceptance because `ShopifyVariantFact.mediaUrl` is absent. |
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

Shopify documents the `unitCost` permission but does **not** document the exact bulk-operation failure mode for unauthorized `unitCost`. Do **not** assume field-level isolation inside bulk JSONL. A permission denial **must not** burn an otherwise-valid full catalog bulk cycle.

Missing permission **must not fail the entire catalog sync**:

1. **Before** submitting the catalog bulk, perform a cheap **non-bulk** capability preflight (a single ordinary Admin GraphQL `inventoryItem { unitCost }` read, or equivalent bounded probe).
2. If the preflight is **allowed**: submit the catalog bulk variant **with** `unitCost`.
3. If the preflight is **denied / unavailable**: submit the **no-unitCost** bulk variant and persist `unitCostAccess=OMITTED_NO_PERMISSION` (or `QUERY_ERROR_ISOLATED` if the probe itself failed transiently after bounded retry). Complete other facts.
4. If a selected field is `null` after an allowed preflight, persist `unitCostAccess=NULL` and continue.
5. Persist the documented permission / availability state on the shop/run. Project a `DataIssue` from that merchant-durable state; do not treat control-plane diagnostics as the sole evidence.
6. Never write Shopify cost. This remains **READ ONLY**. `FEATURE_COST_SYNC` stays DEFAULT OFF.

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

Canonical InventoryLevel **relationship identity** is:

`(shopId, inventoryItemGid, locationGid)`

Required unique constraint planning:

`@@unique([shopId, inventoryItemGid, locationGid])`

Also persist:

- inventory-item GID (identity component);
- location GID (identity component);
- Shopify InventoryLevel GID **when Shopify supplies it** — **lineage/reference only**, **not** the canonical uniqueness key, **never required** to process disconnect;
- `isActive` / connectivity;
- `shopifyCreatedAt` / `shopifyUpdatedAt`;
- per-name `updatedAt` when Shopify returns `InventoryQuantity.updatedAt`;
- observed/refreshed timestamps and source lineage.

All locking, existence state, quantity state, presence markers, reconciliation, disconnect/reconnect, candidate nomination, and tombstones **key on the item+location pair**. No ingestion path may create a row solely because a different level GID appeared for an existing pair.

**Connect / disconnect:** inventory-level connectivity is a **reconnectable** relationship (not assumed terminal) and is **exempt** from terminal-GID revival. Follow §6.F: a disconnect **signal** must run an authoritative existence/connectivity check keyed on the pair; a delayed disconnect must not tombstone a level Shopify currently returns as connected; a confirmed disconnect stores `existenceState=ABSENT` with an app existence observation, not webhook `receivedAt`. A later connect + live refetch may restore the **same** item+location identity on the **same** canonical row. A late full-sync row whose `fenceGeneration` is older than a confirmed disconnect must not resurrect it.
**Do not** invent an app-initiated inventory event ledger.

Unknown future quantity names: ignore for first-class columns; record a `DataIssue` if Shopify returns an unexpected name. Do not silently drop the eight named states.

### 6.E.1 Concurrent in-flight observation evidence — `CatalogObservationInFlight`

Logical planning name: **`CatalogObservationInFlight`**. Implementation may use an equivalent merchant-domain model name if it remains tenant-safe and is registered in enforcement manifests.

This is **merchant-domain evidence**, not a control-plane table. It follows the accepted PR 1–3 database-enforced tenant rules / RLS contract:

- non-null `shopId`;
- `@@unique([shopId, id])`;
- tenant-leading indexes;
- ENABLE+FORCE RLS with `USING` / `WITH CHECK`;
- immutable `shopId`;
- restricted `stocky_runtime` DML only;
- **no** `stocky_control_plane` DML;
- **no** cross-role FK to PR 4 control-plane tables (`DurableJob`, `JobAttempt`, `SyncRun`, `DataIssue`, `SyncHealth`).

It **MUST** support **multiple simultaneous** observations for the same canonical identity. Do **not** model this as one mutable “current in-flight observation” slot on the fact row. Do **not** unique-constrain `(shopId, canonical identity)` to a single in-flight row.

`observationRequestGen` is stored on the row as interval-start evidence. It is **not** merchant identity, **not** the uniqueness key, **not** a foreign key, and **not** a replacement for the observation token.

| Field | Requirement |
|---|---|
| `shopId` | Direct ownership; immutable; RLS tenant |
| `id` / observation token | Unique observation identity within the shop (`@@unique([shopId, id])`). Generated at insert. **This** is the expected-observation token used by late-worker fencing |
| Canonical resource identity | Product / Variant / InventoryItem / Location: `(resourceKind, shopifyGid)`. InventoryLevel: `(resourceKind, inventoryItemGid, locationGid)`. Same identity keys as the canonical fact tables |
| `observationRequestGen` | Platform sequence value allocated **before** the Shopify request. **Not** merchant identity |
| `observationResponseGen` | Null while resultless **and while `ACTIVE`**. Allocate with `SELECT nextval('stocky_catalog_observation_gen_seq')` **after** an authoritative usable response is in hand and **before** the tenant fact transaction (Correction 4 preserved). Keep the allocated value **in process only**. Persist it **only atomically** inside the fenced tenant fact transaction when this row **leaves `ACTIVE`**, together with the corresponding canonical / diagnostic decision. There must **never** be a committed row with `lifecycleState = ACTIVE` **and** `observationResponseGen IS NOT NULL`. See §6.F.2.3 |
| `leaseExpiresAt` | Absolute PostgreSQL `timestamptz` (or equivalent) deadline. Required on every **ACTIVE** unresolved observation. Computed **in the database** as `clock_timestamp() + validated_bounded_lease_interval`. The application may supply only the already-validated finite duration. See §6.F.2.1 |
| `lifecycleState` | `ACTIVE` \| `COMPLETED` \| `ABANDONED` |
| Durable-job / job-attempt lineage | Optional **opaque** correlation strings (job id / attempt id / correlation id). Lineage / diagnostics only. **No FK** to control-plane tables |
| `createdAt` / `updatedAt` | App timestamps. Observability only. **Not** an ordering key, **not** the lease clock, and **not** the liveness boundary (`leaseExpiresAt` evaluated against PostgreSQL `clock_timestamp()` is) |

Physical `DELETE` / reaping of `COMPLETED` / `ABANDONED` rows is **maintenance**. Physical deletion is **not** the correctness boundary. The durable lifecycle transition `ACTIVE -> ABANDONED`, when expiry is relied upon to permit a successor canonical mutation, **is** part of the correctness / fencing boundary. Do **not** conflate lifecycle abandonment with physical row deletion. See §6.F.2.1.

**Planned database invariant (implementation-grade data-model contract; no migration in this planning PR):**

- `ACTIVE` ⇒ `observationResponseGen IS NULL`
- `COMPLETED` ⇒ `observationResponseGen IS NOT NULL`
- `ABANDONED` may have `observationResponseGen IS NULL` (timeout / crash / no usable completed response), or non-null **only** when a usable response existed but was discarded / abandoned **atomically** while the row left `ACTIVE`

The implementation **MUST** enforce the equivalent of
`ACTIVE => observationResponseGen IS NULL` (and the `COMPLETED`
non-null rule) with a database constraint. Do **not** create that
migration in this planning PR. See §6.F.2.3.

### 6.F Clock domains, existence, and apply-path contract

This section is the **planning-correction 3** addendum (same D-053), as
further amended by **planning-correction 4** (USAGE-only sequence;
app-issued observation intervals), **planning-correction 5** (durable
multi-row in-flight evidence, finite lease, logical abandonment,
late-worker fencing, and non-overlapping terminal-revival confirmations),
and **planning-correction 6** (PostgreSQL `clock_timestamp()` as the sole
authoritative lease clock; exact `<` / `>=` expiry boundary; post-lock
fact fence; missing-row fail-closed; all-active-blocker predicate;
Races AM / AO / AP / AQ / AR),
and **planning-correction 7** (durable `ACTIVE -> ABANDONED` fencing
when expiry is relied upon to permit a successor canonical mutation;
lease invalidity vs durable abandonment; Race AS; Race AQ extension),
and **planning-correction 8** (universal transaction-scoped
`pg_advisory_xact_lock` canonical-identity serialization anchor;
no durable response-bearing `ACTIVE` row; deterministic multi-identity
and observation-row lock order; Races AT / AU / AV; D1.14 range
P–AV),
and the **implementation-entry contract** (same accepted advisory-lock
architecture; close **F-CLAUDE-PR5C8-01** advisory-lock capacity /
shared-lock-table operating envelope; close **F-CLAUDE-PR5C8-02**
pinned lock-key encoding + known-answer vectors; Race **AW**; D1.14
range P–AW).
D-054 is **EFFECTIVE**. Current live work is **PR5-F1 foundation
corrections in progress**. Production remains **NOT AUTHORIZED**.
Inventory-write flags remain **DEFAULT OFF**. This section does not
change D-052. It replaces the
Correction-2 Shop-counter / single-epoch absence-sweep architecture
with the rules below. It does **not** redesign the accepted
Correction-5 / Correction-6 / Correction-7 / Correction-8 observation-
interval, lease, clock, deletion, bulk-ingest, tenant, or exact-identity
advisory-lock architecture beyond what F-CLAUDE-PR5C8-01 / 02 require.
PostgreSQL `clock_timestamp()` remains the sole lease clock.
`pg_advisory_xact_lock(key1, key2)` remains the transaction-scoped
canonical identity anchor. Do **not** switch to session-level locks.
Do **not** remove identity serialization. Do **not** permit an
unanchored fallback.

PR 4 workers interleave. `catalog-sync` runs on `stocky-cron`
(`REBUILDABLE_IDEMPOTENT`); resource webhooks run on `stocky-webhooks`
(`ATOMIC_APPLICATION_RECEIPT`). Fair dispatch does **not** serialize
merchant-domain fact application across those job types for one shop.
PHASE_BRIEF already requires out-of-order webhooks and initial-sync overlap
with webhook processing. “Replay converges” is not a freshness rule.

Official Shopify 2026-07 / webhook docs (accessed 2026-08-14):

- webhook deliveries are **not** guaranteed, and Shopify does **not**
  guarantee ordering within a topic or across topics for the same resource
  (`https://shopify.dev/docs/apps/build/webhooks`);
- a **full-sync bulk run fenced at T0** can still be applying JSONL after
  T0 while incremental jobs have already written newer canonical facts;
- `bulkOperation(id:)` `partialDataUrl` is **not** a complete extraction;
- product webhooks include **at most the first 100 variants**;
- changes to `committed`, `reserved`, `damaged`, `safety_stock`, and
  `quality_control` **do not trigger webhooks**.

A last-writer-wins apply on `(shopId, shopifyGid)` that uses only `appliedAt`
would let a late older snapshot overwrite a newer canonical fact. Comparing
Shopify `updatedAt` to webhook `receivedAt` (or to local tombstone time) as
one sequence makes the same class of error **across clock domains**. Both
are **P1** planning defects.

`Shop.catalogObservationGen` is **not** approved architecture. Do **not**
add a generation counter to `Shop`. Do **not** widen the bootstrap
boundary. Do **not** allocate generations by updating a merchant or
bootstrap row.

#### 6.F.1 Three clocks — never one `sourceVersionAt`

Keep **three distinct concepts**. Do **not** collapse them into one
`sourceVersionAt`. Do **not** compare them to each other as one sequence.

| Clock | Field(s) | What it measures | What it may decide |
|---|---|---|---|
| **A. Shopify attribute version** | Resource `shopifyUpdatedAt`; per-name `InventoryQuantity.updatedAt` | Shopify’s own resource / quantity mutation time | Whether **attributes / quantity values** are newer than the stored fact **of the same Shopify version type** |
| **B. Authoritative existence observation** | `existenceState`, `existenceKind`, `existenceObservedAt`, `existenceRequestGen`, `existenceResponseGen` | The last **unambiguous** app-issued `[observationRequestGen, observationResponseGen]` interval for an authoritative Shopify existence check. `observationRequestGen` is allocated **before** the Shopify network request. `observationResponseGen` is allocated **after** an authoritative usable response and **before** the tenant fact transaction (Correction 4), kept **in process** until the observation leaves `ACTIVE`, and persisted only atomically with that lifecycle transition (§6.F.2.3). Generations order **app request lifecycle only**, not Shopify mutation order or snapshot time. Overlapping intervals with conflicting LIVE/ABSENT results must not resolve from `observationResponseGen` alone | LIVE vs TOMBSTONED / disconnected existence. Comparable only to other **app-issued** existence observation **intervals** and to `SyncRun.fenceGeneration`. A direct observation started after a fence iff `observationRequestGen > fenceGeneration` |
| **C. Signal observation** | `signalReceivedAt`, `lastSignalTopic`, `lastSignalDeliveryId`, optional `lastSignalTriggeredAt` | When a webhook/control payload **arrived** at this app (and, optionally, when Shopify published it) | Lineage, causation, diagnostics. **Not** proof the signalled state is still current. **Not** a Shopify resource mutation timestamp |

`appliedAt` / `lastRefreshedAt` / `deletedAt` remain **observability only**.
They are not freshness keys, not existence keys, and not Shopify mutation
timestamps.

**Forbidden ordering keys**

- Last database writer wins.
- Job completion time / `appliedAt` / `lastRefreshedAt` as Shopify source freshness.
- Durable-job `updatedAt` as a substitute for Shopify `updatedAt`.
- Webhook `receivedAt` / `X-Shopify-Triggered-At` as a synthetic Shopify `updatedAt`.
- Any comparison of clock A to clock B or clock C.
- Commit / lock-acquisition order as a substitute for non-overlapping observation-interval order.
- `observationResponseGen` / `existenceResponseGen` alone as proof that one concurrent Shopify observation was later than another.
- PostgreSQL `clock_timestamp()` / `leaseExpiresAt` / observation-lease time as Shopify mutation order, existence ordering, attribute ordering, resource freshness, or a replacement for `requestGen` / `responseGen`. The lease is **only** a liveness / recovery / fencing mechanism. It is **not** a Shopify clock.
- Application / node / container clocks (`Date.now()`, `new Date()`, process uptime, worker-local timers, container/VM clock, response-arrival wall time, a timestamp supplied by another worker) as the lease-validity decision. Those clocks may be used for logs / observability only.

**Hard rule — no cross-clock comparison**

- Do **not** compare Shopify `updatedAt` to webhook `receivedAt`.
- Do **not** compare Shopify `updatedAt` to `existenceObservedAt`.
- Do **not** compare Shopify `updatedAt` to `SyncRun.fenceAt`.
- Do **not** use webhook arrival time as a synthetic Shopify mutation timestamp.
- Do **not** un-tombstone by asking whether Shopify `updatedAt` is strictly
  after a local tombstone time. Confirmed absence is an existence
  observation (clock B), not a Shopify clock.
- Attribute decisions use clock A only (plus the null-version **fallback**
  in §6.F.9, which is still an app-issued attribute generation, not a
  Shopify timestamp).
- Existence decisions use clock B only.
- Clock C never decides canonical existence or attribute freshness.
- Do **not** invent a comparison between an application-node clock and
  PostgreSQL lease time as a correctness rule. Lease validity is decided
  only by PostgreSQL `clock_timestamp()` against `leaseExpiresAt`.

Official Shopify recommends using `X-Shopify-Triggered-At` or payload
`updated_at` to *organize* webhook deliveries. PR 5 **records**
`X-Shopify-Triggered-At` as clock-C metadata and uses payload/resource
`updatedAt` as clock A when it is the Shopify resource/quantity timestamp.
It does **not** treat webhook publication time and resource `updatedAt` as
one source-version sequence, and it does **not** treat either as existence
confirmation.

#### 6.F.2 Generation allocator — PostgreSQL sequence, not Shop

**Planning name:** `stocky_catalog_observation_gen_seq`

This sequence is **platform synchronization infrastructure**, not merchant
data.

| Property | Rule |
|---|---|
| Lives on `Shop` | **No** |
| Merchant-domain table | **No** — it is not a table holding tenant records |
| Bootstrap boundary | **Must not** widen Session/Shop bootstrap. Bootstrap Shop rows receive **zero** generation writes |
| Merchant-domain RLS | **Not required** — there is no tenant row to protect |
| Identity / key | **Never** part of a unique key, foreign key, or merchant identity |
| Monotonicity | Globally monotonic `bigint`. Comparisons of two generations remain **within one shop / identity**. Cross-shop numeric comparison is meaningless and forbidden as an apply rule |
| Gaps | Explicitly harmless. A crash, rollback, or failed `SyncRun` persist **burns** a value |
| Reuse | **Never.** A fence generation may never be reused. A burned value is not recycled. Sequence is explicitly **NO CYCLE** so `nextval` cannot wrap |
| Primitive | `SELECT nextval('stocky_catalog_observation_gen_seq');` Exact Prisma/migration syntax may later differ; the semantic contract is fixed |
| Owner | Migration / schema owner **only**. `stocky_runtime` and `stocky_control_plane` **must not** own the sequence (`excess_sequence_ownership` remains a verifier failure) |
| Privileges | **USAGE only** on **this named sequence only** to `stocky_runtime` **and** `stocky_control_plane`. **No SELECT. No UPDATE. No ownership.** **No** table DML on `SyncRun` to runtime. **No** merchant-fact DML to control-plane. **No** schema-wide `GRANT … ON SEQUENCES`. **No** PUBLIC privilege |
| `setval` | Application roles **must be unable** to call `setval()` successfully. Official PostgreSQL: `setval` requires **UPDATE** (https://www.postgresql.org/docs/18/functions-sequence.html, accessed 2026-08-14). Granting UPDATE would permit resetting sequence state and therefore generation reuse |
| Cycle | Explicit `NO CYCLE` (https://www.postgresql.org/docs/18/sql-createsequence.html, accessed 2026-08-14). If the limit is reached, further `nextval` errors instead of wrapping |
| Verifier | Named allowlist for this one sequence. Keep F-PR3C-05 against PUBLIC, blanket `ON SEQUENCES`, `evil_seq`, runtime/control-plane ownership, SELECT, UPDATE, and `setval`. This is **not** a table-privilege bypass of R-102 / R-137 |

`nextval` is atomic and does not take a merchant or `Shop` row lock.
Concurrent allocators never receive the same value. Allocation does **not**
convoy on the tenant-root `Shop` row.

Official PostgreSQL 18 sequence-function semantics
(https://www.postgresql.org/docs/18/functions-sequence.html, accessed
2026-08-14; PostgreSQL 18.6 docs dated August 13, 2026):

- `nextval()` requires **USAGE or UPDATE**.
- `setval()` requires **UPDATE**.
- `currval` / `lastval` require USAGE or SELECT.
- **SELECT is not needed** to allocate `nextval()`.
- **UPDATE permits resetting sequence state** via `setval()` and therefore
  must **not** be granted to application roles.

Approved least privilege for `stocky_runtime` and `stocky_control_plane` is
therefore **USAGE only**. That is sufficient for
`SELECT nextval('stocky_catalog_observation_gen_seq')` and insufficient for
`setval()`.

**No PostgreSQL / merchant row lock and no advisory identity lock may
be held across Shopify HTTP / network I/O.** Concurrent observation
ordering uses observation **intervals**, not a lock held across the
Shopify request.

##### Direct authoritative Shopify refetch (runtime)

Every direct authoritative Shopify query uses an app-issued **observation
interval** `[observationRequestGen, observationResponseGen]` (equivalents:
`requestStartGen` / `responseEndGen`) from
`stocky_catalog_observation_gen_seq`. Persist the last **unambiguous**
existence interval as `existenceRequestGen` / `existenceResponseGen`.

These generations order **app request lifecycle only**. They do **not**
claim Shopify mutation ordering or snapshot time.

Do **not** claim that allocating a generation immediately after Shopify
response completion proves observation-completion order across concurrent
workers. Example: Shopify response A arrives first; worker A is
descheduled before end-generation allocation; response B arrives second
and obtains the next end generation; worker A resumes and obtains a later
end generation. The later end generation does **not** prove A's Shopify
observation was later.

**Required algorithm:**

1. **BEFORE** issuing the Shopify network request: allocate
   `requestStartGen = SELECT nextval('stocky_catalog_observation_gen_seq')`.
   In a **short** tenant transaction, **insert a new**
   `CatalogObservationInFlight` row for this observation token (not a
   single mutable slot): `shopId`, canonical identity, unique observation
   token, `observationRequestGen`, `lifecycleState = ACTIVE`, finite
   `leaseExpiresAt` computed **by PostgreSQL** as
   `clock_timestamp() + validated_bounded_lease_interval` (the application
   may supply only that already-validated finite duration; it **MUST NOT**
   supply the absolute “current time” or compute the absolute deadline
   from its own clock), opaque job/attempt lineage if useful, timestamps.
   **COMMIT**, then **release all row locks**. This is not a network lock
   and must not acquire the canonical advisory identity lock for the
   Shopify request itself.
2. Perform the Shopify request. Hold **NO** merchant/control-plane row lock
   across network I/O. An earlier ACTIVE unexpired resultless observation
   does **not** prevent this later request from being **issued**.
3. If the request completes with an authoritative usable response:
   allocate
   `responseEndGen = SELECT nextval('stocky_catalog_observation_gen_seq')`.
   Capture `existenceObservedAt` as the app UTC instant the usable response
   was in hand (observability; **not** the concurrent-apply key).
   Keep `responseEndGen` and the response payload **IN PROCESS ONLY**.
   Do **not** issue a separate database update that persists
   `observationResponseGen` while `CatalogObservationInFlight` remains
   `ACTIVE` (§6.F.2.3).
4. **Then** enter the tenant fact transaction. Establish tenant/RLS
   context. Acquire the **canonical transaction-scoped advisory identity
   lock** (`pg_advisory_xact_lock`, §6.F.2.2) — this is the PRIMARY
   serialization boundary, including when no canonical row exists.
   If the canonical fact row exists, `SELECT … FOR UPDATE` may then lock
   it (SECONDARY). Then lock/read relevant `CatalogObservationInFlight`
   rows in the deterministic order in §6.F.2.2. After the required
   canonical-identity / observation locking is established, the
   **final** guarded fact decision in that **same** tenant transaction
   **MUST** re-evaluate PostgreSQL `clock_timestamp() < leaseExpiresAt`
   (§6.F.2.1). Do **not** cache a `dbNow` before a lock wait and reuse
   it afterward. Do **not** treat response arrival, `responseGen`
   allocation, transaction start, or statement start as reserved
   validity.
5. Apply using the interval / blocker / conflict rules in §6.F.3,
   including the Correction-7 successor apply algorithm when this
   transaction relies on expiry of overlapping ACTIVE resultless
   observations to proceed: durably fence those exact rows
   `ACTIVE -> ABANDONED` in this same tenant / identity-lock transaction,
   then re-evaluate remaining blockers. Persist
   `observationResponseGen` **only atomically** with this observation
   leaving `ACTIVE` and with the corresponding canonical / diagnostic
   decision (§6.F.2.3). Complete or abandon **that exact** observation
   atomically with the fact decision. A blocked later response is
   discarded for canonical application and is **not** replayed later as
   if it were fresh. If the lease has crossed the deadline by that
   final decision, fact application is denied; `responseGen` may remain
   burned; the payload is discarded for canonical application; a
   bounded fresh retry / refetch is required.

##### Graceful completion / failure / hard crash

**Usable response + valid active lease:**

- allocate `responseEndGen` and keep it **in process only**;
- enter the tenant fact transaction;
- acquire the canonical advisory identity anchor, then any secondary
  row locks (§6.F.2.2);
- after identity / observation locking, re-evaluate the observation-token
  fence using PostgreSQL `clock_timestamp() < leaseExpiresAt` (ACTIVE,
  not `ABANDONED`, exactly one matching row);
- apply interval / blocker / conflict rules;
- persist `observationResponseGen` **atomically** with marking **that
  exact** observation `COMPLETED` (or equivalently transitioning it out
  of `ACTIVE`) and with the fact / diagnostic decision. There is no
  committed `ACTIVE` + non-null `observationResponseGen` window.

**Graceful timeout / throttle / error** (originating worker still live):

- mark **that exact** observation `ABANDONED`;
- create **no** authoritative fact;
- burn the request generation;
- **never** authorize deletion.

**Hard crash** (SIGKILL, pod eviction, OOM, or equivalent) after ACTIVE
evidence commits and before apply:

- the originating worker does not run graceful cleanup;
- lease expiry produces **lease invalidity** automatically when
  PostgreSQL `clock_timestamp() >= leaseExpiresAt` (the original
  observation is not valid to apply at its final fact fence);
- a successor that wants to stop treating that expired ACTIVE
  resultless row as a blocker **MUST** durably transition it
  `ACTIVE -> ABANDONED` inside the same tenant / identity transaction
  that relies on the expiry (§6.F.2.1);
- there is **no** permanent identity freeze.

Do **not** allocate the end generation only after waiting for the identity
lock. Do **not** treat `responseEndGen` alone as observation order.

#### 6.F.2.1 Finite lease, durable abandonment fencing, blocking, and late-worker fencing

**Planning correction 5** (same D-053 — F-CLAUDE-PR5C4-01), as further
specified by **planning correction 6** (same D-053 —
F-CLAUDE-PR5C5-01 / 02 / 03 / 04), **planning correction 7**
(same D-053 — durable `ACTIVE -> ABANDONED` fencing when expiry is
relied upon to permit a successor canonical mutation), and
**planning correction 8** (same D-053 — universal advisory identity
anchor and no durable response-bearing `ACTIVE` row). Implementation
is still **NOT AUTHORIZED**. Correction 8 does **not** redesign the
accepted Correction-5 / Correction-6 / Correction-7 architecture.
PostgreSQL `clock_timestamp()` remains the sole lease clock. Every
durably `ACTIVE` row is resultless (§6.F.2.3), so the Correction-7
`ACTIVE + expired + resultless` abandonment predicate remains
coherent.

##### Finite lease is the liveness boundary

Every **ACTIVE unresolved** observation **must** have a finite
`leaseExpiresAt` (or semantically equivalent deadline).

Lease duration is derived from:

- the configured **finite** direct Shopify request timeout;
- **plus** a **finite bounded** recovery margin.

Do **not** invent an unlimited lease. Do **not** invent a
renewable-without-bound lease. A retry after abandonment is a **new**
observation with a new token and a new `observationRequestGen`.

Exact production milliseconds may remain configurable. The implementation
contract **must** require:

- a finite request timeout;
- a finite recovery margin;
- a validated **finite maximum** observation lease;
- test-configurable **short** values.

Configuration validation must reject missing, non-positive, unbounded, or
greater-than-maximum timeout / margin / lease values.

PostgreSQL `clock_timestamp()` / `leaseExpiresAt` is **ONLY** a liveness /
recovery / fencing mechanism. It is **NOT**:

- Shopify mutation order;
- existence ordering;
- attribute ordering;
- resource freshness;
- a replacement for `requestGen` / `responseGen`;
- a Shopify clock;
- a monotonic business clock.

##### Authoritative lease clock (F-CLAUDE-PR5C5-01)

PostgreSQL **database time** is the **SOLE** authoritative clock for
observation-lease **creation** and **expiry**.

Application / node / container clocks **MUST NOT** decide lease validity.

Specifically **prohibit** using for lease correctness:

- `Date.now()`;
- `new Date()`;
- process uptime;
- worker-local timers;
- the container / VM clock;
- response-arrival wall time;
- a timestamp supplied by another worker.

Those clocks **may** be used for logs / observability only.

The authoritative PostgreSQL primitive is `clock_timestamp()`.

Official PostgreSQL 18 current-date/time semantics
(https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT,
accessed 2026-08-15; PostgreSQL 18.6 docs dated August 13, 2026):

- `CURRENT_TIMESTAMP` / `now()` / `transaction_timestamp()` return the
  **transaction-start** time and therefore can become stale while a
  transaction waits;
- `statement_timestamp()` returns **statement-start** time (the time of
  receipt of the latest command message from the client) and can likewise
  predate a wait occurring within that statement;
- `clock_timestamp()` returns actual PostgreSQL server time when
  evaluated and **changes even within a single SQL statement**.

Do **not** use lease time as Shopify ordering or resource freshness. It
remains liveness / fencing only.

##### Lease creation

When inserting `CatalogObservationInFlight` in the short tenant
transaction, the **ABSOLUTE** `leaseExpiresAt` **MUST** be computed by
PostgreSQL from PostgreSQL time.

Conceptually:

`leaseExpiresAt = clock_timestamp() + validated_bounded_lease_interval`

The application may supply the already-validated finite lease
**DURATION**. The application **MUST NOT** supply the absolute “current
time” or compute the absolute deadline from its own clock.

Persist `leaseExpiresAt` as `timestamptz` / equivalent absolute database
timestamp.

##### Exact expiry semantics

Define the boundary exactly. Every lease-dependent decision **MUST** use
this same rule:

- an ACTIVE lease is **valid** iff
  `clock_timestamp() < leaseExpiresAt`;
- the lease is **expired** iff
  `clock_timestamp() >= leaseExpiresAt`.

Therefore **at exact equality** (`clock_timestamp() == leaseExpiresAt`)
the observation is **EXPIRED**.

There is **no** `<=` / `>` ambiguity. Do **not** let different paths
implement different boundary operators.

This same rule applies to:

- active-blocker determination;
- lease invalidity of the original observation;
- the durable `ACTIVE -> ABANDONED` fencing predicate;
- stale-worker fencing;
- cleanup eligibility;
- absence-confirmation blocking;
- any other PR5 lease predicate.

##### Explicit blocking semantics — all active blockers (F-CLAUDE-PR5C5-03)

Blocker evaluation is **existential** across **ALL** relevant in-flight
observations for that canonical identity.

An **ACTIVE, UNEXPIRED, resultless** direct observation participates as an
unresolved interval:

`[observationRequestGen, +∞)`

Canonical existence mutation is **prohibited** if **ANY** overlapping
observation is:

- `ACTIVE`;
- **UNEXPIRED** according to PostgreSQL `clock_timestamp()`
  (`clock_timestamp() < leaseExpiresAt`);
- **RESULTLESS**.

The system **must not**:

- check only the oldest row;
- check only the newest row;
- check only one arbitrary row;
- release a held response because only one of several blockers expired.

Expiry of observation A does **not** unblock an observation
if observation B still satisfies the blocking predicate.

A successor may stop treating an expired ACTIVE resultless observation
as a blocker **only after** that exact row is durably transitioned
`ACTIVE -> ABANDONED` inside the same tenant-scoped canonical-identity
transaction that is relying on the expiry (§6.F.2.1). Expiry time
alone is **not** permission to mutate canonical existence.

It does **NOT** prevent the later Shopify request from being issued.

If a later request obtains a usable response while **any** earlier
unexpired resultless observation still overlaps it:

- preserve canonical existence;
- do **not** tombstone;
- do **not** revive;
- do **not** treat `responseEndGen` as winner;
- do **not** later replay that held response as if it were fresh;
- use the accepted PR 4 durable retry / refetch lifecycle to obtain a
  **fresh** authoritative observation after **all** blockers settle.

The retry / refetch must remain **bounded** and **auditable**. The blocked
later observation is completed / abandoned **without** becoming an
authoritative completed interval. Its request generation remains burned.
Held responses remain discarded rather than replayed as fresh.

##### Lease invalidity vs durable abandonment (planning correction 7)

Preserve all Correction-6 clock rules. PostgreSQL `clock_timestamp()`
remains the **sole** lease clock.

Official PostgreSQL 18 current-date/time semantics
(https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT,
accessed 2026-08-15) document `clock_timestamp()` as returning the
**actual current time**, changing even within a single SQL statement.
That is a **wall-clock** source. Official PostgreSQL 18 does **not**
document `clock_timestamp()` as a monotonic business clock. Do **not**
claim `clock_timestamp()` itself is monotonic.

**Correction-8 interaction (F-CLAUDE-PR5C7-02):** every durably
`ACTIVE` row is resultless. `observationResponseGen` is allocated after
a usable response (Correction 4) but is **not** persisted while the row
remains `ACTIVE` (§6.F.2.3). Therefore the Correction-7 predicate
remains coherent: `ACTIVE + expired + resultless` can be durably fenced
`ACTIVE -> ABANDONED` by a successor in the same tenant / identity
transaction. Database wall-clock rollback can **never** expose a
committed response-bearing `ACTIVE` row, because that state is
forbidden. Do **not** weaken:

- PostgreSQL `clock_timestamp()` lease authority;
- the exact `<` / `>=` boundary;
- durable abandonment;
- missing-row fail closed;
- all-blocker re-evaluation;
- Race AS.

Distinguish:

1. **Lease invalidity** — an original observation is **not valid to
   apply** whenever `clock_timestamp() >= leaseExpiresAt` at its final
   fact fence. That remains unchanged from Correction 6.
2. **Durable abandonment** — the lifecycle transition
   `ACTIVE -> ABANDONED` used to permit a successor mutation after
   relying on expiry.

An expired observation that remains physically / lifecycle-state
`ACTIVE` is still lease-invalid for the original worker. It is **not**
by itself a durable fence against later database wall-time moving
backward.

**Lease invalidity (original observation / original worker)**

Once an ACTIVE resultless observation’s lease has expired according to
PostgreSQL `clock_timestamp() >= leaseExpiresAt` at its final fact
fence, that original observation is **not valid to apply** even if a
cleanup worker has not physically rewritten or deleted its row yet.

Therefore an expired resultless original observation:

- creates **no** authoritative LIVE / ABSENT fact;
- **never** authorizes deletion;
- **never** authorizes revival;
- **burns** its request generation permanently;
- **fails** the original worker’s token fence.

That is **lease invalidity**. It is **not** by itself permission for a
successor to treat the expired row as unblocking and mutate canonical
existence.

**Durable abandonment required for successor unblocking**

If another observation wants to **STOP** treating an expired ACTIVE
resultless observation as a blocker and proceed with canonical
mutation, it **MUST** first **durably fence** that expired observation
by transitioning the exact row:

`ACTIVE -> ABANDONED`

inside the **same** tenant-scoped canonical-identity transaction that
is relying on the expiry.

The transition **MUST** be conditional on:

- exact `shopId`;
- exact canonical identity;
- exact observation token;
- `lifecycleState = ACTIVE`;
- resultless;
- PostgreSQL `clock_timestamp() >= leaseExpiresAt`.

This transition is a **correctness / fencing operation**. It is **NOT**
optional physical cleanup.

`ABANDONED` **MUST never** transition back to `ACTIVE`.

Physical `DELETE` / reaping of `COMPLETED` / `ABANDONED` rows remains
**maintenance only**. Do **not** conflate lifecycle abandonment with
physical row deletion.

A background recovery pass **may** also persist `ACTIVE -> ABANDONED`
after expiry, but successor correctness **MUST NOT** depend on a
background pass having run. The successor transaction can perform the
required fencing itself.

This removes any possibility that a hard-crashed worker freezes an
identity forever, **and** any possibility that a later database-clock
rollback revalidates a token whose expiry has already been relied upon
to unblock canonical mutation.

##### Successor apply algorithm (planning correction 7)

Under the canonical identity lock — meaning the **transaction-scoped
advisory identity anchor** in §6.F.2.2, which exists whether or not a
canonical fact row already exists; `SELECT … FOR UPDATE` is secondary:

0. Tenant/RLS context is already established. Acquire
   `pg_advisory_xact_lock` for this canonical identity. If the
   canonical fact row exists, `SELECT … FOR UPDATE` that row. Then
   lock / read relevant `CatalogObservationInFlight` rows in
   **ascending** `observationRequestGen`, ties broken by observation
   token. Canonical advisory identity lock **before** observation-row
   locks. No code path may invent a reverse order.
1. Obtain PostgreSQL actual time **only** through `clock_timestamp()`.
2. Identify **ALL** overlapping ACTIVE resultless observations.
3. For every blocker whose `clock_timestamp() >= leaseExpiresAt`,
   atomically transition that exact row `ACTIVE -> ABANDONED` using
   the conditional predicate above, in that same deterministic
   observation-row order.
4. Re-evaluate blockers.
5. If **ANY** overlapping ACTIVE resultless row still satisfies
   `clock_timestamp() < leaseExpiresAt`, canonical existence mutation
   remains blocked.
6. Only when no active unexpired blocker survives may the successor
   continue through the existing interval / conflict / fact rules.
7. The successor’s canonical fact mutation and the abandonment fencing
   it relies upon **MUST** be in the same tenant transaction /
   identity-lock boundary (the advisory identity anchor).

If that transaction rolls back:

- both the successor mutation **and** those abandonment transitions
  roll back;
- there is **no** half-applied takeover state.

Do **not** introduce a cross-role transaction.

##### Original-worker fence after durable abandonment

The original worker continues to require:

- exactly one matching token row;
- `ACTIVE`;
- not `ABANDONED`;
- `clock_timestamp() < leaseExpiresAt`.

Therefore a persistently `ABANDONED` row fails even if PostgreSQL wall
time later moves backward.

Missing row remains fail-closed.

A stale worker **cannot**:

- change `ABANDONED` back to `ACTIVE`;
- recreate a deleted row;
- write `LIVE` / `ABSENT`;
- update null-version attributes;
- tombstone;
- revive;
- clear newer evidence.

##### Clock-backward semantics

**CASE 1** — database clock moves backward **BEFORE** any successor
transaction has observed / relied upon expiry:

- the row may remain `ACTIVE` longer;
- takeover may be delayed;
- no successor may mutate canonical state by treating it as abandoned;
- this is a **liveness delay**, not a safety violation.

**CASE 2** — a successor transaction has observed expiry and durably
transitioned the row `ACTIVE -> ABANDONED`:

- later database-clock rollback **MUST NOT** reactivate the old
  observation;
- `lifecycleState = ABANDONED` is the durable fencing evidence;
- the old worker always fails its exact-token lifecycle fence.

Do **not** claim `clock_timestamp()` itself is monotonic.

Physical `DELETE` / reaping is **maintenance**. Physical cleanup
**MUST NOT** be the correctness boundary. The durable lifecycle
transition `ACTIVE -> ABANDONED` when expiry is relied upon to permit
successor canonical mutation **IS** part of the correctness / fencing
boundary.

##### Late-worker fencing — fact-application time (F-CLAUDE-PR5C5-01 / 04)

Closing or ignoring a stale row is insufficient unless a late original
worker is fenced.

The **critical validity decision occurs at FACT APPLICATION TIME**.

A response arriving before expiry does **NOT** reserve validity.
A `responseGen` allocated before expiry does **NOT** reserve validity.
Transaction start before expiry does **NOT** reserve validity.
Statement start before expiry does **NOT** reserve validity.

After the required canonical-identity / observation locking is
established, the final guarded fact decision **MUST** re-evaluate
PostgreSQL:

`clock_timestamp() < leaseExpiresAt`

inside the same tenant fact transaction.

Do **not** cache `dbNow` before a lock wait and reuse it afterward.
Do **not** use `CURRENT_TIMESTAMP` / `now()` / `transaction_timestamp()`
as the post-lock fence time because they freeze at transaction start.
Do **not** rely solely on `statement_timestamp()` for a statement that
may wait before the fact decision.

The implementation contract **must** make the final guarded write /
fact-decision predicate observe **actual PostgreSQL time after relevant
lock waiting**. Canonical fact mutation and observation completion remain
atomic in that tenant transaction.

The fence requires **EXACTLY ONE** matching observation row for:

- `shopId`;
- canonical identity;
- expected observation token;

and that row must satisfy:

- `ACTIVE`;
- not `ABANDONED`;
- `clock_timestamp() < leaseExpiresAt`.

If the lease has crossed the deadline by that final decision:

- fact application is denied;
- `responseGen` may remain burned;
- the response payload is discarded for canonical application;
- a bounded fresh retry / refetch is required.

If its lease expired or another recovery path abandoned it:

the late Shopify response **MUST** be discarded for canonical application.

It **may** burn `responseGen` if `responseGen` was already allocated.

It **MUST NOT**:

- write `LIVE`;
- write `ABSENT`;
- tombstone;
- revive;
- update null-version attributes;
- clear a newer observation’s evidence;
- resurrect an expired observation merely because a Shopify response
  eventually arrived.

A stale worker must not be able to flip `ABANDONED` / expired evidence
back to `ACTIVE` in order to apply. `ABANDONED` **never** transitions
back to `ACTIVE`. Clock rollback after durable abandonment cannot
restore validity (CASE 2).

##### Missing observation row — fail closed (F-CLAUDE-PR5C5-02)

If **zero** matching rows exist — including because physical cleanup
already deleted the row — the fence **FAILS CLOSED**.

Zero rows **MUST NOT** be interpreted as:

- already completed successfully;
- safe to continue;
- implicitly unexpired;
- permission to mutate the canonical fact.

No canonical existence / attribute mutation occurs.

A stale worker **must not** recreate the missing observation row in
order to apply its old response.

More than one row for the same exact token is a constraint /
data-integrity failure and must also fail closed.

##### Database clock discontinuities

Do **not** claim `clock_timestamp()` is a Shopify clock or a monotonic
business clock. Its sole role is a common database-authoritative
lease / fencing clock. Official PostgreSQL 18 documents it as actual
server wall time when evaluated, not as a monotonic business clock.

All workers use the database’s value, so application-node clock skew
cannot produce one worker treating a lease expired while another passes
the stale fence from its own local clock.

If database wall time moves **forward**, stale work must fail the same
database-time fence.

**CASE 1** — database wall time moves **backward** **before** any
successor transaction has observed / relied upon expiry:

- the row may remain `ACTIVE` longer;
- takeover may be delayed;
- no successor may mutate canonical state by treating the still-ACTIVE
  row as abandoned;
- this is a **liveness delay**, not a safety violation.

**CASE 2** — a successor transaction has observed expiry and durably
transitioned the row `ACTIVE -> ABANDONED`:

- later database-clock rollback **MUST NOT** reactivate the old
  observation;
- `lifecycleState = ABANDONED` is the durable fencing evidence;
- the original worker always fails its token fence.

A database-time **backward** adjustment **MUST NOT** permit an
application-node clock to override the database lease decision.

Do **not** invent cross-clock comparisons.

##### Role boundary

Do **not** solve this by granting `stocky_control_plane` direct DML over
merchant fact or in-flight tables.

Preserve PR 3 / PR 4 role separation:

- PR 4 durable job / attempt recovery **may trigger or retry**
  tenant-scoped PR 5 work;
- merchant-domain observation insert / fence / complete / abandon /
  cleanup / fact application remains under restricted tenant runtime
  authority (`stocky_runtime` + `TenantDb`);
- do **not** introduce an impossible cross-role atomic transaction;
- do **not** add a FK from `CatalogObservationInFlight` to control-plane
  tables.

Opaque job / attempt identifiers may be stored as lineage only.

##### Full-sync fence (control-plane)

1. A control-plane transaction allocates **one** sequence generation.
2. Persist it as `SyncRun.fenceGeneration` plus `fenceAt`.
3. **COMMIT** that control-plane transaction.
4. **Only then** call `bulkOperationRunQuery` / start location pagination.

Do **not** introduce a network lock. No row lock and no advisory
identity lock is held across Shopify I/O.

A failure after step 1/2 may burn a generation. That is **safe**.
A fence generation may **never** be reused.

JSONL / page lines of that run reuse `SyncRun.fenceGeneration` for
`LIVE_FULL_SYNC_PRESENT` and for null-version bulk attribute observations.
They do **not** allocate a new generation per line. Full-sync null-version
rows may continue to use the committed `fenceGeneration` as the
conservative bulk epoch marker, provided they cannot override a newer
direct observation under the existing fence rules.

A direct observation started after the fence iff
`observationRequestGen > fenceGeneration`.

#### 6.F.2.2 Universal canonical-identity serialization anchor (planning correction 8 — F-CLAUDE-PR5C7-01 / F-CLAUDE-PR5C7-03)

Close **F-CLAUDE-PR5C7-01** by making the serialization boundary
**independent of whether a canonical fact row already exists**.

Official PostgreSQL 18 explicit locking
(https://www.postgresql.org/docs/18/explicit-locking.html, accessed
2026-08-16; PostgreSQL 18.6 docs dated August 13, 2026):

- `SELECT … FOR UPDATE` locks **the rows retrieved** by that statement
  (Section 13.3.2). A row that does not exist cannot be locked this
  way. This brief remains READ COMMITTED for candidate sweeps (Race AA;
  §6.F.10 forbids `REPEATABLE READ` / `SERIALIZABLE` for the sweep),
  so predicate / gap locking is not the PR 5 serialization primitive.
- Advisory locks have **session-level** and **transaction-level**
  acquisition (Section 13.3.5). Session-level locks do **not** honor
  transaction semantics: a session-level lock acquired in a transaction
  that later rolls back is **still held**. Transaction-level locks are
  released automatically at transaction end and have no explicit unlock.

Official PostgreSQL 18 advisory-lock functions
(https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS,
Section 9.28.10, accessed 2026-08-16):

- `pg_advisory_xact_lock(key1 integer, key2 integer)` obtains an
  exclusive **transaction-level** advisory lock, waiting if necessary.
- `pg_advisory_lock(...)` obtains an exclusive **session-level**
  advisory lock. **Do not** use session-level `pg_advisory_lock` for
  this contract.
- Resources may be identified by one 64-bit key **or** two 32-bit keys;
  those two key spaces do not overlap. This contract uses the **two
  32-bit integer** form so a 64-bit key is never converted through
  JavaScript `Number` / IEEE-754 float.

##### Primary primitive

Every canonical fact-application transaction **MUST** first acquire an
exclusive, transaction-scoped PostgreSQL advisory lock:

```sql
SELECT pg_advisory_xact_lock(key1, key2);
```

for the exact canonical merchant identity.

This advisory lock is the **PRIMARY** canonical-identity serialization
boundary for **ALL** PR 5 canonical apply paths. It applies whether the
canonical fact row:

- already exists;
- does not yet exist;
- was tombstoned;
- is being first-created during initial sync;
- is an InventoryLevel pair.

Existing `SELECT … FOR UPDATE` on the canonical fact row remains
**useful** when that row exists, but it is **SECONDARY**. It is **no
longer** the serialization primitive that correctness depends on.

The lock **MUST** be transaction-scoped. **No** advisory lock may be
held across Shopify network I/O. **No** canonical writer may bypass
the identity anchor.

Covered writers include:

- direct authoritative refetch;
- delete / disconnect confirmation;
- reconciliation;
- full-sync / JSONL application;
- InventoryLevel pair application;
- first insert;
- successor takeover / abandonment fencing;
- background merchant-domain abandonment that changes correctness
  state.

##### Canonical lock-key encoding and derivation (implementation-entry pin — F-CLAUDE-PR5C8-02)

Close **F-CLAUDE-PR5C8-02** by pinning the exact lock-key encoding.
There is **one** canonical encoding. The earlier planning sketch that
used a 4-byte binary length prefix and screaming-snake `resourceKind`
literals is **superseded**. Implementation must use this contract only.

Canonical encoding version:

`stocky-pr5-canonical-lock-v1`

Each component is UTF-8 encoded.

Each component is encoded **exactly** as:

`<decimal UTF-8 byte length>:<UTF-8 bytes>`

Components are concatenated with **NO** additional separator.

The **byte length**, not JavaScript string length, is authoritative.

- No trimming.
- No lowercasing.
- No Unicode normalization.
- No Shopify-domain normalization.

`shopId` **MUST** use the exact stored canonical `Shop.id` string
bytes. `Shop.id` is the internal Prisma `String` / `cuid()` identity
(`prisma/schema.prisma` `model Shop { id String @id @default(cuid()) }`).
Do **not** encode `myshopifyDomain`. Do **not** invent a numeric,
hyphenated, or case-normalized rendering.

`resourceKind` values are **EXACT** case-sensitive literals:

- `Product`
- `ProductVariant`
- `InventoryItem`
- `Location`
- `InventoryLevel`

Identity component order:

- **Product:** version, `shopId`, `Product`, `shopifyProductGid`
- **ProductVariant:** version, `shopId`, `ProductVariant`, `shopifyVariantGid`
- **InventoryItem:** version, `shopId`, `InventoryItem`, `shopifyInventoryItemGid`
- **Location:** version, `shopId`, `Location`, `shopifyLocationGid`
- **InventoryLevel:** version, `shopId`, `InventoryLevel`, `inventoryItemGid`, `locationGid`

Then:

1. `digest = SHA-256(canonical preimage)`
2. take digest bytes `0..7`
3. bytes `0..3`: signed 32-bit big-endian two’s-complement `key1`
4. bytes `4..7`: signed 32-bit big-endian two’s-complement `key2`
5. call `pg_advisory_xact_lock(key1, key2)`

Never convert the first eight bytes into a JavaScript `Number`.
Bind `key1` and `key2` as exact 32-bit integers. Signed 32-bit values
are valid PostgreSQL `integer` keys.

Changing the version label creates a **new** lock namespace.

The advisory key is **transient locking metadata**. It is **not**
merchant identity and **not** persistent fact identity.

**Collisions:** different canonical identities that happen to
hash-collide may **OVER-SERIALIZE**. That is **safe**. A collision
**MUST NOT** cause under-serialization of the same identity. Same
identity always produces the same `(key1, key2)`.

Implementation later **must** have **one** canonical key-derivation
function. No duplicated hand-written derivation in call sites.

###### Mandatory known-answer vectors

Runtime unit tests **must** reproduce these vectors verbatim. Cursor
independently reproduced them with a disposable Node `crypto` script
on 2026-08-16 before recording them. Do **not** change a vector if a
later implementation fails to match; fix the implementation.

**VECTOR 1 — Product**

Components:

- `stocky-pr5-canonical-lock-v1`
- `cm1234567890abcdefghijk`
- `Product`
- `gid://shopify/Product/1234567890`

Canonical preimage:

`28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk7:Product32:gid://shopify/Product/1234567890`

SHA-256:

`872f7a6ab5d396d0738736ef15c37065e2bf6fba6f7480dd8f517fe487d799c1`

Expected:

- `key1 = -2026931606`
- `key2 = -1244424496`

**VECTOR 2 — ProductVariant**

Components:

- `stocky-pr5-canonical-lock-v1`
- `cm1234567890abcdefghijk`
- `ProductVariant`
- `gid://shopify/ProductVariant/9876543210`

Canonical preimage:

`28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk14:ProductVariant39:gid://shopify/ProductVariant/9876543210`

SHA-256:

`74825407ef1400f9b02bf51b778b04cf20c765605c541131e4a6a84701d92e7e`

Expected:

- `key1 = 1954698247`
- `key2 = -283901703`

**VECTOR 3 — InventoryLevel**

Components:

- `stocky-pr5-canonical-lock-v1`
- `cm1234567890abcdefghijk`
- `InventoryLevel`
- `gid://shopify/InventoryItem/1111111111`
- `gid://shopify/Location/2222222222`

Canonical preimage:

`28:stocky-pr5-canonical-lock-v123:cm1234567890abcdefghijk14:InventoryLevel38:gid://shopify/InventoryItem/111111111133:gid://shopify/Location/2222222222`

SHA-256:

`3c8acc13010dc2cc5e30275b4c581f156acb07eb914e3f59e8bf5e80a9cb0713`

Expected:

- `key1 = 1015729171`
- `key2 = 17679052`

##### Lock acquisition order inside a tenant transaction

1. Tenant / RLS context established.
2. Acquire the canonical transaction-scoped advisory identity lock.
3. If the canonical fact row exists, `SELECT … FOR UPDATE` may then
   lock it.
4. Lock / read relevant `CatalogObservationInFlight` rows.
5. Evaluate blocker / interval / lease / conflict rules.
6. Apply the canonical fact decision.
7. Complete / abandon the exact observation as required.
8. Commit.

After acquiring the advisory anchor, **re-read** canonical state and
all relevant in-flight / blocker evidence **before** deciding.

##### First insert (no canonical row)

When the canonical fact does **not** exist, the advisory identity lock
still serializes all competing transactions **BEFORE** they evaluate
the apply decision.

Only after acquiring the anchor and re-reading evidence may the
transaction decide whether to:

- insert;
- preserve no canonical row;
- record conflict / degraded evidence;
- refetch;
- or perform another already-approved result.

Do **NOT** treat `INSERT … ON CONFLICT DO UPDATE` as a substitute for
the apply algorithm.

A unique-constraint conflict that occurs **despite** the required
advisory anchor is evidence of:

- a lock-contract bypass;
- a key-derivation mismatch;
- or another architecture defect.

It **MUST** fail closed / retry through the **full** canonical apply
algorithm (interval, blocker, conflict, and first-insert rules). It
**MUST NOT** blindly overwrite existence or attribute columns.

##### Batch / multi-identity lock order (F-CLAUDE-PR5C7-03)

If one bounded JSONL / fact transaction applies **multiple** canonical
identities:

- compute **all** advisory lock key pairs first;
- **deduplicate** identical advisory keys before acquisition;
- acquire them in deterministic **ascending** `(key1, key2)` order;
- after lock acquisition, process identities deterministically.

For observation rows **within one canonical identity**, lock / fence
in **ascending** `observationRequestGen`, ties broken by observation
token.

The canonical advisory identity lock is acquired **BEFORE**
observation-row locks.

Background recovery / fencing follows the **same** ordering rules.

No code path may invent its own reverse ordering.

Hash-key collisions may cause extra serialization **only**. They must
not create a reverse lock order or a half-applied canonical state.

PostgreSQL detects remaining deadlocks and aborts one transaction
(Section 13.3.4). Because canonical mutation and abandonment fencing
are the same tenant transaction, an aborted transaction leaves no
half-applied takeover state. Deterministic order is required to avoid
that abort noise.

##### Advisory-lock capacity / shared-lock-table envelope (implementation-entry — F-CLAUDE-PR5C8-01)

Close **F-CLAUDE-PR5C8-01** without redesigning the accepted
exact-identity advisory-lock architecture.

Keep `pg_advisory_xact_lock(key1, key2)` as the transaction-scoped
canonical identity anchor.

- Do **not** switch to session-level locks.
- Do **not** remove identity serialization.
- Do **not** permit an unanchored fallback.

Define a **separate** canonical-apply transaction batch limit from the
existing JSONL ingestion / read batch.

The JSONL reader may still consume larger bounded chunks, but a single
canonical fact transaction **must not** automatically acquire one
advisory lock for every parsed row.

**Initial implementation default / hypothesis** (not merchant-visible
product truth):

`canonical identities per canonical fact transaction = 32`

It **MUST** be configurable **downward**.

Increasing it requires capacity evidence.

The implementation must read or otherwise verify the intended
PostgreSQL deployment settings:

- `max_locks_per_transaction`
- `max_connections`
- `max_prepared_transactions`

Official PostgreSQL 18 (accessed 2026-08-16; docs dated August 13,
2026):

- Lock management
  (https://www.postgresql.org/docs/18/runtime-config-locks.html):
  the shared lock table has space for `max_locks_per_transaction`
  objects per server process or prepared transaction. This parameter
  limits the **average** number of object locks used by each
  transaction; **individual transactions can lock more objects** as
  long as the locks of all transactions fit in the lock table. Default
  **64**. This is **not** a literal hard limit of 64 locks for one
  transaction. The parameter can only be set at server start.
- Explicit locking §13.3.5
  (https://www.postgresql.org/docs/18/explicit-locking.html):
  advisory locks may be session-level or transaction-level.
  Session-level locks do not honor transaction rollback.
  Transaction-level locks are released automatically at transaction
  end. Both advisory locks and regular locks are stored in a shared
  memory pool sized by `max_locks_per_transaction` and
  `max_connections`. Exhausting that pool prevents the server from
  granting locks.
- Advisory-lock functions §9.28.10
  (https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS):
  `pg_advisory_xact_lock(key1 integer, key2 integer)` obtains an
  exclusive transaction-level advisory lock, waiting if necessary.
- Connections
  (https://www.postgresql.org/docs/18/runtime-config-connection.html):
  `max_connections` is the maximum number of concurrent connections
  (typical default 100) and can only be set at server start.
- Resource consumption
  (https://www.postgresql.org/docs/18/runtime-config-resource.html):
  `max_prepared_transactions` is the maximum number of transactions
  that can be in the prepared state simultaneously (default 0) and can
  only be set at server start.

Planning capacity estimate:

```text
shared_lock_object_budget =
  max_locks_per_transaction
  * (max_connections + max_prepared_transactions)
```

This estimate is **not** a guarantee that every slot is available to
PR 5. Other database lockable objects share the lock table.

Require **both** conservative conditions before a configured
multi-identity batch is accepted:

**A.**

```text
canonicalLocksPerTransaction
  <= floor(max_locks_per_transaction / 2)
```

**B.**

```text
canonicalLocksPerTransaction
  * configuredWorstCaseConcurrentCanonicalTransactions
  <= floor(shared_lock_object_budget * 0.25)
```

The 25% ceiling is a conservative PR 5 budget reserving at least 75%
of the estimated shared lock-object table for the rest of
PostgreSQL / application activity.

If actual deployment settings make the initial 32-identity value
unsafe: **automatically reduce** the effective PR 5 batch cap before
processing.

- Never increase PostgreSQL server settings automatically.
- Never alter `max_locks_per_transaction` at runtime.
- Never require a database restart from application code.

###### Canonical apply concurrency

Define an explicit bounded configuration for the **worst-case**
simultaneous PR 5 canonical multi-identity fact transactions.

Initial implementation hypothesis:

`4` concurrent canonical multi-identity fact transactions.

This must include all relevant PR 5 bulk / reconciliation worker
concurrency that can hold multiple identity advisory locks.

Direct one-identity observations also consume advisory-lock capacity
and must be included in load tests / capacity evidence even if they
use a separate request path.

Do **not** claim the arithmetic alone proves production safety.

The deployment / test gate must exercise the real intended PostgreSQL
configuration and concurrency envelope.

###### Lock-capacity failure behavior

When a bounded multi-identity transaction cannot acquire required
advisory locks because shared lock resources are exhausted:

**FAIL CLOSED.**

Required behavior:

1. abort the transaction;
2. commit no canonical fact changes from that transaction;
3. commit no half-applied abandonment fencing;
4. release transaction-level advisory locks through rollback;
5. retry only with a bounded exponential / backoff policy;
6. reduce the canonical identity sub-batch, e.g. halve it;
7. never split one canonical identity’s fact decision across
   transactions;
8. never fall back to an unanchored write;
9. stop at one identity;
10. if one-identity anchored work still cannot proceed after bounded
    retries, fail the job / mark the applicable sync state degraded
    according to existing PR 4 / PR 5 failure semantics.

Do **not** loop indefinitely.

Do **not** silently drop identities.

Do **not** alter Shopify truth.

Planning risk **R-161** remains **OPEN** until runtime implementation
and independent tests pass.

#### 6.F.2.3 No durable response-bearing ACTIVE state (planning correction 8 — F-CLAUDE-PR5C7-02)

Close **F-CLAUDE-PR5C7-02** using the **SAFE CONTRACT**:
`observationResponseGen` is **NOT** durably persisted before the
fenced tenant fact transaction.

**Required lifecycle:**

1. Shopify usable response arrives.
2. Allocate
   `responseGen = SELECT nextval('stocky_catalog_observation_gen_seq')`.
   This remains **AFTER** usable response and **BEFORE** canonical
   fact application, preserving Correction 4. Do **not** move
   allocation to after the identity-lock wait.
3. Keep `responseGen` and the response payload **IN PROCESS ONLY**.
4. Do **NOT** issue a separate database update that persists
   `responseGen` while `CatalogObservationInFlight` remains `ACTIVE`.
5. Enter the tenant fact transaction.
6. Acquire the canonical advisory identity anchor (§6.F.2.2).
7. Lock / re-read the canonical fact (if present) and the exact
   observation row.
8. Perform final lease / lifecycle / blocker / interval / conflict
   evaluation.
9. Persist `responseGen` **only atomically** with the observation
   leaving `ACTIVE` and with the corresponding canonical /
   diagnostic decision.

There must **never** be a committed database state:

`lifecycleState = ACTIVE` **AND** `observationResponseGen IS NOT NULL`

**Planned schema invariant** (do **not** create a migration in this
planning PR):

- `ACTIVE` ⇒ `observationResponseGen IS NULL`
- `COMPLETED` ⇒ `observationResponseGen IS NOT NULL`
- `ABANDONED` may be NULL when there was no usable completed
  response, or non-null only when a usable response existed but was
  discarded / abandoned atomically while the row left `ACTIVE`

**Crash / pause semantics**

Crash / pause after `responseGen` allocation but **BEFORE** the fact
transaction:

- `responseGen` is burned;
- it is **not** persisted;
- `CatalogObservationInFlight` remains `ACTIVE` + resultless;
- therefore existing blocker / lease / abandonment rules still cover
  it;
- a successor may later durably `ACTIVE -> ABANDONED` after expiry;
- a stale worker **cannot** create `ACTIVE` + persisted `responseGen`
  on resume.

Crash **inside** the fact transaction:

- transaction rollback leaves the observation `ACTIVE` +
  `observationResponseGen` NULL;
- canonical mutation and lifecycle transition do not partially
  commit.

Successful / completed observation:

- `responseGen` persistence;
- `COMPLETED` transition;
- canonical fact or conflict / diagnostic decision

occur **atomically** under the canonical advisory identity anchor.

Blocked / discarded response:

- **never** replay the old response as fresh;
- transition the exact observation out of `ACTIVE` atomically
  according to the existing abandonment / conflict rules;
- bounded fresh refetch remains required where already specified.

With this invariant, every durably `ACTIVE` row is resultless, so
Correction 7 remains coherent (see §6.F.2.1 Correction-8
interaction).

#### 6.F.3 Authoritative existence observation (clock B)

An existence observation is recorded **only after** this app has a Shopify
Admin GraphQL result or a **complete** extraction **presence** result for
that identity.

Official 2026-07 existence-check handles (read-only):

| Identity | Authoritative live check | Confirmed absence |
|---|---|---|
| Product GID | `product(id:)` returns the Product | Completed query returns **null** Product (GraphQL field is nullable). Official `productDelete` docs (2026-07): product deletion is **irreversible** — after a confirmed delete the GID is structurally terminal in Shopify’s normal identity model |
| Variant GID | `productVariant(id:)` | Completed query returns null |
| Inventory item GID | `inventoryItem(id:)` | Completed query returns null |
| Location GID | `location(id:)` | Completed query returns null |
| Inventory-level relationship | `inventoryItem(id:).inventoryLevel(locationId:, includeInactive: true)` (nullable `InventoryLevel`). Prefer this when the disconnect webhook supplies only REST item + location ids. `inventoryLevel(id:)` is valid when a level GID is already known | Completed query returns **null** level (disconnected / not stocked at that location). This relationship is **reconnectable** |

Transport timeout, HTTP 5xx, throttling, or incomplete GraphQL errors are
**not** confirmed absence.

| Kind (`existenceKind`) | When it is authoritative |
|---|---|
| `LIVE_REFETCH` | Direct GraphQL refetch returned the GID / inventory-level relationship **live** |
| `ABSENT_CONFIRMED_QUERY` | Direct GraphQL refetch **completed** and Shopify reported the identity absent / unqueryable. **This is the only single-observation ABSENT authority.** |
| `LIVE_FULL_SYNC_PRESENT` | A **complete** `catalog-sync-v2` JSONL / complete location page **contained** the GID / relationship. Presence is sound. Completeness-of-omission is **not** |

`ABSENT_FULL_SYNC_SWEEP` is **not** approved as single-epoch authority.
A COMPLETED bulk run may establish **PRESENCE** and may nominate
**ABSENCE CANDIDATES**. It must **not** by itself write canonical
`ABSENT` / tombstones. See §6.F.10.

`existenceObservedAt` plus the last **unambiguous** interval
`[existenceRequestGen, existenceResponseGen]` represent **app request
lifecycle**, not commit ordering, and **not** Shopify mutation order.

- `existenceObservedAt` is the app UTC time when that Shopify check’s
  usable response was **in hand**, **not** webhook `receivedAt`, **not**
  lock-wait end, **not** commit time. It is observability, not the
  concurrent-apply key.
- `existenceRequestGen` is allocated **before** issuing that Shopify
  network request.
- `existenceResponseGen` is allocated **after** an authoritative usable
  response and **before** entering the tenant fact transaction. It is
  kept in process until persisted atomically when the observation leaves
  `ACTIVE` (§6.F.2.3).
- These values do **not** claim Shopify snapshot time.

**Do not** treat a larger `existenceResponseGen` as proof of a later
Shopify observation across concurrent workers.

##### Overlapping observation intervals (same identity)

Two direct authoritative observations overlap when their generation
intervals overlap.

Closed-interval overlap:

`A.observationRequestGen <= B.observationResponseGen`
**and**
`B.observationRequestGen <= A.observationResponseGen`.

**ACTIVE unexpired resultless observations (correction 5 / 6 / 7):**

An **ACTIVE, UNEXPIRED, resultless** direct observation participates as an
unresolved interval `[observationRequestGen, +∞)` and **blocks overlapping
later observations from mutating canonical existence** while it remains
active. **UNEXPIRED** means PostgreSQL
`clock_timestamp() < leaseExpiresAt`. The predicate is **existential
across all** such overlapping observations for that identity: expiry of
one blocker does **not** release a later observation while another still
satisfies the blocking predicate. It does **not** prevent the later
Shopify request from being issued. See §6.F.2.1.

Once that observation’s lease has expired
(`clock_timestamp() >= leaseExpiresAt`), the **original** observation is
**lease-invalid** and must not apply. A successor may stop treating that
expired ACTIVE resultless row as a blocker **only after** durably
transitioning it `ACTIVE -> ABANDONED` inside the same tenant /
identity-lock transaction that relies on the expiry. Expired /
`ABANDONED` **resultless** observations:

- are **excluded** from live overlap **after** durable abandonment, or
  equivalently after the successor has fenced them in the same
  transaction that is about to mutate;
- produced **no** authoritative Shopify fact;
- do **not** LWW, tombstone, revive, or preserve a fake LIVE/ABSENT
  result.

**If observations are NON-OVERLAPPING:**

- the observation whose `observationRequestGen` is after the prior
  observation’s `observationResponseGen` is the later app-issued
  authoritative check;
- existence ordering **may** use that fact.

**If observations OVERLAP and their EXISTENCE results conflict**
(LIVE vs ABSENT, or ABSENT vs LIVE):

- do **not** choose LIVE vs ABSENT from `observationResponseGen` alone;
- preserve the last unambiguous canonical existence state;
- persist merchant-durable `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`
  (or equivalent);
- derive/reconcile `DataIssue`;
- enqueue/bound a fresh authoritative refetch **after both observations
  have completed**;
- that subsequent **non-overlapping** check resolves the conflict.

Examples: overlapping LIVE vs ABSENT → conflict + recheck. Overlapping
ABSENT vs LIVE → conflict + recheck.

**If overlapping observations agree on existence:**

- they may converge idempotently on that existence state;
- attributes still follow clock A.

Expired / abandoned **resultless** observations are excluded from this
completed-observation rule because they produced no authoritative Shopify
fact.

**Concurrent completed observations (correction 4, preserved):**

- non-overlapping completed intervals may order app-issued observations;
- overlapping conflicting completed observations do **not** last-writer-wins;
- overlapping agreeing observations may converge where already allowed;
- clock A remains preferred for real Shopify `updatedAt`;
- null-version conflicting overlaps preserve last unambiguous value and
  refetch.

For terminal deletion: an overlapping LIVE/ABSENT conflict **must never**
bypass the already-required terminal-revival safeguards in §6.F.7.

For InventoryLevel reconnectable relationships: the same overlapping-conflict
rule applies **before** changing LIVE/ABSENT.

**LIVE vs TOMBSTONED** is decided only by clock B, using the last
**unambiguous** non-overlapping existence observation (or the preserved
pre-conflict state while a conflict is unresolved):

- `existenceState = LIVE` while the last unambiguous committed existence
  observation for that identity is a LIVE kind.
- `existenceState = ABSENT` (tombstoned / disconnected) while the last
  unambiguous committed existence observation is `ABSENT_CONFIRMED_QUERY`.
- A webhook payload **alone** never writes ABSENT.
- A bulk omission **alone** never writes ABSENT.
- An overlapping conflicting observation **never** writes ABSENT or LIVE
  from `observationResponseGen` order.

Serialize apply per `(shopId, shopifyGid)` — or
`(shopId, inventoryItemGid, locationGid)` for levels — with the
**canonical transaction-scoped advisory identity lock**
(`pg_advisory_xact_lock`, §6.F.2.2) inside the tenant transaction.
That advisory lock is the **PRIMARY** serialization boundary and
applies whether or not a canonical fact row exists. If the canonical
row exists, `SELECT … FOR UPDATE` may then lock it as a **SECONDARY**
row lock. This is identity serialization, **not** a
dispatcher/readiness redesign. The lock is taken **after** Shopify I/O
and **after** end-generation allocation. It is **not** held across
Shopify network I/O. First insert of a nonexistent identity uses the
same advisory anchor and **must not** substitute
`INSERT … ON CONFLICT DO UPDATE` for the apply algorithm.

#### 6.F.4 Signal observation (clock C)

Webhook and control payloads are **signals**:

1. Map the canonical GID / `(inventoryItemGid, locationGid)`.
2. Persist signal lineage (`signalReceivedAt` = webhook received/control
   time; topic; delivery id; optional `X-Shopify-Triggered-At`).
3. Enqueue or perform the **approved authoritative existence check** when
   technically possible.
4. **Do not** treat signal arrival as proof the signalled state is still
   current.
5. **Do not** copy `signalReceivedAt` or `X-Shopify-Triggered-At` into
   `shopifyUpdatedAt`.

Signals are useful for debugging delayed, duplicate, and out-of-order
deliveries. They are not a source-version sequence.

#### 6.F.5 Shopify attribute version (clock A)

Official 2026-07: `Product.updatedAt`, `ProductVariant.updatedAt`,
`InventoryItem.updatedAt`, `Location.updatedAt`, and
`InventoryLevel.updatedAt` are `DateTime!` (non-null) on those objects.
Official `InventoryQuantity.updatedAt` is **nullable** `DateTime`.
Webhook/REST payloads and truncated bulk lines may still omit a timestamp.
The applicator **must not** assume every incoming observation carries a
Shopify `updatedAt`.

For product, variant, inventory item, location, and inventory-level
**attributes**, incoming observation `I` vs stored row `S`:

1. If `S` does not exist: insert attributes from `I` **only after**
   the canonical advisory identity lock is held and canonical /
   in-flight evidence has been re-read (§6.F.2.2 first insert); set
   `shopifyUpdatedAt = I.shopifyUpdatedAt` when Shopify provided it.
   Overlapping conflicting first-insert evidence follows §6.F.3 /
   §6.F.9 — **not** last-writer-wins and **not**
   `ON CONFLICT DO UPDATE` overwrite.
2. If both have non-null `shopifyUpdatedAt` and
   `I.shopifyUpdatedAt > S.shopifyUpdatedAt`: apply attributes; advance
   `shopifyUpdatedAt`.
3. If both have non-null `shopifyUpdatedAt` and
   `I.shopifyUpdatedAt < S.shopifyUpdatedAt`: **no-op attributes**.
   **Do not** rewind `shopifyUpdatedAt`. **Do not** skip existence /
   presence updates (§6.F.6).
4. If `I.shopifyUpdatedAt == S.shopifyUpdatedAt`: idempotent attribute
   no-op if attributes match. If attributes **differ** at equal
   `updatedAt`: **no-op**, record merchant-durable
   `existenceDiagnosticState` / `attributeFreshnessState` evidence for
   `EQUAL_VERSION_CONFLICT`, schedule authoritative refetch. Do not
   silently pick a side. `DataIssue` is a **derived** control-plane
   projection of that merchant-durable state (§6.F.12).
5. If either side is missing `updatedAt`: **do not** use unrestricted
   last-writer-wins. Use the **nullable-version fallback** in §6.F.9.

Un-tombstone is **not** a clock-A decision. A newer Shopify `updatedAt`
does not by itself clear ABSENT. A LIVE existence observation (clock B)
does not by itself license applying stale attributes.

**Inventory quantities (per name)**

Each of `available`, `on_hand`, `incoming`, `committed`, `reserved`,
`damaged`, `safety_stock`, `quality_control` has its **own** Shopify
attribute clock: that name’s `InventoryQuantity.updatedAt`.

- Apply name `N` only when incoming `N.updatedAt` is **strictly after**
  stored `N.updatedAt`, or the stored name is absent, or both are null
  and the nullable-quantity fallback in §6.F.9 applies.
- A stale `available` snapshot **must not** clobber a newer `committed`
  (or any other name). Names are independent **Shopify** freshness
  domains.
- Do **not** compare `InventoryQuantity.updatedAt` to webhook
  `receivedAt`, `X-Shopify-Triggered-At`, or `existenceObservedAt`.
- Do **not** use `InventoryLevel.updatedAt` as a substitute for per-name
  freshness. Official inventory-management docs treat names as distinct
  states; parent `updatedAt` is not proven to move when non-`available`
  states change.

**Collection membership**

Membership rows are **set snapshots** keyed by
`(shopId, productGid, collectionGid)`. Incoming **complete** product
refetch **replaces** the membership set for that product. Partial product
webhooks (**first 100 variants only**) **must not** replace the collection
set; they may only upsert the product header and enqueue a bounded product
refetch. Membership deletion happens when a complete observation no longer
lists the collection, or when the product is tombstoned **after an
authoritative absence confirmation**.

#### 6.F.6 Full-sync presence marker is independent of attribute no-op

If a **COMPLETE** full sync’s JSONL **contains** GID X, then X is
**PRESENT in that epoch**. Presence is a positive observation. Shopify
does **not** publish a snapshot-isolation / point-in-time completeness
guarantee sufficient to prove the converse.

`lastSeenFullSyncRunId = R.epochId` **must** be written for that observed
GID **even when** clock A rejects the row’s attributes as stale (incoming
`shopifyUpdatedAt` older than stored).

Stale-attribute rejection **must not** treat the GID as absent. Absence
**candidate** nomination looks at the presence marker and clock-B
existence evidence, **not** at whether attributes were applied.

The JSONL applicator, for each in-scope identity line, in one
`(shopId, identity)` **merchant** transaction — or, when a bounded
batch transaction applies **multiple** identities, under the
§6.F.2.2 multi-identity lock order:

1. Acquire the canonical `pg_advisory_xact_lock` identity anchor
   (§6.F.2.2; for a bounded multi-identity batch, acquire **all**
   advisory keys first in ascending `(key1, key2)` order). If the
   canonical fact row exists, `SELECT … FOR UPDATE` that row
   (SECONDARY). After Shopify I/O and after any direct-refetch
   generation allocation; bulk lines use the already-committed fence.
   Do **not** hold the advisory lock across Shopify I/O.
2. Persist signal/lineage as appropriate.
3. If this line is from complete epoch `R`: set
   `lastSeenFullSyncRunId = R.epochId` (presence marker).
4. Decide attributes via clock A (and §6.F.9 fallback) independently.
5. If the row is ABSENT, decide un-tombstone via clock B (§6.F.8)
   independently of whether attributes no-op’d. Terminal GIDs follow
   §6.F.7; inventory-level pairs remain reconnectable.

Bounded memory: presence is a **column on the fact row**, updated per
streamed line. The applicator does **not** accumulate the epoch’s GID set
in process memory. Absence-candidate nomination is set-based SQL against
`lastSeenFullSyncRunId` and existence columns. Memory remains O(batch).

**Mandatory adversarial case (must be an implementation test later):**

- T0 = full-sync fence (`R.fenceAt` / `R.fenceGeneration`).
- Canonical X already has Shopify `updatedAt` T-0.5 from a delayed
  incremental refetch (after T0, before JSONL apply).
- Bulk JSONL contains X with older Shopify `updatedAt` T-2.
- Bulk **attributes** are correctly rejected as stale.
- X **must still** receive `lastSeenFullSyncRunId = R.epochId`.
- X **must not** become an absence candidate, and must not be tombstoned.

#### 6.F.7 Delete / disconnect: signal, then authoritative existence check

For a delete or inventory-level disconnect **signal**:

1. Map the canonical GID / item+location identity from the sanitized
   projection. Do not invent a replacement GID. Inventory-level mapping
   keys on `(shopId, inventoryItemGid, locationGid)` even when the
   payload has no level GID.
2. Record clock-C signal lineage (`signalReceivedAt` = webhook received
   time). **Do not** use that timestamp as Shopify `updatedAt`.
3. Perform the approved **authoritative existence check** when technically
   possible (table in §6.F.3). Use the §6.F.2 observation-interval
   algorithm. **No row lock across that network call.**
4. If Shopify **currently returns the same identity live**:
   - **Do not** tombstone merely because a delayed signal arrived.
   - Record merchant-durable `existenceDiagnosticState =
     STALE_DELETE_SIGNAL` or `STALE_DISCONNECT_SIGNAL` with the signal
     delivery id and the live refetch correlation. The diagnostic
     reconciler projects `DataIssue` `CATALOG_STALE_DELETE_SIGNAL` /
     `CATALOG_STALE_DISCONNECT_SIGNAL`.
   - Apply or refetch live canonical **attributes** according to clock A.
   - Set existence to LIVE with `existenceKind = LIVE_REFETCH` and the
     observation interval `[observationRequestGen, observationResponseGen]`
     **only if** the interval is non-overlapping with a conflicting
     existence observation, or overlapping observations **agree** on LIVE —
     unless the identity is a **terminal tombstone** under the revival
     rule below. An overlapping LIVE/ABSENT conflict must never bypass
     those terminal-revival safeguards.
5. If Shopify **authoritatively reports** the identity absent /
   unqueryable (completed query, not a timeout):
   - Tombstone / disconnect **only** when this observation is a
     non-overlapping later check, or overlapping observations **agree**
     on ABSENT. If it overlaps a LIVE existence observation, apply the
     overlapping-conflict rule: preserve last unambiguous state; persist
     `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`; refetch after both
     complete. Do **not** tombstone from `observationResponseGen` alone.
   - When ABSENT is unambiguous: store
     `existenceKind = ABSENT_CONFIRMED_QUERY`, `existenceObservedAt`
     = when that check’s usable response was in hand, and the observation
     interval allocated per §6.F.2.
   - **Do not** store webhook `receivedAt` as the confirmation time.
6. If the query is **ambiguous or transiently failed**:
   - **Do not** convert the failure into canonical deletion.
   - Retry with bounded backoff; if still unresolved, record merchant
     `existenceDiagnosticState = EXISTENCE_CHECK_FAILED` (projected as
     `DataIssue` `CATALOG_EXISTENCE_CHECK_FAILED`) and leave the row in
     its last confirmed existence state (or mark catalog compatibility
     `DEGRADED` if a prior LIVE/ABSENT cannot be trusted). Do not
     silently drop the fact. If no merchant fact transaction ran, PR 4
     `JobAttempt` / job lifecycle remains the durable evidence.

**Terminal vs reconnectable**

- **Product / ProductVariant / InventoryItem / deleted Location GIDs**
  are **terminal identities** after `ABSENT_CONFIRMED_QUERY`. Official
  2026-07 `productDelete` documentation states product deletion is
  **irreversible**. Recreated merchant products are **new GIDs** (never
  merge by SKU / barcode / title).
- **Inventory-level** `(inventoryItemGid, locationGid)` relationships
  remain **reconnectable** and are **exempt** from the terminal-revival
  rule. Official 2026-07 `inventoryItem.inventoryLevel` is nullable.
  `inventoryBulkToggleActivation` / `inventoryDeactivate` are cited only
  as API evidence that stocking can be toggled; they are **forbidden**
  in PR 5 code (§12). Confirmed disconnect is absence of the
  relationship, not destruction of the item or location. A later
  authoritative live check showing the relationship present
  **reconnects** (LIVE) even when Shopify quantity `updatedAt` is not
  comparable to the local absence observation time.

**Terminal-identity revival (safety valve, not expected lifecycle)**

A terminal identity **MUST NOT** silently revive from **one** later LIVE
response.

1. Any post-tombstone LIVE response for a terminal GID opens merchant
   diagnostic `TERMINAL_IDENTITY_REVIVAL_CONFLICT` (projected as a
   `DataIssue`). Keep the canonical tombstone **initially**.
2. Require **two independent** authoritative LIVE confirmations. Those two
   confirmations **MUST be NON-OVERLAPPING with each other**. Required
   ordering:

   `second.observationRequestGen > first.observationResponseGen`

   Two overlapping LIVE responses **MUST NOT** satisfy the two-confirmation
   revival threshold. This is **F-CLAUDE-PR5C4-02**.
3. Where Shopify `createdAt` is available, require it to **match** the
   tombstoned identity’s recorded `shopifyCreatedAt`.
4. Only then may **controlled recovery** restore LIVE, with recovery /
   audit evidence recorded.
5. Attributes of a restored row still follow clock A.

Do **not** weaken the existing createdAt / audit / conflict safeguards.

This is a defensive recovery path. A normal merchant recreation is a new
GID and therefore a new fact identity.

#### 6.F.8 Un-tombstone / reconnect (existence separate from attributes)

Required principle: an **authoritative Shopify observation obtained after**
the confirmed absence observation, which shows the **same** GID /
relationship **live**, is existence evidence that can supersede the
tombstone — **subject to the terminal-revival rule** in §6.F.7.

Compare **clock B to clock B** using observation **intervals**, not
`observationResponseGen` alone:

- Direct LIVE refetch may un-tombstone a **reconnectable** identity when
  the LIVE observation is **non-overlapping** after the committed absence
  observation (`LIVE.observationRequestGen` **>** committed absence
  `existenceResponseGen`) **and** terminal-revival does not apply.
- If the LIVE observation **overlaps** the absence observation and the
  existence results conflict: do **not** un-tombstone from
  `observationResponseGen` order; preserve last unambiguous state;
  persist `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`; refetch after both
  complete. InventoryLevel reconnectable pairs follow this same
  overlapping-conflict rule **before** changing LIVE/ABSENT.
- Complete full-sync presence (`LIVE_FULL_SYNC_PRESENT` at
  `R.fenceGeneration`) may un-tombstone a **reconnectable** identity when
  `R.fenceGeneration` is **greater than** the committed absence
  `existenceResponseGen` **and** there is no unresolved overlapping LIVE
  vs ABSENT conflict. For **terminal** GIDs, bulk presence after a
  confirmed tombstone is **revival-conflict evidence**, not a silent LIVE
  restore.
- A late bulk row from an **older** run (`fenceGeneration` **less than or
  equal to** the absence interval’s `existenceResponseGen`) **must not**
  resurrect.

**Attributes still obey clock A.** Un-tombstoning a row does **not**
license applying stale Shopify attributes. A revival may restore LIVE with
**existing** attributes plus a presence/existence update, then apply newer
attributes only when clock A says so.

Do **not** require Shopify `updatedAt` to be strictly after local absence
time. That comparison crosses clock domains.

Recreated Shopify GIDs remain new identity rows (never merge).

#### 6.F.9 Nullable Shopify version fallback (not last-writer-wins)

Shopify `updatedAt` is **preferred whenever present**. Official Shopify
2026-07 `InventoryQuantity.updatedAt` is **nullable**. Resource
`updatedAt` is `DateTime!` on Product / ProductVariant / InventoryItem /
Location / InventoryLevel, but incoming payloads can still omit the field.

**Never** fall back to unrestricted last-writer-wins (`appliedAt` or
arrival order).

When incoming and/or stored **Shopify attribute version is null**, use an
**app-issued attribute observation interval** — planning names
`attributeRequestGen` / `attributeResponseGen` on resource facts and
per-name `quantityRequestGen` / `quantityResponseGen` on inventory
quantities — allocated from `stocky_catalog_observation_gen_seq` under
the **same interval rule** as existence observations (§6.F.2): start
generation **before** the Shopify request; end generation **after** an
authoritative usable response and **before** the tenant fact
transaction, kept in process until persisted atomically when the
observation leaves `ACTIVE` (§6.F.2.3).
Do **not** claim `attributeResponseGen` / `quantityResponseGen` alone
proves Shopify freshness.

This interval:

- orders **app request lifecycle** for null-version attribute
  observations, **not** Shopify mutations;
- for complete full-sync JSONL rows with **null** Shopify `updatedAt`,
  uses **`SyncRun.fenceGeneration`** as the conservative bulk epoch
  marker, so a delayed bulk observation **cannot** commit over a newer
  direct refetch under the existing fence rules;
- for a **direct authoritative refetch** with null Shopify `updatedAt`,
  uses the direct observation interval. That refetch **must be able to
  update the fact** when the interval is a non-overlapping later check,
  or when overlapping null-version observations carry **identical**
  payloads. Infinite no-op because both versions are missing is
  **forbidden**;
- is **explicitly a fallback only**. As soon as a non-null Shopify
  `updatedAt` arrives, clock A prefers that Shopify timestamp and takes
  precedence according to the existing clock-A rules; the fallback
  interval is retained for diagnostics but does not outrank a real
  Shopify `updatedAt` on the other side of a comparison.

**Commit rules (nullable path)**

1. Incoming has Shopify `updatedAt`, stored has Shopify `updatedAt`:
   clock A only (§6.F.5). Ignore fallback intervals for the apply
   decision.
2. Incoming has Shopify `updatedAt`, stored does not: apply incoming
   (Shopify version **outranks** a stored null-version fallback).
3. Incoming lacks Shopify `updatedAt`, stored has Shopify `updatedAt`:
   **do not** apply incoming attributes. A stale full-sync/bulk
   observation with missing version **must not** overwrite a newer
   authoritative versioned fact. Record merchant-durable
   `CATALOG_NULL_VERSION_OBSERVATION` diagnostic evidence if the incoming
   observation was expected to refresh the fact.
4. Both lack Shopify `updatedAt` and the observations are
   **non-overlapping**: apply incoming **only if** incoming
   `attributeRequestGen` is after the stored interval’s
   `attributeResponseGen` (same for per-name quantity intervals). Equal
   non-overlapping identical payloads: idempotent no-op.
5. Both lack Shopify `updatedAt` and the observations **OVERLAP**:
   - if payloads / quantity for that field are **identical**: idempotent
     convergence is allowed;
   - if they produce **different** attributes / quantity: **no**
     last-writer-wins and **no** `attributeResponseGen` winner; preserve
     the last unambiguous value; set `attributeFreshnessState = DEGRADED`
     plus concurrent-observation-conflict evidence; perform a fresh
     **non-overlapping** authoritative refetch.

**Concurrent missing-version observations:** two in-flight refetches each
allocate a start generation before their Shopify request and an end
generation after a usable response. Each occupies its **own**
`CatalogObservationInFlight` row with its own token and finite lease.
They later serialize on the canonical advisory identity anchor
(§6.F.2.2); `SELECT … FOR UPDATE` is secondary when a row exists.
Overlapping conflicting payloads must **not** resolve by end-generation
or lock-acquisition order. A late worker whose token is expired or
abandoned **must not** update null-version attributes (§6.F.2.1 fencing).
Expiry is PostgreSQL `clock_timestamp() >= leaseExpiresAt`. A persistently
`ABANDONED` token fails even if PostgreSQL wall time later moves
backward. A missing in-flight row for that token fails the fence closed.

**Degraded honesty:** when absolute Shopify source freshness cannot be
established (null `updatedAt` on the applied fact), the row’s
`attributeFreshnessState = DEGRADED`. That merchant-durable column is
the correctness evidence. The diagnostic reconciler projects
`DataIssue` `CATALOG_ATTRIBUTE_VERSION_DEGRADED` until a non-null
Shopify `updatedAt` is stored. UI must not claim perfect ordering for that
fact. This is **not** a silent success.

**Inventory quantity names with nullable `InventoryQuantity.updatedAt`:**
the same fallback applies per name via `quantityRequestGen` /
`quantityResponseGen`. A direct authoritative quantity refetch with null
`updatedAt` **must** be able to refresh that name when its interval is a
non-overlapping later check or overlapping identical payload. It **must
not** enter an infinite no-op/refetch loop. A null-version bulk quantity
**must not** overwrite a newer refetch of that name. Overlapping
conflicting quantities: no last-writer-wins; DEGRADED + fresh refetch.

#### 6.F.10 Full-sync absence is candidate + confirmation, not single-epoch authority

Shopify documents BulkOperation mechanics and completion. It does **not**
publish a snapshot-isolation / point-in-time completeness guarantee
sufficient to prove:

> missing from one COMPLETED bulk extraction = authoritatively absent.

That converse is **unsupported**. Treat it as an engineering assumption
only, never as product truth. Recorded as **R-144** (extended) and
**R-154**.

A COMPLETED bulk run / complete location pagination may:

1. Observe all returned GIDs / pairs as **present**
   (`LIVE_FULL_SYNC_PRESENT`, presence marker).
2. Nominate previously-LIVE identities **not seen** in that complete
   epoch as **ABSENCE CANDIDATES** only.
3. Persist candidate evidence durably on the merchant fact row
   (`absenceNominationState = CANDIDATE`, `absenceCandidateEpochId`,
   `absenceCandidateGeneration` = `R.fenceGeneration`).
4. **Must not** write canonical `ABSENT` / tombstones from the
   nomination itself.

**No failed, canceled, or partial bulk may nominate candidates or
tombstone.** Preconditions:

1. `bulkOperation(id:)` status is `COMPLETED` (or location pagination
   exhausted with no errors);
2. `url` is present for bulk domains;
3. `partialDataUrl` is null **or** is ignored for canonical purposes
   (never a success watermark);
4. JSONL/pages were fully streamed and **every in-scope identity’s
   applicator batch committed**, including **presence-marker** writes for
   every observed GID even when attributes no-op’d;
5. two-phase checkpoint has acknowledged every committed batch
   (`jsonlCommittedLineOrdinal` equals the last applied line), or resume
   has idempotently acknowledged orphan committed batches (§6.F.11);
6. domain extraction is complete for the nominated resource type.

A second complete epoch may **strengthen** candidate evidence. It **MUST
NOT** replace authoritative confirmation unless a future explicit
product-owner decision, backed by Shopify consistency evidence, changes
this rule.

##### Mass-absence blast-radius circuit breaker

Before confirmation / tombstone processing, compute:

- absolute candidate count; **and**
- candidate proportion of currently-LIVE rows in that shop/domain.

Exact production thresholds are **CONFIGURABLE** and remain a
**pre-production hypothesis**. They are **not** product truth.

Planning hypothesis only (not a merchant promise, not a locked constant):
absolute **250** candidates **or** **2%** of currently-LIVE rows in that
domain, whichever configured values are later set.

If **either** configured threshold is exceeded:

- abort **ALL** tombstones for that epoch/domain;
- preserve existing LIVE rows (candidates may remain nominated);
- mark reconciliation / domain **DEGRADED** on merchant-durable
  diagnostic state;
- record durable anomaly evidence;
- open/reconcile a `DataIssue` via the diagnostic reconciler;
- schedule a later reconciliation;
- **never** claim `HEALTHY` / full-success deletion reconciliation.

##### Authoritative confirmation (anomaly-only)

Only a completed authoritative query returning null/absent may create
canonical `ABSENT` from a **single** observation
(`existenceKind = ABSENT_CONFIRMED_QUERY`).

Confirmation must be:

- **batched** where supported (planning hypothesis: `nodes(ids:)` pages
  of ≤50 GIDs; inventory-level via
  `inventoryItem.inventoryLevel(locationId:)`);
- otherwise bounded by explicit concurrency / API-cost ceilings
  (planning hypothesis: ≤2 in-flight confirmation requests);
- **anomaly-only**, not the normal full-catalog read path.

**No-N+1 remains the ordinary synchronization rule.** Do **not** send an
unbounded one-query-per-row storm.

A LIVE confirmation of a candidate **clears** the nomination and keeps
LIVE, subject to the overlapping-interval rule. A null confirmation
**may** tombstone that identity only when the confirmation interval does
**not** overlap **any** unresolved **ACTIVE unexpired resultless**
observation (`clock_timestamp() < leaseExpiresAt`) or an unresolved
overlapping LIVE existence observation (terminal GIDs then follow
§6.F.7). Query failure / timeout is **not** absence. Expired resultless
observations do **not** keep confirmation blocked **after** they are
durably `ABANDONED` (or equivalently fenced `ACTIVE -> ABANDONED` in
the same tenant / identity transaction that is about to tombstone).
Expiry of one blocker does **not** unblock confirmation while another
overlapping ACTIVE unexpired resultless observation remains. Confirmation
that relies on expiry **MUST** perform that durable fencing itself;
it **MUST NOT** depend on a background reaper.

The new direct-query interval rule applies to those **absence-confirmation
queries** too. A bulk absence candidate **must not** tombstone while
**any** overlapping **ACTIVE, UNEXPIRED, resultless** direct observation,
or an overlapping **completed LIVE** existence observation, remains
unresolved under §6.F.2.1 / §6.F.3. An expired resultless observation
does **not** keep the candidate blocked **after** durable
`ACTIVE -> ABANDONED` fencing in the same tenant / identity transaction.

##### Candidate-nomination isolation (READ COMMITTED)

Any set-based absence/candidate sweep that races tenant fact application
**must** run at PostgreSQL **READ COMMITTED**.

The plan relies on PostgreSQL re-evaluating the `UPDATE` predicate after
waiting on a concurrently locked row (EvalPlanQual).

Do **not** run this sweep inside `REPEATABLE READ` or `SERIALIZABLE`
without a separately approved design. PR 4 `RepeatableRead` on some sync
paths is **not** a precedent for this sweep.

If a concurrency / serialization error still occurs: fail/retry the
reconciliation unit; do **not** partially reinterpret absence.

Illustrative candidate nomination (exact SQL is implementation; this
**does not** set `existenceState = ABSENT`):

```text
UPDATE fact
SET absenceNominationState = 'CANDIDATE',
    absenceCandidateEpochId = :epochId,
    absenceCandidateGeneration = :fenceGeneration
WHERE shopId = :shopId
  AND lastSeenFullSyncRunId IS DISTINCT FROM :epochId
  AND existenceState = 'LIVE'
  AND (existenceRequestGen IS NULL
       OR existenceRequestGen <= :fenceGeneration)
```

A direct observation started after the fence iff
`existenceRequestGen > fenceGeneration`. That row must survive nomination.
The sweep **must not** tombstone. Confirmation still uses the interval
rule: do not tombstone a candidate while an overlapping **ACTIVE
unexpired resultless** observation or overlapping completed LIVE existence
observation is unresolved. Expired resultless observations do not block
**after** durable `ACTIVE -> ABANDONED` fencing in the same tenant /
identity transaction that relies on that expiry.

The sweep **does not** compare `shopifyUpdatedAt` or `shopifyCreatedAt`
to `R.fenceAt`. `shopifyCreatedAt` is **not** an absence guard.
`fenceAt` remains diagnostics.

#### 6.F.11 Two-phase JSONL checkpoint (explicitly two connections)

Delete any primary wording that checkpoint + merchant fact batch can
commit in **one** transaction. That architecture is **unavailable** and
**prohibited**.

`jsonlCommittedLineOrdinal` lives on `SyncRun` (`platform_control_plane`,
runtime `expectedRuntimePrivileges: []`). Merchant facts live on
restricted-runtime tenant tables. No database transaction spans the two
roles / connections. Preserve **R-102** and **R-137**.

Approved planning model:

1. **Runtime / merchant transaction:** apply the bounded fact batch;
   assign durable `ingestBatchId` / batch evidence on the fact rows
   (and presence markers); **COMMIT** facts.
2. **AFTER merchant commit — control-plane connection:** advance
   `SyncRun.jsonlCommittedLineOrdinal` / batch acknowledgement.

Crash between those commits:

- checkpoint **may lag** facts;
- checkpoint must **NEVER** lead facts.

Resume:

- re-stream from byte 0 (no HTTP Range assumption);
- identify / replay the orphan committed batch **idempotently**;
- acknowledge it on `SyncRun`;
- continue.

Runtime remains **denied DML on `SyncRun`**. Control-plane does **not**
write merchant facts.

#### 6.F.12 DataIssue / SyncHealth are derived, not atomic authority

`DataIssue` and `SyncHealth` remain **control-plane** resources. They do
**not** commit atomically with merchant fact decisions. Do **not** widen
the control-plane role to merchant data.

Correctness evidence must be durable on the **merchant / runtime** side
when a fact decision changes. Use:

- `attributeFreshnessState`;
- `compatibilityProjectionState`;
- `existenceDiagnosticState`;
- `absenceNominationState` / circuit-breaker markers;

and, if needed, a tenant-safe merchant-domain diagnostic marker / outbox
as a logical planning model.

For failures that occur **before** a merchant fact transaction can change
state, the durable PR 4 `JobAttempt` / job lifecycle remains primary
evidence.

**Bounded diagnostic reconciler:**

merchant durable state / job-attempt failure
→ control-plane `DataIssue` / `SyncHealth` projection

It must:

- recreate missing `DataIssue`s after a crash;
- close orphaned issues when merchant state recovers;
- **not** change canonical fact truth;
- be idempotent.

A canonical commit may succeed while diagnostic projection is temporarily
behind. The durable source state must prevent false `HEALTHY` reporting
after reconciliation.

#### 6.F.13 Adversarial races this PR’s tests must cover

Implementation tests (when PR 5 implementation is authorized — **not
now**) **must** include races **A–AD** (preserved), **AE–AL**
(correction 4), **AM–AN** (correction 5), **AO–AR** (correction 6),
**AS** (correction 7), **AT–AV** (correction 8), **and AW**
(implementation-entry). Race **AM** is
extended by correction 6 and further by correction 7. Race **AQ** is
extended by correction 7. Race **AB** is extended by correction 5:

| Race | Setup | Required outcome |
|---|---|---|
| **A. Delayed bulk vs newer incremental attributes** | Incremental refetch writes Shopify `updatedAt = T+5` and a non-overlapping existence interval with `existenceRequestGen = G1`. Later, bulk row from run fenced at T0 arrives with Shopify `updatedAt = T+1`. | Canonical **attributes** stay at T+5. Bulk attributes no-op. GID still `lastSeenFullSyncRunId =` this epoch. Existence remains LIVE. |
| **B. Full-sync omission vs post-fence create** | Bulk fenced at T0 does not contain GID X. After T0, Shopify creates X; incremental LIVE refetch writes X with `existenceRequestGen > R.fenceGeneration` (direct observation started after the fence). Candidate nomination runs. | X remains LIVE. X is **not** nominated (request-start generation predicate). Do **not** implement this by comparing Shopify `createdAt`/`updatedAt` to `fenceAt`. |
| **C. Confirmed absence vs late older bulk** | Absence confirmed with unambiguous interval ending at G2. Late bulk row from run with `fenceGeneration = G1 < G2` arrives. | Row stays ABSENT. Late bulk does not resurrect. Fence compared only to existence intervals, never used as fake Shopify `updatedAt`. |
| **D. `partialDataUrl` completeness** | Bulk `COMPLETED` with `partialDataUrl` set and `url` null or ignored. | No candidate nomination. No tombstone work. No completeness watermark. Diagnostic `DataIssue` opened. LIVE rows unchanged. |
| **E. JSONL two-phase checkpoint crash** | Batch lines 101–200 commit on the runtime connection; process crashes before the control-plane checkpoint write. | Checkpoint **lags** facts and **never** leads. Resume re-streams from byte 0, idempotently recognizes ingest batch 101–200, then acknowledges `jsonlCommittedLineOrdinal`. Runtime cannot DML `SyncRun`. |
| **F. Projection failure** | Canonical commit succeeds; projection throws. | Canonical row present. Merchant `compatibilityProjectionState = DEGRADED`. Reconciler projects `DataIssue`. Rebuild restores projection without rolling back canonical. |
| **G. Mixed quantity names** | Stored `committed.updatedAt = T+3`. Incoming snapshot has newer `available` but older `committed`. | `available` may apply; `committed` must not rewind. |
| **H. Delayed delete webhook after live refetch** | LIVE refetch confirms GID current. Later, delayed delete/disconnect webhook arrives. Authoritative re-check still returns live **or** is required before any tombstone. | Signal alone **must not** tombstone current live authority. Stale-signal merchant diagnostic + derived `DataIssue`. LIVE retained (or re-confirmed). Terminal revival does not apply to a still-LIVE row. |
| **I. Confirmed absence after full-sync fence; late older bulk cannot resurrect** | Confirmation tombstones with unambiguous interval ending ≥ fence. Older bulk row later arrives. | Existence stays ABSENT. See also Race C. |
| **J. Live check after reconnectable tombstone** | Inventory-level row ABSENT via `ABSENT_CONFIRMED_QUERY`. Later **non-overlapping** LIVE refetch returns the same pair (`LIVE.observationRequestGen` after absence `existenceResponseGen`). Shopify `updatedAt` is **not** compared to local absence time. | Existence **may recover** (LIVE) because clock B shows a later non-overlapping app-issued check. Attributes still follow clock A (may no-op). **Not** the terminal-GID path. Overlapping LIVE/ABSENT must not recover from `observationResponseGen` alone. |
| **K. Full sync observes GID; stale attributes no-op; presence marker still advances** | Canonical X has Shopify `updatedAt` T-0.5 from delayed incremental. Bulk contains X with `updatedAt` T-2. | Attributes rejected. `lastSeenFullSyncRunId = epochId`. X is not an absence candidate. Bounded memory (column update, no in-process GID set). |
| **L. Nullable Shopify `updatedAt`: authoritative refetch can update** | Stored fact has null `shopifyUpdatedAt`. Direct authoritative refetch also has null `updatedAt` but a **non-overlapping** later attribute interval. | Fact **updates**. No infinite no-op. `attributeFreshnessState = DEGRADED` until a real Shopify `updatedAt` exists. |
| **M. Concurrent missing-version observations (interval overlap)** | Two null-`updatedAt` authoritative observations with **overlapping** intervals and **different** payloads. Response A arrives first; A pauses before end-generation; B obtains end generation first. | **No** last-writer-wins. **No** `attributeResponseGen` winner. Preserve last unambiguous value. DEGRADED + concurrent-observation-conflict + fresh non-overlapping refetch. Same for per-name quantity intervals. |
| **N. Failed authoritative delete/disconnect refetch** | Delete/disconnect signal received. Existence query times out / 5xx / throttled. | Query failure is **not** converted into canonical deletion. Retry / `CATALOG_EXISTENCE_CHECK_FAILED` / DEGRADED. Last confirmed existence retained. If no merchant txn ran, `JobAttempt` is primary evidence. |
| **O. Partial/failed bulk still cannot nominate or tombstone** | `FAILED`, `CANCELED`, or `COMPLETED` with only `partialDataUrl`. | Candidates are not promoted. No tombstone work runs. |
| **P. Sequence uniqueness** | Two concurrent allocators (`nextval`). | Never receive duplicate generations. |
| **Q. Sequence crash gap** | Allocator `nextval` succeeds; process crashes before `SyncRun.fenceGeneration` persist or before fact apply. | Value is burned and **never reused**. |
| **R. Zero Shop counter writes** | Bootstrap / authentication Shop row during catalog sync. | Shop row receives **zero** generation writes. `catalogObservationGen` does not exist. |
| **S. No lock across Shopify I/O** | Direct refetch instrumentation. | No merchant or control-plane row lock **and no advisory identity lock** is held across the Shopify HTTP request. Start generation is allocated **before** the request; end generation **after** a usable response and kept in-process; the canonical `pg_advisory_xact_lock` identity anchor is taken **after** that, inside the tenant fact transaction. A new `CatalogObservationInFlight` row (token + finite lease) is committed then locks released before I/O. |
| **T. Non-overlapping existence vs commit order** | Observation A fully completes (`requestStartGen` and `responseEndGen` allocated) before B starts. B then commits first. A later obtains the lock. | A must **not** overwrite B. B may supersede A on clock B because B is the later non-overlapping app-issued check. Repeat for LIVE and ABSENT existence. Do **not** use this race to claim end-generation order across overlapping workers. |
| **U. Bulk omission is not absence** | Successful JSONL omits GID X; direct query still returns X live. | No tombstone. Candidate may exist; confirmation keeps LIVE. |
| **V. Circuit breaker** | Candidate count or proportion exceeds the configured threshold. | **Zero** tombstones. LIVE preserved. Domain DEGRADED. Anomaly `DataIssue`. No HEALTHY deletion reconciliation. |
| **W. Small candidate set + null confirmation** | Candidate set under threshold. Direct completed query returns null. | Tombstone allowed (`ABSENT_CONFIRMED_QUERY`). |
| **X. Inventory-level pair uniqueness** | Bulk ingest creates a level (with Shopify level GID). Disconnect payload supplies item+location only. Reconnect/refetch. | Exactly **one** canonical row keyed by `(shopId, inventoryItemGid, locationGid)`. No second row from a different level GID. |
| **Y. Runtime denied SyncRun DML** | Restricted runtime role attempts INSERT/UPDATE/DELETE on `SyncRun`. | Denied. Regression of the PR 4 control-plane privilege suite. |
| **Z. Diagnostic lag** | Fact commits `DEGRADED` / `TERMINAL_IDENTITY_REVIVAL_CONFLICT` / candidate circuit-breaker. Process dies before `DataIssue` write. | Reconciler recreates the `DataIssue`. Canonical truth unchanged. No false HEALTHY after reconciliation. |
| **AA. READ COMMITTED candidate sweep** | Newer LIVE authoritative observation commits while the candidate sweep is attempting the same row. | Row remains LIVE / candidate predicate re-evaluates correctly. Sweep is not REPEATABLE READ / SERIALIZABLE. |
| **AB. Terminal single-response non-revival** | Confirmed terminal deletion (`ABSENT_CONFIRMED_QUERY`). Case 1: one transient later LIVE response. Case 2: two **overlapping** later LIVE responses (`second.observationRequestGen` **not greater than** `first.observationResponseGen`). | Tombstone **retained**. `TERMINAL_IDENTITY_REVIVAL_CONFLICT`. No silent LIVE restore. Two overlapping LIVE responses **do not** satisfy the two-confirmation revival threshold. Required ordering for the two confirmations: `second.observationRequestGen > first.observationResponseGen`. Existing createdAt / audit / conflict safeguards remain. |
| **AC. Write-scanner negative fixture** | Plant `inventoryBulkToggleActivation` (or `inventoryDeactivate`) into a PR 5 fact adapter. | CI **fails**. Deny-by-default mutation detection (GraphQL AST / semantic inspection, R-110 precedent). No inventory mutation feature flag enabled. |
| **AD. Sequence privilege allowlist** | Runtime and control-plane roles. | Each has **USAGE only** on `stocky_catalog_observation_gen_seq`. **No SELECT. No UPDATE.** PUBLIC has none. Schema-wide `ON SEQUENCES` fails verify. Runtime and control-plane do **not** own the sequence. No table-privilege bypass. |
| **AE. Sequence privilege — USAGE only nextval** | Restricted `stocky_runtime` and `stocky_control_plane` with USAGE only (no SELECT, no UPDATE). | Runtime `nextval` succeeds. Control-plane `nextval` succeeds. |
| **AF. setval denial** | Same roles attempt `setval` on `stocky_catalog_observation_gen_seq`. | Runtime `setval` fails. Control-plane `setval` fails. PUBLIC `nextval` fails. |
| **AG. No-cycle verifier** | Sequence definition / wrap attempt. | Sequence is explicitly **NO CYCLE**. It cannot cycle or reuse generations. |
| **AH. Response scheduling inversion** | Response A arrives first. A pauses **before** end-generation allocation. Response B arrives later and gets end generation first. A and B existence results **conflict**. | Conflicting A/B results must **NOT** resolve by end-generation order. Preserve last unambiguous state. Conflict evidence + fresh refetch. |
| **AI. Non-overlapping observations** | A completes fully (start and end allocated). B starts afterward (`B.observationRequestGen` after `A.observationResponseGen`). | B may supersede A on clock B. |
| **AJ. Overlapping LIVE vs ABSENT** | Two overlapping direct existence observations, LIVE vs ABSENT (and the reverse). | Preserve last unambiguous state. `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT` + derived DataIssue + fresh refetch after both complete. No false tombstone/revival. Terminal-revival safeguards are not bypassed. |
| **AK. Overlapping null-version quantity conflict** | Two overlapping null-`updatedAt` quantity observations with **different** values for the same name. | No last-writer-wins. Preserve last unambiguous value. DEGRADED + concurrent-observation-conflict + fresh non-overlapping refetch. |
| **AL. Bulk absence candidate + overlapping LIVE direct check** | Candidate nominated from complete bulk omission. Direct LIVE existence observation overlaps the absence-confirmation interval. | No tombstone until an unambiguous authoritative confirmation (non-overlapping later check). Overlapping LIVE remains unresolved → candidate stays LIVE. |
| **AM. Hard crash / orphaned in-flight observation** | Worker A allocates `requestGen`, commits **ACTIVE** `CatalogObservationInFlight` evidence, then **hard-crashes** before `responseGen` / fact application. **No graceful cleanup** runs. The lease crossing **must** be established using PostgreSQL-authoritative time (`clock_timestamp()`), **not** an application fake clock or local timer. | No tombstone or revival occurs from A. While A’s lease is still active (`clock_timestamp() < leaseExpiresAt`), overlapping later evidence **cannot mutate canonical existence**. After the finite deadline (`clock_timestamp() >= leaseExpiresAt`) A is **lease-invalid**: A cannot apply. Remaining physically `ACTIVE` after expiry is **not** permission for a successor to mutate. A successor that wants to proceed **MUST** durably transition A `ACTIVE -> ABANDONED` in the same tenant / identity transaction that relies on that expiry, then re-evaluate remaining blockers. A’s `requestGen` is never reused. Exact boundary: `dbClock < leaseExpiresAt` ⇒ still active; `dbClock >= leaseExpiresAt` ⇒ original cannot apply. CASE 1 clock rollback before any successor fences A is a liveness delay only. |
| **AN. Late response after abandonment** | A starts and commits ACTIVE evidence. A’s lease expires (`clock_timestamp() >= leaseExpiresAt`). B performs a later valid fresh observation and, in the same tenant / identity transaction that applies B’s canonical mutation, durably transitions A `ACTIVE -> ABANDONED`. A’s old request finally returns and attempts fact application. | A fails the observation-token / active-lease / not-`ABANDONED` fence. A cannot mutate canonical existence or attributes. A cannot clear B’s evidence. A cannot tombstone or revive. No response-end LWW occurs. B / fresh evidence remains authoritative under the normal interval rules. Later database-clock rollback cannot restore A (CASE 2). |
| **AO. Application-node clock skew / authoritative DB clock** | Worker A’s application clock is deliberately far **ahead**. Worker B’s application clock is deliberately far **behind**. Both operate against the **same** PostgreSQL lease record. PostgreSQL `clock_timestamp()` remains authoritative. Include exact equality: `clock_timestamp() == leaseExpiresAt` ⇒ expired. | `leaseExpiresAt` is computed from database time, not either node clock. Both workers make the **same** lease-validity decision for the same DB instant. An application clock cannot prematurely abandon. An application clock cannot extend validity. The final stale-worker fence uses PostgreSQL time. No canonical fact divergence from node-clock skew. |
| **AP. Physically missing in-flight row** | A starts an observation. Its row later becomes eligible for physical cleanup and is **removed**. Old A worker resumes with its old token / response. | Exact-token fence returns no valid row. Zero rows **fail closed**. A cannot recreate the row in order to apply. No LIVE / ABSENT write. No attribute update. No tombstone / revival. No clearing of newer evidence. Burned generations remain harmless. |
| **AQ. Multiple blockers / partial expiry** | A and B are both **ACTIVE**, unexpired, resultless, and overlap C. C obtains a usable response. A reaches lease expiry. B remains ACTIVE and unexpired (`clock_timestamp() < B.leaseExpiresAt`). C’s transaction may durably mark A `ABANDONED` using the exact-token / expiry predicate. | C remains blocked by B. Durable abandonment of A alone cannot release C. Held C response is **not** replayed later as fresh. Only after **every** expired blocker being relied upon is durably `ABANDONED` **and** no ACTIVE / unexpired blocker remains may a **fresh** successor observation proceed. No tombstone / revival or stale canonical mutation. |
| **AR. Response before expiry / apply after expiry** | 1. A starts and receives an authoritative usable Shopify response while `clock_timestamp() < leaseExpiresAt`. 2. A allocates `responseGen`. 3. A waits on the canonical identity lock or is otherwise paused. 4. PostgreSQL authoritative time reaches `clock_timestamp() >= leaseExpiresAt`. 5. A finally reaches the fact-application fence. | Fence fails because validity is evaluated at **fact decision time**. Response-arrival-before-expiry is irrelevant. `responseGen`-before-expiry is irrelevant. Transaction-start-before-expiry is irrelevant. No LIVE / ABSENT mutation. No null-version attribute mutation. No tombstone / revival. No clearing newer evidence. Burned `responseGen` is the only residue. Bounded fresh retry / refetch is required. |
| **AS. Database clock rollback after expiry takeover** | 1. A creates an ACTIVE resultless observation. 2. PostgreSQL `clock_timestamp()` reaches `>= A.leaseExpiresAt`. 3. B acquires the canonical identity boundary and wants to proceed. 4. In B’s same tenant transaction, B conditionally transitions A `ACTIVE -> ABANDONED` using the exact token and database-expiry predicate. 5. B applies valid newer canonical evidence. 6. Transaction commits. 7. PostgreSQL wall clock is then moved backward so that `clock_timestamp() < A.leaseExpiresAt` would now be true if time alone were checked. 8. Old A resumes and attempts application. Also include rollback: B’s transaction fails / rolls back before canonical mutation commits. | After commit: A remains `ABANDONED`; A cannot become `ACTIVE` again; A fails its exact-token lifecycle fence; clock rollback does not restore A’s validity; A cannot write LIVE/ABSENT; A cannot update null-version attributes; A cannot tombstone/revive; A cannot clear B/newer evidence; B’s committed canonical state remains authoritative; no application-node clock participates. Rollback case: the `ACTIVE -> ABANDONED` transitions made by B’s transaction roll back with it. No half-applied takeover state. |
| **AT. Concurrent first canonical application of a nonexistent identity** | No canonical fact row exists. **AT-1 direct vs direct:** A and B direct observations overlap; both obtain usable authoritative responses; payloads / existence evidence differ or conflict; both attempt first canonical application concurrently. **AT-2 null-version attributes:** no canonical row; two overlapping observations carry different null-`updatedAt` attribute or quantity values. **AT-3 initial bulk JSONL vs direct refetch:** no canonical row; bulk / JSONL first application and webhook-driven direct refetch race. **AT-4 active blocker:** no canonical row; an ACTIVE unexpired resultless direct observation exists; another transaction acquires the advisory identity anchor and attempts first canonical mutation. | **AT-1:** both use the same canonical advisory identity anchor; only one fact transaction evaluates the identity at a time; the second transaction re-reads state / evidence after obtaining the anchor; exactly zero or one canonical row results as dictated by existing conflict rules — **never** duplicate rows; conflicting overlap cannot become response-end or commit-order LWW; if existing rules require preserving no unambiguous canonical fact and refetching, that result; **no** `ON CONFLICT DO UPDATE` blind overwrite; conflict / degraded / refetch evidence is preserved where required. **AT-2:** no last-writer-wins; advisory serialization does not bypass interval conflict rules; DEGRADED / conflict / refetch behavior follows §6.F.9. **AT-3:** both use the same identity anchor; full-sync fence / direct-observation ordering rules are re-evaluated after lock acquisition; bulk cannot blindly overwrite a newer / conflicting direct observation; exactly one coherent canonical result or conflict / refetch state remains. **AT-4:** absence of a canonical row does **not** bypass blocker logic; mutation remains blocked under the existing rule. |
| **AU. No response-bearing ACTIVE row** | 1. A commits ACTIVE resultless observation evidence. 2. Shopify response arrives. 3. A allocates `responseGen`. 4. `responseGen` remains in-process only. 5. A pauses before entering / applying the tenant fact transaction. 6. Verify the persisted row still has `ACTIVE` and `observationResponseGen = NULL`. 7. Lease expires. 8. B durably fences A `ACTIVE -> ABANDONED` and applies valid newer evidence. 9. Database wall clock later moves backward. 10. A resumes with the old response payload and its in-process `responseGen`. **Crash variant:** A terminates after `responseGen` allocation. | A remains `ABANDONED`; A cannot persist its old `responseGen`; A cannot restore `ACTIVE`; A cannot write LIVE/ABSENT; A cannot update null-version attributes; A cannot tombstone/revive; A cannot clear B; B remains authoritative; only the allocated sequence value was burned. The database constraint rejects any attempted commit of `ACTIVE` + `observationResponseGen != NULL`. Crash variant: the DB row remains `ACTIVE` / resultless until graceful recovery or expiry takeover. |
| **AV. Deterministic canonical lock ordering** | Two bounded transactions process canonical identities X and Y but receive them in opposite input orders. Also include observation-row locking within one identity and a hash-key collision case. | Both normalize advisory locks into the same ascending `(key1, key2)` order; no AB/BA lock-order deadlock; same-identity operations remain serialized; hash-key collision causes **only** over-serialization; observation-row locks occur only after the canonical anchor and in deterministic `observationRequestGen` / token order; no half-applied canonical state. |
| **AW. Advisory lock capacity / concurrent bulk apply** | Disposable PostgreSQL configured with the intended `max_locks_per_transaction` envelope. Concurrent canonical multi-identity transactions at the configured batch / concurrency ceiling, while direct one-identity work also occurs. Include an intentionally unsafe configured envelope and a lock-resource exhaustion case. | Configured unsafe envelope is rejected or reduced before processing. Safe configured envelope proceeds. Lock-resource failure aborts the whole affected transaction. No half-applied canonical state. No half-applied `ACTIVE -> ABANDONED` transitions. Transaction advisory locks do not survive rollback / commit. Bounded retry uses a smaller sub-batch. No unanchored fallback exists. One identity is never split across transactions. Repeated failure ends in explicit degraded / failure state. No infinite retry. No inventory mutation. Known-answer vectors 1–3 must also be reproduced by the single canonical key-derivation function. |

Tests **must** fail closed: a focused command that collects zero tests is
a failed check (PR 4 CI pattern).

#### 6.F.14 Planning non-goals (reiterated)

This section does **not**:

- authorize production, merchant production data, inventory-write flags,
  Shopify inventory mutations, later PR5 runtime lanes, or PR 6;
- reopen D-054 (it is **EFFECTIVE**; PR5-F1 foundation corrections are
  in progress);
- change D-052 / PR 4 control-plane semantics;
- add Shopify write mutations;
- couple forecast/ABC into the applicator;
- close Q-002, Q-004, R-028, R-029, or R-095..R-098;
- close R-102 or R-137;
- close R-157, R-158, R-159, R-160, or R-161;
- grant `stocky_control_plane` DML on merchant fact or in-flight tables.

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

- Projection runs **after** canonical apply succeeds, in a **separate** step that **cannot fail or roll back** the canonical apply.
- Projection must not call forecast, ABC, or low-stock logic.
- Do not drop legacy tables or `shop` columns in PR 5.
- Do not add unique SKU constraints to legacy tables.

### Projection failure / retry contract (not silent)

Canonical success with a failed projection is **allowed**. It is **not** silent.

| Rule | Requirement |
|---|---|
| Isolation | Projection runs after the canonical tenant transaction commits. Projection errors must not `ROLLBACK` canonical facts. |
| Idempotent / rebuildable | Projection is a `REBUILDABLE_IDEMPOTENT` compatibility rebuild from canonical facts. It must not re-enter the canonical applicator. |
| Visibility | Failure records merchant-durable `compatibilityProjectionState = DEGRADED` **on the fact/projection source**. The bounded diagnostic reconciler projects `DataIssue` (`COMPATIBILITY_PROJECTION_FAILED`) and `SyncHealth`. `DataIssue` / `SyncHealth` are **not** atomic with the canonical commit and **must not** be the only durable evidence. |
| SyncHealth | A canonical domain may be internally `SUCCEEDED` / current while merchant-facing **compatibility** health is `DEGRADED`. Diagnostics must show both. A crash after canonical/projection-state commit and before `DataIssue` write must not report false `HEALTHY` after reconciliation. |
| Merchant-facing claim | Do **not** claim the legacy-dependent surface (Buying Table / barcode cache / today’s `InventorySnapshot`) is fully healthy or current while its projection is stale or failed. |
| Retry | Bounded retry / rebuild via the existing PR 4 attempt lifecycle on a dedicated projection continuation (or the same catalog-sync job’s post-canonical step). Retry **must not** reapply or corrupt canonical facts. |
| Repair | A successful rebuild restores compatibility health to healthy **only after** the projection matches the canonical facts it is derived from. |
| Uninstall | `processingEnabled=false` / disabled-shop remains fail-closed. Projection retry must not run merchant writes after uninstall. |

Later cleanup of duplicate authority remains **R-142**. Silent stale projection is **R-145**.

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
| BulkOperation ID | Persist the exact GID returned by `bulkOperationRunQuery` on the `SyncRun` (dedicated column **or** `cursorAfter` / `resultMetadata` — implementation chooses the smallest additive schema change). Lookup via persisted GID + `bulkOperation(id:)` or `node(id:)` |
| Full-sync fence | Control-plane transaction: `SELECT nextval('stocky_catalog_observation_gen_seq')`; persist `SyncRun.fenceGeneration` **and** `SyncRun.fenceAt`; **COMMIT**; **only then** `bulkOperationRunQuery` / first location page. Burned generations are safe; a fence generation is **never reused**. `fenceGeneration` is the comparable app-issued presence / null-version marker. `fenceAt` is diagnostics. Do **not** compare `fenceAt` to Shopify `updatedAt`. Do **not** hold a row lock across the Shopify call. |
| JSONL checkpoint | Two-phase only (§6.F.11). Merchant facts commit `ingestBatchId` first; control-plane then advances `jsonlCommittedLineOrdinal`. Checkpoint may lag; must never lead. No HTTP Range assumption |
| **Forbidden** | `currentBulkOperation` in any PR 5 document or helper. Binding to “the current operation” is forbidden because five concurrent bulk queries per shop are supported. |

Official 2026-07: `currentBulkOperation` is **Deprecated**; Shopify officially recommends `bulkOperations(status…)` as the replacement. **Stocky deliberately chooses** persisted BulkOperation GID + `bulkOperation(id:)` because multiple simultaneous operations are supported and exact-operation identity is stronger. `bulkOperations` is **officially valid**; it is **not** portrayed as invalid. PR 5 still forbids `currentBulkOperation` and still forbids polling an unbound “current” operation. Direct lookup: `bulkOperation(id: ID!)`. Guide for 2026-01+: poll `bulkOperation(id:)`. `url` and `partialDataUrl` expire **7 days**.

Also subscribe to `bulk_operations/finish` as a **signal** (recommended by the official bulk guide). The webhook payload is not the JSONL. After the signal, refetch `bulkOperation(id:)` using the **persisted** GID, not “the current” operation. Webhook delivery is not guaranteed; polling the persisted ID remains required. One shop may run up to **five** bulk query operations simultaneously on 2026-07; still bind each `SyncRun` to its own GID so concurrent ops cannot be confused.

### 8.2 Bulk queries (read-only)

Respect official restrictions: one top-level connection; max **five** connections; max **two** nested connection levels; connections must implement `Node`; no top-level `node`/`nodes`; `first`/`cursor`/`pageInfo` are optional and ignored. `groupObjects` must remain **false** (official: grouping slows operations and increases timeouts).

**Catalog bulk (proposed):** `products { variants { inventoryItem { … optional unitCost } } collections { id title } }`. Keep connection count ≤ 5 and nesting ≤ 2. Select the **with-unitCost** or **no-unitCost** document according to the §6.C capability preflight. **Product featured media** is PR 5 canonical media (`featuredMedia` / equivalent non-connection field). Variant-level `media` connection is **deferred** because `products → variants → media` exceeds official two-level nesting. `ShopifyVariantFact.mediaUrl` is **not** a mandatory PR 5 acceptance field.

**Inventory-level bulk (proposed):** `inventoryItems { inventoryLevels(includeInactive: true) { id isActive createdAt updatedAt location { id } quantities(names: [all eight]) { name quantity updatedAt } } }`.

**Locations:** complete GraphQL cursor pagination in the worker (validated complete mechanism). Not `first: 50` with discarded `pageInfo`.

Do **not** nest `products → variants → inventoryLevels` if that exceeds bulk depth; use the split above.

### 8.3 JSONL application

Official JSONL: each line is a node; nested connections are flattened; `__parentId` is added automatically and **cannot be queried**. Parents appear before children.

Official bulk-operations guide (2026-08-14): completed operations expose a **signed** result URL that expires after **seven days**. The guide documents download-then-parse. It does **not** document HTTP `Range` / random access on that URL. PR 5 **must not assume** Range support unless a later implementation independently verifies it against official behavior and records that evidence. Until then, resume **re-downloads / re-streams from byte 0**.

Required implementation properties:

- Stream the result URL incrementally (HTTP stream + line reader).
- **No** `response.text()` + `split('\n')` of the full body.
- **No** full `variants[]` materialization.
- **No** one GraphQL call per row.
- **No** one database transaction per row as the steady-state pattern.
- Bounded memory: O(batch size), not O(catalog). Re-stream skip of already-committed lines must not buffer those lines.
- JSONL **read** batch and canonical-**apply** transaction batch are **separate**. The JSONL reader may still consume larger bounded chunks (historical planning ceiling ≤500 parsed rows remains a reader/memory bound, configurable). A single canonical fact transaction must **not** automatically acquire one advisory lock for every parsed row. Canonical identities per canonical fact transaction default to **32** (engineering hypothesis; configurable downward; increase requires capacity evidence; see §6.F.2.2 F-CLAUDE-PR5C8-01).
- Apply each identity through the **canonical apply algorithm** under the §6.F.2.2 advisory identity anchor (plus secondary `SELECT … FOR UPDATE` when the row exists), using §6.F clock-A attribute freshness, clock-B existence, and epoch **presence marker** (not last-writer-wins). Presence (`lastSeenFullSyncRunId`) advances even when attributes no-op. Uniqueness on `(shopId, shopifyGid)` or `(shopId, inventoryItemGid, locationGid)` is a safety net, **not** the apply algorithm. **Do not** treat `INSERT … ON CONFLICT DO UPDATE` as a correctness path that blindly overwrites existence or attribute columns. A unique conflict despite the advisory anchor **must** fail closed / retry the full apply algorithm.
- **Line/batch checkpoint is two-phase application progress** (§6.F.11). Merchant facts commit with `ingestBatchId`. Control-plane `jsonlCommittedLineOrdinal` (1-based last fully acknowledged JSONL line) advances **afterwards**, on the control-plane connection. Runtime is denied DML on `SyncRun`. No transaction spans the two roles.
- Checkpoint **must never** advance past a batch whose fact transaction did not commit. Checkpoint **may lag** facts. On resume, an orphan committed batch (facts present, checkpoint behind) is identified/replayed **idempotently** and then acknowledged **without skipping uncommitted lines**.
- Restart without Range: if the same BulkOperation is still `COMPLETED` and `url` unexpired, re-stream from byte 0; already-committed ingest batches are idempotent §6.F applies (attribute no-op + presence marker remains set) then acknowledged; lines after the checkpoint are applied. Repeated records converge by identity key + clock-A / clock-B / presence-marker rules.
- If the URL is expired: start a **new** BulkOperation; **never** convert the old run to `SUCCEEDED`. Allocate a **new** fence generation; never reuse the burned/old fence.
- Crash boundaries that must be tested: (1) kill before batch commit — replay applies the batch; (2) kill after merchant batch commit and before control-plane checkpoint acknowledgement — resume must not skip those rows and must not require runtime DML on `SyncRun`; (3) re-stream from start without Range; (4) expired URL.

### 8.4 Failed bulk / `partialDataUrl` — chosen rule

**Chosen: (a) discarded from canonical completion and retained only for diagnostics.**

- Do **not** apply `partialDataUrl` JSONL to canonical fact tables.
- Record `SyncRun` `FAILED` or `PARTIAL_FAILURE` with `partialFailure=true`.
- Persist BulkOperation GID, `status`, `errorCode`, `objectCount`, `rootObjectCount`, and `partialDataUrl` **metadata** (not merchant-domain facts) for diagnostics until expiry.
- Record merchant/control diagnostic evidence (`JobAttempt` / `SyncRun` failure fields). The diagnostic reconciler projects a `DataIssue`.
- **Never** advance a full-sync success watermark (`SyncCursor` / `HEALTHY` successor) from partial or failed data.
- Do **not** tombstone-by-absence using a partial set, and do **not** run §6.F.10 candidate nomination or confirmation (that would treat omitted GIDs as absent).

Rationale vs (b): staging incomplete rows as live canonical facts would make deletion/recreation and completeness proofs false. Control-plane incomplete evidence is already expressible as `PARTIAL_FAILURE` + `DataIssue` without applying rows.

### 8.5 Success watermark

A domain watermark advances to “full sync succeeded” only when:

1. BulkOperation `status=COMPLETED` (or locations pagination exhausted with no errors);
2. JSONL/pages fully applied;
3. checkpoints complete;
4. absence **candidate nomination** for that domain ran against the **complete** epoch using `lastSeenFullSyncRunId` and `fenceGeneration` compared to `existenceRequestGen` (§6.F.10) — **never** an in-memory GID list, **never** Shopify `updatedAt` vs `fenceAt`, and **never** after partial/failed bulk;
5. the blast-radius circuit breaker either allowed bounded confirmation or aborted **all** tombstones and marked the domain DEGRADED — a tripped breaker is **not** `HEALTHY` deletion reconciliation;
6. every tombstone actually written was produced only by `ABSENT_CONFIRMED_QUERY`, never by bulk omission alone;
7. `SyncRun.status=SUCCEEDED` only when the domain’s presence application and (if breaker-open) confirmation policy completed without claiming false deletion success.

Locations, catalog, and inventory_levels watermarks are independent. Catalog-sync job success requires all three domain runs succeeded; otherwise the durable job retries/rebuilds per `REBUILDABLE_IDEMPOTENT` without claiming HEALTHY for failed domains.

### 8.6 Shop currency

Once per catalog-sync (not per row), read `shop { currencyCode }` and apply that code to variant `Money` fields that lack field-level currency (`Money` scalar).

Currency provenance:

- persist currency **with every stamped monetary amount**;
- record the source `SyncRun` / observation lineage that produced that currency stamp;
- if `Shop.currencyCode` **changes**, require a **full catalog restamp/rebuild** rather than leaving mixed incremental currency provenance.

`unitCost.currencyCode` (`MoneyV2`) is stored from the field itself and still carries observation/run lineage.

---

## 9. Location sync

Current defect: `fetchLocations` uses `locations(first: 50)` and returns the first page only (`app/services/shopify-gql.server.ts`).

PR 5 must:

- page with cursors until `hasNextPage` is false (or a validated complete bulk locations query);
- persist every location GID for the shop;
- nominate locations present in canonical facts but absent from a **complete** location sync as **absence candidates** using the §6.F.10 predicate (a location with `existenceRequestGen > fenceGeneration` must survive; a location **observed** in this epoch must keep its presence marker even if attributes no-op). Tombstone a location only after `location(id:)` confirmed absence, subject to the circuit breaker and the overlapping LIVE-observation rule. Deleted Location GIDs are terminal after confirmation;
- treat `locations/deactivate` as inactive (`isActive=false` via live refetch), not as deletion;
- treat `locations/delete` as a **signal**: authoritative `location(id:)` check; tombstone only on confirmed absence; delayed delete must not tombstone a location Shopify currently returns as live.

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

Official 2026-07 `products/delete` sample payload includes `id`, `published_scope`, and `admin_graphql_api_id`. **Use the supplied GID where present.** Keep numeric-id fallback mapping only where the GID is absent. Then run the §6.F.7 existence check. Do not upsert the webhook body as a live fact. Do not skip the live check merely because the topic is delete.

Current toml only registers `inventory_levels/update` among these. PR 5 implementation (when authorized) must add the topics above. That is **not** authorized by this planning PR.

### 10.2 Application rule

```text
HMAC webhook
  → PR4 durable intake (sanitizer + digest + WebhookDelivery)
  → DurableJob PENDING
  → dispatcher / envelope v3
  → worker: processingEnabled check
  → identity assertions
  → authoritative GraphQL refetch (existence + attributes) OR confirmed-absence tombstone
  → tenant transaction: canonical upsert/tombstone **with §6.F clocks A/B + presence marker** (never webhook receivedAt as Shopify updatedAt)
  → application receipt / lifecycle completion
  → compatibility projection (separate; cannot roll back canonical; failure is visible — §7)
```

Sanitizers persist **identity + signal metadata only** (topic, REST ids, GIDs, `updated_at` if present). Do not persist full product HTML or treat `available` from `inventory_levels/update` as the complete quantity vector.

New envelope sources are the **smallest allowlist extension** (`TENANT_JOB_SOURCES` / `JOB_SOURCE_BY_NAME`). Execution strategy: `ATOMIC_APPLICATION_RECEIPT` for resource webhooks (same as current inventory_levels/update). `bulk_operations/finish`: `CONTROL_ONLY` or a documented continuation of the existing `catalog-sync` run keyed by persisted BulkOperation GID — not a second competing applicator.

### 10.3 Resource rules

| Signal | Action |
|---|---|
| products create/update | Refetch product + variants + inventory item by GID; upsert attributes via clock A; set LIVE existence via clock B; do not merge by SKU |
| products delete | Signal only. Map identity (prefer `admin_graphql_api_id`). Authoritative `product(id:)` check (§6.F.7). If live and the row is not a terminal tombstone: do not tombstone; stale-signal merchant diagnostic + derived `DataIssue`; apply live attributes via clock A. If live after confirmed terminal tombstone: `TERMINAL_IDENTITY_REVIVAL_CONFLICT` — keep tombstone until two independent confirmations + createdAt match. If confirmed absent: tombstone product; then refetch-or-absence for variants still keyed to that product. Query failure is not deletion. |
| inventory_items create/update | Refetch item (+ linked variant if returned) |
| inventory_items delete | Signal only. Authoritative `inventoryItem(id:)` check. Tombstone item only on confirmed absence; do not remap SKU onto another item |
| inventory_levels connect | Signal. Authoritative item+location live check; upsert reconnectable relationship; refetch quantities via clock A |
| inventory_levels update | **Refetch all eight quantity names**; ignore webhook `available` as complete truth |
| inventory_levels disconnect | Signal only. Official 2026-07 sample payload is `{ inventory_item_id, location_id }` only — no GID. Map identity from shop + inventory-item GID/REST id + location GID/REST id onto `(shopId, inventoryItemGid, locationGid)`. Authoritative `inventoryItem.inventoryLevel(locationId:)` check. If still connected: do not disconnect; stale-signal merchant diagnostic + derived `DataIssue`; apply live quantities. If confirmed null: set `existenceState=ABSENT`, `deletionSource=DISCONNECT` on that **same** pair row. Query failure is not disconnect. Do not invent a new level GID. Do not create a second row because a later refetch supplies a different level GID. Relationship is reconnectable. |
| locations create/update/activate/deactivate | Refetch location |
| locations delete | Signal only. Authoritative `location(id:)` check; tombstone only on confirmed absence |

Variant deletion/recreation: a `products/update` or missing variant GID after refetch tombstones the old variant GID. A later variant with the same SKU is a **new** `ShopifyVariantFact` row.

### 10.4 Inventory states that webhooks do not fully cover

Official `inventory_levels/update` payload is an inventory-level **notification** whose documented sample fields are `inventory_item_id`, `location_id`, `available`, timestamps, and GID — **not** the GraphQL `quantities` array.

Official inventory-management apps guide (accessed 2026-08-14):

> Changes to `committed`, `reserved`, `damaged`, `safety_stock`, and `quality_control` inventory states don't trigger webhooks.

Therefore:

- Incremental `inventory_levels/update` **must refetch** `quantities(names: [all eight])`.
- Periodic/reconcile refetch is required so shops cannot remain permanently stale on states that do not emit webhooks, and for missed/duplicated webhooks (Phase 1 brief rule).
- Webhook `available` is never complete inventory truth.

**Reconcile job (in PR 5 scope, not PR 8 exit):** `inventory-state-reconcile`, `REBUILDABLE_IDEMPOTENT`, tenant envelope, existing dispatcher. Do **not** redesign fair dispatch.

**Freshness policy (not a locked polling cadence)**

| Layer | Rule |
|---|---|
| Need | Periodic reconcile exists because Shopify documents that several states do not trigger webhooks. |
| SLO vs scheduler | Define a **target freshness** separately from the timer. Exact cron/interval is **configurable** (`inventoryReconcileTargetFreshnessMs` or equivalent). |
| Pre-production hypothesis | 60-minute freshness for non-webhook quantity states is an **engineering test target**, not a production promise and not a final cadence. Do not advertise it to merchants. |
| Forbidden lock | Do **not** hard-code “not faster than every 5 minutes and not slower than every 60 minutes” as product law. |
| Shopify reads | **No per-item / per-level GraphQL polling** as the design. Prefer bulk inventory-level extraction or another complete mechanism; shard by shop/location only as bulk/page work, still O(bulk ops + shards), never O(variants × locations) Admin calls. |
| Coalesce | Debounce: skip a level recently refetched by `inventory_levels/update` within a configurable window. Coalesce duplicate reconcile jobs per shop. |
| Scale | Cost is a function of variants × locations × chosen freshness. Scheduler must respect Shopify 2026-07 bulk concurrency (max five bulk queries per shop) and PR 4 per-shop fair claim so reconcile cannot starve webhooks. |
| Evidence | Exact production cadence is **unauthorized** until pilot / PR 8 load evidence (R-034). PR 5 tests must prove the worker is bounded and non-N+1, not that a production interval is correct. |

This is **not** Phase 1 reconciliation/performance exit. PR 8 remains the final R-034 / cross-domain exit unit. Reconciliation amplification is **R-147**.

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

Explicitly forbidden examples include `inventoryAdjustQuantities`, `inventorySetQuantities`, `inventoryMoveQuantities`, `inventoryActivate`, `inventoryDeactivate`, `inventoryBulkToggleActivation`, `inventoryItemUpdate`, product/variant mutations, transfer mutations, and cost writes.

Do **not** solve this with another hand-maintained finite list. **R-110** is precedent.

PR 5 fact/read modules require **deny-by-default mutation detection**: any Shopify **mutation** operation in the canonical fact/read boundary is rejected unless an explicit later product-owner write authorization exists.

At minimum the scanner must reject mutation families:

- `inventory*`
- `inventoryItem*`
- `product*`
- `productVariant*`
- `transfer*`
- cost-write surfaces

while distinguishing GraphQL **QUERY** fields that happen to share those prefixes.

Use compiler / GraphQL-AST / semantic inspection consistent with the accepted R-110 approach, **not** raw substring matching.

Negative fixture: plant `inventoryBulkToggleActivation` into a PR 5 fact adapter and CI **must fail**.

Required boundary:

- New `admin-read` helper module used by catalog/location/inventory fact sync.
- Catalog fact modules must not import write helpers in `shopify-sync.server.ts`.
- No inventory mutation feature flag may be enabled. All inventory-write flags remain DEFAULT OFF.
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

**Do not weaken RLS to simplify bulk ingest.** Batched writes still run inside transaction-local tenant context. Control-plane `SyncRun` / `DataIssue` / `SyncHealth` rows remain `platform_control_plane` as in PR 4 (`expectedRuntimePrivileges: []`); fact tables **and** `CatalogObservationInFlight` are `merchant_domain`. Runtime remains denied DML on `SyncRun`. Control-plane does **not** write merchant facts or in-flight observation rows. Do **not** add a FK from in-flight evidence to control-plane tables. Do **not** invent a cross-role atomic transaction.

**`stocky_catalog_observation_gen_seq` classification:** platform synchronization infrastructure — **not** merchant data, **not** a `Shop` column, **not** a tenant table, **not** bootstrap, **not** merchant-domain RLS, **not** a key or merchant identity. Globally monotonic; comparisons stay within a shop/identity; gaps are harmless; values are never reused. Sequence is explicitly **NO CYCLE**. **USAGE only** on **this named sequence only** for `stocky_runtime` and `stocky_control_plane`. **No SELECT. No UPDATE. No ownership. No PUBLIC privilege. No schema-wide `GRANT … ON SEQUENCES`.** Application roles must be unable to call `setval()` successfully. Official PostgreSQL 18: `nextval` requires USAGE or UPDATE; `setval` requires UPDATE; SELECT is not required for `nextval` (https://www.postgresql.org/docs/18/functions-sequence.html, accessed 2026-08-14). Sequence owner remains the migration/schema role. Named-allowlist verifier; keep F-PR3C-05 against PUBLIC, blanket `ON SEQUENCES`, SELECT, UPDATE, `setval`, and runtime/control-plane ownership. **Do not** grant table privileges to bypass PR 1–4 / R-102 / R-137.

Required tenancy / privilege tests: cross-shop fact denial unchanged, including `CatalogObservationInFlight`; bootstrap Shop row receives zero generation writes; architecture audit still fails on bootstrap merchant access; sequence uniqueness, crash-gap, **NO CYCLE**, USAGE-only `nextval` for both application roles, `setval` denial for both application roles, PUBLIC `nextval` denial, no SELECT, no UPDATE, no application-role ownership, no schema-wide sequence grant; runtime cannot DML `SyncRun`; control-plane cannot DML merchant facts or in-flight observation rows.

New tables should be Prisma-non-null `shopId` (no legacy `shop` column required). They still need `(shopId, id)` uniqueness and enforcement inventory entries. InventoryLevel unique identity is `(shopId, inventoryItemGid, locationGid)`.

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
| Optional `SyncRun` field for BulkOperation GID + `fenceAt` + `fenceGeneration` + JSONL line checkpoint | Avoid `currentBulkOperation`; support §6.F fence (allocated on the control-plane connection via the platform sequence, committed before Shopify I/O) and Range-free two-phase resume. Runtime still has no `SyncRun` DML. |
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
- Persist currency with the amount (`Money` → shop `currencyCode`; `MoneyV2` → field currency) **and** the `SyncRun` / observation lineage that produced the stamp.
- A detected `Shop.currencyCode` change requires a full catalog restamp/rebuild, not mixed incremental provenance.
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
- InventoryLevel unique `(shopId, inventoryItemGid, locationGid)` enforced; a second level GID for the same pair cannot insert a second row.
- `stocky_catalog_observation_gen_seq` **USAGE only** on the named sequence for `stocky_runtime` and `stocky_control_plane`; **no SELECT**; **no UPDATE**; PUBLIC none; neither application role owns the sequence; no schema-wide `ON SEQUENCES`; sequence is **NO CYCLE**; runtime and control-plane `nextval` succeed; runtime and control-plane `setval` fail; PUBLIC `nextval` fails (Races AE–AG / AD).
- Bootstrap Shop row receives zero generation writes.
- Runtime role denied DML on `SyncRun` / `DataIssue` / `SyncHealth` (PR 4 regression + PR 5 ingest path).
- Control-plane role denied DML on canonical fact tables and `CatalogObservationInFlight`.
- `CatalogObservationInFlight` is merchant-domain: cross-shop denial; multiple simultaneous ACTIVE rows for one identity permitted; `observationRequestGen` is not merchant identity.
- Observation-lease `leaseExpiresAt` is computed in PostgreSQL from `clock_timestamp()` plus the validated duration; application-node clocks cannot decide validity (Race AO).

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

### D. Idempotency / recovery / freshness

- Replay of the same full sync converges (no duplicate GIDs; tombstones stable) **under §6.F** (not last-writer-wins; presence marker independent of attribute no-op).
- Interrupted batch resumes/retries safely from the **line checkpoint**; re-stream from byte 0 without HTTP Range.
- Duplicate / out-of-order incremental signals converge to the **newer Shopify attribute version** (clock A) and the last **unambiguous** non-overlapping app-issued existence observation (clock B). Overlapping conflicting existence must not resolve by `observationResponseGen` or lock-acquisition order.
- Failed bulk + `partialDataUrl` does **not** advance a success watermark and **does not** nominate candidates or run tombstones.
- Expired result URL starts a new bulk op (new fence generation; never reused) and does not fake success.

### D1. Concurrency / fence / existence (mandatory)

1. Old full-sync row cannot overwrite a newer webhook refetch (clock A identity-row `updatedAt`).
2. Race A: delayed bulk vs newer incremental attributes — bulk attributes no-op; presence marker still advances.
3. Race B: post-fence create with `existenceRequestGen > fenceGeneration` is not nominated and is not tombstoned (existence interval evidence, not Shopify `updatedAt` vs `fenceAt`).
4. Race C: confirmed absence vs late older bulk (`fenceGeneration` older than absence interval end) — no resurrection.
5. Per-state inventory: stale `available` (or any named state) cannot overwrite a newer per-name `updatedAt`.
6. Equal `updatedAt` with differing attributes → no-op + merchant diagnostic + derived `DataIssue` + refetch.
7. Failed/partial bulk never nominates candidates or performs tombstones (Race O / D).
8. Delayed delete/disconnect webhook after a current live refetch: signal alone must not tombstone (Race H).
9. Reconnectable pair: a **non-overlapping** authoritative live check after a prior disconnect tombstone may recover even when Shopify `updatedAt` is not comparable to local tombstone time (Race J). Overlapping LIVE/ABSENT must not recover from end-generation order (Race AJ).
10. Full sync **observes** a GID whose stale attributes no-op: epoch marker still advances; it is not an absence candidate (Race K).
11. Nullable Shopify `updatedAt`: current authoritative refetch can eventually update the fact (Race L). No infinite no-op.
12. Two concurrent missing-version observations: overlapping conflicting payloads must not last-writer-wins or resolve by `attributeResponseGen` (Race M / AK). Identical overlapping payloads may converge idempotently.
13. Failed authoritative delete/disconnect refetch: query failure is not converted into canonical deletion (Race N).
14. Races P–AW in §6.F.13 (sequence uniqueness/crash gap, zero Shop writes, no lock across Shopify I/O, observation interval before/after Shopify I/O, bulk omission + live confirmation, circuit breaker, pair uniqueness, two-phase checkpoint, diagnostic reconciler, READ COMMITTED sweep, terminal non-revival including non-overlapping two-confirmation revival, write-scanner fixture, USAGE-only nextval, setval denial, NO CYCLE, response scheduling inversion, non-overlapping supersede, overlapping LIVE/ABSENT conflict, overlapping null-version quantity conflict, bulk candidate + overlapping LIVE, hard-crash orphaned in-flight observation with PostgreSQL-authoritative lease boundary, late response after abandonment, application-node clock skew, physically missing in-flight row, multiple blockers / partial expiry, response-before-expiry / apply-after-expiry, database clock rollback after expiry takeover, concurrent first canonical application of a nonexistent identity, no response-bearing ACTIVE row / in-process responseGen pause, deterministic canonical lock ordering, advisory-lock capacity / concurrent bulk apply).

### D2. Checkpoint crash boundaries (mandatory)

- Kill **before** batch commit: resume re-applies the batch; no silent skip.
- Kill **after** merchant batch commit / **before** control-plane checkpoint acknowledgement: rows are not lost and are not skipped; checkpoint **lags** and then catches up; checkpoint never leads.
- Runtime cannot obtain atomicity by DML on `SyncRun` (Race Y).
- Re-stream from start without HTTP Range is safe (idempotent + clock-A / presence-marker).
- Expired URL starts a new BulkOperation (new fence generation) and never marks the old run succeeded.

### D3. Projection failure (mandatory)

1. Canonical apply succeeds + projection fails → canonical facts preserved (no rollback).
2. Failure is surfaced on merchant `compatibilityProjectionState = DEGRADED`; reconciler projects `DataIssue` + compatibility health `DEGRADED`.
3. Retry/rebuild repairs projection **without** duplicate canonical application.
4. Compatibility health returns to healthy only after the projection matches canonical facts **and** merchant durable state is healthy.
5. Uninstall/disabled-shop: projection retry fail-closed.
6. Crash after DEGRADED merchant commit and before `DataIssue` write: reconciler recreates the issue (Race Z).

### D4. Reconciliation work is bounded

- Reconcile uses bulk or complete pagination, **not** one GraphQL call per variant-location.
- Write/read counts have an explicit ceiling; N+1 Shopify reads fail the test.

### E. Identity / deletion

- Product delete: delayed delete signal must not tombstone a currently live GID; confirmed absence tombstones the product GID.
- Variant deletion/recreation: two GIDs, same SKU/barcode/title, both retained; history not merged.
- Inventory-item delete: confirmed-absence tombstone; query failure is not deletion.
- Location delete vs deactivate distinguished; delete is a signal + existence check.
- Inventory-level connect / update / disconnect: disconnect is reconnectable; delayed disconnect must not drop a currently connected level.
- Bulk ingest → disconnect payload with item/location only → reconnect/refetch = exactly one canonical pair row (Race X).
- One transient LIVE response after confirmed **terminal** deletion does not revive (Race AB). Two overlapping LIVE responses do not satisfy the two-confirmation revival threshold (Race AB extension).
- Hard-crash orphaned in-flight observation: PostgreSQL-authoritative finite lease makes A **lease-invalid** at `clock_timestamp() >= leaseExpiresAt`; a successor that proceeds **MUST** durably fence A `ACTIVE -> ABANDONED` in the same tenant / identity transaction; no permanent freeze; no stale apply (Race AM).
- Late Shopify response after durable abandonment fails the observation-token / active-lease / not-`ABANDONED` fence (Race AN).
- Application-node clock skew cannot decide lease validity; PostgreSQL `clock_timestamp()` is authoritative for both workers (Race AO). Exact equality `clock_timestamp() == leaseExpiresAt` is expired.
- Physically missing in-flight row fails the exact-token fence closed; stale worker cannot recreate the row to apply (Race AP).
- Multiple ACTIVE unexpired resultless blockers: expiry of one, even when durably `ABANDONED` by the successor transaction, does not release a held later response while another remains ACTIVE / unexpired; held C is never replayed as fresh (Race AQ).
- Response obtained before expiry and applied after expiry fails the post-lock fact fence; burned `responseGen` is the only residue (Race AR).
- Database clock rollback after expiry takeover: after B durably fences A `ACTIVE -> ABANDONED` and commits newer canonical evidence, later wall-clock rollback cannot restore A; A remains `ABANDONED` and cannot write LIVE/ABSENT, update null-version attributes, tombstone/revive, or clear B; rollback of B undoes both mutation and abandonment (Race AS).
- Concurrent first canonical application of a nonexistent identity: both writers use the same advisory identity anchor; the second re-reads after lock; exactly zero or one canonical row; no response-end / commit-order LWW; no `ON CONFLICT DO UPDATE` blind overwrite; null-version overlap follows §6.F.9; bulk vs direct re-evaluates fence rules after lock; an ACTIVE unexpired resultless blocker still blocks first insert (Race AT).
- ResponseGen allocated then paused before the fenced transaction: persisted row remains ACTIVE + `observationResponseGen` NULL; successor may durably abandon after expiry; resume cannot persist the old responseGen, restore ACTIVE, or mutate canonical state; constraint rejects ACTIVE + non-null responseGen (Race AU).
- Two bounded multi-identity transactions with opposite input order acquire advisory locks in the same ascending `(key1, key2)` order; no AB/BA deadlock; hash collision over-serializes only; observation-row locks follow the canonical anchor in requestGen/token order (Race AV).
- Advisory-lock capacity / concurrent bulk apply: unsafe envelope rejected or reduced; safe envelope proceeds; lock-resource failure aborts the whole transaction; no half-applied canonical or abandonment state; no leaked transaction advisory locks; bounded retry uses a smaller sub-batch; no unanchored fallback; one identity never split; repeated failure is explicit degraded / failure; no infinite retry; no inventory mutation (Race AW). Known-answer lock-key vectors 1–3 must match the single derivation function.

### F. Inventory-state truth

- `available` and `on_hand` remain distinct in persistence and tests.
- `incoming` and `committed` remain distinct.
- `reserved`, `damaged`, `safety_stock`, `quality_control` persisted.
- Missed-webhook-state scenario: change only a non-`available` quantity with **no** `inventory_levels/update` (official: `committed` / `reserved` / `damaged` / `safety_stock` / `quality_control` do not trigger webhooks); reconcile/refetch corrects canonical facts.
- Per-name `updatedAt` fence: stale reconcile cannot move a quantity backward. Nullable per-name `updatedAt` uses `quantityRequestGen` / `quantityResponseGen` fallback (§6.F.9); no infinite no-op; overlapping conflicting quantities must not last-writer-wins.

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
- Write-mutation scanner: deny-by-default GraphQL-AST/semantic inspection (R-110). Plant `inventoryBulkToggleActivation` in a PR 5 fact adapter → CI fails (Race AC). Distinguishes QUERY fields that share prefixes.
- unitCost capability preflight: denied/unavailable uses the no-unitCost bulk variant; does not burn a with-unitCost bulk cycle; catalog sync still completes (partial-failure / permission).

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
| Inventory webhooks: `committed` / `reserved` / `damaged` / `safety_stock` / `quality_control` do not trigger | https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps (accessed 2026-08-14) |
| InventoryQuantity.updatedAt (nullable) | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryQuantity |
| MoneyV2 / Decimal | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MoneyV2 ; https://shopify.dev/docs/api/admin-graphql/2026-07/scalars/Decimal |
| BulkOperation / partialDataUrl / 7-day expiry | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/BulkOperation |
| `bulkOperation(id:)` | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/bulkOperation |
| `currentBulkOperation` deprecated | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/currentBulkOperation — official replacement is `bulkOperations(status…)`. Stocky **deliberately** binds persisted GID + `bulkOperation(id:)` instead. `bulkOperations` is officially valid. |
| Bulk query restrictions / JSONL / `__parentId` / poll-by-id | https://shopify.dev/docs/api/usage/bulk-operations/queries |
| Bulk completeness / snapshot isolation | **Not documented** by Shopify (independent review 2026-08-14). COMPLETED bulk may establish presence and nominate absence candidates; it is not single-epoch ABSENT authority. |
| Webhook topics allowlist | https://shopify.dev/docs/api/admin-rest/2026-07/resources/webhook |
| Product webhook 100-variant caveat | same REST webhook resource, `products/create` and `products/update` |
| Webhook ordering / non-guaranteed delivery | https://shopify.dev/docs/apps/build/webhooks (accessed 2026-08-14) |
| Product deletion irreversible | https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productDelete |
| InventoryItem.inventoryLevel(locationId) nullable | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem |
| inventoryLevel(id:) | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/inventoryLevel |
| PostgreSQL 18 `nextval` / `setval` privileges | https://www.postgresql.org/docs/18/functions-sequence.html (accessed 2026-08-14; PostgreSQL 18.6 docs dated August 13, 2026). `nextval` requires USAGE or UPDATE; `setval` requires UPDATE; SELECT is not required for `nextval`. |
| PostgreSQL 18 `CREATE SEQUENCE` `NO CYCLE` | https://www.postgresql.org/docs/18/sql-createsequence.html (accessed 2026-08-14). `NO CYCLE` is the default; wrapping is forbidden when specified/defaulted. |
| PostgreSQL 18 current date/time (`clock_timestamp` / `statement_timestamp` / `transaction_timestamp` / `CURRENT_TIMESTAMP` / `now()`) | https://www.postgresql.org/docs/18/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT (accessed 2026-08-15; PostgreSQL 18.6 docs dated August 13, 2026). `CURRENT_TIMESTAMP` / `now()` / `transaction_timestamp()` are transaction-start values. `statement_timestamp()` is statement-start time. `clock_timestamp()` returns actual server time when evaluated and changes during statement execution. |
| PostgreSQL 18 explicit locking (`SELECT … FOR UPDATE` / advisory locks) | https://www.postgresql.org/docs/18/explicit-locking.html (accessed 2026-08-16; PostgreSQL 18.6 docs dated August 13, 2026). `FOR UPDATE` locks retrieved rows (Section 13.3.2). Advisory locks are session-level or transaction-level (Section 13.3.5): session-level locks do not honor transaction rollback; transaction-level locks release at transaction end. Consistent multi-object lock order is the documented deadlock defense (Section 13.3.4). |
| PostgreSQL 18 advisory-lock functions | https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS (Section 9.28.10, accessed 2026-08-16). `pg_advisory_xact_lock(key1 integer, key2 integer)` is exclusive transaction-level. `pg_advisory_lock` is exclusive session-level and is **not** this contract. Keys may be one 64-bit value or two 32-bit values (those key spaces do not overlap). |
| PostgreSQL 18 lock management (`max_locks_per_transaction`) | https://www.postgresql.org/docs/18/runtime-config-locks.html (Section 19.12, accessed 2026-08-16; PostgreSQL 18.6 docs dated August 13, 2026). Shared lock table has space for `max_locks_per_transaction` objects per server process or prepared transaction. The parameter limits the **average** number of object locks; individual transactions may exceed it if shared capacity remains. Default 64. Server-start only. **Not** a hard per-transaction cap of 64. |
| PostgreSQL 18 `max_connections` | https://www.postgresql.org/docs/18/runtime-config-connection.html (Section 19.3, accessed 2026-08-16). Maximum concurrent connections; typical default 100; server-start only. |
| PostgreSQL 18 `max_prepared_transactions` | https://www.postgresql.org/docs/18/runtime-config-resource.html (Section 19.4, accessed 2026-08-16). Maximum simultaneous prepared transactions; default 0; server-start only. |

API target remains **2026-07**. This planning task does not bump versions.

---

## 20. Implementation authorization (D-054 EFFECTIVE)

**D-054 — Phase 1 PR 5 implementation authorization under Accelerated Safe Delivery v1.**

D-054 is **EFFECTIVE**. PR #26 is **CLOSED / MERGED**. Accepted review-record head `7171c2cbbdff15ae0d92aa6850a1ae12804db3f4`. Squash merge `ae1b428039152efc6b4a46107e1bcca5eb17586a`. Post-merge main CI run `31966584542` **SUCCESS**. Condition 9 is satisfied.

The nine activation conditions remain the historical gate. Current authorized work is **PR5-F1 foundation only**.

D-054 does **not** authorize production, merchant production data, enabling inventory-write flags, Shopify inventory mutations, Phase 2 runtime, or PR 6 runtime before its own authority. Do **not** create D-055. Do **not** state PR 5 is complete.

**PR 5 IMPLEMENTATION STARTED — PR5-F1 FOUNDATION IN PROGRESS.**
