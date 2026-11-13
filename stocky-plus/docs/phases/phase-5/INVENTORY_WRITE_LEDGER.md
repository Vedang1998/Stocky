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
| Transfer receive | `TransferReceipt`  | +shipped units at the destination          | `movement_received`     |

Transfers are app-managed: stock moves with `inventoryAdjustQuantities` under
`write_inventory`, and no Shopify transfer object is created. Units in transit
are therefore in neither location's `available` until the transfer is received.
A transfer that carries a `shopifyTransferId` from the earlier native path is
not received by the app. Using Shopify's native transfer objects needs
transfer scopes the app does not request and is an owner decision.

## Stocktakes

A stocktake (`app/services/stocktakes/`, pages `/app/stocktakes` and
`/app/stocktakes/<id>`) is a count sheet for one location. Completing it sends
each difference to Shopify through `settleInventoryDocument`.

- **Starting.** A count is for one active, synced location. A full count lists
  every tracked item Shopify stocks there; a partial count starts empty and
  holds only what is scanned or added. Expected quantities are frozen from the
  synced on-hand quantity when the count starts (`quantityBasis: ON_HAND`),
  because staff count what is physically on the shelf, including units already
  committed to orders. Items whose level is not synced yet, or that have no
  linked inventory item, are left off and reported.
- **Counting.** A line is counted by typing a quantity, by scanning (each scan
  of a SKU, barcode or variant ID adds one, or a typed quantity), or by marking
  every uncounted line as zero, which can be undone. Each line records how it
  was counted, when, and by which staff ID. Scanning an item that is not on
  the sheet adds it when Shopify stocks it at the location and its quantity is
  synced; otherwise the scan is refused with the reason. A pasted list of
  SKUs, barcodes or variant IDs adds up to 500 items at a time, all or none.
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
- **Stock that moved during the count.** Before anything is sent, lines with a
  difference are compared with Shopify's live on-hand quantity (up to 2,000
  lines per request), and other lines with the synced quantity. A line whose
  stock no longer equals what was expected blocks completion until someone
  says whether it was counted before the movement (the difference is still
  counted − expected) or after it (the difference is measured from the
  quantity Shopify shows now). Changing a line's count clears that answer.
  Items this count has already sent are not checked again.
- **Partial failure.** Lines Shopify accepted stay accepted. The count stays
  in progress, shows which lines were refused and why, and a second press
  sends only what is still outstanding.
- **Cancelling** is allowed only while the ledger shows nothing applied and
  nothing unfinished for the count.
- **Report.** The count sheet exports as CSV: item, SKU, barcode, expected,
  counted, difference, how and when each line was counted, the staff ID, and
  any stock movement found. Completed and cancelled counts stay readable under
  closed counts.
- Gated by `FEATURE_STOCKTAKE_INVENTORY_WRITES`. While it is off a count can
  be started and counted but not completed.
- Counts started before this workflow keep the basis they were created with
  (`AVAILABLE`), so their expected quantities and differences still mean what
  they did.

Not built yet: counting from Shopify POS (the POS scan endpoint follows the POS
extension work), assigning sections of a count to staff, recount requests for
individual lines, cost value of the differences, and shop-timezone dates.

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
- **Report.** The history lists every adjustment and reversal with its
  staff ID, location, note and the result Shopify gave for each line, and
  exports the chosen period as CSV (one row per line). An export refuses a
  period of more than 2,000 adjustments rather than returning part of it.
- Gated by `FEATURE_ADJUSTMENT_WRITES`. While it is off nothing is recorded.

Not built yet: merchant-defined reasons, attachments, approval before an
adjustment is applied, and shop-timezone dates (the history and the export use
UTC).

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
