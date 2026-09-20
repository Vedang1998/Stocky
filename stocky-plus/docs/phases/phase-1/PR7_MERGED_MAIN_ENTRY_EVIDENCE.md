# Phase 1 PR7 — Merged-main entry evidence (planning / feasibility)

**Status:** `PR7 ENTRY-EVIDENCE PACKAGE COMPLETE — PLANNING/FEASIBILITY ONLY; RUNTIME NOT AUTHORIZED`
**Implementer:** Cursor (coordinator)
**Lane:** one-dependency-ahead research / feasibility under Accelerated Safe Delivery. **Not** PR7 application implementation.
**Authority:** ChatGPT mandate [PR45 comment 5746516577](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5746516577) (2026-09-20T00:49:06Z). Proposal input is frozen PR45; it is **not** accepted product authority.
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**PR7 runtime:** NOT AUTHORIZED
**D-054:** EFFECTIVE — **no D-055**
**R-176:** OPEN / P0 (unchanged)
**R-164:** unchanged
**Q-008:** OPEN

This packet does **not** edit `PROJECT_STATUS.md`, `RISK_REGISTER.md`, `OPEN_QUESTIONS.md`, `DECISIONS.md`, or production policy. Existing D-PR7 / CP / XC / TF identifiers are preserved. New observations use `PREP-*` IDs.

