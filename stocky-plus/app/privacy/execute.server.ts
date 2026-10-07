/**
 * Topic-scoped processors. Ordinary Shop.processingEnabled may stay false.
 * Processors never re-enable processing. Unknown/incomplete evidence stays visible.
 */
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import {
  setPrivacyExecutionContext,
  setPrivacyExecutionContextOnClient,
} from "./db-context.server";
import { withPrivacyPrincipal } from "./erasure-db.server";
import { PrivacyBoundaryError } from "./errors.server";
import { assertShopExternalResidualClear } from "./external-residual.server";
import {
  GENERATION_FENCE,
  markGenerationUninstalledInTx,
} from "./generation.server";
import { isPrivacyPauseEnabled } from "./pause.server";
import {
  CUSTOMER_REDACT_DELETE_ORDER,
  PRIVACY_MERCHANT_DELETE_ORDER,
} from "./surfaces.server";

export type ProcessorResult = {
  requestId: string;
  topic: string;
  state: string;
  residualCount: number | null;
  incomplete: boolean;
  detail: string;
};

function quoteIdent(ident: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new Error(`unsafe_ident:${ident}`);
  }
  return `"${ident}"`;
}

async function loadActiveRequest(requestId: string) {
  const prisma = getControlPlanePrisma();
  const request = await prisma.privacyRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new PrivacyBoundaryError(
      "privacy_request_missing",
      "PrivacyRequest missing",
    );
  }
  return { prisma, request };
}

export async function processPrivacyRequest(
  requestId: string,
  attemptId: string,
): Promise<ProcessorResult> {
  if (isPrivacyPauseEnabled()) {
    const { request } = await loadActiveRequest(requestId);
    return {
      requestId,
      topic: request.topic,
      state: request.state,
      residualCount: null,
      incomplete: true,
      detail: "pause_honored",
    };
  }

  const { prisma, request } = await loadActiveRequest(requestId);
  if (request.topic === "customers/data_request") {
    return processCustomerDataRequest(prisma, request.id, attemptId);
  }
  if (request.topic === "customers/redact") {
    return processCustomerRedact(prisma, request.id, attemptId);
  }
  if (request.topic === "shop/redact") {
    return processShopRedact(prisma, request.id, attemptId);
  }
  return {
    requestId: request.id,
    topic: request.topic,
    state: request.state,
    residualCount: null,
    incomplete: true,
    detail: "unknown_topic_visible",
  };
}

async function processCustomerDataRequest(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  requestId: string,
  attemptId: string,
): Promise<ProcessorResult> {
  return prisma.$transaction(async (tx) => {
    const request = await tx.privacyRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    await setPrivacyExecutionContext(tx, {
      shopId: request.targetShopId,
      requestId: request.id,
      attemptId,
      workId: request.workId,
    });
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state: "ENUMERATING", activeAttemptId: attemptId },
    });
    await tx.$executeRaw`SELECT stocky_privacy_enumerate_targets(${request.id})`;
    const coverage = await tx.$queryRaw<Array<{ coverage: string }>>`
      SELECT stocky_privacy_data_request_coverage(${request.id}) AS coverage
    `;
    const keys = await tx.privacyTargetKey.count({
      where: { requestId: request.id },
    });
    const state = keys > 0 ? "FULFILLING" : "INCOMPLETE";
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state, enumerationComplete: true },
    });
    return {
      requestId: request.id,
      topic: request.topic,
      state,
      residualCount: null,
      incomplete: keys === 0,
      detail: coverage[0]?.coverage ?? "enumerated",
    };
  });
}

