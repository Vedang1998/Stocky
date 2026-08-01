/**
 * Tenant-bound database access contract.
 *
 * Created only from branded TenantAuthority. Does not expose the raw Prisma
 * client, unrestricted TransactionClient, or raw SQL helpers to callers.
 *
 * Follow-up corrections (F-PR2C-01..09):
 * - Model-aware relation selector authorization + canonical { id } rewrite
 * - connectOrCreate foreign global-match fail-closed
 * - Array-form nested bulk mutation scoping
 * - Normalization-aware legacy ownership (phase1-shop-domain-v1)
 * - Partial-selection proof-field injection/stripping
 * - Real single-row update with nested writes + projections
 * - Precheck + mutation atomicity via internal transactions
 */

import { Prisma, type PrismaClient } from "@prisma/client";
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
  mergeWhere,
  nestedBulkScalarScopeWhere,
  rowOwnershipOk,
  tenantScopeWhere,
  tenantScopeWhereSync,
} from "./legacy-scope";
import {
  fkToRelationName,
  relationMetaFor,
  type MerchantRelationMeta,
} from "./relations";
import {
  globalUniqueSelectorExists,
  normalizeToArray,
  resolveOwnedRelationSelector,
  resolveOwnedRelationSelectors,
} from "./selectors";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type ClientState = {
  client: PrismaLike;
  authority: TenantAuthority;
  /** True when this client is already inside TenantDb.$transaction or an internal write tx. */
  inTransaction: boolean;
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
    if (where.shop === authority.myshopifyDomain) return true;

    for (const value of Object.values(where)) {
      if (isPlainObject(value) && value.shop === authority.myshopifyDomain) {
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
  const scope = await tenantScopeWhere(client, parentModel, authority);
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

  if (model === "LeadTimeSnapshot" && typeof data.purchaseOrderId === "string") {
    await assertParentIdOwned(
      client,
      "PurchaseOrder",
      data.purchaseOrderId,
      authority,
    );
  }
}

/**
 * Normalize and authorize nested relation write ops (F-PR2C-01/02/03).
 * Mutates `value` in place to rewrite selectors to canonical `{ id }` /
 * explicit connect|create so Prisma never evaluates unscoped caller selectors.
 */
async function validateRelationWriteValue(
  client: PrismaLike,
  rel: MerchantRelationMeta,
  value: unknown,
  authority: TenantAuthority,
  path: string,
): Promise<unknown> {
  if (value === true || value === false || value == null) return value;

  if (!isPlainObject(value) && !Array.isArray(value)) {
    throw new TenantAccessError(
      "unknown_relation_operation",
      `Unsupported relation value at ${path}`,
    );
  }

  // Bare array form (rare) — treat as connect selectors.
  if (Array.isArray(value)) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: value,
      authority,
    });
    return resolved;
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
    });
    next.connect = Array.isArray(next.connect) ? resolved : resolved[0];
  }

  if ("set" in next) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: next.set,
      authority,
    });
    next.set = resolved;
  }

  if ("disconnect" in next && next.disconnect !== true) {
    const resolved = await resolveOwnedRelationSelectors({
      client,
      targetModel: rel.targetModel,
      selectors: next.disconnect,
      authority,
    });
    next.disconnect = Array.isArray(next.disconnect) ? resolved : resolved[0];
  }

  if ("connectOrCreate" in next) {
    const items = normalizeToArray(next.connectOrCreate);
    const rewritten: unknown[] = [];
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

      const scope = await tenantScopeWhere(client, rel.targetModel, authority);
      const owned = (await getDelegate(client, rel.targetModel).findFirst({
        where: mergeWhere(item.where, scope),
        select: { id: true },
      })) as { id: string } | null;

      if (owned) {
        // Prefer explicit connect so Prisma never re-evaluates caller where.
        rewritten.push({ connect: { id: owned.id } });
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
      await assertParentOwnership(client, rel.targetModel, injected, authority);
      await validateNestedRelationWrites(
        client,
        rel.targetModel,
        injected,
        authority,
      );
      // Explicit create branch — do not pass original connectOrCreate to Prisma.
      rewritten.push({ create: injected });
    }

    // Prisma nested connectOrCreate expects connectOrCreate shape; we rewrite
    // the whole relation value into sequential connect/create ops when mixed.
    // When every item is create-only or connect-only, flatten accordingly.
    if (rewritten.length === 1 && isPlainObject(rewritten[0])) {
      const sole = rewritten[0] as Record<string, unknown>;
      if ("connect" in sole && !("create" in sole)) {
        delete next.connectOrCreate;
        next.connect = sole.connect;
      } else if ("create" in sole && !("connect" in sole)) {
        delete next.connectOrCreate;
        next.create = sole.create;
      } else {
        next.connectOrCreate = Array.isArray(next.connectOrCreate)
          ? rewritten.map((r) => {
              if (isPlainObject(r) && "connect" in r) {
                return {
                  where: r.connect,
                  create: {}, // unreachable — connect path already rewritten
                };
              }
              return r;
            })
          : rewritten[0];
        // Safer: if we still have connectOrCreate, convert mixed array to
        // create + connect siblings is not valid Prisma. Use first form only
        // when single; for multi, expand into create array + connect array.
        const connects = rewritten
          .filter((r) => isPlainObject(r) && "connect" in r)
          .map((r) => (r as { connect: { id: string } }).connect);
        const creates = rewritten
          .filter((r) => isPlainObject(r) && "create" in r)
          .map((r) => (r as { create: Record<string, unknown> }).create);
        delete next.connectOrCreate;
        if (connects.length) next.connect = connects.length === 1 ? connects[0] : connects;
        if (creates.length) next.create = creates.length === 1 ? creates[0] : creates;
      }
    } else {
      const connects = rewritten
        .filter((r) => isPlainObject(r) && "connect" in r)
        .map((r) => (r as { connect: { id: string } }).connect);
      const creates = rewritten
        .filter((r) => isPlainObject(r) && "create" in r)
        .map((r) => (r as { create: Record<string, unknown> }).create);
      delete next.connectOrCreate;
      if (connects.length) next.connect = connects.length === 1 ? connects[0] : connects;
      if (creates.length) next.create = creates.length === 1 ? creates[0] : creates;
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
      await assertParentOwnership(client, rel.targetModel, injected, authority);
      const nested = (await validateNestedRelationWrites(
        client,
        rel.targetModel,
        injected,
        authority,
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
      await assertParentOwnership(client, rel.targetModel, injected, authority);
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
        client,
        rel.targetModel,
        scrubbed,
        authority,
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
    // Nested updateMany uses ScalarWhereInput — relation filters are illegal.
    const scope = nestedBulkScalarScopeWhere(rel.targetModel, authority);
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
      await validateNestedRelationWrites(
        client,
        rel.targetModel,
        scrubbed,
        authority,
      );
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
    });
    next.delete = Array.isArray(next.delete) ? resolved : resolved[0];
  }

  if ("deleteMany" in next) {
    // Nested deleteMany is ScalarWhereInput | ScalarWhereInput[] (no { where } wrapper).
    const items = normalizeToArray(next.deleteMany);
    const scope = nestedBulkScalarScopeWhere(rel.targetModel, authority);
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
      // Callers may pass either a bare ScalarWhereInput or `{ where: ... }`.
      const filter = isPlainObject(item.where) ? item.where : item;
      // If they passed `{ where }` exclusively, treat as where; if they passed
      // extra keys like `data`, reject.
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
  client: PrismaLike,
  model: string,
  data: Record<string, unknown>,
  authority: TenantAuthority,
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
      client,
      rel,
      value,
      authority,
      `${model}.${key}`,
    );
  }
  return next;
}

