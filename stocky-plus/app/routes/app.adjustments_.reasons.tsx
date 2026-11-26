import { useState } from "react";
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
import { requireActivePlanSnapshot } from "../billing/entitlements.server";
import { ActionFeedback } from "../components/ActionFeedback";
import { PlanRequiredBanner } from "../components/PlanRequiredBanner";
import { chosen } from "../lib/chosen-option";
import { submitOnEnter } from "../lib/submit-on-enter";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  ADJUSTMENT_REASONS,
  MAX_ADJUSTMENT_REASON_NAME_LENGTH,
  MAX_OWN_ADJUSTMENT_REASONS,
  adjustmentReasonLabel,
} from "../services/adjustments/adjustment-input";
import {
  addOwnAdjustmentReason,
  listOwnAdjustmentReasons,
  removeOwnAdjustmentReason,
  updateOwnAdjustmentReason,
  type OwnAdjustmentReason,
} from "../services/adjustments/adjustment-reasons.server";
import {
  requireAdminTenantWithActor,
  STAFF_REQUIRED_MESSAGE,
} from "../services/inventory-writes/actor.server";
import { readFormId } from "../services/inventory-writes/form-values";
import { planAllowsChanges } from "../services/inventory-writes/plan-access.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const [planActive, reasons] = await Promise.all([
    planAllowsChanges(db),
    listOwnAdjustmentReasons(db),
  ]);
  return { planActive, reasons };
};

type AddValues = { name: string; shopifyReason: string };

/**
 * A submitted name, cut well past the limit: a pasted name may carry spaces
 * that are removed before it is measured, and a rejected name is sent back to
 * the form.
 */
const readName = (value: FormDataEntryValue | null): string =>
  typeof value === "string"
    ? value.slice(0, MAX_ADJUSTMENT_REASON_NAME_LENGTH * 4)
    : "";

const text = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value : "";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { db, actor } = await requireAdminTenantWithActor({ request });
  await requireActivePlanSnapshot(db);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent !== "add" && intent !== "update" && intent !== "remove") {
    return { error: "That action is not available." };
  }
  if (!actor) return { error: STAFF_REQUIRED_MESSAGE };

  if (intent === "add") {
    const values: AddValues = {
      name: readName(form.get("name")),
      shopifyReason: text(form.get("shopifyReason")),
    };
    const result = await addOwnAdjustmentReason(db, actor, values);
    return result.ok
      ? { ok: true, notice: `"${result.reason.name}" was added.` }
      : { error: result.error, values };
  }

  const id = readFormId(form.get("id"), 64);
  if (!id) return { error: "Reason not found" };

  if (intent === "update") {
    const result = await updateOwnAdjustmentReason(db, actor, id, {
      name: readName(form.get("name")),
      shopifyReason: text(form.get("shopifyReason")),
    });
    return result.ok
      ? { ok: true, notice: `"${result.reason.name}" was saved.` }
      : { error: result.error };
  }

  const result = await removeOwnAdjustmentReason(db, id);
  return result.ok
    ? {
        ok: true,
        notice: `"${result.reason.name}" was removed. Adjustments recorded with it keep the name.`,
      }
    : { error: result.error };
};

function ShopifyReasonSelect({ value }: { value: string | undefined }) {
  return (
    <s-select label="Counts in Shopify as" name="shopifyReason" required>
      {ADJUSTMENT_REASONS.map((reason) => (
        <s-option
          key={reason.code}
          value={reason.code}
          {...chosen(reason.code === value)}
        >
          {reason.label}
        </s-option>
      ))}
    </s-select>
  );
}

function EditReason({
  reason,
  locked,
  onDone,
}: {
  reason: OwnAdjustmentReason;
  locked: boolean;
  onDone: () => void;
}) {
  return (
    <s-section heading={`Edit "${reason.name}"`}>
      <Form method="post" onKeyDown={submitOnEnter}>
        <input type="hidden" name="intent" value="update" />
        <input type="hidden" name="id" value={reason.id} />
        <s-stack direction="inline" gap="base" alignItems="end">
          <s-text-field
            label="Name"
            name="name"
            value={reason.name}
            maxLength={MAX_ADJUSTMENT_REASON_NAME_LENGTH}
            required
          />
          <ShopifyReasonSelect value={reason.shopifyReason} />
          <s-button
            type="submit"
            variant="primary"
            {...(locked ? { disabled: true } : {})}
          >
            Save
          </s-button>
          <s-button variant="secondary" onClick={onDone}>
            Cancel
          </s-button>
        </s-stack>
      </Form>
    </s-section>
  );
}

