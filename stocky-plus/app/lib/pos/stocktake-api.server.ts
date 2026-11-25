/**
 * What the POS counting screens read and write. Counting itself is the
 * stocktake service's job; this module checks that the count belongs to the
 * POS location and is open, shapes data for a small screen, and requires a
 * signed-in staff member so every count names who made it. Expected
 * quantities are never sent: a person counting on the floor sees what they
 * counted, not what the system thinks is there.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { PosTenantContext } from "../../tenant/require-pos-tenant.server";
import { STAFF_REQUIRED_MESSAGE } from "../../services/inventory-writes/actor.server";
import {
  getStocktake,
  getStocktakeLines,
  listStocktakes,
} from "../../services/stocktakes/stocktake-read.server";
import {
  recordStocktakeScan,
  saveStocktakeCount,
  type StocktakeScope,
  type StocktakeSheetOptions,
} from "../../services/stocktakes/stocktake.server";
import type { AdminGraphQLClient } from "../../services/shopify-gql.server";
import { PosApiError } from "./pos-api.server";
import { requirePosPlan } from "./pos-plan.server";
import { parseCountBody } from "./stocktake-body";

export type PosStocktakeEntry = {
  id: string;
  name: string;
  scope: StocktakeScope;
  blind: boolean;
  lineCount: number;
  countedCount: number;
};

export type PosStocktakeList = {
  stocktakes: PosStocktakeEntry[];
  hasMore: boolean;
};

export type PosCountLine = {
  lineId: string;
  variantGid: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  countedQty: number | null;
};

export type PosCountProgress = { lineCount: number; countedCount: number };

export type PosCountSheet = {
  stocktake: { id: string; name: string; blind: boolean } & PosCountProgress;
  /** The counted items, as many as one page holds. */
  counted: PosCountLine[];
  hasMoreCounted: boolean;
};

export type PosCountResponse =
  | {
      ok: true;
      line: {
        lineId: string;
        title: string;
        countedQty: number | null;
        added: boolean;
        /** The scan began a recount: the count restarted from this scan. */
        recounted: boolean;
      };
      progress: PosCountProgress;
    }
  | { ok: false; message: string; progress: PosCountProgress };

export type CountDeps = {
  adminFor: (shopDomain: string) => Promise<AdminGraphQLClient>;
  stocktake?: StocktakeSheetOptions;
};

async function progressOf(
  db: TenantDb,
  stocktakeId: string,
): Promise<PosCountProgress> {
  const [lineCount, countedCount] = (await Promise.all([
    db.stocktakeLineItem.count({ where: { stocktakeId } }),
    db.stocktakeLineItem.count({
      where: { stocktakeId, countedQty: { not: null } },
    }),
  ])) as [number, number];
  return { lineCount, countedCount };
}

/** The count, provided it belongs to the POS location and is being counted. */
async function openCount(
  db: TenantDb,
  stocktakeId: string,
  locationGid: string,
) {
  const stocktake = await getStocktake(db, stocktakeId);
  if (!stocktake) {
    throw new PosApiError(404, "not_found", "This stocktake wasn’t found.");
  }
  if (stocktake.locationId !== locationGid) {
    throw new PosApiError(
      409,
      "conflict",
      "This stocktake is for a different location. Count it at that location.",
    );
  }
  if (stocktake.status !== "IN_PROGRESS") {
    throw new PosApiError(
      409,
      "conflict",
      "This stocktake isn’t being counted any more. Ask a manager to start or reopen it.",
    );
  }
  return stocktake;
}

export async function listCountableStocktakes(
  db: TenantDb,
  locationGid: string,
): Promise<PosStocktakeList> {
  await requirePosPlan(db);
  const { stocktakes, hasMore } = await listStocktakes(db, {
    view: "open",
    page: 1,
    locationGid,
    inProgressOnly: true,
  });
  return {
    hasMore,
    stocktakes: stocktakes.map((entry) => ({
      id: entry.id,
      name: entry.name,
      scope: entry.scope,
      blind: entry.blind,
      lineCount: entry.lineCount,
      countedCount: entry.countedCount,
    })),
  };
}

export async function getCountSheet(
  db: TenantDb,
  stocktakeId: string,
  locationGid: string,
): Promise<PosCountSheet> {
  await requirePosPlan(db);
  const stocktake = await openCount(db, stocktakeId, locationGid);
  const [progress, counted] = await Promise.all([
    progressOf(db, stocktake.id),
    getStocktakeLines(db, {
      stocktakeId: stocktake.id,
      filter: "counted",
      search: "",
      page: 1,
    }),
  ]);
  return {
    stocktake: {
      id: stocktake.id,
      name: stocktake.name,
      blind: stocktake.blind,
      ...progress,
    },
    counted: counted.lines.map((line) => ({
      lineId: line.id,
      variantGid: line.shopifyVariantId,
      title: line.title,
      sku: line.sku,
      barcode: line.barcode,
      countedQty: line.countedQty,
    })),
    hasMoreCounted: counted.total > counted.lines.length,
  };
}

/**
 * Add a scan to a count, or set one item's count. A request the count itself
 * refuses (unknown code, ambiguous code, an item Shopify does not stock here)
 * comes back as `ok: false` with the reason to show, not as an HTTP error.
 */
export async function countAtPos(
  context: PosTenantContext,
  stocktakeId: string,
  locationGid: string,
  body: unknown,
  deps: CountDeps,
): Promise<PosCountResponse> {
  const { db, actor } = context;
  await requirePosPlan(db);
  if (!actor.shopifyUserId) {
    throw new PosApiError(403, "forbidden", STAFF_REQUIRED_MESSAGE);
  }
  const request = parseCountBody(body);
  await openCount(db, stocktakeId, locationGid);
  const admin = await deps.adminFor(context.shop.myshopifyDomain);

  if (request.intent === "scan") {
    const result = await recordStocktakeScan(
      db,
      admin,
      {
        stocktakeId,
        code: request.code,
        quantity: request.quantity,
        actor,
      },
      deps.stocktake,
    );
    const progress = await progressOf(db, stocktakeId);
    return result.ok
      ? {
          ok: true,
          line: {
            lineId: result.lineId,
            title: result.title,
            countedQty: result.countedQty,
            added: result.added,
            recounted: result.recounted,
          },
          progress,
        }
      : { ok: false, message: result.error, progress };
  }

  const result = await saveStocktakeCount(
    db,
    admin,
    {
      lineId: request.lineId,
      countedQty: request.countedQty,
      stocktakeId,
      actor,
    },
    deps.stocktake,
  );
  const progress = await progressOf(db, stocktakeId);
  return result.ok
    ? {
        ok: true,
        line: {
          lineId: request.lineId,
          title: "",
          countedQty: request.countedQty,
          added: false,
          recounted: false,
        },
        progress,
      }
    : { ok: false, message: result.error, progress };
}
