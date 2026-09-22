# ProPo — UX, API and integration proposal

**PROPOSED / NOT IMPLEMENTATION AUTHORITY.** Research references are in RESEARCH_SOURCES.md. Product principles are informed by public Apple HIG, Shopify App Design Guidelines and WCAG, not by privileged knowledge of Apple's engineering process [R08–R10].

## 1. Product experience principles

Be distinctive in useful workflows, not incompatible controls. Use Shopify-native navigation and supported components, exact variant/location identity, clear action hierarchy, progressive disclosure and immediate durable feedback. Do not imitate Apple's branding, copy a glass aesthetic into dense purchasing tables, or add a second sidebar inside Shopify.

Design around jobs: what needs attention, what should I order, where is it, what arrived, what changed and what can I trust? Buyers need a fast keyboard grid; receivers need a resumable scanning workflow; owners need cash/risk summaries; auditors need source evidence. One ornamental dashboard cannot replace these surfaces.

The approved PRD currently names twelve top-level areas. Do not silently replace it. Test the following grouping as a proposed information architecture before a change decision:

| Workspace candidate | Pages and responsibilities |
|---|---|
| Home | Data health, exceptions needing action, late POs/receipts, recent work; no wall of vanity metrics |
| Plan | Replenishment, compare scenarios, lifecycle/stock-risk exceptions; saved views |
| Purchase | Purchase orders, Receiving, Suppliers; destination and cost context always visible |
| Inventory | Variant/location stock, stocktakes, transfers, labels and aging drilldowns |
| Reports | Governed report catalog, saved/scheduled exports, definitions and data freshness |
| Settings | Locations, decision policies, roles, integrations/API, notifications, costs/pricing, billing, privacy |

Frequent receiving/count tasks need direct links/POS tiles even if grouped. Test the existing twelve-area navigation against this grouping; choose by task completion and findability, not aesthetic preference. “Integrations” means connections/configuration; it is not a second operational source of truth.

## 2. Screen and interaction contracts

The planning grid has sticky identity columns, location/supplier/UOM, editable final quantity, saved column/view configuration, keyboard navigation, non-destructive sort/filter and persistent row errors. An explanation drawer includes source dates, baseline, applied policy, confidence, constraints, cost impact and explicit unknowns. Show units and cases together, not a number that changes meaning by page.

Editing must survive filtering, network retries and refresh where the workflow promises recovery. Distinguish unsaved edits from saved drafts; warn before destructive navigation. Optimistic UI cannot claim a Shopify write succeeded before the operation is confirmed. Partial results keep line-level retry/reconciliation states. Labels and exports read the same price/unit version as the screen.

Policy setup is outcome-oriented: protect availability, limit cash exposure, avoid obsolete buying. Advanced controls reveal method details, but a merchant can still inspect every formula and resolved setting. “Apply to draft” is separate from “Approve and send.” Bulk actions preview affected entities, quantities, amounts and warnings. Permissions are enforced server-side, including cost visibility in CSVs and background reports.

Responsive behavior includes touch scanning, large enough targets, readable price/unit labels, focus management and no dependence on hover or color alone. Adopt WCAG 2.2 AA as a design/test target; meeting it is not a blanket legal-accessibility certification [R10]. Prefer a single accessible control over custom gestures. Test zoom, keyboard, screen-reader names, error association, focus restoration, localization expansion and dates/currencies.

Proposed usability acceptance: a buyer can identify a recommendation's source and edit it without losing work; a receiver can pause/resume a partial receipt and identify a failed line; an owner can see why a budget is infeasible; a staff user cannot find privileged data through export/API despite hidden UI; a merchant can locate any policy from the affected recommendation. Baseline timing and error thresholds must be set after real pilot observation, not invented here.

## 3. Market desk research and integration priorities

Prediko's published help pages cover WMS/3PL, ShipHero, bundles and accounting topics; Inventory Planner lists Shopify, accounting, ERP and fulfillment integrations [R11/R12]. This confirms that integrations and advanced forecasting are not unique claims for ProPo. Vendor pages do not prove connector reliability, actual ROI, market share or that every advertised connector has equal capability.

Prioritize by merchant job and authority boundary:

| Sequence | Integration | Value and boundary |
|---|---|---|
| Core | Shopify Admin/POS, consented catalog/history, documented exports | Existing source of truth and operating surface; never infer native PO/incoming capability from UI alone |
| Early extension | Shopify Flow triggers/actions; email and controlled report notifications | Replenishment/PO/receipt exceptions; send references/minimal facts, not raw customer payloads |
| After ledger stability | Accounting export, then a selected QuickBooks Online or Xero adapter | Bills/credits/cost summaries with reconciliation and explicit accounting authority; not a new general ledger |
| Pilot-driven | ShipHero or another actual pilot WMS/3PL | PO/receiving/stock flow with direction and ownership declared per field; avoid dual inventory writers |
| Validated need | Shopify Bundles / selected bundle app | Component demand conversion and mappings, never double-count bundle plus components |
| Later | Supplier price lists/EDI, spreadsheets/BI, public partner API | Cost/offer imports and analytics; exact external IDs, permissions and versioned contracts |

