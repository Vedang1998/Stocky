# PR5-F2C Compatibility Projection Core — Correction Independent Re-Review

**Reviewer:** Claude Code (independent principal engineer / architecture, security, and release-risk review)
**Review tier:** Tier-A adversarial, re-review of the first post-independent-review correction package
**Date:** 2026-08-19
**Authority:** `AGENTS.md`, `CLAUDE.md`, `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`,
`stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`,
`stocky-plus/docs/RISK_REGISTER.md`,
immutable first review blob `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7`

This document is immutable review output. It does not modify runtime, test, schema, migration,
package, or CI files. This review implemented no fixes.

---

## 1. Verified identity

| Field | Claimed | Independently verified |
|---|---|---|
| Authorized base | `5129707ee684e66cadcf96b976e16eb57385a7cb` | **CONFIRMED** — `git rev-parse origin/main` |
| Originally reviewed head | `4bdb1dac97323f079554590d7ac15962b8227283` | **CONFIRMED** — object exists, ancestor of correction head |
| Immutable first review commit | `2d8fd47844dec2abf5e0543260f1552272612384` | **CONFIRMED** — still an ancestor; branch was not reset |
| Immutable first review blob | `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7` | **CONFIRMED** — `git ls-tree 2d8fd47` maps this blob to `PR5_F2C_COMPATIBILITY_PROJECTION_INDEPENDENT_REVIEW.md`; blob is byte-identical at the correction head (never edited) |
| Correction head | `0f8193ef85bf7eda2b9e6d9b9da5ed7734f69a89` | **CONFIRMED** — `origin/cursor/pr5-f2c-compat-projection-core-7c2d` |
| Merge-base(correction head, base) | base | **CONFIRMED** — `git merge-base` = `5129707e…`. Linear descent, no rebase, no divergence |
| Commit count | 13 | **CONFIRMED** |
| Diff shape | 22 files, +6330 / −24 | **CONFIRMED** |

### 1.1 PR state — **DEVIATION FROM THE REVIEW CONTRACT**

The objective required PR #30 to remain **OPEN / DRAFT / UNMERGED**. Live GitHub state at review time:

```
state:      closed          <-- NOT open
draft:      true
merged:     false
closed_at:  2026-08-19T03:17:09Z
head.sha:   0f8193ef85bf7eda2b9e6d9b9da5ed7734f69a89
base.sha:   5129707ee684e66cadcf96b976e16eb57385a7cb
```

PR #30 was **closed without merging** shortly before this review began. It is **UNMERGED** and still
**DRAFT**, and its head still points at the exact correction head, so the code under review is
unambiguous and this re-review is valid on the intended tree. But the required OPEN state does not
hold.

This reviewer did **not** close it and has **not** reopened, reordered, merged, or otherwise altered
it — the objective forbids altering PR #30, and reopening is an alteration. **ChatGPT must decide
whether to reopen PR #30 before acting on this review.** No decision in this document assumes the PR
is open.

Because the PR is closed, a push to `cursor/pr5-f2c-compat-projection-core-7c2d` cannot produce
`pull_request` exact-head CI (and per `AGENTS.md` §"CI evidence policy" rule 2, feature-branch pushes
do not run the full workflow either). The artifact was therefore committed to the mandated Claude
branch, per the objective's stated fallback. See §12.

### 1.2 Existing exact-head CI — **CONFIRMED**

Run `32205711841`, `event=pull_request`, `head_sha=0f8193ef85bf7eda2b9e6d9b9da5ed7734f69a89`,
`run_attempt=1`, conclusion **success**. All three jobs verified individually:

| Job | ID | Result |
|---|---|---|
| Classify change set | `95928503218` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `95928521823` | SUCCESS — 135 numbered steps, every step SUCCESS |
| CI Gate | `95937010932` | SUCCESS |

Coverage of the new code by that run was verified, not assumed. `.github/workflows/ci.yml` names no
F2C-specific step, so I traced the blanket steps: Heavy step 125 `Tenant access tests` runs
`npm run test:tenant-access` with no filter, and `vitest.tenant-access.config.ts` includes
`app/tenant/**/*.test.ts` — which matches the new PostgreSQL suite. Heavy step 129 `Unit tests` runs
`npm test`, whose `vitest.config.ts` include `app/**/*.test.ts` matches the seven new module unit
files. The F2C suites are genuinely inside the green run.

---

## 2. Scope verdict — **PASS**

Correction-only diff (`2d8fd47..0f8193e`): 20 files, +1891 / −261. Full PR diff: 22 files.

- 8 runtime files under `app/lib/catalog-facts/compatibility-projection/` (2 new since the first
  review: `cursor.ts`, and `errors.ts` substantially rewritten)
- 7 unit test files in the same directory (3 new: `coerce.test.ts`, `cursor.test.ts`, `errors.test.ts`)
- 1 PostgreSQL test `app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`
- 1 line in `scripts/tenant-access/allowlist.ts` `TEST_FILES`
- 3 documentation files (implementation report §13, `RISK_REGISTER.md`, regenerated PR2 inventory)

**Absent, as required:** `prisma/schema.prisma`, any migration, any worker or scheduler,
`package.json`, `.github/workflows/ci.yml`, any route, any Shopify client, any forecast / ABC /
`LowStockAlert` code, any F2B integration.

Shared-file base identity proven by blob SHA, not by diff absence — every one of these is
**byte-identical between `5129707e` and `0f8193e`**:

| File | Blob at base and head |
|---|---|
| `stocky-plus/prisma/schema.prisma` | `46f208b82646327d22b705febcc686c556e8bd19` |
| `.github/workflows/ci.yml` | `16ab27b20b27a2747e84ce819b7726f78b983b0f` |
| `stocky-plus/package.json` | `a68e16ba94dcd7f4d16b6d5238c5a85f4d2ab945` |
| `stocky-plus/app/jobs/workers/webhook-processor.ts` | `5745cfe51c5ef7e49194ed3630d03f7d8dccc8f3` |
| `stocky-plus/app/services/forecasting.server.ts` | `7d8fe4b4f995f0950d8c39392273bbfc1012c984` |
| `stocky-plus/app/services/shopify-sync.server.ts` | `daf50205cbd2f42fda9817b278a4191bfbe6cd43` |
| `stocky-plus/app/tenant/tenant-db.server.ts` | `d7a7ea3c3eb996e3e5bba1417566a62d43fe5054` |

The frozen F1 schema was **not** modified, and no partial unique index was added — F2C-01 was solved
in code, not by widening the schema freeze.

`PR2_TENANT_ACCESS_INVENTORY.md` regeneration independently verified by *executing the generator's
freshness check* at the exact head rather than reading the diff:
`npm run tenant:access:inventory:check` → exit **0**,
`{"event":"tenant_access_inventory_fresh"}`. (An earlier run of the same command returned exit 1
"stale" — that was caused by my own temporary probe file sitting in the working tree, and it cleared
the moment I removed it. That accident is useful evidence: the freshness gate is real and does fail
closed on an unregistered test file.)

**EX-TEST-035 verified exactly:** the added `TEST_FILES` entry is the exact PostgreSQL test path — no
glob, no directory. Inventory row: `EX-TEST-035 | app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts | migration_tests | productionRuntime: no | phase-1-pr2-tenant-access`. **No production
allowlist (`RUNTIME_FILES` / `ENFORCEMENT_FILES`) was widened.**

---

## 3. PostgreSQL falsification evidence

The correction package's own suites were re-executed, and then **eight independent adversarial probes
written by this reviewer** were executed against the same real PostgreSQL. The probe file was created
outside the repository history, run, and removed; it is not part of any commit.

Environment: PostgreSQL 16.13, Node v22.22.2, npm 11.5.2 (CI-pinned), Prisma client `^6.16.3`,
CI-equivalent env block from `.github/workflows/ci.yml` (`stocky` / `stocky_runtime` /
`stocky_control_plane` roles provisioned, `prisma migrate deploy`, `tenant:indexes:apply --apply`,
`tenant:roles:provision --apply`, `sync:roles:provision --apply`). Commit under test:
`0f8193ef85bf7eda2b9e6d9b9da5ed7734f69a89`.

### 3.1 Re-executed package suites

| Command | Exit | Result |
|---|---|---|
| `npx vitest run app/lib/catalog-facts/compatibility-projection` | 0 | 7 files, **67 passed** |
| `npm run test:tenant-access -- app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts` | 0 | 1 file, **28 passed** |
| `npm test` | 0 | 16 files, **138 passed** |
| `npm run typecheck` | 0 | clean |
| `npm run tenant:access:inventory:check` | 0 | inventory fresh |

The implementation report's claimed counts (67 / 28 / 138) reproduce exactly.

### 3.2 Independent probes (written by this reviewer, not by the lane)

| Probe | Question | Result |
|---|---|---|
| PROBE-1 | Does a tombstone that fails on a **later** write chunk stay recoverable, idempotent, and honestly FAILED? | **PASS with a caveat** — see §7.2 and F2CC-02 |
| PROBE-2 | Is the new tombstone distinct-location `groupBy` tenant-scoped, or does it leak another shop's locations? | **PASS** — scoped |
| PROBE-3 | Does a LIVE variant with a non-LIVE product halt `shop_rebuild` for the whole shop? | **CONFIRMED — new P2**, see F2CC-01 |
| PROBE-4 | Does a **retryable** failure wrongly advertise a poison-halt quarantine? | **PASS** — `poisonHalt` absent |
| PROBE-5 | Do adversarial cursors (prototype pollution, boxed `String`, `toString` object, empty string, partial composite, arrays, extra keys) get rejected non-retryably? | **PASS** — 10/10 rejected as `invalid_rebuild_cursor`; no prototype pollution |
| PROBE-6 | Do unreviewed infrastructure error shapes retry? | **PASS** — `PrismaClientInitializationError`, `PrismaClientRustPanicError`, `P2002`, raw strings all non-retryable; only `P2024` / `P2034` and the four connectivity codes retry |
| PROBE-7 | Does a full `shop_rebuild` mutate canonical facts or projection-state columns? | **PASS** — raw SQL row images identical before/after |
| PROBE-8 | Does a completed rebuild delete an orphan legacy row? | **PASS** — orphan cache row and orphan snapshot survive untouched |

All eight probes executed against real PostgreSQL; 8/8 ran to completion. PROBE-3 passed *as written*
— it was written to prove the shop-wide halt, and it did.

---

## 4. Tenancy evidence

- **`groupBy` is tenant-scoped, verified at the TenantDb layer, not assumed.** The tombstone path's
  new `db.inventorySnapshot.groupBy` is the first `groupBy` this module has ever issued, so the first
  review's `findMany` / `deleteMany` scoping proof does not transfer. `tenant-db.server.ts:1609-1625`
  lists `groupBy` in `readOps`, forcing a tenant-bound transaction when not already in one;
  `tenant-db.server.ts:1629-1651` merges `tenantScopeWhere` into the caller's `where` for
  `groupBy` alongside `findMany` / `count` / `aggregate`.
- **PROBE-2 falsified the leak empirically.** Shop B was seeded with two snapshot rows carrying the
  *same* `shopifyVariantId` as Shop A's tombstoned variant, at locations Shop A has never used. The
  Shop A tombstone enumerated exactly `["gid://shopify/Location/A-only"]`, wrote zero rows into Shop
  B (`count(shopId=B, snapshotDate=TODAY) === 0`), and left Shop B's quantities at `91` / `92`.
- The lane's own PostgreSQL test independently covers cross-shop non-interference at 40 locations ×
  25 dates plus two Shop B rows, including one at a Shop A location GID.