export default function AdjustmentReasons() {
  const { planActive, reasons } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  // Nothing is submitted twice, and nothing at all without an active plan.
  const locked = navigation.state !== "idle" || !planActive;
  const full = reasons.length >= MAX_OWN_ADJUSTMENT_REASONS;
  // The reason being edited, and the last action result when Edit was pressed.
  const [edit, setEdit] = useState<{ id: string; since: unknown } | null>(null);
  // The edit form closes once something is saved after it was opened. When a
  // save is refused it stays open, with what was typed.
  const saved =
    Boolean(actionData && "ok" in actionData) && actionData !== edit?.since;
  const editing = saved
    ? undefined
    : reasons.find((reason) => reason.id === edit?.id);
  const disabled = locked ? { disabled: true } : {};

  const values: Partial<AddValues> =
    (actionData && "values" in actionData ? actionData.values : undefined) ??
    {};

  return (
    <s-page heading="Adjustment reasons">
      <s-link slot="breadcrumb-actions" href="/app/adjustments">
        Adjustments
      </s-link>
      {!planActive && <PlanRequiredBanner records="Adjustment reasons" />}
      <ActionFeedback data={actionData} errorHeading="Reason issue" />

      <s-section heading="Your reasons">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Reasons you add here appear in the Reason list of a new adjustment,
            after the built-in ones (
            {ADJUSTMENT_REASONS.map((reason) => reason.label).join(", ")}).
            Shopify keeps its own fixed list of reasons, so each of yours names
            the Shopify reason it is recorded under there.
          </s-paragraph>
          {reasons.length === 0 ? (
            <s-paragraph>
              You have not added any reasons yet. Add the first one below, for
              example &quot;Sent to photo studio&quot; or &quot;Staff
              purchase&quot;.
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Reason</s-table-header>
                <s-table-header>Counts in Shopify as</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {reasons.map((reason) => (
                  <s-table-row key={reason.id}>
                    <s-table-cell>{reason.name}</s-table-cell>
                    <s-table-cell>
                      {adjustmentReasonLabel(reason.shopifyReason)}
                    </s-table-cell>
                    <s-table-cell>
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="id" value={reason.id} />
                        <s-stack direction="inline" gap="small">
                          <s-button
                            variant="secondary"
                            onClick={() =>
                              setEdit({ id: reason.id, since: actionData })
                            }
                            {...disabled}
                          >
                            Edit
                          </s-button>
                          <s-button
                            type="submit"
                            variant="tertiary"
                            tone="critical"
                            {...disabled}
                          >
                            Remove
                          </s-button>
                        </s-stack>
                      </Form>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
          <s-text color="subdued">
            Renaming or removing a reason does not change adjustments already
            recorded: each keeps the name and the Shopify reason it was recorded
            with.
          </s-text>
        </s-stack>
      </s-section>

      {editing && (
        // Remounted for each reason so the fields start from its values.
        <EditReason
          key={editing.id}
          reason={editing}
          locked={locked}
          onDone={() => setEdit(null)}
        />
      )}

      <s-section heading="Add a reason">
        {full ? (
          <s-paragraph>
            You have {MAX_OWN_ADJUSTMENT_REASONS} reasons, which is the most a
            shop can have. Remove one you no longer use to add another.
          </s-paragraph>
        ) : (
          // Remounted after each addition so the form comes back empty.
          <Form method="post" onKeyDown={submitOnEnter} key={reasons.length}>
            <input type="hidden" name="intent" value="add" />
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-text-field
                label="Name"
                name="name"
                value={values.name ?? ""}
                maxLength={MAX_ADJUSTMENT_REASON_NAME_LENGTH}
                required
              />
              <ShopifyReasonSelect value={values.shopifyReason} />
              <s-button
                type="submit"
                variant="primary"
                {...(navigation.state === "submitting"
                  ? { loading: true }
                  : {})}
                {...(planActive ? {} : { disabled: true })}
              >
                Add reason
              </s-button>
            </s-stack>
          </Form>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
