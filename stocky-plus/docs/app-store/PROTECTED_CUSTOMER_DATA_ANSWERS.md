# ProPo — protected customer data request and read_all_orders justification

**Status:** Draft answers for the owner to review and enter in the Partner Dashboard. Nothing has been submitted.
**Prepared:** 2026-11-10, against `main` at `2685081`.
**Dashboard state reported by the owner:** Protected customer data access is "Draft", with the reason "Store management" selected. `read_all_orders` has been approved for the public app.
**Sources:** [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data), [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance), [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) 3.2 and 3.2.1, [Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review).

Finish this request **before** submitting the app. Shopify's submission page says you cannot apply for protected customer data while the app is under review.

---

## 1. Level ProPo needs: Level 1

| Level | Meaning (Shopify) | ProPo |
|---|---|---|
| 0 | No customer data | Not enough. ProPo reads orders and receives order webhooks. |
| **1** | Customer data **excluding** name, address, phone and email | **Request this.** |
| 2 | Customer data **including** any of name, address, phone or email | Not needed. Do not request. |

**Why not Level 0.** Shopify counts orders, refunds, transactions and webhooks "that relate to a single customer or order" as protected customer data, even if the app never asks for a customer field. ProPo needs them:

- Admin API order reads: `app/lib/order-facts/` (orders, line items, refunds, refund lines, adjustments, agreements, transactions).
- Webhooks in `shopify.app.toml`: `orders/create`, `orders/cancelled`, `orders/edited`, `orders/delete`, `refunds/create`, `order_transactions/create`.

**Why not Level 2.** In step 5 of the request form, select **none** of the protected fields:

| Protected field | Requested | Evidence |
|---|---|---|
| Name | No | No customer model in `prisma/schema.prisma`; order facts have no customer or name columns. |
| Email | No | `email` is on the forbidden field list for order reads. |
| Phone | No | `phone` is on the forbidden field list. |
| Address (billing, shipping, geolocation, zip) | No | `billingAddress` and `shippingAddress` are on the forbidden field list. |

The forbidden field list is `ORDER_FACTS_FORBIDDEN_FIELD_NAMES` in `app/lib/order-facts/admin-read/safety/graphql-ast.ts`: `customer`, `email`, `phone`, `note`, `billingAddress`, `shippingAddress`, `staffMember`, `customAttributes`, `paymentDetails`, `receiptJson`, `accountNumber`, `device`, `user` and others. An order query that asks for any of them is rejected before it is sent.

Webhook payloads are reduced before storage (`app/sync/sanitize.server.ts`, called from `app/sync/intake.server.ts`). For orders, only these fields are kept: order ID, name (order number), created/updated/cancelled times, cancel reason, financial and fulfillment status, currency, totals, tax, discounts, and per line the line ID, variant ID, product ID, SKU, quantity, price, discount, location ID and fulfillment status.

## 2. Request form: what to enter

Steps from the official page (Partner Dashboard → Apps → ProPo → API access requests → Protected customer data access → Request access).

**Step 4 — Protected customer data, reasons.** Keep "Store management". Add another reason only if the form lists one that matches a real ProPo use. Proposed explanation:

```
ProPo reads orders, refunds and order transactions to count units sold and revenue per product variant and location. Those figures drive reorder suggestions, ABC classes, low-stock alerts and inventory reports. ProPo does not read the customer on an order or any customer name, email, phone number or address, and it reduces order webhooks to non-personal fields before saving them.
```

**Step 5 — Protected customer fields.** Select none.

**Step 6 — Data protection details.** Answer the questions in section 3.

## 3. Data protection questions

The list below is the current requirements list from the official page (checked 2026-11-10), in the same order. The dashboard asks about each requirement; its wording may differ slightly, but the substance is the same. Level 1 requirements apply to ProPo. Level 2 requirements apply only to apps that use name, address, phone or email; answers are proposed in case the dashboard shows them.

Status key: **Ready** — can be answered truthfully today. **Blocked** — the honest answer today is No or Partly; fix before submitting. **Owner** — depends on facts outside the repository.

### Level 1

