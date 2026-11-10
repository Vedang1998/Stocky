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

```ts
const { db, admin, actor } = await requireInventoryActorContext({
  request,
  params,
});

const { operation } = await recordInventoryOperation(db, {
  kind: "STOCKTAKE",
  idempotencyKey: `stocktake:${stocktake.id}:apply:${stocktake.applyAttempt}`,
  source: { type: "Stocktake", id: stocktake.id },
  reason: "cycle_count_available",
  quantityName: "available",
  referenceDocumentUri: `gid://propo/Stocktake/${stocktake.id}`,
  actor,
  note: null,
  lines, // { inventoryItemId, variantId, locationId, delta, changeFromQuantity }
});

const result = await executeInventoryOperation(db, admin, operation.id);
if (result.status === "APPLIED") {
  // only now mark the document complete
}
```

- The capability (kill switch) is derived from `kind`; callers do not pass it.
- `executeInventoryOperation` runs for at most 20 seconds per call. A
  `RETRY_PENDING` or `BLOCKED` result means "call again later"; the page must
  show it as unfinished, not as done.
- Pass `changeFromQuantity` whenever the change was computed from a quantity
  the merchant looked at (counts, set-to adjustments). Pass `null` only for
  purely relative changes such as receipts and reversals.

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
