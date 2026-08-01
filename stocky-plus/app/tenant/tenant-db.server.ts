/**
 * Tenant-bound database access contract.
 *
 * Created only from branded TenantAuthority. Does not expose the raw Prisma
 * client, unrestricted TransactionClient, or raw SQL helpers.
 *
 * PR 2 corrections:
 * - C-01 nullable ownership compatibility (direct + child lineage)
 * - C-02 recursive relation isolation
 * - C-05 nested write / connect ownership validation
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
import {
  fkToRelationName,
  parentRelationFieldName,
  relationMetaFor,
  type MerchantRelationMeta,
} from "./relations";

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

const RELATION_WRITE_OPS = new Set([
  "create",
  "createMany",
  "connect",
  "connectOrCreate",
  "set",
  "disconnect",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Direct-model authorization predicate (C-01):
 *   (shopId = tenant AND shop = domain)
 *   OR (shopId IS NULL AND shop = domain)
 *
 * Foreign non-null shopId is never recovered via legacy shop.
 * Conflicting shopId/shop pairs fail closed.
 */
export function directTenantScopeWhere(
  authority: TenantAuthority,
): Record<string, unknown> {
  return {
    OR: [
      {
        AND: [
          { shopId: authority.shopId },
          { shop: authority.myshopifyDomain },
        ],
      },
      {
        AND: [{ shopId: null }, { shop: authority.myshopifyDomain }],
      },
    ],
  };
}

/**
 * Child-model scope (C-01): parent must be same-tenant, and child shopId is
 * either the current tenant or null under that verified parent lineage.
 */
export function childTenantScopeWhere(
  model: string,
  authority: TenantAuthority,
): Record<string, unknown> {
  const rule = PARENT_OWNERSHIP_RULES[model];
  if (!rule) {
    throw new TenantAccessError(
      "missing_parent_lineage",
      `Child model ${model} has no parent ownership rule`,
    );
  }
  const parentField = parentRelationFieldName(model);
  if (!parentField) {
    throw new TenantAccessError(
      "missing_parent_lineage",
      `Child model ${model} parent relation is ambiguous`,
    );
  }

  const parentScope = tenantScopeWhere(rule.parentModel, authority);

  return {
    AND: [
      {
        OR: [{ shopId: authority.shopId }, { shopId: null }],
      },
      {
        [parentField]: parentScope,
      },
    ],
  };
}

