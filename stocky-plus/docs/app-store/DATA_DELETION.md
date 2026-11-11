# Compliance webhooks and data deletion

How ProPo answers Shopify's three mandatory compliance webhooks and when it deletes a shop's data. Code: `app/privacy/`, `app/routes/webhooks.compliance.tsx`, migration `20261110235000_privacy_requests_and_shop_erasure`.

## What happens

| Event | What ProPo does | Finished when |
|---|---|---|
| `customers/data_request` | Records the request (Shopify's request id and the number of orders listed). Closes it as "no customer data held". | On receipt |
| `customers/redact` | Records the request (number of orders listed). Closes it as "no customer data held". | On receipt |
| `shop/redact` (Shopify sends it 48 hours after uninstall) | Records the request. The worker marks the shop as being erased, deletes its sessions and queued jobs, deletes every database row that belongs to the shop in batches, then deletes the shop record. | Within about a minute for a typical shop; Shopify allows 30 days |
| Shop uninstalled for `PRIVACY_UNINSTALLED_RETENTION_DAYS` (default 30) with no `shop/redact` received | Same erasure, opened by the worker itself. | Next worker run after the window ends |

Every request is one row in the `PrivacyRequest` table and is written before Shopify gets its 200, so an acknowledged request cannot be lost. A redelivery of the same webhook is recognised by its webhook id and recorded once.

## Why customer requests are closed on receipt

ProPo stores no shopper records. Order syncing reads order lines, quantities, amounts and dates and its queries are barred from requesting customer, email or address fields (`app/lib/order-facts/admin-read/safety/graphql-ast.ts`). The database has no column for a shopper's name, email, phone or address; a test (`app/privacy/customer-data-claim.test.ts`) fails if one is added without updating these webhooks. The customer block of the webhook payload is never read, and the order ids Shopify lists are counted but not stored.

Order facts for the orders named in a `customers/redact` request are kept. They identify an order (Shopify order id, order name, amounts, line items), not a person, and Shopify removes the customer from the order on its side.

## What a shop erasure removes

- Every row in every table that has a `shopId` column: merchant data, synced catalog and order facts, webhook and job history. Tables are found from the database catalog at run time, so tables added later are included.
- The shop's Shopify sessions (access tokens and staff names and emails).
- The shop's jobs in the Redis queues, including finished ones.
- The `Shop` row.

What stays: the `PrivacyRequest` row itself, as evidence that the request was carried out. It holds the shop domain, Shopify's shop id, timestamps and the number of rows deleted.

Not covered:

- A job that is running at the moment of erasure cannot be removed from Redis. It fails on the disabled shop and its record is cleared by the queue's own limits (last 1,000 completed and 5,000 failed jobs).
- `TenantBackfillRun`, `TenantOwnershipIssue` and their detail tables have no `shopId` column. They are written only by the one-time ownership backfill tooling, not by the running app.
- Application logs and database backups follow the hosting provider's retention.

## Safety rules

- An installed shop is never erased. A `shop/redact` that arrives for a shop with the app installed is closed as `SHOP_ACTIVE` and nothing is deleted.
- Once erasure of a shop has started it cannot be reinstalled into the same record. A merchant who reinstalls during those seconds gets an error and a clean install on the next attempt.
- The web and worker database roles cannot delete a shop's data directly. Deletion is one database function, owned by a role that cannot log in, that only works on a shop already marked as being erased and only sees that shop's rows. `npm run sync:roles:verify` checks those privileges and CI runs it.
- A failed erasure stays open and is retried after 1 minute, 5 minutes, 30 minutes, 2 hours, then every 6 hours. Requests still open after 30 days are logged as errors every hour.

## Operating it

- After each deploy that runs migrations, run `npm run sync:roles:provision -- --apply` (already required for the sync tables). Until it runs, erasure requests fail and wait.
- The worker process must be running; the web process only records requests.
- Open requests: `SELECT "id", "topic", "shopDomain", "receivedAt", "attempts", "lastErrorCode" FROM "PrivacyRequest" WHERE "resolution" IS NULL;`
- If `app/uninstalled` was never delivered for a shop that has in fact uninstalled, its `shop/redact` is closed as `SHOP_ACTIVE`. Run the uninstall for that shop; the retention window then erases it.

## Owner decisions

1. **Retention window.** `PRIVACY_UNINSTALLED_RETENTION_DAYS` defaults to 30. The value is a legal and commercial choice (shorter is safer for privacy, longer lets a returning merchant keep their purchase orders and suppliers) and must match the privacy policy.
2. **Order facts on `customers/redact`.** Kept, for the reason above. If counsel wants them deleted instead, the listed orders' rows would have to be removed and blocked from re-syncing.
