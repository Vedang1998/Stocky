import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import {
  applyWithApplicationReceipt,
  verifyApplicationReceiptAfterRollback,
} from "../../../sync/application-receipt.server";
import {
  APPLICATION_ALREADY_APPLIED,
  APPLICATION_DIGEST_CONFLICT,
  APPLICATION_OUTCOME_UNCERTAIN,
} from "../../../sync/execution-strategy.server";
import { SyncControlPlaneError } from "../../../sync/errors";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";
import { digestCanonicalJson } from "../../../sync/digest.server";
import {
  acquireCanonicalIdentityAdvisoryLock,
  applyCanonicalFacts,
  deriveCanonicalLockKey,
  orderCanonicalLockKeysForAcquisition,
  type CanonicalApplyDb,
} from "../../../lib/catalog-facts";
import {
  readInventoryItem,
  readInventoryLevelByPair,
  readLocation,
  readProduct,
  readProductVariant,
  readShopCurrencyCode,
  type CatalogAdminReadClient,
  type InventoryItemRead,
  type InventoryLevelRead,
  type LocationRead,
  type ProductRead,
  type ProductVariantRead,
} from "../../../lib/catalog-facts/admin-read";
import type {
  CanonicalFactIdentity,
  DirectCanonicalObservation,
} from "../../../lib/catalog-facts/apply/types";
import {
  abandonDirectObservation,
  allocateDirectResponseGeneration,
  beginDirectObservation,
} from "../../../lib/catalog-facts/ingest/direct-observation";
import {
  canonicalIdentityKeyForReceipt,
  mapDirectInventoryItem,
  mapDirectInventoryLevel,
  mapDirectLocation,
  mapDirectProduct,
  mapDirectVariant,
} from "../../../lib/catalog-facts/ingest/direct-mappers";
import { featureFlags } from "../../../lib/feature-flags.server";
import { projectAppliedCanonicalFacts } from "./projection";
import { writeCanonicalFactMetadata } from "./fact-diagnostics";
import { reconcileCatalogDiagnostics } from "./diagnostic-reconciler";

export const CATALOG_FACT_ATOMIC_WEBHOOK_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "inventory_items/create",
  "inventory_items/update",
  "inventory_items/delete",
  "inventory_levels/connect",
  "inventory_levels/update",
  "inventory_levels/disconnect",
  "locations/create",
  "locations/update",
  "locations/delete",
  "locations/activate",
  "locations/deactivate",
] as const;

export type CatalogFactAtomicWebhookTopic =
  (typeof CATALOG_FACT_ATOMIC_WEBHOOK_TOPICS)[number];

export function isCatalogFactAtomicWebhookTopic(
  topic: string,
): topic is CatalogFactAtomicWebhookTopic {
  return (CATALOG_FACT_ATOMIC_WEBHOOK_TOPICS as readonly string[]).includes(
    topic,
  );
}

type RefetchDependencies = {
  readProduct: typeof readProduct;
  readVariant: typeof readProductVariant;
  readInventoryItem: typeof readInventoryItem;
  readInventoryLevel: typeof readInventoryLevelByPair;
  readLocation: typeof readLocation;
  readCurrency: typeof readShopCurrencyCode;
};

const DEFAULT_READS: RefetchDependencies = {
  readProduct,
  readVariant: readProductVariant,
  readInventoryItem,
  readInventoryLevel: readInventoryLevelByPair,
  readLocation,
  readCurrency: readShopCurrencyCode,
};

function gidFromPayload(
  payload: Record<string, unknown>,
  kind: "Product" | "ProductVariant" | "InventoryItem" | "Location",
): string {
  const supplied = payload.admin_graphql_api_id;
  if (
    typeof supplied === "string" &&
    supplied.startsWith(`gid://shopify/${kind}/`)
  ) {
    return supplied;
  }
  const id =
    kind === "InventoryItem"
      ? (payload.inventory_item_id ?? payload.id)
      : kind === "Location"
        ? (payload.location_id ?? payload.id)
        : payload.id;
  if (!(
    (typeof id === "string" && /^[0-9]+$/.test(id)) ||
    (typeof id === "number" && Number.isSafeInteger(id) && id >= 0)
  )) {
    throw new Error(`catalog_webhook_${kind}_identity_missing`);
  }
  return `gid://shopify/${kind}/${String(id)}`;
}

