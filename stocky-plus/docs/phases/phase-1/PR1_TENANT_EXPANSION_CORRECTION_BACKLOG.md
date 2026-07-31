# PR 1 — Tenant Expansion Correction Backlog

**Claude-reviewed head:** `7aabb095806716697bfea2783379351b15e1cda2`
**Verdict preserved:** `NOT READY`
**Product-owner decision:** All findings F-PR1-01 through F-PR1-15 accepted; ordinary non-concurrent index deviation rejected.
**ChatGPT pre-review residual gaps:** R1–R13
**Prior live tip (pre R9–R13):** `adf0b52103c517c904a7a33ee76cfaca29971860`
**Implementation status posture:** `IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION` (code present; findings not independently closed)
**Mandatory verification outstanding:** Fresh Claude review of the live PR tip after ChatGPT exact-head verification

| ID | Severity | Root cause | Files | Correction design | Tests | Status | Evidence | Residual risk |
|---|---|---|---|---|---|---|---|---|
| F-PR1-01 | P1 | Dry-run never persists parent `shopId`; children read persisted column | `engine.ts` | Proposed-ownership map; children use persisted or proposed parent | `dry-run-apply-equivalence.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Equivalence suite present | Open until Claude accepts corrected head |
| F-PR1-02 | P1 | Checkpoint advanced without durable issues | `engine.ts` | Persist issues + detections in same batch `$transaction` as checkpoint | `batch-atomicity.migration.test.ts`, `detection-history.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Atomicity + detection suites | Open until Claude accepts corrected head |
| F-PR1-03 | P1 | Cross-domain issues omitted from unresolved/blocking gate | `engine.ts`, `cli.ts` | Diagnostic phases; `blockingIssueCount`; `COMPLETED_WITH_ISSUES`; exit 2 | `cross-domain-blocking.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Blocking suite present | Open until Claude accepts corrected head |
| F-PR1-04 | P1 | Re-detected RESOLVED stayed RESOLVED; overloaded `issueCount` | schema + migration + engine | Reopen + durable `TenantOwnershipIssueDetection`; distinct counts | `issue-reopen-counts.migration.test.ts`, `detection-history.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Reopen + history suites | Open until Claude accepts corrected head |
| F-PR1-05 | P2 | Ordinary CREATE INDEX in Prisma migrate | tooling + D-024 | CONCURRENTLY via pinned pg client; real Prisma drift | `indexes.migration.test.ts`, `schema-drift.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Index + drift suites | Production still unauthorized; Claude verification pending |
| F-PR1-06 | P1 | IF NOT EXISTS accepted INVALID indexes | index tooling | Pre/post catalog verification; fail closed; interrupted CONCURRENTLY tests | invalid/wrong-table/wrong-def suites | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Fail-closed + invalid remnant tests | Open until Claude accepts corrected head |
| F-PR1-07 | P2 | Pooled Prisma advisory lock reentrancy/leak | `apply-lock.ts` | Dedicated `pg.Client`; backend PID match on unlock | `apply-lock.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | PID + denial + release suites | Ops must use direct URL; Claude verification pending |
| F-PR1-08 | P2 | No DNS length bounds | `shop-domain.ts` | Label ≤63; hostname ≤253; distinct reasons | domain unit suite | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Boundary tests present | Open until Claude accepts corrected head |
| F-PR1-09 | P2 | Non-ASCII survived toLowerCase | `shop-domain.ts` | Reject non-ASCII before lowercasing | Kelvin/Turkish/confusable tests | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Non-ASCII tests present | Open until Claude accepts corrected head |
| F-PR1-10 | P2 | beforeCounts recomputed on resume | `engine.ts` | Preserve original beforeCounts/metadata | `resume-before-counts.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Resume suite present | Open until Claude accepts corrected head |
| F-PR1-11 | P3 | “Non-mutating” dry-run wording | CLI/runbook/docs | Precise control-record wording | Doc review | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Wording updated | Open until Claude accepts corrected head |
| F-PR1-12 | P3 | Stale report identity/CI | reports | Non-self-referential immutable heads vs live PR tip | Doc fields | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | See correction report | Pending fresh Claude review |
| F-PR1-13 | P3 | Trailing whitespace | Markdown | Remove trailing spaces | `git diff --check` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Check required in CI | Open until Claude accepts corrected head |
| F-PR1-14 | P3 | Updated counted without affected rows / stale concurrency | `engine.ts` | RETURNING + re-read after zero-row UPDATE (R5) | `affected-row-concurrency.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Concurrency classification suite | Open until Claude accepts corrected head |
| F-PR1-15 | P3 | Dynamic SQL identifiers without assert | `tables.ts`, `engine.ts` | Allowlist assert before interpolate | `allowlist.migration.test.ts` | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Allowlist suite present | Open until Claude accepts corrected head |

## ChatGPT residual gap backlog (R1–R13)

| ID | Status | Residual risk |
|---|---|---|
| R1 Real Prisma schema drift | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R2 Compatibility-index safety tests | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R3 Bounded statement timeout | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R4 Apply-lock backend PID proofs | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R5 Affected-row concurrency re-read | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R6 Durable run-to-issue detections | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R7 Record identity wording | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R8 Backlog honesty | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R9 Deterministic concurrent-index overlap | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R10 Dataset boundaries + membership checksums | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R11 Full-engine affected-row races | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R12 Explicit maintenance URL for index apply | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |
| R13 Schema-datasource Prisma drift (no URL argv) | IMPLEMENTED — AWAITING FRESH CLAUDE VERIFICATION | Open until Claude accepts |

## Explicitly still open (not closed by PR 1 code)

* **F-016 / R-022** — OPEN (database isolation gate; not resolved by PR 1)
* **Q-011** — OPEN
* **R-028 / R-029** — OPEN (pending fresh Claude correction review + later zero-unresolved evidence)
* **R-041 through R-046** — OPEN
* **PR 2 / PR 3** — NOT STARTED
