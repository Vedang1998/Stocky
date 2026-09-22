# ProPo — movement-aware stocktakes and historical continuity

**PROPOSED R&D contract, not an implemented stocktake or write authorization.** This is a priority differentiator identified by the owner. Stocky documentation reports limitations around unfulfilled orders and stocktake history [V04]; preserve evidence rather than copying those limitations. Public listing copy must not claim guaranteed live-count accuracy before the §3 capability matrix exists [F-P54-07].

## 1. The physical problem

“Subtract all sales during the stocktake” is incorrect. Different items and zones are counted at different times; an item sold before its count is already absent from the physical count. Online orders can reserve goods still physically present; a financial refund need not restock anything. Receipts, transfers, adjustments, returns and items moved between counted zones also matter. Order-created time or webhook arrival time is not automatically physical movement time.

For a variant/location with a reliable completed count at time t_c and a common closing cutoff t_f:

```text
projected_physical(t_f) = observed_physical_count(t_c)
                         + verified net physical movements in (t_c, t_f]
variance(t_f) = projected_physical(t_f)
               - system_on_hand_at_the_same_cutoff(t_f)
```

`system_on_hand_at_the_same_cutoff` is Shopify quantity name **`on_hand`**, never `available`. This is a proposed reconciliation identity, not proof Shopify exposes every required movement.

Official Shopify quantity-state guide (fetched 2026-09-22): `on_hand` is the total physically stocked at the location and equals `available + committed + reserved + damaged + safety_stock + quality_control`. `incoming` is **not** part of that sum. GraphQL Admin API cannot adjust `committed`; Shopify manages it through orders/drafts/transfers [V24].

### 1.1 Eight-name mapping for a physical count

| Concept | Shopify `quantities` name | In physical count? | Count write? |
|---|---|---|---|
| Physical units in the counted scope | `on_hand` | Comparison authority at the same cutoff | Yes, after coverage proof, using `name: "on_hand"` |
| Sellable remainder | `available` | Observe only | **Never** as a physical total |
| Unfulfilled / order reservation | `committed` | Still physically present unless picked | Observe; do **not** subtract again |
| Held for a customer / 3PL hold | `reserved` | Declare whether the reserved bin is in scope | Do not double-subtract; move between states is not a count write |
| Damaged | `damaged` | Declare per session; default **exclude** unless that zone is counted | Do not silently omit from `on_hand` comparison |
| Inspection hold | `quality_control` | Same as damaged | Same as damaged |
| Safety buffer | `safety_stock` | Usually still on the shelf; declare | Same as damaged if stored apart |
| On-order, not yet received | `incoming` | **No.** Source-deduplicated; not counted until physically received | Never add incoming into a physical total |

An order reservation is not necessarily physical departure. A refund is not necessarily restock. Incoming remains source-deduplicated and is not counted until physically received.

If damaged / reserved / QC / safety quantities are part of Shopify `on_hand` but were not in the counted scope, the row is **CONFLICT / recount** unless the session explicitly declares those components and subtracts them from the comparison denominator. Do not invent a second “physical available.”

### 1.2 Worked physical examples (planning models, not a store)

Example synthetic only: item A is counted as 12 at 10:00, then 2 leave and 5 arrive before 10:15; projected physical is 15 versus same-cutoff `on_hand`. A different item counted at 10:10 already excludes a 10:05 sale; subtracting that sale again is wrong. Physical returns add only when actual restock is established. Document event-time uncertainty rather than hiding it in a total.

Published cases ST-01…ST-19 live in RESEARCH_SOURCES.md. They include required-fail examples: double-subtraction of a pre-count sale (ST-02), setting `available` from a physical total (ST-03), stale CAS (ST-08), null CAS opt-out (ST-09), multi-bin without a ledger (ST-07), and legacy `compareQuantity` payloads (ST-19).

## 2. Count/session data and UI

Session records location, selected scope, method, baseline coverage, roles, start/end cutoffs, scan ledger, per-line/zone count start and completion, device/actor, accepted count revision and conflicts. Stable client event IDs suppress duplicate scan replay; a legitimate repeated scan increments, an accidental replay does not. An uncounted line is NULL/not counted, never automatic zero. Recounts supersede a prior count observation, not raw scan history.

For multi-bin items, a location total is not a simultaneous observation if goods move between bins while counting. Use controlled zone handoff/brief local freeze or an independently supported zone-movement ledger; absent that evidence require recount/conflict, not fabricated exactness. Count-before-sale and sale-before-count must both be represented. Multiple counters require exclusive assigned zones or a reviewed merge policy, not last-write-wins totals.

