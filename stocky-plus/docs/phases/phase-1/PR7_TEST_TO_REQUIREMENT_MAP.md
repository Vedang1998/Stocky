# PR7 checkpoint A — test-to-requirement map

Maps checkpoint A acceptance-matrix actor/owner rows to repository tests. Historical 505-row feasibility counts are **not** application coverage. Checkpoint B rows remain unmet by design.

| Matrix / AUTH-X ID | Requirement | Test home | Expected (A) |
|---|---|---|---|
| PR7-ACT-003 | exact string `sub` | `app/rbac/__tests__/actor.test.ts` | actor `548380009` |
| PR7-ACT-004 | actor without online tokens | `installed-auth-boundary.test.ts` | `useOnlineTokens` unset; `sessionToken.sub` present; not owner |
| PR7-ACT-005 | no sub → platform deny | `actor.test.ts` | `AUTH_PLATFORM_DENIED` |
| PR7-ACT-012 | ID token ≠ access token | `installed-auth-boundary.test.ts` | GraphQL `X-Shopify-Access-Token` is not the JWT |
| PR7-ACT-015 | `sub` is not owner | `owner-proof.test.ts` | no `shop_owner` from sub/offline |
| PR7-ACT-016 / AUTH-X-14 | iss/dest mismatch | `id-token.test.ts`, `installed-auth-boundary.test.ts` | deny **before** token-exchange fetch |
| PR7-ACT-018 / AUTH-X-00 | wide sub string preserved | `actor.test.ts` | `9007199254740993` |
| PR7-ACT-020 | safe-integer owner | `owner-proof.test.ts` | `status=owner` |
| PR7-ACT-021 / AUTH-X-23 | wide owner unsupported | `owner-proof.test.ts` | `OWNER_PROOF_UNSUPPORTED` |
| PR7-ACT-022 | adjacent wide ids distinct | `actor.test.ts` | `…992` ≠ `…993` |
| PR7-ACT-023 | sub vs associated_user mismatch | `owner-proof.test.ts` | unsupported/denied; token unused |
| PR7-ACT-024 / AUTH-X-06/07/09 | mixedToken / stale cache / concurrent | `installed-auth-boundary.test.ts` | adapter does not adopt cache; no wrong first GraphQL |
| AUTH-X-01 | offline embedded | `installed-auth-boundary.test.ts` | offline session; GraphQL offline token |
| AUTH-X-03 | numeric JWT sub | `actor.test.ts` | unsupported actor; not rounded recovery |
| AUTH-X-05 | wide numeric JWT sub | `actor.test.ts` | unsupported |
| AUTH-X-08 | same sub two shops | `installed-auth-boundary.test.ts` | dest-bound; no cross-shop GraphQL |
| AUTH-X-10/11/12/15 | exp / malformed / sig / aud | `id-token.test.ts` | 401-class deny; zero exchange |
| AUTH-X-13 | expired stored online | `owner-proof.test.ts` | fresh exchange or deny; not expired token |
| AUTH-X-17/18/19 | owner / staff / collaborator flags | `owner-proof.test.ts` | owner only when `account_owner` and not collaborator |
| AUTH-X-20 | client body `account_owner` | `owner-proof.test.ts` | ignored |
| AUTH-X-21 | lookup/store id mismatch | `installed-auth-boundary.test.ts` | fail closed; no wrong credential use |
| AUTH-X-27 | missing `associated_user` | `owner-proof.test.ts` | `OWNER_PROOF_UNSUPPORTED` |
| AUTH-X-31 | `id_token` query without Bearer | `installed-auth-boundary.test.ts` | document URL with `embedded=1`+`host`; adapter extracts query token; GraphQL uses offline token |
| AUTH-X-32 | bot UA | `installed-auth-boundary.test.ts` | library 410; not treated as owner |
| D-PR7-07 / PR7-RBAC-008 | merchandising ungated | `app/tenant/__tests__/authority.test.ts` | tenant authority with `actor.status=absent` |
| CI | distinct privacy command | `vitest.privacy.config.ts` + `ci.yml` | nonzero tests; fail on zero collection |

## Checkpoint B requirement-to-test map (in progress)

| Requirement | Test home | Status |
|---|---|---|
| R1-02 same-apiKey/different-secret | `app/rbac/__tests__/owner-proof.test.ts` | implemented |
| R1-03 production clock inert | `owner-proof.test.ts` | implemented |
| R1-01 no B cross-origin wrapper caller | `app/privacy/__tests__/consumer-gates.test.ts` | documented/deferred |
| Schema/FORCE RLS/helpers | `scripts/tenant-enforcement/tests/pr7-privacy-foundation.test.ts` | implemented |
| PUBLIC / runtime BYPASSRLS / reader-not-erasure | same | implemented |
| ERASING freeze | same | implemented |
| Three processors while disabled | same | implemented; execute on disposable PG |
| Writer source coverage + omission | `scripts/privacy/__tests__/participating-writers.test.ts` | implemented |
| Pause default off | `app/privacy/__tests__/pause.test.ts` | implemented |
| Fresh/upgrade migrations | enforcement apply in foundation + existing apply/partial-apply suites | reuse with PR7 step |
| Prisma schema drift after PR7 tables (timestamptz + untruncated index names) | `scripts/tenant-indexes/tests/schema-drift.migration.test.ts` + `npm run tenant:schema:drift` | additive `20261004190000`; TIMESTAMP(3) on `90a3d77` failed Heavy `37221129407` |
| Non-superuser CREATEROLE apply with pre-existing PR7 roles | `scripts/tenant-enforcement/tests/non-superuser-migration-owner.test.ts` | bootstrap membership `INHERIT FALSE` / no ADMIN; missing grant → `pr7_role_grant_denied`; function OWNER after REVOKE/GRANT EXECUTE; fixture runtime EXECUTE; idempotent second apply |
| Redis drain / D-scratch leftover | `scripts/tenant-enforcement/tests/pr7-privacy-races.test.ts` | implemented; requires REDIS_URL |
| Assignment revoke/effect winners + response-loss retry | `pr7-privacy-races.test.ts` | implemented |
| Provenance: webhook cannot mint ADMIN; matching effect; second effectId/tamper deny; UNATTRIBUTED no upgrade | `pr7-privacy-races.test.ts` | implemented |
| GUC locator is not capability | `pr7-privacy-races.test.ts` | implemented |
| Customer residual visible vs RLS-empty; then child-first erase completes | `pr7-privacy-races.test.ts` | implemented |
| Restricted principal SET ROLE / EXECUTE admission | `pr7-privacy-races.test.ts` + foundation | implemented |
| Intake validate-before-persist; duplicate webhook reuses delivery/work/generation | `pr7-privacy-foundation.test.ts` | implemented |
| TenantDb participating-write after migrate-only reset (empty writable; ERASING freeze) | `app/tenant/__tests__/tenant-db.test.ts` | implemented |
| Dispatcher ForShop helpers on migrate-only catalog (canonical domain + CP EXECUTE; enqueue publishes) | `app/tenant/__tests__/queue-redis.test.ts` | implemented; exact-head `c37212d` Heavy `37225240141` failed before this additive migration |
| Privacy zero-name-filter fail-closed (CI wrapper) | `scripts/privacy/assert-zero-name-filter-guard.ts` + `npm run test:privacy:zero-name-filter-guard` | implemented; raw `-t` exit 1 required; `a526b39` Heavy `37230450492` failed before wrapper |
| Q-008 | production decision | OPEN / unmet as legal default |
