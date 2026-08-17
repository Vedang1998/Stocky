# PR5-F1 Foundation Correction — Independent Re-Review (Claude, Tier-A)

**Status:** IMMUTABLE. Do not edit this artifact after commit.

**Review type:** CORRECTION RE-REVIEW of the corrected PR5-F1 foundation head.

**Reviewer:** Claude Code, acting as independent principal engineer / architecture,
security and release-risk reviewer under `CLAUDE.md` and `AGENTS.md`.

**Review date:** 2026-08-17

---

## 1. Exact repository identity (verified before review began)

| Item | Expected | Observed | Verdict |
|---|---|---|---|
| `origin/main` | `ae1b428039152efc6b4a46107e1bcca5eb17586a` | `ae1b428039152efc6b4a46107e1bcca5eb17586a` | MATCH |
| PR | #27 | #27 | MATCH |
| PR state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false` | MATCH |
| PR base | `main @ ae1b4280…` | `main @ ae1b428039152efc6b4a46107e1bcca5eb17586a` | MATCH |
| Branch | `phase-1/catalog-location-inventory-facts` | same | MATCH |
| Corrected reviewed head | `63e157d918a408c155cbfea3ae9996bbb35006c2` | `63e157d918a408c155cbfea3ae9996bbb35006c2` | MATCH |
| Initial reviewed runtime head | `7cea26ca1199326a600eed2662af5959c47d6bc5` | ancestor of `1f561cf` — confirmed | MATCH |
| Immutable review commit | `1f561cff9c35f667b37792e75c42be6390d7bb25` | same | MATCH |
| Immutable review blob | `7161c481baf597d54bf57e745f9c06d8812d7468` | same at BOTH `1f561cf` and `63e157d` | MATCH |
| Cumulative changed paths | 39 | 39 | MATCH |

`ae1b4280` is an ancestor of `63e157d`. No stop condition triggered.

### 1.1 Immutable initial-review verification

```
git rev-parse 1f561cf:…/PR5_FOUNDATION_INDEPENDENT_REVIEW.md -> 7161c481baf597d54bf57e745f9c06d8812d7468
git rev-parse 63e157d:…/PR5_FOUNDATION_INDEPENDENT_REVIEW.md -> 7161c481baf597d54bf57e745f9c06d8812d7468
```

The immutable initial review is **byte-identical** across the correction range and was
**not** touched by any correction commit. Verified.

---

## 2. Correction delta

`1f561cff9c35f667b37792e75c42be6390d7bb25..63e157d918a408c155cbfea3ae9996bbb35006c2`
= **exactly 7 commits**, as required.

| # | SHA | Subject |
|---|---|---|
| 1 | `5bbf876` | fix(pr5-f1): make existence intervals nullable with DB coherence |
| 2 | `9cf72eb` | fix(pr5-f1): restore lock_timeout and fail closed on zero capacity |
| 3 | `39a8155` | test(pr5-f1): cover review correction findings on disposable PostgreSQL |
| 4 | `0b24f90` | docs(pr5-f1): record independent-review correction pass |
| 5 | `525c8c0` | fix(pr5-f1): register fact relations and isolate rejected SQL |
| 6 | `93755a5` | test(pr5-f1): refresh tenant-access inventory after nested-write coverage |
| 7 | `63e157d` | docs(pr5-f1): record correction-pass local validation evidence |

### 2.1 Correction changed-file verification

15 files changed, matching the expected correction scope exactly. No extra file, no
unrelated feature or runtime work.

```
app/lib/catalog-facts/advisory-lock.ts                          |  39 +-
app/lib/catalog-facts/foundation-safety.test.ts                 |  21 +-
app/lib/catalog-facts/index.ts                                  |   2 +-
app/lib/catalog-facts/lock-capacity.test.ts                     | 115 ++-
app/lib/catalog-facts/lock-capacity.ts                          | 112 ++-
app/tenant/__tests__/nested-writes.test.ts                      | 120 +++
app/tenant/relations.ts                                         | 165 +++++
docs/PROJECT_STATUS.md                                          |   8 +-
docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md              |  92 ++-
docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md |  19 +-
docs/phases/phase-1/PR5_FOUNDATION_IMPLEMENTATION_REPORT.md     |  93 +++
docs/phases/phase-1/README.md                                   |   2 +-
prisma/migrations/20260816193000_pr5_catalog_fact_foundation/migration.sql | 182 ++++-
prisma/schema.prisma                                            |  20 +-
scripts/tenant-enforcement/tests/pr5-catalog-fact-foundation.test.ts | 807 ++++++-
```

`PR5_FOUNDATION_INDEPENDENT_REVIEW.md` was **not** modified. Confirmed.

---

## 3. Independent reproduction environment

All database evidence below was produced by this reviewer, not read from Cursor's
reports.

- Disposable PostgreSQL **16.13** (`initdb -A trust`), port 55432, fresh cluster.
- Server settings: `max_locks_per_transaction=64`, `max_connections=100`,
  `max_prepared_transactions=0`.
- Fresh database `stocky_pr5_rereview`; `prisma migrate deploy` applied **18**
  migrations cleanly.
- Compatibility indexes applied; tenant enforcement roles provisioned; enforcement
  applied; runtime role `stocky_runtime` used for all restricted-role tests.
- No Shopify API call, no production access, no merchant production data at any point.

---

## 4. Finding-by-finding disposition

### F-CLAUDE-PR5F1-01 — P1 — Direct vs full-sync existence evidence — **RESOLVED**

Product-owner resolution option (a) is implemented exactly.

**Schema (all five fact tables):** `existenceRequestGen BigInt?` /
`existenceResponseGen BigInt?`.

**Migration:** corrected in place (legitimate — unmerged, never run in production);
both columns are now plain `BIGINT` (nullable) on all five tables.

Live database confirmation:

```
 ShopifyInventoryItemFact  | existenceRequestGen  | YES | bigint
 ShopifyInventoryItemFact  | existenceResponseGen | YES | bigint
 ShopifyInventoryLevelFact | existenceRequestGen  | YES | bigint
 ShopifyInventoryLevelFact | existenceResponseGen | YES | bigint
 ShopifyLocationFact       | existenceRequestGen  | YES | bigint
 ShopifyLocationFact       | existenceResponseGen | YES | bigint
 ShopifyProductFact        | existenceRequestGen  | YES | bigint
 ShopifyProductFact        | existenceResponseGen | YES | bigint
 ShopifyVariantFact        | existenceRequestGen  | YES | bigint
 ShopifyVariantFact        | existenceResponseGen | YES | bigint