Per-line physical count time is mandatory. Ambiguous or missing movements, delayed events whose order relative to t_c cannot be proved, and unexplained external adjustments block the affected row. Unaffected rows may finish if the approved workflow permits partial completion.

Live view: count, count time, movements since count, projected closing quantity, system comparison **on `on_hand`**, difference, movement coverage/freshness and status. Final report: original count; verified movement adjustment; proposed correction; committed correction; unresolved rows; approvals; API outcomes; count/movement source links. Staff see costs only if authorized. Save/resume and mobile/POS scanning preserve evidence and permissions; offline data cannot certify a live final total.

## 3. Shopify observability proof before allowing automatic adjustment

Create a capability matrix from the selected stable schema and a controlled development store: quantity-state semantics; inventory adjustment/movement data actually accessible; relevant webhooks and duplicates/out-of-order behavior; POS sales versus fulfillment changes; refunds/restocks; returns; transfers; receipts; manual and third-party changes; backdating; bundle components; reserved stock. Record actual coverage and limitations. A refreshed aggregate quantity alone does not explain all physical movements around a count.

Use event identity/time/source and reconciled watermarks; keep observed, inferred and missing movements distinct. Re-reading an order is not proof that all inventory writers have been seen. No fixed two-minute wait can guarantee all late events arrived. Missing coverage, ambiguous ordering during the count window, external unexplained adjustment or unverified state must block the affected row for recount/manual resolution. Unaffected rows may finish if the approved workflow permits partial completion. Do not certify the whole session complete with unresolved rows.

This matrix is unexecuted here. Until it exists, do not market “stocktakes while trading” as a guaranteed capability.

## 4. Applying a correction safely — versioned mutation gate

Select the actual Shopify mutation appropriate to the declared quantity authority. A physical count may establish a correction for **on-hand**; it does not grant global stock authority or permit setting available to a physical total.

No mutation is executed or scope granted in this task. Public documentation is not a controlled-store execution. Local generated Admin schema artifact `app/types/admin-2026-07.schema.json` was **absent** this run (gitignored).

### 4.1 Separately verified capabilities (2026-09-22)

| Capability | What was checked | Result | Not proved |
|---|---|---|---|
| Selected stable API version | Repo pin `shopify.app.toml` / `ApiVersion.July26` = **2026-07** | Config pin read | Not a live shop schema dump |
| Quantity names `inventorySetQuantities` accepts | Official 2026-07 `InventorySetQuantitiesInput.name`: only `available` or `on_hand` | Public docs | Store execution |
| Physical authority | Official quantity-states: `on_hand` = available+committed+reserved+damaged+safety_stock+quality_control; `incoming` excluded | Public docs [V24] | Movement completeness |
| CAS field — changelog | Shopify 2026-04 changelog: `changeFromQuantity` replaces `compareQuantity` / `ignoreCompareQuantity`; passing `null` opts out; runtime-mandatory even if schema does not mark it required | Fetched [V09] | Runtime on our app |
| CAS field — 2026-07 input object | Official 2026-07 and `latest` `InventoryQuantityInput`: **`changeFromQuantity` only**; must pass a value including `null` | Fetched | Whether 2026-07 schema still contains removed fields |
| Mutation page examples | Official **2026-07 and latest** `inventorySetQuantities` pages still describe `compareQuantity` / `ignoreCompareQuantity`, and first examples still use `name: "available"` plus `compareQuantity`. Later examples use `@idempotent` and `changeFromQuantity`. cURL samples are labeled `admin/api/2026-07` | **SOURCE CONFLICT remains** | Which example the live 2026-07 runtime accepts |
| Idempotency | 2026-04 changelog: `@idempotent` required at **runtime** even if not schema-mandatory. Overview: not every mutation has the same guarantee; errors include `IDEMPOTENCY_CONCURRENT_REQUEST` and `IDEMPOTENCY_KEY_PARAMETER_MISMATCH` | Fetched [V10] | Schema-level `@idempotent` enforcement |
| `userErrors` | Input-object text documents `CHANGE_FROM_QUANTITY_STALE` | Public docs | Full error catalogue on a store |
| Unknown result | Proposed contract only | Not executed | Timeout / missing payload behavior |

**Forbidden non-authoritative example** (copied from the live 2026-07/latest mutation page, **not** to be implemented for ProPo counts):

```json
{
  "input": {
    "name": "available",
    "reason": "correction",
    "quantities": [
      {
        "quantity": 12,
        "changeFromQuantity": 5
      }
    ]
  }
}
```

