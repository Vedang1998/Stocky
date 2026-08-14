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

## D-030 — Phase 1 PR 2 third correction cycle required

1. **Current:** Independent Claude Code second correction review of implementation head `99d7a2bb73e77f62bd4ed0029961b40ab04a08e0` issued verdict **`NOT READY — FURTHER CORRECTIONS REQUIRED`** with **P0: 0 · P1: 3 · P2: 3 · P3: 4** findings (F-PR2R2-01..10). Report preserved at `fed21a48a5ae77a61f62b5bd899c698c48a68f49` (`PR2_TENANT_ACCESS_FOLLOWUP_CORRECTION_REVIEW_REPORT.md`). No cross-tenant read or write was reproduced. Signed job envelopes, nested-selector denial, array nested isolation, update projections, serializable writes, raw-Prisma scanner provenance, exact allowlist matching, and default-off inventory-write gates remain closed.
2. **Proposed:** Mandatory third correction cycle on draft PR #13 / `phase-1/tenant-access` covering top-level compound-unique selector flattening, scalable tenant predicates (no owned-row-ID materialization), row-level unprovable relation nulling/filtering, `connectOrCreate` sibling merge, unified D-030 ownership, LeadTimeSnapshot lineage proof, UTF-8 body-byte accounting, key-specific shop hints, issuer-alias scanner coverage, and permanent evidence/CI corrections.
3. **Revised canonical ownership rule (supersedes prior non-null shopId + legacy-agreement conflict rule):**
   - **Non-null `shopId` = current tenant:** row is owned. Legacy `shop` is non-authoritative compatibility data and must not hide a canonically owned row (missing/empty/malformed/uppercase/whitespace/URL/path/non-Shopify/conflicting domain). Do not silently repair legacy `shop`.
   - **Non-null `shopId` = another tenant:** denied.
   - **Null `shopId`:** normalized legacy `shop` must equal the authenticated canonical domain under exact `phase1-shop-domain-v1` semantics. Malformed/absent/foreign legacy evidence remains unprovable and denied.
   - **Child rows:** owned only when (1) verified parent is tenant-owned and (2) child `shopId` is the current tenant ID or null under the verified-parent compatibility path. Foreign non-null child `shopId` always fails closed.
4. **Reason:** The tenant-isolation posture is materially stronger, but the tenant-bound contract remains functionally unreliable for normal merchant workflows and realistic data scale (compound selectors broken, bind-parameter cliff at ≥32,766 owned rows, whole-query denial on one unprovable relation).
5. **Merchant impact:** Restores live owned workflows that currently throw `PrismaClientValidationError`; removes hard failure once a merchant model exceeds PostgreSQL bind limits; keeps owned parent lists usable when one included relation is unprovable (relation becomes null / filtered, parent preserved).
6. **Technical impact:** `selectors.ts` top-level unique resolver; `legacy-scope.ts` scalable predicates + D-030 unification; TenantDb relation nulling/merge; client-hint byte accounting; scanner issuer aliases; focused CI file gates; documentation D-030.
7. **Migration:** No schema migration. No production backfill. No ownership repair. No RLS/roles/non-null/composite FKs/tenant-key triggers. Nullable `shopId` remains until PR 3 / operational backfill gates.
8. **Risks:** R-064..R-067 and third-cycle risks remain `implemented — pending independent verification`. F-016/R-022/Q-011 remain open for PR 3. R-039 persistence remains PR 4. Inventory writes remain unapproved.
9. **Final:** **AUTHORIZED FOR PR 2 THIRD CORRECTION IMPLEMENTATION — PENDING THIRD INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE**. PR 2 remains **unaccepted**. PR #13 remains **draft and unmerged**. PR 3 remains **not started**. No deployment, production backfill, RLS, or inventory writes are authorized.

## D-031 — Phase 1 PR 2 fourth correction cycle required

1. **Current:** Independent Claude Code third correction review of handoff head `fec8500095197798be183d08b3dd004632adba80` issued verdict **`NOT READY — FURTHER CORRECTIONS REQUIRED`** with **P0: 0 · P1: 0 · P2: 3 · P3: 4** findings (F-PR2R3-01..07). Report preserved at `000e53cdae6cd39b690fc8107d7d3f4f4791adf1` (`PR2_TENANT_ACCESS_THIRD_CORRECTION_REVIEW_REPORT.md`). Third-cycle runtime/test implementation head was `d7058294af7eb3d8f287f48cd0657a74475892e7`. **No cross-tenant read or write was reproduced.** All twelve prior security regressions remain closed. Remaining defects are bounded execution, selector intent, normalization equivalence, and evidence accuracy.
2. **Proposed:** Mandatory fourth correction cycle on draft PR #13 / `phase-1/tenant-access` covering:
   - **F-PR2R3-01:** versioned `phase1-legacy-evidence-v1` bound on distinct null-ownership legacy representations (default 1024; absolute safe max far below PostgreSQL’s ~32,765 bind ceiling); fail closed with `legacy_evidence_overflow` — never silently omit null-owned rows, never send near-limit `in` lists, never disclose raw forms;
   - **F-PR2R3-02:** reject foreign tenant-bearing unique selectors with `foreign_selector_tenant` instead of coercing them onto the authenticated shop;
   - **F-PR2R3-03:** one shared `phase1-shop-domain-v1` normalization specification; SQL candidate discovery must use the exact ECMAScript trim code-point set; JS remains final authority;
   - **F-PR2R3-04:** honest focused CI naming and dedicated bulk-mutation / relation consistency suites;
   - **F-PR2R3-05:** correct third-cycle commit count (`fed21a48…`..`fec8500…` = **11**, not 12; prior prompt expected count was incorrect; merge base exact; no history rewrite);
   - **F-PR2R3-06:** correct permanent head identity (runtime/test `d7058294…`, reviewed handoff `fec8500…`, report-only `000e53c…`; `bab5fe90…` was an intermediate green documentation tip only);
   - **F-PR2R3-07:** accept synthetic Redis-history residual (`dump.rdb` blob reachable; no secret rotation or history rewrite).
3. **Ownership rule:** D-030 remains unchanged — non-null current-tenant `shopId` owned regardless of legacy shop; non-null foreign `shopId` denied; null `shopId` requires normalized legacy match under `phase1-shop-domain-v1`.
4. **Reason:** Isolation posture is materially correct; acceptance is withheld for controlled fail-closed overflow, selector-intent integrity, SQL/JS normalization equivalence, and documentary accuracy.
5. **Merchant impact:** Prevents uncontrolled PostgreSQL bind failures on corrupt/excessive null-ownership evidence; prevents silent wrong-row mutation from foreign selectors; restores visibility of null-owned rows whose raw forms use ECMAScript whitespace beyond spaces; improves evidence honesty for reviewers.
6. **Technical impact:** `legacy-scope.ts` overflow bound; `selectors.ts` / `tenant-db.server.ts` tenant-intent validation; `shop-domain.ts` shared trim specification; focused PostgreSQL suites; CI file gates; documentation D-031 / R-072..R-074.
7. **Migration:** No schema migration. No production backfill. No ownership repair. No RLS/roles/non-null/composite FKs/tenant-key triggers. Nullable `shopId` remains until PR 3 / operational backfill gates.
8. **Risks:** R-072 (legacy evidence overflow), R-073 (tenant-bearing selector coercion), R-074 (normalization implementation divergence) — correction implemented pending independent verification. F-016/R-022/Q-011 remain open for PR 3. R-039 persistence remains PR 4. Inventory writes remain unapproved.
9. **Final:** **AUTHORIZED FOR PR 2 FOURTH CORRECTION IMPLEMENTATION — PENDING FOURTH INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE**. PR 2 remains **unaccepted**. PR #13 remains **draft and unmerged**. PR 3 remains **not started**. No deployment, production backfill, RLS, schema change, or inventory writes are authorized.

## D-032 — Phase 1 PR 2 fifth correction cycle required

1. **Current:** Independent Claude Code fourth correction review of implementation handoff head `93e8044aea3958e8efe36f774e7d99ae6a0dd687` issued verdict **`NOT READY — FURTHER CORRECTIONS REQUIRED`** with **P0: 0 · P1: 1 · P2: 0 · P3: 4** findings (F-PR2R4-01..05). Report preserved at `6a73be7d23fd3bcbe19ebc30f65440e2c641093b` (`PR2_TENANT_ACCESS_FOURTH_CORRECTION_REVIEW_REPORT.md`). Fourth-cycle runtime/test implementation head was `21aba6660e71fa5af558d81499190ee8eb0e645e`. **No cross-tenant read or write was reproduced.** Overflow remains fail-closed; foreign tenant-bearing selectors remain rejected; nested writes remain atomic; exact-head CI was genuine; Redis-history residual remains accepted synthetic-only.
2. **Proposed:** Mandatory fifth correction cycle on draft PR #13 / `phase-1/tenant-access` covering:
   - **F-PR2R4-01 (P1):** resolve null-owned legacy rows through shop-bearing unique selectors using set-valued accepted raw representations; prevent silent upsert duplicate creation; fail closed on normalized ambiguity with `ambiguous_legacy_unique_selector`; fix live `after-auth` ShopSettings path;
   - **F-PR2R4-02 (P3):** correct permanent head identity (`21aba666…` runtime/test; `93e8044…` reviewed handoff; `6a73be7…` report-only; demote `ba5eee1…`);
   - **F-PR2R4-03 (P3):** document SQL candidate discovery as a bounded locale-sensitive superset; JS `phase1-shop-domain-v1` remains final authority;
   - **F-PR2R4-04 (P3):** strict evidence-limit configuration parsing with lazy validated singleton / test-only reset;
   - **F-PR2R4-05 (P3):** narrow and document overflow blast radius; two-stage canonical ID and `shopId_id` paths avoid unnecessary legacy discovery.
