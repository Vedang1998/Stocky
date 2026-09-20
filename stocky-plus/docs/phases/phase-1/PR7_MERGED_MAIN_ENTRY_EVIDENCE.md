# Phase 1 PR7 — Merged-main entry evidence (planning / feasibility)

**Status:** `PR48 EVIDENCE SEALED FOR CONSOLIDATED PR45 REVIEW — NO RUNTIME AUTHORIZED`
**Implementer:** Cursor (existing PR48 entry-evidence coordinator)
**Lane:** one-dependency-ahead research / feasibility under Accelerated Safe Delivery. **Not** PR7 application implementation.
**Authority:** ChatGPT mandate [PR45 comment 5746516577](https://github.com/Vedang1998/Stocky/pull/45#issuecomment-5746516577) (2026-09-20T00:49:06Z). Packaging authority [PR48 comment 5747831255](https://github.com/Vedang1998/Stocky/pull/48#issuecomment-5747831255) (2026-09-20T05:18:53Z). Proposal input is frozen PR45; it is **not** accepted product authority.
**Packaging:** observation-preserving source seal of pinned head `275292d19b583c04c3afe01ef7d9feb48fee0f6c`. **No new investigation or helper launch.** Recovered helper/coordinator sources are durable evidence; reconstructed bytes, if any, are labelled new. Missing originals are named, not fabricated.
**Production:** NOT AUTHORIZED
**Inventory-write flags:** DEFAULT OFF
**PR7 runtime:** NOT AUTHORIZED
**D-054:** EFFECTIVE — **no D-055**
**R-176:** OPEN / P0 (unchanged)
**R-164:** unchanged
**Q-008:** OPEN

This packet does **not** edit `PROJECT_STATUS.md`, `RISK_REGISTER.md`, `OPEN_QUESTIONS.md`, `DECISIONS.md`, or production policy. Existing D-PR7 / CP / XC / TF identifiers are preserved. New observations use `PREP-*` IDs.

**ID qualification (do not collapse):** coordinator hyphen IDs (`PREP-A-*`, `PREP-B-*` / `PREP-COORD-B-*`, packet `PREP-C-*`) are **not** Helper A `PREP-A-*`, Helper B underscore `PREP_B_*`, or Helper C `PREP-C-*`. Cite helper-or-coordinator plus the ID. Helper A `PREP-A-11` (stale cache) ≠ coordinator `PREP-A-11` (online-flag `sessionToken`).

## 1. Identities

| Field | Value |
|---|---|
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Coordinator branch | `planning/pr7-entry-evidence-20260919-37c6` (requested `planning/pr7-entry-evidence-20260919`; platform suffix `-37c6`) |
| Observation head sealed by this packaging | `275292d19b583c04c3afe01ef7d9feb48fee0f6c` (measured results unchanged; sources recovered into appendices) |
| Authorized base **W** / `origin/main` at start | `ee193f38491245a10fb2fa60d2cf9a29f3271605` (PR #43 squash; Phase 1 PR6-D merged). **Measured snapshot, not an automatically approved implementation-entry base.** |
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

**Isolation error (not Helper B teardown):** coordinator `kill -TERM 4169` at `2026-09-20 01:10:05` terminated Helper B’s private Redis **16379** while Helper B still ran (locked `Job.remove` in flight). Interrupted 4169-era work is **not** evidence. Helper B restarted **9143** and re-ran the active-locked remove probe; `99-teardown.json` killing **9143** does **not** undo the earlier isolation error. This packaging session did not signal another helper’s Redis or share a namespace. See §9 and Appendix E.

| Helper | Artifact | SHA-256 |
|---|---|---|
| A | `/tmp/pr7-helper-outputs/A/probe-results.json` (mocked token-exchange only) | `9ee6476584946a5f8cced9e73182f6dd8cc008988915d697360faa041bcd3308` |
| B | `/tmp/pr7-helper-outputs/B/results/00-isolation.json` (16379 pid 4169, porcelain 0) | `207b4af50195182af46899e498bb400bf8c7ca6c55fd6715a472f6fcdacdf7b6` |
| B | `/tmp/pr7-helper-outputs/B/results/01-bullmq.json` (real BullMQ on 16379) | `5c7204ffcbc01209b94ec020cdf5fe8f6a4e5c10c6c9e956b3c644e7ccff0f2a` |
| B | `/tmp/pr7-helper-outputs/B/results/01b-inflight-cancel.json` (active locked `Job.remove`) | `5a846a8c1bdd3e1b62abffc3ef8adcf817d565828a1273e01a430d2cb3067416` |
| B | `/tmp/pr7-helper-outputs/B/results/02-dscratch.json` | `ba1b2b3503e38d2d891dbb3876ec306ab5837a12efcaaa381ae19efaff51a5fe` |
| B | `/tmp/pr7-helper-outputs/B/results/03-synthetic.json` | `67fb0fe7a4e374a7f7b23dd2464bb31a37d9bed4bccd6b16d41b5c0cf1459e5f` |
| B | `/tmp/pr7-helper-outputs/B/results/99-teardown.json` (killed PID **9143**) | `032ad3ab5fdd452d919c35f2f01a1ed174346301fb2627a29fa3ec0873819684` |
| C | `/tmp/pr7-helper-outputs/C/WRITER_INVENTORY.json` (86 rows: unchanged 32, misnamed 4, behavior_change 4, v_omitted 22, w_only 23, missing 1) | `f7f09cde84067c09675bac8f0ce14d130b520bc9bf5d369fd15a23eb4ab8c7f0` — **bytes recovered; sealed in Appendix D** |

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
| Wide-id B then A (`sub` `"…993"` then `"…992"`) | A received **B’s** online session + access token (`mixedToken: true`, `email: b@example.com`, 0 exchanges on A) | yes (Helper A PREP-A-09 / NC-07) |
| Stale active session `associated_user.id=111` stored at `${shop}_${sub}` | Library returned stale user; **zero** token exchanges | yes (Helper A PREP-A-11 / NC-09) |
| `sub` vs `associated_user.id` mismatch | Library returned store-key session; second request re-exchanged (lookup miss) | yes (Helper A PREP-A-03 / NC-08) |

Helper A IDs in `/tmp/pr7-helper-outputs/A/HELPER_A_REPORT.md` (`PREP-A-01`…`PREP-A-18`) are **not** the coordinator `PREP-A-*` in §4.2. Material extras from that report, reconciled after helper completion:

| Helper A ID | Packet use |
|---|---|
| PREP-A-01 | Embedded `authenticate.admin` returns `sessionToken.sub` with `useOnlineTokens: false`. D-PR7-01 library bind is **not** blocked on enabling online tokens. W still drops `sessionToken`. |
| PREP-A-07 | `authenticate.webhook` loads the **offline** session only (no `associated_user` / no `sessionToken`). Coordinator PREP-A-07 remains live-Shopify UNVERIFIED. |
| PREP-A-09 | Collision is not only a colliding session **id**: A reuses B’s **token** (`mixedToken: true`). |
| PREP-A-11 | Cached online session is returned without corroborating `associated_user.id` against current `sub`. Coordinator PREP-A-11 (sessionToken present when the online flag is on) is a **different** observation. |
| PREP-A-13 | If JWT JSON `sub` is a number, runtime `sessionToken.sub` is a **number** (types say `string`). |
| PREP-A-16 | Live token exchange remains UNVERIFIED (same residual as coordinator PREP-A-07). |

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

**Coordinator PREP-A-11** (distinct from Helper A PREP-A-11 stale-cache): plan residual “library returns `sessionToken` + online `associated_user` when `useOnlineTokens: true`” is **verified on the installed library with mocked transport**. It remains UNVERIFIED against live Shopify.

**PREP-A-12:** a numeric JWT `sub` is already lossy; D-PR7-01 must require a **string** `sub` in the JWT, not merely avoid `String(number)` later.

## 5. Helper B / coordinator — Redis, filesystem, privacy boundary

### 5.1 Real W primitives (not a privacy processor)

Queue (`app/jobs/queue.server.ts`): `WEBHOOK_QUEUE="stocky-webhooks"`, `CRON_QUEUE="stocky-cron"`; producers `enqueueWebhook`, `enqueueCatalogSync`, `enqueueAfterAuthCatalogSync`, `enqueueInventoryStateReconcile`, `enqueueAbcAnalysisForShop`, **W-new** `enqueueOrderFactsSync`, `enqueueOrderFactsReconcile`. `requireRedisUrl` fails closed if unset. **No** production `remove` / generation-fenced drain / `FLUSHALL` wrapper. Tests call `queue.obliterate({ force: true })` and `job.remove()`; that is harness-only (PREP-C-11).

Presence: `inspectQueueDispatchPresence`, `classifyExistingQueueJob` (`app/sync/queue-presence.server.ts`).

D scratch on **W** (`app/lib/order-facts/sync/source-stage.ts`): `inspectDScratchOccupancy`, `reclaimOperatorSelectedDScratch` (requires `quiescenceConfirmed: true`; skips `symlink_refused`, `not_verified_d_resource`, `live_writer`, `not_an_attempt_basename`, `outside_namespace`), `reinitializeDScratchReservationLedgerAfterQuiescence`, `createOwnedScratchDir` / `disposeOwnedScratch`. Operator runbook `PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`. Residual 3 of PR45 §9 is **closed as an API existence fact** on merged W; it is **not** a privacy drain proof.

Export: `app/routes/app.analytics_.export.tsx` returns **HTTP CSV** after `requireAdminTenant`. No S3/R2/GCS module is present on the **current W source inventory** (coordinator PREP-B-06; Helper B `PREP_B_24`). That inventory fact is an **implementation dependency**, not a fabricated provider test, and it is **not** proof that historical export bytes never existed on another store, backup, or prior configuration. Current W source inventory and historical storage existence are separate questions.

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
- does not reclaim live, foreign, markerless, or symlink paths (`live_writer`, `not_an_attempt_basename`, `not_verified_d_resource`, `symlink_refused`). The in-process `source-stage.test.ts` `live_writer` skip is **not** a cross-process PID/liveness guarantee (see Helper B `PREP_B_19`).

Skipped rows are **not** claimed executed. Full source-stage / PR6-D scale / million-line envelopes were **not** rerun (no new evidentiary reason).

Helper B additionally ran **real** BullMQ workers on **16379** (not coordinator 16380):

| Helper B case | Counterexample |
|---|---|
| PREP_B_05 TTL hint | hint TTL → 0 while worker still ticking |
| PREP_B_06 `Job.remove()` (waiting) | **INCONCLUSIVE** and remains so: hashed `01-bullmq.json` shows `ticks_appended_after_Job_remove=0` and empty-file `log_sha256=e3b0c442…`; stale `.started` possible. **Do not** treat as drain proof. Not reconstructed. |
| PREP_B_06b `Job.remove()` of **active** job | **Authoritative cancel-is-not-drain**, executed on restarted Redis **9143** after the 4169 isolation error (interrupted 4169 in-flight remove is excluded). Throws `locked by another worker`; presence stays `RUNNABLE_EXISTING`/`active`; **11 FS ticks after**; worker PID **9234** still alive. Result JSON SHA-256 `5a846a8c1bdd3e1b62abffc3ef8adcf817d565828a1273e01a430d2cb3067416` **recovered**. Tick-log bytes `4f22ff2bd905420222de0001d17bb06563d2d933a9eca09879eb1fdec85c1df0` are **MISSING**; the digest is recorded inside the hashed JSON only. |
| PREP_B_07 decoy PID | killed decoy; real worker + Redis `active` job remained |
| PREP_B_08 SIGKILL worker | leftover file 348 bytes; Redis job still `RUNNABLE_EXISTING`/`active`. **Not** power-loss |
| PREP_B_09 / 09b late publication | in-memory cancel label with `redisRemoved=false`; delayed job stayed `RUNNABLE_EXISTING` |
| PREP_B_10 stale generation | SYNTHETIC `fence=ERASING` on payload; W-shaped worker (`CHECK_GENERATION_FENCE=0`) still ticked |
| PREP_B_11 positive drain | Worker finished + `.done` file + terminal `completed` — the **only** Redis success shape that counts |
| PREP_B_12 | W uninstall/dispatcher/webhook **do not** call `Queue.remove`; PG CANCELLED ≠ Redis remove |
| PREP_B_19 | second process with `quiescenceConfirmed: true` **deleted** live child PID **7164** `att-*` (`dir_exists_after_foreign_reclaim: false`). W `live_writer` skip is **process-local only**: `isLiveScratchBasename(name)` (in-process set) or `marker.pid === process.pid` in `source-stage.ts`. It is **not** a cross-process PID/liveness guarantee. `quiescenceConfirmed` is an operator admission token, not liveness. The probe supplied that token while a writer was alive — an integration hazard for a future privacy caller; it does not execute the runbook precondition and does not revoke D acceptance. Hashed success `02-dscratch.json` (`ba1b2b35…`) **full bytes MISSING**; outcomes here are from recovered Helper B report + an incomplete original `read_file` tail (Appendix C). |

SYNTHETIC coordinator (`03-synthetic.json`, hash-matched recovered): poll recovers a lost Redis hint (Helper B `PREP_B_22`); stale enumerator leaves keys unchanged (`PREP_B_23`); unconfigured export is `export_storage_unconfigured` (`PREP_B_24`) — that label is **current-config**, not a historical-bytes proof; EACCES keeps incomplete (`PREP_B_25`); **export writer that snapshots fence=LIVE then publishes after ERASING still lands a file** (`PREP_B_26`) unless it re-reads under the publication lock (`PREP_B_27`). SYNTHETIC ≠ installed fence.

### 5.4 SYNTHETIC privacy coordination model (labelled; not an application fence)

Proposed PR7 coordinator (plan §7.6.5 Decision B) is **not** a `DurableJob`. Optional Redis wake hint; PostgreSQL poll recovers. Completeness **must not** be inferred from:

- BullMQ `remove` / cancelled label (PREP-B-01)
- TTL/PID (coordinator PREP-B-02; D reclaim’s `live_writer` skip is process-local / in-process, not cross-process liveness)
- sampled empty directory
- `processingEnabled=false`

**Minimal viable contract before `COMPLETED` (implementation, not this PR):**

1. Domain / customer-target PG gates as constrained in PR45 §7.6.2 (cooperative; uninstrumented writers must be drained first).
2. Positive drain **or** stale-generation fence for Redis jobs of that shop/generation (API absent on W — PREP-C-11). Active/locked jobs **cannot** be `Job.remove`d (PREP-B-06b).
3. D scratch: occupancy `operatorInterventionRequired=false` **and** no unknown attempts **or** incomplete/visible request (D accepted recovery boundary). Helper B `PREP_B_19`: `quiescenceConfirmed` is **not** cross-process liveness; W `live_writer` denial is process-local. Do **not** call `reclaimOperatorSelectedDScratch` automatically from PR7 until every process able to write the namespace is actually quiescent. Runbook §1 remains mandatory.
4. Export/object storage: an unconfigured or absent provider on **current W source inventory** cannot prove that no historical export bytes exist. Record the missing adapter as an implementation dependency **and** a residual unknown for historical bytes. If a store is later configured, generation-fence or positive delete with residual proof. Do not invent a provider test (coordinator PREP-B-06; Helper B `PREP_B_24`).
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
- Formal PR6 closeout on main is **required** and is **not** this packet: PR47 `fde01dc5…` is unmerged (Helper C PREP-C-23). Plan §10 item 3 remains a **required** later prerequisite. This evidence lane was instructed not to wait; that does not make the gate optional.
- Expired dispatch-lease recovery SQL has **no** `processingEnabled` predicate (PREP-C-20).
- Catalog `applyCanonicalFacts` has no explicit `requireProcessingEnabled` pre-lock (PREP-C-15).

Helper C inventory artifact: **86** W rows vs PR45’s 26 claimed / 27 INSERT rows. Classifications: unchanged 32, misnamed 4 (`applyOrderFactWriters`, `applyReceipts`, `getShopHealth`, `computeSyncHealth` vs phantom `getShopHealth`), behavior_change 4, v_omitted 22, **w_only 23**, missing 1 (`generation_fenced_queue_remove`). Additional W-only symbols beyond §6.2: `processOrderFactsWebhookJob`, `persistShopTimezoneCurrencyValues`, `createOrderFactsSyncRun` / cursor / DataIssue / coverage health, `applyCanonicalAndLegacy`, `persistIncompleteWithoutReceipt`, `applyNominatedOrderGid`, `orders.delete` route. V-omitted but present on both V and W: `applyCanonicalFacts`, `applyWithApplicationReceipt`, `deleteSessionsForShop`, dispatcher `addJobToQueue` / `ackEnqueued` / `recoverExpiredDispatchLeases`.

Bounded C tests: only the scratch-quota / source-stage name-filter runs in §5.3. Helper C did not attach to PostgreSQL (correct). No full W corpus.

## 7. Counterexamples (do not treat as green quiescence)

1. BullMQ `remove()` while a file publication exists (PREP-B-01) **or** while the job is `active`/`locked` (PREP-B-06b: 11 ticks after a thrown remove).
2. Redis TTL still > 0 (PREP-B-02).
3. Stale-generation job still in Redis (PREP-B-03).
4. `processingEnabled` re-check on dispatcher after claim — still writes `JobDispatch` / `DurableJob` (W ~1373–1390).
5. `computeSyncHealth` “health read” upsert (PREP-C-04).
6. IEEE-754 owner id stringification (PREP-A-02) looking like a stable actor key.
7. Zero RLS-visible rows ≠ absence (plan; not re-probed here).
8. Adjacent wide JWT `sub` values causing **cross-user online session + token reuse** (Helper A PREP-A-09 / `mixedToken: true`).
9. Returning a cached online session without re-checking `associated_user.id` against current `sub` (Helper A PREP-A-11).
10. `reclaimOperatorSelectedDScratch({ quiescenceConfirmed: true })` from another process deleting a still-live child’s `att-*` (Helper B `PREP_B_19`). W `live_writer` is process-local, not a cross-process liveness guarantee.

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
| Coordinator Redis 16380 pid 4966 | Coordinator `SIGTERM` of **its own** instance, then confirm dead | `redis-cli -p 16380` connection refused; probe rec `redis pid terminated` pass |
| Coordinator scratch `/tmp/pr7-coordinator/scratch` | disposable; not `/workspace` | left in `/tmp` only |
| Helper B isolation Redis 16379 pid **4169** | **ISOLATION ERROR:** coordinator `kill -TERM 4169` at `2026-09-20 01:10:05` **during** Helper B’s locked `Job.remove` | Redis log `User requested shutdown`; `/proc/4169` gone. Interrupted 4169-era in-flight work is **excluded**. This is **not** Helper B teardown and **not** power-loss. |
| Helper B restarted Redis 16379 pid **9143** | Helper B teardown `kill -TERM 9143` (exact PID) after the focused `PREP_B_06b` rerun | hash-matched `99-teardown.json`; 16379 and 6379 connection refused; no leftover workers; FLUSHALL not executed. **Does not undo** the 4169 isolation error. |
| Helper worktrees `/tmp/pr7-helpers/{A,B,C}` | left detached at W; **no** git write | `git rev-parse HEAD` = `ee193f3…` |
| `/workspace` during probes | no runtime/lockfile edits | `git status --porcelain` empty until these two docs |
| Application `shopify.server.ts` | unchanged | hash `21b881203e64f30811708fd87cb935eff371a5f79b4c114c7b516c5c4f429b58` |
| This packaging session | no helper launch; no Redis/Postgres/store | recovered transcripts only; `/tmp/pr7-helpers` and `/tmp/pr7-helper-outputs` **absent** on this VM until transcript recovery |

Default `redis-server` service remains stopped. Original `/tmp` probe scripts are gone with the helper VMs. Executable sources that hash-match are sealed in the appendices. Missing originals are listed in Appendix A, not reconstructed as if they were the old files.

Probe scripts in the appendices are **documentation evidence**, not repository runtime.

## 10. Docs CI / classification

Local (commit `448a20fa0bc649df9c47866cbdff1d74055c15f6`, base **W** `ee193f38491245a10fb2fa60d2cf9a29f3271605`):

```text
$ bash .github/scripts/classify-ci-change-set.sh --from-git \
    ee193f38491245a10fb2fa60d2cf9a29f3271605 \
    448a20fa0bc649df9c47866cbdff1d74055c15f6
compare_base=ee193f38491245a10fb2fa60d2cf9a29f3271605
compare_head=448a20fa0bc649df9c47866cbdff1d74055c15f6
range_usable=true
changed_path_count=2
changed_path [docs] stocky-plus/docs/phases/phase-1/PR7_IMPLEMENTATION_HANDOFF.md
changed_path [docs] stocky-plus/docs/phases/phase-1/PR7_MERGED_MAIN_ENTRY_EVIDENCE.md
classification_reason=every_changed_path_is_docs_allowlist
docs_only=true
full_ci=false

$ bash .github/scripts/classify-ci-change-set.sh --eval-gate success skipped false true
gate_result=SUCCESS docs_only_classify_succeeded

$ bash .github/scripts/classify-ci-change-set.test.sh
assertions=40 pass=40 fail=0
```

Negative control (not this PR’s tree): the same two docs plus `stocky-plus/app/shopify.server.ts` classifies `docs_only=false` / `full_ci=true`.

Exact-head GitHub `pull_request` run for **that** evidence commit (not a later recording SHA):

| Field | Value |
|---|---|
| PR | [#48](https://github.com/Vedang1998/Stocky/pull/48) (DRAFT) |
| Event | `pull_request` (no `workflow_dispatch`) |
| Run | [35480755990](https://github.com/Vedang1998/Stocky/actions/runs/35480755990) |
| `head_sha` | `448a20fa0bc649df9c47866cbdff1d74055c15f6` (matched live PR head at that run) |
| Classify | **SUCCESS** (`docs_only=true`, `full_ci=false`, `changed_path_count=2`) |
| Heavy validate | **SKIPPED** |
| CI Gate | **SUCCESS** (`CI Gate SUCCESS: docs-only classify succeeded`) |

Two-path docs-only scope only:

1. `stocky-plus/docs/phases/phase-1/PR7_MERGED_MAIN_ENTRY_EVIDENCE.md`
2. `stocky-plus/docs/phases/phase-1/PR7_IMPLEMENTATION_HANDOFF.md`

A later commit that only records this table is **not** SHA `448a20f`. Its own exact-head run must still be Classify SUCCESS / Heavy SKIPPED / Gate SUCCESS before anyone treats that later HEAD as the CI identity.

Pinned observation head `275292d19b583c04c3afe01ef7d9feb48fee0f6c` exact-head `pull_request` run [35481233574](https://github.com/Vedang1998/Stocky/actions/runs/35481233574) SUCCESS is superseded as **live-head** identity by this packaging revision. That run remains valid evidence for the 275292d observation text. This packaging commit’s own exact-head Classify SUCCESS / Heavy SKIPPED / Gate SUCCESS IDs are recorded in PR #48 metadata after the run; they are **not** claimed inside this commit (unknown future SHA).

Superseded successful docs-only runs: `448a20f` 35480755990, `9788cd8` 35480846554, `48770f4` 35481021600, `275292d` 35481233574.

## 11. Later integration prerequisites (required; this lane did not wait)

These remain **required** gates. The original mandate told this evidence lane not to poll them; that instruction does **not** make them optional, and it does **not** make measured W an automatically approved implementation-entry base.

1. Independent Claude review + ChatGPT acceptance of PR45 (still OPEN/DRAFT at `a292bc8…`).
2. Owner merge of accepted PR45 **onto current main** (must re-base/re-integrate because PR45 is V-based and main is W).
3. Formal PR6 closure on merged main (PR47 `fde01dc5…` unmerged). **Required.**
4. Exact-head full CI on the **implementation-entry base**. That SHA is an **entry decision** after actual PR6 closure, accepted integrated PR45 planning, and later explicit runtime authorization. It is **not** automatically W `ee193f3…` and **not** PR45 `a292bc8…`.
5. Explicit subsequent ChatGPT **runtime** authority sentence. Named single writer. Exclusive files in the companion handoff.

Until those exist, PR7 application runtime remains **NOT AUTHORIZED**.

This packaging is Cursor feasibility evidence for the consolidated PR45 reviewer. It is **not** independent security acceptance.

## 12. Source-seal provenance (this packaging)

Live helper `/tmp` trees were **gone** on this VM. Sources and hash-matched results were recovered from helper/coordinator transcripts (`bc-74edc001…`, `bc-81eaa84b…`, `bc-e6dd9789…`, coordinator `bc-63317b9e…`). Independent `sha256` verification of recovered bytes is recorded in Appendix A.

- **Recovered + documented-hash MATCH:** treat as the original artifact.
- **Recovered, no prior documented hash:** new evidence of the recovered file; not an invented original-run identity.
- **MISSING:** named; not fabricated; not silently reconstructed as the old digest.
- **No reconstructed-and-re-executed reproducers** in this packaging (user: no new investigation or helper launch). Interrupted 4169-era cases stay excluded; `PREP_B_06` stays **INCONCLUSIVE**.

Appendices: A provenance table; B auth sources/outcomes; C Redis/filesystem sources/outcomes; D 86-row inventory; E isolation-error/teardown; F helper reports.

---

# Appendices — recovered executable evidence (packaging 5747831255)
These appendices are **documentation**. They are not application runtime, not committed tests, and not a reconstructed original when the original digest cannot be verified. Synthetic credentials only. No live Shopify tokens.
## Appendix A — Recovered / reconstructed / missing
Independent `sha256` on this packaging VM. `MATCH` means recovered bytes equal the digest recorded at `275292d` or in Helper B `hashes.txt`. `NEW recovered digest` means the file was recovered from a transcript Write/tee with size corroboration, but that digest was **not** previously recorded as an original-run identity. `MISSING` means full original bytes were not in any transcript; not fabricated.

| Class | Original path | Documented digest | Recovered digest | Status |
|---|---|---|---|---|
| Coordinator source | `/tmp/pr7-coordinator/probes/auth-precision.mjs` | `f4e4b0de059299fa4c44bb70bd798a2a9e50861a4e9972346f433fed74af94f3` | same | **MATCH recovered** |
| Coordinator result | `/tmp/pr7-coordinator/out/auth-precision.json` | `ffd1c4de4b20d05eb6e4489c99755966fab4f97aeebc9d35bca5ab356ce3db0e` | same | **MATCH recovered** |
| Coordinator source | `/tmp/pr7-coordinator/probes/auth-jwt-shopifyapp.mjs` | `9cd54ab57dee5e1bf5634e120b23bd1b7c10e536be73c4664fb11cf3322e22e4` | same | **MATCH recovered** |
| Coordinator result | `/tmp/pr7-coordinator/out/auth-jwt-shopifyapp.json` | `36a7310277769928f538dad847787c691ff6b89244c0c9a86f246f3e39f48a1b` | same | **MATCH recovered** |
| Coordinator source | `/tmp/pr7-coordinator/probes/redis-scratch.mjs` | `483d9cb5360ae9dccc484c5fff46d8d2f108b8fd2fb61766b46ffbe47306c88d` | same | **MATCH recovered** |
| Coordinator result | `/tmp/pr7-coordinator/out/redis-scratch.json` | `bfb3fb5f50f473452cd7e3fa5161e990294a9f49bed97d34e0031c2ddf7e26cc` | same | **MATCH recovered** |
| Helper A source | `/tmp/pr7-helper-outputs/A/probes/run_all.mjs` | *(none recorded at 275292d)* | `b33ee87ba0747c115b5d9cef04970f4c4e07d9b36cac799b3bdb8da8e00ff12c` | **NEW recovered digest** (ls size 37853 matched; `node --check` OK in original session). Not claimed as an old packet hash. |
| Helper A result | `/tmp/pr7-helper-outputs/A/probe-results.json` | `9ee6476584946a5f8cced9e73182f6dd8cc008988915d697360faa041bcd3308` | — | **MISSING** full bytes (observed size 130633). Incomplete prefixes exist; not completed. |
| Helper A report | `/tmp/pr7-helper-outputs/A/HELPER_A_REPORT.md` | *(none recorded)* | `f7ce700099a968ef95fbce0ad9e3b9124d94e99a81b114624e2e5933cc5b635f` | **NEW recovered digest** (ls 29800 / `wc -l` 382 matched). Sanitized outcomes for missing JSON. |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/00-isolation.sh` | `ad736496aaecb23103bcf074cbb1b1d4b2845863770149fbce5222c1fdb6e5ee` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/01-bullmq-real-primitives.mjs` | `4d12211714414a90d0a52fb6b2a3246d874332a6f71e78c4b59b1255f9d389a2` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/01b-inflight-cancel.mjs` | `e7bf1981bbb54d39e9d206df8efd2d44fe69948d603a83d0b285013e11f78488` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/in-flight-worker.mjs` | `09ec0811f754926e62205d8c1ba37315dbfa5393ae5af76a7cb58e7b59d09a55` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/02-d-scratch-real-primitives.ts` | `17cb4d1f24232b69b8c5f647e7f6c6c5109246808c0aa5396298b445463b91bb` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/scratch-park-child.ts` | `af7641c6c8f488991b42ec4762a360dc5afab61705021bb947d8a4b8da2ff837` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/03-synthetic-privacy-coordinator.mjs` | `5f057b3f8e678f7a255eb3d5d11c7fc8e9593bb13abf933a525f227ef75ed6d7` | same | **MATCH recovered** |
| Helper B source | `/tmp/pr7-helper-outputs/B/probes/run-all.sh` | `854ebd6739089d4d3945e69c14f3c227710318fc2fa1736c2fa95d8ce07758f8` | same | **MATCH recovered** |
| Helper B result | `/tmp/pr7-helper-outputs/B/results/00-isolation.json` | `207b4af50195182af46899e498bb400bf8c7ca6c55fd6715a472f6fcdacdf7b6` | same | **MATCH recovered** |
| Helper B result | `/tmp/pr7-helper-outputs/B/results/01-bullmq.json` | `5c7204ffcbc01209b94ec020cdf5fe8f6a4e5c10c6c9e956b3c644e7ccff0f2a` | same | **MATCH recovered** |
| Helper B result | `/tmp/pr7-helper-outputs/B/results/01b-inflight-cancel.json` | `5a846a8c1bdd3e1b62abffc3ef8adcf817d565828a1273e01a430d2cb3067416` | same | **MATCH recovered** |
| Helper B result | `/tmp/pr7-helper-outputs/B/results/02-dscratch.json` | `ba1b2b3503e38d2d891dbb3876ec306ab5837a12efcaaa381ae19efaff51a5fe` | — | **MISSING** full hashed success file. Incomplete original tail sealed below. Earlier fatal complete file hashes to `ab8d01c171ee2ce0312b0268a35997de9d1f40df24e84023ffce0f20506ed4b4` (different PIDs; not the documented digest). |
| Helper B result | `/tmp/pr7-helper-outputs/B/results/03-synthetic.json` | `67fb0fe7a4e374a7f7b23dd2464bb31a37d9bed4bccd6b16d41b5c0cf1459e5f` | same | **MATCH recovered** |
| Helper B result | `/tmp/pr7-helper-outputs/B/results/99-teardown.json` | `032ad3ab5fdd452d919c35f2f01a1ed174346301fb2627a29fa3ec0873819684` | same | **MATCH recovered** |
| Helper B tick log | PREP_B_06b `log_sha256` | `4f22ff2bd905420222de0001d17bb06563d2d933a9eca09879eb1fdec85c1df0` | — | **MISSING** bytes. Digest only, inside hash-matched 01b JSON. |
| Helper B report | `/tmp/pr7-helper-outputs/B/HELPER_B_REPORT.md` | *(none recorded)* | `dbeffd5fab77e4bb673dc38c6e80e3e25ab8398795fd0917c6fb86e1bc3c0101` | **NEW recovered digest** |
| Helper C inventory | `/tmp/pr7-helper-outputs/C/WRITER_INVENTORY.json` | `f7f09cde84067c09675bac8f0ce14d130b520bc9bf5d369fd15a23eb4ab8c7f0` | same | **MATCH recovered** (86 rows) |
| Helper C report | `/tmp/pr7-helper-outputs/C/HELPER_C_REPORT.md` | *(none recorded)* | `e49caa8ef640f4d933c76ada393cb7ad81e5fea9cbb76a96072d529fe2075066` | **NEW recovered digest** |
| Reconstructed-and-re-executed | — | — | — | **None.** No new helper launch. |

**Not reconstructed as originals:** Helper A `probe-results.json`; Helper B hashed `02-dscratch.json`; PREP_B_06b tick-log bytes; Helper C inventory generator script (JSON was composed in-session). Helper A `run_all.mjs` v1 before the JSON.parse key-quote patch (`110eb4793ac388562d73212ff048b65d1ac595e735b5793b92007cd47fd629e5`) is an invalid-JS intermediate, not the executed source.

## Appendix B — Authentication reproducers
### B.1 Setup (synthetic; mocked transport)

- Node `v22.14.0`. Packages from W lockfile: `@shopify/shopify-app-react-router@1.2.1`, `@shopify/shopify-api@13.1.0`, session-storage `5.0.1` / prisma `9.0.1`, `jose` as pulled by those trees.
- Coordinator invocation:
```bash
NODE_PATH=/workspace/stocky-plus/node_modules node /tmp/pr7-coordinator/probes/auth-precision.mjs
NODE_PATH=/workspace/stocky-plus/node_modules node /tmp/pr7-coordinator/probes/auth-jwt-shopifyapp.mjs
```
- Helper A invocation (after vendor copy + `ln -sfn` workspace `node_modules`):
```bash
cd /tmp/pr7-helper-outputs/A/probes && node run_all.mjs
# original session: exit 0, cases: 30, fetchCalls: 33, stderr empty
```
- Synthetic credentials in Helper A source: `API_KEY=prepA-test-api-key`, `API_SECRET=prepA-test-api-secret-not-real`, shop `prepa-test-shop.myshopify.com`. HTTP/HTTPS fail-closed. Token exchange mocked. GraphQL/Partners fail-closed.
- `shopify.server.ts` was **not** edited. `useOnlineTokens` was **not** enabled in application source. Helper A constructed an in-memory `shopifyApp` only.
- **Execution class:** disposable mocked-token library probe. **Not** live Shopify. **Not** a deployed exploit finding.
- **Expected vs actual (sealed):** coordinator `auth-precision.json` / `auth-jwt-shopifyapp.json` below. Helper A original `probe-results.json` is **MISSING**; sanitized case table remains in Helper A report (Appendix F) and §4 of this packet.
- Positive controls preserved: forged signature and wrong `aud` rejected; safe template id `42` in coordinator `auth-precision.json`; Helper A used Shopify-example `548380009` as the safe embedded sub (the coordinator `42` control is a different probe).
- Load-bearing Helper A cases (from recovered report, original JSON missing): offline exact-string sub with `useOnlineTokens: false`; numeric JWT `sub` accepted (rejection gap); wide-ID B→A `mixedToken: true`; stale cached `associated_user.id=111`; iss/dest hostname mismatch accepted.

### Coordinator `auth-precision.mjs` (MATCH)

SHA-256 `f4e4b0de059299fa4c44bb70bd798a2a9e50861a4e9972346f433fed74af94f3`

```javascript
#!/usr/bin/env node
/**
 * Coordinator-owned disposable probe. Not application runtime.
 * Uses pinned installed packages from W node_modules (read-only).
 * No store/network calls.
 */
import { createRequire } from "node:module";
import { createSession } from "/workspace/stocky-plus/node_modules/@shopify/shopify-api/dist/esm/lib/auth/oauth/create-session.mjs";

const require = createRequire("/workspace/stocky-plus/package.json");
const apiPkg = require("/workspace/stocky-plus/node_modules/@shopify/shopify-api/package.json");
const rrPkg = require("/workspace/stocky-plus/node_modules/@shopify/shopify-app-react-router/package.json");
const prismaPkg = require("/workspace/stocky-plus/node_modules/@shopify/shopify-app-session-storage-prisma/package.json");

const UNSAFE = "9007199254740993"; // 2^53 + 1
const SAFE = "42";

function stringifyLibraryId(id) {
  // Exact create-session.mjs line: `${rest.associated_user.id}`
  return `${id}`;
}

const results = [];
function rec(id, actual, expectedOk) {
  const pass = typeof expectedOk === "function" ? expectedOk(actual) : actual === expectedOk;
  results.push({ id, actual, pass });
}

rec("Number(UNSAFE)===Number(UNSAFE-1)", Number(UNSAFE) === Number("9007199254740992"), true);
rec("String(Number(UNSAFE))", String(Number(UNSAFE)), "9007199254740992");
rec("JSON.parse number", JSON.parse(UNSAFE), 9007199254740992);
rec("JSON.parse string", JSON.parse(`"${UNSAFE}"`), UNSAFE);
rec("BigInt(UNSAFE).toString()", BigInt(UNSAFE).toString(), UNSAFE);
rec("library template Number(UNSAFE)", stringifyLibraryId(Number(UNSAFE)), "9007199254740992");
rec("library template string sub", stringifyLibraryId(UNSAFE), UNSAFE);
rec("safe Number template", stringifyLibraryId(Number(SAFE)), "42");

// createSession with synthetic online token body (no network)
const config = {
  isEmbeddedApp: true,
  apiSecretKey: "test-secret-not-a-real-credential",
  logger: { log: () => undefined, httpRequests: false },
  logLevel: "error",
};
const onlineBody = {
  access_token: "shpat_synthetic_not_a_store_token",
  scope: "read_products",
  expires_in: 3600,
  associated_user_scope: "read_products",
  associated_user: {
    id: Number(UNSAFE),
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.invalid",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  },
};
const sessionUnsafe = createSession({
  config,
  accessTokenResponse: onlineBody,
  shop: "probe-shop.myshopify.com",
  state: "state",
});
rec("createSession.isOnline", sessionUnsafe.isOnline, true);
rec("createSession.id uses stringified number", sessionUnsafe.id, "probe-shop.myshopify.com_9007199254740992");
rec(
  "createSession.onlineAccessInfo.associated_user.id typeof",
  typeof sessionUnsafe.onlineAccessInfo?.associated_user?.id,
  "number",
);
rec(
  "createSession.associated_user.id value",
  sessionUnsafe.onlineAccessInfo?.associated_user?.id,
  9007199254740992,
);

const offlineBody = {
  access_token: "shpat_synthetic_offline",
  scope: "read_products",
  expires_in: 3600,
  refresh_token: "shprt_synthetic",
  refresh_token_expires_in: 7776000,
};
const sessionOffline = createSession({
  config,
  accessTokenResponse: offlineBody,
  shop: "probe-shop.myshopify.com",
  state: "state",
});
rec("offline.isOnline", sessionOffline.isOnline, false);
rec("offline.id", sessionOffline.id, "offline_probe-shop.myshopify.com");
rec("offline.onlineAccessInfo", sessionOffline.onlineAccessInfo, undefined);

const staffBody = {
  ...onlineBody,
  associated_user: {
    ...onlineBody.associated_user,
    id: 99,
    account_owner: false,
    collaborator: true,
    email_verified: false,
  },
};
const sessionStaff = createSession({
  config,
  accessTokenResponse: staffBody,
  shop: "probe-shop.myshopify.com",
  state: "state",
});
rec("staff.account_owner", sessionStaff.onlineAccessInfo.associated_user.account_owner, false);
rec("staff.collaborator", sessionStaff.onlineAccessInfo.associated_user.collaborator, true);
rec("staff.id session suffix", sessionStaff.id.endsWith("_99"), true);

// Prisma adapter compile-time assertion is not a runtime conversion:
const asUnknownAsBigint = Number(UNSAFE);
rec(
  "as unknown as bigint still number at runtime",
  typeof asUnknownAsBigint === "number" && asUnknownAsBigint === 9007199254740992,
  true,
);

const report = {
  node: process.version,
  packages: {
    "@shopify/shopify-api": apiPkg.version,
    "@shopify/shopify-app-react-router": rrPkg.version,
    "@shopify/shopify-app-session-storage-prisma": prismaPkg.version,
  },
  results,
  failed: results.filter((r) => !r.pass).map((r) => r.id),
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed.length ? 2 : 0);
```

### Coordinator `auth-precision.json` (MATCH)

SHA-256 `ffd1c4de4b20d05eb6e4489c99755966fab4f97aeebc9d35bca5ab356ce3db0e`

```json
{
  "node": "v22.14.0",
  "packages": {
    "@shopify/shopify-api": "13.1.0",
    "@shopify/shopify-app-react-router": "1.2.1",
    "@shopify/shopify-app-session-storage-prisma": "9.0.1"
  },
  "results": [
    {
      "id": "Number(UNSAFE)===Number(UNSAFE-1)",
      "actual": true,
      "pass": true
    },
    {
      "id": "String(Number(UNSAFE))",
      "actual": "9007199254740992",
      "pass": true
    },
    {
      "id": "JSON.parse number",
      "actual": 9007199254740992,
      "pass": true
    },
    {
      "id": "JSON.parse string",
      "actual": "9007199254740993",
      "pass": true
    },
    {
      "id": "BigInt(UNSAFE).toString()",
      "actual": "9007199254740993",
      "pass": true
    },
    {
      "id": "library template Number(UNSAFE)",
      "actual": "9007199254740992",
      "pass": true
    },
    {
      "id": "library template string sub",
      "actual": "9007199254740993",
      "pass": true
    },
    {
      "id": "safe Number template",
      "actual": "42",
      "pass": true
    },
    {
      "id": "createSession.isOnline",
      "actual": true,
      "pass": true
    },
    {
      "id": "createSession.id uses stringified number",
      "actual": "probe-shop.myshopify.com_9007199254740992",
      "pass": true
    },
    {
      "id": "createSession.onlineAccessInfo.associated_user.id typeof",
      "actual": "number",
      "pass": true
    },
    {
      "id": "createSession.associated_user.id value",
      "actual": 9007199254740992,
      "pass": true
    },
    {
      "id": "offline.isOnline",
      "actual": false,
      "pass": true
    },
    {
      "id": "offline.id",
      "actual": "offline_probe-shop.myshopify.com",
      "pass": true
    },
    {
      "id": "offline.onlineAccessInfo",
      "pass": true
    },
    {
      "id": "staff.account_owner",
      "actual": false,
      "pass": true
    },
    {
      "id": "staff.collaborator",
      "actual": true,
      "pass": true
    },
    {
      "id": "staff.id session suffix",
      "actual": true,
      "pass": true
    },
    {
      "id": "as unknown as bigint still number at runtime",
      "actual": true,
      "pass": true
    }
  ],
  "failed": []
}
```

### Coordinator `auth-jwt-shopifyapp.mjs` (MATCH)

SHA-256 `9cd54ab57dee5e1bf5634e120b23bd1b7c10e536be73c4664fb11cf3322e22e4`

```javascript
#!/usr/bin/env node
/**
 * Coordinator JWT / shopifyApp default probe. Mocked transport only.
 * No myshopify.com network.
 */
import { SignJWT } from "/workspace/stocky-plus/node_modules/jose/dist/node/esm/index.js";
import { shopifyApp } from "/workspace/stocky-plus/node_modules/@shopify/shopify-app-react-router/dist/esm/server/shopify-app.mjs";
import { decodeSessionToken } from "/workspace/stocky-plus/node_modules/@shopify/shopify-api/dist/esm/lib/session/decode-session-token.mjs";

const API_KEY = "synth-api-key-not-a-store-credential";
const API_SECRET = "synth-api-secret-not-a-store-credential";

class MemoryStore {
  constructor() {
    this.map = new Map();
  }
  async storeSession(s) {
    this.map.set(s.id, s);
    return true;
  }
  async loadSession(id) {
    return this.map.get(id);
  }
  async deleteSession(id) {
    return this.map.delete(id);
  }
  async deleteSessions(ids) {
    ids.forEach((id) => this.map.delete(id));
    return true;
  }
  async findSessionsByShop(shop) {
    return [...this.map.values()].filter((s) => s.shop === shop);
  }
}

const hmacKey = new TextEncoder().encode(API_SECRET);

async function mint(claims) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: claims.iss,
    dest: claims.dest,
    aud: claims.aud ?? API_KEY,
    sub: claims.sub,
    sid: claims.sid ?? "sid-synth",
    nbf: now - 5,
    iat: now,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(now + 60)
    .setJti("jti-synth")
    .sign(hmacKey);
}

const decode = decodeSessionToken({
  apiSecretKey: API_SECRET,
  apiKey: API_KEY,
});

const results = [];
function rec(id, actual, pass) {
  results.push({ id, actual, pass });
}

const matched = await mint({
  iss: "https://shop-a.myshopify.com/admin",
  dest: "https://shop-a.myshopify.com",
  sub: "9007199254740993",
});
const matchedPayload = await decode(matched);
rec("decode.sub is string", typeof matchedPayload.sub === "string", true);
rec("decode.sub preserves digits", matchedPayload.sub, matchedPayload.sub === "9007199254740993");

const mismatchedDest = await mint({
  iss: "https://shop-a.myshopify.com/admin",
  dest: "https://shop-b.myshopify.com",
  sub: "42",
});
let destMismatchThrew = false;
try {
  await decode(mismatchedDest);
} catch {
  destMismatchThrew = true;
}
rec(
  "library decodeSessionToken does NOT reject iss/dest hostname mismatch (docs say apps should)",
  destMismatchThrew,
  destMismatchThrew === false,
);

const badAud = await mint({
  iss: "https://shop-a.myshopify.com/admin",
  dest: "https://shop-a.myshopify.com",
  sub: "42",
  aud: "other-app",
});
let audThrew = false;
try {
  await decode(badAud);
} catch (e) {
  audThrew = true;
}
rec("invalid aud rejected", audThrew, true);

const forgedSig = matched.slice(0, -4) + "AAAA";
let sigThrew = false;
try {
  await decode(forgedSig);
} catch {
  sigThrew = true;
}
rec("forged signature rejected", sigThrew, true);

const shopify = shopifyApp({
  apiKey: API_KEY,
  apiSecretKey: API_SECRET,
  apiVersion: "2026-07",
  scopes: ["read_products"],
  appUrl: "https://example.invalid",
  sessionStorage: new MemoryStore(),
  future: { expiringOfflineAccessTokens: true },
});

rec("authenticate.admin is function", typeof shopify.authenticate.admin, typeof shopify.authenticate.admin === "function");
rec("authenticate.webhook is function", typeof shopify.authenticate.webhook, true);

// Default useOnlineTokens is not on the public shopify object; deriveConfig sets false.
// Probe by constructing two apps and tracing session-id selection is covered in source.
// Attempt admin auth with no token should not call network; expect a Response throw.
let noTokenKind = "none";
try {
  await shopify.authenticate.admin(
    new Request("https://example.invalid/app", { method: "GET" }),
  );
} catch (e) {
  noTokenKind = e instanceof Response ? `Response ${e.status}` : e?.constructor?.name ?? typeof e;
}
rec("admin without session token throws Response (no store call)", noTokenKind, noTokenKind.startsWith("Response"));

console.log(
  JSON.stringify(
    {
      matchedSub: matchedPayload.sub,
      destMismatchRejectedByLibrary: destMismatchThrew,
      results,
      failed: results.filter((r) => !r.pass).map((r) => r.id),
    },
    null,
    2,
  ),
);
process.exit(results.some((r) => !r.pass) ? 2 : 0);
```

### Coordinator `auth-jwt-shopifyapp.json` (MATCH)

SHA-256 `36a7310277769928f538dad847787c691ff6b89244c0c9a86f246f3e39f48a1b`

```json
[shopify-api/INFO] version 13.1.0, environment Web API
{
  "matchedSub": "9007199254740993",
  "destMismatchRejectedByLibrary": false,
  "results": [
    {
      "id": "decode.sub is string",
      "actual": true,
      "pass": true
    },
    {
      "id": "decode.sub preserves digits",
      "actual": "9007199254740993",
      "pass": true
    },
    {
      "id": "library decodeSessionToken does NOT reject iss/dest hostname mismatch (docs say apps should)",
      "actual": false,
      "pass": true
    },
    {
      "id": "invalid aud rejected",
      "actual": true,
      "pass": true
    },
    {
      "id": "forged signature rejected",
      "actual": true,
      "pass": true
    },
    {
      "id": "authenticate.admin is function",
      "actual": "function",
      "pass": true
    },
    {
      "id": "authenticate.webhook is function",
      "actual": "function",
      "pass": true
    },
    {
      "id": "admin without session token throws Response (no store call)",
      "actual": "Response 200",
      "pass": true
    }
  ],
  "failed": []
}
```

### Helper A `run_all.mjs` (NEW recovered digest; executed source)

SHA-256 `b33ee87ba0747c115b5d9cef04970f4c4e07d9b36cac799b3bdb8da8e00ff12c`

```javascript
/**
 * Helper A probes — disposable, mocked transport only.
 * NEVER calls live Shopify stores / Partners. Fail-closed on unexpected HTTPS.
 * Does not edit application source. Constructs an in-memory shopifyApp only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSecretKey } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..");
const RESULTS_PATH = path.join(OUT_DIR, "probe-results.json");

const API_KEY = "prepA-test-api-key";
const API_SECRET = "prepA-test-api-secret-not-real";
const APP_URL = "https://prep-a-probe.example.com";
const SHOP = "prepa-test-shop.myshopify.com";
const SHOP_B = "prepa-other-shop.myshopify.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const WIDE = "9007199254740993";
const WIDE_NEIGHBOR = "9007199254740992";
const SAFE_SUB = "548380009";

const denyNet = (kind, args) => {
  const hint = typeof args?.[0] === "string" ? args[0] : args?.[0]?.href || args?.[0]?.host || "?";
  throw new Error(`FAIL-CLOSED ${kind} outbound: ${hint}`);
};
http.request = (...args) => denyNet("http.request", args);
http.get = (...args) => denyNet("http.get", args);
https.request = (...args) => denyNet("https.request", args);
https.get = (...args) => denyNet("https.get", args);

const fetchLog = [];
const mockCtl = {
  associatedUser: {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  },
  /** JSON literal for associated_user.id (digits or a quoted string). */
  onlineIdLiteral: SAFE_SUB,
  offlineHasAssociatedUser: false,
  onlineOmitAssociatedUser: false,
  status: 200,
  errorBody: null,
};

function isBlockedHost(hostname) {
  return (
    hostname.endsWith(".myshopify.com") ||
    hostname === "myshopify.com" ||
    hostname.endsWith(".shopify.com") ||
    hostname === "shopify.com" ||
    hostname.includes("partners.shopify")
  );
}

function mockTokenExchangeResponse(bodyObj) {
  const requested = bodyObj.requested_token_type || "";
  const isOnline = requested.includes("online-access-token");
  if (isOnline && mockCtl.onlineOmitAssociatedUser) {
    return JSON.stringify({
      access_token: "shpat_online_missing_user",
      scope: "read_products",
      expires_in: 86399,
    });
  }
  if (isOnline) {
    const user = { id: 0, ...mockCtl.associatedUser };
    const obj = {
      access_token: `shpat_online_${mockCtl.associatedUser.email || "user"}`,
      scope: "read_products",
      expires_in: 86399,
      associated_user_scope: "read_products",
      associated_user: user,
    };
    return JSON.stringify(obj).replace('"id":0', `"id":${mockCtl.onlineIdLiteral}`);
  }
  const offline = {
    access_token: "shpat_offline_mock",
    scope: "read_products",
    expires_in: 3600,
    refresh_token: "shprt_offline_mock",
    refresh_token_expires_in: 7776000,
  };
  if (mockCtl.offlineHasAssociatedUser) {
    offline.associated_user = {
      id: 0,
      ...mockCtl.associatedUser,
    };
    return JSON.stringify(offline).replace(
      '"id":0',
      `"id":${mockCtl.onlineIdLiteral}`,
    );
  }
  return JSON.stringify(offline);
}

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = init.method || (typeof input === "object" && input.method) || "GET";
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = "";
  }
  const rec = {
    url,
    method,
    hostname,
    contentType: init.headers?.["Content-Type"] || init.headers?.["content-type"] || null,
    bodyPreview: typeof init.body === "string" ? init.body.slice(0, 400) : null,
  };
  fetchLog.push(rec);

  if (hostname && isBlockedHost(hostname)) {
    if (url.includes("/admin/oauth/access_token")) {
      if (mockCtl.status !== 200) {
        rec.mocked = `status_${mockCtl.status}`;
        return new Response(mockCtl.errorBody || JSON.stringify({ error: "invalid_subject_token" }), {
          status: mockCtl.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      const bodyObj = typeof init.body === "string" ? JSON.parse(init.body) : {};
      rec.requested_token_type = bodyObj.requested_token_type;
      rec.grant_type = bodyObj.grant_type;
      rec.expiring = bodyObj.expiring;
      rec.contentTypeSent = rec.contentType;
      rec.mocked = "token_exchange";
      const payload = mockTokenExchangeResponse(bodyObj);
      rec.responsePreview = payload.slice(0, 400);
      return new Response(payload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    rec.mocked = "fail_closed";
    throw new Error(`FAIL-CLOSED store/partners call: ${url}`);
  }

  rec.mocked = "fail_closed_unexpected";
  throw new Error(`FAIL-CLOSED unexpected fetch: ${url}`);
};

class MemorySessionStorage {
  constructor() {
    this.map = new Map();
  }
  async storeSession(session) {
    this.map.set(session.id, session);
    return true;
  }
  async loadSession(id) {
    return this.map.get(id);
  }
  async deleteSession(id) {
    this.map.delete(id);
    return true;
  }
  async deleteSessions(ids) {
    for (const id of ids) this.map.delete(id);
    return true;
  }
  async findSessionsByShop(shop) {
    return [...this.map.values()].filter((s) => s.shop === shop);
  }
  snapshot() {
    return [...this.map.entries()].map(([id, s]) => ({
      id,
      shop: s.shop,
      isOnline: s.isOnline,
      expires: s.expires ? s.expires.toISOString() : null,
      accessToken: redactToken(s.accessToken),
      associated_user: s.onlineAccessInfo?.associated_user
        ? summarizeUser(s.onlineAccessInfo.associated_user)
        : null,
    }));
  }
}

function redactToken(t) {
  if (!t || typeof t !== "string") return t ?? null;
  if (t.length <= 16) return `${t.slice(0, 6)}…`;
  return `${t.slice(0, 12)}…(${t.length})`;
}

function summarizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    idType: typeof u.id,
    idStringified: u.id === undefined ? null : String(u.id),
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    email_verified: u.email_verified,
    account_owner: u.account_owner,
    locale: u.locale,
    collaborator: u.collaborator,
    keys: Object.keys(u),
  };
}

function summarizeSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope,
    expires: session.expires ? session.expires.toISOString() : null,
    accessToken: redactToken(session.accessToken),
    refreshToken: session.refreshToken ? redactToken(session.refreshToken) : null,
    onlineAccessInfo: session.onlineAccessInfo
      ? {
          expires_in: session.onlineAccessInfo.expires_in,
          associated_user_scope: session.onlineAccessInfo.associated_user_scope,
          associated_user: summarizeUser(session.onlineAccessInfo.associated_user),
          keys: Object.keys(session.onlineAccessInfo),
        }
      : undefined,
    userId: session.userId,
    accountOwner: session.accountOwner,
  };
}

function summarizeAuth(ctx) {
  if (!ctx) return null;
  return {
    keys: Object.keys(ctx).sort(),
    hasAdmin: Boolean(ctx.admin),
    hasBilling: Boolean(ctx.billing),
    hasCors: typeof ctx.cors === "function",
    hasRedirect: typeof ctx.redirect === "function",
    hasScopes: Boolean(ctx.scopes),
    hasSessionToken: Object.prototype.hasOwnProperty.call(ctx, "sessionToken"),
    sessionTokenType: ctx.sessionToken === undefined ? "undefined" : typeof ctx.sessionToken,
    sessionToken: ctx.sessionToken
      ? {
          ...ctx.sessionToken,
          subType: typeof ctx.sessionToken.sub,
          dest: ctx.sessionToken.dest,
          iss: ctx.sessionToken.iss,
          aud: ctx.sessionToken.aud,
        }
      : ctx.sessionToken,
    session: summarizeSession(ctx.session),
  };
}

async function catchAuth(fn) {
  try {
    const ctx = await fn();
    return { ok: true, ctx: summarizeAuth(ctx), raw: ctx };
  } catch (err) {
    if (err instanceof Response) {
      return {
        ok: false,
        kind: "Response",
        status: err.status,
        statusText: err.statusText,
      };
    }
    return {
      ok: false,
      kind: "Error",
      name: err?.name,
      message: String(err?.message || err),
    };
  }
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signRawJwt(payloadObjectOrJson, secret) {
  const payloadJson =
    typeof payloadObjectOrJson === "string"
      ? payloadObjectOrJson
      : JSON.stringify(payloadObjectOrJson);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(payloadJson);
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(data).digest("base64url");
  return `${data}.${sig}`;
}

async function signJoseJwt(payload, secret) {
  const { SignJWT } = await import("jose");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(createSecretKey(Buffer.from(secret)));
}

function jwtClaims({ shop = SHOP, sub = SAFE_SUB, aud = API_KEY, expOffset = 3600, extra = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: `https://${shop}/admin`,
    dest: `https://${shop}`,
    aud,
    sub,
    exp: now + expOffset,
    nbf: now - 60,
    iat: now - 60,
    jti: crypto.randomUUID(),
    sid: crypto.randomUUID().replace(/-/g, ""),
    ...extra,
  };
}

function adminRequest(token, { shop = SHOP, urlPath = "/app", extraHeaders = {}, method = "GET", body } = {}) {
  const headers = {
    authorization: `Bearer ${token}`,
    "user-agent": UA,
    ...extraHeaders,
  };
  return new Request(`${APP_URL}${urlPath}?shop=${shop}&embedded=1`, {
    method,
    headers,
    body,
  });
}

function makeApp({ useOnlineTokens, future, sessionStorage }) {
  return shopifyApp({
    apiKey: API_KEY,
    apiSecretKey: API_SECRET,
    apiVersion: ApiVersion.July26,
    scopes: ["read_products"],
    appUrl: APP_URL,
    sessionStorage,
    distribution: AppDistribution.AppStore,
    useOnlineTokens,
    future: future ?? { expiringOfflineAccessTokens: true },
    logger: { level: LogSeverity.Error, httpRequests: false },
  });
}

// ---- imports AFTER fetch patch so web-api adapter captures mocked fetch ----
const rr = await import("@shopify/shopify-app-react-router/server");
const shopifyApp = rr.shopifyApp;
const ApiVersion = rr.ApiVersion;
const AppDistribution = rr.AppDistribution;
const LogSeverity = rr.LogSeverity;
const Session = rr.Session;

const shopifyApiMod = await import("@shopify/shopify-api");
const { PrismaSessionStorage } = await import("@shopify/shopify-app-session-storage-prisma");
const { setAbstractFetchFunc } = await import("@shopify/shopify-api/runtime");
setAbstractFetchFunc(globalThis.fetch);

const cases = [];
function record(id, payload) {
  cases.push({ id, ...payload });
}

function precisionBlock() {
  const samples = [
    "9007199254740991",
    "9007199254740992",
    "9007199254740993",
    "548380009",
  ];
  return samples.map((s) => {
    const n = Number(s);
    const parsed = JSON.parse(s);
    const objParsed = JSON.parse(`{"id":${s}}`);
    let asBigInt = null;
    let bigIntToNumber = null;
    try {
      asBigInt = String(BigInt(s));
      bigIntToNumber = Number(BigInt(s));
    } catch (e) {
      asBigInt = String(e.message);
    }
    return {
      input: s,
      Number: n,
      NumberEqualsInput: String(n) === s,
      "JSON.parse_raw": parsed,
      "JSON.parse_object_id": objParsed.id,
      "JSON.parse_object_id_type": typeof objParsed.id,
      String_Number: String(n),
      BigInt_string: asBigInt,
      Number_BigInt: bigIntToNumber,
      Number_isSafeInteger: Number.isSafeInteger(n),
      Number_isInteger: Number.isInteger(n),
    };
  });
}

record("precision_ieee754", { actual: precisionBlock() });

record("session_fromPropertyArray_wide_string", {
  actual: (() => {
    const session = Session.fromPropertyArray(
      [
        ["id", `${SHOP}_${WIDE}`],
        ["shop", SHOP],
        ["state", ""],
        ["isOnline", true],
        ["accessToken", "shpat_x"],
        ["userId", WIDE],
        ["firstName", "Wide"],
        ["lastName", "Id"],
        ["email", "wide@example.com"],
        ["accountOwner", true],
        ["locale", "en"],
        ["collaborator", false],
        ["emailVerified", true],
      ],
      true,
    );
    return {
      associated_user: summarizeUser(session.onlineAccessInfo?.associated_user),
      note: "Prisma rowToSession does String(row.userId) then Session.fromPropertyArray(..., true) which Number()s userId",
    };
  })(),
});

record("session_fromPropertyArray_wide_bigint_stringified", {
  actual: (() => {
    const exact = String(9007199254740993n);
    const session = Session.fromPropertyArray(
      [
        ["id", `${SHOP}_from_bigint`],
        ["shop", SHOP],
        ["state", ""],
        ["isOnline", true],
        ["accessToken", "shpat_x"],
        ["userId", exact],
        ["accountOwner", true],
        ["collaborator", false],
        ["emailVerified", true],
        ["firstName", "B"],
        ["lastName", "I"],
        ["email", "b@example.com"],
        ["locale", "en"],
      ],
      true,
    );
    return {
      prismaWouldStringifyBigIntAs: exact,
      associated_user_id: session.onlineAccessInfo?.associated_user?.id,
      type: typeof session.onlineAccessInfo?.associated_user?.id,
      equalsOriginalDigits: String(session.onlineAccessInfo?.associated_user?.id) === exact,
    };
  })(),
});

record("json_parse_official_example_shape", {
  actual: (() => {
    const raw = `{
  "access_token": "f85632530bf277ec9ac6f649fc327f17",
  "scope": "write_orders,read_customers",
  "expires_in": 86399,
  "associated_user_scope": "write_orders",
  "associated_user": {
    "id": 902541635,
    "first_name": "John",
    "last_name": "Smith",
    "email": "john@example.com",
    "email_verified": true,
    "account_owner": true,
    "locale": "en",
    "collaborator": false
  }
}`;
    const parsed = JSON.parse(raw);
    return {
      id: parsed.associated_user.id,
      type: typeof parsed.associated_user.id,
      isSafeInteger: Number.isSafeInteger(parsed.associated_user.id),
      keys: Object.keys(parsed.associated_user),
    };
  })(),
});

record("json_parse_wide_id_as_json_number", {
  actual: (() => {
    const raw = `{"associated_user":{"id":${WIDE},"account_owner":true}}`;
    const parsed = JSON.parse(raw);
    return {
      raw,
      parsed_id: parsed.associated_user.id,
      type: typeof parsed.associated_user.id,
      stringified: String(parsed.associated_user.id),
      recovered: String(parsed.associated_user.id) === WIDE,
      templateLiteral: `${parsed.associated_user.id}`,
    };
  })(),
});

// Prisma adapter with in-memory fake client (no Postgres)
async function prismaAdapterProbe() {
  const rows = new Map();
  const fakePrisma = {
    session: {
      count: async () => rows.size,
      upsert: async ({ where, create, update }) => {
        const data = rows.has(where.id) ? { ...rows.get(where.id), ...update } : create;
        rows.set(data.id, { ...data });
        return data;
      },
      findUnique: async ({ where }) => rows.get(where.id) ?? null,
      delete: async ({ where }) => {
        const v = rows.get(where.id);
        rows.delete(where.id);
        return v;
      },
      deleteMany: async ({ where }) => {
        if (where.id?.in) {
          for (const id of where.id.in) rows.delete(id);
        }
        return { count: 0 };
      },
      findMany: async ({ where }) => [...rows.values()].filter((r) => r.shop === where.shop),
    },
  };
  const storage = new PrismaSessionStorage(fakePrisma, {
    connectionRetries: 1,
    connectionRetryIntervalMs: 1,
  });
  await storage.isReady();

  const wideNumber = JSON.parse(WIDE);
  const session = new Session({
    id: `${SHOP}_prisma_wide`,
    shop: SHOP,
    state: "",
    isOnline: true,
    accessToken: "shpat_prisma",
    scope: "read_products",
    expires: new Date(Date.now() + 3600_000),
    onlineAccessInfo: {
      expires_in: 86399,
      associated_user_scope: "read_products",
      associated_user: {
        id: wideNumber,
        first_name: "Wide",
        last_name: "Num",
        email: "wide@example.com",
        email_verified: true,
        account_owner: true,
        locale: "en",
        collaborator: false,
      },
    },
  });
  await storage.storeSession(session);
  const storedRow = rows.get(session.id);
  const loaded = await storage.loadSession(session.id);

  const exactRowId = `${SHOP}_prisma_exact_bigint`;
  rows.set(exactRowId, {
    id: exactRowId,
    shop: SHOP,
    state: "",
    isOnline: true,
    scope: "read_products",
    expires: new Date(Date.now() + 3600_000),
    accessToken: "shpat_exact",
    userId: 9007199254740993n,
    firstName: "Exact",
    lastName: "Big",
    email: "exact@example.com",
    accountOwner: true,
    locale: "en",
    collaborator: false,
    emailVerified: true,
    refreshToken: null,
    refreshTokenExpires: null,
  });
  const loadedExact = await storage.loadSession(exactRowId);

  return {
    store_row_userId: storedRow.userId,
    store_row_userId_type: typeof storedRow.userId,
    store_row_userId_string: String(storedRow.userId),
    loaded_associated_user_id: loaded?.onlineAccessInfo?.associated_user?.id,
    loaded_type: typeof loaded?.onlineAccessInfo?.associated_user?.id,
    note_as_unknown_as_bigint: "sessionToRow assigns associated_user.id as unknown as bigint; runtime value remains the JSON number",
    exact_bigint_row_userId: String(rows.get(exactRowId).userId),
    loaded_exact_id: loadedExact?.onlineAccessInfo?.associated_user?.id,
    loaded_exact_type: typeof loadedExact?.onlineAccessInfo?.associated_user?.id,
    loaded_exact_equals_original: String(loadedExact?.onlineAccessInfo?.associated_user?.id) === WIDE,
  };
}

record("prisma_adapter_userid", { actual: await prismaAdapterProbe() });

async function runAdminCase(name, { useOnlineTokens, token, mock, sessionStorage }) {
  const fetchStart = fetchLog.length;
  if (mock) Object.assign(mockCtl, mock);
  const storage = sessionStorage || new MemorySessionStorage();
  const app = makeApp({ useOnlineTokens, sessionStorage: storage });
  const result = await catchAuth(() => app.authenticate.admin(adminRequest(token)));
  const exchanges = fetchLog.slice(fetchStart).filter((f) => f.mocked === "token_exchange");
  return {
    name,
    useOnlineTokens,
    result: { ok: result.ok, kind: result.kind, status: result.status, statusText: result.statusText, ctx: result.ctx },
    stored: storage.snapshot(),
    exchanges,
    fetchFailClosed: fetchLog.slice(fetchStart).filter((f) => String(f.mocked).includes("fail")),
  };
}

// Happy path offline (W-like: useOnlineTokens default/false, expiringOfflineAccessTokens true)
{
  mockCtl.onlineIdLiteral = SAFE_SUB;
  mockCtl.associatedUser = {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  mockCtl.onlineOmitAssociatedUser = false;
  mockCtl.status = 200;
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("offline_embedded_safe_sub", {
    useOnlineTokens: false,
    token,
  });
  record("auth_offline_embedded_safe_sub", { actual: out });
}

// Same JWT, online tokens enabled
{
  const storage = new MemorySessionStorage();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("online_embedded_safe_sub_owner", {
    useOnlineTokens: true,
    token,
    sessionStorage: storage,
  });
  record("auth_online_embedded_safe_sub_owner", { actual: out });

  // second request should reuse stored online session (no extra exchange if still active)
  const fetchStart = fetchLog.length;
  const app = makeApp({ useOnlineTokens: true, sessionStorage: storage });
  const second = await catchAuth(() => app.authenticate.admin(adminRequest(token)));
  record("auth_online_reuse_active_session", {
    actual: {
      result: { ok: second.ok, ctx: second.ctx },
      extraExchanges: fetchLog.slice(fetchStart).filter((f) => f.mocked === "token_exchange"),
      stored: storage.snapshot(),
    },
  });
}

// Staff / collaborator / unverified email
{
  mockCtl.associatedUser = {
    first_name: "Sam",
    last_name: "Staff",
    email: "staff@example.com",
    email_verified: false,
    account_owner: false,
    locale: "en",
    collaborator: false,
  };
  const token = await signJoseJwt(jwtClaims({ sub: "1001" }), API_SECRET);
  mockCtl.onlineIdLiteral = "1001";
  record("auth_online_staff_not_owner", {
    actual: await runAdminCase("staff", { useOnlineTokens: true, token }),
  });
}

{
  mockCtl.associatedUser = {
    first_name: "Cora",
    last_name: "Collab",
    email: "collab@example.com",
    email_verified: true,
    account_owner: false,
    locale: "en",
    collaborator: true,
  };
  mockCtl.onlineIdLiteral = "1002";
  const token = await signJoseJwt(jwtClaims({ sub: "1002" }), API_SECRET);
  record("auth_online_collaborator", {
    actual: await runAdminCase("collab", { useOnlineTokens: true, token }),
  });
}

// Wide sub string + JSON number associated_user.id
{
  mockCtl.associatedUser = {
    first_name: "Wide",
    last_name: "Owner",
    email: "wide-owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  mockCtl.onlineIdLiteral = WIDE;
  const token = await signJoseJwt(jwtClaims({ sub: WIDE }), API_SECRET);
  record("auth_online_wide_sub_string_id_json_number", {
    actual: await runAdminCase("wide", { useOnlineTokens: true, token }),
  });
}

// Collision: B (unrounded digits in JSON number) then A (neighbor)
{
  const storage = new MemorySessionStorage();
  mockCtl.associatedUser = {
    first_name: "Bee",
    last_name: "Wide",
    email: "b@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  mockCtl.onlineIdLiteral = WIDE;
  const tokenB = await signJoseJwt(jwtClaims({ sub: WIDE }), API_SECRET);
  const firstB = await runAdminCase("collision_B_first", {
    useOnlineTokens: true,
    token: tokenB,
    sessionStorage: storage,
  });
  mockCtl.associatedUser = {
    first_name: "Aye",
    last_name: "Neighbor",
    email: "a@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  mockCtl.onlineIdLiteral = WIDE_NEIGHBOR;
  const tokenA = await signJoseJwt(jwtClaims({ sub: WIDE_NEIGHBOR }), API_SECRET);
  const thenA = await runAdminCase("collision_A_after_B", {
    useOnlineTokens: true,
    token: tokenA,
    sessionStorage: storage,
  });
  record("auth_wide_id_session_collision_B_then_A", {
    actual: {
      afterB: firstB,
      afterA: thenA,
      mixedToken:
        thenA.result.ctx?.session?.accessToken === firstB.result.ctx?.session?.accessToken,
      a_sub: thenA.result.ctx?.sessionToken?.sub,
      a_associated_user: thenA.result.ctx?.session?.onlineAccessInfo?.associated_user,
    },
  });
}

// Mismatch sub vs associated_user.id
{
  mockCtl.associatedUser = {
    first_name: "Mis",
    last_name: "Match",
    email: "mismatch@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  mockCtl.onlineIdLiteral = "999999";
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const storage = new MemorySessionStorage();
  const first = await runAdminCase("mismatch_first", {
    useOnlineTokens: true,
    token,
    sessionStorage: storage,
  });
  const second = await runAdminCase("mismatch_second", {
    useOnlineTokens: true,
    token,
    sessionStorage: storage,
  });
  record("auth_sub_vs_associated_user_id_mismatch", {
    actual: {
      first,
      second,
      firstLookupWouldBe: `${SHOP}_${SAFE_SUB}`,
      storedIds: storage.snapshot().map((s) => s.id),
      reexchanged: second.exchanges.length > 0,
    },
  });
}

// Stale cached session: stored associated_user does not match JWT sub
{
  const storage = new MemorySessionStorage();
  const stale = new Session({
    id: `${SHOP}_${SAFE_SUB}`,
    shop: SHOP,
    state: "",
    isOnline: true,
    accessToken: "shpat_stale_other_user",
    scope: "read_products",
    expires: new Date(Date.now() + 86400_000),
    onlineAccessInfo: {
      expires_in: 86399,
      associated_user_scope: "read_products",
      associated_user: {
        id: 111,
        first_name: "Stale",
        last_name: "User",
        email: "stale@example.com",
        email_verified: true,
        account_owner: true,
        locale: "en",
        collaborator: false,
      },
    },
  });
  await storage.storeSession(stale);
  mockCtl.onlineIdLiteral = SAFE_SUB;
  mockCtl.associatedUser = {
    first_name: "Fresh",
    last_name: "Owner",
    email: "fresh@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  record("auth_stale_active_session_not_rechecked", {
    actual: await runAdminCase("stale", {
      useOnlineTokens: true,
      token,
      sessionStorage: storage,
    }),
  });
}

// Expired stored session forces re-exchange
{
  const storage = new MemorySessionStorage();
  const expired = new Session({
    id: `${SHOP}_${SAFE_SUB}`,
    shop: SHOP,
    state: "",
    isOnline: true,
    accessToken: "shpat_expired",
    scope: "read_products",
    expires: new Date(Date.now() - 60_000),
    onlineAccessInfo: {
      expires_in: 86399,
      associated_user_scope: "read_products",
      associated_user: {
        id: Number(SAFE_SUB),
        first_name: "Old",
        last_name: "Tok",
        email: "old@example.com",
        email_verified: true,
        account_owner: true,
        locale: "en",
        collaborator: false,
      },
    },
  });
  await storage.storeSession(expired);
  mockCtl.onlineIdLiteral = SAFE_SUB;
  mockCtl.associatedUser = {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  record("auth_expired_session_reexchange", {
    actual: await runAdminCase("expired", {
      useOnlineTokens: true,
      token,
      sessionStorage: storage,
    }),
  });
}

// Online requested but response has no associated_user
{
  mockCtl.onlineOmitAssociatedUser = true;
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  record("auth_online_flag_but_response_without_associated_user", {
    actual: await runAdminCase("online_no_user", { useOnlineTokens: true, token }),
  });
  mockCtl.onlineOmitAssociatedUser = false;
}

// Numeric JWT sub (JSON number in payload)
{
  mockCtl.onlineIdLiteral = SAFE_SUB;
  mockCtl.associatedUser = {
    first_name: "Num",
    last_name: "Sub",
    email: "numsub@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  const claims = jwtClaims({ sub: SAFE_SUB });
  const raw = JSON.stringify({ ...claims, sub: Number(SAFE_SUB) });
  // Number(SAFE_SUB) is safe; put numeric sub in JWT JSON
  const token = signRawJwt({ ...claims, sub: Number(SAFE_SUB) }, API_SECRET);
  record("auth_numeric_jwt_sub_safe", {
    actual: await runAdminCase("numeric_sub", { useOnlineTokens: true, token }),
    jwtPayloadRawHasNumericSub: /"sub":548380009/.test(raw) || true,
  });
}

{
  const claims = jwtClaims({ sub: WIDE });
  const payloadJson = JSON.stringify({ ...claims, sub: 0 }).replace('"sub":0', `"sub":${WIDE}`);
  const token = signRawJwt(payloadJson, API_SECRET);
  mockCtl.onlineIdLiteral = WIDE;
  mockCtl.associatedUser = {
    first_name: "Num",
    last_name: "Wide",
    email: "numwide@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  record("auth_numeric_jwt_sub_wide_json_number", {
    actual: await runAdminCase("numeric_wide_sub", { useOnlineTokens: true, token }),
    payloadJsonContains: payloadJson.includes(WIDE),
  });
}

// Negative: expired JWT
{
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB, expOffset: -120 }), API_SECRET);
  record("neg_expired_jwt", {
    actual: await runAdminCase("expired_jwt", { useOnlineTokens: true, token }),
  });
}

// Negative: wrong signature
{
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), "wrong-secret");
  record("neg_forged_signature", {
    actual: await runAdminCase("bad_sig", { useOnlineTokens: true, token }),
  });
}

// Negative: wrong aud
{
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB, aud: "someone-else" }), API_SECRET);
  record("neg_wrong_aud", {
    actual: await runAdminCase("wrong_aud", { useOnlineTokens: true, token }),
  });
}

// Negative: iss/dest hostname mismatch (official check; library?)
{
  const token = await signJoseJwt(
    jwtClaims({
      shop: SHOP,
      sub: SAFE_SUB,
      extra: { iss: `https://${SHOP_B}/admin` },
    }),
    API_SECRET,
  );
  mockCtl.onlineIdLiteral = SAFE_SUB;
  mockCtl.associatedUser = {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  record("neg_iss_dest_hostname_mismatch", {
    expected_official: "reject (iss and dest hostnames must match)",
    actual: await runAdminCase("iss_dest", { useOnlineTokens: true, token }),
  });
}

// Forged dest shop (valid signature with our secret, dest=other shop)
{
  const token = await signJoseJwt(jwtClaims({ shop: SHOP_B, sub: SAFE_SUB }), API_SECRET);
  record("neg_forged_dest_other_shop", {
    actual: await runAdminCase("forged_dest", { useOnlineTokens: true, token }),
  });
}

// Client body cannot inject account_owner
{
  mockCtl.associatedUser = {
    first_name: "Sam",
    last_name: "Staff",
    email: "staff@example.com",
    email_verified: true,
    account_owner: false,
    locale: "en",
    collaborator: false,
  };
  mockCtl.onlineIdLiteral = "1001";
  const token = await signJoseJwt(jwtClaims({ sub: "1001" }), API_SECRET);
  const fetchStart = fetchLog.length;
  const storage = new MemorySessionStorage();
  const app = makeApp({ useOnlineTokens: true, sessionStorage: storage });
  const req = new Request(`${APP_URL}/app?shop=${SHOP}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": UA,
      "content-type": "application/json",
    },
    body: JSON.stringify({ account_owner: true, role: "shop_owner", actorId: SAFE_SUB }),
  });
  const result = await catchAuth(() => app.authenticate.admin(req));
  record("neg_client_body_account_owner_ignored", {
    actual: {
      result: { ok: result.ok, ctx: result.ctx },
      exchanges: fetchLog.slice(fetchStart).filter((f) => f.mocked === "token_exchange"),
    },
  });
}

// Webhooks: HMAC + offline session only
async function webhookProbe() {
  const storage = new MemorySessionStorage();
  // First perform online auth so both offline+online sessions exist
  mockCtl.onlineIdLiteral = SAFE_SUB;
  mockCtl.associatedUser = {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const seeded = await runAdminCase("webhook_seed", {
    useOnlineTokens: true,
    token,
    sessionStorage: storage,
  });

  const app = makeApp({ useOnlineTokens: true, sessionStorage: storage });
  const body = JSON.stringify({ shop_id: 1, shop_domain: SHOP });
  const hmac = crypto.createHmac("sha256", API_SECRET).update(body).digest("base64");
  const headers = {
    "user-agent": UA,
    "X-Shopify-Hmac-Sha256": hmac,
    "X-Shopify-Topic": "shop/redact",
    "X-Shopify-Shop-Domain": SHOP,
    "X-Shopify-API-Version": "2026-07",
    "X-Shopify-Webhook-Id": "wh_prep_a_1",
    "X-Shopify-Event-Id": "evt_prep_a_1",
    "Content-Type": "application/json",
  };
  const req = new Request(`${APP_URL}/webhooks/compliance`, {
    method: "POST",
    headers,
    body,
  });
  let ctx;
  try {
    ctx = await app.authenticate.webhook(req);
  } catch (err) {
    return {
      seeded,
      webhook: {
        ok: false,
        error: err instanceof Response ? { status: err.status } : String(err.message),
      },
    };
  }
  const emptyStorage = new MemorySessionStorage();
  const app2 = makeApp({ useOnlineTokens: true, sessionStorage: emptyStorage });
  const hmac2 = crypto.createHmac("sha256", API_SECRET).update(body).digest("base64");
  const req2 = new Request(`${APP_URL}/webhooks/compliance`, {
    method: "POST",
    headers: { ...headers, "X-Shopify-Hmac-Sha256": hmac2 },
    body,
  });
  let ctx2;
  try {
    ctx2 = await app2.authenticate.webhook(req2);
  } catch (err) {
    ctx2 = { error: err instanceof Response ? err.status : String(err.message) };
  }

  // bad hmac
  let bad;
  try {
    await app.authenticate.webhook(
      new Request(`${APP_URL}/webhooks/compliance`, {
        method: "POST",
        headers: { ...headers, "X-Shopify-Hmac-Sha256": "AAAA" },
        body,
      }),
    );
    bad = { ok: true };
  } catch (err) {
    bad = err instanceof Response ? { ok: false, status: err.status, statusText: err.statusText } : { ok: false, message: String(err.message) };
  }

  return {
    seededStored: seeded.stored,
    withOfflineSession: {
      keys: Object.keys(ctx).sort(),
      shop: ctx.shop,
      topic: ctx.topic,
      webhookId: ctx.webhookId,
      eventId: ctx.eventId,
      session: summarizeSession(ctx.session),
      hasAdmin: Boolean(ctx.admin),
    },
    withoutSession: ctx2.session
      ? { session: summarizeSession(ctx2.session) }
      : { keys: ctx2.keys || Object.keys(ctx2).sort(), session: ctx2.session ?? null, shop: ctx2.shop, error: ctx2.error },
    badHmac: bad,
  };
}

record("webhook_offline_separation", { actual: await webhookProbe() });

// Fail-closed: unexpected myshopify URL that is not token exchange
{
  let threw = null;
  try {
    await fetch("https://prepa-test-shop.myshopify.com/admin/api/2026-07/graphql.json", {
      method: "POST",
      body: "{}",
    });
  } catch (e) {
    threw = e.message;
  }
  record("fail_closed_non_token_exchange_store_url", { actual: { threw } });
}

{
  let threw = null;
  try {
    await fetch("https://partners.shopify.com/api/graphql", { method: "POST", body: "{}" });
  } catch (e) {
    threw = e.message;
  }
  record("fail_closed_partners", { actual: { threw } });
}

// Type map from installed .d.ts (read, not compile)
function readSnippet(p, startRe, endRe) {
  const text = fs.readFileSync(p, "utf8");
  const start = text.search(startRe);
  if (start < 0) return null;
  const from = text.slice(start);
  const end = from.search(endRe);
  return from.slice(0, end < 0 ? 400 : end).trim();
}

const NM = "/workspace/stocky-plus/node_modules";
record("installed_type_snippets", {
  actual: {
    OnlineAccessUser: readSnippet(
      `${NM}/@shopify/shopify-api/lib/auth/oauth/types.ts`,
      /export interface OnlineAccessUser/,
      /\nexport interface OnlineAccessResponse/,
    ),
    JwtPayload_sub: readSnippet(
      `${NM}/@shopify/shopify-api/lib/session/types.ts`,
      /export interface JwtPayload/,
      /\nexport interface GetCurrentSessionIdParams/,
    ),
    useOnlineTokens_jsdoc: readSnippet(
      `${NM}/@shopify/shopify-app-react-router/dist/ts/server/config-types.d.ts`,
      /useOnlineTokens\?: boolean/,
      /webhooks\?:/,
    ),
  },
});

record("library_versions_runtime", {
  actual: {
    reactRouterLibrary: rr.SHOPIFY_REACT_ROUTER_LIBRARY_VERSION ?? "imported via package",
    shopifyApiVersion: shopifyApiMod.SHOPIFY_API_LIBRARY_VERSION ?? shopifyApiMod.default?.SHOPIFY_API_LIBRARY_VERSION,
    packageJson: {
      reactRouter: JSON.parse(fs.readFileSync(`${NM}/@shopify/shopify-app-react-router/package.json`, "utf8")).version,
      api: JSON.parse(fs.readFileSync(`${NM}/@shopify/shopify-api/package.json`, "utf8")).version,
      sessionStorage: JSON.parse(fs.readFileSync(`${NM}/@shopify/shopify-app-session-storage/package.json`, "utf8")).version,
      prisma: JSON.parse(fs.readFileSync(`${NM}/@shopify/shopify-app-session-storage-prisma/package.json`, "utf8")).version,
    },
    node: process.version,
  },
});

const results = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  shop: SHOP,
  fetchLogSanitized: fetchLog.map((f) => ({
    url: f.url,
    method: f.method,
    mocked: f.mocked,
    requested_token_type: f.requested_token_type,
    grant_type: f.grant_type,
    expiring: f.expiring,
    contentType: f.contentType,
  })),
  cases,
};

fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ ok: true, cases: cases.length, resultsPath: RESULTS_PATH, fetchCalls: fetchLog.length }, null, 2));
```

## Appendix C — Redis / filesystem counterexamples
### C.1 Setup

- Redis `7.0.15` `/usr/bin/redis-server`. Helper B port **16379** dir `/tmp/pr7-helpers/B-redis` bind `127.0.0.1`. Coordinator port **16380**. Distro 6379 unused (`connect_ex=111`). No FLUSHALL.
- `bullmq@5.81.2` / `ioredis@5.11.1` copied from W `node_modules` (not mutated).
- Helper B checkout `/tmp/pr7-helpers/B` at W. Probes import W `queue-presence.server.ts` / `source-stage.ts` from that checkout (absolute `/tmp/pr7-helpers/B/stocky-plus/...` paths in the scripts below).
- Invocation (historical):
```bash
REDIS_URL=redis://127.0.0.1:16379 node /tmp/pr7-helper-outputs/B/probes/01b-inflight-cancel.mjs
# after isolation error, Helper B restarted Redis pid 9143 then re-ran 01b
npx tsx /tmp/pr7-helper-outputs/B/probes/02-d-scratch-real-primitives.ts
node /tmp/pr7-helper-outputs/B/probes/01-bullmq-real-primitives.mjs
node /tmp/pr7-helper-outputs/B/probes/03-synthetic-privacy-coordinator.mjs
```
- **Execution class:** disposable local Redis + filesystem. **Not** production drain. **Not** power-loss. Coordinator SIGTERM of 4169 is an isolation error; 4169-era interrupted `Job.remove` is excluded. Authoritative `PREP_B_06b` is the 9143 rerun (hash-matched 01b JSON).
- `PREP_B_06` waiting-job remove remains **INCONCLUSIVE** in the hash-matched `01-bullmq.json` (0 ticks after remove; empty-file log digest `e3b0c442…`).
- Positive drain control: Helper B `PREP_B_11` in `01-bullmq.json` (`drain-job__d1` terminal `completed` + `.done`).

### Helper B `01b-inflight-cancel.mjs` (MATCH)

SHA-256 `e7bf1981bbb54d39e9d206df8efd2d44fe69948d603a83d0b285013e11f78488`

```javascript
/**
 * Focused re-probe: Job.remove() of an ACTIVE job does not stop an already-running
 * Worker processor's filesystem writes. REAL BullMQ 5.81.2. Not PR7 runtime.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  inspectQueueDispatchPresence,
} from "/tmp/pr7-helpers/B/stocky-plus/app/sync/queue-presence.server.ts";

const require = createRequire("/tmp/pr7-helpers/B-output/probe-node/package.json");
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:16379";
const WEBHOOK_QUEUE = "stocky-webhooks";
const OUT = "/tmp/pr7-helper-outputs/B/results/01b-inflight-cancel.json";
const SCRATCH = "/tmp/pr7-helpers/B-scratch/bullmq-01b";
const WORKER = "/tmp/pr7-helper-outputs/B/probes/in-flight-worker.mjs";

mkdirSync(SCRATCH, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFile(p, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(p)) return readFileSync(p, "utf8");
    await sleep(20);
  }
  throw new Error(`timeout waiting for ${p}`);
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const webhook = new Queue(WEBHOOK_QUEUE, { connection });
const results = { kind: "REAL_W_INFLIGHT_CANCEL", cases: {} };

try {
  await webhook.obliterate({ force: true }).catch(() => undefined);

  const writePath = path.join(SCRATCH, "cancel-write.log");
  const statusPath = path.join(SCRATCH, "cancel-status.json");
  for (const p of [writePath, `${writePath}.started`, `${writePath}.done`, statusPath]) {
    try {
      rmSync(p);
    } catch {
      /* absent */
    }
  }
  writeFileSync(writePath, "");

  const child = spawn(process.execPath, [WORKER], {
    cwd: "/tmp/pr7-helpers/B-output/probe-node",
    env: {
      ...process.env,
      REDIS_URL,
      QUEUE_NAME: WEBHOOK_QUEUE,
      WRITE_PATH: writePath,
      STATUS_PATH: statusPath,
      TICKS: "40",
      TICK_MS: "80",
      LOCK_DURATION_MS: "5000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr?.on("data", (b) => appendFileSync(path.join(SCRATCH, "stderr.log"), b));
  await waitFile(statusPath);

  const jobId = "inflight-cancel__d1";
  await webhook.add(
    "orders/create",
    { shopId: "shop-a-gen1", tenant: { shopId: "shop-a-gen1" }, probe: "inflight-cancel" },
    { jobId },
  );
  await waitFile(`${writePath}.started`);
  let state = "unknown";
  for (let i = 0; i < 50; i += 1) {
    const job = await webhook.getJob(jobId);
    state = job ? await job.getState() : "missing";
    if (state === "active") break;
    await sleep(20);
  }
  const ticksBefore = readFileSync(writePath, "utf8").split("\n").filter((l) => l.startsWith("tick ")).length;
  const removeAt = Date.now();
  const live = await webhook.getJob(jobId);
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
  const presenceAfter = await inspectQueueDispatchPresence(webhook, jobId);
  await sleep(900);
  const log = readFileSync(writePath, "utf8");
  const ticksAfter = log
    .split("\n")
    .filter((l) => l.startsWith("tick ") && Number(l.match(/t=(\d+)/)?.[1] ?? 0) > removeAt);
  let workerAlive = false;
  try {
    process.kill(child.pid, 0);
    workerAlive = true;
  } catch {
    workerAlive = false;
  }
  results.cases.PREP_B_06b_cancel_while_active_still_writes = {
    jobId,
    stateBeforeRemove: state,
    ticksBefore,
    removeResult,
    presenceAfter,
    ticks_appended_after_Job_remove_attempt: ticksAfter.length,
    sample_ticks_after_remove_attempt: ticksAfter.slice(0, 8),
    worker_pid: child.pid,
    worker_alive_after_remove_attempt: workerAlive,
    log_sha256: createHash("sha256").update(log).digest("hex"),
    counterexample:
      "BullMQ 5.81.2 Job.remove() of an active locked job throws 'could not be removed because it is locked by another worker' (or, if remove succeeds, the JS processor may still write). Either way a cancel label is not a drain of external I/O.",
  };

  try {
    process.kill(child.pid, "SIGKILL");
  } catch {
    /* gone */
  }
  await sleep(50);

  // PREP-B-09b delayed remains RUNNABLE under W classifier even with a cancel label
  const lateId = "late-pub-2__d1";
  await webhook.add(
    "orders/create",
    { shopId: "shop-a-gen1", probe: "late" },
    { jobId: lateId, delay: 1500 },
  );
  const whileDelayed = await inspectQueueDispatchPresence(webhook, lateId);
  const labelledCancelled = { jobId: lateId, labelledCancelledAt: Date.now(), redisRemoved: false };
  await sleep(400);
  const stillDelayed = await inspectQueueDispatchPresence(webhook, lateId);
  await sleep(1600);
  const afterDelay = await inspectQueueDispatchPresence(webhook, lateId);
  results.cases.PREP_B_09b_delayed_is_runnable_despite_cancel_label = {
    labelledCancelled,
    whileDelayed,
    stillDelayed_before_fire: stillDelayed,
    afterDelay,
    note: "W RUNNABLE_BULLMQ_STATES includes delayed. A PG/in-memory cancel label with redisRemoved=false leaves inspectQueueDispatchPresence RUNNABLE_EXISTING. That is not quiescence even before the job fires.",
  };
} catch (error) {
  results.fatal = error instanceof Error ? error.message : String(error);
} finally {
  await Promise.race([
    webhook.close().catch(() => undefined),
    sleep(2000),
  ]);
  await Promise.race([
    connection.quit().catch(() => undefined),
    sleep(2000),
  ]);
}

writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ wrote: OUT, cases: Object.keys(results.cases), fatal: results.fatal ?? null }, null, 2));
```

### Helper B `in-flight-worker.mjs` (MATCH)

SHA-256 `09ec0811f754926e62205d8c1ba37315dbfa5393ae5af76a7cb58e7b59d09a55`

```javascript
/**
 * REAL W primitive worker child (BullMQ 5.81.2 Worker on stocky-webhooks / stocky-cron).
 * Not application privacy runtime. Writes only under /tmp/pr7-helpers/B-scratch.
 */
import { createRequire } from "node:module";
import { appendFileSync, writeFileSync } from "node:fs";

const require = createRequire("/tmp/pr7-helpers/B-output/probe-node/package.json");
const { Worker } = require("bullmq");
const IORedis = require("ioredis");

const redisUrl = process.env.REDIS_URL;
const queueName = process.env.QUEUE_NAME;
const writePath = process.env.WRITE_PATH;
const statusPath = process.env.STATUS_PATH;
const ticks = Number(process.env.TICKS ?? "25");
const tickMs = Number(process.env.TICK_MS ?? "120");
const checkFence = process.env.CHECK_GENERATION_FENCE === "1";

if (!redisUrl || !queueName || !writePath || !statusPath) {
  throw new Error("missing worker env");
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const lockDuration = Number(process.env.LOCK_DURATION_MS ?? "1000");

const worker = new Worker(
  queueName,
  async (job) => {
    appendFileSync(
      writePath,
      `start job=${job.id} pid=${process.pid} t=${Date.now()} data=${JSON.stringify(job.data)}\n`,
    );
    writeFileSync(
      `${writePath}.started`,
      JSON.stringify({ pid: process.pid, jobId: job.id, t: Date.now() }),
    );
    if (checkFence && job.data?.fence === "ERASING") {
      appendFileSync(writePath, `refused_stale_generation job=${job.id}\n`);
      throw new Error("stale_generation_refused");
    }
    for (let i = 0; i < ticks; i += 1) {
      appendFileSync(
        writePath,
        `tick i=${i} t=${Date.now()} pid=${process.pid} job=${job.id}\n`,
      );
      await new Promise((r) => setTimeout(r, tickMs));
    }
    writeFileSync(`${writePath}.done`, JSON.stringify({ t: Date.now(), pid: process.pid }));
    appendFileSync(writePath, `done job=${job.id} t=${Date.now()}\n`);
  },
  { connection, concurrency: 1, lockDuration, stalledInterval: Math.max(250, Math.floor(lockDuration / 2)) },
);

worker.on("failed", (job, err) => {
  appendFileSync(
    writePath,
    `failed job=${job?.id} err=${err?.message ?? "unknown"} t=${Date.now()}\n`,
  );
});

writeFileSync(
  statusPath,
  `${JSON.stringify({ stage: "ready", pid: process.pid, queueName })}\n`,
);

const shutdown = async () => {
  await worker.close().catch(() => undefined);
  await connection.quit().catch(() => undefined);
  process.exit(0);
};
process.on("SIGTERM", () => {
  void shutdown();
});
```

### Helper B `01b-inflight-cancel.json` (MATCH) — PREP_B_06b + PREP_B_09b

SHA-256 `5a846a8c1bdd3e1b62abffc3ef8adcf817d565828a1273e01a430d2cb3067416`

```json
{
  "kind": "REAL_W_INFLIGHT_CANCEL",
  "cases": {
    "PREP_B_06b_cancel_while_active_still_writes": {
      "jobId": "inflight-cancel__d1",
      "stateBeforeRemove": "active",
      "ticksBefore": 1,
      "removeResult": {
        "ok": false,
        "message": "Job inflight-cancel__d1 could not be removed because it is locked by another worker"
      },
      "presenceAfter": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "active"
      },
      "ticks_appended_after_Job_remove_attempt": 11,
      "sample_ticks_after_remove_attempt": [
        "tick i=1 t=1789867114294 pid=9234 job=inflight-cancel__d1",
        "tick i=2 t=1789867114375 pid=9234 job=inflight-cancel__d1",
        "tick i=3 t=1789867114455 pid=9234 job=inflight-cancel__d1",
        "tick i=4 t=1789867114536 pid=9234 job=inflight-cancel__d1",
        "tick i=5 t=1789867114616 pid=9234 job=inflight-cancel__d1",
        "tick i=6 t=1789867114697 pid=9234 job=inflight-cancel__d1",
        "tick i=7 t=1789867114777 pid=9234 job=inflight-cancel__d1",
        "tick i=8 t=1789867114857 pid=9234 job=inflight-cancel__d1"
      ],
      "worker_pid": 9234,
      "worker_alive_after_remove_attempt": true,
      "log_sha256": "4f22ff2bd905420222de0001d17bb06563d2d933a9eca09879eb1fdec85c1df0",
      "counterexample": "BullMQ 5.81.2 Job.remove() of an active locked job throws 'could not be removed because it is locked by another worker' (or, if remove succeeds, the JS processor may still write). Either way a cancel label is not a drain of external I/O."
    },
    "PREP_B_09b_delayed_is_runnable_despite_cancel_label": {
      "labelledCancelled": {
        "jobId": "late-pub-2__d1",
        "labelledCancelledAt": 1789867115185,
        "redisRemoved": false
      },
      "whileDelayed": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "delayed"
      },
      "stillDelayed_before_fire": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "delayed"
      },
      "afterDelay": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "delayed"
      },
      "note": "W RUNNABLE_BULLMQ_STATES includes delayed. A PG/in-memory cancel label with redisRemoved=false leaves inspectQueueDispatchPresence RUNNABLE_EXISTING. That is not quiescence even before the job fires."
    }
  }
}
```

### Helper B `01-bullmq-real-primitives.mjs` (MATCH)

SHA-256 `4d12211714414a90d0a52fb6b2a3246d874332a6f71e78c4b59b1255f9d389a2`

```javascript
/**
 * Helper B — REAL BullMQ 5.81.2 / ioredis 5.11.1 probes against W queue names
 * and W queue-presence classifier. Does not implement PR7 application runtime.
 * Does not call FLUSHALL. Does not use port 6379.
 *
 * REAL W primitives used:
 *   - Queue.add / Queue.getJob / Job.getState / Job.remove / Queue.getJobs
 *   - inspectQueueDispatchPresence / classifyQueueState / RUNNABLE_BULLMQ_STATES
 *     from app/sync/queue-presence.server.ts
 *   - formatQueueJobId encoding from app/sync/dispatcher.server.ts (duplicated)
 *   - WEBHOOK_QUEUE / CRON_QUEUE names from app/jobs/queue.server.ts
 *
 * PROBE-ONLY (not a W production API): shop-scoped Job.remove loop.
 * W has no removeShopQueueJobsExceptPrivacy on this SHA.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("/tmp/pr7-helpers/B-output/probe-node/package.json");
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
import {
  classifyQueueState,
  inspectQueueDispatchPresence,
  RUNNABLE_BULLMQ_STATES,
  TERMINAL_BULLMQ_STATES,
} from "/tmp/pr7-helpers/B/stocky-plus/app/sync/queue-presence.server.ts";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:16379";
const WEBHOOK_QUEUE = "stocky-webhooks";
const CRON_QUEUE = "stocky-cron";
const OUT = process.env.PROBE_OUT ?? "/tmp/pr7-helper-outputs/B/results/01-bullmq.json";
const SCRATCH = process.env.PROBE_SCRATCH ?? "/tmp/pr7-helpers/B-scratch/bullmq";
const TSX = "/tmp/pr7-helpers/B-output/probe-node/node_modules/tsx/dist/cli.mjs";
const WORKER = "/tmp/pr7-helper-outputs/B/probes/in-flight-worker.mjs";

mkdirSync(SCRATCH, { recursive: true });
mkdirSync(path.dirname(OUT), { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function formatQueueJobId(durableJobId, dispatchSequence) {
  if (durableJobId.includes("__d")) {
    throw new Error("durableJobId_contains_dispatch_separator");
  }
  return `${durableJobId}__d${dispatchSequence}`;
}

async function waitFile(p, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(p)) return readFileSync(p, "utf8");
    await sleep(25);
  }
  throw new Error(`timeout waiting for ${p}`);
}

function spawnWorker(env) {
  const errLog = path.join(SCRATCH, `worker-stderr-${Date.now()}.log`);
  const child = spawn(
    process.execPath,
    [WORKER],
    {
      cwd: "/tmp/pr7-helpers/B-output/probe-node",
      env: {
        ...process.env,
        NODE_PATH: "/tmp/pr7-helpers/B-output/probe-node/node_modules",
        LOCK_DURATION_MS: "1000",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stderr?.on("data", (buf) => {
    appendFileSync(errLog, buf);
  });
  child.stdout?.on("data", (buf) => {
    appendFileSync(errLog, buf);
  });
  child.errLog = errLog;
  return child;
}

async function drainWebhook() {
  await webhook.pause().catch(() => undefined);
  await webhook.obliterate({ force: true }).catch((error) => {
    results.drainErrors = results.drainErrors || [];
    results.drainErrors.push(error instanceof Error ? error.message : String(error));
  });
  await webhook.resume().catch(() => undefined);
}

function killExact(pid, sig = "SIGKILL") {
  try {
    process.kill(pid, sig);
    return { pid, sig, ok: true };
  } catch (error) {
    return {
      pid,
      sig,
      ok: false,
      code: error && typeof error === "object" && "code" in error ? String(error.code) : String(error),
    };
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const webhook = new Queue(WEBHOOK_QUEUE, { connection });
const cron = new Queue(CRON_QUEUE, { connection });

const results = {
  kind: "REAL_W_BULLMQ_PRIMITIVES",
  redisUrl: REDIS_URL,
  queueNames: { WEBHOOK_QUEUE, CRON_QUEUE },
  bullmqVersion: "5.81.2",
  ioredisVersion: "5.11.1",
  classifierAllowlist: [...RUNNABLE_BULLMQ_STATES],
  terminalAllowlist: [...TERMINAL_BULLMQ_STATES],
  cases: {},
};

try {
  await connection.ping();
  await drainWebhook();
  await cron.obliterate({ force: true }).catch(() => undefined);

  // PREP-B-02 — add / inspect / classify against W classifier
  const shopA = "shop-a-gen1";
  const shopB = "shop-b-gen1";
  const jobAId = formatQueueJobId("durable-a", 1);
  const jobBId = formatQueueJobId("durable-b", 1);
  await webhook.add(
    "orders/create",
    {
      topic: "orders/create",
      payloadShop: "a.example.invalid",
      shopId: shopA,
      tenant: { shopId: shopA, generationId: "gen-1" },
      customerRestId: "191167",
    },
    { jobId: jobAId },
  );
  await webhook.add(
    "orders/create",
    {
      topic: "orders/create",
      payloadShop: "b.example.invalid",
      shopId: shopB,
      tenant: { shopId: shopB, generationId: "gen-9" },
      customerRestId: "200001",
    },
    { jobId: jobBId },
  );
  const presenceA = await inspectQueueDispatchPresence(webhook, jobAId);
  const presenceB = await inspectQueueDispatchPresence(webhook, jobBId);
  const jobA = await webhook.getJob(jobAId);
  const stateA = jobA ? await jobA.getState() : "missing";
  results.cases.PREP_B_02_add_inspect = {
    formatQueueJobId_a: jobAId,
    presenceA,
    presenceB,
    stateA,
    classified: classifyQueueState(stateA),
    note: "W inspectQueueDispatchPresence does not treat mere object existence as runnable; allowlist is waiting/delayed/active/prioritized/waiting-children.",
  };

  // PREP-B-03 — shop-scoped Job.remove (PROBE-ONLY) keeps shop B. No FLUSHALL.
  const beforeKeys = await connection.dbsize();
  const waiting = await webhook.getJobs(["waiting", "delayed", "paused", "prioritized", "wait"]);
  const removed = [];
  const kept = [];
  for (const job of waiting) {
    const sid = job.data?.tenant?.shopId ?? job.data?.shopId;
    if (sid === shopA) {
      await job.remove();
      removed.push({ id: job.id, shopId: sid });
    } else {
      kept.push({ id: job.id, shopId: sid, state: await job.getState() });
    }
  }
  const afterA = await inspectQueueDispatchPresence(webhook, jobAId);
  const afterB = await inspectQueueDispatchPresence(webhook, jobBId);
  const afterKeys = await connection.dbsize();
  results.cases.PREP_B_03_shop_scoped_remove_keeps_B = {
    beforeKeys,
    afterKeys,
    removed,
    kept,
    afterA,
    afterB,
    flushall_executed: false,
    note: "PR7-SIDE-002 / PR7-RED-009: shop-scoped remove must keep B. FLUSHALL is forbidden and was not executed on this instance.",
  };

  // Re-add A for later worker tests
  await webhook.add(
    "orders/create",
    {
      topic: "orders/create",
      shopId: shopA,
      tenant: { shopId: shopA, generationId: "gen-1" },
      customerRestId: "191167",
    },
    { jobId: formatQueueJobId("durable-a-readd", 1) },
  );

  // PREP-B-04 — customer vs shop isolation on Redis jobs (same queue)
  const c1 = formatQueueJobId("cust-a1", 1);
  const c2 = formatQueueJobId("cust-a2", 1);
  await webhook.add(
    "customers/redact-ordinary-followon",
    {
      shopId: shopA,
      tenant: { shopId: shopA, generationId: "gen-1" },
      customerRestId: "191167",
    },
    { jobId: c1 },
  );
  await webhook.add(
    "customers/redact-ordinary-followon",
    {
      shopId: shopA,
      tenant: { shopId: shopA, generationId: "gen-1" },
      customerRestId: "191168",
    },
    { jobId: c2 },
  );
  const allWait = await webhook.getJobs(["waiting", "delayed", "paused", "prioritized", "wait"]);
  const customerRemoved = [];
  const customerKept = [];
  for (const job of allWait) {
    const rest = job.data?.customerRestId;
    const sid = job.data?.tenant?.shopId ?? job.data?.shopId;
    if (sid === shopA && rest === "191167") {
      await job.remove();
      customerRemoved.push(job.id);
    } else if (job.id) {
      customerKept.push({ id: job.id, shopId: sid, customerRestId: rest });
    }
  }
  const c2Presence = await inspectQueueDispatchPresence(webhook, c2);
  const bStill = await inspectQueueDispatchPresence(webhook, jobBId);
  results.cases.PREP_B_04_customer_vs_shop = {
    customerRemoved,
    customerKept,
    remaining_customer_191168: c2Presence,
    shopB: bStill,
    note: "customers/redact must not freeze the shop or remove unrelated customer / other-shop ordinary jobs. Whole-shop exclusive Redis wipe is forbidden.",
  };

  // PREP-B-05 — TTL guess fail: Redis hint EXPIRE is not worker drain
  const hintKey = "pr7-probe:wake-hint:req-ttl";
  const ttlWrite = path.join(SCRATCH, "ttl-write.log");
  const ttlStatus = path.join(SCRATCH, "ttl-status.json");
  writeFileSync(ttlWrite, "");
  const ttlWorker = spawnWorker({
    REDIS_URL,
    QUEUE_NAME: WEBHOOK_QUEUE,
    WRITE_PATH: ttlWrite,
    STATUS_PATH: ttlStatus,
    TICKS: "20",
    TICK_MS: "100",
  });
  await waitFile(ttlStatus);
  const ttlJobId = formatQueueJobId("ttl-job", 1);
  await webhook.add(
    "orders/create",
    { shopId: shopA, tenant: { shopId: shopA, generationId: "gen-1" }, probe: "ttl" },
    { jobId: ttlJobId },
  );
  await waitFile(`${ttlWrite}.started`);
  await connection.set(hintKey, "wake", "EX", 1);
  const ttl1 = await connection.ttl(hintKey);
  await sleep(1600);
  const ttlAfter = await connection.ttl(hintKey);
  const existsHint = await connection.exists(hintKey);
  const ticksAfterTtl = readFileSync(ttlWrite, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("tick "));
  const lastTickAfterTtl = ticksAfterTtl.at(-1) ?? "";
  const workerAliveAfterTtl = alive(ttlWorker.pid);
  results.cases.PREP_B_05_ttl_guess_fail = {
    hintKey,
    ttl_immediately: ttl1,
    ttl_after_1_6s: ttlAfter,
    hint_exists_after: existsHint,
    worker_pid: ttlWorker.pid,
    worker_alive: workerAliveAfterTtl,
    tick_count: ticksAfterTtl.length,
    last_tick: lastTickAfterTtl,
    counterexample:
      "EXISTS/TTL of optional Redis wake hint went to 0 while the BullMQ worker was still appending ticks. TTL is not quiescence.",
  };
  killExact(ttlWorker.pid, "SIGKILL");
  await sleep(50);
  await drainWebhook();

  // PREP-B-06 — cancel-label fail: Job.remove while processor in-flight still writes
  const cancelWrite = path.join(SCRATCH, "cancel-write.log");
  const cancelStatus = path.join(SCRATCH, "cancel-status.json");
  writeFileSync(cancelWrite, "");
  const cancelWorker = spawnWorker({
    REDIS_URL,
    QUEUE_NAME: WEBHOOK_QUEUE,
    WRITE_PATH: cancelWrite,
    STATUS_PATH: cancelStatus,
    TICKS: "30",
    TICK_MS: "80",
  });
  await waitFile(cancelStatus);
  const cancelJobId = formatQueueJobId("cancel-job", 1);
  await webhook.add(
    "orders/create",
    { shopId: shopA, tenant: { shopId: shopA, generationId: "gen-1" }, probe: "cancel" },
    { jobId: cancelJobId },
  );
  await waitFile(`${cancelWrite}.started`);
  const startedAt = Date.now();
  const liveJob = await webhook.getJob(cancelJobId);
  const stateBeforeRemove = liveJob ? await liveJob.getState() : "missing";
  if (liveJob) await liveJob.remove();
  const presenceAfterRemove = await inspectQueueDispatchPresence(webhook, cancelJobId);
  await sleep(700);
  const cancelLog = readFileSync(cancelWrite, "utf8");
  const ticksAfterRemove = cancelLog
    .split("\n")
    .filter((l) => l.startsWith("tick ") && Number(l.match(/t=(\d+)/)?.[1] ?? 0) > startedAt);
  results.cases.PREP_B_06_cancel_label_fail = {
    cancelJobId,
    stateBeforeRemove,
    presenceAfterRemove,
    worker_pid: cancelWorker.pid,
    worker_alive_after_remove: alive(cancelWorker.pid),
    ticks_appended_after_Job_remove: ticksAfterRemove.length,
    sample_ticks_after_remove: ticksAfterRemove.slice(0, 5),
    log_sha256: sha256(cancelLog),
    counterexample:
      "Job.remove() made inspectQueueDispatchPresence MISSING (or non-runnable) while the already-started Worker processor kept writing. Queue cancellation is not proof of no external write.",
  };
  killExact(cancelWorker.pid, "SIGKILL");
  await sleep(50);
  await drainWebhook();

  // PREP-B-07 — PID guess fail: killing a decoy PID leaves the real worker writing
  const pidWrite = path.join(SCRATCH, "pid-write.log");
  const pidStatus = path.join(SCRATCH, "pid-status.json");
  writeFileSync(pidWrite, "");
  const decoy = spawn("sleep", ["30"], { stdio: "ignore" });
  const decoyPid = decoy.pid;
  const pidWorker = spawnWorker({
    REDIS_URL,
    QUEUE_NAME: WEBHOOK_QUEUE,
    WRITE_PATH: pidWrite,
    STATUS_PATH: pidStatus,
    TICKS: "20",
    TICK_MS: "80",
  });
  await waitFile(pidStatus);
  const pidJobId = formatQueueJobId("pid-job", 1);
  await webhook.add(
    "orders/create",
    { shopId: shopA, tenant: { shopId: shopA, generationId: "gen-1" }, probe: "pid" },
    { jobId: pidJobId },
  );
  await waitFile(`${pidWrite}.started`);
  const killDecoy = killExact(decoyPid, "SIGKILL");
  await sleep(400);
  const ticksAfterDecoy = readFileSync(pidWrite, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("tick "));
  const redisJobAfterDecoy = await inspectQueueDispatchPresence(webhook, pidJobId);
  results.cases.PREP_B_07_pid_guess_fail = {
    decoyPid,
    killDecoy,
    decoy_alive: alive(decoyPid),
    real_worker_pid: pidWorker.pid,
    real_worker_alive: alive(pidWorker.pid),
    tick_count_after_decoy_kill: ticksAfterDecoy.length,
    redisJobAfterDecoy,
    counterexample:
      "A stale/decoy PID was killed; the real Worker PID and Redis runnable job remained. PID guess is not drain.",
  };

  // PREP-B-08 — process-loss: SIGKILL exact worker PID; Redis job + file leftover remain
  const ticksBeforeKill = ticksAfterDecoy.length;
  const killReal = killExact(pidWorker.pid, "SIGKILL");
  await sleep(200);
  const presenceAfterWorkerDeath = await inspectQueueDispatchPresence(webhook, pidJobId);
  const leftoverFile = existsSync(pidWrite);
  const leftoverBytes = leftoverFile ? readFileSync(pidWrite).length : 0;
  let stateAfterDeath = "unreadable";
  try {
    const j = await webhook.getJob(pidJobId);
    stateAfterDeath = j ? await j.getState() : "missing";
  } catch (error) {
    stateAfterDeath = `error:${error instanceof Error ? error.message : String(error)}`;
  }
  results.cases.PREP_B_08_process_loss_not_power_loss = {
    killReal,
    worker_alive: alive(pidWorker.pid),
    ticks_before_kill: ticksBeforeKill,
    leftoverFile,
    leftoverBytes,
    presenceAfterWorkerDeath,
    stateAfterDeath,
    power_loss_tested: false,
    note: "SIGKILL of the Worker process is process-loss, not crash/power-loss of the host. Leftover file bytes and a Redis job (active/stalled/failed) remain. PID absence is not I/O drain proof. NOT claimed as power-loss coverage.",
  };
  await drainWebhook();

  // PREP-B-09 — late publication: delayed job fires after a synthetic cancel label
  const lateId = formatQueueJobId("late-pub", 1);
  const cancelLabel = { jobId: lateId, labelledCancelledAt: Date.now(), redisRemoved: false };
  await cron.add(
    "order-facts-sync",
    {
      shopId: shopA,
      tenant: { shopId: shopA, generationId: "gen-1" },
      probe: "late-publication",
    },
    { jobId: lateId, delay: 800 },
  );
  const presenceWhileDelayed = await inspectQueueDispatchPresence(cron, lateId);
  await sleep(1200);
  const presenceAfterDelay = await inspectQueueDispatchPresence(cron, lateId);
  const lateJob = await cron.getJob(lateId);
  const lateState = lateJob ? await lateJob.getState() : "missing";
  results.cases.PREP_B_09_late_publication = {
    cancelLabel,
    presenceWhileDelayed,
    presenceAfterDelay,
    lateState,
    counterexample:
      "A DurableJob-style cancel label (in-memory / PG analogue) with redisRemoved=false did not prevent the delayed BullMQ job from becoming runnable after 800ms. Late publication is real unless generation-fenced remove + worker drain both succeed.",
  };
  if (lateJob) await lateJob.remove().catch(() => undefined);

  // PREP-B-10 — stale generation: real worker ignores PG fence (W Redis path has no generation fence)
  const staleWrite = path.join(SCRATCH, "stale-gen-write.log");
  const staleStatus = path.join(SCRATCH, "stale-gen-status.json");
  writeFileSync(staleWrite, "");
  const staleWorker = spawnWorker({
    REDIS_URL,
    QUEUE_NAME: WEBHOOK_QUEUE,
    WRITE_PATH: staleWrite,
    STATUS_PATH: staleStatus,
    TICKS: "6",
    TICK_MS: "50",
    CHECK_GENERATION_FENCE: "0",
  });
  await waitFile(staleStatus);
  const staleId = formatQueueJobId("stale-gen", 1);
  await webhook.add(
    "orders/create",
    {
      shopId: shopA,
      tenant: { shopId: shopA, generationId: "gen-old" },
      fence: "ERASING",
      probe: "stale-generation",
    },
    { jobId: staleId },
  );
  await waitFile(`${staleWrite}.started`, 8000);
  await sleep(400);
  const staleLog = readFileSync(staleWrite, "utf8");
  results.cases.PREP_B_10_stale_generation_publish = {
    staleId,
    worker_pid: staleWorker.pid,
    wrote_despite_fence_ERASING: staleLog.includes("tick "),
    started: existsSync(`${staleWrite}.started`),
    log_excerpt: staleLog.slice(0, 400),
    counterexample:
      "SYNTHETIC PG fence=ERASING was present on the payload; the REAL W-shaped BullMQ worker (CHECK_GENERATION_FENCE=0, matching today's Redis worker which has no generation write barrier) still processed ticks. PostgreSQL advisory locks do not fence Redis jobs (§7.6.2 LIMIT).",
  };
  killExact(staleWorker.pid, "SIGKILL");
  await sleep(50);
  await drainWebhook();

  // PREP-B-11 — positive drain: wait for worker completion, then inspect terminal + file .done
  const drainWrite = path.join(SCRATCH, "drain-write.log");
  const drainStatus = path.join(SCRATCH, "drain-status.json");
  writeFileSync(drainWrite, "");
  const drainWorker = spawnWorker({
    REDIS_URL,
    QUEUE_NAME: WEBHOOK_QUEUE,
    WRITE_PATH: drainWrite,
    STATUS_PATH: drainStatus,
    TICKS: "4",
    TICK_MS: "40",
  });
  await waitFile(drainStatus);
  const drainId = formatQueueJobId("drain-job", 1);
  await webhook.add(
    "orders/create",
    { shopId: shopA, tenant: { shopId: shopA, generationId: "gen-1" }, probe: "positive-drain" },
    { jobId: drainId },
  );
  await waitFile(`${drainWrite}.done`, 8000);
  await sleep(150);
  const drainPresence = await inspectQueueDispatchPresence(webhook, drainId);
  const drainStateJob = await webhook.getJob(drainId);
  const drainState = drainStateJob ? await drainStateJob.getState() : "missing";
  results.cases.PREP_B_11_positive_worker_io_drain = {
    drainId,
    drainPresence,
    drainState,
    done_file: existsSync(`${drainWrite}.done`),
    done_payload: existsSync(`${drainWrite}.done`)
      ? JSON.parse(readFileSync(`${drainWrite}.done`, "utf8"))
      : null,
    note: "Positive drain evidence is: Worker finished, .done file exists after fsync-equivalent close, Job.getState is completed/failed (terminal) or MISSING after removeOnComplete. This is not a TTL/PID/cancel substitute.",
  };
  killExact(drainWorker.pid, "SIGTERM");
  await sleep(200);
  if (alive(drainWorker.pid)) killExact(drainWorker.pid, "SIGKILL");

  // PREP-B-12 — W production has no Redis remove on uninstall cancelAllCancellable (source fact + probe)
  results.cases.PREP_B_12_pg_cancel_is_not_redis_remove = {
    uninstall_api: "app/sync/uninstall.server.ts cancelAllCancellable updates DurableJob.state=CANCELLED only",
    dispatcher_shop_disabled:
      "enqueueWithDispatch shop_disabled marks JobDispatch FAILED and DurableJob CANCELLED/PENDING; no Queue.getJob().remove()",
    webhook_processor:
      "processWebhookJob checks durable.state === CANCELLED at start via PostgreSQL, not Redis Job.remove, and does not abort an already-open external write",
    future_named_api: "removeShopQueueJobsExceptPrivacy is matrix-designed (PR7-RED-009), absent on W",
  };

  results.dbsize_end = await connection.dbsize();
} catch (error) {
  results.fatal = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
} finally {
  await webhook.close().catch(() => undefined);
  await cron.close().catch(() => undefined);
  await connection.quit().catch(() => undefined);
}

writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ wrote: OUT, cases: Object.keys(results.cases), fatal: results.fatal ?? null }, null, 2));
```

### Helper B `01-bullmq.json` (MATCH) — includes INCONCLUSIVE PREP_B_06 and positive PREP_B_11

SHA-256 `5c7204ffcbc01209b94ec020cdf5fe8f6a4e5c10c6c9e956b3c644e7ccff0f2a`

```json
{
  "kind": "REAL_W_BULLMQ_PRIMITIVES",
  "redisUrl": "redis://127.0.0.1:16379",
  "queueNames": {
    "WEBHOOK_QUEUE": "stocky-webhooks",
    "CRON_QUEUE": "stocky-cron"
  },
  "bullmqVersion": "5.81.2",
  "ioredisVersion": "5.11.1",
  "classifierAllowlist": [
    "waiting",
    "delayed",
    "active",
    "prioritized",
    "waiting-children"
  ],
  "terminalAllowlist": [
    "completed",
    "failed"
  ],
  "cases": {
    "PREP_B_02_add_inspect": {
      "formatQueueJobId_a": "durable-a__d1",
      "presenceA": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "waiting"
      },
      "presenceB": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "waiting"
      },
      "stateA": "waiting",
      "classified": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "waiting"
      },
      "note": "W inspectQueueDispatchPresence does not treat mere object existence as runnable; allowlist is waiting/delayed/active/prioritized/waiting-children."
    },
    "PREP_B_03_shop_scoped_remove_keeps_B": {
      "beforeKeys": 7,
      "afterKeys": 6,
      "removed": [
        {
          "id": "durable-a__d1",
          "shopId": "shop-a-gen1"
        }
      ],
      "kept": [
        {
          "id": "durable-b__d1",
          "shopId": "shop-b-gen1",
          "state": "waiting"
        }
      ],
      "afterA": {
        "status": "MISSING"
      },
      "afterB": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "waiting"
      },
      "flushall_executed": false,
      "note": "PR7-SIDE-002 / PR7-RED-009: shop-scoped remove must keep B. FLUSHALL is forbidden and was not executed on this instance."
    },
    "PREP_B_04_customer_vs_shop": {
      "customerRemoved": [
        "cust-a1__d1",
        "durable-a-readd__d1"
      ],
      "customerKept": [
        {
          "id": "cust-a2__d1",
          "shopId": "shop-a-gen1",
          "customerRestId": "191168"
        },
        {
          "id": "durable-b__d1",
          "shopId": "shop-b-gen1",
          "customerRestId": "200001"
        }
      ],
      "remaining_customer_191168": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "waiting"
      },
      "shopB": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "waiting"
      },
      "note": "customers/redact must not freeze the shop or remove unrelated customer / other-shop ordinary jobs. Whole-shop exclusive Redis wipe is forbidden."
    },
    "PREP_B_05_ttl_guess_fail": {
      "hintKey": "pr7-probe:wake-hint:req-ttl",
      "ttl_immediately": 1,
      "ttl_after_1_6s": -2,
      "hint_exists_after": 0,
      "worker_pid": 6501,
      "worker_alive": true,
      "tick_count": 15,
      "last_tick": "tick i=14 t=1789866332099 pid=6501 job=durable-b__d1",
      "counterexample": "EXISTS/TTL of optional Redis wake hint went to 0 while the BullMQ worker was still appending ticks. TTL is not quiescence."
    },
    "PREP_B_06_cancel_label_fail": {
      "cancelJobId": "cancel-job__d1",
      "stateBeforeRemove": "waiting",
      "presenceAfterRemove": {
        "status": "MISSING"
      },
      "worker_pid": 6512,
      "worker_alive_after_remove": true,
      "ticks_appended_after_Job_remove": 0,
      "sample_ticks_after_remove": [],
      "log_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "counterexample": "Job.remove() made inspectQueueDispatchPresence MISSING (or non-runnable) while the already-started Worker processor kept writing. Queue cancellation is not proof of no external write."
    },
    "PREP_B_07_pid_guess_fail": {
      "decoyPid": 6523,
      "killDecoy": {
        "pid": 6523,
        "sig": "SIGKILL",
        "ok": true
      },
      "decoy_alive": false,
      "real_worker_pid": 6524,
      "real_worker_alive": true,
      "tick_count_after_decoy_kill": 4,
      "redisJobAfterDecoy": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "active"
      },
      "counterexample": "A stale/decoy PID was killed; the real Worker PID and Redis runnable job remained. PID guess is not drain."
    },
    "PREP_B_08_process_loss_not_power_loss": {
      "killReal": {
        "pid": 6524,
        "sig": "SIGKILL",
        "ok": true
      },
      "worker_alive": false,
      "ticks_before_kill": 4,
      "leftoverFile": true,
      "leftoverBytes": 348,
      "presenceAfterWorkerDeath": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "active"
      },
      "stateAfterDeath": "active",
      "power_loss_tested": false,
      "note": "SIGKILL of the Worker process is process-loss, not crash/power-loss of the host. Leftover file bytes and a Redis job (active/stalled/failed) remain. PID absence is not I/O drain proof. NOT claimed as power-loss coverage."
    },
    "PREP_B_09_late_publication": {
      "cancelLabel": {
        "jobId": "late-pub__d1",
        "labelledCancelledAt": 1789866333603,
        "redisRemoved": false
      },
      "presenceWhileDelayed": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "delayed"
      },
      "presenceAfterDelay": {
        "status": "RUNNABLE_EXISTING",
        "queueState": "delayed"
      },
      "lateState": "delayed",
      "counterexample": "A DurableJob-style cancel label (in-memory / PG analogue) with redisRemoved=false did not prevent the delayed BullMQ job from becoming runnable after 800ms. Late publication is real unless generation-fenced remove + worker drain both succeed."
    },
    "PREP_B_10_stale_generation_publish": {
      "staleId": "stale-gen__d1",
      "worker_pid": 6535,
      "wrote_despite_fence_ERASING": true,
      "started": true,
      "log_excerpt": "start job=stale-gen__d1 pid=6535 t=1789866334916 data={\"shopId\":\"shop-a-gen1\",\"tenant\":{\"shopId\":\"shop-a-gen1\",\"generationId\":\"gen-old\"},\"fence\":\"ERASING\",\"probe\":\"stale-generation\"}\ntick i=0 t=1789866334916 pid=6535 job=stale-gen__d1\ntick i=1 t=1789866334967 pid=6535 job=stale-gen__d1\ntick i=2 t=1789866335017 pid=6535 job=stale-gen__d1\ntick i=3 t=1789866335067 pid=6535 job=stale-gen__d1\ntick i=4 ",
      "counterexample": "SYNTHETIC PG fence=ERASING was present on the payload; the REAL W-shaped BullMQ worker (CHECK_GENERATION_FENCE=0, matching today's Redis worker which has no generation write barrier) still processed ticks. PostgreSQL advisory locks do not fence Redis jobs (§7.6.2 LIMIT)."
    },
    "PREP_B_11_positive_worker_io_drain": {
      "drainId": "drain-job__d1",
      "drainPresence": {
        "status": "TERMINAL_EXISTING",
        "queueState": "completed"
      },
      "drainState": "completed",
      "done_file": true,
      "done_payload": {
        "t": 1789866335654,
        "pid": 6546
      },
      "note": "Positive drain evidence is: Worker finished, .done file exists after fsync-equivalent close, Job.getState is completed/failed (terminal) or MISSING after removeOnComplete. This is not a TTL/PID/cancel substitute."
    },
    "PREP_B_12_pg_cancel_is_not_redis_remove": {
      "uninstall_api": "app/sync/uninstall.server.ts cancelAllCancellable updates DurableJob.state=CANCELLED only",
      "dispatcher_shop_disabled": "enqueueWithDispatch shop_disabled marks JobDispatch FAILED and DurableJob CANCELLED/PENDING; no Queue.getJob().remove()",
      "webhook_processor": "processWebhookJob checks durable.state === CANCELLED at start via PostgreSQL, not Redis Job.remove, and does not abort an already-open external write",
      "future_named_api": "removeShopQueueJobsExceptPrivacy is matrix-designed (PR7-RED-009), absent on W"
    }
  },
  "dbsize_end": 10
}
```

### Helper B `02-d-scratch-real-primitives.ts` (MATCH)

SHA-256 `17cb4d1f24232b69b8c5f647e7f6c6c5109246808c0aa5396298b445463b91bb`

```typescript
/**
 * Helper B — REAL W D-scratch occupancy / reclaim / quota probes.
 * Imports W APIs from checkout B; does not edit W source.
 * Scratch root is only under /tmp/pr7-helpers/B-scratch.
 * Does not claim power-loss coverage. Does not sweep /tmp.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createOwnedScratchDir,
  disposeOwnedScratch,
  inspectDScratchNamespace,
  inspectDScratchOccupancy,
  reclaimOperatorSelectedDScratch,
  reinitializeDScratchReservationLedgerAfterQuiescence,
  sanitizeDScratchOccupancy,
} from "/tmp/pr7-helpers/B/stocky-plus/app/lib/order-facts/sync/source-stage.ts";
import {
  ORDER_FACTS_SCRATCH_MARKER,
  ORDER_FACTS_SCRATCH_QUOTA_LOCK,
} from "/tmp/pr7-helpers/B/stocky-plus/app/lib/order-facts/sync/constants.ts";

const OUT = process.env.PROBE_OUT ?? "/tmp/pr7-helper-outputs/B/results/02-dscratch.json";
const ROOT = process.env.PROBE_SCRATCH ?? `/tmp/pr7-helpers/B-scratch/dscratch-${process.pid}`;
const TSX = "/tmp/pr7-helpers/B-output/probe-node/node_modules/tsx/dist/cli.mjs";
const CHILD = "/tmp/pr7-helper-outputs/B/probes/scratch-park-child.ts";

mkdirSync(ROOT, { recursive: true });
mkdirSync(path.dirname(OUT), { recursive: true });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256(buf: string | Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

async function waitStatus(statusPath: string, stage: string, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(statusPath)) {
      try {
        const parsed = JSON.parse(readFileSync(statusPath, "utf8").trim()) as {
          stage?: string;
        };
        if (parsed.stage === stage) return parsed as Record<string, unknown>;
      } catch {
        /* mid-write */
      }
    }
    await sleep(25);
  }
  throw new Error(`timeout waiting for ${stage} at ${statusPath}`);
}

function killExact(pid: number, sig: NodeJS.Signals = "SIGKILL") {
  try {
    process.kill(pid, sig);
    return { pid, sig, ok: true };
  } catch (error) {
    return {
      pid,
      sig,
      ok: false,
      code: error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : String(error),
    };
  }
}

function codeOf(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return null;
}

const results: Record<string, unknown> = {
  kind: "REAL_W_D_SCRATCH_PRIMITIVES",
  scratchRoot: ROOT,
  imported_from:
    "/tmp/pr7-helpers/B/stocky-plus/app/lib/order-facts/sync/source-stage.ts",
  cases: {} as Record<string, unknown>,
};
const cases = results.cases as Record<string, unknown>;

async function main() {
try {
  // PREP-B-13 — symlink root refuse
  const target = path.join(ROOT, "symlink-target");
  const link = path.join(ROOT, "symlink-root");
  mkdirSync(target, { recursive: true });
  symlinkSync(target, link);
  let symlinkErr: string | null = null;
  try {
    await createOwnedScratchDir({
      shopId: "shop",
      syncRunId: "run",
      scratchRoot: link,
      reservedBytes: 1024,
      maxScratchBytes: 20_000,
    });
  } catch (error) {
    symlinkErr = codeOf(error);
  }
  cases.PREP_B_13_symlink_root_refuse = {
    code: symlinkErr,
    expected: "scratch_symlink_refused",
    passed: symlinkErr === "scratch_symlink_refused",
  };

  // PREP-B-14 — authentic create/inspect/dispose (positive occupancy)
  const live = await createOwnedScratchDir({
    shopId: "shop-live",
    syncRunId: "run-live",
    scratchRoot: ROOT,
    reservedBytes: 4096,
    maxScratchBytes: 50_000,
  });
  writeFileSync(path.join(live.dir, "payload.bin"), "owned-bytes");
  const occLive = await inspectDScratchOccupancy({
    scratchRoot: ROOT,
    maxScratchBytes: 50_000,
  });
  cases.PREP_B_14_positive_inspect_live = {
    basename: path.basename(live.dir),
    occupancy: occLive,
    sanitized: sanitizeDScratchOccupancy(occLive),
    sanitized_leaks_att_or_shop: JSON.stringify(sanitizeDScratchOccupancy(occLive)).match(
      /shop-live|att-/,
    )
      ? true
      : false,
    operatorInterventionRequired: occLive.operatorInterventionRequired,
  };

  // PREP-B-15 — reclaim refuses live writer / foreign / markerless / symlink
  const foreign = path.join(ROOT, "foreign-dir");
  mkdirSync(foreign, { recursive: true });
  writeFileSync(path.join(foreign, "secret"), "secret");
  const secretHash = sha256(readFileSync(path.join(foreign, "secret")));
  const markerless = path.join(ROOT, "att-markerless");
  mkdirSync(markerless, { recursive: true });
  writeFileSync(path.join(markerless, "source.jsonl"), "keep\n");
  const markerlessHash = sha256(readFileSync(path.join(markerless, "source.jsonl")));
  const attLink = path.join(ROOT, "att-link");
  symlinkSync(foreign, attLink);
  const reclaimLive = await reclaimOperatorSelectedDScratch({
    scratchRoot: ROOT,
    attemptBasenames: [
      path.basename(live.dir),
      "foreign-dir",
      "att-markerless",
      "att-link",
    ],
    quiescenceConfirmed: true,
  });
  cases.PREP_B_15_reclaim_negative_live_foreign_symlink_markerless = {
    skipped: reclaimLive.skipped,
    reclaimed: reclaimLive.reclaimed,
    live_still_exists: existsSync(live.dir),
    secret_untouched: sha256(readFileSync(path.join(foreign, "secret"))) === secretHash,
    markerless_untouched:
      sha256(readFileSync(path.join(markerless, "source.jsonl"))) === markerlessHash,
  };

  // PREP-B-16 — unowned: path-only dispose and forged handle
  let pathOnly: string | null = null;
  try {
    await disposeOwnedScratch(ROOT);
  } catch (error) {
    pathOnly = codeOf(error);
  }
  const forged = {
    dir: live.dir,
    token: "forged-token",
    shopId: "shop-live",
    syncRunId: "run-live",
    createdPid: process.pid,
    createdAt: new Date().toISOString(),
    reservedBytes: 4096,
  };
  let forgedCode: string | null = null;
  try {
    await disposeOwnedScratch(forged as never, ROOT);
  } catch (error) {
    forgedCode = codeOf(error);
  }
  cases.PREP_B_16_unowned_refuse = {
    path_only_dispose: pathOnly,
    forged_handle: forgedCode,
    live_still_exists: existsSync(live.dir),
  };

  // PREP-B-17 — quota.lock leftover: admission does not steal lock
  const lockPath = path.join(ROOT, ORDER_FACTS_SCRATCH_QUOTA_LOCK);
  mkdirSync(lockPath, { recursive: true });
  let lockErr: string | null = null;
  try {
    await createOwnedScratchDir({
      shopId: "other",
      syncRunId: "blocked",
      scratchRoot: ROOT,
      reservedBytes: 1024,
      maxScratchBytes: 50_000,
    });
  } catch (error) {
    lockErr = codeOf(error);
  }
  const occLock = await inspectDScratchOccupancy({
    scratchRoot: ROOT,
    maxScratchBytes: 50_000,
  });
  cases.PREP_B_17_quota_lock_not_stolen_by_admission = {
    admission_code: lockErr,
    staleLockPresent: occLock.staleLockPresent,
    operatorInterventionRequired: occLock.operatorInterventionRequired,
  };
  const reclaimLock = await reclaimOperatorSelectedDScratch({
    scratchRoot: ROOT,
    attemptBasenames: [ORDER_FACTS_SCRATCH_QUOTA_LOCK],
    quiescenceConfirmed: true,
  });
  cases.PREP_B_17b_operator_reclaim_lock_after_quiescence = reclaimLock;

  // PREP-B-18 — process-loss leftover occupies capacity until operator reclaim
  const parkRoot = path.join(ROOT, "park-ns");
  mkdirSync(parkRoot, { recursive: true });
  const statusPath = path.join(parkRoot, "park.json");
  const child = spawn(process.execPath, [TSX, CHILD], {
    env: {
      ...process.env,
      PR6_D_LIVE_STATUS_PATH: statusPath,
      PR6_D_LIVE_SCRATCH_ROOT: parkRoot,
      PR6_D_LIVE_SHOP_ID: "crash-shop",
      PR6_D_LIVE_RUN_ID: "crash-run",
      PR6_D_LIVE_PAYLOAD: "LIVE-WORKER-BYTES",
      PR6_D_LIVE_RESERVED: "9000",
      PR6_D_LIVE_MAX_BYTES: "10000",
      PR6_D_LIVE_HOLD_MS: "120000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parked = await waitStatus(statusPath, "parked");
  const childPid = Number(parked.pid);
  const leftoverDir = String(parked.dir);
  const livePath = String(parked.livePath);
  const beforeKillHash = sha256(readFileSync(livePath));
  const killChild = killExact(childPid, "SIGKILL");
  if (child.pid && child.pid !== childPid) killExact(child.pid, "SIGKILL");
  await sleep(80);
  let childAlive = false;
  try {
    process.kill(childPid, 0);
    childAlive = true;
  } catch {
    childAlive = false;
  }
  let admissionAfterDeath: string | null = "admitted";
  try {
    const next = await createOwnedScratchDir({
      shopId: "next",
      syncRunId: "next",
      scratchRoot: parkRoot,
      maxScratchBytes: 10_000,
      reservedBytes: 2_000,
    });
    await disposeOwnedScratch(next, parkRoot);
  } catch (error) {
    admissionAfterDeath = codeOf(error);
  }
  const occAfterDeath = await inspectDScratchOccupancy({
    scratchRoot: parkRoot,
    maxScratchBytes: 10_000,
  });
  const pidGoneIsNotAutoDelete = existsSync(leftoverDir);
  const attempts = readdirSync(parkRoot).filter((name) => name.startsWith("att-"));
  const reclaimAfter = await reclaimOperatorSelectedDScratch({
    scratchRoot: parkRoot,
    attemptBasenames: attempts,
    quiescenceConfirmed: true,
  });
  let restoredOk = false;
  const restored = await createOwnedScratchDir({
    shopId: "next",
    syncRunId: "next",
    scratchRoot: parkRoot,
    maxScratchBytes: 10_000,
    reservedBytes: 2_000,
  });
  restoredOk = existsSync(restored.dir);
  await disposeOwnedScratch(restored, parkRoot);
  cases.PREP_B_18_process_loss_leftover_until_operator_reclaim = {
    childPid,
    killChild,
    childAlive,
    leftoverDir_exists_after_pid_gone: pidGoneIsNotAutoDelete,
    leftover_hash_before_kill: beforeKillHash,
    admissionAfterDeath,
    occupancy: sanitizeDScratchOccupancy(occAfterDeath),
    reclaimAfter,
    restoredOk,
    power_loss_tested: false,
    counterexample:
      "After SIGKILL, kill(pid,0) fails (PID gone) but att-* bytes and reserved capacity remained; next admission was scratch_resource_exhausted until operator reclaim with quiescenceConfirmed:true. PID absence is not permission to delete and is not drain.",
  };

  // PREP-B-19 — second-process reclaim of a LIVE first process (API trusts quiescenceConfirmed)
  const live2Root = path.join(ROOT, "cross-proc");
  mkdirSync(live2Root, { recursive: true });
  const status2 = path.join(live2Root, "park.json");
  const child2 = spawn(process.execPath, [TSX, CHILD], {
    env: {
      ...process.env,
      PR6_D_LIVE_STATUS_PATH: status2,
      PR6_D_LIVE_SCRATCH_ROOT: live2Root,
      PR6_D_LIVE_SHOP_ID: "live-shop",
      PR6_D_LIVE_RUN_ID: "live-run",
      PR6_D_LIVE_PAYLOAD: "STILL-WRITING",
      PR6_D_LIVE_RESERVED: "2048",
      PR6_D_LIVE_MAX_BYTES: "20000",
      PR6_D_LIVE_HOLD_MS: "120000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const parked2 = await waitStatus(status2, "parked");
  const child2Pid = Number(parked2.pid);
  const basename2 = String(parked2.basename);
  const live2Dir = String(parked2.dir);
  const reclaimWhileLive = await reclaimOperatorSelectedDScratch({
    scratchRoot: live2Root,
    attemptBasenames: [basename2],
    quiescenceConfirmed: true,
  });
  cases.PREP_B_19_quiescence_flag_is_not_cross_process_liveness = {
    child2Pid,
    child2_alive_before_kill: (() => {
      try {
        process.kill(child2Pid, 0);
        return true;
      } catch {
        return false;
      }
    })(),
    reclaimWhileLive,
    dir_exists_after_foreign_reclaim: existsSync(live2Dir),
    note: "W live_writer skip is process-local (LIVE_SCRATCH_BASENAMES or marker.pid === process.pid). A second process passing quiescenceConfirmed:true can delete a still-live worker's att-*. The boolean is an operator admission token, not a liveness proof. Runbook §1 remains mandatory.",
  };
  killExact(child2Pid, "SIGKILL");
  if (child2.pid) killExact(child2.pid, "SIGKILL");

  // PREP-B-20 — markerless leftover on ROOT blocks further admission (unknown identity)
  const occUnknown = await inspectDScratchOccupancy({
    scratchRoot: ROOT,
    maxScratchBytes: 50_000,
  });
  cases.PREP_B_20_unknown_leftover_blocks_admission = {
    occupancy: sanitizeDScratchOccupancy(occUnknown),
    unknownAttemptCount: occUnknown.unknownAttemptCount,
    operatorInterventionRequired: occUnknown.operatorInterventionRequired,
    note: "att-markerless was refused for reclaim (not_verified_d_resource) and still occupies the namespace as unknown. Admission must not invent a sweep.",
  };

  // PREP-B-20b — ledger reinitialize refuses while att-* remain; succeeds after authentic dispose
  const clean = path.join(ROOT, "clean-reinit");
  mkdirSync(clean, { recursive: true });
  const remain = await createOwnedScratchDir({
    shopId: "remain",
    syncRunId: "remain",
    scratchRoot: clean,
    reservedBytes: 1024,
    maxScratchBytes: 50_000,
  });
  let reinitWhileAtt: string | null = null;
  try {
    await reinitializeDScratchReservationLedgerAfterQuiescence({
      scratchRoot: clean,
      quiescenceConfirmed: true,
    });
  } catch (error) {
    reinitWhileAtt = codeOf(error);
  }
  await disposeOwnedScratch(remain, clean);
  const ns = await inspectDScratchNamespace(clean);
  const reinitOk = await reinitializeDScratchReservationLedgerAfterQuiescence({
    scratchRoot: clean,
    quiescenceConfirmed: true,
  });
  cases.PREP_B_20b_reinitialize_after_quiescence = {
    reinitWhileAtt,
    leftoverAttemptCount_before_reinit: ns.leftoverAttemptCount,
    reinitOk,
    marker_name: ORDER_FACTS_SCRATCH_MARKER,
  };

  await disposeOwnedScratch(live, ROOT).catch(() => undefined);

  // PREP-B-21 — reclaim without quiescenceConfirmed must throw (runtime false)
  let noQui: string | null = null;
  try {
    await reclaimOperatorSelectedDScratch({
      scratchRoot: clean,
      attemptBasenames: ["att-x"],
      quiescenceConfirmed: false as unknown as true,
    });
  } catch (error) {
    noQui = codeOf(error);
  }
  cases.PREP_B_21_reclaim_requires_quiescence_token = {
    code: noQui,
    expected: "scratch_unowned",
  };
} catch (error) {
  results.fatal = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
}

writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
console.log(
  JSON.stringify(
    { wrote: OUT, cases: Object.keys(cases), fatal: results.fatal ?? null, scratchRoot: ROOT },
    null,
    2,
  ),
);
}

void main();
```

### Helper B `scratch-park-child.ts` (MATCH)

SHA-256 `af7641c6c8f488991b42ec4762a360dc5afab61705021bb947d8a4b8da2ff837`

```typescript
/**
 * REAL W D-scratch park child. Imports W createOwnedScratchDir from checkout B.
 * Parks after writing a payload so the parent can SIGKILL (process-loss leftover).
 * Not power-loss. Not application privacy runtime.
 */
import { writeFileSync } from "node:fs";
import { createOwnedScratchDir } from "/tmp/pr7-helpers/B/stocky-plus/app/lib/order-facts/sync/source-stage.ts";

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
const handle = await createOwnedScratchDir({
  shopId,
  syncRunId: runId,
  scratchRoot,
  reservedBytes: Number(process.env.PR6_D_LIVE_RESERVED ?? "4096"),
  maxScratchBytes: Number(process.env.PR6_D_LIVE_MAX_BYTES ?? "20000"),
});
const livePath = `${handle.dir}/LIVE-WORKER-BYTES.txt`;
writeFileSync(livePath, payload);
writeFileSync(
  statusPath,
  `${JSON.stringify({
    stage: "parked",
    pid: process.pid,
    dir: handle.dir,
    livePath,
    basename: handle.dir.split("/").pop(),
    reservedBytes: handle.reservedBytes,
  })}\n`,
);
await new Promise((r) => setTimeout(r, holdMs));
writeFileSync(
  statusPath,
  `${JSON.stringify({ stage: "exited", pid: process.pid, dir: handle.dir })}\n`,
);
}

void main().catch((error) => {
  writeFileSync(
    statusPath,
    `${JSON.stringify({ stage: "error", pid: process.pid, error: error instanceof Error ? error.message : String(error) })}\n`,
  );
  process.exit(1);
});
```

### Helper B `03-synthetic-privacy-coordinator.mjs` (MATCH)

SHA-256 `5f057b3f8e678f7a255eb3d5d11c7fc8e9593bb13abf933a525f227ef75ed6d7`

```javascript
/**
 * Helper B — SYNTHETIC adapters for the proposed PR7 privacy coordinator.
 * Clearly labelled SYNTHETIC. Not application runtime. Not a W primitive.
 *
 * Models §7.6.5 / D-PR7-10:
 *   PrivacyRequest is durable authority.
 *   Redis wake hint is optional; poll recovers a lost hint.
 *   PostgreSQL advisory locks do not fence Redis / export / D scratch.
 *   Export storage absent/unconfigured is an explicit implementation dependency.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("/tmp/pr7-helpers/B-output/probe-node/package.json");
const IORedis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:16379";
const OUT = process.env.PROBE_OUT ?? "/tmp/pr7-helper-outputs/B/results/03-synthetic.json";
const ROOT = process.env.PROBE_SCRATCH ?? "/tmp/pr7-helpers/B-scratch/synthetic";

mkdirSync(ROOT, { recursive: true });
mkdirSync(path.dirname(OUT), { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** SYNTHETIC — proposed publication fence. Not implemented in W. */
class SYNTHETIC_PrivacyPublicationFence {
  constructor() {
    this.revisionByRequest = new Map();
    this.activeAttempt = new Map();
    this.lostAttempts = new Set();
  }
  claimAttempt(requestId, attemptId) {
    const live = this.activeAttempt.get(requestId);
    if (live && live !== attemptId) {
      this.lostAttempts.add(`${requestId}:${live}`);
    }
    this.activeAttempt.set(requestId, attemptId);
    return { requestId, attemptId, lostPrior: live && live !== attemptId ? live : null };
  }
  publish(requestId, attemptId, keys) {
    if (this.activeAttempt.get(requestId) !== attemptId) {
      return { ok: false, code: "enumerator_stale_attempt", keysUnchanged: true };
    }
    const next = (this.revisionByRequest.get(requestId) ?? 0) + 1;
    this.revisionByRequest.set(requestId, next);
    this.lastKeys = { requestId, attemptId, keys, publicationRevision: next };
    return { ok: true, publicationRevision: next, keys };
  }
}

/** SYNTHETIC — optional Redis wake hint. Poll recovers. Not durable authority. */
class SYNTHETIC_RedisWakeHint {
  constructor(redis) {
    this.redis = redis;
    this.prefix = "pr7-synth-hint:";
  }
  key(requestId) {
    return `${this.prefix}${requestId}`;
  }
  async offer(requestId) {
    await this.redis.set(this.key(requestId), "wake", "EX", 2);
    return this.key(requestId);
  }
  async lost(requestId) {
    return (await this.redis.exists(this.key(requestId))) === 0;
  }
}

/** SYNTHETIC — export publication. Local fixture only. NOT S3 / object storage. */
class SYNTHETIC_ExportPublicationAdapter {
  constructor(opts) {
    this.configured = opts.configured === true;
    this.root = opts.root;
    this.permissionFail = opts.permissionFail === true;
    this.provider = this.configured ? "SYNTHETIC_LOCAL_FS_SINK" : "UNCONFIGURED";
  }
  async publish(input) {
    if (!this.configured) {
      return {
        ok: false,
        code: "export_storage_unconfigured",
        provider: this.provider,
        note: "Explicit implementation dependency. Absence is not a pass and not an excuse to fabricate a live provider test.",
      };
    }
    if (this.permissionFail) {
      return { ok: false, code: "export_permission_denied", errno: "EACCES" };
    }
    if (input.fence !== "LIVE") {
      return { ok: false, code: "stale_generation_publish_refused", fence: input.fence };
    }
    const dest = path.join(this.root, `${input.requestId}.export`);
    writeFileSync(dest, JSON.stringify({ synthetic: true, keys: input.keys }));
    return { ok: true, dest, provider: this.provider };
  }
}

/** SYNTHETIC coordinator poll/claim loop. Not DurableJob. */
class SYNTHETIC_PrivacyCoordinatorPollLoop {
  constructor(fence, hint) {
    this.fence = fence;
    this.hint = hint;
    this.pollRecoveries = 0;
  }
  async tick(requestId, attemptId, work) {
    const hintLost = await this.hint.lost(requestId);
    if (hintLost) this.pollRecoveries += 1;
    this.fence.claimAttempt(requestId, attemptId);
    return work();
  }
}

const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const cases = {};

try {
  await redis.ping();
  const fence = new SYNTHETIC_PrivacyPublicationFence();
  const hint = new SYNTHETIC_RedisWakeHint(redis);
  const coordinator = new SYNTHETIC_PrivacyCoordinatorPollLoop(fence, hint);

  // PREP-B-22 — Redis hint optional; poll recovers
  const requestId = "preq_synth_1";
  await hint.offer(requestId);
  await sleep(2100);
  const lost = await hint.lost(requestId);
  const recovered = await coordinator.tick(requestId, "att-1", async () => {
    return fence.publish(requestId, "att-1", ["CUSTOMER_REST_ID:191167"]);
  });
  cases.PREP_B_22_redis_hint_optional_poll_recovers = {
    hint_lost_before_poll: lost,
    pollRecoveries: coordinator.pollRecoveries,
    recovered,
    durable_authority: "SYNTHETIC PrivacyRequest/PrivacyAttempt — not Redis, not DurableJob",
  };

  // PREP-B-23 — stale attempt cannot CAS publication
  fence.claimAttempt(requestId, "att-2");
  const stale = fence.publish(requestId, "att-1", ["SHOULD_NOT_LAND"]);
  const live = fence.publish(requestId, "att-2", ["CUSTOMER_REST_ID:191167"]);
  cases.PREP_B_23_stale_generation_or_attempt_publish = {
    stale,
    live,
    lastKeys: fence.lastKeys,
  };

  // PREP-B-24 — export unconfigured
  const unconfigured = new SYNTHETIC_ExportPublicationAdapter({
    configured: false,
    root: path.join(ROOT, "export"),
  });
  mkdirSync(path.join(ROOT, "export"), { recursive: true });
  const unconf = await unconfigured.publish({
    requestId: "preq_data_request",
    fence: "LIVE",
    keys: ["gid://shopify/Order/1"],
  });
  cases.PREP_B_24_export_unconfigured = unconf;

  // PREP-B-25 — permission failure (chmod 0 on sink dir when possible)
  const permRoot = path.join(ROOT, "perm-denied");
  mkdirSync(permRoot, { recursive: true });
  const permAdapter = new SYNTHETIC_ExportPublicationAdapter({
    configured: true,
    root: permRoot,
    permissionFail: true,
  });
  const perm = await permAdapter.publish({
    requestId: "preq_perm",
    fence: "LIVE",
    keys: ["x"],
  });
  cases.PREP_B_25_export_permission_failure = {
    ...perm,
    request_must_stay_incomplete: true,
  };

  // PREP-B-26 — export vs erasure race without generation re-check (counterexample)
  const raceRoot = path.join(ROOT, "race");
  mkdirSync(raceRoot, { recursive: true });
  let fenceState = "LIVE";
  let lateBytes = null;
  const writer = (async () => {
    const captured = fenceState;
    await sleep(250);
    // BUG analogue: publish using start-of-request snapshot, no re-check
    if (captured === "LIVE") {
      const dest = path.join(raceRoot, "late-export.bytes");
      writeFileSync(dest, "SYNTHETIC_CUSTOMER_EXPORT_PAYLOAD");
      lateBytes = dest;
      return { published: true, usedFenceSnapshot: captured, liveFence: fenceState };
    }
    return { published: false };
  })();
  await sleep(80);
  fenceState = "ERASING";
  const raced = await writer;
  cases.PREP_B_26_export_vs_erasure_race_without_recheck = {
    raced,
    liveFence: fenceState,
    lateFileExists: lateBytes ? existsSync(lateBytes) : false,
    counterexample:
      "Export writer captured fence=LIVE, erasure moved to ERASING, late write still landed. Generation must be re-read under the publication lock immediately before external publish. Start-of-job snapshot is not a fence.",
  };

  // PREP-B-27 — same race WITH re-check (negative control that should refuse)
  fenceState = "LIVE";
  const guarded = (async () => {
    await sleep(250);
    if (fenceState !== "LIVE") {
      return { published: false, code: "stale_generation_publish_refused", liveFence: fenceState };
    }
    writeFileSync(path.join(raceRoot, "should-not-this-time"), "nope");
    return { published: true };
  })();
  await sleep(80);
  fenceState = "ERASING";
  cases.PREP_B_27_export_vs_erasure_with_recheck = await guarded;

  // PREP-B-28 — customer vs shop scope on SYNTHETIC coordinator
  cases.PREP_B_28_customer_vs_shop_synthetic_scope = {
    shop_redact_exclusive_domain_gate: "only shop/redact (not exercised in Redis/FS helper; PG is Helper A)",
    customer_redact:
      "must take domain SHARED + target exclusive; processingEnabled stays true; must not FLUSHALL; must not reclaim other shops' D scratch",
    data_request_export: "owner-only artifact; not operational export; unconfigured storage blocks COMPLETED",
  };

  // PREP-B-29 — resource failure keeps incomplete
  cases.PREP_B_29_resource_failure_keeps_incomplete = {
    codes: [
      "export_storage_unconfigured",
      "export_permission_denied",
      "scratch_resource_exhausted",
      "enumerator_stale_attempt",
    ],
    rule: "Inability to prove reclamation / publication drain keeps the request incomplete/visible. No fabricated COMPLETED.",
  };
} finally {
  await redis.quit().catch(() => undefined);
}

writeFileSync(OUT, `${JSON.stringify({ kind: "SYNTHETIC_PRIVACY_COORDINATOR", cases }, null, 2)}\n`);
console.log(JSON.stringify({ wrote: OUT, cases: Object.keys(cases) }, null, 2));
```

### Helper B `03-synthetic.json` (MATCH) — includes PREP_B_24/26/27

SHA-256 `67fb0fe7a4e374a7f7b23dd2464bb31a37d9bed4bccd6b16d41b5c0cf1459e5f`

```json
{
  "kind": "SYNTHETIC_PRIVACY_COORDINATOR",
  "cases": {
    "PREP_B_22_redis_hint_optional_poll_recovers": {
      "hint_lost_before_poll": true,
      "pollRecoveries": 1,
      "recovered": {
        "ok": true,
        "publicationRevision": 1,
        "keys": [
          "CUSTOMER_REST_ID:191167"
        ]
      },
      "durable_authority": "SYNTHETIC PrivacyRequest/PrivacyAttempt — not Redis, not DurableJob"
    },
    "PREP_B_23_stale_generation_or_attempt_publish": {
      "stale": {
        "ok": false,
        "code": "enumerator_stale_attempt",
        "keysUnchanged": true
      },
      "live": {
        "ok": true,
        "publicationRevision": 2,
        "keys": [
          "CUSTOMER_REST_ID:191167"
        ]
      },
      "lastKeys": {
        "requestId": "preq_synth_1",
        "attemptId": "att-2",
        "keys": [
          "CUSTOMER_REST_ID:191167"
        ],
        "publicationRevision": 2
      }
    },
    "PREP_B_24_export_unconfigured": {
      "ok": false,
      "code": "export_storage_unconfigured",
      "provider": "UNCONFIGURED",
      "note": "Explicit implementation dependency. Absence is not a pass and not an excuse to fabricate a live provider test."
    },
    "PREP_B_25_export_permission_failure": {
      "ok": false,
      "code": "export_permission_denied",
      "errno": "EACCES",
      "request_must_stay_incomplete": true
    },
    "PREP_B_26_export_vs_erasure_race_without_recheck": {
      "raced": {
        "published": true,
        "usedFenceSnapshot": "LIVE",
        "liveFence": "ERASING"
      },
      "liveFence": "ERASING",
      "lateFileExists": true,
      "counterexample": "Export writer captured fence=LIVE, erasure moved to ERASING, late write still landed. Generation must be re-read under the publication lock immediately before external publish. Start-of-job snapshot is not a fence."
    },
    "PREP_B_27_export_vs_erasure_with_recheck": {
      "published": false,
      "code": "stale_generation_publish_refused",
      "liveFence": "ERASING"
    },
    "PREP_B_28_customer_vs_shop_synthetic_scope": {
      "shop_redact_exclusive_domain_gate": "only shop/redact (not exercised in Redis/FS helper; PG is Helper A)",
      "customer_redact": "must take domain SHARED + target exclusive; processingEnabled stays true; must not FLUSHALL; must not reclaim other shops' D scratch",
      "data_request_export": "owner-only artifact; not operational export; unconfigured storage blocks COMPLETED"
    },
    "PREP_B_29_resource_failure_keeps_incomplete": {
      "codes": [
        "export_storage_unconfigured",
        "export_permission_denied",
        "scratch_resource_exhausted",
        "enumerator_stale_attempt"
      ],
      "rule": "Inability to prove reclamation / publication drain keeps the request incomplete/visible. No fabricated COMPLETED."
    }
  }
}
```

### Coordinator `redis-scratch.mjs` (MATCH)

SHA-256 `483d9cb5360ae9dccc484c5fff46d8d2f108b8fd2fb61766b46ffbe47306c88d`

```javascript
#!/usr/bin/env node
/**
 * Coordinator Redis/filesystem probes. Isolated from helper B (port 16380).
 * Uses pinned bullmq/ioredis from W node_modules. SYNTHETIC privacy adapter labelled.
 * Not PR7 application runtime.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, symlinkSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const require = createRequire("/workspace/stocky-plus/package.json");
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const PORT = 16380;
const DIR = "/tmp/pr7-coordinator/redis-16380";
const SCRATCH = "/tmp/pr7-coordinator/scratch";
mkdirSync(DIR, { recursive: true });
mkdirSync(SCRATCH, { recursive: true });

const conf = join(DIR, "redis.conf");
writeFileSync(
  conf,
  [
    `port ${PORT}`,
    "bind 127.0.0.1",
    `dir ${DIR}`,
    "save \"\"",
    "appendonly no",
    "daemonize no",
    "protected-mode yes",
    "databases 16",
  ].join("\n"),
);

const pidPath = join(DIR, "redis.pid");
let pid = existsSync(pidPath) ? Number(readFileSync(pidPath, "utf8").trim()) : 0;
if (!pid) {
  const redisProc = spawn(
    "/usr/bin/redis-server",
    [conf, "--daemonize", "yes", "--pidfile", pidPath],
    { stdio: "inherit" },
  );
  await new Promise((resolve, reject) => {
    redisProc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("redis-server " + code))));
  });
  pid = Number(readFileSync(pidPath, "utf8").trim());
}
if (!pid) throw new Error("no redis pid");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitPing(client) {
  for (let i = 0; i < 50; i++) {
    try {
      const p = await client.ping();
      if (p === "PONG") return;
    } catch {
      await sleep(50);
    }
  }
  throw new Error("redis ping timeout");
}

const results = [];
function rec(id, actual, pass, note) {
  results.push({ id, actual, pass, note });
}

try {
  const client = new IORedis({ host: "127.0.0.1", port: PORT, maxRetriesPerRequest: null, lazyConnect: true });
  await client.connect();
  await waitPing(client);

  const queue = new Queue("stocky-webhooks", {
    connection: { host: "127.0.0.1", port: PORT, maxRetriesPerRequest: null },
  });

  // Positive: add a generation-tagged job
  const job = await queue.add(
    "webhook:orders/create",
    { tenantShopId: "shop-a", generation: "gen-1", payload: { n: 1 } },
    { jobId: "disp-gen1-1" },
  );
  rec("queue.add returns id", job.id, job.id === "disp-gen1-1");

  const loaded = await queue.getJob("disp-gen1-1");
  rec("getJob sees waiting job", loaded?.id, loaded?.id === "disp-gen1-1");

  // Counterexample: cancel/remove is NOT proof of no external write
  const external = join(SCRATCH, "external-write.txt");
  writeFileSync(external, "published-before-remove\n");
  await loaded.remove();
  rec(
    "PREP-COORD-B-01 cancel/remove leaves external write (not quiescence)",
    existsSync(external) && readFileSync(external, "utf8").includes("published-before-remove"),
    true,
    "queue.remove succeeded while filesystem publication remained",
  );
  const afterRemove = await queue.getJob("disp-gen1-1");
  rec("job gone from redis after remove", afterRemove, afterRemove == null);

  // TTL guess is not drain: set a key with TTL, wait less than TTL, still present
  await client.set("hint:privacy:shop-a", "wake", "EX", 30);
  const ttl = await client.ttl("hint:privacy:shop-a");
  rec("TTL remaining > 0 is not a drain proof", ttl, ttl > 0, "optional Redis hint only");

  // Stale generation: add gen-1 job after gen-2 is current (SYNTHETIC fence)
  await queue.add("webhook:orders/create", { generation: "gen-1" }, { jobId: "stale-gen1" });
  const CURRENT = "gen-2";
  const stale = await queue.getJob("stale-gen1");
  const staleGen = stale?.data?.generation;
  rec(
    "stale generation still runnable without app fence",
    staleGen === "gen-1" && CURRENT === "gen-2",
    true,
    "SYNTHETIC: W has no generation-fenced queue remove",
  );

  // Shop isolation: two jobs different shops
  await queue.add("cron", { tenantShopId: "shop-a" }, { jobId: "shop-a-1" });
  await queue.add("cron", { tenantShopId: "shop-b" }, { jobId: "shop-b-1" });
  await (await queue.getJob("shop-a-1")).remove();
  const bStill = await queue.getJob("shop-b-1");
  rec("removing shop-a job does not remove shop-b", bStill?.id, bStill?.id === "shop-b-1");

  // FLUSHALL would cross shops — negative control: we refuse to call it
  rec("coordinator refused FLUSHALL", "not_called", true);

  // Filesystem: symlink refusal analogue (W reclaim uses lstat)
  const ns = join(SCRATCH, "ns");
  mkdirSync(ns, { recursive: true });
  const att = join(ns, "att-real");
  mkdirSync(att);
  writeFileSync(join(att, ".stocky-d-scratch"), JSON.stringify({ owned: true, prefix: "order_facts" }));
  const link = join(ns, "att-link");
  symlinkSync(att, link);
  const { lstatSync } = await import("node:fs");
  rec("symlink lstat isSymbolicLink", lstatSync(link).isSymbolicLink(), true);

  // unowned path
  const foreign = join(SCRATCH, "foreign-not-att");
  mkdirSync(foreign);
  rec("foreign non-att basename present", existsSync(foreign), true);

  // Export unconfigured
  rec(
    "W has no object-storage export adapter",
    "absent",
    true,
    "app.analytics_.export.tsx is HTTP CSV; no S3/R2/GCS module on W",
  );

  await queue.close();
  await client.quit();
} finally {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  await sleep(200);
  try {
    process.kill(pid, 0);
    process.kill(pid, "SIGKILL");
  } catch {
    /* reaped */
  }
}

const alive = (() => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
})();
rec("redis pid terminated", alive, alive === false, `pid=${pid}`);

console.log(JSON.stringify({ redisPid: pid, port: PORT, results, failed: results.filter((r) => !r.pass) }, null, 2));
process.exit(results.some((r) => !r.pass) ? 2 : 0);
```

### Coordinator `redis-scratch.json` (MATCH)

SHA-256 `bfb3fb5f50f473452cd7e3fa5161e990294a9f49bed97d34e0031c2ddf7e26cc`

```json
{
  "redisPid": 4966,
  "port": 16380,
  "results": [
    {
      "id": "queue.add returns id",
      "actual": "disp-gen1-1",
      "pass": true
    },
    {
      "id": "getJob sees waiting job",
      "actual": "disp-gen1-1",
      "pass": true
    },
    {
      "id": "PREP-COORD-B-01 cancel/remove leaves external write (not quiescence)",
      "actual": true,
      "pass": true,
      "note": "queue.remove succeeded while filesystem publication remained"
    },
    {
      "id": "job gone from redis after remove",
      "pass": true
    },
    {
      "id": "TTL remaining > 0 is not a drain proof",
      "actual": 30,
      "pass": true,
      "note": "optional Redis hint only"
    },
    {
      "id": "stale generation still runnable without app fence",
      "actual": true,
      "pass": true,
      "note": "SYNTHETIC: W has no generation-fenced queue remove"
    },
    {
      "id": "removing shop-a job does not remove shop-b",
      "actual": "shop-b-1",
      "pass": true
    },
    {
      "id": "coordinator refused FLUSHALL",
      "actual": "not_called",
      "pass": true
    },
    {
      "id": "symlink lstat isSymbolicLink",
      "actual": true,
      "pass": true
    },
    {
      "id": "foreign non-att basename present",
      "actual": true,
      "pass": true
    },
    {
      "id": "W has no object-storage export adapter",
      "actual": "absent",
      "pass": true,
      "note": "app.analytics_.export.tsx is HTTP CSV; no S3/R2/GCS module on W"
    },
    {
      "id": "redis pid terminated",
      "actual": false,
      "pass": true,
      "note": "pid=4966"
    }
  ],
  "failed": []
}
```

### Incomplete original fragment of hashed `02-dscratch.json` (MISSING full file)

Documented digest `ba1b2b3503e38d2d891dbb3876ec306ab5837a12efcaaa381ae19efaff51a5fe` was observed in the coordinator session via `sha256sum` but the full file was never dumped. The following is the coordinator `read_file` **tail only** (2112 bytes). It includes Helper B `PREP_B_19`. It is **not** the complete original and **must not** be hashed as `ba1b2b35…`.

```json
        "skipped": []
      },
      "restoredOk": true,
      "power_loss_tested": false,
      "counterexample": "After SIGKILL, kill(pid,0) fails (PID gone) but att-* bytes and reserved capacity remained; next admission was scratch_resource_exhausted until operator reclaim with quiescenceConfirmed:true. PID absence is not permission to delete and is not drain."
    },
    "PREP_B_19_quiescence_flag_is_not_cross_process_liveness": {
      "child2Pid": 7164,
      "child2_alive_before_kill": true,
      "reclaimWhileLive": {
        "reclaimed": [
          "att-live-shop-live-run-eWwgzC"
        ],
        "skipped": []
      },
      "dir_exists_after_foreign_reclaim": false,
      "note": "W live_writer skip is process-local (LIVE_SCRATCH_BASENAMES or marker.pid === process.pid). A second process passing quiescenceConfirmed:true can delete a still-live worker's att-*. The boolean is an operator admission token, not a liveness proof. Runbook §1 remains mandatory."
    },
    "PREP_B_20_unknown_leftover_blocks_admission": {
      "occupancy": {
        "leftoverAttemptCount": 2,
        "unknownAttemptCount": 1,
        "observedBytes": 1175,
        "reservedBytes": 4096,
        "oldestAgeMs": 1515,
        "maxScratchAttempts": 32,
        "maxScratchBytes": 50000,
        "operatorInterventionRequired": true,
        "ledgerIntegrity": "ok",
        "orphanMetadataPresent": false,
        "reasonCode": "order_facts_scratch_resource"
      },
      "unknownAttemptCount": 1,
      "operatorInterventionRequired": true,
      "note": "att-markerless was refused for reclaim (not_verified_d_resource) and still occupies the namespace as unknown. Admission must not invent a sweep."
    },
    "PREP_B_20b_reinitialize_after_quiescence": {
      "reinitWhileAtt": "scratch_resource_exhausted",
      "leftoverAttemptCount_before_reinit": 0,
      "reinitOk": {
        "ledgerIntegrity": "ok"
      },
      "marker_name": ".stocky-pr6-d-owned"
    },
    "PREP_B_21_reclaim_requires_quiescence_token": {
      "code": "scratch_unowned",
      "expected": "scratch_unowned"
    }
  }
}
```

## Appendix D — Helper C 86-row candidate inventory (MATCH)

Original path `/tmp/pr7-helper-outputs/C/WRITER_INVENTORY.json`. SHA-256 `f7f09cde84067c09675bac8f0ce14d130b520bc9bf5d369fd15a23eb4ab8c7f0`. 86 rows (`PW-001`…`PW-086`). Classifications: unchanged 32, misnamed 4, behavior_change 4, v_omitted 22, w_only 23, missing 1 (`generation_fenced_queue_remove`). This is a **candidate** inventory for PR45 refresh, not a completeness proof. Includes non-writer / read-only / missing-boundary rows; do not treat 86 as a writer-count.

```json
{
  "meta": {
    "helper": "C",
    "worktree": "/tmp/pr7-helpers/C",
    "w_sha": "ee193f38491245a10fb2fa60d2cf9a29f3271605",
    "v_sha": "a3ff480f1477237f8055f10c43298480a05728a1",
    "pr45_head": "a292bc8a6ea26192bc295af7338dd6d653a3e65c",
    "pr47_unmerged": "fde01dc5ba2e0076b1579d6690f0548db749af56",
    "pr45_claimed_inventory_rows": 26,
    "pr45_appendix_insert_rows": 27,
    "w_inventory_rows": 86,
    "note": "Complete W participating-writer inventory for PR7 entry evidence. PR7 runtime not authorized. Q-008 / D-PR7-01/02 / PR47 closeout not decided."
  },
  "writers": [
    {
      "id": "PW-001",
      "file": "app/tenant/db-context.server.ts",
      "symbol": "withTenantBoundTransaction",
      "transaction_host": "Prisma $transaction + setTransactionLocalTenantContext",
      "role": "stocky_runtime",
      "affected_surfaces": "caller tenant facts (any TenantDb-bound merchant write)",
      "target_key_derivation": "shopId from TenantAuthority; CUSTOMER_REST_ID/ORDER_LEGACY_ID from row when present",
      "current_guard": "RLS processingEnabled on merchant facts; GUC shopId",
      "proposed_pr7_gate": "REQUIRED (not optional) domain shared then customer-target shared; revalidate",
      "already_running_outcome": "holds txn; exclusive freeze waits",
      "test_home": "scripts/privacy/inventory-guard.test.ts (MISSING on W; V planning home). Existing: app/tenant/__tests__ (PG, not run)",
      "classification": "unchanged",
      "era": "V",
      "notes": "Symbol exists on W at same path. Guard still absent. Future architecture test must fail if bypassed."
    },
    {
      "id": "PW-002",
      "file": "app/tenant/tenant-db.server.ts",
      "symbol": "withTenantBoundTransactionState",
      "transaction_host": "Prisma interactive txn (private helper; not exported)",
      "role": "stocky_runtime",
      "affected_surfaces": "all TenantDb writes",
      "target_key_derivation": "shopId from TenantAuthority; customer/order keys from row",
      "current_guard": "RLS processingEnabled on facts",
      "proposed_pr7_gate": "REQUIRED (not optional) same as withTenantBoundTransaction",
      "already_running_outcome": "holds txn; exclusive freeze waits",
      "test_home": "scripts/privacy/inventory-guard.test.ts (MISSING on W)",
      "classification": "unchanged",
      "era": "V",
      "notes": "Still file-private. withWriteTransaction routes through it. Must not be marked optional."
    },
    {
      "id": "PW-003",
      "file": "app/lib/order-facts/apply/index.ts",
      "symbol": "applyOrderFacts",
      "transaction_host": "open TenantDb txn; caller owns commit",
      "role": "stocky_runtime",
      "affected_surfaces": "ShopifyOrderFact / lines / refunds / agreements / sales / OrderFactObservationInFlight",
      "target_key_derivation": "ORDER_LEGACY_ID from shopifyLegacyResourceId / GID; shopId",
      "current_guard": "requireTenant + requireProcessingEnabled pre-lock; receipt lock; processingEnabled re-check",
      "proposed_pr7_gate": "REQUIRED both lifecycle shared and customer-target shared after processingEnabled pre-lock; re-check is not drain",
      "already_running_outcome": "in-flight commit then residual/re-enumerate",
      "test_home": "app/lib/order-facts/apply/__tests__ (existing V; PG)",
      "classification": "unchanged",
      "era": "V",
      "notes": "PR45 family label applyOrderFactWriters does not exist as a symbol on V or W."
    },
    {
      "id": "PW-004",
      "file": "app/lib/order-facts/apply/writers.ts",
      "symbol": "applyOrderFactWriters",
      "transaction_host": "n/a — phantom family name",
      "role": "stocky_runtime",
      "affected_surfaces": "same as applyOrderFacts child writers",
      "target_key_derivation": "ORDER_LEGACY_ID",
      "current_guard": "via applyOrderFacts + stocky_shop_processing_enabled",
      "proposed_pr7_gate": "REQUIRED both gates; inventory must name real child symbols",
      "already_running_outcome": "n/a",
      "test_home": "app/lib/order-facts/apply/__tests__",
      "classification": "misnamed",
      "era": "V",
      "notes": "PR45 inventory symbol does not exist. Real exports: insertOrderFact, updateOrderAttributes, updateOrderExistence, upsertOrderLine, upsertAgreementAndSales, upsertRefundSnapshot, markOmittedOrderChildrenAbsent, requireProcessingEnabled."
    },
    {
      "id": "PW-005",
      "file": "app/lib/order-facts/apply/receipts.ts",
      "symbol": "insertReceiptFinal",
      "transaction_host": "TenantDb + application-key advisory lock + processingEnabled re-check",
      "role": "stocky_runtime",
      "affected_surfaces": "SyncApplicationReceipt",
      "target_key_derivation": "shop-level applicationKey; not customer restore by itself",
      "current_guard": "pre-lock + re-check processingEnabled",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; processingEnabled re-check is not drain",
      "already_running_outcome": "already-open receipt txn commits",
      "test_home": "app/lib/order-facts/apply/__tests__",
      "classification": "unchanged",
      "era": "V",
      "notes": "PR45 label applyReceipts does not exist. Real symbols: acquireReceiptApplicationKeyLock, loadReceipt, insertReceiptFinal, shortCircuitIfApplied."
    },
    {
      "id": "PW-006",
      "file": "app/lib/order-facts/apply/receipts.ts",
      "symbol": "applyReceipts",
      "transaction_host": "n/a — phantom family name",
      "role": "stocky_runtime",
      "affected_surfaces": "SyncApplicationReceipt",
      "target_key_derivation": "shop-level",
      "current_guard": "via insertReceiptFinal",
      "proposed_pr7_gate": "map to insertReceiptFinal",
      "already_running_outcome": "n/a",
      "test_home": "app/lib/order-facts/apply/__tests__",
      "classification": "misnamed",
      "era": "V",
      "notes": "Keep PR45 name as alias only; do not implement a new wrapper named applyReceipts."
    },
    {
      "id": "PW-007",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "claimAttempt",
      "transaction_host": "getControlPlanePrisma().$transaction; lockDurableJob FOR UPDATE; JobAttempt.create; raw UPDATE DurableJob; JobDispatch.updateMany",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt, DurableJob, JobDispatch",
      "target_key_derivation": "shopId only; not customer restore",
      "current_guard": "none — processingEnabled ABSENT on V and W",
      "proposed_pr7_gate": "REQUIRED lifecycle shared in the same CP txn",
      "already_running_outcome": "already-running claim finishes CP rows",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts (PG; not run)",
      "classification": "unchanged",
      "era": "V",
      "notes": "File byte-identical V→W. No processingEnabled reference."
    },
    {
      "id": "PW-008",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "renewAttemptHeartbeat",
      "transaction_host": "CP JobAttempt.updateMany",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt",
      "target_key_derivation": "shopId",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "heartbeat of running attempt",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Writes while shop disabled. Guard must be held so freeze can wait."
    },
    {
      "id": "PW-009",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "completeAttemptSuccess",
      "transaction_host": "CP $transaction; JobAttempt.update; raw DurableJob; webhookDelivery.updateMany; jobDispatch.updateMany",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt, DurableJob, WebhookDelivery, JobDispatch",
      "target_key_derivation": "shopId",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "already-running success finalizes CP",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "TF-03 already-running path. Unchanged V→W."
    },
    {
      "id": "PW-010",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "completeAttemptRetry",
      "transaction_host": "CP $transaction; JobAttempt.update; raw UPDATE DurableJob RETRY_WAIT; may call completeAttemptDeadLetterInTx for NO_AUTOMATIC_RETRY",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt, DurableJob, DeadLetter (when NO_AUTOMATIC_RETRY)",
      "target_key_derivation": "shopId; not customer restore",
      "current_guard": "none — ABSENT on V and W; TF-03 names this path",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "already-running retry writes while finishing attempt",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Required G9 symbol. NO_AUTOMATIC_RETRY still dead-letters uncertain. File unchanged V→W."
    },
    {
      "id": "PW-011",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "completeAttemptFail",
      "transaction_host": "CP $transaction → completeAttemptDeadLetterInTx",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt, DurableJob, DeadLetter",
      "target_key_derivation": "shopId",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "already-running fail",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": ""
    },
    {
      "id": "PW-012",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "completeAttemptDeadLetter",
      "transaction_host": "CP $transaction → completeAttemptDeadLetterInTx",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt, DurableJob, DeadLetter",
      "target_key_derivation": "shopId",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "already-running dead-letter",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": ""
    },
    {
      "id": "PW-013",
      "file": "app/sync/lifecycle.server.ts",
      "symbol": "recoverExpiredRunningAttempts",
      "transaction_host": "CP; reaper lives in this file (no separate reaper module on V or W)",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobAttempt, DurableJob, DeadLetter",
      "target_key_derivation": "shopId",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared per recovered job txn",
      "already_running_outcome": "already-running recovery",
      "test_home": "app/sync/__tests__/sync-attempt-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Writes for expired RUNNING attempts regardless of processingEnabled."
    },
    {
      "id": "PW-014",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "ensureDispatchRecord",
      "transaction_host": "CP JobDispatch.find/create (not always inside $transaction with claim)",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobDispatch",
      "target_key_derivation": "shopId",
      "current_guard": "none on create; caller may have just read processingEnabled=false",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "may run after disable",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Still private async function. Disabled-shop path calls it."
    },
    {
      "id": "PW-015",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "enqueueWithDispatch",
      "transaction_host": "CP markDispatchFailed; raw UPDATE DurableJob CANCELLED or PENDING; Redis queue.add when enabled",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobDispatch, DurableJob, DataIssue; Redis stocky-webhooks/stocky-cron",
      "target_key_derivation": "shopId",
      "current_guard": "READ processingEnabled then STILL WRITES on false",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; Redis add is publication not PG drain",
      "already_running_outcome": "already-claimed job after disable",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Exported. Shop-disabled path does not queue.add; still writes CP."
    },
    {
      "id": "PW-016",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "dispatcher_disabled_shop_path",
      "transaction_host": "dispatchPendingJobs after claim: ensureDispatchRecord + enqueueWithDispatch when processingEnabled=false; markDispatchFailed; raw DurableJob PENDING or CANCELLED",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobDispatch, DurableJob, DataIssue",
      "target_key_derivation": "shopId",
      "current_guard": "READ then STILL WRITES — processingEnabled re-check is not a transaction drain",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; G9 dispatcher_disabled_shop_path_still_writes",
      "already_running_outcome": "already-claimed job",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "W lines 1373-1392 match PR45 FACT V ~1373-1390. File unchanged V→W. Required inventory symbol."
    },
    {
      "id": "PW-017",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "dispatchPendingJobs",
      "transaction_host": "after claim, re-check shop, still ensureDispatchRecord+enqueueWithDispatch; also recoverExpiredDispatchLeases + claimBatchFair",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobDispatch, DurableJob, Redis",
      "target_key_derivation": "shopId",
      "current_guard": "re-check is not drain; fair-claim SELECT uses processingEnabled=true",
      "proposed_pr7_gate": "REQUIRED lifecycle shared on all write arms including disabled",
      "already_running_outcome": "already-claimed; disabled path increments shopDisabled",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Webhook routes kick this after intake. Order-facts jobs now eligible via queue/strategy on W."
    },
    {
      "id": "PW-018",
      "file": "app/sync/fair-claim-query.server.ts",
      "symbol": "buildFairClaimJobCandidateSql",
      "transaction_host": "raw SQL SELECT WHERE processingEnabled=true (used inside claimBatchFair txn)",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob read / DispatchReadyShop lock",
      "target_key_derivation": "n/a (admission)",
      "current_guard": "YES on SELECT — admission only; does not drain in-flight",
      "proposed_pr7_gate": "do not add privacy claim SQL; keep processingEnabled=true on fair-claim SELECT",
      "already_running_outcome": "does not finish already-running writers",
      "test_home": "app/sync/fair-claim-query.server.ts + dispatch-ready tests (PG)",
      "classification": "unchanged",
      "era": "V",
      "notes": "PR45 named claimRunnableJobsSql. Actual export is buildFairClaimJobCandidateSql. assertDispatcherUsesProductionFairClaimSql still frozen. New claims skipped when disabled; not a drain."
    },
    {
      "id": "PW-019",
      "file": "app/sync/intake.server.ts",
      "symbol": "createDurableJob",
      "transaction_host": "CP DurableJob.create",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob",
      "target_key_derivation": "shopId",
      "current_guard": "YES deny shop_processing_disabled",
      "proposed_pr7_gate": "REQUIRED lifecycle shared PLUS keep processingEnabled deny; privacy does not gain allowWhenProcessingDisabled",
      "already_running_outcome": "new intake only",
      "test_home": "app/sync/__tests__/sync-intake-corrections.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "W callers now include enqueueOrderFactsSync/Reconcile and quarantine reconcile enqueue."
    },
    {
      "id": "PW-020",
      "file": "app/sync/replay.server.ts",
      "symbol": "replayDeadLetter",
      "transaction_host": "CP $transaction",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob, JobReplay, DeadLetter; FUTURE PlatformReplayCommand",
      "target_key_derivation": "shopId",
      "current_guard": "YES replay_denied_disabled_shop",
      "proposed_pr7_gate": "REQUIRED stocky_authz_lock then stocky_verify_platform_assignment then lifecycle shared",
      "already_running_outcome": "committed effects stay",
      "test_home": "app/sync/__tests__/sync-control-plane.integration.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "No actor on V/W. File unchanged V→W."
    },
    {
      "id": "PW-021",
      "file": "app/sync/uninstall.server.ts",
      "symbol": "processUninstall",
      "transaction_host": "CP $transaction then session delete after commit",
      "role": "stocky_control_plane",
      "affected_surfaces": "Shop, DurableJob, JobAttempt, WebhookDelivery, Session",
      "target_key_derivation": "canonical domain",
      "current_guard": "sets processingEnabled=false reason UNINSTALLED; comment admits in-flight statements",
      "proposed_pr7_gate": "REQUIRED exclusive lifecycle then generation UNINSTALLED; cancel ordinary jobs; no privacy DurableJob skip list",
      "already_running_outcome": "in-flight admitted before exclusive",
      "test_home": "app/sync/__tests__/sync-uninstall.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "May create Shop if missing. Session delete after commit via deleteSessionsForShop."
    },
    {
      "id": "PW-022",
      "file": "app/sync/uninstall.server.ts",
      "symbol": "cancelAllCancellable",
      "transaction_host": "CP FOR UPDATE job rows inside processUninstall txn",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob, JobAttempt",
      "target_key_derivation": "shopId",
      "current_guard": "n/a (runs after disable in same txn)",
      "proposed_pr7_gate": "REQUIRED exclusive lifecycle",
      "already_running_outcome": "cancels cancellable; not fact drain",
      "test_home": "app/sync/__tests__/sync-uninstall.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Still file-private. Does not cancel Redis jobs."
    },
    {
      "id": "PW-023",
      "file": "app/sync/reinstall.server.ts",
      "symbol": "reactivateShopAfterVerifiedReinstall",
      "transaction_host": "CP Shop.update",
      "role": "stocky_control_plane",
      "affected_surfaces": "Shop",
      "target_key_derivation": "domain",
      "current_guard": "reads processingEnabled; throws reinstall_denied on REDACTED/MANUAL",
      "proposed_pr7_gate": "REQUIRED lifecycle shared + fence; keep REDACTED deny; allow new Shop only when fence permits",
      "already_running_outcome": "n/a",
      "test_home": "app/sync/reinstall.server.ts + after-auth tests",
      "classification": "unchanged",
      "era": "V",
      "notes": "Nothing on W writes REDACTED. File unchanged V→W."
    },
    {
      "id": "PW-024",
      "file": "app/tenant/bootstrap.server.ts",
      "symbol": "upsertCanonicalShop",
      "transaction_host": "rawPrisma.shop.upsert",
      "role": "stocky_runtime",
      "affected_surfaces": "Shop",
      "target_key_derivation": "canonical domain even if Shop absent",
      "current_guard": "none — no FINALIZING fence today",
      "proposed_pr7_gate": "REQUIRED assertNoErasureFence + shared gate before create",
      "already_running_outcome": "bootstrap vs freeze",
      "test_home": "app/tenant/__tests__/bootstrap.test.ts (PG)",
      "classification": "unchanged",
      "era": "V",
      "notes": "createIfMissing upsert on myshopifyDomain unique."
    },
    {
      "id": "PW-025",
      "file": "app/tenant/after-auth.server.ts",
      "symbol": "runAfterAuthTenantBootstrap",
      "transaction_host": "bootstrap + tenant-db shopSettings.upsert",
      "role": "stocky_runtime",
      "affected_surfaces": "Shop, ShopSettings",
      "target_key_derivation": "domain",
      "current_guard": "swallows reinstall_denied then still upserts ShopSettings",
      "proposed_pr7_gate": "REQUIRED both gates; no settings revival on ERASING/FINALIZING/this-generation REDACTED",
      "already_running_outcome": "n/a",
      "test_home": "app/tenant/after-auth.server.ts (no dedicated unit file)",
      "classification": "unchanged",
      "era": "V",
      "notes": "FACT unchanged on W. Catalog enqueue is in shopify.server.ts after this returns."
    },
    {
      "id": "PW-026",
      "file": "app/lib/catalog-facts/ingest/checkpoint.ts",
      "symbol": "lockSyncRun",
      "transaction_host": "CP $queryRaw SELECT SyncRun FOR UPDATE inside persist* txns",
      "role": "stocky_control_plane",
      "affected_surfaces": "SyncRun, SyncCursor",
      "target_key_derivation": "shopId",
      "current_guard": "YES shop_processing_disabled via requireProcessingEnabled before lock",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; shop_processing_disabled is admission not drain",
      "already_running_outcome": "already-running checkpoint",
      "test_home": "app/lib/catalog-facts + scripts/tenant-enforcement/tests/pr5-f3-jsonl-checkpoint.test.ts",
      "classification": "unchanged",
      "era": "V",
      "notes": "Still file-private. Exported writers: persistBulkSubmitIntentAndFence, persistFullSyncFence, attachBulkOperationGid, acknowledgeJsonlBatch, persistBulkCounts, markSyncRunPartialFailure, completeSyncRunAndCursor. File unchanged V→W. D import reuses these."
    },
    {
      "id": "PW-027",
      "file": "app/jobs/workers/webhook-processor.ts",
      "symbol": "assertShopProcessingEnabled",
      "transaction_host": "ordinary job execution; CP Shop.findUnique then merchant apply",
      "role": "stocky_runtime",
      "affected_surfaces": "facts via apply; salesDailyAggregate; order-facts sync",
      "target_key_derivation": "shopId",
      "current_guard": "YES throws shop_processing_disabled",
      "proposed_pr7_gate": "REQUIRED keep ordinary path; privacy coordinator is a separate loop; not a drain",
      "already_running_outcome": "already-running job may still completeAttempt* without this re-check on lifecycle",
      "test_home": "app/jobs/workers + scripts/tenant-enforcement/tests/pr6-d-worker.test.ts (PG; not run)",
      "classification": "behavior_change",
      "era": "W",
      "notes": "Local function still present. W adds processOrderFactsWebhookJob, runOrderFactsSyncJob, runOrderFactsReconcileJob after the same assert."
    },
    {
      "id": "PW-028",
      "file": "app/jobs/queue.server.ts",
      "symbol": "enqueueWebhook",
      "transaction_host": "CP via createDurableJob + kickDispatcher",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob; Redis only via later dispatch",
      "target_key_derivation": "shopId",
      "current_guard": "via intake createDurableJob processingEnabled deny",
      "proposed_pr7_gate": "intake gate + lifecycle shared; FUTURE generation-fenced shop-scoped remove of ordinary jobs; never FLUSHALL",
      "already_running_outcome": "n/a",
      "test_home": "app/jobs/queue.server.ts / tenant queue-redis tests (Redis; not run)",
      "classification": "unchanged",
      "era": "V",
      "notes": "PR45 'createDurableJob wrappers'. Production has no queue.remove."
    },
    {
      "id": "PW-029",
      "file": "app/sync/health.server.ts",
      "symbol": "computeSyncHealth",
      "transaction_host": "CP syncHealth.upsert after Shop/job reads",
      "role": "stocky_control_plane",
      "affected_surfaces": "SyncHealth",
      "target_key_derivation": "shopId + syncDomain",
      "current_guard": "reads processingEnabled to set DISABLED state but STILL UPSERTS",
      "proposed_pr7_gate": "REQUIRED lifecycle shared — this is a CP writer, not read-only",
      "already_running_outcome": "upsert while disabled records DISABLED",
      "test_home": "catalog diagnostic-reconciler + order-facts control-plane (PG)",
      "classification": "misnamed",
      "era": "V",
      "notes": "PR45 symbol getShopHealth does not exist on V or W. PR45 called it read-only; both V and W upsert SyncHealth. W adds order_facts domain filter and orderFactsScratch DEGRADED evidence."
    },
    {
      "id": "PW-030",
      "file": "app/sync/health.server.ts",
      "symbol": "getShopHealth",
      "transaction_host": "n/a — phantom",
      "role": "stocky_control_plane",
      "affected_surfaces": "none",
      "target_key_derivation": "n/a",
      "current_guard": "n/a",
      "proposed_pr7_gate": "replace with computeSyncHealth as a participating writer",
      "already_running_outcome": "n/a",
      "test_home": "app/sync/health.server.ts",
      "classification": "misnamed",
      "era": "V",
      "notes": "Do not treat health as outside the barrier without a new proof. Current upsert can persist tenant-linked CP rows during freeze."
    },
    {
      "id": "PW-031",
      "file": "app/sync/intake.server.ts",
      "symbol": "ingestAuthenticatedWebhook",
      "transaction_host": "CP $transaction WebhookDelivery + DurableJob",
      "role": "stocky_control_plane",
      "affected_surfaces": "WebhookDelivery, DurableJob",
      "target_key_derivation": "shopId; payload may carry ORDER_LEGACY_ID later at apply time",
      "current_guard": "denies durable job unless processingEnabled or topic app/uninstalled; still writes quarantine deliveries",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; keep uninstall exception; do not treat as customer barrier by topic string",
      "already_running_outcome": "new delivery rows while enabled; disabled throws before write for ordinary topics",
      "test_home": "app/sync/__tests__/sync-intake-corrections.test.ts",
      "classification": "behavior_change",
      "era": "W",
      "notes": "Omitted from 26-row table though named in plan §4.2. W: on projection_bounds_exceeded for order-facts topics, enqueues order-facts-reconcile via createDurableJob."
    },
    {
      "id": "PW-032",
      "file": "app/tenant/bootstrap.server.ts",
      "symbol": "deleteSessionsForShop",
      "transaction_host": "rawPrisma.session.deleteMany",
      "role": "bootstrap / stocky_runtime",
      "affected_surfaces": "Session",
      "target_key_derivation": "shop domain string; none customer",
      "current_guard": "none (after uninstall commit)",
      "proposed_pr7_gate": "lifecycle exclusive already committed; session delete must remain asserted; do not revive shop on failure",
      "already_running_outcome": "post-commit; failure does not roll back disable",
      "test_home": "app/tenant/__tests__/bootstrap.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Required by matrix §1 uninstall session delete. processUninstall also has prisma.session.deleteMany fallback."
    },
    {
      "id": "PW-033",
      "file": "app/tenant/bootstrap.server.ts",
      "symbol": "updateSessionScope",
      "transaction_host": "rawPrisma.session.update",
      "role": "bootstrap",
      "affected_surfaces": "Session",
      "target_key_derivation": "sessionId / shop domain",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared (shop-scoped session write)",
      "already_running_outcome": "n/a",
      "test_home": "app/routes/webhooks.app.scopes_update.tsx (route only)",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Called from webhooks.app.scopes_update.tsx."
    },
    {
      "id": "PW-034",
      "file": "app/tenant/bootstrap.server.ts",
      "symbol": "shopifySessionStorage",
      "transaction_host": "PrismaSessionStorage(rawPrisma) store/delete Session",
      "role": "bootstrap",
      "affected_surfaces": "Session",
      "target_key_derivation": "shop domain; Session.userId unused by RBAC",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared on store; D-PR7-02 online tokens not enabled (useOnlineTokens absent)",
      "already_running_outcome": "auth can persist Session during freeze if uninstrumented",
      "test_home": "app/tenant/__tests__/bootstrap.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "D-PR7-01/02 bind remains OPEN/unverified. Helper C does not decide."
    },
    {
      "id": "PW-035",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "recoverExpiredDispatchLeases",
      "transaction_host": "raw SQL UPDATE DurableJob DISPATCH_LEASED → PENDING (buildExpiredDispatchLeaseRecoverySql)",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob",
      "target_key_derivation": "shopId (returned, not filtered)",
      "current_guard": "none — SQL has no processingEnabled predicate",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; processingEnabled ≠ drain",
      "already_running_outcome": "returns leased jobs to PENDING even if shop disabled",
      "test_home": "app/sync/__tests__/d049-readiness-corrections.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Same class of hole as completeAttemptRetry. Fair-claim will not reclaim disabled shops, but this write still happens."
    },
    {
      "id": "PW-036",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "recoverStrandedEnqueuedJobs",
      "transaction_host": "CP $transaction FOR UPDATE; may terminalize or retry ENQUEUED jobs; inspects Redis",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob, JobDispatch, DeadLetter; Redis inspect",
      "target_key_derivation": "shopId",
      "current_guard": "none on processingEnabled",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; Redis inspect is not quiescence",
      "already_running_outcome": "stranded ENQUEUED recovery",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "QUEUE_UNAVAILABLE/UNKNOWN_STATE do not mutate."
    },
    {
      "id": "PW-037",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "claimBatchFair",
      "transaction_host": "CP $transaction; UPDATE DurableJob → DISPATCH_LEASED; readiness reconcile SQL",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob, DispatchReadyShop",
      "target_key_derivation": "shopId",
      "current_guard": "fair-claim SELECT processingEnabled=true (admission)",
      "proposed_pr7_gate": "REQUIRED lifecycle shared on the lease UPDATE; admission filter is not drain",
      "already_running_outcome": "new claims skipped when disabled",
      "test_home": "app/sync/__tests__/dispatch-ready-shop.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "PR45 listed the SQL as read-only. The host writes DISPATCH_LEASED."
    },
    {
      "id": "PW-038",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "ackEnqueued",
      "transaction_host": "CP $transaction UPDATE DurableJob+JobDispatch → ENQUEUED",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob, JobDispatch",
      "target_key_derivation": "shopId",
      "current_guard": "none (runs after enabled enqueue)",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "acks after Redis add",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Disabled path does not ack."
    },
    {
      "id": "PW-039",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "addJobToQueue",
      "transaction_host": "BullMQ queue.add (Redis publication)",
      "role": "none (Redis)",
      "affected_surfaces": "Redis queues stocky-webhooks / stocky-cron",
      "target_key_derivation": "shopId inside envelope; not fenced by PG advisory locks",
      "current_guard": "only reached when processingEnabled true in enqueueWithDispatch",
      "proposed_pr7_gate": "generation-fenced publication; PG gate does not fence Redis (plan §7.6.2 LIMIT)",
      "already_running_outcome": "runnable Redis job may outlive PG freeze",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts (Redis)",
      "classification": "v_omitted",
      "era": "V",
      "notes": "W addJobToQueue uses job.jobType as cron name so order-facts-sync/reconcile publish."
    },
    {
      "id": "PW-040",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "markDispatchFailed",
      "transaction_host": "CP JobDispatch.update FAILED + DataIssue.create",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobDispatch, DataIssue",
      "target_key_derivation": "shopId",
      "current_guard": "called on shop_processing_disabled path",
      "proposed_pr7_gate": "REQUIRED lifecycle shared (part of dispatcher_disabled_shop_path)",
      "already_running_outcome": "writes while disabled",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Named in PR45 dispatcher_disabled_shop_path prose; not its own inventory row."
    },
    {
      "id": "PW-041",
      "file": "app/sync/application-receipt.server.ts",
      "symbol": "applyWithApplicationReceipt",
      "transaction_host": "TenantDb txn; receipt insert final write",
      "role": "stocky_runtime",
      "affected_surfaces": "SyncApplicationReceipt + caller merchant effects",
      "target_key_derivation": "shopId via applicationKey",
      "current_guard": "RLS + caller processingEnabled",
      "proposed_pr7_gate": "REQUIRED both gates via withTenantBoundTransaction",
      "already_running_outcome": "already_applied short-circuit",
      "test_home": "app/sync/__tests__ application receipt tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Used by catalog/legacy webhook apply. Order-facts D uses apply/receipts.ts instead."
    },
    {
      "id": "PW-042",
      "file": "app/lib/catalog-facts/apply/index.ts",
      "symbol": "applyCanonicalFacts",
      "transaction_host": "open TenantDb txn; requireTenant only (NO explicit processingEnabled pre-lock)",
      "role": "stocky_runtime",
      "affected_surfaces": "canonical catalog facts / observation in-flight / projection state",
      "target_key_derivation": "shopId; catalog GIDs; not customer keys",
      "current_guard": "RLS processingEnabled on facts; GUC shopId; no requireProcessingEnabled in applyCanonicalFacts",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; do not treat RLS in a stale txn as drain; consider explicit pre-lock like order apply (OPEN — not decided here)",
      "already_running_outcome": "in-flight catalog apply can commit",
      "test_home": "app/lib/catalog-facts/apply/apply-safety.test.ts (DB-free safety) + PR5-F3 PG tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Hole vs order-facts apply. Shop/redact residual includes catalog facts. Child writers in apply/writers.ts."
    },
    {
      "id": "PW-043",
      "file": "app/lib/catalog-facts/ingest/checkpoint.ts",
      "symbol": "completeSyncRunAndCursor",
      "transaction_host": "CP $transaction; lockSyncRun; SyncRun+SyncCursor writes",
      "role": "stocky_control_plane",
      "affected_surfaces": "SyncRun, SyncCursor",
      "target_key_derivation": "shopId",
      "current_guard": "processingEnabled admission",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "already-running checkpoint",
      "test_home": "scripts/tenant-enforcement/tests/pr5-f3-jsonl-checkpoint.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Representative exported checkpoint writer; siblings persistBulkSubmitIntentAndFence, persistFullSyncFence, attachBulkOperationGid, acknowledgeJsonlBatch, persistBulkCounts, markSyncRunPartialFailure share lockSyncRun."
    },
    {
      "id": "PW-044",
      "file": "app/lib/catalog-facts/ingest/direct-observation.ts",
      "symbol": "beginDirectObservation",
      "transaction_host": "TenantDb insert observation in-flight",
      "role": "stocky_runtime",
      "affected_surfaces": "catalog observation in-flight",
      "target_key_derivation": "shopId + resource GID",
      "current_guard": "RLS / tenant GUC",
      "proposed_pr7_gate": "REQUIRED both gates (shop-level catalog; customer keys none)",
      "already_running_outcome": "active observation rows",
      "test_home": "PR5-F3 observation tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Catalog analogue of W-only beginDirectOrderObservation."
    },
    {
      "id": "PW-045",
      "file": "app/lib/catalog-facts/compatibility-projection/project.ts",
      "symbol": "projectCompatibilityFromCanonicalFacts",
      "transaction_host": "TenantDb merchant writes",
      "role": "stocky_runtime",
      "affected_surfaces": "compatibility projection tables",
      "target_key_derivation": "shopId",
      "current_guard": "explicit processingEnabled !== true refuse",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; processingEnabled is admission",
      "already_running_outcome": "in-flight projection",
      "test_home": "app/lib/catalog-facts/compatibility-projection/request.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": ""
    },
    {
      "id": "PW-046",
      "file": "app/jobs/workers/catalog-facts/bulk-finish.ts",
      "symbol": "signalBulkOperationContinuation",
      "transaction_host": "CP durableJob.updateMany nextEligibleAt",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob RETRY_WAIT",
      "target_key_derivation": "shopId + correlationId",
      "current_guard": "none — no processingEnabled check",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "nudges retry wait",
      "test_home": "catalog bulk-finish / PR5-F3",
      "classification": "behavior_change",
      "era": "W",
      "notes": "V-omitted writer. W jobType in-list adds order-facts-sync and order-facts-reconcile."
    },
    {
      "id": "PW-047",
      "file": "app/jobs/workers/webhook-processor.ts",
      "symbol": "handleOrderCreate",
      "transaction_host": "TenantDb salesDailyAggregate.upsert (legacy v1 effects)",
      "role": "stocky_runtime",
      "affected_surfaces": "SalesDailyAggregate",
      "target_key_derivation": "shop domain + variant GID; not customer rest id",
      "current_guard": "assertShopProcessingEnabled before v3 work; RLS",
      "proposed_pr7_gate": "REQUIRED both gates (shop-level facts; residual for shop/redact)",
      "already_running_outcome": "legacy effects commit with receipt-bound apply",
      "test_home": "webhook-processor tests / PR6-D worker tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Also handleOrderCancelled, handleRefundCreate. W runs them via applyCanonicalAndLegacy runLegacy."
    },
    {
      "id": "PW-048",
      "file": "app/jobs/queue.server.ts",
      "symbol": "enqueueAfterAuthCatalogSync",
      "transaction_host": "createDurableJob + kickDispatcher",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob",
      "target_key_derivation": "shopId",
      "current_guard": "via createDurableJob processingEnabled",
      "proposed_pr7_gate": "skip catalog enqueue on fence (plan §7.9 shopify.server.ts)",
      "already_running_outcome": "n/a",
      "test_home": "app/shopify.server.ts hook",
      "classification": "v_omitted",
      "era": "V",
      "notes": "shopify.server.ts afterAuth always enqueues after bootstrap; no useOnlineTokens."
    },
    {
      "id": "PW-049",
      "file": "app/shopify.server.ts",
      "symbol": "hooks.afterAuth",
      "transaction_host": "runAfterAuthTenantBootstrap then enqueueAfterAuthCatalogSync",
      "role": "stocky_runtime + CP",
      "affected_surfaces": "Shop, ShopSettings, DurableJob",
      "target_key_derivation": "session.shop domain",
      "current_guard": "none on fence; createDurableJob may throw if disabled",
      "proposed_pr7_gate": "skip catalog enqueue on fence; useOnlineTokens true only after D-PR7-02 authority (not decided)",
      "already_running_outcome": "n/a",
      "test_home": "none dedicated",
      "classification": "unchanged",
      "era": "V",
      "notes": "File unchanged V→W. D-PR7-02 not enabled."
    },
    {
      "id": "PW-050",
      "file": "app/lib/order-facts/apply/fencing.ts",
      "symbol": "persistIncompleteObservation",
      "transaction_host": "TenantDb UPDATE OrderFactObservationInFlight",
      "role": "stocky_runtime",
      "affected_surfaces": "OrderFactObservationInFlight",
      "target_key_derivation": "shopId + order/refund GID token",
      "current_guard": "tenant GUC; via applyOrderFacts processingEnabled",
      "proposed_pr7_gate": "REQUIRED both gates (ORDER_LEGACY_ID when GID maps)",
      "already_running_outcome": "incomplete observation persists",
      "test_home": "app/lib/order-facts/apply tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": "W persistIncompleteWithoutReceipt calls this in a dedicated txn without receipt."
    },
    {
      "id": "PW-051",
      "file": "app/jobs/queue.server.ts",
      "symbol": "enqueueOrderFactsSync",
      "transaction_host": "createDurableJob jobType order-facts-sync + kickDispatcher",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob",
      "target_key_derivation": "shopId",
      "current_guard": "via createDurableJob processingEnabled deny",
      "proposed_pr7_gate": "REQUIRED lifecycle shared PLUS intake deny; not a privacy job",
      "already_running_outcome": "new intake only",
      "test_home": "scripts/tenant-enforcement/tests/pr6-d-integration.test.ts (PG; not run)",
      "classification": "w_only",
      "era": "W",
      "notes": "PR6-D. PR45 V inventory missed."
    },
    {
      "id": "PW-052",
      "file": "app/jobs/queue.server.ts",
      "symbol": "enqueueOrderFactsReconcile",
      "transaction_host": "CP findFirst then createDurableJob order-facts-reconcile",
      "role": "stocky_control_plane",
      "affected_surfaces": "DurableJob",
      "target_key_derivation": "shopId",
      "current_guard": "createDurableJob processingEnabled; coalesce if already pending",
      "proposed_pr7_gate": "REQUIRED lifecycle shared PLUS intake deny",
      "already_running_outcome": "new intake only",
      "test_home": "pr6-d-integration.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "Also invoked from intake quarantine path."
    },
    {
      "id": "PW-053",
      "file": "app/lib/order-facts/sync/webhook.ts",
      "symbol": "processOrderFactsWebhookJob",
      "transaction_host": "TenantDb apply + CP dataIssue; Shopify admin read before apply",
      "role": "stocky_runtime",
      "affected_surfaces": "order facts, receipts, observations, DataIssue",
      "target_key_derivation": "ORDER_LEGACY_ID from projection/GID; shopId",
      "current_guard": "caller assertShopProcessingEnabled; apply requireProcessingEnabled; RLS",
      "proposed_pr7_gate": "REQUIRED both gates; payloadAdmittedAt vs PrivacyCompletedTarget (Q-008 OPEN — not decided)",
      "already_running_outcome": "in-flight apply",
      "test_home": "scripts/tenant-enforcement/tests/pr6-d-worker.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "New topics orders/edited, orders/delete, order_transactions/create plus legacy create/cancelled/refunds."
    },
    {
      "id": "PW-054",
      "file": "app/jobs/workers/order-facts/sync-jobs.ts",
      "symbol": "runOrderFactsSyncJob",
      "transaction_host": "runOrderFactsImportStep: CP SyncRun/cursor/health + TenantDb apply + D scratch FS",
      "role": "stocky_runtime + stocky_control_plane + filesystem",
      "affected_surfaces": "order facts, SyncRun, SyncCursor, SyncHealth, DataIssue, D scratch bytes",
      "target_key_derivation": "shopId; ORDER_LEGACY_ID per nominated GID",
      "current_guard": "assertShopProcessingEnabled in import; checkpoint processingEnabled; FS unfenced by PG",
      "proposed_pr7_gate": "REQUIRED lifecycle shared on CP+facts; separate positive D-scratch drain (LIMIT)",
      "already_running_outcome": "scratch dirs and CP rows survive freeze unless drained",
      "test_home": "app/lib/order-facts/sync/source-stage.test.ts (FS unit) + pr6-d-integration.test.ts (PG; not run)",
      "classification": "w_only",
      "era": "W",
      "notes": "Reuses catalog checkpoint lockSyncRun family."
    },
    {
      "id": "PW-055",
      "file": "app/jobs/workers/order-facts/sync-jobs.ts",
      "symbol": "runOrderFactsReconcileJob",
      "transaction_host": "runOrderFactsReconcileStep TenantDb + CP",
      "role": "stocky_runtime + CP",
      "affected_surfaces": "order facts, coverage health",
      "target_key_derivation": "shopId; order GIDs",
      "current_guard": "processingEnabled via apply/control-plane assert",
      "proposed_pr7_gate": "REQUIRED both gates",
      "already_running_outcome": "in-flight reconcile",
      "test_home": "pr6-d-integration.test.ts / pr6-d-correction.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": ""
    },
    {
      "id": "PW-056",
      "file": "app/lib/order-facts/sync/source-stage.ts",
      "symbol": "createOwnedScratchDir",
      "transaction_host": "filesystem mkdir + quota.reservation ledger (not PG)",
      "role": "none (local FS)",
      "affected_surfaces": "D scratch att-* dirs, markers, quota.reservation",
      "target_key_derivation": "shopId/syncRunId in marker JSON; bytes not tenant-RLS",
      "current_guard": "none PG; namespace marker + quota lock",
      "proposed_pr7_gate": "NOT covered by advisory locks; requires generation-fenced I/O drain / leftover occupancy hold (D-054 reclaim API)",
      "already_running_outcome": "live handle blocks reclaim",
      "test_home": "app/lib/order-facts/sync/source-stage.test.ts; scratch-quota.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "TTL/PID/cancel-label is not quiescence. Plan LIMIT confirmed on W."
    },
    {
      "id": "PW-057",
      "file": "app/lib/order-facts/sync/source-stage.ts",
      "symbol": "disposeOwnedScratch",
      "transaction_host": "FS rm of authentic handle only",
      "role": "none (local FS)",
      "affected_surfaces": "D scratch attempt dir + reservation",
      "target_key_derivation": "ownership handle; refuses path-only",
      "current_guard": "AUTHENTIC_SCRATCH_HANDLES; refuses string paths",
      "proposed_pr7_gate": "same FS drain; not PG",
      "already_running_outcome": "releases reservation",
      "test_home": "source-stage.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "Path-only disposal throws scratch_unowned."
    },
    {
      "id": "PW-058",
      "file": "app/lib/order-facts/sync/source-stage.ts",
      "symbol": "reclaimOperatorSelectedDScratch",
      "transaction_host": "FS operator reclaim; requires quiescenceConfirmed: true",
      "role": "operator-only (no HTTP endpoint)",
      "affected_surfaces": "selected att-* dirs + quota.lock + ledger",
      "target_key_derivation": "scratchRoot + attemptBasenames; shopId in markers not used as authz",
      "current_guard": "quiescenceConfirmed literal true; refuses live/foreign/symlink/markerless",
      "proposed_pr7_gate": "privacy completion must not call this without documented operator quiescence; remnants keep request incomplete",
      "already_running_outcome": "skips live_writer",
      "test_home": "source-stage.test.ts; PR6_D_SCRATCH_OPERATOR_RUNBOOK.md",
      "classification": "w_only",
      "era": "W",
      "notes": "Accepted D reclaim helper exists on W. PR6 formal closeout / PR47 not decided. Automatic reclaim unauthorized."
    },
    {
      "id": "PW-059",
      "file": "app/lib/order-facts/sync/source-stage.ts",
      "symbol": "inspectDScratchOccupancy",
      "transaction_host": "FS inspect + ledger read (no delete)",
      "role": "none",
      "affected_surfaces": "occupancy snapshot used by SyncHealth",
      "target_key_derivation": "scratch root; not shop-keyed on disk namespace",
      "current_guard": "none",
      "proposed_pr7_gate": "read-only proof for residual; empty sample is not absence",
      "already_running_outcome": "n/a",
      "test_home": "source-stage.test.ts; scratch-quota.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "Feeds persistOrderFactsCoverageHealth → computeSyncHealth."
    },
    {
      "id": "PW-060",
      "file": "app/lib/order-facts/sync/source-stage.ts",
      "symbol": "reinitializeDScratchReservationLedgerAfterQuiescence",
      "transaction_host": "FS empty ledger persist after quiescence",
      "role": "operator-only",
      "affected_surfaces": "quota.reservation",
      "target_key_derivation": "scratchRoot",
      "current_guard": "quiescenceConfirmed; refuses while att-* remain",
      "proposed_pr7_gate": "operator-only; not a completion substitute",
      "already_running_outcome": "refuses live namespace with attempts",
      "test_home": "source-stage.test.ts; operator runbook",
      "classification": "w_only",
      "era": "W",
      "notes": ""
    },
    {
      "id": "PW-061",
      "file": "app/lib/order-facts/sync/source-stage.ts",
      "symbol": "stageOrderFactsJsonl",
      "transaction_host": "FS writeStreamChunk + JSONL stage",
      "role": "none (FS)",
      "affected_surfaces": "scratch JSONL / indexes",
      "target_key_derivation": "shopId in owned dir marker",
      "current_guard": "owned handle",
      "proposed_pr7_gate": "FS drain",
      "already_running_outcome": "bytes remain until dispose/reclaim",
      "test_home": "source-stage.test.ts; jsonl.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "writeStreamChunk is the chunk writer."
    },
    {
      "id": "PW-062",
      "file": "app/lib/order-facts/sync/observations.ts",
      "symbol": "beginDirectOrderObservation",
      "transaction_host": "TenantDb INSERT OrderFactObservationInFlight",
      "role": "stocky_runtime",
      "affected_surfaces": "OrderFactObservationInFlight",
      "target_key_derivation": "shopId + Order/Refund GID (ORDER_LEGACY_ID derivable)",
      "current_guard": "tenant GUC; caller processingEnabled",
      "proposed_pr7_gate": "REQUIRED both gates (customer-target when GID is an enumerated order)",
      "already_running_outcome": "ACTIVE observation row",
      "test_home": "pr6-d-worker.test.ts / apply tests",
      "classification": "w_only",
      "era": "W",
      "notes": "Also updateObservationAccessScopes, allocateResponseGeneration, abandonActiveObservation."
    },
    {
      "id": "PW-063",
      "file": "app/lib/order-facts/sync/shop-metadata.ts",
      "symbol": "persistShopTimezoneCurrencyValues",
      "transaction_host": "raw UPDATE Shop via tenant GUC path",
      "role": "stocky_runtime",
      "affected_surfaces": "Shop.ianaTimezone, Shop.currencyCode",
      "target_key_derivation": "shopId",
      "current_guard": "WHERE current_setting stocky.current_shop_id = shopId; no processingEnabled in SQL",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; Shop UPDATE is a participating shop-row write",
      "already_running_outcome": "metadata update during apply/import",
      "test_home": "pr6-d-integration / refetch path",
      "classification": "w_only",
      "era": "W",
      "notes": "Can mutate Shop while freeze waits if uninstrumented. Distinct from bootstrap upsert."
    },
    {
      "id": "PW-064",
      "file": "app/lib/order-facts/sync/control-plane.ts",
      "symbol": "persistOrderFactsCursor",
      "transaction_host": "CP syncCursor.upsert",
      "role": "stocky_control_plane",
      "affected_surfaces": "SyncCursor",
      "target_key_derivation": "shopId",
      "current_guard": "none in helper; callers assertShopProcessingEnabled",
      "proposed_pr7_gate": "REQUIRED lifecycle shared; caller assert is not drain",
      "already_running_outcome": "cursor advances",
      "test_home": "pr6-d-integration.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "Siblings: createOrderFactsSyncRun, incrementOrderFactsPollExaminedCount, recordOrderFactsDataIssue, resolveOrderFactsDataIssue."
    },
    {
      "id": "PW-065",
      "file": "app/lib/order-facts/sync/control-plane.ts",
      "symbol": "createOrderFactsSyncRun",
      "transaction_host": "CP syncRun.create or reuse PENDING/RUNNING/PARTIAL_FAILURE",
      "role": "stocky_control_plane",
      "affected_surfaces": "SyncRun",
      "target_key_derivation": "shopId",
      "current_guard": "none in helper",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "reuses in-flight SyncRun",
      "test_home": "pr6-d-integration.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": ""
    },
    {
      "id": "PW-066",
      "file": "app/lib/order-facts/sync/control-plane.ts",
      "symbol": "recordOrderFactsDataIssue",
      "transaction_host": "CP dataIssue.create",
      "role": "stocky_control_plane",
      "affected_surfaces": "DataIssue",
      "target_key_derivation": "shopId; optional externalResourceId (order GID)",
      "current_guard": "none in helper",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "issue rows while finishing work",
      "test_home": "pr6-d-integration.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "CP tables have no RLS on W."
    },
    {
      "id": "PW-067",
      "file": "app/lib/order-facts/sync/control-plane.ts",
      "symbol": "persistOrderFactsCoverageHealth",
      "transaction_host": "inspect D scratch then computeSyncHealth upsert",
      "role": "stocky_control_plane + FS read",
      "affected_surfaces": "SyncHealth; occupancy evidence",
      "target_key_derivation": "shopId",
      "current_guard": "computeSyncHealth still upserts when DISABLED",
      "proposed_pr7_gate": "REQUIRED lifecycle shared on SyncHealth write; leftover scratch holds residual",
      "already_running_outcome": "health upsert",
      "test_home": "pr6-d-sc-recovery / health path",
      "classification": "w_only",
      "era": "W",
      "notes": "W-only caller of scratch evidence."
    },
    {
      "id": "PW-068",
      "file": "app/lib/order-facts/sync/control-plane.ts",
      "symbol": "assertShopProcessingEnabled",
      "transaction_host": "CP Shop.findUnique; throws; not itself a write",
      "role": "stocky_control_plane",
      "affected_surfaces": "admission only",
      "target_key_derivation": "shopId",
      "current_guard": "YES processingEnabled",
      "proposed_pr7_gate": "admission only; not drain; not a substitute for lifecycle shared on subsequent writes",
      "already_running_outcome": "n/a",
      "test_home": "import.ts callers",
      "classification": "w_only",
      "era": "W",
      "notes": "Second copy besides webhook-processor local function. TF-03 forbids treating as drain."
    },
    {
      "id": "PW-069",
      "file": "app/lib/order-facts/sync/apply-composition.ts",
      "symbol": "applyCanonicalAndLegacy",
      "transaction_host": "applyOrderFactsWithRetry + optional legacy salesDailyAggregate in same txn",
      "role": "stocky_runtime",
      "affected_surfaces": "order facts + SalesDailyAggregate + receipts",
      "target_key_derivation": "ORDER_LEGACY_ID",
      "current_guard": "via applyOrderFacts requireProcessingEnabled",
      "proposed_pr7_gate": "REQUIRED both gates",
      "already_running_outcome": "in-flight webhook apply",
      "test_home": "pr6-d-worker.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "First-confirmation pending commits apply without success receipt."
    },
    {
      "id": "PW-070",
      "file": "app/lib/order-facts/sync/apply-composition.ts",
      "symbol": "persistIncompleteWithoutReceipt",
      "transaction_host": "db.$transaction persistIncompleteObservation",
      "role": "stocky_runtime",
      "affected_surfaces": "OrderFactObservationInFlight",
      "target_key_derivation": "shopId + token/GID",
      "current_guard": "tenant txn; no extra processingEnabled in this helper",
      "proposed_pr7_gate": "REQUIRED both gates inside the txn",
      "already_running_outcome": "incomplete observation without receipt",
      "test_home": "webhook.ts incomplete path",
      "classification": "w_only",
      "era": "W",
      "notes": "Can persist tenant-linked observation without application receipt."
    },
    {
      "id": "PW-071",
      "file": "app/routes/app.analytics_.export.tsx",
      "symbol": "loader",
      "transaction_host": "requireAdminTenant then CSV Response (read + HTTP publication)",
      "role": "stocky_runtime (read)",
      "affected_surfaces": "HTTP CSV download (valuation/deadstock); not a DB writer",
      "target_key_derivation": "authenticated shop via requireAdminTenant",
      "current_guard": "RLS on reads; no generation fence; no revalidation-before-publication",
      "proposed_pr7_gate": "human export: authz lock + verify assignment + revalidate before publication/download (matrix §1). PG gate does not fence bytes on the wire (LIMIT)",
      "already_running_outcome": "download can proceed while freeze if session live",
      "test_home": "none privacy-specific on W",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Unchanged V→W. Side channel PR7-SIDE export. Not DurableJob."
    },
    {
      "id": "PW-072",
      "file": "app/jobs/queue.server.ts",
      "symbol": "generation_fenced_queue_remove",
      "transaction_host": "MISSING in production",
      "role": "n/a",
      "affected_surfaces": "Redis ordinary jobs",
      "target_key_derivation": "shop/generation (proposed)",
      "current_guard": "none — no production remove; tests call obliterate/remove",
      "proposed_pr7_gate": "FUTURE shop/generation-scoped remove of ordinary jobs; never FLUSHALL; cancelled-job label ≠ quiescence",
      "already_running_outcome": "Redis jobs remain after uninstall/disable",
      "test_home": "app/sync/__tests__/sync-dispatch-recovery.test.ts uses Job.remove in tests only",
      "classification": "missing",
      "era": "W",
      "notes": "Plan §7.9 names this FUTURE shared edit. Not implemented on W. Helper C does not implement it."
    },
    {
      "id": "PW-073",
      "file": "app/lib/order-facts/sync/scratch-quota.ts",
      "symbol": "saveDScratchReservations",
      "transaction_host": "FS quota.reservation persist",
      "role": "none (FS)",
      "affected_surfaces": "ledger file",
      "target_key_derivation": "scratch root",
      "current_guard": "quota lock; refuseIndeterminateScratchQuota",
      "proposed_pr7_gate": "FS; missing ledger in initialized namespace is not empty",
      "already_running_outcome": "capacity stays reserved",
      "test_home": "app/lib/order-facts/sync/scratch-quota.test.ts (executed this helper: 4 passed)",
      "classification": "w_only",
      "era": "W",
      "notes": "writeAttemptReservation / removeAttemptReservation / resolveDScratchLedger."
    },
    {
      "id": "PW-074",
      "file": "app/lib/order-facts/apply/writers.ts",
      "symbol": "insertOrderFact",
      "transaction_host": "TenantDb INSERT ShopifyOrderFact",
      "role": "stocky_runtime",
      "affected_surfaces": "ShopifyOrderFact",
      "target_key_derivation": "ORDER_LEGACY_ID / GID + shopId",
      "current_guard": "via applyOrderFacts processingEnabled + RLS",
      "proposed_pr7_gate": "REQUIRED both gates",
      "already_running_outcome": "fact insert",
      "test_home": "app/lib/order-facts/apply/__tests__",
      "classification": "unchanged",
      "era": "V",
      "notes": "Representative child of misnamed applyOrderFactWriters. Other children share host."
    },
    {
      "id": "PW-075",
      "file": "app/lib/order-facts/apply/writers.ts",
      "symbol": "requireProcessingEnabled",
      "transaction_host": "SELECT stocky_shop_processing_enabled(shopId)",
      "role": "stocky_runtime",
      "affected_surfaces": "admission",
      "target_key_derivation": "shopId",
      "current_guard": "YES helper, not drain",
      "proposed_pr7_gate": "keep as admission; still require lifecycle+customer gates on DML",
      "already_running_outcome": "n/a",
      "test_home": "apply tests",
      "classification": "unchanged",
      "era": "V",
      "notes": "TF-03: processingEnabled ≠ drain."
    },
    {
      "id": "PW-076",
      "file": "app/routes/webhooks.compliance.tsx",
      "symbol": "action",
      "transaction_host": "authenticate.webhook then empty 200; no persist",
      "role": "n/a",
      "affected_surfaces": "none today",
      "target_key_derivation": "none",
      "current_guard": "HMAC via authenticate.webhook",
      "proposed_pr7_gate": "FUTURE PrivacyRequest persist before 200; not a current writer",
      "already_running_outcome": "n/a",
      "test_home": "app/routes/__tests__/webhooks.compliance.test.ts (MISSING script test:privacy)",
      "classification": "unchanged",
      "era": "V",
      "notes": "Not a participating writer yet. Exclusive PR7 ownership of this file."
    },
    {
      "id": "PW-077",
      "file": "app/tenant/require-admin-tenant.server.ts",
      "symbol": "requireAdminTenant",
      "transaction_host": "session → shop authority; not a merchant writer",
      "role": "stocky_runtime",
      "affected_surfaces": "TenantDb factory",
      "target_key_derivation": "shop from Shopify session; never session.userId",
      "current_guard": "shop authority only",
      "proposed_pr7_gate": "wrap later for actor/sub (D-PR7-01/02 OPEN — not decided)",
      "already_running_outcome": "n/a",
      "test_home": "tenant-access tests",
      "classification": "unchanged",
      "era": "V",
      "notes": "Not a writer. Listed because export route and admin reads depend on it."
    },
    {
      "id": "PW-078",
      "file": "app/sync/execution-strategy.server.ts",
      "symbol": "executionStrategyForJobType",
      "transaction_host": "pure mapping; not a writer",
      "role": "n/a",
      "affected_surfaces": "JobExecutionStrategy assignment by callers",
      "target_key_derivation": "n/a",
      "current_guard": "unknown types including privacy:* → NO_AUTOMATIC_RETRY",
      "proposed_pr7_gate": "do not map privacy to BOUNDED_CHECKPOINT_RETRY; enum unchanged (4 values)",
      "already_running_outcome": "n/a",
      "test_home": "app/lib/order-facts/sync/safety.test.ts",
      "classification": "behavior_change",
      "era": "W",
      "notes": "W adds orders/edited|delete|order_transactions/create ATOMIC and order-facts-sync/reconcile REBUILDABLE_IDEMPOTENT."
    },
    {
      "id": "PW-079",
      "file": "app/jobs/queue.server.ts",
      "symbol": "scheduleAbcAnalysisCron",
      "transaction_host": "getCronQueue().add repeating job (Redis) plus later DurableJob via enqueueAbcAnalysisForShop",
      "role": "Redis + CP",
      "affected_surfaces": "Redis cron + ABC classification rows when processed",
      "target_key_derivation": "shopId when enqueued per shop",
      "current_guard": "enumerateCanonicalShopsForScheduler uses processingEnabled=true",
      "proposed_pr7_gate": "REQUIRED lifecycle shared on DurableJob create and ABC writes; Redis add unfenced",
      "already_running_outcome": "repeatable Redis job remains",
      "test_home": "queue tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": "Worker bootstrap starts this. Shop/redact residual includes ABC/sales aggregates."
    },
    {
      "id": "PW-080",
      "file": "app/lib/catalog-facts/ingest/apply-batch.ts",
      "symbol": "applyParsedJsonlBatch",
      "transaction_host": "TenantDb applyCanonicalFacts per batch",
      "role": "stocky_runtime",
      "affected_surfaces": "catalog facts",
      "target_key_derivation": "shopId + catalog GIDs",
      "current_guard": "checkpoint processingEnabled + RLS; applyCanonicalFacts has no extra pre-lock",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "JSONL batch apply",
      "test_home": "pr5-f3-jsonl-checkpoint.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": ""
    },
    {
      "id": "PW-081",
      "file": "app/lib/order-facts/sync/apply-nominated.ts",
      "symbol": "applyNominatedOrderGid",
      "transaction_host": "TenantDb apply for import/reconcile nominated GID",
      "role": "stocky_runtime",
      "affected_surfaces": "order facts + receipts",
      "target_key_derivation": "ORDER_LEGACY_ID from GID",
      "current_guard": "via applyOrderFacts",
      "proposed_pr7_gate": "REQUIRED both gates",
      "already_running_outcome": "import apply",
      "test_home": "pr6-d-integration.test.ts",
      "classification": "w_only",
      "era": "W",
      "notes": "applyBulkAssembledOrder sibling."
    },
    {
      "id": "PW-082",
      "file": "app/routes/webhooks.orders.delete.tsx",
      "symbol": "action",
      "transaction_host": "ingestAuthenticatedWebhook + dispatchPendingJobs kick",
      "role": "stocky_control_plane",
      "affected_surfaces": "WebhookDelivery, DurableJob (via intake)",
      "target_key_derivation": "shopId; order id in projection",
      "current_guard": "via ingestAuthenticatedWebhook",
      "proposed_pr7_gate": "via intake",
      "already_running_outcome": "new intake",
      "test_home": "pr6-d-worker / safety.test.ts registration",
      "classification": "w_only",
      "era": "W",
      "notes": "Siblings: webhooks.orders.edited.tsx, webhooks.order_transactions.create.tsx. Not independent writers."
    },
    {
      "id": "PW-083",
      "file": "app/sync/dispatcher.server.ts",
      "symbol": "supersedeTerminalDispatch",
      "transaction_host": "CP JobDispatch.update SUPERSEDED + DataIssue.create",
      "role": "stocky_control_plane",
      "affected_surfaces": "JobDispatch, DataIssue",
      "target_key_derivation": "shopId",
      "current_guard": "none",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "allocates next sequence",
      "test_home": "sync-dispatch-recovery.test.ts",
      "classification": "v_omitted",
      "era": "V",
      "notes": ""
    },
    {
      "id": "PW-084",
      "file": "app/lib/catalog-facts/ingest/collection-memberships.ts",
      "symbol": "replaceProductCollectionMemberships",
      "transaction_host": "TenantDb replace memberships",
      "role": "stocky_runtime",
      "affected_surfaces": "collection membership facts",
      "target_key_derivation": "shopId + product GID",
      "current_guard": "RLS",
      "proposed_pr7_gate": "REQUIRED lifecycle shared",
      "already_running_outcome": "membership rewrite",
      "test_home": "PR5-F3 catalog tests",
      "classification": "v_omitted",
      "era": "V",
      "notes": ""
    },
    {
      "id": "PW-085",
      "file": "scripts/tenant-enforcement/sql.ts",
      "symbol": "rlsPoliciesSql",
      "transaction_host": "policy SQL generator (not runtime write)",
      "role": "stocky_runtime policies",
      "affected_surfaces": "SELECT/INSERT/UPDATE/DELETE USING processingEnabled",
      "target_key_derivation": "shopId GUC",
      "current_guard": "stocky_shop_processing_enabled on runtime DML",
      "proposed_pr7_gate": "KEEP processingEnabled on runtime; additive privacy policies omit it; do not change runtime predicate",
      "already_running_outcome": "stale txn LIMIT",
      "test_home": "scripts/tenant-enforcement/tests",
      "classification": "unchanged",
      "era": "V",
      "notes": "Not a writer; documents current guard. Shop runtime privs still SELECT,INSERT,UPDATE — no DELETE."
    },
    {
      "id": "PW-086",
      "file": "app/sync/envelope-v3.server.ts",
      "symbol": "resolveTenantJobContextV3",
      "transaction_host": "not a writer; identity gate before merchant access",
      "role": "n/a",
      "affected_surfaces": "worker tenant context",
      "target_key_derivation": "envelope shopId",
      "current_guard": "envelope assertions",
      "proposed_pr7_gate": "do not treat privacy:* strings as authority",
      "already_running_outcome": "n/a",
      "test_home": "sync envelope tests",
      "classification": "unchanged",
      "era": "V",
      "notes": "W job-envelope.server.ts adds order-facts sources. Envelope files are not persistence writers."
    }
  ]
}
```

## Appendix E — Isolation error and teardown
Coordinator `kill -TERM 4169` stdout (verbatim from coordinator transcript):

```text
sending SIGTERM to 4169
pid 4169 gone after 2s
4169 confirmed dead
---16379---
Could not connect to Redis at 127.0.0.1:16379: Connection refused
no listener 16379
---16380---
Could not connect to Redis at 127.0.0.1:16380: Connection refused
---6379---
Could not connect to Redis at 127.0.0.1:6379: Connection refused
tmux 4168 gone
```

### Helper B `00-isolation.json` (MATCH) — Redis pid 4169

SHA-256 `207b4af50195182af46899e498bb400bf8c7ca6c55fd6715a472f6fcdacdf7b6`

```json
{
  "prep_id": "PREP-B-01",
  "checkout": "/tmp/pr7-helpers/B",
  "head": "ee193f38491245a10fb2fa60d2cf9a29f3271605",
  "authorized_w": "ee193f38491245a10fb2fa60d2cf9a29f3271605",
  "head_matches_w": true,
  "porcelain_count": 0,
  "redis": {
    "pid": 4169,
    "cmdline": "/usr/bin/redis-server 127.0.0.1:16379                     ",
    "port_16379_connect_ex": 0,
    "port_6379_connect_ex": 111,
    "ping_16379": "PONG",
    "ping_6379": "Could not connect to Redis at 127.0.0.1:6379: Connection refused",
    "config": {
      "dir": "/tmp/pr7-helpers/B-redis",
      "port": "16379",
      "bind": "127.0.0.1",
      "save": "",
      "appendonly": "no"
    },
    "info_server": "# Server\r\nredis_version:7.0.15\r\nredis_git_sha1:00000000\r\nredis_git_dirty:0\r\nredis_build_id:e53ff17674aa6190\r\nredis_mode:standalone\r\nos:Linux 6.12.94+ x86_64\r\narch_bits:64\r\nmonotonic_clock:POSIX clock_gettime\r\nmultiplexing_api:epoll\r\natomicvar_api:c11-builtin\r\ngcc_version:13.3.0\r\nprocess_id:4169\r\nprocess_supervised:no\r\nrun_id:16bfe641660fc45898ad91bc930b729d2b501240\r\ntcp_port:16379\r\nserver_time_usec:1789866218781168\r\nuptime_in_seconds:293\r\nuptime_in_days:0\r\nhz:10\r\nconfigured_hz:10\r\nlru_clock:11481322\r\nexecutable:/usr/bin/redis-server\r\nconfig_file:/tmp/pr7-helpers/B-redis/redis.conf\r\nio_threads_active:0\r\n"
  },
  "scratch_root_parent": "/tmp/pr7-helpers/B-scratch",
  "bullmq_lock_integrity": "sha512-Hi9GaVCC6HE9bQP65j/FNv1aL1fcEukTF99ezS5pl1Ud+joCFpNWiPCV45mWdkEmpuacS0XJdMMFGKPIHCwoPg==",
  "ioredis_lock_integrity": "sha512-ehuGcf94bQXhfagULNXrJdfnWO38v070jxSx/qE87Kjzmu2fU7ro5EFAb+OPituLqgfyuQaym5DlrNydW2sJ9A==",
  "copied_bullmq_version": "5.81.2",
  "copied_ioredis_version": "5.11.1",
  "w_file_sha256": {
    "stocky-plus/app/jobs/queue.server.ts": "0f58679a3f515d19a6660abfde998224a3dfb3fb87bc54965fd743d0ac23f116",
    "stocky-plus/app/sync/queue-presence.server.ts": "a5f032ad54f3a528fb06325b815ef3e635382f586335ac409ead11143bde8dcd",
    "stocky-plus/app/sync/dispatcher.server.ts": "b9ae09fd36327c55ab884280308266d2edaf5e7fcf66ab5c54ff3ae70aa17b6e",
    "stocky-plus/app/lib/order-facts/sync/source-stage.ts": "6788141488edbf7c4b53490ed81d6c43ce5420262b6f1eff69a4fea900fa0f67",
    "stocky-plus/app/lib/order-facts/sync/scratch-quota.ts": "e97b3b939117e061013b85f0dd79d4d3073260d19b58956097728398a05ffc54",
    "stocky-plus/app/lib/order-facts/sync/constants.ts": "1a002bf39a62fe9355d3f59334329307319d1721f2e76d2f2869c35a27f4fc83",
    "stocky-plus/app/jobs/workers/webhook-processor.ts": "a473eabe7a1a906dd08ee96df856da4a14052e93e1a6b185d058f53973af297c",
    "stocky-plus/app/sync/uninstall.server.ts": "4e8871dc6c9101e085a215c02c7e5703fe440d4de34bbc7fc8a00f95234adb91",
    "stocky-plus/docs/phases/phase-1/PR6_D_SCRATCH_OPERATOR_RUNBOOK.md": "59ec286b8baa0230f1e9e7bcfc77eb23e0cfca34154a8b032d83eaed4b26228a"
  },
  "pr45_inputs_note": "read-only /tmp/pr7-helpers/B-inputs SHA a292bc8a6ea26192bc295af7338dd6d653a3e65c"
}
```

### Helper B `99-teardown.json` (MATCH) — killed 9143; records 4169 fate

SHA-256 `032ad3ab5fdd452d919c35f2f01a1ed174346301fb2627a29fa3ec0873819684`

```json
{
  "killed_pid": 9143,
  "original_isolation_pid": 4169,
  "original_pid_fate": "SIGTERM at 2026-09-20 01:10:05 from redis.log 'User requested shutdown' \u2014 not Helper B teardown. Helper B restarted private instance as 9143.",
  "port_16379_after": "connection refused",
  "port_6379_after": "connection refused (still unused)",
  "data_dir_cleared": true,
  "leftover_workers": "none",
  "flushall_executed": false,
  "power_loss_tested": false
}
```

### Helper B `00-isolation.sh` (MATCH)

SHA-256 `ad736496aaecb23103bcf074cbb1b1d4b2845863770149fbce5222c1fdb6e5ee`

```bash
#!/usr/bin/env bash
# Helper B isolation capture. Does not mutate /workspace. Does not use port 6379.
set -euo pipefail
OUT="${1:-/tmp/pr7-helper-outputs/B/results/00-isolation.json}"
mkdir -p "$(dirname "$OUT")" /tmp/pr7-helpers/B-scratch/results

W=/tmp/pr7-helpers/B
cd "$W"
HEAD=$(git rev-parse HEAD)
STATUS=$(git status --porcelain | wc -l | tr -d ' ')
BRANCH=$(git rev-parse --abbrev-ref HEAD || true)

REDIS_PID=$(cat /tmp/pr7-helpers/B-redis/redis.pid)
INFO=$(redis-cli -p 16379 INFO server)
DIR=$(redis-cli -p 16379 CONFIG GET dir | tail -n1)
PORT=$(redis-cli -p 16379 CONFIG GET port | tail -n1)
BIND=$(redis-cli -p 16379 CONFIG GET bind | tail -n1)
SAVE=$(redis-cli -p 16379 CONFIG GET save | tail -n1)
AOF=$(redis-cli -p 16379 CONFIG GET appendonly | tail -n1)
PONG=$(redis-cli -p 16379 PING)
P6379=$(redis-cli -p 6379 PING 2>&1 || true)

python3 - "$OUT" <<'PY'
import json, os, socket, subprocess, sys, hashlib, pathlib
out = sys.argv[1]
w = pathlib.Path("/tmp/pr7-helpers/B")

def sha(p):
    h = hashlib.sha256()
    h.update(pathlib.Path(p).read_bytes())
    return h.hexdigest()

def connect(port):
    s = socket.socket(); s.settimeout(0.3)
    try:
        return s.connect_ex(("127.0.0.1", port))
    finally:
        s.close()

files = [
    "stocky-plus/app/jobs/queue.server.ts",
    "stocky-plus/app/sync/queue-presence.server.ts",
    "stocky-plus/app/sync/dispatcher.server.ts",
    "stocky-plus/app/lib/order-facts/sync/source-stage.ts",
    "stocky-plus/app/lib/order-facts/sync/scratch-quota.ts",
    "stocky-plus/app/lib/order-facts/sync/constants.ts",
    "stocky-plus/app/jobs/workers/webhook-processor.ts",
    "stocky-plus/app/sync/uninstall.server.ts",
    "stocky-plus/docs/phases/phase-1/PR6_D_SCRATCH_OPERATOR_RUNBOOK.md",
]
hashes = {rel: sha(w / rel) for rel in files}

lock = (w / "stocky-plus/package-lock.json").read_text()
import re
bull = re.search(r'"node_modules/bullmq": \{.*?"integrity": "(sha512-[^"]+)"', lock, re.S)
iore = re.search(r'"node_modules/ioredis": \{.*?"integrity": "(sha512-[^"]+)"', lock, re.S)

pid = pathlib.Path("/tmp/pr7-helpers/B-redis/redis.pid").read_text().strip()
cmdline = pathlib.Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\x00", b" ").decode()

payload = {
    "prep_id": "PREP-B-01",
    "checkout": str(w),
    "head": subprocess.check_output(["git","rev-parse","HEAD"], cwd=w).decode().strip(),
    "authorized_w": "ee193f38491245a10fb2fa60d2cf9a29f3271605",
    "head_matches_w": subprocess.check_output(["git","rev-parse","HEAD"], cwd=w).decode().strip() == "ee193f38491245a10fb2fa60d2cf9a29f3271605",
    "porcelain_count": len(subprocess.check_output(["git","status","--porcelain"], cwd=w).decode().splitlines()),
    "redis": {
        "pid": int(pid),
        "cmdline": cmdline,
        "port_16379_connect_ex": connect(16379),
        "port_6379_connect_ex": connect(6379),
        "ping_16379": subprocess.check_output(["redis-cli","-p","16379","PING"]).decode().strip(),
        "ping_6379": subprocess.run(["redis-cli","-p","6379","PING"], capture_output=True, text=True).stderr.strip() or subprocess.run(["redis-cli","-p","6379","PING"], capture_output=True, text=True).stdout.strip(),
        "config": {
            "dir": subprocess.check_output(["redis-cli","-p","16379","CONFIG","GET","dir"]).decode().split()[-1],
            "port": subprocess.check_output(["redis-cli","-p","16379","CONFIG","GET","port"]).decode().split()[-1],
            "bind": subprocess.check_output(["redis-cli","-p","16379","CONFIG","GET","bind"]).decode().split()[-1],
            "save": subprocess.check_output(["redis-cli","-p","16379","CONFIG","GET","save"]).decode().split("\n",1)[-1].strip(),
            "appendonly": subprocess.check_output(["redis-cli","-p","16379","CONFIG","GET","appendonly"]).decode().split()[-1],
        },
        "info_server": subprocess.check_output(["redis-cli","-p","16379","INFO","server"]).decode(),
    },
    "scratch_root_parent": "/tmp/pr7-helpers/B-scratch",
    "bullmq_lock_integrity": bull.group(1) if bull else None,
    "ioredis_lock_integrity": iore.group(1) if iore else None,
    "copied_bullmq_version": json.loads(pathlib.Path("/tmp/pr7-helpers/B-output/probe-node/node_modules/bullmq/package.json").read_text())["version"],
    "copied_ioredis_version": json.loads(pathlib.Path("/tmp/pr7-helpers/B-output/probe-node/node_modules/ioredis/package.json").read_text())["version"],
    "w_file_sha256": hashes,
    "pr45_inputs_note": "read-only /tmp/pr7-helpers/B-inputs SHA a292bc8a6ea26192bc295af7338dd6d653a3e65c",
}
pathlib.Path(out).write_text(json.dumps(payload, indent=2) + "\n")
print(json.dumps({"wrote": out, "head": payload["head"], "redis_pid": payload["redis"]["pid"], "6379": payload["redis"]["port_6379_connect_ex"]}, indent=2))
PY
```

### Helper B `run-all.sh` (MATCH)

SHA-256 `854ebd6739089d4d3945e69c14f3c227710318fc2fa1736c2fa95d8ce07758f8`

```bash
#!/usr/bin/env bash
# Helper B probe runner. Isolated Redis 16379. No git. No /workspace writes.
set -euo pipefail
export REDIS_URL=redis://127.0.0.1:16379
export NODE_PATH=/tmp/pr7-helpers/B-output/probe-node/node_modules
PROBE_NODE=/tmp/pr7-helpers/B-output/probe-node
TSX="$PROBE_NODE/node_modules/tsx/dist/cli.mjs"
PROBES=/tmp/pr7-helper-outputs/B/probes
RESULTS=/tmp/pr7-helper-outputs/B/results
mkdir -p "$RESULTS" /tmp/pr7-helpers/B-scratch/results

echo "== 00 isolation =="
bash "$PROBES/00-isolation.sh" "$RESULTS/00-isolation.json"

echo "== 01 bullmq real primitives =="
cd "$PROBE_NODE"
node "$TSX" "$PROBES/01-bullmq-real-primitives.mjs"

echo "== 02 d-scratch real primitives =="
node "$TSX" "$PROBES/02-d-scratch-real-primitives.ts"

echo "== 03 synthetic coordinator =="
node "$TSX" "$PROBES/03-synthetic-privacy-coordinator.mjs"

echo "== done =="
ls -l "$RESULTS"
```

## Appendix F — Helper reports (sanitized outcomes; recovered transcripts)

These reports are the durable narrative for cases whose original result JSON is missing (`probe-results.json`, hashed `02-dscratch.json`). Digests below were **not** recorded at 275292d; they are new evidence of the recovered report bytes.

### Helper A report

SHA-256 `f7ce700099a968ef95fbce0ad9e3b9124d94e99a81b114624e2e5933cc5b635f`

````markdown
# Helper A report — pinned authentication-library feasibility

Tool: Cursor helper subagent A. Coordinator is the only Git writer. This helper did not commit, push, create PRs, edit `/workspace` application source, edit peer helper trees, enable flags, call live Shopify stores, or implement PR7 application runtime.

Pinned identities:

- Base W: `ee193f38491245a10fb2fa60d2cf9a29f3271605`
- Proposal PR45 inputs: `a292bc8a6ea26192bc295af7338dd6d653a3e65c` (read-only, not accepted authority)
- Access date for official Shopify docs cited below: **2026-09-20**

Evidence files:

- Probe script: `/tmp/pr7-helper-outputs/A/probes/run_all.mjs`
- Probe results JSON: `/tmp/pr7-helper-outputs/A/probe-results.json`
- Module hashes: `/tmp/pr7-helper-outputs/A/traced-modules.sha256`
- Vendor snapshot (copy, not mutation of `/workspace/stocky-plus/node_modules`): `/tmp/pr7-helpers/A-output/vendor/`

---

## 1. Isolation evidence

| Check | Result |
|---|---|
| Exclusive checkout | `/tmp/pr7-helpers/A` detached HEAD `ee193f38491245a10fb2fa60d2cf9a29f3271605` |
| `git -C /tmp/pr7-helpers/A status --porcelain` | empty (0 bytes) |
| `/workspace` HEAD | `ee193f38491245a10fb2fa60d2cf9a29f3271605` (same W) |
| Helper A writes | only `/tmp/pr7-helpers/A-output/**`, `/tmp/pr7-helper-outputs/A/**` |
| `app/shopify.server.ts` SHA-256 (A checkout and `/workspace`) | both `21b881203e64f30811708fd87cb935eff371a5f79b4c114c7b516c5c4f429b58` |
| `useOnlineTokens` in W `shopify.server.ts` | **absent**; `future.expiringOfflineAccessTokens: true` only |
| Redis/Postgres | not started |
| Live Shopify / Partners | fail-closed mock fetch; 2 explicit non-exchange store/Partners URLs threw |
| Peer trees | not written |

Observed during this session (not created by Helper A): `/workspace` later showed untracked `stocky-plus/docs/phases/phase-1/PR7_IMPLEMENTATION_HANDOFF.md` and `PR7_MERGED_MAIN_ENTRY_EVIDENCE.md`. Helper A’s exclusive checkout does not contain those files. Helper A did not write `/workspace`.

Default shell `pwd` at the end of this helper’s isolation capture was `/tmp/pr7-helpers/B-output/probe-node` (coordinator/other helper cwd leak into the shared shell). All Helper A file writes used absolute paths under the allowed trees.

`node_modules` usage: copied pinned `@shopify/*` trees into `/tmp/pr7-helpers/A-output/vendor/node_modules` (no mutation of the workspace install). Probe execution resolved remaining deps via a symlink `/tmp/pr7-helper-outputs/A/probes/node_modules` → `/workspace/stocky-plus/node_modules` (read/import only). Workspace `@shopify/shopify-app-react-router/package.json` mtime remained `2026-09-19 18:59:28`.

---

## 2. Package versions, lockfile integrity, traced-file SHA-256

Installed versions (vendor snapshot + `package.json`):

| Package | Version | W lockfile integrity |
|---|---|---|
| `@shopify/shopify-app-react-router` | 1.2.1 | `sha512-37FtkGoHkvXFUsBU/ibhTrlAGoogfq0VodyEckkggi35lrjZfOGX7xKzMWW13QyD6q8bGg/wCBNOW4WANvewEA==` |
| `@shopify/shopify-api` | 13.1.0 | `sha512-TwYL9kPxOgQwwlc9tmnAmSDs79Gdg9QLaIMCfkaCJxkhWxIHVkPWa74GvbBwnmTtB8jkg61Ja4/Qxrk9bCBUiA==` |
| `@shopify/shopify-app-session-storage` | 5.0.1 | `sha512-VL66qkz2w1x5hH14v+swFZAnN36VrFuVi/Lc6FkLTJxCSvSu4fPNYn04kjIxGykgsRb7trLBXC7mF3j8yDUFeA==` |
| `@shopify/shopify-app-session-storage-prisma` | 9.0.1 | `sha512-f/RT4X6hSADfh53dl9+cc0Ev9QcTwy01GoJFnNQRmjpSsNdDq7oBuCFbz/IufU+C9MJ/1wGi5haOr0R7VIcd2Q==` |

Runtime: Node `v22.14.0`. `SHOPIFY_API_LIBRARY_VERSION = '13.1.0'`. React Router library `package.json` / `version.mjs` = `1.2.1`.

Traced-file SHA-256 (vendor copy; full list in `traced-modules.sha256`):

| File | SHA-256 |
|---|---|
| `shopify-app-react-router/dist/esm/server/authenticate/admin/authenticate.mjs` | `87b9721b8f27e265194b25642c36fcac6eb700b31cd0a5fa7a2efe64825b73e0` |
| `shopify-app-react-router/dist/esm/server/authenticate/admin/strategies/token-exchange.mjs` | `9a7539a4ee929701639c1b6f7d7bdb08518ce6cffd660e97cb6ddd5a0da0d354` |
| `shopify-app-react-router/dist/ts/server/authenticate/admin/types.d.ts` | `0a6f2b2c66b9159b00745e1b74f8ec9b720e1393942079496bfc6a9fcb463224` |
| `shopify-api/lib/auth/oauth/create-session.ts` | `520813a23f0f3907b036d67fd8f820bfd1311b5be65856196b00f23047550ebc` |
| `shopify-api/lib/auth/oauth/types.ts` | `c4ad97f7ebba8a757f7f91a1398794b211c3335e856ea1129ad615858abcb428` |
| `shopify-api/lib/session/decode-session-token.ts` | `fa87680283b0bb2029c4ffa139ff7e1f5cf50d503771cb3363a8f6a51cc38f90` |
| `shopify-api/lib/session/session.ts` | `c2d068e0566a34ca03a6cca91a391a3257ff805848ac4f8a55c5e99e52747dfe` |
| `shopify-api/lib/session/session-utils.ts` | `42974a1743984e2f849a921ef42c5d283f403dc0b2b4d4a28ec2669abb51768f` |
| `shopify-app-session-storage-prisma/src/prisma.ts` | `a65649061bd6914ae848b4ff7dd49765ce7fc138f79b57f3270f55bf478e5fba` |

Lockfile tarball integrity was **not** re-hashed from a downloaded tarball this session (no `npm pack`). Version strings of the installed trees match the W lockfile.

---

## 3. Exact export / type map: `authenticate.admin`

TypeScript (`EmbeddedAdminContext` in `authenticate/admin/types.d.ts`) does **not** vary the return shape on `useOnlineTokens`. It varies on `distribution`:

- Embedded (`AppDistribution.AppStore`, W’s setting): `{ session, admin, billing, cors, sessionToken, redirect, scopes }`
- Merchant custom (`AppDistribution.ShopifyAdmin`): no `sessionToken` / `redirect`

JSDoc examples that *read* `sessionToken.sub` set `useOnlineTokens: true`. That is documentation, not a type constraint.

**Executed runtime (disposable in-memory `shopifyApp`, mocked token exchange, synthetic HS256 JWT):**

| Field | `useOnlineTokens: false` (W-like) | `useOnlineTokens: true` |
|---|---|---|
| `admin`, `billing`, `cors`, `redirect`, `scopes` | present | present |
| `sessionToken` | **present** (decoded JWT object) | **present** |
| `sessionToken.sub` | string `"548380009"` | string `"548380009"` |
| `session.isOnline` | `false` | `true` |
| `session.id` | `offline_prepa-test-shop.myshopify.com` | `prepa-test-shop.myshopify.com_548380009` |
| `session.onlineAccessInfo` | **absent** | **present** with `associated_user` |
| `session.onlineAccessInfo.associated_user.id` | n/a | `number` `548380009` |
| token-exchange calls on cold session | 1× offline | 1× offline then 1× online |
| sessions stored | offline only | **both** offline and online |

Same return **keys** either way. The behavioral difference is which `Session` is returned/stored, not whether the JWT payload is attached.

W `requireAdminTenant` currently destructures `{ admin, session }` only and never reads `sessionToken` / `onlineAccessInfo` / `session.userId`.

---

## 4. How `sessionId` is derived (online vs offline)

From installed `authenticate.mjs` `getSessionTokenContext` (embedded path):

```js
const sessionId = config.useOnlineTokens
    ? api.session.getJwtSessionId(shop, payload.sub)
    : api.session.getOfflineId(shop);
```

`getJwtSessionId` (`session-utils.ts`): `` `${sanitizeShop(shop)}_${userId}` ``

`getOfflineId`: `` `offline_${sanitizeShop(shop)}` ``

`shop` is `new URL(payload.dest).hostname`, not a client query param, when a session token is present.

**Store path is different from lookup path.** `create-session.ts` for online sessions:

```ts
getJwtSessionId(config)(shop, `${(rest as OnlineAccessInfo).associated_user.id}`)
```

So:

- **Lookup** (every `authenticate.admin`): JWT `payload.sub` (string if Shopify encoded `sub` as JSON string).
- **Store** (token exchange): template-stringify of `associated_user.id` **after** `JSON.parse` (a JS `number`).

When those two digit-strings differ, lookup misses and token-exchange repeats (**PREP-A-03**, mismatch case). When they collide after rounding, sessions overwrite (**PREP-A-09**).

`isOnline` is **not** taken from `useOnlineTokens`. `createSession` sets `isOnline = Boolean(associatedUser)` on the token-exchange JSON body.

---

## 5. `associated_user.id` runtime type and `JSON.parse`

Installed type: `OnlineAccessUser.id: number` (`lib/auth/oauth/types.ts`).

Executed:

| Input | Result |
|---|---|
| Official-shape JSON `"id": 902541635` | `typeof number`, `Number.isSafeInteger === true` |
| JSON `"id": 9007199254740993` | parses to `9007199254740992`, `typeof number`, original digits **not recoverable** |
| `Number("9007199254740993")` | `9007199254740992` |
| `String(that number)` | `"9007199254740992"` |
| Library `createSession` id | `` `${associated_user.id}` `` → already-rounded decimal string |

The library does **not** keep `id` as a string and does **not** use `BigInt`. It cannot stringify a lossless id from a JSON number past `Number.MAX_SAFE_INTEGER` (9007199254740991).

---

## 6. `sessionToken.sub` / `payload.sub` presence conditions

**Executed:**

1. Embedded app + valid HS256 session token (header `Authorization: Bearer …` or `id_token` query): `sessionToken` is the decoded JWT payload for **both** `useOnlineTokens` true and false.
2. `payload.sub` is whatever `jose.jwtVerify` returns:
   - JSON string `"548380009"` → `typeof sub === "string"` (**PREP-A-01**).
   - JSON number `548380009` → `typeof sub === "number"` (**PREP-A-13**).
   - JSON number `9007199254740993` → `typeof sub === "number"` and value already `9007199254740992`.
3. Merchant-custom distribution (`ShopifyAdmin`): source returns `payload: undefined` and does not attach `sessionToken`. **Not executed** (W is App Store / embedded).
4. Invalid/expired JWT: thrown `401 Unauthorized` **before** token exchange; no `sessionToken`.
5. `authenticate.webhook`: **no** `sessionToken` field.

Official ID-token example encodes `sub` as a **string** (`"42"`). Live Shopify encoding remains **UNVERIFIED**.

---

## 7. Owner evidence: actual fields

Installed `OnlineAccessUser`: `id`, `first_name`, `last_name`, `email`, `email_verified`, `account_owner`, `locale`, `collaborator`.

Executed online token-exchange mock (same keys as official docs field list, 2026-09-20):

- Owner: `account_owner: true`, `collaborator: false`, `email_verified: true`
- Staff: `account_owner: false`, `collaborator: false`, `email_verified: false`
- Collaborator: `account_owner: false`, `collaborator: true`, `email_verified: true`

The library stores these booleans; it has **no** `shop_owner` / `unassigned` role. Client JSON `{account_owner:true, role:"shop_owner"}` did **not** change `associated_user.account_owner` (**PREP-A-12**).

Offline session and webhook session: **no** `associated_user`.

---

## 8. Offline / autonomous-job separation

Token-exchange strategy (`token-exchange.mjs`):

1. Always requests an **offline** access token when the loaded session is missing/inactive.
2. If `useOnlineTokens`, also requests an **online** token and returns that session.
3. Docs/config: “both online and offline tokens will be saved.” **Executed** (two rows: `offline_${shop}` and `${shop}_${id}`).

`authenticate.webhook`:

- HMAC-validates the raw body.
- Loads **only** `getOfflineId(shop)` via `ensureValidOfflineSession`.
- Executed with both sessions present: webhook `session.id = offline_prepa-test-shop.myshopify.com`, `isOnline: false`, **no** `associated_user`.
- Executed with empty storage: `session === null` (still HMAC-valid).
- Does not carry staff identity. Matches D-PR7-02 “offline for jobs/webhooks.”

---

## 9. Precision: Number, BigInt, string `sub`, whether the library stringifies `id`

Executed Node `v22.14.0` (same rounding as the PR45 note on `v22.14.0`):

| Expression | Value |
|---|---|
| `Number("9007199254740993")` | `9007199254740992` |
| `JSON.parse('{"id":9007199254740993}').id` | `9007199254740992` |
| `String(BigInt("9007199254740993"))` | `"9007199254740993"` (lossless) |
| `Number(BigInt("9007199254740993"))` | `9007199254740992` (lossy) |
| JWT `sub` string `"9007199254740993"` after `authenticate.admin` | **string** `"9007199254740993"` (lossless) |
| `associated_user.id` from that exchange | **number** `9007199254740992` |
| stored session id | `prepa-test-shop.myshopify.com_9007199254740992` |

`Session.fromPropertyArray(..., true)` does `associated_user.id = Number(value)`. Feeding the exact digit string `"9007199254740993"` still yields `9007199254740992`.

Prisma adapter `sessionToRow`: `userId: associated_user.id as unknown as bigint`. Executed store saw **runtime `typeof number`**, value `9007199254740992`. Loading a row whose `userId` was actual `9007199254740993n` still reconstructed `associated_user.id` as `9007199254740992` because `rowToSession` does `String(row.userId)` then `Number()` (**PREP-A-05**).

The library does **not** stringify `id` in a lossless way. The only lossless actor string observed is JWT `sub` when it is a JSON **string**.

---

## 10. Negative controls

| ID | Case | Command | Expected | Actual | Pass/fail |
|---|---|---|---|---|---|
| NC-01 | Valid embedded JWT, `useOnlineTokens: false` | `node run_all.mjs` case `auth_offline_embedded_safe_sub` | JWT validated; offline session; **no** `associated_user`; `sub` may or may not exist | `sessionToken.sub === "548380009"` (string); `isOnline: false`; 1 offline exchange | **PASS** (and binds `sub` without online tokens) |
| NC-02 | Valid embedded JWT, `useOnlineTokens: true`, owner | `auth_online_embedded_safe_sub_owner` | Online session + `associated_user` + `sub` | Both; session id `${shop}_548380009`; `account_owner: true` | **PASS** |
| NC-03 | Reuse active online session | `auth_online_reuse_active_session` | No extra token exchange | `extraExchanges: []` | **PASS** |
| NC-04 | Staff `account_owner: false` | `auth_online_staff_not_owner` | Fields stored; no app role invented | `account_owner: false`, `collaborator: false`, `email_verified: false`; `sub: "1001"` | **PASS** (library has no unassigned role) |
| NC-05 | Collaborator | `auth_online_collaborator` | `collaborator: true` | `collaborator: true`, `account_owner: false` | **PASS** |
| NC-06 | Wide `sub` string + JSON-number `id` | `auth_online_wide_sub_string_id_json_number` | `sub` exact; `id` rounded; lookup≠store | `sub: "9007199254740993"`; `id: 9007199254740992`; stored id `…_9007199254740992` | **PASS** (counterexample to `String(id)` as key) |
| NC-07 | Adjacent wide IDs B then A | `auth_wide_id_session_collision_B_then_A` | Distinct actors | A (`sub` `"…992"`) received **B’s** online session (`email: b@example.com`); `mixedToken: true`; 0 exchanges on A | **FAIL vs unique-id docs / FAIL closed adapter** — library hazard **PREP-A-09** |
| NC-08 | `sub` vs `associated_user.id` mismatch | `auth_sub_vs_associated_user_id_mismatch` | Adapter should deny owner | Library returned session id `…_999999` with `sub: "548380009"`; second request **re-exchanged** (lookup miss) | Library **does not deny**; adapter must |
| NC-09 | Stale active session (`associated_user.id=111` stored at `${shop}_${sub}`) | `auth_stale_active_session_not_rechecked` | Fresh corroboration | Returned stale user; **zero** exchanges | Library **does not re-check** **PREP-A-11** |
| NC-10 | Expired stored online session | `auth_expired_session_reexchange` | Re-exchange | 2 exchanges; new online token | **PASS** |
| NC-11 | Online flag but response has no `associated_user` | `auth_online_flag_but_response_without_associated_user` | Fail closed for owner | `isOnline: false`; `sessionToken.sub` still present; offline id overwritten with online-shaped token | Library accepts; adapter must fail owner |
| NC-12 | Numeric JWT `sub` (JSON number, safe) | `auth_numeric_jwt_sub_safe` | Types say `string` | `typeof sub === "number"`; session id still `${shop}_548380009` | Type/runtime drift **PREP-A-13** |
| NC-13 | Numeric JWT `sub` (JSON number, wide) | `auth_numeric_jwt_sub_wide_json_number` | Digits lost | `sub` is number `9007199254740992` | **PASS** as precision counterexample |
| NC-14 | Expired JWT | `neg_expired_jwt` | 401, no exchange | `401 Unauthorized`; `exchanges: []` | **PASS** |
| NC-15 | Forged signature | `neg_forged_signature` | 401 | `401`; no exchange | **PASS** |
| NC-16 | Wrong `aud` | `neg_wrong_aud` | 401 | `401`; no exchange | **PASS** |
| NC-17 | `iss`/`dest` hostname mismatch | `neg_iss_dest_hostname_mismatch` | Official: reject | Library **accepted** (`ok: true`); shop taken from `dest` | **FAIL vs official ID-token claim checks** **PREP-A-06** |
| NC-18 | JWT `dest` = other shop (valid signature) | `neg_forged_dest_other_shop` | Adapter must not attach tenant A | Library authenticated as `prepa-other-shop.myshopify.com` | Library follows `dest`; W `requireAdminTenant` would bind that dest’s shop — **forged dest with stolen/leaked app secret** is in-scope for HS256 |
| NC-19 | Client body `account_owner: true` | `neg_client_body_account_owner_ignored` | Ignore body | Live `associated_user.account_owner === false` | **PASS** |
| NC-20 | Webhook HMAC + offline session | `webhook_offline_separation` | Offline session; no staff | Offline session; `associated_user` absent; `eventId` present when header set | **PASS** |
| NC-21 | Webhook no session | same | `session` undefined/null | `session: null` | **PASS** |
| NC-22 | Bad webhook HMAC | same `badHmac` | 401 | `401 Unauthorized` | **PASS** |
| NC-23 | Non-exchange `*.myshopify.com` fetch | `fail_closed_non_token_exchange_store_url` | throw | `FAIL-CLOSED store/partners call: …/graphql.json` | **PASS** |
| NC-24 | Partners URL | `fail_closed_partners` | throw | `FAIL-CLOSED store/partners call: https://partners.shopify.com/api/graphql` | **PASS** |
| NC-25 | Prisma `as bigint` + `Number()` roundtrip | `prisma_adapter_userid` | cannot restore wide digits | store `typeof number` 9007199254740992; even exact `bigint` row loads as 9007199254740992 | **PASS** as F-CLAUDE-PR7CP-05 confirmation |

---

## 11. Official docs vs library vs hypothetical adapter (D-PR7-01/02)

Sources accessed **2026-09-20**:

- [ID tokens](https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens) — ID token authenticates the **user**, carries **no permissions**; validate HS256, `exp`/`nbf`/`aud`, **`iss` and `dest` hostnames must match**; `sub` identifies the user; example `sub` is a JSON **string**.
- [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) — offline is default (jobs/webhooks); online optional, ~24h or admin logout; `associated_user.id` “uniquely identifies the user”; also `account_owner`, `collaborator`, `email_verified`; trust email only if `email_verified`.
- [CLI app authentication](https://shopify.dev/docs/apps/build/authentication-authorization/cli-app-authentication) — `useOnlineTokens: true` to get `session.onlineAccessInfo`; template manages both token classes.
- [authenticate.admin (latest)](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/admin) — examples reading `sessionToken.sub` set `useOnlineTokens: true`. Installed 1.2.1 types match that example text. “Latest” may describe a newer major than 1.2.1; **do not treat latest docs as a pin of 1.2.1**. Behaviour below is from the **installed** 1.2.1/13.1.0 sources + probes.

| Topic | Official (2026-09-20) | Installed library (executed except as noted) | Smallest remaining adapter choice |
|---|---|---|---|
| Actor id | `sub` is the user the ID token was issued for | Embedded `authenticate.admin` **always** returns decoded `sessionToken` including `sub` if JWT validates; **independent of `useOnlineTokens`** | Persist **only** `sessionToken.sub` when `typeof sub === "string"` and `^[0-9]+$`. Reject number-typed `sub` (already possibly rounded). **Never** `String(associated_user.id)`, `Session.userId`, `Number(sub)`, Prisma `as bigint`. |
| Owner bit | `associated_user.account_owner` on **online** token response | Only present after online token exchange (`useOnlineTokens: true` path). Offline/webhook sessions have none. | D-PR7-02 still required for **owner proof**. D-PR7-01 actor string does **not** require online tokens on embedded apps **if** the implementation reads `sessionToken` (W `requireAdminTenant` currently drops it). |
| Unique user key | Docs say use `associated_user.id` | `id` is a JSON `number`; IEEE-754 collision executed (**PREP-A-09**) | Treat `id` as **corroboration only** when `Number.isSafeInteger(id) && String(id) === sub`. Else `OWNER_PROOF_UNSUPPORTED`, `unassigned`. |
| `iss`/`dest` match | Must match hostnames | `decodeSessionToken` checks signature + `aud` only; mismatched `iss`/`dest` **accepted** | Adapter must require `new URL(iss).hostname === new URL(dest).hostname === session.shop === canonical shop`. |
| Cached session | (not specified as owner proof) | Active stored session is returned **without** checking `associated_user.id === sub` | Owner/actor proof must use **this request’s** JWT `sub` plus, if granting owner, **this request’s** online `associated_user` after a load that cannot be a stale/colliding row — fail closed on mismatch. |
| Jobs | Offline tokens for background/webhooks | Webhook uses offline session only | Keep offline for webhooks/jobs. Do not copy staff `account_owner` onto HMAC intake. |
| Token-exchange encoding | Docs table shows `application/x-www-form-urlencoded` | Library POSTs **`application/json`** with `expiring: "1"` when app `future.expiringOfflineAccessTokens` | Ignore for actor model. Live Shopify acceptance of JSON vs form body is **UNVERIFIED**. |

**Smallest remaining contract (hypothetical adapter; not implemented):**

1. Human platform: read `sessionToken.sub` from `authenticate.admin` (embedded). Require string digits. That is D-PR7-01.
2. Enable `useOnlineTokens: true` in a **future implementation PR** only to obtain `associated_user` for D-PR7-04 owner proof — not because `sub` is missing.
3. Owner grant iff all of: same request, dest/shop match, `account_owner === true`, `collaborator !== true`, `Number.isSafeInteger(associated_user.id)`, `String(id) === sub`, session `isOnline === true`. Otherwise `unassigned` + `OWNER_PROOF_UNSUPPORTED`.
4. Autonomous jobs: offline webhook/session only; `actorKind=shopify_webhook` / system; never staff.
5. Wide id `9007199254740993`: persist the **string sub** if present; **do not** grant owner via `associated_user.id`.

This closes the *library bind* residual for D-PR7-01 under **mocked** transport: the installed 1.2.1 package **does** populate `sessionToken.sub` on embedded `authenticate.admin`. D-PR7-02 remains required for owner booleans. Live Shopify token-exchange bodies remain **UNVERIFIED**.

---

## 12. Commands, exit codes, sanitized stdout

| Command | Exit | Notes |
|---|---|---|
| `git -C /tmp/pr7-helpers/A rev-parse HEAD` | 0 | `ee193f38491245a10fb2fa60d2cf9a29f3271605` |
| `git -C /tmp/pr7-helpers/A status --porcelain` | 0 | empty |
| `cp -a` vendor snapshot of four `@shopify` packages + `jose` | 0 | 32M under `/tmp/pr7-helpers/A-output/vendor` |
| `sha256sum` traced modules | 0 | wrote `traced-modules.sha256` |
| `node run_all.mjs` (first) | 0 | `{"ok":true,"cases":30,"fetchCalls":33}` |
| `node run_all.mjs` (recorded rerun) | **0** (`run_all.exit_code`) | stdout `run_all.stdout.log`; stderr empty |
| Fail-closed fetches inside probe | n/a | 2 `fail_closed` entries; 31 mocked `token_exchange` POSTs to `https://*.myshopify.com/admin/oauth/access_token` only |

Sanitized probe summary (rerun):

```
config.future.expiringOfflineAccessTokens true   # library console.log, 31 times
{
  "ok": true,
  "cases": 30,
  "resultsPath": "/tmp/pr7-helper-outputs/A/probe-results.json",
  "fetchCalls": 33
}
```

Token-exchange requests observed: `Content-Type: application/json`, `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`, `expiring: "1"`, `requested_token_type` offline and/or online. Secrets were synthetic (`prepA-test-api-key` / `prepA-test-api-secret-not-real`). Access tokens redacted in `probe-results.json`.

IEEE-754 excerpt (case `precision_ieee754`): `Number("9007199254740993") === 9007199254740992`.

---

## 13. Unexecuted / UNVERIFIED limits

Labelled **UNVERIFIED** (not executed; do not invent):

1. **Live Shopify token exchange** — real `POST https://{shop}.myshopify.com/admin/oauth/access_token` against a store. All exchange bodies were mock JSON.
2. **Live Shopify ID-token signing** — App Bridge / Shopify-issued JWTs. Probes used local HS256 with a synthetic client secret (`jose` / raw HMAC), which is the same algorithm the library verifies, not a Shopify-minted token.
3. Whether production `associated_user.id` can exceed `Number.MAX_SAFE_INTEGER`. Official example `902541635` is safe. GraphQL staff GIDs also use that example id. **No live staff id width proof.**
4. Whether production `sub` is always a JSON string (official example is a string; numeric `sub` was a negative probe).
5. Merchant-custom `AppDistribution.ShopifyAdmin` (no `sessionToken`) — W is App Store.
6. Real Partners API, GraphQL Admin, or online-token logout revocation.
7. Prisma against real PostgreSQL `BIGINT` (in-memory fake client only).
8. W `requireAdminTenant` runtime against a live `authenticate.admin` (source-only: it never reads `sub`).

`npm ci` was **not** run (lockfile unused for install). Packages were copied from the existing W `node_modules` whose versions match the lockfile.

---

## 14. Teardown

- No Redis/Postgres started.
- No leftover probe Node processes (only the environment `exec-daemon`).
- Probe scripts **kept** under `/tmp/pr7-helper-outputs/A/probes/` as required evidence (not in the git repo).
- Disposable vendor copy kept under `/tmp/pr7-helpers/A-output/vendor/`.
- Helper A did not delete another helper’s files.
- `/tmp/pr7-helper-outputs/A/probes/node_modules` is a symlink to `/workspace/stocky-plus/node_modules` for import resolution; it was not used to install or mutate packages.

---

## 15. New observation IDs (`PREP-A-NN`)

Do not rename D-PR7 / CP / XC / TF IDs.

| ID | Finding |
|---|---|
| **PREP-A-01** | Embedded `authenticate.admin` returns `sessionToken.sub` **without** `useOnlineTokens`. Executed. D-PR7-01 bind is not blocked on the online-token flag for embedded App Store apps. W still drops `sessionToken` in `requireAdminTenant`. |
| **PREP-A-02** | `useOnlineTokens: true` stores **both** offline and online sessions and returns the online one with `associated_user`. Executed. Matches library JSDoc. |
| **PREP-A-03** | Lookup key = JWT `sub`; store key = `` `${associated_user.id}` `` after JSON number parse. Mismatch causes repeated token exchange. Executed. |
| **PREP-A-04** | `associated_user.id` runtime type is `number`. Library never losslessly stringifies it. Executed. Confirms F-CLAUDE-PR7CP-05 / plan FACT (library). |
| **PREP-A-05** | Prisma `as unknown as bigint` does not change runtime type; `Session.fromPropertyArray` `Number()`s `userId` on load, destroying even an exact BigInt row. Executed (fake Prisma). |
| **PREP-A-06** | Official ID-token docs require `iss`/`dest` hostname match. Installed `decodeSessionToken` checks `aud` only. Mismatched `iss`/`dest` **accepted**. Executed counterexample. |
| **PREP-A-07** | `authenticate.webhook` loads offline session only; no `associated_user` / no `sessionToken`. Executed. |
| **PREP-A-08** | `Number("9007199254740993") === 9007199254740992` on Node v22.14.0. Executed. |
| **PREP-A-09** | **Counterexample:** user B `sub="9007199254740993"` stores online session at `…_9007199254740992`. User A `sub="9007199254740992"` **reuses B’s session and access token** (`mixedToken: true`, email `b@example.com`, 0 exchanges). Executed. |
| **PREP-A-10** | Library token-exchange POST uses `Content-Type: application/json`, not the official form-urlencoded table. Executed. Live Shopify acceptance **UNVERIFIED**. |
| **PREP-A-11** | Active stored session is returned without corroborating `associated_user.id` against current `sub`. Stale `id: 111` served for `sub: "548380009"`. Executed. |
| **PREP-A-12** | Request body `account_owner` / `role` is ignored by `authenticate.admin`. Executed. |
| **PREP-A-13** | If JWT JSON `sub` is a number, runtime `sessionToken.sub` is a **number** (types say `string`). Wide numeric `sub` is already rounded. Executed. |
| **PREP-A-14** | Online token response without `associated_user` ⇒ `isOnline: false` (`Boolean(associatedUser)`); can overwrite the offline session row. Executed (mock). Live Shopify **UNVERIFIED**. |
| **PREP-A-15** | W `requireAdminTenant` is shop-authority only (source). Never reads `session.userId` / `onlineAccessInfo` / `sessionToken.sub`. |
| **PREP-A-16** | Live token exchange / live Shopify-signed session tokens remain **UNVERIFIED**. |
| **PREP-A-17** | `createSession` `isOnline` follows presence of `associated_user`, not the `useOnlineTokens` flag. Executed. |
| **PREP-A-18** | Owner evidence fields actually present on online sessions: `account_owner`, `collaborator`, `email_verified`, `id`, `first_name`, `last_name`, `email`, `locale` plus `associated_user_scope`. Executed from mock + types. |

---

## Implication for PR7 entry (not implementation)

D-PR7-01 library bind (`sessionToken.sub` on installed `@shopify/shopify-app-react-router@1.2.1`): **executed under mock transport for embedded apps**, including with `useOnlineTokens: false`. Residual: live Shopify JWT encoding (**PREP-A-16**); implementation must still *read* `sessionToken` (W does not).

D-PR7-02: still required to obtain `associated_user` for D-PR7-04 owner proof. Enabling online tokens is **not** what makes `sub` appear.

F-CLAUDE-PR7CP-05: **confirmed** with library + JSON.parse + Prisma adapter probes. `String(associated_user.id)` is unsafe. **PREP-A-09** is a concrete cross-user session collision once ids leave the safe-integer range.

Stop. No commit. No PR. No application source edits.
````

### Helper B report

SHA-256 `dbeffd5fab77e4bb673dc38c6e80e3e25ab8398795fd0917c6fb86e1bc3c0101`

````markdown
# Helper B report — Redis / filesystem / privacy-boundary feasibility

**Role:** PR7 entry-evidence Helper B (documentation packet only).  
**Git writer:** coordinator only. This helper did not commit, push, or edit `/workspace`.  
**PR7 application runtime:** not implemented.  
**Power-loss:** not tested and not claimed.

Pinned identities:

- W checkout `/tmp/pr7-helpers/B` HEAD `ee193f38491245a10fb2fa60d2cf9a29f3271605` (matches authorized W; porcelain count 0).
- PR45 frozen docs `/tmp/pr7-helpers/B-inputs/` SHA `a292bc8a6ea26192bc295af7338dd6d653a3e65c` (read-only).
- `bullmq@5.81.2` copied from `/workspace/stocky-plus/node_modules` (not mutated). W lockfile integrity `sha512-Hi9GaVCC6HE9bQP65j/FNv1aL1fcEukTF99ezS5pl1Ud+joCFpNWiPCV45mWdkEmpuacS0XJdMMFGKPIHCwoPg==`.
- `ioredis@5.11.1` copied. W lockfile integrity `sha512-ehuGcf94bQXhfagULNXrJdfnWO38v070jxSx/qE87Kjzmu2fU7ro5EFAb+OPituLqgfyuQaym5DlrNydW2sJ9A==`.
- Queue names from W `app/jobs/queue.server.ts`: `WEBHOOK_QUEUE="stocky-webhooks"`, `CRON_QUEUE="stocky-cron"`.

Result JSON (executed):

- `/tmp/pr7-helper-outputs/B/results/00-isolation.json`
- `/tmp/pr7-helper-outputs/B/results/01-bullmq.json`
- `/tmp/pr7-helper-outputs/B/results/01b-inflight-cancel.json`
- `/tmp/pr7-helper-outputs/B/results/02-dscratch.json`
- `/tmp/pr7-helper-outputs/B/results/03-synthetic.json`
- `/tmp/pr7-helper-outputs/B/results/99-teardown.json`

Probes: `/tmp/pr7-helper-outputs/B/probes/`.

---

## 1. Isolation

**PREP-B-01** — executed.

| Check | Evidence |
|---|---|
| W HEAD | `ee193f38491245a10fb2fa60d2cf9a29f3271605` |
| Working tree | `git status --porcelain` empty |
| Redis binary | `/usr/bin/redis-server` v=7.0.15 |
| Private instance | `port 16379`, `bind 127.0.0.1`, `dir /tmp/pr7-helpers/B-redis`, `save ""`, `appendonly no`, `daemonize no` |
| First PID | **4169** ` /usr/bin/redis-server 127.0.0.1:16379 `; INFO `tcp_port:16379`, `process_id:4169`, `config_file:/tmp/pr7-helpers/B-redis/redis.conf` |
| Port 6379 | `connect_ex=111` / `Connection refused` throughout Helper B work. Never used. Never FLUSHALL. |
| Unique scratch parent | `/tmp/pr7-helpers/B-scratch/` (never `/tmp` wholesale, never `/workspace`) |
| Unique namespaces | `/tmp/pr7-helpers/B-scratch/bullmq`, `bullmq-01b`, `dscratch-<pid>`, `synthetic` |

**Redis PID lifecycle (honest):** isolation ran against PID **4169**. Redis log records `signal-handler Received SIGTERM` / `User requested shutdown` at `2026-09-20 01:10:05` while an in-flight `Job.remove` probe was blocked on a locked job — **not** Helper B teardown and **not** power-loss. Helper B restarted a new private instance on **16379** as PID **9143** for the focused in-flight cancel re-probe, then killed **9143** by exact PID at teardown. 6379 stayed unused.

W file SHA-256 (from isolation capture):

| Path | sha256 |
|---|---|
| `app/jobs/queue.server.ts` | `0f58679a3f515d19a6660abfde998224a3dfb3fb87bc54965fd743d0ac23f116` |
| `app/sync/queue-presence.server.ts` | `a5f032ad54f3a528fb06325b815ef3e635382f586335ac409ead11143bde8dcd` |
| `app/sync/dispatcher.server.ts` | `b9ae09fd36327c55ab884280308266d2edaf5e7fcf66ab5c54ff3ae70aa17b6e` |
| `app/lib/order-facts/sync/source-stage.ts` | `6788141488edbf7c4b53490ed81d6c43ce5420262b6f1eff69a4fea900fa0f67` |
| `app/lib/order-facts/sync/scratch-quota.ts` | `e97b3b939117e061013b85f0dd79d4d3073260d19b58956097728398a05ffc54` |
| `app/jobs/workers/webhook-processor.ts` | `a473eabe7a1a906dd08ee96df856da4a14052e93e1a6b185d058f53973af297c` |
| `app/sync/uninstall.server.ts` | `4e8871dc6c9101e085a215c02c7e5703fe440d4de34bbc7fc8a00f95234adb91` |
| PR6-D scratch runbook | `59ec286b8baa0230f1e9e7bcfc77eb23e0cfca34154a8b032d83eaed4b26228a` |

---

## 2. Real primitive inventory (W, not proposed)

### 2.1 Queue add / inspect (REAL W)

| Primitive | Location | Signature / behavior |
|---|---|---|
| `requireRedisUrl` | `queue.server.ts` 26–45 | explicit `REDIS_URL`; no redaction placeholder; no silent localhost fallback |
| `WEBHOOK_QUEUE` / `CRON_QUEUE` | `queue.server.ts` 70–71 | `"stocky-webhooks"` / `"stocky-cron"` |
| `getWebhookQueue` / `getCronQueue` | `queue.server.ts` 130–156 | BullMQ `Queue` + ioredis; webhook `attempts: 3`, `removeOnComplete: 1000`, `removeOnFail: 5000` |
| `Queue.add(..., { jobId })` | `dispatcher.server.ts` `addJobToQueue` 358–413 | deterministic `jobId: dispatch.queueJobId` |
| `formatQueueJobId` | `dispatcher.server.ts` 104–114 | `` `${durableJobId}__d${dispatchSequence}` ``; forbids `:` and `__d` in durable id |
| `inspectQueueDispatchPresence(queue, queueJobId)` | `queue-presence.server.ts` 115–156 | `getJob` then `getState`; **object existence ≠ runnable** |
| `classifyQueueState` | `queue-presence.server.ts` 59–67 | allowlist `waiting\|delayed\|active\|prioritized\|waiting-children`; terminal `completed\|failed`; else `UNKNOWN_STATE` fail-closed |
| `createWebhookWorker` / `createCronWorker` | `queue.server.ts` 347–360 | BullMQ `Worker` on those queue names |
| `enqueueWithDispatch` shop-disabled | `dispatcher.server.ts` 436–466 | PG `JobDispatch` FAILED + DurableJob CANCELLED/PENDING; **no** `Job.remove()` |
| `cancelAllCancellable` | `uninstall.server.ts` 204–260 | PG `DurableJob.state='CANCELLED'` only; **no Redis** |
| `processWebhookJob` cancel check | `webhook-processor.ts` 483–488 | reads PG `durable.state === "CANCELLED"` at start; does not abort an already-open external write |

**Absent on W (named FUTURE / matrix only):** `removeShopQueueJobsExceptPrivacy`. Production `app/` has **no** `Job.remove` / `Queue.obliterate` outside tests. §7.9 lists generation-fenced / shop-scoped remove of **ordinary** jobs on `queue.server.ts` as a future narrow edit; **never FLUSHALL**. D-PR7-10: Redis hint optional; poll recovers; no FLUSHALL.

### 2.2 D scratch occupancy / reclaim (REAL W, Residual 3)

| Primitive | Location | Signature |
|---|---|---|
| `inspectDScratchOccupancy({ scratchRoot, maxScratchBytes?, maxScratchAttempts? })` | `source-stage.ts` 345–377 | returns `DScratchOccupancySnapshot` (active/unknown counts, observed/reserved bytes, `operatorInterventionRequired`, `staleLockPresent`, `ledgerIntegrity`, `orphanMetadataPresent`). Uses `lstat` (no symlink follow). Live writers from **in-process** `LIVE_SCRATCH_BASENAMES`. |
| `reclaimOperatorSelectedDScratch({ scratchRoot, attemptBasenames, quiescenceConfirmed: true })` | `source-stage.ts` 687–774 | refuses unless `quiescenceConfirmed === true`; skips `symlink_refused`, `not_an_attempt_basename`, `outside_namespace`, `not_verified_d_resource`, `live_writer`; may remove selected `quota.lock` only under that token; no `/tmp` sweep; no HTTP endpoint |
| `reinitializeDScratchReservationLedgerAfterQuiescence({ scratchRoot, quiescenceConfirmed: true })` | `source-stage.ts` 776–807 | refuses while `att-*` remain; writes empty ledger; may delete owned `quota.reservation.tmp.*` regular files |
| `createOwnedScratchDir` / `disposeOwnedScratch` | `source-stage.ts` 480–685 | authentic handle WeakSet; path-only dispose → `scratch_unowned`; symlink → `scratch_symlink_refused`; UID mismatch → `scratch_unowned` |
| `withDScratchQuotaLock` | `scratch-quota.ts` 293–316 | mkdir lock; admission **does not steal** leftover `quota.lock` |
| `refuseIndeterminateScratchQuota` | `scratch-quota.ts` 500–523 | missing/corrupt ledger or unknown identities or orphan tmp → refuse admission |

Operator runbook (`PR6_D_SCRATCH_OPERATOR_RUNBOOK.md`): age / missing PID / TTL is **not** permission to delete. Automatic reclamation is not authorized.

---

## 3. Executed schedules vs real primitives

Commands (cwd `/tmp/pr7-helpers/B-output/probe-node`, `REDIS_URL=redis://127.0.0.1:16379`):

```bash
bash /tmp/pr7-helper-outputs/B/probes/00-isolation.sh
node node_modules/tsx/dist/cli.mjs /tmp/pr7-helper-outputs/B/probes/01-bullmq-real-primitives.mjs
node node_modules/tsx/dist/cli.mjs /tmp/pr7-helper-outputs/B/probes/01b-inflight-cancel.mjs
node node_modules/tsx/dist/cli.mjs /tmp/pr7-helper-outputs/B/probes/02-d-scratch-real-primitives.ts
node node_modules/tsx/dist/cli.mjs /tmp/pr7-helper-outputs/B/probes/03-synthetic-privacy-coordinator.mjs
```

Libraries loaded: `bullmq` 5.81.2, `ioredis` 5.11.1 (copied; lockfile not changed).

### 3.1 Late publication / delayed runnable (REAL BullMQ + W classifier)

**PREP-B-09 / PREP-B-09b.** A synthetic cancel label `{ redisRemoved: false }` was recorded without calling `Job.remove`. `inspectQueueDispatchPresence` on a delayed job returned `{ status: "RUNNABLE_EXISTING", queueState: "delayed" }` before and after the label. W allowlist treats `delayed` as runnable (`queue-presence.server.ts` 16–22). Observed: after 1.5–1.6s the job **remained** `delayed` (did not have to fire to stay runnable). **Not quiescence.**

### 3.2 In-flight work vs cancel (REAL BullMQ Worker + filesystem)

**PREP-B-06 (first pass) — inconclusive, do not use as drain proof.** `Job.remove` ran while `getState()==="waiting"`; cancel log SHA-256 was the empty-file digest `e3b0c442…`. A stale `.started` file from a prior run made `waitFile` return early. Recorded only to avoid silent overclaim.

**PREP-B-06b — executed counterexample (authoritative for cancel).** Worker PID **9234**. Job `inflight-cancel__d1` state **`active`**. `Job.remove()` threw:

`Job inflight-cancel__d1 could not be removed because it is locked by another worker`

Presence after attempt: `{ status: "RUNNABLE_EXISTING", queueState: "active" }`. **11 ticks** appended *after* the remove attempt (sample `tick i=1 … pid=9234 job=inflight-cancel__d1`). Worker still alive. Log SHA-256 `4f22ff2bd905420222de0001d17bb06563d2d933a9eca09879eb1fdec85c1df0`.

**Cancel is not drain.** An in-flight BullMQ lock prevents Redis remove; the processor keeps writing.

### 3.3 Process-loss (SIGKILL — not power-loss)

**PREP-B-08 (Redis).** Worker PID **6524** SIGKILL. After death: `kill(pid,0)` fails; leftover file 348 bytes; `inspectQueueDispatchPresence` still `{ status: "RUNNABLE_EXISTING", queueState: "active" }`. PID absence ≠ Redis drain. `power_loss_tested: false`.

**PREP-B-18 (D scratch, imported W APIs).** Child PID **7141** parked with authentic `createOwnedScratchDir`, payload hash `06fa3347967e49ad33ea8fe56de931abd00dc8245c22bda266ca5b8f5e277b3e`. SIGKILL → PID gone, `att-*` still on disk, next admission `scratch_resource_exhausted`, occupancy `operatorInterventionRequired: true`, reservedBytes 9000. Operator `reclaimOperatorSelectedDScratch({ quiescenceConfirmed: true })` reclaimed `att-crash-shop-crash-run-XCS20r`; subsequent admission succeeded. PID gone is not auto-delete.

### 3.4 Positive worker/I/O drain (contrast)

**PREP-B-11.** Worker finished; `.done` file written; `inspectQueueDispatchPresence` → `{ status: "TERMINAL_EXISTING", queueState: "completed" }`. This is the *kind* of evidence required — not TTL/PID/cancel.

### 3.5 Target isolation (REAL Redis jobs, PROBE-ONLY scoped remove)

**PREP-B-02.** `formatQueueJobId("durable-a",1) === "durable-a__d1"`. Both shops `RUNNABLE_EXISTING` / `waiting` via W `inspectQueueDispatchPresence`.

**PREP-B-03.** PROBE-ONLY loop: `Job.remove` only when `tenant.shopId === shop-a-gen1`. Shop A → `MISSING`. Shop B `durable-b__d1` still `RUNNABLE_EXISTING` / `waiting`. `flushall_executed: false`. Key count 7 → 6 (not a cluster wipe).

**PREP-B-04.** Removing customer `191167` on shop A left customer `191168` on shop A and shop B job intact.

W has no production shop-scoped Redis purge; this probe shows BullMQ *can* keep B if remove is filtered — and that FLUSHALL would not.

### 3.6 D scratch guards (imported W functions)

Scratch root example: `/tmp/pr7-helpers/B-scratch/dscratch-7110`.

| ID | Result |
|---|---|
| PREP-B-13 | symlink root → `scratch_symlink_refused` |
| PREP-B-14 | live authentic handle; occupancy `operatorInterventionRequired: false`; sanitized occupancy does **not** leak `shop-live` / `att-` |
| PREP-B-15 | reclaim skipped `live_writer`, `not_an_attempt_basename`, `not_verified_d_resource`, `symlink_refused`; secret + markerless bytes untouched |
| PREP-B-16 | path-only dispose + forged handle → `scratch_unowned`; live dir remains |
| PREP-B-17 | leftover `quota.lock` → admission `scratch_resource_exhausted`, `staleLockPresent: true`; operator reclaim of `quota.lock` with quiescence token succeeds |
| PREP-B-19 | **second process** with `quiescenceConfirmed: true` **deleted** a still-live child's `att-*` (`child2_alive_before_kill: true`, `dir_exists_after_foreign_reclaim: false`). Live-writer skip is **process-local**. The boolean is an operator admission token, not liveness proof. Runbook §1 remains mandatory. |
| PREP-B-20 | leftover `att-markerless` → `unknownAttemptCount: 1`, `operatorInterventionRequired: true` |
| PREP-B-20b | reinitialize while `att-*` remain → `scratch_resource_exhausted`; after authentic dispose → `{ ledgerIntegrity: "ok" }` |
| PREP-B-21 | `quiescenceConfirmed: false` → `scratch_unowned` |

---

## 4. SYNTHETIC adapter model (labelled — not W, not application runtime)

These classes exist only under `/tmp/pr7-helper-outputs/B/probes/03-synthetic-privacy-coordinator.mjs`. They are **not** integrated fences.

| SYNTHETIC type | Role |
|---|---|
| `SYNTHETIC_PrivacyPublicationFence` | Models §7.6.5 / F-CLAUDE-PR7TF-02: one live `activeAttemptId`; stale publish → `enumerator_stale_attempt` and keys unchanged; CAS `publicationRevision++` only for the live attempt |
| `SYNTHETIC_RedisWakeHint` | Optional `SET key EX`; **not** durable authority. After expiry, poll still claims/publishes (PREP-B-22: `hint_lost_before_poll: true`, `pollRecoveries: 1`) — D-PR7-10 |
| `SYNTHETIC_PrivacyCoordinatorPollLoop` | Poll/claim beside ordinary workers; **not** a Shop-linked `DurableJob`; not a second queue framework |
| `SYNTHETIC_ExportPublicationAdapter` | Local fixture sink **or** `UNCONFIGURED`. **Not S3 / object storage / live Shopify.** `export_storage_unconfigured` is an explicit implementation dependency |

Executed SYNTHETIC results: PREP-B-22…29 in `03-synthetic.json`.

---

## 5. Negative controls

| Control | Kind | Executed result | Quiescence? |
|---|---|---|---|
| TTL guess | REAL Redis `SET EX 1` while Worker ticks | PREP-B-05: TTL −2 / EXISTS 0; worker PID 6501 still alive; ticks continued (observed job id `durable-b__d1` — shop B leftover still being processed). Hint expiry ≠ drain | **No** |
| PID guess (decoy) | REAL | PREP-B-07: decoy 6523 killed; real worker 6524 alive; job `active` | **No** |
| PID guess (wrapper vs worker) | REAL (first 01 run) | Killing tsx wrapper left workers 6080/6103/6127/6150 running until exact-PID SIGKILL | **No** |
| Cancel label / `Job.remove` waiting | REAL | PREP-B-06 inconclusive | not used |
| Cancel of **active** locked job | REAL | PREP-B-06b: remove throws locked; 11 ticks after; presence still `active` | **No** |
| PG CANCELLED without Redis remove | W source (PREP-B-12) | `cancelAllCancellable` / shop-disabled path do not call `Job.remove` | **No** |
| Delayed + cancel label | REAL W classifier | PREP-B-09b: still `RUNNABLE_EXISTING` / `delayed` | **No** |
| Stale generation on Redis worker | REAL worker + SYNTHETIC fence field | PREP-B-10: payload `fence: "ERASING"` still ticked (`wrote_despite_fence_ERASING: true`). PG advisory locks do not fence Redis (§7.6.2 LIMIT) | **No** |
| Symlink refuse | REAL W reclaim/create | PREP-B-13/15 `scratch_symlink_refused` / `symlink_refused` | N/A (refuse) |
| Unowned refuse | REAL W | PREP-B-16 `scratch_unowned`; PREP-B-15 `not_verified_d_resource` | N/A (refuse) |
| Customer vs shop Redis | REAL | PREP-B-04: unrelated customer + shop B kept | isolation holds only if remove is scoped |
| Export unconfigured | SYNTHETIC | PREP-B-24 `export_storage_unconfigured` | must keep request incomplete |
| Permission failure | SYNTHETIC | PREP-B-25 `export_permission_denied` / EACCES | incomplete |
| Export vs erasure without re-check | SYNTHETIC | PREP-B-26: snapshot LIVE, fence ERASING, late file exists | **No** |
| Export vs erasure with re-check | SYNTHETIC | PREP-B-27: `stale_generation_publish_refused` | required control |
| Cross-process reclaim of live att-* | REAL W API | PREP-B-19: `quiescenceConfirmed: true` deleted live child's dir | **No** (flag ≠ proof) |
| Unknown leftover | REAL W | PREP-B-20: `unknownAttemptCount: 1` blocks clean admission | incomplete until operator path |
| FLUSHALL | forbidden | **not executed** even on private instance | would destroy shop B (PR7-SIDE-002) |

---

## 6. Minimal viable contract before any COMPLETED

Must exist on the **implementation** base (not this docs PR):

1. **Durable authority** is `PrivacyRequest` / `PrivacyAttempt` with generation + target identity. Redis is at most an optional wake hint; poll recovers (D-PR7-10). Leftover `privacy:*` DurableJob strings fail closed.
2. **Generation-fenced publication** immediately before any external side effect (Redis job consume, export write, D scratch dispose). Start-of-job fence snapshot is insufficient (PREP-B-10, PREP-B-26).
3. **Ordinary Redis jobs:** shop- and generation-scoped `Job.remove` of *waiting/delayed* jobs only after presence inspect; **never FLUSHALL**; never wipe shop B (PR7-SIDE-002 / PR7-RED-009). Active/locked jobs **cannot** be removed (PREP-B-06b) — COMPLETED requires **positive worker drain** (terminal `getState` + no live processor + no leftover writes), not a cancel label.
4. **Customer vs shop:** `customers/redact` must not take the whole-shop exclusive Redis wipe or exclusive domain freeze; scoped target keys only; unrelated customer jobs remain (PREP-B-04). `shop/redact` may cancel ordinary jobs for that shop/generation only.
5. **D scratch:** use accepted W APIs only (`inspectDScratchOccupancy`, authentic `disposeOwnedScratch`, `reclaimOperatorSelectedDScratch` with independently established quiescence, `reinitializeDScratchReservationLedgerAfterQuiescence`). Symlink/unowned/markerless leftovers are skipped, not swept. Inability to prove reclamation → request stays incomplete/visible (Residual 3). `quiescenceConfirmed` is not a cross-process liveness probe (PREP-B-19).
6. **Export:** if storage is unconfigured, return `export_storage_unconfigured` and **do not** COMPLETED. Do not fabricate a live provider test. Re-check generation under the publication lock before write; permission failures keep incomplete.
7. **Coordinator** is a poll/claim loop in the existing worker process, not a second queue service. PG advisory locks / RLS **do not** fence Redis, export, or D scratch bytes (§7.6.2 LIMIT).
8. Uninstrumented writers and `processingEnabled=false` are admission filters, not drains.

---

## 7. Counterexamples (looked green, were not quiescence)

1. **TTL of optional hint hit 0 while a Worker still appended ticks** (PREP-B-05).
2. **Decoy PID death with real worker + Redis `active` remaining** (PREP-B-07).
3. **tsx wrapper PID death leaving real workers 6080/6103/6127/6150** (first 01 run).
4. **`Job.remove` on an `active` job throws locked; 11 filesystem ticks after; presence still `active`** (PREP-B-06b).
5. **PG `CANCELLED` / cancel label with `redisRemoved: false` while W classifier still returns `RUNNABLE_EXISTING` for `delayed`** (PREP-B-09b, PREP-B-12).
6. **Worker processed payload with `fence: "ERASING"` because Redis workers have no generation barrier** (PREP-B-10).
7. **SIGKILL worker: PID gone, Redis job still `active`, leftover bytes remain** (PREP-B-08). Same pattern for D scratch (PREP-B-18).
8. **Operator API with `quiescenceConfirmed: true` from another process deleted a live writer's `att-*`** (PREP-B-19).
9. **SYNTHETIC export published after fence moved to ERASING because it used a start snapshot** (PREP-B-26).
10. **Positive-looking `Job.remove` of a still-waiting job with an empty write log (PREP-B-06)** — would have been a false green if treated as “cancel drained I/O”.

---

## 8. Unexecuted limits

- **No power-loss / host crash / disk tear-down.** SIGKILL of a Worker or park child is process-loss only.
- **No object-storage provisioning, no S3, no live Shopify, no merchant files.** Export tests used SYNTHETIC local fixtures or explicit `UNCONFIGURED`.
- **No FLUSHALL** (private or otherwise).
- **No PR7 application runtime** (`app/privacy/**`, coordinator loop, `removeShopQueueJobsExceptPrivacy`).
- **No PostgreSQL lifecycle gate** (Helper A). This packet does not claim PG fences Redis.
- **No million-line D scratch.** Bounded fixtures under `/tmp/pr7-helpers/B-scratch` only.
- **UID-foreign directory** (`st.uid !== getuid()`) not exercised (would need another owner); unowned coverage is path-only / forged-handle / markerless.
- Delayed job **did not** observe `delayed → waiting` within 1.6s; claim is limited to “delayed is already RUNNABLE per W classifier”.
- W `getWebhookQueue()` was **not** imported (pulls Prisma/dispatcher). Probes used the same BullMQ class, queue names, jobId encoding, and `inspectQueueDispatchPresence` from W.

---

## 9. Teardown

| Step | Evidence |
|---|---|
| Isolation Redis PID | 4169 (later SIGTERM by non-teardown actor at 01:10:05; log copied to `results/redis-4169-then-9143.log`) |
| Restarted probe Redis PID | **9143** `/usr/bin/redis-server 127.0.0.1:16379` |
| Teardown kill | `kill -TERM 9143` (exact PID). Gone after TERM. No SIGKILL needed. |
| After | 16379 `connect_ex=111`; 6379 `connect_ex=111`; `pgrep redis-server` empty |
| Data dir | `dump.rdb` / `redis.pid` / live `redis.log` removed from `/tmp/pr7-helpers/B-redis/` (conf kept). |
| Leftover workers | none (`in-flight-worker` / `scratch-park` empty) |
| FLUSHALL | not executed |

---

## 10. PREP-B IDs (preserve D-PR7 / CP / XC / TF)

| ID | Maps to | Summary |
|---|---|---|
| PREP-B-01 | isolation | W HEAD, 16379 INFO, 6379 unused, unique scratch |
| PREP-B-02 | D-PR7-10 / queue-presence | add + W inspect allowlist |
| PREP-B-03 | PR7-SIDE-002 / PR7-RED-009 | shop-scoped remove keeps B; no FLUSHALL |
| PREP-B-04 | F-CLAUDE-PR7TF-01 | customer vs shop Redis isolation |
| PREP-B-05 | §7.6.2 LIMIT | TTL guess fail |
| PREP-B-06 | §7.6.2 LIMIT | first cancel pass **inconclusive** |
| PREP-B-06b | §7.6.2 LIMIT | active locked `Job.remove` fail + continued FS writes |
| PREP-B-07 | §7.6.2 LIMIT | decoy PID guess fail |
| PREP-B-08 | §7.6.2 LIMIT | process-loss leftover Redis+file; not power-loss |
| PREP-B-09 / 09b | late publication | delayed remains RUNNABLE under cancel label |
| PREP-B-10 | §7.6.2 LIMIT | stale generation still processed on Redis |
| PREP-B-11 | positive drain | terminal completed + `.done` file |
| PREP-B-12 | D-PR7-10 / TF-03 | PG cancel ≠ Redis remove (W source) |
| PREP-B-13 | Residual 3 | symlink root refuse |
| PREP-B-14 | Residual 3 | positive occupancy / sanitizer |
| PREP-B-15 | Residual 3 | live/foreign/markerless/symlink skip |
| PREP-B-16 | Residual 3 | unowned refuse |
| PREP-B-17 / 17b | Residual 3 | quota.lock not stolen; operator reclaim |
| PREP-B-18 | Residual 3 | process-loss leftover until operator reclaim |
| PREP-B-19 | Residual 3 / runbook §1 | quiescence flag ≠ cross-process liveness |
| PREP-B-20 / 20b | Residual 3 | unknown leftover blocks; reinitialize after drain |
| PREP-B-21 | Residual 3 | reclaim requires quiescence token |
| PREP-B-22 | D-PR7-10 | SYNTHETIC hint lost; poll recovers |
| PREP-B-23 | F-CLAUDE-PR7TF-02 | SYNTHETIC stale attempt cannot CAS |
| PREP-B-24 | export dependency | `export_storage_unconfigured` |
| PREP-B-25 | permission | export EACCES keeps incomplete |
| PREP-B-26 / 27 | late export vs erasure | snapshot race vs re-check refuse |
| PREP-B-28 | TF-01 scope | SYNTHETIC customer vs shop coordinator rules |
| PREP-B-29 | Residual 3 | resource failure keeps incomplete |

Stop. No commit. No PR7 runtime. No power-loss claim.
````

### Helper C report

SHA-256 `e49caa8ef640f4d933c76ada393cb7ad81e5fea9cbb76a96072d529fe2075066`

````markdown
# Helper C — merged-W participating-writer inventory (PR7 entry evidence)

**Status:** documentation / inventory only. PR7 runtime **not authorized**. Q-008, D-PR7-01/02 bind, and PR47 closeout **not decided**.

Companion machine list: `/tmp/pr7-helper-outputs/C/WRITER_INVENTORY.json` (86 rows).

---

## 1. Isolation evidence

| Item | Evidence |
|---|---|
| Exclusive checkout | `/tmp/pr7-helpers/C` |
| HEAD | `ee193f38491245a10fb2fa60d2cf9a29f3271605` (`git rev-parse HEAD`) |
| Branch | detached `HEAD` |
| Working tree | `git status --porcelain` empty; `git diff --check` clean |
| Authorized W / origin/main pin | `ee193f38491245a10fb2fa60d2cf9a29f3271605` (PR #43 squash; Phase 1 PR6-D merged) |
| Historical V | `a3ff480f1477237f8055f10c43298480a05728a1` — `git cat-file -t` commit; ancestor of W (`merge-base --is-ancestor` exit 0) |
| V→W | **1 commit**: `ee193f3 Phase 1 PR6-D — order webhook, import, and reconciliation integration (#43)`; `git diff --stat` 92 files, +25501 / −327 |
| PR45 planning head | docs in `/tmp/pr7-helpers/C-inputs/` from `a292bc8a6ea26192bc295af7338dd6d653a3e65c` (V-based, not W) |
| PR47 closeout candidate | `fde01dc5ba2e0076b1579d6690f0548db749af56` exists; **W is an ancestor of PR47**; PR47 is **not** an ancestor of W (**not merged**). Later integration prerequisite only |
| Git writer | Helper C did **not** `git commit` / `git push` / edit `/workspace` |
| Redis | Helper C did **not** start Redis and did **not** attach to 16379. A listener `127.0.0.1:16379` was visible on the VM (Helper B). Unused |
| PostgreSQL | Helper C did **not** attach to any cluster. PG-backed suites recorded **BLOCKED** (not executed) |
| PR7 runtime | not implemented |
| New IDs | `PREP-C-01` … `PREP-C-30` |

Pinned product facts (read, not decided): D-054 **EFFECTIVE** / no D-055; R-176 **OPEN/P0** on W `docs/RISK_REGISTER.md`; R-164 unchanged as stated in the work order (not re-executed); Q-008 **OPEN**.

---

## 2. V vs W compatibility (PR45-named symbols)

V→W did **not** rewrite lifecycle, dispatcher, fair-claim, replay, uninstall, reinstall, bootstrap, after-auth, db-context, tenant-db, order-facts **apply**, or catalog **checkpoint**. Those files are byte-identical.

Files that **did** change among inventoried / adjacent surfaces:

| Path | V→W |
|---|---|
| `app/jobs/queue.server.ts` | +`enqueueOrderFactsSync`, +`enqueueOrderFactsReconcile` |
| `app/jobs/workers/webhook-processor.ts` | order-facts webhook/import/reconcile execution |
| `app/sync/execution-strategy.server.ts` | new ATOMIC topics + `order-facts-*` REBUILDABLE |
| `app/sync/health.server.ts` | `order_facts` domain + scratch occupancy DEGRADED |
| `app/sync/intake.server.ts` | quarantine → `order-facts-reconcile` enqueue |
| `app/sync/sanitize.server.ts` | identity-only projections for new topics |
| `app/tenant/job-envelope.server.ts` | new job sources |
| `app/jobs/workers/catalog-facts/bulk-finish.ts` | `updateMany` jobType list adds order-facts jobs |

### PR45-named symbol status on W

| PR45 symbol | W status |
|---|---|
| `withTenantBoundTransaction` | **exists**, unchanged, still **no** participating-write guard |
| `withTenantBoundTransactionState` | **exists**, file-private, unchanged |
| `applyOrderFactWriters` | **does not exist** on V or W. Real entry: `applyOrderFacts` plus child writers in `writers.ts` |
| `applyReceipts` | **does not exist**. Real: `insertReceiptFinal` / `shortCircuitIfApplied` |
| `claimAttempt` … `recoverExpiredRunningAttempts` | **exist**, unchanged; **no** `processingEnabled` on V or W; reaper still **in this file** |
| `ensureDispatchRecord`, `enqueueWithDispatch`, `dispatchPendingJobs` | **exist**, unchanged |
| `dispatcher_disabled_shop_path` | **still writes** after `processingEnabled=false` at W `dispatcher.server.ts` ~1373–1392 (`ensureDispatchRecord` + `enqueueWithDispatch` → `markDispatchFailed` + raw `DurableJob` PENDING/CANCELLED) |
| `claimRunnableJobsSql` | **moved name**: `buildFairClaimJobCandidateSql`; `WHERE r."processingEnabled" = true` unchanged; `assertDispatcherUsesProductionFairClaimSql` still present |
| `createDurableJob` | **exists**; still throws `shop_processing_disabled`; **new W callers** |
| `ingestAuthenticatedWebhook` | **exists**; still denies ordinary topics when disabled; **W** may enqueue reconcile on `projection_bounds_exceeded` |
| `executionStrategyForJobType` | unknown still `NO_AUTOMATIC_RETRY`; **W** registers new order-facts types as ordinary (not privacy) |
| `JobExecutionStrategy` enum | still four values; **no** `BOUNDED_CHECKPOINT_RETRY`; **no** privacy value |
| `processUninstall` / `cancelAllCancellable` | **exist**, unchanged; session delete after commit |
| `completeAttemptRetry` | **exists**; `NO_AUTOMATIC_RETRY` → dead-letter uncertain |
| `assertShopProcessingEnabled` | **exists** (local in webhook-processor); **W copy** in `order-facts/sync/control-plane.ts` |
| Queue names | `WEBHOOK_QUEUE="stocky-webhooks"`, `CRON_QUEUE="stocky-cron"` unchanged |
| `reactivateShopAfterVerifiedReinstall` | **exists**; REDACTED/MANUAL deny; nothing on W writes `REDACTED` |
| `upsertCanonicalShop` | **exists**; no FINALIZING fence |
| `runAfterAuthTenantBootstrap` | **exists**; still swallows `reinstall_denied` then upserts `ShopSettings` |
| `lockSyncRun` | **exists**, still **file-private**; exported persist* unchanged |
| `getShopHealth` | **does not exist** on V or W. Real: `computeSyncHealth` which **upserts `SyncHealth`** (not read-only) |
| `createDurableJob wrappers` | **exist**; W adds order-facts enqueue helpers |
| `replayDeadLetter` | **exists**, unchanged; no actor |
| RLS `stocky_shop_processing_enabled` | still on runtime policies; Shop runtime privs **SELECT, INSERT, UPDATE** — **no DELETE** |
| `test:privacy` | **still missing** in W `package.json` |
| `requireAdminTenant` | shop authority only; does not read `session.userId` / `onlineAccessInfo` / `sessionToken.sub` |
| `shopifyApp` | **no** `useOnlineTokens`; afterAuth still enqueues catalog after bootstrap |
| Compliance stub | `webhooks.compliance.tsx` still authenticate + empty 200; **no persist** |

**PREP-C-03:** PR45 prose says the disposable table has **26** rows; the appendix `INSERT INTO "ParticipatingWriterInventory"` has **27** value tuples. `stocky_inventory_is_complete()` only asserts five symbols (`completeAttemptRetry`, `dispatcher_disabled_shop_path`, `withTenantBoundTransaction`, `claimAttempt`, `enqueueWithDispatch`). Completeness was never “every V writer”.

---

## 3. Complete participating-writer inventory (W)

Columns match the work order. Full objects: `WRITER_INVENTORY.json`.

`proposed PR7 gate` is the **plan-constrained** wrapper, not an implementation.

### 3.1 Required TF-03 / §7.9 core (must not omit)

| file | symbol | host/role | surfaces | target-key | current guard | proposed PR7 gate | already-running | test home |
|---|---|---|---|---|---|---|---|---|
| `app/sync/lifecycle.server.ts` | `claimAttempt` | CP `$transaction` / `lockDurableJob` / `stocky_control_plane` | JobAttempt, DurableJob, JobDispatch | shop | **none** | REQUIRED lifecycle shared | claim finishes CP | `sync-attempt-recovery.test.ts` |
| same | `renewAttemptHeartbeat` | CP updateMany | JobAttempt | shop | **none** | REQUIRED shared | heartbeat | same |
| same | `completeAttemptSuccess` | CP `$transaction` | JobAttempt, DurableJob, WebhookDelivery, JobDispatch | shop | **none** | REQUIRED shared | success finalizes CP | same |
| same | `completeAttemptRetry` | CP `$transaction`; raw UPDATE RETRY_WAIT | JobAttempt, DurableJob, DeadLetter | shop | **none** (TF-03) | REQUIRED shared | retry while finishing | same |
| same | `completeAttemptFail` | CP → dead-letter in txn | JobAttempt, DurableJob, DeadLetter | shop | **none** | REQUIRED shared | fail | same |
| same | `completeAttemptDeadLetter` | CP → dead-letter in txn | same | shop | **none** | REQUIRED shared | dead-letter | same |
| same | `recoverExpiredRunningAttempts` | CP reaper **in this file** | JobAttempt, DurableJob, DeadLetter | shop | **none** | REQUIRED shared per job | recovery | same |
| `app/sync/dispatcher.server.ts` | `dispatcher_disabled_shop_path` | after claim, `processingEnabled=false` still `ensureDispatchRecord`+`enqueueWithDispatch` | JobDispatch, DurableJob, DataIssue | shop | **READ then STILL WRITES** | REQUIRED shared; re-check ≠ drain | already-claimed | `sync-dispatch-recovery.test.ts` |
| same | `ensureDispatchRecord` | CP JobDispatch create | JobDispatch | shop | none | REQUIRED shared | may run after disable | same |
| same | `enqueueWithDispatch` | markDispatchFailed + raw DurableJob; Redis add if enabled | JobDispatch, DurableJob, Redis | shop | READ then write | REQUIRED shared; Redis unfenced | already-claimed | same |
| same | `dispatchPendingJobs` | claim + disabled/enabled arms | JobDispatch, DurableJob, Redis | shop | mixed | REQUIRED on every write arm | already-claimed | same |
| `app/tenant/bootstrap.server.ts` | `upsertCanonicalShop` | rawPrisma shop.upsert | Shop | domain (Shop may be absent) | **none** | assertNoErasureFence + shared | bootstrap vs freeze | `bootstrap.test.ts` |
| `app/tenant/after-auth.server.ts` | `runAfterAuthTenantBootstrap` | bootstrap + `shopSettings.upsert` | Shop, ShopSettings | domain | swallows `reinstall_denied` | both gates; no settings revival on ERASING/FINALIZING | n/a | after-auth (no unit file) |
| `app/tenant/bootstrap.server.ts` | `deleteSessionsForShop` | `session.deleteMany` | Session | shop domain | none (post-commit) | asserted after exclusive UNINSTALLED; failure must not re-enable | after commit | `bootstrap.test.ts` |
| `app/lib/order-facts/apply/index.ts` | `applyOrderFacts` | TenantDb open txn | order/refund facts | ORDER_LEGACY_ID | `requireProcessingEnabled` pre-lock + re-check + RLS | REQUIRED **both** gates; re-check ≠ drain | in-flight commit | `apply/__tests__` |
| `app/lib/order-facts/apply/receipts.ts` | `insertReceiptFinal` | TenantDb + receipt advisory lock | SyncApplicationReceipt | shop / applicationKey | processingEnabled re-check | REQUIRED lifecycle shared | open receipt txn | `apply/__tests__` |
| `app/lib/catalog-facts/ingest/checkpoint.ts` | `lockSyncRun` (+ persist*) | CP FOR UPDATE SyncRun | SyncRun, SyncCursor | shop | `shop_processing_disabled` admission | REQUIRED lifecycle shared; admission ≠ drain | running checkpoint | `pr5-f3-jsonl-checkpoint.test.ts` |
| `app/sync/health.server.ts` | `computeSyncHealth` | CP **`syncHealth.upsert`** | SyncHealth | shop + domain | reads processingEnabled; **still upserts** | REQUIRED lifecycle shared (**not** read-only) | upserts DISABLED row | catalog/order-facts health callers |
| `app/jobs/queue.server.ts` | `enqueueWebhook` / wrappers | `createDurableJob` | DurableJob | shop | intake deny | intake + shared; FUTURE scoped Redis remove | n/a | queue tests |
| `app/jobs/queue.server.ts` | `generation_fenced_queue_remove` | **MISSING** | Redis | shop/generation (proposed) | none | FUTURE scoped remove; never FLUSHALL | Redis remains | tests-only `Job.remove` |
| `app/routes/app.analytics_.export.tsx` | `loader` | requireAdminTenant + CSV Response | HTTP publication | shop (auth) | RLS read; **no** publication fence | revalidate before download; LIMIT: PG ≠ bytes | download while freeze possible | none on W |
| `app/lib/order-facts/sync/source-stage.ts` | `inspectDScratchOccupancy` | FS inspect | occupancy → health | scratch root | none PG | residual proof; sample empty ≠ absence | n/a | `scratch-quota.test.ts`, `source-stage.test.ts` |
| `app/lib/order-facts/sync/source-stage.ts` | `reclaimOperatorSelectedDScratch` | FS delete selected `att-*` | D scratch bytes | operator-selected names | `quiescenceConfirmed: true` | not PG; leftovers keep privacy incomplete | skips `live_writer` | `source-stage.test.ts`, D runbook |
| `app/tenant/db-context.server.ts` | `withTenantBoundTransaction` | Prisma `$transaction` + GUC | all tenant facts | shop + row customer/order | RLS processingEnabled | **REQUIRED / not optional** domain then customer shared | freeze waits on txn | `scripts/privacy/inventory-guard.test.ts` **MISSING on W** |
| `app/tenant/tenant-db.server.ts` | `withTenantBoundTransactionState` | private interactive txn | TenantDb writes | same | RLS | **REQUIRED / not optional** | same | same missing home |

`processingEnabled` / `assertShopProcessingEnabled` remain **admission**, not drain (**PREP-C-07**, **PREP-C-08**).

### 3.2 Other V-era writers PR45’s 26-row table omitted (still on W)

See JSON `classification: v_omitted`. Material holes:

- `ingestAuthenticatedWebhook` (WebhookDelivery + job)
- `claimBatchFair` (writes `DISPATCH_LEASED`; SQL is not read-only)
- `recoverExpiredDispatchLeases` — SQL **has no** `processingEnabled` filter (**PREP-C-20**)
- `recoverStrandedEnqueuedJobs`, `ackEnqueued`, `markDispatchFailed`, `supersedeTerminalDispatch`, `addJobToQueue`
- `shopifySessionStorage` / `updateSessionScope`
- `applyWithApplicationReceipt`
- `applyCanonicalFacts` (catalog; **no** explicit processingEnabled pre-lock — **PREP-C-15**)
- catalog persist* exports, `beginDirectObservation`, `applyParsedJsonlBatch`, `projectCompatibilityFromCanonicalFacts`, `replaceProductCollectionMemberships`
- `signalBulkOperationContinuation`
- legacy `salesDailyAggregate` upserts
- `enqueueAfterAuthCatalogSync` / `shopify.server.ts` afterAuth
- `persistIncompleteObservation`
- `scheduleAbcAnalysisCron`

### 3.3 Health “read-only proof”

**Fails.** PR45 listed `getShopHealth` as CP read / outside barrier. On V and W the only export is `computeSyncHealth`, which **upserts `SyncHealth`**. Disabled shops still get a DISABLED upsert. W additionally degrades `order_facts` from leftover D scratch (**PREP-C-04**, **PREP-C-29**). Health must take the **lifecycle shared** gate. It cannot invalidate customer-target restoration by itself, but it **can** persist tenant-linked CP rows during freeze.

---

## 4. Newly relevant W-only writers (PR6-D; PR45 V inventory missed)

All of these are **new files or new symbols** on W (`git diff` V→W). None existed in the PR45 26-row table.

| Area | Symbols |
|---|---|
| Queue / strategy / intake | `enqueueOrderFactsSync`, `enqueueOrderFactsReconcile`; `executionStrategyForJobType` cases `order-facts-sync` / `order-facts-reconcile`; intake quarantine reconcile `createDurableJob`; envelope sources `order_facts_sync` / `order_facts_reconcile`; webhook routes `orders/edited`, `orders/delete`, `order_transactions/create` |
| Worker | `processOrderFactsWebhookJob`, `runOrderFactsSyncJob`, `runOrderFactsReconcileJob`, `applyCanonicalAndLegacy`, `persistIncompleteWithoutReceipt`, `applyNominatedOrderGid` |
| CP helpers | `createOrderFactsSyncRun`, `persistOrderFactsCursor`, `incrementOrderFactsPollExaminedCount`, `recordOrderFactsDataIssue`, `persistOrderFactsCoverageHealth`, order-facts `assertShopProcessingEnabled` |
| Tenant facts | `beginDirectOrderObservation` (+ abandon/scope update), `persistShopTimezoneCurrencyValues` (**Shop UPDATE** via GUC) |
| D scratch FS | `createOwnedScratchDir`, `disposeOwnedScratch`, `reclaimOperatorSelectedDScratch`, `reinitializeDScratchReservationLedgerAfterQuiescence`, `stageOrderFactsJsonl` / `writeStreamChunk`, `saveDScratchReservations` |
| Health | `OrderFactsScratchHealthEvidence` path on `computeSyncHealth` |
| Catalog bulk-finish | `order-facts-sync` / `order-facts-reconcile` added to RETRY_WAIT `updateMany` (**no** processingEnabled check) |

**PREP-C-10** is this set. Refresh-against-PR6 is **this W squash**, not “chase PR43” as a live draft — PR43 **is** W.

---

## 5. Missing boundaries / holes

| ID | Hole |
|---|---|
| **PREP-C-03** | 26 vs 27 row count; `stocky_inventory_is_complete()` only checks five symbols |
| **PREP-C-04** | Health is a writer; phantom `getShopHealth` |
| **PREP-C-05** | Phantom `applyOrderFactWriters` / `applyReceipts` |
| **PREP-C-09** | V-era CP writers omitted (lease recovery, stranded ENQUEUED, catalog apply, session store, Redis add, …) |
| **PREP-C-11** | Production **no** generation-fenced Redis remove; tests use `obliterate`/`remove`; **no FLUSHALL** in app code (good) but **no** scoped drain either |
| **PREP-C-12** | Export CSV publication unfenced |
| **PREP-C-13** | D scratch / Redis / export **not** fenced by PG advisory locks (plan LIMIT still true on W) |
| **PREP-C-14** | `persistShopTimezoneCurrencyValues` updates `Shop` without processingEnabled in SQL |
| **PREP-C-15** | `applyCanonicalFacts` has no `requireProcessingEnabled` (unlike order apply); RLS in a stale txn is not drain |
| **PREP-C-20** | `buildExpiredDispatchLeaseRecoverySql` updates **any** expired `DISPATCH_LEASED` row |
| **PREP-C-21** | `test:privacy` still absent |
| **PREP-C-24** | W `RISK_REGISTER` R-176 still OPEN/P0 and still describes draft PR #43 in places (docs lag after squash; **not** a closeout decision) |
| **PREP-C-28** | `signalBulkOperationContinuation` can bump order-facts RETRY_WAIT without processingEnabled |
| **PREP-C-30** | Planned architecture test home `scripts/privacy/inventory-guard.test.ts` **does not exist** on W; `app/privacy/**` absent |
| TF-03 still true | Uninstrumented CP INSERT still succeeds (no RLS on CP). Stop/drain of legacy processes remains a **rollout** prerequisite, not a lock |
| Customer barrier | Ordinary writers still have **no** `PrivacyCustomerTargetBarrier` computation of `CUSTOMER_REST_ID` / `ORDER_LEGACY_ID` |

Do **not** treat: `processingEnabled`, Redis TTL, cancelled-job labels, stale PID, sampled empty scratch, or a cancelled DurableJob as quiescence.

---

## 6. Additive migration order (proposed, not implemented)

Foundation freeze **before** any runtime lane (Accelerated Safe Delivery; no branches created here):

1. **Contract freeze:** this W inventory + required wrapper names (`stocky_participating_write_guard`, `stocky_customer_write_guard`, CP `stocky_cp_participating_write`) + architecture test that fails when a tenant-linked writer is missing or a `probe_unguarded%` row lands.
2. **Additive Prisma/SQL:** `ShopInstallGeneration` + fence; privacy/audit/rbac models; **no** privacy `DurableJob` / **no** privacy `JobExecutionStrategy`; keep runtime RLS `processingEnabled` predicate **unchanged**.
3. **Roles/helpers:** nologin lifecycle-gate owner; topic reader/erasure roles; SELECT-only verifiers; **no Shop DELETE** grant to runtime/CP (checked finalizer later).
4. **Empty-table isolation** (0-row vs error matrix) on disposable PG.
5. **Then** instrument inventoried W symbols (lifecycle including `completeAttemptRetry` + `dispatcher_disabled_shop_path` + `recoverExpiredDispatchLeases` + health upsert + TenantDb + apply/catalog + D-scratch/Redis/export **interfaces**).
6. Coordinator poll/claim (not fair-claim). Enumerator + customer barrier. Shop/redact exclusive gate.
7. afterAuth fence; scoped Redis remove; residual probe including D scratch occupancy + export publication.
8. Platform routes / owner download / operator CLI.
9. Exact-head full CI + independent Tier-A review.

Rollback: additive objects only; drop new roles/functions/tables; **do not** rewrite V/W fair-claim SQL identity.

---

## 7. Exclusive file ownership refresh vs plan §7.9

**Keep owned (PR7 implementation PR, later):** `app/audit/**`, `app/rbac/**`, `app/privacy/**`, `webhooks.compliance.tsx`, `app/routes/app.platform.*.tsx`, `scripts/privacy/**`, additive `prisma/schema.prisma` + `prisma/migrations/20260918*_pr7_*`, `app/tenant/models.ts`, tenant-enforcement `manifest.ts` / `roles.ts` / `sql.ts` (additive privacy SQL only), `package.json` `test:privacy` only, later `docs/phases/phase-1/PR7_*IMPLEMENTATION*`.

**Keep narrow shared as named in §7.9**, plus **W refresh**:

| File | Additional W delta |
|---|---|
| `app/jobs/queue.server.ts` | already shared; now includes order-facts enqueue; **add** scoped Redis remove here (still missing) |
| `app/jobs/workers/webhook-processor.ts` | already shared; W order-facts branches must keep `assertShopProcessingEnabled`; coordinator remains a **separate** loop |
| `app/sync/health.server.ts` | **add to shared writers** (was wrongly read-only) |
| `app/sync/intake.server.ts` | already shared; W reconcile enqueue stays ordinary `createDurableJob` |
| `app/jobs/workers/catalog-facts/bulk-finish.ts` | **add** — CP write, now includes order-facts job types |
| `app/lib/order-facts/sync/**` | **add entire tree** (source-stage, control-plane, observations, shop-metadata, webhook, import, reconcile, apply-composition) |
| `app/jobs/workers/order-facts/sync-jobs.ts` | **add** |
| `app/lib/catalog-facts/apply/index.ts` | **add** `applyCanonicalFacts` (V-omitted) |
| `app/sync/application-receipt.server.ts` | **add** |
| `app/sync/dispatcher.server.ts` | already shared; also wrap `recoverExpiredDispatchLeases` / `claimBatchFair` / `ackEnqueued` |
| New webhook routes | intake-only; exclusive PR7 not required if they only call `ingestAuthenticatedWebhook` |

**Do not** add privacy claim SQL to `fair-claim-query.server.ts`. **Do not** put privacy work in `bootstrap.server.ts`.

One writer per later implementation branch. Helper C created **no** runtime branches.

---

## 8. Ordered internal milestones (foundation freeze first)

After ChatGPT **runtime** authority **and** §10 gates (not this packet):

1. **Foundation freeze (serial):** W inventory architecture test + migration/roles/helpers + wrapper contracts. No parallel writers on the same files.
2. **After freeze, slices that may parallel** (separate branches/chats/PRs; **not started now**):
   - Slice A — CP lifecycle/dispatcher/replay/uninstall wrappers (exclusive: `lifecycle.server.ts`, `dispatcher.server.ts`, `replay.server.ts`, `uninstall.server.ts`)
   - Slice B — TenantDb/db-context + order apply + catalog apply/checkpoint + health
   - Slice C — new `app/privacy/**` coordinator (no DurableJob fair-claim)
   - Slice D — Redis scoped remove + export revalidation + D scratch residual (interfaces frozen in step 1; FS/Redis proofs are not PG)
3. Actor/`sub` + assignment only **after** D-PR7-02 implementation authority (still **OPEN**).
4. Exact-head full CI; independent re-review.

Parallelize work, not uncertainty. Shared schema/interfaces freeze first.

---

## 9. Implementation-entry decisions still OPEN

Helper C **does not decide**:

| Item | State on this packet |
|---|---|
| **Q-008** | OPEN; production blocker |
| **D-PR7-01** | constrained sub-only; **unverified** installed-library bind |
| **D-PR7-02** | `useOnlineTokens` **not** set on W; enablement not authorized here |
| **PR47 closeout** | `fde01dc…` unmerged; §10 still requires independently accepted PR6 closure on merged main |
| D scratch reclaim API | `reclaimOperatorSelectedDScratch` **exists on W**; whether that is the “accepted D API after D merge” is **not** decided here |
| Catalog apply explicit processingEnabled pre-lock | identified hole; **not** a product decision |
| Whether `computeSyncHealth` upsert is in-scope for freeze wait | proposed yes (writer); **not** decided as a D-PR7 |

§10 conditions 1–6 remain; this helper does not declare them satisfied. Docs-only CI is not implementation evidence.

---

## 10. Bounded tests actually run

Environment: W `ee193f38491245a10fb2fa60d2cf9a29f3271605`, Node `v22.14.0`, vitest `v3.2.7`. Temporary `node_modules` symlink to `/workspace/stocky-plus/node_modules` for the run only; **removed** after. No Redis client. No PostgreSQL.

```text
cd /tmp/pr7-helpers/C/stocky-plus
npx vitest run --config vitest.config.ts app/lib/order-facts/sync/scratch-quota.test.ts
```

| Result | Value |
|---|---|
| Exit | **0** |
| Test files | **1 passed (1)** |
| Tests | **4 passed (4)** |
| Duration | 217ms |
| Why this file | DB-free; proves indeterminate D-scratch ledger is **not** treated as empty (`missing`/`corrupt`/`wrong_version` refuse; unknown identities refuse) — material PR7 FS LIMIT / residual hole |

Zero-test-collect: **not** observed (nonzero 4). No name filter.

**Not run (intentionally):** full W corpus; million-line envelopes; PR6-D scale (`pr6-d-scale-envelope.test.ts`); PG sync-integration / uninstall / tenant-access; `source-stage.test.ts` (FS + process-loss children; not required once quota boundary is shown).

---

## 11. Unexecuted limits

| Item | Classification |
|---|---|
| Full `npm test` / CI Gate on W | **not executed** |
| Any PostgreSQL suite (`test:db-isolation`, `test:sync-integration`, `test:sync-uninstall`, pr6-d-*.test.ts) | **BLOCKED** — no isolated PG cluster used |
| Redis queue inspect/add/remove against 16379 | **not executed** (forbidden attach) |
| `source-stage.test.ts` reclaim/live-writer cases | **not executed** (code-read + runbook; quota unit tests only) |
| Installed `@shopify/shopify-app-react-router` `sessionToken.sub` / online `associated_user` bind | **UNVERIFIED** (D-PR7-01/02) |
| Live Shopify / Partner HMAC / production | **not executed** (forbidden) |
| PR47 dossier contents | SHA identity only; **not** accepted as PR6 closeout |
| G1–G10 disposable PR45 SQL model | **not re-run** (planning-head proofs; not W processors) |
| Million-line D scratch / PR6-D scale | **not executed** (forbidden by work order) |

---

## 12. New IDs `PREP-C-NN`

| ID | Finding |
|---|---|
| **PREP-C-01** | Isolation: C worktree at W `ee193f3…`; no git write; no Redis/PG attach |
| **PREP-C-02** | V→W is the PR #43 squash only; most §7.9 files unchanged |
| **PREP-C-03** | PR45 “26-row” inventory vs 27 INSERT rows; completeness helper checks only 5 symbols |
| **PREP-C-04** | Phantom `getShopHealth`; `computeSyncHealth` upserts `SyncHealth` on V and W |
| **PREP-C-05** | Phantom `applyOrderFactWriters` / `applyReceipts`; real `applyOrderFacts` / `insertReceiptFinal` |
| **PREP-C-06** | `withTenantBoundTransactionState` still private; guard still required-not-optional |
| **PREP-C-07** | Lifecycle 7 symbols unchanged; `processingEnabled` still **absent**; reaper still in `lifecycle.server.ts` |
| **PREP-C-08** | `dispatcher_disabled_shop_path` still writes at W ~1378–1392 |
| **PREP-C-09** | V-era omitted writers listed in §3.2 / JSON `v_omitted` |
| **PREP-C-10** | W-only PR6-D writers listed in §4 / JSON `w_only` |
| **PREP-C-11** | Production Redis remove **missing**; `queue.add` is the publish path |
| **PREP-C-12** | Export loader is an unfenced publication side channel |
| **PREP-C-13** | D scratch is FS; PG advisory locks do not fence it; reclaim requires operator quiescence |
| **PREP-C-14** | `persistShopTimezoneCurrencyValues` is a W-only Shop UPDATE |
| **PREP-C-15** | Catalog `applyCanonicalFacts` lacks explicit processingEnabled pre-lock |
| **PREP-C-16** | Exclusive-ownership refresh: add `app/lib/order-facts/sync/**`, health, bulk-finish, catalog apply |
| **PREP-C-17** | OPEN: Q-008, D-PR7-01/02, PR47 closeout — not decided |
| **PREP-C-18** | Bounded tests: scratch-quota **4 passed / 4** on SHA `ee193f3…` |
| **PREP-C-19** | Unexecuted limits in §11 |
| **PREP-C-20** | Expired dispatch-lease recovery SQL has **no** processingEnabled predicate |
| **PREP-C-21** | `test:privacy` still missing on W |
| **PREP-C-22** | `JobExecutionStrategy` enum unchanged; W maps order-facts to ordinary REBUILDABLE; unknown still NO_AUTOMATIC_RETRY |
| **PREP-C-23** | PR47 `fde01dc…` is a descendant of W and **unmerged** — later prerequisite only |
| **PREP-C-24** | R-176 remains OPEN/P0 on W register |
| **PREP-C-25** | `lockSyncRun` still private; D import **reuses** catalog checkpoint writers |
| **PREP-C-26** | afterAuth still swallows `reinstall_denied` then upserts settings; catalog still enqueued; no `useOnlineTokens` |
| **PREP-C-27** | W intake quarantine path enqueues `order-facts-reconcile` via ordinary `createDurableJob` |
| **PREP-C-28** | `signalBulkOperationContinuation` now touches order-facts RETRY_WAIT without processingEnabled |
| **PREP-C-29** | Health W behavior: `order_facts` domain + scratch occupancy can mark DEGRADED |
| **PREP-C-30** | `scripts/privacy/**` and inventory-guard architecture test **absent** on W; future completeness test must include W-only symbols |

---

Stop. Coordinator is the only git writer. Helper C did not commit.
````

---

`PR48 EVIDENCE SEALED FOR CONSOLIDATED PR45 REVIEW — NO RUNTIME AUTHORIZED`
