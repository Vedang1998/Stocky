# Phase 1 PR 6 — Independent Final Correction Re-Review of the Emergency Order / Refund Facts Planning Packet

**Document type:** Independent final correction re-review report (planning review only)
**Reviewer:** Claude Code (independent)
**Review date:** 2026-09-02
**Reviewed artifact:** `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` (final correction)
**Reviewed PR:** `#34`
**Reviewed branch:** `cursor/pr6-order-refund-planning-87c7`
**Reviewed corrected head (exact):** `f5d429b7b3577c87e67c5ef3445e88560e565a5c`
**Previous reviewed head:** `11d9cf6f9f759f2ebb1c467f06ea56af69672f9d`
**Original reviewed head:** `76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b`
**PR base:** `main` @ `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (PR5-F2A squash merge `#29`)
**`origin/main` observed at review start:** `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`
**`origin/main` observed at review end:** `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` (no movement during this review)
**Shopify Admin API verified against:** `2026-07` (`ApiVersion.July26`)
**Review posture:** Narrow final correction re-review of `NEW-CLAUDE-PR6PC-01 … 06`, one pass, per `ACCELERATED_SAFE_DELIVERY.md`

**PR #34 was not modified.** No runtime, Prisma schema, migration, GraphQL production document,
webhook, or configuration file was changed by this review. PR #34 was not rebased, not marked
ready, and not merged. No PR 5 / PR 30 / PR 31 modification. No production data, no Shopify
mutation. This document is the only artifact committed, on an independent Claude review branch
based on the exact reviewed head `f5d429b7…`, not on PR #34.

**VERDICT: APPROVE PR6 EMERGENCY PLANNING FINAL CORRECTION**

---

## 0. Executive summary

All six outstanding findings — `NEW-CLAUDE-PR6PC-01` (P1), `-02` (P2), and `-03` … `-06` (P3) —
are **completely corrected** in the frozen contract text at `f5d429b7…`. The correction is
narrow and surgical: 2 files, +302 / −92, entirely inside `stocky-plus/docs/**`. It does not
redesign accepted architecture, does not invent product policy, and does not regress any of the
original `F-CLAUDE-PR6P-01 … 24` dispositions.

Verification was performed against the **live** Shopify Admin GraphQL `2026-07` schema, official
`2026-07` documentation, and the merged repository — not against the packet's own claims.

Three results are worth stating plainly, because they are stronger than a compliance check:

1. **PC-01 is not merely reworded — it is now arithmetically correct and adversarially
   falsifiable.** All four mandated falsification scenarios were computed against the frozen
   formulas and the identity holds in every valid-sign case. The sign convention is pinned to
   Shopify's own published `RETURN` / `quantity: -2` response example, which I retrieved
   independently from the `2026-07` `order` query page. Critically, the corrected
   `refunded_units` / `removed_units` definitions restrict the sum to `quantity < 0` and derive a
   **magnitude**, so an anomalous positive `REFUND` sale cannot be silently laundered into a
   plausible-looking value — it raises `UNIT_SALE_SIGN_INCONSISTENT`, preserves Shopify's raw
   value, and suppresses the derived magnitudes as untrustworthy. The `LINE_UNIT_IDENTITY_INCONSISTENT`
   guard, which under the previous head could effectively never fire on a refunded line, is now
   an equality test against an independently observed `removed_units` and genuinely detects
   contradiction.

2. **PC-02's frozen nested walk is mechanically complete, and its central design premise is
   proven, not asserted.** The packet instructs implementers not to assume `SalesAgreement` is a
   generic `Node`. I tested that directly against the live schema: `node(id:) { ... on
   SalesAgreement }` is **rejected** — *"objects of type `Node` can never be of type
   `SalesAgreement`"*. The chosen alternative — a dedicated `OrderAgreementSalesPage` rooted at
   `order(id:)` isolating exactly one agreement via `agreements(first: 1, after: $agreementAfter)`
   — is therefore the correct shape, and it validates `✅ VALID` against the live schema. All four
   mandated nested-pagination falsification scenarios now have a legal completion path, including
   the two-refunds-each-exceeding-one-page case that had **no** legal completion path at the
   previous head.

3. **The silent-failure hole is closed at the right layer.** `SNAPSHOT_PAGINATION_INCOMPLETE`
   lives on `OrderFactObservationInFlight` — an observation row — and the packet explicitly
   forbids creating or partially applying a canonical `ShopifyOrder` / `ShopifyRefund` merely to
   persist the diagnostic. §15's `"none"` is gone. A stalled order is now visibly non-successful
   and reaches a merchant-facing `DataIssue` through `order-facts-reconcile`, which is the only
   component with `DataIssue` write authority under the PR 5 Race Z contract.

Every repository-state statement the packet makes about current `main`, PR `#31`, PR `#30`, and
the post-merge CI run was independently re-verified and is now accurate; the previously-noted
staleness is fully resolved.

Two new P3 observations are recorded. Both are documentation-consistency items whose substance is
already unambiguously resolved elsewhere in the same sections. Neither requires an implementer to
invent architecture, and neither blocks approval.

**P0 = 0. P1 = 0. P2 = 0. P3 = 2 (both nonblocking).**

---

## 1. Reviewed identity and provenance

| Field | Value | Verification |
|---|---|---|
| Repository | `Vedang1998/Stocky` | — |
| Reviewed PR | `#34` | `pull_request_read` — OPEN, **DRAFT**, **not merged**, `mergeable_state: behind` |
| Reviewed branch | `cursor/pr6-order-refund-planning-87c7` | `git fetch origin cursor/pr6-order-refund-planning-87c7` |
| Reviewed head | `f5d429b7b3577c87e67c5ef3445e88560e565a5c` | `git rev-parse origin/cursor/pr6-order-refund-planning-87c7` — **exact match** |
| PR base | `main` @ `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` | PR API `base.sha`; `git merge-base` confirms |
| Commits on PR | 5 | `git log f65ab4b..f5d429b7` |
| Diff vs base | **4 files, +4454 / −0** | `git diff --stat f65ab4b…f5d429b7` |
| Final correction commit scope | 2 files, **+302 / −92** | `git show --stat f5d429b7` |
| Diff classification | Provably docs-only under `stocky-plus/docs/**` | all four paths verified |
| PR #34 modified by this review | **No** | — |
| Runtime modified by this review | **No** | — |

