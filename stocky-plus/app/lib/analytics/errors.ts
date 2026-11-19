/**
 * Shop facts a report needs before it can compute anything. Routes catch this
 * and render a "data not ready" state instead of guessing a default.
 */
export type AnalyticsPrerequisite = "shop_timezone" | "shop_currency";

export class AnalyticsPrerequisiteError extends Error {
  readonly missing: AnalyticsPrerequisite;

  constructor(missing: AnalyticsPrerequisite, message: string) {
    super(message);
    this.name = "AnalyticsPrerequisiteError";
    this.missing = missing;
  }
}

export function requireShopCurrency(currencyCode: string | null | undefined): string {
  const code = currencyCode?.trim().toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) {
    throw new AnalyticsPrerequisiteError(
      "shop_currency",
      "Shop currency is not known yet; revenue cannot be reported",
    );
  }
  return code;
}