async function processCustomerRedact(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  requestId: string,
  attemptId: string,
): Promise<ProcessorResult> {
  const loaded = await prisma.privacyRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (!loaded.lookupCustomerRestId) {
    await prisma.privacyRequest.update({
      where: { id: loaded.id },
      data: { state: "INCOMPLETE" },
    });
    return {
      requestId: loaded.id,
      topic: loaded.topic,
      state: "INCOMPLETE",
      residualCount: null,
      incomplete: true,
      detail: "customer_target_missing",
    };
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.privacyRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    await setPrivacyExecutionContext(tx, {
      shopId: request.targetShopId,
      requestId: request.id,
      attemptId,
      workId: request.workId,
    });
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state: "ENUMERATING", activeAttemptId: attemptId },
    });
    await tx.$executeRaw`SELECT stocky_privacy_install_customer_barrier(${request.id}, ${attemptId})`;
    await tx.$executeRaw`SELECT stocky_privacy_enumerate_targets(${request.id})`;
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state: "APPLYING" },
    });
  });

  const request = await prisma.privacyRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  await withPrivacyPrincipal("stocky_privacy_erasure", async (client) => {
    await client.query("BEGIN");
    try {
      await setPrivacyExecutionContextOnClient(client, {
        shopId: request.targetShopId,
        requestId: request.id,
        attemptId,
        workId: request.workId,
      });
      for (const table of CUSTOMER_REDACT_DELETE_ORDER) {
        await client.query(`DELETE FROM ${quoteIdent(table)}`);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });

  return prisma.$transaction(async (tx) => {
    await setPrivacyExecutionContext(tx, {
      shopId: request.targetShopId,
      requestId: request.id,
      attemptId,
      workId: request.workId,
    });
    const statusRows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT stocky_privacy_complete_customer_redact(${request.id}, ${attemptId}) AS status
    `;
    const status = statusRows[0]?.status ?? "stale";
    if (status === "completed") {
      await tx.privacyRequest.update({
        where: { id: request.id },
        data: { state: "COMPLETED" },
      });
      return {
        requestId: request.id,
        topic: request.topic,
        state: "COMPLETED",
        residualCount: 0,
        incomplete: false,
        detail: "customer_redact_complete",
      };
    }
    if (status === "budget_exhausted") {
      await tx.privacyRequest.update({
        where: { id: request.id },
        data: { state: "INCOMPLETE" },
      });
      return {
        requestId: request.id,
        topic: request.topic,
        state: "INCOMPLETE",
        residualCount: null,
        incomplete: true,
        detail: "budget_exhausted",
      };
    }
    const residual = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT stocky_privacy_customer_residual_count(${request.id}) AS n
    `;
    const n = Number(residual[0]?.n ?? -1);
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state: "INCOMPLETE" },
    });
    return {
      requestId: request.id,
      topic: request.topic,
      state: "INCOMPLETE",
      residualCount: n,
      incomplete: true,
      detail: status === "remnants" ? "residual_visible" : status,
    };
  });
}

