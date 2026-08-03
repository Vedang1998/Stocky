# PR 3 — Database Enforcement Runbook

**Phase:** 1  
**Branch:** `phase-1/tenant-enforcement`  
**Production execution:** NOT AUTHORIZED by this PR

## Preconditions

1. PR 1 backfill tooling available; unresolved ownership count is **zero** for every enforced domain.
2. PR 2 tenant-bound access is merged and live on the application release that will run after RLS.
3. Disposable or staging PostgreSQL 16 with **direct** (non-pooler) migration connection.
4. Explicit `DATABASE_MIGRATION_URL` / `TENANT_MAINTENANCE_DATABASE_URL`.
5. Backup / restore rehearsal completed before any future production approval (not authorized here).
6. **Migration owner is not superuser** for staging/production verification paths. Set `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1`. Bootstrap may use a superuser only to create the migration owner; ordinary enforcement must not use the cluster superuser as the application table owner.
7. Migration owner owns the intended application schema/tables and has only required migration authority; runtime role remains separate (`stocky_runtime`).
8. Migration credentials must **not** be available to normal web or worker processes.

## Operator sequence (disposable / future staging only)

```bash
# 1. Preflight (non-mutating, fail-closed)
npm run tenant:enforcement:preflight

# 2. Plan
npm run tenant:enforcement:plan

# 3. Provision runtime role
npm run tenant:roles:provision -- --apply

# 4. Apply enforcement (requires --apply + migration URL)
npm run tenant:enforcement:apply -- --apply

# 5. Verify
npm run tenant:roles:verify
npm run tenant:rls:verify
npm run tenant:immutability:verify
npm run tenant:enforcement:verify
npm run tenant:enforcement:drift

# 6. Isolation suite
npm run test:db-isolation
```

## Step groups

| Step group | Expected lock mode | Timeout behavior |
|---|---|---|
| Helper functions | Catalog / ShareUpdateExclusive | Abort; safe retry |
| Role grants | Catalog | Abort; re-run provision |
| Concurrent indexes | ShareUpdateExclusive | Abort; resume; no silent wrong definition |
| NOT NULL check NOT VALID | Brief AccessExclusive (metadata) | Abort; resumable |
| VALIDATE check | ShareUpdateExclusive | Abort; data intact |
| SET NOT NULL | AccessExclusive (optimized when check validated) | Abort; resumable |
| FK NOT VALID / VALIDATE | ShareUpdateExclusive / brief AccessExclusive | Abort; resumable |
| ENABLE/FORCE RLS + policies + triggers | Brief AccessExclusive per table | Abort; resumable |

Finite `lock_timeout` and `statement_timeout` are always set. Timeouts do **not** mark steps complete.

## Security-preserving deployment sequence (NOT AUTHORIZED for production)

Critical invariants:

```text
Runtime merchant DML is never active without exact verified RLS.
The pre-PR-3 application is not a valid rollback target after RLS activation.
```

Ordered stages (disposable / future staging only — no production rollout authorized):

| Stage | Safe state | Failure action |
|---|---|---|
| 1. Old app before RLS | App may still use privileged DB; **no** runtime merchant DML grants for restricted role yet | Abort; leave grants revoked |
| 2. New tenant-aware app before RLS | App uses `TenantDb` + context; still no runtime merchant DML without RLS | Do not grant DML |
| 3. Enforcement prepare | Role attributes + revoke merchant DML | Remain revoked |
| 4. Constraints / indexes | NOT NULL + composite keys/FKs | Resume apply; DML still revoked |
| 5. Policies + ENABLE/FORCE RLS | Exact policies/triggers installed per table | Resume; DML still revoked |
| 6. Definitions verified | Catalog verify `ok:true` | Do not grant if verify fails |
| 7. Runtime grants | Merchant DML granted **only after** step 6 | On any later failure, revoke unless verify still passes |
| 8. App traffic on runtime URL | `DATABASE_RUNTIME_URL` + `STOCKY_REQUIRE_RUNTIME_DB_URL=1`; connected-identity verification before merchant processing | Fail closed on privileged **connected identity** even when no migration URL is present in the application environment |
| 9. Final verify / drift | Continuous CI + operator verify | Treat drift as incident |
| 10. Blue/green | Both colors must be tenant-aware post-RLS releases | Never route to pre-PR-3 app after RLS |

## Runtime cutover

1. Application release must already use `TenantDb` + transaction-local context.
2. Configure `DATABASE_RUNTIME_URL` to the restricted role (semantic identity ≠ migration URL when migration URL is present).
3. Set `STOCKY_REQUIRE_RUNTIME_DB_URL=1` in production-like environments.
4. Do not leave web/workers on the migration URL — migration credentials should not be available to normal web or worker processes.
5. **The application verifies the actual connected runtime identity before merchant processing; privileged runtime identity fails closed even when no migration URL is present in the application environment.** URL comparison is an early defence only and is not authority.
6. Do not grant runtime merchant DML before exact verified RLS.
7. Staging/production verification must set `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1`.

## Rollback boundaries

- **After RLS activation, the pre-PR-3 / pre-Phase-1 application is not a valid rollback target.**
- Rollback may use only a tenant-aware application release that understands FORCE RLS + runtime role separation.
- Emergency RLS disablement is **not** ordinary rollback. It requires:
  - explicit incident authorization;
  - documented reason;
  - time-bound execution;
  - audit evidence;
  - immediate recovery plan;
  - immediate revoke of runtime merchant DML if policies are incomplete.

## Forward recovery

| Failure | Action |
|---|---|
| Preflight unresolved ownership | Stop. Do not guess. Quarantine / repair via PR 1 tooling. |
| Partial apply / interrupt | Resume with `tenant:enforcement:apply -- --apply`; resume preflight accepts verified prior steps |
| Timeout / deadlock mid-step | FailSafe leaves `unsafe_runtime_access=false`; re-run apply |
| Wrong existing index/constraint/policy | Fail closed; exact definition verify must fail; do not IF NOT EXISTS over wrong definition |
| Role privilege / membership drift | `tenant:roles:verify` fails closed; explicit `--repair-dangerous-drift` only when separately authorized |
| Policy/trigger drift | `tenant:rls:verify` / `tenant:immutability:verify` / `tenant:enforcement:drift` fail; re-apply |
| Pooled connection leakage | Investigate GUCs with backend PID evidence; confirm `is_local=true` |

## Evidence classes (honesty)

| Class | Status |
|---|---|
| Empty-database smoke | Disposable only — not representative of populated lock cost |
| Populated-scale disposable | See correction implementation report (50 shops / 100k+100k rows) |
| Production | **Not collected** — production apply unauthorized |
| Backup restore rehearsal | **Unexecuted** — not authorized |

## Monitoring

- Enforcement verify / drift in CI
- Role attribute assertions (no BYPASSRLS)
- Isolation suite on every PR
- Application AI/inventory-write flags remain DEFAULT OFF

## Authorization gates

- No production apply from this PR
- No production backfill
- No inventory-write enablement
- User merge only after ChatGPT acceptance and independent Claude review
