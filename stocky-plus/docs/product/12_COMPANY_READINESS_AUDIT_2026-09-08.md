# Inventory platform: naming and company readiness assessment

**Review date:** 8 September 2026  
**Decision status:** Proposed recommendations; app name awaiting owner approval.  
**Scope:** Product planning, Shopify compatibility, operating model, pricing assumptions and growth. This is a planning assessment, not production certification or authorization to merge implementation work.

## Decision summary

Keep the existing modular monolith and full inventory/procurement product direction. The largest risk is not a missing dashboard: it is promising reliable purchasing and inventory changes before quantity semantics, recovery, permissions and capacity have been demonstrated.

Recommend **Shelfvero**, with the descriptor **Inventory & POs**, subject to the owner's choice and subsequent clearance. Complete the controlled rename after approval. Do not start another architecture rewrite.

The review adds explicit work for multi-barcode compatibility, Shopify's reserved-to-committed migration, supported POS printing, token recovery, supplier communications, operator access, billing reconciliation and cost measurement. Several foundations already exist in the plans and should be tightened, not reinvented.

Broad discovery can close with this assessment. The remaining work belongs in bounded implementation and release gates. No finite planning review can certify software that has not yet been built and exercised.

## 1. Evidence and current project state

Repository reviewed: Vedang1998/Stocky, application directory stocky-plus. The pinned main commit is **09feffd3f36eb4698f2ed8a152efe414cd9b77bd**. GitHub confirms PR #34 merged and main CI run **34071226302** successful. The main PROJECT_STATUS document still describes an earlier main commit and PR #34 awaiting review: this is control-document drift, not evidence that the merge did not occur.

PR #37 is an open draft for PR6-A, head **f7a39c3664a8a45b7a7cd3055079b4ebc888bb02**. Its exact-head CI run **34137287606** is successful. The PR records a correction review and limits authorization to the foundation slice. This assessment does not adjudicate its merge, reopen accepted review findings, or authorize PR6-B/C/D. [R1–R4]

Read the repository instructions, product direction, parity PRD, community research, architecture, gap audit, roadmap, feature matrix, research sources, pricing plan, phase controls, open questions, accepted PR5 residuals and PR6 review/plan material. Selected code inspection covered Shopify configuration/authentication, tenant transaction context, schema, package configuration and embedded app/dashboard routes. This was not an exhaustive source-code security audit or runtime/load test.

Observed facts requiring attention:

- The schema stores a scalar barcode in canonical variant facts and the older variant cache.
- The app pins Shopify API 2026-07 and opts into expiring offline tokens.
- The checked-in Shopify client ID is a placeholder. Repository configuration does not prove actual Partner Dashboard setup, grants or production installation.
- Dashboard copy tells merchants to run a worker command and exposes technical cache language.
- A “Free tier — Buying Table locked” fallback conflicts with the pricing document's no-permanent-free direction.
- The roadmap and feature matrix do not consistently assign forecasting/AI to the same phases.
- Accepted PR5 residuals include kill-switch timing and nonconcurrent-index rollout obligations before production. Their acceptance does not remove those obligations.

These observations should become focused work items. Older gap-audit claims must be checked against current branches before being relabeled as live defects.

## 2. Three name candidates for approval

A distinctive brand plus an understandable descriptor is preferable to a generic string of keywords. The brand alone cannot guarantee SEO or faster growth.

| Rank | Candidate and proposed listing name | Fit | Main reservation |
|---|---|---|---|
| 1 | **Shelfvero — Shelfvero Inventory & POs** | “Shelf” connects to retail inventory; the coined ending allows expansion into purchasing, analytics and supplier operations. | Pronunciation and spelling need a short merchant test. |
| 2 | **Replenivo — Replenivo Inventory Planner** | Clearly suggests replenishment and forecasting; suits a planning-led positioning. | Similar “replen-” brands exist, including direct competitor Replenora; clearance must examine confusing similarity. |
| 3 | **Reordiva — Reordiva Inventory & Orders** | Connects to reordering and purchasing; distinctive enough for a broader product identity. | “Diva” may feel less operational; “orders” can be confused with customer order management. |

