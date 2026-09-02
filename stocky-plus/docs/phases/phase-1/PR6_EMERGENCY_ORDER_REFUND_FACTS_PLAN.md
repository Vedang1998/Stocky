# Phase 1 PR 6 Emergency Plan — Order / Order-Line / Refund / Cancellation Facts

**Status:** PLANNING ONLY — NOT IMPLEMENTATION AUTHORITY
**Product owner:** ChatGPT
**Implementation owner (when later authorized):** Cursor
**Independent reviewer (when later requested):** Claude Code
**Document type:** Emergency one-dependency-level-ahead architecture packet
**Authorized planning base / current `origin/main` at authoring:** `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` (PR5-F2A squash merge `#29`)
**Shopify Admin API target:** `2026-07` (`ApiVersion.July26`) — do not bump
**Production execution:** NOT AUTHORIZED
**Merchant production data:** NOT AUTHORIZED
**Inventory writes:** UNAPPROVED
**Inventory-write flags:** DEFAULT OFF
**PR 6 runtime:** NOT AUTHORIZED by this document
**Phase 2 forecasting / ABC / buying-table runtime:** NOT AUTHORIZED

This document prepares an execution-ready contract so Phase 1 PR 6 can start immediately after PR 5 implementation is independently reviewed, accepted, merged, and closure-synchronized. It does **not** start PR 6 runtime, migrations, GraphQL production documents, webhook workers, or forecasting.

Official Shopify facts below were read from `shopify.dev` Admin GraphQL `2026-07` object/query pages, webhook and bulk-operations guides, and access-scope documentation on **2026-09-02**. Community posts are not API authority.

Historical `stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md` is **not** implementation authority. This plan does **not** import that document’s receipt, cost, entitlement, billing, or AI ledger items.

---

## 0. Emergency context and current repository truth

### 0.1 Why this packet exists

After PR 5 catalog/location/inventory facts close, PR 6 is a remaining **data** dependency for the September 2026 rescue workflow:

Shopify order/refund facts → dated net units and shop-currency amounts → deterministic Last-X / custom-range demand → ABC/U → low-stock ranking → editable reorder quantities → ordering/export.

This packet must make PR 6 implementable without another broad architecture discovery. Calendar dates are an operational target, not a correctness waiver.

### 0.2 Inspected live state (2026-09-02)

| Item | Evidence |
|---|---|
| `origin/main` | `f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7` — `Phase 1 PR5-F2A — canonical Shopify admin read boundary (#29)` |
| Local `HEAD` at authoring start | same SHA; working tree clean |
| PR5-F1 | Merged / frozen (`#27`) |
| PR5-F2A admin-read | Merged on main (`#29`) |
| PR `#30` F2C compatibility projection | OPEN DRAFT, `CONFLICTING`, head `2d2e8801dd383a778c1237cec4ed068922859cf0` — **inspected only; not modified** |
| PR `#31` F2B canonical applicator | OPEN DRAFT, `CONFLICTING`, head `1b72a4c95f0056783c6c3356bea18a572ca4d5ef` — **inspected only; not modified** |
| Current order/refund webhooks | Signal-only intake: `orders/create`, `orders/cancelled`, `refunds/create` |
| Current merchant application | Legacy `SalesDailyAggregate` via `parseFloat` in `app/jobs/workers/webhook-processor.ts` |
| Current scopes | `read_orders` present; `read_all_orders` **absent**; `write_orders` **absent** (must stay absent) |

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

Tenant authority remains Phase 1 law:

- `Shop.id` is internal tenant authority;
- authenticated shop is derived server-side;
- every merchant fact has non-null `shopId`;
- composite tenant unique keys and child FKs include `shopId`;
- FORCE RLS; immutable `shopId`; no client-provided shop authority;
- jobs use `tenant-job-envelope-v3`.

Money remains exact-decimal. JavaScript `Number`, `parseFloat`, and float arithmetic are forbidden on every PR 6 monetary path. R-014 stays **OPEN** until PR 6 implementation is independently verified.

Do not store unnecessary customer PII (D-021 / Phase 1 brief privacy decision). Forecasting does not require customer identity.

Approved product documents override unfinished code, the legacy `SalesDailyAggregate` model, and implementation convenience.

---

## 2. Exact scope

When ChatGPT later authorizes PR 6 implementation, authorized work is:

1. Canonical Shopify order / line / refund / cancellation / adjustment / edit-agreement facts.
2. Historical product/variant identity snapshots on lines, independent of current catalog rows.
3. Exact-decimal shop-money and presentment-money persistence from Shopify `MoneyBag` / `MoneyV2.amount` Decimal strings.
4. Admin GraphQL **QUERY-only** extraction (direct refetch + bulk), following the F2A codegen/AST-deny-mutation pattern.
5. Webhook signal → durable inbox → authoritative refetch → tenant apply → application receipt.
6. Initial historical import and periodic reconciliation.
7. Tenancy/RLS registration for new merchant-domain tables.
8. Tests covering identity, clocks, money, pagination, duplicates, races, and reconciliation.

PR 6 stores facts that later Phase 2 Last-X, custom-range, ABC/U, and low-stock **consumers** can derive from. PR 6 does not implement those consumers.

### 2.1 Required fact types

| Planning name | Prisma proposal | Identity | Monday-critical? |
|---|---|---|---|
| Order fact | `ShopifyOrderFact` | `(shopId, shopifyGid)` | Yes |
| Order line fact | `ShopifyOrderLineFact` | `(shopId, shopifyGid)` | Yes |
| Refund fact | `ShopifyOrderRefundFact` | `(shopId, shopifyGid)` | Yes |
| Refund line fact | `ShopifyOrderRefundLineFact` | `(shopId, shopifyGid)` | Yes |
| Cancellation facts | columns on `ShopifyOrderFact` plus optional `ShopifyOrderCancellationFact` only if cancellation is not 1:1 | order GID | Yes (order columns) |
| Order adjustments | `ShopifyOrderAdjustmentFact` | `(shopId, shopifyGid)` | Yes for money reconcilability; not required to compute net units |
| Edit / sales agreements | `ShopifyOrderAgreementFact` + `ShopifyOrderAgreementSaleFact` | agreement GID; sale row `(shopId, agreementGid, saleGid)` | Yes for quantity timeline (edits vs refunds) |
| Shipping line facts | `ShopifyOrderShippingLineFact` | shipping line GID | Post-Monday parity (persist order-level shipping money bags on Monday) |
| Observation in-flight | `OrderFactObservationInFlight` | observation request gen | Yes |
| Rebuildable daily projection | **not a source of truth**; optional later derived table | n/a | Post-Monday (Phase 2 may query facts directly for Monday) |

Additional tables are required: **yes** — refund, refund-line, adjustment, agreement/sale, and observation-in-flight. Do **not** collapse edits/refunds into `SalesDailyAggregate`.

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
- customer PII storage (email, phone, addresses, IP, customer GID, marketing consent);
- treating webhook payloads as complete records;
- copying or extending `SalesDailyAggregate` as the system of record;
- BOM explosion into component “sales” (`processBomSale`);
- silent SKU/barcode merge of deleted/recreated variants;
- JavaScript Number money;
- rounding Shopify amounts to 2 decimal places;
- enabling `read_all_orders` without Partner approval + product-owner decision;
- marking Phase 1 complete;
- production access, backfill, or merge.

---

## 4. Shopify source contract

API version is **Admin GraphQL 2026-07**. Documents follow F2A:

- tagged `#graphql` queries in `app/lib/order-facts/admin-read/documents.ts` for codegen (`npm run graphql-codegen`, `.graphqlrc.ts` `ApiVersion.July26`);
- untagged bulk inner queries validated by a dedicated schema gate against the codegen schema artifact;
- AST deny-by-default: mutations never reach `admin.graphql`;
- no `currentBulkOperation`; persist BulkOperation GID;
- nested bulk connections: one top-level connection, ≤5 connections, ≤2 nested connection levels, `groupObjects` remains false at submit time;
- traverse connections as `edges { node { … } }`;
- `first` omitted on bulk-traversable connections (bulk ignores pagination args).

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