| # | Requirement (official wording) | Proposed answer | Evidence | Status |
|---|---|---|---|---|
| L1.1 | Process only the minimum personal data required to provide app functionality to merchants. | Yes. ProPo reads order data only for sales figures and never requests customer identity, contact or address fields. It uses store-level access tokens only, so it does not store staff names or emails. | Forbidden field list (section 1); webhook allowlist in `sanitize.server.ts`; `app/shopify.server.ts` does not enable online tokens. | Ready |
| L1.2 | Inform merchants what personal data you process and your reason for processing it. | Yes. The privacy policy lists each type of data and why it is used, and the App Store listing links to it. | `docs/app-store/PRIVACY_POLICY_DRAFT.md` | Blocked until the policy is reviewed and published at `OWNER TO FILL: privacy policy URL`. |
| L1.3 | Limit your processing of personal data to the stated purposes. | Yes. Order data is used for sales rates, reorder suggestions, ABC classes, alerts and merchant reports. It is not used for marketing, sold, shared with third parties for their own use, or sent to AI services. | No analytics, advertising or AI dependencies in `package.json`; order facts are read only by forecasting and report code. | Ready |
| L1.4 | Where applicable, respect and apply customer consent decisions. | Not applicable. ProPo has no contact with shoppers and does no processing that depends on shopper consent (no marketing, tracking or profiling). | As L1.3. | Ready (choose "not applicable" if the form allows it; otherwise "Yes" with this explanation) |
| L1.5 | Where applicable, respect and apply customer decisions to opt out of any data sharing such as a "data sale" or similar concept under applicable laws or regulations. | Not applicable. ProPo does not sell or share personal data. | As L1.3. | Ready (same note as L1.4) |
| L1.6 | If you use personal data for automated decision-making and those decisions might have legal or significant effects, then you must allow customers to opt out. | Not applicable. ProPo's calculations are about products and stock, not about people. | Forecasting and ABC code in `app/services/forecasting.server.ts` operates on variant-level aggregates. | Ready |
| L1.7 | Make privacy and data protection agreements with your merchants. | Yes, through the published privacy policy and `OWNER TO FILL: terms of service / data processing agreement`. | — | Blocked / Owner |
| L1.8 | Apply retention periods to make sure that personal data isn't kept for longer than needed. | Yes. Access tokens are deleted at uninstall. All store data is deleted when Shopify's `shop/redact` request arrives, or `PRIVACY_UNINSTALLED_RETENTION_DAYS` (default 30) days after uninstall if it never does. | `app/sync/uninstall.server.ts`, `app/privacy/`, `docs/app-store/DATA_DELETION.md`. Tests: `app/sync/__tests__/privacy-compliance.test.ts`. | Ready once the owner confirms the retention window. |
| L1.9 | Encrypt data at rest and in transit. | In transit: Yes. All app traffic is HTTPS and Shopify API calls use TLS. At rest: Shopify access tokens are encrypted by the app (AES-256-GCM, R-191); for everything else, `OWNER TO FILL` from the database, Redis and backup provider. | The app encrypts only the stored Shopify tokens. Nothing in the repository proves disk encryption or TLS on the database and Redis connections. Check the production `DATABASE_URL` (`sslmode`) and `REDIS_URL` (`rediss://`). | **Blocked / Owner** |

### Level 2 (not required for ProPo's request; proposed in case the dashboard asks)

| # | Requirement (official wording) | Proposed answer | Status |
|---|---|---|---|
| L2.1 | Encrypt your data backups. | `OWNER TO FILL` from the database provider. | Owner |
| L2.2 | Keep test and production data separate. | Yes. Development uses development stores and a local database (`docker-compose.yml`); production uses a separate database. `OWNER TO CONFIRM` that no production data is copied to development. | Owner |
| L2.3 | Have a data loss prevention strategy. | `OWNER TO FILL`. Collecting no customer identity data is part of it, but a written strategy is needed. | Owner |
| L2.4 | Limit staff access to protected customer data. | `OWNER TO FILL`: who can reach the production database and how access is granted. | Owner |
| L2.5 | Require strong passwords for staff accounts. | `OWNER TO FILL`: password and two-factor rules for hosting, database, GitHub and Partner accounts. | Owner |
| L2.6 | Keep an access log to protected customer data. | `OWNER TO FILL`: provider audit logs for database access. | Owner |
| L2.7 | Implement a security incident response policy. | `OWNER TO FILL`. There is no incident response policy in the repository. | Owner |

