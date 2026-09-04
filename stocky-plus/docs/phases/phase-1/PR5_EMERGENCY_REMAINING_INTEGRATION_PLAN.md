# Phase 1 PR 5 — Emergency remaining integration plan

**Status:** `PLANNING CURRENT-MAIN SYNC — F3 RUNTIME NOT AUTHORIZED — PENDING CHATGPT MERGE DECISION`
**Product owner:** ChatGPT
**Planning owner:** Cursor
**Independent reviewer (when requested):** Claude Code
**Authority:** D-054 **EFFECTIVE**. D-053 planning remains **ACCEPTED AND MERGED**. Do **not** create D-055.
**Emergency target:** 2026-09-07 operational rescue (calendar pressure does **not** weaken safety gates).
**This document:** execution-ready remaining-work plan and test/fixture map after F2A / F2B / F2C cores, independently **APPROVED** as a planning correction, now synchronized onto complete F2A+F2B+F2C `main`.
**This document does not:** implement F3 runtime, begin PR6 runtime, merge this PR or PR #33 / PR #34, enable inventory-write flags, enable the absence-tombstone flag, access production, or authorize Shopify inventory mutations.

Approved product authority remains `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`. This packet does not change product rules. It names what is already frozen, what is still unwired, and the smallest safe runtime lane that can close PR 5.

**Lane recommendation (ACCEPTED IN DIRECTION; retained):** one remaining runtime PR (`PR5-F3`). JSONL ingest, authoritative webhook/refetch, absence/reconcile, compatibility-projection integration, v1 legacy authority fencing, required two-root scanner expansion, and health-state integration stay inside **one F3 merge boundary**. Do **not** split JSONL into an earlier runtime PR.

---

## 0. Evidence snapshot (re-inspected 2026-09-04 during current-main synchronization)

Inspected live GitHub + local git. Not inherited from the 2026-09-02 planning-correction snapshot.

