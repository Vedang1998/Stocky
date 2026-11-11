/**
 * Read a submitted form value as a whole number within [min, max].
 * Returns null for anything else, including "", "1.5", "1e3" and " 12abc".
 */
export function parseWholeNumber(
  value: unknown,
  range: { min: number; max: number },
): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d{1,10}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= range.min && parsed <= range.max ? parsed : null;
}

/** Read a submitted form value as a non-empty string of bounded length. */
export function readFormId(value: unknown, maxLength = 191): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}
