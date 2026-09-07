# Phase 1 PR 6 — Independent Early Tier-A Architecture Review of the Emergency Order / Refund Facts Planning Packet

**Document type:** Independent review report (planning review only)
**Reviewer:** Claude Code (independent)
**Review date:** 2026-09-02
**Reviewed artifact:** `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md`
**Reviewed PR:** `#34`
**Reviewed branch:** `cursor/pr6-order-refund-planning-87c7`
**Reviewed head (exact):** `76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b`
**Authorized planning base:** `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (PR5-F2A squash merge `#29`)
**Shopify Admin API verified against:** `2026-07` (`ApiVersion.July26`)
**Review posture:** EARLY exhaustive Tier-A red-team, one pass, per `ACCELERATED_SAFE_DELIVERY.md`

**PR #34 was not modified.** No runtime, schema, migration, GraphQL document, webhook,
or configuration file was changed by this review. This document is the only artifact
committed, on an independent Claude review branch based on `f65ab4b9…`, not on PR #34.

**VERDICT: CORRECTIONS REQUIRED**

---

## 0. Executive summary

The packet is strong on governance, tenancy inheritance, exact-decimal discipline,
PII minimisation, non-goals, and legacy anti-pattern identification. It correctly
refuses to invent forecast policy, correctly refuses to extend `SalesDailyAggregate`,
and correctly isolates product decisions.

It is **not** implementation-grade. Independent verification against the live
Shopify Admin GraphQL `2026-07` schema and against the merged repository found
**1 P0**, **8 P1**, **9 P2**, and **6 P3** planning defects.

The single most serious defect is not a query typo. It is a **deletion-contract
soundness failure**:

> The packet reuses PR 5's `ABSENT_CONFIRMED_QUERY` rule verbatim, but PR 5's rule
> is grounded on the fact that a deleted Shopify **product** GID is *structurally
> terminal*. That grounding does **not** transfer to orders. Under the app's
> current `read_orders`-only scope, `order(id:)` returns null for **every order
> older than a rolling 60 days**. Applying the packet's rule as written tombstones
> the entire order history of every shop, permanently, and the history cannot be
> re-fetched because it is outside the permitted window.

All three ChatGPT-supplied candidate findings are **independently reproduced**.
Two of them are more severe than proposed. PR6-PLAN-01 is P0 rather than P1;
PR6-PLAN-03 is P1 rather than P2 (`orders/delete` **does** exist in 2026-07 and
the packet asserts it does not).

Approval requires no unresolved P0/P1/P2 planning defects. Eighteen exist.

---

