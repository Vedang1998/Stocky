# PR7 Checkpoint B — B1 Independent Review

- Review-Key: `propo:issue67:PR68_CHECKPOINT_B_REVIEW:B1:8818e3d5544eda139a03538cd4705c69dc0b48c0:claude`
- Claim: PR68 comment 6047769465 · Session: https://claude.ai/code/session_018rP5RRXa9eK7LXWZT2mNCN (model not verifiable from inside the session)
- Subject HB1 `8818e3d5544eda139a03538cd4705c69dc0b48c0` (tree `8835219ae4185ca33ca9172b474b96856f3741e9`), base M `338717b8299016b37c02e5bdd452cc64f6161bdb`.
- Exact-head CI run 37676782021 attempt 1 (event pull_request): conclusion success, head_sha equals HB1 (read via API).

## Verdict: CORRECTIONS REQUIRED

## Evidence labels
- EXECUTED (this session, disposable PG16 + Redis 7, CI-equivalent env, synthetic data): prisma validate/migrate deploy; indexes apply; roles provision/verify; enforcement preflight/apply/verify; sync inventory check; sync roles provision/verify; lint; typecheck (after graphql-codegen); build; `test:privacy` 102/102; zero-name-filter guard; pr7 foundation 16/16; pr7 races 11/11; `npm test` 736/736; `test:tenant-access` 344/344; `test:sync-integration` 244/244 (includes d051); `test:sync-performance` 65/65; `test:db-isolation` 25/25; `test:migrations` 757 passed/2 skipped/1 failed — the failure (`pr5-f3-lock-capacity-aw`, file unchanged since M) was environmental (my first cluster used max_connections=300); it passes 12/12 on default settings (max_connections=100). `tenant:access:inventory:check` exit 0. All exit 0 unless stated.
- EXECUTED reproduction: F-01 below.
- SOURCE-CONFIRMED by me (read/grep): F-02, F-03, F-05.
- STATIC, reported by read-only review passes and NOT independently reproduced: F-04, F-06..F-12 (marked).
- NOT EXECUTED: live Shopify/App Bridge, HTTP-level route tests (none exist), CI-only constrained-memory/non-superuser steps, Redis/scratch race winners against adapters beyond the repository tests.

## B0 finding closure
B0-01 (owner-proof grant/revoke, last-owner deny), B0-02 (shop-bound download), B0-04, B0-05, B0-06: fixes present in source with covering tests (static read; route tests are source-grep only, no behavioural Request tests — P3). B0-03: PARTIAL — see F-03. D-051 gate: HOL commit-before-holder-release plus owned global-lock blocked-before-release negative with byte-for-byte restore are present and passed here (12/12 sync-integration and performance); test-only; production lock SQL untouched. Reads as a valid replacement.

## Findings
**F-01 P1 — shop/redact residual check cannot fail (fail-open).** `app/privacy/execute.server.ts:301-304` calls `stocky_privacy_shop_residual_count` (`scripts/tenant-enforcement/pr7-privacy.ts:491-510`, SECURITY DEFINER, owner `stocky_privacy_target_owner`) outside a transaction/GUC context; its only visibility policy depends on `stocky.privacy_request_id`, so RLS hides all rows. Reproduced: with one `DurableJob` row present for a shop, the function returned `0` both as superuser and `SET ROLE stocky_control_plane`. Impact: leftover rows never yield INCOMPLETE; request proceeds to finalize/COMPLETED (violates "RLS-invisible ≠ absent"). Fix: validate GUC/attempt inside the function and raise; call in the GUC-bearing transaction. Missing test: leftover row must produce non-zero/INCOMPLETE.

**F-02 P1 — participating-write guard missing in dispatcher.** `app/sync/dispatcher.server.ts:1251` transaction (stranded-job terminalization: DurableJob/JobDispatch/dead-letter writes) and the bare `prisma.$executeRaw` at `:1475` have no `assertParticipatingWriteGuardForShop` (guard calls exist at 1103 and 1401 only). Writes can commit for an ERASING/FINALIZING shop after Redis I/O. Missing test: freeze shop then run `recoverStrandedEnqueuedJobs`.