- Nested canonical relation reads remain structurally same-tenant: every canonical relation is a
  composite FK on `[shopId, …]`, so `VARIANT_INCLUDE` / `LEVEL_INCLUDE` cannot cross shops.
- `projectOneIdentity` still passes `shopId` explicitly in both `findUnique` selectors
  (`project.ts:342`, `368`) — defense in depth on top of TenantDb.

No cross-tenant exposure found.

---

## 5. Canonical immutability evidence

- Static: no `create` / `update` / `updateMany` / `upsert` / `delete` on any `*Fact` model anywhere
  in the module. The only canonical calls are `findMany` / `findUnique`.
- `compatibilityProjectionState` appears in the module only in comments and in the inert result
  constant `CANONICAL_PROJECTION_STATE_WRITE = "omitted_by_f2c_lane"` (`constants.ts:29`). Zero writes.
- Dynamic (PROBE-7): raw `SELECT` row images of `ShopifyVariantFact` (`updatedAt`,
  `compatibilityProjectionState`, `existenceState`) and `ShopifyInventoryLevelFact` (`updatedAt`,
  `compatibilityProjectionState`, `availableQuantity`) are **identical** before and after a full
  `shop_rebuild` that did write legacy rows.
- The lane's suite additionally asserts `canonicalFingerprint` equality across every failure path.
- `canonicalHealthDecision` is a literal type pinned to `"deferred_to_integration"` and set
  unconditionally in `buildResult` (`project.ts:739`); no code path can produce any other value, and
  the suite's `assertNoMerchantHealthAuthorization` additionally string-scans the serialized result
  for `"HEALTHY"` and `recommendedCanonicalProjectionState`.
- Zero production importers remain. The module is still reachable only from its own tests.

---

## 6. F2C-01 through F2C-13 disposition

| ID | First-review severity | Disposition | Basis |
|---|---|---|---|
| F2C-01 | P1 | **RESOLVED** | §6.1 |
| F2C-02 | P2 | **RESOLVED as an explicit contract** (residual P3 F2CC-03) | §6.2 |
| F2C-03 | P2 | **RESOLVED** | §6.3 |
| F2C-04 | P3 | **RESOLVED** | §6.3 |
| F2C-05 | P2 | **RESOLVED as to the reported defect; the chosen classification creates NEW P2 F2CC-01** | §6.4 |
| F2C-06 | P2 | **RESOLVED** (R-165 recorded, accurate, webhook untouched) | §6.5 |
| F2C-07 | P2 | **RESOLVED** (R-145 extended, remains OPEN P1, no false health claim) | §6.5 |
| F2C-08 | P2 | **RESOLVED and independently falsified bounded** (residual P3 F2CC-02) | §7 |
| F2C-09 | P3 | **RESOLVED** | §6.6 |
| F2C-10 | P3 | **RESOLVED** | §6.6 |
| F2C-11 | P3 | **RESOLVED** | §6.6 |
| F2C-12 | P3 | **CORRECTLY DEFERRED** with a mandatory integration obligation stated in-type | §6.7 |
| F2C-13 | P3 | **CORRECTLY DEFERRED**, not treated as solved | §6.7 |

### 6.1 F2C-01 — multiple LIVE InventoryItems

`selectLiveInventoryItem` (`mapping.ts:38-55`) now returns `null` for 0 LIVE items, the single item
for 1, and for `> 1` throws `canonical_multiple_live_inventory_items` — non-retryable, carrying the
`ProductVariant` identity, **selecting neither GID**. No lexicographic tiebreak survives anywhere in
the module. The test that previously enshrined `live[0]` as the contract was replaced by two tests
asserting fail-closed and asserting no Shopify write target is emitted.

**Existing good cache is genuinely unchanged**, proven against PostgreSQL: with a populated cache row
(`inventoryItemId`, title, image, `sku`, `weight 1.2500`, `weightUnit GRAMS`) and a second LIVE
`ShopifyInventoryItemFact` linked to the same variant, projection returns `FAILED` /
`retryable=false` / `processedVariantCount=0`, and the cache row is byte-for-byte unchanged
**including `updatedAt`** — which is the correct falsification, because an equal-value re-upsert would
have moved `updatedAt`. The write never happens because the throw occurs during mapping, before the
writer is called.

Ordering note in the right direction: `selectLiveInventoryItem` runs before `requireLiveProduct`
(`mapping.ts:104-108`), so ambiguous inventory identity is reported in preference to product
evidence. Both fail closed, so no write occurs either way.

### 6.2 F2C-02 — halt-on-poison is now an explicit contract

`PoisonHaltDisposition` (`types.ts:36-50`) is emitted on non-retryable failures only
(`project.ts:768-774`) and carries `contract: "halt_on_poison"`,
`durableQuarantineRequired: true` (a `true` **literal type**, not a boolean — it cannot be set false),
`resumeAfterQuarantineCursor`, and `remainingIdentitiesAfterQuarantine`.

**Retry does not fake progress — falsified on PostgreSQL.** The lane's poison test seeds a variant
sorting before a healthy one, overflows its weight, and asserts: `cursor` stays
`{ phase: "variants" }` (pointing *at*, not past, the poison row); `processedVariantCount === 0`;
`resumeAfterQuarantineCursor !== cursor`; and a retry with the returned `cursor` fails identically
with zero cache rows written. My PROBE-3 independently reproduced the same no-progress retry with a
different poison class (`canonical_product_not_live`).

**Failures that cannot establish an identity** yield `resumeAfterQuarantineCursor: null` rather than
an invented one, and pre-TenantDb validation failures (bad limit, malformed cursor) carry **no**
`poisonHalt` at all (`project.ts:769` requires `extras != null`). PROBE-4 confirmed the converse
direction that matters most: a **retryable** failure (`canonical_available_quantity_missing`) emits
`poisonHalt: undefined`, so nothing invites a caller to skip a row that merely needs retrying.

