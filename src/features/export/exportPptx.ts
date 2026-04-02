import PptxGenJS from "pptxgenjs";
import { useStore } from "@/shared/store";
import type {
  Presentation,
  Slide,
  SlideElement,
  TextElement,
  ShapeElement,
  ImageElement,
  LineElement,
  TableElement,
  TableCell,
  ChartElement,
  SlideBackground,
  GradientFill,
} from "@/features/canvas/types";
import { SLIDE_WIDTH, SLIDE_HEIGHT } from "@/features/canvas/types";

// Convert px (1920x1080) to inches for LAYOUT_WIDE (12192000 x 6858000 EMU = 40/3" x 7.5")
const PPTX_WIDE_WIDTH = 40 / 3; // 13.333... inches
const PPTX_WIDE_HEIGHT = 7.5;
const PX_TO_INCH_X = PPTX_WIDE_WIDTH / SLIDE_WIDTH;
const PX_TO_INCH_Y = PPTX_WIDE_HEIGHT / SLIDE_HEIGHT;

function pxToInchX(px: number): number {
  return px * PX_TO_INCH_X;
}
function pxToInchY(px: number): number {
  return px * PX_TO_INCH_Y;
}
function pxToInchW(px: number): number {
  return px * PX_TO_INCH_X;
}
function pxToInchH(px: number): number {
  return px * PX_TO_INCH_Y;
}

function fontSizeToPt(px: number): number {
  return px; // Our sizes are already in pt-equivalent units
}

function hexToRgb(hex: string): string {
  return hex.replace("#", "");
}

function exportBackground(
  pptxSlide: PptxGenJS.Slide,
  bg?: SlideBackground
) {
  if (!bg) return;
  if (bg.type === "solid") {
    pptxSlide.background = { color: hexToRgb(bg.color) };
  } else if (bg.type === "gradient" && bg.stops?.length >= 2) {
    // pptxgenjs doesn't support gradient fills natively.
    // Approximate with two overlapping full-slide rects: first stop color solid,
    // then second stop color semi-transparent on top.
    const color1 = hexToRgb(bg.stops[0].color);
    const color2 = hexToRgb(bg.stops[bg.stops.length - 1].color);
    pptxSlide.background = { color: color1 };
    pptxSlide.addShape("rect" as PptxGenJS.ShapeType, {
      x: 0, y: 0, w: "100%", h: "100%",
      fill: { color: color2, transparency: 50 },
    });
  } else if (bg.type === "image") {
    pptxSlide.background = { path: bg.src };
  }
}

function exportTextElement(
  pptxSlide: PptxGenJS.Slide,
  el: TextElement
) {
  const options: PptxGenJS.TextPropsOptions = {
    x: pxToInchX(el.x),
    y: pxToInchY(el.y),
    w: pxToInchW(el.width),
    h: pxToInchH(el.height),
    fontSize: fontSizeToPt(el.font_size ?? 32),
    fontFace: el.font_family || "Arial",
    color: hexToRgb(el.color ?? "FFFFFF"),
    bold: el.bold ?? false,
    italic: el.italic ?? false,
    underline: { style: el.underline ? "sng" : "none" } as unknown as PptxGenJS.TextPropsOptions["underline"],
    align: el.align ?? "left",
    // Defensive: .sfslides JSON may contain "center" from older files even though the TS type doesn't include it
    valign: (el.valign as string) === "center" ? "middle" : (el.valign ?? "top"),
    rotate: el.rotation ?? 0,
  };

  if (el.background) {
    options.fill = { color: hexToRgb(el.background) };
  }

  pptxSlide.addText(el.content || "", options);
}

