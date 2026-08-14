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
| `existenceResponseGen` | B (app-issued monotonic, interval end) | Allocated with `SELECT nextval('stocky_catalog_observation_gen_seq')` **after** that direct request completed with an authoritative usable response and **before** entering the tenant fact transaction / identity lock. Do **not** use `existenceResponseGen` alone to order concurrent overlapping observations. |
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

### 6.F Clock domains, existence, and apply-path contract

This section is the **planning-correction 3** addendum (same D-053).
It does not authorize implementation. It does not introduce D-054. It does
not change D-052. It replaces the Correction-2 Shop-counter / single-epoch
absence-sweep architecture with the rules below.

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
| **B. Authoritative existence observation** | `existenceState`, `existenceKind`, `existenceObservedAt`, `existenceRequestGen`, `existenceResponseGen` | The last **unambiguous** app-issued `[observationRequestGen, observationResponseGen]` interval for an authoritative Shopify existence check. `observationRequestGen` is allocated **before** the Shopify network request. `observationResponseGen` is allocated **after** an authoritative usable response and **before** the identity-row apply lock. Generations order **app request lifecycle only**, not Shopify mutation order or snapshot time. Overlapping intervals with conflicting LIVE/ABSENT results must not resolve from `observationResponseGen` alone | LIVE vs TOMBSTONED / disconnected existence. Comparable only to other **app-issued** existence observation **intervals** and to `SyncRun.fenceGeneration`. A direct observation started after a fence iff `observationRequestGen > fenceGeneration` |
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

**No PostgreSQL / merchant row lock may be held across Shopify HTTP /
network I/O.** Concurrent observation ordering uses observation **intervals**,
not a lock held across the Shopify request.

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
   Persist merchant-durable **in-flight observation** evidence for this
   identity (the start generation) in a **short** tenant transaction, then
   **release all row locks**. This is not a network lock.
2. Perform the Shopify request. Hold **NO** merchant/control-plane row lock
   across network I/O.
3. If the request completes with an authoritative usable response:
   allocate
   `responseEndGen = SELECT nextval('stocky_catalog_observation_gen_seq')`.
   Capture `existenceObservedAt` as the app UTC instant the usable response
   was in hand (observability; **not** the concurrent-apply key).
4. **Then** enter the tenant fact transaction and take the identity
   `SELECT … FOR UPDATE`.
5. Apply using the interval rules in §6.F.3. Clear in-flight evidence as
   part of apply or abandon.

A failed, timed-out, or throttled request:

- may burn `requestStartGen`;
- creates **no** authoritative fact observation;
- **cannot** cause deletion;
- must clear in-flight evidence;
- burned generation is harmless.

Do **not** allocate the end generation only after waiting for the identity
lock. Do **not** treat `responseEndGen` alone as observation order.

##### Full-sync fence (control-plane)

1. A control-plane transaction allocates **one** sequence generation.
2. Persist it as `SyncRun.fenceGeneration` plus `fenceAt`.
3. **COMMIT** that control-plane transaction.
4. **Only then** call `bulkOperationRunQuery` / start location pagination.

Do **not** introduce a network lock. No row lock is held across Shopify I/O.

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
  response and **before** waiting on the identity-row apply.
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

An observation that has allocated `observationRequestGen` but has not yet
committed `observationResponseGen` (in-flight, including a burned/failed
request until its in-flight evidence is cleared) is treated as unresolved
and overlapping any other interval that intersects
`[observationRequestGen, +∞)` until it completes or is abandoned.

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
`(shopId, inventoryItemGid, locationGid)` for levels — with
`SELECT … FOR UPDATE` inside the tenant transaction. This is row-level
fact locking, **not** a dispatcher/readiness redesign. The lock is taken
**after** Shopify I/O and **after** end-generation allocation. It is
**not** held across Shopify network I/O.

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

1. If `S` does not exist: insert attributes from `I`; set
   `shopifyUpdatedAt = I.shopifyUpdatedAt` when Shopify provided it.
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
`(shopId, identity)` **merchant** transaction:

1. `SELECT … FOR UPDATE` (after Shopify I/O and after any direct-refetch
   generation allocation; bulk lines use the already-committed fence).
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
2. Require **two independent** authoritative LIVE confirmations.
3. Where Shopify `createdAt` is available, require it to **match** the
   tombstoned identity’s recorded `shopifyCreatedAt`.