**Screening result:** Exact-name searches across two web search systems did not surface a relevant indexed exact match for these three during this review. This is a preliminary collision screen, not proof of availability. No domain registration, social handle reservation, registry clearance or trademark opinion was obtained.

Rejected alternatives included ShelfPilot and Replenora because relevant Shopify listings already exist, and Inventrail/Inventara because of existing inventory-related businesses. Naming should avoid proximity to Shopify's Stocky identity and any suggestion of official succession. [S1–S3]

Before final adoption: check relevant trademark registries and common-law use in launch markets, phonetic variants, app/software categories, company names, domains and handles; test pronunciation with five prospective merchants. A domain such as getshelfvero.com is only a proposed pattern, not a checked available domain. USPTO guidance explicitly treats similar marks and common-law sources as part of comprehensive clearance. [S4]

**SEO direction:** use natural phrases such as Shopify inventory management, purchase orders, inventory forecasting, stocktakes, low stock alerts and Stocky alternative in the appropriate listing fields and useful pages. These are intent hypotheses, not measured search-volume rankings. Validate them using actual impressions, qualified installations and activation after launch.

**Owner decision requested:** choose one candidate or reject the direction. No branding has been renamed in this assessment.

## 3. “Everywhere” rename contract

After approval, produce a repository-wide, case-insensitive occurrence manifest covering Stocky, Stocky Plus, stocky-plus, stocky and related branded identifiers. Include filenames, paths, generated assets, Markdown, comments, examples, tests, frontend text, backend errors, package metadata, configuration, prompts/instructions, email/PDF templates, marketing content and external service labels.

| Surface | Required treatment |
|---|---|
| Current product branding and instructions | Replace consistently; include README, all live planning documents, page titles, navigation, help, billing, onboarding, logos, alt text, email subjects/senders and PDF headers. |
| Internal names and contracts | Inventory package names, environment variables, queue/job names, storage prefixes, API identifiers and database settings. Migrate compatible consumers together, with rollback where data or deployed consumers exist. |
| Database/tenant security | Existing settings such as stocky.current_shop_id and stocky.tenant_context_version participate in security. A brand change must not become an unreviewed RLS change. Use a separately reviewed migration/compatibility plan where needed. |
| Historical and external references | Preserve accurate references to Shopify Stocky, immutable review artifacts, original migration history and external identifiers that cannot safely be rewritten. Record each exception and its reason. |
| Ordinary inventory language | Retain stock, stocktake, stock level, out of stock and Shopify-defined fields unless an occurrence is actually our brand. |

“Everywhere” means every occurrence is accounted for, not blindly replacing the word stock. Rewriting signed/reviewed history would invalidate evidence. The exception manifest must be explicit and reviewable.

External follow-through includes the Partner listing, app configuration display name, website, domains, support mailbox, email authentication, analytics labels, help center, source repository description and deployment dashboards. Keep the existing Shopify app identity/client ID and installations; do not create a replacement app simply to change its display name.

Completion gate: zero unexplained old-brand occurrences in current surfaces, approved historical/contract exceptions, fresh build/type checks, representative rendered screens/emails/PDFs, and tenant/security verification if identifiers changed. This turn has not produced an exhaustive rename manifest because the name is undecided.

## 4. Shopify changes that materially affect this app