## 1. Reviewed PR / head / base

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Reviewed PR | `#34` |
| Reviewed branch | `cursor/pr6-order-refund-planning-87c7` |
| Reviewed head | `76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b` |
| Authorized planning base / `origin/main` | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` |
| Diff scope (verified) | 2 files, +1346 / −0 — `PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md` (+1345), `phases/phase-1/README.md` (+1) |
| Diff classification | Provably docs-only under `stocky-plus/docs/**` — satisfies `AGENTS.md` CI evidence policy §3 |
| PR #34 modified by this review | **No** |
| Runtime modified by this review | **No** |

Commands executed for this review:

```text
git fetch origin cursor/pr6-order-refund-planning-87c7
git diff --stat f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7 76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b
git show 76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b:stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN.md
git rev-parse HEAD   # f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7 (review branch base)
```

Repository state independently confirmed at `f65ab4b9…`:

| Packet claim | Verification result |
|---|---|
| Scopes `read_orders` present, `read_all_orders` / `write_orders` absent | **CONFIRMED** — `shopify.app.toml` line 8: `read_products,write_products,read_inventory,write_inventory,read_orders,read_locations` |
| API version `2026-07` | **CONFIRMED** — `shopify.app.toml` `api_version = "2026-07"`; `.graphqlrc.ts` `ApiVersion.July26` |
| Subscribed order topics: `orders/create`, `orders/cancelled`, `refunds/create` | **CONFIRMED** |
| Legacy `parseFloat` money in `webhook-processor.ts` | **CONFIRMED** — lines 94, 98, 169, 216 |
| Legacy `locationId = "default"` | **CONFIRMED** — lines 73, 145, 190 |
| Legacy `processBomSale` explosion | **CONFIRMED** — line 102 |
| `forecasting.server.ts` uses 90-day window and `Number(revenue)` | **CONFIRMED** — line 235 (`- 90`), lines 252/260/276/288 (`Number(...)`) |
| `stocky_catalog_observation_gen_seq` exists and is reusable | **CONFIRMED** — `prisma/migrations/20260816193000_pr5_catalog_fact_foundation/migration.sql:778` |
| `stocky-pr5-canonical-lock-v1` is the frozen catalog lock version | **CONFIRMED** — `app/lib/catalog-facts/constants.ts:6` |
| `SyncCursor.syncDomain` is `VarChar(64)` (proposed domains fit) | **CONFIRMED** — `prisma/schema.prisma:963` |
| Unknown job types fail closed `NO_AUTOMATIC_RETRY` | **CONFIRMED** — `app/sync/execution-strategy.server.ts:23,35,48` |
| `app/lib/order-facts/**` does not yet exist | **CONFIRMED** |

---

## 2. Shopify API verification (Admin GraphQL 2026-07)

Method: live schema introspection and operation validation through the Shopify
developer tooling (`graphql_schema`, `validate_graphql_codeblocks`) plus official
`shopify.dev` 2026-07 documentation reads. No production or merchant store data
was accessed. No mutation was constructed or executed.

### 2.1 Verified TRUE in the packet

| Packet assertion | Result |
|---|---|
| Default Admin order access is the last 60 days without `read_all_orders` | **TRUE** — official `order` query page (2026-07): "You can only retrieve the last 60 days worth of orders from a store by default." |
| `LineItem.quantity` includes refunded and removed units | **TRUE** — schema description verbatim |
| `LineItem.currentQuantity` excludes refunded and removed units | **TRUE** |
| `MoneyBag.shopMoney` / `presentmentMoney`; `MoneyV2.amount` is `Decimal` | **TRUE** |
| A `Refund` object does not guarantee money moved; check `OrderTransaction.status` | **TRUE** — verbatim note on the `Refund` object; `refunds/create` topic adds "independent from the movement of money" |
| `Order.refunds` is an **array** with an optional truncating `first`, not a connection | **TRUE** — `refunds` validates both with and without `first`; `first` is a truncation argument |
| `LineItem.variant` and `LineItem.product` are nullable | **TRUE** |
| Bulk: ≤5 connections, ≤2 nesting levels, `first` ignored, `groupObjects` false | **TRUE** |
| `refund(id:)` root query exists | **TRUE** — validated, requires `read_orders` |
| `orders(query: "updated_at:>=…")` filtering exists | **TRUE** — validated with `sortKey: UPDATED_AT` |
| `Sale.quantity` is signed (negative for edit removals) | **TRUE** — official `order` query example: "This example retrieves sale records with negative quantities, indicating items that were removed during edits." |
| `Order` fields `confirmed`, `test`, `edited`, `taxesIncluded`, `retailLocation`, `subtotalLineItemsQuantity`, `currentSubtotalLineItemsQuantity`, `netPaymentSet`, `totalRefundedSet`, `refundDiscrepancySet`, `cartDiscountAmountSet`, `currentCartDiscountAmountSet` | **ALL VALID** |
| `Refund.refundShippingLines`, `Refund.transactions`, `Refund.orderAdjustments` connections | **ALL VALID** |
| `Order.agreements` with `... on OrderEditAgreement / RefundAgreement { refund { id } } / OrderAgreement` | **VALID** |

### 2.2 Verified FALSE in the packet

| Packet assertion | Result |
|---|---|
| `Sale` exposes `lineItem` | **FALSE** — validator: `Cannot query field "lineItem" on type "Sale". Did you mean to use an inline fragment on "GiftCardSale", "ProductSale", or "TipSale"?` |
| `LineItem.priceAfterAllDiscountsBeforeTaxesSet` | **FALSE** — field does not exist on `LineItem` |
| `Order.cancellation { reason … }` | **FALSE** — `OrderCancellation` has exactly one field: `staffNote` |
| "Shopify does not provide an `orders/delete` topic" | **FALSE** — `WebhookSubscriptionTopic.ORDERS_DELETE` exists: "The webhook topic for `orders/delete` events. Occurs whenever an order is deleted. Requires the `read_orders` scope." |
| `orders { agreements { sales } }` is "two nested connections — at the official bulk depth limit" | **FALSE** — the top-level connection counts. This is three levels and exceeds the documented maximum of two. |
| `RefundLineItem.id` usable as canonical identity | **FALSE (unsound)** — `RefundLineItem.id` is **nullable** `ID` in 2026-07 |

### 2.3 Newly established facts the packet does not account for

| Fact | Source | Consequence |
|---|---|---|
| `LineItem` has **no** `createdAt` / `updatedAt` | schema | No child Clock A |
| `RefundLineItem` has **no** timestamps | schema | No child Clock A |
| `OrderAdjustment` has **no** timestamps | schema | No child Clock A |
| `SalesAgreement` has only `happenedAt` (event time, immutable); `Sale` has **no** timestamps | schema | No child Clock A |
| `OrderTransaction` has `createdAt` + nullable `processedAt` but **no `updatedAt`**, while `status` is mutable | schema | Mutable child with zero version authority |
| `Refund.updatedAt` **is** `DateTime!` (non-null) | schema | Refund **does** have its own Clock A — the packet never binds it |
| `Refund.createdAt` is **nullable** | schema | Packet implies non-null |
| Every `LineItem` money bag (`originalTotalSet`, `discountedTotalSet`, `totalDiscountSet`, `discountedUnitPriceSet`, `discountedUnitPriceAfterAllDiscountsSet`) explicitly **includes refunded and removed quantities** | schema descriptions | There is **no** current-quantity line money field |
| `LineItem.refundableQuantity` description is identical to `currentQuantity`: "The number of units ordered, excluding refunded units and removed units" | schema | The packet treats them as independent inputs |
| Concrete `Sale` subtypes: `ProductSale`, `GiftCardSale`, `TipSale`, `AdjustmentSale`, `DutySale`, `FeeSale`, `ShippingLineSale`, `UnknownSale`. Only the first three carry `lineItem`. **`ProductSale` has no `variant` field.** | validated | Variant-unit history must resolve through `lineItem`, in the same snapshot |
| `SalesAgreement.reason` is `OrderActionType!` ∈ {`ORDER`, `ORDER_EDIT`, `REFUND`, `RETURN`, `UNKNOWN`}; a `ReturnAgreement` type also exists | schema + docs | The agreement-level reason is the only available refund/edit discriminator |
| `SaleLineType` docs: refund sale records "represent the **reversal** of the original line item sale value" | schema | Refund reversals are already present in the agreement/sale stream |
| `ORDER_TRANSACTIONS_CREATE` fires "when a order transaction is created **or when its status is updated**" | schema | This is the only signal for pending→success refund money |
| `LineItem.taxLines(first:)`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties`, `Order.transactions(first:)` are arrays | schema | Same silent-truncation class as `Order.refunds`; only `refunds` is guarded in the packet |
| `LineItem.staffMember`, `Refund.staffMember`, `SalesAgreement.user`, `OrderTransaction.user` / `accountNumber` / `receiptJson` / `paymentDetails` / `device` exist | schema | Additional PII surfaces not on the packet's forbidden list |

---

## 3. Order deletion / access-window findings

### F-CLAUDE-PR6P-01 — **P0** — Rolling 60-day access window converts the absence contract into total history destruction

*(Reproduces and escalates ChatGPT PR6-PLAN-01.)*

**Location:** packet §4.7, §8.4, §8.7, §10.8, §15 ("Currency mismatch" row's neighbours), §16.1 item 8, T34.

**Evidence.**

1. Official 2026-07 `order` query page: "You can only retrieve the last 60 days worth of orders from a store by default. If you want to access older orders, then you need to request access to all orders."
2. The window is **rolling**, expressed relative to *now*, not to a fixed date. The `Order` object page states the same: "Only the last 60 days' worth of orders from a store are accessible from the `Order` object by default."
3. Current granted scope is `read_orders` only (`shopify.app.toml:8`). `read_all_orders` is absent and the packet explicitly declines to add it (Q-PR6-10).
4. Packet §8.4: "Tombstone orders only with `ABSENT_CONFIRMED_QUERY` (`order(id:)` returns null)."
5. PR 5 brief §6.F.3 defines `ABSENT_CONFIRMED_QUERY` as "Direct GraphQL refetch **completed** and Shopify reported the identity absent / **unqueryable**." The word *unqueryable* literally covers a window-aged order.
6. PR 5's rule is sound only because of its stated grounding, quoted in the same table: "Official `productDelete` docs (2026-07): product deletion is **irreversible** — after a confirmed delete the GID is structurally terminal in Shopify's normal identity model." **No equivalent grounding exists for orders.** A null `order(id:)` under `read_orders` is ambiguous between *deleted*, *never existed*, and *aged past the permission window*.

**Merchant impact.** Every order fact the app has ever stored becomes eligible for
tombstoning approximately 60 days after the order's creation. The
`order-facts-reconcile` job (§11.3, "For a sampled set of LIVE facts, refetch
`order(id:)` … mismatches → `DataIssue` and repair apply") is a scheduled,
per-shop, recurring process. Within one reconcile cycle after the first orders
age out, the shop's demand history is progressively marked ABSENT. Because the
data is outside the permitted window, it **cannot be re-fetched**: the loss is
unrecoverable without a Partner-approved `read_all_orders` grant that does not
exist. Last-X, custom-range, same-period-last-year, ABC/U, and low-stock ranking
all silently degrade toward empty. This satisfies the `CLAUDE.md` P0 definition
("destructive … corruption, unrecoverable data loss").

**Reproduction (design-level, deterministic).** Ingest an order on day 0. Let the
app run. On day 61, run `order-facts-reconcile`. `order(id:)` completes and
returns `null`. Packet §8.4 + PR 5 §6.F.3 ⇒ `existenceState=ABSENT`,
`existenceKind=ABSENT_CONFIRMED_QUERY`, `deletedAt` set. Repeat daily; the entire
history tombstones on a 60-day trailing edge.

**Aggravating sub-cases the packet also does not cover.**

- **Aging across the boundary mid-flight.** An observation may open (`requestGen`)
  while the order is inside the window and complete after it leaves. Nothing in
  the packet's clock-B interval rules detects this.
- **Terminal revival is unreachable.** PR 5 requires two independent
  non-overlapping LIVE confirmations to revive a terminal tombstone (§6.F.7,
  Race AB). An aged-out order can **never** produce even one LIVE confirmation, so
  a false tombstone is *permanently* irreversible by design.
- **Bulk omission.** §10.8 nominates absence candidates for orders "previously LIVE
  but omitted", guarded only by "**only if** the run is complete and the 60-day
  window is understood." "Understood" is not a predicate. PR 5 forbids
  `ABSENT_FULL_SYNC_SWEEP` as single-epoch authority precisely to prevent this.
- **Scope loss.** If a merchant's grant changes (`app/scopes_update` is already
  subscribed), previously-accessible history becomes null. The packet has no rule
  that existence conclusions are void when the effective scope set changes.

**Required correction (deletion / existence contract — must be frozen, not deferred).**

1. `order(id:) == null` is **NOT** confirmed absence for order-domain facts.
   Introduce a third existence outcome distinct from LIVE and ABSENT:
   `existenceKind = INACCESSIBLE_HISTORY_WINDOW` with
   `existenceState` **unchanged** (the last unambiguous state is preserved).
2. Absence may only be *confirmed* when **all** of these hold:
   - the completed query returned null, **and**
   - the order is provably inside the accessible window at observation time —
     i.e. `storedProcessedAt` (or `shopifyCreatedAt`) `>= observedAt − windowDays`,
     using a configured `orderHistoryWindowDays` (60) that is a named constant,
     **and**
   - the effective token scope set at observation time is recorded on the
     observation and has not lost `read_orders` / `read_all_orders` relative to
     the last LIVE confirmation.
   When `read_all_orders` **is** granted, the window predicate is satisfied
   unconditionally and the PR 5 rule applies unchanged.
3. Orders outside the window are **retained forever** as historical facts with
   `attributeFreshnessState` marking them frozen. They are excluded from reconcile
   sampling and from absence nomination. Freezing is not degradation: a completed
   order's units and money are immutable in practice, and the app already holds
   the last authoritative snapshot.
4. Bulk omission may **never** nominate an order older than the window. Candidate
   nomination is restricted to orders whose `processedAt` is inside the window of
   the bulk run's own fence.
5. Add `DataIssue` reason code `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` (30 chars,
   fits `VarChar(64)`) distinct from `ORDER_HISTORY_WINDOW_TRUNCATED`, which is
   about *import depth*, not *existence*.
6. Add tests: aged-out refetch must NOT tombstone (negative); in-window null must
   tombstone (positive); boundary order at exactly `windowDays` (drift); scope
   downgrade must void absence authority (bypass).

### F-CLAUDE-PR6P-02 — **P1** — `orders/delete` exists in 2026-07; the packet asserts it does not and plans no handling

*(Reproduces and escalates ChatGPT PR6-PLAN-03.)*

**Location:** packet §8.7 ("Shopify does not provide an `orders/delete` topic in the current app subscriptions"), §9.1 table row (`orders/delete` — "not in 2026-07 topic enum as currently used" — "not planned").

**Evidence.** `WebhookSubscriptionTopic` in Admin GraphQL 2026-07 contains:

```text
ORDERS_DELETE — "The webhook topic for `orders/delete` events.
                 Occurs whenever an order is deleted. Requires the `read_orders` scope."
```

The scope requirement is already satisfied by the current grant. No Partner
approval, no scope change, and no `read_all_orders` is needed to subscribe.

**Merchant impact.** Combined with F-CLAUDE-PR6P-01 the packet has *no* sound
deletion path at all: the only planned path (confirmed-null refetch) is unsound,
and the one sound path (an explicit deletion signal) is declared nonexistent. A
genuinely deleted order is either never tombstoned (stale facts inflate demand
forever) or is tombstoned by a rule that also destroys valid history.

**Required correction.**

1. Correct the factual claim in §8.7 and §9.1.
2. Add `orders/delete` to the Monday signal set in PR6-D
   (`shopify.app.toml` + `app/routes/webhooks.orders.delete.tsx` + identity
   sanitizer + `webhook:orders/delete` job type). The topic is not optional
   given (1) — it is the replacement authority.
3. Define its authority precisely, and do **not** simply invert PR 5's
   "signal is never authority" rule:
   - **Inside the window:** signal → authoritative `order(id:)` re-check.
     Null ⇒ `ABSENT_CONFIRMED_QUERY` (PR 5 semantics, unchanged).
     Live ⇒ stale-signal diagnostic, no tombstone (PR 5 Race H).
   - **Outside the window:** re-check cannot confirm anything. Record
     `existenceKind = ABSENT_SIGNALLED_DELETE_UNVERIFIED`,
     `deletionSource = DELETE_WEBHOOK`, and set `existenceState = ABSENT`
     **without destroying the stored fact rows** — this is the one case where a
     signal is the best available authority, and the derogation must be explicit
     and narrow rather than implicit.
   - Historical line/refund/agreement children are **retained** in both cases
     (packet §8.6 already says this; it must be restated for the delete path).
4. Verify the `orders/delete` payload shape empirically before implementing the
   sanitizer. **Not verified by this review:** the 2026-07 webhook reference page
   excerpt available to this session did not include an `orders/delete` sample
   payload. Treat the field set as unknown; the identity sanitizer must fail
   closed on anything it does not recognise, and must not assume
   `admin_graphql_api_id` is present.

### F-CLAUDE-PR6P-03 — **P1** — Refunds and edits on orders older than 60 days are permanently unobservable; the packet treats the window as an import-depth issue only

**Location:** packet §4.7 (scoped entirely to historical lookback), §9.3, §11.

**Evidence.** §4.7 discusses the window solely as a *lookback depth* limitation
("ABC/U last eight weeks (56 days) may fit; Last-X of 90 days … will not"). But
`refunds/create` fires for a refund on an order of **any** age, and `orders/edited`
likewise. The packet's authoritative apply path (§9.3) is
`signal → order(id:) → apply`. For a 6-month-old order the refetch returns null.

Under the packet as written, that null is `ABSENT_CONFIRMED_QUERY` — so a *refund
on an old order* would tombstone the order. Even after F-CLAUDE-PR6P-01 is fixed,
the refund itself remains unrecordable: `refund(id:)` returns `Refund.order` typed
`Order!`, and the refund's own accessibility follows its parent order's.

**Merchant impact.** Refund and edit activity on orders older than the window is
invisible to the fact store. Net units and net sales overstate demand for any
merchant with a return window longer than 60 days — which is common. §11.4's claim
that "Missed webhooks are healed because reconcile is authoritative refetch" is
false for this class: reconcile cannot reach the resource either.

**Required correction.** State the limitation explicitly as a **correctness
boundary**, not a depth preference; emit `DataIssue`
`REFUND_OUTSIDE_ACCESSIBLE_WINDOW` when a refund/edit signal names an
inaccessible parent; record the signal's existence so the gap is auditable; and
escalate Q-PR6-10 (`read_all_orders`) from "post-Monday" to a decision required
**before PR6-D**, because without it the refund ledger is knowingly incomplete
and no honest "exact reconciliation to Shopify-reported values" (Phase 1 brief,
PR 6 acceptance) can be claimed.

---

## 4. Child-clock findings

### F-CLAUDE-PR6P-04 — **P1** — No version authority exists for any order child resource, and the packet does not define one

*(Reproduces ChatGPT PR6-PLAN-02; independently confirmed against the schema and extended.)*

**Location:** packet §5.1 ("`shopifyCreatedAt` / `shopifyUpdatedAt` (clock A) **where Shopify exposes them**"), §9.5, §13.

The phrase "where Shopify exposes them" is the entire treatment. It is a gap
marker, not a contract. Schema-verified authority per fact type:

| Fact type | Clock A source (verified) | Clock B existence source | Clock C signal | Packet status |
|---|---|---|---|---|
| Order | `Order.updatedAt` (`DateTime!`) | `order(id:)` — **unsound alone**, see §3 | `orders/create`, `orders/cancelled`, `orders/edited`, `orders/delete` | Defined (existence unsound) |
| **Refund** | **`Refund.updatedAt` (`DateTime!`) — EXISTS** | `refund(id:)` / presence in `Order.refunds` | `refunds/create` | **Authority exists but is never bound** |
| LineItem | **NONE** | presence in parent order snapshot | none | Undefined |
| RefundLineItem | **NONE** | presence in parent refund snapshot | none | Undefined |
| OrderAdjustment | **NONE** | presence in parent refund snapshot | none | Undefined |
| SalesAgreement | `happenedAt` — **event time, immutable; not a version** | presence in `Order.agreements` | `orders/edited` | Undefined |
| Sale | **NONE** | presence in parent agreement | none | Undefined |
| OrderTransaction | **NONE** (`createdAt` immutable, `processedAt` nullable) while **`status` is mutable** | presence in `Refund.transactions` | `order_transactions/create` (fires on status update) — not subscribed | Undefined; worst case |

**Consequences the packet leaves open.**

1. **No all-or-nothing rule.** §9.5 says "A stale refetch with older `Order.updatedAt`
   **must not** overwrite newer attributes" — but only for *attributes*. Nothing
   says the **children carried in that same stale response** must be rejected. A
   stale order response can therefore legally overwrite fresher line quantities,
   refund lines, and agreement sales while its own order row is correctly
   protected. This is a silent, race-only demand corruption path.
2. **`OrderTransaction.status` can never be refreshed** on its own authority.
   Q-PR6-07 (money counts only when a transaction is `SUCCESS`) is unimplementable
   as specified, because nothing tells the app the status changed.
3. **Cursor is invited to invent a child versioning scheme.** The review brief
   explicitly forbids this; the packet's silence is the invitation.

**Required correction — freeze this exact contract.**

1. **Children are parent-versioned.** The only legal writer of `ShopifyOrderLineFact`,
   `ShopifyOrderAgreementFact`, `ShopifyOrderAgreementSaleFact` is an **order**
   snapshot apply. The only legal writer of `ShopifyOrderRefundLineFact`,
   `ShopifyOrderAdjustmentFact`, `ShopifyOrderRefundTransactionFact` is a **refund**
   snapshot apply (from `refund(id:)` or from the refund node inside an order
   refetch).
2. **Snapshot atomicity.** A parent snapshot is applied **whole or not at all**.
   If the parent clock-A gate rejects the response, **every** child derived from
   that response is discarded. No partial application.
3. **Gate is strict.** Reject only `response.updatedAt < stored.shopifyUpdatedAt`.
   Equal `updatedAt` **must** re-apply (idempotent repair), because child changes
   that do not bump the parent's `updatedAt` would otherwise be permanently
   unreachable.
4. **Bind `Refund.updatedAt`.** Refund rows carry their own clock A. A refund node
   arriving inside an order refetch must pass the *refund's* own clock-A gate
   independently of the order gate, so an older order snapshot cannot regress a
   newer refund and vice versa.
5. **Child completeness = child existence.** Absence of a child GID from a
   **complete, fully-paginated** parent snapshot marks that child
   `existenceState=ABSENT` scoped to the parent; it never tombstones the parent
   and never deletes the row. Incomplete pagination ⇒ no child absence at all.
6. **Subscribe `order_transactions/create`** (schema-verified to fire on status
   update) as the transaction clock C, or explicitly record that transaction
   status is refreshed only as a by-product of refund refetch and that Q-PR6-07
   therefore carries a known staleness bound.
7. Add races: stale-order-response-with-fresh-children (must reject wholesale);
   equal-`updatedAt` child repair (must apply); refund-newer-than-order and
   order-newer-than-refund interleavings; transaction pending→success with no
   parent bump.

### F-CLAUDE-PR6P-05 — **P1** — `RefundLineItem.id` is nullable in 2026-07, so the refund-line identity and idempotency contract is unfounded

**Location:** packet §2.1 (`ShopifyOrderRefundLineFact` identity `(shopId, shopifyGid)`), §5.4 ("Refund line identity: `RefundLineItem.id`"), T05.

**Evidence.** Schema introspection of `RefundLineItem` returns
`"name":"id","type":{"name":"ID","kind":"SCALAR"}` — i.e. `ID`, **not** `ID!`.
Every other identity the packet relies on (`Order.id`, `LineItem.id`,
`Refund.id`, `OrderAdjustment.id`, `Sale.id`, `SalesAgreement.id`) is `ID!`.

**Merchant impact.** T05 ("Duplicate refund GID twice → `refunded_units` not
doubled") is the packet's only stated guarantee against double-counting refunded
units, and it is keyed on a field Shopify does not guarantee. A fail-closed
reader rejects the whole refund; a permissive reader inserts duplicate rows and
double-subtracts units. Both outcomes are demand corruption.

**Required correction.** Freeze a null-safe identity:
`@@unique([shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal])`
where `refundLineOrdinal` is the zero-based position within the **complete,
fully-paginated** `refundLineItems` connection, persisted alongside a nullable
`shopifyGid` retained as lineage. Because `RefundLineItem.lineItem` is `LineItem!`
(verified non-null) and the connection order is stable within a snapshot, this
identity is total. Add a test asserting a null-`id` refund line is ingested,
idempotent on re-apply, and does not double-count.

---

## 5. Query / schema findings

### F-CLAUDE-PR6P-06 — **P1** — `SalesAgreement`/`Sale` query shape is invalid; concrete subtypes and eligibility rules are missing

*(Reproduces ChatGPT PR6-PLAN-04, first half.)*

**Location:** packet §4.2 `OrderFactById` — `sales { … node { … lineItem { id } } }`; §5.6.

**Evidence.** Validator output on the packet's own shape:

```text
Cannot query field "lineItem" on type "Sale".
Did you mean to use an inline fragment on "GiftCardSale", "ProductSale", or "TipSale"?
```

Full concrete-type enumeration (validated): `ProductSale`, `GiftCardSale`,
`TipSale`, `AdjustmentSale`, `DutySale`, `FeeSale`, `ShippingLineSale`,
`UnknownSale`. Only the first three expose `lineItem`. **`ProductSale` exposes no
`variant` field** — variant identity at sale is reachable only via
`lineItem { variant { id } }`, i.e. only from a snapshot that also contains the line.

**Required correction.** Replace the conceptual selection with the schema-valid form:

```graphql
sales(first: $saleFirst, after: $saleAfter) {
  pageInfo { hasNextPage endCursor }
  edges { cursor node {
    __typename
    id
    quantity
    lineType
    actionType
    totalAmount { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    ... on ProductSale  { lineItem { id } }
    ... on GiftCardSale { lineItem { id } }
    ... on TipSale      { lineItem { id } }
  } }
}
```

and freeze the eligibility rule:

| `SaleLineType` / concrete type | Variant-unit history eligible? |
|---|---|
| `PRODUCT` / `ProductSale` | **Yes** — the only source of variant-attributable unit deltas |
| `GIFT_CARD` / `GiftCardSale` | Line-attributable; excluded from variant demand pending Q-PR6-08 |
| `TIP` / `TipSale` | Line-attributable; never variant demand |
| `SHIPPING`, `DUTY`, `FEE`, `ADDITIONAL_FEE`, `ADJUSTMENT`, `UNKNOWN` | **No line link.** Money-reconciliation only. Persist with null `lineItemGid`; never a unit event |

`UnknownSale` must be persisted, not dropped — Shopify documents it as the
forward-compatibility carrier for future sale types, and dropping it silently
breaks money reconciliation on a future API version.

### F-CLAUDE-PR6P-07 — **P1** — Agreement sales and refund lines both post refunded units; the frozen event model double-subtracts

**Location:** packet §7.2 dated-events table, §5.6.

**Evidence.**

- §7.2 posts an **Agreement sale** event (`Shopify Sale.quantity`, at `happenedAt`)
  **and** a **Refund line** event (`−RefundLineItem.quantity`, at refund
  `processedAt`) as two independent rows, with no exclusion rule between them.
- `SalesAgreement.reason` is `OrderActionType!` ∈ {`ORDER`, `ORDER_EDIT`, `REFUND`,
  `RETURN`, `UNKNOWN`}, and `RefundAgreement` / `ReturnAgreement` are concrete
  agreement types. So the agreement stream **already contains** refund reversals.
- `SaleLineType` documentation confirms this directly: "Shopify produces a sales
  agreement with sale records for each line item that is **returned or refunded** …
  The sales records for the returned or refunded items represent the **reversal**
  of the original line item sale value."

Every refunded unit is therefore represented twice: once as a `RETURN`-action sale
under a `REFUND`/`RETURN` agreement, and once as a refund-line event.

**Merchant impact.** Refunded units are subtracted twice. Net units go negative on
refund-heavy variants; Last-X velocity and ABC/U rank are wrong in the
merchant-visible direction (under-ordering). §5.6's claim that agreements are
"how PR 6 distinguishes **edit-removed units** from **refunded units**" is
precisely inverted — as written the two overlap completely.

**Required correction.** Freeze **one** of these, explicitly, in §7.2:

- **Option A (recommended).** Agreement sales are the sole unit-event ledger.
  Filter by `SalesAgreement.reason`: `ORDER` ⇒ original units; `ORDER_EDIT` ⇒ edit
  delta; `REFUND` / `RETURN` ⇒ refund delta. Refund-line facts remain stored as
  money, restock, and reconciliation evidence, and are **not** unit events.
  This also makes `removed_units` directly observable rather than derived.
- **Option B.** Refund lines are the refund unit ledger; agreement sales are
  filtered to `reason ∈ {ORDER, ORDER_EDIT}` only.

Whichever is chosen, add the discriminator to `ShopifyOrderAgreementFact`
(`reason` is already proposed) and make the exclusion a tested invariant, not
prose. Add test: order 3 units → refund 1 unit → assert `refunded_units = 1`
(not 2) with both agreement and refund facts present.

### F-CLAUDE-PR6P-08 — **P2** — Invalid and semantically duplicated fields in the conceptual documents

**Location:** packet §4.2, §4.5 Bulk A.

| Field | Status | Correction |
|---|---|---|
| `LineItem.priceAfterAllDiscountsBeforeTaxesSet` | **Does not exist** in 2026-07 | Nearest valid field is `discountedUnitPriceAfterAllDiscountsSet` (a **unit** price, and it includes refunded/removed quantities). Choose deliberately; do not substitute silently |
| `Order.cancellation { reason staffNote }` | `OrderCancellation` has **only** `staffNote` | `reason` is invalid. `staffNote` is the operational-PII field the packet itself forbids persisting. **Drop the entire `cancellation` selection.** `Order.cancelReason` (already selected) is the enum the packet actually wants. This also removes the "query then discard PII" pattern in §4.2, which needlessly moves free-text staff notes into process memory and error payloads |
| `LineItem.refundableQuantity` | Valid, but its schema description is identical to `currentQuantity` ("The number of units ordered, excluding refunded units and removed units") | Persist for lineage, but §7.1 must **not** treat it as independent evidence. State the equivalence explicitly so no formula depends on a difference that does not exist |
| Array-truncation hazards | Only `Order.refunds` is guarded | `LineItem.taxLines(first:)`, `Order.transactions(first:)`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties` are also arrays. Extend the §4.3 "never pass `first` to an array field" rule to **all** array fields, and make T20 a generic assertion rather than a `refunds`-only one |

### F-CLAUDE-PR6P-09 — **P2** — Bulk C exceeds the documented bulk nesting limit; Bulk B legality is asserted as unknown on a Monday-critical path

**Location:** packet §4.5.

**Evidence.** Official bulk-operations guidance (2026-07) and
`bulkOperationRunQuery`: "The query must include at least one connection field and
supports up to **five connections with a maximum nesting depth of two levels**."
The top-level connection counts toward the depth — the documentation's own
invalid example is `products { variants { images } }`-style three-level nesting.

- **Bulk A** — `orders { lineItems }` — 2 levels. **Legal.**
- **Bulk C** — `orders { agreements { sales } }` — **3 levels. Illegal.** The packet
  states it is "two nested connections — at the official bulk depth limit". That is
  incorrect, and it is the packet's designated Monday-critical path for separating
  edit-removed from refunded units.
- **Bulk B** — `orders { refunds { refundLineItems } }` — `refunds` is an **array**,
  not a connection. The bulk documentation does **not** address non-connection list
  fields at all. **Genuinely unverified.** The packet flags this correctly, but
  then lists Bulk B as Monday-critical with no costed fallback.

**Required correction.**

1. Remove Bulk C. Freeze the fallback as the primary: paginated
   `order(id:) { agreements { sales } }` for orders with `edited = true` **or**
   any refund present, driven off the Bulk A result set. Bound and record the
   resulting request count against the 1,000,000-order-line envelope — this is a
   per-order round trip and must not become an N+1 that violates the Phase 1
   "no N+1 Shopify requests" rule.
2. Make Bulk B's legality a **PR6-B gate deliverable**: submit the candidate
   document to the schema/bulk gate and record the result. If arrays are not
   traversable in bulk, the fallback is per-order refund refetch for orders where
   Bulk A reports refund presence — cost that must be stated before Monday
   scoping, not discovered during PR6-D.
3. Note that if F-CLAUDE-PR6P-07 Option A is adopted, agreements become the unit
   ledger, which makes the agreement path *more* critical, not less — this
   interacts and must be resolved in the same correction package.

### F-CLAUDE-PR6P-10 — **P2** — Claimed index cannot exist; the Monday aggregation query has no supporting index

**Location:** packet §5.2, §5.3, §14.

**Evidence.** §14 requires "indexed `(shopId, processedAt)`,
`(shopId, variantGidAtSale, processedAt)`, `(shopId, shopifyGid)`" and states
Monday "may query facts with `GROUP BY variantGidAtSale` over a date range."
But §5.2 places `processedAt` on `ShopifyOrderFact` and §5.3 places
`variantGidAtSale` on `ShopifyOrderLineFact`. **The composite index spans two
tables and cannot be created.** The stated Monday query becomes a join of a
1,000,000-row line table against the order table with no covering index, against
a Phase 1 brief target of p95 < 500 ms.

Additionally, §14 lists **no** index for `ShopifyOrderAgreementSaleFact` on
`lineItemGid` / `happenedAt`, which — under F-CLAUDE-PR6P-07 Option A — becomes
the primary unit-derivation table.

**Required correction.** Denormalise the order's dated fields onto the line fact
in PR6-A: `orderProcessedAt`, `orderCancelledAt`, `orderTest`,
`orderShopCurrencyCode`, each written **only** by the order snapshot applicator
and covered by a tested invariant that they equal the parent. Then
`@@index([shopId, variantGidAtSale, orderProcessedAt])` is realisable. Add
`@@index([shopId, shopifyLineItemGid])` on refund lines and agreement sales, and
`@@index([shopId, shopifyOrderGid])` on every child. State the backfill rule for
the denormalised columns when the parent's `processedAt` changes.

---

## 6. Money findings

### F-CLAUDE-PR6P-11 — **P1** — "skip bag / fail apply" is ambiguous, snapshot atomicity is undefined, and the diagnostics the packet relies on cannot be written by the applicator

**Location:** packet §6.2, §15 ("Currency mismatch | DataIssue; skip bag / fail apply"), §7.1, §4.7.

**Evidence — ambiguity.** §6.2 says "fail closed with `DataIssue MONEY_CURRENCY_MISMATCH`
and do not apply **that bag**", while §15 says "skip bag **/** fail apply". These are
opposite semantics. "Skip bag" produces a canonical row that is partially fresh —
some money columns from observation *n*, others from *n−k* — with no column-level
provenance to say which. That is exactly the "HEALTHY-by-assertion over broken
facts" pattern the packet itself warns against in §24.

