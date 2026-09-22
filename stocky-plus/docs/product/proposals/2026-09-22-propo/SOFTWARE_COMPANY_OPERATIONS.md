# IVYY LLC — operating ProPo as a public software business

**PROPOSED launch requirements / no provider account or subscription created.** This fills the distinction between a merchant app and the business required to operate it. Evidence/price checks are dated 2026-09-22; sources in RESEARCH_SOURCES.md.

## 1. Minimum operator plane before public launch

Separate merchant UI, staff capabilities and IVYY operator access. Build a narrow operator plane for our unique tasks, not a general CRM/helpdesk/billing clone. Operator authentication needs MFA, least privilege, explicit tenant context, sensitive-action approval and immutable audit. A support dashboard is not a migration-role SQL console.

| Capability | Required launch behavior |
|---|---|
| App/store directory | App ID + canonical shop ID/domain, install generation, install/uninstall/reinstall timestamps, locale/region, connection/scope and onboarding status; source/freshness visible |
| Subscription/entitlement ledger | Authoritative active plan, trial, pending changes, cancellation/freeze, effective dates and reconciliation; no credit-card data stored |
| Technical health | Per-shop sync/watermark, jobs/backlog, failed operations, redacted error IDs, service status and release correlation; safe runbook-linked recovery |
| Support tickets | Email/in-app ticket intake, owner/priority/status, diagnostics consent, conversation history, escalation, knowledge-base link and engineering issue correlation |
| Access support | Time-bounded merchant-authorized support session, read-only first, exact requested capabilities, reason and approval; visible audit/revoke; no blanket impersonation |
| Safety operations | Tenant-scoped kill switch and recovery controls, uncertain-outcome handling, deletion/request deadlines, uninstall token revocation, backups/restore checks and incidents |
| Communications | Transactional onboarding/billing/security and consented product marketing separated; delivery/bounce/suppression records |
| Business reporting | Active installs versus active users versus subscribers, activation, churn/cancellation, support load, provider costs and cohort retention; metrics definitions and no fake revenue |
| Release/support readiness | Versioned help, supported devices/regions, status page and incident messages, escalation owner, runbooks and rollback/forward recovery |

The operator plane may use shared infrastructure but must not expose arbitrary cross-tenant queries to merchant sessions. Merchant logs and tickets are not automatically safe inputs to development agents.

## 2. Billing source of truth — important current API distinction

For a new public app with supported pricing, use Shopify App Pricing. Current official guidance places plan configuration in Partner Dashboard, app monitoring/configuration in Dev Dashboard, and active subscription/history queries in Partner API [V11/V12]. This research does not verify whether our app is enrolled or has the necessary client permissions.

App Pricing's current subscription-state contract is not the legacy appSubscriptionCreate + APP_SUBSCRIPTIONS_UPDATE flow. Use activeSubscription and scheduled/on-access reconciliation for out-of-redirect changes; redirect parameters are lookup/context only, never proof of paid entitlement. Historical events explain installs, cancellations, charges and earnings but are not the sole current-state authority. Respect API window/pagination limits and a durable ingestion cursor; absence from one page is not absence of a store.

Use a centrally versioned entitlement service: signed/current source observation, cache validity, pending tier change and graceful policy for temporary provider failure. No client-supplied plan name, redirect parameter or stale renewal flag grants capabilities. Handle reinstall, free dev tests, upgrades, scheduled downgrades, cancellations/freeze/refunds, duplicate events and read outages. Do not cut off privacy processing, legally required exports or completion/reconciliation of already-committed stock effects when a billing check is delayed. No manual off-platform substitute for Shopify-required app billing.

Do not implement both billing systems for a new app by accident. If there is actual legacy enrollment, document the transitional two-source contract rather than assuming it. Partner API credentials are operator secrets, not merchant browser tokens. No production billing or provider configuration was changed here.

## 3. Support and safe variant repair

Use a managed helpdesk for email/ticket workflow. Store only the ticket reference and operational context ProPo uniquely needs. The public app requires a valid support email [V21]; domain/email acquisition remains a launch prerequisite. Do not invent support@ addresses that nobody receives.

Merchant-visible support access: request purpose, tenant, expiry, permissions and ticket ID; consent or other approved legal authority; operator session carries both real operator and effective merchant context; costs/PII masked unless specifically needed; every read and write auditable; immediate revocation. Prefer a diagnostic bundle or screen sharing to silent impersonation. A support request is not authorization for inventory, price or historic-ID writes. The lineage workflow in LIVE_STOCKTAKE_AND_HISTORY.md requires its own preview/approval.

