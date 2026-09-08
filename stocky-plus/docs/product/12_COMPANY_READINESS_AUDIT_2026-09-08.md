# Inventory Platform Commercial Readiness Review

## Decision and evidence boundary

Retain the approved full-platform direction and existing architecture. Adopt a distinct brand after owner selection, complete the measurable contracts below, and continue the established delivery sequence. A wholesale rewrite or a new collection of paid tools is not justified. This assessment closes the broad planning investigation as of September 8, 2026; it does not certify a finished app or authorize production, inventory writes, a merge, or future-phase implementation.

The commercial weakness is treating Stocky parity alone as the product advantage. Shopify now supplies more inventory functionality itself. The stronger position is dependable purchasing and inventory control: explainable replenishment, supplier-specific terms and costs, usable PO communication, controlled receiving, receipt-driven labels, stocktakes, and trustworthy cost/audit history. Validate willingness to pay with the already planned 5-10 pilots. Preserve all 132 approved features; sequence delivery rather than adding unrelated ERP work.

Repository evidence was inspected at main `09feffd3f36eb4698f2ed8a152efe414cd9b77bd`. PR34 is merged at that commit. Main CI run 34071226302 is completed/success. Active PR37 is open/draft at `f7a39c3664a8a45b7a7cd3055079b4ebc888bb02`; exact-head pull_request CI 34137287606 is completed/success. Its immutable correction review says APPROVE PR6-A FOUNDATION CORRECTION; its authorization covers PR6-A only. This audit did not independently rerun that implementation's tests or approve its merge. [R1-R4]

The review covered the required product sequence, pricing, phase authority and relevant source/configuration. A431-file local reference set was checked against Git blob hashes after normalizing the copy's extra terminal newline; all 431 matched. Four additional PR37 documents were read. This is a static source and planning audit, not a deployed browser, device, load, vulnerability, database, or penetration test. Provider bills, Partner Dashboard grants, deployed app IDs and real merchant capacity remain unverified.

Main PROJECT_STATUS still describes PR34 as open and pending review. PR37's control header also still says correction re-review pending, while its newer review and PR body record approval. Reconcile current control records during the relevant closeout; retain immutable review history. D-054 remains the recorded authority and this audit creates no D-055. PR6-B/C/D and production remain unauthorized.

## 1. Brand selection and complete rename

Naming should combine a distinctive brand with a functional descriptor. A generic keyword is not a growth strategy. Shopify requires a recognizable brand first, consistent naming across developer-controlled surfaces, and no confusing similarity to another product; listing guidance allows at most 30 characters. The unique-name requirement was updated July 15, 2026. [1, 2]

The screen assessed 29 candidates through two search engines and indexed Shopify results. Direct conflicts excluded names including Stockpilot, Inventrail, Inventide and SupplyStride. Search volume was not measured. Direct App Store search could not be retrieved, so this was an indexed search, not an exhaustive App Store database check. No search result is trademark clearance, and unindexed/similar-sounding brands can still conflict.

| Candidate | Proposed listing name | Strength | Main reservation |
| --- | --- | --- | --- |
| Shelfaro — recommended | Shelfaro Inventory & POs | Short retail/shelf association, pronounceable brand, room for purchasing and forecasting | Invented spelling needs merchant recall testing; matching .com had no registry record |
| ShelfHarbor | ShelfHarbor Inventory & POs | Familiar retail words and a dependable operational identity | Harbor/Harbour spelling; matching .com already registered |
| Replenara | Replenara Inventory & POs | Clear association with replenishment; independent brand | Broader inventory scope less obvious; matching .com already registered |

These are provisional commercial candidates. The listing titles contain 24, 27 and 25 characters respectively. Verisign RDAP returned HTTP 404 for shelfaro.com, getshelfharbor.com and getreplenara.com on September 8; shelfharbor.com and replenara.com are registered. HTTP 404 means no registry record was found; it is not a registrar availability/price guarantee. No domain was purchased or reserved. Final selection requires a satisfactory domain, handle and trademark/confusing-similarity check in intended markets. [3]

Approve the core brand before implementing its rename. The rename's acceptance criterion is zero unexplained references to the old owned brand across current surfaces, with an explicit inventory of justified historical and compatibility references.

| Surface | Required scope and evidence |
| --- | --- |
| Current documentation/instructions | AGENTS, product/phase/control docs, reusable Cursor/Claude/ChatGPT instructions, README, diagrams, CSV and XLSX matrices, document metadata and links; verify spreadsheet IDs and formulas remain intact |
| Frontend and merchant output | Navigation, titles, error text, favicon/icon, accessibility labels, translations, emails, PDFs, labels, CSV filenames, onboarding and help links |
| Source/configuration | Package names/lockfile, application directory, imports, GraphQL operation labels, build scripts, fixtures, scanners, workflows, Docker paths and generated output; remove obsolete build artifacts and regenerate |
| Persistent identities | Database roles/functions/GUCs, queue names, environment keys, storage paths, observability keys and authentication integration; use a reviewed additive migration and cutover/recovery strategy |
| External owned systems | Repository identity/redirects, Shopify registrations/TOML/listing, hosting, callbacks, webhook URLs, domains/DNS, mail sender, monitoring, support, billing descriptors and analytics |
| External instructions without edit access | Supply exact replacement text and identify the owner-applied setting; verify it afterward rather than claiming it was changed |

