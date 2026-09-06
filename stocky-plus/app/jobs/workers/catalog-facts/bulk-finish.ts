import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";

export async function signalBulkOperationContinuation(input: {
  shopId: string;
  payload: Record<string, unknown>;
}): Promise<{ signaled: boolean; syncRunId?: string }> {
  const raw = input.payload.id ?? input.payload.admin_graphql_api_id;
  if (
    typeof raw !== "string" ||
    !raw.startsWith("gid://shopify/BulkOperation/")
  ) {
    throw new Error("bulk_finish_gid_invalid");
  }
  const prisma = getControlPlanePrisma();
  const runs = await prisma.syncRun.findMany({
    where: { shopId: input.shopId, bulkOperationGid: raw },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  if (runs.length !== 1) {
    return { signaled: false };
  }
  const run = runs[0]!;
  await prisma.durableJob.updateMany({
    where: {
      shopId: input.shopId,
      correlationId: run.correlationId,
      jobType: { in: ["catalog-sync", "inventory-state-reconcile"] },
      state: "RETRY_WAIT",
    },
    data: { nextEligibleAt: new Date() },
  });
  return { signaled: true, syncRunId: run.id };
}
