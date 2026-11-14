/**
 * ZPL for Zebra-compatible label printers, written from a label layout.
 *
 * Label data is merchant-controlled. Text reaches the printer only through
 * labelText, which removes the characters that start a printer command, and
 * a barcode value only when Code 128 can encode it exactly.
 */
import { code128Segments } from "./code128";
import {
  labelText,
  layoutLabel,
  type LabelContent,
  type LabelLayout,
  type LabelTextElement,
} from "./layout";
import type { LabelTemplate } from "./template";

/** Copies one print job may ask for; the printer's own limit is far higher. */
export const MAX_LABEL_COPIES = 5000;

function textField(element: LabelTextElement): string {
  const font = `^A0N,${element.fontHeight},${element.fontHeight}`;
  const text = labelText(element.text);
  if (element.align === "left") {
    return `^FO${element.x},${element.y}${font}^FD${text}^FS`;
  }
  // A field block aligns the text inside its width. Inside one, a backslash
  // starts a control sequence, and the closing "\&" makes the printer measure
  // the line before aligning it.
  const justify = element.align === "center" ? "C" : "R";
  const escaped = text.replace(/\\/g, "\\\\");
  return `^FO${element.x},${element.y}${font}^FB${element.width},1,0,${justify},0^FD${escaped}\\&^FS`;
}

/**
 * Barcode data with the symbol sets spelled out, so the printer produces the
 * same symbol, at the same width, as the preview. ">" introduces a set change
 * in this mode and is itself written ">0".
 */
function code128FieldData(value: string): string {
  return code128Segments(value)
    .map((segment, index) => {
      if (segment.set === "C") return `>;${segment.text}`;
      const text = segment.text.replace(/>/g, ">0");
      return `${index === 0 ? ">:" : ">6"}${text}`;
    })
    .join("");
}

/**
 * One label format printed `copies` times. ^CI28 makes the printer read the
 * text as UTF-8; without it, any character outside ASCII prints as garbage.
 */
export function labelZpl(layout: LabelLayout, copies: number): string {
  if (!Number.isInteger(copies) || copies < 1 || copies > MAX_LABEL_COPIES) {
    throw new RangeError(`copies must be a whole number from 1 to ${MAX_LABEL_COPIES}`);
  }
  const fields = layout.elements.map((element) =>
    element.kind === "text"
      ? textField(element)
      : `^FO${element.x},${element.y}^BY${element.moduleWidth}` +
        `^BCN,${element.height},N,N,N,N^FD${code128FieldData(element.value)}^FS`,
  );
  return [
    "^XA",
    "^CI28",
    `^PW${layout.widthDots}`,
    `^LL${layout.heightDots}`,
    "^LH0,0",
    ...fields,
    `^PQ${copies}`,
    "^XZ",
  ].join("\n");
}

/** One print job for a whole run: each product's format, printed its own number of times. */
export function labelRunZpl(
  template: LabelTemplate,
  run: ReadonlyArray<{ content: LabelContent; count: number }>,
): string {
  return run.map(({ content, count }) => labelZpl(layoutLabel(template, content), count)).join("\n");
}
