# Bounded executable Claude review runner

**Status:** IMPLEMENTATION DRAFT — not activated, not production, not a substitute for independent review
**Authority:** issue61 + issue52 comment `5806012938` + owner command `5806021611`
**Dispatch-Key:** `propo:issue61-v1:RUNNER01:c0dd99c5641692098b7a08dce3a53d21e22391a8:cursor-implementation`
**Risk tier:** A (credentials, publication, untrusted subject execution)
**Activation:** blocked until independent runner review, ChatGPT acceptance, owner merge, **and** repository variable `STOCKY_CLAUDE_REVIEW_RUNNER=admitted`
**This runner must not certify itself.**

This document freezes the file list, job/tool contract, command schema, and trust assumptions for RUNNER-01. Implementation must stay inside this envelope.

---

## 1. What this is

A tooling path that can eventually let actual Claude:

1. inspect an exact approved subject (PR + head + base SHAs fetched, not trusted from the comment body);
2. request at most two typed probes in an isolated synthetic Node/PostgreSQL/Redis environment;
3. return a structured finding packet that a **trusted publisher** posts.

It does **not**:

- authorize application runtime, Shopify, inventory writes, or PR7;
- merge, mark-ready, or activate itself;
- replace existing competent manual/cloud Claude reviews;
- treat green CI, a posted comment, or an artifact upload as a verdict.

Live authenticated end-to-end use remains a later owner-gated step after this draft is independently reviewed and merged.

---

## 2. Frozen tracked file list

Exclusive allowed paths for this unit:

| Path | Role |
|---|---|
| `.github/workflows/main.yml` | Owner-comment ingress; hardened; preserves `@claude ` communication |
| `.github/workflows/claude-review-execution.yml` | Optional secret-free `workflow_dispatch` probe replay (no auto `workflow_run` / `pull_request_target`) |
| `.github/scripts/claude-review/**` | Dispatcher, authority, evidence pack, MCP broker, sandbox, publisher, fixtures, tests |
| `stocky-plus/docs/agents/CLAUDE_EXECUTABLE_REVIEW_RUNNER.md` | This contract / runbook |
| `stocky-plus/docs/phases/phase-1/CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT.md` | Exact implementation evidence |

No other path may be modified for this task.

---

## 3. Reviewed upstream pins (re-verify before bumping)

Pins are full-length commit SHAs. Tags are locators only. Bump only in a later admitted tooling PR after reviewing the new commit.

| Component | Tag locator | Full commit SHA | Observed date (UTC) | Source |
|---|---|---|---|---|
| `anthropics/claude-code-action` | `v1` (annotated tag `bd23c076f8423364b3cd8f4240d315cef475a119`) | `8cf3482550831fb35a4fc3fbf7ca139cf8028b4c` | 2026-09-23 19:39 | GitHub API + clone at that SHA |
| Nested `oven-sh/setup-bun` (inside the action) | `v2.2.0` | `0c5077e51419868618aeaa5fe8019c62421857d6` | recorded from `action.yml` at the action SHA | action.yml lines 192–197 |
| Nested Claude Code / Agent SDK (action commit message) | — | action commit claims Claude Code `2.1.281` / Agent SDK `0.3.281` | 2026-09-23 | action commit message; not independently rebuilt here |
| `actions/checkout` | `v6` | `d23441a48e516b6c34aea4fa41551a30e30af803` | 2026-07-16 | GitHub API `refs/tags/v6` |
| `actions/setup-node` | `v4` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | 2025-04-02 | GitHub API `refs/tags/v4` |
| Profile Node | `22.19.0` | — | matches `ci.yml` / issue61 | `actions/setup-node` input |
| Profile npm | `11.5.2` | — | matches `package.json` `packageManager` and `ci.yml` | `npm install -g npm@11.5.2` |
| PostgreSQL | major 16 | — | `ci.yml` uses `postgres:16-alpine`; local authoring observed Ubuntu `16.15` | recorded at runtime |
| Redis | major 7 | — | `ci.yml` uses `redis:7-alpine`; local authoring observed `7.0.15` | recorded at runtime |

**Update policy:** do not float `@v1` / `@v6` / `@v4` in the workflow `uses:` lines. Record the new full SHA, the reviewed diff, and an owner-admitted follow-up PR.

