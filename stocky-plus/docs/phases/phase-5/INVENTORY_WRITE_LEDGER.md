# Inventory write ledger and executor

Status: implemented behind kill switches that are off by default. Nothing in
this module can change Shopify inventory until the relevant
`FEATURE_*_WRITES` flag is enabled for the environment.

Code: `app/services/inventory-writes/`. Tables: `InventoryOperation`,
`InventoryOperationLine` (migration `20261110220000_inventory_operation_ledger`).

## What it is for

Every app-initiated change to Shopify inventory (manual adjustment, stocktake
completion, purchase-order receipt, transfer movement, reversal) goes through
the same two steps:

1. `recordInventoryOperation(db, draft)` writes the intended change to the
   ledger. Nothing is sent to Shopify.
2. `executeInventoryOperation(db, admin, operationId)` sends the recorded lines
   to `inventoryAdjustQuantities` and records what Shopify answered, line by
   line.

Callers never call `inventoryAdjustQuantities` directly. That is what makes
"complete" and "receive" safe to retry: the second attempt finds the recorded
operation instead of adjusting again.

## Guarantees

| Requirement (AGENTS.md, inventory-write safety) | How it is met                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable operation ID                             | `InventoryOperation.id`; unique `(shopId, idempotencyKey)` chosen by the caller per business action                                                                                                             |
| Authenticated shop and actor                    | Rows are written through `TenantDb` under RLS; the actor is the staff user from the verified session token (`requireInventoryActorContext`)                                                                     |
| Location check                                  | Every location must be a live, active location fact of the shop and every inventory item a live item fact of the shop before anything is recorded                                                               |
| Idempotency                                     | Same key and same payload returns the existing operation; same key with a different payload is rejected. Each Shopify request carries its own `@idempotent` key, stored on the lines before the request is sent |
| Line-level results                              | Each line ends `APPLIED`, `FAILED` or `CONFLICT` with Shopify's error code and message, the adjustment group GID and the resulting quantity                                                                     |
| Partial-failure handling                        | The operation ends `APPLIED` only when every line is; otherwise `PARTIALLY_APPLIED` or `FAILED`. A caller must not mark its document complete on anything but `APPLIED`                                         |
| Audit                                           | The recorded request, actor, note and terminal outcome are immutable (database trigger `stocky_inventory_operation_guard`)                                                                                      |
| Recovery                                        | Unknown outcomes are resent with the same key and identical changes; an executor that died is resumed after its lease expires                                                                                   |
| Reversal                                        | `recordInventoryReversal` records the exact opposite of the applied lines, once per operation                                                                                                                   |
| Kill switch                                     | Checked before the first request and again before every batch                                                                                                                                                   |

## Operation states

```
PENDING ──▶ APPLYING ──▶ APPLIED | PARTIALLY_APPLIED | FAILED      (terminal)
   │            │
   │            └──▶ RETRY_PENDING ──▶ APPLYING …                  (call execute again)
   └──▶ BLOCKED (kill switch off; nothing sent) ──▶ APPLYING …
```

Line states: `PENDING → IN_FLIGHT → APPLIED | FAILED | CONFLICT`. A line is
`IN_FLIGHT` from the moment its batch key is written until Shopify's answer is
recorded. `CONFLICT` means Shopify's quantity no longer matched
`changeFromQuantity` (compare-and-swap); the caller decides whether to recount
and record a new operation.

## How Shopify answers are handled

| Answer                                                                                                                                           | Effect                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adjustment group returned                                                                                                                        | Batch lines `APPLIED`                                                                                                                                   |
| `userErrors` naming a change (`input.changes.N`)                                                                                                 | That line `FAILED`, or `CONFLICT` for `CHANGE_FROM_QUANTITY_STALE`. Shopify applied nothing, so the other lines are sent again under a new key          |
| `userErrors` naming no change                                                                                                                    | Whole batch `FAILED`                                                                                                                                    |
| `IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED`                                                                                                            | Nothing was applied under that key; the batch is re-keyed and sent again                                                                                |
| `IDEMPOTENCY_KEY_PARAMETER_MISMATCH`                                                                                                             | Batch `FAILED` for review. An in-flight batch is always resent unchanged, so this means the ledger and Shopify disagree and resending could apply twice |
| Throttle, 5xx, timeout, dropped connection, unreadable body, `IDEMPOTENCY_CONCURRENT_REQUEST`, `SERVICE_UNAVAILABLE`, `ADJUST_QUANTITIES_FAILED` | Outcome unknown. Lines stay `IN_FLIGHT`, operation `RETRY_PENDING`; the next call resends the same key                                                  |
| HTTP 400/403/404, GraphQL validation or access error                                                                                             | Not executed; batch `FAILED`                                                                                                                            |

