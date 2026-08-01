# Decisions — Phase 0

Format: current rule → proposed → reason → merchant impact → technical impact → migration → risks → final decision.

## D-001 — Product source of truth location

1. **Current:** Approved docs live in `stocky-plus/docs/product/`; agent prompts in `stocky-plus/docs/agents/`.
2. **Proposed:** Keep this layout; do not restore old prompts under `docs/product/`.
3. **Reason:** Main already merged governance; old Phase 0 branch duplicated outdated copies.
4. **Merchant impact:** None.
5. **Technical impact:** Agents read correct paths.
6. **Migration:** None.
7. **Risks:** Confusion if old branch merged wholesale.
8. **Final:** **Accepted** — preserve main copies; never overwrite from `phase-0-product-alignment`.

## D-002 — Inventory write kill switches

1. **Current:** Stocktake/transfer/receipt could run without global kill switches.
2. **Proposed:** Env-flagged defaults OFF for stocktake, adjustment, receipt, cost sync, transfer writes.
3. **Reason:** Release gates in `06_ROADMAP_AND_RELEASE_GATES.md`.
4. **Merchant impact:** Destructive writes blocked until gates pass.
5. **Technical impact:** Routes call `assertInventoryWriteEnabled`.
6. **Migration:** Document flags in `.env.example`.
7. **Risks:** Local demos need explicit flags.
8. **Final:** **Accepted** for Phase 0.

## D-003 — Stocktake completion on partial Shopify failure

1. **Current (pre-fix):** Marked `COMPLETED` even when adjusts failed.
2. **Proposed:** Leave `IN_PROGRESS` and return error when any required write fails.
3. **Reason:** Inventory-write contract — never complete unresolved writes.
4. **Merchant impact:** Safer counts; may need retry UX later.
5. **Technical impact:** Narrow control-flow change in `app.stocktakes.tsx`.
6. **Migration:** None.
7. **Risks:** None material.
8. **Final:** **Accepted** as Phase 0 safety fix.

## D-004 — Merchant-managed fulfillment scopes

1. **Current:** `read/write_merchant_managed_fulfillment_orders` requested.
2. **Proposed:** Remove until an approved fulfillment feature needs them.
3. **Reason:** Product gap audit; no implemented workflow.
4. **Merchant impact:** Narrower install consent.
5. **Technical impact:** toml + `.env.example` SCOPES updated.
6. **Migration:** Existing installs may retain old scopes until reauth.
7. **Risks:** Low.
8. **Final:** **Accepted**.

## D-005 — Public product name

1. **Current:** Repository/UI historically used `Stocky++`.
2. **Proposed:** Working title “Inventory platform” in primary Admin heading; remove Stocky++ from billing plan names; README/SETUP cleanup deferred to naming decision.
3. **Reason:** F-131 / `00_READ_ME_FIRST.md` forbid Stocky / Stocky++ / first-party impersonation.
4. **Merchant impact:** Temporary generic label.
5. **Technical impact:** Copy changes only.
6. **Migration:** Listing assets later.
7. **Risks:** Inconsistent docs until rename completes.
8. **Final:** **Pending product-owner approval** of public name; interim softening accepted.

## D-006 — Development subscription bypass

1. **Current:** Unprotected `devActivate` on Buying Table.
2. **Proposed:** Require `ALLOW_DEV_SUBSCRIPTION_ACTIVATE=true` and non-production `NODE_ENV`.
3. **Reason:** Premature Boolean is not an entitlement architecture; open bypass is unsafe.
4. **Merchant impact:** Production cannot self-activate.
5. **Technical impact:** Action + UI gated.
6. **Migration:** Local `.env` opt-in.
7. **Risks:** Dev friction.
8. **Final:** **Accepted**.

## D-007 — API version pin

