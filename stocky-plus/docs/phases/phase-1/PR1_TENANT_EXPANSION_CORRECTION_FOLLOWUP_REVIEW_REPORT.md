# PR 1 — Tenant Expansion and Backfill: Independent Correction Follow-Up Review (Preserved Record)

**Location:** `stocky-plus/docs/phases/phase-1/PR1_TENANT_EXPANSION_CORRECTION_FOLLOWUP_REVIEW_REPORT.md`

**Provenance / chain of custody:** This record preserves the independent follow-up review outcome exactly as relayed in the product-owner correction directive of 2026-07-31, before any correction was implemented. It is committed alone, before implementation changes, per the chain-of-custody requirement established after F-N08. No wording of the relayed findings, decisions, verdict, or environmental limitations has been altered. This record does not rewrite or replace the historical review reports (`PR1_TENANT_EXPANSION_REVIEW_REPORT.md`, `PR1_TENANT_EXPANSION_CORRECTION_REVIEW_REPORT.md`).

---

## 1. Review identity

| Item | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Pull request | #11 — Add Phase 1 tenant expansion and backfill foundation |
| Existing branch | `phase-1/tenant-expand` |
| Exact independently reviewed head | `aa5f425f446d79ff1bc24ac17a5944cdb8072159` |
| Base main | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Independent verdict | **`NOT READY`** |

The previous review head remains immutable evidence:

`aa5f425f446d79ff1bc24ac17a5944cdb8072159`

No technical finding is independently closed.

---

## 2. Finding decisions (as accepted by the product owner)

| Finding | Decision |
|---|---|
| F-F00 — independent-review environment blocked | Accepted as an external review gate, not an implementation defect. A later reviewer must use a truly unrestricted local environment. |
| F-F01 — starting snapshot not enforced READ ONLY | Accepted as P1; mandatory correction |
| F-F02 — unbounded/raw domain-discovery evidence | Accepted as P1; mandatory correction |
| F-F03 — overlap proof only during old-snapshot wait | Accepted as P2; correct now |
| F-F04 — fixed 180-second snapshot timeout | Accepted as P2; correct now |
| F-F05 — drift redaction is denylist/fail-open | Accepted as P2; correct now |
| F-F06 — dependency advisory posture | Track and investigate; do not perform broad dependency upgrades in PR #11 unless this PR caused the change |
| F-F07 — misleading read-only comment | Accepted as P3; correct with F-F01 |

---

## 3. Finding substance (as relayed)

- **F-F00 (environment gate).** The environment used for this follow-up review did not satisfy the independent-review requirement despite the review being labelled “unrestricted.” The next independent review must run through local Claude Code or another environment that actually has: PostgreSQL 16; access to Prisma engines; access to Shopify developer schema sources; authenticated GitHub metadata and Actions logs. GitHub CI is supporting evidence; it does not replace the independent review required by the project workflow. The next reviewer must stop with `NOT READY` when required tooling remains blocked. F-F00 remains open until an independent reviewer successfully executes the required suite in a capable environment.
- **F-F01 (P1).** The starting-evidence transaction is `REPEATABLE READ` but is not database-enforced `READ ONLY`. `SET TRANSACTION READ ONLY` must be executed as the first SQL statement in the interactive transaction, before `pg_current_snapshot()`, counts, Shop reads, Session evidence, table subject capture, and domain discovery; the observed `transaction_isolation` and `transaction_read_only` settings must be persisted as evidence and verified fail-closed.
- **F-F02 (P1).** Domain-discovery evidence is unbounded and persists raw merchant domains, including complete raw-domain arrays such as `directOwnerRawShops[table] = rawShops` inside durable `resumeMetadata`. Evidence must be compact and bounded: deterministic counts and SHA-256 digests, bounded redacted samples with truncation flags and omitted counts, an explicit versioned serialized-evidence budget, explicit ceilings for normalized domains / discovery issues / Shop count, and fail-closed behavior before mutation when any ceiling or byte budget is exceeded.
- **F-F03 (P2).** The concurrent-index overlap proof exercises DML only during the `waiting for old snapshots` phase. Representative insert/update/delete must additionally be proven during active work phases (`building index`, and `index validation: scanning table` where reliably observable), with builder-PID- and target-relation-constrained observation, lock assertions, and true settlement timing. The production claim must not be broadened beyond the phases empirically tested.
- **F-F04 (P2).** The starting-snapshot capture uses a fixed hard-coded 180-second transaction timeout with no configuration, bounds validation, phase telemetry, or safe timeout diagnostics.
- **F-F05 (P2).** Drift stderr redaction is a denylist regex model and therefore fail-open: unrecognized shapes of sensitive output (bare hostnames, IPv6, Unix socket paths, libpq keyword/value forms, credentials under unexpected labels) can pass through. Diagnostics must be fail-closed: fixed success events, allowlist-parsed bounded drift statements, and fixed command-class/exit-code/category summaries with no raw stdout/stderr passthrough. Regex redaction may remain only as defence in depth.
- **F-F06 (track/investigate).** Dependency advisory posture must be recorded and compared between base main and the PR head. No broad dependency upgrades in PR #11 unless this PR caused the change; no `npm audit fix` / `npm audit fix --force`.
- **F-F07 (P3).** The code comment describing the starting snapshot as read-only is misleading because read-only is not database-enforced. Correct together with F-F01 so comments describe the enforced guarantee precisely.

---

## 4. Environmental limitations and qualifications

- The follow-up review environment was blocked from executing the full required suite; the review therefore could not independently execute all mandated Prisma-, Shopify-, and GitHub-dependent verification. This limitation is preserved as F-F00 and treated as an external review gate, not an implementation defect.
- Exact-head CI success at the reviewed head (run `30601951921`, job `91066366577`, `head_sha = aa5f425f446d79ff1bc24ac17a5944cdb8072159`, conclusion success) is supporting evidence only and does not replace independent execution.
- No finding from this follow-up review, and no finding from any earlier review wave (F-PR1-01…15, R1–R13, F-N01…F-N09), is independently closed by this record.

---

## 5. Verdict

# NOT READY

Merge: not approved. PR #11 remains open, draft, and unmerged. PR 2 and PR 3: not authorized — remain NOT STARTED. Production inventory writes: UNAPPROVED. All inventory-write flags: DEFAULT OFF.
