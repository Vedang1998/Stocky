/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import { createHash } from "node:crypto";
import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { AbcMetric, SupplierSkuMapping } from "@prisma/client";
import { ActionFeedback } from "../components/ActionFeedback";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { requireActivePlanSnapshot } from "../billing/entitlements.server";
import {
  fetchInventoryLevels,
  fetchLocations,
} from "../services/shopify-gql.server";
import { applySupplierRules } from "../lib/replenishment";
import { computeForecast } from "../services/forecasting.server";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { PurchasingError } from "../services/purchasing/errors";
import {
  createPurchaseOrderDraft,
  MAX_LINES_PER_ORDER,
  MAX_ORDER_QUANTITY,
} from "../services/purchasing/purchase-orders.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";

/**
 * Value of the "Select a vendor" option. An `s-select` submits the option's
 * label when its value is empty, so the placeholder needs a value of its own.
 */
const NO_VENDOR = "none";

interface BuyingRow {
  mappingId: string;
  variantId: string;
  vendorSku: string;
  moq: number;
  packSize: number;
  title: string;
  imageUrl: string | null;
  abcClass: "A" | "B" | "C" | null;
  currentStock: number;
  incoming: number;
  velocity: number;
  outOfStockDays: number;
  reorderPoint: number;
  suggestedToBuy: number;
  hasOverride: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, tenant, db } = await requireAdminTenant({ request });
  const shop = tenant.myshopifyDomain;
  const url = new URL(request.url);
  const requestedSupplierId = url.searchParams.get("supplierId") ?? "";
  const metric: AbcMetric =
    url.searchParams.get("metric") === "VOLUME" ? "VOLUME" : "REVENUE";

  const settings = await db.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });

  const [suppliers, locations] = await Promise.all([
    db.supplier.findMany({ where: {}, orderBy: { name: "asc" } }),
    fetchLocations(admin),
  ]);
  const locationId =
    url.searchParams.get("locationId") || locations[0]?.id || "all";

  const rows: BuyingRow[] = [];
  const supplier = suppliers.find((s: any) => s.id === requestedSupplierId);
  const supplierId: string = supplier?.id ?? "";
  const supplierNotFound =
    !supplier && requestedSupplierId !== "" && requestedSupplierId !== NO_VENDOR;

  if (supplier && settings.subscriptionActive) {
    const mappings = await db.supplierSkuMapping.findMany({
      where: { supplierId: supplier.id },
      take: 50,
    });

    for (const mapping of mappings) {
      const [cache, abc, override, forecast] = await Promise.all([
        db.shopifyVariantCache.findUnique({
          where: {
            shop_shopifyVariantId: {
              shop,
              shopifyVariantId: mapping.shopifyVariantId,
            },
          },
        }),
        db.variantAbcClass.findUnique({
          where: {
            shop_shopifyVariantId_locationId_metric: {
              shop,
              shopifyVariantId: mapping.shopifyVariantId,
              locationId: "all",
              metric,
            },
          },
        }),
        db.forecastOverride.findUnique({
          where: {
            shop_variantId_locationId: {
              shop,
              variantId: mapping.shopifyVariantId,
              locationId,
            },
          },
        }),
        computeForecast(db, {
          variantId: mapping.shopifyVariantId,
          locationId,
          leadTimeDays: supplier.leadTimeDays ?? undefined,
        }),
      ]);

      // Prefer a live Shopify inventory read over the local snapshot when possible.
      let currentStock = forecast.onHand;
      if (cache?.inventoryItemId) {
        try {
          currentStock = await fetchInventoryLevels(
            admin,
            cache.inventoryItemId,
            locationId,
          );
        } catch {
          // Fall back to the snapshot value on API errors.
        }
      }

      rows.push({
        mappingId: mapping.id,
        variantId: mapping.shopifyVariantId,
        vendorSku: mapping.vendorSku,
        moq: mapping.moq,
        packSize: mapping.packSize,
        title: cache?.title ?? mapping.shopifyVariantId,
        imageUrl: cache?.imageUrl ?? null,
        abcClass: abc?.abcClass ?? null,
        currentStock,
        incoming: forecast.incoming,
        velocity: forecast.dailySalesVelocity,
        outOfStockDays: forecast.outOfStockDays,
        reorderPoint: forecast.reorderPoint,
        suggestedToBuy: forecast.toBuy,
        hasOverride: Boolean(override),
      });
    }
  }

  return {
    suppliers,
    locations,
    supplierId,
    supplierNotFound,
    locationId,
    metric,
    rows,
    gated: !settings.subscriptionActive,
    // The page's part of the key that lets a second press of Create open the same draft.
    creationKey: crypto.randomUUID(),
    allowDevActivate:
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEV_SUBSCRIPTION_ACTIVATE === "true",
  };
};

