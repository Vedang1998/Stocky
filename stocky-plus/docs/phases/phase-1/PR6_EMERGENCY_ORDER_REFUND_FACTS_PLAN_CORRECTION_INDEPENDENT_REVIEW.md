# Phase 1 PR 6 — Independent Correction Re-Review of the Emergency Order / Refund Facts Planning Packet

**Document type:** Independent correction re-review report (planning review only)
**Reviewer:** Claude Code (independent)
**Review date:** 2026-09-02
**Reviewed artifact:** `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` (corrected)
**Reviewed PR:** `#34`
**Reviewed branch:** `cursor/pr6-order-refund-planning-87c7`
**Reviewed corrected head (exact):** `11d9cf6f9f759f2ebb1c467f06ea56af69672f9d`
**Original reviewed head:** `76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b`
**Original planning base:** `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (PR5-F2A squash merge `#29`)
**`origin/main` observed at review start:** `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7`
**`origin/main` observed at review end:** `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` (PR `#31` PR5-F2B merged mid-review)
**Shopify Admin API verified against:** `2026-07` (`ApiVersion.July26`)
**Review posture:** Correction re-review, one pass, per `ACCELERATED_SAFE_DELIVERY.md`

**PR #34 was not modified.** No runtime, schema, migration, GraphQL production document,
webhook, or configuration file was changed by this review. PR #34 was not rebased,
not marked ready, and not merged. This document is the only artifact committed, on an
independent Claude review branch based on `f65ab4b9…`, not on PR #34.

**VERDICT: CORRECTIONS REQUIRED**

---

## 0. Executive summary

The correction package is substantial, disciplined, and overwhelmingly sound. It is a
genuine architecture correction, not a compliance restatement: the packet grew from
1,345 to 1,903 lines (+934 / −375), and the changes are in the contract text, not in the
completion matrix. All 24 original findings carry explicit dispositions, all 70 items of
original review §16 A–I are present in the sections they claim, and every one of the
twelve product-owner decisions is frozen as contract rather than left as an option.

Independent verification was performed against the **live** Shopify Admin GraphQL
`2026-07` schema and against the merged repository, not against the packet's own claims.
Every previously-defective Shopify assertion is now correct. The corrected `OrderFactById`
document was submitted to the Shopify schema validator **in full** and returned
`✅ VALID` — including the `ReturnAgreement` fragment, the `ProductSale` /
`GiftCardSale` / `TipSale` inline fragments, `refunds` without `first`, and the refund
child connections. That is a materially stronger result than the original packet, whose
equivalent shape was rejected by the same validator.

The P0 is fully corrected. All eight P1s are substantively corrected. Two defects remain,
both discovered by fresh evidence rather than by re-reading the review:

1. **`NEW-CLAUDE-PR6PC-01` (P1).** Official 2026-07 documentation shows that
   `RETURN`-action sales carry **negative** `Sale.quantity` (`"quantity": -2`). The now-frozen
   §7.1 definition `refunded_units = Σ agreement-sale quantities where reason ∈ {REFUND, RETURN}`
   therefore evaluates to a negative number, which contradicts the packet's own **T47**
   (`refunded_units = 1`) and inverts the `removed_units` identity that §7.1 freezes in the
   same table. The unit **ledger** (Option A) is correct; the derived unit **fields** built on
   top of it are arithmetically wrong, and the `LINE_UNIT_IDENTITY_INCONSISTENT` guard
   can effectively never fire on a refunded line. This is the one place where the
   correction froze a contract without freezing its sign convention.
2. **`NEW-CLAUDE-PR6PC-02` (P2).** The corrected `OrderFactById` introduces per-child
   cursor variables (a real improvement) but declares **one** `$saleAfter` shared across a
   paginated `agreements` connection and **one** `$refundLineAfter` / `$adjAfter` /
   `$shipRefundAfter` / `$txnAfter` shared across the `refunds` **array**. Nested per-parent
   connections cannot be walked with a single shared cursor, and `refunds` is an array that
   §4.3 correctly forbids narrowing with `first`. Because §4.3 makes incomplete pagination a
   non-apply and §15 defines no diagnostic for it, a multi-agreement or multi-refund order
   whose child connection exceeds one page has **no legal completion path** in the frozen
   document — it fails closed forever, silently absent from demand.

Neither defect reopens a product decision, and neither is a regression. Both are narrow,
mechanically fixable, and confined to §4.2/§4.3 and §7.1.

Nothing was found that is **NOT CORRECTED** or **REGRESSED**.

Approval requires no unresolved P0/P1/P2. Two exist.

---

## 1. Reviewed identity and provenance

| Field | Value | Verification |
|---|---|---|
| Repository | `Vedang1998/Stocky` | — |
| Reviewed PR | `#34` | `pull_request_read` — OPEN, **DRAFT**, **not merged**, `mergeable_state: clean` |
| Reviewed branch | `cursor/pr6-order-refund-planning-87c7` | `git fetch origin refs/pull/34/head` |
| Reviewed corrected head | `11d9cf6f9f759f2ebb1c467f06ea56af69672f9d` | `git rev-parse refs/remotes/pr/34` — **exact match** |
| PR base | `main` @ `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` | PR API `base.sha` |
| Commits on PR | 3 (`76a8f33` plan → `f629fff` review cherry-pick → `11d9cf6` correction) | `git log f65ab4b..11d9cf6f` |
| Diff scope | **3 files, +3278 / −0** vs base | `git diff --stat f65ab4b 11d9cf6f` |
| Correction commit scope | 2 files, **+934 / −375** | `git show --stat 11d9cf6f` |
| Diff classification | Provably docs-only under `stocky-plus/docs/**` | all three paths verified |
| PR #34 modified by this review | **No** | — |
| Runtime modified by this review | **No** | — |

Changed paths (complete):

```text
stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md                    (+1903)
stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md (+1373)
stocky-plus/docs/phases/phase-1/README.md                                                   (+2)
```

No `prisma/`, no `app/`, no `scripts/`, no `.github/`, no `shopify.app.toml`, no
`RISK_REGISTER.md`, no `OPEN_QUESTIONS.md`, no `DECISIONS.md`. The prohibition list in
the review brief is satisfied mechanically, not by assertion.

### 1.1 Immutable original review — byte-identity verification

```text
git rev-parse 11d9cf6f:stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md
  → d72340c01dd9c662d0e8bb4aa8d43482940470d9

git rev-parse 4fd81bae2c4c42732ffd573d8523965c4d2289fb:stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md
  → d72340c01dd9c662d0e8bb4aa8d43482940470d9
```

**PASS.** The blob on the corrected PR head is byte-identical to the blob on the review
branch and equals the expected `d72340c01dd9c662d0e8bb4aa8d43482940470d9`. Git blob
identity is content-addressed, so this is proof of byte-identity, not a checksum claim.
The original independent review was **not edited**. This review does not edit it either.

### 1.2 Exact-head CI verification

