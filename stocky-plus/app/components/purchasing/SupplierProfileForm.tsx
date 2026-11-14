import { Form, useNavigation } from "react-router";
import { submitOnEnter } from "../../lib/submit-on-enter";
import type { SupplierProfileValues } from "../../services/purchasing/supplier-view.server";

/**
 * The supplier profile, shared by the new-supplier page and the supplier page.
 * Read-only fields are not offered: an archived supplier shows no form.
 */
export function SupplierProfileForm({
  intent,
  values,
  contactMethods,
  fieldErrors,
  submitLabel,
  cancelHref,
}: {
  intent: string;
  values: SupplierProfileValues;
  contactMethods: Array<{ value: string; label: string }>;
  fieldErrors: Record<string, string>;
  submitLabel: string;
  cancelHref?: string;
}) {
  const navigation = useNavigation();
  const submitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === intent;

  return (
    <Form method="post" onKeyDown={submitOnEnter}>
      <input type="hidden" name="intent" value={intent} />
      <s-stack direction="block" gap="base">
        <s-text-field
          label="Supplier name"
          name="name"
          value={values.name}
          maxLength={255}
          error={fieldErrors.name}
          required
        />
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Currency"
            name="currency"
            value={values.currency}
            maxLength={3}
            details="The currency this supplier invoices in, such as USD."
            error={fieldErrors.currency}
            required
          />
          <s-text-field
            label="Account number"
            name="accountNumber"
            value={values.accountNumber}
            maxLength={128}
            details="Your account with this supplier."
            error={fieldErrors.accountNumber}
          />
        </s-stack>

        <s-heading>Contact</s-heading>
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Contact name"
            name="contactName"
            value={values.contactName}
            maxLength={255}
            error={fieldErrors.contactName}
          />
          <s-email-field
            label="Contact email"
            name="contactEmail"
            value={values.contactEmail}
            error={fieldErrors.contactEmail}
          />
          <s-text-field
            label="Contact phone"
            name="contactPhone"
            value={values.contactPhone}
            maxLength={64}
            error={fieldErrors.contactPhone}
          />
        </s-stack>
        <s-stack direction="inline" gap="base">
          <s-select
            label="Preferred contact method"
            name="preferredContactMethod"
            value={values.preferredContactMethod}
            error={fieldErrors.preferredContactMethod}
          >
            <s-option value="">Not set</s-option>
            {contactMethods.map((method) => (
              <s-option key={method.value} value={method.value}>
                {method.label}
              </s-option>
            ))}
          </s-select>
          <s-url-field
            label="Website"
            name="website"
            value={values.website}
            error={fieldErrors.website}
          />
        </s-stack>

        <s-heading>Address</s-heading>
        <s-text-field
          label="Address"
          name="addressLine1"
          value={values.addressLine1}
          maxLength={255}
          error={fieldErrors.addressLine1}
        />
        <s-text-field
          label="Address line 2"
          name="addressLine2"
          value={values.addressLine2}
          maxLength={255}
          error={fieldErrors.addressLine2}
        />
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="City"
            name="city"
            value={values.city}
            maxLength={128}
            error={fieldErrors.city}
          />
          <s-text-field
            label="State or province"
            name="region"
            value={values.region}
            maxLength={128}
            error={fieldErrors.region}
          />
          <s-text-field
            label="Postal code"
            name="postalCode"
            value={values.postalCode}
            maxLength={32}
            error={fieldErrors.postalCode}
          />
          <s-text-field
            label="Country"
            name="countryCode"
            value={values.countryCode}
            maxLength={2}
            details="2-letter code, such as US."
            error={fieldErrors.countryCode}
          />
        </s-stack>

        <s-heading>Ordering defaults</s-heading>
        <s-stack direction="inline" gap="base">
          <s-number-field
            label="Lead time (days)"
            name="defaultLeadTimeDays"
            value={values.defaultLeadTimeDays}
            min={0}
            max={730}
            step={1}
            details="Days from ordering to delivery. Sets the expected date of new orders."
            error={fieldErrors.defaultLeadTimeDays}
          />
          <s-number-field
            label="Days between orders"
            name="defaultRestockDays"
            value={values.defaultRestockDays}
            min={0}
            max={730}
            step={1}
            error={fieldErrors.defaultRestockDays}
          />
        </s-stack>
        <s-stack direction="inline" gap="base">
          <s-number-field
            label="Minimum order value"
            name="minimumOrderValue"
            value={values.minimumOrderValue}
            min={0}
            step={0.01}
            error={fieldErrors.minimumOrderValue}
          />
          <s-number-field
            label="Tax rate (%)"
            name="defaultTaxRatePercent"
            value={values.defaultTaxRatePercent}
            min={0}
            max={100}
            step={0.0001}
            details="Applied to new lines on this supplier's orders."
            error={fieldErrors.defaultTaxRatePercent}
          />
        </s-stack>
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Payment terms"
            name="paymentTerms"
            value={values.paymentTerms}
            maxLength={255}
            placeholder="Net 30"
            error={fieldErrors.paymentTerms}
          />
          <s-text-field
            label="Shipping terms"
            name="shippingTerms"
            value={values.shippingTerms}
            maxLength={255}
            placeholder="FOB origin"
            error={fieldErrors.shippingTerms}
          />
        </s-stack>
        <s-text-area
          label="Notes"
          name="vendorNotes"
          value={values.vendorNotes}
          maxLength={4000}
          rows={3}
          error={fieldErrors.vendorNotes}
        />

        <s-stack direction="inline" gap="small-200">
          <s-button
            type="submit"
            variant="primary"
            {...(submitting ? { loading: true } : {})}
          >
            {submitLabel}
          </s-button>
          {cancelHref && (
            <s-button href={cancelHref} variant="tertiary">
              Cancel
            </s-button>
          )}
        </s-stack>
      </s-stack>
    </Form>
  );
}
