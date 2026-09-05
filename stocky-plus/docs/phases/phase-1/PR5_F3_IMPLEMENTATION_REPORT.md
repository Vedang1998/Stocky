# Phase 1 PR5-F3 — Remaining Integration Implementation Report

**Lane:** PR5-F3 remaining-integration runtime
**Authorization date:** 2026-09-05
**Authority:** Existing **D-054 EFFECTIVE**
**Decision boundary:** This authorization is **not D-055**
**Authorized base:** `28c810090394f319e599fc6c501b898befa39cad`
**Branch:** `cursor/pr5-f3-remaining-integration-6d09`
**Status:** `AUTHORIZED / IMPLEMENTATION COMPLETE — AWAITING EXACT-HEAD CI`
**Production:** `NOT AUTHORIZED`
**Merchant production data:** `NOT AUTHORIZED`
**Shopify inventory mutations:** `NOT AUTHORIZED`
**Inventory-write flags:** `DEFAULT OFF`
**`FEATURE_PR5_ABSENCE_TOMBSTONE`:** `DEFAULT OFF`
**PR6 runtime:** `NOT AUTHORIZED`
**PR #34:** Must remain untouched at baseline head `f5d429b7b3577c87e67c5ef3445e88560e565a5c`

This report is the durable implementation-evidence record for the single approved
PR5-F3 runtime merge boundary. ChatGPT expressly authorized this lane on
2026-09-05 under D-054 EFFECTIVE. The merged planning packet and Emergency
Continuity Sprint packet did not themselves authorize runtime; this later,
explicit authorization does.

The Cursor Cloud branch suffix is required by the execution environment. The
authorized logical lane name supplied by ChatGPT was
`cursor/pr5-f3-remaining-integration`; the concrete branch carrying this work is
`cursor/pr5-f3-remaining-integration-6d09`.

This lane does not authorize production access, production data, deployment,
backfill, Shopify inventory mutation, any inventory-write flag, PR6 runtime,
editing PR #34, merging this PR, or creating D-055.

## 1. Starting repository evidence

| Field | Observed value |
|---|---|
| Authorized starting SHA | `28c810090394f319e599fc6c501b898befa39cad` |
| `origin/main` after explicit fetch | `28c810090394f319e599fc6c501b898befa39cad` |
| Current HEAD before branch creation | `28c810090394f319e599fc6c501b898befa39cad` |
| Working tree before branch creation | Clean (`git status --porcelain` emitted no paths) |
| Base identity | PR #33 squash merge, verified from GitHub |
| Base post-merge CI | Run `33978361886`, `push`, exact head `28c810090394f319e599fc6c501b898befa39cad`, `SUCCESS` |
| Active F3 PR before branch creation | None for the concrete branch |
| PR #34 baseline | Open draft; head `f5d429b7b3577c87e67c5ef3445e88560e565a5c` |

