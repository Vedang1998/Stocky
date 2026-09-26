# Bounded executable Claude review runner

**Status:** IMPLEMENTATION DRAFT — not activated, not production, not a substitute for independent review
**Authority:** issue61 + issue52 comment `5806012938` + owner command `5806021611` + R1 `5807860348` + R2 `5813474882` / review `5813026207` + reassessment `5825863075` + stabilization re-admission `5841639793`
**Dispatch-Key (original):** `propo:issue61-v1:RUNNER01:c0dd99c5641692098b7a08dce3a53d21e22391a8:cursor-implementation`
**Dispatch-Key (R1):** `propo:5806021611:RUNNER01_SECURITY_CORRECTION_R1:1433281753670762394a44ee9c25514a8b1d86bc:cursor-correction`
**Dispatch-Key (R2):** `propo:5806021611:RUNNER01_SECURITY_CORRECTION_R2:bbd3bbedf7951a043aaaf51d84a0fc0b93595c97:cursor-correction`
**Dispatch-Key (stabilization):** `propo:5841639793:RUNNER01_STABILIZATION:4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a:cursor-correction`
**Risk tier:** A (credentials, publication, untrusted subject execution)
**Activation:** blocked until independent runner re-review, ChatGPT acceptance, owner merge, **and** repository variable `STOCKY_CLAUDE_REVIEW_RUNNER=admitted`
**This runner must not certify itself.**

### Recorded draft identity

