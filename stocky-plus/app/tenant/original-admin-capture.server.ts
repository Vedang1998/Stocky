/**
 * Authenticated original-admin capture immediately after requireAdminTenant
 * for genuinely new admin commands. Capture principal is stocky_admin_capture.
 */
import { randomUUID } from "node:crypto";
import { withAdmissionPrincipal } from "../sync/admission-principal.server";
import type { VerifiedActor } from "../rbac/actor.server";

export async function captureOriginalAdminCommand(input: {
  shopId: string;
  canonicalDomain: string;
  actor: VerifiedActor;
  commandId?: string;
  sourceKind: string;
  sourceIdentity: string;
  sourceBody: string;
  operation?: string;
  targetKind?: string | null;
  targetValue?: string | null;
}): Promise<{ captureId: string; commandId: string }> {
  const commandId = input.commandId ?? randomUUID();
  const operation = input.operation ?? "CUSTOMER_WRITE";
  const targetKind = input.targetKind ?? "";
  const targetValue = input.targetValue ?? "";
  const captureId = await withAdmissionPrincipal("stocky_admin_capture", async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        input.shopId,
      ]);
      await client.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      const session = await client.query<{ id: string }>(
        "SELECT stocky_establish_modeled_admin_session($1, $2, $3) AS id",
        [input.shopId, input.canonicalDomain, input.actor.shopifyUserId],
      );
      const sessionId = session.rows[0]?.id;
      if (!sessionId) {
        throw new Error("admin_session_establish_failed");
      }
      await client.query("SELECT set_config('stocky.admin_session_id', $1, true)", [
        sessionId,
      ]);
      const digest = await client.query<{ d: string }>(
        `SELECT stocky_source_commitment($1,$2,$3,$4,$5,$6) AS d`,
        [
          input.canonicalDomain,
          input.shopId,
          operation,
          targetKind,
          targetValue,
          input.sourceBody,
        ],
      );
      const captured = await client.query<{ id: string }>(
        "SELECT stocky_capture_original_admin_command($1,$2,$3,$4,$5,$6,$7,$8) AS id",
        [
          input.canonicalDomain,
          input.shopId,
          commandId,
          input.sourceKind,
          input.sourceIdentity,
          digest.rows[0]?.d,
          targetKind,
          targetValue,
        ],
      );
      await client.query("COMMIT");
      return captured.rows[0]?.id;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
  if (!captureId) {
    throw new Error("admin_capture_failed");
  }
  return { captureId, commandId };
}
