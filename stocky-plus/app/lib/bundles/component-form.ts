/**
 * The "map a component" form on the Bundles page. The quantity stays a
 * decimal string from the form to the database so a value such as 0.1 is
 * stored exactly.
 */

export type BundleComponentErrors = Partial<
  Record<"bundleVariantId" | "componentVariantId" | "quantity", string>
>;

export type BundleComponentInput = {
  bundleVariantId: string;
  componentVariantId: string;
  /** Plain decimal, above zero, at most four decimals: the column is Decimal(10, 4). */
  quantity: string;
};

const QUANTITY = /^\d{1,6}(\.\d{1,4})?$/;
const MAX_ID_LENGTH = 255;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseBundleComponentForm(
  form: FormData,
): { ok: true; values: BundleComponentInput } | { ok: false; errors: BundleComponentErrors } {
  const errors: BundleComponentErrors = {};
  const bundleVariantId = text(form, "bundleVariantId");
  const componentVariantId = text(form, "componentVariantId");
  const quantity = text(form, "quantity");

  if (bundleVariantId === "" || bundleVariantId.length > MAX_ID_LENGTH) {
    errors.bundleVariantId = "Choose the bundle.";
  }
  if (componentVariantId === "" || componentVariantId.length > MAX_ID_LENGTH) {
    errors.componentVariantId = "Choose the component.";
  } else if (componentVariantId === bundleVariantId) {
    errors.componentVariantId = "A bundle can't contain itself.";
  }
  if (quantity === "") {
    errors.quantity = "Enter how many of the component one bundle uses.";
  } else if (!QUANTITY.test(quantity)) {
    errors.quantity = "Enter a number up to 999,999.9999 with at most four decimals.";
  } else if (Number(quantity) === 0) {
    errors.quantity = "The quantity must be above zero.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, values: { bundleVariantId, componentVariantId, quantity } };
}
