# Dev-store E2E in the cloud

Project rules section 14, rule 3: store tests run without the owner's Mac.

## What runs

`.github/workflows/store-e2e.yml` (manual dispatch, nightly on `main`, and
pushes to `store-e2e/<name>` branches):

1. Starts PostgreSQL and Redis in the runner and prepares the database with
   the CI sequence (`scripts/store-e2e/prepare-db.sh`).
2. Builds the app and starts it and the job worker on `localhost:3000`
   (`scripts/store-e2e/run.sh`).
3. Runs the Playwright specs in `e2e/specs` in headless Chromium.

The app talks to the real dev test store, `stocky-test-store.myshopify.com`,
through Shopify's token exchange, exactly as it does inside the admin.

## How the browser signs in without the admin

Inside the Shopify admin, App Bridge adds a session token to every request.
Here, `e2e/support/fixtures.ts` does the same: each request from the browser
to the app gets a token minted in the Playwright process
(`e2e/support/session-token.ts`, HS256 with the app's client secret, 60
second life). The App Bridge CDN script is replaced by a small stub, because
the real one sends any page opened outside the admin back to the admin.

The minting code refuses every shop except the dev test store. The token
is added only to requests for the app's own origin; Playwright keeps those
headers on a redirect, so a redirect from the app to another host would
carry a token that is valid for at most 60 seconds and only for this
test-store app.

## Credentials

The run signs in as a separate app, **ProPo E2E (test store only)**, in the
IVYY LLC Dev Dashboard, installed only on the test store. Its client ID is
the `SHOPIFY_API_KEY` variable and its client secret the `SHOPIFY_API_SECRET`
secret of the `store-e2e` GitHub environment. The public ProPo app's secret
is never used here, so the CI secret cannot open a merchant's store.

Only the credential check and the test step get the client secret; the
dependency install and the build do not. The session-token encryption key
and job-envelope secret are generated per run; the database is thrown away
with the runner.

The `store-e2e` environment allows deployments only from `main` and
`store-e2e/*` (one path segment), so no other branch can read its secret.

The JSON report, failure screenshots and logs are uploaded only after
`scripts/store-e2e/scan-artifacts.sh` finds no credential in them (the
client secret, the generated keys, a bearer or session token, or a Shopify
token prefix). Artifacts on this public repository can be downloaded by any
signed-in GitHub user, and log masking does not apply to files.

## Limits

- Inventory-write switches stay off; the specs check the switched-off banners.
- The fresh database has no ProPo plan, so record-creating pages show the
  plan-required notice and plan-gated pages (Replenishment) answer with the
  plan-required page; the specs check both.
- Webhooks from Shopify are not delivered (the app has no public URL).
- Screens are checked outside the admin frame; admin chrome (navigation
  menu, title bar) is not under test.

## Running a branch

Push the commit to a branch named `store-e2e/<name>`, or dispatch the
workflow on one:

```sh
gh workflow run store-e2e.yml --ref store-e2e/<name>
```

Runs on the same branch queue one at a time; a newer queued run replaces an
older pending one. Runs on different branches may overlap. That cannot
change store stock while every write switch is off, but both runs import
the catalog through a Shopify bulk operation and Shopify allows only one
per app and shop at a time, so an overlapping run can fail its sync check.
Re-run it once the other has finished.

The run report, screenshots of failures, and app and worker logs are
attached to the run as the `store-e2e-report` artifact for 7 days.
