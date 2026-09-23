# Phase 1 PR7 — Installed authentication boundary evidence

**Status:** `PR7 FINAL BOUNDARY EVIDENCE — AUTH PACKET COMPLETE — NO RUNTIME AUTHORIZED`

**IDs:** new `AUTH-X-*`. Sealed PR48 Helper A `PREP-A-*` are prior evidence only.

**Production / live Shopify / PR7 runtime:** NOT AUTHORIZED. Synthetic credentials and mocked transport only.

| Pin | Value |
|---|---|
| Base X | `f057d98c8a321b3e06875a6e9a83b787bcbc101f` |
| Branch | `cursor/planning-pr7-final-boundary-evidence-20260920-b58d` (platform suffix `-b58d` on requested `planning/pr7-final-boundary-evidence-20260920`) |
| Starting PR49 E | `d63629077fcf29775c69161372c2cf903cfa62c6` |
| Prior PR45 S (historical) | `fd5f7bbdf18fa12d75371686d8969d67fe68a158` |
| Frozen PR45 H (read-only) | `3cc2045107b54601c6b0e43c8690b7d090074b80` |
| Claude artifact (unchanged) | `0677ef0a283b302e705a1a663d8b26582c239984` sole parent H; blob `4bb936918c65ab6399f080d31b8f3bcf61ac96d1` |
| PR48 sealed (read-only) | `c97adda285b5625836a582deb03983099a7b3461` |
| Mandate | PR45 comment `5754395760`; AUTH taxonomy clarification per issue52 `5794206091` |
| Helper A | `bc-15bed5ff-b9fd-5bfe-8851-a44b685bc799` (isolated checkout; not a Git writer) |
| Coordinator rerun | 2026-09-21T10:27:37.058Z, Node `v22.14.0`, **35 cases / 30 PASS / 5 FAIL** / 0 other, 73 fetch calls |
| Independently adjudicated library defects | **eight** (Claude Stage A / artifact §7.1 / §8). PASS/FAIL is not the defect count. |
| Official docs access date | 2026-09-21 |

Classification: **FACT** (executed on X + installed libraries), **OFFICIAL** (Shopify docs fetched 2026-09-21), **PROPOSED** (adapter choice; not implemented), **UNEXECUTED**.

PR6 is CLOSED on X (PR47). Phase 1 is IN PROGRESS. R-176 OPEN/P0. R-164 unchanged. Q-008 OPEN. D-054 / no D-055. Claude review of PR45 does not authorize runtime or merge.

This document does not copy sealed PR48 reports wholesale. Load-bearing proof inputs are extracted from the appendices (`pr7-proof-extract-v1`). `/tmp` helper transcripts are historical locations, not required rerun inputs.

---

## 1. Question answered

Can Stocky bind an embedded actor and the first outbound Admin GraphQL credential using **installed** `@shopify/shopify-app-react-router@1.2.1` `authenticate.admin` on X, without stubbing success?

**Answer (FACT):** `sessionToken.sub` is present on the default offline path. First outbound GraphQL uses the offline access token for that shop. Online owner-binding is **not** safe: session id is `${shop}_${associated_user.id}` while lookup is `${shop}_${jwt.sub}`; IEEE-754 folds wide ids; cached sessions are not rebound to the current `sub`; `decodeSessionToken` does not enforce official iss/dest hostname equality. Checking identity after the wrong token was sent is scored FAIL.

X `shopify.server.ts` does **not** set `useOnlineTokens` (library default `false`). That flag was not enabled. A probe-only in-memory `shopifyApp({ useOnlineTokens: true })` fixture drove owner/staff/online-cache rows. `shopify.app.toml` was not modified.

---

## 2. Mock boundary (FACT)

| Mock id | When | Behavior |
|---|---|---|
| `token_exchange` | `POST https://{shop}/admin/oauth/access_token` | JSON `access_token` / `scope` / optional `associated_user` / refresh. `expiring` echoed. |
| `graphql_credential_capture` | `/graphql.json` only when `allowGraphqlCapture` | Records `X-Shopify-Access-Token` **sha256** + dest hostname; returns `{ data: { shop: { name: "authx-mock-shop" } } }`. |
| `fail_closed` | any other `*.myshopify.com` / `*.shopify.com` / Partners | throws `FAIL-CLOSED` |
| `http.request` / `https.request` | patched | `FAIL-CLOSED` |

Fetch mock is installed **before** `import("@shopify/shopify-app-react-router/server")`. After import, `setAbstractFetchFunc(mockedFetch)` updates `@shopify/shopify-api` `abstractFetch`. Token-exchange JSON uses reusable `.json()`. GraphQL capture is identified in results. Synthetic API key/secret/shops/JWTs only. Reports keep sha256 of tokens, never live tokens. Session storage: in-memory `Map`. Production Prisma was not used (AUTH-X-28 uses an in-memory fake client). User-Agent: real Chrome string (`isbot`).

Live Shopify / Partners / production sessions: **UNVERIFIED**.

---

## 3. Pins (FACT)

| Path | sha256 |
|---|---|
| X `app/shopify.server.ts` | `21b881203e64f30811708fd87cb935eff371a5f79b4c114c7b516c5c4f429b58` |
| X `app/tenant/require-admin-tenant.server.ts` | `8b697bfbbbaa8670450077138ed9341871f1040e3812cf1ebb91fe55effc629e` |
| X `package-lock.json` | `6e3fbc2e7c22f74696bfa9871faadd120051e766b1dedea917dc5d032db7016d` |
| Installed `authenticate.mjs` | `87b9721b8f27e265194b25642c36fcac6eb700b31cd0a5fa7a2efe64825b73e0` |
| Installed `token-exchange.mjs` | `9a7539a4ee929701639c1b6f7d7bdb08518ce6cffd660e97cb6ddd5a0da0d354` |

Lockfile package versions / integrity:

| Package | version | integrity |
|---|---|---|
| `@shopify/shopify-app-react-router` | 1.2.1 | `sha512-37FtkGoHkvXFUsBU/ibhTrlAGoogfq0VodyEckkggi35lrjZfOGX7xKzMWW13QyD6q8bGg/wCBNOW4WANvewEA==` |
| `@shopify/shopify-api` | 13.1.0 | `sha512-TwYL9kPxOgQwwlc9tmnAmSDs79Gdg9QLaIMCfkaCJxkhWxIHVkPWa74GvbBwnmTtB8jkg61Ja4/Qxrk9bCBUiA==` |
| `@shopify/shopify-app-session-storage` | 5.0.1 | `sha512-VL66qkz2w1x5hH14v+swFZAnN36VrFuVi/Lc6FkLTJxCSvSu4fPNYn04kjIxGykgsRb7trLBXC7mF3j8yDUFeA==` |
| `@shopify/shopify-app-session-storage-prisma` | 9.0.1 | `sha512-f/RT4X6hSADfh53dl9+cc0Ev9QcTwy01GoJFnNQRmjpSsNdDq7oBuCFbz/IufU+C9MJ/1wGi5haOr0R7VIcd2Q==` |

X `shopify.server.ts`: `AppDistribution.AppStore`; `future.expiringOfflineAccessTokens: true`; **`useOnlineTokens` is not set**. `hooks.afterAuth` bootstraps tenant + catalog enqueue. Probes did **not** instantiate X's `shopifyApp` (afterAuth would hit DB/Redis). `requireAdminTenant` calls `authenticate.admin` then `normalizeVerifiedShopifyDomain(session.shop)` — client shop identifiers do not establish authority. That route was not driven (no Prisma/Redis).

Entrypoint: installed `app.authenticate.admin` → `createTokenExchangeStrategy`. Webhook rows: installed `app.authenticate.webhook`.

---

## 4. Official rules used as oracles (OFFICIAL, 2026-09-21)

Fetched this work (not model memory):

- https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/cli-app-authentication
- https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange

Material rules:

1. ID token `sub` identifies the user; official example `sub` is a **string**.
2. Apps **must** check `iss` and `dest` **hostnames match**, plus `aud` / `exp` / `nbf` / HS256.
3. Access token is sent as `X-Shopify-Access-Token` on GraphQL Admin API. ID token is never sent to that API.
4. Token exchange: `POST https://{shop}/admin/oauth/access_token` with `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`. Offline default; online optional. Invalid/expired ID token → HTTP 400.
5. Online response includes `associated_user` (`id`, `account_owner`, `collaborator`, `email_verified`). Official example `id` is a JSON **number**.
6. CLI apps: `authenticate.admin(request)` then `admin.graphql`. `useOnlineTokens: true` stores both; webhooks/background jobs use the offline token.
7. Expiring offline: `expiring=1`.

Extract: appendix `docs/official-shopify-2026-09-21.md`.

---

## 5. 500-harness resolution (FACT)

Installed `token-exchange.mjs` wraps any token-exchange error that is not `InvalidJwtError` or HTTP 400 `invalid_subject_token` as `Response 500 Internal Server Error`.

Retained disposable attempts (appendix `attempts/*.mjs`), rerun 2026-09-21 from published sources:

| Attempt | Harness bug | Outcome |
|---|---|---|
| `01-import-before-correct-mock` | Adapter captures dummy fetch at import; later `globalThis.fetch` patch does not update `abstractFetch` | **Response 500** |
| `02-non-ok-not-invalid-subject` | Intercepted fetch returns 403 `{error: access_denied}` | **Response 500** |
| `03-ok-without-access-token` | 200 JSON `{}` (no `access_token`) | authenticate **succeeds** with `accessToken: null` (library gap, not 500) |
| `04-single-consume-Response` | Native `Response` body (json once) | authenticate **succeeds** — library calls `.json()` once on the success path |
| `05-html-200-not-json` | 200 HTML; `.json()` throws | **Response 500** |

Working matrix harness: patch `fetch` + `http`/`https` first; `setAbstractFetchFunc` after import; reusable JSON with `access_token`/`scope`/`associated_user`; Chrome UA; no X `afterAuth`; GraphQL capture only for first-outbound. **Zero Response 500 in the AUTH-X matrix.**

Attempt 03/04 logs may contain the synthetic probe string `shpat_offline_*`. Those are not live Shopify tokens. They are not portable expected digests.

---

## 6. Matrix (FACT)

Executed taxonomy is **35 cases / 30 PASS / 5 FAIL**. PASS/FAIL is the **security / official property scored per row**, not “did authenticate return 200”, and is **not** the library-defect count. Four PASS rows (AUTH-X-04, AUTH-X-05, AUTH-X-23, AUTH-X-27) are expected observations of unsafe library behavior. Independently adjudicated library-defect count is **eight** (§8). 30/5 is not a security acceptance target.

Coordinator parameterized rerun matched this taxonomy (`assert_taxonomy.mjs` ok). JWT `iat`/`jti`/`generatedAt` are **not** portable expected digests. First-outbound **access-token sha256** values below are constructed from deterministic synthetic token strings and did match on rerun.

