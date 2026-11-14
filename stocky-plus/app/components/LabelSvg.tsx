import { code128Widths } from "../lib/labels/code128";
import type { LabelBarcodeElement, LabelLayout } from "../lib/labels/layout";

/** Bars as one path: alternating bar and space widths, starting with a bar. */
function barcodePath(element: LabelBarcodeElement): string {
  let x = element.x;
  let path = "";
  for (const [index, width] of code128Widths(element.value).entries()) {
    const dots = width * element.moduleWidth;
    if (index % 2 === 0) path += `M${x} ${element.y}h${dots}v${element.height}h${-dots}z`;
    x += dots;
  }
  return path;
}

const ANCHOR = { left: "start", center: "middle", right: "end" } as const;

/**
 * One label drawn from its layout, in printer dots. The browser prints this
 * and the page previews it, so both show what the ZPL writer was told.
 */
export function LabelSvg({
  layout,
  widthIn,
  heightIn,
  className,
}: {
  layout: LabelLayout;
  /** Physical size, for printing; omit to let CSS size the preview. */
  widthIn?: number;
  heightIn?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${layout.widthDots} ${layout.heightDots}`}
      width={widthIn !== undefined ? `${widthIn}in` : undefined}
      height={heightIn !== undefined ? `${heightIn}in` : undefined}
      role="img"
      aria-label="Label"
    >
      <rect width={layout.widthDots} height={layout.heightDots} fill="#fff" />
      {layout.elements.map((element, index) => {
        if (element.kind === "barcode") {
          return <path key={index} d={barcodePath(element)} fill="#000" />;
        }
        const x =
          element.align === "left"
            ? element.x
            : element.align === "center"
              ? element.x + element.width / 2
              : element.x + element.width;
        return (
          <text
            key={index}
            x={x}
            y={element.y + element.fontHeight * 0.8}
            fontSize={element.fontHeight * 0.95}
            fontFamily="Helvetica, Arial, sans-serif"
            textAnchor={ANCHOR[element.align]}
            fill="#000"
          >
            {element.text}
          </text>
        );
      })}
    </svg>
  );
}
