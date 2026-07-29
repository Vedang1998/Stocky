# Phase 0 Correction Follow-Up Implementation Report

**Status:** DRAFT PR OPEN — GitHub Actions green; awaiting Claude re-review (gate not closed)  
**Branch:** `phase-0/correction-gate-followup`  
**Base main SHA:** `9844aec437cc4cdae5c678dc4a8c6c1aeec6befb`  
**Final head SHA (code tip with green CI):** `1d36169c674420f9aab1b3cd1504051f7beed9e1`  
**Draft PR:** https://github.com/Vedang1998/Stocky/pull/7  
**Node version:** `v22.19.0`  
**npm version:** `11.5.2` (also declared in `package.json` `packageManager` / `engines.npm`)  
**Operating system (local evidence):** Darwin 25.4.0 (arm64)  
**Date:** 2026-07-29

## Explicit confirmations

- **Phase 1 was not started.**
- **All inventory-write feature flags remain default OFF.**
- **No secrets, `.env`, merchant data, or production credentials were committed.**
- **Approved product documents under `docs/product/` were not changed.**
- **Gate is not marked closed** pending Claude re-review after green CI.

## Files changed

- `stocky-plus/package-lock.json` — F-001: add three missing optional `@emnapi/*` entries
- `stocky-plus/package.json` — F-006: `packageManager` + `engines.npm` = `11.5.2`
- `.github/workflows/ci.yml` — F-006: install/verify npm `11.5.2` before `npm ci`
- `stocky-plus/app/routes/app.transfers.tsx` — F-004: always require Shopify complete path before local receipt mutation
- `stocky-plus/app/services/transfer-receive-guard.test.ts` — F-004 tests
- `stocky-plus/app/services/cross-shop-denial.test.ts` — F-005 parent + mapping denial tests
- `stocky-plus/docs/phases/phase-0/CORRECTION_REVIEW_REPORT.md` — stored Claude BLOCKED review
- `stocky-plus/docs/phases/phase-0/CORRECTION_BACKLOG.md`
- `stocky-plus/docs/phases/phase-0/CORRECTION_IMPLEMENTATION_REPORT.md` — supersession notice
- `stocky-plus/docs/phases/phase-0/CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md` — this file
- `stocky-plus/docs/RISK_REGISTER.md` — npm audit, branch-protection owner action, GraphQL network dependency
- `stocky-plus/docs/PROJECT_STATUS.md`

## F-001 — Exact lockfile diff summary

Regenerated with Node `v22.19.0` / npm `11.5.2` via:

```bash
npm install --package-lock-only --ignore-scripts --no-save \
  @emnapi/core@2.0.0-alpha.3 \
  @emnapi/runtime@2.0.0-alpha.3 \
  @emnapi/wasi-threads@2.0.1
```

| Metric | Result |
|---|---|
| Added package entries | **3** — `node_modules/@emnapi/core`, `node_modules/@emnapi/runtime`, `node_modules/@emnapi/wasi-threads` |
| Removed entries | **0** |
| Unrelated version changes | **0** |
| `package.json` dependency declaration churn | **None** (only `packageManager` / `engines.npm` for F-006) |
| Diff size | `+37` lines on `package-lock.json` |

## F-006 — Pinned toolchain

| Tool | Version |
|---|---|
| Node | `22.19.0` (CI `actions/setup-node`; local `v22.19.0`) |
| npm | `11.5.2` (`packageManager`, `engines.npm`, CI `npm install -g npm@11.5.2`) |

Chosen because it is the version that produced the minimal three-entry lockfile repair and matches the prior Phase 0 correction evidence environment — not because it is newest.

## F-004 — Transfer receive guard

`receive` always calls `completeShopifyTransfer` (including when `shopifyTransferId` is null, using a sentinel id). On Admin API 2025-10 this throws `UnsupportedShopifyOperationError` before any `$transaction` that would set `receivedQty`, `status: RECEIVED`, or `receivedAt`. `FEATURE_TRANSFER_WRITES` remains default OFF. No Shopify mutation was invented.

## F-005 — Tests added / counts

### Transfer receive guard (`transfer-receive-guard.test.ts`)

- With Shopify transfer id present → unsupported; no local mutation
- Without Shopify transfer id → unsupported; no local mutation
- Clear unsupported-operation merchant error
- Documents env-gated default OFF

### Cross-shop record-level denial cases

**Record-level denial cases: 9** (feature-flag-only assertion counted separately)

1. Shop B PO / line `addLine`
2. Shop B stocktake line `count`
3. Shop B transfer `addLine`
4. Shop B supplier mapping delete
5. Shop B Buying Table `createPO` (supplier not found)
6. Client-smuggled Shop A id on PO cancel (session shop authoritative)
7. Shop B stocktake **parent** `complete` (new)
8. Shop B transfer **parent** `ship` (new)
9. Shop B Buying Table mapping denial when supplier resolves but mapping is Shop A (new)

**Other safety tests in the same file (not counted as record-level denial):** 1 flag default-OFF assertion.

**Client-smuggled shop field case (#6)** proves session authority; counted as record-scoped PO cancel denial, not a feature-flag test.

**Full suite:** 45 tests / 5 files (local re-validation after parent-ship denial update).

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
| `npm test` | 0 | PASS (45) |
| `npm run build` | 0 | PASS (React Router future-flag warnings only) |
| `npm run graphql-codegen` | 0 | PASS |

## GitHub Actions

### Authoritative green run (tip `1d36169` — includes parent-ship denial + risk/docs corrections)

| Field | Value |
|---|---|
| Workflow run ID | `30484058720` |
| Job ID | `90685181760` |
| Head SHA | `1d36169c674420f9aab1b3cd1504051f7beed9e1` |
| Trigger | `pull_request` |
| Conclusion | **success** |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30484058720 |

### Prior green run (tip `bff1c9f` — lockfile/npm/transfer/tests baseline)

| Field | Value |
|---|---|
| Workflow run ID | `30483462941` |
| Job ID | `90683173537` |
| Head SHA | `bff1c9f031c2bb57be463098c1eee9668eb0efe5` |
| Conclusion | **success** |
| URL | https://github.com/Vedang1998/Stocky/actions/runs/30483462941 |

### Step conclusions (run `30484058720` / job `90685181760`)

All required steps **success**: Set up job → Initialize containers → Checkout → Setup Node.js → Pin npm → Verify Node and npm versions → Install dependencies (`npm ci`) → Generate Prisma client → Validate Prisma schema → Apply migrations to ephemeral PostgreSQL → Lint → Typecheck → Unit tests → Build → GraphQL codegen / schema validation → Complete job.

Warnings (non-failing): React Router future-flag notices during build; npm `shamefully-hoist` project-config warning; pre-existing audit advisories not remediated.

## Process note — main branch protection

**OWNER ACTION REQUIRED (do not treat as verified by Cursor unless settings evidence exists):**

GitHub `main` should require:

- Pull requests before merging
- Status check `Lint, typecheck, test, build, Prisma, GraphQL` to pass (`strict`)
- No merging while a PR is draft

If an owner later configures these settings, record direct evidence (screenshot or API response) in a follow-up note. This does not replace Claude review or ChatGPT approval.

## Remaining blockers

- Claude must re-review the follow-up PR and return `READY FOR PHASE 1 FOUNDATION`.
- ChatGPT must authorize merge (and Phase 1 brief separately).
- Inventory-write release gates still required before enabling any write flag.
- Compliance webhooks still acknowledge-only; entitlements incomplete; npm audit advisories deferred.

## Next step

Stop for Claude re-review. Do not merge. Do not start Phase 1. Do not mark the correction gate closed.