Concrete Tier-A rename risks exist: `stocky.current_shop_id` and companion GUCs underpin database tenant context; `stocky_runtime` and control-plane roles affect privileges; `stocky-webhooks` and `stocky-cron` identify queues. Change readers and writers coherently. Preserve operation/idempotency/lock identities or migrate them explicitly; drain or bridge old queues; test existing databases as well as fresh installs. A renamed role or queue must not become an accidental authorization bypass or orphan work. Preserve the existing Shopify app identity, client ID and merchant installations when changing display names; a rename is not a reason to create a replacement app.

Do not rewrite applied migration files, immutable signed/hashed reviews, Git history, source titles/URLs or Shopify's external API names. Keep accurate references to Shopify's former Stocky product, explicitly labeled where ambiguous. Ordinary domain language such as stocktake, safety stock and stock on hand remains correct. Renaming current instructions must never alter the meaning of approved parity formulas. Historical artifacts can be indexed under the new brand while their original evidence remains intact.

Deliver the eventual rename through focused Cursor PRs with a manifest, residual scan, migrated/fresh database validation, queue continuity, links/build checks and Claude review. Code/configuration changes require full CI under the repository policy. Name approval is not deployment or production migration approval.

## 2. Verified repository gaps and existing protections

| Finding | Evidence and disposition |
| --- | --- |
| Database tenancy is implemented | Tenant-bound access, forced RLS, composite tenant relationships, restricted role tooling and independent closure records exist. Do not repeat the old gap audit's claim that Shop/RLS is missing. Production configuration still requires verification. |
| Privacy processing is incomplete | `app/routes/webhooks.compliance.tsx` authenticates and logs the topic, then returns; it does not enqueue/perform data export or redaction. This is explicitly planned Phase 1 PR7 work and a release blocker. |
| Current login entry conflicts with installation policy | `_index/route.tsx` and `auth.login/route.tsx` ask for a shop domain. Current requirement 2.3.1 prohibits that installation/configuration flow. Replace the public entry with a supported Shopify-owned installation path; verify reinstall and incognito behavior. [4] |
| Staff authorization is unfinished | `requireAdminTenant` derives the shop from authenticated Shopify context; it does not itself establish a complete staff-action permission model. Phase 1 PR7 must distinguish tenant identity from actor authorization. |
| Some visible data remains capped | Legacy `fetchLocations` requests first:50 without pageInfo. Several PO/transfer/stocktake/bundle/supplier pickers use take:250. Canonical PR5 sync supports paging/bulk, but completeness of sync does not establish completeness of UI selection. |
| Authentication is not absent | `expiringOfflineAccessTokens: true`, Prisma refresh fields and authenticated worker clients exist. Require SDK integration tests for expiry, competing refreshes, lost responses, uninstall/reinstall and revoked scopes. Do not duplicate an already implemented flag. The August 28 refresh recovery change still requires serialized per-shop refreshes and atomic storage of each token pair; it provides a bounded lost-response recovery path. [46] |
| Production packaging needs a release contract | Dockerfile uses node:20-alpine; Node 20 is EOL. It omits dev dependencies, while worker invokes devDependency tsx. Web startup executes prisma migrate deploy. Qualify build tooling and provide separate web/worker/migration jobs with restricted credentials. No image build or deployed failure was demonstrated here. [5] |
| Billing is prototype behavior | Billing page hardcodes two plans and says no real money moves; the subscription helper uses test=false in production. Replace prototype copy/flow with the approved Shopify App Pricing architecture and central verified entitlements before release. |
| Exports/printing need input hardening | CSV escaping does not establish formula-injection protection. ZPL generation needs command escaping and quantity bounds. Templates must not execute merchant-provided code. |
| POS is planned, not shipped | Main tree has extensions/.gitkeep only. No present POS extension or device compatibility claim is justified. |

The canonical code-checkable Shopify self-review is a subset of App Store review, not a launch certificate. Of 31 applicable requirements, the static review classified 25 as likely passing, 2 as likely failing and 4 as requiring further review. Many passes reflect prohibited functions that are absent; this is not a readiness percentage. The failures are misleading test-billing copy (1.1.4) and manual shop-domain installation (2.3.1). Further evidence is needed for complete billing behavior (1.2.2), post-install redirects (2.3.3), fresh authentication and usable reinstalls after completed redaction (2.3.4), and deployed TLS (3.1.1). [4, 6]

Ten unrelated requirement groups containing 69 checks were skipped: online-store extensions, payment gateways, payment facilitators, buyer purchase options, product sourcing, checkout customization, sales channels, post-purchase extensions, mobile-app builders and donations. Purchasing POs do not make this a buyer purchase-option app; POS usage does not make it a mobile-app builder. Reassess any category added later. Live listing, Partner account, browser, billing, mobile/POS, and infrastructure checks still require evidence.

Existing PR5 residuals stay visible: P3-CLAUDE-F3XH-06 requires pre-production reconsideration of per-chunk processing-stop checks; P3-CLAUDE-F3XH-08 requires a safe populated-table index rollout or approved maintenance evidence. R-161 remains open for production capacity. PR37's R-176 remains open despite foundation representability being satisfied: downstream history-window/existence correctness remains to be implemented. This audit does not change their accepted severities or reopen accepted lane reviews.

## 3. Shopify compatibility and capacity contract

Stocky management and APIs ended August 31, 2026, but Shopify promises read-only exports for at least 90 days afterward. Historical POs/stocktakes do not automatically migrate; supplier export and native historical PO import are unavailable. Preserve source archives and create only outstanding quantities at operational cutover. Do not claim a migration tool can retrieve data the source cannot export. [7]

