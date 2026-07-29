# Current Command Baseline — Phase 0

**Branch:** `phase-0-product-alignment-v2`  
**Base main SHA:** `f1923acef0c44b1e80d0b5aae44a517aedf56aef`  
**Environment:** macOS darwin 25.4.0 · Node `v22.19.0` · npm `11.5.2`  
**Working directory:** `stocky-plus/`  
**Date:** 2026-07-29

Evidence standard: every check records exact command, exit status, and whether it passed, failed, or was blocked.

| Command | Exit | Status | Notes |
|---|---|---|---|
| `npm install` | 0 | **PASS** | 956 packages audited; 32 high severity advisories reported (not remediated this phase) |
| `npm run lint` | 0 | **PASS** | ESLint clean |
| `npm run typecheck` | 0 | **PASS** | `react-router typegen && tsc --noEmit` |
| `npm test` | 0 | **PASS** | 29 tests / 2 files (`forecasting.test.ts`, `characterization.test.ts`) |
| `npx prisma validate` | 0 | **PASS** | Schema valid |
| `npx prisma migrate status` | 0 | **PASS** | 1 migration; database schema up to date against local PostgreSQL |
| `npm run build` | 0 | **PASS** | Client + SSR build succeeded; React Router future-flag warnings only |
| `npx shopify version` | 0 | **PASS** | CLI `3.84.1` (global) |
| `npm run graphql-codegen` | 0 (task runner) / generate **FAILED** | **FAIL** | With network: schema loads; validation errors — `inventoryLevel` unknown args `inventoryItemId`/`locationId` (requires `id`); `inventoryTransferComplete` not on Mutation for 2025-10 |
| `npx shopify app info` | non-zero / crash | **FAIL** | Maximum call stack size exceeded in CLI; Partner linkage not confirmed this pass |
| Integration / E2E tests | — | **NOT EXECUTED** | No Playwright/integration script present in `package.json` |
| `npm audit` remediation | — | **NOT EXECUTED** | 32 high findings noted; deferred (outside Phase 0 safety scope) |

## Script inventory (`package.json`)

Present: `build`, `dev`, `lint`, `typecheck`, `test`, `setup`, `worker`, `db:migrate`, `db:push`, `db:seed`, `graphql-codegen`, Shopify CLI wrappers.

Absent: dedicated `integration`, `e2e`, `shopify app validate` npm scripts.

## Package manager consistency

- Cursor's local environment used a generated `package-lock.json`, but the repository currently ignores `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml`; no lockfile is tracked. The install result above is local evidence and is not fully reproducible from a fresh clone until one package manager and lockfile are committed.
- Engines: `node >=20.19 <22 || >=22.12` — satisfied by Node 22.19.0.
- No nested `stocky-plus/.git` directory is present in the repository. The parent `Vedang1998/Stocky` repository is the only Git authority.

## Independent Claude review note

Claude independently passed lint and build. Prisma engine downloads and Shopify schema access were blocked in Claude's sandbox, so Prisma validation, tests, typecheck, and GraphQL validation were not independently reproduced there. This does not erase Cursor's recorded results, but it means those results remain environment-specific until CI reproduces them from a clean checkout.
