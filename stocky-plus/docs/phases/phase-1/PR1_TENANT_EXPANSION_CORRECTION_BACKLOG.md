# PR 1 — Tenant Expansion Correction Backlog

**Original Claude-reviewed head:** `7aabb095806716697bfea2783379351b15e1cda2` — verdict `NOT READY`
**Correction-review Claude head:** `fb04345f129b8664566c5947f2ad75f57102269b` — verdict `NOT READY` (preserved verbatim)
**Follow-up reviewed head (immutable):** `aa5f425f446d79ff1bc24ac17a5944cdb8072159` — verdict `NOT READY` (preserved verbatim)
**Capable-local reviewed head (immutable):** `28e77178602ca486e5138ca2f80e8947d8e113c0` — verdict `READY FOR CHATGPT PR 1 ACCEPTANCE` (preserved verbatim in `PR1_TENANT_EXPANSION_CAPABLE_LOCAL_REVIEW_REPORT.md`)
**ChatGPT decision:** `PR 1 ACCEPTED` (D-025) — merge not authorized; PR #11 remains open, draft, unmerged
**Final correction status posture:** `INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1`
**No P0 or P1 correction remains for PR 1 scope.**
**PR 2 / PR 3:** NOT STARTED

## Historical chronology (immutable)

| Wave | Head | Verdict | Notes |
|---|---|---|---|
| Original independent review | `7aabb095806716697bfea2783379351b15e1cda2` | `NOT READY` | Preserved in `PR1_TENANT_EXPANSION_REVIEW_REPORT.md` |
| Correction review | `fb04345f129b8664566c5947f2ad75f57102269b` | `NOT READY` | Prior R9 evidence at this head **rejected and superseded** |
| Follow-up review | `aa5f425f446d79ff1bc24ac17a5944cdb8072159` | `NOT READY` | F-F00–F-F07 accepted for correction |
| Capable-local review | `28e77178602ca486e5138ca2f80e8947d8e113c0` | `READY FOR CHATGPT PR 1 ACCEPTANCE` | Independent re-execution in capable environment |

## Follow-up findings (F-F00–F-F07)

| ID | Severity | Root cause | Correction design | Status | Residual risk |
|---|---|---|---|---|---|
| F-F00 | Gate | Independent-review environment blocked despite “unrestricted” label | Capable local Claude Code (PG16, Prisma engines, shopify.dev, GitHub auth) | **CLOSED FOR PR 1 — independently verified at `28e7717…`** | Future reviews must still use a capable environment |
| F-F01 | P1 | Starting snapshot not DB-enforced READ ONLY | `SET TRANSACTION READ ONLY` first; persist/verify isolation + `transaction_read_only=on`; SQLSTATE 25006 negative write test | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** | None for PR 1 |
| F-F02 | P1 | Unbounded/raw domain-discovery evidence in resumeMetadata | Compact budgets (`phase1-evidence-budget-v1`); redacted samples; fail closed on ceilings/bytes | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** | None for PR 1 |
| F-F03 | P2 | Overlap proof only during old-snapshot wait | Active `building index: scanning table` + `index validation: scanning table` DML proofs retained with old-snapshot-wait | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** | Claim limited to phases empirically tested |
| F-F04 | P2 | Fixed 180s snapshot timeout | `TENANT_STARTING_SNAPSHOT_TIMEOUT_MS` bounds + phase telemetry + safe diagnostics | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** | None for PR 1 |
| F-F05 | P2 | Drift redaction denylist/fail-open | Fail-closed allowlisted differences; no raw stdout/stderr on error paths | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** | None for PR 1 |
| F-F06 | Track | Dependency advisory posture unclear | Base-vs-head `npm audit` comparison recorded; no broad upgrades; R-013/R-062 remain open | **INVESTIGATED — TRACKED (not resolved)** | Pre-existing 32 high advisories unchanged |
| F-F07 | P3 | Misleading read-only comment | Corrected with F-F01 to describe DB-enforced guarantee | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** | None for PR 1 |

## Prior F-N01–F-N09

| ID | Severity | Status |
|---|---|---|
| F-N01–F-N09 | P1–P3 | **INDEPENDENTLY VERIFIED — ACCEPTED FOR PR 1** at `28e7717…` (historical `NOT READY` heads preserved) |

## Prior finding families

Original F-PR1-01…15 and R1–R13 corrections claimed by the backlog were independently re-derived as corrected for PR 1 scope at `28e7717…`, except:

* **F-PR1-11** — non-blocking **P3** wording item (“non-mutating” dry-run CLI help text). Explicitly deferred to a future focused documentation/help-text cleanup. **Do not change application or CLI source in the acceptance finalization.** Not a PR 1 acceptance blocker.

## Explicitly still open (not closed by PR 1 acceptance)

* **F-016 / R-022** — OPEN (database-enforced isolation; PR 3 gate)
* **Q-011** — OPEN
* **R-014** — OPEN (exact money)
* **R-028 / R-029** — OPEN as operational backfill / enforcement-transition risks (PR 1 tooling accepted; environment-specific execution and zero-unresolved evidence still required)
* **R-013 / R-062** — OPEN (dependency hardening; not resolved)
* **R-024 through R-027**, **R-030 onward** where unrelated to accepted PR 1 corrections — remain as scheduled
* **PR 2 / PR 3** — NOT STARTED
* **Production inventory writes** — UNAPPROVED; flags DEFAULT OFF
* **Merge** — not authorized; awaiting explicit user authorization
