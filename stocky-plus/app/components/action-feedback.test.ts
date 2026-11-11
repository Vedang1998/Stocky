import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionFeedback, readActionFeedback } from "./ActionFeedback";

const render = (data: unknown) =>
  renderToStaticMarkup(
    createElement(ActionFeedback, { data, errorHeading: "Transfer issue" }),
  );

describe("ActionFeedback", () => {
  it("renders nothing before any action has run", () => {
    expect(render(undefined)).toBe("");
    expect(render({ ok: true })).toBe("");
  });

  it("shows an action error in a critical banner", () => {
    const html = render({ error: "Source and destination must differ" });
    expect(html).toContain('tone="critical"');
    expect(html).toContain('heading="Transfer issue"');
    expect(html).toContain("Source and destination must differ");
  });

  it("lists the lines Shopify refused under the error", () => {
    const html = render({
      error: "Shopify did not accept 1 of 2 changes.",
      problems: [
        { title: "White wine", message: "The item is not stocked here." },
      ],
    });
    expect(html).toContain("White wine: The item is not stocked here.");
  });

  it("escapes text that came back from Shopify or the merchant", () => {
    const html = render({
      error: "<img src=x onerror=alert(1)>",
      problems: [{ title: "<b>x</b>", message: "<script>1</script>" }],
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
  });

  it("confirms a successful action", () => {
    const html = render({ ok: true, notice: "Transfer cancelled." });
    expect(html).toContain('tone="success"');
    expect(html).toContain("Transfer cancelled.");
  });

  it("prefers the error when an action returns both", () => {
    const html = render({ error: "Nope", notice: "Done" });
    expect(html).toContain("Nope");
    expect(html).not.toContain("Done");
  });
});

describe("readActionFeedback", () => {
  it("ignores values of the wrong shape", () => {
    expect(readActionFeedback(null)).toEqual({});
    expect(readActionFeedback("error")).toEqual({});
    expect(readActionFeedback({ error: 5, notice: "", problems: "x" })).toEqual(
      { error: undefined, notice: undefined, problems: [] },
    );
  });
});