1. Default Admin access is the **last 60 days** of orders unless `read_all_orders` is approved and granted on the token.
2. `Order.test` is a boolean; test orders cannot convert into real orders.
3. `LineItem.quantity` includes refunded and removed units; `currentQuantity` excludes refunded and removed units.
4. `MoneyBag.shopMoney` is shop currency; `presentmentMoney` is customer presentment currency.
5. `MoneyV2.amount` is GraphQL `Decimal` (JSON string). Deprecated `Money` scalars must not be the write path.
6. A `Refund` object does **not** guarantee money has been returned; transactions have their own status.
7. Webhook delivery and ordering are **not** guaranteed; reconciliation jobs are required.
8. `orders/edited` payload reports **what changed**, not the new full order; refetch the order by GID.
9. `Order.refunds` is an **array** with optional `first` truncation, not a connection. Passing `first` can silently truncate. Production refetch must **not** pass `first`.
10. `LineItem.variant` and `LineItem.product` are nullable (deleted catalog identities).

### 4.2 Direct refetch documents (planning names)

All QUERY. Identity cross-check: requested GID must equal returned `id` or the reader fails closed (F2A lesson; never accept a different node because a field is null).

#### `OrderFactById`

```graphql
query OrderFactById($id: ID!) {
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
    cancellation { reason staffNote }
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
      refundLineItems(first: $refundLineFirst, after: $refundLineAfter) {
        pageInfo { hasNextPage endCursor }
        edges { cursor node { ...RefundLineFactFields } }
      }
      orderAdjustments(first: $adjFirst, after: $adjAfter) {
        pageInfo { hasNextPage endCursor }
        edges { cursor node { ...OrderAdjustmentFactFields } }
      }
      refundShippingLines(first: $shipRefundFirst, after: $shipRefundAfter) {
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
      transactions(first: $txnFirst, after: $txnAfter) {
        pageInfo { hasNextPage endCursor }
        edges {
          cursor
          node {
            id
            status
            kind
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
          ... on OrderEditAgreement { id happenedAt reason }
          ... on RefundAgreement { id happenedAt reason refund { id } }
          ... on OrderAgreement { id happenedAt reason }
          sales(first: $saleFirst, after: $saleAfter) {
            pageInfo { hasNextPage endCursor }
            edges {
              cursor
              node {
                id
                quantity
                lineType
                actionType
                totalAmount { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
                lineItem { id }
              }
            }
          }
        }
      }
    }
  }
}
```

Implementation must codegen-validate fragment names and Sale/Agreement field names against the live 2026-07 schema. If a selected field is absent from 2026-07, **fail codegen** and substitute the schema-valid equivalent; do not guess. `cancellation.staffNote` is **not** persisted (possible operational PII); it may be queried only if needed for diagnostics and then discarded.

#### `RefundFactById`

```graphql
query RefundFactById($id: ID!) {
  refund(id: $id) {
    id
    legacyResourceId
    createdAt
    updatedAt
    processedAt
    order { id }
    totalRefundedSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    refundLineItems(first: $first, after: $after) { ... }
    orderAdjustments(first: $first, after: $after) { ... }
    transactions(first: $first, after: $after) { ... }
  }
}
```

Webhook `refunds/create` supplies a refund REST id. Convert to `gid://shopify/Refund/{id}`, fetch refund, then fetch/apply the parent order. The refund query is not sufficient as the only apply input because line current quantities live on the order.

#### `OrderLineFactFields` (conceptual)

Required:

- `id`, `sku`, `title`, `variantTitle`, `vendor`, `name`, `isGiftCard`
- `quantity`, `currentQuantity`, `refundableQuantity`, `unfulfilledQuantity`, `nonFulfillableQuantity`
- `originalTotalSet`, `originalUnitPriceSet`
- `discountedTotalSet(withCodeDiscounts: true)` **and** `discountedTotalSet(withCodeDiscounts: false)` if both are needed for reconciliation — if GraphQL cannot alias two argument variants in one selection, issue two line reads or persist the `withCodeDiscounts: true` value and record the argument in lineage
- `priceAfterAllDiscountsBeforeTaxesSet`
- `totalDiscountSet`
- `variant { id legacyResourceId sku title }` (nullable)
- `product { id legacyResourceId title handle }` (nullable)

Forbidden on the persisted fact:

- customer, addresses, email, phone, IP;
- deprecated `Money` scalars (`discountedTotal`, `originalTotal`, …).

### 4.3 Pagination rules

- Direct `order(id:)` **must** cursor-paginate `lineItems`, `agreements`, `sales`, `refundLineItems`, `orderAdjustments`, refund shipping lines, and refund transactions until `hasNextPage=false`.
- No silent `first: 50` / `first: 250` cap. A page size may be 100–250 for transport, but the loop is mandatory.
- If `Order.refunds` is truncated because `first` was passed, that apply is invalid. Tests must prove `first` is omitted.
- Incomplete pagination is **not** a successful apply.

### 4.4 Incremental window / cursor

`orders` search supports `updated_at` and `processed_at` filters (official orders query docs).

Sync domains (control-plane `SyncCursor.syncDomain` strings):

| Domain | Cursor meaning |
|---|---|
| `orders_full` | Bulk historical import fence / completion watermark |
| `orders_incremental` | Inclusive `updated_at` lower bound last successfully applied |
| `orders_reconcile` | Last completed reconcile window end |

Incremental query shape:

```text
orders(query: "updated_at:>='TIMESTAMP'") { ... }
```

Watermark is the maximum applied Shopify `updatedAt` among **successfully applied** orders in that run, not the job start time, not webhook `receivedAt`. Overlap the previous watermark by a documented skew window (propose 2 minutes; product-owner may tighten) so clock skew does not drop rows. Duplicate apply is cheap because apply is idempotent.

Do **not** use webhook payloads as the incremental record.

### 4.5 Bulk-operation suitability

Bulk **is** the historical import path. Direct pagination of `orders` for 1,000,000 line facts is forbidden as the primary import.

Proposed bulk inner queries (must pass the F2A-style schema gate; split if nesting/array rules fail):

**Bulk A — orders + lines (Monday-critical):**

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
              priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
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

**Bulk B — refunds / adjustments (Monday-critical):** validate whether `orders { refunds { refundLineItems { … } } }` is schema-valid under bulk array+connection rules. If invalid, use `refundLineItems` via a second legal shape or per-order refetch for refunds after Bulk A. Do not invent a REST-only refund import.

**Bulk C — agreements/sales (Monday-critical for edits):** `orders { agreements { sales { … } } }` is two nested connections — at the official bulk depth limit. If schema/bulk gate rejects it, fallback is direct `order(id:)` agreement pagination for orders with `edited=true` or `cancelledAt != null`.

Partial bulk JSONL is **not** a successful full sync (PR 5 rule reused). Two-phase ingest: persist JSONL line evidence on merchant facts, then acknowledge control-plane ordinal.

### 4.6 Current vs historical product linkage

| Link | Rule |
|---|---|
| `shopifyVariantGid` / `shopifyProductGid` on the line | Snapshot of GraphQL `variant.id` / `product.id` **at refetch**, nullable |
| `variantGidAtSale` | Same GID string persisted forever even if later refetches return null |
| Current `ShopifyVariantFact` | Optional lookup only; **no FK**; missing current catalog is normal |
| SKU / barcode / title | Attributes/snapshots; **never** merge keys |

If a later refetch returns `variant=null`, do **not** clear `variantGidAtSale`. Existence of the **order** is independent of catalog existence.

### 4.7 60-day window

Without `read_all_orders`, Shopify only returns ~60 days of orders. ABC/U last eight weeks (56 days) **may** fit; Last-X of 90 days, custom ranges, and same-period-last-year will not.

