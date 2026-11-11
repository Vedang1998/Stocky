# Replenishment: Stocky Parity engine

Status: engine, stock health and planning inputs implemented on branch
`replenishment/parity-engine`. The worksheet and settings screens that use
them follow in the next change.

Source of the formulas: [PRD §3.4](../product/02_FULL_STOCKY_PARITY_PRD.md).
Code: `app/lib/replenishment/`.

## What a suggestion is

One pure function, `computeSuggestion`, turns a method, a sales window and
one variant's numbers into a quantity, the steps that produced it and any
warnings. It does no I/O and has no clock, so the same inputs always give the
same answer.

| Method                        | Need before rounding up                                       |
| ----------------------------- | ------------------------------------------------------------- |
| Last X days                   | `net units ÷ sample days × suggest days − stock`              |
| Custom range                  | same, over the chosen dates                                   |
| Same period last year         | `last year's net units for the window − stock` (not rescaled) |
| Fill shelves                  | `shelf limit − stock`                                         |
| Fill shelves if below minimum | `shelf limit − stock`, only when `stock < minimum`            |
| Target stock level            | `target − stock`                                              |

`stock` is available plus incoming. The suggestion is the need rounded up to a
whole unit, never below zero.

Arithmetic is exact (integer fractions) until the final round-up, so
`1 ÷ 3 × 3` is 1 and not 0.9999. Displayed velocities and forecasts are
rounded for reading only.

### Sales windows

- **Last X days** is the X complete days ending yesterday in the shop's
  timezone. Today is left out because a part day understates the daily rate.
- **Custom range** is inclusive at both ends and cannot end in the future.
- **Same period last year** starts one year before today and runs for the
  suggest period. 29 February maps to 28 February.

### When there is no suggestion

The engine returns no quantity, with the reason, when:

- Shopify isn't tracking the variant's inventory;
- available stock is unknown;
- a sales method has no stored order history for its window. Missing history
  is never treated as zero sales;
- a stock-level method is missing its shelf limit or minimum.

Partly covered history, unknown incoming stock (counted as 0), negative
available stock, more returns than sales, and untrusted unit records each
produce a quantity with a warning.

### Supplier minimum order and pack size

Off unless the merchant turns them on for a run. When on, the minimum order
quantity applies first and pack rounding second. The unrounded parity quantity
is always kept and shown beside the adjusted one. A zero suggestion is never
raised to a minimum order.

The existing Buying Table used to force both rules on every draft purchase
order. It now orders the quantities entered and applies a rule only when its
box is ticked on that order.

## Stock health

`computeStockHealth` gives days of stock, the expected sell-out date, the
reorder point and whether a variant is low.

- Days of stock = `available ÷ units per day`. No sales means no sell-out date.
- Reorder point = the merchant's manual value when set, otherwise
  `units per day × lead time + safety stock`, rounded up. Safety stock is zero
  unless set. Without a lead time there is no automatic reorder point.
- Low when `available + incoming` is at or below a reorder point above zero,
  or below the variant's minimum.
- Lead time comes from the first of: the variant's rule, the supplier's value
  for that variant, the supplier's default, the shop default.

## Planning inputs

Two tenant-owned tables, both under row-level security:

- `ReplenishmentSettings`: one row per shop with the method, periods, incoming
  source, default lead time and rounding switches a new worksheet opens with.
  A shop with no row gets last 30 days, suggest 30 days, Shopify incoming, no
  lead time, rounding off.
- `ReplenishmentVariantRule`: minimum, shelf limit, manual reorder point,
  safety stock and lead time for one variant in one stock scope. The scope is
  either the whole shop or one location. Quantities never carry from one scope
  to another. Lead time alone falls back from a location to the shop.

Database checks mirror the form limits, so a bad value cannot be stored by any
code path.

## Decisions made here that the owner should confirm

These were open in `OPEN_QUESTIONS.md` or unspecified in the PRD. Each is
isolated so changing it is a small edit.

1. **Incoming stock (Q-004).** The merchant chooses one source per run:
   Shopify's incoming quantity (default), open purchase orders in this app, or
   none. The two sources are never added together, because a purchase order
   pushed to Shopify would be counted twice.
2. **Demand is shop-wide (Q-014).** Sales are not attributed to a location.
   The chosen location only decides whose stock is subtracted.
3. **Last X days excludes today.**
4. **Reorder point and low-stock rule** as written above. Shopify's help page
   for Stocky's low-stock report could not be retrieved, so this follows the
   PRD wording and standard practice rather than a confirmed Stocky formula.
5. **No history means no suggestion**, not zero.

Net units sold (returns, cancellations, test orders, gift cards) are defined
and computed by the reporting module in `app/lib/analytics/`. This engine
takes that number as an input and does not recount it.

## Not done yet

- Worksheet, settings and low-stock screens.
- Purchase-order draft creation from a worksheet (uses the purchase order
  module's API).
- Smart Forecast. Nothing here calls a model or changes parity results.
- End-to-end run on the development store.