1. **Current:** toml + server both `2025-10` / `October25`.
2. **Proposed:** Keep `2025-10` until all operations validate; do not adopt old branch’s `2026-10` bump.
3. **Reason:** Codegen already fails on inventoryLevel args and `inventoryTransferComplete`.
4. **Merchant impact:** None immediate.
5. **Technical impact:** Phase 1 must fix GraphQL ops against current schema.
6. **Migration:** None.
7. **Risks:** Staying on a version with invalid ops if writes enabled.
8. **Final:** **Accepted** — stay on 2025-10; fix ops before any version bump.

## D-008 — Old Phase 0 branch treatment

1. **Current:** `origin/phase-0-product-alignment` predates main product/governance merge.
2. **Proposed:** Treat as untrusted candidate; selectively port safety + docs patterns; never merge wholesale.
3. **Reason:** User Phase 0 instructions.
4. **Final:** **Accepted**.

## D-009 — Receipt gating while DB-only

1. **Current:** `receivePartialPO` updates app DB only.
2. **Proposed:** Gate receive/scan behind `FEATURE_RECEIPT_WRITES` until receipt ledger + Shopify write path exist.
3. **Reason:** Prevent silent expansion of unsafe receiving; align with freeze list.
4. **Merchant impact:** Receiving UI blocked by default.
5. **Final:** **Accepted** for Phase 0; Phase 4 rebuild replaces path.

## D-010 — Phase 0 correction gate closure

1. **Current:** PR #7 was green, independently reviewed, accepted, explicitly authorized, and squash-merged (`6fbe4c1d8497c3be2cd3ef5a8619ee63ccd8fdfb`).
2. **Proposed:** Formally close the Phase 0 correction gate via a documentation-only closure PR.
3. **Reason:** Mandatory corrections were resolved and Claude returned **`READY FOR PHASE 1 FOUNDATION`**.
4. **Merchant impact:** None directly; unsafe inventory writes remain disabled.
5. **Technical impact:** Phase 1 foundation planning may begin only after a separately approved `PHASE_BRIEF.md`.
6. **Migration:** None.
7. **Risks:** Deferred risks remain, particularly **F-016 / R-022 (P1)** database-enforced tenancy and inventory-write release gates.
8. **Final:** **ACCEPTED** — Phase 0 closes when the documentation-only closure PR merges.

### Product-owner severity decision (recorded with D-010)

- **F-016 / R-022 is P1.**
- Database-enforced tenant isolation is mandatory in the Phase 1 foundation brief.
- Application-layer shop filters alone are insufficient.
- Production inventory writes remain **unapproved**.
- All inventory-write flags remain default **OFF**.

---

# Decisions — Phase 1

ChatGPT approved the Phase 1 planning decisions reviewed by Claude at head `835088d3c0294222b14d67a5875709f299062439` on **2026-07-30**.