Implementation must:

- detect truncated history (requested window older than accessible orders);
- write `DataIssue` code `ORDER_HISTORY_WINDOW_TRUNCATED`;
- never present a truncated extract as a complete lookback.

Enabling `read_all_orders` is **Q-PR6-10** (product owner + Partner Dashboard). This plan does not add the scope.

---

## 5. Canonical schema proposal

Logical names. Additive Prisma/SQL only. No edits to PR 5 catalog models except Shop relation arrays.

### 5.1 Shared tenancy / lineage (every merchant fact)

Copy the PR 5 fact pattern; do not invent a second clock system.

Required on every order-domain fact:

- `id` cuid
- `shopId` non-null, immutable, composite unique `(shopId, id)`
- tenant-leading identity unique
- `shopifyCreatedAt` / `shopifyUpdatedAt` (clock A) where Shopify exposes them
- `existenceState` `LIVE | ABSENT`
- `existenceKind` `LIVE_REFETCH | LIVE_FULL_SYNC_PRESENT | ABSENT_CONFIRMED_QUERY`
- `existenceObservedAt`, `existenceRequestGen`, `existenceResponseGen` (clock B)
- clock C signal fields (`signalReceivedAt`, `lastSignalTopic`, `lastSignalDeliveryId`, `lastSignalTriggeredAt`)
- `lastSeenFullSyncRunId`, `attributeRequestGen` / `attributeResponseGen`, `attributeFreshnessState`
- `existenceDiagnosticState`, `absenceNominationState`, `ingestBatchId`
- `sourceKind` `FULL_SYNC | INCREMENTAL_REFETCH | DELETE_WEBHOOK | RECONCILE`
- `lastSyncRunId`, `lastDurableJobId`
- `deletedAt`, `deletionSource`
- `shopifyLegacyResourceId`
- `createdAt` / `updatedAt` app timestamps

Reuse platform sequence `stocky_catalog_observation_gen_seq` for request/response gens. Do **not** add a generation counter to `Shop`. Cross-shop numeric comparison of gens remains forbidden.

New lock version (do **not** edit frozen `stocky-pr5-canonical-lock-v1`):

```text
stocky-pr6-canonical-lock-v1
```

Resource-kind literals (exact): `Order`, `OrderLine`, `Refund`, `RefundLine`.

Encoding: same as PR 5 — `<decimal UTF-8 byte length>:<UTF-8 bytes>` components, SHA-256, signed int32 `key1`/`key2` from digest bytes 0..7, never a JS Number 64-bit key. Known-answer vectors required in PR6-A.

Apply locking: **one Order identity lock** covers a full order apply including children. Refund-signal jobs still lock the **parent Order** (and may also lock the Refund GID after Order). Do not lock 250 line GIDs independently in one transaction (capacity envelope).

### 5.2 `ShopifyOrderFact`

Identity: `@@unique([shopId, shopifyGid])`.

| Column | Source |
|---|---|
| `shopifyGid` | `Order.id` |
| `name` | `Order.name` (not unique across shops; not PII) |
| `shopifyCreatedAt` | `createdAt` |
| `shopifyUpdatedAt` | `updatedAt` |
| `processedAt` | `processedAt` — persist exact Shopify DateTime string **and** timestamptz via F2A-style validator (no `Date.parse` rewrite) |
| `cancelledAt` | `cancelledAt` |
| `cancelReason` | `cancelReason` enum as text |
| `closed` / `closedAt` | Order |
| `edited` | `edited` |
| `test` | `test` |
| `confirmed` | `confirmed` |
| `shopCurrencyCode` | `currencyCode` |
| `presentmentCurrencyCode` | `presentmentCurrencyCode` |
| `taxesIncluded` | `taxesIncluded` |
| `displayFinancialStatus` | enum/text |
| `displayFulfillmentStatus` | enum/text |
| `sourceName` | `sourceName` (web/pos/…) |
| `retailLocationGid` | `retailLocation.id` nullable — **not** a sale-location authority by itself |
| `currentSubtotalLineItemsQuantity` | Int |
| `subtotalLineItemsQuantity` | Int |
| Money bags listed in §4.2 | `Decimal(20,6)` + currency columns per bag side |

Do **not** persist: `email`, `phone`, `customer`, `billingAddress`, `shippingAddress`, `clientIp`, `note` (may contain customer messages), `customAttributes` unless a later decision proves they are non-PII operational facts.

### 5.3 `ShopifyOrderLineFact`

Identity: `@@unique([shopId, shopifyGid])`.

Child FK: `(shopId, shopifyOrderGid)` → `ShopifyOrderFact`. Parent may be LIVE or ABSENT.

| Column | Source / rule |
|---|---|
| `shopifyGid` | `LineItem.id` — **stable line identity** across edits |
| `shopifyOrderGid` | parent |
| `quantity` | original/inclusive units |
| `currentQuantity` | excludes refunded+removed |
| `refundableQuantity` | Shopify field |
| `unfulfilledQuantity` | persist; not Monday demand input |
| `isGiftCard` | boolean |
| `title` / `variantTitle` / `vendor` / `sku` / `name` | snapshots at last successful apply |
| `variantGidAtSale` | first non-null `variant.id` observed; immutable afterward |
| `productGidAtSale` | first non-null `product.id` observed; immutable afterward |
| `currentVariantGid` | latest refetch `variant.id` or null |
| `currentProductGid` | latest refetch `product.id` or null |
| `variantLegacyResourceId` | snapshot |
| money columns | see §6 |
| **no FK** to `ShopifyVariantFact` | historical identity survives catalog tombstone |

Removed-but-still-listed lines remain rows (`currentQuantity=0`). Do not delete line rows.

### 5.4 `ShopifyOrderRefundFact` / `ShopifyOrderRefundLineFact`

Refund identity: refund GID.

Refund line identity: `RefundLineItem.id`. Always store `shopifyLineItemGid` even if the parent line is later absent.

| Refund line column | Source |
|---|---|
| `quantity` | refunded units |
| `restockType` / `restocked` | inventory restock **signal only** — PR 6 does not mutate inventory |
| `restockLocationGid` | `location.id` nullable |
| `subtotalSet` / `totalTaxSet` / `priceSet` | MoneyBags |

Persist refund `processedAt` / `createdAt` / `updatedAt`. Persist associated transaction `id` + `status` + `kind` + `amountSet` on a child table `ShopifyOrderRefundTransactionFact` so “refund object exists but money not captured” is reconcilable. Monday net-units may use refund line quantities even while transaction status is pending **only if** product owner accepts Q-PR6-07; otherwise pending transactions are excluded from net-sales money but units still follow refund line quantities (split decision).

### 5.5 `ShopifyOrderAdjustmentFact`

From `Refund.orderAdjustments`: `id`, `reason`, `amountSet`, `taxAmountSet`, parent refund GID, parent order GID.

Needed to reconcile `totalRefundedSet` vs sum(refund lines)+shipping+adjustments.

### 5.6 Agreement / sale facts

`ShopifyOrderAgreementFact`: agreement GID, `happenedAt`, GraphQL `__typename` / reason, optional `refundGid`.

`ShopifyOrderAgreementSaleFact`: sale GID, `quantity` (signed per Shopify Sale.quantity), `lineItemGid`, `actionType` / `lineType` if present, amount MoneyBag.

This is how PR 6 distinguishes **edit-removed units** from **refunded units** without guessing from `currentQuantity` alone.

If 2026-07 Sale fields differ, codegen is authority; keep quantity + lineItem id + happenedAt as the minimum.

### 5.7 Shipping

Monday: persist order-level `currentShippingPriceSet` / original shipping if available on Order (`currentShippingPriceSet` is official). Full `ShopifyOrderShippingLineFact` is post-Monday parity.

### 5.8 `OrderFactObservationInFlight`

