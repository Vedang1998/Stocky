# PR5-F2B Canonical Fact Applicator — First Correction Package, Independent Re-Review (Claude, Tier-A)

**Reviewer:** Claude Code, acting as independent principal engineer / architecture,
security and release-risk reviewer under `AGENTS.md` and `CLAUDE.md`.

**Scope:** re-review of the **first post-independent-review correction package** for
PR5-F2B (NEW-CLAUDE-PR5F2B-01 … -11), plus cumulative high-risk regression
falsification across the whole PR #31 diff.

**Mandate constraints observed:** no fixes implemented; no runtime, test, or existing
documentation file modified; RISK_REGISTER not edited; PR #31 not merged, not marked
ready, not closed; only this artifact committed.

---

## 1. Verified repository identity

| Item | Value | How verified |
|---|---|---|
| Repository | `Vedang1998/Stocky` | `git remote -v`, GitHub API |
| Application | `stocky-plus/` | working tree |
| PR | #31 — *Phase 1 PR5-F2B — canonical fact applicator* | GitHub API `pulls/31` |
| PR state | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` | GitHub API `pulls/31` |
| Authorized base (`origin/main`) | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `git rev-parse origin/main` |
| Exact corrected live head | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` | `git rev-parse origin/cursor/pr5-f2b-canonical-applicator-055c`; GitHub `head.sha` |
| Merge base | `5129707ee684e66cadcf96b976e16eb57385a7cb` | `git merge-base origin/main origin/cursor/pr5-f2b-canonical-applicator-055c` |
| Originally reviewed implementation head | `2abda4b13577355036683b6d92be852740530311` | present as an ancestor of the live head (`git cat-file -t` = commit) |
| Correction runtime commit | `3148e46b7df706551ba907609fe486c61d93d449` | `git log origin/main..HEAD` |
| Correction test commit | `8674fd84fe06e6032e82213e0d75438f1a2628cf` | same |
| Correction docs commit (live head) | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` | same |

Base and head are consistent with the mandate: the merge base **is** the authorized base
SHA, so the branch carries no unauthorized rebase and no foreign base.

### 1.1 Immutable original review artifact — verified byte-identical

```
git rev-parse 1b72a4c…:stocky-plus/docs/phases/phase-1/PR5_F2B_CANONICAL_APPLICATOR_INDEPENDENT_REVIEW.md
→ e3fe412180ddb6d5b79d9fa8c6d566e68433918a
```

This equals the expected immutable blob `e3fe412180ddb6d5b79d9fa8c6d566e68433918a`.
The integrating commit `35296cb00588da4965cf51bc40292b3f5136cd3a` added only that path.
`git diff 2abda4b..1b72a4c -- <that path>` is empty — the correction package did **not**
edit my original review. **PASS.**

### 1.2 Exact-head CI (independently re-read from the GitHub Actions API)

| Field | Value |
|---|---|
| Run id | `32215886401` |
| `event` | `pull_request` |
| `head_sha` | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` |
| `head_branch` | `cursor/pr5-f2b-canonical-applicator-055c` |
| `status` / `conclusion` | `completed` / **`success`** |
| Linked PR | #31, base `5129707…` |

The authoritative exact-head `pull_request` CI evidence claimed in the PR body is real
and green.

---

## 2. Cumulative changed-file scope (22 paths, +12 809 / −15)

