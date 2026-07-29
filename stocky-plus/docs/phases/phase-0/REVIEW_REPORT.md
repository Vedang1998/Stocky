# Phase 0 Independent Review — PR #4

**Status:** ACCEPTED WITH MANDATORY CORRECTIONS  
**Reviewer:** Claude Code

## Review identity

| Item | Value |
|---|---|
| Main SHA reviewed | `36b34c20d6a82fcc226948abd5ff709d9e2fcca6` |
| Pull request reviewed | GitHub PR #4 |
| Review branch | `claude/phase-0-independent-review` |
| Repository changes made | None |

## Executive verdict

**READY FOR PHASE 1 FOUNDATION — with mandatory corrections before Phase 1 begins and before any inventory-write flag is enabled.**

Claude found no confirmed P0 security issue and no confirmed cross-shop read or write in the merged tree. Phase 0 achieved its core purpose: approved documents were preserved, unsafe writes were frozen, meaningful tenant-scoping fixes landed, and Phase 1 was not started.

## Confirmed strengths

- Write flags exist and default OFF.
- Stocktake remains `IN_PROGRESS` after Shopify adjustment failures.
- Reviewed PO, stocktake, transfer, supplier-child, and Buying Table create-PO mutations are shop-scoped.
- The development subscription activation path is blocked in production.
- MMFO scopes were removed.
- Product and agent source-of-truth files were not overwritten.
- Deterministic inventory, cost, forecasting, and ABC calculations do not use LLMs.
- No secrets or production data were found.

## Important findings

### Before Phase 1 foundation starts

1. Commit a reproducible package lockfile and stop ignoring the selected lockfile.
2. Fix and validate the Admin GraphQL documents for API `2025-10`.
3. Remove or soften the merchant claim that all premium features are unlocked when entitlements are not enforced.
4. Add CI that runs lint, typecheck, tests, Prisma validation, build, and GraphQL validation.
5. Keep project status explicit that compliance webhooks only acknowledge; they do not yet redact data.
6. Keep evidence documents accurate about lockfiles, nested Git state, and placeholder flags.

### Before any real inventory-write flag is enabled

- Add per-line idempotency and result persistence.
- Re-read or safely reconcile live inventory before stocktake completion.
- Add an immutable inventory adjustment/audit ledger.
- Add reconciliation and reversal/recovery behavior.
- Add tests proving retries cannot double-adjust inventory.
- Resolve all GraphQL validation failures.

## Category verdicts

- **Tenant isolation:** PASS, with a structural follow-up to make service-level shop scoping mandatory.
- **Inventory-write safety:** CONDITIONAL PASS while all flags remain OFF.
- **Billing and entitlements:** Acceptable only as planned; not a real entitlement system yet.
- **AI economics:** Clean because no AI provider usage exists.
- **Shopify configuration:** Mixed; scopes improved, but Partner linkage and GraphQL validity remain unconfirmed.
- **Production inventory writes:** NOT APPROVED.

## Command-review note

Claude independently passed lint and build. Prisma generation/validation, tests, and typecheck were blocked in Claude's sandbox by Prisma engine download restrictions. Shopify CLI and GraphQL validation also remained failed or blocked. Cursor's recorded passing results are plausible but were not independently reproduced in Claude's environment.

## Final decision

- Phase 0 accepted: **Yes**
- Ready to begin Phase 1 immediately: **No — correction gate first**
- Ready for Phase 1 after correction gate: **Yes**
- Production inventory writes approved: **No**
- Required follow-up: Cursor correction PR followed by Claude verification
