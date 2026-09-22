# ProPo — legal and trust readiness plan

**COUNSEL-READY RESEARCH / NOT LEGAL ADVICE, PUBLISHED TERMS, OR LAUNCH CLEARANCE.** Prepared 2026-09-22 for owner-supplied IVYY LLC. No corporate filing, trademark search opinion, legal-hold decision, data transfer contract, provider agreement or worldwide compliance assessment has been completed by this document. Q-008 remains OPEN.

## 1. Reject the “terms protect us everywhere” assumption

Contracts allocate certain risks; they do not erase statutory duties, security defects, fraud, privacy violations or every category of liability. Global Shopify availability does not establish that IVYY LLC may lawfully supply every feature to every jurisdiction. Choose a global-ready architecture and a territory/feature release matrix reviewed by qualified counsel; do not advertise blanket worldwide compliance.

The owner selected ProPo and supplied IVYY LLC's New York identity/address. Verify the company's legal status, authority, relevant assumed-name filings, insurance and intellectual-property ownership before publishing final commercial documents. A business/entity/domain name is not a substitute for trademark clearance [R20].

## 2. Privacy roles and data map

Determine roles by activity. A plausible starting analysis is that merchants control their shopper-commerce purposes and ProPo processes operational data on instructions, while IVYY LLC controls its own account, billing, support and security purposes. This is an analytical starting point, not a blanket legal classification. EDPB defines controller/processor by who determines purposes and means and identifies contract/subprocessor obligations [R13].

Inventory/order identifiers, staff IDs, supplier contacts, logs, IP addresses, derived links and hashes can still be personal or confidential data. Removing a name or hashing an identifier does not automatically anonymize it. Forecasting should not require raw shopper names, addresses or communications. Define processing purpose, necessity, source, access role, storage/region, transfer, retention, deletion/replay and export for each data class.

A data map must cover PostgreSQL; Redis and queued payloads; exports/object storage; temporary scratch; logs/telemetry; crash reports; support attachments; backups/restores; email; AI prompts/results; external connector caches; developer tools and CI artifacts. No production PII or secrets in agent prompts/repositories by default. Data residency is not proven merely because the primary database is in one region.

## 3. Jurisdictional release matrix

All rows are **REQUIRES ASSESSMENT**, not approved launch countries. Add the actual target-country list, relevant establishment/targeting facts, feature and data flows, counsel owner, evidence date and release decision.

| Territory family | Matters to assess before availability | Technical/product evidence |
|---|---|---|
| United States / New York | Privacy/security applicability, state breach notices, contract/consumer rules, tax, entity/IP and insurance | Security program, incident response, purpose/retention/access inventory; NY SHIELD administrative/technical/physical safeguards [R16] |
| California and other state privacy regimes | Business applicability plus separate service-provider/contractor obligations; evolving sensitive-data and consumer-rights rules | Appropriate contracts, request handling, deletion/opt-outs where applicable; do not infer exemption from a small startup's revenue alone [R15] |
| EEA | GDPR territorial scope, processor/controller terms, records, privacy by design, rights, DPIA/DPO/Article 27 representative where applicable, transfers | Minimized data map, access/deletion controls, DPA, lawful transfer route and assessment, subprocessor register [R13/R14] |
| United Kingdom | UK GDPR/DPA and applicable amendments, local representative and transfer analysis | Where needed UK IDTA or EU-SCC Addendum and transfer assessment; EU SCCs alone are not the UK mechanism [R19] |
| Other territories | Local privacy, localization/transfer, consumer, tax, sanctions and contracting requirements | Country-specific counsel review; mark NOT ASSESSED until complete, not automatically supported |

Supporting global formats (time zones, units, currency, language, tax-inclusive display, accessibility) is distinct from permission to launch. Disabling a territory does not prove residents' data from that territory cannot appear in a merchant's cross-border operations; the data map must address that too.

## 4. Document package to produce and have reviewed