Runtime (all under the lane's exclusive ownership):
`app/lib/catalog-facts/apply/{clocks,errors,existence,fencing,first-live,index,money,observation-evidence,sql,types,writers}.ts`,
`app/lib/catalog-facts/index.ts`, `app/lib/catalog-facts/lock-capacity.ts`.

Tests: `app/lib/catalog-facts/apply/{apply-clocks,apply-safety,first-live,observation-evidence}.test.ts`,
`app/lib/catalog-facts/lock-capacity.test.ts`,
`scripts/tenant-enforcement/tests/pr5-f2b-canonical-applicator.test.ts`.

Docs: the two PR5-F2B phase documents plus a mechanical `PR2_TENANT_ACCESS_INVENTORY.md`
scanned-file count refresh (258 → 274).

**No Prisma schema change, no migration, no Shopify configuration, no workflow change, no
feature-flag change.** Independently confirmed:

- `git diff 5129707..1b72a4c -- stocky-plus/prisma` → empty;
- `git diff 5129707..1b72a4c -- .github` → empty;
- no `fetch(`, `axios`, `http`, or Shopify client reference anywhere under `apply/`;
- no `DELETE`, `deleteMany`, `TRUNCATE`, `ON CONFLICT`, or `SAVEPOINT` in the runtime.

`app/lib/catalog-facts/foundation-safety.test.ts` is byte-identical to `origin/main`
(not in the changed-file set).

---

## 3. Independent execution environment

| Item | Value |
|---|---|
| Commit under test | `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` (detached checkout) |
| PostgreSQL | **16.13** (Ubuntu 16.13-0ubuntu0.24.04.1), disposable cluster created for this review, `max_connections=300` |
| Node / npm | `v22.22.2` / `11.5.2` (repo `engines` satisfied) |
| Install | `npm ci` exit 0 |
| Databases | `stocky_plus_ci` (suites), `stocky_probe` (my adversarial probes only) |
| Inventory-write flags | all `false`, unchanged |
| Network | no Shopify I/O performed or possible from this lane |

Probes were written into a temporary file
(`scripts/tenant-enforcement/tests/zz-claude-f2b-probe.test.ts`), executed, and
**deleted before this artifact commit**. `git status --short` on the review branch shows
only this artifact.

---

## 4. Re-review of NEW-CLAUDE-PR5F2B-01 … -11

Legend: **RESOLVED** = corrected and independently falsified in real PostgreSQL;
**RESOLVED (ratified)** = behavior confirmed as the owner's intended contract and
independently verified to behave as ratified.

### NEW-CLAUDE-PR5F2B-01 — Omitted attributes coerced to NULL / `[]` — **RESOLVED (P2 closed)**

**Correction:** `types.ts` made every canonical resource-attribute property **required**
(`vendor: string | null`, not `vendor?`), so omission is now a type error as well as a
runtime rejection. `first-live.ts` adds `collectMissingAuthoritativeFields` /
`validateResourceSnapshot`, used by both first-LIVE
(`INCOMPLETE_FIRST_LIVE_ATTRIBUTES`) and existing-row
(`validateExistingAuthoritativeAttributes` → `INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`)
paths. `hasOwn` distinguishes *missing property* from *explicit null*. Every `?? null`
and `?? []` coercion was removed from `insertFact`, `updateProductAttributes`,
`updateVariantAttributes`, `updateInventoryItemAttributes`, `updateLocationAttributes`.

**Independent falsification — PROBE C1 (PostgreSQL 16.13).** Seed a Product with
`vendor="ACME", productType="PT", tags=["alpha","beta"], featuredMediaUrl="u"` at
`shopifyUpdatedAt = 2026-08-01`. Then, for **each** of the seven Product fields in turn,
apply a strictly newer (`2026-08-09`) direct `LIVE_REFETCH` whose payload omits exactly
that one property:

```
{"title":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "handle":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "vendor":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "productType":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "tags":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "status":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "featuredMediaUrl":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES"}
```

For every one of the seven cases the stored row remained
`title=P, vendor=ACME, tags=["alpha","beta"], productType=PT, featuredMediaUrl=u`; the
fact carried `attributeFreshnessState=DEGRADED` and
`existenceDiagnosticState=INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`; **`attributeRequestGen`,
`attributeResponseGen` and `shopifyUpdatedAt` were byte-for-byte unchanged** (no Clock-A
advance); and the observation row was `COMPLETED`. The original PROBE-N1 destruction is
no longer reproducible.

**Missing ≠ explicit null — PROBE C2.** The same fact, newer version, with
`vendor: null, tags: []` **explicitly present** → `outcome=applied`, stored
`vendor=NULL`, `tags=[]`, `attributeFreshnessState=ORDERED`. The approved nullable
schema semantics survive.

**Existence-only still valid.** Vendor suite *"keeps existence-only LIVE valid on an
existing Product row"* passes; `validateExistingAuthoritativeAttributes` early-returns
when `attributes == null`, and `applyAttributes` early-returns likewise. InventoryLevel
quantity-only payloads are exempted via `inventoryLevelHasResourceAttributes`.

**Full-sync incomplete row fails its apply transaction — PROBE C13.** Two existing LIVE
Products; one full-sync batch with a good line for A and a line for B missing `tags`:

```
{"threw":"canonical_apply_incomplete_authoritative_attributes",
 "titleA":"P","presenceA":null,"titleB":"P","presenceB":null,"genA":"124"}
```

The typed error escapes `applyCanonicalFacts`, the caller rolls back, and **neither** the
good sibling's attributes **nor** its `lastSeenFullSyncRunId` presence marker survived —
proving the whole unit failed and no partial snapshot advanced Clock A. The correction
also **moved the validation block ahead of `updatePresenceMarker`** (diff at
`index.ts`), which is what makes this atomic rather than presence-first.

**Verdict: RESOLVED.** All five mandate sub-conditions independently proven.

### NEW-CLAUDE-PR5F2B-02 — `InventoryItem.shopifyVariantGid` silently severed — **RESOLVED (P2 closed)**

`collectMissingAuthoritativeFields` requires `hasOwn(attrs,"shopifyVariantGid")` and
`isNullableGid`, and `updateInventoryItemAttributes` no longer applies `?? null`.

**PROBE C3.** Seed Product → Variant → InventoryItem with
`shopifyVariantGid = gid://shopify/ProductVariant/C3`.

- newer payload **omitting** the property →
  `rejected / INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`, stored GID **preserved**, fact
  `DEGRADED`;
- newer payload carrying **explicit `null`** → `applied`, stored GID cleared.

The PROBE-N3 relationship severance is no longer reproducible, and the approved explicit
authoritative null remains available. `AGENTS.md` §7 variant-level identity is protected.
**RESOLVED.**

### NEW-CLAUDE-PR5F2B-03 — InventoryLevel non-quantity attributes never refreshed — **RESOLVED (P2 closed)**

`writers.ts` adds `updateInventoryLevelAttributes` (writing
`shopifyInventoryLevelGid`, `isActive`, `shopifyUpdatedAt`, `attributeRequestGen`,
`attributeResponseGen`, `attributeFreshnessState`) and `inventoryLevelAttributesEqual`;
`index.ts` adds the fifth `applyAttributes` branch. `FactSnapshot` now maps
`shopifyInventoryLevelGid`.

**PROBE C4 — full Clock-A matrix on one level, real PostgreSQL:**

| Case | Result |
|---|---|
| first LIVE `isActive=true` @ 08-05 | `applied` |
| **stale** `isActive=false` @ 08-01 | `noop`; stored `isActive` stays `true` |
| **equal-version, different value** @ 08-05 | `EQUAL_VERSION_CONFLICT` / `DEGRADED`; `isActive` stays `true` |
| **null-version** (`shopifyUpdatedAt=null`) | `CATALOG_NULL_VERSION_OBSERVATION` / `DEGRADED`; `isActive` stays `true`; `attributeRequestGen` unchanged (`41` → `41`) |
| **newer** `isActive=false`, new GID @ 08-09 | `applied`; `isActive=false`; GID updated; `ORDERED` |

The original PROBE-N2 silent `noop` (deactivated location reported active forever) is
fixed. **Quantities remain independent per-name clocks:** PROBE C7 changed `available`
while `onHandQuantity` stayed `9`, and `applyQuantities` is a separate pass over
`QUANTITY_COLUMN_SPECS` with its own `decideQuantityClock` and per-name gens. Quantity-only
payloads still skip resource Clock-A (`inventoryLevelHasResourceAttributes`), and PROBE C4
plus the vendor test confirm a quantity-only payload does not null the stored GID.
**RESOLVED.**

### NEW-CLAUDE-PR5F2B-04 — Rejection left no durable trace — **RESOLVED (P2 closed)**

`rejectUsableObservation` now takes the re-read `fact` and, when a fact exists, calls
`updateFreshnessAndDiagnostic(… "DEGRADED", preserveRevivalDiagnostic(stored, failure.diagnostic))`
before `completeObservation`.

**PROBE C7 (quantity) / C1 / C3 (attributes) — all four mandate conditions:**

1. *existence may remain legitimately upgraded* — PROBE C10 revived a terminal tombstone
   to `LIVE` / `LIVE_REFETCH` in the same call whose attribute payload was rejected; the
   existence mutation stands.
2. *attribute value / Shopify timestamp / generation clocks do not advance* — PROBE C1
   showed identical `attributeRequestGen`, `attributeResponseGen`, `shopifyUpdatedAt`, and
   identical column values across all seven rejections; PROBE C7 showed
   `availableQuantity=7` and `availableQuantityRequestGen=75` unchanged across all seven
   bad-domain rejections.
3. *`attributeFreshnessState = DEGRADED`* — observed in every rejection.
4. *named diagnostic persists* — `INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`,
   `CANONICAL_QUANTITY_DOMAIN_UNREPRESENTABLE`, and (vendor suite)
   `CANONICAL_NUMERIC_SCALE_UNREPRESENTABLE` all durable on the fact.
5. *observation completes atomically* — every rejected token read back `COMPLETED`.

The original PROBE-M1 state (`LIVE_REFETCH` + `ORDERED` + null diagnostic after a
discarded response) is no longer reproducible.

**Terminal-revival diagnostic preservation — falsification attempted and failed
(PROBE C10).** I tried to make `preserveRevivalDiagnostic` mask a rejection diagnostic on
a LIVE row:

```
{"afterTombstone":"ABSENT",
 "firstConfirm":"TERMINAL_IDENTITY_REVIVAL_CONFLICT:113:114",
 "c1":"conflict/TERMINAL_IDENTITY_REVIVAL_CONFLICT:113:114",
 "c2":"rejected/INCOMPLETE_AUTHORITATIVE_ATTRIBUTES",
 "existenceState":"LIVE","existenceKind":"LIVE_REFETCH",
 "storedDiag":"INCOMPLETE_AUTHORITATIVE_ATTRIBUTES","fresh":"DEGRADED","title":"P"}
```

The second confirmation both revived the identity **and** recorded the rejection — the
revival marker was cleared by `updateExistence` (mutating decisions carry
`diagnostic = null`) before `rejectUsableObservation` re-read the fact, so the guard did
not fire. I additionally enumerated every `decideExistence` branch that emits a
`TERMINAL_IDENTITY_REVIVAL_CONFLICT` diagnostic
(`terminal_bulk_revival_conflict`, `created_at_mismatch`, `terminal_first_confirmation`,
`terminal_overlapping_confirmations`): **all of them require stored
`existenceState = ABSENT`**, while `allowAttributes` requires
`fact.existenceState === "LIVE"`. The two states are mutually exclusive, so
`preserveRevivalDiagnostic` is unreachable defensive code on the rejection path today.
It is correct, but it is guarding a state this lane cannot produce — worth noting if F2C
ever writes revival markers onto LIVE rows. **RESOLVED.**

### NEW-CLAUDE-PR5F2B-05 — Empty batch threw an untyped error — **RESOLVED (P3 closed)**

`applyCanonicalFacts` returns `{ results: [], identitiesLocked: 0, abandonedBlockerTokens: [] }`
immediately **after** `requireTenant(db, input.shopId)` and before
`readCapacitySettings` / `evaluateCanonicalLockCapacity` / `acquireOrderedLocks`.

**PROBE C9** ran the empty batch inside a real tenant transaction and then counted the
backend's own advisory locks:

```
{"out":{"results":[],"identitiesLocked":0,"abandonedBlockerTokens":[]},"advisoryLocks":0}
```

`pg_locks` shows **zero** `locktype='advisory'` entries for the backend — no canonical
lock is taken, and no capacity evaluation runs, so the `requireSafeIntAtLeast(…, 1)`
throw is gone. Tenant validation still precedes the early return (ordering read directly
from source). **RESOLVED.**

### NEW-CLAUDE-PR5F2B-06 — Null-version DEGRADED downgrade — **RESOLVED (ratified)**

`clocks.ts` now returns `freshness: "DEGRADED"` explicitly (previously `null`, which
`persistClockNoop` coerced to `DEGRADED` anyway — so this is documentation of existing
behavior, not a behavioral change) with an inline citation of brief §6.F.9.

**PROBE C4 (null-version row)** confirms the mandate's two requirements:
value preserved (`isActive` stayed `true`), **clocks preserved**
(`attributeRequestGen` `41` before and after), and
`CATALOG_NULL_VERSION_OBSERVATION` **durable** on the fact with `DEGRADED`.
Brief §6.F.9 commit-rule 3 requires exactly "do not apply + record merchant-durable
`CATALOG_NULL_VERSION_OBSERVATION`". **RESOLVED as ratified** — see P3 finding
`NEW-CLAUDE-PR5F2BC-04` for the remaining documentation inconsistency.

### NEW-CLAUDE-PR5F2B-07 — Order-sensitive `JSON.stringify` equality — **RESOLVED (P3 closed)**

`JSON.stringify` comparison is gone. `tagsSemanticallyEqual` compares sorted copies after
a length check (a sorted **multiset**, so multiplicity is preserved).
`selectedOptionsSemanticallyEqual` compares element-wise by index, and each element by
`name` / `value` only.

**PROBE C5 — tags (stored `["a","a","b"]`, equal `shopifyUpdatedAt`):**

| Incoming | Result |
|---|---|
| `["b","a","a"]` (reorder) | `noop`, diagnostic `null` — no false conflict |
| `["a","b","b"]` (same length, different multiset) | `conflict / EQUAL_VERSION_CONFLICT`; stored tags unchanged |

Multiplicity is genuinely preserved — a duplicate-collapsing implementation would have
called the second case equal.

**PROBE C6 — selectedOptions (stored `[{Size,S},{Color,Red}]`, equal version):**

| Incoming | Result |
|---|---|
| `[{value:"S",name:"Size"},{value:"Red",name:"Color"}]` (key order flipped) | `noop`, diagnostic `null` — key order **not** significant |
| `[{Color,Red},{Size,S}]` (array order flipped) | `conflict / EQUAL_VERSION_CONFLICT` — array order **is** significant |

Both halves of the mandate hold. **RESOLVED** (see P3 `NEW-CLAUDE-PR5F2BC-03` for a
residual narrowness in element comparison).

### NEW-CLAUDE-PR5F2B-08 — First-LIVE accepted semantically empty values — **RESOLVED (P3 closed)**

`isPresentString` was replaced by `isNonEmptyString`; `isApprovedSelectedOptions` now
requires a **non-empty array** whose every element is a non-array object with a
**non-empty** `name` and a string `value`; `status` must be in the approved enum;
`currencyCode` and required relationship GIDs must be non-empty.

**PROBE C8 (first LIVE, no row exists):**

| Payload | Result |
|---|---|
| `Product.title = ""` | `rejected / INCOMPLETE_FIRST_LIVE_ATTRIBUTES`, **no row inserted** (`SELECT` → null) |
| `Product.handle = ""` | `rejected / INCOMPLETE_FIRST_LIVE_ATTRIBUTES` |
| `Location.name = ""` | `rejected / INCOMPLETE_FIRST_LIVE_ATTRIBUTES` |
| `selectedOptions = {}` | `rejected / INCOMPLETE_FIRST_LIVE_ATTRIBUTES` |
| `selectedOptions = []` | `rejected / INCOMPLETE_FIRST_LIVE_ATTRIBUTES` |
| `selectedOptions = [{name:"",value:"x"}]` | `rejected / INCOMPLETE_FIRST_LIVE_ATTRIBUTES` |
| `Product.tags = []` (legitimate) | **`applied`**, stored `tags = []` |

Fabricated/degenerate identity and display fields fail closed; the legitimate empty tag
array is still accepted; `selectedOptions` must be a valid Shopify-style array. The
frozen "no synthetic `""` / `ACTIVE` / `USD` / `true` / `[]` / `{}`" rule remains intact —
the applicator still invents nothing. **RESOLVED.**

### NEW-CLAUDE-PR5F2B-09 — No quantity integer-domain validation — **RESOLVED (P3 closed)**

`isCanonicalInt32` (safe integer within `-2147483648 … 2147483647`) plus
`validateObservationQuantityColumns`, invoked on the first-LIVE insert path **and** on the
existing-row path before any `UPDATE`; `updateQuantity` re-asserts defensively. New typed
error `CanonicalApplyQuantityDomainError`
(`canonical_apply_quantity_domain_unrepresentable`) and diagnostic
`CANONICAL_QUANTITY_DOMAIN_UNREPRESENTABLE`.

**PROBE C7 — existing level with `available=7`, `onHand=9`:**

```
fraction 1.5           → rejected/CANONICAL_QUANTITY_DOMAIN_UNREPRESENTABLE  qty=7 gen=75 fresh=DEGRADED  obs=COMPLETED
NaN                    → rejected/…                                          qty=7 gen=75  obs=COMPLETED
Infinity               → rejected/…                                          qty=7 gen=75  obs=COMPLETED
2147483648             → rejected/…                                          qty=7 gen=75  obs=COMPLETED
-2147483649            → rejected/…                                          qty=7 gen=75  obs=COMPLETED
"5" (string)           → rejected/…                                          qty=7 gen=75  obs=COMPLETED
2^53+1 (unsafe int)    → rejected/…                                          qty=7 gen=75  obs=COMPLETED
-2147483648 (int32 min)→ applied, stored -2147483648 ; onHand still 9
```

Rejection happens **before** the `UPDATE` (the per-name clock `gen=75` never moves), the
diagnostic is typed and durable, the failure is a per-observation rejection rather than a
raw PostgreSQL abort of the batch, and `null` remains an accepted quantity. The int32
boundary value is accepted, so the guard is not over-tight. **RESOLVED.**

### NEW-CLAUDE-PR5F2B-10 — Lock order deviated from the frozen order — **RESOLVED (P3 closed)**

`applyOneObservation` now performs `lockAndReadFact` (canonical `SELECT … FOR UPDATE`)
**before** `lockObservationRows`, with the frozen order stated in a comment.

**PROBE C11 — statement-level trace.** I wrapped the `$queryRaw` surface and recorded every
statement issued during one `applyCanonicalFacts` call, classified by shape:

```
["OTHER","OTHER","OTHER","OTHER","OTHER",
 "ADVISORY",                       ← pg_advisory_xact_lock          (index 5)
 "OTHER",
 "CANONICAL_FOR_UPDATE",           ← ShopifyProductFact … FOR UPDATE (index 7)
 "OBSERVATION_FOR_UPDATE",         ← CatalogObservationInFlight … FOR UPDATE (index 8)
 "FENCE_TOKEN_FOR_UPDATE",
 "OBSERVATION_FOR_UPDATE",
 "OTHER","OTHER","OTHER",
 "INSERT","CANONICAL_FOR_UPDATE","CANONICAL_FOR_UPDATE","UPDATE"]
```

`firstAdvisory(5) < firstCanonical(7) < firstObservation(8)`. Tenant/RLS is established by
the caller before any of this (`requireTenant` re-verifies `stocky.current_shop_id`).
Decisions and writes follow. **No reverse ordering exists in the acquisition prefix.**

The two trailing `CANONICAL_FOR_UPDATE` statements (indices 15–16) are post-`INSERT`
re-reads on the *first-insert* path, where index 7 matched no row and therefore locked
nothing. They are not a reverse acquisition against a foreign holder: every row lock in
this lane is partitioned by identity (`lockAndReadFact` and `lockObservationRows` both
filter to one identity), and each identity is guarded by an **exclusive**
`pg_advisory_xact_lock` acquired for the whole batch in deterministic ascending
`(key1,key2)` order. No two transactions can hold overlapping row-lock sets for one
identity, so no cycle is constructible. **RESOLVED.**

**Mandated determination — the duplicated `lockObservationRows` call.** PROBE C11 confirms
it empirically: `observationLockCalls = 2` per direct observation (once before
`fenceDirectObservation`, once after). My determination, stated without assumption:

- It is **not** a correctness requirement. `fenceDirectObservation` performs its own
  `SELECT … FOR UPDATE` on the token row and **never inserts** a row, so the second call
  can only add rows a *concurrent producer* committed inside the window between the two
  calls — and every consumer of those rows that follows
  (`loadExpiredActiveResultlessBlockers`, `loadActiveUnexpiredBlockers`,
  `loadActiveUnexpiredBlockersForFullSync`, `loadCompletedOverlappingIntervals`,
  `loadCompletedDirectsNotSafelyEarlierThanFence`) is a **plain `SELECT` with no
  `FOR UPDATE`**, and under READ COMMITTED each takes a fresh snapshot anyway. The second
  call therefore does not establish a complete re-read fence either.
- It is **not** a material defect. It acquires the same locks the transaction already
  holds, in the same (post-canonical) position, so it cannot invert the frozen order or
  deadlock.
- It **is** harmless but undocumented redundancy: one extra identity-scoped
  `SELECT … FOR UPDATE` per observation (≈ 32 extra round trips on a full 32-identity
  batch).

Recorded as P3 `NEW-CLAUDE-PR5F2BC-02` so the duplication becomes a decision rather than an
accident. It does **not** block approval.

### NEW-CLAUDE-PR5F2B-11 — Unconditional full-sync abandonment — **RESOLVED (P3 closed)**

`abandonExpiredFullSyncBlockers` / `abandonExpiredBlockers` were replaced by
`loadExpiredActiveResultlessBlockers` (classification only) plus
`abandonExpiredResultlessRows` (mutation), and `index.ts` now computes two hypothetical
existence decisions and abandons **only** when

```
reliesOnExpiry = decisionHonoringExpiry.mutate
              && !decisionIfExpiredStillBlocking.mutate
              && expiredBlockers.length > 0
```

then re-reads blockers and re-decides.

**Independent falsification.**

- *No cleanup-style abandonment on a noop / presence-only path* — vendor tests
  *"does not abandon an expired ACTIVE direct when full-sync only advances the presence
  marker"* and *"does not abandon an expired row when an unexpired blocker still prevents
  mutation"* pass on my cluster.
- *Attribute-only reliance also does not abandon* — **PROBE C12**: an expired ACTIVE
  resultless direct plus a newer `LIVE_REFETCH` on an already-`LIVE_REFETCH` row (so
  existence does not mutate but attributes do):
  `{"outcome":"applied","existenceMutated":false,"attributesApplied":true,"abandoned":[],"expiredState":"ACTIVE","title":"NEWTITLE"}`.
  Attributes applied, and the expired row was left `ACTIVE` — exactly the
  reliance-scoping the mandate requires. (Note: `leaseExpiresAt` is computed by the F1
  DB trigger from `leaseDurationMs`, so this probe required `leaseMs=1` plus
  `pg_sleep` — a supplied `leaseExpiresAt` is ignored. That is correct F1 behavior:
  PostgreSQL owns lease time.)
- *Blockers re-evaluated after abandonment* — source: `blockersAfter` is re-loaded and
  `existenceDecision = decideWithBlock(existenceBlocked)` recomputed.
- *Rollback undoes abandonment + successor mutation* — vendor test *"durably abandons an
  expired ACTIVE direct in the same full-sync transaction and rolls back with it"* passes;
  both writes share the one tenant transaction.

Leaving a never-relied-upon expired row `ACTIVE` is safe: it cannot block (the blocker
predicates require `clock_timestamp() < leaseExpiresAt`), cannot complete
(`completeObservation` requires an unexpired lease), and cannot re-fence
(`fenceDirectObservation` raises `CanonicalApplyLeaseInvalidError`). Physical reaping
remains R-159 maintenance scope. **RESOLVED.**

### Disposition summary

| ID | Original severity | Disposition |
|---|---|---|
| NEW-CLAUDE-PR5F2B-01 | P2 | **RESOLVED** — falsified in PostgreSQL 16.13 |
| NEW-CLAUDE-PR5F2B-02 | P2 | **RESOLVED** — falsified |
| NEW-CLAUDE-PR5F2B-03 | P2 | **RESOLVED** — falsified (full clock matrix) |
| NEW-CLAUDE-PR5F2B-04 | P2 | **RESOLVED** — falsified; revival-masking falsification failed |
| NEW-CLAUDE-PR5F2B-05 | P3 | **RESOLVED** — zero advisory locks proven via `pg_locks` |
| NEW-CLAUDE-PR5F2B-06 | P3 | **RESOLVED (ratified)** — value + clocks preserved, diagnostic durable |
| NEW-CLAUDE-PR5F2B-07 | P3 | **RESOLVED** — multiplicity and both ordering semantics proven |
| NEW-CLAUDE-PR5F2B-08 | P3 | **RESOLVED** — degenerate payloads fail closed, `tags=[]` accepted |
| NEW-CLAUDE-PR5F2B-09 | P3 | **RESOLVED** — 7 hostile domains rejected pre-`UPDATE` |
| NEW-CLAUDE-PR5F2B-10 | P3 | **RESOLVED** — statement-trace proof; duplicate call adjudicated |
| NEW-CLAUDE-PR5F2B-11 | P3 | **RESOLVED** — reliance-scoped, re-evaluated, rollback-safe |

**11 of 11 dispositioned. No regression introduced by the correction package.**

---

## 5. Cumulative high-risk regression re-falsification

Re-run at commit `1b72a4c…` against real PostgreSQL 16.13. The 72-case F2B race suite and
the 19-case F1 foundation suite both pass; where a claim was cheap to re-derive
independently I did so rather than trusting the suite.

| Contract | Result | Evidence |
|---|---|---|
| requestGen binding | PASS | `fenceDirectObservation` raises `CanonicalApplyRequestGenerationMismatchError` on mismatch; vendor cases *"denies a valid ACTIVE token when the caller requestGen does not match"*, *"fabricated earlier requestGen"*, *"fabricated later requestGen"* |
| `ACTIVE ⇒ responseGen NULL` | PASS | fence raises `LeaseInvalid` when `observationResponseGen != null` on an ACTIVE row |
| DB clock lease boundary | PASS | every predicate uses `clock_timestamp()`; equality is expired (`>=`). Independently observed: the F1 trigger recomputes `leaseExpiresAt` from `leaseDurationMs`, so an application-supplied deadline cannot weaken the lease (PROBE C12) |
| late / abandoned token denial | PASS | `CanonicalApplyAbandonedTokenError`; Race AS vendor case |
| fresh transaction after 23505 | PASS | `applyCanonicalFactsWithRetry` re-enters `begin`; vendor cases *"does not retry a unique violation inside the aborted transaction and does not mask 25P02"* and *"retries unique conflict in a fresh transaction after full rollback"* |
| no `ON CONFLICT DO UPDATE` | PASS | grep over `apply/**` — zero occurrences outside a prohibition comment |
| full-sync fence ≠ Clock-B interval | PASS | `observation-evidence.ts` keeps the two types disjoint; `nullableFallbackIntervalFromFullSyncMarker` is documented as a bulk epoch marker only |
| full-sync existence NULL/NULL gens | PASS | `existenceGens` returns `{null,null}` for `LIVE_FULL_SYNC_PRESENT`; vendor case *"persists full-sync first insert as LIVE_FULL_SYNC_PRESENT with NULL/NULL existence gens"* |
| Race AT first insert | PASS | vendor *"serializes concurrent first insert of a nonexistent identity"*, *"serializes concurrent overlapping LIVE vs ABSENT first insert to zero or one row"* |
| unseen ABSENT preserve-no-row | PASS | `first_insert_absent_preserve_no_row`; vendor case across all five resource kinds |
| terminal two-confirmation revival | PASS | vendor case + PROBE C10 (`…:113:114` marker, then non-overlapping second confirmation revives) |
| InventoryLevel reconnect | PASS | vendor *"reconnects an InventoryLevel pair without terminal revival"*, *"reconnects InventoryLevel from a later full-sync fence"* |
| nullable Clock-A fallback | PASS | vendor Race L + PROBE C4 null-version row |
| exact `DECIMAL(20,6)` | PASS | `money.ts` never uses `Number`; vendor scale-expansion, true-difference, round-trip and fail-closed-precision cases |
| relationship equality | PASS | `exactNumericEqual` + explicit `?? null` comparisons; PROBE C3 |
| 8 independent quantities | PASS | `QUANTITY_COLUMN_SPECS` per-name gens; PROBE C7 (`onHand` untouched while `available` changed) |
| R-162 unsafe integer rejection | PASS | `requireSafeIntAtLeast` + `multiplySafeIntegers`; `lock-capacity.test.ts` 8/8 |
| ordinary apply API cannot physical-delete | PASS | grep: no `DELETE` / `deleteMany` / `TRUNCATE` in `apply/**`; `CANONICAL_APPLY_PHYSICAL_DELETE_OPERATIONS = []`; `denyCanonicalFactPhysicalDelete()` throws; vendor case *"denies cross-shop apply and physical delete on the ordinary apply surface"* |
| tenant / RLS | PASS | `requireTenant` compares `current_setting('stocky.current_shop_id')` to the batch `shopId` and every statement is `shopId`-scoped; cross-shop vendor case passes; `tenant:access:audit` `violations: 0` |
| batch atomicity | PASS | vendor *"rolls back canonical writes when the tenant transaction aborts"* + PROBE C13 (a bad full-sync line discards the good sibling's attributes **and** presence marker) |
| no network I/O | PASS | grep: no `fetch(` / `axios` / `http` / Shopify client under `apply/**` |

No regression found in any of the 22 cumulative contracts.

---

## 6. New findings from this re-review

**No P0. No P1. No P2.** Nothing found in this pass creates cross-tenant exposure,
inventory or financial corruption, broken authentication, unrecoverable data loss, secret
exposure, incorrect inventory/receipt/forecast/cost/billing/entitlement behavior, a
core-workflow failure, or an App Store blocker. Four P3 items follow.

### NEW-CLAUDE-PR5F2BC-01 — **P3** — A rejection diagnostic is never cleared on recovery, so a healthy fact can read `ORDERED` **and** carry a stale rejection diagnostic

- **File / line:** `writers.ts:730-760` (`updateProductAttributes`) and the four sibling
  attribute writers — each sets `attributeFreshnessState` but leaves
  `existenceDiagnosticState` untouched; `index.ts:246-286`
  (`rejectUsableObservation` / `persistClockNoop`) are the only writers of that column on
  the attribute path.
- **Evidence / reproduction (PROBE C14, PostgreSQL 16.13):**
  ```
  seeded        : ORDERED / null
  after stale-bad payload : rejected / title=GOOD / DEGRADED / INCOMPLETE_AUTHORITATIVE_ATTRIBUTES
  after good newer payload: applied  / title=RECOVERED / ORDERED / INCOMPLETE_AUTHORITATIVE_ATTRIBUTES
  ```
  The recovery correctly applied the attributes and restored `ORDERED`, but the fact still
  advertises `INCOMPLETE_AUTHORITATIVE_ATTRIBUTES` indefinitely.
- **Merchant impact:** the two merchant-durable columns become mutually contradictory.
  The brief makes `DataIssue` derived from this evidence, so support and reconciliation
  cannot distinguish a fact that is *currently* broken from one that recovered — every
  row that ever saw one malformed producer payload keeps a permanent scar. No data is
  lost or wrong.
- **Expected behaviour:** a successful attribute apply should clear (or supersede) the
  attribute-level rejection diagnostic it resolves, or the two concerns should use
  separate columns.
- **Recommended correction:** in the five `update*Attributes` writers, clear
  `existenceDiagnosticState` when it holds an attribute-domain diagnostic
  (`INCOMPLETE_AUTHORITATIVE_ATTRIBUTES`, `CANONICAL_NUMERIC_SCALE_UNREPRESENTABLE`,
  `CANONICAL_QUANTITY_DOMAIN_UNREPRESENTABLE`, `EQUAL_VERSION_CONFLICT`,
  `CATALOG_NULL_VERSION_OBSERVATION`) while preserving existence-domain diagnostics.
  Decide with ChatGPT; do not widen the schema in this lane.
- **Missing test:** an applied recovery after a durable rejection must not leave a stale
  attribute diagnostic.

### NEW-CLAUDE-PR5F2BC-02 — **P3** — A stale payload that could never have applied still degrades a fresher fact, and `lockObservationRows` runs twice per observation

Two related "decision happens before it needs to" items, both non-blocking:

- **Stale-but-malformed degradation.** `index.ts:759-786` runs
  `validateExistingAuthoritativeAttributes` / `validateObservationNumericColumns` /
  `validateObservationQuantityColumns` **before** `applyAttributes` computes the Clock-A
  decision. PROBE C14 line 2 shows an observation with `shopifyUpdatedAt = 2026-08-01`
  against a stored `2026-08-10` fact — i.e. an observation that `decideAttributeClock`
  would have discarded as `stale_shopify` with no state change — nevertheless flipping the
  fact from `ORDERED` to `DEGRADED` and writing a diagnostic. A misbehaving or replaying
  producer can therefore pin every row to `DEGRADED` using payloads that carry no fresh
  information. *Merchant impact:* freshness signal dilution only; no value, clock, or
  existence change. *Expected:* either evaluate staleness first and drop stale malformed
  payloads without a state change, or document that any malformed authoritative payload is
  itself evidence worth degrading on.
- **Duplicate observation-row locking.** `index.ts:525` and `index.ts:563` both call
  `lockObservationRows(db, shopId, identity)`; PROBE C11 measured
  `observationLockCalls = 2`. Per §4 (NEW-…-10) this is harmless redundancy, not a
  re-read fence and not a defect — the following blocker loaders are plain `SELECT`s, so
  the second call closes no window they leave open. Cost is one extra identity-scoped
  `SELECT … FOR UPDATE` per observation (≈32 per full batch).
  *Expected:* remove the redundant call, or document why the re-lock after
  `fenceDirectObservation` is deliberate.
- **Missing tests:** a stale malformed payload's effect on `attributeFreshnessState`;
  an assertion pinning the intended number of observation-row lock statements.

### NEW-CLAUDE-PR5F2BC-03 — **P3** — `selectedOptionsSemanticallyEqual` compares only `name` and `value`, so option elements can silently diverge from Shopify at equal version

- **File / line:** `writers.ts:938-950`.
- **Evidence:** each element is compared as `a.name === b.name && a.value === b.value`.
  `isApprovedSelectedOptions` permits additional keys, and the column stores the incoming
  object **verbatim** as `jsonb`. PROBE C6 applied
  `[{name,value,optionId},…]` and the stored jsonb now carries `optionId`; had the same
  payload arrived at an **equal** `shopifyUpdatedAt` it would have compared equal, so the
  stored jsonb would have kept the older shape with no `EQUAL_VERSION_CONFLICT` and no
  diagnostic.
- **Merchant impact:** none today (no producer is wired, and Shopify's
  `selectedOptions` is `{name,value}` in the pinned API version). Latent: if a future
  producer includes `optionValue`/`optionId`, equal-version divergence between the stored
  jsonb and Shopify becomes invisible. The mirror-image risk of the P3-07 fix.
- **Expected behaviour:** either compare the full canonicalized element (sorted keys) or
  narrow the accepted element shape to exactly `{name,value}` so that "compared" and
  "stored" are the same information.
- **Missing test:** equal-version `selectedOptions` differing only by an extra key.

### NEW-CLAUDE-PR5F2BC-04 — **P3** — `attributeFreshnessState = DEGRADED` on an *ignored* observation contradicts the brief's own column definition

- **File / line:** `clocks.ts:104-113`; brief
  `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md:210` and §6.F.9 "Degraded honesty".
- **Evidence:** the brief defines the column as `ORDERED` "when a non-null Shopify
  `updatedAt` is stored **for the applied attributes**" and `DEGRADED` "when **the applied
  attributes** rest on the null-version fallback". On the
  `incoming_null_stored_versioned` path nothing is applied — the stored attributes still
  rest on a genuine Shopify timestamp — yet the fact is marked `DEGRADED`
  (PROBE C4: `CATALOG_NULL_VERSION_OBSERVATION / DEGRADED`, value and
  `attributeRequestGen` unchanged). §6.F.9 commit-rule 3 mandates only the durable
  diagnostic, not the freshness downgrade.
- **Assessment:** this is **not** a regression — pre-correction code reached the same
  `DEGRADED` write through `persistClockNoop`'s `?? "DEGRADED"` default — and ChatGPT has
  explicitly ratified the behaviour in the correction mandate. I record it only because
  the runtime and the frozen brief text now say different things, and a repeated
  null-version producer pins every row to `DEGRADED` until a versioned observation
  applies.
- **Expected behaviour:** update brief §5 / §6.F.9 to state that an *ignored* null-version
  observation also degrades freshness, so the frozen document matches the ratified runtime.
- **Missing test:** none beyond the existing null-version freshness case; this is a
  documentation-consistency item.

### P3 items carried forward, not re-raised as findings

- `preserveRevivalDiagnostic` is unreachable defensive code on the rejection path (§4,
  NEW-…-04). Correct as written; relevant only if F2C ever writes revival markers to LIVE
  rows.
- Expired ACTIVE resultless observation rows that no successor mutation relies upon remain
  `ACTIVE` forever with no reaper (PROBE C12). Inert by construction and explicitly
  R-159 maintenance scope, not an F2B defect.
- A single quantity-name clock conflict writes the **resource-level**
  `attributeFreshnessState`. A consequence of the frozen F1 schema (no per-quantity
  freshness column), not of this correction.

---

## 7. Independent evidence — commands, exit status, results

All executed by me at commit `1b72a4c95f0056783c6c3356bea18a572ca4d5ef`, PostgreSQL
16.13, Node v22.22.2, npm 11.5.2.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | dependencies installed (required upgrading npm to the pinned `11.5.2`) |
| `npx prisma generate` | 0 | client generated |
| `npx vitest run app/lib/catalog-facts` | 0 | **59 passed** / 7 files |
| `npm test` | 0 | **115 passed** / 13 files |
| `npm run test:migrations -- …/pr5-f2b-canonical-applicator.test.ts` | 0 | **72 passed** / 1 file (19.0 s) |
| `npm run test:migrations -- …/pr5-f2b-…  …/pr5-catalog-fact-foundation.test.ts` | 0 | **91 passed** / 2 files (F2B 72 + F1 19) |
| `npm run test:migrations` (full) | 0 | **318 passed** / 51 files (982 s) |
| `npm run lint` | 0 | clean (with my temporary probe file removed) |
| `npm run typecheck` | 0 | `react-router typegen && tsc --noEmit` clean |
| `npm run build` | 0 | `react-router build` clean |
| `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| `npm run tenant:enforcement:inventory:check` | 0 | `tenant_enforcement_inventory_fresh` |
| `npm run tenant:access:audit` | 0 | `scannedFiles: 274`, `findings: 1408`, **`violations: 0`**, `modelsCovered: 26` |
| `git diff --check` | 0 | clean |
| immutable review blob | — | `e3fe412180ddb6d5b79d9fa8c6d566e68433918a` (matches) |

Every count in Cursor's §16.12 self-report reproduced exactly on my independent cluster
(59 / 115 / 72 / 91 / 318 / 274 / 1408 / 0). No claimed check was found to be
unexecuted, overstated, or environment-dependent.

### 7.1 Independent PostgreSQL probes

Fourteen adversarial probes, written by me, run against a disposable PostgreSQL 16.13
database (`stocky_probe`) separate from the suite database, then **deleted before this
commit**.

| Probe | Target | Outcome |
|---|---|---|
| C1 | all 7 Product field omissions on an existing row | 7/7 rejected, zero column or clock movement, observation `COMPLETED` |
| C2 | explicit authoritative `null` vs omission | `applied`, `vendor=NULL`, `tags=[]`, `ORDERED` |
| C3 | `InventoryItem.shopifyVariantGid` omit vs explicit null | omit → rejected + preserved; null → applied + cleared |
| C4 | InventoryLevel Clock-A stale / equal / null-version / newer | matrix as specified; clocks preserved on non-apply |
| C5 | tag reorder vs multiplicity change at equal version | reorder idempotent; multiplicity change → `EQUAL_VERSION_CONFLICT` |
| C6 | `selectedOptions` key order vs array order | key order equal; array order → conflict |
| C7 | 7 hostile quantity domains + int32 boundary | all rejected pre-`UPDATE`; boundary accepted; sibling name untouched |
| C8 | degenerate first-LIVE payloads | 6/6 rejected with no row inserted; `tags=[]` accepted |
| C9 | empty batch | empty result, `pg_locks` advisory count **0** |
| C10 | terminal revival + simultaneous attribute rejection | revival granted, rejection diagnostic durable (masking falsified) |
| C11 | statement-level lock-order trace | advisory(5) → canonical(7) → observation(8); 2 observation-lock calls |
| C12 | expired blocker under attribute-only reliance | attributes applied, expired row left `ACTIVE`, `abandoned: []` |
| C13 | full-sync batch with one incomplete line | typed throw; good sibling's attributes **and** presence marker rolled back |
| C14 | stale malformed payload, then recovery | degrades a fresher fact; stale diagnostic survives recovery (→ P3-01/P3-02) |

---

## 8. Risk posture recommendation (advisory only — `RISK_REGISTER.md` not edited)

| Risk | Recommendation | Basis |
|---|---|---|
| **R-157** | **OPEN** | Sequence privilege/allocation regressions are not exercised by this lane; `nextval`-only allocation remains an F1 primitive claim. |
| **R-158** | **OPEN — materially advanced** | Interval-based existence ordering, overlap conflicts and `CONCURRENT_EXISTENCE_OBSERVATION_CONFLICT` are implemented and race-tested; no producer is wired, so the end-to-end scheduling inversion is still unproven. |
| **R-159** | **OPEN — materially advanced** | Lease authority, `ACTIVE ⇒ responseGen NULL`, abandoned-token irreversibility and now **reliance-scoped** abandonment are all proven. Physical reaping and the producer side remain outstanding. |
| **R-160** | **OPEN — materially advanced** | Every canonical writer in this lane runs under the advisory identity anchor, now provably **before** the canonical row lock (PROBE C11). Other lanes' writers still have to be proven. |
| **R-161** | **OPEN** | Capacity evaluator and fail-closed batch cap exist and are tested (Race AW), but no deployment/concurrency capacity evidence exists. Arithmetic is not production proof. |
| **R-162** | **May be recommended CLOSED technically** — closure is ChatGPT's call | `requireSafeIntAtLeast` + `multiplySafeIntegers` + `conditionBBudget` guard reject `2^53`, `2^53+2` and `MAX_VALUE`; `lock-capacity.test.ts` 8/8. The applicator is now a real direct-input consumer and it is safe. I do not close it. |
| **R-163** | **Belongs to F2A** | `foundation-safety.test.ts` is unchanged from `origin/main`; recursive scanning is not this lane's scope. |
| **R-164** | **OPEN globally** | The applicator-lane gate is satisfied — no `DELETE`/`deleteMany`/`TRUNCATE` in `apply/**`, empty physical-delete operation list, `denyCanonicalFactPhysicalDelete()` throws, cross-shop delete denial tested. `stocky_runtime` still holds table-level `DELETE` and no trigger forbids it, so the global risk stands. |

Do **not** close any risk on the basis of this artifact.

---

## 9. Verdict

The correction package addresses all eleven findings from my original review with real
runtime changes, not documentation. The four P2s — the ones that could actually destroy
merchant data — are fixed at the type level *and* the runtime level *and* proven
unreproducible in real PostgreSQL by probes I wrote independently of the vendor's tests.
The P3s are fixed with the semantics the mandate specified, including the two that needed
a judgement call (null-version DEGRADED, reliance-scoped abandonment). Where the mandate
asked me to falsify rather than confirm — terminal-revival diagnostic masking, the
duplicated observation-row lock — I did, and both came back clean: the masking path is
unreachable, and the duplicate lock is redundancy, not a defect.

Every contract from the earlier corrections survives: request-generation binding, lease
authority, abandonment irreversibility, fence-versus-interval separation, first-insert
serialization, preserve-no-row, terminal revival, exact decimal handling, eight
independent quantity clocks, tenancy, batch atomicity, and no network I/O. Exact-head
`pull_request` CI is green, and every number in the implementation report reproduced
exactly on my own cluster.

The four new findings are all P3: one auditability lifecycle gap (a rejection diagnostic
that never clears), one ordering-of-validation nuance plus the redundant lock call, one
latent narrowness in `selectedOptions` element comparison, and one brief-versus-runtime
documentation inconsistency that ChatGPT has already ratified on the runtime side. None
of them affects existence, fencing, serialization, tenancy, money, quantities, or
tenancy isolation; none is reachable in production today, since no producer is wired to
this lane and all write flags remain OFF.

That is not enough to withhold approval of a correction package, and this remains a
FROZEN, DRAFT, unmerged lane whose acceptance and merge are ChatGPT's decision.

### FINAL VERDICT

**APPROVE PR5-F2B CANONICAL APPLICATOR CORRECTION**

Approval covers the correction package at exact head
`1b72a4c95f0056783c6c3356bea18a572ca4d5ef` only. It is **not** a merge authorization,
**not** a readiness verdict for PR 5 or Phase 1, and **not** authority to close any risk,
to start F2C / JSONL / webhook integration / PR 6, or to wire a producer to this lane.
The four P3 findings should be carried into ChatGPT's next consolidated correction
package or explicitly deferred with a recorded decision.

---

## 10. Artifact and branch disposition

- **Artifact path:** `stocky-plus/docs/phases/phase-1/PR5_F2B_CANONICAL_APPLICATOR_CORRECTION_INDEPENDENT_REVIEW.md`
- **Only file in the commit.** No runtime, test, or existing documentation file was
  modified; `RISK_REGISTER.md` was not edited; the immutable original review artifact was
  not touched.
- **Push branch:** `claude/pr5-f2b-applicator-review-io7c16` (this environment's mandated
  Claude review branch, based on `origin/main` `5129707…` so the commit cherry-picks
  cleanly onto the PR branch). **Nothing was pushed to
  `cursor/pr5-f2b-canonical-applicator-055c`.**
- PR #31 remains **OPEN / DRAFT / UNMERGED**. Not merged, not marked ready, not closed.
- Temporary probe file
  `stocky-plus/scripts/tenant-enforcement/tests/zz-claude-f2b-probe.test.ts` was created,
  executed, and deleted before this commit; `git diff --check` and `npm run lint` are
  clean afterwards.
- Exact commit SHA and blob hash for this artifact are reported in the chat handoff
  accompanying this review, since a document cannot contain its own hash.

ChatGPT coordinates artifact integration and any final exact-head CI.
