/**
 * Limits the stocktake pages show in their fields and the service enforces.
 * No server-only imports: the pages read them in the browser too.
 */

export const MAX_COUNTED_QUANTITY = 1_000_000;
export const MAX_STOCKTAKE_NAME_LENGTH = 120;
/** Items that one pasted list may add to a count. */
export const MAX_ADDED_ITEMS = 500;
export const MAX_ITEM_LIST_LENGTH = 50_000;
