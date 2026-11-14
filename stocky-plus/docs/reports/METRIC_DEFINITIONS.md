# Report metric definitions

This document is the reference for every number a ProPo report or CSV export
shows. Each metric names its source facts, its formula, the policy version it
was computed under, and what it deliberately leaves out. The code lives in
`app/lib/analytics/`; a report must not compute these values any other way.

All arithmetic is deterministic. Money and shares use `Prisma.Decimal`; units
are integers. No LLM takes part in any calculation.

## 1. Ground rules

| Rule | Detail |
| --- | --- |
| Data authority | Shopify is authoritative. Reports read the canonical catalog facts (PR5) and order facts (PR6) that sync maintains. Only `LIVE` facts are read. |
| Tenant isolation | Every read goes through `TenantDb`, on the restricted runtime role under FORCE RLS. |
| Time zone | Days are shop-local calendar days in `Shop.ianaTimezone`. A report fails closed with a "data not ready" state when the time zone is missing or invalid. It never falls back to UTC or the server zone. |
| Day boundaries | A local day runs from its first instant to the first instant of the next day, so a daylight-saving day is 23 or 25 hours long. |
| Currency | Money is reported in the shop currency (`Shop.currencyCode`). Amounts in any other currency are never converted and never summed in. |
| Grain | Sales metrics are shop-wide per variant. Shopify exposes no stable per-line sale location, so no per-location sales figure is derived (Q-014). |
| Freshness | Each result carries `coverage` (what the stored history can speak for, and the most recent Shopify order change it reflects) and `diagnostics` (what was excluded and why). Reports must show both. |

## 2. Net units — `net-units-order-date-v1`

Source: `ShopifyOrderAgreementSaleFact`, the sole unit-event ledger, joined to
its agreement, order and line facts. Implements PR6 plan §7.1–7.2. A fact that
Shopify no longer reports (`ABSENT`) is never read, at any level.

A sale counts when it is a `ProductSale` with line type `PRODUCT`, a line item
and a non-null quantity. Each counted sale becomes one dated unit event:

| Sale | Event | Dated by | Units |
| --- | --- | --- | --- |
| `ORDER` action on the order's `ORDER` agreement | `ORDERED` | order `processedAt` | +quantity |
| `ORDER` action on a later agreement (edit, exchange) | `ADDED` | agreement `happenedAt` | +quantity |
| `RETURN` action, agreement reason `REFUND` or `RETURN` | `REFUNDED` | order `processedAt` | −quantity |
| `RETURN` action, agreement reason `ORDER_EDIT` | `REMOVED` | order `processedAt` | −quantity |
| `RETURN` action, any other reason | `RETURNED_UNCLASSIFIED` | order `processedAt` | −quantity |
| `UPDATE` action | none | | 0 |
| `UNKNOWN` action or null quantity | none, counted in diagnostics | | 0 |
| Any action outside `ORDER`, `RETURN`, `UPDATE`, `UNKNOWN` | the whole order is excluded | | 0 |

`net units = ordered + added − refunded − removed − returned unclassified`

Refunds and removals are restated to the original order's date, so a refund
issued next month lowers the day the order was placed, not the day of the
refund. Units added later count on the day they were added.

Excluded entirely:

- test orders;
- gift-card lines and custom lines with no variant;
- orders with no `processedAt`;
- any order where an eligible sale's sign contradicts its action (an `ORDER`
  with a negative quantity or a `RETURN` with a positive one), or whose action
  Shopify has not defined. The whole order is dropped, because none of its
  magnitudes can be trusted. This is the same rule the order-facts applicator
  uses when it stamps `UNIT_SALE_SIGN_INCONSISTENT`, and a stored stamp on the
  order or any of its lines excludes the order too.

A sale whose line or agreement fact is missing is skipped and counted in
diagnostics.

## 3. Cancelled orders — `cancelled-orders-excluded-v1` (provisional)

An order with `cancelledAt` set contributes no units and no revenue, on any
date. Rationale: a cancelled order was not fulfilled demand, and Stocky's
sales reports follow Shopify's net-sales view.

This answers Q-015 provisionally. It was decided under the owner's 2026-11-10
delegation and is a named, versioned policy so it can be replaced without
touching any consumer.