## 1. Identities

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Coordinator branch | `planning/pr7-entry-evidence-20260919-37c6` (requested `planning/pr7-entry-evidence-20260919`; platform suffix `-37c6`) |
| Authorized base **W** / `origin/main` at start | `ee193f38491245a10fb2fa60d2cf9a29f3271605` (PR #43 squash; Phase 1 PR6-D merged) |
| Historical **V** | `a3ff480f1477237f8055f10c43298480a05728a1` |
| Frozen PR45 proposal (read-only) | `a292bc8a6ea26192bc295af7338dd6d653a3e65c` on `cursor/planning-pr7-audit-roles-privacy-20260916-63ef`; still based on **V**, not **W** |
| PR45 docs blobs | plan `c80ca2c5d5d69c7ab0ff5d0da29708339b9f7a9b`; matrix `b48ba51555bb3e903b5f489493b4d3e51825b8cf`; reviews `c1fa5c2fed74bf80d1006267b43d767258895c17`, `0a29e79e1e9ae83c8d9ec4e2400ae0d66c71d50f`, `e609e9526ed1ec043551ca68d6b977f5b5935d0c` |
| PR47 closeout candidate (read-only, **not** merged) | `fde01dc5ba2e0076b1579d6690f0548db749af56` on `phase-1/pr6-formal-closeout-b15d` — later integration prerequisite |
| Existing-assignment check | no `planning/pr7-entry-evidence*` writer existed; PR45/PR47/PR43 were **not** reused |
| Node | `v22.14.0` |
| Redis binary used for probes | `Redis server v=7.0.15` (`/usr/bin/redis-server`) |
| Official docs access date | 2026-09-20 |

Pinned W lockfile packages (executed from `stocky-plus/package-lock.json` + `node_modules/*/package.json`):

| Package | Version | integrity |
|---|---|---|
| `@shopify/shopify-app-react-router` | 1.2.1 | `sha512-37FtkGoHkvXFUsBU/ibhTrlAGoogfq0VodyEckkggi35lrjZfOGX7xKzMWW13QyD6q8bGg/wCBNOW4WANvewEA==` |
| `@shopify/shopify-api` | 13.1.0 | `sha512-TwYL9kPxOgQwwlc9tmnAmSDs79Gdg9QLaIMCfkaCJxkhWxIHVkPWa74GvbBwnmTtB8jkg61Ja4/Qxrk9bCBUiA==` |
| `@shopify/shopify-app-session-storage` | 5.0.1 | `sha512-VL66qkz2w1x5hH14v+swFZAnN36VrFuVi/Lc6FkLTJxCSvSu4fPNYn04kjIxGykgsRb7trLBXC7mF3j8yDUFeA==` |
| `@shopify/shopify-app-session-storage-prisma` | 9.0.1 | `sha512-f/RT4X6hSADfh53dl9+cc0Ev9QcTwy01GoJFnNQRmjpSsNdDq7oBuCFbz/IufU+C9MJ/1wGi5haOr0R7VIcd2Q==` |
| `bullmq` | 5.81.2 | `sha512-Hi9GaVCC6HE9bQP65j/FNv1aL1fcEukTF99ezS5pl1Ud+joCFpNWiPCV45mWdkEmpuacS0XJdMMFGKPIHCwoPg==` |
| `ioredis` | 5.11.1 | `sha512-ehuGcf94bQXhfagULNXrJdfnWO38v070jxSx/qE87Kjzmu2fU7ro5EFAb+OPituLqgfyuQaym5DlrNydW2sJ9A==` |

## 2. Isolation and helper assignment

Coordinator is the only Git writer. Helpers were launched in **detached worktrees** at **W** (`/tmp/pr7-helpers/{A,B,C}`) with private output roots. They were forbidden to commit, push, edit `/workspace`, share Redis/Postgres, or implement PR7 runtime.

| Helper | Agent id | Exclusive checkout | Private resources | Role |
|---|---|---|---|---|
| A | `bc-74edc001-ea11-59e6-8b7e-121fc1aafd0a` | `/tmp/pr7-helpers/A` | no Redis/Postgres | pinned auth-library feasibility |
| B | `bc-81eaa84b-edf5-585a-9ed8-a5938ac5150e` | `/tmp/pr7-helpers/B` | Redis **16379** dir `/tmp/pr7-helpers/B-redis`; scratch `/tmp/pr7-helpers/B-scratch` | queue + D-scratch + SYNTHETIC privacy fence |
| C | `bc-e6dd9789-3fca-5fa7-92ef-3c8f36101e9e` | `/tmp/pr7-helpers/C` | no Redis; no shared PG | W compatibility inventory |

Coordinator probes used **different** resources: Redis **16380** (`pid 4966`, torn down by exact PID; 16380 refused after teardown) and `/tmp/pr7-coordinator/**`. Coordinator did **not** send commands to 16379. Helper B’s instance was observed `PONG` on 16379 during its run (`redis-server` pid **4169**); that instance is not evidence of a shared namespace with coordinator probes.

Coordinator independently executed all three probe classes and then **reconciled** helper artifacts (not Claude approval):

Inventory `PREP-C-*` IDs in this packet follow **Helper C** (`HELPER_C_REPORT.md`). Coordinator Redis/auth IDs remain `PREP-B-*` / `PREP-A-*` (hyphen). Helper B JSON keys use `PREP_B_*` (underscore) and are **not** the same numbering.

| Helper | Artifact | SHA-256 |
|---|---|---|
| A | `/tmp/pr7-helper-outputs/A/probe-results.json` (mocked token-exchange only) | `9ee6476584946a5f8cced9e73182f6dd8cc008988915d697360faa041bcd3308` |
| B | `/tmp/pr7-helper-outputs/B/results/00-isolation.json` (16379 pid 4169, porcelain 0) | `207b4af50195182af46899e498bb400bf8c7ca6c55fd6715a472f6fcdacdf7b6` |
| B | `/tmp/pr7-helper-outputs/B/results/01-bullmq.json` (real BullMQ on 16379) | `5c7204ffcbc01209b94ec020cdf5fe8f6a4e5c10c6c9e956b3c644e7ccff0f2a` |
| B | `/tmp/pr7-helper-outputs/B/results/01b-inflight-cancel.json` | `227193ac78d65a863e2df36d2c4a8a45fe50efc7a9dd64f32974cf5c4b6bc790` |
| B | `/tmp/pr7-helper-outputs/B/results/02-dscratch.json` | `ba1b2b3503e38d2d891dbb3876ec306ab5837a12efcaaa381ae19efaff51a5fe` |
| B | `/tmp/pr7-helper-outputs/B/results/03-synthetic.json` | `67fb0fe7a4e374a7f7b23dd2464bb31a37d9bed4bccd6b16d41b5c0cf1459e5f` |
| C | `/tmp/pr7-helper-outputs/C/WRITER_INVENTORY.json` (86 rows: unchanged 32, misnamed 4, behavior_change 4, v_omitted 22, w_only 23, missing 1) | `f7f09cde84067c09675bac8f0ce14d130b520bc9bf5d369fd15a23eb4ab8c7f0` |

Helpers did not commit. Their worktrees stayed detached at **W**.

Default distro Redis on 6379 was not used (`policy-rc.d` denied service start; helper B recorded `port_6379_connect_ex: 111`). Helper B isolation JSON: head **W**, porcelain 0, 16379 `PONG`, pid **4169**, dir `/tmp/pr7-helpers/B-redis`.

## 3. Required reading (executed)

Read, not restated as new product rules:

- `AGENTS.md`; `stocky-plus/docs/README.md`; `PROJECT_STATUS.md` (stale vs live **W**; not edited)
- `product/00_READ_ME_FIRST.md`; architecture §13 security/privacy; D-014…D-022; D-021; D-054; Q-008 recommended policy
- `CI_POLICY.md`; `ACCELERATED_SAFE_DELIVERY.md`
- PR6-A/B/C closure records; `PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`; D production APIs on **W**
- Both PR45 documents + three immutable reviews + controlling comments 5729229659, 5737038796, 5746516577
- Exact W entry points: `app/shopify.server.ts`, `require-admin-tenant.server.ts`, `after-auth.server.ts`, `bootstrap.server.ts`, `lifecycle.server.ts`, `dispatcher.server.ts`, `queue.server.ts`, `queue-presence.server.ts`, `source-stage.ts`, `health.server.ts`, compliance stub

## 4. Helper A / coordinator — pinned authentication library

### 4.1 Source identities (SHA-256 of traced files)

```
87b9721b8f27e265194b25642c36fcac6eb700b31cd0a5fa7a2efe64825b73e0  …/shopify-app-react-router/dist/esm/server/authenticate/admin/authenticate.mjs
9a7539a4ee929701639c1b6f7d7bdb08518ce6cffd660e97cb6ddd5a0da0d354  …/authenticate/admin/strategies/token-exchange.mjs
429daa06bad2e8238138fe734ca3cc5cd495b4fca07dcf8722618863fe81cc98  …/shopify-api/dist/esm/lib/auth/oauth/create-session.mjs
84a355cad088297b37de3adfc8d75ec6e19a0afb9b03d3885f87e0eceba742cb  …/shopify-api/dist/esm/lib/session/session-utils.mjs
e9125f96c7eefff6a5cd6ca6a7bd77ed60b21f12c46bf8390405e3870eb37dda  …/shopify-api/dist/ts/lib/auth/oauth/types.d.ts
a65649061bd6914ae848b4ff7dd49765ce7fc138f79b57f3270f55bf478e5fba  …/shopify-app-session-storage-prisma/src/prisma.ts
21b881203e64f30811708fd87cb935eff371a5f79b4c114c7b516c5c4f429b58  stocky-plus/app/shopify.server.ts
8b697bfbbbaa8670450077138ed9341871f1040e3812cf1ebb91fe55effc629e  stocky-plus/app/tenant/require-admin-tenant.server.ts
```

Probe scripts (disposable; **not** repository runtime):

| Script | SHA-256 | Result log SHA-256 | Exit |
|---|---|---|---|
| `auth-precision.mjs` | `f4e4b0de059299fa4c44bb70bd798a2a9e50861a4e9972346f433fed74af94f3` | `ffd1c4de4b20d05eb6e4489c99755966fab4f97aeebc9d35bca5ab356ce3db0e` | 0 |
| `auth-jwt-shopifyapp.mjs` | `9cd54ab57dee5e1bf5634e120b23bd1b7c10e536be73c4664fb11cf3322e22e4` | `36a7310277769928f538dad847787c691ff6b89244c0c9a86f246f3e39f48a1b` | 0 |

Command:

```bash
NODE_PATH=/workspace/stocky-plus/node_modules node /tmp/pr7-coordinator/probes/auth-precision.mjs
NODE_PATH=/workspace/stocky-plus/node_modules node /tmp/pr7-coordinator/probes/auth-jwt-shopifyapp.mjs
```

`shopify.server.ts` was **not** edited. Online tokens were **not** enabled in application source. The JWT/`shopifyApp` probe constructed an in-memory app with synthetic credentials and a memory session store only.

### 4.2 Library vs official docs vs W adapter

**OFFICIAL** (Shopify, accessed 2026-09-20):

- [ID tokens](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens): JWT authenticates the **user**; **no permissions**; `sub` identifies the user as a **string** (example `"42"`). Apps should check `iss`/`dest` hostnames match; templates usually do this.
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/online-access-tokens): offline is default (background/webhooks); online is optional, 24h or admin logout; `associated_user.id` “uniquely identifies the user”; `account_owner` / `collaborator` / `email_verified` documented.

