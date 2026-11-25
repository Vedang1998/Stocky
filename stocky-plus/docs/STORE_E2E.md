# Dev-store E2E in the cloud

Project rules section 14, rule 3: store tests run without the owner's Mac.

## What runs

`.github/workflows/store-e2e.yml` (manual dispatch, nightly on `main`, and
pushes to `store-e2e/**` branches):

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

The minting code refuses every shop except the dev test store.

## Credentials

The run signs in as a separate app, **ProPo E2E (test store only)**, in the
IVYY LLC Dev Dashboard, installed only on the test store. Its client ID is
the `SHOPIFY_API_KEY` variable and its client secret the `SHOPIFY_API_SECRET`
secret of the `store-e2e` GitHub environment. The public ProPo app's secret
is never used here, so the CI secret cannot open a merchant's store.

The session-token encryption key and job-envelope secret are generated per
run; the database is thrown away with the runner.

## Limits

- Inventory-write switches stay off; the specs check the switched-off banners.
- The fresh database has no ProPo plan, so record-creating pages show the
  plan-required notice; the specs check that too.
- Webhooks from Shopify are not delivered (the app has no public URL).
- Screens are checked outside the admin frame; admin chrome (navigation
  menu, title bar) is not under test.

## Running a branch

Push the commit to a branch named `store-e2e/<name>`, or, for a branch
already on GitHub:

```sh
gh workflow run store-e2e.yml --ref <branch>
```

The run report, screenshots of failures, and app and worker logs are
attached to the run as the `store-e2e-report` artifact for 7 days.
