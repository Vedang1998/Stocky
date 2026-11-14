import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import { SupplierProfileForm } from "../components/purchasing/SupplierProfileForm";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { createSupplierFromForm } from "../services/purchasing/supplier-actions.server";
import {
  contactMethodOptions,
  emptySupplierProfile,
} from "../services/purchasing/supplier-view.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await requireAdminTenant({ request });
  const profile = await readShopProfile(admin);
  return {
    values: emptySupplierProfile(profile.currencyCode),
    contactMethods: contactMethodOptions(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const context = await requirePurchasingContext({ request });
  return createSupplierFromForm(context, await request.formData());
};

export default function NewSupplier() {
  const { values, contactMethods } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fieldErrors =
    actionData && !actionData.ok ? actionData.fieldErrors : {};

  return (
    <s-page heading="Add supplier">
      <s-link slot="breadcrumb-actions" href="/app/suppliers">
        Suppliers
      </s-link>
      <ActionFeedback data={actionData} errorHeading="Supplier not added" />
      <s-section>
        <SupplierProfileForm
          intent="create"
          values={values}
          contactMethods={contactMethods}
          fieldErrors={fieldErrors}
          submitLabel="Add supplier"
          cancelHref="/app/suppliers"
        />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
