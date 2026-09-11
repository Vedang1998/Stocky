# Phase 1 PR6-A — Independent Tier-A Correction Re-Review (order / refund fact foundation)

**Immutable artifact.** Do not edit after commit. Later corrections belong in a new artifact.

Scope: focused re-review of Cursor's correction package for `F-CLAUDE-PR6A-01` (P2),
`F-CLAUDE-PR6A-02` (P3), `F-CLAUDE-PR6A-03` (P3) and `F-CLAUDE-PR6A-04` (P3), plus a
regression gate over everything the first review cleared. The first review
(`PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md`, blob `198e55548a2ca09942843798a9ebd3e03a30d0fa`)
is immutable and was not edited.

Verified by direct repository inspection and executed evidence on a disposable
PostgreSQL 16.13. Cursor's correction report was read but is not accepted as proof of any
claim; every material assertion below was independently reproduced.

---

## 1. Identity / delta gate

| Item | Required | Independently observed | Result |
|---|---|---|---|
| Corrected head | `1f615c516ff4db927fb641bb96418dd217fe3a22` | `1f615c516ff4db927fb641bb96418dd217fe3a22` | PASS |
| Base / current `origin/main` | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` | PASS |
| PR #37 state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` | PASS |
| Merge base | exact main | `git merge-base` = `09feffd3f36…` | PASS |
| Ahead / behind vs main | — | 7 ahead / 0 behind | PASS |
| Descends from reviewed head | yes | `git merge-base --is-ancestor 5f8b2e76 1f615c51` → true | PASS |
| Correction delta | 3 commits, 15 paths | 3 ahead / 0 behind; 15 changed paths | PASS |
| No later push after final CI | none | head committed `05:05:13Z`; run started `05:05:39Z`, finished `06:03:45Z`; PR `updated_at 06:05:34Z` is a body edit, head unchanged | PASS |

### 1.1 Correction commits

| Commit | Author | Content |
|---|---|---|
| `fcf4b5c08eef3c3984acddccaee7e804daa6d2c4` | Claude | Integration of the immutable first-review artifact (1 file added) |
| `917080a3df47eb932e10b865bb4a7b018a5e7482` | Cursor Agent | The correction implementation (7 paths) |
| `1f615c516ff4db927fb641bb96418dd217fe3a22` | Cursor Agent | Correction evidence + regenerated inventories (7 paths) |

### 1.2 The 15 correction-delta paths

Added (2): `prisma/migrations/20260907020000_pr6_a_order_refund_existence_coherence/migration.sql`;
`docs/phases/phase-1/PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md`.

Modified (13): `app/lib/order-facts/types.ts`, `app/lib/order-facts/types.test.ts`,
`scripts/sync-control-plane/roles.ts`, `scripts/sync-control-plane/tests/sync-role-isolation.test.ts`,
`scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts`,
`scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`,
`docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/README.md`, `docs/RISK_REGISTER.md`,
`docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`,
`docs/phases/phase-1/PR6_A_FOUNDATION_IMPLEMENTATION_REPORT.md`,
`docs/phases/phase-1/README.md`.

This matches the expected shape exactly: successor coherence migration, `order-facts/types.ts`
and its test, sync-control-plane role verifier and tests, PR6-A PostgreSQL tests,
migration/backfill tests, the immutable prior review artifact, and implementation/control
docs/inventories.

**No PR6-B/C/D runtime leakage.** `prisma/schema.prisma`, `app/tenant/**`,
`app/lib/order-facts/{lock-key,advisory-lock,constants}.ts`,
`scripts/tenant-enforcement/{manifest,roles}.ts`, `shopify.app.toml`,
`app/lib/feature-flags.server.ts` and `.env.example` are all unchanged in the delta. No Admin
reader, no applicator, no webhook/import runtime, no GraphQL production document, no
`app/types/**` path. Total PR scope vs main is now 35 files (33 + review artifact + successor
migration).

## 2. Immutable first-review blob

```
blob at corrected head 1f615c51 : 198e55548a2ca09942843798a9ebd3e03a30d0fa
blob at review commit fcf4b5c0  : 198e55548a2ca09942843798a9ebd3e03a30d0fa
required                        : 198e55548a2ca09942843798a9ebd3e03a30d0fa
git diff fcf4b5c0..1f615c51 -- PR6_A_FOUNDATION_INDEPENDENT_REVIEW.md → (empty)
```

**Byte-identical and untouched by both correction commits. PASS.** The original PR6-A migration
`20260907010000_pr6_a_order_refund_fact_foundation/migration.sql` is likewise byte-identical
(blob `8f4955551d0d2ce6e57ca4a5be09fab10ee90fec` at both heads), and no other previously merged
migration was modified.

## 3. Exact-head CI

Run `34085479690`, event `pull_request`, head `1f615c516ff4db927fb641bb96418dd217fe3a22`,
conclusion **success**.

