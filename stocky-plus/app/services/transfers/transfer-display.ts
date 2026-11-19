/**
 * Wording shared by the transfer pages and the transfer report. No
 * server-only imports: the pages render it in the browser too.
 */

type TransferStatus = "DRAFT" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";
type Tone = "info" | "warning" | "success" | "neutral";

export interface TransferProgress {
  shipUnits: number;
  receivedUnits: number;
  rejectedUnits: number;
  returnedUnits: number;
  writtenOffUnits: number;
}

/**
 * How a transfer stands, in the merchant's words. A finished transfer says
 * whether everything arrived; one in transit says whether receiving has begun.
 */
export function transferStatusBadge(
  status: TransferStatus,
  progress: TransferProgress,
): { label: string; tone: Tone } {
  switch (status) {
    case "DRAFT":
      return { label: "Draft", tone: "info" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral" };
    case "IN_TRANSIT":
      return progress.receivedUnits + progress.rejectedUnits > 0
        ? { label: "Partly received", tone: "warning" }
        : { label: "In transit", tone: "warning" };
    case "RECEIVED":
      if (progress.returnedUnits + progress.writtenOffUnits > 0) {
        return { label: "Closed short", tone: "neutral" };
      }
      return progress.rejectedUnits > 0
        ? { label: "Received with rejects", tone: "success" }
        : { label: "Received", tone: "success" };
  }
}

/** A short name for a transfer in lists and file names, from the end of its ID. */
export function transferReference(transferId: string): string {
  return `T-${transferId.slice(-6).toUpperCase()}`;
}

export const SHORT_RESOLUTION_LABEL = {
  RETURNED: "put back into stock at the source",
  WRITTEN_OFF: "written off",
} as const;

export function unitCount(units: number): string {
  return `${units.toLocaleString("en-US")} ${units === 1 ? "unit" : "units"}`;
}

type TransferLeg = "shipment" | "receipt";

/**
 * What one ledger entry of a transfer did, from the leg it belongs to and the
 * net units Shopify confirmed: stock leaving the source or coming back to it,
 * stock arriving at the destination or being taken out again by a correction.
 */
export function transferEventLabel(leg: TransferLeg, netUnits: number): string {
  const units = unitCount(Math.abs(netUnits));
  if (netUnits === 0) {
    return leg === "shipment"
      ? "Change at the source"
      : "Change at the destination";
  }
  if (leg === "shipment") {
    return netUnits < 0
      ? `${units} left the source`
      : `${units} put back at the source`;
  }
  return netUnits > 0
    ? `${units} received at the destination`
    : `${units} taken back out at the destination`;
}