function exportShapeElement(
  pptxSlide: PptxGenJS.Slide,
  el: ShapeElement
) {
  const shapeMap: Record<string, string> = {
    rect: "rect",
    rounded_rect: "roundRect",
    ellipse: "ellipse",
    triangle: "triangle",
    diamond: "diamond",
    star: "star5",
    hexagon: "hexagon",
    arrow_right: "rightArrow",
    arrow_left: "leftArrow",
  };

  const shapeName = shapeMap[el.shape] || "rect";
  const fillOption =
    el.fill === null || el.fill === undefined
      ? { type: "none" as const }
      : typeof el.fill === "string"
        ? { color: hexToRgb(el.fill) }
        : (() => {
            // GradientFill object - pptxgenjs doesn't support gradient fills natively,
            // so use the first stop color as a solid fill approximation.
            const grad = el.fill as GradientFill;
            return { color: hexToRgb(grad.stops?.[0]?.color || "8B5CF6") };
          })();

  pptxSlide.addShape(shapeName as PptxGenJS.ShapeType, {
    x: pxToInchX(el.x),
    y: pxToInchY(el.y),
    w: pxToInchW(el.width),
    h: pxToInchH(el.height),
    fill: fillOption,
    line: el.stroke
      ? {
          color: hexToRgb(el.stroke.color),
          width: el.stroke.width * PX_TO_INCH_X * 72, // convert px to points (1pt = 1/72 inch)
        }
      : undefined,
    rectRadius: el.corner_radius
      ? el.corner_radius * PX_TO_INCH_X
      : undefined,
    rotate: el.rotation ?? 0,
  });
}

function exportImageElement(
  pptxSlide: PptxGenJS.Slide,
  el: ImageElement
) {
  try {
    pptxSlide.addImage({
      path: el.src,
      x: pxToInchX(el.x),
      y: pxToInchY(el.y),
      w: pxToInchW(el.width),
      h: pxToInchH(el.height),
      rounding: el.corner_radius ? true : false,
      rotate: el.rotation ?? 0,
    });
  } catch (err) {
    console.warn("Failed to export image:", el.src, err);
  }
}

function exportLineElement(
  pptxSlide: PptxGenJS.Slide,
  el: LineElement
) {
  pptxSlide.addShape("line" as PptxGenJS.ShapeType, {
    x: pxToInchX(Math.min(el.x1, el.x2)),
    y: pxToInchY(Math.min(el.y1, el.y2)),
    w: pxToInchW(Math.abs(el.x2 - el.x1)),
    h: pxToInchH(Math.abs(el.y2 - el.y1)),
    line: {
      color: hexToRgb(el.color ?? "FFFFFF"),
      width: (el.line_width ?? 2) * PX_TO_INCH_X * 72, // convert px to points (1pt = 1/72 inch)
      dashType: el.dash ? "dash" : "solid",
    },
    rotate: el.rotation ?? 0,
  });
}

function exportTableElement(
  pptxSlide: PptxGenJS.Slide,
  el: TableElement
) {
  const cells = el.cells || [];
  const rows: PptxGenJS.TableRow[] = cells.map((row, ri) => {
    const isHeader = !!(el.header_row && ri === 0);
    return row.map((cell): PptxGenJS.TableCell => {
      const text = typeof cell === "string" ? cell : cell.text;
      const cellObj = typeof cell === "string" ? null : cell;
      return {
        text,
        options: {
          bold: cellObj?.bold ?? isHeader,
          color: hexToRgb(cellObj?.color ?? (isHeader ? (el.header_text_color ?? "FFFFFF") : (el.text_color ?? "FFFFFF"))),
          fill: { color: hexToRgb(cellObj?.background ?? (isHeader ? (el.header_color ?? "8B5CF6") : (el.cell_color ?? "1a1a2e"))) },
          fontSize: el.font_size ?? 14,
          fontFace: el.font_family || "Arial",
          align: cellObj?.align ?? "left",
          border: { type: "solid", color: hexToRgb(el.border_color ?? "2a2a3e"), pt: el.border_width ?? 1 },
        },
      };
    });
  });

  pptxSlide.addTable(rows, {
    x: pxToInchX(el.x),
    y: pxToInchY(el.y),
    w: pxToInchW(el.width),
    colW: Array(cells[0]?.length ?? 1).fill(pxToInchW(el.width) / (cells[0]?.length ?? 1)),
  });
}