function inventoryLevelIdentity(
  shopId: string,
  payload: Record<string, unknown>,
): CanonicalFactIdentity {
  return {
    shopId,
    resourceKind: "InventoryLevel",
    inventoryItemGid: gidFromPayload(payload, "InventoryItem"),
    locationGid: gidFromPayload(payload, "Location"),
  };
}

export function resolveCatalogWebhookIdentity(
  shopId: string,
  topic: CatalogFactAtomicWebhookTopic,
  payload: Record<string, unknown>,
): CanonicalFactIdentity {
  if (topic.startsWith("products/")) {
    return {
      shopId,
      resourceKind: "Product",
      shopifyGid: gidFromPayload(payload, "Product"),
    };
  }
  if (topic.startsWith("inventory_items/")) {
    return {
      shopId,
      resourceKind: "InventoryItem",
      shopifyGid: gidFromPayload(payload, "InventoryItem"),
    };
  }
  if (topic.startsWith("inventory_levels/")) {
    return inventoryLevelIdentity(shopId, payload);
  }
  return {
    shopId,
    resourceKind: "Location",
    shopifyGid: gidFromPayload(payload, "Location"),
  };
}

async function readAndMap(
  admin: CatalogAdminReadClient,
  reads: RefetchDependencies,
  input: {
    authority: TenantAuthority;
    topic: CatalogFactAtomicWebhookTopic;
    payload: Record<string, unknown>;
    identity: CanonicalFactIdentity;
    durableJobId: string;
    attemptId: string;
    correlationId: string;
    signalReceivedAt: Date;
    signalDeliveryId: string;
    leaseDurationMs: number;
  },
): Promise<DirectCanonicalObservation | { tombstoneHeld: true }> {
  const handle = await beginDirectObservation(input.authority, {
    identity: input.identity,
    leaseDurationMs: input.leaseDurationMs,
    durableJobId: input.durableJobId,
    jobAttemptId: input.attemptId,
    correlationId: input.correlationId,
  });
  let value:
    | ProductRead
    | ProductVariantRead
    | InventoryItemRead
    | InventoryLevelRead
    | LocationRead
    | null;
  try {
    if (input.identity.resourceKind === "Product") {
      value = await reads.readProduct(admin, input.identity.shopifyGid);
    } else if (input.identity.resourceKind === "ProductVariant") {
      value = await reads.readVariant(admin, input.identity.shopifyGid);
    } else if (input.identity.resourceKind === "InventoryItem") {
      value = await reads.readInventoryItem(admin, input.identity.shopifyGid, {
        includeUnitCost: true,
      });
    } else if (input.identity.resourceKind === "Location") {
      value = await reads.readLocation(admin, input.identity.shopifyGid);
    } else {
      value = await reads.readInventoryLevel(admin, {
        inventoryItemGid: input.identity.inventoryItemGid,
        locationGid: input.identity.locationGid,
      });
    }
  } catch (error) {
    await abandonDirectObservation(input.authority, handle);
    throw error;
  }

  const isAbsence = value == null;
  if (isAbsence && !featureFlags.pr5AbsenceTombstone()) {
    // Server-side destructive gate immediately before an ABSENT observation
    // could reach the canonical applicator.
    await abandonDirectObservation(input.authority, handle);
    return { tombstoneHeld: true };
  }

  const responseGeneration = await allocateDirectResponseGeneration(
    input.authority,
  );
  const mapperBase = {
    handle,
    responseGeneration,
    observedAt: new Date(),
    sourceKind:
      input.topic === "inventory_levels/disconnect"
        ? ("DISCONNECT_WEBHOOK" as const)
        : input.topic.endsWith("/delete")
          ? ("DELETE_WEBHOOK" as const)
          : ("INCREMENTAL_REFETCH" as const),
    durableJobId: input.durableJobId,
    signalReceivedAt: input.signalReceivedAt,
    signalTopic: input.topic,
    signalDeliveryId: input.signalDeliveryId,
  };

  if (input.identity.resourceKind === "Product") {
    return mapDirectProduct({
      ...mapperBase,
      value: value as ProductRead | null,
    });
  }
  if (input.identity.resourceKind === "ProductVariant") {
    const currencyCode = await reads.readCurrency(admin);
    if (!currencyCode) {
      await abandonDirectObservation(input.authority, handle);
      throw new Error("shop_currency_missing");
    }
    return mapDirectVariant({
      ...mapperBase,
      value: value as ProductVariantRead | null,
      currencyCode,
    });
  }
  if (input.identity.resourceKind === "InventoryItem") {
    return mapDirectInventoryItem({
      ...mapperBase,
      value: value as InventoryItemRead | null,
      unitCostAccess: "QUERY_ERROR_ISOLATED",
    });
  }
  if (input.identity.resourceKind === "Location") {
    return mapDirectLocation({
      ...mapperBase,
      value: value as LocationRead | null,
    });
  }
  return mapDirectInventoryLevel({
    ...mapperBase,
    value: value as InventoryLevelRead | null,
  });
}