| Change, status and source | Planning consequence |
|---|---|
| Stocky stopped operating on 31 August 2026; its API also stopped. Read-only access remains for at least 90 days. Historical data does not automatically become native Shopify purchasing history. [S5] | Lead with an honest migration/import workflow. Do not promise live Stocky API migration. Preserve available merchant exports and explain unsupported supplier/history fields. |
| Native InventoryPurchaseOrder documentation is currently under unstable/physical-inventory preview. [S6] | Keep the app-owned PO/receipt ledger. Do not make a stable production feature depend on preview access or promise automatic native PO parity. |
| inventorySetScheduledChanges was removed without replacement in 2026-07. [S7] | Resolve Q004: distinguish app PO expectations from Shopify incoming quantities, provenance and overlap. Never add both blindly or use a removed mutation. |
| On 8 September Shopify announced multiple variant barcodes for 2026-10: up to 20; the old scalar exposes the first. This is a future-version change relative to the app's 2026-07 pin. [S8] | Plan a canonical barcode collection and scanner lookup rules. Validate the target schema before adoption. Full-array writes replace the set; avoid accidental deletion of other barcodes. Do not bump versions solely for this report. |
| Draft-order and transfer/shipment holds are moving from reserved to committed; available and on-hand do not change. [S9] | Do not equate all committed units with customer sales. Treat quantity-category migrations as classification changes, not shrinkage or demand. Build before/after reconciliation fixtures. |
| Refresh-token resilience changed in August, allowing bounded reuse of a prior refresh token until its replacement is used. [S10] | Preserve per-shop refresh coordination and atomic token-pair storage. Test worker concurrency, expired credentials, reinstall and revoked access; retry behavior must not amplify failures. |
| POS 2026-07 adds direct hardware receipt printing; discovery needs POS 11.11+. Direct printing supports HTML/images, while PDF uses the system dialog. [S11] | Test the actual supported printer/device matrix. Provide fallback. Receipt printer support does not establish arbitrary barcode-label printer compatibility. |
| POS supports a background target and offline extension execution under specific versions/configuration. [S12–S13] | A background extension is not a durable server worker. Offline count drafts can queue, but reconnect must reconcile and authorize inventory changes before showing success. |
| Polaris CDN adopts semantic major versions; App Bridge is separate. [S14] | Track stable component/type alignment. Do not infer a compulsory framework rewrite or a vulnerable dependency from this announcement. |
| New analytics capabilities include 2026-10 and early-access elements. [S15] | Investigate later where they reduce UI work. Keep owned, explainable business calculations and do not assume access for every merchant. |
| Inventory compare-and-swap documentation and removal timelines are not fully consistent across pages. Idempotency requirements vary by mutation. [S16–S17] | Record an exact-version mutation contract for every receipt, correction and transfer write. Generate/validate against the target schema; prove concurrency and duplicate-request behavior instead of assuming a generic flag covers everything. |

## 5. Capacity, data correctness and permissions

Shopify product support now includes 2,048 variants per product. GraphQL uses query-cost budgets by merchant plan, with typical input arrays limited to 250 and a single-query cost ceiling of 1,000. These are API constraints, not our subscription limits. Do not infer an app-wide 25,000-record ceiling from a generic pagination page: Shopify's separate pagination announcement is scoped to Liquid/Storefront. Confirm connection behavior on the pinned Admin schema and use bulk extraction appropriately. [S18–S20]

The operating envelope must account for variants × inventory locations, nested connections, orders/refunds, media/exports, webhook bursts and history depth. A 50,000-variant, 15-location account can imply 750,000 variant/location combinations, although actual allocations are sparse.

| Proposed verification tier | Dataset | Required evidence before advertising support |
|---|---|---|
| Essentials hypothesis | 2,500 variants, 1 location | Complete sync, pagination, count/receipt workflows, recovery and measured per-shop costs. |
| Growth hypothesis | 15,000 variants, 5 locations | Concurrent interactive use and background sync; no tenant starvation or duplicate writes. |
| Pro hypothesis | 50,000 variants, 15 locations | Bounded worker memory, queue latency, query plans, large imports/exports and restart recovery. |
| Engineering stress test, not a plan promise | 100,000 variants, 50 locations | Degradation and admission-control behavior; explicit unsupported-envelope messaging. |
| Adversarial product | One product with 2,048 variants | No first-page truncation, identity collision or barcode ambiguity. |

Set performance targets after representative measurements, then make them release gates. Cap concurrency per shop, respect throttle feedback, stream large work, checkpoint safely, and track reconciliation completeness separately from “job finished.” Upgrades or downgrades must not delete records or prevent safe completion/correction of existing work.

Orders and refunds can constitute protected customer data even when the app does not need names or addresses. Request only necessary fields, document approved access, and handle redacted responses. Default order access is 60 days; older history requires the appropriate grant. Inaccessible history must not be treated as deletion or zero demand. [S21–S22]

