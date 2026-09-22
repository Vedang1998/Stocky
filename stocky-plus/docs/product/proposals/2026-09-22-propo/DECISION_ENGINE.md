# ProPo Decision Engine — proposed strategy contracts

**PROPOSED / NOT RUNTIME AUTHORITY.** Read README.md for scope and RESEARCH_SOURCES.md for source IDs. These contracts refine a future Smart decision layer; they do not modify Stocky-parity formulas or the frozen privacy work.

## 1. Correct the architecture before adding modules

Use one versioned fact snapshot and one final quantity resolver. Modules produce forecasts, constraints, scores or economic options; they do not independently mutate the PO or successively add arbitrary safety quantities.

```text
Shopify-authoritative facts + app-owned operational ledgers
  -> validated variant/location/supplier/unit/currency snapshot
  -> unmodified Stocky-parity baseline
  -> optional Smart demand/lead-time distributions and policy inputs
  -> joint replenishment, supplier-pack and budget decision
  -> provenance + rationale + risk/exception classification
  -> merchant's reviewed draft and explicit approval
  -> separate authorized PO/inventory/cost/price action services
  -> reconciliation and plan-versus-actual evaluation
```

This is a logical flow, not a requirement for microservices. Retain the approved modular monolith. Constraints interact: quantity-break choices and case rounding must be solved within the budget, not applied afterward in a way that overspends. Forecast uncertainty and lead-time uncertainty must feed one protection calculation, not multiple hidden buffers.

Always-on: tenant/variant identity; units/conversion validation; currency/decimal safety; data freshness and completeness; source-owned inventory position; no duplicate incoming; authorization; explanations; recommendation/action audit; reconciliation. Pack/MOQ enforcement is always evaluated **when the applicable supplier policy is enabled**, not globally imposed. Individually orderable units must remain supported.

Available inventory may already exclude committed units; do not subtract the same reservation again. Inbound supply needs source IDs, destination, due horizon, remaining quantity, cancellations and partial-receipt status. Mirror versus original PO/transfer records must deduplicate. A source that cannot expose native incoming cannot silently be treated as complete. Missing data prevents a definitive quantity, not a report of zero need.

## 2. Configuration and policy semantics

Proposed modes for a strategy: **Off**, **Monitor** (shadow recommendation), **Apply to draft**. “Active” must say what it changes. None of these modes sends a PO, changes Shopify inventory or alters retail prices without the separate permitted workflow. Exception handling is not autonomous purchase execution.

Policies have tenant, location, supplier, category/variant applicability, precedence, effective date, version, owner and change audit. Use explicit inheritance and show the resolved policy on each row. A deliberate variant override may override a category policy only where allowed. Hard data/permission/identity guards are never overridable.

Start with tested presets such as Parity only, Availability-focused Smart, Cash-constrained Smart and Seasonal exit planning. Do not allow arbitrary combinations merely because fifteen toggles fit on a screen. Validate the dependency graph, reject contradictions and show what becomes unavailable on entitlement downgrade. Monitor mode stores separate results without altering the approved draft.

FVA measurement and outcome capture are safeguards of an applied Smart policy: merchants may hide their dashboards or disable extra candidate models, but may not disable the minimum evaluation/audit needed to justify applied recommendations. Switching a module off affects future runs only; it does not rewrite historical recommendations or completed POs.

## 3. Fifteen modules

