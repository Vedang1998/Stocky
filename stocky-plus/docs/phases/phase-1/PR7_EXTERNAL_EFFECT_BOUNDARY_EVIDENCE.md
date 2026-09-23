# Phase 1 PR7 — External-effect and recovery boundary evidence

**Status:** `PR7 FINAL BOUNDARY EVIDENCE — EFFECTS PACKET CORRECTED FOR F-CLAUDE-PR7PR49-01 — NO RUNTIME AUTHORIZED`

**IDs:** new `EFF-X-*`. Sealed PR48 Helper B `PREP_B_*` / coordinator `PREP-B-*` are prior evidence only. `EFF-X-02d` is the published check-to-write interleaving (negative evidence).

**Production / PR7 runtime / Shopify inventory writes:** NOT AUTHORIZED. Private Redis + owned scratch only. No FLUSHALL.

| Pin | Value |
|---|---|
| Base X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` |
| Branch | `cursor/planning-pr7-final-boundary-evidence-20260920-b58d` |
| Starting PR49 E | `d63629077fcf29775c69161372c2cf903cfa62c6` |
| Prior PR45 S (historical) | `fd5f7bbdf18fa12d75371686d8969d67fe68a158` |
| Frozen PR45 H (read-only) | `3cc2045107b54601c6b0e43c8690b7d090074b80` |
| Claude artifact (unchanged) | `0677ef0a283b302e705a1a663d8b26582c239984` sole parent H; blob `4bb936918c65ab6399f080d31b8f3bcf61ac96d1` |
| PR48 sealed (read-only) | `c97adda285b5625836a582deb03983099a7b3461` |
| Correction authority | issue52 comments `5794206091` / `5794208220`; finding `F-CLAUDE-PR7PR49-01` P2 |
| Helper B | `bc-314739fc-ee36-57f8-96d8-3a79b8510352` (isolated checkout; Redis 17379 PID 3114 torn down by that helper) |
| Coordinator rerun Redis | `127.0.0.1:18379` PID 5533, prefix/queue `pr7finalCoord:` / `pr7finalCoord-effects` (historical) |
| publication-worker.mjs | sha256 `4394d813bff34b8196be9c249b4c325793e60b492682a42c5e3f4fdd76bb53c7` — **byte-unmodified** |
| Node / Redis / BullMQ | `v22.14.0` / Redis 7.0.15 / `bullmq@5.81.2` / `ioredis@5.11.1` |

Classification:

- **EXISTING X** — current Redis workers have no generation/shop publication fence; D `live_writer` is process-local; export is HTTP CSV.
- **MODELED PROPOSED** — standalone harness with `CHECK_*_FENCE=1`. This is **check-then-act**, not an atomic fence: it re-reads generation, then re-reads shop fence, then writes. A check immediately before publication is insufficient across the in-flight window (EFF-X-02d). Not repository runtime.
- **UNEXECUTED APPLICATION INTEGRATION** — no installed privacy coordinator, no remote object store, no `removeShopQueueJobsExceptPrivacy`. Negative model evidence does **not** prove runtime is fixed.

TTL, queue status, PID death, and `quiescenceConfirmed` are **not** drain. Evidence is **observed writes / residual files / X classifier**, not job exit 0.

PR6 is CLOSED on X. Do not reopen PR6 because EFF-X-09 shows process-local `live_writer`. PR7 must supply external quiescence. Phase 1 IN PROGRESS. R-176 OPEN/P0. R-164 unchanged. Q-008 OPEN. D-054 / no D-055. No runtime authorized.

This document does not implement PR7 processors outside the repository. The publication worker is a labelled feasibility harness for the already-declared publication/drain boundary.

---

## 1. Pins (EXISTING X)

| File | sha256 |
|---|---|
| `app/sync/queue-presence.server.ts` | `a5f032ad54f3a528fb06325b815ef3e635382f586335ac409ead11143bde8dcd` |
| `app/jobs/queue.server.ts` | `0f58679a3f515d19a6660abfde998224a3dfb3fb87bc54965fd743d0ac23f116` |
| `app/lib/order-facts/sync/source-stage.ts` | `6788141488edbf7c4b53490ed81d6c43ce5420262b6f1eff69a4fea900fa0f67` |
| `app/routes/app.analytics_.export.tsx` | `e4d773b441746167fd2f7ab9de40a3a0597cb3d166b408585ab8985c2281b347` |
| `app/sync/dispatcher.server.ts` | `b9ae09fd36327c55ab884280308266d2edaf5e7fcf66ab5c54ff3ae70aa17b6e` |
| `app/sync/lifecycle.server.ts` | `543004bd2e83b8f95561135d45febce2487868ecd16bf9e9d4da17cc92732e1b` |
| `package-lock.json` | `6e3fbc2e7c22f74696bfa9871faadd120051e766b1dedea917dc5d032db7016d` |

X primitives actually imported:

| Primitive | Path | Used |
|---|---|---|
| `classifyExistingQueueJob` / `inspectQueueDispatchPresence` / `RUNNABLE_BULLMQ_STATES` | `queue-presence.server.ts` | yes |
| `requireRedisUrl`, `WEBHOOK_QUEUE`, `CRON_QUEUE` | `queue.server.ts` | import + `requireRedisUrl()`; **not** `getWebhookQueue()` singleton |
| `inspectDScratchOccupancy` / `reclaimOperatorSelectedDScratch` / `createOwnedScratchDir` / `disposeOwnedScratch` / `reinitializeDScratchReservationLedgerAfterQuiescence` / `sanitizeDScratchOccupancy` | `source-stage.ts` | yes |

X names `WEBHOOK_QUEUE="stocky-webhooks"` / `CRON_QUEUE="stocky-cron"` loaded as constants. Live Queue/Worker used unique probe queues (`pr7finalB-effects` historically; `pr7finalCoord-effects` on coordinator rerun) so leftover 6379 keys cannot collide. Port 6379 remained `connect_ex=111`.

`requireRedisUrl()` fail-closed without `REDIS_URL`. Dispatcher ~1373–1390 still writes when `!processingEnabled` (`shop_disabled` outcome still enqueues). `processingEnabled` is admission, not drain.

X export route is HTTP CSV after `requireAdminTenant`. No S3/R2/GCS module on X.

D scratch `live_writer` is in-process map **or** `marker.pid === process.pid`. Other PIDs are not treated as live writers. Operator runbook: `quiescenceConfirmed` is an admission token.

---

## 2. Historical helper isolation vs published rerun

Helper B FACT: exclusive checkout `/tmp/pr7-final-helpers/B` at X, porcelain empty, Redis 17379 PID 3114, prefix `pr7finalB:`. That Redis was SIGTERM'd by Helper B teardown. Those `/tmp` paths are **not** required rerun inputs.

Published probes parameterize `STOCKY_PLUS_ROOT`, `STOCKY_NODE_MODULES`, `PROOF_ROOT`, `REDIS_URL`, `PROBE_OUT`, `PROBE_SCRATCH`. Git HEAD is recorded when a worktree exists; `git archive` records `git_absent_export` and relies on file SHA-256 pins (`check_pins.py` / `00-isolation.sh`).

Coordinator disposable setup problem (retained): first parameterized `scratch-park-child.ts` used top-level await; tsx compiled it as CJS (`Transform failed ... Top-level await is currently not supported with the "cjs" output format`). EFF-X-08 had already passed; EFF-X-09 timed out waiting for `parked`. The child was rewritten to `scratch-park-child.mjs` (async `main`, no TLA). Authoritative 04 JSON is the successful rerun (`fatal: null`). Failed attempt saved historically as `04-dscratch-park-timeout.json` / `park-child-tla-cjs.log` under coordinator `/tmp` (not a required extract).

Sink SHA-256 includes `Date.now()` and pid and is **not** a portable expected digest. Portable digest is `expected_taxonomy.json` (assertion / existence / classifier status).

---

## 3. Schedule results

Prior coordinator parameterized rerun established EFF-X-00…13 (23 ids). This correction adds **EFF-X-02d** (24 ids). Portable digest is `expected_taxonomy.json`. Helper B original 18/18 hashes remain historical.

| ID | Schedule | Label | Assertion | Observed residual |
|---|---|---|---|---|
| EFF-X-01 | pause before publication | EXISTING X | PASS | Worker at gate with credential/path; sink **absent**; classifier `RUNNABLE_EXISTING`/`active` ≠ drain |
| EFF-X-01b | then vs now | EXISTING X | PASS | After GO, sink **observed** |
| EFF-X-02a | barrier **before** check | MODELED PROPOSED | PASS | gen flipped to `gen-2` at the gate, **before** the fence read; refuse marker; sink residual **absent**. Stale at check time. |
| EFF-X-02b | same ordering | EXISTING X | PASS | Same flip; unfenced worker **landed** |
| EFF-X-02c | barrier **after** write | MODELED PROPOSED | PASS | Write observed, then gen→`gen-2`; sink **still present** (cannot un-write) |
| EFF-X-02d | barrier **between** last fence read and sink write | MODELED PROPOSED | PASS | **NEGATIVE evidence.** Shop-fence FIFO holds the worker after the generation check; gen-1→gen-2 then unblock; sink **lands** with payload `generation: "gen-1"` while current is `gen-2`. Worker byte-unmodified (`4394d813…`). Post-flip retry refuses; unrelated shop-B with current generation still writes. |
| EFF-X-03 | SIGKILL + lost ack | EXISTING X | PASS | Worker PID gone; sink remains; classifier `RUNNABLE_EXISTING`/`active`; **no** `.done`. **Not power-loss.** Cite PREP_B_08 |
| EFF-X-04a | stale gen-1 vs current gen-2 | EXISTING X | PASS | Unfenced worker wrote gen-1 sink |
| EFF-X-04b | same payload | MODELED PROPOSED | PASS | Stale at **check** time: refuses; no sink. Does not close the in-flight window (EFF-X-02d). |
| EFF-X-05 | enumerate then write | EXISTING X | PASS | Enumerated zero `.sink` at gate; after GO write **observed** |
| EFF-X-06a | active `Job.remove` | EXISTING X | PASS | state `active`; throw `locked by another worker`; **11 ticks after**; presence still `RUNNABLE_EXISTING`/`active`. Cite PREP_B_06b |
| EFF-X-06b | waiting `Job.remove` | EXISTING X | **INCONCLUSIVE** | Waiting remove → `MISSING`; this jobId sink absent. Not converted to drain PASS. Cite PREP_B_06 |
| EFF-X-07a | both shops | EXISTING X | PASS | shop-A and shop-B sinks **both observed** |
| EFF-X-07b | shop-A fenced | MODELED PROPOSED | PASS | Whole-shop `ERASING` only: shop-A refuse marker; shop-B sink **observed**. **No customer-target fence.** |
| EFF-X-07c | scoped remove | EXISTING X | PASS | Removed shop-A customer `191167`; shop-B and customer `191168` **wrote**. `flushall_executed: false`. jobId isolation ≠ privacy gate |
| EFF-X-08 | unknown reclaim | EXISTING X | PASS | markerless skipped `not_verified_d_resource`; live att skipped `live_writer`; `operatorInterventionRequired: true`. Request stays incomplete |
| EFF-X-09 | foreign reclaim vs live child | EXISTING X | PASS | Child alive; parent `quiescenceConfirmed: true` **deleted** live `att-*`; `dir_exists_after_foreign_reclaim: false`. Process-local `live_writer`. **Do not reopen PR6.** |
| EFF-X-10a | missing ledger | EXISTING X | PASS | `ledgerIntegrity` not ok; reinit while att-* → `scratch_resource_exhausted` |
| EFF-X-10b | unknown attempts | EXISTING X | PASS | `unknownAttemptCount >= 1`, intervention required |
| EFF-X-10c | token ≠ drain | EXISTING X | PASS | Do not auto-call reclaim as privacy drain |
| EFF-X-11 | TTL counterexample | EXISTING X | PASS | Hint TTL expires; worker still ticking |
| EFF-X-12 | decoy PID | EXISTING X | PASS | Killed decoy; real worker alive; Redis `RUNNABLE_EXISTING` |
| EFF-X-13 | positive drain **of that job** | EXISTING X | PASS | `.done` + classifier `TERMINAL_EXISTING`/`completed` + sink present. **Not shop-wide drain.** |
| EFF-X-00 | export inventory | UNEXECUTED app integration | UNEXECUTED | HTTP CSV after `requireAdminTenant`. No object-store module. Simulator ≠ remote object store |

PostgreSQL advisory locks and RLS do **not** fence Redis jobs, export publication, or D scratch bytes. Frozen H §7.6.2 restriction 2: actual publication must be **serialized with the privacy barrier**, **or** the sink must enforce generation/target fencing, **or** that specific writer and outstanding I/O must be **positively drained**. A check immediately before an external write is not by itself atomic fencing. Completeness is not proved by this model.

Not drain: `Job.remove`, CANCELLED labels, TTL, decoy PID, process-local `live_writer`, occupancy alone, `quiescenceConfirmed: true`, `processingEnabled`.

---

## 4. MODELED PROPOSED vs EXISTING X vs UNEXECUTED

The publication worker (`probes/publication-worker.mjs`, sha256 `4394d813…`) is **not** an application processor and was **not** modified to close F-CLAUDE-PR7PR49-01. When `CHECK_GENERATION_FENCE=0` / `CHECK_SHOP_FENCE=0` it documents EXISTING X (late writes land). When those flags are `1` it is check-then-act: re-read generation, re-read shop fence, then write. That is **not** an atomic fence.

Controls preserved:

- barrier-before-check refuses (EFF-X-02a);
- barrier-after-write cannot un-write (EFF-X-02c);
- post-flip retry refuses when stale at check (EFF-X-04b and EFF-X-02d retry);
- unrelated tenant can still progress (EFF-X-07b; EFF-X-02d shop-B).

EFF-X-02d is the missing schedule: the generation barrier commits **after** the last modeled fence read and **before** the sink mutation. The stale write lands. The modeled shop fence is `fence[shopId] === "ERASING"` — **whole-shop only**. It does not prove a customer-target fence. EFF-X-06b remains **INCONCLUSIVE**. SIGKILL residual remains a pre-death write (EFF-X-03).

Installing serialized publication, sink-enforced generation/target fencing, or positive drain of that writer in `stocky-webhooks` / `stocky-cron` / privacy processors remains **UNEXECUTED APPLICATION INTEGRATION**. Negative model evidence does not prove runtime is fixed.

X has no generation-fenced Redis API. `Job.remove` of an active locked BullMQ 5.81.2 job throws and the worker keeps writing (EFF-X-06a). Waiting-job remove is INCONCLUSIVE as drain (EFF-X-06b).

Accepted X `reclaimOperatorSelectedDScratch` is operator-only with **external** namespace-wide quiescence as a precondition. EFF-X-09 shows violating that precondition deletes a live child's `att-*`. Document the integration hazard; do not invent a successful execution of the precondition; do not silently revoke D acceptance.

---

## 5. Unexecuted / UNVERIFIED

- Live Shopify / merchant data / Admin GraphQL
- Live object storage (S3/R2/GCS)
- Power-loss / host crash / `fsync` disk failure (SIGKILL only)
- Application `getWebhookQueue` / `createWebhookWorker` / uninstall `cancelAllCancellable` against this Redis
- Installed PR7 coordinator/processors/adapters
- Helper A trees; distro Redis 6379; historical helper ports 16379/16380/17379 during coordinator rerun

---

## 6. Reproduction from this document

Convention `pr7-proof-extract-v1`. Start a **private** Redis on a non-6379 port. Do not FLUSHALL. Do not pkill.

```bash
DOC=stocky-plus/docs/phases/phase-1/PR7_EXTERNAL_EFFECT_BOUNDARY_EVIDENCE.md
EXTRACT=/tmp/pr7-eff-extracted
# Bootstrap 00_extract_proofs.py from PROOF-EXTRACT comments (same convention as the auth packet).
python3 "$EXTRACT/00_extract_proofs.py" --doc "$DOC" --selftest
python3 "$EXTRACT/00_extract_proofs.py" --doc "$DOC" --dest "$EXTRACT"
REDIS_DIR=/tmp/pr7-eff-redis
mkdir -p "$REDIS_DIR"
redis-server --port 18379 --bind 127.0.0.1 --dir "$REDIS_DIR" \
  --dbfilename dump.rdb --daemonize yes --protected-mode no --save "" --appendonly no \
  --pidfile "$REDIS_DIR/redis.pid"
