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
- Bounded-memory full-sync epoch **presence** markers that advance even when attributes no-op, and absence tombstones that use existence evidence rather than Shopify `updatedAt` vs fence.
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
2. **Shopify GIDs are identity.** Persist `gid://shopify/Product/…`, `ProductVariant`, `InventoryItem`, `Location`, and `InventoryLevel` GIDs exactly.
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
- tenant-leading unique identity `@@unique([shopId, shopifyGid])` (or the resource-specific GID column);
- child composite FKs including `shopId`;
- forced RLS + shopId immutability + restricted runtime role (PR 3 contract);
- `createdAt` / `updatedAt` app timestamps distinct from Shopify source timestamps.

Shared lineage columns (every canonical fact). **Do not collapse these into one `sourceVersionAt`.** Shopify timestamps, app existence observations, and webhook arrival times are **different clocks** and must never be compared to each other as one sequence.

| Field | Clock domain | Purpose |
|---|---|---|
| `shopifyCreatedAt` / `shopifyUpdatedAt` | **A — Shopify attribute version** | Shopify resource timestamps where exposed. Order **attributes only** against other Shopify `updatedAt` values. Never compare to webhook `receivedAt` or `fenceAt`. |
| `existenceState` | **B — authoritative existence** | `LIVE` \| `ABSENT`. Canonical existence, not a Shopify timestamp. |
| `existenceKind` | B | How existence was last confirmed: `LIVE_REFETCH` \| `LIVE_FULL_SYNC_PRESENT` \| `ABSENT_CONFIRMED_QUERY` \| `ABSENT_FULL_SYNC_SWEEP` |
| `existenceObservedAt` | B (app clock) | When **this app finished** an authoritative Shopify existence check (response in hand). Same clock domain as `SyncRun.fenceAt` (app time) but **not** the apply-decision key. **Not** webhook arrival time. **Not** Shopify `updatedAt`. |
| `existenceObservationGen` | B (app-issued monotonic) | From shop-scoped `Shop.catalogObservationGen` (planning name). Allocated **after** the Shopify existence result is known, **before** the fact write. Orders **app-issued** existence observations, not Shopify mutations. Full-sync live/absent snapshot uses **`SyncRun.fenceGeneration`** (one value allocated at fence), not a new gen per JSONL line. |
| `signalReceivedAt` | **C — signal observation** | Webhook/control arrival time at this app. Lineage / causation / diagnostics only. **Not** proof the signalled state is still current. **Not** a Shopify mutation timestamp. |
| `lastSignalTopic` / `lastSignalDeliveryId` | C | Optional signal lineage. Official `X-Shopify-Webhook-Id` may be stored as delivery id. |
| `lastSignalTriggeredAt` | C | Optional copy of official `X-Shopify-Triggered-At` (Shopify webhook publication time). Still clock C — **not** resource `updatedAt`, **not** existence confirmation, **not** comparable to clock A as one sequence. |
| `lastSeenFullSyncRunId` | Epoch presence | Full-sync `SyncRun.id` that **observed this GID as present** in that epoch’s extraction. Advances **even when attributes no-op**. Distinct from `lastSyncRunId`. |
| `attributeObservationGen` | Fallback only | Same shop-scoped monotonic counter family as existence gens. Used **only when Shopify `updatedAt` is null**. Full-sync null-version rows use `fenceGeneration`. Never unrestricted last-writer-wins. |
| `attributeFreshnessState` | Fallback honesty | `ORDERED` when a non-null Shopify `updatedAt` is stored for the applied attributes; `DEGRADED` when the applied attributes rest on the null-version fallback. |
| `lastSeenAt` / `lastRefreshedAt` / `appliedAt` | Observability | Application time. **Not** an ordering key. |
| `lastSyncRunId` / `lastDurableJobId` | Lineage | Last applying SyncRun / job. |
| `sourceKind` | Lineage | `FULL_SYNC` \| `INCREMENTAL_REFETCH` \| `DELETE_WEBHOOK` \| `DISCONNECT_WEBHOOK` \| `RECONCILE` |
| `deletedAt` | Observability | When the row was tombstoned in this database. **Not** Shopify ordering. Null if `existenceState=LIVE`. |
| `deletionSource` | Lineage | `WEBHOOK` \| `FULL_SYNC_ABSENCE` \| `DISCONNECT` \| null |
| `shopifyLegacyResourceId` | Identity join | REST numeric id when needed to join webhook payloads |

Inventory quantity states additionally persist **per-name** `quantity` + nullable `InventoryQuantity.updatedAt` + per-name `quantityAttributeGen` fallback. An older `available` must not overwrite a newer `available`; other names are independent.

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

**Connect / disconnect:** inventory-level connectivity is a **reconnectable** relationship (not assumed terminal). Follow §6.F: a disconnect **signal** must run an authoritative existence/connectivity check; a delayed disconnect must not tombstone a level Shopify currently returns as connected; a confirmed disconnect stores `existenceState=ABSENT` with an app existence observation, not webhook `receivedAt`. A later connect + live refetch may restore the **same** item+location identity. A late full-sync row whose `fenceGeneration` is older than a confirmed disconnect must not resurrect it.
**Do not** invent an app-initiated inventory event ledger.

Unknown future quantity names: ignore for first-class columns; record a `DataIssue` if Shopify returns an unexpected name. Do not silently drop the eight named states.

