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
