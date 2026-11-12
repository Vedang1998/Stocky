import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import type { Prisma } from "@prisma/client";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  parseBundleComponentForm,
  type BundleComponentErrors,
} from "../lib/bundles/component-form";
import { formatDecimal } from "../lib/decimal-format";
import { serializeDecimals } from "../lib/decimal-wire.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

type Component = {
  id: string;
  bundleVariantId: string;
  componentVariantId: string;
  quantity: Prisma.Decimal;
};
type Variant = { shopifyVariantId: string; title: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const [components, variants] = await Promise.all([
    db.bomComponent.findMany({
      where: {},
      orderBy: { bundleVariantId: "asc" },
      select: { id: true, bundleVariantId: true, componentVariantId: true, quantity: true },
    }) as Promise<Component[]>,
    db.shopifyVariantCache.findMany({
      where: {},
      orderBy: { title: "asc" },
      take: 250,
      select: { shopifyVariantId: true, title: true },
    }) as Promise<Variant[]>,
  ]);
  return serializeDecimals({ components, variants });
};

type ActionResult = { ok: true } | { ok: false; errors: BundleComponentErrors };

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const { tenant, db } = await requireAdminTenant({ request });
  const shop = tenant.myshopifyDomain;
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "add") {
    const parsed = parseBundleComponentForm(form);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    const { bundleVariantId, componentVariantId, quantity } = parsed.values;

    const known = (await db.shopifyVariantCache.findMany({
      where: { shopifyVariantId: { in: [bundleVariantId, componentVariantId] } },
      select: { shopifyVariantId: true },
    })) as Array<{ shopifyVariantId: string }>;
    const knownIds = new Set(known.map((variant) => variant.shopifyVariantId));
    const errors: BundleComponentErrors = {};
    if (!knownIds.has(bundleVariantId)) {
      errors.bundleVariantId = "This variant is not in your synced catalog.";
    }
    if (!knownIds.has(componentVariantId)) {
      errors.componentVariantId = "This variant is not in your synced catalog.";
    }
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    await db.bomComponent.upsert({
      where: {
        shop_bundleVariantId_componentVariantId: { shop, bundleVariantId, componentVariantId },
      },
      create: { shop, bundleVariantId, componentVariantId, quantity },
      update: { quantity },
    });
    return { ok: true };
  }

  if (intent === "delete") {
    const id = form.get("id");
    if (typeof id === "string" && id !== "") {
      await db.bomComponent.deleteMany({ where: { id } });
    }
    return { ok: true };
  }

  throw new Response("Unknown form", { status: 400 });
};

export default function Bundles() {
  const { components, variants } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const errors = result && !result.ok ? result.errors : {};

  const titles = new Map(variants.map((variant) => [variant.shopifyVariantId, variant.title]));
  const variantTitle = (id: string) => titles.get(id) ?? id;

  const bundles = new Map<string, typeof components>();
  for (const component of components) {
    const list = bundles.get(component.bundleVariantId) ?? [];
    list.push(component);
    bundles.set(component.bundleVariantId, list);
  }

  return (
    <s-page heading="Bundles / Bill of Materials">
      <s-section heading="Map a component">
        <s-paragraph>
          When a bundle sells, the sales history of each mapped component is increased by the
          quantity set here.
        </s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="add" />
          <s-stack direction="inline" gap="base">
            <s-select
              label="Bundle variant"
              name="bundleVariantId"
              required
              error={errors.bundleVariantId}
            >
              {variants.map((variant) => (
                <s-option key={variant.shopifyVariantId} value={variant.shopifyVariantId}>
                  {variant.title}
                </s-option>
              ))}
            </s-select>
            <s-select
              label="Component variant"
              name="componentVariantId"
              required
              error={errors.componentVariantId}
            >
              {variants.map((variant) => (
                <s-option key={variant.shopifyVariantId} value={variant.shopifyVariantId}>
                  {variant.title}
                </s-option>
              ))}
            </s-select>
            <s-number-field
              label="Qty per bundle"
              name="quantity"
              value="1"
              min={0.0001}
              step={0.0001}
              error={errors.quantity}
            />
            <s-button type="submit" variant="primary">
              Add component
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      {[...bundles.entries()].map(([bundleId, parts]) => (
        <s-section key={bundleId} heading={variantTitle(bundleId)}>
          <s-table>
            <s-table-header-row>
              <s-table-header>Component</s-table-header>
              <s-table-header format="numeric">Qty per bundle</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {parts.map((part) => (
                <s-table-row key={part.id}>
                  <s-table-cell>{variantTitle(part.componentVariantId)}</s-table-cell>
                  <s-table-cell>{formatDecimal(part.quantity)}</s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={part.id} />
                      <s-button type="submit" tone="critical" variant="tertiary">
                        Remove
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      ))}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
