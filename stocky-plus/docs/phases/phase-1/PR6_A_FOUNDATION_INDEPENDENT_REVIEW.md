# Phase 1 PR6-A — Independent Tier-A Implementation Review (order / refund fact foundation)

**Immutable artifact.** Do not edit after commit. Later corrections belong in a new artifact.

Reviewer: independent adversarial Tier-A implementation review (Claude Code).
Review posture: verify by direct repository inspection and executed evidence. Cursor's
implementation report was read but is not accepted as proof of any claim.

---

## 1. Identity gate

| Item | Required | Independently observed | Result |
|---|---|---|---|
| Subject head reviewed | `5f8b2e764ce947d6e15edb7f85496bdcc5567161` | `5f8b2e764ce947d6e15edb7f85496bdcc5567161` | PASS |
| Base / current `origin/main` | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` | `09feffd3f36eb4698f2ed8a152efe414cd9b77bd` | PASS |
| PR #37 state | OPEN / DRAFT / UNMERGED | `state=open`, `draft=true`, `merged=false`, `mergeable_state=clean` | PASS |
| Merge base | exact main | `git merge-base` = `09feffd3f36…` | PASS |
| Ahead / behind | 4 / 0 | `git rev-list --left-right --count` = `0  4` | PASS |
| Changed files | 33 | `git diff --name-status 09feffd3…...5f8b2e76` = 33 | PASS |
| Commits | 4 | 4 (`ea5830b1`, `368e4645`, `0f482f66`, `5f8b2e76`) | PASS |
| Later push after exact-head CI | none | run created `02:24:26Z`; PR `updated_at` `02:24:24Z`; head unchanged | PASS |
| Production / deployment action | none | none taken; no production connection opened | PASS |

Note on procedure: the session clone's `origin/main` ref was initially stale at
`f98416913075…`. `git fetch origin main` advanced it to `09feffd3f36…`. All ahead/behind
and changed-file figures above are computed against the fetched exact base, not the stale ref.

### 1.1 Full changed-file list (33), verified independently

Split verified mechanically: `git diff --name-status 09feffd3f36…...5f8b2e76 | cut -f1 | sort | uniq -c`
→ **10 A** + **23 M** = **33**.

Added (10):
`app/lib/order-facts/advisory-lock.ts`, `constants.ts`, `foundation-safety.test.ts`,
`lock-key.test.ts`, `lock-key.ts`, `types.test.ts`, `types.ts`;
`docs/phases/phase-1/PR6_A_FOUNDATION_IMPLEMENTATION_REPORT.md`;
`prisma/migrations/20260907010000_pr6_a_order_refund_fact_foundation/migration.sql`;
`scripts/tenant-enforcement/tests/pr6-a-order-fact-foundation.test.ts`.

Modified (23): `app/tenant/__tests__/db-isolation/isolation.test.ts`,
`app/tenant/__tests__/tenant-db.test.ts`, `app/tenant/__tests__/top-level-unique-selectors.test.ts`,
`app/tenant/legacy-scope.ts`, `app/tenant/models.ts`, `app/tenant/relations.ts`,
`app/tenant/selectors.ts`, `app/tenant/tenant-db.server.ts`, `docs/DECISIONS.md`,
`docs/PROJECT_STATUS.md`, `docs/README.md`, `docs/RISK_REGISTER.md`,
`docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`,
`docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_INVENTORY.md`,
`docs/phases/phase-1/README.md`, `prisma/schema.prisma`,
`scripts/sync-control-plane/roles.ts`, `scripts/sync-control-plane/tests/sync-role-isolation.test.ts`,
`scripts/tenant-access/allowlist.ts`, `scripts/tenant-access/architecture-audit.test.ts`,
`scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts`,
`scripts/tenant-enforcement/manifest.ts`, `scripts/tenant-enforcement/roles.ts`.

Scope verdict: **no PR6-B/C/D functionality leaked into A.** No Admin reader, no applicator,
no webhook/import runtime, no GraphQL production document, no `app/types/**`, no
`shopify.app.toml` change, no scope change, no feature-flag change (`.env.example` and
`app/lib/feature-flags.server.ts` are byte-identical to base).

---

## 2. Exact-head CI gate

Run `34076176876`, event `pull_request`, head `5f8b2e764ce947d6e15edb7f85496bdcc5567161`,
conclusion **success**.

| Job | Id | Conclusion |
|---|---|---|
| Classify change set | `101602624958` | SUCCESS |
| Lint, typecheck, test, build, Prisma, GraphQL (Heavy) | `101602650259` | SUCCESS |
| CI Gate | `101611637464` | SUCCESS |

Heavy was inspected **step by step** (146 numbered steps, all `success`, none `skipped`),
not accepted on its run conclusion. Steps confirming the required matrix actually executed:
Generate Prisma client (8), Validate Prisma schema (9), Apply migrations (10), Compatibility
index apply/verify (11–12), Prisma schema drift check (13), Tenant enforcement inventory
freshness (15), role provisioning (16), preflight (17), apply (18), role verification (19),
RLS policy verification (20), immutability verification (21), composite constraint
verification (22), enforcement drift (23), pooled-connection isolation (24), tenant access
architecture audit (50), tenant access inventory freshness (51), exact privilege allowlist
(34), exact privilege complete-matrix (35), sequence privilege (36), Git diff check (126),
Lint (127), Typecheck (128), GraphQL codegen / schema validation (129), Unit tests (141),
Migration and tenant-backfill tests (142), Build (146).

The new PR6-A PostgreSQL suite is genuinely wired into CI: `vitest.migrations.config.ts`
includes `scripts/tenant-enforcement/tests/**/*.test.ts`, which step 142 executes; the
`app/lib/order-facts/*.test.ts` files are covered by step 141 via `vitest.config.ts`
(`app/**/*.test.ts`).

**Verdict: exact-head CI gate PASS.**

### 2.1 Superseded failure adjudication

| Run | Head | Failing job / step | Root cause | Fix |
|---|---|---|---|---|
| `34074356984` | `368e4645` | Heavy step 55 "Sync control-plane integration tests" | PR6-A added two `Shop` columns. The control-plane role holds **column-level** SELECT on the nine lifecycle columns only, so Prisma's `UPDATE … RETURNING *` on the uninstall path hit `42501 permission denied for table Shop`. | `0f482f66` adds `CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS` (SELECT only) plus a negative verifier assertion that UPDATE stays denied. |
| `34075969689` | `0f482f66` | `tenant:access:inventory:check` | The grant edit shifted line numbers in `roles.ts`, stale-dating `PR2_TENANT_ACCESS_INVENTORY.md`. | `5f8b2e76` regenerates the inventory (1734 findings, 0 violations). |

**Root-cause reproduction (executed, this review):** on a disposable PostgreSQL 16.13 with the
full enforcement pipeline applied, revoking `SELECT ("ianaTimezone","currencyCode")` from
`stocky_control_plane` reproduced the original failure exactly — 7 of 8
`app/sync/__tests__/sync-uninstall.test.ts` tests failed with
`PostgresError { code: "42501", message: "permission denied for table Shop" }`. Restoring the
grant returned the suite to 8/8 pass.

Both corrections address root cause at the correct layer. The Shop-grant fix is the minimal
privilege that unblocks `RETURNING *` while preserving the boundary (it does **not** widen to a
table-level grant and does **not** add UPDATE). **Not** a green-washing patch.

---

## 3. Model inventory and DIRECT/CHILD counts

Derived from **four independent sources**, not one constant:

1. `prisma/schema.prisma` — 9 new models with `shopId` + `shop` relation.
2. `migration.sql` — exactly 9 `CREATE TABLE` statements.
3. `scripts/tenant-enforcement/manifest.ts` — regex extraction of merchant specs yields
   DIRECT 24 / CHILD 11 / total 35.
4. Live database after `prisma migrate deploy` + enforcement apply — 9 new tables classified
   `merchant_domain`; `tenant:enforcement:preflight` reported `merchantTableCount 35`;
   `tenant:access:audit` reported `tenant_access_audit_ok` over 35 models.

| Expected | Observed | Result |
|---|---|---|
| DIRECT: `ShopifyOrderFact`, `ShopifyOrderLineFact`, `ShopifyOrderRefundFact`, `OrderFactObservationInFlight` | exactly these 4 | PASS |
| CHILD: `ShopifyOrderRefundLineFact`, `ShopifyOrderAdjustmentFact`, `ShopifyOrderAgreementFact`, `ShopifyOrderAgreementSaleFact`, `ShopifyOrderRefundTransactionFact` | exactly these 5 | PASS |
| DIRECT total 24 / CHILD total 11 / merchant-owned 35 | 24 / 11 / 35 | PASS |
| `ShopifyOrderShippingLineFact` absent | absent from schema, migration, manifest, models | PASS |
| No silent tenth PR6-A merchant model | none | PASS |

**Nine-model inventory verdict: PASS.**

---

## 4. Canonical schema fidelity (plan §§2, 5, 6)

Every implemented model, column, enum and index was compared line-by-line against the approved
plan. Confirmed correct:

**`ShopifyOrderFact`** — `@@unique([shopId, shopifyGid])`; Clock A `shopifyUpdatedAt`;
`processedAt` `Timestamptz(3)` **plus** raw `processedAtShopify VarChar(64)` with a CHECK
enforcing the pair; cancellation/status/test/currency fields per §5.2; all seven §6.3 required
order money bags plus the four optional bags, each with both shop and presentment sides;
`accessScopeSnapshot String[]`; full existence/tombstone lineage column set; **no customer PII**.

**`ShopifyOrderLineFact`** — DIRECT despite parent-versioning (§5.3); composite FK
`(shopId, shopifyOrderGid) → ShopifyOrderFact(shopId, shopifyGid)` including `shopId`;
`variantGidAtSale` / `productGidAtSale` historical identities and `currentVariantGid` /
`currentProductGid` nullable current identities; **no FK to `ShopifyVariantFact`** (R-171);
denormalized `orderProcessedAt` / `orderCancelledAt` / `orderTest` / `orderShopCurrencyCode`;
required index `@@index([shopId, variantGidAtSale, orderProcessedAt])` present and created.

**`ShopifyOrderRefundFact`** — DIRECT; independent Refund Clock A; `shopifyCreatedAt` nullable
per §5.4 ("`Refund.createdAt` is nullable. Persist null; never coerce"); `processedAt`
timestamptz paired with raw string under a CHECK; parent order lineage as an indexed
`shopifyOrderGid` column; `totalRefundedSet` bag; refund-shipping money as columns (§5.7).

**`ShopifyOrderRefundLineFact`** — ordinal composite identity exactly
`@@unique([shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal])`; `shopifyGid`
nullable lineage only; `CHECK ("refundLineOrdinal" >= 0)`; composite parent FK to the refund;
required bags `subtotalSet` / `totalTaxSet` / `priceSet` all present (R-180).

**`ShopifyOrderAgreementSaleFact`** — identity is `@@unique([shopId, shopifyGid])` where
`shopifyGid = Sale.id`, **not** an agreement-derived synthetic key; `shopifyAgreementGid` is a
required composite FK/lineage, not a second unique; `quantity` is nullable signed `Int`;
denormalized `happenedAt` with `@@index([shopId, happenedAt])` per §5.6.

Adjustment, agreement and refund-transaction facts match §§5.5–5.6 identities, nullability,
lineage, indexes and tenant-composite FKs. All six new composite FKs are registered in
`COMPOSITE_FOREIGN_KEYS` and verified live (`tenant:enforcement:verify` → `ok:true, issues:[]`;
preflight `compositeFkCount 19`).

**Schema fidelity verdict: PASS** (with the existence-constraint gap raised separately as
F-CLAUDE-PR6A-01, which concerns constraints rather than column fidelity).

---

## 5. Candidate finding adjudications

### 5.1 Candidate A — `deletionSource` literal — **NOT A FINDING**

PO-01 and §8.12 freeze the out-of-window delete lineage as
`existenceKind = ABSENT_SIGNALLED_DELETE_UNVERIFIED`, `deletionSource = DELETE_WEBHOOK`.
The subject defines `OrderDeletionSource = WEBHOOK | CONFIRMED_QUERY` while `OrderSourceKind`
separately carries `DELETE_WEBHOOK`.

Decisive evidence: the **accepted PR5 sibling** is
`enum CatalogDeletionSource { WEBHOOK, CONFIRMED_QUERY, DISCONNECT }`
(`prisma/schema.prisma:1119`). §5.1 instructs "Copy the PR 5 fact pattern." `WEBHOOK` is
therefore the sibling-consistent implementation encoding of the approved lineage, with the
`DISCONNECT` member correctly omitted as catalog-specific.

No information is lost and no downstream translation is forced. The frozen state is carried
without ambiguity by the triple
`(existenceKind = ABSENT_SIGNALLED_DELETE_UNVERIFIED, deletionSource = WEBHOOK,
sourceKind = DELETE_WEBHOOK)`; the order domain has exactly one webhook that yields deletion
lineage. Critically, `app/lib/order-facts/types.ts` exports
`ORDER_DELETION_SOURCES = ["WEBHOOK", "CONFIRMED_QUERY"]`, so PR6-B/C/D consume **one**
literal set from the frozen contract — there is no incompatible-literal translation to write.

This is an acceptable implementation-level encoding, not contract drift. No correction required.

### 5.2 Candidate B — selector inventory test independence — **NOT A FINDING**

`top-level-unique-selectors.test.ts` now compares `Object.keys(MODEL_UNIQUE_SELECTORS)` against
`MERCHANT_OWNED_MODELS` instead of a hand-written literal. The concern that both sides derive
from one source is real but does not materially weaken the drift guard, for two reasons.

First, `MODEL_UNIQUE_SELECTORS` is a hand-written `Record<MerchantOwnedModel, …>` in a separate
file, so a model added to `models.ts` without a selector still fails (at compile time and at
runtime).

Second — and decisively — **independent numeric tripwires were verified empirically.** Injecting
a fake tenth PR6-A merchant model (`ShopifyOrderShippingLineFact`) into *both*
`PR6_A_CHILD_MERCHANT_MODELS` and `MERCHANT_DELEGATE_NAMES` (the worst case for this concern)
produced an immediate failure:

```
× PR6-A order / refund fact foundation > derives DIRECT/CHILD/merchant inventories …
  → expected [ Array(6) ] to have a length of 5 but got 6