**FACT (library 13.1.0 / react-router 1.2.1), executed:**

| Observation | ID | Result |
|---|---|---|
| `OnlineAccessUser.id` typed `number`; `JwtPayload.sub` typed `string` | PREP-A-08 | types + runtime |
| `shopifyApp` default `useOnlineTokens: appConfig.useOnlineTokens ?? false` (`shopify-app.mjs` deriveConfig) | PREP-A-05 | source |
| W `shopify.server.ts` does **not** set `useOnlineTokens`; sets `future.expiringOfflineAccessTokens: true` | PREP-A-05 | W file hash above |
| Embedded `authenticate.admin` session id: online `api.session.getJwtSessionId(shop, payload.sub)`; offline `getOfflineId(shop)` | — | `authenticate.mjs` |
| Token exchange requests **offline first**; online exchange **only if** `config.useOnlineTokens` | — | `token-exchange.mjs` |
| `createSession` online id uses `` `${associated_user.id}` `` (number → string) | PREP-A-02 | executed |
| Offline session `isOnline=false`, id `offline_<shop>`, **no** `onlineAccessInfo` | PREP-A-09 | executed |
| Staff: `account_owner:false`, `collaborator:true` persist on `onlineAccessInfo.associated_user` | PREP-A-10 | executed |
| JWT `sub` `"9007199254740993"` survives `decodeSessionToken` as that **string** | PREP-A-01 | executed |
| `decodeSessionToken` rejects bad `aud` and forged signature; does **not** reject `iss`/`dest` hostname mismatch | PREP-A-04 | executed (`destMismatchRejectedByLibrary: false`) |
| Prisma adapter writes `userId: (associated_user.id as unknown as bigint)` — **compile-time assertion**; runtime value remains a JSON **number** | PREP-A-03 | source + `typeof` probe |
| W `requireAdminTenant` uses `session.shop` only; never `session.userId` / `onlineAccessInfo` / `sessionToken.sub` | PREP-A-06 | W source |
| `authenticate.admin` without a session token throws `Response` (observed `Response 200` bounce/embed path) — **no** myshopify.com call | — | executed |