Changed paths on the PR (complete):

```text
stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md                               (+2112)
stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md  (+966)
stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md            (+1373)
stocky-plus/docs/phases/phase-1/README.md                                                                 (+3)
```

Paths touched by the final correction commit `f5d429b7` (complete):

```text
stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md
stocky-plus/docs/phases/phase-1/README.md
```

No `prisma/`, no `app/`, no `scripts/`, no `.github/`, no `shopify.app.toml`, no
`RISK_REGISTER.md`, no `OPEN_QUESTIONS.md`, no `DECISIONS.md`. **Neither immutable review
artifact is in the final correction commit's path list** — the prohibition is satisfied
mechanically, by the commit's own file set, not by assertion.

### 1.1 Immutable original review — byte-identity verification

```text
git ls-tree f5d429b7…  stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md
  → d72340c01dd9c662d0e8bb4aa8d43482940470d9

git hash-object (working tree @ f5d429b7…) …PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md
  → d72340c01dd9c662d0e8bb4aa8d43482940470d9
```

**PASS.** Equals the expected `d72340c01dd9c662d0e8bb4aa8d43482940470d9`. Git blob identity is
content-addressed, so this is proof of byte-identity, not a checksum claim. The original
independent review was **not edited** by the correction. This review does not edit it either.

### 1.2 Immutable correction re-review — byte-identity verification

```text
git ls-tree f5d429b7…  stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md
  → fca2b260d03e3105782ed216f7773c53e6aef2a7

git hash-object (working tree @ f5d429b7…) …PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md
  → fca2b260d03e3105782ed216f7773c53e6aef2a7
```

**PASS.** Equals the expected `fca2b260d03e3105782ed216f7773c53e6aef2a7`. The correction
re-review artifact — cherry-picked from source commit `3260f1a468678ab373c1261d8ed8e8e6f6b6e258`
onto the PR as local commit `aa3c83980922a465e26162dfd0111390a6231029` — was **not edited**.
This review does not edit it either.

### 1.3 Exact-head CI verification

Run [`33668376288`](https://github.com/Vedang1998/Stocky/actions/runs/33668376288), retrieved
independently from the Actions API (not from the PR description):

| Field | Observed | Expected | Result |
|---|---|---|---|
| `event` | `pull_request` | `pull_request` | **PASS** |
| `head_sha` | `f5d429b7b3577c87e67c5ef3445e88560e565a5c` | exact reviewed head | **PASS** |
| Run conclusion | `success` | `success` | **PASS** |
| `Classify change set` (`100375599406`) | **SUCCESS** | SUCCESS | **PASS** |
| `Lint, typecheck, test, build, Prisma, GraphQL` (Heavy, `100375658430`) | **SKIPPED** | SKIPPED | **PASS** |
| `CI Gate` (`100375657131`) | **SUCCESS** | SUCCESS | **PASS** |

All three job IDs match the brief exactly. The Classify job ran its `Classification self-test`
step (SUCCESS) **before** classifying, and Heavy was **skipped rather than failed** — the
correct outcome for a docs-only change set under the `AGENTS.md` CI evidence policy. The run's
`pull_requests` array resolves to `[34]`, and its `head_commit.message` is the final correction
commit message, so the run is bound to this head and this PR, not inherited.

---

## 2. Current-state refresh — independently verified

| Claim in the packet | Independent observation | Result |
|---|---|---|
| PR `#31` is **MERGED** | `pull_request_read #31` — `state: closed`, `merged: true`, `merged_at: 2026-09-02T10:32:09Z`, `merged_by: Vedang1998` | **PASS** |
| `main` = `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` | `git rev-parse origin/main` after fresh fetch | **PASS** |
| Post-merge run `33619969867` | `event: push`, `head_branch: main`, `head_sha: 0284b66c…`, Classify `100214488053` SUCCESS, **Heavy `100214522724` SUCCESS**, CI Gate `100227810337` SUCCESS | **PASS** |
| Only PR `#30` remains an unmerged F2 core | `pull_request_read #30` — OPEN, DRAFT, `merged: false`, `mergeable_state: dirty` (CONFLICTING), head `2d2e8801dd383a778c1237cec4ed068922859cf0` | **PASS** |
| `#31` added `app/lib/catalog-facts/apply/**` plus lock-capacity guards | `git diff --name-only f65ab4b 0284b66` — 19 non-docs paths, all under `catalog-facts/apply/**`, `catalog-facts/lock-capacity*`, `catalog-facts/index.ts`, and one tenant-enforcement test | **PASS** |
| Premise files unchanged by `#31` | `schema.prisma`, `shopify.app.toml`, `sanitize.server.ts`, `webhook-processor.ts`, `tenant/models.ts`, `RISK_REGISTER.md`, `OPEN_QUESTIONS.md` — **none** appear in that diff | **PASS** |
| `app/lib/order-facts/**` does not exist | `ls stocky-plus/app/lib/` @ `0284b66` → `catalog-facts`, `feature-flags.server.ts`, `po-display.ts`, `shop-domain*` only | **PASS — still absent** |

**Main did not advance during this review.** `origin/main` was `0284b66c…` at review start and
`0284b66c…` at review end. No separate recording is required and no stop condition was triggered.

**The staleness noted by the previous correction re-review is fully resolved.** Every location
that previously described PR `#31` as `OPEN DRAFT, CONFLICTING` now records it as merged, and the
blanket *"PR 30/31 must not be used as a base"* has been correctly narrowed to PR `#30` only. I
checked all six locations (§0.2, §17.3, R-173, §22.2, §24, and the header block) — they are
mutually consistent, and `app/lib/catalog-facts/apply/**` on main is now named as the merged
reference applicator pattern for PR6-C. §24's F2A statement (`app/lib/catalog-facts/admin-read/**`
as the read-boundary pattern) also remains true at `0284b66`.

