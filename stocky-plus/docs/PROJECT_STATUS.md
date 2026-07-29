# Project Status

**Updated:** 2026-07-29  
**Current stage:** Phase 0 accepted; mandatory correction gate open  
**Current main SHA:** `36b34c20d6a82fcc226948abd5ff709d9e2fcca6`  
**Phase 1:** Not started

## Current truth

- Phase 0 implementation was merged through GitHub PR #4.
- Claude completed an independent review.
- Verdict: **READY FOR PHASE 1 FOUNDATION**, but not until the correction gate is closed.
- No production inventory writes are approved.
- All implemented inventory-write paths must remain disabled.

## Phase 0 completed

- Approved product and agent source-of-truth files were preserved.
- Unsafe stocktake, receipt, and transfer writes remain behind default-off flags.
- Stocktake no longer reports `COMPLETED` after failed Shopify adjustments.
- Confirmed route-level tenant-scoping holes were corrected.
- MMFO scopes were removed.
- The development subscription activation bypass was restricted.
- Characterization tests and Phase 0 operating records were added.
- Claude found no confirmed cross-shop read or write in the merged tree.

## Mandatory correction gate before Phase 1

See `phases/phase-0/CORRECTION_BACKLOG.md`.

Open engineering work:

1. Commit a reproducible npm lockfile and stop ignoring it.
2. Fix and validate GraphQL documents for Admin API `2025-10`.
3. Correct the billing banner so it does not claim unenforced premium access.
4. Add CI for the required command baseline.
5. Add initial cross-shop denial tests.

## Important deferred work

- Compliance webhooks currently authenticate and acknowledge only; they do not yet perform data export or redaction.
- `subscriptionActive` is not a complete entitlement system.
- Adjustment and cost-sync flags are placeholders; no implemented write paths currently use them.
- Forecast and ABC parity remain future work.
- Inventory-write idempotency, audit, reconciliation, and reversal are not complete.
- Partner distribution remains unconfirmed because `shopify app info` failed.

## Next action

1. Merge the documentation/phase-tracking PR after review.
2. Give Cursor a narrowly scoped Phase 0 correction task for C-004 through C-008.
3. Have Claude verify that correction PR.
4. Only then approve and create the Phase 1 brief.

## Where to look

- Phase workflow: `phases/README.md`
- Phase 0 record: `phases/phase-0/`
- Permanent product rules: `product/`
- Permanent agent instructions: `agents/`
- Risks: `RISK_REGISTER.md`
- Decisions: `DECISIONS.md`
