# ProPo privacy policy — DRAFT

> **DRAFT — NOT FOR PUBLICATION. Requires review by a qualified lawyer before use.**
> Prepared 2026-11-10 from the code on `main` at `2685081`; sections 5 and 6 and the checklist updated 2026-11-12 for the compliance webhooks, store erasure and the inventory change record. It describes what the code stores and does, not what the roadmap plans. Remove this box and the checklist below before publishing.

## Before publishing (remove this section from the public page)

Several statements in the policy are true only once code that is not on `main` today has shipped. Do not publish until each item is done, or rewrite the statement to match what the code does.

| # | Statement in the policy | State on `main` (2685081) | What has to happen |
|---|---|---|---|
| 1 | Store data is deleted after Shopify's `shop/redact` request | Done. An uninstalled store's data is erased when the request arrives, or 30 days after uninstall if it never does (`docs/app-store/DATA_DELETION.md`). | Confirm the 30-day window and any record the law requires us to keep with counsel. |
| 2 | Customer data requests and deletion requests are handled | Done. Each request is recorded and closed as "no customer data held". Order records named in a deletion request are kept; they carry no shopper details. | Decide with counsel whether the named order records should be deleted instead. Section 6 describes what the code does today. |
| 3 | Backup retention period | Not set in the repository. | `OWNER TO FILL` from the hosting/database provider. |
| 4 | Encryption at rest | The app encrypts the Shopify access tokens it stores. Encryption of the rest of the database is not provable from the repository, so the policy does not claim it. | If the database provider encrypts at rest, add it with the provider's wording. |
| 5 | Subprocessor list and hosting region | Not recorded in the repository. | `OWNER TO FILL` |

Everything else below matches the code as of `2685081`. Re-check this policy whenever the data model, the webhook list or the requested scopes change.

---

# ProPo Privacy Policy

**Last updated:** `OWNER TO FILL: publication date`

ProPo is an inventory and purchasing app for Shopify stores. It is provided by IVYY LLC ("IVYY", "we", "us"). This policy explains what information ProPo collects when a Shopify merchant installs it, why, how long we keep it, and who we share it with.

## 1. Who this policy covers

- **Merchants** who install ProPo, and their staff who use it.
- **Suppliers** whose contact details a merchant enters into ProPo.
- **Shoppers** who buy from a store that uses ProPo. ProPo does not collect shoppers' names, email addresses, phone numbers or addresses. Section 3.4 explains what order information it does use.

## 2. Our role

For information about a merchant's store, products, orders and suppliers, IVYY acts on the merchant's behalf as a service provider (a "processor" under the GDPR). The merchant decides why that information is processed. For information we hold to run our own business, such as support emails, IVYY decides how it is used. `OWNER TO FILL: confirm roles with counsel; add a data processing agreement link if one will be offered.`

## 3. Information ProPo collects

ProPo gets information in three ways: from Shopify through the access the merchant approves when installing, from what the merchant enters in ProPo, and from calculations ProPo runs on those two.

### 3.1 Store and account information

- The store's myshopify.com address, primary domain and Shopify store ID.
- Store time zone and currency.
- When the app was installed, uninstalled or reinstalled.
- Access credentials Shopify issues to ProPo: an access token, a refresh token, their expiry times and the permissions granted. These let ProPo read and update the store on the merchant's behalf.

ProPo uses store-level ("offline") access only. It does not request per-staff sessions and does not store staff members' email addresses. When a staff member changes inventory through ProPo, the change is recorded with that staff member's Shopify user ID, and their display name where one is supplied, so the merchant can see who made it.

### 3.2 Product, inventory and location information

- Products and variants: titles, SKUs, barcodes, prices, vendor, product type, tags, status, image links, weight and collection membership.
- Inventory items: unit cost, weight and whether inventory is tracked.
- Inventory quantities for each location (available, on hand, incoming, committed, reserved, damaged, safety stock and quality control).
- Locations: name, status, and the business address of each location (street, city, region, postal code and country).

### 3.3 Information the merchant enters

- **Supplier records:** supplier name, account number, contact name, contact email, contact phone, currency, notes and lead times. These may identify a person at the supplier.
- Supplier SKUs, minimum order quantities, pack sizes and price breaks.
- Purchase orders: supplier, destination location, lines, quantities, costs, exchange rate, freight, duties and notes.
- Transfers, stock counts, bundle component mappings, forecast settings and alert acknowledgements.

### 3.4 Order and sales information

To calculate sales rates, suggested order quantities and reports, ProPo reads orders, refunds and order transactions from Shopify. It keeps only facts about the sale:

- order number, dates, status, test flag, sales channel name and retail location;
- currency, totals, subtotals, taxes, discounts, shipping amounts, refunds and net payment;
- for each line: product, variant, title, SKU, vendor, quantities, prices and discounts;
- refund lines, restock details, order adjustments and transaction status, kind and amount.

ProPo does **not** request or store the customer linked to an order, or any customer name, email address, phone number, billing or shipping address, order note, custom attributes, payment details or the staff member who placed the order. The code that reads orders rejects any request for those fields, and order notifications from Shopify are reduced to a fixed list of non-personal fields before they are saved.

Shopify still treats order data as protected customer data, so ProPo applies the protections in Shopify's protected customer data requirements to it.

### 3.5 Information ProPo derives

Daily units sold and revenue per variant and location, ABC classes, inventory snapshots, low-stock alerts and forecast results.

