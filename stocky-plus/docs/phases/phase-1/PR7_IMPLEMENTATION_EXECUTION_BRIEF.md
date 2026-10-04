# PR7 implementation execution brief — checkpoint A

**Status:** `CHECKPOINT_B IMPLEMENTATION IN PROGRESS` (not complete-module acceptance; not B0 READY)

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
| `prisma/migrations/20261004180000_pr7_participating_write_guard/` | migrate-deploy catalog | guard functions exist before enforcement apply |
| `scripts/tenant-enforcement/sql.ts` `grantHelpersToRuntimeSql` | runtime EXECUTE | participating-write / lifecycle / generation_writable |
| `app/tenant/__tests__/helpers.ts` `resetPublicSchema` | tenant-access migrate deploy | now receives guard functions via the PR7 migration; no FORCE RLS |
| `app/sync/uninstall.server.ts` | `processUninstall` | guard + LIVE→UNINSTALLED |
| `app/sync/reinstall.server.ts` | `reactivateShopAfterVerifiedReinstall` | guard; REDACTED still denied |
| `app/sync/dispatcher.server.ts` | `ensureDispatchRecord`, disabled-shop path, `recoverExpiredDispatchLeases`, `recoverStrandedEnqueuedJobs` | guard in the write transaction |
| `app/sync/lifecycle.server.ts` | claim/heartbeat/success/retry/fail/dead-letter/reaper | guard |
| `app/sync/replay.server.ts` | `replayDeadLetter` | guard + authz lock/verify |
| `app/sync/health.server.ts` | `computeSyncHealth` | guard on upsert |
| `app/lib/order-facts/apply/writers.ts` | `requireProcessingEnabled` | processingEnabled **and** participating-write |
| `app/lib/catalog-facts/ingest/checkpoint.ts` | checkpoint persist/ack/complete | both gates |
| `app/jobs/queue.server.ts` | `drainOrdinaryQueueJobsForShop` | shop-scoped `job.remove`; never FLUSHALL |
| `app/jobs/workers/index.ts` | worker bootstrap | separate privacy coordinator loop |
| `app/privacy/execute.server.ts` | three processors | publication lock; Redis/D-scratch residual; customer child-first DELETE; no participating-write during ERASING |
| `scripts/tenant-enforcement/tests/pr7-privacy-races.test.ts` | races / provenance / residual / Redis / D-scratch | focused `test:migrations` file |

Newly created owned files: `app/audit/**`, `app/privacy/**`, `app/rbac/assignment.server.ts`, capture/admission/bound-effect, platform routes, `scripts/privacy/**`.

`app/sync/intake.server.ts` and `execution-strategy.server.ts` remain unchanged ordinary paths. No `useOnlineTokens`. Q-008 remains OPEN.