3. **Ownership rule:** D-030 remains unchanged — non-null current-tenant `shopId` owned regardless of legacy shop; non-null foreign `shopId` denied; null `shopId` requires normalized legacy match under `phase1-shop-domain-v1`.
4. **Reason:** Isolation posture is correct; acceptance is withheld for a merchant data-integrity defect (duplicate creation / wrong singleton settings) plus documentary and robustness residuals.
5. **Merchant impact:** Prevents silent duplicate `ShopSettings` (and other shop-bearing unique models) on auth when legacy rows use whitespace/case variants; preserves configured merchant settings; clarifies overflow and configuration failure modes.
6. **Technical impact:** `selectors.ts` / `tenant-db.server.ts` unique-selector resolution; `legacy-scope.ts` config + comments; focused PostgreSQL suites; CI file gates; documentation D-032 / D-033 / R-075..R-078.
7. **Migration:** No schema migration. No production backfill. No ownership repair. No RLS/roles/non-null/composite FKs/tenant-key triggers. Nullable `shopId` remains until PR 3 / operational backfill gates.
8. **Risks:** R-075 (legacy unique-selector duplicate creation), R-076 (locale-sensitive candidate discovery), R-077 (legacy evidence configuration parsing), R-078 (compatibility overflow blast radius) — correction implemented pending independent verification after this cycle. F-016/R-022/Q-011 remain open for PR 3. R-039 persistence remains PR 4. Inventory writes remain unapproved.
9. **Final:** **AUTHORIZED FOR PR 2 FIFTH CORRECTION IMPLEMENTATION — PENDING FIFTH INDEPENDENT CORRECTION REVIEW AND CHATGPT ACCEPTANCE**. PR 2 remains **unaccepted**. PR #13 remains **draft and unmerged**. PR 3 remains **not started**. No deployment, production backfill, RLS, schema change, or inventory writes are authorized.

## D-033 — Phase 1 PR 2 fifth correction cycle required (acceptance framing)

1. **Current:** Same reviewed head and report as D-032 (`93e8044…` / `6a73be7…`). One P1 and four P3 findings. No cross-tenant access was reproduced. Unique-selector duplicate creation is the acceptance blocker. SQL candidate discovery is a superset, not final authority.
2. **Proposed:** Implement F-PR2R4-01..05 under the D-032 authorization boundary; keep PR #13 draft and unaccepted; do not start PR 3; do not authorize schema, migration, backfill, RLS, or inventory writes.
3. **Reason:** Permanent framing for fifth-cycle acceptance triage after independent review.
4. **Merchant impact:** Same as D-032.
5. **Technical impact:** Same as D-032.
6. **Migration:** None authorized.
7. **Risks:** R-075..R-078 remain open until independently verified. Q-011 / F-016 / R-022 remain open.
8. **Final:** **FIFTH CORRECTION CYCLE AUTHORIZED — PENDING INDEPENDENT VERIFICATION**. PR #13 remains **draft and unaccepted**.

## D-034 — Phase 1 PR 2 technically accepted

1. **Current:** Independent Claude Code fifth correction review of exact implementation/handoff head `70f4a80aab2366108a71fd80320b0f824bfe0cce` issued verdict **`READY FOR CHATGPT PR 2 ACCEPTANCE`** with **P0: 0 · P1: 0 · P2: 0 · P3: 3** findings (F-PR2R5-01..03). First report-only commit was `7fcff5e14ae99aebae46496c7fadf138bca7166a` (Kelvin-sign cell incorrect). Authoritative corrected report commit is `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd` (`PR2_TENANT_ACCESS_FIFTH_CORRECTION_REVIEW_REPORT.md`). Neither report commit changed implementation code. No history rewrite is required. Fifth-cycle runtime/test tip label `5a69783…`; actual final runtime/test commit `0366658255ecbbd5e09168cbf43fbf135e2a2b33`; intermediate documented green tip `96c1029…` (not final handoff).
2. **Proposed / decided:** Grant **technical acceptance** of Phase 1 PR 2 application-layer tenant-bound access conversion at `70f4a80…`.
3. **Acceptance scope:** Technical implementation accepted. F-PR2R4-01..05 closed at the reviewed head. Accepted nonblocking P3 residuals: P3-A focused-test omissions independently covered; P3-B concurrent upsert retry exhaustion (R-079); P3-C head identity (`70f4a80…`, not `96c1029…`).
4. **Explicit non-authorization:** PR #13 is **not yet merge-authorized**. Final documentation synchronization and exact-head CI remain required after this decision record. PR 3 remains **not started**. F-016 / R-022 / Q-011 remain open implementation gates. No deployment or production backfill is authorized. No inventory write is authorized. Every inventory-write flag remains default OFF.
5. **Merchant impact:** Merchants gain a technically accepted application-layer tenant contract for ShopSettings and other shop-bearing unique models without silent duplicate creation; database-enforced isolation remains a later PR 3 gate.
6. **Technical impact:** Documentation-only acceptance finalization; no runtime, test, schema, migration, package, or CI workflow change authorized by this decision.
7. **Migration:** None.
8. **Risks:** R-075..R-078 closed for PR 2 at `70f4a80…`. R-079 remains open as an accepted reliability residual. R-013/R-062, R-014, R-022, R-024..R-027, and later-phase risks remain open. Q-011 remains open.
9. **Final:** **PHASE 1 PR 2 TECHNICAL IMPLEMENTATION ACCEPTED**. PR #13 remains **OPEN, DRAFT, UNMERGED**. Merge authorization is **NOT YET GRANTED**. Next action: ChatGPT exact-head verification and explicit user merge authorization after documentation-only finalization CI succeeds.

## D-035 — Phase 1 PR 2 merge closure

