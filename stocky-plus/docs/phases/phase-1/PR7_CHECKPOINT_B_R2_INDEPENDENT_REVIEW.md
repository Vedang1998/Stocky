# PR7 Checkpoint B — Round B2 independent review

- Review-Key: `propo:issue67:PR68_CHECKPOINT_B_REVIEW:B2:7e1c1ae93d2f452477ad18225747a56c967622d3:claude`
- Claim: PR68 comment 6050027385
- Session: https://claude.ai/code/session_01AVPw65Mb3M8fNcaY2YARmx (scheduled native Claude Code; exact model not verifiable from inside the session)
- Subject HB2 `7e1c1ae93d2f452477ad18225747a56c967622d3` (tree `15829e979ac28e8113aa71b1a74c7f7514e2ec8a`); base M `338717b8299016b37c02e5bdd452cc64f6161bdb`. Exact-head CI run 37702906837 attempt 1: success (API-read).
- Verdict: **CORRECTIONS REQUIRED**. B2 is the last permitted correction round; findings go to coordinator disposition.

## Evidence executed (disposable PG16 + Redis 7, synthetic data, CI-equivalent env; npm 11.5.2, node 22.22)
All exit 0 unless noted: prisma validate; migrate deploy; index apply/verify; schema drift; enforcement inventory check; role provision; enforcement preflight/apply/verify/drift; roles/rls/immutability verify; lint; typecheck; build; `test:privacy` 14 files 108/108; zero-name-filter guard; db-isolation 25/25; tenant-access 344/344; sync-integration 247/247; sync-performance 65/65 (includes D-051 gate and global-lock control); `npm test` 738/738 after generating the schema artifact with `npm run graphql-codegen` (my first run failed 24 tests only because that CI step was missing from my setup; re-run passed); `test:migrations` 768 pass/2 skip/1 fail — the failure `pr5-f3-lock-capacity-aw` (unchanged since M) was caused by my cluster's max_connections=200 and passes 12/12 on default settings. CI results match the author's.

**Unexecuted / not done by me:** reversion-based negative controls for F-01..F-11 (I did not revert fixes and re-run), HTTP-level route tests (none exist), live Shopify/App Bridge, real revocation, CI-only constrained-memory/non-superuser steps, PR8 load gates.
**Reused:** author CI evidence only where matched above.
Source review of the areas below was performed by read-only sub-reviewers inside this session and spot-checked by me; claims labelled *static* were not reproduced by execution.

## B1 finding status
| ID | Status |
|---|---|
| F-01 residual GUC bind | FIXED (processor test exercises it; fails on revert by reading) |
| F-02 dispatcher guards | FIXED in source; second-tx guard not behaviourally tested |
| F-03 discovery fail-closed | **PARTIAL** → R2-01 |
| F-04 exclusive lifecycle lock | Present in source; no test would fail if removed (static) |
| F-05 bound-effect tenant bind | Present in SQL; test not discriminating (same message from a later check) |
| F-06 uninstall/reinstall | FIXED; MANUAL untested |
| F-07 artifact/role purge | Present; no test (static) |
| F-08 AEAD AAD v2 + zero key | FIXED; tests for wrong domain/requestId absent |
| F-09 successor/HOL/Redis | **PARTIAL** → R2-02, R2-04 (Redis fail-closed FIXED and tested) |
| F-10 frozen-shop isolation | FIXED for lease/claim; claim path untested |
| F-11 control-plane grants | FIXED (grant test); finalize stale-attempt untested |
| D-051 gate replacement | Valid: structural commit-before-holder-release proof + restorable global-lock control; TPS now diagnostic only (P3) |
| B0-01..06 | Still present |

## New / remaining findings
**R2-01 P1 (static, source-confirmed) — participating-writer discovery is not per-site fail-closed.** `scripts/privacy/participating-writers.ts:~514-518`: only rows with `minGuardOccurrences` (2 rows) are checked inside the function; the other rows use file-level `text.includes(guard)`, which the import line satisfies. Removing the guard from e.g. `claimBatchFair` or `recoverExpiredDispatchLeases` still passes. The "injecting an unlisted host write" control passes a fake path through `extraWrites` and never exercises the scanner. `ALLOWED_WRITE_PATH_PREFIXES` still allows all of `app/routes`, `app/services`, `app/db`, `app/rbac`, `app/audit`, order/catalog-facts. Writers in `app/jobs/workers/catalog-facts/*`, `app/lib/order-facts/sync/control-plane.ts`, `app/sync/intake.server.ts` are unguarded and invisible to discovery (a late write can make finalize's Shop DELETE fail via `WebhookDelivery` Restrict — FK for other models unconfirmed). Expected: per-site guard assertion and a negative control that writes a real unlisted writer file. Missing test: scanner-level injection.
**R2-02 P1 (static, source-confirmed; not reproduced) — live-successor check runs only after destruction.** `processShopRedact` (`app/privacy/execute.server.ts:~256-300`) gates only on the target shop's `processingEnabled`; `finalizer_live_successor` is raised only inside `stocky_privacy_finalize_shop_delete` (`pr7-privacy-helpers.sql:~956-960`) after merchant rows, roles and artifacts are deleted and the generation is set FINALIZING. The error is uncaught in the coordinator, so the request stays FINALIZING/RUNNING, the old Shop is left REDACTED with data erased, and the domain-keyed generation freeze can block a successor install. Expected: successor precondition before any destructive step, and a handled INCOMPLETE state. Missing test: none references `finalizer_live_successor`.
**R2-03 P2 (static) — operator escalation inspection.** `app/routes/app.platform.privacy.escalation.tsx:20-27`: `?operator=1` bypasses tenant/owner auth; sole credential is a shared static env token over public HTTP; no throttling or audit; a wrong token surfaces as an unhandled boundary error (5xx). Missing test: route-level denial (403 + audit row).
**R2-04 P2 (static) — coordinator attempt fencing and retry.** `claimNextPrivacyAttempt` defaults every process to worker `"privacy-coordinator"`, so same-name leases look like our own and two coordinators can hold the same live attempt; failed attempts are re-claimed without backoff (5 epochs can burn in seconds) and the exhausted request sits INCOMPLETE without an escalation event.
**R2-05 P2 — tests that would not fail on revert:** F-04 lock (`execute.server.ts:~274,323`), F-07 purge, F-05 binding, F-02 second-tx guard, F-10 claim isolation, finalizer stale-attempt, wrong-domain/requestId AAD. `consumer-gates.test.ts` and the roles-source check are regex greps over route source, not behaviour.
**P3:** download route GET lacks `Cache-Control: no-store`/`Content-Disposition` and mutates `downloadedAt`; duplicate compliance webhook id acknowledged without comparing topic/shop/digest, concurrent duplicates give a unique-violation 5xx; invalid topic/domain webhooks return 5xx with no durable evidence; legacy v1 artifacts fail until TTL; `dispatchPendingJobs` guarded tx sits outside its `try`; `stocky_shop_canonical_domain` / `stocky_generation_writable` are runtime-callable lookup oracles; tables rely on the enforcement apply step for FORCE RLS (CI chain ran it); F-12 dispositions not claimed fixed; R1-01 deferred; Q-008 OPEN.

No P0 found. No cross-tenant exposure reproduced.

## Boundaries
No fixes, merge, CI rerun, label or Cursor trigger. Cleanup: disposable local PG/Redis and worktree only.