function proofFieldsFor(model: string): readonly string[] {
  if (DIRECT_MODEL_SET.has(model)) return PROOF_FIELDS_DIRECT;
  if (CHILD_MODEL_SET.has(model)) return PROOF_FIELDS_CHILD;
  return ["id"];
}

/**
 * Inject minimum ownership proof fields into select/include trees.
 * Tracks injected keys for later stripping (F-PR2C-05).
 */
function injectProofFields(
  sourceModel: string,
  value: unknown,
  mode: "include" | "select",
  plans: ProofPlan[],
  pathPrefix: string,
): unknown {
  if (value === true) {
    // Bare true — Prisma returns full row including proof fields; no injection.
    return true;
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "_count") {
      out._count = raw;
      continue;
    }

    const rel = relationMetaFor(sourceModel, key);
    if (!rel) {
      out[key] = raw;
      continue;
    }

    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (raw === true) {
      // Bare true is handled by scopeRelationObject; keep as-is here.
      out[key] = raw;
      continue;
    }

    if (!isPlainObject(raw)) {
      out[key] = raw;
      continue;
    }

    const nested = { ...raw };
    if (isPlainObject(nested.select)) {
      const needed = proofFieldsFor(rel.targetModel);
      const injected: string[] = [];
      const sel = { ...nested.select };
      for (const f of needed) {
        if (!(f in sel)) {
          sel[f] = true;
          injected.push(f);
        }
      }
      if (injected.length) {
        plans.push({ path: childPath, injected });
      }
      nested.select = injectProofFields(
        rel.targetModel,
        sel,
        "select",
        plans,
        childPath,
      );
    } else if (isPlainObject(nested.include)) {
      nested.include = injectProofFields(
        rel.targetModel,
        nested.include,
        "include",
        plans,
        childPath,
      );
    }

    out[key] = nested;
  }
  return out;
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