Official documents consulted (access 2026-09-24; technical evidence only, not extra task authority):

- https://github.com/anthropics/claude-code-action/blob/main/docs/security.md (file at pinned SHA `8cf34825…`)
- https://code.claude.com/docs/en/github-actions
- https://docs.github.com/en/actions/reference/security/secure-use

---

## 4. Observed vendor-action behavior (labels vs enforcement)

Inspected at `anthropics/claude-code-action@8cf3482550831fb35a4fc3fbf7ca139cf8028b4c`:

| Claim / input | Actual behavior |
|---|---|
| `allowed_bots` default empty | Bots denied unless listed. `*` is unsafe on a public repo. **Do not set.** |
| `allowed_non_write_users` | Bypasses write checks. **Do not set.** |
| Write-access check | `repos.getCollaboratorPermissionLevel`; accepts `admin` or `write`. **Not** an immutable numeric actor bind. |
| Human-actor check | Users API `type === "User"`. Complementary to, not a replacement for, owner-id binding. |
| Tag mode (`prompt` omitted) | Always allows `Read/Glob/Grep/LS`, `mcp__github_comment__update_claude_comment`, and `Bash(git add/commit/rm)` plus `Bash(git-push.sh:*)` unless commit signing is on. `setupBranch` + `configureGitAuth` run. `acceptEdits` permission mode. |
| Agent mode (`prompt` set) | No tracking comment MCP unless those tools are listed. **Still calls `configureGitAuth`**, injecting a write-capable token into git config. GitHub MCP servers are installed only when `claude_args` lists `mcp__github*` / comment / CI tools. |
| `--allowedTools` in tag mode | **Additive** to the tag-mode base tool list (`buildAllowedToolsString`). It does **not** remove `Bash(git …)`. |
| `--disallowedTools` | Appended to default `WebSearch,WebFetch`. Deny is the control that can remove tag-mode git Bash **if** the CLI honors deny-over-allow. Do not treat this as kernel isolation. |
| `show_full_output` | Default false. Debug (`ACTIONS_STEP_DEBUG`) auto-enables full output. Keep false; do not enable debug. |
| PR config restore | Restores `.claude/`, `.mcp.json`, `.claude.json`, hooks, `CLAUDE.md` from the **base** ref; **everything else including `package.json`, lockfiles, Makefile, `.npmrc` stays at the PR head** if that tree is the workspace. Hooks that call `npm`/`make` can execute PR-supplied scripts. |
| `pull_request_target` / `workflow_run` | Executes with base secrets. **This runner must not use those triggers.** |
| Comment MCP | `update_claude_comment` updates **one** comment id from env. Still a model-controlled write of comment body. Executable-review publication must **not** give Claude this tool. |

**Design consequence:** executable review always uses **agent mode** with a dispatcher-written prompt file, an explicit allowlist of `mcp__stocky_review__*` tools only, and `--disallowedTools` covering Bash/Write/Edit/Web*/GitHub MCP. Simple `@claude` communication also uses agent mode so tag-mode git Bash is never attached. Tracking comments are written by the **trusted publisher**, not by Claude.

---

## 5. Jobs, permissions, secrets

### 5.1 Ingress workflow — `.github/workflows/main.yml`

Trigger: `issue_comment` / `created` only.

Workflow-level `permissions: {}`.

Job `claude` `if:` (all required):

- `github.repository == 'Vedang1998/Stocky'`
- `github.event.comment.user.login == 'Vedang1998'`
- `github.event.comment.user.id == 278831488` (immutable numeric bind; verified against `GET /users/Vedang1998`)
- `github.event.comment.user.type == 'User'`
- `startsWith(github.event.comment.body, '@claude ')`

`if:` uses GitHub expressions (not shell). The body is **never** interpolated into `run:` YAML. It is passed as `env.COMMENT_BODY` into Node.

Job permissions:

| Permission | Why |
|---|---|
| `contents: write` | Publisher may create **one** new review branch when the work order sets `publish_review_branch: true` |
| `issues: write` | Publisher tracking/result comments |
| `pull-requests: write` | Same for PR threads |
| `id-token: write` | Required by claude-code-action OIDC app-token exchange |
| `actions: read` | Evidence pack may read check-run summaries via dispatcher, not via Claude |

