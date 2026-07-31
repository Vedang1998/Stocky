import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { assertInventoryWriteEnabled } from "../lib/feature-flags.server";
import { fetchLocations } from "../services/shopify-gql.server";
import {
  applyLandedCostsToPO,
  receivePartialPO,
  recalculatePOLineCost,
  recordLeadTimeSnapshot,
  resolveTieredUnitCost,
} from "../services/landed-cost.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant(request);
  const [orders, suppliers, locations, variants] = await Promise.all([
    db.purchaseOrder.findMany({
      where: {},
      include: { supplier: true, lineItems: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.supplier.findMany({
      where: {},
      orderBy: { name: "asc" },
    }),
    fetchLocations(admin),
    db.shopifyVariantCache.findMany({
      where: {},
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);
  return { orders, suppliers, locations, variants };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant(request);
  const shop = tenant.myshopifyDomain;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "create") {
    const supplierId = form.get("supplierId") as string;
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId },
    });
    if (!supplier) return { error: "Supplier not found" };

    await db.purchaseOrder.create({
      data: {
        shop,
        supplierId: supplier.id,
        locationId: form.get("locationId") as string,
        currency: (form.get("currency") as string) || "USD",
        exchangeRate: form.get("exchangeRate")
          ? parseFloat(form.get("exchangeRate") as string)
          : null,
        freightCost: form.get("freightCost")
          ? parseFloat(form.get("freightCost") as string)
          : null,
        customsCost: form.get("customsCost")
          ? parseFloat(form.get("customsCost") as string)
          : null,
        landedCostMethod:
          (form.get("landedCostMethod") as "WEIGHT" | "VOLUME" | "COST") ||
          "COST",
        status: "DRAFT",
        draftedAt: new Date(),
      },
    });
    return { ok: true };
  }

  if (intent === "addLine") {
    const poId = form.get("poId") as string;
    const qty = parseInt(form.get("quantity") as string, 10);
    const variantId = form.get("variantId") as string;
    const manualCost = form.get("unitCost") as string;

    const po = await db.purchaseOrder.findFirst({
      where: { id: poId },
    });
    if (!po) return { error: "Purchase order not found" };

    // Tiered pricing from Module 1 is the default; a manual entry overrides it.
    const tierCost = await resolveTieredUnitCost(db, po.supplierId, variantId, qty);
    const unitCost = manualCost
      ? parseFloat(manualCost)
      : Number(tierCost ?? 0);

    const mapping = await db.supplierSkuMapping.findUnique({
      where: {
        supplierId_shopifyVariantId: {
          supplierId: po.supplierId,
          shopifyVariantId: variantId,
        },
      },
    });
    const cache = await db.shopifyVariantCache.findUnique({
      where: {
        shop_shopifyVariantId: {
          shop,
          shopifyVariantId: variantId,
        },
      },
    });

    await db.pOLineItem.create({
      data: {
        purchaseOrderId: po.id,
        shopifyVariantId: variantId,
        vendorSku: mapping?.vendorSku,
        orderedQty: qty,
        unitCost,
        manualCostOverride: Boolean(manualCost),
        weight: cache?.weight,
      },
    });
    return { ok: true };
  }

  if (intent === "updateQty") {
    const lineItemId = form.get("lineItemId") as string;
    const qty = parseInt(form.get("quantity") as string, 10);
    const line = await db.pOLineItem.findFirst({
      where: { id: lineItemId },
    });
    if (!line) return { error: "PO line not found" };
    await recalculatePOLineCost(db, line.id, qty);
    return { ok: true };
  }

  if (intent === "order") {
    const poId = form.get("poId") as string;
    const po = await db.purchaseOrder.findFirst({
      where: { id: poId },
    });
    if (!po) return { error: "Purchase order not found" };
    await applyLandedCostsToPO(db, po.id);
    await db.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "ORDERED", orderedAt: new Date() },
    });
    return { ok: true };
  }

  if (intent === "cancel") {
    const poId = form.get("poId") as string;
    const result = await db.purchaseOrder.updateMany({
      where: { id: poId },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) return { error: "Purchase order not found" };
    return { ok: true };
  }

  if (intent === "receive") {
    // Current receivePartialPO updates app DB only — it does not call Shopify.
    // Keep the receipt-write kill switch so Shopify inventory sync cannot be
    // enabled later without an explicit Phase 4 release-gate decision.
    try {
      assertInventoryWriteEnabled("receiptWrites");
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? `${err.message} App-DB receiving is also gated until the receipt ledger and Shopify write path exist.`
            : "Receipt writes disabled",
      };
    }

    const poId = form.get("poId") as string;
    const lineItemId = form.get("lineItemId") as string;
    const qty = parseInt(form.get("receivedQty") as string, 10);
    const po = await db.purchaseOrder.findFirst({
      where: { id: poId },
      include: { lineItems: { where: { id: lineItemId } } },
    });
    if (!po || po.lineItems.length === 0) {
      return { error: "Purchase order or line not found" };
    }

    await receivePartialPO(db, po.id, [{ lineItemId, receivedQty: qty }]);

    const refreshed = await db.purchaseOrder.findFirst({
      where: { id: po.id },
    });
    if (refreshed?.status === "RECEIVED") {
      await recordLeadTimeSnapshot(db, refreshed.supplierId, po.id);
    }
    return { ok: true };
  }

  return { ok: false };
};

