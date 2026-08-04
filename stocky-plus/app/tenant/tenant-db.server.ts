/**
 * Tenant-bound database access contract.
 *
 * Created only from branded TenantAuthority. Does not expose the raw Prisma
 * client, unrestricted TransactionClient, or raw SQL helpers to callers.
 *
 * Third correction cycle (F-PR2R2-01..09 / D-030):
 * - Top-level compound unique selector flattening + canonical { id } rewrite
 * - Scalable tenant predicates (no owned-row ID materialization)
 * - Row-level unprovable to-one nulling / to-many filtering
 * - connectOrCreate sibling merge
 * - Unified D-030 ownership (canonical shopId authoritative)
 * - LeadTimeSnapshot purchaseOrderId proof injection
 * - Async relation scopes from the same compatibility adapter
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import rawPrisma from "../db.server";
import { assertTenantAuthority, type TenantAuthority } from "./authority.server";
import {
  assertTransactionLocalTenantContext,
  setTransactionLocalTenantContext,
} from "./db-context.server";
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
  createTenantScopeMemo,
  mergeWhere,
  nestedBulkScalarScopeWhereAsync,
  rowOwnershipOk,
  tenantScopeWhere,
  type TenantScopeMemo,
} from "./legacy-scope";
import {
  fkToRelationName,
  relationMetaFor,
  type MerchantRelationMeta,
} from "./relations";
import {
  appendNestedOperation,
  assertSelectorTenantIntent,
  flattenUniqueSelectorPredicate,
  globalUniqueSelectorExists,
  normalizeToArray,
  resolveOwnedRelationSelector,
  resolveOwnedRelationSelectors,
  resolveOwnedUniqueRow,
} from "./selectors";
import { normalizeShopDomain } from "./shop-domain";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type ClientState = {
  client: PrismaLike;
  authority: TenantAuthority;
  /** True when this client is already inside TenantDb.$transaction or an internal write tx. */
  inTransaction: boolean;
  /** Memoized scalable scopes / legacy representations for this operation/tx. */
  scopeMemo: TenantScopeMemo;
};

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

/** Proof fields injected for ownership validation; stripped before return. */
const PROOF_FIELDS_DIRECT = ["id", "shopId", "shop"] as const;
const PROOF_FIELDS_CHILD = ["id", "shopId"] as const;
const PROOF_FIELDS_LEAD_TIME = ["id", "shopId", "purchaseOrderId"] as const;

