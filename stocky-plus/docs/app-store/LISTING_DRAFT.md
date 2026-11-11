# ProPo — Shopify App Store listing draft

**Status:** Draft for owner review. Nothing here has been entered in the Partner Dashboard.
**Prepared:** 2026-11-10, against `main` at `2685081` (PR #72).
**Sources:** Shopify [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) (sections 1–4), [listing best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices), [app listing categories](https://shopify.dev/docs/apps/launch/app-store-review/app-listing-categories), [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing), and the repository code.

Requirement numbers in square brackets (for example [4.3.3]) refer to the App Store requirements page. "BP" means the best-practices page.

Lines marked `OWNER TO FILL` need a fact only the owner has. Lines marked **Gated** describe a feature that exists in the code but is switched off by default (`app/lib/feature-flags.server.ts`). Shopify requires the app to deliver what the listing describes [2] and to work without errors during review [2.1.1, 2.1.2], so a gated feature must either be switched on in the build that is reviewed or be removed from every field below.

---

## 1. Rules applied to every field

| Rule | Source |
|---|---|
| No statistics, percentages, guarantees, or "the first / the best / the only" | [4.3.3], [4.3.4] |
| No reviews or testimonials | [4.3.6], [4.3.7] |
| Prices appear in the Pricing section only, never in text elsewhere, images or the icon | [4.2.2], [4.2.3] |
| No Shopify trademarks in the icon, feature image or screenshots | [4.4.3] |
| Describe only features the reviewed build delivers | [2], [4.3] |
| Do not mention our other apps or services | [4.4] |
| App name must match or be similar to the name in the Dev Dashboard / `shopify.app.toml` | [4.1.1] |

### Naming Stocky

Section 4 of the requirements does not say whether a listing may name another app for comparison. It does say the name must not be confusingly similar to a Shopify product [4.1.2], and that Shopify trademarks may only be used to show compatibility [4.4.3]. Stocky is a Shopify-owned app, and the repository rules already forbid using its name in public branding (`docs/product/00_READ_ME_FIRST.md`).

**Recommendation:** do not name Stocky anywhere in the listing, including search terms and images. If the owner wants "moving from Stocky" wording, ask Shopify Partner Support first and keep the answer on file. `OWNER TO DECIDE`

---

## 2. App name

```
ProPo Inventory & Purchasing
```

28 characters (limit 30, BP 5.A.1). Leads with the brand [4.1.2]. The short form "ProPo" is acceptable in the Dev Dashboard because both names share the distinctive word [4.1.1].

- `OWNER TO FILL:` confirm the final listing name and set the same or a similar name in the Dev Dashboard. `shopify.app.toml` currently has no `name` and an empty `client_id`, and its header still calls the name a "working title".
- `OWNER TO FILL:` search the App Store for "ProPo" and confirm no app or developer already uses it [4.1.2].

## 3. App card subtitle

```
Know what to reorder, then order and receive it from suppliers
```

62 characters. Benefit-led, no keywords added for search, no figures [4.4.1]. The official pages checked on 2026-11-10 do not state a character limit for this field; the submission form enforces one. If the form rejects it, use the shorter option:

```
Plan reorders from sales history and track supplier orders
```

(58 characters.) If receiving stays switched off in the reviewed build, use the shorter option, because the first one promises receiving.

## 4. App introduction

```
Reorder suggestions for each supplier become draft purchase orders, helping you avoid running out.
```

98 characters (limit 100, BP 5.B.4). Complete sentence, a benefit, no data claim [4.3.3].

## 5. App details

```
ProPo plans purchasing from your Shopify products, stock and sales. Add suppliers with their SKUs, minimum order quantities, pack sizes and price breaks. The buying table shows each product's stock, incoming units, daily sales rate, ABC class and suggested quantity, and you can change the sales period behind any product. Turn the quantities into a draft purchase order priced from the supplier's price breaks. Add freight and duties to an order and ProPo spreads them into a landed unit cost.
```

494 characters (limit 500, BP 5.B.5). Every sentence maps to code on `main`:

| Claim | Where it is |
|---|---|
| Supplier SKUs, MOQ, pack size, price breaks | `app/routes/app.suppliers_.$id.tsx` (SKU mappings, volume pricing tiers) |
| Stock, incoming, daily sales rate, ABC, suggested quantity | `app/routes/app.buying-table.tsx` columns Current, Incoming, Velocity/day, ABC, To buy |
| Change the sales period per product | Buying table "Lookback" (custom start/end, "Reset to global default") |
| Draft PO priced from price breaks | "Create draft PO from quantities" uses `resolveTieredUnitCost` |
| Freight, duties, landed unit cost | `app/routes/app.purchase-orders.tsx` (Freight cost, Customs / duties, Landed cost allocation, Landed unit cost) |

Two things the copy deliberately avoids, because the code does not do them today:

- Freight and duties can only be entered when a purchase order is created on the Purchase Orders page. A draft created from the buying table has no freight or duties, and there is no way to add them afterwards. The copy says "add freight and duties to an order", not "to the draft".
- The buying table raises every line to the supplier's MOQ and rounds it up to a whole pack (`app/routes/app.buying-table.tsx`, marked "KNOWN-WRONG vs product rules"). The copy does not say the merchant's quantities are kept exactly.

Do not add "replaces Stocky", "AI", "smart forecasting" or "seasonal" wording. The current forecast is a sales-rate calculation; the parity methods and Smart mode in the PRD are not built (`docs/product/02_FULL_STOCKY_PARITY_PRD.md` §3.4, `.env.example` note "NOT Stocky Last X parity").

## 6. Feature list

Up to 80 characters each (BP 5.B.6). Describe what the merchant does, not how it is built.

Supported by the current build:

1. `Suggested reorder quantities by supplier, from sales, stock and incoming units` (78)
2. `Turn suggestions into purchase orders priced from supplier price breaks` (71)
3. `Supplier records with vendor SKUs, minimum order quantities and price breaks` (76)
4. `Spread freight and duties across order lines as a landed unit cost` (66)
5. `Inventory value, dead stock and low-stock reports with CSV export` (65)

Add only if switched on and tested in the reviewed build (**Gated**):

6. `Receive deliveries by barcode scan and print labels for what arrived` (68) — needs `FEATURE_RECEIPT_WRITES`.
7. `Stocktakes that compare counted to expected stock before updating Shopify` (73) — needs `FEATURE_STOCKTAKE_INVENTORY_WRITES`.
8. `Move stock between locations with tracked pick, ship and receive steps` (70) — needs `FEATURE_TRANSFER_WRITES` **and** the `write_inventory_transfers` scope, which the app does not request today (`inventoryTransferCreate` requires it).

`OWNER TO FILL:` the number of feature lines the submission form accepts. If it is fewer than the lines above, keep 1, 2 and 4 first.

## 7. Pricing section

Pricing appears here only [4.2.3]. It must list every option, including trial length and how charges work [4.2.1]. Billing is Shopify App Pricing [1.2.1]: plans are set up in the Partner Dashboard and Shopify hosts the plan selection page. Plan prices are set in USD; Shopify converts for merchants billed in a local currency.

**All figures below are the current proposal** from `docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md`, which marks prices and limits as provisional (Q-007). `OWNER TO FILL:` confirm each price and limit before entering them.

Billing method: Recurring charge. Free trial: 14 days on every paid plan.

| Plan | Price (proposal) | Plan text for the listing |
|---|---|---|
| Essentials | $29 / month | 1 location · Up to 2,500 active variants · Suppliers, buying table and purchase orders · Reports with CSV export |
| Growth (recommended) | $79 / month | Up to 5 locations · Up to 15,000 active variants · Everything in Essentials |
| Pro | $149 / month | Up to 15 locations · Up to 50,000 active variants · Everything in Growth |

**Description of additional charges** (BP 3.B puts enterprise pricing here):

```
Enterprise: for more than 15 locations or 50,000 active variants, contact us for a custom plan billed through Shopify.
```

Notes for the owner:

- **Plans list limits, not different features.** The strategy puts all core workflows in every plan (§2.1). The Growth and Pro extras it describes (POS extensions, Shopify Flow, approvals, Smart Forecasting, AI credits, accounting export) are not built, so they are left out [2], [4.2.1].
- **Users per plan are left out.** The proposal caps users (3 / 10 / unlimited), but ProPo uses offline access tokens only and has no staff accounts or roles, so it cannot count or enforce users.
- **Months of reporting history are left out** until the order-history import exists (see the read_all_orders section in `PROTECTED_CUSTOMER_DATA_ANSWERS.md`).
- **Limits must be enforced before they are published.** There is no entitlement service on `main`; `app/routes/app.billing.tsx` gates only the buying table on a yes/no subscription flag.
- **Annual billing** ($290 / $790 / $1,490 a year in the proposal) is optional; Shopify App Pricing supports monthly plans with a yearly discount. Leave it out unless the owner wants it at launch.
- **Enterprise by contract** can be offered as a private plan; Shopify App Pricing allows up to eight public plans and unlimited private plans.
- `OWNER TO FILL:` link to a public pricing page, if there is one (BP 5.C, item 8).

## 8. Category and tags

The review team confirms classification [4.3.5].

- **Primary:** Orders and shipping › Inventory › **Inventory optimization** ("apps that help optimize stock and inventory levels").
- **Secondary:** Orders and shipping › Inventory › **Inventory - Other** (purchase orders, receiving and counts).
- Structured features per category: pick only those that match shipped features; up to 25 per category.

**Search terms** (up to five, complete words, one idea each, BP 5.E):

1. `purchase orders`
2. `reorder`
3. `inventory forecasting`
4. `low stock`
5. `suppliers`

Add `stocktake` or `receiving` in place of one of these only if that gated feature is switched on.

## 9. Integrations

**Leave empty.** BP 5.B.7 says not to list Shopify itself or apps ProPo does not directly connect to. ProPo connects to no other platform today. The label download is a ZPL text file that Zebra printers accept (`app/routes/app.warehouse_.labels.tsx`); that is a file format, not an integration, and it sits behind the receiving switch.

## 10. Languages

**English only.** The UI has no translation layer and every string is English [4.3.2].

## 11. Install requirements

- **Sales channel requirements:** none. Do not tick "Merchant must have online store"; ProPo adds nothing to the storefront [4.3.1].
- **Geographic requirements:** none. No feature depends on the merchant's country, currency or shipping region [4.3.8].
- **API permissions:** none beyond the standard Admin API scopes; no Shopify Plus-only API is used [4.3.8].
- **Sales channel app:** no. Submit as a regular app [4.5.2].

## 12. Links and contacts

- Privacy policy URL (required, BP 5.E): `OWNER TO FILL` — publish `PRIVACY_POLICY_DRAFT.md` after legal review.
- Developer website: `OWNER TO FILL`
- Support email: `OWNER TO FILL` (must not contain the word "Shopify", per the submission page)
- FAQ / help docs: `OWNER TO FILL` (optional; link a dedicated page, not a landing page or shared cloud document)
- Terms of service URL (optional, shown in the install modal): `OWNER TO FILL`
- App submission contact email (where review emails go): `OWNER TO FILL` — add `noreply@shopify.com` to its allowed senders.
- Demo store URL (optional, BP 5.B.2): `OWNER TO FILL` or leave empty.

App URLs and the API contact email must not contain "Shopify" or "Example" (submission page, Configuration setup). `OWNER TO FILL:` production app URL.

## 13. Visual assets

**App icon:** 1200 × 1200 px, JPEG or PNG (submission page). No Shopify bag or wordmark [4.4.3], no price [4.2.2], not just text. `OWNER TO FILL:` icon file.

**Feature media (optional):** a 1600 × 900 image with one focal point and alt text, or a 2–3 minute video with no more than 25% screen recording (BP 5.B.1). No Shopify logos, and do not repeat the subtitle in the image.

### Screenshot shot list

3–6 desktop screenshots, 1600 × 900 (16:9), each with alt text (BP 5.B.3). Capture the app UI only: crop out the browser window and the Shopify admin frame, including its logo and navigation [4.4.3], [4.4.4]. Use a development store with made-up products and suppliers; no real names, emails or phone numbers. No overlaid captions with figures, prices, ratings or quotes [4.2.2], [4.3.4], [4.3.6]. Each shot shows a different screen [4.4.5].

| # | Screen and state | Alt text |
|---|---|---|
| 1 | Buying table, one supplier selected, 8–12 rows with mixed ABC classes and non-zero To buy values | Buying table for one supplier showing stock, incoming units, daily sales rate, ABC class and suggested quantity per product |
| 2 | Purchase order detail after "Mark ordered", with freight and duties filled in and the Landed unit cost column visible | Purchase order lines with ordered and received quantities, unit cost and landed unit cost |
| 3 | Supplier detail with three SKU mappings and two volume price tiers | Supplier record with vendor SKUs, minimum order quantities, pack sizes and price breaks |
| 4 | Analytics: inventory valuation and dead stock sections | Inventory value by variant and a list of products with no recent sales |
| 5 | **Gated:** Warehouse receiving station mid-session, a few scans in "This session" | Receiving screen with a barcode field and the items scanned in this session |
| 6 | **Gated:** Stocktake with expected, counted and delta columns filled | Stock count sheet comparing expected and counted quantities |

Before capturing, fix the UI copy listed in the report (working-title heading "Inventory platform", developer notes such as `npm run worker`, the "Temporary plan hypotheses" and "Test mode" banners, and the Stocky mention on the Bundles page). They would otherwise appear in the screenshots.

## 14. Demo screencast outline

Required [4.5.3]. English narration or English subtitles. Show setup step by step and the expected result of each step (BP 5.G). Record on a development store with made-up data. Target length 6–8 minutes.

1. **Install (0:00–0:45).** Start from the install link, show the permission screen listing the scopes, approve, land in ProPo. Say that no separate account or password is needed.
2. **Choose a plan (0:45–1:30).** Show the Shopify-hosted plan page, choose Growth, approve, return to ProPo. Say the 14-day trial applies.
3. **Catalog sync (1:30–2:15).** Dashboard → "Sync catalog (bulk operation)". Show the variant count filling in.
4. **Supplier setup (2:15–3:30).** Suppliers → Add supplier. Open it, add two SKU mappings with MOQ and pack size, add one price tier.
5. **Buying table (3:30–4:45).** Pick the supplier and location, Load, explain each column, change the sales period for one product, edit one To buy value, "Create draft PO from quantities". Show the draft on the Purchase Orders page.
6. **Purchase order with landed cost (4:45–5:45).** Under "Create purchase order", choose the supplier and destination, enter freight and duties, choose the allocation method, "Create draft PO". Add two lines, "Mark ordered (locks landed costs)", show the landed unit cost column, open the "Receiver PDF".
7. **Gated — Receiving (5:45–6:30).** Warehouse → choose the PO, scan or type two barcodes, show progress, download the labels file. Then show the updated quantity in Shopify admin.
8. **Gated — Stocktake and transfer (6:30–7:15).** Start a count, enter counts, complete, show the adjustment in Shopify. Create a transfer, pick, ship, receive.
9. **Reports (7:15–7:45).** Analytics → Run ABC analysis now, show valuation and dead stock, download a CSV.
10. **Close (7:45–8:00).** Billing page shows the active plan and where to change it.

Drop steps 7 and 8 if those features are not switched on in the reviewed build, and drop them from the listing at the same time.