**PR #34 is `behind`, not `dirty`.** This is consistent with the packet's own frozen instruction
that the branch is deliberately not rebased in this pass and that one final current-main
synchronization happens only after PR 5 closes. It is not a conflict and not a defect.

---

## 3. Mandatory PC-01 review — signed units

**Result: `NEW-CLAUDE-PR6PC-01` — CORRECTED.**

### 3.1 Frozen contract as written at `f5d429b7…` (§7.1)

```text
net_units = Σ Sale.quantity
            over eligible ProductSales on that line
            with parent reason ∈ {ORDER, ORDER_EDIT, REFUND, RETURN}
            and Sale.quantity IS NOT NULL

refunded_units = −Σ (Sale.quantity of eligible ProductSales
                     whose parent reason ∈ {REFUND, RETURN}
                     and Sale.quantity < 0)

removed_units  = −Σ (Sale.quantity of eligible ProductSales
                     whose parent reason = ORDER_EDIT
                     and Sale.quantity < 0)

ordered_units − current_units − refunded_units = removed_units
  # only on a consistent valid-sign snapshot
```

### 3.2 Required-element checklist

| # | Required element | Location | Result |
|---|---|---|---|
| 1 | `net_units` = Σ signed eligible `ProductSale.quantity` | §7.1 code block | **PASS** |
| 2 | `refunded_units` = −Σ eligible negative sales, parent reason ∈ {REFUND, RETURN} | §7.1 formulas + field table | **PASS** |
| 3 | `removed_units` = −Σ eligible negative sales, parent reason = ORDER_EDIT | §7.1 formulas + field table | **PASS** |
| 4 | Identity `ordered − current − refunded = removed` only on consistent valid-sign snapshot | §7.1 identity block; §15 row | **PASS** |
| 5 | ORDER and true edit additions positive | §7.1 sign table; §7.2.2 rows | **PASS** |
| 6 | REFUND / RETURN reversals negative | §7.1 sign table; §7.2.2 row | **PASS** |
| 7 | Edit removals negative | §7.1 sign table; §7.2.2 row | **PASS** |
| 8 | Positive `ORDER_EDIT` is an addition, never a removal | §7.1 sign table + `removed_units` field row (*"Positive ORDER_EDIT quantities are additions, never removals"*); §7.2.2 | **PASS** |
| 9 | No blind `abs()` | §7.1 (*"Never `abs()` and never otherwise coerce an unexpected sign"*); §5.6 column rule (*"never `abs()`"*); §15 row | **PASS** |
| 10 | Unexpected sign preserves Shopify raw value and yields `UNIT_SALE_SIGN_INCONSISTENT` | §7.1; §7.2.2 row; §8 code list; §15 row | **PASS** |
| 11 | Misleading derived magnitudes not exposed as trustworthy | §7.1 (*"Derived magnitudes for that inconsistent snapshot must not be represented as trustworthy values"*; *"do not publish trustworthy derived magnitudes"*); §15 row | **PASS** |
| 12 | Refund-line quantity is **not** a second unit ledger | §7.1 (*"Sole unit-event ledger"*, source column *"not refund-line sum"*); §7.2 (*"Do not reintroduce refund-line units into the unit ledger"*) | **PASS** |
| 13 | T47 stores underlying `−1` and derives `refunded_units = 1` | §7.2.2 narrative + §19 T47 | **PASS** |
| 14 | T55 pins `RETURN` quantity `−2` | §19 T55 | **PASS** |
| 15 | T29 / T54 remain capable of detecting actual identity inconsistency | §19 T29 (*"Injected contradictory unit identity … Must detect … Must not pass on a broken system"*), T54 (*"does detect a contradictory identity when one is injected"*), §7.1 closing sentence, §7.5 exchange row | **PASS** |

### 3.3 Independent Shopify evidence

Retrieved directly from the official `2026-07` `order` query documentation page:

```json
{ "actionType": "ORDER",  "lineType": "PRODUCT", "quantity":  2, "totalAmount": { "shopMoney": { "amount":  "38.28" } } }
{ "actionType": "RETURN", "lineType": "PRODUCT", "quantity": -2, "totalAmount": { "shopMoney": { "amount": "-20.7"  } } }
```

The same page carries a second example described as *"sale records with negative quantities,
indicating items that were **removed during edits**"* — which independently confirms the frozen
`ORDER_EDIT` negative-as-removal row, not just the `RETURN` row.

Live schema confirms `Sale.quantity` is a **nullable `Int`** and that the `Sale` interface exposes
no `lineItem` — both consistent with the packet.

Official `2026-07` `LineItem` documentation confirms the two line fields the identity rests on:

- `quantity: Int!` — *"The number of units ordered, **including refunded and removed units**."*
- `currentQuantity` — units ordered **excluding** refunded and removed units.

So `quantity − currentQuantity = refunded + removed` is Shopify's own field semantics, and the
packet's identity `ordered − current − refunded = removed` is a direct restatement of it. The
identity is not an invention; it is grounded.

### 3.4 Signed-unit falsification results

All four mandated scenarios computed against the frozen formulas verbatim. Eligible = variant-unit
`ProductSale` / `PRODUCT`, `Sale.quantity IS NOT NULL`.

| # | Scenario | Ledger rows | `ordered` | `current` | `refunded` | `removed` | Identity | `net_units` vs `current` | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Order 3, refund 1 | ORDER `+3`; REFUND/RETURN `−1` | 3 | 2 | `−(−1) = 1` | 0 | `3 − 2 − 1 = 0` ✔ | `3 + (−1) = 2` ✔ | **HOLDS — cannot falsify** |
| 2 | Order 3, edit-remove 1 | ORDER `+3`; ORDER_EDIT `−1` | 3 | 2 | 0 | `−(−1) = 1` | `3 − 2 − 0 = 1` ✔ | `3 + (−1) = 2` ✔ | **HOLDS — cannot falsify** |
| 3 | Order 3, edit-add 2 | ORDER `+3`; ORDER_EDIT `+2` | 5 | 5 | 0 | 0 (positive edit is an addition) | `5 − 5 − 0 = 0` ✔ | `3 + 2 = 5` ✔ | **HOLDS — cannot falsify** |
| 4 | Refund/return with unexpected **positive** sale | ORDER `+3`; REFUND `+1` | 3 | — | filter `< 0` ⇒ contributes nothing | — | **not evaluated** | — | **Diagnostic fires — correct fail-visible behavior** |

