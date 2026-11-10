import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const login = vi.fn();
vi.mock("../../shopify.server", () => ({ login: (request: Request) => login(request) }));

const { loader } = await import("./route");

const run = (url: string) =>
  loader({ request: new Request(url), params: {}, context: {} } as never);

describe("auth login loader", () => {
  beforeEach(() => {
    login.mockReset();
  });

  it("hands a shop parameter to the Shopify login redirect", async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { Location: "https://admin.shopify.com/store/test-store/oauth/install?client_id=k" },
    });
    login.mockImplementation(() => {
      throw redirect;
    });

    const thrown = await run(
      "https://app.example.com/auth/login?shop=test-store.myshopify.com",
    ).catch((error: unknown) => error);

    expect(thrown).toBe(redirect);
    expect(login).toHaveBeenCalledOnce();
  });

  it("shows guidance, not an error, when there is no shop parameter", async () => {
    login.mockResolvedValue({});

    await expect(run("https://app.example.com/auth/login")).resolves.toEqual({
      invalidShop: false,
    });
  });

  it("flags an invalid shop parameter", async () => {
    login.mockResolvedValue({ shop: LoginErrorType.InvalidShop });

    await expect(
      run("https://app.example.com/auth/login?shop=not a shop"),
    ).resolves.toEqual({ invalidShop: true });
  });
});
