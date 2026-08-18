# PR5-F2C Compatibility Projection Core — Independent Review

**Reviewer:** Claude Code (independent principal engineer / architecture, security, and release-risk review)
**Review tier:** Tier-A adversarial, first independent review
**Date:** 2026-08-18
**Authority:** `AGENTS.md`, `CLAUDE.md`, `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md` (D-054 EFFECTIVE),
`stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`,
`stocky-plus/docs/RISK_REGISTER.md`

This document is immutable review output. It does not modify runtime, test, schema, migration,
package, or CI files.

---

## 1. Verified identity

| Field | Claimed | Independently verified |
|---|---|---|
| Authorized base / `origin/main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` | **CONFIRMED** — `git rev-parse origin/main` |
| Reviewed PR head | `4bdb1dac97323f079554590d7ac15962b8227283` | **CONFIRMED** — PR #30 `head.sha`, and `git merge-base origin/main HEAD` = base |
| PR state | OPEN / DRAFT / UNMERGED | **CONFIRMED** — `state: open`, `draft: true`, `merged: false` |
| Exact-head CI run | `32103582494`, event `pull_request`, SUCCESS | **CONFIRMED** — all three jobs, `head_sha` equals live head |
| Classify job | `95608618133` SUCCESS | **CONFIRMED** |
| Heavy job | `95608653519` SUCCESS | **CONFIRMED** (135 steps, all SUCCESS) |
| CI Gate job | `95619413426` SUCCESS | **CONFIRMED** |
| Diff shape | 16 files, +3936 / −23 | **CONFIRMED** |

The PR head is a true descendant of the authorized base with no rebase or divergence. CI evidence is
attached to the exact reviewed head, not a superseded one.

---

## 2. Scope verdict — **PASS**

Independently enumerated diff (`git diff --numstat base head`):

- 8 new runtime files under `app/lib/catalog-facts/compatibility-projection/`
- 4 new test files in the same directory
- 1 new PostgreSQL test `app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`
- 1 line added to `scripts/tenant-access/allowlist.ts` `TEST_FILES`
- 2 documentation files (implementation report; regenerated PR2 inventory)

**Absent from the diff, as required:** `prisma/schema.prisma`, any migration, any worker or
scheduler, `package.json`, `.github/workflows/ci.yml`, any route, any Shopify client, any forecast /
ABC / `LowStockAlert` code.

Shared-file base-identity independently proven by blob SHA, not by diff absence:

| File | Base blob | Head blob | Result |
|---|---|---|---|
| `.github/workflows/ci.yml` | `16ab27b2…` | `16ab27b2…` | **identical** |
| `stocky-plus/package.json` | `a68e16ba…` | `a68e16ba…` | **identical** |
| `stocky-plus/app/lib/catalog-facts/foundation-safety.test.ts` | `62690c12…` | `62690c12…` | **identical** |

`PR2_TENANT_ACCESS_INVENTORY.md` (+143 / −23) is pure regeneration: content digest, scanned-file
count 258→271, findings 1408→1526, converted paths 450→462, approved exception findings 958→1064,
plus per-model counts and the new `EX-TEST-035` row. No policy or rule text changed.

---

## 3. Canonical authority verdict — **PASS**

`projectCompatibilityFromCanonicalFacts` reads canonical facts and writes **only**
`ShopifyVariantCache` and `InventorySnapshot`. Independently verified by reading every runtime file,
not by trusting `safety.test.ts`:

- The only canonical-model calls are `shopifyVariantFact.findMany` / `findUnique` and
  `shopifyInventoryLevelFact.findMany` / `findUnique` (`project.ts:200,220,249,267,288,337,361`).
- No `update`, `updateMany`, `upsert`, `create`, or `delete` on any `*Fact` model anywhere in the module.
- `compatibilityProjectionState` appears in the module only inside comments
  (`constants.ts:21`, `project.ts:174`, `types.ts:77`). Zero writes.
- No Shopify network I/O, no GraphQL document, no `admin` client, no `fetch`, no advisory-lock or
  canonical-applicator helper.
- **The module has zero production importers.** Independently verified: the only files outside the
  module that reference it are its own PostgreSQL test. It is not wired into F2B, any worker, or any
  route.

Because the lane performs no canonical write and joins no canonical transaction, brief **D3.1**
("canonical apply succeeds + projection fails → canonical facts preserved") holds *structurally*,
which is a stronger guarantee than a tested one.

---

## 4. Variant-cache mapping verdict — **PASS with one P1 (see F2C-01)**

Field-by-field comparison against the live legacy writer `ingestBulkVariantCache`
(`app/services/shopify-sync.server.ts:27-82`):

| Legacy field | `ingestBulkVariantCache` | F2C projection | Parity |
|---|---|---|---|
| `title` | `` `${productTitle} — ${variant.title}` `` when parent title known, else `variant.title` | `mapping.ts:19-27`, identical separator `" — "` (`constants.ts:7`) | **exact** |
| `sku` | Shopify `variant.sku` | `variant.sku` | **exact** |
| `barcode` | Shopify `variant.barcode` | `variant.barcode` | **exact** |
| `imageUrl` | `variant.image?.url` | `product?.featuredMediaUrl ?? null` | source differs (variant image vs product featured media) — accepted, canonical has no variant-image fact |
| `inventoryItemId` | `variant.inventoryItem?.id` (1:1) | lexicographically first LIVE item | **see F2C-01** |
| `weight` / `weightUnit` | Shopify measurement, written raw | quantized to 4 dp, overflow fails closed | **see §5** |
| `shopifyProductId` | `variant.__parentId` | `variant.shopifyProductGid` | **exact** |