**Evidence — diagnostics cannot be written.** Verified in the merged repository:

```text
scripts/tenant-enforcement/manifest.ts:940
  { prismaModel: "DataIssue", sqlTable: "DataIssue",
    classification: "platform_control_plane",
    rlsRequired: false,
    expectedRuntimePrivileges: [],          # <-- no runtime DML
    notes: "Discrepancy scaffolding" }
```

`DataIssue` is control-plane with **zero** runtime privileges, and the packet's own
§12 confirms "Control-plane tables stay non-DML for runtime". So the applicator —
running as `stocky_runtime` inside the tenant transaction — **cannot** write the
`DataIssue` rows that §15 makes the entire failure contract depend on.

PR 5 solved this with merchant-durable diagnostic columns on the fact itself plus
a reconciler that derives the control-plane `DataIssue` (PR 5 §6.F, Race Z:
"Fact commits `DEGRADED` … Process dies before `DataIssue` write. Reconciler
recreates the `DataIssue`"). The packet inherits `existenceDiagnosticState` in
§5.1 — but that is **existence**-scoped. There is no durable home for
`MONEY_CURRENCY_MISMATCH`, `LINE_UNIT_IDENTITY_INCONSISTENT`, or
`ORDER_HISTORY_WINDOW_TRUNCATED`. Each is lost on crash, and the merchant-visible
honesty guarantee is unfounded.

**Required correction.**

1. **Choose fail-apply.** One invalid required `MoneyBag` on a canonical resource
   rejects the **entire snapshot** for that resource. No partial-freshness model.
   Rationale: `AGENTS.md` requires exact reconciliation to Shopify-reported
   amounts, and a row whose bags come from different observations cannot be
   reconciled to any single Shopify state. Retry is cheap (apply is idempotent);
   a silently mixed row is not detectable later.
2. Define "required" explicitly. Recommended required set per resource:
   Order — `currentTotalPriceSet`, `currentSubtotalPriceSet`, `totalRefundedSet`;
   LineItem — `originalTotalSet`, `originalUnitPriceSet`, `totalDiscountSet`;
   RefundLineItem — `subtotalSet`, `totalTaxSet`, `priceSet`;
   Refund — `totalRefundedSet`; OrderAdjustment — `amountSet`, `taxAmountSet`.
   Nullable-in-schema bags (e.g. `OrderTransaction.amountRoundingSet`) are optional
   and their absence is never a failure.
3. Add **merchant-durable** diagnostic columns on the fact rows —
   `moneyDiagnosticState`, `unitDiagnosticState`, `historyWindowState` — written
   in the same tenant transaction, with the control-plane `DataIssue` derived by
   the existing reconciler path. Mirror PR 5 Race Z exactly.
4. State who writes `DataIssue` for every row of §15. "→ DataIssue" is not an
   assignment of responsibility.

### F-CLAUDE-PR6P-12 — **P2** — No frozen money-reconciliation identity, and no per-unit money derivation rule

**Location:** packet §5.5, §6.3, §7.4; Phase 1 brief PR 6 acceptance ("Exact reconciliation to Shopify-reported values").

**Evidence.**

- §5.5 says adjustments are "Needed to reconcile `totalRefundedSet` vs sum(refund
  lines)+shipping+adjustments" — but never writes the equation, never says what
  tolerance applies (§6.3 says exact, not epsilon), and never says what happens
  when it does not balance.
