# Phase 0 Correction Follow-Up Implementation Report

**Status:** DRAFT PR OPEN — F-010 / F-011 final corrections; gate not closed  
**Branch:** `phase-0/correction-gate-followup`  
**Base main SHA:** `9844aec437cc4cdae5c678dc4a8c6c1aeec6befb`  
**Draft PR:** https://github.com/Vedang1998/Stocky/pull/7  
**Node version:** `v22.19.0`  
**npm version:** `11.5.2` (also declared in `package.json` `packageManager` / `engines.npm`)  
**Operating system (local evidence):** Darwin 25.4.0 (arm64)  
**Date:** 2026-07-29

## Head / CI referencing policy (F-010)

Exact live PR tip SHA and live CI run IDs are **not** hardcoded as “current” in `PROJECT_STATUS.md`.

- **Last independently reviewed head** (Claude second review): `33aaac32303b6757e1f9b4a3efd5a4f48874c95e`
- **Last independently reviewed green run / job:** `30485002939` / `90688346067`
- Those values are immutable historical review evidence only.
- **Authoritative current head and CI:** verify on [GitHub PR #7](https://github.com/Vedang1998/Stocky/pull/7).
- Post-push CI evidence for this correction tip is recorded in the **PR description** (external verification) — no follow-up commit solely to chase the tip SHA.

## Explicit confirmations

- **Phase 1 was not started.**
- **All inventory-write feature flags remain default OFF.**
- **Production inventory writes remain unapproved.**
- **No secrets, `.env`, merchant data, or production credentials were committed.**
- **Approved product documents under `docs/product/` were not changed.**
- **Gate is not marked closed.**

## Files changed (cumulative follow-up + final F-010/F-011)

- `stocky-plus/package-lock.json` — F-001: three missing optional `@emnapi/*` entries
- `stocky-plus/package.json` — F-006: `packageManager` / `engines.npm` = `11.5.2`
- `.github/workflows/ci.yml` — F-006: pin npm before `npm ci`
- `stocky-plus/app/routes/app.transfers.tsx` — F-004: unsupported Shopify complete before local receipt mutation
- `stocky-plus/app/services/transfer-receive-guard.test.ts` — F-004
- `stocky-plus/app/services/cross-shop-denial.test.ts` — F-005 + **F-011** standalone PO parent cancel
- `stocky-plus/docs/phases/phase-0/CORRECTION_REVIEW_REPORT.md` — PR #6 BLOCKED (historical; not overwritten)
- `stocky-plus/docs/phases/phase-0/CORRECTION_FOLLOWUP_REVIEW_REPORT.md` — PR #7 **NOT READY** (F-010–F-016)
- `stocky-plus/docs/phases/phase-0/CORRECTION_BACKLOG.md`
- `stocky-plus/docs/phases/phase-0/CORRECTION_IMPLEMENTATION_REPORT.md` — supersession notice
- `stocky-plus/docs/phases/phase-0/CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md` — this file
- `stocky-plus/docs/RISK_REGISTER.md` — R-013–R-022 including F-016 / branch protection
- `stocky-plus/docs/OPEN_QUESTIONS.md` — Q-011 Phase 1 DB tenancy (F-016)
- `stocky-plus/docs/PROJECT_STATUS.md` — **F-010** stable wording

## F-001 — Lockfile diff summary (resolved)

| Metric | Result |
|---|---|
| Added package entries | **3** — `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads` |
| Removed entries | **0** |
| Unrelated version changes | **0** |

## F-006 — Pinned toolchain (resolved)

| Tool | Version |
|---|---|
| Node | `22.19.0` |
| npm | `11.5.2` |

## F-004 — Transfer receive guard (resolved)

`receive` always calls `completeShopifyTransfer` before any local receipt-completion mutation. Unsupported on Admin API 2025-10. `FEATURE_TRANSFER_WRITES` remains default OFF.

## F-010 — Status wording correction

`PROJECT_STATUS.md` now distinguishes:

1. immutable last independently reviewed head / run / job;
2. live current head / CI verified on GitHub PR #7;
3. gate still open until READY + ChatGPT + explicit merge authorization + merge + post-merge update.

This avoids the self-invalidating “document tip → new tip → document again” loop.

## F-011 — Standalone PO parent denial + accurate classification

Added:

`denies Shop B cancelling Shop A purchase order`

Invokes the real `app.purchase-orders` action with Shop B session and Shop A `poId`. Asserts scoped `updateMany` with `shop: SHOP_B`, not-found result, no unscoped update, no PO-line child mutations, no Shopify mutations.

Kept separate:

`rejects client-supplied Shop A as authority on PO cancel (session shop wins)`

### Cross-shop file classification

| Class | Count |
|---|---|
| Standalone record-level cross-shop denial tests | **9** |
| Separate client-authority / control test | **1** |
| Separate feature-flag assertion | **1** |

#### The 9 standalone record-level denials

1. Shop B PO / line `addLine`
2. Shop B stocktake line `count`
3. Shop B transfer `addLine`
4. Shop B supplier mapping delete
5. Shop B Buying Table `createPO` (supplier not found)
6. Shop B PO parent `cancel` (**F-011 standalone**)
7. Shop B stocktake parent `complete`
8. Shop B transfer parent `ship`
9. Shop B Buying Table mapping denial when supplier resolves but mapping is Shop A

Do **not** count the client-authority or feature-flag tests as record-level denials.

**Full suite:** **46** tests / 5 files (local validation after F-011).

## Non-blocking (not implemented)

- F-012–F-015: recorded in `RISK_REGISTER.md` (R-018–R-021)
- F-016: `OPEN_QUESTIONS.md` Q-011 + `RISK_REGISTER.md` R-022 — Phase 1 brief requirement only

## Exact local commands and exit statuses

| Command | Exit | Status |
|---|---|---|
| `node --version` | 0 | `v22.19.0` |
| `npm --version` | 0 | `11.5.2` |
| `rm -rf node_modules && npm ci` | 0 | PASS |
| `npx prisma generate` | 0 | PASS |
| `npx prisma validate` | 0 | PASS |
| `npx prisma migrate status` | 0 | PASS |
| `npm run lint` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm test` | 0 | PASS (**46** tests / 5 files) |
| `npm run build` | 0 | PASS (React Router future-flag warnings only) |
| `npm run graphql-codegen` | 0 | PASS |

**Full suite after F-011:** 46 tests (prior 45 + 1 standalone PO parent denial).

## GitHub Actions

Live run ID / job ID for the post-correction tip: verify on PR #7 and record in the PR description. Do not create a docs-only commit solely to embed those IDs here as “current tip.”

Historical Claude-reviewed green evidence remains run `30485002939` / job `90688346067` at head `33aaac3…`.

## Process note — main branch protection

**OWNER ACTION REQUIRED:**

GitHub `main` should require:

- Pull requests before merging
- Status check `Lint, typecheck, test, build, Prisma, GraphQL` to pass (`strict`)
- No merging while a PR is draft

Cursor has not claimed this setting was changed without settings evidence.

## Remaining blockers

- Claude narrow final re-check of F-010 and F-011.
- ChatGPT approval of the final verdict.
- Explicit user merge authorization.
- Branch-protection owner confirmation.
- Inventory-write release gates still required before enabling any write flag.

## Next step

Stop after green CI on the exact final head and PR description update. Do not merge. Do not start Phase 1. Do not mark the correction gate closed.