| Job | Id | Conclusion |
|---|---|---|
| Classify change set | `101628581576` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `101628608242` | SUCCESS |
| CI Gate | `101639021917` | SUCCESS |

Classification read directly from the Classify job log, not inferred:

```
changed_path [full] stocky-plus/prisma/migrations/20260907020000_pr6_a_order_refund_existence_coherence/migration.sql
classification_reason=non_docs_or_unknown_path
docs_only=false
full_ci=true
```

Heavy was inspected step by step: **146 numbered steps, all `success`, none `skipped`** — which
is itself the proof that the full matrix ran rather than a docs-only short circuit. Steps
establishing that the successor migration and the corrected tests actually executed:
step 9 Validate Prisma schema, step 10 Apply migrations to ephemeral PostgreSQL (applies the
successor), step 13 Prisma schema drift check, step 88 Sync role isolation (the new
Shop-coverage case), step 127 Lint, step 128 Typecheck, step 141 Unit tests (`types.test.ts`),
step 142 Migration and tenant-backfill tests, 18m25s (the PR6-A PostgreSQL suite and the two new
upgrade-fixture tests), step 146 Build.

**Exact-head CI gate PASS.**

---

## 4. F-CLAUDE-PR6A-01 (P2) — existence coherence — **CORRECTED**

New migration `20260907020000_pr6_a_order_refund_existence_coherence` (498 lines, 16
`ALTER TABLE`: 8 `ADD CONSTRAINT … NOT VALID` + 8 `VALIDATE CONSTRAINT`).

### 4.1 Eight-table constraint inventory (live)

| Table | Constraint | `convalidated` | name len |
|---|---|---|---|
| `ShopifyOrderFact` | `ShopifyOrderFact_existence_coherence_check` | **t** | 42 |
| `ShopifyOrderLineFact` | `ShopifyOrderLineFact_existence_coherence_check` | **t** | 46 |
| `ShopifyOrderRefundFact` | `ShopifyOrderRefundFact_existence_coherence_check` | **t** | 48 |
| `ShopifyOrderRefundLineFact` | `ShopifyOrderRefundLineFact_existence_coherence_check` | **t** | 52 |
| `ShopifyOrderAdjustmentFact` | `ShopifyOrderAdjustmentFact_existence_coherence_check` | **t** | 52 |
| `ShopifyOrderAgreementFact` | `ShopifyOrderAgreementFact_existence_coherence_check` | **t** | 51 |
| `ShopifyOrderAgreementSaleFact` | `ShopifyOrderAgreementSaleFact_existence_coherence_check` | **t** | 55 |
| `ShopifyOrderRefundTransactionFact` | `ShopifyOrderRefundTransactionFact_existence_coherence_check` | **t** | 59 |

Exactly eight canonical fact tables. `OrderFactObservationInFlight` correctly carries **only**
its three original lifecycle / lease / identity-shape checks and **no** canonical-fact coherence
check. No `convalidated = false` constraint remains anywhere in the schema.

All eight predicates are **textually identical** (single distinct `md5(pg_get_constraintdef)`
across the eight). The shortened suffix `_existence_coherence_check` versus PR5's
`_existence_evidence_coherence_check` is justified and verified: the longest name is 59
characters, whereas the PR5 suffix would have produced 68 and silently truncated at
`NAMEDATALEN = 63`.

### 4.2 Positive state matrix — every legal shape, all eight tables

Nine intended-legal shapes, each attempted on all 8 tables (72 inserts): **ACCEPT 8/8 on every
shape.**

| Shape | Result |
|---|---|
| `LIVE_FULL_SYNC_PRESENT` · LIVE · gens NULL/NULL · no deletion | ACCEPT 8/8 |
| `LIVE_REFETCH` · LIVE · gens 1<2 · no deletion | ACCEPT 8/8 |
| `ABSENT_CONFIRMED_QUERY` · ABSENT · gens 1<2 · deletedAt · `CONFIRMED_QUERY` | ACCEPT 8/8 |
| `INACCESSIBLE_HISTORY_WINDOW` preserving **LIVE** · gens NULL/NULL · no deletion | ACCEPT 8/8 |
| `INACCESSIBLE_HISTORY_WINDOW` preserving **ABSENT** · gens NULL/NULL · no deletion | ACCEPT 8/8 |
| `INACCESSIBLE_HISTORY_WINDOW` preserving **LIVE** · coherent gens 1<2 · no deletion | ACCEPT 8/8 |
| `INACCESSIBLE_HISTORY_WINDOW` preserving **ABSENT** · coherent gens 1<2 · no deletion | ACCEPT 8/8 |
| `ABSENT_SIGNALLED_DELETE_UNVERIFIED` · ABSENT · deletedAt · `WEBHOOK` · **no interval** | ACCEPT 8/8 |
| `ABSENT_SIGNALLED_DELETE_UNVERIFIED` · ABSENT · deletedAt · `WEBHOOK` · coherent interval | ACCEPT 8/8 |