- Schema-verified: **every** `LineItem` money bag includes refunded and removed
  quantities. There is no current-quantity line money field. So any "value of the
  units that actually sold" must be derived by division
  (`originalTotalSet / quantity`), which is not exact in `NUMERIC` for
  non-divisible amounts. The packet mandates exact decimal arithmetic and exact
  equality reconciliation but never states the per-unit derivation rule or its
  rounding policy — while §6.1 simultaneously forbids "silent 2-decimal rounding".
- The `Sale` interface documentation warns that currency units are allocated
  one-at-a-time across line items and that "In isolation, one line item might have
  a different tax or discount amount than another line item of the same price".
  Any per-unit division therefore cannot be assumed to reproduce Shopify's
  allocation.

**Required correction.** Freeze the reconciliation identity, e.g.

```text
Refund.totalRefundedSet.shopMoney
  == Σ RefundLineItem.subtotalSet.shopMoney
   + Σ RefundLineItem.totalTaxSet.shopMoney
   + Σ RefundShippingLine.subtotalAmountSet.shopMoney
   + Σ RefundShippingLine.taxAmountSet.shopMoney
   + Σ OrderAdjustment.amountSet.shopMoney
   + Σ OrderAdjustment.taxAmountSet.shopMoney
```

as a **stored, tested invariant** with `DataIssue REFUND_MONEY_UNBALANCED` on
mismatch (never a coercion), and state explicitly that **PR 6 does not derive
per-unit money by division**. Where per-unit value is later required, the
authoritative source is `Sale.totalAmount` (which Shopify allocates) or
`RefundLineItem.subtotalSet`, not a computed quotient. This belongs in the plan
because it constrains the schema PR6-A must land.

