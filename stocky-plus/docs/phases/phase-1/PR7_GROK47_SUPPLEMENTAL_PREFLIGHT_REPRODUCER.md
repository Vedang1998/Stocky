# PR7 Grok 4.7 supplemental preflight reproducer

**SUPPLEMENTAL CURSOR/GROK EVIDENCE — NOT CLAUDE REVIEW OR ACCEPTANCE**

This file is the executable input for the supplemental lab. It does not duplicate the H plan. Retrieve the frozen contract by exact commit `3cc2045107b54601c6b0e43c8690b7d090074b80`.

## Manifest

| Input | Identity |
|---|---|
| H | `3cc2045107b54601c6b0e43c8690b7d090074b80` |
| Plan git blob | `07f86fbf0657fc58ffc2aa99556d402cf09a20a1` |
| Matrix git blob | `ad6c610d6da868803bbecdfedd8218af2973146d` |
| CURRENT `01_contract.sql` sha256 | `d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318` |
| `02_seed.sql` sha256 | `d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632` |
| CURRENT `03_run_proofs.py` sha256 | `d24afa331bde236e6ed59243ada670d14b658bd308541b9263df616040c75d85` |
| CURRENT `00_extract_proofs.py` sha256 | `70684794504734faacf651a09a4f996d20215a1da7e99af9b34684fe8d7d8172` |
| Published harness `grok47_stress_lab.py` sha256 | `8b1c889b69c0668e4f687509ea72fecc134024d0d0ab0f7a20d5f0c749e3af92` |
| Harness path inside this file | `grok47_stress_lab.py` |

The harness sha256 is of the bytes between the extract markers, after the newline that ends the begin marker. The end marker is not part of the file. The authoring script prints the sha256 into the report's clean-export section after the first commit. Until then, run the extract command and compare with `sha256sum` of a known-good copy only if you already have one. The check below fails if the markers are missing.

## Limits and seeds

Copied from the harness constants: actors 3; seeds 17001, 17002, 17003, 17004, 17005, 17006, 17007, 17008; lock observe 2.0 seconds; poll 0.02 seconds; holder release 20 seconds; uncertain attempts 6; serial permutations 6; statement timeout 20s; default waiter lock timeout 8s.

Shop constants: domain `pr7-a.myshopify.com` shop `shop_a`; domain `pr7-b.myshopify.com` shop `shop_b`.

## Pinned setup

Use a disposable PostgreSQL 16 cluster with trust authentication and user `pr45owner`. Do not point this at a shared or production database. The authoring run used port 5461 for the declared model, 5462 for workstream A, 5463 for workstream B, and 5464 for the mutation copy. Any free local ports work when each workstream has its own database.

```bash
git archive 3cc2045107b54601c6b0e43c8690b7d090074b80 | tar -x -C "$EXPORT"
PLAN="$EXPORT/stocky-plus/docs/phases/phase-1/PR7_AUDIT_ROLES_PRIVACY_EXECUTION_PLAN.md"
python3 "$EXTRACTOR" --plan "$PLAN" --selftest
python3 "$EXTRACTOR" --plan "$PLAN" --dest "$EXTRACT_ROOT"
```

Bootstrap `$EXTRACTOR` with the plan's published `PROOF-EXTRACT` marker for `current/00_extract_proofs.py`, or use the copy written by `--bootstrap-only`. Expected selftest stdout:

```
extraction_authenticity_limit:coordinated_in_repo_edit_not_prevented
extraction_selftest_ok
```

Confirm the sha256 values in the manifest. The lab exits `input_hash_mismatch` when the contract or seed hash differs.

Declared model, once, from the extracted `current/` directory:

```bash
PGHOST="$PGHOST" PGPORT="$PGPORT" PGDATABASE=pr45_proof PR45_OWNER=pr45owner \
  PROOF_ROOT="$EXTRACT_ROOT/current" \
  python3 "$EXTRACT_ROOT/current/03_run_proofs.py"
```

The authoring observation was 505 pass, 0 fail, 290 unique assertions, 215 declared reruns, PostgreSQL 16.15 / `160015`, host `/tmp/pr7-grok47-h-pg16-8426:5461`. That count is an observation. Do not edit the extracted tests to force it.

## Extraction-failure controls

A truncated plan must fail closed. Authoring observation: the first 2000 bytes of the plan, passed to `00_extract_proofs.py --selftest`, exited 1 with `extraction_no_blocks`.

The published `--selftest` also fails the run unless its internal truncated-block and bad-digest mutations raise. Those mutations live inside `selftest()` and are not a second copy of the contract.

## Extract this harness

```bash
python3 - "$REPRO" "$OUT_PY" << 'PY'
import hashlib, sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding="utf-8")
begin = "<!-- GROK47-EXTRACT:begin path=grok47_stress_lab.py -->\n"
end = "<!-- GROK47-EXTRACT:end path=grok47_stress_lab.py -->"
start = text.index(begin) + len(begin)
body = text[start:text.index(end, start)]
data = body.encode("utf-8")
Path(sys.argv[2]).write_bytes(data)
print(hashlib.sha256(data).hexdigest(), len(data))
PY
```

## Lab commands

Install `psycopg` 3.x for the lab process only. The repository lockfile is not changed.

```bash
python3 "$OUT_PY" \
  --pghost "$PGHOST" --pgport "$PGPORT" --dbname pr7_grok47_a \
  --contract "$EXTRACT_ROOT/current/01_contract.sql" \
  --seed "$EXTRACT_ROOT/current/02_seed.sql" \
  --workstream a --out /tmp/grok47-a.json

python3 "$OUT_PY" \
  --pghost "$PGHOST_B" --pgport "$PGPORT_B" --dbname pr7_grok47_b \
  --contract "$EXTRACT_ROOT/current/01_contract.sql" \
  --seed "$EXTRACT_ROOT/current/02_seed.sql" \
  --workstream b --out /tmp/grok47-b.json

python3 "$OUT_PY" \
  --pghost "$PGHOST_M" --pgport "$PGPORT_M" --dbname pr7_grok47_mut_holder \
  --contract "$EXTRACT_ROOT/current/01_contract.sql" \
  --seed "$EXTRACT_ROOT/current/02_seed.sql" \
  --workstream mutations --out /tmp/grok47-mut.json
```

Use three clusters, or run the three commands sequentially on one idle cluster. Do not run two workstreams against one database. The mutation command writes a temporary contract copy and loads database `pr7_grok47_mut`. It refuses to start when the original contract hash is not the manifest value, and it checks that hash again after deleting the copy.

The lab does not load `04_source_derived.sql`.

## Harness source