function scopeNestedWhereArgs(
  targetModel: MerchantOwnedModel,
  relArgs: Record<string, unknown>,
  authority: TenantAuthority,
  plans: ProofPlan[],
  pathPrefix: string,
): Record<string, unknown> {
  const next = { ...relArgs };
  next.where = mergeWhere(
    next.where,
    tenantScopeWhereSync(targetModel, authority),
  );
  if (next.include) {
    next.include = scopeRelationObject(
      targetModel,
      next.include,
      authority,
      "include",
      plans,
      pathPrefix,
    );
  }
  if (next.select) {
    // Inject proof fields into nested select.
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
      next.select = scopeRelationObject(
        targetModel,
        sel,
        authority,
        "select",
        plans,
        pathPrefix,
      );
    } else {
      next.select = scopeRelationObject(
        targetModel,
        next.select,
        authority,
        "select",
        plans,
        pathPrefix,
      );
    }
  }
  return next;
}

function scopeRelationObject(
  sourceModel: string,
  value: unknown,
  authority: TenantAuthority,
  mode: "include" | "select",
  plans: ProofPlan[] = [],
  pathPrefix = "",
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
        out[key] = {
          where: tenantScopeWhereSync(rel.targetModel, authority),
        };
      } else {
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
      out[key] = scopeNestedWhereArgs(
        rel.targetModel,
        raw,
        authority,
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
        nested.include = scopeRelationObject(
          rel.targetModel,
          nested.include,
          authority,
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
          nested.select = scopeRelationObject(
            rel.targetModel,
            sel,
            authority,
            "select",
            plans,
            childPath,
          );
        }
      } else if (mode === "select") {
        // Selecting a to-one relation as nested object without select/include
        // — ensure proof fields if it's a field map (shouldn't happen).
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
      select[key] = { where: tenantScopeWhereSync(rel.targetModel, authority) };
    } else if (isPlainObject(value)) {
      select[key] = {
        ...value,
        where: mergeWhere(
          value.where,
          tenantScopeWhereSync(rel.targetModel, authority),
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
  plans: ProofPlan[],
): Record<string, unknown> {
  const next = { ...args };
  if ("include" in next) {
    next.include = scopeRelationObject(
      model,
      next.include,
      authority,
      "include",
      plans,
    );
  }
  if ("select" in next) {
    next.select = scopeRelationObject(
      model,
      next.select,
      authority,
      "select",
      plans,
    );
  }
  return next;
}

async function validateLoadedRelations(
  client: PrismaLike,
  model: string,
  result: unknown,
  authority: TenantAuthority,
): Promise<void> {
  if (result == null) return;
  if (Array.isArray(result)) {
    for (const row of result) {
      await validateLoadedRelations(client, model, row, authority);
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
          await validateLoadedRelations(
            client,
            rel.targetModel,
            child,
            authority,
          );
        }
      }
      continue;
    }

    // To-one: prove ownership. Proof fields should already be injected.
    if (!isPlainObject(value)) {
      throw new TenantAccessError(
        "foreign_relation_row",
        `To-one relation ${model}.${key} has invalid shape`,
      );
    }

    if (typeof value.id === "string") {
      const scope = await tenantScopeWhere(client, rel.targetModel, authority);
      const owned = await getDelegate(client, rel.targetModel).findFirst({
        where: mergeWhere({ id: value.id }, scope),
        select: { id: true },
      });
      if (!owned) {
        throw new TenantAccessError(
          "foreign_relation_row",
          `To-one relation ${model}.${key} is not owned by the current tenant`,
        );
      }
    } else if (!rowOwnershipOk(rel.targetModel, value, authority)) {
      throw new TenantAccessError(
        "foreign_relation_row",
        `To-one relation ${model}.${key} failed ownership proof`,
      );
    }

    await validateLoadedRelations(client, rel.targetModel, value, authority);
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
 * Run ownership-dependent writes inside one DB transaction (F-PR2C-06/09).
 * Reuses the current transaction client when already nested; otherwise starts
 * an internal serializable transaction with bounded retry.
 */
async function withWriteTransaction<T>(
  state: ClientState,
  fn: (txState: ClientState) => Promise<T>,
): Promise<T> {
  if (state.inTransaction) {
    return fn(state);
  }

  const root = state.client as PrismaClient;
  if (typeof root.$transaction !== "function") {
    throw new TenantAccessError(
      "nested_transaction_unsupported",
      "Write transaction requires a root Prisma client",
    );
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await root.$transaction(
        async (tx) =>
          fn({
            client: tx,
            authority: state.authority,
            inTransaction: true,
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );
    } catch (err) {
      lastError = err;
      if (!isSerializationFailure(err)) throw err;
    }
  }
  throw lastError;
}

async function rewriteUniqueRead(
  state: ClientState,
  model: string,
  operation: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { client, authority } = state;
  const scope = await tenantScopeWhere(client, model, authority);
  const plans: ProofPlan[] = [];
  const scopedArgs = applyRelationScopes(model, args, authority, plans);
  const findFirst = getDelegate(client, model).findFirst;
  const row = await findFirst({
    ...scopedArgs,
    where: mergeWhere(
      coerceDirectShopInWhere(scopedArgs.where, authority),
      scope,
    ),
  });

  if (operation === "findUniqueOrThrow" && !row) {
    throw new TenantAccessError("not_found", `${model} not found for tenant`);
  }

  await validateLoadedRelations(client, model, row, authority);
  await assertLeadTimeSecondaryOwnership(client, model, row, authority);
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
    const { client, authority } = txState;
    const scope = await tenantScopeWhere(client, model, authority);
    const delegate = getDelegate(client, model);
    const scopedWhere = mergeWhere(
      coerceDirectShopInWhere(args.where, authority),
      scope,
    );

    if (operation === "update") {
      let data = scrubUpdateData(
        model,
        (args.data ?? {}) as Record<string, unknown>,
        authority,
      );
      data = await validateNestedRelationWrites(client, model, data, authority);
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

      // Re-check ownership inside the same transaction (fail closed if lost).
      const stillOwned = (await delegate.findFirst({
        where: mergeWhere({ id: existing.id }, scope),
        select: { id: true },
      })) as { id: string } | null;
      if (!stillOwned) {
        throw new TenantAccessError(
          "not_found",
          `${model} is no longer owned by the current tenant`,
        );
      }

      const plans: ProofPlan[] = [];
      const projection = applyRelationScopes(
        model,
        {
          ...(args.select ? { select: args.select } : {}),
          ...(args.include ? { include: args.include } : {}),
        },
        authority,
        plans,
      );

      // Real single-row update — preserves nested writes and projections.
      const updateArgs: Record<string, unknown> = {
        where: { id: existing.id },
        data,
        ...projection,
      };

      const updated = await delegate.update(updateArgs);
      await validateLoadedRelations(client, model, updated, authority);
      stripInjectedProofFields(updated, plans);
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
  });
}

async function rewriteUpsert(
  state: ClientState,
  model: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withWriteTransaction(state, async (txState) => {
    const { client, authority } = txState;
    const where = args.where;

    if (!hasTenantBearingUnique(model, where, authority)) {
      throw new TenantAccessError(
        "unsafe_upsert",
        `Upsert on ${model} requires a tenant-bearing unique selector`,
      );
    }

    const coercedWhere = coerceDirectShopInWhere(where, authority);

    let create = injectOwnership(
      model,
      (args.create ?? {}) as Record<string, unknown>,
      authority,
    );
    await assertParentOwnership(client, model, create, authority);
    create = await validateNestedRelationWrites(client, model, create, authority);

    let update = scrubUpdateData(
      model,
      (args.update ?? {}) as Record<string, unknown>,
      authority,
    );
    update = await validateNestedRelationWrites(client, model, update, authority);

    const plans: ProofPlan[] = [];
    const scopedArgs = applyRelationScopes(model, args, authority, plans);
    const row = await getDelegate(client, model).upsert({
      ...scopedArgs,
      where: coercedWhere,
      create,
      update,
    });
    await validateLoadedRelations(client, model, row, authority);
    stripInjectedProofFields(row, plans);
    return row;
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

  const { client, authority } = state;
  const scope = await tenantScopeWhere(client, model, authority);

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
      const plans: ProofPlan[] = [];
      const scopedArgs = applyRelationScopes(model, args, authority, plans);
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
        await validateLoadedRelations(client, model, result, authority);
        await assertLeadTimeSecondaryOwnership(
          client,
          model,
          result,
          authority,
        );
        stripInjectedProofFields(result, plans);
      }
      return result;
    }

    case "create":
      return withWriteTransaction(state, async (txState) => {
        let data = injectOwnership(
          model,
          (args.data ?? {}) as Record<string, unknown>,
          txState.authority,
        );
        await assertParentOwnership(
          txState.client,
          model,
          data,
          txState.authority,
        );
        data = await validateNestedRelationWrites(
          txState.client,
          model,
          data,
          txState.authority,
        );
        const plans: ProofPlan[] = [];
        const scopedArgs = applyRelationScopes(
          model,
          args,
          txState.authority,
          plans,
        );
        const created = await getDelegate(txState.client, model).create({
          ...scopedArgs,
          data,
        });
        await validateLoadedRelations(
          txState.client,
          model,
          created,
          txState.authority,
        );
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
            await assertParentOwnership(
              txState.client,
              model,
              injected,
              txState.authority,
            );
            injected = await validateNestedRelationWrites(
              txState.client,
              model,
              injected,
              txState.authority,
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
        await assertParentOwnership(
          txState.client,
          model,
          data,
          txState.authority,
        );
        data = await validateNestedRelationWrites(
          txState.client,
          model,
          data,
          txState.authority,
        );
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
        data = await validateNestedRelationWrites(
          txState.client,
          model,
          data,
          txState.authority,
        );
        const txScope = await tenantScopeWhere(
          txState.client,
          model,
          txState.authority,
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
          state,
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
  const state: ClientState = { client, authority, inTransaction };
  const delegates = buildTenantDelegates(state);

  const db: TenantDb = {
    authority,
    ...(delegates as Omit<TenantDb, "authority" | "$transaction">),
    $transaction: async <T>(fn: (tx: TenantDb) => Promise<T>): Promise<T> => {
      if (inTransaction) {
        throw new TenantAccessError(
          "nested_transaction_unsupported",
          "Nested tenant transactions are not supported",
        );
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