This satisfies each contract requirement in turn: `LIVE_FULL_SYNC_PRESENT` requires LIVE with
both gens and both deletion columns NULL; `LIVE_REFETCH` requires LIVE with a strictly
increasing non-null interval and no deletion lineage; `ABSENT_CONFIRMED_QUERY` requires ABSENT
with a coherent non-null interval, `deletedAt` non-null and `deletionSource = CONFIRMED_QUERY`;
`INACCESSIBLE_HISTORY_WINDOW` preserves either last-known state, forbids deletion columns and
permits gens NULL/NULL **or** a coherent pair; `ABSENT_SIGNALLED_DELETE_UNVERIFIED` requires
ABSENT with `deletedAt` non-null and `deletionSource = WEBHOOK` and does **not** mandate a
confirmation interval, while still rejecting an incoherent one.

### 4.3 Negative matrix — INSERT

Twenty-three impossible shapes attempted; **all rejected**, every one by the correctly named
`ShopifyOrderFact_existence_coherence_check`. This includes all six originally reported failures
and all eight additionally required negatives:

| # | Case | Result |
|---|---|---|
| ORIG-1 | LIVE state + `ABSENT_CONFIRMED_QUERY` kind + deletedAt | REJECT |
| ORIG-2 | `LIVE_REFETCH` but tombstoned | REJECT |
| ORIG-3 | deletedAt set, deletionSource NULL | REJECT |
| ORIG-4 | `INACCESSIBLE_HISTORY_WINDOW` carrying deletedAt | REJECT |
| ORIG-5 | `ABSENT_CONFIRMED_QUERY` with no gen evidence | REJECT |
| ORIG-6 | stale evidence requestGen 999 > responseGen 1 | REJECT |
| NEW-1 | request only (half-null interval) | REJECT |
| NEW-2 | response only (half-null interval) | REJECT |
| NEW-3 | request = response | REJECT |
| NEW-4 | request > response | REJECT |
| NEW-5 | confirmed absence missing deletedAt | REJECT |
| NEW-6 | confirmed absence wrong deletionSource (`WEBHOOK`) | REJECT |
| NEW-7 | unverified delete missing deletedAt | REJECT |
| NEW-8 | unverified delete wrong deletionSource (`CONFIRMED_QUERY`) | REJECT |

Nine further probes of my own were also rejected: full-sync-present carrying a gen interval;
full-sync-present with ABSENT state; `LIVE_REFETCH` with ABSENT state; `ABSENT_CONFIRMED_QUERY`
with LIVE state; unverified delete with LIVE state; `INACCESSIBLE_HISTORY_WINDOW` with
deletionSource but no deletedAt; `INACCESSIBLE_HISTORY_WINDOW` with a half-null interval;
unverified delete with a reversed interval; full-sync-present with deletionSource only.

### 4.4 Negative matrix — UPDATE

The CHECK fires on UPDATE as well as INSERT. A legal `LIVE_REFETCH` row was seeded, then five
corrupting UPDATEs were attempted; **all five rejected**, each with:

```
ERROR: 23514: new row for relation "ShopifyOrderFact"
       violates check constraint "ShopifyOrderFact_existence_coherence_check"
```

covering: tombstoning a live row; reversing the interval; erasing half the interval; flipping
kind to `ABSENT_CONFIRMED_QUERY` without deletion lineage; flipping to
`INACCESSIBLE_HISTORY_WINDOW` while adding a tombstone. **SQLSTATE 23514** and the exact
constraint name confirmed in every case.

### 4.5 SQL NULL semantics — exhaustive proof

Visual SQL inspection was not relied upon. A `plpgsql` driver enumerated the **complete cross
product** of every column the predicate reads:

```
2 existenceState × 5 existenceKind × 4 requestGen {NULL,1,2,3} × 4 responseGen {NULL,1,2,3}
  × 2 deletedAt {NULL,now} × 3 deletionSource {NULL,WEBHOOK,CONFIRMED_QUERY} = 960 rows
```

Each row was inserted into the real table and the outcome recorded. Result: **960 probed, 19
accepted, 941 rejected, exactly one distinct SQLSTATE (23514)**.

The 19 accepted combinations were then compared against an **independent reference
implementation of the intended contract**, written from the approved plan (PO-01, §5.1, §8.5,
§8.6, §8.12) rather than from the migration SQL:

```
Mismatches vs independent spec : 0
VERDICT: EXACT MATCH — no UNKNOWN leak, no logic gap
```

No intended-invalid state passes because the predicate evaluates to UNKNOWN. This is structurally
sound as well as empirically confirmed: the predicate uses only `IS NULL` / `IS NOT NULL` /
`IS NOT DISTINCT FROM` and `=` on two `NOT NULL` enum columns, and every `<` comparison is
gated behind `IS NOT NULL` conjuncts, so `FALSE AND UNKNOWN = FALSE` in the three-valued logic.

### 4.6 Parent-versioned children

The correction does **not** force child-specific direct-query evidence that does not exist. All
of the following were accepted:

| Child shape | Result |
|---|---|
| Child present in a **full-sync** parent snapshot — `LIVE_FULL_SYNC_PRESENT`, gens NULL/NULL | ACCEPT |
| Child present in a **refetch** parent snapshot — `LIVE_REFETCH` inheriting the parent interval | ACCEPT |
| Child **absent** from a complete refetch parent snapshot — `ABSENT_CONFIRMED_QUERY` with the parent's interval + tombstone lineage | ACCEPT |
| Child whose parent became inaccessible — `INACCESSIBLE_HISTORY_WINDOW` preserving LIVE, gens NULL | ACCEPT |
| Removed-but-retained line kept LIVE with `currentQuantity = 0` (§5.3) | ACCEPT |
| Full-sync omission routed through `absenceNominationState = CANDIDATE` while staying `LIVE_FULL_SYNC_PRESENT` (§8.8) | ACCEPT |

The one shape the CHECK forbids — absence derived from a **full-sync** sweep encoded as a
tombstone — is forbidden **correctly**: §8.8 states that bulk omission may never nominate, and
that `ABSENT_FULL_SYNC_SWEEP` is not single-epoch authority. The constraint therefore routes
full-sync-derived absence through the nomination path rather than the tombstone path, which is
the approved behaviour and mirrors PR5, where `LIVE_FULL_SYNC_PRESENT` likewise has no ABSENT
counterpart.

### 4.7 Preservation boundary

The correction report states that an inaccessible later observation must not erase an existing
confirmed/unverified tombstone, and that access uncertainty is recorded separately. Two questions
were tested.

**Does the schema make that PR6-C behaviour impossible? No.** Reproduced: an
`ABSENT_CONFIRMED_QUERY` row (gens 5<6, `deletedAt`, `CONFIRMED_QUERY`) accepted an UPDATE that
kept the tombstone intact while writing `historyWindowState = 'ORDER_EXISTENCE_UNVERIFIABLE_WINDOW'`
and `existenceDiagnosticState`, refreshing `existenceObservedAt`. The required behaviour is
achievable on existing columns — **no new column is required**.

**Does the CHECK by itself prove the preservation protocol? No, and it does not claim to.** A row
CHECK has no access to `OLD`, so it cannot prevent PR6-C from clearing a tombstone and
re-classifying the row as `INACCESSIBLE_HISTORY_WINDOW`; that transition was reproduced and
passes. This is an inherent property of row CHECK constraints, **identical in the accepted PR5
catalog constraint** (verified: `ShopifyProductFact_existence_evidence_coherence_check` contains
no `OLD` reference), and the migration header states the limitation explicitly and assigns the
transition protocol to PR6-C/D. Correctly scoped; not a defect.

**Remaining PR6-C/D application-layer responsibility** (recorded here so it is not lost):
previous-state preservation across a transition; Shopify query-completion evidence; historical
scope continuity; two-confirmation terminal revival; and the rule that an inaccessible later
observation must keep the confirmed/unverified kind and its deletion lineage rather than
downgrading it to ordinary window uncertainty.

### 4.8 Successor migration behaviour

| Requirement | Observed | Result |
|---|---|---|
| Successor migration only; previous migrations untouched | one added directory; foundation migration blob unchanged | PASS |
| Bounded lock/statement timeouts | `SET lock_timeout='5s'`, `SET statement_timeout='30s'`, both `RESET` at the end | PASS |
| `NOT VALID` + `VALIDATE` used | 8 + 8, in deterministic table order | PASS |
| All constraints validated before completion | all 8 `convalidated = true`; zero `NOT VALID` remaining | PASS |
| No row deletion / coercion / repair | no DML of any kind in the file | PASS |
| Fresh install | `prisma migrate deploy` from empty → all migrations applied, 8 validated constraints | PASS |
| Idempotency | second `migrate deploy` → "No pending migrations to apply"; exactly 1 migration row, finished, not rolled back | PASS |
| Schema drift after migrations (CI ordering) | `tenant_prisma_schema_drift_ok`, exitCode 0 | PASS |

**Lock characterisation — this is not a lock-free migration and is not described as one.**
Measured on the live server: `ADD CONSTRAINT … NOT VALID` takes **AccessExclusiveLock**;
`VALIDATE CONSTRAINT` takes **ShareUpdateExclusiveLock**. Because Prisma executes the migration
file in a single transaction and the file contains no `CONCURRENTLY`, the eight ACCESS EXCLUSIVE
locks are held together until commit, so the `NOT VALID`/`VALIDATE` split yields no online-DDL
benefit here. Exposure is bounded by the declared 5 s `lock_timeout`, and is nil in practice
because the successor ships in the same PR as the tables it constrains, so those tables are empty
on every supported path. The implementation report states "Not claimed lock-free" — accurate.

### 4.9 Upgrade fixtures