**Hypothetical adapter (smallest remaining D-PR7-01/02 contract choice — not decided here):**

1. Persist actor as the verified JWT `sub` **string** (PREP-A-01). Do **not** stringify `associated_user.id` (PREP-A-02 loses `9007199254740993` → session id `…_9007199254740992`).
2. Treat `associated_user.account_owner === true` **and** `payload.sub` as same-shop owner evidence only after online token bind is authorized (D-PR7-02). Unsafe numeric correlation → `unassigned` (D-PR7-04 already constrained).
3. Autonomous jobs continue on **offline** sessions (PREP-A-09): no staff actor.
4. Add dest/iss hostname equality in **app** code if the library still omits it (PREP-A-04). Official docs require it; installed `decodeSessionToken` does not.

### 4.3 Negative controls (auth)

| Case | Actual | Pass |
|---|---|---|
| `Number("9007199254740993") === 9007199254740992` | true | yes |
| `createSession` online id for that number | `probe-shop.myshopify.com_9007199254740992` | yes (documents the defect) |
| JWT `sub` full digits | `"9007199254740993"` | yes |
| Offline has no `associated_user` | `onlineAccessInfo` undefined | yes |
| Invalid `aud` rejected | threw | yes |
| Forged signature rejected | threw | yes |
| iss/dest mismatch accepted by library | **not** thrown | yes (LIMIT vs official docs) |
| Safe id `42` session suffix | `_42` | yes |

### 4.4 UNVERIFIED (must stay labelled)

- Live Shopify / App Bridge ID tokens (PREP-A-07). Helper A **did** drive installed `authenticate.admin` with a **mocked** `POST /admin/oauth/access_token` (33 fetch-log rows, all `mocked: token_exchange`; GraphQL and Partners URLs **fail-closed**). That verifies library wiring, not Shopify’s real token body.
- Whether every compliance delivery includes `X-Shopify-Event-Id` (plan residual 2).

Helper A `authenticate.admin` (in-memory `shopifyApp`, `useOnlineTokens` only in the probe) — selected actuals:

| Case | ok | session.id | sessionToken.sub |
|---|---|---|---|
| offline embedded | true | `offline_prepa-test-shop.myshopify.com` | `548380009` (JWT still present; session offline) |
| online owner | true | `…_548380009` | `548380009` |
| staff / collaborator | true | `…_1001` / `…_1002` | matching string ids |
| wide `sub` string + JSON-number id | true | `…_9007199254740992` | `9007199254740993` (**collision**) |
| numeric JWT sub already a JSON number | true | `…_9007199254740992` | `9007199254740992` (digits lost **before** library stringify) |
| online flag but token body has no `associated_user` | true | **offline_**… | JWT sub still decoded |
| expired / forged / wrong aud | false | — | — |
| iss/dest hostname mismatch | **true** (library accepted) | dest shop | — |
| forged dest other shop | **true** | `prepa-other-shop.myshopify.com_548380009` | session.shop follows **dest** |
| client body `account_owner` ignored | true | staff `…_1001` | token `associated_user` wins |
| non-token-exchange store URL / Partners | threw FAIL-CLOSED | — | — |

