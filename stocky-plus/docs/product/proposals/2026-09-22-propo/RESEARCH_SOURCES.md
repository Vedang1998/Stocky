# ProPo revision-2 research register

Checked **2026-09-22**, including the PR54 successor re-fetch. Separate owner statements, external primary-source facts, historical repository evidence and product-owner proposals. This is desk R&D, not merchant interviews, a live-store integration test, a professional legal opinion or current app completion audit. Peer-review 18/18 synthetics are **not** inherited as this writer’s execution.

## Repository and owner basis

Main X `f057d98c8a321b3e06875a6e9a83b787bcbc101f`, frozen PR45 H `3cc2045107b54601c6b0e43c8690b7d090074b80`, PR53 starting `057bcf6205abb6b93f08e12c0d7f891cb112926e`, PR54 P1 `fb6ca876f6a6612692e7d9187dc3c815eae156ad`. Peer review remains on `review/pr54-r2-cursor-20260922-51ac` commit `4cde7146d8eaf52728394491f04450cc83130777` blob `1aba6763f73d2a0a58470300aa40a2e8e42ae56b` and is **not** integrated. Prior full product sequence at unchanged X remains the authority baseline.

The user's detailed answers are captured in README O2-01…16. They change the requested design direction, not the formal approval state of product/11, PR45 or this proposal.

## Primary sources

| ID | Source | Verified use / limitation |
|---|---|---|
| V01 | https://help.shopify.com/en/manual/your-account/users/users-plan-requirements ; https://shopify.dev/docs/api/usage/access-scopes ; https://shopify.dev/docs/api/admin-graphql/2026-07/objects/StaffMember ; https://community.shopify.dev/t/why-isnt-the-read-users-access-scope-documented-as-custom-app-only/26606/2 | **Re-fetched 2026-09-22.** Staff limits: Pause and Build **1**, Starter/Basic **0**, Grow **5**, Advanced **15**, Plus unlimited. Exempt: store owner, organization owner, collaborators, POS-only (POS Pro location required). Downgrade suspends pending then least-recently-active Shopify staff — not ProPo billing. `read_users` still `shopify plus` / finance embedded or Plus/Advanced + Support. StaffMember 2026-07 same restriction. Community staff post not re-fetched this successor; P1 conflict stands. No granted scope tested |
| V02 | https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens ; https://help.shopify.com/en/manual/your-account/users/roles/permissions/store-permissions | Identity versus access permission. Store-permissions **re-fetched 2026-09-22** (peer review had HTTP 403): Admin inventory/app/POS permissions are distinct; “App permissions in the Shopify admin don't change or impact any permissions set up through apps”; POS permissions via organization/POS roles. No live login. Do not enable online tokens |
| V03 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/reporting/average-unit-cost ; https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/faq | **Re-fetched 2026-09-22.** Internal average; formula and $9.33 example; two negative-stock exceptions at **PO create** wording; optional sync overwrites Shopify cost irreversibly; historical backdate approximate. Sunset note is not ProPo completion. Not an implemented ProPo ledger |
| V04 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/inventory-management/stocktakes | Stocktake behavior and unfulfilled-order/history limitations; Stocky treats inventory as available and ignores unfulfilled orders. Not proof Shopify movement data is universally complete |
| V05 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/inventory-management/low-stock | Low-stock vendor/variant priorities and open-order coverage inform Home hypothesis; exact historic home layout not reconstructed |
| V06 | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky/reporting/report-types | Report catalog, filters/columns and stock snapshot semantics; original product reference, not ProPo completion evidence |
| V07 | https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis/platform-apis/scanner-api ; https://shopify.dev/docs/api/pos-ui-extensions/2026-01 | Barcode/camera surfaces and documented offline options. Actual device, API version and permissions must be tested |
| V08 | https://shopify.dev/docs/api/pos-ui-extensions/latest/target-apis/standard-apis/session-api | Token authenticated user differs from pinned POS staff; local ID is not sufficient server authorization |
| V09 | https://shopify.dev/changelog/finalizing-compare-and-swap-redesign-for-inventory-set-quantities ; https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/InventoryQuantityInput ; https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/inventorySetQuantities ; https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventorySetQuantities | **Re-fetched 2026-09-22.** Changelog 2026-04: `changeFromQuantity` replaces `compareQuantity`/`ignoreCompareQuantity`; `null` opts out; runtime-mandatory. 2026-07 and latest **input objects** document `changeFromQuantity` only. 2026-07 and latest **mutation pages** still describe `compareQuantity`/`ignoreCompareQuantity` and first examples still use `name: "available"`. Repo pin is 2026-07. Local schema artifact absent. Public docs ≠ store execution |
| V10 | https://shopify.dev/changelog/making-idempotency-mandatory-for-inventory-adjustments-and-refund-mutations ; https://shopify.dev/changelog/concurrency-protection-features ; https://shopify.dev/docs/api/usage/idempotent-requests | **Re-fetched 2026-09-22.** `@idempotent` required at runtime for listed inventory/refund mutations in 2026-04 even if not schema-mandatory. Errors: `IDEMPOTENCY_CONCURRENT_REQUEST`, `IDEMPOTENCY_KEY_PARAMETER_MISMATCH`. Not every mutation has identical guarantees |
| V11 | https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing ; https://shopify.dev/docs/apps/launch/billing | Current default App Pricing, hosted plan selection and activeSubscription/history. After-April-2026 current path differs from legacy billing webhooks; actual enrollment not inspected |
| V12 | https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing/migrating-to-shopify-app-pricing ; https://shopify.dev/docs/api/partner/unstable | Partner API versus App Events credentials and integration roles. Use supported version at implementation; unstable reference is not permission to ship unstable production dependence |
| V13 | https://www.inventory-planner.com/ | Advertised advanced Open-to-Buy; establishes feature exists, not prevalence, necessity, efficacy or measured ROI |
| V14 | https://help.prediko.io/en/articles/9031704-what-columns-can-you-add-to-the-buy-table | Published customizable buying/report columns; vendor claims and inconsistent 80+/100 wording not a benchmark |
| V15 | https://crtc.gc.ca/eng/com500/faq500.htm | **BLOCKED 2026-09-22** Cloudflare interstitial (Ray `a3f48b14fdcc18b8`); alternate `https://crtc.gc.ca/eng/internet/incr.htm` also blocked (Ray `a3f48d480fbb37c5`). P1 CASL caution **not independently re-verified**. No legal determination |
| V16 | https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business | Commercial/B2B versus transactional email and opt-out requirements; not a full state-law survey. Not re-fetched this successor |
| V17 | https://www.zoho.com/desk/pricing.html | Free edition three support users and managed ticketing. Paid pricing localized to INR in returned page; no USD paid price inferred; edition/API entitlements need verification |
| V18 | https://sentry.io/pricing/ | Free Developer one-user tier; paid/team/usage limits. Peer review noted Team advertised $26/mo annual — vendor marketing, not an IVYY quote. No provider account configured |
| V19 | https://resend.com/pricing ; https://resend.com/products/transactional-emails | Published free/pro transactional allowances and paid overage terms; optional automatic overage not enabled |
| V20 | https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan ; https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans ; https://www.brevo.com/pricing/ | Help articles **BLOCKED 2026-09-22** (Cloudflare Ray `a3f48b29e8ded650`, `a3f48b981aa7e605`). Marketing FAQ extracted: Free plan up to **300 emails/day** after sending approval. Dollar prices did not extract. Not production-complete; not deliverability proof |
| V21 | https://shopify.dev/docs/apps/launch/distribution/support-your-customers | Public app support channel and valid support email requirement; no mailbox created |
| V22 | https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda-compliance-help/guide_org/ ; https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/ | PIPEDA responsibilities and meaningful consent; HTML summaries used, linked PDF not analyzed; provincial applicability unresolved |
| V23 | https://www.oqlf.gouv.qc.ca/francisation/entreprises/contrats-adhesion.html | **Re-fetched 2026-09-22** (peer review had timed out). French-first adhesion contracts since 2023-06-01; exceptions include counterparties outside Quebec; page updated 2026-05-20. Not a territorial clearance |
| V24 | https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps/manage-quantities-states ; https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/InventorySetQuantitiesInput | **Fetched 2026-09-22.** Eight names: incoming, on_hand, available, committed, reserved, damaged, safety_stock, quality_control. `on_hand` = available+committed+reserved+damaged+safety_stock+quality_control. `incoming` excluded. SetQuantities `name` accepts only `available` or `on_hand`. Cannot adjust `committed` via Admin GraphQL |

