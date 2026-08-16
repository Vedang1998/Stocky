# Phase 1 PR 5 — Independent Planning Review (Catalog, Location, and Inventory Facts)

**Reviewer:** Claude Code
**Review type:** Independent PR 5 **planning** review (architecture / product-plan). Not an implementation review, not an acceptance decision.
**Review date:** 2026-08-14
**Authority context:** D-052 remains Phase 1 PR 4 technical-acceptance authority. D-053 is Phase 1 PR 5 **planning authorization only**. This report does **not** create D-054, does **not** authorize implementation, and does **not** authorize production, deployment, backfill, ownership repair, or any Shopify mutation.

**This report is immutable once committed. Later corrections must not edit it.**

---

## 1. Identity and pre-flight verification

| Field | Value | Verified how |
|---|---|---|
| Base branch | `main` | GitHub API |
| **Verified base SHA** | `de1bb193a43ef87cf59acafeac4c5748e62d423d` | `git rev-parse origin/main` **and** PR #24 `base.sha` |
| Pull request | **#24** — “Phase 1 PR 5 planning — Catalog, location, and inventory facts (D-053)” | GitHub API |
| PR state at review start | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` | GitHub API |
| **Reviewed planning head SHA** | `b33cf33a3ee72bd30f1dac6a9117538118157725` | `git rev-parse refs/pull/24/head` **and** PR #24 `head.sha` |
| Head branch | `phase-1/pr5-planning` | GitHub API |
| Commits in range | 3 (`e839971`, `293395d`, `b33cf33`) | `git log de1bb193..b33cf33` |
| Diff size | `+1480 / −26`, 6 files | `git diff --stat` |
| Implementation branch `phase-1/catalog-location-inventory-facts` | **DOES NOT EXIST** | `list_branches` (16 branches enumerated; absent) |

### 1.1 Exact-head CI evidence (pre-review head `b33cf33…`)

| Run | Job | Workflow / job name | `head_sha` | Conclusion |
|---|---|---|---|---|
| `31831993014` (PUSH) | `94869613750` | CI — “Lint, typecheck, test, build, Prisma, GraphQL” | `b33cf33a3ee72bd30f1dac6a9117538118157725` | **success** |
| `31831997013` (PR) | `94869627726` | CI — “Lint, typecheck, test, build, Prisma, GraphQL” | `b33cf33a3ee72bd30f1dac6a9117538118157725` | **success** |

Both jobs report `status=completed`, `conclusion=success`, `run_attempt=1`, and all 135 substantive steps green, including `Git diff check`, `Prisma schema drift check`, tenant-enforcement apply/verify/drift, the PR 4 sync control-plane suites, `Build`, and `GraphQL codegen / schema validation`.

### 1.2 Planning diff scope — documentation only

`git diff --name-status de1bb193…b33cf33…`:

```
M  stocky-plus/docs/DECISIONS.md
M  stocky-plus/docs/OPEN_QUESTIONS.md
M  stocky-plus/docs/PROJECT_STATUS.md
M  stocky-plus/docs/RISK_REGISTER.md
A  stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md
M  stocky-plus/docs/phases/phase-1/README.md
```

**Confirmed:** zero changes under `app/`, `prisma/`, `scripts/`, `extensions/`, `.github/`, `package.json`, `package-lock.json`, `shopify.app.toml`, `.graphqlrc.ts`, or any test/config file. No runtime, schema, migration, GraphQL-document, Shopify-configuration, feature-flag, or CI change. **No stop condition triggered.**

---

## 2. Files reviewed

**Planning packet under review (at `b33cf33…`)**

- `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` (1,356 lines — read in full)
- `stocky-plus/docs/DECISIONS.md` (D-052 amendment; D-053 items 1–12 including planning corrections 1 and 2)
- `stocky-plus/docs/PROJECT_STATUS.md` (D-053 block; gate disposition; current truth)
- `stocky-plus/docs/OPEN_QUESTIONS.md` (Q-004 PR 5 clarification; Q-002/Q-003/Q-008/Q-011)
- `stocky-plus/docs/RISK_REGISTER.md` (R-010, R-014, R-034, R-122, R-123, **R-129…R-151**)
- `stocky-plus/docs/phases/phase-1/README.md` (PR 5 status; PR #23 formal-close evidence)

**Governance / required reading**

- `AGENTS.md`
- `stocky-plus/docs/product/00_READ_ME_FIRST.md`
- `stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md`
- `stocky-plus/docs/phases/README.md`

---

## 3. Official Shopify 2026-07 sources verified (accessed 2026-08-14 by this reviewer)

Every external claim below was independently retrieved. Community posts were not used.

| Claim under test | Source | Result |
|---|---|---|
| `Location` exposes `createdAt` / `updatedAt` (`DateTime!`), `isActive`, `deactivatedAt`, `fulfillsOnlineOrders`, `shipsInventory`, `isFulfillmentService`, `hasActiveInventory`, `address` | `https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Location` | **Brief correct** |
| `ProductStatus` = `ACTIVE`/`ARCHIVED`/`DRAFT`/`UNLISTED` | `https://shopify.dev/docs/api/admin-graphql/2026-07/enums/ProductStatus` | **Brief correct** (`UNLISTED` visible 2025-10+) |
| `InventoryItem.inventoryLevel(locationId: ID!, includeInactive: Boolean = false)` returns nullable `InventoryLevel` | `https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem` | **Brief correct** (incl. `includeInactive`) |
| `InventoryItem.unitCost` permission — “View product costs … once product granular permissions are enabled” | same | **Brief correct** (type is `MoneyV2`) |
| `InventoryItem.createdAt`/`updatedAt` `DateTime!`; `measurement`, `tracked`, `requiresShipping`, `sku` | same | **Brief correct** |
| `InventoryLevel` has `createdAt`/`updatedAt` (`DateTime!`), `isActive`, `quantities(names: [String!]!): [InventoryQuantity!]!` | `https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryLevel` | **Brief correct** |
| `InventoryQuantity.updatedAt` is **nullable** `DateTime`; `quantity: Int!`; `name: String!` | `https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryQuantity` | **Brief correct** |
| Eight quantity names: `available`, `on_hand`, `incoming`, `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control`; `on_hand` is the total | `https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states` | **Brief correct** |
| “Changes to `committed`, `reserved`, `damaged`, `safety_stock`, and `quality_control` inventory states don't trigger webhooks.” | `https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps` | **Brief correct — verbatim** |
| Bulk query restrictions: max **5** connections; nesting max **two levels**; connections implement `Node`; top-level `node`/`nodes` forbidden; `first`/`cursor`/`pageInfo` optional and ignored | `https://shopify.dev/docs/api/usage/bulk-operations/queries` | **Brief correct** |
| 2026-01+: “each app can run up to **five** bulk query operations per shop simultaneously” | same | **Brief correct** |
| Poll via `bulkOperation(id:)` for 2026-01+; result URL signed and expires after **one week**; `partialDataUrl` for failed operations; `__parentId` cannot be queried; nested connections appear **after** their parents | same | **Brief correct** |
| Bulk guide does **not** document HTTP `Range` / random access on the result URL | same | **Brief correct — no Range documented** |
| `groupObjects` argument on `bulkOperationRunQuery`, default `false`; “Enabling grouping slows down bulk operations and increases the likelihood of timeouts.” | `https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/bulkOperationRunQuery` | **Brief correct** |
| `currentBulkOperation` **Deprecated** — “Use `bulkOperations` with status filter instead.” | `https://shopify.dev/docs/api/admin-graphql/2026-07/queries/currentBulkOperation` | **Deprecation confirmed;** see F-CLAUDE-PR5PLAN-13 |
| `bulkOperation(id: ID!)` root query exists, nullable return, not deprecated | `https://shopify.dev/docs/api/admin-graphql/2026-07/queries/bulkOperation` | **Brief correct** |
| `productVariant(id: ID!)` root query exists, nullable, not deprecated | `https://shopify.dev/docs/api/admin-graphql/2026-07/queries/productVariant` | **Brief correct** |
| `inventoryLevel(id: ID!)` root query exists, nullable | `https://shopify.dev/docs/api/admin-graphql/2026-07/queries/inventoryLevel` | **Brief correct** |
| `inventoryItems` root connection exists; `query` optional; returns `InventoryItemConnection!` | `https://shopify.dev/docs/api/admin-graphql/2026-07/queries/inventoryItems` | **Brief correct** |
| Webhook topics present on 2026-07: `products/create|update|delete`, `inventory_items/create|update|delete`, `inventory_levels/connect|update|disconnect`, `locations/create|update|delete|activate|deactivate`, `bulk_operations/finish` | `https://shopify.dev/docs/api/admin-rest/2026-07/resources/webhook` | **Brief correct — all present** |
| Product webhook 100-variant caveat — “Product webhooks will return a full variants payload for the first 100 records. For records 101 and higher … the `variant_gids` field will still include a `admin_graphql_api_id` value … sorted by `updated_at`” | same | **Brief correct — verbatim** |
| `inventory_levels/disconnect` payload = `{ inventory_item_id, location_id }` only, no GID | same | **Brief correct** |
| `products/delete` payload | same | **Brief INACCURATE** — see F-CLAUDE-PR5PLAN-11 |
| Webhook delivery not guaranteed; “Shopify doesn't guarantee ordering within a topic, or across different topics for the same resource”; recommends `X-Shopify-Triggered-At` / `updated_at` to organize; “use reconciliation jobs to periodically fetch data” | `https://shopify.dev/docs/apps/build/webhooks` | **Brief correct — verbatim** |
| **Bulk-operation snapshot / consistency semantics** | bulk-operations guide + `BulkOperation` object docs + targeted Shopify docs search | **NOT DOCUMENTED — no official guarantee exists.** See F-CLAUDE-PR5PLAN-03 |

