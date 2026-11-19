/**
 * Shared shapes for the reports suite.
 *
 * A report is a list of typed rows plus column definitions. The same columns
 * drive the on-screen table, sorting, filtering and the CSV export, so a number
 * can never be computed one way on screen and another way in a download.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { Decimal } from "../analytics/money";
import type { LocalDate } from "../analytics/shop-calendar";

export type ColumnKind = "text" | "integer" | "money" | "percent" | "date";

export type CellValue = string | number | Decimal | null;

export type ReportColumn<Row> = {
  key: string;
  label: string;
  kind: ColumnKind;
  /** How the value is produced, shown under "How these numbers are calculated". */
  definition?: string;
  value: (row: Row) => CellValue;
};

/** A select filter whose choices come from the rows themselves. */
export type ReportFacet<Row> = {
  key: string;
  label: string;
  value: (row: Row) => string | null;
};

/** A report-specific setting with a fixed list of choices. */
export type ReportOption = {
  key: string;
  label: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  defaultValue: string;
};

export type ReportTile = {
  label: string;
  value: string;
  detail?: string;
};

export type ReportNoticeTone = "info" | "warning" | "critical";

export type ReportNotice = {
  tone: ReportNoticeTone;
  heading: string;
  body: string;
};

export type SortDirection = "asc" | "desc";

export type ReportSort = { key: string; direction: SortDirection };

export type ReportDateRange = {
  preset: string;
  startLocalDate: LocalDate;
  endLocalDate: LocalDate;
};

export type ReportRequest = {
  range: ReportDateRange;
  /** Report options by key, already validated against their choices. */
  options: Readonly<Record<string, string>>;
};

export type ReportContext = {
  db: TenantDb;
  timeZone: string;
  currencyCode: string;
  installedAt: Date;
  /** Shop-local date of the request. */
  today: LocalDate;
  now: Date;
};

export type ReportData<Row> = {
  columns: ReadonlyArray<ReportColumn<Row>>;
  rows: Row[];
  /** Stable identity of a row, used as its React key. */
  rowKey: (row: Row) => string;
  defaultSort: ReportSort;
  facets: ReadonlyArray<ReportFacet<Row>>;
  /** Column keys the free-text search matches against. */
  searchKeys: readonly string[];
  /** Headline figures for the rows on screen, after filters and search. */
  summarize: (rows: readonly Row[]) => ReportTile[];
  notices: ReportNotice[];
  /** Policy and method notes that apply to the whole report. */
  methodNotes: string[];
  /**
   * The most recent Shopify change the figures reflect, or null when nothing
   * has been synced yet. "live" marks a report over records made in this app,
   * which are read as they are now.
   */
  dataAsOf: Date | "live" | null;
};

export type ReportGroup = "Sales" | "Inventory";

export type ReportDefinition<Row> = {
  id: string;
  title: string;
  description: string;
  group: ReportGroup;
  usesDateRange: boolean;
  /** Range shown until the merchant picks one; the last 30 complete days when unset. */
  defaultRangePreset?: string;
  options: readonly ReportOption[];
  load: (
    context: ReportContext,
    request: ReportRequest,
  ) => Promise<ReportData<Row>>;
};
