#!/usr/bin/env tsx
/**
 * Restricted operator CLI. Default --dry-run. Token checked at use.
 * Does not reclaim D-scratch or mark erasure complete.
 */
import { operatorInspectPrivacyRequest } from "../../app/privacy/operator-resolve.server";

async function main(): Promise<void> {
  const dryRun = !process.argv.includes("--apply");
  const requestId = process.argv.find((arg) => arg.startsWith("--request="))?.slice(10);
  const token = process.env.STOCKY_PRIVACY_OPERATOR_TOKEN ?? "";
  if (!requestId) {
    throw new Error("usage: resolve-escalation --request=<id> [--apply]");
  }
  const inspected = await operatorInspectPrivacyRequest({
    requestId,
    operatorToken: token,
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ dryRun, ...inspected }, null, 2));
  if (!dryRun) {
    throw new Error("apply_not_implemented_leave_escalated");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