**Net external-accuracy assessment:** the brief's Shopify factual base is unusually accurate. Exactly one cited payload description is wrong (P3), and one load-bearing inference (bulk completeness ⇒ authoritative absence) has **no official support** and is presented as if it did.

---

## 4. Repository runtime / schema / control-plane evidence inspected

All at reviewed head `b33cf33…` (identical to base for these paths — the PR changes no code).

**Current-main defects the brief claims to replace (§18) — all independently reproduced:**

| Claim | Evidence |
|---|---|
| Location cap | `app/services/shopify-gql.server.ts:81,88` — `fetchLocations` → `locations(first: 50)`, single page |
| Deprecated bulk poll | `app/services/shopify-gql.server.ts:195,197,207,215` — `pollBulkOperation` selects `currentBulkOperation` |
| Full JSONL in memory | `app/services/shopify-sync.server.ts:27,33` — `ingestBulkVariantCache` → `await response.text()` |
| Per-row DB upsert | `app/services/shopify-sync.server.ts:66` — loop `db.shopifyVariantCache.upsert` |
| Thin cache | `prisma/schema.prisma:382` `ShopifyVariantCache`; `:403` `InventorySnapshot` |
| Webhook `available` as truth | `app/jobs/workers/webhook-processor.ts:224,244` — `handleInventoryUpdate` upserts `inventorySnapshot` from payload |
| Forecast/ABC coupling | `app/jobs/workers/webhook-processor.ts:7,265,275` — imports and calls `computeForecast`, then `db.lowStockAlert.create` |
| Write helpers colocated | `app/services/shopify-sync.server.ts:106,117` — `adjustShopifyInventory` / `inventoryAdjustQuantities` in the same module as `ingestBulkVariantCache` |

**PR 4 control-plane fit:**

- `app/sync/execution-strategy.server.ts:14-19,38-49` — `WEBHOOK_ATOMIC_TOPICS` currently `{orders/create, orders/cancelled, refunds/create, inventory_levels/update}`; `catalog-sync` → `REBUILDABLE_IDEMPOTENT`; unknown job types fail closed as `NO_AUTOMATIC_RETRY`. New topics and `inventory-state-reconcile` are additive entries — **the brief's mapping fits without redesign.**
- `app/tenant/job-envelope.server.ts:33-59` — `TENANT_JOB_SOURCES` / `JOB_SOURCE_BY_NAME` allowlists; extension is additive. **Envelope v3 needs no major version bump — the brief's §14 claim is correct.**
- `app/sync/sanitize.server.ts:276,291-309` — topic switch fails closed with `topic_unsupported`; `app/sync/intake.server.ts:96-218` — quarantine paths. New topics require new sanitizers, exactly as §10.2 states.
- `shopify.app.toml:11,34` — `api_version = "2026-07"`; among the brief's topics only `inventory_levels/update` is registered. **§10.1's claim is correct.**
- `shopify.app.toml:8` — `scopes = "read_products,write_products,read_inventory,write_inventory,read_orders,read_locations"`. All topics the brief proposes are within already-granted scopes. **No scope change needed.**

**Tenancy / role architecture (decisive for §6.F and §8.3):**

- `scripts/tenant-enforcement/manifest.ts:447-459` — **`Shop` is `classification: "bootstrap"`, `rlsRequired: false`, `immutabilityTriggerRequired: false`, `bootstrapExemption: true`, `expectedRuntimePrivileges: ["SELECT","INSERT","UPDATE"]`**, noted “Canonical tenant identity; bootstrap lookup/upsert; **not merchant-domain RLS**”.
- `scripts/tenant-enforcement/manifest.ts:664-830` — `WebhookDelivery`, `DurableJob`, `JobAttempt`, `DeadLetter`, `JobReplay`, **`SyncRun`**, `SyncCursor`, `ReconciliationRun`, **`DataIssue`**, **`SyncHealth`**, `JobDispatch`, `DispatchReadyShop` are all `platform_control_plane` with **`expectedRuntimePrivileges: []`**.
- `scripts/tenant-enforcement/roles.ts:866-878` — `REVOKE ALL ON TABLE <every control-plane table> FROM <runtimeRole>`; control-plane role provisioned separately.
- `app/sync/control-plane-db.server.ts:13-43` — control plane is a **separate `PrismaClient` bound to `DATABASE_CONTROL_PLANE_URL`**, explicitly “Never expose as the general web/runtime Prisma client.”
- `app/tenant/bootstrap.server.ts:1-7` — bootstrap boundary “May access only Session and Shop … **Must not query merchant-owned models.**”
- `scripts/tenant-access/architecture-audit.test.ts:92-100` — asserts a **`bootstrap_merchant_access`** violation class.
- `prisma/schema.prisma:918-946` — `SyncRun` has `cursorBefore/cursorAfter VarChar(512)`, `partialFailure`, `errorCode`, `@@unique([shopId, id])`. A BulkOperation GID fits `VarChar(512)`; `fenceGeneration` / `jsonlCommittedLineOrdinal` would be additive columns.

**Consequence used throughout §5:** merchant-domain fact tables and the PR 4 control-plane tables are on **two different database roles and two different connections**. No single database transaction can span them.

---

## 5. Findings (ordered P0 → P3)

**Counts: P0 = 0 · P1 = 4 · P2 = 7 · P3 = 4 (15 total).**

Severity is assigned to the architecture the brief would make implementation authority — not lowered because the PR is documentation-only.

---

### P0

**None.** No cross-tenant exposure, destructive inventory/financial corruption, broken authentication, unrecoverable data loss, production-secret exposure, or write-safety violation is created by this planning diff. PR 5 as specified is structurally read-only against Shopify.

---

### P1 — correctness / data-integrity blockers

