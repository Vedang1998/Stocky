# PR 1 — Tenant Expansion Correction Backlog

**Original Claude-reviewed head:** `7aabb095806716697bfea2783379351b15e1cda2`
**Correction-review Claude head:** `fb04345f129b8664566c5947f2ad75f57102269b`
**Follow-up reviewed head (immutable):** `aa5f425f446d79ff1bc24ac17a5944cdb8072159`
**Follow-up verdict preserved:** `NOT READY` (verbatim in `PR1_TENANT_EXPANSION_CORRECTION_FOLLOWUP_REVIEW_REPORT.md`)
**Product-owner decision:** F-F00 through F-F07 accepted; F-F00 is an external review gate (not an implementation defect). No findings independently closed.
**Implementation status posture:** `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION`
**PR #11:** open, draft, unmerged — corrections in progress on `phase-1/tenant-expand`
**PR 2 / PR 3:** NOT STARTED

## Follow-up findings (F-F00–F-F07)

| ID | Severity | Root cause | Correction design | Status | Residual risk |
|---|---|---|---|---|---|
| F-F00 | Gate | Independent-review environment blocked despite “unrestricted” label | Later reviewer must use capable local Claude Code (PG16, Prisma engines, shopify.dev, GitHub auth) | OPEN — external review gate | Blocks independent closure |
| F-F01 | P1 | Starting snapshot not DB-enforced READ ONLY | `SET TRANSACTION READ ONLY` first; persist/verify isolation + `transaction_read_only=on`; SQLSTATE 25006 negative write test | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-F02 | P1 | Unbounded/raw domain-discovery evidence in resumeMetadata | Compact budgets (`phase1-evidence-budget-v1`); redacted samples; fail closed on ceilings/bytes | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-F03 | P2 | Overlap proof only during old-snapshot wait | Active `building index: scanning table` + `index validation: scanning table` DML proofs retained with old-snapshot-wait | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-F04 | P2 | Fixed 180s snapshot timeout | `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS` bounds + phase telemetry + safe diagnostics | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-F05 | P2 | Drift redaction denylist/fail-open | Fail-closed allowlisted differences; no raw stdout/stderr on error paths | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |
| F-F06 | Track | Dependency advisory posture unclear | Base-vs-head `npm audit` comparison recorded; no broad upgrades; R-013/R-062 remain open | INVESTIGATED — TRACKED (not resolved) | Pre-existing 32 high advisories unchanged |
| F-F07 | P3 | Misleading read-only comment | Corrected with F-F01 to describe DB-enforced guarantee | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION | Open until Claude accepts |

## Prior F-N01–F-N09 (still awaiting independent closure)

| ID | Severity | Status |
|---|---|---|
| F-N01–F-N09 | P1–P3 | IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION (not independently closed) |

## Prior finding families (still awaiting independent closure)

Original F-PR1-01…15 and R1–R13 remain `IMPLEMENTED — AWAITING INDEPENDENT VERIFICATION` / not independently closed.

## Explicitly still open (not closed by PR 1 code)

* **F-016 / R-022** — OPEN
* **Q-011** — OPEN
* **R-028 / R-029** — OPEN
* **R-041 through R-055** — OPEN until independent acceptance
* **R-056 through R-063** (F-F00–F-F07) — OPEN until accepted or explicitly dispositioned
* **F-F00 through F-F07** — OPEN (F-F00 until a capable independent reviewer executes the suite)
* **PR 2 / PR 3** — NOT STARTED
* **Production inventory writes** — UNAPPROVED; flags DEFAULT OFF
