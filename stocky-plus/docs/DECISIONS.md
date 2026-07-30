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

# Decisions — Phase 1 (proposed)

These decisions are recorded from the documentation-only Phase 1 planning draft. They are **PROPOSED** until ChatGPT explicitly approves the final Phase 1 brief and the planning PR merges. This Cursor documentation task is **not** product-owner approval.

## D-011 — Phase 1 scope and boundaries

1. **Current:** Phase 0 closed; no Phase 1 implementation started.
2. **Proposed:** Phase 1 establishes a tenant-safe Shopify fact foundation only — Shop/`shopId`, composite tenant FKs, forced RLS, sync control plane, catalog/location/inventory/order/refund facts, audit/roles scaffold, privacy processors, reconciliation and performance exit. Out of scope: forecasting, ABC/U, Buying Table redesign, supplier/PO/receiving/stocktake/transfer/cost expansion, billing, entitlements, AI, POS, labels, reports, production inventory writes, enabling write flags, destructive schema drops, broad UI redesign.
3. **Reason:** Product roadmap Phase 1; F-016 / R-022; unsafe to build operational features on incomplete multi-tenant facts.
4. **Merchant impact:** None immediate; foundation for later parity.
5. **Technical impact:** Focused additive foundation work after brief approval.
6. **Migration:** Additive only; preserve legacy `shop` columns through Phase 1.
7. **Risks:** Scope creep into later phases; premature write enablement.
8. **Final:** **PROPOSED** — awaiting ChatGPT brief approval.

## D-012 — Canonical Shop and direct shopId ownership

1. **Current:** Merchant ownership is primarily application-level string `shop` filters; many child rows lack direct tenant ownership.
2. **Proposed:** Canonical `Shop` entity with stable internal ID and normalized unique Shopify shop domain; non-null `shopId` on every merchant-owned row after verified backfill.
3. **Reason:** F-016 / R-022; database-enforced tenancy.
4. **Merchant impact:** None direct; safer multi-merchant isolation.
5. **Technical impact:** Additive schema + backfill + access conversion.
6. **Migration:** Nullable ownership first; quarantine inconsistent rows; never guess.
7. **Risks:** Incomplete backfill; inconsistent parent/child ownership.
8. **Final:** **PROPOSED**.

## D-013 — Composite tenant foreign keys

1. **Current:** Child FKs reference parent IDs without tenant co-ownership.
2. **Proposed:** Parent tables expose composite unique keys containing `shopId` and record ID; every child FK includes `shopId`; cross-domain relations include tenant ownership; tenant indexes begin with `shopId`.
3. **Reason:** Prevent cross-shop attachment of valid parent IDs.
4. **Merchant impact:** None direct.
5. **Technical impact:** Constraint and relation redesign with additive migrations.
6. **Migration:** Enforce only after unresolved ownership count is zero.
7. **Risks:** Existing inconsistent rows block enforcement.
8. **Final:** **PROPOSED**.

## D-014 — Forced PostgreSQL Row-Level Security

1. **Current:** No RLS; omitted application filters can expose or mutate another shop’s row.
2. **Proposed:** Enable and force RLS on every approved merchant-domain table; missing tenant context is default-deny. Composite tenant FKs without RLS do **not** satisfy F-016 / R-022.
3. **Reason:** Defense in depth beyond application filters.
4. **Merchant impact:** None direct; fail-closed on missing context.
5. **Technical impact:** SQL policies; runtime must set transaction-local tenant context.
6. **Migration:** Convert all runtime access before activating RLS.
7. **Risks:** Rollback to pre-tenant-aware app after RLS is unsafe.
8. **Final:** **PROPOSED**.

## D-015 — Restricted runtime database role

1. **Current:** Application likely uses a privileged database role that owns schema objects.
2. **Proposed:** Runtime role does not own tables, has no `BYPASSRLS`, cannot change policies or run migrations.
3. **Reason:** Prevent accidental or malicious RLS bypass.
4. **Merchant impact:** None direct.
5. **Technical impact:** Separate DB credentials for web/workers.
6. **Migration:** Role provisioning and privilege verification tests.
7. **Risks:** Misconfigured role ownership or `BYPASSRLS`.
8. **Final:** **PROPOSED**.

## D-016 — Separate migration database role

1. **Current:** Same privileged access may perform migrations and runtime queries.
2. **Proposed:** Migration role is separate and unavailable to web and worker processes.
3. **Reason:** Least privilege; migration ownership must not leak to runtime.
4. **Merchant impact:** None.
5. **Technical impact:** CI and deploy use migration-owner vs runtime roles.
6. **Migration:** Documented role setup in runbooks.
7. **Risks:** Accidental runtime use of migration credentials.
8. **Final:** **PROPOSED**.

## D-017 — Transaction-local tenant context

1. **Current:** Tenant scoping is per-query application filters.
2. **Proposed:** Tenant context is transaction-local and established before any merchant-domain query; direct unrestricted Prisma/raw SQL to merchant-domain tables is prohibited.
3. **Reason:** RLS and pooled connections require explicit, non-leaking context.
4. **Merchant impact:** None direct.
5. **Technical impact:** Tenant-bound data-access contract for routes, workers, jobs, exports, privacy, reconciliation.
6. **Migration:** Convert all current domain access before RLS activation.
7. **Risks:** Connection-pool context leakage between shops.
8. **Final:** **PROPOSED**.

