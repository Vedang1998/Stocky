import { queryRows, type OrderApplyDb } from "../apply/sql";

export type StoredOrderFactExistence = {
  existenceKind: string;
  existenceState: "LIVE" | "ABSENT";
  deletedAt: Date | null;
  processedAt: Date | null;
  shopifyCreatedAt: Date | null;
  accessScopeSnapshot: string[];
};

export async function loadStoredOrderFactExistence(
  db: OrderApplyDb,
  shopId: string,
  shopifyGid: string,
): Promise<StoredOrderFactExistence | null> {
  const rows = await queryRows<{
    existenceKind: string;
    existenceState: string;
    deletedAt: Date | null;
    processedAt: Date | null;
    shopifyCreatedAt: Date | null;
    accessScopeSnapshot: unknown;
  }>(db)`SELECT "existenceKind", "existenceState", "deletedAt", "processedAt",
            "shopifyCreatedAt", "accessScopeSnapshot"
     FROM "ShopifyOrderFact"
     WHERE "shopId" = ${shopId}
       AND "shopifyGid" = ${shopifyGid}
     LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  const scopes = Array.isArray(row.accessScopeSnapshot)
    ? row.accessScopeSnapshot.map((item) => String(item))
    : [];
  return {
    existenceKind: String(row.existenceKind),
    existenceState: row.existenceState === "ABSENT" ? "ABSENT" : "LIVE",
    deletedAt: row.deletedAt,
    processedAt: row.processedAt,
    shopifyCreatedAt: row.shopifyCreatedAt,
    accessScopeSnapshot: scopes,
  };
}
