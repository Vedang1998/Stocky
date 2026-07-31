#!/usr/bin/env tsx
/**
 * CI entry: fail on tenant-access architecture violations.
 */
import { assertNoViolations, scanRepository } from "./scan";

const result = scanRepository();
console.log(
  JSON.stringify(
    {
      event: "tenant_access_audit",
      scannedFiles: result.scannedFiles.length,
      findings: result.findings.length,
      violations: result.violations.length,
      exceptionsUsed: result.exceptionsUsed,
      modelsCovered: result.modelsCovered.length,
    },
    null,
    2,
  ),
);

try {
  assertNoViolations(result);
  console.log(JSON.stringify({ event: "tenant_access_audit_ok" }));
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
