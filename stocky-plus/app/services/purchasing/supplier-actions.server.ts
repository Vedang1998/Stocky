/**
 * The form intents of the supplier pages. Each intent parses its fields
 * strictly and runs one command; supplier rules live in the commands.
 */
import { redirect } from "react-router";
import { FormReader } from "../../lib/purchasing/form-input";
import {
  actionFailure,
  invalidForm,
  purchasingAction,
  type PurchasingActionResult,
} from "./action-result.server";
import type { PurchasingContext } from "./actor.server";
import {
  addPriceTier,
  addSupplierProducts,
  addSupplierProductsByVendor,
  createSupplier,
  deleteSupplier,
  parsePriceTierForm,
  parseSupplierProductForm,
  parseSupplierProfileForm,
  removePriceTier,
  removeSupplierProduct,
  saveSupplierProduct,
  setSupplierArchived,
  updateSupplier,
} from "./suppliers.server";

type ActionContext = Pick<PurchasingContext, "admin" | "db" | "actor">;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function addedNotice(result: {
  added: number;
  alreadyLinked: number;
  unavailable: number;
}): string {
  const parts = [
    result.added > 0
      ? `${plural(result.added, "product", "products")} added`
      : "No products added",
  ];
  if (result.alreadyLinked > 0) {
    parts.push(
      `${plural(result.alreadyLinked, "was", "were")} already on this supplier`,
    );
  }
  if (result.unavailable > 0) {
    parts.push(
      `${plural(result.unavailable, "is", "are")} no longer in Shopify`,
    );
  }
  return `${parts.join("; ")}.`;
}

/** The new-supplier form: creates the supplier and opens its page. */
export async function createSupplierFromForm(
  context: ActionContext,
  formData: FormData,
): Promise<PurchasingActionResult | Response> {
  const form = new FormReader(formData);
  const input = parseSupplierProfileForm(form);
  if (!input) return invalidForm("create", form);
  return purchasingAction("create", async () => {
    const { id } = await createSupplier(context.db, context.actor, input);
    return redirect(`/app/suppliers/${id}`);
  });
}

export async function runSupplierIntent(
  context: ActionContext,
  supplierId: string,
  formData: FormData,
): Promise<PurchasingActionResult | Response> {
  const { admin, db, actor } = context;
  const form = new FormReader(formData);
  const intent = form.raw("intent") ?? "";

  switch (intent) {
    case "saveProfile": {
      const input = parseSupplierProfileForm(form);
      if (!input) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await updateSupplier(db, actor, supplierId, input);
        return "Supplier saved.";
      });
    }
    case "archive":
    case "restore":
      return purchasingAction(intent, async () => {
        await setSupplierArchived(db, actor, supplierId, intent === "archive");
        return intent === "archive"
          ? "Supplier archived."
          : "Supplier restored.";
      });
    case "delete":
      return purchasingAction(intent, async () => {
        await deleteSupplier(db, actor, supplierId);
        return redirect("/app/suppliers");
      });
    case "addProduct": {
      const variantGid = form.text("variantGid", {
        required: true,
        maxLength: 256,
        label: "Product",
      });
      if (!form.ok || !variantGid) return invalidForm(intent, form);
      return purchasingAction(intent, async () =>
        addedNotice(
          await addSupplierProducts(db, actor, supplierId, [variantGid], {
            admin,
          }),
        ),
      );
    }
    case "addVendor": {
      const vendor = form.text("vendor", {
        required: true,
        maxLength: 255,
        label: "Vendor",
      });
      if (!form.ok || !vendor) return invalidForm(intent, form);
      return purchasingAction(intent, async () =>
        addedNotice(
          await addSupplierProductsByVendor(db, actor, supplierId, vendor),
        ),
      );
    }
    case "saveProduct": {
      const input = parseSupplierProductForm(form);
      if (!input) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        const { created } = await saveSupplierProduct(
          db,
          actor,
          supplierId,
          input,
          { admin },
        );
        return created ? "Product added." : "Product terms saved.";
      });
    }
    case "removeProduct": {
      const mappingId = form.text("mappingId", {
        required: true,
        maxLength: 64,
        label: "Product",
      });
      if (!form.ok || !mappingId) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await removeSupplierProduct(db, actor, supplierId, mappingId);
        return redirect(`/app/suppliers/${supplierId}`);
      });
    }
    case "addTier": {
      const input = parsePriceTierForm(form);
      if (!input) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await addPriceTier(db, actor, supplierId, input);
        return "Price tier added.";
      });
    }
    case "removeTier": {
      const tierId = form.text("tierId", {
        required: true,
        maxLength: 64,
        label: "Price tier",
      });
      if (!form.ok || !tierId) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await removePriceTier(db, actor, supplierId, tierId);
        return "Price tier removed.";
      });
    }
    default:
      return actionFailure(intent, "That action is not available.");
  }
}
