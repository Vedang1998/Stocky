/**
 * Marks the option a select starts on. A Polaris select ignores a `value`
 * attribute in server-rendered markup, and picks its first option unless one
 * is marked.
 */
export const chosen = (isChosen: boolean) =>
  isChosen ? { selected: true } : {};