**PREP-A-11:** plan residual “library returns `sessionToken` + online `associated_user` when `useOnlineTokens: true`” is **verified on the installed library with mocked transport**. It remains UNVERIFIED against live Shopify.

**PREP-A-12:** a numeric JWT `sub` is already lossy; D-PR7-01 must require a **string** `sub` in the JWT, not merely avoid `String(number)` later.

## 5. Helper B / coordinator — Redis, filesystem, privacy boundary

### 5.1 Real W primitives (not a privacy processor)

Queue (`app/jobs/queue.server.ts`): `WEBHOOK_QUEUE="stocky-webhooks"`, `CRON_QUEUE="stocky-cron"`; producers `enqueueWebhook`, `enqueueCatalogSync`, `enqueueAfterAuthCatalogSync`, `enqueueInventoryStateReconcile`, `enqueueAbcAnalysisForShop`, **W-new** `enqueueOrderFactsSync`, `enqueueOrderFactsReconcile`. `requireRedisUrl` fails closed if unset. **No** production `remove` / generation-fenced drain / `FLUSHALL` wrapper. Tests call `queue.obliterate({ force: true })` and `job.remove()`; that is harness-only (PREP-C-11).

Presence: `inspectQueueDispatchPresence`, `classifyExistingQueueJob` (`app/sync/queue-presence.server.ts`).

D scratch on **W** (`app/lib/order-facts/sync/source-stage.ts`): `inspectDScratchOccupancy`, `reclaimOperatorSelectedDScratch` (requires `quiescenceConfirmed: true`; skips `symlink_refused`, `not_verified_d_resource`, `live_writer`, `not_an_attempt_basename`, `outside_namespace`), `reinitializeDScratchReservationLedgerAfterQuiescence`, `createOwnedScratchDir` / `disposeOwnedScratch`. Operator runbook `PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`. Residual 3 of PR45 §9 is **closed as an API existence fact** on merged W; it is **not** a privacy drain proof.

Export: `app/routes/app.analytics_.export.tsx` returns **HTTP CSV** after `requireAdminTenant`. No S3/R2/GCS module on W (PREP-B-06). Absent object storage is an **implementation dependency**, not a fabricated provider test.

### 5.2 Executed Redis schedules (port 16380, bullmq 5.81.2 / ioredis 5.11.1)

Script SHA-256 `483d9cb5360ae9dccc484c5fff46d8d2f108b8fd2fb61766b46ffbe47306c88d`. Result log `bfb3fb5f50f473452cd7e3fa5161e990294a9f49bed97d34e0031c2ddf7e26cc`. Exit 0. Redis pid **4966** SIGTERM’d; post-check `16380` connection refused. 16379 left for helper B.

| ID | Schedule | Actual |
|---|---|---|
| PREP-B-01 / PREP-COORD-B-01 | add job → write `external-write.txt` → `job.remove()` | Redis job gone; **file remained**. Queue cancel is **not** “no external write”. |
| PREP-B-02 | `SET hint:privacy:shop-a EX 30` | TTL 30; remaining TTL is **not** a drain. |
| PREP-B-03 | job `generation: gen-1` while current `gen-2` | stale job still getJob-able; **SYNTHETIC** — W has no generation fence on Redis. |
| PREP-B-04 | remove `shop-a-1`, keep `shop-b-1` | shop-b job remained (jobId isolation ≠ privacy fence). |
| PREP-B-07 | FLUSHALL | **not called**. |
| PREP-B-08 | power-loss | **not executed**; no claim. |

### 5.3 Executed D-scratch negatives (existing W tests; bounded)

`npx vitest run app/lib/order-facts/sync/scratch-quota.test.ts` — **4 passed / 0 failed**, exit 0, log SHA-256 `03b102470e5ca02a6a97f7d0c0901e071dfd8f98575cf5c89449e069930d4c27`. HEAD **W**. Missing ledger in an initialized namespace is **not** empty; orphan temp metadata refused (PREP-B-09).

Name-filtered `source-stage.test.ts` (`-t` three cases) — **3 passed / 43 skipped**, exit 0, log SHA-256 `88a11566f2f62d13a9878de3336a4f36a13a6aec655dfd277f59c5a77ac58a72`:

- refuses symlink scratch root (`scratch_symlink_refused`)
- refuses symlink/marker substitution on dispose (`scratch_unowned`)
- does not reclaim live, foreign, markerless, or symlink paths (`live_writer`, `not_an_attempt_basename`, `not_verified_d_resource`, `symlink_refused`)

Skipped rows are **not** claimed executed. Full source-stage / PR6-D scale / million-line envelopes were **not** rerun (no new evidentiary reason).

Helper B additionally ran **real** BullMQ workers on **16379** (not coordinator 16380):

| Helper B case | Counterexample |
|---|---|
| PREP_B_05 TTL hint | hint TTL → 0 while worker still ticking |
| PREP_B_06 `Job.remove()` | inspect → MISSING; already-started worker can still write (this run: 0 post-remove ticks, but process stayed alive — cancel ≠ drain) |
| PREP_B_07 decoy PID | killed decoy; real worker + Redis `active` job remained |
| PREP_B_08 SIGKILL worker | leftover file 348 bytes; Redis job still `RUNNABLE_EXISTING`/`active`. **Not** power-loss |
| PREP_B_09 late publication | in-memory cancel label with `redisRemoved=false`; delayed job stayed runnable |
| PREP_B_10 stale generation | SYNTHETIC `fence=ERASING` on payload; W-shaped worker (`CHECK_GENERATION_FENCE=0`) still ticked |
| PREP_B_11 positive drain | Worker finished + `.done` file + terminal `completed` — the **only** Redis success shape that counts |
| PREP_B_12 | W uninstall/dispatcher/webhook **do not** call `Queue.remove`; PG CANCELLED ≠ Redis remove |

SYNTHETIC coordinator (`03-synthetic.json`): poll recovers a lost Redis hint (PREP_B_22); stale enumerator leaves keys unchanged (PREP_B_23); unconfigured export is `export_storage_unconfigured` (PREP_B_24); EACCES keeps incomplete (PREP_B_25); **export writer that snapshots fence=LIVE then publishes after ERASING still lands a file** (PREP_B_26) unless it re-reads under the publication lock (PREP_B_27). SYNTHETIC ≠ installed fence.

### 5.4 SYNTHETIC privacy coordination model (labelled; not an application fence)

Proposed PR7 coordinator (plan §7.6.5 Decision B) is **not** a `DurableJob`. Optional Redis wake hint; PostgreSQL poll recovers. Completeness **must not** be inferred from:

- BullMQ `remove` / cancelled label (PREP-B-01)
- TTL/PID (PREP-B-02; D reclaim already refuses live PID / in-process writers)
- sampled empty directory
- `processingEnabled=false`

**Minimal viable contract before `COMPLETED` (implementation, not this PR):**

1. Domain / customer-target PG gates as constrained in PR45 §7.6.2 (cooperative; uninstrumented writers must be drained first).
2. Positive drain **or** stale-generation fence for Redis jobs of that shop/generation (API absent on W — PREP-C-11).
3. D scratch: occupancy `operatorInterventionRequired=false` **and** no unknown attempts **or** incomplete/visible request (D accepted recovery boundary).
4. Export/object storage: if unconfigured, treat as **no durable export bytes** with an explicit recorded dependency; if configured later, generation-fence or positive delete with residual proof. Do not invent a provider test (PREP-B-06).
5. Never FLUSHALL. Never blanket `/tmp` delete.

Customer vs shop: customer topics must not take the exclusive shop gate (plan). Redis jobId isolation (PREP-B-04) is **not** that gate.

## 6. Helper C / coordinator — merged-W compatibility

