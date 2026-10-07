/**
 * Shop install generation fence. Survives Shop row deletion via targetShopId.
 * Unique LIVE per canonical domain is enforced in SQL (partial unique index).
 */
import { randomUUID } from "node:crypto";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { assertParticipatingWriteGuard } from "../tenant/participating-write.server";
import { PrivacyBoundaryError } from "./errors.server";

export const GENERATION_FENCE = {
  LIVE: "LIVE",
  UNINSTALLED: "UNINSTALLED",
  ERASING: "ERASING",
  FINALIZING: "FINALIZING",
  ERASED: "ERASED",
  SUPERSEDED_EVIDENCED: "SUPERSEDED_EVIDENCED",
} as const;

export type GenerationFence =
  (typeof GENERATION_FENCE)[keyof typeof GENERATION_FENCE];

const BLOCK_CREATE = new Set<string>([
  GENERATION_FENCE.ERASING,
  GENERATION_FENCE.FINALIZING,
]);

export async function ensureLiveInstallGeneration(input: {
  shopId: string;
  canonicalDomain: string;
}): Promise<{ id: string; fence: string; targetShopId: string }> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    await assertParticipatingWriteGuard(tx, input.canonicalDomain);
    const blocking = await tx.shopInstallGeneration.findFirst({
      where: {
        canonicalDomain: input.canonicalDomain,
        fence: { in: [...BLOCK_CREATE] },
      },
    });
    if (blocking) {
      throw new PrivacyBoundaryError(
        "generation_frozen",
        `Cannot create LIVE generation while ${blocking.fence}`,
      );
    }
    const live = await tx.shopInstallGeneration.findFirst({
      where: {
        canonicalDomain: input.canonicalDomain,
        fence: GENERATION_FENCE.LIVE,
      },
    });
    if (live) {
      return { id: live.id, fence: live.fence, targetShopId: live.targetShopId };
    }
    const created = await tx.shopInstallGeneration.create({
      data: {
        id: randomUUID(),
        canonicalDomain: input.canonicalDomain,
        targetShopId: input.shopId,
        shopRowId: input.shopId,
        fence: GENERATION_FENCE.LIVE,
      },
    });
    return {
      id: created.id,
      fence: created.fence,
      targetShopId: created.targetShopId,
    };
  });
}

type GenerationTx = {
  shopInstallGeneration: {
    updateMany: (args: {
      where: { canonicalDomain: string; fence: string };
      data: {
        fence: string;
        uninstalledAt: Date;
        shopRowId: string;
      };
    }) => Promise<unknown>;
  };
};

export async function markGenerationUninstalledInTx(
  tx: GenerationTx,
  input: { shopId: string; canonicalDomain: string; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  await tx.shopInstallGeneration.updateMany({
    where: {
      canonicalDomain: input.canonicalDomain,
      fence: GENERATION_FENCE.LIVE,
    },
    data: {
      fence: GENERATION_FENCE.UNINSTALLED,
      uninstalledAt: now,
      shopRowId: input.shopId,
    },
  });
}

export async function markGenerationUninstalled(input: {
  shopId: string;
  canonicalDomain: string;
}): Promise<void> {
  const prisma = getControlPlanePrisma();
  await prisma.$transaction(async (tx) => {
    await assertParticipatingWriteGuard(tx, input.canonicalDomain);
    await markGenerationUninstalledInTx(tx, input);
  });
}

export async function assertNoErasureFence(canonicalDomain: string): Promise<void> {
  const prisma = getControlPlanePrisma();
  const blocking = await prisma.shopInstallGeneration.findFirst({
    where: {
      canonicalDomain,
      fence: { in: [...BLOCK_CREATE] },
    },
  });
  if (blocking) {
    throw new PrivacyBoundaryError(
      "erasure_fence_active",
      `Shop namespace ${canonicalDomain} is ${blocking.fence}`,
    );
  }
}

export async function loadGenerationForShop(input: {
  shopId: string;
  canonicalDomain: string;
}): Promise<{ id: string; fence: string; targetShopId: string } | null> {
  const prisma = getControlPlanePrisma();
  const live = await prisma.shopInstallGeneration.findFirst({
    where: {
      canonicalDomain: input.canonicalDomain,
      fence: GENERATION_FENCE.LIVE,
    },
  });
  if (live) {
    return {
      id: live.id,
      fence: live.fence,
      targetShopId: live.targetShopId,
    };
  }
  return prisma.shopInstallGeneration.findFirst({
    where: {
      OR: [{ targetShopId: input.shopId }, { shopRowId: input.shopId }],
    },
    orderBy: { installedAt: "desc" },
    select: { id: true, fence: true, targetShopId: true },
  });
}