```

**All-five nullability verdict: CORRECT (10/10 columns nullable).**

`CatalogExistenceKind` enum = `LIVE_REFETCH`, `LIVE_FULL_SYNC_PRESENT`,
`ABSENT_CONFIRMED_QUERY`. **No `ABSENT_FULL_SYNC_SWEEP` exists.** Confirmed.

#### Reproduction results

| # | Scenario | Result |
|---|---|---|
| 1 | Product first creation from full-sync presence, NULL/NULL | ACCEPTED |
| 2 | Variant, same | ACCEPTED |
| 3 | InventoryItem, same | ACCEPTED |
| 4 | Location, same | ACCEPTED |
| 5 | InventoryLevel, same | ACCEPTED |
| 6 | Later direct `LIVE_REFETCH` `[1001,1002]` | ACCEPTED |
| 7 | Later confirmed `ABSENT_CONFIRMED_QUERY` `[1003,1004]` + tombstone | ACCEPTED |
| 8 | Fabricated `[fence,fence]` full-sync interval | **REJECTED on all five tables** |
| 9 | Candidate predicate `existenceRequestGen IS NULL` | reachable, returns full-sync-presence rows |
| 10 | Direct request begun after fence (`requestGen 1003 > fenceGeneration 1000`) | PROTECTED |

**Full-sync first-create reproduction:** representable as NULL/NULL on all five tables.
**Direct LIVE reproduction:** `LIVE_REFETCH` with strict `requestGen < responseGen`.
**Confirmed ABSENT reproduction:** `ABSENT_CONFIRMED_QUERY` with strict interval,
non-null `deletedAt` and `deletionSource`.
**Candidate NULL predicate verdict:** reachable and selective.
**Fabricated fence interval rejection:** enforced by the database on all five tables.

The §6.F fence / interval model is restored. `existenceRequestGen` /
`existenceResponseGen` now mean exactly one thing — a direct authoritative Shopify
request interval. Full-sync presence carries no interval; fence evidence lives on
`SyncRun.fenceGeneration`. **No new ambiguity introduced.**

---

### F-CLAUDE-PR5F1-06 — P3 — Existence coherence enforced by the database — **RESOLVED**

One `*_existence_evidence_coherence_check` CHECK exists per fact table (5/5). Each
enumerates exactly three legal shapes and nothing else.

Independently reproduced rejection matrix (`ShopifyProductFact`; identical constraint
text on all five):

| Illegal state | Result |
|---|---|
| `LIVE_FULL_SYNC_PRESENT` + `[1000,1000]` | REJECTED |
| `LIVE_FULL_SYNC_PRESENT` + any non-null interval | REJECTED |
| `LIVE_REFETCH` + NULL interval | REJECTED |
| `LIVE_REFETCH` + equal gens `[5,5]` | REJECTED |
| `LIVE_REFETCH` + inverted gens `[6,5]` | REJECTED |
| `LIVE_REFETCH` + half-null `[5,NULL]` | REJECTED |
| `LIVE` + `deletedAt` set | REJECTED |
| `ABSENT` + LIVE kind | REJECTED |
| `LIVE` + `ABSENT_CONFIRMED_QUERY` kind | REJECTED |
| `ABSENT` without `deletedAt` | REJECTED |
| `ABSENT` without `deletionSource` | REJECTED |
| `ABSENT` + NULL interval (bulk-omission tombstone) | REJECTED |
| **positive control:** valid `LIVE_REFETCH [5,6]` | **ACCEPTED** |

**Coherence constraint verdict: CORRECT — 12/12 illegal states rejected, valid state
accepted.**

**Over-constraint analysis (explicitly required).** I checked the CHECK against the
approved brief rather than assuming:

- Brief line 211: `deletedAt` — "Null if `existenceState=LIVE`." The CHECK's
  `LIVE ⇒ deletedAt IS NULL` is exactly the approved rule, so existence recovery
  (case J) legitimately clears the tombstone fields.
- Brief line 2745: "every tombstone actually written was produced only by
  `ABSENT_CONFIRMED_QUERY`, never by bulk omission alone"; line 1791:
  `ABSENT_CONFIRMED_QUERY` is "the only single-observation ABSENT authority."
  So `ABSENT ⇒ ABSENT_CONFIRMED_QUERY` + non-null interval does not block any approved
  path.
- The `DELETE_WEBHOOK` and `DISCONNECT_WEBHOOK` paths (brief line 2829) each perform an
  authoritative confirming query before tombstoning, so a real direct interval always
  exists; `deletionSource` (`WEBHOOK` / `CONFIRMED_QUERY` / `DISCONNECT`) is left
  unconstrained by the CHECK, which correctly preserves lineage distinction.

I found **no valid future accepted apply path blocked** by this CHECK, and no missing
invalid state.

The three-valued-logic behaviour is sound: every disjunct is guarded by
`IS NULL` / `IS NOT NULL` predicates that yield definite `FALSE` (never `UNKNOWN`), so
no incoherent row can slip through on a NULL-valued CHECK expression.

---

### F-CLAUDE-PR5F1-02 — P2 — Observation terminality — **RESOLVED**

Guard rewritten to a genuine one-way terminal rule:

```sql
IF OLD."lifecycleState" IN ('COMPLETED', 'ABANDONED')
   AND NEW."lifecycleState" IS DISTINCT FROM OLD."lifecycleState" THEN
  RAISE EXCEPTION 'catalog_observation_terminal_transition_forbidden' USING ERRCODE = '23514';
