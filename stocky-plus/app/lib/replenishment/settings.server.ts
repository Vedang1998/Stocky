/**
 * Shop-level replenishment defaults: the method, windows and opt-in supplier
 * rules a new worksheet opens with. Merchants change them in Settings; a
 * worksheet can override any of them for one run without saving.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { isUniqueViolation } from "./db-errors.server";
import {
  DEFAULT_WORKSHEET_COLUMNS,
  readWorksheetColumns,
  type WorksheetColumn,
} from "./worksheet/columns";
import {
  INCOMING_SOURCES,
  MAX_QUANTITY,
  MAX_SAMPLE_DAYS,
  MAX_SUGGEST_DAYS,
  MIN_DAYS,
  PARITY_METHODS,
  type IncomingSource,
  type ParityMethod,
} from "./types";
import {
  MAX_LEAD_TIME_DAYS,
  parseChoice,
  parseWholeNumber,
  type FieldErrors,
} from "./form";

/** Methods that can be a stored default. A custom range needs dates. */
export const DEFAULTABLE_METHODS = PARITY_METHODS.filter(
  (method): method is Exclude<ParityMethod, "CUSTOM_RANGE"> =>
    method !== "CUSTOM_RANGE",
);

export type DefaultableMethod = (typeof DEFAULTABLE_METHODS)[number];

export type ReplenishmentDefaults = {
  defaultMethod: DefaultableMethod;
  sampleDays: number;
  suggestDays: number;
  targetQuantity: number | null;
  incomingSource: IncomingSource;
  defaultLeadTimeDays: number | null;
  applyMinimumOrderQuantity: boolean;
  roundUpToPackSize: boolean;
};

/** What a shop gets before it saves anything. Matches the column defaults. */
export const INITIAL_DEFAULTS: ReplenishmentDefaults = {
  defaultMethod: "LAST_X_DAYS",
  sampleDays: 30,
  suggestDays: 30,
  targetQuantity: null,
  incomingSource: "SHOPIFY_INCOMING",
  defaultLeadTimeDays: null,
  applyMinimumOrderQuantity: false,
  roundUpToPackSize: false,
};

type SettingsRow = ReplenishmentDefaults & { id: string; updatedAt: Date };

export type StoredDefaults = ReplenishmentDefaults & {
  /** Null until the merchant saves settings for the first time. */
  updatedAt: Date | null;
};

function fromRow(row: SettingsRow): StoredDefaults {
  return {
    defaultMethod: row.defaultMethod,
    sampleDays: row.sampleDays,
    suggestDays: row.suggestDays,
    targetQuantity: row.targetQuantity,
    incomingSource: row.incomingSource,
    defaultLeadTimeDays: row.defaultLeadTimeDays,
    applyMinimumOrderQuantity: row.applyMinimumOrderQuantity,
    roundUpToPackSize: row.roundUpToPackSize,
    updatedAt: row.updatedAt,
  };
}

/** Reads the shop's defaults. Never writes, so it is safe in a loader. */
export async function getReplenishmentDefaults(
  db: TenantDb,
): Promise<StoredDefaults> {
  const row = (await db.replenishmentSettings.findFirst(
    {},
  )) as SettingsRow | null;
  return row ? fromRow(row) : { ...INITIAL_DEFAULTS, updatedAt: null };
}

/**
 * Writes part of the shop's settings row, creating it with the column
 * defaults for everything else the first time.
 */
async function writeSettings<Row>(
  db: TenantDb,
  data: Record<string, unknown>,
): Promise<Row> {
  const write = async (): Promise<Row> => {
    const existing = (await db.replenishmentSettings.findFirst({
      select: { id: true },
    })) as { id: string } | null;
    if (existing) {
      return (await db.replenishmentSettings.update({
        where: { shopId_id: { shopId: db.authority.shopId, id: existing.id } },
        data,
      })) as Row;
    }
    return (await db.replenishmentSettings.create({ data })) as Row;
  };

  try {
    return await write();
  } catch (error) {
    // Two first-time saves raced; the other one created the row. Update it.
    if (!isUniqueViolation(error)) throw error;
    return write();
  }
}

export async function saveReplenishmentDefaults(
  db: TenantDb,
  values: ReplenishmentDefaults,
): Promise<StoredDefaults> {
  return fromRow(await writeSettings<SettingsRow>(db, values));
}

/** The optional worksheet columns the shop shows. Never writes. */
export async function getWorksheetColumns(db: TenantDb): Promise<WorksheetColumn[]> {
  const row = (await db.replenishmentSettings.findFirst({
    select: { worksheetColumns: true },
  })) as { worksheetColumns: string[] | null } | null;
  return row?.worksheetColumns
    ? readWorksheetColumns(row.worksheetColumns)
    : [...DEFAULT_WORKSHEET_COLUMNS];
}

/** Saves the shop's choice of worksheet columns; unknown names are dropped. */
export async function saveWorksheetColumns(
  db: TenantDb,
  columns: readonly unknown[],
): Promise<WorksheetColumn[]> {
  const row = await writeSettings<{ worksheetColumns: string[] }>(db, {
    worksheetColumns: readWorksheetColumns(columns),
  });
  return readWorksheetColumns(row.worksheetColumns);
}

/** Validates the Settings form. Returns either values or per-field errors. */
export function parseDefaultsForm(
  form: FormData,
):
  | { ok: true; values: ReplenishmentDefaults }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const defaultMethod = parseChoice(
    form.get("defaultMethod"),
    DEFAULTABLE_METHODS,
  );
  if (!defaultMethod) errors.defaultMethod = "Choose a forecast method.";

  const incomingSource = parseChoice(
    form.get("incomingSource"),
    INCOMING_SOURCES,
  );
  if (!incomingSource)
    errors.incomingSource = "Choose where incoming stock comes from.";

  const sampleDays = parseWholeNumber(
    form.get("sampleDays"),
    "sampleDays",
    "Sales period",
    { min: MIN_DAYS, max: MAX_SAMPLE_DAYS },
    errors,
    { optional: false },
  );
  const suggestDays = parseWholeNumber(
    form.get("suggestDays"),
    "suggestDays",
    "Suggest for",
    { min: MIN_DAYS, max: MAX_SUGGEST_DAYS },
    errors,
    { optional: false },
  );
  const targetQuantity = parseWholeNumber(
    form.get("targetQuantity"),
    "targetQuantity",
    "Target quantity",
    { min: 0, max: MAX_QUANTITY },
    errors,
    { optional: defaultMethod !== "TARGET_STOCK_LEVEL" },
  );
  const defaultLeadTimeDays = parseWholeNumber(
    form.get("defaultLeadTimeDays"),
    "defaultLeadTimeDays",
    "Default lead time",
    { min: 0, max: MAX_LEAD_TIME_DAYS },
    errors,
    { optional: true },
  );

  if (Object.keys(errors).length > 0 || !defaultMethod || !incomingSource) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      defaultMethod,
      sampleDays: sampleDays as number,
      suggestDays: suggestDays as number,
      targetQuantity,
      incomingSource,
      defaultLeadTimeDays,
      applyMinimumOrderQuantity: form.get("applyMinimumOrderQuantity") === "on",
      roundUpToPackSize: form.get("roundUpToPackSize") === "on",
    },
  };
}