Native inventory PO read access remains unstable/feature-preview for enabled development stores. It is not a production PO CRUD foundation. Keep the app-owned PO/cost ledger; Shopify's current guidance supports blank-origin transfers to connect external procurement to physical receipt. Contract-test the stable transfer/shipment adapter and retain a boundary for future native PO support. [7, 8]

| Dimension | Verified platform behavior | App consequence |
| --- | --- | --- |
| Product size | 2,048 variants per product | No 100-variant assumption in imports, pickers or nested reads. [9] |
| Locations | Starter 2; Basic/Grow/Advanced 10; Plus 200 active locations; app/fulfillment locations excluded from those caps | Discover supported location types dynamically; do not treat 200 as a cap on every location row. [10] |
| API throughput | Standard/Advanced/Plus/enterprise GraphQL rates are 100/200/1,000/2,000 points per second, scoped to app+shop | Adaptive per-shop scheduling; noisy-store fairness; read response throttle metadata. [11] |
| Input and pagination | Generic array maximum 250 and deep pagination limit 25,000; endpoint-specific exceptions exist | Chunk validated operations, use bulk/partitions, and inspect endpoint docs instead of applying one universal constant. [11] |
| Count semantics | productsCount defaults to 10,000, supports limit:null and reports precision | Do not confuse capped/inexact counts with exact completeness or absence. [12] |
| Bulk | 2026-01+ supports up to 5 concurrent queries per shop/app; query shape and completion limits still apply | Stream JSONL, checkpoint, bound concurrency/memory and validate nested collection completeness. [13] |

One official-source conflict remains: the general limits page lists a 500,000-variant/10,000-per-day creation throttle, while the live productCreate reference lists 50,000/1,000. Neither is an app catalog-read limit. Do not promise either as settled; resolve the version/endpoint behavior with Shopify before implementing large catalog-creation integrations. Current read-first procurement work need not depend on that resolution. [11, 14]

The approved Phase 1 engineering envelope already requires 50,000 active variants, 15 locations, 750,000 variant-location states and 1,000,000 order lines across concurrent shops, with p95 indexed queries below 500 ms and durable webhook enqueue below 1 s. These are acceptance targets, not measured production promises. The 32-identity canonical transaction safeguard is not a 32-product merchant limit. [R5]

Add explicit tests for a 2,048-variant product, >250 selectable variants, >50 locations, sparse and dense location membership, duplicate/missing/out-of-order events, simultaneous backfills, hot tenants and queue recovery. Extend a separate certification matrix to 200-location and >50,000-variant shops before offering those sizes. An oversized store needs honest eligibility and bounded import progress, never silent omission.

Measure initial-sync duration, source-to-visible lag, query p95/p99, memory/connection usage, retries, count precision, storage growth and cost per workload. Publish commercial limits only from those results. Plan limits, current engineering envelope and Shopify maxima must be separate fields.

Historical order access is another capacity boundary: Q-016 already records that read_all_orders approval is needed for Shopify lookback beyond 60 days. It is not currently in the scope manifest. Retained app history, imported history and live Shopify-accessible history are different. Last-year forecasting must report insufficient history honestly; null outside the accessible window is not deletion authority. Request protected customer-data access appropriate to order facts even when names/emails are omitted. [15, R6]

Shopify's September 8 announcement assigns multiple variant barcodes to API 2026-10, ahead of this app's 2026-07 pin. It supports up to 20 identifiers; the existing scalar returns only the first, and sending the new array replaces the set. The schema currently stores a scalar in both canonical and legacy variant facts. Before barcode-dependent release, define version-gated collection hydration, primary/display selection, typed validation and ambiguous-scan behavior; preserve extra identifiers on writes. Adopt through a reviewed compatibility lane, not an automatic version bump. [45]

## 4. Inventory authority, incoming and POS

Do not equate an approved app PO with Shopify incoming. Query Shopify's named inventory quantities and record source contributions. General Shopify guidance describes incoming from transfers, POs and apps, while its current procurement workflow separates the PO agreement from shipment and receipt. These descriptions do not establish a universal trigger for every adapter. Verify the chosen stable API version and store capability. Keep app ordered/expected supply separately labeled until represented in Shopify; match linked records so forecast incoming is not counted twice. [16, 17]

`inventorySetScheduledChanges` is unavailable in Admin API 2026-07 and never changed quantities itself. Keep ETAs in app/shipment records and use supported mutations when inventory actually changes. [44]

Native PO and transfer records can change independently. External edits and receipts in Shopify Admin/POS must reconcile to app records. One physical receipt must cause one authoritative inventory effect: never receive a Shopify shipment and also add the same quantity through an adjustment. Failed/ambiguous results remain pending reconciliation; rejected goods do not silently become sellable. [17]

The August 5, 2026 migration moves active draft-order and transfer/shipment holds from reserved to committed without changing available or on-hand; earlier historical records are not rewritten. Update fixtures and state definitions accordingly. Applicable inventory mutations already require idempotency in 2026-04; inventorySetQuantities uses changeFromQuantity with explicit concurrency semantics. Preserve our operation ledger beyond upstream deduplication windows. [18-20]

