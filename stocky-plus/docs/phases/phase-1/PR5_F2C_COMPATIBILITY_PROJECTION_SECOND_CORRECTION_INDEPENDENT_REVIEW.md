# PR5-F2C Compatibility Projection Core — Second Correction Independent Re-Review

**Reviewer:** Claude Code (independent principal engineer / architecture, security, and release-risk review)
**Review tier:** Tier-A adversarial, final re-review of the second post-independent-review correction package
**Date:** 2026-08-19
**Authority:** `AGENTS.md`, `CLAUDE.md`, `stocky-plus/docs/ACCELERATED_SAFE_DELIVERY.md`,
`stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`,
`stocky-plus/docs/RISK_REGISTER.md`, `stocky-plus/docs/PROJECT_STATUS.md`,
immutable first review blob `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7`,
immutable correction re-review blob `816dc7fb46cc84c394d8914ac0198c9f110a1825`

This document is immutable review output. It modifies no runtime, test, schema, migration, package,
or CI file. This review implemented no fixes. Temporary probes were removed before this artifact was
committed.

---

## 1. Verified identity

| Field | Claimed | Independently verified |
|---|---|---|
| Authorized base / `origin/main` | `5129707ee684e66cadcf96b976e16eb57385a7cb` | **CONFIRMED** — `git rev-parse origin/main` after `git fetch origin main` |
| Reviewed head | `2d2e8801dd383a778c1237cec4ed068922859cf0` | **CONFIRMED** — `refs/pull/30/head` and PR API `head.sha` both resolve to it |
| Merge-base(head, base) | base | **CONFIRMED** — `git merge-base origin/main origin/pr30` = `5129707e…`. Linear descent; no rebase, no divergence, no force-push |
| Commit count | 16 | **CONFIRMED** |
| Diff shape | 23 files, +7390 / −24 | **CONFIRMED** |
| Prior correction head | `0f8193ef85bf7eda2b9e6d9b9da5ed7734f69a89` | **CONFIRMED** — ancestor of the reviewed head |
| Runtime/test correction commit | `b9dc8211ca6628a081b76db40067cdd2b0d27741` | **CONFIRMED** — carries the entire F2CC-01 + malformed-`inventoryItems` runtime delta |
| Documentation head | `2d2e8801…` | **CONFIRMED** — docs + regenerated inventory only |

### 1.1 PR state — **CONFORMS TO THE REVIEW CONTRACT**

Live GitHub state at review time:

```
state:            open          <-- required OPEN, holds
draft:            true          <-- required DRAFT, holds
merged:           false         <-- required UNMERGED, holds
mergeable_state:  clean
head.sha:         2d2e8801dd383a778c1237cec4ed068922859cf0
base.ref/sha:     main / 5129707ee684e66cadcf96b976e16eb57385a7cb
```

The OPEN-state deviation recorded in §1.1 of the immutable correction re-review
(`816dc7fb…`) has been resolved: PR #30 was reopened by the lane owner and is now OPEN / DRAFT /
UNMERGED as the contract requires. This reviewer did not open, close, reorder, merge, or otherwise
alter PR #30 — see §13.

### 1.2 Existing exact-head CI — **CONFIRMED**

Run `32263480615`, `event=pull_request`, `head_sha=2d2e8801dd383a778c1237cec4ed068922859cf0`,
`run_attempt=1`, conclusion **success**. All three jobs verified individually:

| Job | ID | Conclusion |
|---|---|---|
| Classify change set | `96102277171` | success |
| Lint, typecheck, test, build, Prisma, GraphQL | `96102312956` | success — **135/135 steps green** |
| CI Gate | `96118765813` | success |

No step in the main job is skipped-as-green in a way that hides F2C: `Tenant access tests`,
`Tenant relation isolation tests`, `Lint`, `Typecheck`, `Unit tests`, `Build`, and
`Tenant access inventory freshness` all ran and passed on the exact head.

### 1.3 Immutable prior review artifacts — **BOTH BYTE-IDENTICAL**

