/**
 * Merchant wording that points to the catalog sync. Shared so a rename of the
 * Home page button changes every hint with it (issue #80).
 */
export const SYNC_CATALOG_LABEL = "Sync catalog";

/** Sentence fragment: "Choose Sync catalog on the Home page". */
export const SYNC_CATALOG_HINT = `Choose ${SYNC_CATALOG_LABEL} on the Home page`;

/** A location the shop has not synced, or that is no longer active. */
export function inactiveLocationMessage(subject = "That location"): string {
  return `${subject} is not an active, synced location of this shop. ${SYNC_CATALOG_HINT}, then try again.`;
}