Create one versioned feature-to-capability matrix: stable API version, scopes, Shopify plan, POS subscription by location, staff permission, app role, location type/state, device/OS, network capability and fallback. Current TOML includes read/write products and inventory, read_orders and read_locations; future transfer/shipment scopes need separate justification and approval when their phase starts. A configured scope is not evidence of a deployed grant.

POS tiles/modals and scanning remain required product surfaces. Native transfer fulfillment/receipt currently needs POS Pro, the relevant inventory/transfer permissions, and connectivity; that does not prove every custom extension requires Pro. Verify our extension targets on supported Lite/Pro combinations and physical devices. [21]

POS authenticated user and pinned staff member can differ. Validate the trusted actor context, location and action server-side; react to staff changes and invalidate elevated approval. No clerk should inherit the manager's authority merely because that manager authenticated the device. Offline extension execution can support draft capture on eligible versions, but unavailable authentication/API calls mean it cannot confirm remote inventory writes. Reconnect must reauthorize and reconcile before commit. [22, 23]

Count acceptance must cover sales during counting, stale baselines, duplicate scans, unknown/duplicate barcodes, lost network, rejected/extra receipts, inactive locations and independent Admin edits. POS/phone label printing needs a declared supported printer path and truthful fallback. Do not imply arbitrary printers work from a tile. POS extension API 2026-07 supports direct receipt printing of HTML/images; discovery needs POS 11.11 or later. PDFs use the system dialog, and empty discovery needs fallback. This does not establish barcode-label printer support. [47]

## 5. Security, privacy and usable merchant experience

RLS is necessary but cannot protect every surface by itself. The acceptance suite must deny cross-store access through requests, pooled DB connections, workers, cache keys, exports, object links, email attachments, support tools, telemetry and future integrations. Use separate operator authentication with MFA, time-limited elevation, an explicit tenant, a ticket/reason and immutable access history. No master merchant password, default impersonation or arbitrary support SQL.

At Phase 1 PR7, finish the actor/role scaffold, platform permissions and privacy jobs. Complete workflow-specific permission enforcement in each authorized PO, receiving, adjustment and other workflow phase. An actor needs both the applicable Shopify authority and app permission, with location/approval checks at commit time. Define baseline restrictions on costs, exports, receiving, adjustments, settings and billing. Revocation/uninstall must stop queued work; reinstall must use fresh authorization and never revive an old job solely because the domain matches.

Minimize customer data. Define actual export/deletion tasks, durable acknowledgement, retries, completion evidence and legally approved retention exceptions. Include old files, caches, provider records and backup-restoration re-deletion so restored data is not resurrected into normal use. Separate app reporting-history windows from lawful record retention and storage deletion; replace the ambiguous promise of snapshots retained forever. Validate secrets encryption, token storage and rotation; database String fields alone do not establish encryption at rest. [24]

Keep Shopify-native App Bridge/Polaris interactions for the embedded product and original branding for the public website. This inventory app should not inject theme code for marketing. Absence of a storefront feature is not a reason to add theme dependencies. Do not add a second merchant login; keep integration settings inside the app. Accessibility, responsiveness and current App Bridge need rendered verification. For CDN Polaris components, track the stable major and matching types; the August semantic-versioning change is separate from App Bridge and does not require an immediate rewrite. [48] Built for Shopify also requires merchant-utility and performance evidence, so its badge cannot be promised at launch. [25]

Current dashboard text exposes `npm run worker` and cache implementation details, plus a free-tier fallback inconsistent with approved packaging. Replace it with clear coverage, freshness, progress and recovery actions tied to authoritative billing state.

Define UX acceptance with real tasks: a buyer can edit large worksheets without losing edits when sorting; a receiver can resume a scan session; an approver sees financial impact and changes; an analyst sees metric definitions and freshness. Include keyboard operation, visible focus, screen-reader status, contrast, touch targets, zoom, long names, empty/loading/error/partial states and mobile-safe layouts. Show dates in merchant timezone, quantities in unambiguous units/cases and money with currency-specific precision. Add locale-aware formatting without claiming untranslated languages.

Settings require defaults, override precedence, scope, audit and effective dates. A change in supplier address, terms, tax, currency or template must not retroactively rewrite a sent PO. Forecast parity and Smart modes remain distinct. Existing Q-004 and Q-012 through Q-016 must be resolved at the relevant consumer gates; especially do not invent per-location demand attribution from a shop-wide rescue model.

## 6. PO documents and email delivery

Treat sending a PO as an operational command. Persist an outbox identity containing shop, PO, revision, recipient and purpose, with an immutable approved recipient/terms/template snapshot. Distinguish queued, accepted by provider, delivered, bounced, failed and uncertain; delivery is not supplier acceptance. An explicit resend creates a new audited action. Never fail over providers blindly after an ambiguous send timeout.

Version HTML, text and PDF together. Support A4 and Letter, repeated table headings, long/Unicode product names, units versus packs, currency/tax identifiers, delivery address, revision and totals. Verify Gmail/Outlook/mobile/dark mode/blocked images, multi-page output and exact arithmetic. Escape HTML/mail headers/CSV formulas/ZPL commands and block unsafe remote attachment fetches. Limit recipient counts, attachment sizes and print quantities. Keep templates and files tenant-scoped with signed short-lived downloads.

Authenticate the app sending domain with SPF/DKIM/DMARC and use a merchant-approved Reply-To; do not spoof merchant domains. Separate procurement messages, account notices and promotional streams. Check provider callback signatures, bounce/complaint suppression and per-shop send limits. Supplier contacts must not enter the app company's marketing list.