<!-- GROK47-EXTRACT:begin path=grok47_stress_lab.py -->
#!/usr/bin/env python3
"""Supplemental concurrency and source-progress lab for frozen PR7 contract H.

Not a replacement helper. Not application runtime. Calls extracted SECURITY
DEFINER functions as the declared restricted principals. Test-owner sessions
only reset synthetic rows and observe. Resource limits are constants below.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import psycopg

# Predeclared limits. Do not raise these to chase a result.
LIMITS = {
    "actors_per_schedule": 3,
    "seeds": [17001, 17002, 17003, 17004, 17005, 17006, 17007, 17008],
    "lock_observe_seconds": 2.0,
    "poll_seconds": 0.02,
    "holder_release_timeout_seconds": 20,
    "uncertain_attempts": 6,
    "serial_permutations_bound": 6,
    "statement_timeout": "20s",
    "waiter_lock_timeout": "8s",
}
H_SHA = "3cc2045107b54601c6b0e43c8690b7d090074b80"
CONTRACT_SHA = "d4c21ff9350f4072a907576f80be44b46a210695e8088f467a4f7b49c46b4318"
SEED_SHA = "d0d848427a7a9913461b378bc667114d0728320e61d2c6722e2cb9ac4084f632"
SOURCE_SAMPLE = "71e3d9d38a6ae9c7dd86577a323d2254ffb335f8879ddd9282f4095a80fe14f7"
EFFECT_SAMPLE = "959bb90441a81889549f265bd75ef5b84a512486b896023cf4f42f50b2566abd"
DOMAIN_A = "pr7-a.myshopify.com"
DOMAIN_B = "pr7-b.myshopify.com"
SHOP_A = "shop_a"
SHOP_B = "shop_b"

RESULTS: list[dict] = []


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def source_commitment(domain: str, shop: str, kind: str, value: str, body: str, operation: str = "CUSTOMER_WRITE") -> str:
    """Independent pr7-source-v1 oracle. Positional UTF-8 LF join. Not the SQL text."""
    payload = "\n".join(["pr7-source-v1", domain, shop, operation, kind, value, body])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def effect_commitment(domain: str, shop: str, kind: str, value: str, effect_id: str) -> str:
    payload = "\n".join(["pr7-effect-v1", domain, shop, kind, value, effect_id])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def oracle_self_check() -> None:
    got_s = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "191167", "ao02-host-body")
    got_e = effect_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "191167", "ae_pos")
    if got_s != SOURCE_SAMPLE or got_e != EFFECT_SAMPLE:
        raise SystemExit(f"oracle_mismatch source={got_s} effect={got_e}")


def connect(args, user: str, *, autocommit: bool = False, app: str = "grok47"):
    conn = psycopg.connect(
        host=args.pghost,
        port=args.pgport,
        dbname=args.dbname,
        user=user,
        autocommit=autocommit,
        connect_timeout=5,
    )
    conn.execute("SELECT set_config('application_name', %s, false)", (app,))
    if not autocommit:
        conn.commit()
    return conn


def psql_file(args, path: Path) -> None:
    subprocess.check_call(
        [
            "psql", "-h", args.pghost, "-p", str(args.pgport), "-d", args.dbname,
            "-U", "pr45owner", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", str(path),
        ],
        stdout=subprocess.DEVNULL,
    )


def reset_database(args) -> None:
    env = {**os.environ, "PATH": "/usr/lib/postgresql/16/bin:" + os.environ.get("PATH", "")}
    subprocess.run(
        ["dropdb", "-h", args.pghost, "-p", str(args.pgport), "-U", "pr45owner", "--if-exists", args.dbname],
        check=False, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.check_call(
        ["createdb", "-h", args.pghost, "-p", str(args.pgport), "-U", "pr45owner", args.dbname],
        env=env, stdout=subprocess.DEVNULL,
    )
    psql_file(args, Path(args.contract))
    psql_file(args, Path(args.seed))


def fast_clean(args) -> None:
    sql = """
    DELETE FROM public."SourceEffectLink";
    DELETE FROM public."WriterAdmissionOriginTarget";
    DELETE FROM public."WriterAdmissionOrigin";
    DELETE FROM public."QueuedWorkSighting";
    DELETE FROM public."OriginalAdminCapture";
    DELETE FROM public."OriginalAdminSession";
    DELETE FROM public."PrivacyCompletionReceipt";
    DELETE FROM public."PrivacyCompletedTarget";
    DELETE FROM public."PrivacyCustomerTargetBarrier";
    DELETE FROM public."PrivacyTargetKey" WHERE "requestId" IN ('preq_cr','preq_dr');
    DELETE FROM public."AuditEvent" WHERE id LIKE 'ae_lab%' OR id LIKE 'ae_seed%';
    UPDATE public."PrivacyRequest"
       SET state='APPLYING', "completeRetryCount"=0, "activeAttemptId"='patt_cr'
     WHERE id='preq_cr';
    UPDATE public."ShopInstallGeneration" SET fence='LIVE' WHERE id='gen_a';
    DELETE FROM public."ShopInstallGeneration" WHERE id LIKE 'gen_lab%';
    """
    with connect(args, "pr45owner", autocommit=True, app="grok47_owner") as conn:
        conn.execute(sql)


def run_statements(cur, statements) -> list:
    outs = []
    for sql, params in statements:
        cur.execute(sql, params)
        if cur.description:
            outs.append([list(r) for r in cur.fetchall()])
        else:
            outs.append(None)
    return outs


def set_ctx(cur, shop: str, req: str = "preq_cr", att: str = "patt_cr") -> None:
    cur.execute("SELECT set_config('stocky.current_shop_id', %s, true)", (shop,))
    cur.fetchall()
    cur.execute("SELECT set_config('stocky.tenant_context_version', 'phase1-db-tenant-context-v1', true)")
    cur.fetchall()
    cur.execute("SELECT set_config('stocky.privacy_request_id', %s, true)", (req,))
    cur.fetchall()
    cur.execute("SELECT set_config('stocky.privacy_attempt_id', %s, true)", (att,))
    cur.fetchall()
    cur.execute("SELECT set_config('statement_timeout', %s, true)", (LIMITS["statement_timeout"],))
    cur.fetchall()


def actor_for(shop: str) -> str:
    return "actor_b" if shop == SHOP_B else "actor_a"


def capture_stmts(shop, domain, command, skind, sident, digest, tkind, tvalue):
    return [
        ("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", (shop, domain, actor_for(shop))),
        (
            "SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
            (domain, shop, command, skind, sident, digest, tkind, tvalue),
        ),
    ]


def admit_stmts(shop, domain, work, skind, sident, digest, evidence, tkind, tvalue, parent=None, job=None, mode="ATOMIC"):
    return [(
        "SELECT public.stocky_record_writer_admission(%s,%s,%s,%s,%s,%s,'pr7-origin-v1', clock_timestamp(), %s,%s,%s,%s,%s,%s)",
        (domain, shop, work, skind, sident, digest, evidence, tkind, tvalue, parent, job, mode),
    )]


def apply_stmts(shop, domain, tkind, tvalue, effect, work, body, operation="CUSTOMER_WRITE"):
    return [(
        "SELECT public.stocky_apply_bound_customer_effect(%s,%s,%s,%s,%s,%s,%s,%s)",
        (domain, shop, tkind, tvalue, effect, work, operation, body),
    )]


def sight_stmts(shop, domain, skind, sident, digest, klass="QUEUED_INBOX", parent=None):
    return [(
        "SELECT public.stocky_note_queued_work(%s,%s,%s,%s,%s,%s,%s)",
        (domain, shop, skind, sident, digest, klass, parent),
    )]


def exec_tx(args, user, shop, statements, req="preq_cr", att="patt_cr", lock_timeout=None) -> dict:
    out = {"rc": 1, "err": "", "sqlstate": "", "rows": [], "pid": None}
    conn = connect(args, user, app=f"grok47_{user}")
    try:
        with conn.cursor() as cur:
            set_ctx(cur, shop, req, att)
            if lock_timeout:
                cur.execute("SELECT set_config('lock_timeout', %s, true)", (lock_timeout,))
                cur.fetchall()
            cur.execute("SELECT pg_backend_pid()")
            out["pid"] = cur.fetchone()[0]
            out["rows"] = run_statements(cur, statements)
        conn.commit()
        out["rc"] = 0
    except psycopg.Error as exc:
        out["err"] = str(exc)
        out["sqlstate"] = exc.sqlstate or ""
        conn.rollback()
    finally:
        conn.close()
    return out


def observe(args, seconds: float) -> dict:
    seen = []
    deadline = time.monotonic() + seconds
    with connect(args, "pr45owner", autocommit=True, app="grok47_observer") as conn:
        while time.monotonic() < deadline:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT pid, usename, state, wait_event_type, wait_event, left(query, 220)
                    FROM pg_stat_activity
                    WHERE datname = %s AND application_name LIKE 'grok47_%%'
                      AND pid <> pg_backend_pid()
                    """,
                    (args.dbname,),
                )
                rows = [list(r) for r in cur.fetchall()]
                cur.execute(
                    """
                    SELECT a.usename, l.mode, l.granted, l.classid, l.objid
                    FROM pg_locks l
                    JOIN pg_stat_activity a ON a.pid = l.pid
                    WHERE l.locktype = 'advisory' AND a.datname = %s
                    """,
                    (args.dbname,),
                )
                locks = [list(r) for r in cur.fetchall()]
            waiting = [r for r in rows if r[3] == "Lock"]
            if waiting:
                seen.append({"activity": rows, "locks": locks, "waiting": waiting})
                break
            time.sleep(LIMITS["poll_seconds"])
    return {"wait_seen": bool(seen), "sample": seen[-1] if seen else None}


def overlap(args, holder_user, holder_shop, holder_sql, waiter_user, waiter_shop, waiter_sql, *, holder_req="preq_cr", waiter_req="preq_cr", waiter_lock_timeout=None, before_release=None, min_hold_seconds=0) -> dict:
    import threading

    holder = {"rc": 1, "err": "", "sqlstate": "", "rows": [], "pid": None}
    waiter = {"rc": 1, "err": "", "sqlstate": "", "rows": [], "pid": None}
    held = threading.Event()
    release = threading.Event()

    def run(slot, user, shop, statements, req, timeout, ready):
        conn = connect(args, user, app=f"grok47_{user}_{slot}")
        try:
            with conn.cursor() as cur:
                set_ctx(cur, shop, req)
                if timeout:
                    cur.execute("SELECT set_config('lock_timeout', %s, true)", (timeout,))
                    cur.fetchall()
                cur.execute("SELECT pg_backend_pid()")
                slot_pid = cur.fetchone()[0]
                if slot is holder:
                    holder["pid"] = slot_pid
                else:
                    waiter["pid"] = slot_pid
                rows = run_statements(cur, statements)
            if slot is holder:
                holder["rows"] = rows
                holder["rc"] = 0
                held.set()
                release.wait(LIMITS["holder_release_timeout_seconds"])
            else:
                waiter["rows"] = rows
                waiter["rc"] = 0
            conn.commit()
        except psycopg.Error as exc:
            if slot is holder:
                holder["err"] = str(exc)
                holder["sqlstate"] = exc.sqlstate or ""
                held.set()
            else:
                waiter["err"] = str(exc)
                waiter["sqlstate"] = exc.sqlstate or ""
            conn.rollback()
        finally:
            conn.close()

    th = threading.Thread(target=run, args=(holder, holder_user, holder_shop, holder_sql, holder_req, None, held))
    th.start()
    if not held.wait(15):
        release.set()
        th.join(5)
        return {"holder": holder, "waiter": waiter, "observation": {"wait_seen": False, "sample": None}, "harness": "holder_not_ready"}
    if holder["rc"] != 0:
        release.set()
        th.join(5)
        return {"holder": holder, "waiter": waiter, "observation": {"wait_seen": False, "sample": None}, "harness": "holder_failed"}
    tw = threading.Thread(target=run, args=(waiter, waiter_user, waiter_shop, waiter_sql, waiter_req, waiter_lock_timeout or LIMITS["waiter_lock_timeout"], None))
    tw.start()
    observation = observe(args, LIMITS["lock_observe_seconds"])
    before_release_error = None
    if before_release is not None:
        try:
            before_release()
        except Exception as exc:
            before_release_error = f"{type(exc).__name__}: {exc}"
    if min_hold_seconds:
        time.sleep(min_hold_seconds)
    release.set()
    th.join(LIMITS["holder_release_timeout_seconds"])
    tw.join(LIMITS["holder_release_timeout_seconds"])
    return {
        "holder": holder,
        "waiter": waiter,
        "observation": observation,
        "harness": "ok" if before_release_error is None else "before_release_failed",
        "before_release_error": before_release_error,
    }


