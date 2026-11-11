# ProPo — daily experience, permissions and integrations

**Revision 2 successor / PROPOSED.** Use source register V01–V24. No UI, scopes, Shopify account roles or connectors were changed. Home/navigation remains an untested hypothesis [F-P54-08].

## 1. Default Home: operational attention, not a finance dashboard wall

Stocky's documented low-stock reports prioritize variants/vendors at risk, with open-order visibility [V04/V05]. Use that workflow as research input, not a claim that its historical exact home screen has been reconstructed.

Proposed Home order: (1) persistent freshness/sync and critical reconciliation banner; (2) Resume my work (draft PO, receipt, active stocktake); (3) Needs attention (stock risk, late POs, receipt/count conflicts) with clear destination; (4) Plan an order and Receive/Count shortcuts; (5) a restrained inventory-value/stock-cover summary and reports link. Scope by permitted location and role; do not expose costs to staff because a card is convenient. Newly installed shops see onboarding progress and missing data, not misleading zero metrics.

Retain the approved information architecture until usability comparison is accepted. Candidate grouping: Home; Plan; Purchase (POs, Receiving, Suppliers/Vendors); Inventory (stock, counts, transfers, labels); Reports; Settings. Receiving/count need direct shortcuts and POS tiles even when grouped. No fifteen strategy menu items or second embedded sidebar.

Large desktop grid: stable variant identity, supplier SKU/UOM, location, available/incoming **labeled as such**, last ordered/received dates, costs where allowed, suggested and final quantity, warnings. Keyboard navigation, saved views/columns, undo-before-commit, unsaved-change protection and explicit partial failures are core. Mobile uses row cards/detail and retained work rather than squeezed desktop columns. Quantities always state units/cases; financial values state currency/tax basis. UI state must not claim confirmed external writes before readback.

## 2. Surface contract

Desktop Admin: full purchasing/report-building and bulk review. Mobile Shopify Admin: responsive PO/receiving/lookup/count where embedded browser capabilities permit. POS: separate Receive PO and Stocktake tiles, barcode/camera scanning and staff/location-aware recovery. Browser camera availability is a device/permission capability to verify, not assumed from the POS Scanner API [V07]. Camera is not a paid-plan substitute for device support.

POS session token represents the **authenticated user**, not necessarily the staff member currently using a PIN. Shopify explicitly distinguishes these identities [V08]. A client-supplied pinned staff ID is not server authorization. Revalidate staff switch, location change, token expiry and permission change. Unknown binding stays blocked for privileged effects; do not use the logged-in owner's authority for every pinned staff member. Pinned-only staff who cannot mint a session token cannot become a ProPo actor through the PIN.

Offline may capture scans locally with stable IDs and clear unsynced status only within proven storage/device constraints. Completion, permissions, movement reconciliation and inventory writes require server validation. Duplicate offline replay must not duplicate counts or receipts. Do not promise unlimited offline storage or guaranteed camera support on every device.

## 3. Public-app identity: no-directory launch

Four distinct facts, never collapsed:

| Fact | Meaning | Launch default |
|---|---|---|
| App access | Shopify determines who may open the app | Required |
| Operation permission | Owner-authorized ProPo capability profile (approvals, cost visibility, stock adjustment, export, support) bound to that actor | Required; server-enforced |
| POS authenticated user | Session-token user from `getSessionToken` [V08] | Required for POS privileged effects |
| Pinned POS staff | PIN / `staffMemberId` currently using the device | Observation only; not authorization |

**Launch architecture (corrected):** Shopify sign-in and app-access controls, with no duplicate ProPo login. Bind **verified string actor identity** from the ID token (`sub` / verified user identifier string). Grant ProPo capabilities explicitly by the shop owner (or an owner-equivalent grant already proved). Unknown, revoked, or unassigned actors do not become admins.

**Forbidden launch dependencies:**

- `StaffMember` queries or `read_users`. Official 2026-07 StaffMember still requires `read_users` and a finance embedded app **or** Plus/Advanced, and says “Contact Shopify Support to enable.” Access-scopes still labels `read_users` as `shopify plus` / finance-embedded / Plus or Advanced + Support [V01]. Shopify staff commentary that public apps lack that trust model remains unresolved. Treat directory access as **unsupported until actually granted and tested**.
- Universal Shopify role import.
- Counting or authorizing from a Shopify staff dump.
- Enabling online access tokens. ID tokens authenticate the user and carry **no API permissions** [V02]. Offline tokens remain the default for background work. PR45 owner-proof and online-token hazards are not waived. Do not use numeric `associated_user.id` as an alternative actor source.
- Equating Shopify Admin staff limits with ProPo seats or billing truth.

