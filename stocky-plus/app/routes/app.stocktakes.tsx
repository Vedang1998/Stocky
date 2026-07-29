import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { assertInventoryWriteEnabled } from "../lib/feature-flags.server";
import { fetchLocations } from "../services/shopify-gql.server";
import { adjustShopifyInventory } from "../services/shopify-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [stocktakes, locations, variants] = await Promise.all([
    prisma.stocktake.findMany({
      where: { shop: session.shop },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    fetchLocations(admin),
    prisma.shopifyVariantCache.findMany({
      where: { shop: session.shop },
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);
  return { stocktakes, locations, variants };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "create") {
    const locationId = form.get("locationId") as string;

    // Freeze expected quantities from the latest inventory snapshots.
    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { shop, locationId },
      orderBy: { snapshotDate: "desc" },
      distinct: ["shopifyVariantId"],
    });

    await prisma.stocktake.create({
      data: {
        shop,
        locationId,
        name: (form.get("name") as string) || `Count ${new Date().toLocaleDateString()}`,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        lineItems: {
          create: snapshots.map((s) => ({
            shopifyVariantId: s.shopifyVariantId,
            expectedQty: s.quantityAvailable,
          })),
        },
      },
    });
    return { ok: true };
  }

  if (intent === "addItem") {
    const stocktakeId = form.get("stocktakeId") as string;
    const variantId = form.get("variantId") as string;
    const stocktake = await prisma.stocktake.findFirst({
      where: { id: stocktakeId, shop },
    });
    if (!stocktake) return { error: "Stocktake not found" };

    const existing = await prisma.stocktakeLineItem.findFirst({
      where: { stocktakeId: stocktake.id, shopifyVariantId: variantId },
    });
    if (!existing) {
      const snapshot = await prisma.inventorySnapshot.findFirst({
        where: { shop, shopifyVariantId: variantId },
        orderBy: { snapshotDate: "desc" },
      });
      await prisma.stocktakeLineItem.create({
        data: {
          stocktakeId: stocktake.id,
          shopifyVariantId: variantId,
          expectedQty: snapshot?.quantityAvailable ?? 0,
        },
      });
    }
    return { ok: true };
  }

  if (intent === "count") {
    const lineId = form.get("lineId") as string;
    const line = await prisma.stocktakeLineItem.findFirst({
      where: { id: lineId, stocktake: { shop } },
    });
    if (!line) return { error: "Stocktake line not found" };

    await prisma.stocktakeLineItem.update({
      where: { id: line.id },
      data: { countedQty: parseInt(form.get("countedQty") as string, 10) },
    });
    return { ok: true };
  }

  if (intent === "complete") {
    try {
      assertInventoryWriteEnabled("stocktakeInventoryWrites");
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Stocktake inventory writes disabled",
      };
    }

    const stocktakeId = form.get("stocktakeId") as string;
    const stocktake = await prisma.stocktake.findFirst({
      where: { id: stocktakeId, shop },
      include: { lineItems: true },
    });
    if (!stocktake) return { error: "Stocktake not found" };

    const failures: string[] = [];
    for (const line of stocktake.lineItems) {
      if (line.countedQty === null) continue;
      const delta = line.countedQty - line.expectedQty;
      if (delta === 0) continue;

      const cache = await prisma.shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop,
            shopifyVariantId: line.shopifyVariantId,
          },
        },
      });
      if (!cache?.inventoryItemId) {
        failures.push(cache?.title ?? line.shopifyVariantId);
        continue;
      }

      try {
        // Push only the delta so concurrent sales are not overwritten.
        await adjustShopifyInventory(
          admin,
          cache.inventoryItemId,
          stocktake.locationId,
          delta,
          "cycle_count_available",
        );
      } catch {
        failures.push(cache.title);
      }
    }

    // Inventory-write contract: never mark complete when Shopify writes failed.
    if (failures.length > 0) {
      return {
        error: `Stocktake left IN_PROGRESS — Shopify adjust failed for: ${failures.join(", ")}`,
      };
    }

    await prisma.stocktake.update({
      where: { id: stocktakeId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return { ok: true };
  }

  return { ok: false };
};

export default function Stocktakes() {
  const { stocktakes, locations, variants } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;
  const variantTitle = (id: string) =>
    variants.find((v) => v.shopifyVariantId === id)?.title ?? id;

  return (
    <s-page heading="Stocktakes (Cycle Counts)">
      {actionData && "error" in actionData && actionData.error && (
        <s-banner tone="critical" heading="Stocktake issue">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Start a count">
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-stack direction="inline" gap="base">
            <s-text-field label="Name" name="name" placeholder="Monthly count" />
            <s-select label="Location" name="locationId" required>
              {locations.map((l) => (
                <s-option key={l.id} value={l.id}>
                  {l.name}
                </s-option>
              ))}
            </s-select>
            <s-button type="submit" variant="primary">
              Freeze expected & start
            </s-button>
          </s-stack>
        </Form>
        <s-paragraph>
          <s-text color="subdued">
            Expected quantities freeze from the latest inventory snapshots at
            the selected location.
          </s-text>
        </s-paragraph>
      </s-section>

      {stocktakes.map((st) => (
        <s-section
          key={st.id}
          heading={`${st.name} — ${locationName(st.locationId)}`}
        >
          <s-stack direction="block" gap="base">
            <s-badge
              tone={
                st.status === "COMPLETED"
                  ? "success"
                  : st.status === "IN_PROGRESS"
                    ? "warning"
                    : "neutral"
              }
            >
              {st.status.replace("_", " ")}
            </s-badge>

            {st.status === "IN_PROGRESS" && (
              <Form method="post">
                <input type="hidden" name="intent" value="addItem" />
                <input type="hidden" name="stocktakeId" value={st.id} />
                <s-stack direction="inline" gap="base">
                  <s-select label="Add variant to sheet" name="variantId">
                    {variants.map((v) => (
                      <s-option
                        key={v.shopifyVariantId}
                        value={v.shopifyVariantId}
                      >
                        {v.title}
                      </s-option>
                    ))}
                  </s-select>
                  <s-button type="submit" variant="secondary">
                    Add
                  </s-button>
                </s-stack>
              </Form>
            )}

            {st.lineItems.length > 0 && (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Variant</s-table-header>
                  <s-table-header format="numeric">Expected</s-table-header>
                  <s-table-header format="numeric">Counted</s-table-header>
                  <s-table-header format="numeric">Delta</s-table-header>
                  <s-table-header>Entry</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {st.lineItems.map((line) => (
                    <s-table-row key={line.id}>
                      <s-table-cell>
                        {variantTitle(line.shopifyVariantId)}
                      </s-table-cell>
                      <s-table-cell>{line.expectedQty}</s-table-cell>
                      <s-table-cell>{line.countedQty ?? "—"}</s-table-cell>
                      <s-table-cell>
                        {line.countedQty !== null
                          ? line.countedQty - line.expectedQty
                          : "—"}
                      </s-table-cell>
                      <s-table-cell>
                        {st.status === "IN_PROGRESS" && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="count" />
                            <input type="hidden" name="lineId" value={line.id} />
                            <s-stack direction="inline" gap="small-200">
                              <s-number-field
                                label="Counted qty"
                                labelAccessibilityVisibility="exclusive"
                                name="countedQty"
                                value={
                                  line.countedQty !== null
                                    ? String(line.countedQty)
                                    : ""
                                }
                                min={0}
                              />
                              <s-button type="submit" variant="secondary">
                                Save
                              </s-button>
                            </s-stack>
                          </Form>
                        )}
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            )}

            {st.status === "IN_PROGRESS" && (
              <Form method="post">
                <input type="hidden" name="intent" value="complete" />
                <input type="hidden" name="stocktakeId" value={st.id} />
                <s-button type="submit" variant="primary">
                  Complete — push deltas to Shopify
                </s-button>
              </Form>
            )}
          </s-stack>
        </s-section>
      ))}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