Resend Pro is a reasonable implementation-simplicity candidate at $20/month for 50,000 transactional emails; its free tier's 100/day cap is unsuitable for unqualified production promises. Its idempotency window is 24 hours, so database send evidence must last longer. SES's base outbound cost is $0.10 per 1,000 plus relevant data/services, but operational work can outweigh the saving. At 50,000 messages the $15 base-price difference buys only 18 minutes at an assumed $50/hour. Compare Postmark where sender-domain/inbound-reply needs justify it; select one provider initially. [26-28]

## 7. Company operations, billing and growth

| Operating function | Minimum launch capability |
| --- | --- |
| Merchant operations | Verified installs/uninstalls; onboarding state; last successful sync; scopes/API version; enabled locations; plan/usage; errors; reconciliation; support references; tenant cost and safe kill switches |
| Support | One shared helpdesk, in-app Help, searchable guides, ticket ownership/priority, escalation and redacted diagnostic bundles; response hours that match staffing |
| Reliability | Web/worker/pool/queue health, oldest-job age, source freshness, per-store fairness, error grouping, backup/archive alarms, independent status page, release and incident runbooks |
| Finance | Verified subscription lifecycle, MRR/ARR, trial conversion, churn, upgrades/downgrades, refunds, payout reconciliation, acquisition cost and support minutes per store |
| Commercial assets | Cleared name/domain, real UI/screenshots/demo, website, migration guide, pricing/limits, support/security/privacy/terms/subprocessors, changelog and supported-integration directory |
| Engineering operations | Named ownership, release notes, supported runtime/API schedule, dependency/license checks, vulnerability response, rollback/forward recovery and no secrets in logs/artifacts |

Use Shopify App Pricing as approved. Centralize versioned entitlements across routes/jobs; do not infer payment from a redirect or plan button. Exercise accept/decline, trial expiry, frozen/past-due/canceled states, immediate/deferred plan changes, annual renewal, uninstall/reinstall, refunds and duplicated billing events. Confirm any analytics API/data source before building it; use authoritative Shopify subscription and payout evidence. [29]

The approved $29/$79/$149/custom pricing and numerical limits remain hypotheses. All paid plans must retain safe core operation, export and failed-write recovery. Premium approvals and advanced correction convenience cannot remove baseline safety from Essentials. Do not advertise AI credits as usable benefits before the Phase 7 feature exists. Separately meter support, history growth, imports, files, email, queue/DB and AI.

For eligible standard developers, Shopify's 0% revenue-share allowance is the first $1 million cumulative gross app revenue from January 1, 2025, then 15%; it does not reset annually. Processing is separately 2.9%, with applicable taxes/fees and eligibility exceptions. Record actual publisher-account eligibility. [30]

Contribution per shop = net subscription revenue minus platform fees, allocated infrastructure, email/storage/AI, direct support and credits/refunds. At the provisional $29 price, 2.9% processing leaves $28.16 before those costs; after an additional full 15% revenue-share charge it leaves $23.81. Thirty minutes of support at an assumed $30/hour consumes another $15. Support-heavy acquisition can therefore lose money despite cheap hosting. Keep the approved cost/margin gates and validate them with pilot measurements.

Send one appropriate service/setup message after a verified installation; send confirmations after verified billing changes. Installation is not blanket marketing consent. Use purpose-specific preferences and consent evidence for promotional email, unsubscribe/suppression and jurisdiction review; US transactional-message treatment depends on primary purpose. Do not auto-enroll supplier contacts or resume win-back campaigns after reinstall without valid authority. Ask neutrally for reviews after meaningful use, never through incentives, favorable-only filters or unsolicited review emails. [31, 32]

For acquisition, build a fast crawlable website with one App Store install path and feature pages for inventory management, purchasing/receiving, stocktakes, multi-location planning, forecasting and migration. Publish demonstrations, migration instructions, PO examples and transparent formula explanations. Use real synthetic demo data and consented evidence; authenticated app routes remain non-indexable. Search Console and listing analytics should measure qualified visit → install → successful sync → first useful forecast/PO → paid conversion →30/90-day retention. A list of keywords is an experiment plan, not measured search demand. Google's guidance favors useful people-first content over search-engine-first content. [33]

Suggested listing-search hypotheses, once supported: inventory management; purchase orders; inventory forecasting; stock counts; replenishment. Shopify permits up to five search terms and six genuine listed integrations. Its listing restrictions include no keyword stuffing, misleading claims, testimonials or stats in undesignated areas; use real UI assets and accurate requirements/languages. Keep substantiated case studies on the website and follow listing-specific field rules. [2, 4]

Pilot distribution should start with migration content, retail/POS implementer relationships and hands-on merchant interviews. Cap paid acquisition experiments until activation, retention and support economics are known. Do not promise scale from SEO alone or purchase a broad marketing-tool bundle before the funnel exists.

Integrations should begin with stable import/export contracts and internal adapters. Add accounting, ERP/3PL, automation or supplier connectors only for validated demand, with clear read/write ownership and reconciliation. Do not advertise QuickBooks, Xero, Zapier or other apps merely because CSV can be exported. Merchant APIs/webhooks later need versioning, scoped tenant credentials, signed events, rate limits, retries/replay and deprecation commitments. Current App Store policy restricts integrations with non-Shopify POS systems; check eligibility before committing that expansion. [4]

