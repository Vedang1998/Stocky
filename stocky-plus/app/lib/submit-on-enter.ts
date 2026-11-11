const ENTER_FIELDS = new Set([
  "s-text-field",
  "s-number-field",
  "s-search-field",
]);

interface EnterKeyEvent {
  key: string;
  target: unknown;
  currentTarget: { requestSubmit: () => void };
  nativeEvent?: { isComposing?: boolean };
  preventDefault: () => void;
}

/**
 * `onKeyDown` for a form whose fields are Polaris web components. Those fields
 * do not submit their form on Enter the way a native input does, and a barcode
 * scanner ends every code with Enter.
 */
export function submitOnEnter(event: EnterKeyEvent): void {
  if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
  const tagName = (event.target as { tagName?: unknown } | null)?.tagName;
  if (typeof tagName !== "string" || !ENTER_FIELDS.has(tagName.toLowerCase())) {
    return;
  }
  event.preventDefault();
  event.currentTarget.requestSubmit();
}
