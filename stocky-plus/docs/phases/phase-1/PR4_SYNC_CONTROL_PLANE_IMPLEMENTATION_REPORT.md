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

> Exact-head CI evidence below. Do not treat this report as independent review acceptance.

## Identity

| Field | Value |
|---|---|
| Starting main | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Branch | `phase-1/sync-control-plane` |
| Runtime/test implementation head (last runtime change) | `89aeea885f833a913183bde6a4a5159ac9b20261` |
| Documentation tip | `fc320668e3222a1969ce97467e6cf39b376d3aed` |
| Current main (unchanged) | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| PR state | Draft #20 — OPEN, unmerged |

Commits since main: `0db313f` → `88ba3d5` → `65cef1a` → `c2870cc` → `0111e4e` → `588fe0a` → `8871175` → `89aeea8` → `fc320668e3222a1969ce97467e6cf39b376d3aed`.

## Exact-head CI evidence (runtime/test head `89aeea8`)

| Field | Value |
|---|---|
| Workflow | CI |
| Run ID | `30942153868` |
| Job ID | `92103022116` |
| Job name | Lint, typecheck, test, build, Prisma, GraphQL |
| Actual `head_sha` | `89aeea885f833a913183bde6a4a5159ac9b20261` |
| Conclusion | **success** |
| Success steps | **101** |
| Skipped material steps | **none** (0 skipped) |

If a later documentation-only tip exists, distinguish it from this runtime/test CI head and obtain a new exact-head run when required.

### Superseded failed runs (same PR branch)

| Head | Run ID | Failed step |
|---|---|---|
| `65cef1a` / `c2870cc` | `30937391139` / `30938113803` | Prisma schema drift (`updatedAt` DEFAULT) |
| `0111e4e` | `30938431407` | Tenant queue/Redis — missing `DATABASE_CONTROL_PLANE_URL` |
| `588fe0a` | `30939606604` | Enforcement preflight — stale PR2 access inventory |
| `8871175` | `30939905209` | Migration suite — sync migration before Shop in init-only park |

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
| `updatedAt` | NOT NULL without DB DEFAULT (matches Prisma `@updatedAt`) |
| Empty/current-schema deploy | CI `prisma migrate deploy` success on `89aeea8` |
| Schema drift | CI `tenant:schema:drift` success |
| Production execution | **Not run** |

## Local disposable evidence (environment)

| Item | Value |
|---|---|
| PostgreSQL | 16 (`stocky_plus_ci` @ localhost) |
| Redis | local `127.0.0.1:6379` |
| Inventory-write flags | false |
| Real Shopify credentials | none |
| Merchant data | none |

### Selected local commands (pre-final CI tip)

| Command | Exit | Notes |
|---|---|---|
| `npx tsc --noEmit` | 0 | Clean |
| `npm run lint` | 0 | Clean |
| `npm run sync:inventory` / `:check` | 0 | 34 surfaces |
| `npm run tenant:access:audit` | 0 | 0 violations after EX-SYNC-* |
| `npm run test:sync-integration` | 0 | **29 passed** (3 files) |
| `npm test` | 0 | **82 passed** (8 files) |
| `npm run test:db-isolation` | 0 | **19 passed** (2 files) |
| `npm run graphql-codegen` | 0 | Against `2026-07` / `ApiVersion.July26` |
| `npm run build` | 0 | SSR build succeeded |
| `npm audit --omit=dev` | 0 (7 high reported) | Baseline; **no** `npm audit fix`; **no** dependency upgrade |

## Failure-boundary evidence (`test:sync-integration`)

Covered in integration + unit suites (29 tests): durable idempotency; Redis-down intake; lease recovery; dual dispatcher; attempts/dead letter; replay lineage; uninstall race; cross-shop denial; sanitizer privacy.

## Shopify validation

| Item | Result |
|---|---|
| Target | `2026-07` |
| SDK enum | `ApiVersion.July26` — **no package bump** |
| `shopify.app.toml` / `shopify.server.ts` | pinned |
| CI GraphQL codegen step | success on `89aeea8` |
| Dependency lockfile delta for API pin | **none** |
| Advisory delta | 7 high unchanged |
| Q-003 | Remains **OPEN** — decision target set; exact-head GraphQL validation executed in CI |

## Risks / questions disposition

| ID | Disposition |
|---|---|
| R-031, R-032, R-033, R-039 | **OPEN** until independent PR 4 review |
| R-099..R-108 | **OPEN — pending independent review** |
| R-095..R-098 | Untouched |
| Q-003 | **OPEN** — target `2026-07`; CI codegen/schema validation green on `89aeea8` |

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