type ProofPlan = {
  /** Relative path from root result, e.g. "supplier" or "lineItems[]" */
  path: string;
  injected: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  directTenantScopeWhereSync as directTenantScopeWhere,
  childTenantScopeWhereSync as childTenantScopeWhere,
  tenantScopeWhere,
  tenantScopeWhereSync,
  rowOwnershipOk,
  mergeWhere,
  buildDirectTenantScopeWhere,
  createTenantScopeMemo,
} from "./legacy-scope";

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
      const coc = value.connectOrCreate;
      if (Array.isArray(coc)) {
        coc.forEach((item, i) => {
          if (isPlainObject(item)) {
            rejectForeignShopId(
              item.create,
              authority,
              `${path}.${key}.connectOrCreate[${i}].create`,
            );
          }
        });
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
    if (typeof where.shop === "string") {
      const normalized = normalizeShopDomain(where.shop);
      if (
        normalized.ok &&
        normalized.normalized === authority.myshopifyDomain
      ) {
        return true;
      }
    }

    for (const value of Object.values(where)) {
      if (isPlainObject(value) && typeof value.shop === "string") {
        const normalized = normalizeShopDomain(value.shop);
        if (
          normalized.ok &&
          normalized.normalized === authority.myshopifyDomain
        ) {
          return true;
        }
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
  state: ClientState,
  parentModel: MerchantOwnedModel,
  parentId: string,
): Promise<void> {
  const { client, authority, scopeMemo } = state;
  const delegate = getDelegate(client, parentModel);
  const scope = await tenantScopeWhere(
    client,
    parentModel,
    authority,
    scopeMemo,
  );
  const parent = await delegate.findFirst({
    where: mergeWhere({ id: parentId }, scope),
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
  state: ClientState,
  model: string,
  data: Record<string, unknown>,
): Promise<void> {
  const rule = PARENT_OWNERSHIP_RULES[model];
  if (!rule) return;

  const parentId = data[rule.foreignKey];
  if (typeof parentId === "string" && parentId) {
    await assertParentIdOwned(state, rule.parentModel, parentId);
  } else {
    const connect = data[fkToRelationName(rule.foreignKey)];
    if (isPlainObject(connect) && typeof connect.id === "string") {
      await assertParentIdOwned(state, rule.parentModel, connect.id);
    } else if (
      isPlainObject(connect) &&
      isPlainObject(connect.connect) &&
      typeof connect.connect.id === "string"
    ) {
      await assertParentIdOwned(
        state,
        rule.parentModel,
        connect.connect.id,
      );
    }
  }

  if (model === "LeadTimeSnapshot" && typeof data.purchaseOrderId === "string") {
    await assertParentIdOwned(state, "PurchaseOrder", data.purchaseOrderId);
  }
}

/**
 * Normalize and authorize nested relation write ops (F-PR2C-01/02/03).
 * Mutates `value` in place to rewrite selectors to canonical `{ id }` /
 * explicit connect|create so Prisma never evaluates unscoped caller selectors.
 */
/**
 * Normalize and authorize nested relation write ops (F-PR2C-01/02/03, F-PR2R2-04).
 * Rewrites selectors to canonical `{ id }` / explicit connect|create so Prisma
 * never evaluates unscoped caller selectors. Merges connectOrCreate results
 * into sibling connect/create without discarding caller intent.
 */
async function validateRelationWriteValue(
  state: ClientState,
  rel: MerchantRelationMeta,
  value: unknown,
  path: string,
): Promise<unknown> {
  const { client, authority, scopeMemo } = state;
  if (value === true || value === false || value == null) return value;

  if (!isPlainObject(value) && !Array.isArray(value)) {
    throw new TenantAccessError(
      "unknown_relation_operation",
      `Unsupported relation value at ${path}`,
    );
  }

  // Bare array form (rare) — treat as connect selectors.
  if (Array.isArray(value)) {
    return resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: value,
      authority,
      memo: scopeMemo,
    });
  }

  const next: Record<string, unknown> = { ...value };

  for (const op of Object.keys(next)) {
    if (!RELATION_WRITE_OPS.has(op)) {
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

  if ("connect" in next) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: next.connect,
      authority,
      memo: scopeMemo,
    });
    next.connect = Array.isArray(next.connect) ? resolved : resolved[0];
  }

  if ("set" in next) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: next.set,
      authority,
      memo: scopeMemo,
    });
    next.set = resolved;
  }

  if ("disconnect" in next && next.disconnect !== true) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: next.disconnect,
      authority,
      memo: scopeMemo,
    });
    next.disconnect = Array.isArray(next.disconnect) ? resolved : resolved[0];
  }

  if ("connectOrCreate" in next) {
    const items = normalizeToArray(next.connectOrCreate);
    const rewrittenConnects: Array<{ id: string }> = [];
    const rewrittenCreates: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!isPlainObject(item)) {
        throw new TenantAccessError(
          "unsupported_relation_selector",
          `Malformed connectOrCreate element at ${path}[${i}]`,
        );
      }
      if (!isPlainObject(item.where)) {
        throw new TenantAccessError(
          "unsupported_relation_selector",
          `connectOrCreate.where required at ${path}[${i}]`,
        );
      }

      // Flatten compound wrappers before scoped findFirst (F-PR2R2-01).
      let predicate = flattenUniqueSelectorPredicate(
        rel.targetModel,
        item.where,
      );
      if ("shop" in predicate && typeof predicate.shop === "string") {
        predicate = { ...predicate, shop: authority.myshopifyDomain };
      }
      const scope = await tenantScopeWhere(
        client,
        rel.targetModel,
        authority,
        scopeMemo,
      );
      const owned = (await getDelegate(client, rel.targetModel).findFirst({
        where: mergeWhere(predicate, scope),
        select: { id: true },
      })) as { id: string } | null;

      if (owned) {
        rewrittenConnects.push({ id: owned.id });
        continue;
      }

      const globalExists = await globalUniqueSelectorExists({
        client,
        targetModel: rel.targetModel,
        selector: item.where,
      });
      if (globalExists) {
        throw new TenantAccessError(
          "foreign_relation_target",
          `connectOrCreate.where matched a foreign ${rel.targetModel} at ${path}`,
        );
      }

      if (!isPlainObject(item.create)) {
        throw new TenantAccessError(
          "unsupported_relation_selector",
          `connectOrCreate.create required at ${path}[${i}]`,
        );
      }
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
      await assertParentOwnership(state, rel.targetModel, injected);
      await validateNestedRelationWrites(state, rel.targetModel, injected);
      rewrittenCreates.push(injected);
    }

    delete next.connectOrCreate;
    // Merge with existing sibling connect/create — never overwrite (F-PR2R2-04).
    if (rewrittenConnects.length) {
      next.connect = appendNestedOperation(next.connect, rewrittenConnects);
    }
    if (rewrittenCreates.length) {
      next.create = appendNestedOperation(next.create, rewrittenCreates);
    }
  }

  if ("create" in next) {
    const rows = normalizeToArray(next.create);
    const injectedRows: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (!isPlainObject(row)) {
        throw new TenantAccessError(
          "unknown_relation_operation",
          `Malformed create element at ${path}`,
        );
      }
      const injected = injectOwnership(rel.targetModel, row, authority);
      await assertParentOwnership(state, rel.targetModel, injected);
      const nested = (await validateNestedRelationWrites(
        state,
        rel.targetModel,
        injected,
      )) as Record<string, unknown>;
      injectedRows.push(nested);
    }
    next.create =
      Array.isArray(next.create) || injectedRows.length !== 1
        ? injectedRows
        : injectedRows[0];
  }

  if ("createMany" in next) {
    const cm = next.createMany;
    if (!isPlainObject(cm)) {
      throw new TenantAccessError(
        "unknown_relation_operation",
        `Malformed createMany at ${path}`,
      );
    }
    const data = cm.data;
    const rows = normalizeToArray(data);
    const injectedRows: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (!isPlainObject(row)) {
        throw new TenantAccessError(
          "unknown_relation_operation",
          `Malformed createMany.data at ${path}`,
        );
      }
      const injected = injectOwnership(rel.targetModel, row, authority);
      await assertParentOwnership(state, rel.targetModel, injected);
      injectedRows.push(injected);
    }
    next.createMany = {
      ...cm,
      data: Array.isArray(data) || injectedRows.length !== 1
        ? injectedRows
        : injectedRows[0],
    };
  }

  if ("update" in next) {
    const items = normalizeToArray(next.update);
    const rewrittenUpdates: unknown[] = [];
    for (const item of items) {
      if (!isPlainObject(item)) {
        throw new TenantAccessError(
          "unsafe_nested_update",
          `Malformed nested update at ${path}`,
        );
      }
      if (!isPlainObject(item.where)) {
        throw new TenantAccessError(
          "unsafe_nested_update",
          `Nested update at ${path} requires a unique selector`,
        );
      }
      const resolved = await resolveOwnedRelationSelector({
        client,
        targetModel: rel.targetModel,
        selector: item.where,
        authority,
        memo: scopeMemo,
      });
      if (!isPlainObject(item.data)) {
        throw new TenantAccessError(
          "unsafe_nested_update",
          `Nested update at ${path} requires data`,
        );
      }
      const scrubbed = scrubUpdateData(
        rel.targetModel,
        item.data as Record<string, unknown>,
        authority,
      );
      const nestedData = (await validateNestedRelationWrites(
        state,
        rel.targetModel,
        scrubbed,
      )) as Record<string, unknown>;
      rewrittenUpdates.push({ where: resolved, data: nestedData });
    }
    next.update =
      Array.isArray(next.update) || rewrittenUpdates.length !== 1
        ? rewrittenUpdates
        : rewrittenUpdates[0];
  }

  if ("updateMany" in next) {
    const items = normalizeToArray(next.updateMany);
    const rewritten: unknown[] = [];
    const scope = await nestedBulkScalarScopeWhereAsync(
      client,
      rel.targetModel,
      authority,
      scopeMemo,
    );
    for (const item of items) {
      if (!isPlainObject(item)) {
        throw new TenantAccessError(
          "unknown_relation_operation",
          `Malformed updateMany element at ${path}`,
        );
      }
      if (!isPlainObject(item.data)) {
        throw new TenantAccessError(
          "unknown_relation_operation",
          `updateMany.data required at ${path}`,
        );
      }
      const scrubbed = scrubUpdateData(
        rel.targetModel,
        item.data as Record<string, unknown>,
        authority,
      );
      await validateNestedRelationWrites(state, rel.targetModel, scrubbed);
      rewritten.push({
        where: mergeWhere(item.where, scope),
        data: scrubbed,
      });
    }
    next.updateMany =
      Array.isArray(next.updateMany) || rewritten.length !== 1
        ? rewritten
        : rewritten[0];
  }

  if ("delete" in next && next.delete !== true) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: next.delete,
      authority,
      memo: scopeMemo,
    });
    next.delete = Array.isArray(next.delete) ? resolved : resolved[0];
  }

  if ("deleteMany" in next) {
    const items = normalizeToArray(next.deleteMany);
    const scope = await nestedBulkScalarScopeWhereAsync(
      client,
      rel.targetModel,
      authority,
      scopeMemo,
    );
    const rewritten: unknown[] = [];
    for (const item of items) {
      if (item === true || item == null) {
        rewritten.push(scope);
        continue;
      }
      if (!isPlainObject(item)) {
        throw new TenantAccessError(
          "unknown_relation_operation",
          `Malformed deleteMany element at ${path}`,
        );
      }
      const filter = isPlainObject(item.where) ? item.where : item;
      if ("where" in item && Object.keys(item).some((k) => k !== "where")) {
        throw new TenantAccessError(
          "unknown_relation_operation",
          `Malformed deleteMany element at ${path}`,
        );
      }
      rewritten.push(mergeWhere(filter, scope));
    }
    next.deleteMany =
      Array.isArray(next.deleteMany) || rewritten.length !== 1
        ? rewritten
        : rewritten[0];
  }

  if ("upsert" in next) {
    throw new TenantAccessError(
      "unknown_relation_operation",
      `Nested upsert is not permitted at ${path} in PR 2`,
    );
  }

  return next;
}

