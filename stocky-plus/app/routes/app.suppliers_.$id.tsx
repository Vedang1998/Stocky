import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, shop: session.shop },
    include: {
      skuMappings: true,
      volumeTiers: { orderBy: [{ variantId: "asc" }, { minQty: "asc" }] },
      leadTimeSnapshots: { orderBy: { recordedAt: "desc" }, take: 10 },
    },
  });
  if (!supplier) {
    throw new Response("Supplier not found", { status: 404 });
  }

  const variants = await prisma.shopifyVariantCache.findMany({
    where: { shop: session.shop },
    orderBy: { title: "asc" },
    take: 250,
  });

  return { supplier, variants };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, shop: session.shop },
  });
  if (!supplier) throw new Response("Supplier not found", { status: 404 });

  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "updateNotes") {
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        vendorNotes: (form.get("vendorNotes") as string) || null,
        accountNumber: (form.get("accountNumber") as string) || null,
        contactName: (form.get("contactName") as string) || null,
        contactEmail: (form.get("contactEmail") as string) || null,
        contactPhone: (form.get("contactPhone") as string) || null,
        currency: (form.get("currency") as string) || "USD",
      },
    });
  }

  if (intent === "addMapping") {
    await prisma.supplierSkuMapping.upsert({
      where: {
        supplierId_shopifyVariantId: {
          supplierId: supplier.id,
          shopifyVariantId: form.get("variantId") as string,
        },
      },
      create: {
        supplierId: supplier.id,
        shopifyVariantId: form.get("variantId") as string,
        vendorSku: form.get("vendorSku") as string,
        moq: parseInt((form.get("moq") as string) || "1", 10),
        packSize: parseInt((form.get("packSize") as string) || "1", 10),
      },
      update: {
        vendorSku: form.get("vendorSku") as string,
        moq: parseInt((form.get("moq") as string) || "1", 10),
        packSize: parseInt((form.get("packSize") as string) || "1", 10),
      },
    });
  }

  if (intent === "deleteMapping") {
    await prisma.supplierSkuMapping.delete({
      where: { id: form.get("mappingId") as string },
    });
  }

  if (intent === "addTier") {
    const maxQtyRaw = form.get("maxQty") as string;
    await prisma.volumePriceTier.create({
      data: {
        supplierId: supplier.id,
        variantId: form.get("variantId") as string,
        minQty: parseInt(form.get("minQty") as string, 10),
        maxQty: maxQtyRaw ? parseInt(maxQtyRaw, 10) : null,
        unitCost: parseFloat(form.get("unitCost") as string),
      },
    });
  }

  if (intent === "deleteTier") {
    await prisma.volumePriceTier.delete({
      where: { id: form.get("tierId") as string },
    });
  }

  return { ok: true };
};

