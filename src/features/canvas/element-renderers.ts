import * as fabric from "fabric";
import type {
  SlideElement,
  TextElement,
  RichTextElement,
  ImageElement,
  ShapeElement,
  LineElement,
  TableElement,
  TableCell,
  ChartElement,
  GradientFill,
} from "./types";

// ============================================================
// Convert SlideElement JSON → Fabric.js objects
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

function makeFabricGradient(
  g: GradientFill,
  width: number,
  height: number
): fabric.Gradient<"linear"> | fabric.Gradient<"radial"> {
  if (g.type === "radial") {
    return new fabric.Gradient({
      type: "radial",
      coords: {
        x1: width / 2,
        y1: height / 2,
        r1: 0,
        x2: width / 2,
        y2: height / 2,
        r2: Math.max(width, height) / 2,
      },
      colorStops: g.stops.map((s) => ({
        offset: s.offset,
        color: s.color,
      })),
    });
  }
  const angle = ((g.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new fabric.Gradient({
    type: "linear",
    coords: {
      x1: width / 2 - (cos * width) / 2,
      y1: height / 2 - (sin * height) / 2,
      x2: width / 2 + (cos * width) / 2,
      y2: height / 2 + (sin * height) / 2,
    },
    colorStops: g.stops.map((s) => ({
      offset: s.offset,
      color: s.color,
    })),
  });
}

function applyCommon(
  obj: fabric.FabricObject,
  el: SlideElement,
  extraData?: Record<string, unknown>
) {
  obj.set({
    originX: "left",
    originY: "top",
    left: el.x,
    top: el.y,
    angle: el.rotation ?? 0,
    opacity: el.opacity ?? 1,
    selectable: !(el.locked ?? false),
    evented: !(el.locked ?? false),
    data: { elementId: el.id, elementType: el.type, ...extraData },
  });

  // Apply shadow/glow to any element type
  if (el.shadow) {
    obj.set({
      shadow: new fabric.Shadow({
        color: el.shadow.color,
        blur: el.shadow.blur,
        offsetX: el.shadow.offset_x,
        offsetY: el.shadow.offset_y,
      }),
    });
  }
}

// --- Text ---
function applyListPrefix(content: string, listType?: "bullet" | "numbered" | null): string {
  if (!listType) return content;
  const lines = content.split("\n");
  return lines
    .map((line, i) => {
      if (!line.trim()) return line;
      if (listType === "bullet") return `  •  ${line}`;
      if (listType === "numbered") return `  ${i + 1}.  ${line}`;
      return line;
    })
    .join("\n");
}

function createText(el: TextElement): fabric.Textbox {
  const displayContent = applyListPrefix(el.content || " ", el.list_type);
  const obj = new fabric.Textbox(displayContent, {
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    fontFamily: el.font_family || "Inter, system-ui, sans-serif",
    fontSize: el.font_size ?? 32,
    fill: el.color ?? "#ffffff",
    fontWeight: el.bold ? "bold" : "normal",
    fontStyle: el.italic ? "italic" : "normal",
    underline: el.underline ?? false,
    textAlign: el.align ?? "left",
    lineHeight: el.line_spacing ?? 1.2,
    charSpacing: (el.letter_spacing ?? 0) * 10,
    backgroundColor: el.background || "",
    padding: el.padding ?? 0,
    splitByGrapheme: false,
    editable: true,
  });
  applyCommon(obj, el);
  return obj;
}

// --- Image ---
async function createImage(
  el: ImageElement
): Promise<fabric.FabricImage | fabric.Rect> {
  try {
    const img = await fabric.FabricImage.fromURL(el.src, {
      crossOrigin: "anonymous",
    });
    img.set({
      left: el.x,
      top: el.y,
      scaleX: el.width / (img.width || el.width),
      scaleY: el.height / (img.height || el.height),
    });
    if (el.corner_radius && el.corner_radius > 0) {
      img.set({
        clipPath: new fabric.Rect({
          width: img.width || el.width,
          height: img.height || el.height,
          rx: el.corner_radius / (el.width / (img.width || el.width)),
          ry: el.corner_radius / (el.height / (img.height || el.height)),
          originX: "center",
          originY: "center",
        }),
      });
    }
    applyCommon(img, el);
    return img;
  } catch {
    // Placeholder for broken images
    const placeholder = new fabric.Rect({
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      fill: "#2a2a3e",
      stroke: "#8B5CF6",
      strokeWidth: 2,
      rx: el.corner_radius ?? 0,
      ry: el.corner_radius ?? 0,
    });
    applyCommon(placeholder, el);
    return placeholder;
  }
}

// --- Shape ---
function createShape(el: ShapeElement): fabric.FabricObject {
  let fill: string | fabric.Gradient<"linear"> | fabric.Gradient<"radial"> | undefined;
  if (typeof el.fill === "string") {
    fill = el.fill;
  } else if (el.fill && typeof el.fill === "object" && "type" in el.fill) {
    fill = makeFabricGradient(el.fill, el.width, el.height);
  } else {
    fill = "#8B5CF6";
  }

  const strokeColor = el.stroke?.color ?? undefined;
  const strokeWidth = el.stroke?.width ?? 0;

  let obj: fabric.FabricObject;

  switch (el.shape) {
    case "ellipse":
      obj = new fabric.Ellipse({
        left: el.x,
        top: el.y,
        rx: el.width / 2,
        ry: el.height / 2,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;

    case "triangle":
      obj = new fabric.Triangle({
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;

    case "diamond": {
      const pts = [
        { x: el.width / 2, y: 0 },
        { x: el.width, y: el.height / 2 },
        { x: el.width / 2, y: el.height },
        { x: 0, y: el.height / 2 },
      ];
      obj = new fabric.Polygon(pts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "star": {
      const cx = el.width / 2;
      const cy = el.height / 2;
      const outerR = Math.min(cx, cy);
      const innerR = outerR * 0.4;
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      obj = new fabric.Polygon(points, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "hexagon": {
      const hcx = el.width / 2;
      const hcy = el.height / 2;
      const hr = Math.min(hcx, hcy);
      const hexPts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        hexPts.push({ x: hcx + hr * Math.cos(a), y: hcy + hr * Math.sin(a) });
      }
      obj = new fabric.Polygon(hexPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "pentagon": {
      const pcx = el.width / 2;
      const pcy = el.height / 2;
      const pr = Math.min(pcx, pcy);
      const penPts: { x: number; y: number }[] = [];
      for (let i = 0; i < 5; i++) {
        const a = ((2 * Math.PI) / 5) * i - Math.PI / 2;
        penPts.push({ x: pcx + pr * Math.cos(a), y: pcy + pr * Math.sin(a) });
      }
      obj = new fabric.Polygon(penPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "arrow_right": {
      const aw = el.width;
      const ah = el.height;
      const bodyH = ah * 0.4;
      const bodyW = aw * 0.6;
      const arPts = [
        { x: 0, y: (ah - bodyH) / 2 },
        { x: bodyW, y: (ah - bodyH) / 2 },
        { x: bodyW, y: 0 },
        { x: aw, y: ah / 2 },
        { x: bodyW, y: ah },
        { x: bodyW, y: (ah + bodyH) / 2 },
        { x: 0, y: (ah + bodyH) / 2 },
      ];
      obj = new fabric.Polygon(arPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "arrow_left": {
      const alw = el.width;
      const alh = el.height;
      const alBodyH = alh * 0.4;
      const alBodyW = alw * 0.6;
      const headW = alw - alBodyW;
      const alPts = [
        { x: 0, y: alh / 2 },
        { x: headW, y: 0 },
        { x: headW, y: (alh - alBodyH) / 2 },
        { x: alw, y: (alh - alBodyH) / 2 },
        { x: alw, y: (alh + alBodyH) / 2 },
        { x: headW, y: (alh + alBodyH) / 2 },
        { x: headW, y: alh },
      ];
      obj = new fabric.Polygon(alPts, {
        left: el.x,
        top: el.y,
        fill,
        stroke: strokeColor,
        strokeWidth,
      });
      break;
    }

    case "rounded_rect":
    default:
      obj = new fabric.Rect({
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        fill,
        stroke: strokeColor,
        strokeWidth,
        rx: el.corner_radius ?? (el.shape === "rounded_rect" ? 12 : 0),
        ry: el.corner_radius ?? (el.shape === "rounded_rect" ? 12 : 0),
      });
      break;
  }

  applyCommon(obj, el);
  return obj;
}

// --- Line ---
function createLine(el: LineElement): fabric.Line {
  const obj = new fabric.Line([el.x1, el.y1, el.x2, el.y2], {
    stroke: el.color ?? "#ffffff",
    strokeWidth: el.line_width ?? 2,
    strokeDashArray: el.dash ?? undefined,
    selectable: !(el.locked ?? false),
    evented: !(el.locked ?? false),
    data: { elementId: el.id, elementType: el.type },
  });
  obj.set({
    opacity: el.opacity ?? 1,
    angle: el.rotation ?? 0,
  });
  return obj;
}

// --- Rich Text: per-character styles via Fabric.js styles object ---
function createRichText(el: RichTextElement): fabric.Textbox {
  const content = el.runs.map((r) => r.text).join("") || " ";
  const firstRun = el.runs[0];

  // Build Fabric.js per-character styles: styles[lineIndex][charIndex] = {...}
  const styles: Record<number, Record<number, Record<string, unknown>>> = {};
  let lineIdx = 0;
  let charIdx = 0;

  for (const run of el.runs) {
    const runStyle: Record<string, unknown> = {};
    if (run.color) runStyle.fill = run.color;
    if (run.font_size) runStyle.fontSize = run.font_size;
    if (run.bold !== undefined) runStyle.fontWeight = run.bold ? "bold" : "normal";
    if (run.italic !== undefined) runStyle.fontStyle = run.italic ? "italic" : "normal";
    if (run.underline !== undefined) runStyle.underline = run.underline;
    if (run.font_family) runStyle.fontFamily = run.font_family;
    if (run.letter_spacing) runStyle.charSpacing = run.letter_spacing * 10;

    for (let i = 0; i < run.text.length; i++) {
      const ch = run.text[i];
      if (ch === "\n") {
        lineIdx++;
        charIdx = 0;
        continue;
      }
      if (!styles[lineIdx]) styles[lineIdx] = {};
      styles[lineIdx][charIdx] = { ...runStyle };
      charIdx++;
    }
  }

  const obj = new fabric.Textbox(content, {
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    fontFamily: el.font_family || firstRun?.font_family || "Arial, sans-serif",
    fontSize: firstRun?.font_size ?? 32,
    fill: firstRun?.color ?? "#ffffff",
    fontWeight: firstRun?.bold ? "bold" : "normal",
    fontStyle: firstRun?.italic ? "italic" : "normal",
    underline: firstRun?.underline ?? false,
    textAlign: el.align ?? "left",
    lineHeight: el.line_spacing ?? 1.2,
    backgroundColor: el.background || "",
    padding: el.padding ?? 0,
    splitByGrapheme: false,
    editable: true,
    styles,
  });
  applyCommon(obj, el);
  return obj;
}

// --- Table ---
function getCellText(cell: string | TableCell): string {
  return typeof cell === "string" ? cell : cell.text;
}

function getCellStyle(cell: string | TableCell, defaults: {
  color: string; bg: string; bold: boolean; align: "left" | "center" | "right";
}): { color: string; bg: string; bold: boolean; align: "left" | "center" | "right" } {
  if (typeof cell === "string") return defaults;
  return {
    color: cell.color ?? defaults.color,
    bg: cell.background ?? defaults.bg,
    bold: cell.bold ?? defaults.bold,
    align: cell.align ?? defaults.align,
  };
}

function createTable(el: TableElement): fabric.Group {
  const cells = el.cells || [];
  const numRows = cells.length;
  const numCols = Math.max(...cells.map((r) => r.length), 1);
  const cellPad = el.padding ?? 10;
  const fontSize = el.font_size ?? 14;
  const fontFamily = el.font_family || "Inter, system-ui, sans-serif";
  const borderColor = el.border_color ?? "#2a2a3e";
  const borderWidth = el.border_width ?? 1;
  const textColor = el.text_color ?? "#ffffff";
  const headerTextColor = el.header_text_color ?? "#ffffff";
  const cellColor = el.cell_color ?? "#1a1a2e";
  const headerColor = el.header_color ?? "#8B5CF6";
  const altRowColor = el.alt_row_color ?? "";
  const cornerRadius = el.corner_radius ?? 8;

  const colW = el.width / numCols;
  const rowH = el.height / numRows;

  const objects: fabric.FabricObject[] = [];

  // Outer rounded rect background
  const outerBg = new fabric.Rect({
    left: 0,
    top: 0,
    width: el.width,
    height: el.height,
    fill: cellColor,
    rx: cornerRadius,
    ry: cornerRadius,
    stroke: borderColor,
    strokeWidth: borderWidth,
    originX: "left",
    originY: "top",
  });
  objects.push(outerBg);

  // Cells
  for (let r = 0; r < numRows; r++) {
    const isHeader = !!(el.header_row && r === 0);
    const defaultBg = isHeader
      ? headerColor
      : altRowColor && r % 2 === 1
        ? altRowColor
        : cellColor;
    const defaultTextColor = isHeader ? headerTextColor : textColor;

    for (let c = 0; c < numCols; c++) {
      const raw = cells[r]?.[c] ?? "";
      const style = getCellStyle(raw, {
        color: defaultTextColor,
        bg: defaultBg,
        bold: isHeader,
        align: "left",
      });

      const cx = c * colW;
      const cy = r * rowH;

      // Cell background (only if different from outer or header)
      if (style.bg !== cellColor || isHeader) {
        const isTopLeft = r === 0 && c === 0;
        const isTopRight = r === 0 && c === numCols - 1;
        const isBottomLeft = r === numRows - 1 && c === 0;
        const isBottomRight = r === numRows - 1 && c === numCols - 1;
        const rx = (isTopLeft || isTopRight || isBottomLeft || isBottomRight) ? cornerRadius : 0;

        const cellBg = new fabric.Rect({
          left: cx,
          top: cy,
          width: colW,
          height: rowH,
          fill: style.bg,
          rx: isTopLeft || isTopRight ? rx : 0,
          ry: isTopLeft || isTopRight ? rx : 0,
          originX: "left",
          originY: "top",
        });
        objects.push(cellBg);
      }

      // Cell text
      const text = new fabric.Textbox(getCellText(raw), {
        left: cx + cellPad,
        top: cy + (rowH - fontSize * 1.2) / 2,
        width: colW - cellPad * 2,
        fontSize,
        fontFamily,
        fill: style.color,
        fontWeight: style.bold ? "bold" : "normal",
        textAlign: style.align,
        originX: "left",
        originY: "top",
        selectable: false,
        evented: false,
      });
      objects.push(text);
    }

    // Row border (skip last)
    if (r < numRows - 1) {
      const line = new fabric.Line([0, (r + 1) * rowH, el.width, (r + 1) * rowH], {
        stroke: borderColor,
        strokeWidth: isHeader ? borderWidth + 1 : borderWidth,
        originX: "left",
        originY: "top",
      });
      objects.push(line);
    }
  }

  // Column borders
  for (let c = 1; c < numCols; c++) {
    const line = new fabric.Line([c * colW, 0, c * colW, el.height], {
      stroke: borderColor,
      strokeWidth: borderWidth,
      originX: "left",
      originY: "top",
    });
    objects.push(line);
  }

  const group = new fabric.Group(objects, {
    left: el.x,
    top: el.y,
    originX: "left",
    originY: "top",
  });
  applyCommon(group, el);
  return group;
}

// --- Chart ---
function createChart(el: ChartElement): fabric.Group {
  const objects: fabric.FabricObject[] = [];
  const bgColor = el.background ?? "transparent";
  const textColor = el.text_color ?? "#ffffff";
  const fontSize = el.font_size ?? 12;
  const fontFamily = el.font_family || "Inter, system-ui, sans-serif";
  const padding = 40;
  const defaultColors = ["#8B5CF6", "#f69f02", "#00CC66", "#4488FF", "#FF3333", "#FF69B4", "#00CED1", "#FFD700"];

  // Background
  if (bgColor !== "transparent") {
    objects.push(new fabric.Rect({
      left: 0, top: 0, width: el.width, height: el.height,
      fill: bgColor, rx: 12, ry: 12, originX: "left", originY: "top",
    }));
  }

  // Title
  let titleH = 0;
  if (el.title) {
    const title = new fabric.Textbox(el.title, {
      left: padding, top: 12, width: el.width - padding * 2,
      fontSize: fontSize + 4, fontFamily, fill: textColor,
      fontWeight: "bold", textAlign: "left",
      originX: "left", originY: "top",
    });
    objects.push(title);
    titleH = 32;
  }

  const chartTop = padding + titleH;
  const chartBottom = el.height - padding - (el.show_labels ? 24 : 0);
  const chartLeft = padding + (el.chart_type === "bar" || el.chart_type === "line" ? 40 : 0);
  const chartRight = el.width - padding;
  const chartH = chartBottom - chartTop;
  const chartW = chartRight - chartLeft;

  if (el.chart_type === "bar") {
    const labels = el.data.labels;
    const datasets = el.data.datasets;
    const groupCount = labels.length;
    const barCount = datasets.length;
    const groupWidth = chartW / groupCount;
    const barWidth = (groupWidth * 0.7) / barCount;
    const allValues = datasets.flatMap((d) => d.values);
    const maxVal = Math.max(...allValues, 1);

    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal / 4) * i);
      const yPos = chartBottom - (chartH / 4) * i;
      objects.push(new fabric.Textbox(String(val), {
        left: padding, top: yPos - 6, width: 35,
        fontSize: fontSize - 2, fontFamily, fill: textColor + "80",
        textAlign: "right", originX: "left", originY: "top",
      }));
      // Grid line
      objects.push(new fabric.Line([chartLeft, yPos, chartRight, yPos], {
        stroke: textColor + "15", strokeWidth: 1,
        originX: "left", originY: "top",
      }));
    }

    // Bars
    for (let g = 0; g < groupCount; g++) {
      const groupX = chartLeft + g * groupWidth + groupWidth * 0.15;
      for (let d = 0; d < barCount; d++) {
        const val = datasets[d].values[g] ?? 0;
        const barH = (val / maxVal) * chartH;
        const color = datasets[d].color || defaultColors[d % defaultColors.length];
        objects.push(new fabric.Rect({
          left: groupX + d * barWidth,
          top: chartBottom - barH,
          width: barWidth - 2,
          height: barH,
          fill: color,
          rx: 3, ry: 3,
          originX: "left", originY: "top",
        }));
        // Value label
        if (el.show_values) {
          objects.push(new fabric.Textbox(String(val), {
            left: groupX + d * barWidth, top: chartBottom - barH - 16,
            width: barWidth, fontSize: fontSize - 2, fontFamily,
            fill: textColor + "cc", textAlign: "center",
            originX: "left", originY: "top",
          }));
        }
      }
      // X-axis label
      if (el.show_labels !== false) {
        objects.push(new fabric.Textbox(labels[g], {
          left: chartLeft + g * groupWidth, top: chartBottom + 4,
          width: groupWidth, fontSize: fontSize - 1, fontFamily,
          fill: textColor + "99", textAlign: "center",
          originX: "left", originY: "top",
        }));
      }
    }
  } else if (el.chart_type === "line") {
    const labels = el.data.labels;
    const datasets = el.data.datasets;
    const allValues = datasets.flatMap((d) => d.values);
    const maxVal = Math.max(...allValues, 1);
    const pointCount = labels.length;

    // Grid + Y labels
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal / 4) * i);
      const yPos = chartBottom - (chartH / 4) * i;
      objects.push(new fabric.Textbox(String(val), {
        left: padding, top: yPos - 6, width: 35,
        fontSize: fontSize - 2, fontFamily, fill: textColor + "80",
        textAlign: "right", originX: "left", originY: "top",
      }));
      objects.push(new fabric.Line([chartLeft, yPos, chartRight, yPos], {
        stroke: textColor + "15", strokeWidth: 1,
        originX: "left", originY: "top",
      }));
    }

    // Lines + dots
    for (const ds of datasets) {
      const color = ds.color || defaultColors[0];
      for (let i = 0; i < pointCount; i++) {
        const xPos = chartLeft + (i / Math.max(pointCount - 1, 1)) * chartW;
        const yPos = chartBottom - (ds.values[i] / maxVal) * chartH;

        // Line segment
        if (i > 0) {
          const prevX = chartLeft + ((i - 1) / Math.max(pointCount - 1, 1)) * chartW;
          const prevY = chartBottom - (ds.values[i - 1] / maxVal) * chartH;
          objects.push(new fabric.Line([prevX, prevY, xPos, yPos], {
            stroke: color, strokeWidth: 2.5,
            originX: "left", originY: "top",
          }));
        }
        // Dot
        objects.push(new fabric.Circle({
          left: xPos - 4, top: yPos - 4, radius: 4,
          fill: color, originX: "left", originY: "top",
        }));
        // Value
        if (el.show_values) {
          objects.push(new fabric.Textbox(String(ds.values[i]), {
            left: xPos - 20, top: yPos - 18, width: 40,
            fontSize: fontSize - 2, fontFamily, fill: textColor + "cc",
            textAlign: "center", originX: "left", originY: "top",
          }));
        }
      }
    }

    // X labels
    if (el.show_labels !== false) {
      for (let i = 0; i < pointCount; i++) {
        const xPos = chartLeft + (i / Math.max(pointCount - 1, 1)) * chartW;
        objects.push(new fabric.Textbox(labels[i], {
          left: xPos - groupW(chartW, pointCount) / 2, top: chartBottom + 4,
          width: groupW(chartW, pointCount), fontSize: fontSize - 1, fontFamily,
          fill: textColor + "99", textAlign: "center",
          originX: "left", originY: "top",
        }));
      }
    }
  } else if (el.chart_type === "pie" || el.chart_type === "donut") {
    // Render pie/donut as colored segments using wedge-shaped polygons
    const ds = el.data.datasets[0];
    if (ds) {
      const total = ds.values.reduce((a, b) => a + b, 0);
      const cx = chartLeft + chartW / 2;
      const cy = chartTop + chartH / 2;
      const radius = Math.min(chartW, chartH) / 2 - 10;
      const innerRadius = el.chart_type === "donut" ? radius * 0.55 : 0;
      let startAngle = -Math.PI / 2;

      for (let i = 0; i < ds.values.length; i++) {
        const sliceAngle = (ds.values[i] / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;
        const color = el.colors?.[i] || ds.color || defaultColors[i % defaultColors.length];

        // Create wedge as polygon points
        const steps = Math.max(Math.ceil(sliceAngle / 0.1), 8);
        const points: { x: number; y: number }[] = [];

        if (innerRadius > 0) {
          // Outer arc
          for (let s = 0; s <= steps; s++) {
            const a = startAngle + (sliceAngle * s) / steps;
            points.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
          }
          // Inner arc (reverse)
          for (let s = steps; s >= 0; s--) {
            const a = startAngle + (sliceAngle * s) / steps;
            points.push({ x: cx + Math.cos(a) * innerRadius, y: cy + Math.sin(a) * innerRadius });
          }
        } else {
          points.push({ x: cx, y: cy });
          for (let s = 0; s <= steps; s++) {
            const a = startAngle + (sliceAngle * s) / steps;
            points.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
          }
        }

        objects.push(new fabric.Polygon(points, {
          fill: color, stroke: bgColor !== "transparent" ? bgColor : "#0f0f17",
          strokeWidth: 2, originX: "left", originY: "top",
        }));

        // Label
        if (el.show_labels !== false && el.data.labels[i]) {
          const midAngle = startAngle + sliceAngle / 2;
          const labelR = radius * (el.chart_type === "donut" ? 0.8 : 0.65);
          const lx = cx + Math.cos(midAngle) * labelR;
          const ly = cy + Math.sin(midAngle) * labelR;
          objects.push(new fabric.Textbox(el.data.labels[i], {
            left: lx - 30, top: ly - 8, width: 60,
            fontSize: fontSize - 1, fontFamily, fill: "#ffffff",
            textAlign: "center", originX: "left", originY: "top",
          }));
        }

        startAngle = endAngle;
      }
    }
  }

  // Legend
  if (el.show_legend && el.data.datasets.length > 0 && (el.chart_type === "bar" || el.chart_type === "line")) {
    let legendX = chartRight - el.data.datasets.length * 100;
    for (const ds of el.data.datasets) {
      objects.push(new fabric.Rect({
        left: legendX, top: titleH > 0 ? 16 : 8,
        width: 10, height: 10, fill: ds.color || defaultColors[0],
        rx: 2, ry: 2, originX: "left", originY: "top",
      }));
      objects.push(new fabric.Textbox(ds.label, {
        left: legendX + 14, top: titleH > 0 ? 14 : 6,
        width: 80, fontSize: fontSize - 2, fontFamily,
        fill: textColor + "99", originX: "left", originY: "top",
      }));
      legendX += 100;
    }
  }

  const group = new fabric.Group(objects, {
    left: el.x, top: el.y,
    originX: "left", originY: "top",
  });
  applyCommon(group, el);
  return group;
}

function groupW(chartW: number, count: number): number {
  return count > 1 ? chartW / (count - 1) : chartW;
}

// ============================================================
// Main dispatcher
// ============================================================

export async function createFabricObject(
  el: SlideElement
): Promise<fabric.FabricObject | null> {
  switch (el.type) {
    case "text":
      return createText(el as TextElement);
    case "rich_text":
      return createRichText(el as RichTextElement);
    case "image":
      return createImage(el as ImageElement);
    case "shape":
      return createShape(el as ShapeElement);
    case "line":
      return createLine(el as LineElement);
    case "table":
      return createTable(el as TableElement);
    case "chart":
      return createChart(el as ChartElement);
    default:
      console.warn("Unknown element type:", (el as SlideElement).type);
      return null;
  }
}

// ============================================================
// Reverse: Fabric object → SlideElement update
// ============================================================

export function fabricObjectToElementUpdate(
  obj: fabric.FabricObject
): Partial<SlideElement> {
  const update: Partial<SlideElement> = {
    x: Math.round(obj.left ?? 0),
    y: Math.round(obj.top ?? 0),
    rotation: Math.round(obj.angle ?? 0),
    opacity: obj.opacity ?? 1,
  };

  if (obj instanceof fabric.Textbox) {
    update.width = Math.round(obj.width ?? 0);
    update.height = Math.round(obj.height ?? 0);
    (update as Partial<TextElement>).content = obj.text ?? "";
  } else if (obj instanceof fabric.Line) {
    const line = obj;
    const lineUpdate = update as Partial<LineElement>;
    lineUpdate.x1 = Math.round(line.x1 ?? 0) + (line.left ?? 0);
    lineUpdate.y1 = Math.round(line.y1 ?? 0) + (line.top ?? 0);
    lineUpdate.x2 = Math.round(line.x2 ?? 0) + (line.left ?? 0);
    lineUpdate.y2 = Math.round(line.y2 ?? 0) + (line.top ?? 0);
  } else {
    update.width = Math.round((obj.width ?? 0) * (obj.scaleX ?? 1));
    update.height = Math.round((obj.height ?? 0) * (obj.scaleY ?? 1));
  }

  return update;
}