async function validateNestedRelationWrites(
  state: ClientState,
  model: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const next: Record<string, unknown> = { ...data };
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

    next[key] = await validateRelationWriteValue(
      state,
      rel,
      value,
      `${model}.${key}`,
    );
  }
  return next;
}

function proofFieldsFor(model: string): readonly string[] {
  if (model === "LeadTimeSnapshot") return PROOF_FIELDS_LEAD_TIME;
  if (DIRECT_MODEL_SET.has(model)) return PROOF_FIELDS_DIRECT;
  if (CHILD_MODEL_SET.has(model)) return PROOF_FIELDS_CHILD;
  return ["id"];
}

function stripInjectedProofFields(
  result: unknown,
  plans: ProofPlan[],
): unknown {
  if (result == null || plans.length === 0) return result;

  function stripAt(
    node: unknown,
    pathParts: string[],
    injected: string[],
  ): void {
    if (node == null) return;
    if (pathParts.length === 0) {
      if (isPlainObject(node)) {
        for (const f of injected) delete node[f];
      }
      return;
    }
    const [head, ...rest] = pathParts;
    if (!head) return;
    if (Array.isArray(node)) {
      for (const item of node) stripAt(item, pathParts, injected);
      return;
    }
    if (!isPlainObject(node)) return;
    const child = node[head];
    if (Array.isArray(child)) {
      for (const item of child) stripAt(item, rest, injected);
    } else {
      stripAt(child, rest, injected);
    }
  }

  for (const plan of plans) {
    const parts = plan.path.split(".").filter(Boolean);
    stripAt(result, parts, plan.injected);
  }
  return result;
}

