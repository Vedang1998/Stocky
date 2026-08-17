# Phase 1 PR5-F1 — Foundation Independent Review (Tier A)

**Reviewer:** Claude Code (independent)
**Review type:** Tier-A exhaustive independent review of the shared canonical fact foundation
**Authority:** D-054 **EFFECTIVE**
**Immutable:** this artifact must never be edited after commit

---

## 1. Repository identity (verified)

| Item | Value | Verified |
|---|---|---|
| `origin/main` (base) | `ae1b428039152efc6b4a46107e1bcca5eb17586a` | yes — `git rev-parse origin/main` |
| Reviewed head | `7cea26ca1199326a600eed2662af5959c47d6bc5` | yes — `git rev-parse origin/phase-1/catalog-location-inventory-facts` |
| PR | [#27](https://github.com/Vedang1998/Stocky/pull/27) | OPEN / DRAFT / UNMERGED (`state=open`, `draft=true`, `merged=false`) |
| PR base | `main` @ `ae1b428039152efc6b4a46107e1bcca5eb17586a` | yes |
| Head branch | `phase-1/catalog-location-inventory-facts` | yes |
| Changed files | **36** (+3767 / −518) | yes — `git diff --stat ae1b4280…7cea26ca` and GitHub `changed_files: 36` |

Authority chain verified: PR #26 CLOSED / MERGED; accepted review-record head `7171c2cbbdff15ae0d92aa6850a1ae12804db3f4`; squash merge `ae1b4280…`; post-merge main CI `31966584542` SUCCESS. D-054 is EFFECTIVE. Production, merchant production data, and Shopify inventory mutations remain NOT AUTHORIZED. All inventory-write flags remain DEFAULT OFF.

No stop condition was triggered. Main did not move. The PR head did not move during review. No existing immutable artifact required editing.

---

## 2. Review method / environment

Independent execution, not report acceptance:

- Disposable PostgreSQL **16.13** cluster created for this review (`pr5review` database, non-owner roles `r_runtime` / `r_cp`).
- `20260816193000_pr5_catalog_fact_foundation/migration.sql` applied directly against stub `Shop` / `SyncRun` parents; migration applied cleanly, exit 0, 7 new tables created.
- All lifecycle, identity-shape, lease, tombstone, composite-FK, sequence-privilege, and advisory-lock behaviours reproduced with real SQL — not source-text inspection.
- Lock-key vectors 1–4 reproduced **independently in Python** (`hashlib.sha256` + `struct.unpack('>ii')`), with no repository code in the path.
- Capacity evaluator executed directly (`node --experimental-strip-types`) against the real `lock-capacity.ts`.
- Exact-head CI verified through the GitHub Actions API, not through the PR body prose.

---

## 3. Scope verdict — **PASS**

The PR contains foundation work only.

New canonical models present, exactly as required: `ShopifyProductFact`, `ShopifyProductCollectionMembership`, `ShopifyVariantFact`, `ShopifyInventoryItemFact`, `ShopifyLocationFact`, `ShopifyInventoryLevelFact`, `CatalogObservationInFlight`.

Absent, confirmed by diff inspection of every added line: Shopify GraphQL extraction; `bulkOperationRunQuery`; JSONL ingestion; webhook canonical apply engine; reconciliation runtime; compatibility projection writer; forecasting; ABC; PO changes; receiving; stocktake mutation; transfer mutation; PR6 runtime; UI.

`git diff --name-only ae1b4280…7cea26ca` shows **no** change to `app/services/`, `app/routes/`, feature-flag files, `shopify.app.toml`, GraphQL documents, or `package.json`. Exactly one migration directory added.

`ShopifyVariantCache` and `InventorySnapshot` are unchanged in `schema.prisma` and remain the authorities for existing legacy consumers.

---

## 4. Schema / identity verdicts

| Item | Verdict |
|---|---|
| Schema (overall) | **PASS with one blocking exception** (F-CLAUDE-PR5F1-01) |
| Product identity `(shopId, shopifyGid)` | **PASS** — `ShopifyProductFact_shopId_shopifyGid_key` |
| Variant identity `(shopId, shopifyGid)` | **PASS** — `ShopifyVariantFact_shopId_shopifyGid_key` |
| InventoryItem identity `(shopId, shopifyGid)` | **PASS** |
| Location identity `(shopId, shopifyGid)` | **PASS** |
| InventoryLevel pair identity `(shopId, inventoryItemGid, locationGid)` | **PASS** |
| Collection membership | **PASS** — `@@unique([shopId, shopifyProductGid, shopifyCollectionGid])`, composite FK to product fact, no Collection domain built |
| `SyncRun` fence | **PASS** — `fenceGeneration BIGINT?`, `fenceAt TIMESTAMP(3)?`, `@@index([shopId, fenceGeneration])`, both nullable and additive |
| Direct-vs-full-sync generation semantics | **FAIL — P1** (F-CLAUDE-PR5F1-01) |

Every new merchant-domain model has non-null `shopId`, `@@unique([shopId, id])`, direct `Shop` ownership (`onDelete: Restrict`, `onUpdate: NoAction`), tenant-leading indexes, `createdAt` / `updatedAt`, no legacy `shop` string authority, and no nullable-shopId expand.

**`shopifyInventoryLevelGid` is not unique — proven.** Two rows with the same `shopifyInventoryLevelGid` on different item+location pairs inserted successfully; a duplicate pair was rejected by `ShopifyInventoryLevelFact_shopId_inventoryItemGid_locationG_key`. The level GID cannot become relationship identity.

**SKU / barcode / title / handle / vendor cannot become identity.** They carry non-unique indexes only (`ShopifyVariantFact_shopId_sku_idx`, `_shopId_barcode_idx`, `ShopifyProductFact_shopId_handle_idx`, `_shopId_vendor_idx`). No unique index includes any of them.

**Optional InventoryItem→Variant relationship.** Composite FK `(shopId, shopifyVariantGid) → ShopifyVariantFact(shopId, shopifyGid)`, `MATCH SIMPLE`, `ON DELETE NO ACTION`. Verified: a NULL `shopifyVariantGid` is accepted; a non-existent variant GID is rejected. Because tombstoning is a soft state change (`existenceState='ABSENT'`) and never a physical `DELETE`, a historical or deleted InventoryItem is **not** forced into unsafe lifecycle coupling when its variant tombstones — the parent row survives. This is acceptable. Downstream lanes must note the ordering constraint that a variant fact row must exist before an inventory-item fact may reference it.

**Cross-shop composite FK integrity proven.** An attempt to create a `shop_B` inventory level referencing a `shop_A` inventory item was rejected by the composite FK. Tenant leakage through relationship keys is structurally impossible.

---

## 5. Direct-vs-full-sync generation verdict — **FAIL (P1)**

This was the designated high-priority question. The answer is that the implemented schema is **not** compatible with the accepted model.

All five canonical fact tables declare:

```sql
"existenceRequestGen"  BIGINT NOT NULL,
"existenceResponseGen" BIGINT NOT NULL,
```

The accepted brief defines these two columns exclusively as a **direct** observation interval:

- §6 line 195 — `existenceRequestGen` is "Allocated … **before** issuing the **direct** Shopify network request"; "Full-sync presence / null-version bulk attributes use **`SyncRun.fenceGeneration`** … **not** a new gen per JSONL line."
- §6.F.2 lines 1218–1219 — "JSONL / page lines of that run **reuse** `SyncRun.fenceGeneration` for `LIVE_FULL_SYNC_PRESENT` … They do **not** allocate a new generation per line."
- §6.F.6 lines 1806–1811 — `existenceResponseGen` is "allocated **after** an authoritative usable response and **before** entering the tenant fact transaction … kept in process until persisted atomically when the observation leaves `ACTIVE`."
- §6.F.10 lines 2440–2441 — the approved candidate-nomination predicate is written as
  `AND (existenceRequestGen IS NULL OR existenceRequestGen <= :fenceGeneration)`.

The `existenceRequestGen IS NULL` branch is only reachable if the column is **nullable**. Under the implemented `NOT NULL` schema that branch is provably dead code, which is direct textual evidence that the accepted contract expects a canonical row whose last existence evidence is full-sync presence to carry **no** direct-observation interval.

Representability assessment against the six required cases:

| Case | Representable under implemented schema? |
|---|---|
| 1. First creation of a canonical row from full-sync presence | **No** — only by fabricating a direct interval |
| 2. Full-sync presence before any direct authoritative observation exists | **No** — same |
| 3. Later direct refetch | Yes |
| 4. Direct observation newer than the fence | Yes |
| 5. Null-version attributes using `fenceGeneration` conservatively | Yes — `attributeRequestGen` / `attributeResponseGen` are correctly **nullable** |
| 6. Tombstone / absence confirmation after full sync | Yes (absence is always `ABSENT_CONFIRMED_QUERY`, a direct observation) |

The brief does **not** explicitly permit copying `fenceGeneration` into the fact-level existence-interval columns, and downstream logic **can** misinterpret the copy. Concretely: a full-sync-created row would store the zero-width interval `[G, G]`. The §6.F.6 closed-interval overlap test (`A.requestGen <= B.responseGen AND B.requestGen <= A.responseGen`) would then classify an overlapping absence-confirmation observation `[G0, G5]` with `G0 < G < G5` as an overlapping-interval conflict and emit `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT`, whereas the accepted contract resolves full-sync presence against a confirmed absence by the **fence rules** of §6.F.8 (`R.fenceGeneration` compared to the committed absence `existenceResponseGen`). That is a wrong-existence / wrong-tombstone class of defect, and the attribute-side fields for the identical problem were correctly modelled as nullable.

Per the review mandate, a design that forces fake direct-observation intervals merely to satisfy `NOT NULL` columns is not approvable. Because PR5-F1 exists specifically to **freeze** the schema before parallel downstream lanes begin, a `NOT NULL` column that the accepted apply algorithm branches on as nullable is exactly the cross-lane ambiguity the freeze is meant to eliminate.

---

## 6. Observation lifecycle verdicts

Reproduced on PostgreSQL 16.13.

| Check | Result |
|---|---|
| `ACTIVE` + non-null `observationResponseGen` | **REJECTED** — `CatalogObservationInFlight_lifecycle_response_gen_check` |
| `COMPLETED` + NULL `observationResponseGen` | **REJECTED** — same constraint |
| `ABANDONED` with NULL or non-null `responseGen` | permitted, matches §6.E.1 |
| Multiple simultaneous `ACTIVE` rows, same canonical identity | **ACCEPTED** (2 rows, same Product GID); no unique constraint on `(shopId, canonical identity)` |
| Identity-shape CHECK — `InventoryLevel` carrying `shopifyGid` | **REJECTED** |
| Identity-shape CHECK — `Product` with NULL `shopifyGid` | **REJECTED** |
| `leaseDurationMs` = 0 | **REJECTED** (`catalog_observation_lease_duration_invalid`) |
| `leaseDurationMs` = 3600001 | **REJECTED** |
| App-supplied absolute `leaseExpiresAt` = `2999-01-01` on INSERT | **OVERWRITTEN** by `clock_timestamp() + duration` |
| Lease extension via UPDATE (`leaseExpiresAt` and `leaseDurationMs`) | **NEUTRALISED** — trigger restores `OLD` values |
| `ABANDONED → ACTIVE` | **REJECTED** (`catalog_observation_abandoned_reactivation_forbidden`) |
| **`COMPLETED → ACTIVE`** | **PERMITTED** — see F-CLAUDE-PR5F1-02 |
| Control-plane FK on `CatalogObservationInFlight` | **none** — only `shopId → Shop` |
| Trigger functions executable by non-owner runtime role after `REVOKE ALL … FROM PUBLIC` | verified working |

**Lifecycle DB constraints verdict:** PASS except the COMPLETED terminality gap.
**Lease clock verdict:** **PASS.** The absolute deadline is computed solely by PostgreSQL `clock_timestamp()`; the application can supply only a validated finite duration; the app cannot override or extend the deadline.
**State-transition verdict:** **FAIL (P2).** Tracing the approved state machine (§6.E.1, §6.F.2.1, §6.F.2.3), `COMPLETED` is terminal — a retry after a terminal transition is a **new** observation with a new token and a new `observationRequestGen`. There is no approved `COMPLETED → ACTIVE` edge. The guard trigger blocks only `ABANDONED → ACTIVE`. Absence of an explicit trigger is not evidence the transition is intended.

---

## 7. Sequence verdicts — **PASS**

Definition confirmed via `pg_sequence`: `bigint`, `INCREMENT BY 1`, `MINVALUE 1`, `seqmax = 9223372036854775807`, `CACHE 1`, **`seqcycle = false`**. Not stored on `Shop`. No reset or reuse path.

| Privilege check (role `r_runtime`, USAGE-only, as provisioned) | Result |
|---|---|
| `PUBLIC` USAGE / SELECT / UPDATE | all **false** (migration `REVOKE ALL … FROM PUBLIC`) |
| `USAGE` | true |
| `SELECT` | **false** |
| `UPDATE` | **false** |
| `SELECT nextval(...)` | **succeeds** |
| `SELECT setval(..., 1)` | **DENIED** — `permission denied for sequence` |
| `ALTER SEQUENCE … RESTART WITH 1` | **DENIED** — `must be owner of sequence` |
| `SELECT last_value FROM <seq>` | **DENIED** |

Owner is the migration/schema owner; neither application role owns it. Role provisioning grants USAGE only to `stocky_runtime` and `stocky_control_plane`, then explicitly revokes SELECT and UPDATE. Drift detection (`collectSequencePrivilegeFailures`) allowlists **only** `USAGE` on **only** `stocky_catalog_observation_gen_seq`, flags ownership by either application role, flags any PUBLIC privilege on any sequence, and emits `missing_sequence_usage` when the grant is absent. This is exact, not blanket.

**BigInt precision verdict — PASS.** The sequence was advanced past the JavaScript safe-integer boundary and `nextval` returned `9007199254740991` then `9007199254740992` correctly. `allocateCatalogObservationGeneration` accepts only `bigint` or a non-empty string (converted with `BigInt(...)`) and throws otherwise — a `Number` can never silently pass. `SyncRun.fenceGeneration` is Prisma `BigInt?` over PostgreSQL `BIGINT`, and the repository test round-trips `9007199254740993n` and asserts `typeof === "bigint"`. Precision-safe end to end.

---

## 8. Tenant / RLS verdicts — **PASS**

**Tenant-manifest verdict: PASS.** All seven new tables are registered in `scripts/tenant-enforcement/manifest.ts` as `classification: merchant_domain`, `kind: direct`, `shopIdNullableInPrisma: false`, `legacyShopField: false`, `existingShopIdIdUnique: true`, `rlsRequired: true`, `immutabilityTriggerRequired: true`, `bootstrapExemption: false`. `assertMerchantTableCount()` is raised 19 → **26** and will throw on any drift.

**RLS verdict: PASS.** `apply.ts` and `verify.ts` iterate `MERCHANT_SQL_TABLES` generically — there is no per-table hardcoding that could skip the new tables. At exact head, CI executed `tenant:roles:provision`, `tenant:enforcement:preflight` (26 merchant tables), `tenant:enforcement:apply`, `tenant:roles:verify`, `tenant:rls:verify`, `tenant:immutability:verify`, `tenant:enforcement:verify`, and `tenant:enforcement:drift` against real PostgreSQL — all SUCCESS.

**Cross-shop denial verdict: PASS.** The repository foundation test uses `getRuntimeClient()`, which fails closed unless the connected role is the restricted runtime role — this is not a superuser false positive. Verified denials: cross-shop SELECT returns 0 rows; cross-shop INSERT raises; cross-shop UPDATE affects 0 rows; direct `shopId` mutation raises. The db-isolation suite additionally loops **all 26** merchant tables asserting missing-context fail-closed reads.

**Control-plane denial verdict: PASS.** `stocky_control_plane` cannot SELECT `ShopifyProductFact` and cannot INSERT `CatalogObservationInFlight`. `provisionControlPlaneRole` / `verifyControlPlaneRole` were changed from a hardcoded six-table list to `[...MERCHANT_SQL_TABLES, "Session"]`, so the revoke-and-verify sweep now covers every merchant table automatically — this is a strengthening, not a bypass. No `CatalogObservationInFlight` FK targets any control-plane table.

**TenantDb / selectors verdict: PASS.** All seven delegates added to `TenantDb`; `MODEL_UNIQUE_SELECTORS` entries are `id`, `shopId_id`, and the tenant-leading identity only. `CatalogObservationInFlight` correctly exposes **no** identity selector beyond `shopId_id`, preserving multiple in-flight rows per canonical identity. The new `legacy-scope.ts` short-circuit returning `{ shopId: authority.shopId }` for `DIRECT_NO_LEGACY_SHOP` models is **strictly tighter** than `buildDirectTenantScopeWhere`, which emits an `OR` including a `shopId: null` + legacy-shop branch for expand/backfill models. No selector was added that bypasses shop anchoring.

---

## 9. Lock-key verdicts — **PASS**

**Single-implementation verdict: PASS.** `app/lib/catalog-facts/lock-key.ts` is the only derivation. `advisory-lock.ts` imports `deriveCanonicalLockKey` rather than re-encoding.

Version `stocky-pr5-canonical-lock-v1`; encoding `<decimal UTF-8 byte length>:<UTF-8 bytes>` per component; no trim, lowercase, or Unicode normalization; exact case-sensitive resource-kind literals; SHA-256; `digest.readInt32BE(0)` / `readInt32BE(4)` — the first eight bytes are never converted to a 64-bit JavaScript `Number`.

All four vectors reproduced **independently in Python** with no repository code in the path:

| Vector | key1 | key2 | Digest (first 16 hex) | Match |
|---|---|---|---|---|
| 1 Product | `-2026931606` | `-1244424496` | `872f7a6ab5d396d0` | **exact** |
| 2 ProductVariant | `1954698247` | `-283901703` | `74825407ef1400f9` | **exact** |
| 3 InventoryLevel pair | `1015729171` | `17679052` | `3c8acc13010dc2cc` | **exact** |
| 4 UTF-8 `tést-shop` | `-1422460006` | `-1025379571` | `ab36fb9ac2e1f30d` | **exact** |

Vector 4 confirms UTF-8 **byte** length 10 (JavaScript string length 9); preimage `28:stocky-pr5-canonical-lock-v110:tést-shop7:Product24:gid://shopify/Product/42`. All eight key values lie inside the signed int32 range. F-CLAUDE-PR5IE-01 is closed by evidence.

**Multi-key ordering verdict: PASS.** `orderCanonicalLockKeysForAcquisition` dedupes on `key1:key2` then sorts by `(key1, key2)` ascending with a total-order comparator. Deterministic and deadlock-safe across writers.

**Collision semantics: PASS.** Two distinct identities colliding on the 64-bit key pair are deduplicated and share one lock, producing **over-serialization only** — never under-serialization. Correctness is preserved; only throughput degrades.

---

## 10. Advisory-lock verdicts

**Primitive verdict: PASS.** `pg_advisory_xact_lock(key1, key2)` only. `requireMatchingTenantContext` reads `current_setting('stocky.current_shop_id', true)` and throws `CanonicalAdvisoryLockTenantError` when the context is absent **or** does not equal `identity.shopId` — the helper cannot be used outside a matching tenant transaction. No session-level `pg_advisory_lock`, no `pg_try_advisory_lock`, no network I/O, no unanchored fallback. Keys are passed as bound parameters.

**First-insert serialization verdict: PASS.** Reproduced independently: writer 1 held the advisory lock for the Product identity with **no** `ShopifyProductFact` row present; writer 2 blocked **1804 ms** on the same key, then observed writer 1's committed row and inserted 0 rows. Exactly one row existed at the end. `SELECT … FOR UPDATE` alone cannot achieve this, so the anchor is doing real work.

**Stalled-holder test result: PASS.** With an 800 ms bound and a holder sleeping 8 s, the waiter failed at **800.538 ms** with `canceling statement due to lock timeout`; no canonical state was written; after the holder rolled back, a retry acquired the lock successfully. This independently confirms that transaction-local `set_config('lock_timeout', …, true)` **does** bound `pg_advisory_xact_lock` on PostgreSQL 16 — F-CLAUDE-PR5IE-02 is closed by evidence.

**Failed-transaction rollback verdict: PASS on behaviour, P3 on contract.** After the lock timeout the transaction is aborted; the next statement failed with `current transaction is aborted, commands ignored until end of transaction block` (25P02). Callers **must** roll back and must not continue in the aborted transaction. Verified that `SET LOCAL` reverts at transaction end (`SHOW lock_timeout` returned `0` after `ROLLBACK`), so nothing leaks to the pooled session.

**`lock_timeout` persistence / restoration verdict: FAIL (P2).** Reproduced, not theorised. In one transaction: caller set `lock_timeout='30s'`; the helper then set `'5000ms'`; after `pg_advisory_xact_lock`, `SHOW lock_timeout` returned **`5s`**; a subsequent `SELECT … FOR UPDATE` on a concurrently-held `ShopifyProductFact` row failed at **5001.169 ms** with `canceling statement due to lock timeout … while locking tuple (0,5) in relation "ShopifyProductFact"`. The advisory-acquisition bound therefore silently becomes the bound for every later row lock in the same transaction, and the caller's prior value is destroyed with no save or restore. See F-CLAUDE-PR5F1-03.

---

## 11. Capacity verdicts

**Capacity arithmetic verdict: PASS.** Executed against the real `lock-capacity.ts`. Defaults are requested batch **32** and worst-case concurrency **4**. Condition A is `batch <= floor(mlpt / 2)`; condition B is `batch * concurrency <= floor(mlpt * (max_connections + max_prepared_transactions) * 0.25)`. All four brief examples reproduce exactly:

| mlpt / connections / prepared | Condition A cap | Condition B cap | Effective |
|---|---|---|---|
| 64 / 100 / 0 | 32 | 400 | **32** |
| 32 / 100 / 0 | 16 | 200 | **16** |
| 16 / 100 / 0 | 8 | 100 | **8** |
| 64 / 5 / 0 | 32 | 20 | **20** |

**64 / 63 boundary verdict: PASS.** `mlpt=64` → condition A cap 32, requested 32 accepted, effective **32**, `reduced=false`. `mlpt=63` → condition A cap 31, effective **31**, `reduced=true`. F-CLAUDE-PR5IE-03 is closed by evidence.

**Invalid / zero-capacity behaviour verdict: FAIL (P3).** Negative and non-integer settings throw; `requestedCanonicalIdentitiesPerTransaction = 0` and `configuredWorstCaseConcurrentCanonicalTransactions = 0` throw. But `mlpt=1, connections=1, prepared=0` yields condition A cap **0** and condition B cap **0**, and the evaluator still returns `effectiveCanonicalIdentitiesPerTransaction = 1` because of the `Math.max(1, …)` floor. That value is rejected by both of the evaluator's own conditions. Determination: **the floor-to-1 is not safe fail-closed behaviour.** It should either reject the configuration or expose an explicit insufficiency signal; today the only warning is the `requestedAcceptedByConditionA` / `requestedAcceptedByConditionB` booleans, which a consumer reading only the scalar will miss. Very high connection counts (5000) and high `max_prepared_transactions` (200) behave correctly. Float64 precision loss in `sharedLockObjectBudget` appears only at inputs unreachable from real PostgreSQL GUCs.

**R-161 remains OPEN** regardless. Arithmetic is not production proof.

---

## 12. Migration verdicts

**Additive / recovery verdict: PASS.** The migration creates 11 enums, 7 tables, indexes, composite FKs, CHECK constraints, 2 trigger functions with 2 triggers, and 1 sequence. The only change to an existing table is `ALTER TABLE "SyncRun" ADD COLUMN "fenceAt" / "fenceGeneration"` — both **nullable**, no default backfill, no rewrite, no destructive statement anywhere. Applied cleanly against a disposable cluster (exit 0). Prisma tracks migrations in `_prisma_migrations` so single-run semantics hold; `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` make the function/trigger section re-runnable in any case. Recovery is forward-preferred: new objects are simply unused because no apply or ingest lane is wired. No production migration was run; production is not authorized.

**Constraint / FK verdict: PASS with P3 hardening gaps.** Both trigger functions are `SECURITY INVOKER` (default) with `SET search_path = pg_catalog, pg_temp` and `REVOKE ALL … FROM PUBLIC`; both are registered in `APPROVED_APPLICATION_FUNCTIONS`; neither is `SECURITY DEFINER`. Verified that a non-owner runtime role can still fire them. The sequence has `REVOKE ALL … FROM PUBLIC` in the migration, with named USAGE grants deferred to role provisioning — correct separation. RLS/immutability are applied by the PR3 enforcement engine, consistent with existing architecture rather than inline in the migration.

**Tombstone-contract determination.** The existence CHECK is `("existenceState" = 'LIVE' AND "deletedAt" IS NULL) OR ("existenceState" = 'ABSENT')`. This exactly matches the brief's stated rule (§6: `deletedAt` is "Null if `existenceState=LIVE`"), so it does **not** violate the tombstone contract. It is, however, one-directional: an `ABSENT` row may carry NULL `deletedAt` and NULL `deletionSource`, and no constraint couples `existenceState` to `existenceKind`. Reproduced: `ABSENT` + `LIVE_REFETCH`, `LIVE` + `ABSENT_CONFIRMED_QUERY`, and an inverted interval (`existenceRequestGen=99`, `existenceResponseGen=1`) all insert successfully. Recorded as P3 hardening (F-CLAUDE-PR5F1-06), because the brief mandates a database constraint only for the observation-lifecycle invariant, which is present.

---

## 13. Test-quality verdict — **PASS with P3 gaps**

The claims are backed by real PostgreSQL behaviour, not source-text matching. `getRuntimeClient()` asserts the restricted runtime role and fails closed; `controlPlaneClient()` uses `DATABASE_CONTROL_PLANE_URL`; `getMigrationClient({ requireExplicitMigrationUrl: true })` refuses to fall back. `resetSchemaAndApplyEnforcement()` applies real migrations and real enforcement. No superuser false positive, no wrong-database false positive, no Prisma client bypassing the runtime role for the security assertions. `assertMerchantTableCount()` and the `MERCHANT_SQL_TABLES).toHaveLength(26)` assertions prevent stale generated inventory.

Independently reproduced and confirmed: migration deploy; cross-shop denial; control-plane DML denial; `ACTIVE`+responseGen rejection; `COMPLETED`+NULL rejection; multiple `ACTIVE` observations; first-insert advisory serialization with no fact row; stalled-holder timeout; retry after holder release; vectors 1–4; capacity arithmetic; the 64/63 boundary; sequence privilege; sequence `NO CYCLE`; large BigInt fence value.

Gaps (all P3): no test asserts `COMPLETED` terminality; no test asserts `lock_timeout` scope after acquisition; `readPostgresLockCapacitySettings` is exported, never called, and has zero coverage; the no-Shopify proof is a hardcoded six-file source scan; explicit cross-shop SELECT/INSERT/UPDATE is exercised on `CatalogObservationInFlight` only, with the six fact tables covered structurally by the generic RLS matrix.

---

## 14. Safety verdicts

| Check | Verdict |
|---|---|
| No Shopify network | **PASS** — no GraphQL document, no `@shopify` import, no `bulkOperationRunQuery`, no `fetch`/HTTP client in any added runtime line |
| No Shopify write | **PASS** — no `inventoryAdjustQuantities`, no mutation helper added or extended; existing gated helpers untouched |
| No feature-flag activation | **PASS** — no flag file in `git diff --name-only`; safety test asserts all five inventory-write flags `false` |
| Legacy caches unchanged | **PASS** — `ShopifyVariantCache` and `InventorySnapshot` unmodified; no consumer redirected |
| Accidental inventory-write activation | **PASS** — none possible; no writer path exists in this slice |

---

## 15. Exact-head CI verdict — **PASS**

Verified through the GitHub Actions API at head `7cea26ca1199326a600eed2662af5959c47d6bc5`:

| Item | Value |
|---|---|
| Run | `31972263255` |
| Event | **`pull_request`** (automatic, not `workflow_dispatch`) |
| `head_sha` | `7cea26ca1199326a600eed2662af5959c47d6bc5` |
| Conclusion | **SUCCESS** |
| Classify | `95226381766` **SUCCESS** — `docs_only=false`, `full_ci=true` |
| Heavy | `95226399118` **SUCCESS** — ran (not skipped), 135 steps, 21:01→21:55 |
| CI Gate | `95232797984` **SUCCESS** |

Heavy included, all passing: migrate deploy, Prisma schema drift, tenant enforcement inventory freshness, role provisioning, preflight, apply, roles/RLS/immutability/composite/drift verification, tenant pooled-connection isolation, full db-isolation suite, sequence privilege tests, migration and tenant-backfill tests, tenant access suite, lint, typecheck, build, GraphQL codegen.

Superseded runs (`31968046370`, `31968529979`, `31968565003`, `31968723550`, `31971590179`) are historical only. Per the review mandate, the absence of this run ID from the implementation report is not a defect — GitHub Actions is the exact-head evidence.

---

## 16. Control-record consistency verdict — **PASS**

| Record | State | Verified |
|---|---|---|
| D-054 | **EFFECTIVE** | `DECISIONS.md` item 16; `PROJECT_STATUS.md` §"Phase 1 PR 5 D-054 (EFFECTIVE)" |
| PR 5 implementation | **STARTED — PR5-F1 FOUNDATION IN PROGRESS** | `PROJECT_STATUS.md` lines 4, 16, 47 |
| Phase 1 | **IN PROGRESS** | `PROJECT_STATUS.md` line 13 |
| PR 5 complete | **not claimed anywhere** | verified |
| Production | **NOT AUTHORIZED** | `PROJECT_STATUS.md` lines 18, 48 |
| Inventory-write flags | **DEFAULT OFF** | brief §1; runtime assertion in `foundation-safety.test.ts` |
| R-157 | **OPEN** | `RISK_REGISTER.md:162` — "foundation primitive exists"; not closed |
| R-158 | **OPEN** | `RISK_REGISTER.md:163` — apply engine not in F1 |
| R-159 | **OPEN** | `RISK_REGISTER.md:164` — writers/reapers not in F1 |
| R-160 | **OPEN** | `RISK_REGISTER.md:165` — not closed until every writer path uses the anchor |
| R-161 | **OPEN** | `RISK_REGISTER.md:166` — capacity evaluator exists; no deployment evidence |
| D-055 | **not created** | `grep "D-055"` returns only "Do **not** create D-055" |
| Later PR5 lane | **not started** | confirmed by diff; no extraction, ingest, apply, reconciliation, projection, or UI code |

One stale statement recorded as P3 (F-CLAUDE-PR5F1-07).

---

## 17. Findings

### P0 — none

### P1

**F-CLAUDE-PR5F1-01 — Fact-level existence-interval columns are `NOT NULL`, contradicting the accepted full-sync generation contract**

- **Severity:** P1
- **File / line:** `stocky-plus/prisma/migrations/20260816193000_pr5_catalog_fact_foundation/migration.sql:70–71, 134–135, 184–185, 237–238, 313–314`; `stocky-plus/prisma/schema.prisma` — `existenceRequestGen BigInt` / `existenceResponseGen BigInt` on all five fact models
- **Evidence:** All five canonical fact tables declare both columns `BIGINT NOT NULL`. The accepted brief defines them exclusively as a **direct** observation interval (§6 line 195; §6.F.6 lines 1806–1811) and routes full-sync presence to `SyncRun.fenceGeneration` without a per-line generation (§6.F.2 lines 1218–1219). The approved §6.F.10 nomination predicate at lines 2440–2441 reads `AND (existenceRequestGen IS NULL OR existenceRequestGen <= :fenceGeneration)`; the `IS NULL` branch is unreachable under `NOT NULL`. The analogous attribute-side columns `attributeRequestGen` / `attributeResponseGen` were correctly implemented as **nullable**, which is the inconsistency.
- **Merchant impact:** Every canonical row first created from full-sync presence must be given a fabricated direct-observation interval `[fenceGeneration, fenceGeneration]`. Once stored, the §6.F.6 closed-interval overlap test cannot distinguish a bulk presence marker from a real direct observation: an overlapping absence-confirmation interval `[G0, G5]` with `G0 < G < G5` is classified as a `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT` instead of resolving under the §6.F.8 fence rules. Wrong existence state and wrong tombstone/revival decisions for products, variants, inventory items, locations, and inventory levels.
- **Reproduction:** Insert a `LIVE_FULL_SYNC_PRESENT` row with no direct observation — rejected by `NOT NULL`. Execute the brief's §6.F.10 nomination SQL against the implemented schema — the `existenceRequestGen IS NULL` branch is dead.
- **Expected behavior:** Either (a) make `existenceRequestGen` / `existenceResponseGen` nullable and record full-sync presence in a distinct, explicitly named epoch column, or (b) ChatGPT amends the brief to state that `fenceGeneration` is copied into these columns and specifies the discriminator (for example `existenceKind = LIVE_FULL_SYNC_PRESENT`) that downstream overlap logic must consult before applying interval arithmetic. Option (a) is recommended because it matches the already-nullable attribute-side design and keeps the §6.F.10 predicate literally executable.
- **Missing test:** No test proves representability of first creation from full-sync presence, of full-sync presence preceding any direct observation, or of tombstone confirmation after full sync.

### P2

**F-CLAUDE-PR5F1-02 — `COMPLETED → ACTIVE` observation reactivation is permitted and silently discards `observationResponseGen`**

- **Severity:** P2
- **File / line:** `migration.sql:593–614` (`stocky_catalog_observation_lifecycle_guard`); CHECK at `migration.sql:561–567`
- **Evidence:** Reproduced on PostgreSQL 16.13. A `COMPLETED` row with `observationResponseGen = 99` was transitioned by `UPDATE … SET "lifecycleState"='ACTIVE', "observationResponseGen"=NULL`, which succeeded — final state `ACTIVE` with NULL `responseGen`. The CHECK is satisfied because both columns move together; the guard trigger fires but only rejects `ABANDONED → ACTIVE`.
- **Merchant impact:** Destroys the committed `observationResponseGen` that §6.F.8 un-tombstone/reconnect ordering compares against (`LIVE.observationRequestGen >` committed absence `existenceResponseGen`), and returns a terminal observation to a lifecycle state that the blocker predicate scans. Corrupts existence-conflict resolution evidence.
- **Reproduction:** as above.
- **Expected behavior:** The guard trigger rejects any transition out of `COMPLETED` (at minimum `COMPLETED → ACTIVE`), symmetric with the `ABANDONED` rule. Per §6.F.2.1 a retry is always a **new** observation with a new token and a new `observationRequestGen`.
- **Missing test:** none asserts `COMPLETED` terminality.

**F-CLAUDE-PR5F1-03 — `acquireCanonicalIdentityAdvisoryLock` rebinds `lock_timeout` for the whole transaction and clobbers a caller-set value**

- **Severity:** P2
- **File / line:** `stocky-plus/app/lib/catalog-facts/advisory-lock.ts:101`
- **Evidence:** Reproduced on PostgreSQL 16.13. Caller set `lock_timeout='30s'`; helper set `'5000ms'` via `set_config(…, true)`; after `pg_advisory_xact_lock`, `SHOW lock_timeout` returned `5s`; a subsequent `SELECT … FOR UPDATE` on a concurrently-held canonical row failed at **5001.169 ms** with `canceling statement due to lock timeout … while locking tuple (0,5) in relation "ShopifyProductFact"`. The helper neither reads nor restores the prior value.
- **Merchant impact:** Under §6.F.2.2 the apply transaction takes SECONDARY row locks on the canonical fact row and on `CatalogObservationInFlight` rows **after** the anchor. Those waits are now bounded by the advisory-acquisition budget rather than any value the caller chose. The §6.F.10 candidate-nomination sweep takes row locks on fact rows **without** the advisory anchor and is therefore a realistic contender that can abort an applier at 5 s. The implementation report §23 describes the setting only as "around canonical advisory acquisition", which understates the observed scope.
- **Reproduction:** as above.
- **Expected behavior:** Capture `current_setting('lock_timeout')` before acquisition and restore it afterwards, **or** state explicitly in the frozen contract that the bound is transaction-wide and that callers must not set their own `lock_timeout` — and document how post-anchor row-lock waits are bounded. Leaving this implicit at freeze time is not acceptable for parallel lanes.
- **Missing test:** none asserts `lock_timeout` after acquisition or the bound on a post-anchor row-lock wait.

### P3

**F-CLAUDE-PR5F1-04 — Aborted-transaction contract undocumented.** `advisory-lock.ts` — a lock timeout aborts the transaction (verified 25P02 on the next statement). Neither the module nor the report states that callers must roll back and must not continue. `isLockTimeoutError` is exported from `index.ts` and will match any 55P03, so a downstream row-lock timeout can be misattributed to advisory acquisition. Recommend documenting the rollback requirement and adding a test.

**F-CLAUDE-PR5F1-05 — Capacity floor-to-1 is not fail-closed.** `lock-capacity.ts:94–97` — `mlpt=1, connections=1` yields condition A cap 0 and condition B cap 0 yet returns `effectiveCanonicalIdentitiesPerTransaction = 1`, a value both conditions reject. Recommend rejecting the configuration or returning an explicit `capacityInsufficient` signal. `requirePositiveInt` also accepts 0 despite its name.

**F-CLAUDE-PR5F1-06 — Existence coherence unconstrained.** `migration.sql:524–558` — reproduced as permitted: `ABSENT` + `LIVE_REFETCH`; `LIVE` + `ABSENT_CONFIRMED_QUERY`; `ABSENT` with NULL `deletedAt` and NULL `deletionSource`; inverted interval (`existenceRequestGen=99`, `existenceResponseGen=1`). None violates the brief's literal text, and the brief mandates a database constraint only for the observation lifecycle. Recommend tightening before writers land, so parallel lanes cannot each invent a different convention.

**F-CLAUDE-PR5F1-07 — Stale authority statement inside the live brief.** `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md:422–423` still reads "It does not authorize implementation. D-054 is recorded as **CONDITIONAL / NOT EFFECTIVE**", contradicting the updated header and `DECISIONS.md`. Downstream lanes read §6.F as authority.

**F-CLAUDE-PR5F1-08 — No-Shopify proof is a hardcoded file list.** `foundation-safety.test.ts:19–26` scans six named files. A new file added to `app/lib/catalog-facts/` would escape the assertion. Recommend directory enumeration.

**F-CLAUDE-PR5F1-09 — `readPostgresLockCapacitySettings` is untested dead code.** `lock-capacity.ts:115–135` is exported through `index.ts` but never called and has no test; the live `max_locks_per_transaction` read path is unproven.

**F-CLAUDE-PR5F1-10 — Cross-shop denial explicitly tested on one new table only.** `pr5-catalog-fact-foundation.test.ts:163–223` exercises cross-shop SELECT/INSERT/UPDATE and `shopId` mutation on `CatalogObservationInFlight`; the six fact tables rely on the generic RLS matrix and the missing-context loop. Recommend at least one direct cross-shop write attempt per fact table, and a cross-shop nested/relation selector case across the new fact relationships.

---

## 18. Required corrections

Blocking, must be resolved before foundation freeze and merge:

1. **F-CLAUDE-PR5F1-01 (P1)** — resolve the direct-vs-full-sync generation contract, either by making the fact-level existence-interval columns nullable or by an explicit product-owner amendment that pins how a copied `fenceGeneration` is distinguished from a direct request interval.
2. **F-CLAUDE-PR5F1-02 (P2)** — make `COMPLETED` terminal in the lifecycle guard trigger, with a test.
3. **F-CLAUDE-PR5F1-03 (P2)** — restore `lock_timeout` after advisory acquisition, or pin the transaction-wide semantics in the frozen contract, with a test.

Non-blocking but recommended in the same correction package: F-CLAUDE-PR5F1-04 through F-CLAUDE-PR5F1-10.

---

## 19. Verdict

Schema, migration, tenancy, RLS, role and sequence privilege, lock-key derivation, advisory-lock primitive, first-insert serialization, lease clock authority, BigInt precision, capacity arithmetic, scope containment, and exact-head CI are all sound and independently verified. The defects are narrow, but two of them sit directly on the contract this slice exists to freeze, and one of them is the specific high-priority question this review was asked to answer.

**CORRECTIONS REQUIRED**

This verdict does not merge PR #27, does not authorize production, does not authorize Shopify inventory writes, does not close Phase 1, does not authorize PR 6, and does not authorize parallel PR5 lanes. PR #27 remains DRAFT. R-157, R-158, R-159, R-160, and R-161 remain OPEN. No D-055 was created.
