# ProPo — movement-aware stocktakes and historical continuity

**PROPOSED R&D contract, not an implemented stocktake or write authorization.** This is a priority differentiator identified by the owner. Stocky documentation reports limitations around unfulfilled orders and stocktake history [V04]; preserve evidence rather than copying those limitations.

## 1. The physical problem

“Subtract all sales during the stocktake” is incorrect. Different items and zones are counted at different times; an item sold before its count is already absent from the physical count. Online orders can reserve goods still physically present; a financial refund need not restock anything. Receipts, transfers, adjustments, returns and items moved between counted zones also matter. Order-created time or webhook arrival time is not automatically physical movement time.

For a variant/location with a reliable completed count at time t_c and a common closing cutoff t_f:

```text
projected_physical(t_f) = observed_physical_count(t_c)
                         + verified net physical movements in (t_c, t_f]
variance(t_f) = projected_physical(t_f)
               - system_on_hand_at_the_same_cutoff(t_f)
```

This is a proposed reconciliation identity, not proof Shopify exposes every required movement. Do not use available as physical on-hand or double-subtract commitments. Define which damaged/reserved/fulfillment-held areas are physically included, and relate Shopify quantity states accordingly.

Example synthetic only: item A is counted as 12 at 10:00, then 2 leave and 5 arrive before 10:15; projected physical is 15. A different item counted at 10:10 already excludes a 10:05 sale; subtracting that sale again is wrong. Physical returns add only when actual restock is established. Document event-time uncertainty rather than hiding it in a total.

## 2. Count/session data and UI

Session records location, selected scope, method, baseline coverage, roles, start/end cutoffs, scan ledger, per-line/zone count start and completion, device/actor, accepted count revision and conflicts. Stable client event IDs suppress duplicate scan replay; a legitimate repeated scan increments, an accidental replay does not. An uncounted line is NULL/not counted, never automatic zero. Recounts supersede a prior count observation, not raw scan history.

For multi-bin items, a location total is not a simultaneous observation if goods move between bins while counting. Use controlled zone handoff/brief local freeze or an independently supported zone-movement ledger; absent that evidence require recount/conflict, not fabricated exactness. Count-before-sale and sale-before-count must both be represented. Multiple counters require exclusive assigned zones or a reviewed merge policy, not last-write-wins totals.

Live view: count, count time, movements since count, projected closing quantity, system comparison, difference, movement coverage/freshness and status. Final report: original count; verified movement adjustment; proposed correction; committed correction; unresolved rows; approvals; API outcomes; count/movement source links. Staff see costs only if authorized. Save/resume and mobile/POS scanning preserve evidence and permissions; offline data cannot certify a live final total.

## 3. Shopify observability proof before allowing automatic adjustment

Create a capability matrix from the selected stable schema and a controlled development store: quantity-state semantics; inventory adjustment/movement data actually accessible; relevant webhooks and duplicates/out-of-order behavior; POS sales versus fulfillment changes; refunds/restocks; returns; transfers; receipts; manual and third-party changes; backdating; bundle components; reserved stock. Record actual coverage and limitations. A refreshed aggregate quantity alone does not explain all physical movements around a count.

Use event identity/time/source and reconciled watermarks; keep observed, inferred and missing movements distinct. Re-reading an order is not proof that all inventory writers have been seen. No fixed two-minute wait can guarantee all late events arrived. Missing coverage, ambiguous ordering during the count window, external unexplained adjustment or unverified state must block the affected row for recount/manual resolution. Unaffected rows may finish if the approved workflow permits partial completion. Do not certify the whole session complete with unresolved rows.

## 4. Applying a correction safely

Select the actual Shopify mutation appropriate to the declared quantity authority. A physical count may establish a correction for on-hand; it does not grant global stock authority or permit setting available to a physical total. Use a stable operation identity, before/after quantity-state evidence and exact payload. Shopify's 2026-04 changelog requires explicit changeFromQuantity semantics and describes inventory idempotency changes [V09/V10]. Revalidate selected mutation and @idempotent behavior against the pinned stable schema; some current mutation prose retains older compareQuantity wording, so do not blindly copy examples.

A compare-and-set check prevents overwriting an intervening change; it does not reconstruct movement history or repair a stale physical observation. On a stale comparison: refresh source evidence, recompute or request recount, and obtain any required new approval. Do not disable comparison or repeatedly write the original absolute count. On an uncertain response: read back/reconcile using the original operation and idempotency rules before trying again. Changing the input requires a linked successor command, not reusing the same idempotency key with different bytes.

Permissions are rechecked at final effect; revoked count staff cannot complete through a queued job. No final SUCCESS on failed or pending line writes. Provide backup/export, partial recovery and reversal policy; reversal may require a new physical reconciliation if intervening movements occurred. Record the writer and exact outcomes, not just a session boolean.

## 5. Mandatory acceptance schedules — all unexecuted here

Sales before/during/after individual counts; sale before count but webhook afterward; online unfulfilled reservation; refund with no restock; actual returned stock; partial receipt; transfer out/in; external manual adjustment; simultaneous counters; goods moved between zones; duplicate/out-of-order webhook; missed source event; clock skew/offline scan; staff/location switch; all/partial zero; discarded scan; source history inaccessible; stale comparison; network loss before and after Shopify commit; duplicate completion; late movement after review; counterpart shop unaffected. Expected results include correct projection or a visible conflict/recount, never forced green.

A synthetic algebra test is necessary but insufficient. Launch requires end-to-end controlled-store and real open-store pilot evidence across device/location/cohort combinations. Do not advertise guaranteed live-stocktake accuracy where Shopify/provider movement visibility is incomplete.

## 6. Last purchase and variant continuity

Display three distinct fields: Last ordered (qualifying committed PO, not mere draft); Last received (posted receipt with explicit reversal treatment); Last sold (qualifying sales evidence). Show source and covered history period; absent imported history is unknown rather than never. Supplier/location filters and backdated entries must have defined behavior.

A recreated Shopify variant has a new identity. Support cannot restore an old GID by matching SKU/title, and ProPo must not rewrite old order/refund, receipt, cost or inventory facts to the new ID. Proposed support workflow: merchant ticket -> verify shop authorization -> inspect old/new IDs, size/UOM/barcode/options and dates -> propose a versioned lineage relation with defined purpose/time range -> preview affected report/forecast projections and ambiguity -> merchant approval -> restricted audited operation -> reindex derived views -> verify -> reversible relation change.

Default repair scope is reporting continuity. Forecast use is a separately explicit projection decision and preserves raw parity/identity evidence, disjoint effective intervals and no double counting if old and new variants coexist. Never combine different sizes/pack units or infer erased/missing historical data. Cycles, chains, partial splits/merges and ambiguous SKU reuse block automatic linkage. Live writes always target the current real Shopify ID. Reversing a lineage relation does not rewrite sent POs or historical reports; versions remain reconstructible.

Support access is ticket-bound, tenant-bound, time-limited and auditable. An operator does not get permanent merchant-owner impersonation or authority to bypass RLS. If source history is gone, say it cannot be established from available evidence; no synthetic reconstructed sales.