Do not build direct links to every competing inventory system initially. Another app that owns the same inventory/PO/cost state can create loops and duplicate incoming. Support coexistence only with an explicit ownership matrix and echo suppression, or a one-time migration/import path. No real connector was installed or tested in this research.

## 4. Public API roadmap

Design versioned internal service boundaries now; ship customer-facing API contracts only when stable. First surface read-only operational exports, report definitions and approved event webhooks. Later enable write APIs through the same authorization, command, audit and reconciliation services as the UI. Never expose raw SQL or database table delegates as the public API.

Proposed requirements: scoped OAuth/service identities; shop binding independent of supplied IDs; separate read-cost/write-cost/write-price/write-inventory permissions; paginated bounded results; deterministic decimal/currency/UOM encoding; schema versions and deprecation policy; per-tenant quota/cost limits; immutable operation IDs; retry-safe idempotency with payload binding; asynchronous job/result endpoints; signed webhooks with replay protection and retry/dead-letter visibility; secret rotation and uninstall revocation; sandbox examples and contract tests.

Use server-side external-ID maps qualified by tenant/provider/type. SKU/barcode is not a unique historical identity. Define webhook delivery as potentially duplicated/out of order; do not promise exactly once. Sender filters and endpoint verification must mitigate SSRF and accidental export. An app token cannot become a merchant's arbitrary other-app token. Redaction/retention applies to API caches, delivery logs and exported objects as well as tables.

Example future resource families: suppliers, offers, purchase orders, receipts, recommendations, policy versions, reports, async operations and audit references. This is a proposal, not published endpoints or a compatibility commitment.

## 5. Shopify cost and price write capabilities

Current official API documentation checked 2026-09-22 (the versioned 2026-07 route redirected to current documentation). Revalidate against the project's pinned stable schema when implementing [R05–R07].

| Capability | Documented mutation/fields | Required Shopify scope family | ProPo gate |
|---|---|---|---|
| Cost per inventory item | `inventoryItemUpdate` with `InventoryItemInput.cost` | `write_inventory`, plus Shopify user permission where applicable | Cost read/write separation, approved cost authority and bounded sync policy |
| Base variant selling price | `productVariantsBulkUpdate`, input `price` | `write_products`, plus applicable product permissions | Price-edit role, before/after preview, expected-value conflict checks and readback |
| Base compare-at price | Same variant mutation, `compareAtPrice` | `write_products` | Reference-price evidence and market/legal policy; null is distinct from zero |

These scopes are not a claim that the app currently requests, has or is authorized to use them. They are also not separate Shopify grants per individual cost or compare-at field; ProPo must supply narrower application authorization. Optional scopes should be requested only for configured capabilities where Shopify supports that activation pattern. Do not ask for every write scope during onboarding merely because other apps advertise it.

Shopify `unitCost`, PO purchase cost, landed/average cost and accounting COGS are distinct values. Changing today's Shopify cost must not rewrite past receipt valuations or imply historical COGS was recalculated. Market/catalog price lists and tax-included contexts need their own contract; a base variant price update does not guarantee every contextual price changed.

Write workflow: choose source and authority -> preview -> validate decimal/UOM/currency and permission -> capture expected current values -> approve bounded batch -> execute through operation journal -> inspect userErrors and partial results -> read back -> reconcile -> publish accurate status. Preserve another app's concurrent changes rather than last-writer-wins overwrite. A scheduled sale reversal applies only if the current values still match the values the schedule owns. An uncertain response requires readback before retry.

`allowPartialUpdates` on the variant bulk mutation changes failure behavior; do not treat a transport success as all lines updated. Shopify transaction/compare-and-set support varies; identify actual mutation guarantees before promising atomicity. Merchant-facing audit and undo must distinguish safe compensation from irreversible or externally changed state.

## 6. Price-history and legal constraints

Compare-at is data, not legal evidence of a real prior selling price. Capture price history with product/variant, market/channel, currency, tax/display basis, effective dates and source. EU price-reduction rules generally refer to the lowest prior price over the prescribed thirty-day period, subject to applicable exceptions; U.S. price-comparison claims must be truthful [R17/R18]. Never auto-inflate a reference price to manufacture a saving.

A pricing engine is distinct from replenishment optimization. Do not add cross-merchant nonpublic pricing coordination or autonomous competitive repricing to this project through a cost-write feature. Legal and API acceptance are both required before sale automation is enabled.

## 7. Delivery and acceptance

No new UI or connector is implemented by this dossier. Before a corresponding phase starts, create a task-level design: actual routes/components, workflow states, permission/entitlement matrix, field vocabulary, loading/empty/partial/error designs, keyboard/POS behavior and measured performance budgets. Test the full workflow including exports/retries, not just visual screenshots. Reuse existing product navigation until a reviewed change is accepted.