export function tenantScopeWhere(
  model: string,
  authority: TenantAuthority,
): Record<string, unknown> {
  if (DIRECT_MODEL_SET.has(model)) {
    return directTenantScopeWhere(authority);
  }
  if (CHILD_MODEL_SET.has(model)) {
    return childTenantScopeWhere(model, authority);
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

function nestedChildModelFor(
  parentModel: string,
  relationKey: string,
): MerchantOwnedModel | null {
  return relationMetaFor(parentModel, relationKey)?.targetModel ?? null;
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

function scrubUpdateData(
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
): Record<string, unknown> {
  rejectForeignShopId(data, authority, `${model}.update`);
  const next: Record<string, unknown> = { ...data };

  // C-01: updates must not mutate shopId or legacy shop (no silent repair).
  if ("shopId" in next) {
    throw new TenantAccessError(
      "shop_id_immutable",
      `Update cannot mutate shopId on ${model}`,
    );
  }
  if (DIRECT_MODEL_SET.has(model) && "shop" in next) {
    throw new TenantAccessError(
      "shop_domain_immutable",
      `Update cannot change legacy shop on ${model}`,
    );
  }
  return next;
}

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

function getDelegate(client: PrismaLike, model: string) {
  if (!MERCHANT_MODEL_SET.has(model)) {
    throw new TenantAccessError(
      "unknown_merchant_model",
      `Model ${model} is not merchant-owned`,
    );
  }
  const name = MERCHANT_DELEGATE_NAMES[model as MerchantOwnedModel];
  return (
    client as unknown as Record<
      string,
      { [op: string]: (args?: unknown) => Promise<unknown> }
    >
  )[name];
}

async function assertParentIdOwned(
  client: PrismaLike,
  parentModel: MerchantOwnedModel,
  parentId: string,
  authority: TenantAuthority,
): Promise<void> {
  const delegate = getDelegate(client, parentModel);
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

async function assertParentOwnership(
  client: PrismaLike,
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
): Promise<void> {
  const rule = PARENT_OWNERSHIP_RULES[model];
  if (!rule) return;

  const parentId = data[rule.foreignKey];
  if (typeof parentId === "string" && parentId) {
    await assertParentIdOwned(client, rule.parentModel, parentId, authority);
  } else {
    const connect = data[fkToRelationName(rule.foreignKey)];
    if (isPlainObject(connect) && typeof connect.id === "string") {
      await assertParentIdOwned(
        client,
        rule.parentModel,
        connect.id,
        authority,
      );
    } else if (
      isPlainObject(connect) &&
      isPlainObject(connect.connect) &&
      typeof connect.connect.id === "string"
    ) {
      await assertParentIdOwned(
        client,
        rule.parentModel,
        connect.connect.id,
        authority,
      );
    }
  }

  // LeadTimeSnapshot secondary ownership evidence (no Prisma relation).
  if (model === "LeadTimeSnapshot" && typeof data.purchaseOrderId === "string") {
    await assertParentIdOwned(
      client,
      "PurchaseOrder",
      data.purchaseOrderId,
      authority,
    );
  }
}

async function assertRowIdsOwned(
  client: PrismaLike,
  model: MerchantOwnedModel,
  ids: string[],
  authority: TenantAuthority,
): Promise<void> {
  if (ids.length === 0) return;
  const unique = [...new Set(ids)];
  const delegate = getDelegate(client, model);
  const found = (await delegate.findMany({
    where: mergeWhere({ id: { in: unique } }, tenantScopeWhere(model, authority)),
    select: { id: true },
  })) as Array<{ id: string }>;

  if (found.length !== unique.length) {
    throw new TenantAccessError(
      "foreign_relation_target",
      `One or more ${model} relation targets are missing or foreign to the tenant`,
    );
  }
}

function extractConnectIds(value: unknown): string[] {
  if (value === true || value === false || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractConnectIds(item));
  }
  if (isPlainObject(value)) {
    if (typeof value.id === "string") return [value.id];
    return [];
  }
  return [];
}

async function validateRelationWriteValue(
  client: PrismaLike,
  rel: MerchantRelationMeta,
  value: unknown,
  authority: TenantAuthority,
  path: string,
): Promise<void> {
  if (value === true || value === false || value == null) return;

  if (!isPlainObject(value) && !Array.isArray(value)) {
    throw new TenantAccessError(
      "unknown_relation_operation",
      `Unsupported relation value at ${path}`,
    );
  }

  if (Array.isArray(value)) {
    // Bare connect array form is uncommon; treat as connect ids.
    await assertRowIdsOwned(
      client,
      rel.targetModel,
      extractConnectIds(value),
      authority,
    );
    return;
  }

  for (const op of Object.keys(value)) {
    if (!RELATION_WRITE_OPS.has(op)) {
      // Scalar nested args like orderBy/take/where/select/include are read-side.
      if (
        op === "where" ||
        op === "orderBy" ||
        op === "take" ||
        op === "skip" ||
        op === "cursor" ||
        op === "select" ||
        op === "include" ||
        op === "distinct"
      ) {
        continue;
      }
      throw new TenantAccessError(
        "unknown_relation_operation",
        `Unknown nested relation operation '${op}' at ${path}`,
      );
    }
    if (!rel.allowedNestedOperations.includes(op as never)) {
      throw new TenantAccessError(
        "unknown_relation_operation",
        `Nested operation '${op}' not permitted on ${rel.sourceModel}.${rel.name}`,
      );
    }
  }

  if ("connect" in value) {
    await assertRowIdsOwned(
      client,
      rel.targetModel,
      extractConnectIds(value.connect),
      authority,
    );
  }
  if ("set" in value) {
    await assertRowIdsOwned(
      client,
      rel.targetModel,
      extractConnectIds(value.set),
      authority,
    );
  }
  if ("disconnect" in value && value.disconnect !== true) {
    await assertRowIdsOwned(
      client,
      rel.targetModel,
      extractConnectIds(value.disconnect),
      authority,
    );
  }
  if ("connectOrCreate" in value) {
    const coc = value.connectOrCreate;
    const items = Array.isArray(coc) ? coc : [coc];
    for (const item of items) {
      if (!isPlainObject(item)) continue;
      if (isPlainObject(item.where)) {
        const id = typeof item.where.id === "string" ? item.where.id : null;
        if (id) {
          await assertRowIdsOwned(client, rel.targetModel, [id], authority);
        } else {
          // Non-id where must still resolve through tenant scope before write.
          const existing = await getDelegate(client, rel.targetModel).findFirst({
            where: mergeWhere(
              item.where,
              tenantScopeWhere(rel.targetModel, authority),
            ),
            select: { id: true },
          });
          if (!existing) {
            // create branch — inject ownership later; where miss is OK for create
          }
        }
      }
      if (isPlainObject(item.create)) {
        rejectForeignShopId(
          item.create,
          authority,
          `${path}.connectOrCreate.create`,
        );
        const injected = injectOwnership(
          rel.targetModel,
          item.create as Record<string, unknown>,
          authority,
        );
        await assertParentOwnership(
          client,
          rel.targetModel,
          injected,
          authority,
        );
        Object.assign(item.create, injected);
      }
    }
  }
  if ("create" in value) {
    const rows = Array.isArray(value.create) ? value.create : [value.create];
    for (const row of rows) {
      if (!isPlainObject(row)) continue;
      const injected = injectOwnership(rel.targetModel, row, authority);
      await assertParentOwnership(client, rel.targetModel, injected, authority);
      await validateNestedRelationWrites(
        client,
        rel.targetModel,
        injected,
        authority,
      );
      Object.assign(row, injected);
    }
  }
  if ("createMany" in value && isPlainObject(value.createMany)) {
    const data = value.createMany.data;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (!isPlainObject(row)) continue;
      const injected = injectOwnership(rel.targetModel, row, authority);
      await assertParentOwnership(client, rel.targetModel, injected, authority);
      Object.assign(row, injected);
    }
  }
  if ("update" in value) {
    const items = Array.isArray(value.update) ? value.update : [value.update];
    for (const item of items) {
      if (!isPlainObject(item)) continue;
      if (isPlainObject(item.where)) {
        const id = typeof item.where.id === "string" ? item.where.id : null;
        if (id) {
          await assertRowIdsOwned(client, rel.targetModel, [id], authority);
        } else {
          throw new TenantAccessError(
            "unsafe_nested_update",
            `Nested update at ${path} requires id selector`,
          );
        }
      }
      if (isPlainObject(item.data)) {
        scrubUpdateData(rel.targetModel, item.data, authority);
        await validateNestedRelationWrites(
          client,
          rel.targetModel,
          item.data,
          authority,
        );
      }
    }
  }
  if ("updateMany" in value && isPlainObject(value.updateMany)) {
    // Force tenant scope into nested updateMany where.
    value.updateMany.where = mergeWhere(
      value.updateMany.where,
      tenantScopeWhere(rel.targetModel, authority),
    );
    if (isPlainObject(value.updateMany.data)) {
      scrubUpdateData(rel.targetModel, value.updateMany.data, authority);
    }
  }
  if ("delete" in value && value.delete !== true) {
    await assertRowIdsOwned(
      client,
      rel.targetModel,
      extractConnectIds(value.delete),
      authority,
    );
  }
  if ("deleteMany" in value && isPlainObject(value.deleteMany)) {
    value.deleteMany.where = mergeWhere(
      value.deleteMany.where,
      tenantScopeWhere(rel.targetModel, authority),
    );
  }
  if ("upsert" in value) {
    throw new TenantAccessError(
      "unknown_relation_operation",
      `Nested upsert is not permitted at ${path} in PR 2`,
    );
  }
}

async function validateNestedRelationWrites(
  client: PrismaLike,
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    if (!isPlainObject(value) && !Array.isArray(value)) continue;

    const looksLikeRelation =
      isPlainObject(value) &&
      Object.keys(value).some((k) => RELATION_WRITE_OPS.has(k));

    const rel = relationMetaFor(model, key);
    if (!rel) {
      if (looksLikeRelation) {
        throw new TenantAccessError(
          "unknown_relation_shape",
          `Unknown merchant relation '${key}' on ${model}`,
        );
      }
      continue;
    }

    await validateRelationWriteValue(
      client,
      rel,
      value,
      authority,
      `${model}.${key}`,
    );
  }
}

function scopeNestedWhereArgs(
  targetModel: MerchantOwnedModel,
  relArgs: Record<string, unknown>,
  authority: TenantAuthority,
): Record<string, unknown> {
  const next = { ...relArgs };
  next.where = mergeWhere(
    next.where,
    tenantScopeWhere(targetModel, authority),
  );
  if (next.include) {
    next.include = scopeRelationObject(
      targetModel,
      next.include,
      authority,
      "include",
    );
  }
  if (next.select) {
    next.select = scopeRelationObject(
      targetModel,
      next.select,
      authority,
      "select",
    );
  }
  return next;
}

function scopeRelationObject(
  sourceModel: string,
  value: unknown,
  authority: TenantAuthority,
  mode: "include" | "select",
): Record<string, unknown> {
  if (value === true) {
    throw new TenantAccessError(
      "unknown_relation_shape",
      `Bare true ${mode} is not permitted without explicit relation keys on ${sourceModel}`,
    );
  }
  if (!isPlainObject(value)) {
    throw new TenantAccessError(
      "unknown_relation_shape",
      `Invalid ${mode} object on ${sourceModel}`,
    );
  }

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "_count") {
      out._count = scopeCountArg(sourceModel, raw, authority);
      continue;
    }

    const rel = relationMetaFor(sourceModel, key);
    if (!rel) {
      // Scalar select fields are allowed in select mode.
      if (mode === "select" && (raw === true || isPlainObject(raw))) {
        // If object has nested relation ops / include / select, require metadata.
        if (
          isPlainObject(raw) &&
          ("include" in raw ||
            "select" in raw ||
            Object.keys(raw).some((k) => RELATION_WRITE_OPS.has(k)))
        ) {
          throw new TenantAccessError(
            "unknown_relation_shape",
            `Unknown merchant relation '${key}' on ${sourceModel}`,
          );
        }
        out[key] = raw;
        continue;
      }
      if (mode === "include") {
        throw new TenantAccessError(
          "unknown_relation_shape",
          `Unknown merchant relation '${key}' on ${sourceModel}`,
        );
      }
      out[key] = raw;
      continue;
    }

    if (raw === true) {
      if (rel.cardinality === "many" && rel.nestedWherePermitted) {
        out[key] = {
          where: tenantScopeWhere(rel.targetModel, authority),
        };
      } else {
        // To-one: cannot inject where; validated after load.
        out[key] = true;
      }
      continue;
    }

    if (!isPlainObject(raw)) {
      throw new TenantAccessError(
        "unknown_relation_shape",
        `Invalid nested args for ${sourceModel}.${key}`,
      );
    }

    if (rel.cardinality === "many" && rel.nestedWherePermitted) {
      out[key] = scopeNestedWhereArgs(rel.targetModel, raw, authority);
    } else {
      // To-one: preserve select/include nesting but do not claim where filtering.
      const nested: Record<string, unknown> = { ...raw };
      if ("where" in nested) {
        throw new TenantAccessError(
          "unknown_relation_shape",
          `Nested where is not permitted on to-one relation ${sourceModel}.${key}`,
        );
      }
      if (nested.include) {
        nested.include = scopeRelationObject(
          rel.targetModel,
          nested.include,
          authority,
          "include",
        );
      }
      if (nested.select) {
        nested.select = scopeRelationObject(
          rel.targetModel,
          nested.select,
          authority,
          "select",
        );
      }
      out[key] = nested;
    }
  }
  return out;
}

