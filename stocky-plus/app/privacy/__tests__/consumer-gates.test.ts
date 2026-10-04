import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("PR7 B consumer gates", () => {
  it("R1-01 remains an explicit cross-origin adoption gate (no widened CORS)", () => {
    const escalation = readFileSync(
      path.join(ROOT, "app/routes/app.platform.privacy.escalation.tsx"),
      "utf8",
    );
    const replay = readFileSync(
      path.join(ROOT, "app/routes/app.platform.replay.tsx"),
      "utf8",
    );
    expect(escalation).toMatch(/R1-01/);
    expect(replay).toMatch(/R1-01/);
    expect(escalation).not.toMatch(/Access-Control-Allow-Origin/);
    expect(replay).not.toMatch(/Access-Control-Allow-Origin/);
  });

  it("shopify.server still does not enable useOnlineTokens", () => {
    const text = readFileSync(path.join(ROOT, "app/shopify.server.ts"), "utf8");
    expect(text).not.toMatch(/useOnlineTokens\s*:\s*true/);
  });
});