**Is the core's contract sufficient without implementing the worker? — Yes, with one caveat.** For an
isolated core the obligation is correctly expressed where a consumer cannot miss it: in the *type*
(`durableQuarantineRequired: true` is unavoidable at compile time), in the doc comment on
`PoisonHaltDisposition`, and in implementation report §13.2's "Mandatory later worker/integration
gate". The core never advances past corruption on its own. The caveat is that the "not safe to use"
rule is enforced only by documentation — see **F2CC-03**.

### 6.3 F2C-03 / F2C-04 — strict cursor types, composite completeness, error classification

`normalizeRebuildCursor` (`cursor.ts:42-89`) validates the object shape, rejects unexpected keys,
requires `afterGid` to be absent or a **non-empty string**, and requires the `inventory_levels`
composite to be **both absent or both non-empty strings** — closing F2C-04's partial-cursor re-do at
the source. The `?? ""` fallback is gone; `levelAfterWhere` (`project.ts:409-437`) additionally
re-asserts the composite invariant as a second gate. Validation runs **before** `createTenantDb`
(`project.ts:73-83`), so a malformed cursor never opens a tenant connection.

PROBE-5 falsified this adversarially: all ten of
`JSON.parse('{"phase":"variants","afterGid":"x","__proto__":{...}}')`, boxed `new String("x")`, an
object with a `toString`, `""`, `{phase:"inventory_levels", afterItemGid:"i"}` (partial),
`afterLocationGid: ""`, array-valued composite fields, `phase: ["variants"]`, a bare array, and an
extra key were rejected as `invalid_rebuild_cursor` / non-retryable. `Object.prototype` was not
polluted.

`classifyProjectionFailure` (`errors.ts:61-111`) now defaults **non-retryable** and retries only an
explicitly reviewed set: `P1001`, `P1002`, `P1008`, `P1017`, `P2024`, `P2034` (`errors.ts:11-18`).
Validation errors and all other known-request codes — including `P2002` — are
`projection_permanent_request_failed`, non-retryable. Unknown errors are
`projection_unclassified_failure`, non-retryable. `CompatibilityProjectionError`'s constructor default
is `retryable: false` (`errors.ts:36`), so a future omission fails closed rather than open.

PROBE-6 confirmed by error *shape* as well as by class: `PrismaClientInitializationError` and
`PrismaClientRustPanicError` — neither named in the reviewed set — are non-retryable. That is the
correct direction for this contract.

### 6.4 F2C-05 — LIVE variant with missing / non-LIVE product

`requireLiveProduct` (`mapping.ts:76-90`) throws `canonical_product_not_live` when the product
relation is null or not LIVE. The reported defect is gone: no degraded title/image is ever written,
and PostgreSQL proof shows a populated cache row (`title`, `imageUrl`, `inventoryItemId`) unchanged
**including `updatedAt`** after the product fact is transitioned to a coherent confirmed tombstone.
Legacy cache is not read as canonical authority; nothing is synthesized.

The **classification** of that failure is a new problem — see **F2CC-01**.

### 6.5 F2C-06 / F2C-07 — risk-register disposition

**R-165 (new, P2, OPEN) accurately records the existing webhook risk.** I verified every factual
claim in the row against the source: `webhook-processor.ts:258` (`create`) and `:261` (`update`) both
write `quantityAvailable: inv.available ?? 0`; the unique key at `:246-251` is exactly
`(shop, shopifyVariantId, locationId, startOfDay(today))` — the same key F2C refuses to fabricate;
and `forecasting.server.ts:74-75` counts `quantityAvailable <= 0` for out-of-stock days. The row
correctly states the mitigation is owed by a later webhook/consumer lane and explicitly instructs
**not** to patch the webhook in this core. **The webhook itself is byte-identical to the authorized
base** (blob `5745cfe5…`, §2) — F2C changed nothing there, as required.

**R-145 (P1) remains OPEN and now explicitly covers the stale-snapshot-consumed-by-forecasting
path.** The extension names `findFirst({ orderBy: { snapshotDate: "desc" } })`, the missing freshness
bound, and `onHand?.quantityAvailable ?? 0` into `calculateToBuy` — all verified verbatim at
`forecasting.server.ts:202-214`. It states "F2C core does **not** close this risk" and adds
"DEGRADED/HEALTHY integration before merchant-visible wiring" to the required evidence. **No false
health claim was introduced**, and no duplicate risk was created.

**R-142 and R-156 are untouched and remain OPEN**, correctly. The only `RISK_REGISTER.md` change in
the whole PR is the R-145 extension plus the R-165 addition — verified by reading the file's full
diff against base.

### 6.6 F2C-09 / F2C-10 / F2C-11 — rounding and coercion

`mapLegacyWeight` (`mapping.ts:62-65`) now passes the mode explicitly:
`toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)`. Independence from global state is not merely
asserted — `mapping.test.ts:460-477` *actually mutates* `Prisma.Decimal.set({ rounding: ROUND_DOWN })`
and proves `-1.00005 → -1.0001` and `1.00005 → 1.0001` regardless, restoring the previous mode in a
`finally`. Every boundary the first review demanded is now covered: `1.00004` (down), `1.00005`
(half-up), exact four decimals, **negative**, **null**, and the `999999.99995` case that quantizes
*up* into `DECIMAL(10,4)` overflow and correctly throws. Quantize-then-check ordering is preserved.

`coerceCanonicalWeight` (`project.ts:509-529`) replaces the bare cast with `Prisma.Decimal.isDecimal`
plus `isFinite`, raising `invalid_canonical_inventory_item` (non-retryable). `coerce.test.ts` proves
a string, a number, and a non-finite Decimal are all rejected **before any legacy write** — closing
the first review's NaN-reaches-the-column path.

### 6.7 F2C-12 / F2C-13 — accepted deferrals

