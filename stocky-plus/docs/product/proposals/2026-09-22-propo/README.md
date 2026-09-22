# ProPo — revised product and software-company plan

**Revision 2 / 2026-09-22 — PROPOSED, NOT IMPLEMENTATION AUTHORITY.** This revision incorporates the owner's detailed answers, replaces the earlier fifteen-toggle product presentation, and expands the operator/business plan. Required sequence: source-backed R&D -> separate Cursor critique -> actual Claude review -> consolidated corrections -> final owner decision. Agreement among models is not legal certification or evidence of an implemented feature.

## 1. The actual launch promise

ProPo is a public Shopify App Store product operated by IVYY LLC. The first public paid release must cover the complete approved Stocky-parity workflow: vendor versus supplier management, six parity forecasting methods/ABC-U, purchase orders and settings, email/documents/exports, receiving/corrections, costing, inventory/stocktakes/transfers, labels/POS, reporting, permissions, migration and supportable operations. It is NOT a Buffalo-only procurement application or a purchase-order-only MVP. Internal incremental acceptance milestones are allowed; they must not be marketed as the finished public app.

“Duplicate Stocky” means documented behavior with original ProPo branding, deliberate recorded improvements and current Shopify compatibility, not copying protected assets or reproducing known unsafe behavior. Preserve the approved roadmap and safety gates; this proposal does not authorize all phases at once.

The owner wants a future family of interoperable IVYY Shopify apps, but ProPo is the only current product. Design stable tenant/app identity and bounded events, not a shared unrestricted ERP database or extra apps now. Shopify remains the commerce/stock authority.

## 2. Owner decisions versus R&D recommendations

| ID | Owner clarification | Revision-2 disposition |
|---|---|---|
| O2-01 | Complete Stocky replacement, public distribution | Full parity plus viable operator support/billing is the launch boundary; no implicit scope reduction |
| O2-02 | Mixed sizes and locations for testing | Four-cohort validation matrix; recruit separately, do not invent participating stores |
| O2-03 | Simple out-of-box behavior, not fifteen toggles | Normal parity workflow + curated diagnostics + one separate Smart/scenario surface later |
| O2-04 | Budget only if worthwhile/standard | OTB exists in established planning products, but keep budget/OTB report-only research and defer automatic quantity allocation |
| O2-05 | Computer ordering; mobile/POS receiving and counting | Responsive Admin plus dedicated POS receive/count entry points; safe offline capture is not offline finalization |
| O2-06 | Stocktakes while trading, better reports and last-purchase date | Prioritize movement-aware counts, a governed report builder, and separate last ordered/received/sold dates |
| O2-07 | Deleted/recreated variant helpdesk repair | Support-assisted, merchant-approved lineage view; never silently reassign Shopify IDs or raw financial history |
| O2-08 | Cost writes after user selects; average costing | Explicit receipt/cost-sync policy; internal valuation remains separate from Shopify current cost and historical approximation |
| O2-09 | Shopify users/roles, tiered seats | Use Shopify identity; full role import cannot be promised across plans; narrow ProPo capabilities and explicit ProPo-seat policy |
| O2-10 | Shopify/POS/Flow, accounting and barcode integrations | Core native channels first; accounting adapters after ledgers, printer/export compatibility, pilot-driven other apps |
| O2-11 | Compatible apps, enterprise API, future own AI key | Versioned scoped APIs; generative AI later/BYOK only, no ProPo-issued credits |
| O2-12 | Routine merges without owner relay | Separate PR53 bounded delegation proposal; inactive until final owner approval and actual guards |
| O2-13 | No paid AI overages; checkpoint at quota | Preserve provider settings; scheduled resume only with verified route/status and no duplicate writer |
| O2-14 | Serious alerts, daily summary, milestones | Owner notification plan, no implied email configuration |
| O2-15 | US/Canada English; assess French/Spanish | English launch baseline; French-Canadian next priority, Spanish next candidate; language does not authorize countries |
| O2-16 | Domain/email pending; no lawyer budget | Open launch setup items; AI-assisted legal drafts and source verification, no false counsel sign-off or waiver of existing Q-008 gate |

Current main X `f057d98c8a321b3e06875a6e9a83b787bcbc101f` and frozen PR45 H `3cc2045107b54601c6b0e43c8690b7d090074b80` were re-read. H and prior reviews remain unchanged. PR6 CLOSED, Phase 1 IN PROGRESS, R-176 OPEN/P0, R-164 unchanged, Q-008 OPEN, D-054/no D-055. The attached historical PR49/PR45 reports are evidence at their named revisions, not new live-state authority. No live merchant query, product-code test, legal representation or survey occurred in this R&D.

## 3. Reading order

1. This owner-decision and scope register.
2. DECISION_ENGINE.md — simple default product, reports and later Smart layer.
3. LIVE_STOCKTAKE_AND_HISTORY.md — open-store counting, last-purchase dates and support lineage.
4. UX_AND_INTEGRATIONS.md — navigation, surfaces, user identity and integration boundaries.
5. SOFTWARE_COMPANY_OPERATIONS.md — operator plane, billing, support, communications and costs.
6. PRICING_AND_BYOK_CHANGE_PROPOSAL.md — proposed changes to approved product/11.
7. LEGAL_AND_TRUST_READINESS.md, BRAND_MIGRATION.md, RESEARCH_SOURCES.md.

## 4. Mixed testing is not a distribution question

The earlier question about testers was about evidence, not whether the product is public. Public distribution is already settled. Proposed recruitment: at least two consenting merchants in each of four cells where feasible: smaller single-location, smaller multi-location, larger single-location, larger multi-location. These are research targets, not named enrolled merchants or statistical representativeness.

Define size by active variants, order lines, receipts, concurrent staff and integration volume, not revenue alone. Include Admin owners/buyers, POS-only staff and receivers; different device types; returns/partial receipts; bundles where supported; deleted/recreated IDs; and a working store during counting. Document recruited/blocked cohorts and data permissions. Synthetic load tests cannot replace all merchant usability validation; merchant anecdotes cannot replace tenant/security tests.

## 5. Release and sequencing

Finish the foundation and independently accepted PR7 first. Then complete the approved parity modules in dependency order, with parallel work only on frozen independent contracts. Build the minimum operator support/billing/privacy/runbook capability before public release. Core reports, settings, export and POS workflows remain core, not paid extras needed to make a lower tier usable.

Later Smart may improve drafts only through an explicit separate user action and an auditable comparison; it does not replace parity, corrupt facts or double-count incoming/safety. Generative AI and BYOK are after launch/initial testing. Budget/OTB/forward-buy optimization, a general ERP and speculative integrations are not new initial release blockers.

## 6. Decision-quality gates

Every accepted increment needs a workflow/authority and data-definition contract; relevant API capability proof; permissions/entitlements; reproducible calculations; error/partial/unknown and recovery states; UI/mobile/POS/export cases; cost/operational envelope; and independent review. No exact delivery date or completion percentage is established here.

Before final approval reconcile changes against product/02, /04, /06, /09 and especially /11. This proposal explicitly differs from /11's included AI credits and existing seat numbers. Do not silently overwrite approved pricing or market those old limits as the newly approved plan. Disagreements and unavailable Shopify capabilities go to the owner as a compact decision list after review, not endless broad re-planning.
