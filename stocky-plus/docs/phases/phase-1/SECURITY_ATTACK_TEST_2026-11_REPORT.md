# Security attack test — findings report (2026-11-10 / 11)

**Status:** COMPLETE for the scope below. Fixes are in pull requests #81 (merged as `0b66a2b`), #90 (merged as `9b02276`) and #95.
**Author:** Claude Code (security lane), on the owner's 2026-11-10 order.
**Kind of record:** attack test and fixes by the same session. This is **not** an independent review: the session that found each issue also wrote its fix, and the fix pull requests were merged on the owner's order without independent review. Treat the "held" results as evidence for the tested cases only.

## Identity and scope

| Item | Value |
|---|---|
| Code tested | `main` from `2685081` through `8da50a8`, plus the fix branches |
| Target | One instance of this app in the author's own cloud container: production build (`react-router-serve`), PostgreSQL 16 provisioned with the CI role and RLS recipe, Redis, a real worker process, a localhost stand-in for the Shopify Admin API, synthetic shops and data |
| Not targeted | Shopify's platform, the Partner Dashboard, any third-party service, any real store, any deployed instance. No load or denial-of-service traffic left the container |
| Store confirmation | The store tester (separate session) re-ran the #79 and #83 cases, the SEC-08 case and a real uninstall for SEC-12 on `stocky-test-store.myshopify.com`; results are recorded on #81, #95 and #90 |
| Fix pull requests | #81 (round 1 and #83), #90 (dependencies, SEC-12), #95 (round 2, dev-server fix, inventory tooling, SEC-13) |

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
| SEC-14 | P2 | Rate limiting | Found on 2026-11-14 during the security pass on #117. The `afterAuth` hook queued a full catalog sync with up to 125 attempts on every token exchange, not only at install. Since #72 switched on expiring offline tokens that is about once an hour for a shop in use. Same weakness as SEC-08, in the producer #95 did not cover | Bulk exports and worker time on the shared worker grow with every active shop and hour of use. No data exposure | 4 page loads with an expired session: 4 new jobs; 33 queued for one shop over a test session | Fixed in #120: one sync per shop while one is queued or running or succeeded in the last six hours; a reinstall still resyncs. Same test: 1 job | `app/jobs/after-auth-catalog-sync-enqueue.test.ts` |

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

## Open items

| ID | Sev | Item | Owner | Risk register |
|---|---|---|---|---|
| OPEN-1 | P1 (latent) | Stocktake completion and transfer shipping are not idempotent and have no status guard. Inventory-write flags are OFF, so nothing reaches Shopify today | Transfers and stocktakes lane | R-186 |
| OPEN-2 | P2 | Purchase-order quantity and cost inputs are not validated server-side and status changes can skip states | Purchase orders lane | R-187 |
| OPEN-3 | P1 | Privacy webhooks are authenticated and acknowledged but do nothing yet. SEC-07 only makes them reachable. #99 implements them; its security review found one P1 (the shop to erase is read from the unsigned header) that must be fixed before it merges | App Store readiness lane | R-005 (existing) |
| OPEN-4 | P2 | Entitlements are a single boolean checked on one route | App Store readiness lane (#92) | R-008 (existing) |
| OPEN-5 | P2 | Residual dependency advisories after #90 need major upgrades (Prisma 7, Vitest 5) or have no patched release (`minimatch` through `@react-router/fs-routes`, `lodash` and `@graphql-tools/utils` in code generation, `deepmerge` through Polaris) | Security lane, after the feature lanes land | R-188 |
| OPEN-6 | P2 | The Dockerfile cannot build as written (Node 20 image against the `npm 11.5.2` engine pin, build tools omitted with `--omit=dev`), runs as root and runs migrations at container start, which needs migration credentials in the runtime container | App Store readiness lane | R-189 |
| OPEN-7 | P3 | No application-level rate limiting. After SEC-01, SEC-02 and SEC-08 every unauthenticated path is cheap and bounded, so this is left to the hosting edge | Deploy owner | R-190 |
| OPEN-8 | P3 | The `Session` table stores Shopify access and refresh tokens in plaintext and the runtime role can read it. This is the Shopify library's default storage | Security lane | R-191 |
| OPEN-9 | P3 | Public pages (`/`, `/auth/login`) send no `frame-ancestors` policy. They are static and have no forms since #76; revisit if that changes | App Store readiness lane | R-192 |
| OPEN-10 | P3 | A webhook for a shop with no `Shop` row, or a signed delivery with malformed JSON, answers 500. Only Shopify can produce either; the 500 makes Shopify retry, which is the safer side | Accepted | None |
| OPEN-11 | P3 | Labels for an unknown variant ID return an empty file with 200, and the ZPL lacks `^CI28`, so non-ASCII characters in titles will not print correctly on Zebra printers (from the store test) | Transfers and stocktakes lane | None (functional) |
| OPEN-12 | P3 | A signed webhook body can be replayed under a new webhook ID, and for topics whose body does not name the shop, under another shop's name. `app/scopes_update` can have its stored scope string overwritten this way. Product, inventory and order topics store IDs and timestamps only and re-fetch from Shopify in that shop's own context, so a replay costs a re-fetch and writes nothing foreign | Security lane | R-193 |

## Not covered

- Anything that needs a real store or Shopify itself: OAuth install and token exchange end to end, real webhook delivery timing, App Bridge behaviour in the admin, POS devices. The store tester covers the first three on the test store.
- The inventory-write paths with their flags ON. They are OFF everywhere and were not turned on.
- Features merged after `8da50a8`. Each later feature pull request needs its own pass over tenant scoping, input bounds and download or export handling.
- Infrastructure: TLS, network exposure of PostgreSQL and Redis, backups, and the hosting platform's own limits. Nothing is deployed yet.

## Category verdicts

- Tenant isolation: held under every attempt made.
- Authentication and session tokens: held.
- Webhook reliability and privacy topics: three P1 defects (SEC-01, SEC-07, SEC-12), fixed.
- Cross-site form posts: refused by React Router's origin check. The dependency update that tightened the check also broke the app's own forms behind a proxy (SEC-13), fixed.
- Export and file handling: four defects (SEC-02 to SEC-05), fixed.
- Queue and worker integrity: held; one abuse path (SEC-08), fixed.
- Inventory-write safety: not ready (OPEN-1); flags remain OFF.
- Billing and entitlements: bypass held; the entitlement model is still incomplete (OPEN-4).
- Dependencies: improved, not clean (OPEN-5).

## Decision this record supports

- Safe to keep building on: yes.
- Ready for App Store submission on security grounds: no, until OPEN-3 and OPEN-6 are closed and an independent review of #81, #90 and #95 is recorded.
- Production inventory writes approved: no.
