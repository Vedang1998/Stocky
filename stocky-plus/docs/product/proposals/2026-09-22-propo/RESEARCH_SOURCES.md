# ProPo revision-2 research register

Checked **2026-09-22**. Separate owner statements, external primary-source facts, historical repository evidence and product-owner proposals. This is desk R&D, not merchant interviews, a live-store integration test, a professional legal opinion or current app completion audit.

## Repository and owner basis

Main X `f057d98c8a321b3e06875a6e9a83b787bcbc101f`, frozen PR45 H `3cc2045107b54601c6b0e43c8690b7d090074b80`, PR53 starting `057bcf6205abb6b93f08e12c0d7f891cb112926e`, PR54 starting `c379bc0d078d80e33db751bbb23f37289329fbce`. Read current metadata/comments and the existing source documents. Prior full product sequence at unchanged X remains the authority baseline. User-provided historical packets retain their own dates/heads and unexecuted integration qualifiers; none proves a present app feature or current CI.

The user's detailed answers are captured in README O2-01…16. They change the requested design direction, not the formal approval state of product/11, PR45 or this proposal. Initial source register is preserved in the parent commit for provenance; this current register supports the revision-2 claims.

## Primary sources

| ID | Source | Verified use / limitation |
|---|---|---|
| V01 | https://help.shopify.com/en/manual/your-account/users/users-plan-requirements ; https://shopify.dev/docs/api/usage/access-scopes ; https://shopify.dev/docs/api/admin-graphql/2025-10/objects/StaffMember ; https://community.shopify.dev/t/why-isnt-the-read-users-access-scope-documented-as-custom-app-only/26606/2 | Staff limits 0/5/15/unlimited and excluded types; restricted read_users. GraphQL eligibility and Shopify staff clarification differ on public-app access. Treat universal import as unsupported, seek actual approval; no granted scope tested |
| V02 | https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens ; https://help.shopify.com/en/manual/your-account/users/roles/permissions/store-permissions | Identity versus access permission, online/offline/user scope and token lifecycle. No live login or installed-library proof rerun; existing PR49 failures retained |
| V03 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/reporting/average-unit-cost ; https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/faq | Stocky internal average-cost behavior, historical approximation and optional average-cost sync into Shopify; not an implemented ProPo ledger |
| V04 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/inventory-management/stocktakes | Stocktake behavior and unfulfilled-order/history limitations; not proof Shopify movement data is universally complete |
| V05 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/inventory-management/low-stock | Low-stock vendor/variant priorities and open-order coverage inform Home hypothesis; exact historic home layout not reconstructed |
| V06 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/reporting/report-types | Report catalog, filters/columns and stock snapshot semantics; original product reference, not ProPo completion evidence |
| V07 | https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis/platform-apis/scanner-api ; https://shopify.dev/docs/api/pos-ui-extensions/2026-01 | Barcode/camera surfaces and documented offline options. Actual device, API version and permissions must be tested |
| V08 | https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis/standard-apis/session-api | Token authenticated user differs from pinned POS staff; local ID is not sufficient server authorization |
| V09 | https://shopify.dev/changelog/finalizing-compare-and-swap-redesign-for-inventory-set-quantities ; https://shopify.dev/docs/api/admin-graphql/latest/input-objects/InventoryQuantityInput | changeFromQuantity and stale comparison. 2026-04 breaking-change guidance; some mutation prose still mentions older compareQuantity. Exact stable schema/runtime revalidation mandatory |
| V10 | https://shopify.dev/changelog/concurrency-protection-features ; https://shopify.dev/docs/api/usage/idempotent-requests | Per-mutation idempotency and concurrency requirements; no claim every mutation has identical guarantees |
| V11 | https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing ; https://shopify.dev/docs/apps/launch/billing | Current default App Pricing, hosted plan selection and activeSubscription/history. After-April-2026 current path differs from legacy billing webhooks; actual enrollment not inspected |
| V12 | https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing/migrating-to-shopify-app-pricing ; https://shopify.dev/docs/api/partner/unstable | Partner API versus App Events credentials and integration roles. Use supported version at implementation; unstable reference is not permission to ship unstable production dependence |
| V13 | https://www.inventory-planner.com/ | Advertised advanced Open-to-Buy; establishes feature exists, not prevalence, necessity, efficacy or measured ROI |
| V14 | https://help.prediko.io/en/articles/9031704-what-columns-can-you-add-to-the-buy-table | Published customizable buying/report columns; vendor claims and inconsistent 80+/100 wording not a benchmark |
| V15 | https://crtc.gc.ca/eng/com500/faq500.htm | CASL general guidance on consent/identity/unsubscribe and messages received in Canada; no individualized legal determination |
| V16 | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business | Commercial/B2B versus transactional email and opt-out requirements; not a full state-law survey |
| V17 | https://www.zoho.com/desk/pricing.html | Free edition three support users and managed ticketing. Paid pricing localized to INR in returned page; no USD paid price inferred; edition/API entitlements need verification |
| V18 | https://sentry.io/pricing/ | Free Developer one-user tier; paid/team/usage limits. No provider account configured; quota handling and production suitability untested |
| V19 | https://resend.com/pricing ; https://resend.com/products/transactional-emails | Published free/pro transactional allowances and paid overage terms; optional automatic overage not enabled |
| V20 | https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan ; https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans | Free daily email cap, queues/branding limits and starting advertised tiers. Dynamic main pricing page returned only an iframe; use official help, not assumed unlimited delivery |
| V21 | https://shopify.dev/docs/apps/launch/distribution/support-your-customers | Public app support channel and valid support email requirement; no mailbox created |
| V22 | https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/guide_org/ ; https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/ | PIPEDA responsibilities and meaningful consent; HTML summaries used, linked PDF not analyzed; provincial applicability unresolved |
| V23 | https://www.oqlf.gouv.qc.ca/francisation/entreprises/contrats-adhesion.html | Updated 2026-05-20 French-first adhesion-contract guidance with exceptions; individualized Quebec territorial/language analysis still required |

## Preserved research references for later scopes

Earlier draft references retain their original provenance at parent c379bc0d: Apple public HIG; Shopify App Design Guidelines; WCAG2.2; FPP rolling-origin validation; SAP ABC/XYZ; TSB research; SAS FVA; Shopify cost/variant write APIs; EDPB/ICO transfer roles; USPTO; FTC/European pricing guidance. These were not all re-executed in this revision and do not establish app behavior. New research avoids claims about Odoo's exact current BYOK product merely from the user's analogy.

## Not verified or executed

No corporate/trademark/domain registration, pricing-page conversion experiment, pilot recruitment, legal skill certification, actual Shopify scopes/roles granted to this app, library upgrade, production event stream, camera hardware, inventory mutation, provider subscription, billing enrollment or automatic merge control was tested. No application/model tests were run by ChatGPT. Source conflicts are visible and require implementation-time resolution; they are not settled by selecting the most convenient example.
