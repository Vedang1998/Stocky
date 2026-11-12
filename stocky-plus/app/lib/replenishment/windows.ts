import {
  addDays,
  addYears,
  compareLocalDates,
  inclusiveDayCount,
  isLocalDate,
  type LocalDate,
} from "./local-date";
import {
  MAX_QUANTITY,
  MAX_SAMPLE_DAYS,
  MAX_SUGGEST_DAYS,
  MIN_DAYS,
  type MethodParameters,
  type SampleWindow,
} from "./types";

export type ParameterError = { field: string; message: string };

function checkDayCount(
  errors: ParameterError[],
  field: string,
  value: number,
  maxDays: number,
): void {
  if (!Number.isInteger(value) || value < MIN_DAYS || value > maxDays) {
    errors.push({
      field,
      message: `Enter a whole number of days from ${MIN_DAYS} to ${maxDays}.`,
    });
  }
}

/**
 * Validates method parameters against the run date. Returns every problem
 * at once so a form can show them together; an empty list means valid.
 */
export function validateMethodParameters(
  params: MethodParameters,
  asOf: LocalDate,
): ParameterError[] {
  const errors: ParameterError[] = [];
  switch (params.method) {
    case "LAST_X_DAYS":
      checkDayCount(errors, "sampleDays", params.sampleDays, MAX_SAMPLE_DAYS);
      checkDayCount(
        errors,
        "suggestDays",
        params.suggestDays,
        MAX_SUGGEST_DAYS,
      );
      break;
    case "CUSTOM_RANGE": {
      checkDayCount(
        errors,
        "suggestDays",
        params.suggestDays,
        MAX_SUGGEST_DAYS,
      );
      const startValid = isLocalDate(params.startDate);
      const endValid = isLocalDate(params.endDate);
      if (!startValid) {
        errors.push({
          field: "startDate",
          message: "Enter a valid start date.",
        });
      }
      if (!endValid) {
        errors.push({ field: "endDate", message: "Enter a valid end date." });
      }
      if (startValid && endValid) {
        if (compareLocalDates(params.startDate, params.endDate) > 0) {
          errors.push({
            field: "endDate",
            message: "End date must be on or after the start date.",
          });
        } else if (compareLocalDates(params.endDate, asOf) > 0) {
          errors.push({
            field: "endDate",
            message: "End date cannot be in the future.",
          });
        } else if (
          inclusiveDayCount(params.startDate, params.endDate) > MAX_SAMPLE_DAYS
        ) {
          errors.push({
            field: "startDate",
            message: `Choose a range of at most ${MAX_SAMPLE_DAYS} days.`,
          });
        }
      }
      break;
    }
    case "SAME_PERIOD_LAST_YEAR":
      checkDayCount(
        errors,
        "suggestDays",
        params.suggestDays,
        MAX_SUGGEST_DAYS,
      );
      break;
    case "TARGET_STOCK_LEVEL":
      if (
        !Number.isInteger(params.targetQuantity) ||
        params.targetQuantity < 0 ||
        params.targetQuantity > MAX_QUANTITY
      ) {
        errors.push({
          field: "targetQuantity",
          message: `Enter a whole number from 0 to ${MAX_QUANTITY}.`,
        });
      }
      break;
    case "FILL_SHELVES":
    case "FILL_SHELVES_IF_BELOW_MIN":
      break;
  }
  return errors;
}

/**
 * The calendar days whose sales feed a sales-based method, or null for
 * methods that only look at stock levels.
 *
 * Last X days uses the X complete days before the run date, so a worksheet
 * gives the same answer at 9am and 9pm. Same period last year starts on the
 * run date one year earlier and covers the "suggest for" days, matching
 * Stocky's "how much did we sell in the next N days last year".
 */
export function sampleWindowFor(
  params: MethodParameters,
  asOf: LocalDate,
): SampleWindow | null {
  switch (params.method) {
    case "LAST_X_DAYS": {
      const end = addDays(asOf, -1);
      const start = addDays(end, -(params.sampleDays - 1));
      return { start, end, days: params.sampleDays };
    }
    case "CUSTOM_RANGE":
      return {
        start: params.startDate,
        end: params.endDate,
        days: inclusiveDayCount(params.startDate, params.endDate),
      };
    case "SAME_PERIOD_LAST_YEAR": {
      const start = addYears(asOf, -1);
      const end = addDays(start, params.suggestDays - 1);
      return { start, end, days: params.suggestDays };
    }
    case "FILL_SHELVES":
    case "FILL_SHELVES_IF_BELOW_MIN":
    case "TARGET_STOCK_LEVEL":
      return null;
  }
}

/** How many days ahead the suggestion covers, when the method has one. */
export function suggestDaysFor(params: MethodParameters): number | null {
  switch (params.method) {
    case "LAST_X_DAYS":
    case "CUSTOM_RANGE":
    case "SAME_PERIOD_LAST_YEAR":
      return params.suggestDays;
    default:
      return null;
  }
}