Existing open questions still matter: incoming overlap; inventory cost authority; location-attributed demand; currency and revenue definitions; canceled/unpaid orders; retention; transfer semantics; actual Partner grants. Existing RLS work is not reopened merely because this report examines isolation.

## 6. Product and merchant experience

Keep the 132-feature parity inventory as the scope reference. Create one traceability table connecting each requirement to an owning phase, implementation, test evidence and merchant documentation. Resolve conflicting phase numbers instead of adding another competing roadmap.

The primary journey should be: connect → understand sync coverage → configure suppliers and lead times → review a reorder suggestion → approve/send a PO → receive partially or fully → reconcile discrepancies. Subsequent stocktakes, transfers, labels and reporting should use the same location, unit and status language.

Recommended UI corrections and gates:

- Replace worker commands/cache terminology with clear sync state, last successful update, affected scope and a recovery/support action.
- Make queued, running, partial, failed and complete visibly different. Avoid presenting enqueue success as completed synchronization.
- Align billing copy with the actual approved plan model; remove the phantom free-tier assumption.
- Group navigation around buying, inventory and reporting; validate this with real tasks before changing every route.
- Provide keyboard operation, accessible contrast/focus, narrow-screen layouts, predictable table selection and persistent filters.
- Explain forecast inputs, history coverage and uncertainty. Keep deterministic numerical forecasts authoritative; AI may explain or assist, not invent quantities.
- Support partial receipts, over/under-deliveries, duplicate scans, returns, correction/unreceive and audit history. Recommend keeping essential error correction in every paid tier; this is a proposed change to the current packaging, not an adopted decision.
- Handle timezone, currency, decimal precision, units/case packs, long SKUs, missing barcodes and supplier-specific costs explicitly.

POS work needs a capability matrix for target, device, POS version, role, scanner and printer. Treat Shopify session identity and pinned staff identity carefully; validate authorization server-side and never trust a submitted staff ID as permission. [S23]

## 7. Isolation, security and recovery

Require negative tests across every tenant boundary: database access, pooled transactions, queue jobs, cache keys, uploaded files, signed download URLs, exports, email attachments, analytics, support tools and AI context. Passing RLS tests alone does not prove these other channels safe.

Use Shopify authentication for merchant access and server-side app roles for buyer, approver, receiver, analyst and administrator. Separate approval from receipt when configured. Verify permissions on every action, background retry and integration call; UI hiding is insufficient.

The company's operator console must use separate workforce identity with MFA. Support access should be ticket-linked, time-limited, least-privilege and audited. A global shop selector must not itself grant access. Financial staff need billing summaries, not unrestricted merchant records. Never put app secrets or raw tokens in logs or analytics.

Review CSV formula injection, template injection, unsafe uploaded files, signed-link expiry, webhook HMAC verification, SSRF from integrations, replay/duplicate events and uninstall/reinstall races. Encrypt credentials, rotate secrets and restrict production access. Maintain dependency/security update ownership.

Mandatory preproduction evidence includes restore drills, explicit recovery objectives, dead-letter handling, per-shop/global kill switches, mutation audit trails and a rollback-compatible migration process. Close the accepted PR5 kill-switch/index rollout obligations before affected production use. Define incident owner, backup coverage and a merchant communication path before enabling inventory writes.

All three mandatory privacy webhook topics must be operational, not only declared. Rehearse access/redaction requests, retention/deletion including backups, and uninstall cleanup. Retain only justified accounting/security records under an approved policy. [S24]

## 8. Emails, documents, support and company operations

Use a versioned PO model that produces a stable document snapshot and an associated send record. Rendering and sending should be separate jobs. A retry must not send another supplier order merely because an acknowledgement was lost.

Templates need preview, plain-text email alternatives, consistent totals, page breaks for long POs, repeating headers, currencies, timezone-aware dates, sender/reply-to clarity and attachment limits. Escape merchant-supplied text. Store recipient, revision, delivery state and provider ID; handle bounces, complaints and suppressed recipients. Require review before automatically sending a new or materially changed PO.

