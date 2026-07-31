/**
 * Tenant-bound database access contract.
 *
 * Created only from branded TenantAuthority. Does not expose the raw Prisma
 * client, unrestricted TransactionClient, or raw SQL helpers.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import rawPrisma from "../db.server";
import { assertTenantAuthority, type TenantAuthority } from "./authority.server";
import { TenantAccessError } from "./errors";
import {
  CHILD_MODEL_SET,
  DIRECT_MODEL_SET,
  MERCHANT_DELEGATE_NAMES,
  MERCHANT_MODEL_SET,
  PARENT_OWNERSHIP_RULES,
  type MerchantOwnedModel,
} from "./models";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const UNSAFE_CLIENT_KEYS = new Set([
  "$queryRaw",
  "$queryRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
  "$runCommandRaw",
  "$parent",
  "_engine",
  "_runtimeDataModel",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tenantScopeWhere(
  model: string,
  authority: TenantAuthority,
): Record<string, unknown> {
  if (DIRECT_MODEL_SET.has(model)) {
    return {
      shopId: authority.shopId,
      shop: authority.myshopifyDomain,
    };
  }
  if (CHILD_MODEL_SET.has(model)) {
    return { shopId: authority.shopId };
  }
  throw new TenantAccessError(
    "unknown_merchant_model",
    `Model ${model} is not an approved merchant-owned model`,
  );
}

function mergeWhere(
  existing: unknown,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || (isPlainObject(existing) && Object.keys(existing).length === 0)) {
    return { ...scope };
  }
  return { AND: [existing, scope] };
}

function rejectForeignShopId(
  data: unknown,
  authority: TenantAuthority,
  path: string,
): void {
  if (!isPlainObject(data)) return;

  if ("shopId" in data) {
    const value = data.shopId;
    if (value !== undefined && value !== null && value !== authority.shopId) {
      throw new TenantAccessError(
        "foreign_shop_id",
        `Explicit foreign shopId rejected at ${path}`,
      );
    }
  }

  if ("shop" in data) {
    const value = data.shop;
    if (
      value !== undefined &&
      value !== null &&
      value !== authority.myshopifyDomain
    ) {
      throw new TenantAccessError(
        "foreign_shop_domain",
        `Explicit foreign shop domain rejected at ${path}`,
      );
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "create" || key === "createMany" || key === "connectOrCreate") {
      rejectForeignShopId(value, authority, `${path}.${key}`);
    }
    if (isPlainObject(value) && ("create" in value || "connect" in value)) {
      rejectForeignShopId(value.create, authority, `${path}.${key}.create`);
      if (isPlainObject(value.connectOrCreate)) {
        rejectForeignShopId(
          value.connectOrCreate.create,
          authority,
          `${path}.${key}.connectOrCreate.create`,
        );
      }
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) =>
        rejectForeignShopId(item, authority, `${path}.${key}[${i}]`),
      );
    }
  }
}

function injectOwnership(
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
): Record<string, unknown> {
  rejectForeignShopId(data, authority, `${model}.create`);

  const next: Record<string, unknown> = { ...data };
  if (DIRECT_MODEL_SET.has(model)) {
    next.shopId = authority.shopId;
    next.shop = authority.myshopifyDomain;
  } else if (CHILD_MODEL_SET.has(model)) {
    next.shopId = authority.shopId;
  }

  // Nested relation creates — inject ownership into known child creates.
  for (const [key, value] of Object.entries(next)) {
    if (!isPlainObject(value)) continue;
    if ("create" in value) {
      const childModel = nestedChildModelFor(model, key);
      if (childModel && isPlainObject(value.create)) {
        next[key] = {
          ...value,
          create: injectOwnership(
            childModel,
            value.create as Record<string, unknown>,
            authority,
          ),
        };
      } else if (childModel && Array.isArray(value.create)) {
        next[key] = {
          ...value,
          create: value.create.map((row) =>
            isPlainObject(row)
              ? injectOwnership(childModel, row, authority)
              : row,
          ),
        };
      }
    }
  }

  return next;
}

function nestedChildModelFor(
  parentModel: string,
  relationKey: string,
): MerchantOwnedModel | null {
  const map: Record<string, Record<string, MerchantOwnedModel>> = {
    Supplier: {
      skuMappings: "SupplierSkuMapping",
      volumeTiers: "VolumePriceTier",
      leadTimeSnapshots: "LeadTimeSnapshot",
      purchaseOrders: "PurchaseOrder",
    },
    PurchaseOrder: { lineItems: "POLineItem" },
    TransferOrder: { lineItems: "TransferLineItem" },
    Stocktake: { lineItems: "StocktakeLineItem" },
  };
  return map[parentModel]?.[relationKey] ?? null;
}

function scrubUpdateData(
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
): Record<string, unknown> {
  rejectForeignShopId(data, authority, `${model}.update`);
  const next: Record<string, unknown> = { ...data };

  if ("shopId" in next) {
    // Allow idempotent alignment to the current tenant (null → canonical).
    // Reject any attempt to assign a different tenant.
    if (next.shopId !== authority.shopId) {
      throw new TenantAccessError(
        "shop_id_immutable",
        `Update cannot mutate shopId on ${model}`,
      );
    }
  }

  if (DIRECT_MODEL_SET.has(model) && "shop" in next) {
    const value = next.shop;
    if (value !== undefined && value !== authority.myshopifyDomain) {
      throw new TenantAccessError(
        "shop_domain_immutable",
        `Update cannot change legacy shop on ${model}`,
      );
    }
    delete next.shop;
  }
  return next;
}

/**
 * Unique selectors that already prove tenant ownership for this authority.
 */
