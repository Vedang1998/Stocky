#!/usr/bin/env node
import { publishReviewBranch, refuseMainWrite, validateArtifact } from "../lib/publisher.js";

const action = process.argv[2] || "artifact";
if (action === "refuse-main") {
  const r = refuseMainWrite(process.argv[3] || "main");
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.ok ? 0 : 2);
}
if (action === "artifact") {
  const r = validateArtifact({
    name: process.argv[3] || "review-report.md",
    content: process.argv[4] || "# review\n",
    taskId: process.argv[5] || "task",
  });
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.ok ? 0 : 2);
}
if (action === "branch") {
  const r = publishReviewBranch({
    repoDir: process.argv[3],
    remote: process.argv[4] || "",
    subjectSha: process.argv[5],
    taskId: process.argv[6],
    attempt: process.argv[7] || "a1",
    artifactContent: process.argv[8] || "# review\n",
  });
  process.stdout.write(JSON.stringify(r) + "\n");
  process.exit(r.ok ? 0 : 2);
}
throw new Error(`unknown action ${action}`);