| ID | Case | Result | Notes |
|---|---|---|---|
| AUTH-X-00 | IEEE-754 user-id digits | PASS | `Number("9007199254740993") === 9007199254740992` |
| AUTH-X-01 | Offline embedded, X-like | PASS | `sessionToken.sub` string `548380009`; session `offline_{shop}`; GraphQL dest `authx-test-shop.myshopify.com`; token sha256 `f54449bc02997dcd0c6f4cf2ed5d21855eac8a4f85707254c04843fc8e87c83f` |
| AUTH-X-02 | String sub + string `associated_user.id` | PASS | Online session; dest matches shop |
| AUTH-X-03 | Numeric JWT sub (safe integer) | PASS | `sub` recovers `548380009` |
| AUTH-X-04 | Wide **string** sub + JSON-number id | PASS (auth ok) | Lookup id `${shop}_${sub}` ≠ stored `${shop}_${associated_user.id}` (`...993` vs `...992`) |
| AUTH-X-05 | Wide JWT sub as JSON number | PASS (auth ok) | `sessionToken.sub` is number `9007199254740992`; digits not recovered |
| AUTH-X-06 | Sequential B (`...993`) then A (`...992`) | **FAIL** | mixedToken; A GraphQL sent B token sha256 `0bc9c11762a828264f059decb6c701a408ee127cc72e2bca99d245019e67770a` |
| AUTH-X-07 | Concurrent same collision | **FAIL** | Same session id last-write-wins; in-memory GraphQL hashes differed (`0bc9c117…` vs `313bae60…`) |
| AUTH-X-08 | Same `sub` two shops | PASS | Distinct session ids; GraphQL dest/hashes do not cross shops |
| AUTH-X-09 | Stale cached online session `associated_user.id=111` | **FAIL** | 0 exchanges; GraphQL uses stale token |
| AUTH-X-10 | Expired JWT | PASS | Response 401 |
| AUTH-X-11 | Malformed token | PASS | Response 401 |
| AUTH-X-12 | Forged signature | PASS | Response 401 |
| AUTH-X-13 | Expired stored online session | PASS | Re-exchange; GraphQL not the expired token |
| AUTH-X-14 | iss vs dest hostname mismatch | **FAIL** | Official: reject. Library **accepted** and exchanged against `dest` shop |
| AUTH-X-15 | Wrong `aud` | PASS | 401 |
| AUTH-X-16 | dest=other shop, valid HS256 | PASS | Session/GraphQL bound to dest hostname (query `shop` is not authority) |
| AUTH-X-17 | Owner flags from token-exchange body | PASS | `account_owner true` |
| AUTH-X-18 | Staff flags | PASS | all false |
| AUTH-X-19 | Collaborator flags | PASS | `collaborator true` |
| AUTH-X-20 | Client body `account_owner: true` | PASS | Stored user still `account_owner false` |
| AUTH-X-21 | `sub` vs `associated_user.id` mismatch | **FAIL** | Stored at `${shop}_999999`; lookup `${shop}_${sub}`; owner proof false |
| AUTH-X-22 | Safe-sub owner proof | PASS | `sub` string-equals `associated_user.id` |
| AUTH-X-23 | Wide-id owner proof unsupported | PASS | Observed `sub` `...993` vs assoc `...992` |
| AUTH-X-24 | Webhook valid HMAC | PASS | Loads **offline** session only |
| AUTH-X-25 | Webhook invalid HMAC | PASS | 401 |
| AUTH-X-26 | Webhook, no stored offline session | PASS | `session == null`; no staff identity |
| AUTH-X-27 | Online requested, body omits `associated_user` | PASS | `createSession` treats it as offline |
| AUTH-X-28 | Prisma adapter userId roundtrip (fake client) | PASS | `Number(String(9007199254740993n))` loses digits |
| AUTH-X-29 | Fail-closed GraphQL when capture off | PASS | `FAIL-CLOSED` |
| AUTH-X-30 | Fail-closed Partners | PASS | `FAIL-CLOSED` |
| AUTH-X-31 | `id_token` query (no Bearer) | PASS | Offline auth + GraphQL same offline hash as AUTH-X-01 |
| AUTH-X-32 | Bot UA | PASS | 410 Gone (`isbot`), not 500 |
| AUTH-X-33 | Installed type snippets | PASS | `OnlineAccessUser.id: number`; JWT `sub: string`; `useOnlineTokens` default false |
| AUTH-X-34 | Runtime versions | PASS | 1.2.1 / 13.1.0 / 5.0.1 / 9.0.1 |

---

## 7. First-outbound traces (FACT)

After `authenticate.admin` returned, probes called `admin.graphql("{ shop { name } }")`. Identity is the `X-Shopify-Access-Token` **at send time**.

### AUTH-X-01 (X-like offline) — property holds

- Dest shop: `authx-test-shop.myshopify.com`
- URL: `https://authx-test-shop.myshopify.com/admin/api/2026-07/graphql.json`
- Token sha256: `f54449bc02997dcd0c6f4cf2ed5d21855eac8a4f85707254c04843fc8e87c83f`
- Matches stored offline session. Session id `offline_authx-test-shop.myshopify.com`.

### AUTH-X-06 sequential mixedToken — FAIL for binding design

1. User B JWT `sub="9007199254740993"`. Token-exchange `associated_user.id` JSON number parses to `9007199254740992`. Online session stored at `authx-test-shop.myshopify.com_9007199254740992`. GraphQL hash `0bc9c11762a828264f059decb6c701a408ee127cc72e2bca99d245019e67770a`.
2. User A JWT `sub="9007199254740992"`. Lookup `${shop}_${sub}` **hits B's session**. **Zero** token-exchanges. GraphQL hash **identical** `0bc9c117…`.
3. `mixedToken: true`. Associated user still Bee/B.

Checking identity after the wrong token was sent is how this FAIL is scored.

### AUTH-X-07 concurrent

- Both authenticate ok. **Same session id** `..._9007199254740992`. One stored online session (last-write-wins).
- In-memory `admin.graphql` hashes **differ** (`0bc9c117…` vs `313bae60…`). Storage still aliases users.

---

## 8. Library defects (FACT vs OFFICIAL)

New AUTH-X findings. PR48 PREP-A-* is sealed historical evidence, not this run.

Executed taxonomy remains **35 / 30 PASS / 5 FAIL**. Independently adjudicated **eight library defects** (Claude Stage A / artifact §7.1) are listed below. Do not collapse these eight or invent a ninth. FAIL rows AUTH-X-06/07/09/14/21 are five of the eight; the other three are observed on PASS (auth ok) or harness-attempt rows.

| # | Defect | Supporting IDs |
|---|---|---|
| 1 | Online session id is `${shop}_${associated_user.id}`; lookup is `${shop}_${jwt.sub}` | AUTH-X-21, AUTH-X-06, AUTH-X-07 |
| 2 | `associated_user.id` and Prisma `userId` are `number`; IEEE-754 cannot preserve ids above `Number.MAX_SAFE_INTEGER` | AUTH-X-00, AUTH-X-04, AUTH-X-05, AUTH-X-23, AUTH-X-28 |
| 3 | `decodeSessionToken` does not check iss/dest hostname equality | AUTH-X-14 |
| 4 | Cached online session is not rebound to JWT `sub` | AUTH-X-09 |
| 5 | Missing `associated_user` on an “online” token-exchange body creates an offline session | AUTH-X-27 |
| 6 | 200 token-exchange JSON without `access_token` still authenticates (`accessToken: null`) | attempt 03 |
| 7 | Non-special token-exchange failures become opaque Response 500 | attempts 01/02/05 |
| 8 | Installed `token-exchange.mjs` logs `config.future.expiringOfflineAccessTokens` to stdout (present in pinned hash) | AUTH-X-34 (every matrix run) |

PASS rows that intentionally observe unsafe library behavior (not safe application behavior): AUTH-X-04, AUTH-X-05, AUTH-X-23, AUTH-X-27.

X's configured `shopifyApp` / `hooks.afterAuth` / `requireAdminTenant` were **not** driven. Probes build their own `shopifyApp({ apiKey, scopes: ["read_products"], hooks: {} })` with in-memory session storage.

Webhook path **does** load offline-only sessions (AUTH-X-24) — aligned with OFFICIAL background-job guidance.

---

## 9. Smallest proposed integration choice (PROPOSED — not implemented)

Not an architecture rewrite. Not authorized here.

1. Treat JWT **`sub` as the canonical actor digit-string**. Never `Number()` it for keys or comparison.
2. After token exchange, require `String(associated_user.id) === String(sessionToken.sub)` (exact digits). On mismatch or non-safe JSON number, **do not** persist an online session as owner proof; keep offline session for jobs.
3. Before using a cached online session, re-check stored actor digits equal current JWT `sub`. Stale `associated_user.id` → re-exchange or deny.
4. First outbound GraphQL must use the access token from the session selected by `(shop, sub)` / offline shop id.
5. Enforce OFFICIAL iss/dest hostname match in-app even if the library does not.
6. Ignore client body `account_owner` / role (already true in the library; keep it in Stocky tenant code).
7. Do not enable `useOnlineTokens` on X until (2)–(4) exist.

---

## 10. Unexecuted (UNEXECUTED)

- Live Shopify token exchange, real App Bridge ID tokens, real `associated_user.id` values from a store.
- Production Prisma/Postgres `BIGINT` column behavior.
- X `afterAuth` tenant bootstrap / Redis catalog enqueue.
- `requireAdminTenant` route integration.
- Collaborator vs staff permission intersection (`associated_user_scope`) against a real user permission set.
- Token refresh / retirement of expiring offline tokens against Shopify.

---

## 11. Historical helper isolation (FACT, not required of git-archive reruns)

Helper A exclusive checkout `/tmp/pr7-final-helpers/A` detached HEAD X, porcelain empty, Redis/Postgres not started. ESM does not consult `NODE_PATH`; published `run.sh` creates a disposable symlink `$PROOF/node_modules` → pinned `STOCKY_NODE_MODULES`. That is a harness path, not a package edit. Git HEAD/porcelain of a helper checkout is not required when rerunning from `git archive`.

---

## 12. Reproduction from this document

Convention `pr7-proof-extract-v1`. Required inputs are the extracted appendix files plus X `package-lock.json` / installed libraries matching the pins. No hidden `/tmp` scripts.

```bash
DOC=stocky-plus/docs/phases/phase-1/PR7_INSTALLED_AUTH_BOUNDARY_EVIDENCE.md
EXTRACT=/tmp/pr7-auth-extracted
python3 - <<'PY'
from pathlib import Path
import os, re
doc_path = Path(os.environ["DOC"])
lines = doc_path.read_text().splitlines()
begin_re = re.compile(r"^<!-- PROOF-EXTRACT:begin path=00_extract_proofs.py -->\s*$")
end_re = re.compile(r"^<!-- PROOF-EXTRACT:end path=00_extract_proofs.py -->\s*$")
start = next(i for i, line in enumerate(lines) if begin_re.match(line))
end = next(i for i, line in enumerate(lines) if end_re.match(line) and i > start)
body = "\n".join(lines[start + 1:end]) + "\n"
dest = Path(os.environ["EXTRACT"])
dest.mkdir(parents=True, exist_ok=True)
(dest / "00_extract_proofs.py").write_text(body)
print("bootstrapped", dest / "00_extract_proofs.py")
PY
python3 "$EXTRACT/00_extract_proofs.py" --doc "$DOC" --selftest
python3 "$EXTRACT/00_extract_proofs.py" --doc "$DOC" --dest "$EXTRACT"
# Verify X lockfile + installed authenticate hashes, then:
export STOCKY_PLUS_ROOT=/path/to/stocky-plus   # same tree as lockfile pin
export STOCKY_NODE_MODULES="$STOCKY_PLUS_ROOT/node_modules"
bash "$EXTRACT/reproduce.sh"
```

Portable expected digest is `expected_taxonomy.json` (PASS/FAIL + selected first-outbound hashes). `generatedAt` / JWT timestamps are not expected digests.

Negative controls: extraction self-test (missing / truncated / unlisted / bad digest); AUTH-X-29/30 fail-closed URLs; attempts 01/02/05 Response 500; AUTH-X-10/11/12 401; AUTH-X-32 410.

---

## 13. Remaining ChatGPT entry decisions (blocked for runtime)

- Persist verified `sessionToken.sub` string (D-PR7-01).
- Whether/when to enable `useOnlineTokens` (D-PR7-02) after binding tests exist.
- In-app iss/dest hostname equality.
- Owner proof vs unassigned when `sub` and `associated_user.id` disagree or are non-safe JSON numbers.

This packet does not invent those decisions.

---

## 14. Teardown

- No Redis/Postgres started for AUTH-X.
- No live Shopify.
- Helper B trees/ports not killed by AUTH-X.
- Coordinator Redis 18379 belongs to the effects packet, not this matrix.

---

## Appendix — extractable proof inputs

Bootstrap `00_extract_proofs.py` from the HTML comments below, then extract and hash-verify every `proof_manifest.json` path.


### EXTRACT `proof_manifest.json`