### 6.F Clock domains, existence, and apply-path contract

This section is the **planning-correction 2** addendum (clock-domain split).
It does not authorize implementation. It does not introduce D-054. It does
not change D-052.

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

#### 6.F.1 Three clocks — never one `sourceVersionAt`

Keep **three distinct concepts**. Do **not** collapse them into one
`sourceVersionAt`. Do **not** compare them to each other as one sequence.

| Clock | Field(s) | What it measures | What it may decide |
|---|---|---|---|
| **A. Shopify attribute version** | Resource `shopifyUpdatedAt`; per-name `InventoryQuantity.updatedAt` | Shopify’s own resource / quantity mutation time | Whether **attributes / quantity values** are newer than the stored fact **of the same Shopify version type** |
| **B. Authoritative existence observation** | `existenceState`, `existenceKind`, `existenceObservedAt`, `existenceObservationGen` | When **this app completed** an authoritative Shopify check that the GID / relationship currently existed or currently did not exist | LIVE vs TOMBSTONED / disconnected existence. Comparable only to other **app-issued** existence observations and to `SyncRun.fenceGeneration` |
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

**Hard rule — no cross-clock comparison**

- Do **not** compare Shopify `updatedAt` to webhook `receivedAt`.
- Do **not** compare Shopify `updatedAt` to `existenceObservedAt`.
- Do **not** compare Shopify `updatedAt` to `SyncRun.fenceAt`.
- Do **not** use webhook arrival time as a synthetic Shopify mutation timestamp.
- Do **not** un-tombstone by asking whether Shopify `updatedAt` is strictly
  after a local tombstone time. Confirmed absence is an existence
  observation (clock B), not a Shopify clock.