Same lifecycle contract as `CatalogObservationInFlight` (`ACTIVE` ⇒ `responseGen IS NULL`; `COMPLETED` ⇒ `responseGen NOT NULL`). Do not reuse the catalog table (domain isolation). Same lease helpers pattern; new SQL names.

### 5.9 What is explicitly not a fact table

| Legacy / derived | Status |
|---|---|
| `SalesDailyAggregate` | Legacy, lossy, location=`default`, `parseFloat`. **Not** PR 6 SoR. Do not extend. |
| Forecast / ABC tables | Phase 2 consumers |
| Compatibility projection into `SalesDailyAggregate` | Not PR 6. If later desired, rebuildable only **after** canonical commit, never clock authority (F2C rule). |

### 5.10 RLS / enforcement registration (implementation)

New models are `merchant_domain`, `rlsRequired`, DML for `stocky_runtime` only with tenant GUC. Register in:

- `scripts/tenant-enforcement/manifest.ts`
- `app/tenant/models.ts` `DIRECT_MERCHANT_MODELS` / delegates
- tenant-access allowlist if still mechanically generated in that lane

Shop relation arrays are additive. `shopId` immutability trigger/policy from PR 3 must apply.

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
- converting presentment → shop via app FX.

### 6.2 Shop vs presentment policy

**Persist both sides** of every MoneyBag selected.

**Operational / forecast / ABC shop-currency amounts** use **`shopMoney` only**. Presentment is lineage for international orders and merchant support, not the Monday demand currency.

If `shopMoney.currencyCode` ≠ order `currencyCode`, fail closed with `DataIssue MONEY_CURRENCY_MISMATCH` and do not apply that bag.

Multi-currency shops: each order has its own `currencyCode`. Cross-order ABC revenue **must not** sum mixed currencies. See Q-PR6-02.

### 6.3 Arithmetic

All derived sums/diffs use PostgreSQL `NUMERIC` or Prisma `Decimal` (decimal.js inside Prisma). Integer units use `Int` / `BigInt`, never floats.

Reconciliation equality is exact string/numeric equality to Shopify-reported bag amounts, not epsilon.

### 6.4 Precision > 2 decimals

Shopify Decimal may include sub-cent fractions. Persist full source string. Tests include `0.123456` and currencies with 3 minor units (e.g. `KWD` 3dp) **if** such a code appears in fixtures; do not invent FX.

### 6.5 Zero-value lines

`amount = "0.0"` / `"0.00"` is valid. Quantity may be > 0 with zero price. Do not drop the line.

---

## 7. Exact unit / net-sales contract

### 7.1 Fact-level unit fields (frozen; Shopify-authored)

For each line **at last successful apply**:

| Name | Definition | Source |
|---|---|---|
| `ordered_units` | Units ordered including later refunds and removals | `LineItem.quantity` |
| `current_units` | Units remaining excluding refunded and removed | `LineItem.currentQuantity` |
| `refunded_units` | Sum of `RefundLineItem.quantity` for that line GID across LIVE refunds | refund line facts |
| `removed_units` | `ordered_units - current_units - refunded_units` | derived; must be ≥ 0 |

If `removed_units < 0`, do not coerce. Raise `DataIssue LINE_UNIT_IDENTITY_INCONSISTENT` and keep stored Shopify fields.

Gift-card lines (`isGiftCard=true`) are stored but **excluded from Monday net-units / ABC** until Q-PR6-08 says otherwise.

Custom/no-variant lines (`variantGidAtSale` null): stored; **excluded from variant-level forecast/ABC**; countable in order-level money reconcilation.

### 7.2 Dated events (frozen storage; required to avoid snapshot-only demand)

`currentQuantity` is **live remaining**, not a dated sale. Last-X needs dated events. Persist:

| Event | Units sign | Time authority |
|---|---|---|
| Original line | `+quantity` | order `processedAt` (Q-PR6-03 may switch to `createdAt`) |
| Agreement sale | Shopify `Sale.quantity` (may be negative) | agreement `happenedAt` |
| Refund line | `-RefundLineItem.quantity` | refund `processedAt` |
| Order cancellation | not a second unit event if lines/refunds/agreements already zero remaining | `cancelledAt` is status; do not double-count |

Applicator upserts **current Shopify snapshot** on order/line/refund rows **and** upserts agreement/refund children by GID. Derived demand reads events + snapshots per a named **metric policy version**.

### 7.3 Metric policy versions — PRODUCT OWNER REQUIRED

Approved product docs define Last-X as:

```text
daily_velocity = net_units_sold / sample_calendar_days
```

They do **not** define net_units_sold against Shopify refund/edit/cancel clocks, timezone, test orders, taxes, or location. PR 6 **must not** silently invent those.

Named policies (storage supports all; **none is product law until ChatGPT accepts one**):

| Policy id | Meaning |
|---|---|
| `net-units-unspecified` | Default until Q-PR6-01 is closed. Implementation may persist facts but must **not** label a forecast input as Stocky parity. |
| `net-units-order-date-v1` | Attribute original units to `processedAt` date; subtract refunds and edit-removals from **that same original date**; add edit-additions on `happenedAt` date. |
| `net-units-event-date-v1` | Each refund/edit posts on its own `processedAt`/`happenedAt` date (can go negative on a day). |

**This planning packet does not select a policy.** Monday rescue cannot truthfully run Last-X until Q-PR6-01 is closed. Facts can still land.

### 7.4 Money metric names (facts, not yet forecast)

Persist Shopify bags. Do not rename them into “net sales” in code until Q-PR6-04:

| Name | Proposed Shopify binding (provisional) | Status |
|---|---|---|
| Gross merchandise amount | Sum of line `originalTotalSet.shopMoney` | Provisional |
| Line discounts | Sum of line `totalDiscountSet.shopMoney` | Provisional |
| Refund value | Sum of refund `totalRefundedSet.shopMoney` or refund-line `subtotalSet` — these can differ (shipping/tax/adjustments). Both persisted | Q-PR6-04 |
| Net sales | Not defined by approved product docs | **Q-PR6-04 required** |
| ABC revenue | PRD says last eight weeks revenue; not shop vs presentment, not tax inclusion | **Q-PR6-04 / Q-PR6-02** |

Order-level `currentTotalPriceSet` includes taxes and discounts after returns (official Order docs). That is **not** automatically “net sales.”

### 7.5 Scenario rules (apply behavior; metric policy still separate)

| Scenario | Apply rule |
|---|---|
| Partial refund | Upsert refund + refund lines; order/line snapshot from order refetch; no increment/decrement of a daily aggregate |
| Full refund | Same; `currentQuantity` likely 0 |
| Multiple refunds | Separate refund GIDs; sum quantities by line; duplicate refund GID is idempotent upsert |
| Order edits | `edited=true`; agreements/sales upserted; line `quantity`/`currentQuantity` replaced from refetch, not patched from webhook deltas |
| Line removal | Line row remains; `currentQuantity=0`; removed_units reconcilable |
| Quantity increase/decrease | New snapshot + agreement sales |
| Cancel after payment | `cancelledAt` set; refunds may exist; do not apply webhook line_items as deltas |
| Refund after cancellation | Persist both; unit identity formula in §7.1; if inconsistent, DataIssue |
| Duplicate webhook | Receipt on delivery; refetch; upsert by GID |
| Out-of-order webhook | Signal only; refetch current; clock A `updatedAt` vs stored `shopifyUpdatedAt` of **same resource** |
| Deleted variant | Keep `variantGidAtSale`; `currentVariantGid=null` |
| Recreated variant same SKU | New GID; new catalog identity; historical lines stay on old GID |
| Missing current product/variant | Allowed |
| Test orders | Persist `test`; exclusion is Q-PR6-05 |
| Zero-value lines | Persist |
| Mixed currencies | Persist per order; do not sum across currencies |
| Presentment ≠ shop | Persist both; metrics use shopMoney only once Q-PR6-02/04 close |

