# Phase 0 Brief — Product and Repository Alignment

**Status:** CLOSED / ACCEPTED  
**Product owner:** ChatGPT  
**Implementation owner:** Cursor  
**Independent reviewer:** Claude Code

## Goal

Align the existing repository with the approved full-platform product direction, freeze unsafe writes, identify gaps honestly, and prepare a safe Phase 1 foundation plan.

## In scope

- Preserve `docs/product/**`, `docs/agents/**`, `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/**`.
- Audit routes, services, Shopify configuration, tenancy, billing, calculations, and write paths.
- Add default-off inventory-write kill switches.
- Fix the stocktake complete-on-failure behavior.
- Correct confirmed shop-scoping holes.
- Add characterization tests and operating documentation.
- Produce an additive Phase 1 technical plan.

## Out of scope

- Phase 1 schema implementation.
- Forecasting and ABC parity rewrite.
- Enabling production inventory writes.
- Complete entitlements or AI infrastructure.
- Broad PO, warehouse, or Buying Table feature rewrites.

## Acceptance criteria

- Approved product documents remain untouched.
- Unsafe inventory writes default OFF.
- No confirmed live cross-shop access remains in reviewed routes.
- Command results are recorded honestly.
- Phase 1 is planned but not started.
- Claude performs an independent review.

## Delivery

- Implementation PR: GitHub PR #4
- Merge commit: `36b34c20d6a82fcc226948abd5ff709d9e2fcca6`
- Detailed implementation report: `../../PHASE_0_FINAL_REPORT.md`
- Independent review: `REVIEW_REPORT.md`

## Final decision

Phase 0 is accepted. Phase 1 may begin only after the mandatory pre-Phase-1 correction backlog is resolved and independently checked.