Tombstoned variant (`existenceState !== "LIVE"`) produces a `tombstone` plan rather than an upsert
(`mapping.ts:57-63`) — correct; a tombstoned variant must not remain in the cache as live truth.

Tombstoned **product** under a LIVE variant drops the title prefix and nulls `imageUrl` — see
**F2C-05**.

---

## 5. Multiple-LIVE-inventory-item verdict — **FAIL (P1)**

The review contract required determining independently whether multiple LIVE `InventoryItem` rows per
variant are impossible, safely equivalent, or corruption. **They are none of the first two.**

Frozen schema, `prisma/schema.prisma` `ShopifyInventoryItemFact`:

```
shopifyVariantGid  String?  @db.VarChar(256)
@@unique([shopId, id])
@@unique([shopId, shopifyGid])
@@index([shopId, shopifyVariantGid])     // index, NOT unique
```

`shopifyVariantGid` is nullable and carries only a non-unique index. `existenceState` participates in
no uniqueness constraint. **Multiple LIVE inventory items for one variant are fully representable
under the frozen schema.** Nothing fails closed, and nothing in the approved brief authorizes an
arbitrary-selection rule (§ brief line 2627 lists the fields only).

This is not safely equivalent, because the selected GID is not cosmetic — see F2C-01.

---

## 6. Weight-precision verdict — **PASS on contract, P3 on determinism and tests**

Canonical `weightValue` is `Decimal(20,6)`; legacy `ShopifyVariantCache.weight` is `Decimal(10,4)`.
Precision loss is therefore routine, not exotic.

**Silent quantization is contract-compatible**, and the money rules correctly do *not* apply here:

- The live legacy writer passes the raw Shopify weight straight into the `numeric(10,4)` column
  (`shopify-sync.server.ts:62`). **PostgreSQL already silently rounds it half-away-from-zero on
  store.** `toDecimalPlaces(4)` (decimal.js default `ROUND_HALF_UP`) reproduces that same result.
  The projection is therefore bug-compatible with the legacy cache by construction, not by accident.
- Weight is a descriptive attribute, not an inventory or money quantity; no downstream arithmetic
  accumulates it. Fail-closed on 5th-decimal loss would be stricter than the legacy contract for no
  merchant benefit.

**Overflow is handled better than legacy** and in the right order: `mapping.ts:42-49` quantizes
*first*, then rejects `abs() >= 1000000`, so `999999.99995` (which quantizes up to `1000000.0000`)
correctly throws instead of triggering a raw PostgreSQL `numeric field overflow`. On the legacy path
the same value aborts the entire bulk ingest with an untyped error.

Two residual defects: **F2C-09** (global rounding-state dependence) and **F2C-10** (the required
boundary cases are untested). Note also that the non-retryable overflow error interacts with
**F2C-02**.

---

## 7. Null-vs-zero verdict — **PASS within the lane; NOT end-to-end (see F2C-06)**

`resolveSnapshotQuantity` (`mapping.ts:122-159`) implements the required distinction correctly, and I
falsified each case demanded by the contract:

| Case | Behavior | Correct |
|---|---|---|
| LIVE + `availableQuantity = null` | throws `canonical_available_quantity_missing`, retryable | ✅ |
| `availableQuantity = 0` | projects `0` exactly | ✅ |
| `availableQuantity = -2` (schema `Int?` permits) | copied exactly, **not clamped** | ✅ |
| Location state missing / relation null | throws `canonical_location_state_missing`, retryable | ✅ |
| Location explicitly ABSENT | projects `0` | ✅ |
| Variant existence unknown (`null`) | throws `canonical_variant_state_missing`, retryable | ✅ |
| Variant explicitly ABSENT | projects `0` | ✅ |
| Item explicitly ABSENT | projects `0` | ✅ |
| Level itself ABSENT | projects `0` | ✅ |
| Missing `shopifyVariantGid` | throws `canonical_variant_link_missing`, retryable | ✅ |

The ordering is right: `hasExplicitNonLiveEvidence` (`mapping.ts:103-112`) gates zero on *explicit*
ABSENT evidence only; `null` is never treated as ABSENT (`types.ts:161-165` documents this, and
`coerceLevel` at `project.ts:546-554` produces `null`, not a default, when the nested variant is
absent from the read).

**Identity is never inferred.** `requireKnownVariantGid` (`mapping.ts:161-174`) reads only
`inventoryItem.shopifyVariantGid`. I grepped the module: there is no fallback to SKU, barcode, title,
or `ShopifyVariantCache` anywhere. `resolveVariantFromInventoryItem` (the legacy reverse lookup in
`webhook-processor.ts:287-297`) is *not* used by this module.

**Retry repairs stale rows.** Verified by the failure/retry structure (§10) and covered by the
PostgreSQL tests at lines 351, 630, and 916.

The `coerceLevel` coercion `typeof row.availableQuantity === "number" ? … : null` (`project.ts:559`)
is safe: `availableQuantity` is `Int?`, so Prisma returns `number | null`, never `BigInt` or
`Decimal`. `coerceExistence` is total: `CatalogExistenceState` has exactly `LIVE` and `ABSENT`
(`schema.prisma:1045-1048`), so no legitimate enum value is misrouted into the non-retryable
`invalid_canonical_existence` path.