function exportChartElement(
  pptxSlide: PptxGenJS.Slide,
  el: ChartElement
) {
  // Export chart as a text placeholder with data summary (pptxgenjs charts are complex)
  // For maximum compatibility, render as a shape + text description
  const summary = el.title ? `[Chart: ${el.title}]` : `[${el.chart_type} chart]`;
  pptxSlide.addShape("rect" as PptxGenJS.ShapeType, {
    x: pxToInchX(el.x),
    y: pxToInchY(el.y),
    w: pxToInchW(el.width),
    h: pxToInchH(el.height),
    fill: { color: hexToRgb(el.background ?? "1a1a2e") },
    rectRadius: 0.1,
  });
  pptxSlide.addText(summary, {
    x: pxToInchX(el.x),
    y: pxToInchY(el.y),
    w: pxToInchW(el.width),
    h: pxToInchH(el.height),
    fontSize: 14,
    color: "999999",
    align: "center",
    valign: "middle",
  });
}

function exportSlide(pptx: PptxGenJS, slide: Slide) {
  const pptxSlide = pptx.addSlide();

  exportBackground(pptxSlide, slide.background);

  const sorted = [...slide.elements].sort(
    (a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)
  );

  for (const el of sorted) {
    switch (el.type) {
      case "text":
      case "rich_text":
        exportTextElement(pptxSlide, el as TextElement);
        break;
      case "shape":
        exportShapeElement(pptxSlide, el as ShapeElement);
        break;
      case "image":
        exportImageElement(pptxSlide, el as ImageElement);
        break;
      case "line":
        exportLineElement(pptxSlide, el as LineElement);
        break;
      case "table":
        exportTableElement(pptxSlide, el as TableElement);
        break;
      case "chart":
        exportChartElement(pptxSlide, el as ChartElement);
        break;
    }
  }

  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }
}

export async function exportPresentation() {
  const { presentation } = useStore.getState();
  const fileName = (presentation.metadata?.title || "presentation") + ".pptx";

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333..." x 7.5" (12192000 x 6858000 EMU)
  pptx.author = presentation.metadata?.author || "SF-Slides";
  pptx.title = presentation.metadata?.title || "Presentation";

  for (const slide of presentation.slides) {
    exportSlide(pptx, slide);
  }

  // Try Tauri native save
  let savedViaTauri = false;
  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const path = await dialog.save({
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      defaultPath: fileName,
    });
    if (path) {
      const rawData = await pptx.write({ outputType: "uint8array" });
      // Ensure we have a proper Uint8Array (pptxgenjs may return ArrayBuffer)
      const data =
        rawData instanceof Uint8Array
          ? rawData
          : new Uint8Array(rawData as ArrayBuffer);
      const fs = await import("@tauri-apps/plugin-fs");
      await fs.writeFile(path, data);
      console.log("[Export] Saved PPTX via Tauri to:", path);
      savedViaTauri = true;
    }
  } catch (err) {
    console.warn("[Export] Tauri save failed, using browser fallback:", err);
  }

  // Browser fallback
  if (!savedViaTauri) {
    try {
      await pptx.writeFile({ fileName });
      console.log("[Export] Downloaded PPTX via browser:", fileName);
    } catch (err) {
      console.error("[Export] Browser download also failed:", err);
      // Last resort: manual blob download
      const rawData = await pptx.write({ outputType: "uint8array" });
      const data =
        rawData instanceof Uint8Array
          ? rawData
          : new Uint8Array(rawData as ArrayBuffer);
      const blob = new Blob([data as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("[Export] Downloaded PPTX via blob fallback");
    }
  }
}
