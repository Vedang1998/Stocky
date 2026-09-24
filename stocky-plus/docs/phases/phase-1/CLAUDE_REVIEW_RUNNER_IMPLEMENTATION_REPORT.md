# CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT — RUNNER-01

**Status:** Implementation complete — pending independent verification  
**Implementer:** Cursor (cloud agent)  
**Label:** not yet `READY FOR INDEPENDENT RUNNER REVIEW` (exact-head CI pending at first push)

## Identity

| Item | Value |
|---|---|
| Tool | Cursor |
| Actual model | cursor-grok-4.6-xhigh |
| Actual run | https://cursor.com/agents/bc-b1e90a6c-c9b7-46bf-bcb8-22e276027492 (`bc-b1e90a6c-c9b7-46bf-bcb8-22e276027492`) |
| Dispatch-Key | `propo:issue61-v1:RUNNER01:c0dd99c5641692098b7a08dce3a53d21e22391a8:cursor-implementation` |
| Chat | NEW dedicated Issue61 / RUNNER-01 implementation (not PR45/50/53/54/issue60) |
| Working location | isolated repository-root checkout; application `stocky-plus/` |
| Branch | `cursor/tooling-claude-executable-review-runner-61-7492` (requested `tooling/claude-executable-review-runner-61` plus required platform `cursor/` prefix and `-7492` suffix) |
| Base M | `c0dd99c5641692098b7a08dce3a53d21e22391a8` |
| Pull request | pending at first report write; updated after open |
| Activation | **not** performed. Live Claude workflow / workflow_dispatch / credentialed e2e **not executed** |

## Summary

Implemented the bounded executable Claude review runner inside the frozen envelope in `stocky-plus/docs/agents/CLAUDE_EXECUTABLE_REVIEW_RUNNER.md`.

The owner `@claude ` communication route is preserved and hardened: immutable numeric actor bind (`278831488`), write-authority check, full-length action SHA pins, `show_full_output: false`, no paid API fallback, no `allowed_bots` / `allowed_non_write_users`, agent-mode prompts so tag-mode git Bash is not auto-attached, comment body passed only as `COMMENT_BODY` env into Node (never interpolated into `run:`).

Executable review is a separate structured work order (`STOCKY_REVIEW_TASK_V1`) that remains **inactive** until repository variable `STOCKY_CLAUDE_REVIEW_RUNNER=admitted`. Claude, when later admitted, gets only the task-local MCP broker (`get_evidence`, `read_subject`, `run_probe`, `checkpoint`). Probes run in a secret-stripped sandbox with a userland preload jail (and a Docker argv contract for GitHub-hosted runners). Publication is a trusted Node path with sole-parent / allowlisted-path checks.

This is tooling, not PR7 / application runtime.

## Requirements completed

Mapped to issue61 / RUNNER-01 command:

1. Evidence access — dispatcher fetches permission, PR, authority comment via read-only GitHub client; locators are not proof.
2. Reproducible profile — Node 22.19.0 / npm 11.5.2 / PostgreSQL 16 / Redis 7; synthetic credentials distinct from `ci.yml`.
3. Credential and write separation — OAuth only on Claude steps; execution workflow has no OAuth; sandbox strips tokens; publisher is separate.
4. Residual hardening — actor id bind, SHA pins, debug-off, restricted publication.
5. Bounds — 60m/40 turns, 20m sandbox job, ≤2 probes, 1200s probe ceiling, checkpoints, no paid fallback.
6. Session/dedup — dispatch_key lease, STOP, lost-ACK readback; GitHub concurrency is not treated as exactly-once.
7. Return/proof — result comments carry executor metadata; model PASS is ignored as a gate.
8. Authoring proofs — 70 node:test cases + actionlint + YAML + classifier; live Claude **not** run.

## Files changed

### Workflows

- `.github/workflows/main.yml`
- `.github/workflows/claude-review-execution.yml`

