# PR 4 — Synchronization Control Plane Implementation Report

**Phase:** 1  
**Work unit:** PR 4 — Synchronization control plane  
**Branch:** `phase-1/sync-control-plane`  
**Decision:** D-042  
**Starting main SHA:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Draft PR:** [#20](https://github.com/Vedang1998/Stocky/pull/20)  
**Production execution:** NOT AUTHORIZED  
**Inventory writes:** UNAPPROVED / flags DEFAULT OFF  
**PR 5:** BLOCKED  

> Exact-head CI evidence is recorded after the final pushed tip. Do not treat this report as independent review acceptance.

## Identity

| Field | Value |
|---|---|
| Starting main | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Branch | `phase-1/sync-control-plane` |
| Implementation commits (from main) | `0db313f` → `88ba3d5` → `65cef1a` → *(this tip)* |
| Current main (unchanged) | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| PR state | Draft #20 — OPEN, unmerged |

## Architecture summary

- **DB is durable SoT**; Redis/BullMQ is delivery only.
- Durable records: `WebhookDelivery`, `DurableJob`, `JobAttempt`, `DeadLetter`, `JobReplay`, `SyncRun`, `SyncCursor`, `ReconciliationRun`, `DataIssue`, `SyncHealth`.
- Shop lifecycle: `processingEnabled`, `processingDisabledReason`, disable/enable timestamps; helper `stocky_shop_processing_enabled(text)`.
- Table class: **platform_control_plane** (tenant-owned via non-null `shopId`; not merchant FORCE RLS).
- Roles: `stocky_runtime` has no control-plane DML; `stocky_control_plane` has sync-table DML + minimal Shop lifecycle.
- Envelope: `tenant-job-envelope-v2` (fresh signature per dispatch; binds durable job ID + payload digest). PR2 secret/source rules preserved.
- Intake: authenticate → sanitize → digest → DB txn (delivery + job) → HTTP 200 → best-effort dispatch.
- Dispatcher: `FOR UPDATE SKIP LOCKED`, finite lease, lease expiry recovery, BullMQ `jobId = durableJob.id`.
- Uninstall: durable disable + cancel pending + session delete; merchant RLS gated by processing enabled.
- API pin: Shopify Admin **2026-07** (`ApiVersion.July26`); no package bump required (SDK already exposes July26).

## Migration

| Item | Value |
|---|---|
| Name | `20260804180000_sync_control_plane` |
| Type | Additive only |
| Tables | 10 control-plane + Shop lifecycle columns |
| Helper | `stocky_shop_processing_enabled(text)` |
| `updatedAt` | NOT NULL without DB DEFAULT (matches Prisma `@updatedAt`; corrected before merge after schema-drift CI fail) |
| Empty/current-schema deploy (disposable PG16) | `npx prisma migrate deploy` → exit 0; “No pending migrations” on repeat |
| Schema drift | `npm run tenant:schema:drift` → `tenant_prisma_schema_drift_ok` after correction |
| Production execution | **Not run** |

## Local disposable evidence (environment)

| Item | Value |
|---|---|
| PostgreSQL | 16 (`stocky_plus_ci` @ localhost) |
| Redis | local `127.0.0.1:6379` |
| Commit at suite runs | tip after audit/RLS/test fixes (see git log) |
| Inventory-write flags | false |
| Real Shopify credentials | none |
| Merchant data | none |

### Commands executed (selected)

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | 0 | Clean |
| `npm run lint` | 0 | Clean |
| `npm run sync:inventory` / `:check` | 0 | 34 surfaces |
| `npm run tenant:access:audit` | 0 | 0 violations after EX-SYNC-* |
| `npm run tenant:access:inventory:check` | 0 | Fresh |
| `npm run tenant:enforcement:inventory:check` | 0 | Fresh |
| `npm run tenant:roles:verify` | 0 | `ok:true`, `failures:[]` |
| `npm run sync:roles:verify` | 0 | `ok:true` |
| `npm run tenant:rls:verify` | 0 | After predicate expect align |
| `npm run tenant:enforcement:drift` | 0 | `ok:true` |
| `npm run test:sync-integration` | 0 | **29 passed** (3 files) |
| `npm test` | 0 | **82 passed** (8 files) |
| `npm run test:db-isolation` | 0 | **19 passed** (2 files) |
| `npm run test:tenant-access -- queue-redis` | 0 | **4 passed** after v2 resolve |
| `npx vitest run --config vitest.tenant-access.config.ts scripts/tenant-access/architecture-audit.test.ts` | 0 | **25 passed** |
| `npm run test:migrations -- definition-drift.test.ts` | 0 | **11 passed** |
| `npm run graphql-codegen` | 0 | Against `2026-07` / `ApiVersion.July26` |
| `npm run build` | 0 | SSR build succeeded |
| `npm audit --omit=dev` | 0 (7 high reported) | Baseline; **no** `npm audit fix`; **no** dependency upgrade |

Full `npm run test:tenant-access` (all 34 files) was re-run after control-plane FK wipe helper; queue-redis previously failed on Shop FK / v1 resolve and was corrected. Aggregate re-confirmation deferred to exact-head CI.

## Failure-boundary evidence (`test:sync-integration`)

Covered in `app/sync/__tests__/sync-control-plane.integration.test.ts` (17) + unit/script suites (12):

- Durable idempotency (first/duplicate/distinct webhook; duplicate count)
- Redis-down intake (DB commit without Redis; later dispatch)
- Lease recovery / dual dispatcher / queue redelivery serialization
- Attempts, retry wait, dead letter (exactly one OPEN), monotonic attempts, concurrent attempt denial
- Replay (new job, lineage, fresh envelope, disabled-shop deny, digest tamper)
- Uninstall disable + race / session path
- Cross-shop denial on control-plane reads
- Sanitizer strips customer/contact fields

## Shopify validation

| Item | Result |
|---|---|
| Target | `2026-07` |
| SDK enum | `ApiVersion.July26` present — **no package bump** |
| `shopify.app.toml` | `api_version = "2026-07"` |
| `app/shopify.server.ts` | `ApiVersion.July26` |
| `npm run graphql-codegen` | exit 0 (local) |
| Dependency lockfile delta for API pin | **none** |
| Advisory delta | 7 high before/after (unchanged; no audit fix) |
| Q-003 | Remains **OPEN** — decision target set; closure needs exact-head CI webhook + GraphQL evidence |

## Risks / questions disposition

| ID | Disposition |
|---|---|
| R-031, R-032, R-033, R-039 | **OPEN** until independent PR 4 review |
| R-099..R-108 | **OPEN — pending independent review** (not closed on Cursor evidence) |
| R-095..R-098 | Untouched (accepted PR 3 residuals) |
| Q-003 | **OPEN** — target `2026-07`; needs exact-head validation |

## Explicit non-goals (confirmed)

No production deploy/migrate/queue; no inventory mutation; flags default OFF; no catalog/order/refund facts; no forecasting redesign; no privacy redaction (PR7); no billing/AI; PR 5 not started.

## Safety

- Production execution **NOT AUTHORIZED**
- Inventory-write flags **DEFAULT OFF**
- PR 5 **BLOCKED**
- Draft PR only — do not mark ready; do not merge

## Next action

```text
Return to ChatGPT for exact-head verification and the independent Claude Code PR 4 review prompt.
```