**F-03 P1 — writer-discovery cannot fail closed.** `scripts/privacy/participating-writers.ts:325-337` only checks `text.includes(symbol)` / `includes(guard)` per file (dispatcher passes via the import); whole directories (app/routes, app/sync, app/tenant, app/jobs, app/privacy, …) are allowlisted so new writers there are never flagged (static); the omission-control test never injects an unlisted writer (static); `pg` `client.query` writes and `createManyAndReturn` are not matched (static).

**F-04 P1 (static) — shop erasure never takes `stocky_lifecycle_exclusive_lock`.** grep (excluding tests) finds only the grant lists in `pr7-privacy.ts:58,97`; erasure flips the fence under the publication lock only, so a writer holding the shared lock having read the fence earlier can commit after the DELETE pass; F-01 hides the resulting orphans.

**F-05 P1 — `stocky_apply_bound_customer_effect` trusts caller `p_shop_id`.** `sql/pr7-privacy-helpers.sql:~2083-2092`: only `session_user` is checked, `v_shop := p_shop_id` with no comparison to `stocky_current_tenant_id()`; static analysis indicates a tenant-A runtime session can write AuditEvent/SourceEffectLink for tenant B (and `AuditEvent` PK is `(id)`). Cross-tenant write not reproduced; the missing binding is source-confirmed.

**F-06 P1 (static) — late/replayed uninstall can overwrite REDACTED/MANUAL reason** (`app/sync/uninstall.server.ts:132,172`) and reinstall (`reinstall.server.ts`) re-enables; also read-then-update race in reinstall.

**F-07 P2 — data-request artifacts and lookup identifiers never purged; shop/redact does not cover `PrivacyDataRequestArtifact`, `ShopRoleAssignment` (static).**

**F-08 P2 — B0-03 residual: AES-256-GCM is used but no AAD** (`app/privacy/artifact-crypto.server.ts`, no `setAAD`; grep for AAD in app/privacy,app/rbac is empty). The READY packet claims "shop-bound AEAD"; binding is DB-check only. Also all-zero key accepted outside tests (P3), download is a side-effecting GET (P3).

**F-09 P2 (static)** — shop/redact has no uninstalled-generation precondition (`execute.server.ts:262-280`); unbounded retry/head-of-line blocking and no per-worker fencing in `coordinator.server.ts`; unbatched deletes; Redis check skipped when `REDIS_URL` unset (fail-open) in `external-residual.server.ts`.

**F-10 P2 (static)** — one frozen shop aborts `recoverExpiredDispatchLeases`/`claimBatchFair` for all tenants (`dispatcher.server.ts:145-157, ~213`).

**F-11 P2 (static)** — control-plane role can UPDATE/DELETE `PrivacyCoordinatorEvent`/`PrivacyCompletionReceipt`; `stocky_privacy_finalize_shop_delete` lacks live-attempt/lock check; `stocky_verify_platform_assignment` cross-tenant oracle; `stocky_note_queued_work`/`mark_uncorrelated_captures_contradicted` do not bind shop/domain; admission principal falls back to elevated URLs when `NODE_ENV!=="production"`.

**F-12 P3 (static)** — lock functions no-op on NULL; non-constant advisory-lock keys; `cancelled` flag semantics change in disabled-shop dispatch path; HMAC-labelled column stores plaintext shop id; invalid-intake returns 5xx without durable evidence; no behavioural route tests.

## Coverage statement
Reviewed: all B0 fixes, D-051 gate, privacy executor/coordinator/intake/external-residual, participating-writer inventory and dispatcher/lifecycle guards, and all 2,242 lines of helper SQL (by read-only passes; line-level reading is not exhaustive for `enumerate_targets`, customer-barrier bodies, `app/lib/order-facts` writers, `app/jobs/workers`). No live Shopify and no HTTP route tests exist, so route behaviour beyond source reading is unexecuted. Approval is not claimed.

## Boundaries
No fixes, merges, CI reruns, labels, Cursor trigger or subject edits. Cleanup: disposable local PG/Redis only.