1. **Current:** PR [#13](https://github.com/Vedang1998/Stocky/pull/13) was technically accepted under D-034 and then explicitly authorized by the user for squash-merge at exact authorized head `5fc98192d2ca350de358316d9383e39103b98c80`.
2. **Proposed / accepted:** PR #13 was **squash-merged** to `main` as `e9c4f87eb28ce0e957a8cbd159719586892f8b98` at `2026-08-03T01:38:59Z`. Phase 1 PR 2 is **merged and closed**. Accepted implementation head remains `70f4a80aab2366108a71fd80320b0f824bfe0cce`. Authoritative independent review remains `ff3f9f6a6e9b57cde7df248553694a857b5bc6dd`. Final pre-merge exact-head CI: run `30776644228`, job `91573286240`, conclusion `success`, `head_sha` = authorized head.
3. **Reason:** Record permanent GitHub closure of the PR 2 workflow after explicit user squash-merge, without authorizing PR 3 implementation, deployment, production backfill, RLS, database roles, non-null `shopId`, composite tenant foreign keys, or inventory writes.
4. **Merchant impact:** No production or merchant-data change from this documentation decision. No deployment or production migration is authorized by this decision.
5. **Technical impact:** Main now includes the PR 2 application-layer tenant-bound access conversion at squash SHA `e9c4f87eb28ce0e957a8cbd159719586892f8b98`. Residual gates remain open: **F-016 / R-022 / Q-011**, **R-024 through R-027**, **R-014**, operational backfill / zero-unresolved evidence, **R-079**, dependency hardening (**R-013 / R-062**), and inventory-write release gates. PR 2 application-layer mitigation is merged; database enforcement remains absent until PR 3.
6. **Migration:** No additional schema or runtime change in this status-sync decision. Production migration/backfill remains unauthorized until a later reviewed deployment plan and explicit authorization.
7. **Risks:** Merge of PR 2 application scoping must not be misread as resolving F-016 / R-022 / Q-011, as Phase 1 completion, as PR 3 start, as production backfill completion, as RLS/runtime-role activation, or as inventory-write approval. **R-028** and **R-029** remain open operational/enforcement-transition risks. **R-079** remains open as an accepted reliability residual.
8. **Final:** **ACCEPTED** (2026-08-03). PR 2 is merged and closed. Phase 1 remains in progress. PR 3 remains **NOT STARTED**. This decision does **not** authorize PR 3 implementation by itself; PR 3 receives a separate ChatGPT implementation prompt after this sync is merged. Inventory writes remain **UNAPPROVED**. Every inventory-write flag remains **DEFAULT OFF**. No deployment or production migration is authorized by this decision.

## D-036 — Phase 1 PR 3 database enforcement authorized

1. **Current:** PR 1 and PR 2 are merged and closed. Application-layer TenantDb exists. Database enforcement (non-null shopId, composite tenant FKs, forced RLS, restricted runtime role, transaction-local context, immutability triggers) was not started.
2. **Proposed / accepted authorization:** Phase 1 PR 3 is authorized from starting main `00fb925721ad374b3ff976652ec99dbf655ebb11` on branch `phase-1/tenant-enforcement`. Scope is the approved database-enforcement unit only.
3. **Reason:** F-016 / R-022 / Q-011; D-012 through D-018; Phase 1 brief dependency-ordered PR sequence.
4. **Merchant impact:** None in production — production execution is not authorized by this decision.
5. **Technical impact:** Preflight, role provisioning, composite keys/FKs, FORCE RLS, immutability triggers, TenantDb transaction-local context, real PostgreSQL isolation tests, CI gates, runbook.
6. **Migration:** Low-lock external enforcement tooling; helper functions via Prisma migrate; production apply remains separately unauthorized.
7. **Risks:** R-024 through R-027 remain open until independently verified; R-028/R-029 operational transition; after RLS the pre-Phase-1 app is not a valid rollback target.
8. **Final:** **AUTHORIZED TO BEGIN** (2026-08-03). PR 3 remains pending implementation/review/acceptance. Production execution is not authorized. PR 4 remains blocked. Inventory writes remain UNAPPROVED. Inventory-write flags remain DEFAULT OFF. Q-011 / F-016 / R-022 must not be closed by Cursor alone.

## D-037 — Phase 1 PR 3 corrections required

1. **Current:** Independent Claude Code review of PR 3 at head `57016ed4b685c8958ad49d821f4afd9ea9894a9b` returned `NOT READY — CORRECTIONS REQUIRED` (P0:0 P1:6 P2:14 P3:9). Review-report-only commit: `ebcd0263ee726829f517d729abe601c7416a0952`. Actual last runtime/test implementation head before review: `0ee3ae027d746b9696c990dfbc59976f4ef56ae7`.
2. **Proposed / accepted:** Cursor must implement every finding in `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md` / `PR3_DATABASE_ENFORCEMENT_CORRECTION_BACKLOG.md` on branch `phase-1/tenant-enforcement` without merging, marking ready, deploying, or enabling inventory writes. Corrections include exact catalog definition verification, safe resumable apply ordering, role-membership detection, connected-identity separation, populated concurrency recovery, and honest evidence/runbook updates.
3. **Reason:** Verifiers could not detect policy/FK/trigger drift; partial apply could leave unrestricted runtime DML; forward recovery was broken; privileged role membership and semantic credential aliasing were undetected.
4. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent unsafe enforcement cutover states if/when later authorized.
5. **Technical impact:** Rewrite verification against `pg_policy` / `pg_constraint` / `pg_trigger` / `pg_auth_members` definitions; reorder apply so runtime merchant DML never exists without exact verified RLS; step-aware resume preflight; semantic URL + post-connect identity checks; adversarial and populated-scale tests; CI named correction steps.
6. **Migration:** Additive tooling and documentation only for this correction cycle; no destructive legacy-column removal; no production backfill; no guessed ownership repair.
7. **Risks:** New tracked risks for verifier blindness, unsafe partial-apply grants, unrecoverable partial enforcement, runtime privileged-role membership, semantic credential aliasing, and populated enforcement deadlock remain open until independently verified closed. Q-011 / F-016 / R-022–R-029 remain open. PR 4 remains blocked.
8. **Final:** **CORRECTIONS REQUIRED** (2026-08-03). Status after Cursor correction: `Correction implemented — pending independent verification`. Cursor correction commits begin at `b02d660` (backlog) through runtime tip `01cced4…` plus documentation tip on the same branch. Do not close findings or risks on Cursor evidence alone. PR #15 remains draft and unmerged. Inventory writes remain UNAPPROVED. R-080..R-085 track correction residuals.

## D-038 — Phase 1 PR 3 second corrections required

1. **Current:** Independent Claude Code correction review of PR 3 at handoff `cb9d04ebe1a99df2f8b4db0188efd20049c59633` returned `NOT READY — FURTHER CORRECTIONS REQUIRED` (P0:0 P1:2 P2:6 P3:9). Second review-report-only commit / required starting head: `7865e30cf6ab7a57aa0025f170f861c2a1233b28`. Actual last runtime/test implementation head from the first correction: `01cced426e8cbdfebb8580c20bfc4f2041713c59`.
2. **Proposed / accepted:** Cursor must implement every finding in `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md` / `PR3_DATABASE_ENFORCEMENT_SECOND_CORRECTION_BACKLOG.md` on branch `phase-1/tenant-enforcement` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 4. Corrections include invoking connected-identity verification in the real application runtime, verifying and controlling future-object default privileges, making verifiers strictly read-only, completing the privilege matrix, dedicated fault-recovery tests, resume-preflight drift distinction, honest populated concurrency evidence, and the nine P3 residuals.
3. **Reason:** Connected-identity assertion existed but was never called by the application; unsafe PostgreSQL default privileges can grant unrestricted runtime access to future tables before RLS; `roles:verify` mutated and erased PUBLIC schema-CREATE drift; named deadlock/timeout CI coverage was vacuous; resume preflight was silent on dangerous definition/privilege drift.
4. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent silent tenant-isolation bypass and undetectable future-table exposure if/when later authorized.
5. **Technical impact:** Shared runtime-database identity module wired into web/worker/TenantDb paths; `pg_default_acl` verification and explicit repair mode; read-only verify transactions; sequence and complete privilege allowlist; resume dangerous-drift acknowledgement; dedicated deadlock/timeout/cancellation suite; populated runtime-traffic lock evidence.
6. **Migration:** Additive tooling and documentation only for this correction cycle; no destructive legacy-column removal; no production backfill; no guessed ownership repair; no amend/rebase/force-push.
7. **Risks:** R-086..R-090 track second-correction residuals and remain open until independently verified. Q-011 / F-016 / R-022–R-029 / R-080–R-085 remain open. PR 4 remains blocked. Inventory writes remain UNAPPROVED. Inventory-write flags remain DEFAULT OFF.
8. **Final:** **SECOND CORRECTIONS REQUIRED** (2026-08-03). Status after Cursor work: `SECOND CORRECTION IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. Do not close findings or risks on Cursor evidence alone. PR #15 remains draft and unmerged. Production execution remains unauthorized.

## D-039 — Phase 1 PR 3 third corrections required

1. **Current:** Independent Claude Code second-correction review of PR 3 at implementation head `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` returned `NOT READY — FURTHER CORRECTIONS REQUIRED` (P0:0 P1:1 P2:3 P3:4). Review-report-only / required third-correction starting head: `440a93eaf2d87a9b8cf2c7390740d79be6453d05`. Current re-authorized base/main: `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86`. Synthetic merge tested: `fdd617ec314b81713d7d39b1a2756a4cc06b14c4` (parents `d58a897…` + `24cc4d8…`). Actual last runtime/test head before this cycle: `24cc4d8…` (not `046a3b1…`).
2. **Proposed / accepted:** Cursor must implement every remaining finding in `PR3_DATABASE_ENFORCEMENT_SECOND_CORRECTION_REVIEW_REPORT.md` / `PR3_DATABASE_ENFORCEMENT_THIRD_CORRECTION_BACKLOG.md` on branch `phase-1/tenant-enforcement` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 4. Corrections include non-superuser migration-owner role provisioning and full enforcement lifecycle, future-function default privilege safety, chain-of-custody correction, merchant-error classification, catalog qualification follow-up, password-fallback removal, stale allowlist cleanup, and PostgreSQL 16 creator-membership encoding.
3. **Reason:** Production-like non-superuser `CREATEROLE` migration owners cannot execute the current unconditional `ALTER ROLE … NOSUPERUSER/NOBYPASSRLS` path, so enforcement never installs; future functions remain PUBLIC/runtime executable with absent `pg_default_acl` treated as safe; merchant DML-denial errors are unclassified; live evidence mislabeled the runtime/test head.
4. **Merchant impact:** None in production — production execution remains unauthorized. Corrections unblock the documented staging/production-like rollout path and prevent undetectable future-function EXECUTE exposure and opaque denial-window evidence.
5. **Technical impact:** Role-attribute fail-closed bootstrap-repair codes; alterable-attribute-only ALTER ROLE; persistent safe function default privileges with effective-ACL verification; non-superuser CI lifecycle; structured merchant-error classification; catalog qualification; EX-RAW allowlist hygiene; PG16 creator membership invariants.
6. **Migration:** Additive tooling and documentation only for this correction cycle; no destructive legacy-column removal; no production backfill; no guessed ownership repair; no amend/rebase/force-push.
7. **Risks:** R-091..R-094 track third-correction residuals and remain open until independently verified. R-086..R-090 / Q-011 / F-016 / R-022–R-029 / R-080–R-085 remain open. PR 4 remains blocked. Inventory writes remain UNAPPROVED. Inventory-write flags remain DEFAULT OFF. PR #15 remains draft and unmerged.
8. **Final:** **THIRD CORRECTIONS REQUIRED** (2026-08-04). Status after Cursor work: `THIRD CORRECTION IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. Do not close findings or risks on Cursor evidence alone. Production execution remains unauthorized.

## D-040 — Phase 1 PR 3 technically accepted

1. **Current:** Independent Claude Code third-correction review of exact runtime/test implementation head `01dbb6fd97b38864894069dd3ee30524a236e764` issued verdict **`READY FOR CHATGPT PR 3 ACCEPTANCE`** with **P0: 0 · P1: 0 · P2: 0 · P3: 4** newly identified nonblocking residuals (P3-e..P3-h). Authoritative independent review-report commit is `a51f03bc33397692bf5901ce4e78b862fc84de9d` (`PR3_DATABASE_ENFORCEMENT_THIRD_CORRECTION_REVIEW_REPORT.md`). The reviewer made **no runtime change**. Live synthetic merge reviewed with parents `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` and `01dbb6fd97b38864894069dd3ee30524a236e764` (synthetic SHA itself is transient). All mandatory PR 3 findings from prior correction cycles are independently verified closed at `01dbb6f…`.
2. **Proposed / decided:** Grant **technical acceptance** of Phase 1 PR 3 database-enforcement repository implementation at `01dbb6f…`.
3. **Acceptance scope:** Technical repository implementation accepted. Mandatory PR 3 findings closed. Four newly identified P3 residuals (P3-e..P3-h → R-095..R-098) are **accepted as nonblocking** for technical acceptance and do not reopen PR 3 acceptance.
4. **Explicit non-authorization:** Technical acceptance did **not** itself authorize production execution, production migration, production backfill, ownership repair, deployment, or inventory writes. Every inventory-write flag remains default OFF. PR #15 was not merge-authorized by this decision alone. **PR 4 remained blocked** until PR 3 merge and closure synchronization.
5. **Merchant impact:** Merchants gain a technically accepted repository implementation of database-enforced tenant isolation on disposable/CI evidence; production activation remains separately gated under R-028 / R-029 and rollout authorization.
6. **Technical impact:** Documentation-only acceptance record; no runtime, test, schema, migration, package, or CI workflow change authorized by this decision.
7. **Migration:** None authorized by this decision. Production enforcement apply/backfill remains unauthorized.
8. **Risks:** R-022, R-024..R-027, and R-080..R-094 become eligible for repository-implementation closure upon merge closure (D-041). R-085 remains closed only for populated disposable evidence; production/staging rehearsal evidence stays open under R-028/R-029. Accepted nonblocking residuals tracked as R-095..R-098. R-028, R-029, R-079, R-013, R-014, and R-062 remain open.
9. **Final:** **PHASE 1 PR 3 TECHNICALLY ACCEPTED**. Merge required explicit user authorization after exact-head CI. Production enforcement, backfill, ownership repair, and inventory writes remained **unauthorized**. PR 4 remained **blocked** until PR 3 merge and this closure synchronization.

## D-041 — Phase 1 PR 3 merge closure

1. **Current:** PR [#15](https://github.com/Vedang1998/Stocky/pull/15) was technically accepted under D-040. The user explicitly authorized ready-for-review and squash merge. Final synchronized pre-merge PR head was `c88c9a74c50912cb79cd59b4bd7cbb08c2351157`. Final exact-head CI was workflow `CI`, run `30922984027`, job `92038054067`, conclusion `success`, `head_sha` = `c88c9a74c50912cb79cd59b4bd7cbb08c2351157`.
2. **Proposed / accepted:** PR #15 was **squash-merged** to `main` as `deef5d7c7881fb128121b8ff82fd0b2282fbee0b` at `2026-08-04T15:39:20Z`. PR #15 is **closed and merged**. Accepted runtime/test implementation remains `01dbb6fd97b38864894069dd3ee30524a236e764`. Authoritative independent review remains `a51f03bc33397692bf5901ce4e78b862fc84de9d`. The merge-from-main synchronization that produced the final PR head changed only governance files already present on main.
3. **Reason:** Record permanent GitHub closure of the PR 3 workflow after explicit user squash-merge, without authorizing production enforcement activation, production backfill, ownership repair, deployment, inventory writes, or PR 4.
4. **Merchant impact:** No production or merchant-data change from this documentation decision. No production migration, backfill, ownership repair, or inventory mutation occurred or is authorized by this decision.
5. **Technical impact:** Main includes the PR 3 database-enforcement repository implementation at squash SHA `deef5d7c7881fb128121b8ff82fd0b2282fbee0b`. Q-011 is closed for Phase 1 implementation. R-022, R-024..R-027, and R-080..R-094 are closed for Phase 1 repository implementation (with R-085 limited as below). R-028 and R-029 remain open operational gates. Accepted P3 residuals R-095..R-098 remain open for production-rehearsal maintenance. PR 4 is **not started**.
6. **Migration:** No additional schema or runtime change in this status-sync decision. No production enforcement apply, production backfill, or ownership repair occurred.
7. **Risks:** Merge of PR 3 repository enforcement must not be misread as production activation, production-scale rehearsal completion, Phase 1 completion, PR 4 start, ownership repair completion, or inventory-write approval. **R-028** and **R-029** remain open. **R-095** and **R-096** must be corrected before staging/production enforcement rehearsal. **R-098** must be corrected before using the CI role assertion as rollout evidence. **R-097** may be addressed in the same focused maintenance unit. All inventory-write flags remain default OFF.
8. **Final:** **PHASE 1 PR 3 MERGED AND CLOSED.** **PHASE 1 REMAINS IN PROGRESS.** **PR 4 IS NOT STARTED AND REQUIRES A SEPARATE CHATGPT AUTHORIZATION AFTER THIS CLOSURE PR IS MERGED.** Inventory writes remain **UNAPPROVED**. Every inventory-write flag remains **DEFAULT OFF**. No deployment or production migration is authorized by this decision.

## D-042 — Phase 1 PR 4 synchronization control plane authorized

1. **Current:** PR 1, PR 2, and PR 3 are merged and closed. Current starting `main` is `e69bc53d91db75472b0d0998bf1b74ee6246adb1` (PR 3 documentation merge-closure sync #19). PR 4 was blocked pending separate ChatGPT authorization after that closure.
2. **Proposed / accepted:** Authorize Phase 1 PR 4 implementation on branch `phase-1/sync-control-plane` for durable synchronization infrastructure only: persistent webhook intake; database-backed idempotency; durable jobs and attempts; reliable DB-to-Redis dispatch; dead letters; replay lineage; sync runs and cursors; reconciliation/data-issue records; deterministic sync-health states; immediate job denial after uninstall.
3. **Reason:** Redis/BullMQ retention is not durable idempotency; PR 2 envelopes expire after 24 hours; uninstall currently deletes sessions only; committed work can be lost across DB/Redis/process crash boundaries. PR 4 establishes the durable control plane before PR 5/6 fact synchronization.
4. **Merchant impact:** None in production — production execution remains unauthorized. Disposable/CI environments gain durable sync control-plane scaffolding only.
5. **Technical impact:** Additive Prisma migration for control-plane tables and Shop lifecycle fields; `tenant-job-envelope-v2`; control-plane database role; webhook intake that commits to PostgreSQL before Redis; dispatcher with `FOR UPDATE SKIP LOCKED`; worker lifecycle ledger; uninstall processing disable with database-enforced merchant-domain denial; Shopify Admin API pin target `2026-07`.
6. **Migration:** Additive only. Do not modify the original migration. Do not run production migrations. No destructive legacy cleanup. No inventory mutation. No catalog/order/refund fact implementation in this PR.
7. **Risks:** Open pending independent review: R-099..R-108. R-031, R-032, R-033, R-039 remain open until independent review. Do not modify accepted PR 3 residuals R-095..R-098 in this PR. Q-003 decision target is `2026-07`; implementation closure requires exact-head webhook and GraphQL validation. PR 5 remains blocked until PR 4 is independently reviewed, accepted, and merged.
8. **Final:** **PHASE 1 PR 4 AUTHORIZED FOR IMPLEMENTATION.** **PRODUCTION EXECUTION IS NOT AUTHORIZED.** **PR 5 REMAINS BLOCKED.** **INVENTORY WRITES REMAIN UNAPPROVED AND ALL INVENTORY-WRITE FLAGS REMAIN DEFAULT OFF.**

## D-043 — Phase 1 PR 4 corrections required

1. **Current:** Claude Code independently reviewed implementation head `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a` and recorded the preserved independent review-report head `944cd5922f12cccc73519e5cb4434985a296e923`. Verdict: **`NOT READY — CORRECTIONS REQUIRED`**. Four independently reproduced P1 defects block technical acceptance: (1) non-atomic business application permits duplicate merchant effects; (2) BullMQ retry dispatch is deduplicated but falsely acknowledged; (3) uninstall rolls back when a job is `DISPATCH_LEASED`; (4) crashed `RUNNING` attempts have no recovery and no database-enforced single-active-attempt invariant.
2. **Proposed / accepted:** Cursor must implement every finding in the correction scope on branch `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. The original independent review report `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md` remains **immutable**.
3. **Finding-count reconciliation:** The independent report’s declared totals (`4 P1 / 7 P2 / 4 P3`) are internally inconsistent with its finding headings (`4 P1 / 10 P2 / 6 P3`). Correction scope uses the **actual headings**: **4 P1, 10 P2, 6 P3** (20 findings). The independent report’s R-099…R-108 disposition labels do **not** align with the permanent definitions in `RISK_REGISTER.md`; correction review must use the permanent risk definitions.
4. **Correction scope:** All four P1 (`F-PR4-01`…`F-PR4-04`), all ten P2 (`F-PR4-05`…`F-PR4-08`, `F-PR4-11`…`F-PR4-13`, `F-PR4-18`…`F-PR4-20`), and all six P3 (`F-PR4-09`, `F-PR4-10`, `F-PR4-14`…`F-PR4-17`) findings.
5. **Reason:** Core durability and uninstall-denial claims are not satisfied; merchant-domain effects can duplicate; retry delivery can stall; uninstall can leave processing enabled; crashed workers can permanently strand events.
6. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent silent duplicate sales/inventory effects, lost retries, post-uninstall processing, and stranded durable events if/when later authorized.
7. **Technical impact:** Additive correction migration (`SyncApplicationReceipt`, `JobDispatch`, attempt leases/heartbeats, partial unique indexes, eligible-job indexes, control-plane RLS, state-transition trigger, webhook conflict/quarantine fields, nullable Shopify webhook ID handling); envelope `tenant-job-envelope-v3`; fair indexed dispatch; mechanical inventory scanner; focused correction test gates; documentation and risk updates.
8. **Migration:** Additive only. Do not edit `20260804180000_sync_control_plane/migration.sql`. No production execution. No destructive evidence drop.
9. **Risks:** Keep R-031, R-032, R-033, R-039, R-099…R-108 open pending independent correction review using permanent definitions. Add R-109…R-114 for newly identified residual classes. Do not alter R-095…R-098. Do not close findings or risks on Cursor evidence alone.
10. **Final:** **PHASE 1 PR 4 CORRECTIONS REQUIRED. ALL FOUR P1, ALL TEN P2, AND ALL SIX P3 FINDINGS ARE IN THE CORRECTION SCOPE. THE ORIGINAL INDEPENDENT REVIEW REPORT MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.

## D-044 — Phase 1 PR 4 second corrections required

1. **Current:** Claude Code independently reviewed the first-correction head ending at correction-review tip `4c15028f72be20e4138bdbf85bc5e1d3894b53c6` (first correction runtime/test `0697a2878eed3ce8013f59af54de7d0adf98d548`; original reviewed implementation `7c36bc1bf2a1d6ccbd0e9d7131ae2d692fefea7a`; unchanged base/main `e69bc53d91db75472b0d0998bf1b74ee6246adb1`). Verdict: **`NOT READY — CORRECTIONS REQUIRED`**. Two independently reproduced P1 defects block technical acceptance: (1) dispatcher acknowledges `ENQUEUED` when Redis retains a non-runnable terminal queue job; (2) attempt reaper throws on `NULL` `webhookDeliveryId`, stranding the job `RUNNING` and aborting batch recovery. Two P2 residuals (acceptance-test coverage shortfall; v1/v2 envelope receipt bypass) and four P3 residuals are in scope. F-PR4-01 residual (`25P02` receipt conflict classification) and F-PR4-18 / Q-003 remain open.
2. **Proposed / accepted:** Cursor must implement every finding in the second-correction scope on branch `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. The original independent review report `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md` and the first correction-review report `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md` remain **immutable**.
3. **Second-correction scope:** Blocking P1 `NEW-PR4-C01`, `NEW-PR4-C02`; mandatory P2 `NEW-PR4-C03`, `NEW-PR4-C04`; included P3 `NEW-PR4-C05`…`NEW-PR4-C08`. Also address the F-PR4-01 `25P02` residual via `ON CONFLICT DO NOTHING RETURNING` without claiming risk closure.
4. **Reason:** Core durable-dispatch and attempt-recovery claims from D-043 are not satisfied; retained BullMQ terminal jobs can permanently strand events; poison reaper rows can halt cluster-wide recovery; exactly-once and envelope fail-closed guarantees lack sufficient regression gates.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent silent stranded webhooks, halted attempt recovery, duplicate merchant effects via legacy envelopes, and opaque concurrent-receipt classification if/when later authorized.
6. **Technical impact:** Additive second-correction migration (`20260805120000_sync_control_plane_second_correction`); queue-presence runnable allowlist; atomic `ackEnqueued`; stranded ENQUEUED→RETRY_WAIT recovery; per-attempt reaper isolation + `application_outcome_uncertain`; expanded exactly-once/attempt-recovery/envelope tests; webhook-processor v1/v2 fail-closed; `completeAttemptFail` always dead-letters; migration fixture hygiene; `stocky_receipt_probe_owner` provision; status documentation for D-044.
7. **Migration:** Additive only. Do not edit `20260804180000_sync_control_plane` or `20260804210000_sync_control_plane_correction`. No production execution. No destructive evidence drop.
8. **Risks:** Keep R-099, R-104, R-109, R-039, R-102, R-107, R-112 open pending independent second-correction verification using permanent definitions. Keep Q-003 open. Do not alter R-095…R-098. Do not close findings or risks on Cursor evidence alone.
9. **Final:** **PHASE 1 PR 4 SECOND CORRECTIONS REQUIRED. NEW-PR4-C01 AND NEW-PR4-C02 ARE BLOCKING P1 DEFECTS. NEW-PR4-C03 THROUGH NEW-PR4-C08 ARE INCLUDED IN THE SECOND-CORRECTION SCOPE. THE ORIGINAL REVIEW AND FIRST CORRECTION-REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `SECOND CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.

## D-045 — Phase 1 PR 4 final corrections required

1. **Current:** Claude Code independently reviewed the D-044 second-correction / mechanical-completion head at reviewed runtime/test tip `b73a22f67afd9aa29995486afdfc52147c90fb9f` (exact-head CI run `31029829525` / job `92387401357` success). The independent second-correction review-report commit is `9d43ec9fce7a37b3b336972bbb41a4b0f34e83cd`. Unchanged base/main remains `e69bc53d91db75472b0d0998bf1b74ee6246adb1`. Verdict: **`NOT READY — CORRECTIONS REQUIRED`**. Finding totals: P0:0 P1:0 P2:1 P3:7 (NEW-PR4-SC01…SC08). Blocking P2: worker may finalize `SUCCEEDED` on `APPLICATION_ALREADY_APPLIED` without verifying a SyncApplicationReceipt after rollback. Seven P3 residuals (test Redis timeout production reachability, unbounded indeterminate DataIssue rows, nullable selector filter omission, unchecked FAILED→DEAD_LETTERED transition, unreachable BullMQ `paused` allowlist entry, chain-of-custody labelling, stranded attempt-budget / v2-v3 already-applied divergence) are included. F-PR4-18 / Q-003 remain open.
2. **Proposed / accepted:** Cursor must implement every finding in the final-correction scope on branch `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. The original review, first correction-review, and second-correction review reports remain **immutable**.
3. **Final-correction scope:** Blocking P2 `NEW-PR4-SC01`; included P3 `NEW-PR4-SC02`…`NEW-PR4-SC08`.
4. **Reason:** Exactly-once success must not be inferred from an error code alone when a matching winner receipt may be unreadable; production must not honor test Redis timeout controls; stranded recovery must consume a bounded attempt budget; documentation identity labels must distinguish implementation, review-report, and correction heads.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent unverified success after rollback, unbounded evidence growth, selector filter omission, silent terminalization failure, and unbounded stranded retries if/when later authorized.
6. **Technical impact:** Shared post-rollback receipt verification at Repeatable Read; v2/v3 finalize alignment; test-only Redis timeout gating; indeterminate evidence cooldown + advisory lock; null-sequence fail-closed; FAILED→DEAD_LETTERED RETURNING check; BullMQ allowlist without `paused`; stranded `attemptCount` budget; D-045 backlog/implementation report and status sync. No migration required for this cycle.
7. **Migration:** None. Do not edit existing migrations. No production execution.
8. **Risks:** Keep R-109, R-099, R-104, R-112, R-031/R-032/R-033 open pending independent final-correction verification. Keep Q-003 / F-PR4-18 open. Do not close findings or risks on Cursor evidence alone.
9. **Final:** **D-045 — PHASE 1 PR 4 FINAL CORRECTIONS REQUIRED. NEW-PR4-SC01 IS BLOCKING. NEW-PR4-SC02 THROUGH NEW-PR4-SC08 ARE INCLUDED. IMMUTABLE REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `FINAL CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.

## D-046 — Phase 1 PR 4 review corrections required

1. **Current:** Claude Code independently reviewed the D-045 final-correction implementation at reviewed runtime/test tip `c1c855494cefdca16d6d6571ebe8210a0cb94faf` (exact-head CI run `31064898219` / job `92500473785` success). The independent D-045 review-report commit is `ef452bb9e6c9e4dd48ce7d6dfbe9e9cf0e7738f2`. Unchanged base/main remains `e69bc53d91db75472b0d0998bf1b74ee6246adb1`. Verdict: **`NOT READY — CORRECTIONS REQUIRED`**. Finding totals: P0:0 P1:0 P2:2 P3:2 (NEW-CLAUDE-D045-01…04). P2: production-reachable queue-classification seam; SC01 v2/v3 CI gate does not execute `processWebhookJob` / RepeatableRead evidence. P3: stale D-045 runtime-head label; dead-letter path omits `attemptCount` persistence. F-PR4-18 / Q-003 remain open.
2. **Proposed / accepted:** Cursor must implement every finding in the D-046 scope on branch `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. All independent review reports remain **immutable**, including `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_REVIEW_REPORT.md`.
3. **Correction scope:** NEW-CLAUDE-D045-01 (P2), NEW-CLAUDE-D045-02 (P2), NEW-CLAUDE-D045-03 (P3), NEW-CLAUDE-D045-04 (P3).
4. **Reason:** Queue classification must not be overridable via a production-exported mutable seam; exactly-once worker evidence must execute real v2/v3 catch branches and RepeatableRead verification; chain-of-custody labels must distinguish runtime heads; stranded dead-letter paths must persist consumed attempt budget atomically.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent process-wide queue misclassification, overstated worker evidence, identity drift, and under-reported attempt consumption if/when later authorized.
6. **Technical impact:** Pure `classifyQueueState`; remove queue classification seam; genuine `processWebhookJob` v2/v3 matrix + RepeatableRead observation + truthful CI gates; persist `attemptCount` on stranded dead-letter `ENQUEUED → FAILED`; D-046 backlog/implementation report and status sync. No migration required.
7. **Migration:** None. Do not edit existing migrations. No production execution.
8. **Risks:** Keep R-109, R-099, R-104, R-112, R-031/R-032/R-033 open pending independent D-046 verification. Add R-115/R-116 for the new P2 findings pending verification. Keep Q-003 / F-PR4-18 open. Do not close findings or risks on Cursor evidence alone.
9. **Final:** **D-046 — PHASE 1 PR 4 REVIEW CORRECTIONS REQUIRED. ALL FOUR NEW-CLAUDE-D045 FINDINGS ARE IN SCOPE. IMMUTABLE REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `PR 4 D-046 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.

## D-047 — Phase 1 PR 4 focused operational claim / migrations guard corrections

1. **Current:** Claude Code independently focused-reviewed the P2-D046-01 / P3-D046-01 follow-up at exact head `b76fa2b63cb18cf2717a9269b7740decf0576bea` (exact-head CI run `31126856745` / job `92700945607` success). Immutable focused review commit `8050e278ec8396345b842a653c5559243454432b`. Verdict: **`CORRECTIONS REQUIRED`**. Finding totals for this focused review: P0:0 P1:0 P2:1 P3:2 (P2-NEW-D047-01, P3-NEW-D047-01, P3-NEW-D047-02). Original NEW-CLAUDE-D045-01…04 remain independently verified and undisturbed. Unchanged base/main remains `e69bc53d91db75472b0d0998bf1b74ee6246adb1`.
2. **Proposed / accepted:** Cursor must implement P2-NEW-D047-01 and P3-NEW-D047-01 on branch `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. All independent review reports remain **immutable**, including the focused follow-up report. P3-NEW-D047-02 (stale PR body) is corrected via PR description update when permissions allow.
3. **Correction scope:** P2-NEW-D047-01 (operational fair-claim path vs synthetic harness); P3-NEW-D047-01 (migrations `-t` zero-pass fail-closed).
4. **Reason:** F-PR4-11 must prove the production `claimBatchFair` statement at scale (PENDING+RETRY_WAIT, fairness, SKIP LOCKED), not a synthetic PENDING-only query. Migrations CI `-t` gates must fail closed on name drift like sync-integration.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent silent dispatch latency regression as DurableJob backlogs grow and vacuous migration CI gates.
6. **Technical impact:** Production-owned `fair-claim-query.server.ts`; bounded MATERIALIZED shop-seed + per-shop LATERAL claim; additive `DurableJob_shop_claim_*` indexes; operational EXPLAIN harness; migrations Vitest zero-pass reporter; D-047 backlog/implementation report and status sync.
7. **Migration:** Additive only — `20260806220000_sync_control_plane_d047_fair_claim_indexes`. Do not edit historical migrations. No production execution.
8. **Risks:** Preserve R-119 OPEN. Add R-120 for operational claim full-scan/sort risk pending independent verification. Keep Q-003 / F-PR4-18 open. Do not close findings or risks on Cursor evidence alone. Do not reopen NEW-CLAUDE-D045-01…04.
9. **Final:** **D-047 — PHASE 1 PR 4 FOCUSED OPERATIONAL CLAIM / MIGRATIONS GUARD CORRECTIONS REQUIRED. IMMUTABLE REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `PR 4 D-047 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.


## D-048 — Phase 1 PR 4 DispatchReadyShop fair-dispatch architecture corrections

1. **Current:** Claude Code independently reviewed D-047 corrections at exact head `cc1ff7e7a088f130372e7ead3bc2e679aee952fd` (merge base `e69bc53d91db75472b0d0998bf1b74ee6246adb1`). Immutable review commit `0cf08771e1e43d02bc9d9bded2a92109b9997c6e`. Verdict: **`CORRECTIONS REQUIRED`**. Blocking P2: Shop O(N) discovery (R01), indefinite starvation (R02), blocking index rollout (R03), concurrent underfill (R04). P3 residuals R05–R13. D-045/D-046 findings intact.
2. **Proposed / accepted:** Cursor must implement D-048 on `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. All independent review reports remain **immutable**, including the D-047 review report (cherry-picked unchanged).
3. **Correction scope:** P2-D047-R01…R04; P3-D047-R05…R13 (R08 retain-deferred; R09 retain-with-documentation).
4. **Reason:** Fair dispatch must not scan total Shop rows; fairness must guarantee eventual progress; concurrent dispatchers must take disjoint readiness windows; hot-table indexes require concurrent pre-creation.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent merchant-scale dispatch latency growth, silent shop starvation, write-blocking index builds, and underfilled concurrent dispatch.
6. **Technical impact:** `DispatchReadyShop` readiness/fairness relation + triggers; rewritten production fair-claim SQL; concurrent claim-index tooling; hardened plan gate; source-boundary identity guard; isolated migration name-filter probes; reporter unit tests; D-048 backlog/implementation report and status sync.
7. **Migration:** Additive only — `20260807010000_sync_control_plane_d048_dispatch_ready_shop`. Do **not** edit historical D-047 migration. No production execution.
8. **Risks:** Preserve R-119 and R-120 OPEN. Add R-121 (readiness false-negative / drift) and R-122 (range-pair planner residual) pending independent verification. Keep Q-003 / F-PR4-18 open. Do not close findings or risks on Cursor evidence alone. Do not reopen NEW-CLAUDE-D045-01…04.
9. **Final:** **D-048 — PHASE 1 PR 4 DISPATCHREADYSHOP FAIR-DISPATCH ARCHITECTURE CORRECTIONS REQUIRED. IMMUTABLE REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `PR 4 D-048 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.

## D-049 — Phase 1 PR 4 monotonic fail-safe readiness + nextDispatchAt scheduling

1. **Current:** Claude Code independently reviewed D-048 at exact head `8866a8d67df63bccd23cccef71cd256433a86c7b` (merge base `e69bc53d91db75472b0d0998bf1b74ee6246adb1`). Immutable review commit `80955af334c761d3a0299c7ec755f4353186279c` (incorporated blob `0de12503787c4c056cd097445e5e2db3d6a8339a`). Verdict: **`CORRECTIONS REQUIRED`**. P1 F-D048-01 false-negative readiness races; P2 F-D048-02/03/05; P3 F-D048-04/06. R-121 materialized.
2. **Proposed / accepted:** Cursor must implement D-049 on `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. Immutable review reports remain unchanged.
3. **Correction scope:** F-D048-01…06 with required architecture: monotonic LEAST readiness; persisted `nextDispatchAt` scheduling key + matching index; strict fairness forward movement; bounded ground-truth reconcile + refill; shopId immutability; single-shop-per-tx enforcement or structural deadlock freedom; deadlock-timeout harness fix.
4. **Reason:** False negatives hide due merchant work; active-due Seq/Bitmap/Sort defeats merchant-scale dispatch; heal_empty was dead; multi-shop writers deadlock; shopId mutation leaves stale readiness; CI flake is harness-only.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent hidden due work, O(active-due) scheduling, permanent fairness-slot consumption, and latent deadlocks.
6. **Technical impact:** Additive D-049 migration; rewritten maintain trigger + fair-claim SQL; claimBatchFair refill; transition-guard shopId immutability; plan gates; adversarial tests; D-049 backlog/implementation report and status sync.
7. **Migration:** Additive only — `20260807150000_sync_control_plane_d049_dispatch_schedule`. Do **not** edit historical D-047/D-048 migrations. No production execution.
8. **Risks:** Preserve R-119…R-122 OPEN. Record R-121 materialized as F-D048-01. Add R-123 (F-D048-05) and R-124 (F-D048-06). Keep Q-003 / F-PR4-18 open. Do not close findings on Cursor evidence.
9. **Final:** **D-049 — PHASE 1 PR 4 MONOTONIC READINESS + NEXTDISPATCHAT SCHEDULING CORRECTIONS REQUIRED. IMMUTABLE REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Status after Cursor work: `PR 4 D-049 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`. PR #20 remains **OPEN, DRAFT, UNMERGED**.

## D-050 — Phase 1 PR 4 split claim/reconcile snapshots + statement-level readiness

1. **Current:** Claude Code independently reviewed D-049 at exact head `2b177152ed06c01a36025fbfc4f6a1f1eaa30969` (merge base `e69bc53d91db75472b0d0998bf1b74ee6246adb1`). Immutable review cherry-pick `30955f844967e79523d543d245a4b58b70cbdc66` (incorporated blob `aa713ad37147e8b9ca1eadfdc60c1c0f50a7ec8f`, SHA256 `5fd063181dde9e87b32f39f621813045827df905806309e61c393bc96e446bd0`). Verdict: **`CORRECTIONS REQUIRED`**. P1 F-CLAUDE-D049-01 claim/reconcile same-statement snapshot permanently deletes readiness; P1 F-CLAUDE-D049-02 single-shop GUC breaks cross-shop expired-lease recovery; P2 F-CLAUDE-D049-03/04; P3 F-CLAUDE-D049-05/06. Accidental post-review `__nonexistent__` metadata commits verified app/runtime-empty and cleaned at `b81c2497ed1d705d690814324f05bf1b0019d5b2` without history rewrite.
2. **Proposed / accepted:** Cursor must implement D-050 on `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. Immutable review reports remain unchanged (including the D-049 review report).
3. **Correction scope:** F-CLAUDE-D049-01…06 with required architecture: split A scheduler / B candidates / C lease / D fresh-snapshot reconcile; statement-level transition-table triggers; advisory xact lock; GUC removed; bounded expired-lease recovery; truthful SKIP LOCKED examined bound; preserved healthy fairness bound + degraded stale bound; approved 1s urgent-arrival anti-reset max and +1ms fairness floor. PostgreSQL forbids transition tables with column lists — use `AFTER UPDATE` without column list and filter inside.
4. **Reason:** Same-statement heal deletes readiness from a stale READ COMMITTED snapshot and permanently hides due merchant work; GUC correctness boundary aborts legitimate multi-shop expired-lease recovery; examined-row claims under SKIP LOCKED were overstated; healthy starvation bound must not be conflated with stale-contaminated repair.
5. **Merchant impact:** None in production — production execution remains unauthorized. Corrections prevent permanent false-negative readiness, platform aborts during lease recovery, and misleading contention bounds.
6. **Technical impact:** Additive D-050 migration; split fair-claim SQL builders; statement-level readiness triggers + advisory serialization; expired-lease recovery without GUC; adversarial D-050 tests; D-050 backlog/implementation report and status sync.
7. **Migration:** Additive only — `20260811190000_sync_control_plane_d050_split_claim_statement_triggers`. Do **not** edit historical D-047/D-048/D-049 migrations. No production execution.
8. **Risks:** Preserve R-119…R-124 OPEN. R-121 remains MATERIALIZED. Add R-125 (F-CLAUDE-D049-01) and R-126 (F-CLAUDE-D049-02) pending independent verification. Keep Q-003 / F-PR4-18 open. Do not close findings on Cursor evidence.
9. **Final:** **D-050 — PHASE 1 PR 4 SPLIT CLAIM/RECONCILE + STATEMENT-LEVEL READINESS CORRECTIONS REQUIRED. IMMUTABLE REVIEW REPORTS MUST REMAIN UNCHANGED. PR 5 REMAINS BLOCKED. PRODUCTION EXECUTION AND INVENTORY WRITES REMAIN UNAUTHORIZED.** Independently reviewed implementation head: `62f4cff0ec2c0ec9542959fb65be29b26997e603`. Independent review commit `2e1fc3995614baf28d3fba1be59163d0be95096c` (incorporated blob `8247d8aea868818b8e904d196fee1a80fad283f5`). Verdict: **`APPROVE D-050 CORRECTION CLOSURE`** for the two P1 defects D-050 was created to repair. That approval is **not** PR 4 acceptance. D-051 corrections are required before PR 4 may be considered ready.

## D-051 — Phase 1 PR 4 per-shop readiness lock scope (close global convoy)

1. **Current:** Claude Code independently reviewed D-050 at exact head `62f4cff0ec2c0ec9542959fb65be29b26997e603` (merge base `e69bc53d91db75472b0d0998bf1b74ee6246adb1`). Immutable review cherry-pick `2e1fc3995614baf28d3fba1be59163d0be95096c` (incorporated blob `8247d8aea868818b8e904d196fee1a80fad283f5`). Verdict: **`APPROVE D-050 CORRECTION CLOSURE`** with one open P2 and two P3s carried forward. P2 F-CLAUDE-D050-01: global readiness advisory lock serializes unrelated merchants (control 530→3,258 tps from concurrency 1→100; intake 859→peak 1,689 then 1,229 tps; lease recovery 373→320 tps; recovery p99 ~864.9 ms / max ~1,008 ms at concurrency 100; unrelated intake blocked ~207 / 1,013 / 3,007 ms when another readiness transaction was held 200 / 1,000 / 3,000 ms). P3 F-CLAUDE-D050-02 stale D-050 implementation-report identity. P3 F-CLAUDE-D050-03 two contract tests do not independently detect the drift they claim to guard.
2. **Proposed / accepted:** Cursor must implement D-051 on `phase-1/sync-control-plane` without merging, marking ready, deploying, enabling inventory writes, or beginning PR 5. The immutable D-050 review report must never be edited after incorporation. Do not characterize the global lock as an acceptable production throughput ceiling. The branch is unmerged; correct the architecture now.
3. **Correction scope:** F-CLAUDE-D050-01 (per-shop advisory lock after transaction-shape audit; preserve zero permanent false-negative readiness, legitimate multi-shop writers, processingEnabled, expired-lease recovery, deadlock safety, dispatcher A/B/C/D protocol); F-CLAUDE-D050-02 (record independently reviewed D-050 identity `62f4cff…` and exact-head CI `31542495663` / `31542499135`); F-CLAUDE-D050-03 (independent fairness-bound formula; distinct 500 ms / >1,000 ms / 1,000 ms anti-reset cases). Do not revert to the single-shop GUC; do not silently disallow legitimate multi-shop writers; do not hide structural deadlocks with retries/sleeps; do not keep a global mutex under a different name.
4. **Reason:** D-050 eliminated one deadlock class by globally serializing unrelated merchant readiness work. That is not acceptable as the permanent PR 4 architecture. Unrelated shop A must not serialize shop B merely because both are on the same platform.
5. **Merchant impact:** None in production — production execution remains unauthorized. Correction prevents platform-wide write convoy and head-of-line blocking of unrelated merchants' webhook intake.
6. **Technical impact:** Additive D-051 migration replacing only trigger-function lock architecture; focused concurrency/deadlock/contract tests; D-050 identity correction; D-051 backlog/implementation report and status/risk/decision sync.
7. **Migration:** Additive only — `20260812230000_sync_control_plane_d051_readiness_lock_scope`. Do **not** edit the reviewed D-050 migration. No production execution.
8. **Risks:** Close R-119, R-120, R-121, R-124, R-125, R-126 on D-050 independent evidence; regression gates remain mandatory. R-122, R-123, Q-003, F-PR4-18, R-115…R-118, R-031/R-032/R-033 remain OPEN. R-127 (F-CLAUDE-D050-01) and R-128 (F-CLAUDE-D050-03) are **CLOSED on D-051 independent evidence**. Keep R-123 OPEN with non-blocking residuals F-CLAUDE-D051-01 and F-CLAUDE-D051-02. Record F-CLAUDE-D051-03 as an accepted non-blocking pre-existing overlap/harness flake; do not reopen R-124. Do not create D-052 for this synchronization.
9. **Final:** **D-051 CORRECTION CLOSURE — APPROVED.** Independently reviewed head: `938e9981dc5f4e551e0cebd37250ae7a40507575`. D-051 runtime/test implementation head: `05bcb88c213be8823e840c8233b98d46236ff644`. Independent review commits `3ad2dfbfe64b84addd3fcff14f62b424ea10eea0` then `c44b3c57db1aafeb4a5e21e4e451cc5e72d02abd` (incorporated as `768a1d2994ea38a3c49e2ea20c44e63228f6f58c` then `dd0f9e7626680e463978c192ff148d455e422fab`; final review-report blob `d17df5900b26740a32e4408618166abce2495f3a`). Verdict: **`APPROVE D-051 CORRECTION CLOSURE`**. That approval is **not** PR 4 acceptance. Next gate: **PENDING CUMULATIVE INDEPENDENT PR 4 ACCEPTANCE REVIEW**. Immutable D-050 and D-051 review reports must remain unchanged. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains **BLOCKED**. Production execution and inventory writes remain unauthorized. Architectural truth: deadlock-freedom **correctness basis** is the audited runtime transaction-shape invariant; `stocky.ready_lock_max_shop` is **defense-in-depth** only and is bypassable/clearable by `stocky_control_plane` (F-CLAUDE-D051-01). Do not implement F-CLAUDE-D051-02 in this synchronization.

## D-052 — Phase 1 PR 4 repository implementation accepted

1. **Current:** Independent Claude Code cumulative PR 4 acceptance review of exact implementation head `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3` issued verdict **`READY FOR CHATGPT PR 4 ACCEPTANCE`** with **P0: 0 · P1: 0 · P2: 0 · P3: 4** findings (F-CLAUDE-PR4ACC-01..04). Cumulative review commit: `ca7998486e2bfff6c03e75a18a7e81d6ab19bfd0`. Immutable cumulative review-report blob: `c9fca9b2effba5de3418e4523185beb3d92bc79e` (`PR4_SYNC_CONTROL_PLANE_CUMULATIVE_ACCEPTANCE_REVIEW_REPORT.md`). Merge base / `origin/main`: `e69bc53d91db75472b0d0998bf1b74ee6246adb1`. D-051 correction closure remains **APPROVED** and is not itself PR 4 acceptance. PR #20 remains OPEN, DRAFT, UNMERGED at the accepted implementation head.
2. **Proposed / decided:** Grant **technical acceptance** of Phase 1 PR 4 **repository implementation** at `eb757119…`. ChatGPT disposition: **ACCEPT PR 4 REPOSITORY IMPLEMENTATION**.
3. **Acceptance scope:** PR 4 repository implementation accepted. Independent verdict `READY FOR CHATGPT PR 4 ACCEPTANCE` is recorded. **Q-003** and **F-PR4-18** are **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION** on 2026-07 exact-head target/config agreement, independent live-schema GraphQL codegen success, a deliberately invalid GraphQL document correctly failing the gate, independently verified webhook API-version handling, and no inventory mutation introduced. **R-031, R-032, R-033, R-039, R-099 through R-121, R-125, R-126** are **CLOSED FOR PR 4 REPOSITORY IMPLEMENTATION**. **R-127** remains **CLOSED — no regression**. **R-128** remains **CLOSED — no regression**. **R-122** and **R-123** are **ACCEPTED NONBLOCKING RESIDUALS**. The four P3 findings are accepted as enumerated below and do not reopen a runtime correction cycle.
4. **Accepted P3 / residual dispositions:**
   - **F-CLAUDE-PR4ACC-01 (P3):** stale PR #20 description — originally **REQUIRED MERGE-HYGIENE ACTION**. **RESOLVED BY PR BODY UPDATE** before squash merge. Do not create a runtime correction cycle.
   - **F-CLAUDE-PR4ACC-02 (P3):** 2025-10 inbound adapter retirement — **ACCEPTED NONBLOCKING FUTURE MAINTENANCE**. Record removal/re-evaluation no later than its Shopify retirement window. Do **not** remove the adapter in this PR.
   - **F-CLAUDE-PR4ACC-03 (P3):** no static readiness-writer-shape guard — **ACCEPTED NONBLOCKING** under R-123. Confirms F-CLAUDE-D051-02. No static writer-shape guard is implemented in this synchronization.
   - **F-CLAUDE-PR4ACC-04 (P3):** F-F03 harness load sensitivity — **ACCEPTED NONBLOCKING OUT-OF-SCOPE TOOLING DEBT** (same item as F-CLAUDE-D051-03). Record for PR 1 / PR 3 tooling maintenance, not PR 4 runtime correction. Do **not** reopen R-124.
   - **R-122:** accepted nonblocking residual (fair-claim range-pair planner dependency; equality-regression CI gate remains). Carried forward after PR #20 merge.
   - **R-123:** accepted nonblocking residual. Current correctness basis is the audited runtime **transaction-shape invariant**. `stocky.ready_lock_max_shop` is **defense-in-depth only**. **F-CLAUDE-D051-01** remains an accepted P3 characterization. **F-CLAUDE-D051-02 / F-CLAUDE-PR4ACC-03** remains future-maintenance risk. No static writer-shape guard is implemented in this task. Carried forward after PR #20 merge.
5. **Explicit non-authorization (decision-time):** This decision did **not** itself authorize merge of PR #20. Merge required control-record synchronization, exact-head PUSH and PR CI, ChatGPT merge-authorization verification, and explicit user merge authorization. At decision time, **PR 5 remained BLOCKED** until the documentation-only PR 4 closure PR was accepted and merged. Production execution remains unauthorized. Inventory-write flags remain **DEFAULT OFF**. No deployment, production backfill, ownership repair, or inventory mutation is authorized. This decision does **not** imply production deployment approval, Partner Dashboard validation (Q-002), production API-health validation, production-write authorization, or legal privacy-policy finalization (Q-008). **R-028, R-029, R-095 through R-098, Q-002, Q-008**, and other production/release gates not actually satisfied remain **OPEN**. Local/disposable tests do not close production operational gates.
6. **Merchant impact:** None in production — no production or merchant-data change is authorized by this decision. Merchants gain a technically accepted repository implementation of the durable synchronization control plane on disposable/CI evidence only.
7. **Technical impact:** Documentation-only acceptance / control-record synchronization. No runtime, test, schema, executable migration SQL, package, Shopify configuration, feature-flag, or CI workflow change is authorized by this decision. The D-051 architectural truth is unchanged: transaction-shape invariant = correctness basis; `stocky.ready_lock_max_shop` = defense-in-depth, not enforcement.
8. **Migration:** None authorized. Production migrations, backfills, and inventory writes remain unauthorized.
9. **Risks:** See acceptance-scope closures and accepted residuals above. Do not close production operational gates because local/disposable tests passed. Do not create a PR 4 runtime correction cycle from this decision. A later **D-053** may exist only as Phase 1 PR 5 **planning** authorization and must not be read as PR 4 correction or implementation authorization.
10. **Final (technical acceptance):** **PHASE 1 PR 4 REPOSITORY IMPLEMENTATION ACCEPTED** (D-052) at accepted implementation head `eb757119a6b97b29c3c4e89f9cef7ecb8cd760f3`. Independent verdict: **`READY FOR CHATGPT PR 4 ACCEPTANCE`**. Findings: **P0 0 / P1 0 / P2 0 / P3 4**.
11. **Post-merge closure identity (PR #20, not a new decision):** After explicit user squash-merge authorization, PR [#20](https://github.com/Vedang1998/Stocky/pull/20) is **CLOSED and MERGED**. Squash merge `f618103c64d0b17c25b7b48f49555f661e40e22d` at `2026-08-14T00:08:05Z`. Previous main / merge base `e69bc53d91db75472b0d0998bf1b74ee6246adb1`. Final synchronized PR head `04522c59f8ef453ea698cde917fa1dde3b644887`. Cumulative review commit `ca7998486e2bfff6c03e75a18a7e81d6ab19bfd0`. Immutable review-report blob `c9fca9b2effba5de3418e4523185beb3d92bc79e`. Pre-merge PUSH CI run `31732679104` / job `94556688988` success. Pre-merge PR CI run `31732683409` / job `94556700489` success. Post-merge main CI run `31756319986` / job `94632696479` / success at head `f618103…` (139 success steps; 0 skipped / failed / cancelled). Closure record: `PR4_SYNC_CONTROL_PLANE_CLOSURE_REPORT.md`.
12. **Formal-close identity (PR #22, not a new decision):** After ChatGPT closure-record acceptance and explicit user squash-merge authorization, PR [#22](https://github.com/Vedang1998/Stocky/pull/22) is **CLOSED and MERGED**. Accepted closure head `b99039f9c34fb12e74d804a3df748cbfdb435313`. Squash merge `99d48db22ad0d114f2ea43028fd35b4bc1806ac1` at `2026-08-14T04:01:29Z`. Previous main `f618103c64d0b17c25b7b48f49555f661e40e22d`. Pre-merge PUSH CI run `31759152810` / job `94641644713` success. Pre-merge PR CI run `31759155002` / job `94641685609` success. Post-merge main CI run `31768571828` / job `94669500249` / success at head `99d48db…` (139 success steps; 0 skipped / failed / cancelled). D-052 remains the technical-acceptance authority. This identity record does **not** create D-053.
13. **Current recorded status:** **PHASE 1 PR 4 FORMALLY CLOSED.** D-052 remains the technical-acceptance authority for PR 4. Phase 1 remains **IN PROGRESS**. Later **D-053** is a separate Phase 1 PR 5 **planning** authorization and is **not** a PR 4 correction, acceptance, or closure decision. PR 5 **implementation** is **NOT STARTED** and **NOT AUTHORIZED**. Production remains unauthorized. Inventory-write flags remain **DEFAULT OFF**. Do **not** state that Phase 1 is complete or that PR 5 implementation is authorized merely because PR #20, PR #22, or PR #23 merged.

## D-053 — Phase 1 PR 5 planning authorization

1. **Current:** Phase 1 PR 4 is **FORMALLY CLOSED** under **D-052**. `origin/main` is `de1bb193a43ef87cf59acafeac4c5748e62d423d` (PR [#23](https://github.com/Vedang1998/Stocky/pull/23) squash merge, `2026-08-14T13:01:18Z`). Post-merge main CI run `31802835318`, job `94774629793`, success at that SHA. No PR 5 implementation branch or PR exists. Phase 1 remains **IN PROGRESS**.
2. **Proposed / decided:** Authorize a documentation-only planning packet for Phase 1 PR 5 — Catalog, Location, and Inventory Facts. Primary document: `stocky-plus/docs/phases/phase-1/PR5_CATALOG_LOCATION_INVENTORY_FACTS_BRIEF.md`.
3. **Exact wording:** **Phase 1 PR 5 planning authorization.**
4. **Scope:** Planning and control-record documentation only under `stocky-plus/docs/`. D-053 does **not** authorize runtime implementation, schema/migration work, Shopify configuration, GraphQL documents, tests, package changes, CI workflow changes, feature-flag changes, production execution, inventory mutation, or PR 6.
5. **Reason:** PR 5 cannot start from the historical technical plan or from PR 4 closure notes. It needs an implementation-grade brief covering canonical read facts, bulk/JSONL ingest, webhook refetch, tombstones, tenancy, money-safe prices/costs, and isolation from forecast/ABC.
6. **Merchant impact:** None in production. No production or merchant-data change is authorized.
7. **Technical impact:** Documentation only. Proposed future implementation branch name `phase-1/catalog-location-inventory-facts` is **not created** by this decision.
8. **Migration:** None authorized.
9. **Risks:** Record PR 5 planning risks R-129 through R-147. Do not close R-010, R-014, R-028, R-029, R-034, R-095..R-098, or Q-002/Q-004 by planning approval. Preserve R-122/R-123 as accepted PR 4 residuals.
10. **Final:** **PHASE 1 PR 5 PLANNING AUTHORIZED.** **PR 5 IMPLEMENTATION IS NOT AUTHORIZED.** **PRODUCTION EXECUTION IS NOT AUTHORIZED.** **INVENTORY WRITES REMAIN UNAPPROVED AND ALL INVENTORY-WRITE FLAGS REMAIN DEFAULT OFF.** **D-052 REMAINS PR 4 TECHNICAL-ACCEPTANCE AUTHORITY.**
11. **Planning correction (same D-053 — do not create D-054):** After the initial planning packet, ChatGPT required documentation-only corrections for canonical source-ordering / full-sync fence, bounded absence tombstones, visible compatibility-projection recovery, JSONL resume without assuming HTTP Range, and scale-aware reconcile freshness. These remain planning rules only. Implementation is still **NOT AUTHORIZED**.
