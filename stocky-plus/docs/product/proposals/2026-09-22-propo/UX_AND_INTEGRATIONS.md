# ProPo — daily experience, permissions and integrations

**Revision 2 / PROPOSED.** Use source register V01–V23. No UI, scopes, Shopify account roles or connectors were changed.

## 1. Default Home: operational attention, not a finance dashboard wall

Stocky's documented low-stock reports prioritize variants/vendors at risk, with open-order visibility [V04/V05]. Use that workflow as research input, not a claim that its historical exact home screen has been reconstructed.

Proposed Home order: (1) persistent freshness/sync and critical reconciliation banner; (2) Resume my work (draft PO, receipt, active stocktake); (3) Needs attention (stock risk, late POs, receipt/count conflicts) with clear destination; (4) Plan an order and Receive/Count shortcuts; (5) a restrained inventory-value/stock-cover summary and reports link. Scope by permitted location and role; do not expose costs to staff because a card is convenient. Newly installed shops see onboarding progress and missing data, not misleading zero metrics.

Retain the approved information architecture until usability comparison is accepted. Candidate grouping: Home; Plan; Purchase (POs, Receiving, Suppliers/Vendors); Inventory (stock, counts, transfers, labels); Reports; Settings. Receiving/count need direct shortcuts and POS tiles even when grouped. No fifteen strategy menu items or second embedded sidebar.

Large desktop grid: stable variant identity, supplier SKU/UOM, location, available/incoming, last ordered/received dates, costs where allowed, suggested and final quantity, warnings. Keyboard navigation, saved views/columns, undo-before-commit, unsaved-change protection and explicit partial failures are core. Mobile uses row cards/detail and retained work rather than squeezed desktop columns. Quantities always state units/cases; financial values state currency/tax basis. UI state must not claim confirmed external writes before readback.

## 2. Surface contract

Desktop Admin: full purchasing/report-building and bulk review. Mobile Shopify Admin: responsive PO/receiving/lookup/count where embedded browser capabilities permit. POS: separate Receive PO and Stocktake tiles, barcode/camera scanning and staff/location-aware recovery. Browser camera availability is a device/permission capability to verify, not assumed from the POS Scanner API [V07].

POS session token represents the authenticated user, not necessarily the staff member currently using a PIN. Shopify explicitly distinguishes these identities [V08]. A client-supplied pinned staff ID is not server authorization. Revalidate staff switch, location change, token expiry and permission change. Unknown binding stays blocked for privileged effects; do not use the logged-in owner's authority for every pinned staff member.

Offline may capture scans locally with stable IDs and clear unsynced status only within proven storage/device constraints. Completion, permissions, movement reconciliation and inventory writes require server validation. Duplicate offline replay must not duplicate counts or receipts. Do not promise unlimited offline storage or guaranteed camera support on every device.

## 3. Shopify identity is not a universal role-directory API

Use Shopify sign-in and app-access controls, with no duplicate ProPo login. The verified ID token carries identity, not all permissions. Online tokens can reflect an individual user's authorized scope, whereas offline credentials do not become staff authorization simply because the request contains a user ID [V02].

The StaffMember/read_users API is restricted and requires access approval/eligible contexts. Official GraphQL docs mention Advanced/Plus/finance eligibility; a Shopify staff response also flags public-app restrictions. Do not promise a full staff/role import on Basic/Grow or assume a directory dump is available for this public app [V01]. Role names are not a portable permission contract.

Proposed low-friction solution: Shopify determines login/app access; ProPo binds exact staff identity and narrow app-only permissions for purchasing approvals, cost visibility, stock adjustment, report export and support actions. Use proven Shopify user permissions where available, plus simple owner-approved ProPo capability profiles when Shopify exposes no equivalent. No second user account/password system. Unknown/revoked/unassigned actors do not become admins. The existing PR45 owner-proof and online-token hazards are not waived by this product preference; global online-token enablement remains disabled until its accepted binding proof.

Access policy and paid seats are separate. See PRICING_AND_BYOK_CHANGE_PROPOSAL.md. Never count all Shopify users as ProPo users, assume POS-only staff consume Shopify Admin seats, or use billing status to grant owner permissions. An unauthorized actor remains unauthorized even on the highest plan.

