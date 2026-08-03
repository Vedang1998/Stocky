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

## Runtime cutover

1. Application release must already use `TenantDb` + transaction-local context.
2. Configure `DATABASE_RUNTIME_URL` to the restricted role.
3. Set `STOCKY_REQUIRE_RUNTIME_DB_URL=1` in production-like environments.
4. Do not leave web/workers on the migration URL.

## Rollback boundaries

- **After RLS activation, the pre-Phase-1 application is not a valid rollback target.**
- Rollback may use only a tenant-aware application release.
- Emergency RLS disablement is **not** ordinary rollback. It requires:
  - explicit incident authorization;
  - documented reason;
  - time-bound execution;
  - audit evidence;
  - immediate recovery plan.

## Forward recovery

| Failure | Action |
|---|---|
| Preflight unresolved ownership | Stop. Do not guess. Quarantine / repair via PR 1 tooling. |
| Timeout mid-VALIDATE | Re-run apply; prior verified steps remain. |
| Wrong existing index/constraint | Fail closed; do not IF NOT EXISTS over wrong definition. |
| Role privilege drift | `tenant:roles:verify` fails; re-provision exact grants only. |
| Policy/trigger drift | `tenant:rls:verify` / `tenant:immutability:verify`; re-apply RLS step. |
| Pooled connection leakage | Investigate GUCs with backend PID evidence; confirm `is_local=true`. |

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