Do not train or improve cross-merchant AI/ML using Shopify-derived data, even aggregates, without the required authorization. Keep model consent, provider retention, tenant boundaries and cost controls explicit; a general privacy notice is not a substitute for required consent. [34]

## 8. Cost-effective infrastructure and recovery

Preserve the approved TypeScript/React Router, PostgreSQL/Prisma and Redis/BullMQ modular application with independent web and worker processes. Do not migrate merely to obtain a newer product label or lower headline price. First qualify role creation, forced RLS, advisory locks, transactions, pooling modes, PostgreSQL extensions/version, tenant context and restore behavior against the actual managed service. Serverless pooling must not invalidate session/transaction assumptions.

All following USD figures are partial illustrative monthly subtotals checked September 8. They include web, worker, database, queue and $20 email where described. They exclude DB/object-storage growth and operations, excess transfer, monitoring/helpdesk paid plans, staging, CI/build excess, domains, security/restore-test resources, tax, labor, acquisition and AI. They are not capacity promises or purchase authorization.

| Candidate configuration | Illustrative subtotal | Qualification |
| --- | --- | --- |
| Render lean pilot | $7 web + $7 worker + $19 PostgreSQL + $10 paid queue + $20 email = $63; add $25 Pro workspace = $88 | Single instances; small memory allocations require measurement; preserve DB-backed durability |
| Railway Pro + managed Neon | Approximately $67.35 under specified example usage | Railway usage floor is max($20, usage); example combined app/worker/Redis uses average 2 GB RAM, 0.2 vCPU, 5 GB volume, 10 GB egress; Neon assumes 0.25 CU always on for 730 h, 5 GB DB and 5 GB retained WAL; no measured capacity |
| Render + Supabase Pro | $7 web + $7 worker + $10 queue + $25 database + $20 email = $69; PITR adds $100 plus approximately $5 compute uplift → approximately $174 | PITR needs at least Small compute; daily backups are not PITR; validate role/pool requirements |
| Render with replicated web and Postgres standby | $25 workspace + $50 web + $25 worker + $110 primary/standby DB + $32 queue + $20 email = $262 | Not end-to-end HA: queue remains single-instance; no cross-region recovery promise |

Prices and configuration details: Render compute/workspace [35, 36]; Railway [37]; Neon [38]; Supabase [39]; email [26]. Prefer the consolidated Render candidate for an initial qualification because it aligns with the approved plan, not because these subtotals prove it cheapest in production. Maintain an itemized 30-day operating budget after actual workload measurement; do not publish a universal cost-per-store estimate now.

Render's current paid Redis-compatible service uses Valkey; verify exact BullMQ compatibility, noeviction, persistence, memory limits, connection caps and recovery. Database-backed inbox/outbox and replay remain the durability foundation. Paid Render PostgreSQL recovery windows are 3 days on Hobby/7 on Pro and exclude restore points within the most recent 10 minutes. Its standby is asynchronous. Supabase's $25 plan does not include PITR. Railway now has PostgreSQL PITR, but its database templates still require operator responsibility. [39-43]

A database restore cannot undo a supplier email or inventory update already accepted elsewhere. Restore into isolation, recover deletion/authorization state, reconcile external operation IDs and uncertain sends, and only then resume. Define numeric recovery objectives from business tolerance and demonstrate them. Do not sell zero data loss, continuous availability, geographic residency or 24/7 support without a delivery model.

Build a small operator console and buy commodity services selectively: one transactional provider, one helpdesk, redacted error monitoring and an independent status monitor. Pilot free tiers need monitored limits; a support cap that blocks replies is an operational risk. Avoid duplicate CRMs, custom helpdesk software, Kubernetes, Kafka, a data warehouse and premature LLM infrastructure. Preserve the existing docs-only CI optimization; do not rerun the full suite for research-only changes.

## 9. Prioritized action register

These audit IDs are supplemental recommendations, not replacements for existing F/R/D/Q identifiers. Confirm exact phase ownership in the normal brief process. No row authorizes its own implementation.

