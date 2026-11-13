/**
 * Exact rational numbers for forecast arithmetic.
 *
 * Velocity is units / days, so most intermediate values are fractions.
 * Keeping them exact means a suggested quantity never changes because of
 * binary floating point (e.g. 0.1 + 0.2), and every displayed number is
 * rounded exactly once, at formatting time.
 */

export type Rational = { readonly num: bigint; readonly den: bigint };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

function toBigInt(value: number | bigint, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${field} must be a safe integer, got ${value}`);
  }
  return BigInt(value);
}

export function rational(
  num: number | bigint,
  den: number | bigint = 1,
): Rational {
  let n = toBigInt(num, "numerator");
  let d = toBigInt(den, "denominator");
  if (d === 0n) throw new RangeError("Rational denominator cannot be zero");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = gcd(n, d);
  return divisor > 1n
    ? { num: n / divisor, den: d / divisor }
    : { num: n, den: d };
}

export function add(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mul(a: Rational, b: Rational): Rational {
  return rational(a.num * b.num, a.den * b.den);
}

export function div(a: Rational, b: Rational): Rational {
  if (b.num === 0n) throw new RangeError("Division by zero");
  return rational(a.num * b.den, a.den * b.num);
}

export function sign(a: Rational): -1 | 0 | 1 {
  return a.num === 0n ? 0 : a.num > 0n ? 1 : -1;
}

export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  return sign(sub(a, b));
}

export function max(a: Rational, b: Rational): Rational {
  return compare(a, b) >= 0 ? a : b;
}

/** Smallest integer >= value. */
export function ceil(a: Rational): bigint {
  const q = a.num / a.den;
  const r = a.num % a.den;
  return r > 0n ? q + 1n : q;
}

/** Converts an integer-valued result back to a JS number, guarding range. */
export function toSafeInteger(value: bigint, field: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${field} is outside the safe integer range`);
  }
  return n;
}

/**
 * Decimal string with exactly `places` fraction digits, rounding half away
 * from zero. Display only; never parse the result back into arithmetic.
 */
export function toFixed(a: Rational, places: number): string {
  if (!Number.isInteger(places) || places < 0 || places > 12) {
    throw new RangeError("places must be an integer between 0 and 12");
  }
  const negative = a.num < 0n;
  const absNum = negative ? -a.num : a.num;
  const scale = 10n ** BigInt(places);
  const scaled = absNum * scale;
  let units = scaled / a.den;
  if ((scaled % a.den) * 2n >= a.den) units += 1n;
  const digits = units.toString().padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const fraction = places > 0 ? `.${digits.slice(digits.length - places)}` : "";
  const isZero = units === 0n;
  return `${negative && !isZero ? "-" : ""}${whole}${fraction}`;
}
