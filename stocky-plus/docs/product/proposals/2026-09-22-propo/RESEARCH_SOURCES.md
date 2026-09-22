# ProPo research source register

Research date: **2026-09-22**. This is a desk review, not user interviews, live merchant testing, professional legal advice or a competitor benchmark. Primary official technical/regulatory sources are used for factual constraints; vendor sources establish only what those vendors publish. Links may change; reverify implementation and legal requirements at the exact release version/date.

## Repository authority inspected

Repository `Vedang1998/Stocky`, main X `f057d98c8a321b3e06875a6e9a83b787bcbc101f`:
AGENTS.md; CLAUDE.md; relevant `.cursor/rules`; documentation map/status; product/00; product/01,02,03,04,05,06,09,10,11; phases/README and Phase 1 brief. Product/05 and the status column in product/09 are historical audits, not a refreshed implementation score.

Source roots:
- https://github.com/Vedang1998/Stocky/tree/f057d98c8a321b3e06875a6e9a83b787bcbc101f/stocky-plus/docs/product
- Frozen PR45 H: https://github.com/Vedang1998/Stocky/pull/45 ; exact head `3cc2045107b54601c6b0e43c8690b7d090074b80`
- Autonomous first-cycle evidence: https://github.com/Vedang1998/Stocky/issues/52#issuecomment-5777682945

No application/database tests or current feature-completion counts were executed by ChatGPT in this research.

## External primary sources and supported use

| ID | Source and URL | What it supports / limit |
|---|---|---|
| R01 | SAP IBP ABC/XYZ: https://help.sap.com/docs/SAP_INTEGRATED_BUSINESS_PLANNING/feae3cea3cc549aaa9d9de7d363a83e6/33e40058547f8073e10000000a441470.html | Published segmentation concepts; dynamically rendered page/search-index evidence, not ProPo defaults or validated benefit |
| R02 | Hyndman/Athanasopoulos, Forecasting: Principles and Practice 3: https://otexts.com/fpp3/tscv.html | Rolling-origin chronological evaluation; not proof of a chosen SKU model |
| R03 | Teunter, Syntetos, Babai (2011), Intermittent demand: Linking forecasting to inventory obsolescence, DOI 10.1016/j.ejor.2011.05.018, https://www.sciencedirect.com/science/article/pii/S0377221711004437 | TSB research basis; indexed abstract consulted, full publisher page returned 403 on follow-up; no full-paper experimental replication claimed |
| R04 | SAS Forecast Value Added: https://www.sas.com/no_no/software/collaborative-planning-workbench/features-list.html ; https://www.sas.com/en_us/insights/articles/analytics/practical-advice-for-better-business-forecasting.html | Forecast/process-stage baseline comparisons; vendor method description, no independently proven merchant ROI |
| R05 | Shopify inventoryItemUpdate: https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventoryItemUpdate | Cost update fields and inventory-write authorization; revalidate exact pinned schema and grants |
| R06 | Shopify productVariantsBulkUpdate: https://shopify.dev/docs/api/admin-graphql/latest/mutations/productVariantsBulkUpdate and input https://shopify.dev/docs/api/admin-graphql/latest/input-objects/ProductVariantsBulkInput | Base price/compare-at inputs and partial-update behavior; requested 2026-07 route redirected to current docs; not a live mutation |
| R07 | Shopify access scopes: https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes | Required/optional scope management; no actual app-scope grant examined or changed |
| R08 | Shopify App Design Guidelines: https://shopify.dev/docs/apps/design ; components https://shopify.dev/docs/api/app-home/latest/web-components | Shopify-native design and supported surfaces; not evidence of ProPo UI quality |
| R09 | Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/ | Public hierarchy, clarity, consistency and accessibility guidance; no private Apple process or endorsement |
| R10 | W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/ | Technical accessibility target; not a universal legal safe harbor |
| R11 | Prediko help/integrations: https://help.prediko.io/en/collections/3615809-integrations | Published WMS/ShipHero/bundle/accounting topics; not tested connector capability or coverage |
| R12 | Inventory Planner: https://www.inventory-planner.com/ | Published planning/analytics and integration categories; vendor claims only, no ROI/market-share verification |
| R13 | EDPB controller/processor: https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en | Activity-based roles and contract/subprocessor duties |
| R14 | EDPB international transfers: https://www.edpb.europa.eu/sme-data-protection-guide/international-data-transfers_en | Transfer mechanisms and safeguards; actual flows/recipient terms require assessment |
| R15 | CPPA FAQ: https://cppa.ca.gov/faq | Applicability, rights and separate service-provider/contractor obligations; facts still require counsel analysis |
| R16 | NY AG SHIELD Act: https://ag.ny.gov/resources/organizations/data-breach-reporting/shield-act | Reasonable safeguards and breach duties; no certification of this company's compliance |
| R17 | European Commission Price Indication Directive: https://commission.europa.eu/law/law-topic/consumer-protection-law/unfair-commercial-practices-and-price-indication/price-indication-directive_en ; sweeps https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/enforcement-consumer-protection/sweeps_en | Prior-price transparency and thirty-day reference principle; goods/exceptions/local rules need review; direct EUR-Lex follow-up required JS, no PDF analysis claimed |
| R18 | FTC Advertising FAQ: https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business | Truthfulness of price comparisons and sale claims; no comprehensive state-law analysis |
| R19 | ICO UK transfer clauses: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/ | UK IDTA/Addendum and assessment; not a signed transfer instrument |
| R20 | USPTO trademark process: https://www.uspto.gov/trademarks/basics/trademark-process | Trademark versus business/domain identity; no ProPo clearance search conducted |
| R21 | Shopify privacy compliance: https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance | Required privacy topics, authentication and processing obligations; current application implementation not certified |
| R22 | DOJ, September 4, 2026 proposed Pinnacle consent decree: https://www.justice.gov/opa/pr/justice-department-reaches-proposed-consent-decree-pinnacle-one-americas-largest-landlords | Recent algorithmic-coordination risk example; proposed decree, housing-specific facts, not a ruling on ProPo |
| R23 | European Commission AI Act: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai | Risk/intended-purpose framework; evolving transition rules must be checked at launch, no legal classification certified |
| R24 | Cursor rules https://cursor.com/docs/rules ; Claude memory https://code.claude.com/docs/en/memory | Repository instruction loading versus technical enforcement; actual session/account settings require verification |

## Evidence boundaries

Research does not verify business registration, trademark availability, provider security certification, trademark/license rights to visual assets, particular API access granted to IVYY LLC, actual integration reliability, account billing limits or global tax/sanctions law. Proposed architecture, formulas and sequencing are identified as product-owner recommendations, not claims that a cited source mandates ProPo's choices.

No source's marketing outcomes were used as a product forecast. No protected customer data was submitted to external research tools. All proposed executable tests remain unexecuted until a scoped implementation/review task records actual evidence.