## Using it from a module

A one-off change (a manual adjustment) records and executes one operation:

```ts
const { db, admin, actor } = await requireInventoryActorContext({
  request,
  params,
});

const { operation } = await recordInventoryOperation(db, {
  kind: "ADJUSTMENT",
  idempotencyKey: `adjustment:${submissionId}`,
  source: { type: "InventoryAdjustment", id: submissionId },
  reason: "correction",
  quantityName: "available",
  referenceDocumentUri: null,
  actor,
  note,
  lines, // { inventoryItemId, variantId, locationId, delta, changeFromQuantity }
});

const result = await executeInventoryOperation(db, admin, operation.id);
```

- The capability (kill switch) is derived from `kind`; callers do not pass it.
- `executeInventoryOperation` runs for at most 20 seconds per call. A
  `RETRY_PENDING` or `BLOCKED` result means "call again later"; the page must
  show it as unfinished, not as done.
- Pass `changeFromQuantity` whenever the change was computed from a quantity
  the merchant looked at (set-to adjustments). Pass `null` only for purely
  relative changes such as receipts, transfers and reversals.

## Documents: stocktakes and transfers

A document that can be retried, edited between attempts, or pressed twice does
not pick its own keys. It describes the net change it should have made once it
is fully applied and calls `settleInventoryDocument` (`settle.server.ts`):