export function catalogRefetchApplicationDigest(input: {
  applyingDurableJobId: string;
  topic: string;
  shopId: string;
  resolvedIdentities: readonly CanonicalFactIdentity[];
}): string {
  return digestCanonicalJson({
    schema: "catalog-facts-refetch-application-v1",
    applyingDurableJobId: input.applyingDurableJobId,
    topic: input.topic,
    shopId: input.shopId,
    resolvedIdentities: [
      ...new Set(input.resolvedIdentities.map(canonicalIdentityKeyForReceipt)),
    ].sort(),
  });
}

function healthDomainForIdentity(
  identity: CanonicalFactIdentity,
): "catalog" | "locations" | "inventory_levels" {
  return identity.resourceKind === "Location"
    ? "locations"
    : identity.resourceKind === "InventoryLevel"
      ? "inventory_levels"
      : "catalog";
}

export async function applyCatalogFactWebhookRefetch(input: {
  authority: TenantAuthority;
  admin: CatalogAdminReadClient;
  topic: CatalogFactAtomicWebhookTopic;
  payload: Record<string, unknown>;
  durableJobId: string;
  rootDurableJobId: string;
  attemptId: string;
  correlationId: string;
  signalDeliveryId: string;
  signalReceivedAt: Date;
  applicationKey: string;
  applicationPayloadDigest?: string;
  leaseDurationMs: number;
  canonicalBatchSize: number;
  configuredWorstCaseConcurrentCanonicalTransactions: number;
  reads?: Partial<RefetchDependencies>;
}): Promise<{
  applicationStatus: "applied" | "already_applied" | "tombstone_held";
  canonicalOutcome?: string;
}> {
  const identity = resolveCatalogWebhookIdentity(
    input.authority.shopId,
    input.topic,
    input.payload,
  );
  const observation = await readAndMap(
    input.admin,
    { ...DEFAULT_READS, ...input.reads },
    { ...input, identity },
  );
  const reads = { ...DEFAULT_READS, ...input.reads };
  const observations: DirectCanonicalObservation[] =
    "tombstoneHeld" in observation ? [] : [observation];

  if (
    identity.resourceKind === "Product" &&
    observations[0]?.existenceKind === "LIVE_REFETCH"
  ) {
    const variantGids = Array.isArray(input.payload.variant_gids)
      ? input.payload.variant_gids.flatMap((entry) => {
          const raw =
            typeof entry === "object" && entry !== null
              ? (entry as Record<string, unknown>).admin_graphql_api_id
              : entry;
          return typeof raw === "string" &&
            raw.startsWith("gid://shopify/ProductVariant/")
            ? [raw]
            : [];
        })
      : [];
    for (const variantGid of [...new Set(variantGids)].sort()) {
      const variantIdentity: CanonicalFactIdentity = {
        shopId: input.authority.shopId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
      };
      const mappedVariant = await readAndMap(input.admin, reads, {
        ...input,
        identity: variantIdentity,
      });
      if ("tombstoneHeld" in mappedVariant) continue;
      observations.push(mappedVariant);
    }
  }

  const payloadDigest =
    input.applicationPayloadDigest ??
    catalogRefetchApplicationDigest({
      applyingDurableJobId: input.durableJobId,
      topic: input.topic,
      shopId: input.authority.shopId,
      resolvedIdentities:
        observations.length > 0
          ? observations.map((item) => item.identity)
          : [identity],
    });
  if ("tombstoneHeld" in observation) {
    const marked = await writeCanonicalFactMetadata(input.authority, {
      identity,
      diagnostic: "ABSENCE_TOMBSTONE_FLAG_HELD",
    });
    if (!marked) {
      const domain = healthDomainForIdentity(identity);
      const existing = await getControlPlanePrisma().dataIssue.findFirst({
        where: {
          shopId: input.authority.shopId,
          reasonCode: "CATALOG_ABSENCE_RECONCILIATION_UNCERTAIN",
          externalResourceType: domain,
          status: "OPEN",
        },
      });
      if (!existing) {
        await getControlPlanePrisma().dataIssue.create({
          data: {
            shopId: input.authority.shopId,
            reasonCode: "CATALOG_ABSENCE_RECONCILIATION_UNCERTAIN",
            severity: "ERROR",
            status: "OPEN",
            externalResourceType: domain,
            redactedEvidence: { reason: "absence_tombstone_flag_off" },
          },
        });
      }
    }
    const db = createTenantDb(input.authority);
    await db.$transaction((tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey: input.applicationKey,
          sourceJobType: `webhook:${input.topic}`,
          rootDurableJobId: input.rootDurableJobId,
          applyingDurableJobId: input.durableJobId,
          payloadDigest,
        },
        async () => ({ tombstoneHeld: true as const }),
      ),
    );
    await reconcileCatalogDiagnostics(
      input.authority,
      healthDomainForIdentity(identity),
    );
    return { applicationStatus: "tombstone_held" };
  }

  if (
    !Number.isSafeInteger(input.canonicalBatchSize) ||
    input.canonicalBatchSize < 1
  ) {
    throw new Error("catalog_refetch_batch_size_invalid");
  }
  const orderedObservations = [
    "Product",
    "ProductVariant",
    "InventoryItem",
    "Location",
    "InventoryLevel",
  ].flatMap((kind) =>
    observations.filter(
      (candidate) => candidate.identity.resourceKind === kind,
    ),
  );
  const db = createTenantDb(input.authority);
  let applicationStatus: "applied" | "already_applied" = "already_applied";
  let canonicalOutcome: string | undefined;
  for (
    let start = 0;
    start < orderedObservations.length;
    start += input.canonicalBatchSize
  ) {
    const chunk = orderedObservations.slice(
      start,
      start + input.canonicalBatchSize,
    );
    const chunkDigest = catalogRefetchApplicationDigest({
      applyingDurableJobId: input.durableJobId,
      topic: input.topic,
      shopId: input.authority.shopId,
      resolvedIdentities: chunk.map((item) => item.identity),
    });
    const chunkApplicationKey = `${input.applicationKey}:catalog-facts:${start}`;
    let applied: {
      status: "applied" | "already_applied";
      result: unknown;
    };
    try {
      applied = await db.$transaction((tx) =>
        applyWithApplicationReceipt(
          tx,
          {
            applicationKey: chunkApplicationKey,
            sourceJobType: `webhook:${input.topic}`,
            rootDurableJobId: input.rootDurableJobId,
            applyingDurableJobId: input.durableJobId,
            payloadDigest: chunkDigest,
          },
          async (tenantTx) => {
            const canonicalDb = tenantTx as unknown as CanonicalApplyDb;
            const lockIdentities = chunk.map((item) =>
              item.identity.resourceKind === "InventoryLevel"
                ? {
                    shopId: item.identity.shopId,
                    resourceKind: "InventoryLevel" as const,
                    inventoryItemGid: item.identity.inventoryItemGid,
                    locationGid: item.identity.locationGid,
                  }
                : {
                    shopId: item.identity.shopId,
                    resourceKind: item.identity.resourceKind,
                    shopifyGid: item.identity.shopifyGid,
                  },
            );
            const ordered = orderCanonicalLockKeysForAcquisition(
              lockIdentities.map(deriveCanonicalLockKey),
            );
            const acquired = new Set<string>();
            for (const key of ordered) {
              const lockKey = `${key.key1}:${key.key2}`;
              if (acquired.has(lockKey)) continue;
              const match = lockIdentities.find((candidate) => {
                const derived = deriveCanonicalLockKey(candidate);
                return derived.key1 === key.key1 && derived.key2 === key.key2;
              });
              if (!match)
                throw new Error("catalog_refetch_lock_identity_missing");
              await acquireCanonicalIdentityAdvisoryLock(canonicalDb, match);
              acquired.add(lockKey);
            }

            const results = [];
            for (const kind of [
              "Product",
              "ProductVariant",
              "InventoryItem",
              "Location",
              "InventoryLevel",
            ] as const) {
              for (const item of chunk.filter(
                (candidate) => candidate.identity.resourceKind === kind,
              )) {
                const result = await applyCanonicalFacts(canonicalDb, {
                  shopId: input.authority.shopId,
                  observations: [item],
                  requestedCanonicalIdentitiesPerTransaction: 1,
                  configuredWorstCaseConcurrentCanonicalTransactions:
                    input.configuredWorstCaseConcurrentCanonicalTransactions,
                });
                results.push(...result.results);
              }
            }
            return results;
          },
        ),
      );
    } catch (error) {
      if (!(
        error instanceof SyncControlPlaneError &&
        (error.code === APPLICATION_ALREADY_APPLIED ||
          error.code === APPLICATION_DIGEST_CONFLICT ||
          error.code === APPLICATION_OUTCOME_UNCERTAIN)
      )) {
        throw error;
      }
      const verified = await verifyApplicationReceiptAfterRollback(db, {
        applicationKey: chunkApplicationKey,
        expectedPayloadDigest: chunkDigest,
      });
      if (verified.status !== "verified") throw error;
      applied = { status: "already_applied", result: null };
    }
    if (applied.status === "applied") applicationStatus = "applied";
    const appliedRows = Array.isArray(applied.result)
      ? (applied.result as Array<{ outcome?: string }>)
      : [];
    canonicalOutcome ??= appliedRows[0]?.outcome;
  }

  if (
    observations[0]?.existenceKind === "LIVE_REFETCH" &&
    (input.topic.endsWith("/delete") ||
      input.topic === "inventory_levels/disconnect")
  ) {
    await writeCanonicalFactMetadata(input.authority, {
      identity,
      diagnostic:
        input.topic === "inventory_levels/disconnect"
          ? "STALE_DISCONNECT_SIGNAL"
          : "STALE_DELETE_SIGNAL",
    });
  }

  await projectAppliedCanonicalFacts({
    authority: input.authority,
    canonicalIdentities: observations.map((item) => item.identity),
  });
  await reconcileCatalogDiagnostics(
    input.authority,
    healthDomainForIdentity(identity),
  );
  return {
    applicationStatus,
    canonicalOutcome,
  };
}