## 4. Net revenue — `net-revenue-unit-price-v1` (provisional)

`event revenue = event units × line unit price after all discounts`

The unit price is the line's `discountedUnitPriceAfterAllDiscountsSet` in shop
money. Refunds and removals therefore reverse revenue at the price the units
actually sold for.

- Includes: line-level and order-level discounts.
- Excludes: shipping, duties, tips, and order-level adjustments that are not
  discounts.
- Tax: the unit price is what Shopify reports for the line. On a shop whose
  prices include tax, it includes tax.
- Shopify documents this unit price as approximate (it is rounded per unit),
  so revenue can differ from Shopify's order total by rounding.
- A line whose price currency differs from the shop currency, or whose price
  is missing, keeps its units and contributes no revenue. Those events are
  counted in `eventsWithoutRevenue`.

This answers Q-012 and Q-013 provisionally, on the same terms as §3. It does
not read `priceAfterAllDiscountsBeforeTaxesSet` and does not derive a unit
price by division (PO-11).

## 5. Coverage

`historyStartLocalDate` is the first shop-local day the stored facts can speak
for: the earlier of the first stored non-test order and the start of the order
history window at install (60 days before `Shop.createdAt`).

`startsBeforeCoverage` is true when a report's range begins before that day.
The report must then say the early part of the range is incomplete rather than
present it as zero sales.

## 6. ABC/U classification — `stocky-abc-parity-v1`

Matches Stocky's variant-level ABC analysis (PRD §3.5).

- Window: the 56 shop-local days ending on the as-of date. The default as-of
  date is the last complete local day.
- Input: each current catalog variant's net revenue (§4) and net units (§2)
  inside the window.
- Rank: net revenue descending, then net units descending, then variant GID.
- Classes, by cumulative share of classified revenue:
  - **A** — variants up to and including the one that reaches or crosses 80%.
  - **B** — variants after that, up to and including the one that reaches or
    crosses 95%.
  - **C** — the rest, including every variant with zero or negative revenue.
- A variant that crosses a boundary stays in the earlier class. A variant that
  alone exceeds 80% is still A.
- **U** (unclassified) — fewer than eight weeks of eligible data:
  - `shop_history_short`: stored history starts inside the window. Every
    variant is U.
  - `variant_too_new`: the variant was created in Shopify inside the window.
  - `variant_age_unknown`: Shopify gave no creation date.
- U variants take no share: their revenue is left out of the classified total.
- Revenue from variants that are no longer in the catalog is reported
  separately as `revenueOutsideCatalog` and is not classified.

Worked example, classified revenue 100:

| Variant | Revenue | Cumulative before | Cumulative after | Class |
| --- | --- | --- | --- | --- |
| 1 | 50 | 0% | 50% | A |
| 2 | 30 | 50% | 80% | A |
| 3 | 10 | 80% | 90% | B |
| 4 | 5 | 90% | 95% | B |
| 5 | 5 | 95% | 100% | C |

## 7. Catalog attributes

Reports label variants from the current catalog facts: product title, variant
title, SKU, barcode, vendor, product type, status, price, and the Shopify unit
cost with its access state. A variant whose product is not `LIVE` is not part
of the current catalog. Unit cost is Shopify's `InventoryItem.unitCost`; when
Shopify withholds it, the access state says so and no cost is assumed.

## 8. Rounding and display

Values are kept at full precision through every sum. Rounding happens once, at
display or export, half away from zero, to the currency's ISO 4217 minor unit
(2 places for USD, 0 for JPY, 3 for KWD). Percentages round to two places and
are blank when the denominator is zero.

## 9. Reports

The reports live in `app/lib/reports/`. `registry.server.ts` lists them and is
the only way a route runs one, so a report's page and its CSV download are the
same computation. Each report defines typed columns; the columns drive the
table, sorting, filtering, the totals and the export.

