export interface ActionProblem {
  title: string;
  message: string;
}

export interface ActionFeedbackData {
  error?: string;
  notice?: string;
  problems?: ActionProblem[];
}

/** The outcome of a route action, read defensively from whatever the action returned. */
export function readActionFeedback(data: unknown): ActionFeedbackData {
  if (!data || typeof data !== "object") return {};
  const { error, notice, problems } = data as Record<string, unknown>;
  return {
    error: typeof error === "string" && error ? error : undefined,
    notice: typeof notice === "string" && notice ? notice : undefined,
    problems: Array.isArray(problems) ? (problems as ActionProblem[]) : [],
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
  const { error, notice, problems = [] } = readActionFeedback(data);

  if (error) {
    return (
      <s-banner tone="critical" heading={errorHeading}>
        <s-paragraph>{error}</s-paragraph>
        {problems.length > 0 && (
          <s-unordered-list>
            {problems.map((problem, index) => (
              <s-list-item key={`${problem.title}-${index}`}>
                {problem.title}: {problem.message}
              </s-list-item>
            ))}
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
