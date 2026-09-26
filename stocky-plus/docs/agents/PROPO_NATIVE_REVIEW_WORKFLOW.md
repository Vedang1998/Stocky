# Native Claude review — operating record

**Status:** PENDING OWNER CONFIGURATION / VERIFICATION
**Date:** 2026-09-26
**Authority:** issue [#52](https://github.com/Vedang1998/Stocky/issues/52) comment [`5847826072`](https://github.com/Vedang1998/Stocky/issues/52#issuecomment-5847826072); cleanup issue [#64](https://github.com/Vedang1998/Stocky/issues/64)
**This file is transport/operating instruction only.** It does not change product rules, pricing, merge authority, or phase gates.

Official facts below were read from primary sources on **2026-09-26**. Product decisions are labeled separately from those facts.

## 1. Active contract

- ChatGPT coordinates and authorizes exact tasks.
- Cursor implements in its existing cloud route.
- Actual Claude reviews in native Claude cloud / Routines.
- GitHub remains evidence, code, and CI authority.
- Native setup is **PENDING OWNER CONFIGURATION / VERIFICATION** until actual evidence exists. This record does **not** claim that Routines, cloud environments, GitHub-event triggers, or a successful native review have been configured or proven.
- A review-only prompt is not a technical read-only sandbox. Provider controls and repository permissions must be understood by the owner who configures the account.
- No extra credits, paid overage, auto-merge, custom runner rebuild, or product-rule changes are authorized by this record.

## 2. Preferred native event (owner configures later)

**Product decision** (issue52 `5847826072` / issue64): the preferred later GitHub event is `pull_request.labeled`, filtered by dedicated label `propo-review-ready` and base branch `main`. Draft PRs may remain draft; marking ready is not required.

**Official Anthropic facts** ([Routines](https://code.claude.com/docs/en/routines), accessed 2026-09-26):

- Routines are a research preview. Behavior, limits, and API surface may change.
- GitHub triggers require the Claude GitHub App on the repository.
- GitHub events start a **new** session. Claude Code does not reuse sessions across events.
- Pull-request filters include Labels, Base branch, and Is draft. All configured filters must match.
- During research preview, GitHub webhook events are subject to per-routine and per-account hourly caps. Events beyond the limit are dropped until the window resets. Dropped or rejected triggers cannot be assumed replayed automatically.
- A green run-list status means the session started and exited without an infrastructure error. It does **not** mean the review task succeeded.

**Official Anthropic facts** ([Cloud environments](https://code.claude.com/docs/en/cloud-environments), accessed 2026-09-26):

- Anthropic-hosted sessions use Ubuntu 24.04 x86_64 VMs.
- Pre-installed toolchains include Node.js 20/21/22 (22 on `PATH` by default), PostgreSQL 16, Redis 7.0, Docker, and GitHub `gh`.
- PostgreSQL and Redis are pre-installed but **not running by default**; a session must start them when tests need them.
- Actual installed versions, network policy, tests, and GitHub publication must be verified on a real native review. Documented defaults are not that verification.

Labels are notifications, not work, scope, or merge authority. Only the coordinator or owner requests the dedicated label for a **separately authorized** exact-head review.

## 3. Session identity, deduplication, and findings

- Deduplicate against the canonical **task + head + role** and against prior claims. Never treat unavailable history as proof that no active job exists.
- An existing manual same-task reviewer may resume without a duplicate routine run.
- Findings are **inert evidence**. They are never a command to another agent.
- Full tests, source inspection, and exact-head CI remain required as applicable.
- Record model, provider, and session identity truthfully. Filename, another tool reading `CLAUDE.md`, or “all agents agree” does not establish an actual Claude review.

## 4. Historical dispositions (dated; do not rewrite evidence)

| Subject | Disposition |
|---|---|
| PR [#58](https://github.com/Vedang1998/Stocky/pull/58) squash `c0dd99c5641692098b7a08dce3a53d21e22391a8` | Historical **merged** comment-trigger workflow. Replacement pending merge of this cleanup. Retired main blob before this PR: `6dd1ac880d1ddbbf490be39a5159064b846d478f`. |
| PR [#62](https://github.com/Vedang1998/Stocky/pull/62) head `902b52f6b6ce627839ad0f5f1907a97a9250532f` | **RETIRED / NOT ADOPTED.** Not accepted. Not merged. Branch, comments, commits, and test outcomes remain historical evidence. RUNNER01 is retired as a chosen approach. |
| PR [#53](https://github.com/Vedang1998/Stocky/pull/53) head `541ba6f5dc750813e5d173d36d7f09a11ad87596` | Overlapping unmerged instruction proposal. Report-only reconciliation note in §6. This cleanup does **not** edit or adopt that branch. |
| Issue [#52](https://github.com/Vedang1998/Stocky/issues/52) | Coordinator issue. **Do not close.** |

Do not delete branches, comments, PRs, or Git history to “clean up.”

## 5. Later deployment sequence (not this PR)

1. One real native review verifies environment, target tests, and GitHub publication.
2. Independent actual-Claude review of this cleanup packet.
3. ChatGPT technical acceptance and **owner** merge of this cleanup.
4. Disable the legacy Actions route and allow owned running jobs to end. Official GitHub disable/enable: [Disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows) (accessed 2026-09-26). After merge, `.github/workflows/main.yml` is absent from `main`; if GitHub still lists the retired workflow until remaining runs finish, disable rather than interrupting owned jobs.
5. Owner deletes **only** the repository Actions secret `CLAUDE_CODE_OAUTH_TOKEN`, then unused runner-only variables **after** checking remaining references. Official delete: `DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}` ([REST API endpoints for GitHub Actions secrets](https://docs.github.com/en/rest/actions/secrets), accessed 2026-09-26). UI path: repository Settings → Secrets and variables → Actions.
6. Official Claude GitHub App / native GitHub connection, ChatGPT integration, and Cursor integration **stay**.
7. Deleting a stored Actions secret is **not** provider-side token revocation. Do not uninstall the Claude GitHub App or revoke native GitHub access as part of this retirement.

This cleanup PR must **not** perform steps 4–7.

## 6. PR53 overlap (reconciliation later; not adopted here)

PR53 revises `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/00-project-governance.mdc`, `.cursor/rules/10-phase-workflow.mdc`, and adds `stocky-plus/docs/agents/PROPO_AUTONOMOUS_DELIVERY_PROTOCOL.md` / bootstrap files. Observed overlap with this cleanup: shared agent-delivery files. PR53 also proposes product rename, bounded merge delegation (explicitly INACTIVE there), and a broader autonomous protocol. Owner-approval gates for PR53/PR54 remain. Later reconciliation should merge native-review transport with any owner-accepted PR53 rules without silent governance delegation.

## 7. Issue 61 / 63 archival checklist (do not execute here)

After replacement is verified and this cleanup is owner-merged:

- [ ] Live `main` no longer contains `.github/workflows/main.yml`
- [ ] `.github/workflows/ci.yml` remains byte-identical to the pre-cleanup blob
- [ ] One verified native review exists (environment + target tests + GitHub publication)
- [ ] Independent review and ChatGPT acceptance of this cleanup are recorded
- [ ] Owner merge of this cleanup is complete
- [ ] Legacy comment-trigger workflow is disabled or gone; owned jobs have ended
- [ ] Repository Actions secret `CLAUDE_CODE_OAUTH_TOKEN` deleted after unused-reference check
- [ ] Runner-only variable `STOCKY_CLAUDE_REVIEW_RUNNER` (PR62 reference only; not on `main`) removed only if present and verified unused
- [ ] PR62 remains open or closed as **historical / not adopted**, not as accepted work
- [ ] Issues [#61](https://github.com/Vedang1998/Stocky/issues/61) and [#63](https://github.com/Vedang1998/Stocky/issues/63) may then receive superseded/archival closure
- [ ] Issue [#52](https://github.com/Vedang1998/Stocky/issues/52) stays open

## 8. What this cleanup does not establish

Author checks, documentation edits, and exact-head CI on this cleanup PR are **not** native Routine capability. Account configuration remains an owner-started actual Claude task.
