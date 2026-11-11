# Purchasing ledger

How suppliers and purchase orders are stored, priced and moved through their
lifecycle. Code lives in `app/lib/purchasing` (pure rules and arithmetic) and
`app/services/purchasing` (database commands and read models). Routes call the
services; they do not write purchasing tables themselves.

Stock reaches Shopify only through the inventory operation ledger
(`docs/phases/phase-5/INVENTORY_WRITE_LEDGER.md`), behind the receipt-write
kill switch `FEATURE_RECEIPT_WRITES`, which is off by default.

## Records

| Record | Purpose |
| --- | --- |
| `Supplier` | Profile, default terms (currency, payment and shipping terms, tax rate, lead time), `ACTIVE` or `ARCHIVED`. |
| `SupplierSkuMapping` | One supplier's terms for one variant: supplier SKU, cost, minimum order quantity, pack size, order unit, lead-time override, preferred flag. Unique per shop, supplier and variant. |
| `VolumePriceTier` | Quantity-break cost for a supplier and variant. Ranges for the same supplier and variant never overlap. |
| `PurchaseOrder` | Header, lifecycle status, `version`, per-shop number. |
| `POLineItem` | Ordered, received and cancelled quantities, unit cost, discount and tax percent, and a snapshot of the product (titles, SKU, barcode, weight, retail price) taken when the line is added. |
| `PurchaseOrderCharge` | Header charge: shipping, duty, fee, discount or other, with an `allocate` flag. |
| `PurchaseOrderReceipt` | One delivery received against a purchase order: number within the order, destination, who received it, status, and the inventory operations that carried it and its reversal. |
| `PurchaseOrderReceiptLine` | Per purchase-order line on that delivery: accepted and rejected units, the units Shopify confirmed (`postedQty`), and the units reversed. |
| `PurchasingEvent` | Append-only history, keyed by subject id with no foreign key, so the history of a deleted draft survives. |

Product snapshots mean a purchase order stays readable after the product is
renamed or deleted in Shopify.

## Creating a purchase order

`createPurchaseOrderDraft` is the only creation path. A purchase order typed in
by hand, one built from replenishment suggestions and a duplicate all go
through the same pricing and allocation code.

- **Number.** `PO-<sequence>`, per shop, starting at `PO-1001`. The sequence is
  the highest existing one plus one; a unique index rejects a collision and the
  whole transaction is retried. A deleted draft's number can be issued again,
  because a draft has never been sent to a supplier.
- **Creation key.** A caller that may retry (replenishment, imports) passes a
  `creationKey`. The same key in the same shop returns the purchase order that
  already exists instead of creating a second one.