function hasTenantBearingUnique(
  model: string,
  where: unknown,
  authority: TenantAuthority,
): boolean {
  if (!isPlainObject(where)) return false;

  if (where.shopId === authority.shopId && typeof where.id === "string") {
    return true;
  }

  if (
    isPlainObject(where.shopId_id) &&
    where.shopId_id.shopId === authority.shopId &&
    typeof where.shopId_id.id === "string"
  ) {
    return true;
  }

  if (DIRECT_MODEL_SET.has(model)) {
    if (where.shop === authority.myshopifyDomain) return true;

    for (const value of Object.values(where)) {
      if (
        isPlainObject(value) &&
        value.shop === authority.myshopifyDomain
      ) {
        return true;
      }
    }
  }

  return false;
}

async function assertParentOwnership(
  client: PrismaLike,
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
): Promise<void> {
  const rule = PARENT_OWNERSHIP_RULES[model];
  if (!rule) return;

  const parentId = data[rule.foreignKey];
  if (typeof parentId !== "string" || !parentId) {
    // connect: { id } forms
    const connect = data[relationConnectKey(rule.foreignKey)];
    if (isPlainObject(connect) && typeof connect.id === "string") {
      await assertParentIdOwned(
        client,
        rule.parentModel,
        connect.id,
        authority,
      );
    }
    return;
  }

  await assertParentIdOwned(client, rule.parentModel, parentId, authority);
}

function relationConnectKey(foreignKey: string): string {
  // supplierId -> supplier; purchaseOrderId -> purchaseOrder
  if (foreignKey.endsWith("Id")) {
    const base = foreignKey.slice(0, -2);
    return base.charAt(0).toLowerCase() + base.slice(1);
  }
  return foreignKey;
}

async function assertParentIdOwned(
  client: PrismaLike,
  parentModel: MerchantOwnedModel,
  parentId: string,
  authority: TenantAuthority,
): Promise<void> {
  const delegateName = MERCHANT_DELEGATE_NAMES[parentModel];
  const delegate = (client as Record<string, unknown>)[delegateName] as {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
  };

  const parent = await delegate.findFirst({
    where: {
      id: parentId,
      ...tenantScopeWhere(parentModel, authority),
    },
    select: { id: true },
  });

  if (!parent) {
    throw new TenantAccessError(
      "foreign_parent",
      `Parent ${parentModel} ${parentId} is not owned by the current tenant`,
    );
  }
}

function coerceDirectShopInWhere(
  where: unknown,
  authority: TenantAuthority,
): unknown {
  if (!isPlainObject(where)) return where;
  const next: Record<string, unknown> = { ...where };
  if ("shop" in next) {
    next.shop = authority.myshopifyDomain;
  }
  for (const [key, value] of Object.entries(next)) {
    if (isPlainObject(value) && "shop" in value) {
      next[key] = { ...value, shop: authority.myshopifyDomain };
    }
  }
  return next;
}

async function rewriteUniqueRead(
  client: PrismaLike,
  model: string,
  operation: string,
  args: Record<string, unknown>,
  authority: TenantAuthority,
  _query: (args: unknown) => Promise<unknown>,
): Promise<unknown> {
  const scope = tenantScopeWhere(model, authority);
  const where = args.where;

  // Always use tenant-scoped findFirst — never unrestricted unique then check.
  // Coerce any legacy shop fields in the selector to the authority domain.
  const findFirst = getDelegate(client, model).findFirst;
  const row = await findFirst({
    ...args,
    where: mergeWhere(coerceDirectShopInWhere(where, authority), scope),
  });

  if (operation === "findUniqueOrThrow" && !row) {
    throw new TenantAccessError(
      "not_found",
      `${model} not found for tenant`,
    );
  }
  return row;
}

