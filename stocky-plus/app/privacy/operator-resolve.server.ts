/**
 * Restricted operator fallback. Token checked at use. Does not reclaim
 * operator-only D-scratch and does not guess quiescence.
 */
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { PrivacyBoundaryError } from "./errors.server";

export async function operatorInspectPrivacyRequest(input: {
  requestId: string;
  operatorToken: string;
}): Promise<{
  requestId: string;
  topic: string;
  state: string;
  incomplete: boolean;
  generationId: string;
}> {
  const expected = process.env.STOCKY_PRIVACY_OPERATOR_TOKEN;
  if (!expected || input.operatorToken !== expected) {
    throw new PrivacyBoundaryError("operator_denied", "Operator token rejected");
  }
  const prisma = getControlPlanePrisma();
  const request = await prisma.privacyRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request) {
    throw new PrivacyBoundaryError("privacy_request_missing", "Not found");
  }
  return {
    requestId: request.id,
    topic: request.topic,
    state: request.state,
    incomplete: request.state === "INCOMPLETE",
    generationId: request.generationId,
  };
}