### 7.6 Location-attributed units

GraphQL LineItem **does not** expose a stable sale-location equivalent to REST `location_id` on every line. `retailLocation`, fulfillment orders, and refund restock location are **different** clocks/meanings.

Legacy code used `locationId = "default"` — **forbidden** as canonical.

Monday variant-level (shop-wide) net units do not require location. Location-grain demand is **Q-PR6-06**. Do not invent `default`.

---

## 8. Identity / deletion rules

1. Canonical identities are Shopify GIDs: Order, LineItem, Refund, RefundLineItem, OrderAdjustment, SalesAgreement, Sale.
2. SKU, barcode, title, handle, order `name`, and `number` are attributes.
3. Recreated variants are new GIDs. Never merge history by SKU.
4. Tombstone orders only with `ABSENT_CONFIRMED_QUERY` (`order(id:)` returns null). Transport errors are not absence.
5. Terminal order GIDs: follow PR 5 terminal-GID revival — two independent non-overlapping LIVE confirmations; do not un-tombstone from webhook time vs `deletedAt`.
6. Line/refund children: if parent order is ABSENT, children stay as historical rows (RESTRICT parent FK includes tombstoned parents, same as catalog variants→products). Do not cascade-delete.
7. Shopify does not provide an `orders/delete` topic in the current app subscriptions. Confirmed-null refetch / reconcile is the absence path.
8. `variantGidAtSale` never updates to a later SKU-matched GID.
9. Cross-shop identical numeric REST ids are distinct because uniqueness is `(shopId, gid)`.
10. No customer GID storage. Uninstall/redact later (PR 7) must delete these operational facts with the tenant.

---

## 9. Webhook / refetch contract

### 9.1 Current routes (main)

| Topic | Route | Today | PR 6 target |
|---|---|---|---|
| `orders/create` | `app/routes/webhooks.orders.create.tsx` | HMAC → `ingestAuthenticatedWebhook` | Keep signal; sanitizer identity-only |
| `orders/cancelled` | `app/routes/webhooks.orders.cancelled.tsx` | same | same |
| `refunds/create` | `app/routes/webhooks.refunds.create.tsx` | same | same; refetch refund **and** parent order |
| `orders/updated` | **not subscribed** | — | Post-Monday latency; noisy |
| `orders/edited` | **not subscribed** | — | Monday-critical **signal** for quantity edits |
| `orders/delete` | not in 2026-07 topic enum as currently used | — | not planned |

Intake already matches PR 4: authenticate, sanitize, `WebhookDelivery`, `DurableJob`, envelope v3, dispatcher kick.

### 9.2 Sanitizer contract

Current sanitizers already strip PII and keep money as strings, but they still project line prices/quantities. PR 6 **tightens** projections to **identity + signal metadata only** (PR 5 catalog rule):

- order: `id`, `admin_graphql_api_id` if present, `updated_at`, `processed_at`
- refund: `id`, `order_id`, `created_at`
- edited payload: `order_id`, edit `id`, `committed_at`

Do not persist customer, addresses, or full line arrays in `WebhookDelivery.sanitizedPayload` for PR 6 jobs. Large-order overflow already fails closed (`PROJECTION_BOUNDS`); identity-only removes that class of overflow for apply.

Bump projection schema versions (`webhook-projection-orders-create-v2`, etc.). Unknown topics still fail closed.

### 9.3 Authoritative apply path (all topics)

```text
HMAC → WebhookDelivery + DurableJob (ATOMIC_APPLICATION_RECEIPT)
  → allocate observationRequestGen
  → Admin QUERY order(id) and/or refund(id) with complete pagination
  → allocate observationResponseGen
  → tenant txn: Order advisory lock → apply snapshot + children → receipt
```

Never apply REST line_items onto `SalesDailyAggregate` on the canonical path.

Legacy `handleOrderCreate` / `handleOrderCancelled` / `handleRefundCreate` remain **out of PR 6 SoR**. Cutover of the legacy handler is Q-PR6-09. Dual-write is not required for PR 6 facts and would preserve R-014 on the legacy path.

### 9.4 Job types (additive)

| jobType | strategy | source |
|---|---|---|
| `webhook:orders/create` | `ATOMIC_APPLICATION_RECEIPT` | existing; handler **changes** to refetch+apply when PR6-D is authorized |
| `webhook:orders/cancelled` | same | same |
| `webhook:refunds/create` | same | same |
| `webhook:orders/edited` | `ATOMIC_APPLICATION_RECEIPT` | new |
| `order-facts-sync` | `REBUILDABLE_IDEMPOTENT` | historical/incremental bulk |
| `order-facts-reconcile` | `REBUILDABLE_IDEMPOTENT` | periodic |

Unknown job types remain `NO_AUTOMATIC_RETRY`.

Envelope stays `tenant-job-envelope-v3`. Application key remains `(shopId, applicationKey)` via `SyncApplicationReceipt`. Duplicate deliveries do not double-apply merchant effects.

### 9.5 Out-of-order / stale refetch

Reuse PR 5 clocks:

- Attributes: compare Shopify `updatedAt` only to stored `shopifyUpdatedAt` of the same resource.
- Existence: observation interval overlap rules; no last-writer-wins.
- Clock C never decides freshness.
- A stale refetch with older `Order.updatedAt` **must not** overwrite newer attributes.
- Overlapping LIVE/ABSENT intervals must not resolve from `existenceResponseGen` alone.

Refund `updatedAt` vs Order `updatedAt` are different resources. Applying a refund never uses refund time to decide order attribute freshness. Order refetch is the order-attribute authority.

---

## 10. Initial import strategy

1. Kill switch: `Shop.processingEnabled` must be true.
2. Create `SyncRun` domain `orders` / `orders_full`.
3. Allocate `fenceGeneration` before `bulkOperationRunQuery` (PR 5 fence rule).
4. Submit Bulk A (and B/C if valid). Persist BulkOperation GID. Poll by id. Forbidden: `currentBulkOperation`.
5. Stream JSONL with bounded memory. Two-phase commit with `ingestBatchId`.
6. Apply under Order advisory locks, batches of orders (not unbounded).
7. Incomplete JSONL / throttling / 5xx → run not successful; resume from last committed ordinal.
8. After bulk COMPLETED: nominate absence candidates for orders previously LIVE but omitted **only if** the run is complete and the 60-day window is understood. Do **not** tombstone from omission when `read_all_orders` is absent (omission is expected outside 60 days).
9. Overlap with live webhooks is required (Phase 1 test). Locks + clocks make this safe.
10. Record examined/applied/conflict/truncated-window counts.

Historical depth:

- Monday accessible default: ~60 days.
- Same-period-last-year: blocked on Q-PR6-10.
- Do not silently backfill from webhook archives.

---

## 11. Reconciliation

Periodic `order-facts-reconcile` per shop:

1. Query `orders(query: "updated_at:>='{watermark - overlap}'")` via bulk or paginated direct with complete pages.
2. Apply the same applicator as webhooks.
3. For a sampled set of LIVE facts, refetch `order(id:)` and diff quantity/money bags; mismatches → `DataIssue` and repair apply.
4. Missed webhooks are healed because reconcile is authoritative refetch, not webhook replay.
5. Cadence: propose per-shop bounded job, not a global convoy (D-051 lesson). Exact interval is operational (suggest 15–60 minutes); correctness does not depend on webhook completeness.
6. Reconciliation success requires recorded watermarks and issue rows for unrepaired diffs.

Repair is always “refetch and apply,” never “replay sanitized webhook body.”

---

## 12. Tenancy / RLS

New tables inherit PR 3:

- non-null `shopId`;
- `@@unique([shopId, id])` and tenant-leading GID unique;
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

`OrderFactObservationInFlight` is merchant_domain (has `shopId`), same as catalog in-flight.

