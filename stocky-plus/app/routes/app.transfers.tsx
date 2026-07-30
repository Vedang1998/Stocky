import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { fetchLocations } from "../services/shopify-gql.server";
import { assertInventoryWriteEnabled } from "../lib/feature-flags.server";
import {
  completeShopifyTransfer,
  createShopifyTransfer,
  markShopifyTransferReadyToShip,
} from "../services/shopify-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [transfers, locations, variants] = await Promise.all([
    prisma.transferOrder.findMany({
      where: { shop: session.shop },
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    fetchLocations(admin),
    prisma.shopifyVariantCache.findMany({
      where: { shop: session.shop },
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);
  return { transfers, locations, variants };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "create") {
    const source = form.get("sourceLocationId") as string;
    const destination = form.get("destinationLocationId") as string;
    if (source === destination) {
      return { error: "Source and destination must differ" };
    }
    await prisma.transferOrder.create({
      data: {
        shop,
        sourceLocationId: source,
        destinationLocationId: destination,
        notes: (form.get("notes") as string) || null,
        status: "DRAFT",
      },
    });
    return { ok: true };
  }

  if (intent === "addLine") {
    const transferId = form.get("transferId") as string;
    const transfer = await prisma.transferOrder.findFirst({
      where: { id: transferId, shop },
    });
    if (!transfer) return { error: "Transfer not found" };

    await prisma.transferLineItem.create({
      data: {
        transferOrderId: transfer.id,
        shopifyVariantId: form.get("variantId") as string,
        quantity: parseInt(form.get("quantity") as string, 10),
      },
    });
    return { ok: true };
  }

  if (intent === "pick") {
    const lineId = form.get("lineId") as string;
    const qty = parseInt(form.get("pickedQty") as string, 10);
    const line = await prisma.transferLineItem.findFirst({
      where: { id: lineId, transferOrder: { shop } },
    });
    if (!line) return { error: "Transfer line not found" };

    await prisma.transferLineItem.update({
      where: { id: line.id },
      data: { pickedQty: qty },
    });
    return { ok: true };
  }

  if (intent === "ship") {
    try {
      assertInventoryWriteEnabled("transferWrites");
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Transfer writes disabled",
      };
    }

    const transferId = form.get("transferId") as string;
    const transfer = await prisma.transferOrder.findFirst({
      where: { id: transferId, shop },
      include: { lineItems: true },
    });
    if (!transfer || transfer.lineItems.length === 0) {
      return { error: "Transfer has no line items" };
    }

    // Resolve inventoryItemIds from the variant cache for the Shopify mutation.
    const lineInputs: Array<{ inventoryItemId: string; quantity: number }> = [];
    for (const line of transfer.lineItems) {
      const cache = await prisma.shopifyVariantCache.findUnique({
        where: {
          shop_shopifyVariantId: {
            shop,
            shopifyVariantId: line.shopifyVariantId,
          },
        },
      });
      if (!cache?.inventoryItemId) {
        return {
          error: `No inventory item cached for ${cache?.title ?? line.shopifyVariantId}. Run a catalog sync from the dashboard first.`,
        };
      }
      lineInputs.push({
        inventoryItemId: cache.inventoryItemId,
        quantity: line.pickedQty > 0 ? line.pickedQty : line.quantity,
      });
    }

    try {
      const shopifyTransfer = await createShopifyTransfer(
        admin,
        transfer.sourceLocationId,
        transfer.destinationLocationId,
        lineInputs,
      );
      if (shopifyTransfer) {
        await markShopifyTransferReadyToShip(admin, shopifyTransfer.id);
        await prisma.transferOrder.update({
          where: { id: transferId },
          data: {
            status: "IN_TRANSIT",
            shopifyTransferId: shopifyTransfer.id,
            shippedAt: new Date(),
          },
        });
      }
      return { ok: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Transfer failed" };
    }
  }

  if (intent === "receive") {
    try {
      assertInventoryWriteEnabled("transferWrites");
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Transfer writes disabled",
      };
    }

    const transferId = form.get("transferId") as string;
    const transfer = await prisma.transferOrder.findFirst({
      where: { id: transferId, shop },
      include: { lineItems: true },
    });
    if (!transfer) return { error: "Transfer not found" };

    try {
      // Shopify-authoritative completion is required before any local receipt
      // mutation (receivedQty / RECEIVED / receivedAt). Admin API 2025-10 has
      // no supported complete/receive mutation — completeShopifyTransfer always
      // throws UnsupportedShopifyOperationError. Call it whether or not
      // shopifyTransferId is present so missing IDs cannot skip the guard and
      // mark the transfer received locally. Do not invent a Shopify mutation.
      await completeShopifyTransfer(
        admin,
        transfer.shopifyTransferId ?? "missing-shopify-transfer-id",
      );

      await prisma.$transaction([
        ...transfer.lineItems.map((line) =>
          prisma.transferLineItem.update({
            where: { id: line.id },
            data: {
              receivedQty: line.pickedQty > 0 ? line.pickedQty : line.quantity,
            },
          }),
        ),
        prisma.transferOrder.update({
          where: { id: transferId },
          data: { status: "RECEIVED", receivedAt: new Date() },
        }),
      ]);
      return { ok: true };
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Receive failed",
      };
    }
  }

  if (intent === "cancel") {
    await prisma.transferOrder.updateMany({
      where: { id: form.get("transferId") as string, shop, status: "DRAFT" },
      data: { status: "CANCELLED" },
    });
    return { ok: true };
  }

  return { ok: false };
};

