/**
 * Strict server-side parsing of purchasing form fields.
 *
 * Every reader records a merchant-readable error against the field name and
 * returns null instead of guessing. Nothing is silently rounded, clamped or
 * defaulted: callers check `ok` before using any value.
 */
import { Prisma } from "@prisma/client";

export type FieldErrors = Record<string, string>;

type Presence = { required?: boolean };

const INTEGER_PATTERN = /^[+-]?\d+$/;
const DECIMAL_PATTERN = /^[+-]?(\d+)(?:\.(\d+))?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class FormReader {
  readonly errors: FieldErrors = {};

  constructor(private readonly form: FormData) {}

  get ok(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  fail(field: string, message: string): null {
    if (!(field in this.errors)) this.errors[field] = message;
    return null;
  }

  has(name: string): boolean {
    return this.form.has(name);
  }

  /** Raw trimmed value; empty string and missing both mean "not provided". */
  raw(name: string): string | null {
    const value = this.form.get(name);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  text(
    name: string,
    opts: Presence & { maxLength: number; label?: string },
  ): string | null {
    const value = this.raw(name);
    const label = opts.label ?? "This field";
    if (value === null) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    if (value.length > opts.maxLength) {
      return this.fail(
        name,
        `${label} must be ${opts.maxLength} characters or fewer.`,
      );
    }
    return value;
  }

  integer(
    name: string,
    opts: Presence & { min: number; max: number; label?: string },
  ): number | null {
    const value = this.raw(name);
    const label = opts.label ?? "Value";
    if (value === null) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    if (!INTEGER_PATTERN.test(value)) {
      return this.fail(name, `${label} must be a whole number.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      return this.fail(name, `${label} is too large.`);
    }
    if (parsed < opts.min || parsed > opts.max) {
      return this.fail(
        name,
        `${label} must be between ${opts.min} and ${opts.max}.`,
      );
    }
    return parsed;
  }

  decimal(
    name: string,
    opts: Presence & {
      scale: number;
      min: Prisma.Decimal | number;
      max: Prisma.Decimal | number;
      label?: string;
      minExclusive?: boolean;
    },
  ): Prisma.Decimal | null {
    const value = this.raw(name);
    const label = opts.label ?? "Value";
    if (value === null) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    const match = DECIMAL_PATTERN.exec(value);
    if (!match) {
      return this.fail(name, `${label} must be a number like 12.50.`);
    }
    const fraction = match[2] ?? "";
    if (fraction.length > opts.scale) {
      return this.fail(
        name,
        opts.scale === 0
          ? `${label} must be a whole number.`
          : `${label} can have at most ${opts.scale} decimal places.`,
      );
    }
    const parsed = new Prisma.Decimal(value);
    const min = new Prisma.Decimal(opts.min);
    const max = new Prisma.Decimal(opts.max);
    const belowMin = opts.minExclusive ? parsed.lte(min) : parsed.lt(min);
    if (belowMin || parsed.gt(max)) {
      return this.fail(
        name,
        opts.minExclusive
          ? `${label} must be greater than ${min.toString()} and at most ${max.toString()}.`
          : `${label} must be between ${min.toString()} and ${max.toString()}.`,
      );
    }
    return parsed;
  }

  percent(name: string, opts: Presence & { label?: string }) {
    return this.decimal(name, {
      ...opts,
      scale: 4,
      min: 0,
      max: 100,
      label: opts.label ?? "Percentage",
    });
  }

  /** Calendar date from `<s-date-field>` (YYYY-MM-DD), stored as UTC midnight. */
  date(name: string, opts: Presence & { label?: string }): Date | null {
    const value = this.raw(name);
    const label = opts.label ?? "Date";
    if (value === null) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    const parsed = parseCalendarDate(value);
    if (!parsed) {
      return this.fail(name, `${label} must be a valid date (YYYY-MM-DD).`);
    }
    return parsed;
  }

  choice<T extends string>(
    name: string,
    allowed: readonly T[],
    opts: Presence & {
      label?: string;
      /** The value of a select's "not set" option, read as no choice. */
      none?: string;
    },
  ): T | null {
    const value = this.raw(name);
    const label = opts.label ?? "Value";
    if (value === null || (opts.none !== undefined && value === opts.none)) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    if (!(allowed as readonly string[]).includes(value)) {
      return this.fail(name, `${label} is not a valid option.`);
    }
    return value as T;
  }

  /** Checkbox / switch: present with any of on/true/1 means true. */
  checkbox(name: string): boolean {
    const value = this.raw(name);
    return value !== null && ["on", "true", "1", "yes"].includes(value.toLowerCase());
  }

  /** ISO 4217 alphabetic currency code. */
  currency(name: string, opts: Presence & { label?: string }): string | null {
    const value = this.raw(name);
    const label = opts.label ?? "Currency";
    if (value === null) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    const upper = value.toUpperCase();
    if (!/^[A-Z]{3}$/.test(upper)) {
      return this.fail(name, `${label} must be a 3-letter code such as USD.`);
    }
    return upper;
  }

  /** ISO 3166-1 alpha-2 country code. */
  country(name: string, opts: Presence & { label?: string }): string | null {
    const value = this.raw(name);
    const label = opts.label ?? "Country";
    if (value === null) {
      return opts.required ? this.fail(name, `${label} is required.`) : null;
    }
    const upper = value.toUpperCase();
    if (!/^[A-Z]{2}$/.test(upper)) {
      return this.fail(name, `${label} must be a 2-letter code such as US.`);
    }
    return upper;
  }

  email(name: string, opts: Presence & { label?: string }): string | null {
    const value = this.text(name, { ...opts, maxLength: 254 });
    if (value === null) return null;
    // Deliberately permissive: one @, a dot in the domain, no whitespace.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return this.fail(name, `${opts.label ?? "Email"} is not a valid address.`);
    }
    return value;
  }

  url(name: string, opts: Presence & { label?: string }): string | null {
    const value = this.text(name, { ...opts, maxLength: 512 });
    if (value === null) return null;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return this.fail(name, `${opts.label ?? "Website"} must start with https://`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return this.fail(name, `${opts.label ?? "Website"} must start with https://`);
    }
    return parsed.toString();
  }
}

export function parseCalendarDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** YYYY-MM-DD for a DATE column value (stored as UTC midnight). */
export function formatCalendarDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in the merchant's IANA time zone, or null when unknown. */
export function todayInTimeZone(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = get("year");
    const month = get("month");
    const day = get("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}
