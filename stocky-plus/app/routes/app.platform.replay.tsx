import type { ActionFunctionArgs } from "react-router";
import { createHash, randomUUID } from "node:crypto";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { applyPlatformDeadLetterReplay } from "../sync/replay.server";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { assertParticipatingWriteGuardForShop } from "../tenant/participating-write.server";
import { replayRequestDigestAgrees } from "../rbac/replay-digest.server";

/**
 * Human replay enqueue. Same CP transaction: lifecycle guard, authz lock,
 * fresh assignment verify, PlatformReplayCommand upsert, existing replay.
 * Cross-origin POS/extension callers are not adopted (R1-01 deferred).
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireAdminTenant({ request, params });
  if (ctx.actor.status !== "verified") {
    throw new Response("platform_denied", { status: 403 });
  }
  const body = (await request.json()) as {
    deadLetterId?: string;
    commandId?: string;
    reason?: string;
  };
  const commandId = body.commandId || randomUUID();
  const deadLetterId = String(body.deadLetterId ?? "");
  const actorId = ctx.actor.actor.shopifyUserId;
  const digest = createHash("sha256")
    .update(`replay:${ctx.shop.id}:${actorId}:${deadLetterId}`)
    .digest("hex");

  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    await assertParticipatingWriteGuardForShop(
      tx,
      ctx.shop.id,
      ctx.shop.myshopifyDomain,
    );
    await tx.$executeRaw`SELECT stocky_authz_lock(${ctx.shop.id}, ${actorId})`;
    const verified = await tx.$queryRaw<Array<{ allowed: boolean }>>`
      SELECT stocky_verify_platform_assignment(${ctx.shop.id}, ${actorId}, ${"platform.replay.execute"}) AS allowed
    `;
    if (verified[0]?.allowed !== true) {
      throw new Response("replay_forbidden", { status: 403 });
    }
    const existing = await tx.platformReplayCommand.findUnique({
      where: {
        shopId_commandId: { shopId: ctx.shop.id, commandId },
      },
    });
    if (existing) {
      if (!replayRequestDigestAgrees(existing.requestDigest, digest)) {
        throw new Response("replay_digest_mismatch", { status: 409 });
      }
      return {
        commandId,
        reconcile: true,
        newJobId: existing.newJobId,
        replayId: existing.replayId,
      };
    }
    const result = await applyPlatformDeadLetterReplay({
      deadLetterId,
      shopId: ctx.shop.id,
      reason: body.reason || "platform_replay",
      tx,
    });
    await tx.platformReplayCommand.create({
      data: {
        commandId,
        shopId: ctx.shop.id,
        actorId,
        deadLetterId,
        originalJobId: result.originalJob.id,
        requestDigest: digest,
        newJobId: result.newJob.id,
        replayId: result.replay.id,
      },
    });
    return {
      commandId,
      reconcile: false,
      newJobId: result.newJob.id,
      replayId: result.replay.id,
    };
  });
}