const LOOKBACK_TARGET_MISSING =
  "Choose a product and a location before changing its sales period.";
const ORDER_TARGET_MISSING =
  "Choose a supplier and a location before creating a purchase order.";
const ORDER_NOTHING_TO_ORDER =
  "None of these products are set up for this supplier any more. Refresh the page and try again.";
const ORDER_TOO_MANY_LINES = `A purchase order can have at most ${MAX_LINES_PER_ORDER} lines.`;
const ORDER_QUANTITY_TOO_LARGE = `A quantity can be at most ${MAX_ORDER_QUANTITY.toLocaleString("en-US")}.`;
const MAX_ID_LENGTH = 256;

/** An id the page sent as a hidden field: present, and no longer than an id is. */
function usableId(value: FormDataEntryValue | null): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

const PAGE_KEY_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * The key that makes a second press of Create open the same draft: the
 * rendered page's key plus exactly what is on the order. Pressing Create
 * again on the same page with the same lines finds the draft already made;
 * changed quantities, or a fresh page, make a new one. Without the page's
 * key there is no key, and every press creates an order.
 */
function orderCreationKey(
  pageKey: FormDataEntryValue | null,
  supplierId: string,
  locationGid: string,
  lines: ReadonlyArray<{ variantGid: string; quantity: number }>,
): string | null {
  if (typeof pageKey !== "string" || !PAGE_KEY_PATTERN.test(pageKey)) return null;
  // Merged by variant and sorted, as the service merges them, so the same
  // order sent with its fields in another order or split finds the same draft.
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.variantGid, (totals.get(line.variantGid) ?? 0) + line.quantity);
  }
  const digest = createHash("sha256").update(`${supplierId};${locationGid};`);
  for (const gid of [...totals.keys()].sort()) digest.update(`${gid}=${totals.get(gid)};`);
  return `buying-table:${pageKey}:${digest.digest("hex").slice(0, 32)}`;
}

/**
 * The product and location a lookback change applies to. The page sends both
 * as hidden fields; a request built by hand can leave them out, and a missing
 * one must be refused here instead of reaching the database as null.
 */
