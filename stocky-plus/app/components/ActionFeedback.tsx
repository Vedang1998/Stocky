export interface ActionProblem {
  title: string;
  message: string;
}

export interface ActionFeedbackData {
  error?: string;
  notice?: string;
  problems?: ActionProblem[];
  /** Plain explanations, one per item, e.g. the input lines that could not be read. */
  details?: string[];
}

/** A long paste can be wrong on every line; the first screenful is enough to act on. */
const MAX_DETAILS_SHOWN = 20;

/** The outcome of a route action, read defensively from whatever the action returned. */
export function readActionFeedback(data: unknown): ActionFeedbackData {
  if (!data || typeof data !== "object") return {};
  const { error, notice, problems, details } = data as Record<string, unknown>;
  return {
    error: typeof error === "string" && error ? error : undefined,
    notice: typeof notice === "string" && notice ? notice : undefined,
    problems: Array.isArray(problems) ? (problems as ActionProblem[]) : [],
    details: Array.isArray(details)
      ? details.filter((detail): detail is string => typeof detail === "string")
      : [],
  };
}

/**
 * Banner for the result of the last action on a page: what went wrong, with
 * the lines Shopify refused when there are any, or a short confirmation.
 */
export function ActionFeedback({
  data,
  errorHeading,
}: {
  data: unknown;
  errorHeading: string;
}) {
  const {
    error,
    notice,
    problems = [],
    details = [],
  } = readActionFeedback(data);

  if (error) {
    const hidden = details.length - MAX_DETAILS_SHOWN;
    return (
      <s-banner tone="critical" heading={errorHeading}>
        <s-paragraph>{error}</s-paragraph>
        {(problems.length > 0 || details.length > 0) && (
          <s-unordered-list>
            {problems.map((problem, index) => (
              <s-list-item key={`${problem.title}-${index}`}>
                {problem.title}: {problem.message}
              </s-list-item>
            ))}
            {details.slice(0, MAX_DETAILS_SHOWN).map((detail, index) => (
              <s-list-item key={`detail-${index}`}>{detail}</s-list-item>
            ))}
            {hidden > 0 && (
              <s-list-item>
                …and {hidden} more. Fix these first, then submit again.
              </s-list-item>
            )}
          </s-unordered-list>
        )}
      </s-banner>
    );
  }
  if (notice) {
    return <s-banner tone="success" heading={notice} />;
  }
  return null;
}