**Valid pre-existing rows — preserved byte-identically.** A pre-successor database was seeded
with three valid rows spanning `LIVE_FULL_SYNC_PRESENT`, `ABSENT_CONFIRMED_QUERY` (gens 7<9) and
`ABSENT_SIGNALLED_DELETE_UNVERIFIED`. Whole-row digest before and after applying the successor:

```
before : f45af3016b3ac752a7992e145e3e3b2b
after  : f45af3016b3ac752a7992e145e3e3b2b   → ROWS PRESERVED BYTE-IDENTICALLY
8 constraints, all validated=true
```

**Invalid pre-existing row — clear failure, no repair.** A second database was seeded with one
good row and one invalid row (`LIVE_REFETCH` carrying a tombstone). Applying the successor:

```
Error: P3018  Migration name: 20260907020000_pr6_a_order_refund_existence_coherence
Database error code: 23514
ERROR: check constraint "ShopifyOrderFact_existence_coherence_check"
       of relation "ShopifyOrderFact" is violated by some row
```

Post-failure state: **both rows untouched** — no deletion, no coercion, no silent repair; zero
constraints left behind (the whole migration rolled back); the migration recorded as
`applied=false`, logs retained, so Prisma blocks further migrations until an operator resolves it.
Fails closed and names the exact table and constraint.

**F-CLAUDE-PR6A-01 disposition: CORRECTED.**

---

## 5. F-CLAUDE-PR6A-02 (P3) — required money bags — **CORRECTED**

`ORDER_REQUIRED_MONEY_BAGS` now matches approved §6.3 exactly — 8 groups, 21 bags:

| Group | Count | Required | Bags |
|---|---|---|---|
| `order` | 7 | 7 | `originalTotalPriceSet`, `currentTotalPriceSet`, `currentSubtotalPriceSet`, `currentTotalDiscountsSet`, `currentTotalTaxSet`, `totalRefundedSet`, `netPaymentSet` |
| `line` | 4 | 4 | `originalTotalSet`, `originalUnitPriceSet`, `discountedTotalSet`, `totalDiscountSet` |
| `refund` | 1 | 1 | `totalRefundedSet` |
| `refundLine` | 3 | 3 | `subtotalSet`, `totalTaxSet`, `priceSet` |
| `refundShippingLine` | 2 | 2 | `subtotalAmountSet`, `taxAmountSet` |
| `orderAdjustment` | 2 | 2 | `amountSet`, `taxAmountSet` |
| `sale` | 1 | 1 | `totalAmount` |
| `orderTransaction` | 1 | 1 | `amountSet` |

