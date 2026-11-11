/**
 * What a merchant chooses when generating a worksheet: the forecast method
 * and its periods, whose stock to plan, which incoming stock counts, the
 * optional supplier rules, and which products to include.
 *
 * The settings are stored with the worksheet, so a saved worksheet always
 * says how it was produced and can be generated again with the same choices.
 */
import { parseChoice, parseWholeNumber, type FieldErrors } from "../form";
import { isLocalDate, type LocalDate } from "../local-date";
import { isScopeKey, SHOP_SCOPE } from "../scope";
import {
  INCOMING_SOURCES,
  MAX_QUANTITY,
  MAX_SAMPLE_DAYS,
  MAX_SUGGEST_DAYS,
  MIN_DAYS,
  PARITY_METHODS,
  type IncomingSource,
  type MethodParameters,
  type ParityMethod,
  type RoundingOptions,
} from "../types";
import { validateMethodParameters } from "../windows";

const MAX_FILTER_LENGTH = 255;

/** Which products a worksheet covers. Null means no restriction. */
export type WorksheetSelection = {
  vendor: string | null;
  productType: string | null;
  supplierId: string | null;
};

export type WorksheetSettings = {
  params: MethodParameters;
  scopeKey: string;
  incomingSource: IncomingSource;
  rounding: RoundingOptions;
  selection: WorksheetSelection;
};

/** The saved defaults the setup form opens with. */
export type SetupDefaults = {
  defaultMethod: Exclude<ParityMethod, "CUSTOM_RANGE">;
  sampleDays: number;
  suggestDays: number;
  targetQuantity: number | null;
  incomingSource: IncomingSource;
  applyMinimumOrderQuantity: boolean;
  roundUpToPackSize: boolean;
};

/** Field values for the setup form, as text so a rejected entry is kept. */
export type SetupFormValues = {
  method: ParityMethod;
  sampleDays: string;
  suggestDays: string;
  startDate: string;
  endDate: string;
  targetQuantity: string;
  scopeKey: string;
  incomingSource: IncomingSource;
  applyMinimumOrderQuantity: boolean;
  roundUpToPackSize: boolean;
  vendor: string;
  productType: string;
  supplierId: string;
};

export function setupFormFromDefaults(defaults: SetupDefaults): SetupFormValues {
  return {
    method: defaults.defaultMethod,
    sampleDays: String(defaults.sampleDays),
    suggestDays: String(defaults.suggestDays),
    startDate: "",
    endDate: "",
    targetQuantity:
      defaults.targetQuantity == null ? "" : String(defaults.targetQuantity),
    scopeKey: SHOP_SCOPE,
    incomingSource: defaults.incomingSource,
    applyMinimumOrderQuantity: defaults.applyMinimumOrderQuantity,
    roundUpToPackSize: defaults.roundUpToPackSize,
    vendor: "",
    productType: "",
    supplierId: "",
  };
}