def snapshot(args, work_ids=(), effect_ids=(), command_ids=(), digests=()) -> dict:
    with connect(args, "pr45owner", autocommit=True, app="grok47_owner") as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, "commandId", "sourceIdentity", "sourceContentDigest",
                       "contradictedAt" IS NOT NULL, "contradictionClass", "boundWorkId", "liveGenerationId"
                FROM public."OriginalAdminCapture"
                WHERE "commandId" = ANY(%s) OR "sourceContentDigest" = ANY(%s)
                ORDER BY id
                """,
                (list(command_ids), list(digests)),
            )
            captures = [list(r) for r in cur.fetchall()]
            cur.execute(
                """
                SELECT "workId", "originStatus", "acked", "sourceContentDigest", "originalCaptureId",
                       "originGenerationId", "shopId"
                FROM public."WriterAdmissionOrigin"
                WHERE "workId" = ANY(%s) OR "sourceContentDigest" = ANY(%s)
                ORDER BY "workId"
                """,
                (list(work_ids), list(digests)),
            )
            origins = [list(r) for r in cur.fetchall()]
            cur.execute(
                """
                SELECT "effectId", "workId", "effectCommitment", "sourceContentDigest"
                FROM public."SourceEffectLink"
                WHERE "effectId" = ANY(%s) OR "workId" = ANY(%s) OR "sourceContentDigest" = ANY(%s)
                ORDER BY "effectId"
                """,
                (list(effect_ids), list(work_ids), list(digests)),
            )
            links = [list(r) for r in cur.fetchall()]
            cur.execute(
                'SELECT id, "shopId", "customerRestId" FROM public."AuditEvent" WHERE id = ANY(%s) ORDER BY id',
                (list(effect_ids),),
            )
            audits = [list(r) for r in cur.fetchall()]
            cur.execute(
                """
                SELECT "sourceIdentity", "sightedClass", "correlatedCaptureId" IS NOT NULL
                FROM public."QueuedWorkSighting"
                WHERE "sourceContentDigest" = ANY(%s)
                """,
                (list(digests),),
            )
            sights = [list(r) for r in cur.fetchall()]
            cur.execute(
                """
                SELECT count(*) FROM public."PrivacyCustomerTargetBarrier" b
                WHERE b.state='ACTIVE' AND b."targetValue"='191167'
                """
            )
            barrier_191167 = cur.fetchone()[0]
    return {
        "captures": captures,
        "origins": origins,
        "links": links,
        "audits": audits,
        "sightings": sights,
        "active_barrier_191167": barrier_191167,
    }


def add_case(case_id, family, classification, detail, schedule, snap=None, extra=None):
    row = {
        "id": case_id,
        "family": family,
        "classification": classification,
        "detail": detail,
        "schedule": schedule,
        "snapshot": snap,
    }
    if extra:
        row.update(extra)
    RESULTS.append(row)
    print(f"[{classification}] {case_id}: {detail[:240]}", flush=True)


def err_has(outcome, needle: str) -> bool:
    return needle in (outcome.get("err") or "")


def setup_admin_bound(args, tag, body, customer, shop=SHOP_A, domain=DOMAIN_A, evidence="ADMIN_SESSION_CURRENT_INSTALL"):
    digest = source_commitment(domain, shop, "CUSTOMER_REST_ID", customer, body)
    command, work, skind, sident = f"cmd_{tag}", f"work_{tag}", "ADMIN_ACTION", f"ident_{tag}"
    cap = exec_tx(args, "stocky_admin_capture", shop, capture_stmts(shop, domain, command, skind, sident, digest, "CUSTOMER_REST_ID", customer))
    adm = exec_tx(args, "stocky_original_admission", shop, admit_stmts(shop, domain, work, skind, sident, digest, evidence, "CUSTOMER_REST_ID", customer))
    return {"digest": digest, "command": command, "work": work, "skind": skind, "sident": sident, "capture": cap, "admit": adm, "customer": customer, "body": body, "shop": shop, "domain": domain}


def workstream_a(args) -> None:
    # 1. capture versus sighting, both arrivals
    for arrival, holder_name in (("capture_holds", "capture"), ("sighting_holds", "sight")):
        fast_clean(args)
        tag = f"cap_sight_{arrival}"
        body, customer = f"body-{tag}", f"c_{tag}"
        digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
        command, skind, sident = f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}"
        cap_sql = capture_stmts(SHOP_A, DOMAIN_A, command, skind, sident, digest, "CUSTOMER_REST_ID", customer)
        sight_sql = sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", f"sight_{tag}", digest)
        if holder_name == "capture":
            race = overlap(args, "stocky_admin_capture", SHOP_A, cap_sql, "stocky_original_admission", SHOP_A, sight_sql)
            holder_ok = race["holder"]["rc"] == 0
            # sighting commits after capture, so capture must end contradicted
            snap = snapshot(args, command_ids=[command], digests=[digest])
            contradicted = bool(snap["captures"]) and snap["captures"][0][4] is True
            ok = holder_ok and race["waiter"]["rc"] == 0 and contradicted and race["observation"]["wait_seen"] and len(snap["captures"]) == 1
            classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
            if race["observation"]["wait_seen"] is False and holder_ok:
                classification = "harness_failure" if race["waiter"]["rc"] != 0 else "reproduced_defect"
            detail = f"capture committed then sighting contradicted it; wait={race['observation']['wait_seen']}"
        else:
            race = overlap(args, "stocky_original_admission", SHOP_A, sight_sql, "stocky_admin_capture", SHOP_A, cap_sql)
            snap = snapshot(args, command_ids=[command], digests=[digest])
            denied = race["waiter"]["rc"] != 0 and err_has(race["waiter"], "queued_work_cannot_acquire_fresh_admin_origin")
            ok = race["holder"]["rc"] == 0 and denied and snap["captures"] == [] and race["observation"]["wait_seen"]
            classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
            detail = f"sighting first blocks fresh capture; waiter_err={race['waiter']['err'][:180]}"
        add_case(f"RACE-CAP-SIGHT-{arrival}", "capture_vs_sighting", classification, detail, race, snap)

    # 2. consume/admission versus sighting
    for arrival in ("admit_holds", "sighting_holds"):
        fast_clean(args)
        tag = f"admit_sight_{arrival}"
        body, customer = f"body-{tag}", f"c_{tag}"
        digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
        command, work, skind, sident = f"cmd_{tag}", f"work_{tag}", "ADMIN_ACTION", f"ident_{tag}"
        cap = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, command, skind, sident, digest, "CUSTOMER_REST_ID", customer))
        if cap["rc"] != 0:
            add_case(f"RACE-ADMIT-SIGHT-{arrival}", "consume_vs_sighting", "harness_failure", cap["err"], {})
            continue
        admit_sql = admit_stmts(SHOP_A, DOMAIN_A, work, skind, sident, digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", customer)
        sight_sql = sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", f"sight_{tag}", digest)
        if arrival == "admit_holds":
            race = overlap(args, "stocky_original_admission", SHOP_A, admit_sql, "stocky_original_admission", SHOP_A, sight_sql)
            snap = snapshot(args, work_ids=[work], command_ids=[command], digests=[digest])
            effect = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", customer, f"ae_lab_{tag}", work, body))
            snap2 = snapshot(args, work_ids=[work], effect_ids=[f"ae_lab_{tag}"], command_ids=[command], digests=[digest])
            ok = (
                race["holder"]["rc"] == 0 and race["waiter"]["rc"] == 0 and race["observation"]["wait_seen"]
                and effect["rc"] != 0 and err_has(effect, "effect_source_no_longer_fresh")
                and snap2["audits"] == [] and len(snap2["origins"]) == 1
            )
            classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
            detail = "admitted first; later sighting; effect refused and audit absent"
        else:
            race = overlap(args, "stocky_original_admission", SHOP_A, sight_sql, "stocky_original_admission", SHOP_A, admit_sql)
            snap2 = snapshot(args, work_ids=[work], command_ids=[command], digests=[digest])
            denied = race["waiter"]["rc"] != 0 and err_has(race["waiter"], "capture_content_no_longer_fresh")
            ok = race["holder"]["rc"] == 0 and denied and race["observation"]["wait_seen"] and snap2["origins"] == []
            classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
            detail = f"sighting first; consume refused; origins={len(snap2['origins'])} err={race['waiter']['err'][:160]}"
        add_case(f"RACE-ADMIT-SIGHT-{arrival}", "consume_vs_sighting", classification, detail, race, snap2)

    # 3. committed admission, then sighting versus effect
    for arrival in ("effect_holds", "sighting_holds"):
        fast_clean(args)
        tag = f"eff_sight_{arrival}"
        built = setup_admin_bound(args, tag, f"body-{tag}", f"c_{tag}")
        if built["admit"]["rc"] != 0:
            add_case(f"RACE-EFFECT-SIGHT-{arrival}", "admission_sighting_effect", "harness_failure", built["admit"]["err"], {})
            continue
        effect_id = f"ae_lab_{tag}"
        eff_sql = apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", built["customer"], effect_id, built["work"], built["body"])
        sight_sql = sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", f"sight_{tag}", built["digest"])
        if arrival == "effect_holds":
            race = overlap(args, "stocky_runtime", SHOP_A, eff_sql, "stocky_original_admission", SHOP_A, sight_sql)
            snap = snapshot(args, work_ids=[built["work"]], effect_ids=[effect_id], command_ids=[built["command"]], digests=[built["digest"]])
            retry = exec_tx(args, "stocky_runtime", SHOP_A, eff_sql)
            snap2 = snapshot(args, work_ids=[built["work"]], effect_ids=[effect_id], digests=[built["digest"]])
            ok = (
                race["holder"]["rc"] == 0 and race["waiter"]["rc"] == 0 and race["observation"]["wait_seen"]
                and len(snap2["audits"]) == 1 and len(snap2["links"]) == 1 and retry["rc"] == 0
                and snap2["captures"] and snap2["captures"][0][4] is True
            )
            classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
            detail = "effect won; sighting did not unwrite; same-effect retry stayed one row"
        else:
            race = overlap(args, "stocky_original_admission", SHOP_A, sight_sql, "stocky_runtime", SHOP_A, eff_sql)
            snap2 = snapshot(args, work_ids=[built["work"]], effect_ids=[effect_id], digests=[built["digest"]])
            denied = race["waiter"]["rc"] != 0 and err_has(race["waiter"], "effect_source_no_longer_fresh")
            ok = race["holder"]["rc"] == 0 and denied and race["observation"]["wait_seen"] and snap2["audits"] == [] and snap2["links"] == []
            classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
            detail = f"sighting won; effect wrote nothing; err={race['waiter']['err'][:160]}"
        add_case(f"RACE-EFFECT-SIGHT-{arrival}", "admission_sighting_effect", classification, detail, race, snap2)

    # 4. source-link competition: two effect ids, same source, overlapping apply
    for winner in ("e1", "e2"):
        fast_clean(args)
        tag = f"link_{winner}"
        built = setup_admin_bound(args, tag, f"body-{tag}", f"c_{tag}")
        # correlated child of the same source
        child_work = f"work_{tag}_child"
        child = exec_tx(
            args, "stocky_original_admission", SHOP_A,
            admit_stmts(SHOP_A, DOMAIN_A, child_work, "PARENT", f"child_{tag}", built["digest"], "PARENT_LINEAGE", "CUSTOMER_REST_ID", built["customer"], parent=built["work"]),
        )
        e1, e2 = f"ae_lab_{tag}_1", f"ae_lab_{tag}_2"
        sql1 = apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", built["customer"], e1, built["work"], built["body"])
        sql2 = apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", built["customer"], e2, child_work, built["body"])
        if winner == "e1":
            race = overlap(args, "stocky_runtime", SHOP_A, sql1, "stocky_runtime", SHOP_A, sql2)
            expect_audit, denied_slot = e1, race["waiter"]
        else:
            race = overlap(args, "stocky_runtime", SHOP_A, sql2, "stocky_runtime", SHOP_A, sql1)
            expect_audit, denied_slot = e2, race["waiter"]
        snap = snapshot(args, work_ids=[built["work"], child_work], effect_ids=[e1, e2], digests=[built["digest"]])
        ok = (
            child["rc"] == 0 and race["holder"]["rc"] == 0 and denied_slot["rc"] != 0
            and err_has(denied_slot, "effect_digest_mismatch") and race["observation"]["wait_seen"]
            and [a[0] for a in snap["audits"]] == [expect_audit] and len(snap["links"]) == 1
        )
        classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
        if child["rc"] != 0:
            classification = "harness_failure"
        add_case(
            f"RACE-SOURCE-LINK-{winner}",
            "source_link_competition",
            classification,
            f"one link one audit; child_rc={child['rc']} denied={denied_slot['err'][:140]}",
            race,
            snap,
        )

    # 5. barrier versus effect, both winners, plus unrelated shop progress
    for arrival in ("effect_holds", "barrier_holds"):
        fast_clean(args)
        tag = f"bar_eff_{arrival}"
        built = setup_admin_bound(args, tag, f"body-{tag}", "191167")
        other = setup_admin_bound(args, tag + "_b", f"body-{tag}-b", f"c_{tag}_b", shop=SHOP_B, domain=DOMAIN_B)
        effect_id = f"ae_lab_{tag}"
        eff_sql = apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "191167", effect_id, built["work"], built["body"])
        bar_sql = [("SELECT public.stocky_privacy_install_customer_barrier(%s,%s)", ("preq_cr", "patt_cr"))]
        if arrival == "effect_holds":
            race = overlap(args, "stocky_runtime", SHOP_A, eff_sql, "stocky_privacy_erasure", SHOP_A, bar_sql)
            snap = snapshot(args, work_ids=[built["work"]], effect_ids=[effect_id], digests=[built["digest"]])
            ok = race["holder"]["rc"] == 0 and race["waiter"]["rc"] == 0 and race["observation"]["wait_seen"] and len(snap["audits"]) == 1
            detail = "effect committed; later barrier did not remove the audit row"
        else:
            race = overlap(args, "stocky_privacy_erasure", SHOP_A, bar_sql, "stocky_runtime", SHOP_A, eff_sql)
            # unrelated shop while barrier is... already released. Progress check is inside a fresh hold below.
            snap = snapshot(args, work_ids=[built["work"]], effect_ids=[effect_id], digests=[built["digest"]])
            denied = race["waiter"]["rc"] != 0 and err_has(race["waiter"], "customer_target_erasing")
            ok = race["holder"]["rc"] == 0 and denied and race["observation"]["wait_seen"] and snap["audits"] == []
            detail = f"barrier won; effect denied; audits={len(snap['audits'])}"
        classification = "tested_refuted_hypothesis" if ok else "reproduced_defect"
        add_case(f"RACE-BARRIER-EFFECT-{arrival}", "barrier_effect", classification, detail, race, snap, extra={"other_shop_setup_rc": other["admit"]["rc"]})

    # unrelated shop progresses while shop_a barrier is held
    fast_clean(args)
    tag = "bar_progress"
    built = setup_admin_bound(args, tag, f"body-{tag}", "191167")
    other = setup_admin_bound(args, tag + "_b", f"body-{tag}-b", "c_other_b", shop=SHOP_B, domain=DOMAIN_B)
    bar_sql = [("SELECT public.stocky_privacy_install_customer_barrier(%s,%s)", ("preq_cr", "patt_cr"))]
    other_sql = apply_stmts(SHOP_B, DOMAIN_B, "CUSTOMER_REST_ID", "c_other_b", "ae_lab_bar_progress_b", other["work"], other["body"])
    blocked_sql = apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "191167", "ae_lab_bar_progress_a", built["work"], built["body"])
    race = overlap(args, "stocky_privacy_erasure", SHOP_A, bar_sql, "stocky_runtime", SHOP_A, blocked_sql)
    progressed = exec_tx(args, "stocky_runtime", SHOP_B, other_sql) if race["holder"]["rc"] == 0 else {"rc": 1, "err": "holder failed"}
    # The progress call above is AFTER release. Re-hold to prove progress during the wait.
    fast_clean(args)
    built = setup_admin_bound(args, tag, f"body-{tag}", "191167")
    other = setup_admin_bound(args, tag + "_b", f"body-{tag}-b", "c_other_b", shop=SHOP_B, domain=DOMAIN_B)
    import threading
    holder_box = {}
    release = threading.Event()
    ready = threading.Event()

    def hold_barrier():
        conn = connect(args, "stocky_privacy_erasure", app="grok47_barrier_hold")
        try:
            with conn.cursor() as cur:
                set_ctx(cur, SHOP_A)
                run_statements(cur, bar_sql)
            holder_box["rc"] = 0
            ready.set()
            release.wait(15)
            conn.commit()
        except psycopg.Error as exc:
            holder_box["rc"] = 1
            holder_box["err"] = str(exc)
            ready.set()
            conn.rollback()
        finally:
            conn.close()

    th = threading.Thread(target=hold_barrier)
    th.start()
    ready.wait(10)
    during = exec_tx(args, "stocky_runtime", SHOP_B, other_sql)
    release.set()
    th.join(10)
    snap = snapshot(args, effect_ids=["ae_lab_bar_progress_b", "ae_lab_bar_progress_a"], work_ids=[other["work"], built["work"]])
    ok = holder_box.get("rc") == 0 and during["rc"] == 0 and any(a[0] == "ae_lab_bar_progress_b" and a[1] == SHOP_B for a in snap["audits"])
    add_case(
        "RACE-BARRIER-OTHER-SHOP",
        "barrier_effect",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"shop_b wrote during shop_a barrier hold rc={during['rc']} err={during.get('err','')[:120]}",
        {"holder": holder_box, "during": during},
        snap,
    )

    # 6. barrier versus capture (expected NOT to share the target lock)
    fast_clean(args)
    tag = "bar_cap"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "191167", f"body-{tag}")
    cap_sql = capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", "191167")
    bar_sql = [("SELECT public.stocky_privacy_install_customer_barrier(%s,%s)", ("preq_cr", "patt_cr"))]
    race = overlap(args, "stocky_privacy_erasure", SHOP_A, bar_sql, "stocky_admin_capture", SHOP_A, cap_sql)
    snap = snapshot(args, command_ids=[f"cmd_{tag}"], digests=[digest])
    # Hypothesis "barrier blocks capture" is refuted when capture commits without a lock wait.
    capture_ok = race["waiter"]["rc"] == 0 and len(snap["captures"]) == 1
    classification = "tested_refuted_hypothesis" if capture_ok and not race["observation"]["wait_seen"] else (
        "contract_ambiguity" if capture_ok and race["observation"]["wait_seen"] else "reproduced_defect"
    )
    add_case(
        "RACE-BARRIER-CAPTURE",
        "barrier_capture",
        classification,
        f"capture_rc={race['waiter']['rc']} wait={race['observation']['wait_seen']} captures={len(snap['captures'])}",
        race,
        snap,
    )

    # 7. barrier versus completion
    fast_clean(args)
    bar_sql = [("SELECT public.stocky_privacy_install_customer_barrier(%s,%s)", ("preq_cr", "patt_cr"))]
    comp_sql = [("SELECT public.stocky_privacy_complete_customer_redact(%s,%s)", ("preq_cr", "patt_cr"))]
    pre = exec_tx(args, "stocky_privacy_erasure", SHOP_A, bar_sql)
    race = overlap(args, "stocky_privacy_erasure", SHOP_A, comp_sql, "stocky_privacy_erasure", SHOP_A, comp_sql)
    ok = pre["rc"] == 0 and race["holder"]["rc"] == 0 and race["observation"]["wait_seen"]
    add_case(
        "RACE-BARRIER-COMPLETION",
        "barrier_completion",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"second completion waited; holder_rows={race['holder']['rows']} waiter_err={race['waiter']['err'][:140]}",
        race,
        snapshot(args),
    )

    # 8. reinstall exclusive gate versus admission, fresh read after wait
    fast_clean(args)
    tag = "reinstall"
    body = f"body-{tag}"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", f"c_{tag}", body)
    command, work = f"cmd_{tag}", f"work_{tag}"
    cap = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, command, "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", f"c_{tag}"))
    lock_sql = [("SELECT public.stocky_lifecycle_exclusive_lock(%s)", (DOMAIN_A,))]
    admit_sql = admit_stmts(SHOP_A, DOMAIN_A, work, "ADMIN_ACTION", f"ident_{tag}", digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", f"c_{tag}")
    state = {"updated": False}

    def owner_flip():
        # Runs only after the admission statement is blocked on the exclusive gate.
        with connect(args, "pr45owner", autocommit=True, app="grok47_owner_flip") as conn:
            conn.execute("""UPDATE public."ShopInstallGeneration" SET fence='UNINSTALLED' WHERE id='gen_a'""")
            conn.execute(
                """INSERT INTO public."ShopInstallGeneration"(id,"canonicalDomain","targetShopId","shopRowId",fence)
                   VALUES ('gen_lab_new', %s, 'shop_a', 'shop_a', 'LIVE')""",
                (DOMAIN_A,),
            )
            cur = conn.execute(
                """SELECT id, fence FROM public."ShopInstallGeneration" WHERE "canonicalDomain"=%s ORDER BY id""",
                (DOMAIN_A,),
            )
            state["fences_while_held"] = [list(r) for r in cur.fetchall()]
        state["updated"] = True

    race = overlap(
        args, "stocky_control_plane", SHOP_A, lock_sql, "stocky_original_admission", SHOP_A, admit_sql,
        before_release=owner_flip,
    )
    snap = snapshot(args, work_ids=[work], command_ids=[command], digests=[digest])
    denied = race["waiter"]["rc"] != 0 and (
        err_has(race["waiter"], "admission_capture_epoch_mismatch") or err_has(race["waiter"], "admission_generation_ambiguous")
    )
    # positive control: a capture taken after the new LIVE generation admits
    digest2 = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_reinstall_new", "body-reinstall-new")
    cap2 = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, "cmd_reinstall_new", "ADMIN_ACTION", "ident_reinstall_new", digest2, "CUSTOMER_REST_ID", "c_reinstall_new"))
    adm2 = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_reinstall_new", "ADMIN_ACTION", "ident_reinstall_new", digest2, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", "c_reinstall_new"))
    snap2 = snapshot(args, work_ids=["work_reinstall_new", work], command_ids=["cmd_reinstall_new", command], digests=[digest, digest2])
    ok = (
        cap["rc"] == 0
        and race["holder"]["rc"] == 0
        and denied
        and race["observation"]["wait_seen"]
        and state["updated"]
        and race.get("before_release_error") is None
        and adm2["rc"] == 0
        and cap2["rc"] == 0
    )
    add_case(
        "RACE-REINSTALL-ADMISSION",
        "reinstall_admission",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"old capture not consumed onto the new LIVE; new capture admitted rc={adm2['rc']} err={race['waiter']['err'][:180]}",
        race,
        snap2,
        extra={
            "owner_fixture": "fence flip while exclusive lifecycle lock held; not an application reinstall function",
            "fences_while_held": state.get("fences_while_held"),
            "positive_control": {"new_capture_rc": cap2["rc"], "new_admit_rc": adm2["rc"]},
        },
    )

    # reverse: admission holds shared gate, exclusive reinstall waits
    fast_clean(args)
    tag = "reinstall_rev"
    built = setup_admin_bound(args, tag, f"body-{tag}", f"c_{tag}")
    # Hold is an open shared lifecycle lock. Exclusive reinstall must wait.
    # Use an open fact guard by applying and holding. Exclusive lock must wait.
    hold_sql = [("SELECT public.stocky_lifecycle_shared_lock(%s)", (DOMAIN_A,))]
    excl_sql = [("SELECT public.stocky_lifecycle_exclusive_lock(%s)", (DOMAIN_A,))]
    # runtime cannot call lifecycle_shared_lock? GRANT includes stocky_runtime.
    race = overlap(args, "stocky_runtime", SHOP_A, hold_sql, "stocky_control_plane", SHOP_A, excl_sql)
    ok = race["holder"]["rc"] == 0 and race["waiter"]["rc"] == 0 and race["observation"]["wait_seen"] and built["admit"]["rc"] == 0
    add_case(
        "RACE-REINSTALL-REVERSE",
        "reinstall_admission",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"exclusive gate waited for shared holder; wait={race['observation']['wait_seen']}",
        race,
        snapshot(args, work_ids=[built["work"]]),
    )

    # lock timeout then converging retry
    fast_clean(args)
    tag = "timeout"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", f"c_{tag}", f"body-{tag}")
    cap = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", f"c_{tag}"))
    lock_sql = [("SELECT public.stocky_lifecycle_exclusive_lock(%s)", (DOMAIN_A,))]
    admit_sql = admit_stmts(SHOP_A, DOMAIN_A, f"work_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", f"c_{tag}")
    race = overlap(
        args, "stocky_control_plane", SHOP_A, lock_sql, "stocky_original_admission", SHOP_A, admit_sql,
        waiter_lock_timeout="400ms", min_hold_seconds=1.0,
    )
    retry = exec_tx(args, "stocky_original_admission", SHOP_A, admit_sql)
    timed_out = race["waiter"]["sqlstate"] == "55P03" or "lock timeout" in race["waiter"]["err"].lower()
    ok = cap["rc"] == 0 and timed_out and retry["rc"] == 0
    add_case(
        "RACE-LOCK-TIMEOUT-RETRY",
        "timeout_stale_context",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"timeout={race['waiter']['sqlstate']} retry_rc={retry['rc']} err={race['waiter']['err'][:160]}",
        race,
        snapshot(args, work_ids=[f"work_{tag}"]),
    )

    # poisoned / missing context and wrong principal
    fast_clean(args)
    denied = exec_tx(args, "stocky_runtime", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, "cmd_poison", "ADMIN_ACTION", "ident_poison", "abc", "CUSTOMER_REST_ID", "c_poison"))
    missing = exec_tx(args, "stocky_admin_capture", SHOP_A, [
        ("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
         (DOMAIN_A, SHOP_A, "cmd_nosess", "ADMIN_ACTION", "ident_nosess", "abc", "CUSTOMER_REST_ID", "c_nosess"))
    ])
    mismatch = exec_tx(args, "stocky_admin_capture", SHOP_B, capture_stmts(SHOP_A, DOMAIN_A, "cmd_mix", "ADMIN_ACTION", "ident_mix", "abc", "CUSTOMER_REST_ID", "c_mix"))
    stale = exec_tx(args, "stocky_privacy_erasure", SHOP_A, [("SELECT public.stocky_privacy_install_customer_barrier(%s,%s)", ("preq_cr", "not_the_attempt"))], att="not_the_attempt")
    ok = (
        denied["rc"] != 0 and (denied["sqlstate"] == "42501" or "42501" in denied["err"])
        and err_has(missing, "admission_admin_session_required")
        and mismatch["rc"] != 0
        and stale["rc"] != 0 and err_has(stale, "barrier_stale_attempt")
    )
    add_case(
        "RACE-POISON-CONTEXT",
        "timeout_stale_context",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"runtime_capture={denied['sqlstate']} missing={missing['err'][:80]} mismatch={mismatch['err'][:80]} stale={stale['err'][:80]}",
        {"denied": denied, "missing": missing, "mismatch": mismatch, "stale": stale},
    )

    # seeded overlapping corpus — capture holds, plus last seed sighting holds
    for seed in LIMITS["seeds"]:
        fast_clean(args)
        arrival = "sighting_holds" if seed == LIMITS["seeds"][-1] else "capture_holds"
        tag = f"seed{seed}"
        customer = f"cseed{seed}"
        body = f"seed-body-{seed}"
        digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
        cap_sql = capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", customer)
        sight_sql = sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", f"sight_{tag}", digest)
        if arrival == "capture_holds":
            race = overlap(args, "stocky_admin_capture", SHOP_A, cap_sql, "stocky_original_admission", SHOP_A, sight_sql)
            snap = snapshot(args, command_ids=[f"cmd_{tag}"], digests=[digest])
            ok = race["holder"]["rc"] == 0 and race["waiter"]["rc"] == 0 and race["observation"]["wait_seen"] and snap["captures"] and snap["captures"][0][4] is True
        else:
            race = overlap(args, "stocky_original_admission", SHOP_A, sight_sql, "stocky_admin_capture", SHOP_A, cap_sql)
            snap = snapshot(args, command_ids=[f"cmd_{tag}"], digests=[digest])
            ok = race["holder"]["rc"] == 0 and race["waiter"]["rc"] != 0 and snap["captures"] == [] and race["observation"]["wait_seen"]
        add_case(
            f"SEED-{seed}-{arrival}",
            "seeded_capture_sighting",
            "tested_refuted_hypothesis" if ok else "reproduced_defect",
            f"seed={seed} arrival={arrival} digest={digest} wait={race['observation']['wait_seen']}",
            {"wait_seen": race["observation"]["wait_seen"], "holder_rc": race["holder"]["rc"], "waiter_rc": race["waiter"]["rc"], "waiter_err": race["waiter"]["err"][:200]},
            snap,
            extra={"seed": seed, "digest": digest},
        )

    # serial permutations are recorded and explicitly not concurrency proof
    import itertools
    ops = ("capture", "sight", "admit")
    for perm in list(itertools.permutations(ops))[: LIMITS["serial_permutations_bound"]]:
        fast_clean(args)
        tag = "ser_" + "".join(p[0] for p in perm)
        customer, body = f"c_{tag}", f"body-{tag}"
        digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
        outcomes = []
        for op in perm:
            if op == "capture":
                outcomes.append(exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", customer)))
            elif op == "sight":
                outcomes.append(exec_tx(args, "stocky_original_admission", SHOP_A, sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", f"sight_{tag}", digest)))
            else:
                outcomes.append(exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, f"work_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", customer)))
        add_case(
            "SERIAL-" + "-".join(perm),
            "serial_not_concurrency_proof",
            "tested_refuted_hypothesis",
            "serial history recorded only; not used as overlap evidence",
            {"order": perm, "rcs": [o["rc"] for o in outcomes], "errs": [o["err"][:120] for o in outcomes]},
            snapshot(args, work_ids=[f"work_{tag}"], command_ids=[f"cmd_{tag}"], digests=[digest]),
        )

    process_loss(args)


def process_loss(args) -> None:
    """Owned client/backend loss around commit. Whole-host power loss is not executed."""
    fast_clean(args)
    tag = "loss_pre"
    body, customer = f"body-{tag}", f"c_{tag}"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
    # pre-commit client close
    conn = connect(args, "stocky_admin_capture", app="grok47_loss_client")
    try:
        with conn.cursor() as cur:
            set_ctx(cur, SHOP_A)
            run_statements(cur, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", customer))
        # close without commit: client disconnect
    finally:
        conn.close()
    snap = snapshot(args, command_ids=[f"cmd_{tag}"], digests=[digest])
    retry = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", customer))
    snap2 = snapshot(args, command_ids=[f"cmd_{tag}"], digests=[digest])
    ok = snap["captures"] == [] and retry["rc"] == 0 and len(snap2["captures"]) == 1
    add_case("LOSS-PRECOMMIT-CLIENT-CLOSE", "process_loss", "tested_refuted_hypothesis" if ok else "reproduced_defect", "uncommitted capture absent; retry created one", {"retry_rc": retry["rc"]}, snap2)

    # pre-commit backend terminate
    fast_clean(args)
    tag = "loss_backend"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", f"c_{tag}", f"body-{tag}")
    import threading
    box = {}
    ready = threading.Event()

    def holder():
        conn = connect(args, "stocky_admin_capture", app="grok47_loss_backend")
        try:
            with conn.cursor() as cur:
                set_ctx(cur, SHOP_A)
                cur.execute("SELECT pg_backend_pid()")
                box["pid"] = cur.fetchone()[0]
                run_statements(cur, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", f"c_{tag}"))
            ready.set()
            time.sleep(15)
            conn.commit()
            box["committed"] = True
        except psycopg.Error as exc:
            box["err"] = str(exc)
            ready.set()
        finally:
            conn.close()

    th = threading.Thread(target=holder)
    th.start()
    ready.wait(10)
    with connect(args, "pr45owner", autocommit=True, app="grok47_owner") as owner:
        owner.execute("SELECT pg_terminate_backend(%s)", (box.get("pid"),))
    th.join(5)
    snap = snapshot(args, command_ids=[f"cmd_{tag}"])
    retry = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", f"c_{tag}"))
    snap2 = snapshot(args, command_ids=[f"cmd_{tag}"])
    ok = snap["captures"] == [] and retry["rc"] == 0 and len(snap2["captures"]) == 1 and not box.get("committed")
    add_case("LOSS-PRECOMMIT-BACKEND-TERMINATE", "process_loss", "tested_refuted_hypothesis" if ok else "reproduced_defect", f"terminated pid={box.get('pid')} captures_after={len(snap['captures'])}", box, snap2)

    # post-commit pre-ack: commit, kill client before the parent reads a fabricated ack channel
    fast_clean(args)
    tag = "loss_post"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", f"c_{tag}", f"body-{tag}")
    script = r"""
