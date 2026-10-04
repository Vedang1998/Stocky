/**
 * Topic-scoped processors. Ordinary Shop.processingEnabled may stay false.
 * Processors never re-enable processing. Unknown/incomplete evidence stays visible.
 */
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { setPrivacyExecutionContext } from "./db-context.server";
import { withPrivacyPrincipal } from "./erasure-db.server";
import { PrivacyBoundaryError } from "./errors.server";
import { assertShopExternalResidualClear } from "./external-residual.server";
import { GENERATION_FENCE } from "./generation.server";
import { isPrivacyPauseEnabled } from "./pause.server";
import { PRIVACY_MERCHANT_DELETE_ORDER } from "./surfaces.server";

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
  return prisma.$transaction(async (tx) => {
    const request = await tx.privacyRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    if (!request.lookupCustomerRestId) {
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
        detail: "customer_target_missing",
      };
    }
    await setPrivacyExecutionContext(tx, {
      shopId: request.targetShopId,
      requestId: request.id,
      attemptId,
      workId: request.workId,
    });
    await tx.$executeRaw`SELECT stocky_privacy_install_customer_barrier(${request.id}, ${attemptId})`;
    await tx.$executeRaw`SELECT stocky_privacy_enumerate_targets(${request.id})`;
    await tx.$executeRaw`SELECT stocky_privacy_complete_customer_redact(${request.id}, ${attemptId})`;
    const residual = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT stocky_privacy_customer_residual_count(${request.id}) AS n
    `;
    const n = Number(residual[0]?.n ?? -1);
    const complete = n === 0;
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: { state: complete ? "COMPLETED" : "INCOMPLETE" },
    });
    return {
      requestId: request.id,
      topic: request.topic,
      state: complete ? "COMPLETED" : "INCOMPLETE",
      residualCount: n,
      incomplete: !complete,
      detail: complete ? "customer_redact_complete" : "residual_visible",
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

  await prisma.$transaction(async (tx) => {
    await setPrivacyExecutionContext(tx, {
      shopId: request.targetShopId,
      requestId: request.id,
      attemptId,
      workId: request.workId,
    });
    await tx.$executeRaw`SELECT stocky_privacy_publication_lock(${request.id})`;
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
  });

  await withPrivacyPrincipal("stocky_privacy_erasure", async (client) => {
    await client.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
      request.targetShopId,
    ]);
    await client.query(
      "SELECT set_config('stocky.tenant_context_version', $1, true)",
      ["phase1-db-tenant-context-v1"],
    );
    await client.query(
      "SELECT set_config('stocky.privacy_request_id', $1, true)",
      [request.id],
    );
    await client.query(
      "SELECT set_config('stocky.privacy_attempt_id', $1, true)",
      [attemptId],
    );
    for (const table of PRIVACY_MERCHANT_DELETE_ORDER) {
      await client.query(`DELETE FROM ${quoteIdent(table)}`);
    }
  });

  const residual = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT stocky_privacy_shop_residual_count(${request.targetShopId}) AS n
  `;
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