| Artifact | Required blob | Verified |
|---|---|---|
| `PR5_F2C_COMPATIBILITY_PROJECTION_INDEPENDENT_REVIEW.md` | `5d2d109b9ea5edbe0516bbb7bed115b6f6c83ed7` | **CONFIRMED** at reviewed head |
| `PR5_F2C_COMPATIBILITY_PROJECTION_CORRECTION_INDEPENDENT_REVIEW.md` | `816dc7fb46cc84c394d8914ac0198c9f110a1825` | **CONFIRMED** at reviewed head |

Stronger than a point check: `git ls-tree` was walked across `2d8fd47` (first review commit),
`0f8193e` (prior correction head), `13ad54b` (correction re-review commit), `b9dc821`, and
`2d2e880`. The first-review blob is `5d2d109b…` at **every** commit from its introduction onward, and
the correction re-review blob is `816dc7fb…` at every commit from `13ad54b` onward. Neither artifact
was ever edited, rewritten, or amended.

---

## 2. Scope of the second correction

The runtime delta between the prior correction head and the reviewed head is confined to one commit
and is genuinely small — I diffed it in full:

- `mapping.ts` — `requireLiveProduct` throws `canonical_product_not_live` with `retryable: true`
  (was `false`), plus an explanatory comment citing brief §10.3.
- `project.ts` — `coerceVariant` raises `invalid_canonical_variant` (non-retryable) on a non-array
  `inventoryItems` instead of silently coercing to `[]`; `coerceCanonicalVariant` exported for tests.
- `index.ts` — exports `coerceCanonicalVariant`.
- tests — `mapping.test.ts` retryability expectations flipped; `coerce.test.ts` malformed-shape cases;
  `safety.test.ts` static guard against the old coercion; `pr5-f2c-compatibility-projection.test.ts`
  updated expectations plus one new PostgreSQL convergence test.

No other production behavior changed. Nothing was redesigned.

### 2.1 Lane isolation — **CONFIRMED**

Shared and foundation files are byte-identical to the authorized base:

| File | Result |
|---|---|
| `.github/workflows/ci.yml` | IDENTICAL to base |
| `stocky-plus/package.json` | IDENTICAL to base |
| `stocky-plus/package-lock.json` | IDENTICAL to base |
| `stocky-plus/prisma/schema.prisma` | IDENTICAL to base |
| `stocky-plus/prisma/migrations/**` | no file added, removed, or renamed |

The only non-`compatibility-projection`, non-docs change is one line in
`scripts/tenant-access/allowlist.ts` adding `app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts`
to `TEST_FILES`. That is the `EX-TEST-035` test-only classification; `ENFORCEMENT_FILES` and the
production allowlist were not broadened. No schema, no migration, no worker, no webhook, no
forecasting change.

---

## 3. Primary F2CC-01 re-review — independent reproduction

I did not rely on the lane's own test. I wrote an independent probe (own seeds, own raw-row
assertions, own convergence path), ran it against disposable PostgreSQL 16.13, then deleted it.
All sixteen mandated steps reproduced.

### 3.1 The mandated sequence, step by step

| # | Required | Independently observed |
|---|---|---|
| 1 | canonical Product ABSENT | seeded `ABSENT` / `ABSENT_CONFIRMED_QUERY` with coherent `deletedAt` + `deletionSource` |
| 2 | linked Variant still LIVE | variant fact untouched, `existenceState=LIVE` |
| 3 | a later healthy Variant exists | `…/z-healthy`, fully LIVE graph, sorts after the stuck GID |
| 4 | `shop_rebuild` reaches the stuck Variant | `mode:"shop_rebuild"`, `limit:10` |
| 5 | result FAILED | `status === "FAILED"` |
| 6 | failure code `canonical_product_not_live` | `failure.code === "canonical_product_not_live"` |
| 7 | **retryable true** | `result.retryable === true` **and** `failure.retryable === true` |
| 8 | poisonHalt absent | `poisonHalt === undefined` **and** `"poisonHalt" in result === false` |
| 9 | cursor remains before/on the failed identity | `cursor === { phase: "variants" }` — no `afterGid`, never past the failure |
| 10 | later healthy variant not falsely reported processed | `processedVariantCount === 0`, `processedInventoryLevelCount === 0`, no cache row for `z-healthy` |
| 11 | old cache remains unchanged | full legacy snapshot deep-equal before/after, **including `updatedAt`**; stale `title`/`imageUrl`/`sku` preserved verbatim; zero `InventorySnapshot` rows written |
| 12 | canonical row images remain unchanged | full raw-row dumps of all five `*Fact` tables deep-equal before/after, for **both** shops |
| 13 | converge the stuck canonical Variant | converged via **Product refetch back to LIVE** |
| 14 | retry SAME cursor | replayed the exact `failed.cursor` object |
| 15 | stuck identity now projects/tombstones correctly | **projects**: cache overwritten to `title:"Widget — Blue"`, correct `imageUrl`, `inventoryItemId`, `weightUnit` |
| 16 | later healthy Variant progresses | `z-healthy` cache row created; `processedVariantCount === 2` |