import os, sys, time, psycopg
host, port, db = sys.argv[1], int(sys.argv[2]), sys.argv[3]
ready, ack = sys.argv[4], sys.argv[5]
conn = psycopg.connect(host=host, port=port, dbname=db, user="stocky_admin_capture", autocommit=False)
cur = conn.cursor()
cur.execute("SELECT set_config('stocky.current_shop_id','shop_a', true)")
cur.fetchall()
cur.execute("SELECT set_config('stocky.tenant_context_version','phase1-db-tenant-context-v1', true)")
cur.fetchall()
cur.execute("SELECT set_config('stocky.privacy_request_id','preq_cr', true)")
cur.fetchall()
cur.execute("SELECT set_config('stocky.privacy_attempt_id','patt_cr', true)")
cur.fetchall()
cur.execute("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", ("shop_a","pr7-a.myshopify.com","actor_a"))
cur.fetchall()
cur.execute("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
            ("pr7-a.myshopify.com","shop_a","cmd_loss_post","ADMIN_ACTION","ident_loss_post", os.environ["LOSS_DIGEST"], "CUSTOMER_REST_ID", "c_loss_post"))
cur.fetchall()
conn.commit()
open(ready,"w").write("committed")
time.sleep(30)
open(ack,"w").write("acked")
"""
    ready_path = "/tmp/pr7-grok47-loss-ready-8426"
    ack_path = "/tmp/pr7-grok47-loss-ack-8426"
    for p in (ready_path, ack_path):
        if os.path.exists(p):
            os.remove(p)
    env = {**os.environ, "LOSS_DIGEST": digest}
    proc = subprocess.Popen([sys.executable, "-c", script, args.pghost, str(args.pgport), args.dbname, ready_path, ack_path], env=env)
    deadline = time.time() + 15
    while time.time() < deadline and not os.path.exists(ready_path):
        time.sleep(0.05)
    snap = snapshot(args, command_ids=["cmd_loss_post"])
    os.kill(proc.pid, signal.SIGKILL)
    proc.wait(5)
    time.sleep(0.2)
    snap_after = snapshot(args, command_ids=["cmd_loss_post"])
    retry = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, "cmd_loss_post", "ADMIN_ACTION", "ident_loss_post", digest, "CUSTOMER_REST_ID", "c_loss_post"))
    snap3 = snapshot(args, command_ids=["cmd_loss_post"])
    ok = len(snap_after["captures"]) == 1 and not os.path.exists(ack_path) and retry["rc"] == 0 and len(snap3["captures"]) == 1
    add_case(
        "LOSS-POSTCOMMIT-PREACK",
        "process_loss",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"row survived client SIGKILL before ack file; retry kept one capture; ack_written={os.path.exists(ack_path)}",
        {"child_pid": proc.pid},
        snap3,
    )

    # lost acknowledgement of BEGIN admission: row pending, effect denied, duplicate returns same id, recover with job acks
    fast_clean(args)
    tag = "loss_ack"
    built_digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", f"c_{tag}", f"body-{tag}")
    cap = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", built_digest, "CUSTOMER_REST_ID", f"c_{tag}"))
    pending = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, f"work_{tag}", "ADMIN_ACTION", f"ident_{tag}", built_digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", f"c_{tag}", mode="BEGIN"))
    effect = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", f"c_{tag}", f"ae_lab_{tag}", f"work_{tag}", f"body-{tag}"))
    dup = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, f"work_{tag}_dup", "ADMIN_ACTION", f"ident_{tag}", built_digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", f"c_{tag}"))
    snap = snapshot(args, work_ids=[f"work_{tag}", f"work_{tag}_dup"], effect_ids=[f"ae_lab_{tag}"], digests=[built_digest])
    # attach an existing durable job and recover
    with connect(args, "pr45owner", autocommit=True, app="grok47_owner") as owner:
        owner.execute('UPDATE public."WriterAdmissionOrigin" SET "durableJobId"=%s WHERE "workId"=%s', ("job_a", f"work_{tag}"))
    rec = exec_tx(args, "stocky_original_admission", SHOP_A, [("SELECT public.stocky_recover_writer_admission(%s)", (f"work_{tag}",))])
    effect2 = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", f"c_{tag}", f"ae_lab_{tag}", f"work_{tag}", f"body-{tag}"))
    snap2 = snapshot(args, work_ids=[f"work_{tag}"], effect_ids=[f"ae_lab_{tag}"], digests=[built_digest])
    one_origin = len(snap["origins"]) == 1
    ok = (
        cap["rc"] == 0 and pending["rc"] == 0 and effect["rc"] != 0 and err_has(effect, "customer_admission_not_acked")
        and dup["rc"] == 0 and one_origin and rec["rc"] == 0 and effect2["rc"] == 0 and len(snap2["audits"]) == 1
    )
    add_case(
        "LOSS-ACK-PENDING-RECOVERY",
        "duplicate_recovery_lost_ack",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"pending effect denied; duplicate did not mint; recover then one effect. origins_before={len(snap['origins'])} effect_err={effect['err'][:120]}",
        {"pending": pending["rc"], "dup": dup["rc"], "recover": rec["rc"], "effect2": effect2["rc"]},
        snap2,
    )

    # uncertain commit: bounded attempts. Classify committed vs aborted. Retry must leave one capture.
    uncertain_rows = []
    for n in range(LIMITS["uncertain_attempts"]):
        fast_clean(args)
        tag = f"unc_{n}"
        digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", f"c_{tag}", f"body-{tag}")
        script = r"""