Control-plane tables stay non-DML for runtime (`WebhookDelivery`, `DurableJob`, `SyncRun`, `SyncCursor`).

---

## 13. Idempotency / concurrency

| Mechanism | Use |
|---|---|
| `SyncApplicationReceipt` | Exactly-once merchant effect per webhook delivery application key |
| GID upsert | Idempotent snapshot replace |
| Advisory lock `stocky-pr6-canonical-lock-v1` + `Order` GID | Serialize applies per order |
| Observation intervals | Concurrent refetch safety |
| `ON CONFLICT` | Must re-evaluate clocks, not blind overwrite (PR 5 F-CLAUDE-PR5C8 / R-160 lesson) |
| First insert | Universal exclusive lock **before** the row exists (same R-160 rule): lock identity, then insert |

Refund webhook and order webhook concurrent: both lock Order GID; order is consistent.

Do not hold advisory locks across Shopify I/O.

Lock timeout: reuse PR5 `5000ms` transaction-local `lock_timeout`; fail closed and retry.

Capacity: identities per transaction = 1 Order (+ optional Refund) by default, well under 32.

---

## 14. Performance / batching

Engineering envelope from Phase 1 brief: **1,000,000 order-line facts**, 50k variants, 15 locations, multi-shop.

Requirements:

- no N+1 Admin queries per line (bulk + paged connections);
- bounded-memory JSONL;
- indexed `(shopId, processedAt)`, `(shopId, variantGidAtSale, processedAt)`, `(shopId, shopifyGid)`;
- webhook enqueue p95 target already in Phase 1 (<1s durable enqueue);
- do not load all order ids into JS arrays (PR 1 F-N07 lesson);
- bulk groupObjects false;
- query-count assertions in tests.

Monday may query facts with `GROUP BY variantGidAtSale` over a date range. If p95 exceeds 500ms on the envelope, a **rebuildable** daily projection is post-Monday, not a second authority.

---

## 15. Failure / recovery

| Failure | Behavior |
|---|---|
| GraphQL throttle / 5xx / timeout | Retry bounded; not ABSENT; observation abandoned |
| Incomplete pages | Apply not successful |
| Bulk partial | Resume; run not COMPLETE success |
| Decimal parse fail | Fail closed; no Number fallback |
| GID mismatch | Fail closed |
| Currency mismatch | DataIssue; skip bag / fail apply |
| Unit identity `removed_units < 0` | DataIssue; persist Shopify fields |
| DB rollback after Shopify read | Observation not COMPLETED; retry refetch (do not reuse old response as fresh — PR 5 rule) |
| Duplicate delivery | Receipt short-circuit |
| Uninstall / `processingEnabled=false` | Fail closed before merchant DML |
| `read_all_orders` missing for old window | Truncation DataIssue |

Kill switch: existing shop processing flag. No new inventory-write flag.

---

## 16. Monday-critical subset

Do not weaken correctness to hit a calendar date.

### 16.1 MONDAY-CRITICAL (facts only)

Minimum that later Last-X, custom date-range, ABC/U, and low-stock **can** consume without a second ingest:

1. `ShopifyOrderFact` + `ShopifyOrderLineFact` with clocks, money bags, `test`, `processedAt`, `cancelledAt`.
2. `ShopifyOrderRefundFact` + `ShopifyOrderRefundLineFact` with quantities and shop money.
3. Agreement/sale facts **or** a proven alternative that separates refunded vs edit-removed units (if Bulk C/direct agreements fail schema, direct refetch of `edited=true` orders is acceptable).
4. Historical `variantGidAtSale` / snapshots; no catalog FK.
5. Authoritative refetch apply (not webhook math).
6. Historical import for the **accessible** Shopify window + incremental + reconcile.
7. Exact decimal; tenancy/RLS; idempotent apply.
8. `ORDER_HISTORY_WINDOW_TRUNCATED` honesty.

Low-stock **inventory** remains PR 5 `ShopifyInventoryLevelFact.available` (and incoming as its own state; Q-004 still open). PR 6 does not compute reorder points.

### 16.2 POST-MONDAY PARITY

- `orders/updated` subscription;
- shipping-line child table;
- refund shipping lines + duties as first-class facts;
- rebuildable daily projection;
- `read_all_orders` after approval (same-period last year; lookback >60d);
- legacy `SalesDailyAggregate` cutover (Q-PR6-09);
- location-grain sales (Q-PR6-06);
- transaction-success gating of refund money (Q-PR6-07).

### 16.3 LATER COMMERCIAL ENHANCEMENT

- presentment reporting;
- gift-card / tip / custom-item inclusion policies beyond exclusion;
- returns workflow objects beyond refunds;
- customer-level analytics (still no unnecessary PII);
- Smart Forecast inputs.

### 16.4 Explicit non-weakening

If Q-PR6-01 (net-units dating) is unclosed, **do not** ship a labeled Stocky-parity velocity from PR 6. Shipping unlabeled provisional math to merchants is a formula change (forbidden). Facts can still merge.

---

## 17. Implementation lane decomposition

Runtime lanes start **only after** (a) this plan is ChatGPT-accepted and (b) PR 5 implementation is independently reviewed, accepted, merged, and closure-synchronized. Parallel lanes require frozen shared contracts (this document + merged PR6-A schema).

### 17.1 Why not the naive A/B/C/D split unchanged

PR 5 proved: schema/lock foundation must freeze before apply; admin-read can parallel schema if it does not touch Prisma; applicator needs both; webhooks last.

PR6-B does **not** own Prisma. PR6-A and PR6-B may run in parallel after PR 5 closes. PR6-C needs both merged. PR6-D needs C.

### 17.2 Lanes

#### PR6-A — schema / exact-decimal fact foundation

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-a-order-refund-fact-foundation` |
| Objective | Additive Prisma models, migration, RLS/enforcement registration, lock-key module `stocky-pr6-canonical-lock-v1`, observation-in-flight table, known-answer lock vectors |
| File ownership | `prisma/schema.prisma` (order-domain models + Shop relations only), `prisma/migrations/<pr6_order_facts>/`, `app/lib/order-facts/constants.ts`, `app/lib/order-facts/lock-key.ts`, `app/lib/order-facts/advisory-lock.ts`, `scripts/tenant-enforcement/manifest.ts` (additive entries), `app/tenant/models.ts` (additive), enforcement tests `scripts/tenant-enforcement/tests/pr6-*.test.ts` |
| Must not touch | GraphQL documents, webhooks, workers, catalog-facts/admin-read, catalog apply, F2C, forecast/ABC |
| Dependencies | PR 5 closed; this plan accepted |
| Tier | **A** |
| Tests | RLS isolation, shopId immutability, lock known-answers, migration empty+current schema, cross-shop identical GIDs |
| Claude | **Required** (Tier A) |
| Merge order | **1 (parallel with B)** |

#### PR6-B — Admin read / extraction

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-b-order-admin-read` |
| Objective | QUERY-only order/refund/agreement readers, decimal/datetime guards, pagination, bulk inner documents + schema gate, identity cross-checks, mutation AST deny |
| File ownership | `app/lib/order-facts/admin-read/**` only |
| Must not touch | Prisma, migrations, apply, webhooks, catalog-facts files |
| Dependencies | This plan (query shapes); **not** blocked on PR6-A if types stay in admin-read |
| Tier | **A** (identity + money parse) |
| Tests | mutation reject; GID mismatch fail-closed; decimal string; DateTime no Date.parse rewrite; pagination completeness; bulk nesting/schema; refunds array without `first`; MoneyBag mapping |
| Claude | **Required** |
| Merge order | **1 (parallel with A)** |

