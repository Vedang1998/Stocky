import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireActivePlanSnapshot } from "../billing/entitlements.server";
import { ActionFeedback } from "../components/ActionFeedback";
import { PlanRequiredBanner } from "../components/PlanRequiredBanner";
import { SupplierProfileForm } from "../components/purchasing/SupplierProfileForm";
import { planAllowsChanges } from "../services/inventory-writes/plan-access.server";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { createSupplierFromForm } from "../services/purchasing/supplier-actions.server";
import {
  contactMethodOptions,
  emptySupplierProfile,
} from "../services/purchasing/supplier-view.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const [profile, planActive] = await Promise.all([
    readShopProfile(admin),
    planAllowsChanges(db),
  ]);
  return {
    values: emptySupplierProfile(profile.currencyCode),
    contactMethods: contactMethodOptions(),
    planActive,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const context = await requirePurchasingContext({ request });
  await requireActivePlanSnapshot(context.db);
  return createSupplierFromForm(context, await request.formData());
};

export default function NewSupplier() {
  const { values, contactMethods, planActive } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fieldErrors =
    actionData && !actionData.ok ? actionData.fieldErrors : {};

  return (
    <s-page heading="Add supplier">
      <s-link slot="breadcrumb-actions" href="/app/suppliers">
        Suppliers
      </s-link>
      {!planActive && <PlanRequiredBanner records="Suppliers" />}
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
