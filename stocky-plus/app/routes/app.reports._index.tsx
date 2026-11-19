import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { REPORT_GROUPS, listReports } from "../lib/reports/registry.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminTenant({ request });
  const reports = listReports();
  return {
    groups: REPORT_GROUPS.map((group) => ({
      name: group,
      reports: reports
        .filter((report) => report.group === group)
        .map(({ id, title, description }) => ({ id, title, description })),
    })),
  };
};

export default function Reports() {
  const { groups } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Reports">
      {groups.map((group) => (
        <s-section key={group.name} heading={group.name}>
          <s-stack direction="block" gap="base">
            {group.reports.map((report) => (
              <s-stack key={report.id} direction="block" gap="small-300">
                <s-link href={`/app/reports/${report.id}`}>
                  {report.title}
                </s-link>
                <s-text color="subdued">{report.description}</s-text>
              </s-stack>
            ))}
          </s-stack>
        </s-section>
      ))}

      <s-section slot="aside" heading="Where the numbers come from">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Every report is calculated from your Shopify orders, products and
            inventory levels. Days are calendar days in your store&apos;s time
            zone, and money is in your store currency.
          </s-paragraph>
          <s-paragraph>
            Each report explains its own columns, and every report can be
            downloaded as a CSV file with the same filters and sort order you
            see on screen.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