Tickets must not contain app secrets, full raw order payloads or database dumps by default. Sanitize before forwarding to GitHub; private engineering issue and public merchant reply are different records. Mark automated replies honestly and escalate unresolved or safety-sensitive issues to the owner; no claim of 24/7 human support without staffing.

## 4. Lean tool choices and cost envelope

Recommended pilot shortlist, not accounts purchased or guaranteed production capacity:

| Function | Preferred approach | Observed cost/limit and decision |
|---|---|---|
| App billing and store events | Shopify App Pricing + Partner/Dev dashboards | Native required workflow where supported; no second billing SaaS |
| Errors/traces | Sentry, PII scrubbed; session replay off until justified | Official Developer tier $0/one user; team/features/quotas may require paid plan. Do not share one login or assume free API integrations [V18] |
| Ticketing | Zoho Desk managed email ticketing | Official Free edition advertises three support users; paid API/workflow/knowledge-base capabilities require actual edition verification. Pricing page localized to INR in this fetch; no fabricated USD paid quote [V17] |
| Transactional mail | Resend adapter | Official free 3,000/month, 100/day; Pro listed $20/month/50,000 with usage terms. This is not sufficient for all merchants; owner approves paid capacity before launch volume exceeds limits [V19] |
| Marketing lifecycle | Brevo, only consented audience | Official free 300 sends/day; paid starts advertised from $9/month. Do not let campaigns consume the quota reserved for supplier POs/security messages [V20] |
| Engineering tracking | Existing GitHub issues/PRs | No new project-management SaaS; no customer PII/secrets in public issues |
| Runtime/data | Keep approved Node/Postgres/Redis/object storage stack | Provider/region/backup choices need a real quote and production cost model, not a $0 promise |

Proposed choice is separate operational and marketing streams so a promotion cannot exhaust PO delivery. At small scale these may be separate provider accounts/streams, but verify actual quotas, DNS, suppression, data region and failure behavior before choosing. Do not silently install both if one proven service safely covers the required segregation at lower total cost. “Free” still costs setup/support and may omit necessary features.

Build a cost sheet for compute, workers, DB/backups, Redis, storage/egress, email, observability, helpdesk, domain, taxes/payment fees and support time across mixed cohorts. Existing coding-agent overages being disabled does not make these costs disappear. Keep quotas and escalation; no provider purchase or automatic overage authorized by this document.

## 5. Email/event lifecycle

Record event IDs and delivery purpose. Installation onboarding, failed sync, security/privacy and a supplier PO are transactional/operational contexts; offers, cross-sells and win-back mail are marketing and need the appropriate consent/suppression handling. Installation is not blanket permission for all future IVYY app offers. Uninstall stops operational credentials/jobs and triggers cleanup; it does not create marketing consent. Commercial email to Canada and US business recipients still needs applicable controls [V15/V16].

For each automation declare event, audience/source, lawful basis/consent, template/locale, delay, deduplication key, cancel condition, reply address and suppression rules. Keep unsubscribe and security/required messages distinct without using the distinction to send advertisements as “service notices”. Do not retain uninstall data indefinitely for marketing. Domain verification/SPF/DKIM/DMARC, bounce handling and provider delivery evidence precede sending as ProPo. No merchant-facing campaign was sent here.

## 6. Ecosystem and BYOK boundary

Later IVYY products share a versioned identity/event contract, not unrestricted tenant records. Each Shopify app obtains its own app permission and billing relationship; merchant authorizes cross-app data flow. Use app-qualified event IDs, replay/echo prevention, retention and per-app unlink/delete behavior. Treat near-real-time synchronization as observable eventual consistency, with reconciliation.

Future AI is merchant-owned provider billing/key only after first launch and testing. No ProPo credits or hidden shared fallback. Secret storage, provider routing/egress allowlist, explicit data permission, action budget/rate caps, revocation, logs redaction and failure handling remain ProPo responsibilities. A merchant-funded key does not remove privacy or model-error risk. Numerical inventory/cost calculations stay deterministic. Details are in PRICING_AND_BYOK_CHANGE_PROPOSAL.md.

## 7. Launch readiness and measurements

Before public release demonstrate operator login isolation, store/event reconciliation, billing test plans, cancellation/degradation without data loss, ticket receipt/response, support grant/revoke/audit, incident escalation, delivery failures, backup/restore and privacy deletion across ticket/export/log surfaces. Defined KPIs: install-to-first-valid-sync; first useful order; receiving completion; unexplained discrepancy; support response/resolution; billing/entitlement divergence; availability and cost per active shop. No current metrics were measured by this proposal.