/** Recursively strip all fields from an unprovable relation payload. */
function scrubRelationPayload(value: unknown): null {
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      delete value[key];
    }
  }
  return null;
}

async function scopeNestedWhereArgs(
  state: ClientState,
  targetModel: MerchantOwnedModel,
  relArgs: Record<string, unknown>,
  plans: ProofPlan[],
  pathPrefix: string,
): Promise<Record<string, unknown>> {
  const { client, authority, scopeMemo } = state;
  const next = { ...relArgs };
  const scope = await tenantScopeWhere(
    client,
    targetModel,
    authority,
    scopeMemo,
  );
  next.where = mergeWhere(next.where, scope);
  if (next.include) {
    next.include = await scopeRelationObject(
      state,
      targetModel,
      next.include,
      "include",
      plans,
      pathPrefix,
    );
  }
  if (next.select) {
    const needed = proofFieldsFor(targetModel);
    const injected: string[] = [];
    if (isPlainObject(next.select)) {
      const sel = { ...next.select };
      for (const f of needed) {
        if (!(f in sel)) {
          sel[f] = true;
          injected.push(f);
        }
      }
      if (injected.length) plans.push({ path: pathPrefix, injected });
      next.select = await scopeRelationObject(
        state,
        targetModel,
        sel,
        "select",
        plans,
        pathPrefix,
      );
    } else {
      next.select = await scopeRelationObject(
        state,
        targetModel,
        next.select,
        "select",
        plans,
        pathPrefix,
      );
    }
  }
  return next;
}