const STATUS_TONE: Record<string, "info" | "success" | "warning" | "critical" | "neutral"> = {
  DRAFT: "info",
  ORDERED: "warning",
  PARTIAL: "warning",
  RECEIVED: "success",
  CANCELLED: "critical",
};

export default function PurchaseOrders() {
  const { orders, suppliers, locations, variants } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const variantTitle = (id: string) =>
    variants.find((v: any) => v.shopifyVariantId === id)?.title ?? id;

  return (
    <s-page heading="Purchase Orders">
      <s-section heading="Create purchase order">
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-stack direction="block" gap="base">
            <s-select label="Supplier" name="supplierId" required>
              {suppliers.map((s: any) => (
                <s-option key={s.id} value={s.id}>
                  {s.name}
                </s-option>
              ))}
            </s-select>
            <s-select label="Destination location" name="locationId" required>
              {locations.map((l) => (
                <s-option key={l.id} value={l.id}>
                  {l.name}
                </s-option>
              ))}
            </s-select>
            <s-stack direction="inline" gap="base">
              <s-text-field label="Currency" name="currency" value="USD" />
              <s-number-field
                label="Exchange rate"
                name="exchangeRate"
                placeholder="1.0"
              />
            </s-stack>
            <s-stack direction="inline" gap="base">
              <s-number-field
                label="Freight cost"
                name="freightCost"
                placeholder="0.00"
              />
              <s-number-field
                label="Customs / duties"
                name="customsCost"
                placeholder="0.00"
              />
              <s-select label="Landed cost allocation" name="landedCostMethod">
                <s-option value="COST">By line cost</s-option>
                <s-option value="WEIGHT">By weight</s-option>
                <s-option value="VOLUME">By volume</s-option>
              </s-select>
            </s-stack>
            <s-button
              type="submit"
              variant="primary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Create draft PO
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      {orders.length === 0 ? (
        <s-section>
          <s-paragraph>
            No purchase orders yet. Create one above, or generate one from the{" "}
            <s-link href="/app/buying-table">Buying Table</s-link>.
          </s-paragraph>
        </s-section>
      ) : (
        orders.map((po: any) => (
          <s-section
            key={po.id}
            heading={`${po.supplier.name} — ${po.poNumber ?? po.id.slice(-6).toUpperCase()}`}
          >
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base">
                <s-badge tone={STATUS_TONE[po.status] ?? "neutral"}>
                  {po.status}
                </s-badge>
                <s-text>
                  {po.currency}
                  {po.exchangeRate ? ` @ ${po.exchangeRate}` : ""}
                  {po.freightCost ? ` · Freight $${po.freightCost}` : ""}
                  {po.customsCost ? ` · Customs $${po.customsCost}` : ""}
                  {` · Allocation: ${po.landedCostMethod}`}
                </s-text>
                <s-link
                  href={`/app/purchase-orders/${po.id}/receiver`}
                  target="_blank"
                >
                  Receiver PDF
                </s-link>
              </s-stack>

              {po.lineItems.length > 0 && (
                <s-table>
                  <s-table-header-row>
                    <s-table-header>Variant</s-table-header>
                    <s-table-header format="numeric">Ordered</s-table-header>
                    <s-table-header format="numeric">Received</s-table-header>
                    <s-table-header format="currency">Unit cost</s-table-header>
                    <s-table-header format="currency">Landed unit cost</s-table-header>
                    <s-table-header>Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {po.lineItems.map((li: any) => (
                      <s-table-row key={li.id}>
                        <s-table-cell>
                          {variantTitle(li.shopifyVariantId)}
                          {li.vendorSku ? ` (${li.vendorSku})` : ""}
                        </s-table-cell>
                        <s-table-cell>{li.orderedQty}</s-table-cell>
                        <s-table-cell>{li.receivedQty}</s-table-cell>
                        <s-table-cell>
                          ${Number(li.unitCost).toFixed(2)}
                          {li.manualCostOverride ? " (manual)" : ""}
                        </s-table-cell>
                        <s-table-cell>
                          $
                          {(
                            Number(li.unitCost) +
                            Number(li.allocatedLandedCost ?? 0)
                          ).toFixed(2)}
                        </s-table-cell>
                        <s-table-cell>
                          {po.status === "DRAFT" && (
                            <Form method="post">
                              <input type="hidden" name="intent" value="updateQty" />
                              <input type="hidden" name="lineItemId" value={li.id} />
                              <s-stack direction="inline" gap="small-200">
                                <s-number-field
                                  label="Qty"
                                  labelAccessibilityVisibility="exclusive"
                                  name="quantity"
                                  value={String(li.orderedQty)}
                                  min={1}
                                />
                                <s-button type="submit" variant="secondary">
                                  Update
                                </s-button>
                              </s-stack>
                            </Form>
                          )}
                          {(po.status === "ORDERED" || po.status === "PARTIAL") &&
                            li.receivedQty < li.orderedQty && (
                              <Form method="post">
                                <input type="hidden" name="intent" value="receive" />
                                <input type="hidden" name="poId" value={po.id} />
                                <input type="hidden" name="lineItemId" value={li.id} />
                                <s-stack direction="inline" gap="small-200">
                                  <s-number-field
                                    label="Receive qty"
                                    labelAccessibilityVisibility="exclusive"
                                    name="receivedQty"
                                    value={String(li.orderedQty - li.receivedQty)}
                                    min={1}
                                    max={li.orderedQty - li.receivedQty}
                                  />
                                  <s-button type="submit" variant="secondary">
                                    Receive
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

              {po.status === "DRAFT" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="addLine" />
                  <input type="hidden" name="poId" value={po.id} />
                  <s-stack direction="inline" gap="base">
                    <s-select label="Variant" name="variantId" required>
                      {variants.map((v: any) => (
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
                    <s-number-field
                      label="Unit cost override"
                      name="unitCost"
                      placeholder="Auto (tiered)"
                    />
                    <s-button type="submit" variant="secondary">
                      Add line
                    </s-button>
                  </s-stack>
                </Form>
              )}

              <s-stack direction="inline" gap="base">
                {po.status === "DRAFT" && po.lineItems.length > 0 && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="order" />
                    <input type="hidden" name="poId" value={po.id} />
                    <s-button type="submit" variant="primary">
                      Mark ordered (locks landed costs)
                    </s-button>
                  </Form>
                )}
                {(po.status === "DRAFT" || po.status === "ORDERED") && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="cancel" />
                    <input type="hidden" name="poId" value={po.id} />
                    <s-button type="submit" tone="critical" variant="tertiary">
                      Cancel PO
                    </s-button>
                  </Form>
                )}
              </s-stack>
            </s-stack>
          </s-section>
        ))
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