## 4. Compliance webhooks

Shopify requires the app to verify and answer all three with a 2xx status, return `401` for an invalid HMAC, and complete the action within 30 days.

| Topic | Shopify behavior | ProPo | Open point |
|---|---|---|---|
| `customers/data_request` | Sends the customer's ID and the order IDs; the app gives the data to the store owner directly. | Recorded and closed as "no customer data held". The customer block is never read and the order IDs are counted, not stored. | None, while ProPo stores no shopper fields. |
| `customers/redact` | Sent after the deletion request, with the order IDs to redact. | Recorded and closed as "no customer data held". The named order records are kept; they hold order number, amounts and line items. | `OWNER TO DECIDE:` keep the order records, or delete the named orders. |
| `shop/redact` | Sent 48 hours after uninstall. | Every row belonging to the store, its sessions and its queued jobs are deleted, then the store record. A record of the request is kept. A request for a store that is not recorded as uninstalled waits and is rechecked. | Retention window to be confirmed by the owner. |

HMAC verification and the `401` response are handled by `authenticate.webhook` from the Shopify app library. A delivery whose signed body names another shop, or a customer request sent as `shop/redact`, is also answered with `401`. Details: `docs/app-store/DATA_DELETION.md`.

## 5. read_all_orders justification (App Store requirement 3.2.1)

Requirement 3.2.1: "If your app is accessing the `read_all_orders` scope, it must demonstrate the need for this scope." Requirement 3.2 adds that Shopify may ask for proof that a scope is required.

### Proposed text

```
ProPo suggests how much stock to reorder from each supplier, based on how fast each product variant sells at each location. Merchants choose the sales period behind those suggestions, for every product or one at a time, and slow-selling or seasonal products need periods longer than 60 days to give a usable sales rate. ProPo's dead-stock report lists products with no sales in the last 120 days, and its ABC analysis ranks variants by the last 90 days of sales. With read_orders alone ProPo sees only the last 60 days of orders, so these figures would be wrong for any period longer than that. ProPo reads only sales facts from those orders: products, quantities, prices, discounts, refunds, dates and location. It does not read the customer or any customer name, email, phone number or address.
```

Each claim maps to code on `main`:

| Claim | Where |
|---|---|
| Merchant chooses the sales period, per product | Buying table lookback Start/End and "Reset to global default" (`app/routes/app.buying-table.tsx`, `ForecastOverride` model) |
| Dead stock: no sales in 120 days | `getDeadStock(db, 120)` in `app/routes/app.analytics.tsx` |
| ABC on 90 days | `runAbcAnalysis` in `app/services/forecasting.server.ts` |
| Sales facts only | Forbidden field list and webhook allowlist (section 1) |

Add this sentence only once the method exists: `It also offers a "same period last year" reorder method, which needs order history from a year earlier.`

### Problems to fix before relying on this text

1. **Nothing reads orders older than 60 days yet.** The screens above read daily sales totals that are filled only from `orders/create` webhooks received after install (`app/jobs/workers/webhook-processor.ts`). The order-history sync exists (`enqueueOrderFactsSync` in `app/jobs/queue.server.ts`) but nothing calls it, and `app/lib/order-facts/sync/constants.ts` still says "Do not add read_all_orders". If a reviewer asks for proof, the honest answer today is that the scope is requested but unused. Ship and test the history import before submitting.
2. **Don't lean on ABC long term.** The planned ABC/U method uses the last eight weeks (PRD §3.5), which fits inside 60 days. Once it replaces the current 90-day calculation, take ABC out of the justification.
3. **`write_products` has no code path.** No mutation in the app uses it (`docs/CODE_TO_REQUIREMENT_GAP_MAP.md` notes "write_products present … P0 scope without workflow"). Requirement 3.2 allows Shopify to ask about every scope. Remove it or be ready to explain it.
4. **`write_inventory_transfers` is missing.** `inventoryTransferCreate` (used by the transfer "Ship" step) requires it. Either add it with a reason or drop the transfer feature from the listing.