function lookbackTarget(
  form: FormData,
): { variantId: string; locationId: string } | null {
  const variantId = form.get("variantId");
  const locationId = form.get("locationId");
  return usableId(variantId) && usableId(locationId)
    ? { variantId, locationId }
    : null;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // The signed-in staff member is recorded on the orders this page creates.
  const { admin, tenant, db, actor } = await requirePurchasingContext({
    request,
  });
  const shop = tenant.myshopifyDomain;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "devActivate") {
    // Premature Boolean gate + unprotected bypass is not a commercial entitlement
    // system (see docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md).
    const allow =
      process.env.ALLOW_DEV_SUBSCRIPTION_ACTIVATE === "true" &&
      process.env.NODE_ENV !== "production";
    if (!allow) {
      return {
        error: "This action isn't available.",
      };
    }
    await db.shopSettings.upsert({
      where: { shop },
      create: { shop, subscriptionActive: true, subscriptionPlan: "dev" },
      update: { subscriptionActive: true, subscriptionPlan: "dev" },
    });
    return { ok: true };
  }

  await requireActivePlanSnapshot(db);

  if (intent === "setLookback") {
    const target = lookbackTarget(form);
    if (!target) return { error: LOOKBACK_TARGET_MISSING };
    const { variantId, locationId } = target;
    const start = new Date(form.get("lookbackStart") as string);
    const end = new Date(form.get("lookbackEnd") as string);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end) {
      await db.forecastOverride.upsert({
        where: { shop_variantId_locationId: { shop, variantId, locationId } },
        create: {
          shop,
          variantId,
          locationId,
          lookbackStart: start,
          lookbackEnd: end,
        },
        update: { lookbackStart: start, lookbackEnd: end },
      });
    }
    return { ok: true };
  }

  if (intent === "clearLookback") {
    const target = lookbackTarget(form);
    if (!target) return { error: LOOKBACK_TARGET_MISSING };
    const { variantId, locationId } = target;
    await db.forecastOverride.deleteMany({
      where: { variantId, locationId },
    });
    return { ok: true };
  }

  if (intent === "createPO") {
    // The order is created by the purchasing service, as every other order
    // is: it numbers the order, prices each line from the supplier's terms,
    // records who created it and checks the supplier, location and products.
    // The checks here only bound the request before anything is read.
    const supplierId = form.get("supplierId");
    const locationId = form.get("locationId");
    if (!usableId(supplierId) || !usableId(locationId)) {
      return { intent, error: ORDER_TARGET_MISSING };
    }
    const entries = [...form.entries()].filter(([key]) =>
      key.startsWith("qty-"),
    );
    if (entries.length > MAX_LINES_PER_ORDER) {
      return { intent, error: ORDER_TOO_MANY_LINES };
    }

    // Supplier minimums and pack sizes apply only when the merchant ticks them.
    const supplierRules = {
      applyMinimumOrderQuantity: form.get("applyMinimumOrderQuantity") === "on",
      roundUpToPackSize: form.get("roundUpToPackSize") === "on",
    };

    const entered = entries
      .map(([key, value]) => ({
        mappingId: key.slice(4),
        quantity: parseInt(String(value), 10),
      }))
      .filter(({ quantity }) => quantity > 0);
    if (entered.length === 0) return { ok: false };

    const found: SupplierSkuMapping[] = await db.supplierSkuMapping.findMany({
      where: {
        id: { in: entered.map(({ mappingId }) => mappingId) },
        supplierId,
      },
    });
    const mappings = new Map(found.map((mapping) => [mapping.id, mapping]));

    const lines: Array<{ variantGid: string; quantity: number }> = [];
    for (const { mappingId, quantity: requested } of entered) {
      const mapping = mappings.get(mappingId);
      if (!mapping) continue;
      const { quantity } = applySupplierRules(
        requested,
        { minimumOrderQuantity: mapping.moq, packSize: mapping.packSize },
        supplierRules,
      );
      if (quantity > MAX_ORDER_QUANTITY) {
        return { intent, error: ORDER_QUANTITY_TOO_LARGE };
      }
      lines.push({ variantGid: mapping.shopifyVariantId, quantity });
    }
    if (lines.length === 0) return { intent, error: ORDER_NOTHING_TO_ORDER };

    try {
      // The shop's date only sets the expected date from the supplier's lead
      // time; if Shopify cannot be reached the date is left for the merchant.
      const today = await readShopProfile(admin).then(
        (profile) => profile.today,
        () => null,
      );
      const draft = await createPurchaseOrderDraft(
        db,
        actor,
        {
          supplierId,
          locationGid: locationId,
          lines,
          creationKey: orderCreationKey(
            form.get("creationKey"),
            supplierId,
            locationId,
            lines,
          ),
          source: "replenishment",
        },
        { admin, today },
      );
      return redirect(`/app/purchase-orders/${draft.id}`);
    } catch (error) {
      if (error instanceof PurchasingError) return { intent, error: error.message };
      throw error;
    }
  }

  return { ok: false };
};