```

#### Terminal transition matrix (independently reproduced)

| From | To | Result | Expected |
|---|---|---|---|
| COMPLETED | ACTIVE | **DENIED** | DENIED |
| COMPLETED | ABANDONED | **DENIED** | DENIED |
| ABANDONED | ACTIVE | **DENIED** | DENIED |
| ABANDONED | COMPLETED | **DENIED** | DENIED |
| ACTIVE | ACTIVE | ALLOWED | ALLOWED |
| ACTIVE | COMPLETED | ALLOWED | ALLOWED |
| ACTIVE | ABANDONED | ALLOWED | ALLOWED |
| COMPLETED | COMPLETED (self, other cols) | ALLOWED | ALLOWED |
| ABANDONED | ABANDONED (self, other cols) | ALLOWED | ALLOWED |
| COMPLETED row, unrelated column update | ALLOWED | ALLOWED |

All four forbidden transitions raise exactly
`ERROR: catalog_observation_terminal_transition_forbidden`.

Response-generation coherence (`CatalogObservationInFlight_lifecycle_response_gen_check`):

- `ACTIVE` + non-null `observationResponseGen` → **REJECTED**
- `COMPLETED` + NULL `observationResponseGen` → **REJECTED**
- `ABANDONED` + NULL `observationResponseGen` → ACCEPTED (existing approved semantics
  retained: an abandoned observation may never have received a response)

A retry must therefore be a **new** observation row/token — a terminal row can never be
walked back to `ACTIVE`. Correct.

---

### F-CLAUDE-PR5F1-03 — P2 — Advisory lock timeout scope — **RESOLVED**

`app/lib/catalog-facts/advisory-lock.ts` verified against all ten required properties:

1. Requires matching tenant transaction context — `requireMatchingTenantContext`. ✓
2. Derives the canonical key centrally — `deriveCanonicalLockKey`. ✓
3. Reads the currently effective `lock_timeout` — `current_setting('lock_timeout')`. ✓
4. `SET LOCAL`s a finite acquisition timeout — `set_config(..., true)`. ✓
5. Executes `pg_advisory_xact_lock(key1, key2)` only (no session-level lock). ✓
6. Restores the caller's prior effective `lock_timeout` on success. ✓
7. Does **not** attempt restoration after a lock timeout (transaction aborted). ✓
8. Translates **only** the advisory acquisition timeout into
   `CanonicalAdvisoryLockTimeoutError` (try/catch wraps only the advisory statement). ✓
9. Documents that the caller must ROLLBACK the whole transaction. ✓
10. Exports no generic 55P03 helper (see F-04). ✓

An important supporting property: `stocky.current_shop_id` is set with
`set_config(..., is_local = true)` in `app/tenant/db-context.server.ts:40`, i.e.
transaction-local. Consequently the tenant-context guard can only pass inside an open
transaction, which in turn guarantees the helper's `SET LOCAL` and
`pg_advisory_xact_lock` are transaction-scoped rather than silently no-op /
instantly-released. Verified empirically (scenario E).

#### Reproduction against real PostgreSQL (exercising the shipped module, not a copy)

| Scenario | Result |
|---|---|
| **A.** caller `lock_timeout=30s`, helper timeout 1000 ms, successful acquisition | `SHOW lock_timeout` before = `30s`, after = `30s`; advisory locks held = 1 → **PASS** |
| **B.** caller `lock_timeout=0`, successful acquisition | before = `0`, after = `0` → **PASS** |
| **C.** stalled holder, helper timeout 900 ms | typed `CanonicalAdvisoryLockTimeoutError` after **902 ms**; next statement fails **25P02**; after ROLLBACK a fresh transaction on the **same pooled session** acquires successfully; session `lock_timeout` = `0` (no leakage) → **PASS** |
| **D.** after successful acquisition (helper timeout 500 ms, caller 3s), later `SELECT … FOR UPDATE` against a blocked row | waited **3002 ms** then `55P03` — used the caller's 3s, **not** the helper's 500 ms → **PASS** |
| **E.** no tenant context / mismatched shop | `CanonicalAdvisoryLockTenantError` in both cases → **PASS** |

**30s lock_timeout restoration verdict: CORRECT.**
**Zero lock_timeout restoration verdict: CORRECT.**
**Stalled-holder timeout verdict: CORRECT — finite, typed, ~900 ms.**
**25P02 / rollback verdict: CORRECT — transaction aborts, rollback recovers, no pooled-session timeout leakage.**
**Later row-lock timeout verdict: CORRECT — scenario D is decisive proof that the
short advisory timeout does not leak into subsequent row locks.**

#### Success-path restore failure (explicitly requested review)

The restore statement on line 140 is **not** wrapped in try/catch, so a restore failure
propagates and the function never returns a `CanonicalLockKey`. The caller therefore
cannot mistake a failed restore for a successful acquisition.

Independently confirmed by injecting a failure on the restore statement only:

```
restore fails -> threw: simulated restore failure   [PASS]
```

Correct behaviour.

---

### F-CLAUDE-PR5F1-04 — P3 — Timeout error API surface — **RESOLVED**

The generic detector was renamed to `isPostgresLockTimeoutError` and made
**module-private**, and its public export was removed:

```diff
-  isLockTimeoutError,
   type CanonicalLockQueryRaw,
 } from "./advisory-lock";