**The guarantee stops at this lane's boundary — see F2C-06.**

---

## 8. Missing-link verdict — **PASS**

`canonical_variant_link_missing` is retryable, carries the failing identity, and never invents a
relationship. One ordering note that is *conservative in the right direction*:
`mapInventoryLevelToLegacySnapshot` calls `requireKnownVariantGid` **before**
`resolveSnapshotQuantity` (`mapping.ts:180-181`), so an ABSENT level whose item has no
`shopifyVariantGid` fails closed rather than projecting zero to an unknown row. That is correct —
zeroing requires knowing *which* legacy row to zero. Covered by `mapping.test.ts:297`.

---

## 9. Tombstone verdict — **PASS**

`applyVariantPlan` tombstone branch (`legacy-writer.ts:58-77`):

- Deletes only from `ShopifyVariantCache` — a **rebuildable projection**, not canonical truth. No
  canonical row is deleted anywhere in the module. ✅
- **Cross-shop rows cannot be touched.** Verified at the TenantDb layer, not assumed:
  `deleteMany` runs inside `withWriteTransaction` and merges `tenantScopeWhere` into the caller's
  where clause (`tenant-db.server.ts:1763-1774`); `findMany` merges the same scope
  (`tenant-db.server.ts:1636-1651`). `db.$transaction` builds a fresh tenant-bound client via
  `createTenantDbFromClient(tx, authority, true)` and asserts transaction-local tenant context
  (`tenant-db.server.ts:1931-1935`), so the `tx` handed to the writer is fully scoped. Both models
  are registered `DIRECT_MERCHANT_MODELS` (`app/tenant/models.ts:9-10`). ✅
- **Old historical snapshots are not rewritten.** Only `snapshotDate = plan.snapshotDate` (today) is
  upserted; prior dates are read for their `locationId` only and left untouched. ✅
- **Today's zero genuinely prevents masquerading.** Verified against the real consumer:
  `forecasting.server.ts:202-208` resolves on-hand with
  `findFirst({ orderBy: { snapshotDate: "desc" } })` and feeds it to `calculateToBuy` at line 214.
  Writing today's row at `0` therefore *does* supersede an older non-zero snapshot for every location
  the variant was ever stocked at. ✅

Nested relation reads cannot leak across shops independently of TenantDb: every canonical relation is
a **composite foreign key on `[shopId, …]`** (`schema.prisma` — `ShopifyVariantFact.product`,
`ShopifyInventoryItemFact.variant`, `ShopifyInventoryLevelFact.inventoryItem` / `.location`), so
`VARIANT_INCLUDE` and `LEVEL_INCLUDE` are structurally same-tenant by schema construction.

Performance defect in this path: **F2C-08**.

---

## 10. Retry / failure-isolation verdict — **PASS**

**Canonical rollback is impossible**, not merely untested: the lane opens no canonical transaction and
issues no canonical write (§3). There is no shared transaction to poison.

**Partial projection is coherent.** In `identities` mode (`project.ts:129-154`),
`queued.shift()` executes only *after* `projectOneIdentity` resolves. On failure the failing identity
remains at `queued[0]` and is returned in `remainingIdentities`, so retry re-attempts the exact
failing identity and every successor — no silent skip. Already-applied legacy writes stay applied,
which is sound because the projection is rebuildable and every write is an idempotent upsert keyed on
the legacy unique constraint.

**Failure visibility is explicit:** `status: "FAILED"`, `retryable`, `failure.code`,
`failure.identity`, plus accurate processed counts and `hasMore`.

**Retry is idempotent:** every legacy write is `upsert` on `[shop, shopifyVariantId]` or
`[shop, shopifyVariantId, locationId, snapshotDate]`; the tombstone `deleteMany` is naturally
idempotent.

Residual defects: **F2C-02** (non-retryable poison row wedges `shop_rebuild`) and **F2C-03**
(unknown errors always classified retryable).

---

## 11. `shop_rebuild` cursor verdict — **PASS on traversal, P2/P3 on validation**

Two-phase bounded traversal, adversarially traced:

| Case | Behavior | Result |
|---|---|---|
| Zero variants | `variants.length (0) !== asked` ⇒ `moreVariants=false`; falls through to levels with full budget | ✅ no skip |
| Zero levels | `moreLevels=false`, `cursor: null`, `hasMore: false` | ✅ terminates |
| Exact page boundary (variants fill batch) | extra `take: 1` probe past `afterVariantGid` decides `hasMore` — no phantom extra page, no premature termination | ✅ |
| Last variant consumes batch exactly, no more variants | transitions phase, `remaining === 0` ⇒ probes levels and returns `{phase:"inventory_levels"}` with `hasMore` from the probe | ✅ no skipped level |
| Variants → levels transition | `afterItemGid` / `afterLocationGid` explicitly reset to `undefined` (`project.ts:244-245`) | ✅ no stale cursor |
| Composite cursor | `levelAfterWhere` (`project.ts:386-402`) is the correct keyset predicate: `item > X OR (item = X AND location > Y)` | ✅ no skip, no duplicate |
| Repeated retries | cursor advances only after a successful write (`project.ts:213`, `280-281`); catch returns the last-successful cursor | ✅ bounded, no loss |
| Determinism | `orderBy { shopifyGid: asc }` and `[{inventoryItemGid: asc},{locationGid: asc}]` over columns backed by `@@unique([shopId, shopifyGid])` / `@@unique([shopId, inventoryItemGid, locationGid])` — total orders, stable | ✅ |

