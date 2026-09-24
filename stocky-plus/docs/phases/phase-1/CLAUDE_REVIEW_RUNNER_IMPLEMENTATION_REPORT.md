# CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT — RUNNER-01

**Status:** Implementation complete — independent tooling review not started
**Implementer:** Cursor (cloud agent)
**Label:** `READY FOR INDEPENDENT RUNNER REVIEW` is withheld from this documentation-sync commit. It may be applied only after exact-head Classify + full Heavy + CI Gate SUCCESS on the live PR head that includes this file. Do not treat this commit as self-certifying.

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
| Pull request | [#62](https://github.com/Vedang1998/Stocky/pull/62) draft against `main` |
| Activation | **not** performed. Live Claude workflow / workflow_dispatch / credentialed e2e **not executed** |

This documentation-sync commit records CI identities for the last full-Heavy implementation head. It does **not** embed its own future SHA.

## Git head distinction

| Role | SHA | Notes |
|---|---|---|
| Starting main / authorized M | `c0dd99c5641692098b7a08dce3a53d21e22391a8` | PR58 squash; live `origin/main` when this packet was written |
| Runtime/test implementation | `a1c52735f91727cdb76f0a7ffebeb56b96241bd0` | dispatcher, workflows, sandbox, tests |
| Last full-Heavy implementation head | `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` | includes runtime plus authoring docs; exact-head CI below |
| Reviewed implementation head | none | independent Claude tooling review has not started |
| Review-report-only commit | none | this file is author documentation, not an independent review |
| Documentation finalization | this commit after it exists | live PR head will differ from `7139a10`; do not claim this commit's SHA here |
| Live PR head at `7139a10` CI | `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` | matched run `35946198137` |

### Commit classification since M

| SHA | Class | Headline |
|---|---|---|
| `2d23a57a42001196cf0a49644c96782cb5f0fd4a` | documentation | freeze bounded Claude executable review runner contract |
| `a1c52735f91727cdb76f0a7ffebeb56b96241bd0` | runtime + test | add bounded Claude executable review runner |
| `7548f439b3c54013ed579a2ffa50926ac5cfb5f8` | documentation | record RUNNER-01 authoring evidence packet |
| `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` | documentation | strip trailing whitespace from runner runbook and report |
| this documentation sync | documentation | record PR62 / exact-head CI identities for `7139a10` |

No empty retrigger. No independent review report. No schema/migration. No `ci.yml` change.

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

- `.github/workflows/main.yml` blob at `7139a10`: `2a73aca804117ad742f51acc1c6922ad9f39f79f`
- `.github/workflows/claude-review-execution.yml` blob at `7139a10`: `d2e338f8d050ed8935278300963dd23996f51fae`

### Helper / tests

- `.github/scripts/claude-review/**` (dispatcher, authority, evidence, sandbox, MCP broker, publisher, fixtures, tests)

### Documentation (allowed)

- `stocky-plus/docs/agents/CLAUDE_EXECUTABLE_REVIEW_RUNNER.md` blob at `7139a10`: `ff9dda2cec19f43794ee03b66a924668e3aeea51`
- `stocky-plus/docs/phases/phase-1/CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT.md` blob at `7139a10`: `712968aa16b48846b87f07b21a99f1930562bd8d` (superseded by this documentation sync)

No `ci.yml`, app, Prisma, product, or governance-file edits. Forty paths vs M at `7139a10`.

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
| `node --test tests/*.test.js` | 0 | executed and passed | **70 pass / 0 fail** (re-run after CI on `7139a10`: same 70/0) |
| `bash .github/scripts/claude-review/bin/run-all-proofs.sh` | 0 | executed and passed | includes classifier self-test 40/40 |
| `bash .github/scripts/classify-ci-change-set.test.sh` | 0 | executed and passed | unmodified |
| `bash .github/scripts/classify-ci-change-set.sh --from-git M 7139a10` | 0 | executed and passed | `docs_only=false` `full_ci=true` `changed_path_count=40` `classification_reason=non_docs_or_unknown_path` |
| `git diff --check M 7139a10` | 0 | executed and passed | no whitespace errors |
| Live Claude / `workflow_dispatch` of this runner | — | **not executed** | activation gated |
| Docker image digest pin | — | **not executed** | docker missing |

Observed authoring versions: Node `v22.19.0`, npm `11.5.2`, PostgreSQL `16.15`, Redis `7.0.15`.

## Exact-head CI on implementation head `7139a10`

Observed after draft PR #62 opened. No stamp-only retry. No cancelled or failed runs on this SHA.

| Item | Value |
|---|---|
| Event | `pull_request` |
| Workflow | CI |
| Run | [35946198137](https://github.com/Vedang1998/Stocky/actions/runs/35946198137) |
| `head_sha` | `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` (equals live PR head at that time) |
| Conclusion | `success` |
| Classify job | [107464562947](https://github.com/Vedang1998/Stocky/actions/runs/35946198137/job/107464562947) SUCCESS |
| Heavy job | [107464591535](https://github.com/Vedang1998/Stocky/actions/runs/35946198137/job/107464591535) SUCCESS (not skipped) |
| CI Gate job | [107478064855](https://github.com/Vedang1998/Stocky/actions/runs/35946198137/job/107478064855) SUCCESS |

Classify log (job 107464562947):

- `pr_base_sha=c0dd99c5641692098b7a08dce3a53d21e22391a8`
- `pr_head_sha=7139a10e3e9e3f1184ff56d7cc8d68f458a63d68`
- `changed_path_count=40`
- `classification_reason=non_docs_or_unknown_path`
- `docs_only=false`
- `full_ci=true`

CI Gate log (job 107478064855):

```
classify_result=success
validate_result=success
full_ci=true
docs_only=false
CI Gate SUCCESS: full validate succeeded
```

Superseded failed/cancelled CI on this branch: none observed (`gh run list` returned only run `35946198137` for this SHA).

A later documentation-sync commit moves the live PR head. Exact-head CI for that new head is required before the READY label. Classification vs M remains `full_ci=true` because `.github/**` paths are still in the PR.

## Tests added

70 `node:test` cases covering: owner/task vs wrong actor/role/repo/head; fetched vs claimed; edited authority; stale head; duplicate dispatch; STOP; concurrent lease; malicious JSON/shell text; hook/package fixtures; path/symlink/tar escapes; canary env/file; docker.sock; blocked fetch; positive SQL+Redis+node; failing SQL; zero-test control; timeout; oversized source; false claimed success; publisher local remote; foreign/missing parent; enforcement disable + restore hash.

## Deviations

- Branch name uses required platform prefix/suffix rather than the bare requested name; disclosed above.
- Secret-free execution workflow is `workflow_dispatch` only (no auto chain), as required.

## Known failures and unresolved findings

- Exact-head Classify + Heavy + CI Gate on the live head **after this documentation sync**: pending at write time of this file.
- Docker-backed sandbox on GHA: implemented as argv/Dockerfile, **not executed** on the authoring host.
- Vendor action git-credential residual: documented, not closed.
- Historical PR58 Heavy timing benchmark: **not repaired** (out of scope).
- Live authenticated coordinator→runner→readback e2e: **not executed**.

## Claude review handoff

Review the exact live PR head after green exact-head CI on that head. Do not let this runner review itself. Verify pins, tool isolation, sandbox, publisher, and that activation remains off. Treat `7139a10` as the last full-Heavy **implementation** head already observed; re-verify the documentation-sync head separately.

## Explicit stop

No other PR was started, merged, or closed. Application runtime, Shopify, `ci.yml`, and production were not touched. The PR remains draft. The runner is not activated.
