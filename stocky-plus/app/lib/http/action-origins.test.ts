import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import {
  createRequestHandler,
  type ActionFunctionArgs,
  type ServerBuild,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedActionOrigins } from "../../../server/action-origins.mjs";

const APP_URL = "https://app.example";

describe("allowedActionOrigins", () => {
  it("lists the host of the app's public URL", () => {
    expect(allowedActionOrigins(APP_URL)).toEqual(["app.example"]);
    expect(allowedActionOrigins("https://app.example/")).toEqual([
      "app.example",
    ]);
    expect(allowedActionOrigins("http://localhost:3000")).toEqual([
      "localhost:3000",
    ]);
  });

  it.each([
    ["no URL", undefined],
    ["an empty URL", ""],
    ["a bare host", "app.example"],
    ["a wildcard", "*"],
    ["a non-web URL", "file:///etc/hosts"],
  ])("lists nothing for %s", (_case, appUrl) => {
    expect(allowedActionOrigins(appUrl)).toEqual([]);
  });
});

/**
 * The smallest server build React Router will serve: one UI route with an
 * action. The origin check under test is React Router's own; only the list
 * of allowed hosts is ours.
 */
function buildWithFormRoute(
  action: (args: ActionFunctionArgs) => unknown,
  allowed: string[],
): ServerBuild {
  return {
    entry: {
      module: {
        default: (_request: Request, status: number, headers: Headers) =>
          new Response("rendered", { status, headers }),
      },
    },
    routes: {
      "routes/form": {
        id: "routes/form",
        parentId: undefined,
        path: "form",
        module: { default: () => createElement("form"), action },
      },
    },
    assets: {
      entry: { imports: [], module: "" },
      routes: {},
      url: "",
      version: "test",
    },
    publicPath: "/",
    assetsBuildDirectory: "",
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "lazy", manifestPath: "/__manifest" },
    allowedActionOrigins: allowed,
  } as unknown as ServerBuild;
}

/**
 * A form post as the server receives it behind a TLS-terminating proxy: the
 * browser sent it to https://app.example, the server sees plain http.
 */
function forwardedPost(path: string, origin: string | null): Request {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    "x-forwarded-proto": "https",
  });
  if (origin !== null) headers.set("origin", origin);
  return new Request(`http://app.example${path}`, {
    method: "POST",
    headers,
    body: "name=Acme",
  });
}

describe("form posts behind a TLS-terminating proxy (#107)", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleError.mockClear();
  });

  function serve(allowed: string[]) {
    const action = vi.fn(() => ({ ok: true }));
    const handler = createRequestHandler(
      buildWithFormRoute(action, allowed),
      "production",
    );
    return { action, handler };
  }

  it.each([
    ["a document request", "/form"],
    ["a data request", "/form.data"],
  ])(
    "runs the action for %s from the app's own origin",
    async (_case, path) => {
      const { action, handler } = serve(allowedActionOrigins(APP_URL));

      const response = await handler(forwardedPost(path, APP_URL));

      expect(response.status).toBe(200);
      expect(action).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["another site", "https://evil.example", "/form"],
    ["another site, data request", "https://evil.example", "/form.data"],
    [
      "a host that only starts like ours",
      "https://app.example.evil.example",
      "/form",
    ],
    ["a host that only ends like ours", "https://evil-app.example", "/form"],
    ["our host on another port", "https://app.example:8443", "/form"],
    ["an opaque origin", "null", "/form"],
  ])("refuses a post from %s", async (_case, origin, path) => {
    const { action, handler } = serve(allowedActionOrigins(APP_URL));

    const response = await handler(forwardedPost(path, origin));

    expect(response.status).toBe(400);
    expect(action).not.toHaveBeenCalled();
  });

  // Why the list is needed at all: without it React Router compares the
  // browser's https origin with the http URL the server sees and refuses the
  // app's own forms. If this stops failing, the list may no longer be needed.
  it("is what lets the app's own origin through", async () => {
    const { action, handler } = serve([]);

    const response = await handler(forwardedPost("/form", APP_URL));

    expect(response.status).toBe(400);
    expect(action).not.toHaveBeenCalled();
  });
});

describe("where the allowed hosts are wired in", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("gives the dev server the host from SHOPIFY_APP_URL", async () => {
    vi.stubEnv("SHOPIFY_APP_URL", "https://tunnel.example");

    const config = (await import("../../../react-router.config")).default;

    expect(config.allowedActionOrigins).toEqual(["tunnel.example"]);
  });

  it("replaces the built value with the runtime host in production", async () => {
    // Unit tests run before the app is built, so server/build.mjs is loaded
    // from a copy that sits beside a stand-in for the React Router build.
    const dir = mkdtempSync(path.join(os.tmpdir(), "server-build-"));
    try {
      cpSync(
        fileURLToPath(new URL("../../../server", import.meta.url)),
        path.join(dir, "server"),
        { recursive: true },
      );
      mkdirSync(path.join(dir, "build/server"), { recursive: true });
      writeFileSync(
        path.join(dir, "build/server/index.js"),
        'export const allowedActionOrigins = ["build-machine.example"];\n' +
          'export const publicPath = "/";\n',
      );
      writeFileSync(path.join(dir, "package.json"), '{ "type": "module" }\n');
      vi.stubEnv("SHOPIFY_APP_URL", "https://deployed.example");

      const build = (await import(
        /* @vite-ignore */ pathToFileURL(path.join(dir, "server/build.mjs"))
          .href
      )) as { allowedActionOrigins: string[]; publicPath: string };

      expect(build.allowedActionOrigins).toEqual(["deployed.example"]);
      expect(build.publicPath).toBe("/");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("starts production through that build", () => {
    const { scripts } = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(scripts.start).toBe("react-router-serve ./server/build.mjs");
  });
});