**F2C-12 — confirmed acceptable for an isolated core, and the later obligation is explicitly
required.** `types.ts:78-85` states, in the request type itself, that the caller-supplied flag is
acceptable "ONLY for this isolated core" and that "Later F2B/worker integration **MUST** read the LIVE
authoritative control-plane `Shop.processingEnabled` immediately before projection work. A cached
caller boolean is not sufficient for production." Implementation report §13.8 repeats it as a
mandatory integration gate. The deny-before-TenantDb ordering is intact (`project.ts:54-69` returns
before `createTenantDb` at line 83) and `!== true` still rejects truthy non-booleans. This is the
right disposition: the limitation is disclosed at the point of use, and the obligation is stated as
binding rather than advisory.

**F2C-13 — correctly not treated as solved.** `snapshot-date.ts:1-13` is now an explicit contract
comment: local-midnight into `@db.Date` is "pre-existing deferred compatibility debt shared with the
live webhook", and "F2C does not solve the timezone/calendar-day problem; diverging from the legacy
consumer would break the compatibility contract this module exists to honor." That is exactly the
recorded-not-fixed posture the first review asked for.

---

## 7. F2C-08 — independent verification that the tombstone path is bounded

Every element of the required checklist was verified independently, by execution rather than by
reading the lane's assertions.

| Requirement | Evidence | Result |
|---|---|---|
| Database-side distinct locations | `legacy-writer.ts:151-159` uses `groupBy({ by: ["locationId"] })`, not application-side dedup of rows | **PASS** |
| Keyset / exhaustive pagination | `locationId: { gt: afterLocationId }`, `orderBy: { locationId: "asc" }`; loop continues while a page is full and returns only on a short page (`legacy-writer.ts:141`) | **PASS — exhaustive** |
| Bounded page / chunk sizes | `TOMBSTONE_DISTINCT_LOCATION_PAGE_SIZE = 32`, `TOMBSTONE_WRITE_CHUNK_SIZE = 32` (`constants.ts:24,27`); each chunk runs in its own `$transaction` | **PASS** |
| No historical-row materialization | Lane test: 40 locations × 25 dates = **1000 rows**; total observed read cardinality across `groupBy` *and* `findMany` (both intercepted) is exactly **40** | **PASS** |
| No silent location cap | The loop has no iteration ceiling; a non-advancing keyset raises `tombstone_location_cursor_stuck` and an over-long page raises `tombstone_location_page_overflow` — it **fails closed rather than truncating** | **PASS** |
| All historical locations receive today's zero | 40/40 today-rows at `quantityAvailable = 0`; write chunks sum to 40 with `> 1` chunk. PROBE-1 reproduced at **70 locations across 3 pages** | **PASS** |
| Historical snapshots unchanged | `count(snapshotDate != TODAY)` still 1000; a specific yesterday row still `7` | **PASS** |
| Cross-shop rows unchanged | Shop B rows still `88` / `77`; PROBE-2 additionally proves Shop B locations are never *enumerated* | **PASS** |
| Retry idempotent | Every write is an `upsert` on the legacy composite unique key; `deleteMany` is naturally idempotent; PROBE-1 proves a full repair after a partial failure | **PASS** |

### 7.1 Correctness intent preserved

The enumeration reads `where: { shopifyVariantId }` across **all** dates, so "every location the
variant was ever stocked at" is still the set that receives today's zero. Rows written earlier in the
same tombstone are themselves enumerable on a retry, so no location can be lost between attempts.

### 7.2 Partial legacy projection when a later page/chunk fails — **PROBE-1, executed**

This was the highest-value question, because the fix traded one open transaction for many small ones.
I seeded 70 distinct locations × 3 historical dates (210 rows) plus a populated cache row, tombstoned
the variant, and injected a storage failure at the **second** write chunk.

Observed:

- **Honestly FAILED.** `status: "FAILED"`, `retryable: false`,
  `code: "projection_unclassified_failure"`, `processedVariantCount: 0`,
  `remainingIdentities` still contains the failing variant. Nothing claims success.
- **Partial, as expected.** The `ShopifyVariantCache` row was already deleted, and today's zeros
  existed for `0 < n < 70` locations.
- **Historical rows untouched.** `count(snapshotDate != TODAY)` remained exactly 210.
- **Fully recoverable and idempotent.** A plain retry with a clean writer returned `SUCCEEDED` and
  produced exactly **70** today-rows, all `0`, with the 210 historical rows still intact. No
  duplicates, no missed location.

So the answer to the review question is: **yes — recoverable, idempotent, and honestly FAILED.** The
residual is not correctness but atomicity, and it is recorded as **F2CC-02**.

---

## 8. Regression review

Each item re-falsified at the correction head; none regressed.

| Invariant | Result | Evidence |
|---|---|---|
| UNKNOWN available ≠ zero | **HOLDS** | `resolveSnapshotQuantity` (`mapping.ts:166-203`) throws `canonical_available_quantity_missing`; PG test preserves the stale snapshot and repairs on retry; PROBE-4 |
| Explicit ABSENT may zero | **HOLDS** | `hasExplicitNonLiveEvidence` (`mapping.ts:147-156`) gates zero on explicit `"ABSENT"` only; four PG tests (level / item / location / variant ABSENT) |
| True zero stays zero | **HOLDS** | PG test "projects canonical availableQuantity 0 as true zero" |
| Negative quantity preserved | **HOLDS** | PG test "copies negative canonical availableQuantity exactly and does not clamp to zero" |
| Missing variant link fails closed | **HOLDS** | `requireKnownVariantGid` (`mapping.ts:205-218`), retryable, checked **before** quantity resolution so an ABSENT level with no link cannot zero an unknown row |
| No SKU / barcode / title / cache inference | **HOLDS** | Only `inventoryItem.shopifyVariantGid` is read; grep finds no fallback; `safety.test.ts` enforces it; explicit PG and unit tests |
| `canonicalFactsUnchanged` | **HOLDS** | Literal `true`; PROBE-7 raw-SQL row images identical |
| `compatibilityProjectionState` untouched | **HOLDS** | Zero writes; PROBE-7; dedicated PG test |
| `canonicalHealthDecision` only `deferred_to_integration` | **HOLDS** | Pinned literal type, set unconditionally at `project.ts:739` |
| No HEALTHY recommendation | **HOLDS** | No `recommendedCanonicalProjectionState` symbol in the repository; serialized result string-scanned in every PG assertion helper |
| Orphan legacy rows not deleted from traversal absence | **HOLDS** | PROBE-8: orphan cache row and orphan snapshot (`42`) survive a completed rebuild (`hasMore=false`, `cursor=null`); the only `deleteMany` is driven by an explicit canonical ABSENT variant |
| No canonical writes | **HOLDS** | §5 |
| No F2B integration | **HOLDS** | Zero production importers; no advisory-lock or applicator helper |
| No Shopify network or mutation | **HOLDS** | `safety.test.ts` scans the module for Shopify / GraphQL / `fetch` / admin-client imports; §2 blob identity for `shopify-sync.server.ts` |
| EX-TEST-035 remains test-only | **HOLDS** | `productionRuntime: no`, category `migration_tests`, exact file path, no production allowlist widened |
| R-142 / R-145 / R-156 / R-165 OPEN as appropriate | **HOLDS** | §6.5 and §10 |