Notes on each:

- **Case 1** is the exact scenario that falsified the previous head. Under the previous frozen
  definition it produced `refunded_units = −1` and `removed_units = 2`, contradicting T47. Under
  the corrected definition it produces `refunded_units = 1` and `removed_units = 0`, matching T47
  exactly.
- **Case 3** was tested under **both** plausible Shopify behaviors for an edit that adds units,
  because the packet does not depend on which one occurs. If Shopify increments the existing
  line, `quantity` becomes 5 and `currentQuantity` becomes 5 — identity holds. If Shopify creates
  a separate line for the addition, line A is `3 − 3 − 0 = 0` and line B is `2 − 2 − 0 = 0` —
  identity holds per line. The formula is per-line and takes `ordered_units` from that line's own
  `quantity`, so it is robust either way. **This is a genuine robustness property, not an
  ambiguity.**
- **Case 4** is the important adversarial one. The `quantity < 0` filter means a positive
  `REFUND` sale contributes **zero** rather than being negated into a magnitude. Had the packet
  frozen `refunded_units = Σ|quantity|` — a superficially equivalent "magnitude" formulation —
  the anomalous `+1` would silently become a plausible `refunded_units = 1` and no diagnostic
  would be warranted. The corrected formulation instead raises `UNIT_SALE_SIGN_INCONSISTENT`,
  persists Shopify's raw `+1`, refuses to evaluate the identity, and forbids publishing the
  derived magnitudes as trustworthy. **The failure is loud rather than plausible.** This is the
  correct direction and is the substantive difference between a real correction and a cosmetic one.

### 3.5 Guard-effectiveness re-check (the previous head's second defect)

Under the previous head the guard was `ordered − current − refunded < 0`. With a negative
`refunded_units` that expression evaluated to `ordered − current + |refunded|`, which is
non-negative for every ordinary refund — so the guard could effectively never fire on the very
class of line it was written for, and T29 would have passed on a broken system.

Under the corrected head the guard is an **equality** test against an independently observed
`removed_units`. I confirmed it can fail: a line with `ordered = 3`, `current = 2`, no
`REFUND`/`RETURN` sale and no negative `ORDER_EDIT` sale yields `3 − 2 − 0 = 1 ≠ 0 = removed_units`
and correctly raises `LINE_UNIT_IDENTITY_INCONSISTENT`. `removed_units` is now **directly
observed** from the ledger rather than derived from the same expression it is meant to check,
which is what makes the test non-circular. T29 and T54 are restated to require detection in both
directions. **The guard is restored to usefulness.**

---

## 4. Mandatory PC-02 review — per-parent pagination

**Result: `NEW-CLAUDE-PR6PC-02` — CORRECTED.**

### 4.1 Required-element checklist (all fourteen)

| # | Required element | Location | Result |
|---|---|---|---|
| 1 | `OrderFactById` retains agreement edge cursors | §4.2 (`agreements { edges { cursor node … } }`, *"retain `agreements.edges.cursor`"*); §4.3(2) | **PASS** |
| 2 | No shared nested `after` cursor in the initial snapshot | §4.2 variable list — `$saleAfter`, `$refundLineAfter`, `$adjAfter`, `$shipRefundAfter`, `$txnAfter` **removed**; listed under *"Forbidden in this document"* | **PASS** |
| 3 | Dedicated `OrderAgreementSalesPage` rooted at `order(id:)` | §4.2 | **PASS** |
| 4 | Isolates exactly one agreement using `agreements(first: 1, after: $agreementAfter)` | §4.2 document body | **PASS** |
| 5 | `$agreementAfter` = cursor immediately preceding the target; `null` valid for the first | §4.2 (*"`null` is valid for the first agreement"*) | **PASS** |
| 6 | Sales pagination then unambiguous through `$saleAfter` | §4.2 + §4.3(3) (*"exactly one agreement per request; walk sales to `hasNextPage=false`"*) | **PASS** |
| 7 | No assumption that `SalesAgreement` is directly fetchable as a generic `Node` | §4.2 (*"Do not assume …"*); §4.3(4) | **PASS — and independently proven necessary, see §4.2 below** |
| 8 | Truncated refund children **must** continue using `RefundFactById` | §4.2 (*"Mandatory continuation whenever any refund child connection in `OrderFactById` is truncated"*); §4.3(3) | **PASS** |
| 9 | `RefundFactById` declares separate first/after pairs for all four child connections | §4.2 corrected signature | **PASS** |
| 10 | An embedded truncated refund contributes **no** partial refund snapshot | §4.2; §4.3(5); §5.8 | **PASS** |
| 11 | Canonical Order/Refund apply waits until every required connection is complete | §4.3(6) | **PASS** |
| 12 | Continuation calls included in the request-count envelope | §4.5 — explicit *"Count `OrderAgreementSalesPage` continuation calls"* and *"Count `RefundFactById` continuation calls"* bullets, plus query-count assertions *"including continuation counts"* | **PASS** |
| 13 | T56 covers multiple refunds with >1 child page | §19 T56 | **PASS** |
| 14 | T57 covers exhausted continuation and no partial canonical apply | §19 T57 | **PASS** |

### 4.2 Live-schema verification of the three frozen documents

All three documents were submitted to the Shopify Admin schema validator against `2026-07`.
Conceptual fragments (`OrderLineFactFields`, `RefundLineFactFields`, `OrderAdjustmentFactFields`)
were materialised from the packet's own §4.2 / §6.3 required-field lists, and `RefundFactById`'s
`{ ... }` placeholders were expanded from the same source.

