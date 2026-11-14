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
  CanonicalApplyObservationResult,
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
import { listProductVariantGids } from "../../../lib/catalog-facts/ingest/product-variant-ids";
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
      const levelIdentity = input.identity as Extract<
        CanonicalFactIdentity,
        { resourceKind: "InventoryLevel" }
      >;
      value = await reads.readInventoryLevel(admin, {
        inventoryItemGid: levelIdentity.inventoryItemGid,
        locationGid: levelIdentity.locationGid,
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

  try {
    if (input.identity.resourceKind === "Product") {
      return mapDirectProduct({
        ...mapperBase,
        value: value as ProductRead | null,
      });
    }
    if (input.identity.resourceKind === "ProductVariant") {
      const currencyCode = await reads.readCurrency(admin);
      if (!currencyCode) {
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
  } catch (error) {
    await abandonDirectObservation(input.authority, handle);
    throw error;
  }
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

const RESOURCE_KIND_APPLY_ORDER = [
  "Product",
  "ProductVariant",
  "InventoryItem",
  "Location",
  "InventoryLevel",
] as const;

/** How long a begun read keeps later reads of the same resource from applying. */
export const CATALOG_REFETCH_LEASE_MS = 60_000;

/**
 * Delay before a failed catalog webhook job runs again. The first retry is
 * quick because the usual cause is another job for the same new product still
 * running. Later retries wait out the lease of a read that a crashed job left
 * behind.
 */
export function catalogRefetchRetryDelayMs(attemptNumber: number): number {
  return attemptNumber <= 1 ? 5_000 : CATALOG_REFETCH_LEASE_MS + 15_000;
}

/**
 * Shopify returned a live resource but the applicator stored no fact for it:
 * another read of the same resource is still in flight or finished while this
 * one was running, or the response was incomplete. Nothing is recorded as
 * applied, so the job runs again with a fresh read.
 */
export class CatalogFactNotStoredError extends Error {
  readonly code = "catalog_fact_not_stored";

  constructor(
    identity: CanonicalFactIdentity,
    readonly outcome: CanonicalApplyObservationResult["outcome"],
    readonly diagnostic: string | null,
  ) {
    super(
      `No canonical fact stored for ${canonicalIdentityKeyForReceipt(identity)}: ${outcome}${diagnostic ? ` (${diagnostic})` : ""}`,
    );
    this.name = "CatalogFactNotStoredError";
  }
}

type TenantDb = ReturnType<typeof createTenantDb>;

function parentIdentities(
  observation: DirectCanonicalObservation,
): CanonicalFactIdentity[] {
  const { identity } = observation;
  if (identity.resourceKind === "InventoryLevel") {
    return [
      {
        shopId: identity.shopId,
        resourceKind: "InventoryItem",
        shopifyGid: identity.inventoryItemGid,
      },
      {
        shopId: identity.shopId,
        resourceKind: "Location",
        shopifyGid: identity.locationGid,
      },
    ];
  }
  const attributes = (observation.attributes ?? {}) as Record<string, unknown>;
  const parentGid =
    identity.resourceKind === "InventoryItem"
      ? attributes.shopifyVariantGid
      : identity.resourceKind === "ProductVariant"
        ? attributes.shopifyProductGid
        : null;
  if (typeof parentGid !== "string" || parentGid.length === 0) return [];
  return [
    {
      shopId: identity.shopId,
      resourceKind:
        identity.resourceKind === "InventoryItem"
          ? "ProductVariant"
          : "Product",
      shopifyGid: parentGid,
    },
  ];
}

async function hasCanonicalFact(
  db: TenantDb,
  identity: CanonicalFactIdentity,
): Promise<boolean> {
  if (identity.resourceKind === "InventoryLevel") {
    throw new Error("catalog_refetch_parent_kind_invalid");
  }
  const where = { shopifyGid: identity.shopifyGid };
  const select = { id: true } as const;
  const row =
    identity.resourceKind === "Product"
      ? await db.shopifyProductFact.findFirst({ where, select })
      : identity.resourceKind === "ProductVariant"
        ? await db.shopifyVariantFact.findFirst({ where, select })
        : identity.resourceKind === "InventoryItem"
          ? await db.shopifyInventoryItemFact.findFirst({ where, select })
          : await db.shopifyLocationFact.findFirst({ where, select });
  return row != null;
}

/**
 * Shopify does not order the webhooks of a new product. inventory_items/create
 * and inventory_levels/connect regularly arrive before products/create has
 * been applied, and any of them can be lost. A level cannot be stored without
 * its item and location, an item without its variant, or a variant without its
 * product, so the facts that are missing are read here and applied by the same
 * job.
 */
async function readMissingParents(
  db: TenantDb,
  observations: readonly DirectCanonicalObservation[],
  read: (
    identity: CanonicalFactIdentity,
  ) => Promise<DirectCanonicalObservation | { tombstoneHeld: true }>,
): Promise<DirectCanonicalObservation[]> {
  const queued = new Set(
    observations.map((item) => canonicalIdentityKeyForReceipt(item.identity)),
  );
  const parents: DirectCanonicalObservation[] = [];
  const pending = [...observations];
  for (let child = pending.shift(); child; child = pending.shift()) {
    if (child.existenceKind !== "LIVE_REFETCH") continue;
    for (const parent of parentIdentities(child)) {
      const key = canonicalIdentityKeyForReceipt(parent);
      if (queued.has(key)) continue;
      queued.add(key);
      if (await hasCanonicalFact(db, parent)) continue;
      const mapped = await read(parent);
      if ("tombstoneHeld" in mapped) continue;
      parents.push(mapped);
      pending.push(mapped);
    }
  }
  return RESOURCE_KIND_APPLY_ORDER.flatMap((kind) =>
    parents.filter((item) => item.identity.resourceKind === kind),
  );
}

/**
 * A read that was begun and never applied blocks later reads of the same
 * resource until its lease expires, so a failed attempt gives its reads back.
 * Reads that were applied are already closed and are skipped.
 */
async function abandonUnfinishedObservations(
  authority: TenantAuthority,
  begun: readonly DirectCanonicalObservation[],
): Promise<void> {
  for (const item of begun) {
    await abandonDirectObservation(authority, {
      token: item.observationToken,
      requestGeneration: item.observationRequestGen,
      identity: item.identity,
      leaseExpiresAt: new Date(0),
    }).catch(() => undefined);
  }
}

type AppliedChunk =
  | { status: "applied"; results: CanonicalApplyObservationResult[] }
  | { status: "already_applied"; results: [] };

async function applyChunkWithReceipt(
  input: CatalogFactWebhookRefetchInput,
  db: TenantDb,
  chunk: readonly DirectCanonicalObservation[],
  applicationKey: string,
): Promise<AppliedChunk> {
  const payloadDigest = catalogRefetchApplicationDigest({
    applyingDurableJobId: input.durableJobId,
    topic: input.topic,
    shopId: input.authority.shopId,
    resolvedIdentities: chunk.map((item) => item.identity),
  });
  let applied: AppliedChunk;
  try {
    const outcome = await db.$transaction((tx) =>
      applyWithApplicationReceipt(
        tx,
        {
          applicationKey,
          sourceJobType: `webhook:${input.topic}`,
          rootDurableJobId: input.rootDurableJobId,
          applyingDurableJobId: input.durableJobId,
          payloadDigest,
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

          const results: CanonicalApplyObservationResult[] = [];
          for (const kind of RESOURCE_KIND_APPLY_ORDER) {
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
              for (const row of result.results) {
                // Throwing rolls the receipt back with the rest, so the retry
                // is a real second attempt and not an "already applied" no-op.
                if (
                  item.existenceKind === "LIVE_REFETCH" &&
                  row.factId == null
                ) {
                  throw new CatalogFactNotStoredError(
                    item.identity,
                    row.outcome,
                    row.diagnosticState,
                  );
                }
              }
              results.push(...result.results);
            }
          }
          return results;
        },
      ),
    );
    applied =
      outcome.status === "applied"
        ? { status: "applied", results: outcome.result }
        : { status: "already_applied", results: [] };
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
      applicationKey,
      expectedPayloadDigest: payloadDigest,
    });
    if (verified.status !== "verified") throw error;
    applied = { status: "already_applied", results: [] };
  }
  if (applied.status === "already_applied") {
    for (const item of chunk) {
      await abandonDirectObservation(input.authority, {
        token: item.observationToken,
        requestGeneration: item.observationRequestGen,
        identity: item.identity,
        leaseExpiresAt: new Date(0),
      });
    }
  }
  return applied;
}

export type CatalogFactWebhookRefetchInput = {
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
};

export type CatalogFactWebhookRefetchResult = {
  applicationStatus: "applied" | "already_applied" | "tombstone_held";
  canonicalOutcome?: string;
};

export async function applyCatalogFactWebhookRefetch(
  input: CatalogFactWebhookRefetchInput,
): Promise<CatalogFactWebhookRefetchResult> {
  const begun: DirectCanonicalObservation[] = [];
  try {
    return await refetchAndApply(input, begun);
  } catch (error) {
    await abandonUnfinishedObservations(input.authority, begun);
    throw error;
  }
}

async function refetchAndApply(
  input: CatalogFactWebhookRefetchInput,
  begun: DirectCanonicalObservation[],
): Promise<CatalogFactWebhookRefetchResult> {
  const shop = await getControlPlanePrisma().shop.findUnique({
    where: { id: input.authority.shopId },
    select: { myshopifyDomain: true, processingEnabled: true },
  });
  if (
    !shop?.processingEnabled ||
    shop.myshopifyDomain !== input.authority.myshopifyDomain
  ) {
    throw new Error("shop_processing_disabled");
  }

  const identity = resolveCatalogWebhookIdentity(
    input.authority.shopId,
    input.topic,
    input.payload,
  );
  const reads = { ...DEFAULT_READS, ...input.reads };
  const read = async (target: CanonicalFactIdentity) => {
    const mapped = await readAndMap(input.admin, reads, {
      ...input,
      identity: target,
    });
    if (!("tombstoneHeld" in mapped)) begun.push(mapped);
    return mapped;
  };
  const observation = await read(identity);
  const observations: DirectCanonicalObservation[] =
    "tombstoneHeld" in observation ? [] : [observation];

  if (
    identity.resourceKind === "Product" &&
    observations[0]?.existenceKind === "LIVE_REFETCH"
  ) {
    // Webhook bodies include at most 100 variant GIDs and are never the
    // complete identity set. Paginate authoritative variant IDs, then refetch.
    const variantGids = await listProductVariantGids(
      input.admin,
      identity.shopifyGid,
    );
    for (const variantGid of variantGids) {
      const mappedVariant = await read({
        shopId: input.authority.shopId,
        resourceKind: "ProductVariant",
        shopifyGid: variantGid,
      });
      if ("tombstoneHeld" in mappedVariant) continue;
      observations.push(mappedVariant);
    }
  }

  const db = createTenantDb(input.authority);
  const parents = await readMissingParents(db, observations, read);

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
  const stored: CanonicalFactIdentity[] = [];
  const keepStored = (
    chunk: readonly DirectCanonicalObservation[],
    applied: AppliedChunk,
  ) => {
    if (applied.status === "already_applied") {
      stored.push(...chunk.map((item) => item.identity));
      return;
    }
    for (const row of applied.results) {
      if (row.factId != null) stored.push(row.identity);
    }
  };

  // Each parent has its own receipt, keyed by what it is rather than by its
  // position, because a retry may find some of them already in place.
  for (const parent of parents) {
    keepStored(
      [parent],
      await applyChunkWithReceipt(
        input,
        db,
        [parent],
        `${input.applicationKey}:catalog-facts:parent:${canonicalIdentityKeyForReceipt(parent.identity)}`,
      ),
    );
  }

  const orderedObservations = RESOURCE_KIND_APPLY_ORDER.flatMap((kind) =>
    observations.filter(
      (candidate) => candidate.identity.resourceKind === kind,
    ),
  );
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
    const applied = await applyChunkWithReceipt(
      input,
      db,
      chunk,
      `${input.applicationKey}:catalog-facts:${start}`,
    );
    if (applied.status === "applied") applicationStatus = "applied";
    keepStored(chunk, applied);
    canonicalOutcome ??= applied.results[0]?.outcome;
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
    canonicalIdentities: stored,
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