## Successor source-conflict log (keep visible)

1. Changelog 2026-04 vs mutation-page examples: `changeFromQuantity` vs still-published `compareQuantity`/`ignoreCompareQuantity`; examples still set `available`.
2. Changelog says CAS/idempotency are runtime-mandatory even when schema does not mark them required.
3. GraphQL StaffMember/`read_users` Plus/Advanced/finance-embedded + Support vs community staff “public apps even Plus-only lack that trust model.”
4. Stocky average-cost exceptions worded at **PO create**; ordinary formula illustrated on receive.
5. CASL and Brevo help remain inaccessible this run; OQLF and store-permissions succeeded.

Repo pin remains Admin API **2026-07**. Do not promote a future release or a stale example as the runtime contract. Public schema pages are not controlled-store execution.

## Preserved research references for later scopes

Earlier draft references retain their original provenance at parent c379bc0d: Apple public HIG; Shopify App Design Guidelines; WCAG2.2; FPP rolling-origin validation; SAP ABC/XYZ; TSB research; SAS FVA; Shopify cost/variant write APIs; EDPB/ICO transfer roles; USPTO; FTC/European pricing guidance. These were not all re-executed in this revision and do not establish app behavior. New research avoids claims about Odoo's exact current BYOK product merely from the user's analogy.

## Not verified or executed