```ts
const result = await settleInventoryDocument(db, admin, {
  kind: "STOCKTAKE",
  source: { type: "Stocktake", id: stocktake.id },
  reason: "cycle_count_available",
  quantityName: "available",
  referenceDocumentUri: `gid://propo/Stocktake/${stocktake.id}`,
  desired, // net delta per inventory item and location
  actor,
  note: null,
  holdOpen: (tx) => lockOpenStocktake(tx, stocktake.id),
});
if (result.settled) {
  // close the document under its row lock, re-reading the ledger state
}
```

- The ledger's applied lines for the source are subtracted from `desired`; only
  the difference is recorded, under the key `<type>:<id>:<attempt>`. A second
  press, a concurrent press and a retry after a partial failure therefore send
  only what Shopify has not confirmed. A level that was changed but is no
  longer wanted (a count corrected back, a draft transfer cancelled after a
  partial ship) is put back.
- An unfinished operation is resumed before anything new is recorded.
- A document with more than 5,000 outstanding changes is sent over several
  operations, the first 5,000 at a time, two operations per request. Until
  the last one is confirmed the document stays open and reports how many
  changes remain; pressing again sends the rest and nothing twice.
- `holdOpen` runs in the transaction that records each new operation and locks
  the document row, so nothing is recorded for a document that closed or was
  cancelled in the meantime (`InventoryDocumentClosedError`).
- The document closes in its own transaction: lock the row in the expected
  status, rebuild `desired` from the current lines, and close only when
  `readDocumentLedgerState` shows nothing unfinished and nothing outstanding.

| Document         | Source type        | Change                                     | Reason                  |
| ---------------- | ------------------ | ------------------------------------------ | ----------------------- |
| Stocktake        | `Stocktake`        | counted − expected at the counted location | `cycle_count_available` |
| Transfer ship    | `TransferShipment` | −shipped units at the source               | `movement_created`      |
| Transfer cancel  | `TransferShipment` | puts back whatever a partial ship took out | `movement_canceled`     |
| Transfer close   | `TransferShipment` | +missing units back at the source          | `movement_canceled`     |
| Transfer receive | `TransferReceipt`  | +received units at the destination         | `movement_received`     |

Transfers are app-managed: stock moves with `inventoryAdjustQuantities` under
`write_inventory`, and no Shopify transfer object is created. Units in transit
are therefore in neither location's `available` until the transfer is received.
A transfer that carries a `shopifyTransferId` from the earlier native path is
not received by the app. Using Shopify's native transfer objects needs
transfer scopes the app does not request and is an owner decision. The
workflow is described under [Transfers](#transfers).

## Stocktakes

A stocktake (`app/services/stocktakes/`, pages `/app/stocktakes` and
`/app/stocktakes/<id>`) is a count sheet for one location. Completing it sends
each difference to Shopify through `settleInventoryDocument`.

- **Starting.** A count is for one active, synced location. A full count lists
  every tracked item Shopify stocks there; a partial count starts empty and
  holds only what is scanned or added. Staff count what is physically on the
  shelf, including units already committed to orders, so the expected
  quantity is Shopify's on-hand quantity (`quantityBasis: ON_HAND`). Items
  that have no linked inventory item, or that Shopify does not stock at the
  location, are left off and reported.
- **Where expected quantities come from.** The synced quantities can trail
  Shopify (an inventory webhook carries only `available`; on-hand is refreshed
  by a sync), and a difference measured from a stale quantity would be sent to
  Shopify as a wrong change (issue #119). Expected quantities are therefore
  read from Shopify itself:
  - A full count of up to 1,000 items reads every on-hand quantity live when
    it starts (`expectedSource: LIVE`). If Shopify cannot be read, the count
    is not started.
  - A larger location starts from the synced quantities
    (`expectedSource: SYNC`) and the page says so. Each line is then read from
    Shopify when it is first counted, and `expectedReadAt` records when.
  - An item scanned or added to a sheet is read live before it is added; if
    Shopify cannot be read, nothing is added.
  - Completion never measures a difference from a quantity that was not read
    from Shopify. Lines still unread are read first (up to 2,000 per press);
    if more remain, completion stops and asks for another press, and nothing
    is sent. If Shopify cannot be read, completion is refused.
- **Counting.** A line is counted by typing a quantity, by scanning (each scan
  of a SKU, barcode or variant ID adds one, or a typed quantity), or by marking
  every uncounted line as zero, which can be undone. Each line records how it
  was counted, when, and by which staff ID. Scanning an item that is not on
  the sheet adds it when Shopify stocks it at the location; otherwise the scan
  is refused with the reason. A pasted list of SKUs, barcodes or variant IDs
  adds up to 500 items at a time, all or none. A count can still be saved
  while Shopify cannot be read; the line stays unread until it can.
- **Blind counts.** The count can hide expected quantities while counting. The
  server withholds them from the page data and the export, not only from the
  screen, until the count is closed or the reviewer opens the differences.
  Until roles exist this is a working aid, not an access control: any staff
  member of the shop can open the differences view.
- **Completing.** The difference for a line is counted − expected, sent as a
  relative change to `available` with reason `cycle_count_available`, which
  moves on-hand by the same amount. Completion is refused while lines are
  uncounted unless the staff member chooses to leave them unchanged, and a
  named staff member is required.
- **Stock that moved during the count.** Before anything is sent, the count
  is compared with Shopify's live on-hand quantity, up to 2,000 lines per
  press: unread lines first, then lines with a difference, then the rest.
  Lines beyond that are compared with the synced quantity. A line whose stock
  no longer equals what was read blocks completion until someone says whether
  it was counted before the movement (the difference is still
  counted − expected) or after it (the difference is measured from the
  quantity Shopify shows now). Changing a line's count clears that answer.
  Items this count has already sent are not checked again. The check and the
  send are separate requests: the change goes to `available` while the count
  is measured in on-hand, so Shopify's compare-and-swap cannot guard it, and a
  movement in the seconds between the two is not detected.
- **Partial failure.** Lines Shopify accepted stay accepted. The count stays
  in progress, shows which lines were refused and why, and a second press
  sends only what is still outstanding.
- **Cancelling** is allowed only while the ledger shows nothing applied and
  nothing unfinished for the count.
- **Report.** The count sheet exports as CSV: item, SKU, barcode, expected,
  counted, difference, how and when each line was counted, the staff ID, and
  any stock movement found. Completed and cancelled counts stay readable under
  closed counts.
- **Count sheet on paper.** The count page prints the count as a PDF
  (`stocktake-count-sheet.server.ts`, route `…/count-sheet`). While the count
  is open it is the sheet to take to the shelves: the items in the order of
  the count page, the expected quantity, a box to write the units found in,
  what is already entered for an item, and lines for the counter and the
  checker to sign. A blind count prints no expected quantities. Once the
  count is completed or cancelled the same address prints the record:
  expected, counted and the difference for every item, a note on a line whose
  difference was measured from the quantity after stock moved, and the totals
  of the count. A count of more than 250 items prints in parts of 250, one
  request per part (`?part=2`), and each request reads only the lines of its
  part; the page offers a button per part, or a list of the parts when there
  are more than four. Times are on the shop's clock. Printing reads only; it
  needs no active plan and no write switch. Requests count against the shop's
  allowance for printed documents (see Papers under Transfers).
- Gated by `FEATURE_STOCKTAKE_INVENTORY_WRITES`. While it is off a count can
  be started and counted but not completed.
- Counts started before this workflow keep the basis they were created with
  (`AVAILABLE`), so their expected quantities and differences still mean what
  they did.

Not built yet: counting from Shopify POS (the POS scan endpoint follows the POS
extension work), assigning sections of a count to staff, recount requests for
individual lines, and cost value of the differences.

## Adjustments

A manual adjustment (`app/services/adjustments/`, page `/app/adjustments`) has
no table of its own: it is one ledger operation of kind `ADJUSTMENT` with
source type `InventoryAdjustment`, and the ledger is its history.

- **One form, one adjustment.** The page issues a submission ID with every
  load. It is the operation's source ID and its idempotency key
  (`adjustment:<id>`), so a form submitted twice, or twice at once, is recorded
  and sent once. The second request is answered from the ledger without
  reading or changing anything else.
- **Input.** One item per line: a SKU, barcode or variant ID, then a quantity
  (comma, tab or semicolon separated, so two spreadsheet columns paste as they
  are). Up to 250 items. Every line must match exactly one variant of the
  shop with a linked inventory item; otherwise nothing is recorded and each
  bad line is named.
- **Add or remove** sends the signed amount as a relative change.
- **Set** reads Shopify's `available` for each item at the location just
  before recording, records the difference, and sends it with
  `changeFromQuantity`, so a sale made in between makes Shopify refuse that
  line instead of being overwritten. An item that is not stocked at the
  location is refused, never treated as 0. Items already at the target are
  left out.
- **Reasons** are a fixed list of codes Shopify accepts for `available`
  (correction, recount, damaged, theft or loss, received, returned to stock,
  promotion or donation, other), so the reason also shows in Shopify's own
  inventory history.
- **Reversal** applies the opposite of the applied lines, once per
  adjustment, by a named staff member; a reversal cannot be reversed.
- **Quantity after a change.** Each applied line stores the quantity Shopify
  reports after the change. Shopify does not always report one. A "set" line
  was applied on exactly the quantity it named, so its result is stored either
  way; an add or remove line that Shopify reports nothing for shows no
  quantity rather than a guess.
- **Two requests at once.** The request that finds the other one still
  sending says so and asks for a reload, because there may be nothing left to
  finish.
- **Report.** The history lists every adjustment and reversal with its
  staff ID, location, note and the result Shopify gave for each line, and
  exports the chosen period as CSV (one row per line). An export refuses a
  period of more than 2,000 adjustments rather than returning part of it.
- Gated by `FEATURE_ADJUSTMENT_WRITES`. While it is off nothing is recorded.

Not built yet: merchant-defined reasons, attachments, and approval before an
adjustment is applied.

## Transfers

A transfer (`app/services/transfers/`, pages `/app/transfers` and
`/app/transfers/<id>`) moves stock from one active, synced location to another.
It has no tables beyond `TransferOrder` and `TransferLineItem`; the two ledger
documents above are the record of what moved.

- **Two documents, each a net change.** `TransferShipment:<id>` is what the
  transfer has taken out of the source: the shipped units, less the units put
  back when it is closed short. `TransferReceipt:<id>` is what it has added at
  the destination: every unit received so far, plus the units counted in for
  the receipt being posted. Each step rebuilds its document from the current
  lines and settles it, so a second press, two presses at once and a retry
  after a partial failure send only what Shopify has not confirmed.
- **Draft.** Items are added by scanning or typing a SKU, barcode or variant
  ID, or by pasting a list with an optional quantity per row (comma, tab or
  semicolon separated, up to 250 items, all or none, each refused row named).
  An item must be tracked in Shopify and have a linked inventory item. A
  variant has one line; adding it again adds to that line. A line's quantity
  can be changed or the line removed. A line ships its quantity unless a
  smaller picked quantity is saved for it. Up to 1,000 lines of up to
  1,000,000 units.
- **Shipping** needs a named staff member. Shopify's live `available` is read
  first at both locations. An item Shopify does not stock at the source or at
  the destination stops the shipment. A source with fewer units than the
  transfer takes stops it until the staff member confirms that the source may
  go below zero. If the quantities cannot be read, nothing is sent. After a
  partial failure only the units that have not left yet are checked again.
  When every change is confirmed the transfer goes in transit and each line's
  shipped quantity is frozen in `pickedQty`.
- **Cancelling** is for drafts. If an interrupted shipment already took stock
  out, cancelling puts it back first; the transfer is cancelled only when the
  ledger shows the source whole again.
- **Receiving.** Units are counted in at the destination by scanning (one unit
  per scan, or a typed number) or by typing a number per line, which changes
  nothing in Shopify. A barcode shared by two catalog items is taken as the
  one on the transfer. Posting the receipt adds the counted-in units at the
  destination and needs a named staff member; a transfer takes as many
  receipts as it needs. Units counted in while a receipt is being posted are
  kept for the next one. The transfer finishes when every shipped unit is
  received or rejected. Nothing is added at the destination unless the ledger
  shows the whole shipment out of the source.
- **Rejects.** Units that arrived and are not fit for sale are recorded on
  their line with a reason. They enter stock at neither location and no change
  is sent to Shopify for them.
- **Closing short.** When shipped units will not arrive, the transfer is closed
  and the staff member chooses: put the missing units back into stock at the
  source (the shipment document shrinks by them, so the ledger sends the
  difference back) or write them off (nothing is sent; they stay out of stock
  at both locations). Units counted in and not posted must be posted or
  cleared first. While a return is partly applied the transfer stays in
  transit and takes no receipt; closing again finishes it.
- **Status.** The stored status stays `DRAFT`, `IN_TRANSIT`, `RECEIVED` or
  `CANCELLED`. "Partly received", "Received with rejects" and "Closed short"
  are derived from the line quantities (`transfer-display.ts`).
- **Unfinished steps.** The transfer page compares the lines with the ledger
  (`transferAttention`) and says which step did not finish: a shipment partly
  sent, a cancelled transfer whose stock is not all back, a receipt partly
  posted, a return partly applied, or a transfer in transit that the ledger
  never saw leave the source. For the last one the app moves no stock at all.
- **History and report.** The page lists the transfer's ledger operations:
  what left, arrived and went back, who did it, and whether Shopify confirmed
  or refused it. The transfer report exports one row per item as CSV with
  requested, shipped, received, counted-in, rejected, returned, written-off
  and outstanding units.
- **Papers.** Two PDFs print from the transfer page
  (`transfer-documents.server.ts`, routes `…/document` and `…/pick-list`).
  The pick list exists while the transfer is a draft: the items in SKU order
  with the units to pick, a box to write the units picked in, and how many
  are already entered as picked. The transfer document goes with the stock: while the transfer is a
  draft or in transit it lists what is sent with blank boxes for the units
  received and damaged and lines for the packer and receiver to sign; once the
  transfer is received or cancelled it is the record, with asked, sent,
  received, rejected, returned and written-off units and their totals. Both
  name the two locations with their addresses as Shopify gave them, and show
  times on the shop's clock, or in UTC and marked as such when Shopify does
  not answer with the shop's time zone. A transfer of more than 250 items
  prints in parts of 250, one request per part (`?part=2`): the PDF library
  needs about 11 ms of processor time per row and holds the server's event
  loop while it works, so one part costs about 3 seconds and a whole
  1,000-item transfer in one request cost over 20. Printing reads only; it
  needs no active plan and no write switch.
- **How often papers can be asked for.** A shop may ask for 12 printed
  documents a minute (`app/lib/pdf/paper-rate-limit.server.ts`). The transfer
  document, the pick list, the count sheet and both purchase-order PDFs count
  against the same allowance, one for each request, so one for each part. The
  request over the limit is answered with 429, a `Retry-After` header and a
  sentence saying in how many seconds to try again, before anything is read
  or laid out. The reason is the event loop above: six parts asked for at
  once held the server for 8.7 seconds, and another shop's page waited 2.9
  seconds behind them. With the limit one shop can take about half of one
  server process's time at the worst. The count is kept in Redis per shop,
  keyed by the shop of the verified session. If Redis cannot be reached the
  request is allowed and the outage is logged at most once a minute: the
  routes are signed-in admin routes, and a Redis outage should not stop a
  shop printing. A count of more than 3,000 items has more than 12 parts and
  cannot be printed whole within one minute; the refusal says when to go on.
- Gated by `FEATURE_TRANSFER_WRITES`. While it is off a transfer can be
  drafted and edited, units counted in and rejects recorded, and a transfer
  with nothing left to move can be finished or written off; nothing that
  changes stock in Shopify is sent.

Not built yet: approval before a transfer ships, several shipments for one
transfer, receiving from Shopify POS, labels, transfers suggested from
replenishment or balancing, cost value in transit, and a paper size other
than US Letter. In-transit units are not shown as incoming at the destination
in Shopify, because no Shopify transfer object exists.

## Times on the shop's clock

The stocktake, adjustment and transfer pages, their CSV reports and the
transfer papers give every time on the shop's clock (`shop-time.ts`).

- **Which zone.** The pages and reports read the IANA time zone stored for
  the shop at its last sync (`readShopTimeZone` in `shop-clock.server.ts`),
  which costs no Shopify call. The transfer papers ask Shopify for it together
  with the shop's name and addresses. Until a zone is known (a shop whose
  first sync has not finished), or when the server does not know the zone
  Shopify named, times are given in UTC and marked "UTC". No zone is guessed.
- **Pages** read "Nov 10, 2026, 3:45 PM EST": the zone's short name follows
  the time, so a time read from a screenshot is not ambiguous.
- **CSV reports** write `2026-11-10 15:45` and name the zone in the column
  heading, "Shipped at (America/Toronto)". Without a zone the heading says
  "(UTC)" and the cell is the full ISO time, as it was before. A report's file
  name carries the shop's day.
- **Adjustment history dates.** "From" and "To" are whole days on the shop's
  clock, including the 23-hour and 25-hour days when the clocks change; the
  report downloaded from the page covers the same days. Without a zone they
  are UTC days and the fields say so.

Times are stored in UTC and nothing stored changes. A shop that changes its
time zone in Shopify sees earlier documents on the new clock after the next
sync.

## Plan gate

Every action of the Stocktakes, Adjustments and Transfers pages calls
`requireActivePlanSnapshot` (`app/billing/entitlements.server.ts`) before it
reads the form, so a shop without an active plan gets a 403 and nothing is
recorded or sent. That covers creating, editing, counting, shipping,
receiving, completing, reversing, cancelling and finishing an unfinished
step. The pages and their CSV reports stay readable: the loaders ask
`planAllowsChanges` (`plan-access.server.ts`), show a banner that links to
Billing, disable every button that changes something and stop Enter from
submitting. The ledger itself does not check the plan; the routes do.

A lapsed plan therefore also stops work that is already under way, such as
receiving a transfer that is in transit or putting cancelled stock back. Stock
in Shopify stays as it was at the last confirmed step, and the page keeps
saying what is unfinished until a plan is active again. Whether documents in
flight should stay finishable after a plan lapses is a plan-policy decision
that has not been made.

## Limits and known gaps

- 5,000 lines per operation, 250 changes per Shopify request (default batch
  100).
- There is no background sweeper yet. An unfinished operation is resumed when
  its module calls `executeInventoryOperation` again.
- Staff display names are not recorded: the session token carries only the
  user ID, and reading staff names needs a scope the app does not request.
- Per-role permissions are not checked here. Role enforcement arrives with the
  audit/roles work; until then every authenticated staff member of the shop
  can record an operation, and the kill switches gate execution.
- Not yet exercised against a live Shopify store. The response handling is
  covered by unit tests and a database-backed double of Shopify's idempotency
  and compare-and-swap behaviour.
