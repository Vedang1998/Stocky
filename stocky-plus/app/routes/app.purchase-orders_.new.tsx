import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import { FormReader } from "../lib/purchasing/form-input";
import { submitOnEnter } from "../lib/submit-on-enter";
import {
  invalidForm,
  purchasingAction,
} from "../services/purchasing/action-result.server";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { listLocations } from "../services/purchasing/locations.server";
import {
  createPurchaseOrderDraft,
  MAX_EXCHANGE_RATE,
} from "../services/purchasing/purchase-orders.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { listSupplierOptions } from "../services/purchasing/suppliers.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const [suppliers, locations, profile] = await Promise.all([
    listSupplierOptions(db),
    listLocations(db, admin),
    readShopProfile(admin),
  ]);
  const requestedSupplier = new URL(request.url).searchParams.get("supplier");
  return {
    suppliers,
    locations: locations.filter((location) => location.isActive),
    shopCurrency: profile.currencyCode,
    selectedSupplierId:
      suppliers.find((supplier) => supplier.id === requestedSupplier)?.id ??
      suppliers[0]?.id ??
      null,
    // One key per rendered form: pressing Create twice opens the same draft.
    creationKey: crypto.randomUUID(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, db, actor } = await requirePurchasingContext({ request });
  const form = new FormReader(await request.formData());

  const supplierId = form.text("supplierId", {
    required: true,
    maxLength: 64,
    label: "Supplier",
  });
  const locationGid = form.text("locationGid", {
    required: true,
    maxLength: 256,
    label: "Destination",
  });
  const creationKey = form.text("creationKey", {
    required: true,
    maxLength: 128,
    label: "Form key",
  });
  const currency = form.currency("currency", {});
  const exchangeRate = form.decimal("exchangeRate", {
    scale: 6,
    min: 0,
    minExclusive: true,
    max: MAX_EXCHANGE_RATE,
    label: "Exchange rate",
  });
  const expectedOn = form.date("expectedOn", { label: "Expected date" });
  const notes = form.text("notes", {
    maxLength: 4000,
    label: "Internal notes",
  });
  if (!form.ok || !supplierId || !locationGid || !creationKey) {
    return invalidForm("create", form);
  }

  return purchasingAction("create", async () => {
    const profile = await readShopProfile(admin);
    const draft = await createPurchaseOrderDraft(
      db,
      actor,
      {
        supplierId,
        locationGid,
        creationKey,
        source: "manual",
        currency,
        exchangeRate,
        expectedOn,
        notes,
      },
      { admin, today: profile.today },
    );
    return redirect(`/app/purchase-orders/${draft.id}`);
  });
};

export default function NewPurchaseOrder() {
  const {
    suppliers,
    locations,
    shopCurrency,
    selectedSupplierId,
    creationKey,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fieldErrors =
    actionData && !actionData.ok ? actionData.fieldErrors : {};
  const canCreate = suppliers.length > 0 && locations.length > 0;

  return (
    <s-page heading="Create purchase order">
      <s-link slot="breadcrumb-actions" href="/app/purchase-orders">
        Purchase orders
      </s-link>
      <ActionFeedback
        data={actionData}
        errorHeading="Purchase order not created"
      />

      {suppliers.length === 0 && (
        <s-banner tone="warning" heading="Add a supplier first">
          <s-paragraph>
            A purchase order is placed with a supplier.{" "}
            <s-link href="/app/suppliers">Add a supplier</s-link>, then come
            back to create the order.
          </s-paragraph>
        </s-banner>
      )}
      {locations.length === 0 && (
        <s-banner tone="warning" heading="No active location">
          <s-paragraph>
            This store has no active location to deliver to. Activate a location
            in Shopify settings, then reload this page.
          </s-paragraph>
        </s-banner>
      )}

      {canCreate && (
        <s-section>
          <Form method="post" onKeyDown={submitOnEnter}>
            <input type="hidden" name="creationKey" value={creationKey} />
            <s-stack direction="block" gap="base">
              <s-select
                label="Supplier"
                name="supplierId"
                value={selectedSupplierId ?? undefined}
                error={fieldErrors.supplierId}
                required
              >
                {suppliers.map((supplier) => (
                  <s-option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.currency})
                  </s-option>
                ))}
              </s-select>
              <s-select
                label="Deliver to"
                name="locationGid"
                error={fieldErrors.locationGid}
                required
              >
                {locations.map((location) => (
                  <s-option key={location.gid} value={location.gid}>
                    {location.name}
                  </s-option>
                ))}
              </s-select>
              <s-date-field
                label="Expected date"
                name="expectedOn"
                details="Leave empty to use the supplier's lead time."
                error={fieldErrors.expectedOn}
              />
              <s-stack direction="inline" gap="base">
                <s-text-field
                  label="Currency"
                  name="currency"
                  placeholder="Supplier's currency"
                  details="Leave empty to order in the supplier's currency."
                  maxLength={3}
                  error={fieldErrors.currency}
                />
                <s-number-field
                  label="Exchange rate"
                  name="exchangeRate"
                  step={0.000001}
                  details={
                    shopCurrency
                      ? `${shopCurrency} for one unit of the order currency. Only needed when the currencies differ.`
                      : "Shop currency for one unit of the order currency. Only needed when the currencies differ."
                  }
                  error={fieldErrors.exchangeRate}
                />
              </s-stack>
              <s-text-area
                label="Internal notes"
                name="notes"
                maxLength={4000}
                error={fieldErrors.notes}
              />
              <s-stack direction="inline" gap="small-200">
                <s-button
                  type="submit"
                  variant="primary"
                  {...(navigation.state === "submitting"
                    ? { loading: true }
                    : {})}
                >
                  Create draft
                </s-button>
                <s-button href="/app/purchase-orders" variant="tertiary">
                  Cancel
                </s-button>
              </s-stack>
            </s-stack>
          </Form>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
