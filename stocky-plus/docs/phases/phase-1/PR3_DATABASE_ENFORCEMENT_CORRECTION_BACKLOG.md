# Phase 1 PR 3 — Database Enforcement Correction Backlog

**Authority:** ChatGPT (product / architecture)
**Implementation owner:** Cursor
**Independent correction reviewer:** Claude Code
**Technical acceptance authority:** ChatGPT
**Merge authority:** User only after ChatGPT acceptance

**Source review:** `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md` (preserved verbatim)
**Independently reviewed implementation head:** `57016ed4b685c8958ad49d821f4afd9ea9894a9b`
**Review-report-only commit / correction starting head:** `ebcd0263ee726829f517d729abe601c7416a0952`
**Actual last runtime/test implementation head (pre-correction):** `0ee3ae027d746b9696c990dfbc59976f4ef56ae7`
**Decision:** D-037 — Phase 1 PR 3 corrections required

**Finding counts from independent review:** P0: 0 · P1: 6 · P2: 14 · P3: 9

**Status legend:** every finding below remains

```text
IMPLEMENTATION PENDING INDEPENDENT VERIFICATION
```

Do **not** mark any finding closed when Cursor’s tests pass. PR 3 remains unaccepted. PR #15 remains draft and unmerged. PR 4 remains blocked. Production execution and inventory writes remain unauthorized.

---

## Identity chain of custody

| Commit | Role |
| --- | --- |
| `57016ed4b685c8958ad49d821f4afd9ea9894a9b` | Independently reviewed implementation head |
| `0ee3ae027d746b9696c990dfbc59976f4ef56ae7` | Actual last runtime/test implementation head before review |
| `ebcd0263ee726829f517d729abe601c7416a0952` | Review-report-only commit; required correction starting head |
| `b02d660` … `01cced4` (+ docs tip) | Cursor correction implementation — pending independent verification |

The independent review report file must remain unchanged.

---

## P1 — blocking

### F-PR3-01 · P1 · Forward recovery from a partial apply is impossible

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/preflight.ts:159-168` |
| Reproduction | Partial apply after deadlock → `preflight_failed:tenant:schema:drift_failed_exit_1`; apply refuses forever |
| Required correction | Replace all-or-nothing `enforcementAlreadyApplied` with step-aware resume preflight; allow already-correct prior objects; do not require final-complete drift during incomplete but safely resumable apply |
| Required regression test | Interruption after every major step → resume → full verify; no skipped enforcement target |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR3-02 · P1 · Partial apply leaves runtime unrestricted cross-tenant access

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/apply.ts:440-531` |
| Reproduction | Deadlock mid-apply left runtime DML grants + zero RLS → 50 shops / 100,000 rows readable with no context |
| Required correction | Runtime merchant DML never active without exact verified RLS; revoke before unsafe windows; grants only after policy/trigger/constraint verification |
| Required regression test | Assert at every failure boundary `unsafe_runtime_access = false`; interruption suite |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR3-03 · P1 · RLS verification cannot detect policy-predicate tampering

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/verify.ts:58-134` (`checkPolicies`) |
| Reproduction | Rewrite `Supplier_tenant_select` to `USING (true)` → all verifiers `ok:true`; cross-tenant read succeeds |
| Required correction | Validate `polcmd`, `polroles`, `polpermissive`, `polqual`, `polwithcheck` against deterministic expected manifest |
| Required regression test | Adversarial: `USING (true)`, missing WITH CHECK, PUBLIC role, extra permissive, wrong context key |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR3-04 · P1 · Composite FK definitions neither verified nor repaired

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/verify.ts:236-252`; `apply.ts:220-247` |
| Reproduction | Same-named wrong single-column FK → verify/drift/re-apply all `ok:true`; cross-tenant child insert succeeds |
| Required correction | Catalog comparison of local/referenced columns, order, parent table, actions, validation, deferrability; apply must not short-circuit on bare existence |
| Required regression test | Wrong same-named FK; wrong referential action; invalid FK |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR3-05 · P1 · Role verification ignores role membership

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/roles.ts:151-260` |
| Reproduction | `GRANT stocky TO stocky_runtime` → verify `ok:true`; `SET ROLE stocky` succeeds |
| Required correction | Recursive `pg_auth_members` inspection; fail on owner/migration/superuser/BYPASSRLS/admin-option membership; provision fails closed (explicit repair mode only) |
| Required regression test | Direct/indirect owner grant; ADMIN OPTION; NOINHERIT + SET ROLE; cyclic graph; postgres membership |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

### F-PR3-06 · P1 · Runtime/migration URL separation is literal string comparison

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `app/db.server.ts:21-56`; `scripts/tenant-enforcement/connection.ts:72-116` |
| Reproduction | Trailing slash, `?schema=public`, `127.0.0.1`/`localhost`, `postgres://`/`postgresql://` all accepted |
| Required correction | Semantic URL normalize + post-connect identity verification (`current_user`, attributes, ownership, BYPASSRLS); reject privileged runtime |
| Required regression test | Equivalence forms; runtime connected as owner/superuser/BYPASSRLS/member |
| Status | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