| Document / record | Required substance | Completion evidence |
|---|---|---|
| Merchant terms / order form | Service scope; fees/renewal/cancellation; authorized use; merchant responsibilities; supported regions; forecasts/approvals; IP/data rights; termination/export; warranties/liability and dispute terms appropriate to jurisdiction | Counsel-reviewed version and informed assent/version record; no invented enforceability guarantee |
| Privacy notice | Actual processing purposes/roles; categories/sources; recipients/transfers; rights/contact; retention principles; cookies/analytics where used | Matches running product and provider inventory; accessible publication |
| DPA and transfer annexes | Instructions, confidentiality, safeguards, subprocessors, assistance, breach notice, deletion/return, audits and actual transfer route | Signed/configured agreements and completed annexes, not blank templates |
| Subprocessor register | Provider/function, data categories, location, terms, changes/objections as required | Actual vendors and signed protections, no aspirational vendor list |
| Security/TOMs and incident plan | Access review, encryption/key management, vulnerability management, backup/restore, secure development, escalation and legally applicable notice clock | Tested exercises and named accountable people; no SOC 2/ISO certification claim without evidence |
| Retention/legal-hold schedule | Purpose, period, authority, expiry/replay trade-off, holds, backups and recovery | Counsel/product-approved Q-008 disposition; synthetic test periods are not legal defaults |
| API / integration terms | Credential/scope handling, third-party permissions, quotas, data direction, revocation, version support and misuse | Connector-specific acceptance and merchant configuration records |
| AI notices and evaluation record | Which functions are statistical or generative, intended use, human control, providers/data retention, quality/cost limits | Intended-purpose classification and documented evaluations; no cross-merchant training by default |
| IP / license records | Employee/contractor assignment, third-party licenses, asset rights, SBOM and trademark clearance | Executed assignments and provenance; open-source license notices preserved |
| Market-release checklist | Privacy, tax, sanctions, payments, accessibility, contract and support readiness | Named reviewer/date/decision per market and feature |

Do not fill missing legal facts with plausible prose. A draft privacy notice that says “we never store data” or “we do not use AI providers” when the architecture does so creates additional risk.

## 5. Operational privacy and irreversible actions

Implement Shopify's required privacy topics and authentication/acknowledgement/completion contract as documented and version-checked [R21]. A declared webhook topic or a test fixture is not an operating processor. Keep the frozen PR45 review as the governing technical gate; this research neither replaces it nor certifies its actual application integration.

Deletion must cover root and linked children, exports, queues, scratch, caches and future restore behavior. Persist only the minimized justified evidence needed under a finite approved policy. A legal hold is not a blanket preservation excuse; hold authority, scope, separation, review/expiry and access must be explicit. Backups need a documented, lawful restore/re-delete strategy. Reconciliation must show absence versus merely invisible rows, and no late writer may recreate erased data silently.

Incident notification duties and clocks vary by jurisdiction/role. Prepare a verified contact tree and escalation timer, not a universal deadline guessed from memory. Do not let an agent suppress an incident because its confidence is low; preserve evidence and notify the accountable owner.

## 6. Pricing, competition and commercial confidentiality

ProPo's proposed optimization should use a merchant's own data and authorized supplier offers. Do not pool nonpublic competitors' current/future prices, margins, planned orders or capacity into coordinated retail-price recommendations. DOJ's recent algorithmic-coordination enforcement is a concrete warning about exchanging competitively sensitive information; its September 4, 2026 Pinnacle resolution is a **proposed** decree, not a blanket final rule for ProPo [R22]. Individual legal analysis is required before benchmarking or joint buying.

Price and compare-at writes require truthful representation and contextual history. EU price-reduction guidance and U.S. FTC pricing guidance do not permit fabricated savings [R17/R18]. Record the applicable reference basis; do not confuse MSRP, historical offer price and actual selling price. Rules can vary for goods, channels and promotions; do not implement a universal “compare-at = price plus 20%” rule.

Avoid exclusivity, resale-price restraints, deceptive claims, forced lock-in or preventable data-export barriers without legal review. Calling a feature “AI” does not immunize its conduct. Do not promise optimization guarantees or imply endorsement by Shopify or Apple.

## 7. AI and accessibility

Perform an intended-purpose assessment under current applicable AI rules before launch or material use change [R23]. Ordinary inventory support is not automatically equivalent to employment or credit scoring; do not expand into staff scoring, customer eligibility or other sensitive decisions by accident. Document limitations, human action control, evaluation, monitoring and provider contracts. Keep algorithms deterministic where arithmetic suffices.

Target WCAG 2.2 AA and evaluate relevant accessibility laws per market and service [R10]. A technical accessibility target does not by itself settle European Accessibility Act or local B2B/consumer applicability. Security and ease of use are complementary: permission denial, errors, confirmation and recovery must be understandable without inaccessible gestures.

## 8. Concrete prelaunch gates

No public global launch until the product has: an actual data/transfer map; appropriate signed vendor/merchant terms; counsel-reviewed territory and retention decisions; tested privacy processors and restore policy; least-privilege credentials and staff access; a reviewed incident program; accurate billing/price disclosures; tested exports and termination; evidence-backed security/accessibility claims; and a verified supported-market list.

Outstanding owner/counsel inputs include company verification; legal contact and approved public address; launch territories; provider/hosting contracts; Q-008; tax/insurance advice; domain/trademark clearance; acceptable financial limits and final commercial terms. No secrets should be pasted into agent instructions. These are finite decision gates, not reasons to stop unrelated authorized implementation.
