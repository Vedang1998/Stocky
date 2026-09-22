# ProPo decision engine — fewer product controls, stronger evidence

**Revision 2 / PROPOSED.** Supersedes this draft's former fifteen-switch design. No forecast/PO runtime changes are authorized. Source IDs refer to RESEARCH_SOURCES.md.

## 1. Product architecture

Default product: the approved six deterministic Stocky-parity methods, correct ABC/U, supplier/unit settings, incoming coverage, editable final quantities, clear exceptions and one approved PO workflow. Keep manual choice of a normal forecast method; “out of box” must not invent universal lead time, safety stock, MOQ or forced case rounding.

Reports: offer business questions with saved filters rather than algorithm names. A report is read-only and never changes a draft in the background. Smart: later, a separate comparison/scenario experience with one explicit Apply selected suggestions to draft action. It preserves the original draft/parity results and provenance. There are no fifteen interacting merchant toggles. Internal feature flags, versioned policies and kill switches remain engineering controls.

One final quantity resolver uses one versioned variant/location/supplier/currency/UOM snapshot. Analysis modules supply demand estimates, constraints and warnings; they do not each add quantities, create POs or write Shopify. An unavailable input is unknown, not zero. Incoming mirrors deduplicate to one authority and are **not physically counted until received**. Do not subtract `committed` reservations from a physical on-hand total, and do not treat `available` as physical stock. Pack rules apply only to the supplier/offer/policy that actually requires them.

## 2. Fifteen strategies reorganized

| Strategy | Where it belongs now | Later proposal / guard |
|---|---|---|
| ABC–XYZ | Stocky ABC/U remains core; enhanced XYZ is a report | Only a validated Smart policy uses variability classes; do not relabel parity |
| Demand-pattern forecasting | Parity first; method comparison report | Curated statistical Smart methods selected by out-of-sample performance, not a merchant algorithm menu |
| FVA | Evaluation of Smart and override quality | Required internal proof of applied Smart benefit; no switch to disable quality evidence |
| Stockout-censored demand | Availability-quality and lost-demand estimate report | Separate estimate with uncertainty; never rewrite raw sales or silently change parity denominator |
| Safety stock / service level | Normal documented supplier/stock settings and explanations | One validated Smart protection calculation; no multiple hidden buffers |
| Supplier lead-time/reliability | PO/receipt events and supplier scorecard | Better timing only after sufficient evidence; include still-open late POs |
| Aging/SLOB | Aging, excess, dead-stock diagnostic report | Explicit warning or approved purchase exclusion, not automatic disposal/markdown |
| Lifecycle | Simple Active/Watch/Phase-out/Discontinued purchasing state | Phase-out exclusions explicit; never silently change Shopify product status |
| GMROI/capital | Governed report with cost-completeness labels | Later optimization only after reliable cost/period valuation |
| Quantity discounts | Supplier offer data and cost comparison | Report marginal alternatives first; no automatic larger order because unit price is lower |
| Forward/investment buy | Later opportunity report | Verified effective-dated offer, cash/holding/expiry risk; no launch optimizer |
| Budget-constrained procurement | Show draft value and an optional user-entered budget warning | Do not silently cut/redistribute quantities; optimization deferred |
| OTB | Optional planning report after commitments/valuation are stable | Separate cost/retail inventory plan from bank cash and PO budget |
| Exception-based planning | Core attention queue and visible warnings | Routine sorting is not permission for automatic purchase/stock writes |
| Closed-loop planning | Versioned recommendation, override, order/receipt capture | Later evaluation uses actual outcomes; does not manufacture causal profit claims |

This is a product-owner recommendation, not a statement that all rows are implemented or common to every app. Inventory Planner publicly offers advanced OTB [V13]; that supports its legitimacy, not the need to add a hard-budget allocator at launch. Prediko exposes a broad configurable buying table [V14]; ProPo should use concise defaults and governed saved views rather than compete on column count.

## 3. Smart boundary and selection criteria

Statistical forecasting is not generative AI and does not need merchant AI credits. Candidate methods and demand classification remain evaluated in later Smart research. Validate ADI/CV² at the actual cadence and horizon; thresholds are not universal. Rolling-origin holdouts, bias, intermittent/zero-demand and stockout quality, simple baselines and human overrides all need evaluation. A model wins only if its benefit is robust and its resource/service consequences acceptable, not because its name sounds advanced.

Store observed sales separately from latent-demand estimates; returns and nonnegative estimators need an explicit transformation. New variants retain insufficient-history status. The app must still deliver ordinary parity purchasing when Smart, BYOK, provider quota or advanced reports are unavailable.

Smart action contract: user runs comparison -> sees parity quantity and proposed difference with method/data/warnings -> chooses rows -> expected draft version is checked -> selected revisions are saved/audited -> ordinary approval/send flow. Never automatically regenerate a manually edited draft on dashboard load. Disabling future analysis does not change previously sent POs.

## 4. Reporting-first economic decisions

Provide reports answering: Which items generate margin for the capital held? What has not sold? Which supplier is late? When did we last order/receive this variant? Is a quoted case break actually cheaper after extra holding exposure? Which items exceed a chosen spend target?

GMROI uses period gross margin over average inventory investment at cost, with completeness and averaging method. Do not substitute retail value or a single closing snapshot. Offer comparisons distinguish all-unit and incremental tiers, taxes/freight/currency, cases versus units, expiry and holding assumptions. Unknown future price increases cannot justify a recommendation.

Budget/OTB reports must state basis and period, count commitments once and disclose infeasibility. Core draft generation is not silently constrained by them. This preserves the user's request for simplicity while retaining useful optional analysis. A later allocator would require a separate owner-approved brief and tests, not toggling a report into write mode.

## 5. Acceptance examples — proposed, not executed

- Every analysis report leaves parity outputs and draft versions unchanged.
- Applying a selected Smart result modifies only selected current-version draft rows and records source/method; stale/manually changed rows conflict visibly.
- Same inbound mirrored through two systems counts once; cancelled/partial/late supply is represented accurately.
- Individual bottles versus retail packs versus supplier cases never change units silently.
- Zero cost versus missing cost, no sales versus incomplete sales and estimated stockout loss remain distinct.
- Phase-out and already-sent POs are not revived by a forecast rerun.
- Equal performance falls back deterministically to the simpler eligible method.
- Tight budget produces a truthful warning, not an unexplained changed PO.
- Export and screen totals use the same metrics; permission-hidden costs cannot leak through reports.
- BYOK unavailable never blocks core Stocky workflows.

Research and formulas are proposed requirements. No R&D report is an accepted runtime or an assurance that the merchant will earn more profit.
