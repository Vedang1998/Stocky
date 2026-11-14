import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import {
  AddSupplierProducts,
  SupplierProductEditor,
  SupplierProducts,
} from "../components/purchasing/SupplierProducts";
import { SupplierProfileForm } from "../components/purchasing/SupplierProfileForm";
import { formatMoment } from "../lib/purchasing/display";
import { describePurchasingEvent } from "../lib/purchasing/history";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { PurchasingError } from "../services/purchasing/errors";
import { listPurchasingEvents } from "../services/purchasing/events.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { runSupplierIntent } from "../services/purchasing/supplier-actions.server";
import {
  contactMethodOptions,
  getSupplierView,
  linkedVariantGids,
} from "../services/purchasing/supplier-view.server";
import { listCatalogVendors } from "../services/purchasing/suppliers.server";
import {
  searchVariants,
  variantDisplayName,
} from "../services/purchasing/variants.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

const HISTORY_LENGTH = 30;
const MAX_PAGE = 10_000;

function readPage(value: string | null): number {
  if (!value || !/^\d{1,5}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  const url = new URL(request.url);

  const supplier = await getSupplierView(db, params.id ?? "", {
    productPage: readPage(url.searchParams.get("page")),
  }).catch((error: unknown) => {
    if (error instanceof PurchasingError && error.code === "not_found") {
      throw new Response("Supplier not found", { status: 404 });
    }
    throw error;
  });
  const active = supplier.status === "ACTIVE";

  const find = (url.searchParams.get("find") ?? "").trim().slice(0, 100);
  const [profile, events, matches, vendors] = await Promise.all([
    readShopProfile(admin),
    listPurchasingEvents(
      db,
      { subjectType: "SUPPLIER", subjectId: supplier.id },
      HISTORY_LENGTH,
    ),
    active && find
      ? searchVariants(db, find)
      : { variants: [], hasMore: false },
    active ? listCatalogVendors(db) : [],
  ]);
  const linked = await linkedVariantGids(
    db,
    supplier.id,
    matches.variants.map((variant) => variant.variantGid),
  );

  return {
    supplier,
    history: events.map((event) => ({
      id: event.id,
      text: describePurchasingEvent(event.action, event.details),
      at: event.createdAt,
    })),
    productSearch: {
      query: find,
      hasMore: matches.hasMore,
      results: matches.variants.map((variant) => ({
        variantGid: variant.variantGid,
        name: variantDisplayName(variant),
        sku: variant.sku,
        barcode: variant.barcode,
        linked: linked.has(variant.variantGid),
      })),
    },
    vendors,
    editProductId: url.searchParams.get("edit"),
    confirmDelete: url.searchParams.get("confirm") === "delete",
    contactMethods: contactMethodOptions(),
    timeZone: profile.ianaTimezone,
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const context = await requirePurchasingContext({ request, params });
  return runSupplierIntent(context, params.id ?? "", await request.formData());
};

function days(value: number): string {
  return `${value} ${value === 1 ? "day" : "days"}`;
}

export default function SupplierDetail() {
  const {
    supplier,
    history,
    productSearch,
    vendors,
    editProductId,
    confirmDelete,
    contactMethods,
    timeZone,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const failure = actionData && !actionData.ok ? actionData : null;
  const errorsFor = (intent: string) =>
    failure?.intent === intent ? failure.fieldErrors : {};

  const active = supplier.status === "ACTIVE";
  const supplierHref = `/app/suppliers/${supplier.id}`;
  const editedProduct = active
    ? supplier.products.find((product) => product.id === editProductId)
    : undefined;
  const deletable = supplier.purchaseOrderCount === 0;

  return (
    <s-page heading={supplier.name}>
      <s-link slot="breadcrumb-actions" href="/app/suppliers">
        Suppliers
      </s-link>

      <ActionFeedback data={actionData} errorHeading="Supplier not updated" />

      {confirmDelete && deletable && (
        <s-banner tone="critical" heading="Delete this supplier?">
          <s-stack direction="block" gap="small-200">
            <s-paragraph>
              The supplier, its products, terms and price tiers are removed.
              This cannot be undone.
            </s-paragraph>
            <s-stack direction="inline" gap="small-200">
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <s-button type="submit" tone="critical" variant="primary">
                  Delete supplier
                </s-button>
              </Form>
              <s-button href={supplierHref} variant="tertiary">
                Keep it
              </s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      )}

      {!active && (
        <s-banner tone="info" heading="This supplier is archived">
          <s-paragraph>
            It is hidden from new purchase orders and replenishment. Restore it
            to make changes.
          </s-paragraph>
        </s-banner>
      )}

      <SupplierProducts
        supplier={supplier}
        editable={active}
        editProductId={editedProduct?.id ?? null}
      />

      {editedProduct && (
        <SupplierProductEditor
          key={editedProduct.id}
          supplier={supplier}
          product={editedProduct}
          fieldErrors={{
            ...errorsFor("saveProduct"),
            ...errorsFor("removeProduct"),
          }}
          tierErrors={{ ...errorsFor("addTier"), ...errorsFor("removeTier") }}
        />
      )}

      {active && (
        <AddSupplierProducts
          supplierId={supplier.id}
          search={productSearch}
          vendors={vendors}
          fieldErrors={errorsFor("addVendor")}
        />
      )}

      <s-section heading="Details">
        {active ? (
          <SupplierProfileForm
            intent="saveProfile"
            values={supplier.profile}
            contactMethods={contactMethods}
            fieldErrors={errorsFor("saveProfile")}
            submitLabel="Save supplier"
          />
        ) : (
          <s-stack direction="block" gap="small-200">
            <s-text>Currency: {supplier.currency}</s-text>
            {supplier.contactEmail && (
              <s-text>Contact: {supplier.contactEmail}</s-text>
            )}
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Purchase orders">
        <s-stack direction="block" gap="small-200">
          <s-text>
            {supplier.purchaseOrderCount === 0
              ? "No purchase orders yet."
              : supplier.purchaseOrderCount === 1
                ? "1 purchase order."
                : `${supplier.purchaseOrderCount} purchase orders.`}
          </s-text>
          {active && (
            <s-button
              variant="primary"
              href={`/app/purchase-orders/new?supplier=${supplier.id}`}
            >
              Create purchase order
            </s-button>
          )}
          {supplier.purchaseOrderCount > 0 && (
            <s-link
              href={`/app/purchase-orders?${new URLSearchParams({
                view: "all",
                q: supplier.name,
              }).toString()}`}
            >
              View this supplier&apos;s orders
            </s-link>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Lead time">
        <s-stack direction="block" gap="small-200">
          <s-text>
            Default:{" "}
            {supplier.defaultLeadTimeDays === null
              ? "not set"
              : days(supplier.defaultLeadTimeDays)}
          </s-text>
          <s-text color="subdued">
            {supplier.measuredLeadTimeDays === null
              ? "Measured once orders from this supplier are received."
              : `Measured average: ${supplier.measuredLeadTimeDays.toFixed(1)} days.`}
          </s-text>
          {supplier.leadTimeHistory.length > 0 && (
            <s-unordered-list>
              {supplier.leadTimeHistory.map((entry) => (
                <s-list-item key={entry.id}>
                  {entry.days.toFixed(1)} days, recorded{" "}
                  {formatMoment(entry.recordedAt, timeZone)}
                </s-list-item>
              ))}
            </s-unordered-list>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Actions">
        <s-stack direction="block" gap="small-200">
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value={active ? "archive" : "restore"}
            />
            <s-button type="submit" variant="secondary">
              {active ? "Archive supplier" : "Restore supplier"}
            </s-button>
          </Form>
          {deletable ? (
            <s-button
              href={`${supplierHref}?confirm=delete`}
              tone="critical"
              variant="secondary"
            >
              Delete supplier
            </s-button>
          ) : (
            <s-text color="subdued">
              A supplier with purchase orders cannot be deleted. Archive it
              instead.
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="History">
        {history.length === 0 ? (
          <s-paragraph>No history yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small-200">
            {history.map((event) => (
              <s-stack key={event.id} direction="block" gap="small-400">
                <s-text>{event.text}</s-text>
                <s-text color="subdued">
                  {formatMoment(event.at, timeZone)}
                </s-text>
              </s-stack>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