| Document | Validator result | Required scopes reported |
|---|---|---|
| `OrderFactById` (corrected — no shared nested `after`) | **✅ VALID** | `read_orders`, `read_marketplace_orders`, `read_quick_sale`, `read_locations`, `read_inventory`, `read_markets_home`, `read_products` |
| `OrderAgreementSalesPage` (**new**) | **✅ VALID** | `read_orders`, `read_marketplace_orders`, `read_quick_sale` |
| `RefundFactById` (corrected — per-connection cursor pairs) | **✅ VALID** | `read_orders`, `read_marketplace_orders`, `read_quick_sale`, `read_locations`, `read_inventory`, `read_markets_home` |

`RefundFactById`'s previously-broken signature — it declared only `($id: ID!)` while using
`$first` / `$after` in four places — is fixed. It now declares
`$refundLineFirst/$refundLineAfter`, `$adjFirst/$adjAfter`, `$shipRefundFirst/$shipRefundAfter`,
`$txnFirst/$txnAfter` and validates.

**The `Node` premise is proven, not asserted.** I tested the alternative the packet forbids:

```graphql
query { node(id: $id) { ... on SalesAgreement { id happenedAt reason } } }
```

→ **REJECTED:** *"Fragment cannot be spread here as objects of type `Node` can never be of type
`SalesAgreement`."*