- Attribute decisions use clock A only (plus the null-version **fallback**
  in §6.F.8, which is still an app-issued attribute generation, not a
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

#### 6.F.2 Authoritative existence observation (clock B)

An existence observation is recorded **only after** this app has a Shopify
Admin GraphQL result or a **complete** extraction result for that identity.

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
| `ABSENT_CONFIRMED_QUERY` | Direct GraphQL refetch **completed** and Shopify reported the identity absent / unqueryable |
| `LIVE_FULL_SYNC_PRESENT` | A **complete** `catalog-sync-v2` JSONL / complete location page **contained** the GID / relationship |
| `ABSENT_FULL_SYNC_SWEEP` | A **complete** domain extraction + absence sweep concluded the identity was not present in the epoch and no newer LIVE existence observation contradicts that (§6.F.9) |

`existenceObservedAt` is the app UTC time **when that Shopify check
completed**, **not** webhook `receivedAt`.

`Shop.catalogObservationGen` (planning name) is a shop-scoped bigint.
`SyncRun.fenceGeneration`, `existenceObservationGen`, and
`attributeObservationGen` are allocated from this **one** app-issued
sequence so they are comparable as **later app check**, not as later
Shopify mutation:

- Direct refetch observations: increment **after** the Shopify result is
  in hand and **before** the canonical write, under the same
  `(shopId, identity)` `SELECT … FOR UPDATE` that serializes apply.
- Complete full-sync snapshot observations (`LIVE_FULL_SYNC_PRESENT` /
  `ABSENT_FULL_SYNC_SWEEP`) and null-version bulk attribute observations:
  use **`SyncRun.fenceGeneration`**, allocated **once** at bulk submit
  together with `fenceAt`, **not** a new generation per JSONL line.

A larger generation means a **later app check**. It does **not** mean a
later Shopify `updatedAt`.

**LIVE vs TOMBSTONED** is decided only by clock B:

- `existenceState = LIVE` while the latest **committed** existence
  observation for that identity is a LIVE kind.
- `existenceState = ABSENT` (tombstoned / disconnected) while the latest
  committed existence observation is an ABSENT kind.
- A webhook payload **alone** never writes ABSENT.

Serialize apply per `(shopId, shopifyGid)` — or
`(shopId, inventoryItemGid, locationGid)` for levels — with
`SELECT … FOR UPDATE` inside the tenant transaction. This is row-level
fact locking, **not** a dispatcher/readiness redesign.

#### 6.F.3 Signal observation (clock C)

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

#### 6.F.4 Shopify attribute version (clock A)

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
   presence updates (§6.F.5).
4. If `I.shopifyUpdatedAt == S.shopifyUpdatedAt`: idempotent attribute
   no-op if attributes match. If attributes **differ** at equal
   `updatedAt`: **no-op**, open `DataIssue` `EQUAL_VERSION_CONFLICT`,
   schedule authoritative refetch. Do not silently pick a side.
5. If either side is missing `updatedAt`: **do not** use unrestricted
   last-writer-wins. Use the **nullable-version fallback** in §6.F.8.

Un-tombstone is **not** a clock-A decision. A newer Shopify `updatedAt`
does not by itself clear ABSENT. A LIVE existence observation (clock B)
does not by itself license applying stale attributes.

**Inventory quantities (per name)**

Each of `available`, `on_hand`, `incoming`, `committed`, `reserved`,
`damaged`, `safety_stock`, `quality_control` has its **own** Shopify
attribute clock: that name’s `InventoryQuantity.updatedAt`.

- Apply name `N` only when incoming `N.updatedAt` is **strictly after**
  stored `N.updatedAt`, or the stored name is absent, or both are null
  and the nullable-quantity fallback in §6.F.8 applies.
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

#### 6.F.5 Full-sync presence marker is independent of attribute no-op

If a **COMPLETE** full sync’s JSONL **contains** GID X, then X is
**PRESENT in that epoch**.

`lastSeenFullSyncRunId = R.epochId` **must** be written for that observed
GID **even when** clock A rejects the row’s attributes as stale (incoming
`shopifyUpdatedAt` older than stored).

Stale-attribute rejection **must not** treat the GID as absent. Absence
sweep looks at the presence marker and clock-B existence evidence, **not**
at whether attributes were applied.

The JSONL applicator, for each in-scope identity line, in one
`(shopId, identity)` transaction:

1. `SELECT … FOR UPDATE`.
2. Persist signal/lineage as appropriate.
3. If this line is from complete epoch `R`: set
   `lastSeenFullSyncRunId = R.epochId` (presence marker).
4. Decide attributes via clock A (and §6.F.8 fallback) independently.
5. If the row is ABSENT, decide un-tombstone via clock B (§6.F.7)
   independently of whether attributes no-op’d.

Bounded memory: presence is a **column on the fact row**, updated per
streamed line. The applicator does **not** accumulate the epoch’s GID set
in process memory. Absence sweep is set-based SQL against
`lastSeenFullSyncRunId` and existence columns. Memory remains O(batch).

**Mandatory adversarial case (must be an implementation test later):**

- T0 = full-sync fence (`R.fenceAt` / `R.fenceGeneration`).
- Canonical X already has Shopify `updatedAt` T-0.5 from a delayed
  incremental refetch (after T0, before JSONL apply).
- Bulk JSONL contains X with older Shopify `updatedAt` T-2.
- Bulk **attributes** are correctly rejected as stale.
- X **must still** receive `lastSeenFullSyncRunId = R.epochId`.
- Absence sweep **must not** tombstone X.

#### 6.F.6 Delete / disconnect: signal, then authoritative existence check

For a delete or inventory-level disconnect **signal**:

1. Map the canonical GID / item+location identity from the sanitized
   projection. Do not invent a replacement GID.
2. Record clock-C signal lineage (`signalReceivedAt` = webhook received
   time). **Do not** use that timestamp as Shopify `updatedAt`.
3. Perform the approved **authoritative existence check** when technically
   possible (table in §6.F.2).
4. If Shopify **currently returns the same identity live**:
   - **Do not** tombstone merely because a delayed signal arrived.
   - Open `DataIssue` (`CATALOG_STALE_DELETE_SIGNAL` or
     `CATALOG_STALE_DISCONNECT_SIGNAL`) with the signal delivery id and
     the live refetch correlation.
   - Apply or refetch live canonical **attributes** according to clock A.
   - Set existence to LIVE with `existenceKind = LIVE_REFETCH` and a new
     `existenceObservationGen`.
5. If Shopify **authoritatively reports** the identity absent /
   unqueryable (completed query, not a timeout):
   - Tombstone / disconnect.
   - Store `existenceKind = ABSENT_CONFIRMED_QUERY`, `existenceObservedAt`
     = when that check completed, new `existenceObservationGen`.
   - **Do not** store webhook `receivedAt` as the confirmation time.
6. If the query is **ambiguous or transiently failed**:
   - **Do not** convert the failure into canonical deletion.
   - Retry with bounded backoff; if still unresolved, open `DataIssue`
     (`CATALOG_EXISTENCE_CHECK_FAILED`) and leave the row in its last
     confirmed existence state (or mark catalog compatibility `DEGRADED`
     if a prior LIVE/ABSENT cannot be trusted). Do not silently drop the
     fact.

**Terminal vs reconnectable (do not assume without evidence)**

- **Product / variant / inventory item / location GID:** official 2026-07
  `productDelete` documentation states product deletion is **irreversible**
  and the product cannot be recovered. After a **confirmed** Shopify delete
  (`ABSENT_CONFIRMED_QUERY` or complete-sweep `ABSENT_FULL_SYNC_SWEEP`),
  treat that GID as **structurally terminal** in Shopify’s normal identity
  model. Recreated merchant products are **new GIDs** (never merge by SKU /
  barcode / title). A **later authoritative LIVE check of the same GID** is
  still existence evidence and **may restore LIVE** as a **safety revival**
  if Shopify returns that GID live. That is not a claim that Shopify
  documents GID reuse. Attributes of the restored row still follow clock A.
- **Inventory-level relationship** `(inventoryItemGid, locationGid)`:
  **reconnectable**. Official 2026-07 `inventoryItem.inventoryLevel` is
  nullable and `inventoryBulkToggleActivation` can activate/deactivate
  stocking at a location. Confirmed disconnect is absence of the
  relationship, not destruction of the item or location. A later
  authoritative live check showing the relationship present **reconnects**
  (LIVE) even when Shopify quantity `updatedAt` is not comparable to the
  local absence observation time.

#### 6.F.7 Un-tombstone / reconnect (existence separate from attributes)

Required principle: an **authoritative Shopify observation obtained after**
the confirmed absence observation, which shows the **same** GID /
relationship **live**, is existence evidence that can supersede the
tombstone.

Compare **clock B to clock B**:

- Direct LIVE refetch may un-tombstone when its
  `existenceObservationGen` is **greater than** the committed absence
  observation’s generation.
- Complete full-sync presence (`LIVE_FULL_SYNC_PRESENT` at
  `R.fenceGeneration`) may un-tombstone when `R.fenceGeneration` is
  **greater than** the committed absence generation.
- A late bulk row from an **older** run (`fenceGeneration` **less than or
  equal to** the absence generation) **must not** resurrect.

**Attributes still obey clock A.** Un-tombstoning a row does **not**
license applying stale Shopify attributes. A revival may restore LIVE with
**existing** attributes plus a presence/existence update, then apply newer
attributes only when clock A says so.

Do **not** require Shopify `updatedAt` to be strictly after local absence
time. That comparison crosses clock domains and can block a legitimate
revival when clocks are incomparable, or allow a false revival if a
Shopify timestamp is accidentally compared to a webhook time.

Recreated Shopify GIDs remain new identity rows (never merge).

#### 6.F.8 Nullable Shopify version fallback (not last-writer-wins)

Shopify `updatedAt` is **preferred whenever present**. Official Shopify
2026-07 `InventoryQuantity.updatedAt` is **nullable**. Resource
`updatedAt` is `DateTime!` on Product / ProductVariant / InventoryItem /
Location / InventoryLevel, but incoming payloads can still omit the field.

**Never** fall back to unrestricted last-writer-wins (`appliedAt` or
arrival order).

When incoming and/or stored **Shopify attribute version is null**, use an
**app-issued attribute observation generation** — planning names
`attributeObservationGen` on resource facts and per-name
`quantityAttributeGen` on inventory quantities — allocated from
`Shop.catalogObservationGen`.

This generation:

- orders **app-issued authoritative attribute observations**, **not**
  Shopify mutations;
- is allocated after the Shopify payload is in hand and before the
  canonical write, under `SELECT … FOR UPDATE`;
- for complete full-sync JSONL rows with **null** Shopify `updatedAt`,
  uses **`SyncRun.fenceGeneration`**, so a delayed bulk observation
  **cannot** commit over a newer direct refetch that already advanced
  `attributeObservationGen` / `quantityAttributeGen`;
- for a **direct authoritative refetch** with null Shopify `updatedAt`,
  allocates a **new** generation **greater than** any previously
  committed attribute generation for that identity. That refetch **must
  be able to update the fact**. Infinite no-op because both versions are
  missing is **forbidden**;
- is **explicitly a fallback only**. As soon as a non-null Shopify
  `updatedAt` arrives, clock A prefers that Shopify timestamp; the
  fallback generation is retained for diagnostics but does not outrank a
  real Shopify `updatedAt` on the other side of a comparison.

**Commit rules (nullable path)**

1. Incoming has Shopify `updatedAt`, stored has Shopify `updatedAt`:
   clock A only (§6.F.4). Ignore fallback generations for the apply
   decision.
2. Incoming has Shopify `updatedAt`, stored does not: apply incoming
   (Shopify version **outranks** a stored null-version fallback).
3. Incoming lacks Shopify `updatedAt`, stored has Shopify `updatedAt`:
   **do not** apply incoming attributes. A stale full-sync/bulk
   observation with missing version **must not** overwrite a newer
   authoritative versioned fact. Record `DataIssue`
   (`CATALOG_NULL_VERSION_OBSERVATION`) if the incoming observation was
   expected to refresh the fact.
4. Both lack Shopify `updatedAt`: apply incoming **only if** incoming
   `attributeObservationGen` (or per-name `quantityAttributeGen`) **>**
   stored generation. Older generations **cannot** commit over newer
   generations. Equal generations: idempotent no-op.

**Concurrent missing-version observations:** two in-flight refetches
serialize on `(shopId, identity)` `SELECT … FOR UPDATE`. Each allocates
its generation **after** taking the lock (or uses the full-sync fence
generation for bulk lines). The later lock holder sees the earlier commit
and applies the `>` rule. The older generation cannot overwrite the newer.

**Degraded honesty:** when absolute Shopify source freshness cannot be
established (null `updatedAt` on the applied fact), the row’s
`attributeFreshnessState = DEGRADED` and a `DataIssue`
(`CATALOG_ATTRIBUTE_VERSION_DEGRADED`) remains open until a non-null
Shopify `updatedAt` is stored. UI must not claim perfect ordering for that
fact. This is **not** a silent success.

**Inventory quantity names with nullable `InventoryQuantity.updatedAt`:**
the same fallback applies per name via `quantityAttributeGen`. A direct
authoritative quantity refetch with null `updatedAt` **must** be able to
refresh that name (new `quantityAttributeGen`). It **must not** enter an
infinite no-op/refetch loop. A null-version bulk quantity **must not**
overwrite a newer refetch of that name. Concurrent null-version quantity
observations follow the same generation `>` rule under the inventory-level
row lock.

#### 6.F.9 Absence-tombstone predicate (existence evidence, not Shopify clocks)

Absence sweep runs **only** after:

1. `bulkOperation(id:)` status is `COMPLETED` (or location pagination
   exhausted with no errors);
2. `url` is present for bulk domains;
3. `partialDataUrl` is null **or** is ignored for canonical purposes
   (never a success watermark);
4. JSONL/pages were fully streamed and **every in-scope identity’s
   applicator batch committed**, including **presence-marker** writes for
   every observed GID even when attributes no-op’d;
5. `jsonlCommittedLineOrdinal` equals the last applied line (bulk
   domains);
6. domain extraction is complete for the swept resource type.

**No failed, canceled, or partial bulk may absence-tombstone.**

Then, set-based, tenant- and domain-scoped, bounded-memory SQL. A LIVE
row may be tombstoned by full-sync absence **only if all** of:

- it belongs to the `shopId` and resource domain being swept;
- `lastSeenFullSyncRunId IS DISTINCT FROM R.epochId` (not observed
  present in this epoch);
- there is **no** authoritative LIVE existence observation newer than
  the full-sync fence:
  `NOT (existenceState = LIVE AND existenceObservationGen > R.fenceGeneration)`;
- there is **no** newer confirmed delete/reconnect state that would make
  the sweep contradictory — if `existenceObservationGen > R.fenceGeneration`
  already records ABSENT or LIVE from a **later** refetch, the sweep
  **must not** overwrite that later existence observation;
- equivalently: the sweep may write `ABSENT_FULL_SYNC_SWEEP` only when
  `existenceObservationGen IS NULL OR existenceObservationGen <= R.fenceGeneration`
  (the row’s last authoritative existence check is **not newer than** this
  extraction).

Illustrative set-based SQL (exact SQL is implementation):

```text
UPDATE fact
SET existenceState = 'ABSENT',
    existenceKind = 'ABSENT_FULL_SYNC_SWEEP',
    existenceObservedAt = now(),
    existenceObservationGen = :fenceGeneration,
    deletedAt = now(),
    deletionSource = 'FULL_SYNC_ABSENCE',
    lastSyncRunId = :epochId
WHERE shopId = :shopId
  AND lastSeenFullSyncRunId IS DISTINCT FROM :epochId
  AND existenceState = 'LIVE'
  AND (existenceObservationGen IS NULL
       OR existenceObservationGen <= :fenceGeneration)
```

The sweep **does not** compare `shopifyUpdatedAt` or `shopifyCreatedAt`
to `R.fenceAt`. Those are Shopify clocks. The fence used here is
`R.fenceGeneration` (app-issued, allocated at bulk submit) compared to
`existenceObservationGen` (app-issued).

`shopifyCreatedAt` is **not** an absence guard. It remains a Shopify
attribute/observability column. Using it as a “created after T0”
substitute for existence evidence would mix Shopify time with the run
fence.

`fenceAt` remains useful diagnostics (when the extraction was submitted).
It is **not** compared to Shopify `updatedAt`.

#### 6.F.10 Adversarial races this PR’s tests must cover

Implementation tests (when PR 5 implementation is authorized — **not
now**) **must** include:

| Race | Setup | Required outcome |
|---|---|---|
| **A. Delayed bulk vs newer incremental attributes** | Incremental refetch writes Shopify `updatedAt = T+5` and `existenceObservationGen = G1`. Later, bulk row from run fenced at T0 arrives with Shopify `updatedAt = T+1`. | Canonical **attributes** stay at T+5. Bulk attributes no-op. GID still `lastSeenFullSyncRunId =` this epoch. Existence remains LIVE. |
| **B. Full-sync absence vs post-fence create** | Bulk fenced at T0 does not contain GID X. After T0, Shopify creates X; incremental LIVE refetch writes X with `existenceObservationGen > R.fenceGeneration`. Absence sweep runs. | X remains LIVE. Sweep does not tombstone. Do **not** implement this by comparing Shopify `createdAt`/`updatedAt` to `fenceAt`. |
| **C. Confirmed absence vs late older bulk** | Absence confirmed at generation G2. Late bulk row from run with `fenceGeneration = G1 < G2` arrives. | Row stays ABSENT. Late bulk does not resurrect. Fence compared only to existence generations, never used as fake Shopify `updatedAt`. |
| **D. `partialDataUrl` completeness** | Bulk `COMPLETED` with `partialDataUrl` set and `url` null or ignored. | No absence sweep. No completeness watermark. `DataIssue` opened. LIVE rows unchanged. |
| **E. JSONL checkpoint crash** | Batch lines 101–200 commit; process crashes before a *separate* checkpoint write would have run. | Checkpoint is in the same commit as the batch **or** retry re-applies 101–200 idempotently. Checkpoint is never 200 while 101–200 are uncommitted. |
| **F. Projection failure** | Canonical commit succeeds; projection throws. | Canonical row present. `DataIssue` compatibility projection failed. Compatibility DEGRADED. Rebuild restores projection without rolling back canonical. |
| **G. Mixed quantity names** | Stored `committed.updatedAt = T+3`. Incoming snapshot has newer `available` but older `committed`. | `available` may apply; `committed` must not rewind. |
| **H. Delayed delete webhook after live refetch** | LIVE refetch confirms GID current. Later, delayed delete/disconnect webhook arrives. Authoritative re-check still returns live **or** is required before any tombstone. | Signal alone **must not** tombstone current live authority. Stale-signal `DataIssue`. LIVE retained (or re-confirmed). |
| **I. Confirmed absence after full-sync fence; late older bulk cannot resurrect** | Sweep/refetch confirms ABSENT at generation ≥ fence. Older bulk row later arrives. | Existence stays ABSENT. See also Race C. |
| **J. Live check after tombstone with incomparable Shopify `updatedAt`** | Row ABSENT via `ABSENT_CONFIRMED_QUERY`. Later LIVE refetch returns the same GID/relationship. Shopify `updatedAt` is **not** compared to local absence time (may be older, equal, null, or unusable). | Existence **may recover** (LIVE) because clock B shows a newer app observation. Attributes still follow clock A (may no-op). |
| **K. Full sync observes GID; stale attributes no-op; presence marker still advances** | Canonical X has Shopify `updatedAt` T-0.5 from delayed incremental. Bulk contains X with `updatedAt` T-2. | Attributes rejected. `lastSeenFullSyncRunId = epochId`. Absence sweep **must not** tombstone X. Bounded memory (column update, no in-process GID set). |
| **L. Nullable Shopify `updatedAt`: authoritative refetch can update** | Stored fact has null `shopifyUpdatedAt`. Direct authoritative refetch also has null `updatedAt` but new `attributeObservationGen`. | Fact **updates**. No infinite no-op. `attributeFreshnessState = DEGRADED` + `DataIssue` until a real Shopify `updatedAt` exists. |
| **M. Concurrent missing-version observations** | Two null-`updatedAt` authoritative observations. Older generation G1, newer G2. | G1 **cannot** overwrite G2. Deterministic `>` on `attributeObservationGen` under row lock. |
| **N. Failed authoritative delete/disconnect refetch** | Delete/disconnect signal received. Existence query times out / 5xx / throttled. | Query failure is **not** converted into canonical deletion. Retry / `CATALOG_EXISTENCE_CHECK_FAILED` / DEGRADED. Last confirmed existence retained. |
| **O. Partial/failed bulk still cannot run absence sweep** | `FAILED`, `CANCELED`, or `COMPLETED` with only `partialDataUrl`. | Absence sweep does not run. Same as Race D for partial; failed/canceled equally forbidden. |

Tests **must** fail closed: a focused command that collects zero tests is
a failed check (PR 4 CI pattern).

#### 6.F.11 Planning non-goals (reiterated)

This section does **not**:

- authorize PR 5 implementation;
- create D-054;
- change D-052 / PR 4 control-plane semantics;
- add Shopify write mutations;
- couple forecast/ABC into the applicator;
- close Q-002, Q-004, R-028, R-029, or R-095..R-098.

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
| Visibility | Failure records a `DataIssue` (`COMPATIBILITY_PROJECTION_FAILED`) **and** an explicit compatibility-health state (`DEGRADED`) on existing PR 4 `DataIssue` / `SyncHealth` diagnostic surfaces — **not** a new dispatcher or envelope version. |
| SyncHealth | A canonical domain may be internally `SUCCEEDED` / current while merchant-facing **compatibility** health is `DEGRADED`. Diagnostics must show both. |
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
| BulkOperation ID | Persist the exact GID returned by `bulkOperationRunQuery` on the `SyncRun` (dedicated column **or** `cursorAfter` / `resultMetadata` — implementation chooses the smallest additive schema change). Lookup **only** via `bulkOperation(id:)` or `node(id:)` |
| Full-sync fence | Persist `SyncRun.fenceAt` (UTC) **and** `SyncRun.fenceGeneration` (one `Shop.catalogObservationGen` value) **before** `bulkOperationRunQuery` / first location page. `fenceGeneration` is the comparable app-issued existence/null-version marker. `fenceAt` is diagnostics. Do **not** compare `fenceAt` to Shopify `updatedAt`. |
| JSONL checkpoint | `jsonlCommittedLineOrdinal` (+ optional batch id) on `SyncRun`; advances with committed batches; no HTTP Range assumption |
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

Official bulk-operations guide (2026-08-14): completed operations expose a **signed** result URL that expires after **seven days**. The guide documents download-then-parse. It does **not** document HTTP `Range` / random access on that URL. PR 5 **must not assume** Range support unless a later implementation independently verifies it against official behavior and records that evidence. Until then, resume **re-downloads / re-streams from byte 0**.

Required implementation properties:

- Stream the result URL incrementally (HTTP stream + line reader).
- **No** `response.text()` + `split('\n')` of the full body.
- **No** full `variants[]` materialization.
- **No** one GraphQL call per row.
- **No** one database transaction per row as the steady-state pattern.
- Bounded memory: O(batch size), not O(catalog). Re-stream skip of already-committed lines must not buffer those lines.
- Batch upserts (planning ceiling: see tests; start at ≤500 rows / transaction, configurable).
- Idempotent upsert on `(shopId, shopifyGid)` **plus** §6.F clock-A attribute freshness, clock-B existence, and epoch **presence marker** (not last-writer-wins). Presence (`lastSeenFullSyncRunId`) advances even when attributes no-op.
- **Line/batch checkpoint is authoritative application progress**, stored on the `SyncRun` as `jsonlCommittedLineOrdinal` (1-based last fully committed JSONL line) and optional `jsonlCommittedBatchId`.
- Checkpoint **advances in the same database transaction as the fact batch**, or by a proven equivalent: facts commit first with a `ingestBatchId`; checkpoint then advances to that batch; on resume, an orphan committed batch (facts present, checkpoint behind) is acknowledged **without skipping uncommitted lines**. Checkpoint must **never** advance past a batch whose fact transaction did not commit.
- Restart without Range: if the same BulkOperation is still `COMPLETED` and `url` unexpired, re-stream from byte 0; lines `<= jsonlCommittedLineOrdinal` are not applied (or are applied only as idempotent §6.F upserts: attribute no-op + presence marker remains set); lines after the checkpoint are applied. Repeated records converge by identity key + clock-A / clock-B / presence-marker rules.
- If the URL is expired: start a **new** BulkOperation; **never** convert the old run to `SUCCEEDED`.
- Crash boundaries that must be tested: (1) kill before batch commit — replay applies the batch; (2) kill after batch commit and before checkpoint acknowledgement — resume must not skip those rows; equivalent recovery bumps the checkpoint only after facts are present; (3) re-stream from start without Range; (4) expired URL.

### 8.4 Failed bulk / `partialDataUrl` — chosen rule

**Chosen: (a) discarded from canonical completion and retained only for diagnostics.**

- Do **not** apply `partialDataUrl` JSONL to canonical fact tables.
- Record `SyncRun` `FAILED` or `PARTIAL_FAILURE` with `partialFailure=true`.
- Persist BulkOperation GID, `status`, `errorCode`, `objectCount`, `rootObjectCount`, and `partialDataUrl` **metadata** (not merchant-domain facts) for diagnostics until expiry.
- Open a `DataIssue`.
- **Never** advance a full-sync success watermark (`SyncCursor` / `HEALTHY` successor) from partial or failed data.
- Do **not** tombstone-by-absence using a partial set, and do **not** run the §6.F.9 absence sweep (that would delete live GIDs that simply were not in the incomplete file).

Rationale vs (b): staging incomplete rows as live canonical facts would make deletion/recreation and completeness proofs false. Control-plane incomplete evidence is already expressible as `PARTIAL_FAILURE` + `DataIssue` without applying rows.

### 8.5 Success watermark

A domain watermark advances to “full sync succeeded” only when:

1. BulkOperation `status=COMPLETED` (or locations pagination exhausted with no errors);
2. JSONL/pages fully applied;
3. checkpoints complete;
4. absence-tombstones for that domain ran against the **complete** epoch using `lastSeenFullSyncRunId` and `fenceGeneration` compared to `existenceObservationGen` (§6.F.9) — **never** an in-memory GID list, **never** Shopify `updatedAt` vs `fenceAt`, and **never** after partial/failed bulk;
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
- tombstone locations present in canonical facts but absent from a **complete** location sync, using the §6.F.9 existence predicate (a location with `existenceObservationGen > fenceGeneration` must survive; a location **observed** in this epoch must keep its presence marker even if attributes no-op);
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

Official `products/delete` sample payload is `{ "id": … }` only — map identity from REST id / GID, then run the §6.F.6 existence check. Do not upsert the webhook body as a live fact. Do not skip the live check merely because the topic is delete.

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
| products delete | Signal only. Map identity. Authoritative `product(id:)` check (§6.F.6). If live: do not tombstone; stale-signal `DataIssue`; apply live attributes via clock A. If confirmed absent: tombstone product; then refetch-or-absence for variants still keyed to that product. Query failure is not deletion. |
| inventory_items create/update | Refetch item (+ linked variant if returned) |
| inventory_items delete | Signal only. Authoritative `inventoryItem(id:)` check. Tombstone item only on confirmed absence; do not remap SKU onto another item |
| inventory_levels connect | Signal. Authoritative item+location live check; upsert reconnectable relationship; refetch quantities via clock A |
| inventory_levels update | **Refetch all eight quantity names**; ignore webhook `available` as complete truth |
| inventory_levels disconnect | Signal only. Official 2026-07 sample payload is `{ inventory_item_id, location_id }` only — no GID. Map identity from shop + inventory-item GID/REST id + location GID/REST id. Authoritative `inventoryItem.inventoryLevel(locationId:)` check. If still connected: do not disconnect; stale-signal `DataIssue`; apply live quantities. If confirmed null: set `existenceState=ABSENT`, `deletionSource=DISCONNECT`. Query failure is not disconnect. Do not invent a new level GID. Relationship is reconnectable. |
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
| Optional `SyncRun` field for BulkOperation GID + `fenceAt` + `fenceGeneration` + JSONL line checkpoint | Avoid `currentBulkOperation`; support §6.F existence fence and Range-free resume |
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

### D. Idempotency / recovery / freshness

- Replay of the same full sync converges (no duplicate GIDs; tombstones stable) **under §6.F** (not last-writer-wins; presence marker independent of attribute no-op).
- Interrupted batch resumes/retries safely from the **line checkpoint**; re-stream from byte 0 without HTTP Range.
- Duplicate / out-of-order incremental signals converge to the **newer Shopify attribute version** (clock A) and the **later app existence observation** (clock B), not the later commit.
- Failed bulk + `partialDataUrl` does **not** advance a success watermark and **does not** run absence tombstones.
- Expired result URL starts a new bulk op and does not fake success.

### D1. Concurrency / fence / existence (mandatory)

1. Old full-sync row cannot overwrite a newer webhook refetch (clock A identity-row `updatedAt`).
2. Race A: delayed bulk vs newer incremental attributes — bulk attributes no-op; presence marker still advances.
3. Race B: post-fence create with newer `existenceObservationGen` survives older full-sync absence sweep (existence evidence, not Shopify `updatedAt` vs `fenceAt`).
4. Race C: confirmed absence vs late older bulk (`fenceGeneration` older than absence gen) — no resurrection.
5. Per-state inventory: stale `available` (or any named state) cannot overwrite a newer per-name `updatedAt`.
6. Equal `updatedAt` with differing attributes → no-op + `DataIssue` + refetch.
7. Failed/partial bulk never performs absence tombstones (Race O / D).
8. Delayed delete/disconnect webhook after a current live refetch: signal alone must not tombstone (Race H).
9. Same-GID/relationship authoritative live check after a prior tombstone: existence may recover even when Shopify `updatedAt` is not comparable to local tombstone time (Race J).
10. Full sync **observes** a GID whose stale attributes no-op: epoch marker still advances; absence sweep preserves it (Race K).
11. Nullable Shopify `updatedAt`: current authoritative refetch can eventually update the fact (Race L). No infinite no-op.
12. Two concurrent missing-version observations: older local `attributeObservationGen` cannot overwrite newer (Race M).
13. Failed authoritative delete/disconnect refetch: query failure is not converted into canonical deletion (Race N).

### D2. Checkpoint crash boundaries (mandatory)

- Kill **before** batch commit: resume re-applies the batch; no silent skip.
- Kill **after** batch commit / **before** checkpoint acknowledgement: rows are not lost and are not skipped; checkpoint catches up.
- Re-stream from start without HTTP Range is safe (idempotent + clock-A / presence-marker).
- Expired URL starts a new BulkOperation and never marks the old run succeeded.

### D3. Projection failure (mandatory)

1. Canonical apply succeeds + projection fails → canonical facts preserved (no rollback).
2. Failure is surfaced (`DataIssue` + compatibility health `DEGRADED`).
3. Retry/rebuild repairs projection **without** duplicate canonical application.
4. Compatibility health returns to healthy only after the projection matches canonical facts.
5. Uninstall/disabled-shop: projection retry fail-closed.

### D4. Reconciliation work is bounded

- Reconcile uses bulk or complete pagination, **not** one GraphQL call per variant-location.
- Write/read counts have an explicit ceiling; N+1 Shopify reads fail the test.

### E. Identity / deletion

- Product delete: delayed delete signal must not tombstone a currently live GID; confirmed absence tombstones the product GID.
- Variant deletion/recreation: two GIDs, same SKU/barcode/title, both retained; history not merged.
- Inventory-item delete: confirmed-absence tombstone; query failure is not deletion.
- Location delete vs deactivate distinguished; delete is a signal + existence check.
- Inventory-level connect / update / disconnect: disconnect is reconnectable; delayed disconnect must not drop a currently connected level.

### F. Inventory-state truth

- `available` and `on_hand` remain distinct in persistence and tests.
- `incoming` and `committed` remain distinct.
- `reserved`, `damaged`, `safety_stock`, `quality_control` persisted.
- Missed-webhook-state scenario: change only a non-`available` quantity with **no** `inventory_levels/update` (official: `committed` / `reserved` / `damaged` / `safety_stock` / `quality_control` do not trigger webhooks); reconcile/refetch corrects canonical facts.
- Per-name `updatedAt` fence: stale reconcile cannot move a quantity backward. Nullable per-name `updatedAt` uses `quantityAttributeGen` fallback (§6.F.8); no infinite no-op.

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
| Inventory webhooks: `committed` / `reserved` / `damaged` / `safety_stock` / `quality_control` do not trigger | https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps (accessed 2026-08-14) |
| InventoryQuantity.updatedAt (nullable) | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryQuantity |
| MoneyV2 / Decimal | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MoneyV2 ; https://shopify.dev/docs/api/admin-graphql/2026-07/scalars/Decimal |
| BulkOperation / partialDataUrl / 7-day expiry | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/BulkOperation |
| `bulkOperation(id:)` | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/bulkOperation |
| `currentBulkOperation` deprecated | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/currentBulkOperation |
| Bulk query restrictions / JSONL / `__parentId` / poll-by-id | https://shopify.dev/docs/api/usage/bulk-operations/queries |
| Webhook topics allowlist | https://shopify.dev/docs/api/admin-rest/2026-07/resources/webhook |
| Product webhook 100-variant caveat | same REST webhook resource, `products/create` and `products/update` |
| Webhook ordering / non-guaranteed delivery | https://shopify.dev/docs/apps/build/webhooks (accessed 2026-08-14) |
| Product deletion irreversible | https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productDelete |
| InventoryItem.inventoryLevel(locationId) nullable | https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem |
| inventoryLevel(id:) | https://shopify.dev/docs/api/admin-graphql/2026-07/queries/inventoryLevel |

API target remains **2026-07**. This planning task does not bump versions.

---

## 20. Implementation authorization (explicitly withheld)

When ChatGPT later authorizes implementation, the approved unit is a **new** branch from then-current `main`, proposed name `phase-1/catalog-location-inventory-facts`, covering only this brief.

Until then:

- do not create the implementation branch;
- do not modify `app/`, Prisma schema/migrations, scripts, tests, package manifests, CI, Shopify config, GraphQL documents, or feature flags as part of D-053;
- do not merge this planning PR without explicit user authorization after ChatGPT acceptance.

**PR 5 PLANNING IN PROGRESS — IMPLEMENTATION NOT AUTHORIZED.**