Planning PR [#9](https://github.com/Vedang1998/Stocky/pull/9) squash-merged as `9fc1025b73be9bbe774a948b4a2302f5664670f3` at `2026-07-30T18:28:20Z`.

Status for each decision below:

`APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE`

None of these decisions are implemented merely because they are approved. Inventory-write approval remains separate and ungranted. Q-002 Partner Dashboard evidence, Q-008 legal review, and Q-011 / F-016 / R-022 / R-014 remain open gates or dependencies as recorded. Commercial hypotheses remain hypotheses. F-016 / R-022 and R-014 remain open P1 implementation gates until implemented and independently verified.


## D-011 — Phase 1 scope and boundaries

1. **Current:** Phase 0 closed; no Phase 1 implementation started.
2. **Proposed:** Phase 1 establishes a tenant-safe Shopify fact foundation only — Shop/`shopId`, composite tenant FKs, forced RLS, sync control plane, catalog/location/inventory/order/refund facts, audit/roles scaffold, privacy processors, reconciliation and performance exit. Out of scope: forecasting, ABC/U, Buying Table redesign, supplier/PO/receiving/stocktake/transfer/cost expansion, billing, entitlements, AI, POS, labels, reports, production inventory writes, enabling write flags, destructive schema drops, broad UI redesign.
3. **Reason:** Product roadmap Phase 1; F-016 / R-022; unsafe to build operational features on incomplete multi-tenant facts.
4. **Merchant impact:** None immediate; foundation for later parity.
5. **Technical impact:** Focused additive foundation work after brief approval.
6. **Migration:** Additive only; preserve legacy `shop` columns through Phase 1.
7. **Risks:** Scope creep into later phases; premature write enablement.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-012 — Canonical Shop and direct shopId ownership

1. **Current:** Merchant ownership is primarily application-level string `shop` filters; many child rows lack direct tenant ownership.
2. **Proposed:** Canonical `Shop` entity with stable internal ID and normalized unique Shopify shop domain; non-null `shopId` on every merchant-owned row after verified backfill.
3. **Reason:** F-016 / R-022; database-enforced tenancy.
4. **Merchant impact:** None direct; safer multi-merchant isolation.
5. **Technical impact:** Additive schema + backfill + access conversion.
6. **Migration:** Nullable ownership first; quarantine inconsistent rows; never guess.
7. **Risks:** Incomplete backfill; inconsistent parent/child ownership.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-013 — Composite tenant foreign keys

1. **Current:** Child FKs reference parent IDs without tenant co-ownership.
2. **Proposed:** Parent tables expose composite unique keys containing `shopId` and record ID; every child FK includes `shopId`; cross-domain relations include tenant ownership; tenant indexes begin with `shopId`.
3. **Reason:** Prevent cross-shop attachment of valid parent IDs.
4. **Merchant impact:** None direct.
5. **Technical impact:** Constraint and relation redesign with additive migrations.
6. **Migration:** Enforce only after unresolved ownership count is zero.
7. **Risks:** Existing inconsistent rows block enforcement.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-014 — Forced PostgreSQL Row-Level Security

1. **Current:** No RLS; omitted application filters can expose or mutate another shop’s row.
2. **Proposed:** Enable and force RLS on every approved merchant-domain table; missing tenant context is default-deny. Policies must include appropriate `USING` and `WITH CHECK` behavior. An INSERT may set `shopId` only to the current transaction tenant. An UPDATE may not change `shopId`. Database-level enforcement must reject tenant-key mutation even if application validation is missing or bypassed. Application code must not expose `shopId` as an ordinary mutable update field. The final design must use a database-enforced immutability mechanism in addition to ordinary application validation; the implementation report must identify the exact mechanism. RLS `WITH CHECK` alone is not a substitute for proving tenant-key immutability under every relevant operation. Composite tenant FKs without RLS do **not** satisfy F-016 / R-022.
3. **Reason:** Defense in depth beyond application filters; prevent in-session tenant reassignment.
4. **Merchant impact:** None direct; fail-closed on missing context or tenant-key mutation.
5. **Technical impact:** SQL policies; runtime must set transaction-local tenant context; immutability tests required.
6. **Migration:** Convert all runtime access before activating RLS.
7. **Risks:** Rollback to pre-tenant-aware app after RLS is unsafe; incomplete WITH CHECK / immutability.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-015 — Restricted runtime database role

1. **Current:** Application likely uses a privileged database role that owns schema objects.
2. **Proposed:** Runtime role does not own tables, has no `BYPASSRLS`, cannot change policies or run migrations.
3. **Reason:** Prevent accidental or malicious RLS bypass.
4. **Merchant impact:** None direct.
5. **Technical impact:** Separate DB credentials for web/workers.
6. **Migration:** Role provisioning and privilege verification tests.
7. **Risks:** Misconfigured role ownership or `BYPASSRLS`.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-016 — Separate migration database role

1. **Current:** Same privileged access may perform migrations and runtime queries.
2. **Proposed:** Migration role is separate and unavailable to web and worker processes.
3. **Reason:** Least privilege; migration ownership must not leak to runtime.
4. **Merchant impact:** None.
5. **Technical impact:** CI and deploy use migration-owner vs runtime roles.
6. **Migration:** Documented role setup in runbooks.
7. **Risks:** Accidental runtime use of migration credentials.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-017 — Transaction-local tenant context

1. **Current:** Tenant scoping is per-query application filters.
2. **Proposed:** Tenant context is transaction-local and established before any merchant-domain query; direct unrestricted Prisma/raw SQL to merchant-domain tables is prohibited. For authenticated web requests, tenant authority derives only from server-side verified Shopify authentication and the canonical Shop resolved from that identity. Query parameters, form values, route parameters, request JSON, browser storage, client headers, and other client-supplied shop identifiers must never establish tenant authority; they may be untrusted lookup input only after authorization and remain constrained by database tenant enforcement. For background work, tenant authority derives only from a server-created, persisted, validated, versioned job or event envelope that includes canonical `shopId`, source, correlation or causation identity, schema version, and sufficient integrity validation. Workers must resolve and validate the Shop before establishing transaction-local tenant context. A raw queue payload, Shopify domain string, external ID, or client-created job message is insufficient authority. Invalid, missing, disabled, uninstalled, redacted, or mismatched envelopes fail closed. Queue replay must preserve validated tenant authority and audit lineage.
3. **Reason:** RLS and pooled connections require explicit, non-leaking context; client-supplied or unvalidated job values must not become tenancy authority.
4. **Merchant impact:** None direct.
5. **Technical impact:** Tenant-bound data-access contract for routes, workers, jobs, exports, privacy, reconciliation; validated job envelopes.
6. **Migration:** Convert all current domain access before RLS activation.
7. **Risks:** Connection-pool context leakage; client-controlled tenant context; unvalidated job envelopes.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-018 — Restricted Session and Shop bootstrap exception

1. **Current:** Session storage and shop resolution may need access before tenant context exists.
2. **Proposed:** Isolate Shopify session storage and minimal Shop lookup in a small bootstrap module that cannot query merchant-domain tables; sessions must not become a general tenancy bypass.
3. **Reason:** Auth bootstrap is required; unrestricted bypass is not.
4. **Merchant impact:** None direct.
5. **Technical impact:** Narrow bootstrap API; boundary tests.
6. **Migration:** None destructive.
7. **Risks:** Bootstrap expands into a general bypass.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-019 — Public App Store distribution and environment separation

1. **Current:** Partner distribution unverified (`shopify app info` historically failed); Q-002 open.
2. **Proposed:** Intended production uses public Shopify App Store distribution; development, staging/pilot, and production use separate app registrations or explicitly isolated linked configs, credentials, databases, Redis, storage, callbacks, and webhooks. Partner Dashboard app IDs and distribution selections must be verified before deployment work.
3. **Reason:** Prevent cross-environment credential and webhook contamination.
4. **Merchant impact:** Correct install and webhook targeting.
5. **Technical impact:** Separate Linked apps / env configs.
6. **Migration:** None until verified.
7. **Risks:** Deploying without Q-002 evidence.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`). Approved product direction pending Q-002 Partner Dashboard evidence.

## D-020 — Trial and private development-plan hypothesis

1. **Current:** Trial/dev-plan commercial terms unresolved (Q-006); billing not implemented.
2. **Proposed:** Working hypothesis remains 14-day Growth-equivalent trial and private $0 development test plan. Phase 1 does **not** implement billing, plans, entitlements, or commercial usage limits. A future development test plan must be non-production-only, limited to approved development/test stores, unavailable to ordinary merchants, and incapable of bypassing tenancy, permissions, or inventory-write gates.
3. **Reason:** Pricing strategy; keep commercial scaffolding out of Phase 1 foundation.
4. **Merchant impact:** None in Phase 1.
5. **Technical impact:** Defer entitlement schema/enforcement.
6. **Migration:** None.
7. **Risks:** Premature billing/entitlement implementation.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`). Approved working commercial hypothesis, not a validated final price or implemented billing plan; billing implementation deferred.

