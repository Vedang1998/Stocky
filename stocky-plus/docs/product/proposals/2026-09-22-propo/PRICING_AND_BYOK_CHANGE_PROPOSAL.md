# ProPo pricing, seats and BYOK — proposed changes to product/11

**Revision 2 / OWNER DIRECTION RECORDED; NOT YET AN APPROVED PRICING MIGRATION.** Product/11_PRICING_AND_PACKAGING_STRATEGY.md remains the current approved architecture until the reviewed final change is approved. Do not silently edit the old prices, tiers, entitlements or AI-credit statements. Final public dollar prices still need a cost model and pilot evidence.

## 1. Preserve complete core workflows

Every paid plan must offer a functional complete Stocky-replacement loop, including core reports/settings/export and the approved receiving/count/POS workflows. Upsell by scale, sophisticated analytics, operational automation, integration/service complexity and real support value, not by withholding the safe action needed to finish a normal PO. No lower tier loses privacy, basic data export, tenant safety or reconciliation.

## 2. Seat request versus Shopify reality

As checked 2026-09-22, Shopify Admin staff limits are Starter/Basic 0, Grow 5, Advanced 15 and Plus unlimited; owner, collaborators and POS-only staff are excluded from that staff count [V01]. Therefore “exactly match Shopify users” does not mean one universal total count, and full shop-staff inventory cannot be assumed available to a public app.

Proposed commercial pattern for evaluation: versioned comparable admin-seat options such as owner-only, owner plus five, owner plus fifteen, and an individually costed enterprise allowance. These are hypotheses, not final limits. Any eligible Shopify shop may buy a higher ProPo tier; its Shopify plan is not automatic billing authority. Count explicitly assigned active ProPo users, not every person in Shopify. Owner inclusion/exclusion, collaborators, support personnel, devices and POS-only staff must be stated on the pricing page and measured server-side. POS-only operators need a separately clear scale/seat rule; do not accidentally treat “unlimited POS staff” as unlimited ProPo support/cost.

Recommendation: prioritize location/variant/operational scale over seats as the primary price driver, using generous clear staff allowances. Artificial seat friction can encourage shared PINs/logins and undermine accurate audit trails. Do not force an upgrade from an unverified total directory count.

Downgrade: preview over-limit assignments and affected features; let the owner choose which ProPo staff remain active before the next effective tier. No forced ongoing high subscription merely because ten Shopify users exist. Do not delete operational history, block cancellation, require deleting Shopify users or silently grant all staff a lower-tier seat. Reconciliation and required privacy/exports survive billing transition under a reviewed grace/read-only policy.

## 3. AI commercial change

Owner rejects included ProPo AI credits/usage and wants generative AI only after initial launch/testing, with the merchant connecting its own supported provider key/account. This conflicts with product/11's bundled credits, action weights and internal included-model allowances; mark those as proposed superseded requirements in the final decision crosswalk, not silently removed from approved records.

Future BYOK entitlement may control access to the optional interface, but provider consumption is paid by the merchant to that provider. Do not imply an ordinary ChatGPT/Claude subscription is an API key/credit balance. No ProPo-funded backup model when a key is missing, expired, revoked or out of quota. Such failure must not block parity forecasting, PO creation, receiving or existing reports.

BYOK still requires: supported-provider onboarding; consent/data scope; encrypted tenant-bound secret reference; no key in browser/log/ticket; rotation/deletion/uninstall handling; SSRF/egress restrictions; provider/key isolation; concurrency and per-action caps; preflight budget estimate where available; token/cost telemetry with uncertainty; idempotent action commands; human approval for writes; malicious-output containment; no cross-merchant training/use by default. Unknown provider cost is labeled unknown, not $0.

Statistical forecasting/backtesting and deterministic recommendations are ProPo computations, not generative-AI credit usage. They still have infrastructure cost and need normal quotas/performance engineering. Merchant BYOK does not outsource the app's numerical correctness or privacy obligations.

## 4. Review/approval crosswalk

Before public pricing approval, reconcile /11 core/POS distinctions, existing 3/10/unlimited seat assumptions, four-tier labels, history allowances, AI credits, internal AI budgets, trial/downgrade/cancellation and enterprise API commitments. Retain no-revenue-primary-pricing, complete core, transparent limits and no-surprise billing principles. Do not advertise unlimited API/storage/support/AI merely because a Shopify tier says unlimited staff.

Required evidence: simulated billing lifecycle and entitlement downgrade; mixed merchant usage/cost sheet; Shopify seat/directory capability matrix; API/BYOK threat model; customer-facing plain-language limits and consent; exact Partner billing integration. No money, provider account, subscription or entitlement was changed in this proposal.