async function scopeRelationObject(
  state: ClientState,
  sourceModel: string,
  value: unknown,
  mode: "include" | "select",
  plans: ProofPlan[] = [],
  pathPrefix = "",
): Promise<Record<string, unknown>> {
  const { client, authority, scopeMemo } = state;
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
      out._count = await scopeCountArg(state, sourceModel, raw);
      continue;
    }

    const rel = relationMetaFor(sourceModel, key);
    if (!rel) {
      if (mode === "select" && (raw === true || isPlainObject(raw))) {
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

    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (raw === true) {
      if (rel.cardinality === "many" && rel.nestedWherePermitted) {
        const scope = await tenantScopeWhere(
          client,
          rel.targetModel,
          authority,
          scopeMemo,
        );
        out[key] = { where: scope };
      } else {
        // To-one: load inside TenantDb; post-load nulls unprovable rows.
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
      out[key] = await scopeNestedWhereArgs(
        state,
        rel.targetModel,
        raw,
        plans,
        childPath,
      );
    } else {
      const nested: Record<string, unknown> = { ...raw };
      if ("where" in nested) {
        throw new TenantAccessError(
          "unknown_relation_shape",
          `Nested where is not permitted on to-one relation ${sourceModel}.${key}`,
        );
      }
      if (nested.include) {
        nested.include = await scopeRelationObject(
          state,
          rel.targetModel,
          nested.include,
          "include",
          plans,
          childPath,
        );
      }
      if (nested.select) {
        const needed = proofFieldsFor(rel.targetModel);
        const injected: string[] = [];
        if (isPlainObject(nested.select)) {
          const sel = { ...nested.select };
          for (const f of needed) {
            if (!(f in sel)) {
              sel[f] = true;
              injected.push(f);
            }
          }
          if (injected.length) plans.push({ path: childPath, injected });
          nested.select = await scopeRelationObject(
            state,
            rel.targetModel,
            sel,
            "select",
            plans,
            childPath,
          );
        }
      }
      out[key] = nested;
    }
  }
  return out;
}

async function scopeCountArg(
  state: ClientState,
  sourceModel: string,
  raw: unknown,
): Promise<unknown> {
  const { client, authority, scopeMemo } = state;
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
    const scope = await tenantScopeWhere(
      client,
      rel.targetModel,
      authority,
      scopeMemo,
    );
    if (value === true) {
      select[key] = { where: scope };
    } else if (isPlainObject(value)) {
      select[key] = {
        ...value,
        where: mergeWhere(value.where, scope),
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

async function applyRelationScopes(
  state: ClientState,
  model: string,
  args: Record<string, unknown>,
  plans: ProofPlan[],
): Promise<Record<string, unknown>> {
  const next = { ...args };
  if ("include" in next) {
    next.include = await scopeRelationObject(
      state,
      model,
      next.include,
      "include",
      plans,
    );
  }
  if ("select" in next) {
    // Inject top-level proof fields when selecting a subset.
    if (isPlainObject(next.select)) {
      const needed = proofFieldsFor(model);
      const injected: string[] = [];
      const sel = { ...next.select };
      for (const f of needed) {
        if (!(f in sel)) {
          sel[f] = true;
          injected.push(f);
        }
      }
      if (injected.length) plans.push({ path: "", injected });
      next.select = await scopeRelationObject(
        state,
        model,
        sel,
        "select",
        plans,
      );
    } else {
      next.select = await scopeRelationObject(
        state,
        model,
        next.select,
        "select",
        plans,
      );
    }
  }
  return next;
}

/**
 * Post-load relation ownership (F-PR2R2-03 / D-030).
 * Unprovable to-one → null (parent retained). Unprovable to-many → filtered.
 * Top-level access to the unprovable row itself remains denied elsewhere.
 */
async function validateLoadedRelations(
  state: ClientState,
  model: string,
  result: unknown,
): Promise<void> {
  if (result == null) return;
  if (Array.isArray(result)) {
    for (const row of result) {
      await validateLoadedRelations(state, model, row);
    }
    return;
  }
  if (!isPlainObject(result)) return;

  const { client, authority, scopeMemo } = state;

  for (const [key, value] of Object.entries(result)) {
    if (key === "_count" || value == null) continue;
    const rel = relationMetaFor(model, key);
    if (!rel) continue;

    if (rel.cardinality === "many") {
      if (!Array.isArray(value)) continue;
      const kept: unknown[] = [];
      for (const child of value) {
        if (!isPlainObject(child)) continue;
        if (!rowOwnershipOk(rel.targetModel, child, authority)) {
          continue; // filter unprovable / foreign children
        }
        // Secondary lineage for LeadTimeSnapshot
        if (rel.targetModel === "LeadTimeSnapshot") {
          try {
            await assertLeadTimeSecondaryOwnership(
              state,
              rel.targetModel,
              child,
            );
          } catch {
            continue;
          }
        }
        await validateLoadedRelations(state, rel.targetModel, child);
        kept.push(child);
      }
      result[key] = kept;
      continue;
    }

    // To-one: null when unprovable; do not abort the parent query.
    if (!isPlainObject(value)) {
      result[key] = null;
      continue;
    }

    let owned = false;
    if (typeof value.id === "string") {
      const scope = await tenantScopeWhere(
        client,
        rel.targetModel,
        authority,
        scopeMemo,
      );
      const found = await getDelegate(client, rel.targetModel).findFirst({
        where: mergeWhere({ id: value.id }, scope),
        select: { id: true },
      });
      owned = found != null;
    } else {
      owned = rowOwnershipOk(rel.targetModel, value, authority);
    }

    if (!owned) {
      result[key] = scrubRelationPayload(value);
      continue;
    }

    if (rel.targetModel === "LeadTimeSnapshot") {
      try {
        await assertLeadTimeSecondaryOwnership(state, rel.targetModel, value);
      } catch {
        result[key] = scrubRelationPayload(value);
        continue;
      }
    }

    await validateLoadedRelations(state, rel.targetModel, value);
  }
}

async function assertLeadTimeSecondaryOwnership(
  state: ClientState,
  model: string,
  result: unknown,
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
    await assertParentIdOwned(state, "PurchaseOrder", row.purchaseOrderId);
  }
}

/**
 * Prove a previously resolved row remains owned without collecting null-legacy
 * evidence when the row already has non-null current-tenant shopId (F-PR2R4-05).
 */
async function assertStillOwnedById(
  state: ClientState,
  model: string,
  ownedId: string,
): Promise<void> {
  const { client, authority, scopeMemo } = state;
  const delegate = getDelegate(client, model);

  const canonical = (await delegate.findFirst({
    where: { id: ownedId, shopId: authority.shopId },
    select: { id: true },
  })) as { id: string } | null;
  if (canonical) return;

  // Null-owned / child lineage path — may require legacy discovery.
  const scope = await tenantScopeWhere(client, model, authority, scopeMemo);
  const stillOwned = (await delegate.findFirst({
    where: mergeWhere({ id: ownedId }, scope),
    select: { id: true },
  })) as { id: string } | null;
  if (!stillOwned) {
    throw new TenantAccessError(
      "not_found",
      `${model} is no longer owned by the current tenant`,
    );
  }
}

const SERIALIZATION_RETRY_LIMIT = 3;

function isSerializationFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return (
    e.code === "P2034" ||
    (typeof e.message === "string" &&
      /could not serialize|serialization failure|40001/i.test(e.message))
  );
}

/**
 * Run work inside a tenant-bound DB transaction with transaction-local context
 * (PR 3 / D-017). Reuses the current transaction when already nested; verifies
 * context matches TenantAuthority. Does not hold transactions across Shopify
 * network I/O, Redis waits, or user interaction.
 */
async function withTenantBoundTransactionState<T>(
  state: ClientState,
  fn: (txState: ClientState) => Promise<T>,
  options: { serializable?: boolean } = {},
): Promise<T> {
  if (state.inTransaction) {
    await assertTransactionLocalTenantContext(
      state.client as Prisma.TransactionClient,
      state.authority,
    );
    return fn(state);
  }

  const root = state.client as PrismaClient;
  if (typeof root.$transaction !== "function") {
    throw new TenantAccessError(
      "nested_transaction_unsupported",
      "Tenant-bound transaction requires a root Prisma client",
    );
  }

  const retries = options.serializable ? SERIALIZATION_RETRY_LIMIT : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await root.$transaction(
        async (tx) => {
          await setTransactionLocalTenantContext(tx, state.authority);
          await assertTransactionLocalTenantContext(tx, state.authority);
          return fn({
            client: tx,
            authority: state.authority,
            inTransaction: true,
            scopeMemo: createTenantScopeMemo(),
          });
        },
        {
          ...(options.serializable
            ? {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              }
            : {}),
          maxWait: 5_000,
          timeout: 15_000,
        },
      );
    } catch (err) {
      lastError = err;
      if (!options.serializable || !isSerializationFailure(err)) throw err;
    }
  }
  throw lastError;
}

