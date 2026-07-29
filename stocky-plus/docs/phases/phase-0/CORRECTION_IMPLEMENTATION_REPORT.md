# Phase 0 Correction Implementation Report

> ## Correction notice (2026-07-29) — SUPERSEDED
>
> This report’s original completion claim is **superseded**.
>
> - The original local macOS `npm ci` result did **not** reproduce in Linux GitHub Actions.
> - PR #6 CI failed at `npm ci` (workflow run `30470541851`, job `90639313793`) with missing `@emnapi/*` lockfile entries.
> - Claude’s independent review of PR #6 returned **`BLOCKED`**. The Phase 0 correction gate is **not closed**.
> - Follow-up work lives on `phase-0/correction-gate-followup` and is documented in `CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md` and `CORRECTION_REVIEW_REPORT.md`.
>
> Do not treat the status below as current gate closure evidence.

**Status:** SUPERSEDED (original claim: COMPLETE pending Claude verification)  
**Branch:** `phase-0/correction-gate`  
**Base main SHA:** `39b6a50f7d90eefb7f04f0479cc21722f9053129`  
**Final commit SHA:** `e25c4aa4387e68d49ab2a0bb5dda54f4f74a6089`  
**Environment:** Node `v22.19.0` · npm `11.5.2`  
**Date:** 2026-07-29

## Explicit confirmations

- **Phase 1 was not started.**
- **All inventory-write feature flags remain default OFF** (`FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES`).
- **No secrets, `.env`, merchant data, or production credentials were committed.**
- **Approved product documents under `docs/product/` were not changed.**

## Files changed

- `stocky-plus/.gitignore` — track npm lockfile; ignore yarn/pnpm lockfiles and GraphQL codegen caches
- `stocky-plus/package-lock.json` — committed for reproducible `npm ci`
- `stocky-plus/app/services/shopify-gql.server.ts` — inventory level query via `inventoryItem.inventoryLevel(locationId:)`
- `stocky-plus/app/services/shopify-sync.server.ts` — remove invalid `inventoryTransferComplete`; safe unsupported error
- `stocky-plus/app/routes/app.transfers.tsx` — receive path fails safely when complete is unsupported
- `stocky-plus/app/routes/app.billing.tsx` — factual subscription copy only
- `stocky-plus/app/services/cross-shop-denial.test.ts` — Shop B denial coverage
- `stocky-plus/app/services/unsupported-transfer.test.ts` — unsupported transfer receive evidence
- `.github/workflows/ci.yml` — PR/main CI workflow
- `stocky-plus/docs/phases/phase-0/CORRECTION_BACKLOG.md`
- `stocky-plus/docs/PROJECT_STATUS.md`
- `stocky-plus/docs/phases/phase-0/CORRECTION_IMPLEMENTATION_REPORT.md`

## Correction evidence

### C-004 / Correction 1 — Commit npm lockfile

- Removed only `package-lock.json` from `.gitignore`.
- Continues ignoring `yarn.lock` and `pnpm-lock.yaml`.
- Committed existing `package-lock.json` without broad upgrades or `npm audit fix`.
- Evidence: local `npm ci` **PASS** (exit 0) — **later shown insufficient for Linux CI; see supersession notice**.

### C-005 / Correction 2 — GraphQL Admin API 2025-10

- Reproduced prior failures: invalid `inventoryLevel(inventoryItemId, locationId)` args; missing `inventoryTransferComplete`.
- Fixed inventory lookup to schema-supported:

```graphql
inventoryItem(id: $inventoryItemId) {
  inventoryLevel(locationId: $locationId) {
    quantities(names: ["available"]) { quantity }
  }
}
```

- Confirmed Admin API 2025-10 has no `inventoryTransferComplete` (or equivalent receive) among documented transfer mutations.
- Removed the invalid GraphQL document; `completeShopifyTransfer` throws `UnsupportedShopifyOperationError`.
- API version remains **2025-10**.
- `FEATURE_TRANSFER_WRITES` remains default OFF.
- Evidence: `npm run graphql-codegen` **PASS** (exit 0). Generated schema/types are gitignored and regenerated in CI (schema cache not committed).

### C-006 / Correction 3 — Billing copy

- Removed “All premium features are unlocked.”
- Active: “Your Shopify app subscription is active. You are on [plan].”
- Inactive: “No active Shopify app subscription was found.”
- Added temporary-hypothesis note for plan names/prices.
- Did not implement entitlements.

### C-007 / Correction 4 — GitHub Actions CI

- Added `.github/workflows/ci.yml` for `pull_request` and `push` to `main`.
- Working directory `stocky-plus`; Node `22.19.0`; npm cache on `package-lock.json`; `contents: read`.
- Order: `npm ci` → `prisma generate` → `prisma validate` → `prisma migrate deploy` (ephemeral Postgres service) → lint → typecheck → test → build → `graphql-codegen`.
- Test-only env vars; write flags forced false.
- GraphQL step documents outbound HTTPS dependency on `shopify.dev`.
- `npm audit` intentionally not a blocking gate.
- Local YAML lint via `yaml-lint`: **PASS**.
- **PR #6 Actions run failed at `npm ci` (see supersession notice).**

### C-008 / Correction 5 — Cross-shop denial tests

Added `cross-shop-denial.test.ts` covering:

| Area | Assertion |
|---|---|
| Purchase orders / lines | Shop B `addLine`/`cancel` scoped to `session.shop`; no line create / unprotected update |
| Stocktake lines | Shop B `count` not-found; no line update; no `adjustShopifyInventory` |
| Transfers / lines | Shop B `addLine` not-found; no line create; no Shopify transfer mutations |
| Supplier children | Shop B cannot load Shop A supplier (404); no mapping/tier deletes |
| Buying Table createPO | Shop B supplier not-found; no PO create / mapping resolve |
| Flags | inventory-write flags remain false |

Evidence: `npm test` **PASS** — 38 tests / 4 files. Claude later required additional parent/mapping cases (F-005).

## Exact local command results

| Command | Exit | Status |
|---|---|---|
| `npm ci` | 0 | PASS (local only; Linux CI later FAIL) |
| `npm run lint` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm test` | 0 | PASS (38) |
| `npx prisma generate` | 0 | PASS |
| `npx prisma validate` | 0 | PASS |
| `npx prisma migrate status` | 0 | PASS |
| `npm run build` | 0 | PASS |
| `npm run graphql-codegen` | 0 | PASS |
| CI YAML lint (`npx yaml-lint`) | 0 | PASS |

## Remaining blockers (outside this gate)

- Claude must independently verify this correction PR. **Done: BLOCKED.**
- Inventory-write release gates (idempotency, audit, reconciliation, reversal) still required before enabling any write flag.
- Compliance webhooks still acknowledge-only.
- Entitlement system still not implemented.
- Partner distribution still unconfirmed (`shopify app info` historically failed).
- npm audit still reports 32 high advisories (separate remediation decision).

## Next step

See `CORRECTION_FOLLOWUP_IMPLEMENTATION_REPORT.md`. Gate remains open until follow-up is green and Claude re-reviews.
