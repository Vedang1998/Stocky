# Compliance webhooks and data deletion

How ProPo answers Shopify's three mandatory compliance webhooks and when it deletes a shop's data. Code: `app/privacy/`, `app/routes/webhooks.compliance.tsx`, migration `20261110235000_privacy_requests_and_shop_erasure`.

## What happens

| Event | What ProPo does | Finished when |
|---|---|---|
| `customers/data_request` | Records the request (Shopify's request id and the number of orders listed). Closes it as "no customer data held". | On receipt |
| `customers/redact` | Records the request (number of orders listed). Closes it as "no customer data held". | On receipt |
| `shop/redact` (Shopify sends it 48 hours after uninstall) | Records the request. If the shop is recorded as uninstalled, the worker marks it as being erased, deletes its sessions and queued jobs, deletes every database row that belongs to the shop in batches, then deletes the shop record. If the shop is not recorded as uninstalled, the request waits (see Safety rules). | Within about a minute for a typical uninstalled shop; Shopify allows 30 days |
| Shop uninstalled for `PRIVACY_UNINSTALLED_RETENTION_DAYS` (default 30) with no `shop/redact` received | Same erasure, opened by the worker itself. | Next worker run after the window ends |

Every request is one row in the `PrivacyRequest` table and is written before Shopify gets its 200, so an acknowledged request cannot be lost. A redelivery of the same webhook is recognised by its webhook id and recorded once.

A delivery is accepted only when the `shop_domain` in its signed body is the shop the delivery was sent for. Anything else gets a 401 and no record, so a webhook captured from one shop cannot be replayed against another.

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

- Only a shop recorded as uninstalled is erased. A shop with the app installed, or one an operator has disabled for another reason, is left alone.
- A `shop/redact` for a shop that is not recorded as uninstalled stays open with `lastErrorCode = 'shop_not_uninstalled'` and is checked again every 6 hours. If the uninstall is recorded in that time, the erasure runs. If the shop is still not uninstalled when the request is 30 days old, the request is closed as `SHOP_ACTIVE` and nothing is deleted. Both the first hold and the close are logged as errors, because the usual cause is an `app/uninstalled` delivery that never arrived.
- Once erasure of a shop has started it cannot be reinstalled into the same record. A merchant who reinstalls during those seconds gets an error and a clean install on the next attempt.
- The control-plane database role, which records requests and runs the erasure, cannot delete merchant rows directly. Deletion is one database function, owned by a role that cannot log in, that only works on a shop already marked as being erased and only sees that shop's rows. The runtime role the app uses for merchant requests can read and change a shop's rows only inside that shop's tenant context, and cannot execute the function. `npm run sync:roles:verify` and `npm run tenant:enforcement:verify` check those privileges and CI runs both.
- A shop is recorded as erased only after the worker has confirmed its `Shop` row is gone.
- A failed erasure stays open and is retried after 1 minute, 5 minutes, 30 minutes, 2 hours, then every 6 hours. Requests still open after 30 days are logged as errors every hour.

## Operating it

- After each deploy that runs migrations, run `npm run sync:roles:provision -- --apply` (already required for the sync tables). Until it runs, erasure requests fail and wait.
- Role provisioning has to run as a PostgreSQL superuser. A managed database whose admin user is not a superuser gives that user a membership in the erasure owner role, which verification reports as an error, and erasure then never runs. This has been exercised only with a superuser; confirm it on the production host before launch.
- The worker process must be running; the web process only records requests.
- Open requests: `SELECT "id", "topic", "shopDomain", "receivedAt", "attempts", "lastErrorCode" FROM "PrivacyRequest" WHERE "resolution" IS NULL;`
- Requests waiting on an uninstall: the same query with `"lastErrorCode" = 'shop_not_uninstalled'`. If the merchant has in fact uninstalled (the app no longer appears in the shop's admin and Shopify sent `shop/redact`), `app/uninstalled` was missed: record the uninstall for that shop and the next check erases it. ProPo does not decide this by itself, because a failed call to Shopify does not distinguish a revoked token from an outage.

## Owner decisions

1. **Retention window.** `PRIVACY_UNINSTALLED_RETENTION_DAYS` defaults to 30. The value is a legal and commercial choice (shorter is safer for privacy, longer lets a returning merchant keep their purchase orders and suppliers) and must match the privacy policy.
2. **Order facts on `customers/redact`.** Kept, for the reason above. If counsel wants them deleted instead, the listed orders' rows would have to be removed and blocked from re-syncing.