| ID / timing | Required outcome | Owner and acceptance evidence |
| --- | --- | --- |
| A01 Before rename | Owner selects cleared brand/domain strategy | Owner + ChatGPT; recorded name, exclusions and surface inventory |
| A02 After A01 | Complete current-surface rename with safe persistent-identity migration | Cursor; full diff/scan/fresh+existing DB/queues/build; Claude Tier-A review |
| A03 Before next handoff | Reconcile main/PR37 status and matrix/roadmap phase conflicts | ChatGPT/Cursor docs; retain 132 IDs and immutable reviews; exact live evidence |
| A04 Phase 1 PR7 | Finish actor/role scaffold, platform permissions and privacy; enforce later workflow actions in their own phases | Cursor/Claude; negative permission tests, export/redaction/reinstall manifests |
| A05 Phase 1 PR8 and earlier applicable gates | Certify current engineering envelope and recovery; retain R-095/R-096 before enforcement rehearsal and R-098 before rollout-evidence claims | Cursor/Claude; named-environment timings, query plans, fairness, restore and actual-role denial evidence |
| A06 Before deployment work; installation proof before pilot | Verify app registrations/environment separation under Q-002; then scope grants, protected data, expiry handling and supported install flow | Account holder + implementation; linked environment records and real dev-store install/reinstall/incognito tests |
| A07 Before Phase 2 consumers | Freeze incoming de-dup, location-grain demand, historical access and monetary definitions | ChatGPT; Q004/Q012-Q016 decisions and reference fixtures |
| A08 Phase 2/UI consumers | Remove hidden list/picker caps and enforce reproducible parity | Cursor; beyond-page selection and edit persistence; formula reconciliation |
| A09 Before write phases | Freeze current transfer/shipment/inventory adapter semantics | ChatGPT + Claude; versioned scope/state map and external-edit/duplicate receipt tests |
| A10 Phases 3-4 | PO revisions, templates and reliable email outbox | Cursor; long-document renders, bounce/timeout/retry evidence and tenant-safe files |
| A11 Phases 4-5 | POS roles/devices/offline drafts/count conflicts/printing | Cursor; physical-device and staff-switch verification with failure recovery |
| A12 Before public billing | Replace prototype billing with verified pricing and lifecycle | Cursor/Claude; plan transitions, decline/freeze/reinstall and entitlement tests |
| A13 Before public release | Operator console, helpdesk, incident/recovery and trust assets | Product/operations; access audit, support drill and documented staffing |
| A14 Before deployment | Supported runtime and explicit web/worker/migration packaging | Cursor/Claude; production-image build/start, restricted-role deploy and rollback |
| A15 Before public capacity/pricing claims | Meter total COGS and set validated limits | Product/CFO; pilot workload/support data and account fee/payout reconciliation |
| A16 Before listing | Real claims/assets, eligibility, privacy/support links and review submission evidence | Product/account holder; shipped-feature matrix and live App Store checklist |
| A17 Before pilot/listing; expansion after activation evidence | Foundation website/docs and pilot recruitment first; expand paid acquisition after retention and support economics are established | Product/sales; accurate public assets and attribution through retained paid cohorts |
| A18 Later integration/AI gates | Scoped adapters, interoperability and lawful model use | Product/engineering; endpoint contracts, consent and cost/quality gates |
| A19 Before barcode-dependent release | Version-gated multiple-barcode model and scanner behavior | Product/Cursor/Claude; pinned-schema hydration, ambiguity and non-destructive update tests |

Phase mapping conflicts must be resolved explicitly: matrix F028-F031 place some parity methods inPhase 3 while roadmap requires all six inPhase 2; F057-F059 place receiving inPhase 3 while roadmap places it inPhase 4; some AI/Smart rows point toPhases 5-6 while roadmap places them inPhase 7. Other email/permissions rows also lag their earlier foundation obligations. Preserve feature identity and approved safety dependencies; do not silently pick whichever phase permits earlier coding.

Three packaging clarifications require recorded decisions: baseline authorization/export/failure recovery on every paid plan; no sale of unavailable AI capabilities; and separate reporting depth from lawful retention. These are commercial acceptance boundaries, not grounds to redesign the entire app.

## 10. Closure and next action

The material second-pass findings are captured: domain registration despite clean search results, stale control status, operational versus canonical pagination, existing token support, deployment packaging, omitted queue costs, incomplete HA assumptions, external effects after restore, native incoming ambiguity, endpoint count exceptions and conflicting creation-throttle documentation. None was converted into an unsupported completion or capability claim.

Stop broad re-investigation here. Carry unresolved evidence into named gates: trademark/domain acquisition; Partner app IDs/grants; production-like load and restore; browser/mobile/POS behavior; email deliverability; billing reconciliation; final legal terms; and Shopify's conflicting creation-limit documentation. Maintain a scheduled API/dependency/policy review as normal engineering ownership, not another open-ended planning cycle. No automation has been scheduled by this report.

The immediate owner decision is the brand. Then run the dedicated rename contract through Cursor and Claude while respecting the active PR37 branch and its separate merge decision. The audit should be reviewed as a documentation-only proposal. Runtime fixes belong to their authorized focused lanes, with no main rewrite, flag enablement, production connection, paid-service commitment or merchant email caused by this assessment.

## Sources

All web sources were checked September 8, 2026 unless a publication date is stated. Official documentation is version-sensitive. Repository references are connected-source evidence at the stated commit, not claims that a deployed system was tested.

[R1] Repository main: https://github.com/Vedang1998/Stocky/tree/09feffd3f36eb4698f2ed8a152efe414cd9b77bd

[R2] PR34 and main CI: https://github.com/Vedang1998/Stocky/pull/34 ; https://github.com/Vedang1998/Stocky/actions/runs/34071226302

[R3] PR37 and exact-head CI: https://github.com/Vedang1998/Stocky/pull/37 ; https://github.com/Vedang1998/Stocky/actions/runs/34137287606

[R4] PR6-A correction review: https://github.com/Vedang1998/Stocky/blob/f7a39c3664a8a45b7a7cd3055079b4ebc888bb02/stocky-plus/docs/phases/phase-1/PR6_A_FOUNDATION_CORRECTION_INDEPENDENT_REVIEW.md

[R5] Phase 1 brief: https://github.com/Vedang1998/Stocky/blob/09feffd3f36eb4698f2ed8a152efe414cd9b77bd/stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md

[R6] Open questions: https://github.com/Vedang1998/Stocky/blob/09feffd3f36eb4698f2ed8a152efe414cd9b77bd/stocky-plus/docs/OPEN_QUESTIONS.md

[1] Shopify. Unique app naming update, July 15, 2026. https://shopify.dev/changelog/updated-app-store-requirements-4-1-2-use-a-unique-name-for-your-app

[2] Shopify. App Store best practices. https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices

