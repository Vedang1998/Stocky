/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import { submitOnEnter } from "../lib/submit-on-enter";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { fetchLocations } from "../services/shopify-gql.server";
import {
  requireAdminTenantWithActor,
  STAFF_REQUIRED_MESSAGE,
} from "../services/inventory-writes/actor.server";
import {
  parseWholeNumber,
  readFormId,
} from "../services/inventory-writes/form-values";
import {
  addTransferLine,
  cancelTransfer,
  createTransfer,
  setTransferPickedQuantity,
  shipTransfer,
} from "../services/transfers/transfer.server";
import { receiveTransfer } from "../services/transfers/transfer-receiving.server";
import {
  MAX_TRANSFER_LINE_QUANTITY,
  transferShipQuantity,
} from "../services/transfers/transfer-quantities";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const [transfers, locations, variants] = await Promise.all([
    db.transferOrder.findMany({
      where: {},
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    fetchLocations(admin),
    db.shopifyVariantCache.findMany({
      where: {},
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);
  return { transfers, locations, variants };
};

const QUANTITY_LIMIT = MAX_TRANSFER_LINE_QUANTITY.toLocaleString("en-US");

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, tenant, db, actor } = await requireAdminTenantWithActor({
    request,
  });
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const notes = form.get("notes");
    const result = await createTransfer(db, {
      shop: tenant.myshopifyDomain,
      sourceLocationId: readFormId(form.get("sourceLocationId")) ?? "",
      destinationLocationId:
        readFormId(form.get("destinationLocationId")) ?? "",
      notes: typeof notes === "string" ? notes : null,
    });
    return result.ok
      ? { ok: true, notice: "Draft transfer created." }
      : { error: result.error };
  }

  if (intent === "addLine") {
    const transferId = readFormId(form.get("transferId"));
    if (!transferId) return { error: "Transfer not found" };
    const shopifyVariantId = readFormId(form.get("variantId"));
    if (!shopifyVariantId) return { error: "Choose a variant to add." };
    const quantity = parseWholeNumber(form.get("quantity"), {
      min: 1,
      max: MAX_TRANSFER_LINE_QUANTITY,
    });
    if (quantity === null) {
      return {
        error: `Enter the quantity as a whole number from 1 to ${QUANTITY_LIMIT}.`,
      };
    }
    const result = await addTransferLine(db, {
      transferId,
      shopifyVariantId,
      quantity,
    });
    return result.ok ? { ok: true } : { error: result.error };
  }

  if (intent === "pick") {
    const lineId = readFormId(form.get("lineId"));
    if (!lineId) return { error: "Transfer line not found" };
    const pickedQty = parseWholeNumber(form.get("pickedQty"), {
      min: 0,
      max: MAX_TRANSFER_LINE_QUANTITY,
    });
    if (pickedQty === null) {
      return {
        error: "Enter the picked quantity as a whole number of 0 or more.",
      };
    }
    const result = await setTransferPickedQuantity(db, { lineId, pickedQty });
    return result.ok ? { ok: true } : { error: result.error };
  }

  if (intent === "ship" || intent === "receive" || intent === "cancel") {
    const transferId = readFormId(form.get("transferId"));
    if (!transferId) return { error: "Transfer not found", problems: [] };

    if (intent === "cancel") {
      const result = await cancelTransfer(db, admin, actor, transferId);
      return result.ok
        ? { ok: true, notice: "Transfer cancelled." }
        : { error: result.error, problems: result.problems };
    }

    if (!actor) return { error: STAFF_REQUIRED_MESSAGE, problems: [] };
    if (intent === "ship") {
      const result = await shipTransfer(db, admin, actor, transferId);
      if (!result.ok) return { error: result.error, problems: result.problems };
      return {
        ok: true,
        notice: result.alreadyDone
          ? "This transfer was already shipped. Nothing more was sent to Shopify."
          : "Transfer shipped. Its stock has left the source location in Shopify.",
      };
    }
    const result = await receiveTransfer(db, admin, actor, transferId);
    if (!result.ok) return { error: result.error, problems: result.problems };
    return {
      ok: true,
      notice: result.alreadyDone
        ? "This transfer was already received. Nothing more was sent to Shopify."
        : "Transfer received. Its stock is now at the destination in Shopify.",
    };
  }

  return { error: "That action is not available." };
};

const STATUS_TONE: Record<string, "info" | "warning" | "success" | "critical"> =
  {
    DRAFT: "info",
    IN_TRANSIT: "warning",
    RECEIVED: "success",
    CANCELLED: "critical",
  };

export default function Transfers() {
  const { transfers, locations, variants } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;
  const variantTitle = (id: string) =>
    variants.find((v: any) => v.shopifyVariantId === id)?.title ?? id;

  return (
    <s-page heading="Transfer Orders">
      <ActionFeedback data={actionData} errorHeading="Transfer issue" />

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

      {transfers.map((transfer: any) => (
        <s-section
          key={transfer.id}
          heading={`${locationName(transfer.sourceLocationId)} → ${locationName(transfer.destinationLocationId)}`}
        >
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-badge tone={STATUS_TONE[transfer.status] ?? "neutral"}>
                {transfer.status.replace("_", " ")}
              </s-badge>
              {transfer.notes && (
                <s-text color="subdued">{transfer.notes}</s-text>
              )}
            </s-stack>

            {transfer.lineItems.length > 0 && (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Variant</s-table-header>
                  <s-table-header format="numeric">Requested</s-table-header>
                  <s-table-header format="numeric">
                    {transfer.status === "DRAFT" ? "To ship" : "Shipped"}
                  </s-table-header>
                  <s-table-header format="numeric">Received</s-table-header>
                  <s-table-header>Picking</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {transfer.lineItems.map((line: any) => (
                    <s-table-row key={line.id}>
                      <s-table-cell>
                        {variantTitle(line.shopifyVariantId)}
                      </s-table-cell>
                      <s-table-cell>{line.quantity}</s-table-cell>
                      <s-table-cell>
                        {/* A cancelled transfer never left the source. */}
                        {transfer.status === "CANCELLED"
                          ? 0
                          : transferShipQuantity(line)}
                      </s-table-cell>
                      <s-table-cell>{line.receivedQty}</s-table-cell>
                      <s-table-cell>
                        {transfer.status === "DRAFT" && (
                          <Form method="post" onKeyDown={submitOnEnter}>
                            <input type="hidden" name="intent" value="pick" />
                            <input
                              type="hidden"
                              name="lineId"
                              value={line.id}
                            />
                            <s-stack direction="inline" gap="small-200">
                              <s-number-field
                                label="Picked qty"
                                labelAccessibilityVisibility="exclusive"
                                name="pickedQty"
                                value={String(transferShipQuantity(line))}
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

            {transfer.status === "DRAFT" && transfer.lineItems.length > 0 && (
              <s-paragraph>
                <s-text color="subdued">
                  A line ships its requested quantity unless you save a smaller
                  picked quantity for it.
                </s-text>
              </s-paragraph>
            )}

            {transfer.status === "DRAFT" && (
              <Form method="post" onKeyDown={submitOnEnter}>
                <input type="hidden" name="intent" value="addLine" />
                <input type="hidden" name="transferId" value={transfer.id} />
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
                    Ship from source
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
