# Replenishment: the worksheet

The worksheet is where a merchant turns Stocky Parity suggestions into
purchase orders. The formulas are in [PARITY_ENGINE.md](PARITY_ENGINE.md);
this page covers what is stored, what can be changed and how orders are
created.

Code: `app/lib/replenishment/worksheet/`, screens in
`app/routes/app.replenishment*.tsx` and `app/components/replenishment/`.

## A worksheet is a snapshot

Generating a worksheet runs the engine once for every selected variant and
stores the result: the stock position, the sales figures, the supplier terms,
the calculation steps and the suggestion. Nothing on a saved worksheet is
recalculated when it is opened, so a merchant who comes back to it tomorrow
sees the numbers they were looking at today. Generating again is how changes
in stock, sales or supplier terms are picked up.

The setup page chooses:

- the forecast method and its periods;
- the stock scope: all locations together, or one location;
- which incoming stock counts (Shopify's, this app's open purchase orders, or
  none);
- the products: all of them, or one vendor, product type or supplier;
- the two supplier rules, minimum order quantity and pack rounding. Both are
  off unless ticked for that run. When a rule changes a quantity the row keeps
  the quantity from before the rule and shows both.

Archived products are left out. A worksheet holds up to 5,000 variants; a
larger selection is refused with a message asking for a narrower one, never
cut short. The 20 most recent worksheets are kept per shop.

`ReplenishmentWorksheet` and `ReplenishmentWorksheetLine` are tenant-owned
tables under row-level security, like every other merchant table.

## Looking at a worksheet

Filter, search, sort and page are part of the URL and run in SQL, so a
worksheet of thousands of rows is never loaded whole and the CSV export
returns exactly the view on screen. Filters: all variants, to order, low or
out of stock, with warnings, edited. Search matches product, variant, SKU,
barcode and supplier SKU.

Every row opens to show the calculation step by step, the warnings, the stock
and sales facts behind it, price, cost and margin, and each supplier's terms.

## What can be changed

Only the quantity to order. The suggestion stays beside it and one click
restores it. Rows already on a purchase order are locked.

A row can also be recalculated under another method or period without
changing the worksheet. The result can be taken as that row's quantity; the
worksheet's own suggestion is left as it was.

## Settings and planning levels

The settings page stores what a new worksheet opens with: the method, its
periods, which incoming stock counts, the two supplier rules and a default
lead time. A custom date range cannot be a default because it needs dates.
Saving settings changes no existing worksheet.

A variant's minimum, shelf limit, reorder point, safety stock and lead time
are edited from the row's detail, for the stock the worksheet plans: all
locations together, or its one location. The form reads the stored levels
when it opens, since the worksheet only has the levels it was generated with.
Saving them does not change the open worksheet either; the next one uses
them.

## Creating purchase orders

Rows with a quantity to order and one supplier are grouped by supplier. Each
group becomes one draft purchase order, or several when it has more rows than
one order holds. Drafts are created by the purchasing module, which prices
each line at the supplier's price for its quantity. Nothing is sent to a
supplier from here.

A row with no supplier, or with several and none preferred, cannot be ordered
from the worksheet. The page says how many such rows there are.

Creation is safe to repeat. Each order is identified by a key made from the
worksheet, the supplier, the destination and the exact rows and quantities,
so a second attempt after a failure gets the same draft back instead of a
duplicate. A row is linked to its order only while it still shows the
quantity that went on the order; if it was edited in between, it stays open
and the page says so.

A worksheet for one location delivers there. A worksheet for all locations
asks which location the orders are for.

On a plan with a monthly purchase-order limit, the orders a request would
create are counted against it first and the request is refused whole if they
do not fit.

## Access

Both screens and the export need the `core.replenishment` capability, which
every paid plan includes. Creating orders goes through the purchasing
module's own permission check.

## Decisions made here that the owner should confirm

1. **Snapshot, not live.** A saved worksheet never changes by itself.
2. **Only the order quantity is editable.** Stock, sales and supplier terms
   are corrected where they live, then the worksheet is generated again.
3. **5,000 variants per worksheet and 20 worksheets kept.**
4. **One supplier per row.** A variant with several suppliers and no
   preferred one is not ordered until a supplier is chosen for it.

## Not done yet

- Setting planning levels for many variants at once.
- Choosing a supplier for one row on the worksheet.
- End-to-end run on the development store.