```

`pr6-a-order-fact-foundation.test.ts` pins literal `toHaveLength(4)`, `(5)`, `(24)`, `(11)`,
`(35)`, asserts `expect(names).not.toContain("ShopifyOrderShippingLineFact")`, and
`manifest.assertMerchantTableCount()` independently pins `EXPECTED_MERCHANT_TABLE_COUNT`.
`tenant:access:inventory:check` and `tenant:enforcement:inventory:check` add two more
document-freshness gates. The mutation was reverted; the working tree was confirmed identical
to the subject head afterwards.

Independent protection remains adequate. Recorded, not raised.

### 5.3 Candidate C — refund-shipping aggregate representation — **NOT A FINDING**

§5.7 explicitly authorises either shape: refund shipping lines "persist as **columns**/child of
refund snapshot; not deferred." The subject persists
`refundShippingLineCount`, `refundShippingSubtotal{Shop,Presentment}{Amount,CurrencyCode}` and
`refundShippingTax{Shop,Presentment}{Amount,CurrencyCode}` on `ShopifyOrderRefundFact`.

Each challenge was tested against the frozen contract rather than waived:

- **Sufficiency for §6.6.** The frozen refund money-reconciliation identity consumes
  `Σ RefundShippingLine.subtotalAmountSet.shopMoney` and
  `Σ RefundShippingLine.taxAmountSet.shopMoney` — **sums**, which are exactly what the two
  aggregate columns store. The identity is fully evaluable from the persisted columns.
- **Per-line identity loss.** No frozen contract requires a `RefundShippingLine` identity.
  §5.4 assigns identities to Refund, RefundLineItem (ordinal composite), OrderAdjustment and
  OrderTransaction only; refund shipping lines are deliberately not among them.
- **Currency mismatch across multiple shipping lines.** Refund-shipping bags are **required**
  (§6.3), and §6.2 mandates fail-apply of the whole resource snapshot on a required-bag
  currency mismatch. That check is per-line, in the PR6-C mapper, on the raw response, before
  any aggregation. The schema's single currency column per aggregate makes the mismatched state
  *unrepresentable*, which forces the fail-apply rather than obscuring it.
- **Invalid required bag hidden by aggregation.** A required-bag parse failure fails the apply,
  so no refund row is written at all. A written row therefore always means every required bag
  parsed. The two outcomes are distinguishable, and the §5.8 observation record carries the
  durable failure evidence.
- **Reproduction / reconciliation of Shopify values.** `refundShippingLineCount` distinguishes
  "no shipping lines" from "lines summing to zero", and the aggregates reproduce every term
  §6.6 needs. Byte-level per-line reproduction is not required by any approved contract.

The approved contract is genuinely satisfied by the aggregates. No new table is warranted.
Carry-forward for PR6-C: the per-line required-bag parse and currency check must occur **before**
summation, and T49 must cover a multi-shipping-line refund.

### 5.4 Candidate D — Refund → Order relational integrity — **NOT A FINDING**

The absence of a Refund→Order FK is **correct and necessary**, and the DIRECT classification is
not the load-bearing reason (PR5 precedent shows DIRECT→DIRECT composite FKs are permitted:
`ShopifyInventoryLevelFact` carries composite FKs to both `ShopifyInventoryItemFact` and
`ShopifyLocationFact`).

The load-bearing reason is the rolling-history window. Refund is DIRECT with its **own**
independent Clock A, "bound independently of the order gate" (§5.1). `refunds/create` can fire
for an order aged outside the default 60-day accessible window that therefore has no local
`ShopifyOrderFact` row. §8.6–8.7 require such orders to be retained and never tombstoned from
window inaccessibility, and R-176 (P0) exists precisely to prevent window-driven history loss.
A required composite FK would make that refund **unstorable**, discarding authoritative refund
money — a P0-class regression against R-176/R-178.

Reproduced on live PostgreSQL:

```
D1  INSERT ShopifyOrderRefundFact  shopifyOrderGid='gid://shopify/Order/NEVER_IMPORTED'
    → ACCEPTED  (refund retained though parent order absent/out-of-window)
