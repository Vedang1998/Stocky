# App Store readiness

What stands between the current code and a ProPo listing Shopify would accept. One list, three states: done, in progress, blocked on the owner. Kept by the App Store readiness lane; update it in the same pull request that changes an item.

Last updated: 2026-11-25.

## Done

| Item | Where |
|---|---|
| `app/uninstalled` disables the shop, removes its sessions and stops its jobs; works after the offline token has expired | #76, #81 |
| Uninstall acts only on the shop named in the signed webhook body | #90 |
| Catalog webhook topics declared in `shopify.app.toml` so products, inventory and locations stay current after install | #87 |
| Mandatory compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) are recorded and carried out; an uninstalled shop's data is erased on `shop/redact` or after the retention window | #99, `DATA_DELETION.md` |
| Billing through Shopify App Pricing with one plan catalog and server-side entitlements | #92 |
| Subscription status read from the Partner API, which Shopify documents as the record for App Pricing; the Admin API is the fallback when the Partner API settings are absent | #111 (security pass BIL-01) |
| Shopify access and refresh tokens encrypted at rest in the `Session` table | #111 (R-191) |
| Products created after install get their inventory facts; a dead-lettered webhook job is no longer delivered again | #103 (issue #94) |
| A webhook or background job delivered a moment before the dispatcher recorded it runs once instead of being lost; a job whose queue delivery is gone is retried or dead-lettered within about six minutes | #111 (issue #122) |
| The first page load after a reinstall renders: requests wait up to five seconds for the afterAuth hook to re-enable the shop, instead of answering 500 | #111 (issue #123) |
| Merchant screens carry no developer or planning wording (issue #80). A unit test refuses developer commands, environment variable names and internal phrases in the `app.*` route screens, shared components, services and the lib and billing modules that hold merchant wording; it does not read the POS extension, `.ts` routes or text split across joined strings | #125 |
| Container image builds on the pinned Node and npm, runs as a non-root user, does not run migrations at start and does not carry the migration files | `Dockerfile`, R-189 |
| Drafts for the listing, privacy policy, reviewer instructions and the protected customer data form | `LISTING_DRAFT.md`, `PRIVACY_POLICY_DRAFT.md`, `REVIEWER_TEST_INSTRUCTIONS.md`, `PROTECTED_CUSTOMER_DATA_ANSWERS.md` |
| `read_all_orders` approved by Shopify for the public app | Checked in the Partner Dashboard on 2026-11-10 |

## In progress

| Item | State |
|---|---|
| First install can hang on "Handling response" and skip the first sync (issue #73) | Fix in #141 (replaces #82), waiting on its second-reader review; merges after #134. |
| A reinstall whose setup step is slow shows an empty store or an error (TEN-02); Home and Bundles do not show the plan notice (SEC-18) | Fix in #134, waiting on its second-reader review. |
| Plan-gated features cannot be tested on a development store, because no App Pricing plans exist yet | Development-only plan override in #133, waiting on the re-read of its review fixes. |
| An uninstalled shop's data could be kept up to 365 days, while Shopify's API Terms (section 6.2.3) require deletion within 30 days of uninstall | Fix in #154: the window is 28 days at most and the erasure is due 30 days after uninstall. Waiting on its second-reader review. |
| Plan limits are not enforced on feature routes | Changes are refused without an active plan on every write route (SEC-18), but the routes read the plan stored on `ShopSettings`, which only Billing and Replenishment refresh, so a cancellation is noticed only when one of them is opened (security pass BIL-02). Of the limits the Billing page shows, only purchase orders per billing month is enforced, and only when orders are created from a replenishment worksheet: not from New purchase order, not on annual plans, and not while Shopify reports no billing period (for example during a trial). Locations, active variants, users and reporting history are shown but not enforced. Wiring waits for the plan decision below. |
| Database and Redis connections not required to use TLS (R-191) | Depends on the host; set `sslmode=require` in the database URLs and a `rediss://` Redis URL once it is chosen. |
| Subscription status has not been observed against a real subscription, from either source | Needs the plans below and a dev-store test with the $0 private test plan. |
| In-app links to the privacy policy and terms | Not started; needs the published URLs. |
| Embedded-app checks on the dev store: load time, navigation, App Bridge behaviour, error pages | Not started. Needs the feature pull requests merged and the dev-store thread's time. |

## Blocked on the owner

Decisions:

| Decision | Why it blocks |
|---|---|
| Scopes. `write_products` is requested and unused. `write_inventory_transfers` is not requested and transfer shipping needs it. `read_all_orders` is granted and no code reads beyond 60 days yet. | Reviewers reject scopes the app does not use. A scope change makes installed shops re-approve. |
| Which inventory write switches are on in the build sent for review | All are off. With them off a reviewer cannot receive a purchase order, complete a stocktake or ship a transfer into Shopify inventory. |
| Plans and prices: what each plan includes, and which limits are enforced | Several Growth and Pro extras in the pricing document are not built. The Billing page shows location, variant, user and reporting-history limits that nothing enforces (see In progress). Either enforce them or stop showing them; the listing has to match what the app does. |
| What a shop with no plan may see after install | Nothing sends an unsubscribed merchant to plan selection yet (App Store requirement 1.2.2). The redirect is small once the rule is known. |
| Whether order rows named in `customers/redact` are deleted | `DATA_DELETION.md`. Must match the privacy policy. The retention window itself is no longer a choice above 28 days (#154). |
| How long backups are kept | Shopify's API Terms (section 6.2.3) cover all copies of merchant data, so backups should expire within 30 days of an uninstall unless the law requires otherwise. Depends on the host; the privacy policy draft leaves it `OWNER TO FILL`. |
| Listing copy, screenshots, icon, support contact | `LISTING_DRAFT.md` is a draft. |

Steps only the owner can take:

| Step | Notes |
|---|---|
| Create the App Pricing plans in the Partner Dashboard, including a $0 plan or review-store exemption for Shopify's reviewers | None exist. Until they do, the billing page has nothing to offer. |
| Set `SHOPIFY_APP_HANDLE` in every environment | The billing page builds the plan-selection link from it. |
| Create a Partner API client and set `SHOPIFY_PARTNER_ORG_ID`, `SHOPIFY_PARTNER_API_ACCESS_TOKEN` and `SHOPIFY_APP_GID` on the web service | Dev Dashboard, Organization settings, Users, Security, Partner API clients. Give it the Manage apps permission and nothing else: the token reads every shop's subscription in the Partner organization. `SHOPIFY_PARTNER_ORG_ID` is the Partner ID from the Partner Dashboard URL, not the organization ID in the Dev Dashboard URL. Without these the app reads the Admin API, which probably lists no App Pricing subscription, so every paying shop would be locked out (R-195). |
| Answer the nine protected customer data questions | `PROTECTED_CUSTOMER_DATA_ANSWERS.md` has an answer for each with the code behind it. Answers 1, 3, 5, 6 and 7 change if a feature starts storing customer fields. |
| Publish the privacy policy and terms; have counsel read them | `PRIVACY_POLICY_DRAFT.md` is an outline, not legal text. |
| Choose the production host and give it a domain | The released app version still points at `example.com`, so install can only be tested through `shopify app dev`. |
| Deploy the app configuration (`shopify app deploy`) | Not done by any lane. The compliance and catalog webhook subscriptions take effect only then. |
| Submit the listing | After everything above. |

## Deployment requirements

For whoever sets up the production host. Nothing here has been deployed.

- Three processes from one image: web (`npm start`), worker (`npm run worker`), and a release step run once per deploy with migration credentials. The runtime containers get the runtime database credentials only.
- Release step, in order: `npx prisma migrate deploy`, then the commands `.github/workflows/ci.yml` runs after it, in the same order (`tenant:indexes:apply`, `tenant:roles:provision`, `tenant:enforcement:apply`, `sync:roles:provision`, each with `-- --apply`). The `release` target of the `Dockerfile` has the tooling for these.
- `tenant:enforcement:apply` takes away all runtime database access for a second or more on every run, even when it has nothing to install (OPEN-16, P3). Run it only in the release step while web and worker are drained or stopped, never against a database that is serving traffic.
- Role provisioning has to run as a PostgreSQL superuser (see `DATA_DELETION.md`). Confirm this on the chosen host before launch.
- `SHOPIFY_APP_URL` must be set at runtime, and the start command must stay `npm start`: the server takes the only allowed form origin from it (issue #107).
- The worker stops at start-up without `DATABASE_CONTROL_PLANE_URL` (a connection as the `stocky_control_plane` role) and `STOCKY_DISPATCHER_PROCESS_COUNT` (the number of worker processes, 1 for one). Web and worker also need `DATABASE_URL` for the runtime role, `REDIS_URL` and `TENANT_JOB_ENVELOPE_SECRET`.
- `SESSION_TOKEN_ENCRYPTION_KEY` must be set on web, worker and the release step; in production the app does not start without it. Generate it with `openssl rand -base64 32`. On the first deploy that sets it, and after adding a new key in front of the old one, run `npm run session-tokens:reencrypt` once from the release step; remove the old key only after a run reports nothing rewritten and nothing unreadable (it exits 1 while any row is unreadable and lists those session ids).
- The three Partner API settings above are needed in production for billing to work.
- `PRIVACY_UNINSTALLED_RETENTION_DAYS` and the other variables are listed in `.env.example`.
- Pin the base image by digest in the `Dockerfile` when the host is chosen.
- Rate limiting is left to the hosting edge (R-190).
