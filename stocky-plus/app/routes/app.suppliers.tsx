import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await prisma.supplier.findMany({
    where: { shop: session.shop },
    include: {
      _count: { select: { skuMappings: true, purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });
  return { suppliers };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "create") {
    await prisma.supplier.create({
      data: {
        shop: session.shop,
        name: form.get("name") as string,
        accountNumber: (form.get("accountNumber") as string) || null,
        contactEmail: (form.get("contactEmail") as string) || null,
        currency: (form.get("currency") as string) || "USD",
        vendorNotes: (form.get("vendorNotes") as string) || null,
      },
    });
  }

  if (intent === "delete") {
    const id = form.get("id") as string;
    await prisma.supplier.deleteMany({
      where: { id, shop: session.shop },
    });
  }

  return { ok: true };
};

export default function Suppliers() {
  const { suppliers } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Suppliers">
      <s-section heading="Add supplier">
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-text-field label="Supplier name" name="name" required />
              <s-text-field label="Account number" name="accountNumber" />
              <s-email-field label="Contact email" name="contactEmail" />
              <s-text-field label="Currency" name="currency" value="USD" />
            </s-stack>
            <s-text-area label="Vendor notes" name="vendorNotes" rows={3} />
            <s-button
              type="submit"
              variant="primary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Add supplier
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Supplier list">
        {suppliers.length === 0 ? (
          <s-paragraph>
            No suppliers yet. Add your first supplier above.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Supplier</s-table-header>
              <s-table-header format="numeric">SKUs</s-table-header>
              <s-table-header format="numeric">POs</s-table-header>
              <s-table-header format="numeric">Lead time</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {suppliers.map((s) => (
                <s-table-row key={s.id}>
                  <s-table-cell>
                    <s-link href={`/app/suppliers/${s.id}`}>{s.name}</s-link>
                  </s-table-cell>
                  <s-table-cell>{s._count.skuMappings}</s-table-cell>
                  <s-table-cell>{s._count.purchaseOrders}</s-table-cell>
                  <s-table-cell>
                    {s.leadTimeDays ? `${s.leadTimeDays.toFixed(1)}d` : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={s.id} />
                      <s-button type="submit" tone="critical" variant="tertiary">
                        Delete
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