---

## P2 — mandatory

| ID | Severity | Object | Summary | Required regression | Status |
| --- | ---: | --- | --- | --- | --- |
| F-PR3-07 | P2 | `prisma/schema.prisma`; `db:migrate` / `db:push` | Post-enforcement Prisma tooling would DROP constraints; drift permanently fails with "(none recognized)" | Guard / expected-divergence reporting; document unsafe developer commands | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-08 | P2 | `verify.ts:136-163` | Trigger verifier ignores `tgenabled` / `tgtype`; DISABLE and REPLICA pass | Disabled / replica-only / wrong function / altered body tests | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-09 | P2 | `roles.ts` | PUBLIC grants on merchant tables undetected | PUBLIC grant adversarial test | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-10 | P2 | `roles.ts` | Excess TRIGGER/TRUNCATE/REFERENCES undetected | Exact privilege allowlist tests | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-11 | P2 | `roles.ts:74-78` | Silent repair of BYPASSRLS / privileged attrs | Fail closed + audited repair mode | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-12 | P2 | `apply.ts` / `sql.ts` | Giant multi-table RLS transaction | Per-table RLS steps; populated lock evidence | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-13 | P2 | `connection.ts`; runbook | Migration owner superuser undocumented; `stocky_migration` never inspected | Verify actual table owner attributes; document owner bypass | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-14 | P2 | `preflight.ts` / `cli.ts` | Lock timeout escapes as unstructured error | Structured JSON failure with step/event | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-15 | P2 | `apply.ts` | No durable checkpoint; "checkpointed" language inaccurate | Step-aware derived state; honest docs | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-16 | P2 | `worker-surfaces.test.ts` | Synthetic surface names imply nonexistent code paths | Rename/defer explicitly; no false coverage claim | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-17 | P2 | Runbook cutover | Missing blue/green, grants-before-app, failure boundaries | Security-preserving deployment sequence; no production rollout | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-18 | P2 | `tenant-db.server.ts` | Extra round-trips per merchant read; no scalability evidence | Document residual; no false performance claim | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-19 | P2 | `LeadTimeSnapshot` secondary FK | New referential integrity undocumented | Document + regression for NO ACTION behavior | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-20 | P2 | `isolation.test.ts` | Only 2 of 16 pool scenarios committed | Expand committed scenarios or explicit deferral with honesty | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

---

## P3 — quality / evidence

| ID | Object | Summary | Status |
| --- | --- | --- | --- |
| F-PR3-21 | PR body; implementation report | Incorrect runtime/test head `aeeecc2`; actual is `0ee3ae0` | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-22 | Implementation report | Stale final head / CI identity | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-23 | `apply.ts` advisory unlock | Unlock return value discarded | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-24 | `roles.ts` password fallback | Hardcoded CI password in production-like apply | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-25 | `app/db.server.ts` | `resetPrismaSingletonForTests` importable from runtime | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-26 | `app/db.server.ts` Proxy receiver | Proxy passed as Reflect receiver | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-27 | `verify.ts` / `apply.ts` | Dead code (`void check`, unused expected) | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-28 | `preflight.ts` | `STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY` usable on apply path | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |
| F-PR3-29 | Grants; `db-context.server.ts` | (a) unbounded Shop enumeration; (b) `$queryRawUnsafe` for mock convenience | IMPLEMENTATION PENDING INDEPENDENT VERIFICATION |

---

## Safety boundaries (unchanged)

- PR #15 remains open, **draft**, unmerged
- No deployment / production or merchant-data access
- No production backfill
- No guessed ownership repair
- No PR 4
- No inventory mutation; every write flag default OFF
- No rebase / amend / force-push
- Independent review report preserved verbatim
- Q-011, F-016, R-022–R-029 remain open or pending verification

---

## Next action after Cursor correction

```text
Return to ChatGPT for exact-head triage and the independent PR 3 correction-review prompt.
```