Concurrency: `claude-issue-${{ github.event.issue.number }}`, `cancel-in-progress: false`. This is **not** exactly-once; the dispatcher adds a dispatch-key lease.

Timeout: 60 minutes. Claude `--max-turns 40`.

Secrets: `CLAUDE_CODE_OAUTH_TOKEN` referenced **by name only**. Do not set `anthropic_api_key` (no paid API fallback).

Repository variable: `STOCKY_CLAUDE_REVIEW_RUNNER`. Executable-review mode runs only when it equals `admitted`. Simple `@claude` communication remains available without that variable (hardened). The runner cannot set the variable.

### 5.2 Secret-free execution workflow — `.github/workflows/claude-review-execution.yml`

Trigger: `workflow_dispatch` only. No `pull_request_target`, no `workflow_run`, no `issue_comment`.

Does **not** receive `CLAUDE_CODE_OAUTH_TOKEN`. Job permissions: `contents: read` only.

Purpose: operator replay of a **already-validated** probe request after admission. Not auto-chained from the comment workflow (avoids `workflow_run` privilege issues). Interactive probes during a Claude session use the in-job sandbox described below.

`if:`: repository match AND `vars.STOCKY_CLAUDE_REVIEW_RUNNER == 'admitted'`.

Services: `postgres:16-alpine` and `redis:7-alpine` with **synthetic** credentials distinct from `ci.yml` (`stocky_review` / `stocky_review_ci` / `stocky_review_ci_only`).

### 5.3 Three planes

```
┌─────────────────────────────────────────────────────────────┐
│ A. Trusted controller (comment job)                         │
│    GITHUB_TOKEN + CLAUDE_CODE_OAUTH_TOKEN                   │
│    Node dispatcher: parse, bind actor, fetch authority,     │
│    snapshot subject tarball, write evidence pack + prompt   │
│    Claude: agent mode, MCP broker only                      │
│    Publisher: comment + optional one-branch artifact        │
└───────────────┬─────────────────────────────────────────────┘
                │ typed probe JSON (no secrets)
                ▼
┌─────────────────────────────────────────────────────────────┐
│ B. Secret-free sandbox                                      │
│    No OAuth, no GITHUB_TOKEN, no docker.sock, no home git   │
│    Synthetic PG/Redis only                                  │
│    Prefers Docker --internal network when the daemon exists │
│    Else process jail (preload + env whitelist)              │
└─────────────────────────────────────────────────────────────┘
                │ executor metadata (exit, hashes, timeout)
                ▼
┌─────────────────────────────────────────────────────────────┐
│ C. Trusted publisher                                        │
│    Validates provenance, stale-head, path, parent, size     │
│    Posts result comment; optional sole-parent review branch │
│    Model conclusions ≠ executor metadata ≠ PASS             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Tool / MCP matrix

Claude **effective** tools for executable review (allowlist). Anything else is denied:

| Tool | Direction | Implementation |
|---|---|---|
| `mcp__stocky_review__get_evidence` | read local evidence pack | broker → files written by dispatcher |
| `mcp__stocky_review__read_subject` | read file under snapshot root | broker → `fs-guard` realpath jail |
| `mcp__stocky_review__run_probe` | typed probe | broker → sandbox |
| `mcp__stocky_review__checkpoint` | persist bounded checkpoint | broker → session store |

Explicitly denied (settings + `--disallowedTools` + not installed):

`Bash`, `BashOutput`, `KillShell`, `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `SlashCommand`, `mcp__github*`, `mcp__github_comment*`, `mcp__github_file_ops*`, `mcp__github_ci*`, `mcp__github_inline_comment*`.

Simple route allowlist: `Read`, `Glob`, `Grep`, `LS` on the **trusted checkout of the workflow ref** (default branch after merge). No Bash, no GitHub MCP, no subject hooks.

`allowedTools` / a read-only prompt **alone are not the security argument**. Isolation is:

1. agent mode so tag-mode git Bash is not auto-attached;
2. GitHub MCP servers not installed;
3. MCP broker implements only the four tools and never receives OAuth;
4. subject is a tarball/data snapshot, not the workspace used to run the action;
5. probes run in the sandbox with env/fs/network policy;
6. publisher ignores model-claimed PASS without executor metadata.

---

## 7. Command schema (ready to use after activation)

Comments must start with `@claude ` (space required). Node parses `COMMENT_BODY`. Never `eval`, never shell interpolation.

### 7.1 Simple communication (preserved)

```
@claude <natural language>
```

Hardened: owner+id+write-authority, agent mode, no git Bash, publisher posts the result. No subject execution.

### 7.2 Executable review

```
@claude STOCKY_REVIEW_TASK_V1
{
  "task_id": "rev-prNN-YYYYMMDD",
  "dispatch_key": "propo:<authority>:<task>:<headsha>:claude-review",
  "role": "independent_reviewer",
  "subject": {
    "repository": "Vedang1998/Stocky",
    "pr": 0,
    "head": "<40-hex>",
    "base": "<40-hex>"
  },
  "profile": "node22-pg16-redis7",
  "max_probes": 2,
  "max_sandbox_seconds": 1200,
  "expected_artifact": "review-report.md",
  "authority_comment_id": 0,
  "publish_review_branch": false,
  "continuation_of": null
}
```

IDs in the JSON are **locators**. Dispatcher fetches the comment, PR, commits, and permission API and rejects mismatches.

Rejected extra keys include anything that tries to set activation, merge, secrets, models, budgets, `allowed_bots`, or tool lists.

### 7.3 Stop

```
@claude STOCKY_REVIEW_STOP_V1
{"task_id":"rev-prNN-YYYYMMDD","dispatch_key":"<same key>"}
```

Same owner bind. Marks the lease STOPPED. In-flight probes are not greened.

### 7.4 Profile `node22-pg16-redis7`

| Budget | Ceiling |
|---|---|
| Workflow / Claude | 60 minutes / 40 turns |
| Sandbox wall per probe | `max_sandbox_seconds` ≤ 1200 |
| Probe count | `max_probes` ≤ 2 |
| Output bytes | 256 KiB combined stdout/stderr |
| Artifact bytes | 512 KiB |
| Continuation | new admitted work order with `continuation_of`; no silent loop |

These are ceilings, not targets.

---

## 8. Probe contract

JSON only. No shell strings from the model.

```json
{
  "kind": "sql" | "redis" | "node_script" | "zero_test_control",
  "timeout_seconds": 1-1200,
  "sql": { "text": "SELECT 1 AS ok" },
  "redis": { "op": "PING" | "SET" | "GET", "key": "stocky-review:*", "value": "..." },
  "node_script": { "source": "/* javascript */" },
  "expect": { "outcome": "pass" | "fail" | "timeout" | "blocked" }
}
```

Rules:

- `node_script` is **untrusted** even when model-authored. Size cap 32 KiB. No `require` of subject `node_modules`. Preload jail denies host paths, docker.sock, credential canaries, and arbitrary URLs.
- `sql` allowlists a single `SELECT`/`INSERT`/`UPDATE`/`DELETE` against the synthetic DB; rejects `COPY`, `\;`, meta-commands, `INTO OUTFILE`, `pg_read_file`, `lo_import`.
- `redis` allowlists PING/SET/GET with key prefix `stocky-review:`.
- `zero_test_control` is an explicit failing control: executor reports `tests_run=0` which the verdict layer treats as **failure**, never PASS.
- A failing negative control is `expected_failure` only when `expect.outcome` is `fail` and the executor actually failed. It cannot green other failing tests.
- Executor metadata (`exit_code`, `timed_out`, `stdout_sha256`, `tests_run`, `backend`) is distinct from model text.

---

## 9. Publication contract

Publisher (trusted Node, `GITHUB_TOKEN`) may:

1. create or update **one** tracking comment on the triggering issue/PR, identified by HTML marker `<!-- STOCKY_REVIEW_LOCK ... -->`;
2. if and only if `publish_review_branch: true` **and** activation is admitted: create **one new** branch `claude-review/{task_id}/{attempt}` whose sole parent is the **subject head SHA**, containing only `stocky-plus/docs/phases/phase-1/reviews/{task_id}/REVIEW_ARTIFACT.md`.