`ORDER_OPTIONAL_MONEY_BAGS` is unchanged and remains a separate constant (4 order + 1 line,
matching §6.3's optional list).

**Test independence.** `types.test.ts` asserts both constants with `toEqual({...})` against
**hardcoded literal expected objects**, not values derived from the implementation constant —
which is the independence property the first review looked for elsewhere.

**Refund-shipping required sides.** `RefundShippingLineSnapshot.subtotal` and `.tax` are now
`MoneyBagSides` (non-null) rather than `OptionalMoneyBagSides`, and a conditional-type sentinel
`REFUND_SHIPPING_REQUIRED_SIDES_COMPILE_CHECK` resolves to `never` if either required side
becomes nullable.

**The compile-time proof was tested, not assumed.** Reverting the two fields to
`OptionalMoneyBagSides` produced:

```
app/lib/order-facts/types.ts(220,14): error TS2322: Type 'true' is not assignable to type 'never'.
RESULT: typecheck FAILED (compile-time proof is EFFECTIVE)
```

The mutation was reverted and the working tree confirmed identical to the corrected head. No
reader or applicator work was introduced: `types.ts` remains types-and-constants only.

**F-CLAUDE-PR6A-02 disposition: CORRECTED.**

---

## 6. F-CLAUDE-PR6A-03 (P3) — diagnostics — **CORRECTED**

| §8 diagnostic code | Constant | Unique |
|---|---|---|
| `ORDER_HISTORY_WINDOW_TRUNCATED` | `ORDER_HISTORY_WINDOW_STATES` | yes |
| `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` | `ORDER_EXISTENCE_DIAGNOSTIC_STATES` | yes |
| `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` | `ORDER_HISTORY_WINDOW_STATES` | yes |
| `MONEY_CURRENCY_MISMATCH` | `ORDER_MONEY_DIAGNOSTIC_STATES` | yes |
| `REFUND_MONEY_UNBALANCED` | `ORDER_MONEY_DIAGNOSTIC_STATES` | yes |
| `LINE_UNIT_IDENTITY_INCONSISTENT` | `ORDER_UNIT_DIAGNOSTIC_STATES` | yes |
| `UNIT_SALE_SIGN_INCONSISTENT` | `ORDER_UNIT_DIAGNOSTIC_STATES` | yes |
| `SNAPSHOT_PAGINATION_INCOMPLETE` | `ORDER_OBSERVATION_FAILURE_OUTCOMES` | yes |

All eight §8 codes are covered, each in **exactly one** constant, and each mapped to the §6.5
merchant column that owns it. `UNIT_SALE_SIGN_INCONSISTENT` was added.
`ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` is correctly separated into an existence-diagnostic
constant (§8 distinguishes it as "existence, not import depth"), and
`ORDER_HISTORY_ACCESS_DIAGNOSTICS` supplies the combined access vocabulary for B/C.

`INACCESSIBLE_HISTORY_WINDOW` was removed from the history-window states and now appears **only**
as an `existenceKind` — verified programmatically:

```
INACCESSIBLE_HISTORY_WINDOW is an existenceKind only: true
```

`SNAPSHOT_PAGINATION_INCOMPLETE` remains observation-failure evidence. The exported constants are
internally unambiguous for B/C consumption, and `types.test.ts` pins each list literally plus the
negative assertions that `INACCESSIBLE_HISTORY_WINDOW` is absent from every diagnostic bucket.

**F-CLAUDE-PR6A-03 disposition: CORRECTED.**

---

## 7. F-CLAUDE-PR6A-04 (P3) — Shop-column coverage guard — **CORRECTED**

New pure function `evaluateShopColumnCoverage(actual, lifecycle, selectOnly)` in
`scripts/sync-control-plane/roles.ts`, invoked by `verifyControlPlaneRole` against live
`pg_attribute` columns. Probed directly:

| Case | Detection |
|---|---|
| baseline exact coverage | (none) — correct |
| unclassified actual column | `shop_column_unclassified:newShopifyFact` |
| classified-but-missing column | `shop_column_classified_missing:currencyCode` |
| overlap between UPDATE and SELECT-only | `shop_column_classification_overlap:processingEnabled` |
| duplicate classification | `shop_column_duplicate_classification:updatedAt` |
| does it ever emit a grant? | (none) — **no auto-grant** |

**Live disposable fixture.** A real column was added to `Shop` and the verifier re-run:

```
baseline                        : ok=True   errors=[]
with unclassified column present: ok=False  errors=['shop_column_unclassified:unclassifiedProbeColumn']
after dropping it               : ok=True   errors=[]
```

Neither `sync:roles:verify` nor a subsequent `sync:roles:provision --apply` granted the stray
column anything (`select=false update=false` both before and after provisioning). The guard
reports and fails closed; it never widens privilege.

**Effective privileges unchanged.** Measured column matrix on `Shop`:

| Columns | SELECT | UPDATE | INSERT | REFERENCES |
|---|---|---|---|---|
| 9 lifecycle columns (`id`, `myshopifyDomain`, `createdAt`, `updatedAt`, `processingEnabled`, `processingDisabledReason`, `processingDisabledAt`, `uninstalledAt`, `reinstalledAt`) | t | **t** | f | f |
| `ianaTimezone`, `currencyCode` | t | **f** | f | f |

`SELECT columns=11  UPDATE columns=9  total columns=11`, and table-level grants to
`stocky_control_plane` are `(none)` — column-level only, no broad table privilege.
`test:sync-uninstall` passes 8/8, so the uninstall/reinstall path still works.

**F-CLAUDE-PR6A-04 disposition: CORRECTED.**

---

## 8. Regression gate — first-review cleared items

Static (all confirmed unchanged in the correction delta, or across the whole PR where noted):

| Item | Evidence | Result |
|---|---|---|
| `deletionSource` = `WEBHOOK \| CONFIRMED_QUERY` encoding | enum unchanged | no regression |
| No Refund→Order FK | absent from every migration | no regression |
| Refund-shipping aggregate design | 9 aggregate column references; `ShopifyOrderShippingLineFact` count 0 | no regression |
| Selector / relation / models / legacy-scope / tenant-db | `app/tenant/**` unchanged in delta | no regression |
| Immutable lease design | `constants.ts`, foundation migration unchanged | no regression |
| Lock vectors | `lock-key.ts` and its test unchanged; PR5 `catalog-facts/**` untouched across the whole PR | no regression |
| Runtime DELETE = R-164 residual | `manifest.ts` / `roles.ts` unchanged in delta | not silently "fixed" |
| Scopes / flags | `shopify.app.toml`, `feature-flags.server.ts`, `.env.example` unchanged across the whole PR | no regression |

Live, on the rebuilt disposable database with the full enforcement pipeline applied
(`preflight ok merchantTableCount=35`; `apply`, `roles:verify`, `rls:verify`,
`immutability:verify`, `enforcement:verify`, `enforcement:drift`, `sync:roles:verify` all
`ok=true, issues=[]`):

| Probe | Result |
|---|---|
| Read with no tenant GUC | 0 rows (deny) |
| Read with `GUC=shopA` | only shopA rows |
| Foreign-tenant INSERT | `ERROR: new row violates row-level security policy` |
| Raw SQL `shopId` reassignment | `ERROR: stocky_tenant_key_immutable: shopId cannot be changed` |
| Runtime DELETE of own row | succeeds — R-164 residual intact, not silently changed |
| Runtime DELETE of foreign row | 0 rows affected; shopB row survives |
| Runtime DML on `DataIssue` | `ERROR: permission denied for table DataIssue` |
| Sequence `nextval` / `setval` | `nextval` works; `setval` `ERROR: permission denied for sequence` |
| PR5 catalog lock known-answer vectors | 5/5 pass, unchanged |

**No regressions. None of the first review's cleared adjudications were reopened, and no new
evidence contradicting them was found.**

### 8.1 Test integrity

No test was deleted, skipped or weakened. Counts increased in every touched suite:
PR6-A foundation 18 → **22**; order-facts unit 17 → **19**; sync-role-isolation 9 → **10**;
tenant-expansion migration 7 → **9**. The single removed `it(` block was renamed and
strengthened (`exposes refund-shipping snapshot types…` → `requires MoneyBagSides on
refund-shipping snapshots (null sides are not validated)`), retaining its original assertion that
`ShopifyOrderShippingLineFact` does not exist. The one fixture change removed only an
invalid seed (`'LIVE','LIVE_REFETCH'` with no generation columns) that the new constraint
legitimately makes unrepresentable, replacing it with a legal `LIVE_FULL_SYNC_PRESENT` shape —
disclosed in the implementation report §12.4 and confirmed here.

---

## 9. R-176 and the wider risk block

**R-176 remains OPEN at P0.** Its register row now reads: "**OPEN** — PR6-A representability
correction is implemented at `917080a3…` and pending independent confirmation. Do not close C/D
obligations. Severity remains P0."

This review confirms specifically that:

- the **PR6-A representability portion of R-176 is satisfied** — the five approved existence
  kinds are not merely representable as enum values, their impossible combinations are now
  unrepresentable at the database level on all eight canonical order fact tables, proven over the
  complete 960-combination cross product with zero divergence from an independent contract spec;
- **R-176 itself remains OPEN**, because PR6-C/D still own the window predicates, the
  application/transition protocol, scope-downgrade handling, two-confirmation terminal revival,
  and the webhook/import runtime. The P0 severity is unchanged and must not be lowered.

Other risks: R-166…R-185 remain exactly 20 entries, unique and contiguous, no collision with
R-165, all **OPEN**, with severities unchanged from approved §21.1 (R-176 P0; R-173, R-184,
R-185 P2; the remaining sixteen P1) and lane assignments unchanged. The correction modified only
the R-176 row.

---

## 10. Control / safety state

| Item | Recorded | Verified |
|---|---|---|
| PR6-A corrections implemented | `CORRECTIONS IMPLEMENTED / INDEPENDENT RE-REVIEW PENDING` | PASS |
| Independent re-review pending until this review concludes | stated in `PROJECT_STATUS.md` and the PR body | PASS |
| PR6-B / PR6-C / PR6-D | NOT AUTHORIZED | PASS |
| Phase 1 | IN PROGRESS | PASS |
| D-055 | **NOT CREATED** (D-054 remains the authority) | PASS |
| Production | NOT AUTHORIZED | PASS |
| Merchant production data | NOT AUTHORIZED; `productionDataInspected=false` | PASS |
| Shopify / inventory writes | NOT AUTHORIZED | PASS |
| Inventory-write flags, `FEATURE_PR5_ABSENCE_TOMBSTONE` | DEFAULT OFF | PASS |
| `read_all_orders` / `write_orders` | absent from `shopify.app.toml` (`scopes = "read_products,write_products,read_inventory,write_inventory,read_orders,read_locations"`) and from all tracked code | PASS |

The only `read_all_orders` / `write_orders` occurrences in the working tree are Shopify's own
doc comments inside `app/types/admin.types.d.ts`, which is gitignored, generated by
`graphql-codegen`, and absent from the PR (0 `app/types` paths changed).

---

## 11. Commands and tests executed

Disposable PostgreSQL **16.13** on `127.0.0.1:55432`, Node v22.22.2, npm 11.5.2, CI-equivalent
environment. **No production connection. No Shopify API call. No mutation of PR #37 or `main`.**

```
git fetch / rev-parse / merge-base --is-ancestor / rev-list --left-right --count / diff --name-status
npm ci                                                     970 packages
npx prisma generate / validate                             ok
npx prisma migrate deploy (fresh)                          all migrations applied
npx prisma migrate deploy (again)                          "No pending migrations to apply"
npm run tenant:indexes:apply --apply / tenant:schema:drift  drift_ok exitCode 0 (CI ordering)
npm run tenant:roles:provision / enforcement:preflight / apply   ok, merchantTableCount 35
npm run tenant:{roles,rls,immutability,enforcement}:verify + drift   all ok, issues []
npm run sync:roles:provision / sync:roles:verify           ok, errors []
npm run tenant:access:audit / :inventory:check             audit_ok / inventory fresh
npm run tenant:enforcement:inventory:check                 fresh
npm run sync:inventory:check                               ok surfaces=48
npm run test:migrations -- pr6-a-order-fact-foundation.test.ts    22 passed
npx vitest run app/lib/order-facts                          19 passed (3 files)
npx vitest run app/lib/catalog-facts/lock-key.test.ts       5 passed (PR5 regression)
npm run test:sync-role-isolation                            10 passed
npx vitest --config vitest.migrations.config.ts tenant-expansion.migration.test.ts   9 passed
npm run test:sync-uninstall                                 8 passed
npm run lint / typecheck / build / git diff --check         all clean
npm run graphql-codegen && npm test                         392 passed (42 files)
psql probes: 8-table constraint inventory + convalidated; OrderFactObservationInFlight exclusion;
  predicate-identity hash across 8 tables; 9-shape positive matrix × 8 tables (72 inserts);
  23-case negative INSERT matrix; 5-case negative UPDATE matrix with SQLSTATE;
  EXHAUSTIVE 960-combination cross product vs independent Python reference spec;
  6 parent-versioned child shapes; preservation-boundary P1/P2/P3; measured lock levels;
  control-plane Shop column matrix; live unclassified-column fixture; RLS/immutability/
  sequence/DataIssue regression probes
upgrade fixtures: valid-row digest before/after (identical); invalid-row P3018/23514 with
  rows untouched and zero constraints left behind
typecheck mutation: OptionalMoneyBagSides revert → TS2322 'true' not assignable to 'never'
```

---

## 12. Findings

**No new findings. P0 = 0 · P1 = 0 · P2 = 0 · P3 = 0.**

All four findings from the first review are corrected:

| ID | Severity | Disposition |
|---|---|---|
| F-CLAUDE-PR6A-01 | P2 | **CORRECTED** — eight validated coherence CHECKs; 960/960 exact match to an independent contract spec; INSERT and UPDATE both enforced |
| F-CLAUDE-PR6A-02 | P3 | **CORRECTED** — §6.3 matched literally (8 groups / 21 bags); required sides non-null and compile-time-proven |
| F-CLAUDE-PR6A-03 | P3 | **CORRECTED** — all 8 §8 codes covered, each in exactly one constant; `INACCESSIBLE_HISTORY_WINDOW` is an existenceKind only |
| F-CLAUDE-PR6A-04 | P3 | **CORRECTED** — four-way coverage guard, no auto-grant, privileges unchanged |

### 12.1 Residual observations (not findings)

1. **Row CHECK cannot enforce the transition protocol.** A row CHECK has no `OLD` access, so it
   cannot stop PR6-C from clearing a tombstone. Identical to the accepted PR5 constraint,
   explicitly documented in the migration header, and correctly assigned to PR6-C/D. The
   preservation behaviour it requires is achievable on existing columns with no new column.
2. **Not a lock-free migration.** Measured: `ADD CONSTRAINT … NOT VALID` takes ACCESS EXCLUSIVE,
   `VALIDATE` takes SHARE UPDATE EXCLUSIVE; inside Prisma's single transaction the split gives no
   online-DDL benefit. Bounded by `lock_timeout='5s'`; impact nil because the constrained tables
   ship empty in the same PR. The implementation report does not claim otherwise.
3. **Full-sync-derived child absence is intentionally not encodable as a tombstone**, forcing it
   through `absenceNominationState` per §8.8 — correct, and verified representable.

---

## 13. Control statements

- PR #37 was **not** modified, rebased, marked ready, or merged. Head remains
  `1f615c516ff4db927fb641bb96418dd217fe3a22`.
- `main` was **not** modified. `origin/main` remains `09feffd3f36eb4698f2ed8a152efe414cd9b77bd`.
- The immutable first-review artifact was **not** edited (blob
  `198e55548a2ca09942843798a9ebd3e03a30d0fa` unchanged). This commit adds only this file.
- PR6-B / PR6-C / PR6-D were **not** started and remain **NOT AUTHORIZED**.
- No production action, no deployment, no Shopify API call, no Shopify or inventory mutation.
  Feature flags remain **DEFAULT OFF**. All database work used a disposable local PostgreSQL
  16.13 instance containing no merchant data.

---

## 14. Verdict

The blocking P2 is genuinely fixed rather than papered over. The constraint is installed and
validated on exactly the eight canonical fact tables, excludes the observation table, is textually
identical across all eight, and — proven over the complete 960-combination cross product against
an independent reference implementation of the approved contract — admits exactly the nineteen
legal shapes and rejects everything else, on INSERT and UPDATE alike, with no SQL UNKNOWN leak.
The upgrade path preserves valid rows byte-identically and fails closed on an invalid one without
deleting, coercing or repairing it. The three P3s are each corrected with independent literal
test expectations, an effective compile-time proof, and a guard that reports without ever
widening privilege. No regression was found in anything the first review cleared, and R-176
correctly remains OPEN at P0 with its PR6-A representability half satisfied and its PR6-C/D
obligations intact.

**APPROVE PR6-A FOUNDATION CORRECTION**