const STATUS_TONE: Record<string, "info" | "warning" | "success" | "critical"> = {
  DRAFT: "info",
  IN_TRANSIT: "warning",
  RECEIVED: "success",
  CANCELLED: "critical",
};

export default function Transfers() {
  const { transfers, locations, variants } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;
  const variantTitle = (id: string) =>
    variants.find((v) => v.shopifyVariantId === id)?.title ?? id;

  return (
    <s-page heading="Transfer Orders">
      <s-section heading="New transfer">
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-stack direction="inline" gap="base">
            <s-select label="Source location" name="sourceLocationId" required>
              {locations.map((l) => (
                <s-option key={l.id} value={l.id}>
                  {l.name}
                </s-option>
              ))}
            </s-select>
            <s-select
              label="Destination location"
              name="destinationLocationId"
              required
            >
              {locations.map((l) => (
                <s-option key={l.id} value={l.id}>
                  {l.name}
                </s-option>
              ))}
            </s-select>
            <s-text-field label="Notes" name="notes" />
            <s-button
              type="submit"
              variant="primary"
              {...(navigation.state === "submitting" ? { loading: true } : {})}
            >
              Create draft
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      {transfers.map((transfer) => (
        <s-section
          key={transfer.id}
          heading={`${locationName(transfer.sourceLocationId)} → ${locationName(transfer.destinationLocationId)}`}
        >
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-badge tone={STATUS_TONE[transfer.status] ?? "neutral"}>
                {transfer.status.replace("_", " ")}
              </s-badge>
              {transfer.notes && <s-text color="subdued">{transfer.notes}</s-text>}
            </s-stack>

            {transfer.lineItems.length > 0 && (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Variant</s-table-header>
                  <s-table-header format="numeric">Requested</s-table-header>
                  <s-table-header format="numeric">Picked</s-table-header>
                  <s-table-header format="numeric">Received</s-table-header>
                  <s-table-header>Picking</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {transfer.lineItems.map((line) => (
                    <s-table-row key={line.id}>
                      <s-table-cell>
                        {variantTitle(line.shopifyVariantId)}
                      </s-table-cell>
                      <s-table-cell>{line.quantity}</s-table-cell>
                      <s-table-cell>{line.pickedQty}</s-table-cell>
                      <s-table-cell>{line.receivedQty}</s-table-cell>
                      <s-table-cell>
                        {transfer.status === "DRAFT" && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="pick" />
                            <input type="hidden" name="lineId" value={line.id} />
                            <s-stack direction="inline" gap="small-200">
                              <s-number-field
                                label="Picked qty"
                                labelAccessibilityVisibility="exclusive"
                                name="pickedQty"
                                value={String(line.quantity)}
                                min={0}
                                max={line.quantity}
                              />
                              <s-button type="submit" variant="secondary">
                                Pick
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

            {transfer.status === "DRAFT" && (
              <Form method="post">
                <input type="hidden" name="intent" value="addLine" />
                <input type="hidden" name="transferId" value={transfer.id} />
                <s-stack direction="inline" gap="base">
                  <s-select label="Variant" name="variantId" required>
                    {variants.map((v) => (
                      <s-option
                        key={v.shopifyVariantId}
                        value={v.shopifyVariantId}
                      >
                        {v.title}
                      </s-option>
                    ))}
                  </s-select>
                  <s-number-field
                    label="Quantity"
                    name="quantity"
                    value="1"
                    min={1}
                    required
                  />
                  <s-button type="submit" variant="secondary">
                    Add line
                  </s-button>
                </s-stack>
              </Form>
            )}

            <s-stack direction="inline" gap="base">
              {transfer.status === "DRAFT" && transfer.lineItems.length > 0 && (
                <Form method="post">
                  <input type="hidden" name="intent" value="ship" />
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <s-button type="submit" variant="primary">
                    Ship (creates Shopify transfer)
                  </s-button>
                </Form>
              )}
              {transfer.status === "IN_TRANSIT" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="receive" />
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <s-button type="submit" variant="primary">
                    Receive at destination
                  </s-button>
                </Form>
              )}
              {transfer.status === "DRAFT" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="cancel" />
                  <input type="hidden" name="transferId" value={transfer.id} />
                  <s-button type="submit" tone="critical" variant="tertiary">
                    Cancel
                  </s-button>
                </Form>
              )}
            </s-stack>
          </s-stack>
        </s-section>
      ))}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
