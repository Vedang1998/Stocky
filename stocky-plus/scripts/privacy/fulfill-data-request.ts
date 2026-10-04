#!/usr/bin/env tsx
/**
 * Operator fallback for uninstalled data_request fulfillment.
 * Not platform.export.operational. Token checked at use.
 */
import { operatorInspectPrivacyRequest } from "../../app/privacy/operator-resolve.server";

async function main(): Promise<void> {
  const requestId = process.argv.find((arg) => arg.startsWith("--request="))?.slice(10);
  const token = process.env.STOCKY_PRIVACY_OPERATOR_TOKEN ?? "";
  if (!requestId) {
    throw new Error("usage: fulfill-data-request --request=<id>");
  }
  const inspected = await operatorInspectPrivacyRequest({
    requestId,
    operatorToken: token,
  });
  if (inspected.topic !== "customers/data_request") {
    throw new Error("not_a_data_request");
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ...inspected, delivered: false, note: "recorded_support_channel" }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