This is the strongest possible confirmation that item 7 is not defensive boilerplate: the obvious
alternative continuation design is illegal, and the packet's `order(id:) { agreements(first: 1,
after:) }` isolation is the correct shape. An implementer who ignored §4.3(4) would write a query
that cannot compile.

### 4.3 Nested-pagination falsification results

| # | Scenario | Walk under the frozen contract | Result |
|---|---|---|---|
| a | Two agreements, each `sales` > 1 page | `OrderFactById` returns both agreements with edge cursors `c₁`, `c₂`, each `sales` first page `hasNextPage=true`. Continuation A: `OrderAgreementSalesPage(agreementAfter: null)` isolates agreement 1; walk `$saleAfter` to exhaustion. Continuation B: `agreementAfter: c₁` isolates agreement 2; walk `$saleAfter` to exhaustion. Exactly one agreement per response ⇒ the sale cursor is unambiguous in both. | **RESOLVABLE — cannot falsify** |
| b | Two refunds, each `refundLineItems` > 1 page | `Order.refunds` is an array so both refunds always appear, each truncated. Neither contributes a partial snapshot (§4.3(5)). Each is then completed by its own `RefundFactById(id: …)` walk, where the cursors are per-refund and unambiguous by construction. | **RESOLVABLE — cannot falsify.** This is the exact case that had **no** legal completion path at `11d9cf6…` |
| c | `refundLineItems` and `transactions` both independently > 1 page on the same refund | `RefundFactById` declares independent first/after pairs per connection and addresses a **single** refund, so each connection's cursor is unambiguous. Advance each cursor independently until its own `hasNextPage=false`; an already-exhausted connection simply returns an empty page. Standard multi-connection walk. | **RESOLVABLE — cannot falsify** |
| d | Bounded-request exhaustion midway through the second parent | No canonical apply (§4.3(6), (10)). No partial refund snapshot (§4.3(5)). `SNAPSHOT_PAGINATION_INCOMPLETE` persisted on `OrderFactObservationInFlight` as a **terminal non-success** outcome (§4.3(11), §5.8). `order-facts-reconcile` derives the `DataIssue`. §15 row updated. T57 asserts it. | **VISIBLE TERMINAL FAILURE — the silent hole is closed** |

### 4.4 Additional adversarial probe: mid-walk order mutation

The corrected design assembles one logical snapshot from multiple requests, which is a new
multi-request surface. I tested whether an order edit landing **between** `OrderFactById` and a
continuation call can corrupt the snapshot or license a false `ABSENT` marking of real sales.

It cannot, and the reasons are structural rather than incidental:

1. **Agreements and their sales are immutable.** The `Sale` interface documentation states the
   allocation across line items *"is immutable. After they are allocated, currency units are never
   reallocated or redistributed."* §5.1 independently freezes `SalesAgreement.happenedAt` as
   *"event time, immutable, not a version."* An order edit therefore **appends a new agreement**;
   it does not mutate an existing agreement's sales. A continuation walking agreement *k* cannot
   observe a changed sale set for agreement *k*.
2. **A newly appended agreement is simply absent from this snapshot.** It is not a stored row that
   could be wrongly marked `ABSENT` — it does not exist in the database yet — so the child-absence
   rule cannot misfire on it. It is created on the next refetch.
3. **Clock A binds to the authoritative initial document, and fails safe.**
   `OrderAgreementSalesPage` deliberately selects only `order { id agreements … }` and **does not**
   select `updatedAt`, so the continuation cannot advance the order's stored Clock A. The stored
   `shopifyUpdatedAt` therefore remains the pre-edit value, which is **older** than the post-edit
   Shopify value — so the `orders/edited` Clock C signal, or the exhaustive `updated_at` sweep,
   produces a refetch that passes the `<`-only gate and repairs. The error direction is
   understated freshness, which is the safe direction.
4. **Refund children keep their own clock.** `RefundFactById` does select `Refund.updatedAt`, and
   §5.1 requires evaluating refund Clock A independently — so each refund's continuation carries
   its own correct version.

**Result: no falsification.** The one residual is documentary, recorded below as
`NEW-CLAUDE-PR6PF-02` (P3): the packet does not *state* that Clock A binds to the initial
`OrderFactById` response across a multi-request assembly. The behavior is closed by construction —
the continuation document does not expose `updatedAt`, so an implementer cannot get it wrong from
the frozen documents — but saying so explicitly would remove a reader's inference step.

I also confirmed that the multi-page `lineItems` walk carries the ordinary mixed-snapshot hazard
(`currentQuantity` is mutable). That hazard is **pre-existing**, not introduced by this correction,
and is already governed by the consistent-snapshot-pair rule (§7.1) and
`LINE_UNIT_IDENTITY_INCONSISTENT` under `F-CLAUDE-PR6P-18`. It is not reopened here.

---

## 5. Diagnostic contract

**Result: PASS.**

| Requirement | Location | Result |
|---|---|---|
| Incomplete pagination uses `OrderFactObservationInFlight` + `SNAPSHOT_PAGINATION_INCOMPLETE` | §4.3(11); §5.8; §8 code list; §15 row | **PASS** |
| Does **not** require a partially-created canonical Order/Refund row merely to store the diagnostic | §4.3(11) and §5.8 both state it verbatim (*"Do not create or partially apply a canonical `ShopifyOrder` / `ShopifyRefund` merely to persist this diagnostic"*) | **PASS** |
| Successful continuation completes the observation | §4.3(11); §5.8 (*"clear/complete the observation normally (`COMPLETED`, `responseGen` set) and apply the complete snapshot under §5.1 clocks"*) | **PASS** |
| Exhausted bounded continuation remains visible as terminal non-success | §4.3(11); §5.8; §15 (*"Visible terminal non-success after bounded retries / request budget"*) | **PASS** |
| `order-facts-reconcile` derives `DataIssue` | §5.8; §15 reconciler column | **PASS** |
| §15 no longer says `"none"` / silent retry for incomplete snapshot | §15 row now reads `SNAPSHOT_PAGINATION_INCOMPLETE` in both writer and reconciler columns and closes with *"Replaces silent/`none`."* | **PASS** |
| Ownership and RLS semantics coherent with the planned merchant-domain observation table | §2 ownership table: `OrderFactObservationInFlight` — merchant_domain, DIRECT-class observation row, **RLS Yes**, explicitly *"not catalog table"*. §5.8: same lifecycle contract as `CatalogObservationInFlight` (`ACTIVE ⇒ responseGen IS NULL`; `COMPLETED ⇒ responseGen NOT NULL`), same lease-helper pattern, **new SQL names**, domain isolation preserved. §5.8 closes with *"This is a merchant-domain observation contract, not a `historyWindowState` sibling on a canonical row that was never applied."* | **PASS** |

The layering choice is the correct one and worth naming explicitly: putting the diagnostic on the
**observation** rather than on a canonical row is what allows the failure to be both *durable* and
*non-applying*. The rejected alternative — a `historyWindowState` sibling — would have required
creating the very canonical row the fail-closed rule forbids. The packet identifies and rejects
that alternative in its own text.

`DataIssue` write authority remains reconciler-only, consistent with the PR 5 Race Z contract and
with `scripts/tenant-enforcement/manifest.ts` on main (runtime holds no `DataIssue` DML privilege).

---

## 6. PC-03 through PC-06

### 6.1 `NEW-CLAUDE-PR6PC-03` — LIST vs connection — **CORRECTED**

LIST fields are now qualified by owning type in **every** location: §3 non-goals, §4.1(10),
§4.2 *"Forbidden in this document"*, §4.3(8), and §19 T20. The named non-connection LIST set is
`Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`,
`LineItem.duties`, `Refund.duties`. §4.3(9) adds the positive rule: connection fields **must**
paginate — `Order.lineItems`, `Order.agreements`, `SalesAgreement.sales`, `Refund.refundLineItems`,
`Refund.orderAdjustments`, `Refund.refundShippingLines`, and **`Refund.transactions`**.

T20 no longer rejects `Refund.transactions` pagination. It is now scoped to the named LIST fields
and carries the explicit negative clause: *"**Must not** flag pagination on connections including
`Refund.transactions`."*

Independently verified against the live schema:

| Field | Schema shape | Accepts `first`? | Packet classification | Result |
|---|---|---|---|---|
| `Refund.transactions` | `OrderTransactionConnection!` with `first`/`after`/`last`/`before`/`reverse` | yes (required) | **connection — must paginate** | **CORRECT** |
| `Refund.refundLineItems` / `orderAdjustments` / `refundShippingLines` | `…Connection!` with full pagination args | yes | connection | **CORRECT** |
| `Refund.duties` | `[RefundDuty!]`, **no args** | **no** — validator: *"Unknown argument `first` on field `Refund.duties`"* | non-connection LIST | **CORRECT** |
| `Order.refunds` | LIST with an optional `first` truncation arg | **yes — silently truncates** | non-connection LIST | **CORRECT** |
| `Order.transactions` | LIST with an optional `first` truncation arg | **yes — silently truncates** | non-connection LIST | **CORRECT** |
| `LineItem.taxLines` | LIST with an optional `first` truncation arg | **yes — silently truncates** | non-connection LIST | **CORRECT** |

The distinction the packet draws is exactly the one that matters operationally: `Order.refunds`,
`Order.transactions`, and `LineItem.taxLines` **accept** `first` and would silently truncate — which
is the real hazard T20 exists to prevent — while `Refund.duties` rejects it at validation time.
Including `Refund.duties` in the T20 set is therefore over-inclusive but strictly harmless (the
test is trivially satisfied), and it keeps the LIST taxonomy complete. Not a defect.

### 6.2 `NEW-CLAUDE-PR6PC-04` — nullability justifications — **CORRECTED**

| Requirement | Result |
|---|---|
| `RefundLineItem.priceSet` treated as `MoneyBag!` / required lineage | **PASS** — moved out of the "Optional" set into the §6.3 **required** Refund-line row (*"`priceSet` (`MoneyBag!` in 2026-07; required refund-line MoneyBag lineage)"*), with a following paragraph stating it is *"a **required** refund-line bag (not optional). Treating a required bag as absent is fail-apply."* It appears in the §5 refund-line fact columns, so the required set and the persisted set agree. No residual listing under "Optional". |
| `Shop.ianaTimezone` is `String!` in 2026-07 | **PASS** — §5.0 row now reads *"`String!` in Admin 2026-07 (target Shopify fact is **non-null**)"* |
| Nullable-first DB migration safety distinguished from Shopify API nullability | **PASS** — *"Additive **nullable-first** Prisma column + backfill is allowed for PR6-A migration safety. That is **not** API nullability."* Followed by *"Defensive transport/schema-drift handling is **policy**, not a schema property."* The same policy-vs-schema sentence is repeated for `priceSet` in §6.3. |
| Missing/malformed authoritative timezone fails closed, no UTC fallback | **PASS** — *"Missing or malformed **authoritative** input **fails closed**. **Never** substitute UTC or server local."* |

Live-schema confirmation: `RefundLineItem.priceSet` is `NON_NULL → MoneyBag`; `Shop.ianaTimezone`
is `NON_NULL → String`; `Shop.currencyCode` is `NON_NULL → CurrencyCode` (the packet's added
`CurrencyCode!` claim is also correct). `RefundLineItem.id` remains nullable `ID` and
`RefundLineItem.lineItem` remains `LineItem!`, so the ordinal-composite identity from
`F-CLAUDE-PR6P-05` remains total — not regressed.

### 6.3 `NEW-CLAUDE-PR6PC-05` — lock rule — **CORRECTED**

§13's mechanism row now defers to §5.1 rather than restating it, and is followed by an explicit
echo block. Compared clause by clause:

| Clause | §5.1 | §13 | Agree? |
|---|---|---|---|
| Refund job locks | Order **and** Refund | Order **+** Refund | **Yes** |
| Order-only job locks | Order **only**, unless the same transaction also applies refund snapshots from nested refund nodes — then include each Refund GID | Order **only** unless the same apply includes refund snapshots (then include each Refund GID) | **Yes** |
| Acquisition order | Ascending `(key1, key2)` **after dedupe** | Dedupe, then ascending `(key1, key2)` | **Yes** |
| Shopify I/O under lock | *"Do not hold advisory locks across Shopify I/O"* | *"no Shopify I/O under advisory lock"* | **Yes** |
| *"Order+Refund always both"* | absent | explicitly negated twice: *"There is **no** 'Order+Refund always both' rule"* / *"No contradictory 'Order+Refund always both' summary"* | **Yes** |

The contradiction is removed, and the sections are cross-referenced in both directions (§13 names
§5.1; the C2c cross-reference table lists Locks → §5.1, §13). R-161 capacity honouring and the
`5000ms` `lock_timeout` are retained.

### 6.4 `NEW-CLAUDE-PR6PC-06` — transaction topic status restriction — **CORRECTED**

Independently verified against the official `2026-07` webhook topic documentation:

> *"**order_transactions/create** — Occurs when a order transaction is created or when it's status
> is updated. **Only occurs for transactions with a status of `success`, `failure` or `error`.**"*

| Requirement | Location | Result |
|---|---|---|
| Documented as firing on create **or status update**, for `success`/`failure`/`error` only | §2 (PO-06 rationale), §4.1(7), §5.1 clock table `OrderTransaction` row, §9.1 webhook table, §7.4 | **PASS — five locations, mutually consistent** |
| `PENDING` comes through refund snapshots | §2, §4.1(7), §5.1 row (*"PENDING status is observed through refund snapshots, never through this webhook"*), §7.4 | **PASS** |
| T36 reflects that | §19 T36 — restated as *"Refund transaction **PENDING** present only on a refund snapshot (no `order_transactions/create` webhook) … Do **not** require a PENDING webhook."* Also reflected in the §19 clock-races paragraph. | **PASS** |

The packet also correctly retains the favourable consequence: the `SUCCESS` transition PO-06 gates
on **does** fire, so PO-06 remains implementable.

---

## 7. Regression check against the original `F-CLAUDE-PR6P-01 … 24`

Per the brief, already-corrected original findings were not reopened. I checked only whether the
final correction **regressed** any of them. It did not. The five dispositions the correction
amended are all strengthened rather than weakened:

| Finding | Amendment | Regression? |
|---|---|---|
| `F-CLAUDE-PR6P-07` | Option A ledger retained; derived fields given a frozen sign convention | **No** — the ledger definition is unchanged; only the derived layer was fixed |
| `F-CLAUDE-PR6P-08` | Array-truncation prohibition qualified by owning type; connections required to paginate | **No** — the prohibition's protective scope is preserved for every field that can actually truncate |
| `F-CLAUDE-PR6P-17` | Nullability statements corrected; fail-closed timezone retained | **No** — fail-closed behavior unchanged |
| `F-CLAUDE-PR6P-18` | Consistent-snapshot-pair rule retained, now qualified "valid-sign"; T29/T54 strengthened | **No** — strictly stronger detection |
| `F-CLAUDE-PR6P-24` | §13 aligned to §5.1 | **No** — §5.1, the substantive rule, is unchanged |

Spot-checked and unchanged: the `Order.cancellation` / `priceAfterAllDiscountsBeforeTaxesSet` /
`Sale.lineItem` prohibitions (§3, §4.1); Bulk C deletion (§4.5, T53); `UnknownSale` persistence
(§7.2.1); whole-resource MoneyBag fail-apply with no "skip bag" (§6.3, T48); reconciler-only
`DataIssue` authority (§5.1, §15); the rolling-60-day non-tombstone predicates (§8); the
`A → (B ∥ C) → D` lane graph (§9, §17); and the in-plan `R-165…R-184` / `Q-012…Q-016` proposals
with `RISK_REGISTER.md` and `OPEN_QUESTIONS.md` untouched.

The §25 completion matrix is extended with `PC-01 … PC-06` rows rather than rewritten, and item 24
and item 34 are updated in place to match the new contract text — so the matrix does not claim
anything the contract does not say.

---

## 8. New findings

Two new P3 observations. Both are documentation-consistency items. Neither changes behavior,
neither requires an implementer to invent architecture, and the substance of each is already
resolved unambiguously within the same section.

### NEW-CLAUDE-PR6PF-01 — **P3** — §4.3(9)'s "connection fields must paginate with `first`/`after`" reads as a blanket rule that `OrderFactById`'s deliberate first-page-only `sales(first: $saleFirst)` appears to violate

**Location:** §4.3(9) vs §4.2 (`OrderFactById` body and its bullet list).

**Evidence.** §4.3(9) reads: *"**Connection fields must paginate** with `first`/`after`:
`Order.lineItems`, `Order.agreements`, `SalesAgreement.sales`, …"*. But §4.2 deliberately and
correctly specifies `sales(first: $saleFirst)` with **no** `$saleAfter` on `OrderFactById`, and
lists a shared `$saleAfter` on that document under *"Forbidden in this document."*

**Merchant impact.** None directly. The intent is unambiguous two rules earlier — §4.3(3) states
that first-page `sales` on `OrderFactById` are *"not a complete nested walk"* and must continue
via `OrderAgreementSalesPage` — and §4.2's bullet list spells out the same thing. A reader who
consults §4.3(9) in isolation could nonetheless reintroduce a shared `$saleAfter` on
`OrderFactById`, which is precisely the shape `NEW-CLAUDE-PR6PC-02` was raised against. The
countervailing evidence is strong: the "Forbidden in this document" list names that variable
explicitly, so the mistake is caught by reading the same section.

**Expected behavior.** §4.3(9) should be read as *"connection fields must carry pagination
arguments (`first` at minimum, `after` where that document owns the walk)"* rather than as a
requirement that every document pass `after` on every connection.

**Recommended correction (nonblocking).** One clause in §4.3(9): note that on `OrderFactById`,
`SalesAgreement.sales` intentionally carries `first` only, and the `after` walk belongs to
`OrderAgreementSalesPage`.

**Missing test.** None required — T20 is correctly scoped to LIST fields and would not, and should
not, flag this.

**Why this is not P2.** The contract text that governs implementation (§4.2's document body, its
bullet list, its forbidden list, and §4.3(3)) is complete, correct, and mutually consistent. Only
a cross-reference sentence is loose.

### NEW-CLAUDE-PR6PF-02 — **P3** — The multi-request snapshot assembly does not explicitly state that Clock A binds to the initial `OrderFactById` response

**Location:** §4.3(3)/(6) and §5.1 snapshot-atomicity block.

**Evidence.** §4.3(6) says *"canonical apply occurs only after every required connection **for that
snapshot** is complete"*, which correctly treats a multi-request assembly as one snapshot. §5.1's
gate is defined on `response.updatedAt` vs `stored.shopifyUpdatedAt`. Neither section states which
response supplies `updatedAt` when the snapshot spans an initial call plus continuations.

**Merchant impact.** None in practice, and the safe outcome is closed by construction:
`OrderAgreementSalesPage` selects only `order { id agreements … }` and does not expose `updatedAt`,
so no continuation can advance the order's Clock A. As analysed in §4.4 above, the resulting error
direction is understated freshness, which guarantees repair on the next `orders/edited` signal or
exhaustive sweep rather than a stale-but-confident apply. `RefundFactById` does select
`Refund.updatedAt`, which is correct, because §5.1 requires refund Clock A to be bound
independently.

**Expected behavior.** `Order` Clock A for a multi-request snapshot is the `updatedAt` from the
authoritative initial `OrderFactById` response; continuation responses never advance it.

**Recommended correction (nonblocking).** One sentence in §4.3 or §5.1 stating the above.

**Missing test.** Optionally extend T56 to assert that a continuation does not advance stored
`shopifyUpdatedAt`.

**Why this is not P2.** The frozen documents make the wrong behavior unreachable — the field is not
selectable in the continuation document — so an implementer following the contract cannot get it
wrong. This records an inference the reader currently has to make, not a gap they have to fill.

---

## 9. Prohibition compliance

| Prohibition | Status | Evidence |
|---|---|---|
| No edits to PR #34 | **Complied** | This review commits only to `claude/pr6-order-refund-final-review-bvooa0`, based on `f5d429b7…`; nothing pushed to `cursor/pr6-order-refund-planning-87c7` |
| No runtime | **Complied** | Only one new `.md` under `stocky-plus/docs/phases/phase-1/` |
| No Prisma / schema | **Complied** | — |
| No migrations | **Complied** | — |
| No GraphQL production documents | **Complied** | Validation was performed on documents extracted from the packet into a scratch directory outside the repository; no repository GraphQL file was created or modified |
| No webhook / config changes | **Complied** | — |
| No PR 5 modifications | **Complied** | PR #30 and PR #31 inspected read-only |
| No mark-ready | **Complied** | PR #34 remains DRAFT |
| No merge | **Complied** | PR #34 remains open and unmerged |
| No production data | **Complied** | Only schema introspection, operation validation, and public documentation were used; no store data accessed |
| No Shopify mutations | **Complied** | No mutation constructed or executed |
| Immutable artifacts unedited | **Complied** | Both blobs re-verified at `f5d429b7…` and in the working tree; neither appears in the final correction commit's path list |

---

## 10. Severity ledger

| Severity | Count | IDs |
|---|---|---|
| **P0** | **0** | — |
| **P1** | **0** | `NEW-CLAUDE-PR6PC-01` **CORRECTED** |
| **P2** | **0** | `NEW-CLAUDE-PR6PC-02` **CORRECTED** |
| **P3** | **2** | `NEW-CLAUDE-PR6PF-01`, `NEW-CLAUDE-PR6PF-02` — both nonblocking; `PC-03` … `PC-06` all **CORRECTED** |

Both residual P3s are genuinely nonblocking under the approval standard: implementation does not
have to invent architecture for either. Every architectural decision they touch is already frozen
and internally consistent in the same section.

---

## 11. Verdict

**APPROVE PR6 EMERGENCY PLANNING FINAL CORRECTION**

`NEW-CLAUDE-PR6PC-01` through `-06` are completely corrected at
`f5d429b7b3577c87e67c5ef3445e88560e565a5c`. The correction introduced no new P0, P1, or P2
planning defect, and regressed none of the original `F-CLAUDE-PR6P-01 … 24` dispositions.

The signed-unit contract survives all four mandated falsification attempts and now fails loudly
rather than plausibly on an unexpected sign. The nested per-parent pagination contract is
mechanically complete, its central premise is proven against the live schema rather than asserted,
all three frozen documents validate, and the previously silent permanent non-apply is now a
visible terminal diagnostic on the correct table.

Two P3 documentation-consistency observations are recorded and are accepted as residual.

**This is a planning verdict only.** It does not authorize PR 6 runtime, does not mark PR #34
ready, does not merge, and does not close PR 5. PR 6 runtime remains gated on PR 5 closing, with
PR #30 still an unmerged F2 core.

---

READY FOR CHATGPT PR6 FINAL PLANNING ACCEPTANCE DECISION