export STOCKY_PLUS_ROOT=/path/to/stocky-plus
export STOCKY_NODE_MODULES="$STOCKY_PLUS_ROOT/node_modules"
# Local disposable Redis on 127.0.0.1 port 18379 (not 6379). The env name is the one X requireRedisUrl reads.
export REDIS_URL="redis://127.0.0.1:18379"  # pragma: allowlist secret
export RESULTS_DIR=/tmp/pr7-eff-results
bash "$EXTRACT/reproduce.sh"
# Optional: TEARDOWN_REDIS=1 REDIS_PID_FILE=$REDIS_DIR/redis.pid PROBE_OUT=$RESULTS_DIR/99-teardown.json \
#   bash "$EXTRACT/probes/99-teardown.sh"
```

`check_pins.py` fail-closes on lockfile / X file hash mismatch. Isolation records 6379 `connect_ex`. Unique `PROBE_QUEUE_NAME` avoids `stocky-webhooks` / `stocky-cron`.

Negative controls: extraction self-test; 6379 unused; EFF-X-02d stale in-flight write **lands**; EFF-X-02a refuse when stale at check; EFF-X-06a locked throw; EFF-X-11 TTL while ticking; EFF-X-12 decoy PID; EFF-X-09 foreign `quiescenceConfirmed`; EFF-X-00 UNEXECUTED export.

---

## 7. Remaining ChatGPT entry decisions (blocked for runtime)

- Actual publication must be serialized with the privacy barrier, **or** the sink must enforce generation/target fencing, **or** that specific writer and outstanding I/O must be positively drained (frozen H §7.6.2 restriction 2). Check-then-act proximity is not that contract (EFF-X-02d).
- Modeled shop fence is whole-shop only; a customer-target fence is not proved and is not implemented here.
- External (cross-process) quiescence before `reclaimOperatorSelectedDScratch`. Do not treat `quiescenceConfirmed` as liveness.
- Export residual: HTTP CSV is current X inventory, not proof historical object-store bytes never existed.
- Do not treat `Job.remove`, TTL, PID, or a caller quiescence boolean as drain.

This packet does not invent those decisions. It does not implement PR7 processors. Negative EFF-X-02d evidence does not authorize runtime.

---

## 8. Teardown

Coordinator Redis PID 5533 on 18379 remains until an explicit `TEARDOWN_REDIS=1` of **that** PID. Distro 6379 was never started (`connect_ex=111`). FLUSHALL was not executed. pkill was not executed. Helper A files were not deleted. Worker PIDs started by probes were SIGKILL'd by those probes' `ownedPids` finally blocks.

Helper B historical teardown (PID 3114 / port 17379) is recorded in sealed PR48/helper outputs; it is not this rerun.

---

## Appendix — extractable proof inputs

Bootstrap `00_extract_proofs.py` from the HTML comments below, then extract and hash-verify every `proof_manifest.json` path.


### EXTRACT `proof_manifest.json`

<!-- PROOF-EXTRACT:begin path=proof_manifest.json -->
```json
{
  "version": "pr7-proof-extract-v1",
  "kind": "external-effects",
  "base_x": "f057d98c8a321b3e06875a6e9a83b787bcbc101f",
  "files": [
    {
      "path": "check_pins.py",
      "sha256": "2e72f9acea7058873a08735c53ac398bc9ad8bad032d178d8d1eef6a1c3282ff",
      "bytes": 2741
    },
    {
      "path": "expected_taxonomy.json",
      "sha256": "094a05f45e5f9b28d523f2ff9bd63454b2ae0662ea00f40e91a527eb3b80783a",
      "bytes": 2729
    },
    {
      "path": "probes/00-isolation.sh",
      "sha256": "0a20df3336127b1d61e2748224ceee0cd1a9586f6c7211c89477ac26cd50451c",
      "bytes": 5822
    },
    {
      "path": "probes/01-publication-boundary.mjs",
      "sha256": "dbdceb363163e6a7c6c4d9c74304277715069c508a0acec4f6a0496c0832db56",
      "bytes": 25337
    },
    {
      "path": "probes/02-remove-death-ttl-drain.mjs",
      "sha256": "cd5c022230b3ee48a30195d556689f3903b6e0d063a39320160fbe7815839829",
      "bytes": 17673
    },
    {
      "path": "probes/03-shop-isolation.mjs",
      "sha256": "64b896c921b15ec3aed3174d2215f8edbac8ddabcbbdbb151a81ea327cc6dbd1",
      "bytes": 10066
    },
    {
      "path": "probes/04-dscratch.mjs",
      "sha256": "cb04d2ec83e316e5c050a8df3a3a65ec573f295daaaffacadf88c395a9456bf0",
      "bytes": 11021
    },
    {
      "path": "probes/99-teardown.sh",
      "sha256": "ba5be75a3001309c2349d983f60a819efcfe4751d24058b036808c47ca1fbc54",
      "bytes": 2663
    },
    {
      "path": "probes/_import-check.mjs",
      "sha256": "437f3d8f518b4880894be4317b2e4e6fe93c9799a63fd615983bcfa046b4cf45",
      "bytes": 1854
    },
    {
      "path": "probes/assert_taxonomy.mjs",
      "sha256": "40d86193de245cdc148d0ab3736ace68aa96a4a72fda13009f9ff7c90401b26d",
      "bytes": 2268
    },
    {
      "path": "probes/probe-lib.mjs",
      "sha256": "0bb3df0be1fcb715c38481da190c73c61f7d59f9a089a2a1d4f57ccbee44b7f8",
      "bytes": 6909
    },
    {
      "path": "probes/publication-worker.mjs",
      "sha256": "4394d813bff34b8196be9c249b4c325793e60b492682a42c5e3f4fdd76bb53c7",
      "bytes": 7480
    },
    {
      "path": "probes/run.sh",
      "sha256": "12dbbc2e1be0c4601d56a1992cc226d6f834e557cdfc89d343c9db538b0811b4",
      "bytes": 2038
    },
    {
      "path": "probes/scratch-park-child.mjs",
      "sha256": "8b513b383287fd3e26f37dffac012e07ce9828e900ce5d5e1edf0088f2d88111",
      "bytes": 2468
    },
    {
      "path": "reproduce.sh",
      "sha256": "e4c94460876e853b8a1c0a389d8fe0f2f45765a17b45fd957d39a5861ed5153b",
      "bytes": 627
    }
  ]
}
```
<!-- PROOF-EXTRACT:end path=proof_manifest.json -->

### EXTRACT `00_extract_proofs.py`

<!-- PROOF-EXTRACT:begin path=00_extract_proofs.py -->
#!/usr/bin/env python3
"""Extract PR7 disposable proof inputs from an evidence Markdown document.

Convention (pr7-proof-extract-v1):
- UTF-8, LF newlines.
- Each file is bounded by HTML comments on their own lines:
    <!-- PROOF-EXTRACT:begin path=relative/path -->
    optional one markdown fence (```lang ... ```)
    <!-- PROOF-EXTRACT:end path=relative/path -->
- The hashed bytes are the fence interior (if present) plus a terminating
  newline if the interior did not already end with one. Interior bytes are
  otherwise unmodified.
- A hash row is not the source. Missing, truncated, extra, or digest-mismatched
  blocks fail closed before any proof is run.

Not PR7 runtime. Not a hidden /tmp repair.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

BEGIN_RE = re.compile(r"^<!-- PROOF-EXTRACT:begin path=([^\s]+) -->\s*$")
END_RE = re.compile(r"^<!-- PROOF-EXTRACT:end path=([^\s]+) -->\s*$")
FENCE_OPEN_RE = re.compile(r"^```[a-zA-Z0-9_-]*\s*$")
MANIFEST_PATH = "proof_manifest.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode_utf8_lf(data: bytes, label: str) -> str:
    if b"\r" in data:
        raise SystemExit(f"extraction_crlf_forbidden:{label}")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SystemExit(f"extraction_not_utf8:{label}:{exc}") from exc


def strip_one_fence(body: str, path: str) -> str:
    lines = body.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    if len(lines) >= 2 and FENCE_OPEN_RE.match(lines[0]) and lines[-1].strip() == "```":
        interior = "\n".join(lines[1:-1])
        if not interior.endswith("\n"):
            interior += "\n"
        return interior
    if body and not body.endswith("\n"):
        body += "\n"
    return body


def extract_blocks(markdown: str) -> dict[str, str]:
    lines = markdown.split("\n")
    blocks: dict[str, str] = {}
    i = 0
    while i < len(lines):
        m = BEGIN_RE.match(lines[i])
        if not m:
            i += 1
            continue
        path = m.group(1)
        if path in blocks:
            raise SystemExit(f"extraction_duplicate_block:{path}")
        i += 1
        start = i
        found_end = False
        while i < len(lines):
            em = END_RE.match(lines[i])
            if em:
                if em.group(1) != path:
                    raise SystemExit(
                        f"extraction_end_path_mismatch:{path}:{em.group(1)}"
                    )
                found_end = True
                break
            i += 1
        if not found_end:
            raise SystemExit(f"extraction_truncated_block:{path}")
        body = "\n".join(lines[start:i]) + "\n"
        blocks[path] = strip_one_fence(body, path)
        i += 1
    if not blocks:
        raise SystemExit("extraction_no_blocks")
    return blocks


def load_manifest(text: str) -> dict:
    try:
        man = json.loads(text)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"extraction_manifest_invalid:{exc}") from exc
    if man.get("version") != "pr7-proof-extract-v1":
        raise SystemExit("extraction_manifest_version")
    files = man.get("files")
    if not isinstance(files, list) or not files:
        raise SystemExit("extraction_manifest_empty")
    return man


def verify_and_write(
    blocks: dict[str, str], manifest: dict, dest: Path, *, write: bool
) -> None:
    declared = []
    for row in manifest["files"]:
        path = row["path"]
        digest = row["sha256"]
        declared.append(path)
        if path not in blocks:
            raise SystemExit(f"extraction_missing_block:{path}")
        got = sha256_bytes(blocks[path].encode("utf-8"))
        if got != digest:
            raise SystemExit(
                f"extraction_digest_mismatch:{path}:declared={digest}:got={got}"
            )
        if write:
            out = dest / path
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(blocks[path].encode("utf-8"))
    extras = sorted(p for p in blocks if p not in set(declared))
    allowed_extra = {MANIFEST_PATH, "00_extract_proofs.py"}
    unexpected = [p for p in extras if p not in allowed_extra]
    if unexpected:
        raise SystemExit("extraction_unlisted_block:" + ",".join(unexpected))
    if MANIFEST_PATH not in blocks:
        raise SystemExit("extraction_manifest_block_missing")
    if write:
        man_out = dest / MANIFEST_PATH
        man_out.write_bytes(blocks[MANIFEST_PATH].encode("utf-8"))


def extract_from_doc(doc: Path, dest: Path, *, write: bool = True) -> dict:
    markdown = decode_utf8_lf(doc.read_bytes(), str(doc))
    blocks = extract_blocks(markdown)
    if MANIFEST_PATH not in blocks:
        raise SystemExit("extraction_manifest_block_missing")
    manifest = load_manifest(blocks[MANIFEST_PATH])
    if write:
        dest.mkdir(parents=True, exist_ok=True)
    verify_and_write(blocks, manifest, dest, write=write)
    return {"files": sorted(blocks), "dest": str(dest)}


def bootstrap_extractor(doc: Path, dest: Path) -> Path:
    markdown = decode_utf8_lf(doc.read_bytes(), str(doc))
    blocks = extract_blocks(markdown)
    path = "00_extract_proofs.py"
    if path not in blocks:
        raise SystemExit("extraction_extractor_block_missing")
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / "00_extract_proofs.py"
    out.write_bytes(blocks[path].encode("utf-8"))
    return out


SELFTEST_NEEDLE = "probes/run.sh"