async function rewriteUniqueWrite(
  client: PrismaLike,
  model: string,
  operation: "update" | "delete",
  args: Record<string, unknown>,
  authority: TenantAuthority,
): Promise<unknown> {
  const scope = tenantScopeWhere(model, authority);
  const delegate = getDelegate(client, model);
  const scopedWhere = mergeWhere(
    coerceDirectShopInWhere(args.where, authority),
    scope,
  );

  if (operation === "update") {
    const data = scrubUpdateData(
      model,
      (args.data ?? {}) as Record<string, unknown>,
      authority,
    );

    const existing = await delegate.findFirst({
      where: scopedWhere,
      select: { id: true },
    });
    if (!existing) {
      throw new TenantAccessError(
        "not_found",
        `${model} not found for tenant update`,
      );
    }
    // Tenant-scoped updateMany then return the row — avoids id-only unique write.
    await delegate.updateMany({
      where: { id: existing.id, ...scope },
      data,
    });
    return delegate.findFirst({ where: { id: existing.id, ...scope } });
  }

  // delete — tenant-scoped deleteMany only
  const existing = await delegate.findFirst({
    where: scopedWhere,
    select: { id: true },
  });
  if (!existing) {
    throw new TenantAccessError(
      "not_found",
      `${model} not found for tenant delete`,
    );
  }
  const deleted = await delegate.deleteMany({
    where: { id: existing.id, ...scope },
  });
  if (deleted.count === 0) {
    throw new TenantAccessError(
      "not_found",
      `${model} not found for tenant delete`,
    );
  }
  return { id: existing.id };
}

async function rewriteUpsert(
  client: PrismaLike,
  model: string,
  args: Record<string, unknown>,
  authority: TenantAuthority,
): Promise<unknown> {
  const where = args.where;

  if (!hasTenantBearingUnique(model, where, authority)) {
    throw new TenantAccessError(
      "unsafe_upsert",
      `Upsert on ${model} requires a tenant-bearing unique selector`,
    );
  }

  // Prisma upsert where must keep the exact unique shape — coerce shop fields
  // to the authority domain so cross-tenant match is impossible.
  const coercedWhere = coerceDirectShopInWhere(where, authority);

  const create = injectOwnership(
    model,
    (args.create ?? {}) as Record<string, unknown>,
    authority,
  );
  await assertParentOwnership(client, model, create, authority);

  const update = scrubUpdateData(
    model,
    (args.update ?? {}) as Record<string, unknown>,
    authority,
  );

  return getDelegate(client, model).upsert({
    ...args,
    where: coercedWhere,
    create,
    update,
  });
}

function getDelegate(client: PrismaLike, model: string) {
  if (!MERCHANT_MODEL_SET.has(model)) {
    throw new TenantAccessError(
      "unknown_merchant_model",
      `Model ${model} is not merchant-owned`,
    );
  }
  const name = MERCHANT_DELEGATE_NAMES[model as MerchantOwnedModel];
  return (client as Record<string, any>)[name];
}

async function runScopedOperation(
  client: PrismaLike,
  model: string,
  operation: string,
  args: Record<string, unknown>,
  authority: TenantAuthority,
  query: (args: unknown) => Promise<unknown>,
): Promise<unknown> {
  if (!MERCHANT_MODEL_SET.has(model)) {
    throw new TenantAccessError(
      "model_not_permitted",
      `Tenant DB cannot access model ${model}`,
    );
  }

  const scope = tenantScopeWhere(model, authority);

  switch (operation) {
    case "findUnique":
    case "findUniqueOrThrow":
      return rewriteUniqueRead(
        client,
        model,
        operation,
        args,
        authority,
        query,
      );

    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy":
      return query({
        ...args,
        where: mergeWhere(args.where, scope),
      });

    case "create": {
      const data = injectOwnership(
        model,
        (args.data ?? {}) as Record<string, unknown>,
        authority,
      );
      await assertParentOwnership(client, model, data, authority);
      return query({ ...args, data });
    }

    case "createMany": {
      const records = args.data;
      if (Array.isArray(records)) {
        const data = records.map((row) =>
          injectOwnership(model, row as Record<string, unknown>, authority),
        );
        for (const row of data) {
          await assertParentOwnership(client, model, row, authority);
        }
        return query({ ...args, data });
      }
      const data = injectOwnership(
        model,
        (records ?? {}) as Record<string, unknown>,
        authority,
      );
      await assertParentOwnership(client, model, data, authority);
      return query({ ...args, data });
    }

    case "update":
      return rewriteUniqueWrite(client, model, "update", args, authority);

    case "updateMany": {
      const data = scrubUpdateData(
        model,
        (args.data ?? {}) as Record<string, unknown>,
        authority,
      );
      return query({
        ...args,
        where: mergeWhere(args.where, scope),
        data,
      });
    }

    case "upsert":
      return rewriteUpsert(client, model, args, authority);

    case "delete":
      return rewriteUniqueWrite(client, model, "delete", args, authority);

    case "deleteMany":
      return query({
        ...args,
        where: mergeWhere(args.where, scope),
      });

    default:
      throw new TenantAccessError(
        "unsupported_operation",
        `Unsupported Prisma operation ${operation} on ${model}`,
      );
  }
}

