# Project Status

**Updated:** 2026-07-29  
**Current stage:** Phase 0 correction gate follow-up in progress  
**Current main SHA:** `9844aec437cc4cdae5c678dc4a8c6c1aeec6befb`  
**Follow-up branch:** `phase-0/correction-gate-followup`  
**Follow-up draft PR:** https://github.com/Vedang1998/Stocky/pull/7 (CI green — tip `1d36169`, run `30484058720`, job `90685181760`)  
**Phase 1:** Not started

## Current truth

- Phase 0 implementation was merged through GitHub PR #4.
- Claude accepted Phase 0 with mandatory corrections (C-004–C-008).
- Correction gate PR #6 was merged into `main` **with failed CI** before independent review completed.
- Claude’s independent review of PR #6 returned **`BLOCKED`** — see `phases/phase-0/CORRECTION_REVIEW_REPORT.md`.
- The Phase 0 correction gate is **not closed**.
- Follow-up draft PR #7 is open on `phase-0/correction-gate-followup` with reported green CI evidence; Claude re-review is still required before the gate may close.
- The Phase 0 correction gate remains **BLOCKED / not closed** until Claude returns READY and ChatGPT authorizes merge.
- Phase 1 has **not** started and must not start.
- No production inventory writes are approved.
- All implemented inventory-write paths remain disabled (flags default OFF).

## Phase 0 completed (historical)

- Approved product and agent source-of-truth files were preserved.
- Unsafe stocktake, receipt, and transfer writes remain behind default-off flags.
- Stocktake no longer reports `COMPLETED` after failed Shopify adjustments.
- Confirmed route-level tenant-scoping holes were corrected.
- MMFO scopes were removed.
- The development subscription activation bypass was restricted.
- Characterization tests and Phase 0 operating records were added.

## Correction gate timeline

| Event | Result |
|---|---|
| PR #6 (`phase-0/correction-gate`) | Merged to main; GitHub Actions `npm ci` **FAILED** (run `30470541851`) |
| Claude review of PR #6 | **`BLOCKED`** — F-001 lockfile, F-006 npm pin, F-004 transfer receive, F-005 cross-shop coverage |
| Original local completion claim | **Superseded** — macOS `npm ci` did not reproduce on Linux CI |
| Follow-up branch | `phase-0/correction-gate-followup` — draft PR #7; green CI run `30484058720` |

See:

- `phases/phase-0/CORRECTION_REVIEW_REPORT.md`
- `phases/phase-0/CORRECTION_BACKLOG.md`
- `phases/phase-0/CORRECTION_IMPLEMENTATION_REPORT.md` (historical; superseded notice)
- `phases/phase-0/CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`

## Important deferred work

- Compliance webhooks currently authenticate and acknowledge only; they do not yet perform data export or redaction.
- `subscriptionActive` is not a complete entitlement system.
- Adjustment and cost-sync flags are placeholders; no implemented write paths currently use them.
- Forecast and ABC parity remain future work.
- Inventory-write idempotency, audit, reconciliation, and reversal are not complete.
- Partner distribution remains unconfirmed because `shopify app info` failed.
- npm audit advisories remain for a separate remediation decision.

## Next action

1. Land follow-up with green GitHub Actions (do not merge while draft / before Claude + ChatGPT approval).
2. Claude re-reviews and returns `READY FOR PHASE 1 FOUNDATION`.
3. ChatGPT authorizes merge and Phase 1 brief.
4. Do not enable any inventory-write flag.

## Where to look

- Phase workflow: `phases/README.md`
- Phase 0 record: `phases/phase-0/`
- Permanent product rules: `product/`
- Permanent agent instructions: `agents/`
- Risks: `RISK_REGISTER.md`
- Decisions: `DECISIONS.md`