| # / module | Inputs and purpose | Proposed treatment / configuration | Principal failure to test |
|---|---|---|---|
| 1 ABC–XYZ | Value contribution and demand variability/forecastability at a declared aggregation level | Enhanced labels distinct from eight-week Stocky ABC/U; configurable value basis/window; Monitor first | Revenue importance confused with margin or demand predictability; unstable class churn; new items misclassified |
| 2 Intelligent forecasting | Demand time series, cadence, history sufficiency, horizon and eligible patterns | Candidate set can include parity baseline, seasonal naive, ETS and intermittent methods; ADI/CV² screens, not automatic winner selection | One rule chosen for every SKU; future leakage; overfitting; insufficient seasonal history |
| 3 FVA | Immutable naive, statistical and human-override forecasts against later observations | Baseline comparisons and bias checks required for applied Smart; dashboard optional | Training fit advertised as improvement; only winners reported; cost or service deterioration hidden by average error |
| 4 Stockout-censored demand | Credible availability intervals and observed sales; possible unobserved demand | Preserve raw sales; maintain separate estimated demand and uncertainty; configurable treatment with data-health gate | Every zero assumed stockout; unavailable periods treated as zero demand; lost sales presented as observed fact |
| 5 Safety/service level | Demand-over-lead-time distribution, review interval, supplier uncertainty and service target | One protection policy per resolved row; distinguish fill rate from cycle service level | Adding multiple safety buffers; applying normal/iid formula without checking assumptions |
| 6 Supplier lead time | PO ordered/sent/confirmed/first-receipt/final-receipt events and shortages | Define which clock answers reorder timing; segment by supplier/location; sparse-data fallback | Excluding still-open late POs biases reliability; partial/late/final receipt times conflated |
| 7 Aging/SLOB | Age/receipt layers where available, sell-through, stock cover and demand history | Diagnostic-first; optional caps or exclusion policies; evidence-qualified age | Treating seasonality or sparse demand as obsolete; pretending current quantity reveals exact lot age |
| 8 Lifecycle | Merchant-approved status and optional dates | Active / Watch / Phase-out / Discontinued; explicit overrides; don't alter Shopify listing status automatically | Forward-buy or min-stock policy silently resurrects a discontinued purchase |
| 9 GMROI/capital | Gross margin, COGS completeness, time-weighted inventory at cost and cash exposure | Report first; add as decision objective only with reliable costs and horizon | Ranking by margin percent alone; current retail value denominator; missing costs treated as zero |
| 10 Quantity breaks | Supplier offer type, cost tiers, eligibility, packs, holding and sell-through | Evaluate feasible tiers marginally, including all-unit versus incremental breaks; Monitor first | Lowest unit cost chosen despite larger total loss/cash use; nonqualifying items counted toward break |
| 11 Forward/investment buy | Verified temporary offer or price increase, dates, demand, capital and expiry/storage constraints | Separate speculative excess from required coverage; capped scenarios; no automatic supplier commitment | An unverified future price treated as certain; duplicate saving counted again by price-break module |
| 12 Budget constraint | Budget basis/currency/period, existing commitments, minimum service choices | Global feasible allocation, reserves for mandatory needs, optional discretionary rank | “Protect all essentials” promised when budget cannot buy them; rounding after budget allocation |
| 13 OTB | Sales/COGS plan, inventory target, opening position, receipts/commitments and valuation basis | Category/location-period planning envelope; not synonymous with bank cash | Retail and cost basis mixed; PO commitment deducted twice; payment timing ignored |
| 14 Exception-based planning | Data/risk/confidence thresholds, policy conflicts and approval roles | Route and prioritize routine recommendations; explicit human approval remains before committed action | Quietly auto-sending orders; missing evidence hidden because its numeric threshold is zero |
| 15 Closed-loop planning | Versioned baseline, recommendation, override, approved order, receipts, costs and subsequent outcomes | Capture minimum events in owning modules; evaluate once sufficient history exists | Overwritten recommendations; improvements attributed causally without a suitable comparison |

Research anchors: SAP's ABC/XYZ material [R01]; chronological validation in FPP [R02]; intermittent/obsolescence work [R03]; FVA process comparisons [R04]. These sources support the methods' existence, not universal superiority or specific default cutoffs for ProPo.

## 4. Demand modeling and evaluation detail

Choose the forecast target before the algorithm: units per current variant/location/cadence; horizon tied to purchasing use; hierarchy and return treatment explicitly defined. Returns may make a net-sales fact negative; do not feed an incompatible nonnegative demand estimator by silently clipping it. Document the transformation and preserve observed facts.

ADI and CV² depend on aggregation interval, zeros and history length. Treat published thresholds as research candidates and validate against merchant data rather than universal classifications. Compare intermittent models (including TSB where useful), seasonal naive and simple averages on rolling-origin holdouts at the operational horizon. TSB estimates occurrence probability and nonzero size separately; its usefulness for declining/obsolete demand does not imply it should replace every baseline [R03].

Track scale-appropriate forecast error, bias, service outcomes and computation cost. MAPE has problems around zero demand; select metrics deliberately and disclose their denominators. Do not select a model on the same test periods used to report its improvement. A model must survive multiple cutoffs and sparse/new/seasonal cases, with a reproducible simple fallback. FVA also evaluates human overrides and process steps, not just algorithm complexity [R02/R04].