- **Destination.** Must be an active location of the shop.
- **Supplier.** Must be active. Payment terms, shipping terms and the default
  tax rate are copied onto the order, and the expected date defaults to today
  (in the shop's time zone) plus the supplier's default lead time.

### Unit cost

When no cost is entered for a line, the first of these that applies is used:

1. the volume tier whose range contains the line quantity;
2. the supplier's cost for the variant;
3. the unit cost recorded in Shopify, converted with the order's exchange rate
   when the currencies differ.

Steps 1 and 2 apply only while the order is in the supplier's currency. If
nothing applies the line is added at zero and reported to the caller as
missing a cost; it is never guessed. A cost typed by the merchant is marked as
a manual override and is not re-priced when the quantity changes. Minimum
order quantity and pack size are shown to the buyer but never applied
automatically.

## Arithmetic

All money is `Decimal`; nothing passes through floating point.

- Effective quantity = ordered − cancelled.
- Line gross = unit cost × effective quantity, rounded to cents half away from
  zero.
- Line net = unit cost × effective quantity × (1 − discount %), rounded to
  cents.
- Line tax = line net × tax %, rounded to cents. Tax is part of the order
  total and is not part of landed cost.
- Charges total = sum of charges, with `DISCOUNT` charges negative.
- Order total = sum of line net + sum of line tax + charges total.

### Landed cost

Charges flagged `allocate` are spread across lines by the order's method:
cost (line net), quantity, weight or volume. The spread is done in whole cents
with the largest-remainder rule, ties going to the earlier line, so line
shares always add up to the charge total exactly. If every line has a zero
basis for the chosen method (for example no weights), quantity is used
instead and the result records which method was actually applied.

Each line stores its share (`allocatedChargesTotal`) and the per-unit figure
(`allocatedLandedCost`, four decimal places), and they are recalculated in the
same transaction as any change to lines or charges. Landed unit cost = net
unit cost + per-unit share.

Purchase orders created before charge rows existed carry `freightCost` and
`customsCost` on the header. They are read as a shipping and a duty charge
until the order's charges are edited, at which point they are converted to
rows and the columns are cleared.

## Lifecycle

```
DRAFT → SENT → ORDERED → PARTIAL → RECEIVED → CLOSED
   └──────┴────────┴──→ CANCELLED
```

| Action | Allowed from | Effect |
| --- | --- | --- |
| Mark sent | Draft, Sent, Ordered, Partial | Draft becomes Sent; otherwise a re-send that keeps the status. Records the version sent. |
| Mark ordered | Draft, Sent | Ordered. |
| Cancel | Draft, Sent, Ordered, with nothing received | Cancelled. |
| Close | Partial, Received | Closed; the unreceived remainder stops counting as incoming. |
| Archive / unarchive | Received, Closed, Cancelled | Hides the order; an archived order is read-only. |
| Delete | Draft | Removes the order and its lines; history is kept. |

Only receipt postings move an order to Partial or Received. A cancelled order
cannot be reopened, and an order with received stock cannot be cancelled.
While a receipt or reversal is waiting for Shopify, the order cannot be
cancelled, closed or archived, and no line can be reduced or part-cancelled.

Editing rules:

- Destination, currency, exchange rate and charges are fixed once any stock is
  received.
- Lines can be added or changed until the order is received in full. A line's
  quantity cannot go below what is already received or cancelled, and its cost,
  discount and tax are fixed once stock is received against it.
- Lines are removed only from drafts. Later, the remainder is cancelled so the
  line and its history stay.
- A sent or ordered order needs at least one line with quantity to order.

## Receiving

`app/services/purchasing/receiving.server.ts`. A line's `receivedQty` changes
only here, and only by what Shopify confirmed.

`postPurchaseOrderReceipt(db, admin, actor, input)` receives one delivery
against a Sent, Ordered or Partial order that is not archived:

1. The receipt and its lines are recorded as `PENDING` under the purchase
   order's row lock. Each line carries accepted units (to be stocked) and
   rejected units (recorded, never stocked, still owed by the supplier).
2. The accepted units are recorded in the inventory ledger as one `RECEIPT`
   operation (`po-receipt:<receiptId>`, reason `received`, quantity
   `available`, at the order's destination) and sent to Shopify. Lines for the
   same inventory item go as one change.
3. When the ledger operation finishes, the lines Shopify applied are counted:
   `postedQty` on the receipt line, `receivedQty` on the order line, and the
   order moves to Partial or Received. Lines Shopify refused are not counted
   and keep Shopify's message.

| Receipt status | Meaning |
| --- | --- |
| `PENDING` | Recorded; Shopify has not confirmed. Nothing is counted. Finish it with `resumePurchaseOrderReceipt`. |
| `POSTED` | Every accepted unit is in Shopify and counted. |
| `PARTIALLY_POSTED` | Some lines are in Shopify and counted; the refused lines can be received again on a new receipt. |
| `FAILED` | Nothing reached Shopify and nothing is counted. |
| `REVERSING` | A reversal is recorded; Shopify has not confirmed. The receipt still counts. |
| `REVERSED` | Every posted unit is back out of stock and off the order. |
| `PARTIALLY_REVERSED` | Shopify would not take some lines back; those still count. |
| `REVERSAL_FAILED` | Nothing was taken back; the receipt still counts. |

Rules:

- **Idempotency.** The screen picks an `idempotencyKey` per submission. The
  same key with the same quantities returns the receipt already recorded;
  with different quantities it is refused.
- **Open quantity.** A line accepts at most ordered − cancelled − received,
  less what unconfirmed receipts already hold, unless the receiver confirms
  the extra units (`allowOverReceipt`). Over-received units are counted on the
  line; the ordered quantity and the order total do not change.
- **Switched off.** With the kill switch off nothing is recorded and the
  caller is told so. A receipt that was already pending stays pending.
- **Destination.** Stock is put away at the order's location, which must
  still be active in Shopify.
- **Reversal.** `reversePurchaseOrderReceipt` records the ledger's reversal of
  the receipt's operation, once. The order reopens to Partial, Ordered or Sent
  as its quantities imply. Receipts on closed or cancelled orders are not
  reversed.
- **Lead time.** When an order becomes fully received, the days since it was
  ordered (or sent) are stored for the supplier and its 90-day average is
  refreshed; a reversal that reopens the order removes them.

`getReceivingWorksheet` gives a receiving screen each line's open, pending and
rejected quantities; `listPurchaseOrderReceipts` lists an order's receipts.

Not covered yet: average-cost updates on receipt, receipt sessions that are
saved and resumed across scans, and resolving a barcode that is not on the
order. Stock marked received before the receipt tables existed has no receipt
and cannot be reversed here. There is no background job that finishes pending
receipts; they are finished when someone retries them.

### Versions and concurrent edits

Every command names the `version` it was looking at. If the order has moved on,
the command is rejected with a message asking the user to reload, and nothing
is written. `version` goes up whenever something printed on the supplier
document changes (lines, charges, dates, terms, addresses, notes to supplier).
Internal notes, references and receipts do not change it; a receipt takes the
order's row lock instead of naming a version. `sentVersion` records what the
supplier last received.

## Figures for other modules

`app/services/purchasing/planning.server.ts`:

- `getIncomingQuantities(db, { variantGids?, locationGid? })` returns units on
  order and not yet received per variant: the remainder
  (ordered − received − cancelled, never below zero) of every line on Sent,
  Ordered and Partial orders that are not archived.
- `getSupplierTerms(db, { variantGids })` returns each variant's terms from
  active suppliers, the preferred supplier (flagged, or the only one), and the
  lead time in use with its source: variant override, then the supplier's
  default, then the supplier's measured average rounded up.

## Tenant isolation

Every query goes through the tenant database wrapper. Supplier terms are
upserted through the shop-bearing unique key, new tables carry a required
`shopId` with row-level security and composite foreign keys to their parent,
and `app/tenant/__tests__/db-isolation/purchasing-ledger.test.ts` exercises
the services against PostgreSQL as two shops.