**A convergence branch the lane's own suite does not cover.** The lane's PostgreSQL test converges by
*tombstoning* the stuck variant, exercising only the tombstone branch of step 15. I deliberately
converged the other way — the Product refetched back to `LIVE`, which is the §10.3
"refetch-or-absence" *refetch* outcome — and proved the stuck identity then **projects** correctly and
overwrites the stale cache. Both convergence directions therefore hold, not just the one the lane
tested.

*(Aside, not a finding: my first attempt at that convergence was rejected by the F1
`ShopifyProductFact_existence_evidence_coherence_check` constraint because I left
`existenceRequestGen`/`existenceResponseGen` populated while setting `LIVE`. That is the F1 canonical
foundation correctly refusing an incoherent existence-evidence tuple — a positive signal about the
frozen foundation, and a defect in my probe seed, which I corrected.)*

### 3.2 Head-of-line position — the stuck variant is not always first

The mandate's sequence puts the stuck variant first. I also ran the harder ordering: healthy
`a-good` → stuck `m-stuck` → healthy `z-later`.

```
status                 FAILED
retryable              true
poisonHalt             undefined
processedVariantCount  1                                  <-- only a-good
cursor                 { phase:"variants", afterGid: <a-good> }   <-- strictly before the failure
cache(m-stuck)         null
cache(z-later)         null                               <-- not falsely reported processed
```

Replaying that same cursor a second time reproduces the identical failure on `m-stuck` with
`processedVariantCount === 0` and the same cursor — proving retry is idempotent, never claims false
progress, and never skips the unresolved identity. After converging `m-stuck` (tombstone path this
time), the same cursor `SUCCEEDED` and `z-later` projected.

### 3.3 Identities mode

```
status                 FAILED
retryable              true
poisonHalt             undefined
processedVariantCount  0
remainingIdentities    [ m-stuck, z-healthy ]   <-- stuck identity retained at the head
ShopifyVariantCache    0 rows
```

The stuck identity stays at position 0 of `remainingIdentities`, so a caller replaying the remainder
cannot silently drop it.

### 3.4 No merchant authorization emitted

Every result in every scenario above asserted, independently of the lane's helper:
`canonicalHealthDecision === "deferred_to_integration"`, `canonicalFactsUnchanged === true`,
`canonicalCompatibilityProjectionStateWrite === "omitted_by_f2c_lane"`, and the serialized result
matching neither `"HEALTHY"` nor `"DEGRADED"` nor `/recommended/i`. No HEALTHY or DEGRADED merchant
authorization is emitted by this isolated core.

### 3.5 The mechanism, read directly

`failureResult` (`project.ts:780-786`) builds `poisonHalt` only when `failure.retryable` is false.
Because `requireLiveProduct` now carries `retryable: true`, the poison-halt disposition — and with it
`resumeAfterQuarantineCursor`, the field the correction re-review established is unusable until
durable quarantine exists — is structurally unreachable for this failure class. That is the correct
mechanism, not a test-level accommodation.

The throw occurs inside `mapVariantToLegacyCache`, strictly before `writer.applyVariantPlan` is
called, which is why no legacy write can occur and `updatedAt` on the preserved cache row does not
move. An equal-value re-upsert would have moved it; it did not.

**F2CC-01 is RESOLVED as specified by the mandate.** See §5 for the residual disposition.

---

## 4. Malformed `inventoryItems` — independently verified

`coerceVariant` (`project.ts:591-597`) now raises `invalid_canonical_variant`, **non-retryable**,
carrying the `ProductVariant` identity, when `inventoryItems` is not an array. The prior
`Array.isArray(row.inventoryItems) ? row.inventoryItems : []` coercion is gone, and `safety.test.ts`
statically forbids its return.