---

## 9. Findings

### NEW-CLAUDE-F2CC-01 — **P2** — `canonical_product_not_live` is non-retryable, so a brief-authorized transient canonical state halts compatibility rebuild for the entire shop

**File:** `stocky-plus/app/lib/catalog-facts/compatibility-projection/mapping.ts:76-90`, consumed at
`mapping.ts:108`; halt behavior at `project.ts:319-331` and `project.ts:768-774`.

**Evidence.** `requireLiveProduct` raises `canonical_product_not_live` with `retryable: false` when
the product relation is null **or** its `existenceState` is not `LIVE`. Under the F2C-02 halt-on-poison
contract, a non-retryable failure stops the traversal and returns a cursor pointing *at* the offending
row, so every variant ordered after it never projects until a durable quarantine mechanism — which
this lane explicitly did not build — repairs or skips the identity.

The state it rejects is **not corruption**. The approved brief authorizes it explicitly:

- §10.3 `products delete`: "If confirmed absent: **tombstone product; then refetch-or-absence for
  variants still keyed to that product.**" The word *then* is the window: the product is ABSENT while
  its variants are still LIVE, by design.
- §5 variant fact: "composite FK | `(shopId, shopifyProductGid)` → product fact, **including
  tombstoned parents**."

A null product relation is the same class from the other direction — a variant fact applied before
its product fact during backfill or webhook interleaving.

**Reproduction (executed — PROBE-3, real PostgreSQL, commit `0f8193e`).** Seed two LIVE variants,
`…/a-badprod` (product transitioned to a coherent `ABSENT_CONFIRMED_QUERY` tombstone) and `…/z-good`
(fully healthy). Run `mode: "shop_rebuild"`, `limit: 50`:

```
status                 FAILED
retryable              false
failure.code           canonical_product_not_live
processedVariantCount  0
ShopifyVariantCache(z-good)  0 rows   <-- healthy variant never projected
```

Retrying with the returned `cursor` reproduces the identical failure with zero rows written. Only
`poisonHalt.resumeAfterQuarantineCursor` gets past it — and using that is exactly what §6.2's contract
forbids until a durable quarantine exists.

**Merchant impact.** One product deleted in Shopify, during the ordinary window before its variants
are resolved, freezes the entire shop's compatibility projection. Because merchant-durable DEGRADED is
deferred (R-145 OPEN), the freeze is silent. Legacy consumers — Buying Table, stocktakes, transfers,
`forecasting.server.ts` on-hand — keep reading whatever `ShopifyVariantCache` / `InventorySnapshot`
held before the freeze. Under `CLAUDE.md` this is a significant reliability and core-workflow defect:
**P2**.

**Why this is a new finding and not F2C-05 restated.** F2C-05 was "silent degradation of a good row",
and that defect is genuinely fixed. The correction's *direction* (fail closed, preserve the good row)
is right and should be kept. The defect is the **severity classification**: a self-healing, brief-
authorized intermediate was labelled permanent poison. Neither the implementation report §13.4 nor the
PR body discloses the shop-wide-halt consequence.

**Expected behavior.** Keep the fail-closed write refusal. Classify by evidence instead of collapsing
both cases into non-retryable:

- product relation absent, or ABSENT without a confirmed-terminal tombstone → **retryable**
  (`canonical_product_not_live_yet` or equivalent). The existing good cache row is still preserved,
  the row is still not degraded, and the rest of the shop still projects.
- LIVE variant under a **confirmed terminal** product tombstone that has outlived the variant-
  resolution step → genuine canonical incoherence; non-retryable is defensible there, and it is the
  case that deserves the deferred DEGRADED signal.

**Missing test.** A `shop_rebuild` page containing one LIVE variant with a non-LIVE product plus at
least one healthy variant ordered after it, asserting the healthy variant still projects and the
traversal is not permanently stalled.

---

### NEW-CLAUDE-F2CC-02 — **P3** — The bounded tombstone rewrite gave up intra-identity atomicity; a quarantined partial tombstone stays half-applied

**File:** `stocky-plus/app/lib/catalog-facts/compatibility-projection/legacy-writer.ts:68-77`
and `:110-130`.

**Evidence.** Before the correction, the cache `deleteMany` and every today-zero upsert for one
tombstone ran inside a single transaction. Now the `deleteMany` runs on its own (line 68) and the zeros
run in independent per-chunk transactions (line 120). A failure after the delete and partway through
the chunks leaves the cache row gone and today's zeros written for only some locations, with the
remaining locations' most recent snapshot still showing yesterday's non-zero stock.