**Canonical rows changing between pages.** Correctly *not* certified. Keyset pagination over a
mutating table can miss a row inserted before the cursor and re-read a row updated after it. The
implementation acknowledges this: `types.ts:71-78` and `project.ts:171-175` both state that a rebuild
is "not proof of complete merchant compatibility convergence." **The core does not claim that a final
page certifies convergence** — verified independently; no code path derives a completeness or health
conclusion from `hasMore === false`. `cursor: null` means only "this traversal reached its end,"
which `buildResult` never converts into a health decision.

Residual: **F2C-03** / **F2C-04** (cursor field validation).

---

## 12. Concurrency / fence-limitation verdict — **PASS (correctly deferred)**

The later synchronization/fence integration remains required and is honestly declared. No fence,
watermark, epoch, or `SyncCursor` interaction exists in this lane, and none is claimed. Brief §D1 and
the Race P–AW matrix are untouched and remain open work.

---

## 13. Health-contract verdict — **PASS (correctly deferred, correctly non-claimed)**

Independently verified by exhaustive grep of the module:

- No `recommendedCanonicalProjectionState` symbol exists anywhere in the repository.
- No HEALTHY or DEGRADED recommendation is produced.
- No `compatibilityProjectionState` write (§3).
- `canonicalHealthDecision` is a literal type pinned to `"deferred_to_integration"`
  (`constants.ts:25`, `types.ts:49`) and `buildResult` sets it unconditionally (`project.ts:584`) —
  it is not reachable as any other value, including on a final `hasMore=false` page.

