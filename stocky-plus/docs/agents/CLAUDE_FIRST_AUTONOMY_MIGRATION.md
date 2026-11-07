# Claude-first autonomy migration — proposed operating contract

**Status:** OWNER-APPROVED DIRECTION / DOCUMENTATION REVIEW PENDING / ACTIVATION BLOCKED.
**Original proposal:** 2026-10-17. **Read-only prerequisite reconciliation:** 2026-11-07.
**Repository:** `Vedang1998/Stocky`; application `stocky-plus/`.
**Change vehicle:** draft PR [#69](https://github.com/Vedang1998/Stocky/pull/69), branch `governance/claude-first-autonomy-2026-10`.

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
| Main branch-protection read | `GET /repos/Vedang1998/Stocky/branches/main/protection` returned 403, `Resource not accessible by integration`. Enforcement is UNVERIFIED, not absent and not passed. No permissions were expanded. |

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

Issue52 is the existing coordination journal. Its recorded `ProPo Independent Reviewer` native routine, `trig_01Dc9YmAKTSwRx7pcGYYQbhi`, remains review-only. Historical scheduled/manual reviews do not prove current provider login, quota or trigger health. Reuse the documented queue protocol for a new eligible documentation review; do not recreate the routine, add a second coordinator, revive retired PR62/Actions runners, restore old credentials or repurpose the reviewer into a builder.

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

Repository content/PR/issue reads and the documentation write route are available in this foreground interaction. That does not prove unattended scheduling or administration access. Main protection remains blocked for inspection by the 403 above. An authorized administrator must supply nonsecret evidence of effective main rules, required `CI Gate`, bypass actors, and force-push/deletion controls; a second credential or weakened permission policy is not the remedy here.

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
| `ACCELERATED_SAFE_DELIVERY.md` and agent prompts | Reconcile current Cursor-specific role clauses against the approved Claude-first contract; preserve safety/dependency gates. Do not silently claim this has happened. |
| `product/06_ROADMAP_AND_RELEASE_GATES.md` | Its agent-role section still names Cursor/Claude. A later explicit role-only amendment must resolve precedence; product scope, formulas, phase gates and releases stay unchanged. |
| Root `CLAUDE.md`, `.cursor/rules/**` | Separate reviewed adapter/configuration change. These paths require full CI under current `CI_POLICY.md`; do not sneak them into a lightweight docs-only change. |
| Phase1 / issue67 / PR68 work ownership | Preserve historical author attribution and stopped active-lane authority. Transfer only by a separate exact-task handoff. |
| ChatGPT `Stocky App Building`, Claude project instructions, Cursor account rules | Align to approved canonical repository instructions through supported owner/account access. No claim these external settings were edited here. |
| PR53 / other overlapping proposals | Preserve as unmerged evidence; no automatic adoption, closure or delegation. Reconcile only overlapping instructions, not unrelated pricing/product proposals. |

Activation requires: independently reviewed governance; owner-authorized merge; consistent instruction adapters; verified non-production builder environment and budget; effective repository protections; independently identified review route; and a successful bounded documentation pilot. Record the evidence and explicit activation decision in GitHub. A merged proposal alone does not meet these conditions.

## 7. Immediate permitted next step and stop

Correct and review PR69 as documentation only. After its corrected exact-head docs CI is verified, admit ONE fresh actual-Claude review of this ChatGPT-authored proposal through the existing review queue, with no source edits and no PR68 review/restart. Record the exact work order and ACK/result separately. No approval of this author's self-check substitutes for that review.

Safe automation setup has been approved in direction; prerequisites are being verified rather than repeatedly asking the owner to approve the same direction. Any concrete permission/spending increase, writer transfer, runtime implementation, merge or production action still requires its own explicit authority. Do not change accounts, routines, secrets, workflows, application code, migrations, Shopify configuration or Railway deployment settings in this documentation pass.
