# Phase 1 PR 6 Emergency Plan — Order / Order-Line / Refund / Cancellation Facts

**Status:** PLANNING ONLY — NOT IMPLEMENTATION AUTHORITY
**Correction status:** FINAL CONSOLIDATED PLANNING CORRECTION of NEW-CLAUDE-PR6PC-01 … 06 — **INDEPENDENT FINAL CORRECTION RE-REVIEW PENDING**
**Product owner:** ChatGPT
**Implementation owner (when later authorized):** Cursor
**Independent reviewer:** Claude Code (early Tier-A review + correction re-review incorporated; **final correction re-review of this head is pending**; this packet does **not** claim independent correction approval)
**Document type:** Emergency one-dependency-level-ahead architecture packet (corrected)
**Authorized planning base / `origin/main` at original authoring:** `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (PR5-F2A squash merge `#29`)
**Current observed `origin/main` (this correction pass; not merged into this branch):** `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` (PR5-F2B squash merge `#31`)
**Reviewed planning head (pre-first-correction):** `76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b`
**Reviewed corrected head (pre-this-pass):** `11d9cf6f9f759f2ebb1c467f06ea56af69672f9d`
**Independent review commit:** `4fd81bae2c4c42732ffd573d8523965c4d2289fb`
**Immutable original review artifact:** `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md`
**Immutable original review blob (must remain exact):** `d72340c01dd9c662d0e8bb4aa8d43482940470d9`
**Correction re-review commit:** `3260f1a468678ab373c1261d8ed8e8e6f6b6e258`
**Immutable correction re-review artifact:** `stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md`
**Immutable correction re-review blob (must remain exact):** `fca2b260d03e3105782ed216f7773c53e6aef2a7`
**Independent verdict on `11d9cf6…`:** `CORRECTIONS REQUIRED` — NEW-CLAUDE-PR6PC P1 1 / P2 1 / P3 4
**Independent verdict on original `76a8f33…`:** `CORRECTIONS REQUIRED` — P0 1 / P1 8 / P2 9 / P3 6
**Shopify Admin API target:** `2026-07` (`ApiVersion.July26`) — do not bump
**Production execution:** NOT AUTHORIZED
**Merchant production data:** NOT AUTHORIZED
**Inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF
**PR 6 runtime:** NOT AUTHORIZED by this document
**PR 5:** must close first (independently reviewed, accepted, merged, closure-synchronized)
**Phase 2 forecasting / ABC / buying-table runtime:** NOT AUTHORIZED
**Merge:** UNAUTHORIZED
**Mark-ready:** UNAUTHORIZED

This document is the **corrected** execution-grade contract so Phase 1 PR 6 can start after PR 5 closes. It does **not** start PR 6 runtime, migrations, GraphQL production documents, webhook workers, forecasting, or Shopify configuration.

Official Shopify facts were read from `shopify.dev` Admin GraphQL `2026-07` object/query pages, webhook and bulk-operations guides, and access-scope documentation on **2026-09-02**, plus the independent review’s live-schema verification on that date. Community posts are not API authority.

Historical `stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md` is **not** implementation authority. This plan does **not** import that document’s receipt, cost, entitlement, billing, or AI ledger items.

Both independent review artifacts are **immutable**. Never edit them. This plan is the only document that may change to absorb corrections. This branch is **not** rebased onto current main in this pass; one final current-main synchronization happens only after PR 5 closes.

---

## C0. Correction identity