4. Only then may **controlled recovery** restore LIVE, with recovery /
   audit evidence recorded.
5. Attributes of a restored row still follow clock A.

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
authoritative usable response and **before** the identity-row apply.
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
generation after a usable response. They later serialize on
`(shopId, identity)` `SELECT … FOR UPDATE`. Overlapping conflicting
payloads must **not** resolve by end-generation or lock-acquisition
order.

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
**not** overlap an unresolved LIVE existence observation (terminal GIDs
then follow §6.F.7). Query failure / timeout is **not** absence.

The new direct-query interval rule applies to those **absence-confirmation
queries** too. A bulk absence candidate **must not** tombstone while an
overlapping direct LIVE existence observation is unresolved.

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
rule: do not tombstone a candidate while an overlapping direct LIVE
existence observation is unresolved.

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
now**) **must** include races **A–AD** (preserved) **and** **AE–AL**
(correction 4):

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
| **S. No lock across Shopify I/O** | Direct refetch instrumentation. | No merchant or control-plane row lock is held across the Shopify HTTP request. Start generation is allocated **before** the request; end generation **after** a usable response; identity lock is taken **after** that. In-flight start evidence is committed then locks released before I/O. |
| **T. Non-overlapping existence vs commit order** | Observation A fully completes (`requestStartGen` and `responseEndGen` allocated) before B starts. B then commits first. A later obtains the lock. | A must **not** overwrite B. B may supersede A on clock B because B is the later non-overlapping app-issued check. Repeat for LIVE and ABSENT existence. Do **not** use this race to claim end-generation order across overlapping workers. |
| **U. Bulk omission is not absence** | Successful JSONL omits GID X; direct query still returns X live. | No tombstone. Candidate may exist; confirmation keeps LIVE. |
| **V. Circuit breaker** | Candidate count or proportion exceeds the configured threshold. | **Zero** tombstones. LIVE preserved. Domain DEGRADED. Anomaly `DataIssue`. No HEALTHY deletion reconciliation. |
| **W. Small candidate set + null confirmation** | Candidate set under threshold. Direct completed query returns null. | Tombstone allowed (`ABSENT_CONFIRMED_QUERY`). |
| **X. Inventory-level pair uniqueness** | Bulk ingest creates a level (with Shopify level GID). Disconnect payload supplies item+location only. Reconnect/refetch. | Exactly **one** canonical row keyed by `(shopId, inventoryItemGid, locationGid)`. No second row from a different level GID. |
| **Y. Runtime denied SyncRun DML** | Restricted runtime role attempts INSERT/UPDATE/DELETE on `SyncRun`. | Denied. Regression of the PR 4 control-plane privilege suite. |
| **Z. Diagnostic lag** | Fact commits `DEGRADED` / `TERMINAL_IDENTITY_REVIVAL_CONFLICT` / candidate circuit-breaker. Process dies before `DataIssue` write. | Reconciler recreates the `DataIssue`. Canonical truth unchanged. No false HEALTHY after reconciliation. |
| **AA. READ COMMITTED candidate sweep** | Newer LIVE authoritative observation commits while the candidate sweep is attempting the same row. | Row remains LIVE / candidate predicate re-evaluates correctly. Sweep is not REPEATABLE READ / SERIALIZABLE. |
| **AB. Terminal single-response non-revival** | Confirmed terminal deletion (`ABSENT_CONFIRMED_QUERY`). One transient later LIVE response. | Tombstone **retained**. `TERMINAL_IDENTITY_REVIVAL_CONFLICT`. No silent LIVE restore. |
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

Tests **must** fail closed: a focused command that collects zero tests is
a failed check (PR 4 CI pattern).

#### 6.F.14 Planning non-goals (reiterated)

This section does **not**:

- authorize PR 5 implementation;
- create D-054;
- change D-052 / PR 4 control-plane semantics;
- add Shopify write mutations;
- couple forecast/ABC into the applicator;
- close Q-002, Q-004, R-028, R-029, or R-095..R-098;
- close R-102 or R-137.

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
- Batch upserts (planning ceiling: see tests; start at ≤500 rows / transaction, configurable).
- Idempotent upsert on `(shopId, shopifyGid)` for GID identities, or `(shopId, inventoryItemGid, locationGid)` for levels, **plus** §6.F clock-A attribute freshness, clock-B existence, and epoch **presence marker** (not last-writer-wins). Presence (`lastSeenFullSyncRunId`) advances even when attributes no-op.
- **Line/batch checkpoint is two-phase application progress** (§6.F.11). Merchant facts commit with `ingestBatchId`. Control-plane `jsonlCommittedLineOrdinal` (1-based last fully acknowledged JSONL line) advances **afterwards**, on the control-plane connection. Runtime is denied DML on `SyncRun`. No transaction spans the two roles.
- Checkpoint **must never** advance past a batch whose fact transaction did not commit. Checkpoint **may lag** facts. On resume, an orphan committed batch (facts present, checkpoint behind) is identified/replayed **idempotently** and then acknowledged **without skipping uncommitted lines**.
- Restart without Range: if the same BulkOperation is still `COMPLETED` and `url` unexpired, re-stream from byte 0; already-committed ingest batches are idempotent §6.F upserts (attribute no-op + presence marker remains set) then acknowledged; lines after the checkpoint are applied. Repeated records converge by identity key + clock-A / clock-B / presence-marker rules.
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

**Do not weaken RLS to simplify bulk ingest.** Batched writes still run inside transaction-local tenant context. Control-plane `SyncRun` / `DataIssue` / `SyncHealth` rows remain `platform_control_plane` as in PR 4 (`expectedRuntimePrivileges: []`); fact tables are `merchant_domain`. Runtime remains denied DML on `SyncRun`. Control-plane does not write merchant facts.

**`stocky_catalog_observation_gen_seq` classification:** platform synchronization infrastructure — **not** merchant data, **not** a `Shop` column, **not** a tenant table, **not** bootstrap, **not** merchant-domain RLS, **not** a key or merchant identity. Globally monotonic; comparisons stay within a shop/identity; gaps are harmless; values are never reused. Sequence is explicitly **NO CYCLE**. **USAGE only** on **this named sequence only** for `stocky_runtime` and `stocky_control_plane`. **No SELECT. No UPDATE. No ownership. No PUBLIC privilege. No schema-wide `GRANT … ON SEQUENCES`.** Application roles must be unable to call `setval()` successfully. Official PostgreSQL 18: `nextval` requires USAGE or UPDATE; `setval` requires UPDATE; SELECT is not required for `nextval` (https://www.postgresql.org/docs/18/functions-sequence.html, accessed 2026-08-14). Sequence owner remains the migration/schema role. Named-allowlist verifier; keep F-PR3C-05 against PUBLIC, blanket `ON SEQUENCES`, SELECT, UPDATE, `setval`, and runtime/control-plane ownership. **Do not** grant table privileges to bypass PR 1–4 / R-102 / R-137.

Required tenancy / privilege tests: cross-shop fact denial unchanged; bootstrap Shop row receives zero generation writes; architecture audit still fails on bootstrap merchant access; sequence uniqueness, crash-gap, **NO CYCLE**, USAGE-only `nextval` for both application roles, `setval` denial for both application roles, PUBLIC `nextval` denial, no SELECT, no UPDATE, no application-role ownership, no schema-wide sequence grant; runtime cannot DML `SyncRun`.

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
14. Races P–AL in §6.F.13 (sequence uniqueness/crash gap, zero Shop writes, no lock across Shopify I/O, observation interval before/after Shopify I/O, bulk omission + live confirmation, circuit breaker, pair uniqueness, two-phase checkpoint, diagnostic reconciler, READ COMMITTED sweep, terminal non-revival, write-scanner fixture, USAGE-only nextval, setval denial, NO CYCLE, response scheduling inversion, non-overlapping supersede, overlapping LIVE/ABSENT conflict, overlapping null-version quantity conflict, bulk candidate + overlapping LIVE).

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
- One transient LIVE response after confirmed **terminal** deletion does not revive (Race AB).

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

API target remains **2026-07**. This planning task does not bump versions.

---

## 20. Implementation authorization (explicitly withheld)

When ChatGPT later authorizes implementation, the approved unit is a **new** branch from then-current `main`, proposed name `phase-1/catalog-location-inventory-facts`, covering only this brief.

Until then:

- do not create the implementation branch;
- do not modify `app/`, Prisma schema/migrations, scripts, tests, package manifests, CI, Shopify config, GraphQL documents, or feature flags as part of D-053;
- do not merge this planning PR without explicit user authorization after ChatGPT acceptance.

**PR 5 PLANNING IN PROGRESS — IMPLEMENTATION NOT AUTHORIZED.**