async function processShopRedact(
  prisma: ReturnType<typeof getControlPlanePrisma>,
  requestId: string,
  attemptId: string,
): Promise<ProcessorResult> {
  const request = await prisma.privacyRequest.findUniqueOrThrow({
    where: { id: requestId },
  });

  const privacyCtx = {
    shopId: request.targetShopId,
    requestId: request.id,
    attemptId,
    workId: request.workId,
  };

  const gated = await prisma.$transaction(async (tx) => {
    await setPrivacyExecutionContext(tx, privacyCtx);
    await tx.$executeRaw`SELECT stocky_lifecycle_exclusive_lock(${request.canonicalDomain})`;
    await tx.$executeRaw`SELECT stocky_privacy_publication_lock(${request.id})`;
    const shop = await tx.shop.findUnique({
      where: { id: request.targetShopId },
      select: { processingEnabled: true },
    });
    if (shop?.processingEnabled) {
      await tx.privacyRequest.update({
        where: { id: request.id },
        data: { state: "INCOMPLETE" },
      });
      return { blocked: true as const, detail: "shop_still_installed" };
    }
    await markGenerationUninstalledInTx(tx, {
      shopId: request.targetShopId,
      canonicalDomain: request.canonicalDomain,
    });
    await tx.shopInstallGeneration.updateMany({
      where: { id: request.generationId },
      data: { fence: GENERATION_FENCE.ERASING },
    });
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state: "APPLYING", activeAttemptId: attemptId },
    });
    await tx.$executeRaw`SELECT stocky_privacy_enumerate_shop_surfaces(${request.id})`;
    await tx.$executeRaw`SELECT stocky_privacy_enumerate_targets(${request.id})`;
    return { blocked: false as const };
  });
  if (gated.blocked) {
    return {
      requestId: request.id,
      topic: request.topic,
      state: "INCOMPLETE",
      residualCount: null,
      incomplete: true,
      detail: gated.detail,
    };
  }

  await withPrivacyPrincipal("stocky_privacy_erasure", async (client) => {
    await client.query("BEGIN");
    try {
      await setPrivacyExecutionContextOnClient(client, {
        shopId: request.targetShopId,
        requestId: request.id,
        attemptId,
        workId: request.workId,
      });
      await client.query("SELECT stocky_lifecycle_exclusive_lock($1)", [
        request.canonicalDomain,
      ]);
      await client.query("SELECT stocky_privacy_publication_lock($1)", [
        request.id,
      ]);
      for (const table of PRIVACY_MERCHANT_DELETE_ORDER) {
        await client.query(`DELETE FROM ${quoteIdent(table)}`);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });

  const residual = await prisma.$transaction(async (tx) => {
    await setPrivacyExecutionContext(tx, privacyCtx);
    return tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT stocky_privacy_shop_residual_count(${request.targetShopId}) AS n
    `;
  });
  const n = Number(residual[0]?.n ?? -1);
  if (n !== 0) {
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: { state: "INCOMPLETE" },
    });
    return {
      requestId: request.id,
      topic: request.topic,
      state: "INCOMPLETE",
      residualCount: n,
      incomplete: true,
      detail: "shop_residual_visible",
    };
  }

  const external = await assertShopExternalResidualClear({
    shopId: request.targetShopId,
    canonicalDomain: request.canonicalDomain,
  });
  if (!external.ok) {
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: { state: "INCOMPLETE" },
    });
    return {
      requestId: request.id,
      topic: request.topic,
      state: "INCOMPLETE",
      residualCount: n,
      incomplete: true,
      detail: external.detail,
    };
  }

  await prisma.$transaction(async (tx) => {
    await setPrivacyExecutionContext(tx, privacyCtx);
    await tx.$executeRaw`SELECT stocky_lifecycle_exclusive_lock(${request.canonicalDomain})`;
    await tx.shopRoleAssignment.deleteMany({
      where: { shopId: request.targetShopId },
    });
    const related = await tx.privacyRequest.findMany({
      where: { targetShopId: request.targetShopId },
      select: { id: true },
    });
    await tx.privacyDataRequestArtifact.deleteMany({
      where: { privacyRequestId: { in: related.map((row) => row.id) } },
    });
    await tx.shop.updateMany({
      where: { id: request.targetShopId },
      data: {
        processingEnabled: false,
        processingDisabledReason: "REDACTED",
        processingDisabledAt: new Date(),
      },
    });
  });
  await prisma.privacyRequest.update({
    where: { id: request.id },
    data: { state: "FINALIZING" },
  });
  await prisma.shopInstallGeneration.updateMany({
    where: { id: request.generationId },
    data: { fence: GENERATION_FENCE.FINALIZING },
  });

  await withPrivacyPrincipal("stocky_privacy_erasure", async (client) => {
    await client.query(
      "SELECT stocky_privacy_finalize_shop_delete($1, $2, $3, $4)",
      [request.id, request.targetShopId, request.generationId, attemptId],
    );
  });

  await prisma.shopInstallGeneration.updateMany({
    where: { id: request.generationId },
    data: { fence: GENERATION_FENCE.ERASED, erasedAt: new Date() },
  });
  await prisma.privacyRequest.update({
    where: { id: request.id },
    data: { state: "COMPLETED", shopRowId: null },
  });
  return {
    requestId: request.id,
    topic: request.topic,
    state: "COMPLETED",
    residualCount: 0,
    incomplete: false,
    detail: "shop_redact_complete",
  };
}