function scopeCountArg(
  sourceModel: string,
  raw: unknown,
  authority: TenantAuthority,
): unknown {
  if (raw === true) {
    throw new TenantAccessError(
      "unknown_relation_shape",
      `Bare _count:true is not permitted on ${sourceModel}; enumerate relations`,
    );
  }
  if (!isPlainObject(raw) || !isPlainObject(raw.select)) {
    throw new TenantAccessError(
      "unknown_relation_shape",
      `Invalid _count on ${sourceModel}`,
    );
  }
  const select: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw.select)) {
    const rel = relationMetaFor(sourceModel, key);
    if (!rel || rel.cardinality !== "many") {
      throw new TenantAccessError(
        "unknown_relation_shape",
        `Unknown or non-countable relation '${key}' in _count on ${sourceModel}`,
      );
    }
    if (value === true) {
      select[key] = { where: tenantScopeWhere(rel.targetModel, authority) };
    } else if (isPlainObject(value)) {
      select[key] = {
        ...value,
        where: mergeWhere(
          value.where,
          tenantScopeWhere(rel.targetModel, authority),
        ),
      };
    } else {
      throw new TenantAccessError(
        "unknown_relation_shape",
        `Invalid _count.select.${key}`,
      );
    }
  }
  return { ...raw, select };
}