The app must never erase raw Stocky-parity output when Smart performs better. Store both and the reason for the applied decision. Stockout adjustment changes an estimate of latent demand, not the historical sales ledger. The counterfactual lost demand remains uncertain.

## 5. Capital planning and coupled constraints

GMROI proposal: period gross-margin dollars divided by average inventory investment measured at cost over the same period. Show cost completeness, returns/discount treatment and averaging method. A single closing snapshot is not a time-weighted average. An exceptional historical ratio is evidence to consider, not a guarantee on the next purchase.

Budget and OTB have separate meanings. A cash budget constrains payments within a dated horizon; a PO budget may constrain committed purchase value; OTB constrains planned inventory receipts under a cost or retail valuation basis. Record which basis is used and reconcile currency, taxes, freight, deposits, outstanding commitments and transfers. Do not subtract the same open PO in both “available budget” and the allocation solver.

If required replenishment exceeds the budget, show the infeasible amount, affected items and service trade-offs. Do not silently prorate every SKU or claim service targets were protected. Use a declared objective, deterministic tie-breaking and explainable alternatives. Minimum-order value, tier costs, packs, expiry and shelf capacity can make an integer allocation necessary. Solver time limits must return a labeled feasible result or no solution, never an “optimal” claim without evidence.

For price breaks and forward buy, evaluate incremental benefit relative to the baseline purchase: applicable avoided cost and additional expected contribution minus incremental financing/holding, storage, spoilage, markdown, handling and uncertainty penalties. Distinguish all-unit from incremental tiering and conditional rebates. The same discount cannot be credited twice by two modules. Offers are effective-dated evidence, not invented future prices.

## 6. Snapshot, explanation, report and audit contract

A recommendation run identifies tenant; current variant GID; location; supplier offer/UOM; data-as-of; source watermark; API/fact schema; currency; forecast/model policy; module modes; dependency versions and exception rules. All derived evidence is traceable to that run. Preserve privacy-appropriate actor/approval evidence without retaining raw customer PII for model convenience.

One row displays: parity baseline; observed available/eligible inbound; Smart estimate and uncertainty; safety contribution; lifecycle/SLOB constraint; economic option; budget/pack adjustment; final suggested units and cases; merchant override; unresolved warnings. Some contributions are joint optimizer choices, not additively independent numbers—say so rather than forcing a false arithmetic waterfall.

Reports: segmentation matrix; forecast comparison/FVA/bias; stockout evidence; supplier on-time/partial/lead-time distributions; age/cover; lifecycle exceptions; GMROI/cost coverage; offer scenarios; budget use/shortfall; OTB vs receipts; exception queue; recommendation-to-order-to-receipt outcome trace. Each shares the same metric definitions and supports filters, saved views, drilldown, freshness and export. Policy configuration lives in Settings with contextual shortcuts, not fifteen disconnected top-level menu items.

## 7. Acceptance matrix — design requirements, NOT EXECUTED

| Group | Minimum adversarial and useful-positive cases |
|---|---|
| Parity separation | Every module mode leaves stored parity calculation unchanged; no global safety/stockout/case rule introduced |
| Supply position | App/native mirror duplicates; transfers; partial/cancelled/late POs; reservations already netted; different time horizons |
| Units/money | Individual unit, four-pack, six retail packs per supplier case; decimal money, FX basis, null vs zero, rounding residuals |
| Policy | Contradictory lifecycle/minimum/forward buy; missing prerequisite; override inheritance; mode switch and downgrade |
| Forecast | Intermittent/new/seasonal/negative-net-return periods; all-zero baseline; rolling holdouts and no leakage |
| Optimization | Insufficient budget; nonlinear tiers; infeasible pack/MOV; same saving twice; timeout; stable ties |
| Economics | Unknown costs; missing price-increase evidence; sparse open late POs; long-held goods and limited storage |
| Outcomes | Reconstruct an old recommendation after policy changes; distinguish suggested, ordered, received and sold |
| UX/access | Same financial fields and actions authorized across UI/API/export/worker; keyboard/mobile/recovery flows |
| Safety | Duplicate approvals, stale snapshots before action, partial API writes, uncertain outcomes, disabled kill switch |

These cases are a proposed starting matrix. A formal phase brief must define the executable oracle, exact inputs, allowed modes, performance envelope and owner-visible acceptance. No implementation or runtime tests were executed by this research.
