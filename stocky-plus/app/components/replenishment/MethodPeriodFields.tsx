import type { FieldErrors } from "../../lib/replenishment/form";
import {
  MAX_QUANTITY,
  MAX_SAMPLE_DAYS,
  MAX_SUGGEST_DAYS,
  SALES_BASED_METHODS,
  type ParityMethod,
} from "../../lib/replenishment/types";

export type MethodPeriodValues = {
  sampleDays: string;
  suggestDays: string;
  startDate: string;
  endDate: string;
  targetQuantity: string;
};

/**
 * The fields a forecast method needs beyond its name. Rendered as siblings
 * so the caller decides the layout they sit in.
 */
export function MethodPeriodFields({
  method,
  values,
  errors,
}: {
  method: ParityMethod;
  values: MethodPeriodValues;
  errors: FieldErrors;
}) {
  return (
    <>
      {method === "LAST_X_DAYS" && (
        <s-number-field
          label="Sales period"
          name="sampleDays"
          suffix="days"
          min={1}
          max={MAX_SAMPLE_DAYS}
          step={1}
          value={values.sampleDays}
          error={errors.sampleDays}
        />
      )}
      {method === "CUSTOM_RANGE" && (
        <>
          <s-date-field
            label="Sales from"
            name="startDate"
            value={values.startDate}
            error={errors.startDate}
          />
          <s-date-field
            label="Sales to"
            name="endDate"
            value={values.endDate}
            error={errors.endDate}
          />
        </>
      )}
      {SALES_BASED_METHODS.has(method) && (
        <s-number-field
          label="Days to cover"
          name="suggestDays"
          suffix="days"
          min={1}
          max={MAX_SUGGEST_DAYS}
          step={1}
          value={values.suggestDays}
          error={errors.suggestDays}
        />
      )}
      {method === "TARGET_STOCK_LEVEL" && (
        <s-number-field
          label="Target quantity"
          name="targetQuantity"
          min={0}
          max={MAX_QUANTITY}
          step={1}
          value={values.targetQuantity}
          error={errors.targetQuantity}
        />
      )}
    </>
  );
}
