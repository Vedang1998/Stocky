# PR 1 — Tenant Expansion Correction Backlog

**Original Claude-reviewed head:** `7aabb095806716697bfea2783379351b15e1cda2`
**Correction-review Claude head:** `fb04345f129b8664566c5947f2ad75f57102269b`
**Correction-review verdict preserved:** `NOT READY` (verbatim in `PR1_TENANT_EXPANSION_CORRECTION_REVIEW_REPORT.md`)
**Product-owner decision:** F-N01 through F-N09 accepted; prior R9 evidence at `fb04345f…` **rejected and superseded**; no findings deferred.
**Implementation status posture:** `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`
**PR #11:** open, draft, unmerged — corrections in progress on `phase-1/tenant-expand`
**PR 2 / PR 3:** NOT STARTED

| ID | Severity | Root cause | Correction design | Status | Residual risk |
|---|---|---|---|---|---|
| F-N01 | P1 | R9 holders used READ COMMITTED; settle time after await; accidental race | REPEATABLE READ READ ONLY holder with non-null `backend_xmin`; require `waiting for old snapshots` + target-relation `ShareUpdateExclusiveLock`; settle via promise handlers; ≥10 iterations | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Prior R9 evidence superseded |
| F-N02 | P1 | Unbounded `SELECT DISTINCT shop` outside subject | Discovery only from coherent starting evidence; Session evidence boundary; direct-owner shops within HWM | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-N03 | P1 | ID-only membership checksum; misleading drift message | `phase1-tenant-subject-v2` field manifests + streaming subject digests; honest error text | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-N04 | P2 | Split starting reads without one snapshot | One REPEATABLE READ capture transaction; persist compact evidence; resume fail-closed | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-N05 | P3 | `buildSettled \|\| true` tautology | Removed | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-N06 | P3 | Vacuous AccessExclusiveLock absence on empty locks | Require ≥1 granted target-table lock + positive ShareUpdateExclusiveLock | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-N07 | P2 | Full ID array materialization | Bounded keyset streaming SHA-256; constrained-heap fixture | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-N08 | P3 | Review artifact chain of custody | This wave: review report committed alone before corrections | PROCESS — addressed for this wave | Keep for future phases |
| F-N09 | P3 | Drift stderr host/URL leakage | `redactPrismaDiagnosticText` + classified safe failures | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |

## Prior finding families (still awaiting independent closure)

Original F-PR1-01…15 and R1–R13 remain `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` / not independently closed. Claude could not execute Prisma-dependent commands in the correction review environment.

## Explicitly still open (not closed by PR 1 code)

* **F-016 / R-022** — OPEN
* **Q-011** — OPEN
* **R-028 / R-029** — OPEN
* **R-041 through R-046** — OPEN
* **R-047 through R-055** (F-N01–F-N09) — OPEN until independent acceptance
* **PR 2 / PR 3** — NOT STARTED
* **Production inventory writes** — UNAPPROVED; flags DEFAULT OFF