<!-- PROOF-EXTRACT:begin path=proof_manifest.json -->
```json
{
  "version": "pr7-proof-extract-v1",
  "kind": "installed-auth",
  "base_x": "f057d98c8a321b3e06875a6e9a83b787bcbc101f",
  "files": [
    {
      "path": "attempts/01-import-before-correct-mock.mjs",
      "sha256": "d643bab1a75d7df16c730fd3b460ebf435bfa98d0587ead1cf9058208cc74e25",
      "bytes": 2746
    },
    {
      "path": "attempts/02-non-ok-not-invalid-subject.mjs",
      "sha256": "c34678b8b5cb5610c4c768724d9771bec747b32de185a7aae21ed2f0ededbb08",
      "bytes": 1282
    },
    {
      "path": "attempts/03-ok-without-access-token.mjs",
      "sha256": "b54e20da4da4a761db9f13a17bbf3c910cf7f2910db52826630d105812d163a0",
      "bytes": 2718
    },
    {
      "path": "attempts/04-single-consume-Response.mjs",
      "sha256": "e70aacf7b35f7721d9efc6ed46fc81b7d47c5df8dd719f936ee3a12f5a46ce49",
      "bytes": 1920
    },
    {
      "path": "attempts/05-html-200-not-json.mjs",
      "sha256": "a717df98bd2832222199facb5f7cf0eb361c12b856a67a5384a5ad7b2146cb37",
      "bytes": 1751
    },
    {
      "path": "check_pins.py",
      "sha256": "2e72f9acea7058873a08735c53ac398bc9ad8bad032d178d8d1eef6a1c3282ff",
      "bytes": 2741
    },
    {
      "path": "docs/official-shopify-2026-09-21.md",
      "sha256": "27212fd6b865776a926e012e36f28a7f971782d76d73116aa462e7fc2adfb7c8",
      "bytes": 2734
    },
    {
      "path": "expected_taxonomy.json",
      "sha256": "b93aa7430a7bcc769a90274606bf267d61e98b14d0d7d07fa91eb9a494ee6b65",
      "bytes": 1210
    },
    {
      "path": "probes/assert_taxonomy.mjs",
      "sha256": "00e54360e0015a9dc41f6df6792862c3921482d604f00a642b3f3fa9fbfa1855",
      "bytes": 2314
    },
    {
      "path": "probes/harness.mjs",
      "sha256": "9e615c4156fd473dc23ecd5d05c08464471cfc721f0eadd27987ba93cf520b2f",
      "bytes": 19622
    },
    {
      "path": "probes/run.sh",
      "sha256": "0e8c2adb3101abd4fa50ef46c5afd7f87e07ee082d54021c080d7d455b5d99d0",
      "bytes": 1325
    },
    {
      "path": "probes/run_all.mjs",
      "sha256": "73ee688e352f7de69402cea6e8f0db3620cc6db4e60b0608fd10a5b45b16efdc",
      "bytes": 41090
    },
    {
      "path": "reproduce.sh",
      "sha256": "963d215b9b8751014085e3dfd0cb7fd90af01ce0c00e72aa5675b02f39393f96",
      "bytes": 493
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

### EXTRACT `attempts/01-import-before-correct-mock.mjs`

<!-- PROOF-EXTRACT:begin path=attempts/01-import-before-correct-mock.mjs -->
```javascript
/**
 * Attempt 01 — fetch mock installed AFTER shopify-app import (classic 500).
 * abstractFetch remains the pre-mock capture (502 HTML), which is not
 * InvalidJwt / invalid_subject_token → token-exchange.mjs throws Response 500.
 * No live Shopify: dummy fetch is installed before import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "01-import-before-correct-mock.log");

const dummy = async (input) => {
  const url = typeof input === "string" ? input : input?.url;
  const body = "<html>unintercepted</html>";
  return {
    ok: false,
    status: 502,
    statusText: "Bad Gateway",
    headers: new Headers({ "Content-Type": "text/html" }),
    json: async () => ({ error: "html" }),
    text: async () => body,
    clone() {
      return this;
    },
  };
};
globalThis.fetch = dummy;

const rr = await import("@shopify/shopify-app-react-router/server");
const { SignJWT } = await import("jose");
const { createSecretKey } = await import("node:crypto");

// "Correct" mock applied too late — only globalThis.fetch, not abstractFetch.
const { mockedFetch, API_KEY, API_SECRET, SHOP, UA, APP_URL, jwtClaims, MemorySessionStorage } =
  await import("../probes/harness.mjs");
globalThis.fetch = mockedFetch;

const token = await new SignJWT(
  jwtClaims({ shop: SHOP, sub: "548380009", aud: API_KEY }),
).setProtectedHeader({ alg: "HS256" }).sign(createSecretKey(Buffer.from(API_SECRET)));

const app = rr.shopifyApp({
  apiKey: API_KEY,
  apiSecretKey: API_SECRET,
  apiVersion: rr.ApiVersion.July26,
  scopes: ["read_products"],
  appUrl: APP_URL,
  sessionStorage: new MemorySessionStorage(),
  distribution: rr.AppDistribution.AppStore,
  useOnlineTokens: false,
  future: { expiringOfflineAccessTokens: true },
  logger: { level: rr.LogSeverity.Error, httpRequests: false },
});

const req = new Request(`${APP_URL}/app?shop=${SHOP}&embedded=1`, {
  headers: { authorization: `Bearer ${token}`, "user-agent": UA },
});

let outcome;
try {
  await app.authenticate.admin(req);
  outcome = { ok: true };
} catch (err) {
  outcome =
    err instanceof Response
      ? { ok: false, kind: "Response", status: err.status, statusText: err.statusText }
      : { ok: false, kind: "Error", message: String(err?.message || err) };
}

const report = {
  attempt: "01-import-before-correct-mock",
  expected: "Response 500 from token-exchange.mjs catch",
  outcome,
  note: "Dummy 502 fetch captured at adapter import; later globalThis.fetch patch does not update abstractFetch.",
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
```
<!-- PROOF-EXTRACT:end path=attempts/01-import-before-correct-mock.mjs -->

### EXTRACT `attempts/02-non-ok-not-invalid-subject.mjs`

<!-- PROOF-EXTRACT:begin path=attempts/02-non-ok-not-invalid-subject.mjs -->
```javascript
/**
 * Attempt 02 — fetch intercepted, but token-exchange returns non-OK JSON that is
 * not {error: invalid_subject_token} at 400 → Response 500.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadShopify,
  makeApp,
  MemorySessionStorage,
  signJoseJwt,
  jwtClaims,
  adminRequest,
  catchAuth,
  mockCtl,
  resetMockDefaults,
  SAFE_SUB,
} from "../probes/harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "02-non-ok-not-invalid-subject.log");

await loadShopify();
resetMockDefaults();
mockCtl.status = 403;
mockCtl.errorBody = JSON.stringify({ error: "access_denied" });

const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), (await import("../probes/harness.mjs")).API_SECRET);
const app = makeApp({ useOnlineTokens: false, sessionStorage: new MemorySessionStorage() });
const outcome = await catchAuth(() => app.authenticate.admin(adminRequest(token)));
const report = {
  attempt: "02-non-ok-not-invalid-subject",
  expected: "Response 500 (HttpResponseError 403 is not the 400 invalid_subject_token special case)",
  outcome,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
```
<!-- PROOF-EXTRACT:end path=attempts/02-non-ok-not-invalid-subject.mjs -->

### EXTRACT `attempts/03-ok-without-access-token.mjs`

<!-- PROOF-EXTRACT:begin path=attempts/03-ok-without-access-token.mjs -->
```javascript
/**
 * Attempt 03 — 200 OK but body is not JSON with access_token/scope.
 * token-exchange.mjs json() / createSession throws → wrapped as Response 500.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadShopify,
  makeApp,
  MemorySessionStorage,
  signJoseJwt,
  jwtClaims,
  adminRequest,
  catchAuth,
  mockCtl,
  resetMockDefaults,
  SAFE_SUB,
  API_SECRET,
} from "../probes/harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "03-ok-without-access-token.log");

await loadShopify();
resetMockDefaults();
mockCtl.status = 200;
// Force the token-exchange branch to return non-JSON via errorBody unused;
// instead monkey the fetch by setting status 200 with invalid JSON through a temp flag.
// We reuse status 200 and replace payload by returning "{not-json" via parse fail:
// empty body → tokenExchangePayload still runs. Use passthrough then...
// Simpler: status 200 with mocked fetch override by setting error via a 200 HTML:
mockCtl.status = 299; // not 200, so errorBody path; but 299 is ok-ish? 299 is ok (200-299).
// Use 200 with empty JSON object by patching error path: status stays 200 and
// we set associated flow... empty object: intercept by status !== 200 is false.
// Directly set a broken custom: use status 200 and errorBody no — need a new ctl.
// Use status 200 + replace global mockedFetch? Keep simple: 200 with JSON "{}"
// by using mockCtl.status = 200 and a one-off fetch wrapper.

const { mockedFetch } = await import("../probes/harness.mjs");
const { setAbstractFetchFunc } = await import("@shopify/shopify-api/runtime");
const broken = async (input, init) => {
  const url = typeof input === "string" ? input : input?.url;
  if (String(url).includes("/admin/oauth/access_token")) {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => ({}),
      text: async () => "{}",
      clone() {
        return this;
      },
    };
  }
  return mockedFetch(input, init);
};
setAbstractFetchFunc(broken);
globalThis.fetch = broken;

const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
const app = makeApp({ useOnlineTokens: false, sessionStorage: new MemorySessionStorage() });
const outcome = await catchAuth(() => app.authenticate.admin(adminRequest(token)));
const report = {
  attempt: "03-ok-without-access-token",
  expected: "Response 500 — 200 JSON missing access_token / createSession failure",
  outcome,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
```
<!-- PROOF-EXTRACT:end path=attempts/03-ok-without-access-token.mjs -->

### EXTRACT `attempts/04-single-consume-Response.mjs`

<!-- PROOF-EXTRACT:begin path=attempts/04-single-consume-Response.mjs -->
```javascript
/**
 * Attempt 04 — native single-consume Response for token exchange.
 * If the library reads the body twice, this 500s. Retained even if it PASSes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadShopify,
  makeApp,
  MemorySessionStorage,
  signJoseJwt,
  jwtClaims,
  adminRequest,
  catchAuth,
  API_SECRET,
  SAFE_SUB,
  mockedFetch,
  resetMockDefaults,
} from "../probes/harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "04-single-consume-Response.log");

await loadShopify();
resetMockDefaults();
const { setAbstractFetchFunc } = await import("@shopify/shopify-api/runtime");

const onceBody = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
  if (String(url).includes("/admin/oauth/access_token")) {
    const body = JSON.stringify({
      access_token: "shpat_offline_once",
      scope: "read_products",
      expires_in: 3600,
      refresh_token: "shprt_offline_once",
      refresh_token_expires_in: 7776000,
    });
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return mockedFetch(input, init);
};
setAbstractFetchFunc(onceBody);
globalThis.fetch = onceBody;

const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
const app = makeApp({ useOnlineTokens: false, sessionStorage: new MemorySessionStorage() });
const outcome = await catchAuth(() => app.authenticate.admin(adminRequest(token)));
const report = {
  attempt: "04-single-consume-Response",
  expected:
    "If token-exchange.mjs calls response.json() twice, Response 500 (body consumed). If once, authenticate may succeed.",
  outcome,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
```
<!-- PROOF-EXTRACT:end path=attempts/04-single-consume-Response.mjs -->

### EXTRACT `attempts/05-html-200-not-json.mjs`

<!-- PROOF-EXTRACT:begin path=attempts/05-html-200-not-json.mjs -->
```javascript
/**
 * Attempt 05 — token-exchange JSON parse throws (HTML 200) → Response 500.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadShopify,
  makeApp,
  MemorySessionStorage,
  signJoseJwt,
  jwtClaims,
  adminRequest,
  catchAuth,
  API_SECRET,
  SAFE_SUB,
  mockedFetch,
  resetMockDefaults,
} from "../probes/harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "05-html-200-not-json.log");

await loadShopify();
resetMockDefaults();
const { setAbstractFetchFunc } = await import("@shopify/shopify-api/runtime");
const htmlOk = async (input, init) => {
  const url = typeof input === "string" ? input : input?.url;
  if (String(url).includes("/admin/oauth/access_token")) {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "Content-Type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
      text: async () => "<html>not json</html>",
      clone() {
        return this;
      },
    };
  }
  return mockedFetch(input, init);
};
setAbstractFetchFunc(htmlOk);
globalThis.fetch = htmlOk;

const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
const app = makeApp({ useOnlineTokens: false, sessionStorage: new MemorySessionStorage() });
const outcome = await catchAuth(() => app.authenticate.admin(adminRequest(token)));
const report = {
  attempt: "05-html-200-not-json",
  expected: "Response 500 — json() throws, token-exchange.mjs wraps unknown errors as 500",
  outcome,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
```
<!-- PROOF-EXTRACT:end path=attempts/05-html-200-not-json.mjs -->

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

### EXTRACT `docs/official-shopify-2026-09-21.md`

<!-- PROOF-EXTRACT:begin path=docs/official-shopify-2026-09-21.md -->
```markdown
# Official Shopify documentation extracts

Access date: 2026-09-21 (fetched this run; not model memory).

Sources:
- https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/cli-app-authentication
- https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange

Classification: OFFICIAL.

## ID tokens

An ID token (previously session token) is a short-lived JWT App Bridge issues to prove a request comes from an authenticated Shopify user. It carries no API permissions. Apps exchange it for an access token and never send the ID token to a Shopify API.

Validated claims (if validating manually):
- exp: must be in the future
- nbf: must be in the past
- aud: must match the app client ID
- iss and dest: **their hostnames must match**

Identity claims (read, not the same validation set):
- sub: the user the token was issued for
- sid, jti, iat

Official example payload uses a **string** `sub` (`"42"`).

ID tokens expire about one minute after issue. 400 from token exchange for an expired/invalid ID token is a routine condition; respond 401 with `X-Shopify-Retry-Invalid-Session-Request` so App Bridge retries.

## Access tokens

GraphQL Admin API authenticates with `X-Shopify-Access-Token`.

Offline tokens: default; persist across sessions; background jobs/webhooks. Public apps: expiring offline (`expiring=1`); refresh token returned.

Online tokens: optional; tied to the staff member; 24h or until logout. Response includes `associated_user`:
- id: uniquely identifies the user (use it to key per-user data)
- account_owner
- collaborator
- email_verified (trust email only when true)
- associated_user_scope: intersection of app scopes and that user's permissions

Official online example uses a JSON number `associated_user.id` (e.g. 902541635).

Token exchange endpoint: `POST https://{shop}.myshopify.com/admin/oauth/access_token`

Parameters: client_id, client_secret, grant_type=`urn:ietf:params:oauth:grant-type:token-exchange`, subject_token, subject_token_type=`urn:ietf:params:oauth:token-type:id_token`, requested_token_type offline or online, expiring for offline.

## authenticate.admin (CLI apps)

`authenticate.admin(request)` validates the ID token, performs token exchange, and returns `admin` for GraphQL Admin API.

Default is offline tokens. `useOnlineTokens: true` stores both online and offline; `session.onlineAccessInfo` then has the current user.

Example: `admin.graphql(\`query { shop { name } }\`)`.

X `shopify.server.ts` does **not** set `useOnlineTokens` (FACT from file read; default false).
```
<!-- PROOF-EXTRACT:end path=docs/official-shopify-2026-09-21.md -->

### EXTRACT `expected_taxonomy.json`

<!-- PROOF-EXTRACT:begin path=expected_taxonomy.json -->
```json
{
  "version": "pr7-auth-taxonomy-v1",
  "note": "Portable assertions. generatedAt, JWT iat/jti, and timestamped expires are NOT expected digests.",
  "caseCounts": { "total": 35, "pass": 30, "fail": 5, "other": 0 },
  "failIds": ["AUTH-X-06", "AUTH-X-07", "AUTH-X-09", "AUTH-X-14", "AUTH-X-21"],
  "passIds": [
    "AUTH-X-00", "AUTH-X-01", "AUTH-X-02", "AUTH-X-03", "AUTH-X-04", "AUTH-X-05",
    "AUTH-X-08", "AUTH-X-10", "AUTH-X-11", "AUTH-X-12", "AUTH-X-13", "AUTH-X-15",
    "AUTH-X-16", "AUTH-X-17", "AUTH-X-18", "AUTH-X-19", "AUTH-X-20", "AUTH-X-22",
    "AUTH-X-23", "AUTH-X-24", "AUTH-X-25", "AUTH-X-26", "AUTH-X-27", "AUTH-X-28",
    "AUTH-X-29", "AUTH-X-30", "AUTH-X-31", "AUTH-X-32", "AUTH-X-33", "AUTH-X-34"
  ],
  "firstOutbound": {
    "AUTH-X-01": {
      "destShop": "authx-test-shop.myshopify.com",
      "accessTokenSha256": "f54449bc02997dcd0c6f4cf2ed5d21855eac8a4f85707254c04843fc8e87c83f"
    }
  },
  "AUTH-X-06": {
    "mixedToken": true,
    "hashA": "0bc9c11762a828264f059decb6c701a408ee127cc72e2bca99d245019e67770a",
    "hashB": "0bc9c11762a828264f059decb6c701a408ee127cc72e2bca99d245019e67770a"
  },
  "AUTH-X-14": { "libraryRejected": false },
  "zeroResponse500InMatrix": true
}
```
<!-- PROOF-EXTRACT:end path=expected_taxonomy.json -->

### EXTRACT `probes/assert_taxonomy.mjs`

<!-- PROOF-EXTRACT:begin path=probes/assert_taxonomy.mjs -->
```javascript
#!/usr/bin/env node
/**
 * Compare AUTH-X results.json against portable expected_taxonomy.json.
 * Does not compare generatedAt or JWT timestamps.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsPath = process.argv[2] || path.resolve(__dirname, "..", "results.json");
const expectedPath = process.argv[3] || path.resolve(__dirname, "..", "expected_taxonomy.json");
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const errors = [];

function eq(label, got, want) {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    errors.push(`${label}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  }
}

eq("caseCounts", results.caseCounts, expected.caseCounts);
const byId = Object.fromEntries((results.cases || []).map((c) => [c.id, c]));
for (const id of expected.failIds) {
  if (byId[id]?.pass !== false) errors.push(`${id} expected FAIL`);
}
for (const id of expected.passIds) {
  if (byId[id]?.pass !== true) errors.push(`${id} expected PASS`);
}
const fo = byId["AUTH-X-01"]?.actual?.firstOutbound;
eq("AUTH-X-01 dest", fo?.destShop, expected.firstOutbound["AUTH-X-01"].destShop);
eq(
  "AUTH-X-01 hash",
  fo?.accessTokenSha256,
  expected.firstOutbound["AUTH-X-01"].accessTokenSha256,
);
eq("AUTH-X-06 mixedToken", byId["AUTH-X-06"]?.actual?.mixedToken, expected["AUTH-X-06"].mixedToken);
eq("AUTH-X-06 hashA", byId["AUTH-X-06"]?.actual?.hashA, expected["AUTH-X-06"].hashA);
eq("AUTH-X-06 hashB", byId["AUTH-X-06"]?.actual?.hashB, expected["AUTH-X-06"].hashB);
eq(
  "AUTH-X-14 libraryRejected",
  byId["AUTH-X-14"]?.actual?.libraryRejected,
  expected["AUTH-X-14"].libraryRejected,
);
const statuses = (results.cases || []).map((c) => c.actual?.result?.status ?? c.actual?.status);
const fiveHundreds = (results.cases || []).filter((c) => {
  const s = c.actual?.result?.status ?? c.actual?.status;
  return s === 500;
});
if (fiveHundreds.length) errors.push(`matrix contained ${fiveHundreds.length} status 500`);

const report = { ok: errors.length === 0, errors, resultsPath, expectedPath };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
```
<!-- PROOF-EXTRACT:end path=probes/assert_taxonomy.mjs -->

### EXTRACT `probes/harness.mjs`

<!-- PROOF-EXTRACT:begin path=probes/harness.mjs -->
```javascript
/**
 * AUTH-X harness — disposable mocked transport only.
 * Never calls live Shopify / Partners. Fail-closed on unexpected URLs.
 * Patches fetch BEFORE importing shopifyApp. Does not edit application source.
 */