| Field | Observed value |
|---|---|
| Planning branch | `cursor/pr5-emergency-remaining-integration-plan-b53e` |
| Accepted planning-correction head | `a6b65f155de480354c66d147149fd98effb87430` |
| Original reviewed PR #32 head | `b886bb562a0f77cfb9a8964e24b9a348b310514a` |
| `origin/main` | `f9841691307583381695973600df3546dd1b9ee4` |
| `main` tip subject | `Phase 1 PR5-F2C — compatibility projection core (#30)` |
| F2A PR | [#29](https://github.com/Vedang1998/Stocky/pull/29) **CLOSED / MERGED** at `2026-08-20T11:04:26Z` |
| F2A squash merge | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (ancestor of current `main`) |
| F2A post-merge main CI | run [`32362021387`](https://github.com/Vedang1998/Stocky/actions/runs/32362021387), event `push`, head `f65ab4b…`, **SUCCESS** |
| F2B PR | [#31](https://github.com/Vedang1998/Stocky/pull/31) **CLOSED / MERGED** at `2026-09-02T10:32:09Z` |
| F2B squash merge | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` (ancestor of current `main`) |
| F2B post-merge main CI | run [`33619969867`](https://github.com/Vedang1998/Stocky/actions/runs/33619969867), event `push`, head `0284b66…`, **SUCCESS** (Classify `100214488053` SUCCESS; Heavy `100214522724` SUCCESS; CI Gate `100227810337` SUCCESS) |
| F2B correction verdict | `APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION` |
| F2B correction review blob | `b01569fd77455566438bcedbe869647beb24eda7` |
| F2C PR | [#30](https://github.com/Vedang1998/Stocky/pull/30) **CLOSED / MERGED** at `2026-09-03T23:16:51Z` |
| F2C squash merge / current `main` | `f9841691307583381695973600df3546dd1b9ee4` |
| F2C post-merge main CI | run [`33816908539`](https://github.com/Vedang1998/Stocky/actions/runs/33816908539), event `push`, head `f984169…`, **SUCCESS** (Classify `100850950694` SUCCESS; Heavy `100850978903` SUCCESS; CI Gate `100862247959` SUCCESS) |
| F2C isolated accepted implementation head | `2d2e8801dd383a778c1237cec4ed068922859cf0` (ancestor of the F2C squash) |
| F2C second-correction verdict | `APPROVE PR5-F2C COMPATIBILITY PROJECTION SECOND CORRECTION` |
| F2C second-correction review blob | `d637a9ecf0f42c3ae62f87e0391abb0b80e2e2ad` |
| F2C current-main review | **ON THIS BRANCH** — see §0.3 |
| F2C current-main verdict | `APPROVE PR5-F2C CURRENT-MAIN INTEGRATION` |
| PR #32 | [#32](https://github.com/Vedang1998/Stocky/pull/32) **OPEN / DRAFT / UNMERGED** |
| PR #33 | [#33](https://github.com/Vedang1998/Stocky/pull/33) **OPEN / DRAFT / UNMERGED**, head `33a381ac9204a13396158551f511cee01b60b179`. Overlaps `PROJECT_STATUS.md`, `phases/phase-1/README.md`, `RISK_REGISTER.md`, `DECISIONS.md`. **Do not merge or edit PR #33 from this packet.** After PR #32 merges, PR #33 refreshes separately onto the resulting `main`. |
| PR #34 | [#34](https://github.com/Vedang1998/Stocky/pull/34) PR6 planning — **do not edit**. PR6 planning is independently accepted. PR6 **runtime** remains **NOT AUTHORIZED** until PR 5 is fully closed. |
| Production | **NOT AUTHORIZED** |
| Inventory-write flags | **DEFAULT OFF** |
| Absence-tombstone flag | **DEFAULT OFF** (named in this packet; **not** enabled here) |
| PR6 runtime | **NOT AUTHORIZED** |
| F3 runtime | **NOT STARTED** / **NOT AUTHORIZED** by this packet |

F2A + F2B + F2C prerequisites are **merged**. This packet does **not** claim PR 5 complete.

---

## 0.1 Early independent review identity (immutable)

| Field | Value |
|---|---|
| Review class | EARLY Tier-A adversarial architecture review (not the final exact-head F3 review) |
| Claude review branch | `claude/stocky-pr5-tier-a-review-k2560t` |
| Review commit | `f35263307dd0da18e1039790ab76dc65bd620470` |
| Exact reviewed parent | `b886bb562a0f77cfb9a8964e24b9a348b310514a` |
| Artifact | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md` |
| Immutable blob | `ebf2e87bf108bbd5eaa7d31a323842de13ae53ca` |
| Verdict | **CORRECTIONS REQUIRED** |
| Counts | P0 **0** / P1 **8** / P2 **9** / P3 **8** (25 findings `F-CLAUDE-PR5F3EA-01` … `-25`) |
| One-F3-PR recommendation | **UPHELD** |

**NEVER EDIT** the immutable review artifact. Cherry-pick only.

The planning correction at `a6b65f1…` addressed every original finding by freezing architecture. Independent correction approval is recorded in §0.2. This current-main sync does **not** reopen that architecture.

---

## 0.2 Planning-correction independent review identity (immutable)

| Field | Value |
|---|---|
| Review class | CORRECTION re-review of the PR5-F3 remaining-integration **planning** packet (not the final exact-head F3 runtime review) |
| Review commit (source) | `96b3f1a9649ffb14a22f731fd79e271060e8c44d` |
| Exact reviewed parent | `a6b65f155de480354c66d147149fd98effb87430` |
| Artifact | `stocky-plus/docs/phases/phase-1/PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md` |
| Immutable blob | `00e8307e3aaf83b032fbcc1e2d0258beab47a864` |
| Verdict | **APPROVE PR5-F3 PLANNING CORRECTION** |
| Counts | P0 **0** / P1 **0** / P2 **0** / P3 **2** (`F-CLAUDE-PR5F3EC-01`, `F-CLAUDE-PR5F3EC-02`) |
| Original findings | **25/25** corrected |
| One-F3-PR architecture | **RETAINED** |

**NEVER EDIT** the immutable correction-review artifact. Cherry-pick only.

---

## 0.3 F2C current-main independent review identity (immutable)

The final exact-current-main F2C review existed off the merged PR #30 branch and is made durable on this planning packet so it can land on `main` through this documentation/control transition.

| Field | Value |
|---|---|
| Review class | Exact-current-main F2C integration review |
| Source commit | `a894bfaa5118cf21f079bff7565e9c5839108438` |
| Artifact | `stocky-plus/docs/phases/phase-1/PR5_F2C_CURRENT_MAIN_INDEPENDENT_REVIEW.md` |
| Immutable blob | `e14fc21efbe2cee874df6c1bd2e35647669c5445` |
| Verdict | **APPROVE PR5-F2C CURRENT-MAIN INTEGRATION** |
| Counts | P0 **0** / P1 **0** / P2 **0** / P3 **4** (new `NEW-CLAUDE-F2CCM-01` + retained `NEW-CLAUDE-F2CC2-01` / `-02` / `-03`) |

**NEVER EDIT** the immutable F2C current-main review artifact. Integrate the addition only.

---

## 0.4 Accepted residual P3s carried into F3 (implementation/review targets)

These remain **OPEN** as F3 implementation/review targets. They do **not** redesign the one-F3 architecture and are **not** closed by this packet.

| ID | Severity | Carry-forward |
|---|---|---|
| **F-CLAUDE-PR5F3EC-01** | P3 | C16 `D * B` over-approximates vs worker concurrency. F3 must use `D * max(B, Σ worker concurrency across canonical-writer queues)` **or** fail closed at startup if `B < Σ worker concurrency`. |
| **F-CLAUDE-PR5F3EC-02** | P3 | Completeness count tokens must match `^[0-9]+$` before string compare. A non-conforming token is an omitted count → fail closed (C1). |
| **NEW-CLAUDE-F2CCM-01** | P3 | Product is a **terminal** resource. Terminal Product revival requires **two non-overlapping** authoritative LIVE confirmations. F3 retry / reconcile budgeting must not assume Product convergence in a single observation cycle. Bounded retry must allow that two-confirmation revival path **before** treating `canonical_product_not_live` as exhausted. Lower bound: **at least two full observation cycles**. Clarification of the already-approved retry contract (C23 / Race AB / R-155), not a redesign. |

---

## 0.5 Finding disposition index

Every finding has an explicit frozen disposition in this packet. Implementation-time acceptance for the future F3 exact-head Claude review is listed in §14.

| ID | Sev | Disposition |
|---|---|---|
| P1-01 / F-CLAUDE-PR5F3EA-01 | P1 | Frozen completeness contract + FX-JSONL-010/011 — §C1 |
| P1-02 / F-CLAUDE-PR5F3EA-02 | P1 | `FEATURE_PR5_ABSENCE_TOMBSTONE` DEFAULT OFF — §C2 |
| P1-03 / F-CLAUDE-PR5F3EA-03 | P1 | One presence-authority domain per resource type — §C3 |
| P1-04 / F-CLAUDE-PR5F3EA-04 | P1 | `PROJECTION_PENDING` enum+default **and** canonical-txn writer field — §C4 |
| P1-05 / F-CLAUDE-PR5F3EA-05 | P1 | Exact-path `bulkOperationRunQuery` scanner exception — §C5 |
| P1-06 / F-CLAUDE-PR5F3EA-06 | P1 | Two-root scanner; R-163 stays OPEN — §C6 |
| P1-07 / F-CLAUDE-PR5F3EA-07 | P1 | v1 cutover fail-closed; legacy files permitted — §C7 |
| P1-08 / F-CLAUDE-PR5F3EA-08 | P1 | Paired GID+ordinal checkpoint + deterministic `ingestBatchId` — §C8 |
| P2-09 / F-CLAUDE-PR5F3EA-09 | P2 | Pre-submit intent + `bulkOperations` list recovery — §C9 |
| P2-10 / F-CLAUDE-PR5F3EA-10 | P2 | Any unproven stream = PARTIAL_FAILURE — §C10 |
| P2-11 / F-CLAUDE-PR5F3EA-11 | P2 | Webhook-class claim preference + deferral + bounded poll — §C11 |
| P2-12 / F-CLAUDE-PR5F3EA-12 | P2 | Mid-ingest `processingEnabled` + affected-row halt — §C12 |
| P2-13 / F-CLAUDE-PR5F3EA-13 | P2 | Whole-application search gates + reviewed allowlist — §C13 |
| P2-14 / F-CLAUDE-PR5F3EA-14 | P2 | One parent job / three child SyncRuns / failed-domain-only retry — §C14 |
| P2-15 / F-CLAUDE-PR5F3EA-15 | P2 | GID-prefix classifier table — §C15 |
| P2-16 / F-CLAUDE-PR5F3EA-16 | P2 | Derived `configuredWorstCaseConcurrentCanonicalTransactions` — §C16 |
| P2-17 / F-CLAUDE-PR5F3EA-17 | P2 | Live F2B/F2C status corrected here and in PR #32 status files — §0 |
| P3-18 / F-CLAUDE-PR5F3EA-18 | P3 | `Int?`, 1-based, CHECK ≥ 1 — §C18 |
| P3-19 / F-CLAUDE-PR5F3EA-19 | P3 | `bulk_operations/finish` is CONTROL_ONLY continuation — §C19 |
| P3-20 / F-CLAUDE-PR5F3EA-20 | P3 | Refetch receipt digest + no-op still receipts — §C20 |
| P3-21 / F-CLAUDE-PR5F3EA-21 | P3 | Broadened session advisory-lock gate — §C21 |
| P3-22 / F-CLAUDE-PR5F3EA-22 | P3 | App-owned `full-sync-epoch:<SyncRun.id>` cursor — §C22 |
| P3-23 / F-CLAUDE-PR5F3EA-23 | P3 | PR4 projection lifecycle; poll/reconcile ceilings — §C23 |
| P3-24 / F-CLAUDE-PR5F3EA-24 | P3 | PR #32 / #33 serialization; merge neither here — §C24 |
| P3-25 / F-CLAUDE-PR5F3EA-25 | P3 | PR6 **runtime** blocked; PR6 **planning** allowed — §C25 |

**Remaining unresolved architecture decisions in this packet: NONE.**

---

## 1. What is already frozen vs what remains

### 1.1 Closed / frozen cores (do not reopen)

| Slice | Live state | Frozen interface | Explicitly not done |
|---|---|---|---|
| **PR5-F1** | ACCEPTED / MERGED / FROZEN (`7827e535…`, later closeout `5129707…`) | Canonical fact schema, RLS, `stocky_catalog_observation_gen_seq`, `CatalogObservationInFlight`, advisory lock primitives, lock-capacity evaluator, `SyncRun.fenceGeneration` / `fenceAt`, `ingestBatchId` on facts | No ingest, no apply engine, no workers |
| **PR5-F2A** | ACCEPTED / MERGED on `main` (`f65ab4b…`; ancestor of current `f984169…`) | `app/lib/catalog-facts/admin-read/**`: executable 2026-07 QUERY documents, complete location pagination, eight quantity names, unitCost preflight, `bulkOperation(id:)` poll by persisted GID, recursive mutation scanner, `item { id }` + `location { id }` on inventory-level bulk shape. Scan root today: `app/lib/catalog-facts`. | No `bulkOperationRunQuery` submit, no JSONL stream, no workers, no `SyncRun` writes |
| **PR5-F2B** | ACCEPTED / MERGED. PR [#31](https://github.com/Vedang1998/Stocky/pull/31) **CLOSED / MERGED**. Squash `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` at `2026-09-02T10:32:09Z`. Post-merge main CI run `33619969867` **SUCCESS**. Correction verdict `APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION` (blob `b01569fd…`). | `applyCanonicalFacts` / `applyCanonicalFactsWithRetry` under `app/lib/catalog-facts/apply/**`. Consumes **already-authoritative** observations. Universal `pg_advisory_xact_lock`. Tombstone-only ordinary apply. Full-sync presence uses `LIVE_FULL_SYNC_PRESENT` with NULL/NULL existence gens. R-162 safe-integer evaluator in-lane | No Shopify I/O. No JSONL. No webhook adapter. No `SyncRun` checkpoint. No `compatibilityProjectionState` writer (INSERT omits the column → schema default `HEALTHY`). No diagnostic reconciler |
| **PR5-F2C** | ACCEPTED / MERGED. PR [#30](https://github.com/Vedang1998/Stocky/pull/30) **CLOSED / MERGED**. Squash / current `main` `f9841691307583381695973600df3546dd1b9ee4` at `2026-09-03T23:16:51Z`. Post-merge main CI run `33816908539` **SUCCESS**. Current-main review `APPROVE PR5-F2C CURRENT-MAIN INTEGRATION` (blob `e14fc21e…`) is **on this branch**. | `projectCompatibilityFromCanonicalFacts` under `app/lib/catalog-facts/compatibility-projection/**`. Separate TenantDb. Cannot roll back canonical facts. No HEALTHY recommendation. Fail-closed unknown `availableQuantity` | No worker wiring. No `compatibilityProjectionState` persistence. No `DataIssue` / `SyncHealth`. `resumeAfterQuarantineCursor` unusable until durable quarantine. Does not fence legacy `available ?? 0` |

### 1.2 Remaining PR 5 scope (this is F3)

Everything in the approved brief that is **not** a frozen F1/F2A/F2B/F2C core:

1. Bulk JSONL streaming with bounded memory **and a mechanical completeness proof**.
2. `BulkOperation` result ingestion (`url` complete JSONL only; `partialDataUrl` discarded from canonical completion).
3. Canonical apply **batching** of streamed identities (default 32 identities / transaction; lock-capacity envelope derived from real writer fan-out).
4. `SyncRun` / cursor / paired two-phase checkpoint acknowledgement.
5. Webhook authoritative refetch application (signals, not payloads).
6. Full-sync fence / presence completion with **one presence-authority domain per resource type**.
7. Deletion / absence confirmation (candidate + `ABSENT_CONFIRMED_QUERY`, circuit breaker, **operator kill switch DEFAULT OFF**).
8. Inventory-state reconciliation where webhooks are incomplete.
9. Recovery / restart, including orphan BulkOperation recovery **without** `currentBulkOperation`.
10. Compatibility projection **triggering / recovery** and merchant-durable `compatibilityProjectionState` that cannot read `HEALTHY` before successful projection.
11. Merchant-visible health / degraded outcomes (no false `HEALTHY`).
12. Adapter-level adversarial races, including bulk vs webhook overlap.
13. Remaining applicability of **R-157..R-165** (none closed by this packet).

### 1.3 Still present on current `main` (must be replaced or fenced, not extended)

Observed on current `main` `f9841691307583381695973600df3546dd1b9ee4` (F2A+F2B+F2C merged). These legacy defects remain on the **unwired** path and are F3 replacement/fence targets:

| Defect | Evidence |
|---|---|
| Location cap | `fetchLocations` still `locations(first: 50)` in `app/services/shopify-gql.server.ts` |
| Deprecated bulk poll | `pollBulkOperation` still uses `currentBulkOperation` |
| Full JSONL in memory | `ingestBulkVariantCache` still `response.text()` + `split` |
| Per-row legacy upsert | same ingest loop |
| Webhook `available` as truth | `handleInventoryUpdate` writes `quantityAvailable: inv.available ?? 0` |
| Forecast / ABC coupling | same handler calls `computeForecast` / `lowStockAlert` |
| Catalog job payload | `enqueueCatalogSync` still `catalog-sync-v1` |
| Catalog worker dispatch | `webhook-processor.ts` branches on job **name** `catalog-sync` and never reads `payloadSchemaVersion` |
| Webhook toml | only `inventory_levels/update` |
| `SyncRun` checkpoint columns | **absent** (`jsonlCommittedLineOrdinal` / dedicated BulkOperation GID column not on schema) |

F3 replaces these on the **canonical** catalog/inventory path. Legacy helpers **are permitted to be edited** where required to enforce the v1 cutover (P1-07). Wording that “legacy helpers stay untouched” is **withdrawn** for the files listed in §5.2.

---

## 2. Lane decision

### 2.1 Recommendation: **one remaining runtime PR** (RETAINED)

**Lane name:** `PR5-F3 Catalog / location / inventory integration`

**Why one PR, not parallel lanes:**

- F1/F2A/F2B/F2C interfaces are already the frozen foundation. Remaining work is **wiring those interfaces together**.
- The remaining P1 class is overlap: delayed bulk vs newer refetch, two-phase checkpoint, projection failure after canonical commit, webhook+full-sync first insert (Race AT-3), delayed delete after live refetch.
- A JSONL-first intermediate `main` would carry terminal tombstone capability without the webhook refetch adapter that supplies overlapping LIVE evidence. Independent review attempted to falsify this and **could not**.
- Splitting JSONL ingest from webhooks would leave those races untestable until a later PR, which is the opposite of a 2026-09-07 rescue.
- File ownership is coherent: one ingest/worker/checkpoint/health surface. F2A/F2B/F2C cores stay frozen except the **named** exceptions in §5.2 / §5.3.

**Why not two or three PRs:**

| Rejected split | Why it is unsafe or slower |
|---|---|
| Schema-only PR then workers | Additive `SyncRun` / projection-state columns have no independent merchant value until the two-phase checkpoint and projection writer exist. They belong in F3. |
| JSONL/full-sync PR then webhook PR | Races A, B, C, E, H, K, AT-3, X require both adapters in one test corpus. Terminal tombstones without overlap protections are unsafe. |
| Webhook PR then reconcile PR | Official 2026-07: `committed` / `reserved` / `damaged` / `safety_stock` / `quality_control` do not trigger webhooks. Reconcile is part of inventory-state truth, not a later polish PR. |
| Projection-health PR after ingest | Race F / Z / R-145 are false-HEALTHY defects if ingest lands without durable projection state. |

Cursor must **not** invent a second parallel F3 lane.

### 2.2 Hard preconditions before F3 runtime may start

F3 runtime is **not** authorized by this planning packet. F2A + F2B + F2C merge preconditions are **satisfied**. ChatGPT may authorize F3 only after:

1. PR #31 F2B — **DONE.** CLOSED / MERGED. Squash `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`. Post-merge main CI run `33619969867` **SUCCESS**. Independent correction review remains `APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION` (blob `b01569fd…`).
2. PR #30 F2C — **DONE.** CLOSED / MERGED. Squash `f9841691307583381695973600df3546dd1b9ee4`. Post-merge main CI run `33816908539` **SUCCESS**. Current-main independent review `APPROVE PR5-F2C CURRENT-MAIN INTEGRATION` (blob `e14fc21e…`) is on this branch.
3. Both are merged **onto the F2A lineage**. Current `origin/main` is the F2C squash `f984169…`. F2A `f65ab4b…` and F2B `0284b66…` are ancestors.
4. F3 branch is created from the **post-F2B-and-F2C** `origin/main` SHA (`f9841691307583381695973600df3546dd1b9ee4` unless `main` has moved further after this packet merges), recorded in the F3 implementation report before edits. **This packet does not start that branch.**
5. Working tree clean; no D-055; no PR6 runtime; explicit ChatGPT F3 **runtime** authorization after this planning packet is merged.

F3 calls `applyCanonicalFacts` then `projectCompatibilityFromCanonicalFacts`. F2B carries R-162 lock-capacity hardening. F2C carries R-165 register text (now on `main`; still OPEN until F3 fences `available ?? 0`). Historical recommended merge order F2B then F2C is **complete**.

### 2.3 Internal F3 commit sequence (same PR, not extra PRs)

Tombstoning **must not** be active before webhook/refetch overlap protections exist. The absence-tombstone flag stays **DEFAULT OFF** through F3 merge unless a **later** explicit authorization enables it after overlap tests.

1. Additive schema: control-plane `SyncRun` paired checkpoint + submit-intent + count diagnostics; merchant `PROJECTION_PENDING` enum/default; `ingestBatchId` lookup indexes. Envelope / toml / job-type allowlists. `FEATURE_PR5_ABSENCE_TOMBSTONE` wired **DEFAULT OFF**.
2. Two-root scanner + exact `bulkOperationRunQuery` exception. **v1 catalog-sync cutover fence** so competing authority cannot execute.
3. JSONL streamer + BulkOperation submit/poll-by-persisted-GID + completeness gate + two-phase checkpoint. Nomination may collect candidates. **Zero terminal tombstones.**
4. Webhook sanitizers + authoritative refetch workers; fence legacy `available ?? 0` and forecast coupling on the canonical path. Overlap fixtures green.
5. Presence apply + absence **nomination** (still no tombstone while flag OFF).
6. Absence **confirmation / terminal tombstone** code may exist but **cannot write tombstones** while the flag is OFF. Enablement requires F3 overlap tests **and** explicit later authorization. **Do not enable the flag in this planning PR. Do not enable it by F3 merge default.**
7. `inventory-state-reconcile` worker (bulk / complete pagination, not N+1).
8. Compatibility projection trigger, `compatibilityProjectionState` writer, diagnostic reconciler, dual health.
9. Recovery, overlap races, scale/memory fixtures, focused CI steps.

If ChatGPT later judges F3 too large **after** F2B/F2C merge, the only allowable split is still **not** JSONL-vs-webhook. Ask ChatGPT first. Do not split overlap races.

---

## 3. Frozen interfaces F3 must consume (do not fork)

### 3.1 F2A reads

- Direct QUERY helpers in `admin-read/resources.ts`, `locations.ts`, `quantities.ts`.
- Bulk inner documents: `CATALOG_BULK_QUERY_WITH_UNIT_COST`, `CATALOG_BULK_QUERY_NO_UNIT_COST`, `INVENTORY_LEVEL_BULK_QUERY` (already `edges { node }` + inventory-level `item { id }` / `location { id }`). **Do not edit these documents.**
- `readBulkOperationById` — bind the **persisted** GID. Never `currentBulkOperation`.
- UnitCost preflight chooses with/without-unitCost **before** `bulkOperationRunQuery`.
- Pair identity: do **not** key inventory-level results by the requested pair unless the F2A identity cross-check succeeded. Do not substitute response IDs and continue.
- JSONL `__parentId` is **not** the InventoryLevel uniqueness key. Prefer `item.id` + `location.id` from the line; `__parentId` is a flatten aid only.
- `BulkOperationSnapshot` already carries `objectCount` / `rootObjectCount` as string tokens (`admin-read/types.ts`). Completeness uses those fields (P1-01).

F3 **does** add a submitter that calls `bulkOperationRunQuery` under the P1-05 exception. That mutation is **not** an inventory write. Inventory/product/transfer/cost mutations remain rejected.

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

**Named writer exception (P1-04):** F3 may extend the apply row / `writers.ts` mapping with **one field**: `compatibilityProjectionState`. On INSERT and on UPDATE when the canonical row changes, write `PROJECTION_PENDING`. Do not change clock, identity, occupancy, or lock fields.

Batching rule (brief §8.3 / F-CLAUDE-PR5C8-01): JSONL **read** chunk and canonical **apply** transaction are separate. Reader memory bound may exceed 32 parsed rows. One apply transaction default **32** identities, configurable downward, never above lock-capacity evidence. Never split one identity. Never unanchored fallback. Unique conflict retries the **full** apply algorithm (no `ON CONFLICT DO UPDATE`).

### 3.3 F2C projection

```text
projectCompatibilityFromCanonicalFacts({ authority, processingEnabled, mode, identities | cursor, ... })
```

F3 rules:

- Call **after** the canonical tenant transaction commits.
- Open a **new** TenantDb. Projection failure must not `ROLLBACK` canonical facts.
- Read live `Shop.processingEnabled` from the control-plane **immediately before** projection. A cached caller boolean is not production-safe (F2C-12).
- Persist merchant `compatibilityProjectionState` with the frozen advisory lock. `HEALTHY` is written **only** after successful projection of that identity/generation.
- Do not invent shop-level `HEALTHY` from F2C `status: "SUCCEEDED"` on a bounded page with `hasMore=true`.
- `resumeAfterQuarantineCursor` remains unusable until F3 durably quarantines/repairs the poison identity (F2CC-03 residue).
- Canonical facts are never readable as `HEALTHY` before successful projection (P1-04 / FX-PROJ-009).

Identity-set / generation bookkeeping: the diagnostic writer updates **only** the identities in the projection page that just succeeded. Other identities remain `PROJECTION_PENDING` or `DEGRADED`. Shop-level compatibility health is `HEALTHY` only when no open `COMPATIBILITY_PROJECTION_FAILED` issue remains **and** no in-scope identity is still `PROJECTION_PENDING`/`DEGRADED` for the completed work. A `shop_rebuild` page with `hasMore=true` never authorizes shop-level `HEALTHY`.

### 3.4 PR 4 control plane (do not redesign)

Preserve dispatcher, envelope v3, attempt lifecycle, receipts, dead letters, disabled-shop denial, R-122/R-123 posture, D-051 transaction-shape invariant.

Smallest extensions only:

- payload `catalog-facts-v1` (canonical catalog-sync). `catalog-sync-v1` fail-closed after cutover.
- webhook sources + sanitizers
- `SyncRun` BulkOperation GID + JSONL ordinal + submit intent + count diagnostics
- `inventory-state-reconcile` job type
- webhook-class claim preference inside existing fair-claim SQL (P2-11)
- explicit execution strategy for every new topic (P3-19)

Runtime remains **denied** `SyncRun` DML. Control-plane remains **denied** merchant-fact DML. No cross-role transaction.

---

## C. Frozen architecture contracts (closes F-CLAUDE-PR5F3EA-01..25)

### C1. P1-01 — JSONL completeness proof

A clean parser EOF **alone is insufficient**.

**Before ANY absence nomination, terminal tombstone, or success watermark / `SyncCursor` advance for a bulk domain, all of the following must hold:**

1. BulkOperation snapshot status is `COMPLETED`.
2. Complete `url` is present and `partialDataUrl` is null (existing F2A `canonicalSuccessEligible`).
3. Persist diagnostic `objectCount` and `rootObjectCount` from that snapshot onto the domain `SyncRun` as **string tokens** (same F2A `stringifyUnsignedCount` contract; never JavaScript `Number`).
4. Stream transfer completed without abort, reset, or truncation.
5. Every JSONL line parsed as JSON. No malformed line.
6. `streamedParsedLineCount` (every successfully parsed JSONL object, including Collection lines and inventory-level InventoryItem parent-link lines) **exactly equals** persisted `objectCount` as unsigned decimal strings.
7. `streamedRootLineCount` **exactly equals** persisted `rootObjectCount` as unsigned decimal strings.
   - Catalog bulk roots = lines whose GID prefix is `gid://shopify/Product/`.
   - Inventory-level bulk roots = lines whose GID prefix is `gid://shopify/InventoryItem/`.
   - Locations domain is **not** JSONL; completeness is F2A pagination exhausted (`hasNextPage=false` on the last page). Pagination completeness is independent of BulkOperation counts.

**If Shopify omits `objectCount` or `rootObjectCount` (null/empty):** **FAIL CLOSED**. No absence nomination. No tombstone. No completeness watermark. Domain `PARTIAL_FAILURE`.

**F-CLAUDE-PR5F3EC-02 (F3 implementation/review target, not a planning redesign):** before the unsigned-decimal string compare, both persisted count tokens MUST match `^[0-9]+$`. A non-conforming token is treated exactly as an omitted count (fail closed, zero nomination). Do not compare raw non-canonical strings.

**All of the following produce `PARTIAL_FAILURE`, zero nomination, zero tombstone, zero success watermark:**

- malformed line
- aborted transfer
- boundary-aligned truncation
- count mismatch
- unknown/unclassifiable line (P2-15)
- any stream without proven complete end (P2-10)

Prior committed canonical batches are retained. Checkpoint must **not** be acknowledged past the last fully applied **and** completeness-eligible point; on incompleteness the domain does not reach `SUCCEEDED`.

Planned fixtures:

- `FX-JSONL-010` — boundary-aligned truncation: HTTP body ends at a newline after `floor(0.99·N)` lines; no malformed JSON; complete `url`. Assert: no nomination, no watermark, `PARTIAL_FAILURE`.
- `FX-JSONL-011` — `objectCount` mismatch by one. Same assertion.

### C2. P1-02 — absence / tombstone operator kill switch

**Flag name:** `FEATURE_PR5_ABSENCE_TOMBSTONE`

**Mechanism:** existing `envFlag` pattern in `app/lib/feature-flags.server.ts`. **Default `false`.** Server-side check immediately before any terminal tombstone write. Runtime-disableable without a deploy.

**Not the same thing as:**

- the blast-radius circuit breaker (anomaly detector)
- inventory-write flags (`FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, etc.)
- shop `processingEnabled`

**While OFF:**

- presence application may run
- nomination may collect candidate evidence
- candidate rows may persist
- **zero terminal tombstones**
- domain health is honest: **not** `HEALTHY` deletion reconciliation (not-yet-reconciled / `DEGRADED`)

**While ON (later authorization only):** confirmation-to-tombstone may proceed under existing breaker + `ABSENT_CONFIRMED_QUERY` rules.

**Enablement requires** F3 overlap tests **and** explicit later authorization. This planning PR does **not** enable the flag. F3 merge default remains OFF. Internal sequencing (§2.3) must not make destructive tombstoning active before webhook/refetch overlap protections exist.

Breaker thresholds remain the brief’s engineering hypotheses: **250 absolute AND 2% of LIVE**, both must trip to abort. Configuration location in F3: control-plane shop settings fields `absenceBreakerAbsoluteCount` (default 250) and `absenceBreakerProportionBps` (default 200 = 2%), optional per-`syncDomain` override. They are **not** a substitute for the kill switch.

Acceptance fixture `FX-ABS-FLAG-OFF`: candidates may exist; tombstone count remains **zero**; health is honest / **not** `HEALTHY`.

### C3. P1-03 — three-domain presence ownership

**Chosen model:** each canonical resource type has **exactly one** nominated presence-authority domain. The existing one-slot `lastSeenFullSyncRunId` is **sufficient** if the non-owning domain never writes that column for that type.

| Resource type | Presence-authority domain | May write `lastSeenFullSyncRunId` | May nominate |
|---|---|---|---|
| Product / `ShopifyProductFact` | `catalog` | yes, catalog epoch only | catalog epoch only |
| ProductVariant / `ShopifyVariantFact` | `catalog` | yes, catalog epoch only | catalog epoch only |
| InventoryItem / `ShopifyInventoryItemFact` | `catalog` | yes, catalog epoch only | catalog epoch only |
| Location / `ShopifyLocationFact` | `locations` | yes, locations epoch only | locations epoch only |
| InventoryLevel / `ShopifyInventoryLevelFact` | `inventory_levels` | yes, inventory_levels epoch only | inventory_levels epoch only |

**InventoryItem in inventory-level JSONL:** parent-link only. Do **not** emit InventoryItem `full_sync` presence. Do **not** write `lastSeenFullSyncRunId`. Do **not** nominate InventoryItems from the `inventory_levels` epoch.

**No extra presence column is required** under this model. A merchant-side per-domain presence schema is **not** authorized.

Domain execution order inside the parent job: **locations → catalog → inventory_levels**.

Fixture `FX-ABS-003`: complete catalog epoch A, then inventory-level epoch B; catalog sweep must **not** mass-nominate valid InventoryItems.

### C4. P1-04 — no false compatibility `HEALTHY`

The two-value enum + `HEALTHY` default + F2B INSERT omitting the column produces `HEALTHY` before projection. A post-commit diagnostic `DEGRADED` write does **not** close the window.

**Authorized minimum F3 change (both legs; default-only is insufficient for updates):**

1. **Narrow additive merchant migration in F3:**
   - add enum value `CatalogCompatibilityProjectionState.PROJECTION_PENDING`
   - change the column default on all five fact models from `HEALTHY` to `PROJECTION_PENDING`
2. **Narrow F2B writer extension consumed in F3** (lifts §5.3 freeze for this named field only):
   - apply row includes `compatibilityProjectionState`
   - INSERT writes `PROJECTION_PENDING`
   - UPDATE that changes the canonical row writes `PROJECTION_PENDING`
   - do **not** redesign clocks, identity, occupancy, or lock order
3. Successful F2C projection for that identity/generation writes `HEALTHY` via the F3 diagnostic writer (separate TenantDb, after canonical commit).
4. Failed projection writes `DEGRADED` and does not roll back canonical facts.

§5.2 “SyncRun-only migration” is **amended**. Merchant enum/default/index changes listed in §5.2 are authorized.

Acceptance: `FX-PROJ-009` — first insertion is never externally `HEALTHY` before projection succeeds (read inside the canonical transaction and immediately after commit).

### C5. P1-05 — `bulkOperationRunQuery` scanner exception

**Not** a generic “mutations allowed in ingest”.

| Constraint | Frozen value |
|---|---|
| Exact authorized module path | `app/lib/catalog-facts/ingest/bulk-operation-submitter.ts` (one file; no glob; no prefix match) |
| Exact GraphQL root field | `bulkOperationRunQuery` |
| Inventory / product / transfer / cost mutations | still rejected in that file and everywhere else |
| Exception invoked from another module | **must fail** |

Authorize a named change to `app/lib/catalog-facts/admin-read/safety/{graphql-ast.ts,scan.ts}` adding `CANONICAL_SUBMIT_MUTATION_EXCEPTIONS` keyed on **exact root field AND exact module path**.

Tests (F3 runtime, specified now):

- authorized submitter with `bulkOperationRunQuery` **passes**
- same root field in a **different** ingest module **fails**
- `inventoryBulkToggleActivation` in the submitter module **fails**

### C6. P1-06 — two-root recursive scanner / R-163

Current F2A scan root is `app/lib/catalog-facts`. Workers were **never** inside it. The word “remain” is withdrawn.

**Two-root recursive scanner:**

| Root | Path | Import policy | Mutation policy |
|---|---|---|---|
| A | `app/lib/catalog-facts/**` | today’s deny-by-default (`@shopify/*` and `/services/` denied; current empty `CANONICAL_READ_IMPORT_EXCEPTIONS`) | all mutations denied except P1-05 |
| B | `app/jobs/workers/catalog-facts/**` | worker policy: **may** import `unauthenticated` from `app/shopify.server`; **must** reject Shopify inventory/product/transfer write services and unauthorized GraphQL mutations | same mutation policy as A, including P1-05 (worker tree cannot host the submitter exception; exception is exact-path to the submitter file under Root A) |

**R-163 remains globally OPEN** until F3 exact-head scanner evidence proves **both** roots. Not closed by F2A merge. Not closed by F2B/F2C merge. Not closed by this planning packet. Do **not** inherit PR #33 “closed for F2A lane” wording as global closure.

Planted tests: worker-tree `inventoryBulkToggleActivation`; worker-tree forbidden write-service import; legitimate `unauthenticated` import passes.

### C7. P1-07 — `catalog-sync-v1` competing authority

After F3 canonical sync is active (the F3 merge **is** the cutover; no dual-running authority):

Existing `catalog-sync-v1` **must not** execute:

- `startCatalogSync`
- `currentBulkOperation` polling / `pollBulkOperation`
- full-body `response.text()` / `split` ingestion
- legacy `shopifyVariantCache` authority writes

**Payload check:** worker **must** read `payloadSchemaVersion`, not job name only. Job name `catalog-sync` with `payloadSchemaVersion === "catalog-sync-v1"` **fails closed**.

**Queued v1 drain:**

- PENDING / RETRY_WAIT / DISPATCH_LEASED `catalog-sync-v1` jobs: worker entry dead-letters with stable outcome code `LEGACY_CATALOG_SYNC_V1_DISABLED`. **Zero** legacy authority writes.
- `JobReplay` that would re-run v1: same fail-closed.
- Existing `DeadLetter` v1 rows stay dead letters; they must not be replayed onto a live v1 applicator.

Canonical enqueue emits `payloadSchemaVersion: "catalog-facts-v1"` only.

**No live F3 path** reaches `pollBulkOperation` / `currentBulkOperation`.

**Permit F3 to modify** (cutover enforcement): `app/services/shopify-sync.server.ts`, `app/services/shopify-gql.server.ts`, `app/jobs/queue.server.ts`, `app/jobs/workers/webhook-processor.ts`.

Fixtures:

- `FX-BULK-010` — v1 job after cutover → zero `shopifyVariantCache` writes
- `FX-BULK-011` — no live path reaches `pollBulkOperation`

### C8. P1-08 — checkpoint GID pairing + `ingestBatchId`

`bulkOperationGid` and `jsonlCommittedLineOrdinal` are **one logical checkpoint identity**.

Rules:

- When a new BulkOperation GID is persisted, `jsonlCommittedLineOrdinal` resets **atomically** to `NULL` in the **same** control-plane transaction.
- An ordinal from operation A can **never** skip lines from operation B.
- Resume compares the polled GID to the persisted GID and **fails closed** on mismatch (`FX-BULK-013`).
- Semantics: **1-based last fully acknowledged line**; `NULL` before any acknowledgement (P3-18).
- Checkpoint may **lag** facts, never **lead**.
- **No HTTP Range.** Resume re-streams from byte 0.

Expired URL: mark the current domain `SyncRun` **not** `SUCCEEDED` (`PARTIAL_FAILURE` / `FAILED`). Allocate a **new** domain `SyncRun` (new id, new fence, new GID, null ordinal). Do not reuse a burned fence. Nomination runs only against a proven-complete owning-domain epoch (C1 + brief §8.5).

**`ingestBatchId` derivation (deterministic):**

```text
ingestBatchId = hex(sha256(
  "f3-ingest-v1" || "\n" ||
  syncRunId || "\n" ||
  bulkOperationGid || "\n" ||
  String(startLineOrdinal)
))
```

`startLineOrdinal` is the 1-based first line of that apply batch. Sufficient to recognize a committed orphan batch during byte-zero replay: lookup facts by `(shopId, ingestBatchId)`. Same derivation on replay yields the same id.

**Uniqueness / idempotency:** many facts share one `ingestBatchId`. Authorize merchant `@@index([shopId, ingestBatchId])` on the five fact models. Replay of the same batch is Clock-A / presence idempotent; the index is lookup, not a single-row unique key.

Fixture `FX-BULK-012`: stale ordinal + new GID on the same `SyncRun` row (if a replacement GID is ever persisted on the same row) must reset ordinal; resume must not skip. Combined with the expired-URL **new SyncRun** rule, replacement on the same row is limited to the atomic persist/reset path (submit recovery attaching a GID — C9 — which starts at ordinal `NULL`).

### C9. P2-09 — orphan Shopify BulkOperation

Crash after Shopify accepts `bulkOperationRunQuery` but before GID persistence must be recoverable **without** `currentBulkOperation`. No guessing.

**Frozen recovery:**

1. **Pre-submit intent (control-plane, before the mutation):** persist `bulkSubmitIntentAt` and `bulkQueryFingerprint` (`sha256` of the exact GraphQL query string + `groupObjects:false` + `shopId`) on the domain `SyncRun`.
2. Call `bulkOperationRunQuery`.
3. Persist returned GID in a subsequent control-plane transaction, atomically with ordinal `NULL`.
4. If crash between (2) and (3): recover with official QUERY `bulkOperations(first: 25)` — **not** `currentBulkOperation`. F3 ingest recovery module issues this QUERY. Bounded `first: 25`.
5. **Adoption rule:** attach the GID only when **exactly one** returned node matches:
   - `query` fingerprint equals persisted `bulkQueryFingerprint`
   - `createdAt` ∈ `[bulkSubmitIntentAt − 5s, bulkSubmitIntentAt + 120s]`
   - status ∈ `CREATED | RUNNING | COMPLETED | FAILED | CANCELED | EXPIRED` (attach even terminal statuses so a second submit is not issued)
6. Zero matches: **do not** submit a second operation. Wait using the C11 poll ceiling against the list query. Then `PARTIAL_FAILURE` / operator.
7. More than one match: **FAIL CLOSED**. No attach. No second submit.

Fixture `FX-BULK-014`: mutation accepted, GID not persisted; recovery attaches the unique matching operation or waits/fails closed; never calls `currentBulkOperation`.

### C10. P2-10 — malformed stream == partial bulk

Explicitly: malformed line, aborted transfer, truncated transfer, count mismatch, unknown line, or any stream without proven complete end **ALL** mean:

- `PARTIAL_FAILURE`
- zero nomination
- zero tombstone
- zero success watermark

`FX-JSONL-006` asserts **zero nominations**, not only “domain DEGRADED”. Prior committed batches retained.

### C11. P2-11 — webhook anti-starvation / bounded polling

PR4 fair claim is per-shop FIFO, **not** a webhook-class reservation. The following mechanism is **frozen** (not optional “or”):

1. **Webhook-class claim preference:** fair-claim `ORDER BY` within a shop prefers webhook-class jobs before `catalog-sync` and `inventory-state-reconcile`, then existing FIFO (`nextEligibleAt`, `createdAt`, `id`).
2. **Deferral:** catalog-sync continuation and reconcile **enqueue** are deferred while that shop has any `PENDING` / `RETRY_WAIT` / `DISPATCH_LEASED` webhook-class DurableJob.
3. **Webhook-class** = F3 resource topics in C19 with strategy `ATOMIC_APPLICATION_RECEIPT`. `bulk_operations/finish` is CONTROL_ONLY and is **not** webhook-class for this reservation.
4. **Bounded poll:** interval **5s**, max **120** attempts, wall-clock ceiling **600s**. Exceeding the ceiling → `PARTIAL_FAILURE`, no nomination, no watermark.
5. **Polling releases the queue claim between attempts:** the job must not sleep 10 minutes on a held claim. Each poll unit completes and the continuation is re-enqueued with delay 5s (or equivalent scheduled continuation) so webhook jobs can claim.

Fixture `FX-WH-011`: one shop, catalog-sync in poll-wait plus inbound `inventory_levels/update`; webhook job is claimed and completes refetch; catalog-sync does not hold the per-shop claim slot during the wait.

### C12. P2-12 — shop disabled mid-ingest

Between canonical batches:

1. Re-read live `processingEnabled` from the control plane.
2. Verify affected-row counts for the merchant apply.
3. If the shop is disabled **or** RLS produces zero merchant writes because the shop is disabled: **STOP**.
4. Do **not** acknowledge the checkpoint.
5. Do **not** advance the watermark.
6. Do **not** call the domain or parent job successful.

Fixture `FX-JSONL-012`: disable the shop mid-stream; checkpoint does not advance; no success watermark.

### C13. P2-13 — search gates cover the whole application

Do **not** scope forbidden-pattern gates only to F3 directories.

Scan the **whole relevant application tree** under `stocky-plus/app/**` (and F3 scripts that emit production modules) for:

- `available ?? 0`
- `currentBulkOperation`
- full-body catalog ingestion `response.text()` (catalog JSONL path)

Canonical path gets **no** exception.

Temporary legacy occurrences may survive **only** on an explicit reviewed allowlist, and only until the C7 cutover removes them from every live path. After cutover the allowlist for those three patterns is **empty** on live paths. Characterization-only test fixtures may match the strings inside test files; production modules may not.

This is required for R-165 and v1 cutover evidence.

### C14. P2-14 — three-domain execution / retry topology

**Frozen (not “or”):**

| Question | Decision |
|---|---|
| Topology | **One** parent DurableJob `catalog-sync` with `payloadSchemaVersion: "catalog-facts-v1"`. **Three child `SyncRun` rows** (`locations`, `catalog`, `inventory_levels`) executed as child units **inside** that one durable job — not three separately dispatched DurableJobs. |
| Sequence | `locations` → `catalog` → `inventory_levels` |
| Parent success | Parent succeeds only when all three domain `SyncRun`s are `SUCCEEDED` |
| Retry | `REBUILDABLE_IDEMPOTENT` on the parent. **Reuse already-`SUCCEEDED` domains.** Re-run **failed/incomplete domain only**. Do **not** re-submit Shopify bulks for succeeded domains. |
| New fence | Only when starting a **new** BulkOperation for a domain that did not succeed. Never reuse a burned fence. |
| Partial exposure | Per-domain `SyncRun.status` + parent not `SUCCEEDED`. Merchant catalog-sync health is **not** `HEALTHY` until all three succeeded. |
| Amplification | No retry amplification by rerunning already-complete Shopify bulks |

### C15. P2-15 — JSONL line discrimination

Frozen bulk documents do **not** select `__typename`. Classifier = **GID prefix**. Do not guess.

| Prefix | Disposition |
|---|---|
| `gid://shopify/Product/` | Product `full_sync` (catalog domain; catalog owns presence) |
| `gid://shopify/ProductVariant/` | ProductVariant `full_sync` (catalog) |
| `gid://shopify/InventoryItem/` | **Catalog JSONL:** InventoryItem `full_sync` (catalog owns presence). **Inventory-level JSONL:** parent-link only — do **not** write presence / do **not** nominate (C3) |
| `gid://shopify/Location/` | Location (locations domain). Locations full-sync itself uses F2A pagination, not this bulk; if a Location line appeared in a bulk it would still classify here |
| `gid://shopify/InventoryLevel/` | InventoryLevel `full_sync` (inventory_levels owns presence). Pair identity from `item.id` + `location.id` on the line |
| `gid://shopify/Collection/` | Ignore for identity (lineage/collections on product only). Still counted in `streamedParsedLineCount` |
| Unknown / unclassifiable / missing id | **Fail closed** → stream incomplete → `PARTIAL_FAILURE` (C1/C10). Do not guess |

### C16. P2-16 — capacity concurrency derives from real writer fan-out

Do **not** hardcode or treat `PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS = 4` as deployment truth. That constant is a **unit-test default** when the evaluator is invoked without the field.

**Derivation (frozen):**

```text
D = STOCKY_DISPATCHER_PROCESS_COUNT
    (required positive integer in F3 worker config; fail closed if unset/invalid)
B = dispatch batchSize in effect
    (default DEFAULT_DISPATCH_BATCH_SIZE = 50)
M = maxPerShop in effect
    (default DEFAULT_MAX_PER_SHOP = 2)

Canonical writer classes sharing the lock pool (each job opens at most one
merchant canonical or diagnostic transaction at a time; projection uses a new
TenantDb after canonical commit, so peak per job = 1):
  - catalog-facts-v1 JSONL apply
  - webhook ATOMIC_APPLICATION_RECEIPT refetch apply
  - inventory-state-reconcile apply
  - absence confirmation apply (counted even while flag OFF)
  - diagnostic projection-state writer

configuredWorstCaseConcurrentCanonicalTransactions = D * B
```

**F-CLAUDE-PR5F3EC-01 (F3 implementation/review target, not a planning redesign):** `D * B` over-approximates when `B` exceeds aggregate worker concurrency and would **under**-approximate if a deployment lowered `batchSize` below that sum. F3 must implement `D * max(B, Σ worker concurrency across canonical-writer queues)` **or** fail closed at startup if `B < Σ worker concurrency`. `FX-RACE-AW` already exercises the derived value.

F3 **must** pass this derived value into `evaluateCanonicalLockCapacity`. If condition B is unsafe at 32 identities, reduce identities-per-transaction (existing evaluator). Do **not** raise PostgreSQL settings from app code.

`FX-RACE-AW` uses the **derived** deployment envelope from the test harness’s actual `D` and `B`, not merely evaluator default 4.

`M` remains the per-shop claim cap and is part of the webhook-starvation design (C11); it does not replace `D * B` as the lock-pool envelope.

### C17. P2-17 — stale control records

Corrected in §0 and in PR #32’s own `PROJECT_STATUS.md` / `phases/phase-1/README.md` edits. Do **not** claim F2B missing its final correction review. Do **not** claim F2C’s second-correction review is on the historical isolated PR #30 head as the current-main review. Do **not** claim F2B or F2C remains unmerged. Current facts: F2B and F2C are **MERGED**; F2C current-main review is **on this branch**.

### C18. P3-18 — `jsonlCommittedLineOrdinal` representation

**Pin `Int?`.** A bulk result exceeding 2^31 lines is not a supported shape.

- 1-based last fully acknowledged line
- `NULL` before any acknowledgement
- `CHECK (jsonlCommittedLineOrdinal IS NULL OR jsonlCommittedLineOrdinal >= 1)`
- monotonic non-decreasing **within one BulkOperation GID**
- reset **only** when GID changes, under the paired-checkpoint rule (C8)

### C19. P3-19 — `bulk_operations/finish` strategy

**Chosen:** `CONTROL_ONLY`. Not a second applicator. Not `ATOMIC_APPLICATION_RECEIPT`.

- Lookup index: `SyncRun @@index([shopId, bulkOperationGid])`
- Webhook worker: no merchant DML
- Looks up `(shopId, bulkOperationGid)` and **signals continuation** of the existing `catalog-facts-v1` catalog-sync DurableJob bound to that GID (enqueue/wake the existing run; poll/download already bound to that GID)
- Topic must be registered in `shopify.app.toml`
- Unknown topics remain fail-closed `NO_AUTOMATIC_RETRY`

**Every new topic’s strategy (explicit):**

| Job type / topic | Strategy |
|---|---|
| `webhook:products/create` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:products/update` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:products/delete` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_items/create` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_items/update` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_items/delete` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_levels/connect` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_levels/update` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:inventory_levels/disconnect` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:locations/create` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:locations/update` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:locations/delete` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:locations/activate` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:locations/deactivate` | `ATOMIC_APPLICATION_RECEIPT` |
| `webhook:bulk_operations/finish` | `CONTROL_ONLY` |
| `webhook:app/uninstalled` | `CONTROL_ONLY` (existing) |
| `catalog-sync` (`catalog-facts-v1`) | `REBUILDABLE_IDEMPOTENT` |
| `catalog-sync` (`catalog-sync-v1`) | fail closed / dead-letter; must not run the v1 applicator (C7) |
| `inventory-state-reconcile` | `REBUILDABLE_IDEMPOTENT` |

Add every `ATOMIC_APPLICATION_RECEIPT` topic to `WEBHOOK_ATOMIC_TOPICS`. Add `bulk_operations/finish` beside `app/uninstalled` as `CONTROL_ONLY`.

### C20. P3-20 — application receipt / digest for authoritative refetch

Webhook body is **not** canonical fact and **not** the application-receipt digest basis.

**Application receipt `payloadDigest`** (argument to `applyWithApplicationReceipt`) is SHA-256 of canonical JSON:

```text
{
  schema: "catalog-facts-refetch-application-v1",
  applyingDurableJobId,
  topic,
  shopId,
  resolvedIdentities: sorted unique GIDs or pair keys actually used for the refetch/apply
}
```

Stable delivery/application identity + resolved identity set. Do **not** include APPLIED vs NOOP in the digest (concurrent writers must not change the digest). DurableJob intake `payloadDigest` (sanitized webhook projection) is unchanged PR4 behavior and is a **different** field.

A canonical **no-op** after refetch **still** receives an application receipt so replay cannot loop.

Receipt remains the **final tenant transaction write** where PR4 requires it (`applyWithApplicationReceipt`).

### C21. P3-21 — session advisory-lock static gate

Forbidden (session-scoped):

- `pg_advisory_lock(`
- `pg_try_advisory_lock(`
- `pg_advisory_lock_shared(`
- `pg_try_advisory_lock_shared(`

Allowed: approved `pg_advisory_xact_lock` / `pg_try_advisory_xact_lock` variants only.

Search pattern: `pg_(try_)?advisory_lock(_shared)?\(` while excluding `pg_advisory_xact_lock`.

### C22. P3-22 — `SyncCursor` semantics for completed bulk domains

There is **no** Shopify cursor for bulk JSONL. Do not invent one.

`cursorValue` for a **successful** full-sync epoch:

```text
full-sync-epoch:<SyncRun.id>
```

App-owned epoch token. Written **only** when brief §8.5 holds **and** C1 completeness holds.

Attempted / incomplete run: **do not write or overwrite** `SyncCursor`. Previous successful cursor remains, or null if never succeeded.

Locations pagination may store the F2A page cursor **during** an in-progress run on `SyncRun.cursorAfter` (control-plane run state), not as a successful domain `SyncCursor` until pagination completeness.

### C23. P3-23 — retry topology and ceilings

**Projection:** existing **PR4 attempt lifecycle** on the same catalog-sync / webhook job’s post-canonical step. **Not** a dedicated continuation job. Retry must not re-apply canonical facts.

**Bulk polling:** 5s / 120 attempts / 600s wall (C11). Release claim between attempts.

**Reconcile freshness:** coalesce to **at most one** pending `inventory-state-reconcile` job per shop. Minimum enqueue interval **15 minutes**. 60-minute figure remains an **engineering test target**, not a merchant SLO (R-034 remains PR 8). No unbounded enqueue.

No unbounded queue/provider spend. Shopify five-concurrent bulk ceiling is respected by C14 failed-domain-only retry + C9 no double-submit.

**NEW-CLAUDE-F2CCM-01 carry-forward (clarification of this already-approved retry contract, not a redesign):** Product is a **terminal** resource. A terminal Product revival requires **two non-overlapping** authoritative LIVE confirmations. Therefore F3 retry / reconcile budgeting must **not** assume Product convergence in a single observation cycle. The bounded retry topology must allow the required two-confirmation revival path **before** treating `canonical_product_not_live` as exhausted. Lower bound: **at least two full observation cycles**. A single LIVE observation yields `terminal_first_confirmation` and leaves the Product fact ABSENT; child variants keep failing retryable `canonical_product_not_live` across that intermediate state. This sharpens retained `NEW-CLAUDE-F2CC2-01` rather than replacing C23 ceilings.

### C24. P3-24 — PR #32 / PR #33 serialization

Both touch `PROJECT_STATUS.md` and phase README. PR #33 also overlaps `RISK_REGISTER.md` and `DECISIONS.md`.

**Do not merge PR #33 from this packet. Do not edit PR #33. Do not merge this PR from this packet.**

PR #32 is the runtime-critical planning/control packet and goes first. After PR #32 is merged, PR #33 will be refreshed separately onto the resulting `main`.

Durable ordering:

1. F2B then F2C runtime merges — **DONE** (`0284b66…` then `f984169…`)
2. this docs/control PR (#32) — ChatGPT merge decision; user merge still required
3. refresh the remaining docs PR (#33) against then-current main

Do not independently resolve overlapping control docs in parallel.

### C25. P3-25 — PR6 governance

**PR6 RUNTIME** remains blocked until PR5 closes.

**Explicitly authorized one dependency level ahead** under Accelerated Safe Delivery v1:

- PR6 planning
- architecture
- acceptance criteria
- fixtures
- test matrices

Those must be marked **speculative** until PR6’s own gate. They are **not** a governance violation.

Forbidden until PR5 closes: PR6 runtime, migrations, Shopify configuration, production actions.

Do **not** read “No PR 6” as a ban on authorized PR6 planning.

---

## 4. Remaining work packages (F3)

### 4.1 Bulk JSONL streaming / bounded memory

**Must:**

- HTTP stream + line reader. No `response.text()` + `split('\n')` of the full body.
- O(batch) memory, not O(catalog). Planning heap ceiling: **256MB** for a multi-hundred-thousand-line fixture.
- Re-stream from byte 0 on resume. **No HTTP Range.**
- Keep only the current parent node in memory (official JSONL: parents before children). Do not materialize `variants[]` for a product.
- Skip already-acknowledged lines **without buffering them**, using the **paired** GID+ordinal checkpoint (C8).
- Completeness gate C1 before nomination/watermark.
- Discriminate lines by C15.

**Must not:**

- One GraphQL call per row.
- One DB transaction per row as the steady-state pattern.
- Bind `currentBulkOperation`.
- Nominate or watermark an unproven stream (C1/C10).

### 4.2 BulkOperation result ingestion

Worker sequence:

1. Control-plane transaction: persist submit intent (`bulkSubmitIntentAt`, `bulkQueryFingerprint`); `SELECT nextval('stocky_catalog_observation_gen_seq')`; persist `fenceGeneration` + `fenceAt`; **COMMIT**.
2. Only then `bulkOperationRunQuery` from `app/lib/catalog-facts/ingest/bulk-operation-submitter.ts` with F2A inner document; `groupObjects: false`.
3. Persist exact returned GID on that `SyncRun`, atomically resetting ordinal to `NULL`.
4. Poll `bulkOperation(id:)` using that GID (F2A helper). `bulk_operations/finish` is CONTROL_ONLY continuation (C19). **Release claim between poll waits** (C11).
5. Completeness gate C1. Only then stream/apply may be treated as a complete epoch.
6. `COMPLETED` + `partialDataUrl` and/or missing complete `url` → **no canonical apply of that result as complete, no candidate nomination, no tombstone, no success watermark**. `PARTIAL_FAILURE`.
7. `FAILED` / `CANCELED` → same prohibition.
8. Expired URL → new domain `SyncRun` + new fence + new GID (C8).
9. Orphan recovery C9 if GID never persisted.

Five concurrent bulk queries per shop is an official 2026-07 ceiling. Bind each `SyncRun` to its own GID. Reconcile + catalog + inventory-level must not starve webhook jobs (C11).

### 4.3 Canonical apply batching

JSONL / page mapper emits `full_sync` observations **only for the owning domain’s resource types** (C3/C15). Direct refetch mapper emits `direct` observations with in-flight token + interval allocated **before** Shopify I/O and **after** usable response, then lock (Race S).

Apply:

```text
derive configuredWorstCaseConcurrentCanonicalTransactions (C16)
evaluateCanonicalLockCapacity → order identities → applyCanonicalFactsWithRetry
```

Presence (`lastSeenFullSyncRunId`) advances even when Clock A no-ops (Race A / K), **only** for the owning domain.

`compatibilityProjectionState` is `PROJECTION_PENDING` inside that same canonical transaction (C4).

Shop currency: once per catalog-sync, `shop { currencyCode }` stamped onto Money fields that lack field currency. Currency change requires full catalog restamp, not mixed incremental provenance.

Between batches: C12 processingEnabled + affected-row checks.

### 4.4 SyncRun / cursor / checkpoint acknowledgement

Additive **control-plane** schema (F3, nullable, no production backfill):

| Column | Type | Purpose |
|---|---|---|
| `bulkOperationGid` | `VarChar(512)?` | Exact GID. Do not overload `cursorAfter`. |
| `jsonlCommittedLineOrdinal` | `Int?` | 1-based last acknowledged JSONL line (C18). |
| `bulkSubmitIntentAt` | `DateTime?` | Pre-submit intent (C9). |
| `bulkQueryFingerprint` | `VarChar(64)?` | SHA-256 hex of submitted query (C9). |
| `bulkObjectCount` | `VarChar(32)?` | Snapshot `objectCount` string token. |
| `bulkRootObjectCount` | `VarChar(32)?` | Snapshot `rootObjectCount` string token. |
| `streamedObjectCount` | `VarChar(32)?` | Counted JSONL objects. |
| `streamedRootObjectCount` | `VarChar(32)?` | Counted roots. |

Indexes: `@@index([shopId, bulkOperationGid])`. CHECK on ordinal (C18).

Two-phase only (brief §6.F.11):

1. Runtime/merchant: apply bounded batch; persist deterministic `ingestBatchId` on facts; **COMMIT**.
2. Control-plane: advance `jsonlCommittedLineOrdinal` **only if** processingEnabled still true and affected-row counts matched (C12).

Crash between: resume re-streams from 0; idempotently recognizes the orphan batch via deterministic `ingestBatchId`; acknowledges; continues. Runtime cannot obtain atomicity by DML on `SyncRun` (Race Y).

Domain watermarks (`SyncCursor`) advance only when brief §8.5 **and** C1 hold. Value is `full-sync-epoch:<SyncRun.id>` (C22). Locations, catalog, and inventory_levels watermarks are independent. Catalog-sync job success requires all three domain runs succeeded (C14).

### 4.5 Webhook authoritative refetch application

```text
HMAC → PR4 durable intake → DurableJob PENDING → dispatcher / envelope v3
  → processingEnabled
  → identity from sanitizer (GID preferred; REST id fallback)
  → authoritative GraphQL refetch OR confirmed-absence check
  → tenant txn: applyCanonicalFacts (clocks A/B; signal lineage clock C only)
               + PROJECTION_PENDING on changed rows
               + application receipt as FINAL write (C20)
  → projection (separate TenantDb)
```

Topics: C19. Resource rules remain brief §10.3. Load-bearing constraints:

- Webhook body is **never** canonical truth. Product webhooks include at most the first 100 variants.
- Delete/disconnect topics are **signals**. Tombstone only after `ABSENT_CONFIRMED_QUERY` **and** `FEATURE_PR5_ABSENCE_TOMBSTONE=ON`. Delayed delete after live refetch must not tombstone (Race H). Query failure is not deletion (Race N).
- `inventory_levels/update` **must refetch all eight quantity names**. Ignore webhook `available` as complete truth.
- `inventory_levels/disconnect` official sample is `{ inventory_item_id, location_id }` only. Map onto `(shopId, inventoryItemGid, locationGid)`. One pair row (Race X). Reconnectable.
- Remove forecast / ABC / low-stock from the **canonical** inventory webhook path (brief §11). Characterization tests keep current forecast defaults when `computeForecast` is invoked directly.
- Fence or remove `available ?? 0` on the canonical path (R-165). Canonical unknown availability must not become Shopify zero. Whole-tree search gate (C13).

### 4.6 Full-sync fence / presence completion

Fence generation is allocated and committed **before** Shopify I/O. JSONL lines reuse `SyncRun.fenceGeneration`. Do not copy fence into fact existence-interval columns.

Success requires brief §8.5 **and** C1. Partial/unproven bulk never nominates (C1/C10). Presence marker still advances on observed GIDs whose attributes no-op (Race K), **owning domain only** (C3). Post-fence creates with `existenceRequestGen > fenceGeneration` are not nominated (Race B).

### 4.7 Deletion / absence confirmation

Nomination is SQL against `lastSeenFullSyncRunId` + `fenceGeneration` vs `existenceRequestGen` (READ COMMITTED sweep, Race AA), **scoped to the owning domain and resource type** (C3). Never an in-memory GID set. Never Shopify `updatedAt` vs `fenceAt`. Never bulk omission alone. Never an unproven stream (C1).

Circuit breaker (count **and** proportion of LIVE rows): trip → **zero** tombstones, domain `DEGRADED`, no `HEALTHY` deletion reconciliation (Race V).

`FEATURE_PR5_ABSENCE_TOMBSTONE` DEFAULT OFF (C2): nomination may persist candidates; **zero tombstones**.

When later enabled: bounded batched confirmation via F2A existence queries. Completed null → `ABSENT_CONFIRMED_QUERY` (Race W). Overlapping LIVE keeps LIVE (Race AL). Terminal GIDs: two **non-overlapping** LIVE confirmations + `createdAt` match where available (Race AB). InventoryLevel pairs remain reconnectable (Race J). Product is a terminal resource; F3 retry / reconcile budgeting must allow that two-confirmation revival path before treating `canonical_product_not_live` as exhausted (C23 / NEW-CLAUDE-F2CCM-01).

### 4.8 Inventory-state reconciliation

New job `inventory-state-reconcile`, `REBUILDABLE_IDEMPOTENT`, tenant envelope, existing dispatcher.

Because official 2026-07 docs state that `committed`, `reserved`, `damaged`, `safety_stock`, and `quality_control` **do not trigger webhooks**:

- Prefer bulk inventory-level extraction or another **complete** mechanism.
- No per-item / per-level GraphQL polling as the design.
- Debounce levels recently refetched by `inventory_levels/update`.
- Coalesce duplicate reconcile jobs per shop (at most one pending).
- Min interval 15 minutes (C23). 60-minute figure is an **engineering test target**, not a merchant SLO (R-034 remains PR 8).
- Per-name Clock A: stale reconcile cannot rewind a newer quantity.
- Defer enqueue while webhook-class backlog exists for that shop (C11).

### 4.9 Recovery / restart

Mandatory crash boundaries (brief D2) plus C9/C12:

| Crash | Required outcome |
|---|---|
| Kill before merchant batch commit | Resume re-applies the batch; no silent skip |
| Kill after merchant commit / before control-plane ack | Facts retained; checkpoint lags then catches up; never leads; orphan batch recognized via deterministic `ingestBatchId` |
| Re-stream from 0 without Range | Idempotent Clock A + presence |
| Expired result URL | New domain SyncRun + new fence + new GID; old run not `SUCCEEDED` |
| Hard-crash in-flight observation | F2B lease/abandonment rules; F3 must not hold locks across Shopify I/O |
| Uninstall / `processingEnabled=false` | Fail-closed; no merchant writes; checkpoint does not advance (C12) |
| Submit accepted, GID not persisted | C9 recovery; never `currentBulkOperation` |

### 4.10 Compatibility projection triggering / recovery

After each successful canonical identity batch (and after shop_rebuild pages for recovery):

1. Canonical commit already durable with `PROJECTION_PENDING` (C4).
2. `projectCompatibilityFromCanonicalFacts` on a new TenantDb.
3. On success **and** projection matching those facts: set `HEALTHY` for those identities only.
4. On failure: set/leave `DEGRADED`; do not roll back canonical; bounded retry via **PR4 attempt lifecycle** (C23). Retry must not re-apply canonical facts.
5. Bounded diagnostic reconciler projects/closes `DataIssue` (`COMPATIBILITY_PROJECTION_FAILED`) and dual `SyncHealth` (canonical domain vs compatibility domain). Crash before `DataIssue` write must not report false `HEALTHY` after reconciliation (Race Z).
6. Orphan legacy cache/snapshot rows are **not** deleted in F3 (R-142). `shop_rebuild` must not treat orphans as canonical authority.
7. Poison identity: durable quarantine/repair **before** using `resumeAfterQuarantineCursor`.

### 4.11 Merchant-visible health / degraded

`DataIssue` / `SyncHealth` are derived, not atomic authority (brief §6.F.12). Merchant-durable columns are the source of honesty:

- `attributeFreshnessState`
- `compatibilityProjectionState`
- `existenceDiagnosticState`
- absence-nomination / circuit-breaker markers
- `FEATURE_PR5_ABSENCE_TOMBSTONE` OFF ⇒ deletion reconciliation is **not** `HEALTHY`

Rules:

- Canonical domain may be internally current while compatibility health is `DEGRADED` / `PROJECTION_PENDING`. Diagnostics must show both.
- Do **not** claim Buying Table / barcode cache / today’s `InventorySnapshot` healthy while projection is pending, stale, or failed.
- Circuit-breaker abort is **not** `HEALTHY` deletion reconciliation.
- Default must not leak `HEALTHY` without an explicit successful projection write (C4).
- Disabled shop remains `DISABLED` / fail-closed.

No new merchant UI overhaul is required to close PR 5 if existing SyncHealth / DataIssue surfaces already expose DEGRADED. F3 must not add a “all green” banner that ignores compatibility or incomplete deletion reconciliation.

---

## 5. File ownership (F3)

### 5.1 Exclusive new trees

| Path | Role |
|---|---|
| `stocky-plus/app/lib/catalog-facts/ingest/**` | JSONL streamer, BulkOperation submitter (`bulk-operation-submitter.ts` only), list recovery QUERY, two-phase checkpoint client split, observation mappers, completeness gate |
| `stocky-plus/app/lib/catalog-facts/apply/projection-state.ts` (new file only) | Diagnostic writer for `compatibilityProjectionState` / related merchant diagnostics under frozen advisory lock |
| `stocky-plus/app/jobs/workers/catalog-facts/**` | `catalog-facts-v1` catalog-sync, resource refetch, inventory-state-reconcile, diagnostic reconciler |
| `stocky-plus/scripts/tenant-enforcement/tests/pr5-f3-*.test.ts` | PostgreSQL integration / races |
| `stocky-plus/app/lib/catalog-facts/ingest/**/*.test.ts` | Unit streamer / mapper / memory tests |
| `stocky-plus/docs/phases/phase-1/PR5_F3_*` | Implementation / review reports (runtime PR only) |

### 5.2 Smallest compatible extensions (shared files)

Edit only what the allowlist requires:

- `app/jobs/workers/webhook-processor.ts` — route new topics; **payloadSchemaVersion** cutover; remove canonical-path forecast/`?? 0`; delegate to catalog-facts workers; fail-closed v1
- `app/services/shopify-sync.server.ts` — hard-disable / remove from every live path: `startCatalogSync`, `runBulkProductSync`, `ingestBulkVariantCache`
- `app/services/shopify-gql.server.ts` — hard-disable / remove from every live path: `pollBulkOperation` / `currentBulkOperation`
- `app/jobs/queue.server.ts` — enqueue `catalog-facts-v1` only
- `app/sync/sanitize.server.ts`, `app/tenant/job-envelope.server.ts`, `app/sync/execution-strategy.server.ts`, `app/sync/fair-claim-query.server.ts`
- `app/lib/feature-flags.server.ts` — add `FEATURE_PR5_ABSENCE_TOMBSTONE` default false
- `scripts/sync-control-plane/manifest.ts`
- `shopify.app.toml` topics
- `prisma/schema.prisma` + additive migrations:
  - control-plane `SyncRun` columns/index/CHECK in C4/C8/C9/C18/C19
  - merchant: `PROJECTION_PENDING` enum value + default change; `@@index([shopId, ingestBatchId])` on five fact models
- `app/lib/catalog-facts/apply/writers.ts` — **named field only:** `compatibilityProjectionState` (C4)
- `app/lib/catalog-facts/admin-read/safety/{graphql-ast.ts,scan.ts}` — P1-05 exception + two-root scan (C5/C6)
- `app/sync/health.server.ts` — dual canonical vs compatibility health; no false HEALTHY
- `.github/workflows/ci.yml` — focused F3 steps that run **nonzero** tests; whole-tree search gates (C13/C21)
- `PR2_TENANT_ACCESS_INVENTORY.md` — mechanical regen only

### 5.3 Forbidden to rewrite (except named exceptions above)

- `app/lib/catalog-facts/admin-read/**` except imports **and** the named safety-scanner exception (C5/C6). Do **not** edit frozen bulk QUERY documents.
- `app/lib/catalog-facts/apply/{clocks,existence,fencing,first-live,money}.ts`
- `app/lib/catalog-facts/apply/writers.ts` except the `compatibilityProjectionState` field (C4)
- `app/lib/catalog-facts/compatibility-projection/**` except imports
- PR 4 dispatcher / envelope major version (fair-claim ORDER BY preference in C11 is a smallest extension, not a major version)
- Forecast formulas, ABC, inventory-write flags, PR6 order/refund facts
- `RISK_REGISTER.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md` in this planning PR
- Immutable review artifacts, including `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md`

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
| **A** | Delayed bulk vs newer incremental attributes | F2B engine | JSONL bulk row after webhook refetch; attributes no-op; presence advances (owning domain) |
| **B** | Post-fence create not nominated | F2B fence vs direct | Full-sync omission + later LIVE refetch with `requestGen > fenceGeneration` |
| **C** / **I** | Confirmed absence vs late older bulk | F2B | JSONL resume after `ABSENT_CONFIRMED_QUERY` |
| **D** / **O** | `partialDataUrl` / failed bulk | F2A poll contract | Ingest worker must **not** stream/apply/nominate; C1/C10 extend this to all unproven streams |
| **E** | Two-phase checkpoint crash | **none** | Mandatory D2 PostgreSQL crash fixture + deterministic `ingestBatchId` |
| **F** | Projection failure after canonical commit | F2C isolation core | Worker path: canonical retained; never `HEALTHY` before projection (C4 / FX-PROJ-009) |
| **G** | Mixed quantity names | F2B per-name clocks | Webhook/reconcile snapshot with mixed per-name `updatedAt` |
| **H** | Delayed delete after live refetch | F2B stale-signal class | Real webhook sanitizer + refetch worker; tombstone flag OFF still asserts zero tombstones |
| **J** | Reconnectable pair | F2B | Disconnect payload (item+location only) + later LIVE pair |
| **K** | Presence advances on attribute no-op | F2B | JSONL observed GID + stale attributes (owning domain only) |
| **L** / **M** / **AK** | Null-version attributes / quantities | F2B | Direct refetch adapter |
| **N** | Failed delete refetch | **none as worker** | Timeout/5xx/throttle ≠ tombstone |
| **P** / **Q** / **R** | Sequence uniqueness / crash gap / zero Shop writes | F1 | REG on F3 allocation paths (fence + direct interval) |
| **S** | No lock across Shopify I/O | F2B forbids network in apply | Instrumentation: no row/advisory lock held during HTTP |
| **T** / **AI** | Non-overlapping existence vs commit order | F2B | Two refetch workers |
| **U** | Bulk omission is not absence | **none as ingest** | Complete **proven** JSONL omits X; direct still LIVE |
| **V** / **W** | Circuit breaker / small candidate confirm | **none** | Nomination SQL + breaker + confirmation; flag-OFF fixture |
| **X** | InventoryLevel pair uniqueness | F2B reconnect | Bulk GID then disconnect REST ids then reconnect |
| **Y** | Runtime denied `SyncRun` DML | F1/PR4 | Checkpoint helper must use control-plane role |
| **Z** | Diagnostic lag | **none** | Crash after merchant `PROJECTION_PENDING`/`DEGRADED`, before `DataIssue` |
| **AA** | READ COMMITTED candidate sweep | **none** | Concurrent LIVE commit during sweep |
| **AB** | Terminal non-revival | F2B | Delete-signal worker + one LIVE / overlapping LIVE; flag gated |
| **AC** | Write-scanner plant | F2A scanner (Root A only today) | Plant mutation in F3 ingest **and** worker Root B; CI fails |
| **AD**–**AG** | Sequence privileges / NO CYCLE | F1 | REG |
| **AH** / **AJ** / **AL** | Overlap inversion / LIVE vs ABSENT / candidate+LIVE | F2B engine | Webhook vs confirmation overlap |
| **AM**–**AS** / **AU** | Lease / abandonment / clock rollback | F2B | F3 must use F2B token fence; add worker crash-after-I/O case |
| **AT-1/2/4** | First-insert engine | F2B | REG |
| **AT-3** | Bulk JSONL vs direct refetch first insert | F2B synthetic | **Mandatory F3** with real mapper + two connections |
| **AV** | Deterministic lock order | F2B | Multi-identity JSONL batches opposite input order |
| **AW** | Lock-capacity / concurrent bulk apply | F2B evaluator + engine | Concurrent catalog-sync batches at **derived** envelope (C16); unsafe envelope rejected; lock exhaustion aborts whole txn; no half-applied abandonment |

Engine coverage on merged PR #31 is **not** PR 5 closeout evidence until F3 reproduces the adapter-level rows above.

---

## 7. R-157..R-165 remaining applicability

Do **not** close any of these from this packet. Formal close requires ChatGPT after independent F3 evidence.

| Risk | Severity | May close at F2B/F2C merge? | Corrected F3 remaining close condition |
|---|---|---|---|
| **R-157** | P1 | **No** | Requires **F3 evidence**. Every F3 allocation path (`fenceGeneration`, direct start/end gens) uses `SELECT nextval('stocky_catalog_observation_gen_seq')`. Focused REG of AE/AF/AG/AD. Application roles still fail `setval`. |
| **R-158** | P1 | **No** | Requires **F3 evidence**. Direct refetch workers allocate start **before** HTTP and end **after** usable response. Overlapping webhook vs confirmation must not LWW by `responseGen` (AH/AJ/AL through adapters). |
| **R-159** | P2 | **No** | Requires **F3 evidence**. Worker hard-crash after `ACTIVE` in-flight commit and before apply. No network lock. Successor uses F2B durable `ACTIVE→ABANDONED`. No F3 reaper that physically deletes in-flight rows as a correctness path. |
| **R-160** | P1 | **No** | Requires **F3 evidence**. **Every** new canonical / diagnostic / **nomination** writer uses the same derivation function + known-answer vectors 1–3: JSONL batch apply, webhook apply, reconcile apply, diagnostic projection-state writer, absence nomination/confirmation writer. No unanchored ingest upsert. |
| **R-161** | P2 | **No** | Requires **F3 evidence** **and** the derived concurrency envelope (C16, including F-CLAUDE-PR5F3EC-01). Race AW against disposable PostgreSQL with intended `max_locks_per_transaction`. Concurrent F3 multi-identity transactions at the **derived** ceiling. Do not raise PostgreSQL settings from app code. Unsafe envelope rejected/reduced. |
| **R-162** | P3 | **Eligible after F2B merge plus actual downstream-consumer proof** | F2B is merged. Keep evaluator; F3 must not pass unsafe direct inputs. **Not** closed by F2B merge alone. **Not** closed by this planning packet. |
| **R-163** | P3 | **No** | Requires **F3 evidence** of the **two-root** scanner (Root A `app/lib/catalog-facts/**` and Root B `app/jobs/workers/catalog-facts/**`) plus Race-AC plants in both trees. **Globally OPEN** until that two-root proof. **Not** closed by F2A merge. **Not** closed by F2B/F2C merge. Do **not** inherit PR #33 “closed for F2A lane” wording as global closure. Workers were never inside the F2A scan root. |
| **R-164** | P3 | **No** | Requires **F3 evidence**. F3 ingest/workers/diagnostic/nomination paths must not call `delete`/`deleteMany` on canonical facts. Tombstone only. Maintenance delete remains out of ordinary APIs. |
| **R-165** | P2 | **No** | Register text is **now on `main`** with the F2C squash `f984169…` (do not duplicate-edit `RISK_REGISTER.md` in this planning PR). Closure still requires F3 **whole-path** removal/fencing of webhook `available ?? 0` (C13), including `webhook-processor.ts`. Canonical unknown ≠ zero. Health must not claim current when availability is unknown. |

Related open risks F3 advances but does **not** close as “PR 5 complete”:

| Risk | F3 duty |
|---|---|
| **R-132** | Use F2A unitCost preflight; do not burn a with-unitCost bulk cycle |
| **R-134** | Persist BulkOperation GID; poll `bulkOperation(id:)`; recover via `bulkOperations` list (C9); fence v1 `currentBulkOperation` (C7) |
| **R-136** | >50 locations via F2A complete pagination in the worker (legacy `first: 50` unused on canonical path) |
| **R-138** | Deny-by-default mutation scan includes **both** F3 roots; allow only exact-path `bulkOperationRunQuery` (C5/C6) |
| **R-142** | No orphan cleanup in F3; v1 must not keep writing `shopifyVariantCache` (C7) |
| **R-143** | Race A through JSONL+webhook |
| **R-145** | Durable `PROJECTION_PENDING`/`compatibilityProjectionState` + dual health **before** claiming merchant-safe wiring (C4) |
| **R-146** | Re-stream from 0; paired two-phase checkpoint (C8) |
| **R-147** | Reconcile bounded; no N+1; webhook anti-starvation (C11) |
| **R-154** | Candidates + breaker; unproven bulk nominates nothing (C1); kill switch (C2) |
| **R-155** | Terminal two-confirmation via delete worker; flag DEFAULT OFF until later authorization; F3 retry budget ≥ two observation cycles for `canonical_product_not_live` (NEW-CLAUDE-F2CCM-01) |
| **R-156** | Diagnostic reconciler; Race Z |

**R-142 / R-145 / R-156 remain OPEN** where applicable. This packet does not close them.

---

## 8. PostgreSQL fixture map

Fixtures are **specifications for F3**. This planning PR does **not** add runtime fixture files.

All merchant fixtures use real disposable PostgreSQL, restricted `stocky_runtime`, transaction-local tenant context, and a second shop for cross-shop denial. Mocked RLS is not evidence.

### 8.1 Catalog / JSONL

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-JSONL-001` | Parent product, 2 variants, inventory items, collections; parents before children; `__parentId` present | Mapper emits Product / Variant / Item `full_sync` observations **from catalog JSONL**; collections do not become identity |
| `FX-JSONL-002` | Inventory-level lines with `item.id`, `location.id`, eight quantities, nullable per-name `updatedAt` | Pair identity; `__parentId` not uniqueness key; InventoryItem parent line does **not** write InventoryItem presence |
| `FX-JSONL-003` | Inventory-level line missing item/location ids | Fail closed; no pair invented |
| `FX-JSONL-004` | 260 variants under one shop | No `first: 250` cap; all persist |
| `FX-JSONL-005` | Generator: ≥100k lines, nested products/variants | Heap ≤ 256MB; no full-body buffer (instrument streamer) |
| `FX-JSONL-006` | Malformed JSON line mid-file | `PARTIAL_FAILURE`; **zero nominations**; zero tombstones; zero success watermark; prior committed batches retained |
| `FX-JSONL-007` | Duplicate GID lines, later attributes older Clock A | Idempotent; attributes no-op; presence advances (owning domain) |
| `FX-JSONL-008` | Null `updatedAt` bulk attributes | Fence-generation null-version path; DEGRADED until real timestamp |
| `FX-JSONL-009` | Incomplete authoritative attribute object on a full-sync line | Apply unit fails; no column wipe (F2B P2-01) |
| `FX-JSONL-010` | Boundary-aligned truncation; complete `url`; no malformed line | No nomination; no watermark; `PARTIAL_FAILURE` (C1) |
| `FX-JSONL-011` | `objectCount` mismatch by one | Same as FX-JSONL-010 |
| `FX-JSONL-012` | Shop disabled between canonical batches | Checkpoint does not advance; no success watermark (C12) |

### 8.2 BulkOperation / checkpoint

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-BULK-001` | `COMPLETED` + `url` + `partialDataUrl=null` **and** counts match streamed counts | Stream allowed; completeness gate passes |
| `FX-BULK-002` | `COMPLETED` + `partialDataUrl` set + `url` null | Race D/O: no apply, no nomination, no watermark |
| `FX-BULK-003` | `FAILED` / `CANCELED` | Same as FX-BULK-002 |
| `FX-BULK-004` | GID mismatch on `bulkOperation(id:)` | Fail closed (F2A contract) |
| `FX-BULK-005` | Crash after merchant commit of lines 101–200, checkpoint still 100 | Race E: resume re-stream 0; recognize orphan `ingestBatchId`; ack 200; no skip |
| `FX-BULK-006` | Crash before merchant commit of 101–200 | Resume re-applies 101–200 |
| `FX-BULK-007` | Runtime role `UPDATE "SyncRun"` | Denied (Race Y) |
| `FX-BULK-008` | Expired URL | New domain SyncRun + new fence + new GID; old run not SUCCEEDED; ordinal not reused against the new body |
| `FX-BULK-009` | `currentBulkOperation` string in any live production path | CI search gate fails (C13) |
| `FX-BULK-010` | `catalog-sync-v1` durable job dispatched post-cutover | Fail closed; zero `shopifyVariantCache` writes (C7) |
| `FX-BULK-011` | Reachability | No live path reaches `pollBulkOperation` |
| `FX-BULK-012` | Stale ordinal + new GID | Ordinal resets atomically; resume must not skip (C8) |
| `FX-BULK-013` | Polled GID ≠ persisted GID | Fail closed |
| `FX-BULK-014` | Submit accepted; GID not persisted | Recover via `bulkOperations` list + intent match; never `currentBulkOperation` (C9) |

### 8.3 Locations / fence / absence

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-LOC-001` | 55 locations, page size 50 | All persist; page 2 used |
| `FX-LOC-002` | Complete location sync omits a LIVE location whose `existenceRequestGen > fence` | Not nominated (Race B) |
| `FX-LOC-003` | Complete sync omits a LIVE location eligible for nomination; breaker under threshold; `location(id:)` null | Tombstone `ABSENT_CONFIRMED_QUERY` **only if flag ON**; flag-OFF: candidate only, zero tombstones |
| `FX-LOC-004` | Candidate proportion over threshold | Zero tombstones; DEGRADED; no HEALTHY deletion (Race V) |
| `FX-LOC-005` | `locations/deactivate` vs `locations/delete` | Inactive `isActive=false` vs confirmed-absence tombstone (flag gated) |
| `FX-ABS-001` | Complete catalog JSONL omits GID still returned live by direct query | Candidate only; stays LIVE (Race U) |
| `FX-ABS-002` | Confirmed absence then older bulk line | Stays ABSENT (Race C) |
| `FX-ABS-003` | Complete catalog epoch A then inventory-level epoch B | Catalog sweep nominates **zero** valid InventoryItems (C3) |
| `FX-ABS-FLAG-OFF` | Candidates exist; flag OFF | Tombstone count **zero**; health not HEALTHY (C2) |

### 8.4 Webhooks / refetch

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-WH-001` | HMAC-valid `products/update` with 101 variant_gids | Refetch product+variants; do not treat 100-variant body as complete |
| `FX-WH-002` | `products/delete` with `admin_graphql_api_id`; live `product(id:)` | Signal only; no tombstone (Race H) |
| `FX-WH-003` | Same delete; `product(id:)` null | Tombstone after confirmation **only if flag ON** |
| `FX-WH-004` | Delete refetch 5xx/timeout | Not deletion (Race N); DEGRADED / retry |
| `FX-WH-005` | `inventory_levels/disconnect` `{inventory_item_id, location_id}` only | Maps to pair; one row (Race X) |
| `FX-WH-006` | `inventory_levels/update` `available: 5` while GraphQL `committed` changed | All eight refetched; webhook available not complete truth |
| `FX-WH-007` | `available: null` on webhook | Must **not** write snapshot 0 (R-165) |
| `FX-WH-008` | Canonical path of inventory webhook | No `computeForecast` / `LowStockAlert` / `VariantAbcClass` writes |
| `FX-WH-009` | Out-of-order update then older update | Clock A keeps newer Shopify `updatedAt` |
| `FX-WH-010` | Disabled shop | Fail-closed; no merchant writes |
| `FX-WH-011` | One-shop webhook latency under catalog-sync poll-wait | Webhook claimed/completed; catalog-sync does not hold claim during wait (C11) |
| `FX-WH-012` | Canonical no-op after refetch | Application receipt still written; replay does not loop (C20) |

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
| `FX-PROJ-001` | Canonical commit then projection throw | Canonical retained; not HEALTHY; `DEGRADED` after failure write; no rollback |
| `FX-PROJ-002` | Successful rebuild | HEALTHY only after projection matches those facts |
| `FX-PROJ-003` | Crash after pending/DEGRADED, before `DataIssue` | Reconciler recreates issue; no false HEALTHY (Race Z) |
| `FX-PROJ-004` | `hasMore=true` shop_rebuild page | Must not authorize merchant HEALTHY |
| `FX-PROJ-005` | Parent ABSENT / variant LIVE lag | Retryable; no poisonHalt; later healthy variant projects (F2CC-01) |
| `FX-PROJ-006` | LIVE level `availableQuantity=null` | Fail closed; snapshot unchanged; not zero |
| `FX-PROJ-007` | Uninstall during projection retry | Fail-closed |
| `FX-PROJ-008` | Orphan legacy cache row | Survives F3; not canonical authority (R-142) |
| `FX-PROJ-009` | First insert of a new identity | `compatibilityProjectionState` never `HEALTHY` before projection succeeds (C4) |

### 8.7 Concurrency / first insert

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-RACE-AT3` | No canonical row; JSONL full_sync vs webhook direct overlap | Same advisory key; 0 or 1 coherent row; no ON CONFLICT overwrite |
| `FX-RACE-AW` | Disposable PG with known `max_locks_per_transaction`; concurrent batches at **derived** `D*B` envelope; unsafe envelope | Envelope reduced/rejected; exhaustion aborts txn; no half-applied state; **not** evaluator default 4 |
| `FX-RACE-AV` | Two batches opposite identity order | Same lock order; no deadlock |
| `FX-RACE-S` | Direct refetch instrumentation | Zero merchant/control/advisory locks during HTTP |

### 8.8 Tenancy / money / identity / scanner

| Fixture ID | Contents | Asserts |
|---|---|---|
| `FX-TENANT-001` | Two shops; ingest shop A | Shop B sees 0 rows |
| `FX-MONEY-001` | `"0.1"`, `"19.99"`, high-precision Decimal unitCost | Round-trip exact strings; no `Number`/`parseFloat` |
| `FX-ID-001` | Delete variant GID-1; recreate SKU on GID-2 | Two rows; history not merged |
| `FX-ID-002` | Terminal tombstone + one later LIVE | No revival (Race AB); flag gated |
| `FX-SCAN-001` | Authorized submitter `bulkOperationRunQuery` | Passes (C5) |
| `FX-SCAN-002` | Same root in a different ingest module | Fails |
| `FX-SCAN-003` | `inventoryBulkToggleActivation` in submitter | Fails |
| `FX-SCAN-004` | Planted mutation under `app/jobs/workers/catalog-facts/` | Fails CI (C6) |
| `FX-SCAN-005` | Planted write-service import under worker tree | Fails; `unauthenticated` import passes |

---

## 9. Exact acceptance commands (F3 runtime PR)

Commands below are **F3 acceptance gates**, not this planning PR. Each focused step must:

- execute a distinct file or distinct command;
- collect **nonzero** tests (reuse `failOnZeroPassedNameFilter` and/or `--passWithNoTests false`);
- print the observed pass count;
- fail if zero tests collected.

Environment: disposable PostgreSQL, isolated Redis, npm **11.5.2**, inventory-write flags **unset/false**, `FEATURE_PR5_ABSENCE_TOMBSTONE` **unset/false**, no production Shopify.

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

# F3 absence nomination / breaker / confirmation / flag-OFF
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-absence-confirmation.test.ts

# F3 reconcile bounded / non-webhook quantities
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-inventory-reconcile.test.ts

# F3 projection trigger / health / Race F / Z / FX-PROJ-009
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-projection-health.test.ts

# F3 Race AW capacity (derived envelope)
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-lock-capacity-aw.test.ts

# Scale completeness
npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-f3-scale-completeness.test.ts

# Two-root mutation scanner (Race AC) — Root A and Root B
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

Search gates — **whole application tree** `stocky-plus/app/**` (C13), fail CI on production-module matches unless on the empty-after-cutover reviewed allowlist:

```text
available ?? 0
currentBulkOperation
response.text()          # catalog JSONL full-body ingestion
ON CONFLICT DO UPDATE
pg_advisory_lock(
pg_try_advisory_lock(
pg_advisory_lock_shared(
pg_try_advisory_lock_shared(
```

`bulkOperationRunQuery` is allowed **only** in `app/lib/catalog-facts/ingest/bulk-operation-submitter.ts`.

Approved `pg_advisory_xact_lock` / `pg_try_advisory_xact_lock` remain allowed.

### 9.3 Minimum observed counts (fail if below)

F3 must record actual counts from the run. Planning floors (raise, do not lower, if implementation adds tests):

| Suite | Minimum passing tests |
|---|---|
| ingest unit | ≥ 24 (includes completeness + GID classifier) |
| jsonl-checkpoint PG | ≥ 16 including Race E both crash sides, FX-JSONL-010/011/012, FX-BULK-012/013/014 |
| webhook-refetch PG | ≥ 18 including H, N, X, R-165, forecast isolation, FX-WH-011/012 |
| overlap-races PG | ≥ 8 including A, AT-3, S |
| absence-confirmation PG | ≥ 10 including U, V, W, C, FX-ABS-003, FX-ABS-FLAG-OFF |
| inventory-reconcile PG | ≥ 6 including FX-REC-001 |
| projection-health PG | ≥ 12 including F, Z, FX-PROJ-004, FX-PROJ-009 |
| lock-capacity-aw PG | ≥ 4 including derived envelope + unsafe envelope + exhaustion |
| scale-completeness PG | ≥ 2 (`FX-LOC-001`, `FX-JSONL-004`) |
| scanner / Race AC | ≥ 5 (FX-SCAN-001..005) covering both roots |

A focused command that prints `0 passed` is a failed check even if exit 0 would otherwise occur.

---

## 10. Claude independent review targets (F3 exact head)

When ChatGPT requests review of the F3 exact head, Claude must independently falsify at least the §14 checklist. Required verdict language: approve F3 only with P0=0 P1=0 P2=0 blocking, or `CORRECTIONS REQUIRED`. A green worker demo is not completion.

Immutable F1/F2A/F2B/F2C review artifacts, `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_INDEPENDENT_REVIEW.md`, `PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN_CORRECTION_INDEPENDENT_REVIEW.md`, and `PR5_F2C_CURRENT_MAIN_INDEPENDENT_REVIEW.md` must not be edited.

This planning packet does **not** replace the final exact-head F3 runtime review.

---

## 11. Emergency sequencing (technical, not calendar)

2026-09-07 is an operational rescue target. Safety gates do not change.

Critical path:

1. **F2A / F2B / F2C cores** — **DONE.** Merged onto `main` at `f65ab4b…` / `0284b66…` / `f984169…` with green post-merge CI.
2. **This planning packet (PR #32)** — independently approved F3 architecture, now synchronized onto current `main`. Pending ChatGPT **merge decision**. User merge still required. **This packet does not merge itself.**
3. **PR #33 refresh** — after PR #32 merges; do not edit or merge PR #33 from this packet.
4. **F3 runtime** — one integration PR from the post-F2C `origin/main` SHA, exact-head **full** CI, independent review, ChatGPT acceptance, user merge. **Not authorized by this packet. Not started.**
5. **PR 5 closure sync** — only after F3 acceptance/merge.
6. **PR6 runtime** — only after PR5 closes. **PR6 planning / architecture / fixtures** one level ahead **are allowed now** if expressly authorized and marked speculative (C25). Do not edit PR #34.

Work that does **not** help the rescue: opening PR6 **runtime**, rewriting F2A bulk documents, forking F2B clocks beyond the named `compatibilityProjectionState` field, deleting tests, enabling inventory-write flags, enabling the absence-tombstone flag, or splitting F3 so overlap races move to a later PR.

---

## 12. Explicit non-authorization

This packet:

- does **not** authorize F3 runtime implementation;
- does **not** merge, rebase, or mark-ready PR #32 / PR #33 / PR #34;
- does **not** edit PR #33 or PR #34;
- does **not** create D-055;
- does **not** authorize PR6 **runtime**, migrations, Shopify configuration, or production actions;
- **does** allow expressly authorized PR6 **planning / architecture / acceptance criteria / fixtures / test matrices** one dependency level ahead, marked speculative;
- does **not** authorize production, merchant production data, Partner Dashboard validation, or inventory-write flags;
- does **not** enable `FEATURE_PR5_ABSENCE_TOMBSTONE`;
- does **not** authorize Shopify inventory mutations;
- does **not** close R-157..R-165 (R-163 remains **globally OPEN** until F3 two-root proof);
- does **not** claim PR 5 complete or Phase 1 complete.

Cursor status for this packet: **planning current-main sync complete — pending ChatGPT PR5-F3 planning merge decision**.

---

## 13. ChatGPT decision requested

1. Accept this remaining-work map, now synchronized onto current F2A+F2B+F2C `main` `f984169…`, as the F3 architecture contract.
2. Keep **one** F3 integration PR (JSONL + webhook/refetch + absence/reconcile + projection integration + v1 fencing + two-root scanner + health in one merge boundary). Do **not** split JSONL into an earlier runtime PR.
3. Do **not** authorize F3 runtime from this packet.
4. Record F2B and F2C as **MERGED** with green post-merge CI. Do not reopen those cores.
5. Serialise eventual docs/control PR merges per C24: PR #32 first; PR #33 refreshes after. Merge neither from this packet.
6. After this planning packet is merged, F3 runtime still requires a **separate** ChatGPT authorization from the then-current `origin/main` SHA.
7. Treat PR6 **runtime** as blocked; treat authorized PR6 **planning** as allowed under Accelerated Safe Delivery v1. Do not edit PR #34.
8. Production remains unauthorized. Inventory writes remain unauthorized. All inventory-write flags remain DEFAULT OFF. Merge of this PR remains unauthorized until the user explicitly authorizes it.

---

## 14. Implementation-time acceptance for all 25 early findings

Future final Claude review of the F3 exact head should mechanically check closure of:

| ID | F3 exact-head closure check |
|---|---|
| P1-01 | Completeness gate implemented; FX-JSONL-010/011 pass; omitted Shopify counts fail closed; F-CLAUDE-PR5F3EC-02 token `^[0-9]+$` before compare |
| P1-02 | `FEATURE_PR5_ABSENCE_TOMBSTONE` exists, DEFAULT OFF, distinct from breaker; FX-ABS-FLAG-OFF passes; flag not enabled without later authorization |
| P1-03 | Owning-domain map implemented; inventory-level JSONL does not write InventoryItem presence; FX-ABS-003 passes |
| P1-04 | `PROJECTION_PENDING` enum+default shipped; writer sets it in the canonical txn; FX-PROJ-009 passes |
| P1-05 | Exception is exact path + exact root; FX-SCAN-001/002/003 pass |
| P1-06 | Two-root scanner live; FX-SCAN-004/005 pass; R-163 **globally OPEN** until that evidence |
| P1-07 | v1 fail-closed on `payloadSchemaVersion`; FX-BULK-010/011 pass; listed legacy files fenced |
| P1-08 | Paired GID+ordinal; deterministic `ingestBatchId`; FX-BULK-012/013 pass; no HTTP Range |
| P2-09 | Pre-submit intent + `bulkOperations(first: 25)` recovery; FX-BULK-014 passes; no `currentBulkOperation` |
| P2-10 | FX-JSONL-006 asserts zero nomination / zero watermark / `PARTIAL_FAILURE` |
| P2-11 | Webhook-class preference + deferral + 5s/120/600s poll with claim release; FX-WH-011 passes |
| P2-12 | FX-JSONL-012 passes |
| P2-13 | Whole-`app/**` search gates; canonical path has no `available ?? 0` / `currentBulkOperation` / full-body `response.text()` |
| P2-14 | One parent job, three child SyncRuns, failed-domain-only retry, new fence only on new bulk |
| P2-15 | GID-prefix table implemented; unknown line fails closed |
| P2-16 | Workers pass derived envelope including F-CLAUDE-PR5F3EC-01; FX-RACE-AW uses derived envelope, not default 4 |
| P2-17 | Status files no longer claim F2B/F2C unmerged, F2C review off-branch pending, or `main` = `f65ab4b` |
| P3-18 | `Int?` + CHECK ≥ 1 + 1-based null-before-ack |
| P3-19 | `bulk_operations/finish` is CONTROL_ONLY continuation; index exists; every new topic enumerated |
| P3-20 | Refetch digest is delivery+resolved identities; FX-WH-012 no-op still receipts |
| P3-21 | Session advisory-lock gate matches the four forbidden prefixes; xact variants allowed |
| P3-22 | Successful cursor is `full-sync-epoch:<SyncRun.id>`; incomplete runs do not overwrite |
| P3-23 | Projection uses PR4 lifecycle; poll/reconcile ceilings enforced; `canonical_product_not_live` budget ≥ two observation cycles (NEW-CLAUDE-F2CCM-01) |
| P3-24 | No parallel independent merge of overlapping control docs |
| P3-25 | F3/PR5 docs do not forbid authorized PR6 planning; PR6 runtime still blocked |
| F-CLAUDE-PR5F3EC-01 | Envelope `D * max(B, Σ worker concurrency)` or fail closed if `B < Σ` |
| F-CLAUDE-PR5F3EC-02 | Count tokens match `^[0-9]+$` before compare; non-conforming = omitted = fail closed |
| NEW-CLAUDE-F2CCM-01 | Retry/reconcile budget allows two-confirmation terminal Product revival before exhausting `canonical_product_not_live` |

---

## 15. Implementation ambiguities closed

The independent review’s §5.13 list is closed by this packet:

1. Ordinal representation — C18.
2. Ordinal ↔ GID pairing/reset — C8.
3. `ingestBatchId` derivation and index — C8.
4. Which transaction writes `compatibilityProjectionState` — C4 (canonical txn writes `PROJECTION_PENDING`; projection writer writes `HEALTHY`/`DEGRADED` after).
5. Whole-shop `HEALTHY` from bounded pages — §3.3 / C4 (per-identity; `hasMore=true` never shop-HEALTHY).
6. Breaker thresholds + operator control — C2 (250 / 2% settings location named; kill switch separate).
7. Retry bounds — C11 / C23.
8. Intra-shop webhook starvation — C11.
9. Three-SyncRun topology — C14.
10. `catalog-sync-v1` competing authority — C7.
11. R-165 gate scope — C13.
12. JSONL line discrimination — C15.
13. `bulk_operations/finish` — C19.
14. Refetch `payloadDigest` — C20.
15. `SyncCursor.cursorValue` — C22.
16. Presence-domain ownership — C3.
17. Worst-case concurrency derivation — C16.
18. Orphan BulkOperation — C9.
19. PR #32/#33 serialization — C24.
20. PR6 planning vs runtime — C25.