### Money items verified sound

- Exact `MoneyV2.amount` Decimal string → `NUMERIC`/`Decimal(20,6)`; currency
  persisted per bag side; `requireDecimalString` fail-closed. **Sound.**
- Both bag sides persisted; `shopMoney` only for operational metrics; no app FX.
  **Sound and correctly justified.**
- Shop currency change over time is handled correctly: each order carries its own
  `Order.currencyCode`, so historical amounts remain interpretable even if the
  shop's current currency changes. The packet does not say this explicitly —
  worth one sentence — but the design is right.
- Precision > 2 decimals, zero-value lines, `legacyResourceId` as string.
  **Sound.**

---

## 7. Unit / edit / refund findings

Beyond F-CLAUDE-PR6P-07 (double subtraction) and F-CLAUDE-PR6P-05 (refund-line identity):

**`ordered − current − refunded` is NOT always semantically safe.** §7.1 derives
`removed_units = ordered_units − current_units − refunded_units` and raises
`LINE_UNIT_IDENTITY_INCONSISTENT` when negative. The identity has at least three
verified failure modes the packet does not enumerate:

1. **Timing skew.** `refunded_units` is summed from refund-line facts across LIVE
   refunds; `ordered`/`current` come from the order snapshot. If a refund is
   applied before the order snapshot that reflects it (a legal interleaving under
   §9.3, which refetches refund *and* order separately), `refunded` transiently
   exceeds `ordered − current`, producing a spurious DataIssue on a correct system.
   The identity must be evaluated **only** over a consistent snapshot pair, or
   the diagnostic must be deferred to the reconciler.
2. **Exchanges.** A return processed as an exchange adds a *new* line GID while
   returning units on the old one. `currentQuantity` on the old line drops without
   a corresponding removal, and the new line has `quantity` with no originating
   order agreement of `reason = ORDER`. The packet's §7.5 scenario table has no
   exchange row at all.
3. **Restocking-fee adjustment sales.** `SaleLineType.ADJUSTMENT` sales carry
   money but no line link and no units. If a naive implementation sums all
   `Sale.quantity`, adjustments contribute `null` quantity (`Sale.quantity` is a
   **nullable** `Int`) — a null-propagation hazard the packet never mentions.

**`Sale.quantity` signedness: packet CORRECT.** Independently confirmed via
Shopify's own 2026-07 `order` query example: "This example retrieves sale records
with **negative quantities**, indicating items that were removed during edits."
The packet's §5.6 / §7.2 signedness claim is upheld. However `Sale.quantity` is
nullable and the packet treats it as present — see P3 list.

**Cancellation handling: packet CORRECT.** §7.2's rule that cancellation is not a
second unit event, and §7.5's "Cancel after payment / Refund after cancellation"
rows, are sound given the snapshot-authority model. Q-PR6-11 correctly isolates
the *metric* question without corrupting storage.

**Required corrections.** Add exchange and adjustment-sale rows to §7.5; state
that the unit identity is evaluated only over a consistent snapshot pair (or is
reconciler-only); state the `Sale.quantity IS NULL` handling explicitly
(persist null, never coerce to 0, never a unit event).

---

## 8. Webhook findings

### Topic verification against 2026-07 `WebhookSubscriptionTopic`

| Topic | Exists? | Scope | Packet position | Assessment |
|---|---|---|---|---|
| `orders/create` | Yes | `read_orders` | Subscribed; signal only | Correct |
| `orders/cancelled` | Yes | `read_orders` | Subscribed; signal only | Correct |
| `orders/edited` | Yes | `read_orders` | **Add — Monday-critical** | Correct |
| `orders/updated` | Yes | `read_orders` | Post-Monday ("noisy") | **Acceptable but risky** — see below |
| `orders/delete` | **Yes** | `read_orders` | **"not planned" / asserted absent** | **WRONG — F-CLAUDE-PR6P-02 (P1)** |
| `refunds/create` | Yes | `read_orders` | Subscribed; refetch refund **and** parent order | Correct |
| `order_transactions/create` | **Yes** — fires on create **or status update** | `read_orders` | Listed in the review brief; **not addressed anywhere in the packet** | **Gap — F-CLAUDE-PR6P-04 (P1)** |

