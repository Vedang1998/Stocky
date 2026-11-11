import { describe, expect, it, vi } from "vitest";
import { submitOnEnter } from "./submit-on-enter";

function keyDown(overrides: {
  key?: string;
  tagName?: string;
  isComposing?: boolean;
}) {
  const event = {
    key: overrides.key ?? "Enter",
    target: { tagName: overrides.tagName ?? "S-TEXT-FIELD" },
    currentTarget: { requestSubmit: vi.fn() },
    nativeEvent: { isComposing: overrides.isComposing ?? false },
    preventDefault: vi.fn(),
  };
  submitOnEnter(event);
  return event;
}

describe("submitOnEnter", () => {
  it.each(["S-TEXT-FIELD", "S-NUMBER-FIELD", "S-SEARCH-FIELD", "s-text-field"])(
    "submits the form when Enter is pressed in %s",
    (tagName) => {
      const event = keyDown({ tagName });
      expect(event.currentTarget.requestSubmit).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["another key", { key: "a" }],
    ["Enter on a button, which already submits", { tagName: "S-BUTTON" }],
    ["Enter in a select", { tagName: "S-SELECT" }],
    ["Enter that confirms an IME composition", { isComposing: true }],
  ])("leaves %s alone", (_label, overrides) => {
    const event = keyDown(overrides);
    expect(event.currentTarget.requestSubmit).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("ignores a key event with no element target", () => {
    const event = {
      key: "Enter",
      target: null,
      currentTarget: { requestSubmit: vi.fn() },
      preventDefault: vi.fn(),
    };
    submitOnEnter(event);
    expect(event.currentTarget.requestSubmit).not.toHaveBeenCalled();
  });
});
