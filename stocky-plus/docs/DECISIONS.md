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
