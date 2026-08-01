# Phase 1 PR 2 — Tenant Access Correction Implementation Report

**Decision:** D-028  
**Branch:** `phase-1/tenant-access`  
**Pull request:** [#13](https://github.com/Vedang1998/Stocky/pull/13) (draft)  
**Authorized base:** `main@04289d61f605414597ac85f47830a3c9d2f9e33d`  
**Independently reviewed implementation head:** `6f9ca22c069a46003b6944ff56c888ff91e95cdc`  
**Independent verdict:** `NOT READY — CORRECTIONS REQUIRED`  
**Preserved review:** `PR2_TENANT_ACCESS_REVIEW_REPORT.md` (Claude Code; chain-of-custody preface only)  
**Correction backlog:** `PR2_TENANT_ACCESS_CORRECTION_BACKLOG.md`

## Identity (filled at handoff)

| Field | Value |
|---|---|
| Reviewed head | `6f9ca22c069a46003b6944ff56c888ff91e95cdc` |
| Preservation commit | `1db2ce51468172676af4ea3fd46ea177608f6a50` |
| Correction commits | see git log after preservation |
| Final exact head | *(set after final documentation commit)* |
| PR state | OPEN, draft, unmerged |

## Finding disposition

| Finding | Severity | Status | Summary |
|---|---|---|---|
| F-PR2-01 | P1 | Corrected | Disjunctive direct scope + child parent-lineage; no silent repair |
| F-PR2-02 | P1 | Corrected | Recursive include/select/_count scoping; unknown relations fail closed |
| F-PR2-03 | P1 | Corrected | HMAC-SHA256 envelopes, secret, skew/age, source allowlist |
| F-PR2-04 | P2 | Corrected | Scanner detects dynamic/re-export/computed/alias; exact allowlists |
| F-PR2-05 | P2 | Corrected | connect/set/disconnect/nested write ownership validation |
| F-PR2-06 | P2 | Corrected | Bounded recursive client-hint denial incl. params |
| F-PR2-07 | P3 | Documented residual | `createIfMissing: false` on webhooks; no provenance schema |
| F-PR2-08 | P3 | Documented | R-039 distinguishes transport integrity vs PR 4 persistence |
| F-PR2-09 | P3 | Documented | npm `11.5.2` / engines noted in `.env.example` and docs |

## Architecture evidence

- **Direct nullable scope:** `(shopId=tenant AND shop=domain) OR (shopId IS NULL AND shop=domain)`
- **Child lineage scope:** parent relation tenant-scoped AND (`shopId=tenant` OR `shopId IS NULL`)
- **Relation scoping:** `app/tenant/relations.ts` metadata; recursive where injection; to-one post-validation
- **Nested writes:** resolve connect/set/disconnect/nested update/delete via tenant-scoped lookups
- **Envelope:** `tenant-job-envelope-v1` + HMAC-SHA256 base64url; deterministic JSON field order; `TENANT_JOB_ENVELOPE_SECRET` ≥32 bytes
- **Timestamp policy:** max future skew 5 minutes; max age 24 hours
- **Producers:** accept branded `TenantAuthority` only
- **Scanner:** dynamic import, re-export, path alias, computed delegate, raw shop queue, envelope union, exact allowlist, deterministic content digest
- **Client hints:** getAll query values, nested JSON/form, multipart, route params; depth/node/string limits

## Test evidence (local, disposable PostgreSQL 16 + Redis 7)

Commands and counts are recorded in the handoff return report after the full validation suite.

## Safety

- No RLS / DB roles / non-null / composite FKs
- No production backfill / deployment / merchant data
- No PR 3 / PR 4 persistence tables
- Inventory-write flags remain default OFF
- No real secret committed (`TENANT_JOB_ENVELOPE_SECRET` test-only in CI / `.env.example` blank)
- PR remains draft and unmerged

## Exact next action

```text
Return to ChatGPT for exact-head triage and the independent PR 2 correction-review prompt.
```