/** The setup form filled from an existing worksheet, for "generate again". */
export function setupFormFromSettings(
  settings: WorksheetSettings,
  defaults: SetupDefaults,
): SetupFormValues {
  const { params, selection } = settings;
  const form = setupFormFromDefaults(defaults);
  form.method = params.method;
  if (params.method === "LAST_X_DAYS") form.sampleDays = String(params.sampleDays);
  if ("suggestDays" in params) form.suggestDays = String(params.suggestDays);
  if (params.method === "CUSTOM_RANGE") {
    form.startDate = params.startDate;
    form.endDate = params.endDate;
  }
  if (params.method === "TARGET_STOCK_LEVEL") {
    form.targetQuantity = String(params.targetQuantity);
  }
  form.scopeKey = settings.scopeKey;
  form.incomingSource = settings.incomingSource;
  form.applyMinimumOrderQuantity = settings.rounding.applyMinimumOrderQuantity;
  form.roundUpToPackSize = settings.rounding.roundUpToPackSize;
  form.vendor = selection.vendor ?? "";
  form.productType = selection.productType ?? "";
  form.supplierId = selection.supplierId ?? "";
  return form;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function filterValue(form: FormData, name: string): string | null {
  return field(form, name).slice(0, MAX_FILTER_LENGTH) || null;
}

function parseParams(
  method: ParityMethod,
  form: FormData,
  errors: FieldErrors,
): MethodParameters | null {
  const days = (name: "sampleDays" | "suggestDays", label: string, max: number) =>
    parseWholeNumber(form.get(name), name, label, { min: MIN_DAYS, max }, errors, {
      optional: false,
    });

  switch (method) {
    case "LAST_X_DAYS": {
      const sampleDays = days("sampleDays", "Sales period", MAX_SAMPLE_DAYS);
      const suggestDays = days("suggestDays", "Days to cover", MAX_SUGGEST_DAYS);
      return sampleDays != null && suggestDays != null
        ? { method, sampleDays, suggestDays }
        : null;
    }
    case "CUSTOM_RANGE": {
      const suggestDays = days("suggestDays", "Days to cover", MAX_SUGGEST_DAYS);
      const startDate = field(form, "startDate");
      const endDate = field(form, "endDate");
      if (!isLocalDate(startDate)) errors.startDate = "Enter a valid start date.";
      if (!isLocalDate(endDate)) errors.endDate = "Enter a valid end date.";
      return suggestDays != null && !errors.startDate && !errors.endDate
        ? { method, startDate, endDate, suggestDays }
        : null;
    }
    case "SAME_PERIOD_LAST_YEAR": {
      const suggestDays = days("suggestDays", "Days to cover", MAX_SUGGEST_DAYS);
      return suggestDays != null ? { method, suggestDays } : null;
    }
    case "TARGET_STOCK_LEVEL": {
      const targetQuantity = parseWholeNumber(
        form.get("targetQuantity"),
        "targetQuantity",
        "Target quantity",
        { min: 0, max: MAX_QUANTITY },
        errors,
        { optional: false },
      );
      return targetQuantity != null ? { method, targetQuantity } : null;
    }
    case "FILL_SHELVES":
    case "FILL_SHELVES_IF_BELOW_MIN":
      return { method };
  }
}

export type ParsedSetup =
  | { ok: true; settings: WorksheetSettings }
  | { ok: false; errors: FieldErrors };

/**
 * Reads the setup form. Every field is required to be valid; nothing is
 * silently replaced with a default, because the merchant would then get a
 * worksheet for settings they did not choose.
 */
export function parseWorksheetSetup(form: FormData, asOf: LocalDate): ParsedSetup {
  const errors: FieldErrors = {};

  const method = parseChoice(form.get("method"), PARITY_METHODS);
  if (!method) errors.method = "Choose a forecast method.";

  const scopeKey = field(form, "scopeKey") || SHOP_SCOPE;
  if (!isScopeKey(scopeKey)) errors.scopeKey = "Choose a location.";

  const incomingSource = parseChoice(form.get("incomingSource"), INCOMING_SOURCES);
  if (!incomingSource) {
    errors.incomingSource = "Choose which incoming stock to count.";
  }

  const params = method ? parseParams(method, form, errors) : null;
  if (params) {
    for (const problem of validateMethodParameters(params, asOf)) {
      errors[problem.field] ??= problem.message;
    }
  }

  if (!params || !incomingSource || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    settings: {
      params,
      scopeKey,
      incomingSource,
      rounding: {
        applyMinimumOrderQuantity: form.get("applyMinimumOrderQuantity") === "on",
        roundUpToPackSize: form.get("roundUpToPackSize") === "on",
      },
      selection: {
        vendor: filterValue(form, "vendor"),
        productType: filterValue(form, "productType"),
        supplierId: filterValue(form, "supplierId"),
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDayCount(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DAYS &&
    value <= max
  );
}

function readParams(value: unknown): MethodParameters | null {
  if (!isRecord(value)) return null;
  const method = parseChoice(
    typeof value.method === "string" ? value.method : null,
    PARITY_METHODS,
  );
  switch (method) {
    case "LAST_X_DAYS":
      return isDayCount(value.sampleDays, MAX_SAMPLE_DAYS) &&
        isDayCount(value.suggestDays, MAX_SUGGEST_DAYS)
        ? { method, sampleDays: value.sampleDays, suggestDays: value.suggestDays }
        : null;
    case "CUSTOM_RANGE":
      return isLocalDate(value.startDate) &&
        isLocalDate(value.endDate) &&
        isDayCount(value.suggestDays, MAX_SUGGEST_DAYS)
        ? {
            method,
            startDate: value.startDate,
            endDate: value.endDate,
            suggestDays: value.suggestDays,
          }
        : null;
    case "SAME_PERIOD_LAST_YEAR":
      return isDayCount(value.suggestDays, MAX_SUGGEST_DAYS)
        ? { method, suggestDays: value.suggestDays }
        : null;
    case "TARGET_STOCK_LEVEL":
      return typeof value.targetQuantity === "number" &&
        Number.isInteger(value.targetQuantity) &&
        value.targetQuantity >= 0 &&
        value.targetQuantity <= MAX_QUANTITY
        ? { method, targetQuantity: value.targetQuantity }
        : null;
    case "FILL_SHELVES":
    case "FILL_SHELVES_IF_BELOW_MIN":
      return { method };
    case null:
      return null;
  }
}

function readFilter(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Settings as stored on a worksheet. Returns null when the stored value does
 * not describe a valid run, so a worksheet written by an older or newer
 * version is reported as unreadable instead of being half-understood.
 */
export function readWorksheetSettings(stored: unknown): WorksheetSettings | null {
  if (!isRecord(stored)) return null;
  const params = readParams(stored.params);
  const incomingSource = parseChoice(
    typeof stored.incomingSource === "string" ? stored.incomingSource : null,
    INCOMING_SOURCES,
  );
  const { rounding, selection, scopeKey } = stored;
  if (
    !params ||
    !incomingSource ||
    !isScopeKey(scopeKey) ||
    !isRecord(rounding) ||
    !isRecord(selection)
  ) {
    return null;
  }
  return {
    params,
    scopeKey,
    incomingSource,
    rounding: {
      applyMinimumOrderQuantity: rounding.applyMinimumOrderQuantity === true,
      roundUpToPackSize: rounding.roundUpToPackSize === true,
    },
    selection: {
      vendor: readFilter(selection.vendor),
      productType: readFilter(selection.productType),
      supplierId: readFilter(selection.supplierId),
    },
  };
}
