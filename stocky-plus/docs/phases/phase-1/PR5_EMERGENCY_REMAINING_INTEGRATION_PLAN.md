# Phase 1 PR 5 — Emergency remaining integration plan

**Status:** `PLANNING / FIXTURES ONLY — F3 RUNTIME NOT STARTED`
**Product owner:** ChatGPT
**Planning owner:** Cursor
**Independent reviewer (when requested):** Claude Code
**Authority:** D-054 **EFFECTIVE**. D-053 planning remains **ACCEPTED AND MERGED**. Do **not** create D-055.
**Emergency target:** 2026-09-07 operational rescue (calendar pressure does **not** weaken safety gates).
**This document:** execution-ready remaining-work plan and test/fixture map after F2A / F2B / F2C cores.
**This document does not:** implement runtime, begin PR 6, merge F2B/F2C, enable inventory-write flags, access production, or authorize Shopify mutations.

Approved product authority remains `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`. This packet does not change product rules. It names what is already frozen, what is still unwired, and the smallest safe runtime lane that can close PR 5.

---

## 0. Evidence snapshot (inspected 2026-09-02)

Inspected live GitHub + local git. Not inferred from chat summaries.

| Field | Observed value |
|---|---|
| Planning branch | `cursor/pr5-emergency-remaining-integration-plan-b53e` |
| Authorized starting SHA / `origin/main` at branch creation | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| Working tree before edits | clean |
| `origin/main` log tip | `Phase 1 PR5-F2A — canonical Shopify admin read boundary (#29)` |
| F2A PR | [#29](https://github.com/Vedang1998/Stocky/pull/29) **CLOSED / MERGED** at `2026-08-20T11:04:26Z` |
| F2A squash merge | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| F2A post-merge main CI | run [`32362021387`](https://github.com/Vedang1998/Stocky/actions/runs/32362021387), event `push`, head `f65ab4b…`, **SUCCESS** |
| F2A ChatGPT disposition (recorded in F2A report §33) | **ACCEPT PR5-F2A ADMIN READ BOUNDARY** |
| F2A independent S01 verdict | `APPROVE PR5-F2A ADMIN READ S01 CORRECTION` |
| F2B PR | [#31](https://github.com/Vedang1998/Stocky/pull/31) **OPEN / DRAFT / UNMERGED** |
| F2B head | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` |
| F2B merge-base vs current `main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` (**pre-F2A**) |
| F2B exact-head PR CI | run [`32215886401`](https://github.com/Vedang1998/Stocky/actions/runs/32215886401), head `1b72a4c…`, Classify / Heavy / CI Gate **SUCCESS** |
| F2B independent review | first review **CORRECTIONS REQUIRED**; first correction package is on the PR; **no second independent re-review artifact is on the branch** |
| F2C PR | [#30](https://github.com/Vedang1998/Stocky/pull/30) **OPEN / DRAFT / UNMERGED** |
| F2C head | `2d2e8801dd383a778c1237cec4ed068922859cf0` |
| F2C merge-base vs current `main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` (**pre-F2A**) |
| F2C mergeability vs current `main` | GitHub `CONFLICTING` / `DIRTY` |
| F2C exact-head PR CI | run [`32263480615`](https://github.com/Vedang1998/Stocky/actions/runs/32263480615), head `2d2e880…`, Classify / Heavy / CI Gate **SUCCESS** |
| F2C independent review | first review **CORRECTIONS REQUIRED**; re-review **CORRECTIONS REQUIRED** (`F2CC-01`); second correction package is on the PR; **no third independent re-review artifact is on the branch** |
| Production | **NOT AUTHORIZED** |
| Inventory-write flags | **DEFAULT OFF** |
| PR 6 | **NOT STARTED / NOT AUTHORIZED** |

F2B and F2C are **not** merged and **not** ChatGPT-accepted at the time of this packet. “After F2B/F2C” in this document means: after those cores exist as reviewed interfaces. It does **not** mean they are already on `main`.

---

## 1. What is already frozen vs what remains

### 1.1 Closed / frozen cores (do not reopen)

| Slice | Live state | Frozen interface | Explicitly not done |
|---|---|---|---|
| **PR5-F1** | ACCEPTED / MERGED / FROZEN (`7827e535…`, later closeout `5129707…`) | Canonical fact schema, RLS, `stocky_catalog_observation_gen_seq`, `CatalogObservationInFlight`, advisory lock primitives, lock-capacity evaluator, `SyncRun.fenceGeneration` / `fenceAt`, `ingestBatchId` on facts | No ingest, no apply engine, no workers |
| **PR5-F2A** | ACCEPTED / MERGED on `main` (`f65ab4b…`) | `app/lib/catalog-facts/admin-read/**`: executable 2026-07 QUERY documents, complete location pagination, eight quantity names, unitCost preflight, `bulkOperation(id:)` poll by persisted GID, recursive mutation scanner, `item { id }` + `location { id }` on inventory-level bulk shape | No `bulkOperationRunQuery` submit, no JSONL stream, no workers, no `SyncRun` writes |
| **PR5-F2B** | OPEN draft core on PR #31 | `applyCanonicalFacts` / `applyCanonicalFactsWithRetry` under `app/lib/catalog-facts/apply/**`. Consumes **already-authoritative** observations. Universal `pg_advisory_xact_lock`. Tombstone-only ordinary apply. Full-sync presence uses `LIVE_FULL_SYNC_PRESENT` with NULL/NULL existence gens. R-162 safe-integer evaluator in-lane | No Shopify I/O. No JSONL. No webhook adapter. No `SyncRun` checkpoint. No `compatibilityProjectionState` writer. No diagnostic reconciler |
| **PR5-F2C** | OPEN draft core on PR #30 | `projectCompatibilityFromCanonicalFacts` under `app/lib/catalog-facts/compatibility-projection/**`. Separate TenantDb. Cannot roll back canonical facts. No HEALTHY recommendation. Fail-closed unknown `availableQuantity` | No worker wiring. No `compatibilityProjectionState` persistence. No `DataIssue` / `SyncHealth`. `resumeAfterQuarantineCursor` unusable until durable quarantine exists. Does not fence legacy `available ?? 0` |

### 1.2 Remaining PR 5 scope (this is F3)

Everything in the approved brief that is **not** a frozen F1/F2A/F2B/F2C core:

1. Bulk JSONL streaming with bounded memory.
2. `BulkOperation` result ingestion (`url` complete JSONL only; `partialDataUrl` discarded from canonical completion).
3. Canonical apply **batching** of streamed identities (default 32 identities / transaction; lock-capacity envelope).
4. `SyncRun` / cursor / two-phase checkpoint acknowledgement.
5. Webhook authoritative refetch application (signals, not payloads).
6. Full-sync fence / presence completion.
7. Deletion / absence confirmation (candidate + `ABSENT_CONFIRMED_QUERY`, circuit breaker).
8. Inventory-state reconciliation where webhooks are incomplete.
9. Recovery / restart (kill before commit; kill after merchant commit / before control-plane ack; expired URL; no HTTP Range).
10. Compatibility projection **triggering / recovery** and merchant-durable `compatibilityProjectionState`.
11. Merchant-visible health / degraded outcomes (no false `HEALTHY`).
12. Adapter-level adversarial races, including bulk vs webhook overlap.
13. Remaining applicability of **R-157..R-165**.

### 1.3 Still present on current `main` (must be replaced, not extended)

Observed on `f65ab4b…`:

| Defect | Evidence |
|---|---|
| Location cap | `fetchLocations` still `locations(first: 50)` in `app/services/shopify-gql.server.ts` |
| Deprecated bulk poll | `pollBulkOperation` still uses `currentBulkOperation` |
| Full JSONL in memory | `ingestBulkVariantCache` still `response.text()` + `split` |
| Per-row legacy upsert | same ingest loop |
| Webhook `available` as truth | `handleInventoryUpdate` writes `quantityAvailable: inv.available ?? 0` |
| Forecast / ABC coupling | same handler calls `computeForecast` / `lowStockAlert` |
| Catalog job payload | `enqueueCatalogSync` still `catalog-sync-v1` |
| Webhook toml | only `inventory_levels/update` |
| `SyncRun` checkpoint columns | **absent** (`jsonlCommittedLineOrdinal` / dedicated BulkOperation GID column not on schema) |

F3 replaces these on the **canonical** catalog/inventory path. Legacy helpers stay untouched except where the live webhook/catalog worker would otherwise keep writing a second authority.

---

## 2. Lane decision

### 2.1 Recommendation: **one remaining runtime PR**

**Lane name:** `PR5-F3 Catalog / location / inventory integration`

**Why one PR, not parallel lanes:**

- F1/F2A/F2B/F2C interfaces are already the frozen foundation. Remaining work is **wiring those interfaces together**.
- The remaining P1 class is overlap: delayed bulk vs newer refetch, two-phase checkpoint, projection failure after canonical commit, webhook+full-sync first insert (Race AT-3), delayed delete after live refetch.
- Splitting JSONL ingest from webhooks would leave those races untestable until a later PR, which is the opposite of a 2026-09-07 rescue.
- File ownership is coherent: one ingest/worker/checkpoint/health surface. F2A/F2B/F2C cores stay frozen.

**Why not two or three PRs:**

| Rejected split | Why it is unsafe or slower |
|---|---|
| Schema-only PR then workers | The additive `SyncRun` columns have no independent merchant value until the two-phase checkpoint exists. They belong in F3. |
| JSONL/full-sync PR then webhook PR | Races A, B, C, E, H, K, AT-3, X require both adapters in one test corpus. |
| Webhook PR then reconcile PR | Official 2026-07: `committed` / `reserved` / `damaged` / `safety_stock` / `quality_control` do not trigger webhooks. Reconcile is part of inventory-state truth, not a later polish PR. |
| Projection-health PR after ingest | Race F / Z / R-145 are false-HEALTHY defects if ingest lands without durable projection state. |

Cursor must **not** invent a second parallel F3 lane.

### 2.2 Hard preconditions before F3 runtime may start

F3 runtime is **not** authorized by this planning packet. ChatGPT may authorize F3 only after:

1. PR #31 F2B receives independent **re-review** of the first correction package, ChatGPT acceptance, explicit user merge, and post-merge `main` CI on the squash SHA.
2. PR #30 F2C receives independent **re-review** of the second correction package (`F2CC-01`), ChatGPT acceptance, explicit user merge, and post-merge `main` CI on the squash SHA.
3. Both are merged **onto current F2A `main`**, not onto `5129707…`. Observed merge-bases are pre-F2A; GitHub already reports F2C `CONFLICTING`. Shared collision files include `PR2_TENANT_ACCESS_INVENTORY.md` (mechanical regen) and any overlapping `catalog-facts` / CI / lock-capacity bytes.
4. F3 branch is created from the **post-F2B-and-F2C** `origin/main` SHA, recorded in the F3 implementation report before edits.
5. Working tree clean; no D-055; no PR 6.

Recommended merge order after independent re-review: **F2B then F2C**. F3 calls `applyCanonicalFacts` then `projectCompatibilityFromCanonicalFacts`. F2B carries R-162 lock-capacity hardening. F2C carries R-165. Either order is technically possible if ChatGPT serializes merges; do not merge both in parallel.

### 2.3 Internal F3 commit sequence (same PR, not extra PRs)

1. Additive control-plane schema: `SyncRun` BulkOperation GID + `jsonlCommittedLineOrdinal` (+ smallest metadata needed). Envelope / toml / job-type allowlists.
2. JSONL streamer + BulkOperation submit/poll-by-persisted-GID + two-phase checkpoint.
3. `catalog-sync-v2` worker: fence commit, three domain `SyncRun`s, presence apply, absence nomination / confirmation / circuit breaker.
4. Webhook sanitizers + authoritative refetch workers; fence legacy `available ?? 0` and forecast coupling on the canonical path.
5. `inventory-state-reconcile` worker (bulk / complete pagination, not N+1).
6. Compatibility projection trigger, `compatibilityProjectionState` writer, diagnostic reconciler, dual health.
7. Recovery, overlap races, scale/memory fixtures, focused CI steps.

If ChatGPT later judges F3 too large **after** F2B/F2C merge, the only allowable split is still **not** JSONL-vs-webhook. Ask ChatGPT first. Do not split overlap races.

---

## 3. Frozen interfaces F3 must consume (do not fork)

### 3.1 F2A reads

- Direct QUERY helpers in `admin-read/resources.ts`, `locations.ts`, `quantities.ts`.
- Bulk inner documents: `CATALOG_BULK_QUERY_WITH_UNIT_COST`, `CATALOG_BULK_QUERY_NO_UNIT_COST`, `INVENTORY_LEVEL_BULK_QUERY` (already `edges { node }` + inventory-level `item { id }` / `location { id }`).
- `readBulkOperationById` — bind the **persisted** GID. Never `currentBulkOperation`.
- UnitCost preflight chooses with/without-unitCost **before** `bulkOperationRunQuery`.
- Pair identity: do **not** key inventory-level results by the requested pair unless the F2A identity cross-check succeeded. Do not substitute response IDs and continue.
- JSONL `__parentId` is **not** the InventoryLevel uniqueness key. Prefer `item.id` + `location.id` from the line; `__parentId` is a flatten aid only.

F3 **may** add a submitter that calls `bulkOperationRunQuery`. That mutation is **not** an inventory write. It must live **outside** `admin-read/` (F2A forbids wrapping bulk documents in that mutation). F3 scanner must still fail closed on `inventoryBulkToggleActivation` / other inventory-product-transfer mutations (Race AC).

### 3.2 F2B apply

Public contract on PR #31:

```text
applyCanonicalFacts(db, { shopId, observations })
applyCanonicalFactsWithRetry(begin, input)
```

Observation kinds already exist:

- `direct` — token + `[observationRequestGen, observationResponseGen]` mandatory.
- `full_sync` — committed `SyncRun.fenceGeneration`; no per-line token; `LIVE_FULL_SYNC_PRESENT` stores NULL/NULL existence gens.

F3 maps JSONL lines and refetch results into those observations. F3 does **not** reimplement clocks, revival, or lock order.

Batching rule (brief §8.3 / F-CLAUDE-PR5C8-01): JSONL **read** chunk and canonical **apply** transaction are separate. Reader memory bound may exceed 32 parsed rows. One apply transaction default **32** identities, configurable downward, never above lock-capacity evidence. Never split one identity. Never unanchored fallback. Unique conflict retries the **full** apply algorithm (no `ON CONFLICT DO UPDATE`).

### 3.3 F2C projection

```text
projectCompatibilityFromCanonicalFacts({ authority, processingEnabled, mode, identities | cursor, ... })
```

F3 rules:

- Call **after** the canonical tenant transaction commits.
- Open a **new** TenantDb. Projection failure must not `ROLLBACK` canonical facts.
- Read live `Shop.processingEnabled` from the control-plane **immediately before** projection. A cached caller boolean is not production-safe (F2C-12).
- Persist merchant `compatibilityProjectionState` with a **new F3 diagnostic writer** that uses the frozen advisory lock. Do not invent HEALTHY from F2C `status: "SUCCEEDED"` on a bounded page with `hasMore=true`.
- `resumeAfterQuarantineCursor` remains unusable until F3 durably quarantines/repairs the poison identity (F2CC-03 residue).
- Do not treat F1 column default `compatibilityProjectionState = HEALTHY` as merchant-safe. After canonical apply and **before** projection, F3 must set `DEGRADED` (or equivalent not-yet-projected state) so a crash cannot report false `HEALTHY` (Race F / Z / R-145).

### 3.4 PR 4 control plane (do not redesign)

Preserve dispatcher, envelope v3, attempt lifecycle, receipts, dead letters, disabled-shop denial, R-122/R-123 posture, D-051 transaction-shape invariant.

Smallest extensions only (brief §14):

- payload `catalog-sync-v2`
- webhook sources + sanitizers
- `SyncRun` BulkOperation GID + JSONL ordinal
- `inventory-state-reconcile` job type
- reuse `REBUILDABLE_IDEMPOTENT` / `ATOMIC_APPLICATION_RECEIPT` / `CONTROL_ONLY` as already specified

Runtime remains **denied** `SyncRun` DML. Control-plane remains **denied** merchant-fact DML. No cross-role transaction.

---

## 4. Remaining work packages (F3)

### 4.1 Bulk JSONL streaming / bounded memory

**Must:**

- HTTP stream + line reader. No `response.text()` + `split('\n')` of the full body.
- O(batch) memory, not O(catalog). Planning heap ceiling: **256MB** for a multi-hundred-thousand-line fixture.
- Re-stream from byte 0 on resume. **No HTTP Range** unless a later implementation independently verifies official Range support and ChatGPT amends the brief. That verification is **not** in F3.
- Keep only the current parent node in memory (official JSONL: parents before children). Do not materialize `variants[]` for a product.
- Skip already-acknowledged lines **without buffering them**.
- Malformed line: fail the apply unit / mark domain degraded; do not skip silently; do not apply `partialDataUrl`.

**Must not:**

- One GraphQL call per row.
- One DB transaction per row as the steady-state pattern.
- Bind `currentBulkOperation`.

### 4.2 BulkOperation result ingestion

Worker sequence:

1. Control-plane transaction: `SELECT nextval('stocky_catalog_observation_gen_seq')`; persist `fenceGeneration` + `fenceAt`; **COMMIT**.
2. Only then `bulkOperationRunQuery` with F2A inner document; `groupObjects: false`.
3. Persist exact returned GID on that `SyncRun`.
4. Poll `bulkOperation(id:)` using that GID (F2A helper). Also treat `bulk_operations/finish` as a **signal** to refetch that GID, not as JSONL.
5. `COMPLETED` + `url` + no `partialDataUrl` → stream JSONL.
6. `COMPLETED` + `partialDataUrl` and/or missing complete `url` → **no canonical apply, no candidate nomination, no tombstone, no success watermark**. Persist metadata + `PARTIAL_FAILURE` / `FAILED` (Race D / O).
7. `FAILED` / `CANCELED` → same prohibition.
8. Expired URL (7 days): **new** BulkOperation, **new** fence generation, never reuse the burned fence, never mark the old run `SUCCEEDED`.

Five concurrent bulk queries per shop is an official 2026-07 ceiling. F3 must bind each `SyncRun` to its own GID so concurrent ops cannot be confused. Reconcile + catalog + inventory-level bulks must not starve webhook jobs (PR 4 fair claim preserved).

### 4.3 Canonical apply batching

JSONL / page mapper emits `full_sync` observations. Direct refetch mapper emits `direct` observations with in-flight token + interval allocated **before** Shopify I/O and **after** usable response, then lock (Race S).

Apply:

```text
evaluateCanonicalLockCapacity → order identities → applyCanonicalFactsWithRetry
```

Presence (`lastSeenFullSyncRunId`) advances even when Clock A no-ops (Race A / K). Incomplete authoritative attributes on a full-sync line fail the apply unit (F2B P2-01). Direct existing-row incomplete attributes persist `DEGRADED` without advancing attribute clocks.

Shop currency: once per catalog-sync, `shop { currencyCode }` stamped onto Money fields that lack field currency. Currency change requires full catalog restamp, not mixed incremental provenance.

### 4.4 SyncRun / cursor / checkpoint acknowledgement

Additive schema (F3, control-plane, nullable, no backfill):

| Column | Purpose |
|---|---|
| `bulkOperationGid` `VarChar(512)?` | Exact GID. Do not overload `cursorAfter`. |
| `jsonlCommittedLineOrdinal` `Int?` or `BigInt?` | 1-based last **acknowledged** JSONL line. Checkpoint may lag facts; must **never** lead. |

Two-phase only (brief §6.F.11):

1. Runtime/merchant: apply bounded batch; persist `ingestBatchId` on facts; **COMMIT**.
2. Control-plane: advance `jsonlCommittedLineOrdinal`.

Crash between: resume re-streams from 0; idempotently recognizes the orphan batch; acknowledges; continues. Runtime cannot obtain atomicity by DML on `SyncRun` (Race Y).

Domain watermarks (`SyncCursor`) advance only when brief §8.5 holds. Locations, catalog, and inventory_levels watermarks are independent. Catalog-sync job success requires all three domain runs succeeded.

### 4.5 Webhook authoritative refetch application

```text
HMAC → PR4 durable intake → DurableJob PENDING → dispatcher / envelope v3
  → processingEnabled
  → identity from sanitizer (GID preferred; REST id fallback)
  → authoritative GraphQL refetch OR confirmed-absence check
  → tenant txn: applyCanonicalFacts (clocks A/B; signal lineage clock C only)
  → receipt
  → projection (separate)
```

Topics to add to toml + sanitizers + envelope allowlist (brief §10.1):

| Resource | Topics |
|---|---|
| Product | `products/create`, `products/update`, `products/delete` |
| Inventory item | `inventory_items/create`, `inventory_items/update`, `inventory_items/delete` |
| Inventory level | `inventory_levels/connect`, `inventory_levels/update`, `inventory_levels/disconnect` |
| Location | `locations/create`, `locations/update`, `locations/delete`, `locations/activate`, `locations/deactivate` |
| Bulk | `bulk_operations/finish` |

Resource rules remain brief §10.3. Load-bearing constraints:

- Webhook body is **never** canonical truth. Product webhooks include at most the first 100 variants.
- `products/delete` / `inventory_items/delete` / `locations/delete` / `inventory_levels/disconnect` are **signals**. Tombstone only after `ABSENT_CONFIRMED_QUERY`. Delayed delete after live refetch must not tombstone (Race H). Query failure is not deletion (Race N).
- `inventory_levels/update` **must refetch all eight quantity names**. Ignore webhook `available` as complete truth.
- `inventory_levels/disconnect` official sample is `{ inventory_item_id, location_id }` only. Map onto `(shopId, inventoryItemGid, locationGid)`. One pair row (Race X). Reconnectable.
- Remove forecast / ABC / low-stock from the **canonical** inventory webhook path (brief §11). Characterization tests keep current forecast defaults when `computeForecast` is invoked directly.
- Fence or remove `available ?? 0` on the canonical path (R-165). Canonical unknown availability must not become Shopify zero.

Execution strategy: resource webhooks `ATOMIC_APPLICATION_RECEIPT`. `bulk_operations/finish` is `CONTROL_ONLY` or a continuation of the existing catalog-sync run keyed by persisted GID — not a second applicator.

### 4.6 Full-sync fence / presence completion

Fence generation is allocated and committed **before** Shopify I/O. JSONL lines reuse `SyncRun.fenceGeneration`. Do not copy fence into fact existence-interval columns (F1 already stores full-sync presence as NULL/NULL gens + `LIVE_FULL_SYNC_PRESENT`).

Success requires brief §8.5. Partial bulk never nominates (Race D/O). Presence marker still advances on observed GIDs whose attributes no-op (Race K). Post-fence creates with `existenceRequestGen > fenceGeneration` are not nominated (Race B).

### 4.7 Deletion / absence confirmation

Nomination is SQL against `lastSeenFullSyncRunId` + `fenceGeneration` vs `existenceRequestGen` (READ COMMITTED sweep, Race AA). Never an in-memory GID set. Never Shopify `updatedAt` vs `fenceAt`. Never bulk omission alone.

Circuit breaker (count **and** proportion of LIVE rows): trip → **zero** tombstones, domain `DEGRADED`, no `HEALTHY` deletion reconciliation (Race V). Under threshold, bounded batched confirmation via F2A existence queries. Completed null → `ABSENT_CONFIRMED_QUERY` (Race W). Overlapping LIVE keeps LIVE (Race AL).

Terminal GIDs (Product, Variant, InventoryItem, deleted Location): two **non-overlapping** LIVE confirmations + `createdAt` match where available (Race AB). InventoryLevel pairs remain reconnectable (Race J).

### 4.8 Inventory-state reconciliation

New job `inventory-state-reconcile`, `REBUILDABLE_IDEMPOTENT`, tenant envelope, existing dispatcher.

Because official 2026-07 docs state that `committed`, `reserved`, `damaged`, `safety_stock`, and `quality_control` **do not trigger webhooks**:

- Prefer bulk inventory-level extraction or another **complete** mechanism.
- No per-item / per-level GraphQL polling as the design.
- Debounce levels recently refetched by `inventory_levels/update`.
- Coalesce duplicate reconcile jobs per shop.
- Target freshness is configurable (`inventoryReconcileTargetFreshnessMs` or equivalent). 60-minute figure is an **engineering test target**, not a merchant SLO and not a locked cadence (R-034 remains PR 8).
- Per-name Clock A: stale reconcile cannot rewind a newer quantity.

### 4.9 Recovery / restart

Mandatory crash boundaries (brief D2):

| Crash | Required outcome |
|---|---|
| Kill before merchant batch commit | Resume re-applies the batch; no silent skip |
| Kill after merchant commit / before control-plane ack | Facts retained; checkpoint lags then catches up; never leads |
| Re-stream from 0 without Range | Idempotent Clock A + presence |
| Expired result URL | New BulkOperation + new fence; old run not `SUCCEEDED` |
| Hard-crash in-flight observation | F2B lease/abandonment rules; F3 must not hold locks across Shopify I/O |
| Uninstall / `processingEnabled=false` | Fail-closed; no merchant writes |

### 4.10 Compatibility projection triggering / recovery

After each successful canonical identity batch (and after shop_rebuild pages for recovery):

1. Canonical commit already durable.
2. Diagnostic writer: `compatibilityProjectionState = DEGRADED` if not yet successfully projected for that identity/generation.
3. `projectCompatibilityFromCanonicalFacts`.
4. On success **and** projection matching those facts: set `HEALTHY` for those identities.
5. On failure: leave `DEGRADED`; do not roll back canonical; bounded retry via PR 4 attempt lifecycle or dedicated projection continuation. Retry must not re-apply canonical facts.
6. Bounded diagnostic reconciler projects/closes `DataIssue` (`COMPATIBILITY_PROJECTION_FAILED`) and dual `SyncHealth` (canonical domain vs compatibility domain). Crash before `DataIssue` write must not report false `HEALTHY` after reconciliation (Race Z).
7. Orphan legacy cache/snapshot rows are **not** deleted in F3 (R-142). `shop_rebuild` must not treat orphans as canonical authority.
8. Poison identity: durable quarantine/repair **before** using `resumeAfterQuarantineCursor`.

### 4.11 Merchant-visible health / degraded

`DataIssue` / `SyncHealth` are derived, not atomic authority (brief §6.F.12). Merchant-durable columns are the source of honesty:

- `attributeFreshnessState`
- `compatibilityProjectionState`
- `existenceDiagnosticState`
- absence-nomination / circuit-breaker markers

Rules:

- Canonical domain may be internally current while compatibility health is `DEGRADED`. Diagnostics must show both.
- Do **not** claim Buying Table / barcode cache / today’s `InventorySnapshot` healthy while projection is stale or failed.
- Circuit-breaker abort is **not** `HEALTHY` deletion reconciliation.
- Default F1 `compatibilityProjectionState = HEALTHY` must not leak into merchant-facing health without an explicit successful projection write.
- Disabled shop remains `DISABLED` / fail-closed.

No new merchant UI overhaul is required to close PR 5 if existing SyncHealth / DataIssue surfaces already expose DEGRADED. F3 must not add a “all green” banner that ignores compatibility or incomplete deletion reconciliation.

---

## 5. File ownership (F3)

### 5.1 Exclusive new trees

| Path | Role |
|---|---|
| `stocky-plus/app/lib/catalog-facts/ingest/**` | JSONL streamer, BulkOperation submit-by-GID, two-phase checkpoint client split, observation mappers |
| `stocky-plus/app/lib/catalog-facts/apply/projection-state.ts` (new file only) | Diagnostic writer for `compatibilityProjectionState` / related merchant diagnostics under frozen advisory lock. **Do not** edit F2B clock/existence writers |
| `stocky-plus/app/jobs/workers/catalog-facts/**` | `catalog-sync-v2`, resource refetch, inventory-state-reconcile, diagnostic reconciler |
| `stocky-plus/scripts/tenant-enforcement/tests/pr5-f3-*.test.ts` | PostgreSQL integration / races |
| `stocky-plus/app/lib/catalog-facts/ingest/**/*.test.ts` | Unit streamer / mapper / memory tests |
| `stocky-plus/docs/phases/phase-1/PR5_F3_*` | Implementation / review reports (runtime PR only) |

### 5.2 Smallest compatible extensions (shared files)

Edit only what the allowlist requires:

- `app/jobs/workers/webhook-processor.ts` — route new topics; remove canonical-path forecast/`?? 0`; delegate to catalog-facts workers
- `app/sync/sanitize.server.ts`, `app/tenant/job-envelope.server.ts`, `app/sync/execution-strategy.server.ts`, `app/jobs/queue.server.ts`
- `scripts/sync-control-plane/manifest.ts`
- `shopify.app.toml` topics
- `prisma/schema.prisma` + additive migration on `SyncRun` only
- `app/sync/health.server.ts` — dual canonical vs compatibility health; no false HEALTHY
- `.github/workflows/ci.yml` — focused F3 steps that run **nonzero** tests
- `PR2_TENANT_ACCESS_INVENTORY.md` — mechanical regen only

### 5.3 Forbidden to rewrite

- `app/lib/catalog-facts/admin-read/**` except imports
- `app/lib/catalog-facts/apply/{clocks,existence,fencing,first-live,writers,money}.ts`
- `app/lib/catalog-facts/compatibility-projection/**` except imports
- PR 4 dispatcher / envelope major version
- Forecast formulas, ABC, inventory-write flags, PR 6 order/refund facts

---

## 6. Race remaining-applicability matrix

Legend:

- **F1** = schema/privilege primitive already on `main`
- **F2A** = read-boundary / scanner
- **F2B** = engine-level with synthetic observations (PR #31; not on `main` until merge)
- **F2C** = isolated projection (PR #30; not on `main` until merge)
- **F3** = remaining adapter / worker / checkpoint / health proof **required to close PR 5**
- **REG** = F3 must not regress; focused command still required

| Race | Brief intent | Current coverage | F3 remaining proof |
|---|---|---|---|
| **A** | Delayed bulk vs newer incremental attributes | F2B engine (stale bulk vs newer direct + presence) | JSONL bulk row after webhook refetch; attributes no-op; presence advances |
| **B** | Post-fence create not nominated | F2B fence vs direct | Full-sync omission + later LIVE refetch with `requestGen > fenceGeneration` |
| **C** / **I** | Confirmed absence vs late older bulk | F2B | JSONL resume after `ABSENT_CONFIRMED_QUERY` |
| **D** / **O** | `partialDataUrl` / failed bulk | F2A poll contract (partial not success) | Ingest worker must **not** stream/apply/nominate |
| **E** | Two-phase checkpoint crash | **none** | Mandatory D2 PostgreSQL crash fixture |
| **F** | Projection failure after canonical commit | F2C isolation core | Worker path: canonical retained; `compatibilityProjectionState=DEGRADED`; rebuild without re-apply |
| **G** | Mixed quantity names | F2B per-name clocks | Webhook/reconcile snapshot with mixed per-name `updatedAt` |
| **H** | Delayed delete after live refetch | F2B stale-signal class | Real webhook sanitizer + refetch worker |
| **J** | Reconnectable pair | F2B | Disconnect payload (item+location only) + later LIVE pair |
| **K** | Presence advances on attribute no-op | F2B | JSONL observed GID + stale attributes |
| **L** / **M** / **AK** | Null-version attributes / quantities | F2B | Direct refetch adapter |
| **N** | Failed delete refetch | **none as worker** | Timeout/5xx/throttle ≠ tombstone |
| **P** / **Q** / **R** | Sequence uniqueness / crash gap / zero Shop writes | F1 | REG on F3 allocation paths (fence + direct interval) |
| **S** | No lock across Shopify I/O | F2B forbids network in apply | Instrumentation: no row/advisory lock held during HTTP |
| **T** / **AI** | Non-overlapping existence vs commit order | F2B | Two refetch workers |
| **U** | Bulk omission is not absence | **none as ingest** | Complete JSONL omits X; direct still LIVE |
| **V** / **W** | Circuit breaker / small candidate confirm | **none** | Nomination SQL + breaker + confirmation |
| **X** | InventoryLevel pair uniqueness | F2B reconnect | Bulk GID then disconnect REST ids then reconnect |
| **Y** | Runtime denied `SyncRun` DML | F1/PR4 | Checkpoint helper must use control-plane role |
| **Z** | Diagnostic lag | **none** | Crash after merchant DEGRADED, before `DataIssue` |
| **AA** | READ COMMITTED candidate sweep | **none** | Concurrent LIVE commit during sweep |
| **AB** | Terminal non-revival | F2B | Delete-signal worker + one LIVE / overlapping LIVE |
| **AC** | Write-scanner plant | F2A scanner | Plant mutation in **F3 ingest/worker** adapter; CI fails |
| **AD**–**AG** | Sequence privileges / NO CYCLE | F1 | REG |
| **AH** / **AJ** / **AL** | Overlap inversion / LIVE vs ABSENT / candidate+LIVE | F2B engine | Webhook vs confirmation overlap |
| **AM**–**AS** / **AU** | Lease / abandonment / clock rollback | F2B | F3 must use F2B token fence; add worker crash-after-I/O case |
| **AT-1/2/4** | First-insert engine | F2B | REG |
| **AT-3** | Bulk JSONL vs direct refetch first insert | F2B synthetic | **Mandatory F3** with real mapper + two connections |
| **AV** | Deterministic lock order | F2B | Multi-identity JSONL batches opposite input order |
| **AW** | Lock-capacity / concurrent bulk apply | F2B evaluator + engine | Concurrent catalog-sync batches at configured envelope; unsafe envelope rejected; lock exhaustion aborts whole txn; no half-applied abandonment |

Engine coverage on PR #31 is **not** PR 5 closeout evidence until F2B is merged **and** F3 reproduces the adapter-level rows above.

---

## 7. R-157..R-165 remaining applicability

Do **not** close any of these from this planning packet. Formal close requires ChatGPT after independent F3 evidence (and F2B/F2C merge where noted).

| Risk | Severity | After F1/F2A/F2B/F2C | F3 remaining close condition |
|---|---|---|---|
| **R-157** | P1 | F1 USAGE-only sequence; F2B does not `setval` | Every F3 allocation path (`fenceGeneration`, direct start/end gens) uses `SELECT nextval('stocky_catalog_observation_gen_seq')`. Focused REG of AE/AF/AG/AD. Application roles still fail `setval` |
| **R-158** | P1 | F2B interval engine | Direct refetch workers allocate start **before** HTTP and end **after** usable response. Overlapping webhook vs confirmation must not LWW by `responseGen` (AH/AJ/AL through adapters) |
| **R-159** | P2 | F2B lease/abandonment engine | Worker hard-crash after `ACTIVE` in-flight commit and before apply. No network lock. Successor uses F2B durable `ACTIVE→ABANDONED`. No F3 reaper that physically deletes in-flight rows as a correctness path |
| **R-160** | P1 | F1 lock primitive; F2B every apply writer locked | F3 diagnostic writer, JSONL batch apply, webhook apply, reconcile apply all use the same derivation function + known-answer vectors 1–3. No unanchored ingest upsert |
| **R-161** | P2 | F1/F2B evaluator; **deployment/concurrency evidence still missing** | Race AW against disposable PostgreSQL with intended `max_locks_per_transaction`. Concurrent F3 multi-identity transactions at the configured ceiling. Do not raise PostgreSQL settings from app code. Unsafe envelope rejected/reduced |
| **R-162** | P3 | Implemented on F2B branch (`Number.isSafeInteger`) | Keep evaluator; F3 must not pass unsafe direct inputs. Eligible to close after F2B merge + F3 consumption proof |
| **R-163** | P3 | F2A recursive production-module scan independently falsified | F3 nested `ingest/` and `workers/catalog-facts/` **must** remain inside the recursive scan. Race AC plant in an F3 nested module. Eligible to close only with ChatGPT after F3 scanner proof; not closed by F2A merge alone |
| **R-164** | P3 | F2B ordinary apply exports no physical delete; Prisma `delete` still exists | F3 ingest/workers must not call `delete`/`deleteMany` on canonical facts. Tombstone only. Maintenance delete remains out of ordinary APIs |
| **R-165** | P2 | **Not on `main` yet.** Added on F2C branch: legacy `available ?? 0` overwrites the snapshot F2C refuses to fabricate | F3 **must** fence/remove webhook `?? 0` on the canonical path; canonical unknown ≠ zero; health must not claim current when availability is unknown. Land R-165 text onto `main` with F2C merge (do not duplicate-edit `RISK_REGISTER.md` in this planning PR) |

Related open risks F3 advances but does **not** close as “PR 5 complete”:

| Risk | F3 duty |
|---|---|
| **R-132** | Use F2A unitCost preflight; do not burn a with-unitCost bulk cycle |
| **R-134** | Persist BulkOperation GID; poll `bulkOperation(id:)` only |
| **R-136** | >50 locations via F2A complete pagination in the worker (legacy `first: 50` unused on canonical path) |
| **R-138** | Deny-by-default mutation scan includes F3 modules; allow only `bulkOperationRunQuery` as the ingest submit mutation |
| **R-142** | No orphan cleanup in F3 |
| **R-143** | Race A through JSONL+webhook |
| **R-145** | Durable `compatibilityProjectionState` + dual health **before** claiming merchant-safe wiring |
| **R-146** | Re-stream from 0; two-phase checkpoint |
| **R-147** | Reconcile bounded; no N+1; do not starve webhooks |
| **R-154** | Candidates + breaker; partial bulk nominates nothing |
| **R-155** | Terminal two-confirmation via delete worker |
| **R-156** | Diagnostic reconciler; Race Z |

---

## 8. PostgreSQL fixture map

Fixtures are **specifications for F3**. This planning PR does **not** add runtime fixture files.

All merchant fixtures use real disposable PostgreSQL, restricted `stocky_runtime`, transaction-local tenant context, and a second shop for cross-shop denial. Mocked RLS is not evidence.

### 8.1 Catalog / JSONL

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-JSONL-001` | Parent product, 2 variants, inventory items, collections; parents before children; `__parentId` present | Mapper emits Product / Variant / Item `full_sync` observations; collections do not become identity |
| `FX-JSONL-002` | Inventory-level lines with `item.id`, `location.id`, eight quantities, nullable per-name `updatedAt` | Pair identity; `__parentId` not uniqueness key |
| `FX-JSONL-003` | Inventory-level line missing item/location ids | Fail closed; no pair invented |
| `FX-JSONL-004` | 260 variants under one shop | No `first: 250` cap; all persist |
| `FX-JSONL-005` | Generator: ≥100k lines, nested products/variants | Heap ≤ 256MB; no full-body buffer (instrument streamer) |
| `FX-JSONL-006` | Malformed JSON line mid-file | Domain DEGRADED; prior committed batches retained; no silent skip |
| `FX-JSONL-007` | Duplicate GID lines, later attributes older Clock A | Idempotent; attributes no-op; presence advances |
| `FX-JSONL-008` | Null `updatedAt` bulk attributes | Fence-generation null-version path; DEGRADED until real timestamp |
| `FX-JSONL-009` | Incomplete authoritative attribute object on a full-sync line | Apply unit fails; no column wipe (F2B P2-01) |

### 8.2 BulkOperation / checkpoint

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-BULK-001` | `COMPLETED` + `url` + `partialDataUrl=null` | Stream allowed |
| `FX-BULK-002` | `COMPLETED` + `partialDataUrl` set + `url` null | Race D/O: no apply, no nomination, no watermark |
| `FX-BULK-003` | `FAILED` / `CANCELED` | Same as FX-BULK-002 |
| `FX-BULK-004` | GID mismatch on `bulkOperation(id:)` | Fail closed (F2A contract) |
| `FX-BULK-005` | Crash after merchant commit of lines 101–200, checkpoint still 100 | Race E: resume re-stream 0; ack 200; no skip |
| `FX-BULK-006` | Crash before merchant commit of 101–200 | Resume re-applies 101–200 |
| `FX-BULK-007` | Runtime role `UPDATE "SyncRun"` | Denied (Race Y) |
| `FX-BULK-008` | Expired URL | New fence + new GID; old run not SUCCEEDED |
| `FX-BULK-009` | `currentBulkOperation` string in F3 ingest | CI search gate fails |

### 8.3 Locations / fence / absence

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-LOC-001` | 55 locations, page size 50 | All persist; page 2 used |
| `FX-LOC-002` | Complete location sync omits a LIVE location whose `existenceRequestGen > fence` | Not nominated (Race B) |
| `FX-LOC-003` | Complete sync omits a LIVE location eligible for nomination; breaker under threshold; `location(id:)` null | Tombstone `ABSENT_CONFIRMED_QUERY` (Race W) |
| `FX-LOC-004` | Candidate proportion over threshold | Zero tombstones; DEGRADED; no HEALTHY deletion (Race V) |
| `FX-LOC-005` | `locations/deactivate` vs `locations/delete` | Inactive `isActive=false` vs confirmed-absence tombstone |
| `FX-ABS-001` | Complete catalog JSONL omits GID still returned live by direct query | Candidate only; stays LIVE (Race U) |
| `FX-ABS-002` | Confirmed absence then older bulk line | Stays ABSENT (Race C) |

### 8.4 Webhooks / refetch

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-WH-001` | HMAC-valid `products/update` with 101 variant_gids | Refetch product+variants; do not treat 100-variant body as complete |
| `FX-WH-002` | `products/delete` with `admin_graphql_api_id`; live `product(id:)` | Signal only; no tombstone (Race H) |
| `FX-WH-003` | Same delete; `product(id:)` null | Tombstone after confirmation |
| `FX-WH-004` | Delete refetch 5xx/timeout | Not deletion (Race N); DEGRADED / retry |
| `FX-WH-005` | `inventory_levels/disconnect` `{inventory_item_id, location_id}` only | Maps to pair; one row (Race X) |
| `FX-WH-006` | `inventory_levels/update` `available: 5` while GraphQL `committed` changed | All eight refetched; webhook available not complete truth |
| `FX-WH-007` | `available: null` on webhook | Must **not** write snapshot 0 (R-165) |
| `FX-WH-008` | Canonical path of inventory webhook | No `computeForecast` / `LowStockAlert` / `VariantAbcClass` writes |
| `FX-WH-009` | Out-of-order update then older update | Clock A keeps newer Shopify `updatedAt` |
| `FX-WH-010` | Disabled shop | Fail-closed; no merchant writes |

### 8.5 Reconcile / inventory state

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-REC-001` | Change only `committed` with **no** `inventory_levels/update` | Reconcile/bulk corrects canonical `committed` |
| `FX-REC-002` | Distinct `available` vs `on_hand` vs `incoming` | No collapse |
| `FX-REC-003` | Stale reconcile older per-name `updatedAt` | No rewind |
| `FX-REC-004` | Write/read ceiling | Shopify reads O(bulk ops + shards), not O(variants×locations) |

### 8.6 Projection / health

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-PROJ-001` | Canonical commit then projection throw | Canonical retained; `compatibilityProjectionState=DEGRADED`; no rollback |
| `FX-PROJ-002` | Successful rebuild | HEALTHY only after projection matches those facts |
| `FX-PROJ-003` | Crash after DEGRADED, before `DataIssue` | Reconciler recreates issue; no false HEALTHY (Race Z) |
| `FX-PROJ-004` | `hasMore=true` shop_rebuild page | Must not authorize merchant HEALTHY |
| `FX-PROJ-005` | Parent ABSENT / variant LIVE lag | Retryable; no poisonHalt; later healthy variant projects (F2CC-01) |
| `FX-PROJ-006` | LIVE level `availableQuantity=null` | Fail closed; snapshot unchanged; not zero |
| `FX-PROJ-007` | Uninstall during projection retry | Fail-closed |
| `FX-PROJ-008` | Orphan legacy cache row | Survives F3; not canonical authority (R-142) |

### 8.7 Concurrency / first insert

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-RACE-AT3` | No canonical row; JSONL full_sync vs webhook direct overlap | Same advisory key; 0 or 1 coherent row; no ON CONFLICT overwrite |
| `FX-RACE-AW` | Disposable PG with known `max_locks_per_transaction`; concurrent 32-identity batches + one-identity refetch; unsafe envelope | Envelope reduced/rejected; exhaustion aborts txn; no half-applied state |
| `FX-RACE-AV` | Two batches opposite identity order | Same lock order; no deadlock |
| `FX-RACE-S` | Direct refetch instrumentation | Zero merchant/control/advisory locks during HTTP |

### 8.8 Tenancy / money / identity

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-TENANT-001` | Two shops; ingest shop A | Shop B sees 0 rows |
| `FX-MONEY-001` | `"0.1"`, `"19.99"`, high-precision Decimal unitCost | Round-trip exact strings; no `Number`/`parseFloat` |
| `FX-ID-001` | Delete variant GID-1; recreate SKU on GID-2 | Two rows; history not merged |
| `FX-ID-002` | Terminal tombstone + one later LIVE | No revival (Race AB) |

---

## 9. Exact acceptance commands (F3 runtime PR)

Commands below are **F3 acceptance gates**, not this planning PR. Each focused step must:

- execute a distinct file or distinct command;
- collect **nonzero** tests (reuse `failOnZeroPassedNameFilter` and/or `--passWithNoTests false`);
- print the observed pass count;
- fail if zero tests collected.

Environment: disposable PostgreSQL, isolated Redis, npm **11.5.2**, inventory-write flags **unset/false**, no production Shopify.

### 9.1 Focused CI steps to add in F3

```text
# Streamer / mapper / memory (no Shopify network)
npx vitest run app/lib/catalog-facts/ingest --reporter=verbose --passWithNoTests false

# Admin-read regression (F2A)
npx vitest run app/lib/catalog-facts/admin-read --reporter=verbose --passWithNoTests false

# Apply engine regression (F2B)
npx vitest run app/lib/catalog-facts/apply --reporter=verbose --passWithNoTests false

# Projection core regression (F2C)
npx vitest run app/lib/catalog-facts/compatibility-projection --reporter=verbose --passWithNoTests false

# F3 PostgreSQL ingest / checkpoint / fence / absence
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-jsonl-checkpoint.test.ts

# F3 webhook refetch / delete-signal / R-165
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-webhook-refetch.test.ts

# F3 overlap races A, AT-3, H, S
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-overlap-races.test.ts

# F3 absence nomination / breaker / confirmation
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-absence-confirmation.test.ts

# F3 reconcile bounded / non-webhook quantities
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-inventory-reconcile.test.ts

# F3 projection trigger / health / Race F / Z
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-projection-health.test.ts

# F3 Race AW capacity
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-lock-capacity-aw.test.ts

# Scale completeness
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-scale-completeness.test.ts

# Mutation scanner includes nested F3 modules (Race AC)
npx vitest run app/lib/catalog-facts/foundation-safety.test.ts app/lib/catalog-facts/admin-read/mutation-safety.test.ts --reporter=verbose --passWithNoTests false

# Sequence privilege regression
npm run test:migrations -- scripts/tenant-enforcement/tests/sequence-privilege.test.ts

# PR 4 control-plane regression (existing suite must stay green)
npx vitest run app/sync --reporter=verbose --passWithNoTests false
```

### 9.2 Mandatory aggregate gates (exact-head full CI)

```text
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate
npm run graphql-codegen
npm run test:migrations
npm run tenant:access:audit
npm run tenant:access:inventory:check
npm run tenant:enforcement:inventory:check
git diff --check
```

Search gates (must fail CI if matched in F3 production ingest/worker trees):

```text
currentBulkOperation
response.text()
available ?? 0
ON CONFLICT DO UPDATE
pg_advisory_lock(          # session-level forbidden; xact only
```

`bulkOperationRunQuery` is allowed **only** in the F3 submitter module.

### 9.3 Minimum observed counts (fail if below)

F3 must record actual counts from the run. Planning floors (raise, do not lower, if implementation adds tests):

| Suite | Minimum passing tests |
|---|---|
| ingest unit | ≥ 20 |
| jsonl-checkpoint PG | ≥ 12 including Race E both crash sides |
| webhook-refetch PG | ≥ 16 including H, N, X, R-165, forecast isolation |
| overlap-races PG | ≥ 8 including A, AT-3, S |
| absence-confirmation PG | ≥ 8 including U, V, W, C |
| inventory-reconcile PG | ≥ 6 including FX-REC-001 |
| projection-health PG | ≥ 10 including F, Z, FX-PROJ-004 |
| lock-capacity-aw PG | ≥ 4 including unsafe envelope + exhaustion |
| scale-completeness PG | ≥ 2 (`FX-LOC-001`, `FX-JSONL-004`) |
| scanner / Race AC | ≥ 1 planted-mutation failure test |

A focused command that prints `0 passed` is a failed check even if exit 0 would otherwise occur.

---

## 10. Claude independent review targets (F3)

When ChatGPT requests review of the F3 exact head, Claude must independently falsify at least:

1. **Two-phase checkpoint:** merchant commit then control-plane ack; crash both sides; runtime `SyncRun` DML denied; checkpoint never leads.
2. **No HTTP Range:** resume literally re-reads from byte 0; already-committed `ingestBatchId` is idempotent.
3. **`partialDataUrl`:** zero canonical writes, zero nominations, zero watermarks.
4. **Race A and AT-3** on real mappers, not only `applyCanonicalFacts` unit tests.
5. **Race H and N** on webhook workers.
6. **Race V/W/U/C** on SQL nomination, not an in-memory GID set.
7. **Race F/Z and R-145:** no false HEALTHY; default column HEALTHY cannot leak.
8. **R-165:** webhook null availability cannot write snapshot 0 after F3.
9. **Race S:** no lock across Shopify HTTP.
10. **Race AW** on disposable PostgreSQL with live settings.
11. **R-160/R-164:** every F3 writer locked; no physical delete of facts.
12. **R-157:** F3 does not `setval`; fence+direct use `nextval`.
13. **Scanner:** nested F3 modules scanned; `inventoryBulkToggleActivation` plant fails; `bulkOperationRunQuery` is the only allowed ingest mutation.
14. **PR 4 regression:** envelope v3, disabled-shop, no dispatcher redesign.
15. **No PR 6 / no inventory-write flags / no production.**

Required verdict language: approve F3 only with P0=0 P1=0 P2=0 blocking, or `CORRECTIONS REQUIRED`. A green worker demo is not completion.

Immutable F1/F2A/F2B/F2C review artifacts must not be edited.

---

## 11. Emergency sequencing (technical, not calendar)

2026-09-07 is an operational rescue target. Safety gates do not change.

Critical path:

1. **This planning packet** — ChatGPT review (now).
2. **F2B re-review + accept + merge onto F2A `main`** — currently blocked on independent re-review of the first correction package.
3. **F2C re-review + accept + merge onto that `main`** — currently blocked on independent re-review of `F2CC-01`; GitHub already `CONFLICTING` with F2A `main`.
4. **F3 runtime** — one integration PR from the post-merge SHA, exact-head full CI, independent review, ChatGPT acceptance, user merge.
5. **PR 5 closure sync** — only after F3 acceptance/merge. Then PR 6 may be planned. Not before.

Work that does **not** help the rescue: opening PR 6, rewriting F2A bulk documents, forking F2B clocks, deleting tests, enabling inventory-write flags, or splitting F3 so overlap races move to a later PR.

---

## 12. Explicit non-authorization

This packet:

- does **not** authorize F3 runtime implementation;
- does **not** merge or rebase PR #30 / PR #31;
- does **not** create D-055;
- does **not** start PR 6;
- does **not** authorize production, merchant production data, Partner Dashboard validation, or inventory-write flags;
- does **not** authorize Shopify inventory mutations;
- does **not** close R-157..R-165;
- does **not** claim PR 5 complete or Phase 1 complete.

Cursor status for this packet: **planning complete — pending ChatGPT PR5 emergency integration plan review**.

---

## 13. ChatGPT decision requested

1. Accept this remaining-work map as the F3 contract.
2. Keep **one** F3 integration PR after F2B and F2C merge.
3. Serialise independent re-review of PR #31 then PR #30 (or the reverse, but not parallel merges onto conflicting bases).
4. After those merges, authorize F3 from the exact post-merge `origin/main` SHA.
5. Do not begin PR 6.
