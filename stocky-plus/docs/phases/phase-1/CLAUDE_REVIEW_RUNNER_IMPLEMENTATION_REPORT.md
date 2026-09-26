# CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT — RUNNER-01 / stabilization

**Status:** ONE bounded stabilization package on PR #62 after ChatGPT re-admission `5841639793`. `READY_FOR_INDEPENDENT_STABILIZATION_REVIEW` is withheld from this file until exact-head Classify + full Heavy + CI Gate **and** the strengthened `isolation_proof` job have SUCCESS on the live PR head that includes this correction. Do not treat this commit as self-certifying. Do not embed this commit's own SHA here. R1/R2 remain exhausted; this is not an automatic R3.

**Implementer:** Cursor (cloud agent), same writer as original RUNNER-01 / R1 / R2 (`bc-b1e90a6c-c9b7-46bf-bcb8-22e276027492`). No competing writers. Planning-only run `bc-4e9564b0-0bf3-4927-ad33-093f192ab3c8` was not used.

## Identity

| Item | Value |
|---|---|
| Tool | Cursor |
| Actual model | cursor-grok-4.6-xhigh |
| Actual run | https://cursor.com/agents/bc-b1e90a6c-c9b7-46bf-bcb8-22e276027492 (`bc-b1e90a6c-c9b7-46bf-bcb8-22e276027492`) |
| Original Dispatch-Key | `propo:issue61-v1:RUNNER01:c0dd99c5641692098b7a08dce3a53d21e22391a8:cursor-implementation` |
| R1 Dispatch-Key | `propo:5806021611:RUNNER01_SECURITY_CORRECTION_R1:1433281753670762394a44ee9c25514a8b1d86bc:cursor-correction` |
| R2 Dispatch-Key | `propo:5806021611:RUNNER01_SECURITY_CORRECTION_R2:bbd3bbedf7951a043aaaf51d84a0fc0b93595c97:cursor-correction` |
| Stabilization Dispatch-Key | `propo:5841639793:RUNNER01_STABILIZATION:4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a:cursor-correction` |
| Authority | issue61 `5806021611` + admission `5806012938`; R1 `5807860348`; R2 `5813474882` / review `5813026207`; reassessment `5825863075`; issue63 check `5825878310`; re-admission `5841639793`; journal `5841643706` |
| Chat | EXISTING RUNNER-01 author role/session (same run id) |
| Working location | isolated repository-root checkout; application `stocky-plus/` |
| Branch | `cursor/tooling-claude-executable-review-runner-61-7492` |
| Base M | `c0dd99c5641692098b7a08dce3a53d21e22391a8` |
| Pull request | [#62](https://github.com/Vedang1998/Stocky/pull/62) draft against `main` |
| R2 input head | `bbd3bbedf7951a043aaaf51d84a0fc0b93595c97` |
| Stabilization input S | `4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a` |
| Activation | **not** performed. Live Claude / `workflow_dispatch` of this runner / credentialed e2e **not executed** |

This documentation records CI identities for already-observed heads. It does **not** embed its own future SHA.

## Git head distinction

| Role | SHA | Notes |
|---|---|---|
| Starting main / authorized M | `c0dd99c5641692098b7a08dce3a53d21e22391a8` | live `origin/main` at R1 start |
| Runtime/test implementation (original) | `a1c52735f91727cdb76f0a7ffebeb56b96241bd0` | first dispatcher/workflows/sandbox/tests |
| Last full-Heavy head before docs sync | `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` | exact-head CI run 35946198137 |
| Documentation finalization / R1 input | `1433281753670762394a44ee9c25514a8b1d86bc` | exact-head CI run 35950974549 |
| R1 runtime/test correction | `bbd3bbedf7951a043aaaf51d84a0fc0b93595c97` | parent is `1433281`; exact-head CI run 35958752653 |
| R2 runtime/test correction | `df6759278059e4d9899259d5e7c0d118db3bda2c` | parent is `bbd3bbe`; exact-head CI run 35998517064 SUCCESS; isolation_proof run 35998517100 FAILURE |
| R2 isolation-proof follow-ups | `11693a661c622536a0ab745a69829bf8ead757ab`, `4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a` | live R2 head `4e5eefb`; exact-head CI run 36005015430 SUCCESS; isolation_proof run 36005015425 PASS_ISOLATION_PROOF |
| Stabilization runtime/test | `6ac5ec9f5246cf0730f745d115573000ef979028` | parent is `4e5eefb`; exact-head CI run 36207918474 SUCCESS; isolation_proof run 36207918476 FAILURE |
| Stabilization isolation-proof oracle follow-up | `2149ac099bac09d6a756cfb9e4dabc2a49b39100` | parent is `6ac5ec9`; Classify+Heavy+Gate run 36211907116 SUCCESS; isolation_proof run 36211907059 FAILURE (`rotation_incomplete=false`) |
| Stabilization attach-collector follow-up | this commit (SHA in live PR description; not self-embedded) | parent is `2149ac0`. `docker start -a --sig-proxy=false` completeness vs json-file rotation. |
| Reviewed implementation head | none for this stabilization | independent Claude tooling re-review has not started on the stabilization head |
| Review-report-only commit | none | this file is author documentation, not an independent review |

### Commit classification since M (including R1 parent)

| SHA | Class | Headline |
|---|---|---|
| `2d23a57a42001196cf0a49644c96782cb5f0fd4a` | documentation | freeze bounded Claude executable review runner contract |
| `a1c52735f91727cdb76f0a7ffebeb56b96241bd0` | runtime + test | add bounded Claude executable review runner |
| `7548f439b3c54013ed579a2ffa50926ac5cfb5f8` | documentation | record RUNNER-01 authoring evidence packet |
| `7139a10e3e9e3f1184ff56d7cc8d68f458a63d68` | documentation | strip trailing whitespace from runner runbook and report |
| `1433281753670762394a44ee9c25514a8b1d86bc` | documentation | record PR62 / exact-head CI identities for `7139a10` |
| `bbd3bbedf7951a043aaaf51d84a0fc0b93595c97` | runtime + test + documentation | R1 security-boundary repair |
| `df6759278059e4d9899259d5e7c0d118db3bda2c` | runtime + test + documentation | R2 timeout/model-result/dispatch/isolation oracles |
| `11693a661c622536a0ab745a69829bf8ead757ab` | runtime + test | restore isolation-proof SQL and host-gateway oracles |
| `4e5eefb18c4bbaa58f94951d2ba6748dd49ff73a` | runtime + test | wait for sidecar SELECT 1 before SQL probes |
| `6ac5ec9f5246cf0730f745d115573000ef979028` | runtime + test + documentation | stabilize control history, inert publish, and proofs |
| `2149ac099bac09d6a756cfb9e4dabc2a49b39100` | runtime + test + documentation | classify jail denials and drain isolation-proof flood output |

No empty retrigger. No independent review report. No schema/migration. No `ci.yml` change.

## Stabilization blocking findings (reproduced on `4e5eefb`)

Independent re-review `5824165909` (same independent chat as `5813026207`). R62-01/02/04-code/05/06 closed. Open:

1. **R62-10 P1** `fetchIssueComments` returned one page of 100. Lease/STOP on page 2+ were invisible. Incomplete history was treated as absence.
2. **R62-11 P2** Markers were trusted from anyone. Outsider STOP/lock lookalikes could change state. Released text could clear a live lease. Model narrative inside a bot comment could forge envelopes.
3. **R62-12 P2** Docker json-file logs were uncapped. Timeout/orphan was fixed, but host disk could fill. Post-exit `docker logs` of a rotated small tail could look complete.
4. **R62-13 P2** Published model text could contain actionable `@claude` mentions and additional lock/STOP text. Parser read those if not top-level-only.
5. **R62-07 residual** Production gateway oracle printed `NO_GATEWAY` and returned without dialling. Zero-attempt fixtures could pass.
6. **R62-14 deps** Lease-before-snapshot and continuation boolean were residual risks for the A–C contracts.

R62-08/R62-09 remain observations (simple route write-capable; vendor `configureGitAuth`).

## Stabilization correction (what now enforces the contract)

- `lib/comment-history.js`: paginated fetch, Link-only same-origin same-path next, byte/time/page budgets, duplicate-id and malformed fail-closed. Unsafe next URLs never receive credentials.
- `lib/session.js`: `parseTopLevelLockEnvelope`; owner-id STOP; workflow-bot locks; sticky STOP/completed; ignore released; missing identity fail-closed.
- `lib/dispatch.js` + `lib/dispatch-cli.js`: canonical thread from `issue_url`; snapshot before running lease; blocked lock on snapshot failure; `continuation_of`; production `bin/dispatch.mjs` refuses mock/proof env and exits 2 on `ok === false` (phase runner does not set `process.exitCode`).
- `lib/inert.js` + publisher: one trusted envelope + inert opinion; lost POST readback is UNKNOWN without retry; publication re-fetches complete history.
- `lib/isolated-executor.js`: json-file 1m/1 on probe and sidecars; `docker create` + `docker start -a --sig-proxy=false` attach reader destroyed at 256 KiB; `output_incomplete` → BLOCKED; mutations only via `allowProofHooks`.
- `bin/isolation-proof.mjs`: child host-listener; harness candidates even when Gateway empty; `attempts>0`; wrapped + `fs.promises` bypass FS denials classified as `ENOENT`/`EACCES`/`EPERM`/`STOCKY_JAIL` (generic `ERR` cannot pass); flood/rotation-tail/omit-log-limits drain stdout; hash restore.
- Tests: `tests/comment-history.test.js`, `tests/control-auth.test.js`, `tests/inert-publish.test.js`, `tests/production-hooks.test.js`, `tests/dispatch-pagination.test.js` plus updates. Recorded separately from `proofs/*.test.js` (1 docker-presence assertion; isolation-proof.mjs is the real-container proof).

## Commands executed (authoring host, stabilization)

| Check | Result |
|---|---|
| `node --test --test-reporter=spec tests/*.test.js` | **120 pass / 0 fail** on this follow-up tree (Node v22.19.0, npm 11.5.2, PostgreSQL 16.15, Redis 7.0.15). Prior stabilization commit `6ac5ec9` recorded 118/0. |
| `node --test --test-reporter=spec proofs/*.test.js` | **1 pass / 0 fail** (docker-absence detection; not a silent skip of the GHA proof) |
| `actionlint` 1.7.7 | exit 0 |
| YAML parse of `main.yml` + `claude-review-execution.yml` | exit 0 |
| classifier self-test | 40/40 |
| `classify-ci-change-set.sh --from-git M <R2 head 4e5eefb>` | `full_ci=true` `docs_only=false` (46 paths at R2; new workflow/helper paths still full_ci) |
| `git diff --check` | exit 0 |
| `isolation-proof.mjs` locally | exit 2 `isolation_unavailable_docker_missing` (expected; authoring VM has no Docker) |
| Live Claude / runner `workflow_dispatch` | **not executed** |

Exact-head CI and hosted isolation proof on the stabilization follow-up head: recorded in the live PR description / task result after push; not this commit's own SHA.

Observed on `6ac5ec9` (not this follow-up): Classify+Heavy+Gate SUCCESS run 36207918474; isolation_proof FAILURE run 36207918476 (`canary_denied=false`, `flood_incomplete=false`). That SHA is not READY.

The prior 94+1 vs 95 count difference was source-derived at R2, not a mandate to keep 95. Stabilization named tests: 118 on `6ac5ec9`, 120 on this follow-up (`tests/*.test.js` only).

## R1 blocking findings (reproduced on `1433281`)

Direct inspection of live-head code before this correction:

1. MCP `run_probe` called `runProbe` → host `spawnSync` (`lib/sandbox.js`). Docker helpers were argv-only. `bin/sandbox.mjs` used the host executor. Model-requested Node probes would run in the OAuth/write job.
2. `claude-review-execution.yml` was a parallel `workflow_dispatch` path, not the broker boundary, and lacked task/head/attempt/authority/lease provenance.
3. `publisher.js` validators existed, but `main.yml` ran the vendor action in a write-capable job with no post-model trusted publication step.
4. Final result `5807668161` recorded Docker/image-digest/kernel isolation as **not executed** and still labeled READY.
5. Mutable `postgres:16-alpine` / `redis:7-alpine` tags were not immutable digest evidence.

These were not relabeled P3.

## R1 correction (what now enforces the contract)

### Finding 1 — probe isolation on the accepted path

- `runProbe` production default is `isolationMode: "docker"` → `runIsolatedProbe`.
- Host `spawnSync` remains only for `HOST_ISOLATION_MODES` (`host-unit`, `host-enforcement-control`) used by unit tests and the disable-control.
- MCP broker always passes `isolationMode: "docker"` and `requireProvenance: true`, and rejects model-supplied `isolationMode` / `dockerBin` / `disablePreload`.
- Untrusted Node runs in `node@sha256:…` with `--cap-drop ALL`, `--read-only`, user `65534:65534`, subject `:ro`, `--internal` network. Docker CLI is invoked with `dockerCliEnv()` so controller OAuth/GitHub tokens are not inherited.
- Missing Docker is `isolation_unavailable` (provisioning failed / BLOCKED), not a host-process fallback.

### Finding 2 — one real secret-free executor

- MCP `run_probe` **is** `lib/isolated-executor.js`. It does not dispatch `claude-review-execution.yml`.
- `claude-review-execution.yml` `pull_request` job `isolation_proof` is the credential-free kernel/container proof of that same executor.
- `workflow_dispatch` `operator_replay` is **non-authoritative**, activation-gated, provenance-bound (`--require-provenance`), and checks out the **trusted workflow ref**, not `inputs.subject_head`. Missing SHA/task fields fail closed.
- Executable job rewrites `mcp.json` (`--phase rewrite-mcp`) so broker paths bind to **this job's** `runner.temp`, not the ingress job's.

### Finding 3 — trusted publication

- Jobs split: `ingress` (no OAuth) → `executable` (`contents: read`, no `id-token: write`, OAuth + explicit `github_token: ${{ github.token }}`) → `publish` (write, **no OAuth**, `publish-from-state`).
- Inspected vendor `src/github/token.ts` at `8cf34825…`: empty `OVERRIDE_GITHUB_TOKEN` mints an App token with contents/issues/PR **write**, bypassing job permissions. R1 therefore always passes `github.token` and omits `id-token: write` on the executable job.
- Publisher loads only `PUBLISH_STATE_FILES`, separates executor metadata from model text, rejects host-process backends, gate-override text, stale head, malformed JSON, oversized artifacts, foreign parent, and `main` writes. Only the publisher posts the result comment.

### Finding 4 — isolation proof

- `bin/isolation-proof.mjs`: disable-control (`host-enforcement-control` + `disablePreload`) must revive a host-canary read; production Docker path must fail canary/`docker.sock`/secret-env reads; SQL positive + negative + zero-test; image inspect; hash-check `isolated-executor.js` and `sandbox.js`.
- Authoring VM: Docker missing → exit 2 `BLOCKED` (recorded, not treated as production proof).
- Production proof is the GHA `isolation_proof` job on this PR (ubuntu-latest has Docker). READY is not claimed without that job SUCCESS.

### Finding 5 — image provenance

`IMAGE_PINS` (Docker Hub tag API, 2026-09-24 UTC). Executor uses `name@sha256:…` only:

| Image | Locator (not used to pull) | Manifest-list digest |
|---|---|---|
| postgres | `postgres:16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| redis | `redis:7-alpine` | `sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499` |
| node | `node:22.19.0-bookworm-slim` | `sha256:4a4884e8a44826194dff92ba316264f392056cbe243dcc9fd3551e71cea02b90` |

`sandbox/Dockerfile` is explicitly non-authoritative and is not built.

## Files changed (allowed envelope only)

- `.github/workflows/main.yml`
- `.github/workflows/claude-review-execution.yml`
- `.github/scripts/claude-review/**`
- `stocky-plus/docs/agents/CLAUDE_EXECUTABLE_REVIEW_RUNNER.md`
- `stocky-plus/docs/phases/phase-1/CLAUDE_REVIEW_RUNNER_IMPLEMENTATION_REPORT.md`

No `ci.yml`, app, Prisma, product, or governance-file edits.

## Safety residuals (honest)

- Vendor action still calls `configureGitAuth` in agent mode. On the **executable** path the injected token is the job-scoped `github.token` with `contents: read` and cannot be upgraded via OIDC because `id-token: write` is omitted. A Bash jailbreak still could not contents-write; it is not a credential-free model plane.
- Simple `@claude` communication remains a write-capable job (not the executable-review path).
- Authoring host has no Docker and cannot `unshare -n`. Local isolation-proof is BLOCKED; GHA `isolation_proof` is the accepted mechanism.
- Live authenticated coordinator→runner→readback e2e remains gated (activation unset).

## Commands executed (authoring host, R1) — fill after proofs

Historical proofs on `7139a10` / `1433281` remain valid for those SHAs only. R1 re-runs task-local tests and classifier on the working tree. Exact commands/exits are recorded in the R1 `STOCKY_TASK_RESULT_V1` after execution.

Planned vs executed distinction for R1 proofs:

| Check | Plan |
|---|---|
| `node --test tests/*.test.js` | execute on authoring host |
| `actionlint` + YAML parse | execute on authoring host |
| classifier self-test 40/40 | execute (unmodified) |
| `classify-ci-change-set.sh --from-git M <working tree>` | execute; expect `full_ci=true` |
| `git diff --check` | execute |
| `isolation-proof.mjs` locally | expected BLOCKED (no Docker) |
| GHA `isolation_proof` | execute automatically on push; required for READY |
| Exact-head Classify + Heavy + CI Gate | wait; pending is not success |
| Live Claude / runner `workflow_dispatch` | **not executed** |

## Historical exact-head CI (preserved; not R1 live head)

### Implementation head `7139a10`

| Item | Value |
|---|---|
| Event | `pull_request` |
| Run | [35946198137](https://github.com/Vedang1998/Stocky/actions/runs/35946198137) SUCCESS |
| Classify | [107464562947](https://github.com/Vedang1998/Stocky/actions/runs/35946198137/job/107464562947) SUCCESS |
| Heavy | [107464591535](https://github.com/Vedang1998/Stocky/actions/runs/35946198137/job/107464591535) SUCCESS (not skipped) |
| Gate | [107478064855](https://github.com/Vedang1998/Stocky/actions/runs/35946198137/job/107478064855) SUCCESS `full_ci=true` |

### Docs-finalization / R1 input `1433281`

| Item | Value |
|---|---|
| Event | `pull_request` |
| Run | [35950974549](https://github.com/Vedang1998/Stocky/actions/runs/35950974549) SUCCESS |
| Classify | [107479243890](https://github.com/Vedang1998/Stocky/actions/runs/35950974549/job/107479243890) SUCCESS (`changed_path_count=40`, `full_ci=true`) |
| Heavy | [107479268816](https://github.com/Vedang1998/Stocky/actions/runs/35950974549/job/107479268816) SUCCESS (not skipped) |
| Gate | [107492660014](https://github.com/Vedang1998/Stocky/actions/runs/35950974549/job/107492660014) SUCCESS |

R1 live-head CI identities are recorded below. R2 live-head CI identities are recorded in the task result after the correction push; they are not this file's own SHA.

## R2 blocking findings (reproduced on `bbd3bbe`)

Direct inspection of live-head code (and independent review `5813026207`) before this correction:

1. **R62-01 P1** `runIsolatedProbe` used attached `spawnSync(..., {timeout})` for `docker run` of untrusted Node. SIGTERM hits docker CLI sig-proxy; container PID 1 ignores SIGTERM; unnamed container so `finally` cannot kill it. Independent reproduction: 150s hang, leftover probe/pg/redis.
2. **R62-02 P1** No typed model-result route. Checkpoint wrote `workDir/checkpoint.json`; publisher reads `stateDir/checkpoint.json`. `collect-executor` only copied `work/model-result.md` if the model happened to write it.
3. **R62-03 P1** `dispatch.mjs` called `dispatchValidate({ github })` without comments/lease. Authority hash compared the live body to itself. `applyStop(undefined)` fabricated success. No lock POST, no `assert-lease`.
4. **R62-04 P2** `--internal` still has a bridge gateway. Reviewer: host listener at gateway CONNECTED with jail bypassed.
5. **R62-05 P2** `publish_reject` `if: always() && invoke_claude != 'true'` fired when ingress was skipped.
6. **R62-06 P2** `invoke_claude` was true before snapshot extract. A failed tarball would still invoke Claude.
7. **R62-07 P2** Isolation proof treated any Docker non-zero as blocked; disable-control was host-preload, not a Docker mutation; no timeout/orphan/host-gateway oracles.

These were not relabeled P3. R62-08/R62-09 preserved as observations.

## R2 correction (what now enforces the contract)

### R62-01 — timeout/orphan

- Probe containers: `docker run -d --name --init --stop-timeout 1`. Wait is `docker inspect` poll. Deadline sends `docker kill -s KILL`, then `logs` + `rm -f`.
- `finally` always `cleanupPrefix` (probe + pg + redis + network) unless gated mutation `skip-cleanup`.
- Fake-docker busy-loop unit test: `timed_out=true`, wall clock under 15s, argv includes `--init` and `kill -s KILL`.

### R62-02 — trusted model result

- MCP tool `submit_result({markdown})` writes `stateDir/model-result.md` (32 KiB cap, extra keys denied, gate-override denied).
- `checkpoint` writes `stateDir/checkpoint.json`.
- Publisher `separateExecutorAndModel` includes that markdown in `result-comment.md`. End-to-end mock: submit → publishFromState → comment contains narrative.

### R62-03 — live dispatch controls

- Validate fetches issue comments, `leaseFromComments` / `stopFromComments`, `bindAuthorityComment` (body must contain task/dispatch/head; `created_at` vs `updated_at`).
- STOP without a fetched lease is `stop_without_lease`.
- Ingress POSTs lock marker after acquire. Executable job `assert-lease` before Claude. Publisher re-fetches STOP.
- Production entry tests (`dispatch-entry.test.js`) cover snapshot fail-closed, duplicate lock, STOP assert-lease, successful snapshot+lock.

### R62-04 — host-gateway

- Production: `docker network create --internal --opt enable_ip_masquerade=false --opt gateway_mode_ipv4=isolated`.
- After sidecars start, inspect the bridge `Gateway` and pass `STOCKY_BRIDGE_GATEWAY` into node probes. The host-listener canary uses `new net.Socket` against that IP (preload is not the layer). `--internal` networks often have no default route, so `/proc/net/route` is not the oracle.
- Mutation `omit-gateway-isolated` drops **both** `--internal` and isolated-gateway opts so CONNECTED can revive on a normal bridge.

### R62-04/R62-07 follow-up after `df67592` isolation_proof FAILURE

GHA job [107629155252](https://github.com/Vedang1998/Stocky/actions/runs/35998517100/job/107629155252) on `df67592`:
- `gateway_mutation_revived=false` — stdout `ECONNREFUSED` with an empty IP because the mutation still used `--internal` (no default route) and never passed the inspected gateway.
- `sqlOk=false` — `sql_exit=2` empty stdout. Production SQL/Redis client containers inherited `--read-only` from `commonProbeArgs` (postgres/redis images declare VOLUME dirs). Sidecar readiness used `docker exec`, so ICC/DNS failures were hidden.

GHA job [107648297810](https://github.com/Vedang1998/Stocky/actions/runs/36004274002/job/107648297810) on `11693a6`:
- `gateway_mutation_revived=true` — `CONNECTED 172.18.0.1 via env`
- `gateway_production_not_connected=true` — `NO_GATEWAY`
- `sqlOk=false` — first SQL client hit `172.18.0.1:5432` with `FATAL: the database system is starting up`. The following negative SQL probe connected and returned `relation does not exist` (exit 1), so ICC/SQL worked; `pg_isready` via unix socket was a false-ready.

This follow-up waits for `psql -h 127.0.0.1 -c 'SELECT 1'` inside the sidecar before starting the client. Do not embed this follow-up commit's own SHA here.

### R62-05 — publish_reject gating

- `if: needs.ingress.result == 'success' && needs.ingress.outputs.invoke_claude != 'true'`.

### R62-06 — snapshot fail-closed

- Snapshot runs before `GITHUB_OUTPUT` `invoke_claude`. Failure sets `invoke_claude=false` and `code` from tar/snapshot.

### R62-07 — isolation-proof oracles

Per-control checks in `bin/isolation-proof.mjs`. Local authoring VM remains exit 2 (`docker` missing). GHA `isolation_proof` is the production proof.

### Stabilization isolation_proof FAILURE on `6ac5ec9`

GHA job [108308268034](https://github.com/Vedang1998/Stocky/actions/runs/36207918476/job/108308268034) on `6ac5ec9` (exact-head Classify/Heavy/Gate run [36207918474](https://github.com/Vedang1998/Stocky/actions/runs/36207918474) SUCCESS):

- `canary_denied`/`sock_denied`/`fake_sock_denied`=false because preload `deny()` throws `Error("STOCKY_JAIL:…")` with no `e.code`, and the oracle treated generic `"ERR"` as failure. This follow-up classifies `STOCKY_JAIL` and requires a separate `fs.promises` bypass attempt (`ENOENT`/`EACCES`/`EPERM`/`STOCKY_JAIL`). Generic `"ERR"` / `"untried"` still cannot PASS.
- `flood_incomplete`/`rotation_incomplete`/`omit_limits_incomplete`=false because the probe scripts called `process.exit(0)` after `stdout.write`, dropping unflushed bytes (`output_bytes` 163840 / 98317 / 131072). This follow-up drains via `writeFully` and marks collector cap / ENOBUFS as incomplete.

Do not embed that follow-up commit's own SHA here.

### Stabilization isolation_proof FAILURE on `2149ac0`

GHA job [108320032979](https://github.com/Vedang1998/Stocky/actions/runs/36211907059/job/108320032979) on `2149ac0` (Classify+Heavy+Gate run [36211907116](https://github.com/Vedang1998/Stocky/actions/runs/36211907116) SUCCESS):

- Jail/flood/omit oracles **passed** (`canary_denied=true`, `flood_incomplete=true`, `omit_limits_incomplete=true`).
- `rotation_incomplete=false` and `rotation_not_tail_only_complete=false`: json-file `max-file=1` rotated away `START-MARKER`; `docker logs --follow` then returned only a 98316-byte tail (`stdout_has_tail=true`, `stdout_has_start=false`) that looked complete.
- This follow-up collects probe stdout via `docker start -a --sig-proxy=false` so completeness is not the rotated json-file tail. Host disk still uses json-file 1m/1.

Do not embed this follow-up commit's own SHA here.

## Commands executed (authoring host, R2)

| Check | Result |
|---|---|
| `node --test tests/*.test.js` on `df67592` | **92 pass / 0 fail** (Node v22.19.0) |
| `node --test tests/*.test.js proofs/*.test.js` (this follow-up, pre-push) | **95 pass / 0 fail** (Node v22.19.0, npm 11.5.2, PostgreSQL 16.15, Redis 7.0.15) |
| `actionlint` 1.7.7 | exit 0 |
| YAML parse | exit 0 |
| classifier self-test | 40/40 |
| `git diff --check` | exit 0 |
| `isolation-proof.mjs` locally | exit 2 `isolation_unavailable_docker_missing` (expected) |
| Live Claude / runner `workflow_dispatch` | **not executed** |

Exact-head CI on `df67592` (event `pull_request`, `head_sha` equals that commit):

| Job | Result |
|---|---|
| Classify + Heavy + Gate run [35998517064](https://github.com/Vedang1998/Stocky/actions/runs/35998517064) | SUCCESS |
| Isolation proof run [35998517100](https://github.com/Vedang1998/Stocky/actions/runs/35998517100) job [107629155252](https://github.com/Vedang1998/Stocky/actions/runs/35998517100/job/107629155252) | **FAILURE** (`gateway_mutation_revived=false`, `sqlOk=false`; timeout/orphan/jail/pins/hash passed) |

Follow-up exact-head Classify + Heavy + Gate + isolation_proof: recorded in the task result after push; not this commit's own SHA.

## Original RUNNER-01 authoring (pre-R1, SHA-bound)

On `7139a10`: `node --test` **70 pass / 0 fail**; actionlint 1.7.7 exit 0; YAML parse exit 0; classifier 40/40; Node v22.19.0; npm 11.5.2; PostgreSQL 16.15; Redis 7.0.15. Those counts do not describe the R1 tree.

## Claude review handoff

Review the exact live PR head after green exact-head CI **and** green `isolation_proof` on that head. Do not let this runner review itself. Verify Docker is the MCP `run_probe` executor, publisher is a separate no-OAuth job, image refs are digest-pinned, and activation remains off.

## Explicit stop

No other PR was started, merged, or closed. Application runtime, Shopify, `ci.yml`, and production were not touched. The PR remains draft. The runner is not activated. `STOCKY_CLAUDE_REVIEW_RUNNER` was not set.