#### F-CLAUDE-PR5PLAN-01 — P1 — Generation allocation has no implementable atomic pattern; `Shop.catalogObservationGen` and `SyncRun.fenceGeneration` live on different roles and connections

**Affected brief sections:** §6.F.2 (“allocated from this **one** app-issued sequence”), §6.F.8, §8.1 (“Persist `SyncRun.fenceAt` **and** `SyncRun.fenceGeneration` (one `Shop.catalogObservationGen` value) **before** `bulkOperationRunQuery`”), §14.

**Repository evidence:**
- `Shop` is `bootstrap`, runtime privileges `SELECT/INSERT/UPDATE` — `scripts/tenant-enforcement/manifest.ts:447-459`.
- `SyncRun` is `platform_control_plane`, `expectedRuntimePrivileges: []` — `manifest.ts:726-734`.
- `REVOKE ALL ON TABLE "SyncRun" FROM stocky_runtime` — `scripts/tenant-enforcement/roles.ts:867-878`.
- Control plane runs on a distinct client/URL — `app/sync/control-plane-db.server.ts:13-43`.

**Concrete failure mode:** the brief requires one value to be allocated from `Shop.catalogObservationGen` and written to `SyncRun.fenceGeneration` “**once** at bulk submit **together with** `fenceAt`”. Those two writes are executed by two different PostgreSQL roles over two different connections; there is no transaction that contains both. The brief specifies neither the allocating role, the allocating statement, nor the durability ordering. The reading an implementer is most likely to take — allocate and persist in one unit — is impossible, and the two repair paths both break the model:

- If `SyncRun.fenceGeneration` is written first and the counter increment fails or is retried, two runs (or a run and a later refetch) can carry the **same** generation. §6.F.7 (`fenceGeneration >` absence generation) and §6.F.9 (`existenceObservationGen <= :fenceGeneration`) then compare equal values: the sweep tombstones a row whose last authoritative check was genuinely later, or a stale bulk row resurrects a confirmed tombstone. Both are silent merchant-visible catalog corruption.
- If the counter is incremented first and the `SyncRun` write fails, the gap is harmless — but nothing in the brief requires that order.

The brief also never states that the allocation must be **durably committed before** the `bulkOperationRunQuery` network call. Read literally, “persist … before `bulkOperationRunQuery`” permits an open transaction spanning the Shopify call, holding a write lock on the tenant-root `Shop` row for the duration of a Shopify round trip.

**Required correction:**
1. Name the storage location, owning role, and connection for the generation sequence.
2. Give the exact allocation statement and its transaction boundary — e.g. `UPDATE "Shop" SET "catalogObservationGen" = "catalogObservationGen" + 1 WHERE id = $1 RETURNING "catalogObservationGen"` — and state that it commits before any dependent write or network call.
3. State the durability rule: a `SyncRun.fenceGeneration` may only be persisted from a generation value already committed by the allocator; a generation value may never be reused across runs.
4. Preferred alternative to evaluate explicitly: move the sequence to a control-plane-owned table (or a PostgreSQL sequence) so allocation and the `SyncRun` write are one transaction on one role.

**Missing tests:** two concurrent allocations never return the same value; crash between allocation and `SyncRun` persist leaves a gap and never a duplicate; no merchant-domain or `Shop` row lock is held across a Shopify HTTP call.

---

#### F-CLAUDE-PR5PLAN-02 — P1 — The shop-scoped ordering counter is placed on a bootstrap, non-RLS, bootstrap-exempt table with no classification or enforcement plan

**Affected brief sections:** §6 lineage table (`existenceObservationGen` “From shop-scoped `Shop.catalogObservationGen`”), §6.F.2, §6.F.8, §13 (“Every new merchant-domain table must comply with accepted PR 1–3 architecture”).

**Repository evidence:**
- `Shop`: `rlsRequired: false`, `immutabilityTriggerRequired: false`, `bootstrapExemption: true` — `manifest.ts:447-459`.
- `app/tenant/bootstrap.server.ts:1-7` — bootstrap boundary “**Must not query merchant-owned models.** Must not expose the raw Prisma client or arbitrary model delegates.”
- `scripts/tenant-access/architecture-audit.test.ts:92-100` — `bootstrap_merchant_access` is an audited violation.

**Concrete failure mode:** `catalogObservationGen` is not tenant infrastructure; it is a **merchant-domain operational ordering authority** that decides whether a merchant's product, variant, inventory item, location, or inventory level is LIVE or tombstoned. Putting it on `Shop` gives it:

- **no forced RLS and no `WITH CHECK`** — a `shopId` defect in the applicator writes and reads *another tenant's* generation with no database-level denial. Every other value that decides merchant-visible state in this codebase is RLS-protected; this one would not be. R-137 (“RLS / tenant context weakened to speed bulk ingest”) is nominally addressed for fact tables and silently violated for the value that orders them.
- **no `shopId` immutability trigger** and no composite-unique tenant identity.
- **a new merchant-domain write through the bootstrap surface**, which the accepted PR 2 / PR 3 architecture deliberately narrows and which the existing architecture audit is built to flag.

§13 requires PR 1–3 compliance for “every new merchant-domain table”; the brief never classifies the counter as merchant-domain, control-plane, or bootstrap, so §13 does not reach it. The review of tenancy therefore has nothing to enforce against.

**Required correction:** classify the counter explicitly and place it accordingly — either (a) a new **merchant-domain** table (`shopId`, `@@unique([shopId, id])`, forced RLS with `USING`/`WITH CHECK`, `shopId` immutability trigger, restricted-runtime privileges, enforcement-manifest entry, cross-shop denial tests), or (b) a **control-plane**-owned counter allocated only by `stocky_control_plane`. Either way, state that the tenant applicator does not widen the bootstrap boundary, and add the table to `scripts/tenant-enforcement/manifest.ts` planning inventory. Do not leave a merchant-state-deciding value on a bootstrap-exempt, non-RLS row.

**Missing tests:** cross-shop read/write of the generation denied in real PostgreSQL; architecture audit still fails on bootstrap merchant access after the change.

---

#### F-CLAUDE-PR5PLAN-03 — P1 — The absence sweep rests on a bulk-result completeness guarantee Shopify does not publish

**Affected brief sections:** §6.F.2 (`ABSENT_FULL_SYNC_SWEEP` “authoritative”), §6.F.5 (“If a **COMPLETE** full sync's JSONL **contains** GID X…”), §6.F.9, §8.5, §9, Races B/C/I/K.

**API evidence:** the official bulk-operations guide (`https://shopify.dev/docs/api/usage/bulk-operations/queries`, accessed 2026-08-14) documents query restrictions, JSONL structure, `__parentId`, parent-before-child ordering, 7-day signed-URL expiry, `partialDataUrl`, and per-shop concurrency. It contains **no statement of snapshot isolation, point-in-time consistency, or completeness relative to a submission instant.** `BulkOperation` exposes only `status`, `objectCount`, `rootObjectCount`, `url`, `partialDataUrl`, `errorCode` — nothing that certifies the extraction covered every extant object. A targeted Shopify docs search for bulk-result consistency/snapshot semantics returned only these field definitions.

**Concrete failure mode:** the brief correctly treats presence as sound (`JSONL contains X ⇒ X existed`). It then uses the **converse** — `X absent from a COMPLETED extraction ⇒ X did not exist in the epoch` — as authoritative existence evidence sufficient to tombstone. That converse is a strictly stronger claim and is unsupported. If Shopify's extraction is a cursor walk over a mutating dataset (nothing documents otherwise), an object that is *modified* while the walk is in flight can be missed even though it existed for the entire run.

The brief's own guards do not cover this. Race B protects only rows created **after** the fence, via `existenceObservationGen > R.fenceGeneration`. A long-lived product that was never individually refetched has `existenceObservationGen IS NULL` or `<= fenceGeneration`, satisfies `lastSeenFullSyncRunId IS DISTINCT FROM :epochId`, and is tombstoned by the §6.F.9 `UPDATE`. Merchant impact: the product/variant/location disappears from canonical facts and from the compatibility projections (Buying Table, barcode lookup, today's `InventorySnapshot`) until the next full sync or an unrelated webhook happens to touch it — a silent catalog hole, produced by a run the system reports as `SUCCEEDED` and `HEALTHY`.