No corporate/trademark/domain registration, pricing-page conversion experiment, pilot recruitment, legal skill certification, actual Shopify scopes/roles granted to this app, library upgrade, production event stream, camera hardware, inventory mutation, provider subscription, billing enrollment or automatic merge control was tested. Local `admin-2026-07.schema.json` was absent. Source conflicts are visible and require implementation-time resolution; they are not settled by selecting the most convenient example.

## Planning-model fixtures (not Shopify, not permission enforcement)

Complete compact fixtures and expected outcomes for the changed stocktake, cost, seat and downgrade rules. Expected results are published with the inputs. Re-run from a clean export of this file using the checker below. Peer 18/18 is not this execution.

Rerun after extracting this file from the candidate commit. The JSON blob is the first fenced `json` block after the heading "Published fixtures" and the checker is the following fenced `python` block. Use unique sentinels `PLANNING_MODELS_JSON_BEGIN` / `PLANNING_MODELS_JSON_END` and `PLANNING_MODEL_CHECKER_BEGIN` / `PLANNING_MODEL_CHECKER_END` that appear only as HTML comments around those two blocks (not in this paragraph). Example:

```text
python3 - <<'PY'
from pathlib import Path
md = Path("stocky-plus/docs/product/proposals/2026-09-22-propo/RESEARCH_SOURCES.md").read_text()
begin = "<!-- " + "PLANNING_MODEL_CHECKER_BEGIN" + " -->"
end = "<!-- " + "PLANNING_MODEL_CHECKER_END" + " -->"
code = md.split(begin, 1)[1].split(end, 1)[0].strip()
if code.startswith("```"):
    code = code.split("\n", 1)[1]
    if "```" in code:
        code = code.rsplit("```", 1)[0]
