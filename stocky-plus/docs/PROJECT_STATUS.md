# Project Status

**Updated:** 2026-07-29  
**Current stage:** Phase 0 correction gate implemented; awaiting Claude verification  
**Current main SHA (gate base):** `39b6a50f7d90eefb7f04f0479cc21722f9053129`  
**Correction branch:** `phase-0/correction-gate`  
**Phase 1:** Not started

## Current truth

- Phase 0 implementation was merged through GitHub PR #4.
- Claude completed an independent review (accepted with mandatory corrections).
- Cursor implemented C-004 through C-008 on `phase-0/correction-gate`.
- No production inventory writes are approved.
- All implemented inventory-write paths remain disabled (flags default OFF).

## Phase 0 completed

- Approved product and agent source-of-truth files were preserved.
- Unsafe stocktake, receipt, and transfer writes remain behind default-off flags.
- Stocktake no longer reports `COMPLETED` after failed Shopify adjustments.
- Confirmed route-level tenant-scoping holes were corrected.
- MMFO scopes were removed.
- The development subscription activation bypass was restricted.
- Characterization tests and Phase 0 operating records were added.

## Correction gate (C-004–C-008)

See `phases/phase-0/CORRECTION_BACKLOG.md` and `phases/phase-0/CORRECTION_IMPLEMENTATION_REPORT.md`.

| ID | Status |
|---|---|
| C-004 lockfile | Implemented — `npm ci` PASS |
| C-005 GraphQL 2025-10 | Implemented — codegen PASS; transfer complete unsupported safely |
| C-006 billing copy | Implemented — factual subscription messaging |
| C-007 CI | Implemented — `.github/workflows/ci.yml` |
| C-008 cross-shop tests | Implemented — 7 denial cases; 38 tests PASS |

## Important deferred work

- Compliance webhooks currently authenticate and acknowledge only; they do not yet perform data export or redaction.
- `subscriptionActive` is not a complete entitlement system.
- Adjustment and cost-sync flags are placeholders; no implemented write paths currently use them.
- Forecast and ABC parity remain future work.
- Inventory-write idempotency, audit, reconciliation, and reversal are not complete.
- Partner distribution remains unconfirmed because `shopify app info` failed.
- npm audit advisories remain for a separate remediation decision.

## Next action

1. Claude verifies the correction PR.
2. Only then approve and create the Phase 1 brief.
3. Do not enable any inventory-write flag.

## Where to look

- Phase workflow: `phases/README.md`
- Phase 0 record: `phases/phase-0/`
- Permanent product rules: `product/`
- Permanent agent instructions: `agents/`
- Risks: `RISK_REGISTER.md`
- Decisions: `DECISIONS.md`
