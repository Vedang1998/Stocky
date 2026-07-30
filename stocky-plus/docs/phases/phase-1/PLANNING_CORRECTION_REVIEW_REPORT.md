Phase 1 Planning Correction Review Report

Intended permanent location: stocky-plus/docs/phases/phase-1/PLANNING_CORRECTION_REVIEW_REPORT.md

1. Executive verdict

READY FOR CHATGPT PHASE 1 BRIEF APPROVAL

All three original P1 findings (P1-01 lock-conscious rollout, P1-02 decimal-safe money, P1-03 tenant immutability) are genuinely resolved — not by naming a technique, but by specifying measurement, failure, and recovery requirements around it. C-5 through C-11 are applied with real substance rather than restatement. The pull request remains strictly documentation-only across the full branch, the brief remains DRAFT — IMPLEMENTATION NOT AUTHORIZED, and my initial NOT READY report is preserved verbatim without softening.

Two open findings remain, both P2, neither blocking:

P2-12 — I could not independently verify corrected-head CI association. The GitHub API returned HTTP 403 rate-limit from this environment on every attempt. I record this as an evidence gap, not as verification.
P2-13 — the permanent correction report still carries CI fields as placeholders (_recorded in PR #9 description after CI completes_), so the corrected-head CI evidence lives only in a mutable PR description, not in the permanent record.

No P0 or P1 finding is open. Per the severity rule, the verdict is READY — which returns the brief to ChatGPT for product-owner approval and authorizes nothing else.

2. Review identity
Field	Value
Reviewer	Claude (independent correction re-review)
Review type	Planning correction re-review — read-only
Review date	2026-07-30
Method	Fresh clone of public repository; git fetch of all branch and PR refs; diff, git show, and file inspection at exact SHAs
Runtime code written	None
Files modified	None
Commits / pushes / merges	None
3. Repository, base, initial head, corrected head
Field	Value	Verification
Repository	Vedang1998/Stocky	Clone succeeded
Base branch	main	Verified
Base SHA	8e4f757c4717baba0ece74135b062324ff429ee6	git rev-parse origin/main
Merge base (main, PR 9)	8e4f757c4717baba0ece74135b062324ff429ee6	Equals base SHA — zero drift; branch fully current with main
Initial reviewed head	eae8cfdf215e78226f35ba9a2046bddd93590c2c	Exists as commit object; confirmed
Corrected head	835088d3c0294222b14d67a5875709f299062439	git rev-parse pr/9 and git rev-parse origin/docs/phase-1-planning both return this SHA — matches Cursor's claim
Head branch	docs/phase-1-planning	Verified
Working tree	Clean (git status --porcelain empty)	Verified

Commits since the initial reviewed head (2):

SHA	Subject
cec0a10f65e96f5d29b34ec41e59ada5bec0528f	Correct Phase 1 planning for Claude NOT READY review.
835088d3c0294222b14d67a5875709f299062439	Record planning-correction commit SHA in correction report.

Both authored Vedang (Odoo), co-authored Cursor <cursoragent@cursor.com>, dated 2026-07-30. The second commit is a one-line change filling in the correction commit SHA.

4. PR number, title, state, draft status
Field	Value	Verification
PR	#9 — Plan Phase 1 tenant-safe Shopify fact foundation	Cursor's claim
State	OPEN	Not independently verified — API rate-limited
Draft	Draft	Not independently verified — API rate-limited
Exactly one open PR from docs/phase-1-planning	Claimed	Not independently verified — API rate-limited

What I can state from git alone: refs/pull/9/head and refs/heads/docs/phase-1-planning resolve to the identical SHA 835088d…, so PR #9 genuinely tracks the branch tip I reviewed. The branch is not merged into main — git merge-base proves main has not advanced past the Phase 0 closure SHA, so the planning PR is definitively unmerged.

5. Corrected-head CI association

NOT INDEPENDENTLY VERIFIED — recorded as an evidence gap.

Attempt	Result
GET /repos/Vedang1998/Stocky	HTTP 403 — rate limit exceeded for this egress IP
GET /repos/Vedang1998/Stocky/actions/runs/30564344329	HTTP 403 — rate limit exceeded
Authenticated connector	No GitHub connector available in this session
gh CLI with credentials	Not available

Cursor asserts run 30564344329, job 90944976704, actual head_sha 835088d3c0294222b14d67a5875709f299062439, conclusion success. I do not confirm this. Per the task instruction, Cursor's CI assertion is not evidence. This is the same limitation honestly recorded in the PR #8 review and in my initial Phase 1 review as P2-04, and it recurs here as P2-12.

Before merge, an authenticated party must confirm and record, with attribution to whoever verifies it: (a) run 30564344329 has head_sha == 835088d3c0294222b14d67a5875709f299062439; (b) conclusion success; (c) no required check skipped; (d) exactly one open PR from the branch, with number, title, and draft state.

6. Working-tree status

Clean. No untracked, modified, or staged files at any point during review.

7. Exact changed files since the initial review

git diff --stat eae8cfd 835088d — 8 files, +810 / −39:

File	Change
stocky-plus/docs/phases/phase-1/PLANNING_REVIEW_REPORT.md	+504 (new)
stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md	+150
stocky-plus/docs/phases/phase-1/PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md	+86 (new)
stocky-plus/docs/PROJECT_STATUS.md	48
stocky-plus/docs/phases/phase-1/README.md	19
stocky-plus/docs/DECISIONS.md	18
stocky-plus/docs/OPEN_QUESTIONS.md	14
stocky-plus/docs/RISK_REGISTER.md	10

Matches Cursor's changed-file list exactly.

8. Initial-report preservation verdict — PASS

PLANNING_REVIEW_REPORT.md exists at the corrected head and contains the complete initial review. Verified:

Executive verdict at line 7 reads NOT READY; the closing "Final verdict" section also reads NOT READY.
Initial reviewed head recorded as eae8cfdf215e78226f35ba9a2046bddd93590c2c.
All findings present at original severity: P1-01, P1-02, P1-03, P2-04 through P2-08, and the P3 items feeding C-9/C-10/C-11.
The rate-limit disclosure is intact ("I could not verify PR metadata or CI association from the GitHub API").
Corrections table C-1 through C-11 is present as originally written.
I grepped for post-hoc resolution markers (resolved, fixed, superseded, update:). Every hit is original review prose ("Addressed" in the architecture-interrogation section, referring to what the brief addressed), not injected annotation. No finding is marked resolved inside the historical report.

No material alteration. No P1 finding under Gate 1.

9. Documentation-only verdict — PASS

git diff --name-only 8e4f757 835088d | grep -v '^stocky-plus/docs/' returns nothing across the entire branch, not merely since the initial head. Confirmed unchanged: runtime code, Prisma schema, migrations, tests, packages, lockfiles, Shopify configuration, GraphQL operations, .github/workflows/, feature flags, stocky-plus/docs/product/, stocky-plus/docs/agents/.

Every changed path is a permitted planning or control document.

10. C-1 verdict (lock-conscious constraint rollout) — RESOLVED

New brief section ### Lock-conscious constraint rollout plus PR 3 scope and migration tests. Verified present:

CREATE INDEX CONCURRENTLY "where PostgreSQL permits it," with explicit acknowledgement that concurrent index creation must not sit inside a transaction PostgreSQL forbids.
FKs and applicable checks added NOT VALID, validated separately after data verification.
Non-null on populated tables via validated check-constraint or "equivalently proven low-lock method" before final SET NOT NULL.
Explicit lock_timeout and statement_timeout per migration touching populated tables.
Safe abort and retry, with the escalation loophole closed: "must not be bypassed by raising the timeout indefinitely."
Runbook must state expected lock level and maximum expected lock-hold duration for every table-altering step.
Production monitoring for blocked queries, waiting locks, deadlocks, replication lag, transaction age, error rates.
Failure closed, leaving data and application behavior intact.
Migration tests: dataset at the approved engineering envelope; concurrent representative reads and writes during rollout; measurement of lock acquisition and hold duration; failure on exceeding the documented threshold; safe timeout/retry/resume; no prolonged ACCESS EXCLUSIVE from naive full-table validation.
New risk R-036 (P1). PR 3 scope and entry criteria updated.

On the absolutism check: the brief does not claim any technique is universally lock-free. Qualifiers ("where PostgreSQL permits it," "equivalently proven low-lock method") and the mandatory measured-lock-duration evidence together demand proof rather than assumption. This is what C-1 asked for.

11. C-2 verdict (decimal-safe money) — RESOLVED

New brief section #### Decimal-safe Phase 1 money facts, PR 6 scope, ### Money precision test section, and R-014 raised P2 → P1 for the Phase 1 fact surface. Verified:

Exact source representation consumed for every order, order-line, adjustment, cancellation, refund monetary fact.
Number, parseFloat, floating-point arithmetic explicitly prohibited for money.
Persistence must use exact decimal/numeric or an explicitly approved exact representation.
Currency recorded wherever not unambiguously inherited.
The two-decimal assumption is explicitly rejected: values "must not be silently rounded to two decimal places because currencies and Shopify source values may require different precision."
Rounding and normalization explicit, deterministic, tested, traceable to source currency and value.
Order edits, cancellations, partial refunds, multiple partial refunds, duplicate refunds must remain exactly reconcilable to Shopify-reported amounts.
Source lineage preserved sufficient to reverify the original Shopify amount.
Tests enumerated, including values not exactly representable in binary floating point, differing currency decimal conventions, exact equality with Shopify source amounts, and "no conversion through JavaScript Number."
Contamination boundary held: R-014 states "No new Phase 1 fact path may inherit or reuse unsafe JavaScript-number money logic," while legacy PO handler cleanup stays separately scheduled.

This is materially more than "use Decimal."

12. C-3 verdict (tenant immutability) — RESOLVED

New brief section ### Tenant immutability, expanded database-enforcement requirements, updated D-014, new risk R-037 (P1). Verified:

shopId assigned at creation, immutable afterward; no route, worker, job, export, privacy process, reconciliation process, raw SQL path, or database role may reassign a row.
INSERT may set shopId only to the current transaction tenant; UPDATE may not change it.
RLS policies must include appropriate USING and WITH CHECK.
Database-level enforcement must reject tenant-key mutation "even if application validation is missing or bypassed" — application validation is explicitly declared insufficient.
Generic update surface closed: "Application code must not expose shopId as an ordinary mutable update field."
Critically, the brief refuses the shallow answer: "RLS WITH CHECK alone is not a substitute for proving tenant-key immutability under every relevant operation," and the implementation report must name the exact database-enforced mechanism used.
Tests listed: own-row reassignment to Shop B; own-row reassignment to any other value; foreign-shopId insert; raw SQL reassignment; reassignment via worker/job; reassignment via generic update helper; valid non-tenant updates still allowed.
13. C-5 verdict (execution-path isolation) — RESOLVED

Distinct isolation coverage now enumerated for web requests, asynchronous workers, queued jobs, exports, privacy jobs, reconciliation jobs, replay and repair jobs, scheduled synchronization, and concurrent jobs for different shops. Each non-request path carries the four required dimensions: validated context established before merchant-domain access; missing context denied; foreign context denied; pooled connections do not retain a previous tenant; and raw SQL cannot bypass the same policy.

14. C-6 verdict (tenant authority derivation) — RESOLVED

New brief section ### Tenant authority derivation, expanded D-017, new risks R-038 and R-039 (both P1), reflected in PR 2 and PR 4 scope. Verified:

Web authority derives only from server-side verified Shopify authentication and the canonical Shop resolved from that identity.
Query parameters, form values, route parameters, request JSON, browser storage, and client headers "must never establish tenant authority"; they may be untrusted lookup input only after authorization and remain database-constrained.
Background authority derives only from a server-created, persisted, validated, versioned job/event envelope containing canonical shopId, source, correlation or causation identity, schema version, and integrity validation.
Explicitly insufficient: raw queue payload, Shopify domain string, external ID, client-created job message.
Workers must resolve and validate the Shop before establishing transaction-local context.
Invalid, missing, disabled, uninstalled, redacted, mismatched envelopes fail closed; replay preserves validated authority and audit lineage.
Tests: client shop query parameter, client header, client JSON field, authenticated-vs-supplied mismatch, missing job tenant, disabled/uninstalled shop, tampered envelope, replay authority preservation, worker denial before tenant validation.

The C-6 failure condition is closed: an implementer could not now legally establish RLS context from request.shop, a header, or an unvalidated queue payload.

15. C-7 verdict (durable duplicates) — RESOLVED

The synchronization test list now contains the specific case: "A duplicate webhook arriving after the temporary queue deduplication or retention window has expired, proving persistent database-backed idempotency prevents duplicate application." Supporting cases added: durable idempotency-record retention long enough for the approved replay and reconciliation policy; a legitimate distinct event is not incorrectly rejected; replay remains auditable. R-032 updated. BullMQ retention alone is explicitly not the mechanism.

16. C-8 verdict (quarantine resolution) — RESOLVED

New brief section ### Ownership quarantine resolution, PR 1 report requirement, PR 3 entry gate, R-029 expanded. Verified: quarantine rows must carry table, row identity, current ownership evidence, conflicting ownership evidence, parent lineage, source shop values, reason code, detection run, status. A non-empty quarantine blocks non-null enforcement, composite tenant constraints, and RLS for the affected domain. Guessing is prohibited — "Cursor and implementation agents must not guess ownership to meet a schedule" and "Schedule pressure is not authority to infer, share, delete, or fabricate tenant ownership." Automated repair only under a previously approved deterministic rule with auditable evidence; ambiguous rows require written proposal and product-owner escalation; manual repair requires evidence, reviewer identity, before/after values, audit record; irrecoverable rows require explicit product-owner disposition and silent deletion is prohibited; all checks, counts, checksums, cross-domain validations rerun after repair. PR 3 blocked until unresolved count is zero and the resolution report is reviewed. The lock-rollout section independently repeats the gate.

17. C-9 verdict — RESOLVED

PROJECT_STATUS.md now cross-references R-015 in both "Current truth" and "Where to look," citing ruleset Protect main id 20012314 including empty bypass_actors. The full evidence body was not duplicated; R-015 remains the single evidence home.

18. C-10 verdict — RESOLVED (acceptable disposition)

READY FOR PHASE 2 PLANNING is now explicitly defined in the brief under ### Exit verdict definition. It requires every Phase 1 exit criterion satisfied, all required PRs and corrections merged, exact reviewed heads and CI verified, no open P0 or P1, Shopify reconciliation and tenant isolation passed, production inventory writes still separately unapproved, and it authorizes Phase 2 planning only — explicitly not Phase 2 implementation.

No file under stocky-plus/docs/agents/ changed (verified by full-branch diff). The deferral is recorded transparently in both the brief and the correction report rather than falsely marked complete. This preserves the original correction intent without violating the planning PR's prohibition on agent-instruction changes — the disposition C-10 anticipated.

19. C-11 verdict (PR 2 access inventory) — RESOLVED

PR 2 scope now requires a "mechanically generated or otherwise complete inventory of all direct Prisma-client access" covering every route, service, worker, job, export, privacy processor, reconciliation path, script, and raw SQL path touching merchant-owned data, with old access method, new tenant-bound method, conversion status, test evidence, and any approved exception with justification. It additionally requires an automated or equivalently enforceable check proving no unapproved direct global Prisma access to merchant-domain tables remains, no raw SQL merchant-domain access outside approved tenant-bound modules, bootstrap modules touching only approved bootstrap tables, and new violations failing CI. The narrative loophole is closed explicitly: "PR 2 must not be accepted based only on a narrative claim that access was converted."

20. Phase boundary verdict — PASS

The corrections introduced no migration implementation, no RLS SQL, no schema change, no money-ledger implementation, no billing or entitlements, no AI, no forecasting, no ABC/U, no PO/receiving/stocktake/transfer/cost implementation, no inventory writes, and no implementation authorization. Every addition is a stated requirement or test obligation, not an artifact. The brief header remains DRAFT — IMPLEMENTATION NOT AUTHORIZED.

21. Tenant-isolation verdict — PASS (planning)

The layered model is now materially stronger than at initial review: canonical Shop, shopId on every merchant-owned row, composite tenant constraints, forced RLS with USING/WITH CHECK, database-enforced tenant-key immutability, restricted runtime role with no BYPASSRLS, separate migration role, transaction-local context derived only from verified Shopify authentication or a validated job envelope, restricted bootstrap exception, and per-execution-path isolation tests. F-016 / R-022 remains an open mandatory P1 implementation gate; composite FKs without RLS explicitly do not satisfy it. Q-011 is explicitly not to be closed as implemented.

22. Migration and rollback verdict — PASS (planning)

Low-lock rollout, measured lock evidence, threshold failure, safe abort/retry/resume, quarantine entry gate, expansion migrations remaining compatible with legacy shop columns, RLS rollback only to a tenant-aware release, emergency policy disablement requiring incident authorization and a recovery path, verified backups before production migration approval, testing on empty / current-fixture / production-like restored databases, and no migration deleting operational history. R-035 and R-036 both P1.

23. Exact-money verdict — PASS (planning)

See §11. R-014 is P1 for the Phase 1 fact surface and explicitly must not be claimed resolved until implementation and exact-money tests pass independent review.

24. Test-plan verdict — PASS (planning)

The test plan grew from a reasonable list to a genuinely adversarial one: tenant reassignment across six vectors, nine distinct execution paths with four failure dimensions each, nine client/job-authority denial cases, six lock-behavior cases, four durable-idempotency cases, eleven money-precision cases. Each maps to a stated correction rather than to generic coverage.

25. Governance and project-status verdict — PASS

Verified in PROJECT_STATUS.md: initial planning review recorded as NOT READY at head eae8cfdf…; stage is planning corrections awaiting re-review; Phase 1 PLANNING ONLY — IMPLEMENTATION NOT STARTED; brief DRAFT — IMPLEMENTATION NOT AUTHORIZED; PR #9 open and draft and must remain so until successful re-review and ChatGPT approval; F-016 / R-022 a mandatory P1 gate, not implemented; R-014 P1 proposed, not implemented; production inventory writes UNAPPROVED; inventory-write flags DEFAULT OFF; next action is independent re-review of the exact corrected head and its CI, then ChatGPT's approval decision.

PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md maps C-1 through C-11 accurately against the actual diff — I checked each row against the corresponding file change and found no overclaim. It explicitly states "Claude accepted corrections: Not claimed — re-review required" and "Claude has not accepted these corrections." The C-4 disposition correctly attributes the old-head CI verification to Cursor, not to me, and states that corrected-head CI must be verified separately against the new run's head_sha. The C-10 disposition is explained accurately.

D-014 and D-017 remain PROPOSED. Q-011, Q-002, Q-008 remain open.

26. P0 findings

None.

27. P1 findings

None open. P1-01, P1-02, and P1-03 from the initial review are resolved as set out in §10–§12.

28. P2 findings
P2-12 — Corrected-head CI association not independently verifiable in this environment
File / line: N/A — external verification
Evidence: GET /repos/Vedang1998/Stocky/actions/runs/30564344329 returned HTTP 403 "API rate limit exceeded for 146.148.42.91." Repeated on a plain repository metadata call. No authenticated GitHub connector or CLI credential is available in this session.
Merchant impact: None directly. Governance impact: the project would otherwise be accepting a green-CI claim on the reviewer's behalf without proof, which is the exact failure mode R-015 was raised against.
Reproduction: Issue any unauthenticated api.github.com request from this environment.
Expected behavior: Corrected-head CI association proven from the workflow run's actual head_sha.
Required correction: An authenticated party must confirm and record, with explicit attribution: run 30564344329 has head_sha == 835088d3c0294222b14d67a5875709f299062439; conclusion success; no required check skipped; exactly one open PR from docs/phase-1-planning, with number, title, and draft state. Record it as Cursor/ChatGPT-verified, not Claude-verified — the R-015 and C-4 precedent.
Missing test: N/A
Conflict with Cursor's claim: Cursor asserts these values as verified. I neither confirm nor dispute them; I record that I cannot verify them.
P2-13 — Corrected-head CI evidence is not in the permanent record
File / line: stocky-plus/docs/phases/phase-1/PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md, "Commit and CI evidence" table
Evidence: New CI run ID, job ID, actual head_sha, and conclusion all read _recorded in PR #9 description after CI completes_. The report states this avoids a self-referential commit chasing its own SHA — a fair reason — but the consequence is that corrected-head CI evidence exists only in a PR description, which is mutable and disappears from the repository record after merge.
Merchant impact: None directly. Supportability impact: the phase record will not contain the CI evidence for the head that was reviewed.
Reproduction: Read the correction report at 835088d….
Expected behavior: Permanent phase records carry their own exact-head CI evidence, as Phase 0 closure evidence does in PROJECT_STATUS.md.
Required correction: When this correction-review report is added verbatim, record the corrected-head CI association (run ID, job ID, actual head_sha, conclusion, skipped-check status, verifier attribution) in the permanent record — PROJECT_STATUS.md alongside the existing C-4 block is the natural home. That new head then itself requires exact-head CI verification.
Missing test: N/A
29. P3 findings
P3-14 — Correction report labels the wrong SHA as "new PR head"
File: PLANNING_CORRECTION_IMPLEMENTATION_REPORT.md, "Commit and CI evidence"
Evidence: The row reads "Correction commit / new PR head | cec0a10f65e96f5d29b34ec41e59ada5bec0528f". The actual PR head is 835088d3c0294222b14d67a5875709f299062439; cec0a10… is its parent. git rev-parse pr/9 confirms.
Impact: A future reader verifying CI against the documented "new PR head" would check the wrong SHA. Cursor's completion report states both SHAs correctly, so this is a record inconsistency rather than a factual error.
Required correction: Split the row into "Primary correction commit cec0a10…" and "PR head at review 835088d…."
30. Required remaining corrections
ID	Severity	Correction	Blocking?
P2-12	P2	Authenticated verification of corrected-head CI head_sha, conclusion, skipped checks, and PR uniqueness/state, attributed to the verifier	Not blocking this verdict; required before merge
P2-13	P2	Record corrected-head CI evidence in the permanent record, not only the PR description	Not blocking this verdict; required before merge
P3-14	P3	Correct the "new PR head" SHA label in the correction report	No
31. Confirmation — no Phase 1 implementation occurred

Confirmed. git diff --name-only 8e4f757 835088d filtered against ^stocky-plus/docs/ returns an empty set across the entire branch. No Prisma schema change, no migration, no runtime code, no test, no package or lockfile, no Shopify configuration, no GraphQL operation, no CI workflow, no feature-flag change. Every added requirement is stated as a future implementation obligation.

32. Confirmation — no implementation branch exists from this work

Confirmed. Remote branches at review time: docs/phase-0-closure, docs/phase-1-planning, docs/phase-tracking-system, main, phase-0-product-alignment-v2, phase-0/correction-gate, phase-0/correction-gate-followup. No phase-1/* implementation branch exists. I created no branch.

33. Confirmation — production inventory writes remain unapproved

Confirmed. PROJECT_STATUS.md, phases/phase-1/README.md, and the correction report all state UNAPPROVED. Nothing in this pull request authorizes inventory writes.

34. Confirmation — all inventory-write flags remain default OFF

Confirmed by inspecting the code, not the claim. stocky-plus/app/lib/feature-flags.server.ts implements envFlag(name, defaultEnabled = false), returning the default when the variable is undefined or empty. All five capabilities — stocktakeInventoryWrites, adjustmentWrites, receiptWrites, costSync, transferWrites — call envFlag without overriding the default. .env.example:20 sets FEATURE_STOCKTAKE_INVENTORY_WRITES=false; .github/workflows/ci.yml:49 sets it "false" in CI. This file is unchanged by the pull request.

35. Confirmation — reviewer made no modifications

Confirmed. I did not modify any file, create a branch, stage or commit anything, push, open or merge a pull request, mark PR #9 ready for review, create a Phase 1 implementation branch, begin implementation, or authorize or enable inventory writes. All operations were read-only: git clone, git fetch, git rev-parse, git log, git diff, git show, git status, grep, sed, and two unauthenticated HTTP GETs that were rate-limited. The working tree was clean throughout. I have not committed this report.

Final verdict

READY FOR CHATGPT PHASE 1 BRIEF APPROVAL

Open P0: none. Open P1: none. Open P2: P2-12 (CI association unverifiable here), P2-13 (CI evidence not in permanent record). Open P3: P3-14.

Assessment for ChatGPT: the corrections did the harder version of the work. On C-1 the brief demands measured, version-appropriate low-lock behavior with a failure threshold rather than reciting CONCURRENTLY; on C-2 it rejects the two-decimal assumption and requires source lineage rather than saying "use Decimal"; on C-3 it explicitly refuses WITH CHECK as sufficient proof and requires the implementation report to name the mechanism. Those three were the substance of the initial NOT READY, and they are genuinely closed at the planning level.

This verdict returns the brief to you for product-owner approval and authorizes nothing further. Phase 1 implementation remains unauthorized, F-016 / R-022 and R-014 remain open P1 implementation gates, production inventory writes remain unapproved, and every requirement added here is a promise that implementation review must still test.

Re-review requirement: adding this report verbatim is a record-preservation change; the resulting head still requires exact-head CI verification. Any substantive modification to the brief, decisions, risks, questions, or status after this review requires another independent review.

Per the stop condition, I am stopping here.