/**
 * Run ownership-dependent writes inside one DB transaction (F-PR2C-06/09).
 * Reuses the current transaction client when already nested; otherwise starts
 * an internal serializable tenant-bound transaction with bounded retry.
 */
async function withWriteTransaction<T>(
  state: ClientState,
  fn: (txState: ClientState) => Promise<T>,
): Promise<T> {
  return withTenantBoundTransactionState(state, fn, { serializable: true });
}

async function rewriteUniqueRead(
  state: ClientState,
  model: string,
  operation: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client, authority, scopeMemo } = state;
  if (!MERCHANT_MODEL_SET.has(model)) {
    throw new TenantAccessError(
      "unknown_merchant_model",
      `Model ${model} is not merchant-owned`,
    );
  }

  // Flatten compound WhereUniqueInput → scalar predicates, then scope.
  let ownedId: { id: string } | null;
  try {
    ownedId = await resolveOwnedUniqueRow({
      client,
      targetModel: model as MerchantOwnedModel,
      selector: args.where,
      authority,
      memo: scopeMemo,
    });
  } catch (err) {
    if (err instanceof TenantAccessError) throw err;
    throw err;
  }

  if (!ownedId) {
    if (operation === "findUniqueOrThrow") {
      throw new TenantAccessError("not_found", `${model} not found for tenant`);
    }
    return null;
  }

  const plans: ProofPlan[] = [];
  const scopedArgs = await applyRelationScopes(state, model, args, plans);
  const findFirst = getDelegate(client, model).findFirst;
  const row = await findFirst({
    ...scopedArgs,
    where: { id: ownedId.id },
  });

  if (operation === "findUniqueOrThrow" && !row) {
    throw new TenantAccessError("not_found", `${model} not found for tenant`);
  }

  await validateLoadedRelations(state, model, row);
  await assertLeadTimeSecondaryOwnership(state, model, row);
  stripInjectedProofFields(row, plans);
  return row;
}

