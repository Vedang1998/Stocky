/**
 * Most variants one worksheet can hold. Larger catalogs are planned a
 * vendor, product type or supplier at a time, which is also how they are
 * ordered.
 */
export const MAX_WORKSHEET_VARIANTS = 5000;

/** Saved worksheets kept per shop; generating another removes the oldest. */
export const WORKSHEETS_KEPT = 20;