function applyRelationScopes(
  model: string,
  args: Record<string, unknown>,
  authority: TenantAuthority,
): Record<string, unknown> {
  const next = { ...args };
  if ("include" in next) {
    next.include = scopeRelationObject(model, next.include, authority, "include");
  }
  if ("select" in next) {
    next.select = scopeRelationObject(model, next.select, authority, "select");
  }
  return next;
}

function rowOwnershipOk(
  model: string,
  row: Record<string, unknown>,
  authority: TenantAuthority,
): boolean {
  if (DIRECT_MODEL_SET.has(model)) {
    const shop = row.shop;
    const shopId = row.shopId;
    if (shop !== authority.myshopifyDomain) return false;
    if (shopId == null) return true;
    return shopId === authority.shopId;
  }
  if (CHILD_MODEL_SET.has(model)) {
    const shopId = row.shopId;
    if (shopId != null && shopId !== authority.shopId) return false;
    return shopId === authority.shopId || shopId == null;
  }
  return false;
}

async function validateLoadedToOneRelations(
  client: PrismaLike,
  model: string,
  result: unknown,
  authority: TenantAuthority,
): Promise<void> {
  if (result == null) return;
  if (Array.isArray(result)) {
    for (const row of result) {
      await validateLoadedToOneRelations(client, model, row, authority);
    }
    return;
  }
  if (!isPlainObject(result)) return;

  for (const [key, value] of Object.entries(result)) {
    if (key === "_count" || value == null) continue;
    const rel = relationMetaFor(model, key);
    if (!rel) continue;

    if (rel.cardinality === "many") {
      if (!Array.isArray(value)) continue;
      for (const child of value) {
        if (isPlainObject(child)) {
          if (!rowOwnershipOk(rel.targetModel, child, authority)) {
            throw new TenantAccessError(
              "foreign_relation_row",
              `Relation ${model}.${key} returned a foreign or ambiguous row`,
            );
          }
          await validateLoadedToOneRelations(
            client,
            rel.targetModel,
            child,
            authority,
          );
        }
      }
      continue;
    }

    // To-one: prove ownership via tenant-scoped lookup by id.
    if (!isPlainObject(value) || typeof value.id !== "string") {
      throw new TenantAccessError(
        "foreign_relation_row",
        `To-one relation ${model}.${key} missing id for ownership proof`,
      );
    }
    const owned = await getDelegate(client, rel.targetModel).findFirst({
      where: mergeWhere(
        { id: value.id },
        tenantScopeWhere(rel.targetModel, authority),
      ),
      select: { id: true },
    });
    if (!owned) {
      throw new TenantAccessError(
        "foreign_relation_row",
        `To-one relation ${model}.${key} is not owned by the current tenant`,
      );
    }
    await validateLoadedToOneRelations(
      client,
      rel.targetModel,
      value,
      authority,
    );
  }
}