D2  INSERT ShopifyOrderLineFact    shopifyOrderGid='gid://shopify/Order/NEVER_IMPORTED'
    → ERROR: violates "ShopifyOrderLineFact_shopId_shopifyOrderGid_fkey"
```

The asymmetry is exactly the frozen contract: lines are parent-versioned, and §5.1 makes an
order snapshot apply their only legal writer, so their parent always exists. `shopifyOrderGid`
remains indexed lineage on the refund (`@@index([shopId, shopifyOrderGid])`) per §5.4. The same
reasoning validates adjustment/transaction FKs pointing at the **refund** (their snapshot
writer) rather than the order.

---

## 6. Existence / tombstone invariants — **FINDING F-CLAUDE-PR6A-01 (P2)**

**Finding ID:** F-CLAUDE-PR6A-01
**Severity:** **P2**
**Files:** `prisma/migrations/20260907010000_pr6_a_order_refund_fact_foundation/migration.sql`
lines 766–780 (the only fact-table CHECKs added); `prisma/schema.prisma` — all eight canonical
order fact models.

**Evidence.** PR5 installs an `existence_evidence_coherence_check` on **every** canonical
catalog fact table. Verified live:

```
existence coherence CHECK present on: ShopifyInventoryItemFact, ShopifyInventoryLevelFact,
                                     ShopifyLocationFact, ShopifyProductFact, ShopifyVariantFact