export default function SupplierDetail() {
  const { supplier, variants } = useLoaderData<typeof loader>();

  const variantTitle = (id: string) =>
    variants.find((v) => v.shopifyVariantId === id)?.title ?? id;

  return (
    <s-page heading={supplier.name}>
      <s-section heading="Vendor details">
        <Form method="post">
          <input type="hidden" name="intent" value="updateNotes" />
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-text-field
                label="Account number"
                name="accountNumber"
                value={supplier.accountNumber ?? ""}
              />
              <s-text-field
                label="Currency"
                name="currency"
                value={supplier.currency}
              />
            </s-stack>
            <s-stack direction="inline" gap="base">
              <s-text-field
                label="Contact name"
                name="contactName"
                value={supplier.contactName ?? ""}
              />
              <s-email-field
                label="Contact email"
                name="contactEmail"
                value={supplier.contactEmail ?? ""}
              />
              <s-text-field
                label="Contact phone"
                name="contactPhone"
                value={supplier.contactPhone ?? ""}
              />
            </s-stack>
            <s-text-area
              label="Vendor notes"
              name="vendorNotes"
              value={supplier.vendorNotes ?? ""}
              rows={4}
            />
            <s-button type="submit" variant="primary">
              Save details
            </s-button>
          </s-stack>
        </Form>
        <s-paragraph>
          <s-text color="subdued">
            Lead time (trailing 90-day average):{" "}
            {supplier.leadTimeDays
              ? `${supplier.leadTimeDays.toFixed(1)} days`
              : "No completed POs yet"}
          </s-text>
        </s-paragraph>
      </s-section>

      <s-section heading="SKU mappings (Shopify variant ↔ vendor SKU)">
        <Form method="post">
          <input type="hidden" name="intent" value="addMapping" />
          <s-stack direction="inline" gap="base">
            <s-select label="Shopify variant" name="variantId" required>
              {variants.map((v) => (
                <s-option key={v.shopifyVariantId} value={v.shopifyVariantId}>
                  {v.title}
                </s-option>
              ))}
            </s-select>
            <s-text-field label="Vendor SKU" name="vendorSku" required />
            <s-number-field label="MOQ" name="moq" value="1" min={1} />
            <s-number-field
              label="Pack size"
              name="packSize"
              value="1"
              min={1}
            />
            <s-button type="submit" variant="secondary">
              Add mapping
            </s-button>
          </s-stack>
        </Form>

        {supplier.skuMappings.length > 0 && (
          <s-table>
            <s-table-header-row>
              <s-table-header>Variant</s-table-header>
              <s-table-header>Vendor SKU</s-table-header>
              <s-table-header format="numeric">MOQ</s-table-header>
              <s-table-header format="numeric">Pack size</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {supplier.skuMappings.map((m) => (
                <s-table-row key={m.id}>
                  <s-table-cell>{variantTitle(m.shopifyVariantId)}</s-table-cell>
                  <s-table-cell>{m.vendorSku}</s-table-cell>
                  <s-table-cell>{m.moq}</s-table-cell>
                  <s-table-cell>{m.packSize}</s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="deleteMapping" />
                      <input type="hidden" name="mappingId" value={m.id} />
                      <s-button type="submit" tone="critical" variant="tertiary">
                        Remove
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section heading="Volume pricing tiers">
        <Form method="post">
          <input type="hidden" name="intent" value="addTier" />
          <s-stack direction="inline" gap="base">
            <s-select label="Variant" name="variantId" required>
              {variants.map((v) => (
                <s-option key={v.shopifyVariantId} value={v.shopifyVariantId}>
                  {v.title}
                </s-option>
              ))}
            </s-select>
            <s-number-field label="Min qty" name="minQty" value="1" min={1} required />
            <s-number-field
              label="Max qty (blank = unlimited)"
              name="maxQty"
            />
            <s-number-field label="Unit cost" name="unitCost" required />
            <s-button type="submit" variant="secondary">
              Add tier
            </s-button>
          </s-stack>
        </Form>

        {supplier.volumeTiers.length > 0 && (
          <s-table>
            <s-table-header-row>
              <s-table-header>Variant</s-table-header>
              <s-table-header format="numeric">Min</s-table-header>
              <s-table-header format="numeric">Max</s-table-header>
              <s-table-header format="currency">Unit cost</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {supplier.volumeTiers.map((t) => (
                <s-table-row key={t.id}>
                  <s-table-cell>{variantTitle(t.variantId)}</s-table-cell>
                  <s-table-cell>{t.minQty}</s-table-cell>
                  <s-table-cell>{t.maxQty ?? "∞"}</s-table-cell>
                  <s-table-cell>${Number(t.unitCost).toFixed(2)}</s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="deleteTier" />
                      <input type="hidden" name="tierId" value={t.id} />
                      <s-button type="submit" tone="critical" variant="tertiary">
                        Remove
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      {supplier.leadTimeSnapshots.length > 0 && (
        <s-section slot="aside" heading="Recent lead times">
          <s-unordered-list>
            {supplier.leadTimeSnapshots.map((snap) => (
              <s-list-item key={snap.id}>
                {snap.leadTimeDays.toFixed(1)} days (
                {new Date(snap.recordedAt).toLocaleDateString()})
              </s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
