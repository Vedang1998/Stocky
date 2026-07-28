import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { AbcMetric } from "@prisma/client";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  fetchInventoryLevels,
  fetchLocations,
} from "../services/shopify-gql.server";
import { computeForecast } from "../services/forecasting.server";
import { resolveTieredUnitCost } from "../services/landed-cost.server";

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
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const supplierId = url.searchParams.get("supplierId") ?? "";
  const metric: AbcMetric =
    url.searchParams.get("metric") === "VOLUME" ? "VOLUME" : "REVENUE";

  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });

  const [suppliers, locations] = await Promise.all([
    prisma.supplier.findMany({ where: { shop }, orderBy: { name: "asc" } }),
    fetchLocations(admin),
  ]);
  const locationId =
    url.searchParams.get("locationId") || locations[0]?.id || "all";

  const rows: BuyingRow[] = [];
  const supplier = suppliers.find((s) => s.id === supplierId);

  if (supplier && settings.subscriptionActive) {
    const mappings = await prisma.supplierSkuMapping.findMany({
      where: { supplierId: supplier.id },
      take: 50,
    });

    for (const mapping of mappings) {
      const [cache, abc, override, forecast] = await Promise.all([
        prisma.shopifyVariantCache.findUnique({
          where: {
            shop_shopifyVariantId: {
              shop,
              shopifyVariantId: mapping.shopifyVariantId,
            },
          },
        }),
        prisma.variantAbcClass.findUnique({
          where: {
            shop_shopifyVariantId_locationId_metric: {
              shop,
              shopifyVariantId: mapping.shopifyVariantId,
              locationId: "all",
              metric,
            },
          },
        }),
        prisma.forecastOverride.findUnique({
          where: {
            shop_variantId_locationId: {
              shop,
              variantId: mapping.shopifyVariantId,
              locationId,
            },
          },
        }),
        computeForecast({
          shop,
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
    locationId,
    metric,
    rows,
    gated: !settings.subscriptionActive,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "devActivate") {
    await prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, subscriptionActive: true, subscriptionPlan: "dev" },
      update: { subscriptionActive: true, subscriptionPlan: "dev" },
    });
    return { ok: true };
  }

  if (intent === "setLookback") {
    const variantId = form.get("variantId") as string;
    const locationId = form.get("locationId") as string;
    const start = new Date(form.get("lookbackStart") as string);
    const end = new Date(form.get("lookbackEnd") as string);

    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end) {
      await prisma.forecastOverride.upsert({
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
    const variantId = form.get("variantId") as string;
    const locationId = form.get("locationId") as string;
    await prisma.forecastOverride.deleteMany({
      where: { shop, variantId, locationId },
    });
    return { ok: true };
  }

  if (intent === "createPO") {
    const supplierId = form.get("supplierId") as string;
    const locationId = form.get("locationId") as string;

    const lines: Array<{
      variantId: string;
      vendorSku: string | null;
      qty: number;
      unitCost: number;
    }> = [];

    for (const [key, value] of form.entries()) {
      if (!key.startsWith("qty-")) continue;
      const mappingId = key.slice(4);
      let qty = parseInt(value as string, 10);
      if (!qty || qty <= 0) continue;

      const mapping = await prisma.supplierSkuMapping.findUnique({
        where: { id: mappingId },
      });
      if (!mapping) continue;

      // Enforce MOQ and inner-carton pack sizes from the Supplier Master.
      qty = Math.max(qty, mapping.moq);
      qty = Math.ceil(qty / mapping.packSize) * mapping.packSize;

      const tierCost = await resolveTieredUnitCost(
        supplierId,
        mapping.shopifyVariantId,
        qty,
      );

      lines.push({
        variantId: mapping.shopifyVariantId,
        vendorSku: mapping.vendorSku,
        qty,
        unitCost: Number(tierCost ?? 0),
      });
    }

    if (lines.length > 0) {
      await prisma.purchaseOrder.create({
        data: {
          shop,
          supplierId,
          locationId,
          status: "DRAFT",
          draftedAt: new Date(),
          lineItems: {
            create: lines.map((l) => ({
              shopifyVariantId: l.variantId,
              vendorSku: l.vendorSku,
              orderedQty: l.qty,
              unitCost: l.unitCost,
            })),
          },
        },
      });
      return redirect("/app/purchase-orders");
    }
    return { ok: false };
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
    locationId,
    metric,
    rows,
    gated,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [lookbackFor, setLookbackFor] = useState<BuyingRow | null>(null);

  if (gated) {
    return (
      <s-page heading="Buying Table">
        <s-section heading="Premium feature">
          <s-banner tone="info" heading="The Buying Table requires a subscription">
            <s-paragraph>
              AI-driven demand planning, ABC analysis, and one-click PO
              generation are part of the paid plan.
            </s-paragraph>
          </s-banner>
          <s-stack direction="inline" gap="base">
            <s-button href="/app/billing" variant="primary">
              View plans
            </s-button>
            <Form method="post">
              <input type="hidden" name="intent" value="devActivate" />
              <s-button type="submit" variant="tertiary">
                Activate (development mode)
              </s-button>
            </Form>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Buying Table">
      <s-section heading="Filters">
        <Form method="get">
          <s-stack direction="inline" gap="base">
            <s-select label="Vendor" name="supplierId" value={supplierId}>
              <s-option value="">Select a vendor</s-option>
              {suppliers.map((s) => (
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

      {supplierId && rows.length === 0 && (
        <s-section>
          <s-banner tone="warning" heading="No SKU mappings for this vendor">
            <s-paragraph>
              Map Shopify variants to vendor SKUs on the{" "}
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
            <s-stack direction="block" gap="base">
              <s-table>
                <s-table-header-row>
                  <s-table-header>Product</s-table-header>
                  <s-table-header>ABC</s-table-header>
                  <s-table-header format="numeric">Current</s-table-header>
                  <s-table-header format="numeric">Incoming</s-table-header>
                  <s-table-header format="numeric">Velocity/day</s-table-header>
                  <s-table-header format="numeric">Reorder pt</s-table-header>
                  <s-table-header>To buy</s-table-header>
                  <s-table-header>Lookback</s-table-header>
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
        <s-section heading={`Custom lookback — ${lookbackFor.title}`}>
          <s-paragraph>
            Override the global lookback window for this SKU only. Velocity
            will be computed across this date range (out-of-stock days still
            excluded).
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
                Reset to global default
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
