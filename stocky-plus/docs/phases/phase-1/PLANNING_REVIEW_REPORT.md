Phase 1 Planning Review Report

Intended permanent location: stocky-plus/docs/phases/phase-1/PLANNING_REVIEW_REPORT.md

1. Executive verdict

NOT READY

The planning pull request is genuinely documentation-only, Phase 0 is represented accurately, the Phase 1 boundary is well drawn, and the tenant-isolation architecture is the strongest artifact this project has produced to date — it correctly rejects the shortcuts (app-layer filters, shopId alone, composite FKs alone) that F-016 / R-022 was raised against.

However, three mandatory planning gates are not satisfied, and one required verification could not be performed:

P1-01 — the migration plan contains no lock-conscious constraint-rollout requirement. Adding NOT NULL and composite foreign keys to populated tables with naive DDL takes ACCESS EXCLUSIVE locks and is an outage, not a migration.
P1-02 — the order/line/refund fact plan specifies no decimal-safe money requirement. R-014 (JS Number money) is deferred to "Phase 3," but Phase 1 is where the monetary facts that later cost and receipt ledgers depend on are first persisted.
P1-03 — the required tenant-immutability rule (a row's shopId cannot be changed) is absent from both the RLS architecture and the test list.
P2-04 — I could not verify PR metadata or CI association from the GitHub API (rate-limited). Per this task's own instruction, CI association must be proven from the workflow run's actual head_sha; Cursor's assertion is not sufficient evidence.

None of these are structural failures of the plan. All four are additive corrections to an otherwise sound brief.

2. Review identity
Field	Value
Reviewer	Claude (independent review)
Review type	Planning-governance review (not implementation review)
Review date	2026-07-30
Method	Fresh git clone of the public repository; direct diff and file inspection
Runtime code written	None
Files modified	None
3. Repository, base, and exact head reviewed
Field	Value	Verification
Repository	Vedang1998/Stocky	Cloned successfully
Base branch	main	—
Base SHA	8e4f757c4717baba0ece74135b062324ff429ee6	git log -1 main — matches Cursor's claim
Base subject	Close Phase 0 correction gate and record final review (#8)	Verified
Head branch	docs/phase-1-planning	git ls-remote — matches
Head SHA	eae8cfdf215e78226f35ba9a2046bddd93590c2c	git ls-remote — matches
Merge base	8e4f757c…	Branch is current with main; zero drift
Commits on branch	2 (a09a738d… brief; eae8cfdf… status)	Verified
Head author	Vedang (Odoo) <Odoo@MacBook-Air.local>	Verified
Changed files	7	Verified (--name-only | wc -l)
Working tree	Clean	git status --porcelain empty

Cursor's claim of "commits after Phase 0 closure: none" is verified — merge-base main FETCH_HEAD equals the Phase 0 closure SHA exactly.

4. PR state and CI association

PARTIALLY VERIFIED — evidence gap recorded.

Field	Cursor's claim	My verification
PR number	#9	Not independently verified
PR title	Plan Phase 1 tenant-safe Shopify fact foundation	Not verified (branch commit subject is Plan Phase 1 tenant-safe Shopify fact foundation.)
Draft state	draft, OPEN	Not verified
Multiple matching PRs	—	Could not test for ambiguity
CI run ID	30557753268	Not verified
CI job ID	90922508937	Not verified
CI conclusion	success	Not verified
CI head_sha association	implied	NOT VERIFIED — this is the item the task specifically forbids taking on faith

The GitHub REST API returned 403 API rate limit exceeded for this environment's IP on every attempt. git protocol access worked; API access did not. I therefore verified everything derivable from Git objects and nothing derivable only from the GitHub API.

This is the same class of limitation that was honestly recorded in the PR #8 closure review, and it is recorded here rather than papered over. See P2-04.

What I can state: the reviewed head eae8cfdf… is the current tip of refs/heads/docs/phase-1-planning on origin at review time, so any CI run genuinely associated with that branch tip is associated with the reviewed content.

CI flag state — VERIFIED from the workflow file at head: .github/workflows/ci.yml sets all five inventory-write flags to "false" at the job level (lines 49–53), and the workflow file is not in this PR's diff.

5. Changed-file list and classification
#	Path	Status	Class
1	stocky-plus/docs/DECISIONS.md	M (+149)	Governance doc
2	stocky-plus/docs/OPEN_QUESTIONS.md	M (+85/−)	Governance doc
3	stocky-plus/docs/PHASE_1_TECHNICAL_PLAN.md	M (+12/−2)	Legacy doc — superseding notice
4	stocky-plus/docs/PROJECT_STATUS.md	M (+135/−125)	Live dashboard
5	stocky-plus/docs/RISK_REGISTER.md	M (+34/−)	Governance doc
6	stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md	A (+570)	Phase record
7	stocky-plus/docs/phases/phase-1/README.md	A (+49)	Phase record

Totals: 7 files, 909 insertions, 125 deletions. Matches Cursor's completion report exactly.

6. Documentation-only verification

PASS.

git diff --name-only main...eae8cfdf | grep -v '^stocky-plus/docs/' returns nothing. Every changed path is under stocky-plus/docs/.

Check	Result
Runtime application file changed	No
Prisma schema changed	No
Migration changed	No — still one migration, 20260728000000_init_stocky_plus
Test changed	No
Package file / lockfile changed	No
Shopify configuration changed	No
GraphQL operation changed	No
CI workflow changed	No
Feature flag changed	No — app/lib/feature-flags.server.ts untouched
Approved product document changed	No — no path under docs/product/
Agent instruction changed	No — no path under docs/agents/
Phase 0 record changed	No — no path under phases/phase-0/

All eleven Phase 0 record files remain present and unmodified.

I also verified the brief's stated premise against the actual code rather than accepting it: prisma/schema.prisma contains zero occurrences of shopId, zero model Shop, and 13 bare string shop fields. The brief's problem statement is factually accurate, not rhetorical.

7. Phase 0 accuracy verdict

PASS, with one P3 cross-reference observation.

Phase 0 closure merge 8e4f757c… is the actual current main tip — verified against Git, not against the document.
PR #8 merged; PROJECT_STATUS.md records it as immutable closure evidence.
Phase 1 implementation is not claimed as started; PROJECT_STATUS.md states PLANNING ONLY — IMPLEMENTATION NOT STARTED.
Production inventory writes recorded UNAPPROVED; flags recorded DEFAULT OFF.
No stale pre-PR-#8 status remains — the old 6fbe4c1d… "current main SHA" line was correctly replaced, and 6fbe4c1d… is retained in its correct historical role as the PR #7 squash merge.
Prior Claude verdicts remain historically accurate: BLOCKED (PR #6), NOT READY (PR #7 at 33aaac3…), READY FOR PHASE 1 FOUNDATION (PR #7 final).
No false attribution. RISK_REGISTER.md R-015 explicitly preserves that the branch-protection verification was performed by ChatGPT/Codex and that "Claude's original PR #8 review environment was rate-limited and did not verify these items at that time." This is exactly correct and is the behavior the required-reading order asks for.
Stable immutable evidence is used correctly. PROJECT_STATUS.md now says of the active PR: "verify live head and CI on GitHub; do not treat a branch-tip SHA in this file as immutable evidence." That is the right pattern — closed work is pinned to merge SHAs, open work is pinned to nothing.

Observation (P3-08): the full API-verified branch-protection block was removed from PROJECT_STATUS.md. No evidence was lost — R-015 retains the complete record including ruleset ID 20012314, bypass_actors: [], and the required check name. But the live dashboard no longer carries or cross-references it.

8. Phase 1 boundary verdict

PASS.

In-scope list covers all ten required areas: canonical tenant identity, database-enforced isolation, Shopify-authoritative read facts, sync control plane, reconciliation, data health, audit foundation, Shopify-user/role scaffold, privacy processing, performance instrumentation and tests.

Out-of-scope list covers every required exclusion, and adds four the task did not require: enabling any inventory-write flag, destructive removal of tables/records/legacy shop columns, supplier workflow expansion beyond tenant ownership, and broad merchant-facing UI redesign.

The boundary is further protected by a line I regard as the most important sentence in the scope section:

"Existing operational routes may be migrated to the tenant access contract, but their product behavior must not be expanded."

This is precisely the seam through which "harmless foundation" scope creep normally enters, and it is closed explicitly.

Legacy PHASE_1_TECHNICAL_PLAN.md neutralization — PASS. The +12-line historical notice states the document was never implementation authority, names its receipt/cost/entitlement/billing-adjacent/AI ledger items as not approved Phase 1 scope, and preserves the body for traceability only. PROJECT_STATUS.md and the phase-1 README.md both independently label it "not implementation authority." Three-point coverage is adequate.

No disguised future-feature implementation found. I checked the in-scope list specifically for smuggled ledger work: the audit foundation is scoped to "Phase 1 platform and synchronization actions," the role work is a "scaffold" with permission checks only, and refund/cancellation items are read facts with no ledger, no cost, and no write path.

9. F-016 / R-022 tenant-isolation verdict

PASS on architecture. Two gaps in enforcement detail (P1-03, P2-05).

Required-element checklist:

Required element	Present
Canonical Shop	Yes — stable internal ID
Normalized unique Shopify domain	Yes
Non-null shopId on every merchant-owned row	Yes
Tenant-composite parent keys	Yes
Tenant-composite child FKs	Yes
Tenant-composite cross-domain relations	Yes
PostgreSQL RLS	Yes
FORCE ROW LEVEL SECURITY	Yes — "enabled and forced"
Runtime role does not own tables	Yes
Runtime role without BYPASSRLS	Yes
Separate migration role	Yes — "unavailable to web and worker processes"
Transaction-local tenant context	Yes
Default denial when context absent	Yes
Context from server-side identity or validated envelope	Partial — see P2-06
No client-supplied shop authority	Implied, not stated — see P2-06
Restricted Session/Shop bootstrap	Yes — D-018, dedicated module
Real PostgreSQL tests	Yes
Pool-leakage tests	Yes
Raw SQL isolation tests	Yes — "Raw SQL denial"
Worker/export/privacy/reconciliation isolation tests	No — see P2-05

The decisive sentence appears three times independently (brief, D-014, R-022, plus the phase-1 README):

"Composite tenant foreign keys without Row-Level Security do not satisfy F-016 / R-022."

This directly answers the task's disqualifying condition. The plan does not leave omitted-filter reads possible: RLS with FORCE, default-deny on absent context, and a prohibition on "direct unrestricted Prisma or raw SQL access to merchant-domain tables" together mean an unscoped query is denied by the database, not by the application.

Challenge responses:

Can Session access become a general bypass? Addressed. D-018 isolates bootstrap in a small module that "cannot query merchant-domain tables," with the explicit rule that "sessions must not become a general tenancy bypass," backed by R-027 and boundary tests.
Could runtime inherit owner privileges? Addressed — D-015, R-025, plus privilege-verification tests.
Could pooling leak context? Addressed — D-017, R-024, transaction-local requirement, dedicated leakage tests.
Can every existing global Prisma use be converted before RLS? Addressed by sequencing: PR 2 (access conversion) is a hard predecessor of PR 3 (RLS activation), and the migration section states "Convert all runtime data access before activating RLS."
Could migration credentials be used by runtime? Addressed — D-016, R-026.
Are reads protected as strongly as writes? Yes — RLS applies to SELECT; the test list requires cross-shop select denial and unscoped-read denial.
Are all child tables and cross-domain relations covered? Yes in principle; PO-to-supplier is called out by name. The per-table application list is correctly deferred to PR 1.
Can background jobs prove validated tenant ownership? The access contract explicitly covers "workers, jobs, exports, privacy actions, and reconciliation." Test coverage for these is the P2-05 gap.

Gaps: the plan never states that shopId is immutable — RLS WITH CHECK must prevent a row's tenant from being reassigned (P1-03) — and the isolation test list omits worker/export/privacy/reconciliation isolation as distinct cases (P2-05).

10. Migration and backfill verdict

FAIL — P1-01.

Present and correct:

Requirement	Status
Additive migrations only	Present
Original migration untouched	Present
Legacy shop columns retained	Present — also an explicit out-of-scope item
Nullable expansion before enforcement	Present
Canonical Shop rows from normalized verified domains	Present
Parent backfill from existing shop values	Present
Child backfill from verified parents	Present
PO-to-supplier cross-domain validation	Present — named explicitly
No "unknown"/shared/guessed tenant	Present — "never guess ownership"
Quarantine inconsistent rows	Present — plus R-029
Resumable / idempotent / batched / checkpointed	Present — all four named
Row counts, unresolved counts, checksums	Present — before/updated/unresolved/checksums
Zero unresolved before non-null enforcement	Present
Runtime conversion before RLS activation	Present
Production-like dry run	Present — "production-like restored database"
Backup restoration evidence	Present — "before production migration approval"
Rollback only to tenant-aware app	Present
No destructive down migration	Present — "No migration may delete operational history"
Forward-recovery runbook	Present — mandatory deliverable
Failure-closed behavior	Present
Lock-conscious constraint rollout	ABSENT

The brief's migration section is otherwise exemplary. The single missing item is material: PR 3 adds NOT NULL and composite foreign keys to populated production tables. Without NOT VALID + VALIDATE CONSTRAINT, CREATE INDEX CONCURRENTLY, lock_timeout, and a documented statement-timeout posture, these operations acquire ACCESS EXCLUSIVE locks and block all traffic on the affected tables for the duration of a full table scan. On the brief's own performance envelope — 750,000 variant-location states and 1,000,000 order-line facts — that is a merchant-visible outage.

The brief also does not challenge its own clean-data assumption strongly enough in one respect: it plans quarantine for inconsistent rows but sets no expectation for what happens if quarantine is non-empty at the enforcement gate. "Enforce only after unresolved count is zero" is the right rule, but there is no stated path for resolving a non-zero count — manual repair, product-owner escalation, or scope extension.

11. Rollback and recovery verdict

PASS.

The rollback section correctly identifies the asymmetry that makes RLS activation a one-way door:

"The pre-Phase-1 application is not an acceptable rollback target after RLS activation."

Also present: expansion migrations stay legacy-compatible; emergency policy disablement requires explicit incident authorization plus a documented recovery path; backups restored and verified before production migration approval; interrupted backfills resume safely; failed validation leaves data intact and fails closed; migration, rollback, and forward-recovery runbooks are mandatory deliverables. R-035 tracks the wrong-rollback-target risk.

This is the correct posture: forward recovery is primary, rollback is bounded and authorized.

12. Shopify authority verdict

PASS.

Shopify is declared authoritative for all nine required domains: shops, locations, products, variants, inventory items, sellable inventory states, orders, order edits and cancellations, refunds.

"Phase 1 does not mutate Shopify inventory" — stated in the brief; reinforced in PR 5 ("Shopify inventory-state ingestion only. No Shopify inventory mutation"); reinforced again in the API-version section ("keep every inventory mutation excluded").
The application's role is correctly limited to synchronized facts, snapshots, lineage, reconciliation results, and platform audit information.
No inventory-write flag is approved for enablement; this appears in the brief header, the phase README, the branch rules, and the exit criteria.

API version — PASS. The planning PR does not change the API version (verified: no shopify.app.toml or config file in the diff). D-023 and R-033 require validating GraphQL documents and webhook fixtures against the current stable Admin API before the first sync implementation merges, recording the approved version, and avoiding near-retirement versions. Given the existing R-007 finding that some operations are already invalid against the 2025-10 pin, deferring the version decision to a validation gate rather than guessing it in a planning PR is the correct call.

13. Synchronization and reconciliation verdict

PASS on control plane. Two gaps (P1-02, P2-07).

Correct:

Webhooks are explicitly "notifications and may be duplicated, delayed, delivered out of order, or missed."
Initial synchronization and periodic reconciliation both required.
Persistent webhook inbox; persistent idempotency and correlation IDs; sync runs and cursors; job attempts and dead letters; replay and repair workflows; reconciliation runs and data issues.
"No sync run is successful until extraction, database application, watermarks, and reconciliation status are recorded" — this correctly prevents the classic "sync succeeded because the fetch returned 200" failure.
"Every discrepancy must be repaired or surfaced. It may not be silently ignored."
Hard caps: "Complete pagination" in PR 5; explicit ">50 locations and 250 variants" test; R-010 updated; "no silent hard caps" in the exit criteria.
Bulk ingestion: "Streaming and batched bulk ingest," "bounded-memory bulk ingestion."
Historical identity and tombstones: "Historical identity snapshots and deletion/tombstone state"; "Product and variant deletion or recreation" test.
PII minimization: "no unnecessary customer PII" in the brief, PR 6, D-021, and the exit criteria.
Throttling, retry, partial-failure, dead-letter replay all covered.

Gap — P1-02 (money): PR 6 specifies "Net quantity and amount handling" with no requirement that monetary values avoid JavaScript floating-point. R-014 exists but defers decimal safety to "Phase 3." That deferral is wrong for this phase: Phase 1 persists order-line and refund amount facts, and every later cost, receipt, and landed-cost ledger reads from them. Storing amounts through Number arithmetic in Phase 1 means the ledgers built on top inherit rounding drift, and correcting it later requires re-ingesting every order fact.

Gap — P2-07 (durable idempotency): the plan requires "persistent idempotency and correlation IDs" — correct — but the test list has "Duplicate and delayed webhooks" without the specific case of a duplicate arriving after queue-retention expiry. That is the case where in-queue deduplication silently stops working and only a durable idempotency record saves you; it deserves its own test.

14. Privacy verdict

PASS.

Requirement	Status
Immediate processing shutdown on uninstall	Present — also R-031, PR 4/7
Queued jobs cancelled or failed closed	Present
Session and access-token deletion	Present
Minimal customer PII	Present
Real customers/data_request	Present
Idempotent customers/redact	Present — "every privacy process is idempotent"
Idempotent shop/redact	Present
Operational tables / caches / queue payloads / exports / storage objects deleted	All five named explicitly
Deletion manifests	Present
Retry after partial deletion	Present — plus "Partial deletion retry" test
Reinstall behavior	Present — "Reinstall before and after redaction" test
Narrow legal-retention exceptions	Present
Legal records segregated from normal use	Present — "minimized, segregated, inaccessible to normal application workflows"
Legal review before production	Present — brief, D-021, Q-008, R-030

No vague "retain for support" policy exists. Retention is limited to a non-reversible deletion receipt plus records "counsel confirms must be retained," each requiring an explicit retention rule. Q-008 is explicitly held open pending legal validation of the retention schedule, deletion-manifest contents, and privacy-policy language.

15. Performance and test-plan verdict

PASS on strength and realism. Two coverage gaps (P1-03, P2-05).

The plan requires real PostgreSQL testing, not mocked Prisma assertions — stated in the brief, D-014's implications, the exit criteria, and the CI requirement that CI run with both a migration-owner role and a restricted runtime role plus Redis.

Engineering envelope is concrete and defensible: 50,000 active variants, 15 locations, 750,000 variant-location states, 1,000,000 order-line facts, multi-shop concurrency. Targets are named: p95 < 500 ms for data-health and indexed list queries, p95 < 1 s for durable webhook enqueue, with documented p50/p95 on a named environment. Required outcomes include no silent hard caps, no N+1, bounded-memory ingestion, query-count assertions, and indexed tenant query plans.

Five new commands are specified: test:db-isolation, test:migrations, test:sync-integration, test:privacy, test:performance.

Coverage against the required 40-item list: 37 present. Missing:

A row's tenant cannot be changed — P1-03
Exports / privacy jobs / reconciliation jobs remain isolated as distinct test cases — P2-05
Duplicate after queue-retention expiry — P2-07

Everything else — cross-shop select/insert/update/delete denial, composite FK tenant-mismatch rejection, missing-context denial, raw SQL denial, runtime-role privilege verification, concurrent-shop and pooled-connection isolation, bootstrap boundary, migration interruption/resume/idempotent rerun, failed constraint validation, backup restoration, out-of-order and missed webhooks, initial-sync overlap, partial bulk failure, throttling, dead-letter replay, variant deletion/recreation, >50 locations, >250 variants, order edit, cancellation, partial refund, duplicate refund, uninstall-while-queued, complete privacy deletion — is present.

16. Q-002 verdict

PASS.

Product direction and evidence are cleanly separated. Q-002 status reads "Open — evidence still required." D-019 is marked "PROPOSED — pending Partner Dashboard evidence (Q-002)."

The brief states the intended production distribution is public App Store and that development, staging/pilot, and production must use separate registrations or explicitly isolated linked configurations, credentials, databases, Redis, storage, callback URLs, and webhook destinations — then immediately requires that "Partner Dashboard app IDs and actual distribution selections must be verified before any deployment work."

No false claim that dev/staging/production apps already exist. The dedicated Q-002 section lists five items the Partner account holder must still provide (production app ID, development and staging app IDs, actual distribution methods, configuration separation, linked CLI configuration). AppDistribution.AppStore in the repository is not cited anywhere as proof. R-012 still records that shopify app info crashed and distribution remains unverified.

17. Q-006 verdict

PASS.

14-day Growth-equivalent trial presented as a working commercial hypothesis, not a decision.
Private $0 development plan is explicitly non-production-only, limited to approved development/test stores, unavailable to ordinary merchants, and "incapable of bypassing tenancy, permissions, or inventory-write gates."
Phase 1 does not implement billing, plans, entitlements, or commercial usage limits — stated in the brief, D-020, the out-of-scope list, and R-008.
Q-006 carries the instruction: "Do not close Q-006 as implemented."
18. Q-008 verdict

PASS. See §14. Q-008 status is "Open — recommended policy recorded; legal review still required," with an explicit instruction not to treat the recommendation as final production policy until counsel validates retention, deletion manifests, and privacy-policy language.

19. Q-011 verdict

PASS.

Q-011 status: "Open — layered decision proposed in draft brief; not implemented," needed by "Phase 1 foundation — mandatory implementation gate until merged and independently verified."

The proposed decision contains all nine required elements: Shop, shopId, composite tenant constraints, forced RLS, restricted runtime role, separate migration role, transaction-local context, bootstrap exception, real database tests.

The gate is correctly not treated as closed by the existence of a planning document. The dedicated Q-011 section states: "Keep Q-011 open as a mandatory Phase 1 implementation gate until the enforcement work is merged and independently verified." R-022 adds: "Mandatory Phase 1 P1 gate — do not downgrade. Implementation not started."

20. Implementation-PR sequence verdict

PASS.

The eight proposed PRs match the required dependency order exactly:

#	Branch	Scope
1	phase-1/tenant-expand	Shop, nullable shopId, backfill journal, diagnostics — no RLS
2	phase-1/tenant-access	Access contract, convert all domain access, bootstrap
3	phase-1/tenant-enforcement	STOP GATE — non-null, composite FKs, roles, forced RLS, isolation tests
4	phase-1/sync-control-plane	Inbox, runs, cursors, dead letters, replay, uninstall shutdown
5	phase-1/catalog-location-inventory-facts	Read models, pagination, streaming ingest
6	phase-1/order-refund-facts	Orders, lines, edits, cancellations, refunds
7	phase-1/audit-roles-privacy	Audit events, role scaffold, privacy processors
8	phase-1/reconciliation-performance-exit	Reconciliation, load evidence, recovery rehearsal, exit

PR 3 is an explicit hard gate:

"No later Phase 1 implementation PR may begin until this PR is independently reviewed, accepted by ChatGPT, and merged."

This is restated in D-022. Each PR carries the same five conditions: starts from updated main, contains only its approved scope, passing CI, independent Claude review, ChatGPT acceptance, explicit user merge authorization.

Narrowness assessment: PRs 1, 3, 4, 6, 7 are appropriately narrow and independently reviewable. PR 2 (convert all routes, services, workers, jobs, exports, and reconciliation code) is the largest and hardest to review, but splitting it would leave the codebase in a mixed access state across a merge boundary — which is worse. Its "Do not change product behavior" constraint is the right mitigation, and it should be reviewed with a mechanical inventory of converted call sites rather than by narrative. PR 5 carries some risk of absorbing PR 6 work; the boundary should be held firmly at review.

21. P0 findings

None.

No security breach, cross-tenant exposure, destructive inventory or financial corruption, broken authentication, unrecoverable data loss, secret exposure, or false-authority claim was found. The PR is documentation-only, makes no false claims about Phase 0 or Partner Dashboard state, and does not assert implementation authority it does not have.

22. P1 findings
P1-01 — No lock-conscious constraint rollout in the migration plan
Severity: P1
File: stocky-plus/docs/phases/phase-1/PHASE_BRIEF.md — "Migration and backfill requirements"; PR 3 definition
Evidence: The section specifies additive-only, nullable-first, resumable, idempotent, batched, checkpointed, checksummed migration with a production-like dry run. It contains no requirement addressing lock acquisition. PR 3's scope is "Enforce non-null tenant ownership… Add composite tenant foreign keys" with no rollout mechanics.
Merchant impact: ALTER TABLE … SET NOT NULL and ADD CONSTRAINT … FOREIGN KEY take ACCESS EXCLUSIVE locks and perform a full validating scan. At the brief's own envelope (750k variant-location states, 1M order-line facts), all reads and writes against those tables block for the duration. Every merchant on the instance sees a hard outage, not degradation.
Reproduction: Apply PR 3's stated DDL to a table at the documented envelope on a production-like restored database and observe lock waits and query queueing.
Expected behavior: Constraints are added NOT VALID and validated in a separate low-lock step; indexes are created CONCURRENTLY; lock_timeout and statement_timeout are set with documented retry; NOT NULL is introduced via a validated CHECK constraint rather than a blocking table rewrite; the migration runbook states expected lock duration per table at the envelope.
Required correction: Add a "lock-conscious constraint rollout" subsection to the migration requirements and add it to PR 3's scope.
Missing test: A migration test at the documented envelope asserting maximum lock-hold duration and that concurrent reads/writes are not blocked beyond a stated threshold.
Conflict with Cursor's claim: None. Cursor did not claim this was covered.
P1-02 — No decimal-safe money requirement for Phase 1 monetary facts
Severity: P1
File: PHASE_BRIEF.md — "Shopify-authoritative fact models"; PR 6; RISK_REGISTER.md R-014
Evidence: PR 6 specifies "Net quantity and amount handling" with no numeric-type requirement. The fact models list "Order-line facts" and "Refund, cancellation, and order-adjustment facts" with no monetary precision rule. R-014 (P2, "Money via JS Number in handlers") is still assigned to "Decimal-safe Phase 3." The required-tests section has no money-precision test.
Merchant impact: Refund, cancellation, and order-line amounts persisted through IEEE-754 arithmetic accumulate rounding error. Because these facts are the input to every later cost, receipt, and landed-cost ledger, the error compounds into merchant-visible financial discrepancies, and correcting it after Phase 1 requires re-ingesting the full order history.
Reproduction: Sum partial refunds against an order total using float arithmetic across a representative order set and compare to Shopify's reported totals.
Expected behavior: All monetary values in Phase 1 fact models are stored and computed as Decimal (or integer minor units) with currency recorded alongside; no float arithmetic touches money on any Phase 1 path.
Required correction: Add a decimal-safe money rule to the fact-model scope and PR 6; raise R-014 to P1 for the Phase 1 fact surface while leaving the legacy handler cleanup at its current severity.
Missing test: Money-precision assertions across order totals, partial refunds, duplicate refunds, and order edits, verifying exact equality with Shopify-reported amounts.
Conflict with Cursor's claim: None.
P1-03 — Tenant immutability is not required
Severity: P1
File: PHASE_BRIEF.md — "Approved tenant-isolation architecture" / "Database enforcement"; "Required tests" → "Database isolation"; DECISIONS.md D-014
Evidence: The architecture requires forced RLS, default-deny, and transaction-local context. Neither it, D-014, nor the isolation test list states that shopId on an existing row is immutable. The required-test list includes cross-shop update denial but not "a row's tenant cannot be changed."
Merchant impact: An RLS policy written with USING but without a correctly restrictive WITH CHECK permits a tenant to UPDATE a row it legitimately owns and reassign shopId to another shop — silently transferring a record out of its own tenancy, or (with a permissive policy) into another's. This defeats the isolation guarantee from inside a legitimately authenticated session, which is exactly the failure mode RLS is being adopted to prevent.
Reproduction: As Shop A with valid tenant context, UPDATE <merchant_table> SET "shopId" = '<shop_b_id>' WHERE id = '<own_row>'.
Expected behavior: RLS policies specify WITH CHECK such that no UPDATE may change shopId, and no INSERT may set shopId to any value other than the current transaction's tenant context.
Required correction: Add tenant immutability to the "Database enforcement" architecture bullets and to D-014.
Missing test: "A row's tenant cannot be changed" — UPDATE of shopId denied for both own-row reassignment and cross-shop assignment.
Conflict with Cursor's claim: None.
23. P2 findings
P2-04 — CI association and PR metadata not independently verifiable in this environment
File: PR #9 metadata; CI run 30557753268
Evidence: The GitHub REST API returned 403 API rate limit exceeded for this environment's IP on every call. Git protocol access succeeded. I therefore verified base SHA, head SHA, branch tip, diff, and file contents from Git objects, and could verify none of: PR number, PR title, draft state, uniqueness of matching PRs, CI run ID, CI job ID, CI conclusion, or the run's actual head_sha.
Merchant impact: None directly; this is a governance-evidence gap.
Expected behavior: Per this task's own instruction, CI association must be proven from the workflow run's actual head_sha, not from the PR description or an implementer's report.
Required correction: Before merge, an authenticated party must confirm and record: (a) exactly one open PR from docs/phase-1-planning; (b) PR number, title, and draft state; (c) that run 30557753268 has head_sha == eae8cfdf215e78226f35ba9a2046bddd93590c2c; (d) conclusion success with no required check skipped. This should be attributed to whoever verifies it, not to this review — consistent with how R-015 handles the branch-protection precedent.
Conflict with Cursor's claim: Cursor's figures are plausible and self-consistent but remain unverified by this review.
P2-05 — Worker, export, privacy, and reconciliation isolation tests not enumerated
File: PHASE_BRIEF.md — "Required tests" → "Database isolation"
Evidence: The access contract covers "web requests, workers, jobs, exports, privacy actions, and reconciliation," but the isolation test list covers only cross-shop CRUD denial, composite FK denial, missing-context denial, raw SQL denial, privilege verification, concurrent-shop and pool leakage, and bootstrap boundary. Non-request execution paths get no dedicated isolation tests.
Merchant impact: Background paths are where tenant context is most often forgotten. A reconciliation job or export that runs without context, or with a context inherited from a pooled connection, is the most likely real-world cross-tenant leak — and would pass every listed test.
Expected behavior: Each non-request execution path proves tenant scoping independently.
Required correction: Add worker-job, export, privacy-job, and reconciliation-job isolation tests to the Database isolation test list.
Missing test: As stated.
P2-06 — Tenant-context derivation and client-supplied-shop prohibition not stated explicitly
File: PHASE_BRIEF.md — "Database enforcement"; PR 2
Evidence: The brief requires that context be "established before any merchant-domain query" but does not state where the value comes from. There is no explicit rule that context must derive from server-side authenticated Shopify identity or a validated queue envelope, and no explicit prohibition on client-supplied shop authority.
Merchant impact: An implementer could satisfy every stated requirement while sourcing the tenant value from a request parameter, header, or unvalidated job payload — producing a system that is fully RLS-enforced and fully bypassable.
Expected behavior: Tenant context is derived only from the server-side authenticated Shopify session or a cryptographically validated queue envelope. No client-supplied value may ever establish tenant authority.
Required correction: Add both rules to "Database enforcement" and to D-017; add a job-envelope validation requirement to PR 2 and PR 4.
Missing test: Client-supplied shop parameter is ignored/rejected; unvalidated job envelope is denied.
P2-07 — Duplicate-after-queue-retention-expiry not covered
File: PHASE_BRIEF.md — "Required tests" → "Synchronization"
Evidence: "Duplicate and delayed webhooks" is listed; the retention-expiry variant is not. The architecture correctly requires "persistent idempotency," so this is a test-coverage gap rather than a design gap.
Merchant impact: In-queue deduplication silently stops protecting once the queue record ages out. A duplicate arriving after expiry is the case that proves durable idempotency actually works — and it is untested.
Required correction: Add the test case explicitly.
P2-08 — No stated path when quarantine is non-empty at the enforcement gate
File: PHASE_BRIEF.md — "Migration and backfill requirements"; PR 1/PR 3 boundary
Evidence: "Quarantine inconsistent rows; never guess ownership" and "Enforce non-null ownership only after unresolved count is zero" are both correct, but no procedure exists for resolving a non-zero quarantine.
Merchant impact: PR 3 blocks indefinitely with no defined escalation, creating pressure to guess ownership under schedule stress — precisely the outcome the "never guess" rule exists to prevent.
Required correction: Define the resolution path: quarantine report contents, product-owner escalation, manual-repair procedure, and an explicit statement that guessing remains prohibited regardless of schedule impact.
24. P3 findings
P3-09 — Branch-protection record removed from the live dashboard

PROJECT_STATUS.md no longer carries or cross-references the API-verified branch-protection block. No evidence was lost — RISK_REGISTER.md R-015 retains the complete record including ruleset ID 20012314, bypass_actors: [], the required check name, and the correct attribution of who verified it. Suggest a one-line pointer from PROJECT_STATUS.md to R-015 so the live dashboard still surfaces the control.

P3-10 — Phase 1 exit criterion references a verdict string not defined in this task's vocabulary

The exit criteria require "Claude returns READY FOR PHASE 2 PLANNING." That is a sensible Phase 1 exit verdict, but the string is not defined in any current agent prompt. Suggest defining it in docs/agents/ before Phase 1 exit review, so the closure verdict is not invented ad hoc.

P3-11 — PR 2 scope is the least independently reviewable unit

Noted in §20. Not a defect — splitting it would be worse. Suggest the brief require PR 2's implementation report to include a mechanical, complete inventory of converted call sites plus a check proving no unconverted direct Prisma access to merchant-domain tables remains, so review can be verification rather than narrative.

25. Required corrections

Before the Phase 1 brief may be approved:

ID	Correction	Severity
C-1	Add lock-conscious constraint rollout (NOT VALID + VALIDATE, CONCURRENTLY, lock_timeout/statement_timeout, per-table lock-duration expectations) to migration requirements and PR 3 scope; add a lock-duration test at the documented envelope	P1-01
C-2	Add a decimal-safe money requirement to Phase 1 fact models and PR 6; raise R-014 to P1 for the Phase 1 fact surface; add money-precision tests	P1-02
C-3	Add tenant immutability (shopId cannot be changed by UPDATE; INSERT cannot set a foreign tenant) to the enforcement architecture, D-014, and the isolation test list	P1-03
C-4	Have an authenticated party verify and record PR uniqueness, number, title, draft state, and that CI run 30557753268 has head_sha == eae8cfdf… with conclusion success and no skipped required check	P2-04
C-5	Add worker, export, privacy-job, and reconciliation-job isolation tests	P2-05
C-6	State that tenant context derives only from server-side authenticated Shopify identity or a validated queue envelope, and that no client-supplied value may establish tenant authority	P2-06
C-7	Add a duplicate-after-queue-retention-expiry test	P2-07
C-8	Define the resolution path for a non-empty quarantine at the enforcement gate	P2-08
C-9	Cross-reference R-015 branch protection from PROJECT_STATUS.md	P3-09
C-10	Define READY FOR PHASE 2 PLANNING in docs/agents/ before Phase 1 exit	P3-10
C-11	Require PR 2's report to include a complete converted-call-site inventory and a no-unconverted-access check	P3-11

C-1 through C-3 are additive edits to an otherwise sound brief. None require restructuring.

26. Confirmation — no Phase 1 implementation occurred

CONFIRMED.

Diff contains zero runtime, schema, migration, test, configuration, or dependency changes (§6).
prisma/schema.prisma at head eae8cfdf… contains no model Shop and zero shopId occurrences.
prisma/migrations/ contains exactly one migration, 20260728000000_init_stocky_plus, unchanged.
git ls-remote --heads origin shows no branch matching phase-1/*. The only Phase 1 branch is the documentation branch docs/phase-1-planning.
The brief status is DRAFT — IMPLEMENTATION NOT AUTHORIZED; the phase README states implementation has not started; PROJECT_STATUS.md states PLANNING ONLY — IMPLEMENTATION NOT STARTED.
27. Confirmation — production inventory writes remain unapproved

CONFIRMED. Recorded as UNAPPROVED in PROJECT_STATUS.md and the phase-1 README.md. The brief states "No inventory-write flag is approved for enablement by this brief," lists production inventory writes and enabling any inventory-write flag as out of scope, and requires in the exit criteria that "Production inventory writes remain unapproved." No Shopify inventory mutation is authorized in Phase 1.

28. Confirmation — every inventory-write flag remains default OFF

CONFIRMED — verified in code, not from documentation.

app/lib/feature-flags.server.ts at head eae8cfdf…: envFlag(name, defaultEnabled = false). All five capabilities — stocktakeInventoryWrites, adjustmentWrites, receiptWrites, costSync, transferWrites — use the default. The file is not in this PR's diff.

.github/workflows/ci.yml lines 49–53 set all five to "false" at job level. The workflow is not in this PR's diff.

29. Confirmation — reviewer actions

CONFIRMED. During this review I did not:

modify any file in the repository;
create any commit or branch;
push anything;
merge the pull request;
mark the pull request ready for review;
authorize inventory writes;
begin any Phase 1 implementation work;
write runtime code.

All actions were read-only: git clone, git fetch, git log, git diff, git show, git ls-remote, git status, and local file reads. The working tree was clean at the end of review.

Final verdict
NOT READY

Open P1 findings: P1-01 (lock-conscious constraint rollout), P1-02 (decimal-safe money), P1-03 (tenant immutability).

Assessment for ChatGPT: this is a strong brief that fails on three specific, additive omissions rather than on approach. The tenant-isolation architecture genuinely satisfies F-016 / R-022 — including the disqualifying condition, since forced RLS with default-deny means an omitted-filter read is denied by the database. The Phase 1 boundary is well drawn and the legacy technical plan is properly neutralized. Governance discipline is good: proposed decisions are marked proposed, open questions stay open, and prior verdicts and attributions are preserved accurately.

The three P1 corrections are edits, not redesigns. Once C-1 through C-3 are applied — and C-4 through C-8 folded in — I would expect this brief to reach READY FOR CHATGPT PHASE 1 BRIEF APPROVAL.

Re-review requirement: after Cursor adds this report verbatim and applies the required corrections, the new head SHA and its CI association must be verified again against the run's actual head_sha. Any substantive change to the brief requires another independent review.

I have not committed this report. Per the stop condition, I am stopping here.
