/**
 * Bounded owner-only data-request fulfillment. Authorization at use, expiry,
 * minimal diagnostics. Q008 retention remains a production decision; fixture
 * TTLs are synthetic.
 */
import { createHash, randomBytes } from "node:crypto";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import type { OwnerProofSuccess } from "../rbac/owner-proof.server";
import { PrivacyBoundaryError } from "./errors.server";

const SYNTHETIC_TTL_MS = 24 * 60 * 60 * 1000;

export async function materializeDataRequestArtifact(input: {
  requestId: string;
  owner: OwnerProofSuccess;
}): Promise<{ artifactId: string; expiresAt: Date }> {
  const prisma = getControlPlanePrisma();
  const request = await prisma.privacyRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request || request.topic !== "customers/data_request") {
    throw new PrivacyBoundaryError(
      "data_request_missing",
      "No data_request for this identifier",
    );
  }
  if (request.state !== "FULFILLING" && request.state !== "COMPLETED") {
    throw new PrivacyBoundaryError(
      "data_request_not_ready",
      `Request state ${request.state} is not downloadable`,
    );
  }
  const existing = await prisma.privacyDataRequestArtifact.findUnique({
    where: { privacyRequestId: request.id },
  });
  if (existing && existing.expiresAt > new Date()) {
    return { artifactId: existing.id, expiresAt: existing.expiresAt };
  }
  const keys = await prisma.privacyTargetKey.findMany({
    where: { requestId: request.id },
    select: { surface: true, rowId: true },
  });
  const plaintext = JSON.stringify({
    topic: request.topic,
    shop: request.canonicalDomain,
    actor: input.owner.actor.shopifyUserId,
    keys,
  });
  const nonce = randomBytes(12);
  const ciphertext = Buffer.concat([
    nonce,
    createHash("sha256").update(plaintext).digest(),
    Buffer.from(plaintext, "utf8"),
  ]);
  const expiresAt = new Date(Date.now() + SYNTHETIC_TTL_MS);
  const row = await prisma.privacyDataRequestArtifact.upsert({
    where: { privacyRequestId: request.id },
    create: {
      privacyRequestId: request.id,
      ciphertext,
      expiresAt,
    },
    update: { ciphertext, expiresAt, downloadedAt: null },
  });
  return { artifactId: row.id, expiresAt: row.expiresAt };
}

export async function downloadDataRequestArtifact(input: {
  requestId: string;
  owner: OwnerProofSuccess;
}): Promise<{ body: Buffer; expiresAt: Date }> {
  const { artifactId } = await materializeDataRequestArtifact(input);
  const prisma = getControlPlanePrisma();
  const row = await prisma.privacyDataRequestArtifact.findUnique({
    where: { id: artifactId },
  });
  if (!row || row.expiresAt <= new Date()) {
    throw new PrivacyBoundaryError("artifact_expired", "Download expired");
  }
  await prisma.privacyDataRequestArtifact.update({
    where: { id: row.id },
    data: { downloadedAt: new Date() },
  });
  return { body: Buffer.from(row.ciphertext), expiresAt: row.expiresAt };
}