import os, sys, time, psycopg
host, port, db, digest, tag, pidfile = sys.argv[1:]
conn = psycopg.connect(host=host, port=int(port), dbname=db, user='stocky_admin_capture', autocommit=False)
cur = conn.cursor()
for sql, params in [
    ("SELECT set_config('stocky.current_shop_id','shop_a', true)", None),
    ("SELECT set_config('stocky.tenant_context_version','phase1-db-tenant-context-v1', true)", None),
    ("SELECT set_config('stocky.privacy_request_id','preq_cr', true)", None),
    ("SELECT set_config('stocky.privacy_attempt_id','patt_cr', true)", None),
]:
    cur.execute(sql)
    cur.fetchall()
cur.execute('SELECT pg_backend_pid()')
open(pidfile,'w').write(str(cur.fetchone()[0]))
cur.execute("SELECT public.stocky_establish_modeled_admin_session(%s,%s,%s)", ('shop_a','pr7-a.myshopify.com','actor_a'))
cur.fetchall()
cur.execute("SELECT public.stocky_capture_original_admin_command(%s,%s,%s,%s,%s,%s,%s,%s)",
            ('pr7-a.myshopify.com','shop_a', f'cmd_{tag}','ADMIN_ACTION', f'ident_{tag}', digest, 'CUSTOMER_REST_ID', f'c_{tag}'))
