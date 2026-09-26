# ProPo — revised product and software-company plan

**Revision 2 successor / 2026-09-22 — PROPOSED, NOT IMPLEMENTATION AUTHORITY.** This successor corrects P1 research/proposed contracts after independent Cursor peer review. Required sequence remains: source-backed R&D -> separate Cursor critique -> this correction -> actual Claude review -> final owner decision. Agreement among models is not legal certification or evidence of an implemented feature. No application implementation, store mutation, /11 edit, or self-acceptance is authorized here.

## 0. Correction identity

| Field | Value |
|---|---|
| Subject P1 | `fb6ca876f6a6612692e7d9187dc3c815eae156ad` |
| Parent P0 | `c379bc0d078d80e33db751bbb23f37289329fbce` |
| Main / base X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` |
| Frozen PR45 H | `3cc2045107b54601c6b0e43c8690b7d090074b80` — **untouched** |
| Peer review (not integrated) | branch `review/pr54-r2-cursor-20260922-51ac`; commit `4cde7146d8eaf52728394491f04450cc83130777`; sole parent P1; blob `1aba6763f73d2a0a58470300aa40a2e8e42ae56b`; path `CURSOR_REVIEW_R2.md` on that review branch only |
| This correction | existing nine proposal files only; no new file; review artifact not copied into this PR |
| Control facts | PR6 CLOSED via PR47; Phase 1 IN PROGRESS; R-176 OPEN/P0; R-164 unchanged; Q-008 OPEN; D-054 EFFECTIVE; no D-055; PR7 runtime not authorized |

## 1. The actual launch promise

ProPo is a public Shopify App Store product operated by IVYY LLC. The first public paid release must cover the complete approved Stocky-parity workflow: vendor versus supplier management, six parity forecasting methods/ABC-U, purchase orders and settings, email/documents/exports, receiving/corrections, costing, inventory/stocktakes/transfers, labels/POS, reporting, permissions, migration and supportable operations. It is NOT a Buffalo-only procurement application or a purchase-order-only MVP. Internal incremental acceptance milestones are allowed; they must not be marketed as the finished public app.

“Duplicate Stocky” means documented behavior with original ProPo branding, deliberate recorded improvements and current Shopify compatibility, not copying protected assets or reproducing known unsafe behavior. Preserve the approved roadmap and safety gates; this proposal does not authorize all phases at once.

The owner wants a future family of interoperable IVYY Shopify apps, but ProPo is the only current product. Design stable tenant/app identity and bounded events, not a shared unrestricted ERP database or extra apps now. Shopify remains the commerce/stock authority.

Public-app launch identity is **no StaffMember directory**. Authenticated exact-string Shopify identity plus owner-authorized ProPo capabilities is the default. `read_users` / StaffMember is optional, separately proven, and never a launch or seat-count dependency. See UX_AND_INTEGRATIONS.md §3.

## 2. Owner decisions versus R&D recommendations

| ID | Owner clarification | Revision-2 disposition |
|---|---|---|
| O2-01 | Complete Stocky replacement, public distribution | Full parity plus viable operator support/billing is the launch boundary; no implicit scope reduction |
| O2-02 | Mixed sizes and locations for testing | Four-cohort validation matrix; recruit separately, do not invent participating stores |
| O2-03 | Simple out-of-box behavior, not fifteen toggles | Normal parity workflow + curated diagnostics + one separate Smart/scenario surface later |
| O2-04 | Budget only if worthwhile/standard | OTB exists in established planning products, but keep budget/OTB report-only research and defer automatic quantity allocation |
| O2-05 | Computer ordering; mobile/POS receiving and counting | Responsive Admin plus dedicated POS receive/count entry points; safe offline capture is not offline finalization. POS-as-core vs `/11` Growth remains PENDING OWNER APPROVAL |
| O2-06 | Stocktakes while trading, better reports and last-purchase date | Movement-aware counts are a development target; public listing must not claim guaranteed live accuracy before the controlled-store capability matrix |
| O2-07 | Deleted/recreated variant helpdesk repair | Support-assisted, merchant-approved lineage view; never silently reassign Shopify IDs or raw financial history |
| O2-08 | Cost writes after user selects; average costing | Explicit receipt/cost-sync policy; internal valuation remains separate from Shopify current cost and historical approximation; Stocky negative-stock exceptions are now in the proposed contract |
| O2-09 | Shopify users/roles, tiered seats | Launch: verified string actor identity + owner-authorized ProPo capabilities. No StaffMember/`read_users` dependency, no universal role import, no online-token enablement. Directory access is optional and separately proven |
| O2-10 | Shopify/POS/Flow, accounting and barcode integrations | Core native channels first; accounting adapters after ledgers, printer/export compatibility, pilot-driven other apps |
| O2-11 | Compatible apps, enterprise API, future own AI key | Versioned scoped APIs; generative AI later/BYOK only, no ProPo-issued credits. Exact `/11` conflicts are tabulated, not silently overwritten |
| O2-12 | Routine merges without owner relay | Separate PR53 bounded delegation proposal; inactive until final owner approval and actual guards |
| O2-13 | No paid AI overages; checkpoint at quota | Preserve provider settings; scheduled resume only with verified route/status and no duplicate writer |
| O2-14 | Serious alerts, daily summary, milestones | Owner notification plan, no implied email configuration |
| O2-15 | US/Canada English; assess French/Spanish | English launch baseline; French-Canadian next priority, Spanish next candidate; language does not authorize countries |
| O2-16 | Domain/email pending; no lawyer budget | Open launch setup items; AI-assisted legal drafts and source verification, no false counsel sign-off or waiver of existing Q-008 gate |

Current main X `f057d98c8a321b3e06875a6e9a83b787bcbc101f` and frozen PR45 H `3cc2045107b54601c6b0e43c8690b7d090074b80` were re-read. H and prior reviews remain unchanged. PR6 CLOSED, Phase 1 IN PROGRESS, R-176 OPEN/P0, R-164 unchanged, Q-008 OPEN, D-054/no D-055. The attached historical PR49/PR45 reports are evidence at their named revisions, not new live-state authority. No live merchant query, product-code test, legal representation or survey occurred in this R&D.

## 3. Reading order

1. This owner-decision, correction identity and finding crosswalk.
2. DECISION_ENGINE.md — simple default product, reports and later Smart layer.
3. LIVE_STOCKTAKE_AND_HISTORY.md — on_hand mapping, mutation verification gate, open-store counting, last-purchase dates and support lineage.
4. UX_AND_INTEGRATIONS.md — navigation, no-directory identity, cost exceptions and integration boundaries.
5. SOFTWARE_COMPANY_OPERATIONS.md — operator plane, billing, support, communications and costs.
6. PRICING_AND_BYOK_CHANGE_PROPOSAL.md — row-by-row proposed changes to approved product/11.
7. LEGAL_AND_TRUST_READINESS.md, BRAND_MIGRATION.md, RESEARCH_SOURCES.md (including published planning-model fixtures).

## 4. Mixed testing is not a distribution question

The earlier question about testers was about evidence, not whether the product is public. Public distribution is already settled. Proposed recruitment: at least two consenting merchants in each of four cells where feasible: smaller single-location, smaller multi-location, larger single-location, larger multi-location. These are research targets, not named enrolled merchants or statistical representativeness.

Define size by active variants, order lines, receipts, concurrent staff and integration volume, not revenue alone. Include Admin owners/buyers, POS-only staff and receivers; different device types; returns/partial receipts; bundles where supported; deleted/recreated IDs; and a working store during counting. Document recruited/blocked cohorts and data permissions. Synthetic load tests cannot replace all merchant usability validation; merchant anecdotes cannot replace tenant/security tests.

## 5. Release and sequencing

Finish the foundation and independently accepted PR7 first. Then complete the approved parity modules in dependency order, with parallel work only on frozen independent contracts. Build the minimum operator support/billing/privacy/runbook capability before public release. Core reports, settings, export and POS workflows remain core, not paid extras needed to make a lower tier usable — **except where the `/11` crosswalk records a PENDING OWNER APPROVAL packaging choice**.

Later Smart may improve drafts only through an explicit separate user action and an auditable comparison; it does not replace parity, corrupt facts or double-count incoming/safety. Generative AI and BYOK are after launch/initial testing. Budget/OTB/forward-buy optimization, a general ERP and speculative integrations are not new initial release blockers.

## 6. Decision-quality gates

Every accepted increment needs a workflow/authority and data-definition contract; relevant API capability proof; permissions/entitlements; reproducible calculations; error/partial/unknown and recovery states; UI/mobile/POS/export cases; cost/operational envelope; and independent review. No exact delivery date or completion percentage is established here.

Before final approval reconcile changes against product/02, /04, /06, /09 and especially /11. The exact colliding `/11` rows are now in PRICING_AND_BYOK_CHANGE_PROPOSAL.md §4. Do not silently overwrite approved pricing or market those old limits as the newly approved plan. Remaining genuine owner decisions are listed in §8.

## 7. F-P54 finding crosswalk

Reviewer severities are preserved. Owner dispositions below are product-planning only.

| ID | Reviewer severity | Owner disposition | Where corrected |
|---|---|---|---|
| F-P54-01 | P1 | **Actual correction.** Launch default is no-directory: verified string identity + owner-authorized ProPo capabilities. No StaffMember/`read_users`, no universal role import, no online tokens, no numeric `associated_user.id` actor. | UX §3; pricing seats; SE-01…09 |
| F-P54-02 | P1 | **Actual correction.** Pin repo API `2026-07`. Live counts use `on_hand` + `changeFromQuantity` + `@idempotent`. Changelog vs mutation-page `compareQuantity`/`available` examples remain recorded as a source conflict. Public docs ≠ store execution. Null CAS opt-out is forbidden for merchant counts. | LIVE §4; ST-03/04/08/09/13/19 |
| F-P54-03 | P1 | **Actual correction.** Row-by-row `/11` table inserted. `/11` itself is unchanged. Each material conflict has a recommended choice, rationale, cost/safety effect and PENDING OWNER APPROVAL. | PRICING §4 |
| F-P54-04 | P1 | **Actual correction.** Physical count compares to same-cutoff `on_hand`. Eight-name mapping, damaged/reserved/committed/QC inclusion, no double subtraction. | LIVE §1; ST-01…18 |
| F-P54-05 | P2 | **Actual correction.** Pause and Build = 1 Shopify admin user is documented and is not ProPo billing truth. | PRICING §2; V01; SE-06 |
| F-P54-06 | P2 | **Evidence limit kept.** Bounded re-fetch: OQLF and store-permissions succeeded; CASL FAQ and Brevo help still Cloudflare-blocked; Brevo marketing FAQ restated Free 300/day. UNKNOWN/BLOCKED retained where inaccessible. | RESEARCH_SOURCES; LEGAL §4; OPERATIONS §4 |
| F-P54-07 | P2 | **Clarified requirement.** Movement-aware counting remains a target. Public “stocktakes while trading” accuracy claims are forbidden until the controlled-store capability matrix exists. | LIVE §3 and §5; README O2-06 |
| F-P54-08 | P3 | **Outstanding untested UX.** Home/navigation remains a hypothesis. No new visual design ordered. | UX §1 and §7 |
| F-P54-09 | P2 | **Clarified requirement.** Four-cohort cells stay recruitment targets. Do not invent enrolled stores. | README §4 |
| F-P54-10 | P2 | **Outstanding legal/territory proof.** Q-008 OPEN. OQLF page re-fetched; CASL still blocked. Language ≠ market clearance. | LEGAL; V15/V23 |
| F-P54-11 | P2 | **Actual correction.** Stocky negative-current-stock and negative-receipt/resulting-negative-stock exceptions, zero-denominator, missing cost, returns, landed basis, decimals, and no restore-guarantee. | UX §5; C-01…10 |
| F-P54-12 | P2 | **Clarified requirement.** App Pricing remains the billing spine. Free Sentry/Zoho/Resend/Brevo tiers are not production-support proof. | OPERATIONS §2 and §4 |
| F-P54-13 | P3 | **Owner-supplied branding/domain/mailbox limits kept.** Domain, support email and trademark remain unverified. | BRAND_MIGRATION.md |

## 8. Unresolved owner decisions

1. POS receive/count tiles and camera-assisted workflows on every paid plan versus `/11` Growth (`11` §3 Growth lines 155–156; Essentials upgrade reasons line 133). Recommended: basic POS receive/count tiles on every paid plan; camera is a device capability, not a paid extra.
2. Ordinary safe receiving correction as launch-core versus advanced posted-receipt unreceive as Growth (`11` §3 Growth line 159 vs product/02 §3.8). Recommended split in PRICING §4.
3. Whether seats or location/variant/operational scale is the primary public price driver, and whether the store owner is included in the billed ProPo count.
4. Formal supersession of `/11` §7.3–7.4 included AI credits and internal AI COGS budgets by after-launch merchant BYOK with no ProPo-funded fallback.
5. Whether to proceed toward a US/Canada listing without retained counsel. Q-008 remains OPEN regardless.
6. Domain, support mailbox, trademark and NY entity verification.
7. First accounting connector after ledgers exist (QuickBooks Online versus Xero).
8. Whether StaffMember/`read_users` will ever be requested from Shopify Support for this **public** app.
9. Whether Pause and Build shops are sold, supported as read-only, or documented as an unsupported Shopify lifecycle.
10. Merchant-display rounding for average cost (proposed: decimal-safe arithmetic, 2-decimal display using ROUND_HALF_EVEN, matching Stocky’s published $9.33 example) versus a different disclosed rounding rule.
11. Default stocktake inclusion of damaged / quality-control bins (proposed: declare per session; default exclude unless those zones are in scope).

## 9. Future acceptance and implementation obligations

These are obligations for later authorized work, not a readiness claim:

- Implement no-directory launch identity and ProPo capability grants; prove StaffMember only if a granted public-app scope exists.
- Execute the LIVE §3 controlled-store quantity/movement matrix before any public live-count claim or inventory-write enablement.
- Revalidate `inventorySetQuantities` against the generated Admin `2026-07` schema artifact **and** a development store: `name`, `changeFromQuantity`, `@idempotent`, `userErrors`, unknown-result readback. Do not copy live `available` + `compareQuantity` examples.
- Do not edit `product/11` or public prices until the owner accepts the §4 crosswalk.
- Keep complete parity and ordinary safe receiving correction available; do not make enterprise API, Smart, Flow, accounting, or advanced unreceive essential to a lower tier without an explicit owner choice.
- Prove cost-sync consent separately from `write_inventory`; never treat a later compensation as restoring all intervening averages.
- Recruited cohorts, legal/privacy (Q-008), domain/mailbox, and operator-plane production accounts remain unimplemented gates.

## 10. Evidence limits for this successor

**Executed here:** git ancestry and exclusive-path edits; official web fetches listed in RESEARCH_SOURCES.md; published planning-model fixtures (stocktake/cost/seats) as numerical models.

**Not executed:** live store, POS device, camera, inventory mutation, billing enrollment, Partner API, recruitment, legal opinion, corporate registry, domain DNS, email send, Claude review, `/11` edit, PR53, runtime, or PR45’s 505-case suite.

Peer-review synthetic 18/18 is reviewer-executed evidence on the preserved review branch and is **not** inherited as this writer’s execution.