Run [`33582669186`](https://github.com/Vedang1998/Stocky/actions/runs/33582669186), independently retrieved:

| Field | Observed | Expected | Result |
|---|---|---|---|
| `event` | `pull_request` | `pull_request` | **PASS** |
| `head_sha` | `11d9cf6f9f759f2ebb1c467f06ea56af69672f9d` | exact corrected head | **PASS** |
| Run conclusion | `success` | — | **PASS** |
| `Classify change set` (`100100073300`) | **SUCCESS** | SUCCESS | **PASS** |
| `Lint, typecheck, test, build, Prisma, GraphQL` (Heavy, `100100102159`) | **SKIPPED** | SKIPPED | **PASS** |
| `CI Gate` (`100100101905`) | **SUCCESS** | SUCCESS | **PASS** |

The Classify job ran its classification self-test before classifying, and Heavy was
skipped rather than failed — consistent with a docs-only change set under the
`AGENTS.md` CI evidence policy. All three job outcomes were read from the Actions API
on the exact head, not from the PR description.

### 1.3 Main movement during this review — recorded separately

PR [`#31`](https://github.com/Vedang1998/Stocky/pull/31) (PR5-F2B canonical fact applicator)
was **merged at 2026-09-02T10:32:09Z**, while this review was in progress.

| Field | Value |
|---|---|
| `origin/main` at review start | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| `origin/main` at review end | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` |
| Merge commit subject | `Phase 1 PR5-F2B — canonical fact applicator (#31)` |
| Diff `f65ab4b` → `0284b66` | 23 files, +13,721 / −15 |

Per the review brief, PR #34 was **not** rebased and **not** modified, and the review
continued against the exact corrected head.

**Material-contradiction test — result: NO CONTRADICTION.** Every repository fact the
corrected PR 6 plan depends on was mechanically re-checked at the advanced main:

| PR 6 planning premise | File | State at `0284b66` |
|---|---|---|
| No order-domain models exist | `prisma/schema.prisma` | **UNCHANGED** |
| `DIRECT`/`CHILD` lists as cited | `app/tenant/models.ts` | **UNCHANGED** |
| `DataIssue` control-plane, no runtime DML | `scripts/tenant-enforcement/manifest.ts` | **UNCHANGED** |
| `roles.ts` exists and is grant-owning | `scripts/tenant-enforcement/roles.ts` | **UNCHANGED** |
| v1 projections still carry `line_items` | `app/sync/sanitize.server.ts` | **UNCHANGED** |
| Legacy `parseFloat` demand path still live | `app/jobs/workers/webhook-processor.ts` | **UNCHANGED** |
| Scopes `read_orders` only; API `2026-07` | `shopify.app.toml` | **UNCHANGED** |
| Highest risk id `R-164` | `docs/RISK_REGISTER.md` | **UNCHANGED** |
| Highest question id `Q-011` | `docs/OPEN_QUESTIONS.md` | **UNCHANGED** |
| Unknown job types fail closed | `app/sync/execution-strategy.server.ts` | **UNCHANGED** |
| `app/lib/order-facts/**` does not exist | — | **still absent** |

F2B added only `app/lib/catalog-facts/apply/**`, its tests, its reports, and a
`lock-capacity.ts` change. **No PR 6 planning premise moved.** Review continued; no stop
condition was triggered.

**Two staleness observations for the product owner (not findings against this PR):**

- Packet §0.2, §22.2, and §24 record PR `#31` as `OPEN DRAFT, CONFLICTING`. That was true
  at the reviewed head and is now stale. The statement *"PR 30/31 must not be used as a
  base"* should be narrowed to PR `#30` only; PR `#31`'s applicator is now **on main**.
- Consequently `app/lib/catalog-facts/apply/**` is now a **merged** reference pattern for
  PR6-C, strictly better than the packet's current instruction to copy contracts from the
  PR 5 brief rather than from a conflicted branch head. This is an improvement available
  to PR6-C, not a defect in the plan.

---

## 2. Shopify Admin API re-verification (2026-07)

Method: live schema introspection and operation validation through Shopify developer
tooling (`graphql_schema`, `validate_graphql_codeblocks`, `search_docs_chunks`) against
`2026-07`. No production or merchant store data was accessed. No mutation was
constructed or executed.

### 2.1 Previously-FALSE assertions — all now corrected and re-verified TRUE

| Original defect | Corrected packet statement | Independent result |
|---|---|---|
| `Sale.lineItem` on the interface | §4.1(12), §4.2 inline fragments | **CORRECT** — `Sale` interface exposes `actionType`, `id`, `lineType`, `quantity`, `taxes`, `totalAmount`, `totalDiscountAmount*`, `totalTaxAmount`; **no** `lineItem` |
| `LineItem.priceAfterAllDiscountsBeforeTaxesSet` | Removed; §3 forbids it | **CORRECT** — field absent; substitute named deliberately as lineage-only |
| `Order.cancellation { reason … }` | Entire selection dropped; §3 forbids it | **CORRECT** |
| "`orders/delete` does not exist" | §4.1(16), §8.12, §9.1 | **CORRECT** — `ORDERS_DELETE`: *"Occurs whenever an order is deleted. **Requires the `read_orders` scope**."* Already-granted scope; no Partner approval needed |
| "`orders { agreements { sales } }` is at the depth limit" | Bulk C **deleted** as illegal three-level | **CORRECT** — `bulkOperationRunQuery`: *"supports up to **five connections with a maximum nesting depth of two levels**"* |
| `RefundLineItem.id` as canonical identity | Ordinal composite; `id` nullable lineage | **CORRECT** — `id` is `ID` (nullable); `lineItem` is `LineItem!` (non-null), so the ordinal composite is total |

### 2.2 Corrected packet assertions independently verified TRUE

| Assertion | Result |
|---|---|
| `Refund.updatedAt` is `DateTime!` | **TRUE** — non-null; refund Clock A exists and is now bound |
| `Refund.createdAt` is nullable | **TRUE** — `DateTime`, nullable |
| `Refund.processedAt` is `DateTime!` | **TRUE** |
| `Refund.transactions` / `refundLineItems` / `orderAdjustments` / `refundShippingLines` are **connections** | **TRUE** — `OrderTransactionConnection!`, `RefundLineItemConnection!`, `OrderAdjustmentConnection!`, `RefundShippingLineConnection!` |
| `Refund.duties` is an **array** | **TRUE** — `LIST` |
| `Sale.quantity` is nullable `Int` | **TRUE** |
| `SalesAgreement.reason` is `OrderActionType!`; `sales` is `SaleConnection!` on the interface | **TRUE** |
| `ReturnAgreement` exists as a concrete agreement type | **TRUE** — validated in the document |
| `Shop.ianaTimezone` exists | **TRUE** — `String!` (**non-null**) |
| `Shop.currencyCode` exists | **TRUE** — `CurrencyCode!` (**non-null**) |
| `ORDER_TRANSACTIONS_CREATE` fires on create **or status update** | **TRUE** — and, newly established: *"Only occurs for transactions with a status of **success, failure or error**"* — the SUCCESS transition PO-06 depends on **does** fire |
| `RefundLineItem` fields `priceSet` / `subtotalSet` / `totalTaxSet` / `restockType` / `restocked` / `location` | **ALL VALID**; `priceSet` is `MoneyBag!` (**non-null**) |
| Access-scope model is disjunctive, not additive | **TRUE** — minimal `order(id:){id}` reports `read_orders, read_marketplace_orders, read_quick_sale` as **alternatives**; the granted `read_orders` suffices |

### 2.3 Full-document validation of the corrected `OrderFactById`

The corrected §4.2 conceptual document was reconstructed verbatim (variable declarations
made explicit) and submitted to the Shopify Admin schema validator:

```text
Status: ✅ SUCCESS — Successfully validated GraphQL query against schema.
Required scopes: read_orders, read_marketplace_orders, read_quick_sale,
                 read_locations, read_inventory, read_markets_home, read_products
```

This covers `ReturnAgreement`, the three `lineItem`-bearing `Sale` fragments, `refunds`
without `first`, `refundShippingLines`, `orderAdjustments`, `transactions`, `priceSet`,
`restockType`, `location`, `nonFulfillableQuantity`, and every selected `MoneyBag`.
The reported scopes are disjunctive alternatives plus `read_locations` / `read_inventory`
(both already granted) contributed by `retailLocation`. **No missing-scope hazard.**

### 2.4 Newly established fact that the corrected packet does not account for

| Fact | Source | Consequence |
|---|---|---|
| A `RETURN`-action `ProductSale` carries **negative** `quantity` and **negative** `totalAmount` | Official 2026-07 `order` query page response example: `{"actionType":"RETURN","lineType":"PRODUCT","quantity":-2,"totalAmount":{"shopMoney":{"amount":"-20.7"}}}` | §7.1's frozen `refunded_units` definition and `removed_units` identity are sign-inverted; **`NEW-CLAUDE-PR6PC-01`** |
| `Refund.transactions` is a **connection**, while `Order.transactions` is an **array** | schema | §4.3's generic "never pass `first` on `transactions`" prohibition and T20 are over-broad; **`NEW-CLAUDE-PR6PC-03`** |
| `RefundLineItem.priceSet` is `MoneyBag!` and `Shop.ianaTimezone` is `String!` | schema | §6.3 and §5.0 justify optionality with an incorrect nullability claim; **`NEW-CLAUDE-PR6PC-04`** |

---

## 3. Repository re-verification at the original base

Every repository fact the corrected plan relies on was re-checked at `f65ab4b9…`
(and, per §1.3, again at `0284b66…`):

| Corrected-plan claim | Verification |
|---|---|
| Scopes `read_orders` present, `read_all_orders` / `write_orders` absent | **CONFIRMED** — `shopify.app.toml:8` |
| API version `2026-07` | **CONFIRMED** — `api_version = "2026-07"` |
| `DataIssue` is `platform_control_plane`, `rlsRequired: false`, `expectedRuntimePrivileges: []` | **CONFIRMED** — `scripts/tenant-enforcement/manifest.ts:941-951`. The applicator genuinely cannot DML `DataIssue`; the §6.5 Race Z pattern is required, not optional |
| `Shop` has **no** `ianaTimezone` / `currencyCode` column | **CONFIRMED** — absent from `model Shop`; PR6-A must add them |
| `ShopifyVariantFact` is in `DIRECT_MERCHANT_MODELS` despite being a child | **CONFIRMED** — `app/tenant/models.ts:22`; the §2.1 DIRECT/CHILD rationale follows an existing precedent |
| `CatalogObservationInFlight` is DIRECT | **CONFIRMED** — `models.ts:26` |
| `scripts/tenant-enforcement/roles.ts` exists | **CONFIRMED** |
| v1 sanitized projections still emit `line_items` / `refund_line_items` | **CONFIRMED** — `app/sync/sanitize.server.ts:156,191,199,229`; projection ids `…-orders-create-v1`, `…-orders-cancelled-v1`, `…-refunds-create-v1` at lines 9–11. **PO-02 option (a) is mechanically implementable** |
| Legacy demand path uses `parseFloat`, `locationId = "default"`, `processBomSale` | **CONFIRMED** — `webhook-processor.ts:11,73,94,98,145,169,190,216` |
| `stocky_catalog_observation_gen_seq` exists and is reusable | **CONFIRMED** — `prisma/migrations/20260816193000_pr5_catalog_fact_foundation/migration.sql:778` |
| `stocky-pr5-canonical-lock-v1` is the frozen catalog lock version | **CONFIRMED** — `app/lib/catalog-facts/constants.ts:6`; minting `stocky-pr6-canonical-lock-v1` is correct |
| `SyncCursor.syncDomain` is `VarChar(64)` | **CONFIRMED** — `prisma/schema.prisma:963`; `orders_full` / `orders_incremental` / `orders_reconcile` fit |
| Unknown job types fail closed `NO_AUTOMATIC_RETRY` | **CONFIRMED** — `app/sync/execution-strategy.server.ts` default branch |
| Highest register ids `R-164` / `Q-011` | **CONFIRMED** — proposed `R-165…R-184` / `Q-012…Q-016` do not collide at either main |
| `R-014` still OPEN and not closable by planning | **CONFIRMED** — `RISK_REGISTER.md:18` |
| `app/lib/order-facts/**` does not exist | **CONFIRMED** — no lane-ownership conflict |
| Registers and `DECISIONS.md` untouched by this PR | **CONFIRMED** — `git diff --stat` shows 3 docs files only |

---

## 4. F-CLAUDE-PR6P-01 … 24 disposition table

Each disposition below was reached by reading the corrected contract text in the cited
sections and, where the finding rested on an external fact, by re-verifying that fact
independently. No disposition was accepted from the packet's own §C2 or §25 matrix.

| ID | Sev | Disposition | Basis |
|---|---|---|---|
| **F-CLAUDE-PR6P-01** | **P0** | **CORRECTED** | §8.4–§8.10 freeze all six required elements: `INACCESSIBLE_HISTORY_WINDOW` preserving last unambiguous state and never setting `deletedAt`; the three-part confirmed-absence predicate (completed null **AND** `storedProcessedAt ≥ observedAt − orderHistoryWindowDays(60)` **AND** effective scope set not lost vs last LIVE); permanent retention of out-of-window facts with `attributeFreshnessState` frozen and exclusion from reconcile sampling **and** all absence nomination; bulk-omission nomination restricted to in-window orders inside the run's own fence after a complete run; both `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` and `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` codes; T41/T42/T50 plus the exact-boundary drift case in §19. §8.10 additionally makes `INACCESSIBLE_HISTORY_WINDOW` explicitly non-terminal and reversible — closing the "revival can never fire" sub-case the original review raised. The observation-time **scope snapshot** is a persisted column in §5.1, not prose. `R-175` records the risk at P0 |
| **F-CLAUDE-PR6P-02** | P1 | **CORRECTED** | §4.1(16) corrects the factual claim; §8.12 freezes in-window (refetch → PR 5 semantics; live ⇒ stale-signal diagnostic per Race H) and out-of-window (`ABSENT_SIGNALLED_DELETE_UNVERIFIED` + `deletionSource = DELETE_WEBHOOK`, rows retained) authority; §1 states the derogation from "signal is never authority" explicitly and narrowly; payload shape declared **unverified** with fail-closed sanitizer and no `admin_graphql_api_id` assumption; §9.1/§9.4/§17.2 place the topic, route, job type, and `shopify.app.toml` edit in PR6-D; children retained per §8.11; T43. Topic and scope independently re-verified |
| **F-CLAUDE-PR6P-03** | P1 | **CORRECTED** | §4.7 restates the limitation as a **correctness boundary**, not import depth; `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` emitted; signal recorded; §11.5 explicitly refuses to claim reconcile healed it; §4.4 states the sweep cannot reach out-of-window rows. The review asked to escalate Q-PR6-10 to a pre-PR6-D decision; PO-01 goes further and **removes the dependency entirely** (correctness must not depend on the grant), leaving only Partner *timing* as Q-016. Stronger than the requested correction |
| **F-CLAUDE-PR6P-04** | P1 | **CORRECTED** | §5.1 publishes the per-fact-type clock table as frozen contract, matching the schema row for row (re-verified). Parent-versioned children with named sole writers; whole-or-nothing snapshot atomicity with children discarded on parent-gate rejection (T44); gate rejects **only** `<` with equal-`updatedAt` re-apply (T45); `Refund.updatedAt` bound independently including for refund nodes inside an order refetch; child absence only from complete pagination; `order_transactions/create` subscribed as Monday-critical; deterministic lock order; the four required races in §13. A residual summary-vs-detail inconsistency is logged as `NEW-CLAUDE-PR6PC-05` (P3) |
| **F-CLAUDE-PR6P-05** | P1 | **CORRECTED** | §2.1/§5.4 freeze `@@unique([shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal])` with ordinal defined over the **complete, fully-paginated** connection of that refund snapshot; nullable `shopifyGid` retained as lineage; model placed in CHILD; T46 asserts null-`id` ingest and idempotency. Identity totality re-verified: `RefundLineItem.lineItem` is `LineItem!` |
| **F-CLAUDE-PR6P-06** | P1 | **CORRECTED** | §4.2 uses `__typename` + `... on ProductSale / GiftCardSale / TipSale { lineItem { id } }`; `ReturnAgreement` added; §7.2.1 freezes the eligibility table; `UnknownSale` persisted, never dropped; T52. **Independently validated `✅ VALID` against the live 2026-07 schema** (§2.3) |
| **F-CLAUDE-PR6P-07** | P1 | **PARTIALLY CORRECTED** | Option A is chosen and frozen: §5.6 names `ShopifyOrderAgreementSaleFact` as **the** unit-event ledger; §7.2 demotes refund lines to money/restock/reconciliation evidence and is echoed in §5.4, §7.1, §7.5 and T47/T06 — the double-subtraction defect itself is fixed. **However** the derived unit fields built on the ledger are sign-inverted against Shopify's signed reversal quantities and against T47 itself. See `NEW-CLAUDE-PR6PC-01` (P1) |
| **F-CLAUDE-PR6P-08** | P1→P2 | **CORRECTED** | Invalid field removed; `Order.cancellation` selection dropped entirely with `cancelReason` retained (also removing the query-then-discard-PII pattern); `refundableQuantity ≡ currentQuantity` frozen with "no formula may depend on a difference"; `discountedUnitPriceAfterAllDiscountsSet` retained as **lineage-only** with an explicit deliberate rationale; array-truncation rule generalised and T20 made generic. The generalisation's over-breadth is logged as `NEW-CLAUDE-PR6PC-03` (P3) |
| **F-CLAUDE-PR6P-09** | P2 | **CORRECTED** | Bulk C **deleted** and added to §3 non-goals with T53 asserting schema-gate rejection; Bulk A retained as legal two-level; Bulk B legality made an explicit **PR6-B gate deliverable** with a recorded result and a costed per-order fallback bounded against the 1,000,000-line envelope; agreements/sales freeze as paginated per-order refetch for `edited=true` **or** refund-bearing orders, with an explicit anti-N+1 requirement (batch/limit concurrency, query-count assertions, fail the lane rather than truncate) and an explicit refusal to drop agreements to save requests. Depth rule independently re-verified |
| **F-CLAUDE-PR6P-10** | P2 | **CORRECTED** | §5.3 denormalizes `orderProcessedAt` / `orderCancelledAt` / `orderTest` / `orderShopCurrencyCode` as order-applicator-written only, with a **tested equality invariant** and an eager same-transaction backfill rule ("No lazy backfill. No line-only writer."), making `@@index([shopId, variantGidAtSale, orderProcessedAt])` realisable. §5.6 adds agreement-sale indexes and additionally denormalizes `happenedAt` onto the sale row so the ledger can be dated without a join — beyond what was asked. §14 lists the full realisable index set |
| **F-CLAUDE-PR6P-11** | P1 | **CORRECTED** | §6.2 chooses **fail-apply** and deletes "skip bag"; §6.3 enumerates required bags per resource and separates optional ones (present-but-invalid still fail-applies); §6.5 adds merchant-durable `moneyDiagnosticState` / `unitDiagnosticState` / `historyWindowState` written in the tenant transaction, with control-plane `DataIssue` derived by the reconciler per PR 5 Race Z; §5.10 restates that runtime has no `DataIssue` privileges; §15 gains a **named writer column for every row**. Verified against the manifest that this is necessary, not stylistic |
| **F-CLAUDE-PR6P-12** | P2 | **CORRECTED** | §6.6 freezes the six-term reconciliation identity as a tested invariant with exact NUMERIC equality and `REFUND_MONEY_UNBALANCED` on mismatch, correctly distinguishing bag-parse failure (fail-apply) from Shopify-reported sum imbalance (persist Shopify fields + diagnostic, "do not invent a balancing entry"); §6.1/§3 forbid division-derived unit prices; per-unit value bound to `Sale.totalAmount` / `RefundLineItem.subtotalSet`; §6.2 records the `Order.currencyCode` rationale; T48/T49 |
| **F-CLAUDE-PR6P-13** | P1 | **CORRECTED** | Option (a) frozen as PO-02 and restated in §9.1, §9.2, §9.3, §9.4, §5.9, §16.2 and §3 non-goals; the original "Dual-write is not required" wording is **explicitly replaced**; "no silent period of empty `line_items`" is stated as a requirement; retirement becomes a separate authorized cutover conditioned on the replacement consumer having reconciled. Verified implementable against `sanitize.server.ts` |
| **F-CLAUDE-PR6P-14** | P2 | **CORRECTED** | §9.2 freezes dispatch on the **persisted** `payloadSchemaVersion`, requires a future cutover PR to retain a v1 reader, and T51 asserts neither crash nor silent no-op |
| **F-CLAUDE-PR6P-15** | P2 | **CORRECTED** | §4.4 and §11.1–11.5 separate the **exhaustive** `updated_at` sweep (completeness) from the **sampled** deep-diff (drift detection only), delete the "sampling heals missed webhooks" claim, restrict sampling to in-window LIVE facts, and state the out-of-window limit; T24 asserts the sweep — not the sample — heals |
| **F-CLAUDE-PR6P-16** | P2 | **CORRECTED** | §17.1 adopts `PR6-A → (PR6-B ∥ PR6-C) → PR6-D`; types-only `app/lib/order-facts/types.ts` moves to PR6-A with "no Prisma import, no GraphQL import"; PR6-C's dependency is explicitly "**Not** blocked on PR6-B merge"; `app/types/**` assigned to B and excluded from A and C |
| **F-CLAUDE-PR6P-17** | P2 | **CORRECTED** | §5.0 and §2(9) add `Shop.ianaTimezone` / `Shop.currencyCode` to PR6-A; §5.0 correctly distinguishes shop-level currency from per-order `shopCurrencyCode` for historical survivability. Both fields independently verified to exist in 2026-07. A nullability mis-statement is logged as `NEW-CLAUDE-PR6PC-04` (P3) |
| **F-CLAUDE-PR6P-18** | P2 | **PARTIALLY CORRECTED** | The consistent-snapshot-pair (or reconciler-only) rule, the exchange row, the `SaleLineType.ADJUSTMENT` row, null-`Sale.quantity` persistence with no coercion and no unit event, and T54 are all present and correct. **However** the identity they guard is itself arithmetically wrong for the sign reason, so the `removed_units` derivation and the `< 0` diagnostic trigger remain incorrect. See `NEW-CLAUDE-PR6PC-01` |
| **F-CLAUDE-PR6P-19** | P3 | **CORRECTED** | §20/§21 propose sequential `Q-012…Q-016` and `R-165…R-184` with a full former-id mapping, and explicitly do **not** edit `RISK_REGISTER.md` / `OPEN_QUESTIONS.md`. Highest existing ids re-verified as `R-164` / `Q-011` at both the original and advanced main |
| **F-CLAUDE-PR6P-20** | P3 | **CORRECTED** | §2.1 and §5.6 now state **one** identity — `(shopId, shopifyGid)` where `shopifyGid = Sale.id` (`ID!`) — with `shopifyAgreementGid` demoted to a required FK column explicitly "not a second unique identity" |
| **F-CLAUDE-PR6P-21** | P3 | **CORRECTED** | §5.11 adds every named surface: `LineItem.customAttributes`, `LineItem.staffMember`, `Refund.staffMember`, `SalesAgreement.user`, `OrderTransaction.user` / `accountNumber` / `receiptJson` / `paymentDetails` / `device`, plus the whole `Order.cancellation` selection; §5.4 repeats the transaction-level prohibition at the point of use |
| **F-CLAUDE-PR6P-22** | P3 | **CORRECTED** | §4.1(13)(14)(15) and §5.4/§5.6 state all four nullabilities; each re-verified against the live schema |
| **F-CLAUDE-PR6P-23** | P3 | **CORRECTED** | §2.1 freezes DIRECT vs CHILD per model with a reasoned precedent (`ShopifyVariantFact`, verified present in `DIRECT_MERCHANT_MODELS`); §5.10 and §17.2 give PR6-A ownership of `scripts/tenant-enforcement/roles.ts`; §5.1 adds the platform-infrastructure note explaining reuse of the catalog-named sequence |
| **F-CLAUDE-PR6P-24** | P3 | **CORRECTED** | §5.1 removes "may also lock" and freezes ascending `(key1, key2)` acquisition after dedupe, with capacity honoured per R-161; `ReturnAgreement` added and validated. A summary-vs-detail contradiction in §13 is logged as `NEW-CLAUDE-PR6PC-05` (P3) |

**Totals: 22 CORRECTED · 2 PARTIALLY CORRECTED · 0 NOT CORRECTED · 0 REGRESSED.**

---

## 5. Original review §16 — 70-item incorporation verification

Verified by locating the substantive contract text in the corrected packet, **not** by
reading §25's completion matrix. Every one of the 70 items is present in the section it
claims. Items marked ⚠ are present but carry a residual defect logged in §6.

### A. Existence / deletion contract (items 1–9)

| # | Where found | Result |
|---|---|---|
| 1 | §8.5 — `INACCESSIBLE_HISTORY_WINDOW`, preserves last state, no `deletedAt` | **INCORPORATED** |
| 2 | §8.6 — three-part predicate incl. named constant 60 and scope-set clause; unconditional under `read_all_orders` | **INCORPORATED** |
| 3 | §8.7 — retained permanently; excluded from sampling and all nomination | **INCORPORATED** |
| 4 | §8.8 + §10.9 — nomination restricted to in-window, complete run, own fence | **INCORPORATED** |
| 5 | §4.1(16), §9.1, §9.4, §17.2 — topic, route, sanitizer, job type, toml in PR6-D | **INCORPORATED** |
| 6 | §8.12 + §1 narrow derogation | **INCORPORATED** |
| 7 | §8.12, §9.2 — shape unverified, fail closed, no `admin_graphql_api_id` assumption | **INCORPORATED** |
| 8 | §8 diagnostic-code list — both codes, distinct meanings | **INCORPORATED** |
| 9 | §19 T41, T42, T50 + "exact-boundary `windowDays` drift" | **INCORPORATED** |

### B. Clocks / concurrency (items 10–18)

| # | Where found | Result |
|---|---|---|
| 10 | §5.1 frozen clock table — matches schema row for row | **INCORPORATED** |
| 11 | §5.1 parent-versioned children, sole writers named | **INCORPORATED** |
| 12 | §5.1 whole-or-nothing; every child discarded; T44 | **INCORPORATED** |
| 13 | §5.1 + §9.5 — reject only `<`; equal re-applies; T45 | **INCORPORATED** |
| 14 | §5.1 — `Refund.updatedAt` evaluated independently, incl. nested refund nodes | **INCORPORATED** |
| 15 | §5.1 + §4.3 — complete pagination ⇒ child ABSENT; incomplete ⇒ no absence, no apply | **INCORPORATED** |
| 16 | §9.1 + §9.4 — `order_transactions/create` subscribed (not merely bounded) | **INCORPORATED** |
| 17 | §5.1 — ascending `(key1,key2)` after dedupe; "may also lock" removed | **INCORPORATED** ⚠ (§13 summary contradicts; `NEW-05`) |
| 18 | §13 required races — all four classes present | **INCORPORATED** |

### C. Query contract (items 19–26)

| # | Where found | Result |
|---|---|---|
| 19 | §4.2 fragments + `ReturnAgreement` | **INCORPORATED** — validator `✅ VALID` |
| 20 | §7.2.1 eligibility table; `UnknownSale` persisted | **INCORPORATED** |
| 21 | §4.2 removed; lineage-only substitute chosen deliberately | **INCORPORATED** |
| 22 | §4.2 "Forbidden" + §3 + §5.11 | **INCORPORATED** |
| 23 | §4.1(4) + §5.3 — equivalence frozen | **INCORPORATED** |
| 24 | §4.2, §4.3, T20 generic | **INCORPORATED** ⚠ (over-broad; `NEW-03`) |
| 25 | §4.5 Bulk C deleted; §3 non-goal; T53; agreement path + request bound | **INCORPORATED** |
| 26 | §4.5 PR6-B gate deliverable + costed fallback + ratio reporting | **INCORPORATED** |

### D. Money (items 27–32)

| # | Where found | Result |
|---|---|---|
| 27 | §6.2 fail-apply; "skip bag" deleted; §15 row updated | **INCORPORATED** |
| 28 | §6.3 required/optional sets per resource | **INCORPORATED** ⚠ (`priceSet` rationale; `NEW-04`) |
| 29 | §6.5 merchant-durable columns + Race Z + §15 writer column | **INCORPORATED** |
| 30 | §6.6 frozen identity + `REFUND_MONEY_UNBALANCED` + T49 | **INCORPORATED** |
| 31 | §6.1 + §3 — no division-derived unit prices | **INCORPORATED** |
| 32 | §6.2 + §5.0 — `Order.currencyCode` survivability sentence | **INCORPORATED** |

### E. Units / edits / refunds (items 33–37)

| # | Where found | Result |
|---|---|---|
| 33 | §7.2 Option A frozen; §5.6 names the ledger table | **INCORPORATED** ⚠ (sign; `NEW-01`) |
| 34 | §19 T47 | **INCORPORATED** ⚠ (contradicts §7.1; `NEW-01`) |
| 35 | §2.1 + §5.4 ordinal identity; T46 | **INCORPORATED** |
| 36 | §7.5 exchange row + `ADJUSTMENT` row | **INCORPORATED** |
| 37 | §7.1 consistent-pair rule; null `Sale.quantity` persisted, never coerced | **INCORPORATED** ⚠ (`NEW-01`) |

### F. Webhooks / import (items 38–41)

| # | Where found | Result |
|---|---|---|
| 38 | PO-02 + §9.2 + §9.3 — option (a); prior wording explicitly replaced | **INCORPORATED** |
| 39 | §9.2 persisted-version dispatch + T51 | **INCORPORATED** |
| 40 | §4.4 + §11.1–11.4 sweep vs sample; healing claim deleted | **INCORPORATED** |
| 41 | §9.1 Monday set — five required topics **plus** `order_transactions/create` | **INCORPORATED** |

### G. Schema / performance / lanes (items 42–50)

| # | Where found | Result |
|---|---|---|
| 42 | §5.3 four denormalized columns + tested invariant + eager backfill | **INCORPORATED** |
| 43 | §5.4, §5.5, §5.6, §14 index set | **INCORPORATED** |
| 44 | §5.0 + §2(9) + §17.2 PR6-A ownership | **INCORPORATED** ⚠ (`NEW-04`) |
| 45 | §17.1/§17.2 — `types.ts` in A; `A → (B ∥ C) → D` | **INCORPORATED** |
| 46 | §5.10 + §17.2 — `roles.ts` in A; `app/types/**` in B | **INCORPORATED** |
| 47 | §2.1 DIRECT/CHILD freeze + §5.1 sequence note | **INCORPORATED** |
| 48 | §2.1 + §5.6 single identity | **INCORPORATED** |
| 49 | §5.11 expanded list | **INCORPORATED** |
| 50 | §4.1(13)(14)(15), §5.4, §5.6 | **INCORPORATED** |

### H. Questions and risks (items 51–56)

| # | Where found | Result |
|---|---|---|
| 51 | PO-07 + §20.1 — Q-PR6-12 closed, "Not negotiable" | **INCORPORATED** |
| 52 | PO-04 + §20.1 — engineering, with the PR6-A schema consequence | **INCORPORATED** |
| 53 | PO-01 / PO-02 — both answered for correctness, not merely re-prioritised | **INCORPORATED** |
| 54 | PO-05 + §7.1 + T17 | **INCORPORATED** |
| 55 | PO-06 + §9.1 — topic required regardless of answer | **INCORPORATED** |
| 56 | §20.2 `Q-012…Q-016`; §21.1 `R-165…R-184` incl. all ten new risks with original severities (`R-175` = P0) | **INCORPORATED** |

### I. Test matrix additions (items 57–70)

All fourteen new cases **T41–T54** are present in §19 with the correct class
(+ / − / bypass / drift) and the expected outcome as specified by the original review.
T47 is present but asserts a value the §7.1 contract contradicts (`NEW-01`).
T20 is present but scoped over-broadly (`NEW-03`).

| # | Case | Present |
|---|---|---|
| 57–70 | T41, T42, T43, T44, T45, T46, T47, T48, T49, T50, T51, T52, T53, T54 | **14 / 14** |

**70-item result: 70 / 70 incorporated in contract text.** Four items (17, 24, 28/44, 33/34/37)
are present but carry residual defects logged in §6. Zero items are claimed-but-absent.
The §25 completion matrix is accurate — it does not over-claim.

---

## 6. New findings

### NEW-CLAUDE-PR6PC-01 — **P1** — Frozen `refunded_units` / `removed_units` arithmetic is sign-inverted against Shopify's signed reversal quantities and against the packet's own T47

**Location:** corrected packet §7.1 (frozen fact-level unit fields), §7.2.2 (dated events),
§15 (unit identity row), §19 T29 / T47 / T54.

**Evidence.** The official Admin GraphQL `2026-07` `order` query page publishes this
response fragment for `agreements { sales }`:

```json
{ "actionType": "ORDER",  "lineType": "PRODUCT", "quantity":  2, "totalAmount": { "shopMoney": { "amount":  "38.28" } } }
{ "actionType": "RETURN", "lineType": "PRODUCT", "quantity": -2, "totalAmount": { "shopMoney": { "amount": "-20.7"  } } }
```

A `RETURN` sale carries a **negative** quantity, consistent with the `SaleLineType`
documentation that refund/return sale records "represent the **reversal** of the original
line item sale value". The `Sale` interface description confirms `quantity` is
"the number of units either ordered **or intended to be returned**" and is a nullable `Int`.

The corrected §7.1 freezes:

> `refunded_units` — "Sum of **agreement-sale** quantities on that line where parent
> `reason ∈ {REFUND, RETURN}` and the sale is variant-unit eligible"
>
> `removed_units` — "… or equivalently `ordered_units - current_units - refunded_units`
> **on a consistent snapshot**"
>
> "If `ordered_units - current_units - refunded_units` … is `< 0` on a consistent snapshot
> pair, do not coerce. Set `unitDiagnosticState=LINE_UNIT_IDENTITY_INCONSISTENT`."

Taking the definitions literally for the packet's own worked example — 3 ordered, 1 refunded:

| Quantity | Value under the frozen definition | Value required by T47 / §15 |
|---|---|---|
| `ordered_units` (`LineItem.quantity`) | 3 | 3 |
| `current_units` (`LineItem.currentQuantity`) | 2 | 2 |
| `refunded_units` (Σ signed RETURN sale quantity) | **−1** | **+1** |
| `removed_units` = `ordered − current − refunded` | 3 − 2 − (−1) = **2** | **0** |

**T47 asserts `refunded_units = 1`, which the frozen §7.1 definition cannot produce.**

**Merchant impact.** Three distinct consequences on a Monday-critical path:

1. `removed_units` is inflated by exactly `2 × refunded_units` on every refunded line —
   a stored, wrong, merchant-derived fact that Phase 2 consumers are meant to read.
2. The `< 0 ⇒ LINE_UNIT_IDENTITY_INCONSISTENT` guard is miscalibrated in the *safe-looking*
   direction: with a negative `refunded_units`, the expression is
   `ordered − current + |refunded|`, which is non-negative for every ordinary refund. The
   integrity diagnostic the packet relies on to detect unit corruption **effectively never
   fires** on the very class of line it was written for. T29 would pass on a broken system.
3. Two implementers reading the same frozen table can reasonably choose opposite sign
   conventions — precisely the "Cursor is invited to invent" failure mode the original
   review's §B.10 clock table was written to close.

Note this is **not** a re-opening of F-CLAUDE-PR6P-07. The Option A ledger itself is
correct: `net_units = Σ signed eligible Sale.quantity` yields 3 + (−1) = 2, and refund
lines are correctly excluded. The defect is confined to the derived unit **fields** layered
on the ledger, and to the diagnostic that guards them.

**Reproduction (design-level, deterministic).** Order 3 units of one variant. Refund 1.
Refetch. `LineItem.quantity = 3`, `currentQuantity = 2`. `Order.agreements` contains an
`ORDER` agreement with a `+3` `ProductSale` and a `REFUND`/`RETURN` agreement with a `−1`
`ProductSale`. Apply §7.1 verbatim: `refunded_units = −1`, `removed_units = 2`.
T47 fails; T29 does not fire.

**Required correction (freeze the sign convention; do not leave it to the lane).**

1. State the ledger sum explicitly: net variant units for a line are
   `Σ signed Sale.quantity` over eligible sales, dated per §7.2.2.
2. Define the derived fields as **magnitudes** of the signed ledger:
   - `refunded_units = −Σ (Sale.quantity of eligible ProductSales whose parent reason ∈ {REFUND, RETURN})`
   - `removed_units  = −Σ (negative Sale.quantity of eligible ProductSales whose parent reason = ORDER_EDIT)`
   - `ordered_units` and `current_units` remain the Shopify line fields unchanged.
   Then `ordered − current − refunded` is the intended identity and `removed_units` is
   directly observable rather than derived, as the original review's Option A anticipated.
3. Replace §7.2.2's hedged "`Sale.quantity` (typically positive)" with the frozen rule:
   `ORDER` sales are positive; `REFUND` / `RETURN` sales and edit removals are negative;
   a `REFUND`/`RETURN` sale with a **positive** quantity is itself an anomaly —
   set `unitDiagnosticState`, persist Shopify's value, never coerce, never negate blindly.
4. Add a test asserting the sign directly against Shopify's documented example
   (`actionType: RETURN`, `quantity: -2`) so the convention is pinned by evidence, and
   restate T47 as "`refunded_units = 1` **and** the underlying RETURN sale row stores `−1`".

---

### NEW-CLAUDE-PR6PC-02 — **P2** — Nested per-parent connection pagination has no legal completion path in the frozen `OrderFactById`, and its failure mode is a permanent silent non-apply

**Location:** corrected packet §4.2 (`OrderFactById` variable set), §4.3 (pagination rules),
§15 ("Incomplete pages" row), §19.

**Evidence.**

1. §4.2 declares **one** `$saleAfter` for the `sales` connection, which is nested inside the
   **paginated** `agreements` connection, and **one** `$refundLineAfter` / `$adjAfter` /
   `$shipRefundAfter` / `$txnAfter` for connections nested inside `refunds`.
2. `Order.refunds` is an **array** (independently re-verified). §4.3 correctly forbids passing
   `first` to it — which also means the response **always** contains **every** refund. There is
   no way to reduce the response to a single refund so that one shared `$refundLineAfter`
   is unambiguous.
3. A single cursor variable cannot address more than one parent's child connection in one
   response. GraphQL cursors are opaque and scoped to their own connection.
4. §4.3 freezes: "Direct `order(id:)` **must** cursor-paginate `lineItems`, `agreements`,
   `sales`, `refundLineItems`, `orderAdjustments`, refund shipping lines, and refund
   transactions until `hasNextPage=false`" and "Incomplete pagination is **not** a
   successful apply."
5. §15's "Incomplete pages" row prescribes "no successful apply" and **"none"** for the
   reconciler `DataIssue` column. No diagnostic code in §8 covers "parent snapshot could
   not be completed."

**Merchant impact.** For an order with ≥2 refunds where any refund's `refundLineItems`
exceeds one page, or ≥2 agreements where any agreement's `sales` exceeds one page, the
frozen document cannot produce a complete snapshot. §4.3 then forbids applying it. The
order is therefore **never applied**, retried indefinitely, and **silently absent** from
demand — with no `DataIssue`, no merchant-durable diagnostic, and no honest signal. It is
fail-closed rather than corrupting, which is the right default, but it is a silent
completeness hole on exactly the heavily-edited, heavily-refunded orders whose agreement
sales the Option A ledger depends on. It also interacts with the §4.5 request-count
envelope, because any real fix costs additional Admin requests that are currently uncounted.

**Reproduction (design-level, deterministic).** An order with two refunds, each with 300
refund line items, at `refundLineFirst = 250`. The first response returns both refunds,
each truncated at 250 with `hasNextPage = true`. Supplying `$refundLineAfter` from either
refund's `endCursor` is invalid for the other. `hasNextPage=false` is unreachable ⇒ §4.3
forbids apply ⇒ the order never lands.

**Required correction (freeze a per-parent walk; it is a contract, not a lane decision).**

1. **Agreements/sales:** freeze the continuation shape — when any agreement reports
   `sales.pageInfo.hasNextPage`, re-issue `OrderFactById` with `agrFirst: 1` positioned by
   `$agrAfter` on that agreement and walk `$saleAfter` to exhaustion. With exactly one
   agreement per response the sale cursor is unambiguous. Alternatively freeze a dedicated
   per-agreement document; either is acceptable, but one must be named.
2. **Refund children:** freeze that `RefundFactById` is the **mandatory** continuation
   whenever any refund child connection in an order response reports `hasNextPage`.
   `RefundFactById` already exists and is per-refund, so its cursors are unambiguous.
   State that a refund whose children were truncated inside an order response contributes
   **no** refund snapshot from that response (consistent with §5.1's refund-Clock-A rule),
   rather than a partial one.
3. Fix `RefundFactById`'s own signature: as written it declares only `($id: ID!)` while
   using `$first` / `$after` in four places. Declare per-connection cursor variables.
4. Add a merchant-durable diagnostic (e.g. `historyWindowState` sibling
   `SNAPSHOT_PAGINATION_INCOMPLETE`) plus a reconciler `DataIssue` so a stalled order is
   **visible**, and replace §15's "none" in that row.
5. Count the continuation requests in the §4.5 envelope alongside the agreement walk.
6. Add a test: an order with two refunds each exceeding one page of refund lines applies
   completely, and a truncated-but-unapplied order raises the new diagnostic rather than
   silently retrying.

---

### NEW-CLAUDE-PR6PC-03 — **P3** — The generalised array-truncation prohibition names `transactions` unqualified, but `Refund.transactions` is a connection; T20 as written would reject correct code

**Location:** §4.2 ("Forbidden in this document"), §4.3 bullet 3, §19 T20.

**Evidence.** §4.3 freezes: "**Never pass `first` on any array field** (`refunds`,
`taxLines`, `transactions`, `discountAllocations`, `duties`)", and T20 is defined as a
negative assertion over that same unqualified list. But the schema shows
`Refund.transactions` is `OrderTransactionConnection!` with `first` / `after` / `last` /
`before` / `reverse` — a connection, not an array. `Order.transactions` is the array. The
packet's own §4.2 document **correctly** passes `transactions(first: $txnFirst, after: $txnAfter)`
to `Refund.transactions`, and that document validates `✅ VALID`.

Because Shopify connections require `first` or `last`, an implementer obeying §4.3
literally would emit an invalid query, and T20 as specified would flag the packet's own
correct document as a violation.

**Required correction.** Qualify the list as **non-connection LIST** fields and name them
by owning type: `Order.refunds`, `Order.transactions`, `LineItem.taxLines`,
`LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties`. Scope T20 to those,
and state that connection fields (`Refund.transactions`, `Refund.refundLineItems`,
`Refund.orderAdjustments`, `Refund.refundShippingLines`, `Order.lineItems`,
`Order.agreements`, `SalesAgreement.sales`) **must** carry `first`/`after`.
Safe direction, non-blocking, no architectural invention.

---

### NEW-CLAUDE-PR6PC-04 — **P3** — Two optionality rules are justified by an incorrect nullability claim

**Location:** §6.3 ("Optional (nullable schema / lineage)" — includes `priceSet` on refund
line), §5.0 (`Shop.ianaTimezone` — "persist null if Shopify omits").

**Evidence.** `RefundLineItem.priceSet` is `MoneyBag!` (non-null) and `Shop.ianaTimezone`
is `String!` (non-null) in 2026-07. Both are treated as possibly-absent.

Both choices are **safe-direction** — treating a non-null field defensively cannot cause a
false fail-apply, and §5.0 correctly fails merchant metric bucketing closed rather than
substituting UTC. The defect is only in the stated justification, which could propagate
into a test fixture or type that expects nullability the API does not produce.

**Required correction.** One line each: state that these fields are **non-null in 2026-07**
and that the optional/defensive handling is a **policy** choice against schema drift and
transport anomalies, not a schema property. Consider moving `priceSet` to the required set
for refund lines, since it is non-null and participates in refund money lineage.

---

### NEW-CLAUDE-PR6PC-05 — **P3** — §13 restates the lock rule in a form that contradicts §5.1

**Location:** §5.1 ("Deterministic Order+Refund lock order") vs §13 (mechanism table).

**Evidence.** §5.1 freezes: "Refund jobs **always** lock the parent Order **and** the Refund
identity. **Order-only jobs lock Order only** (unless the same transaction also applies
refund snapshots from nested refund nodes — then include each Refund GID)." §13's summary
row states: "Advisory lock `stocky-pr6-canonical-lock-v1` | Serialize; **Order+Refund always
both**, ascending `(key1,key2)`, deduped."

The substantive rule in §5.1 is correct, deterministic, deadlock-free under a single total
order, and honours R-161's capacity envelope. §13's compression drops the order-only case.
Since a plan section labelled "frozen" is implementation authority, the two must agree.

**Required correction.** Make §13 point to or echo §5.1's exact rule rather than restate it.

---

### NEW-CLAUDE-PR6PC-06 — **P3** — §4.1's `order_transactions/create` note omits the documented status restriction

**Location:** §4.1(7), §9.1, §19 T36.

**Evidence.** The 2026-07 `WebhookSubscriptionTopic` entry reads: "Occurs when a order
transaction is created **or when it's status is updated**. **Only occurs for transactions
with a status of `success`, `failure` or `error`.**" §4.1(7) records the first sentence only.

This is favourable evidence — the `SUCCESS` transition PO-06 gates on **does** fire, so
PO-06 is implementable — but the omission could lead an implementer to expect a signal on
`PENDING` transaction creation that never arrives, and to mis-specify T36. Pending
transaction facts in fact arrive only via refund refetch, which the plan already requires.

**Required correction.** Add the status restriction to §4.1(7) and note in §7.4/T36 that
`PENDING` transactions are observed through refund snapshots, never through the topic.

---

## 7. Mandatory target re-check

Each of the 31 mandated targets, re-checked directly against the corrected contract text
and, where applicable, against live evidence:

| # | Target | Result |
|---|---|---|
| 1 | Rolling 60-day history cannot produce false tombstones | **PASS** — §8.5/§8.6 three-part predicate; §8.7 permanent retention; §8.10 non-terminal and reversible; T41 |
| 2 | `orders/delete` authority and inaccessible-history behavior | **PASS** — §8.12 in/out-window split; narrow derogation stated in §1; T43 |
| 3 | >60-day refund/edit limitation | **PASS** — §4.7 correctness boundary; `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`; §11.5 refuses a false healing claim |
| 4 | Order parent-versioned child snapshots | **PASS** — §5.1 sole-writer rules per child class |
| 5 | All-or-nothing stale snapshot application | **PASS** — §5.1 + §9.5 + T44 |
| 6 | `Refund.updatedAt` authority | **PASS** — bound independently, incl. nested refund nodes; field re-verified `DateTime!` |
| 7 | Transaction status authority | **PASS** — `order_transactions/create` subscribed; §5.1 forbids treating `createdAt` as a status version |
| 8 | Nullable `RefundLineItem` identity/idempotency | **PASS** — ordinal composite; T46; totality re-verified via `LineItem!` |
| 9 | Deterministic Order+Refund locking | **PASS** (§5.1) — §13 restatement inconsistent (`NEW-05`, P3) |
| 10 | `Sale` concrete fragments and `ReturnAgreement` | **PASS** — validator `✅ VALID` |
| 11 | `UnknownSale` preservation | **PASS** — §7.2.1 "must be persisted, never dropped" |
| 12 | Legal GraphQL fields only | **PASS** — full-document validation; invalid fields removed and added to §3 non-goals |
| 13 | Array truncation protections | **PASS** with over-breadth (`NEW-03`, P3) |
| 14 | Bulk B legality gate/fallback | **PASS** — PR6-B gate deliverable, recorded result, costed fallback, ratio reporting |
| 15 | Illegal Bulk C removed | **PASS** — deleted, listed as a non-goal, T53 |
| 16 | Exactly one unit-event ledger | **PASS** — §5.6/§7.2 name one table; refund lines demoted everywhere |
| 17 | No refund double-subtraction | **PASS** for the ledger; derived-field arithmetic defective (`NEW-01`, P1) |
| 18 | Whole-resource MoneyBag fail-apply | **PASS** — §6.2/§6.3/§15; "skip bag" deleted; T48 |
| 19 | Merchant-durable money/unit diagnostic state | **PASS** — three columns in §5.1/§6.5, written in the tenant transaction |
| 20 | `DataIssue` writer ownership | **PASS** — reconciler-only, Race Z; verified against `manifest.ts` that runtime has zero privileges |
| 21 | Shopify exact-money reconciliation identity | **PASS** — §6.6 six-term identity, exact NUMERIC, no coercion, no invented balancing entry |
| 22 | No division-derived per-unit money | **PASS** — §6.1 + §3 + §19 known-answer vectors |
| 23 | Legacy `SalesDailyAggregate` remains functional | **PASS** — PO-02 / §9.2 / §9.3 / §5.9; verified implementable against `sanitize.server.ts` |
| 24 | `payloadSchemaVersion` compatibility | **PASS** — dispatch on persisted version; T51 |
| 25 | Exhaustive sweep = completeness, sampling = drift only | **PASS** — §4.4, §11.1–11.4, T24 |
| 26 | Realisable indexes and denormalized line fields | **PASS** — §5.3 invariant + eager backfill; §5.6 denormalized `happenedAt`; §14 |
| 27 | `Shop.ianaTimezone` / `Shop.currencyCode` plan | **PASS** — in PR6-A; both fields verified to exist (nullability note = `NEW-04`, P3) |
| 28 | Lane graph `A → (B ∥ C) → D` | **PASS** — see §9 |
| 29 | DIRECT vs CHILD merchant-model / RLS ownership | **PASS** — §2.1 freeze with verified precedent; `roles.ts` in PR6-A |
| 30 | Exact Q/R sequential-ID proposals | **PASS** — `Q-012…Q-016`, `R-165…R-184`; no collision at either observed main; registers untouched |
| 31 | T01–T54 acceptance/test matrix | **PASS** — 54 cases with classes and expectations; T20 and T47 need the `NEW-03` / `NEW-01` edits |

---

## 8. Product-owner decisions — frozen-as-contract verification

Verified that each decision appears as **contract text a runtime lane must implement**,
not as an option, a recommendation, or an open question. None was re-opened by this review.
None is contradicted by repository or Shopify API evidence.

| Decision to verify frozen | Where frozen | Verified against | Result |
|---|---|---|---|
| Pursue `read_all_orders` but correctness never depends on the grant | PO-01; §4.7; §8.6; §16.2; §20.1 | `shopify.app.toml` (scope absent); no scope change in the diff | **FROZEN** |
| Aged-out null is not deletion authority | PO-01; §8.4–§8.6; §8.10 | Official 60-day rolling-window docs; PR 5 `ABSENT_CONFIRMED_QUERY` semantics | **FROZEN** |
| Keep existing legacy `SalesDailyAggregate` projections working | PO-02; §9.1; §9.2; §9.3; §5.9; §3 non-goals | `sanitize.server.ts` v1 projections carry `line_items`; `webhook-processor.ts` reads them | **FROZEN** |
| `net-units-order-date-v1` | PO-03; §7.2.2; §7.3 | Approved PRD velocity definition | **FROZEN** |
| Shop-IANA calendar days | PO-04; §5.0; §7.3 | `Shop.ianaTimezone` verified `String!`; `AGENTS.md` UTC-store / boundary-apply rule | **FROZEN** |
| Test orders excluded from operational demand metrics | PO-05; §7.1; §7.5; T17 | `Order.test` verified | **FROZEN** |
| Refund monetary impact only after transaction `SUCCESS` | PO-06; §7.4; §15; T36 | `Refund` object note that a Refund does not guarantee money moved | **FROZEN** |
| `order_transactions/create` required | PO-06; §9.1; §9.4; §17.2 (PR6-D) | Topic verified; fires on create **or** status update, for `success`/`failure`/`error` | **FROZEN** |
| No BOM explosion | PO-07; §3; §7.5; §23; T40 | `processBomSale` present in legacy code and excluded from the canonical path | **FROZEN** |
| Gift cards / tips / custom non-variant facts retained but excluded from variant demand | PO-08; §7.1; §7.2.1; §16.3; T18 | `GiftCardSale` / `TipSale` carry `lineItem`; other subtypes do not — the storage split is forced by Shopify's type system | **FROZEN** |
| Monday demand is shop-wide if line location is unprovable | PO-09; §7.6; §16.1 | No stable GraphQL line sale-location equivalent to REST `location_id` | **FROZEN** |
| Never canonicalize location as `"default"` | PO-09; §3; §7.6; §23 | `webhook-processor.ts:73,145,190` legacy anti-pattern confirmed | **FROZEN** |

All twelve are faithfully frozen. **No reopening is warranted**, and none is proposed.

---

## 9. Lane graph verdict

```text
PR5 closed
  └─ PR6-A foundation (schema + locks + types.ts + Shop columns
       + denormalized line columns + roles.ts + DIRECT/CHILD)
       ├─ PR6-B admin-read (documents, bulk gate, app/types/**) ─┐
       └─ PR6-C applicator (no Shopify I/O; consumes A types)   ─┴─→ PR6-D webhooks/import
```

**Verdict: ACCEPTED — the graph is correct and maximally parallel within safety.**

Independently checked:

- **The freeze-before-fork rule is honoured.** Everything both B and C must agree on —
  tables, lock version and known-answer vectors, `Shop` columns, denormalized line
  columns, and the types-only `app/lib/order-facts/types.ts` — lands in A. `types.ts` is
  explicitly "no Prisma import, no GraphQL import", so it cannot drag either lane's
  dependencies into the other.
- **PR6-C's dependency is correctly relaxed.** "**Not** blocked on PR6-B merge" is stated
  outright. A pure applicator needs the result *type*, never the reader implementation.
- **File ownership is disjoint and complete.** A owns `prisma/**`, `constants.ts`,
  `lock-key.ts`, `advisory-lock.ts`, `types.ts`, `manifest.ts`, `roles.ts`, `models.ts`.
  B owns `admin-read/**` and `app/types/**`. C owns `apply/**` and is explicitly barred
  from `app/types/**`. D owns the routes, `shopify.app.toml`, `sanitize.server.ts`,
  `job-envelope.server.ts`, `execution-strategy.server.ts`, `webhook-processor.ts`,
  `sync/**`, and the sync-control-plane manifest. The four single-writer files are named
  and assigned to exactly one lane. `app/lib/order-facts/**` does not exist at either
  observed main, so there is no contention to inherit.
- **Merge order and gates.** A = 1, B ∥ C = 2, D = 3; all four Tier A with mandatory
  independent review; no more than two concurrent Cursor lanes; D correctly depends on
  both B and C; A correctly gated behind PR 5 closure.
- **The toml edit is additive-only** and explicitly forbidden from adding `read_all_orders`.

One content caveat, not a graph defect: PR6-B's stated deliverables must include the
per-parent pagination contract that `NEW-CLAUDE-PR6PC-02` says is currently missing,
and its request-count bound must cover the continuation requests.

---

## 10. Remaining genuine questions

The corrected packet leaves exactly five proposed questions plus one pre-existing
out-of-scope question:

| Proposed ID | Question | Storage-neutral? | Blocks safe fact storage? |
|---|---|---|---|
| **Q-012** | Multi-currency ABC: exclude mixed-currency orders vs shop-currency-only vs (forbidden) FX | Yes — both bag sides and per-order `shopCurrencyCode` are persisted | **No** |
| **Q-013** | Which `MoneyBag` is "net sales" / ABC revenue | Yes — §7.4 persists Shopify bags and refuses to rename them in code until it closes | **No** |
| **Q-014** | Location-grain demand identity | Yes — `retailLocationGid` and refund `restockLocationGid` persisted as lineage; no canonical location invented | **No** |
| **Q-015** | Do cancelled unpaid orders contribute `ordered_units`? | Yes — `cancelledAt` / `cancelReason` / `test` all stored; metric-only | **No** |
| **Q-016** | Partner timing of the `read_all_orders` grant | Yes — PO-01 removes the correctness dependency; affects live lookback depth only | **No** |
| Q-004 (pre-existing) | Incoming inventory forecast mix | — | **No** — explicitly out of PR 6 |

**Verified limited to the corrected proposed set.** The eight former questions (Q-PR6-01,
-03, -05, -07, -08, -09, -10, -12) are closed or reclassified in §20.1 with a stated
disposition each, and §20.2 explicitly records "Q-PR6-03 is **not** remaining. Do not leave
BOM or Q-PR6-03 open." No question was silently converted into an engineering decision
without saying so: PO-04 states its reclassification and cites the `AGENTS.md` rule that
supplies the answer, and PO-01/PO-02 state exactly which half was frozen (correctness /
sequencing) and which half remains for the product owner (Partner timing / cutover date).

**The plan does not decide product policy silently.** Where it freezes a decision it
attributes it to the product owner in §C1 and marks the former question closed in §20.1;
where it declines it proposes a `Q-0##` and names what the question blocks.

None of the five remaining questions blocks safe fact storage. Fact storage is
question-neutral by construction: both money bag sides, per-order currency, the `test`
flag, cancellation columns, location lineage, and window state are all persisted
regardless of how Q-012…Q-016 resolve.

---

## 11. Severity counts

| Severity | Count |
|---|---|
| **P0** | **0** |
| **P1** | **1** |
| **P2** | **1** |
| **P3** | **4** |
| **Total** | **6** |

### P0

None. `F-CLAUDE-PR6P-01` is fully corrected.

### P1

| ID | Finding |
|---|---|
| NEW-CLAUDE-PR6PC-01 | Frozen `refunded_units` / `removed_units` arithmetic is sign-inverted against Shopify's signed reversal quantities and against the packet's own T47; the `LINE_UNIT_IDENTITY_INCONSISTENT` guard cannot fire on refunded lines |

### P2

| ID | Finding |
|---|---|
| NEW-CLAUDE-PR6PC-02 | Nested per-parent connection pagination has no legal completion path in the frozen `OrderFactById`; multi-agreement / multi-refund orders fail closed permanently and silently, with no diagnostic |

### P3

| ID | Finding |
|---|---|
| NEW-CLAUDE-PR6PC-03 | Array-truncation prohibition and T20 name `transactions` unqualified; `Refund.transactions` is a connection |
| NEW-CLAUDE-PR6PC-04 | `RefundLineItem.priceSet` and `Shop.ianaTimezone` optionality justified by an incorrect nullability claim (both are non-null) |
| NEW-CLAUDE-PR6PC-05 | §13's lock-mechanism row contradicts §5.1's frozen Order/Refund lock rule |
| NEW-CLAUDE-PR6PC-06 | §4.1(7) omits the documented `success`/`failure`/`error` status restriction on `order_transactions/create` |

Original-review severity comparison:

| Severity | Original head `76a8f33` | Corrected head `11d9cf6` |
|---|---|---|
| P0 | 1 | **0** |
| P1 | 8 | **1** (new; none carried over) |
| P2 | 9 | **1** (new; none carried over) |
| P3 | 6 | **4** (new; none carried over) |

**No original finding is carried forward unresolved.** All six remaining findings were
established by fresh evidence during this re-review.

---

## 12. What the correction gets right

Recorded so a second correction package does not regress it:

- The P0 existence contract is not merely patched but **re-founded**: a third existence
  outcome, a three-part confirmed-absence predicate, a persisted observation-time scope
  snapshot, permanent retention, exclusion from both sampling and nomination, and an
  explicit statement that `INACCESSIBLE_HISTORY_WINDOW` is non-terminal and reversible.
- **PO-01 is stronger than the review asked for.** Rather than escalating the
  `read_all_orders` question, it removes correctness dependence on the grant entirely and
  demotes the grant to a live-lookback-depth question. That is the right architectural
  answer, not the convenient one.
- **PO-02 protects the merchant-visible path.** Refusing to tighten the three existing
  sanitizers, with "no silent period of empty `line_items`" stated as a requirement and
  retirement conditioned on the replacement consumer having reconciled, is exactly the
  discipline `AGENTS.md` demands about hidden formula changes.
- The `DataIssue` write-path correction mirrors PR 5 Race Z precisely instead of inventing
  a new diagnostics mechanism, and §15 now names a writer for every failure row.
- Bulk C is deleted rather than argued with, and Bulk B's unknown legality is converted
  into a **gate deliverable with a costed fallback and a reported ratio** — the honest
  handling of an unverified assumption on a dated path.
- The agreement/sales path explicitly refuses to trade correctness for request count
  ("Do **not** drop agreements to 'save' requests").
- §5.3's denormalization comes with a tested equality invariant, a sole writer, and an
  **eager same-transaction** backfill rule — closing the lazy-backfill drift the review
  did not even have to ask about.
- §5.6 denormalizes `happenedAt` onto the sale row so the unit ledger can be dated without
  a join the Monday envelope cannot afford. Beyond the ask, and correct.
- §6.6 distinguishes bag-parse failure from Shopify-reported sum imbalance and refuses to
  invent a balancing entry — the right instinct about whose numbers are authoritative.
- The `A → (B ∥ C) → D` graph, single-writer file list, and merge order are clean.
- Governance discipline is intact: registers untouched, review artifact byte-identical,
  draft PR, docs-only diff, "independent correction approval is **not** claimed", and
  R-014 explicitly not closed by planning approval.

---

## 13. Approval conditions

Planning correction acceptance requires:

1. `NEW-CLAUDE-PR6PC-01` corrected — freeze the sale-quantity sign convention, redefine
   `refunded_units` / `removed_units` as magnitudes of the signed ledger, and reconcile
   §7.1 with T47 and T29.
2. `NEW-CLAUDE-PR6PC-02` corrected — freeze a per-parent nested-pagination walk for
   agreements/sales and refund children, fix `RefundFactById`'s variable declarations, add
   a snapshot-incomplete diagnostic with a named writer, and count the continuation
   requests in the §4.5 envelope.
3. `NEW-CLAUDE-PR6PC-03` … `-06` applied or explicitly accepted as residual with a
   recorded product-owner decision. All four are safe-direction, non-blocking, and
   require no architectural invention.
4. §0.2 / §22.2 / §24 refreshed for the observed main movement: PR `#31` is **merged**;
   "PR 30/31 must not be used as a base" narrows to PR `#30`; `app/lib/catalog-facts/apply/**`
   on main becomes the reference applicator pattern for PR6-C.

Nothing else is outstanding. Items 1 and 2 are confined to §4.2/§4.3 and §7.1 and require
no re-opening of any product-owner decision, no schema redesign, no lane-graph change, and
no further architecture discovery. On those corrections, PR6-A and then PR6-B ∥ PR6-C
could begin immediately after PR 5 closes.

**PR 6 runtime remains unauthorized. PR 5 must close first. This review does not authorize
implementation, migration, Shopify configuration, or production access. It does not
authorize merge or mark-ready of PR #34.**

---

## 14. Evidence

### 14.1 Commands executed

```text
git fetch origin refs/pull/34/head:refs/remotes/pr/34
git rev-parse refs/remotes/pr/34                      # 11d9cf6f9f759f2ebb1c467f06ea56af69672f9d
git rev-parse 11d9cf6f:.../PR6_..._INDEPENDENT_REVIEW.md   # d72340c01dd9c662d0e8bb4aa8d43482940470d9
git rev-parse 4fd81bae:.../PR6_..._INDEPENDENT_REVIEW.md   # d72340c01dd9c662d0e8bb4aa8d43482940470d9
git diff --stat f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7 11d9cf6f9f759f2ebb1c467f06ea56af69672f9d
git show --stat 11d9cf6f
git log --oneline f65ab4b..11d9cf6f
git fetch origin main                                 # f65ab4b..0284b66
git diff --quiet f65ab4b origin/main -- <each PR6 premise file>
```

### 14.2 GitHub API reads (no writes)

```text
pull_request_read  #34  → OPEN / DRAFT / not merged / base f65ab4b / 3 files / +3278
pull_request_read  #31  → CLOSED / MERGED 2026-09-02T10:32:09Z
list_pull_requests state=open → #34, #33, #32, #30
actions_get        get_workflow_run 33582669186 → pull_request / head 11d9cf6f / success
actions_list       list_workflow_jobs 33582669186 → Classify SUCCESS, CI Gate SUCCESS, Heavy SKIPPED
```

### 14.3 Shopify verification (no store data, no mutations)

```text
graphql_schema Sale, SalesAgreement, Refund, RefundLineItem, Shop
validate_graphql_codeblocks  OrderFactById (full corrected shape)   → VALID
validate_graphql_codeblocks  order(id:){id}, retailLocation probe   → VALID (scope model disjunctive)
search_docs_chunks  WebhookSubscriptionTopic ORDERS_DELETE / ORDER_TRANSACTIONS_CREATE
search_docs_chunks  bulkOperationRunQuery nesting limit
search_docs_chunks  order query agreements/sales response example   → RETURN quantity -2
```

### 14.4 Not executed

- PR #34 modification, rebase, mark-ready, or merge
- PR 6 runtime, schema, migration, GraphQL production document, webhook, or `shopify.app.toml` change
- PR 5 / PR 30 / PR 31 modification
- Edits to the immutable independent review artifact
- Edits to `RISK_REGISTER.md`, `OPEN_QUESTIONS.md`, or `DECISIONS.md`
- Production or merchant data access; Partner Dashboard actions
- Any Shopify mutation

---

**VERDICT: CORRECTIONS REQUIRED**