Severity is P1 rather than P2 because the brief presents this as *authoritative* existence evidence (`existenceKind = ABSENT_FULL_SYNC_SWEEP`, §6.F.2 “When it is authoritative”) and because the sweep is unbounded — a single anomalous extraction can tombstone an arbitrary fraction of a shop's catalog in one statement.

**Required correction:**
1. State plainly in §6.F.2/§6.F.9 that bulk-extraction completeness is an **engineering assumption**, not an official Shopify guarantee, and record it as a risk alongside R-144.
2. Bound the blast radius: require a per-epoch absence threshold (absolute and proportional) above which the sweep **aborts**, opens a `DataIssue`, and tombstones nothing.
3. Downgrade sweep absence from single-epoch authority to one of: (a) confirmation by a direct authoritative existence query (§6.F.2 handles) before writing `ABSENT_FULL_SYNC_SWEEP`, or (b) absence in **N consecutive complete epochs**. Option (a) is bounded by the anomaly rate, not by catalog size, and is compatible with the rest of §6.F.
4. Keep `ABSENT_CONFIRMED_QUERY` as the only single-observation absence authority.

**Missing test:** a synthetic complete JSONL that omits a GID Shopify still returns live must **not** produce a canonical tombstone; sweep aborts and raises a `DataIssue` when epoch absence exceeds the configured threshold.

---

#### F-CLAUDE-PR5PLAN-04 — P1 — Inventory-level canonical identity is contradictory and no unique constraint is declared

**Affected brief sections:** §6 (“tenant-leading unique identity `@@unique([shopId, shopifyGid])`”), §6.E (“inventory-level GID (identity)”), §6.F.2 (lock on `(shopId, inventoryItemGid, locationGid)`), §6.F.6, §10.3.

**API evidence:** the official `inventory_levels/connect` sample GID is `gid://shopify/InventoryLevel/24826418?inventory_item_id=271878346596884015` — a composite-shaped identifier, not an opaque key. The official `inventory_levels/disconnect` payload is `{ inventory_item_id, location_id }` with **no GID at all** (verified verbatim).

**Concrete failure mode:** the brief simultaneously declares the level GID as identity (§6.E) and locks/keys on `(shopId, inventoryItemGid, locationGid)` (§6.F.2, §6.F.6), and never declares a unique constraint for the pair. Two ingestion paths therefore produce two different keys:

- the inventory-level bulk (§8.2) yields rows carrying a level GID;
- the disconnect path (§10.3) has only item + location and is explicitly forbidden to “invent a new level GID”.

With `@@unique([shopId, shopifyGid])` as the only tenant identity, the disconnect/reconnect path cannot deterministically locate the bulk-created row, and a reconnect-then-refetch can insert a **second** row for the same `(item, location)`. Quantities for the eight states then diverge across duplicates; `SELECT … FOR UPDATE` on a non-unique tuple locks an indeterminate row set; the presence marker and absence sweep operate on one duplicate while reads see the other. Reconciliation cannot converge because there is no single canonical row.

**Required correction:** declare in §6.E that the canonical inventory-level identity is `@@unique([shopId, inventoryItemGid, locationGid])`; that the InventoryLevel GID is a **non-identity attribute** persisted for lineage only; that presence markers, existence observations, per-name quantity freshness, and row locking all key on the pair; and that no path may create a row keyed only by level GID.

**Missing test:** bulk-created level followed by a disconnect signal (item+location only) followed by reconnect resolves to exactly **one** row; no duplicate `(shopId, itemGid, locationGid)` can be created by any ingestion path.

---

### P2 — significant architecture / scale / reliability issues

#### F-CLAUDE-PR5PLAN-05 — P2 — “Checkpoint in the same transaction as the fact batch” is not available under the accepted two-role architecture, yet is stated as the primary rule

**Affected sections:** §8.3, §16 D2, Race E.

**Evidence:** `SyncRun` is `platform_control_plane` with `expectedRuntimePrivileges: []` (`manifest.ts:726-734`) and `REVOKE ALL … FROM stocky_runtime` (`roles.ts:867-878`); the control plane is a separate client on `DATABASE_CONTROL_PLANE_URL` (`control-plane-db.server.ts:13-43`). Fact tables are merchant-domain, written by the restricted runtime role under transaction-local tenant context.

**Failure mode:** `jsonlCommittedLineOrdinal` lives on `SyncRun`. No transaction can contain both it and a merchant fact batch. The brief offers “or by a proven equivalent” — but by naming the impossible option **first**, it invites an implementer to obtain atomicity by granting the runtime role DML on `SyncRun`, or by writing facts on the control-plane connection. Either regresses R-102 (control-plane role isolation, closed under D-052) and R-137 (do not weaken RLS for bulk ingest). This is precisely the “unsafe architecture becoming implementation authority” outcome this review exists to prevent.

**Required correction:** remove the same-transaction option. Specify the two-phase rule as the only path: facts commit with an `ingestBatchId` on the runtime connection; the control-plane connection then advances `jsonlCommittedLineOrdinal` to that batch; on resume an orphan committed batch is acknowledged without skipping uncommitted lines. State explicitly that merchant fact writes and control-plane checkpoint writes are on different roles and connections and must never be co-transacted.

**Missing test:** the runtime role is denied DML on `SyncRun` (already covered by PR 4 role-isolation suites — the brief should cite it as a regression gate for PR 5).

---

#### F-CLAUDE-PR5PLAN-06 — P2 — `DataIssue` / `SyncHealth` are specified as if atomic with fact decisions, but are control-plane-only

**Affected sections:** §6.F.4 rule 4, §6.F.6 steps 4/6, §6.F.8 (“Degraded honesty … **not** a silent success”), §7 projection-failure table, §8.4.

**Evidence:** `DataIssue` and `SyncHealth` are `platform_control_plane` with `expectedRuntimePrivileges: []` (`manifest.ts`, control-plane block); same revoke and same separate connection as above.

**Failure mode:** every “this is visible, not silent” guarantee in §6.F and §7 is carried by a `DataIssue` written on a different connection from the fact decision it describes. A crash between the two produces exactly the silent state the brief forbids: a `DEGRADED` attribute applied with no open `CATALOG_ATTRIBUTE_VERSION_DEGRADED`; an `EQUAL_VERSION_CONFLICT` no-op with no scheduled refetch; a failed projection with healthy-looking compatibility state. The inverse also occurs — an issue recorded for a fact transaction that rolled back.

**Required correction:** state the connection/role for diagnostics writes. Make the **durable** signal a column on the merchant fact row (`attributeFreshnessState` already is — extend the same treatment to stale-signal and existence-check-failure state), and define `DataIssue` as a **derived, reconcilable** projection of fact-row state with a bounded reconciler that opens missing issues and closes orphans. Do not rely on cross-connection ordering for a correctness-visible guarantee.

**Missing test:** kill between fact commit and `DataIssue` write → reconciler restores the issue; no fact row can remain `DEGRADED` with no corresponding open issue after reconciliation.

---

#### F-CLAUDE-PR5PLAN-07 — P2 — `existenceObservationGen` orders commits, not observations; the brief defines it as ordering observations

**Affected sections:** §6.F.1 clock-B row, §6.F.2, §6.F.7, §6.F.9, Races C/I/J.