I tested a wider set of shapes than the lane did — the mandate's six plus `true` and a `Date`
instance — each asserting that the error is thrown, is a `CompatibilityProjectionError`, has code
`invalid_canonical_variant`, has `retryable === false`, and that **no projection plan is produced**:

| Input | Result |
|---|---|
| `undefined` | throws `invalid_canonical_variant`, non-retryable, no plan |
| `null` | throws `invalid_canonical_variant`, non-retryable, no plan |
| `"str"` (string) | throws `invalid_canonical_variant`, non-retryable, no plan |
| `{ a: 1 }` (object) | throws `invalid_canonical_variant`, non-retryable, no plan |
| `5` (number) | throws `invalid_canonical_variant`, non-retryable, no plan |
| `true` (boolean) | throws `invalid_canonical_variant`, non-retryable, no plan |
| `new Date()` | throws `invalid_canonical_variant`, non-retryable, no plan |
| `[]` (**actual empty array**) | **accepted** — `inventoryItems: []`, plan `upsert` with `inventoryItemId: null`, `weight: null`, `weightUnit: null` |

Because the throw precedes `mapVariantToLegacyCache`, no `LegacyVariantCache` write can occur from a
malformed shape. The genuine empty array still means zero included InventoryItems and still produces
the zero-LIVE-item null projection — the legitimate case is not collateral damage.

Correctly scoped: a real Prisma include always returns an array, so this shape is not reachable from
PostgreSQL today. It is a fail-closed guard against a fake/hand-built canonical read, and the
implementation report says exactly that rather than overclaiming.

---

## 5. New findings

**P0 = 0. P1 = 0. P2 = 0.** Three P3 residuals, none of which blocks approval.

### NEW-CLAUDE-F2CC2-01 — **P3** — Reclassification transfers liveness to a bounded worker retry that is neither built nor tracked as a named risk-register gate

**File:** `stocky-plus/app/lib/catalog-facts/compatibility-projection/mapping.ts:76-101`;
disposition at `project.ts:780-786`; narrative at
`docs/phases/phase-1/PR5_F2C_COMPATIBILITY_PROJECTION_CORE_IMPLEMENTATION_REPORT.md` §14.1.

**Evidence.** The correction changes the *label* on the failure, not the *traversal*. I proved in
§3.2 that a stuck identity still blocks every variant ordered after it: replaying the returned cursor
while the lag persists reproduces the identical failure with `processedVariantCount === 0` forever.
`shop_rebuild` makes no progress past the unresolved identity under either classification.

