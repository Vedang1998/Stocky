#!/usr/bin/env node
import path from "node:path";
import { createGithubClient } from "../lib/github-client.js";
import { runDispatchPhase } from "../lib/dispatch-cli.js";
import { assertNoProductionTestHooks } from "../lib/production-hooks.js";

const phase = process.argv.includes("--phase")
  ? process.argv[process.argv.indexOf("--phase") + 1]
  : "validate";

const stateDir =
  process.env.STOCKY_REVIEW_STATE_DIR ||
  path.join(process.env.RUNNER_TEMP || "/tmp", "stocky-review");

const hooks = assertNoProductionTestHooks(process.env);
if (!hooks.ok) {
  console.error(`${hooks.code}: ${hooks.message}`);
  process.exit(2);
}

const github = process.env.GITHUB_TOKEN ? createGithubClient({ token: process.env.GITHUB_TOKEN }) : null;

try {
  const result = await runDispatchPhase({
    phase,
    env: process.env,
    github,
    stateDir,
  });
  if (result && result.ok === false) process.exit(2);
} catch (err) {
  console.error(err?.message || err);
  process.exit(1);
}