import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";

export const API_KEY = "authx-test-api-key";
export const API_SECRET = "authx-test-api-secret-not-real";
export const APP_URL = "https://authx-probe.example.com";
export const SHOP = "authx-test-shop.myshopify.com";
export const SHOP_B = "authx-other-shop.myshopify.com";
export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const WIDE = "9007199254740993";
export const WIDE_NEIGHBOR = "9007199254740992";
export const SAFE_SUB = "548380009";

export const fetchLog = [];
export const graphqlCaptures = [];

export const mockCtl = {
  associatedUser: {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  },
  /** If set, associated_user.id JSON literal (digits or quoted string). Else JWT sub. */
  associatedUserIdLiteral: null,
  /** Emit associated_user.id as JSON number (official shape) vs quoted string. */
  idAsJsonNumber: true,
  onlineOmitAssociatedUser: false,
  offlineHasAssociatedUser: false,
  status: 200,
  errorBody: null,
  allowGraphqlCapture: false,
  /** When true, token-exchange mock is disabled so abstractFetch sees the previous capture (attempt harness). */
  passthroughTokenExchange: false,
};

const denyNet = (kind, args) => {
  const hint = typeof args?.[0] === "string" ? args[0] : args?.[0]?.href || args?.[0]?.host || "?";
  throw new Error(`FAIL-CLOSED ${kind} outbound: ${hint}`);
};
http.request = (...args) => denyNet("http.request", args);
http.get = (...args) => denyNet("http.get", args);
https.request = (...args) => denyNet("https.request", args);
https.get = (...args) => denyNet("https.get", args);

function isBlockedHost(hostname) {
  return (
    hostname.endsWith(".myshopify.com") ||
    hostname === "myshopify.com" ||
    hostname.endsWith(".shopify.com") ||
    hostname === "shopify.com" ||
    hostname.includes("partners.shopify")
  );
}