| Field | Value |
|---|---|
| Original planning PR | [#34](https://github.com/Vedang1998/Stocky/pull/34) |
| Original planning branch | `cursor/pr6-order-refund-planning-87c7` |
| Original planning HEAD | `76a8f339af3201d91ce8c6e8e47b1cf24b1f1d5b` |
| First-correction HEAD (re-reviewed) | `11d9cf6f9f759f2ebb1c467f06ea56af69672f9d` |
| Review branch | `claude/pr6-order-refund-review-bhfbit` |
| Review commit cherry-picked onto this branch | `4fd81bae2c4c42732ffd573d8523965c4d2289fb` |
| Original review blob | `d72340c01dd9c662d0e8bb4aa8d43482940470d9` |
| Correction re-review commit cherry-picked | `3260f1a468678ab373c1261d8ed8e8e6f6b6e258` |
| Correction re-review blob | `fca2b260d03e3105782ed216f7773c53e6aef2a7` |
| Findings addressed | F-CLAUDE-PR6P-01 … F-CLAUDE-PR6P-24 (all 24) **and** NEW-CLAUDE-PR6PC-01 … 06 |
| Correction-list items applied | original §16 items 1 … 70, plus PC-01 … PC-06 |
| This packet claims independent correction approval | **No** — **INDEPENDENT FINAL CORRECTION RE-REVIEW PENDING** |
| This packet authorizes PR 6 runtime | **No** |

---

## C1. Frozen product-owner decisions (contract, not options)

These decisions are **frozen**. A future runtime lane must implement them. It must not re-open them as Q-PR6-* or invent alternatives.

### PO-01 — Historical order access / `read_all_orders`

Stocky **will pursue Partner approval** for `read_all_orders` because full parity requires history beyond the default rolling window.

**PR 6 correctness MUST NOT depend on that approval being granted.** This planning PR does **not** add the scope or `shopify.app.toml` configuration.

Without authoritative historical access:

- `order(id:) == null` is **not** sufficient deletion authority for an aged-out order;
- retain the existing historical fact;
- represent inaccessible history explicitly (`existenceKind = INACCESSIBLE_HISTORY_WINDOW`);
- **never** tombstone merely because an order aged outside the token window;
- `orders/delete` is the deletion signal;
- where a delete signal cannot be authoritatively rechecked because the order is outside the window, retain the fact with `existenceKind = ABSENT_SIGNALLED_DELETE_UNVERIFIED` and `deletionSource = DELETE_WEBHOOK`.

If `read_all_orders` is later granted, reconciliation **may** use the broader authoritative window (window predicate then unconditional; PR 5 absence semantics apply). Grant sequencing remains a Partner/ops question (proposed **Q-016**); it is not a PR 6 correctness dependency.

Closes former **Q-PR6-10** as a PR6-D blocker: answered for correctness. Partner *timing* of the grant is proposed Q-016.

### PO-02 — Legacy `SalesDailyAggregate` cutover

PR6-D **MUST NOT** tighten the three existing order/refund webhook sanitized projections (`orders/create`, `orders/cancelled`, `refunds/create`) in a way that breaks the current legacy demand path.

Keep the existing **v1** projections operating so legacy handlers still see `line_items`.

New topics (`orders/edited`, `orders/delete`, `order_transactions/create`) **may** use identity-only projections.

Retirement of `SalesDailyAggregate` is a **separate explicitly authorized cutover** after canonical order facts **AND** the replacement consumer have reconciled. There must be **no** silent period where the legacy consumer gets empty line arrays.

Closes former **Q-PR6-09** for PR6-D sequencing. Cutover *date* remains a later authorized PR, not this packet.

### PO-03 — Net-units dating

Frozen metric policy id: **`net-units-order-date-v1`**.

- Original order units: order `processedAt`.
- Later refunds / returns / edit-removals **restate the original order’s net demand** rather than creating artificial negative demand on refund day.
- True edit **additions** use the agreement `happenedAt`.
- **One** authoritative unit-event ledger only (agreement sales; see §7.2).
- Facts still retain original event timestamps (`happenedAt`, refund `processedAt`, transaction `processedAt`).
- Follow independent-review Option A to prevent agreement + refund **double subtraction**.

Closes former **Q-PR6-01**.

### PO-04 — Timezone

Calendar-day boundaries use the **shop’s IANA timezone**.

Add Shopify-authoritative `Shop.ianaTimezone` to the **PR6-A** schema plan.

Do **not** use server local time or UTC calendar boundaries for merchant metrics.

Former **Q-PR6-03** is **engineering**, not an open product question (`AGENTS.md`: store timestamps in UTC; apply merchant timezone explicitly at boundaries).

### PO-05 — Test orders

Persist `Order.test`.

**Exclude `test=true` orders from every operational demand / velocity / ABC metric.**

Closes former **Q-PR6-05**.

### PO-06 — Refund money vs units

Money from a refund affects **net-sales / revenue metrics only after** the relevant refund transaction reaches **`SUCCESS`**.

Unit-return evidence remains **separate** from money settlement.

Therefore **`order_transactions/create` is REQUIRED** so status transitions are observable. The topic fires when a transaction is created **or when its status is updated**, **only** for statuses **`success`, `failure`, or `error`**. It does **not** fire for `PENDING`. PENDING transactions are observed through refund snapshots; do not expect a PENDING webhook. The SUCCESS transition PO-06 depends on **does** fire.

Closes former **Q-PR6-07** as product policy and as the engineering subscription requirement.

### PO-07 — BOM (closed product rule)

**Never explode** a Shopify sold line into synthetic component sales.

Preserve actual Shopify variant / order-line identity.

Closes former **Q-PR6-12**. Already answered by `AGENTS.md` product principle 7 and this packet’s non-goals. Not negotiable.

### PO-08 — Gift cards / tips / custom non-variant items

Persist enough fact / money lineage for reconciliation.

**Exclude them from VARIANT demand / replenishment / ABC calculations.**

Do **not** fabricate variant identity.

Closes former **Q-PR6-08**.

### PO-09 — Location

Monday rescue metrics are **shop-wide** when authoritative line-level location cannot be proven.

Do **not** use legacy `"default"` as canonical location.

Full location-grain demand remains a **later explicit contract** (proposed **Q-014**).

Former **Q-PR6-06** remains a genuine later product question; Monday does not invent location.

---

## C2. Finding dispositions (F-CLAUDE-PR6P-01 … 24)

Every finding has an explicit disposition in this packet. None is deferred as “Cursor will decide.”

| ID | Sev | Disposition |
|---|---|---|
| **F-CLAUDE-PR6P-01** | P0 | **ACCEPTED AND INCORPORATED.** Rewrite existence: `order(id:)==null` is not confirmed absence for aged-out orders. Add `INACCESSIBLE_HISTORY_WINDOW`. Never tombstone for rolling-window aging. Confirmed absence requires completed null **AND** in-window **AND** scope set not lost vs last LIVE. Out-of-window facts retained forever; excluded from absence nomination and reconcile sampling. §8, §4.7, §10, T41–T43, T50. |
| **F-CLAUDE-PR6P-02** | P1 | **ACCEPTED AND INCORPORATED.** `WebhookSubscriptionTopic.ORDERS_DELETE` exists in 2026-07 and requires only `read_orders`. PR6-D Monday signal. In-window: refetch then PR 5 tombstone if null. Out-of-window: `ABSENT_SIGNALLED_DELETE_UNVERIFIED` + `DELETE_WEBHOOK`; rows retained. Sanitizer fail-closed; payload shape unverified — do not assume `admin_graphql_api_id`. |
| **F-CLAUDE-PR6P-03** | P1 | **ACCEPTED AND INCORPORATED.** >60-day refund/edit observability is a **correctness boundary**. Emit `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`; record the signal; reconcile cannot heal it without `read_all_orders`. PO-01: correctness does not depend on grant. |
| **F-CLAUDE-PR6P-04** | P1 | **ACCEPTED AND INCORPORATED.** Frozen clock table §5.1. Children parent-versioned. All-or-nothing snapshot rejection. Gate `<` only; equal `updatedAt` re-applies. Bind `Refund.updatedAt` independently. Subscribe `order_transactions/create`. |
| **F-CLAUDE-PR6P-05** | P1 | **ACCEPTED AND INCORPORATED.** Refund-line identity `@@unique([shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal])`; nullable `shopifyGid` lineage. T46. |
| **F-CLAUDE-PR6P-06** | P1 | **ACCEPTED AND INCORPORATED.** Valid Sale fragments with `__typename` + `ProductSale` / `GiftCardSale` / `TipSale` lineItem; add `ReturnAgreement`; persist `UnknownSale`; eligibility table frozen. T52. |
| **F-CLAUDE-PR6P-07** | P1 | **ACCEPTED AND INCORPORATED (Option A), then PC-01 sign convention.** One unit-event ledger = agreement sales. Refund lines are not unit events. Derived `refunded_units` / `removed_units` are **positive magnitudes** of valid **negative** eligible sales. T47 stores reversal `−1` and asserts `refunded_units = 1`. |
| **F-CLAUDE-PR6P-08** | P2 | **ACCEPTED AND INCORPORATED, then PC-03 qualification.** Drop invalid fields; `refundableQuantity ≡ currentQuantity`. Forbid pagination args only on named **non-connection LIST** fields. Connection fields **must** paginate. |
| **F-CLAUDE-PR6P-09** | P2 | **ACCEPTED AND INCORPORATED.** **Delete Bulk C.** Bulk A legal. Bulk B array legality is a **PR6-B gate** with costed per-order refund refetch fallback. Agreements via paginated `order(id:) { agreements { sales } }` for `edited=true` **or** refund-bearing orders; bound request count vs 1M-line envelope. T53. |
| **F-CLAUDE-PR6P-10** | P2 | **ACCEPTED AND INCORPORATED.** Denormalize `orderProcessedAt`, `orderCancelledAt`, `orderTest`, `orderShopCurrencyCode` onto lines (order-applicator-written, invariant = parent). Real `@@index([shopId, variantGidAtSale, orderProcessedAt])`. Child `shopifyOrderGid` indexes. Agreement-sale indexes on `shopifyLineItemGid` / `happenedAt`. |
| **F-CLAUDE-PR6P-11** | P1 | **ACCEPTED AND INCORPORATED.** Fail-apply whole snapshot (no “skip bag”). Merchant-durable `moneyDiagnosticState` / `unitDiagnosticState` / `historyWindowState`. `DataIssue` derived **only** by the reconciler (PR 5 Race Z). Runtime **cannot** DML `DataIssue`. |
| **F-CLAUDE-PR6P-12** | P2 | **ACCEPTED AND INCORPORATED.** Frozen refund money-reconciliation identity (exact NUMERIC). No JS/NUMERIC **division-derived** unit prices. Per-unit from `Sale.totalAmount` or `RefundLineItem.subtotalSet`. `Order.currencyCode` survives shop currency change. T48, T49. |
| **F-CLAUDE-PR6P-13** | P1 | **ACCEPTED AND INCORPORATED (PO-02).** Do not tighten the three existing sanitizers. Identity-only for **new** topics only. Separate authorized cutover later. T51 mixed v1/v2. |
| **F-CLAUDE-PR6P-14** | P2 | **ACCEPTED AND INCORPORATED.** Worker dispatches on persisted `payloadSchemaVersion`. Mixed v1-after-v2-deploy must neither crash nor silently no-op. T51. |
| **F-CLAUDE-PR6P-15** | P2 | **ACCEPTED AND INCORPORATED.** Completeness = exhaustive `updated_at` sweep. Sampled deep-diff is **drift detection only**. Sampling does **not** heal missed webhooks. |
| **F-CLAUDE-PR6P-16** | P2 | **ACCEPTED AND INCORPORATED.** Lane graph `PR6-A → (PR6-B ∥ PR6-C) → PR6-D`. Types contract in PR6-A `app/lib/order-facts/types.ts` (types only). |
| **F-CLAUDE-PR6P-17** | P2 | **ACCEPTED AND INCORPORATED, then PC-04.** `Shop.ianaTimezone` and `Shop.currencyCode` in PR6-A. API fields are **non-null** in 2026-07; defensive transport handling is policy, not schema nullability. |
| **F-CLAUDE-PR6P-18** | P2 | **ACCEPTED AND INCORPORATED, then PC-01.** Identity `ordered − current − refunded = removed` only on a **consistent valid-sign** snapshot pair. Null `Sale.quantity` persisted. T29/T54 must actually detect contradictory identities. |
| **F-CLAUDE-PR6P-19** | P3 | **ACCEPTED AND INCORPORATED.** In-plan proposed sequential `R-###` / `Q-0##` table. **Do not** edit `RISK_REGISTER.md` or `OPEN_QUESTIONS.md` in this PR. |
| **F-CLAUDE-PR6P-20** | P3 | **ACCEPTED AND INCORPORATED.** Single sale-fact identity: `(shopId, shopifyGid)` on `ShopifyOrderAgreementSaleFact` (`Sale.id` is `ID!`). `agreementGid` is a required FK column, not a second unique identity. |
| **F-CLAUDE-PR6P-21** | P3 | **ACCEPTED AND INCORPORATED.** Expanded forbidden PII list. |
| **F-CLAUDE-PR6P-22** | P3 | **ACCEPTED AND INCORPORATED.** Explicit nullability: `Refund.createdAt` nullable; `OrderTransaction.processedAt` nullable; `Sale.quantity` nullable; `RefundLineItem.id` nullable. |
| **F-CLAUDE-PR6P-23** | P3 | **ACCEPTED AND INCORPORATED.** DIRECT vs CHILD assignments frozen. PR6-A owns `scripts/tenant-enforcement/roles.ts`. Catalog-named observation sequence reused with an explicit platform-infra note. |
| **F-CLAUDE-PR6P-24** | P3 | **ACCEPTED AND INCORPORATED, then PC-05.** §13 echoes §5.1: refund job = Order+Refund; order-only = Order unless the same apply includes refund snapshots. `ReturnAgreement` fragment required. |

---

## C2b. NEW-CLAUDE-PR6PC-01 … 06 dispositions

| ID | Sev | Disposition |
|---|---|---|
| **NEW-CLAUDE-PR6PC-01** | P1 | **INCORPORATED.** Signed-sale convention frozen in §7.1 / §7.2 / §15 / T29 / T47 / T54 / T55. Magnitudes of valid negative reversals/removals. Never `abs()` unexpected signs. |
| **NEW-CLAUDE-PR6PC-02** | P2 | **INCORPORATED.** Nested per-parent pagination: `OrderFactById` + `OrderAgreementSalesPage` + `RefundFactById` with distinct connection variables. Incomplete walk uses `OrderFactObservationInFlight` + `SNAPSHOT_PAGINATION_INCOMPLETE`. No partial canonical apply. T56/T57. |
| **NEW-CLAUDE-PR6PC-03** | P3 | **INCORPORATED.** LIST-vs-connection rules qualified by owning type. T20 scoped to named non-connection LISTs. |
| **NEW-CLAUDE-PR6PC-04** | P3 | **INCORPORATED.** `RefundLineItem.priceSet` and `Shop.ianaTimezone` are **non-null** in 2026-07. `priceSet` is a required refund-line bag. Timezone missing/malformed fails closed. |
| **NEW-CLAUDE-PR6PC-05** | P3 | **INCORPORATED.** §13 reproduces §5.1 lock rule. No “Order+Refund always both” summary. |
| **NEW-CLAUDE-PR6PC-06** | P3 | **INCORPORATED.** `order_transactions/create` fires only for `success` / `failure` / `error`. PENDING observed via refund snapshots. T36 aligned. |

### C2c. Cross-reference — these sections must agree

| Topic | Sections that must match |
|---|---|
| Signed unit formulas | §7.1, §7.2, §7.2.2, §15 unit row, T29, T47, T54, T55 |
| Nested pagination | §4.2, §4.3, §4.5 request envelope, §5.8, §15 incomplete-pages row, T56, T57 |
| LIST vs connection | §4.1, §4.2 forbidden, §4.3, T20 |
| Locks | §5.1, §13 |
| Transaction topic | §4.1(7), §7.4, §9.1, T36 |

---

## 0. Emergency context and current repository truth

### 0.1 Why this packet exists

After PR 5 catalog/location/inventory facts close, PR 6 is a remaining **data** dependency for the September 2026 rescue workflow:

Shopify order/refund facts → dated net units and shop-currency amounts → deterministic Last-X / custom-range demand → ABC/U → low-stock ranking → editable reorder quantities → ordering/export.

This packet must make PR 6 implementable without another broad architecture discovery. Calendar dates are an operational target, not a correctness waiver.

### 0.2 Inspected live state

| Item | Evidence |
|---|---|
| Original planning `origin/main` | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` — PR5-F2A squash `#29` (authoring / first-correction base) |
| Current observed `origin/main` (this pass) | `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26` — `Phase 1 PR5-F2B — canonical fact applicator (#31)` |
| PR5-F1 | Merged / frozen (`#27`) |
| PR5-F2A admin-read | Merged on main (`#29`) |
| PR `#31` F2B canonical applicator | **MERGED** 2026-09-02T10:32:09Z; squash/main SHA `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`. Post-merge `push` run [`33619969867`](https://github.com/Vedang1998/Stocky/actions/runs/33619969867): event `push`, `head_sha` `0284b66…`, **conclusion SUCCESS** (Classify SUCCESS; Heavy SUCCESS; CI Gate SUCCESS). Inspected this pass; **not modified**. |
| PR `#30` F2C compatibility projection | OPEN DRAFT, `CONFLICTING`, head `2d2e8801dd383a778c1237cec4ed068922859cf0` — **inspected only; not modified**. **Do not use PR #30 as a base.** |
| Current order/refund webhooks | Signal-only intake: `orders/create`, `orders/cancelled`, `refunds/create` |
| Current merchant application | Legacy `SalesDailyAggregate` via `parseFloat` in `app/jobs/workers/webhook-processor.ts` |
| Current scopes | `read_orders` present; `read_all_orders` **absent**; `write_orders` **absent** (must stay absent) |
| This planning branch vs current main | **Not rebased / not merged** in this pass. One final current-main sync only after PR 5 closes. Premise files (`schema.prisma`, `shopify.app.toml`, sanitizers, webhook processor, tenant models, registers) **unchanged** by `#31`; `#31` added `app/lib/catalog-facts/apply/**` plus lock-capacity R-162 guards. |

### 0.3 Hard gate before any PR 6 runtime lane

Phase 1 brief: PR 6 cannot begin until PR 5 **implementation** is independently reviewed, accepted, merged, and closure-synchronized.

This planning packet may exist one dependency level ahead under Accelerated Safe Delivery v1. It is **not** D-055, not PR 5 completion, and not PR 6 runtime authorization.

---

## 1. Authority

Shopify is authoritative for:

- orders;
- order edits;
- cancellations;
- refunds;
- products / variants;
- sellable inventory states.

The application stores durable Shopify-authoritative **facts**, historical identity snapshots, exact-decimal money, sync lineage, existence/status, and reconciliation evidence. It does not become a second commerce ledger.

Webhooks are **signals**. Duplicate, delayed, out-of-order, and missed delivery are expected. Authoritative state comes from Admin GraphQL `2026-07` refetch / bulk extraction.

**Narrow derogation (explicit):** for an **out-of-window** `orders/delete` signal that cannot be rechecked, `ABSENT_SIGNALLED_DELETE_UNVERIFIED` is the best available authority. This does **not** generalize. In-window deletes still require refetch. Refund/edit/create signals are never attribute authority.

Tenant authority remains Phase 1 law:

- `Shop.id` is internal tenant authority;
- authenticated shop is derived server-side;
- every merchant fact has non-null `shopId`;
- composite tenant unique keys and child FKs include `shopId`;
- FORCE RLS; immutable `shopId`; no client-provided shop authority;
- jobs use `tenant-job-envelope-v3`.

Money remains exact-decimal. JavaScript `Number`, `parseFloat`, and float arithmetic are forbidden on every PR 6 monetary path. **Division-derived unit prices are forbidden.** R-014 stays **OPEN** until PR 6 implementation is independently verified.

Do not store unnecessary customer PII (D-021 / Phase 1 brief privacy decision). Forecasting does not require customer identity.

Approved product documents override unfinished code, the legacy `SalesDailyAggregate` model, and implementation convenience.

---

## 2. Exact scope

When ChatGPT later authorizes PR 6 implementation, authorized work is:

1. Canonical Shopify order / line / refund / cancellation / adjustment / edit-agreement / sale / refund-transaction facts.
2. Historical product/variant identity snapshots on lines, independent of current catalog rows.
3. Exact-decimal shop-money and presentment-money persistence from Shopify `MoneyBag` / `MoneyV2.amount` Decimal strings.
4. Admin GraphQL **QUERY-only** extraction (direct refetch + legal bulk), following the F2A codegen/AST-deny-mutation pattern.
5. Webhook signal → durable inbox → authoritative refetch → tenant apply → application receipt.
6. Initial historical import and periodic reconciliation (sweep = completeness).
7. Tenancy/RLS registration for new merchant-domain tables, including `scripts/tenant-enforcement/roles.ts` grants.
8. Tests covering identity, clocks, money, pagination, duplicates, races, window existence, and reconciliation.
9. Shopify-authoritative `Shop.ianaTimezone` and `Shop.currencyCode`.

PR 6 stores facts that later Phase 2 Last-X, custom-range, ABC/U, and low-stock **consumers** can derive from. PR 6 does not implement those consumers.

### 2.1 Required fact types

| Planning name | Prisma proposal | Identity | Tenant list | Monday-critical? |
|---|---|---|---|---|
| Order fact | `ShopifyOrderFact` | `(shopId, shopifyGid)` | **DIRECT** | Yes |
| Order line fact | `ShopifyOrderLineFact` | `(shopId, shopifyGid)` | **DIRECT** | Yes |
| Refund fact | `ShopifyOrderRefundFact` | `(shopId, shopifyGid)` | **DIRECT** | Yes |
| Refund line fact | `ShopifyOrderRefundLineFact` | `(shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal)` — **not** refund-line GID | **CHILD** | Yes |
| Cancellation facts | columns on `ShopifyOrderFact` (`cancelledAt`, `cancelReason`) — **no** `Order.cancellation` selection | order GID | n/a | Yes (order columns) |
| Order adjustments | `ShopifyOrderAdjustmentFact` | `(shopId, shopifyGid)` | **CHILD** | Yes for money reconcilability |
| Edit / sales agreements | `ShopifyOrderAgreementFact` | `(shopId, shopifyGid)` | **CHILD** | Yes |
| Agreement sales | `ShopifyOrderAgreementSaleFact` | `(shopId, shopifyGid)` where `shopifyGid = Sale.id` (`ID!`). `shopifyAgreementGid` is required FK, **not** a second unique key | **CHILD** | Yes — **the** unit-event ledger |
| Refund transactions | `ShopifyOrderRefundTransactionFact` | `(shopId, shopifyGid)` | **CHILD** | Yes for SUCCESS money gating |
| Shipping line facts | `ShopifyOrderShippingLineFact` | shipping line GID | CHILD (when added) | Post-Monday parity (persist order-level shipping money bags on Monday) |
| Observation in-flight | `OrderFactObservationInFlight` | observation request gen | merchant_domain (DIRECT-class observation row, not catalog table) | Yes |
| Rebuildable daily projection | **not a source of truth**; optional later derived table | n/a | n/a | Post-Monday |

**DIRECT vs CHILD freeze (F-CLAUDE-PR6P-23):**

- **DIRECT_MERCHANT_MODELS:** `ShopifyOrderFact`, `ShopifyOrderLineFact`, `ShopifyOrderRefundFact`. Same pattern as PR 5 placing `ShopifyVariantFact` in DIRECT despite being conceptually a child: each has its own Shopify GID unique plus RLS and is applied as a lock-bearing resource (Order, OrderLine identity for lock kinds; Refund as lock-bearing Clock A resource). `ShopifyOrderLineFact` is DIRECT because `LineItem.id` is `ID!` and the row is independently addressable; it is still **parent-versioned** (only an order snapshot may write it).
- **CHILD_MERCHANT_MODELS:** `ShopifyOrderRefundLineFact`, `ShopifyOrderAdjustmentFact`, `ShopifyOrderAgreementFact`, `ShopifyOrderAgreementSaleFact`, `ShopifyOrderRefundTransactionFact`. Composite FKs **must** include `shopId`. Refund lines use the ordinal composite unique, not a GID unique.

Do **not** collapse edits/refunds into `SalesDailyAggregate`.

### 2.2 What “complete PR 6” means vs Monday subset

See §16. Complete PR 6 still excludes forecasting runtime. Monday-critical is the smallest **correct** fact surface that can feed Last-X, custom range, ABC/U, and low-stock **later**, not a degraded formula.

---

## 3. Non-goals

Not authorized in this planning PR and not authorized in later PR 6 runtime unless a separate ChatGPT decision says otherwise:

- PR 6 production runtime in this PR;
- Prisma schema / migrations in this PR;
- GraphQL production documents in this PR;
- webhook/worker/runtime changes in this PR;
- PR 5 / PR 30 / PR 31 modifications;
- Phase 2 forecast, ABC, or buying-table runtime;
- replenishment / PO / receiving runtime;
- inventory mutations or inventory-write flag enablement;
- `write_orders` or any Admin mutation (`refundCreate`, `orderEditCommit`, etc.);
- customer PII storage (see forbidden list §5.11);
- treating webhook payloads as complete records;
- copying or extending `SalesDailyAggregate` as the system of record;
- tightening the three existing order/refund sanitizers in PR6-D;
- BOM explosion into component “sales” (`processBomSale`);
- silent SKU/barcode merge of deleted/recreated variants;
- JavaScript Number money;
- rounding Shopify amounts to 2 decimal places;
- deriving unit prices by division;
- enabling `read_all_orders` in this planning PR or treating grant as a correctness prerequisite;
- marking Phase 1 complete;
- production access, backfill, or merge;
- illegal Bulk C (`orders { agreements { sales } }`);
- passing pagination args on named **non-connection LIST** fields (`Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties`);
- selecting `Order.cancellation` or `LineItem.priceAfterAllDiscountsBeforeTaxesSet`;
- querying `Sale.lineItem` on the `Sale` interface.

---

## 4. Shopify source contract

API version is **Admin GraphQL 2026-07**. Documents follow F2A:

- tagged `#graphql` queries in `app/lib/order-facts/admin-read/documents.ts` for codegen (`npm run graphql-codegen`, `.graphqlrc.ts` `ApiVersion.July26`);
- untagged bulk inner queries validated by a dedicated schema gate against the codegen schema artifact;
- AST deny-by-default: mutations never reach `admin.graphql`;
- no `currentBulkOperation`; persist BulkOperation GID;
- nested bulk connections: one top-level connection, ≤5 connections, ≤2 nested connection levels, `groupObjects` remains false at submit time;
- traverse connections as `edges { node { … } }`;
- `first` omitted on bulk-traversable **connections** (bulk ignores pagination args);
- pagination args **never** passed on named **non-connection LIST** fields (`Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties`);
- connection fields **must** use `first`/`after` (including `Refund.transactions`).

No mutations.

### 4.1 Official field authority used by this plan (accessed 2026-09-02)

Sources:

- [Order 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Order)
- [LineItem 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/LineItem)
- [Refund 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Refund)
- [RefundLineItem 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/RefundLineItem)
- [OrderAdjustment 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/OrderAdjustment)
- [OrderEditAgreement 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/OrderEditAgreement)
- [MoneyBag 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MoneyBag)
- [MoneyV2 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/MoneyV2)
- [orders query 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/orders)
- [WebhookSubscriptionTopic 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/enums/WebhookSubscriptionTopic)
- [About webhooks](https://shopify.dev/docs/apps/build/webhooks)
- [Edit existing orders](https://shopify.dev/docs/apps/build/orders-fulfillment/order-management-apps/edit-orders)
- [Access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Bulk operations queries](https://shopify.dev/docs/api/usage/bulk-operations/queries)

Official notes that bind architecture:

1. Default Admin access is the **last 60 days** of orders unless `read_all_orders` is approved and granted on the token. Named constant: `orderHistoryWindowDays = 60`.
2. `Order.test` is a boolean; test orders cannot convert into real orders.
3. `LineItem.quantity` includes refunded and removed units; `currentQuantity` excludes refunded and removed units.
4. `LineItem.refundableQuantity` schema description is **identical** to `currentQuantity`. Treat `refundableQuantity ≡ currentQuantity`. No formula may depend on a difference.
5. `MoneyBag.shopMoney` is shop currency; `presentmentMoney` is customer presentment currency.
6. `MoneyV2.amount` is GraphQL `Decimal` (JSON string). Deprecated `Money` scalars must not be the write path.
7. A `Refund` object does **not** guarantee money has been returned; transactions have their own status. `ORDER_TRANSACTIONS_CREATE` fires when a transaction is created **or its status is updated**, **only** for statuses **`success`, `failure`, or `error`**. It does **not** fire for `PENDING`. PENDING transactions are observed through refund snapshots. The SUCCESS transition PO-06 depends on **does** fire.
8. Webhook delivery and ordering are **not** guaranteed; reconciliation jobs are required.
9. `orders/edited` payload reports **what changed**, not the new full order; refetch the order by GID.
10. `Order.refunds` is an **array** (non-connection LIST) with optional `first` truncation. `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, and `Refund.duties` are also non-connection LISTs. `Refund.transactions`, `Refund.refundLineItems`, `Refund.orderAdjustments`, `Refund.refundShippingLines`, `Order.lineItems`, `Order.agreements`, and `SalesAgreement.sales` are **connections** and **must** use `first`/`after`. Production refetch must **not** pass pagination args on named LIST fields.
11. `LineItem.variant` and `LineItem.product` are nullable (deleted catalog identities).
12. `Sale` does **not** expose `lineItem` on the interface. Only `ProductSale`, `GiftCardSale`, and `TipSale` do.
13. `RefundLineItem.id` is **nullable** `ID`.
14. `Refund.updatedAt` is `DateTime!`. `Refund.createdAt` is nullable.
15. `OrderTransaction` has `createdAt` + nullable `processedAt` and **no `updatedAt`**, while `status` is mutable.
16. `ORDERS_DELETE` exists and requires `read_orders`.
17. Bulk operations: ≤5 connections, maximum nesting **depth two** counting the top-level connection. `orders { agreements { sales } }` is **three** levels and **illegal**.
18. `SalesAgreement.reason` is `OrderActionType!` ∈ {`ORDER`, `ORDER_EDIT`, `REFUND`, `RETURN`, `UNKNOWN`}. Concrete types include `OrderAgreement`, `OrderEditAgreement`, `RefundAgreement`, **`ReturnAgreement`**.
19. Every `LineItem` money bag (`originalTotalSet`, `discountedTotalSet`, `totalDiscountSet`, `discountedUnitPriceSet`, `discountedUnitPriceAfterAllDiscountsSet`) **includes refunded and removed quantities**. There is **no** current-quantity line money field.
20. `ProductSale` has **no** `variant` field. Variant identity at sale is reachable only via `lineItem { variant { id } }` in the **same** snapshot.

### 4.2 Direct refetch documents (planning names)

All QUERY. Identity cross-check: requested GID must equal returned `id` or the reader fails closed (F2A lesson; never accept a different node because a field is null).

If a selected field is absent from 2026-07, **fail codegen** and substitute only a **named** schema-valid equivalent recorded in this plan; do not guess.

#### `OrderFactById`

Conceptual production shape (implementation must codegen-validate names):

```graphql
query OrderFactById(
  $id: ID!
  $lineFirst: Int!
  $lineAfter: String
  $agrFirst: Int!
  $agrAfter: String
  $saleFirst: Int!
  $refundLineFirst: Int!
  $adjFirst: Int!
  $shipRefundFirst: Int!
  $txnFirst: Int!
) {
  order(id: $id) {
    id
    legacyResourceId
    name
    createdAt
    updatedAt
    processedAt
    cancelledAt
    cancelReason
    closed
    closedAt
    edited
    test
    confirmed
    currencyCode
    presentmentCurrencyCode
    taxesIncluded
    displayFinancialStatus
    displayFulfillmentStatus
    sourceName
    currentSubtotalLineItemsQuantity
    subtotalLineItemsQuantity
    retailLocation { id }
    originalTotalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    currentTotalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    currentSubtotalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    currentTotalDiscountsSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    currentShippingPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    currentTotalTaxSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    netPaymentSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    totalRefundedSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    refundDiscrepancySet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    cartDiscountAmountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    currentCartDiscountAmountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    lineItems(first: $lineFirst, after: $lineAfter) {
      pageInfo { hasNextPage endCursor }
      edges {
        cursor
        node { ...OrderLineFactFields }
      }
    }
    refunds {
      id
      legacyResourceId
      createdAt
      updatedAt
      processedAt
      totalRefundedSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
      refundLineItems(first: $refundLineFirst) {
        pageInfo { hasNextPage endCursor }
        edges { cursor node { ...RefundLineFactFields } }
      }
      orderAdjustments(first: $adjFirst) {
        pageInfo { hasNextPage endCursor }
        edges { cursor node { ...OrderAdjustmentFactFields } }
      }
      refundShippingLines(first: $shipRefundFirst) {
        pageInfo { hasNextPage endCursor }
        edges {
          cursor
          node {
            id
            shippingLine { id }
            subtotalAmountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
            taxAmountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
          }
        }
      }
      transactions(first: $txnFirst) {
        pageInfo { hasNextPage endCursor }
        edges {
          cursor
          node {
            id
            status
            kind
            createdAt
            processedAt
            amountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
          }
        }
      }
    }
    agreements(first: $agrFirst, after: $agrAfter) {
      pageInfo { hasNextPage endCursor }
      edges {
        cursor
        node {
          id
          happenedAt
          reason
          ... on OrderAgreement { id happenedAt reason }
          ... on OrderEditAgreement { id happenedAt reason }
          ... on RefundAgreement { id happenedAt reason refund { id } }
          ... on ReturnAgreement { id happenedAt reason }
          sales(first: $saleFirst) {
            pageInfo { hasNextPage endCursor }
            edges {
              cursor
              node {
                __typename
                id
                quantity
                lineType
                actionType
                totalAmount { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
                ... on ProductSale { lineItem { id } }
                ... on GiftCardSale { lineItem { id } }
                ... on TipSale { lineItem { id } }
              }
            }
          }
        }
      }
    }
  }
}
```

**Forbidden in this document:**

- `Order.cancellation { … }` — `OrderCancellation` has only `staffNote` (forbidden PII). Use `Order.cancelReason`.
- `Sale.lineItem` on the interface.
- pagination args on named non-connection LIST fields (`Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties`).
- a shared `$saleAfter` / `$refundLineAfter` / `$adjAfter` / `$shipRefundAfter` / `$txnAfter` on `OrderFactById` (nested per-parent continuation is a **different** document).

`OrderFactById` is the **authoritative order snapshot document**. On that document:

- paginate `lineItems` and `agreements` to completion;
- **retain `agreements.edges.cursor`**;
- request **only the first page** of `sales` per agreement (`sales(first: $saleFirst)` — no `$saleAfter`);
- request **only the first page** of each refund child connection (no shared `after`).

#### `OrderAgreementSalesPage` (mandatory continuation)

Do **not** assume `SalesAgreement` can be fetched directly as a generic `Node`. Isolate **exactly one** agreement from the parent order and walk that agreement’s sales until `hasNextPage=false`.

Conceptual inputs: `$orderId`, `$agreementAfter`, `$saleFirst`, `$saleAfter`.

`$agreementAfter` is the cursor **immediately preceding** that agreement on `Order.agreements`. **`null` is valid for the first agreement.**

```graphql
query OrderAgreementSalesPage(
  $orderId: ID!
  $agreementAfter: String
  $saleFirst: Int!
  $saleAfter: String
) {
  order(id: $orderId) {
    id
    agreements(first: 1, after: $agreementAfter) {
      pageInfo { hasNextPage endCursor }
      edges {
        cursor
        node {
          id
          happenedAt
          reason
          ... on OrderAgreement { id happenedAt reason }
          ... on OrderEditAgreement { id happenedAt reason }
          ... on RefundAgreement { id happenedAt reason refund { id } }
          ... on ReturnAgreement { id happenedAt reason }
          sales(first: $saleFirst, after: $saleAfter) {
            pageInfo { hasNextPage endCursor }
            edges {
              cursor
              node {
                __typename
                id
                quantity
                lineType
                actionType
                totalAmount { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
                ... on ProductSale { lineItem { id } }
                ... on GiftCardSale { lineItem { id } }
                ... on TipSale { lineItem { id } }
              }
            }
          }
        }
      }
    }
  }
}
```

When any agreement on `OrderFactById` reports `sales.pageInfo.hasNextPage=true`, issue `OrderAgreementSalesPage` for that agreement and walk `$saleAfter` to exhaustion. Count each continuation call in the §4.5 envelope.

#### `RefundFactById`

**Mandatory continuation** whenever **any** refund child connection in `OrderFactById` is truncated (`hasNextPage=true`). A truncated refund embedded in an order response contributes **no** partial refund snapshot. Apply that refund only after the per-refund continuation is complete.

Declare **separate** pagination pairs for each connection. Do **not** share one `$first`/`$after`.

```graphql
query RefundFactById(
  $id: ID!
  $refundLineFirst: Int!
  $refundLineAfter: String
  $adjFirst: Int!
  $adjAfter: String
  $shipRefundFirst: Int!
  $shipRefundAfter: String
  $txnFirst: Int!
  $txnAfter: String
) {
  refund(id: $id) {
    id
    legacyResourceId
    createdAt
    updatedAt
    processedAt
    order { id }
    totalRefundedSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    refundLineItems(first: $refundLineFirst, after: $refundLineAfter) { ... }
    orderAdjustments(first: $adjFirst, after: $adjAfter) { ... }
    refundShippingLines(first: $shipRefundFirst, after: $shipRefundAfter) { ... }
    transactions(first: $txnFirst, after: $txnAfter) { ... }
  }
}
```

Webhook `refunds/create` supplies a refund REST id. Convert to `gid://shopify/Refund/{id}`, fetch refund (complete children), then fetch/apply the parent order **if the parent is inside the accessible window**. The refund query is not sufficient as the only apply input because line current quantities live on the order. If the parent is outside the window, record `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` / `historyWindowState` and do **not** treat null parent as tombstone.

#### `OrderLineFactFields` (conceptual)

Required:

- `id`, `sku`, `title`, `variantTitle`, `vendor`, `name`, `isGiftCard`
- `quantity`, `currentQuantity`, `refundableQuantity`, `unfulfilledQuantity`, `nonFulfillableQuantity`
- `originalTotalSet`, `originalUnitPriceSet`
- `discountedTotalSet(withCodeDiscounts: true)` **and** `discountedTotalSet(withCodeDiscounts: false)` if both are needed for reconciliation — if GraphQL cannot alias two argument variants in one selection, issue two line reads or persist the `withCodeDiscounts: true` value and record the argument in lineage
- `discountedUnitPriceAfterAllDiscountsSet` — **lineage only**; includes refunded/removed quantities; **not** a current-quantity price
- `totalDiscountSet`
- `variant { id legacyResourceId sku title }` (nullable)
- `product { id legacyResourceId title handle }` (nullable)

**Do not select:** `priceAfterAllDiscountsBeforeTaxesSet` (does not exist); `customAttributes`; `staffMember`; `taxLines(first:)`; `discountAllocations(first:)`; `duties(first:)`. If tax/discount/duty arrays are selected at all, **omit `first`**.

### 4.3 Pagination rules (nested per-parent walk — frozen)

1. `OrderFactById` remains the authoritative order snapshot document.
2. Direct `order(id:)` **must** cursor-paginate `lineItems` and `agreements` until `hasNextPage=false`. **Retain agreement edge cursors.**
3. First-page `sales` / refund-child connections on `OrderFactById` are **not** a complete nested walk. Incomplete nested connections **must** continue:
   - agreements/sales → `OrderAgreementSalesPage` (exactly one agreement per request; walk sales to `hasNextPage=false`);
   - truncated refund children → `RefundFactById` with **per-connection** first/after pairs.
4. Do **not** assume `SalesAgreement` is a generic `Node`.
5. A truncated refund in an order response contributes **no** partial refund snapshot.
6. Parent/child **canonical apply occurs only after every required connection for that snapshot is complete.**
7. No silent `first: 50` / `first: 250` cap. A page size may be 100–250 for **connection** transport, but the loop is mandatory.
8. **Never pass pagination args on named non-connection LIST fields:** `Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties`. T20 asserts only those. If `Order.refunds` is truncated because `first` was passed, that apply is invalid.
9. **Connection fields must paginate** with `first`/`after`: `Order.lineItems`, `Order.agreements`, `SalesAgreement.sales`, `Refund.refundLineItems`, `Refund.orderAdjustments`, `Refund.refundShippingLines`, **`Refund.transactions`**.
10. Incomplete pagination is **not** a successful apply. Incomplete pagination yields **no child absence** and **no successful parent apply**.
11. Durable incomplete-snapshot evidence lives on **`OrderFactObservationInFlight`**, outcome **`SNAPSHOT_PAGINATION_INCOMPLETE`**. Do **not** create or partially apply a canonical Order/Refund merely to persist the diagnostic. If continuation succeeds, complete the observation normally. If bounded retries / request budget end without a complete snapshot, persist the terminal non-success diagnostic on the observation and let `order-facts-reconcile` derive the corresponding `DataIssue`.

### 4.4 Incremental window / cursor

`orders` search supports `updated_at` and `processed_at` filters (official orders query docs).

Sync domains (control-plane `SyncCursor.syncDomain` strings):

| Domain | Cursor meaning |
|---|---|
| `orders_full` | Bulk historical import fence / completion watermark |
| `orders_incremental` | Inclusive `updated_at` lower bound last successfully applied |
| `orders_reconcile` | Last completed **exhaustive** reconcile sweep end |

Incremental query shape:

```text
orders(query: "updated_at:>='TIMESTAMP'") { ... }
```

Watermark is the maximum applied Shopify `updatedAt` among **successfully applied** orders in that run, not the job start time, not webhook `receivedAt`. Overlap the previous watermark by a documented skew window (propose 2 minutes; product-owner may tighten) so clock skew does not drop rows. Duplicate apply is cheap because apply is idempotent.

Do **not** use webhook payloads as the incremental record.

**Completeness mechanism (F-CLAUDE-PR6P-15):** the exhaustive `updated_at` incremental/reconcile **sweep** is how missed webhooks are healed **inside the accessible window**. A sampled deep-diff is **drift detection only**. Sampling must **not** be claimed as completeness. Out-of-window refunds/edits **cannot** be healed by either mechanism without `read_all_orders`.

### 4.5 Bulk-operation suitability

Bulk **is** the historical import path for **orders + lines**. Direct pagination of `orders` for 1,000,000 line facts is forbidden as the primary **line** import.

**Bulk A — orders + lines (Monday-critical, LEGAL: two connection levels):**

```graphql
{
  orders {
    edges {
      node {
        id
        legacyResourceId
        name
        createdAt
        updatedAt
        processedAt
        cancelledAt
        cancelReason
        closed
        edited
        test
        currencyCode
        presentmentCurrencyCode
        taxesIncluded
        displayFinancialStatus
        sourceName
        currentSubtotalLineItemsQuantity
        retailLocation { id }
        originalTotalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        currentTotalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        currentSubtotalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        currentTotalDiscountsSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        currentShippingPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        currentTotalTaxSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        netPaymentSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        totalRefundedSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
        lineItems {
          edges {
            node {
              id
              sku
              title
              variantTitle
              vendor
              name
              isGiftCard
              quantity
              currentQuantity
              refundableQuantity
              originalTotalSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
              originalUnitPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
              discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
              totalDiscountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
              variant { id legacyResourceId sku title }
              product { id legacyResourceId title handle }
            }
          }
        }
      }
    }
  }
}
```

Bulk A must **not** select `priceAfterAllDiscountsBeforeTaxesSet` or `cancellation`.

**Bulk B — refunds / adjustments:** `orders { refunds { refundLineItems { … } } }` uses `refunds` as an **array**, not a connection. Bulk documentation does not address non-connection list fields. **PR6-B gate deliverable:** submit the candidate document to the schema/bulk gate and **record the result**.

- If legal and complete (no silent truncation): use Bulk B.
- If illegal or truncating: **costed fallback** = per-order `refund(id:)` / `order(id:)` refund pagination for every Bulk A order that reports refund presence (`totalRefundedSet` non-zero **or** `refunds` non-empty if that field is readable without nesting). Bound: one additional Admin request per refund-bearing order, counted against the 1,000,000-line envelope. State the observed refund-bearing-order ratio in the PR6-B report. Do **not** invent a REST-only refund import.

**Bulk C — DELETED.** `orders { agreements { sales } }` is **three** connection levels and **illegal**. T53: a three-level Bulk C document **must** be rejected by the bulk schema gate.

**Agreement/sale primary path:** paginated `order(id:) { agreements { sales } }` for every Bulk A (or incremental) order with `edited = true` **OR** any refund present. This is the unit-event ledger path (PO-03 / Option A).

**Request-count bound vs 1,000,000-line envelope:**

- Let `N_edit_or_refund` = count of orders in the accessible window with `edited=true` OR refund-bearing.
- Each such order requires a fully paginated `OrderFactById` walk of `lineItems` + `agreements`.
- **Count `OrderAgreementSalesPage` continuation calls explicitly** (one or more per agreement whose sales exceed the first page).
- **Count `RefundFactById` continuation calls explicitly** (one complete per-refund walk whenever any refund child connection on the order response was truncated, **and** as the Bulk B fallback for refund-bearing orders).
- Engineering hypothesis to **prove in PR6-B**, not to invent later: if `N_edit_or_refund` plus continuation calls would produce unbounded N+1 versus the Phase 1 “no N+1 Shopify requests” rule, PR6-B must (a) batch/limit concurrency, (b) record query-count assertions including continuation counts, and (c) fail the lane if the envelope cannot be met without silent truncation. Do **not** drop agreements to “save” requests — they are Monday-critical under Option A.

Partial bulk JSONL is **not** a successful full sync (PR 5 rule reused). Two-phase ingest: persist JSONL line evidence on merchant facts, then acknowledge control-plane ordinal.

### 4.6 Current vs historical product linkage

| Link | Rule |
|---|---|
| `shopifyVariantGid` / `shopifyProductGid` on the line | Snapshot of GraphQL `variant.id` / `product.id` **at refetch**, nullable |
| `variantGidAtSale` | Same GID string persisted forever even if later refetches return null |
| Current `ShopifyVariantFact` | Optional lookup only; **no FK**; missing current catalog is normal |
| SKU / barcode / title | Attributes/snapshots; **never** merge keys |

If a later refetch returns `variant=null`, do **not** clear `variantGidAtSale`. Existence of the **order** is independent of catalog existence.

Never explode a sold line into BOM components.

### 4.7 Rolling history window (existence + observability)

Named constant: **`orderHistoryWindowDays = 60`**.

Without `read_all_orders`, Shopify only returns ~60 days of orders **relative to now** (rolling). ABC/U last eight weeks (56 days) **may** fit; Last-X of 90 days, custom ranges, and same-period-last-year will not **from live Shopify**. The app **retains** facts it already stored.

Implementation must:

- detect truncated **import** depth (requested window older than accessible orders);
- persist merchant-durable `historyWindowState` including `ORDER_HISTORY_WINDOW_TRUNCATED` (import depth) distinct from `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` (existence);
- never present a truncated extract as a complete lookback;
- never treat window aging as deletion.

**Correctness boundary (F-CLAUDE-PR6P-03):** refunds and edits on orders older than the window are **permanently unobservable** via `order(id:)` / `refund(id:)` until `read_all_orders` is granted. `refunds/create` and `orders/edited` may still fire. Record the signal; emit `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`; do **not** tombstone the parent; do **not** claim reconcile healed it.

Enabling `read_all_orders` is **not** added by this PR (PO-01). If later granted, the window predicate for confirmed absence is unconditional and PR 5 semantics apply.

---

## 5. Canonical schema proposal

Logical names. Additive Prisma/SQL only. No edits to PR 5 catalog models except Shop relation arrays **and** `Shop.ianaTimezone` / `Shop.currencyCode`.

### 5.0 PR6-A Shop columns

| Column | Source | Nullability | Rule |
|---|---|---|---|
| `ianaTimezone` | Shopify `Shop.ianaTimezone` — **`String!` in Admin 2026-07** (target Shopify fact is **non-null**) | Additive **nullable-first** Prisma column + backfill is allowed for PR6-A migration safety. That is **not** API nullability. Persist the exact IANA string Shopify reports. Missing or malformed **authoritative** input **fails closed**. **Never** substitute UTC or server local. Defensive transport/schema-drift handling is **policy**, not a schema property. | Calendar-day boundaries for `net-units-order-date-v1` |
| `currencyCode` | Shopify `Shop.currencyCode` — **`CurrencyCode!` in 2026-07** | persist Shopify value | Shop-level; **per-order** `ShopifyOrderFact.shopCurrencyCode` (`Order.currencyCode`) is what makes **historical** amounts survive a later shop currency change |

These are Shopify-authoritative facts, not product policy. They belong in PR6-A so Q-PR6-02/03 do not require a second migration.

### 5.1 Shared tenancy / lineage and frozen clock table

Copy the PR 5 fact pattern; do not invent a second clock system. Do not invent a child versioning scheme.

**Frozen per-fact-type clock table (F-CLAUDE-PR6P-04):**

| Fact type | Clock A source | Clock B existence source | Clock C signal | Rule |
|---|---|---|---|---|
| Order | `Order.updatedAt` (`DateTime!`) | `order(id:)` **subject to §8 window predicates** | `orders/create`, `orders/cancelled`, `orders/edited`, `orders/delete` | Defined |
| Refund | **`Refund.updatedAt` (`DateTime!`)** — bound independently of the order gate | `refund(id:)` / presence in `Order.refunds` | `refunds/create` | Always evaluate refund Clock A even when the refund node arrives inside an order refetch |
| LineItem | **NONE** | presence in parent **order** snapshot | none | Parent-versioned |
| RefundLineItem | **NONE** | presence in parent **refund** snapshot | none | Parent-versioned |
| OrderAdjustment | **NONE** | presence in parent **refund** snapshot | none | Parent-versioned |
| SalesAgreement | `happenedAt` is **event time, immutable, not a version** | presence in `Order.agreements` | `orders/edited` | Parent-versioned by order snapshot |
| Sale | **NONE** | presence in parent agreement | none | Parent-versioned |
| OrderTransaction | **NONE** (`createdAt` immutable; `processedAt` nullable; `status` mutable) | presence in `Refund.transactions` | **`order_transactions/create`** (create **or** status update, **only** for `success` / `failure` / `error`; **does not fire for `PENDING`**) | Refresh via refund snapshot apply **and** transaction-topic refetch of the parent refund when the topic fires. **PENDING** status is observed through refund snapshots, never through this webhook. Never treat `createdAt` as status version |

**Parent-versioned children (frozen):**

- The **only** legal writer of `ShopifyOrderLineFact`, `ShopifyOrderAgreementFact`, `ShopifyOrderAgreementSaleFact` is an **order** snapshot apply.
- The **only** legal writer of `ShopifyOrderRefundLineFact`, `ShopifyOrderAdjustmentFact`, `ShopifyOrderRefundTransactionFact` is a **refund** snapshot apply (from `refund(id:)` or from the refund node inside an order refetch **after** that refund’s own Clock A gate passes).

**Snapshot atomicity (frozen):**

- A parent snapshot is applied **whole or not at all**.
- If the parent clock-A gate **rejects** the response (`response.updatedAt < stored.shopifyUpdatedAt`), **every** child derived from that response is discarded. No partial application. T44.
- Gate rejects **only** `<`. **Equal** `updatedAt` **must** re-apply idempotently (child repair). T45.
- Child absence from a **complete, fully-paginated** parent snapshot marks that child `existenceState=ABSENT` **scoped to the parent**; it never tombstones the parent and never physically deletes the row. Incomplete pagination ⇒ no child absence and no successful apply.

Required on every order-domain fact (adapted from PR 5):

- `id` cuid
- `shopId` non-null, immutable, composite unique `(shopId, id)`
- tenant-leading identity unique as specified per table
- Clock A columns **only where the table above supplies them**
- `existenceState` `LIVE | ABSENT` — **plus** window/unverified kinds that **preserve** last unambiguous state
- `existenceKind` including at least:
  - `LIVE_REFETCH`
  - `LIVE_FULL_SYNC_PRESENT`
  - `ABSENT_CONFIRMED_QUERY` (only when §8 predicates hold)
  - `INACCESSIBLE_HISTORY_WINDOW` (preserve last `existenceState`; not a tombstone)
  - `ABSENT_SIGNALLED_DELETE_UNVERIFIED` (out-of-window `orders/delete`)
- `existenceObservedAt`, `existenceRequestGen`, `existenceResponseGen` (clock B)
- clock C signal fields (`signalReceivedAt`, `lastSignalTopic`, `lastSignalDeliveryId`, `lastSignalTriggeredAt`)
- `lastSeenFullSyncRunId`, `attributeRequestGen` / `attributeResponseGen`, `attributeFreshnessState`
- `existenceDiagnosticState`, `absenceNominationState`, `ingestBatchId`
- **`moneyDiagnosticState`**, **`unitDiagnosticState`**, **`historyWindowState`** (merchant-durable; F-CLAUDE-PR6P-11)
- `sourceKind` `FULL_SYNC | INCREMENTAL_REFETCH | DELETE_WEBHOOK | RECONCILE | TRANSACTION_WEBHOOK`
- `lastSyncRunId`, `lastDurableJobId`
- `deletedAt`, `deletionSource`
- `shopifyLegacyResourceId` where Shopify supplies it
- `createdAt` / `updatedAt` app timestamps
- observation token scope snapshot: persist the effective scope set used for the observation (`read_orders` / `read_all_orders` presence) so scope **downgrade voids absence authority** (T50)

Reuse platform sequence `stocky_catalog_observation_gen_seq` for request/response gens. **One-line PR6-A note:** the catalog-scoped name is **platform infrastructure**, not catalog-only; do not mint a second sequence. Do **not** add a generation counter to `Shop`. Cross-shop numeric comparison of gens remains forbidden.

New lock version (do **not** edit frozen `stocky-pr5-canonical-lock-v1`):

```text
stocky-pr6-canonical-lock-v1
```

Resource-kind literals (exact): `Order`, `OrderLine`, `Refund`, `RefundLine`.

Encoding: same as PR 5 — `<decimal UTF-8 byte length>:<UTF-8 bytes>` components, SHA-256, signed int32 `key1`/`key2` from digest bytes 0..7, never a JS Number 64-bit key. Known-answer vectors required in PR6-A.

**Deterministic Order+Refund lock order (F-CLAUDE-PR6P-24 / R-160):**

- Refund jobs **always** lock the parent **Order** identity **and** the **Refund** identity.
- Order-only jobs lock **Order** only (unless the same transaction also applies refund snapshots from nested refund nodes — then include each Refund GID).
- Acquire locks in **ascending `(key1, key2)`** after **dedupe**. Remove “may also lock”.
- Do not lock 250 line GIDs independently in one transaction (capacity envelope / R-161).
- Do not hold advisory locks across Shopify I/O.
- Lock-before-first-insert remains mandatory.

### 5.2 `ShopifyOrderFact`

Identity: `@@unique([shopId, shopifyGid])`. DIRECT.

| Column | Source |
|---|---|
| `shopifyGid` | `Order.id` |
| `name` | `Order.name` (not unique across shops; not PII) |
| `shopifyCreatedAt` | `createdAt` |
| `shopifyUpdatedAt` | `updatedAt` (Clock A) |
| `processedAt` | `processedAt` — persist exact Shopify DateTime string **and** timestamptz via F2A-style validator (no `Date.parse` rewrite) |
| `cancelledAt` | `cancelledAt` |
| `cancelReason` | `cancelReason` enum as text |
| `closed` / `closedAt` | Order |
| `edited` | `edited` |
| `test` | `test` |
| `confirmed` | `confirmed` |
| `shopCurrencyCode` | `Order.currencyCode` — historical shop currency of **this order** |
| `presentmentCurrencyCode` | `presentmentCurrencyCode` |
| `taxesIncluded` | `taxesIncluded` |
| `displayFinancialStatus` | enum/text |
| `displayFulfillmentStatus` | enum/text |
| `sourceName` | `sourceName` (web/pos/…) |
| `retailLocationGid` | `retailLocation.id` nullable — **not** a sale-location authority by itself |
| `currentSubtotalLineItemsQuantity` | Int |
| `subtotalLineItemsQuantity` | Int |
| Money bags listed in §4.2 | `Decimal(20,6)` + currency columns per bag side |

Indexes: `@@index([shopId, processedAt])`, `@@unique` GID, existence/reconcile supporting indexes as PR 5 analog.

### 5.3 `ShopifyOrderLineFact`

Identity: `@@unique([shopId, shopifyGid])`. DIRECT. Parent-versioned.

Child FK: `(shopId, shopifyOrderGid)` → `ShopifyOrderFact`. Parent may be LIVE or ABSENT.

| Column | Source / rule |
|---|---|
| `shopifyGid` | `LineItem.id` — **stable line identity** across edits (`ID!`) |
| `shopifyOrderGid` | parent |
| `quantity` | original/inclusive units |
| `currentQuantity` | excludes refunded+removed |
| `refundableQuantity` | persist for lineage; **≡ `currentQuantity`**; no formula may use a difference |
| `unfulfilledQuantity` | persist; not Monday demand input |
| `isGiftCard` | boolean |
| `title` / `variantTitle` / `vendor` / `sku` / `name` | snapshots at last successful apply |
| `variantGidAtSale` | first non-null `variant.id` observed; immutable afterward |
| `productGidAtSale` | first non-null `product.id` observed; immutable afterward |
| `currentVariantGid` | latest refetch `variant.id` or null |
| `currentProductGid` | latest refetch `product.id` or null |
| `variantLegacyResourceId` | snapshot |
| **`orderProcessedAt`** | denormalized from parent; **order-applicator-written only** |
| **`orderCancelledAt`** | denormalized from parent; order-applicator-written only |
| **`orderTest`** | denormalized from parent; order-applicator-written only |
| **`orderShopCurrencyCode`** | denormalized from parent; order-applicator-written only |
| money columns | see §6 |
| **no FK** to `ShopifyVariantFact` | historical identity survives catalog tombstone |

**Invariant (tested):** denormalized order date/test/currency columns **equal** the parent `ShopifyOrderFact` after every successful order apply. **Backfill rule:** when an order snapshot changes `processedAt`, `cancelledAt`, `test`, or `shopCurrencyCode`, the same apply transaction **rewrites** those columns on **all** LIVE (and retained ABSENT) child line rows of that order. No lazy backfill. No line-only writer.

**Index (realisable):** `@@index([shopId, variantGidAtSale, orderProcessedAt])`. Also `@@index([shopId, shopifyOrderGid])`.

Removed-but-still-listed lines remain rows (`currentQuantity=0`). Do not delete line rows.

`LineItem` has **no** `createdAt` / `updatedAt`. Do not invent them.

### 5.4 `ShopifyOrderRefundFact` / `ShopifyOrderRefundLineFact` / transactions

Refund identity: `(shopId, shopifyGid)` from `Refund.id` (`ID!`). DIRECT. Clock A = `Refund.updatedAt`.

`Refund.createdAt` is **nullable**. Persist null; never coerce.

Refund line identity (**null-safe**):

```text
@@unique([shopId, shopifyRefundGid, shopifyLineItemGid, refundLineOrdinal])
```

- `refundLineOrdinal` = zero-based position within the **complete, fully-paginated** `refundLineItems` connection of **that refund snapshot**.
- `shopifyGid` (`RefundLineItem.id`) is **nullable lineage**, not the unique key.
- `RefundLineItem.lineItem` is `LineItem!` — `shopifyLineItemGid` is always present.
- CHILD model.

| Refund line column | Source |
|---|---|
| `quantity` | refunded units (money/restock evidence; **not** a unit-event ledger row) |
| `restockType` / `restocked` | inventory restock **signal only** — PR 6 does not mutate inventory |
| `restockLocationGid` | `location.id` nullable |
| `subtotalSet` / `totalTaxSet` / `priceSet` | MoneyBags |
| `shopifyGid` | nullable |

`RefundLineItem` has **no** timestamps.

`ShopifyOrderRefundTransactionFact`: persist `id` (`ID!`), `status`, `kind`, `createdAt`, nullable `processedAt`, `amountSet`. CHILD. **Do not** persist `user`, `accountNumber`, `receiptJson`, `paymentDetails`, `device`.

Refund money metrics use transaction `SUCCESS` (PO-06). Unit-return evidence does **not** wait on SUCCESS.

Indexes: `@@index([shopId, shopifyOrderGid])` on refund and refund-line; `@@index([shopId, shopifyLineItemGid])` on refund lines.

### 5.5 `ShopifyOrderAdjustmentFact`

From `Refund.orderAdjustments`: `id` (`ID!`), `reason`, `amountSet`, `taxAmountSet`, parent refund GID, parent order GID. CHILD. No timestamps. Index `shopifyOrderGid`.

Needed for the frozen refund money identity in §6.6.

### 5.6 Agreement / sale facts

`ShopifyOrderAgreementFact`: `(shopId, shopifyGid)` where GID is `SalesAgreement.id` (`ID!`). Columns: `happenedAt`, GraphQL `__typename`, `reason` (`OrderActionType`), optional `refundGid` from `RefundAgreement`. CHILD. `happenedAt` is event time, not Clock A.

`ShopifyOrderAgreementSaleFact` identity (**one definition only**): `(shopId, shopifyGid)` where `shopifyGid = Sale.id` (`ID!`). Required FK `shopifyAgreementGid` + `shopId`. CHILD.

Columns: `quantity` (**nullable signed Int** — persist Shopify’s raw value including negatives; never coerce to 0; never `abs()`; null is never a unit event), `lineType`, `actionType`, `saleTypename`, `shopifyLineItemGid` nullable, `totalAmount` MoneyBag. Sign convention is frozen in §7.1.

Indexes: `@@index([shopId, shopifyOrderGid])`, `@@index([shopId, shopifyLineItemGid])`, `@@index([shopId, happenedAt])` (store `happenedAt` denormalized from parent agreement on the sale row, agreement-applicator-written, invariant-tested — required so the unit ledger can be dated without a join that the Monday envelope cannot afford). **Backfill:** same transaction as agreement apply rewrites sale `happenedAt` from parent.

This table **is** the unit-event ledger (Option A).

### 5.7 Shipping

Monday: persist order-level `currentShippingPriceSet`. Full `ShopifyOrderShippingLineFact` is post-Monday parity. Refund shipping lines **are** Monday-critical for the refund money identity (persist as columns/child of refund snapshot; not deferred).

### 5.8 `OrderFactObservationInFlight`

Same lifecycle contract as `CatalogObservationInFlight` (`ACTIVE` ⇒ `responseGen IS NULL`; `COMPLETED` ⇒ `responseGen NOT NULL`). Do not reuse the catalog table (domain isolation). Same lease helpers pattern; new SQL names.

This table is the **durable incomplete-snapshot / fetch-failure evidence** for the order domain.

**Named outcome `SNAPSHOT_PAGINATION_INCOMPLETE` (frozen):**

- Persist on the in-flight observation when a required nested walk cannot be completed (agreement sales or refund child connections still `hasNextPage=true` after bounded retries / request budget).
- Do **not** create or partially apply a canonical `ShopifyOrder` / `ShopifyRefund` merely to persist this diagnostic.
- A truncated refund embedded in an order response contributes **no** partial refund snapshot.
- If continuation later succeeds, **clear/complete** the observation normally (`COMPLETED`, `responseGen` set) and apply the complete snapshot under §5.1 clocks.
- If the budget ends without a complete snapshot, persist the **terminal non-success** outcome on the observation. `order-facts-reconcile` derives the corresponding `DataIssue` from that observation. §15 must not say “none” for this failure.
- This is a merchant-domain observation contract, not a `historyWindowState` sibling on a canonical row that was never applied.

### 5.9 What is explicitly not a fact table

| Legacy / derived | Status |
|---|---|
| `SalesDailyAggregate` | Legacy, lossy, location=`default`, `parseFloat`. **Not** PR 6 SoR. Do not extend. Keep v1 webhook projections feeding it until a **separate authorized** cutover. |
| Forecast / ABC tables | Phase 2 consumers |
| Compatibility projection into `SalesDailyAggregate` | Not PR 6. If later desired, rebuildable only **after** canonical commit, never clock authority (F2C rule). |

### 5.10 RLS / enforcement registration (implementation)

New models are `merchant_domain`, `rlsRequired`, DML for `stocky_runtime` only with tenant GUC. Register in:

- `scripts/tenant-enforcement/manifest.ts`
- `app/tenant/models.ts` `DIRECT_MERCHANT_MODELS` / `CHILD_MERCHANT_MODELS` per §2.1
- **`scripts/tenant-enforcement/roles.ts`** — **PR6-A ownership** (sequence/table grants so `stocky_runtime` can use the new tables)
- tenant-access allowlist if still mechanically generated in that lane

Shop relation arrays are additive. `shopId` immutability trigger/policy from PR 3 must apply.

Runtime has **no** privileges on `DataIssue`. Applicators **must not** DML `DataIssue`.

### 5.11 Forbidden PII (do not persist, do not select when avoidable)

- customer, addresses, email, phone, IP, `note`, customer GID, marketing consent;
- `LineItem.customAttributes`;
- `LineItem.staffMember`;
- `Refund.staffMember`;
- `SalesAgreement.user`;
- `OrderTransaction.user`, `accountNumber`, `receiptJson`, `paymentDetails`, `device`;
- `Order.cancellation.staffNote` / entire `cancellation` selection.

---

## 6. Exact money contract

### 6.1 Source types

- Persist `MoneyV2.amount` as the exact decimal **string** from JSON into PostgreSQL `NUMERIC`/`Decimal(20,6)` (same physical type as PR 5 variant price).
- Persist `currencyCode` with every amount (bag side may differ).
- `requireDecimalString` / `optionalDecimalString` from F2A decimal helpers (copy into `order-facts/admin-read/decimal.ts` or import the catalog helper **without** importing catalog documents). Empty/non-string fails closed.
- `legacyResourceId` remains string/bigint token, never Number.

Forbidden:

- `Number(...)`, `parseFloat`, `* 1.0`, mixing amounts in JS number;
- deprecated GraphQL `Money` scalars as the write path;
- silent 2-decimal rounding;
- converting presentment → shop via app FX;
- **deriving per-unit money by division** (JS or NUMERIC). Per-unit value comes from `Sale.totalAmount` or `RefundLineItem.subtotalSet` as Shopify reported them. Do not compute `bag / quantity`.

### 6.2 Shop vs presentment policy — fail-apply

**Persist both sides** of every **required** MoneyBag selected.

**Operational / forecast / ABC shop-currency amounts** use **`shopMoney` only**. Presentment is lineage for international orders and merchant support, not the Monday demand currency.

If `shopMoney.currencyCode` ≠ order `currencyCode` on a **required** bag: **fail-apply the entire resource snapshot**. No “skip bag”. No partial-freshness model.

Multi-currency shops: each order has its own `currencyCode`. Cross-order ABC revenue **must not** sum mixed currencies. **No app FX.** Product still chooses exclude vs shop-only vs (forbidden) FX — proposed **Q-012**. Engineering half is frozen here.

Per-order `Order.currencyCode` (`shopCurrencyCode` on the fact) is what makes historical amounts survive a later shop currency change.

### 6.3 Required vs optional bags

**Required bags (invalid/missing/mismatch ⇒ fail-apply that resource snapshot):**

| Resource | Required bags |
|---|---|
| Order | `originalTotalPriceSet`, `currentTotalPriceSet`, `currentSubtotalPriceSet`, `currentTotalDiscountsSet`, `currentTotalTaxSet`, `totalRefundedSet`, `netPaymentSet` |
| Line | `originalTotalSet`, `originalUnitPriceSet`, `discountedTotalSet`, `totalDiscountSet` |
| Refund | `totalRefundedSet` |
| Refund line | `subtotalSet`, `totalTaxSet`, **`priceSet`** (`MoneyBag!` in 2026-07; required refund-line MoneyBag lineage) |
| Refund shipping line | `subtotalAmountSet`, `taxAmountSet` |
| Order adjustment | `amountSet`, `taxAmountSet` |
| Sale | `totalAmount` |
| Order transaction | `amountSet` |

**Optional (lineage / not required for fail-apply):** `refundDiscrepancySet`, `cartDiscountAmountSet`, `currentCartDiscountAmountSet`, `currentShippingPriceSet`, `discountedUnitPriceAfterAllDiscountsSet`. Missing optional bags do **not** fail-apply; present-but-invalid decimal still fail-applies the snapshot.

`RefundLineItem.priceSet` is **`MoneyBag!` in 2026-07** and is a **required** refund-line bag (not optional). Treating a required bag as absent is fail-apply. Defensive transport/schema-drift handling is **policy**, not API nullability.

### 6.4 Arithmetic and precision

All derived sums/diffs use PostgreSQL `NUMERIC` or Prisma `Decimal` (decimal.js inside Prisma). Integer units use `Int` / `BigInt`, never floats.

Reconciliation equality is **exact** string/numeric equality to Shopify-reported bag amounts, not epsilon.

Shopify Decimal may include sub-cent fractions. Persist full source string. Tests include `0.123456`.

Zero-value lines: `amount = "0.0"` / `"0.00"` is valid. Quantity may be > 0 with zero price. Do not drop the line.

### 6.5 Merchant-durable diagnostics vs `DataIssue`

Applicator writes **only** merchant-durable columns:

- `moneyDiagnosticState`
- `unitDiagnosticState`
- `historyWindowState`
- `existenceDiagnosticState` / `attributeFreshnessState` as inherited

Control-plane `DataIssue` is derived by the **reconciler** (PR 5 Race Z): fact commits diagnostic state; if process dies before `DataIssue` write, reconciler recreates it. Runtime **cannot** DML `DataIssue`.

Named writer for every §15 row: **order/refund applicator** for merchant columns; **order-facts-reconcile** for `DataIssue`.

### 6.6 Frozen refund money-reconciliation identity

Tested invariant `REFUND_MONEY_UNBALANCED` on mismatch. Exact NUMERIC, **no coerce**:

```text
Refund.totalRefundedSet.shopMoney
  == Σ RefundLineItem.subtotalSet.shopMoney
   + Σ RefundLineItem.totalTaxSet.shopMoney
   + Σ RefundShippingLine.subtotalAmountSet.shopMoney
   + Σ RefundShippingLine.taxAmountSet.shopMoney
   + Σ OrderAdjustment.amountSet.shopMoney
   + Σ OrderAdjustment.taxAmountSet.shopMoney
```

All terms same `currencyCode` as the refund/order shop money. Mismatch ⇒ fail-apply **or** successful persist of Shopify fields **with** `moneyDiagnosticState=REFUND_MONEY_UNBALANCED` **only if** the bags themselves parsed — choose **persist Shopify fields + diagnostic** when every required bag parsed and the **sum identity** fails (Shopify-reported inconsistency). Do not invent a balancing entry. T49.

Shopify-reported amounts remain the stored truth. The identity is a **reconciliation check**, not a license to rewrite bags.

---

## 7. Exact unit / net-sales contract

### 7.1 Fact-level unit fields (frozen; Shopify-authored)

Evaluated **only** over a **consistent snapshot pair** (same observation / same parent apply) **or** by the reconciler after both order and refund snapshots for that generation are complete. Never mix line quantities from observation *n* with refund lines from observation *n−k*.

**Sole unit-event ledger:** `ShopifyOrderAgreementSaleFact`. Do **not** reintroduce refund-line units into the unit ledger.

**Variant net units** for a line are the **sum of signed eligible `Sale.quantity`** (`ProductSale` / `PRODUCT`) dated per §7.2.2:

```text
net_units = Σ Sale.quantity
            over eligible ProductSales on that line
            with parent reason ∈ {ORDER, ORDER_EDIT, REFUND, RETURN}
            and Sale.quantity IS NOT NULL
```

**Frozen sale-quantity sign convention (Shopify 2026-07):**

| Parent `SalesAgreement.reason` | Eligible `Sale.quantity` | Meaning |
|---|---|---|
| `ORDER` | **positive** | original sale |
| `ORDER_EDIT` **positive** | **positive** | true **addition** — **never** a removal |
| `ORDER_EDIT` **negative** | **negative** | edit **removal** |
| `REFUND` / `RETURN` reversal | **negative** | reversal of original sale units |

Official 2026-07 `order` query example (pinned by T55): a `RETURN` `ProductSale` has `"quantity": -2` (and a negative `totalAmount`).

**Never `abs()` and never otherwise coerce an unexpected sign.** Persist Shopify’s raw `Sale.quantity`. If a `REFUND`/`RETURN` sale has a **positive** quantity, or any other sign contradiction vs the table above, set `unitDiagnosticState=UNIT_SALE_SIGN_INCONSISTENT`. Derived magnitudes for **that inconsistent snapshot** must **not** be represented as trustworthy values.

For each line, on a **consistent valid-sign** snapshot only:

| Name | Definition | Source |
|---|---|---|
| `ordered_units` | Units ordered including later refunds and removals | `LineItem.quantity` |
| `current_units` | Units remaining excluding refunded and removed | `LineItem.currentQuantity` |
| `refunded_units` | **Positive magnitude** of valid **negative** eligible REFUND/RETURN sale quantities | unit-event ledger — **not** refund-line sum |
| `removed_units` | **Positive magnitude** of valid **negative** eligible ORDER_EDIT removal quantities. Positive ORDER_EDIT quantities are **additions, never removals**. | unit-event ledger |

Exact formulas (eligible = variant-unit `ProductSale` / `PRODUCT`; `Sale.quantity IS NOT NULL`):

```text
refunded_units
  = −Σ (Sale.quantity of eligible ProductSales
        whose parent reason ∈ {REFUND, RETURN}
        and Sale.quantity < 0)

removed_units
  = −Σ (Sale.quantity of eligible ProductSales
        whose parent reason = ORDER_EDIT
        and Sale.quantity < 0)
```

**Identity (only on a consistent valid-sign snapshot):**

```text
ordered_units − current_units − refunded_units = removed_units
```

Do **not** evaluate this identity, and do **not** publish trustworthy derived magnitudes, when `unitDiagnosticState=UNIT_SALE_SIGN_INCONSISTENT`.

If the identity fails on a consistent **valid-sign** snapshot pair, do not coerce. Set `unitDiagnosticState=LINE_UNIT_IDENTITY_INCONSISTENT`. Keep stored Shopify fields.

T29 and T54 must **actually detect** contradictory unit identities (a broken identity must fire; a consistent exchange must not). T47: the underlying reversal sale stores **−1** **and** derived `refunded_units = 1`.

Gift-card lines (`isGiftCard=true`) and `GiftCardSale` / `TipSale`: stored; **excluded from variant demand / replenishment / ABC** (PO-08).

Custom/no-variant lines (`variantGidAtSale` null): stored; **excluded from variant-level forecast/ABC**; countable in order-level money reconciliation. Do not fabricate variant identity.

Test orders (`orderTest=true`): stored; **excluded from every operational demand / velocity / ABC metric** (PO-05).

### 7.2 One unit-event ledger (Option A — frozen)

**Sole unit-event ledger:** `ShopifyOrderAgreementSaleFact` rows whose parent `SalesAgreement.reason` ∈ {`ORDER`, `ORDER_EDIT`, `REFUND`, `RETURN`} **and** whose concrete sale type is variant-unit eligible per §7.2.1.

Refund-line facts remain stored as **money, restock, and reconciliation evidence** and are **not** unit events. Do **not** reintroduce refund-line units into the unit ledger.

`UNKNOWN` agreement reason: persist sales; **not** unit events until a later named policy; set `unitDiagnosticState` accordingly.

Cancellation is **not** a second unit event if lines/agreements already reflect remaining units. `cancelledAt` is status.

#### 7.2.1 Sale-type eligibility (frozen)

| `SaleLineType` / concrete type | Variant-unit history eligible? |
|---|---|
| `PRODUCT` / `ProductSale` | **Yes** — the only source of variant-attributable unit deltas |
| `GIFT_CARD` / `GiftCardSale` | Line-attributable; **excluded** from variant demand (PO-08) |
| `TIP` / `TipSale` | Line-attributable; **never** variant demand |
| `SHIPPING`, `DUTY`, `FEE`, `ADDITIONAL_FEE`, `ADJUSTMENT`, `UNKNOWN` / `UnknownSale` | **No line link** (except persist). Money-reconciliation only. Persist with null `lineItemGid`; **never** a unit event |

**`UnknownSale` must be persisted, never dropped.**

#### 7.2.2 Dated events under `net-units-order-date-v1` (frozen)

Facts retain original timestamps. **Metric dating:**

| Event | Units | Metric calendar day (shop IANA timezone) |
|---|---|---|
| Original `reason=ORDER` ProductSale | **positive** `Sale.quantity` | original order `processedAt` |
| Edit removal `reason=ORDER_EDIT` **negative** ProductSale | restates **original order** net demand | original order `processedAt` (not happenedAt) |
| True edit **addition** `reason=ORDER_EDIT` **positive** ProductSale | **positive** `Sale.quantity`; **never** a removal | agreement `happenedAt` |
| Refund/return `reason ∈ {REFUND, RETURN}` ProductSale | **negative** reversal `Sale.quantity`; restates **original order** net demand | original order `processedAt` (not refund day) |
| Refund line | **not a unit event** | n/a |
| `Sale.quantity IS NULL` | persist; **never** a unit event | n/a |
| Unexpected sign (e.g. REFUND/RETURN **positive**) | persist raw Shopify value; `UNIT_SALE_SIGN_INCONSISTENT`; derived magnitudes **not trustworthy** | n/a |

T47: 3 ordered − 1 refunded ⇒ the reversal sale stores **−1** **and** derived `refunded_units = 1`, **not** 2, with **both** agreement and refund facts present. T55 pins Shopify’s documented RETURN example (`quantity: -2`).

### 7.3 Metric policy — frozen

Approved product docs define Last-X as `daily_velocity = net_units_sold / sample_calendar_days`.

**Frozen policy:** `net-units-order-date-v1` (PO-03) using shop IANA calendar days (PO-04) excluding test orders (PO-05).

PR 6 **implementation** still must **not** label a merchant-visible Stocky-parity velocity until Phase 2 consumers exist. Facts land with this dating contract so Phase 2 cannot invent a second formula.

### 7.4 Money metric names (facts, not yet forecast)

Persist Shopify bags. Do not rename them into “net sales” in code until proposed **Q-013** (former Q-PR6-04) closes:

| Name | Proposed Shopify binding (provisional) | Status |
|---|---|---|
| Gross merchandise amount | Sum of line `originalTotalSet.shopMoney` | Provisional |
| Line discounts | Sum of line `totalDiscountSet.shopMoney` | Provisional |
| Refund value | Frozen identity §6.6; money metrics wait on transaction SUCCESS (PO-06) | Identity frozen; “revenue” bag **Q-013** |
| Net sales | Not defined by approved product docs | **Q-013** |
| ABC revenue | PRD says last eight weeks revenue | **Q-013 / Q-012** |

Refund **money** affects net-sales/revenue **only after** the relevant refund transaction is `SUCCESS`. Units follow §7.2 regardless of settlement.

`order_transactions/create` fires only for `success` / `failure` / `error`. **PENDING** transactions are observed through **refund snapshots**; do **not** expect a PENDING webhook. T36 asserts that a PENDING transaction present on a refund snapshot is stored, money metrics exclude it until SUCCESS, and units follow the ledger.

Order-level `currentTotalPriceSet` includes taxes and discounts after returns (official Order docs). That is **not** automatically “net sales.”

### 7.5 Scenario rules (apply behavior)

| Scenario | Apply rule |
|---|---|
| Partial refund | Upsert refund snapshot (Clock A) + children; order snapshot separately; **one** ledger; T47 |
| Full refund | Same; `currentQuantity` likely 0 |
| Multiple refunds | Separate refund GIDs; ordinal identity on lines; duplicate refund GID is idempotent |
| Null `RefundLineItem.id` | Ingest via ordinal identity; idempotent; T46 |
| Order edits | `edited=true`; agreements/sales upserted from **order** snapshot; line quantities replaced from refetch, not patched from webhook deltas |
| Line removal | Line row remains; `currentQuantity=0` |
| Quantity increase/decrease | New snapshot + agreement sales; additions dated `happenedAt`; removals restate original `processedAt` |
| **Exchange** | Persist Shopify snapshots; do **not** emit spurious `LINE_UNIT_IDENTITY_INCONSISTENT` when the valid-sign identity holds on a consistent pair (T54). T54 **must also** detect a contradictory identity when one is injected. |
| **`SaleLineType.ADJUSTMENT` / `AdjustmentSale`** | Persist; **not** a unit event; money reconciliation only |
| Cancel after payment | `cancelledAt` + `cancelReason`; refunds may exist; do not apply webhook line_items as deltas |
| Refund after cancellation | Persist both; identity on consistent snapshot |
| Duplicate webhook | Receipt on delivery; refetch; upsert |
| Out-of-order webhook | Signal only; refetch current; Clock A per resource |
| Deleted variant | Keep `variantGidAtSale`; `currentVariantGid=null` |
| Recreated variant same SKU | New GID; historical lines stay on old GID |
| Missing current product/variant | Allowed |
| Test orders | Persist `test`; exclude from operational metrics |
| Zero-value lines | Persist |
| Mixed currencies | Persist per order; do not sum across currencies |
| Presentment ≠ shop | Persist both; metrics use shopMoney only |
| Out-of-window refund/edit signal | Record signal; `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`; retain parent; no tombstone |
| BOM | Never explode |

### 7.6 Location-attributed units

GraphQL LineItem **does not** expose a stable sale-location equivalent to REST `location_id` on every line. `retailLocation`, fulfillment orders, and refund restock location are **different** clocks/meanings.

Legacy code used `locationId = "default"` — **forbidden** as canonical.

Monday variant-level (shop-wide) net units do not require location (PO-09). Location-grain demand is **Q-014**. Do not invent `default`.

---

## 8. Identity / deletion / rolling-history existence

1. Canonical identities are Shopify GIDs: Order (`ID!`), LineItem (`ID!`), Refund (`ID!`), OrderAdjustment (`ID!`), SalesAgreement (`ID!`), Sale (`ID!`). RefundLineItem uses the **ordinal composite**, not nullable id.
2. SKU, barcode, title, handle, order `name`, and `number` are attributes.
3. Recreated variants are new GIDs. Never merge history by SKU.
4. **`order(id:) == null` is NOT confirmed absence** by itself.
5. **`existenceKind = INACCESSIBLE_HISTORY_WINDOW`:** completed `order(id:)` null **or** otherwise unqueryable **and** the order is **not** provably inside `orderHistoryWindowDays` at observation time. Preserve the last unambiguous `existenceState`. Do **not** set terminal tombstone. Do **not** set `deletedAt` from this path.
6. **Confirmed absence (`ABSENT_CONFIRMED_QUERY`)** requires **all** of:
   - completed query returned null, **and**
   - order provably inside the accessible window at observation time: `storedProcessedAt` (fallback `shopifyCreatedAt`) `>= observedAt − orderHistoryWindowDays` using the named constant **60**, **and**
   - the effective token scope set at observation time is recorded on the observation and has **not lost** `read_orders` / `read_all_orders` relative to the last LIVE confirmation.
   When `read_all_orders` **is** granted, the window predicate is **unconditional** and PR 5 semantics apply.
7. Out-of-window orders are **retained permanently**, `attributeFreshnessState` frozen. They are **excluded** from reconcile **sampling** and from **all absence nomination**.
8. Bulk omission may **never** nominate an out-of-window order. Nomination is restricted to orders whose `processedAt` is inside the window of the bulk run’s own fence **and** only after a complete run. `ABSENT_FULL_SYNC_SWEEP` is not single-epoch authority (PR 5).
9. Transport errors are not absence. Observation abandoned.
10. Terminal revival (two independent non-overlapping LIVE confirmations) applies only to **true** `ABSENT_CONFIRMED_QUERY` tombstones. `INACCESSIBLE_HISTORY_WINDOW` is **not** a terminal tombstone and must remain reversible by a later LIVE refetch (including after `read_all_orders` grant). Do not un-tombstone from webhook time vs `deletedAt`.
11. Line/refund children: if parent order is ABSENT, children stay as historical rows. Do not cascade-delete. Do not physically DELETE canonical facts on ordinary apply (R-164 analog).
12. **`orders/delete` exists** (`ORDERS_DELETE`, `read_orders`). It is the deletion **signal**.
    - **In-window:** signal → authoritative `order(id:)` re-check. Null ⇒ `ABSENT_CONFIRMED_QUERY` (PR 5). Live ⇒ stale-signal diagnostic, no tombstone (PR 5 Race H).
    - **Out-of-window:** re-check cannot confirm. `existenceKind = ABSENT_SIGNALLED_DELETE_UNVERIFIED`, `deletionSource = DELETE_WEBHOOK`, `existenceState = ABSENT`, **rows retained**. Explicit narrow derogation from “signal is never authority.”
    - Payload shape is **unverified**. Identity sanitizer **fail-closed** on unrecognised shapes. **Do not assume** `admin_graphql_api_id`.
13. `variantGidAtSale` never updates to a later SKU-matched GID.
14. Cross-shop identical numeric REST ids are distinct because uniqueness is `(shopId, gid)`.
15. No customer GID storage. Uninstall/redact later (PR 7) must delete these operational facts with the tenant.
16. Scope downgrade (`read_all_orders` lost, or `read_orders` lost) **voids** prior absence authority (T50).

DataIssue / diagnostic codes (merchant column and/or reconciler-derived `DataIssue`, `VarChar(64)`):

- `ORDER_HISTORY_WINDOW_TRUNCATED` — import depth honesty
- `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` — existence, not import depth
- `REFUND_OUTSIDE_ACCESSIBLE_WINDOW`
- `MONEY_CURRENCY_MISMATCH`
- `REFUND_MONEY_UNBALANCED`
- `LINE_UNIT_IDENTITY_INCONSISTENT` — valid-sign identity failed on a consistent snapshot
- `UNIT_SALE_SIGN_INCONSISTENT` — unexpected `Sale.quantity` sign vs §7.1; raw Shopify value preserved; derived magnitudes not trustworthy
- `SNAPSHOT_PAGINATION_INCOMPLETE` — durable on `OrderFactObservationInFlight`; no partial canonical apply; reconciler derives `DataIssue`

---

## 9. Webhook / refetch contract

### 9.1 Current routes and PR6-D Monday signals

| Topic | Route | Today | PR 6 target |
|---|---|---|---|
| `orders/create` | `app/routes/webhooks.orders.create.tsx` | HMAC → `ingestAuthenticatedWebhook` | Keep signal; **keep v1 sanitizer** (PO-02) |
| `orders/cancelled` | `app/routes/webhooks.orders.cancelled.tsx` | same | same — **keep v1 sanitizer** |
| `refunds/create` | `app/routes/webhooks.refunds.create.tsx` | same | same — **keep v1 sanitizer**; refetch refund **and** parent if accessible |
| `orders/edited` | **not subscribed** | — | Monday-critical **signal**; **identity-only** sanitizer (new topic) |
| `orders/delete` | **not subscribed** | — | Monday-critical **signal**; **identity-only**; fail-closed unknown shape |
| `order_transactions/create` | **not subscribed** | — | Monday-critical for SUCCESS money (PO-06); identity-only; refetch refund (+ order if accessible). Topic fires **only** for `success` / `failure` / `error`. **PENDING is not webhooked**; observe PENDING via refund snapshots (T36). |
| `orders/updated` | **not subscribed** | — | Post-Monday latency; noisy |

Intake already matches PR 4: authenticate, sanitize, `WebhookDelivery`, `DurableJob`, envelope v3, dispatcher kick.

Monday signal set: `orders/create`, `orders/cancelled`, `orders/edited`, `refunds/create`, `orders/delete`, **`order_transactions/create`**.

### 9.2 Sanitizer contract (PO-02 / F-CLAUDE-PR6P-13 / 14)

**Choice (a) — frozen:** PR6-D does **not** tighten the three existing order/refund projections. Legacy `handleOrderCreate` / `handleOrderCancelled` / `handleRefundCreate` continue to receive v1 payloads with line arrays. There must be **no** silent period of empty `line_items`.

New topics get identity-only projections:

- `orders/edited`: `order_id`, edit `id`, `committed_at` / `updated_at` if present
- `orders/delete`: whatever identity fields are empirically present; fail closed otherwise
- `order_transactions/create`: transaction `id`, `order_id`, `status` if present without PII

Bump **new** projection schema versions for **new** topics only. Existing topics remain `webhook-projection-orders-create-v1` (and current cancelled/refund versions as already persisted).

**`payloadSchemaVersion` dispatch:** the worker dispatches on the **persisted** `payloadSchemaVersion` of that delivery. A v1-projected delivery executed after a v2 deploy of **other** topics must neither crash nor silently no-op (T51). If a future **authorized cutover PR** introduces v2 for the three legacy topics, that PR must keep a v1 reader until cutover is complete.

Unknown topics still fail closed. Do not persist customer, addresses, or transaction receipt PII.

### 9.3 Authoritative apply path

```text
HMAC → WebhookDelivery + DurableJob (ATOMIC_APPLICATION_RECEIPT)
  → allocate observationRequestGen
  → Admin QUERY order(id) and/or refund(id) with complete pagination
     (skip tombstone on out-of-window null; see §8)
  → allocate observationResponseGen
  → tenant txn: advisory locks in ascending (key1,key2) → apply snapshot + children → receipt
```

Never apply REST line_items onto `SalesDailyAggregate` on the **canonical** path.

Legacy handlers remain **out of PR 6 SoR** until a **separate authorized cutover** after canonical facts **and** the replacement consumer have reconciled. Dual-write of canonical facts does **not** require changing v1 projections. “Dual-write is not required” in the original packet is **replaced**: canonical apply is additive; legacy v1 path **stays** until that later PR.

### 9.4 Job types (additive)

| jobType | strategy | source |
|---|---|---|
| `webhook:orders/create` | `ATOMIC_APPLICATION_RECEIPT` | existing; handler **adds** refetch+apply when PR6-D is authorized **without** removing legacy v1 consumption |
| `webhook:orders/cancelled` | same | same |
| `webhook:refunds/create` | same | same |
| `webhook:orders/edited` | `ATOMIC_APPLICATION_RECEIPT` | new |
| `webhook:orders/delete` | `ATOMIC_APPLICATION_RECEIPT` | new |
| `webhook:order_transactions/create` | `ATOMIC_APPLICATION_RECEIPT` | new |
| `order-facts-sync` | `REBUILDABLE_IDEMPOTENT` | historical/incremental bulk |
| `order-facts-reconcile` | `REBUILDABLE_IDEMPOTENT` | periodic exhaustive sweep + sampled drift |

Unknown job types remain `NO_AUTOMATIC_RETRY`.

Envelope stays `tenant-job-envelope-v3`. Application key remains `(shopId, applicationKey)` via `SyncApplicationReceipt`. Duplicate deliveries do not double-apply merchant effects.

### 9.5 Out-of-order / stale refetch

Reuse PR 5 clocks **plus** §5.1:

- Attributes: compare Shopify `updatedAt` only to stored `shopifyUpdatedAt` of the same resource.
- Reject only `<`; equal re-applies.
- Stale parent ⇒ discard **all** children from that response (T44).
- Existence: observation interval overlap rules; no last-writer-wins.
- Clock C never decides freshness.
- Refund Clock A is independent of Order Clock A (both interleavings tested).
- Transaction status change with **no** parent `updatedAt` bump: `order_transactions/create` → refund refetch → refund Clock A / transaction child apply (T18 races).

---

## 10. Initial import strategy

1. Kill switch: `Shop.processingEnabled` must be true.
2. Create `SyncRun` domain `orders` / `orders_full`.
3. Allocate `fenceGeneration` before `bulkOperationRunQuery` (PR 5 fence rule).
4. Submit **Bulk A**. Submit **Bulk B only if** the PR6-B gate recorded it legal. **Never submit Bulk C.** Persist BulkOperation GID. Poll by id. Forbidden: `currentBulkOperation`.
5. After Bulk A, paginated agreement/sales (and refund fallback) for `edited=true` OR refund-bearing orders, with recorded request-count bound.
6. Stream JSONL with bounded memory. Two-phase commit with `ingestBatchId`.
7. Apply under Order (+ Refund) advisory locks, batches of orders (not unbounded).
8. Incomplete JSONL / throttling / 5xx → run not successful; resume from last committed ordinal.
9. After bulk COMPLETED: nominate absence candidates **only** for in-window orders previously LIVE but omitted from a **complete** run whose `processedAt` is inside the bulk fence window. **Never** nominate out-of-window orders. Do **not** tombstone from omission when `read_all_orders` is absent.
10. Overlap with live webhooks is required (Phase 1 test). Locks + clocks make this safe.
11. Record examined/applied/conflict/truncated-window counts.

Historical depth:

- Monday accessible default: ~60 days live Shopify; retained facts persist beyond that.
- Same-period-last-year from Shopify: blocked on Partner grant (Q-016); not a correctness hole for retained facts.
- Do not silently backfill from webhook archives.

---

## 11. Reconciliation

Periodic `order-facts-reconcile` per shop:

1. **Completeness:** exhaustive `orders(query: "updated_at:>='{watermark - overlap}'")` via bulk A + costed agreement/refund follow-up, or paginated direct with complete pages. Apply the same applicator as webhooks.
2. **Drift detection only:** for a **sampled** set of **in-window LIVE** facts, refetch `order(id:)` and diff quantity/money bags; mismatches → merchant diagnostic + reconciler `DataIssue` + repair apply.
3. **Exclude** out-of-window facts from sampling and from absence nomination.
4. Missed webhooks **inside the window** are healed by the **sweep**, not by the sample.
5. Missed refunds/edits **outside the window** are **not** healed; leave `REFUND_OUTSIDE_ACCESSIBLE_WINDOW` / signal records.
6. Cadence: per-shop bounded job, not a global convoy (D-051 lesson). Exact interval is operational (suggest 15–60 minutes).
7. Reconciliation success requires recorded watermarks and issue rows for unrepaired diffs. Do not report HEALTHY over `DEGRADED` merchant diagnostics.

Repair is always “refetch and apply,” never “replay sanitized webhook body.”

---

## 12. Tenancy / RLS

New tables inherit PR 3:

- non-null `shopId`;
- `@@unique([shopId, id])` and tenant-leading identity unique;
- child FKs include `shopId`;
- FORCE RLS; missing tenant GUC default-deny;
- INSERT shopId must equal tenant; UPDATE cannot change shopId;
- runtime role no `BYPASSRLS`;
- no client JSON shop authority;
- workers resolve Shop from durable envelope before merchant DML.

Tests (PR6-A / PR6-C):

- Shop A cannot read Shop B order with identical Shopify order id;
- insert with foreign shopId denied;
- raw SQL reassignment denied.

`OrderFactObservationInFlight` is merchant_domain (has `shopId`), same as catalog in-flight. Do **not** reuse `CatalogObservationInFlight`.

Control-plane tables stay non-DML for runtime (`WebhookDelivery`, `DurableJob`, `SyncRun`, `SyncCursor`, **`DataIssue`**).

---

## 13. Idempotency / concurrency

| Mechanism | Use |
|---|---|
| `SyncApplicationReceipt` | Exactly-once merchant effect per webhook delivery application key |
| GID / ordinal upsert | Idempotent snapshot replace |
| Advisory lock `stocky-pr6-canonical-lock-v1` | Serialize per **§5.1** (do not invent a second rule): refund job = **Order + Refund**; order-only job = **Order only** unless the same apply includes refund snapshots (then include each Refund GID); **dedupe then ascending `(key1,key2)`**; **no Shopify I/O under advisory lock**. There is **no** “Order+Refund always both” rule. |
| Observation intervals | Concurrent refetch safety |
| `ON CONFLICT` | Must re-evaluate clocks, not blind overwrite (R-160) |
| First insert | Universal exclusive lock **before** the row exists |

Required races (in addition to PR 5 analogs):

- stale-parent-with-fresh-children → reject wholesale (T44);
- equal-`updatedAt` child repair (T45);
- refund/order interleaving both directions;
- transaction status change with no parent bump;
- aged-out null must not tombstone (T41);
- scope downgrade voids absence (T50).

Do not hold advisory locks across Shopify I/O.

**Lock rule (echo of §5.1 — these two sections must agree):**

- Refund job = Order **and** Refund.
- Order-only job = Order **only**, unless the same apply includes refund snapshots (then include each Refund GID).
- Dedupe, then acquire in ascending `(key1, key2)`.
- No Shopify I/O under advisory lock.
- No contradictory “Order+Refund always both” summary.

Lock timeout: reuse PR5 `5000ms` transaction-local `lock_timeout`; fail closed and retry.

Capacity: identities per transaction = Order + nested Refund GIDs, well under 32. Honour R-161 evaluator.

---

## 14. Performance / batching / indexes

Engineering envelope from Phase 1 brief: **1,000,000 order-line facts**, 50k variants, 15 locations, multi-shop.

Requirements:

- no N+1 Admin queries per **line** (Bulk A + paged connections);
- agreement/refund follow-up is **per qualifying order**, bounded and counted (PR6-B);
- bounded-memory JSONL;
- **realisable** indexes:
  - `ShopifyOrderFact`: `(shopId, processedAt)`, `(shopId, shopifyGid)`
  - `ShopifyOrderLineFact`: `(shopId, shopifyGid)`, `(shopId, shopifyOrderGid)`, **`(shopId, variantGidAtSale, orderProcessedAt)`**
  - every child: `(shopId, shopifyOrderGid)`
  - refund lines + agreement sales: `(shopId, shopifyLineItemGid)`
  - agreement sales: `(shopId, happenedAt)` (denormalized)
- webhook enqueue p95 target already in Phase 1 (<1s durable enqueue);
- do not load all order ids into JS arrays (PR 1 F-N07 lesson);
- bulk `groupObjects` false;
- query-count assertions in tests.

Monday may query lines with `GROUP BY variantGidAtSale` over `orderProcessedAt` **or** query the agreement-sale ledger over `happenedAt` / denormalized order date per `net-units-order-date-v1`. If p95 exceeds 500ms on the envelope, a **rebuildable** daily projection is post-Monday, not a second authority.

---

## 15. Failure / recovery

| Failure | Merchant-durable writer | Reconciler `DataIssue` | Behavior |
|---|---|---|---|
| GraphQL throttle / 5xx / timeout | observation abandoned | none for absence | Retry bounded; not ABSENT |
| Incomplete pages / exhausted nested walk | `OrderFactObservationInFlight` outcome **`SNAPSHOT_PAGINATION_INCOMPLETE`** | `SNAPSHOT_PAGINATION_INCOMPLETE` derived by `order-facts-reconcile` | **No** successful parent/child canonical apply. **No** partial refund snapshot. **No** child absence. Visible terminal non-success after bounded retries / request budget. Continuation success clears/completes the observation normally (T56/T57). Replaces silent/`none`. |
| Bulk partial | resume state | run not COMPLETE | Resume; not success |
| Decimal parse fail / required bag invalid | no apply | optional after retry exhaustion | Fail-apply snapshot; no Number fallback |
| GID mismatch | no apply | — | Fail closed |
| Currency mismatch on required bag | no apply (`moneyDiagnosticState` only if a prior row exists and this observation is rejected) | `MONEY_CURRENCY_MISMATCH` | **Fail-apply entire snapshot** — not skip bag |
| Refund money identity mismatch | persist Shopify fields + `moneyDiagnosticState=REFUND_MONEY_UNBALANCED` | `REFUND_MONEY_UNBALANCED` | T49 |
| Unit identity failed on a **consistent valid-sign** snapshot | persist Shopify fields + `unitDiagnosticState=LINE_UNIT_IDENTITY_INCONSISTENT` | `LINE_UNIT_IDENTITY_INCONSISTENT` | No coerce. Identity `ordered − current − refunded = removed` is evaluated **only** on valid-sign snapshots. |
| Unexpected `Sale.quantity` sign | persist raw Shopify sale value + `unitDiagnosticState=UNIT_SALE_SIGN_INCONSISTENT` | `UNIT_SALE_SIGN_INCONSISTENT` | Never `abs()` / never coerce. Derived magnitudes for that snapshot are **not trustworthy**. |
| Out-of-window null refetch | `existenceKind=INACCESSIBLE_HISTORY_WINDOW`; state preserved | `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` as needed | **No tombstone** |
| Out-of-window refund/edit signal | `historyWindowState=REFUND_OUTSIDE_ACCESSIBLE_WINDOW` | same code | Retain parent |
| Import truncated vs requested lookback | `historyWindowState=ORDER_HISTORY_WINDOW_TRUNCATED` | same | Honesty; not absence |
| DB rollback after Shopify read | Observation not COMPLETED | — | Retry refetch; do not reuse old response as fresh |
| Duplicate delivery | Receipt short-circuit | — | — |
| Uninstall / `processingEnabled=false` | Fail closed before merchant DML | — | — |
| Illegal Bulk C submitted | — | — | Schema gate reject (T53) |

Kill switch: existing shop processing flag. No new inventory-write flag.

---

## 16. Monday-critical subset

Do not weaken correctness to hit a calendar date.

### 16.1 MONDAY-CRITICAL (facts only)

1. Order + line facts with clocks, money bags, `test`, `processedAt`, `cancelledAt`, **denormalized line date/test/currency**.
2. Refund + refund-line facts with **null-safe identity**.
3. **One** unit-event ledger (agreement sales, Option A) via schema-valid fragments; sourced by per-order refetch (no Bulk C).
4. Historical identity snapshots, no catalog FK. No BOM explosion.
5. Authoritative refetch apply with snapshot atomicity and refund Clock A.
6. **Sound** existence contract (window + `orders/delete`).
7. Exact decimal; tenancy/RLS; idempotent apply; fail-apply money.
8. `ORDER_HISTORY_WINDOW_TRUNCATED` / `ORDER_EXISTENCE_UNVERIFIABLE_WINDOW` honesty.
9. `Shop.ianaTimezone` / `Shop.currencyCode`.
10. `order_transactions/create` for SUCCESS money.

Low-stock **inventory** remains PR 5 `ShopifyInventoryLevelFact.available`. PR 6 does not compute reorder points.

### 16.2 POST-MONDAY PARITY

- `orders/updated` subscription;
- shipping-line child table;
- refund duties as first-class facts (refund shipping lines are Monday for money identity);
- rebuildable daily projection;
- `read_all_orders` after Partner grant (Q-016) for live lookback >60d / last year;
- legacy `SalesDailyAggregate` **cutover PR** (after facts + replacement consumer);
- location-grain sales (Q-014).

### 16.3 LATER COMMERCIAL ENHANCEMENT

- presentment reporting;
- gift-card / tip inclusion **into** variant demand (currently excluded);
- returns workflow objects beyond refunds/agreements already stored;
- customer-level analytics (still no unnecessary PII);
- Smart Forecast inputs.

### 16.4 Explicit non-weakening

Do not ship a labeled Stocky-parity velocity from PR 6 itself (Phase 2 consumer). Do not invent a second net-units policy. Do not tombstone history to “simplify” existence.

---

## 17. Implementation lane decomposition

Runtime lanes start **only after** (a) this **corrected** plan is ChatGPT-accepted and (b) PR 5 implementation is independently reviewed, accepted, merged, and closure-synchronized.

Shared contracts freeze in **PR6-A** before B and C (Accelerated Safe Delivery: schema/interfaces freeze before dependent runtime lanes).

### 17.1 Revised graph (F-CLAUDE-PR6P-16)

```text
PR5 closed
  └─ PR6-A foundation (schema + locks + types.ts + Shop.ianaTimezone/currencyCode
       + denormalized line columns + roles.ts + DIRECT/CHILD)
       ├─ PR6-B admin-read (documents, bulk gate, app/types/**)  ─┐
       └─ PR6-C applicator (no Shopify I/O; consumes A types)    ─┴─→ PR6-D webhooks/import
            (keep v1 sanitizers for 3 existing topics;
             identity-only for new topics;
             orders/edited, orders/delete, order_transactions/create)
```

PR6-C is pure apply and needs the **frozen types** from A, not B’s reader implementation. Serialising C behind B’s merge is unnecessary.

Two concurrent Cursor lanes after A: **B ∥ C**, then D. Do not open four writers at once. Do not start A before PR 5 closes.

### 17.2 Lanes

#### PR6-A — schema / exact-decimal fact foundation + frozen types

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-a-order-refund-fact-foundation` |
| Objective | Additive Prisma models, migration, RLS/enforcement registration **including roles.ts**, lock-key module `stocky-pr6-canonical-lock-v1`, observation-in-flight table, known-answer lock vectors, `Shop.ianaTimezone` / `Shop.currencyCode`, denormalized line columns, **types-only** `app/lib/order-facts/types.ts` (no Prisma import, no GraphQL import) |
| File ownership | `prisma/schema.prisma` (order-domain models + Shop columns/relations only), `prisma/migrations/<pr6_order_facts>/`, `app/lib/order-facts/constants.ts`, `app/lib/order-facts/lock-key.ts`, `app/lib/order-facts/advisory-lock.ts`, `app/lib/order-facts/types.ts`, `scripts/tenant-enforcement/manifest.ts` (additive), `scripts/tenant-enforcement/roles.ts` (additive grants), `app/tenant/models.ts` (additive DIRECT/CHILD), enforcement tests `scripts/tenant-enforcement/tests/pr6-*.test.ts` |
| Must not touch | GraphQL documents, webhooks, workers, catalog-facts/admin-read, catalog apply, F2C, forecast/ABC, `app/types/**` |
| Dependencies | PR 5 closed; this corrected plan accepted |
| Tier | **A** |
| Tests | RLS isolation, shopId immutability, lock known-answers, migration empty+current schema, cross-shop identical GIDs, denormalized column invariant fixtures, DIRECT vs CHILD registration |
| Claude | **Required** (Tier A) |
| Merge order | **1** |

#### PR6-B — Admin read / extraction

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-b-order-admin-read` |
| Objective | QUERY-only order/refund/agreement readers, decimal/datetime guards, pagination, **legal** bulk inner documents + schema gate, **Bulk B legality record + costed fallback**, identity cross-checks, mutation AST deny |
| File ownership | `app/lib/order-facts/admin-read/**`, **`app/types/**` (codegen output)** |
| Must not touch | Prisma, migrations, apply, webhooks, catalog-facts files, `types.ts` contract (owned by A; B consumes) |
| Dependencies | **PR6-A merged** (frozen types + this plan’s query shapes) |
| Tier | **A** (identity + money parse) |
| Tests | mutation reject; GID mismatch fail-closed; decimal string; DateTime no Date.parse rewrite; pagination completeness; bulk nesting/schema; **T20 named non-connection LIST `first`**; T52 invalid Sale selection; T53 Bulk C rejected; MoneyBag mapping; Bulk B gate result recorded; T56/T57 continuation |
| Claude | **Required** |
| Merge order | **2 (parallel with C)** |

#### PR6-C — applicator / reconciliation core

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-c-order-fact-applicator` |
| Objective | Pure apply: clocks, upserts, window existence, snapshot atomicity, unit-ledger Option A, money fail-apply, merchant diagnostics, no Shopify I/O, no SalesDailyAggregate writes, no `DataIssue` DML |
| File ownership | `app/lib/order-facts/apply/**`; applicator DB tests |
| Must not touch | admin-read documents, prisma schema, webhook routes, forecast, `app/types/**` |
| Dependencies | **PR6-A merged** (tables + types). **Not** blocked on PR6-B merge |
| Tier | **A** |
| Tests | §19 apply/clock/money/unit cases including T41–T50, T54–T57 |
| Claude | **Required** |
| Merge order | **2 (parallel with B)** |

#### PR6-D — webhook integration / historical import

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-d-order-webhook-import` |
| Objective | **Keep v1 sanitizers** for three existing topics; identity-only for **new** topics; `orders/edited` + `orders/delete` + `order_transactions/create` subscription+routes; job types; workers calling B then C; `payloadSchemaVersion` dispatch; bulk import + exhaustive reconcile; SyncCursor domains |
| File ownership | `app/routes/webhooks.orders.edited.tsx`, `app/routes/webhooks.orders.delete.tsx`, `app/routes/webhooks.order_transactions.create.tsx` (names may match repo convention), `shopify.app.toml` webhook list (**additive topics only; do not add `read_all_orders`**), `app/sync/sanitize.server.ts` (new topics + dispatch; **do not strip v1 line arrays**), `app/tenant/job-envelope.server.ts`, `app/sync/execution-strategy.server.ts`, `app/jobs/workers/webhook-processor.ts` (canonical path **additive**), `app/lib/order-facts/sync/**`, `scripts/sync-control-plane/manifest.ts` |
| Must not touch | apply internals, admin-read documents, prisma schema (unless toml-only) |
| Dependencies | **PR6-B and PR6-C merged** |
| Tier | **A** |
| Tests | duplicate/out-of-order webhooks, overlap import+webhook, bulk partial, rollback retry, sweep repairs missed webhook **in-window**, T51 v1 after v2, orders/delete in/out window (T43) |
| Claude | **Required** |
| Merge order | **3** |

### 17.3 File-ownership conflict watch

`webhook-processor.ts`, `sanitize.server.ts`, `job-envelope.server.ts`, `schema.prisma` are single-writer files. Only the listed lane may edit them. **Do not use PR #30 as a base.** PR **#31** is **merged** on `origin/main` as `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`; `app/lib/catalog-facts/apply/**` on main is the merged reference applicator pattern for PR6-C. This planning branch is **not** rebased onto current main in this pass.

---

## 18. Acceptance criteria

### 18.1 Planning correction acceptance (this PR)

- [x] All 24 findings have explicit dispositions (this packet; ChatGPT still decides technical acceptance)
- [x] All 70 correction-list items incorporated
- [x] Product-owner decisions PO-01 … PO-09 frozen
- [x] NEW-CLAUDE-PR6PC-01 … 06 incorporated in contract text (this pass; independent final correction re-review pending)
- [ ] Immutable original review blob remains `d72340c01dd9c662d0e8bb4aa8d43482940470d9`
- [ ] Immutable correction re-review blob remains `fca2b260d03e3105782ed216f7773c53e6aef2a7`
- [ ] Diff is docs-only under `stocky-plus/docs/**` (and `AGENTS.md` if it were touched — it is not)
- [ ] No runtime/schema/migration/GraphQL/webhook/config changes
- [ ] Draft PR open; not marked ready; not merged
- [ ] Exact-head docs CI: `docs_only=true`, Heavy SKIPPED, Classify SUCCESS, CI Gate SUCCESS

Independent **correction** approval is **not** claimed.

### 18.2 Later runtime acceptance (not this PR)

- [ ] Facts reconcile to Shopify-reported GIDs, quantities, and MoneyBag strings
- [ ] No Number/parseFloat/division unit prices on the new path
- [ ] No unnecessary PII
- [ ] Duplicate/out-of-order/missed webhooks cannot corrupt facts
- [ ] Aged-out orders are not tombstoned
- [ ] Deleted/recreated variants do not merge
- [ ] Cross-shop identical Shopify ids isolated
- [ ] RLS forced on new tables
- [ ] Inventory-write flags remain DEFAULT OFF
- [ ] Exact-head CI on the implementation head
- [ ] Independent Claude review with no open P0/P1
- [ ] ChatGPT acceptance + user merge authorization

---

## 19. Exact test matrix

Do **not** commit expected-failing runtime tests in this planning PR.

Positive / negative / bypass / drift required for each important rule.

| ID | Class | Case | Expected |
|---|---|---|---|
| T01 | + | New order refetch upserts order+lines | LIVE facts; exact decimal strings |
| T02 | − | Mutation document in admin-read | AST reject; no network |
| T03 | bypass | Client shop header sets tenant | Denied |
| T04 | + | Duplicate webhook same delivery | One receipt; one snapshot |
| T05 | + | Duplicate refund GID twice | Idempotent; refunded_units not doubled |
| T06 | + | Partial refund then second refund | Ledger refunded_units = 1+1 correctly, not agreement+line double |
| T07 | + | Edit quantity then refund | Agreements + refunds; Option A ledger |
| T08 | + | Cancel then refund | Both persisted; no double-subtract coercion |
| T09 | − | Stale order refetch older `updatedAt` | No attribute overwrite; **no child writes** |
| T10 | + | Newer refetch after stale | Applies |
| T11 | + | Deleted variant `variant=null` | `variantGidAtSale` retained |
| T12 | + | Recreated variant same SKU new GID | Historical line stays on old GID |
| T13 | + | Out-of-order cancelled before create | Refetch wins; no create-required state machine |
| T14 | + | Cross-shop same REST order id | Two rows; RLS isolation |
| T15 | + | Amount `1.234567` | Persisted; not rounded to `1.23` |
| T16 | + | Zero-price line qty 2 | Row kept |
| T17 | + | Test order | `test=true` stored; excluded from operational metrics |
| T18 | + | Gift card / tip / custom line | Stored; excluded from variant demand |
| T19 | + | Large order 300 lines | Complete pagination; no silent 250 cap |
| T20 | − | `first` on named **non-connection LIST** fields only: `Order.refunds`, `Order.transactions`, `LineItem.taxLines`, `LineItem.discountAllocations`, `LineItem.duties`, `Refund.duties` | Forbidden in production reader. **Must not** flag pagination on connections including **`Refund.transactions`**. |
| T21 | + | Bulk JSONL two-phase | Resume after injected failure |
| T22 | − | Bulk incomplete marked success | Fail |
| T23 | + | Retry after DB rollback | Fresh refetch; no stale observation COMPLETE |
| T24 | + | Reconcile **sweep** inserts missed **in-window** order | Healed by sweep, not sample |
| T25 | + | Overlapping observation LIVE vs ABSENT | Conflict diagnostic; no last-writer-wins |
| T26 | bypass | `parseFloat` on apply path | Static/unit fail |
| T27 | + | Presentment EUR / shop USD | Both stored; no FX conversion |
| T28 | − | Sum mixed shop currencies in helper | Reject |
| T29 | + | Injected contradictory unit identity on a **consistent valid-sign** snapshot | **Must detect**: `LINE_UNIT_IDENTITY_INCONSISTENT`. Must not pass on a broken system. |
| T30 | + | Money via Number in fixture input | Reader reject |
| T31 | drift | Fence vs later direct refetch | Direct wins per PR 5 fence rule |
| T32 | + | Identity sanitizer drops email/address | Not in projection |
| T33 | − | Webhook body applied as quantity delta | Forbidden on canonical path |
| T34 | + | 60-day truncation of **import** | `ORDER_HISTORY_WINDOW_TRUNCATED` |
| T35 | + | Advisory lock before first insert | No duplicate first-apply race |
| T36 | + | Refund transaction **PENDING** present only on a refund snapshot (no `order_transactions/create` webhook) | Facts stored from the snapshot; **money** metrics exclude until SUCCESS; **units** follow ledger. Do **not** require a PENDING webhook. |
| T37 | + | `orders/edited` signal refetches order | Snapshot matches Admin |
| T38 | bypass | Raw SQL shopId reassignment | Denied |
| T39 | + | Pagination boundary exactly one extra page | All lines present |
| T40 | + | BOM `processBomSale` not invoked on canonical path | No component phantom units |
| T41 | − | Aged-out `order(id:)` null | **Must not** tombstone; `INACCESSIBLE_HISTORY_WINDOW` |
| T42 | + | In-window null | Tombstone `ABSENT_CONFIRMED_QUERY` |
| T43 | + | `orders/delete` in-window ⇒ re-check then tombstone; out-of-window ⇒ `ABSENT_SIGNALLED_DELETE_UNVERIFIED`, facts retained | As specified |
| T44 | − | Stale order response | Must **not** write its children |
| T45 | + | Equal-`updatedAt` refetch | Repairs drifted children |
| T46 | + | Refund line with null `id` | Ingests; idempotent |
| T47 | + | 3 ordered − 1 refunded with **both** agreement and refund facts | Underlying reversal sale stores **−1**; derived `refunded_units = 1`, **not** 2 |
| T48 | − | One invalid required MoneyBag | Rejects **whole** snapshot (no partial row) |
| T49 | + | Refund money-reconciliation identity | Balances; unbalanced ⇒ diagnostic / DataIssue via reconciler |
| T50 | bypass | Scope downgrade | Voids prior absence authority |
| T51 | + | v1-projected delivery executed after v2 deploy of other topics | Neither crash nor silent no-op |
| T52 | − | `Sale` selection without inline fragments | Fails codegen |
| T53 | − | Bulk C three-level document | Rejected by bulk schema gate |
| T54 | + | Exchange scenario **and** injected contradictory identity | Does **not** produce spurious `LINE_UNIT_IDENTITY_INCONSISTENT` when the valid-sign identity holds; **does** detect a contradictory identity when one is injected |
| T55 | + | Documented Shopify RETURN example (`actionType: RETURN`, `quantity: -2`) | Ledger stores **−2**; derived `refunded_units` magnitude **2** on a valid-sign snapshot |
| T56 | + | Two refunds each exceeding one child page | Complete snapshot **eventually applies**; no partial refund rows from truncated embeds |
| T57 | − | Exhausted / incomplete nested walk | `SNAPSHOT_PAGINATION_INCOMPLETE` on `OrderFactObservationInFlight`; **never** partially applied; reconciler `DataIssue` visible |

Also required (clock races, not separate IDs): refund/order interleaving both directions; transaction pending→success with no parent bump **observed via refund snapshot** (topic does not fire for PENDING); exact-boundary `windowDays` drift.

Known-answer money vectors (planning fixtures; not executable in this PR):

```text
shopMoney.amount = "19.99" → NUMERIC 19.99 USD
shopMoney.amount = "0.123456" → NUMERIC 0.123456 (no 2dp round)
presentmentMoney.amount = "18.50" EUR + shop 20.00 USD → two columns; no convert
line originalTotal 10.00 qty 2 refund 1 × 5.00 → persist Shopify bags; do not compute JS 10-5 in Number; do not divide 10/2 to invent unit price
```

---

## 20. Product questions — disposition and proposed `Q-0##` IDs

**This PR does not edit `OPEN_QUESTIONS.md`.** ChatGPT should synchronize the control record after acceptance using this table.

Highest existing register id at `f65ab4b9…`: **Q-011**.

### 20.1 Closed / frozen (must not remain open as PR6 product questions)

| Former id | Disposition | Proposed register action |
|---|---|---|
| Q-PR6-01 | **FROZEN** `net-units-order-date-v1` (PO-03) | Do not add a Q |
| Q-PR6-03 | **ENGINEERING** — shop IANA calendar days; `Shop.ianaTimezone` in PR6-A | Do not add a Q |
| Q-PR6-05 | **FROZEN** exclude `test=true` from operational metrics (PO-05) | Do not add a Q |
| Q-PR6-07 | **FROZEN** SUCCESS gating + required `order_transactions/create` (PO-06) | Do not add a Q |
| Q-PR6-08 | **FROZEN** persist; exclude from variant demand (PO-08) | Do not add a Q |
| Q-PR6-09 | **FROZEN** do not tighten three sanitizers; separate authorized cutover (PO-02) | Do not add a Q |
| Q-PR6-10 | **FROZEN** correctness without grant (PO-01); pursue Partner approval | Partner **timing** only → Q-016 |
| Q-PR6-12 | **CLOSED** — never explode BOM (`AGENTS.md` principle 7) | Do not add a Q |

### 20.2 Remaining genuine product questions (storage-neutral or later grain)

| Proposed ID | Former id | Question | Why it remains | Blocks |
|---|---|---|---|---|
| **Q-012** | Q-PR6-02 | Multi-currency ABC: exclude mixed-currency orders vs shop-currency-only vs (forbidden) FX | Engineering already forbids summing mixed currencies and app FX | ABC revenue **label** |
| **Q-013** | Q-PR6-04 | Which MoneyBag is “net sales” / ABC revenue (tax, shipping, discounts) | PRD says “revenue” only | ABC / worksheet revenue |
| **Q-014** | Q-PR6-06 | Location-grain demand identity | No stable GraphQL line sale-location; Monday is shop-wide (PO-09) | Per-location Last-X |
| **Q-015** | Q-PR6-11 | Do cancelled unpaid orders contribute `ordered_units` then cancel vs never sold? | Status vs units; storage-neutral | Net units edge |
| **Q-016** | Q-PR6-10 timing | When to request/receive Partner `read_all_orders` grant | Not a correctness dependency (PO-01); needed for live lookback >60d / last-year **from Shopify** | Live history depth / out-of-window refund observability **from Shopify** |

Q-004 (incoming inventory forecast mix) remains **OPEN** and **out of PR 6**.

Q-PR6-03 is **not** remaining. Do not leave BOM or Q-PR6-03 open.

---

## 21. Risk-register impacts — proposed `R-###` IDs

**This PR does not edit `RISK_REGISTER.md`.** Highest existing id at `f65ab4b9…`: **R-164**. Proposed next: **R-165**.

R-014 remains **OPEN**. This plan is the architecture to close it on the **new** fact path. Legacy webhook `parseFloat` remains until the separate cutover PR (PO-02). Planning approval does **not** close R-014.

R-139 (catalog money) is not closed by PR 6 planning. R-016 still applies when PR6-B adds documents. R-160 / R-161 reuse lock-before-insert and capacity evidence; do not assume catalog lock version covers orders.

### 21.1 Proposed renumbering table (durable; for later control-record sync)

| Proposed ID | Sev | Former / source | Risk |
|---|---|---|---|
| **R-165** | P1 | R-PR6-01 | Silent line/refund/array truncation via `first` on array fields |
| **R-166** | P1 | R-PR6-02 | 60-day window silently treated as a complete lookback |
| **R-167** | P1 | R-PR6-03 | Runtime invents a net-units policy other than frozen `net-units-order-date-v1` |
| **R-168** | P1 | R-PR6-04 | Location `default` carried from legacy aggregates as canonical |
| **R-169** | P1 | R-PR6-05 | Webhook REST payload used as quantity ledger |
| **R-170** | P1 | R-PR6-06 | FK from order lines to current variant facts losing deleted-variant history |
| **R-171** | P1 | R-PR6-07 | Mixing shop and presentment money in ABC |
| **R-172** | P2 | R-PR6-08 | `orders/edited` / `orders/delete` / `order_transactions/create` not subscribed; Last-X stale or money SUCCESS unobservable |
| **R-173** | P1 | R-PR6-09 | Conflicted PR #30 applicator copied incorrectly into order apply (clock collapse). PR #31 is merged; use `app/lib/catalog-facts/apply/**` on main as the PR6-C pattern. |
| **R-174** | P1 | R-PR6-10 | Bulk nesting invalid document submitted without schema gate |
| **R-175** | **P0** | R-PR6-11 | Rolling 60-day access window causes mass false tombstoning; loss unrecoverable; terminal-revival never fires |
| **R-176** | P1 | R-PR6-12 | `orders/delete` omitted so no sound deletion authority |
| **R-177** | P1 | R-PR6-13 | Refunds/edits on orders older than the window permanently unobservable; reconcile cannot heal |
| **R-178** | P1 | R-PR6-14 | Stale parent snapshot overwrites fresher children (no all-or-nothing rule) |
| **R-179** | P1 | R-PR6-15 | Nullable `RefundLineItem.id` ⇒ refund-line idempotency unfounded |
| **R-180** | P1 | R-PR6-16 | Agreement sales and refund lines both post unit events ⇒ double subtraction |
| **R-181** | P1 | R-PR6-17 | Identity-only sanitizer silently zeroes live legacy demand while replacement has no consumer |
| **R-182** | P1 | R-PR6-18 | Apply-time diagnostics unwritable (`DataIssue` control-plane; no merchant-durable columns) |
| **R-183** | P2 | R-PR6-19 | `OrderTransaction.status` mutable with no version and no subscribed signal |
| **R-184** | P2 | R-PR6-20 | Illegal Bulk C / uncosted Bulk B ⇒ Monday agreement/refund import path uncosted |

---

## 22. Estimated critical-path ordering — not calendar promises

Operational target (Monday 2026-09-07) is **not** a commitment and does not override gates.

Dependency order only:

1. ChatGPT accepts this **corrected** planning packet (this PR). Frozen PO decisions are already in the contract.
2. PR 5 remaining runtime lanes independently reviewed, accepted, merged, closure-synced. **PR 6 runtime cannot start before this.** PR **#31** is **merged** (`0284b66c…`); inspect only. **Do not use PR #30 as a base** (still OPEN DRAFT, CONFLICTING). This planning branch is **not** rebased onto current main in this pass; one final current-main sync only after PR 5 closes.
3. **PR6-A**.
4. **PR6-B ∥ PR6-C**.
5. **PR6-D**.
6. Independent Claude review per Tier A lane; ChatGPT acceptance; user merge authorization each lane.
7. Phase 2 forecast/ABC consumers remain a **later** phase.

Critical path is PR5 close → A → (B ∥ C) → D. Skipping C or reconciliation is not a faster safe path.

If PR 5 close slips, this packet still stands; runtime wait is unchanged.

---

## 23. Current legacy anti-pattern (do not copy)

`app/jobs/workers/webhook-processor.ts` `handleOrderCreate` / `handleOrderCancelled` / `handleRefundCreate`:

- treats webhook line_items as complete truth;
- `parseFloat(item.price) * quantity` (R-014);
- buckets to **local** `startOfDay(new Date())`, not Shopify `processedAt` / shop IANA;
- forces `locationId = "default"`;
- increments daily aggregates (duplicate webhooks were a historical P1 before receipts);
- explodes BOM via `processBomSale`.

`app/services/forecasting.server.ts` / `runAbcAnalysis` read `SalesDailyAggregate` and use `Number(revenue)` with a **90-day** window, not the PRD **eight weeks**. That is Phase 2 debt, not a PR 6 formula.

PR 6 facts replace the **source**. They do not rewrite forecast in this phase. They also **must not** starve the legacy path in PR6-D (PO-02).

---

## 24. PR 30 / PR 31 interface notes (read-only)

Inspected 2026-09-02; **not modified**. This planning branch is **not** rebased onto current main.

| PR | Lane | Interface PR 6 should reuse conceptually |
|---|---|---|
| `#31` F2B | **MERGED** on `origin/main` as `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`. `app/lib/catalog-facts/apply/**` on **main** | **Merged** reference applicator pattern for **PR6-C**: Clock A/B/C, observation evidence, money reject Number, first-insert lock. Copy contracts from this merged tree, not from a conflicted branch head. |
| `#30` F2C | `app/lib/catalog-facts/compatibility-projection/**` | Rebuildable projection **after** canonical commit; never HEALTHY-by-assertion over broken facts. **Do not use PR #30 as a base.** |

PR 6 must **not** import catalog apply writers or write `SalesDailyAggregate`.

F2A on main (`app/lib/catalog-facts/admin-read/**`) is the read-boundary pattern to mirror under `order-facts/admin-read`.

Post-merge main `push` run for `#31`: [`33619969867`](https://github.com/Vedang1998/Stocky/actions/runs/33619969867) — event `push`, `head_sha` `0284b66c776bbfa0ce7b8c7d9e579a365d7dfe26`, **SUCCESS** (Classify SUCCESS; Heavy SUCCESS; CI Gate SUCCESS).

---

## 25. Correction-list completion matrix (items 1–70)

| Item | Section | Status |
|---|---|---|
| 1 | §8.5 `INACCESSIBLE_HISTORY_WINDOW` | Done |
| 2 | §8.6 confirmed-absence predicates | Done |
| 3 | §8.7 retain out-of-window; exclude sampling/nomination | Done |
| 4 | §8.8 / §10.9 bulk omission never nominates out-of-window | Done |
| 5 | §9.1 / §17.2 PR6-D `orders/delete` | Done |
| 6 | §8.12 delete-signal authority | Done |
| 7 | §8.12 / §9.2 fail-closed unverified payload | Done |
| 8 | §8 DataIssue codes | Done |
| 9 | T41–T42, boundary, T50 | Done |
| 10 | §5.1 clock table | Done |
| 11 | §5.1 parent-versioned children | Done |
| 12 | §5.1 snapshot atomicity | Done |
| 13 | §5.1 / §9.5 gate `<`; equal re-apply | Done |
| 14 | §5.1 Refund.updatedAt | Done |
| 15 | §5.1 child absence vs incomplete pagination | Done |
| 16 | §9.1 `order_transactions/create` required | Done |
| 17 | §5.1 Order+Refund lock order | Done |
| 18 | §13 races | Done |
| 19 | §4.2 Sale fragments + ReturnAgreement | Done |
| 20 | §7.2.1 eligibility; UnknownSale persist | Done |
| 21 | Drop invalid field; persist `discountedUnitPriceAfterAllDiscountsSet` as lineage only | Done |
| 22 | Drop `Order.cancellation`; use `cancelReason` | Done |
| 23 | `refundableQuantity ≡ currentQuantity` | Done |
| 24 | Named non-connection LIST no-`first`; T20 scoped by owning type | Done |
| 25 | Delete Bulk C; paginated agreements; request bound | Done |
| 26 | Bulk B PR6-B gate + costed fallback | Done |
| 27 | Fail-apply; delete skip-bag | Done |
| 28 | §6.3 required-bag set | Done |
| 29 | Merchant-durable diagnostics; Race Z DataIssue | Done |
| 30 | §6.6 refund money identity; T49 | Done |
| 31 | No division unit prices | Done |
| 32 | `Order.currencyCode` survives shop currency change | Done |
| 33 | One ledger Option A | Done |
| 34 | T47 reversal stores −1 and `refunded_units = 1` | Done |
| 35 | Ordinal refund-line identity; T46 | Done |
| 36 | §7.5 exchanges + ADJUSTMENT | Done |
| 37 | Consistent snapshot pair; null Sale.quantity | Done |
| 38 | Sanitizer option (a); PO-02 | Done |
| 39 | payloadSchemaVersion; T51 | Done |
| 40 | Sweep vs sample | Done |
| 41 | Monday signals + transactions topic | Done |
| 42 | Denormalized line columns + backfill | Done |
| 43 | Child and sale indexes | Done |
| 44 | Shop.ianaTimezone + currencyCode in PR6-A | Done |
| 45 | types.ts in A; A → (B ∥ C) → D | Done |
| 46 | roles.ts in A; app/types/** in B | Done |
| 47 | DIRECT vs CHILD; sequence note | Done |
| 48 | Sale identity `(shopId, shopifyGid)` only | Done |
| 49 | Expanded forbidden PII | Done |
| 50 | Nullability stated | Done |
| 51 | Close Q-PR6-12 BOM | Done |
| 52 | Q-PR6-03 engineering + schema | Done |
| 53 | Q-PR6-09 / Q-PR6-10 answered before PR6-D (PO-02 / PO-01) | Done |
| 54 | Q-PR6-05 exclude test | Done |
| 55 | Q-PR6-07 requires transaction topic | Done |
| 56 | Proposed R-165…R-184 / Q-012…Q-016 in-plan | Done |
| 57–70 | T41–T54 | Done |
| PC-01 | §7.1 / §7.2 signed magnitudes; T29/T47/T54/T55 | Done |
| PC-02 | §4.2 / §4.3 / §4.5 / §5.8 / §15 nested walk; T56/T57 | Done |
| PC-03 | LIST-vs-connection by owning type; T20 | Done |
| PC-04 | `priceSet` required; `Shop.ianaTimezone` non-null API + fail-closed | Done |
| PC-05 | §13 echoes §5.1 lock rule | Done |
| PC-06 | Topic status restriction; T36 PENDING via refund snapshot | Done |

---

## 26. Evidence of planning work

### 26.1 Repository files inspected (original + correction)

- Independent review artifact (read in full; **not edited**)
- Original plan at `76a8f339…`
- `OPEN_QUESTIONS.md` (highest Q-011; **not edited**)
- `RISK_REGISTER.md` (highest R-164; **not edited**)
- Review-cited schema/webhook/lock facts at `f65ab4b9…`

### 26.2 Commands executed (correction phase)

Recorded in the implementation report after git operations. Review blob verification:

```text
git hash-object stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_INDEPENDENT_REVIEW.md
# must equal d72340c01dd9c662d0e8bb4aa8d43482940470d9

git hash-object stocky-plus/docs/phases/phase-1/PR6_EMERGENCY_ORDER_REFUND_FACTS_PLAN_CORRECTION_INDEPENDENT_REVIEW.md
# must equal fca2b260d03e3105782ed216f7773c53e6aef2a7
```

### 26.3 Not executed

- PR 6 runtime, migrations, GraphQL documents, tests
- production Shopify / merchant data
- Partner Dashboard `read_all_orders` request
- edits to `RISK_REGISTER.md` / `OPEN_QUESTIONS.md`
- merge / mark-ready

---

## 27. Stop condition

This packet is implementation-grade when ChatGPT can authorize **PR6-A then PR6-B ∥ PR6-C** without another architecture PR, Monday-critical facts are explicit, remaining Q-012…Q-016 are isolated, lanes/tests are concrete, the immutable review is unchanged, and this planning PR is open with docs-only CI.

**PR 6 runtime remains unauthorized.**
**PR 5 must close first.**
**Production unauthorized.**
**Inventory writes unauthorized.**
**Merge unauthorized.**
**Independent correction approval is not claimed.**
