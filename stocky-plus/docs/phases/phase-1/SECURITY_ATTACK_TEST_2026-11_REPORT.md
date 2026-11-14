# Security attack test — findings report (2026-11-10 to 14)

**Status:** COMPLETE for the scope below. Fixes are in pull requests #81 (merged as `0b66a2b`), #90 (merged as `9b02276`) and #95 (merged as `052ee00`). Round 3 on 2026-11-13 retested the code merged since then; it is recorded in its own section and in the open items. Round 4 on 2026-11-14 tested the mobile and POS code merged as #96 and is recorded in its own section.
**Author:** Claude Code (security lane), on the owner's 2026-11-10 order.
**Kind of record:** attack test and fixes by the same session. This is **not** an independent review: the session that found each issue also wrote its fix, and the fix pull requests were merged on the owner's order without independent review. Treat the "held" results as evidence for the tested cases only.

## Identity and scope

| Item | Value |
|---|---|
| Code tested | Rounds 1 and 2: `main` from `2685081` through `8da50a8`, plus the fix branches. Round 3: `main` at `494b3d0`. Round 4: `main` at `f7548ba` |
| Target | One instance of this app in the author's own cloud container: production build (`react-router-serve`), PostgreSQL 16 provisioned with the CI role and RLS recipe, Redis, a real worker process, a localhost stand-in for the Shopify Admin API, synthetic shops and data |
| Not targeted | Shopify's platform, the Partner Dashboard, any third-party service, any real store, any deployed instance. No load or denial-of-service traffic left the container |
| Store confirmation | The store tester (separate session) re-ran the #79 and #83 cases, the SEC-08 case and a real uninstall for SEC-12 on `stocky-test-store.myshopify.com`; results are recorded on #81, #95 and #90 |
| Fix pull requests | #81 (round 1 and #83), #90 (dependencies, SEC-12), #95 (round 2, dev-server fix, inventory tooling, SEC-13), #118 (round 3 race test, SEC-15) |

One scope note. Before the synthetic shop names were pinned to localhost, two unknown-shop authentication tests caused the library to attempt a token exchange for a made-up `*.myshopify.com` name that does not exist. No store, credential or real token was involved, and the names were pinned to `127.0.0.1` for every later run.

This report lists what was wrong and what was measured before and after. It deliberately leaves out request recipes; the regression tests named in each row show the exact conditions.

## Findings

Severity follows `CLAUDE.md` (P0 to P3).

