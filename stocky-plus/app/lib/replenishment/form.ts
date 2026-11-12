/**
 * Strict parsing for replenishment form fields. Merchant input arrives as
 * strings; anything that isn't a plain whole number in range is rejected
 * with a message for that field rather than coerced.
 */

export type FieldErrors = Record<string, string>;

export const MAX_LEAD_TIME_DAYS = 365;

export function parseWholeNumber(
  raw: FormDataEntryValue | null,
  field: string,
  label: string,
  range: { min: number; max: number },
  errors: FieldErrors,
  { optional }: { optional: boolean },
): number | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") {
    if (!optional) errors[field] = `${label} is required.`;
    return null;
  }
  if (!/^\d+$/.test(text)) {
    errors[field] = `${label} must be a whole number.`;
    return null;
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < range.min || value > range.max) {
    errors[field] = `${label} must be between ${range.min} and ${range.max}.`;
    return null;
  }
  return value;
}

export function parseChoice<T extends string>(
  raw: FormDataEntryValue | null,
  allowed: readonly T[],
): T | null {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : null;
}