```

**Timeout-error API verdict: CORRECT.** `app/lib/catalog-facts/index.ts` exports only
`acquireCanonicalIdentityAdvisoryLock`, `CanonicalAdvisoryLockTenantError`,
`CanonicalAdvisoryLockTimeoutError` and the query type. No generic helper remains that
would encourage a later unrelated 55P03 row-lock failure to be misclassified as an
advisory-acquisition failure. The aborted-transaction contract is documented in the
module header.

---

### F-CLAUDE-PR5F1-05 — P3 — Capacity fail-closed — **RESOLVED**

Floors enforced by `requireIntAtLeast`: `maxLocksPerTransaction ≥ 1`,
`maxConnections ≥ 1`, `maxPreparedTransactions ≥ 0`, requested batch ≥ 1,
concurrency ≥ 1.

Fail-closed branch (no floor-to-1 override):

```ts
if (conditionACap < 1 || conditionBCap < 1) {
  throw new CanonicalLockCapacityInsufficientError(settings, conditionACap, conditionBCap);
}
```

**Insufficient-capacity verdict: CORRECT.**

```
1/1/0   -> CanonicalLockCapacityInsufficientError (condA=0, condB=0)   [PASS]
1/100/0 -> CanonicalLockCapacityInsufficientError (condA=0, condB=6)   [PASS]
```

**Capacity examples / 64-63 verdict: ALL RETAINED EXACTLY.**

| mlpt/conn/prepared | effective | expected | condA | condB |
|---|---|---|---|---|
| 64/100/0 | 32 | 32 | 32 | 400 |
| 32/100/0 | 16 | 16 | 16 | 200 |
| 16/100/0 | 8 | 8 | 8 | 100 |
| 64/5/0 | 20 | 20 | 32 | 20 |
| mlpt=64, requested=32 | **32** | 32 | | |
| mlpt=63, requested=32 | **31** | 31 | | |

Malformed / hostile inputs rejected: `mlpt=0`, `mlpt=-64`, `mlpt=64.5`, `mlpt=NaN`,
`mlpt=Infinity`, `conn=0`, `prepared=-1`, `batch=0`, `batch=-1`, `batch=1.5`,
`concurrency=0`.

One residual gap found — unsafe / non-finite integers are **not** rejected by the
evaluator. See **NEW-CLAUDE-PR5F1C-01** (P3).

R-161 remains **OPEN** — arithmetic alone does not prove production safety, and the
module says so.

---

### F-CLAUDE-PR5F1-09 — P3 — PostgreSQL settings read — **RESOLVED**

`readPostgresLockCapacitySettings` reads the three real settings via
`current_setting(...)` and validates them.

**Real PostgreSQL settings-read verdict: CORRECT.** Against live PostgreSQL 16.13:

```
read={"maxLocksPerTransaction":64,"maxConnections":100,"maxPreparedTransactions":0}
live={"a":"64","b":"100","c":"0"}                                            [PASS]
live evaluation -> effective=32
```

Rejection coverage (all **PASS**): missing rows, missing field, empty value,
non-numeric, float, `NaN`, unsafe integer (`9007199254740993`), null value, zero floor,
negative value.

No worker integration is required in F1, and none was added.

---

### F-CLAUDE-PR5F1-07 — P3 — Live authority wording — **SUBSTANTIALLY RESOLVED**

`docs/PROJECT_STATUS.md` is consistent and correct:

```
**D-054:** EFFECTIVE
| Next gate | PR5-F1 FOUNDATION IN PROGRESS — D-054 EFFECTIVE …
| Production | NOT AUTHORIZED |
| Inventory-write flags | DEFAULT OFF |
```

`docs/phases/phase-1/README.md` header updated to
`PR5-F1 FOUNDATION CORRECTIONS IN PROGRESS — D-054 EFFECTIVE; later PR5 runtime lanes
NOT STARTED`.

One stale-reading residue remains at `README.md:191` — see **NEW-CLAUDE-PR5F1C-03**
(P3). It is a lineage parenthetical inside a risk list, three lines below an
unambiguous `D-054 EFFECTIVE` header, so it does not create an operative authority
conflict.

---

### F-CLAUDE-PR5F1-08 — P3 — No-Shopify directory guard — **RESOLVED (with a scoped gap)**

The hand-written allowlist was replaced with filesystem enumeration:

```ts
function productionCatalogFactModules(): string[] {
  return readdirSync(DIR).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts")).sort();
}
```

**Directory enumeration verdict: CORRECT for the current flat module layout, and
genuinely dynamic.** I proved it rather than assuming it — I added a hypothetical new
production module containing a prohibited import and ran the suite:

```
× enumerates every production catalog-facts module for prohibited Shopify imports
  → zz-probe.ts: expected 'import { shopifyApp } from "@shopify/…' not to match /@shopify/