def selftest(doc: Path) -> None:
    markdown = decode_utf8_lf(doc.read_bytes(), str(doc))
    blocks = extract_blocks(markdown)
    man = load_manifest(blocks[MANIFEST_PATH])
    verify_and_write(blocks, man, Path("/tmp"), write=False)

    def expect_fail(label: str, mutated: str, needle: str) -> None:
        try:
            b = extract_blocks(mutated)
            if MANIFEST_PATH in b:
                m = load_manifest(b[MANIFEST_PATH])
                verify_and_write(b, m, Path("/tmp"), write=False)
            raise SystemExit(f"extraction_selftest_should_fail:{label}")
        except SystemExit as exc:
            msg = str(exc)
            if msg.startswith("extraction_selftest_should_fail"):
                raise
            if needle not in msg:
                raise SystemExit(f"extraction_selftest_wrong_error:{label}:{msg}") from exc

    missing = markdown.replace(
        f"path={SELFTEST_NEEDLE}",
        f"path={SELFTEST_NEEDLE}.MISSING",
        2,
    )
    expect_fail("missing_block", missing, "extraction_missing_block")

    seed_end = f"<!-- PROOF-EXTRACT:end path={SELFTEST_NEEDLE} -->"
    idx = markdown.find(seed_end)
    if idx < 0:
        raise SystemExit("extraction_selftest_run_sh_end_missing")
    trunc = markdown[:idx]
    expect_fail("truncated_block", trunc, "extraction_truncated_block")

    mismatch = markdown.replace(
        f"<!-- PROOF-EXTRACT:begin path={SELFTEST_NEEDLE} -->",
        f"<!-- PROOF-EXTRACT:begin path={SELFTEST_NEEDLE}.not_in_manifest -->",
        1,
    ).replace(
        f"<!-- PROOF-EXTRACT:end path={SELFTEST_NEEDLE} -->",
        f"<!-- PROOF-EXTRACT:end path={SELFTEST_NEEDLE}.not_in_manifest -->",
        1,
    )
    expect_fail("unlisted_or_missing", mismatch, "extraction_")

    bad_man = blocks[MANIFEST_PATH]
    man_obj = json.loads(bad_man)
    man_obj["files"][0]["sha256"] = "0" * 64
    poisoned_man = json.dumps(man_obj, indent=2) + "\n"
    poisoned_md = markdown.replace(bad_man, poisoned_man, 1)
    expect_fail("bad_digest", poisoned_md, "extraction_digest_mismatch")
    print("extraction_selftest_ok")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", required=True, help="Path to evidence Markdown")
    ap.add_argument("--dest", default="", help="Directory to write extracted files")
    ap.add_argument("--bootstrap-only", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--verify-only", action="store_true")
    args = ap.parse_args()
    doc = Path(args.doc)
    if args.selftest:
        selftest(doc)
        return 0
    dest = Path(args.dest) if args.dest else Path.cwd()
    if args.bootstrap_only:
        out = bootstrap_extractor(doc, dest)
        print(json.dumps({"bootstrap": str(out)}))
        return 0
    result = extract_from_doc(doc, dest, write=not args.verify_only)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
<!-- PROOF-EXTRACT:end path=00_extract_proofs.py -->

### EXTRACT `check_pins.py`

<!-- PROOF-EXTRACT:begin path=check_pins.py -->
```python
#!/usr/bin/env python3
"""Verify X lockfile and selected file SHA-256 pins. Fail closed on mismatch."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

LOCKFILE = "6e3fbc2e7c22f74696bfa9871faadd120051e766b1dedea917dc5d032db7016d"
AUTH_FILES = {
    "app/shopify.server.ts": "21b881203e64f30811708fd87cb935eff371a5f79b4c114c7b516c5c4f429b58",
    "app/tenant/require-admin-tenant.server.ts": "8b697bfbbbaa8670450077138ed9341871f1040e3812cf1ebb91fe55effc629e",
    "package-lock.json": LOCKFILE,
}
EFF_FILES = {
    "app/sync/queue-presence.server.ts": "a5f032ad54f3a528fb06325b815ef3e635382f586335ac409ead11143bde8dcd",
    "app/jobs/queue.server.ts": "0f58679a3f515d19a6660abfde998224a3dfb3fb87bc54965fd743d0ac23f116",
    "app/lib/order-facts/sync/source-stage.ts": "6788141488edbf7c4b53490ed81d6c43ce5420262b6f1eff69a4fea900fa0f67",
    "app/routes/app.analytics_.export.tsx": "e4d773b441746167fd2f7ab9de40a3a0597cb3d166b408585ab8985c2281b347",
    "package-lock.json": LOCKFILE,
}
AUTH_LIBS = {
    "@shopify/shopify-app-react-router/dist/esm/server/authenticate/admin/authenticate.mjs": "87b9721b8f27e265194b25642c36fcac6eb700b31cd0a5fa7a2efe64825b73e0",
    "@shopify/shopify-app-react-router/dist/esm/server/authenticate/admin/strategies/token-exchange.mjs": "9a7539a4ee929701639c1b6f7d7bdb08518ce6cffd660e97cb6ddd5a0da0d354",
}


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=["auth", "effects"], required=True)
    ap.add_argument("--stocky-plus-root", required=True)
    ap.add_argument("--node-modules", required=True)
    args = ap.parse_args()
    root = Path(args.stocky_plus_root)
    nm = Path(args.node_modules)
    files = AUTH_FILES if args.kind == "auth" else EFF_FILES
    mismatches = []
    for rel, expected in files.items():
        got = sha256(root / rel)
        if got != expected:
            mismatches.append({"path": rel, "expected": expected, "got": got})
    if args.kind == "auth":
        for rel, expected in AUTH_LIBS.items():
            got = sha256(nm / rel)
            if got != expected:
                mismatches.append(
                    {"path": f"node_modules/{rel}", "expected": expected, "got": got}
                )
    if mismatches:
        print(json.dumps({"ok": False, "mismatches": mismatches}, indent=2))
        return 1
    print(json.dumps({"ok": True, "kind": args.kind, "lockfile": LOCKFILE}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```
<!-- PROOF-EXTRACT:end path=check_pins.py -->

### EXTRACT `expected_taxonomy.json`

<!-- PROOF-EXTRACT:begin path=expected_taxonomy.json -->
```json
{
  "version": "pr7-effects-taxonomy-v1",
  "note": "Portable assertions are existence/classifier/PASS-FAIL. Sink SHA-256 includes Date.now()/pid and is NOT a portable digest.",
  "cases": {
    "EFF-X-00": { "assertion": "UNEXECUTED", "label": "UNEXECUTED_APPLICATION_INTEGRATION" },
    "EFF-X-01": { "assertion": "PASS", "label": "EXISTING_X", "sink_absent_at_gate": true },
    "EFF-X-01b": { "assertion": "PASS", "label": "EXISTING_X", "write_observed": true },
    "EFF-X-02a": { "assertion": "PASS", "label": "MODELED_PROPOSED", "late_write_landed": false },
    "EFF-X-02b": { "assertion": "PASS", "label": "EXISTING_X", "late_write_landed": true },
    "EFF-X-02c": { "assertion": "PASS", "label": "MODELED_PROPOSED", "late_write_landed": true },
    "EFF-X-02d": {
      "assertion": "PASS",
      "label": "MODELED_PROPOSED",
      "late_write_landed": true,
      "payload_generation": "gen-1",
      "current_generation_at_write": "gen-2",
      "check_then_act_window_open": true,
      "sink_absent_immediately_before_generation_flip": true,
      "post_flip_retry_refused": true,
      "unrelated_shop_b_write_observed": true,
      "customer_target_fence_modeled": false
    },
    "EFF-X-03": { "assertion": "PASS", "label": "EXISTING_X", "acknowledgement_lost": true, "classified": "RUNNABLE_EXISTING" },
    "EFF-X-04a": { "assertion": "PASS", "label": "EXISTING_X", "write_observed": true },
    "EFF-X-04b": { "assertion": "PASS", "label": "MODELED_PROPOSED", "write_observed": false, "refuse_observed": true },
    "EFF-X-05": { "assertion": "PASS", "label": "EXISTING_X", "write_observed": true },
    "EFF-X-06a": { "assertion": "PASS", "label": "EXISTING_X", "locked_throw_observed": true, "classified": "RUNNABLE_EXISTING" },
    "EFF-X-06b": { "assertion": "INCONCLUSIVE", "label": "EXISTING_X" },
    "EFF-X-07a": { "assertion": "PASS", "label": "EXISTING_X" },
    "EFF-X-07b": { "assertion": "PASS", "label": "MODELED_PROPOSED" },
    "EFF-X-07c": { "assertion": "PASS", "label": "EXISTING_X", "flushall_executed": false },
    "EFF-X-08": { "assertion": "PASS", "label": "EXISTING_X", "operatorInterventionRequired": true },
    "EFF-X-09": { "assertion": "PASS", "label": "EXISTING_X", "dir_exists_after_foreign_reclaim": false },
    "EFF-X-10a": { "assertion": "PASS", "label": "EXISTING_X" },
    "EFF-X-10b": { "assertion": "PASS", "label": "EXISTING_X", "operatorInterventionRequired": true },
    "EFF-X-10c": { "assertion": "PASS", "label": "EXISTING_X" },
    "EFF-X-11": { "assertion": "PASS", "label": "EXISTING_X" },
    "EFF-X-12": { "assertion": "PASS", "label": "EXISTING_X" },
    "EFF-X-13": { "assertion": "PASS", "label": "EXISTING_X", "classified": "TERMINAL_EXISTING" }
  }
}
```
<!-- PROOF-EXTRACT:end path=expected_taxonomy.json -->

### EXTRACT `probes/00-isolation.sh`

<!-- PROOF-EXTRACT:begin path=probes/00-isolation.sh -->
```bash
#!/usr/bin/env bash
# Isolation capture for published EFF-X proofs. Does not start or kill Redis.
# Git HEAD is recorded when present; git-archive exports record git_absent_export.
set -euo pipefail
: "${STOCKY_PLUS_ROOT:?}"
: "${REDIS_URL:?}"
: "${PROBE_OUT:?}"
STOCKY_NODE_MODULES="${STOCKY_NODE_MODULES:-$STOCKY_PLUS_ROOT/node_modules}"
mkdir -p "$(dirname "$PROBE_OUT")"
export STOCKY_PLUS_ROOT STOCKY_NODE_MODULES REDIS_URL PROBE_OUT
python3 - <<'PY'
import hashlib, json, os, socket, subprocess, urllib.parse
from pathlib import Path

out = Path(os.environ["PROBE_OUT"])
root = Path(os.environ["STOCKY_PLUS_ROOT"])
nm = Path(os.environ["STOCKY_NODE_MODULES"])
redis_url = os.environ["REDIS_URL"]
parsed = urllib.parse.urlparse(redis_url)
host = parsed.hostname or "127.0.0.1"
port = parsed.port or 6379

def connect_ex(p):
    s = socket.socket(); s.settimeout(0.3)
    try:
        return s.connect_ex(("127.0.0.1", p))
    finally:
        s.close()

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()

git = {"present": False, "head": "git_absent_export", "porcelain": "", "branch": "git_absent_export"}
repo = root.parent
try:
    inside = subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "--is-inside-work-tree"],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    if inside == "true":
        git = {
            "present": True,
            "head": subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip(),
            "porcelain": subprocess.check_output(["git", "-C", str(repo), "status", "--porcelain"], text=True),
            "branch": subprocess.check_output(["git", "-C", str(repo), "status", "-sb"], text=True).strip(),
        }
except subprocess.CalledProcessError:
    pass

info = subprocess.check_output(["redis-cli", "-h", host, "-p", str(port), "INFO", "server"], text=True)
pong = subprocess.check_output(["redis-cli", "-h", host, "-p", str(port), "ping"], text=True).strip()
files = {
    "queue-presence.server.ts": root / "app/sync/queue-presence.server.ts",
    "queue.server.ts": root / "app/jobs/queue.server.ts",
    "source-stage.ts": root / "app/lib/order-facts/sync/source-stage.ts",
    "PR6_D_SCRATCH_OPERATOR_RUNBOOK.md": root / "docs/phases/phase-1/PR6_D_SCRATCH_OPERATOR_RUNBOOK.md",
    "app.analytics_.export.tsx": root / "app/routes/app.analytics_.export.tsx",
    "package-lock.json": root / "package-lock.json",
}
lock = json.loads((root / "package-lock.json").read_text())
pkgs = lock.get("packages", {})
EXPECTED = {
    "package-lock.json": "6e3fbc2e7c22f74696bfa9871faadd120051e766b1dedea917dc5d032db7016d",
    "queue-presence.server.ts": "a5f032ad54f3a528fb06325b815ef3e635382f586335ac409ead11143bde8dcd",
    "queue.server.ts": "0f58679a3f515d19a6660abfde998224a3dfb3fb87bc54965fd743d0ac23f116",
    "source-stage.ts": "6788141488edbf7c4b53490ed81d6c43ce5420262b6f1eff69a4fea900fa0f67",
    "app.analytics_.export.tsx": "e4d773b441746167fd2f7ab9de40a3a0597cb3d166b408585ab8985c2281b347",
}
file_sha = {k: sha(v) for k, v in files.items()}
pin_ok = all(file_sha[k] == EXPECTED[k] for k in EXPECTED)
doc = {
    "kind": "EFF_X_ISOLATION",
    "base_x": "f057d98c8a321b3e06875a6e9a83b787bcbc101f",
    "git": git,
    "head_matches_x": git["head"] == "f057d98c8a321b3e06875a6e9a83b787bcbc101f" if git["present"] else None,
    "pin_ok": pin_ok,
    "node": subprocess.check_output(["node", "-v"], text=True).strip(),
    "redis_binary": subprocess.check_output(["redis-server", "--version"], text=True).strip(),
    "redis": {
        "url": redis_url,
        "info_process_id": int([l.split(":")[1] for l in info.splitlines() if l.startswith("process_id:")][0]),
        "tcp_port": int([l.split(":")[1] for l in info.splitlines() if l.startswith("tcp_port:")][0]),
        "redis_version": [l.split(":")[1] for l in info.splitlines() if l.startswith("redis_version:")][0],
        "bind": "127.0.0.1",
        "pong": pong,
        "prefix": os.environ.get("PROBE_KEY_PREFIX", "pr7finalB:"),
        "probe_queue": os.environ.get("PROBE_QUEUE_NAME", "pr7finalB-effects"),
        "flushall_executed": False,
    },
    "ports": {
        "6379_connect_ex": connect_ex(6379),
        str(port) + "_connect_ex": connect_ex(port),
    },
    "packages": {
        "bullmq_lockfile": pkgs.get("node_modules/bullmq", {}).get("version"),
        "bullmq_integrity": pkgs.get("node_modules/bullmq", {}).get("integrity"),
        "ioredis_lockfile": pkgs.get("node_modules/ioredis", {}).get("version"),
        "ioredis_integrity": pkgs.get("node_modules/ioredis", {}).get("integrity"),
        "bullmq_installed": json.loads((nm / "bullmq/package.json").read_text())["version"],
        "ioredis_installed": json.loads((nm / "ioredis/package.json").read_text())["version"],
    },
    "file_sha256": file_sha,
    "expected_sha256": EXPECTED,
    "lockfile_sha256": file_sha["package-lock.json"],
    "STOCKY_PLUS_ROOT": str(root),
    "STOCKY_NODE_MODULES": str(nm),
    "notes": [
        "Git HEAD/porcelain is historical helper FACT when present. git-archive reruns record git_absent_export and rely on file SHA-256 pins.",
        "Default distro Redis 6379 must remain unused. Unique probe queue avoids stocky-webhooks / stocky-cron.",
        "TTL, queue status, PID death, and quiescenceConfirmed are not drain.",
    ],
}
if not pin_ok:
    raise SystemExit("pin_mismatch:" + json.dumps({k: {"got": file_sha[k], "expected": EXPECTED[k]} for k in EXPECTED if file_sha[k] != EXPECTED[k]}))
out.write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps({"wrote": str(out), "pin_ok": pin_ok, "pong": pong, "git_present": git["present"], "head": git["head"]}))
PY
```
<!-- PROOF-EXTRACT:end path=probes/00-isolation.sh -->

### EXTRACT `probes/01-publication-boundary.mjs`

<!-- PROOF-EXTRACT:begin path=probes/01-publication-boundary.mjs -->
```javascript
/**
 * Helper B — publication-boundary schedules (1, 2, 4, 5) plus 02d.
 *
 * REAL BullMQ 5.81.2 + X classifyExistingQueueJob / inspectQueueDispatchPresence
 * / requireRedisUrl. Unique queue pr7finalB-effects. Not PR7 application code.
 *
 * Labels:
 *   EXISTING_X — worker CHECK_GENERATION_FENCE=0 (current Redis workers have no
 *                generation publication barrier).
 *   MODELED_PROPOSED — same byte-unmodified worker with CHECK_*_FENCE=1.
 *                That mode is check-then-act: it re-reads generation, then
 *                re-reads shop fence, then writes. A check immediately before
 *                publication is not an atomic fence across the in-flight
 *                window (EFF-X-02d).
 *   UNEXECUTED_APPLICATION_INTEGRATION — X export remains HTTP CSV; no remote
 *                object store; no installed privacy coordinator.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  QUEUE_NAME,
  REDIS_URL,
  enumerateDir,
  killExact,
  alive,
  requireCjs,
  residualFile,
  resetDir,
  sleep,
  spawnWorker,
  waitStatus,
  waitUntil,
  writeJson,
  requireProbeOut,
  requireProbeScratch,
  xHref,
} from "./probe-lib.mjs";
const { classifyExistingQueueJob, inspectQueueDispatchPresence } = await import(
  xHref("app/sync/queue-presence.server.ts")
);
const { requireRedisUrl, WEBHOOK_QUEUE, CRON_QUEUE } = await import(
  xHref("app/jobs/queue.server.ts")
);

const { Queue } = requireCjs("bullmq");
const IORedis = requireCjs("ioredis");

const OUT = requireProbeOut();
const SCRATCH = requireProbeScratch();

mkdirSync(SCRATCH, { recursive: true });

const results = {
  kind: "HELPER_B_PUBLICATION_BOUNDARY",
  base: "EXISTING_X",
  modeled: "MODELED_PROPOSED",
  redisUrl: REDIS_URL,
  requireRedisUrl: requireRedisUrl(),
  xQueueNames: { WEBHOOK_QUEUE, CRON_QUEUE },
  probeQueue: QUEUE_NAME,
  note:
    "X production queues are stocky-webhooks / stocky-cron. This harness uses unique pr7finalB-effects so 6379 leftovers cannot collide. Application privacy processors remain UNEXECUTED.",
  cases: {},
  ownedPids: [],
};

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
});

async function classifyJob(jobId) {
  const job = await queue.getJob(jobId);
  if (!job) return { status: "MISSING", queueState: "missing" };
  return classifyExistingQueueJob(job);
}

async function drainProbeQueue() {
  await queue.pause().catch(() => undefined);
  await queue.obliterate({ force: true }).catch(() => undefined);
  await queue.resume().catch(() => undefined);
}

function track(pid) {
  if (pid) results.ownedPids.push(pid);
}

function makeFifo(fifoPath) {
  execFileSync("mkfifo", ["-m", "600", fifoPath], { stdio: "pipe" });
}

function pidHasFifoOpen(pid, fifoPath) {
  if (!pid) return false;
  let want = fifoPath;
  try {
    want = realpathSync(fifoPath);
  } catch {
    want = fifoPath;
  }
  const dir = `/proc/${pid}/fd`;
  if (!existsSync(dir)) return false;
  for (const fd of readdirSync(dir)) {
    try {
      const target = readlinkSync(path.join(dir, fd));
      if (target === want || target === fifoPath) return true;
    } catch {
      /* fd raced */
    }
  }
  return false;
}

async function main() {
  try {
    await connection.ping();
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-01 — writer paused immediately before publication
    // ------------------------------------------------------------------
    const s1 = path.join(SCRATCH, "s1-pause-before");
    resetDir(s1);
    const s1status = path.join(s1, "status.json");
    const s1barrier = path.join(s1, "barrier.txt");
    const s1worker = spawnWorker(
      {
        STATUS_PATH: s1status,
        SINK_DIR: s1,
        TICK_LOG: path.join(s1, "ticks.log"),
        BARRIER_PATH: s1barrier,
        TICKS: "2",
        TICK_MS: "40",
        CHECK_GENERATION_FENCE: "0",
      },
      s1,
    );
    track(s1worker.pid);
    await waitStatus(s1status, "ready");
    const job1 = "effx01-pause__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "pause-before" },
      { jobId: job1 },
    );
    const gate = await waitStatus(s1status, "at_publication_gate");
    const thenResidual = residualFile(String(gate.sinkPath));
    const thenDir = enumerateDir(s1);
    const thenPresence = await inspectQueueDispatchPresence(queue, job1);
    const thenClassified = await classifyJob(job1);
    results.cases.EFF_X_01_writer_paused_immediately_before_publication = {
      id: "EFF-X-01",
      schedule: 1,
      label: "EXISTING_X",
      cites: ["PREP_B_09", "PREP_B_26"],
      worker_pid: s1worker.pid,
      jobId: job1,
      gate,
      then_sink: thenResidual,
      then_presence: thenPresence,
      then_classified: thenClassified,
      credential_recorded: gate.credential === gate.sinkPath,
      sink_absent_at_gate: thenResidual.exists === false,
      assertion:
        thenResidual.exists === false && gate.stage === "at_publication_gate"
          ? "PASS"
          : "FAIL",
      note: "Worker holds sink path/credential and has not yet written the sink. Barrier not yet GO. Queue status/active is not treated as drain.",
    };

    writeFileSync(s1barrier, "GO");
    const observed = await waitUntil(
      async () => (existsSync(String(gate.sinkPath)) ? residualFile(String(gate.sinkPath)) : null),
      8000,
    );
    const nowPresence = await inspectQueueDispatchPresence(queue, job1);
    results.cases.EFF_X_01b_then_vs_now_after_GO = {
      id: "EFF-X-01b",
      schedule: 1,
      label: "EXISTING_X",
      then_sink_exists: thenResidual.exists,
      now_sink: observed,
      now_presence: nowPresence,
      write_observed: Boolean(observed?.exists),
      assertion: observed?.exists ? "PASS" : "FAIL",
      note: "Then vs now: the same writer published after GO. Completeness cannot be inferred from the pre-write pause.",
    };
    killExact(s1worker.pid, "SIGKILL");
    await sleep(50);
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-02 — barrier BEFORE publication (two worker modes)
    // ------------------------------------------------------------------
    async function runBefore(label, checkFence, jobId) {
      const dir = path.join(SCRATCH, `s2-before-${label}`);
      resetDir(dir);
      const status = path.join(dir, "status.json");
      const barrier = path.join(dir, "barrier.txt");
      const genPath = path.join(dir, "current-gen.txt");
      writeFileSync(genPath, "gen-1");
      const worker = spawnWorker(
        {
          STATUS_PATH: status,
          SINK_DIR: dir,
          TICK_LOG: path.join(dir, "ticks.log"),
          BARRIER_PATH: barrier,
          CURRENT_GEN_PATH: genPath,
          CHECK_GENERATION_FENCE: checkFence,
          TICKS: "1",
          TICK_MS: "30",
        },
        dir,
      );
      track(worker.pid);
      await waitStatus(status, "ready");
      await queue.add(
        "export-publish",
        { shopId: "shop-a", generation: "gen-1", probe: "before-boundary" },
        { jobId },
      );
      const atGate = await waitStatus(status, "at_publication_gate");
      const beforeInstall = residualFile(String(atGate.sinkPath));
      writeFileSync(genPath, "gen-2");
      writeFileSync(barrier, "GO");
      const refused = await waitUntil(
        async () =>
          existsSync(`${atGate.sinkPath}.refused`)
            ? residualFile(`${atGate.sinkPath}.refused`)
            : null,
        4000,
      );
      const landed = await waitUntil(
        async () =>
          existsSync(String(atGate.sinkPath)) ? residualFile(String(atGate.sinkPath)) : null,
        checkFence === "1" ? 1500 : 6000,
      );
      await sleep(200);
      const residual = residualFile(String(atGate.sinkPath));
      const classified = await classifyJob(jobId);
      killExact(worker.pid, "SIGKILL");
      await sleep(40);
      return {
        id: checkFence === "1" ? "EFF-X-02a" : "EFF-X-02b",
        schedule: 2,
        label,
        jobId,
        worker_pid: worker.pid,
        atGate,
        sink_absent_before_gen_flip: beforeInstall.exists === false,
        current_generation_at_release: "gen-2",
        payload_generation: "gen-1",
        refused,
        landed,
        residual_after_wait: residual,
        classified,
        late_write_landed: residual.exists === true,
      };
    }

    const beforeModeled = await runBefore("MODELED_PROPOSED", "1", "effx02-before-fenced__d1");
    beforeModeled.cites = ["PREP_B_10", "PREP_B_27"];
    beforeModeled.assertion =
      beforeModeled.late_write_landed === false && beforeModeled.refused?.exists
        ? "PASS"
        : "FAIL";
    beforeModeled.note =
      "MODELED PROPOSED check-then-act: generation is stale at the check (barrier before the fence read), so the worker refuses. This does not prove atomicity across the later in-flight window (see EFF-X-02d). Not installed application code.";
    results.cases.EFF_X_02a_barrier_before_publication_modeled_refuses = beforeModeled;
    await drainProbeQueue();

    const beforeX = await runBefore("EXISTING_X", "0", "effx02-before-unfenced__d1");
    beforeX.cites = ["PREP_B_10", "PREP_B_26"];
    beforeX.assertion = beforeX.late_write_landed ? "PASS" : "FAIL";
    beforeX.note =
      "EXISTING X: same ordering (fence file flipped to gen-2 at the gate) but CHECK_GENERATION_FENCE=0. Late write still landed. PostgreSQL/Redis TTL/queue status would not have prevented it.";
    results.cases.EFF_X_02b_barrier_before_publication_existing_x_still_writes = beforeX;
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-02c — barrier AFTER publication (write already committed)
    // ------------------------------------------------------------------
    const s2c = path.join(SCRATCH, "s2-after");
    resetDir(s2c);
    const s2cstatus = path.join(s2c, "status.json");
    const s2cbarrier = path.join(s2c, "barrier.txt");
    const s2cgen = path.join(s2c, "current-gen.txt");
    writeFileSync(s2cgen, "gen-1");
    const s2cworker = spawnWorker(
      {
        STATUS_PATH: s2cstatus,
        SINK_DIR: s2c,
        TICK_LOG: path.join(s2c, "ticks.log"),
        BARRIER_PATH: s2cbarrier,
        CURRENT_GEN_PATH: s2cgen,
        CHECK_GENERATION_FENCE: "1",
        TICKS: "1",
        TICK_MS: "30",
      },
      s2c,
    );
    track(s2cworker.pid);
    await waitStatus(s2cstatus, "ready");
    const job2c = "effx02-after__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "after-boundary" },
      { jobId: job2c },
    );
    const gate2c = await waitStatus(s2cstatus, "at_publication_gate");
    writeFileSync(s2cbarrier, "GO");
    const landed2c = await waitUntil(
      async () =>
        existsSync(String(gate2c.sinkPath)) ? residualFile(String(gate2c.sinkPath)) : null,
      8000,
    );
    writeFileSync(s2cgen, "gen-2");
    await sleep(200);
    const residual2c = residualFile(String(gate2c.sinkPath));
    results.cases.EFF_X_02c_barrier_after_publication_does_not_unwrite = {
      id: "EFF-X-02c",
      schedule: 2,
      label: "MODELED_PROPOSED",
      cites: ["PREP_B_26"],
      jobId: job2c,
      worker_pid: s2cworker.pid,
      write_observed_before_gen_flip: Boolean(landed2c?.exists),
      generation_after_write: "gen-2",
      residual_after_late_fence: residual2c,
      late_write_landed: residual2c.exists === true,
      assertion: residual2c.exists ? "PASS" : "FAIL",
      note: "Fence applied after the publication boundary cannot retract bytes already on disk. Residual check, not job exit 0, is the evidence.",
    };
    killExact(s2cworker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-02d — F-CLAUDE-PR7PR49-01: barrier BETWEEN last modeled
    // fence read and sink mutation. CURRENT modeled worker is
    // check-then-act. Expected NEGATIVE evidence: the stale write lands.
    // Do not change publication-worker.mjs to make this case pass.
    // Pin: sha256 4394d813bff34b8196be9c249b4c325793e60b492682a42c5e3f4fdd76bb53c7
    // ------------------------------------------------------------------
    const s2d = path.join(SCRATCH, "s2-between-check-and-write");
    resetDir(s2d);
    const s2dstatus = path.join(s2d, "status.json");
    const s2dbarrier = path.join(s2d, "barrier.txt");
    const s2dgen = path.join(s2d, "current-gen.txt");
    const s2dfifo = path.join(s2d, "fence.fifo");
    writeFileSync(s2dgen, "gen-1");
    makeFifo(s2dfifo);
    const s2dworker = spawnWorker(
      {
        STATUS_PATH: s2dstatus,
        SINK_DIR: s2d,
        TICK_LOG: path.join(s2d, "ticks.log"),
        BARRIER_PATH: s2dbarrier,
        CURRENT_GEN_PATH: s2dgen,
        CURRENT_FENCE_PATH: s2dfifo,
        CHECK_GENERATION_FENCE: "1",
        CHECK_SHOP_FENCE: "1",
        TICKS: "1",
        TICK_MS: "30",
      },
      s2d,
    );
    track(s2dworker.pid);
    await waitStatus(s2dstatus, "ready");
    const job2d = "effx02-between-check-write__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "between-check-and-write" },
      { jobId: job2d },
    );
    const gate2d = await waitStatus(s2dstatus, "at_publication_gate");
    const sinkAtGate = residualFile(String(gate2d.sinkPath));
    writeFileSync(s2dbarrier, "GO");
    // After GO the worker's next modeled reads are generation then shop
    // fence. Generation is a regular file (instant). Shop fence is a FIFO
    // whose open blocks until we write. Sleep long enough for the
    // generation check to finish; the worker cannot reach the sink write
    // without completing the FIFO open.
    await sleep(150);
    let wchan = "";
    try {
      wchan = readFileSync(`/proc/${s2dworker.pid}/wchan`, "utf8").trim();
    } catch {
      wchan = "";
    }
    const fifoOpenVisible = pidHasFifoOpen(s2dworker.pid, s2dfifo);
    const sinkImmediatelyBeforeFlip = residualFile(String(gate2d.sinkPath));
    const tFlip = Date.now();
    writeFileSync(s2dgen, "gen-2");
    const currentGenAtUnblock = readFileSync(s2dgen, "utf8").trim();
    writeFileSync(s2dfifo, "{}\n");
    const landed2d = await waitUntil(
      async () =>
        existsSync(String(gate2d.sinkPath)) ? residualFile(String(gate2d.sinkPath)) : null,
      8000,
    );
    let sinkBody = null;
    if (landed2d?.exists) {
      try {
        sinkBody = JSON.parse(readFileSync(String(gate2d.sinkPath), "utf8").trim());
      } catch {
        sinkBody = null;
      }
    }
    const refused2d = residualFile(`${gate2d.sinkPath}.refused`);
    try {
      unlinkSync(s2dfifo);
    } catch {
      /* FIFO may still be open; replace below */
    }
    writeFileSync(s2dfifo, "{}\n");

    const job2dRetry = "effx02-between-retry-stale__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "post-flip-retry" },
      { jobId: job2dRetry },
    );
    const retryRefuse = await waitUntil(async () => {
      const hits = enumerateDir(s2d).entries.filter(
        (e) => e.name.includes("effx02-between-retry") && e.name.endsWith(".refused"),
      );
      return hits.length ? hits[0] : null;
    }, 8000);
    const retrySink = residualFile(path.join(s2d, `shop-a.${job2dRetry}.sink`));

    const job2dB = "effx02-between-shop-b__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-b", generation: "gen-2", probe: "unrelated-tenant" },
      { jobId: job2dB },
    );
    const shopBWrite = await waitUntil(
      async () => residualFile(path.join(s2d, `shop-b.${job2dB}.sink`)).exists,
      8000,
    );

    results.cases.EFF_X_02d_barrier_between_check_and_write_stale_write_lands = {
      id: "EFF-X-02d",
      schedule: 2,
      label: "MODELED_PROPOSED",
      cites: ["F-CLAUDE-PR7PR49-01"],
      jobId: job2d,
      worker_pid: s2dworker.pid,
      worker_sha256_pin: "4394d813bff34b8196be9c249b4c325793e60b492682a42c5e3f4fdd76bb53c7",
      worker_unmodified: true,
      sink_absent_at_gate: sinkAtGate.exists === false,
      sink_absent_immediately_before_generation_flip: sinkImmediatelyBeforeFlip.exists === false,
      fifo_open_visible_in_procfd: fifoOpenVisible,
      wchan_after_go: wchan,
      t_generation_flip: tFlip,
      payload_generation: sinkBody?.generation ?? null,
      current_generation_at_write: currentGenAtUnblock,
      late_write_landed: Boolean(landed2d?.exists),
      refuse_absent_for_in_flight: refused2d.exists === false,
      check_then_act_window_open: Boolean(
        sinkImmediatelyBeforeFlip.exists === false &&
          landed2d?.exists &&
          sinkBody?.generation === "gen-1" &&
          currentGenAtUnblock === "gen-2",
      ),
      post_flip_retry_refused: Boolean(retryRefuse) && retrySink.exists === false,
      unrelated_shop_b_write_observed: Boolean(shopBWrite),
      shop_fence_is_whole_shop_only: true,
      customer_target_fence_modeled: false,
      application_integration: "UNEXECUTED",
      assertion:
        sinkImmediatelyBeforeFlip.exists === false &&
        landed2d?.exists &&
        sinkBody?.generation === "gen-1" &&
        currentGenAtUnblock === "gen-2" &&
        refused2d.exists === false &&
        Boolean(retryRefuse) &&
        retrySink.exists === false &&
        Boolean(shopBWrite)
          ? "PASS"
          : "FAIL",
      note: "NEGATIVE evidence. The modeled worker is check-then-act, not an atomic fence. Committing gen-1 to gen-2 after the last fence read and before the sink mutation lets the stale gen-1 write land. A later retry of the same stale payload is refused (stale at check). Unrelated shop-B with current generation still writes. Shop fence is whole-shop ERASING only; no customer-target gate. Required contract (frozen H): serialize publication with the privacy barrier, OR sink-enforce generation/target, OR positively drain that writer and outstanding I/O. Application integration remains UNEXECUTED.",
    };
    killExact(s2dworker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-04 — stale retry after reinstall (gen-1 payload, current gen-2)
    // ------------------------------------------------------------------
    async function staleRetry(label, checkFence, jobId) {
      const dir = path.join(SCRATCH, `s4-${label}`);
      resetDir(dir);
      const status = path.join(dir, "status.json");
      const genPath = path.join(dir, "current-gen.txt");
      writeFileSync(genPath, "gen-2");
      const worker = spawnWorker(
        {
          STATUS_PATH: status,
          SINK_DIR: dir,
          TICK_LOG: path.join(dir, "ticks.log"),
          CURRENT_GEN_PATH: genPath,
          CHECK_GENERATION_FENCE: checkFence,
          TICKS: "1",
          TICK_MS: "30",
        },
        dir,
      );
      track(worker.pid);
      await waitStatus(status, "ready");
      await queue.add(
        "export-publish",
        { shopId: "shop-a", generation: "gen-1", probe: "stale-retry" },
        { jobId },
      );
      const refused = await waitUntil(async () => {
        const hits = enumerateDir(dir).entries.filter((e) => e.name.endsWith(".refused"));
        return hits.length ? hits[0] : null;
      }, checkFence === "1" ? 8000 : 1500);
      const landed = await waitUntil(async () => {
        const hits = enumerateDir(dir).entries.filter((e) => e.name.endsWith(".sink"));
        return hits.length ? hits[0] : null;
      }, checkFence === "0" ? 8000 : 1500);
      await sleep(150);
      const sinks = enumerateDir(dir).entries.filter((e) => e.name.endsWith(".sink"));
      const refuses = enumerateDir(dir).entries.filter((e) => e.name.endsWith(".refused"));
      const classified = await classifyJob(jobId);
      killExact(worker.pid, "SIGKILL");
      await sleep(40);
      return {
        id: checkFence === "0" ? "EFF-X-04a" : "EFF-X-04b",
        schedule: 4,
        label,
        jobId,
        worker_pid: worker.pid,
        payload_generation: "gen-1",
        current_generation: "gen-2",
        sunk: sinks,
        refused: refuses,
        classified,
        write_observed: sinks.length > 0,
        refuse_observed: refuses.length > 0,
      };
    }

    const staleX = await staleRetry("EXISTING_X", "0", "effx04-unfenced__d1");
    staleX.cites = ["PREP_B_10"];
    staleX.assertion = staleX.write_observed ? "PASS" : "FAIL";
    staleX.note =
      "EXISTING X worker without a generation fence still publishes gen-1 bytes after reinstall current=gen-2.";
    results.cases.EFF_X_04a_stale_retry_existing_x_still_writes = staleX;
    await drainProbeQueue();

    const staleM = await staleRetry("MODELED_PROPOSED", "1", "effx04-fenced__d1");
    staleM.cites = ["PREP_B_27"];
    staleM.assertion = !staleM.write_observed && staleM.refuse_observed ? "PASS" : "FAIL";
    staleM.note =
      "MODELED PROPOSED check-then-act refuses gen-1 when current is already gen-2 at check time. Labelled proposed — not an X production worker. Does not close the in-flight window (EFF-X-02d).";
    results.cases.EFF_X_04b_stale_retry_modeled_fence_refuses = staleM;
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-05 — late write after manifest/residual enumeration
    // ------------------------------------------------------------------
    const s5 = path.join(SCRATCH, "s5-enumerate-then-write");
    resetDir(s5);
    const s5status = path.join(s5, "status.json");
    const s5barrier = path.join(s5, "barrier.txt");
    const s5worker = spawnWorker(
      {
        STATUS_PATH: s5status,
        SINK_DIR: s5,
        TICK_LOG: path.join(s5, "ticks.log"),
        BARRIER_PATH: s5barrier,
        TICKS: "1",
        TICK_MS: "30",
        CHECK_GENERATION_FENCE: "0",
      },
      s5,
    );
    track(s5worker.pid);
    await waitStatus(s5status, "ready");
    const job5 = "effx05-late-enum__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "late-enum" },
      { jobId: job5 },
    );
    const gate5 = await waitStatus(s5status, "at_publication_gate");
    const enumBefore = enumerateDir(s5);
    const sinkNamesBefore = enumBefore.entries
      .filter((e) => e.name.endsWith(".sink"))
      .map((e) => e.name);
    writeFileSync(s5barrier, "GO");
    const late = await waitUntil(
      async () =>
        existsSync(String(gate5.sinkPath)) ? residualFile(String(gate5.sinkPath)) : null,
      8000,
    );
    const enumAfter = enumerateDir(s5);
    results.cases.EFF_X_05_late_write_after_manifest_enumeration = {
      id: "EFF-X-05",
      schedule: 5,
      label: "EXISTING_X",
      cites: ["PREP_B_09", "PREP_B_26"],
      jobId: job5,
      worker_pid: s5worker.pid,
      enumerated_sinks_before_GO: sinkNamesBefore,
      enum_before_entry_count: enumBefore.entries.length,
      write_observed: Boolean(late?.exists),
      now_sink: late,
      enum_after_sinks: enumAfter.entries.filter((e) => e.name.endsWith(".sink")),
      assertion:
        sinkNamesBefore.length === 0 && late?.exists ? "PASS" : "FAIL",
      note: "Manifest/residual enumeration while the writer was paused at the gate showed zero sink files. After GO the write was observed. Enumeration-then-complete is not a fence. Continued until the write was observed, not until job success.",
    };
    killExact(s5worker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    results.cases.EFF_X_00_export_source_inventory = {
      id: "EFF-X-00",
      label: "UNEXECUTED_APPLICATION_INTEGRATION",
      assertion: "UNEXECUTED",
      x_export_route: "app/routes/app.analytics_.export.tsx",
      x_export_shape: "HTTP CSV after requireAdminTenant (valuation/deadstock)",
      object_store: "none on X source inventory (no S3/R2/GCS module)",
      note: "An object-store simulator cannot certify a real remote object store. Current X export is HTTP CSV. Recorded as source inventory, not historical-bytes proof. Cites coordinator PREP-B-06 / Helper B PREP_B_24.",
      cites: ["PREP_B_24"],
    };
  } catch (error) {
    results.fatal = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    };
  } finally {
    for (const pid of results.ownedPids) {
      if (alive(pid)) killExact(pid, "SIGKILL");
    }
    await queue.close().catch(() => undefined);
    await connection.quit().catch(() => undefined);
  }
  writeJson(OUT, results);
  console.log(
    JSON.stringify({
      wrote: OUT,
      cases: Object.keys(results.cases),
      fatal: results.fatal ?? null,
    }),
  );
}

void main();
```
<!-- PROOF-EXTRACT:end path=probes/01-publication-boundary.mjs -->

### EXTRACT `probes/02-remove-death-ttl-drain.mjs`

<!-- PROOF-EXTRACT:begin path=probes/02-remove-death-ttl-drain.mjs -->
```javascript
/**
 * Helper B — Job.remove / death / TTL / decoy / positive drain.
 * Schedules 3 and 6 plus TTL and decoy counterexamples.
 *
 * Waiting-job remove is INCONCLUSIVE as drain even if this job's sink stays
 * absent. Active locked Job.remove is the PREP_B_06b class.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  QUEUE_NAME,
  REDIS_URL,
  KEY_PREFIX,
  alive,
  killExact,
  requireCjs,
  residualFile,
  resetDir,
  sleep,
  spawnWorker,
  tickLinesAfter,
  waitFile,
  waitStatus,
  waitUntil,
  writeJson,
  requireProbeOut,
  requireProbeScratch,
  xHref,
} from "./probe-lib.mjs";
const { classifyExistingQueueJob, inspectQueueDispatchPresence } = await import(
  xHref("app/sync/queue-presence.server.ts")
);
const { requireRedisUrl } = await import(xHref("app/jobs/queue.server.ts"));

const { Queue } = requireCjs("bullmq");
const IORedis = requireCjs("ioredis");

const OUT = requireProbeOut();
const SCRATCH = requireProbeScratch();

mkdirSync(SCRATCH, { recursive: true });

const results = {
  kind: "HELPER_B_REMOVE_DEATH_TTL_DRAIN",
  requireRedisUrl: requireRedisUrl(),
  probeQueue: QUEUE_NAME,
  cases: {},
  ownedPids: [],
};

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
});

function track(pid) {
  if (pid) results.ownedPids.push(pid);
}

async function classifyJob(jobId) {
  const job = await queue.getJob(jobId);
  if (!job) return { status: "MISSING", queueState: "missing" };
  return classifyExistingQueueJob(job);
}

async function drainProbeQueue() {
  await queue.pause().catch(() => undefined);
  await queue.obliterate({ force: true }).catch(() => undefined);
  await queue.resume().catch(() => undefined);
}

async function waitActive(jobId, timeoutMs = 8000) {
  const start = Date.now();
  let state = "unknown";
  while (Date.now() - start < timeoutMs) {
    const job = await queue.getJob(jobId);
    state = job ? await job.getState() : "missing";
    if (state === "active") return state;
    await sleep(20);
  }
  return state;
}

async function main() {
  try {
    await connection.ping();
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-06a — active Job.remove (PREP_B_06b class)
    // ------------------------------------------------------------------
    const aDir = path.join(SCRATCH, "active-remove");
    resetDir(aDir);
    const aStatus = path.join(aDir, "status.json");
    const aLog = path.join(aDir, "ticks.log");
    writeFileSync(aLog, "");
    const aWorker = spawnWorker(
      {
        STATUS_PATH: aStatus,
        SINK_DIR: aDir,
        TICK_LOG: aLog,
        TICKS: "40",
        TICK_MS: "80",
        LOCK_DURATION_MS: "5000",
        CHECK_GENERATION_FENCE: "0",
      },
      aDir,
    );
    track(aWorker.pid);
    await waitStatus(aStatus, "ready");
    const activeId = "effx06-active-remove__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "active-remove" },
      { jobId: activeId },
    );
    await waitFile(path.join(aDir, `${activeId}.started`));
    const stateBefore = await waitActive(activeId);
    const ticksBefore = readFileSync(aLog, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("tick ")).length;
    const removeAt = Date.now();
    const live = await queue.getJob(activeId);
    let removeResult = null;
    try {
      if (live) await live.remove();
      removeResult = { ok: true };
    } catch (error) {
      removeResult = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const presenceAfter = await inspectQueueDispatchPresence(queue, activeId);
    const classifiedAfter = await classifyJob(activeId);
    await sleep(900);
    const logAfter = existsSync(aLog) ? readFileSync(aLog, "utf8") : "";
    const ticksAfter = tickLinesAfter(logAfter, removeAt);
    const sinkAfter = residualFile(path.join(aDir, `shop-a.${activeId}.sink`));
    results.cases.EFF_X_06a_active_job_remove_is_not_drain = {
      id: "EFF-X-06a",
      schedule: 6,
      label: "EXISTING_X",
      cites: ["PREP_B_06b"],
      jobId: activeId,
      worker_pid: aWorker.pid,
      stateBeforeRemove: stateBefore,
      ticksBefore,
      removeResult,
      presenceAfter,
      classifiedAfter,
      ticks_appended_after_Job_remove_attempt: ticksAfter.length,
      sample_ticks_after_remove_attempt: ticksAfter.slice(0, 8),
      worker_alive_after_remove_attempt: alive(aWorker.pid),
      sink_after: sinkAfter,
      locked_throw_observed:
        removeResult.ok === false &&
        String(removeResult.message || "").includes("locked by another worker"),
      assertion:
        stateBefore === "active" &&
        removeResult.ok === false &&
        ticksAfter.length > 0 &&
        presenceAfter.status === "RUNNABLE_EXISTING" &&
        alive(aWorker.pid)
          ? "PASS"
          : "FAIL",
      note: "BullMQ 5.81.2 Job.remove of an active locked job throws; processor keeps publishing ticks. Cancel/remove is not worker cessation and not drain. Cite sealed PR48 PREP_B_06b; this is a new EFF-X run on port 17379.",
    };
    killExact(aWorker.pid, "SIGKILL");
    await sleep(50);
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-06b — waiting Job.remove residual (INCONCLUSIVE as drain)
    // ------------------------------------------------------------------
    const wDir = path.join(SCRATCH, "waiting-remove");
    resetDir(wDir);
    const waitingId = "effx06-waiting-remove__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "waiting-remove" },
      { jobId: waitingId },
    );
    const waitingState = await (async () => {
      const j = await queue.getJob(waitingId);
      return j ? await j.getState() : "missing";
    })();
    const waitingPresence = await inspectQueueDispatchPresence(queue, waitingId);
    const waitingJob = await queue.getJob(waitingId);
    let waitingRemove = null;
    try {
      if (waitingJob) await waitingJob.remove();
      waitingRemove = { ok: true };
    } catch (error) {
      waitingRemove = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const afterWaitingRemove = await inspectQueueDispatchPresence(queue, waitingId);
    const wStatus = path.join(wDir, "status.json");
    const wWorker = spawnWorker(
      {
        STATUS_PATH: wStatus,
        SINK_DIR: wDir,
        TICK_LOG: path.join(wDir, "ticks.log"),
        TICKS: "4",
        TICK_MS: "40",
      },
      wDir,
    );
    track(wWorker.pid);
    await waitStatus(wStatus, "ready");
    await sleep(2000);
    const waitingSink = residualFile(path.join(wDir, `shop-a.${waitingId}.sink`));
    const startedWaiting = existsSync(path.join(wDir, `${waitingId}.started`));
    results.cases.EFF_X_06b_waiting_job_remove_inconclusive_as_drain = {
      id: "EFF-X-06b",
      schedule: 6,
      label: "EXISTING_X",
      cites: ["PREP_B_06"],
      jobId: waitingId,
      waitingState,
      waitingPresence,
      waitingRemove,
      afterWaitingRemove,
      worker_pid: wWorker.pid,
      sink_after_live_worker_wait: waitingSink,
      started_file: startedWaiting,
      this_job_write_observed: waitingSink.exists === true || startedWaiting,
      assertion: "INCONCLUSIVE",
      note: "Waiting-job remove is not converted to a drain PASS. Residual of this jobId showed no sink after a live worker waited 2s, which is evidence only that this waiting job did not later publish. It is not shop-wide drain, not active-processor drain, and remains INCONCLUSIVE per the sealed PREP_B_06 class unless a stronger locked-active proof (EFF-X-06a) is used.",
    };
    killExact(wWorker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-03 — SIGKILL worker; residual file + Redis via classifier
    // ------------------------------------------------------------------
    const dDir = path.join(SCRATCH, "sigkill");
    resetDir(dDir);
    const dStatus = path.join(dDir, "status.json");
    const dLog = path.join(dDir, "ticks.log");
    writeFileSync(dLog, "");
    const dWorker = spawnWorker(
      {
        STATUS_PATH: dStatus,
        SINK_DIR: dDir,
        TICK_LOG: dLog,
        TICKS: "30",
        TICK_MS: "80",
        LOCK_DURATION_MS: "5000",
      },
      dDir,
    );
    track(dWorker.pid);
    await waitStatus(dStatus, "ready");
    const deathId = "effx03-sigkill__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "sigkill" },
      { jobId: deathId },
    );
    await waitFile(path.join(dDir, `${deathId}.started`));
    await waitUntil(async () => residualFile(path.join(dDir, `shop-a.${deathId}.sink`)).exists, 8000);
    const sinkBeforeKill = residualFile(path.join(dDir, `shop-a.${deathId}.sink`));
    const killReal = killExact(dWorker.pid, "SIGKILL");
    await sleep(200);
    const classifiedDeath = await classifyJob(deathId);
    const presenceDeath = await inspectQueueDispatchPresence(queue, deathId);
    const sinkAfterKill = residualFile(path.join(dDir, `shop-a.${deathId}.sink`));
    const doneAfterKill = existsSync(path.join(dDir, `${deathId}.done`));
    results.cases.EFF_X_03_sigkill_loss_of_acknowledgement = {
      id: "EFF-X-03",
      schedule: 3,
      label: "EXISTING_X",
      cites: ["PREP_B_08"],
      jobId: deathId,
      worker_pid: dWorker.pid,
      killReal,
      worker_alive: alive(dWorker.pid),
      sink_before_kill: sinkBeforeKill,
      sink_after_kill: sinkAfterKill,
      done_file_after_kill: doneAfterKill,
      classifiedAfter: classifiedDeath,
      presenceAfter: presenceDeath,
      power_loss_tested: false,
      signal: "SIGKILL",
      acknowledgement_lost: doneAfterKill === false,
      assertion:
        killReal.ok &&
        !alive(dWorker.pid) &&
        sinkAfterKill.exists &&
        classifiedDeath.status === "RUNNABLE_EXISTING" &&
        doneAfterKill === false
          ? "PASS"
          : "FAIL",
      note: "SIGKILL of this helper's worker PID. Not power-loss. Residual sink bytes remain; X classifier still RUNNABLE_EXISTING/active; .done acknowledgement absent. PID death is not drain.",
    };
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-11 — TTL hint expiry while worker ticks (not drain)
    // ------------------------------------------------------------------
    const tDir = path.join(SCRATCH, "ttl");
    resetDir(tDir);
    const tStatus = path.join(tDir, "status.json");
    const tLog = path.join(tDir, "ticks.log");
    writeFileSync(tLog, "");
    const tWorker = spawnWorker(
      {
        STATUS_PATH: tStatus,
        SINK_DIR: tDir,
        TICK_LOG: tLog,
        TICKS: "20",
        TICK_MS: "100",
      },
      tDir,
    );
    track(tWorker.pid);
    await waitStatus(tStatus, "ready");
    const ttlId = "effx11-ttl__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "ttl" },
      { jobId: ttlId },
    );
    await waitFile(path.join(tDir, `${ttlId}.started`));
    const hintKey = `${KEY_PREFIX}wake-hint:ttl`;
    await connection.set(hintKey, "wake", "EX", 1);
    const ttl1 = await connection.ttl(hintKey);
    await sleep(1600);
    const ttlAfter = await connection.ttl(hintKey);
    const existsHint = await connection.exists(hintKey);
    const ticksAfterTtl = readFileSync(tLog, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("tick "));
    results.cases.EFF_X_11_ttl_hint_expiry_is_not_drain = {
      id: "EFF-X-11",
      schedule: "ttl-counterexample",
      label: "EXISTING_X",
      cites: ["PREP_B_05"],
      hintKey,
      ttl_immediately: ttl1,
      ttl_after_1_6s: ttlAfter,
      hint_exists_after: existsHint,
      worker_pid: tWorker.pid,
      worker_alive: alive(tWorker.pid),
      tick_count: ticksAfterTtl.length,
      last_tick: ticksAfterTtl.at(-1) ?? "",
      assertion:
        existsHint === 0 && alive(tWorker.pid) && ticksAfterTtl.length > 0
          ? "PASS"
          : "FAIL",
      note: "Optional Redis wake hint TTL hit 0 while the worker still appended ticks. TTL is not drain.",
    };
    killExact(tWorker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    // ------------------------------------------------------------------
    // EFF-X-12 — decoy PID kill; real worker remains
    // ------------------------------------------------------------------
    const pDir = path.join(SCRATCH, "decoy");
    resetDir(pDir);
    const pStatus = path.join(pDir, "status.json");
    const pLog = path.join(pDir, "ticks.log");
    writeFileSync(pLog, "");
    const decoy = spawn("sleep", ["30"], { stdio: "ignore" });
    track(decoy.pid);
    const pWorker = spawnWorker(
      {
        STATUS_PATH: pStatus,
        SINK_DIR: pDir,
        TICK_LOG: pLog,
        TICKS: "20",
        TICK_MS: "80",
      },
      pDir,
    );
    track(pWorker.pid);
    await waitStatus(pStatus, "ready");
    const pidJob = "effx12-decoy__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "decoy" },
      { jobId: pidJob },
    );
    await waitFile(path.join(pDir, `${pidJob}.started`));
    const killDecoy = killExact(decoy.pid, "SIGKILL");
    await sleep(400);
    const ticksAfterDecoy = readFileSync(pLog, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("tick "));
    const redisAfterDecoy = await inspectQueueDispatchPresence(queue, pidJob);
    results.cases.EFF_X_12_decoy_pid_kill_leaves_real_worker = {
      id: "EFF-X-12",
      schedule: "decoy-pid",
      label: "EXISTING_X",
      cites: ["PREP_B_07"],
      decoyPid: decoy.pid,
      killDecoy,
      decoy_alive: alive(decoy.pid),
      real_worker_pid: pWorker.pid,
      real_worker_alive: alive(pWorker.pid),
      tick_count_after_decoy_kill: ticksAfterDecoy.length,
      redisAfterDecoy,
      assertion:
        !alive(decoy.pid) &&
        alive(pWorker.pid) &&
        ticksAfterDecoy.length > 0 &&
        redisAfterDecoy.status === "RUNNABLE_EXISTING"
          ? "PASS"
          : "FAIL",
      note: "Killed only the decoy PID started by this helper. Real worker and Redis runnable job remained.",
    };

    // ------------------------------------------------------------------
    // EFF-X-13 — positive drain contrast (that job only)
    // ------------------------------------------------------------------
    killExact(pWorker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();
    const nDir = path.join(SCRATCH, "positive-drain");
    resetDir(nDir);
    const nStatus = path.join(nDir, "status.json");
    const nLog = path.join(nDir, "ticks.log");
    writeFileSync(nLog, "");
    const nWorker = spawnWorker(
      {
        STATUS_PATH: nStatus,
        SINK_DIR: nDir,
        TICK_LOG: nLog,
        TICKS: "4",
        TICK_MS: "40",
      },
      nDir,
    );
    track(nWorker.pid);
    await waitStatus(nStatus, "ready");
    const drainId = "effx13-positive-drain__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "positive-drain" },
      { jobId: drainId },
    );
    const donePath = path.join(nDir, `${drainId}.done`);
    await waitFile(donePath, 8000);
    await sleep(150);
    const drainPresence = await inspectQueueDispatchPresence(queue, drainId);
    const drainClassified = await classifyJob(drainId);
    const drainSink = residualFile(path.join(nDir, `shop-a.${drainId}.sink`));
    results.cases.EFF_X_13_positive_job_drain_contrast = {
      id: "EFF-X-13",
      schedule: "positive-drain-contrast",
      label: "EXISTING_X",
      cites: ["PREP_B_11"],
      jobId: drainId,
      worker_pid: nWorker.pid,
      done_file: existsSync(donePath),
      done_payload: existsSync(donePath)
        ? JSON.parse(readFileSync(donePath, "utf8"))
        : null,
      drainPresence,
      drainClassified,
      sink: drainSink,
      assertion:
        existsSync(donePath) &&
        drainSink.exists &&
        drainClassified.status === "TERMINAL_EXISTING" &&
        drainClassified.queueState === "completed"
          ? "PASS"
          : "FAIL",
      note: "The only Redis success shape that counts as drain of THAT job: worker finished + .done + X classifier TERMINAL_EXISTING/completed. Still not shop-wide drain. TTL/queue status/PID/quiescenceConfirmed are not this shape.",
    };
    killExact(nWorker.pid, "SIGTERM");
    await sleep(200);
    if (alive(nWorker.pid)) killExact(nWorker.pid, "SIGKILL");
  } catch (error) {
    results.fatal = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    };
  } finally {
    for (const pid of results.ownedPids) {
      if (alive(pid)) killExact(pid, "SIGKILL");
    }
    await queue.close().catch(() => undefined);
    await connection.quit().catch(() => undefined);
  }
  writeJson(OUT, results);
  console.log(
    JSON.stringify({
      wrote: OUT,
      cases: Object.keys(results.cases),
      fatal: results.fatal ?? null,
    }),
  );
}

void main();
```
<!-- PROOF-EXTRACT:end path=probes/02-remove-death-ttl-drain.mjs -->

### EXTRACT `probes/03-shop-isolation.mjs`

<!-- PROOF-EXTRACT:begin path=probes/03-shop-isolation.mjs -->
```javascript
/**
 * Helper B — unrelated shop/customer continuing (schedule 7).
 * Isolation of jobId ≠ privacy gate.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  QUEUE_NAME,
  REDIS_URL,
  alive,
  killExact,
  requireCjs,
  residualFile,
  resetDir,
  sleep,
  spawnWorker,
  waitFile,
  waitStatus,
  waitUntil,
  writeJson,
  requireProbeOut,
  requireProbeScratch,
  xHref,
} from "./probe-lib.mjs";
const { classifyExistingQueueJob, inspectQueueDispatchPresence } = await import(
  xHref("app/sync/queue-presence.server.ts")
);
const { requireRedisUrl } = await import(xHref("app/jobs/queue.server.ts"));

const { Queue } = requireCjs("bullmq");
const IORedis = requireCjs("ioredis");

const OUT = requireProbeOut();
const SCRATCH = requireProbeScratch();

mkdirSync(SCRATCH, { recursive: true });
const results = {
  kind: "HELPER_B_SHOP_ISOLATION",
  requireRedisUrl: requireRedisUrl(),
  probeQueue: QUEUE_NAME,
  cases: {},
  ownedPids: [],
};
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
});

function track(pid) {
  if (pid) results.ownedPids.push(pid);
}

async function classifyJob(jobId) {
  const job = await queue.getJob(jobId);
  if (!job) return { status: "MISSING", queueState: "missing" };
  return classifyExistingQueueJob(job);
}

async function drainProbeQueue() {
  await queue.pause().catch(() => undefined);
  await queue.obliterate({ force: true }).catch(() => undefined);
  await queue.resume().catch(() => undefined);
}

async function main() {
  try {
    await connection.ping();
    await drainProbeQueue();

    // EXISTING X: both shops write
    const xDir = path.join(SCRATCH, "existing-x-both-write");
    resetDir(xDir);
    const xStatus = path.join(xDir, "status.json");
    const xWorker = spawnWorker(
      {
        STATUS_PATH: xStatus,
        SINK_DIR: xDir,
        TICK_LOG: path.join(xDir, "ticks.log"),
        TICKS: "2",
        TICK_MS: "40",
        CHECK_SHOP_FENCE: "0",
      },
      xDir,
    );
    track(xWorker.pid);
    await waitStatus(xStatus, "ready");
    const jobA = "effx07-shop-a__d1";
    const jobB = "effx07-shop-b__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "iso-x", customerRestId: "191167" },
      { jobId: jobA },
    );
    await queue.add(
      "export-publish",
      { shopId: "shop-b", generation: "gen-9", probe: "iso-x", customerRestId: "200001" },
      { jobId: jobB },
    );
    const aLanded = await waitUntil(
      async () => residualFile(path.join(xDir, `shop-a.${jobA}.sink`)).exists,
      8000,
    );
    const bLanded = await waitUntil(
      async () => residualFile(path.join(xDir, `shop-b.${jobB}.sink`)).exists,
      8000,
    );
    results.cases.EFF_X_07a_existing_x_both_shops_write = {
      id: "EFF-X-07a",
      schedule: 7,
      label: "EXISTING_X",
      cites: ["PREP_B_04"],
      jobA,
      jobB,
      worker_pid: xWorker.pid,
      shop_a_write_observed: Boolean(aLanded),
      shop_b_write_observed: Boolean(bLanded),
      shop_a_sink: residualFile(path.join(xDir, `shop-a.${jobA}.sink`)),
      shop_b_sink: residualFile(path.join(xDir, `shop-b.${jobB}.sink`)),
      assertion: aLanded && bLanded ? "PASS" : "FAIL",
      note: "EXISTING X has no shop publication fence. Both shops write. jobId isolation is not a privacy gate.",
    };
    killExact(xWorker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    // MODELED: shop-a ERASING, shop-b continues
    const mDir = path.join(SCRATCH, "modeled-a-fenced-b-writes");
    resetDir(mDir);
    const mStatus = path.join(mDir, "status.json");
    const fencePath = path.join(mDir, "fence.json");
    writeFileSync(fencePath, JSON.stringify({ "shop-a": "ERASING", "shop-b": "LIVE" }));
    const mWorker = spawnWorker(
      {
        STATUS_PATH: mStatus,
        SINK_DIR: mDir,
        TICK_LOG: path.join(mDir, "ticks.log"),
        TICKS: "2",
        TICK_MS: "40",
        CHECK_SHOP_FENCE: "1",
        CURRENT_FENCE_PATH: fencePath,
      },
      mDir,
    );
    track(mWorker.pid);
    await waitStatus(mStatus, "ready");
    const jobAf = "effx07-shop-a-fenced__d1";
    const jobBf = "effx07-shop-b-live__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", probe: "iso-modeled" },
      { jobId: jobAf },
    );
    await queue.add(
      "export-publish",
      { shopId: "shop-b", generation: "gen-9", probe: "iso-modeled" },
      { jobId: jobBf },
    );
    const bWrite = await waitUntil(
      async () => residualFile(path.join(mDir, `shop-b.${jobBf}.sink`)).exists,
      8000,
    );
    const aRefuse = await waitUntil(async () => {
      const p = path.join(mDir, `shop-a.${jobAf}.sink.refused`);
      return existsSync(p) ? residualFile(p) : null;
    }, 8000);
    await sleep(300);
    const aSink = residualFile(path.join(mDir, `shop-a.${jobAf}.sink`));
    const bSink = residualFile(path.join(mDir, `shop-b.${jobBf}.sink`));
    results.cases.EFF_X_07b_modeled_shop_a_fenced_shop_b_continues = {
      id: "EFF-X-07b",
      schedule: 7,
      label: "MODELED_PROPOSED",
      cites: ["PREP_B_04", "PREP_B_28"],
      jobAf,
      jobBf,
      worker_pid: mWorker.pid,
      shop_a_sink: aSink,
      shop_b_sink: bSink,
      shop_a_refused: aRefuse,
      shop_b_write_observed: Boolean(bWrite),
      assertion:
        aSink.exists === false && Boolean(aRefuse?.exists) && bSink.exists
          ? "PASS"
          : "FAIL",
      note: "MODELED PROPOSED shop fence is whole-shop only (fence[shopId]==='ERASING'). It refuses shop-A while shop-B is observed writing. It does not prove a customer-target fence. Not application integration. jobId isolation is still not a privacy gate.",
    };
    killExact(mWorker.pid, "SIGKILL");
    await sleep(40);
    await drainProbeQueue();

    // Probe-only: remove waiting shop-A, keep shop-B, then run worker
    const rDir = path.join(SCRATCH, "remove-a-keep-b");
    resetDir(rDir);
    const jobAr = "effx07-remove-a__d1";
    const jobBr = "effx07-keep-b__d1";
    const jobC1 = "effx07-cust-191167__d1";
    const jobC2 = "effx07-cust-191168__d1";
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", customerRestId: "191167" },
      { jobId: jobAr },
    );
    await queue.add(
      "export-publish",
      { shopId: "shop-b", generation: "gen-9", customerRestId: "200001" },
      { jobId: jobBr },
    );
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", customerRestId: "191167", probe: "cust" },
      { jobId: jobC1 },
    );
    await queue.add(
      "export-publish",
      { shopId: "shop-a", generation: "gen-1", customerRestId: "191168", probe: "cust" },
      { jobId: jobC2 },
    );
    const waiting = await queue.getJobs(["waiting", "delayed", "paused", "prioritized", "wait"]);
    const removed = [];
    const kept = [];
    for (const job of waiting) {
      const sid = job.data?.shopId;
      const rest = job.data?.customerRestId;
      if (sid === "shop-a" && rest === "191167") {
        await job.remove();
        removed.push({ id: job.id, shopId: sid, customerRestId: rest });
      } else {
        kept.push({
          id: job.id,
          shopId: sid,
          customerRestId: rest,
          state: await job.getState(),
        });
      }
    }
    const afterA = await inspectQueueDispatchPresence(queue, jobAr);
    const afterB = await inspectQueueDispatchPresence(queue, jobBr);
    const afterC2 = await inspectQueueDispatchPresence(queue, jobC2);
    const rStatus = path.join(rDir, "status.json");
    const rWorker = spawnWorker(
      {
        STATUS_PATH: rStatus,
        SINK_DIR: rDir,
        TICK_LOG: path.join(rDir, "ticks.log"),
        TICKS: "1",
        TICK_MS: "30",
      },
      rDir,
    );
    track(rWorker.pid);
    await waitStatus(rStatus, ["ready", "at_publication_gate", "published", "done"]);
    const bObs = await waitUntil(
      async () => residualFile(path.join(rDir, `shop-b.${jobBr}.sink`)).exists,
      8000,
    );
    const c2Obs = await waitUntil(
      async () => residualFile(path.join(rDir, `shop-a.${jobC2}.sink`)).exists,
      8000,
    );
    await sleep(400);
    const aObs = residualFile(path.join(rDir, `shop-a.${jobAr}.sink`));
    results.cases.EFF_X_07c_probe_only_scoped_remove_keeps_b_and_other_customer = {
      id: "EFF-X-07c",
      schedule: 7,
      label: "EXISTING_X",
      cites: ["PREP_B_03", "PREP_B_04"],
      removed,
      kept,
      afterA,
      afterB,
      afterC2,
      classifiedB: await classifyJob(jobBr),
      shop_a_removed_job_write_observed: aObs.exists,
      shop_b_write_observed: Boolean(bObs),
      other_customer_191168_write_observed: Boolean(c2Obs),
      flushall_executed: false,
      assertion:
        afterA.status === "MISSING" &&
        Boolean(bObs) &&
        Boolean(c2Obs) &&
        aObs.exists === false
          ? "PASS"
          : "FAIL",
      note: "PROBE-ONLY scoped Job.remove of shop-A customer 191167. Shop-B and the other shop-A customer continued to write. jobId isolation ≠ privacy gate. FLUSHALL not executed. X has no production removeShopQueueJobsExceptPrivacy.",
    };
    killExact(rWorker.pid, "SIGKILL");
  } catch (error) {
    results.fatal = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    };
  } finally {
    for (const pid of results.ownedPids) {
      if (alive(pid)) killExact(pid, "SIGKILL");
    }
    await queue.close().catch(() => undefined);
    await connection.quit().catch(() => undefined);
  }
  writeJson(OUT, results);
  console.log(
    JSON.stringify({
      wrote: OUT,
      cases: Object.keys(results.cases),
      fatal: results.fatal ?? null,
    }),
  );
}

void main();
```
<!-- PROOF-EXTRACT:end path=probes/03-shop-isolation.mjs -->

### EXTRACT `probes/04-dscratch.mjs`

<!-- PROOF-EXTRACT:begin path=probes/04-dscratch.mjs -->
```javascript
/**
 * Helper B — D-scratch schedules 8, 9, 10 using X source-stage APIs.
 * quiescenceConfirmed is an admission token, not liveness.
 * Do not treat reclaim as a privacy drain.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PARK_CHILD,
  TSX,
  alive,
  codeOf,
  enumerateDir,
  killExact,
  residualFile,
  resetDir,
  sha256,
  sleep,
  spawnParkChild,
  waitStatus,
  writeJson,
  requireProbeOut,
  requireProbeScratch,
  xHref,
} from "./probe-lib.mjs";
const {
  createOwnedScratchDir,
  disposeOwnedScratch,
  inspectDScratchOccupancy,
  reclaimOperatorSelectedDScratch,
  reinitializeDScratchReservationLedgerAfterQuiescence,
  sanitizeDScratchOccupancy,
} = await import(xHref("app/lib/order-facts/sync/source-stage.ts"));
const { ORDER_FACTS_SCRATCH_QUOTA_LOCK } = await import(
  xHref("app/lib/order-facts/sync/constants.ts")
);

const OUT = requireProbeOut();
const ROOT = requireProbeScratch();

mkdirSync(ROOT, { recursive: true });

const results = {
  kind: "HELPER_B_D_SCRATCH",
  scratchRoot: ROOT,
  imported_from: "STOCKY_PLUS_ROOT/app/lib/order-facts/sync/source-stage.ts",
  runbook: "STOCKY_PLUS_ROOT/docs/phases/phase-1/PR6_D_SCRATCH_OPERATOR_RUNBOOK.md",
  cases: {},
  ownedPids: [],
};

function track(pid) {
  if (pid) results.ownedPids.push(pid);
}

async function main() {
  try {
    // ------------------------------------------------------------------
    // EFF-X-08 — failed/unknown reclamation remains incomplete
    // ------------------------------------------------------------------
    const unkRoot = path.join(ROOT, "unknown-reclaim");
    mkdirSync(unkRoot, { recursive: true });
    const live = await createOwnedScratchDir({
      shopId: "shop-live",
      syncRunId: "run-live",
      scratchRoot: unkRoot,
      reservedBytes: 4096,
      maxScratchBytes: 50_000,
    });
    writeFileSync(path.join(live.dir, "payload.bin"), "owned-bytes");
    const markerless = path.join(unkRoot, "att-markerless");
    mkdirSync(markerless, { recursive: true });
    writeFileSync(path.join(markerless, "source.jsonl"), "keep-unknown\n");
    const markerlessHash = sha256(readFileSync(path.join(markerless, "source.jsonl")));
    const reclaimUnknown = await reclaimOperatorSelectedDScratch({
      scratchRoot: unkRoot,
      attemptBasenames: ["att-markerless", path.basename(live.dir)],
      quiescenceConfirmed: true,
    });
    const occUnknown = await inspectDScratchOccupancy({
      scratchRoot: unkRoot,
      maxScratchBytes: 50_000,
    });
    const sanitized = sanitizeDScratchOccupancy(occUnknown);
    results.cases.EFF_X_08_failed_unknown_reclamation_keeps_incomplete = {
      id: "EFF-X-08",
      schedule: 8,
      label: "EXISTING_X",
      cites: ["PREP_B_15", "PREP_B_20", "PREP_B_29"],
      reclaimUnknown,
      occupancy: sanitized,
      unknownAttemptCount: occUnknown.unknownAttemptCount,
      operatorInterventionRequired: occUnknown.operatorInterventionRequired,
      markerless_still_exists: existsSync(markerless),
      markerless_untouched:
        sha256(readFileSync(path.join(markerless, "source.jsonl"))) === markerlessHash,
      live_still_exists: existsSync(live.dir),
      privacy_request_may_complete: false,
      assertion:
        occUnknown.operatorInterventionRequired === true &&
        occUnknown.unknownAttemptCount >= 1 &&
        existsSync(markerless) &&
        reclaimUnknown.skipped.some((s) => s.reason === "not_verified_d_resource" || s.reason === "live_writer")
          ? "PASS"
          : "FAIL",
      note: "Unknown/markerless leftover is skipped, not swept. Occupancy requires operator intervention. Inability to prove reclamation keeps a privacy request incomplete. Do not auto-call reclaim as a privacy drain.",
    };

    // ------------------------------------------------------------------
    // EFF-X-09 — foreign process reclaim with quiescenceConfirmed while live child writes
    // ------------------------------------------------------------------
    const live2Root = path.join(ROOT, "cross-proc");
    mkdirSync(live2Root, { recursive: true });
    const status2 = path.join(live2Root, "park.json");
    const child2 = spawnParkChild(
      {
        PR6_D_LIVE_STATUS_PATH: status2,
        PR6_D_LIVE_SCRATCH_ROOT: live2Root,
        PR6_D_LIVE_SHOP_ID: "live-shop",
        PR6_D_LIVE_RUN_ID: "live-run",
        PR6_D_LIVE_PAYLOAD: "STILL-WRITING",
        PR6_D_LIVE_RESERVED: "2048",
        PR6_D_LIVE_MAX_BYTES: "20000",
        PR6_D_LIVE_HOLD_MS: "120000",
        PR6_D_LIVE_TICK_MS: "150",
      },
      live2Root,
    );
    track(child2.pid);
    const parked2 = await waitStatus(status2, "parked", 20000);
    const child2Pid = Number(parked2.pid);
    track(child2Pid);
    const basename2 = String(parked2.basename);
    const live2Dir = String(parked2.dir);
    const heartbeatBefore = residualFile(path.join(live2Dir, "heartbeat.txt"));
    let child2AliveBefore = alive(child2Pid);
    const reclaimWhileLive = await reclaimOperatorSelectedDScratch({
      scratchRoot: live2Root,
      attemptBasenames: [basename2],
      quiescenceConfirmed: true,
    });
    const dirAfter = existsSync(live2Dir);
    const child2AliveAfter = alive(child2Pid);
    results.cases.EFF_X_09_foreign_reclaim_deletes_live_child_att = {
      id: "EFF-X-09",
      schedule: 9,
      label: "EXISTING_X",
      cites: ["PREP_B_19"],
      child2Pid,
      wrapper_pid: child2.pid,
      child2_alive_before_reclaim: child2AliveBefore,
      child2_alive_after_reclaim: child2AliveAfter,
      heartbeat_before: heartbeatBefore,
      reclaimWhileLive,
      dir_exists_after_foreign_reclaim: dirAfter,
      assertion:
        child2AliveBefore === true &&
        dirAfter === false &&
        reclaimWhileLive.reclaimed.includes(basename2)
          ? "PASS"
          : "FAIL",
      note: "X live_writer skip is process-local (in-process set or marker.pid === process.pid). Parent process passed quiescenceConfirmed:true and deleted a still-live child's att-*. The boolean is an operator admission token, not liveness. This is evidence PR7 must supply an external-quiescence precondition; it is not grounds to reopen merged PR6. Do not auto-call reclaim as a privacy drain.",
    };
    killExact(child2Pid, "SIGKILL");
    if (child2.pid && child2.pid !== child2Pid) killExact(child2.pid, "SIGKILL");

    // ------------------------------------------------------------------
    // EFF-X-10 — uncertain reclamation: missing ledger / unknown attempts
    // ------------------------------------------------------------------
    const missRoot = path.join(ROOT, "missing-ledger");
    mkdirSync(missRoot, { recursive: true });
    const missLive = await createOwnedScratchDir({
      shopId: "miss-shop",
      syncRunId: "miss-run",
      scratchRoot: missRoot,
      reservedBytes: 1024,
      maxScratchBytes: 20_000,
    });
    const quotaFile = path.join(missRoot, "quota.reservation");
    const quotaExisted = existsSync(quotaFile);
    if (quotaExisted) {
      writeFileSync(path.join(missRoot, "quota.reservation.bak-bytes"), readFileSync(quotaFile));
      rmSync(quotaFile);
    }
    const occMissing = await inspectDScratchOccupancy({
      scratchRoot: missRoot,
      maxScratchBytes: 20_000,
    });
    let reinitWhileAtt = null;
    try {
      await reinitializeDScratchReservationLedgerAfterQuiescence({
        scratchRoot: missRoot,
        quiescenceConfirmed: true,
      });
    } catch (error) {
      reinitWhileAtt = codeOf(error);
    }
    results.cases.EFF_X_10a_missing_ledger_is_not_empty = {
      id: "EFF-X-10a",
      schedule: 10,
      label: "EXISTING_X",
      cites: ["PREP_B_09", "PREP_B_20", "PREP_B_20b"],
      quota_existed_before_delete: quotaExisted,
      occupancy: sanitizeDScratchOccupancy(occMissing),
      ledgerIntegrity: occMissing.ledgerIntegrity,
      operatorInterventionRequired: occMissing.operatorInterventionRequired,
      leftover_att_exists: existsSync(missLive.dir),
      reinit_while_att: reinitWhileAtt,
      assertion:
        occMissing.operatorInterventionRequired === true &&
        occMissing.ledgerIntegrity !== "ok" &&
        reinitWhileAtt === "scratch_resource_exhausted"
          ? "PASS"
          : "FAIL",
      note: "A missing ledger in an initialized namespace is not empty occupancy. Reinitialize while att-* remain is refused. Uncertain reclamation stays incomplete.",
    };

    const unk2 = path.join(ROOT, "unknown-attempts");
    mkdirSync(unk2, { recursive: true });
    const owned2 = await createOwnedScratchDir({
      shopId: "u2",
      syncRunId: "u2",
      scratchRoot: unk2,
      reservedBytes: 1024,
      maxScratchBytes: 20_000,
    });
    mkdirSync(path.join(unk2, "att-unknown-identity"), { recursive: true });
    writeFileSync(path.join(unk2, "att-unknown-identity", "x.bin"), "orphan");
    const occU2 = await inspectDScratchOccupancy({
      scratchRoot: unk2,
      maxScratchBytes: 20_000,
    });
    results.cases.EFF_X_10b_unknown_attempts_operator_intervention = {
      id: "EFF-X-10b",
      schedule: 10,
      label: "EXISTING_X",
      cites: ["PREP_B_20"],
      occupancy: sanitizeDScratchOccupancy(occU2),
      unknownAttemptCount: occU2.unknownAttemptCount,
      operatorInterventionRequired: occU2.operatorInterventionRequired,
      assertion:
        occU2.unknownAttemptCount >= 1 && occU2.operatorInterventionRequired === true
          ? "PASS"
          : "FAIL",
      note: "Unknown attempt identity requires operator intervention. Occupancy operatorInterventionRequired is not a drain and not permission to sweep.",
    };
    await disposeOwnedScratch(owned2, unk2).catch(() => undefined);
    await disposeOwnedScratch(live, unkRoot).catch(() => undefined);

    results.cases.EFF_X_10c_quiescence_confirmed_is_not_drain = {
      id: "EFF-X-10c",
      schedule: 10,
      label: "EXISTING_X",
      cites: ["PREP_B_19", "PREP_B_21"],
      assertion: "PASS",
      rule: "quiescenceConfirmed is an admission token, not liveness, not worker drain, not shop-wide completeness. PR7 must not auto-call reclaimOperatorSelectedDScratch until every process able to write the namespace is actually quiescent. When that cannot be established, keep the privacy request incomplete/escalated. Do not reopen merged PR6.",
    };

    results.park_child = PARK_CHILD;
    results.tsx = TSX;
    results.leftover_listing = enumerateDir(ROOT);
  } catch (error) {
    results.fatal = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    };
  } finally {
    for (const pid of results.ownedPids) {
      if (alive(pid)) killExact(pid, "SIGKILL");
    }
  }
  writeJson(OUT, results);
  console.log(
    JSON.stringify({
      wrote: OUT,
      cases: Object.keys(results.cases),
      fatal: results.fatal ?? null,
      scratchRoot: ROOT,
    }),
  );
}

void main();
```
<!-- PROOF-EXTRACT:end path=probes/04-dscratch.mjs -->

### EXTRACT `probes/99-teardown.sh`

<!-- PROOF-EXTRACT:begin path=probes/99-teardown.sh -->
```bash
#!/usr/bin/env bash
# Optional Redis teardown for a PID this run started. No FLUSHALL. No pkill.
# Requires TEARDOWN_REDIS=1 and REDIS_PID_FILE. Does not kill foreign PIDs.
set -euo pipefail
: "${PROBE_OUT:?}"
if [[ "${TEARDOWN_REDIS:-0}" != "1" ]]; then
  python3 - <<'PY'
import json, os, socket
from pathlib import Path
out = Path(os.environ["PROBE_OUT"])
out.parent.mkdir(parents=True, exist_ok=True)
def connect_ex(port):
    s=socket.socket(); s.settimeout(0.4)
    try:
        return s.connect_ex(("127.0.0.1", port))
    finally:
        s.close()
doc = {
  "kind": "EFF_X_TEARDOWN",
  "skipped": True,
  "reason": "TEARDOWN_REDIS!=1",
  "flushall_executed": False,
  "pkill_executed": False,
  "port_6379": connect_ex(6379),
}
out.write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps({"wrote": str(out), "skipped": True}))
PY
  exit 0
fi
: "${REDIS_PID_FILE:?REDIS_PID_FILE required when TEARDOWN_REDIS=1}"
REDIS_PID="$(cat "$REDIS_PID_FILE")"
python3 - "$PROBE_OUT" "$REDIS_PID" <<'PY'
import json, os, socket, sys, time
from pathlib import Path
out = Path(sys.argv[1])
pid = int(sys.argv[2])

def connect_ex(port):
    s=socket.socket(); s.settimeout(0.4)
    try:
        return s.connect_ex(("127.0.0.1", port))
    finally:
        s.close()

before = {
    "redis_pid": pid,
    "proc_exists_before": Path(f"/proc/{pid}").exists(),
    "port_6379_before": connect_ex(6379),
}
kill = {"pid": pid, "sig": "SIGTERM", "ok": False, "error": None}
try:
    os.kill(pid, 15)
    kill["ok"] = True
except ProcessLookupError:
    kill["error"] = "ESRCH"
except OSError as e:
    kill["error"] = str(e)

deadline = time.time() + 5
while time.time() < deadline and Path(f"/proc/{pid}").exists():
    time.sleep(0.05)

kill2 = None
if Path(f"/proc/{pid}").exists():
    try:
        os.kill(pid, 9)
        kill2 = {"pid": pid, "sig": "SIGKILL", "ok": True}
    except ProcessLookupError:
        kill2 = {"pid": pid, "sig": "SIGKILL", "ok": False, "error": "ESRCH"}
    deadline = time.time() + 2
    while time.time() < deadline and Path(f"/proc/{pid}").exists():
        time.sleep(0.05)

after = {
    "proc_exists_after": Path(f"/proc/{pid}").exists(),
    "port_6379_after": connect_ex(6379),
}
doc = {
    "kind": "EFF_X_TEARDOWN",
    "killed": [kill] + ([kill2] if kill2 else []),
    "before": before,
    "after": after,
    "flushall_executed": False,
    "pkill_executed": False,
    "6379_untouched_refused": after["port_6379_after"] == 111,
}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps({"wrote": str(out), "killed_pid": pid, "proc": after["proc_exists_after"]}))
PY
```
<!-- PROOF-EXTRACT:end path=probes/99-teardown.sh -->

### EXTRACT `probes/_import-check.mjs`

<!-- PROOF-EXTRACT:begin path=probes/_import-check.mjs -->
```javascript
/**
 * Disposable import check for X primitives. Not a schedule.
 */
import { xHref } from "./probe-lib.mjs";

async function main() {
  const qp = await import(xHref("app/sync/queue-presence.server.ts"));
  console.log(
    JSON.stringify({
      queuePresence: {
        runnable: qp.RUNNABLE_BULLMQ_STATES,
        classifyExistingQueueJob: typeof qp.classifyExistingQueueJob,
        inspectQueueDispatchPresence: typeof qp.inspectQueueDispatchPresence,
      },
    }),
  );
  try {
    const q = await import(xHref("app/jobs/queue.server.ts"));
    let redisUrl = null;
    let redisUrlError = null;
    try {
      redisUrl = q.requireRedisUrl();
    } catch (e) {
      redisUrlError = e instanceof Error ? e.message : String(e);
    }
    console.log(
      JSON.stringify({
        queueServer: {
          loaded: true,
          WEBHOOK_QUEUE: q.WEBHOOK_QUEUE,
          CRON_QUEUE: q.CRON_QUEUE,
          requireRedisUrl: redisUrl,
          requireRedisUrlError: redisUrlError,
        },
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        queueServer: {
          loaded: false,
          error: e instanceof Error ? e.message : String(e),
        },
      }),
    );
  }
  try {
    const s = await import(xHref("app/lib/order-facts/sync/source-stage.ts"));
    console.log(
      JSON.stringify({
        sourceStage: {
          loaded: true,
          inspectDScratchOccupancy: typeof s.inspectDScratchOccupancy,
          reclaimOperatorSelectedDScratch: typeof s.reclaimOperatorSelectedDScratch,
          createOwnedScratchDir: typeof s.createOwnedScratchDir,
        },
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        sourceStage: {
          loaded: false,
          error: e instanceof Error ? e.message : String(e),
        },
      }),
    );
  }
}

void main();
```
<!-- PROOF-EXTRACT:end path=probes/_import-check.mjs -->

### EXTRACT `probes/assert_taxonomy.mjs`

<!-- PROOF-EXTRACT:begin path=probes/assert_taxonomy.mjs -->
```javascript
#!/usr/bin/env node
/**
 * Compare EFF-X result JSON files against portable expected_taxonomy.json.
 * Ignores sink SHA-256, PIDs, and timestamps.
 */
import fs from "node:fs";
import path from "node:path";

const resultsDir = process.argv[2];
const expectedPath = process.argv[3];
if (!resultsDir || !expectedPath) {
  console.error("usage: assert_taxonomy.mjs <resultsDir> <expected_taxonomy.json>");
  process.exit(2);
}
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const files = [
  "01-publication-boundary.json",
  "02-remove-death-ttl-drain.json",
  "03-shop-isolation.json",
  "04-dscratch.json",
];
const byId = {};
const fatals = [];
for (const name of files) {
  const p = path.join(resultsDir, name);
  const doc = JSON.parse(fs.readFileSync(p, "utf8"));
  if (doc.fatal) fatals.push({ file: name, fatal: doc.fatal });
  for (const v of Object.values(doc.cases || {})) {
    if (v && typeof v === "object" && v.id) byId[v.id] = v;
  }
}
const errors = [];
if (fatals.length) errors.push(`fatal present: ${JSON.stringify(fatals)}`);
for (const [id, want] of Object.entries(expected.cases)) {
  const got = byId[id];
  if (!got) {
    errors.push(`missing ${id}`);
    continue;
  }
  if (got.assertion !== want.assertion) {
    errors.push(`${id} assertion got=${got.assertion} want=${want.assertion}`);
  }
  if (want.label && got.label !== want.label) {
    errors.push(`${id} label got=${got.label} want=${want.label}`);
  }
  for (const [k, v] of Object.entries(want)) {
    if (k === "assertion" || k === "label" || k === "classified") continue;
    if (k in got && got[k] !== v) errors.push(`${id}.${k} got=${got[k]} want=${v}`);
  }
  if (want.classified && got.classifiedAfter?.status && got.classifiedAfter.status !== want.classified) {
    errors.push(`${id} classifiedAfter ${got.classifiedAfter.status} want ${want.classified}`);
  }
  if (want.classified && got.drainClassified?.status && got.drainClassified.status !== want.classified) {
    errors.push(`${id} drainClassified ${got.drainClassified.status} want ${want.classified}`);
  }
}
const report = {
  ok: errors.length === 0,
  errors,
  observedIds: Object.keys(byId).sort(),
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
```
<!-- PROOF-EXTRACT:end path=probes/assert_taxonomy.mjs -->

### EXTRACT `probes/probe-lib.mjs`

<!-- PROOF-EXTRACT:begin path=probes/probe-lib.mjs -->
```javascript
/**
 * Shared published EFF-X probe utilities. Disposable. Not application runtime.
 * Paths come from STOCKY_PLUS_ROOT / STOCKY_NODE_MODULES / PROOF_ROOT / REDIS_URL.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

export const CHECKOUT = mustEnv("STOCKY_PLUS_ROOT");
export const NODE_MODULES =
  process.env.STOCKY_NODE_MODULES || path.join(CHECKOUT, "node_modules");
export const PROOF_ROOT =
  process.env.PROOF_ROOT || path.dirname(fileURLToPath(import.meta.url));
export const TSX = `${NODE_MODULES}/tsx/dist/cli.mjs`;
export const WORKER = path.join(PROOF_ROOT, "publication-worker.mjs");
export const PARK_CHILD = path.join(PROOF_ROOT, "scratch-park-child.mjs");
export const QUEUE_NAME = process.env.PROBE_QUEUE_NAME ?? "pr7finalB-effects";
export const KEY_PREFIX = process.env.PROBE_KEY_PREFIX ?? "pr7finalB:";
export const REDIS_URL = mustEnv("REDIS_URL");

export const requireCjs = createRequire(path.join(NODE_MODULES, "bullmq/package.json"));

export function xHref(rel) {
  return pathToFileURL(path.join(CHECKOUT, rel)).href;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export async function waitFile(p, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(p)) return readFileSync(p, "utf8");
    await sleep(20);
  }
  throw new Error(`timeout waiting for ${p}`);
}

export async function waitStatus(statusPath, stage, timeoutMs = 15000) {
  const start = Date.now();
  const wanted = Array.isArray(stage) ? stage : [stage];
  while (Date.now() - start < timeoutMs) {
    if (existsSync(statusPath)) {
      try {
        const parsed = JSON.parse(readFileSync(statusPath, "utf8").trim());
        if (wanted.includes(parsed.stage)) return parsed;
      } catch {
        /* mid-write */
      }
    }
    await sleep(20);
  }
  throw new Error(`timeout waiting for stage=${wanted.join("|")} at ${statusPath}`);
}

export async function waitUntil(fn, timeoutMs = 12000, pollMs = 25) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(pollMs);
  }
  return last;
}

export function killExact(pid, sig = "SIGKILL") {
  if (!pid) return { pid, sig, ok: false, code: "no_pid" };
  try {
    process.kill(pid, sig);
    return { pid, sig, ok: true };
  } catch (error) {
    return {
      pid,
      sig,
      ok: false,
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : String(error),
    };
  }
}

export function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function spawnLogged(argv, env, cwd, errLog) {
  mkdirSync(path.dirname(errLog), { recursive: true });
  const child = spawn(argv[0], argv.slice(1), {
    cwd,
    env: {
      ...process.env,
      NODE_PATH: NODE_MODULES,
      STOCKY_PLUS_ROOT: CHECKOUT,
      STOCKY_NODE_MODULES: NODE_MODULES,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr?.on("data", (buf) => appendFileSync(errLog, buf));
  child.stdout?.on("data", (buf) => appendFileSync(errLog, buf));
  return child;
}

export function spawnWorker(env, scratch) {
  const errLog = path.join(
    scratch,
    `worker-stderr-${Date.now()}-${Math.random().toString(16).slice(2)}.log`,
  );
  return spawnLogged(
    [process.execPath, WORKER],
    {
      REDIS_URL,
      QUEUE_NAME,
      LOCK_DURATION_MS: "5000",
      STOCKY_PLUS_ROOT: CHECKOUT,
      STOCKY_NODE_MODULES: NODE_MODULES,
      ...env,
    },
    NODE_MODULES,
    errLog,
  );
}

export function spawnParkChild(env, scratch) {
  const errLog = path.join(scratch, `park-stderr-${Date.now()}.log`);
  return spawnLogged(
    [process.execPath, TSX, PARK_CHILD],
    {
      STOCKY_PLUS_ROOT: CHECKOUT,
      STOCKY_NODE_MODULES: NODE_MODULES,
      ...env,
    },
    CHECKOUT,
    errLog,
  );
}

export function enumerateDir(dir) {
  if (!existsSync(dir)) return { exists: false, entries: [] };
  const names = readdirSync(dir);
  const entries = names.map((name) => {
    const full = path.join(dir, name);
    const st = statSync(full, { throwIfNoEntry: false }) ?? null;
    let digest = null;
    try {
      if (st?.isFile()) digest = sha256(readFileSync(full));
    } catch {
      digest = "unreadable";
    }
    return {
      name,
      bytes: st?.size ?? null,
      sha256: digest,
      mtimeMs: st?.mtimeMs ?? null,
    };
  });
  return { exists: true, entries };
}

export function residualFile(p) {
  if (!existsSync(p)) {
    return { exists: false, bytes: 0, sha256: null };
  }
  const buf = readFileSync(p);
  return { exists: true, bytes: buf.length, sha256: sha256(buf) };
}

export function resetDir(dir) {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

export function writeJson(p, obj) {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

export function tickLinesAfter(logText, afterTs) {
  return logText
    .split("\n")
    .filter((l) => l.startsWith("tick ") && Number(l.match(/t=(\d+)/)?.[1] ?? 0) > afterTs);
}

export function connectEx(port) {
  return new Promise((resolve) => {
    import("node:net").then(({ default: net }) => {
      const s = net.connect({ host: "127.0.0.1", port });
      s.setTimeout(300);
      s.on("connect", () => {
        s.end();
        resolve(0);
      });
      s.on("error", (err) => resolve(err && "code" in err && err.code === "ECONNREFUSED" ? 111 : 1));
      s.on("timeout", () => {
        s.destroy();
        resolve(1);
      });
    });
  });
}

export function codeOf(error) {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export function requireProbeOut() {
  const out = process.env.PROBE_OUT;
  if (!out) throw new Error("PROBE_OUT required");
  return out;
}

export function requireProbeScratch() {
  const scratch = process.env.PROBE_SCRATCH;
  if (!scratch) throw new Error("PROBE_SCRATCH required");
  return scratch;
}
```
<!-- PROOF-EXTRACT:end path=probes/probe-lib.mjs -->

### EXTRACT `probes/publication-worker.mjs`

<!-- PROOF-EXTRACT:begin path=probes/publication-worker.mjs -->
```javascript
/**
 * Feasibility worker. REAL BullMQ Worker on unique probe queue.
 * Not PR7 application runtime. Not stocky-webhooks.
 *
 * Publication gate: process has sink path/credential, then optionally waits
 * on BARRIER_PATH before the first sink write. Generation/shop fences are
 * MODELED PROPOSED when CHECK_*_FENCE=1; EXISTING X when those flags are 0.
 */
import { createRequire } from "node:module";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const nm = process.env.STOCKY_NODE_MODULES;
if (!nm) throw new Error("STOCKY_NODE_MODULES required");
const require = createRequire(path.join(nm, "bullmq/package.json"));
const { Worker } = require("bullmq");
const IORedis = require("ioredis");

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

const redisUrl = mustEnv("REDIS_URL");
const queueName = mustEnv("QUEUE_NAME");
const statusPath = mustEnv("STATUS_PATH");
const sinkDir = mustEnv("SINK_DIR");
const tickLog = process.env.TICK_LOG ?? path.join(sinkDir, "ticks.log");
const barrierPath = process.env.BARRIER_PATH || "";
const currentGenPath = process.env.CURRENT_GEN_PATH || "";
const currentFencePath = process.env.CURRENT_FENCE_PATH || "";
const checkGen = process.env.CHECK_GENERATION_FENCE === "1";
const checkShop = process.env.CHECK_SHOP_FENCE === "1";
const ticks = Number(process.env.TICKS ?? "8");
const tickMs = Number(process.env.TICK_MS ?? "80");
const lockDuration = Number(process.env.LOCK_DURATION_MS ?? "5000");
const barrierTimeoutMs = Number(process.env.BARRIER_TIMEOUT_MS ?? "20000");

mkdirSync(sinkDir, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function writeStatus(obj) {
  writeFileSync(statusPath, `${JSON.stringify({ ...obj, pid: process.pid })}\n`);
}

async function waitBarrier() {
  if (!barrierPath) return { action: "none" };
  const start = Date.now();
  while (Date.now() - start < barrierTimeoutMs) {
    if (existsSync(barrierPath)) {
      const raw = readFileSync(barrierPath, "utf8").trim();
      if (raw === "GO" || raw === "ABORT") return { action: raw };
    }
    await sleep(20);
  }
  return { action: "TIMEOUT" };
}

function readText(p) {
  try {
    return readFileSync(p, "utf8").trim();
  } catch {
    return "";
  }
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  queueName,
  async (job) => {
    const shopId = String(job.data?.shopId ?? "unknown-shop");
    const generation = String(job.data?.generation ?? "unspecified");
    const sinkPath = path.join(sinkDir, `${shopId}.${job.id}.sink`);
    const shopSink = path.join(sinkDir, `${shopId}.sink`);
    const publishedPath = `${sinkPath}.published`;
    const refusedPath = `${sinkPath}.refused`;
    const startedPath = path.join(sinkDir, `${job.id}.started`);
    const donePath = path.join(sinkDir, `${job.id}.done`);

    writeFileSync(
      startedPath,
      JSON.stringify({
        pid: process.pid,
        jobId: job.id,
        shopId,
        generation,
        sinkPath,
        t: Date.now(),
      }),
    );
    writeStatus({
      stage: "at_publication_gate",
      jobId: job.id,
      shopId,
      generation,
      sinkPath,
      credential: sinkPath,
      fenceMode: {
        checkGeneration: checkGen,
        checkShop,
      },
      t: Date.now(),
    });

    const barrier = await waitBarrier();
    if (barrier.action === "ABORT" || barrier.action === "TIMEOUT") {
      writeFileSync(
        refusedPath,
        JSON.stringify({
          code: barrier.action === "ABORT" ? "barrier_abort" : "barrier_timeout",
          jobId: job.id,
          t: Date.now(),
        }),
      );
      appendFileSync(
        tickLog,
        `refused_barrier job=${job.id} action=${barrier.action} t=${Date.now()}\n`,
      );
      writeStatus({
        stage: "refused_barrier",
        jobId: job.id,
        action: barrier.action,
        t: Date.now(),
      });
      return;
    }

    if (checkGen) {
      const current = readText(currentGenPath);
      if (current && current !== generation) {
        writeFileSync(
          refusedPath,
          JSON.stringify({
            code: "stale_generation_publish_refused",
            jobGeneration: generation,
            currentGeneration: current,
            jobId: job.id,
            t: Date.now(),
          }),
        );
        appendFileSync(
          tickLog,
          `refused_stale_generation job=${job.id} payload=${generation} current=${current} t=${Date.now()}\n`,
        );
        writeStatus({
          stage: "refused_stale_generation",
          jobId: job.id,
          payloadGeneration: generation,
          currentGeneration: current,
          t: Date.now(),
        });
        throw new Error("stale_generation_publish_refused");
      }
    }

    if (checkShop) {
      let fence = {};
      try {
        fence = JSON.parse(readText(currentFencePath) || "{}");
      } catch {
        fence = {};
      }
      if (fence[shopId] === "ERASING") {
        writeFileSync(
          refusedPath,
          JSON.stringify({
            code: "shop_fence_publish_refused",
            shopId,
            fence: fence[shopId],
            jobId: job.id,
            t: Date.now(),
          }),
        );
        appendFileSync(
          tickLog,
          `refused_shop_fence job=${job.id} shop=${shopId} t=${Date.now()}\n`,
        );
        writeStatus({
          stage: "refused_shop_fence",
          jobId: job.id,
          shopId,
          t: Date.now(),
        });
        throw new Error("shop_fence_publish_refused");
      }
    }

    const payload = JSON.stringify({
      jobId: job.id,
      shopId,
      generation,
      t: Date.now(),
      pid: process.pid,
      probe: job.data?.probe ?? null,
    });
    writeFileSync(sinkPath, `${payload}\n`);
    writeFileSync(shopSink, `${payload}\n`);
    writeFileSync(
      publishedPath,
      JSON.stringify({ t: Date.now(), pid: process.pid, bytes: Buffer.byteLength(payload) }),
    );
    appendFileSync(
      tickLog,
      `published job=${job.id} shop=${shopId} gen=${generation} t=${Date.now()} path=${sinkPath}\n`,
    );
    writeStatus({
      stage: "published",
      jobId: job.id,
      shopId,
      sinkPath,
      t: Date.now(),
    });

    for (let i = 0; i < ticks; i += 1) {
      appendFileSync(
        tickLog,
        `tick i=${i} t=${Date.now()} pid=${process.pid} job=${job.id} shop=${shopId}\n`,
      );
      await sleep(tickMs);
    }
    writeFileSync(
      donePath,
      JSON.stringify({ t: Date.now(), pid: process.pid, jobId: job.id }),
    );
    appendFileSync(tickLog, `done job=${job.id} t=${Date.now()}\n`);
    writeStatus({
      stage: "done",
      jobId: job.id,
      t: Date.now(),
    });
  },
  {
    connection,
    concurrency: 2,
    lockDuration,
    stalledInterval: Math.max(250, Math.floor(lockDuration / 2)),
  },
);

worker.on("failed", (job, err) => {
  appendFileSync(
    tickLog,
    `failed job=${job?.id} err=${err?.message ?? "unknown"} t=${Date.now()}\n`,
  );
});

writeStatus({ stage: "ready", queueName, t: Date.now() });

const shutdown = async () => {
  await worker.close().catch(() => undefined);
  await connection.quit().catch(() => undefined);
  process.exit(0);
};
process.on("SIGTERM", () => {
  void shutdown();
});
```
<!-- PROOF-EXTRACT:end path=probes/publication-worker.mjs -->

### EXTRACT `probes/run.sh`

<!-- PROOF-EXTRACT:begin path=probes/run.sh -->
```bash
#!/usr/bin/env bash
# Published EFF-X orchestrator. Redis must already be up on REDIS_URL.
# Does not FLUSHALL. Does not pkill. Does not implement PR7 processors.
set -euo pipefail
: "${STOCKY_PLUS_ROOT:?STOCKY_PLUS_ROOT required}"
: "${PROOF_ROOT:?PROOF_ROOT required (extracted probes directory)}"
: "${REDIS_URL:?REDIS_URL required}"
: "${RESULTS_DIR:?RESULTS_DIR required}"
STOCKY_NODE_MODULES="${STOCKY_NODE_MODULES:-$STOCKY_PLUS_ROOT/node_modules}"
if [[ ! -d "$STOCKY_NODE_MODULES/bullmq" ]] || [[ ! -d "$STOCKY_NODE_MODULES/tsx" ]]; then
  echo "missing bullmq or tsx in $STOCKY_NODE_MODULES" >&2
  exit 1
fi
if [[ ! -e "$STOCKY_PLUS_ROOT/node_modules" ]]; then
  ln -sfn "$STOCKY_NODE_MODULES" "$STOCKY_PLUS_ROOT/node_modules"
fi
export STOCKY_PLUS_ROOT STOCKY_NODE_MODULES PROOF_ROOT REDIS_URL
export NODE_PATH="$STOCKY_NODE_MODULES"
TSX="$STOCKY_NODE_MODULES/tsx/dist/cli.mjs"
mkdir -p "$RESULTS_DIR"
PROBE_SCRATCH_ROOT="${PROBE_SCRATCH_ROOT:-$RESULTS_DIR/scratch}"
mkdir -p "$PROBE_SCRATCH_ROOT"
python3 "$(cd "$PROOF_ROOT/.." && pwd)/check_pins.py" --kind effects --stocky-plus-root "$STOCKY_PLUS_ROOT" --node-modules "$STOCKY_NODE_MODULES"

echo "== 00 isolation =="
PROBE_OUT="$RESULTS_DIR/00-isolation.json" bash "$PROOF_ROOT/00-isolation.sh"

echo "== 01 publication boundary =="
PROBE_OUT="$RESULTS_DIR/01-publication-boundary.json" \
PROBE_SCRATCH="$PROBE_SCRATCH_ROOT/publication" \
node "$TSX" "$PROOF_ROOT/01-publication-boundary.mjs"

echo "== 02 remove/death/ttl/drain =="
PROBE_OUT="$RESULTS_DIR/02-remove-death-ttl-drain.json" \
PROBE_SCRATCH="$PROBE_SCRATCH_ROOT/remove-death" \
node "$TSX" "$PROOF_ROOT/02-remove-death-ttl-drain.mjs"

echo "== 03 shop isolation =="
PROBE_OUT="$RESULTS_DIR/03-shop-isolation.json" \
PROBE_SCRATCH="$PROBE_SCRATCH_ROOT/shop-iso" \
node "$TSX" "$PROOF_ROOT/03-shop-isolation.mjs"

echo "== 04 dscratch =="
PROBE_OUT="$RESULTS_DIR/04-dscratch.json" \
PROBE_SCRATCH="$PROBE_SCRATCH_ROOT/dscratch" \
node "$TSX" "$PROOF_ROOT/04-dscratch.mjs"

echo "== done =="
ls -l "$RESULTS_DIR"
```
<!-- PROOF-EXTRACT:end path=probes/run.sh -->

### EXTRACT `probes/scratch-park-child.mjs`

<!-- PROOF-EXTRACT:begin path=probes/scratch-park-child.mjs -->
```javascript
/**
 * REAL X D-scratch park child. Imports createOwnedScratchDir from STOCKY_PLUS_ROOT.
 * Parks after writing a payload so the parent can observe live-writer reclaim.
 * Not power-loss. Not PR7 runtime.
 *
 * Plain ESM (.mjs) so tsx does not compile it as CJS (top-level-await in .ts
 * failed with esbuild "cjs" output during the first coordinator rerun).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const statusPath = process.env.PR6_D_LIVE_STATUS_PATH;
const scratchRoot = process.env.PR6_D_LIVE_SCRATCH_ROOT;
const shopId = process.env.PR6_D_LIVE_SHOP_ID ?? "probe-shop";
const runId = process.env.PR6_D_LIVE_RUN_ID ?? "probe-run";
const payload = process.env.PR6_D_LIVE_PAYLOAD ?? "LIVE-WORKER-BYTES";
const holdMs = Number(process.env.PR6_D_LIVE_HOLD_MS ?? "120000");

if (!statusPath || !scratchRoot) {
  throw new Error("missing park env");
}

async function main() {
  const root = process.env.STOCKY_PLUS_ROOT;
  if (!root) throw new Error("STOCKY_PLUS_ROOT required");
  const { createOwnedScratchDir } = await import(
    pathToFileURL(path.join(root, "app/lib/order-facts/sync/source-stage.ts")).href
  );
  const handle = await createOwnedScratchDir({
    shopId,
    syncRunId: runId,
    scratchRoot,
    reservedBytes: Number(process.env.PR6_D_LIVE_RESERVED ?? "4096"),
    maxScratchBytes: Number(process.env.PR6_D_LIVE_MAX_BYTES ?? "20000"),
  });
  const livePath = path.join(handle.dir, "LIVE-WORKER-BYTES.txt");
  writeFileSync(livePath, payload);
  writeFileSync(
    statusPath,
    `${JSON.stringify({
      stage: "parked",
      pid: process.pid,
      dir: handle.dir,
      livePath,
      basename: path.basename(handle.dir),
      reservedBytes: handle.reservedBytes,
    })}\n`,
  );
  const tickMs = Number(process.env.PR6_D_LIVE_TICK_MS ?? "200");
  const start = Date.now();
  while (Date.now() - start < holdMs) {
    writeFileSync(
      path.join(handle.dir, "heartbeat.txt"),
      `pid=${process.pid} t=${Date.now()}\n`,
    );
    await new Promise((r) => setTimeout(r, tickMs));
  }
  writeFileSync(
    statusPath,
    `${JSON.stringify({ stage: "exited", pid: process.pid, dir: handle.dir })}\n`,
  );
}

void main().catch((error) => {
  writeFileSync(
    statusPath,
    `${JSON.stringify({
      stage: "error",
      pid: process.pid,
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exit(1);
});
```
<!-- PROOF-EXTRACT:end path=probes/scratch-park-child.mjs -->

### EXTRACT `reproduce.sh`

<!-- PROOF-EXTRACT:begin path=reproduce.sh -->
```bash
#!/usr/bin/env bash
# Reproduce EFF-X from extracted proof inputs + pinned X node_modules + private Redis.
# Redis must already be listening on REDIS_URL. Does not FLUSHALL. Does not pkill.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
: "${STOCKY_PLUS_ROOT:?}"
: "${REDIS_URL:?}"
: "${RESULTS_DIR:?}"
export STOCKY_NODE_MODULES="${STOCKY_NODE_MODULES:-$STOCKY_PLUS_ROOT/node_modules}"
export PROOF_ROOT="${PROOF_ROOT:-$HERE/probes}"
export PROBE_SCRATCH_ROOT="${PROBE_SCRATCH_ROOT:-$RESULTS_DIR/scratch}"
bash "$PROOF_ROOT/run.sh"
node "$PROOF_ROOT/assert_taxonomy.mjs" "$RESULTS_DIR" "$HERE/expected_taxonomy.json"
```
<!-- PROOF-EXTRACT:end path=reproduce.sh -->