**Reproduction (executed — PROBE-1).** 70 locations, failure injected at chunk 2: cache row deleted,
today-zeros present for a strict subset, historical rows intact, result honestly `FAILED` /
`retryable: false`. A plain retry restored all 70 zeros with no duplicates.

**Merchant impact — bounded, and this is why it is P3 not P2.** The projection is rebuildable, the
failure is honest, canonical facts are untouched, historical rows are untouched, and retry is a
complete repair. The module has zero production importers, so no merchant is exposed today. The
exposure is conditional: the failure classifies **non-retryable** unless it is one of the six reviewed
Prisma transients, so an integration that follows the halt-on-poison contract literally — quarantine
the identity, resume after it — would leave the half-applied tombstone permanently half-applied, and
`forecasting.server.ts` would keep reading a stale non-zero on-hand for the un-zeroed locations of a
deleted variant.

**Expected behavior.** Record it as a binding integration obligation rather than a code change here:
quarantining a **tombstone** identity must re-drive its zero set to completion (or mark it
merchant-visibly DEGRADED under R-145) before the identity is considered handled. Alternatively, order
the cache `deleteMany` **after** the zeros so a partial failure leaves the more conservative state
(cache still present, zeros incomplete) instead of the less conservative one. Do not restore the
single unbounded transaction — F2C-08 was a real finding and the bounded design is the right one.

**Missing test.** A tombstone whose write fails partway through the chunk loop, asserting the result
is FAILED, the partial state is bounded, and a retry converges to every location zeroed.

---

### NEW-CLAUDE-F2CC-03 — **P3** — `resumeAfterQuarantineCursor` is structurally an ordinary cursor and is accepted verbatim by `shop_rebuild`

**File:** `types.ts:45-50`, `project.ts:689-703`.

**Evidence.** `resumeAfterQuarantineCursor` is typed `ShopRebuildCursor | null` — the same type
`CompatibilityProjectionRequest.cursor` accepts. Nothing marks it, brands it, or requires proof of
quarantine. PROBE-3 fed it straight back into `projectCompatibilityFromCanonicalFacts` and the
traversal skipped the poison row and completed successfully. The "not safe until a later worker
durably records the poison identity" rule exists only in a doc comment and in implementation report
§13.2.

**Merchant impact.** None today (no production importers). The risk is that the F2B/worker integration
treats it as an ordinary resume cursor and silently skips corrupt identities with no durable record —
precisely the outcome F2C-02's contract exists to prevent.

**Expected behavior.** Brand the field so it cannot be passed as a request cursor without an explicit,
auditable unwrap (e.g. a nominal wrapper type, or a required `quarantineReceiptId` alongside it), so
the obligation is enforced by the compiler rather than by prose. Reasonable to defer to the worker
lane, but it should be an acceptance criterion there rather than a note.

**Missing test.** At integration: resuming after a poison halt without a durable quarantine record is
rejected.

---

### NEW-CLAUDE-F2CC-04 — **P3** — `coerceVariant` silently coerces a non-array `inventoryItems` to `[]`

**File:** `project.ts:591`.

**Evidence.** `const items = Array.isArray(row.inventoryItems) ? row.inventoryItems : [];` — every
neighbouring field raises `invalid_canonical_variant` on a type mismatch; this one degrades silently.
A malformed include would produce zero LIVE items and therefore `inventoryItemId: null`, which the
writer then persists over a previously correct value.

**Merchant impact.** None reachable today — Prisma always returns an array for a to-many include, so
this is defense-in-depth consistency only. Recorded because `inventoryItemId` is a Shopify inventory
write target and F2C-01 established that this field must never be produced from uncertain evidence.

**Expected behavior.** Raise `invalid_canonical_variant` for a non-array `inventoryItems`, matching
the surrounding coercions.

**Missing test.** `coerceVariant` with a non-array `inventoryItems`.

---

### NEW-CLAUDE-F2CC-05 — **P3** — `DENIED_PROCESSING_DISABLED` echoes the caller's unvalidated cursor

**File:** `project.ts:54-69` (gate) versus `project.ts:73-80` (validation).

**Evidence.** The processing gate returns before `normalizeRebuildCursor` runs, and its result carries
`cursor: request.cursor ?? null` — the caller's raw, unvalidated value. A malformed cursor submitted
while processing is disabled is returned unchanged rather than rejected as `invalid_rebuild_cursor`.

**Merchant impact.** None: no TenantDb connection is opened and no write occurs, which is the property
that matters and which is correctly preserved. Recorded only because it is the last remaining path on
which an unvalidated cursor value crosses the module boundary, and a caller that stores the returned
cursor would persist a malformed one.

**Expected behavior.** Return `cursor: null` on denial, or validate before the gate. Deny-before-
TenantDb ordering must not change.

---

## 10. R-142 / R-145 / R-156 / R-165 posture

| Risk | Severity | Required posture | Verified posture |
|---|---|---|---|
| R-142 | P2 | OPEN | **OPEN**, text unchanged by this PR. Correct: PROBE-8 confirms the lane still cannot distinguish "absent from traversal" from "inserted or moved during traversal", so orphan cleanup remains unauthorized |
| R-145 | P1 | OPEN, explicitly covering stale snapshot consumed by forecasting | **OPEN and extended.** Now names the `findFirst orderBy snapshotDate desc` path, the absent freshness bound, and `?? 0` into `calculateToBuy`; states "F2C core does **not** close this risk"; adds DEGRADED/HEALTHY integration before merchant-visible wiring. **No false health claim** |
| R-156 | P2 | OPEN | **OPEN**, text unchanged. Correct: no diagnostic/outbox work was attempted |
| R-165 | P2 | OPEN, accurately recording the webhook `available ?? 0` risk | **OPEN and accurate.** Every cited line verified: `webhook-processor.ts:258,261`, unique key at `:246-251`, `getOutOfStockDays` at `forecasting.server.ts:74-75`. Instructs not to patch the webhook in this lane. Webhook blob byte-identical to base |