const ABC_TONE = {
  A: "success",
  B: "info",
  C: "neutral",
} as const;

export default function BuyingTable() {
  const {
    suppliers,
    locations,
    supplierId,
    supplierNotFound,
    locationId,
    metric,
    rows,
    gated,
    creationKey,
    allowDevActivate,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [lookbackFor, setLookbackFor] = useState<BuyingRow | null>(null);

  if (gated) {
    return (
      <s-page heading="Buying Table">
        <s-section heading="Choose a plan">
          <s-banner tone="info" heading="The Buying Table needs an active plan">
            <s-paragraph>
              Reorder suggestions, ABC analysis and purchase order creation
              are included in every plan. Choose a plan to start using them.
            </s-paragraph>
          </s-banner>
          <s-stack direction="inline" gap="base">
            <s-button href="/app/billing" variant="primary">
              View plans
            </s-button>
            {allowDevActivate && (
              <Form method="post">
                <input type="hidden" name="intent" value="devActivate" />
                <s-button type="submit" variant="tertiary">
                  Activate (dev only)
                </s-button>
              </Form>
            )}
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Buying Table">
      <ActionFeedback
        data={actionData}
        errorHeading={
          actionData && "intent" in actionData && actionData.intent === "createPO"
            ? "Purchase order not created"
            : "Not saved"
        }
      />
      <s-section heading="Filters">
        <Form method="get">
          <s-stack direction="inline" gap="base">
            <s-select label="Vendor" name="supplierId" value={supplierId || NO_VENDOR}>
              <s-option value={NO_VENDOR}>Select a vendor</s-option>
              {suppliers.map((s: any) => (
                <s-option key={s.id} value={s.id}>
                  {s.name}
                </s-option>
              ))}
            </s-select>
            <s-select label="Location" name="locationId" value={locationId}>
              {locations.map((l) => (
                <s-option key={l.id} value={l.id}>
                  {l.name}
                </s-option>
              ))}
            </s-select>
            <s-select label="ABC by" name="metric" value={metric}>
              <s-option value="REVENUE">Revenue</s-option>
              <s-option value="VOLUME">Volume</s-option>
            </s-select>
            <s-button type="submit" variant="secondary">
              Load
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      {supplierNotFound && (
        <s-section>
          <s-banner tone="warning" heading="Vendor not found">
            <s-paragraph>
              That vendor is not on your vendor list. Choose a vendor and load
              the table again.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {supplierId && rows.length === 0 && (
        <s-section>
          <s-banner tone="warning" heading="No products linked to this supplier">
            <s-paragraph>
              Link products to this supplier&apos;s SKUs on the{" "}
              <s-link href={`/app/suppliers/${supplierId}`}>
                supplier detail page
              </s-link>{" "}
              to populate the Buying Table.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {rows.length > 0 && (
        <s-section heading="Suggested order">
          <Form method="post">
            <input type="hidden" name="intent" value="createPO" />
            <input type="hidden" name="supplierId" value={supplierId} />
            <input type="hidden" name="locationId" value={locationId} />
            <input type="hidden" name="creationKey" value={creationKey} />
            <s-stack direction="block" gap="base">
              <s-table>
                <s-table-header-row>
                  <s-table-header>Product</s-table-header>
                  <s-table-header>ABC</s-table-header>
                  <s-table-header format="numeric">Current</s-table-header>
                  <s-table-header format="numeric">Incoming</s-table-header>
                  <s-table-header format="numeric">Sales per day</s-table-header>
                  <s-table-header format="numeric">Reorder pt</s-table-header>
                  <s-table-header>To buy</s-table-header>
                  <s-table-header>Sales period</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {rows.map((row) => (
                    <s-table-row key={row.mappingId}>
                      <s-table-cell>
                        <s-stack direction="inline" gap="small">
                          {row.imageUrl ? (
                            <s-thumbnail
                              src={row.imageUrl}
                              alt={row.title}
                              size="small"
                            />
                          ) : null}
                          <s-stack direction="block" gap="small-300">
                            <s-text>{row.title}</s-text>
                            <s-text color="subdued">{row.vendorSku}</s-text>
                          </s-stack>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        {row.abcClass ? (
                          <s-badge tone={ABC_TONE[row.abcClass]}>
                            {row.abcClass}
                          </s-badge>
                        ) : (
                          <s-text color="subdued">—</s-text>
                        )}
                      </s-table-cell>
                      <s-table-cell>{row.currentStock}</s-table-cell>
                      <s-table-cell>{row.incoming}</s-table-cell>
                      <s-table-cell>
                        {row.velocity.toFixed(2)}
                        {row.outOfStockDays > 0
                          ? ` (${row.outOfStockDays} OOS days excluded)`
                          : ""}
                      </s-table-cell>
                      <s-table-cell>{row.reorderPoint}</s-table-cell>
                      <s-table-cell>
                        <s-stack direction="block" gap="small-300">
                          <s-number-field
                            label="To buy"
                            labelAccessibilityVisibility="exclusive"
                            name={`qty-${row.mappingId}`}
                            value={String(row.suggestedToBuy)}
                            min={0}
                          />
                          <s-text color="subdued">
                            MOQ {row.moq} · Pack {row.packSize}
                          </s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <s-button
                          variant="tertiary"
                          onClick={() => setLookbackFor(row)}
                        >
                          {row.hasOverride ? "Custom ✓" : "Default"}
                        </s-button>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
              <s-stack direction="block" gap="small-300">
                <s-checkbox
                  name="applyMinimumOrderQuantity"
                  value="on"
                  label="Raise quantities to the supplier's minimum order"
                />
                <s-checkbox
                  name="roundUpToPackSize"
                  value="on"
                  label="Round quantities up to full packs"
                />
                <s-text color="subdued">
                  Leave both unticked to order exactly the quantities entered.
                </s-text>
              </s-stack>
              <s-button
                type="submit"
                variant="primary"
                {...(navigation.state === "submitting" ? { loading: true } : {})}
              >
                Create draft PO from quantities
              </s-button>
            </s-stack>
          </Form>
        </s-section>
      )}

      {lookbackFor && (
        <s-section heading={`Sales period — ${lookbackFor.title}`}>
          <s-paragraph>
            Use a different sales period for this product only. Its sales
            rate is worked out over these dates, leaving out days it was out
            of stock.
          </s-paragraph>
          <Form method="post" onSubmit={() => setLookbackFor(null)}>
            <input type="hidden" name="intent" value="setLookback" />
            <input type="hidden" name="variantId" value={lookbackFor.variantId} />
            <input type="hidden" name="locationId" value={locationId} />
            <s-stack direction="inline" gap="base">
              <s-date-field label="Start" name="lookbackStart" required />
              <s-date-field label="End" name="lookbackEnd" required />
              <s-button type="submit" variant="primary">
                Save
              </s-button>
            </s-stack>
          </Form>
          <s-stack direction="inline" gap="base">
            <Form method="post" onSubmit={() => setLookbackFor(null)}>
              <input type="hidden" name="intent" value="clearLookback" />
              <input type="hidden" name="variantId" value={lookbackFor.variantId} />
              <input type="hidden" name="locationId" value={locationId} />
              <s-button type="submit" variant="tertiary">
                Use the shop&apos;s default period
              </s-button>
            </Form>
            <s-button variant="tertiary" onClick={() => setLookbackFor(null)}>
              Close
            </s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