## D-018 — Restricted Session and Shop bootstrap exception

1. **Current:** Session storage and shop resolution may need access before tenant context exists.
2. **Proposed:** Isolate Shopify session storage and minimal Shop lookup in a small bootstrap module that cannot query merchant-domain tables; sessions must not become a general tenancy bypass.
3. **Reason:** Auth bootstrap is required; unrestricted bypass is not.
4. **Merchant impact:** None direct.
5. **Technical impact:** Narrow bootstrap API; boundary tests.
6. **Migration:** None destructive.
7. **Risks:** Bootstrap expands into a general bypass.
8. **Final:** **PROPOSED**.

## D-019 — Public App Store distribution and environment separation

1. **Current:** Partner distribution unverified (`shopify app info` historically failed); Q-002 open.
2. **Proposed:** Intended production uses public Shopify App Store distribution; development, staging/pilot, and production use separate app registrations or explicitly isolated linked configs, credentials, databases, Redis, storage, callbacks, and webhooks. Partner Dashboard app IDs and distribution selections must be verified before deployment work.
3. **Reason:** Prevent cross-environment credential and webhook contamination.
4. **Merchant impact:** Correct install and webhook targeting.
5. **Technical impact:** Separate Linked apps / env configs.
6. **Migration:** None until verified.
7. **Risks:** Deploying without Q-002 evidence.
8. **Final:** **PROPOSED** — pending Partner Dashboard evidence (Q-002).

## D-020 — Trial and private development-plan hypothesis

1. **Current:** Trial/dev-plan commercial terms unresolved (Q-006); billing not implemented.
2. **Proposed:** Working hypothesis remains 14-day Growth-equivalent trial and private $0 development test plan. Phase 1 does **not** implement billing, plans, entitlements, or commercial usage limits. A future development test plan must be non-production-only, limited to approved development/test stores, unavailable to ordinary merchants, and incapable of bypassing tenancy, permissions, or inventory-write gates.
3. **Reason:** Pricing strategy; keep commercial scaffolding out of Phase 1 foundation.
4. **Merchant impact:** None in Phase 1.
5. **Technical impact:** Defer entitlement schema/enforcement.
6. **Migration:** None.
7. **Risks:** Premature billing/entitlement implementation.
8. **Final:** **PROPOSED** — billing implementation deferred.

## D-021 — Uninstall and privacy webhook behavior

1. **Current:** Uninstall deletes sessions; compliance webhooks authenticate/acknowledge only (R-005, R-011, Q-008).
2. **Proposed:** Uninstall disables shop and jobs immediately and deletes sessions/tokens. `shop/redact` erases tenant operational data, caches, exports, queue payloads, and storage objects; preserve only non-reversible deletion receipt and counsel-confirmed retained records (minimized, segregated, inaccessible to normal workflows). Do not store unnecessary customer PII in order/line facts. Processes are idempotent, auditable, retryable, deletion-manifest backed. Legal review required before production.
3. **Reason:** App Store privacy compliance; merchant trust.
4. **Merchant impact:** Correct erasure and data-request handling.
5. **Technical impact:** Real privacy processors in Phase 1 after brief approval.
6. **Migration:** Deletion manifests and retention exceptions.
7. **Risks:** Incomplete deletion; jobs continuing after uninstall.
8. **Final:** **PROPOSED** — legal review still required (Q-008).

## D-022 — Dependency-ordered Phase 1 implementation PR sequence

1. **Current:** No Phase 1 implementation PRs.
2. **Proposed:** Eight dependency-ordered PRs: (1) tenant expand/backfill, (2) tenant-bound access conversion, (3) database enforcement/RLS — hard gate before later PRs, (4) sync control plane, (5) catalog/location/inventory facts, (6) order/refund facts, (7) audit/roles/privacy, (8) reconciliation/performance/exit. Each starts from updated `main`, requires CI, Claude review, ChatGPT acceptance, and explicit user merge authorization.
3. **Reason:** Enforce F-016 before sync/facts expansion; prevent mixed unsafe merges.
4. **Merchant impact:** None direct.
5. **Technical impact:** No later Phase 1 PR begins until PR 3 is reviewed, accepted, and merged.
6. **Migration:** Additive throughout.
7. **Risks:** Skipping enforcement gate; mixed scopes.
8. **Final:** **PROPOSED**.

## D-023 — Shopify API-version validation before sync implementation

1. **Current:** API pin remains `2025-10` / `October25` (D-007); planning PR does not change version.
2. **Proposed:** Before the first Phase 1 sync implementation merges: validate Phase 1 GraphQL documents and webhook fixtures against the current stable Admin API; approve and record the selected version; avoid building on a near-retirement version; keep every inventory mutation excluded.
3. **Reason:** Sync foundation must not be built on invalid or retiring operations.
4. **Merchant impact:** None immediate.
5. **Technical impact:** Validation evidence before sync PRs.
6. **Migration:** None in planning.
7. **Risks:** Building sync on retiring/invalid API shapes.
8. **Final:** **PROPOSED**.