function buildTenantDelegates(client: PrismaLike, authority: TenantAuthority) {
  const delegates: Record<string, unknown> = {};

  for (const model of MERCHANT_MODEL_SET) {
    const delegateName =
      MERCHANT_DELEGATE_NAMES[model as MerchantOwnedModel];
    const operations = [
      "findUnique",
      "findUniqueOrThrow",
      "findFirst",
      "findFirstOrThrow",
      "findMany",
      "create",
      "createMany",
      "update",
      "updateMany",
      "upsert",
      "delete",
      "deleteMany",
      "count",
      "aggregate",
      "groupBy",
    ] as const;

    const wrapped: Record<string, unknown> = {};
    for (const operation of operations) {
      wrapped[operation] = async (args: Record<string, unknown> = {}) =>
        runScopedOperation(
          client,
          model,
          operation,
          args,
          authority,
          (scopedArgs) => getDelegate(client, model)[operation](scopedArgs),
        );
    }
    delegates[delegateName] = wrapped;
  }

  return delegates;
}

export type TenantDb = {
  readonly authority: TenantAuthority;
  supplier: any;
  purchaseOrder: any;
  shopifyVariantCache: any;
  inventorySnapshot: any;
  variantAbcClass: any;
  forecastOverride: any;
  salesDailyAggregate: any;
  shopSettings: any;
  transferOrder: any;
  stocktake: any;
  bomComponent: any;
  lowStockAlert: any;
  supplierSkuMapping: any;
  volumePriceTier: any;
  leadTimeSnapshot: any;
  pOLineItem: any;
  transferLineItem: any;
  stocktakeLineItem: any;
  $transaction: <T>(fn: (db: TenantDb) => Promise<T>) => Promise<T>;
};

/**
 * Create tenant-bound DB access from branded authority only.
 * The raw Prisma client never escapes this module.
 */
export function createTenantDb(authority: TenantAuthority): TenantDb {
  assertTenantAuthority(authority);
  return createTenantDbFromClient(rawPrisma, authority);
}

function createTenantDbFromClient(
  client: PrismaLike,
  authority: TenantAuthority,
): TenantDb {
  assertTenantAuthority(authority);
  const delegates = buildTenantDelegates(client, authority);

  const db: TenantDb = {
    authority,
    ...(delegates as Omit<TenantDb, "authority" | "$transaction">),
    $transaction: async <T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> => {
      // Interactive transactions on the root client only.
      if (!("$transaction" in client) || typeof (client as PrismaClient).$transaction !== "function") {
        throw new TenantAccessError(
          "nested_transaction_unsupported",
          "Nested tenant transactions are not supported",
        );
      }
      return (client as PrismaClient).$transaction(async (tx) => {
        const tenantTx = createTenantDbFromClient(tx, authority);
        return fn(tenantTx);
      });
    },
  };

  return new Proxy(db, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && UNSAFE_CLIENT_KEYS.has(prop)) {
        throw new TenantAccessError(
          "raw_client_escape",
          `Access to ${prop} is forbidden on tenant-bound DB`,
        );
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** Test helper — proves raw prisma is not reachable through TenantDb. */
export function tenantDbExposesRawClient(db: TenantDb): boolean {
  try {
    const escaped = (db as unknown as { $queryRaw?: unknown }).$queryRaw;
    return typeof escaped === "function";
  } catch (err) {
    if (err instanceof TenantAccessError && err.code === "raw_client_escape") {
      return false;
    }
    throw err;
  }
}
