# Project Status — Phase 0

**Updated:** 2026-07-29  
**Branch:** `phase-0-product-alignment-v2`  
**Base:** `origin/main` @ `f1923acef0c44b1e80d0b5aae44a517aedf56aef`  
**Phase:** 0 — Product and repository alignment (**in PR; Phase 1 not started**)

## Done this phase

- Read governance + approved product documents; did not overwrite them.
- Created clean branch from latest `origin/main` (not historical branches).
- Classified `origin/phase-0-product-alignment` candidate changes; selectively ported.
- Inventory-write kill switches + route gates.
- Stocktake complete-on-failure fix.
- Tenant scoping fixes on PO / stocktake / transfer / supplier child / buying-table createPO.
- Removed unjustified MMFO scopes.
- Added compliance webhook route + toml `compliance_topics`.
- Guarded `devActivate`.
- Softened merchant-facing Stocky++ labels in Admin/billing.
- Characterization tests for forecast/ABC/flags/MOQ/stocktake safety.
- Operating docs under `stocky-plus/docs/` (not under `docs/product/`).
- Command baseline executed (see `CURRENT_COMMAND_BASELINE.md`).

## Not done / deferred

- Phase 1 fact schema and migrations (planned only).
- Forecast/ABC parity rewrite.
- Full entitlement service / AI ledger.
- Full GDPR redaction pipeline.
- GraphQL operation repairs.
- README/SETUP full rebrand.
- Partner distribution confirmation (`shopify app info` failed).

## Exit criteria toward Phase 1

Claude Code independent review of this PR should confirm:

1. Approved product docs untouched.
2. Unsafe writes default OFF.
3. Command evidence honest.
4. Phase 1 plan is additive and non-destructive.

## Explicit statement

**Phase 1 feature development was not started in this pass.**