Start with a verified company sending domain and merchant reply-to. Add merchant-owned sending domains only when justified by demand and verification complexity. Configure SPF/DKIM/DMARC, separate transactional from marketing traffic and enforce application-level send budgets.

| Company workflow | Minimum operational capability |
|---|---|
| Installation/onboarding | Installation event, sync health, onboarding checklist and first-value progress; deduplicate lifecycle messages. |
| Billing | Entitlement state, subscription transitions, grace/recovery rules, refunds/credits, reconciliation with Shopify revenue and support visibility. |
| Uninstall | Stop jobs and revoked-token retries, honor retention/deletion, record optional reason. Uninstall is not automatic permission for a marketing campaign. |
| Support | Shared queue, ticket ID, severity, owner, response expectations, redacted diagnostics and escalation runbooks. |
| Product analytics | Install → sync success → first PO → first receipt → retained use, broken down by cohort and plan. |
| Business reporting | Gross billings, net proceeds, refunds, MRR movements, churn, variable costs, support time and cash runway. |
| Releases | Changelog, staged rollout, feature flags, incident rollback, schema compatibility and advance notice of material changes. |

Do not buy a separate CRM, helpdesk, campaign tool and analytics warehouse before basic workflows justify them. Start with a shared support mailbox, a compact operator console and minimal event analytics. Default session replay off; avoid raw order/customer payloads. A paid helpdesk becomes useful when ticket ownership, SLA reporting and searchable history exceed the simpler setup.

## 9. Infrastructure and unit economics

Retain Node/TypeScript, React Router, PostgreSQL/Prisma, Redis/BullMQ and S3-compatible object storage. Use a managed web service plus a durable worker in a compatible region. Select managed Redis behavior suitable for queues; eviction or sleeping workloads can undermine reliability. Do not substitute a serverless service without checking connection and job semantics.

Render remains a reasonable baseline to quote because it matches the architecture. Railway is a comparison option, not an automatic cheaper migration: its subscription minimum includes usage and is not an all-in fixed infrastructure bill. R2 is worth considering for documents; request charges and access control still matter even where egress economics are favorable. [S25–S27]

**Budget allowances, not provider quotes or demonstrated capacity:** reserve roughly $75–150/month for a limited pilot and $150–300/month for a lean production setup, before founder compensation, legal work, substantial support and unusually heavy traffic. Price the exact web/worker/database/queue/backup sizes before purchase. A resilient setup or measured load may require more.

For transactional email, Resend's published Pro reference is $20/month for 50,000 emails; verify the live plan and overages when buying. Do not assume “unlimited” sending or that every merchant domain is included. [S28] Begin with an existing shared mailbox; Crisp's paid shared-inbox capabilities are a later comparison, not a launch dependency. [S29]

Keep the existing $29/$79/$149 and enterprise pricing as hypotheses until pilots measure workload and willingness to pay. Do not promise technical limits based solely on plan names.

Illustrative economics: at $29/month, a 20% variable-cost target allows $5.80. Ten minutes of support at an assumed $30/hour costs $5; add the plan's proposed $1.75 AI budget and 2.9% payment processing ($0.84), and variable expense is already $7.59 before hosting allocation or refunds. That is about 26.2% of revenue. This demonstrates the need to measure support and AI consumption, not that a specific final price is proven.

Shopify's eligible revenue-share program currently charges 0% on the first $1 million of applicable lifetime revenue and 15% above that, with 2.9% processing and applicable taxes; eligibility and associated-account treatment matter. Budget both eligible and noneligible scenarios. [S30]

Instrument cost per shop, per sync, per receipt, per generated document, per email and per AI task. Keep AI budgets capped; cache reusable work, avoid polling where events suffice, and price unusually costly history/import requirements explicitly. Contribution margin must include support and refunds; hosting-only break-even is misleading.

## 10. Publishing, growth and integrations

The App Store submission must use current GraphQL-based implementation, necessary scopes, supported installation/session flows, truthful feature claims, accurate screenshots and Shopify's required billing route. Demonstrate self-service subscription changes and uninstall behavior. Do not incentivize reviews or claim Built for Shopify before it is awarded. [S31]

