import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import {
  acquireCanonicalIdentityAdvisoryLock,
  type CanonicalApplyDb,
} from "../../../lib/catalog-facts";
import type { CanonicalFactIdentity } from "../../../lib/catalog-facts/apply/types";

function lockIdentity(identity: CanonicalFactIdentity) {
  return identity.resourceKind === "InventoryLevel"
    ? {
        shopId: identity.shopId,
        resourceKind: "InventoryLevel" as const,
        inventoryItemGid: identity.inventoryItemGid,
        locationGid: identity.locationGid,
      }
    : {
        shopId: identity.shopId,
        resourceKind: identity.resourceKind,
        shopifyGid: identity.shopifyGid,
      };
}

async function updateFactMetadata(
  db: CanonicalApplyDb,
  input: {
    identity: CanonicalFactIdentity;
    absenceState?: "NONE" | "CANDIDATE" | "CIRCUIT_BREAKER_HELD";
    epochId?: string | null;
    candidateGeneration?: bigint | null;
    diagnostic?: string | null;
    requireFenceEligibility?: boolean;
  },
): Promise<number> {
  const { identity } = input;
  const state = input.absenceState;
  const generation = input.candidateGeneration ?? null;
  const requireFence = input.requireFenceEligibility === true;
  if (identity.resourceKind === "Product") {
    const rows = await db.$queryRaw`
      UPDATE "ShopifyProductFact"
      SET "absenceNominationState" = COALESCE(
            ${state}::"CatalogAbsenceNominationState",
            "absenceNominationState"
          ),
          "absenceCandidateEpochId" = CASE WHEN ${state}::text IS NULL
            THEN "absenceCandidateEpochId" ELSE ${input.epochId ?? null} END,
          "absenceCandidateGeneration" = CASE WHEN ${state}::text IS NULL
            THEN "absenceCandidateGeneration" ELSE ${generation}::bigint END,
          "existenceDiagnosticState" = COALESCE(
            ${input.diagnostic ?? null},
            "existenceDiagnosticState"
          ),
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${identity.shopId}
        AND "shopifyGid" = ${identity.shopifyGid}
        AND (
          NOT ${requireFence}
          OR (
            "existenceState" = 'LIVE'
            AND (
              "existenceRequestGen" IS NULL
              OR "existenceRequestGen" <= ${generation}::bigint
            )
          )
        )
      RETURNING id
    `;
    return (rows as unknown[]).length;
  }
  if (identity.resourceKind === "ProductVariant") {
    const rows = await db.$queryRaw`
      UPDATE "ShopifyVariantFact"
      SET "absenceNominationState" = COALESCE(${state}::"CatalogAbsenceNominationState", "absenceNominationState"),
          "absenceCandidateEpochId" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateEpochId" ELSE ${input.epochId ?? null} END,
          "absenceCandidateGeneration" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateGeneration" ELSE ${generation}::bigint END,
          "existenceDiagnosticState" = COALESCE(${input.diagnostic ?? null}, "existenceDiagnosticState"),
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${identity.shopId}
        AND "shopifyGid" = ${identity.shopifyGid}
        AND (NOT ${requireFence} OR ("existenceState" = 'LIVE' AND ("existenceRequestGen" IS NULL OR "existenceRequestGen" <= ${generation}::bigint)))
      RETURNING id
    `;
    return (rows as unknown[]).length;
  }
  if (identity.resourceKind === "InventoryItem") {
    const rows = await db.$queryRaw`
      UPDATE "ShopifyInventoryItemFact"
      SET "absenceNominationState" = COALESCE(${state}::"CatalogAbsenceNominationState", "absenceNominationState"),
          "absenceCandidateEpochId" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateEpochId" ELSE ${input.epochId ?? null} END,
          "absenceCandidateGeneration" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateGeneration" ELSE ${generation}::bigint END,
          "existenceDiagnosticState" = COALESCE(${input.diagnostic ?? null}, "existenceDiagnosticState"),
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${identity.shopId}
        AND "shopifyGid" = ${identity.shopifyGid}
        AND (NOT ${requireFence} OR ("existenceState" = 'LIVE' AND ("existenceRequestGen" IS NULL OR "existenceRequestGen" <= ${generation}::bigint)))
      RETURNING id
    `;
    return (rows as unknown[]).length;
  }
  if (identity.resourceKind === "Location") {
    const rows = await db.$queryRaw`
      UPDATE "ShopifyLocationFact"
      SET "absenceNominationState" = COALESCE(${state}::"CatalogAbsenceNominationState", "absenceNominationState"),
          "absenceCandidateEpochId" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateEpochId" ELSE ${input.epochId ?? null} END,
          "absenceCandidateGeneration" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateGeneration" ELSE ${generation}::bigint END,
          "existenceDiagnosticState" = COALESCE(${input.diagnostic ?? null}, "existenceDiagnosticState"),
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${identity.shopId}
        AND "shopifyGid" = ${identity.shopifyGid}
        AND (NOT ${requireFence} OR ("existenceState" = 'LIVE' AND ("existenceRequestGen" IS NULL OR "existenceRequestGen" <= ${generation}::bigint)))
      RETURNING id
    `;
    return (rows as unknown[]).length;
  }
  const levelIdentity = identity as Extract<
    CanonicalFactIdentity,
    { resourceKind: "InventoryLevel" }
  >;
  const rows = await db.$queryRaw`
    UPDATE "ShopifyInventoryLevelFact"
    SET "absenceNominationState" = COALESCE(${state}::"CatalogAbsenceNominationState", "absenceNominationState"),
        "absenceCandidateEpochId" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateEpochId" ELSE ${input.epochId ?? null} END,
        "absenceCandidateGeneration" = CASE WHEN ${state}::text IS NULL THEN "absenceCandidateGeneration" ELSE ${generation}::bigint END,
        "existenceDiagnosticState" = COALESCE(${input.diagnostic ?? null}, "existenceDiagnosticState"),
        "updatedAt" = clock_timestamp()
    WHERE "shopId" = ${identity.shopId}
      AND "inventoryItemGid" = ${levelIdentity.inventoryItemGid}
      AND "locationGid" = ${levelIdentity.locationGid}
      AND (NOT ${requireFence} OR ("existenceState" = 'LIVE' AND ("existenceRequestGen" IS NULL OR "existenceRequestGen" <= ${generation}::bigint)))
    RETURNING id
  `;
  return (rows as unknown[]).length;
}

export async function writeCanonicalFactMetadata(
  authority: TenantAuthority,
  input: {
    identity: CanonicalFactIdentity;
    absenceState?: "NONE" | "CANDIDATE" | "CIRCUIT_BREAKER_HELD";
    epochId?: string | null;
    candidateGeneration?: bigint | null;
    diagnostic?: string | null;
    requireFenceEligibility?: boolean;
  },
): Promise<boolean> {
  if (input.identity.shopId !== authority.shopId) {
    throw new Error("canonical_metadata_shop_mismatch");
  }
  const db = createTenantDb(authority);
  return db.$transaction(async (tx) => {
    await acquireCanonicalIdentityAdvisoryLock(
      tx as unknown as CanonicalApplyDb,
      lockIdentity(input.identity),
    );
    const count = await updateFactMetadata(
      tx as unknown as CanonicalApplyDb,
      input,
    );
    if (count > 1) throw new Error("canonical_metadata_identity_not_unique");
    return count === 1;
  });
}