export function headerMap(headers) {
  const out = {};
  if (!headers) return out;
  if (typeof headers.forEach === "function") {
    headers.forEach((v, k) => {
      out[String(k).toLowerCase()] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[String(k).toLowerCase()] = v;
    return out;
  }
  for (const [k, v] of Object.entries(headers)) out[String(k).toLowerCase()] = v;
  return out;
}

export function decodeJwtUnverified(token) {
  if (!token || typeof token !== "string" || token.split(".").length < 2) return null;
  try {
    const json = Buffer.from(token.split(".")[1], "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Response whose .json() can be called more than once.
 * Installed token-exchange.mjs does not clone; a consumed body becomes a 500.
 */
export function jsonResponse(obj, status = 200) {
  const payload = typeof obj === "string" ? obj : JSON.stringify(obj);
  let parsed;
  let parseErr = null;
  try {
    parsed = JSON.parse(payload);
  } catch (e) {
    parseErr = e;
  }
  const headers = new Headers({ "Content-Type": "application/json" });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers,
    url: "",
    redirected: false,
    type: "default",
    async json() {
      if (parseErr) throw parseErr;
      return structuredClone(parsed);
    },
    async text() {
      return payload;
    },
    clone() {
      return jsonResponse(payload, status);
    },
  };
}

function tokenExchangePayload(bodyObj) {
  const requested = bodyObj.requested_token_type || "";
  const isOnline = String(requested).includes("online-access-token");
  const jwt = decodeJwtUnverified(bodyObj.subject_token);
  const subRaw = jwt?.sub;
  const subStr = subRaw === undefined || subRaw === null ? "unknown" : String(subRaw);
  const destHost = (() => {
    try {
      return jwt?.dest ? new URL(jwt.dest).hostname : SHOP;
    } catch {
      return SHOP;
    }
  })();
  const shopLabel = String(destHost).split(".")[0];
  const user = { ...mockCtl.associatedUser };

  if (isOnline && mockCtl.onlineOmitAssociatedUser) {
    return JSON.stringify({
      access_token: `shpat_online_missing_user_${shopLabel}`,
      scope: "read_products",
      expires_in: 86399,
    });
  }

  const idLiteral =
    mockCtl.associatedUserIdLiteral != null
      ? mockCtl.associatedUserIdLiteral
      : mockCtl.idAsJsonNumber
        ? subStr
        : JSON.stringify(subStr);

  if (isOnline) {
    const access_token = `shpat_online_${shopLabel}_${subStr}`;
    const obj = {
      access_token,
      scope: "read_products",
      expires_in: 86399,
      associated_user_scope: "read_products",
      associated_user: { id: 0, ...user },
    };
    return JSON.stringify(obj).replace('"id":0', `"id":${idLiteral}`);
  }

  const offline = {
    access_token: `shpat_offline_${shopLabel}`,
    scope: "read_products",
    expires_in: 3600,
    refresh_token: `shprt_offline_${shopLabel}`,
    refresh_token_expires_in: 7776000,
  };
  if (mockCtl.offlineHasAssociatedUser) {
    offline.associated_user = { id: 0, ...user };
    return JSON.stringify(offline).replace('"id":0', `"id":${idLiteral}`);
  }
  return JSON.stringify(offline);
}

async function normalizeFetch(input, init = {}) {
  const req = input instanceof Request ? input : null;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : req?.url || input?.url;
  const method = init.method || req?.method || "GET";
  const headers = headerMap(init.headers || req?.headers);
  let body = init.body;
  if (body == null && req) {
    try {
      body = await req.clone().text();
    } catch {
      body = null;
    }
  }
  if (typeof body !== "string" && body != null && typeof body === "object") {
    if (typeof body.toString === "function" && body.toString() !== "[object Object]") {
      body = String(body);
    }
  }
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = "";
  }
  return { url, method, headers, body, hostname };
}

export async function mockedFetch(input, init = {}) {
  const { url, method, headers, body, hostname } = await normalizeFetch(input, init);
  const rec = {
    url,
    method,
    hostname,
    contentType: headers["content-type"] || null,
    bodyPreview: typeof body === "string" ? body.slice(0, 400) : null,
  };
  fetchLog.push(rec);

  if (hostname && isBlockedHost(hostname)) {
    if (String(url).includes("/admin/oauth/access_token")) {
      if (mockCtl.passthroughTokenExchange) {
        rec.mocked = "passthrough_unintercepted";
        return jsonResponse("<html>bad gateway</html>", 502);
      }
      if (mockCtl.status !== 200) {
        rec.mocked = `status_${mockCtl.status}`;
        const err =
          mockCtl.errorBody ||
          JSON.stringify({ error: "server_error", error_description: "harness" });
        return jsonResponse(err, mockCtl.status);
      }
      let bodyObj = {};
      if (typeof body === "string" && body.length) {
        try {
          bodyObj = JSON.parse(body);
        } catch {
          rec.mocked = "token_exchange_body_parse_fail";
          return jsonResponse("{not-json", 200);
        }
      }
      rec.requested_token_type = bodyObj.requested_token_type;
      rec.grant_type = bodyObj.grant_type;
      rec.expiring = bodyObj.expiring;
      rec.mocked = "token_exchange";
      const payload = tokenExchangePayload(bodyObj);
      rec.responsePreview = payload.replace(/shpat_[A-Za-z0-9_]+/g, "shpat_[REDACTED]").slice(0, 400);
      return jsonResponse(payload, 200);
    }

    if (String(url).includes("/graphql.json") || String(url).includes("/graphql")) {
      if (mockCtl.allowGraphqlCapture) {
        const token = headers["x-shopify-access-token"] || "";
        const capture = {
          mocked: "graphql_credential_capture",
          url,
          hostname,
          method,
          accessTokenSha256: token ? crypto.createHash("sha256").update(token).digest("hex") : null,
          accessTokenRedacted: redactToken(token),
          destShop: hostname,
        };
        graphqlCaptures.push(capture);
        rec.mocked = "graphql_credential_capture";
        rec.accessTokenSha256 = capture.accessTokenSha256;
        return jsonResponse({ data: { shop: { name: "authx-mock-shop" } } }, 200);
      }
      rec.mocked = "fail_closed";
      throw new Error(`FAIL-CLOSED store/partners call: ${url}`);
    }

    rec.mocked = "fail_closed";
    throw new Error(`FAIL-CLOSED store/partners call: ${url}`);
  }

  rec.mocked = "fail_closed_unexpected";
  throw new Error(`FAIL-CLOSED unexpected fetch: ${url}`);
}

globalThis.fetch = mockedFetch;

export class MemorySessionStorage {
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
      accessTokenSha256: s.accessToken
        ? crypto.createHash("sha256").update(s.accessToken).digest("hex")
        : null,
      associated_user: s.onlineAccessInfo?.associated_user
        ? summarizeUser(s.onlineAccessInfo.associated_user)
        : null,
    }));
  }
}