**On deferring `orders/updated`.** Without it, the only signals for a
non-edit, non-refund, non-cancel order change are none. `Order.updatedAt` moves
for changes the app never learns about. The packet's defence is reconcile
(§11.5, "suggest 15–60 minutes"), which is adequate **provided** reconcile is
genuinely authoritative and complete — but §11.3 samples only ("For a **sampled
set** of LIVE facts"). A sampled reconcile plus no `orders/updated` is not a
completeness argument. Either subscribe `orders/updated` or make the incremental
`updated_at` sweep (not the sample) the completeness mechanism and say so.

### F-CLAUDE-PR6P-13 — **P1** — Identity-only sanitizer silently breaks the live legacy demand path while Q-PR6-09 is open

**Location:** packet §9.2 (tighten projections to "identity + signal metadata only",
bump to `…-v2`), §9.3 ("Legacy `handleOrderCreate` / `handleOrderCancelled` /
`handleRefundCreate` remain **out of PR 6 SoR**. Cutover … is Q-PR6-09.
Dual-write is not required").

**Evidence.** Verified in `app/jobs/workers/webhook-processor.ts` at `f65ab4b9…`:

```text
57  async function handleOrderCreate(...)
64    line_items?: Array<{ ... }>
75    for (const item of order.line_items ?? []) {
94      revenue: parseFloat(item.price) * item.quantity,
177 async function handleRefundCreate(...)
183   refund_line_items?: Array<{ ... }>
192   for (const item of refund.refund_line_items ?? []) {
216     Number(existing.revenue) - parseFloat(lineItem.price) * qty,
460   (durable.sanitizedPayload as Record<string, unknown>) ?? payload;
```

The legacy handlers read `line_items[].price/quantity` and
`refund_line_items[].line_item.price/quantity` **from `sanitizedPayload`**. The
`?? []` fallbacks mean that removing those fields does not throw — it silently
iterates an empty array.

`SalesDailyAggregate` is a live merchant model (`app/tenant/models.ts`
`DIRECT_MERCHANT_MODELS`) and is the input to `forecasting.server.ts` /
`runAbcAnalysis` (verified). PR 6 facts have **no consumers** until Phase 2.

**Merchant impact.** The moment PR6-D lands the v2 identity-only projection, the
only currently-functioning demand aggregate stops accumulating — silently, with
no error, no `DataIssue`, and no fallback — while its replacement has no reader.
Merchant-visible forecasts decay toward zero. This directly violates the packet's
own §16.4 principle ("Shipping unlabeled provisional math to merchants is a
formula change (forbidden)") and `AGENTS.md` "No hidden formula changes".

**Required correction.** Q-PR6-09 is **not** a deferrable product question; it is
an engineering sequencing constraint that must be frozen **before** PR6-D. Freeze
one of:

- **(a)** PR6-D does not tighten `orders/create` / `orders/cancelled` /
  `refunds/create` projections. It adds identity-only projections for the **new**
  topics (`orders/edited`, `orders/delete`) and leaves v1 projections intact until
  a separate, explicitly-authorized legacy-retirement PR. **Recommended** — it is
  the only option that keeps the merchant-visible path continuous.
- **(b)** PR6-D tightens projections **and** removes the legacy handlers in the
  same PR, accepting that demand data has no consumer until Phase 2, with that
  consequence stated to the product owner in writing.

Silence is not an option: as written, the packet selects (b) by accident while
documenting (a)'s assumption ("Legacy … remain out of PR 6 SoR").

### F-CLAUDE-PR6P-14 — **P2** — Projection schema version transition for already-stored deliveries is unaddressed

**Location:** packet §9.2 ("Bump projection schema versions
(`webhook-projection-orders-create-v2`, etc.)").

**Evidence.** `payloadSchemaVersion` and `sanitizedPayload` are persisted on the
delivery/job rows and read back by the worker
(`app/sync/fair-claim-query.server.ts:282,298,535,551`;
`app/jobs/workers/webhook-processor.ts:460,618`), and a `JobReplay` model exists
in the control plane. After PR6-D there will be v1-projected rows in flight and in
history being executed by a v2-expecting handler.

**Required correction.** State the transition rule: the worker dispatches on the
persisted `payloadSchemaVersion`, not on the current constant; v1 rows are either
handled by the retained legacy branch (option (a) above) or explicitly drained
and quarantined before cutover. Add a test that a v1-projected delivery executed
after the v2 deploy neither crashes nor silently no-ops.

### Webhook items verified sound

- Payload-as-signal-only, HMAC → `WebhookDelivery` → `DurableJob` → envelope v3 →
  refetch → apply → receipt. **Sound**, and consistent with PR 4.
- `refunds/create` supplying a REST refund id, converted to
  `gid://shopify/Refund/{id}`, then refund **and** parent order refetch, because
  line current quantities live on the order. **Correct and well reasoned.**
- Never applying REST `line_items` as deltas (T33). **Correct** and the single
  most important lesson carried from the legacy path.
- Unknown topics / unknown job types fail closed. **Verified in code.**

### Minimum Monday signal set (reviewer's determination)

**Monday-required:** `orders/create`, `orders/cancelled`, `orders/edited`,
`refunds/create`, **`orders/delete`** (added — it is the only sound deletion
authority once F-CLAUDE-PR6P-01 removes confirmed-null).

**Later:** `orders/updated` (only if incremental sweep is not made complete),
`order_transactions/create` (required before Q-PR6-07 can be answered "yes"),
`orders/paid`, `orders/fulfilled` (not demand-relevant).

---

## 9. Import / reconcile findings

Verified sound: fence-before-submit, persisted BulkOperation GID, no
`currentBulkOperation`, bounded-memory JSONL streaming, two-phase ingest with
`ingestBatchId`, resume from last committed ordinal, partial JSONL ≠ success,
kill-switch precedence, import/webhook overlap as a required test, and
"repair is refetch-and-apply, never replay a sanitized body". These are correctly
inherited from PR 5 and PR 4 and need no correction.

Defects, in addition to F-CLAUDE-PR6P-01 (§10.8 absence nomination) and
F-CLAUDE-PR6P-09 (bulk shapes):

### F-CLAUDE-PR6P-15 — **P2** — Reconcile completeness is asserted from a sampled check

**Location:** §11.3, §11.4, §11.6.

§11.4 claims "Missed webhooks are healed because reconcile is authoritative
refetch", but §11.3's mechanism is "For a **sampled set** of LIVE facts, refetch
`order(id:)` and diff". A sample heals sampled rows. The actual healing mechanism
is §11.1 — the `updated_at` sweep — and its completeness depends on the watermark
and overlap rules in §4.4.

**Required correction.** Separate the two mechanisms explicitly: (i) the
`updated_at`-window sweep is the **completeness** mechanism and must be
exhaustive over the window; (ii) the sampled deep-diff is a **drift-detection**
mechanism only. State that (ii) never establishes completeness. Also state the
sweep's interaction with the access window: an `updated_at` sweep cannot return
orders outside the 60-day window even when they were updated inside it — see
F-CLAUDE-PR6P-03.

### Import items requiring a stated position but not defective

- The 2-minute skew overlap on the incremental watermark is a reasonable
  engineering hypothesis and is correctly labelled as such.
- Watermark = max applied Shopify `updatedAt` among **successfully applied** orders
  (not job start, not `receivedAt`). **Correct**, and matches PR 4 lessons.
- "Do not silently backfill from webhook archives." **Correct.**

---

## 10. Tenancy findings

**Verified sound.** The proposed models inherit PR 3 correctly: non-null immutable
`shopId`, `@@unique([shopId, id])`, tenant-leading GID uniques, child FKs
including `shopId`, FORCE RLS, default-deny without the tenant GUC, no
`BYPASSRLS`, no client shop authority, workers resolving Shop from the durable
envelope. The three proposed tests (cross-shop identical Shopify order id;
foreign-`shopId` insert denied; raw-SQL reassignment denied) are the right three.
Registration targets (`scripts/tenant-enforcement/manifest.ts`,
`app/tenant/models.ts`) are the correct files and both exist at `f65ab4b9…`.

Placing `OrderFactObservationInFlight` in `merchant_domain` and **not** reusing
`CatalogObservationInFlight` is correct domain isolation.

Reusing `stocky_catalog_observation_gen_seq` is functionally sound (verified: the
sequence exists, is `NO CYCLE`, and runtime holds USAGE-only with `setval` denied)
though the catalog-scoped name will read as a mistake to future maintainers — a
one-line note in PR6-A would settle it.

**Defects.**

- The packet does not say whether the child fact models go in
  `DIRECT_MERCHANT_MODELS` or `CHILD_MERCHANT_MODELS` (both lists exist in
  `app/tenant/models.ts`, and PR 5 placed `ShopifyVariantFact` — itself a child —
  in `DIRECT`). State it. (P3)
- The `DataIssue` write-path defect is a tenancy defect as much as a money one —
  see F-CLAUDE-PR6P-11. The applicator's runtime role has **no** privileges on
  `DataIssue` (`expectedRuntimePrivileges: []`, verified). (Counted under P1.)
- New tables require sequence/table grants in `scripts/tenant-enforcement/roles.ts`,
  which is **not** in PR6-A's stated file ownership. Add it, or PR6-A cannot make
  its own tables usable by `stocky_runtime`. (P3)

**Lock version.** Minting `stocky-pr6-canonical-lock-v1` rather than editing the
frozen `stocky-pr5-canonical-lock-v1` is correct. Resource-kind literals
(`Order`, `OrderLine`, `Refund`, `RefundLine`) are correctly pinned, and requiring
known-answer vectors in PR6-A directly honours R-160. Locking the **parent Order**
for refund applies (rather than 250 line GIDs) correctly honours R-161's
capacity envelope. "Do not hold advisory locks across Shopify I/O" and
lock-before-first-insert are both correctly carried over. **This section is the
strongest part of the packet.**

One gap: the packet says refund jobs "still lock the **parent Order** (and may
also lock the Refund GID after Order)". "May" is not a lock order. R-160 requires
deterministic ordering (ascending `(key1, key2)`, deduplicated). Freeze it:
either always Order-only, or always Order-then-Refund in canonical key order. (P3)

---

## 11. Lane / dependency findings

### F-CLAUDE-PR6P-16 — **P2** — `A ∥ B → C → D` is safe but not maximally parallel; the reader contract is in the wrong lane

**Location:** §17.1, §17.2, §17.4.

**Evidence.** PR6-C's stated dependency is "**PR6-A merged** (tables) and
**PR6-B merged** (reader result types)". But §17.2 also states PR6-C is "Pure
apply: … **no Shopify I/O inside apply**". A pure applicator therefore needs only
the *result type*, never the reader implementation. Serialising C behind B's merge
buys nothing.

Verified non-conflicts that make a better graph safe: `.graphqlrc.ts` globs
`./app/**/*.{js,ts,jsx,tsx}`, so PR6-B needs no config edit to register documents;
`app/lib/order-facts/**` does not yet exist, so there is no shared file to contend.

**Required correction.** Move the canonical reader-result DTO and the applicator
input contract into **PR6-A** as `app/lib/order-facts/types.ts` (types only, no
Prisma import, no GraphQL import). The graph becomes:

```text
PR5 closed
    └─ PR6-A foundation (schema + locks + frozen types)
         ├─ PR6-B admin-read ──┐
         └─ PR6-C applicator ──┴─→ PR6-D webhooks/import
```

Two concurrent lanes are preserved, the critical path shortens by one merge, and
the contract that both B and C must agree on is frozen by the lane that owns
freezing — which is exactly the Accelerated Safe Delivery rule ("shared
schema/interfaces … freeze before dependent runtime lanes start").

**Other lane observations.**

- File ownership is otherwise well partitioned and the single-writer list
  (`webhook-processor.ts`, `sanitize.server.ts`, `job-envelope.server.ts`,
  `schema.prisma`) is correct.
- "PR 30/31 must not be used as a base" is correct and important — both are
  `CONFLICTING` against main.
- PR6-A's file list omits `scripts/tenant-enforcement/roles.ts` (see §10).
- PR6-D owns `shopify.app.toml`; with F-CLAUDE-PR6P-02 it must add **two** topics
  (`orders/edited`, `orders/delete`), not one.
- All four lanes are correctly marked Tier A with mandatory independent review.
- `app/types/**` (codegen output) is an implicit shared artifact of PR6-B. Name it
  in B's ownership so a later lane does not regenerate it into a conflict.

---

## 12. Monday-criticality assessment

The packet's §16 separation is broadly honest and its §16.4 non-weakening clause
is exactly right. Corrections:

**Genuinely required before Last-X / ABC can run at all (facts):**

1. Order + line facts with clocks, money bags, `test`, `processedAt`, `cancelledAt`
   — **plus** the denormalised dated columns from F-CLAUDE-PR6P-10.
2. Refund + refund-line facts with the corrected null-safe identity
   (F-CLAUDE-PR6P-05).
3. **One** unit-event ledger with the double-subtraction rule frozen
   (F-CLAUDE-PR6P-07). This is Monday-critical and currently wrong, not missing.
4. Agreement/sale facts via the schema-valid inline-fragment shape
   (F-CLAUDE-PR6P-06), sourced by per-order refetch since Bulk C is illegal
   (F-CLAUDE-PR6P-09).
5. Historical identity snapshots, no catalog FK. **Already correct.**
6. Authoritative refetch apply with snapshot atomicity (F-CLAUDE-PR6P-04/11).
7. A **sound** existence contract (F-CLAUDE-PR6P-01/02). Without it Monday ships a
   system that destroys its own history on a 60-day delay — the defect would not
   surface until well after the Monday date, which makes it *more* dangerous, not
   less.

**Product-owner decisions answerable independently of the code:**
Q-PR6-01, -02, -04, -05, -06, -08, -11 (see §13). None blocks fact storage. The
packet is right about this.

**Decisions that must be frozen before PR6-D and are wrongly deferred:**
Q-PR6-09 (F-CLAUDE-PR6P-13) and Q-PR6-10 (F-CLAUDE-PR6P-01/03).

**Safe to wait:** shipping-line child table, refund duties as first-class facts,
rebuildable daily projection, presentment reporting, location-grain sales,
`orders/updated`.

**No correctness was traded for the calendar in this packet.** That discipline
is upheld and should be preserved in the correction package: none of the
corrections above are optimisations, and none can be deferred past PR6-A/PR6-C
without landing a schema that must later be migrated.

---

## 13. Q-PR6-01 … Q-PR6-12 disposition

| ID | Packet framing | Independent disposition |
|---|---|---|
| **Q-PR6-01** Dated net-units policy + `processedAt` vs `createdAt` | Product | **Genuine product decision. Keep.** Approved docs define `net_units_sold / sample_calendar_days` but not the Shopify edit/refund dating. Storage supports both — correct. Refusing to label a parity velocity until it closes is right. |
| **Q-PR6-02** Multi-currency ABC | Product | **Genuine product decision. Keep.** The engineering half ("never sum mixed currencies", "no app FX") is already correctly frozen and should not be re-opened. |
| **Q-PR6-03** Calendar-day timezone | Product | **Should already be frozen — reclassify as engineering.** `AGENTS.md` engineering rules: "Store timestamps in UTC and **apply merchant timezone explicitly at boundaries**." That is the answer: shop-local calendar days. What is actually missing is *data*, not policy: verified — `Shop` has **no** `ianaTimezone` column (`prisma/schema.prisma` `model Shop`). `Shop.ianaTimezone` is a Shopify-authoritative fact, not product policy. **Add it in PR6-A**, or the metric policy needs a second migration lane, contradicting §26's "no further architecture PR" goal. **(P2 — folded into the correction list.)** |
| **Q-PR6-04** Net sales / ABC revenue definition | Product | **Genuine product decision. Keep.** Correctly refuses to bind "revenue" to a bag. Should be answered together with Q-PR6-02. |
| **Q-PR6-05** Include `Order.test = true` | Product | **Genuine, but the safe default should be stated.** Storing `test` is right. Add: no metric may include test orders until this closes — including test orders silently inflates demand, and shipping that is the "hidden formula change" `AGENTS.md` forbids. |
| **Q-PR6-06** Location-grain sales | Product | **Genuine, and correctly evidenced.** The finding that GraphQL `LineItem` has no stable sale-location equivalent to REST `location_id`, and that `default` is forbidden, is correct and important. Keep. |
| **Q-PR6-07** Refund money gated on `OrderTransaction.status = SUCCESS` | Product | **Genuine product decision, but currently unimplementable.** `OrderTransaction` has no `updatedAt` (verified) and `order_transactions/create` is not subscribed. **Engineering must subscribe that topic regardless of the answer**, or the answer "yes" cannot be honoured. See F-CLAUDE-PR6P-04. |
| **Q-PR6-08** Gift cards / tips / custom items | Product | **Genuine. Keep.** Note the schema evidence: `GiftCardSale` and `TipSale` carry `lineItem`; the other sale subtypes do not, so the storage split is already forced by Shopify's type system. |
| **Q-PR6-09** When to stop legacy `SalesDailyAggregate` writes | Product, "post-Monday" | **NOT a deferrable product question. Engineering must freeze it before PR6-D.** As written, PR6-D's identity-only sanitizer silently breaks the legacy path (F-CLAUDE-PR6P-13, verified against `webhook-processor.ts`). The product owner may still choose *when* to retire the legacy aggregate, but the *sequencing* cannot stay open. |
| **Q-PR6-10** Request / grant `read_all_orders` | Product + Partner, "post-Monday" | **Genuine product/Partner decision, but its priority is wrong.** It is not only about lookback depth. It determines (a) whether the deletion contract can use PR 5 semantics at all (F-CLAUDE-PR6P-01) and (b) whether refunds on >60-day orders are observable (F-CLAUDE-PR6P-03). **Must be answered before PR6-D**, not after Monday. |
| **Q-PR6-11** Cancelled unpaid orders contribute `ordered_units`? | Product | **Genuine. Keep.** Storage-neutral; metric-only. |
| **Q-PR6-12** BOM component explosion | Product | **UNNECESSARY — already answered by approved documents. Close it.** `AGENTS.md` product principle 7: "Variant-level identity must be preserved." The packet's own §3 non-goals already forbid "BOM explosion into component 'sales' (`processBomSale`)", and T40 already tests it is not invoked. Carrying it as an open question invites Cursor to treat a settled rule as negotiable. |

Summary: **7 genuine product decisions** (01, 02, 04, 05, 06, 08, 11);
**2 genuine but wrongly prioritised** (09 → engineering-freeze now; 10 → decide
before PR6-D); **1 reclassify as engineering with a schema consequence** (03);
**1 partially unimplementable pending an engineering change** (07);
**1 unnecessary** (12).

---

## 14. Risk findings

### Assessment of proposed R-PR6-01 … R-PR6-10

All ten are real and correctly characterised. R-PR6-02 (60-day window treated as a
complete lookback), R-PR6-04 (`default` location), R-PR6-05 (webhook payload as
quantity ledger), R-PR6-06 (FK to current variant facts), and R-PR6-09 (copying
conflicted PR 30/31 applicator logic) are especially well identified. R-014
remaining OPEN and not closable by planning approval is correct and matches the
register text at `f65ab4b9…`.

### Missing risks (must be added)

| Proposed ID | Severity | Risk |
|---|---|---|
| **R-PR6-11** | **P0** | Rolling 60-day access window causes mass false tombstoning of all order history via `ABSENT_CONFIRMED_QUERY`; loss is unrecoverable and terminal-revival can never fire (F-CLAUDE-PR6P-01) |
| **R-PR6-12** | **P1** | `orders/delete` believed nonexistent, so no sound deletion authority exists at all (F-CLAUDE-PR6P-02) |
| **R-PR6-13** | **P1** | Refunds and edits on orders older than the window are permanently unobservable; reconcile cannot heal them (F-CLAUDE-PR6P-03) |
| **R-PR6-14** | **P1** | Stale parent snapshot overwrites fresher children because no all-or-nothing snapshot rule exists (F-CLAUDE-PR6P-04) |
| **R-PR6-15** | **P1** | `RefundLineItem.id` nullable ⇒ refund-line idempotency and duplicate-refund protection unfounded (F-CLAUDE-PR6P-05) |
| **R-PR6-16** | **P1** | Refunded units double-subtracted because agreement sales and refund lines both post unit events (F-CLAUDE-PR6P-07) |
| **R-PR6-17** | **P1** | Identity-only sanitizer silently zeroes the live legacy demand aggregate while its replacement has no consumer (F-CLAUDE-PR6P-13) |
| **R-PR6-18** | **P1** | Apply-time diagnostics are unwritable — `DataIssue` is control-plane with no runtime privileges and no merchant-durable money/unit diagnostic columns exist (F-CLAUDE-PR6P-11) |
| **R-PR6-19** | **P2** | `OrderTransaction.status` is mutable with no version and no subscribed signal, so Q-PR6-07 is unimplementable as specified |
| **R-PR6-20** | **P2** | Bulk C is illegal at three nesting levels and Bulk B's array legality is unverified, so the Monday agreement/refund import path is uncosted (F-CLAUDE-PR6P-09) |

**Governance note (P3).** Proposed IDs use an `R-PR6-*` / `Q-PR6-*` namespace, while
the register at `f65ab4b9…` uses sequential `R-###` (currently through `R-161`,
164 rows) and `OPEN_QUESTIONS.md` uses `Q-0##`. Renumber into the existing
namespaces on acceptance, or the registers fork.

---

## 15. Severity counts

| Severity | Count |
|---|---|
| **P0** | **1** |
| **P1** | **8** |
| **P2** | **9** |
| **P3** | **6** |
| **Total** | **24** |

### P0

| ID | Finding |
|---|---|
| F-CLAUDE-PR6P-01 | Rolling 60-day access window converts the absence contract into total, unrecoverable history destruction |

### P1

| ID | Finding |
|---|---|
| F-CLAUDE-PR6P-02 | `orders/delete` exists in 2026-07; packet asserts it does not and plans no handling |
| F-CLAUDE-PR6P-03 | Refunds/edits on orders older than the window are permanently unobservable; reconcile cannot heal them |
| F-CLAUDE-PR6P-04 | No child version authority defined; no snapshot atomicity; `Refund.updatedAt` unbound; `OrderTransaction.status` unversioned |
| F-CLAUDE-PR6P-05 | `RefundLineItem.id` is nullable; refund-line identity and idempotency unfounded |
| F-CLAUDE-PR6P-06 | `Sale.lineItem` invalid; concrete subtypes and eligibility rules missing |
| F-CLAUDE-PR6P-07 | Agreement sales and refund lines both post refunded units ⇒ double subtraction |
| F-CLAUDE-PR6P-11 | "skip bag / fail apply" ambiguous; no snapshot atomicity; `DataIssue` unwritable by the applicator |
| F-CLAUDE-PR6P-13 | Identity-only sanitizer silently breaks the live legacy demand path while Q-PR6-09 is open |

### P2

| ID | Finding |
|---|---|
| F-CLAUDE-PR6P-08 | Invalid / duplicated query fields (`priceAfterAllDiscountsBeforeTaxesSet`, `cancellation.reason`, `refundableQuantity`, ungeneralised array-truncation rule) |
| F-CLAUDE-PR6P-09 | Bulk C exceeds nesting depth; Bulk B legality unverified on a Monday-critical path |
| F-CLAUDE-PR6P-10 | Claimed cross-table index cannot exist; no index for the Monday aggregation or for agreement sales |
| F-CLAUDE-PR6P-12 | No frozen money-reconciliation identity; no per-unit money derivation rule |
| F-CLAUDE-PR6P-14 | Projection schema v1→v2 transition for stored/replayed deliveries unaddressed |
| F-CLAUDE-PR6P-15 | Reconcile completeness asserted from a sampled deep-diff |
| F-CLAUDE-PR6P-16 | `A ∥ B → C → D` not maximally parallel; reader contract in the wrong lane |
| F-CLAUDE-PR6P-17 | `Shop` has no `ianaTimezone` / `currencyCode`; Q-PR6-03 needs a second migration unless PR6-A adds them |
| F-CLAUDE-PR6P-18 | Unit identity `ordered − current − refunded` has undocumented failure modes (snapshot skew, exchanges, adjustment sales, null `Sale.quantity`) |

### P3

| ID | Finding |
|---|---|
| F-CLAUDE-PR6P-19 | `R-PR6-*` / `Q-PR6-*` ID namespaces fork the existing `R-###` / `Q-0##` registers |
| F-CLAUDE-PR6P-20 | `ShopifyOrderAgreementSaleFact` identity stated two different ways (§2.1 vs §5.6) |
| F-CLAUDE-PR6P-21 | Line-level `customAttributes`, `LineItem.staffMember`, `Refund.staffMember`, `SalesAgreement.user`, `OrderTransaction.user`/`accountNumber`/`receiptJson` not on the forbidden-PII list |
| F-CLAUDE-PR6P-22 | Nullability not stated for `Refund.createdAt`, `OrderTransaction.processedAt`, `Sale.quantity`, `RefundLineItem.id` |
| F-CLAUDE-PR6P-23 | Child models not assigned to `DIRECT_MERCHANT_MODELS` vs `CHILD_MERCHANT_MODELS`; `scripts/tenant-enforcement/roles.ts` missing from PR6-A ownership |
| F-CLAUDE-PR6P-24 | Refund lock order "may also lock the Refund GID" is non-deterministic (R-160 requires a fixed order); `ReturnAgreement` missing from the inline-fragment list |

---

## 16. Exact correction list

Ordered so that a single Cursor correction package can be applied to the planning
document without further architecture discovery.

**A. Existence / deletion contract (P0/P1 — rewrite §4.7, §8.4, §8.7, §9.1, §10.8, §15)**

1. `order(id:) == null` is not confirmed absence. Add `existenceKind =
   INACCESSIBLE_HISTORY_WINDOW`, preserving the last unambiguous `existenceState`.
2. Confirmed absence requires: completed null **AND** order provably inside
   `orderHistoryWindowDays` (named constant, 60) at observation time **AND** the
   effective scope set unchanged since the last LIVE confirmation. With
   `read_all_orders` granted, the window predicate is unconditional and PR 5
   semantics apply unchanged.
3. Out-of-window orders are retained permanently, excluded from reconcile sampling
   and from all absence nomination.
4. Bulk omission may never nominate an out-of-window order.
5. Correct the false `orders/delete` claim. Add the topic to PR6-D
   (`shopify.app.toml`, route, identity sanitizer, `webhook:orders/delete` job type).
6. Define delete-signal authority: in-window ⇒ re-check then PR 5 semantics;
   out-of-window ⇒ `ABSENT_SIGNALLED_DELETE_UNVERIFIED` +
   `deletionSource = DELETE_WEBHOOK`, facts retained, stated as an explicit narrow
   derogation from "signal is never authority".
7. Verify the `orders/delete` payload shape empirically before writing the
   sanitizer; fail closed on unrecognised shapes.
8. Add `DataIssue` codes `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` and
   `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`.
9. Add tests: aged-out null must not tombstone; in-window null must tombstone;
   exact-boundary drift; scope downgrade voids absence authority.

**B. Clocks / concurrency (P1 — rewrite §5.1, §9.5, §13)**

10. Publish the per-fact-type clock table from §4 of this review as frozen contract.
11. Children are parent-versioned; only order snapshots write line/agreement/sale
    facts; only refund snapshots write refund-line/adjustment/transaction facts.
12. Snapshot atomicity: a rejected parent gate discards **every** child from that
    response. No partial application.
13. Gate strictly on `<`; equal `updatedAt` must re-apply idempotently.
14. Bind `Refund.updatedAt` as the refund's own clock A, evaluated independently
    of the order gate, including for refunds arriving inside an order refetch.
15. Child absence from a **complete** parent snapshot marks child-scoped ABSENT;
    incomplete pagination yields no child absence and no successful apply.
16. Subscribe `order_transactions/create`, or state the staleness bound Q-PR6-07
    inherits.
17. Freeze a deterministic multi-identity lock order (ascending `(key1, key2)`)
    for the Order+Refund case; remove "may also lock".
18. Add races: stale-parent-with-fresh-children; equal-`updatedAt` child repair;
    refund/order interleaving both directions; transaction status change with no
    parent bump.

**C. Query contract (P1/P2 — rewrite §4.2, §4.5)**

19. Replace the `Sale` selection with `__typename` + `... on ProductSale /
    GiftCardSale / TipSale { lineItem { id } }`; add `ReturnAgreement` to the
    agreement fragments.
20. Freeze the sale-type eligibility table; persist `UnknownSale`; never drop
    non-line sale types.
21. Remove `LineItem.priceAfterAllDiscountsBeforeTaxesSet`; choose
    `discountedUnitPriceAfterAllDiscountsSet` deliberately or drop it.
22. Remove the entire `Order.cancellation { … }` selection (`reason` invalid;
    `staffNote` is forbidden PII); rely on `Order.cancelReason`.
23. State that `refundableQuantity ≡ currentQuantity` per the 2026-07 schema; no
    formula may depend on a difference between them.
24. Generalise the array-truncation prohibition to every array field
    (`taxLines`, `transactions`, `discountAllocations`, `duties`, `refunds`) and
    make T20 generic.
25. Delete Bulk C; freeze paginated `order(id:) { agreements { sales } }` for
    `edited = true` or refund-bearing orders, with a stated request-count bound
    against the 1,000,000-line envelope.
26. Make Bulk B's array legality a PR6-B gate deliverable with a costed fallback.

**D. Money (P1/P2 — rewrite §6.2, §15, §5.5)**

27. Choose **fail-apply**: one invalid required `MoneyBag` rejects the entire
    resource snapshot. Delete "skip bag". No partial-freshness model.
28. Enumerate the required-bag set per resource; nullable schema bags are optional.
29. Add merchant-durable `moneyDiagnosticState` / `unitDiagnosticState` /
    `historyWindowState` columns; derive control-plane `DataIssue` via the
    reconciler (PR 5 Race Z pattern). Name the writer for every §15 row.
30. Freeze the refund money-reconciliation identity as a tested invariant with
    `REFUND_MONEY_UNBALANCED` on mismatch.
31. State that PR 6 never derives per-unit money by division; per-unit value comes
    from `Sale.totalAmount` or `RefundLineItem.subtotalSet`.
32. Add one sentence recording that per-order `Order.currencyCode` is what makes
    historical amounts survive a shop currency change.

**E. Units / edits / refunds (P1/P2 — rewrite §7.1, §7.2, §7.5)**

33. Choose one unit-event ledger. Recommended: agreement sales only, discriminated
    by `SalesAgreement.reason` ∈ {`ORDER`, `ORDER_EDIT`, `REFUND`, `RETURN`};
    refund lines become money/restock evidence only. Make it a tested invariant.
34. Add test: 3 ordered − 1 refunded ⇒ `refunded_units = 1`, not 2.
35. Replace the refund-line identity with
    `(shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal)`; retain
    nullable `shopifyGid` as lineage; test a null-`id` refund line end to end.
36. Add §7.5 rows for exchanges and for `SaleLineType.ADJUSTMENT` sales.
37. State that the unit identity is evaluated only over a consistent snapshot pair
    (or is reconciler-only), and that `Sale.quantity IS NULL` is persisted, never
    coerced, never a unit event.

**F. Webhooks / import (P1/P2 — rewrite §9.2, §9.3, §11)**

38. Choose sanitizer option (a) — PR6-D does **not** tighten the three existing
    order/refund projections; it adds identity-only projections for the new topics
    only. Legacy retirement becomes its own authorized PR. Record the choice and
    the reason in §9.3, replacing the current "Dual-write is not required" wording.
39. Add the `payloadSchemaVersion` dispatch rule and a mixed-version test.
40. Separate reconcile completeness (exhaustive `updated_at` sweep) from drift
    detection (sampled deep-diff); delete the claim that sampling heals missed
    webhooks.
41. Update the Monday signal set to `orders/create`, `orders/cancelled`,
    `orders/edited`, `refunds/create`, `orders/delete`.

**G. Schema / performance / lanes (P2/P3)**

42. Denormalise `orderProcessedAt`, `orderCancelledAt`, `orderTest`,
    `orderShopCurrencyCode` onto `ShopifyOrderLineFact` (order-applicator-written,
    invariant-tested) so `@@index([shopId, variantGidAtSale, orderProcessedAt])`
    is realisable; state the backfill rule.
43. Add indexes for agreement sales (`lineItemGid`, `happenedAt`) and
    `shopifyOrderGid` on every child.
44. Add `Shop.ianaTimezone` and `Shop.currencyCode` to PR6-A (Shopify facts, not
    product policy) so Q-PR6-03/-02 do not require a second migration.
45. Move the reader-result DTO and applicator input contract into PR6-A
    (`app/lib/order-facts/types.ts`, types-only); adopt
    `A → (B ∥ C) → D`.
46. Add `scripts/tenant-enforcement/roles.ts` and `app/types/**` to the correct
    lane ownership lists.
47. Assign each child model to `DIRECT_MERCHANT_MODELS` or
    `CHILD_MERCHANT_MODELS`; note why the catalog-named observation sequence is
    reused.
48. Resolve the `ShopifyOrderAgreementSaleFact` identity inconsistency between
    §2.1 and §5.6.
49. Add `LineItem.customAttributes`, `LineItem.staffMember`, `Refund.staffMember`,
    `SalesAgreement.user`, `OrderTransaction.user` / `accountNumber` /
    `receiptJson` / `paymentDetails` / `device` to the forbidden-PII list.
50. State nullability for `Refund.createdAt`, `OrderTransaction.processedAt`,
    `Sale.quantity`, `RefundLineItem.id`.

**H. Questions and risks (P2/P3)**

51. Close Q-PR6-12 as already answered by `AGENTS.md` principle 7 and the packet's
    own non-goals.
52. Reclassify Q-PR6-03 as engineering (shop-local calendar days, per `AGENTS.md`)
    with the `Shop.ianaTimezone` schema consequence in PR6-A.
53. Move Q-PR6-09 and Q-PR6-10 to "must be answered before PR6-D".
54. Record the Q-PR6-05 safe default (no metric includes test orders until closed).
55. Note that Q-PR6-07 requires `order_transactions/create` regardless of the answer.
56. Add R-PR6-11 … R-PR6-20; renumber the whole `R-PR6-*` / `Q-PR6-*` set into the
    existing `R-###` / `Q-0##` registers.

**I. Test matrix additions (append to §19)**

57. T41 − aged-out `order(id:)` null must not tombstone.
58. T42 + in-window null tombstones with `ABSENT_CONFIRMED_QUERY`.
59. T43 + `orders/delete` in-window ⇒ re-check then tombstone; out-of-window ⇒
    `ABSENT_SIGNALLED_DELETE_UNVERIFIED`, facts retained.
60. T44 − stale order response must not write its children.
61. T45 + equal-`updatedAt` refetch repairs drifted children.
62. T46 + refund line with null `id` ingests and is idempotent.
63. T47 + 3 ordered − 1 refunded ⇒ `refunded_units = 1` with both agreement and
    refund facts present.
64. T48 − one invalid required MoneyBag rejects the whole snapshot (no partial row).
65. T49 + refund money-reconciliation identity balances; unbalanced ⇒ DataIssue.
66. T50 bypass − scope downgrade voids prior absence authority.
67. T51 + v1-projected delivery executed after v2 deploy neither crashes nor
    silently no-ops.
68. T52 − `Sale` selection without inline fragments fails codegen.
69. T53 − Bulk C three-level document is rejected by the bulk schema gate.
70. T54 + exchange scenario does not produce a spurious
    `LINE_UNIT_IDENTITY_INCONSISTENT`.

---

## 17. What the packet gets right

Recorded so the correction package does not regress it:

- Shopify-as-authority, webhook-as-signal, refetch-as-truth. Correct and complete.
- Refusal to extend `SalesDailyAggregate`, to explode BOM, to use `location = "default"`,
  or to apply REST payload deltas. All four legacy anti-patterns correctly identified
  with verified line references.
- Exact-decimal money contract, both bag sides persisted, `shopMoney` for operations,
  no app FX, no 2-decimal rounding. Directly honours R-014's approved mitigation.
- Historical identity: `variantGidAtSale` immutable, no FK to current catalog facts,
  never merge by SKU, recreated variants are new GIDs. Correct and important.
- PII minimisation: no customer, address, email, phone, IP, note, or customer GID.
- Tenancy/RLS inheritance from PR 3, and the PR 5 lock/observation primitives
  reused rather than reinvented — including a new lock version rather than editing
  the frozen one, order-level locking to respect R-161, lock-before-first-insert to
  respect R-160, and no network I/O under lock.
- Refusal to select a net-units metric policy, and the §16.4 non-weakening clause.
- Honest declaration that R-014 is not closed by planning approval.
- Correct identification that PR 30/31 must not be used as a base.
- Docs-only diff, draft PR, no runtime change — governance-clean.

---

## 18. Approval conditions

Planning acceptance requires:

1. All P0 and P1 corrections applied (A, B, C.19–C.22, D.27–D.29, E.33–E.35, F.38).
2. All P2 corrections applied or explicitly accepted as residual with a recorded
   product-owner decision.
3. The clock table (§4 of this review) and the unit-ledger choice (§E.33) frozen
   as contract text, not as options.
4. Q-PR6-09 and Q-PR6-10 answered.
5. `Shop.ianaTimezone` / `Shop.currencyCode` and the denormalised line columns
   folded into PR6-A's schema, since PR6-A is the only schema lane and §26 claims
   no further architecture PR will be needed.

On those conditions PR6-A and PR6-B — or, preferably, PR6-A then PR6-B ∥ PR6-C —
could begin immediately after PR 5 closes without another broad architecture
discovery.

**PR 6 runtime remains unauthorized. PR 5 must close first. This review does not
authorize implementation, migration, Shopify configuration, or production access.**

---

**VERDICT: CORRECTIONS REQUIRED**