**F2CC-01 and F2CC-02 both land inside R-145's blast radius** (silent stale legacy projection with no
merchant health signal) and should be linked there when they are dispositioned, rather than opening a
new duplicate risk.

---

## 11. Findings summary

| ID | Severity | Title |
|---|---|---|
| NEW-CLAUDE-F2CC-01 | **P2** | `canonical_product_not_live` non-retryable halts compatibility rebuild for the entire shop on a brief-authorized transient state |
| NEW-CLAUDE-F2CC-02 | P3 | Bounded tombstone rewrite gave up intra-identity atomicity; a quarantined partial tombstone stays half-applied |
| NEW-CLAUDE-F2CC-03 | P3 | `resumeAfterQuarantineCursor` is an ordinary cursor accepted verbatim by `shop_rebuild`; the quarantine rule is prose-only |
| NEW-CLAUDE-F2CC-04 | P3 | `coerceVariant` silently coerces a non-array `inventoryItems` to `[]` |
| NEW-CLAUDE-F2CC-05 | P3 | `DENIED_PROCESSING_DISABLED` echoes the caller's unvalidated cursor |

**No new P0. No new P1.** No cross-tenant exposure, no canonical corruption or loss, no broken
authentication, no production-secret exposure, and no regression of any invariant certified by the
first review.

Separately from the code: **PR #30 is CLOSED**, not OPEN as the review contract requires (§1.1). That
is a process deviation for ChatGPT to resolve, not a code finding.

---

## 12. Artifact and branch disposition

- Artifact path: `stocky-plus/docs/phases/phase-1/PR5_F2C_COMPATIBILITY_PROJECTION_CORRECTION_INDEPENDENT_REVIEW.md`
- Exactly one file committed. No runtime, test, schema, migration, package, CI, or risk-register file
  was modified by this review.
- The temporary probe file used for §3.2 was created outside the repository history, executed, and
  removed. It is in no commit.
- Committed to the mandated Claude branch `claude/pr5-f2c-compat-projection-review-yyn28e`, **not** to
  `cursor/pr5-f2c-compat-projection-core-7c2d`, because PR #30 is closed: a push there could not
  produce `pull_request` exact-head CI, and altering the closed PR's branch is outside this review's
  authority.
- PR #30 was not closed, reopened, merged, marked ready, commented on, or otherwise altered by this
  review. F2B integration was not started.

---

## 13. What this review does **not** certify

- F2B transaction integration — **not started**
- Canonical fact writes from this lane — **none, by design**
- `compatibilityProjectionState` writes — **not implemented** (brief §D3.2 / §D3.4 remain open)
- Merchant HEALTHY / DEGRADED decision — **not implemented**
- Durable poison quarantine or repair — **not implemented**; `resumeAfterQuarantineCursor` is inert
  until it exists
- Orphan legacy-row cleanup — **not implemented** (R-142 OPEN)
- Multi-page convergence certification — **not claimed, and correctly not claimed**
- Uninstall / disabled-shop fail-closed under live control-plane authority — **not satisfied by this
  lane** (F2C-12 deferred)
- Local-midnight `snapshotDate` under a non-UTC deployment — **not solved** (F2C-13 deferred)
- End-to-end null-vs-zero integrity — **lane-level only** while R-165 is OPEN
- PR 5 as a whole — **not complete**

---

## 14. Verdict

The correction package is substantially real work, and most of it is better than the minimum the first
review demanded. F2C-01 is fixed the right way — in code, without touching the frozen schema, with the
test that enshrined the arbitrary tiebreak replaced, and with `updatedAt`-level PostgreSQL proof that
an existing good cache row survives the ambiguity. F2C-02 is now a mechanical contract with a
`true`-literal quarantine obligation, and retry provably does not fake progress. F2C-03/04 close the
cursor surface completely; ten adversarial cursor shapes were rejected and no unreviewed error shape
retries. F2C-08 is genuinely bounded — 1000 historical rows read as 40 — and I independently proved
both its tenant scoping and its recoverability after a mid-chunk failure. F2C-06/07 are recorded
accurately as R-165 and an extended R-145, with the webhook and forecasting engine byte-identical to
the authorized base and no false health claim anywhere. R-142 and R-156 remain correctly OPEN.

It is not approvable as it stands. The F2C-05 correction fixed the silent degradation but classified
`canonical_product_not_live` as non-retryable, and the approved brief §10.3 explicitly creates the
state it rejects: "tombstone product; **then** refetch-or-absence for variants still keyed to that
product." I reproduced the consequence against real PostgreSQL — one product deleted in Shopify during
that ordinary window halts the entire shop's compatibility rebuild, a healthy later variant never
projects, and retry never advances, while merchant-durable DEGRADED is still deferred. That is a
self-healing condition converted into permanent silent poison, and the implementation report does not
disclose it. Under `CLAUDE.md` that is a significant reliability and core-workflow defect: **P2**.

The fix is small and should not disturb anything else in this package: keep the fail-closed write
refusal, and classify absent / not-yet-resolved product evidence as retryable, reserving non-retryable
for a LIVE variant under a confirmed terminal product tombstone.

**CORRECTIONS REQUIRED**

Required before re-review:

1. **F2CC-01 (P2)** — stop classifying a brief-authorized transient product state as non-retryable
   shop-wide poison. Preserve fail-closed; split the classification by evidence. Add the mixed-page
   test.
2. **F2CC-02 (P3)** — record the tombstone atomicity trade explicitly in the implementation report and
   bind it as an integration obligation (a quarantined tombstone must be driven to completion or
   surfaced under R-145), or reorder the cache delete after the zero set. Do not restore the unbounded
   transaction.
3. **F2CC-03 / F2CC-04 / F2CC-05 (P3)** — may be batched, deferred to the worker lane, or accepted
   with a recorded rationale.

Separately, **ChatGPT must decide whether to reopen PR #30**, which is currently CLOSED / DRAFT /
UNMERGED against the review contract's OPEN requirement.