Draft PR [#35](https://github.com/Vedang1998/Stocky/pull/35) was opened after
the authorization commit and remains DRAFT / UNMERGED.

## 2. Approved integrated scope

The one required F3 merge boundary contains:

1. JSONL bulk ingestion;
2. paired GID/ordinal checkpointing and deterministic resume;
3. authoritative Shopify webhook handling through refetch;
4. absence nomination and confirmation/reconcile;
5. compatibility-projection triggering and recovery;
6. v1 legacy-authority fencing/cutover;
7. recursive two-root mutation/no-Shopify safety scanning; and
8. inventory/catalog health-state integration.

No part of this scope may fabricate authoritative current state, weaken tenant
isolation, introduce ordinary physical deletion of canonical facts, or make a
compatibility writer authoritative.

## 3. Baseline evidence

Baseline was recorded before any runtime, schema, migration, test, Shopify
configuration, or CI-workflow edit. The only branch commit at baseline was
authorization documentation commit
`ee57405ec2a3efd10d6194882834c6ae7a48faa2`.

### 3.1 Required reading and frozen runtime identities

The required governance, product, phase, approved F3 plan, immutable review,
F2A/F2B/F2C report/review, PR #33 packet, implementation, schema, migration,
job, health, flag, and test records were read before runtime implementation.
Immutable Claude artifacts were not edited.

| Slice | Current merged runtime identity | Frozen implementation identity |
|---|---|---|
| F2A admin read | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` | accepted head `bfbe369f590e38f36de8165e366dd7e84449ecd7` |
| F2B canonical applicator | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` | accepted head `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` |
| F2C compatibility projection | `f9841691307583381695973600df3546dd1b9ee4` | isolated accepted head `2d2e8801dd383a778c1237cec4ed068922859cf0` |

### 3.2 Existing migrations

`npx prisma migrate deploy` applied **18/18** migrations to disposable local
PostgreSQL 16.15 and `npx prisma migrate status` reported the schema up to date.
The latest migration was
`20260816193000_pr5_catalog_fact_foundation`. No F3 migration existed.

Existing migration directories:

`20260728000000_init_stocky_plus`,
`20260730160000_tenant_expansion`,
`20260730160100_tenant_compatibility_indexes`,
`20260730210000_tenant_backfill_correction`,
`20260730220000_tenant_ownership_issue_detection`,
`20260803120000_tenant_enforcement_helpers`,
`20260804180000_sync_control_plane`,
`20260804210000_sync_control_plane_correction`,
`20260804220000_sync_control_plane_correction_defaults`,
`20260805120000_sync_control_plane_second_correction`,
`20260805130000_sync_control_plane_receipt_probe_revoke`,
`20260805140000_sync_control_plane_enqueued_failed`,
`20260806220000_sync_control_plane_d047_fair_claim_indexes`,
`20260807010000_sync_control_plane_d048_dispatch_ready_shop`,
`20260807150000_sync_control_plane_d049_dispatch_schedule`,
`20260811190000_sync_control_plane_d050_split_claim_statement_triggers`,
`20260812230000_sync_control_plane_d051_readiness_lock_scope`, and
`20260816193000_pr5_catalog_fact_foundation`.

### 3.3 Existing test counts

Environment: disposable local PostgreSQL 16.15, isolated Redis 7.0.15, Node
22.14.0, npm 11.5.2, no production credentials or data, inventory-write flags
unset/false.

| Command | Exit | Baseline result |
|---|---:|---|
| `npx vitest run app/lib/catalog-facts/admin-read --reporter=verbose --passWithNoTests false` | 0 | **94 passed / 10 files** |
| `npx vitest run app/lib/catalog-facts/apply --reporter=verbose --passWithNoTests false` | 0 | **43 passed / 4 files** |
| `npx vitest run app/lib/catalog-facts/compatibility-projection --reporter=verbose --passWithNoTests false` | 0 | **70 passed / 7 files** |
| `npx vitest run app/lib/catalog-facts --reporter=verbose --passWithNoTests false` | 0 | **224 passed / 24 files** |
| `npm test -- --reporter=verbose --passWithNoTests false` | 0 | **280 passed / 30 files** |
| `npm run test:migrations -- scripts/tenant-enforcement/tests/pr5-catalog-fact-foundation.test.ts scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts` | 0 | **91 passed / 2 files** (F1 19 + F2B 72) |
| `npx vitest run --config vitest.tenant-access.config.ts app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts --reporter=verbose --passWithNoTests false` | 0 | **35 passed / 1 file** |
| `npm run graphql-codegen` | 0 | Admin 2026-07 schema/documents generated successfully |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma generate` | 0 | Prisma Client generated |
| `npm run test:sync-integration` with the repository's complete CI test environment | 0 | **241 passed / 20 files** |

The first `npm run test:sync-integration` attempt omitted CI-only Shopify
placeholder variables. Eighteen files / 228 tests passed, while two suites
failed during module collection with the explicit
`empty appUrl configuration` error and collected zero tests. This was an
environment setup failure, not accepted as test evidence. The two affected
suites were rerun with the repository's test-only CI placeholders and passed
**13/13**. A complete all-files rerun with the same CI test environment is
recorded in the table and passed **241/241** before runtime implementation.

### 3.4 Flags, scanner, legacy authority, and health

With all relevant environment variables explicitly unset, the five existing
inventory-write flags evaluated `false`. At baseline,
`FEATURE_PR5_ABSENCE_TOMBSTONE` was not yet defined. Its authorized F3 default
is `false`; it must not be enabled.

Baseline scanner execution returned:

```text
root A app/lib/catalog-facts: 42 production files, 14 GraphQL documents, 0 findings
root B app/jobs/workers/catalog-facts: absent
```

Therefore R-163 was globally OPEN: recursion existed for Root A only; no Root B
proof existed.

The live legacy defects were directly observed:

- `app/jobs/workers/webhook-processor.ts` wrote
  `quantityAvailable: inv.available ?? 0` on both create and update, then
  called `computeForecast` and could create `LowStockAlert`;
- `app/services/shopify-sync.server.ts` used full-body
  `response.text()` + `split`, per-row `ShopifyVariantCache` upserts, and
  `startCatalogSync`;
- `app/services/shopify-gql.server.ts` polled
  `currentBulkOperation`;
- `app/jobs/queue.server.ts` enqueued `catalog-sync-v1`; and
- `app/sync/health.server.ts` could report `HEALTHY` solely from the latest
  successful job/run, without checking unknown authoritative quantity,
  projection pending/failure, absence uncertainty, or incomplete deletion
  reconciliation.

### 3.5 Baseline risk posture

All planning/runtime risks R-129 through R-165 remained OPEN unless an earlier
accepted lane explicitly satisfied only a sub-obligation. F3 owns the
end-to-end evidence for these carry-forwards:

| Risk | Baseline F3 disposition |
|---|---|
| R-157 | OPEN — F3 fence/direct allocation paths unimplemented |
| R-158 | OPEN — real direct-refetch interval scheduling unimplemented |
| R-159 | OPEN — worker crash/late-response integration unimplemented |
| R-160 | OPEN — all F3 canonical/diagnostic/nomination writers not yet anchored |
| R-161 | OPEN — derived aggregate worker-concurrency capacity proof absent |
| R-162 | OPEN pending safe downstream-consumer proof |
| R-163 | OPEN globally; Root B absent |
| R-164 | OPEN pending F3 ordinary-path no-physical-delete proof |
| R-165 | OPEN; legacy webhook still coerced unknown availability to zero |

Related F3-owned integration obligations remained OPEN across R-129 through
R-156: partial-bulk honesty, GID identity, eight-state freshness, unit-cost
preflight consumption, forecast isolation, persisted BulkOperation identity,
bounded streaming, complete locations, RLS, mutation denial, exact money,
expired-result recovery, bulk document limits, compatibility authority,
bulk/webhook ordering, absence candidates, projection health, byte-zero
resume, bounded reconcile, clock separation, signal/refetch deletion,
presence-on-no-op, nullable versions, sequence allocation, role-separated
checkpointing, blast-radius control, terminal revival, and diagnostic
reconciliation.

## 4. Implementation evidence

Runtime implementation followed the merged F3 contract
(`PR5_EMERGENCY_REMAINING_INTEGRATION_PLAN.md` C1–C25 and §8 fixture map).
Shopify remains authoritative for Product, ProductVariant, InventoryItem,
Location, and InventoryLevel. Webhook bodies are signals; merchant-visible
current state is applied only after authoritative refetch or a proven JSONL
stream.

### 4.1 Architecture implemented

| Piece | Implementation |
|---|---|
| JSONL bulk ingestion | Bounded streamer in `app/lib/catalog-facts/ingest/jsonl-stream.ts`; GID classifier; owning-domain mappers; catalog-sync worker drives three child SyncRuns (locations, catalog, inventory_levels) |
| Completeness | Count tokens must match `^[0-9]+$` before comparison (`ingest/counts.ts`). Malformed/omitted counts fail closed. Clean transport end is not completeness |
| Checkpoint / resume | Paired `bulkOperationGid` + 1-based `jsonlCommittedLineOrdinal` on `SyncRun`; deterministic `ingestBatchId` SHA-256 over version/syncRunId/GID/start ordinal |
| Bulk submit / orphan recovery | Exact-path `bulkOperationRunQuery` in `bulk-operation-submitter.ts` only; orphan recovery lists `bulkOperations(first: 25)` and never `currentBulkOperation` |
| Authoritative webhooks | `resource-refetch.ts` plus `CatalogFactProductVariantIds` pagination (page size 100). Topics in `shopify.app.toml` include products, inventory items/levels, locations, and `bulk_operations/finish` (CONTROL_ONLY) |
| Absence | Nomination → confirmation/reconcile in `workers/catalog-facts/absence.ts`. Tombstones require `FEATURE_PR5_ABSENCE_TOMBSTONE`, which remains DEFAULT OFF |
| Product revival | Terminal Product; two non-overlapping LIVE confirmations and at least two observation cycles before `canonical_product_not_live` exhaustion (`NEW-CLAUDE-F2CCM-01`) |
| Projection | Post-commit compatibility projection; default `PROJECTION_PENDING`; `hasMore`/truncated pages cannot write `HEALTHY`; projection failure does not roll back canonical facts |
| v1 fencing | Enqueue `catalog-facts-v1` only. Legacy `catalog-sync-v1` dead-letters `LEGACY_CATALOG_SYNC_V1_DISABLED`. `pollBulkOperation` / `currentBulkOperation` removed from live paths |
| Two-root scanner | Recursive scan of `app/lib/catalog-facts/**` and `app/jobs/workers/catalog-facts/**` plus `scripts/pr5-f3-safety-scan.ts`. Mutation denial remains semantic / deny-by-default with the exact submitter exception |
| Health | `computeSyncHealth` consumes catalog evidence: incomplete ingestion, unknown quantity, projection pending/failure, absence/reconcile uncertainty, disabled processing, exhausted retry. A succeeded job alone is not current |
| Capacity | `D * max(B, Σ worker concurrency)` with `CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM = 5 + 1`. Unsafe envelopes fail closed at startup (`F-CLAUDE-PR5F3EC-01`) |
| Locks | Canonical identity `pg_advisory_xact_lock(integer, integer)` via Prisma CAST/CTE. No Shopify I/O while locks are held. Deterministic lock order preserved |

Canonical apply remains tombstone/existence-state based. F3 does not introduce
physical DELETE as an ordinary apply path and does not weaken RLS.

### 4.2 Schema and migrations

Additive only. No production execution.

1. `20260905173000_pr5_f3_projection_pending_enum` — adds
   `CatalogCompatibilityProjectionState.PROJECTION_PENDING` before `HEALTHY`.
2. `20260905173500_pr5_f3_remaining_integration` — nullable SyncRun checkpoint
   columns (`bulkOperationGid`, `jsonlCommittedLineOrdinal` CHECK ≥ 1,
   submit intent, fingerprint, count tokens), shopId+GID index, fact default
   `PROJECTION_PENDING`, and `@@index([shopId, ingestBatchId])` on the five
   fact models.

`ALL_MIGRATION_NAMES` in `tenant-expansion.migration.test.ts` includes both
folders and fails closed if on-disk migration directories drift. Init-only
parking therefore cannot apply the enum ALTER TYPE before the foundation type
exists.

### 4.3 Feature flags

| Flag | Default | F3 state |
|---|---|---|
| `FEATURE_STOCKTAKE_INVENTORY_WRITES` | false | unchanged, DEFAULT OFF |
| `FEATURE_ADJUSTMENT_WRITES` | false | unchanged, DEFAULT OFF |
| `FEATURE_RECEIPT_WRITES` | false | unchanged, DEFAULT OFF |
| `FEATURE_COST_SYNC` | false | unchanged, DEFAULT OFF |
| `FEATURE_TRANSFER_WRITES` | false | unchanged, DEFAULT OFF |
| `FEATURE_PR5_ABSENCE_TOMBSTONE` | false | added; DEFAULT OFF in code, `.env.example`, and CI |

### 4.4 Tenant-access corrections during F3

Computed TenantDb delegates in absence nomination and diagnostic health counts
were rewritten to explicit `db.shopify*Fact` calls. JSONL checkpoint
`$transaction` stays on the control-plane Prisma client (Race Y) and is
allowlisted as `EX-SYNC-008`. F3 PostgreSQL fixtures are exact-file
`EX-ENF-*` exceptions, matching prior enforcement tests. Regenerated
`PR2_TENANT_ACCESS_INVENTORY.md`: findings 1722, **violations 0**.

F2C-core isolation now asserts shop B remains `PROJECTION_PENDING` after a
successful F2C-core project: F2C core is frozen not to write that column, and
F3 owns `HEALTHY` via `writeCompatibilityProjectionState`. Sync inventory
registers the five additional exact-path F3 control-plane importers (bulk-finish,
capacity, projection, diagnostic reconciler, JSONL checkpoint). The unsupported
webhook sanitizer negative test now uses `customers/create`; `products/create`
is an F3 identity-only signal.

## 5. Test and validation evidence

Environment: disposable local PostgreSQL 16.15, isolated Redis, Node 22.14.0,
npm 11.5.2, inventory-write flags false, `FEATURE_PR5_ABSENCE_TOMBSTONE=false`,
`STOCKY_DISPATCHER_PROCESS_COUNT=1`, no production credentials or data.

### 5.1 Focused F3 floors (all raised, none lowered)

| Suite | Floor | Observed | Exit |
|---|---:|---|---:|
| ingest unit `app/lib/catalog-facts/ingest` | ≥24 | **86 passed / 8 files** | 0 |
| JSONL checkpoint PG | ≥16 | **27 passed** | 0 |
| webhook-refetch PG | ≥18 | **30 passed** | 0 |
| overlap-races PG | ≥8 | **8 passed** | 0 |
| absence-confirmation PG | ≥10 | **15 passed** | 0 |
| inventory-reconcile PG | ≥6 | **13 passed** | 0 |
| projection-health PG | ≥12 | **18 passed** | 0 |
| lock-capacity-aw PG | ≥4 | **12 passed** | 0 |
| scale-completeness PG | ≥2 | **2 passed** | 0 |
| scanner / Race AC (+ foundation-safety + mutation-safety) | ≥5 | **28 passed / 3 files** | 0 |
| two-root script scan | n/a | `filesScanned: 151`, `findings: []` | 0 |

### 5.2 Adversarial / fixture coverage executed

JSONL: FX-JSONL-001..012 including malformed counts, boundary-aligned
truncation, objectCount mismatch, interrupted stream, 100k-line bounded
memory, processing disabled mid-ingest, deterministic resume, duplicate
replay.

Bulk: FX-BULK-005/006 Race E both crash sides, FX-BULK-010/011 v1 fencing,
FX-BULK-012/013 GID/ordinal, FX-BULK-014 orphan list recovery.

Webhooks: FX-WH-001..012 including 101-variant pagination, delayed delete,
flag-OFF absence, eight quantities, R-165 unknown≠zero, forecast isolation,
disabled shop, webhook/bulk claim preference, receipt idempotency.

Absence: FX-ABS-001/002/003, FX-ABS-FLAG-OFF, FX-LOC-001/002/004, Race V,
NEW-CLAUDE-F2CCM-01 two-confirmation Product revival.

Projection/health: FX-PROJ-001..009, unknown quantity, hasMore, diagnostic lag.

Concurrency: FX-RACE-A/AT3/AV/AW/S; worker formula `D * max(B, Σ workers)`.

Scanner: FX-SCAN-001..005 in both roots; exact `bulkOperationRunQuery`
exception; planted mutations fail.

### 5.3 Module and aggregate local suites

| Command | Exit | Result |
|---|---:|---|
| `npx prisma validate` | 0 | schema valid |
| `npx prisma generate` | 0 | Prisma Client 6.19.3 |
| `npx prisma migrate status` | 0 | **20/20** up to date |
| `npm run graphql-codegen` | 0 | Admin 2026-07 documents generated |
| `npx tsx scripts/pr5-f3-safety-scan.ts` | 0 | 151 files, 0 findings |
| `npx vitest run app/lib/catalog-facts --reporter=verbose --passWithNoTests false` | 0 | after F2C characterization retarget; included in `npm test` |
| `npm test -- --passWithNoTests false` | 0 | **373 passed / 39 files** (baseline 280/30; floors raised) |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean after non-null generation override |
| `npm run build` | 0 | client+ssr built |
| `npm run tenant:access:audit` | 0 | violations 0; `EX-SYNC-008` used |
| `npm run tenant:access:inventory:check` | 0 | inventory fresh; digest `5d11daa099ba0423a1739b7da38aea0821dafdd4d9e77626ecc6f674f1e94190` |
| `npm run tenant:enforcement:inventory:check` | 0 | inventory fresh |
| `npm run sync:inventory:check` | 0 | surfaces=48; digest `7363d6d85e84f782136c471088e36bbf5a86584c68f9f4558fc5eb6887e260a8` |
| classifier vs `28c810090394f319e599fc6c501b898befa39cad` | 0 | `docs_only=false`, `full_ci=true`, `classification_reason=non_docs_or_unknown_path` |
| `git diff --check` vs `origin/main` after this report rewrite | 0 | clean; the prior extra EOF blank line on the 233-line authorization stub is removed |
| `npm run test:migrations` | 0 | **443 passed / 59 files**; elapsed 600s |
| `npm run test:tenant-access` | 0 | **326 passed / 35 files**; elapsed 121s after isolation retarget (earlier 1 fail / 325 pass was `HEALTHY` vs `PROJECTION_PENDING`) |
| `npm run test:db-isolation` | 0 | **19 passed / 2 files**; elapsed 32s |
| `npm run test:sync-integration` | 0 | **242 passed / 20 files**; elapsed 351s (baseline 241/20; +1 catalog-identity sanitizer test). Earlier 2 fail / 239 pass were F3 characterization: `products/create` is now a supported identity topic, and five catalog-facts control-plane importers were missing from `SYNC_SURFACES` |

Init-only parking regression: after adding F3 folders to `ALL_MIGRATION_NAMES`,
`tenant-expansion.migration.test.ts` passed **7/7**, including NEW-PR4-C07
role-present/role-absent and the injected parking-cleanup assertion.

Non-superuser owner tests passed **2/2** when `STOCKY_BOOTSTRAP_DATABASE_URL`
matched CI (local first attempt without that variable was an environment miss,
not an F3 product defect).

## 6. Risk and carry-forward dispositions

Do **not** close R-157..R-165 in `RISK_REGISTER.md` from this implementation
report. Formal close still requires ChatGPT after exact-head independent Claude
evidence. Dispositions below are implementation-lane status only.

| ID | Lane disposition | Evidence |
|---|---|---|
| R-157 | Implemented; candidate pending Claude | F3 fence and direct interval allocation use `nextval('stocky_catalog_observation_gen_seq')`; sequence privilege suite remains in CI |
| R-158 | Implemented; candidate pending Claude | Direct refetch allocates start before HTTP and end after usable response; overlapping webhook vs confirmation fixtures |
| R-159 | Implemented; candidate pending Claude | FX-WH-004 transport failure abandons exact in-flight evidence; no ordinary physical delete of in-flight rows |
| R-160 | Implemented; candidate pending Claude | JSONL, webhook, reconcile, diagnostic, and nomination writers use the frozen identity-lock / ingestBatch derivation |
| R-161 | Implemented; candidate pending Claude | Derived envelope + Race AW (`F-CLAUDE-PR5F3EC-01`) |
| R-162 | Not closed | Downstream consumer characterization retargeted onto the F3 fence; unsafe direct inputs still rejected. Eligible only after consumer proof ChatGPT accepts |
| R-163 | **Candidate for closure pending exact-head independent Claude evidence.** Remains globally OPEN in the register | Two-root recursive scanner + FX-SCAN-001..005 plants in both trees. Do not mark CLOSED because implementation code exists |
| R-164 | Implemented; candidate pending Claude | Ordinary F3 apply/nomination/diagnostic paths are tombstone/existence-state; scanner rejects physical canonical DELETE |
| R-165 | Implemented; candidate pending Claude | Canonical webhook path no longer writes `available ?? 0`; FX-WH-007 and FX-PROJ-006; health degrades on unknown quantity |

| Carry-forward | Disposition |
|---|---|
| `F-CLAUDE-PR5F3EC-01` | Tested. Capacity uses `D * max(B, Σ canonical-writer concurrency)` and fails closed when unsafe |
| `F-CLAUDE-PR5F3EC-02` | Reviewed as the paired planning capacity/lock finding; lock acquisition through Prisma CAST/CTE plus Race AW exhaustion abort. Not a planning-document rewrite |
| `NEW-CLAUDE-F2CCM-01` | Tested. Two non-overlapping LIVE confirmations; retry budget allows two full observation cycles before terminal Product exhaustion |
| `F-CLAUDE-PR5F3DUR-01` | Non-blocking planning-evidence discoverability. Immutable review not edited |

Related R-129..R-156 obligations are advanced by the F3 adapters and fixtures
above. They are not claimed CLOSED as “PR 5 complete”.

## 7. Exact-head CI and PR state

| Field | Value |
|---|---|
| PR | [#35](https://github.com/Vedang1998/Stocky/pull/35) |
| State | OPEN / DRAFT / UNMERGED |
| Base | `28c810090394f319e599fc6c501b898befa39cad` |
| Classifier (local vs base) | `docs_only=false`, `full_ci=true` |
| Exact-head `pull_request` CI | Pending on this report commit. The run ID is not known at commit time and is not invented here. ChatGPT's implementation-review packet cites the exact-head `pull_request` run after it completes. No later push is authorized after that green run. |

This report does not self-approve F3. ChatGPT will issue a new Claude Code
chat for exhaustive Tier-A exact-head review.

## 8. Explicit safety accounting

| Action | Count / state |
|---|---|
| Production accesses | `0` |
| Merchant production-data accesses | `0` |
| Shopify inventory writes | `0` |
| Production deployments | `0` |
| Inventory-write flags enabled | `0`; all remain `DEFAULT OFF` |
| `FEATURE_PR5_ABSENCE_TOMBSTONE` enabled | `0`; remains `DEFAULT OFF` |
| PR6 runtime changes | `0`; `NOT AUTHORIZED` |
| PR #34 changes | `0`; head remains `f5d429b7b3577c87e67c5ef3445e88560e565a5c` |
