/**
 * Append-only merchant AuditEvent emit. Runtime has SELECT/INSERT only.
 * Truthful outcome; disabled-shop-safe coordinator records stay on CP tables.
 */
import { randomUUID } from "node:crypto";
import type { TenantDb } from "../tenant/tenant-db.server";

export type AuditEmitInput = {
  actorKind: string;
  actorId?: string | null;
  action: string;
  decision?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  customerRestId?: string | null;
  correlationId?: string | null;
  emitIdempotency?: string | null;
  outcome: "succeeded" | "failed" | "recorded";
  detail?: string | null;
};

export async function emitAuditEvent(
  db: TenantDb,
  input: AuditEmitInput,
): Promise<{ id: string; duplicate: boolean }> {
  const id = randomUUID();
  try {
    const row = await db.auditEvent.create({
      data: {
        id,
        actorKind: input.actorKind,
        actorId: input.actorId ?? null,
        action: input.action,
        decision: input.decision ?? input.outcome,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        customerRestId: input.customerRestId ?? null,
        correlationId: input.correlationId ?? null,
        emitIdempotency: input.emitIdempotency ?? null,
        outcome: input.outcome,
        detail: input.detail ?? null,
      },
    });
    return { id: row.id, duplicate: false };
  } catch (error) {
    if (input.emitIdempotency) {
      const existing = await db.auditEvent.findFirst({
        where: { emitIdempotency: input.emitIdempotency },
      });
      if (existing) return { id: existing.id, duplicate: true };
    }
    throw error;
  }
}
