import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type RouteEntry = { file: string; children?: RouteEntry[] };

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

/** The route tree exactly as the build sees it (`react-router routes --json`). */
function routeFiles(): string[] {
  const require = createRequire(import.meta.url);
  const cli = path.join(
    path.dirname(require.resolve("@react-router/dev/package.json")),
    "bin.js",
  );
  const output = execFileSync(process.execPath, [cli, "routes", "--json"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  const files: string[] = [];
  const walk = (entries: RouteEntry[]) => {
    for (const entry of entries) {
      files.push(entry.file);
      walk(entry.children ?? []);
    }
  };
  walk(JSON.parse(output) as RouteEntry[]);
  return files;
}

describe("route manifest", () => {
  const files = routeFiles();

  it("registers the app's routes", () => {
    expect(files).toContain("root.tsx");
    expect(files).toContain("routes/webhooks.catalog-facts.tsx");
    expect(files).toContain("routes/webhooks.compliance.tsx");
  });

  it("contains no test files", () => {
    expect(files.filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))).toEqual(
      [],
    );
  });
});