**Evidence:** §6.F.2 requires the generation to be “allocated **after** the Shopify existence result is known, **before** the fact write”, while §6.F.1 defines clock B as “When **this app completed** an authoritative Shopify check” and §6.F.2 defines `existenceObservedAt` as “the app UTC time **when that Shopify check completed**”. Allocation at write time and observation at response time are different instants; `existenceObservationGen` and `existenceObservedAt` are therefore **not consistent with each other**.

**Failure mode:** a refetch whose Shopify response arrived early but whose write is delayed (queue latency, lock wait, retry) allocates a **higher** generation than a competing observation with strictly newer Shopify evidence. Concretely, against the sweep: the sweep confirms ABSENT at `gen = fenceGeneration`; an in-flight refetch that read Shopify *before* the extraction completed then commits LIVE at `gen > fenceGeneration` and **resurrects a genuinely deleted resource**. Race C covers only the late-**bulk** direction; the late-**refetch** direction is unguarded. The failure is fail-safe in direction (retains rather than deletes) and self-heals at the next full sync, which is why this is P2 and not P1 — but the brief's claim that clock B orders *observations* is inaccurate, and the guarantee tables in §6.F.7/§6.F.9 rest on that claim.

**Required correction:** either (a) reject an existence observation whose `existenceObservedAt` predates the `existenceObservedAt` of the committed observation it would override — a legal clock-B-to-clock-B comparison that the brief's own rules permit — or (b) restate clock B honestly as “commit order of app-issued observations”, document the bounded resurrection window as an accepted self-healing residual, and remove any claim that a larger generation means a later Shopify check.

**Missing test:** slow-refetch-vs-sweep in both directions; an observation with older Shopify evidence must not override newer existence evidence.

---

#### F-CLAUDE-PR5PLAN-08 — P2 — One counter row per shop convoys all fact application and churns the tenant-root row on the authentication hot path; no alternative is evaluated

**Affected sections:** §6.F.2, §6.F.8, §16 C (scale).

**Evidence:** `Shop` is the canonical tenant identity read by the bootstrap/authentication path (`app/tenant/bootstrap.server.ts`) on every authenticated admin request and by control-plane dispatch enumeration. The brief requires an increment on every direct authoritative refetch (existence) and every null-version direct refetch (attributes), taken while holding the `(shopId, identity)` row lock.

**Failure mode:** at the R-034 envelope (50k variants × 15 locations = 750k states, plus webhook and reconcile traffic), all catalog and inventory fact application for a shop serializes on a single `Shop` row. Every increment creates a new row version; HOT churn and bloat on `Shop` degrade the tenant lookup that gates every admin request. A slow apply transaction that holds the identity lock and then touches `Shop` extends the convoy to every other identity in that shop. PR 4 spent D-050/D-051 and R-127 removing exactly this class of convoy from the readiness path; PR 5 would reintroduce a per-shop one.

**Required correction:** record an explicit evaluated decision among:
- a PostgreSQL **sequence** — monotonic, no row contention, gaps irrelevant to a generation;
- a **dedicated per-shop counter table** separate from `Shop` (also resolves F-CLAUDE-PR5PLAN-02);
- incrementing **outside** the identity lock.

Additionally state two constraints the brief currently omits:
1. **No merchant-domain or `Shop` row lock may be held across a Shopify network call.**
2. The counter column must never participate in a key or unique index, so `Shop` updates remain `FOR NO KEY UPDATE` and stay compatible with the `DispatchReadyShop` → `Shop` foreign key's `FOR KEY SHARE` (`prisma/schema.prisma`, `DispatchReadyShop.shop` `onDelete: Restrict`).

**Missing test:** concurrent multi-identity apply for one shop does not serialize beyond the documented bound; `Shop` update volume per full sync has an explicit ceiling.

---

#### F-CLAUDE-PR5PLAN-09 — P2 — Absence-sweep isolation level and its interaction with the per-identity apply lock are unspecified

**Affected sections:** §6.F.9 (illustrative `UPDATE`), §6.F.2 (`SELECT … FOR UPDATE` per identity), §8.5.

**Failure mode:** the sweep is correct **only** under READ COMMITTED, where PostgreSQL re-evaluates the `existenceObservationGen <= :fenceGeneration` predicate after blocking on a row lock held by a concurrent apply (EvalPlanQual). Under REPEATABLE READ the same statement raises a serialization failure; under a naive retry against a stale snapshot it can tombstone a row that just committed LIVE. PR 4 already runs `RepeatableRead` transactions in the sync path (`NEW-CLAUDE-D045-02: RepeatableRead transaction option` — CI step 72), so an implementer has a live precedent for the wrong isolation level. The brief states neither the level nor the mechanism it depends on.

**Required correction:** state READ COMMITTED for the sweep; state that predicate re-evaluation after row-lock release is the relied-upon mechanism; forbid running the sweep inside a REPEATABLE READ/SERIALIZABLE transaction; specify retry semantics if one is used anyway.

**Missing test:** a LIVE refetch committing during the sweep is not tombstoned; the sweep does not abort under concurrent apply.

---

#### F-CLAUDE-PR5PLAN-10 — P2 — “Safety revival” of a terminal GID is unbounded and sits in tension with the brief's own terminality claim

**Affected sections:** §6.F.6 (“structurally terminal” + “safety revival”), §6.F.7, Race J.

**API evidence:** official `productDelete` documents deletion as irreversible. Shopify documents **nothing** about a deleted GID subsequently returning non-null, and nothing about GID reuse. The brief correctly refuses to claim otherwise — and then permits revival on any single later LIVE observation.

**Failure mode:** if `product(id:)` (or `inventoryItem(id:)` / `location(id:)`) returns non-null transiently after a confirmed delete — replication lag, cache, partial outage — a single observation clears a confirmed tombstone and reattaches subsequent state to a dead identity. Because the brief simultaneously asserts terminality, downstream consumers may reasonably treat a tombstone as final; a revived tombstone violates that expectation silently.

**Required correction:** bound the revival — require either two consecutive independent LIVE confirmations, or an identity check that the revived resource's `shopifyCreatedAt` matches the tombstoned row's; open a `DataIssue` on **every** revival of a terminal resource type; state explicitly that revival is a safety valve, not an expected path. The reconnectable inventory-level relationship is correctly exempt from this and should stay so.

**Missing test:** single transient LIVE response after `ABSENT_CONFIRMED_QUERY` does not silently clear the tombstone without the required confirmation and `DataIssue`.

---

#### F-CLAUDE-PR5PLAN-15 — P2 — The write-mutation scanner list omits `inventoryBulkToggleActivation`, the one mutation the brief itself puts in front of the implementer

**Affected sections:** §12 (forbidden names, scanner requirement), §6.F.6 (cites `inventoryBulkToggleActivation` as API evidence).

**Evidence:** §6.F.6 cites `inventoryBulkToggleActivation` to justify that inventory-level connectivity is reconnectable. §12's forbidden list is `inventoryAdjustQuantities`, `inventorySetQuantities`, `inventoryMoveQuantities`, `inventoryActivate`, `inventoryItemUpdate`, product/variant mutations, transfer mutations, cost writes. **`inventoryBulkToggleActivation` and `inventoryDeactivate` are absent from that list.** `app/services/shopify-sync.server.ts:106-117` shows write helpers already colocated with ingest in the current codebase.

**Failure mode:** a scanner built from §12's enumeration would not fail on `inventoryBulkToggleActivation` — the exact symbol the brief hands the implementer as “evidence”. This is the failure mode the review mandate names directly: citing a mutation as API evidence must not let it enter implementation. PR 4 already learned this lesson as R-110 (“Control-plane inventory scanner blind spots — hand-maintained inventory list; planted surfaces passed CI”), closed only by replacing enumeration with a compiler-API semantic scanner plus negative fixtures.