async function rewriteUniqueWrite(
  state: ClientState,
  model: string,
  operation: "update" | "delete",
  args: Record<string, unknown>,
): Promise<unknown> {
  return withWriteTransaction(state, async (txState) => {
    const { client, authority, scopeMemo } = txState;
    const delegate = getDelegate(client, model);

    const owned = await resolveOwnedUniqueRow({
      client,
      targetModel: model as MerchantOwnedModel,
      selector: args.where,
      authority,
      memo: scopeMemo,
    });
    if (!owned) {
      throw new TenantAccessError(
        "not_found",
        `${model} not found for tenant ${operation}`,
      );
    }

    if (operation === "update") {
      let data = scrubUpdateData(
        model,
        (args.data ?? {}) as Record<string, unknown>,
        authority,
      );
      data = await validateNestedRelationWrites(txState, model, data);
      await assertParentOwnership(txState, model, data);

      // Re-check ownership inside the same transaction (fail closed if lost).
      // Canonical non-null shopId avoids legacy discovery (F-PR2R4-05).
      await assertStillOwnedById(txState, model, owned.id);

      const plans: ProofPlan[] = [];
      const projection = await applyRelationScopes(
        txState,
        model,
        {
          ...(args.select ? { select: args.select } : {}),
          ...(args.include ? { include: args.include } : {}),
        },
        plans,
      );

      const updateArgs: Record<string, unknown> = {
        where: { id: owned.id },
        data,
        ...projection,
      };

      const updated = await delegate.update(updateArgs);
      await validateLoadedRelations(txState, model, updated);
      stripInjectedProofFields(updated, plans);
      return updated;
    }

    await assertStillOwnedById(txState, model, owned.id);
    // Delete by primary key after ownership proof — do not re-enter overflow
    // discovery for canonically owned rows.
    const deleted = (await delegate.deleteMany({
      where: { id: owned.id },
    })) as { count: number };
    if (deleted.count === 0) {
      throw new TenantAccessError(
        "not_found",
        `${model} not found for tenant delete`,
      );
    }
    return { id: owned.id };
  });
}

async function rewriteUpsert(
  state: ClientState,
  model: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withWriteTransaction(state, async (txState) => {
    const { client, authority, scopeMemo } = txState;
    const where = args.where;

    // Reject foreign tenant-bearing selectors before any create/update.
    if (MERCHANT_MODEL_SET.has(model) && where != null) {
      assertSelectorTenantIntent(
        model as MerchantOwnedModel,
        where,
        authority,
      );
    }

    if (!hasTenantBearingUnique(model, where, authority)) {
      throw new TenantAccessError(
        "unsafe_upsert",
        `Upsert on ${model} requires a tenant-bearing unique selector`,
      );
    }

    // F-PR2R4-01: resolve normalized legacy ownership before create/update.
    // Never coerce shop to a canonical literal and let Prisma create a duplicate.
    const owned = await resolveOwnedUniqueRow({
      client,
      targetModel: model as MerchantOwnedModel,
      selector: where,
      authority,
      memo: scopeMemo,
    });

    const plans: ProofPlan[] = [];
    // Projection only — never spread upsert where/create/update into update/create.
    const projectionArgs = await applyRelationScopes(
      txState,
      model,
      {
        ...(args.select ? { select: args.select } : {}),
        ...(args.include ? { include: args.include } : {}),
      },
      plans,
    );
    const delegate = getDelegate(client, model);

    if (owned) {
      let update = scrubUpdateData(
        model,
        (args.update ?? {}) as Record<string, unknown>,
        authority,
      );
      update = await validateNestedRelationWrites(txState, model, update);
      await assertStillOwnedById(txState, model, owned.id);

      const updated = await delegate.update({
        ...projectionArgs,
        where: { id: owned.id },
        data: update,
      });
      await validateLoadedRelations(txState, model, updated);
      stripInjectedProofFields(updated, plans);
      return updated;
    }

    // No owned row — create only when selector intent is valid and unambiguous.
    let create = injectOwnership(
      model,
      (args.create ?? {}) as Record<string, unknown>,
      authority,
    );
    await assertParentOwnership(txState, model, create);
    create = await validateNestedRelationWrites(txState, model, create);

    const created = await delegate.create({
      ...projectionArgs,
      data: create,
    });
    await validateLoadedRelations(txState, model, created);
    stripInjectedProofFields(created, plans);
    return created;
  });
}

