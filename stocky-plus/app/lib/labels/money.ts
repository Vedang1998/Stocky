/** A Shopify money amount as shoppers read it on a shelf label, e.g. "$729.95". */
export function formatLabelMoney(amount: string, currencyCode: string): string | null {
  const value = Number(amount);
  if (amount.trim() === "" || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).format(value);
  } catch {
    // Not a currency code the runtime knows: show the code rather than guess.
    return `${value.toFixed(2)} ${currencyCode}`;
  }
}
