# Project Status

**Updated:** 2026-07-29  
**Current stage:** Phase 0 correction gate follow-up — final F-010 / F-011 corrections  
**Current main SHA:** `9844aec437cc4cdae5c678dc4a8c6c1aeec6befb`  
**Active PR:** [#7 — Phase 0 correction-gate follow-up](https://github.com/Vedang1998/Stocky/pull/7)  
**Active branch:** `phase-0/correction-gate-followup`  
**PR state:** draft, open, unmerged  
**Phase 1:** Not started

## Current truth

- Phase 0 implementation was merged through GitHub PR #4.
- Claude accepted Phase 0 with mandatory corrections (C-004–C-008).
- Correction gate PR #6 was merged into `main` **with failed CI** before independent review completed.
- Claude’s independent review of PR #6 returned **`BLOCKED`** — see `phases/phase-0/CORRECTION_REVIEW_REPORT.md`.
- Claude’s second independent review of PR #7 (head `33aaac3…`) returned **`NOT READY`** — only **F-010** and **F-011** block READY — see `phases/phase-0/CORRECTION_FOLLOWUP_REVIEW_REPORT.md`.
- The Phase 0 correction gate remains **open / not closed** until final Claude READY verdict, ChatGPT approval, explicit user merge authorization, merge, and post-merge status update.
- **CI requirement:** the exact merge-candidate head on PR #7 must have a successful GitHub Actions run. Authoritative current head and CI result: verify directly on [GitHub PR #7](https://github.com/Vedang1998/Stocky/pull/7).
- Phase 1 has **not** started and must not start.
- No production inventory writes are approved.
- All implemented inventory-write paths remain disabled (flags default OFF).

## Last independently reviewed evidence (immutable historical fact)

These values document Claude’s second review of PR #7. They are **not** a claim that they remain the current PR head after later commits.

| Field | Value |
|---|---|
| Last independently reviewed head | `33aaac32303b6757e1f9b4a3efd5a4f48874c95e` |
| Last independently reviewed green run | `30485002939` |
| Last independently reviewed job | `90688346067` |
| Claude verdict on that head | **`NOT READY`** (F-010, F-011) |

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
| Follow-up PR #7 | Draft / open / unmerged on `phase-0/correction-gate-followup` |
| Claude second review of PR #7 | **`NOT READY`** at head `33aaac3…` (F-010, F-011); prior P0/P1 items resolved |
| F-010 / F-011 Cursor correction | In progress — verify live head + CI on PR #7 |

See:

- `phases/phase-0/CORRECTION_REVIEW_REPORT.md` (PR #6 BLOCKED)
- `phases/phase-0/CORRECTION_FOLLOWUP_REVIEW_REPORT.md` (PR #7 NOT READY)
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
- F-012–F-015: future maintenance / risk (not this correction).
- F-016: Phase 1 must add database-enforced tenant isolation (brief requirement; not implemented now).

## Next action

1. Complete F-010 / F-011; confirm green CI on the exact merge-candidate head via PR #7.
2. Claude narrow final re-check of F-010 and F-011.
3. ChatGPT approves the final verdict; user explicitly authorizes merge.
4. **OWNER ACTION REQUIRED:** confirm `main` branch protection (PR required + CI status check + no draft merges).
5. Do not enable any inventory-write flag. Do not start Phase 1.

## Where to look

- Phase workflow: `phases/README.md`
- Phase 0 record: `phases/phase-0/`
- Permanent product rules: `product/`
- Permanent agent instructions: `agents/`
- Risks: `RISK_REGISTER.md`
- Decisions: `DECISIONS.md`
