/**
 * Sole producer of stocky_record_writer_admission. Queued/webhook/replayed work
 * cannot mint ADMIN origin; they inherit or use WEBHOOK/PARENT_LINEAGE/MANUAL_REPLAY.
 */
import { randomUUID } from "node:crypto";
import { withAdmissionPrincipal } from "./admission-principal.server";

export type WriterAdmissionSourceKind =
  | "ADMIN"
  | "WEBHOOK"
  | "PARENT_LINEAGE"
  | "MANUAL_REPLAY";

export function admissionEvidenceClass(
  kind: WriterAdmissionSourceKind,
): "ADMIN_SESSION_CURRENT_INSTALL" | "WEBHOOK_PROVIDER_AUTH" | "PARENT_LINEAGE" | "MANUAL_REPLAY" {
  if (kind === "ADMIN") return "ADMIN_SESSION_CURRENT_INSTALL";
  if (kind === "WEBHOOK") return "WEBHOOK_PROVIDER_AUTH";
  if (kind === "PARENT_LINEAGE") return "PARENT_LINEAGE";
  return "MANUAL_REPLAY";
}

export async function recordWriterAdmission(input: {
  canonicalDomain: string;
  shopId: string;
  workId?: string;
  sourceKind: WriterAdmissionSourceKind;
  sourceIdentity: string;
  sourceBody: string;
  targetKind: string;
  targetValue: string;
  operation?: string;
  parentWorkId?: string | null;
  durableJobId?: string | null;
  linkMode?: "ATOMIC" | "BEGIN";
}): Promise<{ workId: string; originId: string }> {
  const workId = input.workId ?? randomUUID();
  const operation = input.operation ?? "CUSTOMER_WRITE";
  const originId = await withAdmissionPrincipal(
    "stocky_original_admission",
    async (client) => {
      await client.query("BEGIN");
      try {
      await client.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        input.shopId,
      ]);
      await client.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
      );
      const digest = await client.query<{ d: string }>(
        `SELECT stocky_source_commitment($1,$2,$3,$4,$5,$6) AS d`,
        [
          input.canonicalDomain,
          input.shopId,
          operation,
          input.targetKind,
          input.targetValue,
          input.sourceBody,
        ],
      );
      const result = await client.query<{ id: string }>(
        `SELECT stocky_record_writer_admission(
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
         ) AS id`,
        [
          input.canonicalDomain,
          input.shopId,
          workId,
          input.sourceKind,
          input.sourceIdentity,
          digest.rows[0]?.d,
          "pr7-origin-v1",
          new Date(),
          admissionEvidenceClass(input.sourceKind),
          input.targetKind,
          input.targetValue,
          input.parentWorkId ?? null,
          input.durableJobId ?? null,
          input.linkMode ?? "ATOMIC",
        ],
      );
      await client.query("COMMIT");
      return result.rows[0]?.id;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
    },
  );
  if (!originId) {
    throw new Error("writer_admission_failed");
  }
  return { workId, originId };
}

export async function commitWriterAdmission(workId: string): Promise<void> {
  await withAdmissionPrincipal("stocky_original_admission", async (client) => {
    await client.query("SELECT stocky_commit_writer_admission($1)", [workId]);
  });
}

export async function recoverWriterAdmission(workId: string): Promise<void> {
  await withAdmissionPrincipal("stocky_original_admission", async (client) => {
    await client.query("SELECT stocky_recover_writer_admission($1)", [workId]);
  });
}

export async function noteQueuedWork(input: {
  canonicalDomain: string;
  shopId: string;
  sourceKind: string;
  sourceIdentity: string;
  sourceBody: string;
  sightedClass: string;
  parentWorkId?: string | null;
  operation?: string;
  targetKind?: string;
  targetValue?: string;
}): Promise<void> {
  const operation = input.operation ?? "CUSTOMER_WRITE";
  const targetKind = input.targetKind ?? input.sourceKind;
  const targetValue = input.targetValue ?? input.sourceIdentity;
  await withAdmissionPrincipal("stocky_original_admission", async (client) => {
      await client.query("BEGIN");
      try {
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
        await client.query(
          "SELECT stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)",
          [
            input.canonicalDomain,
            input.shopId,
            input.sourceKind,
            input.sourceIdentity,
            digest.rows[0]?.d,
            input.sightedClass,
            input.parentWorkId ?? null,
          ],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      }
  });
}