async function assertLeadTimeSecondaryOwnership(
  client: PrismaLike,
  model: string,
  result: unknown,
  authority: TenantAuthority,
): Promise<void> {
  if (model !== "LeadTimeSnapshot" || result == null) return;
  const rows = Array.isArray(result) ? result : [result];
  for (const row of rows) {
    if (!isPlainObject(row)) continue;
    if (typeof row.purchaseOrderId !== "string") {
      throw new TenantAccessError(
        "missing_parent_lineage",
        "LeadTimeSnapshot missing purchaseOrderId ownership evidence",
      );
    }
    await assertParentIdOwned(
      client,
      "PurchaseOrder",
      row.purchaseOrderId,
      authority,
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
): Promise<unknown> {
  const scope = tenantScopeWhere(model, authority);
  const scopedArgs = applyRelationScopes(model, args, authority);
  const findFirst = getDelegate(client, model).findFirst;
  const row = await findFirst({
    ...scopedArgs,
    where: mergeWhere(
      coerceDirectShopInWhere(scopedArgs.where, authority),
      scope,
    ),
  });

  if (operation === "findUniqueOrThrow" && !row) {
    throw new TenantAccessError(
      "not_found",
      `${model} not found for tenant`,
    );
  }

  await validateLoadedToOneRelations(client, model, row, authority);
  await assertLeadTimeSecondaryOwnership(client, model, row, authority);
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
    await validateNestedRelationWrites(client, model, data, authority);
    await assertParentOwnership(client, model, data, authority);

    const existing = (await delegate.findFirst({
      where: scopedWhere,
      select: { id: true },
    })) as { id: string } | null;
    if (!existing) {
      throw new TenantAccessError(
        "not_found",
        `${model} not found for tenant update`,
      );
    }
    await delegate.updateMany({
      where: mergeWhere({ id: existing.id }, scope),
      data,
    });
    const updated = await delegate.findFirst({
      where: mergeWhere({ id: existing.id }, scope),
    });
    await validateLoadedToOneRelations(client, model, updated, authority);
    return updated;
  }

  const existing = (await delegate.findFirst({
    where: scopedWhere,
    select: { id: true },
  })) as { id: string } | null;
  if (!existing) {
    throw new TenantAccessError(
      "not_found",
      `${model} not found for tenant delete`,
    );
  }
  const deleted = (await delegate.deleteMany({
    where: mergeWhere({ id: existing.id }, scope),
  })) as { count: number };
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

  const coercedWhere = coerceDirectShopInWhere(where, authority);

  const create = injectOwnership(
    model,
    (args.create ?? {}) as Record<string, unknown>,
    authority,
  );
  await assertParentOwnership(client, model, create, authority);
  await validateNestedRelationWrites(client, model, create, authority);

  const update = scrubUpdateData(
    model,
    (args.update ?? {}) as Record<string, unknown>,
    authority,
  );
  await validateNestedRelationWrites(client, model, update, authority);

  const scopedArgs = applyRelationScopes(model, args, authority);
  const row = await getDelegate(client, model).upsert({
    ...scopedArgs,
    where: coercedWhere,
    create,
    update,
  });
  await validateLoadedToOneRelations(client, model, row, authority);
  return row;
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
      return rewriteUniqueRead(client, model, operation, args, authority);

    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy": {
      const scopedArgs = applyRelationScopes(model, args, authority);
      const result = await query({
        ...scopedArgs,
        where: mergeWhere(scopedArgs.where, scope),
      });
      if (
        operation === "findFirst" ||
        operation === "findFirstOrThrow" ||
        operation === "findMany"
      ) {
        if (operation === "findFirstOrThrow" && result == null) {
          throw new TenantAccessError(
            "not_found",
            `${model} not found for tenant`,
          );
        }
        await validateLoadedToOneRelations(client, model, result, authority);
        await assertLeadTimeSecondaryOwnership(
          client,
          model,
          result,
          authority,
        );
      }
      return result;
    }

    case "create": {
      const data = injectOwnership(
        model,
        (args.data ?? {}) as Record<string, unknown>,
        authority,
      );
      await assertParentOwnership(client, model, data, authority);
      await validateNestedRelationWrites(client, model, data, authority);
      const scopedArgs = applyRelationScopes(model, args, authority);
      const created = await query({ ...scopedArgs, data });
      await validateLoadedToOneRelations(client, model, created, authority);
      return created;
    }

    case "createMany": {
      const records = args.data;
      if (Array.isArray(records)) {
        const data = records.map((row) =>
          injectOwnership(model, row as Record<string, unknown>, authority),
        );
        for (const row of data) {
          await assertParentOwnership(client, model, row, authority);
          await validateNestedRelationWrites(client, model, row, authority);
        }
        return query({ ...args, data });
      }
      const data = injectOwnership(
        model,
        (records ?? {}) as Record<string, unknown>,
        authority,
      );
      await assertParentOwnership(client, model, data, authority);
      await validateNestedRelationWrites(client, model, data, authority);
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
      await validateNestedRelationWrites(client, model, data, authority);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TenantModelDelegate = any;

export type TenantDb = {
  readonly authority: TenantAuthority;
  supplier: TenantModelDelegate;
  purchaseOrder: TenantModelDelegate;
  shopifyVariantCache: TenantModelDelegate;
  inventorySnapshot: TenantModelDelegate;
  variantAbcClass: TenantModelDelegate;
  forecastOverride: TenantModelDelegate;
  salesDailyAggregate: TenantModelDelegate;
  shopSettings: TenantModelDelegate;
  transferOrder: TenantModelDelegate;
  stocktake: TenantModelDelegate;
  bomComponent: TenantModelDelegate;
  lowStockAlert: TenantModelDelegate;
  supplierSkuMapping: TenantModelDelegate;
  volumePriceTier: TenantModelDelegate;
  leadTimeSnapshot: TenantModelDelegate;
  pOLineItem: TenantModelDelegate;
  transferLineItem: TenantModelDelegate;
  stocktakeLineItem: TenantModelDelegate;
  $transaction: <T>(fn: (db: TenantDb) => Promise<T>) => Promise<T>;
};

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