This is exactly what the review mandate requires ("must not advance the rebuild cursor past the failed
variant"; "later bounded worker retry / compatibility health owns liveness"), and it is **not a
regression** — under the previous non-retryable classification the traversal was equally blocked,
because `poisonHalt.resumeAfterQuarantineCursor` is documented in-type as unusable until durable
quarantine exists. Nothing got worse; what changed is who legitimately owns the escape.

The residual is one of traceability. `resumeAfterQuarantineCursor` carries its integration obligation
**in the type itself** (`types.ts:41-48`), so a future worker cannot use it without reading the
contract. The new bounded-retry-exhaustion obligation has no equivalent anchor: it is asserted in one
sentence of implementation report §14.1 and appears in no risk-register row. R-145 gates
*merchant-visible wiring* on DEGRADED/HEALTHY integration, which is adjacent but not the same
obligation — a worker could satisfy R-145's health signalling and still retry a permanently stuck
identity without bound.

**Merchant impact: none today.** Isolated core; no worker, no wiring, no production path; feature
flags off; F2B integration not started; R-145 already forbids treating F2C success as merchant-safe.

**Recommended correction (downstream, not this PR).** Record a risk-register entry — or extend R-145
with an explicit sub-obligation — naming bounded retry exhaustion plus DEGRADED escalation for
`canonical_product_not_live` as a mandatory worker-integration gate, so the liveness owner is tracked
the way `resumeAfterQuarantineCursor` already is. **Do not** reopen PR5-F2C for it.

**Missing test (downstream).** A worker-lane test asserting that a persistently unresolved
`canonical_product_not_live` identity exhausts a bounded retry budget and escalates to DEGRADED
rather than retrying indefinitely.

---

### NEW-CLAUDE-F2CC2-02 — **P3** — The correction re-review's two-way evidence split was not implemented; terminal canonical incoherence is now also classified retryable

**File:** `stocky-plus/app/lib/catalog-facts/compatibility-projection/mapping.ts:88-101`.

**Evidence.** Immutable blob `816dc7fb…` §"Expected behavior" for F2CC-01 asked for classification
*by evidence*: product relation absent or ABSENT-without-confirmed-terminal-tombstone → retryable;
a LIVE variant under a **confirmed terminal** product tombstone that has outlived variant resolution
→ genuine incoherence, non-retryable and deserving the deferred DEGRADED signal. The delivered fix
collapses both into `retryable: true` unconditionally.

Brief §10.3 does describe a genuinely terminal class —
`TERMINAL_IDENTITY_REVIVAL_CONFLICT`, "keep tombstone until two independent confirmations +
createdAt match" — so the two states are real and distinguishable in principle. The canonical schema
even exposes the raw material (`existenceKind`, `deletedAt`, `deletionSource`,
`existenceRequestGen`/`existenceResponseGen`).

**Why I do not raise this above P3.** Distinguishing "just tombstoned" from "tombstoned and has
outlived variant resolution" requires a time-or-generation bound that does not exist anywhere in the
approved documents — there is no bounded retry budget, no resolution deadline, and no worker to
measure against. Implementing that split inside the projection core now would mean F2C inventing
existence-terminality policy that belongs to the applicator lane, which `CLAUDE.md` forbids
("do not broadly redesign product behavior without an approved decision"). Deferring is the correct
call, and the current review mandate explicitly overrides the earlier proposal: "F2C itself must not
classify it as permanent poison." The delivered behavior matches the standing authority.

**Merchant impact: none today** — same isolation as F2CC2-01.

**Recommended correction (downstream).** Make terminality-aware classification an explicit acceptance
obligation of the canonical applicator / worker lane, alongside F2CC2-01's retry bound. Record it
rather than leaving the superseded two-way split implicit in an immutable artifact.

---

### NEW-CLAUDE-F2CC2-03 — **P3, informational** — Retryable product lag masks a co-located permanent defect for one retry cycle

**File:** `stocky-plus/app/lib/catalog-facts/compatibility-projection/mapping.ts:104-131`.

**Evidence.** Within `mapVariantToLegacyCache` the order is `selectLiveInventoryItem` →
`requireLiveProduct` → field construction (which calls `mapLegacyWeight`). The first ordering is in
the safe direction and was already commended in blob `816dc7fb…`: ambiguous inventory identity
(non-retryable) correctly preempts the product lag. The second is the reverse: a variant with **both**
a stuck parent **and** a permanently overflowing weight reports `canonical_product_not_live`
(retryable) first, and only surfaces `legacy_weight_overflow` (non-retryable, poison-halting) after
the parent converges.

**Why this is not a defect.** Each classification is correct given the evidence available at that
moment, no cursor advances, no write occurs, and the permanent defect is still surfaced — one retry
cycle later. No data is wrong and nothing is lost.

**Merchant impact: none.** Recorded for completeness only; no correction required, and I do **not**
recommend reordering the checks in this package.

---

## 6. Material regression targets — all hold

Verified by reading the code, by the lane's suites (which I ran myself), and by my own probe where
marked ✎.

| Target | Result |
|---|---|
| >1 LIVE InventoryItems fails closed; no arbitrary `inventoryItemId` | **HOLDS** ✎ — `canonical_multiple_live_inventory_items`, `retryable=false`, `poisonHalt.durableQuarantineRequired=true`, `contract="halt_on_poison"`, zero cache rows written. Confirms the retryability change did **not** blanket-suppress poison halts |
| null `availableQuantity` is not zero | **HOLDS** ✎ — `canonical_available_quantity_missing`, retryable, zero snapshots written |
| true zero stays zero | **HOLDS** ✎ — canonical `0` → `quantityAvailable === 0` |
| negative available quantity preserved | **HOLDS** ✎ — canonical `-5` → `-5`, not clamped |
| missing canonical variant link retryable, never inferred | **HOLDS** — `canonical_variant_link_missing`, retryable; no SKU/barcode/title/cache inference anywhere in the module |
| product-not-LIVE preserves cache | **HOLDS** ✎ — full legacy snapshot deep-equal including `updatedAt` |
| bounded tombstone distinct-location paging bounded/recoverable/idempotent | **HOLDS** — `groupBy` keyset paging at 32/page, stuck-cursor and page-overflow guards, empty-locationId guard; lane PostgreSQL test green |
| malformed cursor fails closed | **HOLDS** — `normalizeRebuildCursor` allow-lists keys, rejects unknown phase, partial composites, empty strings, arrays, non-objects, all `invalid_rebuild_cursor` non-retryable |
| unknown errors do not default retryable | **HOLDS** — `classifyProjectionFailure` returns `projection_unclassified_failure` / `retryable:false`; only six reviewed Prisma codes retry |
| ROUND_HALF_UP weight behavior explicit | **HOLDS** — explicit `Prisma.Decimal.ROUND_HALF_UP` at 4 dp, overflow guard incl. round-up-crossing-overflow |
| `canonicalFactsUnchanged` remains true | **HOLDS** ✎ — asserted on every result |
| no `compatibilityProjectionState` writes | **HOLDS** ✎ — raw row images of all five `*Fact` tables identical before/after; the column appears only in comments and the inert `omitted_by_f2c_lane` constant |
| `canonicalHealthDecision` only `deferred_to_integration` | **HOLDS** ✎ |
| no HEALTHY recommendation | **HOLDS** ✎ — serialized results match neither `"HEALTHY"`, `"DEGRADED"`, nor `/recommended/i` |
| orphan rows not deleted from traversal absence | **HOLDS** — lane PostgreSQL test green; no `deleteMany` reachable from traversal absence |
| `processingEnabled=false` performs no merchant projection write | **HOLDS** ✎ — `DENIED_PROCESSING_DISABLED`, legacy state deep-equal, even with a stuck parent present |
| cross-shop isolation | **HOLDS** ✎ — see §7 |
| no Shopify network / mutation | **HOLDS** — `safety.test.ts` enumerates every production file and forbids Shopify/GraphQL/forecast/ABC/LowStockAlert imports and network I/O |
| no F2B integration | **HOLDS** — no F2B symbol, import, or file anywhere in the diff |

### 6.1 Accepted residuals — verified present, verified not worsened

- **Bounded tombstone mid-chunk projection is not intra-identity atomic** — unchanged in this
  package (`legacy-writer.ts:68-77`, `:110-130`); remains FAILED / recoverable / idempotent.
- **`resumeAfterQuarantineCursor` still requires future durable quarantine** — unchanged; obligation
  still stated in-type at `types.ts:41-48`. Now *less* reachable, since the most common fail-closed
  class no longer produces a poison halt at all.
- **Processing-disabled cursor echo** — unchanged (`project.ts:60` still echoes the caller's raw
  cursor without normalization). Request-hygiene debt; no merchant write occurs on that path.
- **Snapshot-date timezone debt** — unchanged (`snapshot-date.ts`), deliberately reproducing the
  legacy consumer's `setHours(0,0,0,0)` contract, with the trade documented in-file.

None worsened. None blocks approval.

---

## 7. Tenancy and canonical immutability

- **Cross-shop isolation ✎.** With Shop A holding a stuck parent-ABSENT graph, a Shop B authority
  running a full `shop_rebuild` returned `SUCCEEDED` with `processedVariantCount === 0`, wrote zero
  Shop B cache rows, and left Shop A's legacy state deep-equal. In the §3.1 sequence, Shop B's
  canonical raw-row dump and legacy state were deep-equal across the failure *and* the successful
  retry.
- **Canonical immutability ✎.** Full raw-row dumps of `ShopifyProductFact`, `ShopifyVariantFact`,
  `ShopifyInventoryItemFact`, `ShopifyLocationFact`, and `ShopifyInventoryLevelFact` — every column,
  both shops — were deep-equal before and after every failing and succeeding invocation. The module
  issues only `findMany` / `findUnique` against `*Fact` models; there is no `create` / `update` /
  `updateMany` / `upsert` / `delete` on any canonical model anywhere in it.
- `projectOneIdentity` still passes `shopId` explicitly in both `findUnique` selectors
  (`project.ts:342`, `:368`) as defense in depth on top of TenantDb.
- `relation-isolation.test.ts` — 10/10 passed on my own PostgreSQL.

No cross-tenant exposure found. No canonical mutation found.

---

## 8. Independent test evidence

Environment: disposable PostgreSQL **16.13** (fresh cluster, `stocky` / `stocky_plus_ci`, CI-equivalent
env), Node **v22.22.2**, npm **11.5.2** pinned to match the lockfile, `prisma migrate deploy` from the
reviewed head. Working tree = `2d2e8801dd383a778c1237cec4ed068922859cf0`, isolated `git worktree`,
verified clean.

| Check | Command | Result |
|---|---|---|
| Focused unit suite | `npx vitest run app/lib/catalog-facts/compatibility-projection` | **70 passed / 7 files** |
| Focused F2C PostgreSQL suite | `npx vitest run --config vitest.tenant-access.config.ts app/tenant/__tests__/pr5-f2c-compatibility-projection.test.ts` | **29 passed** |
| Relation isolation | `npx vitest run --config vitest.tenant-access.config.ts app/tenant/__tests__/relation-isolation.test.ts` | **10 passed** |
| Typecheck | `npm run typecheck` | **exit 0**, no diagnostics |
| Lint | `npm run lint` | **exit 0**, no findings |
| Default unit suite | `npm test` | **141 passed / 16 files** |
| Full tenant-access PostgreSQL suite | `npm run test:tenant-access` | **315 passed, 4 skipped**; see note |
| Inventory freshness | `npm run tenant:access:inventory:check` | **`tenant_access_inventory_fresh`**, exit 0 — corroborates the report's 1553-finding / 0-violation claim |
| **My own adversarial probe** | temporary file, since deleted | **8/8 passed** |

**Note on the one red result.** `app/tenant/__tests__/queue-redis.test.ts` initially failed with a
120s hook timeout. Root cause was environmental, not the PR: no Redis server was running in my
sandbox (CI supplies a `redis:7-alpine` service). I started Redis and re-ran that file in isolation:
**4/4 passed**. I am reporting this rather than quietly re-running it into green — the full
tenant-access suite is effectively **319/319** on the reviewed head. No test body failed at any point.

My probe covered: the full 16-step sequence with Product-refetch convergence; the stuck-variant-not-
first ordering with double replay; identities mode; the multiple-LIVE-item poison-halt regression;
eight malformed `inventoryItems` shapes plus the legitimate empty array; processing-disabled denial
under a stuck parent; cross-shop isolation under a stuck parent; and null / zero / negative
`availableQuantity`. It was deleted before this artifact was committed — `npm test` (141) and the
full tenant-access run above were executed **after** its removal, confirming a clean tree.

---

## 9. Risk posture

| Risk | Required posture | Verified at reviewed head |
|---|---|---|
| R-142 | OPEN | **OPEN** — "PR 5 planning (D-053). Cleanup after consumers read canonical facts." Unchanged by this package |
| R-145 | OPEN | **OPEN** — P1; explicitly extended with "F2C core does **not** close this risk" and "DEGRADED/HEALTHY integration before merchant-visible wiring" |
| R-156 | OPEN | **OPEN** — "PR 5 planning (D-053)." Unchanged |
| R-165 | OPEN | **OPEN** — P2; legacy webhook `available ?? 0` still fabricates zero; webhook untouched by this lane, correctly not patched here |

All four remain OPEN and accurately stated. No risk was silently closed, downgraded, or reworded to
flatter this package. F2CC2-01 and F2CC2-02 above are new P3 candidates for the register; recording
them is a downstream action, not a condition of this approval.

---

## 10. Disposition of prior findings

| Finding | Severity | Disposition at reviewed head |
|---|---|---|
| F2CC-01 | P2 | **RESOLVED** as specified by the standing mandate — retryable, cache-preserving, no `poisonHalt`, cursor never advances, same-cursor convergence proven in both directions. Residual traceability recorded as P3 F2CC2-01 / F2CC2-02 |
| Malformed `inventoryItems` | P3 | **RESOLVED** — non-retryable `invalid_canonical_variant`, no legacy write, empty array still valid |
| F2CC-02 (tombstone atomicity) | P3 | **ACCEPTED, DOCUMENTED** — report §14.3 records the trade explicitly; behavior unchanged and still bounded/recoverable/idempotent |
| F2CC-03/04/05 | P3 | **ACCEPTED / DEFERRED** with recorded rationale in report §14.3; not worsened |
| F2C-01 … F2C-13 | mixed | **NO REGRESSION** — every previously accepted material fix re-verified in §6 |

The implementation report §14 was checked against the code rather than taken at face value. Its
claims — retryable classification, no `poisonHalt`, cache preservation, cursor non-advance, malformed
shape handling, preserved contracts, unchanged shared files (with blob SHAs), R-142/145/156/165 OPEN
— are accurate. §14.1's PostgreSQL sequence understates rather than overstates: it claims the
tombstone convergence path; the refetch-to-LIVE path also holds, as I proved. I found no overclaim in
the report or the PR body.

---

## 11. Product-boundary check

- Shopify remains authoritative; this lane performs no Shopify network call and no mutation.
- App-owned legacy projections are written only from canonical facts, never inferred from SKU,
  barcode, title, or the legacy cache itself.
- Deterministic arithmetic only; no LLM involvement in inventory, cost, ABC/U, or forecast paths.
- No entitlement, billing, or AI-cost surface is touched, so the pricing/AI review obligations of
  `CLAUDE.md` are not engaged by this diff.
- The core does not claim module completeness: `status: "SUCCEEDED"` is scoped in-type to "this
  invocation's requested work completed", and PR 5 is explicitly not complete.

---

## 12. Verdict

The second correction package does precisely what the mandate asked, and no more. The runtime delta
is one commit and about twenty lines of behavior change. `canonical_product_not_live` is now
`retryable: true` with no `poisonHalt`, while remaining fail-closed, cache-preserving, non-fabricating,
canonical-read-only, and cursor-safe — and I reproduced all sixteen mandated steps independently
against real PostgreSQL, including a convergence branch the lane's own suite does not exercise. The
malformed-`inventoryItems` coercion is gone, replaced by a named non-retryable canonical input error
that produces no legacy write, while a genuine empty array remains valid. Every previously accepted
material fix still holds, including the poison-halt path for genuinely ambiguous inventory identity —
which proves the retryability change was surgical rather than a blanket suppression. Lane isolation is
intact: shared CI, package, lockfile, schema, and migration files are byte-identical to the authorized
base, and both immutable review artifacts are unedited across the entire branch history. Tenancy and
canonical immutability are proven at the raw-row level for both shops.

My three P3 residuals are traceability and sequencing observations with no merchant impact today, on
an isolated core with no worker, no wiring, and R-145 already forbidding merchant-safe use. None of
them is a condition of approval; they are inputs to the downstream worker and applicator lanes.

P0 = 0. P1 = 0. P2 = 0.

**APPROVE PR5-F2C COMPATIBILITY PROJECTION SECOND CORRECTION**

This approval is scoped to the isolated compatibility-projection core at
`2d2e8801dd383a778c1237cec4ed068922859cf0`. It is **not** approval to merge, to mark PR #30 ready, to
wire F2C into merchant-visible surfaces, to begin F2B integration, or to advance PR 5 to complete.
R-145 continues to forbid treating F2C isolated-core success as merchant-safe until DEGRADED/HEALTHY
integration exists.

---

## 13. Review-action attestation

- PR #30 was **not** altered: not merged, not closed, not reopened, not marked ready, not retitled,
  not relabelled, not commented on. It remains OPEN / DRAFT / UNMERGED at
  `2d2e8801dd383a778c1237cec4ed068922859cf0`.
- Nothing was pushed to `cursor/pr5-f2c-compat-projection-core-7c2d`.
- No production runtime, test, schema, migration, package, or CI file was modified. The only file in
  the review commit is this artifact.
- The temporary PostgreSQL probe was deleted before the commit; the full suites reported in §8 were
  re-run after its removal against a verified-clean tree.
- No post-review PR CI was triggered, as the objective's cost-control instruction requires.
- Per the objective, this artifact is committed only to the mandated Claude review branch
  `claude/pr30-f2c-compat-review-u5tsr9` for later coordinated integration by ChatGPT, when the lane
  is refreshed against then-current `main` and receives one final exact-head CI.