and the still-published `compareQuantity` / `ignoreCompareQuantity: true` variants. Changelog 2026-04 also illustrates `name: "available"` with `changeFromQuantity`. For a **physical** count those examples are wrong even when the CAS field name is current.

### 4.2 Proposed ProPo live-count mutation contract

Until a later accepted pin, the selected stable version is the repo pin **2026-07**.

| Element | Proposed requirement |
|---|---|
| Mutation | `inventorySetQuantities` |
| `name` | `on_hand` |
| `quantity` | projected physical for the counted scope after coverage proof |
| CAS input field | `changeFromQuantity` = the same-cutoff observed Shopify `on_hand` integer |
| CAS opt-out | `changeFromQuantity: null` is **forbidden** for merchant counts (changelog allows it; live stocktake must not) |
| Legacy fields | Do not send `compareQuantity` or `ignoreCompareQuantity` |
| Idempotency | `@idempotent(key: <stable operation UUID>)`. Changing bytes requires a linked successor command, never the same key |
| Reason | A documented cycle-count / correction reason after schema revalidation |
| Reference | App GID for the stocktake line/operation |
| Success | `userErrors` empty **and** adjustment-group readback matches intended `on_hand` |
| Stale | `CHANGE_FROM_QUANTITY_STALE` → refresh evidence, recompute or recount, new approval if required, successor command |
| Idempotency mismatch | `IDEMPOTENCY_KEY_PARAMETER_MISMATCH` → do not retry different bytes on the same key |
| Concurrent | `IDEMPOTENCY_CONCURRENT_REQUEST` → wait and read back the original operation |
| Unknown | Timeout, empty body, or missing adjustment group: read back / reconcile using the original operation id; do not assume commit or absence |

A compare-and-set check prevents overwriting an intervening change; it does not reconstruct movement history or repair a stale physical observation. Do not disable comparison or repeatedly write the original absolute count. Permissions are rechecked at final effect; revoked count staff cannot complete through a queued job. No final SUCCESS on failed or pending line writes. Provide backup/export, partial recovery and reversal policy; reversal may require a new physical reconciliation if intervening movements occurred. Record the writer and exact outcomes, not just a session boolean.

## 5. Mandatory acceptance schedules — all unexecuted here

Sales before/during/after individual counts; sale before count but webhook afterward; online unfulfilled reservation; refund with no restock; actual returned stock; partial receipt; transfer out/in; external manual adjustment; simultaneous counters; goods moved between zones; duplicate/out-of-order webhook; missed source event; clock skew/offline scan; staff/location switch; all/partial zero; discarded scan; source history inaccessible; stale comparison; network loss before and after Shopify commit; duplicate completion; late movement after review; counterpart shop unaffected; damaged/QC undeclared; incoming not yet received. Expected results include correct projection or a visible conflict/recount, never forced green.

A synthetic algebra test is necessary but insufficient. Launch requires end-to-end controlled-store and real open-store pilot evidence across device/location/cohort combinations. Do not advertise guaranteed live-stocktake accuracy where Shopify/provider movement visibility is incomplete.

## 6. Last purchase and variant continuity

Display three distinct fields: Last ordered (qualifying committed PO, not mere draft); Last received (posted receipt with explicit reversal treatment); Last sold (qualifying sales evidence). Show source and covered history period; absent imported history is unknown rather than never. Supplier/location filters and backdated entries must have defined behavior.

A recreated Shopify variant has a new identity. Support cannot restore an old GID by matching SKU/title, and ProPo must not rewrite old order/refund, receipt, cost or inventory facts to the new ID. Proposed support workflow: merchant ticket -> verify shop authorization -> inspect old/new IDs, size/UOM/barcode/options and dates -> propose a versioned lineage relation with defined purpose/time range -> preview affected report/forecast projections and ambiguity -> merchant approval -> restricted audited operation -> reindex derived views -> verify -> reversible relation change.

Default repair scope is reporting continuity. Forecast use is a separately explicit projection decision and preserves raw parity/identity evidence, disjoint effective intervals and no double counting if old and new variants coexist. Never combine different sizes/pack units or infer erased/missing historical data. Cycles, chains, partial splits/merges and ambiguous SKU reuse block automatic linkage. Live writes always target the current real Shopify ID. Reversing a lineage relation does not rewrite sent POs or historical reports; versions remain reconstructible.

Support access is ticket-bound, tenant-bound, time-limited and auditable. An operator does not get permanent merchant-owner impersonation or authority to bypass RLS. If source history is gone, say it cannot be established from available evidence; no synthetic reconstructed sales.