| Report | Rows | Period | Source |
| --- | --- | --- | --- |
| Best and worst sellers | Variant | Date range | Unit events (§2), net revenue (§4) |
| Sales by variant | Variant | Date range | Unit events, net revenue |
| Sales by product | Product | Date range | Unit events, net revenue |
| Sale items | Unit event | Date range | Unit events, net revenue |
| Orders | Order | Date range | Unit events, net revenue |
| Sales statistics | Shop-local day | Date range | Unit events, net revenue |
| Gross profit | Variant | Date range | Unit events, net revenue, current unit cost (§7) |
| ABC analysis | Catalog variant | Last 56 complete days | ABC/U (§6) |
| Stock on hand | Variant and location | Now | Inventory level facts, catalog (§7) |
| Dead stock | Variant | Now, against a chosen number of days | Inventory level facts, order line facts |
| Transfers | Transfer line | Date range, by creation day | `TransferOrder`, `TransferLineItem` |
| Stocktake variances | Stocktake line | Date range, by completion day | `Stocktake`, `StocktakeLineItem`, current unit cost |
| Inventory adjustments | Applied ledger line | Date range, by the day the change was made | `InventoryOperation`, `InventoryOperationLine`, current unit cost |

### 9.1 Date ranges

A date range is a pair of inclusive shop-local days. The presets "Last 7, 30,
90 and 365 days" end yesterday, so they hold complete days only. "Today" and
"Month to date" include today and so change during the day. A custom range may
span at most 366 days; a longer one is cut to its most recent 366 days and the
page says so. An unusable range falls back to the last 30 days with a message.
The default is the last 30 days, except for Transfers, Stocktake variances and
Inventory adjustments, which open on Month to date so that records made today
are listed.

### 9.2 Sales reports

| Figure | Definition |
| --- | --- |
| Ordered | Units on orders placed in the range (`ORDERED` events). |
| Added | Units added by a later edit or exchange, on the day they were added (`ADDED`). |
| Returned | Units refunded, returned or removed by an edit, counted on the order's day (`REFUNDED`, `REMOVED`, `RETURNED_UNCLASSIFIED`). |
| Net units | Ordered + added − returned. |
| Net revenue | Sum of event revenue under `net-revenue-unit-price-v1`. |
| Share of revenue | Row net revenue ÷ the net revenue of all rows with positive revenue. Blank for a row without positive revenue. |
| Average price | Net revenue ÷ net units. Blank when net units are zero or any of the row's events has no revenue. |
| Orders (variant, product rows) | Orders in which the row's net units are above zero. |
| Orders (statistics) | Orders placed that day with at least one `ORDERED` event. An order that was later fully refunded still counts: it was placed. |
| Average order value | Net revenue ÷ orders, for the day or the range. |
| Return rate | Units returned ÷ units sold (ordered + added). |
| Units per order | Net units ÷ orders. |

The worst-sellers view adds every variant of an `ACTIVE` product that has no
event in the range, with zero units and revenue.

A variant that is no longer in the catalog is named from the most recent order
line that sold it. Sale items always show the product, variant, SKU and vendor
recorded on the order line, which can differ from the catalog today.

The Orders report lists product units and product revenue only. It is not the
order total: shipping, duties, tips and order-level adjustments are not in it.
No customer data is read or shown.

### 9.3 Stock on hand

One row per tracked catalog variant and location with an active inventory
level. Untracked variants and levels whose inventory item has no catalog
variant are not listed.

| Figure | Definition |
| --- | --- |
| Available, on hand, committed, incoming | Shopify's inventory quantities of those names, as last synced. A quantity Shopify has not reported is blank, not zero. |
| Cost per item | Shopify `InventoryItem.unitCost`, only when it is in the shop currency. It is not a landed or moving-average cost. |
| Cost value | On hand × cost per item. Blank when there is no cost in the shop currency. A negative on-hand quantity is valued at zero. |
| Price | The variant's current price, only when it is in the shop currency. |
| Retail value | On hand × price. A negative on-hand quantity is valued at zero. |

Totals leave out rows whose value is blank, and the page says how many variants
with stock have no cost. "Variants with stock" lists rows whose on-hand
quantity is not zero, so negative quantities stay visible.

### 9.4 Dead stock

A variant is dead stock when its on-hand quantity across all locations is above
zero and its most recent order is at least N days old, or it has never been
ordered. N is 30, 60, 90 (default), 180 or 365.

