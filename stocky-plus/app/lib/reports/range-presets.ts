/** The date ranges a report offers. Browser-safe: the filter form reads these. */
export const DEFAULT_RANGE_PRESET = "last_30_days";
export const CUSTOM_RANGE_PRESET = "custom";

export const RANGE_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "last_365_days", label: "Last 365 days" },
  { value: "month_to_date", label: "Month to date" },
  { value: "last_month", label: "Last month" },
  { value: CUSTOM_RANGE_PRESET, label: "Custom" },
];
