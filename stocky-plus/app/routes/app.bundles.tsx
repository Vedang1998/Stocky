import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [components, variants] = await Promise.all([
    prisma.bomComponent.findMany({
      where: { shop: session.shop },
      orderBy: { bundleVariantId: "asc" },
    }),
    prisma.shopifyVariantCache.findMany({
      where: { shop: session.shop },
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);
  return { components, variants };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "add") {
    const bundleVariantId = form.get("bundleVariantId") as string;
    const componentVariantId = form.get("componentVariantId") as string;
    if (bundleVariantId === componentVariantId) {
      return { error: "A bundle cannot contain itself" };
    }
    await prisma.bomComponent.upsert({
      where: {
        shop_bundleVariantId_componentVariantId: {
          shop: session.shop,
          bundleVariantId,
          componentVariantId,
        },
      },
      create: {
        shop: session.shop,
        bundleVariantId,
        componentVariantId,
        quantity: parseFloat((form.get("quantity") as string) || "1"),
      },
      update: {
        quantity: parseFloat((form.get("quantity") as string) || "1"),
      },
    });
  }

  if (intent === "delete") {
    await prisma.bomComponent.deleteMany({
      where: { id: form.get("id") as string, shop: session.shop },
    });
  }

  return { ok: true };
};

export default function Bundles() {
  const { components, variants } = useLoaderData<typeof loader>();

  const variantTitle = (id: string) =>
    variants.find((v) => v.shopifyVariantId === id)?.title ?? id;

  const bundles = new Map<string, typeof components>();
  for (const c of components) {
    const list = bundles.get(c.bundleVariantId) ?? [];
    list.push(c);
    bundles.set(c.bundleVariantId, list);
  }

  return (
    <s-page heading="Bundles / Bill of Materials">
      <s-section heading="Map a component">
        <s-paragraph>
          When a bundle sells, the sales history of each mapped component is
          incremented so forecasting stays accurate for raw materials — the
          bundle problem Stocky never solved.
        </s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="add" />
          <s-stack direction="inline" gap="base">
            <s-select label="Bundle variant" name="bundleVariantId" required>
              {variants.map((v) => (
                <s-option key={v.shopifyVariantId} value={v.shopifyVariantId}>
                  {v.title}
                </s-option>
              ))}
            </s-select>
            <s-select
              label="Component variant"
              name="componentVariantId"
              required
            >
              {variants.map((v) => (
                <s-option key={v.shopifyVariantId} value={v.shopifyVariantId}>
                  {v.title}
                </s-option>
              ))}
            </s-select>
            <s-number-field
              label="Qty per bundle"
              name="quantity"
              value="1"
              min={0.01}
              step={0.01}
            />
            <s-button type="submit" variant="primary">
              Add component
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      {[...bundles.entries()].map(([bundleId, comps]) => (
        <s-section key={bundleId} heading={variantTitle(bundleId)}>
          <s-table>
            <s-table-header-row>
              <s-table-header>Component</s-table-header>
              <s-table-header format="numeric">Qty per bundle</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {comps.map((c) => (
                <s-table-row key={c.id}>
                  <s-table-cell>
                    {variantTitle(c.componentVariantId)}
                  </s-table-cell>
                  <s-table-cell>{Number(c.quantity)}</s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={c.id} />
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
