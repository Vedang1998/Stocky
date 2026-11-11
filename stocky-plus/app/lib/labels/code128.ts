/**
 * Code 128 encoding for label previews and browser printing. Zebra printers
 * encode the same values themselves; this produces the bars a browser draws.
 */

// Bar and space widths of symbol values 0-105, each 11 modules wide.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232",
] as const;
const STOP_PATTERN = "2331112";

const CODE_C_TO_B = 100;
const START_B = 104;
const START_C = 105;

const PRINTABLE_ASCII = /^[ -~]+$/;
const DIGITS = /^\d+$/;

/** Whether a value can be encoded exactly (printable ASCII, not empty). */
export function isCode128Encodable(value: string): boolean {
  return PRINTABLE_ASCII.test(value);
}

function digitPairs(digits: string): number[] {
  const values: number[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    values.push(Number(digits.slice(i, i + 2)));
  }
  return values;
}

function charValues(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0) - 32);
}

/**
 * Symbol values including start and check symbol, without the stop symbol.
 * All-digit values use the double-density digit set; a trailing odd digit and
 * everything else use the full ASCII set.
 */
export function code128Symbols(value: string): number[] {
  if (!isCode128Encodable(value)) {
    throw new RangeError("Code 128 can only encode printable ASCII");
  }

  let symbols: number[];
  if (DIGITS.test(value) && value.length >= 4) {
    const even = value.length - (value.length % 2);
    symbols = [START_C, ...digitPairs(value.slice(0, even))];
    if (even < value.length) {
      symbols.push(CODE_C_TO_B, ...charValues(value.slice(even)));
    }
  } else {
    const leadingDigits = /^\d*/.exec(value)?.[0].length ?? 0;
    const pairedDigits = leadingDigits - (leadingDigits % 2);
    // Switching sets costs one symbol, so it pays from six digits up.
    symbols =
      pairedDigits >= 6
        ? [
            START_C,
            ...digitPairs(value.slice(0, pairedDigits)),
            CODE_C_TO_B,
            ...charValues(value.slice(pairedDigits)),
          ]
        : [START_B, ...charValues(value)];
  }

  const checksum =
    symbols.reduce((sum, symbol, index) => sum + symbol * Math.max(index, 1), 0) % 103;
  return [...symbols, checksum];
}

/** Total width in modules, including the stop symbol, excluding quiet zones. */
export function code128ModuleCount(value: string): number {
  return code128Symbols(value).length * 11 + 13;
}

/**
 * Alternating bar and space widths in modules, starting with a bar.
 */
export function code128Widths(value: string): number[] {
  const pattern =
    code128Symbols(value)
      .map((symbol) => PATTERNS[symbol])
      .join("") + STOP_PATTERN;
  return Array.from(pattern, Number);
}

// Exported for the test that checks the table itself.
export const CODE128_PATTERNS: readonly string[] = [...PATTERNS, STOP_PATTERN];
