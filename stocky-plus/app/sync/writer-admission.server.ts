/**
 * Sole producer of stocky_record_writer_admission. Queued/webhook/replayed work
 * cannot mint ADMIN origin; they inherit or use WEBHOOK/PARENT_LINEAGE/MANUAL_REPLAY.
 */
import { createHash, randomUUID } from "node:crypto";
import { withAdmissionPrincipal } from "./admission-principal.server";

export type WriterAdmissionSourceKind =
  | "ADMIN"
  | "WEBHOOK"
  | "PARENT_LINEAGE"
  | "MANUAL_REPLAY"
  | "QUEUED";

export async function recordWriterAdmission(input: {
  canonicalDomain: string;
  shopId: string;
  workId?: string;
  sourceKind: WriterAdmissionSourceKind;
  sourceIdentity: string;
  sourceBody: string;
  targetKind: string;
  targetValue: string;
  parentWorkId?: string | null;
  durableJobId?: string | null;
  linkMode?: "ATOMIC" | "BEGIN";
}): Promise<{ workId: string; originId: string }> {
  const workId = input.workId ?? randomUUID();
  const digest = createHash("sha256")
    .update(`pr7-source-v1\n${input.sourceKind}\n${input.sourceIdentity}\n${input.sourceBody}`)
    .digest("hex");
  const originId = await withAdmissionPrincipal(
    "stocky_original_admission",
    async (client) => {
      await client.query("SELECT set_config('stocky.current_shop_id', $1, true)", [
        input.shopId,
      ]);
      await client.query(
        "SELECT set_config('stocky.tenant_context_version', $1, true)",
        ["phase1-db-tenant-context-v1"],
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
          digest,
          "pr7-origin-v1",
          new Date(),
          input.sourceKind === "ADMIN"
            ? "ADMIN_SESSION_CURRENT_INSTALL"
            : input.sourceKind,
          input.targetKind,
          input.targetValue,
          input.parentWorkId ?? null,
          input.durableJobId ?? null,
          input.linkMode ?? "ATOMIC",
        ],
      );
      return result.rows[0]?.id;
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
}): Promise<void> {
  const digest = createHash("sha256")
    .update(`pr7-source-v1\n${input.sourceKind}\n${input.sourceIdentity}\n${input.sourceBody}`)
    .digest("hex");
  await withAdmissionPrincipal("stocky_original_admission", async (client) => {
    await client.query(
      "SELECT stocky_note_queued_work($1,$2,$3,$4,$5,$6,$7)",
      [
        input.canonicalDomain,
        input.shopId,
        input.sourceKind,
        input.sourceIdentity,
        digest,
        input.sightedClass,
        input.parentWorkId ?? null,
      ],
    );
  });
}