| Item | Value |
|---|---|
| Tool / model / run | Cursor / cursor-grok-4.6-xhigh / `bc-b1e90a6c-c9b7-46bf-bcb8-22e276027492` |
| Draft PR | [#62](https://github.com/Vedang1998/Stocky/pull/62) against `main` |
| Branch | `cursor/tooling-claude-executable-review-runner-61-7492` |
| Base M | `c0dd99c5641692098b7a08dce3a53d21e22391a8` |
| Runtime/test implementation | `a1c52735f91727cdb76f0a7ffebeb56b96241bd0` |
| Last full-Heavy implementation head (pre-R1) | `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` |
| R1 input head | `1433281753670762394a44ee9c25514a8b1d86bc` |
| R1 output / R2 input | `bbd3bbedf7951a043aaaf51d84a0fc0b93595c97` |
| R2 first correction | `df6759278059e4d9899259d5e7c0d118db3bda2c` |
| R2 output / R2 re-review subject | `4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a` |
| Stabilization input S | `4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a` |
| Stabilization output | recorded in the live PR description after push; not self-embedded |
| Instruction loading | `AGENTS.md`, issue61, issue52 `5806012938`, this runbook, implementation report |

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
| `.github/workflows/claude-review-execution.yml` | Secret-free `pull_request` isolation proof of the same Docker executor used by MCP `run_probe`; non-authoritative provenance-bound `workflow_dispatch` operator replay |
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
| PostgreSQL image | locator `postgres:16-alpine` | manifest-list digest `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` | 2026-09-24 Docker Hub tag API | `lib/constants.js` `IMAGE_PINS.postgres` |
| Redis image | locator `redis:7-alpine` | `sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499` | 2026-09-24 | `IMAGE_PINS.redis` |
| Node probe image | locator `node:22.19.0-bookworm-slim` | `sha256:4a4884e8a44826194dff92ba316264f392056cbe243dcc9fd3551e71cea02b90` | 2026-09-24 | `IMAGE_PINS.node` |
| `actions/upload-artifact` | `v4` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | 2026-09-24 GitHub API lightweight tag | R1 job split |
| `actions/download-artifact` | `v4` | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | 2026-09-24 | R1 job split |

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

Trigger: `issue_comment` / `created` only. Workflow-level `permissions: {}`.

Shared `if:` (all jobs inherit via `ingress`): repository + owner login + numeric id `278831488` + `User` + `@claude ` prefix. Body is `COMMENT_BODY` env into Node only.

| Job | Permissions | Secrets | Role |
|---|---|---|---|
| `ingress` | `contents: read`, `issues: write`, `pull-requests: write`, `actions: read` | `GITHUB_TOKEN` only | Parse/bind/fetch/snapshot subject tarball. No OAuth. No model. |
| `simple` | `contents: write`, `issues: write`, `pull-requests: write`, `id-token: write`, `actions: read` | OAuth + `github_token: ${{ github.token }}` | Preserved owner communication. Not executable review. |
| `executable` | **`contents: read`**, `actions: read`, `issues: read`, `pull-requests: read`. **No `id-token: write`.** No `contents: write` / `issues: write`. | OAuth for Claude API + **explicit** `github_token: ${{ github.token }}` (job-scoped, read-only contents). | Model + MCP. `assert-lease` before Claude. Probes run in Docker via `isolated-executor.js`. `submit_result` writes a file; model cannot GitHub-write. |
| `publish` | `contents: write`, `issues: write`, `pull-requests: write` | `GITHUB_TOKEN` only. **No OAuth.** | Trusted `publish-from-state`. Re-checks STOP. Concurrency `claude-review-pub-<dispatch_key>`. |
| `publish_reject` | `issues: write`, `pull-requests: write`, `contents: read` | `GITHUB_TOKEN` only | Rejection/STOP without model. **Only when `needs.ingress.result == 'success'` and `invoke_claude != 'true'`.** |

Passing `github_token: ${{ github.token }}` is mandatory on Claude steps. Inspected `src/github/token.ts` at action SHA `8cf34825…`: if `OVERRIDE_GITHUB_TOKEN` is empty, the action exchanges OIDC for a GitHub App token with default `contents: write`, `pull_requests: write`, `issues: write` — **bypassing job permissions**. R1 therefore sets the override and omits `id-token: write` on the executable job so that minting cannot succeed if the override is dropped. `classify_inline_comments: false` skips the action's post-session comment writer.

Ingress concurrency: `claude-issue-${{ github.event.issue.number }}`, `cancel-in-progress: false` (not exactly-once; dispatcher lease is). Executable-review mode runs only when `vars.STOCKY_CLAUDE_REVIEW_RUNNER == 'admitted'`. Simple `@claude` communication remains available without that variable. The runner cannot set the variable. OAuth is referenced **by name only**; do not set `anthropic_api_key`.

### 5.2 Secret-free isolated executor — `.github/workflows/claude-review-execution.yml`

- `pull_request` (path-filtered): **authoritative isolation proof** of `lib/isolated-executor.js`. No OAuth. Calls `bin/isolation-proof.mjs`.
- `workflow_dispatch`: **non-authoritative operator replay** of the same executor; requires task/attempt/head/base/authority/dispatch_key inputs. Missing provenance fails closed. Not invoked by MCP.

No `pull_request_target`, no `workflow_run`, no `issue_comment`. MCP `run_probe` does **not** call this workflow; it calls `runIsolatedProbe` in-process with Docker.

Mutable tags are not used by the executor. Images are `name@sha256:…` from `IMAGE_PINS`.

### 5.3 Three planes

```
A. Trusted controller (ingress) — GITHUB_TOKEN read, no OAuth, no untrusted code
        │
        ├─ simple job: OAuth + write token (communication only; no run_probe)
        │
        └─ executable job: OAuth + read-only GITHUB_TOKEN
                MCP run_probe → isolated-executor.js (detached named Docker, isolated gateway, digest pins)
                MCP submit_result → stateDir/model-result.md (publisher loads this; model has no GitHub write)
                │ executor metadata files
                ▼
B. Secret-free sandbox (same executor as isolation_proof job)
   No OAuth, no GITHUB_TOKEN, no docker.sock, subject mount :ro
        │
        ▼
C. Trusted publisher job — GITHUB_TOKEN write, no OAuth, no model tools
```

---

## 6. Tool / MCP matrix

Claude **effective** tools for executable review (allowlist). Anything else is denied:

| Tool | Direction | Implementation |
|---|---|---|
| `mcp__stocky_review__get_evidence` | read local evidence pack | broker → files written by dispatcher |
| `mcp__stocky_review__read_subject` | read file under snapshot root | broker → `fs-guard` realpath jail |
| `mcp__stocky_review__run_probe` | typed probe | broker → `runIsolatedProbe` (digest-pinned Docker). Model cannot select `isolationMode`. |
| `mcp__stocky_review__checkpoint` | persist bounded checkpoint | broker → `stateDir/checkpoint.json` |
| `mcp__stocky_review__submit_result` | bounded markdown findings | broker → `stateDir/model-result.md`. Size-capped. No GitHub API. |

Explicitly denied (settings + `--disallowedTools` + not installed):

`Bash`, `BashOutput`, `KillShell`, `Write`, `Edit`, `MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `SlashCommand`, `mcp__github*`, `mcp__github_comment*`, `mcp__github_file_ops*`, `mcp__github_ci*`, `mcp__github_inline_comment*`.

Simple route allowlist: `Read`, `Glob`, `Grep`, `LS` on the **trusted checkout of the workflow ref** (default branch after merge). No Bash, no GitHub MCP, no subject hooks.

`allowedTools` / a read-only prompt **alone are not the security argument**. Isolation is:

1. agent mode so tag-mode git Bash is not auto-attached;
2. GitHub MCP servers not installed;
3. MCP broker implements only the five tools and never receives OAuth;
4. subject is a tarball/data snapshot, not the workspace used to run the action;
5. probes run only in `lib/isolated-executor.js` (digest-pinned Docker, `--internal` + `gateway_mode_ipv4=isolated`). Timeout uses detached `--name --init` + `docker kill -s KILL`, not attached `spawnSync` SIGTERM. Host `spawnSync` for Node/SQL/Redis exists solely behind `HOST_ISOLATION_MODES` and is unreachable from MCP;
6. publisher job (no OAuth) consumes executor metadata and `submit_result` markdown; model PASS is ignored; host-process backends are refused.

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

- `node_script` is **untrusted** even when model-authored. Size cap 32 KiB. Production execution is Docker-only (`node@sha256:…`, `--cap-drop ALL`, `--read-only`, user 65534, subject mount `:ro`). Host `spawnSync` is tests-only.
- `sql` allowlists a single `SELECT`/`INSERT`/`UPDATE`/`DELETE` against the synthetic DB; rejects `COPY`, `\;`, meta-commands, `INTO OUTFILE`, `pg_read_file`, `lo_import`.
- `redis` allowlists PING/SET/GET with key prefix `stocky-review:`.
- `zero_test_control` is an explicit failing control: executor reports `tests_run=0` which the verdict layer treats as **failure**, never PASS.
- A failing negative control is `expected_failure` only when `expect.outcome` is `fail` and the executor actually failed. It cannot green other failing tests.
- Executor metadata (`exit_code`, `timed_out`, `stdout_sha256`, `tests_run`, `backend`) is distinct from model text.

---

## 9. Publication contract

Publisher (trusted Node, `GITHUB_TOKEN`) may:

1. create or update **one** tracking comment on the triggering issue/PR, identified by a designated **top-level** HTML envelope `<!-- STOCKY_REVIEW_LOCK ... -->` generated only from validated controller/executor state;
2. if and only if `publish_review_branch: true` **and** activation is admitted: create **one new** branch `claude-review/{task_id}/{attempt}` whose sole parent is the **subject head SHA**, containing only `stocky-plus/docs/phases/phase-1/reviews/{task_id}/REVIEW_ARTIFACT.md`.

The machine envelope is generated from trusted evidence. Model text, subject strings, probe stdout/stderr, and diagnostics are rendered as **inert quoted opinion** (`renderInertOpinion`: line prefix `| `, neutralized `@`, HTML comments, and `STOCKY_*` markers). Findings are preserved; they cannot mint a second parsed envelope, an actionable `@claude` / `@cursor` mention, or an HTML lock. Review opinion cannot stamp CI success, merge authority, or activation. Markdown fences alone are not treated as sufficient.

Publisher must refuse:

- writes to `main` or any existing subject branch;
- trees with a different parent;
- paths outside the allowlist;
- artifacts that try to change workflows, gates, or dispatch other agents;
- PASS when evidence is missing, tests_run=0, head moved, lease STOPPED, output incomplete, or executor status is timeout/unknown;
- using the model's JSON as proof of test results.

After a successful POST, publisher **reads the comment back**. If GET fails or the marker does not match, status is `UNKNOWN` (`publication_readback_unknown`) and the publisher **must not POST again**. Incomplete comment history at publication is `BLOCKED`, never “no STOP”.

---

## 10. Session / dedup

Stable key = `dispatch_key`. Attempt id = `run_id` + hash nonce. Canonical thread = the fetched owner authority comment's `issue_url`. Copied requests on a different issue/PR are `canonical_thread_mismatch`.

Comment history is retrieved with GitHub pagination metadata only: at most 10 pages, 2 MiB decoded bytes, 15 s elapsed, with actual response-size and timeout limits. Incomplete, malformed, capped, failed, or unsafe-next retrieval is `incomplete_comment_history` / BLOCKED, never an empty array. Credentials do not follow off-origin or off-path next URLs. Comments are not a transactional snapshot; revalidate at pre-invocation (`assert-lease`) and publication.

Control records are authenticated from fetched GitHub metadata, not marker text:

- Dedicated leading STOP (`@claude STOCKY_REVIEW_STOP_V1` at body start) is accepted only from immutable owner id `278831488` / type `User`. Owner discussion that merely contains a stopped marker is not a STOP command.
- Lease lock envelopes are accepted only as a designated **top-level** `<!-- STOCKY_REVIEW_LOCK` from workflow bot id `41898282` / type `Bot`, bound to task/thread/authority/head/attempt/run. Missing identity or ambiguous trusted envelopes fail closed. Outsider lookalikes are inert diagnostics.
- `released` text never clears a live or sticky STOP/completed state.
- Continuation requires `continuation_of` equal to the prior attempt id and a verified `blocked` / `unknown` / `checkpointed` (non-running) state. A caller boolean is not authority. Uncertain POST/invocation/publication is UNKNOWN and cannot silently become released.

States: `leased`, `running`, `checkpointed`, `blocked`, `completed`, `rejected`, `stopped`, `unknown`. `released` is not a control state.

Exact-SHA snapshot runs **before** a running/leased lock can authorize invocation. Known pre-model snapshot failure is BLOCKED (retryable only via explicit continuation). Ingress concurrency groups serialize jobs; they are **not** exactly-once coordination.

Executable concurrency: `claude-review-exec-<dispatch_key>`. Publish concurrency: `claude-review-pub-<dispatch_key>`. `cancel-in-progress: false`.

---

## 11. Trust assumptions (honest)

| Layer | Assumption | Residual |
|---|---|---|
| GitHub-hosted runner kernel / VM | Trusted | Compromised runner can read secrets; out of scope |
| Docker daemon (when present) | Trusted; **not** mounted into the probe container | Authoring VM has no Docker; GHA `isolation_proof` job is the kernel/container proof |
| `claude-code-action` at pinned SHA | Reviewed; still calls `configureGitAuth` in agent mode | Mitigated on the executable path by passing `github_token: ${{ github.token }}` with `contents: read` and omitting `id-token: write` so the action cannot mint an App write token. Residual: a read-only job token is still injected into git config. Not equivalent to a credential-free model plane. Simple communication still uses a write-capable job. |
| Node `--require` preload jail | Defense in depth inside the container; host-unit tests only | `process.binding` / native addons could bypass userland jail; Docker is the production plane |
| Network `--internal` + `gateway_mode_ipv4=isolated` | Blocks default egress and host-bridge gateway from probe code | Image pulls happen on the trusted host docker network before sandbox create. Synthetic PG/Redis remain on the same ICC network; SQL/Redis clients use inspected sidecar IPs (`--add-host` / `-h <ip>`) and are not `--read-only`. |
| Evidence APIs | Dispatcher token can read the repo | Comment text is untrusted input |
| Image digests | Manifest-list pins in `IMAGE_PINS`; executor pulls `name@sha256:…` | Pins recorded from Docker Hub tag API 2026-09-24. GHA `isolation_proof` must `docker image inspect` the resolved refs. Mutable tags are locators only. |

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

The runner **never** emits `PASS` for application implementation or merge. A completed comment is not ChatGPT acceptance. Label `READY FOR INDEPENDENT RUNNER RE-REVIEW` is a Cursor authoring label on the **tooling PR**, not live adoption.

---

## 14. R2 security correction (R62-01..07)

Independent review `5813026207` of `bbd3bbe` required these production-path repairs. R62-08/R62-09 remain non-blocking observations (simple route still write-capable; vendor `configureGitAuth` residual).

| ID | Repair |
|---|---|
| R62-01 | Named `--init --stop-timeout 1` detached `docker run -d`. Inspect-poll until exit or deadline, then `docker kill -s KILL`, logs, `rm -f`. `finally` removes `pg`/`redis`/`probe` + network. `timed_out` is persisted. Fake-docker busy-loop unit test is wall-clock bounded. |
| R62-02 | MCP `submit_result` writes size-capped `stateDir/model-result.md`. Checkpoint writes `stateDir/checkpoint.json`. Publisher already loads those files into `result-comment.md`. |
| R62-03 | `dispatch.mjs --phase validate` fetches comments, binds authority, POSTs lock. `--phase assert-lease` before Claude. STOP/duplicate/stale/edited-authority covered by mock-GitHub tests through the production entry. |
| R62-04 | Production network is `--internal` plus `enable_ip_masquerade=false` and `gateway_mode_ipv4=isolated`. Inspected bridge Gateway is passed as `STOCKY_BRIDGE_GATEWAY`. Mutation `omit-gateway-isolated` also drops `--internal` so a host-listener canary can revive CONNECTED. |
| R62-05 | `publish_reject` requires `needs.ingress.result == 'success'` so skipped ingress (non-owner comments) does not start a write job. |
| R62-06 | Exact-SHA snapshot runs before `invoke_claude` is written to `GITHUB_OUTPUT`. Extract failure sets `invoke_claude=false` and a deterministic rejection code. |
| R62-07 | `isolation-proof.mjs` records per-control oracles: timeout/orphan, host-gateway + mutation, egress/IMDS, jail-bypass canary/socket/secrets, image pin inspect, file-hash restoration. Generic non-zero is not PASS. |

`STOCKY_ISOLATION_PROOF` / `STOCKY_ISOLATION_PROOF_MUTATION` / `STOCKY_REVIEW_MOCK_GITHUB_URL` are **not** production authority. Production `bin/dispatch.mjs` rejects those env keys. Isolation-proof mutations (`omit-gateway-isolated`, `skip-cleanup`, `skip-kill`, `omit-log-limits`) require explicit `allowProofHooks: true` DI; ambient env cannot change Docker argv.

---

## 15. Stabilization (R62-03/07/10/11/12/13)

Independent re-review `5824165909` of `4e5eefb` plus ChatGPT decision `5841639793`. R1/R2 remain exhausted; this is one admitted post-reassessment package, not an automatic R3. R62-01/02/04-code/05/06 stay closed. R62-08/09/14 observations remain visible.

| ID | Repair |
|---|---|
| R62-10 / R62-03 | `fetchCommentHistory` pages with Link, 10/2MiB/15s budgets, fail-closed incomplete history. Dispatch entry tests honor owner STOP at 101 and bot lease at 201. |
| R62-11 | `reduceControlState` authenticates owner STOP and workflow-bot locks; outsider/missing-identity/forged-in-narrative cannot change state. Sticky STOP/completed. Ignore `released`. |
| R62-12 | Probe + sidecar `--log-driver json-file --log-opt max-size=1m --log-opt max-file=1`. Completeness is collected via `docker start -a` into size-capped files (not `docker logs --follow`, which can miss bytes after max-file=1 rotation). Do **not** pass `--sig-proxy` to `docker start`: GitHub-hosted CLI rejects it as an unknown flag and leaves the container `created` with empty stdout. Timeout remains named inspect + `docker kill -s KILL`, not spawnSync SIGTERM. Attach reader destroyed at 256 KiB. Flood/rotation/omit scripts **drain stdout**. Incomplete output is BLOCKED even if exit=0. Rotation threshold is **not** an exact host-disk bound. `omit-log-limits` is a tightly volume-bounded proof hook (512 KiB write). |
| R62-13 | Publisher emits one trusted envelope + inert opinion. `submit_result` → collect → `publish-from-state` → parser tests. Lost readback after POST does not retry. |
| R62-07 | Isolation proof dials harness-derived candidates even when Gateway is empty (`attempts>0`). Independent host-listener process. Jail oracles require an **attempted** specific denial (`ENOENT`/`EACCES`/`EPERM`/`STOCKY_JAIL`) on both wrapped fs and `fs.promises` bypass; generic `ERR` / `untried` cannot PASS. Mutations are DI. |
| R62-14 deps | Snapshot-before-running-lease; blocked lock on snapshot failure; `continuation_of` required. |

Probe resource notes: returned stdout/stderr stay at 256 KiB; json-file `max-size=1m` is rotation; permitted overshoot is daemon logging of the last rotated file plus collector cap, not gigabytes. Test-only removed-limit writes 512 KiB only.
