# ProPo — testing instructions for Shopify App Review

**Status:** Draft for owner review. Not submitted.
**Prepared:** 2026-11-10, against `main` at `2685081`.
**Sources:** App Store requirements 1.2, 2.1, 2.3 and 4.5 ([link](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)); [Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review); [Shopify App Pricing — Testing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing#testing).

Part A is for the owner and is not pasted anywhere. Part B is the text for the **Testing instructions** field of the submission form. Button and field names in Part B are copied from the UI code on `main`; update them if the UI changes before submission.

---

## Part A — before pasting (owner only)

These instructions only work if all of the following are true on the build Shopify reviews. Each item is a failure reason Shopify lists in [Common app review problems](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review#common-app-review-problems).

1. **Install lands in the app with no shop-domain prompt** [2.3.1–2.3.4]. Done in PR #76: the template landing page and the shop-domain field are gone.
2. **Billing uses Shopify App Pricing** [1.2.1–1.2.3]. The billing page now sends plan changes to Shopify's hosted plan page and no longer calls the Billing API. Still needed: the plans themselves in the Partner Dashboard, with handles `essentials`, `growth` and `pro`, and `SHOPIFY_APP_HANDLE` set on the server.
3. **Plans can be tested by the reviewer at no charge.** The review store belongs to Shopify, not to our Partner organization, so only free plans and paid plans marked "free for partners and developers" are available to it at no charge. Mark Essentials, Growth and Pro that way in the plan settings.
4. **Every feature named in the listing works without an error** [2.1.1, 2.1.2]. On `main`, these actions stop with an error unless their switch is on: PO "Receive" and Warehouse scanning (`FEATURE_RECEIPT_WRITES`), stocktake "Complete — push deltas to Shopify" (`FEATURE_STOCKTAKE_INVENTORY_WRITES`), transfer "Ship" and "Receive at destination" (`FEATURE_TRANSFER_WRITES`). The merchant sees "… is not turned on for this store yet." Transfer "Ship" also needs the `write_inventory_transfers` scope, which is not requested. For each feature, either switch it on after its release gate passes, or remove it from the listing and from Part B below.
5. **No developer text in the UI.** Still on `main`: "The background worker must be running (`npm run worker`)" on the dashboard, "Marketing must not claim unlimited or AI-driven forecasting…" and "Activate (dev only)" on the buying table, and the working-title heading "Inventory platform". Tracked in issue #80.
6. **The background worker and Redis run in production**, so catalog sync and order webhooks are processed.
7. **The protected customer data request is approved** (see `PROTECTED_CUSTOMER_DATA_ANSWERS.md`). Without it, order data will not reach the app on the review store.
8. **Emergency developer contact is set** in the Partner Dashboard (email and phone) [4.5.6].
9. **A demo screencast is attached** [4.5.3] (outline in `LISTING_DRAFT.md` §14).

---

## Part B — text for the Testing instructions field

### Overview

ProPo helps merchants decide what to reorder from each supplier, turn that into purchase orders, and track stock through receiving. It runs inside Shopify admin. There is no separate ProPo account, so no login or password is needed.

### Test credentials

None. ProPo signs in with the Shopify store it is installed on. `OWNER TO FILL: if a pre-loaded demo store is offered, give its URL and staff access here, with no two-factor or one-time-code step (4.5.5).`

### 1. Prepare test data (about 5 minutes)

If your test store is empty:

1. Create three products, each with a SKU and a barcode, tracked inventory and a quantity of 20 at your default location. Use the same vendor for all three.
2. If you will test transfers, add a second location.

Create test orders **after** installing ProPo (step 2), because ProPo picks up new orders as they are placed. In Shopify admin, create two or three draft orders for these products and mark them as paid.

### 2. Install

1. Install ProPo from the link provided. Shopify shows the permission screen.
2. Approve. You land on the ProPo dashboard.

Expected: no screen asks for a store address, and the app opens inside Shopify admin.

### 3. Choose a plan

1. Open **Billing** in the ProPo menu.
2. Choose a plan. Shopify's plan page opens; choose **Growth** and approve. The plan is free on test stores.
3. You return to ProPo, and Billing shows the active plan.

Upgrading or downgrading works from the same page without contacting support.

### 4. Sync the catalog

1. Open **Dashboard** and click **Sync catalog (bulk operation)**.
2. Refresh after one to two minutes.

Expected: **Cached variants** shows the number of variants in your store.

### 5. Add a supplier

1. Open **Suppliers**. Enter a **Supplier name**, **Contact email** and **Currency**, then **Add supplier**.
2. Open the supplier. Under **SKU mappings**, choose a **Shopify variant**, enter a **Vendor SKU**, **MOQ** and **Pack size**, and click **Add mapping**. Repeat for the other two products.
3. Under **Volume pricing tiers**, add one tier with **Min qty**, **Unit cost** and **Add tier**.

Expected: the mappings and tier appear in their tables.

### 6. Buying table

1. Open **Buying Table**. Choose your supplier under **Vendor** and your location under **Location**, then click **Load**.
2. Each row shows **Current** stock, **Incoming**, **Velocity/day**, **ABC**, **Reorder pt** and a suggested **To buy** quantity.
3. Change one **To buy** value, then click **Create draft PO from quantities**.

Expected: a draft purchase order appears on **Purchase Orders**, priced from the supplier's volume tier. Quantities are raised to the supplier's MOQ and rounded up to a whole pack. Products with no orders yet show a sales rate of zero; that is correct for a new install.

### 7. Purchase order with landed cost

1. Open **Purchase Orders**. Under **Create purchase order**, choose the supplier and a destination location, enter **Freight cost** and **Customs / duties**, choose **Landed cost allocation** (By line cost, By weight or By volume), and click **Create draft PO**.
2. On the new order, choose a variant, enter a **Quantity** and click **Add line**. Add a second line.
3. Click **Mark ordered (locks landed costs)**.
4. Click **Receiver PDF** to download the receiving sheet.

Expected: each line shows a **Landed unit cost** that includes its share of freight and duties. Freight and duties are entered when the order is created; orders created from the buying table do not carry them.

`Include steps 8–10 only if those features are switched on in the reviewed build.`

### 8. Receive stock

1. On the purchase order, enter a **Receive qty** for one line and click **Receive**. Check the product's inventory in Shopify admin.
2. Open **Warehouse**, choose the purchase order, type or scan a product barcode into **Scan barcode**, and press Enter. Click **Receive +1** for another unit.
3. Click **Confirm receipt — print N labels (ZPL)** (N is the number scanned) to download the label file.

Expected: received quantities update on the order and in Shopify inventory.

### 9. Stocktake

1. Open **Stocktakes**. Enter a **Name**, choose a **Location**, click **Freeze expected & start**.
2. Add a variant, enter a **Counted qty** different from expected, click **Save**.
3. Click **Complete — push deltas to Shopify**.

Expected: the **Delta** column shows the difference, and Shopify inventory matches the count afterwards.

### 10. Transfer

1. Open **Transfers**. Choose **Source location** and **Destination location**, click **Create draft**.
2. **Add line**, enter **Picked qty**, click **Pick**, then **Ship (creates Shopify transfer)**, then **Receive at destination**.

Expected: stock moves between the two locations in Shopify.

### 11. Reports

1. Open **Analytics** and click **Run ABC analysis now**.
2. Review **Inventory valuation**, **Dead stock (no sales in 120 days)** and the low-stock list.
3. Click **Download valuation CSV**.

Expected: the CSV downloads with one row per variant.

### 12. Uninstall

Uninstalling stops all ProPo processing for the store and deletes its access token at once. Shopify's data deletion request follows 48 hours later.

### Known limitations

- English only.
- Sales history starts from the day ProPo is installed. `OWNER TO UPDATE when the order-history import ships: "ProPo imports past orders after install; this can take a few minutes."`
- Catalog sync runs in the background and can take a few minutes on large catalogs.
- Suggested quantities use the average daily sales rate over the chosen period. They do not model seasonality.
- Labels download as a ZPL file for Zebra label printers.
- `OWNER TO FILL: any feature from steps 8–10 that is not available, with the reason.`

### Contact during review

- Emergency developer contact (also set in the Partner Dashboard): `OWNER TO FILL: name, email, phone`
- App submission contact email: `OWNER TO FILL`
