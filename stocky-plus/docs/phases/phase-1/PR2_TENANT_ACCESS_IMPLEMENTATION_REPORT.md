# PR 2 — Tenant Access Implementation Report

**Phase:** 1  
**Work unit:** PR 2 — Tenant-bound access conversion  
**Branch:** `phase-1/tenant-access`  
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`  
**Status:** AUTHORIZED FOR PR 2 IMPLEMENTATION — PENDING INDEPENDENT REVIEW AND CHATGPT ACCEPTANCE

## Identity

| Field | Value |
|---|---|
| Starting main SHA | `04289d61f605414597ac85f47830a3c9d2f9e33d` |
| Branch | `phase-1/tenant-access` |
| PostgreSQL | 16.14 |
| Node | 22.19.0 |
| npm | 11.5.2 |

## Commits

1. `2a14f19d220c46c0ecab186377cf7bd6f3dd9d2b` — Convert app and webhook routes to tenant-bound DB access (foundations + route/service/job conversion)
2. `219a5e3dda85cf781839f418d004f09a25573b50` — Share phase1-shop-domain-v1 via app/tenant/shop-domain
3. `80e928b52102cde19f357822cd1b1dc0824d062b` — Add PR 2 tenant access evidence and tests

## Architecture decisions

- Shared normalization at `app/tenant/shop-domain.ts` (`phase1-shop-domain-v1`); `app/lib/shop-domain.ts` re-exports
- Branded authority via module-private `WeakSet`
- Tenant DB implemented as explicit scoped delegates (not a leaky generic proxy)
- Unique ops rewritten to scoped findFirst/updateMany/deleteMany
- Job envelope `tenant-job-envelope-v1` for workers; ABC cron enumerates `Shop` only
- Deterministic TS compiler-API scanner enforces architecture in CI

## Changed surface (summary)

- `app/tenant/**` — authority, bootstrap, tenant-db, admin helper, job envelope, webhook/scheduler/afterAuth
- All merchant-touching routes converted to `requireAdminTenant` + `TenantDb`
- Services (`forecasting`, `landed-cost`, `shopify-sync`) accept `TenantDb`
- Queue / webhook processor / cron converted to envelopes
- `scripts/tenant-access/**` — scanner, allowlist, inventory generator, fixtures, audit tests
- CI workflow adds audit + inventory check + tenant-access tests before lint
- Docs: architecture, inventory (generated), this report; D-027; status/risk/phase README updates

## Inventory totals (mechanical)

| Metric | Value |
|---|---|
| Files scanned | 121 |
| Findings | 411 |
| Converted findings | 205 |
| Approved-exception findings | 206 |
| Violations | 0 |
| Merchant models covered | 18 / 18 |
| Exception definition IDs | EX-RAW-001, EX-BOOT-001, EX-TDB-001, EX-BF-001, EX-IDX-001, EX-SEED-001, EX-TEST-001 |

Generated inventory: `docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`

## Baseline commands (pre-implementation)

Environment: disposable PostgreSQL 16; all inventory-write flags `false`; starting SHA `04289d61…`.

| Command | Exit |
|---|---|
| `npm ci` | 0 |
| `npx prisma generate` | 0 |
| `npx prisma validate` | 0 |
| `npx prisma migrate deploy` | 0 |
| `npm run tenant:indexes:apply -- --apply` | 0 |
| `npm run tenant:indexes:verify` | 0 |
| `npm run tenant:schema:drift` | 0 |
| `npm run tenant:indexes:plan` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 |
| `npm run test:migrations` | 1 (pre-existing env: `EXDEV` rename in parked-migration test) |
| `npm run test:subject-memory` | 0 |
| `npm run build` | 0 |
| `npm run graphql-codegen` | 0 |

The migration-suite `EXDEV` failure is an environment limitation (cross-device `rename` of a migration folder), not introduced by PR 2.

## Tenant-access tests

| Suite | Result |
|---|---|
| `npm run tenant:access:audit` | 0 |
| `npm run tenant:access:inventory:check` | 0 |
| `npm run test:tenant-access` | 0 — **48 passed** (5 files) |

Coverage includes two-Shop isolation across direct and child models, authority denial matrix, bootstrap boundary, job-envelope validation, and architecture-audit negative fixtures.

## Explicit non-claims

- No PostgreSQL RLS / roles / `BYPASSRLS` checks
- No non-null `shopId` enforcement
- No composite tenant foreign keys
- No production backfill or production deployment
- No PR 3 / PR 4 control-plane persistence
- No inventory-write enablement — all flags remain default OFF
- R-039 not fully closed (persistence/replay remain PR 4)
- F-016 / R-022 / Q-011 remain open until PR 3

## Remaining risks

See `RISK_REGISTER.md` updates for R-024, R-027, R-038, R-039 dispositions after PR 2 application-access scope.

## Next action

Return to ChatGPT for exact-head verification and the independent Claude Code review prompt.