`git diff --stat V…W`: 92 files, +25501 / −327, **one** squash commit `ee193f3` (PR #43). Non-doc runtime delta is PR6-D order-facts sync, three webhook routes, queue/intake/sanitize/health/envelope wiring, scratch quota, and tests. PR45 inventory is **V-era** and must be refreshed (plan §7.9 already said so).

### 6.1 PR45-named symbols on W

All 26 `ParticipatingWriterInventory` **paths** still exist on W. Naming deltas:

| PR45 label | W fact | Class |
|---|---|---|
| `getShopHealth` | exported `computeSyncHealth` **upserts** `SyncHealth` | **moved + newly relevant writer** (PREP-C-04, PREP-C-29) |
| `lockSyncRun` | **local** function in `checkpoint.ts`; callers are exported persist/complete helpers | unchanged shape |
| `ensureDispatchRecord` / `markDispatchFailed` / `dispatcher_disabled_shop_path` | local / composite; `dispatchPendingJobs` ~1373–1390 still writes after `processingEnabled=false` | unchanged (TF-03) |
| `assertShopProcessingEnabled` | still **local** in `webhook-processor.ts` | unchanged |
| `cancelAllCancellable` | still **local** in `uninstall.server.ts` | unchanged |
| `withTenantBoundTransactionState` | still **local** in `tenant-db.server.ts` | unchanged (PREP-C-06) |
| `withTenantBoundTransaction` | still **exported** from `db-context.server.ts` | unchanged; still **required** future wrapper |

Lifecycle exports on W (all `getControlPlanePrisma().$transaction` / `lockDurableJob`; **no** `processingEnabled` in this file): `claimAttempt`, `renewAttemptHeartbeat`, `completeAttemptSuccess`, `completeAttemptRetry`, `completeAttemptFail`, `completeAttemptDeadLetter`, `recoverExpiredRunningAttempts`. Reaper remains in this file.

### 6.2 Newly relevant W-only (PR6-D) — PR45 V inventory missed

| File | Symbol | Why PR7 cares |
|---|---|---|
| `app/jobs/queue.server.ts` | `enqueueOrderFactsSync`, `enqueueOrderFactsReconcile` | ordinary DurableJob intake; needs lifecycle shared gate |
| `app/jobs/workers/order-facts/sync-jobs.ts` | `runOrderFactsSyncJob`, `runOrderFactsReconcileJob` | long I/O; D scratch bytes; process-loss already tested in D, **not** a privacy fence |
| `app/lib/order-facts/sync/source-stage.ts` | occupancy / reclaim / stage / dispose | residual 3 API **exists**; completion still needs occupancy proof |
| `app/routes/webhooks.orders.edited.tsx` et al. | route actions → intake | new webhook writers into CP |
| `app/sync/health.server.ts` | `computeSyncHealth` + `orderFactsScratch` | **writes** SyncHealth; scratch occupancy can mark DEGRADED — not “outside barrier by being read-only” |
| `app/sync/dispatcher.server.ts` | `recoverStrandedEnqueuedJobs` | CP + Redis presence; needs lifecycle shared |

Catalog apply writers (`app/lib/catalog-facts/apply/writers.ts`) remain participating fact writers (PR45 lumped them less explicitly than order-facts).

### 6.3 Missing boundaries (honest)

- No generation-fenced Redis remove on W (PREP-C-11).
- No privacy coordinator loop, `PrivacyRequest` tables, or `test:privacy` script (PREP-C-21).
- No durable export object store (PREP-C-12).
- `computeSyncHealth` was inventoried as read-only in PR45; that proof is **false** on W (PREP-C-04).
- Control-plane tables still have **no** RLS (plan G5 LIMIT); raw CP INSERT without a gate still succeeds until wrappers exist.
- Formal PR6 closeout on main is **not** this packet: PR47 `fde01dc5…` is unmerged (PREP-C-23). Plan §10 item 3 remains a **later** prerequisite.
- Expired dispatch-lease recovery SQL has **no** `processingEnabled` predicate (PREP-C-20).
- Catalog `applyCanonicalFacts` has no explicit `requireProcessingEnabled` pre-lock (PREP-C-15).

Helper C inventory artifact: **86** W rows vs PR45’s 26 claimed / 27 INSERT rows. Classifications: unchanged 32, misnamed 4 (`applyOrderFactWriters`, `applyReceipts`, `getShopHealth`, `computeSyncHealth` vs phantom `getShopHealth`), behavior_change 4, v_omitted 22, **w_only 23**, missing 1 (`generation_fenced_queue_remove`). Additional W-only symbols beyond §6.2: `processOrderFactsWebhookJob`, `persistShopTimezoneCurrencyValues`, `createOrderFactsSyncRun` / cursor / DataIssue / coverage health, `applyCanonicalAndLegacy`, `persistIncompleteWithoutReceipt`, `applyNominatedOrderGid`, `orders.delete` route. V-omitted but present on both V and W: `applyCanonicalFacts`, `applyWithApplicationReceipt`, `deleteSessionsForShop`, dispatcher `addJobToQueue` / `ackEnqueued` / `recoverExpiredDispatchLeases`.

Bounded C tests: only the scratch-quota / source-stage name-filter runs in §5.3. Helper C did not attach to PostgreSQL (correct). No full W corpus.

## 7. Counterexamples (do not treat as green quiescence)

1. BullMQ `remove()` while a file publication exists (PREP-B-01).
2. Redis TTL still > 0 (PREP-B-02).
3. Stale-generation job still in Redis (PREP-B-03).
4. `processingEnabled` re-check on dispatcher after claim — still writes `JobDispatch` / `DurableJob` (W ~1373–1390).
5. `computeSyncHealth` “health read” upsert (PREP-C-04).
6. IEEE-754 owner id stringification (PREP-A-02) looking like a stable actor key.
7. Zero RLS-visible rows ≠ absence (plan; not re-probed here).

## 8. Unexecuted limits

- Live Shopify / Partners / merchant data / store Admin GraphQL.
- Live object storage.
- Power-loss / `fsync` disk crash (D process-loss child tests exist on W; **not** re-run).
- Isolated PostgreSQL 16 transcription of PR45 appendices (already executed on PR45; no new evidentiary reason to repeat the 59-proof model).
- Full `npm test` / Heavy CI corpus / million-line envelopes.
- Enabling `useOnlineTokens` in `shopify.server.ts`.
- Independent Claude approval (this packet is Cursor evidence only).

## 9. Teardown

| Resource | Action | Evidence |
|---|---|---|
| Coordinator Redis 16380 pid 4966 | `SIGTERM` then confirm dead | `redis-cli -p 16380` connection refused; probe rec `redis pid terminated` pass |
| Coordinator scratch `/tmp/pr7-coordinator/scratch` | disposable; not `/workspace` | left in `/tmp` only |
| Helper B Redis 16379 pid 4169 | `kill -TERM 4169` after helper artifacts copied (exact PID; not `pkill`) | `/proc/4169` gone; `redis-cli -h 127.0.0.1 -p 16379 ping` → connection refused; 6379 still refused |
| Helper worktrees `/tmp/pr7-helpers/{A,B,C}` | left detached at W; **no** git write | `git rev-parse HEAD` = `ee193f3…` |
| `/workspace` during probes | no runtime/lockfile edits | `git status --porcelain` empty until these two docs |
| Application `shopify.server.ts` | unchanged | hash `21b881203e64f30811708fd87cb935eff371a5f79b4c114c7b516c5c4f429b58` |

Default `redis-server` service remains stopped. Probe scripts remain under `/tmp` only (not repository runtime).

## 10. Docs CI / classification

Local (pre-push, this working tree; GitHub exact-head filled after PR):

```text
$ bash .github/scripts/classify-ci-change-set.sh --paths \
    stocky-plus/docs/phases/phase-1/PR7_MERGED_MAIN_ENTRY_EVIDENCE.md \
    stocky-plus/docs/phases/phase-1/PR7_IMPLEMENTATION_HANDOFF.md
changed_path_count=2
changed_path [docs] stocky-plus/docs/phases/phase-1/PR7_MERGED_MAIN_ENTRY_EVIDENCE.md
changed_path [docs] stocky-plus/docs/phases/phase-1/PR7_IMPLEMENTATION_HANDOFF.md
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false

$ bash .github/scripts/classify-ci-change-set.sh --eval-gate success skipped false true
gate_result=SUCCESS docs_only_classify_succeeded
```

Negative control (not this PR’s tree): the same two docs plus `stocky-plus/app/shopify.server.ts` classifies `docs_only=false` / `full_ci=true`.

Required GitHub exact-head `pull_request` evidence (after push): Classify **SUCCESS** / Heavy **SKIPPED** / CI Gate **SUCCESS**. No `workflow_dispatch`. Two-path docs-only scope only:

1. `stocky-plus/docs/phases/phase-1/PR7_MERGED_MAIN_ENTRY_EVIDENCE.md`
2. `stocky-plus/docs/phases/phase-1/PR7_IMPLEMENTATION_HANDOFF.md`

## 11. Later integration prerequisites (do not wait)

1. Independent Claude review + ChatGPT acceptance of PR45 (still OPEN/DRAFT at `a292bc8…`).
2. Owner merge of accepted PR45 **onto current main** (must re-base/re-integrate because PR45 is V-based and main is W).
3. PR47 documentary closeout disposition / merge if ChatGPT still requires formal PR6 closure on main (plan §10.3).
4. Exact-head full CI on the implementation base.
5. Explicit subsequent ChatGPT **runtime** authority sentence. Named single writer. Exclusive files in the companion handoff.

Until those exist, PR7 application runtime remains **NOT AUTHORIZED**.