| ID | Sev | Area | Finding | Merchant impact | Evidence (local instance) | Status | Regression test |
|---|---|---|---|---|---|---|---|
| SEC-01 | P1 | Webhooks | Webhook routes buffered the whole request body before the HMAC check | Anyone on the internet could make the shared server hold gigabytes of memory and take the app down for every shop | 3 concurrent 300 MB posts with a bogus signature: RSS 127 MB to 2870 MB | Fixed in #81: 10 MiB bound before verification, 413 beyond it; same test peaks at 188 MB | `app/lib/http/bounded-request.test.ts`, `app/lib/http/webhook-body-limit.test.ts` |
| SEC-02 | P1 | Warehouse labels | `/app/warehouse/labels` built one label per requested unit with no cap | Any signed-in shop could crash the shared process with one request | One request for 40,000,000 labels: heap exhausted, process exit | Fixed in #81: 5000 labels and 200 variants per request, refused before any database read | `app/lib/warehouse-labels.test.ts`, `app/services/download-routes-security.test.ts` |
| SEC-03 | P2 | Warehouse labels | Barcode and title text went into ZPL unescaped | A crafted barcode or product title could add printer commands to a label job | A barcode containing ZPL control characters produced extra label commands | Fixed in #81: control characters removed from text fields; a barcode that cannot be encoded exactly is not printed as a barcode | `app/lib/warehouse-labels.test.ts` |
| SEC-04 | P2 | Exports | CSV exports wrote formula-leading cells verbatim (#79) | A product title could run as a formula when a merchant opens an export in a spreadsheet | Title starting with `=` exported as a live formula | Fixed in #81: shared encoder `app/lib/csv.server.ts`; confirmed on the test store | `app/lib/csv.test.ts`, `app/services/download-routes-security.test.ts` |
| SEC-05 | P3 | Exports | CSV, ZPL and PDF downloads had no cache or sniffing headers | Cost and valuation data could be kept by shared caches | No `Cache-Control`, no `nosniff` | Fixed in #81: `private, no-store`, `nosniff`, sanitized filename; confirmed on the test store | `app/lib/http/download.test.ts` |
| SEC-06 | P3 | Webhooks | `app/scopes_update` threw on an unexpected payload | HTTP 500 makes Shopify retry the delivery | Payload without `current`: 500 | Fixed in #81: 400, session untouched | `app/services/scopes-update-webhook.test.ts` |
| SEC-07 | P1 | Webhooks, privacy | #83: webhook authentication refreshed the shop's offline token before the route ran. Shopify refuses that after an uninstall | `app/uninstalled` and the three mandatory compliance topics answered 500 and were never processed: uninstalled shops stayed active and privacy requests were lost. App Store blocker | Real library with an expired stored session: all four topics 500 | Fixed in #81: deliveries are verified from the HMAC and headers by an app instance that holds no sessions. Confirmed on the test store with a real uninstall and reinstall | `app/services/webhook-auth-uninstalled-shop.test.ts` |
| SEC-08 | P2 | Rate limiting | The dashboard's "Sync catalog" action created a new durable sync job (up to 125 attempts) on every request | One shop could queue unlimited full catalog syncs and bulk operations | 30 requests: 30 active jobs | Fixed in #95: one job per shop while a sync is queued or running, and at most one request per minute; 30 requests: 1 job. Confirmed on the test store | `app/jobs/catalog-sync-enqueue.test.ts`, `app/tenant/__tests__/queue-redis.test.ts` |
| SEC-09 | P3 | Secrets | `.dockerignore` did not exclude `.env` files, and the Dockerfile copies the whole directory | An image built from a working checkout would contain local secrets | By inspection | Fixed in #95 | None (configuration) |
| SEC-10 | P3 | Webhooks (development) | Found by the store test of #81: the Vite dev server exits when a request body stream is cancelled | One oversized request ends a `shopify app dev` session. Production is not affected | Dev server: 413, then process exit | Fixed in #95: oversized bodies are left unread; dev server survives, production memory bound re-measured | `app/lib/http/bounded-request.test.ts` |
| SEC-11 | P1 to P3 | Dependencies | 23 advisories in production dependencies on `main` (1 critical, 15 high), most in the React Router and Express family | Known request-handling flaws in the web server stack | `npm audit --omit=dev` | Reduced to 9 (0 critical, 4 high) in #90 by taking patched releases within the current majors. Residual below | CI suite on the new lockfile |
| SEC-12 | P1 | Webhooks | Found on 2026-11-11 while reviewing #99. Shopify signs a webhook's body, not its shop or topic headers, and `app/uninstalled` took the shop from the header | Anyone holding one correctly signed delivery for this app could replay its body under another shop's name: that shop was disabled and its sessions deleted. With shop erasure (#99) the same header would choose whose data is deleted | A signed body for one shop, replayed with another active shop in the header: 200, shop disabled, session deleted | Fixed in #90: the route requires the signed body's `myshopify_domain` to match the header shop, 401 otherwise. Confirmed on the test store on 2026-11-11 at main `9b02276` (store tester's record on #90): a real uninstall was accepted and processed. The live body is the whole Shop resource, owner contact fields included; the handler stores only `id`, `domain` and `myshopify_domain` and logs only the topic and shop | `app/lib/http/signed-webhook-shop.test.ts`, `app/services/webhook-auth-uninstalled-shop.test.ts`, `app/sync/__tests__/sync-control-plane.test.ts` |
| SEC-13 | P1 | Forms (regression from #90) | Found by the store test on 2026-11-11 (#107, filed there as P0). The dependency update in #90 moved React Router from 7.18.1 to 7.18.5. Since 7.18.3 its check on form posts compares the full origin, scheme included, with the URL the server sees. Behind a TLS-terminating proxy or the dev tunnel the browser's origin is `https` and the server's view is `http`, and the app listed no allowed hosts | Every form in the embedded app was answered with 400 on `main` from `9b02276`: no supplier, purchase order, stocktake, transfer or sync could be submitted. Webhooks were not affected. No data was exposed or changed | Production build and dev server, form post forwarded as a proxy forwards it: own origin 400 before, accepted after; other sites, look-alike hosts and another port still 400 | Fixed in #95: the app's own public host, taken from `SHOPIFY_APP_URL`, is the only allowed action origin, set at dev start (`react-router.config.ts`) and at server start in production (`server/build.mjs`). The check stays on and the patched version is kept. The attack test missed it because its form posts carried no `Origin` header | `app/lib/http/action-origins.test.ts` |
| SEC-15 | P3 | Inventory lookup (from #96) | Found in round 4. The admin Inventory page cleaned control characters out of a scanned code before the exact barcode and SKU match, but passed the raw text to the product-name search that runs when nothing matches. PostgreSQL refuses a NUL byte in text | A lookup whose text contains a NUL byte answered with an error page instead of "not found". No data was exposed or changed, and the POS endpoints were not affected | Production build of `main` at `f7548ba`: the lookup answered 500 and the server logged PostgreSQL error 22021; the same text on `/api/pos/scan` answered normally | Fixed in #118: the name search removes control characters first, with the same rule the scan path uses (`stripControlCharacters` in `app/lib/scanning/barcode.ts`). The new test failed before the change with error 22021 and passes after | `app/tenant/__tests__/admin-inventory-lookup.test.ts` ("searches text that carries control characters instead of failing") |

## What held up (no change needed)

Each line is a set of attempts that failed as it should.

- **Session tokens.** A wrong secret, `alg: none`, an expired token and a wrong audience all get 401. A request without a token never reaches a loader or action that writes.
- **Tenant isolation.** 21 requests from one shop against another shop's supplier, purchase order, line, transfer, stocktake, bundle, SKU mapping and price tier IDs. The other shop's rows were byte-identical afterwards, none of its data appeared in a response, and a client-supplied shop identifier was refused. The restricted database role sees zero merchant rows without a tenant context.
- **Webhook signature.** Missing signature 400, wrong signature 401, a body changed after signing 401, nothing stored. Stored order payloads contain no customer fields. This line first read "webhook authenticity: held", which was too strong: the signature held, but the shop header it does not cover was trusted (SEC-12), and the webhook ID used to store a delivery once is an unsigned header as well, so a replay under a new ID is processed again (OPEN-12).
- **Job queue forgery.** With write access to Redis but no envelope secret: a job with no envelope, a legacy envelope, an envelope for an unknown job and an envelope for a real job with a forged signature were all rejected by the worker.
- **Job replay and tampering.** With read and write access to Redis: a genuine signed job replayed under a new queue ID, the same envelope with a changed payload, and a genuine signature moved to another shop were all rejected. The worker applies the payload stored in the database, not the one in Redis.
- **Billing bypass.** The development subscription switch is refused on a production build and the subscription flag does not change.
- **Secrets in logs.** None of the log statements in `app/` writes a token, session, payload or environment value. No secret is committed to the repository.
- **Outbound requests.** The only two `fetch` calls download the bulk-operation result URL returned by the shop's own authenticated Admin API. No merchant-supplied URL is fetched.
- **CSRF.** State-changing requests need the session token in the `Authorization` header, which a cross-site form cannot set. React Router's origin check on form posts is a second layer; it must list the app's own public host to work behind a proxy (SEC-13).
- **POS API (#85, read at its branch head).** Token signature and expiry are checked by the Shopify library, the pull request adds the audience check the library skips, the shop comes only from the signed token, and uninstalled shops are refused. No finding.

## Round 3 (2026-11-13)

Round 3 covers what merged after round 2: the inventory write ledger with the stocktake and transfer actions (#91) and the replenishment engine with the Buying Table (#89), on `main` at `494b3d0`. The target was the same local instance. Its inventory-write switches stayed OFF; the cases that need them ON ran only in the test suite, against the in-memory stand-in for Shopify's inventory API that #91 added.

Held:

- **Stocktakes and transfers across shops.** 10 requests from one shop naming another shop's stocktake, count line, transfer, location or variant were each refused with a "not found" or "not in this shop" message. The other shop's rows were unchanged and no ledger operation was recorded for either shop.
- **Quantities and names.** Negative, fractional, exponent, hexadecimal, empty, non-numeric and over-limit quantities were refused on counts and transfer lines, and nothing was stored. An over-long name, an inactive location, a transfer to its own source and a receive before shipping were refused.
- **Switches OFF.** Five simultaneous completions of one count and five simultaneous ships of one transfer sent nothing, recorded no ledger operation and left both documents open.
- **Repeat and concurrent requests with the switches ON (tests only).** The lane's suite covers a repeated completion, ship, receive and cancel. This round adds a stress case with random delays in the stand-in: completions racing count changes on one stocktake, and ships, receives and cancels racing on one transfer. No request left a quantity that the document's own history cannot explain, and the final quantities equal the starting quantities plus the ledger's applied lines. The test was checked against a deliberate fault: with the ledger's per-document operation key made random, it fails in 9 of 12 rounds.
- **Buying Table across shops.** Another shop's supplier and SKU mapping were refused and no order line was created from them. The development subscription switch is still refused on a production build.

Found, all recorded under existing open items:

- OPEN-1 is fixed by #91 and is closed below.
- The Buying Table's order action checks no plan, and its quantities have no bounds (OPEN-4 and OPEN-2).

Pull requests read before merge, at the head named. These are security passes requested by the owning lane, not approvals, and each was re-run on a local build of that branch:

| Pull request | Head | Result |
|---|---|---|
| #111, App Store readiness batch | `dac922f` | No blocker. Raised: whether the Admin API or the Partner API is the right source for App Pricing status (unverified against Shopify, P1 if confirmed), a stored subscription flag still gating the Buying Table, and three container image notes. The image stages were emulated without Docker: build, release step, and web and worker start with runtime credentials only. A real `docker build` was not possible in this environment. Record: https://github.com/Vedang1998/Stocky/pull/111#issuecomment-6813625589. The lane has since reworked these; its ready head gets a second pass recorded on the pull request |
| #88, reports and CSV exports | `836ffdb` | No blocker. Exports use the shared CSV encoder (SEC-04), ranges and paging are bounded, and another shop's data did not appear under any report. One P3: an unexpected `range` value answered 500. The lane fixed it at `e11d51b`. Record: https://github.com/Vedang1998/Stocky/pull/88#issuecomment-6865374014 |

## Round 4 (2026-11-14)

Round 4 covers the mobile and POS work merged as #96, on `main` at `f7548ba`: the two POS endpoints (`/api/pos/scan` and `/api/pos/stock`) with their token check and rate limit, the admin Inventory lookup, and the sync status and setup guide on the home page. The target was the same local instance, with catalog facts seeded for both synthetic shops, including one barcode that both shops use.

Held:

- **POS tokens.** 13 requests were refused with 401 or 403 and no data: no token, a malformed token, a token signed with another secret, an unsigned token, an expired token, a token issued for another app, a token naming an unknown shop, five tokens whose destination was not a plain shop address, and a token passed in the URL.
- **POS across shops.** Each shop saw only its own product for the shared barcode. Another shop's barcode, SKU and variant ID answered "unknown" or "not found", and a shop parameter or shop header naming another shop was refused.
- **POS input.** Over-long codes, wildcard characters, SQL text, a NUL byte, and malformed variant and location IDs were refused or treated as plain text. Nothing failed.
- **POS rate limit.** One staff member was stopped after 240 requests in a minute while other staff and the other shop were not affected. Tokens without a usable staff ID shared one allowance. The shop as a whole was stopped at 2,400. With Redis stopped, the endpoints kept answering, about a quarter of a second slower, and logged the outage once: the limiter allows requests when its store is down. That is the lane's recorded choice, because the endpoints are authenticated.
- **A disabled shop on POS.** A valid token for an uninstalled shop was refused.
- **Admin Inventory lookup across shops.** Lookups from one shop for another shop's barcode, SKU, product name and variant ID, and lookups with wildcard and SQL text, showed no row of the other shop.
- **Home page.** Sync status and the setup guide carried no data of the other shop, no job identifier and no internal failure text.

Found:

- SEC-15 (P3): a NUL byte in the Inventory lookup text answered with an error page. Fixed in #118, see the findings table.
- Outside #96: the install hook queued a full catalog sync on every token exchange, about hourly for a shop in use. That is SEC-14, recorded with its fix in #120.
- Outside #96: the first page load after a reinstall answered with an error on the local instance, 5 of 6 times on `main` at `ba2f33d`. Filed as #123 for the owning lane; a fix is proposed in #111 and passed the same local steps 8 of 8 times. A real uninstall and reinstall on the test store is still needed.

Pull requests read before merge during this round. As in round 3, these are security passes requested by the owning lane, not approvals:

| Pull request | Head | Result |
|---|---|---|
| #111, App Store readiness batch | `1a38de5`, then commits `e685b8a`, `b2053a2` and `3a60008` | No blocker at any of the four. Session tokens are now encrypted at rest (OPEN-8) and held under key copy, rotation, an unknown key and tampering; the Partner API source for plan status fails closed. Open after the last look: a stored plan snapshot is refreshed only on the billing page (P2), and the Partner settings are not yet required at start-up (waits on the test-store check, R-195). Records: comments 6868501175, 6868725287, 6869025644 and 6869069515 on #111 |
| #117, order-history import after install | `09895cb` | No blocker. Two findings on the earlier head `59cb337` were fixed before this pass: the hook re-imported the whole order history every six hours (P2), and a reinstall soon after an import skipped the import (P3). Record: https://github.com/Vedang1998/Stocky/pull/117#issuecomment-6872344935 |
| #88, reports and CSV exports | `5d32805` (changes since `836ffdb` only) | No security change. Record: https://github.com/Vedang1998/Stocky/pull/88#issuecomment-6868807817 |

## Open items

| ID | Sev | Item | Owner | Risk register |
|---|---|---|---|---|
| OPEN-1 | P1 (latent) | **Closed in round 3.** Stocktake completion and transfer shipping were not idempotent and had no status guard. #91 (merged as `d5a65ef`) routes both through the inventory write ledger and locks the document while it records each operation; repeat and concurrent requests apply each movement once (`scripts/tenant-enforcement/tests/stocktake-transfer-ledger.test.ts`, `stocktake-transfer-ledger-race.test.ts`). Inventory-write flags are still OFF | Transfers and stocktakes lane | R-186 |
| OPEN-2 | P2 | Purchase-order quantity and cost inputs are not validated server-side and status changes can skip states. Round 3: the Buying Table's order action (#89) has the same gap. A quantity beyond the 32-bit range, or a look-back change that names no variant, answers 500; nothing is written in either case | Purchase orders lane | R-187 |
| OPEN-3 | P1 | Privacy webhooks are authenticated and acknowledged but do nothing yet. SEC-07 only makes them reachable. #99 implements them; its security review found one P1 (the shop to erase is read from the unsigned header) that must be fixed before it merges. Round 3: #111 carries that work with the shop taken from the signed body; not merged at `494b3d0` | App Store readiness lane | R-005 (existing) |
| OPEN-4 | P2 | Entitlements are a single boolean checked on one route. Round 3: that check is in the Buying Table's page only. Its order action creates a purchase order for a shop with no plan. #111 adds a plan catalog and a server-side check on the actions; not merged at `494b3d0` | App Store readiness lane (#92, #111) | R-008 (existing) |
| OPEN-5 | P2 | Residual dependency advisories after #90 need major upgrades (Prisma 7, Vitest 5) or have no patched release (`minimatch` through `@react-router/fs-routes`, `lodash` and `@graphql-tools/utils` in code generation, `deepmerge` through Polaris) | Security lane, after the feature lanes land | R-188 |
| OPEN-6 | P2 | The Dockerfile cannot build as written (Node 20 image against the `npm 11.5.2` engine pin, build tools omitted with `--omit=dev`), runs as root and runs migrations at container start, which needs migration credentials in the runtime container | App Store readiness lane (reworked in #111, not merged at `494b3d0`) | R-189 |
| OPEN-7 | P3 | No application-level rate limiting. After SEC-01, SEC-02 and SEC-08 every unauthenticated path is cheap and bounded, so this is left to the hosting edge | Deploy owner | R-190 |
| OPEN-8 | P3 | The `Session` table stores Shopify access and refresh tokens in plaintext and the runtime role can read it. This is the Shopify library's default storage. #111 adds encryption at rest; not merged at `494b3d0` | Security lane, App Store readiness lane | R-191 |
| OPEN-9 | P3 | Public pages (`/`, `/auth/login`) send no `frame-ancestors` policy. They are static and have no forms since #76; revisit if that changes | App Store readiness lane | R-192 |
| OPEN-10 | P3 | A webhook for a shop with no `Shop` row, or a signed delivery with malformed JSON, answers 500. Only Shopify can produce either; the 500 makes Shopify retry, which is the safer side | Accepted | None |
| OPEN-11 | P3 | Labels for an unknown variant ID return an empty file with 200, and the ZPL lacks `^CI28`, so non-ASCII characters in titles will not print correctly on Zebra printers (from the store test) | Transfers and stocktakes lane | None (functional) |
| OPEN-12 | P3 | A signed webhook body can be replayed under a new webhook ID, and for topics whose body does not name the shop, under another shop's name. `app/scopes_update` can have its stored scope string overwritten this way. Product, inventory and order topics store IDs and timestamps only and re-fetch from Shopify in that shop's own context, so a replay costs a re-fetch and writes nothing foreign | Security lane | R-193 |

## Not covered

- Anything that needs a real store or Shopify itself: OAuth install and token exchange end to end, real webhook delivery timing, App Bridge behaviour in the admin, POS devices. The POS extension itself (`extensions/propo-pos`) was read but not run: round 4 tested the endpoints it calls, not the extension on a device. The store tester covers the first three on the test store.
- The inventory-write paths with their flags ON against Shopify. They are OFF everywhere and were not turned on. Round 3 exercised them only in tests, against a stand-in.
- Features merged after `f7548ba`. Each later feature pull request needs its own pass over tenant scoping, input bounds and download or export handling.
- Infrastructure: TLS, network exposure of PostgreSQL and Redis, backups, and the hosting platform's own limits. Nothing is deployed yet.

## Category verdicts

- Tenant isolation: held under every attempt made.
- Authentication and session tokens: held.
- Webhook reliability and privacy topics: three P1 defects (SEC-01, SEC-07, SEC-12), fixed.
- Cross-site form posts: refused by React Router's origin check. The dependency update that tightened the check also broke the app's own forms behind a proxy (SEC-13), fixed.
- Export and file handling: four defects (SEC-02 to SEC-05), fixed.
- Queue and worker integrity: held; one abuse path (SEC-08), fixed.
- Inventory-write safety: the repeat and concurrent request defect is fixed (OPEN-1) and held in tests against a stand-in. Flags remain OFF; nothing here was proven against Shopify.
- Billing and entitlements: the development switch held; plans are not enforced on actions yet (OPEN-4).
- Dependencies: improved, not clean (OPEN-5).

## Decision this record supports

- Safe to keep building on: yes.
- Ready for App Store submission on security grounds: no, until OPEN-3, OPEN-4 and OPEN-6 are closed and an independent review of #81, #90 and #95 is recorded.
- Production inventory writes approved: no.