[3] Verisign. Public .com RDAP registry lookups: shelfaro.com, getshelfharbor.com and getreplenara.com returned HTTP 404; shelfharbor.com and replenara.com returned HTTP 200. https://rdap.verisign.com/com/v1/domain/shelfaro.com ; https://rdap.verisign.com/com/v1/domain/getshelfharbor.com ; https://rdap.verisign.com/com/v1/domain/getreplenara.com ; https://rdap.verisign.com/com/v1/domain/shelfharbor.com ; https://rdap.verisign.com/com/v1/domain/replenara.com

[4] Shopify. App Store requirements. https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements

[5] Node.js. Release support table. https://nodejs.org/en/about/previous-releases

[6] Shopify. Code-checkable self-review requirements and review limitations. https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements.md ; https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review

[7] Shopify Help Center. Migrating from Stocky. https://help.shopify.com/en/manual/products/inventory/transitioning-from-stocky

[8] Shopify. Inventory purchase-order query, unstable. https://shopify.dev/docs/api/admin-graphql/unstable/queries/inventoryPurchaseOrders

[9] Shopify. Variant limit 2048, October 15, 2025. https://shopify.dev/changelog/the-product-variant-limit-is-now-2048-for-all-merchants

[10] Shopify Help Center. Location limits. https://help.shopify.com/en/manual/fulfillment/setup/locations/setup

[11] Shopify. API limits. https://shopify.dev/docs/api/usage/limits

[12] Shopify. productsCount. https://shopify.dev/docs/api/admin-graphql/latest/queries/productsCount

[13] Shopify. Bulk query operations. https://shopify.dev/docs/api/usage/bulk-operations/queries

[14] Shopify. productCreate reference; conflicts with general limits page on creation throttles. https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate

[15] Shopify. Protected customer data. https://shopify.dev/docs/apps/launch/protected-customer-data

[16] Shopify. Inventory management apps and inventory states. https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps ; https://help.shopify.com/en/manual/products/inventory/fundamentals/inventory-states

[17] Shopify Help Center. PO-linked transfers. https://help.shopify.com/en/manual/products/inventory/purchase-orders/creating-inventory-transfers

[18] Shopify. Reserved-to-committed change, August 5, 2026. https://shopify.dev/changelog/draft-order-and-transfer-shipment-inventory-is-moving-from-reserved-to-committed

[19] Shopify. Mandatory inventory idempotency. https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations

[20] Shopify. Inventory compare-and-swap redesign. https://shopify.dev/changelog/finalizing-compare-and-swap-redesign-for-inventory-set-quantities

[21] Shopify Help Center. POS transfer fulfillment/receipt. https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/fulfilling-and-receiving-transfers

[22] Shopify. POS Session API. https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis/standard-apis/session-api

[23] Shopify. POS UI extensions, 2026-01. https://shopify.dev/docs/api/pos-ui-extensions/2026-01

[24] Shopify. Privacy compliance. https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance

[25] Shopify. Built for Shopify requirements. https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

[26] Resend. Pricing. https://resend.com/pricing

[27] Resend. Idempotency keys. https://resend.com/docs/dashboard/emails/idempotency-keys

[28] Amazon Web Services. SES pricing. https://aws.amazon.com/ses/pricing/

[29] Shopify. App billing. https://shopify.dev/docs/apps/launch/billing

[30] Shopify. App Store developer revenue share. https://shopify.dev/docs/apps/launch/distribution/revenue-share

[31] US Federal Trade Commission. CAN-SPAM compliance guide. https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

[32] Shopify. Manage app reviews. https://shopify.dev/docs/apps/launch/marketing/manage-app-reviews

[33] Google Search Central. Helpful people-first content. https://developers.google.com/search/docs/fundamentals/creating-helpful-content

[34] Shopify. API License and Terms of Use, updated February 27, 2026. https://www.shopify.com/legal/api-terms

[35] Render. Current compute and queue pricing. https://render.com/pricing

[36] Render. Workspace pricing change, fully rolled out August 1, 2026. https://render.com/blog/better-pricing-for-fast-growing-teams

[37] Railway. Pricing and usage. https://railway.com/pricing ; https://docs.railway.com/pricing

[38] Neon. Usage-based compute/storage/history pricing. https://neon.com/pricing

[39] Supabase. Pricing, PITR and required compute. https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery ; https://supabase.com/docs/guides/platform/manage-your-usage/compute

[40] Render. Key Value persistence. https://render.com/docs/key-value

[41] Render. PostgreSQL recovery. https://render.com/docs/postgresql-backups

[42] Render. PostgreSQL high availability. https://render.com/docs/postgresql-high-availability

[43] Railway. Database responsibility and PITR. https://docs.railway.com/databases ; https://docs.railway.com/volumes/point-in-time-recovery

[44] Shopify. Scheduled quantity changes and 2026-07 removal. https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states

[45] Shopify. Multiple variant barcodes, September 8, 2026; API 2026-10. https://shopify.dev/changelog/product-variant-barcode-is-being-replaced-by-barcodes

[46] Shopify. Offline refresh-token resilience, August 28, 2026. https://shopify.dev/changelog/more-resilient-refreshes-for-expiring-offline-access-tokens

[47] Shopify. POS hardware printing, July 27, 2026. https://shopify.dev/changelog/pos-ui-extensions-can-now-print-directly-to-hardware-receipt-printers

[48] Shopify. Polaris CDN semantic versioning, August 31, 2026. https://shopify.dev/changelog/the-polaris-cdn-is-adopting-semantic-versioning