export function redactToken(t) {
  if (!t || typeof t !== "string") return t ?? null;
  return t
    .replace(/shpat_[^\s"'\\]+/g, "shpat_[REDACTED]")
    .replace(/shprt_[^\s"'\\]+/g, "shprt_[REDACTED]");
}

export function tokenSha256(t) {
  if (!t || typeof t !== "string") return null;
  return crypto.createHash("sha256").update(t).digest("hex");
}

export function summarizeUser(u) {
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
    keys: u && typeof u === "object" ? Object.keys(u) : [],
  };
}

export function summarizeSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope,
    expires: session.expires ? session.expires.toISOString() : null,
    accessToken: redactToken(session.accessToken),
    accessTokenSha256: tokenSha256(session.accessToken),
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

export function summarizeAuth(ctx) {
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

export async function catchAuth(fn) {
  try {
    const ctx = await fn();
    return { ok: true, ctx: summarizeAuth(ctx), raw: ctx };
  } catch (err) {
    if (err instanceof Response) {
      const headers = {};
      err.headers?.forEach?.((v, k) => {
        headers[k] = v;
      });
      return {
        ok: false,
        kind: "Response",
        status: err.status,
        statusText: err.statusText,
        headers,
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

export function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function signRawJwt(payloadObjectOrJson, secret) {
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

export async function signJoseJwt(payload, secret) {
  const { SignJWT } = await import("jose");
  const { createSecretKey } = await import("node:crypto");
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(createSecretKey(Buffer.from(secret)));
}

export function jwtClaims({ shop = SHOP, sub = SAFE_SUB, aud = API_KEY, expOffset = 3600, extra = {} } = {}) {
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

export function shopHostParam(shop) {
  return Buffer.from(`${shop}/admin`).toString("base64");
}

export function adminRequest(token, { shop = SHOP, urlPath = "/app", extraHeaders = {}, method = "GET", body, idTokenQuery = false } = {}) {
  const headers = {
    "user-agent": UA,
    ...extraHeaders,
  };
  if (!idTokenQuery) headers.authorization = `Bearer ${token}`;
  const q = new URLSearchParams({ shop, embedded: "1", host: shopHostParam(shop) });
  if (idTokenQuery) q.set("id_token", token);
  return new Request(`${APP_URL}${urlPath}?${q.toString()}`, {
    method,
    headers,
    body,
  });
}

let shopifyMods = null;

export async function loadShopify() {
  if (shopifyMods) return shopifyMods;
  const rr = await import("@shopify/shopify-app-react-router/server");
  const shopifyApiMod = await import("@shopify/shopify-api");
  const { PrismaSessionStorage } = await import("@shopify/shopify-app-session-storage-prisma");
  const { setAbstractFetchFunc } = await import("@shopify/shopify-api/runtime");
  setAbstractFetchFunc(mockedFetch);
  shopifyMods = { rr, shopifyApiMod, PrismaSessionStorage, setAbstractFetchFunc };
  return shopifyMods;
}

export function makeApp({ useOnlineTokens, future, sessionStorage, hooks } = {}) {
  if (!shopifyMods) throw new Error("loadShopify() first");
  const { shopifyApp, ApiVersion, AppDistribution, LogSeverity } = shopifyMods.rr;
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
    hooks: hooks ?? {},
    logger: { level: LogSeverity.Error, httpRequests: false },
  });
}

export function resetMockDefaults() {
  mockCtl.associatedUser = {
    first_name: "Ada",
    last_name: "Owner",
    email: "owner@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  mockCtl.associatedUserIdLiteral = null;
  mockCtl.idAsJsonNumber = true;
  mockCtl.onlineOmitAssociatedUser = false;
  mockCtl.offlineHasAssociatedUser = false;
  mockCtl.status = 200;
  mockCtl.errorBody = null;
  mockCtl.allowGraphqlCapture = false;
  mockCtl.passthroughTokenExchange = false;
}

export async function firstOutboundGraphql(rawCtx) {
  const start = graphqlCaptures.length;
  const expectedHash = tokenSha256(rawCtx?.session?.accessToken);
  mockCtl.allowGraphqlCapture = true;
  let graphql = { ok: false };
  try {
    const res = await rawCtx.admin.graphql("{ shop { name } }");
    const body = await res.json();
    graphql = { ok: true, body };
  } catch (err) {
    graphql = {
      ok: false,
      kind: err instanceof Response ? "Response" : "Error",
      status: err instanceof Response ? err.status : undefined,
      message: err instanceof Response ? err.statusText : String(err?.message || err),
    };
  } finally {
    mockCtl.allowGraphqlCapture = false;
  }
  const captures = graphqlCaptures.slice(start);
  const matched = captures.find((c) => c.accessTokenSha256 && c.accessTokenSha256 === expectedHash);
  const firstOutbound = matched || captures[0] || null;
  return {
    graphql,
    firstOutbound,
    captureCount: captures.length,
    graphqlMatchesSessionToken: Boolean(
      firstOutbound && expectedHash && firstOutbound.accessTokenSha256 === expectedHash,
    ),
    sessionAccessTokenSha256: expectedHash,
  };
}

export async function runAdminCase(name, { useOnlineTokens, token, request, sessionStorage, mock, graphql = true }) {
  const fetchStart = fetchLog.length;
  const gqlStart = graphqlCaptures.length;
  if (mock) Object.assign(mockCtl, mock);
  const storage = sessionStorage || new MemorySessionStorage();
  const app = makeApp({ useOnlineTokens, sessionStorage: storage });
  const req = request || adminRequest(token);
  const result = await catchAuth(() => app.authenticate.admin(req));
  let outbound = null;
  if (graphql && result.ok && result.raw) {
    outbound = await firstOutboundGraphql(result.raw);
  }
  const exchanges = fetchLog.slice(fetchStart).filter((f) => f.mocked === "token_exchange");
  return {
    name,
    useOnlineTokens,
    entrypoint: "authenticate.admin",
    sessionIdLookup: result.ctx?.session?.id ?? null,
    result: {
      ok: result.ok,
      kind: result.kind,
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      ctx: result.ctx,
    },
    stored: storage.snapshot(),
    exchanges: exchanges.map((e) => ({
      url: e.url,
      requested_token_type: e.requested_token_type,
      grant_type: e.grant_type,
      expiring: e.expiring,
      mocked: e.mocked,
    })),
    exchangeCount: exchanges.length,
    fetchFailClosed: fetchLog.slice(fetchStart).filter((f) => String(f.mocked).includes("fail")),
    firstOutbound: outbound?.firstOutbound ?? null,
    graphql: outbound?.graphql ?? null,
    graphqlCaptures: graphqlCaptures.slice(gqlStart),
    storage,
    raw: result.raw,
  };
}
```
<!-- PROOF-EXTRACT:end path=probes/harness.mjs -->

### EXTRACT `probes/run.sh`

<!-- PROOF-EXTRACT:begin path=probes/run.sh -->
```bash
#!/usr/bin/env bash
# Published AUTH-X orchestrator. Requires STOCKY_PLUS_ROOT + pinned node_modules.
# Does not call live Shopify. Does not start Redis/Postgres. Does not write application source.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_ROOT="$(cd "$ROOT/.." && pwd)"
: "${STOCKY_PLUS_ROOT:?STOCKY_PLUS_ROOT required (path to stocky-plus)}"
STOCKY_NODE_MODULES="${STOCKY_NODE_MODULES:-$STOCKY_PLUS_ROOT/node_modules}"
if [[ ! -d "$STOCKY_NODE_MODULES/@shopify/shopify-app-react-router" ]]; then
  echo "missing @shopify/shopify-app-react-router in $STOCKY_NODE_MODULES" >&2
  exit 1
fi
# Node ESM does not consult NODE_PATH; symlink so import "@shopify/..." resolves.
ln -sfn "$STOCKY_NODE_MODULES" "$OUT_ROOT/node_modules"
export STOCKY_PLUS_ROOT STOCKY_NODE_MODULES
export NODE_PATH="$STOCKY_NODE_MODULES${NODE_PATH:+:$NODE_PATH}"
cd "$ROOT"
echo "NODE=$(node -v)"
echo "PWD=$PWD"
echo "STOCKY_PLUS_ROOT=$STOCKY_PLUS_ROOT"
echo "STOCKY_NODE_MODULES=$STOCKY_NODE_MODULES"
if git -C "$STOCKY_PLUS_ROOT/.." rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "HEAD=$(git -C "$STOCKY_PLUS_ROOT/.." rev-parse HEAD)"
else
  echo "HEAD=git_absent_export"
fi
python3 "$OUT_ROOT/check_pins.py" --kind auth --stocky-plus-root "$STOCKY_PLUS_ROOT" --node-modules "$STOCKY_NODE_MODULES"
node ./run_all.mjs
```
<!-- PROOF-EXTRACT:end path=probes/run.sh -->

### EXTRACT `probes/run_all.mjs`

<!-- PROOF-EXTRACT:begin path=probes/run_all.mjs -->
```javascript
/**
 * AUTH-X matrix — real installed authenticate.admin / authenticate.webhook.
 * Mocked transport only. New probes for X; not a copy of PR48 result JSON.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_KEY,
  API_SECRET,
  APP_URL,
  SHOP,
  SHOP_B,
  UA,
  WIDE,
  WIDE_NEIGHBOR,
  SAFE_SUB,
  fetchLog,
  graphqlCaptures,
  mockCtl,
  MemorySessionStorage,
  loadShopify,
  makeApp,
  catchAuth,
  signJoseJwt,
  signRawJwt,
  jwtClaims,
  adminRequest,
  runAdminCase,
  resetMockDefaults,
  redactToken,
  tokenSha256,
  summarizeSession,
  summarizeUser,
  firstOutboundGraphql,
} from "./harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..");
const RESULTS_PATH = path.join(OUT_DIR, "results.json");

const { rr, shopifyApiMod, PrismaSessionStorage } = await loadShopify();
const Session = rr.Session || shopifyApiMod.Session;

const cases = [];

function record(id, payload) {
  cases.push({ id, ...payload });
}

function passFail(id, title, pass, actual, notes) {
  record(id, {
    title,
    pass: Boolean(pass),
    actual,
    notes: notes || null,
  });
}

function precisionBlock() {
  const samples = ["9007199254740991", "9007199254740992", "9007199254740993", "548380009"];
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
      JSON_parse_raw: parsed,
      JSON_parse_object_id: objParsed.id,
      JSON_parse_object_id_type: typeof objParsed.id,
      String_Number: String(n),
      BigInt_string: asBigInt,
      Number_BigInt: bigIntToNumber,
      Number_isSafeInteger: Number.isSafeInteger(n),
    };
  });
}

record("AUTH-X-00", {
  title: "IEEE-754 precision of Shopify user-id digit strings",
  pass: true,
  actual: precisionBlock(),
  notes: "Diagnostic. Wide IDs are not Number-safe.",
});

resetMockDefaults();

// 1. Default offline embedded (X-like: useOnlineTokens false)
{
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("offline_embedded_safe_sub", {
    useOnlineTokens: false,
    token,
  });
  const subPresent = out.result.ctx?.sessionToken?.sub != null;
  const offline = out.result.ctx?.session?.isOnline === false;
  const sessionId = out.result.ctx?.session?.id;
  const expectedId = `offline_${SHOP}`;
  const gqlShop = out.firstOutbound?.destShop;
  const gqlHash = out.firstOutbound?.accessTokenSha256;
  const sessionHash = out.result.ctx?.session?.accessTokenSha256;
  passFail(
    "AUTH-X-01",
    "Default offline embedded actor extraction (useOnlineTokens: false, X-like)",
    out.result.ok &&
      subPresent &&
      offline &&
      sessionId === expectedId &&
      out.exchangeCount >= 1 &&
      gqlHash &&
      gqlHash === sessionHash &&
      gqlShop === SHOP,
    {
      entrypoint: out.entrypoint,
      sessionIdLookup: sessionId,
      sessionTokenSub: out.result.ctx?.sessionToken?.sub,
      sessionTokenSubType: out.result.ctx?.sessionToken?.subType,
      isOnline: out.result.ctx?.session?.isOnline,
      exchangeCount: out.exchangeCount,
      requested_token_types: out.exchanges.map((e) => e.requested_token_type),
      firstOutbound: out.firstOutbound,
      stored: out.stored,
    },
    "Expect sessionToken.sub present; offline session; GraphQL uses that offline token hash.",
  );
}

// 2. String vs numeric vs wide sub
{
  resetMockDefaults();
  mockCtl.idAsJsonNumber = false;
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("string_sub", { useOnlineTokens: true, token });
  passFail(
    "AUTH-X-02",
    "String sub (jose) + associated_user.id JSON string",
    out.result.ok &&
      String(out.result.ctx?.sessionToken?.sub) === SAFE_SUB &&
      out.result.ctx?.session?.isOnline === true &&
      out.firstOutbound?.destShop === SHOP,
    {
      sessionTokenSub: out.result.ctx?.sessionToken?.sub,
      subType: out.result.ctx?.sessionToken?.subType,
      sessionId: out.result.ctx?.session?.id,
      associated_user: out.result.ctx?.session?.onlineAccessInfo?.associated_user,
      firstOutbound: out.firstOutbound,
      exchanges: out.exchanges,
    },
  );
}

{
  resetMockDefaults();
  const claims = jwtClaims({ sub: SAFE_SUB });
  const token = signRawJwt({ ...claims, sub: Number(SAFE_SUB) }, API_SECRET);
  const out = await runAdminCase("numeric_sub_safe", { useOnlineTokens: true, token });
  const sub = out.result.ctx?.sessionToken?.sub;
  passFail(
    "AUTH-X-03",
    "Numeric JWT sub (JSON number, safe integer 548380009)",
    out.result.ok && String(sub) === SAFE_SUB,
    {
      sessionTokenSub: sub,
      subType: typeof sub,
      sessionId: out.result.ctx?.session?.id,
      associated_user: out.result.ctx?.session?.onlineAccessInfo?.associated_user,
      firstOutbound: out.firstOutbound,
      exchanges: out.exchanges,
    },
  );
}

{
  resetMockDefaults();
  mockCtl.idAsJsonNumber = true;
  const token = await signJoseJwt(jwtClaims({ sub: WIDE }), API_SECRET);
  const out = await runAdminCase("wide_sub_string_id_json_number", { useOnlineTokens: true, token });
  const lookupSub = out.result.ctx?.sessionToken?.sub;
  const storedId = out.result.ctx?.session?.id;
  const assocId = out.result.ctx?.session?.onlineAccessInfo?.associated_user?.id;
  const lookupMatchesStore = storedId === `${SHOP}_${lookupSub}`;
  const assocRecovered = String(assocId) === WIDE;
  passFail(
    "AUTH-X-04",
    "Wide string sub + associated_user.id as JSON number",
    out.result.ok && String(lookupSub) === WIDE,
    {
      sessionTokenSub: lookupSub,
      subType: out.result.ctx?.sessionToken?.subType,
      sessionId: storedId,
      lookupMatchesStore,
      associated_user_id: assocId,
      associated_user_id_type: typeof assocId,
      assocRecovered,
      Number_WIDE: Number(WIDE),
      firstOutbound: out.firstOutbound,
      exchanges: out.exchanges,
      stored: out.stored,
    },
    "Library stores online session at `${shop}_${associated_user.id}`. JSON number wide id is not exact.",
  );
}

{
  resetMockDefaults();
  const claims = jwtClaims({ sub: WIDE });
  const payloadJson = JSON.stringify({ ...claims, sub: 0 }).replace('"sub":0', `"sub":${WIDE}`);
  const token = signRawJwt(payloadJson, API_SECRET);
  const out = await runAdminCase("numeric_wide_sub", { useOnlineTokens: true, token });
  const sub = out.result.ctx?.sessionToken?.sub;
  const recovered = String(sub) === WIDE;
  passFail(
    "AUTH-X-05",
    "Wide JWT sub as JSON number 9007199254740993",
    out.result.ok,
    {
      sessionTokenSub: sub,
      subType: typeof sub,
      recovered,
      Number_WIDE: Number(WIDE),
      sessionId: out.result.ctx?.session?.id,
      associated_user: out.result.ctx?.session?.onlineAccessInfo?.associated_user,
      firstOutbound: out.firstOutbound,
      payloadContainsWideDigits: payloadJson.includes(WIDE),
    },
    "jose/JSON number cannot preserve wide sub digits. recovered===false is a library/JSON defect, not a harness miss.",
  );
}

// 3. Sequential B then A wide-id collision + mixedToken GraphQL
{
  resetMockDefaults();
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
  const tokenA = await signJoseJwt(jwtClaims({ sub: WIDE_NEIGHBOR }), API_SECRET);
  const thenA = await runAdminCase("collision_A_after_B", {
    useOnlineTokens: true,
    token: tokenA,
    sessionStorage: storage,
  });
  const hashB = firstB.firstOutbound?.accessTokenSha256;
  const hashA = thenA.firstOutbound?.accessTokenSha256;
  const mixedToken = Boolean(hashB && hashA && hashB === hashA);
  const mixedSessionId = firstB.result.ctx?.session?.id === thenA.result.ctx?.session?.id;
  passFail(
    "AUTH-X-06",
    "Sequential users known wide-ID collision (B sub=...993 then A sub=...992) first-outbound mixedToken",
    !mixedToken,
    {
      afterB: {
        ok: firstB.result.ok,
        sub: firstB.result.ctx?.sessionToken?.sub,
        sessionId: firstB.result.ctx?.session?.id,
        associated_user: firstB.result.ctx?.session?.onlineAccessInfo?.associated_user,
        exchangeCount: firstB.exchangeCount,
        firstOutbound: firstB.firstOutbound,
      },
      afterA: {
        ok: thenA.result.ok,
        sub: thenA.result.ctx?.sessionToken?.sub,
        sessionId: thenA.result.ctx?.session?.id,
        associated_user: thenA.result.ctx?.session?.onlineAccessInfo?.associated_user,
        exchangeCount: thenA.exchangeCount,
        firstOutbound: thenA.firstOutbound,
      },
      mixedToken,
      mixedSessionId,
      hashB,
      hashA,
      stored: storage.snapshot(),
    },
    "PASS requires GraphQL hashes differ (credentials not mixed). mixedToken true is FAIL for binding design.",
  );
}

// 4. Concurrent collision
{
  resetMockDefaults();
  const storage = new MemorySessionStorage();
  const tokenB = await signJoseJwt(jwtClaims({ sub: WIDE }), API_SECRET);
  const tokenA = await signJoseJwt(jwtClaims({ sub: WIDE_NEIGHBOR }), API_SECRET);
  const app = makeApp({ useOnlineTokens: true, sessionStorage: storage });
  const fetchStart = fetchLog.length;
  const gqlStart = graphqlCaptures.length;
  const pair = await Promise.all([
    (async () => {
      const auth = await catchAuth(() => app.authenticate.admin(adminRequest(tokenB)));
      let outbound = null;
      if (auth.ok && auth.raw) outbound = await firstOutboundGraphql(auth.raw);
      return { label: "B", auth, outbound };
    })(),
    (async () => {
      const auth = await catchAuth(() => app.authenticate.admin(adminRequest(tokenA)));
      let outbound = null;
      if (auth.ok && auth.raw) outbound = await firstOutboundGraphql(auth.raw);
      return { label: "A", auth, outbound };
    })(),
  ]);
  const b = pair.find((p) => p.label === "B");
  const a = pair.find((p) => p.label === "A");
  const sessionHashB = b.auth.ctx?.session?.accessTokenSha256;
  const sessionHashA = a.auth.ctx?.session?.accessTokenSha256;
  const hashB = b.outbound?.firstOutbound?.accessTokenSha256;
  const hashA = a.outbound?.firstOutbound?.accessTokenSha256;
  const graphqlMatchesOwn =
    b.outbound?.graphqlMatchesSessionToken && a.outbound?.graphqlMatchesSessionToken;
  const mixedToken = Boolean(
    (hashB && sessionHashA && hashB === sessionHashA) || (hashA && sessionHashB && hashA === sessionHashB),
  );
  const sessionIdCollision = b.auth.ctx?.session?.id === a.auth.ctx?.session?.id;
  const onlineStored = storage.snapshot().filter((s) => s.isOnline);
  passFail(
    "AUTH-X-07",
    "Concurrent users same wide-ID collision (Promise.all authenticate.admin + GraphQL)",
    b.auth.ok &&
      a.auth.ok &&
      !mixedToken &&
      !sessionIdCollision &&
      onlineStored.length === 2,
    {
      B: {
        ok: b.auth.ok,
        status: b.auth.status,
        sub: b.auth.ctx?.sessionToken?.sub,
        sessionId: b.auth.ctx?.session?.id,
        sessionHash: sessionHashB,
        firstOutbound: b.outbound?.firstOutbound,
        graphqlMatchesSessionToken: b.outbound?.graphqlMatchesSessionToken,
      },
      A: {
        ok: a.auth.ok,
        status: a.auth.status,
        sub: a.auth.ctx?.sessionToken?.sub,
        sessionId: a.auth.ctx?.session?.id,
        sessionHash: sessionHashA,
        firstOutbound: a.outbound?.firstOutbound,
        graphqlMatchesSessionToken: a.outbound?.graphqlMatchesSessionToken,
      },
      mixedToken,
      sessionIdCollision,
      onlineStoredCount: onlineStored.length,
      hashB,
      hashA,
      exchanges: fetchLog.slice(fetchStart).filter((f) => f.mocked === "token_exchange").length,
      graphqlCaptures: graphqlCaptures.slice(gqlStart),
      stored: storage.snapshot(),
    },
    "PASS requires distinct session ids, two stored online sessions, and GraphQL hashes bound to each in-memory session.",
  );
}

// 5. Same user across two shops
{
  resetMockDefaults();
  const storage = new MemorySessionStorage();
  const tokenShop1 = await signJoseJwt(jwtClaims({ shop: SHOP, sub: SAFE_SUB }), API_SECRET);
  const tokenShop2 = await signJoseJwt(jwtClaims({ shop: SHOP_B, sub: SAFE_SUB }), API_SECRET);
  const a1 = await runAdminCase("shop1", {
    useOnlineTokens: true,
    token: tokenShop1,
    request: adminRequest(tokenShop1, { shop: SHOP }),
    sessionStorage: storage,
  });
  const a2 = await runAdminCase("shop2", {
    useOnlineTokens: true,
    token: tokenShop2,
    request: adminRequest(tokenShop2, { shop: SHOP_B }),
    sessionStorage: storage,
  });
  const crossShopToken = a1.firstOutbound?.accessTokenSha256 === a2.firstOutbound?.accessTokenSha256;
  const shopsOk =
    a1.firstOutbound?.destShop === SHOP && a2.firstOutbound?.destShop === SHOP_B;
  const idsDiffer = a1.result.ctx?.session?.id !== a2.result.ctx?.session?.id;
  passFail(
    "AUTH-X-08",
    "Same user (identical sub string) across two shops — credentials must not cross shops",
    a1.result.ok && a2.result.ok && shopsOk && idsDiffer && !crossShopToken,
    {
      shop1: {
        sessionId: a1.result.ctx?.session?.id,
        shop: a1.result.ctx?.session?.shop,
        firstOutbound: a1.firstOutbound,
      },
      shop2: {
        sessionId: a2.result.ctx?.session?.id,
        shop: a2.result.ctx?.session?.shop,
        firstOutbound: a2.firstOutbound,
      },
      crossShopToken,
      stored: storage.snapshot(),
    },
  );
}

// 6. Stale/cross-user cached online session
{
  resetMockDefaults();
  const storage = new MemorySessionStorage();
  const staleToken = "shpat_stale_other_user_111";
  const stale = new Session({
    id: `${SHOP}_${SAFE_SUB}`,
    shop: SHOP,
    state: "",
    isOnline: true,
    accessToken: staleToken,
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
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("stale", {
    useOnlineTokens: true,
    token,
    sessionStorage: storage,
  });
  const usedStale = out.firstOutbound?.accessTokenSha256 === tokenSha256(staleToken);
  const zeroExchanges = out.exchangeCount === 0;
  const bindingOk = !(zeroExchanges && usedStale);
  passFail(
    "AUTH-X-09",
    "Stale/cross-user cached online session (associated_user.id=111 at ${shop}_${sub})",
    out.result.ok && bindingOk,
    {
      ok: out.result.ok,
      exchangeCount: out.exchangeCount,
      usedStale,
      associated_user: out.result.ctx?.session?.onlineAccessInfo?.associated_user,
      sessionId: out.result.ctx?.session?.id,
      firstOutbound: out.firstOutbound,
      staleTokenSha256: tokenSha256(staleToken),
      stored: out.stored,
    },
    "Zero exchanges + GraphQL uses stale token = FAIL for owner binding.",
  );
}

// 7. Invalid / expired JWT; malformed; expired stored online session
{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB, expOffset: -120 }), API_SECRET);
  const out = await runAdminCase("expired_jwt", { useOnlineTokens: true, token, graphql: false });
  passFail(
    "AUTH-X-10",
    "Expired JWT",
    !out.result.ok && out.result.kind === "Response" && out.result.status === 401,
    { result: out.result, exchanges: out.exchanges },
  );
}

{
  resetMockDefaults();
  const out = await runAdminCase("malformed", {
    useOnlineTokens: true,
    token: "not-a-jwt",
    graphql: false,
  });
  passFail(
    "AUTH-X-11",
    "Malformed token",
    !out.result.ok && out.result.kind === "Response" && (out.result.status === 401 || out.result.status === 302),
    { result: out.result, exchanges: out.exchanges },
  );
}

{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), "wrong-secret");
  const out = await runAdminCase("bad_sig", { useOnlineTokens: true, token, graphql: false });
  passFail(
    "AUTH-X-12",
    "Forged JWT signature",
    !out.result.ok && out.result.status === 401,
    { result: out.result, exchanges: out.exchanges },
  );
}

{
  resetMockDefaults();
  const storage = new MemorySessionStorage();
  const expired = new Session({
    id: `${SHOP}_${SAFE_SUB}`,
    shop: SHOP,
    state: "",
    isOnline: true,
    accessToken: "shpat_expired_old",
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
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("expired_session_reexchange", {
    useOnlineTokens: true,
    token,
    sessionStorage: storage,
  });
  const reexchanged = out.exchangeCount > 0;
  const notExpiredHash = out.firstOutbound?.accessTokenSha256 !== tokenSha256("shpat_expired_old");
  passFail(
    "AUTH-X-13",
    "Expired stored online session forces re-exchange",
    out.result.ok && reexchanged && notExpiredHash,
    {
      exchangeCount: out.exchangeCount,
      requested_token_types: out.exchanges.map((e) => e.requested_token_type),
      firstOutbound: out.firstOutbound,
      stored: out.stored,
    },
  );
}

// 8. Issuer / destination / audience mismatch
{
  resetMockDefaults();
  const token = await signJoseJwt(
    jwtClaims({
      shop: SHOP,
      sub: SAFE_SUB,
      extra: { iss: `https://${SHOP_B}/admin` },
    }),
    API_SECRET,
  );
  const out = await runAdminCase("iss_dest", { useOnlineTokens: true, token, graphql: false });
  const officialWouldReject = true;
  const libraryRejected = !out.result.ok;
  passFail(
    "AUTH-X-14",
    "iss vs dest hostname mismatch (official: reject)",
    libraryRejected,
    {
      expected_official: "reject (iss and dest hostnames must match)",
      libraryRejected,
      result: out.result,
      exchanges: out.exchanges,
    },
    "If library accepts, this case FAILs the official claim check (library defect).",
  );
}

{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB, aud: "someone-else" }), API_SECRET);
  const out = await runAdminCase("wrong_aud", { useOnlineTokens: true, token, graphql: false });
  passFail(
    "AUTH-X-15",
    "Wrong audience",
    !out.result.ok && out.result.status === 401,
    { result: out.result },
  );
}

{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ shop: SHOP_B, sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("forged_dest", {
    useOnlineTokens: true,
    token,
    request: adminRequest(token, { shop: SHOP }),
  });
  const destShop = out.result.ctx?.session?.shop;
  const gqlDest = out.firstOutbound?.destShop;
  const boundToPresentedDest = destShop === SHOP_B;
  passFail(
    "AUTH-X-16",
    "dest = other shop with valid HS256 (forged destination)",
    out.result.ok && boundToPresentedDest && gqlDest === SHOP_B,
    {
      ok: out.result.ok,
      sessionShop: destShop,
      sessionId: out.result.ctx?.session?.id,
      firstOutbound: out.firstOutbound,
      requestShopQuery: SHOP,
      notes_official: "iss/dest hostnames matched each other (SHOP_B) so official iss/dest check would pass; dest is still attacker-chosen if secret is known.",
    },
    "Valid signature + dest=SHOP_B binds session to SHOP_B. Query param shop is not authority.",
  );
}

// 9. Owner vs staff vs collaborator; client body ignored
{
  resetMockDefaults();
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
  const out = await runAdminCase("owner", { useOnlineTokens: true, token });
  const u = out.result.ctx?.session?.onlineAccessInfo?.associated_user;
  passFail(
    "AUTH-X-17",
    "Owner correlation (account_owner true, collaborator false, email_verified true)",
    out.result.ok && u?.account_owner === true && u?.collaborator === false && u?.email_verified === true,
    { associated_user: u, firstOutbound: out.firstOutbound, sessionId: out.result.ctx?.session?.id },
  );
}

{
  resetMockDefaults();
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
  const out = await runAdminCase("staff", { useOnlineTokens: true, token });
  const u = out.result.ctx?.session?.onlineAccessInfo?.associated_user;
  passFail(
    "AUTH-X-18",
    "Staff correlation (account_owner false, collaborator false, email_verified false)",
    out.result.ok && u?.account_owner === false && u?.collaborator === false && u?.email_verified === false,
    { associated_user: u, sessionId: out.result.ctx?.session?.id, firstOutbound: out.firstOutbound },
  );
}

{
  resetMockDefaults();
  mockCtl.associatedUser = {
    first_name: "Cora",
    last_name: "Collab",
    email: "collab@example.com",
    email_verified: true,
    account_owner: false,
    locale: "en",
    collaborator: true,
  };
  const token = await signJoseJwt(jwtClaims({ sub: "1002" }), API_SECRET);
  const out = await runAdminCase("collab", { useOnlineTokens: true, token });
  const u = out.result.ctx?.session?.onlineAccessInfo?.associated_user;
  passFail(
    "AUTH-X-19",
    "Collaborator correlation (collaborator true, account_owner false)",
    out.result.ok && u?.collaborator === true && u?.account_owner === false,
    { associated_user: u, sessionId: out.result.ctx?.session?.id, firstOutbound: out.firstOutbound },
  );
}

{
  resetMockDefaults();
  mockCtl.associatedUser = {
    first_name: "Sam",
    last_name: "Staff",
    email: "staff@example.com",
    email_verified: true,
    account_owner: false,
    locale: "en",
    collaborator: false,
  };
  const token = await signJoseJwt(jwtClaims({ sub: "1001" }), API_SECRET);
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
  let outbound = null;
  if (result.ok && result.raw) outbound = await firstOutboundGraphql(result.raw);
  const u = result.ctx?.session?.onlineAccessInfo?.associated_user;
  passFail(
    "AUTH-X-20",
    "Client body account_owner must be ignored",
    result.ok && u?.account_owner === false,
    {
      associated_user: u,
      sessionId: result.ctx?.session?.id,
      firstOutbound: outbound?.firstOutbound,
    },
  );
}

// 10. Denied/unassigned: sub vs associated_user.id mismatch; numeric sub; wide id owner proof
{
  resetMockDefaults();
  mockCtl.associatedUserIdLiteral = "999999";
  mockCtl.associatedUser = {
    first_name: "Mis",
    last_name: "Match",
    email: "mismatch@example.com",
    email_verified: true,
    account_owner: true,
    locale: "en",
    collaborator: false,
  };
  const storage = new MemorySessionStorage();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
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
  const lookupKey = `${SHOP}_${SAFE_SUB}`;
  const storedIds = storage.snapshot().map((s) => s.id);
  const storedAtAssociated = storedIds.includes(`${SHOP}_999999`);
  const ownerProof =
    String(first.result.ctx?.session?.onlineAccessInfo?.associated_user?.id) ===
    String(first.result.ctx?.sessionToken?.sub);
  passFail(
    "AUTH-X-21",
    "sub vs associated_user.id mismatch — owner proof",
    first.result.ok && ownerProof,
    {
      first: {
        ok: first.result.ok,
        sessionId: first.result.ctx?.session?.id,
        sub: first.result.ctx?.sessionToken?.sub,
        associated_user: first.result.ctx?.session?.onlineAccessInfo?.associated_user,
        exchangeCount: first.exchangeCount,
        firstOutbound: first.firstOutbound,
      },
      second: {
        ok: second.result.ok,
        sessionId: second.result.ctx?.session?.id,
        exchangeCount: second.exchangeCount,
        firstOutbound: second.firstOutbound,
      },
      lookupKey,
      storedIds,
      storedAtAssociated,
      reexchangedOnSecond: second.exchangeCount > 0,
      ownerProof,
    },
    "PASS requires associated_user.id string-equals JWT sub. Library keys online sessions on associated_user.id, lookup on JWT sub.",
  );
}

{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("numeric_owner_proof", { useOnlineTokens: true, token });
  const sub = String(out.result.ctx?.sessionToken?.sub);
  const assoc = String(out.result.ctx?.session?.onlineAccessInfo?.associated_user?.id ?? "");
  passFail(
    "AUTH-X-22",
    "Numeric/safe sub owner proof (sub string-equals associated_user.id)",
    out.result.ok && sub === SAFE_SUB && assoc === SAFE_SUB,
    {
      sub: out.result.ctx?.sessionToken?.sub,
      associated_user: out.result.ctx?.session?.onlineAccessInfo?.associated_user,
      sessionId: out.result.ctx?.session?.id,
      firstOutbound: out.firstOutbound,
    },
  );
}

{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: WIDE }), API_SECRET);
  const out = await runAdminCase("wide_owner_proof", { useOnlineTokens: true, token });
  const sub = String(out.result.ctx?.sessionToken?.sub ?? "");
  const assoc = String(out.result.ctx?.session?.onlineAccessInfo?.associated_user?.id ?? "");
  const proof = sub === WIDE && assoc === WIDE;
  passFail(
    "AUTH-X-23",
    "Wide id owner proof unsupported (must not claim exact digit identity after Number/JSON)",
    !proof,
    {
      sub,
      subType: out.result.ctx?.sessionToken?.subType,
      assoc,
      assocType: typeof out.result.ctx?.session?.onlineAccessInfo?.associated_user?.id,
      proof,
      sessionId: out.result.ctx?.session?.id,
      firstOutbound: out.firstOutbound,
      Number_WIDE: Number(WIDE),
    },
    "PASS of this row means we correctly observed that wide-id owner proof does NOT hold.",
  );
}

// 11. Webhooks
async function webhookProbe() {
  resetMockDefaults();
  const storage = new MemorySessionStorage();
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
    "X-Shopify-Webhook-Id": "wh_authx_1",
    "X-Shopify-Event-Id": "evt_authx_1",
    "Content-Type": "application/json",
  };
  let ctx;
  let webhookErr = null;
  try {
    ctx = await app.authenticate.webhook(
      new Request(`${APP_URL}/webhooks/compliance`, { method: "POST", headers, body }),
    );
  } catch (err) {
    webhookErr =
      err instanceof Response ? { status: err.status, statusText: err.statusText } : String(err.message);
  }

  const emptyStorage = new MemorySessionStorage();
  const app2 = makeApp({ useOnlineTokens: true, sessionStorage: emptyStorage });
  let ctx2;
  let ctx2err = null;
  try {
    ctx2 = await app2.authenticate.webhook(
      new Request(`${APP_URL}/webhooks/compliance`, { method: "POST", headers, body }),
    );
  } catch (err) {
    ctx2err = err instanceof Response ? { status: err.status } : String(err.message);
  }

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
    bad =
      err instanceof Response
        ? { ok: false, status: err.status, statusText: err.statusText }
        : { ok: false, message: String(err.message) };
  }

  return {
    seededStored: seeded.stored,
    withOfflineSession: ctx
      ? {
          keys: Object.keys(ctx).sort(),
          shop: ctx.shop,
          topic: ctx.topic,
          webhookId: ctx.webhookId,
          eventId: ctx.eventId,
          session: summarizeSession(ctx.session),
          hasAdmin: Boolean(ctx.admin),
          sessionIsOnline: ctx.session?.isOnline ?? null,
          hasAssociatedUser: Boolean(ctx.session?.onlineAccessInfo?.associated_user),
        }
      : { error: webhookErr },
    withoutSession: ctx2
      ? {
          shop: ctx2.shop,
          session: ctx2.session ?? null,
          keys: Object.keys(ctx2).sort(),
        }
      : { error: ctx2err },
    badHmac: bad,
  };
}

{
  const w = await webhookProbe();
  passFail(
    "AUTH-X-24",
    "authenticate.webhook loads offline session only; HMAC valid",
    Boolean(w.withOfflineSession?.session) &&
      w.withOfflineSession.sessionIsOnline === false &&
      w.withOfflineSession.hasAssociatedUser === false &&
      w.withOfflineSession.shop === SHOP,
    w,
  );
  passFail(
    "AUTH-X-25",
    "authenticate.webhook invalid HMAC rejected",
    w.badHmac && w.badHmac.ok === false && w.badHmac.status === 401,
    { badHmac: w.badHmac },
  );
  passFail(
    "AUTH-X-26",
    "Webhook without stored offline session has no staff identity",
    w.withoutSession.session == null && !w.withoutSession.error,
    { withoutSession: w.withoutSession },
  );
}

// Online flag but no associated_user
{
  resetMockDefaults();
  mockCtl.onlineOmitAssociatedUser = true;
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("online_no_user", { useOnlineTokens: true, token });
  mockCtl.onlineOmitAssociatedUser = false;
  const becameOffline = out.result.ctx?.session?.isOnline === false;
  passFail(
    "AUTH-X-27",
    "useOnlineTokens true but token body has no associated_user",
    out.result.ok,
    {
      ok: out.result.ok,
      isOnline: out.result.ctx?.session?.isOnline,
      sessionId: out.result.ctx?.session?.id,
      becameOffline,
      firstOutbound: out.firstOutbound,
      exchanges: out.exchanges,
    },
    "createSession treats missing associated_user as offline (Boolean(associatedUser)).",
  );
}

// Prisma adapter userId Number roundtrip
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
  const loadedExactId = loadedExact?.onlineAccessInfo?.associated_user?.id;
  return {
    store_row_userId: storedRow.userId,
    store_row_userId_type: typeof storedRow.userId,
    store_row_userId_string: String(storedRow.userId),
    loaded_associated_user_id: loaded?.onlineAccessInfo?.associated_user?.id,
    loaded_type: typeof loaded?.onlineAccessInfo?.associated_user?.id,
    loaded_equals_WIDE: String(loaded?.onlineAccessInfo?.associated_user?.id) === WIDE,
    exact_bigint_row_userId: String(rows.get(exactRowId).userId),
    loaded_exact_id: loadedExactId,
    loaded_exact_type: typeof loadedExactId,
    loaded_exact_equals_original: String(loadedExactId) === WIDE,
    note: "rowToSession String(row.userId) then Session.fromPropertyArray Number(userId)",
  };
}

{
  const actual = await prismaAdapterProbe();
  passFail(
    "AUTH-X-28",
    "Prisma adapter userId Number roundtrip (in-memory fake client)",
    true,
    actual,
    "Diagnostic. loaded_exact_equals_original false documents Number() loss.",
  );
}

// Fail-closed
{
  resetMockDefaults();
  let threw = null;
  try {
    await fetch("https://authx-test-shop.myshopify.com/admin/api/2026-07/graphql.json", {
      method: "POST",
      body: "{}",
    });
  } catch (e) {
    threw = e.message;
  }
  passFail(
    "AUTH-X-29",
    "Fail-closed GraphQL Admin URL when capture disabled",
    typeof threw === "string" && threw.includes("FAIL-CLOSED"),
    { threw },
  );
}

{
  let threw = null;
  try {
    await fetch("https://partners.shopify.com/api/graphql", { method: "POST", body: "{}" });
  } catch (e) {
    threw = e.message;
  }
  passFail(
    "AUTH-X-30",
    "Fail-closed Partners URL",
    typeof threw === "string" && threw.includes("FAIL-CLOSED"),
    { threw },
  );
}

// id_token query param
{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const out = await runAdminCase("id_token_query", {
    useOnlineTokens: false,
    token,
    request: adminRequest(token, { idTokenQuery: true }),
  });
  passFail(
    "AUTH-X-31",
    "id_token query param (no Authorization header) offline authenticate.admin",
    out.result.ok && out.result.ctx?.session?.isOnline === false && out.firstOutbound?.destShop === SHOP,
    {
      ok: out.result.ok,
      status: out.result.status,
      sessionId: out.result.ctx?.session?.id,
      sub: out.result.ctx?.sessionToken?.sub,
      firstOutbound: out.firstOutbound,
      exchanges: out.exchanges,
    },
  );
}

// Bot UA
{
  resetMockDefaults();
  const token = await signJoseJwt(jwtClaims({ sub: SAFE_SUB }), API_SECRET);
  const req = adminRequest(token, { extraHeaders: { "user-agent": "Googlebot/2.1" } });
  const app = makeApp({ useOnlineTokens: false, sessionStorage: new MemorySessionStorage() });
  const out = await catchAuth(() => app.authenticate.admin(req));
  passFail(
    "AUTH-X-32",
    "Bot User-Agent rejected (isbot) — 410 not 500",
    !out.ok && out.status === 410,
    { result: out },
  );
}

function readSnippet(p, startRe, endRe) {
  const text = fs.readFileSync(p, "utf8");
  const start = text.search(startRe);
  if (start < 0) return null;
  const from = text.slice(start);
  const end = from.search(endRe);
  return from.slice(0, end < 0 ? 400 : end).trim();
}

const NM = process.env.STOCKY_NODE_MODULES;
if (!NM) throw new Error("STOCKY_NODE_MODULES required");

record("AUTH-X-33", {
  title: "Installed type snippets (read, not compile)",
  pass: true,
  actual: {
    OnlineAccessUser: readSnippet(
      `${NM}/@shopify/shopify-api/lib/auth/oauth/types.ts`,
      /export interface OnlineAccessUser/,
      /\nexport interface OfflineAccessInfo/,
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

record("AUTH-X-34", {
  title: "Library versions runtime",
  pass: true,
  actual: {
    reactRouterLibrary: rr.SHOPIFY_REACT_ROUTER_LIBRARY_VERSION ?? "imported via package",
    shopifyApiVersion:
      shopifyApiMod.SHOPIFY_API_LIBRARY_VERSION ?? shopifyApiMod.default?.SHOPIFY_API_LIBRARY_VERSION,
    packageJson: {
      reactRouter: JSON.parse(fs.readFileSync(`${NM}/@shopify/shopify-app-react-router/package.json`, "utf8"))
        .version,
      api: JSON.parse(fs.readFileSync(`${NM}/@shopify/shopify-api/package.json`, "utf8")).version,
      sessionStorage: JSON.parse(
        fs.readFileSync(`${NM}/@shopify/shopify-app-session-storage/package.json`, "utf8"),
      ).version,
      prisma: JSON.parse(
        fs.readFileSync(`${NM}/@shopify/shopify-app-session-storage-prisma/package.json`, "utf8"),
      ).version,
    },
    node: process.version,
  },
});

const passCount = cases.filter((c) => c.pass === true).length;
const failCount = cases.filter((c) => c.pass === false).length;
const other = cases.length - passCount - failCount;

const results = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  isolationHead: process.env.EXPECTED_BASE_X || "f057d98c8a321b3e06875a6e9a83b787bcbc101f",
  stockyPlusRoot: process.env.STOCKY_PLUS_ROOT || null,
  liveShopify: "UNVERIFIED",
  shop: SHOP,
  caseCounts: { total: cases.length, pass: passCount, fail: failCount, other },
  fetchLogSanitized: fetchLog.map((f) => ({
    url: f.url,
    method: f.method,
    mocked: f.mocked,
    requested_token_type: f.requested_token_type,
    grant_type: f.grant_type,
    expiring: f.expiring,
    contentType: f.contentType,
    accessTokenSha256: f.accessTokenSha256 || undefined,
  })),
  graphqlCaptures,
  cases,
};

fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    {
      ok: true,
      cases: cases.length,
      pass: passCount,
      fail: failCount,
      other,
      resultsPath: RESULTS_PATH,
      fetchCalls: fetchLog.length,
    },
    null,
    2,
  ),
);
```
<!-- PROOF-EXTRACT:end path=probes/run_all.mjs -->

### EXTRACT `reproduce.sh`

<!-- PROOF-EXTRACT:begin path=reproduce.sh -->
```bash
#!/usr/bin/env bash
# Reproduce AUTH-X from extracted proof inputs + pinned X node_modules.
# Does not call live Shopify.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
: "${STOCKY_PLUS_ROOT:?}"
export STOCKY_NODE_MODULES="${STOCKY_NODE_MODULES:-$STOCKY_PLUS_ROOT/node_modules}"
export EXPECTED_BASE_X="${EXPECTED_BASE_X:-f057d98c8a321b3e06875a6e9a83b787bcbc101f}"
bash "$HERE/probes/run.sh"
node "$HERE/probes/assert_taxonomy.mjs" "$HERE/results.json" "$HERE/expected_taxonomy.json"
```
<!-- PROOF-EXTRACT:end path=reproduce.sh -->