**Against the approved brief:** merchant-durable DEGRADED/HEALTHY *is* required —
`PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` §D3.2 ("Failure is surfaced on merchant
`compatibilityProjectionState = DEGRADED`"), §D3.4, line 2664 (Race F), and line 2557. **None of it
is implemented here.** `deferred_to_integration` is the correct result for this isolated lane, and
the PR body's explicit non-claims are accurate. **This review does not mark the PR5 health
requirement implemented.** R-145 (P1, "Silent stale legacy compatibility projection") must remain
**OPEN**; F2C-07 explains why it is load-bearing.

---

## 14. Orphan-row verdict — **PASS — keep R-142 OPEN**

- `shop_rebuild` reads canonical facts exclusively; it never reads `ShopifyVariantCache` or
  `InventorySnapshot` as evidence. The only legacy *read* in the module is the tombstone path's
  location enumeration (`legacy-writer.ts:62-64`), which is used to decide *where to write today's
  zero* — never to establish canonical truth. ✅
- No deletion is driven by absence from the traversal. The only `deleteMany` is triggered by an
  explicit canonical ABSENT variant, never by "not found while paging." ✅
- No global-convergence claim is made (§11). ✅

Downstream orphan cleanup genuinely requires a proven canonical-domain completeness/fence contract
that does not exist yet: with keyset pagination over a mutating table and no fence generation, "absent
from this traversal" cannot be distinguished from "inserted or moved during the traversal." Deleting
on that basis would destroy live merchant data. **R-142 must remain OPEN.**

---

## 15. `processingEnabled` verdict — **PASS on ordering, P3 on authority**

`project.ts:48-63` returns `DENIED_PROCESSING_DISABLED` **before** `createTenantDb` is called
(line 73) — verified by statement order, so no TenantDb connection, no tenant context, and no
merchant write occurs when the gate is closed. `!== true` correctly rejects truthy non-boolean values.
Covered by `request.test.ts:29` (asserts TenantDb is never constructed) and the PostgreSQL test at
line 578.

The caller-supplied limitation is disclosed (`types.ts:60-65`), but it is a real weakening relative to
established codebase precedent — see **F2C-12**. Brief §D3.5 is **not** satisfied by this lane alone.

---

## 16. Tenancy / allowlist verdict — **PASS**

- Cross-shop isolation is enforced by TenantDb scope injection on every operation this module uses
  (§9), backed by transaction-local tenant context and RLS, and exercised against real PostgreSQL by
  `pr5-f2c-compatibility-projection.test.ts:459` ("isolates projection writes to the authenticated
  shop"). `projectOneIdentity` additionally passes `shopId` explicitly in both `findUnique` selectors
  (`project.ts:339`, `365`) — defense in depth.
- Note for the record: the `shop_rebuild` `findMany` where-clauses contain **no** tenant predicate of
  their own (`project.ts:201`, `268`). This is architecturally correct — TenantDb owns scoping — but
  it means isolation here is entirely inherited. The PostgreSQL test is the load-bearing evidence, and
  it exists.
- **EX-TEST-035 verified exactly:** `TEST_FILES` contains 35 entries; the added path is entry 35, so
  `EX-TEST-${35}` is correct. Category `migration_tests`, `productionRuntime: "no"`
  (`allowlist.ts:223`), owner `phase-1-pr2-tenant-access`. The path is the exact test file — no glob,
  no directory. **No production allowlist (`RUNTIME_FILES` / `ENFORCEMENT_FILES`) was widened.**

---

## 17. Side-effect scan verdict — **PASS**

Proven absent from the module: Shopify network I/O, GraphQL, canonical writes, observation writes,
F2B advisory/applicator integration, forecast, ABC, `LowStockAlert`, schema/migration changes,
worker/scheduler registration, and inventory mutation. Reconfirmed by the zero-production-importer
finding in §3 — the module cannot currently cause any runtime effect at all.

---

## 18. Findings

### NEW-CLAUDE-F2C-01 — **P1** — Arbitrary selection among multiple LIVE inventory items drives destructive Shopify inventory writes

**File:** `stocky-plus/app/lib/catalog-facts/compatibility-projection/mapping.ts:29-36`, consumed at
`mapping.ts:76-78`.

**Evidence.** `selectLiveInventoryItem` sorts LIVE items by GID and returns `live[0]`. The frozen
schema permits more than one: `ShopifyInventoryItemFact.shopifyVariantGid` is `String?` with only
`@@index([shopId, shopifyVariantGid])` — **no unique constraint** — and `existenceState` participates
in no uniqueness. The `ShopifyVariantFact.inventoryItems` back-relation therefore returns an array
that can legitimately contain several LIVE rows. The selection also determines `weight` and
`weightUnit`, not just the identifier.

**Merchant impact.** `ShopifyVariantCache.inventoryItemId` is not display data — it is the write
target for real Shopify inventory mutations:

- `app/routes/app.stocktakes.tsx:141-155` → `adjustShopifyInventory(admin, cache.inventoryItemId, stocktake.locationId, delta, "cycle_count_available")`
- `app/routes/app.transfers.tsx:122-134` → `createShopifyTransfer(...)` line inputs
- `app/routes/app.buying-table.tsx:105-109`
- reverse direction: `app/jobs/workers/webhook-processor.ts:287-297`
  `resolveVariantFromInventoryItem` maps an incoming `inventory_levels/update` back to a variant via
  this same column.

If the wrong LIVE item is selected, a stocktake delta or a transfer is applied to the **wrong Shopify
inventory item**, and inbound inventory webhooks are mis-routed. That is destructive inventory
corruption in the merchant's Shopify store — the exact outcome `CLAUDE.md` ranks P0/P1.

**Reproduction.** Insert two `ShopifyInventoryItemFact` rows with the same `shopId` and
`shopifyVariantGid`, both `existenceState = LIVE`, GIDs `gid://shopify/InventoryItem/2` and
`gid://shopify/InventoryItem/1`. Project the variant. `ShopifyVariantCache.inventoryItemId` becomes
`…/1` regardless of which item is the real one.

**Expected behavior.** Ambiguous canonical identity is corruption, not a tie to break. Either fail
closed with a dedicated non-retryable code (e.g. `canonical_multiple_live_inventory_items`, eligible
for the deferred DEGRADED signal), **or** prove impossibility with a database constraint — a partial
unique index on `(shopId, shopifyVariantGid) WHERE existenceState = 'LIVE'` — and cite it. Silently
picking the lexicographically smaller GID is neither.

**Aggravating factor.** `mapping.test.ts:151-161` supplies **two** LIVE items (`…/2` and `…/1`) plus
one ABSENT and asserts `…/1` wins. The ambiguous case is not merely untested — the arbitrary tiebreak
is **enshrined as the contract**. The implementation report documents the behavior
(`PR5_F2C_COMPATIBILITY_PROJECTION_CORE_IMPLEMENTATION_REPORT.md:84`) without disclosing it as a risk
or justifying impossibility.

**Missing test.** A test asserting fail-closed behavior when two LIVE items share a variant, plus
either a schema constraint test or an explicit written proof of impossibility.

---

### NEW-CLAUDE-F2C-02 — **P2** — A single poison canonical row permanently wedges `shop_rebuild`

**File:** `project.ts:207-311` (traversal loops) and `project.ts:312-327` (catch).

**Evidence.** Several errors are raised as **non-retryable** from inside the traversal:
`legacy_weight_overflow` (`mapping.ts:44-48`), `invalid_canonical_existence` (`project.ts:418-422`),
and the four `invalid_canonical_*` coercion errors (`project.ts:427,436,452,460,478,486,511,519`).
The catch block returns a cursor pointing at the **last successfully processed** row. Retrying from
that cursor re-reads the same poison row and fails identically. `shop_rebuild` has no skip,
quarantine, or dead-letter path, and the cursor cannot be advanced past the row by any caller action
short of hand-crafting one.

**Merchant impact.** One malformed or overflowing canonical row blocks compatibility rebuild for the
**entire shop**: every variant and every inventory level ordered after it never projects. Because the
merchant-durable DEGRADED signal is deferred (§13), this is silent.

**Precedent.** The repository already treats this class as first-class — the Heavy job runs a
dedicated `NEW-PR4-C02: poison-row batch isolation` step.

**Expected behavior.** A non-retryable per-row failure should advance the cursor past the offending
identity, record the failure (identity + code) in the result, and continue the bounded page — or
explicitly document that `shop_rebuild` is halt-on-poison and require the integration to quarantine.

**Missing test.** A `shop_rebuild` page containing one non-retryable row, asserting the traversal
does not permanently stall.

---

### NEW-CLAUDE-F2C-03 — **P2** — Unknown errors are unconditionally classified retryable; cursor fields are unvalidated

**File:** `project.ts:620-634` (`toFailure`), `project.ts:404-414` (`normalizeCursor`).

**Evidence.** `toFailure` returns `retryable: true` for any error that is not a
`CompatibilityProjectionError`. `normalizeCursor` validates only `cursor.phase`; `afterGid`,
`afterItemGid`, and `afterLocationGid` are never type-checked, so a cursor such as
`{ phase: "variants", afterGid: 123 }` or `{ afterGid: {} }` passes straight into Prisma, raising a
`PrismaClientValidationError` that is then reported `code: "projection_write_failed",
retryable: true`.

**Merchant impact.** A permanently malformed cursor, a schema mismatch, or a constraint violation is
retried indefinitely by the future worker — burning capacity and masking a permanent defect behind an
apparently transient failure. The §K malformed-cursor requirement is therefore only partially met:
malformed *phase* is rejected non-retryably; malformed *fields* are not rejected at all.

**Expected behavior.** Validate cursor field types in `normalizeCursor` and raise
`invalid_rebuild_cursor` (non-retryable). Classify unknown errors conservatively — at minimum
distinguish `PrismaClientValidationError` / `PrismaClientKnownRequestError` from transient
connectivity failures.

**Missing test.** `shop_rebuild` invoked with a cursor whose `afterGid` is a non-string, asserting a
non-retryable `invalid_rebuild_cursor`.

---

### NEW-CLAUDE-F2C-04 — **P3** — `levelAfterWhere` re-projects an entire inventory item when `afterLocationGid` is absent

**File:** `project.ts:397`.

**Evidence.** `locationGid: { gt: afterLocationGid ?? "" }` matches every non-empty location, so a
cursor `{ phase: "inventory_levels", afterItemGid: "X" }` without a location re-projects all of item
X's levels. Unreachable from the module's own cursor emission (both fields are always set together),
but reachable from any caller-supplied cursor.

**Merchant impact.** Wasted work only — every write is an idempotent upsert, so there is no
corruption, and re-doing is the correct conservative direction versus skipping. Recorded because it is
part of the same unvalidated-cursor surface as F2C-03.

**Expected behavior.** Treat a partial `inventory_levels` cursor as malformed, or document the re-do
semantics explicitly.

---

### NEW-CLAUDE-F2C-05 — **P2** — An ABSENT canonical product silently degrades merchant-visible legacy title and image

**File:** `mapping.ts:66-79`; write path `legacy-writer.ts:44-53`.

**Evidence.** When `variant.product.existenceState === "ABSENT"` (or the relation is null), `product`
is coerced to `null`, so `title` loses its `"Product — "` prefix and `imageUrl` becomes `null`. The
upsert's `update` branch writes **both fields unconditionally**, so a pre-existing, correct legacy row
is overwritten with the degraded values.

**Merchant impact.** `cache.title` is surfaced in Buying Table rows and in operator-facing failure
messages (`app.stocktakes.tsx:143`, `app.transfers.tsx:124`); `imageUrl` is surfaced in Buying Table.
A merchant sees product names and images disappear. This is the same *unknown/incomplete canonical
evidence* class that §12 of the implementation report correctly fails closed on for inventory — but
the variant-cache lane silently degrades instead, with no DEGRADED signal because the health contract
is deferred.

**Reproduction.** LIVE variant whose `ShopifyProductFact` is `ABSENT`; project it over an existing
correct cache row. Title and image are downgraded in place.

**Expected behavior.** This is a deliberate contract — `mapping.test.ts:121` asserts it — and there is
a defensible argument for not presenting a tombstoned product's title as live. The defect is that the
degradation is **silent and destructive to an existing good row**. Either preserve the last known-good
title/image when product evidence is not LIVE, or make this case a named, mandatory trigger for the
deferred `compatibilityProjectionState = DEGRADED`, recorded now as an integration obligation rather
than discovered later.

**Missing test.** A test asserting what happens to an **existing populated** cache row when the
product becomes ABSENT (current tests only check the freshly-mapped fields).

---

### NEW-CLAUDE-F2C-06 — **P2** — The "UNKNOWN is never zero" invariant is not end-to-end; the live webhook still fabricates zero

**File (pre-existing, not introduced by this diff):** `app/jobs/workers/webhook-processor.ts:257,260`.

**Evidence.** The live inventory webhook writes `quantityAvailable: inv.available ?? 0` into the
**same row** — `(shop, shopifyVariantId, locationId, today)` — that the projection deliberately
refuses to fabricate. A projection that correctly fails closed on unknown canonical availability can
be overwritten moments later with a webhook-fabricated zero on the identical unique key.

**Merchant impact.** `forecasting.server.ts:64-76` `getOutOfStockDays` counts snapshots with
`quantityAvailable <= 0`; fabricated zeros inflate out-of-stock days, which inflates demand and
reorder recommendations. The invariant asserted in §12 of the implementation report holds **only for
this lane**.

**Expected behavior.** The lane-level guarantee is correct and should be kept. What must not happen is
describing it as a merchant-level guarantee. Register a new risk for the legacy webhook's
null→zero coercion and close it before PR5 claims end-to-end null-vs-zero integrity.

**Missing test.** None owed by this PR. Owed by the risk register.

---

### NEW-CLAUDE-F2C-07 — **P2** — Fail-closed inventory yields a stale row the forecast consumer treats as *current*, with no health signal

**File:** interaction between `mapping.ts:122-159` and `app/services/forecasting.server.ts:202-216`.

**Evidence.** On a retryable failure the stale legacy snapshot is preserved — correct and intended.
But the consumer resolves on-hand as `findFirst({ orderBy: { snapshotDate: "desc" } })` with **no
freshness bound**, then passes it to `calculateToBuy(..., onHand?.quantityAvailable ?? 0, ...)`.
Yesterday's — or an arbitrarily old — quantity silently drives purchase-order quantities.

**Merchant impact.** Purchase orders raised against stale stock levels, with nothing telling the
merchant the number is stale. Preserving stale data is strictly better than fabricating zero, so the
design choice is right; the exposure is that its safety **depends entirely on the deferred
merchant-durable DEGRADED contract**.

**Expected behavior.** Treat this as a hard gate: F2C must not be wired into any merchant-visible path
before brief §D3.2/§D3.4 (`compatibilityProjectionState`) exists. **R-145 (P1) must remain OPEN and
is load-bearing, not bookkeeping.**

**Missing test.** Once health lands: a test that a preserved-stale snapshot is accompanied by
merchant-durable DEGRADED.

---

### NEW-CLAUDE-F2C-08 — **P2** — Unbounded historical scan and serial write loop inside the tombstone transaction

**File:** `legacy-writer.ts:58-77`.

**Evidence.** `tx.inventorySnapshot.findMany({ where: { shopifyVariantId }, select: { locationId } })`
scans **every historical snapshot row** for the variant — all dates, all locations — with no `distinct`,
no date bound, and no limit, then issues one sequential `upsert` per distinct location, all inside an
open transaction.

**Merchant impact.** On a shop with daily snapshots accumulated over years across many locations, a
single variant tombstone reads a large row set and holds a transaction open across a serial write
loop. Under a bulk tombstone batch this compounds into lock pressure and transaction-timeout risk.

**Expected behavior.** Push distinctness into the query (`distinct: ["locationId"]`), bound the scan
(the set of locations is small and knowable from `ShopifyLocationFact`), and cap the per-tombstone
write count. The correctness intent — zero today at every location the variant was ever stocked at —
is preserved either way.

**Missing test.** A tombstone against a variant with many historical snapshot rows, asserting a
bounded read and write count.

---

### NEW-CLAUDE-F2C-09 — **P3** — `mapLegacyWeight` depends on decimal.js global rounding state

**File:** `mapping.ts:42`.

**Evidence.** `toDecimalPlaces(4)` is called with no explicit rounding mode, so it inherits the
process-global `Decimal.rounding`. Parity with PostgreSQL `numeric(10,4)` (round-half-away-from-zero)
holds only while that global remains at its default.

**Merchant impact.** Any library or future Prisma version that calls `Decimal.set({ rounding })`
silently changes projected weights. Low likelihood, trivially preventable.

**Expected behavior.** Pass the rounding mode explicitly: `toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)`.

**Missing test.** A test that pins the rounding mode independently of global state.

---

### NEW-CLAUDE-F2C-10 — **P3** — Required weight precision and boundary cases are untested

**File:** `mapping.test.ts` (weight coverage at lines 35, 110-111, 309-334).

**Evidence.** Existing coverage is `1.250000 → 1.25` — trailing-zero normalization, **not** rounding —
plus overflow at exactly `1000000.0000`. The cases the review contract requires are absent: values
with more than 4 significant decimals (e.g. `1.00005`, `1.00004`), the `999999.99995` boundary that
quantizes *up* into overflow, negative values (canonical is `Decimal(20,6)` and nullable, and negative
is representable), and `null`.

**Merchant impact.** The precision contract that §6 of this review certifies as compatible is asserted
by reasoning about Postgres semantics, not by executable evidence.

**Expected behavior.** Add the five cases. They are cheap and they pin F2C-09 at the same time.

---

### NEW-CLAUDE-F2C-11 — **P3** — `coerceItem` does not validate `weightValue`

**File:** `project.ts:471`.

**Evidence.** `weightValue: (row.weightValue as CanonicalInventoryItemRead["weightValue"]) ?? null` —
a bare cast, unlike every neighbouring field, all of which are `typeof`-checked. A non-Decimal value
flows into `new Prisma.Decimal(...)`. decimal.js accepts `"NaN"`; `quantized.abs().gte("1000000")` is
`false` for NaN, so the overflow guard does not catch it and NaN reaches the `DECIMAL(10,4)` column,
failing at write time as an untyped, retryable-classified error (F2C-03).

**Expected behavior.** Validate consistently with the surrounding coercions and raise
`invalid_canonical_inventory_item` for a non-Decimal weight.

**Missing test.** `coerceItem` with a malformed `weightValue`.

---

### NEW-CLAUDE-F2C-12 — **P3** — `processingEnabled` is caller-supplied where codebase precedent reads it authoritatively

**File:** `types.ts:60-65`, `project.ts:48`.

**Evidence.** The established pattern in this repository is
`assertShopProcessingEnabled` (`webhook-processor.ts:305-317`), which reads
`Shop.processingEnabled` from the control plane and fails closed. F2C instead trusts a boolean passed
by its caller and does not read `Shop`.

**Merchant impact.** A caller holding a stale `true` after uninstall or shop-disable would drive
merchant-database writes post-uninstall. Brief **§D3.5** ("Uninstall/disabled-shop: projection retry
fail-closed") is therefore **not satisfied by this lane**.

**Expected behavior.** The limitation is disclosed and the deny-before-TenantDb ordering is correct,
so this is acceptable *for an isolated core*. It must be recorded as a **blocking obligation on the
F2B/worker integration** — the integration must read the live control-plane flag, not forward a cached
one — rather than as a soft note.

**Missing test.** At integration: projection invoked for an uninstalled shop, asserting fail-closed
against the live control-plane flag.

---

### NEW-CLAUDE-F2C-13 — **P3** — `snapshotDate` local-midnight into `@db.Date` is bug-compatible but untestable in CI

**File:** `snapshot-date.ts:10-14`.

**Evidence.** `setHours(0,0,0,0)` exactly reproduces the live consumer contract —
`webhook-processor.ts:244` uses `startOfDay(new Date())`, and `forecasting.server.ts` /
`app.stocktakes.tsx` key on the same value. **Parity verified; this is the correct choice for a
compatibility lane.** However, both paths write a *local-midnight* `Date` into a `@db.Date` column: on
a server east of UTC, local midnight serializes to the previous calendar day. CI runs UTC, so no test
in this repository can detect it.

**Merchant impact.** Pre-existing, shared with the live webhook, and **not introduced by this diff**.
Snapshot rows could land on the wrong calendar day for a non-UTC deployment, shifting out-of-stock-day
counts by one.

**Expected behavior.** Record it. Do not "fix" it in this lane — diverging from the legacy consumer
would break the compatibility contract this module exists to honor. Resolve it when legacy consumers
are retired, ideally alongside the merchant-timezone decision.

**Missing test.** A `TZ=Pacific/Auckland` execution of the snapshot-date contract, once the timezone
authority is decided.

---

## 19. Findings summary

| ID | Severity | Title |
|---|---|---|
| NEW-CLAUDE-F2C-01 | **P1** | Arbitrary selection among multiple LIVE inventory items drives destructive Shopify inventory writes |
| NEW-CLAUDE-F2C-02 | P2 | A single poison canonical row permanently wedges `shop_rebuild` |
| NEW-CLAUDE-F2C-03 | P2 | Unknown errors unconditionally retryable; cursor fields unvalidated |
| NEW-CLAUDE-F2C-05 | P2 | ABSENT canonical product silently degrades merchant-visible title and image |
| NEW-CLAUDE-F2C-06 | P2 | "UNKNOWN is never zero" is not end-to-end; live webhook still fabricates zero |
| NEW-CLAUDE-F2C-07 | P2 | Fail-closed inventory yields stale on-hand treated as current, with no health signal |
| NEW-CLAUDE-F2C-08 | P2 | Unbounded historical scan and serial write loop inside the tombstone transaction |
| NEW-CLAUDE-F2C-04 | P3 | `levelAfterWhere` re-projects an entire item when `afterLocationGid` is absent |
| NEW-CLAUDE-F2C-09 | P3 | `mapLegacyWeight` depends on decimal.js global rounding state |
| NEW-CLAUDE-F2C-10 | P3 | Required weight precision and boundary cases untested |
| NEW-CLAUDE-F2C-11 | P3 | `coerceItem` does not validate `weightValue` |
| NEW-CLAUDE-F2C-12 | P3 | `processingEnabled` caller-supplied where precedent reads authoritatively |
| NEW-CLAUDE-F2C-13 | P3 | `snapshotDate` local-midnight into `@db.Date` bug-compatible but untestable in CI |

No P0 findings. No cross-tenant exposure, no broken authentication, no canonical data loss, and no
production-secret exposure was found.

---

## 20. What this review does **not** certify

Restating the deferred responsibilities so they cannot be mistaken for delivered work:

- F2B transaction integration — **not started**
- Canonical fact writes from this lane — **none, by design**
- `compatibilityProjectionState` writes — **not implemented** (brief §D3.2 / §D3.4 remain open)
- Merchant HEALTHY / DEGRADED decision — **not implemented**
- Orphan legacy-row cleanup — **not implemented** (R-142 OPEN)
- Multi-page convergence certification — **not claimed, and correctly not claimed**
- Uninstall/disabled-shop fail-closed under live control-plane authority — **not satisfied by this lane**
- PR 5 as a whole — **not complete**

R-142, R-145, and R-156 remain **OPEN**.

---

## 21. Verdict

The lane is genuinely well isolated, its deferrals are honest, and the §12 inventory-integrity
correction is real and correct — UNKNOWN canonical availability is not fabricated as zero, and the
null-vs-zero distinction is implemented with the right ordering and proven against real PostgreSQL.
The health contract is correctly deferred rather than quietly claimed. That work stands.

It is not approvable as it stands. `selectLiveInventoryItem` resolves an ambiguity the frozen schema
permits by picking the lexicographically smaller GID, and that value is the write target for real
Shopify inventory adjustments and transfers. The ambiguous case is not an untested corner — a test
asserts the arbitrary tiebreak as the intended contract, and the implementation report records the
behavior without justifying it. Under `CLAUDE.md` that is incorrect-inventory behavior: **P1**.
Ambiguous canonical identity must fail closed, or impossibility must be proven with a database
constraint.

**CORRECTIONS REQUIRED**

Required before re-review:

1. **F2C-01 (P1)** — fail closed on multiple LIVE inventory items per variant, **or** add a partial
   unique index proving impossibility. Replace the test that enshrines arbitrary selection.
2. **F2C-02 (P2)** — resolve or explicitly document the `shop_rebuild` poison-row halt.
3. **F2C-03 (P2)** — validate cursor field types; stop classifying every unknown error as retryable.
4. **F2C-05 (P2)** — stop silently overwriting good title/image from non-LIVE product evidence, or
   bind the case to the deferred DEGRADED obligation.
5. **F2C-06 / F2C-07 (P2)** — register both as risks; do not describe null-vs-zero as a merchant-level
   guarantee while the webhook path fabricates zero and no health signal exists.
6. **F2C-08 (P2)** — bound the tombstone path's historical scan and write loop.

P3 findings may be batched or accepted with a recorded rationale.