Built for Shopify is a later evidence gate: current criteria include at least 50 net installs on active paid Shopify plans, five reviews, qualifying ratings and real performance measurements. “Paid Shopify plans” does not mean 50 merchants paying for this app. [S32]

Recommended website structure: product overview, inventory planning, purchase orders, receiving/POS, stocktakes/transfers, pricing, integrations, help, security/privacy, changelog and a factual Stocky migration guide. Publish only available capabilities as current features. Place planned features in a clearly labeled roadmap.

Start with five to ten design partners across more than one retail category. Observe their current spreadsheet/PO/receiving workflow, import real anonymized shapes with permission, and measure time to first successful receipt. Create useful guides around reorder points, supplier lead times, partial receipts, inventory counts and migration limitations. Use genuine examples and screenshots; avoid mass-produced thin SEO pages.

Measure qualified traffic → installation → activation → retained use → paid conversion. Add acquisition cost and contribution-based payback when acquisition spending starts. Downloads alone are insufficient. Seek honest reviews after demonstrated value, with no reward tied to sentiment.

Prioritize integrations in this order: reliable Shopify core and CSV import/export; Shopify Flow where concrete merchant demand exists; documented webhooks/API; accounting/ERP/supplier connectors only after stable identifiers and contracts. Each external integration needs scoped credentials, tenancy, retries, idempotency, versioning, rate limits and deletion behavior. Do not market universal compatibility. Shopify currently restricts apps connecting to third-party POS solutions; our Shopify POS extension should not be confused with that category. [S31]

## 11. Bounded follow-through

These are audit-local work IDs, not replacements for existing decision/risk numbering. Cursor owns implementation; ChatGPT coordinates product decisions; independent review follows repository rules.

| ID | Timing / owner | Deliverable and acceptance evidence |
|---|---|---|
| A01 | Now / owner + product | Approve name direction, complete clearance, then authorize controlled rename manifest and implementation. |
| A02 | Next planning update / product | Reconcile live status with PR #34/#37 and phase mapping; preserve existing authorization boundaries. |
| A03 | Before inventory write design / engineering | Pinned-version mutation matrix, incoming provenance and reserved/committed semantics, duplicate/concurrent-write cases. |
| A04 | Before barcode-dependent launch / engineering | Multi-barcode migration/adoption plan, scanner ambiguity rules and schema-version tests. |
| A05 | Before pilot / engineering | Capacity measurements for promised envelope, sync completeness and noisy-neighbor protections. |
| A06 | Before production data / engineering + owner | Actual Partner setup, scopes/protected-data grants, privacy/retention policy and exercised compliance flows. |
| A07 | Before production writes / engineering + reviewer | Isolation beyond SQL, token recovery, kill switches, accepted residual closures, backup restore and incident coverage. |
| A08 | Before buying/receiving release / product + engineering | Approval roles, correction policy, versioned PO/PDF/send records and delivery recovery. |
| A09 | Before POS claims / engineering | Physical device/scanner/printer/offline capability matrix and verified fallbacks. |
| A10 | Before charging / owner + engineering | Shopify billing/entitlement transitions, reconciliation, plan limits and measured unit economics. |
| A11 | Before public listing / product | Truthful listing, tested onboarding, merchant language, support queue, legal pages and release evidence. |
| A12 | After initial activation / growth | Focused website/content, cohort metrics, ethical review requests and prioritized integrations. |

A second pass checked commonly overlooked boundaries: downgrade safety, old-order access, partial/nested syncs, supplier-email duplication, operator impersonation, CSV/export leaks, offline reconciliation, printer claims, barcodes, forecast provenance, backup deletion and support costs. They are incorporated above.

**Assessment:** The product direction is viable to continue building, with the current architecture retained. This is a conditional planning conclusion, not a claim that launch readiness, trademark availability or profitable scale has been proven. The next owner decision is the name; implementation then proceeds through the existing phased governance with this audit's additions mapped into it.

## Sources and verification links

