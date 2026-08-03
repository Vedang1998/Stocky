#!/usr/bin/env tsx
/**
 * Guard prisma migrate dev / db push after PR 3 enforcement (F-PR3-07).
 * These commands would DROP composite FKs, Shop FKs, and NOT NULL constraints.
 */
import { execFileSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "migrate" && mode !== "push") {
  console.error("Usage: guard-prisma-destructive.ts migrate|push");
  process.exit(1);
}

if (process.env.STOCKY_ALLOW_DESTRUCTIVE_PRISMA === "1") {
  const args =
    mode === "migrate"
      ? ["prisma", "migrate", "dev", ...process.argv.slice(3)]
      : ["prisma", "db", "push", ...process.argv.slice(3)];
  execFileSync("npx", args, { stdio: "inherit" });
  process.exit(0);
}

console.error(
  JSON.stringify({
    event: "tenant_prisma_destructive_blocked",
    command: mode === "migrate" ? "prisma migrate dev" : "prisma db push",
    reason:
      "After PR 3 enforcement, migrate dev / db push would DROP composite tenant FKs, Shop FKs, and shopId NOT NULL. Use Prisma migrations for expand-compatible schema only; apply enforcement via tenant:enforcement:apply. Set STOCKY_ALLOW_DESTRUCTIVE_PRISMA=1 only on disposable non-enforced databases.",
  }),
);
process.exit(1);