## D-021 — Uninstall and privacy webhook behavior

1. **Current:** Uninstall deletes sessions; compliance webhooks authenticate/acknowledge only (R-005, R-011, Q-008).
2. **Proposed:** Uninstall disables shop and jobs immediately and deletes sessions/tokens. `shop/redact` erases tenant operational data, caches, exports, queue payloads, and storage objects; preserve only non-reversible deletion receipt and counsel-confirmed retained records (minimized, segregated, inaccessible to normal workflows). Do not store unnecessary customer PII in order/line facts. Processes are idempotent, auditable, retryable, deletion-manifest backed. Legal review required before production.
3. **Reason:** App Store privacy compliance; merchant trust.
4. **Merchant impact:** Correct erasure and data-request handling.
5. **Technical impact:** Real privacy processors in Phase 1 after brief approval.
6. **Migration:** Deletion manifests and retention exceptions.
7. **Risks:** Incomplete deletion; jobs continuing after uninstall.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`). Approved privacy-policy direction pending legal review under Q-008.

## D-022 — Dependency-ordered Phase 1 implementation PR sequence

1. **Current:** No Phase 1 implementation PRs.
2. **Proposed:** Eight dependency-ordered PRs: (1) tenant expand/backfill, (2) tenant-bound access conversion, (3) database enforcement/RLS — hard gate before later PRs, (4) sync control plane, (5) catalog/location/inventory facts, (6) order/refund facts, (7) audit/roles/privacy, (8) reconciliation/performance/exit. Each starts from updated `main`, requires CI, Claude review, ChatGPT acceptance, and explicit user merge authorization.
3. **Reason:** Enforce F-016 before sync/facts expansion; prevent mixed unsafe merges.
4. **Merchant impact:** None direct.
5. **Technical impact:** No later Phase 1 PR begins until PR 3 is reviewed, accepted, and merged.
6. **Migration:** Additive throughout.
7. **Risks:** Skipping enforcement gate; mixed scopes.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`).