#### PR6-C — applicator / reconciliation core

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-c-order-fact-applicator` |
| Objective | Pure apply: clocks, upserts, tombstone, unit-identity DataIssue, no Shopify I/O inside apply, no SalesDailyAggregate writes |
| File ownership | `app/lib/order-facts/apply/**`; applicator DB tests |
| Must not touch | admin-read documents, prisma schema, webhook routes, forecast |
| Dependencies | **PR6-A merged** (tables) and **PR6-B merged** (reader result types) |
| Tier | **A** |
| Tests | all §19 apply/clock/money/unit cases including races |
| Claude | **Required** |
| Merge order | **2** |

#### PR6-D — webhook integration / historical import

| Field | Value |
|---|---|
| Branch | `phase-1/pr6-d-order-webhook-import` |
| Objective | Identity sanitizers; `orders/edited` subscription+route; job types; workers calling B then C; bulk import + reconcile jobs; SyncCursor domains |
| File ownership | `app/routes/webhooks.orders.edited.tsx`, `shopify.app.toml` webhook list (additive topic), `app/sync/sanitize.server.ts`, `app/tenant/job-envelope.server.ts`, `app/sync/execution-strategy.server.ts`, `app/jobs/workers/webhook-processor.ts` (canonical path), `app/lib/order-facts/sync/**`, `scripts/sync-control-plane/manifest.ts` |
| Must not touch | apply internals, admin-read documents, prisma schema (unless toml-only) |
| Dependencies | **PR6-C merged** |
| Tier | **A** for webhook/job tenancy; import path is still money/identity |
| Tests | duplicate/out-of-order webhooks, overlap import+webhook, bulk partial, rollback retry, reconcile repairs missed webhook |
| Claude | **Required** |
| Merge order | **3** |

### 17.3 File-ownership conflict watch

`webhook-processor.ts`, `sanitize.server.ts`, `job-envelope.server.ts`, `schema.prisma` are single-writer files. Only the listed lane may edit them. PR 30/31 must not be used as a base.

### 17.4 Smallest parallel graph

```text
PR5 closed
    ├─ PR6-A foundation ──┐
    └─ PR6-B admin-read ──┼─→ PR6-C applicator → PR6-D webhooks/import
```

Two concurrent Cursor lanes at the start (A∥B), then C, then D. Do not open four writers at once.

---

## 18. Acceptance criteria

PR 6 implementation is not complete until all of the following are true. Planning acceptance is weaker: this document is implementation-grade and decision-isolating.

### 18.1 Planning acceptance (this PR)

- [ ] Scope, non-goals, and Shopify source contract are specific enough to implement without rediscovery
- [ ] Schema, clocks, money, identity, webhooks, import, reconcile, tenancy, and lanes are explicit
- [ ] Unresolved product decisions are isolated as Q-PR6-* (not guessed)
- [ ] Monday-critical vs post-Monday vs later is explicit
- [ ] Test matrix is sufficient for Cursor + Claude
- [ ] Diff is docs-only under `stocky-plus/docs/**`
- [ ] No runtime/schema/migration/GraphQL/webhook changes
- [ ] Draft PR open; not marked ready; not merged

### 18.2 Later runtime acceptance (not this PR)

- [ ] Facts reconcile to Shopify-reported GIDs, quantities, and MoneyBag strings
- [ ] No Number/parseFloat on the new path
- [ ] No unnecessary PII
- [ ] Duplicate/out-of-order/missed webhooks cannot corrupt facts
- [ ] Deleted/recreated variants do not merge
- [ ] Cross-shop identical Shopify ids isolated
- [ ] RLS forced on new tables
- [ ] Inventory-write flags remain DEFAULT OFF
- [ ] Exact-head CI on the implementation head
- [ ] Independent Claude review with no open P0/P1
- [ ] ChatGPT acceptance + user merge authorization

---

## 19. Exact test matrix

Do **not** commit expected-failing runtime tests in this planning PR (would force full CI or break main). The matrix is the implementation contract.

Positive / negative / bypass / drift required for each important rule.

| ID | Class | Case | Expected |
|---|---|---|---|
| T01 | + | New order refetch upserts order+lines | LIVE facts; exact decimal strings |
| T02 | − | Mutation document in admin-read | AST reject; no network |
| T03 | bypass | Client shop header sets tenant | Denied |
| T04 | + | Duplicate webhook same delivery | One receipt; one snapshot |
| T05 | + | Duplicate refund GID twice | Idempotent; refunded_units not doubled |
| T06 | + | Partial refund then second refund | Sum of refund line qtys |
| T07 | + | Edit quantity then refund | Agreements + refunds; formula §7.1 |
| T08 | + | Cancel then refund | Both persisted; no double-subtract coercion |
| T09 | − | Stale order refetch older `updatedAt` | No attribute overwrite |
| T10 | + | Newer refetch after stale | Applies |
| T11 | + | Deleted variant `variant=null` | `variantGidAtSale` retained |
| T12 | + | Recreated variant same SKU new GID | Historical line stays on old GID |
| T13 | + | Out-of-order cancelled before create | Refetch wins; no create-required state machine |
| T14 | + | Cross-shop same REST order id | Two rows; RLS isolation |
| T15 | + | Amount `1.234567` | Persisted; not rounded to `1.23` |
| T16 | + | Zero-price line qty 2 | Row kept |
| T17 | + | Test order | `test=true` stored |
| T18 | + | Gift card line | Stored; excluded from variant demand until Q-PR6-08 |
| T19 | + | Large order 300 lines | Complete pagination; no silent 250 cap |
| T20 | − | `refunds(first: 1)` truncation | Forbidden in production reader |
| T21 | + | Bulk JSONL two-phase | Resume after injected failure |
| T22 | − | Bulk incomplete marked success | Fail |
| T23 | + | Retry after DB rollback | Fresh refetch; no stale observation COMPLETE |
| T24 | + | Reconcile inserts missed order | Healed |
| T25 | + | Overlapping observation LIVE vs ABSENT | Conflict diagnostic; no last-writer-wins |
| T26 | bypass | `parseFloat` on apply path | Static/unit fail |
| T27 | + | Presentment EUR / shop USD | Both stored; no FX conversion |
| T28 | − | Sum mixed shop currencies in helper | Reject |
| T29 | + | `removed_units < 0` | DataIssue |
| T30 | + | Money via Number in fixture input | Reader reject |
| T31 | drift | Fence vs later direct refetch | Direct wins per PR 5 fence rule |
| T32 | + | Identity sanitizer drops email/address | Not in projection |
| T33 | − | Webhook body applied as quantity delta | Forbidden on canonical path |
| T34 | + | 60-day truncation | `ORDER_HISTORY_WINDOW_TRUNCATED` |
| T35 | + | Advisory lock before first insert | No duplicate first-apply race |
| T36 | + | Refund transaction pending | Facts stored; money policy gated by Q-PR6-07 |
| T37 | + | `orders/edited` signal refetches order | Snapshot matches Admin |
| T38 | bypass | Raw SQL shopId reassignment | Denied |
| T39 | + | Pagination boundary exactly one extra page | All lines present |
| T40 | + | BOM `processBomSale` not invoked on canonical path | No component phantom units |

Known-answer money vectors (planning fixtures; not executable in this PR):

```text
shopMoney.amount = "19.99" → NUMERIC 19.99 USD
shopMoney.amount = "0.123456" → NUMERIC 0.123456 (no 2dp round)
presentmentMoney.amount = "18.50" EUR + shop 20.00 USD → two columns; no convert
line originalTotal 10.00 qty 2 refund 1 × 5.00 → persist; do not compute JS 10-5 in Number
```

---

## 20. Unresolved product-owner decisions

Implementation may persist facts without these. It may **not** label derived forecast/ABC inputs as Stocky parity until the relevant items close.

| ID | Decision | Why it cannot be guessed | Blocks |
|---|---|---|---|
| **Q-PR6-01** | Dated net-units policy (`order-date-v1` vs `event-date-v1`) and which timestamp (`processedAt` vs `createdAt`) | PRD gives `net_units_sold` but not Shopify edit/refund dating | Last-X / custom range **label** |
| **Q-PR6-02** | Multi-currency ABC: shop-only vs exclude non-shop-currency orders vs FX (FX almost certainly forbidden) | No product rule | ABC revenue |
| **Q-PR6-03** | Calendar-day timezone: Shop IANA timezone vs UTC vs shipping destination | Engineering rule says apply timezone at boundaries; Shop row has no timezone yet | sample_calendar_days / eight-week ABC window |
| **Q-PR6-04** | Definition of net sales / ABC revenue: which MoneyBag (before tax? after discounts? include shipping?) | PRD says “revenue” only | ABC / worksheet revenue |
| **Q-PR6-05** | Include or exclude `Order.test=true` | Official test-order field exists; product silent | All metrics |
| **Q-PR6-06** | Location-grain sales identity | LineItem has no stable sale location in 2026-07 GraphQL | Per-location Last-X |
| **Q-PR6-07** | Whether refund money counts only when related `OrderTransaction.status` is SUCCESS | Official refund caveat | Net sales money |
| **Q-PR6-08** | Gift cards, tips, custom items in units/revenue | Stored as lines; product silent | Demand |
| **Q-PR6-09** | When to stop legacy `SalesDailyAggregate` webhook writes | Dual-write preserves R-014 on legacy path | Cutover |
| **Q-PR6-10** | Request/grant `read_all_orders` | Official 60-day cap | History >60d / last year |
| **Q-PR6-11** | Whether cancelled unpaid orders contribute `ordered_units` then cancel vs never sold | Status vs units | Net units |
| **Q-PR6-12** | BOM component explosion | Legacy `processBomSale` is not product law; variant identity is | Units |

Q-004 (incoming inventory forecast mix) remains **OPEN** and **out of PR 6**.

---

## 21. Risk-register impacts

This planning PR must **not** edit `RISK_REGISTER.md` (out of allowed path). ChatGPT should record after acceptance:

| Risk | Disposition |
|---|---|
| **R-014** | Remains **OPEN**. This plan is the architecture to close it on the **new** fact path. Legacy webhook `parseFloat` remains until Q-PR6-09. |
| **R-139** | Catalog money; not closed by PR 6 planning. |
| **R-010 / R-136** | Analog for order line pagination — new **R-PR6-01** proposed: silent line/refund truncation. |
| **R-016** | Codegen still network-dependent when PR6-B adds documents. |
| **R-160 / R-161** | Reuse lock-before-insert and capacity evidence; do not assume catalog lock version covers orders. |
| **Proposed R-PR6-02** | 60-day order window silently treated as complete lookback. |
| **Proposed R-PR6-03** | Net-units policy invented in code before Q-PR6-01. |
| **Proposed R-PR6-04** | Location `default` carried from legacy aggregates. |
| **Proposed R-PR6-05** | Webhook REST payload used as quantity ledger. |
| **Proposed R-PR6-06** | FK from order lines to current variant facts losing deleted-variant history. |
| **Proposed R-PR6-07** | Mixing shop and presentment money in ABC. |
| **Proposed R-PR6-08** | `orders/edited` not subscribed and reconcile too slow, leaving Last-X stale (operational, not correctness if reconcile exists). |
| **Proposed R-PR6-09** | PR 30/31 conflicted applicator copied incorrectly into order apply (clock collapse). |
| **Proposed R-PR6-10** | Bulk nesting invalid document submitted without schema gate. |

Do not close R-014 by planning approval.

---

## 22. Estimated critical-path ordering — not calendar promises

Operational target (Monday 2026-09-07) is **not** a commitment and does not override gates.

Dependency order only:

1. ChatGPT accepts this planning packet (this PR). Isolated Q-PR6-* answers should land before metric labeling; they are **not** required to start PR6-A/B fact storage.
2. PR 5 remaining runtime lanes (`#31` F2B, `#30` F2C, and any F3) independently reviewed, accepted, merged, closure-synced. **PR 6 runtime cannot start before this.** PR 30/31 are currently CONFLICTING with main.
3. **PR6-A ∥ PR6-B** (exclusive file ownership).
4. **PR6-C** after A+B merge.
5. **PR6-D** after C merge (`orders/edited` + import + reconcile).
6. Independent Claude review per Tier A lane; ChatGPT acceptance; user merge authorization each lane.
7. Phase 2 forecast/ABC consumers remain a **later** phase even if Monday wants them — they consume PR 6 facts; they are not PR 6.

Critical path is PR5 close → A∥B → C → D. Skipping C (apply) or reconciliation is not a faster safe path.

If PR 5 close slips, this packet still stands; runtime wait is unchanged.

---

## 23. Current legacy anti-pattern (do not copy)

`app/jobs/workers/webhook-processor.ts` `handleOrderCreate` / `handleOrderCancelled` / `handleRefundCreate`:

- treats webhook line_items as complete truth;
- `parseFloat(item.price) * quantity` (R-014);
- buckets to **local** `startOfDay(new Date())`, not Shopify `processedAt`;
- forces `locationId = "default"`;
- increments daily aggregates (duplicate webhooks were a historical P1 before receipts);
- explodes BOM via `processBomSale`.

`app/services/forecasting.server.ts` / `runAbcAnalysis` read `SalesDailyAggregate` and use `Number(revenue)` with a **90-day** window, not the PRD **eight weeks**. That is Phase 2 debt, not a PR 6 formula.

PR 6 facts replace the **source**. They do not rewrite forecast in this phase.

---

## 24. PR 30 / PR 31 interface notes (read-only)

Inspected 2026-09-02; **not modified**.

| PR | Lane | Interface PR 6 should reuse conceptually |
|---|---|---|
| `#31` F2B | `app/lib/catalog-facts/apply/**` | Clock A/B/C, observation evidence, money reject Number, first-insert lock |
| `#30` F2C | `app/lib/catalog-facts/compatibility-projection/**` | Rebuildable projection **after** canonical commit; never HEALTHY-by-assertion over broken facts |

PR 6 must **not** import catalog apply writers or write `SalesDailyAggregate`. Copy **contracts** from the PR 5 brief (merged) rather than from conflicted branch heads.

F2A on main (`app/lib/catalog-facts/admin-read/**`) is the read-boundary pattern to mirror under `order-facts/admin-read`.

---

## 25. Evidence of planning work

### 25.1 Repository files inspected

- `AGENTS.md`, `stocky-plus/docs/README.md`, `PROJECT_STATUS.md`, product `00`–`06`, `09`–`11`
- `phases/README.md`, `PHASE_BRIEF.md`, `PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md` (clocks/apply)
- `DECISIONS.md` (D-021, D-053, D-054), `OPEN_QUESTIONS.md` (Q-004), `RISK_REGISTER.md` (R-014)
- `prisma/schema.prisma` (Shop, SalesDailyAggregate, catalog facts, SyncCursor, receipts)
- webhook routes, `sanitize.server.ts`, `webhook-processor.ts`, `execution-strategy.server.ts`, `job-envelope.server.ts`
- `forecasting.server.ts`, F2A `documents.ts` / `decimal.ts` / `execute.ts` / `bulk-query-documents.ts`
- `lock-key.ts`, `constants.ts`, `app/tenant/models.ts`
- `shopify.app.toml` scopes/topics
- Git log on webhook processor / schema; `gh pr view` 30/31

### 25.2 Commands executed

```text
git fetch origin main
git rev-parse origin/main
# → f65ab4b906f53b3a1c72cdd7b29cdc0cbde6a7d7
gh pr view 30 / 31
```

### 25.3 Not executed

- PR 6 runtime, migrations, GraphQL documents, tests
- production Shopify / merchant data
- Partner Dashboard `read_all_orders` request

---

## 26. Stop condition

This packet is implementation-grade when ChatGPT can authorize PR6-A∥PR6-B without another architecture PR, Monday-critical facts are explicit, Q-PR6-* are isolated, lanes/tests are concrete, and this planning PR is open with docs-only CI.

**PR 6 runtime remains unauthorized.**