**Required correction:** add `inventoryBulkToggleActivation` and `inventoryDeactivate` to §12's forbidden list, and — more importantly — require the PR 5 scanner to be **deny-by-default** over Shopify mutation names in fact modules (any `inventory*`, `product*`, `productVariant*`, `inventoryItem*`, transfer, or cost mutation), with negative fixtures, rather than a hand-maintained allowlist. Cite R-110 as the precedent.

**Missing test:** negative fixture planting `inventoryBulkToggleActivation` in a PR 5 fact module fails the scanner.

---

### P3 — nonblocking quality / documentation

#### F-CLAUDE-PR5PLAN-11 — P3 — `products/delete` payload description is inaccurate

§10.1 states “Official `products/delete` sample payload is `{ "id": … }` only”. The official 2026-07 sample is `{ "id": 632910392, "published_scope": "web", "admin_graphql_api_id": "gid://shopify/Product/632910392" }` — the **GID is present**. The error is conservative (it understates available identity) but the brief is cited as implementation authority for identity mapping. Correct the description. (By contrast the `inventory_levels/disconnect` claim — `{ inventory_item_id, location_id }` with no GID — is exactly right and correctly drives §10.3's item+location mapping.)

#### F-CLAUDE-PR5PLAN-12 — P3 — Variant `mediaUrl` is mandated in §6.B but deferred in §8.2

§6.B lists `mediaUrl` as a required `ShopifyVariantFact` field sourced from non-deprecated `media`; §8.2 says that if `media` would exceed bulk depth, PR 5 persists product `featuredMedia` and defers extra media. `ProductVariant.media` is a connection, so `products → variants → media` is a third connection level and a fourth connection — over the officially verified two-level nesting limit. §8.2's resolution is the correct one; §6.B should be amended to state that PR 5 persists product featured media (variant-level media deferred), so §6.B cannot be read as an acceptance criterion that §8.2 forbids.

#### F-CLAUDE-PR5PLAN-13 — P3 — `currentBulkOperation` replacement guidance is incomplete

§8.1 quotes the official deprecation (“Use `bulkOperations` with status filter instead”) and then mandates lookup only via `bulkOperation(id:)` / `node(id:)`, with `currentBulkOperation` forbidden by search gate. Both `bulkOperations` (plural, status-filtered) and `bulkOperation(id:)` are officially supported on 2026-07, and GID binding is the stronger rule given five concurrent operations per shop. The brief should say that `bulkOperations` is officially acceptable and is being **deliberately rejected** in favour of persisted-GID binding, so the forbidden-symbol gate is not read as contradicting the official notice.

#### F-CLAUDE-PR5PLAN-14 — P3 — Shop currency read is not bound to the amounts it stamps

§8.6 reads `shop { currencyCode }` once per catalog-sync and §6.B stamps variant `Money` amounts with it. If the shop's currency changes between runs, rows carry mixed currency provenance with no record of which observation produced which stamp. Add: persist the currency with the amount (already required) **and** record the observation/run that produced it; state that a detected currency change requires a full re-stamp rather than incremental drift.

---

## 6. Mandatory adversarial areas A–M — explicit assessment

| Area | Assessment |
|---|---|
| **A. Three-clock model** | **Sound in principle; correctly separated in the document.** I attempted to break it and found **no** surviving cross-clock comparison in §6.F: attributes decide on clock A only; existence on clock B only; clock C is lineage only. The forbidden-key list and hard-rule list are complete and correct, and the un-tombstone rule correctly refuses `updatedAt` vs local tombstone time. The model's defect is not cross-clock leakage but **clock B's internal definition** — it is defined as observation order and implemented as commit order (**F-CLAUDE-PR5PLAN-07**). Revival/deletion ambiguity is otherwise resolved. Verdict: **model accepted, clock-B semantics require correction.** |
| **B. Shop-scoped generation counter** | **Not safely implementable as written.** Atomic allocation pattern: **not specified** (F-01). Concurrent duplicate generations: **possible** under the likely implementation orderings (F-01). Shop-wide contention: **real and unevaluated** (F-08). Sequence/advisory alternatives: **not considered** (F-08). Allocation before/after the Shopify call: stated for refetch (after), **ambiguous for the fence** — the brief permits a reading that holds the `Shop` row lock across `bulkOperationRunQuery` (F-01/F-08). D-051 transaction-shape invariant: **not violated** — the applicator is a single-shop writer and the sweep is a single-shop single statement; readiness triggers fire on control-plane writes on a different connection. New PR 4 readiness/dispatcher coupling: **none introduced.** Deadlock: no new cycle identified provided the counter column stays out of every key/unique index (stated as a required correction). |
| **C. Full-sync fence semantics** | **The weakest area of the plan.** A `BulkOperation` does **not** represent a documented snapshot at submission time — Shopify publishes no consistency semantics (§3, verified). Records in the JSONL **can** reflect post-fence changes; a post-fence create **can** appear; a deleted resource **can** still appear. For **presence** and for **null-version attribute fallback**, `fenceGeneration` remains safe: both are conservative (presence only ever preserves; a fence-generation attribute observation can only lose to a later generation). For **absence**, the fence is **not** sufficient, because the load-bearing inference is completeness, not ordering (**F-03**). Races A–O are individually well constructed and, with F-03/F-07 corrected, achievable — but Race B/C/I as written verify the *fence comparison*, not the *completeness assumption*, and so cannot detect the failure in F-03. Verdict: **“fence” terminology is acceptable for ordering; it must not be used to license single-epoch absence authority.** |
| **D. Full-sync presence markers** | **Correct and well specified.** The corrected rule (`lastSeenFullSyncRunId = epochId` for every observed GID even when attributes no-op) is right, is bounded-memory (column per streamed line, no in-process GID set), and directly closes R-150. Transaction atomicity: presence marker, lineage, attribute decision, and existence decision are all merchant-domain writes inside one `(shopId, identity)` transaction — **implementable** (unlike the checkpoint, F-05). Duplicate JSONL lines and re-stream from byte 0 converge idempotently. Parent-before-child ordering is officially confirmed. Crash/restart is safe given the two-phase checkpoint. Stale bulk attributes **cannot** downgrade existence — explicitly stated. Verdict: **accepted.** |
| **E. Absence tombstones** | Correct against concurrent webhook refetch (given F-07/F-09 corrections), delayed delete signals, reconnects, newly created resources, full-sync retries, stale epochs, and failed/partial bulk (`FAILED`/`CANCELED`/`partialDataUrl` all forbidden — §6.F.9 preconditions 1–6 and §8.4 are strict and correct). Uninstall/disabled-shop is fail-closed by inheritance from PR 4. The deletion-vs-newer-LIVE race is handled by the generation predicate **and** by READ COMMITTED predicate re-evaluation — the latter is relied upon but unstated (**F-09**). The unresolved defects are the completeness assumption (**F-03**) and the absence of any blast-radius bound. Verdict: **structurally sound, two corrections required.** |
| **F. Delete / disconnect existence check** | **Officially valid.** All five proposed handles verified on 2026-07: `product(id:)`, `productVariant(id:)`, `inventoryItem(id:)`, `location(id:)` all exist and return nullable types, so a completed query returning null **is** a legitimate absence signal; `inventoryItem(id:).inventoryLevel(locationId:, includeInactive: true)` exists with exactly that argument and nullable return, and is the right handle given the disconnect payload carries no GID; `inventoryLevel(id:)` exists for the known-GID case. Permission/transport errors are correctly excluded from absence (§6.F.2, §6.F.6 step 6, Race N). Location deletion vs deactivation is correctly separated (§9). Product-deletion terminality is accurately sourced but over-extended into an unbounded revival path (**F-10**). Inventory-level reconnectability is correctly asserted and officially supported. Verdict: **queries and semantics accepted; terminality/revival needs bounding.** |
| **G. Nullable version fallback** | **Correct and complete.** Real Shopify `updatedAt` takes precedence in every branch (commit rules 1–3); null → non-null transition works; non-null → incoming null **cannot** regress (rule 3, with `CATALOG_NULL_VERSION_OBSERVATION`); two null direct refetches are ordered by `>` on the generation under the identity lock (rule 4); a delayed null-version bulk observation cannot override a newer direct refetch because bulk uses `fenceGeneration`; no fabricated claim of Shopify ordering is made — the brief is explicit that the generation orders app observations, not mutations; the infinite-no-op trap is explicitly forbidden and a direct refetch must be able to update; DEGRADED is meaningful and recoverable (clears only when a real Shopify timestamp is stored). The `InventoryQuantity.updatedAt` nullability that motivates all of this is **officially verified**. Only defect: DEGRADED's visibility guarantee depends on a cross-connection `DataIssue` (**F-06**). Verdict: **accepted.** |
| **H. Bulk query validity** | **Both proposed documents are valid under the officially verified rules.** Catalog bulk `products { variants { inventoryItem { … unitCost } } collections { id title } }`: 3 connections (`products`, `variants`, `collections`) ≤ 5; nesting depth 2 ≤ 2; `inventoryItem` is a field, not a connection; no top-level `node`/`nodes`; all connections implement `Node`. Inventory-level bulk `inventoryItems { inventoryLevels(includeInactive: true) { … quantities(names: [...]) } }`: 2 connections; depth 2; `quantities` is a list field, not a connection; root `inventoryItems` exists with optional `query`. `groupObjects` must stay `false` — argument, default, and official rationale all verified. Splitting catalog from inventory levels is required and correctly chosen. `__parentId` mapping and parent-before-child ordering are officially confirmed. The one loose end is variant `media` (**F-12**, P3). Verdict: **implementable as proposed.** |
| **I. unitCost permission isolation** | **The strategy is plausible but the brief's own preconditions are not met, and it says so — inadequately.** Official docs confirm the permission requirement verbatim but do **not** state whether an unauthorized `unitCost` selection fails at `bulkOperationRunQuery` creation, fails the whole operation at runtime, or returns field-level null/errors per row. The brief's steps 1–3 (“if the field is null … if Shopify returns a field-level access error, retry/continue **without** `unitCost` for that shop/run”) already contain the fallback, and step 3's “retry without unitCost” covers the query-creation-failure case in substance. However the brief never states that the behaviour is **unverified**, and never requires a **capability preflight** before the expensive bulk submit — so an implementation could burn a full bulk cycle per shop discovering it. This is a documentation/sequencing gap on top of an otherwise safe design, not a correctness defect: `FEATURE_COST_SYNC` stays OFF, no cost is ever written, and the sync completes without cost. Recorded as part of the corrections under **F-CLAUDE-PR5PLAN-13's** neighbouring guidance rather than as a separate finding; the required addition is one sentence in §6.C: *“Field-level permission behaviour for `unitCost` inside bulk operations is not documented by Shopify; implementation must determine it by a cheap capability preflight (a single non-bulk `inventoryItem { unitCost }` read) before submitting the catalog bulk, and select the no-cost query variant when the preflight is denied.”* Verdict: **strategy accepted with a required preflight clause; do not assume isolation works.** |
| **J. PR 4 control-plane fit** | **Fits, with two boundary defects.** `catalog-sync-v2` payload schema, new webhook sources on `TENANT_JOB_SOURCES`/`JOB_SOURCE_BY_NAME`, new sanitizers, `inventory-state-reconcile` as `REBUILDABLE_IDEMPOTENT`, `ATOMIC_APPLICATION_RECEIPT` for resource webhooks, and `SyncRun` additive columns are all **additive** against the inspected code and invent no unsupported states. Envelope v3 needs no major bump (allowlist only) — confirmed. R-122/R-123 posture is explicitly preserved and no fair-dispatch/readiness redesign is proposed. Unknown topics and unknown job types already fail closed. The two defects are the cross-role/cross-connection assumptions in **F-05** (checkpoint) and **F-06** (DataIssue/SyncHealth), plus the counter placement in **F-02**. Verdict: **compatible; three boundary corrections required.** |
| **K. Scale / cost** | One shop generation counter: **convoy risk, unevaluated (F-08).** Per-GID row locks: acceptable — single-shop, short, no network I/O held (once F-08's explicit prohibition is added). Set-based absence sweep: bounded-memory and correct, but **unbounded in blast radius (F-03)**. Streaming batch size (≤500 rows/tx, configurable) and O(batch) memory: appropriate. Compatibility projection: correctly isolated and rebuildable. Inventory reconcile: correctly refuses per-item polling, requires bulk/sharded extraction, respects the officially verified five-concurrent-bulk limit and PR 4 fair claim, and correctly treats 60 minutes as a pre-production hypothesis rather than product law. Trajectory to 50k variants / 15 locations / 750k states: **nothing in the chosen architecture is inherently incapable**, provided F-08 is resolved; full certification correctly remains PR 8 / R-034. Verdict: **no obviously non-scaling choice except the single-row counter.** |
| **L. Tenancy** | Composite FKs, RLS, `shopId` immutability, restricted runtime role, tenant-bound bulk ingest, tenant-context raw SQL sweep, no privileged shortcut, and “do not weaken RLS to simplify bulk ingest” are all correctly required for the new **fact** tables, and the SyncRun control-plane boundary is correctly preserved. **The single gap is decisive and is exactly the item the review mandate flags — “Shop counter ownership / tenancy” is named as a review question and never answered (F-02).** The counter is the one value that decides merchant-visible existence and it is the one value with no declared classification and no RLS. Verdict: **tenancy contract correct for fact tables; unresolved for the ordering counter.** |
| **M. Write safety** | **PR 5 can be structurally read-only, and the brief is close to enforcing it.** No inventory, product, transfer, or cost mutation is in scope; `inventoryBulkToggleActivation` appears only as cited evidence; every inventory-write flag stays DEFAULT OFF; existing gated helpers stay untouched; a dedicated `admin-read` boundary and a mutation-name scanner are required; §4 explicitly forbids extending or activating `adjustShopifyInventory` and the transfer helpers. The single defect is that §12's enumeration omits the very mutation §6.F.6 cites (**F-15**), repeating the R-110 hand-maintained-inventory failure mode. Verdict: **write-safety boundary sound; scanner specification must become deny-by-default.** |

---

## 7. R-129 … R-151 assessment

All 23 risks are recorded in `RISK_REGISTER.md` as **OPEN — PR 5 planning (D-053)**, none is claimed closed by planning approval, and each carries evidence, a mitigation, and a follow-up. That posture is correct. Per-risk:

| Risk | Assessment |
|---|---|
| R-129 partial/failed bulk as success | **Adequately mitigated in plan.** §8.4 chooses (a); §6.F.9 preconditions and §8.5 forbid watermark advance and absence sweep. Correct. |
| R-130 recreation merged by SKU/barcode/title | **Adequately mitigated.** GID identity, tombstones, explicit “no unique index on `(shopId, sku)` / `(shopId, barcode)`”. Correct. |
| R-131 permanently stale inventory states | **Adequately mitigated.** Officially verified non-webhook states; refetch all eight names; configurable-freshness reconcile. Correct. |
| R-132 unitCost permission aborts sync | **Partially mitigated.** Isolation strategy is sound but rests on undocumented field-level bulk behaviour; needs the capability-preflight clause (area I). |
| R-133 forecast/ABC coupling | **Adequately mitigated.** §11 isolation is explicit, verified against `webhook-processor.ts:7,265,275`, and correctly framed as decoupling rather than a Phase 2 formula change. Correct. |
| R-134 deprecated `currentBulkOperation` | **Adequately mitigated.** Persisted GID + `bulkOperation(id:)` + search gate; deprecation officially verified. See P3 F-13 for completeness only. |
| R-135 unbounded JSONL / per-row apply | **Adequately mitigated.** Streaming, O(batch) memory, batch upserts, explicit anti-patterns, memory and write-count ceilings in §16 C. Correct. |
| R-136 `first: 50` location cap | **Adequately mitigated.** Complete pagination required; >50-location acceptance test; explicitly refuses “used bulk so pagination was skipped”. Correct. |
| R-137 RLS weakened for bulk ingest | **Mitigated for fact tables; NOT mitigated for the ordering counter (F-02), and actively pressured by F-05** (the same-transaction checkpoint invites granting the runtime role control-plane DML). Requires correction. |
| R-138 accidental Shopify writes (P0) | **Mostly mitigated; scanner enumeration incomplete (F-15).** No write path is introduced; severity of the residual is P2, not P0. |
| R-139 lossy money | **Adequately mitigated.** Exact source string → `NUMERIC`; currency persisted; non-binary-safe round-trip tests required; `Money` vs `MoneyV2` vs `Decimal` distinctions officially verified; weight correctly excluded from money paths. Correct. |
| R-140 expired result URL as success | **Adequately mitigated.** 7-day expiry officially verified; new BulkOperation required; old run never `SUCCEEDED`. Correct. |
| R-141 bulk connection/nesting limits | **Adequately mitigated and independently re-derived** (area H). Both documents are valid. |
| R-142 legacy duplicate authority | **Adequately mitigated as a tracked residual.** Cleanup correctly deferred out of PR 5 with a named trigger condition. Correct. |
| R-143 stale full-sync overwrites newer attributes | **Adequately mitigated.** Clock A + per-identity `FOR UPDATE` + presence marker independence. Correct. |
| R-144 sweep tombstones newer-existence resource | **Partially mitigated.** The generation predicate correctly handles the *post-fence-observation* case (Race B). It does **not** address the *completeness* case (**F-03**), which is the residual failure path for this exact risk. R-144's mitigation text should be extended. |
| R-145 silent stale compatibility projection | **Partially mitigated.** §7's contract is strong and correct in intent (isolation, rebuildability, dual health, explicit merchant-facing claim limits), but its visibility guarantee depends on cross-connection `DataIssue`/`SyncHealth` writes (**F-06**). |
| R-146 JSONL resume assumes HTTP Range | **Adequately mitigated.** Independently verified that the official guide documents no Range support; re-stream from byte 0 is the correct conservative rule; checkpoint-never-ahead-of-facts is right. Correct. |
| R-147 reconcile amplification | **Adequately mitigated.** Configurable freshness target, bulk/sharded extraction, coalescing, five-bulk concurrency respected, fair-claim starvation addressed, cadence deferred to PR 8/R-034. Correct. |
| R-148 cross-clock comparison | **Adequately mitigated.** No surviving cross-clock comparison found (area A). Correct. |
| R-149 stale delete/disconnect false tombstone | **Adequately mitigated.** Signal → authoritative check → live means no tombstone + `DataIssue`; confirmed absent tombstones with an existence observation; query failure is never deletion. Officially valid handles. Correct. |
| R-150 stale-attribute no-op suppresses presence marker | **Adequately mitigated.** Presence marker is unconditional on containment in a complete epoch (area D). Correct. |
| R-151 nullable `updatedAt` leaves facts stale/unordered | **Adequately mitigated.** §6.F.8 is complete and internally consistent (area G). Correct. |

**Register completeness gap:** the risk set does **not** contain an entry for (a) the bulk-completeness assumption (F-03), (b) the generation-counter placement/atomicity (F-01/F-02), or (c) the cross-role atomicity boundary (F-05/F-06). Three new planning risks should be recorded when the brief is corrected.

---

## 8. Contradictions and unsupported assumptions

1. **Unsupported — bulk-result completeness.** “A GID absent from a COMPLETE extraction was absent in that epoch” is presented as authoritative existence evidence; Shopify publishes no such guarantee (F-03).
2. **Contradiction — clock B definition vs allocation point.** §6.F.1/§6.F.2 define clock B as *when the Shopify check completed*; §6.F.2 allocates the generation at *write time*. `existenceObservedAt` and `existenceObservationGen` therefore measure different instants (F-07).
3. **Contradiction — inventory-level identity.** §6/§6.E key on the level GID; §6.F.2/§6.F.6/§10.3 key on `(inventoryItemGid, locationGid)`; no unique constraint is declared for the pair (F-04).
4. **Unsupported — single-transaction checkpoint.** §8.3's primary option cannot exist across the accepted two-role, two-connection architecture (F-05).
5. **Unsupported — atomic “allocated once at bulk submit together with `fenceAt`”.** The two writes are on different roles and connections (F-01).
6. **Contradiction — terminality vs revival.** §6.F.6 calls a confirmed-deleted GID “structurally terminal” and then permits unbounded single-observation revival (F-10).
7. **Contradiction — variant media.** §6.B requires `mediaUrl` from `media`; §8.2 defers it to product `featuredMedia` (F-12).
8. **Contradiction — write-safety scanner.** §6.F.6 cites `inventoryBulkToggleActivation`; §12's forbidden list omits it (F-15).
9. **Inaccuracy — `products/delete` payload** (F-11).
10. **Silent gap — sweep isolation level** relied upon but never stated (F-09).
11. **Silent gap — unitCost field-level bulk permission behaviour** is undocumented by Shopify and the brief does not say so (area I).

**Governance consistency (no contradiction found):** D-053's scope, the “no D-054” instruction, D-052's preserved PR 4 authority, `PROJECT_STATUS.md`, `phases/phase-1/README.md`, Q-002/Q-004 status, R-028/R-029, R-095…R-098, and R-122/R-123 residual carry-forward are mutually consistent across all four modified control documents and the new brief. The Q-004 clarification correctly records a boundary without closing the question. Phase/release boundary (§17) is correct: PR 5 acceptance ≠ Phase 1 complete; PR 6 gated on PR 5 implementation review/merge/closure; PR 8 retains R-034.

---

## 9. Accepted residuals (no correction required for planning approval)

- **R-122 / R-123** — carried forward unchanged from D-052; PR 5 correctly proposes no fair-dispatch or readiness redesign and no static writer-shape guard.
- **60-minute reconcile freshness** — correctly labelled a pre-production engineering hypothesis, explicitly not a merchant promise and not a locked cadence.
- **Legacy duplicate authority (R-142)** — temporary compatibility projections are the right call for PR 5; cleanup correctly deferred with a named trigger.
- **Historical `PHASE_1_TECHNICAL_PLAN.md`** — correctly demoted to context, not authority.

---

## 10. Verdict

Findings: **P0 = 0 · P1 = 4 · P2 = 7 · P3 = 4.**

The planning packet is materially stronger than its predecessors: the three-clock separation is genuinely sound, the nullable-version fallback is complete, the presence-marker rule is correct and bounded-memory, the partial/failed-bulk and Range-free-resume rules are right, the bulk query documents are officially valid, the money rules are correct, and the external Shopify evidence base is accurate to the sentence in all but one payload description. Areas A, D, G, H, and M are approved on the merits.

It is not yet implementation-grade. Four defects would become implementation authority if merged unchanged: the generation counter has no implementable atomic allocation pattern and is placed on a non-RLS bootstrap table; the absence sweep is granted single-epoch authority on an inference Shopify does not support, with no blast-radius bound; and inventory-level canonical identity is self-contradictory with no declared unique constraint. Each of these produces silent, merchant-visible catalog or inventory corruption rather than a visible failure.

**FINAL VERDICT: CORRECTIONS REQUIRED**

**PR 5 IMPLEMENTATION REMAINS NOT AUTHORIZED.**

Production execution remains unauthorized. Inventory writes remain UNAPPROVED. Every inventory-write flag remains DEFAULT OFF. D-052 remains PR 4 technical-acceptance authority. No D-054 is created by this report. PR #24 remains DRAFT and UNMERGED.