## D-023 — Shopify API-version validation before sync implementation

1. **Current:** API pin remains `2025-10` / `October25` (D-007); planning PR does not change version.
2. **Proposed:** Before the first Phase 1 sync implementation merges: validate Phase 1 GraphQL documents and webhook fixtures against the current stable Admin API; approve and record the selected version; avoid building on a near-retirement version; keep every inventory mutation excluded.
3. **Reason:** Sync foundation must not be built on invalid or retiring operations.
4. **Merchant impact:** None immediate.
5. **Technical impact:** Validation evidence before sync PRs.
6. **Migration:** None in planning.
7. **Risks:** Building sync on retiring/invalid API shapes.
8. **Final:** **APPROVED AND EFFECTIVE FOLLOWING PR #9 MERGE** (2026-07-30; reviewed scope head `835088d3c0294222b14d67a5875709f299062439`). Approved API-validation gate; does not itself select or change an API version.

## D-024 — Concurrent tenant compatibility-index deployment (PR 1 correction)

1. **Current (rejected PR 1 attempt):** Ordinary `CREATE INDEX` / `CREATE UNIQUE INDEX` with `IF NOT EXISTS` inside Prisma Migrate on merchant tables.
2. **Proposed / accepted:** Ordinary non-concurrent compatibility-index creation on populated merchant tables is **rejected**. Same-name `IF NOT EXISTS` is **not** evidence that an index is valid or correctly defined. PR 1 compatibility indexes require `CREATE INDEX CONCURRENTLY` / `CREATE UNIQUE INDEX CONCURRENTLY` outside an incompatible migration transaction, plus exact catalog pre/post verification (`indisvalid`, definition, uniqueness, table, columns). Production execution remains unauthorized. No major Prisma upgrade is authorized in this correction. Phase 1 product scope is unchanged.
3. **Reason:** Claude F-PR1-05 / F-PR1-06; product-owner rejection of the ordinary-index deviation.
4. **Merchant impact:** Avoids write-blocking DDL and silently accepted INVALID unique indexes.
5. **Technical impact:** `20260730160100` rewritten to no-op; `scripts/tenant-indexes/` + CI apply/verify/drift.
6. **Migration:** Additive tooling; unmerged migration file rewritten in place with documented rationale.
7. **Risks:** Operators must run index tooling after migrate; residual until fresh Claude review accepts corrected head.
8. **Final:** **Accepted for PR 1 corrections** (2026-07-30). Does not authorize production deployment.