existence coherence CHECK present on: (none of the 8 canonical order fact tables)
```

The only CHECKs PR6-A adds to canonical order facts are `shopId IS NOT NULL`, the two
`processed_at_pair` checks and the refund-line ordinal check. The result is a reproduced
asymmetry — the *same* contradictions are rejected in the catalog domain and accepted in the
order domain:

| Probe | `ShopifyOrderFact` (PR6-A) | `ShopifyProductFact` (PR5) |
|---|---|---|
| `existenceState=LIVE` + `existenceKind=ABSENT_CONFIRMED_QUERY` + `deletedAt` set | **ACCEPTED** | rejected by CHECK |
| `existenceKind=LIVE_REFETCH` + `deletedAt`/`deletionSource` set (tombstoned yet live) | **ACCEPTED** | rejected by CHECK |
| `deletedAt` set with `deletionSource` NULL (incomplete deletion lineage) | **ACCEPTED** | n/a |
| `existenceKind=INACCESSIBLE_HISTORY_WINDOW` with `deletedAt` set | **ACCEPTED** | n/a |
| `ABSENT_CONFIRMED_QUERY` with **no** generation evidence (both gens NULL) | **ACCEPTED** | rejected by CHECK |
| stale evidence `existenceRequestGen(999) > existenceResponseGen(1)` | **ACCEPTED** | rejected by CHECK |

Six impossible states were inserted successfully into `ShopifyOrderFact`; four identical
contradictions were rejected outright by `ShopifyProductFact_existence_evidence_coherence_check`.

**Merchant impact.** R-176 is the register's only **P0** in this block and is assigned lane
"**PR6-A (representability)** then PR6-C / PR6-D". PR6-A represents the five existence kinds as
enum values but constrains **none** of their combinations. §8.5 states explicitly that the
`INACCESSIBLE_HISTORY_WINDOW` path must "**not** set `deletedAt`"; the database will accept
exactly that row. §8.6 requires generation evidence for `ABSENT_CONFIRMED_QUERY`; the database
will accept a tombstone with none. If any PR6-C apply path has a defect on these branches, order
history is silently mis-tombstoned with no database backstop — the precise failure mode PR5
installed this constraint to prevent, and the one that propagates into Phase 2 demand, velocity
and ABC.

**Reproduction.** Disposable PostgreSQL 16.13; `prisma migrate deploy`; full enforcement applied;
insert the six rows above as owner into `ShopifyOrderFact`; then attempt the four catalog
equivalents against `ShopifyProductFact`.

**Expected behaviour.** Impossible existence/deletion combinations are unrepresentable at the
database level for order-domain canonical facts, as they already are for catalog-domain facts.

**Recommended correction.** Add an order-domain `existence_evidence_coherence_check` to each of
the eight canonical order fact tables in **this** PR, covering all five existence kinds — the two
PR5 LIVE branches, `ABSENT_CONFIRMED_QUERY` (ABSENT + both gens + `requestGen < responseGen` +
`deletedAt`/`deletionSource` NOT NULL), `INACCESSIBLE_HISTORY_WINDOW` (`deletedAt` and
`deletionSource` **NULL**; previous `existenceState` preserved), and
`ABSENT_SIGNALLED_DELETE_UNVERIFIED` (ABSENT + `deletedAt` NOT NULL +
`deletionSource = 'WEBHOOK'`). Adding these now is instant and lock-free because all nine tables
are empty; after any B/C/D writer exists the same change requires a validating scan.

If some combinations are **intentionally** deferred to PR6-C application-layer validation, that
is a legitimate engineering choice — but it must be recorded as an explicit, evidence-based
decision. It is currently recorded nowhere: the string "coherence" appears in neither the
approved plan, nor any of the three immutable planning reviews, nor the implementation report.
§5.1's instruction is "Copy the PR 5 fact pattern," and this part of the pattern was dropped
silently.

**Missing test.** Negative fixtures in `pr6-a-order-fact-foundation.test.ts` asserting each
impossible combination above is rejected, mirroring the PR5 coherence tests.

**Note on severity.** This is P2 rather than P1 because no writer exists yet (PR6-B/C/D are not
authorized, tables are empty, production is not authorized), so no merchant data can currently be
corrupted; and P2 rather than P3 because it is a silent regression from an accepted safety
control in the exact Tier-A area under review, and the remediation window closes as soon as rows
exist.

---

## 7. Runtime DELETE privileges — acceptable inherited residual

Reproduced, not inferred. The exact runtime matrix on all nine new tables is
`DELETE, INSERT, SELECT, UPDATE` — identical to all 26 pre-existing merchant tables
(`expectedRuntimePrivileges: DML` in the manifest). Tenant-scoped DELETE capability was executed:

```
GUC=shopA:  DELETE FROM "ShopifyOrderLineFact" WHERE id='lnA'  → row deleted
GUC=shopA:  DELETE FROM "ShopifyOrderFact"     WHERE id='ofB'  → 0 rows; shopB row survived
```

This is RLS-scoped DELETE, not absence of DELETE capability — the distinction the brief warns
against conflating is preserved here: the runtime **can** physically delete its own tenant's
canonical facts.

Verdict: **acceptable inherited nonblocking architecture**, not a new PR6-specific risk and not a
blocker. It is the existing PR5 **R-164** accepted residual extended consistently to the order
domain; narrowing it for order facts alone would diverge from the platform-wide grant model that
`exact-privilege-complete-matrix` pins. The tombstone-only contract remains an
applicator-layer obligation (§8.11 "Do not physically DELETE canonical facts on ordinary apply
(R-164 analog)"), unchanged by PR6-A. No new finding; R-164 remains the correct home.

---

## 8. Observation lifecycle and the lease-update challenge

All behaviour executed against live PostgreSQL:

| Requirement | Observed | Result |
|---|---|---|
| Separate table (no catalog reuse) | `OrderFactObservationInFlight` distinct from `CatalogObservationInFlight` | PASS |
| `ACTIVE ⇒ responseGen NULL`; `COMPLETED ⇒ responseGen NOT NULL` | both violations rejected by `…_lifecycle_response_gen_check` | PASS |
| Identity-shape CHECK | Order-kind row carrying `shopifyRefundGid` rejected; `RefundLine` without ordinal rejected | PASS |
| Lease duration bound | `0` and `3600001` both rejected (`order_observation_lease_duration_invalid`), by CHECK **and** trigger | PASS |
| DB-computed lease expiry | inserted with `leaseExpiresAt='1970-01-01'`; stored value was `now()+60s` from `clock_timestamp()` | PASS |
| Terminal-state transition safety | `COMPLETED→ABANDONED` and `COMPLETED→ACTIVE` both rejected (`order_observation_terminal_transition_forbidden`) | PASS |
| Abandoned state semantics | `ABANDONED` branch permitted with either gen state, matching PR5 | PASS |
| Request/response generations | `observationRequestGen BigInt` / `observationResponseGen BigInt?` | PASS |
| Access-scope snapshot | `accessScopeSnapshot String[]` present | PASS |
| Durable failure fields | `terminalOutcome`, `failureCode`, `failureDetail` present; `SNAPSHOT_PAGINATION_INCOMPLETE` in constants and types | PASS |
| No Shop generation counter | none added | PASS |
| No second sequence | live DB contains exactly one sequence, `stocky_catalog_observation_gen_seq` | PASS |

**Lease-update challenge — resolved, no finding.** The `UPDATE` branch of
`stocky_order_observation_set_lease()` does restore `OLD."leaseDurationMs"` and
`OLD."leaseExpiresAt"`, making leases immutable after insert. Reproduced: an explicit renewal
`UPDATE … SET leaseDurationMs=3600000, leaseExpiresAt=now()+'1 hour'` left both columns at their
original values.

This is **byte-for-byte the accepted PR5 contract** — `stocky_catalog_observation_set_lease()`
(`20260816193000_pr5_catalog_fact_foundation/migration.sql:744-776`) has the identical body with
only the domain name changed. Decisively, the merged PR5 runtime already implements the frozen
observation lifecycle under this exact trigger:
`app/lib/catalog-facts/ingest/direct-observation.ts` creates a **new** per-attempt observation
row with a freshly allocated generation for each attempt, and terminates rows via a fenced
`updateMany` to `ABANDONED` that never touches lease columns. Recovery is therefore
create/reclaim, not renewal — and the trigger permits it.

PR6-B/C/D can implement the frozen lifecycle without changing A's schema or trigger contract.
No finding. (Observation only: the restore is silent rather than raising, so a caller attempting
renewal receives no signal — an inherited characteristic of the accepted PR5 contract, not a
PR6-A regression.)

---

## 9. Generation sequence privileges

Executed as `stocky_runtime` against the live sequence:

```
has_sequence_privilege USAGE  = t
has_sequence_privilege SELECT = f
has_sequence_privilege UPDATE = f
SELECT nextval(…)                     → 1                  (works)
SELECT setval(…, 1)                   → ERROR: permission denied for sequence
SELECT last_value FROM …              → ERROR: permission denied for sequence
relacl = {stocky=rwU/stocky, stocky_control_plane=U/stocky, stocky_runtime=U/stocky}
owner  = stocky   (runtime does not own it)
```

USAGE only; SELECT false; UPDATE false; no ownership; `setval` unavailable; **no PUBLIC entry**;
no schema-wide broad grant (`exact-privilege-complete-matrix` PUBLIC future-sequence/table/function
default tests all pass). Exactly one sequence exists in `public`, so PR6-A created no second
sequence and did not alter PR5's known-good semantics.

**Verdict: PASS.**

---

## 10. Tenant / RLS enforcement — reproduced on PostgreSQL

Full pipeline executed on a disposable PostgreSQL 16.13 cluster reproducing the CI environment:
`prisma migrate deploy` → `tenant:indexes:apply/verify` → `tenant:schema:drift` →
`tenant:roles:provision` → `preflight` → `apply` → all verifiers.

```
tenant_roles_provision        ok:true
tenant_enforcement_preflight  ok:true   merchantTableCount:35   failing tables: []
tenant_enforcement_apply      ok:true
tenant_roles_verify           ok:true   rolsuper:false  rolbypassrls:false  actualTableOwner:stocky
tenant_rls_verify             ok:true   issues:[]
tenant_immutability_verify    ok:true   issues:[]
tenant_enforcement_verify     ok:true   issues:[]
tenant_enforcement_drift      ok:true   issues:[]
tenant_access_audit_ok
```

All nine new tables: `relrowsecurity=t`, `relforcerowsecurity=t`, 4 policies each, owner `stocky`
(not runtime), `shopId` `NOT NULL` in `information_schema`, and a
`trg_<Table>_shopId_immutable → stocky_prevent_shop_id_mutation` trigger.

Live probes executed as `stocky_runtime`:

| Probe | Result |
|---|---|
| Read with **no** tenant GUC | 0 rows returned (deny) |
| Read with `GUC=shopA` | only shopA rows |
| Read shopB row by primary key under `GUC=shopA` | 0 rows |
| INSERT with foreign `shopId='shopB'` under `GUC=shopA` | `ERROR: new row violates row-level security policy` |
| Raw SQL `UPDATE … SET "shopId"='shopB'` | `ERROR: stocky_tenant_key_immutable: shopId cannot be changed` |
| Cross-shop composite parent FK | `ERROR: violates foreign key constraint "ShopifyOrderLineFact_shopId_shopifyOrderGid_fkey"` |
| Runtime table ownership | owner is `stocky`; runtime owns nothing |
| Runtime `BYPASSRLS` | `rolbypassrls: false` |
| Runtime DML on `DataIssue` | `ERROR: permission denied for table DataIssue` (even SELECT denied) |
| PUBLIC / control-plane grants on the 9 tables | none (0 rows) |

Repository suites re-executed: `pr6-a-order-fact-foundation.test.ts` 18/18;
`db-isolation/isolation.test.ts` 14/14; `tenant-db.test.ts` + `top-level-unique-selectors.test.ts`
24/24; `exact-privilege-complete-matrix` 27/27; `sequence-privilege` + `exact-privilege-allowlist`
+ `tenant-expansion.migration` 11/11; `architecture-audit` 25/25.

**RLS / immutability verdict: PASS. Cross-shop isolation verdict: PASS.**

---

## 11. Control-plane Shop grants

Exact column privilege matrix reproduced on the live database:

| Shop column | control-plane SELECT | control-plane UPDATE | INSERT |
|---|---|---|---|
| `id`, `myshopifyDomain`, `createdAt`, `updatedAt`, `processingEnabled`, `processingDisabledReason`, `processingDisabledAt`, `uninstalledAt`, `reinstalledAt` | **t** | **t** | f |
| `ianaTimezone` | **t** | **f** | f |
| `currencyCode` | **t** | **f** | f |

`information_schema.table_privileges` for `Shop` lists only `stocky` and `stocky_runtime` — the
control-plane holds **column-level grants only**, with no broad table SELECT or UPDATE. The
provisioner issues `REVOKE ALL ON TABLE "Shop"` before re-granting, and `verifyControlPlaneRole`
now asserts both directions, including the negative `control_plane_shop_update_forbidden:<col>`.

Genuinely required: reproduced above (§2.1) — revoking these two SELECTs reproduces
`42501 permission denied for table Shop` on Prisma's `UPDATE … RETURNING *` uninstall path.
Visibility is not broadened beyond two non-sensitive Shopify-authoritative shop facts; session
and token tables remain fully revoked; the nine lifecycle columns are byte-identical to base.

**Verdict: PASS.** One P3 hardening item is raised at §14 (F-CLAUDE-PR6A-04).

---

## 12. Tenant selector / relation machinery — no regression

- `models.ts` — the nine new models are appended via named `PR6_A_*` constants; the pre-existing
  20 DIRECT / 6 CHILD entries are untouched, and `PRE_PR6_A_*` constants make the arithmetic
  auditable.
- `selectors.ts` — every new model receives `id`, `shopId_id`, and its tenant-leading compound
  identity, matching the Prisma `@@unique` declarations exactly, including the refund-line
  ordinal composite. Every compound is `shopId`-leading; **no client-supplied shop authority** is
  introduced.
- `relations.ts` — twelve new entries covering all six parent/child edges in both directions,
  with correct `parent_fk` / `child_collection` lineage and foreign keys. Correctly, no
  Refund→Order relation is declared (§5.4).
- `legacy-scope.ts` — the four new DIRECT models are added to `DIRECT_TABLE` and
  `DIRECT_NO_LEGACY_SHOP` (none has a legacy `shop` text column); the existing 20 are unchanged.
- `tenant-db.server.ts` — type-only addition of nine `TenantModelDelegate` members. No merchant
  delegate escapes `TenantDb`; `tenant_access_audit_ok` over 35 models with 0 violations.
- Nested-write ownership and top-level unique-selector enforcement still fail closed
  (`tenant-db.test.ts` 17/17, `top-level-unique-selectors.test.ts` 7/7, `architecture-audit`
  25/25, `isolation.test.ts` 14/14).

**Verdict: PASS — no regression to the existing 26 merchant models.**

---

## 13. Migration safety

| Requirement | Observed | Result |
|---|---|---|
| Additive only | 9 `CREATE TABLE`, 8 `CREATE TYPE`, 2 `ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS`, indexes, FKs, CHECKs, 2 functions + triggers | PASS |
| Prior migrations unchanged | `git diff --name-status` over `prisma/migrations/` shows exactly one added directory | PASS |
| No destructive data migration | no `DROP TABLE`/`DROP COLUMN`/`TRUNCATE`/`DELETE FROM`/`ALTER COLUMN`; only `DROP TRIGGER IF EXISTS` immediately preceding creation on the new table | PASS |
| No production DML | no `INSERT`/`UPDATE` statements | PASS |
| No second sequence | `grep -c "CREATE SEQUENCE"` = 0 | PASS |
| Shop ALTER timeout behaviour | `SET lock_timeout='5s'` / `statement_timeout='15s'` around the ALTERs, then `RESET` (D-024) | PASS |
| Transaction safety | no `CONCURRENTLY`, so Prisma applies the file in a single transaction | PASS |
| Rollback / recovery notes | header documents leave-unused, emergency DROP preconditions, forward-recovery preference | PASS |
| Empty-new-table indexes | all indexes are on tables created in the same migration | PASS |
| Locked function `search_path` | both functions `proconfig={"search_path=pg_catalog, pg_temp"}`, `prosecdef=false` | PASS |
| PUBLIC EXECUTE / grants | `REVOKE ALL … FROM PUBLIC`; live `proacl={stocky=X/stocky}` — no PUBLIC, no runtime EXECUTE | PASS |
| Triggers on intended table | both on `OrderFactObservationInFlight` | PASS |
| Composite FKs match Prisma | all six present live and registered in `COMPOSITE_FOREIGN_KEYS`; `tenant:enforcement:verify` clean | PASS |
| Prisma schema and SQL agree | `tenant:schema:drift` → `tenant_prisma_schema_drift_ok, exitCode:0` | PASS |

**`IF NOT EXISTS` adjudication.** The concern is legitimate and was tested rather than assumed.
On a database where `Shop."ianaTimezone"` was pre-created as `VARCHAR(8)`, the migration applied
successfully and **silently retained the wrong length** — a value like `America/Los_Angeles`
would later fail to insert.

However, this is **not reachable in any supported migration path**: no prior migration contains
an `ALTER TABLE "Shop"` (the `currencyCode VARCHAR(8)` at
`20260816193000_pr5_catalog_fact_foundation/migration.sql:127` is a different table's column), so
in both supported paths — fresh database, or existing database at a prior migration — the columns
cannot pre-exist. The only route is out-of-band manual DDL, and that is caught by a mandatory CI
gate: running `tenant:schema:drift` against the poisoned database failed closed with
`Prisma schema drift detected: live database does not match prisma/schema.prisma`.

Acceptable. `IF NOT EXISTS` is the repository's low-lock D-024 convention, and type divergence is
independently gated. Recorded as an observation, not a finding.

**Verdict: PASS.**

---

## 14. Additional findings

### F-CLAUDE-PR6A-02 (P3) — frozen required-money-bag contract is incomplete

**File:** `app/lib/order-facts/types.ts` (`ORDER_REQUIRED_MONEY_BAGS`, `MoneyBagSides`,
`RefundShippingLineSnapshot`).

**Evidence.** §6.3 freezes required bags for **eight** resource groups: Order, Line, Refund,
Refund line, Refund shipping line, Order adjustment, Sale, Order transaction.
`ORDER_REQUIRED_MONEY_BAGS` carries **three** (`order`, `line`, `refundLine`) — Refund
(`totalRefundedSet`), Refund shipping line (`subtotalAmountSet`, `taxAmountSet`), Order
adjustment (`amountSet`, `taxAmountSet`), Sale (`totalAmount`) and Order transaction
(`amountSet`) are all absent. By contrast `ORDER_OPTIONAL_MONEY_BAGS` matches §6.3 exactly.
Separately, `MoneyBagSides` (the non-null variant) has **zero usages**, and the sole
instantiation — `RefundShippingLineSnapshot` — types two §6.3-**required** bags with
`OptionalMoneyBagSides`. No test pins either constant to the §6.3 table.

**Merchant impact.** PR6-C may implement fail-apply from a partial constant that reads as
authoritative, silently treating a required money bag as optional; or must edit A's "frozen"
cross-lane file after A merges, which is what the file exists to prevent. Nothing listed is
*mis*classified, so this is incompleteness rather than incorrectness, and the authoritative
source (§6.3) remains frozen and unambiguous.

**Recommended correction.** Complete `ORDER_REQUIRED_MONEY_BAGS` against §6.3; use
`MoneyBagSides` for required bags in `RefundShippingLineSnapshot`.
**Missing test.** A test pinning both constants to the §6.3 table.

### F-CLAUDE-PR6A-03 (P3) — diagnostic-code constants incomplete and one misclassified

**File:** `app/lib/order-facts/types.ts` (`ORDER_UNIT_DIAGNOSTIC_STATES`,
`ORDER_HISTORY_WINDOW_STATES`).

`ORDER_UNIT_DIAGNOSTIC_STATES` omits `UNIT_SALE_SIGN_INCONSISTENT`.
`ORDER_HISTORY_WINDOW_STATES` omits `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` and
`REFUND_OUTSIDE_ACCESSIBLE_WINDOW`, and includes `INACCESSIBLE_HISTORY_WINDOW`, which §8 defines
as an **`existenceKind`**, not a diagnostic code. The backing columns are free-text
`VarChar(128)`, so nothing fails closed; the risk is cross-lane vocabulary drift into PR6-C's
reconciler and the merchant-visible diagnostics of §6.5. Correction: align both constants with
the §8 diagnostic-code list.

### F-CLAUDE-PR6A-04 (P3) — control-plane Shop grant list has no guard against the next Shop column

**File:** `scripts/sync-control-plane/roles.ts` (`CONTROL_PLANE_SHOP_COLUMNS`,
`CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS`, `verifyControlPlaneRole`).

`verifyControlPlaneRole` iterates only the two known column lists, so a future `Shop` column
added without updating `CONTROL_PLANE_SHOP_SELECT_ONLY_COLUMNS` reproduces exactly the
`34074356984` outage. Impact is bounded because it fails closed in CI rather than silently
(reproduced in §2.1). Correction: assert that every column of `Shop` appears in exactly one of
the two lists, so the omission is named at the grant layer rather than surfacing as an opaque
`permission denied` in an unrelated suite.

---

## 15. Other verdicts

**Timestamp representation — PASS, no finding.** `processedAt` (order, refund) and
`orderProcessedAt` (line) are `timestamptz(3)`; every other Shopify timestamp is `timestamp(3)`.
This is deliberate and plan-mandated: §5.2 requires `processedAt` to persist "exact Shopify
DateTime string **and** timestamptz," which the schema does via the paired
`processedAtShopify VarChar(64)` column under a CHECK enforcing the pair (reproduced: writing the
raw string with a NULL timestamp is rejected). The remaining `timestamp(3)` columns match the
accepted PR5 convention exactly (`ShopifyVariantFact.shopifyUpdatedAt` is likewise `timestamp`;
`CatalogObservationInFlight.leaseExpiresAt` is likewise `timestamptz`). Behaviour was reproduced
rather than assumed: under `TimeZone='America/Los_Angeles'`, the same UTC instant written to
`processedAt` round-tripped correctly (08:30 UTC) while a `timestamptz`-cast write into the naive
`shopifyUpdatedAt` shifted to 00:30 — standard PostgreSQL conversion semantics, identical on PR5's
Clock A, exercised only by raw-SQL writes under a non-UTC session (Prisma normalizes to UTC).
No new ambiguity is introduced and parent Clock-A ordering is internally consistent; PR6-A in fact
strengthens the one column the plan singles out. Carry-forward note for PR6-C: do not write
Clock A via raw SQL under a non-UTC session.

**Money schema — PASS.** All 52 order-domain money columns are `numeric(20,6)`; zero deviations.
Every `*Amount` column has a paired `*CurrencyCode` column (0 orphans). Sub-cent precision
round-trips exactly (`0.123456` stored and read back verbatim). No `Number(...)` / `parseFloat`
helper exists in the order-facts modules (asserted by `foundation-safety.test.ts` and confirmed
by inspection); no division-derived unit price — `originalUnitPrice*` and
`discountedUnitPriceAfterAllDiscounts*` are stored as reported. Nullable money columns do not
prevent PR6-C fail-apply semantics: §6.3 fail-apply means the snapshot is never written, so a
persisted row always carries its required bags, while nullability remains necessary for optional
bags and for tombstone rows where no money was ever observed (matching PR5). The PO-11 field
`discountedUnitPriceAfterAllDiscounts*` is nullable and listed under
`ORDER_OPTIONAL_MONEY_BAGS` — it does **not** become required authority. No money arithmetic is
implemented in A.

**Lock keys / known-answer vectors — PASS.** All five vectors were **independently recomputed**
in a separate Python implementation (length-prefixed UTF-8 → SHA-256 → big-endian signed int32),
not by running the repository's code. Every preimage, digest and key pair matched byte-for-byte,
including the non-ASCII case (`"tést-shop"` → `10:tést-shop`, exercising byte-length rather than
`String.length`) and the RefundLine ordinal composite. Version is `stocky-pr6-canonical-lock-v1`;
kinds are exactly `Order`, `OrderLine`, `Refund`, `RefundLine`; a kind change alters the digest;
`readInt32BE(0)`/`readInt32BE(4)` are used with no `BigInt64` path; ordering is dedupe-then
ascending `(key1,key2)`. PR5 vectors are unchanged — `app/lib/catalog-facts/**` is byte-identical
to base and `catalog-facts/lock-key.test.ts` passes 5/5.

**Advisory lock — PASS.** `pg_advisory_xact_lock` only (no session-level lock); no Shopify I/O
and no applicator behaviour; requires an established, matching tenant transaction via
`current_setting('stocky.current_shop_id')` before locking; transaction-local `lock_timeout`
applied and restored on success only; deterministic ordering delegated to `lock-key.ts`; the PR5
lock-capacity evaluator is **re-exported unchanged** rather than reimplemented. Structurally a
faithful sibling of the accepted `catalog-facts/advisory-lock.ts`.

**`types.ts` sufficiency — PASS with F-CLAUDE-PR6A-02/03.** Genuinely types-only: no Prisma
import, no GraphQL-generated import, no `app/types/**` reference, no network or database I/O, no
reader/apply behaviour, no product logic contradicting PO-01…PO-11 (asserted by `types.test.ts`
and `foundation-safety.test.ts`, and confirmed by inspection). The identity contracts B and C need
are present and correct — refund-line ordinal composite with nullable `shopifyGid` lineage,
agreement-sale identity as `(shopId, Sale.id)` with `shopifyAgreementGid` as lineage/FK, the
lock-identity union, `ORDER_LOCK_BEFORE_FIRST_INSERT`, clock fields, denormalized-column
contracts, and `FROZEN_ORDER_NUMERIC_PRECISION/SCALE`. The two P3 gaps above mean B and C would
need to *extend* — not renegotiate — the money-bag and diagnostic constants.

**R-166…R-185 — PASS.** Exactly 20 rows, unique, contiguous, no collision with R-165, no
renumbering of earlier ids (max id in the register is R-185). Severities match approved §21.1
exactly: R-176 **P0**; R-173, R-184, R-185 **P2**; the remaining sixteen **P1**. All twenty are
**OPEN**. Lane assignments are correct and no future B/C/D risk is closed because A exists —
including the correctly split entries (R-171, R-176, R-180, R-183 name PR6-A's portion **and**
remain OPEN for the later lane). F-CLAUDE-PR6A-01 sits squarely inside R-176's
"PR6-A (representability)" half.

**Authority / control state — PASS.** `DECISIONS.md` (D-054 item 23), `PROJECT_STATUS.md` and
`docs/README.md` record: PR #34 CLOSED/MERGED, squash `09feffd3f36…` at `2026-09-07T00:53:25Z`;
post-merge run `34071226302`, event `push`, head `09feffd3f36…`, **SUCCESS** (independently
confirmed via the Actions API); planning verdict `APPROVE PR6 CURRENT-MAIN PLANNING`; final
planning-review blob `4f5ea10f6d36175d3540cb977a8f3543f36c15c2` — **independently recomputed**
with `git rev-parse` at both the subject head and at `09feffd3f36…`, identical, confirming the
artifact is unmodified; PR6-A AUTHORIZED / IN PROGRESS; **D-055 not created**; Phase 1
IN PROGRESS; PR6-B/C/D NOT AUTHORIZED; production, merchant production data, Shopify writes,
inventory writes, deployment, `read_all_orders` and `write_orders` NOT AUTHORIZED; flags DEFAULT
OFF. No immutable planning-review artifact was modified by this PR.

**PII — PASS.** A pattern scan over every column of the nine tables for
customer / email / phone / address / IP / note / consent / staffMember / receipt /
paymentDetails / accountNumber / device / customAttributes returned **0 rows**, and the full
non-money column inventory was reviewed by hand. `ShopifyOrderFact.name` is `Order.name`, which
§5.2 explicitly designates "not PII"; `title` / `variantTitle` / `vendor` / `sku` on order lines
are the product snapshots §5.3 approves. No customer GID column exists.

**Local `npm test` five-failure claim — PASS, adjudicated as pre-existing.** Independently
reproduced exactly: `Tests 5 failed | 385 passed (390)`, all five in
`app/lib/catalog-facts/admin-read/bulk-query-schema.test.ts`, all from the absent gitignored
`app/types/admin-2026-07.schema.json` (`.gitignore:42`). Cursor's explanation is accurate. The
failures are **not** PR6-A's: that file is not among the 33 changed paths, and checking out the
same test from base `09feffd3f36…` reproduces `5 failed | 3 passed` identically. A supported
command sequence does exist and was executed: `npm run graphql-codegen && npm test` →
**390 passed (390)**, and the gate's own error message names the command
("Materialize it with `npm run graphql-codegen` before tests"), so it fails closed and
self-documents. Classification: existing PR5-F2A codegen-workflow behaviour, carried forward as
the already-accepted PO-11 provenance P3. `npm test` is not "unexpectedly broken"; it has an
undocumented-in-README but self-announcing codegen prerequisite. No new finding.

---

## 16. Commands executed (independent reproduction)

Environment: disposable PostgreSQL **16.13** on `127.0.0.1:55432`, database `stocky_plus_ci`,
Node v22.22.2, npm 11.5.2, CI-equivalent environment variables, all inventory-write and
absence-tombstone flags `false`. **No production connection. No Shopify API call. No mutation of
PR #37 or `main`.**

```
git fetch origin main / phase-1/pr6-a-order-refund-fact-foundation
git rev-parse / merge-base / rev-list --left-right --count / diff --name-status / rev-parse <blob>
npm ci                                                        970 packages
npx prisma validate                                           schema is valid
npx prisma generate                                           Prisma Client 6.19.3
npx prisma migrate deploy                                     all migrations applied
npm run tenant:indexes:apply -- --apply / tenant:indexes:verify   ok:true, mismatches:[]
npm run tenant:schema:drift                                   tenant_prisma_schema_drift_ok
npm run tenant:enforcement:inventory:check                    inventory fresh
npm run tenant:roles:provision -- --apply                     ok:true
npm run tenant:enforcement:preflight                          ok:true  merchantTableCount:35
npm run tenant:enforcement:apply -- --apply                   ok:true
npm run tenant:roles:verify / rls:verify / immutability:verify / enforcement:verify / drift
                                                              all ok:true, issues:[]
npm run tenant:access:audit / tenant:access:inventory:check    audit_ok / inventory fresh
npm run sync:inventory:check                                  ok surfaces=48
npx vitest run app/lib/order-facts                            17 passed
npx vitest run app/lib/catalog-facts/lock-key.test.ts          5 passed  (PR5 regression)
npm run test:migrations -- …/pr6-a-order-fact-foundation.test.ts   18 passed
npx vitest --config vitest.tenant-access.config.ts tenant-db + top-level-unique-selectors  24 passed
npx vitest --config vitest.db-isolation.config.ts isolation.test.ts   14 passed
npx vitest --config vitest.tenant-access.config.ts architecture-audit.test.ts   25 passed
npx vitest --config vitest.migrations.config.ts exact-privilege-complete-matrix   27 passed
npx vitest --config vitest.migrations.config.ts sequence-privilege + exact-privilege-allowlist
                                                 + tenant-expansion.migration   11 passed
npm run test:sync-role-isolation                              9 passed
npm run test:sync-uninstall                                   8 passed
npm run lint                                                  pass
npm run typecheck                                             pass
npm test                                                      5 failed | 385 passed  (codegen absent)
npm run graphql-codegen && npm test                           390 passed (390)
npm run build                                                 built
git diff --check                                              clean
python3 (independent SHA-256 / int32 lock-vector recomputation)   5/5 vectors matched
psql direct probes: RLS FORCE, NOT NULL, immutability triggers, no-GUC deny, cross-shop read,
  foreign-tenant INSERT, shopId reassignment, cross-shop composite FK, runtime DELETE,
  DataIssue DML, sequence USAGE/SELECT/UPDATE/setval, control-plane Shop column matrix,
  existence-state contradiction matrix (order vs catalog), observation lifecycle/lease/identity,
  money precision round-trip, timestamp session-TimeZone behaviour, PII column scan
negative reproductions: revoke Shop SELECT → 42501 uninstall failure reproduced;
  incompatible pre-existing Shop column → drift gate fails closed;
  injected tenth merchant model → inventory guard fails closed (reverted)
```

---

## 17. Findings summary

| ID | Severity | Title |
|---|---|---|
| F-CLAUDE-PR6A-01 | **P2** | No existence/deletion coherence CHECK on any of the eight canonical order fact tables; six impossible states reproduced as insertable, four of them rejected by the equivalent PR5 catalog constraint |
| F-CLAUDE-PR6A-02 | P3 | `ORDER_REQUIRED_MONEY_BAGS` covers 3 of 8 frozen §6.3 required-bag groups; `MoneyBagSides` unused; required refund-shipping bags typed `OptionalMoneyBagSides` |
| F-CLAUDE-PR6A-03 | P3 | Diagnostic-code constants incomplete vs §8; `INACCESSIBLE_HISTORY_WINDOW` listed as a history-window state though §8 defines it as an `existenceKind` |
| F-CLAUDE-PR6A-04 | P3 | Control-plane `Shop` grant lists are manually maintained with no verifier guard against the next added `Shop` column |

**P0 = 0 · P1 = 0 · P2 = 1 · P3 = 3.**

Approval requires P0 = P1 = P2 = 0. One P2 stands.

### Recommended risk-register dispositions

- **R-176 (P0, OPEN)** — keep OPEN. Its "PR6-A (representability)" half is **not** satisfied:
  existence kinds are representable as enum values but their combinations are unconstrained
  (F-CLAUDE-PR6A-01). Closing the PR6-A portion requires the coherence constraints.
- **R-164** — remains the correct home for runtime DELETE on canonical facts; extended
  consistently to the order domain. No change.
- **R-171, R-180, R-183** — PR6-A's portions are satisfied (no variant FK; ordinal composite
  identity; merchant-durable diagnostic columns present). Keep OPEN for PR6-C.
- No new risk id is proposed; F-CLAUDE-PR6A-01 is correctable inside this PR and is already
  covered by R-176's PR6-A half.

---

## 18. Control statements

- PR #37 was **not** modified, rebased, marked ready, or merged. Subject head remains
  `5f8b2e764ce947d6e15edb7f85496bdcc5567161`.
- `main` was **not** modified. `origin/main` remains `09feffd3f36eb4698f2ed8a152efe414cd9b77bd`.
- No implementation or historical review artifact was edited. This commit changes only this file.
- PR6-B / PR6-C / PR6-D were **not** started and remain **NOT AUTHORIZED**.
- No production action, no deployment, no Shopify API call, no Shopify or inventory mutation.
  All feature flags remain **DEFAULT OFF**.
- All database work was performed on a disposable local PostgreSQL 16.13 instance containing no
  merchant data.

---

## 19. Verdict

The PR6-A boundary is respected, the nine-model inventory and 24/11/35 counts are correct from
four independent sources, tenancy and RLS are sound under live adversarial probing, the money and
lock contracts are exact, the observation lifecycle faithfully mirrors the accepted PR5 sibling,
the migration is additive and safe, and both superseded CI failures were fixed at the root cause.
All four supplied candidate findings were adjudicated and none survives as a defect.

One independent defect blocks approval: the frozen PR5 existence-coherence constraint was
silently dropped for the entire order domain, and six impossible existence/deletion states were
reproduced as insertable against the very tables R-176 (P0) assigns to PR6-A for
representability. The correction is small, additive, and materially cheaper now than after any
row exists.

**CORRECTIONS REQUIRED**