### Helper / tests

- `.github/scripts/claude-review/**` (dispatcher, authority, evidence, sandbox, MCP broker, publisher, fixtures, tests)

### Documentation (allowed)

- `stocky-plus/docs/agents/CLAUDE_EXECUTABLE_REVIEW_RUNNER.md`
- `stocky-plus/docs/phases/phase-1/CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT.md`

No `ci.yml`, app, Prisma, product, or governance-file edits.

## Database and migration work

None (synthetic local PostgreSQL/Redis for authoring probes only).

## Safety and tenancy evidence

- Owner bind: login + numeric id `278831488` + `User` + write permission.
- Subject snapshot is data; hooks/`.npmrc`/Makefile of the subject are not executed on the controller.
- Probe kinds `npm_install` / `shell` / `http` denied.
- Preload jail denies host canaries, docker.sock, fetch, and non-allowlisted modules.
- Docker socket is not in docker run argv; networks requested with `--internal`.
- Publisher refuses `main`, `..` paths, gate-override text, missing parent SHA.
- Enforcement-disable tests mutate a **copy** of `isInsideRoot` / disable preload, revive the prohibited outcome, then hash-check the original files.

### Honest residuals

- `claude-code-action@8cf34825…` still injects git credentials in agent mode. Isolation of that token from the model depends on tool deny, not a credential-free model plane.
- Authoring host: Docker missing; `unshare -n` Operation not permitted. Process jail + argv contract executed; kernel/container isolation **not executed** here.
- Live authenticated coordinator→runner→readback e2e **not executed** (gated).

## Commands executed (authoring host)

| Command | Exit | Status | Notes |
|---|---:|---|---|
| `actionlint -shellcheck= .github/workflows/main.yml .github/workflows/claude-review-execution.yml` | 0 | executed and passed | actionlint 1.7.7 |
| `python3` YAML `safe_load_all` both workflows | 0 | executed and passed | PyYAML |
| `node --test tests/*.test.js` | 0 | executed and passed | **70 pass / 0 fail** |
| `bash .github/scripts/claude-review/bin/run-all-proofs.sh` | 0 | executed and passed | includes classifier self-test 40/40 |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | executed and passed | unmodified |
| Live Claude / `workflow_dispatch` of this runner | — | **not executed** | activation gated |
| Docker image digest pin | — | **not executed** | docker missing |
| Exact-head GitHub Actions CI | — | **pending** | after PR open |

Observed authoring versions: Node `v22.19.0`, npm `11.5.2`, PostgreSQL `16.15`, Redis `7.0.15`.

## Tests added

70 `node:test` cases covering: owner/task vs wrong actor/role/repo/head; fetched vs claimed; edited authority; stale head; duplicate dispatch; STOP; concurrent lease; malicious JSON/shell text; hook/package fixtures; path/symlink/tar escapes; canary env/file; docker.sock; blocked fetch; positive SQL+Redis+node; failing SQL; zero-test control; timeout; oversized source; false claimed success; publisher local remote; foreign/missing parent; enforcement disable + restore hash.

## Deviations

- Branch name uses required platform prefix/suffix rather than the bare requested name; disclosed above.
- Secret-free execution workflow is `workflow_dispatch` only (no auto chain), as required.

## Known failures and unresolved findings

- Exact-head Classify + Heavy + CI Gate: **pending** at first report write.
- Docker-backed sandbox on GHA: implemented as argv/Dockerfile, **not executed** on the authoring host.
- Vendor action git-credential residual: documented, not closed.
- Historical PR58 Heavy timing benchmark: **not repaired** (out of scope).

## Claude review handoff

Review the exact PR head after green exact-head CI. Do not let this runner review itself. Verify pins, tool isolation, sandbox, publisher, and that activation remains off.

## Explicit stop

No other PR was started, merged, or closed. Application runtime, Shopify, `ci.yml`, and production were not touched.