## D-025 — Phase 1 PR 1 technical acceptance (awaiting explicit user merge authorization)

1. **Current:** Draft PR [#11](https://github.com/Vedang1998/Stocky/pull/11) (`phase-1/tenant-expand`) delivered the Phase 1 PR 1 tenant-expansion and backfill foundation through multiple correction waves. Capable-local independent Claude Code review on 2026-07-31 at head `28e77178602ca486e5138ca2f80e8947d8e113c0` (base `8ccc8d29a78e05615b31324b38df17f4f1d1296e`) returned **`READY FOR CHATGPT PR 1 ACCEPTANCE`** (preserved verbatim in `phases/phase-1/PR1_TENANT_EXPANSION_CAPABLE_LOCAL_REVIEW_REPORT.md`). Exact-head CI run `30633301468` / job `91164602626` concluded `success` on that same head.
2. **Proposed / accepted:** ChatGPT product-owner decision: **`PR 1 ACCEPTED`**. Technical acceptance of the independently reviewed implementation head is recorded. Merge status: **not authorized and not merged**. PR #11 remains open, draft, and unmerged pending **explicit user merge authorization**.
3. **Reason:** Capable-local review independently re-executed the required suite (PostgreSQL 16, Prisma engines, shopify.dev, authenticated GitHub evidence), closed the F-F00 environment gate for this review, and found no remaining P0 or P1 correction for PR 1 scope.
4. **Merchant impact:** No merchant-visible production change from this decision alone. No deployment, production backfill, or inventory mutation is authorized.
5. **Technical impact:** Documentation finalization only after the reviewed head. The independently reviewed implementation tree at `28e77178602ca486e5138ca2f80e8947d8e113c0` is accepted as the PR 1 technical baseline. Residual gates remain open: **F-016 / R-022 / Q-011** (database-enforced isolation), **R-014** (exact money), actual operational backfill / zero-unresolved evidence, dependency hardening (**R-013 / R-062**), and inventory-write release gates.
6. **Migration:** No schema or runtime change in the acceptance/finalization record. Production migration/backfill remains unauthorized until a later reviewed deployment plan and explicit authorization.
7. **Risks:** Technical acceptance must not be misread as deployment, production backfill, RLS activation, inventory-write enablement, PR 2, PR 3, or merge authorization.
8. **Final:** **ACCEPTED for PR 1 technical scope** (2026-07-31). Explicitly does **not** authorize deployment, production backfill, RLS activation, inventory mutations, PR 2, PR 3, or merge. Inventory writes remain **UNAPPROVED**. Every inventory-write flag remains **DEFAULT OFF**. PR 2 and PR 3 remain **NOT STARTED**.

## D-026 — Phase 1 PR 1 merge closure

1. **Current:** PR [#11](https://github.com/Vedang1998/Stocky/pull/11) was technically accepted under D-025 and then authorized for merge at exact head `6e5b024254615f3259aeb8d8252305d86bd63777`.
2. **Proposed / accepted:** PR #11 was **squash-merged** to `main` as `44a24f3387c1dae0351490367c06bef10f333425` at `2026-07-31T22:19:49Z`. Phase 1 PR 1 is **merged and closed**. PR 1 acceptance and merge do **not** mean Phase 1 is complete. PR 2 is the next approved dependency-ordered unit and must start from updated `main` on branch `phase-1/tenant-access`. PR 2 implementation has **not started**. PR 3 implementation has **not started**.
3. **Reason:** Record permanent GitHub closure of the PR 1 workflow after explicit user squash-merge, without authorizing later Phase 1 work, deployment, or inventory writes.
4. **Merchant impact:** No production or merchant-data change from this documentation decision. No deployment or production migration is authorized by this decision.
5. **Technical impact:** Main now includes the PR 1 tenant-expansion and backfill foundation at squash SHA `44a24f3387c1dae0351490367c06bef10f333425`. Residual gates remain open: **F-016 / R-022 / Q-011**, **R-014**, operational backfill / zero-unresolved evidence, dependency hardening, and inventory-write release gates.
6. **Migration:** No additional schema or runtime change in this status-sync decision. Production migration/backfill remains unauthorized until a later reviewed deployment plan and explicit authorization.
7. **Risks:** Merge of PR 1 tooling must not be misread as Phase 1 completion, PR 2/PR 3 start, production backfill completion, RLS/runtime activation, or inventory-write approval. **R-028** and **R-029** remain open operational/enforcement-transition risks.
8. **Final:** **ACCEPTED** (2026-07-31). PR 1 is merged and closed. Phase 1 remains in progress. PR 2 and PR 3 remain **NOT STARTED**. Inventory writes remain **UNAPPROVED**. Every inventory-write flag remains **DEFAULT OFF**. No deployment or production migration is authorized by this decision.

## D-027 — Phase 1 PR 2 tenant-bound access contract

1. **Current:** Runtime merchant access used unrestricted global Prisma plus legacy `shop` string filters derived from `session.shop` / webhook payloads. PR 1 added nullable `shopId` and backfill tooling but did not convert runtime access.
2. **Proposed:** PR 2 is authorized from `main@04289d61f605414597ac85f47830a3c9d2f9e33d` on branch `phase-1/tenant-access`. Canonical tenant authority comes only from verified Shopify authentication or validated server-created job transport (`tenant-job-envelope-v1`). Client-supplied shop identifiers are never authority. Runtime merchant access must go through the tenant-bound contract. Raw Prisma is restricted to approved infrastructure/maintenance exceptions. Bootstrap is limited to Session, Shop, and narrow canonical Shop enumeration. Mechanically generated inventory + CI architecture audit enforce the boundary.
3. **Reason:** Establish application-level tenant authority and scoped DB access before PR 3 adds RLS, roles, non-null constraints, and composite FKs.
4. **Merchant impact:** No intentional product-behavior redesign. Safer tenancy for routes/services/workers. No deployment or production backfill authorized.
5. **Technical impact:** `app/tenant/**` contract; route/service/job conversion; scanner under `scripts/tenant-access/`; CI gates `tenant:access:audit`, `tenant:access:inventory:check`, `test:tenant-access`.
6. **Migration:** No schema migration in PR 2. No production backfill. Nullable `shopId` remains until PR 3 / operational backfill gates.
7. **Risks:** Application scoping is necessary but not sufficient without PR 3 DB enforcement. Job envelope persistence/replay remain PR 4 (R-039 not fully closed). Inventory writes remain unapproved.
8. **Final:** **AUTHORIZED FOR PR 2 IMPLEMENTATION — PENDING INDEPENDENT REVIEW AND CHATGPT ACCEPTANCE**. Explicitly does **not** implement RLS, roles, non-null constraints, composite FKs, or production backfill. PR 3 remains the hard database-enforcement gate. PR 4 retains database-backed queue/control-plane persistence and durable replay. Inventory writes remain **UNAPPROVED**. Every inventory-write flag remains **DEFAULT OFF**.

## D-028 — Phase 1 PR 2 corrections required

1. **Current:** Independent Claude Code review of PR 2 implementation head `6f9ca22c069a46003b6944ff56c888ff91e95cdc` issued verdict **`NOT READY — CORRECTIONS REQUIRED`** with three P1, three P2, and three P3 findings (F-PR2-01..09). Report preserved verbatim in `PR2_TENANT_ACCESS_REVIEW_REPORT.md`.
2. **Proposed:** All P1 and P2 findings are mandatory corrections on draft PR #13 / `phase-1/tenant-access`. P3 items require documentation correction and evaluated webhook disposition without unapproved schema. PR 2 remains unaccepted. PR #13 remains draft and unmerged. PR 3 remains not started. No deployment, RLS, production backfill, or inventory writes are authorized.
3. **Reason:** Application-layer tenant bypasses (nullable ownership invisibility, unscoped nested relations, unsigned job envelopes) and scanner/client-hint/nested-write gaps must be corrected before acceptance.
4. **Merchant impact:** Corrections restore visibility of nullable PR 1 rows, prevent cross-tenant relation disclosure, and cryptographically authenticate worker transport. No production data access.
5. **Technical impact:** TenantDb compatibility scope + recursive relation/nested-write validation; HMAC job envelopes; scanner completeness; client-hint traversal; CI Redis + envelope secret; expanded PostgreSQL/Redis tests.
6. **Migration:** No schema migration. No production backfill. No RLS/roles/non-null/composite FKs.
7. **Risks:** R-064..R-067 track correction areas pending independent verification. F-016/R-022/Q-011 remain open for PR 3. R-039 persistence remains PR 4.
8. **Final:** **AUTHORIZED FOR PR 2 CORRECTION IMPLEMENTATION — PENDING INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE**. PR 2 remains **unaccepted**. PR #13 remains **draft and unmerged**.

## D-029 — Phase 1 PR 2 follow-up corrections required

1. **Current:** Independent Claude Code correction review of first corrected head `e6a9a06a8a399bbfb17687399c59582f1712f442` issued verdict **`NOT READY — FURTHER CORRECTIONS REQUIRED`** with three P1, five P2, and three P3 findings (F-PR2C-01..11). Report preserved at `b5fbd2bd346dee1730500be46d47c4fb164fd788` (`PR2_TENANT_ACCESS_CORRECTION_REVIEW_REPORT.md`). F-PR2-03 remains closed. F-PR2-07..09 remain closed/documented.
2. **Proposed:** Mandatory follow-up corrections on draft PR #13 / `phase-1/tenant-access` covering model-aware nested selectors, connectOrCreate global-match fail-closed, array nested mutations, normalization-aware legacy shop, partial-select proof fields, real single-row update, scanner provenance, large-payload hint limits, write atomicity, evidence correction, and exact allowlist matching. PR 2 remains unaccepted. PR #13 remains draft and unmerged. PR 3 remains not started.
3. **Reason:** Demonstrated application-layer cross-tenant nested mutations and product regressions remain after the first correction wave.
4. **Merchant impact:** Prevents cross-tenant re-parenting of supplier mappings / lead-time snapshots / transfer and stocktake lines; restores visibility of normalizable legacy shop rows; prevents denial of ordinary large PO/stocktake payloads.
5. **Technical impact:** `selectors.ts` / `legacy-scope.ts` / TenantDb rewrite; scanner constant-folding; client-hint budget raise; CI focused suites; documentation D-029.
6. **Migration:** No schema migration. No production backfill. No RLS/roles/non-null/composite FKs.
7. **Risks:** R-064..R-067 and new follow-up risks remain `implemented — pending independent verification`. F-016/R-022/Q-011 remain open for PR 3. R-039 persistence remains PR 4.
8. **Final:** **AUTHORIZED FOR PR 2 FOLLOW-UP CORRECTION IMPLEMENTATION — PENDING SECOND INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE**. PR 2 remains **unaccepted**. PR #13 remains **draft and unmerged**. No deployment, production backfill, RLS, or inventory writes are authorized.
