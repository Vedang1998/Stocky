/**
 * Append-only purchasing history.
 *
 * Events are keyed by subject id without a foreign key, so the record of a
 * deleted draft or supplier outlives the row it describes.
 */
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { PurchasingActor } from "./actor.server";

export type PurchasingSubjectType = "PURCHASE_ORDER" | "SUPPLIER";

export type PurchasingEventInput = {
  subjectType: PurchasingSubjectType;
  subjectId: string;
  action: string;
  actor: PurchasingActor;
  details?: Prisma.InputJsonObject;
};

export type PurchasingEventRecord = {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  details: Prisma.JsonValue;
  createdAt: Date;
};

export async function recordPurchasingEvent(
  db: TenantDb,
  event: PurchasingEventInput,
): Promise<void> {
  await db.purchasingEvent.create({
    data: {
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      action: event.action,
      actorType: event.actor.type,
      actorId: event.actor.id,
      details: event.details ?? {},
    },
  });
}

export async function listPurchasingEvents(
  db: TenantDb,
  subject: { subjectType: PurchasingSubjectType; subjectId: string },
  limit = 50,
): Promise<PurchasingEventRecord[]> {
  return db.purchasingEvent.findMany({
    where: { subjectType: subject.subjectType, subjectId: subject.subjectId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      action: true,
      actorType: true,
      actorId: true,
      details: true,
      createdAt: true,
    },
  });
}
