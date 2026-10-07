# PR7 implementation execution brief — checkpoint A

**Status:** `CHECKPOINT_B B1 CORRECTION IN PROGRESS` (not complete-module acceptance; not B1 READY)

**Date:** 2026-09-30

This is the durable scope record for the admitted PR7 runtime assignment. It does **not** accept checkpoint A, authorize checkpoint B, mark the module complete, merge, deploy, enable `useOnlineTokens`, or consume owner proof on merchandising/download routes.

## 1. Authority

| Field | Value |
|---|---|
| Work order | Issue [#67](https://github.com/Vedang1998/Stocky/issues/67) `PROPO_PR7_RUNTIME_EXECUTION_V1` |
| Coordinator admission | issue52 comment `5902985297` |
| Dispatch key | `propo:5900247427:PR7_RUNTIME_IMPLEMENTATION:338717b8299016b37c02e5bdd452cc64f6161bdb:cursor` |
| Tool | Cursor Cloud Agent |
| Run | `bc-dedc6c27-79fa-409b-8a95-c0a3d36efff3` |
| Reported model | `cursor-grok-4.6-xhigh` (dispatched; not inferred from a requested label) |
| Writer | this run only; no helpers |
| Starting base **M** | `338717b8299016b37c02e5bdd452cc64f6161bdb` |
| `M^{tree}` | `aeb8653755718c25daeef8399777c4a5b9a96700` |
| Live `origin/main` at admission | `338717b8299016b37c02e5bdd452cc64f6161bdb` (equals M) |
| Branch | `phase-1/pr7-audit-roles-privacy-fff3` (requested `phase-1/pr7-audit-roles-privacy` + platform suffix `-fff3`) |
| PR45 | merged / untouched |
| Competing author | none (issue 67 comments were the dispatch plus this run’s ACK; no matching implementation branch/PR) |

## 2. Checkpoint contract (this writer, this branch)

**Now (checkpoint A only):**

1. Cryptographically verify the embedded ID token with lockfile-pinned `@shopify/shopify-api` `decodeSessionToken` (jose HS256, audience, exp/nbf). No home-grown JWT cryptography. No dependency upgrade.
2. Require exact-string `sub` (`^[0-9]+$`), expected algorithm/audience/time, and canonical issuer/destination hostname agreement **before** token exchange, session bootstrap, or privileged credential use.
3. Preserve tenant-only merchandising via `requireAdminTenant`. Actor absence/unsupported representation denies **new platform powers**, does not invent `shop_owner`, and does not convert staff into a system actor.
4. Request-bound owner-proof adapter: isolated online token-exchange, validate `associated_user` binding **before** that access token is used, isolate from ordinary offline sessions and legacy online cache entries. Fail closed (`OWNER_PROOF_UNSUPPORTED` or a precise denial). No rounded-number recovery. No first-login / installer / email / `sub` / offline-token owner grant.
5. Tests drive the **installed** `authenticate.admin` with synthetic signed tokens. Mock outbound transport and isolated session storage only. Do **not** stub `authenticate.admin` into success. Observe first outbound credentials; zero side effects on identity rejection. Never log tokens/secrets.
6. Add `test:privacy` with nonzero execution and explicit zero-collection failure. Preserve existing CI; add the distinct privacy command.

**Forbidden until independent A review + coordinator CONTINUE:**

- Bootstrap owner roles, owner-only downloads, or consuming the positive owner proof in merchandising/afterAuth.
- Global `useOnlineTokens`.
- Checkpoint B schema/migrations/privacy processors/writer admission/publication protocol.
- Production, live Shopify, inventory writes, merge, PR8.

## 3. Initial inventory (exact M, before runtime edits)

| Path | Observation |
|---|---|
| `app/shopify.server.ts` | `shopifyApp` with `future.expiringOfflineAccessTokens: true`; **`useOnlineTokens` unset** (library default false); `afterAuth` bootstraps tenant + catalog enqueue |
| `app/tenant/require-admin-tenant.server.ts` | Shop authority from `authenticate.admin` + canonical Shop; does not read `sessionToken.sub` / `session.userId` / `onlineAccessInfo` |
| `app/rbac/**` | absent |
| `app/audit/**`, `app/privacy/**`, `scripts/privacy/**` | absent (checkpoint B) |
| Installed `@shopify/shopify-app-react-router` | 1.2.1 (lockfile) |
| Installed `@shopify/shopify-api` | 13.1.0 (lockfile) |
| PR49 evidence (read-only) | `44fa47f1fdb29f60d34c099ce7580807dad1c1f6` — AUTH-X-06/07/09/14/21 remain the counterexamples this checkpoint must fail closed |
| Q-008 | remains OPEN |
| D-055 | not created |

## 4. Exclusive file contract (checkpoint A)

Owned now: `app/rbac/**`; narrow `app/tenant/require-admin-tenant.server.ts` + types/tests; `vitest.privacy.config.ts`; `package.json` `test:privacy` only; `.github/workflows/ci.yml` additive privacy step; `.env.example` named nonsecret PR7 defaults; PR7 execution brief/report/test map; latest-state entries in `PROJECT_STATUS.md`, `docs/README.md`, `phases/phase-1/README.md`; one dated D-054 subitem (no D-055).

Do not edit: accepted plan/matrix appendices, immutable reviews, `AGENTS.md`/`CLAUDE.md`/`.cursor` rules, `CI_POLICY.md`, product strategy, PR49/53/54 branches, `package-lock.json`.

## 5. R1 correction contract (additive)

**Dispatch-Key:** `propo:issue67:PR68_CHECKPOINT_A_R1:51c4b701b79249833ec22ed6bc96415fa8d8f3a4:cursor`

Checkpoint-A reviewer-correction round 1 of maximum 2. Not checkpoint B.

Immutable independent review R `12c7a709da01f28c739a5698ec040a5faceedbcb` (blob `5ff31d304a5806e0b6640f7070ef7e595fffb106`) is preserved as original history. Corrections bind memoization to request+token+actor+shop+verifier, store owner credentials only in a module-private WeakMap, recheck private expiry at last use, convert invalid embedded credentials at the HTTP wrapper to the library 401+retry / document-bounce contract without sending those tokens through `authenticate.admin`, compare verified dest with `session.shop` before issuing tenant authority, and document F-06 Linux `/proc` plus sampled-length limits. Dead `blocksAuthentication` / `assertIdentityDoesNotBlock` / test-only `clientAccountOwner` / `fresh` bypass / invented 24h expiry are removed.

Mutable scope remains: `app/rbac/**`; `app/tenant/require-admin-tenant.server.ts` and focused `app/tenant/__tests__/`; process-loss test/helper files only for F-06 evidence; this brief and `PR7_IMPLEMENTATION_REPORT.md`.

Mechanical inventory dependency (reported before expanding): exact-head Heavy `36954009774` failed `tenant:access:inventory:check` because R1 added `app/rbac/__tests__/require-admin-tenant-boundary.test.ts` (scannedFiles 521→522, no Prisma findings) and shifted/added EX-TEST-002 write sites in already-allowlisted `app/tenant/__tests__/authority.test.ts` (37/38/43 → 52/53/58 plus 202/203/207). The one additional regenerated path is `docs/phases/phase-1/PR2_TENANT_ACCESS_INVENTORY.md`. No new exception IDs. No schema/CI/lockfile change.

## 6. Checkpoint B (CONTINUE `PROPO_PR68_CONTINUE_B_V1`)

**Dispatch-Key:** `propo:issue67:PR68_CHECKPOINT_B:02defc9233c4f8da66194eabad0cb77d30079e91:cursor`

**Status:** checkpoint B implementation in progress on this branch. Not READY until complete matrix + exact-head Classify/Heavy/Gate.

Accepted A head H1 `02defc9233c4f8da66194eabad0cb77d30079e91`. RA `43c93e5136c080c82d1f344aba31d5cac0bcaff0` fast-forwarded. Base M unchanged.

### B prerequisites (R1 residuals)

- **R1-02:** owner-proof memo binds `verifier.identity` (SHA-256 of apiKey+secret+hostName), not apiKey alone.
- **R1-03:** `__setOwnerProofNowMsForTests` is inert unless `VITEST=true` and `NODE_ENV!==production`.
- **R1-01:** no B cross-origin/POS/extension caller adopts `requireAdminTenant`. Platform replay/escalation/download are same-origin embedded admin. CORS parity deferred; do not widen origins.

### Source-derived participating-site ownership (listed before shared integration)

Named §7.9 hosts receiving the lifecycle shared guard or equivalent:

| File | Symbol | Guard |
|---|---|---|
| `app/tenant/after-auth.server.ts` | `runAfterAuthTenantBootstrap` | erasure fence + LIVE generation |
| `app/tenant/bootstrap.server.ts` | `upsertCanonicalShop` | `stocky_participating_write_guard` |
| `app/tenant/db-context.server.ts` / `tenant-db.server.ts` | tenant transaction hosts | required participating-write guard |
| `prisma/migrations/20261004180000_pr7_participating_write_guard/` | migrate-deploy catalog | lifecycle/generation/participating-write functions exist before enforcement apply |
| `prisma/migrations/20261004190000_pr7_timestamptz_index_names/` | migrate-deploy catalog | PR7 DateTime columns TIMESTAMPTZ(3); truncated unique/index names match Prisma |
| `prisma/migrations/20261004200000_pr7_shop_canonical_domain/` | migrate-deploy catalog | `stocky_shop_canonical_domain(text,text)` plus EXECUTE for `stocky_runtime` / `stocky_control_plane` on the ForShop helpers (PUBLIC remains revoked) |
| `scripts/tenant-enforcement/sql.ts` `grantHelpersToRuntimeSql` + `grantMigratedLifecycleHelpersToRuntime` | runtime + control-plane EXECUTE | tenant helpers always; lifecycle/generation/participating-write/canonical-domain granted to the actual runtime role and, when present, `stocky_control_plane` (SET ROLE when already re-owned) |
| `app/tenant/__tests__/helpers.ts` `resetPublicSchema` | tenant-access migrate deploy | now receives guard functions via the PR7 migration; no FORCE RLS |
| `app/sync/uninstall.server.ts` | `processUninstall` | guard + LIVE→UNINSTALLED |
| `app/sync/reinstall.server.ts` | `reactivateShopAfterVerifiedReinstall` | guard; REDACTED still denied |
| `app/sync/dispatcher.server.ts` | `ensureDispatchRecord`, disabled-shop path, `recoverExpiredDispatchLeases`, `recoverStrandedEnqueuedJobs` | guard in the write transaction |
| `app/sync/lifecycle.server.ts` | claim/heartbeat/success/retry/fail/dead-letter/reaper | guard |
| `app/sync/replay.server.ts` | `replayDeadLetter` | guard + authz lock/verify |
| `app/sync/health.server.ts` | `computeSyncHealth` | guard on upsert |
| `app/lib/order-facts/apply/writers.ts` | `requireProcessingEnabled` | processingEnabled **and** participating-write; void `stocky_participating_write_guard` is wrapped as `SELECT 1::int` via `$queryRaw` because Prisma cannot deserialize `void` and TenantDb forbids `$executeRaw` (`raw_client_escape`) |
| `scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts` | `ALL_MIGRATION_NAMES` | fail-closed on-disk allowlist; parks PR6-A successor **and later PR7 folders** so Prisma cannot apply PR7 before `20260907020000` |
| `scripts/tenant-enforcement/sql/pr7-privacy-helpers.sql` | Shop/job-family GRANTs | runtime Shop DML only; no table-level Shop UPDATE or Session/`SyncApplicationReceipt` DML to `stocky_control_plane` |
| `scripts/tenant-enforcement/roles.ts` | `provisionRoles` phase `grants`/`full` | re-`provisionControlPlaneRole` after PR7 helpers and before merchant DML |
| `app/lib/catalog-facts/ingest/checkpoint.ts` | checkpoint persist/ack/complete | both gates |
| `app/jobs/queue.server.ts` | `drainOrdinaryQueueJobsForShop` | shop-scoped `job.remove`; never FLUSHALL |
| `app/jobs/workers/index.ts` | worker bootstrap | separate privacy coordinator loop |
| `app/privacy/execute.server.ts` | three processors | publication lock; Redis/D-scratch residual; customer child-first DELETE; no participating-write during ERASING |
| `scripts/tenant-enforcement/tests/pr7-privacy-races.test.ts` | races / provenance / residual / Redis / D-scratch | focused `test:migrations` file |
| `scripts/privacy/assert-zero-name-filter-guard.ts` | CI zero-name-filter wrapper | exits 0 only when vitest `-t` zero-match exits 1 with `[ci-guard] testNamePattern`; does not weaken the reporter |
| `scripts/tenant-access/allowlist.ts` | exact-file exceptions | B1 listed before adding `artifact-crypto` / `replay-digest` / assignment and fulfillment tests / db-isolation platform-authorization file |
| `app/tenant/__tests__/db-isolation/pr7-platform-authorization.test.ts` | B1 last-owner / shop-bind / AEAD | enforced catalog; authentic owner proof |

### B1 correction (B0 findings)

**round=B1.** Input HB0 `52f8462` + review artifact `3244477`. R1-01 still deferred (same-origin only). Q-008 OPEN.

- B0-01: `requirePlatformOwner` + authentic WeakMap owner proof on grant/revoke; last-owner revoke denied.
- B0-02: download binds server `shopId` + `canonicalDomain`; mismatch ≡ missing.
- B0-03: AES-256-GCM via `STOCKY_PRIVACY_ARTIFACT_KEY`; fail closed if missing. AEAD tests set a synthetic fixture key so default `npm test` (no privacy-config env) still encrypts; missing-key case deletes it. `6bfff95` Heavy unit step failed before this.
- B0-04: role write and audit in the same tenant transaction; zero-row revoke is `failed`.
- B0-05: existing replay commandId requires digest match.
- B0-06: operator token hash-then-`timingSafeEqual`.

Newly created owned files: `app/audit/**`, `app/privacy/**`, `app/rbac/assignment.server.ts`, capture/admission/bound-effect, platform routes, `scripts/privacy/**`.

`app/sync/intake.server.ts` and `execution-strategy.server.ts` remain unchanged ordinary paths. No `useOnlineTokens`. Q-008 remains OPEN.

### B1 D-051 no-convoy gate repair (test-only scope amendment)

**Task-Key:** `propo:issue67:PR68_D051_GATE_REPAIR:edf7ac9e17464782115dc9e85b893985f77cf210:cursor` (work order `6044918346`). This adds `app/sync/__tests__/d051-corrections.test.ts` to B1 exclusive files. Sync runtime, schema, migrations, workflows, and historical review blobs stay frozen.

The no-global-convoy requirement is the HOL/commit-before-holder-release invariant plus an owned disposable global-lock negative that must observe **blocked-before-release**, then restore `pg_get_functiondef` and rerun the per-shop control. Wall-clock `intake10.tps > intake1.tps` is diagnostic telemetry only. Sampler counters (`advisoryWaitMax` / `advisoryGrantedMax`) are supplemental, not the gate.

Diagnosis `6041369118` qualifications (must not be restated as six parent/current checkouts): the six local baseline repetitions used the **E working tree** with P/E-labelled slots after inspecting that the D-051 **test file blob** and `app/sync`/`prisma` D-051 lock functions matched P for those paths. That is relevant-input equivalence on those files, **not** identity of all main/PR7 schema/runtime trees. Local runs did not reproduce the CI invert; connection-outside-window did not establish the cause.

Mechanical `PR2_TENANT_ACCESS_INVENTORY.md` refresh under CONTINUE B standing inventory admission: the allowed D-051 **test** file shifted existing EX-SYNC-TEST-017 line sites. Exception IDs unchanged; findings 1812; violations 0; digest `3421a59d…`. No new exception. Not a sync-runtime edit.