Sources were accessed during this review on 8 September 2026. Shopify preview/future-version sources are explicitly distinguished above from the application's pinned version.

- R1. [Pinned repository](https://github.com/Vedang1998/Stocky/tree/09feffd3f36eb4698f2ed8a152efe414cd9b77bd/stocky-plus) and [project status](https://github.com/Vedang1998/Stocky/blob/09feffd3f36eb4698f2ed8a152efe414cd9b77bd/stocky-plus/docs/PROJECT_STATUS.md).
- R2. [PR #34](https://github.com/Vedang1998/Stocky/pull/34) and [main CI](https://github.com/Vedang1998/Stocky/actions/runs/34071226302).
- R3. [PR #37](https://github.com/Vedang1998/Stocky/pull/37).
- R4. [PR #37 exact-head CI](https://github.com/Vedang1998/Stocky/actions/runs/34137287606).
- S1. [ShelfPilot Shopify listing](https://apps.shopify.com/shelfpilot-3).
- S2. [Replenora Shopify listing](https://apps.shopify.com/replenora).
- S3. [Inventrail](https://inventrail.com/) and [Inventara](https://taos.digital/inventara).
- S4. [USPTO comprehensive clearance](https://www.uspto.gov/trademarks/search/comprehensive-clearance-search-similar-trademarks).
- S5. [Shopify: transitioning from Stocky](https://help.shopify.com/en/manual/products/inventory/transitioning-from-stocky).
- S6. [InventoryPurchaseOrder unstable API](https://shopify.dev/docs/api/admin-graphql/unstable/objects/InventoryPurchaseOrder).
- S7. [Scheduled inventory mutation removal](https://shopify.dev/changelog/inventorysetscheduledchanges-mutation-is-being-removed-with-no-replacement).
- S8. [Variant barcode replacement](https://shopify.dev/changelog/product-variant-barcode-is-being-replaced-by-barcodes).
- S9. [Reserved-to-committed migration](https://shopify.dev/changelog/draft-order-and-transfer-shipment-inventory-is-moving-from-reserved-to-committed).
- S10. [Offline refresh-token resilience](https://shopify.dev/changelog/more-resilient-refreshes-for-expiring-offline-access-tokens).
- S11. [POS hardware receipt printing](https://shopify.dev/changelog/pos-ui-extensions-can-now-print-directly-to-hardware-receipt-printers).
- S12. [POS background target](https://shopify.dev/changelog/pos-extensions-now-supports-a-background-extension-target).
- S13. [POS offline execution](https://shopify.dev/changelog/pos-ui-extensions-can-now-run-without-network-access).
- S14. [Polaris CDN semantic versioning](https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning).
- S15. [Full-stack app analytics](https://shopify.dev/changelog/full-stack-capabilities-to-power-app-analytics).
- S16. [Inventory compare-and-swap redesign](https://shopify.dev/changelog/compare-and-swap-redesign-for-inventory-set-quantities).
- S17. [Idempotent requests](https://shopify.dev/docs/api/usage/idempotent-requests).
- S18. [2,048-variant support](https://shopify.dev/changelog/the-product-variant-limit-is-now-2048-for-all-merchants).
- S19. [API limits](https://shopify.dev/docs/api/usage/limits).
- S20. [Liquid/Storefront pagination announcement](https://shopify.dev/changelog/new-pagination-limits-for-liquid-storefront-graphql-api).
- S21. [Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data).
- S22. [Order access](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order).
- S23. [POS session API](https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis/standard-apis/session-api).
- S24. [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).
- S25. [Render pricing](https://render.com/pricing).
- S26. [Railway pricing](https://docs.railway.com/pricing) and [billing](https://docs.railway.com/understanding-your-bill).
- S27. [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- S28. [Resend pricing](https://resend.com/pricing) and [pay-as-you-go announcement](https://resend.com/changelog/pay-as-you-go-pricing).
- S29. [Crisp pricing](https://crisp.chat/en/pricing/).
- S30. [Shopify revenue share](https://shopify.dev/docs/apps/launch/distribution/revenue-share).
- S31. [Shopify App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements).
- S32. [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements).
