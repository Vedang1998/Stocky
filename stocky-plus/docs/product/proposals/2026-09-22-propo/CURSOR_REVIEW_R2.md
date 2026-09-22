# ProPo PR54 revision-2 independent Cursor review

**Verdict:** `PEER REVIEW — CORRECTIONS REQUIRED`

This critiques pinned P1 research. It is **not** an implemented app, **not** legal advice, **not** actual Claude review, and **not** approval to overwrite `product/11`. A proposal is not runtime evidence.

## 0. Review identity

| Field | Value |
|---|---|
| Dispatch-Key | `propo:issue55-v1:R2_PEER_REVIEW:6565e25b0266db440c91365c3e0a151cd7c0c479+fb6ca876f6a6612692e7d9187dc3c815eae156ad:cursor-review` |
| Reviewer run | `bc-b1f77326-9d0f-4dc3-bfa6-3ed67f6351ac` |
| Actual model | `cursor-grok-4.6-xhigh` (requested 4.7/xhigh was not dispatched; no paid fallback) |
| Subject P1 | `fb6ca876f6a6612692e7d9187dc3c815eae156ad` |
| Parent P0 | `c379bc0d078d80e33db751bbb23f37289329fbce` |
| Main X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` |
| Frozen PR45 H | `3cc2045107b54601c6b0e43c8690b7d090074b80` — **untouched** |
| Artifact branch | `review/pr54-r2-cursor-20260922-51ac` |
| Sole parent | P1 |
| Path | `stocky-plus/docs/product/proposals/2026-09-22-propo/CURSOR_REVIEW_R2.md` |
| Source access date | 2026-09-22 |

Nine P1 files; **no** approved `product/**` file overwritten. X is ancestor of P1. P0 parent is X.

| Path | P1 blob |
|---|---|
| `README.md` | `c76dd2596fa4e16cec48a79a3cbbb695e156984d` |
| `RESEARCH_SOURCES.md` | `8ddd5f9acc96c022e47e29272050b0a82c4cd022` |
| `DECISION_ENGINE.md` | `a9cb4234247ba598fa7c81f368ba962a27b87564` |
| `LIVE_STOCKTAKE_AND_HISTORY.md` | `8ca86846018205e84f578dca186988aece66849b` |
| `UX_AND_INTEGRATIONS.md` | `5cf227cb459c4617b9bd848a62df29d1e84c8020` |
| `SOFTWARE_COMPANY_OPERATIONS.md` | `c9ae64f10e2af660deb4855906aa4ea18235c588` |
| `PRICING_AND_BYOK_CHANGE_PROPOSAL.md` | `b0c591437d491d7eaecd5ac371243733b9347d20` |
| `LEGAL_AND_TRUST_READINESS.md` | `9036a6a95550663016f35d5eedc5e00424b9beb4` |
| `BRAND_MIGRATION.md` | `a595f3dbd4b9b09ab33c0885218e948635929ee1` |

## 1. Exact-head CI (docs-only)

Local classifier X→P1: `docs_only=true`, `full_ci=false`, `classification_reason=every_changed_path_is_docs_allowlist`, 9 docs paths.

GitHub `pull_request` run [35785998870](https://github.com/Vedang1998/Stocky/actions/runs/35785998870):

- event `pull_request`, head **`fb6ca876f6a6612692e7d9187dc3c815eae156ad`**
- Classify `106942840503` SUCCESS (self-test `assertions=40 pass=40 fail=0`)
- Heavy SKIPPED (correct for docs-only)
- CI Gate `106942889177` SUCCESS (`docs_only=true`, `full_ci=false`, `validate_result=skipped`)

This is the required exact-head docs evidence. P0 run `35743468377` is superseded and not reused as P1 proof. Heavy skip on PR54 must **not** be copied to PR53.

Live ruleset `20012314` still lists Heavy **and** CI Gate as required checks (`strict_required_status_checks_policy: true`). That is a merge-mechanics fact, not a reason to run Heavy on this docs PR.

## 2. Owner preference vs approved product vs source vs inference

| ID | Class | P1 handling | Reviewer note |
|---|---|---|---|
| O2-01 full public parity | owner preference | Launch = complete approved Stocky-parity + viable operator/billing | Aligns with `product/02` 132-feature scope. Internal milestones ≠ public completeness. Keep. |
| O2-02 mixed testers | owner preference | Four-cohort **targets**, not enrolled merchants | Correct; do not invent stores. |
| O2-03 simple default | owner preference | Withdraws fifteen-toggle design | Aligns with AGENTS “no globally forced MOQ/pack/lead/safety.” |
| O2-04 budget/OTB | owner preference + vendor marketing | OTB legitimacy ≠ launch necessity | Inventory Planner [V13] is advertised capability, not ROI. Keep deferred. |
| O2-05 computer vs POS | owner preference | Admin + POS tiles; offline capture ≠ finalization | Conflicts with `product/11` Growth-gated POS extensions — F-P54-03. |
| O2-08 average cost | owner + Stocky help | Internal ledger vs optional Shopify sync vs historical approximation | Independently confirmed — §5 V03. |
| O2-09 seats | owner + Shopify help | Cannot promise full staff import | Independently confirmed and **stronger** than P1 — F-P54-01. |
| O2-11 BYOK later | owner preference | Conflicts with `product/11` included AI credits | Labeled, but exact crosswalk table missing — F-P54-03. |
| O2-16 no lawyer | owner constraint | Q-008 remains OPEN; AI draft ≠ counsel | Correct. This review is not legal advice. |

Control facts re-read: PR6 CLOSED via PR47; Phase 1 IN PROGRESS; R-176 OPEN/P0; R-164 OPEN; Q-008 OPEN; D-054 EFFECTIVE; no D-055; PR7 runtime not authorized; H frozen.

## 3. Independent source re-check (2026-09-22)

| ID | Independent result | Conflict with P1? |
|---|---|---|
| V01 staff limits | Confirmed: Starter/Basic **0**, Grow **5**, Advanced **15**, Plus unlimited. Owner, collaborators, POS-only **exempt**. **Also:** Pause and Build **1** staff user (omitted by P1). | P1 incomplete on Pause and Build — F-P54-05. |
| V01 `read_users` / StaffMember | GraphQL 2025-10 StaffMember: requires `read_users` **and** finance embedded app **or** Plus/Advanced; “Contact Shopify Support to enable.” Access-scopes page labels some types `shopify plus` as finance embedded / Plus / Advanced + Support. Shopify staff Donal-Shopify 2025-12-03: REST User resource is “private apps and custom apps installed on Shopify Plus”; GraphQL/scopes pages omit custom-app-only; staff understanding is public apps **even Plus-only** lack that trust model. | P1 correctly flags conflict. It still under-specifies that **launch default for a public app is no StaffMember directory** — F-P54-01. |
| V02 tokens | ID token authenticates user, **carries no API permissions**. Offline tokens are default for background work; online tokens optional for staff permission intersection; expire 24h or logout. | P1 “online/offline/user scope” is directionally right. “Proven Shopify user permissions where available” must not be read as online-token enablement (PR45 hazard preserved — good). |
| V03 average cost | Confirmed Stocky-only internal average; formula `((avg * on_hand) + (landed * received)) / (on_hand + received)`; negative-stock special cases; optional sync **overwrites** Shopify cost and cannot be undone; historical backdate is approximate. | P1 aligns. Must copy the two negative-stock exceptions into the cost contract — F-P54-11. |
| V04 stocktakes | Confirmed: Stocky ignores unfulfilled orders and treats inventory as **available**; zero-out missed items; **no historical inventory save**; barcode stocktake **not** in POS / POS GO; camera unsupported in Stocky desktop stocktake. | P1 is right not to copy those limitations. It must not copy **available** as the physical quantity either — F-P54-04. |
| V08 POS session | Confirmed 2026-09-22: `getSessionToken` is the **authenticated user**, not the pinned staff member. `staffMemberId` may differ from `userId`. Token `undefined` if authenticated user lacks app permission. Pinned-only staff cannot mint tokens. | P1 is correct. |
| V09/V10 CAS / idempotency | Changelog 2025-12-12 (API 2026-04): `changeFromQuantity` mandatory; `compareQuantity` / `ignoreCompareQuantity` **removed**; example sets `name: "available"`. **Latest** `inventorySetQuantities` page (examples pinned `2026-07` in cURL) **still documents** `compareQuantity` and `ignoreCompareQuantity`, and examples still use `name: "available"`. Caution: `@idempotent` **required** as of 2026-04. Idempotency overview: not every mutation has the same guarantee. | P1 predicted this conflict. Independent fetch **confirms** it is still live. Pinning a schema is mandatory — F-P54-02. |
| V11/V12 App Pricing | Confirmed: default for new public apps; plans in Partner Dashboard; app monitoring in Dev Dashboard; `activeSubscription` on **Partner API** is current contract; redirect/`plan_handle` is not entitlement; pre-April-2026 enrollments have a legacy note; App Pricing **product** is free to use — that is not free merchant support. | P1 is correct. |
| V15 CASL | CRTC FAQ fetch **blocked** (Cloudflare interstitial). | P1 citation **not independently re-verified this run**. |
| V16 CAN-SPAM | Confirmed: covers B2B; transactional vs commercial primary purpose; mixed-content rules; opt-out 10 business days. Penalty figure $53,088 (FTC page edited Jan 2024) — not required for P1 accuracy. | P1 is correct as far as it goes. Not a 50-state survey. |
| V17 Zoho Desk | Free edition **three** support users confirmed. Fetched USD view still **did not expose numeric paid prices** in the extracted page (currency selector present). Zoho now advertises **AI agents / BYOK** on Express. | “No fabricated USD quote” stands. Do not treat Free as production-complete. |
| V18 Sentry | Developer $0 / **one user** confirmed. Team shown **$26/mo** billed annually with default prepaid data; API & third-party integrations are **Team**, not Developer. | P1 “may require paid plan / do not assume free API” confirmed and can now cite $26 Team as advertised, not as a quote for IVYY’s actual usage. |
| V19 Resend | Confirmed Free 3,000/mo and **100/day**; Pro **$20/mo / 50,000**. Additional Pro/Scale rows exist. | P1 shortlist is accurate; Scale exists if volume grows. |
| V20 Brevo free-plan help | Fetch **timed out**. | Not independently re-verified this run. |
| V21 support email | Not re-fetched; public-app support-email requirement is standard App Store guidance. Mailbox still not created (owner). | Open launch item. |
| V22 PIPEDA consent | Confirmed meaningful consent, withdrawal, necessity; HTML summary only. | P1 correctly says not a provincial opinion. |
| V23 OQLF adhesion | Fetch **timed out**. | Quebec analysis remains un-reverified here. Language ≠ market clearance still holds. |
| Store-permissions help | HTTP **403** this run. | Online vs Admin permission matrix not independently re-read. |

**Vendor marketing** (V13 Inventory Planner OTB, V14 Prediko columns) establishes advertised features only.

## 4. Findings

### F-P54-01 — P1 — Public-app identity default must not depend on `read_users`

**Evidence:** StaffMember 2025-10 docs + Donal-Shopify 2025-12-03 vs GraphQL “Contact Support” phrasing.

**Impact:** A merchant on Basic/Grow (0 or 5 Admin staff) plus unlimited POS-only staff cannot be billed or authorized from a Shopify staff dump. Even Plus public-app directory access is **contested by Shopify staff**. If UX §3 is read as “import Shopify roles,” launch will stall or over-scope.

**Expected:** Launch architecture = Shopify login/app access + **ProPo-local capability profiles** bound to the authenticated user id from the ID token / online `associated_user.id` **if** online tokens are later accepted. StaffMember/`read_users` is an optional later enhancement gated on an actual granted scope — never a launch promise.

**Smallest correction:** Replace “Use proven Shopify user permissions where available, plus simple owner-approved ProPo capability profiles when Shopify exposes no equivalent” with “Default: ProPo capability profiles on authenticated user identity. Do not design launch or seat counting around StaffMember. Any directory API is a separately proven, Support-granted enhancement.”

**Missing test:** Seat-count cases: owner-only Basic store; Grow + 5 staff + N POS-only; collaborator; pinned POS staff ≠ authenticated user; revoked user; denied `read_users`.

### F-P54-02 — P1 — Do not copy the live `inventorySetQuantities` examples

**Evidence:** Changelog 2026-04 vs latest mutation page still showing `compareQuantity` and `name: "available"`. `@idempotent` required 2026-04.

**Impact:** Copy-paste implementation would (a) fail on 2026-04+ or (b) set **available** from a physical count, reproducing Stocky’s unfulfilled-order bug in the other direction.

**Expected:** Pin API version; pin quantity **name** (`on_hand` for physical, never silently `available`); pin CAS field (`changeFromQuantity`, not `compareQuantity`); require `@idempotent`; refuse `changeFromQuantity: null` for merchant counts (changelog allows null to opt out — that opt-out is incompatible with a live stocktake). Current repository already stores eight names (`available`, `on_hand`, `incoming`, `committed`, `reserved`, `damaged`, `safety_stock`, `quality_control`).

**Smallest correction:** Add a “forbidden example” callout quoting the live docs’ `name: "available"` + `compareQuantity` sample as **non-authoritative for ProPo counts**.

### F-P54-03 — P1 — Exact `/11` change crosswalk is missing

P1 says it “explicitly differs from /11’s included AI credits and existing seat numbers” but does not tabulate every colliding row. Required before owner pricing approval.

| /11 (approved, still in force) | P1 proposal | Decision needed |
|---|---|---|
| Essentials 3 users / Growth 10 / Pro unlimited | Shopify-aligned owner+0/5/15 hypotheses; count assigned ProPo users only | Owner: primary price driver seats vs locations/variants |
| 100 / 500 / 1,500 AI credits + internal $1.75/$5/$12 AI COGS | No ProPo AI credits; generative AI after launch; merchant BYOK | Owner: supersede §7.3–7.4 of /11 |
| POS receiving/count/stocktake extensions on **Growth** (`11` lines 132, 155) | “POS workflows remain core, not paid extras” (README §5, pricing §1) | Owner: Essentials POS tiles vs Growth-gated POS — this is a **product** change, not a packaging footnote |
| Receipt reversal / unreceive on Growth | Core receiving/corrections in the launch promise (README §1) | Owner: is unreceive launch-core? |
| Shopify Flow on Growth | “Shopify Flow in its owning phase” (UX §6) | Sequencing vs packaging |
| Smart Forecasting on Pro | Later separate Smart surface; statistical Smart ≠ generative credits | Compatible if Smart stays off Essentials |
| Enterprise API | Versioned scoped APIs later | Keep later |
| No revenue-primary pricing; complete core loop; no unlimited AI | Retained | Keep |

**Smallest correction:** Insert this table (plus trial/downgrade/cancellation rows) into `PRICING_AND_BYOK_CHANGE_PROPOSAL.md` §4. Do **not** silently edit `product/11`.

### F-P54-04 — P1 — Physical vs available/committed must be a named mapping

P1’s identity `projected_physical(t_f) = count(t_c) + verified movements (t_c, t_f]` is algebraically sound **if and only if** “system_on_hand” is Shopify `on_hand`, not `available`. Stocky help compares to **available** and ignores unfulfilled orders. Approved facts already separate `available` and `on_hand`.

**Expected mapping (proposed, not executed against a store):**

| Concept | Shopify quantity name | Count write? |
|---|---|---|
| Physical units in the bin | `on_hand` | Yes, after coverage proof |
| Sellable | `available` | **No** as a physical total |
| Unfulfilled reservation | `committed` | Observe; do not subtract twice |
| Incoming PO | `incoming` | Deduplicate to one authority |

Synthetic probe (18/18 pass) demonstrates correct projection **and** required conflict/recount (see §6). A refreshed aggregate quantity is not a movement ledger — P1 already says this; keep.

**Smallest correction:** Add the four-row mapping and “system comparison uses `on_hand`” to LIVE_STOCKTAKE §1.

### F-P54-05 — P2 — Pause and Build staff limit omitted

Help Center table includes Pause and Build = 1 user. Harmless if first release ignores paused stores; harmful if seat UX assumes the 0/5/15/unlimited set is exhaustive.

### F-P54-06 — P2 — Incomplete independent re-fetch of legal/email/helpdesk pages

CASL, OQLF, Brevo free-plan, and store-permissions were **not** independently retrieved this run (Cloudflare, timeout, or 403). P1’s caution labels remain appropriate. Do not treat this review as confirming those URLs’ current text.

Sentry Team advertised $26/mo annual; Zoho Express now includes vendor AI/BYOK — extra reason not to mix merchant BYOK policy with helpdesk-vendor AI.

### F-P54-07 — P2 — Do not market “stocktakes while trading” before the capability matrix

O2-06 is a differentiator. P1 §3 correctly requires a development-store matrix before automatic adjustment. Public listing copy must not claim guaranteed live accuracy. Stocky’s own sunset note is not ProPo completion evidence.

### F-P54-08 — P3 — Home / navigation is an untested hypothesis

Stocky low-stock help was used as research input, not a reconstructed screenshot. No four-cohort usability run. WCAG 2.2 AA remains a target, not a certificate. Fine for R&D; not an implementation brief.

### F-P54-09 — P2 — Four-cohort cells are recruitment targets

“At least two consenting merchants in each of four cells **where feasible**” is honest. Blocked cells must be documented. Synthetic load ≠ usability; anecdotes ≠ tenant tests. P1 already says this — keep, and do not let a later status report invent enrolled stores.

### F-P54-10 — P2 — Language is not market clearance; Q-008 stays OPEN

P1 preserves Q-008 and refuses model-agreement-as-counsel. Independently: PIPEDA consent page and CAN-SPAM guide support the operational vs marketing split. Quebec/OQLF not re-fetched. Owner still needs an explicit risk decision if no counsel is hired; that decision cannot waive duties to customers/regulators (P1 already says so).

### F-P54-11 — P2 — Cost-sync consent vs `write_inventory`

P1 correctly separates internal average, Shopify `unitCost`, and historical approximation; `write_inventory` ≠ consent; price/compare-at need `write_products` and a separate permission. Independently confirmed Stocky auto-sync overwrites Shopify cost irreversibly. Add Stocky’s two negative-stock average-cost exceptions to the ProPo contract so they are not “invented shortcuts” later.

### F-P54-12 — P2 — Operator plane vs “free” tooling

App Pricing + Partner `activeSubscription` is the right billing spine for a **new** public app. Free Sentry/Zoho/Resend tiers are not production-support proof. Uninstall must not create marketing consent. Partner API credentials are operator secrets — keep.

### F-P54-13 — P3 — Brand / NY entity

Owner-supplied IVYY LLC / 20 Fillner Ave / NY registration: attestation only. Domain and support mailbox not acquired. Technical IDs must not be globally renamed. Fine.

## 5. Work-order priority crosswalk

1. **Full parity vs extra ERP/AI:** P1 launch boundary matches `product/02`/`06` better than P0’s fifteen-toggle engine. Smart is later and separate. Good. Operator plane is launch-necessary; GMROI optimizer is not.
2. **Simple core + reports + later Smart:** Fifteen-switch design is withdrawn. No duplicated PO math in reports. No forced pack/safety/lead. Budget/OTB deferred. Good.
3. **Live stocktake:** Algebra is right; quantity-name pin is missing (F-P54-02/04). Synthetic cases in §6.
4. **Last ordered/received/sold + lineage:** Three fields + GID immutability are right. SKU match without approval is denied in the probe. Support access ticket-bound — keep; do not expand to impersonation.
5. **Staff API / seats / POS pin:** F-P54-01/05. Downgrade must not lock Shopify users; P1 already says this.
6. **Average cost / prices:** F-P54-11. Compare-at is its own operation.
7. **IVYY operator plane / App Pricing:** Directionally right; official pricing/limits checked where fetches succeeded.
8. **Accounting/Flow/POS/labels/API/BYOK:** Source ownership and no Shopify-token sharing are right. Exact `/11` table is F-P54-03.
9. **US/Canada English + FR/ES evaluation:** Correctly not market clearance. Q-008 OPEN. Unresolvable legal interpretation vs ordinary document defects distinguished. CASL/OQLF not re-fetched.
10. **Home/navigation/report builder:** Practical, permission-safe intent; untested (F-P54-08).

## 6. Synthetic stocktake / lineage probe (not a store)

Executed 2026-09-22T21:29:43Z, isolated Python, **18/18 pass**. Not Shopify, not POS hardware, not a movement ledger.

| Case | Result |
|---|---|
| Count 12 @10:00 then −2 sale +5 receipt → projected 15 | PASS |
| Sale before count; subtracting sale again yields 8 vs correct 10 | PASS (double-subtract detected) |
| Physical 12 / available 8 / committed 4 → refuse `available:=12` | PASS |
| Same row `on_hand` CAS against 12 | PASS |
| Refund without restock does not add physical | PASS |
| Verified restock +2 | PASS |
| Multi-bin: count A=5 then move 5 A→B then count B=8; naive 13 ≠ true 8 → conflict | PASS |
| CAS stale (changeFrom 12, persisted 11) | PASS |
| `changeFromQuantity=null` denied for counts | PASS |
| Uncounted is NULL, not 0 | PASS |
| Duplicate client event id deduped | PASS |
| Late webhook after sale-before-count does not adjust | PASS |
| Idempotency key reused with different bytes denied | PASS |
| SKU match without merchant approval denied | PASS |
| Approved versioned reporting relation allowed | PASS |
| Rewrite of raw facts denied | PASS |
| Draft PO date ≠ last ordered | PASS |
| Missing history is unknown, not “never” | PASS |

These cases **demonstrate required recount/conflict**, not a green production algorithm. Launch still needs a controlled-store matrix (P1 §3, unexecuted).

## 7. Smallest safe corrections (author, not this reviewer)

1. F-P54-01 default identity paragraph.
2. F-P54-02 forbidden Shopify example + `@idempotent` / `changeFromQuantity` pin.
3. F-P54-03 exact `/11` table (do not edit `/11`).
4. F-P54-04 `on_hand` vs `available` mapping.
5. F-P54-11 negative-stock average-cost exceptions from Stocky help.

P2 items can travel with the same successor or wait for owner decision list.

## 8. Unresolved owner decisions

1. POS tiles on every paid plan vs `/11` Growth gate.
2. Unreceive/reversal as launch-core vs Growth.
3. Seat primary metric vs location/variant scale; whether owner is included in the count.
4. Formal supersession of `/11` AI credits/budgets (BYOK-after-launch).
5. Whether to proceed toward US/Canada listing without retained counsel (Q-008 remains OPEN regardless).
6. Domain, support mailbox, trademark, entity verification.
7. First accounting connector (QBO vs Xero) after ledgers exist.
8. Whether StaffMember will ever be requested from Shopify Support for this **public** app.

## 9. Evidence limits

**Executed:** git ancestry/blobs; local + GitHub docs CI on exact P1; official web fetches listed in §3; synthetic probes 18/18.

**Not executed:** live store, POS device, camera, inventory mutation, billing enrollment, Partner API client, recruitment, legal opinion, corporate registry, domain DNS, email send, Claude review.

**Failures preserved:** CASL Cloudflare block; OQLF timeout; Brevo timeout; store-permissions 403; GraphQL vs staff `read_users` conflict; mutation-page vs changelog CAS field names.
