/**
 * CI wrapper for the privacy zero-name-filter fail-closed probe.
 *
 * Raw `vitest -t this-pattern-matches-zero-tests-on-purpose` must exit 1 with
 * the ci-guard message. GitHub Actions treats that as job failure, so this
 * process exits 0 only when that intended fail-closed actually happened.
 * Vacuous vitest success, missing guard text, or any other exit is failure.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const PATTERN = "this-pattern-matches-zero-tests-on-purpose";
const GUARD = "[ci-guard] testNamePattern";
const VITEST = path.join(APP_ROOT, "node_modules/vitest/vitest.mjs");

const result = spawnSync(
  process.execPath,
  [VITEST, "run", "--config", "vitest.privacy.config.ts", "-t", PATTERN],
  {
    cwd: APP_ROOT,
    encoding: "utf8",
    env: process.env,
  },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);
if (result.error) {
  process.stderr.write(`privacy_zero_name_filter_spawn_failed:${result.error.message}\n`);
  process.exit(1);
}
if (result.status === 0) {
  process.stderr.write("privacy_zero_name_filter_did_not_fail_closed\n");
  process.exit(1);
}
if (result.status !== 1) {
  process.stderr.write(
    `privacy_zero_name_filter_unexpected_exit:${String(result.status)}\n`,
  );
  process.exit(1);
}
if (!output.includes(GUARD)) {
  process.stderr.write("privacy_zero_name_filter_missing_ci_guard\n");
  process.exit(1);
}
process.exit(0);
