# PR 1 — Tenant Expansion Correction Backlog

**Claude-reviewed head:** `7aabb095806716697bfea2783379351b15e1cda2`
**Verdict preserved:** `NOT READY`
**Product-owner decision:** All findings F-PR1-01 through F-PR1-15 accepted; ordinary non-concurrent index deviation rejected.

| ID | Severity | Root cause | Files | Correction design | Tests | Status | Evidence | Residual risk |
|---|---|---|---|---|---|---|---|---|
| F-PR1-01 | P1 | Dry-run never persists parent `shopId`; children read persisted column | `engine.ts` | Proposed-ownership map; children use persisted or proposed parent | `dry-run-apply-equivalence.migration.test.ts` | Corrected | Equivalence suite green | None known |
| F-PR1-02 | P1 | Checkpoint advanced without durable issues | `engine.ts` | Persist issues in same batch `$transaction` as checkpoint; diagnostic phase checkpoints | `batch-atomicity.migration.test.ts` | Corrected | Fault-injection + resume green | None known |
| F-PR1-03 | P1 | Cross-domain issues omitted from unresolved/blocking gate | `engine.ts`, `cli.ts` | Diagnostic phases; `blockingIssueCount`; `COMPLETED_WITH_ISSUES`; exit 2 | `cross-domain-blocking.migration.test.ts` | Corrected | Blocking suite green | None known |
| F-PR1-04 | P1 | Re-detected RESOLVED stayed RESOLVED; overloaded `issueCount` | `schema.prisma`, migration, `engine.ts` | Reopen + `reopenedAt`/`reopenCount`; distinct count fields | `issue-reopen-counts.migration.test.ts` | Corrected | Reopen suite green | None known |
| F-PR1-05 | P2 | Ordinary CREATE INDEX in Prisma migrate | migration rewrite + `scripts/tenant-indexes/` | CONCURRENTLY via pinned pg client; D-024 | `indexes.migration.test.ts` | Corrected | Index apply/verify green | Production still unauthorized |
| F-PR1-06 | P1 | IF NOT EXISTS accepted INVALID indexes | same as F-PR1-05 | Pre/post catalog verification; fail closed | invalid/wrong-def index tests | Corrected | Fail-closed tests green | None known |
| F-PR1-07 | P2 | Pooled Prisma advisory lock reentrancy/leak | `apply-lock.ts` | Dedicated `pg.Client`; `TENANT_MAINTENANCE_DATABASE_URL` | `apply-lock.migration.test.ts` | Corrected | Concurrent denial green | Ops must use direct URL |
| F-PR1-08 | P2 | No DNS length bounds | `shop-domain.ts` | Label ≤63; hostname ≤253; distinct reasons | `shop-domain.test.ts`, domain unit suite | Corrected | Boundary tests green | None known |
| F-PR1-09 | P2 | Non-ASCII survived toLowerCase | `shop-domain.ts` | Reject non-ASCII before lowercasing | Kelvin/Turkish/confusable tests | Corrected | Non-ASCII tests green | None known |
| F-PR1-10 | P2 | beforeCounts recomputed on resume | `engine.ts` | Preserve original beforeCounts/metadata | `resume-before-counts.migration.test.ts` | Corrected | Resume suite green | None known |
| F-PR1-11 | P3 | “Non-mutating” dry-run wording | CLI/runbook/docs | Precise control-record wording | Doc review | Corrected | Wording updated | None known |
| F-PR1-12 | P3 | Stale report identity/CI | implementation + correction reports | Split reviewed vs corrected heads | Doc fields | Corrected | See correction report | Pending fresh Claude review |
| F-PR1-13 | P3 | Trailing whitespace | Markdown | Remove trailing spaces | `git diff --check` | Corrected | Check exit 0 | None known |
| F-PR1-14 | P3 | Updated counted without affected rows | `engine.ts` | RETURNING/affected count + high-water marks | Atomicity/resume suites | Corrected | Engine uses RETURNING | Concurrent-insert precondition documented |
| F-PR1-15 | P3 | Dynamic SQL identifiers without assert | `tables.ts`, `engine.ts` | Allowlist assert before interpolate | `allowlist.migration.test.ts` | Corrected | Allowlist suite green | None known |