async function runScopedOperation(
  state: ClientState,
  model: string,
  operation: string,
  args: Record<string, unknown>,
  query: (args: unknown) => Promise<unknown>,
): Promise<unknown> {
  if (!MERCHANT_MODEL_SET.has(model)) {
    throw new TenantAccessError(
      "model_not_permitted",
      `Tenant DB cannot access model ${model}`,
    );
  }

  // PR 3 / D-017: every merchant-domain read establishes transaction-local
  // tenant context before querying. Writes already use withWriteTransaction.
  const readOps = new Set([
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
  ]);
  if (readOps.has(operation) && !state.inTransaction) {
    return withTenantBoundTransactionState(state, (txState) =>
      runScopedOperation(txState, model, operation, args, (scopedArgs) =>
        getDelegate(txState.client, model)[operation](scopedArgs),
      ),
    );
  }

  const { client, authority, scopeMemo } = state;

  switch (operation) {
    case "findUnique":
    case "findUniqueOrThrow":
      return rewriteUniqueRead(state, model, operation, args);

    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy": {
      const scope = await tenantScopeWhere(
        client,
        model,
        authority,
        scopeMemo,
      );
      const plans: ProofPlan[] = [];
      const scopedArgs = await applyRelationScopes(state, model, args, plans);
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
        await validateLoadedRelations(state, model, result);
        await assertLeadTimeSecondaryOwnership(state, model, result);
        stripInjectedProofFields(result, plans);
      }
      return result;
    }

    case "create":
      // Ordinary create does not need a precomputed tenant scope (F-PR2R2-02).
      return withWriteTransaction(state, async (txState) => {
        let data = injectOwnership(
          model,
          (args.data ?? {}) as Record<string, unknown>,
          txState.authority,
        );
        await assertParentOwnership(txState, model, data);
        data = await validateNestedRelationWrites(txState, model, data);
        const plans: ProofPlan[] = [];
        const scopedArgs = await applyRelationScopes(
          txState,
          model,
          args,
          plans,
        );
        const created = await getDelegate(txState.client, model).create({
          ...scopedArgs,
          data,
        });
        await validateLoadedRelations(txState, model, created);
        stripInjectedProofFields(created, plans);
        return created;
      });

    case "createMany":
      return withWriteTransaction(state, async (txState) => {
        const records = args.data;
        if (Array.isArray(records)) {
          const data = [];
          for (const row of records) {
            let injected = injectOwnership(
              model,
              row as Record<string, unknown>,
              txState.authority,
            );
            await assertParentOwnership(txState, model, injected);
            injected = await validateNestedRelationWrites(
              txState,
              model,
              injected,
            );
            data.push(injected);
          }
          return getDelegate(txState.client, model).createMany({
            ...args,
            data,
          });
        }
        let data = injectOwnership(
          model,
          (records ?? {}) as Record<string, unknown>,
          txState.authority,
        );
        await assertParentOwnership(txState, model, data);
        data = await validateNestedRelationWrites(txState, model, data);
        return getDelegate(txState.client, model).createMany({
          ...args,
          data,
        });
      });

    case "update":
      return rewriteUniqueWrite(state, model, "update", args);

    case "updateMany":
      return withWriteTransaction(state, async (txState) => {
        let data = scrubUpdateData(
          model,
          (args.data ?? {}) as Record<string, unknown>,
          txState.authority,
        );
        data = await validateNestedRelationWrites(txState, model, data);
        const txScope = await tenantScopeWhere(
          txState.client,
          model,
          txState.authority,
          txState.scopeMemo,
        );
        return getDelegate(txState.client, model).updateMany({
          ...args,
          where: mergeWhere(args.where, txScope),
          data,
        });
      });

    case "upsert":
      return rewriteUpsert(state, model, args);

    case "delete":
      return rewriteUniqueWrite(state, model, "delete", args);

    case "deleteMany":
      return withWriteTransaction(state, async (txState) => {
        const txScope = await tenantScopeWhere(
          txState.client,
          model,
          txState.authority,
          txState.scopeMemo,
        );
        return getDelegate(txState.client, model).deleteMany({
          ...args,
          where: mergeWhere(args.where, txScope),
        });
      });

    default:
      throw new TenantAccessError(
        "unsupported_operation",
        `Unsupported Prisma operation ${operation} on ${model}`,
      );
  }
}

function buildTenantDelegates(state: ClientState) {
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
          // Fresh memo per top-level operation; nested writes share via state.
          {
            ...state,
            scopeMemo: createTenantScopeMemo(),
          },
          model,
          operation,
          args,
          (scopedArgs) =>
            getDelegate(state.client, model)[operation](scopedArgs),
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
  return createTenantDbFromClient(rawPrisma, authority, false);
}

function createTenantDbFromClient(
  client: PrismaLike,
  authority: TenantAuthority,
  inTransaction: boolean,
): TenantDb {
  assertTenantAuthority(authority);
  const state: ClientState = {
    client,
    authority,
    inTransaction,
    scopeMemo: createTenantScopeMemo(),
  };
  const delegates = buildTenantDelegates(state);

  const db: TenantDb = {
    authority,
    ...(delegates as Omit<TenantDb, "authority" | "$transaction">),
    $transaction: async <T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> => {
      if (inTransaction) {
        // Reuse current transaction; verify context matches authority.
        await assertTransactionLocalTenantContext(
          client as Prisma.TransactionClient,
          authority,
        );
        return fn(db);
      }
      if (
        !("$transaction" in client) ||
        typeof (client as PrismaClient).$transaction !== "function"
      ) {
        throw new TenantAccessError(
          "nested_transaction_unsupported",
          "Nested tenant transactions are not supported",
        );
      }
      return (client as PrismaClient).$transaction(async (tx) => {
        await setTransactionLocalTenantContext(tx, authority);
        await assertTransactionLocalTenantContext(tx, authority);
        const tenantTx = createTenantDbFromClient(tx, authority, true);
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