```

The new file was caught. Tests are correctly excluded.

`readdirSync` is not recursive, so a production module placed in a **subdirectory** is
silently unscanned — proven, and recorded as **NEW-CLAUDE-PR5F1C-02** (P3). This guard
remains defense-in-depth, not the sole no-Shopify proof.

---

### F-CLAUDE-PR5F1-10 — P3 — Tenant cross-shop relation safety — **RESOLVED**

`app/tenant/relations.ts` was newly expanded during the correction and so received full
review as new surface.

#### All-seven cross-shop verdict: CORRECT

Restricted role `stocky_runtime`, tenant context `shopA`, both shops seeded with
identically-shaped rows:

| Table | Visible rows | Foreign (`shopB`) rows visible |
|---|---|---|
| `ShopifyProductFact` | 1 | **0** |
| `ShopifyProductCollectionMembership` | 1 | **0** |
| `ShopifyVariantFact` | 1 | **0** |
| `ShopifyInventoryItemFact` | 1 | **0** |
| `ShopifyLocationFact` | 1 | **0** |
| `ShopifyInventoryLevelFact` | 1 | **0** |
| `CatalogObservationInFlight` | 1 | **0** |

Write denial:

- cross-shop `UPDATE … WHERE "shopId"='shopB'` → **0 rows affected**; `shopB` data
  verified byte-identical before and after.
- cross-shop `DELETE … WHERE "shopId"='shopB'` → **0 rows affected**; `shopB` rows still
  present.
- `INSERT` of a row owned by `shopB` → `new row violates row-level security policy`.
- tenant hop (`SET "shopId"='shopB'`) → `ERROR: stocky_tenant_key_immutable: shopId
  cannot be changed`.

#### Nested relation foreign-target verdict: CORRECT

Every nested foreign relation target is refused at the database level by the composite
foreign keys, which all carry `shopId`:

| Attempt (shopA child → shopB-only parent) | Result |
|---|---|
| `Variant -> Product` | DENIED — `ShopifyVariantFact_shopId_shopifyProductGid_fkey` |
| `InventoryItem -> Variant` | DENIED — `ShopifyInventoryItemFact_shopId_shopifyVariantGid_fkey` |
| `InventoryLevel -> Location` | DENIED — `ShopifyInventoryLevelFact_shopId_locationGid_fkey` |
| `InventoryLevel -> InventoryItem` | DENIED — `ShopifyInventoryLevelFact_shopId_inventoryItemGid_fkey` |
| `Membership -> Product` | DENIED — `ShopifyProductCollectionMembership_shopId_shopifyProductGi_fkey` |
| **positive control:** `Variant -> Product` (own shop) | ALLOWED |

Application-layer denial is independently covered by the new
`nested-writes.test.ts` cases, which assert `code: "foreign_relation_target"` for
`Variant -> Product` and `InventoryLevel -> Location` (10/10 passed locally).

Two independent mechanisms therefore prevent cross-shop attachment: TenantDb selector
ownership resolution, and the composite `(shopId, shopifyGid)` foreign keys.

#### Canonical tombstone / physical-delete relation verdict

This was the specific new review question, and I investigated it rather than dismissing
it.

`allowedNestedOperations` is a real enforcement allowlist, not documentation —
`tenant-db.server.ts:439` rejects any nested operation absent from it. The newly
registered to-many canonical relations list `delete` and `deleteMany`.

Physical deletion of a canonical fact row **is** reachable in principle:

- `stocky_runtime` holds full `DML` (`SELECT/INSERT/UPDATE/DELETE`) on all seven new
  tables (`scripts/tenant-enforcement/manifest.ts`), and a tenant-scoped RLS `DELETE`
  policy exists.
- The immutability trigger is `BEFORE UPDATE OF "shopId"` only — it guards tenant
  reassignment, **not** deletion.
- No database trigger forbids `DELETE` on the fact tables.

However, this is **not a new exposure introduced by the correction**, and the tenant
architecture is not defeated:

- `app/tenant/models.ts` was **not** modified by the correction, and all seven tables
  were already registered as merchant-owned models at the originally reviewed head
  `7cea26c`. Top-level `tenantDb.shopifyProductFact.delete(...)` was therefore already
  reachable before this correction, and the initial Tier-A review did not treat that as
  a defect.
- The added nested metadata is identical in shape to every pre-existing merchant-domain
  to-many relation (e.g. `Supplier.skuMappings`), so it is consistent generic tenant
  authorization metadata rather than a canonical-fact-specific grant.
- Deletion remains strictly tenant-scoped (verified above: 0 rows affected
  cross-shop), so there is **no cross-tenant or cross-identity corruption path**.
- Parent facts are additionally protected by `ON DELETE RESTRICT` / `NO ACTION`
  composite FKs, so a product with variants, an inventory item with levels, or a
  location with levels cannot be physically removed.

`disconnect` / `set` / `connectOrCreate` / `upsert` were reviewed for identity/history
corruption:

- `ShopifyVariantFact.shopifyProductGid`, `ShopifyInventoryLevelFact.inventoryItemGid`
  and `.locationGid` are **NOT NULL**, so their to-one relations are required and
  Prisma itself rejects `disconnect` / `set` on them — no required lineage can be
  severed.
- Only `ShopifyInventoryItemFact.shopifyVariantGid` is nullable, and an inventory item
  with no variant is an explicitly approved state (the migration documents the
  `MATCH SIMPLE` optional composite FK), so `disconnect` there is legitimate.
- `connectOrCreate` / `upsert` selectors pass through
  `resolveOwnedRelationSelectors`, which resolves within tenant scope; combined with the
  composite FKs, no cross-tenant or cross-identity relationship can be formed.

The tombstone contract is a **product/apply-lane invariant**, not a TenantDb invariant,
and the foundation does not mechanically enforce it. I record that honestly as
**NEW-CLAUDE-PR5F1C-04** (P3) rather than inventing a blocker, because the generic
architecture does correctly prevent the *tenant-safety* failure mode and the physical
delete surface predates this correction.

---

## 5. Migration / schema freeze

**Migration/schema consistency verdict: CONSISTENT.**

After `prisma migrate deploy` (18 migrations) plus the compatibility-index step, the
project's authoritative drift gate reports:

```
{"event":"tenant_prisma_schema_drift_ok","commandClass":"prisma_migrate_diff","exitCode":0}
```

The Prisma schema equals the fresh migration outcome. Independently, a raw
`prisma migrate diff` before compatibility indexes mentioned **no PR5 object at all** —
every residual difference was a pre-existing legacy compatibility index, confirming the
PR5 migration itself is drift-free.

| Requirement | Verdict |
|---|---|
| Prisma schema == fresh migration outcome | CONSISTENT (drift gate exit 0) |
| Migration additive relative to `main` | YES — `git diff --name-status` shows a single `A` (added) migration directory |
| No existing-main migration changed | CONFIRMED — no `M` entry under `prisma/migrations/` |
| No destructive existing-table rewrite | CONFIRMED — no `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN … TYPE`, `TRUNCATE`, `DELETE FROM`, or data `UPDATE` in the migration |
| Only nullable `SyncRun` additions affect an existing table | CONFIRMED — `ADD COLUMN "fenceAt" TIMESTAMP(3), ADD COLUMN "fenceGeneration" BIGINT` (both nullable); the only `ALTER TABLE` against a pre-existing table |
| Sequence privileges exact | CONFIRMED (below) |
| Lifecycle triggers safe | CONFIRMED (F-02; `SET search_path = pg_catalog, pg_temp`, `REVOKE ALL … FROM PUBLIC`) |
| Existence CHECK constraints valid | CONFIRMED (F-01 / F-06) |
| Composite FKs tenant-safe | CONFIRMED (F-10) |
| Legacy caches intact | CONFIRMED (below) |

**Sequence privilege verdict: EXACT.**

```
PUBLIC usage=false
runtime USAGE=true        runtime UPDATE=false      runtime SELECT=false
control_plane USAGE=true  control_plane UPDATE=false
setval as runtime -> ERROR: permission denied for sequence stocky_catalog_observation_gen_seq
nextval as runtime -> 1
```

USAGE-only, `UPDATE` never granted, `setval`/reset/reuse forbidden, PUBLIC revoked.

**Legacy-cache verdict: INTACT.** `ShopifyVariantCache` (13 columns) and
`InventorySnapshot` both still present and untouched; the migration header explicitly
states it does not drop them.

**Tenant/RLS regression verdict: NO REGRESSION.** Full enforcement chain re-run by this
reviewer on the corrected head, all green:

```
tenant:enforcement:inventory:check ok
preflight        ok=True
apply            ok=True applied=True
roles-verify     ok=True
rls-verify       ok=True
immutability-verify ok=True
verify           ok=True
drift            ok=True
```

**Lock-key regression verdict: NONE.** `app/lib/catalog-facts/lock-key.ts` was **not**
modified by the correction (`git diff --quiet` clean across the 7-commit range), so the
canonical key derivation reviewed at `7cea26c` is unchanged.

**No-Shopify-network verdict: CLEAN.** No `@shopify`, `graphql`, `fetch(`, `axios`,
`node-fetch` or URL literal appears in any production module under
`app/lib/catalog-facts/`.

**No-Shopify-write verdict: CLEAN.** No Shopify mutation exists anywhere in the
foundation. Inventory-write feature flags remain env-gated and default **OFF**;
`foundation-safety.test.ts` asserts all four defaults are `false` and passes.

---

## 6. Independent execution summary (corrected head)

| Suite | Result |
|---|---|
| `prisma migrate deploy` (fresh DB) | 18 migrations applied |
| Prisma schema drift gate | `exitCode 0` |
| Tenant enforcement chain (8 steps) | all `ok=true` |
| `app/lib/catalog-facts/` unit tests | **15 passed** (3 files) |
| `pr5-catalog-fact-foundation` + `sequence-privilege` | **21 passed** |
| `app/tenant/__tests__/nested-writes.test.ts` | **10 passed** |
| Advisory-lock scenarios A–E (live PostgreSQL) | **5/5 PASS** |
| Capacity / settings-read scenarios | 26/27 PASS (1 gap → C-01) |
| Existence coherence matrix | 12/12 illegal rejected, control accepted |
| Terminal transition matrix | 4/4 forbidden denied, 6/6 allowed permitted |
| Cross-shop isolation (7 tables + 5 nested targets) | all denied, control allowed |

Two transient local failures were observed and traced to **my own harness**, not to the
code: `DATABASE_CONTROL_PLANE_URL` and `STOCKY_RUNTIME_ROLE_PASSWORD` were initially
unset. With correct environment both suites pass fully (21/21 and 10/10). Recorded here
for honesty; they are **not** findings.

I did not re-run the full historical PR3/PR4 suites locally, because exact-corrected-head
full CI already did (see §7).

---

## 7. Exact-head CI evidence

Authoritative run for head `63e157d918a408c155cbfea3ae9996bbb35006c2`:

| Item | Value |
|---|---|
| Run | `31982193797` |
| Event | `pull_request` |
| `head_sha` | `63e157d918a408c155cbfea3ae9996bbb35006c2` |
| Base | `ae1b428039152efc6b4a46107e1bcca5eb17586a` |
| Conclusion | **SUCCESS** |
| Classify (`95250860991`) | **SUCCESS** — `docs_only=false`, `full_ci=true`, `classification_reason=non_docs_or_unknown_path` |
| Heavy (`95250881419`) | **SUCCESS** — 135 steps, all green (lint, typecheck, tests, migrations, tenant enforcement, RLS, build, GraphQL) |
| CI Gate (`95256870472`) | **SUCCESS** — evaluated only after Heavy completed |
| Changed path count | 39 (verified independently via `git diff --name-only`) |

**Corrected-head CI verdict: GREEN AND AUTHORITATIVE.** Job IDs, event, head SHA and
base all match exactly. Earlier failed/superseded runs (`31968046370`, `31968529979`,
`31968565003`, `31968723550`, `31971590179`, `31972263255`, `31978737796`,
`31981763855`) were **not** treated as current-head evidence.

---

## 8. New findings

All new findings are **P3 (nonblocking hardening)**. No P0, P1 or P2 remains.

### NEW-CLAUDE-PR5F1C-01 — P3 — Capacity evaluator accepts unsafe / non-finite settings

- **File:** `stocky-plus/app/lib/catalog-facts/lock-capacity.ts:63-68`
- **Evidence:** `requireIntAtLeast` checks `Number.isInteger(value)` but not
  `Number.isSafeInteger(value)`, while `parsePostgresIntSetting` (same module, line 156)
  *does* enforce `Number.isSafeInteger`. Reproduced:

  ```
  mlpt=2^53                     ACCEPTED  condA=4503599627370496  sharedBudget=900719925474099200
  mlpt=2^53+2                   ACCEPTED  condA=4503599627370497  (silent precision loss)
  MAX_VALUE (integral float)    ACCEPTED  condA=8.98e+307  condB=Infinity  sharedBudget=Infinity
  ```

  `Number.isInteger(Number.MAX_VALUE)` is `true`, so an infinite shared-lock budget is
  reported as `capacitySufficient: true`.
- **Merchant impact:** None today. The only production path to settings is
  `readPostgresLockCapacitySettings`, which rejects unsafe integers, and real PostgreSQL
  cannot report such values. Effective output also stays bounded by the requested batch
  (32 in every probe).
- **Reproduction:** call `evaluateCanonicalLockCapacity({maxLocksPerTransaction: Number.MAX_VALUE, maxConnections: 100, maxPreparedTransactions: 0})`.
- **Expected behavior:** a fail-closed guard should reject non-finite / unsafe integers
  rather than emit `Infinity` diagnostics and claim sufficiency.
- **Recommended correction:** use `Number.isSafeInteger` in `requireIntAtLeast` (and an
  explicit upper bound for the derived budgets).
- **Missing test:** unsafe-integer and `Number.MAX_VALUE` cases in
  `lock-capacity.test.ts` for `evaluateCanonicalLockCapacity` (the settings reader is
  already covered).

### NEW-CLAUDE-PR5F1C-02 — P3 — No-Shopify scan is not recursive

- **File:** `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts:9-14`
- **Evidence:** `readdirSync(DIR)` is non-recursive. Proven by placing a production
  module containing `import { shopifyApp } from "@shopify/shopify-app-remix/server"` at
  `app/lib/catalog-facts/sub/nested.ts`: the suite reported `Tests 3 passed (3)`. The
  same file placed flat was correctly caught.
- **Merchant impact:** None today — no subdirectory exists. Risk is future erosion of a
  defense-in-depth guard as PR5 lanes add structure.
- **Reproduction:** as above; remove the file afterwards.
- **Expected behavior:** enumerate recursively (`readdirSync(DIR, { recursive: true })`
  on Node ≥ 20, or a walk).
- **Recommended correction:** make the enumeration recursive.
- **Missing test:** a fixture asserting a nested production module is scanned.

### NEW-CLAUDE-PR5F1C-03 — P3 — Stale "D-054 conditional" parenthetical in a live record

- **File:** `stocky-plus/docs/phases/phase-1/README.md:191`
- **Evidence:** `- **R-129 through R-160:** OPEN — PR 5 planning / implementation-entry
  risks (D-053 / D-054 conditional); not implementation-closed.`
- **Merchant impact:** None. Documentation clarity only. The same file's header three
  lines from the top states `D-054 EFFECTIVE`, and `PROJECT_STATUS.md` is unambiguous,
  so there is no operative authority conflict. The phrase is historically accurate about
  how those risks were opened (D-054 carried nine conditions; condition 9 was later
  satisfied), but reads as a live authority statement.
- **Expected behavior:** live control records should not carry
  "D-054 conditional" phrasing outside clearly historical evidence.
- **Recommended correction:** reword to e.g. "(raised under D-053 / D-054; D-054 now
  EFFECTIVE)".
- **Missing test:** none required (docs lint optional).

### NEW-CLAUDE-PR5F1C-04 — P3 — Tombstone contract not mechanically enforced against physical delete

- **Files:** `stocky-plus/app/tenant/relations.ts:281-448`;
  `stocky-plus/scripts/tenant-enforcement/manifest.ts:323-430`;
  `stocky-plus/scripts/tenant-enforcement/sql.ts:130-140`
- **Evidence:** the five new to-many canonical relations permit nested `delete` /
  `deleteMany`; `stocky_runtime` holds `DELETE` on all seven fact tables; the
  immutability trigger only guards `shopId` (`BEFORE UPDATE OF "shopId"`); no trigger
  forbids `DELETE`. The approved product rule requires deletion to tombstone and
  preserve historical identity.
- **Merchant impact:** None today — foundation-only, no writer, no production, flags
  OFF. If a future PR5 lane called these paths, a leaf canonical fact (e.g. an
  `InventoryLevel`) could be physically removed, losing tombstone history. Parent facts
  are protected by `ON DELETE RESTRICT` / `NO ACTION`.
- **Not a new exposure:** all seven models were already merchant-registered at the
  originally reviewed head `7cea26c` (`models.ts` unchanged by the correction), so
  top-level `delete` was already reachable; the added nested metadata matches every
  pre-existing merchant relation. Tenant scoping is fully intact (cross-shop delete
  affects 0 rows).
- **Expected behavior:** canonical fact rows should be tombstoned, never physically
  deleted, by any application path.
- **Recommended correction (downstream lane, not this PR):** either drop `delete` /
  `deleteMany` from the canonical fact relation metadata, or add a database trigger
  rejecting `DELETE` on the five fact tables, and state the tombstone-only contract in
  the PR5 apply-lane brief.
- **Missing test:** an assertion that physical deletion of a canonical fact row is
  refused.

---

## 9. Risks

| Risk | Status |
|---|---|
| R-157 | **OPEN** |
| R-158 | **OPEN** |
| R-159 | **OPEN** |
| R-160 | **OPEN** |
| R-161 | **OPEN** — advisory-lock capacity; arithmetic alone does not prove production safety |

No risk is closed by this review.

**No later PR5 lane confirmation:** no downstream PR5 runtime lane has been authorized
or started. The correction delta contains no extraction, JSONL, webhook apply engine,
reconciliation, compatibility projection, or UI work. Verified by inspecting all 15
changed files.

**PR5 production authorization state:** NOT AUTHORIZED. Merchant production data NOT
AUTHORIZED. Shopify mutations NOT AUTHORIZED.

**Inventory-write flag state:** DEFAULT OFF (all four asserted `false` by a passing
test).

**No D-055** was created or implied by this review.

---

## 10. Verdict

Counts for this re-review:

- **P0 = 0**
- **P1 = 0**
- **P2 = 0**
- **P3 = 4** (NEW-CLAUDE-PR5F1C-01 … -04), all nonblocking

All ten initial findings are correctly resolved. The P1 existence-evidence defect is
fully corrected and now enforced by the database on all five fact tables; the two P2
defects (observation terminality, advisory lock timeout scope) are corrected and
independently reproduced against real PostgreSQL 16.

### FINAL VERDICT

**APPROVE PR5-F1 FOUNDATION CORRECTION**

This approval means the corrected PR5-F1 foundation is safe for ChatGPT's final merge
decision and foundation freeze.

It does **not**: merge PR #27; authorize production; authorize Shopify inventory writes;
close R-157/R-158/R-159/R-160/R-161; close Phase 1; authorize PR6; or start parallel PR5
lanes before merge and post-merge `main` CI.
