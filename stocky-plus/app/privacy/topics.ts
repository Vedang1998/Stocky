/** Shopify's mandatory compliance webhook topics. */
export const COMPLIANCE_TOPICS = [
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const;

export type ComplianceTopic = (typeof COMPLIANCE_TOPICS)[number];

const TOPIC_BY_LIBRARY_KEY: ReadonlyMap<string, ComplianceTopic> = new Map(
  COMPLIANCE_TOPICS.map((topic) => [
    topic.toUpperCase().replace(/[/.]/g, "_"),
    topic,
  ]),
);

/**
 * `authenticate.webhook` reports the topic in the library's storage form
 * (SHOP_REDACT); the header and the app configuration use shop/redact.
 * Both resolve here, anything else is not a compliance topic.
 */
export function resolveComplianceTopic(topic: string): ComplianceTopic | null {
  if ((COMPLIANCE_TOPICS as readonly string[]).includes(topic)) {
    return topic as ComplianceTopic;
  }
  return TOPIC_BY_LIBRARY_KEY.get(topic) ?? null;
}