- The most recent order is the latest `processedAt` of a `LIVE` order line for
  the variant on an order that is not a test, not cancelled and not deleted.
  Refunds and edits do not move it.
- A variant created less than N days ago is left out. A variant with no
  creation date is kept.
- When the stored order history starts less than N days ago, the page warns
  that a variant may have sold inside the period before the history begins.

### 9.5 Gross profit

Shopify stores one cost per inventory item and no history of it. Gross profit
is therefore an estimate, and the report labels it as one.

```
estimated cost of goods = net units × current unit cost
estimated gross profit  = net revenue − estimated cost of goods
margin                  = estimated gross profit ÷ net revenue
```

- The unit cost is the variant's current Shopify cost (§7), used only when it
  is in the shop currency. A variant with no cost, a cost in another currency,
  or no longer in the catalog has a blank cost, profit and margin.
- Profit is also blank when any of the variant's sales in the range has no
  price in the shop currency, because its revenue is incomplete. The cost is
  still shown.
- Margin is blank when net revenue is zero.
- The profit and margin totals cover only the variants with a profit figure and
  say how many of the rows on screen that is. The margin total divides by the
  revenue of those same variants, not by all revenue.
- Nothing but the cost of goods is subtracted. Where prices include tax, net
  revenue (§4) includes that tax and so does the profit.

### 9.6 Transfers

One row per line of every transfer created in the range, whatever its status.
These are the app's own transfer documents; a transfer made directly in
Shopify is not listed.

- **Requested** is the line's quantity.
- **Shipped** is the picked quantity, or the requested quantity when nothing
  was picked. It is blank until the transfer is in transit or received.
- **Received** is the line's received quantity, blank until the transfer is
  received.
- **In transit** is the shipped quantity of a transfer that is in transit, and
  zero otherwise.

Created, shipped and received dates are shop-local days.

### 9.7 Stocktake variances

One row per counted line of every stocktake completed in the range. Stocktakes
in progress or cancelled are not included, and a line with no count is left out
and counted in a notice.

```
variance       = counted − expected
variance value = variance × current unit cost
```

Expected is the quantity the app recorded for the item when it was added to the
stocktake. The value uses the current Shopify cost in the shop currency and is
blank without one. By default only lines with a variance are listed; the report
can show every counted line.

### 9.8 Inventory adjustments

One row per line of an inventory write that this app sent and Shopify accepted
(`InventoryOperationLine.status = APPLIED`), for operations created in the
range. A line that failed, conflicted or has not been sent yet changed no stock
and is not listed. Changes made in Shopify itself or by another app never pass
through the ledger and are not listed either.

- Type is the operation kind: adjustment, stocktake, purchase order receipt,
  transfer or reversal. A transfer appears as one operation when it ships
  (units removed at the source) and another when it is received (units added
  at the destination).
- Reason and quantity are Shopify's own codes, shown in the wording of the
  Shopify admin. A code without a known label is shown as received.
- **Value of change** is the change × current unit cost, for changes to the
  `available` quantity only. Moving units into `damaged`, `quality_control` or
  `safety_stock` is not valued.
- **Made by** is the staff member's display name recorded with the operation,
  or "Automatic" for a change made by the system.

### 9.9 Totals, filters and export

Totals are computed from the rows left after filters and search, across every
page, never from the page on screen. Sorting puts blank values last in both
directions and breaks ties by row identity, so paging is stable.

A CSV download holds every filtered row in the on-screen order, up to 50,000
rows; the page says when a download was cut short. Money is written as a plain
decimal in the currency named in the column header, percentages as a number
with "(%)" in the header, and a missing value as an empty cell. All cells go
through the shared encoder in `app/lib/csv.server.ts`, which neutralizes
spreadsheet formulas.

### 9.10 Known limits

- A report is computed on request and held in memory for that request. Shops
  with very large catalogs or order volumes will need persisted daily
  aggregates before the 366-day range is comfortable.
- Stock on hand is current only. A report of stock on a past date needs daily
  snapshots, which are not stored yet.
- Every cost-based figure (stock value, gross profit, variance value, value of
  an inventory change) uses the current Shopify cost per item, not the cost on
  the day of the sale, count or change.
- Purchase order and supplier reports are not built yet.
