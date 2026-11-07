# Claude-first autonomy migration — proposed operating contract

**Status:** CLAUDE-FIRST MIGRATION — SELECTED, MERGED AS INACTIVE DOCUMENTATION, PENDING ACTIVATION. Owner-approved direction; activation blocked until the §6 activation record is published.
**Original proposal:** 2026-10-17. **Read-only prerequisite reconciliation:** 2026-11-07. **Review correction R1:** 2026-11-07. **Merged (inactive):** 2026-11-07. **Instruction alignment prepared:** 2026-11-07 (§8).
**Repository:** `Vedang1998/Stocky`; application `stocky-plus/`.
**Change vehicle:** PR [#69](https://github.com/Vedang1998/Stocky/pull/69) (CLOSED / MERGED as squash `c25aa437b2eca170edf1acd479f905079de146bd`), branch `governance/claude-first-autonomy-2026-10`. Instruction alignment: branch `governance/claude-first-instruction-alignment-20261107` (§8).

The owner authorized Claude-first governance migration and safe automation setup, beginning with a documentation-only PR and configuration-prerequisite verification. The owner explicitly withheld merge, runtime and production changes without further authorization. Continuing this documentation/review work is not a new runtime assignment, spending approval or permission escalation. This document does not activate itself.

## 1. Verified current state, not the stale status header

The September 29 header in `PROJECT_STATUS.md`, the dated Phase 1 brief and pre-merge PR bodies are snapshots, not proof of current work eligibility. Preserve their historical evidence; use the later explicit issue/decision records and live refs for this migration.

| Evidence inspected on 2026-11-07 | Finding |
|---|---|
| Live PR45 metadata | CLOSED / MERGED on 2026-09-29; squash `338717b8299016b37c02e5bdd452cc64f6161bdb`. Do not reopen the already-completed PR7 planning gate. |
| [Issue67](https://github.com/Vedang1998/Stocky/issues/67) | Scoped PR7 repository implementation had already been authorized. Its original single writer was Cursor. This is historical execution authority, not permission to resume a later stopped checkpoint. |
| Live PR68 metadata | OPEN / DRAFT / UNMERGED at `7e1c1ae93d2f452477ad18225747a56c967622d3`; branch `phase-1/pr7-audit-roles-privacy-fff3`; base `338717b8299016b37c02e5bdd452cc64f6161bdb`. |
| [Issue52 decision proposal 6051520332](https://github.com/Vedang1998/Stocky/issues/52#issuecomment-6051520332) | Checkpoint B remains unaccepted; ordinary correction allowance exhausted; `WAITING_OWNER_CORRECTION_DECISION`. The exceptional corrective package and pre-implementation design gate are proposals, not an admitted B3. Froggie remains the recorded coordinator for that lane. |
| PR69 before this correction | OPEN / DRAFT / UNMERGED; head `4e914c1d9b09a033727a46d34291ea78116a8e00`; five documentation paths; no discussion comments at inspection. |
| [PR69 CI run 39066899106](https://github.com/Vedang1998/Stocky/actions/runs/39066899106) | At that OLD exact head: Classify `117496348684` SUCCESS; CI Gate `117496374755` SUCCESS; Heavy `117496375145` SKIPPED. Correct for docs-only work. This does not certify a subsequent correction commit. |
| Live PR53 metadata | Still OPEN / DRAFT / UNMERGED at `541ba6f5dc750813e5d173d36d7f09a11ad87596`. Overlapping autonomy proposal, not adopted by PR69. Its merge delegation remains inactive. |
| Classic branch-protection reads (attributed, historical) | The original author's `GET /repos/Vedang1998/Stocky/branches/main/protection` returned 403, `Resource not accessible by integration`. The 2026-11-07 reviewer's read of the same endpoint returned 404 `Branch not protected`, as did the R1 correction author's re-read. Classic protection is not the mechanism protecting `main`; neither observation disproves the ruleset below. No permissions were expanded. |
| `GET /repos/Vedang1998/Stocky/rulesets?includes_parents=true&per_page=100` | One active ruleset in the accessible response: `20012314` "Protect main", source type Repository. The repository is user-owned. |
| `GET /repos/Vedang1998/Stocky/rulesets/20012314` | Target branch, include `~DEFAULT_BRANCH`, enforcement `active`, updated 2026-08-15. Rules: `deletion`; `non_fast_forward`; `pull_request` with `allowed_merge_methods: [squash]`, `required_review_thread_resolution: true`, `required_approving_review_count: 0`, `dismiss_stale_reviews_on_push: false`, `require_code_owner_review: false`, `require_last_push_approval: false`, `required_reviewers: []`, `require_extra_approval_for_unattributed_changes: true`; strict `required_status_checks` on `CI Gate` and `Lint, typecheck, test, build, Prisma, GraphQL`. `bypass_actors: []`; `current_user_can_bypass: never` for the reading identity. |
| `GET /repos/Vedang1998/Stocky/rules/branches/main`; `GET …/branches/main`; repository metadata | Aggregate branch rules list only ruleset `20012314` (deletion, non_fast_forward, pull_request, required_status_checks). `protected: true`. Default branch `main`; `allow_auto_merge: false`. ChatGPT's connector rejected the aggregate rules URL as an unsupported fetch; that is a connector limitation, not GitHub reporting no rules. |
| Reading identity and limits | Ruleset reads above used the owner's connected GitHub account (`Vedang1998`) through Claude Code cloud and, independently, ChatGPT's public API reads. They show what that identity can read; they do not prove that no other, inaccessible rule layer exists. |

**Enforcement gap (stated plainly).** Ruleset `20012314` does not guarantee a general non-author independent-review approval or a Vedang-only merge approval: zero approvals are required. Those gates are currently **procedural**. The conditional `require_extra_approval_for_unattributed_changes` field is not a general independent-review requirement. A SKIPPED Heavy job on a legitimately docs-only change is expected under `CI_POLICY.md`, not evidence of a missing runtime test run; `CI Gate` remains intact and required. This documentation does not change approvals, rules or identities.

A future technical review gate needs a separately approved design. Today the PR author and Claude comments both appear as `Vedang1998`, and GitHub does not let a PR author approve their own PR, so a different AI session is not a different GitHub approval identity. That is an unresolved activation prerequisite; this document creates no runner or service and selects no credential.

No application tests, builds, migrations, Shopify requests or live deployment checks were executed for this documentation reconciliation. GitHub CI evidence above was inspected, not locally reproduced. R-176, Q-008, D-054 and other product/release controls are unchanged.

## 2. Intended responsibilities after activation

- **Claude Code: primary builder.** Implement only admitted tasks, inspect actual source, add tests, run applicable validation, push the owned branch, open/update its PR and publish evidence. This migration is not a proposal to retain Cursor as the default builder.
- **ChatGPT: product owner and acceptance authority.** Own requirements, priorities, research, architecture decisions, testable acceptance and disposition. GitHub is durable memory. A chat subscription or connected repository does not itself establish continuous event handling.
- **Independent reviewer: a specifically admitted non-author reviewer.** Verify actual diff, requirements, exact-head checks and material adversarial evidence. A fresh session alone is insufficient. Record provider/model when exposed, session/run, no prior authorship of the subject, isolated review checkout, tests actually executed and immutable verdict. The reviewer must not alter the builder's branch. Same-provider/model review shares potential blind spots and must not replace deterministic or adversarial checks.
- **Cursor: optional inspection workspace.** Not the default builder and not automatically the reviewer. Passive indexing is not validation. Any future backup implementation needs explicit ownership transfer, never a second writer.
- **GitHub: task/evidence system.** One issue contract, branch owner, exact-head PR, required CI and durable handoff.
- **Railway: hosting only under separate environment/release authority.** No deployment or database mutation follows from this proposal.
- **Owner: major product, security, budget, ownership-transfer, merge and production decisions.** Routine handoffs should move through GitHub, not copied chat messages.

Claude may independently review this ChatGPT-authored documentation proposal under the current review route. That is not Claude self-review and does not make the future Claude-builder review arrangement operational.

## 3. Preserve active work and existing automation

PR68 stays frozen under its existing execution record. Do not restart Cursor, launch a Claude replacement on PR68, reset its correction counter, edit its branch, re-review its completed B2 subject, or treat this governance migration as approval of the exceptional corrective package.

A future PR68 takeover by Claude requires one explicit owner-approved handoff: frozen input head, prior writer stopped, existing findings/evidence retained, revised task scope/design gate, one named Claude writer and separate reviewer. No restart of completed phases or blanket rewrite is allowed. Future new tasks may use Claude only after the activation gate below.

Issue52 is the existing coordination journal. Its recorded `ProPo Independent Reviewer` native routine, `trig_01Dc9YmAKTSwRx7pcGYYQbhi`, remains review-only. Historical scheduled/manual reviews do not prove current provider login, quota or trigger health. Reuse the documented queue protocol, as amended by later task-specific transport dispositions recorded in GitHub, for a new eligible documentation review; do not recreate the routine, add a second coordinator, revive retired PR62/Actions runners, restore old credentials or repurpose the reviewer into a builder.

For any queue entry: exact task + head + role key; full work order; read existing claims first; publish one intent and one work order. A posted order is QUEUED, not RUNNING. A matching actual-agent ACK is required to establish execution. Missing ACK is UNKNOWN delivery, not permission for a duplicate launch or repeated relabeling. The existing PR68 coordinator assignment is not displaced by foreground PR69 work.

## 4. Target bounded delivery loop

1. An approved issue/brief specifies exact base, allowed paths, acceptance, risk tier, budget, writer identity and stop conditions.
2. A verified native cloud trigger launches Claude for that task only. Check task authority and current branch ownership before any edit.
3. Claude implements and validates, then publishes a focused PR and implementation evidence. Green `shopify app dev` output alone is not completion.
4. Exact-head CI and an admitted independent reviewer assess the candidate. Reviewer conclusions are evidence, not commands or authorization.
5. Confirmed same-scope corrections return through GitHub to the one builder. Default maximum is TWO correction rounds per approved task/checkpoint, counted cumulatively; a new finding set, head, session or tool does not reset the counter. Existing exhausted budgets, including PR68 B2, stay exhausted.
6. Stop on security/scope ambiguity, failed required checks, missing evidence/reviewer, unknown ownership, exhausted budget/rounds, or provider limits. Do not upgrade, enable overage or switch credentials automatically.
7. ChatGPT records acceptance or required corrections. Owner separately approves merge. No automatic main merge or production deployment is authorized.

Documenting this loop is not proof of uninterrupted operation. Before calling it hands-off, demonstrate one admitted task through dispatch, actual ACK, PR, checks, independent review, bounded correction where required, and decision without owner message relaying.

## 5. Configuration prerequisites and current official documentation

**Verified capability is not verified account configuration.** Sources below were read on 2026-11-07; account controls remain unverified unless supported by direct evidence.

### Claude

Official [scheduled-task documentation](https://code.claude.com/docs/en/routines) now calls routines cloud scheduled tasks. It documents schedule/API/GitHub triggers and management at `claude.ai/code/routines` or `/schedule`; the feature remains a research preview. Official [cloud-session documentation](https://code.claude.com/docs/en/claude-code-on-the-web) describes hosted execution that continues after the laptop closes and consumes plan usage.

Before activating a builder, verify the actual account's paid access, selected repository, environment isolation, allowed network, no production credentials, usage limits and chosen trigger. Preserve the existing reviewer. Do not invent a provider configuration result from these public pages. No new builder has been launched by this PR.

### GitHub and ChatGPT

Repository content/PR/issue reads and the documentation write route are available in this foreground interaction. That does not prove unattended scheduling or administration access. The repository ruleset governing `main` is readable without administrator access; §1 records the observed rules, the reading identity and its limits, and the procedural review/merge-approval gap. Rules that remain unreadable are not claimed absent. A second credential or weakened permission policy is not the remedy for any remaining gap.

No new scheduler is created. Use issue52's existing coordination record and do not claim that ChatGPT automatically senses PR events. Subscription, app-permission, GitHub App installation and billing settings were not changed.

### Cursor

Keep optional visual inspection. Native rules and account settings are not changed in this documentation-only stage. A passive editor is not an independent reviewer. No Cursor implementation dispatch is part of the migration.

### Railway and Shopify

Railway's [official build documentation](https://docs.railway.com/overview/advanced-concepts) describes Railpack, and its [pre-deploy documentation](https://docs.railway.com/deployments/pre-deploy-command) describes an explicit pre-deploy command. Do not assume Nixpacks or automatic Prisma migrations merely from a schema file. No Railway account configuration, services, variables or database contents were inspected or changed in this pass. Environment, callback, migration/recovery and release prerequisites remain a separate gate. No Shopify credentials/scopes, inventory-write flags, merchant data or production actions are authorized.

## 6. Instruction consistency and activation gate

This PR is the documentation proposal, not an installed instruction update. The following mapping must be reconciled before activating Claude as a builder:

| Surface | Required treatment |
|---|---|
| `AGENTS.md`, docs map, phases workflow | Proposed future role change in PR69; preserve all product/security/phase controls. |
| `ACCELERATED_SAFE_DELIVERY.md` | Reconcile current Cursor-specific role clauses against the approved Claude-first contract; preserve safety/dependency gates. Not updated by PR69. |
| `stocky-plus/docs/agents/README.md` | Still describes Cursor as implementer, Claude as independent reviewer, and the old native-review transport. Later role-only update required; not updated by PR69. |
| `stocky-plus/docs/agents/CHATGPT_PROJECT_INSTRUCTIONS.md` | Copy-ready ChatGPT instructions still assign implementation to Cursor and review to Claude. Later update required; not updated by PR69. |
| `stocky-plus/docs/agents/07_CURSOR_MASTER_PROMPT.md` | Defines Cursor as the implementation agent. Later treatment: retire to optional/fallback role or mark historical. Not updated by PR69. |
| `stocky-plus/docs/agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md` | Defines Claude as reviewer. Later treatment: separate Claude-builder and independent-reviewer prompts so a Claude builder is never treated as its own reviewer. Not updated by PR69. |
| `stocky-plus/docs/agents/CLAUDE_PROJECT_INSTRUCTIONS.md` | Copy-ready Claude Project instructions for the review role. Later update required; not updated by PR69. |
| `stocky-plus/docs/agents/PROPO_NATIVE_REVIEW_WORKFLOW.md` | Current native-review transport record. Revalidate because Claude becomes the builder; keep historical review records immutable. Not updated by PR69. |
| `.cursor/rules/15-native-review-transport.mdc` | Cursor-side copy of the old transport. Requires full CI under `CI_POLICY.md`; separate reviewed change. Not updated by PR69. |
| `product/06_ROADMAP_AND_RELEASE_GATES.md` | Its agent-role section still names Cursor/Claude and stays authoritative until a separately approved role-only amendment. That amendment must resolve precedence; product scope, formulas, phase gates and releases stay unchanged. |
| Root `CLAUDE.md`, other `.cursor/rules/**` | Retained as-is. Separate reviewed adapter/configuration change. These paths require full CI under current `CI_POLICY.md`; do not sneak them into a lightweight docs-only change. |
| Phase1 / issue67 / PR68 work ownership | Preserve historical author attribution and stopped active-lane authority. Transfer only by a separate exact-task handoff. |
| ChatGPT `Stocky App Building`, Claude project instructions, Cursor account rules | User-managed external text. Align to approved canonical repository instructions through supported owner/account access. User-pasted project instructions are not proof of repository-wide activation. No claim these external settings were edited here. |
| PR53 / other overlapping proposals | Preserve as unmerged evidence; no automatic adoption, closure or delegation. Reconcile only overlapping instructions, not unrelated pricing/product proposals. |

The "Required treatment" column above is the PR69-time requirement and is kept as written. The surface-by-surface result of the 2026-11-07 instruction alignment is in §8; it does not change this gate.

**Canonical activation gate.** This section is the single normative activation gate. Shorter statements in `AGENTS.md`, `docs/README.md`, `phases/README.md` and `PROJECT_STATUS.md` refer here and do not define a shorter checklist. The Claude-first operating model is not active until the explicit activation record required here is published in GitHub. Activation requires all of:

1. independently reviewed governance;
2. owner-authorized merge;
3. consistent instruction adapters (the surfaces in the table above);
4. a verified non-production builder environment and budget;
5. effective repository controls, with the review-enforcement gap in §1 resolved by a separately approved technical arrangement;
6. an independently identified reviewer route for a Claude builder;
7. a successful bounded documentation pilot; and
8. the explicit activation record in GitHub, citing the evidence for 1–7.

None of these prerequisites is recorded as complete by this document. Merge alone is never activation. A current procedural owner/manual gate may protect this inactive documentation proposal; it is not evidence of an enforced autonomous review pipeline. The documentation pilot (7) is separately admitted and runs under the current effective model; it does not itself depend on general runtime activation.

## 7. 2026-11-07 pre-merge review/correction checkpoint

This section is bounded to the 2026-11-07 pre-merge checkpoint for PR69: the independent documentation review ([6709792959](https://github.com/Vedang1998/Stocky/pull/69#issuecomment-6709792959)), the single documentation correction round R1 ([6709965325](https://github.com/Vedang1998/Stocky/pull/69#issuecomment-6709965325)), and at most one conditional exact-head re-review by the original non-author reviewer. No author self-check substitutes for that review, and no PR68 review or restart is part of it. Once that checkpoint's completion is recorded in GitHub, this section is historical: it is not an instruction to restart review. Later readers follow the current PR69 / issue52 dispositions and the §6 activation record requirement. This section does not assert that PR69 has merged.

Safe automation setup has been approved in direction; prerequisites are being verified rather than repeatedly asking the owner to approve the same direction. Any concrete permission/spending increase, writer transfer, runtime implementation, merge or production action still requires its own explicit authority. Do not change accounts, routines, secrets, workflows, application code, migrations, Shopify configuration or Railway deployment settings in this documentation pass.

## 8. 2026-11-07 instruction alignment — surface map and status

**Task-Key:** `propo:PR69:INSTRUCTION_ALIGNMENT:c25aa437b2eca170edf1acd479f905079de146bd:claude-author`. **Work order:** [issue52 6710355961](https://github.com/Vedang1998/Stocky/issues/52#issuecomment-6710355961). **Author claim:** [issue52 6710393407](https://github.com/Vedang1998/Stocky/issues/52#issuecomment-6710393407). **Branch:** `governance/claude-first-instruction-alignment-20261107` from S69. Instruction and role text only. This section records preparation, not activation, and publishes no activation record.

### 8.1 PR69 verified closeout

Read directly from GitHub on 2026-11-07 by the instruction-alignment author: PR69 is CLOSED / MERGED at 2026-11-07T16:56:41Z from reviewed head `ca0f56dac82ebb0094d11c767901bb9ad2c99083`. Squash **S69** `c25aa437b2eca170edf1acd479f905079de146bd` has the same tree as that head (`86d7031bf7617c1fe254cbd63a0ae7d5590f9a93`). Main push CI run `42393817540` on S69: Classify `128466820388` SUCCESS, CI Gate `128466857839` SUCCESS, Heavy `128466858714` SKIPPED (docs-only). Records: re-review APPROVE [6710109413](https://github.com/Vedang1998/Stocky/pull/69#issuecomment-6710109413), merge record [6710267657](https://github.com/Vedang1998/Stocky/pull/69#issuecomment-6710267657), post-merge closeout [6710334475](https://github.com/Vedang1998/Stocky/pull/69#issuecomment-6710334475). §7 above is historical.

### 8.2 Surface map

Every surface below points to the same §6 gate and keeps the current effective model visible until the activation record exists.

| Surface | Before (S69) | After this alignment | Verification |
|---|---|---|---|
| `AGENTS.md` | Current model plus "proposed" future model; reviewer text allowed Cursor as reviewer; N1 open | Future model marked owner-selected and merged inactive; reviewer is a specifically admitted non-author; Cursor optional/fallback; **N1 resolved**: one-off assignments need owner authorization or ChatGPT within delegated scope, and no agent self-grants owner-reserved powers | Gate link, role grep, `git diff --check` |
| Root `CLAUDE.md` | Claude as reviewer only; Cursor implements; "Routines" transport pending | Per-task role selection (REVIEW default, task-specific author, builder only after activation); no self-review; reviewer edits nothing; transport dated with unverified auto-launch | Full CI required |
| `.cursor/rules/00`, `10`, `15`, `50` | Cursor implements, Claude reviews, no gate reference | Current model kept; selected future model and §6 gate stated; workflow uses builder/reviewer terms; N1 rule in `00` | Full CI required; metadata unchanged |
| `.cursor/rules/20`, `30`, `40`, `60`, `90` | Role-neutral or safety rules | Unchanged | Not in diff |
| `agents/README.md` | Cursor implementer, Claude reviewer, old transport; `15` rule not listed | Current/future role table and gate; copy-ready text not proof of installation; `15` listed | Link check |
| `agents/CHATGPT_PROJECT_INSTRUCTIONS.md` | Cursor implements, Claude reviews | Current and future models, gate, delegated-scope rule | Copy-ready only |
| `agents/CLAUDE_PROJECT_INSTRUCTIONS.md` | Review role only | Role selection and discipline; review mission kept | Copy-ready only |
| `agents/07_CURSOR_MASTER_PROMPT.md` | Cursor as implementation agent | Marked historical Phase 0 prompt; future Cursor role optional/fallback; body unchanged | Header-only diff |
| `agents/08_CLAUDE_CODE_MASTER_REVIEW_PROMPT.md` | "Cursor writes the code" | Marked independent-reviewer prompt; never used by an author on its own candidate; builder rules in `AGENTS.md` / `CLAUDE.md` | Header plus one line |
| `agents/PROPO_NATIVE_REVIEW_WORKFLOW.md` | Dated 2026-09-26 transport record | New §0 operative status; §§1–8 kept as the dated record | Historical text unchanged |
| `ACCELERATED_SAFE_DELIVERY.md` | Cursor/Claude-specific role clauses | **Role terms** note maps them to builder/reviewer after activation; summary headings and two lines retitled; all controls unchanged | Role-only diff |
| `product/06_ROADMAP_AND_RELEASE_GATES.md` | Agent section named Cursor/Claude only | Agent section only: gate, current model kept, selected future model, canonical pointer and role precedence | Diff confined to that section |
| `docs/README.md`, `phases/README.md`, `PROJECT_STATUS.md` | "Proposed" wording; no PR69 closeout | "Selected, pending activation"; PR69 closeout and dated alignment status | Historical sections unchanged |
| External ChatGPT / Claude / Cursor account text | User-managed | **Not changed.** The repository files above are copy-ready text until installation is evidenced | No external setting touched |

Out of scope and unchanged: `product/00_READ_ME_FIRST.md` Phase 0 notes and the Phase 1 brief's "Implementation owner: Cursor / Independent reviewer: Claude Code" header are dated historical records outside the allowed paths. PR53 is not adopted. PR68 and issue67 are untouched.

### 8.3 Evidence from the PR69 cycle

The PR69 cycle (ChatGPT-authored proposal, independent Claude review [6709792959](https://github.com/Vedang1998/Stocky/pull/69#issuecomment-6709792959), separate Claude correction author, re-review by the original non-author reviewer, ChatGPT acceptance, owner merge) is evidence that a manually started, bounded documentation author/reviewer cycle can execute with distinct sessions and GitHub-published evidence. Limits: it was owner-started, involved manual chat relaying, used same-provider sessions, and every comment posted as `Vedang1998`. It is **not** proof of zero copy-paste, unattended orchestration, an automatic trigger, or an enforced technical review gate. Do not repeat it solely to relabel it a pilot; whether it satisfies §6 item 7 is for the activation record to decide.

### 8.4 Activation items still open

This alignment prepares §6 item 3 for review; it does not mark any §6 item complete. Still open and not waived:

- a verified non-production builder environment and budget;
- effective technical review enforcement (ruleset `20012314` requires 0 approvals) and the shared `Vedang1998` GitHub identity problem;
- an independently identified non-author review route for a Claude builder;
- any unproven unattended handoff or trigger capability;
- the explicit activation record (§6 item 8).

No credential, provider, ruleset, routine or schedule is selected or changed here.