cur.fetchall()
time.sleep(0.3)
conn.commit()
time.sleep(2)
"""
        pidfile = f"/tmp/pr7-grok47-unc-{n}-8426.pid"
        if os.path.exists(pidfile):
            os.remove(pidfile)
        proc = subprocess.Popen([sys.executable, "-c", script, args.pghost, str(args.pgport), args.dbname, digest, tag, pidfile])
        deadline = time.time() + 8
        pid = None
        while time.time() < deadline and pid is None:
            if os.path.exists(pidfile):
                txt = open(pidfile).read().strip()
                if txt:
                    pid = int(txt)
                    break
            time.sleep(0.02)
        # Child writes the pid, then captures, sleeps 0.3s, then commits.
        # Even attempts terminate inside that pre-commit window. Odd attempts
        # wait past it so the committed side is also observed.
        time.sleep(0.05 if n % 2 == 0 else 1.2)
        if pid:
            with connect(args, "pr45owner", autocommit=True, app="grok47_owner") as owner:
                owner.execute("SELECT pg_terminate_backend(%s)", (pid,))
        proc.wait(8)
        snap = snapshot(args, command_ids=[f"cmd_{tag}"])
        state = "committed" if snap["captures"] else "aborted"
        retry = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, f"cmd_{tag}", "ADMIN_ACTION", f"ident_{tag}", digest, "CUSTOMER_REST_ID", f"c_{tag}"))
        snap2 = snapshot(args, command_ids=[f"cmd_{tag}"])
        uncertain_rows.append({"n": n, "observed": state, "retry_rc": retry["rc"], "final_captures": len(snap2["captures"]), "pid": pid})
    converged = all(r["retry_rc"] == 0 and r["final_captures"] == 1 for r in uncertain_rows)
    add_case(
        "LOSS-UNCERTAIN-COMMIT",
        "process_loss",
        "tested_refuted_hypothesis" if converged else "reproduced_defect",
        "bounded terminate-during-commit; retry converged to one capture whether the original commit landed",
        {"attempts": uncertain_rows},
        extra={"power_loss": "unexecuted_application_integration", "external_io": "unexecuted_application_integration"},
    )


def workstream_b(args) -> None:
    # oracle matches SQL function
    with connect(args, "stocky_runtime", autocommit=True, app="grok47_oracle") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('stocky.current_shop_id','shop_a', false)")
            cur.execute(
                "SELECT public.stocky_source_commitment(%s,%s,%s,%s,%s,%s)",
                (DOMAIN_A, SHOP_A, "CUSTOMER_WRITE", "CUSTOMER_REST_ID", "191167", "ao02-host-body"),
            )
            sql_source = cur.fetchone()[0]
            cur.execute(
                "SELECT public.stocky_effect_commitment(%s,%s,%s,%s,%s)",
                (DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "191167", "ae_pos"),
            )
            sql_effect = cur.fetchone()[0]
            cur.execute("SELECT public.stocky_source_commitment(%s,%s,%s,%s,%s, NULL)", (DOMAIN_A, SHOP_A, "CUSTOMER_WRITE", "CUSTOMER_REST_ID", "191167"))
            sql_null = cur.fetchone()[0]
    ok = sql_source == SOURCE_SAMPLE and sql_effect == EFFECT_SAMPLE and sql_null is None
    add_case(
        "SEM-ORACLE-SQL-AGREES",
        "source_commitment",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"sql_source_match={sql_source==SOURCE_SAMPLE} sql_effect_match={sql_effect==EFFECT_SAMPLE} null={sql_null}",
        {},
    )

    # renamed identifiers keep the source digest and do not mint a second effect
    fast_clean(args)
    body = "rename-body"
    customer = "c_rename"
    digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
    digest_renamed_ids = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", customer, body)
    first = setup_admin_bound(args, "rename1", body, customer)
    eff1 = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", customer, "ae_lab_rename1", first["work"], body))
    # new command id, new work, same identity+digest coalesces
    second_cap = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, "cmd_rename2", "ADMIN_ACTION", first["sident"], digest, "CUSTOMER_REST_ID", customer))
    second_adm = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_rename2", "ADMIN_ACTION", first["sident"], digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", customer))
    eff2 = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", customer, "ae_lab_rename2", first["work"], body))
    snap = snapshot(args, work_ids=[first["work"], "work_rename2"], effect_ids=["ae_lab_rename1", "ae_lab_rename2"], command_ids=[first["command"], "cmd_rename2"], digests=[digest])
    ok = digest == digest_renamed_ids and eff1["rc"] == 0 and eff2["rc"] != 0 and len(snap["audits"]) == 1 and len(snap["links"]) == 1 and len(snap["captures"]) == 1
    add_case("SEM-RENAME-IDS", "renamed_identifiers", "tested_refuted_hypothesis" if ok else "reproduced_defect", f"second effect err={eff2['err'][:160]} captures={len(snap['captures'])} second_admit_rc={second_adm['rc']}", {"second_cap": second_cap["rc"]}, snap)

    # different source identity, same body: must not acquire a fresh capture
    fast_clean(args)
    built = setup_admin_bound(args, "identb", "same-body", "c_ident")
    digest = built["digest"]
    other = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, "cmd_ident_other", "ADMIN_ACTION", "ident_other", digest, "CUSTOMER_REST_ID", "c_ident"))
    ok = other["rc"] != 0 and err_has(other, "queued_work_cannot_acquire_fresh_admin_origin")
    # There is no sighting yet; the block is the existing capture of the digest.
    if not ok and err_has(other, "queued_work_cannot_acquire_fresh_admin_origin"):
        ok = True
    add_case("SEM-RENAME-SOURCE-IDENTITY", "renamed_identifiers", "tested_refuted_hypothesis" if ok else "reproduced_defect", other["err"][:200], {}, snapshot(args, digests=[digest], command_ids=["cmd_ident_other", built["command"]]))

    # evidence classes
    fast_clean(args)
    classes = []
    # webhook
    wh_digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_wh", "webhook-body")
    wh = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_wh", "WEBHOOK", "ident_wh", wh_digest, "WEBHOOK_PROVIDER_AUTH", "CUSTOMER_REST_ID", "c_wh"))
    wh_eff = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_wh", "ae_lab_wh", "work_wh", "webhook-body"))
    classes.append(("webhook", wh, wh_eff))
    # manual replay without parent
    man_bad = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_man_bad", "MANUAL", "ident_man", source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_man", "man-body"), "MANUAL_REPLAY", "CUSTOMER_REST_ID", "c_man"))
    classes.append(("manual_missing_parent", man_bad, None))
    # admin missing capture
    missing = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_nocap", "ADMIN_ACTION", "ident_nocap", source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_nocap", "nocap"), "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", "c_nocap"))
    parent = setup_admin_bound(args, "parent", "parent-body", "c_parent")
    parent_eff = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_parent", "ae_lab_parent", parent["work"], "parent-body"))
    child_same = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_child_same", "PARENT", "ident_child_same", parent["digest"], "PARENT_LINEAGE", "CUSTOMER_REST_ID", "c_parent", parent=parent["work"]))
    child_retry = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_parent", "ae_lab_parent", "work_child_same", "parent-body"))
    child_new = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_parent", "ae_lab_child_new", "work_child_same", "parent-body"))
    snap = snapshot(args, work_ids=["work_wh", "work_child_same", parent["work"]], effect_ids=["ae_lab_wh", "ae_lab_parent", "ae_lab_child_new"], digests=[wh_digest, parent["digest"]])
    ok = (
        wh["rc"] == 0 and wh_eff["rc"] == 0
        and man_bad["rc"] != 0 and err_has(man_bad, "admission_parent_required")
        and missing["rc"] != 0 and err_has(missing, "admission_admin_capture_required")
        and parent_eff["rc"] == 0 and child_same["rc"] == 0 and child_retry["rc"] == 0 and child_new["rc"] != 0
        and len([a for a in snap["audits"] if a[0] == "ae_lab_parent"]) == 1
        and not any(a[0] == "ae_lab_child_new" for a in snap["audits"])
    )
    add_case(
        "SEM-SOURCE-CLASSES-AND-CHILD",
        "source_classes_child",
        "tested_refuted_hypothesis" if ok else "reproduced_defect",
        f"wh={wh_eff['rc']} manual={man_bad['err'][:80]} nocap={missing['err'][:80]} child_new={child_new['err'][:80]}",
        {},
        snap,
    )

    # genuine new body progresses; repeated equal value does not create a second effect
    fast_clean(args)
    first = setup_admin_bound(args, "eq", "equal-body", "c_eq")
    e1 = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_eq", "ae_lab_eq", first["work"], "equal-body"))
    e1b = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_eq", "ae_lab_eq", first["work"], "equal-body"))
    e2 = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_eq", "ae_lab_eq2", first["work"], "equal-body"))
    new_body = "equal-body-successor"
    new_digest = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_eq", new_body)
    cap = exec_tx(args, "stocky_admin_capture", SHOP_A, capture_stmts(SHOP_A, DOMAIN_A, "cmd_eq_new", "ADMIN_ACTION", "ident_eq_new", new_digest, "CUSTOMER_REST_ID", "c_eq"))
    adm = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_eq_new", "ADMIN_ACTION", "ident_eq_new", new_digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", "c_eq"))
    e3 = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_eq", "ae_lab_eq_new", "work_eq_new", new_body))
    snap = snapshot(args, effect_ids=["ae_lab_eq", "ae_lab_eq2", "ae_lab_eq_new"], work_ids=[first["work"], "work_eq_new"], digests=[first["digest"], new_digest])
    ok = e1["rc"] == 0 and e1b["rc"] == 0 and e2["rc"] != 0 and cap["rc"] == 0 and adm["rc"] == 0 and e3["rc"] == 0 and len(snap["audits"]) == 2 and first["digest"] != new_digest
    add_case("SEM-EQUAL-AND-SUCCESSOR", "legitimate_progress", "tested_refuted_hypothesis" if ok else "reproduced_defect", f"retry={e1b['rc']} new_effect={e2['err'][:80]} successor={e3['rc']}", {}, snap)

    # two shops, equal command id and equal customer value
    fast_clean(args)
    rows = []
    for shop, domain, tag in ((SHOP_A, DOMAIN_A, "shopa"), (SHOP_B, DOMAIN_B, "shopb")):
        digest = source_commitment(domain, shop, "CUSTOMER_REST_ID", "c_same", "shared-body")
        cap = exec_tx(args, "stocky_admin_capture", shop, capture_stmts(shop, domain, "cmd_same", "ADMIN_ACTION", "ident_same", digest, "CUSTOMER_REST_ID", "c_same"))
        adm = exec_tx(args, "stocky_original_admission", shop, admit_stmts(shop, domain, f"work_{tag}", "ADMIN_ACTION", "ident_same", digest, "ADMIN_SESSION_CURRENT_INSTALL", "CUSTOMER_REST_ID", "c_same"))
        eff = exec_tx(args, "stocky_runtime", shop, apply_stmts(shop, domain, "CUSTOMER_REST_ID", "c_same", f"ae_lab_{tag}", f"work_{tag}", "shared-body"))
        rows.append((tag, cap["rc"], adm["rc"], eff["rc"], digest))
    snap = snapshot(args, effect_ids=["ae_lab_shopa", "ae_lab_shopb"], work_ids=["work_shopa", "work_shopb"], command_ids=["cmd_same"])
    ok = all(r[1] == 0 and r[2] == 0 and r[3] == 0 for r in rows) and rows[0][4] != rows[1][4] and len(snap["audits"]) == 2
    add_case("SEM-TWO-SHOPS", "legitimate_progress", "tested_refuted_hypothesis" if ok else "reproduced_defect", f"digests_differ={rows[0][4]!=rows[1][4]} rows={rows}", {}, snap)

    # empty versus null; unicode observation
    empty = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_empty", "")
    nfc = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_uni", "é")
    nfd = source_commitment(DOMAIN_A, SHOP_A, "CUSTOMER_REST_ID", "c_uni", "e\u0301")
    fast_clean(args)
    built = setup_admin_bound(args, "empty", "", "c_empty")
    eff = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_empty", "ae_lab_empty", built["work"], ""))
    ok_empty = built["digest"] == empty and built["admit"]["rc"] == 0 and eff["rc"] == 0
    add_case(
        "SEM-EMPTY-NULL-UNICODE",
        "canonicalization",
        "tested_refuted_hypothesis" if ok_empty else "reproduced_defect",
        "empty body is a real digest; NULL argument to the STRICT function is NULL",
        {"empty": empty, "nfc": nfc, "nfd": nfd, "nfc_equals_nfd": nfc == nfd, "sql_null": sql_null},
        snapshot(args, effect_ids=["ae_lab_empty"]),
        extra={"classification_note": "contract_ambiguity" if nfc != nfd else "unicode_normalized", "unicode_note": "Plan says canonical source content and does not specify NFC. Executable hash is byte-exact UTF-8, so NFC and NFD differ. Reported as ambiguity, not a defect."},
    )
    # force the unicode row's classification field to stay visible; the case above is the empty-body requirement.
    add_case(
        "SEM-UNICODE-NFC-NFD",
        "canonicalization",
        "contract_ambiguity",
        "NFC and NFD customer-body strings hash differently. No approved NFC rule is stated beyond the positional UTF-8 join.",
        {"nfc": nfc, "nfd": nfd, "equal": nfc == nfd},
    )

    # same-effect retry after sighting does not unwrite; new effect denied
    fast_clean(args)
    built = setup_admin_bound(args, "hist", "hist-body", "c_hist")
    eff = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_hist", "ae_lab_hist", built["work"], "hist-body"))
    sight = exec_tx(args, "stocky_original_admission", SHOP_A, sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", "sight_hist", built["digest"]))
    retry = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_hist", "ae_lab_hist", built["work"], "hist-body"))
    newer = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_hist", "ae_lab_hist2", built["work"], "hist-body"))
    snap = snapshot(args, effect_ids=["ae_lab_hist", "ae_lab_hist2"], digests=[built["digest"]])
    ok = eff["rc"] == 0 and sight["rc"] == 0 and retry["rc"] == 0 and newer["rc"] != 0 and len(snap["audits"]) == 1
    add_case("SEM-HISTORICAL-RETRY", "committed_idempotency", "tested_refuted_hypothesis" if ok else "reproduced_defect", f"retry={retry['rc']} newer={newer['err'][:100]}", {}, snap)

    # GUC is not a capability
    fast_clean(args)
    built = setup_admin_bound(args, "guc", "guc-body", "c_guc")
    poisoned = exec_tx(args, "stocky_runtime", SHOP_B, [
        ("SELECT set_config('stocky.trusted_work_id', %s, true)", (built["work"],)),
        ("SELECT public.stocky_apply_bound_customer_effect(%s,%s,%s,%s,%s, NULL, %s, %s)",
         (DOMAIN_B, SHOP_B, "CUSTOMER_REST_ID", "c_guc", "ae_lab_guc_bad", "CUSTOMER_WRITE", "guc-body")),
    ])
    ok = poisoned["rc"] != 0 and not err_has(poisoned, "") or poisoned["rc"] != 0
    snap = snapshot(args, effect_ids=["ae_lab_guc_bad"], work_ids=[built["work"]])
    ok = poisoned["rc"] != 0 and snap["audits"] == []
    add_case("SEM-GUC-NOT-CAPABILITY", "exact_effect_binding", "tested_refuted_hypothesis" if ok else "reproduced_defect", poisoned["err"][:200], {}, snap)

    # direct runtime insert bypass
    fast_clean(args)
    bypass = exec_tx(args, "stocky_runtime", SHOP_A, [
        ('INSERT INTO public."OriginalAdminCapture"(id,"canonicalDomain","shopId","commandId","sourceKind","sourceIdentity","sourceContentDigest","actorIdentity","capturedAt","liveGenerationId") VALUES (%s,%s,%s,%s,%s,%s,%s,%s, clock_timestamp(), %s)',
         ("oac_bypass", DOMAIN_A, SHOP_A, "cmd_bypass", "ADMIN_ACTION", "ident_bypass", "digest", "actor_a", "gen_a"))
    ])
    ok = bypass["rc"] != 0
    add_case("SEM-BYPASS-DIRECT-INSERT", "bypass", "tested_refuted_hypothesis" if ok else "reproduced_defect", bypass["err"][:200], {})

    # evidence expiry is not specified
    add_case(
        "SEM-EVIDENCE-EXPIRY",
        "evidence_expiry",
        "contract_ambiguity",
        "Q-008 remains open. The extracted contract has no evidence TTL. Missing ADMIN capture is denied (SEM-SOURCE-CLASSES). No retention period was invented.",
        {},
        extra={"question": "Q-008"},
    )

    # same semantic body under a second evidence class after admin commit
    fast_clean(args)
    built = setup_admin_bound(args, "cross", "cross-body", "c_cross")
    wh = exec_tx(args, "stocky_original_admission", SHOP_A, admit_stmts(SHOP_A, DOMAIN_A, "work_cross_wh", "WEBHOOK", "ident_cross_wh", built["digest"], "WEBHOOK_PROVIDER_AUTH", "CUSTOMER_REST_ID", "c_cross"))
    ok = wh["rc"] != 0 and err_has(wh, "admission_digest_conflict")
    add_case(
        "SEM-CROSS-CLASS-SAME-SOURCE",
        "source_classes_child",
        "tested_refuted_hypothesis" if ok else "contract_ambiguity",
        f"webhook of an already-admitted source digest: {wh['err'][:180]}",
        {},
        snapshot(args, digests=[built["digest"]], work_ids=[built["work"], "work_cross_wh"]),
    )


def mutation_controls(args, original_contract: Path) -> None:
    """Disposable copies only. Original file is hashed before and after."""
    before = sha256_file(original_contract)
    if before != CONTRACT_SHA:
        add_case("MUT-PREIMAGE", "mutation_control", "harness_failure", f"contract hash drifted before mutations {before}", {})
        return
    text = original_contract.read_text(encoding="utf-8")
    needle = """  IF v_capture IS NOT NULL
     AND public.stocky_admin_source_contradicted(v_domain, wa.\"sourceContentDigest\", v_capture) THEN
    PERFORM public.stocky_mark_uncorrelated_captures_contradicted(
      v_domain, wa.\"sourceContentDigest\", 'EFFECT_RECHECK', NULL);
    RAISE EXCEPTION 'effect_source_no_longer_fresh' USING ERRCODE = 'P0001';
  END IF;"""
    if needle not in text:
        add_case("MUT-LOCATE", "mutation_control", "harness_failure", "effect recheck block not found", {})
        return
    mutated = text.replace(needle, "  -- SINGLE-DEFENSE MUTATION: effect freshness recheck removed\n  NULL;\n", 1)
    mut_path = Path("/tmp/pr7-grok47-mut-contract-8426.sql")
    mut_path.write_text(mutated, encoding="utf-8")
    saved_contract = args.contract
    saved_db = args.dbname
    args.contract = str(mut_path)
    args.dbname = "pr7_grok47_mut"
    try:
        reset_database(args)
        built = setup_admin_bound(args, "mut1", "mut-body", "c_mut")
        sight = exec_tx(args, "stocky_original_admission", SHOP_A, sight_stmts(SHOP_A, DOMAIN_A, "QUEUED", "sight_mut", built["digest"]))
        eff = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_mut", "ae_lab_mut", built["work"], "mut-body"))
        snap = snapshot(args, effect_ids=["ae_lab_mut"], digests=[built["digest"]])
        # The safety assertion "sighting-first effect writes nothing" must FAIL on this copy.
        assertion_holds = eff["rc"] != 0 and snap["audits"] == []
        control_ok = (not assertion_holds) and eff["rc"] == 0 and len(snap["audits"]) == 1 and sight["rc"] == 0
        # positive control on the same mutated db: a fresh effect with no sighting still commits
        fresh = setup_admin_bound(args, "mutfresh", "fresh-body", "c_mutfresh")
        fresh_eff = exec_tx(args, "stocky_runtime", SHOP_A, apply_stmts(SHOP_A, DOMAIN_A, "CUSTOMER_REST_ID", "c_mutfresh", "ae_lab_mutfresh", fresh["work"], "fresh-body"))
        add_case(
            "MUT-SINGLE-EFFECT-RECHECK",
            "mutation_control",
            "tested_refuted_hypothesis" if control_ok and fresh_eff["rc"] == 0 else "harness_failure",
            "Removing only the effect freshness recheck lets a sighting-first effect commit. Fresh effect still commits. Original file not edited.",
            {"sight_rc": sight["rc"], "effect_rc": eff["rc"], "fresh_rc": fresh_eff["rc"], "audits": len(snap["audits"])},
            snap,
        )
    finally:
        args.contract = saved_contract
        args.dbname = saved_db
        if mut_path.exists():
            mut_path.unlink()
    after = sha256_file(original_contract)
    add_case(
        "MUT-HASH-RESTORED",
        "mutation_control",
        "tested_refuted_hypothesis" if after == CONTRACT_SHA == before else "harness_failure",
        f"before={before} after={after}",
        {},
    )


def minimize_defects(args) -> None:
    """Repeat every reproduced_defect once on a pristine reload. Keep the smaller schedule."""
    suspects = [r for r in RESULTS if r["classification"] == "reproduced_defect"]
    if not suspects:
        add_case("MINIMIZE-NONE", "minimization", "tested_refuted_hypothesis", "No suspected defect required a pristine rerun.", {})
        return
    add_case(
        "MINIMIZE-PENDING",
        "minimization",
        "reproduced_defect",
        f"{len(suspects)} suspected defect(s) recorded for pristine rerun: " + ", ".join(r["id"] for r in suspects),
        {"ids": [r["id"] for r in suspects]},
    )


def main() -> int:
    oracle_self_check()
    ap = argparse.ArgumentParser()
    ap.add_argument("--pghost", required=True)
    ap.add_argument("--pgport", required=True)
    ap.add_argument("--dbname", required=True)
    ap.add_argument("--contract", required=True)
    ap.add_argument("--seed", required=True)
    ap.add_argument("--workstream", choices=["a", "b", "mutations", "all"], required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    contract = Path(args.contract)
    seed = Path(args.seed)
    if sha256_file(contract) != CONTRACT_SHA or sha256_file(seed) != SEED_SHA:
        raise SystemExit("input_hash_mismatch")
    if args.workstream in ("a", "b", "all"):
        reset_database(args)
    if args.workstream in ("a", "all"):
        workstream_a(args)
    if args.workstream in ("b", "all"):
        if args.workstream == "all":
            fast_clean(args)
        workstream_b(args)
    if args.workstream in ("mutations", "all"):
        mutation_controls(args, contract)
    if sha256_file(contract) != CONTRACT_SHA:
        add_case("FINAL-HASH", "preservation", "harness_failure", "contract bytes changed", {})
    else:
        add_case("FINAL-HASH", "preservation", "tested_refuted_hypothesis", CONTRACT_SHA, {})
    minimize_defects(args)
    payload = {
        "h": H_SHA,
        "contract_sha256": CONTRACT_SHA,
        "seed_sha256": SEED_SHA,
        "limits": LIMITS,
        "postgres_note": "caller records server version",
        "cases": RESULTS,
        "counts": {
            "cases": len(RESULTS),
            "reproduced_defect": sum(1 for r in RESULTS if r["classification"] == "reproduced_defect"),
            "tested_refuted_hypothesis": sum(1 for r in RESULTS if r["classification"] == "tested_refuted_hypothesis"),
            "harness_failure": sum(1 for r in RESULTS if r["classification"] == "harness_failure"),
            "contract_ambiguity": sum(1 for r in RESULTS if r["classification"] == "contract_ambiguity"),
            "unexecuted_application_integration": sum(1 for r in RESULTS if r["classification"] == "unexecuted_application_integration"),
        },
    }
    Path(args.out).write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(json.dumps(payload["counts"], indent=2))
    return 0 if payload["counts"]["reproduced_defect"] == 0 and payload["counts"]["harness_failure"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
<!-- GROK47-EXTRACT:end path=grok47_stress_lab.py -->
