/**
 * Privacy coordinator GUCs. Distinct from tenant processingEnabled context.
 * Request/attempt ids are locators, not capabilities — SQL helpers re-read.
 */
import type { Prisma } from "@prisma/client";

export const GUC_PRIVACY_REQUEST_ID = "stocky.privacy_request_id";
export const GUC_PRIVACY_ATTEMPT_ID = "stocky.privacy_attempt_id";
export const GUC_TRUSTED_WORK_ID = "stocky.trusted_work_id";

type TxClient = {
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
};

export async function setPrivacyExecutionContext(
  tx: TxClient,
  input: {
    shopId: string;
    requestId: string;
    attemptId: string;
    workId?: string | null;
  },
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('stocky.current_shop_id', ${input.shopId}, true)`;
  await tx.$executeRaw`SELECT set_config('stocky.tenant_context_version', 'phase1-db-tenant-context-v1', true)`;
  await tx.$executeRaw`SELECT set_config(${GUC_PRIVACY_REQUEST_ID}, ${input.requestId}, true)`;
  await tx.$executeRaw`SELECT set_config(${GUC_PRIVACY_ATTEMPT_ID}, ${input.attemptId}, true)`;
  if (input.workId) {
    await tx.$executeRaw`SELECT set_config(${GUC_TRUSTED_WORK_ID}, ${input.workId}, true)`;
  }
}

type PgQueryClient = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

/** Same locators on a raw pg Client (erasure SET ROLE connection). */
export async function setPrivacyExecutionContextOnClient(
  client: PgQueryClient,
  input: {
    shopId: string;
    requestId: string;
    attemptId: string;
    workId?: string | null;
  },
): Promise<void> {
  await client.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
    input.shopId,
  ]);
  await client.query(
    "SELECT set_config('stocky.tenant_context_version', $1, true)",
    ["phase1-db-tenant-context-v1"],
  );
  await client.query("SELECT set_config($1, $2, true)", [
    GUC_PRIVACY_REQUEST_ID,
    input.requestId,
  ]);
  await client.query("SELECT set_config($1, $2, true)", [
    GUC_PRIVACY_ATTEMPT_ID,
    input.attemptId,
  ]);
  if (input.workId) {
    await client.query("SELECT set_config($1, $2, true)", [
      GUC_TRUSTED_WORK_ID,
      input.workId,
    ]);
  }
}