### 3.6 Billing information

Charges for ProPo are billed by Shopify. ProPo learns the plan a store is on and whether the subscription is active. It never receives card or bank details.

### 3.7 Technical records

- Records of each notification Shopify sends (topic, time, a reduced copy of the content and a fingerprint of it) so the same event is not processed twice.
- Background job, sync and error records, including error codes and short failure summaries.
- Server logs, which include the store address and the type of event handled. `OWNER TO FILL: how long the hosting provider keeps logs.`

### 3.8 Support communications

If you contact us, we keep the messages and the contact details you use. `OWNER TO FILL: support channel and how long support messages are kept.`

### 3.9 What ProPo does not do

- No advertising, analytics or tracking cookies.
- No sale of personal information, and no sharing for cross-context behavioral advertising.
- No sending of store data to AI or machine-learning services. `If AI features ship later, update this line before they go live.`

## 4. Why we use it

| Purpose | Information used |
|---|---|
| Install, sign in and keep ProPo connected to the store | 3.1 |
| Show stock levels, suggest what to reorder and calculate ABC classes | 3.2, 3.4, 3.5 |
| Create and track purchase orders, receiving, transfers and stock counts | 3.2, 3.3 |
| Update inventory in Shopify when the merchant completes a receipt, count or transfer that changes stock | 3.1, 3.2, 3.3 |
| Reports and CSV exports the merchant asks for | 3.2–3.5 |
| Check which plan the store is on | 3.6 |
| Keep data in step with Shopify, detect and repair sync errors, and keep the service secure | 3.7 |
| Answer support requests | 3.8 |

We use information only for these purposes. We do not use one store's information for another store.

## 5. Who we share it with

- **Shopify**, to read and update the store through Shopify's APIs.
- **Service providers** that host and run ProPo for us, under contracts that limit their use of the data to providing their service:

  | Provider | Service | Location |
  |---|---|---|
  | `OWNER TO FILL` | Application hosting | `OWNER TO FILL` |
  | `OWNER TO FILL` | PostgreSQL database | `OWNER TO FILL` |
  | `OWNER TO FILL` | Redis job queue | `OWNER TO FILL` |
  | `OWNER TO FILL` | Support email | `OWNER TO FILL` |

- **Authorities**, when the law requires it.
- **A buyer or successor**, if IVYY's business is sold or merged, under this policy's terms.

## 6. How long we keep it, and deletion

**While ProPo is installed**, we keep the information in section 3 so the merchant can use sales history, purchase-order history and reports. `OWNER TO FILL: any maximum history kept while installed.`

**When the app is uninstalled**, ProPo stops processing the store straight away, cancels queued work and deletes the store's Shopify access tokens.

**48 hours after uninstall**, Shopify asks us to erase the store's data. We then delete the store's information from our live systems within 30 days of that request, keeping only a record that the deletion took place and anything the law requires us to keep. If that request does not reach us, we delete the store's information ourselves `OWNER TO CONFIRM: 30` days after uninstall. Deleted data may remain in backups until they expire after `OWNER TO FILL: backup retention period`.

**Shopper requests.** When a shopper asks a merchant for their data or for deletion, Shopify tells ProPo which orders are involved. ProPo holds nothing that identifies a shopper, so there is no personal information to hand over or delete; we record each request and that it was answered. The order records themselves (order number, amounts and line items) stay in the merchant's sales history. `OWNER TO DECIDE with counsel: keep these records, or delete the orders named in a deletion request.`

**Supplier contacts** are kept until the merchant deletes the supplier or the store's data is erased.

## 7. Security

- All traffic between the merchant's browser, Shopify and ProPo uses HTTPS (TLS).
- Requests from inside Shopify admin are authenticated with Shopify session tokens. Notifications from Shopify are checked against Shopify's signature before they are processed.
- ProPo uses access tokens that expire and are refreshed, rather than permanent tokens.
- Every database query ProPo makes for a store is limited to that store's records, and automated tests check that one store cannot read or change another store's data.
- ProPo collects the least information it needs, as described in section 3.
- Access to production systems is limited to `OWNER TO FILL: who, and how access is granted and logged`.

No system is perfectly secure. If we learn of a breach affecting your information, we will notify affected merchants and authorities as the law requires. `OWNER TO FILL: incident contact and notification commitment, after counsel review.`

## 8. International transfers

ProPo's systems are hosted in `OWNER TO FILL: country or region`. If information moves across borders, we use the safeguards the law requires, such as standard contractual clauses. `OWNER TO FILL: confirm with counsel.`

## 9. Your rights

**Merchants** can ask us to access, correct, export or delete the information ProPo holds about their store, or uninstall the app to start deletion.

**Shoppers** should contact the store they bought from. ProPo acts on the merchant's instructions, and Shopify passes shopper requests to us.

**Supplier contacts** can ask the merchant who entered their details, or contact us.

Residents of some places, including the EEA, the UK and California, have further rights under local law. We honor them for all users, wherever they live. You may also complain to your local data protection authority.

## 10. Children

ProPo is a business tool. It is not directed to children and we do not knowingly collect information about them.

## 11. Changes

We will post changes on this page and update the date at the top. For material changes we will also notify merchants by `OWNER TO FILL: email or in-app notice`.

## 12. Contact

IVYY LLC
`OWNER TO FILL: registered address`
Email: `OWNER TO FILL: privacy contact email`
