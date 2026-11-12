/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
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
  addStocktakeLine,
  completeStocktake,
  createStocktake,
  MAX_COUNTED_QUANTITY,
  saveStocktakeCount,
} from "../services/stocktakes/stocktake.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const [stocktakes, locations, variants] = await Promise.all([
    db.stocktake.findMany({
      where: {},
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    fetchLocations(admin),
    db.shopifyVariantCache.findMany({
      where: {},
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);
  return { stocktakes, locations, variants };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, tenant, db, actor } = await requireAdminTenantWithActor({
    request,
  });
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = form.get("name");
    const result = await createStocktake(db, {
      shop: tenant.myshopifyDomain,
      locationId: readFormId(form.get("locationId")),
      name: typeof name === "string" ? name : null,
    });
    return result.ok
      ? { ok: true, notice: "Count started." }
      : { error: result.error };
  }

  if (intent === "addItem") {
    const stocktakeId = readFormId(form.get("stocktakeId"));
    const shopifyVariantId = readFormId(form.get("variantId"));
    if (!stocktakeId) return { error: "Stocktake not found" };
    if (!shopifyVariantId) return { error: "Choose a variant to add." };
    const result = await addStocktakeLine(db, { stocktakeId, shopifyVariantId });
    return result.ok ? { ok: true } : { error: result.error };
  }

  if (intent === "count") {
    const lineId = readFormId(form.get("lineId"));
    if (!lineId) return { error: "Stocktake line not found" };
    const countedQty = parseWholeNumber(form.get("countedQty"), {
      min: 0,
      max: MAX_COUNTED_QUANTITY,
    });
    if (countedQty === null) {
      return {
        error: `Enter the counted quantity as a whole number from 0 to ${MAX_COUNTED_QUANTITY.toLocaleString("en-US")}.`,
      };
    }
    const result = await saveStocktakeCount(db, { lineId, countedQty });
    return result.ok ? { ok: true } : { error: result.error };
  }

  if (intent === "complete") {
    if (!actor) return { error: STAFF_REQUIRED_MESSAGE, problems: [] };
    const stocktakeId = readFormId(form.get("stocktakeId"));
    if (!stocktakeId) return { error: "Stocktake not found", problems: [] };
    const result = await completeStocktake(db, admin, actor, stocktakeId);
    if (!result.ok) return { error: result.error, problems: result.problems };
    return {
      ok: true,
      notice: result.alreadyCompleted
        ? "This count was already completed. Nothing more was sent to Shopify."
        : "Count completed. Its variances are applied in Shopify.",
    };
  }

  return { error: "That action is not available." };
};

export default function Stocktakes() {
  const { stocktakes, locations, variants } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;
  const variantTitle = (id: string) =>
    variants.find((v: any) => v.shopifyVariantId === id)?.title ?? id;

  return (
    <s-page heading="Stocktakes (Cycle Counts)">
      <ActionFeedback data={actionData} errorHeading="Stocktake issue" />

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

      {stocktakes.map((st: any) => (
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
                    {variants.map((v: any) => (
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
                  {st.lineItems.map((line: any) => (
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
                          <Form method="post" onKeyDown={submitOnEnter}>
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
                  Complete and apply variances in Shopify
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