ns = {}
exec(compile(code, "planning_model_checker.py", "exec"), ns)
raise SystemExit(ns["main"](["check", str(Path("stocky-plus/docs/product/proposals/2026-09-22-propo/RESEARCH_SOURCES.md"))]))
PY
```

Published fixtures follow.

<!-- PLANNING_MODELS_JSON_BEGIN -->
```json
{
  "label": "PR54-R2 planning models — numerical/planning only; not Shopify, not permission enforcement, not a store",
  "access_date": "2026-09-22",
  "contract_notes": [
    "Physical comparison uses Shopify on_hand at the same cutoff, never available.",
    "Verified physical movements after count_time are applied; events at or before count_time are already in the count.",
    "Reservations/committed are not physical departure. Refunds are not restock unless verified. Incoming is not counted until physically received.",
    "changeFromQuantity null, setting available from a physical total, and legacy compareQuantity/ignoreCompareQuantity are forbidden for merchant counts.",
    "Average-cost exception 1/2 follow Stocky help timing qualifications; ProPo applies them at posted receipt, not PO create."
  ],
  "stocktake": [
    {
      "id": "ST-01",
      "title": "count then verified sale then receipt",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 15,
        "available_at_cutoff": 11,
        "events": [
          {"id": "e-sale", "t": "10:05", "type": "physical_sale", "qty": -2, "verified": true},
          {"id": "e-rcp", "t": "10:10", "type": "physical_receipt", "qty": 5, "verified": true}
        ]
      },
      "expected": {"projected_physical": 15, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-02",
      "title": "sale before count must not be subtracted again",
      "kind": "projection",
      "input": {
        "count": 10,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 10,
        "available_at_cutoff": 10,
        "events": [
          {"id": "e-early", "t": "09:55", "type": "physical_sale", "qty": -2, "verified": true}
        ]
      },
      "expected": {"projected_physical": 10, "compare_name": "on_hand", "variance": 0, "status": "OK"},
      "naive_wrong": {"method": "subtract_all_sales_including_before_count", "wrong_projected": 8, "must_not_equal_expected": true}
    },
    {
      "id": "ST-03",
      "title": "refuse setting available from a physical total",
      "kind": "write_guard",
      "input": {
        "physical_count": 12,
        "on_hand": 12,
        "available": 8,
        "committed": 4,
        "write_name": "available",
        "write_quantity": 12,
        "change_from": 8
      },
      "expected": {"status": "FORBIDDEN", "reason": "physical_total_must_not_set_available"}
    },
    {
      "id": "ST-04",
      "title": "CAS against same-cutoff on_hand is the allowed comparison",
      "kind": "write_guard",
      "input": {
        "physical_count": 12,
        "on_hand": 12,
        "available": 8,
        "committed": 4,
        "write_name": "on_hand",
        "write_quantity": 12,
        "change_from": 12
      },
      "expected": {"status": "ALLOW"}
    },
    {
      "id": "ST-05",
      "title": "refund without restock is not physical inbound",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 12,
        "available_at_cutoff": 12,
        "events": [
          {"id": "e-ref", "t": "10:08", "type": "refund_no_restock", "qty": 2, "verified": true}
        ]
      },
      "expected": {"projected_physical": 12, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-06",
      "title": "verified restock adds physical",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 14,
        "available_at_cutoff": 14,
        "events": [
          {"id": "e-rst", "t": "10:08", "type": "verified_restock", "qty": 2, "verified": true}
        ]
      },
      "expected": {"projected_physical": 14, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-07",
      "title": "multi-bin movement without zone ledger is conflict",
      "kind": "projection",
      "input": {
        "count": 13,
        "count_time": "10:00",
        "cutoff": "10:20",
        "on_hand_at_cutoff": 8,
        "available_at_cutoff": 8,
        "multi_bin": true,
        "zone_ledger": false,
        "events": [
          {"id": "e-move", "t": "10:05", "type": "bin_move", "qty": 5, "verified": false, "coverage": "ambiguous"}
        ]
      },
      "expected": {"status": "CONFLICT", "reason": "multi_bin_movement_without_ledger"},
      "naive_wrong": {"method": "sum_bin_counts", "wrong_projected": 13, "must_not_equal_true_on_hand": 8}
    },
    {
      "id": "ST-08",
      "title": "stale CAS must fail",
      "kind": "write_guard",
      "input": {
        "physical_count": 12,
        "on_hand": 11,
        "available": 7,
        "committed": 4,
        "write_name": "on_hand",
        "write_quantity": 12,
        "change_from": 12
      },
      "expected": {"status": "STALE", "reason": "change_from_does_not_match_persisted_on_hand"}
    },
    {
      "id": "ST-09",
      "title": "null changeFromQuantity is forbidden for merchant counts",
      "kind": "write_guard",
      "input": {
        "physical_count": 12,
        "on_hand": 12,
        "available": 12,
        "committed": 0,
        "write_name": "on_hand",
        "write_quantity": 12,
        "change_from": null
      },
      "expected": {"status": "FORBIDDEN", "reason": "null_change_from_opts_out_of_cas"}
    },
    {
      "id": "ST-10",
      "title": "uncounted line is NULL not zero",
      "kind": "projection",
      "input": {
        "count": null,
        "count_time": null,
        "cutoff": "10:15",
        "on_hand_at_cutoff": 9,
        "available_at_cutoff": 9,
        "events": []
      },
      "expected": {"projected_physical": null, "status": "UNCOUNTED", "reason": "null_is_not_zero"}
    },
    {
      "id": "ST-11",
      "title": "duplicate client event id is applied once",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 10,
        "available_at_cutoff": 10,
        "events": [
          {"id": "e-dup", "t": "10:05", "type": "physical_sale", "qty": -2, "verified": true},
          {"id": "e-dup", "t": "10:05", "type": "physical_sale", "qty": -2, "verified": true}
        ]
      },
      "expected": {"projected_physical": 10, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-12",
      "title": "late webhook of a sale-before-count does not adjust",
      "kind": "projection",
      "input": {
        "count": 10,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 10,
        "available_at_cutoff": 10,
        "events": [
          {"id": "e-late", "t": "09:55", "type": "physical_sale", "qty": -2, "verified": true, "observed_at": "10:20"}
        ]
      },
      "expected": {"projected_physical": 10, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-13",
      "title": "idempotency key reused with different bytes is denied",
      "kind": "write_guard",
      "input": {
        "write_name": "on_hand",
        "write_quantity": 11,
        "change_from": 12,
        "on_hand": 12,
        "idempotency_key": "op-1",
        "prior_key": "op-1",
        "prior_bytes": {"write_quantity": 12}
      },
      "expected": {"status": "DENIED", "reason": "idempotency_key_parameter_mismatch"}
    },
    {
      "id": "ST-14",
      "title": "order reservation is not physical departure",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 12,
        "available_at_cutoff": 8,
        "committed_at_cutoff": 4,
        "events": [
          {"id": "e-rsv", "t": "10:06", "type": "reservation", "qty": -4, "verified": true}
        ]
      },
      "expected": {"projected_physical": 12, "compare_name": "on_hand", "variance": 0, "status": "OK"},
      "naive_wrong": {"method": "subtract_committed_from_physical", "wrong_projected": 8, "must_not_equal_expected": true}
    },
    {
      "id": "ST-15",
      "title": "incoming is not counted until physically received",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 12,
        "available_at_cutoff": 12,
        "incoming_at_cutoff": 20,
        "events": [
          {"id": "e-in", "t": "10:07", "type": "incoming_not_received", "qty": 20, "verified": true}
        ]
      },
      "expected": {"projected_physical": 12, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-16",
      "title": "damaged/QC included in on_hand must be declared or recount",
      "kind": "projection",
      "input": {
        "count": 9,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 12,
        "available_at_cutoff": 9,
        "damaged_at_cutoff": 3,
        "session_includes_damaged": false,
        "damaged_declared": false,
        "events": []
      },
      "expected": {"status": "CONFLICT", "reason": "undeclared_on_hand_components"}
    },
    {
      "id": "ST-17",
      "title": "legitimate repeated scans increment; replay does not",
      "kind": "projection",
      "input": {
        "count": 0,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 4,
        "available_at_cutoff": 4,
        "scan_ledger": [
          {"id": "scan-a", "qty": 2, "replay": false},
          {"id": "scan-b", "qty": 2, "replay": false},
          {"id": "scan-a", "qty": 2, "replay": true}
        ]
      },
      "expected": {"projected_physical": 4, "compare_name": "on_hand", "variance": 0, "status": "OK"}
    },
    {
      "id": "ST-18",
      "title": "ambiguous or missing movement coverage blocks the row",
      "kind": "projection",
      "input": {
        "count": 12,
        "count_time": "10:00",
        "cutoff": "10:15",
        "on_hand_at_cutoff": 11,
        "available_at_cutoff": 11,
        "events": [
          {"id": "e-unk", "t": "10:07", "type": "unknown_writer", "qty": -1, "verified": false, "coverage": "missing"}
        ]
      },
      "expected": {"status": "CONFLICT", "reason": "missing_or_ambiguous_movement"}
    },
    {
      "id": "ST-19",
      "title": "legacy compareQuantity payload is forbidden",
      "kind": "write_guard",
      "input": {
        "write_name": "available",
        "write_quantity": 12,
        "compare_quantity": 5,
        "ignore_compare_quantity": false,
        "on_hand": 12
      },
      "expected": {"status": "FORBIDDEN", "reason": "legacy_compare_quantity_example_is_non_authoritative"}
    }
  ],
  "cost": [
    {
      "id": "C-01",
      "title": "ordinary positive receipt uses Stocky formula",
      "input": {"current_avg": "10.00", "current_qty": 30, "landed": "8.00", "received": 15, "missing_cost": false},
      "expected": {"status": "OK", "new_avg_2dp": "9.33", "method": "formula", "numerator": "420.00", "denominator": 45}
    },
    {
      "id": "C-02",
      "title": "negative current stock then positive receipt uses landed of received",
      "input": {"current_avg": "10.00", "current_qty": -4, "landed": "8.00", "received": 10, "missing_cost": false},
      "expected": {"status": "OK", "new_avg_2dp": "8.00", "method": "exception_negative_current", "wrong_formula_2dp": "6.67"}
    },
    {
      "id": "C-03",
      "title": "negative receipt that results in negative stock leaves average unchanged",
      "input": {"current_avg": "10.00", "current_qty": 3, "landed": "8.00", "received": -5, "missing_cost": false},
      "expected": {"status": "OK", "new_avg_2dp": "10.00", "method": "exception_resulting_negative", "resulting_qty": -2}
    },
    {
      "id": "C-04",
      "title": "zero denominator is refused",
      "input": {"current_avg": "10.00", "current_qty": 0, "landed": "8.00", "received": 0, "missing_cost": false},
      "expected": {"status": "DENIED", "reason": "zero_denominator", "kept_avg_2dp": "10.00"}
    },
    {
      "id": "C-05",
      "title": "missing landed cost does not become zero",
      "input": {"current_avg": "10.00", "current_qty": 10, "landed": null, "received": 5, "missing_cost": true},
      "expected": {"status": "DENIED", "reason": "missing_cost", "kept_avg_2dp": "10.00"}
    },
    {
      "id": "C-06",
      "title": "zero on-hand then first positive receipt uses formula and equals landed",
      "input": {"current_avg": "10.00", "current_qty": 0, "landed": "7.00", "received": 5, "missing_cost": false},
      "expected": {"status": "OK", "new_avg_2dp": "7.00", "method": "formula"}
    },
    {
      "id": "C-07",
      "title": "negative receipt that stays non-negative uses formula",
      "input": {"current_avg": "10.00", "current_qty": 10, "landed": "8.00", "received": -3, "missing_cost": false},
      "expected": {"status": "OK", "new_avg_2dp": "10.86", "method": "formula", "resulting_qty": 7}
    },
    {
      "id": "C-08",
      "title": "return restock without cost basis does not invent COGS",
      "input": {"current_avg": "10.00", "current_qty": 4, "landed": null, "received": 2, "missing_cost": true, "kind": "sales_return"},
      "expected": {"status": "DENIED", "reason": "missing_cost", "kept_avg_2dp": "10.00"}
    },
    {
      "id": "C-09",
      "title": "missing current average with nonzero stock is unknown",
      "input": {"current_avg": null, "current_qty": 8, "landed": "5.00", "received": 2, "missing_cost": false},
      "expected": {"status": "DENIED", "reason": "missing_current_average", "kept_avg_2dp": null}
    },
    {
      "id": "C-10",
      "title": "later unreceive is not a guaranteed restore of intervening averages",
      "kind": "sequence",
      "input": {
        "steps": [
          {"current_avg": "10.00", "current_qty": 10, "landed": "4.00", "received": 10, "missing_cost": false},
          {"use_prior_result": true, "current_qty": 20, "landed": "4.00", "received": -10, "missing_cost": false}
        ]
      },
      "expected": {
        "status": "OK",
        "after_step_1_2dp": "7.00",
        "after_step_2_2dp": "10.00",
        "note": "this sequence happens to restore 10.00; it is not a guarantee for other intervening receipts"
      }
    }
  ],
  "seats": [
    {
      "id": "SE-01",
      "title": "owner-only Basic store, directory unavailable",
      "input": {
        "shopify_plan": "basic",
        "shopify_staff_limit": 0,
        "owner": 1,
        "admin_staff": 0,
        "pos_only": 0,
        "collaborators": 0,
        "directory_available": false,
        "assigned_propo": ["owner"]
      },
      "expected": {"billable_seats": 1, "may_use_staff_dump": false, "status": "OK"}
    },
    {
      "id": "SE-02",
      "title": "Grow staff plus POS-only staff; only assigned ProPo users count",
      "input": {
        "shopify_plan": "grow",
        "shopify_staff_limit": 5,
        "owner": 1,
        "admin_staff": 5,
        "pos_only": 12,
        "collaborators": 0,
        "directory_available": false,
        "assigned_propo": ["owner", "staff-1", "staff-2"]
      },
      "expected": {"billable_seats": 3, "may_use_staff_dump": false, "must_not_equal": 18, "status": "OK"}
    },
    {
      "id": "SE-03",
      "title": "collaborator is not an automatic ProPo seat",
      "input": {
        "shopify_plan": "grow",
        "shopify_staff_limit": 5,
        "owner": 1,
        "admin_staff": 2,
        "pos_only": 0,
        "collaborators": 1,
        "directory_available": false,
        "assigned_propo": ["owner"]
      },
      "expected": {"billable_seats": 1, "collaborator_auto_seat": false, "status": "OK"}
    },
    {
      "id": "SE-04",
      "title": "revoked access is not a billable seat",
      "input": {
        "shopify_plan": "grow",
        "shopify_staff_limit": 5,
        "owner": 1,
        "admin_staff": 2,
        "pos_only": 0,
        "collaborators": 0,
        "directory_available": false,
        "assigned_propo": ["owner", "staff-revoked"],
        "revoked": ["staff-revoked"]
      },
      "expected": {"billable_seats": 1, "status": "OK"}
    },
    {
      "id": "SE-05",
      "title": "unavailable directory cannot invent a Shopify user total",
      "input": {
        "shopify_plan": "advanced",
        "shopify_staff_limit": 15,
        "owner": 1,
        "admin_staff": null,
        "pos_only": null,
        "collaborators": null,
        "directory_available": false,
        "assigned_propo": ["owner", "buyer"]
      },
      "expected": {"billable_seats": 2, "may_use_staff_dump": false, "status": "OK"}
    },
    {
      "id": "SE-06",
      "title": "Pause and Build Shopify 1-user limit is not ProPo billing truth",
      "input": {
        "shopify_plan": "pause_and_build",
        "shopify_staff_limit": 1,
        "owner": 1,
        "admin_staff": 0,
        "pos_only": 0,
        "collaborators": 0,
        "directory_available": false,
        "assigned_propo": ["owner"]
      },
      "expected": {"billable_seats": 1, "shopify_staff_limit_is_not_propo_entitlement": true, "status": "OK"}
    },
    {
      "id": "SE-07",
      "title": "downgrade previews over-limit assignments; owner chooses remaining ProPo seats",
      "input": {
        "assigned_propo": ["owner", "a", "b", "c", "d"],
        "revoked": [],
        "new_allowance": 3,
        "owner_keeps": ["owner", "a", "b"]
      },
      "kind": "downgrade",
      "expected": {
        "preview_over_limit": 2,
        "remaining_active": 3,
        "must_not_delete_shopify_users": true,
        "must_not_delete_history": true,
        "status": "OK"
      }
    },
    {
      "id": "SE-08",
      "title": "pinned POS staff is not the authenticated user and is not an automatic seat",
      "input": {
        "authenticated_user": "pos-user-7",
        "pinned_staff": "pin-3",
        "pinned_can_mint_token": false,
        "assigned_propo": ["owner"],
        "directory_available": false
      },
      "kind": "identity",
      "expected": {"billable_seats": 1, "pinned_equals_authenticated": false, "status": "OK"}
    },
    {
      "id": "SE-09",
      "title": "numeric associated_user.id is not an alternative actor source",
      "input": {
        "actor_claim": {"kind": "associated_user_id", "value": 12345},
        "verified_string_identity": null
      },
      "kind": "identity",
      "expected": {"status": "DENIED", "reason": "unverified_numeric_actor"}
    }
  ]
}
```
<!-- PLANNING_MODELS_JSON_END -->

<!-- PLANNING_MODEL_CHECKER_BEGIN -->
```python
#!/usr/bin/env python3
"""PR54-R2 planning-model checker.

Numerical/planning only. Not Shopify, not permission enforcement, not a store.
Expected outcomes are published with the cases; this evaluator implements the
proposed contract so published inputs can be re-run from a clean export.
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_EVEN
from pathlib import Path


TWOPLACES = Decimal("0.01")
PHYSICAL_AFTER_COUNT = {
    "physical_sale",
    "physical_receipt",
    "verified_restock",
}
NON_PHYSICAL = {
    "reservation",
    "refund_no_restock",
    "incoming_not_received",
}


def d2(value: Decimal) -> str:
    return str(value.quantize(TWOPLACES, rounding=ROUND_HALF_EVEN))


def hhmm(value: str | None) -> str | None:
    return value


def project_stocktake(case: dict) -> dict:
    kind = case.get("kind", "projection")
    data = case["input"]
    if kind == "write_guard":
        if data.get("compare_quantity") is not None or data.get("ignore_compare_quantity"):
            return {
                "status": "FORBIDDEN",
                "reason": "legacy_compare_quantity_example_is_non_authoritative",
            }
        prior_key = data.get("prior_key")
        if prior_key and prior_key == data.get("idempotency_key"):
            prior_bytes = data.get("prior_bytes") or {}
            if prior_bytes.get("write_quantity") != data.get("write_quantity"):
                return {
                    "status": "DENIED",
                    "reason": "idempotency_key_parameter_mismatch",
                }
        write_name = data.get("write_name")
        change_from = data.get("change_from", "MISSING")
        on_hand = data.get("on_hand")
        if write_name == "available":
            return {
                "status": "FORBIDDEN",
                "reason": "physical_total_must_not_set_available",
            }
        if write_name != "on_hand":
            return {"status": "FORBIDDEN", "reason": "unsupported_quantity_name"}
        if change_from is None:
            return {
                "status": "FORBIDDEN",
                "reason": "null_change_from_opts_out_of_cas",
            }
        if change_from != on_hand:
            return {
                "status": "STALE",
                "reason": "change_from_does_not_match_persisted_on_hand",
            }
        return {"status": "ALLOW"}

    if data.get("count") is None:
        return {
            "projected_physical": None,
            "status": "UNCOUNTED",
            "reason": "null_is_not_zero",
        }

    if data.get("multi_bin") and not data.get("zone_ledger"):
        events = data.get("events") or []
        if any(event.get("type") == "bin_move" for event in events):
            return {
                "status": "CONFLICT",
                "reason": "multi_bin_movement_without_ledger",
            }

    if data.get("damaged_at_cutoff") and not data.get("session_includes_damaged") and not data.get("damaged_declared"):
        return {
            "status": "CONFLICT",
            "reason": "undeclared_on_hand_components",
        }

    if data.get("scan_ledger") is not None:
        seen: set[str] = set()
        total = 0
        for scan in data["scan_ledger"]:
            if scan["id"] in seen:
                continue
            seen.add(scan["id"])
            total += int(scan["qty"])
        projected = total
        variance = projected - int(data["on_hand_at_cutoff"])
        return {
            "projected_physical": projected,
            "compare_name": "on_hand",
            "variance": variance,
            "status": "OK",
        }

    count_time = hhmm(data.get("count_time"))
    seen_ids: set[str] = set()
    delta = 0
    for event in data.get("events") or []:
        event_id = event["id"]
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        coverage = event.get("coverage")
        if coverage in {"missing", "ambiguous"} or event["type"] in {"unknown_writer", "bin_move"}:
            if not event.get("verified", False):
                return {
                    "status": "CONFLICT",
                    "reason": "missing_or_ambiguous_movement",
                }
        if event["t"] <= count_time:
            continue
        if event["type"] in NON_PHYSICAL:
            continue
        if event["type"] in PHYSICAL_AFTER_COUNT:
            if not event.get("verified", False):
                return {
                    "status": "CONFLICT",
                    "reason": "missing_or_ambiguous_movement",
                }
            delta += int(event["qty"])
            continue
        return {
            "status": "CONFLICT",
            "reason": "missing_or_ambiguous_movement",
        }

    projected = int(data["count"]) + delta
    variance = projected - int(data["on_hand_at_cutoff"])
    return {
        "projected_physical": projected,
        "compare_name": "on_hand",
        "variance": variance,
        "status": "OK",
    }


def apply_average(current_avg, current_qty: int, landed, received: int, missing_cost: bool) -> dict:
    kept = None if current_avg is None else d2(Decimal(current_avg))
    if missing_cost or landed is None:
        return {"status": "DENIED", "reason": "missing_cost", "kept_avg_2dp": kept}
    if current_avg is None and current_qty != 0:
        return {
            "status": "DENIED",
            "reason": "missing_current_average",
            "kept_avg_2dp": None,
        }
    avg = Decimal("0") if current_avg is None else Decimal(current_avg)
    landed_d = Decimal(landed)
    resulting = current_qty + received
    if current_qty < 0 and received > 0:
        return {
            "status": "OK",
            "new_avg_2dp": d2(landed_d),
            "method": "exception_negative_current",
            "resulting_qty": resulting,
        }
    if received < 0 and resulting < 0:
        return {
            "status": "OK",
            "new_avg_2dp": d2(avg),
            "method": "exception_resulting_negative",
            "resulting_qty": resulting,
        }
    if resulting == 0:
        return {
            "status": "DENIED",
            "reason": "zero_denominator",
            "kept_avg_2dp": d2(avg),
        }
    numerator = avg * Decimal(current_qty) + landed_d * Decimal(received)
    new_avg = numerator / Decimal(resulting)
    return {
        "status": "OK",
        "new_avg_2dp": d2(new_avg),
        "method": "formula",
        "numerator": d2(numerator),
        "denominator": resulting,
        "resulting_qty": resulting,
    }


def eval_cost(case: dict) -> dict:
    data = case["input"]
    if case.get("kind") == "sequence":
        prior = None
        results = []
        for step in data["steps"]:
            current_avg = prior["new_avg_2dp"] if step.get("use_prior_result") else step["current_avg"]
            current_qty = step["current_qty"]
            result = apply_average(
                current_avg,
                current_qty,
                step.get("landed"),
                step["received"],
                step.get("missing_cost", False),
            )
            results.append(result)
            prior = result
        return {
            "status": results[-1]["status"],
            "after_step_1_2dp": results[0].get("new_avg_2dp"),
            "after_step_2_2dp": results[1].get("new_avg_2dp"),
            "note": case["expected"]["note"],
        }
    return apply_average(
        data.get("current_avg"),
        data["current_qty"],
        data.get("landed"),
        data["received"],
        data.get("missing_cost", False),
    )


def eval_seats(case: dict) -> dict:
    data = case["input"]
    kind = case.get("kind", "count")
    if kind == "downgrade":
        assigned = list(data["assigned_propo"])
        keep = list(data["owner_keeps"])
        over = max(0, len(assigned) - int(data["new_allowance"]))
        return {
            "preview_over_limit": over,
            "remaining_active": len(keep),
            "must_not_delete_shopify_users": True,
            "must_not_delete_history": True,
            "status": "OK",
        }
    if kind == "identity" and data.get("actor_claim"):
        if data["actor_claim"]["kind"] == "associated_user_id" and not data.get("verified_string_identity"):
            return {"status": "DENIED", "reason": "unverified_numeric_actor"}
    assigned = [name for name in data.get("assigned_propo", []) if name not in set(data.get("revoked") or [])]
    result = {
        "billable_seats": len(assigned),
        "may_use_staff_dump": bool(data.get("directory_available")),
        "status": "OK",
    }
    if "collaborators" in data:
        result["collaborator_auto_seat"] = False
    if data.get("shopify_plan") == "pause_and_build":
        result["shopify_staff_limit_is_not_propo_entitlement"] = True
    if data.get("pinned_staff"):
        result["pinned_equals_authenticated"] = data.get("authenticated_user") == data.get("pinned_staff")
    return result


def comparable(actual: dict, expected: dict) -> dict:
    return {key: actual.get(key) for key in expected}


def run(models: dict) -> int:
    failed = 0
    passed = 0

    def check(section: str, case: dict, actual: dict) -> None:
        nonlocal failed, passed
        expected = {key: value for key, value in case["expected"].items() if key not in {"must_not_equal", "wrong_formula_2dp"}}
        got = comparable(actual, expected)
        if got != expected:
            failed += 1
            print(f"FAIL {section} {case['id']}: expected {expected} got {got}")
            return
        naive = case.get("naive_wrong")
        if naive and naive.get("must_not_equal_expected"):
            if naive.get("wrong_projected") == expected.get("projected_physical"):
                failed += 1
                print(f"FAIL {section} {case['id']}: naive wrong projection collapsed into expected")
                return
        if naive and naive.get("must_not_equal_true_on_hand") is not None:
            if naive.get("wrong_projected") == naive.get("must_not_equal_true_on_hand"):
                failed += 1
                print(f"FAIL {section} {case['id']}: naive bin sum matched true on_hand")
                return
        if "wrong_formula_2dp" in case["expected"]:
            if actual.get("new_avg_2dp") == case["expected"]["wrong_formula_2dp"]:
                failed += 1
                print(f"FAIL {section} {case['id']}: exception collapsed into naive formula")
                return
        if "must_not_equal" in case["expected"]:
            if actual.get("billable_seats") == case["expected"]["must_not_equal"]:
                failed += 1
                print(f"FAIL {section} {case['id']}: billable seats used Shopify headcount")
                return
        passed += 1
        print(f"PASS {section} {case['id']} {case['title']}")

    for case in models["stocktake"]:
        check("stocktake", case, project_stocktake(case))
    for case in models["cost"]:
        check("cost", case, eval_cost(case))
    for case in models["seats"]:
        check("seats", case, eval_seats(case))

    print(f"RESULT passed={passed} failed={failed} total={passed + failed}")
    return 0 if failed == 0 else 1


def extract_json_from_markdown(text: str) -> str:
    begin = "<!-- " + "PLANNING_MODELS_JSON_BEGIN" + " -->"
    end = "<!-- " + "PLANNING_MODELS_JSON_END" + " -->"
    start = text.split(begin, 1)[1]
    raw = start.split(end, 1)[0].strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    return raw


def load_models(path: Path) -> dict:
    text = path.read_text()
    if path.suffix == ".md":
        text = extract_json_from_markdown(text)
    return json.loads(text)


def main(argv: list[str]) -> int:
    path = Path(argv[1] if len(argv) > 1 else "/tmp/pr54_planning_models.json")
    models = load_models(path)
    return run(models)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```
<!-- PLANNING_MODEL_CHECKER_END -->