Publisher must refuse:

- writes to `main` or any existing subject branch;
- trees with a different parent;
- paths outside the allowlist;
- artifacts that try to change workflows, gates, or dispatch other agents;
- PASS when evidence is missing, tests_run=0, head moved, lease STOPPED, or executor status is timeout/unknown;
- using the model's JSON as proof of test results.

After posting, publisher **reads the comment back**. If the body/marker does not match, status is `UNKNOWN` (lost ACK).

---

## 10. Session / dedup

Stable key = `dispatch_key`. Attempt id = `run_id` + monotonic nonce.

States: `leased`, `running`, `checkpointed`, `completed`, `rejected`, `stopped`, `unknown`.

A new Actions job is **not** the prior Claude cloud conversation. Checkpoints are attributed evidence files, not session resume unless `continuation_of` names them in a new admitted order.

Concurrent contenders: first writer to store the lease in the tracking comment wins; others reject `duplicate_dispatch`. GitHub concurrency does not provide this.

---

## 11. Trust assumptions (honest)

| Layer | Assumption | Residual |
|---|---|---|
| GitHub-hosted runner kernel / VM | Trusted | Compromised runner can read secrets; out of scope |
| Docker daemon (when present) | Trusted; **not** mounted into the probe container | No daemon in some authoring hosts → process jail only |
| `claude-code-action` at pinned SHA | Reviewed; still injects git credentials in agent mode | Model+Bash jailbreak could push; mitigated by not installing Bash tools; not equivalent to credential-free model plane |
| Node `--require` preload jail | Best-effort userland; not a kernel jail | `process.binding` / native addons could bypass; Docker is the stronger plane |
| Network `--internal` (Docker) | Blocks default egress | Process backend on authoring hosts cannot `unshare -n` here (`Operation not permitted`) — egress-block for process backend is **BLOCKED**, proven via argv contract + preload fetch deny |
| Evidence APIs | Dispatcher token can read the repo | Comment text is untrusted input |
| Image digests | Recorded at runtime on GHA when docker inspect works | Authoring host has no Docker; local digest pin **not executed** |

Canaries in tests are **synthetic** (`CANARY_TOKEN=test-only-not-a-secret`). Never hash, print, or exfiltrate real tokens.

---

## 12. Operator runbook

### Authoring / CI (this PR)

```bash
export PATH="/path/to/node-v22.19.0/bin:$PATH"   # or GHA setup-node 22.19.0 + npm 11.5.2
node -v    # v22.19.0
npm -v     # 11.5.2
bash .github/scripts/claude-review/bin/run-all-proofs.sh
bash .github/scripts/classify-ci-change-set.test.sh
bash .github/scripts/classify-ci-change-set.sh --from-git <M> <HEAD>
```

Do **not** trigger the live Claude workflow, `workflow_dispatch` of this runner, or credentialed e2e during authoring.

### After merge (owner)

1. Independent Claude tooling review of the exact head (existing capable environment; this runner must not review itself).
2. ChatGPT acceptance.
3. Owner squash-merge.
4. Set `STOCKY_CLAUDE_REVIEW_RUNNER=admitted` only when a bounded live e2e is explicitly authorized.
5. Post one `STOCKY_REVIEW_TASK_V1` command on an isolated issue/PR.
6. Confirm coordinator readback: unchanged subject, no unintended writes, duplicate/stale/fail/denied/unknown tests as applicable.
7. Unset the variable if not keeping the runner hot.

### Kill / stop

- Owner comment `STOCKY_REVIEW_STOP_V1`
- Unset `STOCKY_CLAUDE_REVIEW_RUNNER`
- Do not delete `ci.yml` or branch protection to “fix” a runner failure

---

## 13. Verdict language

Publisher/status values:

`REJECTED` `BLOCKED` `UNKNOWN` `EXPECTED_FAILURE` `COMPLETED_NO_VERDICT`

The runner **never** emits `PASS` for application implementation or merge. A completed comment is not ChatGPT acceptance. Label `READY FOR INDEPENDENT RUNNER REVIEW` is a Cursor authoring label on the **tooling PR**, not live adoption.