## 4. Reports and dates

Launch requires the complete accepted Stocky report catalog, plus a governed custom report builder: dataset, declared metrics/dimensions, filters, grouping, sorting, columns, period/time zone, saved view and CSV export. No arbitrary SQL. Filter joins must not multiply units/costs; totals and drilldowns reconcile. Saved/shared/scheduled reports re-check the requesting actor and export permissions at execution. Larger exports are asynchronous, tenant-scoped, signed/expiring and deletion-aware.

Distinguish last ordered date (qualifying committed supplier PO), last received date (posted receipt net of reversal policy) and last sold date. Display last ordered and last received prominently in the buying worksheet and variant detail; last sold is a separate useful metric. Missing pre-migration data is “unknown before coverage”, not “never purchased”. Define cancelled PO, partial receipt, return and backdated-import behavior. Support-assisted variant continuity must show an explicit lineage source and cannot manufacture historical events; see the stocktake/history document.

## 5. Cost and price writes

Stocky maintained average unit cost internally and documented optional sync average costs to Shopify [V03]. Proposed default: internal moving-average/landed-cost ledger updates from posted receipt events; a merchant can deliberately enable a defined Shopify current-cost sync policy. Once the merchant selects an authorized cost update or completes a receipt under that policy, enqueue immediately and show pending/success/failed per line. Possessing write_inventory alone is not consent to change every cost automatically.

Latest purchase cost, supplier offer, landed cost, moving average, Shopify unitCost and historical COGS remain separate fields. A backdate action for older sales is explicitly approximate, previewed, versioned and auditable; it does not change Shopify history or overwrite actual historical evidence. Negative stock and reversals use the approved parity specification, not an invented generic averaging shortcut.

Cost uses inventoryItemUpdate/write_inventory; base price and compare-at use productVariantsBulkUpdate/write_products, with separate ProPo permissions and exact source/version readback. Revalidate against the pinned schema before implementation. Retail-price changes never occur simply because a receipt's cost changed. Market/catalog prices need their own contract. Reference-price claims require truthful history and market rules; no fabricated savings. Scheduled reversals must not overwrite another later editor's change.

## 6. Integrations and future ecosystem

Launch spine: Shopify Admin/POS, required privacy/sync, reliable PO email/PDF/CSV and product-label output. Shopify Flow is a supported operational extension in its owning phase. Include print/export adapters for actual pilot label hardware (PDF/browser; evaluated ZPL where appropriate), not a dependency on an unspecified competing barcode app. A label image/PDF is not proof every printer works.

Next after ledgers stabilize: one tested QuickBooks Online or Xero purchasing/invoice/credit integration; then the other. Keep vendor bill, PO commitment, receipt, payment and COGS authority explicit. No silent two-way bookkeeping or new general ledger. Pilot-driven WMS/3PL and bundle components follow only with field ownership/echo suppression. Direct integration with competing inventory apps is usually migration/read-only coexistence first, not two simultaneous writers.

Public API has three future audiences: compatible Shopify apps; enterprise customers; and ProPo's own later BYOK assistants. Define versioned tenant/app/resource identities, narrow OAuth/service scopes, pagination, idempotent command binding, signed retryable event webhooks, external-ID maps and revocation. Do not share Shopify access tokens with sibling apps. An IVYY ecosystem needs merchant-authorized per-app permissions/consent and contracts, not unrestricted cross-app tables. Event-driven eventual consistency with reconciliation/freshness is the honest target, not absolute realtime across providers.

## 7. Research and acceptance

Test the proposed Home and grouped navigation against the existing approved navigation with all four merchant cohorts. Validate finding a draft, explaining a quantity, partial receipt recovery, report creation and live-count conflicts. Target WCAG 2.2 AA, keyboard and screen-reader operation, touch targets, focus restoration and locale expansion. Public Apple design principles inform clarity and predictable behavior; no private Apple engineering claims or copied trade dress.

No usability survey or current application E2E was executed in this revision. Device capability, permission binding, report correctness and write safety remain executable acceptance gates rather than design assertions.
