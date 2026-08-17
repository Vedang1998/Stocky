/**
 * Explicit merchant-owned relation metadata for PR 2 recursive scoping.
 * Unknown merchant relation shapes fail closed in TenantDb.
 */

import type { MerchantOwnedModel } from "./models";
import { PARENT_OWNERSHIP_RULES } from "./models";

export type RelationCardinality = "one" | "many";

export type MerchantRelationMeta = {
  name: string;
  sourceModel: MerchantOwnedModel;
  targetModel: MerchantOwnedModel;
  cardinality: RelationCardinality;
  /** Parent FK on the child side when this relation is child→parent. */
  ownershipLineage:
    | { kind: "parent_fk"; foreignKey: string }
    | { kind: "child_collection"; childForeignKey: string }
    | { kind: "cross_domain_parent"; foreignKey: string };
  /** Prisma permits nested `where` on to-many includes/selects/_count. */
  nestedWherePermitted: boolean;
  allowedNestedOperations: ReadonlyArray<
    | "create"
    | "createMany"
    | "connect"
    | "connectOrCreate"
    | "set"
    | "disconnect"
    | "update"
    | "updateMany"
    | "delete"
    | "deleteMany"
    | "upsert"
  >;
};

function fkToRelationName(foreignKey: string): string {
  if (foreignKey.endsWith("Id")) {
    const base = foreignKey.slice(0, -2);
    return base.charAt(0).toLowerCase() + base.slice(1);
  }
  return foreignKey;
}

const RELATIONS: MerchantRelationMeta[] = [
  {
    name: "skuMappings",
    sourceModel: "Supplier",
    targetModel: "SupplierSkuMapping",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "supplierId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "volumeTiers",
    sourceModel: "Supplier",
    targetModel: "VolumePriceTier",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "supplierId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "leadTimeSnapshots",
    sourceModel: "Supplier",
    targetModel: "LeadTimeSnapshot",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "supplierId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "purchaseOrders",
    sourceModel: "Supplier",
    targetModel: "PurchaseOrder",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "supplierId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "lineItems",
    sourceModel: "PurchaseOrder",
    targetModel: "POLineItem",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "purchaseOrderId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "supplier",
    sourceModel: "PurchaseOrder",
    targetModel: "Supplier",
    cardinality: "one",
    ownershipLineage: {
      kind: "cross_domain_parent",
      foreignKey: "supplierId",
    },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "lineItems",
    sourceModel: "TransferOrder",
    targetModel: "TransferLineItem",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "transferOrderId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "lineItems",
    sourceModel: "Stocktake",
    targetModel: "StocktakeLineItem",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "stocktakeId",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "supplier",
    sourceModel: "SupplierSkuMapping",
    targetModel: "Supplier",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "supplierId" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "supplier",
    sourceModel: "VolumePriceTier",
    targetModel: "Supplier",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "supplierId" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "supplier",
    sourceModel: "LeadTimeSnapshot",
    targetModel: "Supplier",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "supplierId" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "purchaseOrder",
    sourceModel: "POLineItem",
    targetModel: "PurchaseOrder",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "purchaseOrderId" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "transferOrder",
    sourceModel: "TransferLineItem",
    targetModel: "TransferOrder",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "transferOrderId" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "stocktake",
    sourceModel: "StocktakeLineItem",
    targetModel: "Stocktake",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "stocktakeId" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "product",
    sourceModel: "ShopifyVariantFact",
    targetModel: "ShopifyProductFact",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "shopifyProductGid" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "variants",
    sourceModel: "ShopifyProductFact",
    targetModel: "ShopifyVariantFact",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "shopifyProductGid",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "product",
    sourceModel: "ShopifyProductCollectionMembership",
    targetModel: "ShopifyProductFact",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "shopifyProductGid" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "collectionMemberships",
    sourceModel: "ShopifyProductFact",
    targetModel: "ShopifyProductCollectionMembership",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "shopifyProductGid",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "variant",
    sourceModel: "ShopifyInventoryItemFact",
    targetModel: "ShopifyVariantFact",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "shopifyVariantGid" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "inventoryItems",
    sourceModel: "ShopifyVariantFact",
    targetModel: "ShopifyInventoryItemFact",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "shopifyVariantGid",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "inventoryItem",
    sourceModel: "ShopifyInventoryLevelFact",
    targetModel: "ShopifyInventoryItemFact",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "inventoryItemGid" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "location",
    sourceModel: "ShopifyInventoryLevelFact",
    targetModel: "ShopifyLocationFact",
    cardinality: "one",
    ownershipLineage: { kind: "parent_fk", foreignKey: "locationGid" },
    nestedWherePermitted: false,
    allowedNestedOperations: ["connect", "connectOrCreate", "disconnect"],
  },
  {
    name: "inventoryLevels",
    sourceModel: "ShopifyInventoryItemFact",
    targetModel: "ShopifyInventoryLevelFact",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "inventoryItemGid",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
  {
    name: "inventoryLevels",
    sourceModel: "ShopifyLocationFact",
    targetModel: "ShopifyInventoryLevelFact",
    cardinality: "many",
    ownershipLineage: {
      kind: "child_collection",
      childForeignKey: "locationGid",
    },
    nestedWherePermitted: true,
    allowedNestedOperations: [
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
    ],
  },
];

const BY_SOURCE = new Map<string, Map<string, MerchantRelationMeta>>();
for (const rel of RELATIONS) {
  let inner = BY_SOURCE.get(rel.sourceModel);
  if (!inner) {
    inner = new Map();
    BY_SOURCE.set(rel.sourceModel, inner);
  }
  inner.set(rel.name, rel);
}

/** Route/service relation shapes that must remain covered by tests. */
export const ROUTE_RELATION_SHAPES = [
  "Supplier.skuMappings",
  "Supplier.volumeTiers",
  "Supplier.leadTimeSnapshots",
  "Supplier.purchaseOrders",
  "Supplier._count.skuMappings",
  "Supplier._count.purchaseOrders",
  "PurchaseOrder.supplier",
  "PurchaseOrder.lineItems",
  "TransferOrder.lineItems",
  "Stocktake.lineItems",
  "POLineItem.purchaseOrder",
] as const;

export function relationMetaFor(
  sourceModel: string,
  relationName: string,
): MerchantRelationMeta | null {
  return BY_SOURCE.get(sourceModel)?.get(relationName) ?? null;
}

export function relationsForModel(
  sourceModel: string,
): MerchantRelationMeta[] {
  return [...(BY_SOURCE.get(sourceModel)?.values() ?? [])];
}

export function parentRelationFieldName(childModel: string): string | null {
  const rule = PARENT_OWNERSHIP_RULES[childModel];
  if (!rule) return null;
  return fkToRelationName(rule.foreignKey);
}

export { fkToRelationName };
