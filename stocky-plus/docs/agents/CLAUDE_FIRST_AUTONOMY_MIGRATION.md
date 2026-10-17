# Claude-first autonomy migration — proposed operating contract

**Status:** PROPOSED / NOT ACTIVE — owner approved a documentation-only PR, not merge, runtime implementation, production, or live configuration.
**Date:** 2026-10-17
**Repository:** Vedang1998/Stocky; application stocky-plus/
**Current authority:** See PROJECT_STATUS.md and active phase records. As last documented 2026-09-29: Phase 1 PR6 closed; PR7 planning/merge pending; PR7 runtime not authorized; production and Shopify inventory writes prohibited. Re-verify live PRs and CI before dispatch.

## Desired division of labor

- **Owner:** major product, spending, permissions, merge, and production approvals; not routine copy/paste.
- **ChatGPT:** product owner, architecture, priorities, approved issue contracts, evidence assessment, acceptance and merge recommendations; no assumption of always-on GitHub event handling.
- **Claude Code:** primary cloud-capable builder for specifically authorized tasks; tests, bounded correction, branches, commits, PRs, implementation evidence.
- **Independent reviewer:** separate authority and execution context from Claude builder; review actual code, exact-head checks, adversarial security and correctness. Cursor may be an inspection/review tool if real independent review is demonstrated; passive docs indexing is not a review.
- **GitHub:** permanent task, code, CI, review, decision and audit system.
- **Railway:** staging and separately authorized production; no implicit migration or safe deployment claim.

## Target event-driven loop (configuration not verified)

1. ChatGPT/owner approves a phase brief and focused task; issue contains exact base SHA, files/contract, tests, risk tier, prohibited changes and stop condition.
2. A tested, least-privilege GitHub/cloud-agent dispatch launches Claude for **that approved task only**. Trigger and job ID are recorded. If native integration cannot prove dispatch, stop; do not pretend an always-on agent exists.
3. Claude checks current main, creates one named branch, implements, runs tests and security checks, and opens a PR. Report actual commands, exit codes, exact SHA, failures and unresolved risks.
4. Existing CI runs on exact PR head. A distinct reviewer receives PR diff and approved acceptance contract through verified automation; never self-approve the same Claude implementation.
5. Bounded correction loop: maximum 2 automated correction cycles per finding set by default; stop on repeated failures, scope changes, dependency conflicts, missing review, spend threshold or Tier-A ambiguity. Re-review every changed exact head.
6. ChatGPT records disposition in GitHub; owner authorizes merge. Branch protection and required checks remain enforced.
7. Staging may deploy only through verified configured gates; production, Shopify writes, schema migrations and flags require separate authorization and reconciliation.

## Prerequisites to verify before enabling

- **Repository:** live main SHA, PR45/PR49/PR53/PR7 state, current phase authority, CI Gate and branch protection; reconcile overlapping instruction proposals rather than overwriting history.
- **Claude:** correct current official CLI/cloud/Projects/Routines features, subscription versus API billing, GitHub app permissions, cloud environment, secrets boundaries, actual event-trigger delivery, retries, dropped events and spend caps. Official starting points: https://code.claude.com/docs/en/overview ; https://code.claude.com/docs/en/routines ; https://code.claude.com/docs/en/cloud-environments . Do not install unverified Shopify plugins or assume a particular auto-mode flag exists.
- **ChatGPT:** actual connected GitHub read/write permissions and whether issue/PR events can be monitored unattended; separate periodic coordination from instant event delivery.
- **Cursor:** whether independent code review is truly executed and evidenced; merely opening editor or indexing docs is insufficient.
- **GitHub:** protected main, CI Gate required, no force-push, actor identities, event authorization, deduplication, least-privilege tokens, cost caps, audit logs and failed-trigger recovery.
- **Railway:** current build system, service/environment separation, explicit migration commands, backups, staging, deploy approvals, rollback/recovery, Shopify callback URLs and secrets. Never assume a Prisma file causes automatic migrations.
- **Shopify:** official current Admin GraphQL API, webhooks, scopes, app review and POS requirements, tenant-safe credentials and test-shop boundaries.

## Governance and migration sequence

A. Review and merge this documentation-only proposal **only after owner approval**. No runtime, workflows, credentials or settings changes are in scope for this PR.

B. Verify account and GitHub prerequisites in read-only mode; write an evidence-backed setup checklist with current official menu navigation. No undocumented UI guessing.

C. Owner separately approves external setup. Configure Claude builder and independent reviewer with minimum permissions; do one safe docs/test-only pilot. Verify task dispatch → PR → exact-head CI → review → correction → decision with **zero routine copy/paste**.

D. Once pilot succeeds, owner separately authorizes the PR7 gate resolution and first focused runtime task. Do not change production authorization or inventory-write flags.

E. Compare actual elapsed time, interventions, quality findings, failed events and provider cost for at least two PRs before upgrading Claude plan or removing Cursor entirely.

## Risk and approval policy

**Never unattended:** product-rule changes, new security model, secrets/permission escalation, destructive or production migrations, live Shopify mutations, inventory-write flags, billing/AI spending policy, merge to main, and production releases.

**Allowed after pilot and explicit setup approval:** bounded implementation of an already authorized low-risk task, tests, branch pushes, PR creation, review requests, and limited corrections.

**Evidence required:** agent identity, task ID, branch, exact SHA, executed test output, CI link, independent reviewer identity/findings, cost and user interventions.

**Non-goals:** changing product requirements, changing historical phase reports, merging PR7, enabling production, automatic migrations, installing unverified plugins, or declaring Claude/ChatGPT event automation already functional.