Directory APIs are a later, separately proven, Support-granted enhancement. If they never become available, launch still works.

Store-permissions help (re-fetched 2026-09-22, previously 403 for the peer reviewer) distinguishes Admin store permissions, **app permissions** (“App permissions in the Shopify admin don't change or impact any permissions set up through apps”), and POS permissions managed through organization/POS roles [V02]. Shopify Admin Inventory “Manage inventory” is not ProPo authorization. POS-only staff do not have Shopify Admin access.

### 3.1 Seat examples (planning models, not billing enforcement)

Published as SE-01…SE-09 in RESEARCH_SOURCES.md:

| Example | Shopify picture | ProPo result |
|---|---|---|
| Owner-only Basic | Staff limit 0; owner exempt; directory unavailable | One assigned owner seat. Cannot dump staff. |
| Grow + POS-only | Grow 5 Admin staff + unlimited POS-only; owner exempt | Count **assigned** ProPo users only. Twelve POS-only staff are not twelve seats. |
| Collaborator | Unlimited exempt collaborator | Not an automatic ProPo seat. |
| Revoked access | Previously assigned staff loses app access | Not billable; queued jobs cannot complete privileged writes. |
| Unavailable directory | Advanced 15 limit exists in Help, but `read_users` not granted | Bill assigned ProPo users; do not invent a 15-person dump. |
| Pause and Build | Shopify Help: 1 admin user [V01] | Lifecycle/staff qualification only. Not ProPo entitlement or billing authority. |
| Pinned POS ≠ authenticated user | PIN staff cannot mint token | No automatic seat; privileged POS effects stay blocked. |

Access policy and paid seats remain separate. See PRICING_AND_BYOK_CHANGE_PROPOSAL.md. An unauthorized actor remains unauthorized even on the highest plan.

## 4. Reports and dates

Launch requires the complete accepted Stocky report catalog, plus a governed custom report builder: dataset, declared metrics/dimensions, filters, grouping, sorting, columns, period/time zone, saved view and CSV export. No arbitrary SQL. Filter joins must not multiply units/costs; totals and drilldowns reconcile. Saved/shared/scheduled reports re-check the requesting actor and export permissions at execution. Larger exports are asynchronous, tenant-scoped, signed/expiring and deletion-aware.

That builder is a packaging conflict with `/11` (core catalog versus Growth saved/scheduled views). Complete catalog + CSV on every paid plan remains the parity floor; saved/scheduled/custom-builder sophistication is PENDING OWNER APPROVAL in PRICING §4. Do not make the lower tier unable to finish a normal reporting question.

Distinguish last ordered date (qualifying committed supplier PO), last received date (posted receipt net of reversal policy) and last sold date. Display last ordered and last received prominently in the buying worksheet and variant detail; last sold is a separate useful metric. Missing pre-migration data is “unknown before coverage”, not “never purchased”. Define cancelled PO, partial receipt, return and backdated-import behavior. Support-assisted variant continuity must show an explicit lineage source and cannot manufacture historical events; see the stocktake/history document.

## 5. Cost and price writes

Stocky maintained average unit cost internally and documented optional sync of average costs to Shopify [V03]. Proposed default: internal moving-average/landed-cost ledger updates from **posted receipt events**; a merchant can deliberately enable a defined Shopify current-cost sync policy. Once the merchant selects an authorized cost update or completes a receipt under that policy, enqueue immediately and show pending/success/failed per line. Possessing `write_inventory` alone is not consent to change every cost automatically. Retail price and compare-at are separate `write_products` operations.

Latest purchase cost, supplier offer, landed cost, moving average, Shopify `unitCost` and historical COGS remain separate fields. A backdate action for older sales is explicitly approximate, previewed, versioned and auditable; it does not change Shopify history or overwrite actual historical evidence. A later compensation or unreceive does **not** guarantee restoration of all intervening average-cost states.

### 5.1 Historical Stocky behavior versus proposed ProPo contract

Stocky Help (fetched 2026-09-22) formula:

```text
new_average =
((current_average × current_stock_qty)
 + (landed_cost_of_received_stock × received_qty))
/
(current_stock_qty + received_qty)
```

Worked source example: 30 units at $10 and 15 received at $8 → ((10×30)+(8×15))/(30+15) = 420/45 = $9.33 USD (Help’s published rounding).

Stocky documents **two exceptions when that formula is not used**:

1. “When a purchase order is **created** for a variant that currently has a negative stock quantity.” Average becomes the landed cost of received stock.
2. “When a purchase order is **created** that has a negative Received Stock Quantity which is greater than the Current Stock Quantity, resulting in an overall negative stock level.” Average does not change.

**Timing qualification:** the Help page describes exceptions at **PO create**, while the ordinary formula is illustrated on receiving. That wording is historical source behavior, not proof of Stocky’s exact runtime, and not yet live-proved for ProPo.

**Proposed ProPo contract** (apply at **posted receipt**, not PO create; pending owner rounding approval):

| Situation | Proposed result | Example |
|---|---|---|
| Ordinary positive receipt | Formula, decimal-safe; merchant display 2 dp ROUND_HALF_EVEN | C-01: 30@$10 + 15@$8 → **$9.33** (not $9.333 stored as binary float) |
| Current qty **< 0** and received **> 0** | Average **:= landed of this receipt** (exception 1 analogue) | C-02: −4@$10 then +10@$8 → **$8.00**. Naive formula $6.67 is **wrong** |
| Received **< 0** and resulting qty **< 0** | Average **unchanged** (exception 2 analogue) | C-03: 3@$10 then −5@$8 → resulting −2, average **$10.00** |
| Resulting qty **= 0** | **Deny**; keep prior; do not divide by zero | C-04 |
| Missing landed / missing current average with nonzero stock | **Deny**; unknown ≠ $0 | C-05, C-08, C-09 |
| Current qty 0 then first positive receipt with known landed | Formula equals landed | C-06: 0 then +5@$7 → **$7.00** |
| Negative receipt that **stays non-negative** | Formula | C-07: 10@$10 then −3@$8 → **$10.86** |
| Sales return restock without an explicit cost basis | **Deny**; do not invent historical COGS | C-08 |
| Later unreceive after other receipts | New posted event only; **no restore guarantee** | C-10 happens to return to $10.00 in that sequence; that is not a general inverse |

Landed-cost basis remains Stocky’s PO-level landed margin (subtotal + adjustments + shipping) / subtotal, then variant base cost × margin [V03]. Additional allocations in product/02 may exist later but must reconcile exactly with deterministic rounding.

Internal ledger, optional Shopify `unitCost` sync, and historical approximation stay separate. Automatic Stocky-style sync “overwrites the existing cost per item value in your Shopify admin and can't be undone” [V03] — ProPo must require explicit selected-policy consent and show irreversibility. Cost uses `inventoryItemUpdate`/`write_inventory`; base price and compare-at use `productVariantsBulkUpdate`/`write_products`, with separate ProPo permissions and exact source/version readback. Revalidate against the pinned 2026-07 schema before implementation. Retail-price changes never occur simply because a receipt's cost changed. Market/catalog prices need their own contract. Reference-price claims require truthful history and market rules; no fabricated savings. Scheduled reversals must not overwrite another later editor's change.

## 6. Integrations and future ecosystem

Launch spine: Shopify Admin/POS, required privacy/sync, reliable PO email/PDF/CSV and product-label output. Shopify Flow is a supported operational extension in its owning phase and remains a `/11` Growth packaging item until the owner says otherwise. Include print/export adapters for actual pilot label hardware (PDF/browser; evaluated ZPL where appropriate), not a dependency on an unspecified competing barcode app. A label image/PDF is not proof every printer works.

Next after ledgers stabilize: one tested QuickBooks Online or Xero purchasing/invoice/credit integration; then the other. Keep vendor bill, PO commitment, receipt, payment and COGS authority explicit. No silent two-way bookkeeping or new general ledger. Pilot-driven WMS/3PL and bundle components follow only with field ownership/echo suppression. Direct integration with competing inventory apps is usually migration/read-only coexistence first, not two simultaneous writers.

Public API has three future audiences: compatible Shopify apps; enterprise customers; and ProPo's own later BYOK assistants. Define versioned tenant/app/resource identities, narrow OAuth/service scopes, pagination, idempotent command binding, signed retryable event webhooks, external-ID maps and revocation. Do not share Shopify access tokens with sibling apps. An IVYY ecosystem needs merchant-authorized per-app permissions/consent and contracts, not unrestricted cross-app tables. Event-driven eventual consistency with reconciliation/freshness is the honest target, not absolute realtime across providers.

## 7. Research and acceptance

Test the proposed Home and grouped navigation against the existing approved navigation with all four merchant cohorts. Validate finding a draft, explaining a quantity, partial receipt recovery, report creation and live-count conflicts. Target WCAG 2.2 AA, keyboard and screen-reader operation, touch targets, focus restoration and locale expansion. Public Apple design principles inform clarity and predictable behavior; no private Apple engineering claims or copied trade dress.

No usability survey or current application E2E was executed in this revision. Device capability, permission binding, report correctness and write safety remain executable acceptance gates rather than design assertions.
